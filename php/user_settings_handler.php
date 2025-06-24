<?php
require_once __DIR__ . '/config.php';

// --- Conceptual TOTP Library Includes ---
// Assuming library like RobThree/TwoFactorAuth is placed in php/lib/
// Adjust path if lib is inside php, e.g., __DIR__ . '/lib/TwoFactorAuth/...'
require_once __DIR__ . '/../lib/TOTP/src/TwoFactorAuth.php'; // Main class
// May need others depending on QR provider chosen by library, e.g.
// require_once __DIR__ . '/../lib/TOTP/src/Providers/Qr/BaconQrCodeProvider.php';
// require_once __DIR__ . '/../lib/BaconQrCode/src/Renderer/ImageRenderer.php'; // etc. for dependencies

// --- Authentication Check ---
if (!isset($_SESSION['user_id'])) {
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => 'Unauthorized: You must be logged in to manage settings.']);
    exit;
}
$user_id = $_SESSION['user_id'];
// Ensure user_email is available in session for QR code label
$user_email_for_2fa = $_SESSION['user_email'] ?? ('user' . $user_id . '@example.com'); // Fallback if not set
$site_name_for_2fa = 'Notepadsly'; // Could also come from admin_settings

header('Content-Type: application/json');

try {
    $pdo = getDBConnection();

    $stmt_2fa_global = $pdo->query("SELECT setting_value FROM admin_settings WHERE setting_key = 'enable_2fa'");
    $global_2fa_enabled = ($stmt_2fa_global->fetchColumn() === 'true');

    $action = $_POST['action'] ?? $_GET['action'] ?? null;

    switch ($action) {
        case 'get_2fa_status':
            $stmt_status = $pdo->prepare("SELECT twofa_enabled FROM users WHERE id = ?");
            $stmt_status->execute([$user_id]);
            $is_enabled = (bool)$stmt_status->fetchColumn();
            echo json_encode(['success' => true, 'twofa_enabled' => $is_enabled]);
            break;

        case 'generate_2fa_secret':
            if (!$global_2fa_enabled) {
                echo json_encode(['success' => false, 'message' => '2FA is not currently enabled by the site administrator.']);
                break;
            }

            $tfa = new RobThree\Auth\TwoFactorAuth($site_name_for_2fa);
            $new_secret = $tfa->createSecret(160); // Generate a 160-bit secret

            $stmt_store_secret = $pdo->prepare("UPDATE users SET twofa_secret = ?, twofa_enabled = 0 WHERE id = ?");
            if ($stmt_store_secret->execute([$new_secret, $user_id])) {
                // Generate QR code URL data (data URI for inline image)
                // Note: getQRCodeImageAsDataUri might require a QR library like BaconQrCode to be installed
                // and a QR provider configured with $tfa if not using default.
                // For simplicity, if direct data URI generation is problematic without full env,
                // we can construct the otpauth:// URL and let JS render it.
                // $qrCodeUrlData = $tfa->getQRCodeImageAsDataUri($user_email_for_2fa, $new_secret);

                // Constructing the otpauth:// URL for client-side QR generation
                $qr_code_data_string = "otpauth://totp/" . rawurlencode($site_name_for_2fa) . ":" . rawurlencode($user_email_for_2fa) . "?secret=" . $new_secret . "&issuer=" . rawurlencode($site_name_for_2fa);

                echo json_encode([
                    'success' => true,
                    'secret' => $new_secret,
                    'qr_code_url_data' => $qr_code_data_string // Data for JS library to generate QR
                ]);
            } else {
                echo json_encode(['success' => false, 'message' => 'Failed to store 2FA secret.']);
            }
            break;

        case 'enable_2fa':
            if (!$global_2fa_enabled) { echo json_encode(['success' => false, 'message' => '2FA is not currently enabled by the site administrator.']); break; }
            $otp_code = trim($_POST['otp_code'] ?? '');
            $current_secret_stmt = $pdo->prepare("SELECT twofa_secret FROM users WHERE id = ?");
            $current_secret_stmt->execute([$user_id]);
            $current_secret = $current_secret_stmt->fetchColumn();

            if (empty($current_secret)) { echo json_encode(['success' => false, 'message' => 'No 2FA secret found. Please generate one first.']); break; }
            if (empty($otp_code)) { echo json_encode(['success' => false, 'message' => 'OTP code is required.']); break; }

            $tfa = new RobThree\Auth\TwoFactorAuth($site_name_for_2fa);
            $is_valid_otp = $tfa->verifyCode($current_secret, $otp_code);
            // $is_valid_otp = ($otp_code === '123456' && !empty($current_secret)); // Old STUB

            if ($is_valid_otp) {
                $plain_recovery_codes = [];
                $hashed_recovery_codes = [];
                for ($i = 0; $i < 10; $i++) {
                    $code = strtoupper(bin2hex(random_bytes(5)));
                    $plain_recovery_codes[] = substr($code, 0, 5) . '-' . substr($code, 5);
                    $hashed_recovery_codes[] = password_hash($code, PASSWORD_DEFAULT);
                }
                $hashed_recovery_codes_json = json_encode($hashed_recovery_codes);

                $stmt_enable = $pdo->prepare("UPDATE users SET twofa_enabled = 1, twofa_recovery_codes = ? WHERE id = ? AND twofa_secret = ?");
                if ($stmt_enable->execute([$hashed_recovery_codes_json, $user_id, $current_secret])) {
                    echo json_encode([
                        'success' => true,
                        'message' => '2FA enabled successfully! Please save your recovery codes securely. Each can only be used once.',
                        'recovery_codes' => $plain_recovery_codes
                    ]);
                } else {
                    echo json_encode(['success' => false, 'message' => 'Failed to enable 2FA in database.']);
                }
            } else {
                echo json_encode(['success' => false, 'message' => 'Invalid OTP code. Please try again.']);
            }
            break;

        case 'disable_2fa':
            $stmt_disable = $pdo->prepare("UPDATE users SET twofa_enabled = 0, twofa_secret = NULL, twofa_recovery_codes = NULL WHERE id = ?");
            if ($stmt_disable->execute([$user_id])) {
                echo json_encode(['success' => true, 'message' => '2FA disabled successfully.']);
            } else {
                echo json_encode(['success' => false, 'message' => 'Failed to disable 2FA.']);
            }
            break;

        default:
            echo json_encode(['success' => false, 'message' => 'Unknown user settings action.']);
            break;
    }

} catch (PDOException $e) {
    log_error("User Settings Handler PDOException for action '$action': " . $e->getMessage(), __FILE__, __LINE__);
    echo json_encode(['success' => false, 'message' => 'A database error occurred.']);
} catch (Exception $e) {
    log_error("User Settings Handler Exception for action '$action': " . $e->getMessage(), __FILE__, __LINE__);
    echo json_encode(['success' => false, 'message' => 'An unexpected error occurred: ' . $e->getMessage()]);
}
exit;
?>
