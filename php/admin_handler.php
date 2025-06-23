<?php
require_once 'config.php'; // Includes session_start() and DB connection

// --- Admin Authentication Check ---
if (!isset($_SESSION['user_id']) || !isset($_SESSION['user_role']) || $_SESSION['user_role'] !== 'admin') {
    // If not admin, send JSON error and exit.
    // This check should be at the very top before any other output or logic.
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => 'Unauthorized: Access denied. Admins only.']);
    exit;
}

$logged_in_admin_id = $_SESSION['user_id']; // Admin's own user ID

// --- Main Action Router ---
$action = $_GET['action'] ?? $_POST['action'] ?? null; // Allow action via POST too for file uploads etc.

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
            $username = trim($_POST['username'] ?? '');
            $email = trim($_POST['email'] ?? '');
            $password = $_POST['password'] ?? '';
            $role = $_POST['role'] ?? 'user';
            $errors = [];
            if (empty($username) || !preg_match('/^[a-zA-Z0-9_]{3,50}$/', $username)) { $errors['username'] = 'Username must be 3-50 chars, letters, numbers, underscores.'; }
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
                $expires_at = date('Y-m-d H:i:s', time() + 3600);
                $stmt_set_token = $pdo->prepare("UPDATE users SET password_reset_token = ?, reset_token_expires_at = ? WHERE id = ?");
                if ($stmt_set_token->execute([$token, $expires_at, $user_id_to_reset])) {
                    if ($stmt_set_token->rowCount() > 0) {
                        $stmt_user_email = $pdo->prepare("SELECT email, username FROM users WHERE id = ?");
                        $stmt_user_email->execute([$user_id_to_reset]);
                        $user_data = $stmt_user_email->fetch(PDO::FETCH_ASSOC);
                        if ($user_data) {
                            $user_email = $user_data['email']; $username = $user_data['username'];
                            $stmt_smtp_settings = $pdo->query("SELECT setting_key, setting_value FROM admin_settings WHERE setting_key LIKE 'smtp_%' OR setting_key = 'site_name'");
                            $config = $stmt_smtp_settings->fetchAll(PDO::FETCH_KEY_PAIR);
                            $site_name = $config['site_name'] ?? 'Notepadsly';
                            $reset_link = ($_SERVER['REQUEST_SCHEME'] ?? 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . '/reset-password?token=' . $token;
                            $email_subject = "Password Reset Request for $site_name";
                            $email_body = "Hello $username,\n\nA password reset was requested for your account on $site_name.\n\nPlease click the following link to reset your password:\n$reset_link\n\nThis link will expire in 1 hour.\n\nIf you did not request this, please ignore this email.\n\nThanks,\nThe $site_name Team";
                            $mail_log_message = "CONCEPTUAL EMAIL (PHPMailer stub):\nTo: $user_email\nFrom: " . ($config['smtp_from_email'] ?? 'noreply@example.com') . " (" . ($config['smtp_from_name'] ?? $site_name) . ")\nHost: " . ($config['smtp_host'] ?? 'N/A') . ", Port: " . ($config['smtp_port'] ?? 'N/A') . ", User: " . ($config['smtp_user'] ?? 'N/A') . "\nSubject: $email_subject\nBody: $email_body\n";
                            log_error($mail_log_message, __FILE__, __LINE__);
                            echo json_encode(['success' => true, 'message' => "Password reset triggered for user $username. Conceptual email logged. (Token: $token for testing)"]);
                        } else { echo json_encode(['success' => false, 'message' => 'User data not found after setting token.']); }
                    } else { echo json_encode(['success' => false, 'message' => 'User not found.']); }
                } else { log_error("Admin: Failed to set password reset token for user ID $user_id_to_reset", __FILE__, __LINE__); echo json_encode(['success' => false, 'message' => 'Failed to trigger password reset.']);}
            } catch (Exception $e) { log_error("Admin: Error generating password reset token: " . $e->getMessage(), __FILE__, __LINE__); echo json_encode(['success' => false, 'message' => 'Could not generate a secure token.']); }
            break;

        case 'get_user_details':
            header('Content-Type: application/json');
            $user_id_to_edit = (int)($_GET['user_id'] ?? 0);
            if ($user_id_to_edit <= 0) { echo json_encode(['success' => false, 'message' => 'Invalid user ID.']); break; }
            $stmt = $pdo->prepare("SELECT id, username, email, role FROM users WHERE id = ?");
            $stmt->execute([$user_id_to_edit]);
            $user_details = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($user_details) { echo json_encode(['success' => true, 'user' => $user_details]); }
            else { echo json_encode(['success' => false, 'message' => 'User not found.']); }
            break;

        case 'update_user':
            header('Content-Type: application/json');
            // ... (update_user implementation with last admin checks remains the same)
            $user_id_to_update = (int)($_POST['user_id'] ?? 0); $username = trim($_POST['username'] ?? ''); $email = trim($_POST['email'] ?? ''); $role = $_POST['role'] ?? '';
            if ($user_id_to_update <= 0) { echo json_encode(['success' => false, 'message' => 'Invalid user ID for update.']); break; }
            $errors = [];
            if (empty($username) || !preg_match('/^[a-zA-Z0-9_]{3,50}$/', $username)) { $errors['username'] = 'Username must be 3-50 chars...'; }
            if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) { $errors['email'] = 'Invalid email format.'; }
            if (!in_array($role, ['user', 'admin'])) { $errors['role'] = 'Invalid role specified.'; }
            if (!empty($errors)) { echo json_encode(['success' => false, 'message' => 'Validation failed for update.', 'errors' => $errors]); break; }
            $stmt_unique = $pdo->prepare("SELECT id FROM users WHERE (username = ? OR email = ?) AND id != ?");
            $stmt_unique->execute([$username, $email, $user_id_to_update]);
            if ($stmt_unique->fetch()) { echo json_encode(['success' => false, 'message' => 'Username or email already taken by another user.']); break; }
            if ($role === 'user') {
                $stmt_check_role = $pdo->prepare("SELECT role FROM users WHERE id = ?"); $stmt_check_role->execute([$user_id_to_update]); $current_role = $stmt_check_role->fetchColumn();
                if ($current_role === 'admin') {
                    $stmt_count_admins = $pdo->query("SELECT COUNT(*) FROM users WHERE role = 'admin'"); $admin_count = (int)$stmt_count_admins->fetchColumn();
                    if ($admin_count <= 1) { echo json_encode(['success' => false, 'message' => 'Cannot change the role of the last admin user.']); break; }
                }
            }
            if ($user_id_to_update === $logged_in_admin_id && $role === 'user') {
                 $stmt_count_admins = $pdo->query("SELECT COUNT(*) FROM users WHERE role = 'admin'"); $admin_count = (int)$stmt_count_admins->fetchColumn();
                 if($admin_count <=1) { echo json_encode(['success' => false, 'message' => 'You cannot change your own role as you are the only admin.']); break; }
            }
            $stmt_update = $pdo->prepare("UPDATE users SET username = ?, email = ?, role = ? WHERE id = ?");
            if ($stmt_update->execute([$username, $email, $role, $user_id_to_update])) { echo json_encode(['success' => true, 'message' => 'User updated successfully.']); }
            else { log_error("Admin: Failed to update user ID $user_id_to_update", __FILE__, __LINE__); echo json_encode(['success' => false, 'message' => 'Failed to update user.']); }
            break;

        case 'delete_user':
            header('Content-Type: application/json');
            // ... (delete_user implementation with last admin checks remains the same)
            $user_id_to_delete = (int)($_POST['user_id'] ?? 0);
            if ($user_id_to_delete <= 0) { echo json_encode(['success' => false, 'message' => 'Invalid user ID for deletion.']); break; }
            if ($user_id_to_delete === $logged_in_admin_id) { echo json_encode(['success' => false, 'message' => 'Admins cannot delete themselves.']); break; }
            $stmt_check_admin = $pdo->prepare("SELECT role FROM users WHERE id = ?"); $stmt_check_admin->execute([$user_id_to_delete]); $user_to_delete_role = $stmt_check_admin->fetchColumn();
            if ($user_to_delete_role === 'admin') {
                $stmt_count_admins = $pdo->query("SELECT COUNT(*) FROM users WHERE role = 'admin'"); $admin_count = (int)$stmt_count_admins->fetchColumn();
                if ($admin_count <= 1) { echo json_encode(['success' => false, 'message' => 'Cannot delete the last admin user.']); break; }
            }
            $stmt_delete = $pdo->prepare("DELETE FROM users WHERE id = ?");
            if ($stmt_delete->execute([$user_id_to_delete])) {
                if ($stmt_delete->rowCount() > 0) { echo json_encode(['success' => true, 'message' => 'User deleted successfully.']); }
                else { echo json_encode(['success' => false, 'message' => 'User not found or already deleted.']); }
            } else { log_error("Admin: Failed to delete user ID $user_id_to_delete", __FILE__, __LINE__); echo json_encode(['success' => false, 'message' => 'Failed to delete user.']); }
            break;

        case 'upload_site_asset':
            header('Content-Type: application/json');
            // ... (upload_site_asset implementation remains the same)
            if (!isset($_FILES['asset_file']) || !isset($_POST['asset_type'])) { echo json_encode(['success' => false, 'message' => 'Missing file or asset type.']); break; }
            $asset_file = $_FILES['asset_file']; $asset_type = $_POST['asset_type'];
            if ($asset_file['error'] !== UPLOAD_ERR_OK) { echo json_encode(['success' => false, 'message' => 'File upload error: ' . $asset_file['error']]); break; }
            $allowed_logo_types = ['image/png', 'image/jpeg', 'image/gif']; $allowed_favicon_types = ['image/x-icon', 'image/vnd.microsoft.icon', 'image/png']; $max_size = 2 * 1024 * 1024;
            $file_type = mime_content_type($asset_file['tmp_name']); $file_size = $asset_file['size']; $is_valid_type = false; $db_key_to_update = '';
            if ($asset_type === 'logo') { if (in_array($file_type, $allowed_logo_types)) $is_valid_type = true; $db_key_to_update = 'logo_url';
            } elseif ($asset_type === 'favicon') { if (in_array($file_type, $allowed_favicon_types)) $is_valid_type = true; $db_key_to_update = 'favicon_url';
            } else { echo json_encode(['success' => false, 'message' => 'Invalid asset type specified.']); break; }
            if (!$is_valid_type) { echo json_encode(['success' => false, 'message' => "Invalid file type for $asset_type: $file_type."]); break; }
            if ($file_size > $max_size) { echo json_encode(['success' => false, 'message' => 'File is too large (max 2MB).']); break; }
            $upload_dir_relative_to_script = '../../assets/uploads/'; $upload_dir_for_url = '/assets/uploads/';
            if (!is_dir($upload_dir_relative_to_script)) { if (!mkdir($upload_dir_relative_to_script, 0755, true)) { log_error("Admin: Upload directory $upload_dir_relative_to_script does not exist and could not be created.", __FILE__, __LINE__); echo json_encode(['success' => false, 'message' => 'Upload directory issue. Please contact admin.']); break; } }
            if (!is_writable($upload_dir_relative_to_script)) { log_error("Admin: Upload directory $upload_dir_relative_to_script is not writable.", __FILE__, __LINE__); echo json_encode(['success' => false, 'message' => 'Upload directory is not writable. Please contact admin.']); break; }
            $original_filename = basename($asset_file['name']); $sanitized_filename = preg_replace("/[^a-zA-Z0-9\._-]/", "", $original_filename);
            $file_extension = pathinfo($sanitized_filename, PATHINFO_EXTENSION); $new_filename = $asset_type . '_' . time() . '.' . $file_extension;
            $destination_path_on_server = $upload_dir_relative_to_script . $new_filename; $url_path_for_db = $upload_dir_for_url . $new_filename;
            if (move_uploaded_file($asset_file['tmp_name'], $destination_path_on_server)) {
                $stmt_update_db = $pdo->prepare("UPDATE admin_settings SET setting_value = ? WHERE setting_key = ?");
                if ($stmt_update_db->execute([$url_path_for_db, $db_key_to_update])) { echo json_encode(['success' => true, 'message' => ucfirst($asset_type) . ' uploaded successfully.', 'url' => $url_path_for_db, 'asset_type' => $asset_type]);
                } else { log_error("Admin: Failed to update $db_key_to_update in database after file upload.", __FILE__, __LINE__); unlink($destination_path_on_server); echo json_encode(['success' => false, 'message' => 'File uploaded but failed to update database.']); }
            } else { log_error("Admin: Failed to move uploaded file to $destination_path_on_server.", __FILE__, __LINE__); echo json_encode(['success' => false, 'message' => 'Failed to save uploaded file.']); }
            break;

        case 'get_site_settings':
            header('Content-Type: application/json');
            $stmt_settings = $pdo->query("SELECT setting_key, setting_value FROM admin_settings");
            $settings_array = $stmt_settings->fetchAll(PDO::FETCH_KEY_PAIR);
            echo json_encode(['success' => true, 'settings' => $settings_array]);
            break;

        case 'update_site_settings':
            header('Content-Type: application/json');
            // ... (update_site_settings implementation remains the same)
            $posted_settings = $_POST['settings'] ?? [];
            if (empty($posted_settings) || !is_array($posted_settings)) { echo json_encode(['success' => false, 'message' => 'No settings data provided or invalid format.']); break; }
            $allowed_keys = [ 'site_name', 'logo_url', 'favicon_url', 'smtp_host', 'smtp_port', 'smtp_user', 'smtp_password', 'smtp_from_email', 'smtp_from_name', 'enable_2fa' ];
            $pdo->beginTransaction();
            try {
                $stmt_update_setting = $pdo->prepare("UPDATE admin_settings SET setting_value = ? WHERE setting_key = ?"); $updated_count = 0;
                foreach ($posted_settings as $key => $value) {
                    if (in_array($key, $allowed_keys)) {
                        if ($key === 'smtp_port' && !empty($value) && !filter_var($value, FILTER_VALIDATE_INT, ["options" => ["min_range" => 1, "max_range" => 65535]])) { continue; }
                        if ($key === 'enable_2fa') { $value = ($value === 'true' || $value === '1' || $value === true) ? 'true' : 'false'; }
                        $stmt_update_setting->execute([trim($value), $key]); if ($stmt_update_setting->rowCount() > 0) { $updated_count++; }
                    } else { log_error("Admin: Attempt to update disallowed setting key '$key'", __FILE__, __LINE__); }
                }
                $pdo->commit(); echo json_encode(['success' => true, 'message' => $updated_count > 0 ? 'Settings updated successfully.' : 'No settings were changed.']);
            } catch (PDOException $e) { $pdo->rollBack(); log_error("Admin: Failed to update site settings: " . $e->getMessage(), __FILE__, __LINE__); echo json_encode(['success' => false, 'message' => 'Database error updating settings.']); }
            break;

        case 'get_error_logs':
            header('Content-Type: application/json');
            // ... (get_error_logs implementation remains the same)
            $page = isset($_GET['page']) ? (int)$_GET['page'] : 1; $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 25;
            if ($page < 1) $page = 1; if ($limit < 5) $limit = 5; if ($limit > 100) $limit = 100; $offset = ($page - 1) * $limit;
            $stmt_total = $pdo->query("SELECT COUNT(*) FROM error_logs"); $total_logs = (int)$stmt_total->fetchColumn(); $total_pages = ceil($total_logs / $limit);
            $stmt_logs = $pdo->prepare("SELECT * FROM error_logs ORDER BY timestamp DESC LIMIT ? OFFSET ?");
            $stmt_logs->bindParam(1, $limit, PDO::PARAM_INT); $stmt_logs->bindParam(2, $offset, PDO::PARAM_INT); $stmt_logs->execute();
            $logs = $stmt_logs->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode([ 'success' => true, 'logs' => $logs, 'pagination' => [ 'currentPage' => $page, 'perPage' => $limit, 'totalPages' => $total_pages, 'totalLogs' => $total_logs ] ]);
            break;

        case 'export_users_csv':
            // No JSON header for CSV export; headers will be set for file download.
            try {
                $stmt_users = $pdo->query("SELECT id, username, email, role, created_at FROM users ORDER BY id ASC");
                $users = $stmt_users->fetchAll(PDO::FETCH_ASSOC);
                $filename = "notepadsly_users_export_" . date('Y-m-d_H-i-s') . ".csv";
                header('Content-Type: text/csv; charset=utf-8');
                header('Content-Disposition: attachment; filename="' . $filename . '"');
                $output = fopen('php://output', 'w');
                fputcsv($output, ['ID', 'Username', 'Email', 'Role', 'Created At']); // CSV Header
                foreach ($users as $user) {
                    fputcsv($output, [$user['id'], $user['username'], $user['email'], $user['role'], $user['created_at']]);
                }
                fclose($output);
            } catch (PDOException $e) {
                log_error("Admin: Failed to export users to CSV: " . $e->getMessage(), __FILE__, __LINE__);
                if (!headers_sent()) { header("HTTP/1.1 500 Internal Server Error"); }
                echo "Error generating user export. Please check server logs.";
            }
            exit;

        default:
            header('Content-Type: application/json');
            echo json_encode(['success' => false, 'message' => 'Unknown admin action or action not specified.']);
            break;
    }

} catch (PDOException $e) {
    if (!headers_sent()) { header('Content-Type: application/json'); } // Try to send JSON error
    log_error("Admin Handler PDOException for action '$action': " . $e->getMessage(), __FILE__, __LINE__);
    echo json_encode(['success' => false, 'message' => 'A database error occurred in the admin panel.']);
} catch (Exception $e) {
    if (!headers_sent()) { header('Content-Type: application/json'); } // Try to send JSON error
    log_error("Admin Handler Exception for action '$action': " . $e->getMessage(), __FILE__, __LINE__);
    echo json_encode(['success' => false, 'message' => 'An unexpected error occurred in the admin panel.']);
}

exit;
?>
