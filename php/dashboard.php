<?php
require_once 'config.php'; // Includes session_start() and DB connection function

// --- Authentication Check ---
// If the user is not logged in, redirect to the login page.
if (!isset($_SESSION['user_id'])) {
    header("Location: ../html/index.html"); // Adjust path as necessary
    exit;
}

// --- Fetch User Data (Example) ---
$user_id = $_SESSION['user_id'];
$username = $_SESSION['username']; // Set during login

// --- Prepare data for the dashboard (will be expanded significantly) ---
$dashboard_data = [
    'username' => $username,
    'notes' => [],
    'folders' => [],
    'tags' => []
];

// --- Handle API-like requests for dashboard data (Example) ---
// In a more complex app, this might be a separate API endpoint.
if (isset($_GET['action'])) {
    header('Content-Type: application/json');
    $pdo = getDBConnection();

    if ($_GET['action'] === 'get_user_info') {
        echo json_encode(['username' => $username, 'user_id' => $user_id, 'role' => $_SESSION['user_role']]);
        exit;
    }

    // Example: Fetch notes (very basic)
    if ($_GET['action'] === 'get_notes') {
        try {
            $stmt = $pdo->prepare("SELECT id, title, LEFT(content, 100) as snippet, updated_at FROM notes WHERE user_id = ? ORDER BY updated_at DESC");
            $stmt->execute([$user_id]);
            $notes = $stmt->fetchAll();
            echo json_encode(['success' => true, 'notes' => $notes]);
        } catch (PDOException $e) {
            log_error("Error fetching notes: " . $e->getMessage(), __FILE__, __LINE__);
            echo json_encode(['success' => false, 'message' => 'Could not fetch notes.']);
        }
        exit;
    }

    // Example: Create a new note (very basic)
    if ($_GET['action'] === 'create_note' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $title = $_POST['title'] ?? 'Untitled Note';
        $content = $_POST['content'] ?? '';
        // folder_id would also come from POST if creating in a specific folder

        try {
            $stmt = $pdo->prepare("INSERT INTO notes (user_id, title, content) VALUES (?, ?, ?)");
            if ($stmt->execute([$user_id, $title, $content])) {
                echo json_encode(['success' => true, 'message' => 'Note created!', 'note_id' => $pdo->lastInsertId()]);
            } else {
                echo json_encode(['success' => false, 'message' => 'Failed to create note.']);
            }
        } catch (PDOException $e) {
            log_error("Error creating note: " . $e->getMessage(), __FILE__, __LINE__);
            echo json_encode(['success' => false, 'message' => 'Database error creating note.']);
        }
        exit;
    }

    // Add more actions: update_note, delete_note, get_folders, create_folder etc.

    // Fallback for unknown actions
    echo json_encode(['success' => false, 'message' => 'Unknown action.']);
    exit;
}


// --- If not an API action, it implies loading the main dashboard page ---
// The actual HTML is in `../html/dashboard.html`.
// This PHP script is primarily for:
// 1. Authentication check (done above).
// 2. Serving as an endpoint for AJAX requests from dashboard.js (partially implemented above).
// 3. Potentially pre-populating some data if we were embedding PHP directly in HTML,
//    but we're aiming for a cleaner separation with HTML templates and JS fetching data.

// For now, if no specific action is called, this script doesn't output HTML directly.
// The user is expected to be viewing `../html/dashboard.html`, which then makes
// AJAX calls to this script (e.g., `php/dashboard.php?action=get_notes`).

// It might be useful to have a function here to get all initial dashboard data
function getInitialDashboardData($pdo, $user_id) {
    $data = [];
    // Fetch notes
    $stmt_notes = $pdo->prepare("SELECT id, title, LEFT(content, 100) as snippet, updated_at, folder_id FROM notes WHERE user_id = ? ORDER BY updated_at DESC");
    $stmt_notes->execute([$user_id]);
    $data['notes'] = $stmt_notes->fetchAll();

    // Fetch folders
    $stmt_folders = $pdo->prepare("SELECT id, name FROM folders WHERE user_id = ? ORDER BY name ASC");
    $stmt_folders->execute([$user_id]);
    $data['folders'] = $stmt_folders->fetchAll();

    // Fetch tags (unique tags used by the user)
    $stmt_tags = $pdo->prepare("SELECT DISTINCT t.id, t.name FROM tags t JOIN note_tags nt ON t.id = nt.tag_id JOIN notes n ON nt.note_id = n.id WHERE n.user_id = ? ORDER BY t.name ASC");
    $stmt_tags->execute([$user_id]);
    $data['tags'] = $stmt_tags->fetchAll();

    return $data;
}

// If a request like `php/dashboard.php?action=get_initial_data` is made:
if (isset($_GET['action']) && $_GET['action'] === 'get_initial_data') {
    header('Content-Type: application/json');
    try {
        $pdo = getDBConnection();
        $initial_data = getInitialDashboardData($pdo, $user_id);
        echo json_encode(['success' => true, 'data' => $initial_data, 'username' => $username]);
    } catch (PDOException $e) {
        log_error("Error fetching initial dashboard data: " . $e->getMessage(), __FILE__, __LINE__);
        echo json_encode(['success' => false, 'message' => 'Could not fetch initial data.']);
    }
    exit;
}

// If no action is specified, and it's not an AJAX request,
// this script doesn't really "do" anything other than ensure auth.
// The actual HTML page is `../html/dashboard.html`.
// Consider this script as the backend API for the dashboard view.

?>
