<?php
require_once 'config.php'; // Ensures session_start()

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Invalid request method.']);
    exit;
}

if (!isset($_SESSION['2fa_pending']) || !$_SESSION['2fa_pending'] || !isset($_SESSION['2fa_user_id'])) {
    echo json_encode(['success' => false, 'message' => '2FA process not initiated or session expired. Please login again.']);
    exit;
}

$otp_code = trim($_POST['otp_code'] ?? '');
if (empty($otp_code)) {
    echo json_encode(['success' => false, 'message' => 'OTP code is required.']);
    exit;
}

$user_id_for_2fa = $_SESSION['2fa_user_id'];
$pdo = getDBConnection();

try {
    $stmt_user = $pdo->prepare("SELECT id, username, email, role, twofa_secret, twofa_enabled FROM users WHERE id = ?");
    $stmt_user->execute([$user_id_for_2fa]);
    $user = $stmt_user->fetch(PDO::FETCH_ASSOC);

    if (!$user || !$user['twofa_enabled'] || empty($user['twofa_secret'])) {
        log_error("2FA Verification: User ID $user_id_for_2fa not found, 2FA not enabled, or no secret stored.", __FILE__, __LINE__);
        // Clear pending 2FA state as it's invalid
        unset($_SESSION['2fa_pending']);
        unset($_SESSION['2fa_user_id']);
        echo json_encode(['success' => false, 'message' => '2FA setup error for user. Please try logging in again.']);
        exit;
    }

    // STUB: OTP Verification (replace with actual library call)
    // $google2fa = new \PragmaRX\Google2FAQRCode\Google2FA();
    // $is_valid_otp = $google2fa->verifyKey($user['twofa_secret'], $otp_code);
    $is_valid_otp = ($otp_code === '123456'); // Placeholder for testing

    if ($is_valid_otp) {
        // OTP is correct, complete login
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['username'] = $user['username'];
        $_SESSION['user_role'] = $user['role'];
        $_SESSION['user_email'] = $user['email'];

        // Clear 2FA pending state
        unset($_SESSION['2fa_pending']);
        unset($_SESSION['2fa_user_id']);

        session_regenerate_id(true); // Regenerate session ID after successful full authentication

        // Update last_login_at (if this field exists - requires schema change)
        // $stmt_update_last_login = $pdo->prepare("UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?");
        // $stmt_update_last_login->execute([$user['id']]);

        echo json_encode(['success' => true, 'message' => 'Login successful! Redirecting...', 'redirect_url' => '/dashboard']);
    } else {
        // Invalid OTP
        // Optional: Implement attempt limits / lockout here
        echo json_encode(['success' => false, 'message' => 'Invalid OTP code. Please try again.']);
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
