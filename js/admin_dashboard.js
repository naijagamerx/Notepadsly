document.addEventListener('DOMContentLoaded', function() {
    // --- DOM Elements ---
    const adminUsernameDisplay = document.getElementById('adminUsernameDisplay');
    const userListTableBody = document.getElementById('userListTableBody');
    const sidebarLinks = document.querySelectorAll('.admin-sidebar nav li a');
    const adminSections = document.querySelectorAll('.admin-section');

    // --- Initialization ---
    function initializeAdminDashboard() {
        fetchAdminData();
        loadUsers();
        setupEventListeners();
        // Show user-management by default
        showSection('user-management');
    }

    function fetchAdminData() {
        fetch('../php/admin_handler.php?action=get_admin_info')
            .then(response => response.json())
            .then(data => {
                if (data.success && data.username && adminUsernameDisplay) {
                    adminUsernameDisplay.textContent = `Welcome, ${data.username}! (Admin)`;
                } else if (!data.success) {
                    // If not authorized (e.g. session expired, or not admin)
                    // admin_handler.php already checks for admin role.
                    // Redirect to login if unauthorized, or show error.
                    // showGlobalNotification will likely not be visible if redirecting immediately.
                    // The primary defense is server-side; client-side is for UX.
                    console.error(data.message || "Unauthorized access to admin panel.");
                    window.location.href = '../html/index.html'; // Redirect is probably best
                }
            })
            .catch(error => {
                console.error('Error fetching admin data:', error);
                // showGlobalNotification("Could not load admin information. Redirecting to login.", "error");
                window.location.href = '../html/index.html'; // Redirect is probably best
            });
    }

    function loadUsers() {
        if (!userListTableBody) return;

        fetch('../php/admin_handler.php?action=get_all_users')
            .then(response => response.json())
            .then(data => {
                if (data.success && data.users) {
                    renderUserList(data.users);
                } else {
                    userListTableBody.innerHTML = `<tr><td colspan="6">Error loading users: ${data.message || 'Unknown error'}</td></tr>`;
                }
            })
            .catch(error => {
                console.error('Error fetching users:', error);
                userListTableBody.innerHTML = `<tr><td colspan="6">Failed to fetch users from server.</td></tr>`;
            });
    }

    function renderUserList(users) {
        if (!userListTableBody) return;
        userListTableBody.innerHTML = ''; // Clear existing

        if (users.length === 0) {
            userListTableBody.innerHTML = '<tr><td colspan="6">No users found.</td></tr>';
            return;
        }

        users.forEach(user => {
            const row = userListTableBody.insertRow();
            row.innerHTML = `
                <td>${user.id}</td>
                <td>${escapeHTML(user.username)}</td>
                <td>${escapeHTML(user.email)}</td>
                <td>${escapeHTML(user.role)}</td>
                <td>${new Date(user.created_at).toLocaleDateString()}</td>
                <td class="actions-cell">
                    <button class="edit-btn" data-user-id="${user.id}" title="Edit User">&#9998;</button>
                    <button class="delete-btn" data-user-id="${user.id}" title="Delete User">&times;</button>
                </td>
            `;
            // Add event listeners for edit/delete buttons here if implementing those actions
        });
    }

    function setupEventListeners() {
        sidebarLinks.forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const sectionId = this.dataset.section;
                showSection(sectionId);

                sidebarLinks.forEach(s_link => s_link.classList.remove('active'));
                this.classList.add('active');
            });
        });
    }

    function showSection(sectionId) {
        adminSections.forEach(section => {
            if (section.id === sectionId + '-section') {
                section.style.display = 'block';
            } else {
                section.style.display = 'none';
            }
        });
    }

    // --- Utility Functions ---
    function escapeHTML(str) {
        if (str === null || str === undefined) return '';
        return String(str).replace(/[&<>"']/g, function (match) {
            return {
                '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
            }[match];
        });
    }

    // --- Start the application ---
    initializeAdminDashboard();
});

// --- Global Notification Function (can be moved to a shared utility JS file later) ---
let adminNotificationTimeout;
function showGlobalNotification(message, type = 'info', duration = 3000) {
    const notificationElement = document.getElementById('globalNotification');
    if (!notificationElement) return;

    clearTimeout(adminNotificationTimeout);

    notificationElement.textContent = message;
    notificationElement.className = 'global-notification';
    notificationElement.classList.add(type);

    const header = document.querySelector('.app-header');
    if (header && getComputedStyle(header).position === 'fixed') {
        notificationElement.style.top = `${header.offsetHeight}px`;
    } else {
        notificationElement.style.top = '0px';
    }

    notificationElement.style.display = 'block';

    adminNotificationTimeout = setTimeout(() => {
        notificationElement.style.display = 'none';
        notificationElement.style.top = '0px';
    }, duration);
}
