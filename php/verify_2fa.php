<?php
require_once __DIR__ . '/config.php'; // Adjusted path

// --- Conceptual TOTP Library Includes ---
// require_once __DIR__ . '/../lib/TwoFactorAuth/lib/TwoFactorAuth.php';
// $site_name_for_2fa = 'Notepadsly'; // Should match issuer name used in user_settings_handler.php

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Invalid request method.']);
    exit;
}

if (!isset($_SESSION['2fa_pending']) || !$_SESSION['2fa_pending'] || !isset($_SESSION['2fa_user_id'])) {
    echo json_encode(['success' => false, 'message' => '2FA process not initiated or session expired. Please login again.']);
    exit;
}

$otp_code_input = trim($_POST['otp_code'] ?? '');
if (empty($otp_code_input)) {
    echo json_encode(['success' => false, 'message' => 'OTP code is required.']);
    exit;
}
// Normalize OTP input: remove spaces or dashes if user entered them formatted
$otp_code_normalized = str_replace([' ', '-'], '', $otp_code_input);


$user_id_for_2fa = $_SESSION['2fa_user_id'];
$pdo = getDBConnection();

try {
    $stmt_user = $pdo->prepare("SELECT id, username, email, role, twofa_secret, twofa_enabled, twofa_recovery_codes FROM users WHERE id = ?");
    $stmt_user->execute([$user_id_for_2fa]);
    $user = $stmt_user->fetch(PDO::FETCH_ASSOC);

    if (!$user || !$user['twofa_enabled'] || empty($user['twofa_secret'])) {
        log_error("2FA Verification: User ID $user_id_for_2fa not found, 2FA not enabled, or no secret stored.", __FILE__, __LINE__);
        unset($_SESSION['2fa_pending']); unset($_SESSION['2fa_user_id']); unset($_SESSION['temp_user_data']);
        echo json_encode(['success' => false, 'message' => '2FA setup error for user. Please try logging in again.']);
        exit;
    }

    // --- Real TOTP Library Usage (Conceptual) ---
    // $tfa = new \RobThree\Auth\TwoFactorAuth($site_name_for_2fa);
    // $is_valid_otp = $tfa->verifyCode($user['twofa_secret'], $otp_code_normalized);
    $is_valid_otp = ($otp_code_normalized === '123456' && !empty($user['twofa_secret'])); // Updated STUB

    $recovery_code_used = false;
    if (!$is_valid_otp) {
        // Try as a recovery code if OTP failed
        $stored_hashed_recovery_codes_json = $user['twofa_recovery_codes'];
        if (!empty($stored_hashed_recovery_codes_json)) {
            $hashed_recovery_codes = json_decode($stored_hashed_recovery_codes_json, true);
            if (is_array($hashed_recovery_codes)) {
                $remaining_hashed_codes = [];
                foreach ($hashed_recovery_codes as $hashed_code) {
                    // Note: $otp_code_input should be the raw one for recovery, not $otp_code_normalized if it's alphanumeric
                    if (password_verify($otp_code_input, $hashed_code)) {
                        $is_valid_otp = true; // Treat recovery code as valid OTP for login
                        $recovery_code_used = true;
                        // This code is now used, don't add it to $remaining_hashed_codes
                    } else {
                        $remaining_hashed_codes[] = $hashed_code;
                    }
                }
                if ($recovery_code_used) {
                    // Update stored recovery codes (remove the used one)
                    $new_recovery_codes_json = json_encode(array_values($remaining_hashed_codes)); // Re-index
                    $stmt_update_recovery = $pdo->prepare("UPDATE users SET twofa_recovery_codes = ? WHERE id = ?");
                    $stmt_update_recovery->execute([$new_recovery_codes_json, $user_id_for_2fa]);
                }
            }
        }
    }


    if ($is_valid_otp) {
        if (!isset($_SESSION['temp_user_data']) || !isset($_SESSION['encryption_key'])) {
            log_error("2FA Verification: Missing temp_user_data or encryption_key for user ID $user_id_for_2fa.", __FILE__, __LINE__);
            session_unset(); session_destroy(); session_start();
            echo json_encode(['success' => false, 'message' => 'Session error during 2FA. Please login again.']);
            exit;
        }

        $temp_user_data = $_SESSION['temp_user_data'];
        $_SESSION['user_id'] = $temp_user_data['id'];
        $_SESSION['username'] = $temp_user_data['username'];
        $_SESSION['user_role'] = $temp_user_data['role'];
        $_SESSION['user_email'] = $temp_user_data['email'];
        // $_SESSION['encryption_key'] is preserved.

        unset($_SESSION['2fa_pending']); unset($_SESSION['2fa_user_id']); unset($_SESSION['temp_user_data']);
        session_regenerate_id(true);

        // Add last_login_at to schema.sql: ALTER TABLE users ADD COLUMN last_login_at TIMESTAMP NULL DEFAULT NULL;
        // $stmt_update_last_login = $pdo->prepare("UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?");
        // $stmt_update_last_login->execute([$_SESSION['user_id']]);

        $login_message = 'Login successful! Redirecting...';
        if ($recovery_code_used) {
            $login_message = 'Login successful using a recovery code! You should generate new recovery codes if this was an emergency. Redirecting...';
            // Frontend could show a stronger warning about recovery codes.
        }
        echo json_encode(['success' => true, 'message' => $login_message, 'redirect_url' => '/dashboard']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Invalid OTP or Recovery code. Please try again.']);
    }

} catch (PDOException $e) {
    log_error("2FA Verification PDOException for user ID $user_id_for_2fa: " . $e->getMessage(), __FILE__, __LINE__);
    echo json_encode(['success' => false, 'message' => 'Database error during 2FA verification.']);
} catch (Exception $e) {
    log_error("2FA Verification Exception for user ID $user_id_for_2fa: " . $e->getMessage(), __FILE__, __LINE__);
    echo json_encode(['success' => false, 'message' => 'An unexpected error occurred during 2FA verification.']);
}
exit;
?>
