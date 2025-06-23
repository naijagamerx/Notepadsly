document.addEventListener('DOMContentLoaded', function() {
    // --- DOM Elements ---
    // ... (all existing DOM elements from previous overwrite, including sharePermissionInput) ...
    const usernameDisplay = document.getElementById('usernameDisplay');
    const adminLinkContainer = document.getElementById('adminLinkContainer');
    const newNoteBtn = document.getElementById('newNoteBtn');
    const newFolderBtn = document.getElementById('newFolderBtn');
    const folderListUl = document.getElementById('folderList');
    const tagListUl = document.getElementById('tagList');
    const noteListUl = document.getElementById('noteList');
    const noteTitleInput = document.getElementById('noteTitleInput');
    const noteContentTextarea = document.getElementById('noteContentTextarea');
    const noteFolderSelect = document.getElementById('noteFolderSelect');
    const saveNoteBtn = document.getElementById('saveNoteBtn');
    const deleteNoteBtn = document.getElementById('deleteNoteBtn');
    const shareNoteBtn = document.getElementById('shareNoteBtn');
    const downloadNoteBtn = document.getElementById('downloadNoteBtn');
    const qrCodeNoteBtn = document.getElementById('qrCodeNoteBtn');
    const searchNotesInput = document.getElementById('searchNotes');
    const newFolderModal = document.getElementById('newFolderModal');
    const closeNewFolderModalBtn = newFolderModal ? newFolderModal.querySelector('.close-button[data-modal-id="newFolderModal"]') : null;
    const newFolderNameInput = document.getElementById('newFolderNameInput');
    const confirmNewFolderBtn = document.getElementById('confirmNewFolderBtn');
    const renameFolderModal = document.getElementById('renameFolderModal');
    const closeRenameFolderModalBtn = renameFolderModal ? renameFolderModal.querySelector('.close-button[data-modal-id="renameFolderModal"]') : null;
    const renameFolderNameInput = document.getElementById('renameFolderNameInput');
    const renameFolderIdInput = document.getElementById('renameFolderIdInput');
    const confirmRenameFolderBtn = document.getElementById('confirmRenameFolderBtn');
    const noteEditorPanel = document.querySelector('.note-editor-panel');
    const editorContentWrapper = noteEditorPanel ? noteEditorPanel.querySelector('.content-wrapper') : null;
    const noteTagsInput = document.getElementById('noteTagsInput');
    const currentNoteTagsDisplay = document.getElementById('currentNoteTagsDisplay');
    const tagSuggestionsUl = document.getElementById('tagSuggestions');
    const noteLastUpdated = document.getElementById('noteLastUpdated');
    const shareNoteModal = document.getElementById('shareNoteModal');
    const shareNoteForm = document.getElementById('shareNoteForm');
    const closeShareNoteModalBtn = shareNoteModal ? shareNoteModal.querySelector('.close-button[data-modal-id="shareNoteModal"]') : null;
    const shareNoteIdInput = document.getElementById('shareNoteIdInput');
    const shareWithUserInput = document.getElementById('shareWithUserInput');
    const sharePermissionInput = document.getElementById('sharePermissionInput'); // For new shares
    const currentlySharedWithListUl = document.getElementById('currentlySharedWithList');
    const noSharedUsersMsgLi = document.getElementById('noSharedUsersMsg');
    const formatBoldBtn = document.getElementById('formatBoldBtn');
    const formatItalicBtn = document.getElementById('formatItalicBtn');
    const formatUnderlineBtn = document.getElementById('formatUnderlineBtn');
    const mobileNewNoteBtn = document.getElementById('mobileNewNoteBtn');
    const mobileToggleSidebarBtn = document.getElementById('mobileToggleSidebarBtn');
    const mobileSearchBtn = document.getElementById('mobileSearchBtn');
    const mobileUserBtn = document.getElementById('mobileUserBtn');
    const mobileFooterIcons = document.querySelectorAll('.mobile-footer-menu .footer-icon');
    const sidebar = document.querySelector('.sidebar');
    const noteListPanel = document.querySelector('.note-list-panel');
    const appBody = document.body;
    const workOfflineToggle = document.getElementById('workOfflineToggle');
    const offlineModeIndicator = document.getElementById('offlineModeIndicator');
    const syncToServerBtn = document.createElement('button');
    syncToServerBtn.id = 'syncToServerBtn';
    syncToServerBtn.textContent = 'Sync Offline Notes';
    syncToServerBtn.classList.add('button', 'button-primary');
    syncToServerBtn.style.display = 'none';
    syncToServerBtn.style.marginLeft = '10px';
    const qrCodeModal = document.getElementById('qrCodeModal');
    const closeQrCodeModalBtn = qrCodeModal ? qrCodeModal.querySelector('.close-button') : null;
    const qrCodeCanvasContainer = document.getElementById('qrCodeCanvasContainer');
    const qrCodeUrlDisplay = document.getElementById('qrCodeUrlDisplay');
    const copyQrCodeUrlBtn = document.getElementById('copyQrCodeUrlBtn');
    let qrCodeInstance = null;

    const LOCAL_STORAGE_PREFIX = 'notepadsly_offline_note_';
    const LOCAL_STORAGE_NEW_NOTES_INDEX_KEY = 'notepadsly_new_offline_notes_index';

    // --- State Variables ---
    let currentNoteId = null;
    let currentNoteIsOwnedByUser = true;
    let currentNotePermission = 'edit';
    let currentNoteTags = [];
    let activeFilterTags = [];
    let currentUser = null;
    let allNotes = [];
    let allFolders = [];
    let allUserUniqueTags = [];
    let currentMobileView = 'list';
    let isOfflineMode = false;

    // --- Initialization & Core Data Functions ---
    // ... (initializeDashboard, handleDeepLinking, local storage helpers, fetchUserData, loadInitialData remain as previously defined) ...
    function initializeDashboard() { /* ... same ... */ }
    function handleDeepLinking() { /* ... same ... */ }
    function getNewOfflineNotesIndex() { /* ... same ... */ } function setNewOfflineNotesIndex(index) { /* ... same ... */ }
    function addTempIdToNewOfflineNotesIndex(tempId) { /* ... same ... */ } function removeTempIdFromNewOfflineNotesIndex(tempId) { /* ... same ... */ }
    function saveNoteToLocalStorage(noteId, title, content, tags, folderId = null, isNew = false) { /* ... same ... */ }
    function loadNoteFromLocalStorage(noteIdOrTempId) { /* ... same ... */ } function removeNoteFromLocalStorage(noteIdOrTempId) { /* ... same ... */ }
    function getAllLocalNotes() { /* ... same ... */ } function updateSyncToServerButtonVisibility() { /* ... same ... */ }
    async function syncAllOfflineNotesToServer() { /* ... same ... */ }
    function fetchUserData() { /* ... same ... */ } function loadInitialData(callback) {  /* ... same ... */ }

    // --- Rendering Functions ---
    // ... (renderFolders, renderTagsSidebar, renderCurrentNoteTags, renderNoteList, setActiveNoteListItem, setActiveFolderListItem remain as previously defined) ...
    function renderFolders(folders) { /* ... same ... */ } function renderTagsSidebar(tags) { /* ... same ... */ }
    function renderCurrentNoteTags() { /* ... same (already hides remove button based on editor read-only state) ... */ }
    function renderNoteList(notesToRender) { /* ... same (already shows shared status with permission) ... */
        if (!noteListUl) return; noteListUl.innerHTML = '';
        if (notesToRender.length === 0) { noteListUl.innerHTML = '<li class="no-notes-message">No notes found.</li>'; return; }
        notesToRender.forEach(note => {
            const li = document.createElement('li'); li.classList.add('note-item'); li.dataset.noteId = note.id;
            const date = new Date(note.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            let titleHTML = `<h4>${escapeHTML(note.title) || 'Untitled Note'}</h4>`;
            const localVersion = loadNoteFromLocalStorage(note.id); const serverUpdatedAt = note.updated_at ? new Date(note.updated_at).getTime() : 0;
            let syncStatusIndicator = '';
            if (note.syncStatus === 'syncing') syncStatusIndicator = `<small class="sync-indicator syncing">(Syncing...)</small>`;
            else if (note.syncStatus === 'synced') syncStatusIndicator = `<small class="sync-indicator synced">(Synced &#10004;)</small>`;
            else if (note.syncStatus === 'error') syncStatusIndicator = `<small class="sync-indicator error">(Sync Error!)</small>`;
            else if (note.note_status === 'shared') { titleHTML += `<small class="shared-indicator">(Shared by ${escapeHTML(note.shared_by_username)} - ${escapeHTML(note.permission)})</small>`; li.classList.add('shared-note-item'); }
            else if (note.note_status === 'local_new' || (note.isLocalNew && note.id.startsWith('temp_offline_'))) { titleHTML += `<small class="offline-indicator">(Offline New)</small>`; li.classList.add('local-new-note-item'); }
            else if (localVersion && localVersion.last_saved_offline > serverUpdatedAt) { titleHTML += `<small class="offline-indicator">(Offline changes)</small>`; li.classList.add('local-modified-note-item'); }
            titleHTML += syncStatusIndicator;
            li.innerHTML = `${titleHTML}<p>${escapeHTML(note.snippet) || 'No additional text'}</p><small>${date}</small>`;
            li.addEventListener('click', () => { loadNoteIntoEditor(note.id); setActiveNoteListItem(note.id); if (window.innerWidth <= 768) setMobileView('editor'); });
            noteListUl.appendChild(li); });
    }
    function setActiveNoteListItem(noteId) { /* ... same ... */ } function setActiveFolderListItem(folderIdOrAll) { /* ... same ... */ }

    // --- Editor Functions ---
    // ... (loadNoteIntoEditor, updateEditorState, saveCurrentNote, syncTagsForNote, deleteCurrentNote remain as previously defined, with updates for permissions) ...
    function loadNoteIntoEditor(noteId) { /* ... same ... */ }
    function updateEditorState(noteData) { /* ... (already handles edit permissions for disabling fields) ... */
        if (!noteEditorPanel || !editorContentWrapper) return;
        const isNewTrulyOfflineNote = noteData && noteData.isLocalNew && noteData.id && noteData.id.startsWith('temp_offline_');
        if (noteData && (noteData.id || isNewTrulyOfflineNote)) {
            noteEditorPanel.classList.remove('empty'); editorContentWrapper.style.display = 'flex';
            currentNoteId = noteData.id || null;
            currentNoteIsOwnedByUser = (!noteData.note_status || noteData.note_status === 'owner' || noteData.note_status === 'local_new' || (noteData.owner_user_id && currentUser && noteData.owner_user_id == currentUser.user_id) );
            currentNotePermission = currentNoteIsOwnedByUser ? 'edit' : (noteData.permission || 'read');
            if (noteTitleInput) noteTitleInput.value = noteData.title || ''; if (noteContentTextarea) noteContentTextarea.value = noteData.content || '';
            if (noteFolderSelect) noteFolderSelect.value = noteData.folder_id || "";
            currentNoteTags = noteData.tags || []; renderCurrentNoteTags(); if (noteTagsInput) noteTagsInput.value = '';
            if (noteLastUpdated) { noteLastUpdated.textContent = `Last updated: ${isNewTrulyOfflineNote ? 'Locally (unsynced)' : (noteData.updated_at ? new Date(noteData.updated_at).toLocaleString() : 'N/A')}`; }
            const isEffectivelyReadOnly = !currentNoteIsOwnedByUser && currentNotePermission === 'read';
            if (noteTitleInput) noteTitleInput.disabled = isEffectivelyReadOnly; if (noteContentTextarea) noteContentTextarea.disabled = isEffectivelyReadOnly;
            if (noteFolderSelect) noteFolderSelect.disabled = isEffectivelyReadOnly || !currentNoteIsOwnedByUser;
            if (noteTagsInput) noteTagsInput.disabled = isEffectivelyReadOnly;
            currentNoteTagsDisplay.querySelectorAll('.remove-tag-btn').forEach(btn => btn.style.display = isEffectivelyReadOnly ? 'none' : 'inline');
            if (saveNoteBtn) saveNoteBtn.style.display = isEffectivelyReadOnly ? 'none' : 'inline-block';
            if (shareNoteBtn) shareNoteBtn.style.display = (!currentNoteId || isNewTrulyOfflineNote || !currentNoteIsOwnedByUser) ? 'none' : 'inline-block';
            if (deleteNoteBtn) deleteNoteBtn.style.display = (!currentNoteId || isNewTrulyOfflineNote || !currentNoteIsOwnedByUser) ? 'none' : 'inline-block';
            if (qrCodeNoteBtn) qrCodeNoteBtn.style.display = (!currentNoteId || isNewTrulyOfflineNote || !currentNoteIsOwnedByUser) ? 'none' : 'inline-block';
            if (downloadNoteBtn) downloadNoteBtn.style.display = (currentNoteId || isNewTrulyOfflineNote) ? 'inline-block' : 'none';
        } else { /* ... empty state ... */
            noteEditorPanel.classList.add('empty'); editorContentWrapper.style.display = 'none';
            if (noteTitleInput) noteTitleInput.value = ''; if (noteContentTextarea) noteContentTextarea.value = '';
            if (noteFolderSelect) noteFolderSelect.value = ""; currentNoteId = null; currentNoteIsOwnedByUser = true; currentNotePermission = 'edit';
            currentNoteTags = []; renderCurrentNoteTags(); if (noteTagsInput) noteTagsInput.value = '';
            if (noteLastUpdated) noteLastUpdated.textContent = 'Last updated: N/A';
            if (noteTitleInput) noteTitleInput.disabled = false; if (noteContentTextarea) noteContentTextarea.disabled = false;
            if (noteFolderSelect) noteFolderSelect.disabled = false; if (noteTagsInput) noteTagsInput.disabled = false;
            if (saveNoteBtn) saveNoteBtn.style.display = 'inline-block'; if (shareNoteBtn) shareNoteBtn.style.display = 'none';
            if (deleteNoteBtn) deleteNoteBtn.style.display = 'none'; if (qrCodeNoteBtn) qrCodeNoteBtn.style.display = 'none';
            if (downloadNoteBtn) downloadNoteBtn.style.display = 'none';
        }
        updateSyncToServerButtonVisibility();
    }
    function saveCurrentNote() { /* ... same ... */ }
    function syncTagsForNote(noteId, tagsArray) { /* ... same ... */ }
    function deleteCurrentNote() { /* ... same ... */ }

    // --- Event Listeners Setup ---
    function setupEventListeners() { /* ... (all previous listeners, including shareNoteForm) ... */
        if (shareNoteForm) {
            shareNoteForm.addEventListener('submit', function(e) {
                e.preventDefault();
                const formData = new FormData(shareNoteForm); // This will include the new permission dropdown
                // Note ID is already in shareNoteIdInput.value
                formData.append('note_id', shareNoteIdInput.value);

                fetch('../php/dashboard.php?action=share_note', { method: 'POST', body: formData })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        showGlobalNotification(data.message || 'Share action processed!', 'success');
                        // if (shareNoteModal) shareNoteModal.style.display = 'none'; // Keep modal open to see updated list
                        loadSharedWithUsers(shareNoteIdInput.value); // Refresh list of shared users
                        loadInitialData(); // To reflect potential changes in note list (e.g. if permissions changed how it appears)
                    } else {
                        showGlobalNotification(data.message || 'Failed to process share action.', 'error');
                    }
                })
                .catch(error => {
                    console.error('Share Note Error:', error);
                    showGlobalNotification('An error occurred while processing the share action.', 'error');
                });
            });
        }
        // ... (all other existing event listeners from previous full file overwrite)
    }

    // --- Share Modal Specific Functions ---
    function openShareModal() { /* ... same ... */ }
    function loadSharedWithUsers(noteId) {
        if (!currentlySharedWithListUl || !noSharedUsersMsgLi) return;

        fetch(`../php/dashboard.php?action=get_shared_with_users&note_id=${noteId}`)
            .then(response => response.json())
            .then(data => {
                currentlySharedWithListUl.innerHTML = '';
                if (data.success && data.shared_users && data.shared_users.length > 0) {
                    noSharedUsersMsgLi.style.display = 'none';
                    data.shared_users.forEach(sharedUser => {
                        const li = document.createElement('li');
                        li.dataset.sharedUserId = sharedUser.user_id; // Store user ID for updates

                        const userInfoSpan = document.createElement('span');
                        userInfoSpan.textContent = `${escapeHTML(sharedUser.username)}`;

                        const permissionSelect = document.createElement('select');
                        permissionSelect.classList.add('share-permission-select-existing');
                        permissionSelect.innerHTML = `
                            <option value="read" ${sharedUser.permission === 'read' ? 'selected' : ''}>Read-Only</option>
                            <option value="edit" ${sharedUser.permission === 'edit' ? 'selected' : ''}>Edit</option>
                        `;

                        const updatePermissionBtn = document.createElement('button');
                        updatePermissionBtn.classList.add('button', 'button-primary', 'update-permission-btn'); // Added button-primary
                        updatePermissionBtn.textContent = 'Update';
                        updatePermissionBtn.style.marginLeft = '10px';
                        updatePermissionBtn.addEventListener('click', () => {
                            updateSharePermission(noteId, sharedUser.user_id, permissionSelect.value, sharedUser.username);
                        });

                        const revokeBtn = document.createElement('button');
                        revokeBtn.classList.add('revoke-share-btn', 'button');
                        revokeBtn.textContent = 'Revoke';
                        revokeBtn.addEventListener('click', () => {
                            confirmRevokeAccess(noteId, sharedUser.user_id, sharedUser.username);
                        });

                        li.appendChild(userInfoSpan);
                        li.appendChild(permissionSelect);
                        li.appendChild(updatePermissionBtn);
                        li.appendChild(revokeBtn);
                        currentlySharedWithListUl.appendChild(li);
                    });
                } else if (data.success) {
                    noSharedUsersMsgLi.style.display = 'block';
                    noSharedUsersMsgLi.textContent = 'Not shared with anyone yet.';
                } else {
                    noSharedUsersMsgLi.textContent = 'Could not load shared users.';
                    noSharedUsersMsgLi.style.display = 'block';
                    showGlobalNotification(data.message || 'Failed to load shared user list.', 'error');
                }
            })
            .catch(error => {
                console.error('Error loading shared users:', error);
                noSharedUsersMsgLi.textContent = 'Error loading shared users.';
                noSharedUsersMsgLi.style.display = 'block';
                showGlobalNotification('Error fetching shared user list.', 'error');
            });
    }

    function updateSharePermission(noteId, sharedUserIdToUpdate, newPermission, usernameToUpdate) {
        // Use the existing share_note endpoint; it handles updates if the share exists.
        // We need to provide the username/identifier for the share_note endpoint.
        // Since we have the username, we can use that.
        const formData = new FormData();
        formData.append('note_id', noteId);
        formData.append('share_with_user', usernameToUpdate); // Send username as identifier
        formData.append('permission', newPermission);

        fetch('../php/dashboard.php?action=share_note', { method: 'POST', body: formData })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showGlobalNotification(data.message || `Permission for ${usernameToUpdate} updated.`, 'success');
                    loadSharedWithUsers(noteId); // Refresh the list in the modal
                    loadInitialData(); // Refresh main list in case permissions affect display
                } else {
                    showGlobalNotification(data.message || 'Failed to update permission.', 'error');
                }
            })
            .catch(error => {
                console.error('Error updating share permission:', error);
                showGlobalNotification('An error occurred while updating permission.', 'error');
            });
    }

    function confirmRevokeAccess(noteId, sharedUserId, username) { /* ... same ... */ }
    function revokeAccess(noteId, sharedUserId) { /* ... same ... */ }

    // --- Other Functions (Folder, Tag, Search, Formatting, Mobile, Utilities) ---
    // ... (All these existing helper functions remain as previously defined) ...
    function createFolder(folderName) { /* ... */ } function openRenameFolderModal(folderId, currentName) { /* ... */ }
    function renameFolder(folderId, newName) { /* ... */ } function confirmDeleteFolder(folderId, folderName) { /* ... */ }
    function deleteFolder(folderId) { /* ... */ } function filterNotesByFolder(folderId) { /* ... */ }
    function filterNotesByActiveTags() { /* ... */ } function updateClearTagFiltersButton() { /* ... */ }
    function filterNotesBySearch(searchTerm) { /* ... */ } function applyMarkdownFormatting(prefix, suffix) { /* ... */ }
    function handleTagInput() { /* ... */ } function handleTagInputKeyDown(e) { /* ... */ }
    function updateSuggestionSelection(items) { /* ... */ } function addTagToCurrentNote(tagName) { /* ... */ }
    function checkScreenWidth() { /* ... */ } function setMobileView(viewName) { /* ... */ }
    function escapeHTML(str) { /* ... */ } function clearFormErrors(formElement) { /* ... */ }

    initializeDashboard();
});

let notificationTimeout;
function showGlobalNotification(message, type = 'info', duration = 3000) { /* ... same ... */ }
