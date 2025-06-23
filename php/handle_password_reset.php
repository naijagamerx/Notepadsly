<?php
require_once 'config.php';

$token = $_POST['token'] ?? null;
$new_password = $_POST['new_password'] ?? null;
$confirm_password = $_POST['confirm_password'] ?? null;

$error_message = '';
$success_message = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!$token || !$new_password || !$confirm_password) {
        $error_message = "All fields are required.";
    } elseif ($new_password !== $confirm_password) {
        $error_message = "Passwords do not match.";
    } elseif (strlen($new_password) < 8) {
        $error_message = "Password must be at least 8 characters long.";
    } else {
        $pdo = getDBConnection();
        $stmt = $pdo->prepare("SELECT id, reset_token_expires_at FROM users WHERE password_reset_token = ?");
        $stmt->execute([$token]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($user) {
            if (strtotime($user['reset_token_expires_at']) > time()) {
                // Token is valid and not expired
                $hashed_password = password_hash($new_password, PASSWORD_DEFAULT);

                $stmt_update = $pdo->prepare("UPDATE users SET password = ?, password_reset_token = NULL, reset_token_expires_at = NULL WHERE id = ?");
                if ($stmt_update->execute([$hashed_password, $user['id']])) {
                    $success_message = "Your password has been successfully reset! You can now log in with your new password.";
                } else {
                    $error_message = "Failed to update password. Please try again.";
                    log_error("Failed to update password for user ID " . $user['id'] . " after token validation.", __FILE__, __LINE__);
                }
            } else {
                $error_message = "This password reset link has expired. Please request a new one.";
            }
        } else {
            $error_message = "Invalid password reset link. It may have already been used or is incorrect.";
        }
    }
} else {
    // Should not be accessed via GET
    header("Location: /login"); // Redirect if not a POST request
    exit;
}

// Display results on a simple page or redirect back to reset_password_form.php with messages
// For simplicity, just outputting messages here. A better UX would be to render the same page layout.
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Reset Status - Notepadsly</title>
    <link rel="stylesheet" href="../css/style.css">
    <link rel="stylesheet" href="../css/auth.css">
</head>
<body>
    <div class="auth-container">
        <h2>Password Reset</h2>
        <?php if (!empty($success_message)): ?>
            <div class="form-message success" style="display:block;"><?php echo htmlspecialchars($success_message); ?></div>
            <p><a href="/login">Proceed to Login</a></p>
        <?php elseif (!empty($error_message)): ?>
            <div class="form-message error" style="display:block;"><?php echo htmlspecialchars($error_message); ?></div>
            <p>If the problem persists, please <a href="/login">try requesting a new reset link</a>.</p> <!-- Link to login, user might find forgot password again -->
        <?php endif; ?>
    </div>
</body>
</html>
