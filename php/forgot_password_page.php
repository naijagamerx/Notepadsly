<?php
require_once 'config.php'; // For session handling if displaying messages, and consistency
// No specific database interaction needed on this page load, only on form submission.
$message = $_SESSION['forgot_password_message'] ?? null;
$message_type = $_SESSION['forgot_password_message_type'] ?? 'info';
unset($_SESSION['forgot_password_message']);
unset($_SESSION['forgot_password_message_type']);
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Forgot Password - Notepadsly</title>
    <link rel="stylesheet" href="../css/style.css"> <!-- Adjust path if needed -->
    <link rel="stylesheet" href="../css/auth.css">   <!-- Adjust path if needed -->
    <style>
        .forgot-password-container { padding-top: 30px; }
        .auth-container { max-width: 450px; }
    </style>
</head>
<body>
    <div class="auth-container forgot-password-container">
        <img src="../assets/logo.png" alt="Notepadsly Logo" class="auth-logo" style="max-width:120px;">
        <h2>Forgot Your Password?</h2>
        <p>Enter your email address below, and if an account exists, we'll send you a link to reset your password.</p>

        <?php if ($message): ?>
            <div class="form-message <?php echo $message_type === 'success' ? 'success' : 'error'; ?>" style="display:block;">
                <?php echo htmlspecialchars($message); ?>
            </div>
        <?php endif; ?>

        <form id="forgotPasswordForm" action="../php/auth_handler.php" method="POST">
            <input type="hidden" name="action" value="request_password_reset">
            <div class="form-group">
                <label for="email">Email Address</label>
                <input type="email" id="email" name="email" required autofocus>
            </div>
            <button type="submit" class="auth-button">Send Reset Link</button>
        </form>
        <p style="margin-top: 20px; text-align: center;">
            <a href="/login">Back to Login</a>
        </p>
    </div>
    <!-- Minimal JS needed, simple form post. Could add client-side validation later. -->
</body>
</html>
