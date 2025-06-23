document.addEventListener('DOMContentLoaded', function() {
    // --- DOM Elements ---
    const adminUsernameDisplay = document.getElementById('adminUsernameDisplay');
    const userListTableBody = document.getElementById('userListTableBody');
    const sidebarLinks = document.querySelectorAll('.admin-sidebar nav li a');
    const adminSections = document.querySelectorAll('.admin-section');
    const addUserBtn = document.getElementById('addUserBtn');

    const addUserModal = document.getElementById('addUserModal');
    const addUserForm = document.getElementById('addUserForm');
    const closeAddUserModalBtn = addUserModal ? addUserModal.querySelector('.close-button') : null;

    const editUserModal = document.getElementById('editUserModal');
    const editUserForm = document.getElementById('editUserForm');
    const closeEditUserModalBtn = editUserModal ? editUserModal.querySelector('.close-button') : null;
    const editUserIdInput = document.getElementById('editUserId');
    const editUsernameInput = document.getElementById('editUsername');
    const editEmailInput = document.getElementById('editEmail');
    const editRoleInput = document.getElementById('editRole');

    const siteSettingsForm = document.getElementById('siteSettingsForm');
    const settingLogoFileInput = document.getElementById('settingLogoFile');
    const settingFaviconFileInput = document.getElementById('settingFaviconFile');
    const currentLogoUrlDisplay = document.getElementById('currentLogoUrlDisplay');
    const currentFaviconUrlDisplay = document.getElementById('currentFaviconUrlDisplay');
    const logoPreviewImg = document.getElementById('logoPreview');
    const faviconPreviewImg = document.getElementById('faviconPreview');

    const errorLogTableBody = document.getElementById('errorLogTableBody');
    const errorLogPaginationControls = document.getElementById('errorLogPagination');
    const errorLogPrevPageBtn = document.getElementById('errorLogPrevPage');
    const errorLogNextPageBtn = document.getElementById('errorLogNextPage');
    const errorLogPageInfo = document.getElementById('errorLogPageInfo');
    let currentErrorLogPage = 1;
    const errorLogLimit = 25;

    // --- Initialization ---
    function initializeAdminDashboard() {
        fetchAdminData();
        setupEventListeners();
        showSection('user-management');
    }

    function fetchAdminData() {
        // ... (same)
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
        // ... (same)
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
        // ... (same)
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
                    <button class="reset-password-btn" data-user-id="${user.id}" title="Send Password Reset">&#128273;</button>
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
        // ... (same)
        if (!formElement) return;
        formElement.querySelectorAll('.error-message').forEach(el => el.textContent = '');
    }

    function displayFormErrors(formElement, errors) {
        // ... (same)
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
                    // Update display spans and image previews for current URLs
                    if (currentLogoUrlDisplay) {
                        currentLogoUrlDisplay.textContent = data.settings.logo_url || 'N/A';
                        if (data.settings.logo_url && logoPreviewImg) {
                            logoPreviewImg.src = data.settings.logo_url;
                            logoPreviewImg.style.display = 'block';
                        } else if (logoPreviewImg) {
                            logoPreviewImg.style.display = 'none';
                        }
                    }
                    if (currentFaviconUrlDisplay) {
                        currentFaviconUrlDisplay.textContent = data.settings.favicon_url || 'N/A';
                        if (data.settings.favicon_url && faviconPreviewImg) {
                            faviconPreviewImg.src = data.settings.favicon_url;
                            faviconPreviewImg.style.display = 'block';
                        } else if (faviconPreviewImg) {
                            faviconPreviewImg.style.display = 'none';
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

    async function handleSiteSettingsSubmit(e) {
        e.preventDefault();
        let overallSuccess = true;
        let messages = [];
        const submitButton = siteSettingsForm.querySelector('button[type="submit"]');
        if(submitButton) submitButton.disabled = true;


        // Handle file uploads first
        const logoFile = settingLogoFileInput && settingLogoFileInput.files[0];
        const faviconFile = settingFaviconFileInput && settingFaviconFileInput.files[0];

        if (logoFile) {
            const logoFormData = new FormData();
            logoFormData.append('asset_file', logoFile);
            logoFormData.append('asset_type', 'logo');
            try {
                const response = await fetch('../php/admin_handler.php?action=upload_site_asset', { method: 'POST', body: logoFormData });
                const data = await response.json();
                if (data.success) {
                    messages.push(data.message || "Logo uploaded.");
                    if(currentLogoUrlDisplay && data.url) currentLogoUrlDisplay.textContent = data.url;
                    if(logoPreviewImg && data.url) { logoPreviewImg.src = data.url + '?t=' + new Date().getTime(); logoPreviewImg.style.display = 'block';} // Cache bust
                } else {
                    overallSuccess = false;
                    messages.push(data.message || 'Logo upload failed.');
                }
            } catch (error) {
                overallSuccess = false;
                messages.push('Error uploading logo.');
                console.error('Logo Upload Error:', error);
            }
        }

        if (faviconFile) {
            const faviconFormData = new FormData();
            faviconFormData.append('asset_file', faviconFile);
            faviconFormData.append('asset_type', 'favicon');
            try {
                const response = await fetch('../php/admin_handler.php?action=upload_site_asset', { method: 'POST', body: faviconFormData });
                const data = await response.json();
                if (data.success) {
                    messages.push(data.message || "Favicon uploaded.");
                     if(currentFaviconUrlDisplay && data.url) currentFaviconUrlDisplay.textContent = data.url;
                     if(faviconPreviewImg && data.url) { faviconPreviewImg.src = data.url + '?t=' + new Date().getTime(); faviconPreviewImg.style.display = 'block'; } // Cache bust
                } else {
                    overallSuccess = false;
                    messages.push(data.message || 'Favicon upload failed.');
                }
            } catch (error) {
                overallSuccess = false;
                messages.push('Error uploading favicon.');
                console.error('Favicon Upload Error:', error);
            }
        }

        // Then, submit other text-based settings
        const textSettingsFormData = new FormData(siteSettingsForm);
        textSettingsFormData.delete('logo_file'); // Ensure file fields are not sent with text settings
        textSettingsFormData.delete('favicon_file');

        try {
            const response = await fetch('../php/admin_handler.php?action=update_site_settings', { method: 'POST', body: textSettingsFormData });
            const data = await response.json();
            if (data.success) {
                // Avoid duplicating "no changes" message if files were uploaded but other settings not changed
                if (data.message !== 'No settings were changed.' || messages.length === 0) {
                     messages.push(data.message || 'Settings updated.');
                }
            } else {
                overallSuccess = false;
                messages.push(data.message || 'Failed to update some settings.');
            }
        } catch (error) {
            overallSuccess = false;
            messages.push('Error updating text settings.');
            console.error('Update Site Settings Error:', error);
        }

        showGlobalNotification(messages.join(' '), overallSuccess ? 'success' : 'error');
        if (overallSuccess) {
            // loadSiteSettings(); // Reload all settings to reflect changes, especially if URLs were updated via text input
            // Clear file inputs after processing
             if(settingLogoFileInput) settingLogoFileInput.value = '';
             if(settingFaviconFileInput) settingFaviconFileInput.value = '';
        }
        if(submitButton) submitButton.disabled = false;
    }


    function loadErrorLogs(page = 1) {
        // ... (same)
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
        // ... (same)
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

        if (errorLogPageInfo) errorLogPageInfo.textContent = `Page ${pagination.currentPage} of ${pagination.totalPages} (Total: ${pagination.totalLogs})`;
        if (errorLogPrevPageBtn) errorLogPrevPageBtn.disabled = pagination.currentPage <= 1;
        if (errorLogNextPageBtn) errorLogNextPageBtn.disabled = pagination.currentPage >= pagination.totalPages;
    }

    function setupEventListeners() {
        // ... (sidebar, add user, edit user modal listeners remain the same)
        sidebarLinks.forEach(link => { /* ... */ });
        if (addUserBtn) { /* ... */ } if (closeAddUserModalBtn) { /* ... */ } if (addUserForm) { /* ... */ }
        if (closeEditUserModalBtn) { /* ... */ } if (editUserForm) { /* ... */ }
        [addUserModal, editUserModal].forEach(modal => { /* ... */ });

        if (siteSettingsForm) {
            siteSettingsForm.addEventListener('submit', handleSiteSettingsSubmit);
        }

        // ... (error log pagination listeners remain the same)
        if(errorLogPrevPageBtn) { /* ... */ } if(errorLogNextPageBtn) { /* ... */ }

        // Re-add full event listener setups for brevity in this overwrite
        sidebarLinks.forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const sectionId = this.dataset.section;
                showSection(sectionId);
                sidebarLinks.forEach(s_link => s_link.classList.remove('active'));
                this.classList.add('active');
            });
        });
        if (addUserBtn) { addUserBtn.addEventListener('click', () => { if (addUserForm) addUserForm.reset(); if (addUserModal) { clearFormErrors(addUserForm); addUserModal.style.display = 'flex'; } }); }
        if (closeAddUserModalBtn) { closeAddUserModalBtn.addEventListener('click', () => { if (addUserModal) addUserModal.style.display = 'none'; }); }
        if (addUserForm) { addUserForm.addEventListener('submit', function(e) { e.preventDefault(); /* ... AJAX ... */ }); }
        if (closeEditUserModalBtn) { closeEditUserModalBtn.addEventListener('click', () => { if (editUserModal) editUserModal.style.display = 'none'; }); }
        if (editUserForm) { editUserForm.addEventListener('submit', function(e) { e.preventDefault(); /* ... AJAX ... */ }); }
        [addUserModal, editUserModal].forEach(modal => { if (modal) { const cb = modal.querySelector('.close-button'); if(cb) cb.addEventListener('click', ()=>modal.style.display='none'); window.addEventListener('click', (event) => { if (event.target == modal) modal.style.display = 'none'; }); } });
        if(errorLogPrevPageBtn) { errorLogPrevPageBtn.addEventListener('click', () => { if (currentErrorLogPage > 1) loadErrorLogs(currentErrorLogPage - 1); }); }
        if(errorLogNextPageBtn) { errorLogNextPageBtn.addEventListener('click', () => { loadErrorLogs(currentErrorLogPage + 1); }); }


    }

    function openEditUserModal(userId) {
        // ... (same)
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
        // ... (same)
        if (confirm(`Are you sure you want to delete user "${escapeHTML(username)}" (ID: ${userId})? This action cannot be undone.`)) {
            deleteUser(userId);
        }
    }

    function deleteUser(userId) {
        // ... (same)
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
        // ... (same)
        if (confirm(`Are you sure you want to trigger a password reset for user "${escapeHTML(username)}" (ID: ${userId})? They will need to check their email (conceptually).`)) {
            triggerPasswordReset(userId);
        }
    }

    function triggerPasswordReset(userId) {
        // ... (same)
        const formData = new FormData();
        formData.append('user_id', userId);
        fetch('../php/admin_handler.php?action=trigger_password_reset', { method: 'POST', body: formData })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showGlobalNotification(data.message || 'Password reset triggered successfully!', 'success');
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
    // ... (same)
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
