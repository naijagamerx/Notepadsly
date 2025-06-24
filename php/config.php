<?php
// Database configuration
define('DB_HOST', 'localhost'); // As per MAMP default
define('DB_NAME', 'Notepad');   // As per prompt
define('DB_USER', 'root');      // As per prompt
define('DB_PASSWORD', 'root');  // As per prompt

// Site configuration
define('SITE_ROOT', __DIR__); // Or adjust if your public folder is different

// Error reporting - Development vs Production
// For development, show all errors. For production, log errors and show a generic message.
define('DEVELOPMENT_MODE', true); // Set to false in production

if (DEVELOPMENT_MODE) {
    ini_set('display_errors', 1);
    ini_set('display_startup_errors', 1);
    error_reporting(E_ALL);
} else {
    ini_set('display_errors', 0);
    ini_set('display_startup_errors', 0);
    error_reporting(E_ALL); // Log all errors
    // TODO: Implement a proper error logging function here or in a separate file
    // For now, we'll rely on PHP's error_log directive in php.ini
}

// Start session
if (session_status() == PHP_SESSION_NONE) {
    session_start();
}

// Function to connect to the database
function getDBConnection() {
    static $conn = null; // Static variable to hold the connection
    if ($conn === null) {
        try {
            $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4";
            $options = [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ];
            $conn = new PDO($dsn, DB_USER, DB_PASSWORD, $options);
        } catch (PDOException $e) {
            // In a real app, you'd log this error and show a user-friendly message
            error_log("Database Connection Error: " . $e->getMessage());
            if (DEVELOPMENT_MODE) {
                die("Database Connection Error: " . $e->getMessage());
            } else {
                die("Could not connect to the database. Please try again later.");
            }
        }
    }
    return $conn;
}

// Basic error logging function (can be expanded)
function log_error($message, $file = '', $line = '') {
    $log_message = "[" . date("Y-m-d H:i:s") . "] Error: " . $message;
    if ($file) $log_message .= " in " . $file;
    if ($line) $log_message .= " on line " . $line;
    $log_message .= PHP_EOL;

    // Define a log file path (ensure this directory is writable by the web server)
    $log_file_path = SITE_ROOT . '/../error_logs.txt'; // Store logs outside web root if possible

    // Use error_log for simplicity, or implement more robust logging (e.g., to database)
    error_log($log_message, 3, $log_file_path);

    // Additionally, log to the database if the connection is available and table exists
    try {
        $pdo = getDBConnection();
        // Check if the error_logs table exists to prevent errors during initial setup
        $stmt_check = $pdo->query("SHOW TABLES LIKE 'error_logs'");
        if ($stmt_check && $stmt_check->rowCount() > 0) {
            $stmt = $pdo->prepare("INSERT INTO error_logs (error_message, file_path, line_number, user_agent, ip_address) VALUES (?, ?, ?, ?, ?)");
            $user_agent = isset($_SERVER['HTTP_USER_AGENT']) ? $_SERVER['HTTP_USER_AGENT'] : 'N/A';
            $ip_address = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : 'N/A';
            $stmt->execute([$message, $file, $line, $user_agent, $ip_address]);
        }
    } catch (PDOException $e) {
        // If logging to DB fails, at least it's in the file log
        error_log("Failed to log error to database: " . $e->getMessage(), 3, $log_file_path);
    }
}

// Set custom error handler
//set_error_handler(function($errno, $errstr, $errfile, $errline) {
//    if (!(error_reporting() & $errno)) {
//        // This error code is not included in error_reporting
//        return false;
//    }
//    log_error($errstr, $errfile, $errline);
//    // Don't execute PHP internal error handler if not in development mode
//    return !DEVELOPMENT_MODE;
//});

// --- Encryption Utilities ---
define('ENCRYPTION_METHOD', 'aes-256-cbc'); // AES 256-bit encryption in CBC mode
define('PBKDF2_ITERATIONS', 10000); // Number of iterations for PBKDF2

// Function to generate a user-specific salt for key derivation
function generate_encryption_salt() {
    return random_bytes(16); // 16 bytes for salt
}

// Function to derive a strong encryption key from user's password and salt
function derive_encryption_key($password, $salt) {
    if (empty($password) || empty($salt)) {
        // log_error("Password or salt is empty for key derivation.", __FILE__, __LINE__);
        return false; // Or throw an exception
    }
    // Use PBKDF2 to derive a key. The key length should match the chosen cipher.
    // For AES-256, we need a 32-byte (256-bit) key.
    $derived_key = hash_pbkdf2("sha256", $password, $salt, PBKDF2_ITERATIONS, 32, true); // true for raw binary output
    return $derived_key;
}

// Function to encrypt data
function encrypt_data($data, $key) {
    if (empty($key)) {
        // log_error("Encryption key is empty.", __FILE__, __LINE__);
        return false;
    }
    $iv_length = openssl_cipher_iv_length(ENCRYPTION_METHOD);
    if ($iv_length === false) {
        // log_error("Could not get IV length for " . ENCRYPTION_METHOD, __FILE__, __LINE__);
        return false;
    }
    $iv = openssl_random_pseudo_bytes($iv_length);
    $ciphertext = openssl_encrypt($data, ENCRYPTION_METHOD, $key, OPENSSL_RAW_DATA, $iv);
    if ($ciphertext === false) {
        // log_error("OpenSSL encryption failed: " . openssl_error_string(), __FILE__, __LINE__);
        return false;
    }
    // Prepend IV to ciphertext for storage/transmission then base64 encode
    return base64_encode($iv . $ciphertext);
}

// Function to decrypt data
function decrypt_data($iv_ciphertext_base64, $key) {
    if (empty($key)) {
        // log_error("Decryption key is empty.", __FILE__, __LINE__);
        return false;
    }
    $iv_ciphertext = base64_decode($iv_ciphertext_base64);
    if ($iv_ciphertext === false) {
        // log_error("Base64 decode failed for encrypted data.", __FILE__, __LINE__);
        return false;
    }

    $iv_length = openssl_cipher_iv_length(ENCRYPTION_METHOD);
    if ($iv_length === false) {
        // log_error("Could not get IV length for " . ENCRYPTION_METHOD, __FILE__, __LINE__);
        return false;
    }
    $iv = substr($iv_ciphertext, 0, $iv_length);
    $ciphertext = substr($iv_ciphertext, $iv_length);

    if (strlen($iv) !== $iv_length) {
        // log_error("IV length mismatch. Expected $iv_length, got " . strlen($iv), __FILE__, __LINE__);
        return false; // IV is not the correct length
    }

    $decrypted_data = openssl_decrypt($ciphertext, ENCRYPTION_METHOD, $key, OPENSSL_RAW_DATA, $iv);
    if ($decrypted_data === false) {
        // log_error("OpenSSL decryption failed: " . openssl_error_string(), __FILE__, __LINE__);
        // This can happen if the key is wrong, IV is wrong, or data is corrupted.
        return false;
    }
    return $decrypted_data;
}

?>
