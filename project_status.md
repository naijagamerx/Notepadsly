# Notepadsly - Project Status

## I. Core User-Facing Features

### 1. User Authentication & Account Management
    - **[✓] User Registration:** (Username, Email, Password) - Implemented.
    - **[✓] User Login:** (Username/Email, Password) - Implemented.
    - **[✓] Session Management:** (PHP Sessions) - Implemented.
    - **[✓] Logout:** - Implemented.
    - **[✓] Password Reset (Admin Triggered):**
        - **[✓] Token Generation & DB Storage:** Implemented.
        - **[✓] Reset Form & Password Update Logic:** Implemented.
        - **[~] Actual Email Sending via SMTP:** Conceptual logic in place, PHPMailer integration & actual send calls pending.
    - **[~] Two-Factor Authentication (2FA/OTP):**
        - **[✓] DB Schema Changes:** Added.
        - **[✓] Backend Logic for Setup (Generate Secret, Enable, Disable - STUBBED Crypto):** Implemented.
        - **[✓] Backend Login Flow Modification for 2FA:** Implemented.
        - **[✓] Backend OTP Verification (STUBBED Crypto):** Implemented.
        - **[✓] Frontend UI for 2FA Setup (Dashboard Modal - QR, OTP, Recovery Codes):** Implemented.
        - **[✓] Frontend UI for OTP Entry at Login:** Implemented.
        - **[ ] Real TOTP Library Integration (Backend):** Pending.
        - **[ ] Secure (Hashed) Storage & Use of Recovery Codes:** Currently placeholder/plain. Critical.
        - **[ ] User-initiated Password Reset ("Forgot Password"):** Not yet implemented.

### 2. Note Management
    - **[✓] Create, Read, Update, Delete (CRUD) Notes:** Implemented.
    - **[✓] Note List (Left Panel):** Implemented, shows owned and shared-with-user notes.
    - **[✓] Note Preview/Editor (Right Panel):** Implemented.
    - **[✓] Basic Text Formatting (Toolbar - Markdown Style):** Bold, Italic, Underline implemented.
    - **[ ] Advanced Text Formatting (Lists, etc.):** Partially planned, not fully implemented.
    - **[✓] Download Note (as .txt):** Implemented.
    - **[ ] Upload/Import Note from PC/Mobile (.txt, .md, .doc):** .txt/.md import pending; .doc is complex and likely out of scope.

### 3. Folder Management
    - **[✓] Create, Rename, Delete Folders:** Implemented.
    - **[✓] Folder List (Sidebar):** Implemented.
    - **[✓] Move Note to Folder (via editor dropdown):** Implemented.

### 4. Tag Management
    - **[✓] Add/Remove Tags to Notes (via editor input):** Implemented (tags created on-the-fly if new).
    - **[✓] Display Tags for Current Note:** Implemented (as pills).
    *   **[✓] Tag Autocomplete in Editor:** Implemented.
    *   **[✓] Sidebar Tag List with Note Counts:** Implemented.
    *   **[✓] Filter Notes by Single/Multiple Tags (Client-Side AND):** Implemented.

### 5. Note Sharing
    - **[✓] Share Note with Other Users:** Implemented.
    - **[✓] Set Permissions (Read-Only, Edit):** Implemented.
    - **[✓] Manage Existing Shares (View Shared Users, Change Permissions, Revoke Access):** Implemented in Share Modal.
    - **[~] Email Notification on Share:** Conceptual logic in place, actual SMTP sending pending.
    - **[✓] Barcode Sharing (QR Code for Note Link):** Implemented (generates QR for note URL).
    - **[✓] Deep Linking to Notes (via URL Hash):** Implemented.

### 6. Local Storage / Offline Functionality
    - **[✓] User Toggle to Switch Mode (Conceptual "Work Offline"):** Implemented.
    - **[✓] Active Note Saved/Loaded from Local Storage:** Implemented.
    - **[✓] Handling Multiple New Notes Created Offline (Temp IDs & Index):** Implemented.
    - **[✓] Sync Indicator in UI for Offline Changes/New Notes:** Implemented.
    - **[✓] Manual "Sync to Server" Button:** Implemented.
    - **[✓] Basic Conflict Notification (Server Newer):** Implemented (user informed, local changes preserved).
    - **[ ] Full Offline Mode (All Notes, Folders, Tags Synced):** Major feature, not yet implemented. Current is active-note focused.

## II. Admin Panel Features

### 1. Admin Access & Dashboard
    - **[✓] Admin Role in User Table:** Implemented.
    - **[✓] Separate Admin Dashboard UI:** Implemented (`admin_dashboard.html`).
    - **[✓] Access Control (PHP check for admin role):** Implemented for `admin_handler.php`.

