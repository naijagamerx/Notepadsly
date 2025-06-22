document.addEventListener('DOMContentLoaded', function() {
    // --- DOM Elements ---
    const usernameDisplay = document.getElementById('usernameDisplay');
    const newNoteBtn = document.getElementById('newNoteBtn');
    const newFolderBtn = document.getElementById('newFolderBtn');

    const folderListUl = document.getElementById('folderList');
    const tagListUl = document.getElementById('tagList');
    const noteListUl = document.getElementById('noteList');

    const noteTitleInput = document.getElementById('noteTitleInput'); // Updated ID
    const noteContentTextarea = document.getElementById('noteContentTextarea'); // Updated ID
    const saveNoteBtn = document.getElementById('saveNoteBtn');
    const deleteNoteBtn = document.getElementById('deleteNoteBtn');
    const shareNoteBtn = document.getElementById('shareNoteBtn'); // Not implemented yet

    const searchNotesInput = document.getElementById('searchNotes');

    const newFolderModal = document.getElementById('newFolderModal');
    const closeNewFolderModalBtn = newFolderModal ? newFolderModal.querySelector('.close-button[data-modal-id="newFolderModal"]') : null;
    const newFolderNameInput = document.getElementById('newFolderNameInput'); // ID updated in HTML
    const confirmNewFolderBtn = document.getElementById('confirmNewFolderBtn');

    const renameFolderModal = document.getElementById('renameFolderModal');
    const closeRenameFolderModalBtn = renameFolderModal ? renameFolderModal.querySelector('.close-button[data-modal-id="renameFolderModal"]') : null;
    const renameFolderNameInput = document.getElementById('renameFolderNameInput');
    const renameFolderIdInput = document.getElementById('renameFolderIdInput');
    const confirmRenameFolderBtn = document.getElementById('confirmRenameFolderBtn');

    const noteFolderSelect = document.getElementById('noteFolderSelect');

    const noteEditorPanel = document.querySelector('.note-editor-panel');
    const editorContentWrapper = noteEditorPanel ? noteEditorPanel.querySelector('.content-wrapper') : null;
    const noteTagsInput = document.getElementById('noteTagsInput');
    const currentNoteTagsDisplay = document.getElementById('currentNoteTagsDisplay');
    const tagSuggestionsUl = document.getElementById('tagSuggestions');
    const noteLastUpdated = document.getElementById('noteLastUpdated');

    // Note Editor Toolbar Buttons
    const formatBoldBtn = document.getElementById('formatBoldBtn');
    const formatItalicBtn = document.getElementById('formatItalicBtn');
    const formatUnderlineBtn = document.getElementById('formatUnderlineBtn');

    // Share Note Modal Elements
    const shareNoteModal = document.getElementById('shareNoteModal');
    const shareNoteForm = document.getElementById('shareNoteForm');
    const closeShareNoteModalBtn = shareNoteModal ? shareNoteModal.querySelector('.close-button') : null;
    const shareNoteIdInput = document.getElementById('shareNoteIdInput');
    const shareWithUserInput = document.getElementById('shareWithUserInput');


    // --- State Variables ---
    let currentNoteId = null;
    let currentNoteIsSharedWithUser = false; // Flag to indicate if the loaded note is shared with current user
    let currentNoteTags = []; // Holds array of {id, name} for the currently edited note
    let activeFilterTags = []; // Array of tag names for current filter
    let currentUser = null;
    let allNotes = [];
    let allFolders = [];
    let allUserUniqueTags = []; // For the sidebar tag list (renamed from allTags for clarity)

    // --- Initialization ---
    function initializeDashboard() {
        fetchUserData();
        loadInitialData(); // Fetch notes, folders, tags
        setupEventListeners();
        updateEditorState(null); // Start with no note selected
        document.getElementById('currentYear').textContent = new Date().getFullYear();
    }

    function fetchUserData() {
        fetch('../php/dashboard.php?action=get_user_info')
            .then(response => response.json())
            .then(data => {
                if (data.success && data.username && usernameDisplay) {
                    usernameDisplay.textContent = `Welcome, ${data.username}!`;
                    currentUser = data; // Store user data

                    // Add Admin Panel link if user is admin
                    if (data.role === 'admin' && adminLinkContainer) {
                        adminLinkContainer.innerHTML = `<a href="/admin_dashboard" class="button button-secondary">Admin Panel</a>`;
                    }
                } else if (!data.success) {
                    // Handle cases where user info couldn't be fetched (e.g. session expired)
                    console.error('Failed to fetch user info:', data.message);
                    // Potentially redirect to login or show an error
                    // For now, this might mean the dashboard operates without specific user details
                    // or php/dashboard.php's main auth check would have already redirected.
                }
            })
            .catch(error => {
                console.error('Error fetching user data:', error);
                // Potentially redirect to login page if critical user data is missing
                // window.location.href = '../html/index.html';
            });
    }

    function loadInitialData() {
        fetch('../php/dashboard.php?action=get_initial_data')
            .then(response => response.json())
            .then(result => {
                if (result.success) {
                    allNotes = result.data.notes || [];
                    allFolders = result.data.folders || [];
                    allUserUniqueTags = result.data.tags || []; // Updated variable name

                    renderFolders(allFolders);
                    renderTagsSidebar(allUserUniqueTags); // Renamed for clarity
                    renderNoteList(allNotes); // Initially render all notes

                    // Select the first note if available
                    if (allNotes.length > 0) {
                        // loadNoteIntoEditor(allNotes[0].id);
                        // setActiveNoteListItem(allNotes[0].id);
                    } else {
                        updateEditorState(null); // No notes, show empty state
                    }
                } else {
                    console.error('Failed to load initial data:', result.message);
                }
            })
            .catch(error => console.error('Error loading initial data:', error));
    }

    // --- Rendering Functions ---
    function renderFolders(folders) {
        if (!folderListUl) return;
        folderListUl.innerHTML = '<li><a href="#" data-folder-id="all" class="active"><span>All Notes</span></a></li>'; // Default "All Notes"

        // Populate folder dropdown in note editor
        if (noteFolderSelect) {
            noteFolderSelect.innerHTML = '<option value="">Uncategorized</option>'; // Default option
            folders.forEach(folder => {
                const option = document.createElement('option');
                option.value = folder.id;
                option.textContent = escapeHTML(folder.name);
                noteFolderSelect.appendChild(option);
            });
        }

        folders.forEach(folder => {
            const li = document.createElement('li');
            li.dataset.folderId = folder.id; // For easier selection later if needed
            li.innerHTML = `
                <a href="#" data-folder-id="${folder.id}">
                    <span>${escapeHTML(folder.name)}</span>
                    <span class="folder-item-actions">
                        <button class="edit-folder-btn" title="Rename folder">&#9998;</button> <!-- Pencil icon -->
                        <button class="delete-folder-btn" title="Delete folder">&times;</button> <!-- Cross icon -->
                    </span>
                </a>`;

            const editBtn = li.querySelector('.edit-folder-btn');
            const deleteBtn = li.querySelector('.delete-folder-btn');

            editBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent folder navigation
                e.preventDefault();
                openRenameFolderModal(folder.id, folder.name);
            });

            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                confirmDeleteFolder(folder.id, folder.name);
            });

            folderListUl.appendChild(li);
        });

        const activeFolderLink = folderListUl.querySelector('a.active');
        if (!activeFolderLink && folderListUl.querySelector('a[data-folder-id="all"]')) {
             folderListUl.querySelector('a[data-folder-id="all"]').classList.add('active');
        } else if (activeFolderLink) { // Ensure the active class is on the 'a' tag
            setActiveFolderListItem(activeFolderLink.dataset.folderId);
        }
    }

    function renderTagsSidebar(tags) { // Renamed from renderTags
        if (!tagListUl) return;
        tagListUl.innerHTML = ''; // Clear existing
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

    function renderCurrentNoteTags() {
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
            removeBtn.addEventListener('click', () => {
                // Remove from currentNoteTags array
                currentNoteTags = currentNoteTags.filter(t => t.id !== tag.id);
                renderCurrentNoteTags(); // Re-render pills
                // Note: This only updates UI; actual removal from DB happens on note save.
            });
            pill.appendChild(removeBtn);
            currentNoteTagsDisplay.appendChild(pill);
        });
    }


    function renderNoteList(notesToRender) {
        if (!noteListUl) return;
        noteListUl.innerHTML = ''; // Clear existing
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

            if (note.note_status === 'shared') {
                titleHTML += `<small class="shared-indicator">(Shared by ${escapeHTML(note.shared_by_username)})</small>`;
                li.classList.add('shared-note-item'); // For specific styling of shared notes
            }

            li.innerHTML = `
                ${titleHTML}
                <p>${escapeHTML(note.snippet) || 'No additional text'}</p>
                <small>${date}</small>
            `;
            li.addEventListener('click', () => {
                loadNoteIntoEditor(note.id); // loadNoteIntoEditor will check note_status for read-only
                setActiveNoteListItem(note.id);
            });
            noteListUl.appendChild(li);
        });
    }

    function setActiveNoteListItem(noteId) {
        document.querySelectorAll('#noteList .note-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.noteId == noteId) {
                item.classList.add('active');
            }
        });
    }

    function setActiveFolderListItem(folderIdOrAll) {
        document.querySelectorAll('#folderList li a').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.folderId == folderIdOrAll) {
                item.classList.add('active');
            }
        });
    }


    // --- Editor Functions ---
    function loadNoteIntoEditor(noteId) {
        const note = allNotes.find(n => n.id == noteId);
        if (note) {
            // Fetch full note content if snippet is not enough or it's a different structure
            // For now, assuming 'snippet' might be full content for simplicity or a separate fetch is needed
            // Let's assume we need to fetch the full note.
            fetch(`../php/dashboard.php?action=get_note_content&id=${noteId}`)
                .then(response => response.json())
                .then(result => {
                    if (result.success && result.note) {
                        updateEditorState(result.note);
                        currentNoteId = noteId;
                    } else {
                        console.error("Failed to load note content:", result.message);
                        showGlobalNotification(result.message || "Error loading note.", 'error');
                        updateEditorState(null);
                    }
                })
                .catch(err => {
                    console.error("Error fetching note content:", err);
                    showGlobalNotification("Error loading note.", 'error');
                    updateEditorState(null);
                });
        } else {
            // This case might not need a user notification if it's an internal state issue
            console.warn(`Note with ID ${noteId} not found in local cache.`);
            updateEditorState(null);
        }
    }

    function updateEditorState(noteData) {
        if (!noteEditorPanel || !editorContentWrapper) return;

        if (noteData && noteData.id) { // A note is selected/loaded
            noteEditorPanel.classList.remove('empty');
            editorContentWrapper.style.display = 'flex'; // Show content

            noteTitleInput.value = noteData.title || '';
            noteContentTextarea.value = noteData.content || '';
            currentNoteId = noteData.id;
            if (noteFolderSelect) {
                noteFolderSelect.value = noteData.folder_id || ""; // Set folder dropdown
            }
            currentNoteTags = noteData.tags || [];
            renderCurrentNoteTags();
            if (noteTagsInput) noteTagsInput.value = ''; // Clear the input field

            if (noteLastUpdated) {
                noteLastUpdated.textContent = `Last updated: ${new Date(noteData.updated_at).toLocaleString()}`;
            }

            currentNoteIsSharedWithUser = (noteData.note_status === 'shared');
            const isReadOnly = currentNoteIsSharedWithUser && noteData.permission === 'read';

            // Enable/Disable editor fields based on read-only status
            if (noteTitleInput) noteTitleInput.disabled = isReadOnly;
            if (noteContentTextarea) noteContentTextarea.disabled = isReadOnly;
            if (noteFolderSelect) noteFolderSelect.disabled = isReadOnly;
            if (noteTagsInput) noteTagsInput.disabled = isReadOnly;
            // Disable remove buttons on tag pills if read-only
            currentNoteTagsDisplay.querySelectorAll('.remove-tag-btn').forEach(btn => btn.style.display = isReadOnly ? 'none' : 'inline');


            if (saveNoteBtn) saveNoteBtn.style.display = isReadOnly ? 'none' : 'inline-block';
            // If it's a shared note, user shouldn't be able to re-share or delete it (for now)
            if (shareNoteBtn) shareNoteBtn.style.display = isReadOnly ? 'none' : 'inline-block'; // Hide share if it's already a shared note they are viewing
            if (deleteNoteBtn) deleteNoteBtn.style.display = isReadOnly ? 'none' : 'inline-block';


        } else { // No note selected or new note state
            noteEditorPanel.classList.add('empty');
            editorContentWrapper.style.display = 'none'; // Hide content wrapper

            if (noteTitleInput) noteTitleInput.value = '';
            if (noteContentTextarea) noteContentTextarea.value = '';
            if (noteFolderSelect) noteFolderSelect.value = ""; // Reset folder dropdown
            currentNoteId = null;
            currentNoteIsSharedWithUser = false;
            currentNoteTags = [];
            renderCurrentNoteTags();
            if (noteTagsInput) noteTagsInput.value = '';
            if (noteLastUpdated) noteLastUpdated.textContent = 'Last updated: N/A';

            // Reset all editor fields to enabled by default when no note is selected (or new note)
            if (noteTitleInput) noteTitleInput.disabled = false;
            if (noteContentTextarea) noteContentTextarea.disabled = false;
            if (noteFolderSelect) noteFolderSelect.disabled = false;
            if (noteTagsInput) noteTagsInput.disabled = false;
            if (saveNoteBtn) saveNoteBtn.style.display = 'inline-block';
            if (shareNoteBtn) shareNoteBtn.style.display = 'inline-block'; // Show share for owned new/empty note
            if (deleteNoteBtn) deleteNoteBtn.style.display = 'inline-block';
        }
    }


    function saveCurrentNote() {
        if (!noteTitleInput || !noteContentTextarea || !noteFolderSelect) return;

        const title = noteTitleInput.value.trim();
        const content = noteContentTextarea.value;
        const folderId = noteFolderSelect.value;

        // Get tag names from the currentNoteTags array (these are the ones visually present)
        const tagNamesToSend = currentNoteTags.map(tag => tag.name);

        let url;
        const formData = new FormData();
        formData.append('title', title);
        formData.append('content', content);
        if (folderId) {
            formData.append('folder_id', folderId);
        }
        formData.append('tags', JSON.stringify(tagNamesToSend)); // Send as JSON string array

        if (currentNoteId) { // Update existing note
            // url = `../php/dashboard.php?action=update_note&id=${currentNoteId}`; // ID in GET is not how PHP is structured
            url = `../php/dashboard.php?action=update_note`; // PHP expects note_id in POST
            formData.append('note_id', currentNoteId);
        } else { // Create new note
            url = '../php/dashboard.php?action=create_note';
        }

        fetch(url, { method: 'POST', body: formData })
            .then(response => response.json())
            .then(result => {
                if (result.success) {
                    showGlobalNotification(result.message || 'Note saved!', 'success');

                    // If a new note was created, the result will contain its ID
                    const savedNoteId = result.note_id || currentNoteId;

                    // After saving, we need to sync tags if it's an existing note,
                    // or if it's a new note and tags were added before the first save.
                    // The backend `create_note` doesn't handle tags yet, so we'll call sync_note_tags.
                    // The backend `update_note` also doesn't handle tags yet based on current PHP.
                    // The `sync_note_tags` PHP action is now the sole way to update tags.
                    // So, after note create/update, call sync.

                    if (savedNoteId) { // Ensure we have a note ID
                        syncTagsForNote(savedNoteId, tagNamesToSend).then(() => {
                            loadInitialData(); // Reload all data to reflect note & tag changes
                            setTimeout(() => { // Re-select and load the note
                                setActiveNoteListItem(savedNoteId);
                                loadNoteIntoEditor(savedNoteId);
                            }, 100);
                        });
                    } else { // Should not happen if save was successful
                        loadInitialData();
                    }
                } else {
                    showGlobalNotification(result.message || 'Failed to save note.', 'error');
                }
            })
            .catch(error => {
                console.error('Error saving note:', error);
                showGlobalNotification('An error occurred while saving the note.', 'error');
            });
    }

    function syncTagsForNote(noteId, tagsArray) {
        const formData = new FormData();
        formData.append('note_id', noteId);
        formData.append('tags', JSON.stringify(tagsArray)); // Send array of tag names

        return fetch('../php/dashboard.php?action=sync_note_tags', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Update currentNoteTags with the definitive list from server
                currentNoteTags = data.tags || [];
                renderCurrentNoteTags();
                // Potentially update sidebar tag list if new global tags were created
                // loadInitialData() called by saveCurrentNote will handle this.
                showGlobalNotification(data.message || 'Tags synced!', 'success');
            } else {
                showGlobalNotification(data.message || 'Failed to sync tags.', 'error');
            }
            return data; // Return data for promise chaining
        })
        .catch(error => {
            console.error('Error syncing tags:', error);
            showGlobalNotification('An error occurred while syncing tags.', 'error');
            throw error; // Re-throw for promise chain
        });
    }


    function deleteCurrentNote() {
        if (!currentNoteId) {
            showGlobalNotification("No note selected to delete.", "info");
            return;
        }
        // Using confirm is okay for destructive actions, but a custom modal could be used for consistency.
        if (!confirm(`Are you sure you want to delete the note "${escapeHTML(noteTitleInput.value)}"?`)) {
            return;
        }
        const formData = new FormData();
        formData.append('id', currentNoteId);

        fetch(`../php/dashboard.php?action=delete_note`, { method: 'POST', body: formData })
            .then(response => response.json())
            .then(result => {
                if (result.success) {
                    showGlobalNotification('Note deleted successfully!', 'success');
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
    function setupEventListeners() {
        if (newNoteBtn) {
            newNoteBtn.addEventListener('click', () => {
                updateEditorState(null); // Clear editor for a new note
                setActiveNoteListItem(null); // Deselect any active note in list
                noteTitleInput.focus();
            });
        }

        if (saveNoteBtn) {
            saveNoteBtn.addEventListener('click', saveCurrentNote);
        }
        if (deleteNoteBtn) {
            deleteNoteBtn.addEventListener('click', deleteCurrentNote);
        }

        if (shareNoteBtn) {
            shareNoteBtn.addEventListener('click', () => {
                if (!currentNoteId) {
                    showGlobalNotification("Please select a note to share.", "info");
                    return;
                }
                if (currentNoteIsSharedWithUser) { // Should not happen as button is hidden
                    showGlobalNotification("This note is already shared with you and cannot be re-shared.", "info");
                    return;
                }
                if (shareNoteModal && shareNoteIdInput && shareNoteForm) {
                    shareNoteForm.reset();
                    shareNoteIdInput.value = currentNoteId;
                    shareNoteModal.style.display = 'flex';
                    if(shareWithUserInput) shareWithUserInput.focus();
                }
            });
        }

        // New Folder Modal listeners
        if (newFolderBtn && newFolderModal && closeNewFolderModalBtn && confirmNewFolderBtn && newFolderNameInput) {
            newFolderBtn.addEventListener('click', () => {
                newFolderNameInput.value = '';
                newFolderModal.style.display = 'flex';
                newFolderNameInput.focus();
            });
            closeNewFolderModalBtn.addEventListener('click', () => {
                newFolderModal.style.display = 'none';
            });
            confirmNewFolderBtn.addEventListener('click', () => {
                const folderName = newFolderNameInput.value.trim();
                if (folderName) {
                    createFolder(folderName);
                } else {
                    showGlobalNotification("Folder name cannot be empty.", "error");
                }
            });
        }

        // Rename Folder Modal listeners
        if (renameFolderModal && closeRenameFolderModalBtn && confirmRenameFolderBtn && renameFolderNameInput) {
            closeRenameFolderModalBtn.addEventListener('click', () => {
                renameFolderModal.style.display = 'none';
            });
            confirmRenameFolderBtn.addEventListener('click', () => {
                const newName = renameFolderNameInput.value.trim();
                const folderId = renameFolderIdInput.value;
                if (newName && folderId) {
                    renameFolder(folderId, newName);
                } else {
                    showGlobalNotification("Folder name cannot be empty.", "error");
                }
            });
        }

        // Generic modal closing by clicking outside
        [newFolderModal, renameFolderModal, shareNoteModal].forEach(modal => {
            if (modal) {
                const closeBtn = modal.querySelector('.close-button');
                if (closeBtn) {
                    closeBtn.addEventListener('click', () => modal.style.display = 'none');
                }
                window.addEventListener('click', (event) => {
                    if (event.target == modal) {
                        modal.style.display = 'none';
                    }
                });
            }
        });

        if (folderListUl) {
            folderListUl.addEventListener('click', (e) => {
                // Navigate if 'A' or 'SPAN' inside 'A' is clicked, but not buttons inside 'A'
                const anchor = e.target.closest('a[data-folder-id]');
                if (anchor && !e.target.closest('button')) {
                    e.preventDefault();
                    const folderId = anchor.dataset.folderId;
                    setActiveFolderListItem(folderId);
                    filterNotesByFolder(folderId);
                }
            });
        }

        if (tagListUl) {
            tagListUl.addEventListener('click', (e) => {
                if (e.target.tagName === 'A' && e.target.dataset.tagId) {
                    e.preventDefault();
                    const folderId = e.target.dataset.folderId;
                    setActiveFolderListItem(folderId);
                    filterNotesByFolder(folderId);
                }
            });
        }

        if (tagListUl) {
            tagListUl.addEventListener('click', (e) => {
                if (e.target.closest('a[data-tag-id]')) {
                    e.preventDefault();
                    const tagName = e.target.closest('a[data-tag-id]').dataset.tagName; // Using data-tag-name
                    if (!tagName) return;

                    // Toggle tag in activeFilterTags
                    if (activeFilterTags.includes(tagName)) {
                        activeFilterTags = activeFilterTags.filter(t => t !== tagName);
                        e.target.closest('a[data-tag-id]').classList.remove('active-filter');
                    } else {
                        activeFilterTags.push(tagName);
                        e.target.closest('a[data-tag-id]').classList.add('active-filter');
                    }

                    filterNotesByActiveTags();
                    updateClearTagFiltersButton();
                }
            });
        }

        const clearTagFiltersBtn = document.getElementById('clearTagFiltersBtn');
        if (clearTagFiltersBtn) {
            clearTagFiltersBtn.addEventListener('click', () => {
                activeFilterTags = [];
                document.querySelectorAll('#tagList a.active-filter').forEach(el => el.classList.remove('active-filter'));
                filterNotesByActiveTags(); // Will show all notes as no tags are active
                updateClearTagFiltersButton();
                // Also ensure folder filter is reset or considered
                const activeFolderLink = folderListUl.querySelector('a.active');
                if (activeFolderLink && activeFolderLink.dataset.folderId !== 'all') {
                    // If a specific folder is active, re-filter by it, otherwise all notes are shown
                    // This part depends on desired interaction between tag and folder filters
                } else {
                     renderNoteList(allNotes); // If "All Notes" was active for folders
                }
            });
        }

        // Editor Formatting Buttons
        if (formatBoldBtn) {
            formatBoldBtn.addEventListener('click', () => applyMarkdownFormatting('**', '**'));
        }
        if (formatItalicBtn) {
            formatItalicBtn.addEventListener('click', () => applyMarkdownFormatting('*', '*'));
        }
        if (formatUnderlineBtn) {
            formatUnderlineBtn.addEventListener('click', () => applyMarkdownFormatting('__', '__'));
        }
        // Keyboard shortcuts for formatting
        if (noteContentTextarea) {
            noteContentTextarea.addEventListener('keydown', function(e) {
                if (e.ctrlKey || e.metaKey) { // Ctrl or Cmd
                    switch (e.key.toLowerCase()) {
                        case 'b':
                            e.preventDefault();
                            applyMarkdownFormatting('**', '**');
                            break;
                        case 'i':
                            e.preventDefault();
                            applyMarkdownFormatting('*', '*');
                            break;
                        case 'u':
                            e.preventDefault();
                            applyMarkdownFormatting('__', '__');
                            break;
                    }
                }
            });
        }


        if (noteTagsInput) {
            noteTagsInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    const tagName = noteTagsInput.value.trim().toLowerCase();
                    if (tagName) {
                        // Check if tag already exists in currentNoteTags (by name)
                        if (!currentNoteTags.some(t => t.name === tagName)) {
                            // For UI, we add it with a temporary/null ID if it's new,
                            // or find its ID if it's a known global tag.
                            // The backend sync will handle actual ID creation/lookup.
                            currentNoteTags.push({ id: null, name: tagName }); // id will be resolved by backend
                            renderCurrentNoteTags();
                        }
                        noteTagsInput.value = '';
                    }
                }
            });

            noteTagsInput.addEventListener('input', handleTagInput);
            noteTagsInput.addEventListener('keydown', handleTagInputKeyDown);
            noteTagsInput.addEventListener('blur', () => { // Hide suggestions when input loses focus
                setTimeout(() => { // Timeout to allow click on suggestion
                    if (tagSuggestionsUl) tagSuggestionsUl.style.display = 'none';
                }, 150);
            });
        }


        if (searchNotesInput) {
            searchNotesInput.addEventListener('input', (e) => {
                filterNotesBySearch(e.target.value);
            });
        }
    }

    function createFolder(folderName) {
        const formData = new FormData();
        formData.append('name', folderName);

        fetch('../php/dashboard.php?action=create_folder', { method: 'POST', body: formData})
            .then(response => response.json())
            .then(result => {
                if (result.success) {
                    // alert("Folder created!"); // Or use a less intrusive notification
                    if (newFolderModal) newFolderModal.style.display = 'none';
                    loadInitialData(); // Refresh folder list (and other data)
                } else {
                    showGlobalNotification(result.message || "Failed to create folder.", 'error');
                }
            })
            .catch(error => {
                console.error('Error creating folder:', error);
                showGlobalNotification("An error occurred while creating the folder.", 'error');
            });
    }

    function openRenameFolderModal(folderId, currentName) {
        if (renameFolderModal && renameFolderNameInput && renameFolderIdInput) {
            renameFolderNameInput.value = currentName;
            renameFolderIdInput.value = folderId;
            renameFolderModal.style.display = 'flex';
            renameFolderNameInput.focus();
        }
    }

    function renameFolder(folderId, newName) {
        const formData = new FormData();
        formData.append('folder_id', folderId);
        formData.append('name', newName);

        fetch('../php/dashboard.php?action=update_folder', { method: 'POST', body: formData})
            .then(response => response.json())
            .then(result => {
                if (result.success) {
                    if (renameFolderModal) renameFolderModal.style.display = 'none';
                    loadInitialData(); // Refresh data
                } else {
                    showGlobalNotification(result.message || "Failed to rename folder.", 'error');
                }
            })
            .catch(error => {
                console.error('Error renaming folder:', error);
                showGlobalNotification("An error occurred while renaming the folder.", 'error');
            });
    }

    function confirmDeleteFolder(folderId, folderName) {
        if (confirm(`Are you sure you want to delete the folder "${escapeHTML(folderName)}"? Notes in this folder will be moved to "All Notes".`)) {
            deleteFolder(folderId);
        }
    }

    function deleteFolder(folderId) {
        const formData = new FormData();
        formData.append('folder_id', folderId);

        fetch('../php/dashboard.php?action=delete_folder', { method: 'POST', body: formData})
            .then(response => response.json())
            .then(result => {
                if (result.success) {
                    showGlobalNotification(result.message || 'Folder deleted successfully!', 'success');
                    loadInitialData(); // Refresh data
                } else {
                    showGlobalNotification(result.message || "Failed to delete folder.", 'error');
                }
            })
            .catch(error => {
                console.error('Error deleting folder:', error);
                showGlobalNotification("An error occurred while deleting the folder.", 'error');
            });
    }

    function filterNotesByFolder(folderId) {
        let notesToDisplay;
        if (folderId === 'all') {
            notesToDisplay = allNotes;
        } else {
            notesToDisplay = allNotes.filter(note => note.folder_id == folderId);
        }
        renderNoteList(notesToDisplay);

        updateEditorState(null); // Clear editor when changing folders
        setActiveNoteListItem(null); // Deselect any active note in list
    }

    function filterNotesBySearch(searchTerm) {
        const lowerSearchTerm = searchTerm.toLowerCase();
        const filteredNotes = allNotes.filter(note => {
            const titleMatch = note.title && note.title.toLowerCase().includes(lowerSearchTerm);
            const contentMatch = note.snippet && note.snippet.toLowerCase().includes(lowerSearchTerm); // Search snippet for performance
            // const fullContentMatch = note.content && note.content.toLowerCase().includes(lowerSearchTerm); // More thorough
            const tagMatch = note.tags && note.tags.some(tag => tag.name.toLowerCase().includes(lowerSearchTerm));
            return titleMatch || contentMatch || tagMatch;
        });
        renderNoteList(filteredNotes);
        updateEditorState(null); // Clear editor when searching
        setActiveNoteListItem(null);
    }

    function filterNotesByActiveTags() {
        if (activeFilterTags.length === 0) {
            renderNoteList(allNotes); // Show all notes if no filter is active
        } else {
            const filteredNotes = allNotes.filter(note => {
                if (!note.tags || note.tags.length === 0) return false;
                // Check if the note has ALL active filter tags (AND logic)
                return activeFilterTags.every(filterTag =>
                    note.tags.some(noteTag => noteTag.name.toLowerCase() === filterTag.toLowerCase())
                );
            });
            renderNoteList(filteredNotes);
        }
        updateEditorState(null); // Clear editor when filtering
        setActiveNoteListItem(null);
    }

    function updateClearTagFiltersButton() {
        const clearTagFiltersBtn = document.getElementById('clearTagFiltersBtn');
        if (clearTagFiltersBtn) {
            clearTagFiltersBtn.style.display = activeFilterTags.length > 0 ? 'inline-block' : 'none';
        }
    }


    // --- Tag Autocomplete Logic ---
    let suggestionIdx = -1;

    function applyMarkdownFormatting(prefix, suffix) {
        if (!noteContentTextarea || noteContentTextarea.disabled) return;

        const start = noteContentTextarea.selectionStart;
        const end = noteContentTextarea.selectionEnd;
        const selectedText = noteContentTextarea.value.substring(start, end);
        const textBefore = noteContentTextarea.value.substring(0, start);
        const textAfter = noteContentTextarea.value.substring(end);

        // If selected text is already wrapped, unwrap it
        // Also handle cases where the prefix/suffix might be part of a larger word if no text is selected.
        // This simple version just toggles if the exact selection matches.
        if (selectedText.length > 0 && selectedText.startsWith(prefix) && selectedText.endsWith(suffix)) {
            const unwrappedText = selectedText.substring(prefix.length, selectedText.length - suffix.length);
            noteContentTextarea.value = textBefore + unwrappedText + textAfter;
            noteContentTextarea.selectionStart = start;
            noteContentTextarea.selectionEnd = start + unwrappedText.length;
        } else if (selectedText.length === 0 && textBefore.endsWith(prefix) && textAfter.startsWith(suffix)) {
             // If no selection, and cursor is inside existing markers, remove them
            const textBeforeUnwrapped = textBefore.substring(0, textBefore.length - prefix.length);
            const textAfterUnwrapped = textAfter.substring(suffix.length);
            noteContentTextarea.value = textBeforeUnwrapped + textAfterUnwrapped;
            noteContentTextarea.selectionStart = start - prefix.length;
            noteContentTextarea.selectionEnd = start - prefix.length;
        }
        else { // Wrap selected text or insert markers if no selection
            noteContentTextarea.value = textBefore + prefix + selectedText + suffix + textAfter;
            if (selectedText.length === 0) { // If no text was selected, place cursor in middle
                noteContentTextarea.selectionStart = start + prefix.length;
                noteContentTextarea.selectionEnd = start + prefix.length;
            } else {
                noteContentTextarea.selectionStart = start + prefix.length;
                noteContentTextarea.selectionEnd = start + prefix.length + selectedText.length;
            }
        }
        noteContentTextarea.focus();
        // Trigger input event for any auto-saving or change detection logic if needed
        noteContentTextarea.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function handleTagInput() {
        if (!noteTagsInput || !tagSuggestionsUl || !allUserUniqueTags) return;
        const inputText = noteTagsInput.value.trim().toLowerCase();
        tagSuggestionsUl.innerHTML = '';
        suggestionIdx = -1; // Reset keyboard navigation index

        if (!inputText) {
            tagSuggestionsUl.style.display = 'none';
            return;
        }

        const suggestions = allUserUniqueTags.filter(tag =>
            tag.name.toLowerCase().includes(inputText) &&
            !currentNoteTags.some(currentTag => currentTag.name === tag.name.toLowerCase()) // Don't suggest already added tags
        );

        if (suggestions.length > 0) {
            suggestions.slice(0, 5).forEach(tag => { // Show max 5 suggestions
                const li = document.createElement('li');
                li.textContent = tag.name;
                li.addEventListener('mousedown', () => { // Mousedown to fire before blur
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

    function handleTagInputKeyDown(e) {
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
            items[suggestionIdx].dispatchEvent(new Event('mousedown')); // Trigger the mousedown event
        } else if (e.key === 'Escape') {
            tagSuggestionsUl.style.display = 'none';
        }
    }

    function updateSuggestionSelection(items) {
        items.forEach((item, index) => {
            if (index === suggestionIdx) {
                item.classList.add('selected');
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.classList.remove('selected');
            }
        });
    }

    function addTagToCurrentNote(tagName) {
        const normalizedTagName = tagName.trim().toLowerCase();
        if (normalizedTagName && !currentNoteTags.some(t => t.name === normalizedTagName)) {
            // Check if tag exists in allUserUniqueTags to get its ID, otherwise id is null for new tags
            const existingGlobalTag = allUserUniqueTags.find(globalTag => globalTag.name === normalizedTagName);
            currentNoteTags.push({ id: existingGlobalTag ? existingGlobalTag.id : null, name: normalizedTagName });
            renderCurrentNoteTags();
        }
    }


    // --- Utility Functions ---
    function escapeHTML(str) {
        if (str === null || str === undefined) return '';
        return String(str).replace(/[&<>"']/g, function (match) {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            }[match];
        });
    }

    // --- Start the application ---
    initializeDashboard();
});

// --- Global Notification Function ---
let notificationTimeout;
function showGlobalNotification(message, type = 'info', duration = 3000) {
    const notificationElement = document.getElementById('globalNotification');
    if (!notificationElement) return;

    clearTimeout(notificationTimeout); // Clear existing timeout

    notificationElement.textContent = message;
    notificationElement.className = 'global-notification'; // Reset classes
    notificationElement.classList.add(type); // 'success', 'error', or 'info'

    // Adjust top if fixed header exists (like .app-header)
    const header = document.querySelector('.app-header');
    if (header && getComputedStyle(header).position === 'fixed') {
        notificationElement.style.top = `${header.offsetHeight}px`;
    } else {
        notificationElement.style.top = '0px';
    }

    notificationElement.style.display = 'block';

    notificationTimeout = setTimeout(() => {
        notificationElement.style.display = 'none';
        notificationElement.style.top = '0px'; // Reset top for next time
    }, duration);
}


// Add to php/dashboard.php for new actions:
// get_note_content, update_note, delete_note, create_folder, (get_tags - if not in initial)

// Example for get_note_content in php/dashboard.php
/*
    if ($_GET['action'] === 'get_note_content' && isset($_GET['id'])) {
        $note_id = $_GET['id'];
        try {
            $stmt = $pdo->prepare("SELECT id, title, content, folder_id, created_at, updated_at FROM notes WHERE id = ? AND user_id = ?");
            $stmt->execute([$note_id, $user_id]);
            $note = $stmt->fetch();
            if ($note) {
                echo json_encode(['success' => true, 'note' => $note]);
            } else {
                echo json_encode(['success' => false, 'message' => 'Note not found or access denied.']);
            }
        } catch (PDOException $e) {
            log_error("Error fetching note content: " . $e->getMessage(), __FILE__, __LINE__);
            echo json_encode(['success' => false, 'message' => 'Database error fetching note.']);
        }
        exit;
    }
*/

// Example for update_note in php/dashboard.php
/*
    if ($_GET['action'] === 'update_note' && isset($_GET['id']) && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $note_id = $_GET['id'];
        $title = $_POST['title'] ?? 'Untitled Note';
        $content = $_POST['content'] ?? '';
        // $folder_id = $_POST['folder_id'] ?? null; // Handle folder update if applicable

        try {
            $stmt = $pdo->prepare("UPDATE notes SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?");
            if ($stmt->execute([$title, $content, $note_id, $user_id])) {
                if ($stmt->rowCount() > 0) {
                    echo json_encode(['success' => true, 'message' => 'Note updated successfully.']);
                } else {
                    echo json_encode(['success' => false, 'message' => 'Note not found or no changes made.']);
                }
            } else {
                echo json_encode(['success' => false, 'message' => 'Failed to update note.']);
            }
        } catch (PDOException $e) {
            log_error("Error updating note: " . $e->getMessage(), __FILE__, __LINE__);
            echo json_encode(['success' => false, 'message' => 'Database error updating note.']);
        }
        exit;
    }
*/

// Example for delete_note in php/dashboard.php
/*
    if ($_GET['action'] === 'delete_note' && isset($_GET['id']) && $_SERVER['REQUEST_METHOD'] === 'POST') { // Or use DELETE method
        $note_id = $_GET['id'];
        try {
            $stmt = $pdo->prepare("DELETE FROM notes WHERE id = ? AND user_id = ?");
            if ($stmt->execute([$note_id, $user_id])) {
                if ($stmt->rowCount() > 0) {
                    echo json_encode(['success' => true, 'message' => 'Note deleted successfully.']);
                } else {
                    echo json_encode(['success' => false, 'message' => 'Note not found or already deleted.']);
                }
            } else {
                echo json_encode(['success' => false, 'message' => 'Failed to delete note.']);
            }
        } catch (PDOException $e) {
            log_error("Error deleting note: " . $e->getMessage(), __FILE__, __LINE__);
            echo json_encode(['success' => false, 'message' => 'Database error deleting note.']);
        }
        exit;
    }
*/

// Example for create_folder in php/dashboard.php
/*
    if ($_GET['action'] === 'create_folder' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        $folder_name = trim($_POST['name'] ?? '');
        if (empty($folder_name)) {
            echo json_encode(['success' => false, 'message' => 'Folder name cannot be empty.']);
            exit;
        }
        try {
            // Check if folder with same name already exists for this user
            $stmt_check = $pdo->prepare("SELECT id FROM folders WHERE user_id = ? AND name = ?");
            $stmt_check->execute([$user_id, $folder_name]);
            if ($stmt_check->fetch()) {
                echo json_encode(['success' => false, 'message' => 'A folder with this name already exists.']);
                exit;
            }

            $stmt = $pdo->prepare("INSERT INTO folders (user_id, name) VALUES (?, ?)");
            if ($stmt->execute([$user_id, $folder_name])) {
                echo json_encode(['success' => true, 'message' => 'Folder created successfully.', 'folder_id' => $pdo->lastInsertId()]);
            } else {
                echo json_encode(['success' => false, 'message' => 'Failed to create folder.']);
            }
        } catch (PDOException $e) {
            log_error("Error creating folder: " . $e->getMessage(), __FILE__, __LINE__);
            echo json_encode(['success' => false, 'message' => 'Database error creating folder.']);
        }
        exit;
    }
*/
