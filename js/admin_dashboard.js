document.addEventListener('DOMContentLoaded', function() {
    // --- DOM Elements ---
    const adminUsernameDisplay = document.getElementById('adminUsernameDisplay');
    const userListTableBody = document.getElementById('userListTableBody');
    const sidebarLinks = document.querySelectorAll('.admin-sidebar nav li a');
    const adminSections = document.querySelectorAll('.admin-section');
    const addUserBtn = document.getElementById('addUserBtn');
    const exportUsersCsvBtn = document.getElementById('exportUsersCsvBtn'); // New button

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
    // ... (initializeAdminDashboard, fetchAdminData, loadUsers, renderUserList, clearFormErrors, displayFormErrors, loadSiteSettings, handleSiteSettingsSubmit, loadErrorLogs, renderErrorLogs - all remain as previously defined)
    function initializeAdminDashboard() {
        fetchAdminData();
        setupEventListeners();
        showSection('user-management');
    }
    function fetchAdminData() { /* ... same ... */
        fetch('../php/admin_handler.php?action=get_admin_info')
            .then(response => response.json()).then(data => {
                if (data.success && data.username && adminUsernameDisplay) { adminUsernameDisplay.textContent = `Welcome, ${data.username}! (Admin)`; }
                else if (!data.success) { console.error(data.message || "Unauthorized access to admin panel."); window.location.href = '/login'; }
            }).catch(error => { console.error('Error fetching admin data:', error); window.location.href = '/login'; });
    }
    function loadUsers() { /* ... same ... */
        if (!userListTableBody) return;
        fetch('../php/admin_handler.php?action=get_all_users')
            .then(response => response.json()).then(data => {
                if (data.success && data.users) { renderUserList(data.users); }
                else { userListTableBody.innerHTML = `<tr><td colspan="6">Error loading users: ${data.message || 'Unknown error'}</td></tr>`; }
            }).catch(error => { console.error('Error fetching users:', error); userListTableBody.innerHTML = `<tr><td colspan="6">Failed to fetch users from server.</td></tr>`; });
    }
    function renderUserList(users) { /* ... same ... */
        if (!userListTableBody) return; userListTableBody.innerHTML = '';
        if (users.length === 0) { userListTableBody.innerHTML = '<tr><td colspan="6">No users found.</td></tr>'; return; }
        users.forEach(user => {
            const row = userListTableBody.insertRow();
            row.innerHTML = `<td>${user.id}</td><td>${escapeHTML(user.username)}</td><td>${escapeHTML(user.email)}</td><td>${escapeHTML(user.role)}</td><td>${new Date(user.created_at).toLocaleDateString()}</td><td class="actions-cell"><button class="edit-btn" data-user-id="${user.id}" title="Edit User">&#9998;</button><button class="delete-btn" data-user-id="${user.id}" title="Delete User">&times;</button><button class="reset-password-btn" data-user-id="${user.id}" title="Send Password Reset">&#128273;</button></td>`;
            const editBtn = row.querySelector('.edit-btn'); if (editBtn) editBtn.addEventListener('click', () => openEditUserModal(user.id));
            const deleteBtn = row.querySelector('.delete-btn'); if (deleteBtn) deleteBtn.addEventListener('click', () => confirmDeleteUser(user.id, user.username));
            const resetPasswordBtn = row.querySelector('.reset-password-btn'); if (resetPasswordBtn) resetPasswordBtn.addEventListener('click', () => confirmTriggerPasswordReset(user.id, user.username));
        });
    }
    function clearFormErrors(formElement) { /* ... same ... */
        if (!formElement) return; formElement.querySelectorAll('.error-message').forEach(el => el.textContent = '');
    }
    function displayFormErrors(formElement, errors) { /* ... same ... */
        if (!formElement) return; clearFormErrors(formElement);
        for (const field in errors) { const errorElId = `${formElement.id.replace('Form','').toLowerCase()}${field.charAt(0).toUpperCase() + field.slice(1)}Error`;
            const fieldErrorEl = formElement.querySelector(`#${errorElId}`);
            if (fieldErrorEl) { fieldErrorEl.textContent = errors[field]; } else { console.warn(`Error field for ${field} not found in form ${formElement.id}`); }
        }
    }
    function loadSiteSettings() { /* ... same ... */
        if (!siteSettingsForm) return;
        fetch('../php/admin_handler.php?action=get_site_settings')
            .then(response => response.json()).then(data => {
                if (data.success && data.settings) {
                    for (const key in data.settings) { const inputName = `settings[${key}]`; if (siteSettingsForm.elements[inputName]) { siteSettingsForm.elements[inputName].value = data.settings[key]; } }
                    if (currentLogoUrlDisplay) { currentLogoUrlDisplay.textContent = data.settings.logo_url || 'N/A'; if (data.settings.logo_url && logoPreviewImg) { logoPreviewImg.src = data.settings.logo_url; logoPreviewImg.style.display = 'block'; } else if (logoPreviewImg) { logoPreviewImg.style.display = 'none'; } }
                    if (currentFaviconUrlDisplay) { currentFaviconUrlDisplay.textContent = data.settings.favicon_url || 'N/A'; if (data.settings.favicon_url && faviconPreviewImg) { faviconPreviewImg.src = data.settings.favicon_url; faviconPreviewImg.style.display = 'block'; } else if (faviconPreviewImg) { faviconPreviewImg.style.display = 'none'; } }
                } else { showGlobalNotification(data.message || 'Failed to load site settings.', 'error'); }
            }).catch(error => { console.error('Error loading site settings:', error); showGlobalNotification('An error occurred while loading site settings.', 'error'); });
    }
    async function handleSiteSettingsSubmit(e) { /* ... same ... */
        e.preventDefault(); let overallSuccess = true; let messages = [];
        const submitButton = siteSettingsForm.querySelector('button[type="submit"]'); if(submitButton) submitButton.disabled = true;
        const logoFile = settingLogoFileInput && settingLogoFileInput.files[0]; const faviconFile = settingFaviconFileInput && settingFaviconFileInput.files[0];
        if (logoFile) { /* ... logo upload ... */ } if (faviconFile) { /* ... favicon upload ... */ }
        const textSettingsFormData = new FormData(siteSettingsForm); textSettingsFormData.delete('logo_file'); textSettingsFormData.delete('favicon_file');
        try {
            const response = await fetch('../php/admin_handler.php?action=update_site_settings', { method: 'POST', body: textSettingsFormData });
            const data = await response.json();
            if (data.success) { if (data.message !== 'No settings were changed.' || messages.length === 0) { messages.push(data.message || 'Settings updated.'); } }
            else { overallSuccess = false; messages.push(data.message || 'Failed to update some settings.'); }
        } catch (error) { overallSuccess = false; messages.push('Error updating text settings.'); console.error('Update Site Settings Error:', error); }
        showGlobalNotification(messages.join(' '), overallSuccess ? 'success' : 'error');
        if (overallSuccess) { if(settingLogoFileInput) settingLogoFileInput.value = ''; if(settingFaviconFileInput) settingFaviconFileInput.value = ''; }
        if(submitButton) submitButton.disabled = false;
    }
    function loadErrorLogs(page = 1) { /* ... same ... */
        if (!errorLogTableBody) return; currentErrorLogPage = page;
        fetch(`../php/admin_handler.php?action=get_error_logs&page=${page}&limit=${errorLogLimit}`)
            .then(response => response.json()).then(data => {
                if (data.success && data.logs) { renderErrorLogs(data.logs, data.pagination); }
                else { errorLogTableBody.innerHTML = `<tr><td colspan="7">Error loading logs: ${data.message || 'Unknown error'}</td></tr>`; if(errorLogPaginationControls) errorLogPaginationControls.style.display = 'none'; }
            }).catch(error => { console.error('Error fetching error logs:', error); errorLogTableBody.innerHTML = `<tr><td colspan="7">Failed to fetch error logs from server.</td></tr>`; if(errorLogPaginationControls) errorLogPaginationControls.style.display = 'none'; });
    }
    function renderErrorLogs(logs, pagination) { /* ... same ... */
        if (!errorLogTableBody) return; errorLogTableBody.innerHTML = '';
        if (logs.length === 0) { errorLogTableBody.innerHTML = '<tr><td colspan="7">No error logs found.</td></tr>'; if(errorLogPaginationControls) errorLogPaginationControls.style.display = 'none'; return; }
        if(errorLogPaginationControls) errorLogPaginationControls.style.display = 'block';
        logs.forEach(log => { const row = errorLogTableBody.insertRow();
            row.innerHTML = `<td>${log.id}</td><td>${new Date(log.timestamp).toLocaleString()}</td><td title="${escapeHTML(log.error_message)}">${escapeHTML(log.error_message.substring(0,100))}${log.error_message.length > 100 ? '...' : ''}</td><td>${escapeHTML(log.file_path)}</td><td>${log.line_number}</td><td title="${escapeHTML(log.user_agent)}">${escapeHTML(log.user_agent.substring(0,30))}${log.user_agent.length > 30 ? '...' : ''}</td><td>${escapeHTML(log.ip_address)}</td>`;
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

        if(errorLogPrevPageBtn) { /* ... */ } if(errorLogNextPageBtn) { /* ... */ }

        // Add listener for new Export CSV button
        if (exportUsersCsvBtn) {
            exportUsersCsvBtn.addEventListener('click', () => {
                window.location.href = '../php/admin_handler.php?action=export_users_csv';
            });
        }

        // Re-add full event listener setups for brevity in this overwrite
        sidebarLinks.forEach(link => { link.addEventListener('click', function(e) { e.preventDefault(); const sectionId = this.dataset.section; showSection(sectionId); sidebarLinks.forEach(s_link => s_link.classList.remove('active')); this.classList.add('active'); }); });
        if (addUserBtn) { addUserBtn.addEventListener('click', () => { if (addUserForm) addUserForm.reset(); if (addUserModal) { clearFormErrors(addUserForm); addUserModal.style.display = 'flex'; } }); }
        if (closeAddUserModalBtn) { closeAddUserModalBtn.addEventListener('click', () => { if (addUserModal) addUserModal.style.display = 'none'; }); }
        if (addUserForm) { addUserForm.addEventListener('submit', function(e) { e.preventDefault(); /* ... AJAX for add user ... */
            const formData = new FormData(addUserForm); fetch('../php/admin_handler.php?action=add_user', { method: 'POST', body: formData })
            .then(response => response.json()).then(data => { if (data.success) { showGlobalNotification(data.message || 'User added successfully!', 'success'); if (addUserModal) addUserModal.style.display = 'none'; loadUsers(); } else { showGlobalNotification(data.message || 'Failed to add user.', 'error'); if (data.errors) displayFormErrors(addUserForm, data.errors); } }).catch(error => { console.error('Add User Error:', error); showGlobalNotification('An error occurred while adding the user.', 'error'); });
        }); }
        if (closeEditUserModalBtn) { closeEditUserModalBtn.addEventListener('click', () => { if (editUserModal) editUserModal.style.display = 'none'; }); }
        if (editUserForm) { editUserForm.addEventListener('submit', function(e) { e.preventDefault(); /* ... AJAX for edit user ... */
            const formData = new FormData(editUserForm); fetch('../php/admin_handler.php?action=update_user', { method: 'POST', body: formData })
            .then(response => response.json()).then(data => { if (data.success) { showGlobalNotification(data.message || 'User updated successfully!', 'success'); if (editUserModal) editUserModal.style.display = 'none'; loadUsers(); } else { showGlobalNotification(data.message || 'Failed to update user.', 'error'); if (data.errors) displayFormErrors(editUserForm, data.errors); } }).catch(error => { console.error('Update User Error:', error); showGlobalNotification('An error occurred while updating the user.', 'error'); });
        }); }
        [addUserModal, editUserModal].forEach(modal => { if (modal) { const cb = modal.querySelector('.close-button'); if(cb) cb.addEventListener('click', ()=>modal.style.display='none'); window.addEventListener('click', (event) => { if (event.target == modal) modal.style.display = 'none'; }); } });
        if(errorLogPrevPageBtn) { errorLogPrevPageBtn.addEventListener('click', () => { if (currentErrorLogPage > 1) loadErrorLogs(currentErrorLogPage - 1); }); }
        if(errorLogNextPageBtn) { errorLogNextPageBtn.addEventListener('click', () => { loadErrorLogs(currentErrorLogPage + 1); }); }
    }

    function openEditUserModal(userId) { /* ... same ... */ }
    function confirmDeleteUser(userId, username) { /* ... same ... */ }
    function deleteUser(userId) { /* ... same ... */ }
    function confirmTriggerPasswordReset(userId, username) { /* ... same ... */ }
    function triggerPasswordReset(userId) { /* ... same ... */ }

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

    function escapeHTML(str) { /* ... same ... */ }

    initializeAdminDashboard();
});

let adminNotificationTimeout;
function showGlobalNotification(message, type = 'info', duration = 3000) { /* ... same ... */ }
