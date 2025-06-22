<?php
require_once 'config.php'; // Includes session_start() and DB connection function

// --- Authentication Check ---
// If the user is not logged in, redirect to the login page.
if (!isset($_SESSION['user_id'])) {
    header("Location: /login"); // Updated to extension-less URL
    exit;
}

// --- Tag Management Actions ---
if (isset($_GET['action']) && $_GET['action'] === 'sync_note_tags' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    header('Content-Type: application/json');
    $note_id = (int)($_POST['note_id'] ?? 0);
    $tag_names_json = $_POST['tags'] ?? '[]'; // Expecting a JSON string array of tag names
    $tag_names = json_decode($tag_names_json, true);

    if ($note_id <= 0) {
        echo json_encode(['success' => false, 'message' => 'Invalid note ID.']);
        exit;
    }
    if (json_last_error() !== JSON_ERROR_NONE || !is_array($tag_names)) {
        echo json_encode(['success' => false, 'message' => 'Invalid tags format. Expected JSON array of names.']);
        exit;
    }

    // Ensure the note belongs to the user
    $pdo = getDBConnection();
    $stmt_note_check = $pdo->prepare("SELECT id FROM notes WHERE id = ? AND user_id = ?");
    $stmt_note_check->execute([$note_id, $user_id]);
    if (!$stmt_note_check->fetch()) {
        echo json_encode(['success' => false, 'message' => 'Note not found or access denied.']);
        exit;
    }

    try {
        $pdo->beginTransaction();

        // 1. Process incoming tag names: find or create tags, get their IDs
        $final_tag_ids = [];
        if (!empty($tag_names)) {
            foreach ($tag_names as $name) {
                $name = trim(strtolower($name)); // Normalize: lowercase, trim
                if (empty($name) || strlen($name) > 50) continue; // Basic validation

                // Find tag
                $stmt_find_tag = $pdo->prepare("SELECT id FROM tags WHERE name = ?");
                $stmt_find_tag->execute([$name]);
                $tag = $stmt_find_tag->fetch();

                if ($tag) {
                    $final_tag_ids[] = $tag['id'];
                } else {
                    // Create tag
                    $stmt_create_tag = $pdo->prepare("INSERT INTO tags (name) VALUES (?)");
                    $stmt_create_tag->execute([$name]);
                    $final_tag_ids[] = $pdo->lastInsertId();
                }
            }
        }
        $final_tag_ids = array_unique($final_tag_ids); // Ensure unique IDs

        // 2. Get current tag associations for the note
        $stmt_current_tags = $pdo->prepare("SELECT tag_id FROM note_tags WHERE note_id = ?");
        $stmt_current_tags->execute([$note_id]);
        $current_tag_ids = $stmt_current_tags->fetchAll(PDO::FETCH_COLUMN);

        // 3. Determine tags to add and remove
        $tags_to_add = array_diff($final_tag_ids, $current_tag_ids);
        $tags_to_remove = array_diff($current_tag_ids, $final_tag_ids);

        // 4. Add new associations
        if (!empty($tags_to_add)) {
            $stmt_add_tag = $pdo->prepare("INSERT INTO note_tags (note_id, tag_id) VALUES (?, ?)");
            foreach ($tags_to_add as $tag_id_to_add) {
                $stmt_add_tag->execute([$note_id, $tag_id_to_add]);
            }
        }

        // 5. Remove old associations
        if (!empty($tags_to_remove)) {
            $placeholders_remove = implode(',', array_fill(0, count($tags_to_remove), '?'));
            $stmt_remove_tag = $pdo->prepare("DELETE FROM note_tags WHERE note_id = ? AND tag_id IN ($placeholders_remove)");
            $params_remove = array_merge([$note_id], $tags_to_remove);
            $stmt_remove_tag->execute($params_remove);
        }

        $pdo->commit();
        // Fetch the updated list of tags for the note to send back
        $stmt_updated_note_tags = $pdo->prepare("SELECT t.id, t.name FROM tags t JOIN note_tags nt ON t.id = nt.tag_id WHERE nt.note_id = ? ORDER BY t.name ASC");
        $stmt_updated_note_tags->execute([$note_id]);
        $updated_tags_for_note = $stmt_updated_note_tags->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode(['success' => true, 'message' => 'Tags updated successfully.', 'tags' => $updated_tags_for_note]);

    } catch (PDOException $e) {
        $pdo->rollBack();
        log_error("Error syncing tags for note ID $note_id: " . $e->getMessage(), __FILE__, __LINE__);
        echo json_encode(['success' => false, 'message' => 'Database error syncing tags.']);
    }
    exit;
}

