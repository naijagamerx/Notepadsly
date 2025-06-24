<?php
require_once __DIR__ . '/config.php'; // Adjusted path for config

// --- PHPMailer ---
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception as PHPMailerException;

require_once __DIR__ . '/../lib/PHPMailer/src/Exception.php';
require_once __DIR__ . '/../lib/PHPMailer/src/PHPMailer.php';
require_once __DIR__ . '/../lib/PHPMailer/src/SMTP.php';


if (!isset($_SESSION['user_id'])) {
    header("Location: /login");
    exit;
}
$user_id = $_SESSION['user_id'];
$username = $_SESSION['username'];

$encryption_key_base64 = $_SESSION['encryption_key'] ?? null;
if (!$encryption_key_base64) {
    log_error("Encryption key missing in session for user ID $user_id.", __FILE__, __LINE__);
    if (isset($_GET['action']) || isset($_POST['action'])) {
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'message' => 'Security session error. Please re-login. (ERR_NO_KEY_SESS)']);
        exit;
    } else {
        header("Location: /login?error=session_key_missing");
        exit;
    }
}
$encryption_key = base64_decode($encryption_key_base64);
if ($encryption_key === false) {
    log_error("Failed to decode encryption key from session for user ID $user_id.", __FILE__, __LINE__);
    if (isset($_GET['action']) || isset($_POST['action'])) {
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'message' => 'Security session error. Please re-login. (ERR_KEY_DECODE)']);
        exit;
    } else {
        header("Location: /login?error=session_key_decode_failed");
        exit;
    }
}


// --- Tag Management Actions ---
if (isset($_GET['action']) && $_GET['action'] === 'sync_note_tags' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    // ... (sync_note_tags implementation remains the same)
    header('Content-Type: application/json');
    $note_id = (int)($_POST['note_id'] ?? 0); $tag_names_json = $_POST['tags'] ?? '[]'; $tag_names = json_decode($tag_names_json, true);
    if ($note_id <= 0) { echo json_encode(['success' => false, 'message' => 'Invalid note ID.']); exit; }
    if (json_last_error() !== JSON_ERROR_NONE || !is_array($tag_names)) { echo json_encode(['success' => false, 'message' => 'Invalid tags format.']); exit; }
    $pdo = getDBConnection();
    $stmt_access_check = $pdo->prepare("SELECT n.id FROM notes n LEFT JOIN shared_notes sn ON n.id = sn.note_id AND sn.shared_with_user_id = :current_user_id WHERE n.id = :note_id AND (n.user_id = :current_user_id OR sn.permission = 'edit')");
    $stmt_access_check->execute([':note_id' => $note_id, ':current_user_id' => $user_id]);
    if (!$stmt_access_check->fetch()) { echo json_encode(['success' => false, 'message' => 'Access denied to modify tags or note not found.']); exit; }
    try {
        $pdo->beginTransaction(); $final_tag_ids = [];
        if (!empty($tag_names)) { foreach ($tag_names as $name) { $name = trim(strtolower($name)); if (empty($name) || strlen($name) > 50) continue; $stmt_find_tag = $pdo->prepare("SELECT id FROM tags WHERE name = ?"); $stmt_find_tag->execute([$name]); $tag = $stmt_find_tag->fetch(); if ($tag) { $final_tag_ids[] = $tag['id']; } else { $stmt_create_tag = $pdo->prepare("INSERT INTO tags (name) VALUES (?)"); $stmt_create_tag->execute([$name]); $final_tag_ids[] = $pdo->lastInsertId(); } } }
        $final_tag_ids = array_unique($final_tag_ids); $stmt_current_tags = $pdo->prepare("SELECT tag_id FROM note_tags WHERE note_id = ?"); $stmt_current_tags->execute([$note_id]); $current_tag_ids = $stmt_current_tags->fetchAll(PDO::FETCH_COLUMN);
        $tags_to_add = array_diff($final_tag_ids, $current_tag_ids); $tags_to_remove = array_diff($current_tag_ids, $final_tag_ids);
        if (!empty($tags_to_add)) { $stmt_add_tag = $pdo->prepare("INSERT INTO note_tags (note_id, tag_id) VALUES (?, ?)"); foreach ($tags_to_add as $tag_id_to_add) { $stmt_add_tag->execute([$note_id, $tag_id_to_add]); } }
        if (!empty($tags_to_remove)) { $placeholders_remove = implode(',', array_fill(0, count($tags_to_remove), '?')); $stmt_remove_tag = $pdo->prepare("DELETE FROM note_tags WHERE note_id = ? AND tag_id IN ($placeholders_remove)"); $params_remove = array_merge([$note_id], $tags_to_remove); $stmt_remove_tag->execute($params_remove); }
        $pdo->commit(); $stmt_updated_note_tags = $pdo->prepare("SELECT t.id, t.name FROM tags t JOIN note_tags nt ON t.id = nt.tag_id WHERE nt.note_id = ? ORDER BY t.name ASC"); $stmt_updated_note_tags->execute([$note_id]);
        $updated_tags_for_note = $stmt_updated_note_tags->fetchAll(PDO::FETCH_ASSOC); echo json_encode(['success' => true, 'message' => 'Tags updated successfully.', 'tags' => $updated_tags_for_note]);
    } catch (PDOException $e) { $pdo->rollBack(); log_error("Error syncing tags for note ID $note_id: " . $e->getMessage(), __FILE__, __LINE__); echo json_encode(['success' => false, 'message' => 'Database error syncing tags.']); }
    exit;
}

