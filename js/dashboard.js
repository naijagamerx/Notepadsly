document.addEventListener('DOMContentLoaded', function() {
    // --- DOM Elements ---
    // ... (all existing DOM elements from previous overwrite) ...
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
    const qrCodeNoteBtn = document.getElementById('qrCodeNoteBtn'); // New
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

    // QR Code Modal Elements
    const qrCodeModal = document.getElementById('qrCodeModal');
    const closeQrCodeModalBtn = qrCodeModal ? qrCodeModal.querySelector('.close-button') : null;
    const qrCodeCanvasContainer = document.getElementById('qrCodeCanvasContainer');
    const qrCodeUrlDisplay = document.getElementById('qrCodeUrlDisplay');
    const copyQrCodeUrlBtn = document.getElementById('copyQrCodeUrlBtn');
    let qrCodeInstance = null; // To hold the QRCode object


    const LOCAL_STORAGE_PREFIX = 'notepadsly_offline_note_';
    const LOCAL_STORAGE_NEW_NOTES_INDEX_KEY = 'notepadsly_new_offline_notes_index';

    // --- State Variables ---
    // ... (all existing state variables) ...
    let currentNoteId = null;
    let currentNoteIsSharedWithUser = false;
    let currentNoteTags = [];
    let activeFilterTags = [];
    let currentUser = null;
    let allNotes = [];
    let allFolders = [];
    let allUserUniqueTags = [];
    let currentMobileView = 'list';
    let isOfflineMode = false;

    // --- Initialization ---
    function initializeDashboard() {
        fetchUserData();
        loadInitialData(() => {
            handleDeepLinking(); // Process hash after notes are loaded
        });
        setupEventListeners();

        const savedOfflineMode = localStorage.getItem('notepadsly_offline_mode_enabled');
        isOfflineMode = savedOfflineMode === 'true';
        if(workOfflineToggle) workOfflineToggle.checked = isOfflineMode;
        if(offlineModeIndicator) offlineModeIndicator.style.display = isOfflineMode ? 'inline' : 'none';

        updateSyncToServerButtonVisibility();
        updateEditorState(null);
        if(document.getElementById('currentYear')) {
            document.getElementById('currentYear').textContent = new Date().getFullYear();
        }
        checkScreenWidth();
        window.addEventListener('resize', checkScreenWidth);
    }

    function handleDeepLinking() {
        if (window.location.hash && window.location.hash.startsWith('#note=')) {
            const noteIdFromHash = window.location.hash.substring('#note='.length);
            const noteToLoad = allNotes.find(n => n.id == noteIdFromHash && n.note_status !== 'local_new'); // Only link to server notes

            if (noteToLoad) {
                // If offline, and a local version exists and is newer, prompt as usual
                if (isOfflineMode) {
                    const localNote = loadNoteFromLocalStorage(noteIdFromHash);
                    if (localNote && localNote.last_saved_offline > new Date(noteToLoad.updated_at).getTime()) {
                        if (confirm("An offline version of the linked note is available and is newer. Load offline version?")) {
                             updateEditorState({
                                id: noteIdFromHash, title: localNote.title, content: localNote.content,
                                tags: localNote.tags || [], folder_id: localNote.folder_id || noteToLoad.folder_id,
                                updated_at: new Date(localNote.last_saved_offline).toISOString(),
                                note_status: noteToLoad.note_status, permission: noteToLoad.permission, isLocalNew: false
                            });
                            setActiveNoteListItem(noteIdFromHash);
                            if (window.innerWidth <= 768) setMobileView('editor');
                            window.location.hash = ''; // Clear hash
                            return; // Stop further processing for this note
                        }
                    }
                }
                // Default to loading server version or if user declined local
                loadNoteIntoEditor(noteIdFromHash);
                setActiveNoteListItem(noteIdFromHash);
                if (window.innerWidth <= 768) {
                    setMobileView('editor');
                }
            } else {
                showGlobalNotification("Linked note not found or is not accessible.", "error");
            }
            window.location.hash = ''; // Clear hash
        }
    }

    // --- Local Storage Functions ---
    // ... (getAllLocalNotes, saveNoteToLocalStorage, loadNoteFromLocalStorage, removeNoteFromLocalStorage,
    //      getNewOfflineNotesIndex, setNewOfflineNotesIndex, addTempIdToNewOfflineNotesIndex, removeTempIdFromNewOfflineNotesIndex,
    //      updateSyncToServerButtonVisibility, syncAllOfflineNotesToServer - all remain as previously defined) ...
    function getNewOfflineNotesIndex() {
        try {
            const indexJson = localStorage.getItem(LOCAL_STORAGE_NEW_NOTES_INDEX_KEY);
            return indexJson ? JSON.parse(indexJson) : [];
        } catch (e) { return []; }
    }
    function setNewOfflineNotesIndex(index) {
        try {
            localStorage.setItem(LOCAL_STORAGE_NEW_NOTES_INDEX_KEY, JSON.stringify(index));
        } catch (e) { console.error("Error saving new offline notes index:", e); }
    }
    function addTempIdToNewOfflineNotesIndex(tempId) {
        const index = getNewOfflineNotesIndex();
        if (!index.includes(tempId)) {
            index.push(tempId);
            setNewOfflineNotesIndex(index);
        }
    }
    function removeTempIdFromNewOfflineNotesIndex(tempId) {
        let index = getNewOfflineNotesIndex();
        index = index.filter(id => id !== tempId);
        setNewOfflineNotesIndex(index);
    }
    function saveNoteToLocalStorage(noteId, title, content, tags, folderId = null, isNew = false) {
        const key = isNew ? noteId : `${LOCAL_STORAGE_PREFIX}${noteId}`;
        const data = {
            id: noteId,
            title: title, content: content, tags: tags,
            folder_id: folderId, last_saved_offline: Date.now(),
            isLocalNew: isNew
        };
        try {
            localStorage.setItem(key, JSON.stringify(data));
            if (isNew) addTempIdToNewOfflineNotesIndex(noteId);
            updateSyncToServerButtonVisibility();
        } catch (e) {
            console.error("Error saving to localStorage:", e);
            showGlobalNotification("Could not save note locally. Storage might be full.", "error");
        }
    }
    function loadNoteFromLocalStorage(noteIdOrTempId) {
        const key = noteIdOrTempId.startsWith('temp_offline_') ? noteIdOrTempId : `${LOCAL_STORAGE_PREFIX}${noteIdOrTempId}`;
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (e) { console.error("Error loading from localStorage:", e); return null; }
    }
    function removeNoteFromLocalStorage(noteIdOrTempId) {
        const key = noteIdOrTempId.startsWith('temp_offline_') ? noteIdOrTempId : `${LOCAL_STORAGE_PREFIX}${noteIdOrTempId}`;
        try {
            localStorage.removeItem(key);
            if (noteIdOrTempId.startsWith('temp_offline_')) {
                removeTempIdFromNewOfflineNotesIndex(noteIdOrTempId);
            }
            updateSyncToServerButtonVisibility();
        } catch (e) { console.error("Error removing from localStorage:", e); }
    }
    function getAllLocalNotes() {
        const localNotes = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith(LOCAL_STORAGE_PREFIX) || key.startsWith('temp_offline_')) { // Check both prefixes
                try {
                    const noteData = JSON.parse(localStorage.getItem(key));
                    if (noteData) {
                        const serverNote = allNotes.find(n => n.id == noteData.id && n.note_status !== 'local_new' && !n.id.startsWith('temp_offline_'));
                        if (noteData.isLocalNew || !serverNote || (serverNote && noteData.last_saved_offline > new Date(serverNote.updated_at).getTime())) {
                            noteData.needsSync = true;
                        } else {
                            noteData.needsSync = false; // Explicitly set if not needing sync
                        }
                        localNotes.push(noteData);
                    }
                } catch (e) { console.error("Error parsing local note:", key, e); }
            }
        }
        return localNotes;
    }
    function updateSyncToServerButtonVisibility() {
        if (!syncToServerBtn) return;
        if (!isOfflineMode && getAllLocalNotes().some(n => n.needsSync)) {
            syncToServerBtn.style.display = 'inline-block';
        } else {
            syncToServerBtn.style.display = 'none';
        }
    }
    async function syncAllOfflineNotesToServer() {
        const localNotesToSync = getAllLocalNotes().filter(n => n.needsSync);
        let allSyncsSuccessful = true;
        let syncMessages = [];

        if (localNotesToSync.length === 0) {
            showGlobalNotification("No offline changes to sync.", "info");
            updateSyncToServerButtonVisibility();
            return;
        }
        showGlobalNotification("Syncing offline changes to server...", "info", 5000 + localNotesToSync.length * 1000);

        for (const localNote of localNotesToSync) {
            const isNewRealOfflineNote = localNote.id.startsWith('temp_offline_'); // True if it's a new note created offline
            let serverUrl = isNewRealOfflineNote ? '../php/dashboard.php?action=create_note' : '../php/dashboard.php?action=update_note';

            const formData = new FormData();
            formData.append('title', localNote.title);
            formData.append('content', localNote.content);
            if (localNote.folder_id) formData.append('folder_id', localNote.folder_id);

            if (!isNewRealOfflineNote) {
                formData.append('note_id', localNote.id);
            }

            try {
                const response = await fetch(serverUrl, { method: 'POST', body: formData });
                const result = await response.json();

                if (result.success) {
                    const syncedNoteId = result.note_id || localNote.id;
                    syncMessages.push(`Note "${localNote.title}" synced.`);

                    const tagsToSync = (localNote.tags || []).map(t => t.name);
                    const tagSyncData = await syncTagsForNote(syncedNoteId, tagsToSync);
                    if (!tagSyncData.success) {
                        syncMessages.push(`Tags for "${localNote.title}" failed to sync: ${tagSyncData.message}`);
                        allSyncsSuccessful = false;
                    }
                    removeNoteFromLocalStorage(localNote.id);
                } else {
                    allSyncsSuccessful = false;
                    syncMessages.push(`Failed to sync note "${localNote.title}": ${result.message}`);
                }
            } catch (error) {
                allSyncsSuccessful = false;
                syncMessages.push(`Error syncing note "${localNote.title}".`);
                console.error(`Error syncing note ${localNote.id}:`, error);
            }
        }
        showGlobalNotification(syncMessages.join('\n'), allSyncsSuccessful ? 'success' : 'error', 5000 + localNotesToSync.length * 1000);
        updateSyncToServerButtonVisibility();
    }


    // --- Core Data Functions (fetchUserData, loadInitialData) ---
    function fetchUserData() {
        fetch('../php/dashboard.php?action=get_user_info')
            .then(response => response.json())
            .then(data => {
                if (data.success && data.username && usernameDisplay) {
                    usernameDisplay.textContent = `Welcome, ${data.username}!`;
                    currentUser = data;
                    if (data.role === 'admin' && adminLinkContainer) {
                        adminLinkContainer.innerHTML = `<a href="/admin_dashboard" class="button button-secondary">Admin Panel</a>`;
                    }
                    if (usernameDisplay && usernameDisplay.parentNode && !document.getElementById('syncToServerBtn')) {
                         usernameDisplay.parentNode.insertBefore(syncToServerBtn, adminLinkContainer);
                    }
                } else if (!data.success) {
                    console.error('Failed to fetch user info:', data.message);
                }
            })
            .catch(error => {
                console.error('Error fetching user data:', error);
            });
    }
    function loadInitialData(callback) {
        fetch('../php/dashboard.php?action=get_initial_data')
            .then(response => response.json())
            .then(result => {
                if (result.success) {
                    allNotes = result.data.notes || [];
                    allFolders = result.data.folders || [];
                    allUserUniqueTags = result.data.tags || [];

                    const newOfflineNoteIds = getNewOfflineNotesIndex();
                    newOfflineNoteIds.forEach(tempId => {
                        const localNoteData = loadNoteFromLocalStorage(tempId);
                        if (localNoteData && !allNotes.some(n => n.id === tempId)) {
                            allNotes.unshift({
                                id: tempId,
                                title: localNoteData.title,
                                snippet: (localNoteData.content || "").substring(0,100),
                                tags: localNoteData.tags || [],
                                folder_id: localNoteData.folder_id || null,
                                updated_at: new Date(localNoteData.last_saved_offline).toISOString(),
                                note_status: 'local_new',
                                isLocalNew: true
                            });
                        }
                    });
                     allNotes.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

                    renderFolders(allFolders);
                    renderTagsSidebar(allUserUniqueTags);
                    renderNoteList(allNotes);

                    if (allNotes.length === 0) {
                         updateEditorState(null);
                    }
                    updateSyncToServerButtonVisibility();
                    if (callback) callback();
                } else {
                    console.error('Failed to load initial data:', result.message);
                    showGlobalNotification(result.message || 'Failed to load data.', 'error');
                    if (callback) callback();
                }
            })
            .catch(error => {
                console.error('Error loading initial data:', error);
                showGlobalNotification('Error loading initial data.', 'error');
                if (callback) callback();
            });
    }

    // --- Rendering Functions ---
    // ... (renderFolders, renderTagsSidebar, renderCurrentNoteTags, renderNoteList, setActiveNoteListItem, setActiveFolderListItem remain the same) ...
    function renderFolders(folders) { /* ... same ... */
        if (!folderListUl) return;
        folderListUl.innerHTML = '<li><a href="#" data-folder-id="all" class="active"><span>All Notes</span></a></li>';

        if (noteFolderSelect) {
            noteFolderSelect.innerHTML = '<option value="">Uncategorized</option>';
            folders.forEach(folder => {
                const option = document.createElement('option');
                option.value = folder.id;
                option.textContent = escapeHTML(folder.name);
                noteFolderSelect.appendChild(option);
            });
        }

        folders.forEach(folder => {
            const li = document.createElement('li');
            li.dataset.folderId = folder.id;
            li.innerHTML = `
                <a href="#" data-folder-id="${folder.id}">
                    <span>${escapeHTML(folder.name)}</span>
                    <span class="folder-item-actions">
                        <button class="edit-folder-btn" title="Rename folder">&#9998;</button>
                        <button class="delete-folder-btn" title="Delete folder">&times;</button>
                    </span>
                </a>`;

            const editBtn = li.querySelector('.edit-folder-btn');
            if(editBtn) editBtn.addEventListener('click', (e) => {
                e.stopPropagation(); e.preventDefault(); openRenameFolderModal(folder.id, folder.name);
            });
            const deleteBtn = li.querySelector('.delete-folder-btn');
            if(deleteBtn) deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation(); e.preventDefault(); confirmDeleteFolder(folder.id, folder.name);
            });
            folderListUl.appendChild(li);
        });

        const activeFolderLink = folderListUl.querySelector('a.active');
        if (!activeFolderLink && folderListUl.querySelector('a[data-folder-id="all"]')) {
             folderListUl.querySelector('a[data-folder-id="all"]').classList.add('active');
        } else if (activeFolderLink) {
            setActiveFolderListItem(activeFolderLink.dataset.folderId);
        }
    }
    function renderTagsSidebar(tags) { /* ... same ... */
        if (!tagListUl) return;
        tagListUl.innerHTML = '';
        if (tags.length === 0) {
            tagListUl.innerHTML = '<li><small>No tags yet.</small></li>';
            return;
        }
        tags.forEach(tag => {
            const li = document.createElement('li');
            const countDisplay = tag.note_count > 0 ? ` (${tag.note_count})` : '';
            li.innerHTML = `<a href="#" data-tag-id="${tag.id}" data-tag-name="${escapeHTML(tag.name)}" title="Filter by tag: ${escapeHTML(tag.name)}">#${escapeHTML(tag.name)} <span class="tag-count">${countDisplay}</span></a>`;
            tagListUl.appendChild(li);
        });
    }
    function renderCurrentNoteTags() { /* ... same ... */
        if (!currentNoteTagsDisplay) return;
        currentNoteTagsDisplay.innerHTML = '';
        currentNoteTags.forEach(tag => {
            const pill = document.createElement('span');
            pill.classList.add('tag-pill');
            pill.textContent = escapeHTML(tag.name);
            pill.dataset.tagId = tag.id;

            const removeBtn = document.createElement('button');
            removeBtn.classList.add('remove-tag-btn');
            removeBtn.innerHTML = '&times;';
            removeBtn.title = `Remove tag: ${escapeHTML(tag.name)}`;
            removeBtn.style.display = (currentNoteIsSharedWithUser && noteTitleInput && noteTitleInput.disabled) ? 'none' : 'inline';
            removeBtn.addEventListener('click', () => {
                currentNoteTags = currentNoteTags.filter(t => t.id !== tag.id || (t.id === null && t.name !== tag.name) );
                renderCurrentNoteTags();
            });
            pill.appendChild(removeBtn);
            currentNoteTagsDisplay.appendChild(pill);
        });
    }
    function renderNoteList(notesToRender) { /* ... updated for offline indicators ... */
        if (!noteListUl) return;
        noteListUl.innerHTML = '';
        if (notesToRender.length === 0) {
            noteListUl.innerHTML = '<li class="no-notes-message">No notes found.</li>';
            return;
        }
        notesToRender.forEach(note => {
            const li = document.createElement('li');
            li.classList.add('note-item');
            li.dataset.noteId = note.id;

            const date = new Date(note.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            let titleHTML = `<h4>${escapeHTML(note.title) || 'Untitled Note'}</h4>`;

            const localVersion = loadNoteFromLocalStorage(note.id);
            const serverUpdatedAt = note.updated_at ? new Date(note.updated_at).getTime() : 0;

            if (note.note_status === 'shared') {
                titleHTML += `<small class="shared-indicator">(Shared by ${escapeHTML(note.shared_by_username)})</small>`;
                li.classList.add('shared-note-item');
            } else if (note.note_status === 'local_new' || (note.isLocalNew && note.id.startsWith('temp_offline_'))) {
                titleHTML += `<small class="offline-indicator">(Offline New)</small>`;
                li.classList.add('local-new-note-item');
            } else if (localVersion && localVersion.last_saved_offline > serverUpdatedAt) {
                 titleHTML += `<small class="offline-indicator">(Offline changes)</small>`;
                 li.classList.add('local-modified-note-item');
            }

            li.innerHTML = `
                ${titleHTML}
                <p>${escapeHTML(note.snippet) || 'No additional text'}</p>
                <small>${date}</small>
            `;
            li.addEventListener('click', () => {
                loadNoteIntoEditor(note.id);
                setActiveNoteListItem(note.id);
                if (window.innerWidth <= 768) setMobileView('editor');
            });
            noteListUl.appendChild(li);
        });
    }
    function setActiveNoteListItem(noteId) { /* ... same ... */
        document.querySelectorAll('#noteList .note-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.noteId == noteId) {
                item.classList.add('active');
            }
        });
    }
    function setActiveFolderListItem(folderIdOrAll) { /* ... same ... */
        document.querySelectorAll('#folderList li a').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.folderId == folderIdOrAll) {
                item.classList.add('active');
            }
        });
    }

    // --- Editor Functions ---
    // ... (loadNoteIntoEditor, updateEditorState, saveCurrentNote, syncTagsForNote, deleteCurrentNote remain largely the same,
    //      but with updates for local storage interaction as shown in the previous full file overwrite) ...
    function loadNoteIntoEditor(noteId) { // noteId can be temp offline ID or real ID
        let noteToLoadDisplayData = allNotes.find(n => n.id == noteId);

        if (isOfflineMode) {
            const localNote = loadNoteFromLocalStorage(noteId);

            if (localNote) {
                const serverNoteFromCache = noteId.startsWith('temp_offline_') ? null : allNotes.find(n => n.id == noteId && n.note_status !== 'local_new');
                const serverUpdatedAt = serverNoteFromCache ? new Date(serverNoteFromCache.updated_at).getTime() : 0;

                if (localNote.isLocalNew || !serverNoteFromCache || localNote.last_saved_offline >= serverUpdatedAt ) { // >= to prefer local if timestamps are very close or identical
                    const useLocal = localNote.isLocalNew || !serverNoteFromCache || confirm("An offline version of this note is available and may be newer.\nLoad the offline version?");
                    if (useLocal) {
                        updateEditorState({
                            id: noteId,
                            title: localNote.title, content: localNote.content,
                            tags: localNote.tags || [], folder_id: localNote.folder_id || (serverNoteFromCache ? serverNoteFromCache.folder_id : null),
                            updated_at: new Date(localNote.last_saved_offline).toISOString(),
                            note_status: localNote.isLocalNew ? 'local_new' : (serverNoteFromCache ? serverNoteFromCache.note_status : 'owner'),
                            permission: serverNoteFromCache ? serverNoteFromCache.permission : null,
                            isLocalNew: localNote.isLocalNew
                        });
                        // showGlobalNotification("Loaded offline version.", "info"); // Can be noisy
                        return;
                    }
                }
            } else if (noteId.startsWith('temp_offline_')) {
                 updateEditorState(null); return;
            }
        }

        if (noteId.startsWith('temp_offline_')) {
            console.error("Attempted to load temp offline note from server (should have been caught by local load).");
            updateEditorState(null); return;
        }

        if (noteToLoadDisplayData) {
            fetch(`../php/dashboard.php?action=get_note_content&id=${noteToLoadDisplayData.id}`)
            .then(response => response.json())
            .then(result => {
                if (result.success && result.note) {
                    result.note.note_status = noteToLoadDisplayData.note_status || 'owner';
                    result.note.permission = noteToLoadDisplayData.permission || null;
                    result.note.shared_by_username = noteToLoadDisplayData.shared_by_username || null;
                    updateEditorState(result.note);
                } else {
                    showGlobalNotification(result.message || "Error loading note content.", 'error');
                    updateEditorState(null);
                }
            })
            .catch(err => {
                console.error("Error fetching note content:", err);
                showGlobalNotification("Error loading note content.", 'error');
                updateEditorState(null);
            });
        } else {
            console.warn(`Note with ID ${noteId} not found in allNotes for server loading.`);
            updateEditorState(null);
        }
    }
    function updateEditorState(noteData) {
        if (!noteEditorPanel || !editorContentWrapper) return;
        const isNewTrulyOfflineNote = noteData && noteData.isLocalNew && noteData.id.startsWith('temp_offline_');

        if (noteData && (noteData.id || isNewTrulyOfflineNote)) {
            noteEditorPanel.classList.remove('empty');
            editorContentWrapper.style.display = 'flex';
            currentNoteId = noteData.id || null;
            if (noteTitleInput) noteTitleInput.value = noteData.title || '';
            if (noteContentTextarea) noteContentTextarea.value = noteData.content || '';
            if (noteFolderSelect) noteFolderSelect.value = noteData.folder_id || "";
            currentNoteTags = noteData.tags || [];
            renderCurrentNoteTags();
            if (noteTagsInput) noteTagsInput.value = '';
            if (noteLastUpdated) {
                 noteLastUpdated.textContent = `Last updated: ${isNewTrulyOfflineNote ? 'Locally (unsynced)' : (noteData.updated_at ? new Date(noteData.updated_at).toLocaleString() : 'N/A')}`;
            }
            currentNoteIsSharedWithUser = (noteData.note_status === 'shared');
            const isReadOnly = currentNoteIsSharedWithUser && noteData.permission === 'read';
            if (noteTitleInput) noteTitleInput.disabled = isReadOnly;
            if (noteContentTextarea) noteContentTextarea.disabled = isReadOnly;
            if (noteFolderSelect) noteFolderSelect.disabled = isReadOnly;
            if (noteTagsInput) noteTagsInput.disabled = isReadOnly;
            currentNoteTagsDisplay.querySelectorAll('.remove-tag-btn').forEach(btn => btn.style.display = isReadOnly ? 'none' : 'inline');
            if (saveNoteBtn) saveNoteBtn.style.display = isReadOnly ? 'none' : 'inline-block';
            if (shareNoteBtn) shareNoteBtn.style.display = (currentNoteIsSharedWithUser || !currentNoteId || isNewTrulyOfflineNote) ? 'none' : 'inline-block';
            if (deleteNoteBtn) deleteNoteBtn.style.display = (currentNoteIsSharedWithUser || isNewTrulyOfflineNote) ? 'none' : 'inline-block'; // Allow deleting server note even if no ID yet, but hide for temp offline
            if (downloadNoteBtn) downloadNoteBtn.style.display = (currentNoteId || isNewTrulyOfflineNote) ? 'inline-block' : 'none';
        } else {
            noteEditorPanel.classList.add('empty');
            editorContentWrapper.style.display = 'none';
            if (noteTitleInput) noteTitleInput.value = '';
            if (noteContentTextarea) noteContentTextarea.value = '';
            if (noteFolderSelect) noteFolderSelect.value = "";
            currentNoteId = null;
            currentNoteIsSharedWithUser = false;
            currentNoteTags = [];
            renderCurrentNoteTags();
            if (noteTagsInput) noteTagsInput.value = '';
            if (noteLastUpdated) noteLastUpdated.textContent = 'Last updated: N/A';
            if (noteTitleInput) noteTitleInput.disabled = false;
            if (noteContentTextarea) noteContentTextarea.disabled = false;
            if (noteFolderSelect) noteFolderSelect.disabled = false;
            if (noteTagsInput) noteTagsInput.disabled = false;
            if (saveNoteBtn) saveNoteBtn.style.display = 'inline-block';
            if (shareNoteBtn) shareNoteBtn.style.display = 'none';
            if (deleteNoteBtn) deleteNoteBtn.style.display = 'none';
            if (downloadNoteBtn) downloadNoteBtn.style.display = 'none';
        }
        updateSyncToServerButtonVisibility();
    }
    function saveCurrentNote() {
        if (!noteTitleInput || !noteContentTextarea || !noteFolderSelect || (noteTitleInput.disabled && !isOfflineMode) ) return;
        const title = noteTitleInput.value.trim();
        const content = noteContentTextarea.value;
        const folderId = noteFolderSelect.value;
        const tagsToSaveLocally = currentNoteTags; // Save full objects locally
        const tagNamesToServer = currentNoteTags.map(tag => tag.name);

        const isNewNoteCurrently = !currentNoteId || currentNoteId.startsWith('temp_offline_');

        if (isOfflineMode) {
            const noteIdToUseForLocal = currentNoteId || `temp_offline_${Date.now()}`;
            saveNoteToLocalStorage(noteIdToUseForLocal, title, content, tagsToSaveLocally, folderId || null, isNewNoteCurrently);
            if (isNewNoteCurrently && !currentNoteId) {
                currentNoteId = noteIdToUseForLocal;
                const newLocalForList = {
                    id: currentNoteId, title, snippet: content.substring(0,100), updated_at: new Date().toISOString(),
                    folder_id: folderId || null, tags: tagsToSaveLocally, note_status: 'local_new', isLocalNew: true
                };
                const existingIndex = allNotes.findIndex(n => n.id === currentNoteId);
                if (existingIndex === -1) allNotes.unshift(newLocalForList);
                else allNotes[existingIndex] = newLocalForList;
                renderNoteList(allNotes);
                setActiveNoteListItem(currentNoteId);
            } else if (isNewNoteCurrently && currentNoteId.startsWith('temp_offline_')) {
                 const existingNoteIndex = allNotes.findIndex(n => n.id === currentNoteId);
                 if (existingNoteIndex !== -1) {
                     allNotes[existingNoteIndex].title = title;
                     allNotes[existingNoteIndex].snippet = content.substring(0,100);
                     allNotes[existingNoteIndex].updated_at = new Date().toISOString();
                     allNotes[existingNoteIndex].tags = tagsToSaveLocally;
                     allNotes[existingNoteIndex].folder_id = folderId || null;
                     renderNoteList(allNotes);
                     setActiveNoteListItem(currentNoteId);
                 }
            } else if (currentNoteId) { // Existing server note, saved locally
                 const existingNoteIndex = allNotes.findIndex(n => n.id === currentNoteId);
                 if (existingNoteIndex !== -1) { // Update its offline indicator potentially
                    allNotes[existingNoteIndex].updated_at = new Date().toISOString(); // Reflect local save time for sorting
                    renderNoteList(allNotes);
                    setActiveNoteListItem(currentNoteId);
                 }
            }
            if (noteLastUpdated) noteLastUpdated.textContent = `Last saved locally: ${new Date().toLocaleString()}`;
            showGlobalNotification("Note saved locally.", "success", 2000);
            return;
        }

        let url;
        const formData = new FormData();
        formData.append('title', title);
        formData.append('content', content);
        if (folderId) formData.append('folder_id', folderId);

        if (currentNoteId && !currentNoteId.startsWith('temp_offline_')) {
            url = `../php/dashboard.php?action=update_note`;
            formData.append('note_id', currentNoteId);
        } else {
            url = '../php/dashboard.php?action=create_note';
        }
        const tempOfflineIdBeingSynced = (currentNoteId && currentNoteId.startsWith('temp_offline_')) ? currentNoteId : null;

        fetch(url, { method: 'POST', body: formData })
            .then(response => response.json())
            .then(result => {
                if (result.success) {
                    showGlobalNotification(result.message || 'Note saved to server!', 'success');
                    const savedNoteId = result.note_id;

                    if (tempOfflineIdBeingSynced) {
                        removeNoteFromLocalStorage(tempOfflineIdBeingSynced);
                    }
                    if (savedNoteId) removeNoteFromLocalStorage(savedNoteId);
                    currentNoteId = savedNoteId;

                    if (savedNoteId) {
                        syncTagsForNote(savedNoteId, tagNamesToServer).then(() => {
                            loadInitialData(() => {
                                setActiveNoteListItem(savedNoteId);
                                loadNoteIntoEditor(savedNoteId);
                            });
                        }).catch(() => loadInitialData());
                    } else {
                        loadInitialData();
                    }
                } else {
                    showGlobalNotification(result.message || 'Failed to save note to server.', 'error');
                }
            })
            .catch(error => {
                console.error('Error saving note to server:', error);
                showGlobalNotification('An error occurred while saving the note to server.', 'error');
            });
    }
    function syncTagsForNote(noteId, tagsArray) { /* ... same ... */
        const formData = new FormData();
        formData.append('note_id', noteId);
        formData.append('tags', JSON.stringify(tagsArray));

        return fetch('../php/dashboard.php?action=sync_note_tags', { method: 'POST', body: formData })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                currentNoteTags = data.tags || [];
                renderCurrentNoteTags();
            } else {
                showGlobalNotification(data.message || 'Failed to sync tags.', 'error');
            }
            return data;
        })
        .catch(error => {
            console.error('Error syncing tags:', error);
            showGlobalNotification('An error occurred while syncing tags.', 'error');
            throw error;
        });
    }
    function deleteCurrentNote() { /* ... updated for temp offline notes ... */
        if (!currentNoteId || (noteTitleInput && noteTitleInput.disabled && !currentNoteId.startsWith('temp_offline_'))) {
            showGlobalNotification("No note selected or cannot delete this note.", "info");
            return;
        }
        const noteToDeleteTitle = noteTitleInput ? noteTitleInput.value : "this note";
        if (!confirm(`Are you sure you want to delete the note "${escapeHTML(noteToDeleteTitle)}"?`)) {
            return;
        }

        if (currentNoteId.startsWith('temp_offline_')) {
            removeNoteFromLocalStorage(currentNoteId);
            showGlobalNotification('Offline note discarded.', 'success');
            currentNoteId = null;
            updateEditorState(null);
            loadInitialData();
            return;
        }

        const formData = new FormData();
        formData.append('id', currentNoteId);
        fetch(`../php/dashboard.php?action=delete_note`, { method: 'POST', body: formData })
            .then(response => response.json())
            .then(result => {
                if (result.success) {
                    showGlobalNotification('Note deleted successfully!', 'success');
                    removeNoteFromLocalStorage(currentNoteId);
                    currentNoteId = null;
                    updateEditorState(null);
                    loadInitialData();
                } else {
                    showGlobalNotification(result.message || 'Failed to delete note.', 'error');
                }
            })
            .catch(error => {
                console.error('Error deleting note:', error);
                showGlobalNotification('An error occurred while deleting the note.', 'error');
            });
    }

    // --- Event Listeners Setup ---
    // ... (event listeners setup, including workOfflineToggle and syncToServerBtn)
    function setupEventListeners() {
        if (newNoteBtn) {
            newNoteBtn.addEventListener('click', () => {
                setActiveNoteListItem(null);
                if (isOfflineMode) {
                    const tempId = `temp_offline_${Date.now()}`;
                    const newOfflineNoteData = {
                        id: tempId, title: "New Offline Note", content: "",
                        tags: [], folder_id: null, isLocalNew: true,
                        updated_at: new Date().toISOString(), note_status: 'local_new'
                    };
                    saveNoteToLocalStorage(tempId, newOfflineNoteData.title, newOfflineNoteData.content, newOfflineNoteData.tags, newOfflineNoteData.folder_id, true);
                    allNotes.unshift(newOfflineNoteData);
                    renderNoteList(allNotes);
                    setActiveNoteListItem(tempId); // Select the new temp note in the list
                    updateEditorState(newOfflineNoteData); // Load this new temp note into editor
                } else {
                    updateEditorState(null);
                }
                if(noteTitleInput) noteTitleInput.focus();
                if (window.innerWidth <= 768) setMobileView('editor');
            });
        }
        if (saveNoteBtn) saveNoteBtn.addEventListener('click', saveCurrentNote);
        if (deleteNoteBtn) deleteNoteBtn.addEventListener('click', deleteCurrentNote);
        if (downloadNoteBtn) { /* ... same ... */
            downloadNoteBtn.addEventListener('click', () => {
                let titleToUse = "note";
                let contentToUse = "";
                let noteIdForDownload = currentNoteId;

                if (noteIdForDownload) {
                    const noteData = loadNoteFromLocalStorage(noteIdForDownload) || allNotes.find(n => n.id === noteIdForDownload);
                    if (noteData) {
                        titleToUse = noteData.title || "note";
                        if (!noteIdForDownload.startsWith('temp_offline_') && (!noteContentTextarea.value && noteData.snippet === noteData.content)) {
                            window.location.href = `../php/dashboard.php?action=download_note&id=${noteIdForDownload}`;
                            return;
                        }
                        contentToUse = noteContentTextarea.value;
                    } else {
                         showGlobalNotification("Note data not found for download.", "error"); return;
                    }
                } else {
                    showGlobalNotification("No note selected to download.", "info"); return;
                }

                const blob = new Blob([contentToUse], { type: 'text/plain;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${titleToUse.replace(/[^a-z0-9_\-\s\.]/ig, '').replace(/\s+/g, '_') || 'note'}.txt`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            });
        }
        if (shareNoteBtn) { /* ... same ... */
            shareNoteBtn.addEventListener('click', () => {
                if (!currentNoteId || currentNoteId.startsWith('temp_offline_')) {
                    showGlobalNotification("Please save the note to the server before sharing.", "info"); return;
                }
                if (currentNoteIsSharedWithUser) {
                    showGlobalNotification("This note is shared with you and cannot be re-shared.", "info"); return;
                }
                openShareModal();
            });
        }
        if (newFolderBtn && newFolderModal && closeNewFolderModalBtn && confirmNewFolderBtn && newFolderNameInput) { /* ... same ... */
            newFolderBtn.addEventListener('click', () => {
                if(newFolderNameInput) newFolderNameInput.value = '';
                if(newFolderModal) {
                    const form = newFolderModal.querySelector('form'); if(form) clearFormErrors(form);
                    newFolderModal.style.display = 'flex';
                    if(newFolderNameInput) newFolderNameInput.focus();
                }
            });
        }
         if (closeNewFolderModalBtn) { /* ... same ... */
            closeNewFolderModalBtn.addEventListener('click', () => {
                if (newFolderModal) newFolderModal.style.display = 'none';
            });
        }
        if (confirmNewFolderBtn && newFolderNameInput) {  /* ... same ... */
             confirmNewFolderBtn.addEventListener('click', () => {
                const folderName = newFolderNameInput.value.trim();
                if (folderName) createFolder(folderName);
                else showGlobalNotification("Folder name cannot be empty.", "error");
            });
        }
        if (closeRenameFolderModalBtn && renameFolderModal) {  /* ... same ... */
            closeRenameFolderModalBtn.addEventListener('click', () => {
                if (renameFolderModal) renameFolderModal.style.display = 'none';
            });
        }
        if (renameFolderModal) {  /* ... same ... */
            const form = renameFolderModal.querySelector('form');
            if (form && confirmRenameFolderBtn && renameFolderNameInput && renameFolderIdInput) {
                form.addEventListener('submit', (e) => {
                     e.preventDefault();
                     const newName = renameFolderNameInput.value.trim();
                     const folderId = renameFolderIdInput.value;
                     if (newName && folderId) renameFolder(folderId, newName);
                     else showGlobalNotification("Folder name cannot be empty.", "error");
                });
            } else if (confirmRenameFolderBtn && renameFolderNameInput && renameFolderIdInput) {
                 confirmRenameFolderBtn.addEventListener('click', () => {
                    const newName = renameFolderNameInput.value.trim();
                    const folderId = renameFolderIdInput.value;
                    if (newName && folderId) renameFolder(folderId, newName);
                    else showGlobalNotification("Folder name cannot be empty.", "error");
                });
            }
        }
        [newFolderModal, renameFolderModal, shareNoteModal, qrCodeModal].forEach(modal => { // Added qrCodeModal
            if (modal) {
                const closeBtn = modal.querySelector('.close-button');
                if (closeBtn) closeBtn.addEventListener('click', () => modal.style.display = 'none');
                window.addEventListener('click', (event) => {
                    if (event.target == modal) modal.style.display = 'none';
                });
            }
        });
        if (shareNoteForm) { /* ... same ... */
            shareNoteForm.addEventListener('submit', function(e) {
                e.preventDefault();
                const formData = new FormData(shareNoteForm);
                fetch('../php/dashboard.php?action=share_note', { method: 'POST', body: formData })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        showGlobalNotification(data.message || 'Note shared successfully!', 'success');
                        if (shareNoteModal) shareNoteModal.style.display = 'none';
                        if(currentNoteId && shareNoteIdInput && shareNoteIdInput.value == currentNoteId) {
                            loadSharedWithUsers(currentNoteId);
                        }
                        loadInitialData();
                    } else {
                        showGlobalNotification(data.message || 'Failed to share note.', 'error');
                    }
                })
                .catch(error => {
                    console.error('Share Note Error:', error);
                    showGlobalNotification('An error occurred while sharing the note.', 'error');
                });
            });
        }
        if (folderListUl) { /* ... same ... */
            folderListUl.addEventListener('click', (e) => {
                const anchor = e.target.closest('a[data-folder-id]');
                if (anchor && !e.target.closest('button')) {
                    e.preventDefault();
                    const folderId = anchor.dataset.folderId;
                    setActiveFolderListItem(folderId);
                    filterNotesByFolder(folderId);
                     if (window.innerWidth <= 768) setMobileView('list');
                }
            });
        }
        if (tagListUl) { /* ... same ... */
            tagListUl.addEventListener('click', (e) => {
                const anchor = e.target.closest('a[data-tag-id]');
                if (anchor) {
                    e.preventDefault();
                    const tagName = anchor.dataset.tagName;
                    if (!tagName) return;
                    if (activeFilterTags.includes(tagName)) {
                        activeFilterTags = activeFilterTags.filter(t => t !== tagName);
                        anchor.classList.remove('active-filter');
                    } else {
                        activeFilterTags.push(tagName);
                        anchor.classList.add('active-filter');
                    }
                    filterNotesByActiveTags();
                    updateClearTagFiltersButton();
                     if (window.innerWidth <= 768) setMobileView('list');
                }
            });
        }
        const clearTagFiltersBtn = document.getElementById('clearTagFiltersBtn'); /* ... same ... */
        if (clearTagFiltersBtn) {
            clearTagFiltersBtn.addEventListener('click', () => {
                activeFilterTags = [];
                document.querySelectorAll('#tagList a.active-filter').forEach(el => el.classList.remove('active-filter'));
                updateClearTagFiltersButton();
                const activeFolderLink = folderListUl.querySelector('a.active');
                if (activeFolderLink) filterNotesByFolder(activeFolderLink.dataset.folderId);
                else filterNotesByActiveTags();
            });
        }
        if (formatBoldBtn) formatBoldBtn.addEventListener('click', () => applyMarkdownFormatting('**', '**')); /* ... same ... */
        if (formatItalicBtn) formatItalicBtn.addEventListener('click', () => applyMarkdownFormatting('*', '*')); /* ... same ... */
        if (formatUnderlineBtn) formatUnderlineBtn.addEventListener('click', () => applyMarkdownFormatting('__', '__')); /* ... same ... */
        if (noteContentTextarea) { /* ... same ... */
            noteContentTextarea.addEventListener('keydown', function(e) {
                if (e.ctrlKey || e.metaKey) {
                    switch (e.key.toLowerCase()) {
                        case 'b': e.preventDefault(); applyMarkdownFormatting('**', '**'); break;
                        case 'i': e.preventDefault(); applyMarkdownFormatting('*', '*'); break;
                        case 'u': e.preventDefault(); applyMarkdownFormatting('__', '__'); break;
                    }
                }
            });
        }
        if (noteTagsInput) { /* ... same ... */
            noteTagsInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    const tagName = noteTagsInput.value.trim().toLowerCase();
                    if (tagName) {
                        addTagToCurrentNote(tagName);
                        noteTagsInput.value = '';
                        if(tagSuggestionsUl) tagSuggestionsUl.style.display = 'none';
                    }
                }
            });
            noteTagsInput.addEventListener('input', handleTagInput);
            noteTagsInput.addEventListener('keydown', handleTagInputKeyDown);
            noteTagsInput.addEventListener('blur', () => {
                setTimeout(() => {
                    if (tagSuggestionsUl) tagSuggestionsUl.style.display = 'none';
                }, 150);
            });
        }
        if (searchNotesInput) { /* ... same ... */
            searchNotesInput.addEventListener('input', (e) => {
                filterNotesBySearch(e.target.value);
                 if (window.innerWidth <= 768) setMobileView('list');
            });
        }
        if (mobileNewNoteBtn) { /* ... updated for new offline note handling ... */
            mobileNewNoteBtn.addEventListener('click', () => {
                setActiveNoteListItem(null);
                if (isOfflineMode) {
                    const tempId = `temp_offline_${Date.now()}`;
                    const newOfflineNoteData = {
                        id: tempId, title: "New Offline Note", content: "",
                        tags: [], folder_id: null, isLocalNew: true,
                        updated_at: new Date().toISOString(), note_status: 'local_new'
                    };
                    saveNoteToLocalStorage(tempId, newOfflineNoteData.title, newOfflineNoteData.content, newOfflineNoteData.tags, newOfflineNoteData.folder_id, true);
                    allNotes.unshift(newOfflineNoteData);
                    renderNoteList(allNotes);
                    setActiveNoteListItem(tempId);
                    updateEditorState(newOfflineNoteData);
                } else {
                    updateEditorState(null);
                }
                if(noteTitleInput) noteTitleInput.focus();
                setMobileView('editor');
                if(mobileNewNoteBtn) {
                     mobileFooterIcons.forEach(i => i.classList.remove('active'));
                     mobileNewNoteBtn.classList.add('active');
                }
            });
        }
        if (mobileToggleSidebarBtn && sidebar) { /* ... same ... */
            mobileToggleSidebarBtn.addEventListener('click', () => {
                sidebar.classList.toggle('open');
                if (sidebar.classList.contains('open')) {
                    setMobileView('sidebar');
                } else {
                    setMobileView(currentMobileView === 'sidebar' ? 'list' : currentMobileView);
                }
            });
        }
        if (mobileSearchBtn && searchNotesInput) { /* ... same ... */
            mobileSearchBtn.addEventListener('click', () => {
                setMobileView('list');
                searchNotesInput.focus();
                mobileFooterIcons.forEach(i => i.classList.remove('active'));
                if(mobileSearchBtn) mobileSearchBtn.classList.add('active');
            });
        }
        if (mobileUserBtn) {  /* ... same ... */
            mobileUserBtn.addEventListener('click', () => {
                showGlobalNotification("User settings/profile not yet implemented.", "info");
            });
        }
        if (workOfflineToggle) { /* ... updated ... */
            workOfflineToggle.addEventListener('change', async function() {
                const newOfflineState = this.checked;
                if (newOfflineState === isOfflineMode) return;

                if (newOfflineState) {
                    isOfflineMode = true;
                    localStorage.setItem('notepadsly_offline_mode_enabled', 'true');
                    if(offlineModeIndicator) offlineModeIndicator.style.display = 'inline';
                    showGlobalNotification("Offline mode enabled.", "info");
                    if (currentNoteId && noteTitleInput && noteContentTextarea) { // Save existing note locally
                        saveNoteToLocalStorage(currentNoteId, noteTitleInput.value, noteContentTextarea.value, currentNoteTags, noteFolderSelect.value, currentNoteId.startsWith('temp_offline_'));
                    } else if (!currentNoteId && (noteTitleInput.value || noteContentTextarea.value)) { // New unsaved note in editor
                        const tempId = `temp_offline_${Date.now()}`;
                        saveNoteToLocalStorage(tempId, noteTitleInput.value, noteContentTextarea.value, currentNoteTags, noteFolderSelect.value, true);
                        currentNoteId = tempId;
                        const newLocalForList = {
                            id: currentNoteId, title: noteTitleInput.value, snippet: noteContentTextarea.value.substring(0,100),
                            updated_at: new Date().toISOString(),
                            folder_id: noteFolderSelect.value || null, tags: currentNoteTags, note_status: 'local_new', isLocalNew: true
                        };
                        allNotes.unshift(newLocalForList);
                        renderNoteList(allNotes);
                        setActiveNoteListItem(currentNoteId);
                         updateEditorState(newLocalForList); // Refresh editor for the new temp ID
                    }
                } else {
                    showGlobalNotification("Switching to Online Mode... Attempting to sync.", "info", 3000);
                    await syncAllOfflineNotesToServer();

                    isOfflineMode = false;
                    localStorage.setItem('notepadsly_offline_mode_enabled', 'false');
                    if(offlineModeIndicator) offlineModeIndicator.style.display = 'none';

                    loadInitialData(() => {
                        if (currentNoteId && !currentNoteId.startsWith('temp_offline_')) {
                            loadNoteIntoEditor(currentNoteId);
                        } else {
                            updateEditorState(null);
                        }
                    });
                }
                updateSyncToServerButtonVisibility();
            });
        }
        syncToServerBtn.addEventListener('click', async () => { /* ... same ... */
            if (isOfflineMode) {
                showGlobalNotification("Please switch to Online mode to sync.", "info");
                return;
            }
            await syncAllOfflineNotesToServer();
            loadInitialData(() => {
                if (currentNoteId && !currentNoteId.startsWith('temp_offline_')) {
                    loadNoteIntoEditor(currentNoteId);
                } else {
                     updateEditorState(null);
                }
            });
        });

        // QR Code Button Listener
        if (qrCodeNoteBtn) {
            qrCodeNoteBtn.addEventListener('click', () => {
                if (currentNoteId && !currentNoteId.startsWith('temp_offline_')) {
                    const noteUrl = `${window.location.origin}/dashboard#note=${currentNoteId}`;
                    if (qrCodeCanvasContainer && qrCodeModal && qrCodeUrlDisplay) {
                        qrCodeCanvasContainer.innerHTML = ''; // Clear previous QR
                        try {
                            if (qrCodeInstance) { // qrcode.js library might reuse instance or need clearing
                                qrCodeInstance.clear();
                                qrCodeInstance.makeCode(noteUrl);
                            } else {
                                qrCodeInstance = new QRCode(qrCodeCanvasContainer, {
                                    text: noteUrl,
                                    width: 180,
                                    height: 180,
                                    colorDark : "#000000",
                                    colorLight : "#ffffff",
                                    correctLevel : QRCode.CorrectLevel.H
                                });
                            }
                            qrCodeUrlDisplay.value = noteUrl;
                            qrCodeModal.style.display = 'flex';
                        } catch(e) {
                            console.error("QR Code generation failed:", e);
                            showGlobalNotification("Failed to generate QR code.", "error");
                        }
                    }
                } else {
                    showGlobalNotification("Please save the note to the server to generate a shareable QR code.", "info");
                }
            });
        }
        if(closeQrCodeModalBtn && qrCodeModal) {
            closeQrCodeModalBtn.addEventListener('click', () => qrCodeModal.style.display = 'none');
        }
        if(copyQrCodeUrlBtn && qrCodeUrlDisplay) {
            copyQrCodeUrlBtn.addEventListener('click', () => {
                qrCodeUrlDisplay.select();
                try {
                    document.execCommand('copy');
                    showGlobalNotification("Link copied to clipboard!", "success", 2000);
                } catch (err) {
                    showGlobalNotification("Failed to copy link.", "error");
                }
            });
        }


    } // End of setupEventListeners

    // --- Folder, Tag, Search, Formatting, Share Modal functions ---
    // ... (All these existing functions remain largely the same)
    function createFolder(folderName) { /* ... same ... */
        const formData = new FormData();
        formData.append('name', folderName);
        fetch('../php/dashboard.php?action=create_folder', { method: 'POST', body: formData})
            .then(response => response.json())
            .then(result => {
                if (result.success) {
                    if (newFolderModal) newFolderModal.style.display = 'none';
                    loadInitialData();
                } else {
                    showGlobalNotification(result.message || "Failed to create folder.", 'error');
                }
            })
            .catch(error => {
                console.error('Error creating folder:', error);
                showGlobalNotification("An error occurred while creating the folder.", 'error');
            });
    }
    function openRenameFolderModal(folderId, currentName) { /* ... same ... */
        if (renameFolderModal && renameFolderNameInput && renameFolderIdInput) {
            renameFolderNameInput.value = currentName;
            renameFolderIdInput.value = folderId;
            const form = renameFolderModal.querySelector('form');
            if(form) clearFormErrors(form);
            renameFolderModal.style.display = 'flex';
            renameFolderNameInput.focus();
        }
    }
    function renameFolder(folderId, newName) { /* ... same ... */
        const formData = new FormData();
        formData.append('folder_id', folderId);
        formData.append('name', newName);
        fetch('../php/dashboard.php?action=update_folder', { method: 'POST', body: formData})
            .then(response => response.json())
            .then(result => {
                if (result.success) {
                    if (renameFolderModal) renameFolderModal.style.display = 'none';
                    loadInitialData();
                } else {
                    showGlobalNotification(result.message || "Failed to rename folder.", 'error');
                }
            })
            .catch(error => {
                console.error('Error renaming folder:', error);
                showGlobalNotification("An error occurred while renaming the folder.", 'error');
            });
    }
    function confirmDeleteFolder(folderId, folderName) { /* ... same ... */
        if (confirm(`Are you sure you want to delete the folder "${escapeHTML(folderName)}"? Notes in this folder will be moved to "All Notes".`)) {
            deleteFolder(folderId);
        }
    }
    function deleteFolder(folderId) { /* ... same ... */
        const formData = new FormData();
        formData.append('folder_id', folderId);
        fetch('../php/dashboard.php?action=delete_folder', { method: 'POST', body: formData})
            .then(response => response.json())
            .then(result => {
                if (result.success) {
                    showGlobalNotification(result.message || 'Folder deleted successfully!', 'success');
                    loadInitialData();
                } else {
                    showGlobalNotification(result.message || "Failed to delete folder.", 'error');
                }
            })
            .catch(error => {
                console.error('Error deleting folder:', error);
                showGlobalNotification("An error occurred while deleting the folder.", 'error');
            });
    }
    function filterNotesByFolder(folderId) { /* ... same ... */
        activeFilterTags = [];
        document.querySelectorAll('#tagList a.active-filter').forEach(el => el.classList.remove('active-filter'));
        updateClearTagFiltersButton();
        let notesToDisplay;
        if (folderId === 'all') {
            notesToDisplay = allNotes;
        } else {
            notesToDisplay = allNotes.filter(note => note.folder_id == folderId && (note.note_status === 'owner' || note.note_status === 'local_new'));
        }
        renderNoteList(notesToDisplay);
        updateEditorState(null);
        setActiveNoteListItem(null);
    }
    function filterNotesByActiveTags() { /* ... same ... */
        let notesToFilter = [];
        const activeFolderLink = folderListUl.querySelector('a.active');
        const activeFolderId = (activeFolderLink && activeFolderLink.dataset.folderId !== 'all')
                               ? activeFolderLink.dataset.folderId
                               : null;
        if (activeFolderId) {
            notesToFilter = allNotes.filter(note => note.folder_id == activeFolderId && (note.note_status === 'owner' || note.note_status === 'local_new'));
        } else {
            notesToFilter = allNotes;
        }
        if (activeFilterTags.length === 0) {
            renderNoteList(notesToFilter);
        } else {
            const filteredNotes = notesToFilter.filter(note => {
                if (!note.tags || note.tags.length === 0) return false;
                return activeFilterTags.every(filterTag =>
                    note.tags.some(noteTag => noteTag.name.toLowerCase() === filterTag.toLowerCase())
                );
            });
            renderNoteList(filteredNotes);
        }
        updateEditorState(null);
        setActiveNoteListItem(null);
    }
    function updateClearTagFiltersButton() { /* ... same ... */
        const clearTagFiltersBtn = document.getElementById('clearTagFiltersBtn');
        if (clearTagFiltersBtn) {
            clearTagFiltersBtn.style.display = activeFilterTags.length > 0 ? 'inline-block' : 'none';
        }
    }
    function filterNotesBySearch(searchTerm) { /* ... same ... */
        const lowerSearchTerm = searchTerm.toLowerCase();
        activeFilterTags = [];
        document.querySelectorAll('#tagList a.active-filter').forEach(el => el.classList.remove('active-filter'));
        updateClearTagFiltersButton();
        setActiveFolderListItem('all');
        const filteredNotes = allNotes.filter(note => {
            const titleMatch = note.title && note.title.toLowerCase().includes(lowerSearchTerm);
            const contentMatch = note.snippet && note.snippet.toLowerCase().includes(lowerSearchTerm);
            const tagMatch = note.tags && note.tags.some(tag => tag.name.toLowerCase().includes(lowerSearchTerm));
            return titleMatch || contentMatch || tagMatch;
        });
        renderNoteList(filteredNotes);
        updateEditorState(null);
        setActiveNoteListItem(null);
    }
    function applyMarkdownFormatting(prefix, suffix) { /* ... same ... */
        if (!noteContentTextarea || noteContentTextarea.disabled) return;
        const start = noteContentTextarea.selectionStart;
        const end = noteContentTextarea.selectionEnd;
        const selectedText = noteContentTextarea.value.substring(start, end);
        const textBefore = noteContentTextarea.value.substring(0, start);
        const textAfter = noteContentTextarea.value.substring(end);
        if (selectedText.length > 0 && selectedText.startsWith(prefix) && selectedText.endsWith(suffix)) {
            const unwrappedText = selectedText.substring(prefix.length, selectedText.length - suffix.length);
            noteContentTextarea.value = textBefore + unwrappedText + textAfter;
            noteContentTextarea.selectionStart = start;
            noteContentTextarea.selectionEnd = start + unwrappedText.length;
        } else if (selectedText.length === 0 && textBefore.endsWith(prefix) && textAfter.startsWith(suffix)) {
            const textBeforeUnwrapped = textBefore.substring(0, textBefore.length - prefix.length);
            const textAfterUnwrapped = textAfter.substring(suffix.length);
            noteContentTextarea.value = textBeforeUnwrapped + textAfterUnwrapped;
            noteContentTextarea.selectionStart = start - prefix.length;
            noteContentTextarea.selectionEnd = start - prefix.length;
        }
        else {
            noteContentTextarea.value = textBefore + prefix + selectedText + suffix + textAfter;
            if (selectedText.length === 0) {
                noteContentTextarea.selectionStart = start + prefix.length;
                noteContentTextarea.selectionEnd = start + prefix.length;
            } else {
                noteContentTextarea.selectionStart = start + prefix.length;
                noteContentTextarea.selectionEnd = start + prefix.length + selectedText.length;
            }
        }
        noteContentTextarea.focus();
        noteContentTextarea.dispatchEvent(new Event('input', { bubbles: true }));
    }
    function handleTagInput() { /* ... same ... */
        if (!noteTagsInput || !tagSuggestionsUl || !allUserUniqueTags) return;
        const inputText = noteTagsInput.value.trim().toLowerCase();
        tagSuggestionsUl.innerHTML = '';
        suggestionIdx = -1;
        if (!inputText) {
            tagSuggestionsUl.style.display = 'none';
            return;
        }
        const suggestions = allUserUniqueTags.filter(tag =>
            tag.name.toLowerCase().includes(inputText) &&
            !currentNoteTags.some(currentTag => currentTag.name === tag.name.toLowerCase())
        );
        if (suggestions.length > 0) {
            suggestions.slice(0, 5).forEach(tag => {
                const li = document.createElement('li');
                li.textContent = tag.name;
                li.addEventListener('mousedown', () => {
                    addTagToCurrentNote(tag.name);
                    noteTagsInput.value = '';
                    tagSuggestionsUl.style.display = 'none';
                });
                tagSuggestionsUl.appendChild(li);
            });
            tagSuggestionsUl.style.display = 'block';
        } else {
            tagSuggestionsUl.style.display = 'none';
        }
    }
    function handleTagInputKeyDown(e) { /* ... same ... */
        if (!tagSuggestionsUl || tagSuggestionsUl.style.display === 'none') return;
        const items = tagSuggestionsUl.querySelectorAll('li');
        if (items.length === 0) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            suggestionIdx = (suggestionIdx + 1) % items.length;
            updateSuggestionSelection(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            suggestionIdx = (suggestionIdx - 1 + items.length) % items.length;
            updateSuggestionSelection(items);
        } else if (e.key === 'Enter' && suggestionIdx > -1) {
            e.preventDefault();
            items[suggestionIdx].dispatchEvent(new Event('mousedown'));
        } else if (e.key === 'Escape') {
            tagSuggestionsUl.style.display = 'none';
        }
    }
    function updateSuggestionSelection(items) { /* ... same ... */
        items.forEach((item, index) => {
            if (index === suggestionIdx) {
                item.classList.add('selected');
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.classList.remove('selected');
            }
        });
    }
    function addTagToCurrentNote(tagName) { /* ... same ... */
        const normalizedTagName = tagName.trim().toLowerCase();
        if (normalizedTagName && !currentNoteTags.some(t => t.name === normalizedTagName)) {
            const existingGlobalTag = allUserUniqueTags.find(globalTag => globalTag.name === normalizedTagName);
            currentNoteTags.push({ id: existingGlobalTag ? existingGlobalTag.id : null, name: normalizedTagName });
            renderCurrentNoteTags();
        }
    }
    function openShareModal() { /* ... same ... */
        if (shareNoteModal && shareNoteIdInput && shareNoteForm) {
            shareNoteForm.reset();
            if(currentlySharedWithListUl) currentlySharedWithListUl.innerHTML = '';
            if(noSharedUsersMsgLi) noSharedUsersMsgLi.style.display = 'block';
            shareNoteIdInput.value = currentNoteId;
            loadSharedWithUsers(currentNoteId);
            shareNoteModal.style.display = 'flex';
            if(shareWithUserInput) shareWithUserInput.focus();
        }
    }
    function loadSharedWithUsers(noteId) { /* ... same ... */
        if (!currentlySharedWithListUl || !noSharedUsersMsgLi) return;
        fetch(`../php/dashboard.php?action=get_shared_with_users&note_id=${noteId}`)
            .then(response => response.json())
            .then(data => {
                currentlySharedWithListUl.innerHTML = '';
                if (data.success && data.shared_users && data.shared_users.length > 0) {
                    noSharedUsersMsgLi.style.display = 'none';
                    data.shared_users.forEach(sharedUser => {
                        const li = document.createElement('li');
                        li.innerHTML = `
                            <span>${escapeHTML(sharedUser.username)} (${escapeHTML(sharedUser.permission)})</span>
                            <button class="revoke-share-btn button" data-shared-user-id="${sharedUser.user_id}">Revoke</button>
                        `;
                        li.querySelector('.revoke-share-btn').addEventListener('click', () => {
                            confirmRevokeAccess(noteId, sharedUser.user_id, sharedUser.username);
                        });
                        currentlySharedWithListUl.appendChild(li);
                    });
                } else if (data.success) {
                    noSharedUsersMsgLi.style.display = 'block';
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
    function confirmRevokeAccess(noteId, sharedUserId, username) { /* ... same ... */
        if (confirm(`Are you sure you want to revoke access to this note for ${escapeHTML(username)}?`)) {
            revokeAccess(noteId, sharedUserId);
        }
    }
    function revokeAccess(noteId, sharedUserId) { /* ... same ... */
        const formData = new FormData();
        formData.append('note_id', noteId);
        formData.append('shared_user_id', sharedUserId);
        fetch('../php/dashboard.php?action=revoke_note_access', { method: 'POST', body: formData})
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showGlobalNotification(data.message || 'Access revoked.', 'success');
                    loadSharedWithUsers(noteId);
                    loadInitialData();
                } else {
                    showGlobalNotification(data.message || 'Failed to revoke access.', 'error');
                }
            })
            .catch(error => {
                console.error('Error revoking access:', error);
                showGlobalNotification('An error occurred while revoking access.', 'error');
            });
    }
    function checkScreenWidth() { /* ... same ... */
        const isMobile = window.innerWidth <= 768;
        if (isMobile) {
            if (!appBody.classList.contains('mobile-view-list') &&
                !appBody.classList.contains('mobile-view-editor') &&
                !appBody.classList.contains('mobile-view-sidebar')) {
                setMobileView('list');
            }
        } else {
            appBody.classList.remove('mobile-view-list', 'mobile-view-editor', 'mobile-view-sidebar');
            if(sidebar) sidebar.classList.remove('open');
            if(noteListPanel) noteListPanel.style.display = '';
            if(noteEditorPanel) noteEditorPanel.style.display = '';
        }
    }
    function setMobileView(viewName) {  /* ... same ... */
        currentMobileView = viewName;
        appBody.classList.remove('mobile-view-list', 'mobile-view-editor', 'mobile-view-sidebar');
        appBody.classList.add(`mobile-view-${viewName}`);
        mobileFooterIcons.forEach(icon => icon.classList.remove('active'));
        if (viewName === 'sidebar' && mobileToggleSidebarBtn) {
            mobileToggleSidebarBtn.classList.add('active');
        } else if (viewName === 'list' && mobileSearchBtn) {
        } else if (viewName === 'editor' && document.querySelector('#mobileNewNoteBtn.active')) {
        }
        const tempActiveNewNote = document.querySelector('#mobileNewNoteBtn.temp-active');
        if(tempActiveNewNote) tempActiveNewNote.classList.remove('temp-active');
    }

    // --- Utility Functions ---
    function escapeHTML(str) { /* ... same ... */
        if (str === null || str === undefined) return '';
        return String(str).replace(/[&<>"']/g, function (match) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[match];
        });
    }
    function clearFormErrors(formElement) {  /* ... same ... */
        if (!formElement) return;
        const errorMessages = formElement.querySelectorAll('.error-message');
        errorMessages.forEach(el => el.textContent = '');
    }

    initializeDashboard();
});

let notificationTimeout;
function showGlobalNotification(message, type = 'info', duration = 3000) {
    // ... (showGlobalNotification implementation remains the same)
    const notificationElement = document.getElementById('globalNotification');
    if (!notificationElement) return;
    clearTimeout(notificationTimeout);
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
    notificationTimeout = setTimeout(() => {
        notificationElement.style.display = 'none';
        notificationElement.style.top = '0px';
    }, duration);
}
