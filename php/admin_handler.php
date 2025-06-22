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

        // case 'get_site_settings':
            // Fetch from admin_settings table
            // break;
        // case 'update_site_setting':
            // Update admin_settings table
            // break;

        // case 'get_error_logs':
            // Fetch from error_logs table (paginated)
            // break;

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
