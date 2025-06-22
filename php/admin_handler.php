<?php
require_once 'config.php'; // Includes session_start() and DB connection

// --- Admin Authentication Check ---
// Ensure user is logged in and is an admin.
if (!isset($_SESSION['user_id']) || !isset($_SESSION['user_role']) || $_SESSION['user_role'] !== 'admin') {
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => 'Unauthorized: Access denied. Admins only.']);
    exit;
}

$user_id = $_SESSION['user_id']; // Admin's user ID

// --- Main Action Router ---
$action = $_GET['action'] ?? null;
header('Content-Type: application/json'); // Default response type

try {
    $pdo = getDBConnection();

    switch ($action) {
        case 'get_admin_info':
            echo json_encode(['success' => true, 'username' => $_SESSION['username']]);
            break;

        case 'get_all_users':
            $stmt = $pdo->query("SELECT id, username, email, role, created_at FROM users ORDER BY created_at DESC");
            $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(['success' => true, 'users' => $users]);
            break;

        case 'add_user':
            // Requires: username, email, password, role
            $username = trim($_POST['username'] ?? '');
            $email = trim($_POST['email'] ?? '');
            $password = $_POST['password'] ?? '';
            $role = $_POST['role'] ?? 'user'; // Default to 'user'

            // Validation
            $errors = [];
            if (empty($username) || !preg_match('/^[a-zA-Z0-9_]{3,50}$/', $username)) {
                $errors['username'] = 'Username must be 3-50 chars, letters, numbers, underscores.';
            }
            if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                $errors['email'] = 'Invalid email format.';
            }
            if (empty($password) || strlen($password) < 8) {
                $errors['password'] = 'Password must be at least 8 characters.';
            }
            if (!in_array($role, ['user', 'admin'])) {
                $errors['role'] = 'Invalid role specified.';
            }

            if (!empty($errors)) {
                echo json_encode(['success' => false, 'message' => 'Validation failed.', 'errors' => $errors]);
                break;
            }

            // Check uniqueness
            $stmt = $pdo->prepare("SELECT id FROM users WHERE username = ? OR email = ?");
            $stmt->execute([$username, $email]);
            if ($stmt->fetch()) {
                echo json_encode(['success' => false, 'message' => 'Username or email already exists.']);
                break;
            }

            $hashed_password = password_hash($password, PASSWORD_DEFAULT);
            $stmt_insert = $pdo->prepare("INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)");
            if ($stmt_insert->execute([$username, $email, $hashed_password, $role])) {
                echo json_encode(['success' => true, 'message' => 'User added successfully.', 'user_id' => $pdo->lastInsertId()]);
            } else {
                log_error("Admin: Failed to add user $username", __FILE__, __LINE__);
                echo json_encode(['success' => false, 'message' => 'Failed to add user.']);
            }
            break;

        case 'get_user_details':
            // Requires: user_id
            $user_id_to_edit = (int)($_GET['user_id'] ?? 0);
            if ($user_id_to_edit <= 0) {
                echo json_encode(['success' => false, 'message' => 'Invalid user ID.']);
                break;
            }
            $stmt = $pdo->prepare("SELECT id, username, email, role FROM users WHERE id = ?");
            $stmt->execute([$user_id_to_edit]);
            $user_details = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($user_details) {
                echo json_encode(['success' => true, 'user' => $user_details]);
            } else {
                echo json_encode(['success' => false, 'message' => 'User not found.']);
            }
            break;

        case 'update_user':
            // Requires: user_id, username, email, role
            $user_id_to_update = (int)($_POST['user_id'] ?? 0);
            $username = trim($_POST['username'] ?? '');
            $email = trim($_POST['email'] ?? '');
            $role = $_POST['role'] ?? '';

            if ($user_id_to_update <= 0) {
                echo json_encode(['success' => false, 'message' => 'Invalid user ID for update.']);
                break;
            }

            $errors = [];
            if (empty($username) || !preg_match('/^[a-zA-Z0-9_]{3,50}$/', $username)) {
                $errors['username'] = 'Username must be 3-50 chars, letters, numbers, underscores.';
            }
            if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                $errors['email'] = 'Invalid email format.';
            }
            if (!in_array($role, ['user', 'admin'])) {
                $errors['role'] = 'Invalid role specified.';
            }
            // Password change is not handled here. Add if needed, with complexity checks.

            if (!empty($errors)) {
                echo json_encode(['success' => false, 'message' => 'Validation failed for update.', 'errors' => $errors]);
                break;
            }

            // Check uniqueness (if username/email changed)
            $stmt_unique = $pdo->prepare("SELECT id FROM users WHERE (username = ? OR email = ?) AND id != ?");
            $stmt_unique->execute([$username, $email, $user_id_to_update]);
            if ($stmt_unique->fetch()) {
                echo json_encode(['success' => false, 'message' => 'Username or email already taken by another user.']);
                break;
            }

            // Prevent admin from changing their own role if they are the only admin? (More complex logic)
            // For now, allow role change.

            $stmt_update = $pdo->prepare("UPDATE users SET username = ?, email = ?, role = ? WHERE id = ?");
            if ($stmt_update->execute([$username, $email, $role, $user_id_to_update])) {
                echo json_encode(['success' => true, 'message' => 'User updated successfully.']);
            } else {
                log_error("Admin: Failed to update user ID $user_id_to_update", __FILE__, __LINE__);
                echo json_encode(['success' => false, 'message' => 'Failed to update user.']);
            }
            break;

        case 'delete_user':
            // Requires: user_id (from POST for safety)
            $user_id_to_delete = (int)($_POST['user_id'] ?? 0);

            if ($user_id_to_delete <= 0) {
                echo json_encode(['success' => false, 'message' => 'Invalid user ID for deletion.']);
                break;
            }
            if ($user_id_to_delete === $user_id) { // $user_id is the logged-in admin's ID
                echo json_encode(['success' => false, 'message' => 'Admins cannot delete themselves.']);
                break;
            }

            // Consider checking if user is the only admin before deletion - important!
            // For now, simple delete.
            $stmt_delete = $pdo->prepare("DELETE FROM users WHERE id = ?");
            if ($stmt_delete->execute([$user_id_to_delete])) {
                if ($stmt_delete->rowCount() > 0) {
                    echo json_encode(['success' => true, 'message' => 'User deleted successfully.']);
                } else {
                    echo json_encode(['success' => false, 'message' => 'User not found or already deleted.']);
                }
            } else {
                log_error("Admin: Failed to delete user ID $user_id_to_delete", __FILE__, __LINE__);
                echo json_encode(['success' => false, 'message' => 'Failed to delete user.']);
            }
            break;

        case 'get_site_settings':
            $stmt_settings = $pdo->query("SELECT setting_key, setting_value FROM admin_settings");
            $settings_array = $stmt_settings->fetchAll(PDO::FETCH_KEY_PAIR);
            echo json_encode(['success' => true, 'settings' => $settings_array]);
            break;

        case 'update_site_settings':
            // Expects settings as a POST array: $_POST['settings']['site_name'] = 'New Name', etc.
            $posted_settings = $_POST['settings'] ?? [];
            if (empty($posted_settings) || !is_array($posted_settings)) {
                echo json_encode(['success' => false, 'message' => 'No settings data provided or invalid format.']);
                break;
            }

            $allowed_keys = [ // Define keys that can be updated to prevent arbitrary updates
                'site_name', 'logo_url', 'favicon_url',
                'smtp_host', 'smtp_port', 'smtp_user', 'smtp_password',
                'smtp_from_email', 'smtp_from_name', 'enable_2fa'
            ];

            $pdo->beginTransaction();
            try {
                $stmt_update_setting = $pdo->prepare("UPDATE admin_settings SET setting_value = ? WHERE setting_key = ?");
                $updated_count = 0;

                foreach ($posted_settings as $key => $value) {
                    if (in_array($key, $allowed_keys)) {
                        // Basic sanitization/validation can be added here per key
                        if ($key === 'smtp_port' && !empty($value) && !filter_var($value, FILTER_VALIDATE_INT, ["options" => ["min_range" => 1, "max_range" => 65535]])) {
                            // Skip invalid port
                            continue;
                        }
                        if ($key === 'enable_2fa') { // Ensure boolean-like storage
                            $value = ($value === 'true' || $value === '1' || $value === true) ? 'true' : 'false';
                        }

                        $stmt_update_setting->execute([trim($value), $key]);
                        if ($stmt_update_setting->rowCount() > 0) {
                             $updated_count++;
                        }
                    } else {
                        log_error("Admin: Attempt to update disallowed setting key '$key'", __FILE__, __LINE__);
                    }
                }
                $pdo->commit();
                echo json_encode(['success' => true, 'message' => $updated_count > 0 ? 'Settings updated successfully.' : 'No settings were changed.']);
            } catch (PDOException $e) {
                $pdo->rollBack();
                log_error("Admin: Failed to update site settings: " . $e->getMessage(), __FILE__, __LINE__);
                echo json_encode(['success' => false, 'message' => 'Database error updating settings.']);
            }
            break;

        case 'get_error_logs':
            $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
            $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 25; // Default 25 logs per page
            if ($page < 1) $page = 1;
            if ($limit < 5) $limit = 5;
            if ($limit > 100) $limit = 100; // Max limit
            $offset = ($page - 1) * $limit;

            // Get total count for pagination
            $stmt_total = $pdo->query("SELECT COUNT(*) FROM error_logs");
            $total_logs = (int)$stmt_total->fetchColumn();
            $total_pages = ceil($total_logs / $limit);

            $stmt_logs = $pdo->prepare("SELECT * FROM error_logs ORDER BY timestamp DESC LIMIT ? OFFSET ?");
            $stmt_logs->bindParam(1, $limit, PDO::PARAM_INT);
            $stmt_logs->bindParam(2, $offset, PDO::PARAM_INT);
            $stmt_logs->execute();
            $logs = $stmt_logs->fetchAll(PDO::FETCH_ASSOC);

            echo json_encode([
                'success' => true,
                'logs' => $logs,
                'pagination' => [
                    'currentPage' => $page,
                    'perPage' => $limit,
                    'totalPages' => $total_pages,
                    'totalLogs' => $total_logs
                ]
            ]);
            break;

        default:
            echo json_encode(['success' => false, 'message' => 'Unknown admin action or action not specified.']);
            break;
    }

} catch (PDOException $e) {
    log_error("Admin Handler PDOException for action '$action': " . $e->getMessage(), __FILE__, __LINE__);
    echo json_encode(['success' => false, 'message' => 'A database error occurred in the admin panel.']);
} catch (Exception $e) {
    log_error("Admin Handler Exception for action '$action': " . $e->getMessage(), __FILE__, __LINE__);
    echo json_encode(['success' => false, 'message' => 'An unexpected error occurred in the admin panel.']);
}

exit;
?>
