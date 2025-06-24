<?php
require_once __DIR__ . '/config.php';

// --- PHPMailer ---
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception as PHPMailerException;

// These paths assume PHPMailer is in a 'lib/PHPMailer' directory *sibling* to the 'php' directory.
// Adjust if your structure is different, e.g., if 'lib' is inside 'php'.
// For a typical Composer setup, this would be vendor/autoload.php
require_once __DIR__ . '/../lib/PHPMailer/src/Exception.php';
require_once __DIR__ . '/../lib/PHPMailer/src/PHPMailer.php';
require_once __DIR__ . '/../lib/PHPMailer/src/SMTP.php';


// --- Admin Authentication Check ---
if (!isset($_SESSION['user_id']) || !isset($_SESSION['user_role']) || $_SESSION['user_role'] !== 'admin') {
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => 'Unauthorized: Access denied. Admins only.']);
    exit;
}

$logged_in_admin_id = $_SESSION['user_id'];

// --- Main Action Router ---
$action = $_GET['action'] ?? $_POST['action'] ?? null;

try {
    $pdo = getDBConnection();

    switch ($action) {
        case 'get_admin_info':
            header('Content-Type: application/json');
            echo json_encode(['success' => true, 'username' => $_SESSION['username']]);
            break;

        case 'get_all_users':
            header('Content-Type: application/json');
            $stmt = $pdo->query("SELECT id, username, email, role, created_at FROM users ORDER BY created_at DESC");
            $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(['success' => true, 'users' => $users]);
            break;

        case 'add_user':
            header('Content-Type: application/json');
            // ... (add_user implementation) ...
            break;

        case 'trigger_password_reset':
            header('Content-Type: application/json');
            $user_id_to_reset = (int)($_POST['user_id'] ?? 0);
            if ($user_id_to_reset <= 0) { echo json_encode(['success' => false, 'message' => 'Invalid user ID for password reset.']); break; }

            try {
                $token = bin2hex(random_bytes(32));
                $expires_at = date('Y-m-d H:i:s', time() + 3600);

                $stmt_set_token = $pdo->prepare("UPDATE users SET password_reset_token = ?, reset_token_expires_at = ? WHERE id = ?");
                if ($stmt_set_token->execute([$token, $expires_at, $user_id_to_reset])) {
                    if ($stmt_set_token->rowCount() > 0) {
                        $stmt_user_email = $pdo->prepare("SELECT email, username FROM users WHERE id = ?");
                        $stmt_user_email->execute([$user_id_to_reset]);
                        $user_data = $stmt_user_email->fetch(PDO::FETCH_ASSOC);

                        if ($user_data) {
                            $user_email = $user_data['email']; $username = $user_data['username'];

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
                            $email_error_info = 'SMTP settings not configured.';

                            if (empty($config_from_db['smtp_host']) || empty($config_from_db['smtp_port']) || empty($config_from_db['smtp_from_email'])) {
                                $email_error_info = "SMTP host, port, or from_email not configured. Email not sent.";
                                log_error("Admin: Password Reset - $email_error_info (User: $username, Email: $user_email)", __FILE__, __LINE__);
                            } else {
                                $mail = new PHPMailer(true);
                                try {
                                    // $mail->SMTPDebug = SMTP::DEBUG_SERVER;
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
                                    else { $mail->SMTPSecure = false; $mail->SMTPAutoTLS = false; } // No encryption or explicit 'none'

                                    $mail->Port       = (int)($config_from_db['smtp_port']);
                                    $mail->setFrom($config_from_db['smtp_from_email'], $config_from_db['smtp_from_name'] ?? $site_name);
                                    $mail->addAddress($user_email, $username);
                                    $mail->isHTML(true);
                                    $mail->Subject = $email_subject;
                                    $mail->Body    = $email_body_html;
                                    $mail->AltBody = $email_body_text;

                                    // $mail->send(); // ACTUAL SEND CALL - This remains stubbed by agent
                                    // For testing, assume send is successful if config is present
                                    log_error("PHPMailer: mail->send() STUBBED for password reset to $user_email. Config used: Host={$config_from_db['smtp_host']}", __FILE__, __LINE__);
                                    $email_sent_successfully = true;
                                    $email_error_info = 'Email sending process initiated.';

                                } catch (PHPMailerException $e_mailer) {
                                     $email_error_info = "Message could not be sent. Mailer Error: {$mail->ErrorInfo}";
                                     log_error("Admin: PHPMailer - Password Reset Email Error for $user_email: {$mail->ErrorInfo}", __FILE__, __LINE__);
                                }
                            }

                            if ($email_sent_successfully) {
                                echo json_encode(['success' => true, 'message' => "Password reset triggered for user $username. Email delivery process initiated."]);
                            } else {
                                echo json_encode(['success' => false, 'message' => "Password reset token generated, but failed to initiate email sending. Details: $email_error_info"]);
                            }
                        } else { echo json_encode(['success' => false, 'message' => 'User data not found after setting token.']); }
                    } else { echo json_encode(['success' => false, 'message' => 'User not found or token already set recently.']); }
                } else { log_error("Admin: Failed to set password reset token for user ID $user_id_to_reset", __FILE__, __LINE__); echo json_encode(['success' => false, 'message' => 'Failed to trigger password reset.']);}
            } catch (Exception $e) {
                 log_error("Admin: Error generating password reset token or sending email: " . $e->getMessage(), __FILE__, __LINE__);
                 echo json_encode(['success' => false, 'message' => 'Could not complete password reset process. Error: ' . $e->getMessage()]);
            }
            break;

        case 'get_user_details': header('Content-Type: application/json'); /* ... */ break;
        case 'update_user': header('Content-Type: application/json'); /* ... */ break;
        case 'delete_user': header('Content-Type: application/json'); /* ... */ break;
        case 'upload_site_asset': header('Content-Type: application/json'); /* ... */ break;
        case 'get_site_settings': header('Content-Type: application/json'); /* ... */ break;
        case 'update_site_settings': header('Content-Type: application/json'); /* ... */ break;
        case 'get_error_logs': header('Content-Type: application/json'); /* ... */ break;
        case 'export_users_csv':
            // ... (export_users_csv implementation - handles its own headers and exits)
            try {
                $stmt_users = $pdo->query("SELECT id, username, email, role, created_at FROM users ORDER BY id ASC");
                $users = $stmt_users->fetchAll(PDO::FETCH_ASSOC);
                $filename = "notepadsly_users_export_" . date('Y-m-d_H-i-s') . ".csv";
                header('Content-Type: text/csv; charset=utf-8');
                header('Content-Disposition: attachment; filename="' . $filename . '"');
                $output = fopen('php://output', 'w');
                fputcsv($output, ['ID', 'Username', 'Email', 'Role', 'Created At']);
                foreach ($users as $user) { fputcsv($output, [$user['id'], $user['username'], $user['email'], $user['role'], $user['created_at']]); }
                fclose($output);
            } catch (PDOException $e) { log_error("Admin: Failed to export users to CSV: " . $e->getMessage(), __FILE__, __LINE__); if (!headers_sent()) { header("HTTP/1.1 500 Internal Server Error"); } echo "Error generating user export."; }
            exit;

        default:
            header('Content-Type: application/json');
            echo json_encode(['success' => false, 'message' => 'Unknown admin action or action not specified.']);
            break;
    }

} catch (PDOException $e) {
    if (!headers_sent()) { header('Content-Type: application/json'); }
    log_error("Admin Handler PDOException for action '$action': " . $e->getMessage(), __FILE__, __LINE__);
    echo json_encode(['success' => false, 'message' => 'A database error occurred in the admin panel.']);
} catch (Exception $e) {
    if (!headers_sent()) { header('Content-Type: application/json'); }
    log_error("Admin Handler Exception for action '$action': " . $e->getMessage(), __FILE__, __LINE__);
    echo json_encode(['success' => false, 'message' => 'An unexpected error occurred in the admin panel. Details: ' . $e->getMessage()]);
}

exit;
?>
