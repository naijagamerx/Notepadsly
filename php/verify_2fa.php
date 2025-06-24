<?php
require_once __DIR__ . '/config.php';

// --- Conceptual TOTP Library Includes ---
// Assuming library like RobThree/TwoFactorAuth is placed in php/lib/
require_once __DIR__ . '/../lib/TOTP/src/TwoFactorAuth.php';
$site_name_for_2fa = 'Notepadsly'; // Should match issuer name used in user_settings_handler.php

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

    $tfa = new RobThree\Auth\TwoFactorAuth($site_name_for_2fa);
    $is_valid_otp = $tfa->verifyCode($user['twofa_secret'], $otp_code_normalized);
    // $is_valid_otp = ($otp_code_normalized === '123456' && !empty($user['twofa_secret'])); // Old STUB

    $recovery_code_used_successfully = false;
    if (!$is_valid_otp) {
        $stored_hashed_recovery_codes_json = $user['twofa_recovery_codes'];
        if (!empty($stored_hashed_recovery_codes_json)) {
            $hashed_recovery_codes = json_decode($stored_hashed_recovery_codes_json, true);
            if (is_array($hashed_recovery_codes) && !empty($hashed_recovery_codes)) {
                $remaining_hashed_codes = [];
                $code_matched = false;
                foreach ($hashed_recovery_codes as $hashed_code) {
                    // Recovery codes might have dashes, use the raw input for verification
                    if (!$code_matched && password_verify($otp_code_input, $hashed_code)) {
                        $code_matched = true; // Mark as used, don't add to remaining
                        $recovery_code_used_successfully = true;
                    } else {
                        $remaining_hashed_codes[] = $hashed_code;
                    }
                }
                if ($recovery_code_used_successfully) {
                    $new_recovery_codes_json = json_encode(array_values($remaining_hashed_codes));
                    $stmt_update_recovery = $pdo->prepare("UPDATE users SET twofa_recovery_codes = ? WHERE id = ?");
                    if (!$stmt_update_recovery->execute([$new_recovery_codes_json, $user_id_for_2fa])) {
                        log_error("Failed to update recovery codes for user ID $user_id_for_2fa after use.", __FILE__, __LINE__);
                        // Proceed with login, but log this failure.
                    }
                    $is_valid_otp = true; // Allow login
                }
            }
        }
    }

    if ($is_valid_otp) {
        if (!isset($_SESSION['temp_user_data']) || !isset($_SESSION['encryption_key'])) { /* ... error handling ... */ }
        $temp_user_data = $_SESSION['temp_user_data'];
        $_SESSION['user_id'] = $temp_user_data['id'];
        $_SESSION['username'] = $temp_user_data['username'];
        $_SESSION['user_role'] = $temp_user_data['role'];
        $_SESSION['user_email'] = $temp_user_data['email'];

        unset($_SESSION['2fa_pending']); unset($_SESSION['2fa_user_id']); unset($_SESSION['temp_user_data']);
        session_regenerate_id(true);

        // Update last_login_at
        $stmt_update_last_login = $pdo->prepare("UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?");
        $stmt_update_last_login->execute([$_SESSION['user_id']]);

        $login_message = 'Login successful! Redirecting...';
        if ($recovery_code_used_successfully) {
            $login_message = 'Login successful using a recovery code! You have ' . count($remaining_hashed_codes) . ' recovery codes left. Redirecting...';
        }
        echo json_encode(['success' => true, 'message' => $login_message, 'redirect_url' => '/dashboard']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Invalid OTP or Recovery code. Please try again.']);
    }

} catch (PDOException $e) { /* ... */ }
catch (Exception $e) { /* ... */ }
exit;
?>
