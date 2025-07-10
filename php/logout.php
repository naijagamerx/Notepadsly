<?php
require_once 'config.php'; // Ensures session_start() is called

// Unset all of the session variables.
$_SESSION = array();

// If it's desired to kill the session, also delete the session cookie.
// Note: This will destroy the session, and not just the session data!
if (ini_get("session.use_cookies")) {
    $params = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000,
        $params["path"], $params["domain"],
        $params["secure"], $params["httponly"]
    );
}

// Finally, destroy the session.
session_destroy();

// Redirect to login page or home page
// The prompt doesn't specify a landing page after logout, index.html (login page) seems appropriate.
header("Location: " . BASE_URL . "login"); // Use BASE_URL
exit;
?>
