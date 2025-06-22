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

    // Site Settings Form Elements
    const siteSettingsForm = document.getElementById('siteSettingsForm');

    // Error Log Elements
    const errorLogTableBody = document.getElementById('errorLogTableBody');
    const errorLogPaginationControls = document.getElementById('errorLogPagination');
    const errorLogPrevPageBtn = document.getElementById('errorLogPrevPage');
    const errorLogNextPageBtn = document.getElementById('errorLogNextPage');
    const errorLogPageInfo = document.getElementById('errorLogPageInfo');
    let currentErrorLogPage = 1;
    const errorLogLimit = 25; // Should match backend default or be passed as param

    // --- Initialization ---
    function initializeAdminDashboard() {
        fetchAdminData();
        setupEventListeners();
        showSection('user-management');
    }

    function fetchAdminData() {
        fetch('../php/admin_handler.php?action=get_admin_info')
            .then(response => response.json())
            .then(data => {
                if (data.success && data.username && adminUsernameDisplay) {
                    adminUsernameDisplay.textContent = `Welcome, ${data.username}! (Admin)`;
                } else if (!data.success) {
                    console.error(data.message || "Unauthorized access to admin panel.");
                    window.location.href = '/login';
                }
            })
            .catch(error => {
                console.error('Error fetching admin data:', error);
                window.location.href = '/login';
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
        userListTableBody.innerHTML = '';
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
                    <button class="reset-password-btn" data-user-id="${user.id}" title="Send Password Reset">&#128273;</button> <!-- Key icon -->
                </td>
            `;
            const editBtn = row.querySelector('.edit-btn');
            if (editBtn) editBtn.addEventListener('click', () => openEditUserModal(user.id));

            const deleteBtn = row.querySelector('.delete-btn');
            if (deleteBtn) deleteBtn.addEventListener('click', () => confirmDeleteUser(user.id, user.username));

            const resetPasswordBtn = row.querySelector('.reset-password-btn');
            if (resetPasswordBtn) resetPasswordBtn.addEventListener('click', () => confirmTriggerPasswordReset(user.id, user.username));
        });
    }

    function clearFormErrors(formElement) {
        if (!formElement) return;
        formElement.querySelectorAll('.error-message').forEach(el => el.textContent = '');
    }

    function displayFormErrors(formElement, errors) {
        if (!formElement) return;
        clearFormErrors(formElement);
        for (const field in errors) {
            const errorElId = `${formElement.id.replace('Form','').toLowerCase()}${field.charAt(0).toUpperCase() + field.slice(1)}Error`;
            const fieldErrorEl = formElement.querySelector(`#${errorElId}`);
            if (fieldErrorEl) {
                fieldErrorEl.textContent = errors[field];
            } else {
                 console.warn(`Error field for ${field} not found in form ${formElement.id}`);
            }
        }
    }

    function loadSiteSettings() {
        if (!siteSettingsForm) return;
        fetch('../php/admin_handler.php?action=get_site_settings')
            .then(response => response.json())
            .then(data => {
                if (data.success && data.settings) {
                    for (const key in data.settings) {
                        const inputName = `settings[${key}]`;
                        if (siteSettingsForm.elements[inputName]) {
                            siteSettingsForm.elements[inputName].value = data.settings[key];
                        }
                    }
                } else {
                    showGlobalNotification(data.message || 'Failed to load site settings.', 'error');
                }
            })
            .catch(error => {
                console.error('Error loading site settings:', error);
                showGlobalNotification('An error occurred while loading site settings.', 'error');
            });
    }

    function loadErrorLogs(page = 1) {
        if (!errorLogTableBody) return;
        currentErrorLogPage = page;
        fetch(`../php/admin_handler.php?action=get_error_logs&page=${page}&limit=${errorLogLimit}`)
            .then(response => response.json())
            .then(data => {
                if (data.success && data.logs) {
                    renderErrorLogs(data.logs, data.pagination);
                } else {
                    errorLogTableBody.innerHTML = `<tr><td colspan="7">Error loading logs: ${data.message || 'Unknown error'}</td></tr>`;
                    if(errorLogPaginationControls) errorLogPaginationControls.style.display = 'none';
                }
            })
            .catch(error => {
                console.error('Error fetching error logs:', error);
                errorLogTableBody.innerHTML = `<tr><td colspan="7">Failed to fetch error logs from server.</td></tr>`;
                if(errorLogPaginationControls) errorLogPaginationControls.style.display = 'none';
            });
    }

    function renderErrorLogs(logs, pagination) {
        if (!errorLogTableBody) return;
        errorLogTableBody.innerHTML = '';

        if (logs.length === 0) {
            errorLogTableBody.innerHTML = '<tr><td colspan="7">No error logs found.</td></tr>';
            if(errorLogPaginationControls) errorLogPaginationControls.style.display = 'none';
            return;
        }
        if(errorLogPaginationControls) errorLogPaginationControls.style.display = 'block';


        logs.forEach(log => {
            const row = errorLogTableBody.insertRow();
            row.innerHTML = `
                <td>${log.id}</td>
                <td>${new Date(log.timestamp).toLocaleString()}</td>
                <td title="${escapeHTML(log.error_message)}">${escapeHTML(log.error_message.substring(0,100))}${log.error_message.length > 100 ? '...' : ''}</td>
                <td>${escapeHTML(log.file_path)}</td>
                <td>${log.line_number}</td>
                <td title="${escapeHTML(log.user_agent)}">${escapeHTML(log.user_agent.substring(0,30))}${log.user_agent.length > 30 ? '...' : ''}</td>
                <td>${escapeHTML(log.ip_address)}</td>
            `;
        });

        // Update pagination controls
        if (errorLogPageInfo) errorLogPageInfo.textContent = `Page ${pagination.currentPage} of ${pagination.totalPages} (Total: ${pagination.totalLogs})`;
        if (errorLogPrevPageBtn) errorLogPrevPageBtn.disabled = pagination.currentPage <= 1;
        if (errorLogNextPageBtn) errorLogNextPageBtn.disabled = pagination.currentPage >= pagination.totalPages;
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
                fetch('../php/admin_handler.php?action=add_user', { method: 'POST', body: formData })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        showGlobalNotification(data.message || 'User added successfully!', 'success');
                        if (addUserModal) addUserModal.style.display = 'none';
                        loadUsers();
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

        if (closeEditUserModalBtn) {
            closeEditUserModalBtn.addEventListener('click', () => {
                if (editUserModal) editUserModal.style.display = 'none';
            });
        }
        if (editUserForm) {
            editUserForm.addEventListener('submit', function(e) {
                e.preventDefault();
                const formData = new FormData(editUserForm);
                fetch('../php/admin_handler.php?action=update_user', { method: 'POST', body: formData })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        showGlobalNotification(data.message || 'User updated successfully!', 'success');
                        if (editUserModal) editUserModal.style.display = 'none';
                        loadUsers();
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

        [addUserModal, editUserModal].forEach(modal => {
            if (modal) {
                window.addEventListener('click', (event) => {
                    if (event.target == modal) modal.style.display = 'none';
                });
            }
        });

        if (siteSettingsForm) {
            siteSettingsForm.addEventListener('submit', function(e) {
                e.preventDefault();
                const formData = new FormData(siteSettingsForm);
                fetch('../php/admin_handler.php?action=update_site_settings', {
                    method: 'POST',
                    body: formData
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        showGlobalNotification(data.message || 'Settings updated successfully!', 'success');
                    } else {
                        showGlobalNotification(data.message || 'Failed to update settings.', 'error');
                    }
                })
                .catch(error => {
                    console.error('Update Site Settings Error:', error);
                    showGlobalNotification('An error occurred while updating settings.', 'error');
                });
            });
        }

        if(errorLogPrevPageBtn) {
            errorLogPrevPageBtn.addEventListener('click', () => {
                if (currentErrorLogPage > 1) {
                    loadErrorLogs(currentErrorLogPage - 1);
                }
            });
        }
        if(errorLogNextPageBtn) {
            errorLogNextPageBtn.addEventListener('click', () => {
                // Check against totalPages if available from pagination data
                loadErrorLogs(currentErrorLogPage + 1);
            });
        }

    }

    function openEditUserModal(userId) {
        if (!editUserModal || !editUserForm) return;
        clearFormErrors(editUserForm);
        fetch(`../php/admin_handler.php?action=get_user_details&user_id=${userId}`)
            .then(response => response.json())
            .then(data => {
                if (data.success && data.user) {
                    if(editUserIdInput) editUserIdInput.value = data.user.id;
                    if(editUsernameInput) editUsernameInput.value = data.user.username;
                    if(editEmailInput) editEmailInput.value = data.user.email;
                    if(editRoleInput) editRoleInput.value = data.user.role;
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
        fetch('../php/admin_handler.php?action=delete_user', { method: 'POST', body: formData })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showGlobalNotification(data.message || 'User deleted successfully!', 'success');
                loadUsers();
            } else {
                showGlobalNotification(data.message || 'Failed to delete user.', 'error');
            }
        })
        .catch(error => {
            console.error('Delete User Error:', error);
            showGlobalNotification('An error occurred while deleting the user.', 'error');
        });
    }

    function confirmTriggerPasswordReset(userId, username) {
        if (confirm(`Are you sure you want to trigger a password reset for user "${escapeHTML(username)}" (ID: ${userId})? They will need to check their email (conceptually).`)) {
            triggerPasswordReset(userId);
        }
    }

    function triggerPasswordReset(userId) {
        const formData = new FormData();
        formData.append('user_id', userId);

        fetch('../php/admin_handler.php?action=trigger_password_reset', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showGlobalNotification(data.message || 'Password reset triggered successfully!', 'success');
                // No need to reload user list for this action
            } else {
                showGlobalNotification(data.message || 'Failed to trigger password reset.', 'error');
            }
        })
        .catch(error => {
            console.error('Trigger Password Reset Error:', error);
            showGlobalNotification('An error occurred while triggering password reset.', 'error');
        });
    }

    function showSection(sectionId) {
        adminSections.forEach(section => {
            if (section.id === sectionId + '-section') {
                section.style.display = 'block';
                if (sectionId === 'user-management') loadUsers();
                if (sectionId === 'site-settings') loadSiteSettings();
                if (sectionId === 'error-logs') loadErrorLogs();
            } else {
                section.style.display = 'none';
            }
        });
    }

    function escapeHTML(str) {
        if (str === null || str === undefined) return '';
        return String(str).replace(/[&<>"']/g, function (match) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[match];
        });
    }

    initializeAdminDashboard();
});

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
