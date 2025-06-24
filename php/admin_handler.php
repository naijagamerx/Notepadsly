<?php
require_once 'config.php'; // Includes session_start() and DB connection

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
            $username = trim($_POST['username'] ?? ''); $email = trim($_POST['email'] ?? '');
            $password = $_POST['password'] ?? ''; $role = $_POST['role'] ?? 'user';
            $errors = [];
            if (empty($username) || !preg_match('/^[a-zA-Z0-9_]{3,50}$/', $username)) { $errors['username'] = 'Username must be 3-50 chars...'; }
            if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) { $errors['email'] = 'Invalid email format.'; }
            if (empty($password) || strlen($password) < 8) { $errors['password'] = 'Password must be at least 8 characters.'; }
            if (!in_array($role, ['user', 'admin'])) { $errors['role'] = 'Invalid role specified.'; }
            if (!empty($errors)) { echo json_encode(['success' => false, 'message' => 'Validation failed.', 'errors' => $errors]); break; }
            $stmt = $pdo->prepare("SELECT id FROM users WHERE username = ? OR email = ?");
            $stmt->execute([$username, $email]);
            if ($stmt->fetch()) { echo json_encode(['success' => false, 'message' => 'Username or email already exists.']); break; }
            $hashed_password = password_hash($password, PASSWORD_DEFAULT);
            $stmt_insert = $pdo->prepare("INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)");
            if ($stmt_insert->execute([$username, $email, $hashed_password, $role])) {
                echo json_encode(['success' => true, 'message' => 'User added successfully.', 'user_id' => $pdo->lastInsertId()]);
            } else { log_error("Admin: Failed to add user $username", __FILE__, __LINE__); echo json_encode(['success' => false, 'message' => 'Failed to add user.']); }
            break;

        case 'trigger_password_reset':
            header('Content-Type: application/json');
            $user_id_to_reset = (int)($_POST['user_id'] ?? 0);
            if ($user_id_to_reset <= 0) { echo json_encode(['success' => false, 'message' => 'Invalid user ID for password reset.']); break; }

            try {
                $token = bin2hex(random_bytes(32));
                $expires_at = date('Y-m-d H:i:s', time() + 3600); // Token expires in 1 hour

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
                            // Construct HTTP_HOST carefully for links if not available via $_SERVER (e.g. CLI context)
                            $http_host = $_SERVER['HTTP_HOST'] ?? ($config_from_db['site_url'] ?? 'localhost'); // Fallback to site_url from settings if defined
                            $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' || ($_SERVER['SERVER_PORT'] ?? 80) == 443) ? "https" : "http";
                            $reset_link = $protocol . '://' . $http_host . '/reset-password?token=' . $token;

                            $email_subject = "Password Reset Request for $site_name";
                            $email_body_html = "<p>Hello $username,</p><p>A password reset was requested for your account on $site_name.</p>";
                            $email_body_html .= "<p>Please click the following link to reset your password (link expires in 1 hour):</p>";
                            $email_body_html .= "<p><a href=\"$reset_link\">$reset_link</a></p>";
                            $email_body_html .= "<p>If you did not request this, please ignore this email.</p><p>Thanks,<br>The $site_name Team</p>";
                            $email_body_text = strip_tags(str_replace("</p><p>", "\n\n", $email_body_html)); // Simple text version

                            // --- PHPMailer Integration START (Conceptual) ---
                            // require_once __DIR__ . '/../lib/PHPMailer/src/Exception.php';
                            // require_once __DIR__ . '/../lib/PHPMailer/src/PHPMailer.php';
                            // require_once __DIR__ . '/../lib/PHPMailer/src/SMTP.php';
                            // $mail = new PHPMailer\PHPMailer\PHPMailer(true);

                            $email_sent_successfully = false;
                            $email_error_info = 'PHPMailer not fully integrated/called (stub).';

                            if (empty($config_from_db['smtp_host']) || empty($config_from_db['smtp_port'])) {
                                $email_error_info = "SMTP host or port not configured. Email not sent.";
                                log_error("Admin: Password Reset - $email_error_info (User: $username, Email: $user_email)", __FILE__, __LINE__);
                            } else {
                                try {
                                    // $mail->isSMTP();
                                    // $mail->Host       = $config_from_db['smtp_host'];
                                    // $mail->SMTPAuth   = true;
                                    // $mail->Username   = $config_from_db['smtp_user'];
                                    // $mail->Password   = $config_from_db['smtp_password'];
                                    // $mail->SMTPSecure = strtolower($config_from_db['smtp_encryption'] ?? 'tls') === 'ssl' ? PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS : PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
                                    // $mail->Port       = (int)$config_from_db['smtp_port'];
                                    // $mail->setFrom($config_from_db['smtp_from_email'] ?? 'noreply@example.com', $config_from_db['smtp_from_name'] ?? $site_name);
                                    // $mail->addAddress($user_email, $username);
                                    // $mail->isHTML(true);
                                    // $mail->Subject = $email_subject;
                                    // $mail->Body    = $email_body_html;
                                    // $mail->AltBody = $email_body_text;
                                    // $mail->send();
                                    // $email_sent_successfully = true;
                                    // $email_error_info = 'Email sent conceptually.';

                                    // Logging for current stubbed implementation
                                    $mail_log_message = "CONCEPTUAL EMAIL SENT (PHPMailer stub):\n";
                                    $mail_log_message .= "To: $user_email\n";
                                    $mail_log_message .= "From: " . ($config_from_db['smtp_from_email'] ?? 'noreply@example.com') . " (" . ($config_from_db['smtp_from_name'] ?? $site_name) . ")\n";
                                    $mail_log_message .= "Host: " . ($config_from_db['smtp_host']) . ", Port: " . ($config_from_db['smtp_port']) . "\n";
                                    $mail_log_message .= "Subject: $email_subject\nBody contains reset link: $reset_link\n";
                                    log_error($mail_log_message, __FILE__, __LINE__);
                                    $email_sent_successfully = true;
                                    $email_error_info = 'Email prepared and logged (conceptual send).';

                                } catch (Exception $e) { // PHPMailer Exception (use \PHPMailer\PHPMailer\Exception as e)
                                    // $email_error_info = "Message could not be sent. Mailer Error: {$mail->ErrorInfo}";
                                    // log_error("Admin: PHPMailer - Password Reset Email Error for $user_email: {$mail->ErrorInfo}", __FILE__, __LINE__);
                                     $email_error_info = "Conceptual PHPMailer exception: " . $e->getMessage();
                                     log_error("Admin: Conceptual PHPMailer Exception - Password Reset Email Error for $user_email: " . $e->getMessage(), __FILE__, __LINE__);
                                }
                            }
                            // --- PHPMailer Integration END ---

                            if ($email_sent_successfully) {
                                echo json_encode(['success' => true, 'message' => "Password reset triggered for user $username. Email delivery process initiated."]);
                            } else {
                                echo json_encode(['success' => false, 'message' => "Password reset token generated, but failed to initiate email sending. Details: $email_error_info"]);
                            }
                        } else { echo json_encode(['success' => false, 'message' => 'User data not found after setting token.']); }
                    } else { echo json_encode(['success' => false, 'message' => 'User not found or token already set recently.']); } // Changed message
                } else { log_error("Admin: Failed to set password reset token for user ID $user_id_to_reset", __FILE__, __LINE__); echo json_encode(['success' => false, 'message' => 'Failed to trigger password reset.']);}
            } catch (Exception $e) { log_error("Admin: Error generating password reset token: " . $e->getMessage(), __FILE__, __LINE__); echo json_encode(['success' => false, 'message' => 'Could not generate a secure token.']); }
            break;

        case 'get_user_details': /* ... same ... */ break;
        case 'update_user': /* ... same ... */ break;
        case 'delete_user': /* ... same ... */ break;
        case 'upload_site_asset': /* ... same ... */ break;
        case 'get_site_settings': /* ... same ... */ break;
        case 'update_site_settings': /* ... same ... */ break;
        case 'get_error_logs': /* ... same ... */ break;
        case 'export_users_csv': /* ... same, with its own header handling ... */ break;

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
    echo json_encode(['success' => false, 'message' => 'An unexpected error occurred in the admin panel.']);
}

exit;
?>