// --- Download Note Action ---
if (isset($_GET['action']) && $_GET['action'] === 'download_note' && isset($_GET['id'])) {
    // ... (download_note implementation with decryption remains the same) ...
    $note_id_to_download = (int)$_GET['id'];
    if ($note_id_to_download <= 0) { header("HTTP/1.1 400 Bad Request"); echo "Invalid Note ID."; exit; }
    $pdo = getDBConnection();
    try {
        $stmt_check_access = $pdo->prepare("SELECT n.title, n.content FROM notes n LEFT JOIN shared_notes sn ON n.id = sn.note_id WHERE n.id = ? AND (n.user_id = ? OR sn.shared_with_user_id = ?) LIMIT 1");
        $stmt_check_access->execute([$note_id_to_download, $user_id, $user_id]); $note_encrypted = $stmt_check_access->fetch(PDO::FETCH_ASSOC);
        if ($note_encrypted) {
            $decrypted_title = decrypt_data($note_encrypted['title'], $encryption_key); $decrypted_content = decrypt_data($note_encrypted['content'], $encryption_key);
            if ($decrypted_title === false || $decrypted_content === false) { log_error("Failed to decrypt note for download. Note ID: $note_id_to_download, User ID: $user_id", __FILE__, __LINE__); header("HTTP/1.1 500 Internal Server Error"); echo "Error preparing note for download (decryption failed)."; exit; }
            $filename_title = preg_replace('/[^a-z0-9_\-\s\.]/i', '', $decrypted_title); $filename_title = preg_replace('/\s+/', '_', $filename_title); if (empty($filename_title)) { $filename_title = 'note'; } $filename = $filename_title . ".txt";
            header('Content-Type: text/plain; charset=utf-8'); header('Content-Disposition: attachment; filename="' . $filename . '"'); header('Pragma: no-cache'); header('Expires: 0'); echo $decrypted_content;
        } else { header("HTTP/1.1 404 Not Found"); log_error("Attempt to download note ID $note_id_to_download failed (not found or no access for user ID $user_id).", __FILE__, __LINE__); header("Location: /dashboard?error=download_failed"); }
    } catch (PDOException $e) { log_error("PDOException while downloading note ID $note_id_to_download: " . $e->getMessage(), __FILE__, __LINE__); header("HTTP/1.1 500 Internal Server Error"); header("Location: /dashboard?error=download_error"); }
    exit;
}


// --- Note Sharing Actions ---
if (isset($_GET['action']) && $_GET['action'] === 'get_shared_with_users' && isset($_GET['note_id'])) { /* ... same ... */ }
if (isset($_GET['action']) && $_GET['action'] === 'revoke_note_access' && $_SERVER['REQUEST_METHOD'] === 'POST') { /* ... same ... */ }