// --- Note Sharing Actions ---
if (isset($_GET['action']) && $_GET['action'] === 'share_note' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    header('Content-Type: application/json');
    $note_id_to_share = (int)($_POST['note_id'] ?? 0);
    $share_with_identifier = trim($_POST['share_with_user'] ?? ''); // Username or Email
    $permission = 'read'; // Hardcoded to 'read' for Phase 1

    if ($note_id_to_share <= 0 || empty($share_with_identifier)) {
        echo json_encode(['success' => false, 'message' => 'Note ID and target user are required.']);
        exit;
    }

    $pdo = getDBConnection();
    try {
        // 1. Validate note belongs to current user (the sharer)
        $stmt_note_owner = $pdo->prepare("SELECT id FROM notes WHERE id = ? AND user_id = ?");
        $stmt_note_owner->execute([$note_id_to_share, $user_id]);
        if (!$stmt_note_owner->fetch()) {
            echo json_encode(['success' => false, 'message' => 'Note not found or you do not own this note.']);
            exit;
        }

        // 2. Find target user by username or email
        $stmt_target_user = $pdo->prepare("SELECT id FROM users WHERE username = ? OR email = ?");
        $stmt_target_user->execute([$share_with_identifier, $share_with_identifier]);
        $target_user = $stmt_target_user->fetch();

        if (!$target_user) {
            echo json_encode(['success' => false, 'message' => 'Target user not found.']);
            exit;
        }
        $target_user_id = $target_user['id'];

        // 3. Ensure not sharing with oneself
        if ($target_user_id === $user_id) {
            echo json_encode(['success' => false, 'message' => 'You cannot share a note with yourself.']);
            exit;
        }

        // 4. Check if already shared with this user
        $stmt_check_existing_share = $pdo->prepare("SELECT id FROM shared_notes WHERE note_id = ? AND shared_with_user_id = ?");
        $stmt_check_existing_share->execute([$note_id_to_share, $target_user_id]);
        if ($stmt_check_existing_share->fetch()) {
            // For Phase 1, if already shared, consider it a success or inform.
            // Later, this could update permission if different.
            echo json_encode(['success' => true, 'message' => 'Note is already shared with this user with read permission.']);
            exit;
        }

        // 5. Insert into shared_notes
        $stmt_insert_share = $pdo->prepare("INSERT INTO shared_notes (note_id, shared_with_user_id, shared_by_user_id, permission) VALUES (?, ?, ?, ?)");
        if ($stmt_insert_share->execute([$note_id_to_share, $target_user_id, $user_id, $permission])) {
            echo json_encode(['success' => true, 'message' => 'Note shared successfully with read-only permission.']);
        } else {
            log_error("Failed to share note ID $note_id_to_share with user ID $target_user_id", __FILE__, __LINE__);
            echo json_encode(['success' => false, 'message' => 'Failed to share note due to a server error.']);
        }

    } catch (PDOException $e) {
        log_error("PDOException while sharing note: " . $e->getMessage(), __FILE__, __LINE__);
        echo json_encode(['success' => false, 'message' => 'Database error during note sharing.']);
    }
    exit;
}


// --- Fetch User Data (Example) ---
$user_id = $_SESSION['user_id']; // User's ID from session (was mislabelled as Admin's before here)
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

// --- CRUD Actions for Notes ---

