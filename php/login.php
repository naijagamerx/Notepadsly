<?php
require_once 'config.php'; // Includes session_start()

header('Content-Type: application/json');
$response = ['success' => false, 'message' => '', 'errors' => []];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username_input = trim($_POST['username'] ?? ''); // Renamed to avoid conflict with $user['username']
    $password_input = $_POST['password'] ?? ''; // Renamed

    // --- Basic Validation ---
    if (empty($username_input)) {
        $response['errors']['username'] = 'Username or Email is required.';
    }
    if (empty($password_input)) {
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
        // Fetch encryption_salt, 2fa status along with other user details
        $stmt = $pdo->prepare("SELECT id, username, password, role, email, twofa_enabled, twofa_secret, encryption_salt FROM users WHERE username = ? OR email = ?");
        $stmt->execute([$username_input, $username_input]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($user) {
            if (password_verify($password_input, $user['password'])) {
                // Password is correct. Derive encryption key.
                if (empty($user['encryption_salt'])) {
                    log_error("Login attempt for user ID {$user['id']} ('{$user['username']}') without encryption salt.", __FILE__, __LINE__);
                    $response['message'] = 'Login failed: Account configuration error (ERR_NO_SALT). Please contact support.';
                    echo json_encode($response);
                    exit;
                }

                $encryption_key = derive_encryption_key($password_input, $user['encryption_salt']);
                if ($encryption_key === false) {
                    log_error("Failed to derive encryption key for user ID {$user['id']} ('{$user['username']}').", __FILE__, __LINE__);
                    $response['message'] = 'Login failed: Could not prepare for secure session (ERR_KEY_DERIV).';
                    echo json_encode($response);
                    exit;
                }
                $_SESSION['encryption_key'] = base64_encode($encryption_key); // Store base64 encoded key

                // Check for 2FA
                if ($user['twofa_enabled'] == 1 && !empty($user['twofa_secret'])) {
                    $_SESSION['2fa_user_id'] = $user['id'];
                    $_SESSION['2fa_pending'] = true;
                    // Store other necessary user details TEMPORARILY for verify_2fa.php to use after OTP
                    $_SESSION['temp_user_data'] = [
                        'id' => $user['id'],
                        'username' => $user['username'],
                        'role' => $user['role'],
                        'email' => $user['email']
                        // DO NOT store encryption_key or password here for the second step.
                        // The encryption_key is already in session.
                    ];
                    // session_regenerate_id(true); // Regenerate before OTP step

                    $response['success'] = true;
                    $response['twofa_required'] = true;
                    $response['message'] = 'Password correct. Please enter your Two-Factor Authentication code.';
                } else {
                    // No 2FA, complete login
                    $_SESSION['user_id'] = $user['id'];
                    $_SESSION['username'] = $user['username'];
                    $_SESSION['user_role'] = $user['role'];
                    $_SESSION['user_email'] = $user['email'];
                    // $_SESSION['encryption_key'] is already set
                    session_regenerate_id(true);
                    $response['success'] = true;
                    $response['message'] = 'Login successful! Redirecting...';
                    $response['redirect_url'] = BASE_URL . 'dashboard'; // Use BASE_URL
                }
            } else {
                $response['message'] = 'Invalid username or password.';
            }
        } else {
            // User not found
            $response['message'] = 'Invalid username or password.';
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
