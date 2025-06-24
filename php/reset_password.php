<?php
require_once 'config.php';

$token = $_GET['token'] ?? null;
$error_message = '';
$success_message = ''; // For messages from handle_password_reset.php if redirected back here
$show_form = false;

// Check for messages from a previous attempt (e.g., after POSTing to handle_password_reset.php)
if (isset($_SESSION['reset_password_error'])) {
    $error_message = $_SESSION['reset_password_error'];
    unset($_SESSION['reset_password_error']);
}
if (isset($_SESSION['reset_password_success'])) {
    // Success usually redirects to login, but if we wanted to show it on this page:
    // $success_message = $_SESSION['reset_password_success'];
    // unset($_SESSION['reset_password_success']);
    // For now, success redirects from handler.
}


if (!$token && empty($error_message) && empty($success_message)) { // Only if no token and no prior messages
    $error_message = "No reset token provided. Please use the link from your email.";
} elseif ($token) { // Token is present, validate it
    $pdo = getDBConnection();
    $stmt = $pdo->prepare("SELECT id, reset_token_expires_at FROM users WHERE password_reset_token = ?");
    $stmt->execute([$token]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($user) {
        if (strtotime($user['reset_token_expires_at']) > time()) {
            $show_form = true;
        } else {
            $error_message = "This password reset link has expired. Please request a new one.";
            // Optionally, clear the expired token here
            $stmt_clear = $pdo->prepare("UPDATE users SET password_reset_token = NULL, reset_token_expires_at = NULL WHERE id = ?");
            $stmt_clear->execute([$user['id']]);
        }
    } else {
        $error_message = "Invalid password reset link. Please check the link or request a new one.";
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Password - Notepadsly</title>
    <link rel="stylesheet" href="../css/style.css"> <!-- Adjust path if needed based on .htaccess rewrite -->
    <link rel="stylesheet" href="../css/auth.css">   <!-- Adjust path if needed -->
    <style>
        .reset-container { padding-top: 30px; }
        .auth-container { max-width: 450px; } /* Consistent width */
    </style>
</head>
<body>
    <div class="auth-container reset-container">
        <img src="../assets/logo.png" alt="Notepadsly Logo" class="auth-logo" id="loginLogo" style="max-width:120px;">
        <h2>Reset Your Password</h2>

        <?php if (!empty($success_message)): // Should typically not be shown here due to redirect from handler ?>
            <div class="form-message success" style="display:block;"><?php echo htmlspecialchars($success_message); ?></div>
            <p><a href="/login">Proceed to Login</a></p>
        <?php endif; ?>

        <?php if (!empty($error_message)): ?>
            <div class="form-message error" style="display:block;"><?php echo htmlspecialchars($error_message); ?></div>
            <?php if (!$show_form): // Only show "Back to Login" if form is not shown ?>
                 <p style="margin-top:15px;"><a href="/login">Back to Login</a></p>
            <?php endif; ?>
        <?php endif; ?>

        <?php if ($show_form): ?>
            <form id="passwordResetForm" action="../php/handle_password_reset.php" method="POST">
                <input type="hidden" name="token" value="<?php echo htmlspecialchars($token); ?>">
                <div class="form-group">
                    <label for="new_password">New Password</label>
                    <input type="password" id="new_password" name="new_password" required minlength="8" autofocus>
                    <div class="error-message field-error" id="newPasswordError"></div> <!-- For JS validation if added -->
                </div>
                <div class="form-group">
                    <label for="confirm_password">Confirm New Password</label>
                    <input type="password" id="confirm_password" name="confirm_password" required minlength="8">
                    <div class="error-message field-error" id="confirmPasswordError"></div>
                </div>
                <button type="submit" class="auth-button">Reset Password</button>
            </form>
        <?php endif; ?>
    </div>
</body>
</html>
