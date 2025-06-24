<?php
require_once 'config.php'; // Includes session_start() and DB connection

// --- Authentication Check ---
if (!isset($_SESSION['user_id'])) {
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => 'Unauthorized: You must be logged in to manage settings.']);
    exit;
}
$user_id = $_SESSION['user_id'];

// --- Main Action Router ---
$action = $_POST['action'] ?? $_GET['action'] ?? null;
header('Content-Type: application/json');

try {
    $pdo = getDBConnection();

    // Check if 2FA is globally enabled by admin (first time setup by user)
    $stmt_2fa_global = $pdo->query("SELECT setting_value FROM admin_settings WHERE setting_key = 'enable_2fa'");
    $global_2fa_enabled = ($stmt_2fa_global->fetchColumn() === 'true');

    switch ($action) {
        case 'generate_2fa_secret':
            if (!$global_2fa_enabled) {
                echo json_encode(['success' => false, 'message' => '2FA is not currently enabled by the site administrator.']);
                break;
            }

            // In a real app, use a library like pragmarx/google2fa-php
            // $google2fa = new \PragmaRX\Google2FAQRCode\Google2FA();
            // $new_secret = $google2fa->generateSecretKey();

            // STUB: Generate a placeholder secret
            $new_secret = 'STUB_SECRET_' . bin2hex(random_bytes(16)); // Placeholder, not Base32

            // Store this temporary/unconfirmed secret with the user, but don't enable 2FA yet.
            // Or, store in session until confirmed. For simplicity, store in DB, enable on confirm.
            $stmt_store_secret = $pdo->prepare("UPDATE users SET twofa_secret = ? WHERE id = ?");
            if ($stmt_store_secret->execute([$new_secret, $user_id])) {
                // STUB: Generate QR Code URL
                // $qrCodeUrl = $google2fa->getQRCodeInline( 'Notepadsly', $_SESSION['email'], $new_secret );
                // For stub, create a placeholder URL format.
                $qr_code_url_data = "otpauth://totp/Notepadsly:" . rawurlencode($_SESSION['user_email'] ?? 'user') . "?secret=" . $new_secret . "&issuer=Notepadsly";

                echo json_encode([
                    'success' => true,
                    'secret' => $new_secret, // User would typically write this down
                    'qr_code_url' => $qr_code_url_data // Data for JS library to generate QR
                ]);
            } else {
                echo json_encode(['success' => false, 'message' => 'Failed to store 2FA secret.']);
            }
            break;

        case 'enable_2fa':
            if (!$global_2fa_enabled) {
                echo json_encode(['success' => false, 'message' => '2FA is not currently enabled by the site administrator.']);
                break;
            }
            $otp_code = trim($_POST['otp_code'] ?? '');
            $current_secret_stmt = $pdo->prepare("SELECT twofa_secret FROM users WHERE id = ?");
            $current_secret_stmt->execute([$user_id]);
            $current_secret = $current_secret_stmt->fetchColumn();

            if (empty($current_secret)) {
                echo json_encode(['success' => false, 'message' => 'No 2FA secret found. Please generate one first.']);
                break;
            }
            if (empty($otp_code)) {
                echo json_encode(['success' => false, 'message' => 'OTP code is required.']);
                break;
            }

            // STUB: OTP Verification (replace with actual library call)
            // $google2fa = new \PragmaRX\Google2FAQRCode\Google2FA();
            // $is_valid_otp = $google2fa->verifyKey($current_secret, $otp_code);
            $is_valid_otp = ($otp_code === '123456'); // Placeholder for testing

            if ($is_valid_otp) {
                // STUB: Generate recovery codes (e.g., 10 codes of 8-10 chars)
                $recovery_codes = [];
                for ($i = 0; $i < 10; $i++) {
                    $recovery_codes[] = strtoupper(bin2hex(random_bytes(5))); // Example: 10-char hex
                }
                // In a real app, hash these before storing, and only show plain text once.
                $hashed_recovery_codes_json = json_encode($recovery_codes); // Store plain for stub, hash in real app

                $stmt_enable = $pdo->prepare("UPDATE users SET twofa_enabled = 1, twofa_recovery_codes = ? WHERE id = ?");
                if ($stmt_enable->execute([$hashed_recovery_codes_json, $user_id])) {
                    echo json_encode([
                        'success' => true,
                        'message' => '2FA enabled successfully! Please save your recovery codes.',
                        'recovery_codes' => $recovery_codes // Show plain text codes ONCE
                    ]);
                } else {
                    echo json_encode(['success' => false, 'message' => 'Failed to enable 2FA.']);
                }
            } else {
                echo json_encode(['success' => false, 'message' => 'Invalid OTP code.']);
            }
            break;

        case 'disable_2fa':
            // For disabling, usually requires current password or an OTP if already logged in via 2FA.
            // For simplicity in this phase, we'll just allow disabling if logged in.
            // A more secure version would re-authenticate.
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
    echo json_encode(['success' => false, 'message' => 'An unexpected error occurred.']);
}
exit;
?>
