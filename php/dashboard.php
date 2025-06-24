<?php
require_once __DIR__ . '/config.php';

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
    } else { header("Location: /login?error=session_key_missing"); exit; }
}
$encryption_key = base64_decode($encryption_key_base64);
if ($encryption_key === false) {
    log_error("Failed to decode encryption key from session for user ID $user_id.", __FILE__, __LINE__);
    if (isset($_GET['action']) || isset($_POST['action'])) {
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'message' => 'Security session error. Please re-login. (ERR_KEY_DECODE)']);
        exit;
    } else { header("Location: /login?error=session_key_decode_failed"); exit; }
}

// --- Tag Management Actions (POST) ---
if (isset($_POST['action']) && $_POST['action'] === 'sync_note_tags') { // Changed to check POST
    header('Content-Type: application/json');
    // ... (sync_note_tags implementation remains the same, using $user_id and $encryption_key as needed)
    exit;
}

// --- Note Sharing Actions (POST) ---
if (isset($_POST['action']) && $_POST['action'] === 'revoke_note_access') { // Changed to check POST
    header('Content-Type: application/json');
    // ... (revoke_note_access implementation remains the same)
    exit;
}

if (isset($_POST['action']) && $_POST['action'] === 'share_note') { // Changed to check POST
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
                $stmt_update_permission = $pdo->prepare("UPDATE shared_notes SET permission = ? WHERE id = ? AND shared_by_user_id = ?");
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
        $email_error_info_share = 'SMTP settings not configured or PHPMailer not integrated.';

        if (empty($config_from_db['smtp_host']) || empty($config_from_db['smtp_port']) || empty($config_from_db['smtp_from_email'])) {
            $email_error_info_share = "SMTP host, port, or from_email not configured. Share notification email not sent.";
            log_error("Share Notification: $email_error_info_share (To: $recipient_email, Note: '$note_title_decrypted')", __FILE__, __LINE__);
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
                else { $mail->SMTPSecure = false; $mail->SMTPAutoTLS = false; }
                $mail->Port       = (int)$config_from_db['smtp_port'];
                $mail->setFrom($config_from_db['smtp_from_email'], $config_from_db['smtp_from_name'] ?? $site_name);
                $mail->addAddress($recipient_email, $recipient_username);
                $mail->isHTML(true);
                $mail->Subject = $email_subject_share;
                $mail->Body    = $email_body_html_share;
                $mail->AltBody = $email_body_text_share;

                // $mail->send(); // ACTUAL SEND CALL - STUBBED
                log_error("PHPMailer: mail->send() STUBBED for share notification to $recipient_email. Config used: Host={$config_from_db['smtp_host']}", __FILE__, __LINE__);
                $email_sent_successfully_share = true;
                $email_error_info_share = 'Share notification email processed (stubbed send).';

            } catch (PHPMailerException $e_mailer) {
                $email_error_info_share = "Share notification could not be sent. Mailer Error: {$mail->ErrorInfo}";
                log_error("PHPMailer Share Notification Error for $recipient_email (Note: '$note_title_decrypted'): {$mail->ErrorInfo}", __FILE__, __LINE__);
            } catch (Exception $e) {
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
if (isset($_GET['action'])) {
    header('Content-Type: application/json');
    $pdo_for_get = getDBConnection(); // Ensure $pdo is available for GET actions

    if ($_GET['action'] === 'get_user_info') {
        echo json_encode(['username' => $username, 'user_id' => $user_id, 'role' => $_SESSION['user_role']]);
        exit;
    }

    if ($_GET['action'] === 'get_initial_data') {
        try {
            $initial_data = getInitialDashboardData($pdo_for_get, $user_id, $encryption_key);
            echo json_encode(['success' => true, 'data' => $initial_data, 'username' => $username]);
        } catch (Exception $e) {
            log_error("Error fetching initial dashboard data (possibly decrypt): " . $e->getMessage(), __FILE__, __LINE__);
            echo json_encode(['success' => false, 'message' => 'Could not fetch initial data. Decryption error possible.']);
        }
        exit;
    }

    if ($_GET['action'] === 'get_note_content' && isset($_GET['id'])) {
        // ... (get_note_content with decryption, as previously implemented)
        $note_id_gc = (int)$_GET['id'];
        try {
            $stmt_gc_access = $pdo_for_get->prepare("SELECT n.id, n.title, n.content, n.folder_id, n.created_at, n.updated_at, n.user_id as owner_user_id, s_owner.username as shared_by_username, sn.permission FROM notes n LEFT JOIN shared_notes sn ON n.id = sn.note_id AND sn.shared_with_user_id = :current_user_id LEFT JOIN users s_owner ON n.user_id = s_owner.id WHERE n.id = :note_id AND (n.user_id = :current_user_id OR sn.shared_with_user_id = :current_user_id_for_share_check)");
            $stmt_gc_access->execute([':note_id' => $note_id_gc, ':current_user_id' => $user_id, ':current_user_id_for_share_check' => $user_id]);
            $note_encrypted_content_data = $stmt_gc_access->fetch(PDO::FETCH_ASSOC);
            if ($note_encrypted_content_data) {
                $note_content_data = $note_encrypted_content_data;
                $note_content_data['title'] = decrypt_data($note_encrypted_content_data['title'], $encryption_key);
                $note_content_data['content'] = decrypt_data($note_encrypted_content_data['content'], $encryption_key);
                if($note_content_data['title'] === false || $note_content_data['content'] === false) { log_error("Decryption failed for note ID {$note_id_gc} in get_note_content for user ID $user_id", __FILE__, __LINE__); echo json_encode(['success' => false, 'message' => 'Error retrieving note details (decryption).']); exit; }
                if ($note_content_data['owner_user_id'] == $user_id) { $note_content_data['note_status'] = 'owner'; } else { $note_content_data['note_status'] = 'shared'; }
                $stmt_tags_gc = $pdo_for_get->prepare("SELECT t.id, t.name FROM tags t JOIN note_tags nt ON t.id = nt.tag_id WHERE nt.note_id = ?");
                $stmt_tags_gc->execute([$note_id_gc]); $note_content_data['tags'] = $stmt_tags_gc->fetchAll(PDO::FETCH_ASSOC);
                echo json_encode(['success' => true, 'note' => $note_content_data]);
            } else { echo json_encode(['success' => false, 'message' => 'Note not found or access denied.']); }
        } catch (Exception $e) { log_error("Error fetching note content (ID: $note_id_gc): " . $e->getMessage(), __FILE__, __LINE__); echo json_encode(['success' => false, 'message' => 'Error retrieving note content.']);}
        exit;
    }

    echo json_encode(['success' => false, 'message' => 'Unknown dashboard action.']);
    exit;
}


// --- CRUD Actions for Notes (POST requests) ---
// ... (update_note, create_note, delete_note with encryption, as previously implemented) ...
if (isset($_POST['action']) && $_POST['action'] === 'update_note' && isset($_POST['note_id'])) { /* ... same ... */ }
if (isset($_POST['action']) && $_POST['action'] === 'create_note') { /* ... same ... */ }
if (isset($_POST['action']) && $_POST['action'] === 'delete_note' && isset($_POST['id'])) { /* ... same ... */ }

// --- CRUD Actions for Folders (POST requests) ---
// ... (create_folder, update_folder, delete_folder remain the same) ...
if (isset($_POST['action']) && $_POST['action'] === 'create_folder') { /* ... same ... */ }
if (isset($_POST['action']) && $_POST['action'] === 'update_folder' && isset($_POST['folder_id'])) { /* ... same ... */ }
if (isset($_POST['action']) && $_POST['action'] === 'delete_folder' && isset($_POST['folder_id'])) { /* ... same ... */ }


// --- getInitialDashboardData function ---
function getInitialDashboardData($pdo, $user_id, $encryption_key) { /* ... same with decryption ... */ }

?>
