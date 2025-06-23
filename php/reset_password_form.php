<?php
require_once 'config.php'; // Basic config, session not strictly needed here but good for consistency

$token = $_GET['token'] ?? null;
$error_message = '';
$show_form = false;
$user_id = null;

if (!$token) {
    $error_message = "No reset token provided. Please use the link from your email.";
} else {
    $pdo = getDBConnection();
    $stmt = $pdo->prepare("SELECT id, reset_token_expires_at FROM users WHERE password_reset_token = ?");
    $stmt->execute([$token]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($user) {
        if (strtotime($user['reset_token_expires_at']) > time()) {
            $show_form = true;
            $user_id = $user['id']; // Store user_id to pass to handler, though token is primary key
        } else {
            $error_message = "This password reset link has expired. Please request a new one.";
            // Optionally, clear the expired token here
            // $stmt_clear = $pdo->prepare("UPDATE users SET password_reset_token = NULL, reset_token_expires_at = NULL WHERE id = ?");
            // $stmt_clear->execute([$user['id']]);
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
    <link rel="stylesheet" href="../css/style.css">
    <link rel="stylesheet" href="../css/auth.css">
    <style>
        /* Additional specific styles if needed */
        .reset-container { padding-top: 30px; }
    </style>
</head>
<body>
    <div class="auth-container reset-container">
        <h2>Reset Your Password</h2>
        <?php if (!empty($error_message)): ?>
            <div class="form-message error" style="display:block;"><?php echo htmlspecialchars($error_message); ?></div>
            <p><a href="/login">Back to Login</a></p>
        <?php elseif ($show_form): ?>
            <form id="passwordResetForm" action="../php/handle_password_reset.php" method="POST">
                <input type="hidden" name="token" value="<?php echo htmlspecialchars($token); ?>">
                <div class="form-group">
                    <label for="new_password">New Password</label>
                    <input type="password" id="new_password" name="new_password" required minlength="8">
                </div>
                <div class="form-group">
                    <label for="confirm_password">Confirm New Password</label>
                    <input type="password" id="confirm_password" name="confirm_password" required minlength="8">
                </div>
                <button type="submit" class="auth-button">Reset Password</button>
            </form>
        <?php endif; ?>
    </div>
    <!-- No JS needed for this simple form, standard POST submission -->
</body>
</html>