### 2. User Management (Admin)
    - **[✓] List All Users (Paginated in concept, currently all):** Implemented (currently fetches all, pagination for display not yet added but backend supports it for logs).
    - **[✓] Add New User:** Implemented.
    - **[✓] Edit User (Username, Email, Role):** Implemented.
    - **[✓] Delete User:** Implemented.
    - **[✓] Last Admin Protection (Prevent Deletion/Demotion):** Implemented.
    - **[✓] Trigger Password Reset for User:** Implemented (conceptual email).
    - **[✓] Export User List (CSV):** Implemented.
    - **[ ] View User Details/Activity (Last Login, Note Count, etc.):** Placeholder UI/backend action planned.

### 3. Site Settings Management (Admin)
    - **[✓] Manage Site Name, Logo URL, Favicon URL:** Implemented (text inputs).
    - **[✓] File Uploads for Logo & Favicon (with Preview):** Implemented.
    - **[✓] Manage SMTP Settings (Text Inputs):** Implemented.
    - **[✓] Manage Security Settings (2FA Global Toggle - placeholder value):** Implemented.

### 4. Error Log Viewer (Admin)
    - **[✓] View Error Logs from Database (Paginated):** Implemented.

### 5. Database Management (Admin)
    - **[ ] Admin Export Database Settings:** Not yet implemented.

## III. General & Technical

### 1. Design & UI/UX
    - **[✓] iOS Note Design Inspiration (Basic Theming):** Implemented (yellowish notes, general layout).
    - **[✓] Light Yellow & Lined Paper for Notes:** Implemented in editor.
    - **[✓] Left Panel (List), Right Panel (Preview/Editor):** Implemented.
    - **[✓] Formatting Toolbar (Placeholder buttons, some functional):** Basic Bold, Italic, Underline functional.
    - **[✓] Mobile Responsiveness (Basic):** Implemented (media queries, panel adjustments).
    - **[✓] Mobile Footer Icon Menu:** Implemented with basic functionality.
    - **[ ] Further Mobile UI Polish for "App-Like Feel":** Ongoing refinement possible.

### 2. Backend & Database
    - **[✓] PHP Version 8+ Target:** Code written should be compatible.
    - **[✓] MySQL Database ("Notepadsly"):** Schema designed and used.
    - **[✓] Well-Organized Database SQL:** Schema provided in `schema.sql`.
    - **[✓] File Structure (Separate PHP, CSS, JS, HTML per page/module):** Generally followed.
    - **[✓] URL Rewriting (No .html extensions):** Implemented via `.htaccess`.

### 3. Security
    - **[✓] Encrypted Notes (Admin Can't See):** This was a prompt requirement. **Currently, notes are stored as plain text in the DB.** True encryption (e.g., client-side or application-level encryption where admin DB access doesn't reveal content) is a major feature NOT YET IMPLEMENTED. This is a critical discrepancy if "encrypted" means admin-proof.
    - **[✓] Password Hashing:** Implemented (PHP `password_hash`).
    - **[~] 2FA/OTP:** Backend setup and login flow modified, UI for setup/login present. Real crypto library and secure recovery code handling pending.
    - **[✓] Basic Input Validation & Output Escaping (XSS Prevention):** Implemented in various places.
    - **[✓] Prepared Statements (SQL Injection Prevention):** Used for DB queries.

### 4. Error Handling & Logging
    *   **[✓] Error Reporting (Dev/Prod Modes):** Implemented.
    *   **[✓] Error Logging (File & DB Table `error_logs`):** Implemented.

### 5. Constraints & Conventions
    - **[✓] Test Files in `test/` folder:** No automated tests written yet, but convention noted.
    - **[✓] No Code File > 1000 Lines:** Generally adhered to for core logic files created by agent. Some JS files are getting large due to monolithic nature.

## IV. Summary of Critical Remaining / Partially Implemented Tasks

*   **CRITICAL: Note Encryption (Admin-Proof):** This is a major security requirement from the prompt that is **NOT MET**. Notes are currently plain text in DB.
*   **Full Email Sending:** Integrate PHPMailer and test actual email delivery for password resets and share notifications.
*   **Full 2FA Implementation:** Integrate a real TOTP library, implement secure (hashed) recovery codes, and build out any missing UI for recovery code usage.
*   **Full Local Storage / Offline Mode (All Data):** The current "offline mode" is very basic and only for the active note. The prompt's "User can switch from database to local storage" implies a much more comprehensive solution.
*   **Admin: Export Database Settings.**
*   **User: Import Notes from File.**
*   **Support System (User & Admin):** Define and implement.
*   **Advanced Editor Formatting (Lists, etc.).**

---
This provides a good overview. The most critical missing piece regarding the original prompt's security requirements is the note encryption.
Now, I will formulate the final plan.
