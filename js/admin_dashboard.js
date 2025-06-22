document.addEventListener('DOMContentLoaded', function() {
    // --- DOM Elements ---
    const adminUsernameDisplay = document.getElementById('adminUsernameDisplay');
    const userListTableBody = document.getElementById('userListTableBody');
    const sidebarLinks = document.querySelectorAll('.admin-sidebar nav li a');
    const adminSections = document.querySelectorAll('.admin-section');
    const addUserBtn = document.getElementById('addUserBtn');

    // Add User Modal Elements
    const addUserModal = document.getElementById('addUserModal');
    const addUserForm = document.getElementById('addUserForm');
    const closeAddUserModalBtn = addUserModal ? addUserModal.querySelector('.close-button') : null;

    // Edit User Modal Elements
    const editUserModal = document.getElementById('editUserModal');
    const editUserForm = document.getElementById('editUserForm');
    const closeEditUserModalBtn = editUserModal ? editUserModal.querySelector('.close-button') : null;
    const editUserIdInput = document.getElementById('editUserId');
    const editUsernameInput = document.getElementById('editUsername');
    const editEmailInput = document.getElementById('editEmail');
    const editRoleInput = document.getElementById('editRole');


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
                    window.location.href = '/login'; // Updated to extension-less URL
                }
            })
            .catch(error => {
                console.error('Error fetching admin data:', error);
                // showGlobalNotification("Could not load admin information. Redirecting to login.", "error");
                window.location.href = '/login'; // Updated to extension-less URL
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

            // Add event listeners for edit/delete buttons
            const editBtn = row.querySelector('.edit-btn');
            if (editBtn) {
                editBtn.addEventListener('click', () => openEditUserModal(user.id));
            }
            const deleteBtn = row.querySelector('.delete-btn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', () => confirmDeleteUser(user.id, user.username));
            }
        });
    }

    // Function to clear form errors
    function clearFormErrors(formElement) {
        formElement.querySelectorAll('.error-message').forEach(el => el.textContent = '');
    }

    // Function to display form errors
    function displayFormErrors(formElement, errors) {
        clearFormErrors(formElement); // Clear previous errors
        for (const field in errors) {
            const errorElId = `${formElement.id.replace('Form','').toLowerCase()}${field.charAt(0).toUpperCase() + field.slice(1)}Error`; // e.g. addUsernameError
            const fieldErrorEl = formElement.querySelector(`#${errorElId}`);
            if (fieldErrorEl) {
                fieldErrorEl.textContent = errors[field];
            } else { // Fallback if specific error field not found (e.g. general message)
                 console.warn(`Error field for ${field} not found in form ${formElement.id}`);
            }
        }
    }


    function setupEventListeners() {
        // Sidebar navigation
        sidebarLinks.forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const sectionId = this.dataset.section;
                showSection(sectionId);

                sidebarLinks.forEach(s_link => s_link.classList.remove('active'));
                this.classList.add('active');
            });
        });

        // Add User Modal
        if (addUserBtn) {
            addUserBtn.addEventListener('click', () => {
                if (addUserForm) addUserForm.reset();
                if (addUserModal) {
                    clearFormErrors(addUserForm);
                    addUserModal.style.display = 'flex';
                }
            });
        }
        if (closeAddUserModalBtn) {
            closeAddUserModalBtn.addEventListener('click', () => {
                if (addUserModal) addUserModal.style.display = 'none';
            });
        }
        if (addUserForm) {
            addUserForm.addEventListener('submit', function(e) {
                e.preventDefault();
                const formData = new FormData(addUserForm);
                fetch('../php/admin_handler.php?action=add_user', {
                    method: 'POST',
                    body: formData
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        showGlobalNotification(data.message || 'User added successfully!', 'success');
                        if (addUserModal) addUserModal.style.display = 'none';
                        loadUsers(); // Refresh user list
                    } else {
                        showGlobalNotification(data.message || 'Failed to add user.', 'error');
                        if (data.errors) displayFormErrors(addUserForm, data.errors);
                    }
                })
                .catch(error => {
                    console.error('Add User Error:', error);
                    showGlobalNotification('An error occurred while adding the user.', 'error');
                });
            });
        }

        // Edit User Modal
        if (closeEditUserModalBtn) {
            closeEditUserModalBtn.addEventListener('click', () => {
                if (editUserModal) editUserModal.style.display = 'none';
            });
        }
        if (editUserForm) {
            editUserForm.addEventListener('submit', function(e) {
                e.preventDefault();
                const formData = new FormData(editUserForm);
                fetch('../php/admin_handler.php?action=update_user', {
                    method: 'POST',
                    body: formData
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        showGlobalNotification(data.message || 'User updated successfully!', 'success');
                        if (editUserModal) editUserModal.style.display = 'none';
                        loadUsers(); // Refresh user list
                    } else {
                        showGlobalNotification(data.message || 'Failed to update user.', 'error');
                        if (data.errors) displayFormErrors(editUserForm, data.errors);
                    }
                })
                .catch(error => {
                    console.error('Update User Error:', error);
                    showGlobalNotification('An error occurred while updating the user.', 'error');
                });
            });
        }

        // Generic modal closing by clicking outside (for admin modals)
        [addUserModal, editUserModal].forEach(modal => {
            if (modal) {
                window.addEventListener('click', (event) => {
                    if (event.target == modal) {
                        modal.style.display = 'none';
                    }
                });
            }
        });

    } // End of setupEventListeners

    function openEditUserModal(userId) {
        if (!editUserModal || !editUserForm) return;
        clearFormErrors(editUserForm);

        fetch(`../php/admin_handler.php?action=get_user_details&user_id=${userId}`)
            .then(response => response.json())
            .then(data => {
                if (data.success && data.user) {
                    editUserIdInput.value = data.user.id;
                    editUsernameInput.value = data.user.username;
                    editEmailInput.value = data.user.email;
                    editRoleInput.value = data.user.role;
                    editUserModal.style.display = 'flex';
                } else {
                    showGlobalNotification(data.message || 'Failed to fetch user details.', 'error');
                }
            })
            .catch(error => {
                console.error('Get User Details Error:', error);
                showGlobalNotification('An error occurred while fetching user details.', 'error');
            });
    }

    function confirmDeleteUser(userId, username) {
        if (confirm(`Are you sure you want to delete user "${escapeHTML(username)}" (ID: ${userId})? This action cannot be undone.`)) {
            deleteUser(userId);
        }
    }

    function deleteUser(userId) {
        const formData = new FormData();
        formData.append('user_id', userId);

        fetch('../php/admin_handler.php?action=delete_user', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showGlobalNotification(data.message || 'User deleted successfully!', 'success');
                loadUsers(); // Refresh user list
            } else {
                showGlobalNotification(data.message || 'Failed to delete user.', 'error');
            }
        })
        .catch(error => {
            console.error('Delete User Error:', error);
            showGlobalNotification('An error occurred while deleting the user.', 'error');
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
