<?php
require_once 'config.php'; // Includes session_start()

header('Content-Type: application/json');
$response = ['success' => false, 'message' => '', 'errors' => []];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = trim($_POST['username'] ?? '');
    $password = $_POST['password'] ?? '';

    // --- Basic Validation ---
    if (empty($username)) {
        $response['errors']['username'] = 'Username is required.';
    }
    if (empty($password)) {
        $response['errors']['password'] = 'Password is required.';
    }

    if (!empty($response['errors'])) {
        $response['message'] = 'Please fill in all fields.';
        echo json_encode($response);
        exit;
    }

    // --- Authenticate User ---
    try {
        $pdo = getDBConnection();
        $stmt = $pdo->prepare("SELECT id, username, password, role, email FROM users WHERE username = ? OR email = ?");
        $stmt->execute([$username, $username]); // Allow login with username or email
        $user = $stmt->fetch();

        if ($user) {
            // Verify password
            if (password_verify($password, $user['password'])) {
                // Password is correct, set up session
                $_SESSION['user_id'] = $user['id'];
                $_SESSION['username'] = $user['username'];
                // Password is correct, check for 2FA
                if ($user['twofa_enabled'] == 1 && !empty($user['twofa_secret'])) {
                    // 2FA is enabled, require OTP
                    $_SESSION['2fa_user_id'] = $user['id']; // Store user ID for OTP verification step
                    $_SESSION['2fa_pending'] = true;
                    // session_regenerate_id(true); // Regenerate session ID here too for security before OTP step

                    $response['success'] = true; // Password was correct
                    $response['twofa_required'] = true;
                    $response['message'] = 'Password correct. Please enter your Two-Factor Authentication code.';
                    // No redirect_url here, frontend will show OTP input
                } else {
                    // 2FA not enabled or no secret, proceed with normal login
                    $_SESSION['user_id'] = $user['id'];
                    $_SESSION['username'] = $user['username'];
                    $_SESSION['user_role'] = $user['role'];
                    $_SESSION['user_email'] = $user['email'];
                    session_regenerate_id(true);

                    $response['success'] = true;
                    $response['message'] = 'Login successful! Redirecting...';
                    $response['redirect_url'] = '/dashboard';
                }
            } else {
                // Invalid password
                $response['message'] = 'Invalid username or password.';
                // $response['errors']['password'] = 'Invalid credentials.'; // More generic error for security
            }
        } else {
            // User not found
            $response['message'] = 'Invalid username or password.';
            // $response['errors']['username'] = 'Invalid credentials.';
        }

    } catch (PDOException $e) {
        $response['message'] = 'Database error during login. Please try again later.';
        log_error('PDOException in login.php: ' . $e->getMessage(), __FILE__, __LINE__);
        if (DEVELOPMENT_MODE) {
            $response['debug_error'] = $e->getMessage();
        }
    } catch (Exception $e) {
        $response['message'] = 'An unexpected error occurred. Please try again later.';
        log_error('Exception in login.php: ' . $e->getMessage(), __FILE__, __LINE__);
        if (DEVELOPMENT_MODE) {
            $response['debug_error'] = $e->getMessage();
        }
    }

    echo json_encode($response);

} else {
    // Not a POST request
    $response['message'] = 'Invalid request method.';
    echo json_encode($response);
}
?>
