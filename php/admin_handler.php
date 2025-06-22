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

        // case 'add_user':
            // Implementation for adding a user
            // break;
        // case 'update_user':
            // Implementation for updating a user
            // break;
        // case 'delete_user':
            // Implementation for deleting a user
            // break;

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
