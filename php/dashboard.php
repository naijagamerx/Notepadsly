<?php
require_once 'config.php'; // Includes session_start() and DB connection function

// This $user_id is the currently logged-in user from the session.
// It was previously fetched after the auth check, moving it up for broader use.
if (!isset($_SESSION['user_id'])) {
    header("Location: /login"); // Updated to extension-less URL
    exit;
}
$user_id = $_SESSION['user_id'];
$username = $_SESSION['username']; // Sharer's username from session


// --- Tag Management Actions ---
if (isset($_GET['action']) && $_GET['action'] === 'sync_note_tags' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    header('Content-Type: application/json');
    $note_id = (int)($_POST['note_id'] ?? 0);
    $tag_names_json = $_POST['tags'] ?? '[]';
    $tag_names = json_decode($tag_names_json, true);

    if ($note_id <= 0) { echo json_encode(['success' => false, 'message' => 'Invalid note ID.']); exit; }
    if (json_last_error() !== JSON_ERROR_NONE || !is_array($tag_names)) { echo json_encode(['success' => false, 'message' => 'Invalid tags format.']); exit; }

    $pdo = getDBConnection();
    $stmt_access_check = $pdo->prepare("
        SELECT n.id FROM notes n
        LEFT JOIN shared_notes sn ON n.id = sn.note_id AND sn.shared_with_user_id = :current_user_id
        WHERE n.id = :note_id AND (n.user_id = :current_user_id OR sn.permission = 'edit')");
    $stmt_access_check->execute([':note_id' => $note_id, ':current_user_id' => $user_id]);
    if (!$stmt_access_check->fetch()) { echo json_encode(['success' => false, 'message' => 'Access denied to modify tags or note not found.']); exit; }

    try {
        $pdo->beginTransaction();
        $final_tag_ids = [];
        if (!empty($tag_names)) {
            foreach ($tag_names as $name) {
                $name = trim(strtolower($name));
                if (empty($name) || strlen($name) > 50) continue;
                $stmt_find_tag = $pdo->prepare("SELECT id FROM tags WHERE name = ?");
                $stmt_find_tag->execute([$name]);
                $tag = $stmt_find_tag->fetch();
                if ($tag) { $final_tag_ids[] = $tag['id']; }
                else { $stmt_create_tag = $pdo->prepare("INSERT INTO tags (name) VALUES (?)"); $stmt_create_tag->execute([$name]); $final_tag_ids[] = $pdo->lastInsertId(); }
            }
        }
        $final_tag_ids = array_unique($final_tag_ids);
        $stmt_current_tags = $pdo->prepare("SELECT tag_id FROM note_tags WHERE note_id = ?");
        $stmt_current_tags->execute([$note_id]);
        $current_tag_ids = $stmt_current_tags->fetchAll(PDO::FETCH_COLUMN);
        $tags_to_add = array_diff($final_tag_ids, $current_tag_ids);
        $tags_to_remove = array_diff($current_tag_ids, $final_tag_ids);
        if (!empty($tags_to_add)) {
            $stmt_add_tag = $pdo->prepare("INSERT INTO note_tags (note_id, tag_id) VALUES (?, ?)");
            foreach ($tags_to_add as $tag_id_to_add) { $stmt_add_tag->execute([$note_id, $tag_id_to_add]); }
        }
        if (!empty($tags_to_remove)) {
            $placeholders_remove = implode(',', array_fill(0, count($tags_to_remove), '?'));
            $stmt_remove_tag = $pdo->prepare("DELETE FROM note_tags WHERE note_id = ? AND tag_id IN ($placeholders_remove)");
            $params_remove = array_merge([$note_id], $tags_to_remove);
            $stmt_remove_tag->execute($params_remove);
        }
        $pdo->commit();
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

// --- Download Note Action ---
if (isset($_GET['action']) && $_GET['action'] === 'download_note' && isset($_GET['id'])) {
    // ... (download_note implementation remains the same)
    $note_id_to_download = (int)$_GET['id'];
    if ($note_id_to_download <= 0) { header("HTTP/1.1 400 Bad Request"); echo "Invalid Note ID."; exit; }
    $pdo = getDBConnection();
    try {
        $stmt_check_access = $pdo->prepare("SELECT n.title, n.content FROM notes n LEFT JOIN shared_notes sn ON n.id = sn.note_id WHERE n.id = ? AND (n.user_id = ? OR sn.shared_with_user_id = ?) LIMIT 1");
        $stmt_check_access->execute([$note_id_to_download, $user_id, $user_id]);
        $note = $stmt_check_access->fetch(PDO::FETCH_ASSOC);
        if ($note) {
            $filename_title = preg_replace('/[^a-z0-9_\-\s\.]/i', '', $note['title']);
            $filename_title = preg_replace('/\s+/', '_', $filename_title);
            if (empty($filename_title)) { $filename_title = 'note'; }
            $filename = $filename_title . ".txt";
            header('Content-Type: text/plain; charset=utf-8');
            header('Content-Disposition: attachment; filename="' . $filename . '"');
            header('Pragma: no-cache'); header('Expires: 0');
            echo $note['content'];
        } else {
            header("HTTP/1.1 404 Not Found");
            log_error("Attempt to download note ID $note_id_to_download failed (not found or no access for user ID $user_id).", __FILE__, __LINE__);
            header("Location: /dashboard?error=download_failed");
        }
    } catch (PDOException $e) {
        log_error("PDOException while downloading note ID $note_id_to_download: " . $e->getMessage(), __FILE__, __LINE__);
        header("HTTP/1.1 500 Internal Server Error");
        header("Location: /dashboard?error=download_error");
    }
    exit;
}


// --- Note Sharing Actions ---
if (isset($_GET['action']) && $_GET['action'] === 'get_shared_with_users' && isset($_GET['note_id'])) {
    // ... (get_shared_with_users implementation remains the same)
    header('Content-Type: application/json');
    $note_id_to_check = (int)$_GET['note_id'];
    if ($note_id_to_check <= 0) { echo json_encode(['success' => false, 'message' => 'Invalid Note ID.']); exit; }
    $pdo = getDBConnection();
    try {
        $stmt_owner_check = $pdo->prepare("SELECT id FROM notes WHERE id = ? AND user_id = ?");
        $stmt_owner_check->execute([$note_id_to_check, $user_id]);
        if (!$stmt_owner_check->fetch()) { echo json_encode(['success' => false, 'message' => 'You do not own this note or note not found.']); exit; }
        $stmt_shared_users = $pdo->prepare("SELECT u.id as user_id, u.username, sn.permission FROM shared_notes sn JOIN users u ON sn.shared_with_user_id = u.id WHERE sn.note_id = ?");
        $stmt_shared_users->execute([$note_id_to_check]);
        $shared_users = $stmt_shared_users->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode(['success' => true, 'shared_users' => $shared_users]);
    } catch (PDOException $e) { log_error("PDOException while getting shared users for note ID $note_id_to_check: " . $e->getMessage(), __FILE__, __LINE__); echo json_encode(['success' => false, 'message' => 'Database error.']); }
    exit;
}

if (isset($_GET['action']) && $_GET['action'] === 'revoke_note_access' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    // ... (revoke_note_access implementation remains the same)
    header('Content-Type: application/json');
    $note_id_to_revoke_from = (int)($_POST['note_id'] ?? 0); $shared_user_id_to_revoke = (int)($_POST['shared_user_id'] ?? 0);
    if ($note_id_to_revoke_from <= 0 || $shared_user_id_to_revoke <= 0) { echo json_encode(['success' => false, 'message' => 'Note ID and Shared User ID are required.']); exit; }
    $pdo = getDBConnection();
    try {
        $stmt_owner_check = $pdo->prepare("SELECT id FROM notes WHERE id = ? AND user_id = ?");
        $stmt_owner_check->execute([$note_id_to_revoke_from, $user_id]);
        if (!$stmt_owner_check->fetch()) { echo json_encode(['success' => false, 'message' => 'You do not own this note or note not found.']); exit; }
        $stmt_revoke = $pdo->prepare("DELETE FROM shared_notes WHERE note_id = ? AND shared_with_user_id = ? AND shared_by_user_id = ?");
        if ($stmt_revoke->execute([$note_id_to_revoke_from, $shared_user_id_to_revoke, $user_id])) {
            if ($stmt_revoke->rowCount() > 0) { echo json_encode(['success' => true, 'message' => 'Access revoked successfully.']); }
            else { echo json_encode(['success' => false, 'message' => 'Share record not found or already revoked.']); }
        } else { log_error("Failed to revoke access for note ID $note_id_to_revoke_from from user ID $shared_user_id_to_revoke", __FILE__, __LINE__); echo json_encode(['success' => false, 'message' => 'Failed to revoke access due to a server error.']); }
    } catch (PDOException $e) { log_error("PDOException while revoking note access: " . $e->getMessage(), __FILE__, __LINE__); echo json_encode(['success' => false, 'message' => 'Database error.']); }
    exit;
}

if (isset($_GET['action']) && $_GET['action'] === 'share_note' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    header('Content-Type: application/json');
    $note_id_to_share = (int)($_POST['note_id'] ?? 0);
    $share_with_identifier = trim($_POST['share_with_user'] ?? '');
    $permission = trim($_POST['permission'] ?? 'read');
    if (!in_array($permission, ['read', 'edit'])) { $permission = 'read'; }
    if ($note_id_to_share <= 0 || empty($share_with_identifier)) { echo json_encode(['success' => false, 'message' => 'Note ID and target user are required.']); exit; }

    $pdo = getDBConnection();
    try {
        $stmt_note_owner = $pdo->prepare("SELECT id, title, user_id AS owner_user_id FROM notes WHERE id = ?"); // Get title and owner_id
        $stmt_note_owner->execute([$note_id_to_share]);
        $note_details = $stmt_note_owner->fetch(PDO::FETCH_ASSOC);
        if (!$note_details || $note_details['owner_user_id'] != $user_id) { // Check ownership
            echo json_encode(['success' => false, 'message' => 'Note not found or you do not own this note.']); exit;
        }
        $note_title = $note_details['title'];

        $stmt_target_user = $pdo->prepare("SELECT id, email, username FROM users WHERE username = ? OR email = ?");
        $stmt_target_user->execute([$share_with_identifier, $share_with_identifier]);
        $target_user = $stmt_target_user->fetch(PDO::FETCH_ASSOC);
        if (!$target_user) { echo json_encode(['success' => false, 'message' => 'Target user not found.']); exit; }
        $target_user_id = $target_user['id'];
        $recipient_email = $target_user['email'];
        $recipient_username = $target_user['username'];

        if ($target_user_id === $user_id) { echo json_encode(['success' => false, 'message' => 'You cannot share a note with yourself.']); exit; }

        $stmt_check_existing_share = $pdo->prepare("SELECT id, permission FROM shared_notes WHERE note_id = ? AND shared_with_user_id = ?");
        $stmt_check_existing_share->execute([$note_id_to_share, $target_user_id]);
        $existing_share = $stmt_check_existing_share->fetch(PDO::FETCH_ASSOC);

        $action_performed_message = '';

        if ($existing_share) {
            if ($existing_share['permission'] === $permission) {
                $action_performed_message = "Note is already shared with this user with '$permission' permission.";
            } else {
                $stmt_update_permission = $pdo->prepare("UPDATE shared_notes SET permission = ? WHERE id = ?");
                if ($stmt_update_permission->execute([$permission, $existing_share['id']])) {
                    $action_performed_message = "Share permission updated to '$permission' for $recipient_username.";
                } else { throw new PDOException("Failed to update share permission."); }
            }
        } else {
            $stmt_insert_share = $pdo->prepare("INSERT INTO shared_notes (note_id, shared_with_user_id, shared_by_user_id, permission) VALUES (?, ?, ?, ?)");
            if ($stmt_insert_share->execute([$note_id_to_share, $target_user_id, $user_id, $permission])) {
                 $action_performed_message = "Note shared with $recipient_username with '$permission' permission.";
            } else { throw new PDOException("Failed to insert new share record."); }
        }

        // --- Conceptual Email Notification ---
        $sharer_username = $_SESSION['username']; // Current user
        $stmt_admin_settings = $pdo->query("SELECT setting_key, setting_value FROM admin_settings");
        $config_from_db = $stmt_admin_settings->fetchAll(PDO::FETCH_KEY_PAIR);
        $site_name = $config_from_db['site_name'] ?? 'Notepadsly';
        $http_host = $_SERVER['HTTP_HOST'] ?? ($config_from_db['site_url'] ?? 'localhost');
        $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' || ($_SERVER['SERVER_PORT'] ?? 80) == 443) ? "https" : "http";
        $note_link = $protocol . '://' . $http_host . '/dashboard#note=' . $note_id_to_share;

        $email_subject_share = "Note '$note_title' has been shared with you on $site_name";
        $email_body_html_share = "<p>Hello $recipient_username,</p><p>$sharer_username has shared the note '<strong>$note_title</strong>' with you on $site_name (permission: $permission).</p>";
        $email_body_html_share .= "<p>You can view it by clicking this link: <a href=\"$note_link\">$note_link</a></p>";
        $email_body_text_share = strip_tags(str_replace("</p><p>", "\n\n", $email_body_html_share));

        $email_sent_successfully_share = false;
        $email_error_info_share = 'PHPMailer (share) not fully integrated/called (stub).';

        if (empty($config_from_db['smtp_host']) || empty($config_from_db['smtp_port'])) {
            $email_error_info_share = "SMTP host or port not configured. Share notification email not sent.";
            log_error("Share Notification: $email_error_info_share (To: $recipient_email, Note: '$note_title')", __FILE__, __LINE__);
        } else {
            // Conceptual PHPMailer logic would go here, using $config_from_db for settings
            // For now, just log it:
            $share_mail_log = "CONCEPTUAL SHARE EMAIL SENT (PHPMailer stub):\n";
            $share_mail_log .= "To: $recipient_email\n";
            $share_mail_log .= "From: " . ($config_from_db['smtp_from_email'] ?? 'noreply@example.com') . " (" . ($config_from_db['smtp_from_name'] ?? $site_name) . ")\n";
            $share_mail_log .= "Host: " . ($config_from_db['smtp_host']) . "\n";
            $share_mail_log .= "Subject: $email_subject_share\nBody contains note link: $note_link\n";
            log_error($share_mail_log, __FILE__, __LINE__);
            $email_sent_successfully_share = true;
            $email_error_info_share = 'Share notification email prepared and logged.';
        }
        // Append email status to the main action message
        if ($email_sent_successfully_share) $action_performed_message .= " Notification logged.";
        else $action_performed_message .= " Failed to log/initiate notification: " . $email_error_info_share;
        echo json_encode(['success' => true, 'message' => $action_performed_message]);

    } catch (PDOException $e) {
        log_error("PDOException while sharing/updating share for note ID $note_id_to_share: " . $e->getMessage(), __FILE__, __LINE__);
        echo json_encode(['success' => false, 'message' => 'Database error during note sharing/update.']);
    }
    exit;
}


// --- Fetch User Data (Example) ---
// $user_id and $username are already defined at the top if session is valid.

// --- Prepare data for the dashboard (will be expanded significantly) ---
// This block seems redundant if $dashboard_data is not used before getInitialDashboardData
// $dashboard_data = [
//     'username' => $username,
//     'notes' => [],
//     'folders' => [],
//     'tags' => []
// ];

// --- Handle API-like requests for dashboard data (Example) ---
if (isset($_GET['action'])) { // This is the main router for GET actions for the dashboard page
    header('Content-Type: application/json'); // Default for most dashboard GET actions
    // $pdo = getDBConnection(); // Already connected

    if ($_GET['action'] === 'get_user_info') {
        echo json_encode(['username' => $username, 'user_id' => $user_id, 'role' => $_SESSION['user_role']]);
        exit;
    }

    if ($_GET['action'] === 'get_initial_data') {
        try {
            $initial_data = getInitialDashboardData($pdo, $user_id);
            echo json_encode(['success' => true, 'data' => $initial_data, 'username' => $username]);
        } catch (PDOException $e) {
            log_error("Error fetching initial dashboard data: " . $e->getMessage(), __FILE__, __LINE__);
            echo json_encode(['success' => false, 'message' => 'Could not fetch initial data.']);
        }
        exit;
    }

    if ($_GET['action'] === 'get_note_content' && isset($_GET['id'])) {
        $note_id_gc = (int)$_GET['id'];
        try {
            // Check if user owns the note OR it's shared with them (any permission for read)
            $stmt_gc_access = $pdo->prepare("
                SELECT n.id, n.title, n.content, n.folder_id, n.created_at, n.updated_at, n.user_id as owner_user_id,
                       s_owner.username as shared_by_username, sn.permission
                FROM notes n
                LEFT JOIN shared_notes sn ON n.id = sn.note_id AND sn.shared_with_user_id = :current_user_id
                LEFT JOIN users s_owner ON n.user_id = s_owner.id -- To get owner username if shared
                WHERE n.id = :note_id AND (n.user_id = :current_user_id OR sn.shared_with_user_id = :current_user_id_for_share_check)
            ");
            $stmt_gc_access->execute([':note_id' => $note_id_gc, ':current_user_id' => $user_id, ':current_user_id_for_share_check' => $user_id]);
            $note_content_data = $stmt_gc_access->fetch(PDO::FETCH_ASSOC);

            if ($note_content_data) {
                // Determine note status for the current user
                if ($note_content_data['owner_user_id'] == $user_id) {
                    $note_content_data['note_status'] = 'owner';
                } else {
                    $note_content_data['note_status'] = 'shared';
                    // shared_by_username should be correct from the join if it's a shared note
                }

                $stmt_tags_gc = $pdo->prepare("SELECT t.id, t.name FROM tags t JOIN note_tags nt ON t.id = nt.tag_id WHERE nt.note_id = ?");
                $stmt_tags_gc->execute([$note_id_gc]);
                $note_content_data['tags'] = $stmt_tags_gc->fetchAll(PDO::FETCH_ASSOC);
                echo json_encode(['success' => true, 'note' => $note_content_data]);
            } else {
                echo json_encode(['success' => false, 'message' => 'Note not found or access denied.']);
            }
        } catch (PDOException $e) {
            log_error("Error fetching note content (ID: $note_id_gc): " . $e->getMessage(), __FILE__, __LINE__);
            echo json_encode(['success' => false, 'message' => 'Database error fetching note.']);
        }
        exit;
    }

    // Fallback for unknown GET actions on dashboard.php
    echo json_encode(['success' => false, 'message' => 'Unknown dashboard action.']);
    exit;
}


// --- CRUD Actions for Notes (POST requests, typically) ---
// These are now outside the main `if (isset($_GET['action']))` block as they are POST
// This was a structural change from previous versions.

// Update an existing note
if (isset($_POST['action']) && $_POST['action'] === 'update_note' && isset($_POST['note_id'])) { // Changed to check POST for action
    header('Content-Type: application/json');
    $note_id = (int)$_POST['note_id'];
    $title = trim($_POST['title'] ?? 'Untitled Note');
    $content = $_POST['content'] ?? '';
    $folder_id = isset($_POST['folder_id']) && !empty($_POST['folder_id']) ? (int)$_POST['folder_id'] : null;
    if (empty($title)) $title = 'Untitled Note';

    // $pdo = getDBConnection(); // Already connected
    try {
        $stmt_access_check = $pdo->prepare("
            SELECT n.id, n.updated_at as server_updated_at, n.user_id as owner_user_id
            FROM notes n
            LEFT JOIN shared_notes sn ON n.id = sn.note_id AND sn.shared_with_user_id = :current_user_id
            WHERE n.id = :note_id AND (n.user_id = :current_user_id OR sn.permission = 'edit')");
        $stmt_access_check->execute([':note_id' => $note_id, ':current_user_id' => $user_id]);
        $note_access_data = $stmt_access_check->fetch(PDO::FETCH_ASSOC);
        if (!$note_access_data) { echo json_encode(['success' => false, 'message' => 'Access denied or note not found.']); exit; }

        $last_known_server_timestamp_str = $_POST['last_known_server_timestamp'] ?? null;
        if ($last_known_server_timestamp_str) {
            $server_timestamp = strtotime($note_access_data['server_updated_at']);
            $client_known_timestamp = strtotime($last_known_server_timestamp_str);
            if ($server_timestamp > $client_known_timestamp) {
                 echo json_encode(['success' => false, 'conflict' => true, 'message' => 'Note has been updated on the server since you last loaded it.']); exit;
            }
        }

        if ($folder_id !== null) {
            if ($note_access_data['owner_user_id'] != $user_id) {
                $stmt_current_folder = $pdo->prepare("SELECT folder_id FROM notes WHERE id = ?");
                $stmt_current_folder->execute([$note_id]);
                $current_note_folder_id = $stmt_current_folder->fetchColumn();
                if ($current_note_folder_id != $folder_id) {
                     echo json_encode(['success' => false, 'message' => 'Shared editors cannot change the note\'s folder.']); exit;
                }
            } else {
                 $stmt_folder_check = $pdo->prepare("SELECT id FROM folders WHERE id = ? AND user_id = ?");
                 $stmt_folder_check->execute([$folder_id, $user_id]);
                 if (!$stmt_folder_check->fetch()) { echo json_encode(['success' => false, 'message' => 'Invalid folder specified (not owned by you).']); exit; }
            }
        }
        $stmt = $pdo->prepare("UPDATE notes SET title = ?, content = ?, folder_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
        if ($stmt->execute([$title, $content, $folder_id, $note_id])) {
             echo json_encode(['success' => true, 'message' => 'Note updated successfully.']);
        } else { echo json_encode(['success' => false, 'message' => 'Failed to update note.']); }
    } catch (PDOException $e) { log_error("Error updating note (ID: $note_id, folder_id: $folder_id): " . $e->getMessage(), __FILE__, __LINE__); echo json_encode(['success' => false, 'message' => 'Database error updating note.']); }
    exit;
}

// Create a new note
if (isset($_POST['action']) && $_POST['action'] === 'create_note') { // Changed to check POST for action
    header('Content-Type: application/json');
    $title = trim($_POST['title'] ?? 'Untitled Note');
    $content = $_POST['content'] ?? '';
    $folder_id = isset($_POST['folder_id']) && !empty($_POST['folder_id']) ? (int)$_POST['folder_id'] : null;
    if (empty($title)) $title = 'Untitled Note';
    // $pdo = getDBConnection(); // Already connected
    try {
        if ($folder_id !== null) {
            $stmt_folder_check = $pdo->prepare("SELECT id FROM folders WHERE id = ? AND user_id = ?");
            $stmt_folder_check->execute([$folder_id, $user_id]);
            if (!$stmt_folder_check->fetch()) { echo json_encode(['success' => false, 'message' => 'Invalid folder specified.']); exit; }
        }
        $stmt = $pdo->prepare("INSERT INTO notes (user_id, title, content, folder_id) VALUES (?, ?, ?, ?)");
        if ($stmt->execute([$user_id, $title, $content, $folder_id])) {
            echo json_encode(['success' => true, 'message' => 'Note created successfully!', 'note_id' => $pdo->lastInsertId()]);
        } else { echo json_encode(['success' => false, 'message' => 'Failed to create note.']); }
    } catch (PDOException $e) { log_error("Error creating note (folder_id: $folder_id): " . $e->getMessage(), __FILE__, __LINE__); echo json_encode(['success' => false, 'message' => 'Database error creating note.']); }
    exit;
}

// Delete a note
if (isset($_POST['action']) && $_POST['action'] === 'delete_note' && isset($_POST['id'])) { // Changed to check POST for action
    header('Content-Type: application/json');
    $note_id_to_delete = (int)$_POST['id'];
    // $pdo = getDBConnection(); // Already connected
    try {
        // Ensure user owns the note before deleting. Shared users (even with edit) cannot delete.
        $stmt = $pdo->prepare("DELETE FROM notes WHERE id = ? AND user_id = ?");
        if ($stmt->execute([$note_id_to_delete, $user_id])) {
            if ($stmt->rowCount() > 0) {
                // Also delete from shared_notes and note_tags
                $pdo->prepare("DELETE FROM shared_notes WHERE note_id = ?")->execute([$note_id_to_delete]);
                $pdo->prepare("DELETE FROM note_tags WHERE note_id = ?")->execute([$note_id_to_delete]);
                echo json_encode(['success' => true, 'message' => 'Note deleted successfully.']);
            } else { echo json_encode(['success' => false, 'message' => 'Note not found, already deleted, or you do not own this note.']); }
        } else { echo json_encode(['success' => false, 'message' => 'Failed to delete note.']); }
    } catch (PDOException $e) { log_error("Error deleting note (ID: $note_id_to_delete): " . $e->getMessage(), __FILE__, __LINE__); echo json_encode(['success' => false, 'message' => 'Database error deleting note.']); }
    exit;
}


// --- CRUD Actions for Folders (POST requests) ---
// Create a new folder
if (isset($_POST['action']) && $_POST['action'] === 'create_folder') { // Changed to check POST for action
    header('Content-Type: application/json');
    $folder_name = trim($_POST['name'] ?? '');
    if (empty($folder_name)) { echo json_encode(['success' => false, 'message' => 'Folder name cannot be empty.']); exit; }
    if (strlen($folder_name) > 255) { echo json_encode(['success' => false, 'message' => 'Folder name is too long.']); exit; }
    // $pdo = getDBConnection(); // Already connected
    try {
        $stmt_check = $pdo->prepare("SELECT id FROM folders WHERE user_id = ? AND name = ?");
        $stmt_check->execute([$user_id, $folder_name]);
        if ($stmt_check->fetch()) { echo json_encode(['success' => false, 'message' => 'A folder with this name already exists.']); exit; }
        $stmt = $pdo->prepare("INSERT INTO folders (user_id, name) VALUES (?, ?)");
        if ($stmt->execute([$user_id, $folder_name])) {
            echo json_encode(['success' => true, 'message' => 'Folder created successfully.', 'folder_id' => $pdo->lastInsertId(), 'folder_name' => $folder_name]);
        } else { echo json_encode(['success' => false, 'message' => 'Failed to create folder.']); }
    } catch (PDOException $e) { log_error("Error creating folder (name: $folder_name): " . $e->getMessage(), __FILE__, __LINE__); echo json_encode(['success' => false, 'message' => 'Database error creating folder.']); }
    exit;
}

// Update an existing folder (rename)
if (isset($_POST['action']) && $_POST['action'] === 'update_folder' && isset($_POST['folder_id'])) { // Changed to check POST for action
    header('Content-Type: application/json');
    $folder_id_to_update = (int)$_POST['folder_id'];
    $new_folder_name = trim($_POST['name'] ?? '');
    if (empty($new_folder_name)) { echo json_encode(['success' => false, 'message' => 'Folder name cannot be empty.']); exit; }
    if (strlen($new_folder_name) > 255) { echo json_encode(['success' => false, 'message' => 'Folder name is too long.']); exit; }
    // $pdo = getDBConnection(); // Already connected
    try {
        $stmt_check = $pdo->prepare("SELECT id FROM folders WHERE user_id = ? AND name = ? AND id != ?");
        $stmt_check->execute([$user_id, $new_folder_name, $folder_id_to_update]);
        if ($stmt_check->fetch()) { echo json_encode(['success' => false, 'message' => 'Another folder with this name already exists.']); exit; }
        $stmt = $pdo->prepare("UPDATE folders SET name = ? WHERE id = ? AND user_id = ?");
        if ($stmt->execute([$new_folder_name, $folder_id_to_update, $user_id])) {
            if ($stmt->rowCount() > 0) { echo json_encode(['success' => true, 'message' => 'Folder updated successfully.', 'folder_id' => $folder_id_to_update, 'folder_name' => $new_folder_name]); }
            else { echo json_encode(['success' => false, 'message' => 'Folder not found or no changes made.']); }
        } else { echo json_encode(['success' => false, 'message' => 'Failed to update folder.']); }
    } catch (PDOException $e) { log_error("Error updating folder (ID: $folder_id_to_update, new_name: $new_folder_name): " . $e->getMessage(), __FILE__, __LINE__); echo json_encode(['success' => false, 'message' => 'Database error updating folder.']); }
    exit;
}

// Delete a folder
if (isset($_POST['action']) && $_POST['action'] === 'delete_folder' && isset($_POST['folder_id'])) { // Changed to check POST for action
    header('Content-Type: application/json');
    $folder_id_to_delete = (int)$_POST['folder_id'];
    // $pdo = getDBConnection(); // Already connected
    try {
        $pdo->beginTransaction();
        $stmt_update_notes = $pdo->prepare("UPDATE notes SET folder_id = NULL WHERE folder_id = ? AND user_id = ?");
        $stmt_update_notes->execute([$folder_id_to_delete, $user_id]);
        $stmt_delete_folder = $pdo->prepare("DELETE FROM folders WHERE id = ? AND user_id = ?");
        $stmt_delete_folder->execute([$folder_id_to_delete, $user_id]);
        if ($stmt_delete_folder->rowCount() > 0) {
            $pdo->commit();
            echo json_encode(['success' => true, 'message' => 'Folder deleted successfully. Notes within have been moved to All Notes.']);
        } else { $pdo->rollBack(); echo json_encode(['success' => false, 'message' => 'Folder not found or already deleted.']); }
    } catch (PDOException $e) { $pdo->rollBack(); log_error("Error deleting folder (ID: $folder_id_to_delete): " . $e->getMessage(), __FILE__, __LINE__); echo json_encode(['success' => false, 'message' => 'Database error deleting folder.']); }
    exit;
}


// --- getInitialDashboardData function (used by GET ?action=get_initial_data) ---
function getInitialDashboardData($pdo, $user_id) {
    // ... (implementation remains the same, fetching owned and shared notes, folders, tags)
    $data = [];
    $stmt_owned_notes = $pdo->prepare("SELECT id, title, LEFT(content, 100) as snippet, updated_at, folder_id, user_id as owner_user_id, NULL as shared_by_username, 'owner' as note_status, 'edit' as permission FROM notes WHERE user_id = ?");
    $stmt_owned_notes->execute([$user_id]);
    $owned_notes = $stmt_owned_notes->fetchAll(PDO::FETCH_ASSOC);
    $stmt_shared_notes = $pdo->prepare("SELECT n.id, n.title, LEFT(n.content, 100) as snippet, n.updated_at, n.folder_id, n.user_id as owner_user_id, u_owner.username as shared_by_username, 'shared' as note_status, sn.permission FROM notes n JOIN shared_notes sn ON n.id = sn.note_id JOIN users u_owner ON n.user_id = u_owner.id WHERE sn.shared_with_user_id = ?");
    $stmt_shared_notes->execute([$user_id]);
    $shared_notes_with_user = $stmt_shared_notes->fetchAll(PDO::FETCH_ASSOC);
    $all_display_notes = array_merge($owned_notes, $shared_notes_with_user);
    usort($all_display_notes, function($a, $b) { return strtotime($b['updated_at']) - strtotime($a['updated_at']); });
    $note_ids = array_column($all_display_notes, 'id');
    $note_tags_map = [];
    if (!empty($note_ids)) {
        $placeholders = implode(',', array_fill(0, count($note_ids), '?'));
        $stmt_note_tags = $pdo->prepare("SELECT nt.note_id, t.id as tag_id, t.name as tag_name FROM note_tags nt JOIN tags t ON nt.tag_id = t.id WHERE nt.note_id IN ($placeholders)");
        $stmt_note_tags->execute($note_ids);
        while ($row = $stmt_note_tags->fetch(PDO::FETCH_ASSOC)) { $note_tags_map[$row['note_id']][] = ['id' => $row['tag_id'], 'name' => $row['tag_name']]; }
    }
    foreach ($all_display_notes as &$note_ref) { $note_ref['tags'] = $note_tags_map[$note_ref['id']] ?? []; } unset($note_ref);
    $data['notes'] = $all_display_notes;
    $stmt_folders = $pdo->prepare("SELECT id, name FROM folders WHERE user_id = ? ORDER BY name ASC");
    $stmt_folders->execute([$user_id]);
    $data['folders'] = $stmt_folders->fetchAll(PDO::FETCH_ASSOC);
    $stmt_all_user_tags = $pdo->prepare("SELECT t.id, t.name, COUNT(n.id) as note_count FROM tags t JOIN note_tags nt ON t.id = nt.tag_id JOIN notes n ON nt.note_id = n.id WHERE n.user_id = ? GROUP BY t.id, t.name ORDER BY t.name ASC");
    $stmt_all_user_tags->execute([$user_id]);
    $data['tags'] = $stmt_all_user_tags->fetchAll(PDO::FETCH_ASSOC);
    return $data;
}

// If no specific POST action matched, and it's not a known GET action from above,
// it implies the main dashboard page is being loaded (though typically this script is for AJAX).
// For robustness, ensure no direct output if not an API call.
// The primary GET actions for dashboard.php are now handled inside the `if (isset($_GET['action']))` block.
// Any other direct access to dashboard.php without a valid action should ideally not output anything
// or redirect to the main app page if appropriate.
// Since all known actions `exit`, this part might not be reached for valid API calls.

?>