// Get full content of a single note
if (isset($_GET['action']) && $_GET['action'] === 'get_note_content' && isset($_GET['id'])) {
    header('Content-Type: application/json');
    $note_id = (int)$_GET['id'];
    $pdo = getDBConnection();
    try {
        // Fetch note details
        $stmt_note = $pdo->prepare("SELECT id, title, content, folder_id, created_at, updated_at FROM notes WHERE id = ? AND user_id = ?");
        $stmt_note->execute([$note_id, $user_id]);
        $note = $stmt_note->fetch(PDO::FETCH_ASSOC);

        if ($note) {
            // Fetch tags for this note
            $stmt_tags = $pdo->prepare("
                SELECT t.id, t.name
                FROM tags t
                JOIN note_tags nt ON t.id = nt.tag_id
                WHERE nt.note_id = ?
            ");
            $stmt_tags->execute([$note_id]);
            $note['tags'] = $stmt_tags->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(['success' => true, 'note' => $note]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Note not found or access denied.']);
        }
    } catch (PDOException $e) {
        log_error("Error fetching note content (ID: $note_id): " . $e->getMessage(), __FILE__, __LINE__);
        echo json_encode(['success' => false, 'message' => 'Database error fetching note.']);
    }
    exit;
}

// Update an existing note
if (isset($_GET['action']) && $_GET['action'] === 'update_note' && isset($_POST['note_id']) && $_SERVER['REQUEST_METHOD'] === 'POST') {
    header('Content-Type: application/json');
    $note_id = (int)$_POST['note_id'];
    $title = trim($_POST['title'] ?? 'Untitled Note');
    $content = $_POST['content'] ?? '';
    // $folder_id = isset($_POST['folder_id']) ? (int)$_POST['folder_id'] : null; // For later folder association

    if (empty($title)) $title = 'Untitled Note'; // Ensure title is not empty

    $pdo = getDBConnection();
    try {
        // Optional: Check if folder_id belongs to the user if it's being set
        // $stmt_folder_check = $pdo->prepare("SELECT id FROM folders WHERE id = ? AND user_id = ?");
        // $stmt_folder_check->execute([$folder_id, $user_id]);
        // if ($folder_id !== null && !$stmt_folder_check->fetch()) {
        //     echo json_encode(['success' => false, 'message' => 'Invalid folder.']);
        //     exit;
        // }

        $stmt = $pdo->prepare("UPDATE notes SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?");
        // Add folder_id to query if implementing: "UPDATE notes SET title = ?, content = ?, folder_id = ?, updated_at = ..."
        if ($stmt->execute([$title, $content, $note_id, $user_id])) {
            if ($stmt->rowCount() > 0) {
                echo json_encode(['success' => true, 'message' => 'Note updated successfully.']);
            } else {
                // This can happen if data submitted is the same as data in DB, so no rows affected.
                // Or if note_id is invalid for the user.
                // To differentiate, we could do a SELECT first, but rowCount > 0 is often enough for "updated"
                echo json_encode(['success' => true, 'message' => 'Note updated (or no changes detected).']);
            }
        } else {
            echo json_encode(['success' => false, 'message' => 'Failed to update note.']);
        }
    } catch (PDOException $e) {
        log_error("Error updating note (ID: $note_id): " . $e->getMessage(), __FILE__, __LINE__);
        echo json_encode(['success' => false, 'message' => 'Database error updating note.']);
    }
    exit;
}

// Delete a note
if (isset($_GET['action']) && $_GET['action'] === 'delete_note' && isset($_POST['id']) && $_SERVER['REQUEST_METHOD'] === 'POST') {
    header('Content-Type: application/json');
    $note_id = (int)$_POST['id']; // Assuming ID comes via POST body as per JS example structure
    $pdo = getDBConnection();
    try {
        $stmt = $pdo->prepare("DELETE FROM notes WHERE id = ? AND user_id = ?");
        if ($stmt->execute([$note_id, $user_id])) {
            if ($stmt->rowCount() > 0) {
                echo json_encode(['success' => true, 'message' => 'Note deleted successfully.']);
            } else {
                echo json_encode(['success' => false, 'message' => 'Note not found or already deleted.']);
            }
        } else {
            echo json_encode(['success' => false, 'message' => 'Failed to delete note.']);
        }
    } catch (PDOException $e) {
        log_error("Error deleting note (ID: $note_id): " . $e->getMessage(), __FILE__, __LINE__);
        echo json_encode(['success' => false, 'message' => 'Database error deleting note.']);
    }
    exit;
}

// Reviewing existing create_note from previous plan
if (isset($_GET['action']) && $_GET['action'] === 'create_note' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    header('Content-Type: application/json');
    $title = trim($_POST['title'] ?? 'Untitled Note');
    $content = $_POST['content'] ?? '';
    $folder_id = isset($_POST['folder_id']) && !empty($_POST['folder_id']) ? (int)$_POST['folder_id'] : null;

    if (empty($title)) $title = 'Untitled Note';

    $pdo = getDBConnection();
    try {
        if ($folder_id !== null) {
            $stmt_folder_check = $pdo->prepare("SELECT id FROM folders WHERE id = ? AND user_id = ?");
            $stmt_folder_check->execute([$folder_id, $user_id]);
            if (!$stmt_folder_check->fetch()) {
                echo json_encode(['success' => false, 'message' => 'Invalid folder specified.']);
                exit;
            }
        }

        $stmt = $pdo->prepare("INSERT INTO notes (user_id, title, content, folder_id) VALUES (?, ?, ?, ?)");
        if ($stmt->execute([$user_id, $title, $content, $folder_id])) {
            echo json_encode(['success' => true, 'message' => 'Note created successfully!', 'note_id' => $pdo->lastInsertId()]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Failed to create note.']);
        }
    } catch (PDOException $e) {
        log_error("Error creating note (folder_id: $folder_id): " . $e->getMessage(), __FILE__, __LINE__);
        echo json_encode(['success' => false, 'message' => 'Database error creating note.']);
    }
    exit;
}

// Modify update_note to include folder_id
if (isset($_GET['action']) && $_GET['action'] === 'update_note' && isset($_POST['note_id']) && $_SERVER['REQUEST_METHOD'] === 'POST') {
    header('Content-Type: application/json');
    $note_id = (int)$_POST['note_id'];
    $title = trim($_POST['title'] ?? 'Untitled Note');
    $content = $_POST['content'] ?? '';
    $folder_id = isset($_POST['folder_id']) && !empty($_POST['folder_id']) ? (int)$_POST['folder_id'] : null;

    if (empty($title)) $title = 'Untitled Note';

    $pdo = getDBConnection();
    try {
        if ($folder_id !== null) {
            $stmt_folder_check = $pdo->prepare("SELECT id FROM folders WHERE id = ? AND user_id = ?");
            $stmt_folder_check->execute([$folder_id, $user_id]);
            if (!$stmt_folder_check->fetch()) {
                echo json_encode(['success' => false, 'message' => 'Invalid folder specified.']);
                exit;
            }
        }

        $stmt = $pdo->prepare("UPDATE notes SET title = ?, content = ?, folder_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?");
        if ($stmt->execute([$title, $content, $folder_id, $note_id, $user_id])) {
            // rowCount might be 0 if no actual data changed, still consider it a success.
             echo json_encode(['success' => true, 'message' => 'Note updated successfully.']);
        } else {
            echo json_encode(['success' => false, 'message' => 'Failed to update note.']);
        }
    } catch (PDOException $e) {
        log_error("Error updating note (ID: $note_id, folder_id: $folder_id): " . $e->getMessage(), __FILE__, __LINE__);
        echo json_encode(['success' => false, 'message' => 'Database error updating note.']);
    }
    exit;
}


// --- CRUD Actions for Folders ---

// Create a new folder
if (isset($_GET['action']) && $_GET['action'] === 'create_folder' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    header('Content-Type: application/json');
    $folder_name = trim($_POST['name'] ?? '');

    if (empty($folder_name)) {
        echo json_encode(['success' => false, 'message' => 'Folder name cannot be empty.']);
        exit;
    }
    if (strlen($folder_name) > 255) {
        echo json_encode(['success' => false, 'message' => 'Folder name is too long.']);
        exit;
    }

    $pdo = getDBConnection();
    try {
        // Check if folder with the same name already exists for this user
        $stmt_check = $pdo->prepare("SELECT id FROM folders WHERE user_id = ? AND name = ?");
        $stmt_check->execute([$user_id, $folder_name]);
        if ($stmt_check->fetch()) {
            echo json_encode(['success' => false, 'message' => 'A folder with this name already exists.']);
            exit;
        }

        $stmt = $pdo->prepare("INSERT INTO folders (user_id, name) VALUES (?, ?)");
        if ($stmt->execute([$user_id, $folder_name])) {
            echo json_encode(['success' => true, 'message' => 'Folder created successfully.', 'folder_id' => $pdo->lastInsertId(), 'folder_name' => $folder_name]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Failed to create folder.']);
        }
    } catch (PDOException $e) {
        log_error("Error creating folder (name: $folder_name): " . $e->getMessage(), __FILE__, __LINE__);
        echo json_encode(['success' => false, 'message' => 'Database error creating folder.']);
    }
    exit;
}

// Update an existing folder (rename)
if (isset($_GET['action']) && $_GET['action'] === 'update_folder' && isset($_POST['folder_id']) && $_SERVER['REQUEST_METHOD'] === 'POST') {
    header('Content-Type: application/json');
    $folder_id = (int)$_POST['folder_id'];
    $new_folder_name = trim($_POST['name'] ?? '');

    if (empty($new_folder_name)) {
        echo json_encode(['success' => false, 'message' => 'Folder name cannot be empty.']);
        exit;
    }
    if (strlen($new_folder_name) > 255) {
        echo json_encode(['success' => false, 'message' => 'Folder name is too long.']);
        exit;
    }

    $pdo = getDBConnection();
    try {
        // Check if new folder name already exists for this user (excluding the current folder itself)
        $stmt_check = $pdo->prepare("SELECT id FROM folders WHERE user_id = ? AND name = ? AND id != ?");
        $stmt_check->execute([$user_id, $new_folder_name, $folder_id]);
        if ($stmt_check->fetch()) {
            echo json_encode(['success' => false, 'message' => 'Another folder with this name already exists.']);
            exit;
        }

        $stmt = $pdo->prepare("UPDATE folders SET name = ? WHERE id = ? AND user_id = ?");
        if ($stmt->execute([$new_folder_name, $folder_id, $user_id])) {
            if ($stmt->rowCount() > 0) {
                echo json_encode(['success' => true, 'message' => 'Folder updated successfully.', 'folder_id' => $folder_id, 'folder_name' => $new_folder_name]);
            } else {
                echo json_encode(['success' => false, 'message' => 'Folder not found or no changes made.']);
            }
        } else {
            echo json_encode(['success' => false, 'message' => 'Failed to update folder.']);
        }
    } catch (PDOException $e) {
        log_error("Error updating folder (ID: $folder_id, new_name: $new_folder_name): " . $e->getMessage(), __FILE__, __LINE__);
        echo json_encode(['success' => false, 'message' => 'Database error updating folder.']);
    }
    exit;
}

// Delete a folder
if (isset($_GET['action']) && $_GET['action'] === 'delete_folder' && isset($_POST['folder_id']) && $_SERVER['REQUEST_METHOD'] === 'POST') {
    header('Content-Type: application/json');
    $folder_id = (int)$_POST['folder_id'];
    $pdo = getDBConnection();

    try {
        $pdo->beginTransaction();

        // Disassociate notes from this folder
        $stmt_update_notes = $pdo->prepare("UPDATE notes SET folder_id = NULL WHERE folder_id = ? AND user_id = ?");
        $stmt_update_notes->execute([$folder_id, $user_id]);

        // Delete the folder
        $stmt_delete_folder = $pdo->prepare("DELETE FROM folders WHERE id = ? AND user_id = ?");
        $stmt_delete_folder->execute([$folder_id, $user_id]);

        if ($stmt_delete_folder->rowCount() > 0) {
            $pdo->commit();
            echo json_encode(['success' => true, 'message' => 'Folder deleted successfully. Notes within have been moved to All Notes.']);
        } else {
            $pdo->rollBack();
            echo json_encode(['success' => false, 'message' => 'Folder not found or already deleted.']);
        }
    } catch (PDOException $e) {
        $pdo->rollBack();
        log_error("Error deleting folder (ID: $folder_id): " . $e->getMessage(), __FILE__, __LINE__);
        echo json_encode(['success' => false, 'message' => 'Database error deleting folder.']);
    }
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

    // 1. Fetch notes owned by the user
    $stmt_owned_notes = $pdo->prepare("
        SELECT id, title, LEFT(content, 100) as snippet, updated_at, folder_id, user_id as owner_user_id,
               NULL as shared_by_username, 'owner' as note_status, NULL as permission
        FROM notes
        WHERE user_id = ?
    ");
    $stmt_owned_notes->execute([$user_id]);
    $owned_notes = $stmt_owned_notes->fetchAll(PDO::FETCH_ASSOC);

    // 2. Fetch notes shared with the user
    $stmt_shared_notes = $pdo->prepare("
        SELECT n.id, n.title, LEFT(n.content, 100) as snippet, n.updated_at, n.folder_id, n.user_id as owner_user_id,
               u_owner.username as shared_by_username, 'shared' as note_status, sn.permission
        FROM notes n
        JOIN shared_notes sn ON n.id = sn.note_id
        JOIN users u_owner ON n.user_id = u_owner.id
        WHERE sn.shared_with_user_id = ?
    ");
    $stmt_shared_notes->execute([$user_id]);
    $shared_notes_with_user = $stmt_shared_notes->fetchAll(PDO::FETCH_ASSOC);

    // Combine owned and shared notes. Ensure no duplicates if logic allows sharing own notes (it doesn't currently).
    // Mark them appropriately.
    $all_display_notes = array_merge($owned_notes, $shared_notes_with_user);
    // Sort all notes by updated_at date after merging
    usort($all_display_notes, function($a, $b) {
        return strtotime($b['updated_at']) - strtotime($a['updated_at']);
    });

    $note_ids = array_column($all_display_notes, 'id');
    $note_tags_map = [];

    if (!empty($note_ids)) {
        $placeholders = implode(',', array_fill(0, count($note_ids), '?'));
        $stmt_note_tags = $pdo->prepare("
            SELECT nt.note_id, t.id as tag_id, t.name as tag_name
            FROM note_tags nt
            JOIN tags t ON nt.tag_id = t.id
            WHERE nt.note_id IN ($placeholders)
        ");
        $stmt_note_tags->execute($note_ids);
        while ($row = $stmt_note_tags->fetch(PDO::FETCH_ASSOC)) {
            $note_tags_map[$row['note_id']][] = ['id' => $row['tag_id'], 'name' => $row['tag_name']];
        }
    }

    foreach ($all_display_notes as &$note) {
        $note['tags'] = $note_tags_map[$note['id']] ?? [];
    }
    unset($note);
    $data['notes'] = $all_display_notes;

    // Fetch all folders for the user (only their own folders)
    $stmt_folders = $pdo->prepare("SELECT id, name FROM folders WHERE user_id = ? ORDER BY name ASC");
    $stmt_folders->execute([$user_id]);
    $data['folders'] = $stmt_folders->fetchAll(PDO::FETCH_ASSOC);

    // Fetch all unique tags used by the user (for the sidebar tag list)
    $stmt_all_user_tags = $pdo->prepare("
        SELECT DISTINCT t.id, t.name
        FROM tags t
        JOIN note_tags nt ON t.id = nt.tag_id
        JOIN notes n ON nt.note_id = n.id
        WHERE n.user_id = ?
        ORDER BY t.name ASC
    ");
    $stmt_all_user_tags->execute([$user_id]);
    $data['tags'] = $stmt_all_user_tags->fetchAll(PDO::FETCH_ASSOC);

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
