document.addEventListener('DOMContentLoaded', function() {
    // --- DOM Elements ---
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

    // Share Note Modal Elements
    const shareNoteModal = document.getElementById('shareNoteModal');
    const shareNoteForm = document.getElementById('shareNoteForm');
    const closeShareNoteModalBtn = shareNoteModal ? shareNoteModal.querySelector('.close-button[data-modal-id="shareNoteModal"]') : null;
    const shareNoteIdInput = document.getElementById('shareNoteIdInput'); // Hidden input in share form
    const shareWithUserInput = document.getElementById('shareWithUserInput'); // Text input for username/email
    const currentlySharedWithListUl = document.getElementById('currentlySharedWithList');
    const noSharedUsersMsgLi = document.getElementById('noSharedUsersMsg');


    // Note Editor Toolbar Buttons
    const formatBoldBtn = document.getElementById('formatBoldBtn');
    const formatItalicBtn = document.getElementById('formatItalicBtn');
    const formatUnderlineBtn = document.getElementById('formatUnderlineBtn');

    // --- State Variables ---
    let currentNoteId = null;
    let currentNoteIsSharedWithUser = false;
    let currentNoteTags = [];
    let activeFilterTags = [];
    let currentUser = null;
    let allNotes = [];
    let allFolders = [];
    let allUserUniqueTags = [];

    // --- Initialization ---
    function initializeDashboard() {
        fetchUserData();
        loadInitialData();
        setupEventListeners();
        updateEditorState(null);
        if(document.getElementById('currentYear')) {
            document.getElementById('currentYear').textContent = new Date().getFullYear();
        }
    }

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
                } else if (!data.success) {
                    console.error('Failed to fetch user info:', data.message);
                }
            })
            .catch(error => {
                console.error('Error fetching user data:', error);
            });
    }

    function loadInitialData() {
        fetch('../php/dashboard.php?action=get_initial_data')
            .then(response => response.json())
            .then(result => {
                if (result.success) {
                    allNotes = result.data.notes || [];
                    allFolders = result.data.folders || [];
                    allUserUniqueTags = result.data.tags || [];

                    renderFolders(allFolders);
                    renderTagsSidebar(allUserUniqueTags);
                    renderNoteList(allNotes);

                    if (allNotes.length > 0) {
                        // updateEditorState(null);
                        // setActiveNoteListItem(null);
                    } else {
                        updateEditorState(null);
                    }
                } else {
                    console.error('Failed to load initial data:', result.message);
                    showGlobalNotification(result.message || 'Failed to load data.', 'error');
                }
            })
            .catch(error => {
                console.error('Error loading initial data:', error);
                showGlobalNotification('Error loading initial data.', 'error');
            });
    }

    // --- Rendering Functions ---
    function renderFolders(folders) {
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

    function renderTagsSidebar(tags) {
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
            removeBtn.style.display = (currentNoteIsSharedWithUser && noteTitleInput && noteTitleInput.disabled) ? 'none' : 'inline';
            removeBtn.addEventListener('click', () => {
                currentNoteTags = currentNoteTags.filter(t => t.id !== tag.id || (t.id === null && t.name !== tag.name) );
                renderCurrentNoteTags();
            });
            pill.appendChild(removeBtn);
            currentNoteTagsDisplay.appendChild(pill);
        });
    }

    function renderNoteList(notesToRender) {
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

            if (note.note_status === 'shared') {
                titleHTML += `<small class="shared-indicator">(Shared by ${escapeHTML(note.shared_by_username)})</small>`;
                li.classList.add('shared-note-item');
            }

            li.innerHTML = `
                ${titleHTML}
                <p>${escapeHTML(note.snippet) || 'No additional text'}</p>
                <small>${date}</small>
            `;
            li.addEventListener('click', () => {
                loadNoteIntoEditor(note.id);
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
        const noteToLoad = allNotes.find(n => n.id == noteId);
        if (noteToLoad) {
            fetch(`../php/dashboard.php?action=get_note_content&id=${noteToLoad.id}`)
            .then(response => response.json())
            .then(result => {
                if (result.success && result.note) {
                    result.note.note_status = noteToLoad.note_status || 'owner';
                    result.note.permission = noteToLoad.permission || null;
                    result.note.shared_by_username = noteToLoad.shared_by_username || null; // Carry over for UI if needed
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
            console.warn(`Note with ID ${noteId} not found in local cache for loading.`);
            updateEditorState(null);
        }
    }

    function updateEditorState(noteData) {
        if (!noteEditorPanel || !editorContentWrapper) return;

        if (noteData && noteData.id) {
            noteEditorPanel.classList.remove('empty');
            editorContentWrapper.style.display = 'flex';

            currentNoteId = noteData.id;
            if (noteTitleInput) noteTitleInput.value = noteData.title || '';
            if (noteContentTextarea) noteContentTextarea.value = noteData.content || '';
            if (noteFolderSelect) noteFolderSelect.value = noteData.folder_id || "";

            currentNoteTags = noteData.tags || [];
            renderCurrentNoteTags();
            if (noteTagsInput) noteTagsInput.value = '';

            if (noteLastUpdated) {
                noteLastUpdated.textContent = `Last updated: ${new Date(noteData.updated_at).toLocaleString()}`;
            }

            currentNoteIsSharedWithUser = (noteData.note_status === 'shared');
            const isReadOnly = currentNoteIsSharedWithUser && noteData.permission === 'read';

            if (noteTitleInput) noteTitleInput.disabled = isReadOnly;
            if (noteContentTextarea) noteContentTextarea.disabled = isReadOnly;
            if (noteFolderSelect) noteFolderSelect.disabled = isReadOnly;
            if (noteTagsInput) noteTagsInput.disabled = isReadOnly;

            currentNoteTagsDisplay.querySelectorAll('.remove-tag-btn').forEach(btn => btn.style.display = isReadOnly ? 'none' : 'inline');

            if (saveNoteBtn) saveNoteBtn.style.display = isReadOnly ? 'none' : 'inline-block';
            if (shareNoteBtn) shareNoteBtn.style.display = currentNoteIsSharedWithUser ? 'none' : 'inline-block';
            if (deleteNoteBtn) deleteNoteBtn.style.display = currentNoteIsSharedWithUser ? 'none' : 'inline-block';
            if (downloadNoteBtn) downloadNoteBtn.style.display = 'inline-block';

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
            if (shareNoteBtn) shareNoteBtn.style.display = 'inline-block';
            if (deleteNoteBtn) deleteNoteBtn.style.display = 'inline-block';
            if (downloadNoteBtn) downloadNoteBtn.style.display = 'none';
        }
    }

    function saveCurrentNote() {
        if (!noteTitleInput || !noteContentTextarea || !noteFolderSelect || (noteTitleInput.disabled)) return;

        const title = noteTitleInput.value.trim();
        const content = noteContentTextarea.value;
        const folderId = noteFolderSelect.value;
        const tagNamesToSend = currentNoteTags.map(tag => tag.name);
        let url;

        const formData = new FormData();
        formData.append('title', title);
        formData.append('content', content);
        if (folderId) formData.append('folder_id', folderId);

        if (currentNoteId) {
            url = `../php/dashboard.php?action=update_note`;
            formData.append('note_id', currentNoteId);
        } else {
            url = '../php/dashboard.php?action=create_note';
        }

        fetch(url, { method: 'POST', body: formData })
            .then(response => response.json())
            .then(result => {
                if (result.success) {
                    showGlobalNotification(result.message || 'Note saved!', 'success');
                    const savedNoteId = result.note_id || currentNoteId;

                    if (savedNoteId) {
                        syncTagsForNote(savedNoteId, tagNamesToSend).then(() => {
                            loadInitialData();
                            setTimeout(() => {
                                setActiveNoteListItem(savedNoteId);
                                loadNoteIntoEditor(savedNoteId);
                            }, 100);
                        }).catch(() => loadInitialData());
                    } else {
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
        formData.append('tags', JSON.stringify(tagsArray));

        return fetch('../php/dashboard.php?action=sync_note_tags', { method: 'POST', body: formData })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                currentNoteTags = data.tags || []; // Update local tags with definitive list from server
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

    function deleteCurrentNote() {
        if (!currentNoteId || (noteTitleInput && noteTitleInput.disabled)) {
            showGlobalNotification("No note selected or cannot delete this note.", "info");
            return;
        }
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
                updateEditorState(null);
                setActiveNoteListItem(null);
                if(noteTitleInput) noteTitleInput.focus();
            });
        }

        if (saveNoteBtn) saveNoteBtn.addEventListener('click', saveCurrentNote);
        if (deleteNoteBtn) deleteNoteBtn.addEventListener('click', deleteCurrentNote);

        if (downloadNoteBtn) {
            downloadNoteBtn.addEventListener('click', () => {
                if (currentNoteId) {
                    window.location.href = `../php/dashboard.php?action=download_note&id=${currentNoteId}`;
                } else {
                    showGlobalNotification("No note selected to download.", "info");
                }
            });
        }

        if (shareNoteBtn) {
            shareNoteBtn.addEventListener('click', () => {
                if (!currentNoteId) {
                    showGlobalNotification("Please select a note to share.", "info");
                    return;
                }
                if (currentNoteIsSharedWithUser) {
                    showGlobalNotification("This note is shared with you and cannot be re-shared.", "info");
                    return;
                }
                openShareModal(); // Call helper to open and populate
            });
        }

        if (newFolderBtn && newFolderModal && closeNewFolderModalBtn && confirmNewFolderBtn && newFolderNameInput) {
            newFolderBtn.addEventListener('click', () => {
                if(newFolderNameInput) newFolderNameInput.value = '';
                if(newFolderModal) {
                    const form = newFolderModal.querySelector('form');
                    if(form) clearFormErrors(form);
                    newFolderModal.style.display = 'flex';
                    if(newFolderNameInput) newFolderNameInput.focus();
                }
            });
        }
        if (closeNewFolderModalBtn) {
            closeNewFolderModalBtn.addEventListener('click', () => {
                if (newFolderModal) newFolderModal.style.display = 'none';
            });
        }
        if (confirmNewFolderBtn && newFolderNameInput) {
             confirmNewFolderBtn.addEventListener('click', () => {
                const folderName = newFolderNameInput.value.trim();
                if (folderName) {
                    createFolder(folderName);
                } else {
                    showGlobalNotification("Folder name cannot be empty.", "error");
                }
            });
        }

        if (closeRenameFolderModalBtn && renameFolderModal) {
            closeRenameFolderModalBtn.addEventListener('click', () => {
                if (renameFolderModal) renameFolderModal.style.display = 'none';
            });
        }
        if (confirmRenameFolderBtn && renameFolderNameInput && renameFolderIdInput && renameFolderModal) {
            const form = renameFolderModal.querySelector('form');
            if (form) { // Check if form exists before adding listener
                form.addEventListener('submit', (e) => { // Assuming rename modal also has a form
                     e.preventDefault();
                     const newName = renameFolderNameInput.value.trim();
                     const folderId = renameFolderIdInput.value;
                     if (newName && folderId) {
                         renameFolder(folderId, newName);
                     } else {
                         showGlobalNotification("Folder name cannot be empty.", "error");
                     }
                });
            } else if (confirmRenameFolderBtn) { // Fallback if no form, direct button click
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
        }

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

        if (shareNoteForm) {
            shareNoteForm.addEventListener('submit', function(e) {
                e.preventDefault();
                const formData = new FormData(shareNoteForm);
                fetch('../php/dashboard.php?action=share_note', { method: 'POST', body: formData })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        showGlobalNotification(data.message || 'Note shared successfully!', 'success');
                        if (shareNoteModal) shareNoteModal.style.display = 'none';
                        // Refresh shared users list in modal if it was open for the same note
                        if(currentNoteId && shareNoteIdInput && shareNoteIdInput.value == currentNoteId) {
                            loadSharedWithUsers(currentNoteId);
                        }
                        loadInitialData(); // To reflect shared status in main list
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

        if (folderListUl) {
            folderListUl.addEventListener('click', (e) => {
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
                }
            });
        }

        const clearTagFiltersBtn = document.getElementById('clearTagFiltersBtn');
        if (clearTagFiltersBtn) {
            clearTagFiltersBtn.addEventListener('click', () => {
                activeFilterTags = [];
                document.querySelectorAll('#tagList a.active-filter').forEach(el => el.classList.remove('active-filter'));
                updateClearTagFiltersButton();
                // Re-apply current folder filter or show all notes
                const activeFolderLink = folderListUl.querySelector('a.active');
                if (activeFolderLink) {
                    filterNotesByFolder(activeFolderLink.dataset.folderId);
                } else {
                    filterNotesByActiveTags(); // Should show all if folder was also all
                }
            });
        }

        if (formatBoldBtn) formatBoldBtn.addEventListener('click', () => applyMarkdownFormatting('**', '**'));
        if (formatItalicBtn) formatItalicBtn.addEventListener('click', () => applyMarkdownFormatting('*', '*'));
        if (formatUnderlineBtn) formatUnderlineBtn.addEventListener('click', () => applyMarkdownFormatting('__', '__'));

        if (noteContentTextarea) {
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

        if (noteTagsInput) {
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

        if (searchNotesInput) {
            searchNotesInput.addEventListener('input', (e) => {
                filterNotesBySearch(e.target.value);
            });
        }
    }

    // --- Folder Functions ---
    function createFolder(folderName) {
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

    function openRenameFolderModal(folderId, currentName) {
        if (renameFolderModal && renameFolderNameInput && renameFolderIdInput) {
            renameFolderNameInput.value = currentName;
            renameFolderIdInput.value = folderId;
            const form = renameFolderModal.querySelector('form');
            if(form) clearFormErrors(form);
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

    function filterNotesByFolder(folderId) {
        activeFilterTags = [];
        document.querySelectorAll('#tagList a.active-filter').forEach(el => el.classList.remove('active-filter'));
        updateClearTagFiltersButton();

        let notesToDisplay;
        if (folderId === 'all') {
            notesToDisplay = allNotes;
        } else {
             // When a specific folder is selected, only show notes in that folder.
             // Shared notes might not have a folder_id relevant to the current user's folders.
             // So, for now, specific folder views will primarily show owned notes.
            notesToDisplay = allNotes.filter(note => note.folder_id == folderId && note.note_status === 'owner');
        }
        renderNoteList(notesToDisplay);
        updateEditorState(null);
        setActiveNoteListItem(null);
    }

    function filterNotesByActiveTags() {
        let notesToFilter = [];
        const activeFolderLink = folderListUl.querySelector('a.active');
        const activeFolderId = (activeFolderLink && activeFolderLink.dataset.folderId !== 'all')
                               ? activeFolderLink.dataset.folderId
                               : null;

        if (activeFolderId) { // If a specific folder is active, filter within it
            notesToFilter = allNotes.filter(note => note.folder_id == activeFolderId && note.note_status === 'owner');
        } else { // Otherwise, filter all notes (owned and shared with user)
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

    function updateClearTagFiltersButton() {
        const clearTagFiltersBtn = document.getElementById('clearTagFiltersBtn');
        if (clearTagFiltersBtn) {
            clearTagFiltersBtn.style.display = activeFilterTags.length > 0 ? 'inline-block' : 'none';
        }
    }

    function filterNotesBySearch(searchTerm) {
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

    // --- Tag Autocomplete & Formatting Logic ---
    let suggestionIdx = -1;

    function applyMarkdownFormatting(prefix, suffix) {
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

    function handleTagInput() {
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
            items[suggestionIdx].dispatchEvent(new Event('mousedown'));
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
            const existingGlobalTag = allUserUniqueTags.find(globalTag => globalTag.name === normalizedTagName);
            currentNoteTags.push({ id: existingGlobalTag ? existingGlobalTag.id : null, name: normalizedTagName });
            renderCurrentNoteTags();
        }
    }

    // --- Share Modal Specific Functions ---
    function openShareModal() {
        if (shareNoteModal && shareNoteIdInput && shareNoteForm) {
            shareNoteForm.reset(); // Clear previous input
            if(currentlySharedWithListUl) currentlySharedWithListUl.innerHTML = ''; // Clear previous list
            if(noSharedUsersMsgLi) noSharedUsersMsgLi.style.display = 'block';

            shareNoteIdInput.value = currentNoteId;
            loadSharedWithUsers(currentNoteId); // Fetch and display users this note is shared with
            shareNoteModal.style.display = 'flex';
            if(shareWithUserInput) shareWithUserInput.focus();
        }
    }

    function loadSharedWithUsers(noteId) {
        if (!currentlySharedWithListUl || !noSharedUsersMsgLi) return;

        fetch(`../php/dashboard.php?action=get_shared_with_users&note_id=${noteId}`)
            .then(response => response.json())
            .then(data => {
                currentlySharedWithListUl.innerHTML = ''; // Clear before populating
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
                } else if (data.success) { // Success but no users
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

    function confirmRevokeAccess(noteId, sharedUserId, username) {
        if (confirm(`Are you sure you want to revoke access to this note for ${escapeHTML(username)}?`)) {
            revokeAccess(noteId, sharedUserId);
        }
    }

    function revokeAccess(noteId, sharedUserId) {
        const formData = new FormData();
        formData.append('note_id', noteId);
        formData.append('shared_user_id', sharedUserId);

        fetch('../php/dashboard.php?action=revoke_note_access', { method: 'POST', body: formData})
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showGlobalNotification(data.message || 'Access revoked.', 'success');
                    loadSharedWithUsers(noteId); // Refresh the list in the modal
                    loadInitialData(); // Refresh main note list to remove shared indicator if needed (though it won't for others)
                } else {
                    showGlobalNotification(data.message || 'Failed to revoke access.', 'error');
                }
            })
            .catch(error => {
                console.error('Error revoking access:', error);
                showGlobalNotification('An error occurred while revoking access.', 'error');
            });
    }


    // --- Utility Functions ---
    function escapeHTML(str) {
        if (str === null || str === undefined) return '';
        return String(str).replace(/[&<>"']/g, function (match) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[match];
        });
    }

    function clearFormErrors(formElement) {
        if (!formElement) return;
        const errorMessages = formElement.querySelectorAll('.error-message');
        errorMessages.forEach(el => el.textContent = '');
    }

    initializeDashboard();
});

let notificationTimeout;
function showGlobalNotification(message, type = 'info', duration = 3000) {
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
