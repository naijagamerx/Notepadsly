-- Database: Notepad

-- Table: users
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: folders
CREATE TABLE folders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Table: notes
CREATE TABLE notes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    folder_id INT,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL -- If folder is deleted, note is not deleted
);

-- Table: tags
CREATE TABLE tags (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE
);

-- Table: note_tags (Many-to-Many relationship between notes and tags)
CREATE TABLE note_tags (
    note_id INT NOT NULL,
    tag_id INT NOT NULL,
    PRIMARY KEY (note_id, tag_id),
    FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- Table: shared_notes (For sharing notes between users)
CREATE TABLE shared_notes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    note_id INT NOT NULL,
    shared_with_user_id INT NOT NULL,
    shared_by_user_id INT NOT NULL,
    permission ENUM('read', 'edit') DEFAULT 'read',
    shared_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
    FOREIGN KEY (shared_with_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (shared_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE (note_id, shared_with_user_id) -- Ensure a note is shared only once with the same user
);

-- Admin specific tables (as per prompt, admin has user management, etc.)
-- No separate admin table for login, admin could be a user with a special role.
-- We can add a 'role' column to the 'users' table.
-- And columns for password reset functionality.

ALTER TABLE users ADD COLUMN role ENUM('user', 'admin') DEFAULT 'user';
ALTER TABLE users ADD COLUMN password_reset_token VARCHAR(255) DEFAULT NULL;
ALTER TABLE users ADD COLUMN reset_token_expires_at TIMESTAMP NULL DEFAULT NULL;
ALTER TABLE users ADD COLUMN twofa_secret VARCHAR(255) DEFAULT NULL;
ALTER TABLE users ADD COLUMN twofa_enabled TINYINT(1) DEFAULT 0;
ALTER TABLE users ADD COLUMN twofa_recovery_codes TEXT DEFAULT NULL; -- Store as JSON array of hashed codes

-- For admin settings like logo, fav icon, SMTP (could be a key-value store or separate columns)
CREATE TABLE admin_settings (
    setting_key VARCHAR(255) PRIMARY KEY,
    setting_value TEXT
);

-- Default admin settings
INSERT INTO admin_settings (setting_key, setting_value) VALUES
('site_name', 'Notepadsly'),
('logo_url', 'assets/logo.png'),
('favicon_url', 'assets/favicon.ico'),
('smtp_host', ''),
('smtp_port', ''),
('smtp_user', ''),
('smtp_password', ''),
('smtp_from_email', ''),
('smtp_from_name', 'Notepadsly Admin'),
('enable_2fa', 'false');

-- Error logs table
CREATE TABLE error_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    error_message TEXT,
    file_path VARCHAR(255),
    line_number INT,
    user_agent TEXT,
    ip_address VARCHAR(45)
);