if (isset($_GET['action']) && $_GET['action'] === 'share_note' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    header('Content-Type: application/json');
    $note_id_to_share = (int)($_POST['note_id'] ?? 0);
    $share_with_identifier = trim($_POST['share_with_user'] ?? '');
    $permission = trim($_POST['permission'] ?? 'read');
    if (!in_array($permission, ['read', 'edit'])) { $permission = 'read'; }
    if ($note_id_to_share <= 0 || empty($share_with_identifier)) { echo json_encode(['success' => false, 'message' => 'Note ID and target user are required.']); exit; }

    $pdo = getDBConnection();
    try {
        $stmt_note_owner = $pdo->prepare("SELECT title, user_id AS owner_user_id FROM notes WHERE id = ?");
        $stmt_note_owner->execute([$note_id_to_share]);
        $note_details_encrypted = $stmt_note_owner->fetch(PDO::FETCH_ASSOC);

        if (!$note_details_encrypted || $note_details_encrypted['owner_user_id'] != $user_id) {
            echo json_encode(['success' => false, 'message' => 'Note not found or you do not own this note.']); exit;
        }
        $note_title_decrypted = decrypt_data($note_details_encrypted['title'], $encryption_key);
        if ($note_title_decrypted === false) {
             log_error("Failed to decrypt note title for sharing. Note ID: $note_id_to_share", __FILE__, __LINE__);
             echo json_encode(['success' => false, 'message' => 'Error preparing note for sharing.']); exit;
        }

        $stmt_target_user = $pdo->prepare("SELECT id, email, username FROM users WHERE username = ? OR email = ?");
        $stmt_target_user->execute([$share_with_identifier, $share_with_identifier]);
        $target_user = $stmt_target_user->fetch(PDO::FETCH_ASSOC);
        if (!$target_user) { echo json_encode(['success' => false, 'message' => 'Target user not found.']); exit; }
        $target_user_id = $target_user['id']; $recipient_email = $target_user['email']; $recipient_username = $target_user['username'];
        if ($target_user_id === $user_id) { echo json_encode(['success' => false, 'message' => 'You cannot share a note with yourself.']); exit; }

        $stmt_check_existing_share = $pdo->prepare("SELECT id, permission FROM shared_notes WHERE note_id = ? AND shared_with_user_id = ?");
        $stmt_check_existing_share->execute([$note_id_to_share, $target_user_id]);
        $existing_share = $stmt_check_existing_share->fetch(PDO::FETCH_ASSOC);
        $action_performed_message = '';

        if ($existing_share) {
            if ($existing_share['permission'] === $permission) {
                $action_performed_message = "Note is already shared with $recipient_username with '$permission' permission.";
            } else {
                $stmt_update_permission = $pdo->prepare("UPDATE shared_notes SET permission = ? WHERE id = ? AND shared_by_user_id = ?"); // Ensure owner is updating
                if ($stmt_update_permission->execute([$permission, $existing_share['id'], $user_id])) {
                    $action_performed_message = "Share permission updated to '$permission' for $recipient_username.";
                } else { throw new PDOException("Failed to update share permission."); }
            }
        } else {
            $stmt_insert_share = $pdo->prepare("INSERT INTO shared_notes (note_id, shared_with_user_id, shared_by_user_id, permission) VALUES (?, ?, ?, ?)");
            if ($stmt_insert_share->execute([$note_id_to_share, $target_user_id, $user_id, $permission])) {
                 $action_performed_message = "Note shared with $recipient_username with '$permission' permission.";
            } else { throw new PDOException("Failed to insert new share record."); }
        }

        // --- Actual Email Notification using PHPMailer (Conceptual Send) ---
        $sharer_username = $_SESSION['username'];
        $stmt_admin_settings = $pdo->query("SELECT setting_key, setting_value FROM admin_settings");
        $config_from_db = $stmt_admin_settings->fetchAll(PDO::FETCH_KEY_PAIR);
        $site_name = $config_from_db['site_name'] ?? 'Notepadsly';
        $http_host = $_SERVER['HTTP_HOST'] ?? ($config_from_db['site_url'] ?? 'localhost');
        $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' || ($_SERVER['SERVER_PORT'] ?? 80) == 443) ? "https" : "http";
        $note_link = $protocol . '://' . $http_host . '/dashboard#note=' . $note_id_to_share;

        $email_subject_share = "Note '$note_title_decrypted' has been shared with you on $site_name";
        $email_body_html_share = "<p>Hello $recipient_username,</p><p>$sharer_username has shared the note '<strong>$note_title_decrypted</strong>' with you on $site_name (permission: $permission).</p>";
        $email_body_html_share .= "<p>You can view it by clicking this link: <a href=\"$note_link\">$note_link</a></p>";
        $email_body_text_share = strip_tags(str_replace("</p><p>", "\n\n", $email_body_html_share));

        $email_sent_successfully_share = false;
        $email_error_info_share = 'SMTP settings not configured or PHPMailer not fully integrated.';

        if (empty($config_from_db['smtp_host']) || empty($config_from_db['smtp_port']) || empty($config_from_db['smtp_from_email'])) {
            $email_error_info_share = "SMTP host, port, or from_email not configured. Share notification email not sent.";
            log_error("Share Notification: $email_error_info_share (To: $recipient_email, Note: '$note_title_decrypted')", __FILE__, __LINE__);
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
                } else {
                    $mail->SMTPAuth = false;
                }
                // Assuming smtp_encryption is a new admin setting: 'tls', 'ssl', or empty for none
                $smtp_encryption = strtolower($config_from_db['smtp_encryption'] ?? 'tls');
                if ($smtp_encryption === 'ssl') {
                    $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
                } else if ($smtp_encryption === 'tls') {
                    $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
                } else {
                    $mail->SMTPSecure = false; // Or PHPMailer::ENCRYPTION_OFF if your PHPMailer version supports it
                    $mail->SMTPAutoTLS = false; // Important if no encryption but server might try
                }
                $mail->Port       = (int)$config_from_db['smtp_port'];

                $mail->setFrom($config_from_db['smtp_from_email'], $config_from_db['smtp_from_name'] ?? $site_name);
                $mail->addAddress($recipient_email, $recipient_username);
                $mail->isHTML(true);
                $mail->Subject = $email_subject_share;
                $mail->Body    = $email_body_html_share;
                $mail->AltBody = $email_body_text_share;

                // $mail->send(); // THIS IS THE ACTUAL SEND CALL - KEEP STUBBED FOR NOW
                $email_sent_successfully_share = true; // Assume success for stub
                $email_error_info_share = 'Share notification email processed (stubbed send).';
                log_error("Share Notification: Email conceptually sent to $recipient_email for note '$note_title_decrypted'. SMTP: {$config_from_db['smtp_host']}", __FILE__, __LINE__);

            } catch (PHPMailerException $e_mailer) {
                $email_error_info_share = "Share notification could not be sent. Mailer Error: {$mail->ErrorInfo}";
                log_error("PHPMailer Share Notification Error for $recipient_email (Note: '$note_title_decrypted'): {$mail->ErrorInfo}", __FILE__, __LINE__);
            } catch (Exception $e) { // Other general exceptions
                 $email_error_info_share = "General error preparing share notification: " . $e->getMessage();
                 log_error("General Exception - Share Notification for $recipient_email: " . $e->getMessage(), __FILE__, __LINE__);
            }
        }
        if ($email_sent_successfully_share) $action_performed_message .= " Notification processed.";
        else $action_performed_message .= " Notification failed: " . $email_error_info_share;
        echo json_encode(['success' => true, 'message' => $action_performed_message]);

    } catch (PDOException $e) {
        log_error("PDOException while sharing/updating share for note ID $note_id_to_share: " . $e->getMessage(), __FILE__, __LINE__);
        echo json_encode(['success' => false, 'message' => 'Database error during note sharing/update.']);
    }
    exit;
}


// --- Dashboard Data Retrieval (GET actions) ---
// ... (get_user_info, get_initial_data, get_note_content remain the same) ...

// --- CRUD Actions for Notes (POST requests) ---
// ... (update_note, create_note, delete_note remain the same, with encryption) ...

// --- CRUD Actions for Folders (POST requests) ---
// ... (create_folder, update_folder, delete_folder remain the same) ...

// --- getInitialDashboardData function (used by GET ?action=get_initial_data) ---
// ... (remains the same, with decryption)

?>
