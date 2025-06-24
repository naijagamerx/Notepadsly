<?php
require_once __DIR__ . '/config.php'; // For DB, session, encryption, etc.

// --- PHPMailer conceptual includes ---
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception as PHPMailerException;

require_once __DIR__ . '/../lib/PHPMailer/src/Exception.php';
require_once __DIR__ . '/../lib/PHPMailer/src/PHPMailer.php';
require_once __DIR__ . '/../lib/PHPMailer/src/SMTP.php';


$action = $_POST['action'] ?? null;

if ($action === 'request_password_reset') {
    $email_input = trim($_POST['email'] ?? '');
    $_SESSION['forgot_password_message'] = ''; // Clear previous messages
    $_SESSION['forgot_password_message_type'] = '';

    if (empty($email_input) || !filter_var($email_input, FILTER_VALIDATE_EMAIL)) {
        $_SESSION['forgot_password_message'] = 'Please enter a valid email address.';
        $_SESSION['forgot_password_message_type'] = 'error';
        header('Location: /forgot-password'); // Redirect back to the form page
        exit;
    }

    $pdo = getDBConnection();
    try {
        $stmt_user = $pdo->prepare("SELECT id, username, email FROM users WHERE email = ?");
        $stmt_user->execute([$email_input]);
        $user = $stmt_user->fetch(PDO::FETCH_ASSOC);

        if ($user) {
            // User found, generate token and conceptual email
            $user_id = $user['id'];
            $username = $user['username'];
            $user_email = $user['email'];

            $token = bin2hex(random_bytes(32));
            $expires_at = date('Y-m-d H:i:s', time() + 3600); // Token expires in 1 hour

            $stmt_set_token = $pdo->prepare("UPDATE users SET password_reset_token = ?, reset_token_expires_at = ? WHERE id = ?");
            if ($stmt_set_token->execute([$token, $expires_at, $user_id])) {

                $stmt_admin_settings = $pdo->query("SELECT setting_key, setting_value FROM admin_settings");
                $config_from_db = $stmt_admin_settings->fetchAll(PDO::FETCH_KEY_PAIR);
                $site_name = $config_from_db['site_name'] ?? 'Notepadsly';
                $http_host = $_SERVER['HTTP_HOST'] ?? ($config_from_db['site_url'] ?? 'localhost');
                $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' || ($_SERVER['SERVER_PORT'] ?? 80) == 443) ? "https" : "http";
                $reset_link = $protocol . '://' . $http_host . '/reset-password?token=' . $token;

                $email_subject = "Password Reset Request for $site_name";
                $email_body_html = "<p>Hello $username,</p><p>A password reset was requested for your account on $site_name.</p>";
                $email_body_html .= "<p>Please click the following link to reset your password (link expires in 1 hour):</p>";
                $email_body_html .= "<p><a href=\"$reset_link\">$reset_link</a></p>";
                $email_body_html .= "<p>If you did not request this, please ignore this email.</p><p>Thanks,<br>The $site_name Team</p>";
                $email_body_text = strip_tags(str_replace("</p><p>", "\n\n", $email_body_html));

                $email_sent_successfully = false;
                $email_error_info = 'SMTP settings not configured or PHPMailer not fully integrated.';

                if (empty($config_from_db['smtp_host']) || empty($config_from_db['smtp_port']) || empty($config_from_db['smtp_from_email'])) {
                    $email_error_info = "SMTP host, port, or from_email not configured. Email not sent.";
                    log_error("User Password Reset: $email_error_info (User: $username, Email: $user_email)", __FILE__, __LINE__);
                } else {
                    $mail = new PHPMailer(true);
                    try {
                        // $mail->SMTPDebug = SMTP::DEBUG_OFF;
                        $mail->isSMTP();
                        $mail->Host       = $config_from_db['smtp_host'];
                        if (!empty($config_from_db['smtp_user'])) {
                            $mail->SMTPAuth   = true;
                            $mail->Username   = $config_from_db['smtp_user'];
                            $mail->Password   = $config_from_db['smtp_password'] ?? '';
                        } else { $mail->SMTPAuth = false; }
                        $smtp_encryption = strtolower($config_from_db['smtp_encryption'] ?? 'tls');
                        if ($smtp_encryption === 'ssl') { $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS; }
                        else if ($smtp_encryption === 'tls') { $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS; }
                        else { $mail->SMTPSecure = false; $mail->SMTPAutoTLS = false; }
                        $mail->Port       = (int)$config_from_db['smtp_port'];
                        $mail->setFrom($config_from_db['smtp_from_email'], $config_from_db['smtp_from_name'] ?? $site_name);
                        $mail->addAddress($user_email, $username);
                        $mail->isHTML(true); $mail->Subject = $email_subject;
                        $mail->Body    = $email_body_html; $mail->AltBody = $email_body_text;

                        // $mail->send(); // ACTUAL SEND CALL - STUBBED
                        $email_sent_successfully = true; // Assume success for stub if configured
                        $email_error_info = 'Password reset email processed (stubbed send).';
                        log_error("User Password Reset: Email conceptually sent to $user_email. Subject: $email_subject. SMTP Host: {$config_from_db['smtp_host']}", __FILE__, __LINE__);

                    } catch (PHPMailerException $e_mailer) {
                         $email_error_info = "Message could not be sent. Mailer Error: {$mail->ErrorInfo}";
                         log_error("PHPMailer - User Password Reset Email Error for $user_email: {$mail->ErrorInfo}", __FILE__, __LINE__);
                    }
                }
                // Even if email fails conceptually, show a generic success message to prevent user enumeration
            } else {
                // Failed to set token, but still show generic message
                log_error("Failed to set password reset token for user ID $user_id.", __FILE__, __LINE__);
            }
        }
        // Generic message regardless of whether user was found or email sent, for security.
        $_SESSION['forgot_password_message'] = 'If an account with that email exists, a password reset link has been sent. Please check your inbox (and spam folder).';
        $_SESSION['forgot_password_message_type'] = 'success'; // Always show as success type on UI

    } catch (PDOException $e) {
        log_error("PDOException during request_password_reset for email $email_input: " . $e->getMessage(), __FILE__, __LINE__);
        $_SESSION['forgot_password_message'] = 'A database error occurred. Please try again later.';
        $_SESSION['forgot_password_message_type'] = 'error';
    } catch (Exception $e) { // For random_bytes or other errors
        log_error("Exception during request_password_reset for email $email_input: " . $e->getMessage(), __FILE__, __LINE__);
        $_SESSION['forgot_password_message'] = 'An unexpected error occurred. Please try again later.';
        $_SESSION['forgot_password_message_type'] = 'error';
    }
    header('Location: /forgot-password');
    exit;

} else {
    // No action or unknown action, redirect to login or home
    header('Location: /login');
    exit;
}
?>
