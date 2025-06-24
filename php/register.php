<?php
require_once 'config.php';

header('Content-Type: application/json'); // We'll respond with JSON

$response = ['success' => false, 'message' => '', 'errors' => []];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = trim($_POST['username'] ?? '');
    $email = trim($_POST['email'] ?? '');
    $password = $_POST['password'] ?? '';
    $confirm_password = $_POST['confirm_password'] ?? '';

    // --- Validation ---
    if (empty($username)) {
        $response['errors']['username'] = 'Username is required.';
    } elseif (strlen($username) < 3 || strlen($username) > 50) {
        $response['errors']['username'] = 'Username must be between 3 and 50 characters.';
    } elseif (!preg_match('/^[a-zA-Z0-9_]+$/', $username)) {
        $response['errors']['username'] = 'Username can only contain letters, numbers, and underscores.';
    }

    if (empty($email)) {
        $response['errors']['email'] = 'Email is required.';
    } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $response['errors']['email'] = 'Invalid email format.';
    }

    if (empty($password)) {
        $response['errors']['password'] = 'Password is required.';
    } elseif (strlen($password) < 8) {
        $response['errors']['password'] = 'Password must be at least 8 characters long.';
    }
    // Add more password complexity rules if desired (e.g., uppercase, number, special char)

    if ($password !== $confirm_password) {
        $response['errors']['confirm_password'] = 'Passwords do not match.';
    }

    if (!empty($response['errors'])) {
        $response['message'] = 'Please correct the errors below.';
        echo json_encode($response);
        exit;
    }

    // --- Check if username or email already exists ---
    try {
        $pdo = getDBConnection();

        // Check for existing username
        $stmt = $pdo->prepare("SELECT id FROM users WHERE username = ?");
        $stmt->execute([$username]);
        if ($stmt->fetch()) {
            $response['errors']['username'] = 'Username already taken.';
        }

        // Check for existing email
        $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
        $stmt->execute([$email]);
        if ($stmt->fetch()) {
            $response['errors']['email'] = 'Email already registered.';
        }

        if (!empty($response['errors'])) {
            $response['message'] = 'Registration failed.';
            echo json_encode($response);
            exit;
        }

        // --- Hash password and insert user ---
        $hashed_password = password_hash($password, PASSWORD_DEFAULT); // Use default strong hashing
        $encryption_salt = generate_encryption_salt(); // Generate salt for note encryption

        $stmt = $pdo->prepare("INSERT INTO users (username, email, password, role, encryption_salt) VALUES (?, ?, ?, ?, ?)");
        // New users are 'user' by default. Admin creation would be a separate process.
        if ($stmt->execute([$username, $email, $hashed_password, 'user', $encryption_salt])) {
            $response['success'] = true;
            $response['message'] = 'Registration successful! You can now log in.';
            // Optionally, log the user in directly here by setting session variables
            // $_SESSION['user_id'] = $pdo->lastInsertId();
            // $_SESSION['username'] = $username;
        } else {
            $response['message'] = 'An error occurred during registration. Please try again.';
            log_error('User registration failed: Database insert error.', __FILE__, __LINE__);
        }

    } catch (PDOException $e) {
        $response['message'] = 'Database error during registration. Please try again later.';
        log_error('PDOException in register.php: ' . $e->getMessage(), __FILE__, __LINE__);
        if (DEVELOPMENT_MODE) {
            $response['debug_error'] = $e->getMessage();
        }
    } catch (Exception $e) {
        $response['message'] = 'An unexpected error occurred. Please try again later.';
        log_error('Exception in register.php: ' . $e->getMessage(), __FILE__, __LINE__);
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
