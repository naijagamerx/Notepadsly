<?php
require_once __DIR__ . '/config.php'; // Adjusted path

// --- Conceptual TOTP Library Includes ---
// Assuming library like RobThree/TwoFactorAuth is placed in php/lib/TwoFactorAuth
// require_once __DIR__ . '/../lib/TwoFactorAuth/lib/TwoFactorAuth.php';
// require_once __DIR__ . '/../lib/TwoFactorAuth/lib/Providers/Qr/BaconQrCodeProvider.php'; // Example QR provider
// require_once __DIR__ . '/../lib/TwoFactorAuth/lib/Providers/Qr/GoogleChartsQrProvider.php'; // Alternative
// require_once __DIR__ . '/../lib/TwoFactorAuth/lib/Providers/Qr/ImageChartsQrProvider.php'; // Alternative
// For BaconQrCodeProvider, BaconQrCode library would also be needed.
// For simplicity, we'll focus on the TwoFactorAuth class methods.

// --- Authentication Check ---
if (!isset($_SESSION['user_id'])) {
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => 'Unauthorized: You must be logged in to manage settings.']);
    exit;
}
$user_id = $_SESSION['user_id'];
$user_email_for_2fa = $_SESSION['user_email'] ?? 'user@example.com'; // Get from session for QR label
$site_name_for_2fa = 'Notepadsly'; // Could also come from admin_settings

header('Content-Type: application/json');

try {
    $pdo = getDBConnection();

    $stmt_2fa_global = $pdo->query("SELECT setting_value FROM admin_settings WHERE setting_key = 'enable_2fa'");
    $global_2fa_enabled = ($stmt_2fa_global->fetchColumn() === 'true');

    $action = $_POST['action'] ?? $_GET['action'] ?? null;

    switch ($action) {
        case 'get_2fa_status': // New action to fetch current status for UI
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

            // --- Real TOTP Library Usage (Conceptual) ---
            // $tfa = new \RobThree\Auth\TwoFactorAuth($site_name_for_2fa);
            // $new_secret = $tfa->createSecret(160); // 160 bits for good security

            // STUB for environments without the library:
            $new_secret = 'STUB_BASE32_SECRET_' . strtoupper(bin2hex(random_bytes(10))); // Placeholder, mimics Base32-like format

            $stmt_store_secret = $pdo->prepare("UPDATE users SET twofa_secret = ?, twofa_enabled = 0 WHERE id = ?"); // Store, but ensure it's disabled until verified
            if ($stmt_store_secret->execute([$new_secret, $user_id])) {
                // $qrCodeUrlData = $tfa->getQRCodeImageAsDataUri($user_email_for_2fa, $new_secret);
                // STUB QR data:
                $qr_code_url_data = "otpauth://totp/" . rawurlencode($site_name_for_2fa) . ":" . rawurlencode($user_email_for_2fa) . "?secret=" . $new_secret . "&issuer=" . rawurlencode($site_name_for_2fa);

                echo json_encode([
                    'success' => true,
                    'secret' => $new_secret,
                    'qr_code_url_data' => $qr_code_url_data
                ]);
            } else {
                echo json_encode(['success' => false, 'message' => 'Failed to store 2FA secret.']);
            }
            break;

        case 'enable_2fa':
            if (!$global_2fa_enabled) { /* ... */ }
            $otp_code = trim($_POST['otp_code'] ?? '');
            $current_secret_stmt = $pdo->prepare("SELECT twofa_secret FROM users WHERE id = ?");
            $current_secret_stmt->execute([$user_id]);
            $current_secret = $current_secret_stmt->fetchColumn();

            if (empty($current_secret)) { /* ... */ }
            if (empty($otp_code)) { /* ... */ }

            // --- Real TOTP Library Usage (Conceptual) ---
            // $tfa = new \RobThree\Auth\TwoFactorAuth($site_name_for_2fa);
            // $is_valid_otp = $tfa->verifyCode($current_secret, $otp_code);
            $is_valid_otp = ($otp_code === '123456' && !empty($current_secret)); // Updated STUB

            if ($is_valid_otp) {
                $plain_recovery_codes = [];
                $hashed_recovery_codes = [];
                for ($i = 0; $i < 10; $i++) {
                    $code = strtoupper(bin2hex(random_bytes(5))); // 10-char hex
                    $plain_recovery_codes[] = substr($code, 0, 5) . '-' . substr($code, 5); // Format like XXXXX-XXXXX
                    $hashed_recovery_codes[] = password_hash($code, PASSWORD_DEFAULT); // Hash for storage
                }
                $hashed_recovery_codes_json = json_encode($hashed_recovery_codes);

                $stmt_enable = $pdo->prepare("UPDATE users SET twofa_enabled = 1, twofa_recovery_codes = ? WHERE id = ? AND twofa_secret = ?"); // Ensure secret matches
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
            // For enhanced security, this should ideally require current OTP or password.
            // For this phase, if user is logged in, allow direct disable.
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
} catch (Exception $e) { // Catch broader exceptions like random_bytes issues
    log_error("User Settings Handler Exception for action '$action': " . $e->getMessage(), __FILE__, __LINE__);
    echo json_encode(['success' => false, 'message' => 'An unexpected error occurred: ' . $e->getMessage()]);
}
exit;
?>
