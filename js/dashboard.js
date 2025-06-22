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
    const closeFolderModalBtn = newFolderModal ? newFolderModal.querySelector('.close-button') : null;
    const newFolderNameInput = document.getElementById('newFolderName');
    const confirmNewFolderBtn = document.getElementById('confirmNewFolderBtn');

    const noteEditorPanel = document.querySelector('.note-editor-panel');
    const editorContentWrapper = noteEditorPanel ? noteEditorPanel.querySelector('.content-wrapper') : null;

    // --- State Variables ---
    let currentNoteId = null;
    let currentUser = null;
    let allNotes = [];
    let allFolders = [];
    let allTags = [];

    // --- Initialization ---
    function initializeDashboard() {
        fetchUserData();
        loadInitialData(); // Fetch notes, folders, tags
        setupEventListeners();
        updateEditorState(null); // Start with no note selected
        document.getElementById('currentYear').textContent = new Date().getFullYear();
    }

    function fetchUserData() {
        // Fetches basic user info like username
        // `php/dashboard.php` already handles authentication.
        // We can make a call to get session-based user info if needed for display.
        fetch('../php/dashboard.php?action=get_user_info')
            .then(response => response.json())
            .then(data => {
                if (data.username && usernameDisplay) {
                    usernameDisplay.textContent = `Welcome, ${data.username}!`;
                    currentUser = data; // Store user data
                }
            })
            .catch(error => console.error('Error fetching user data:', error));
    }

    function loadInitialData() {
        fetch('../php/dashboard.php?action=get_initial_data')
            .then(response => response.json())
            .then(result => {
                if (result.success) {
                    allNotes = result.data.notes || [];
                    allFolders = result.data.folders || [];
                    allTags = result.data.tags || [];

                    renderFolders(allFolders);
                    renderTags(allTags);
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
        folderListUl.innerHTML = '<li><a href="#" data-folder-id="all" class="active">All Notes</a></li>'; // Default "All Notes"
        folders.forEach(folder => {
            const li = document.createElement('li');
            li.innerHTML = `<a href="#" data-folder-id="${folder.id}">${escapeHTML(folder.name)}</a>`;
            folderListUl.appendChild(li);
        });
        // Add active class to "All Notes" by default
        folderListUl.querySelector('a[data-folder-id="all"]').classList.add('active');

    }

    function renderTags(tags) {
        if (!tagListUl) return;
        tagListUl.innerHTML = ''; // Clear existing
        tags.forEach(tag => {
            const li = document.createElement('li');
            li.innerHTML = `<a href="#" data-tag-id="${tag.id}">#${escapeHTML(tag.name)}</a>`;
            tagListUl.appendChild(li);
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

            li.innerHTML = `
                <h4>${escapeHTML(note.title) || 'Untitled Note'}</h4>
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
                        alert("Error loading note.");
                        updateEditorState(null);
                    }
                })
                .catch(err => {
                    console.error("Error fetching note content:", err);
                    alert("Error loading note.");
                    updateEditorState(null);
                });
        } else {
            console.warn(`Note with ID ${noteId} not found in local cache.`);
            // Potentially fetch it if not found, or handle error
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
            // Update metadata (tags, last updated) if available in noteData
            // const metadataDisplay = document.querySelector('.note-metadata span');
            // if (metadataDisplay) metadataDisplay.textContent = `Last updated: ${new Date(noteData.updated_at).toLocaleString()}`;
        } else { // No note selected or new note state
            noteEditorPanel.classList.add('empty');
            editorContentWrapper.style.display = 'none'; // Hide content wrapper

            noteTitleInput.value = '';
            noteContentTextarea.value = '';
            currentNoteId = null;
            // Clear metadata
            // const metadataDisplay = document.querySelector('.note-metadata span');
            // if (metadataDisplay) metadataDisplay.textContent = '';
        }
    }


    function saveCurrentNote() {
        if (!noteTitleInput || !noteContentTextarea) return;

        const title = noteTitleInput.value.trim();
        const content = noteContentTextarea.value;
        let url, body;

        const formData = new FormData();
        formData.append('title', title);
        formData.append('content', content);
        // folder_id should be handled if notes are tied to folders on creation/saving

        if (currentNoteId) { // Update existing note
            url = `../php/dashboard.php?action=update_note&id=${currentNoteId}`;
            formData.append('note_id', currentNoteId);
        } else { // Create new note
            url = '../php/dashboard.php?action=create_note';
        }

        fetch(url, { method: 'POST', body: formData })
            .then(response => response.json())
            .then(result => {
                if (result.success) {
                    alert(result.message || 'Note saved!');
                    // Refresh note list and potentially select the saved/new note
                    loadInitialData(); // Reload all data for simplicity, could be more targeted
                    if (result.note_id) { // If new note was created
                        currentNoteId = result.note_id;
                        // setTimeout(() => { // Allow list to re-render
                        //     loadNoteIntoEditor(currentNoteId);
                        //     setActiveNoteListItem(currentNoteId);
                        // }, 200);
                    }
                } else {
                    alert(result.message || 'Failed to save note.');
                }
            })
            .catch(error => {
                console.error('Error saving note:', error);
                alert('An error occurred while saving the note.');
            });
    }

    function deleteCurrentNote() {
        if (!currentNoteId) {
            alert("No note selected to delete.");
            return;
        }
        if (!confirm(`Are you sure you want to delete the note "${noteTitleInput.value}"?`)) {
            return;
        }

        fetch(`../php/dashboard.php?action=delete_note&id=${currentNoteId}`, { method: 'POST' }) // POST or DELETE
            .then(response => response.json())
            .then(result => {
                if (result.success) {
                    alert('Note deleted successfully!');
                    currentNoteId = null;
                    updateEditorState(null); // Clear editor
                    loadInitialData(); // Refresh list
                } else {
                    alert(result.message || 'Failed to delete note.');
                }
            })
            .catch(error => {
                console.error('Error deleting note:', error);
                alert('An error occurred while deleting the note.');
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

        if (newFolderBtn && newFolderModal && closeFolderModalBtn && confirmNewFolderBtn && newFolderNameInput) {
            newFolderBtn.addEventListener('click', () => {
                newFolderModal.style.display = 'flex';
                newFolderNameInput.value = '';
                newFolderNameInput.focus();
            });
            closeFolderModalBtn.addEventListener('click', () => {
                newFolderModal.style.display = 'none';
            });
            confirmNewFolderBtn.addEventListener('click', () => {
                const folderName = newFolderNameInput.value.trim();
                if (folderName) {
                    createFolder(folderName);
                    newFolderModal.style.display = 'none';
                } else {
                    alert("Folder name cannot be empty.");
                }
            });
            window.addEventListener('click', (event) => { // Close modal if clicked outside
                if (event.target == newFolderModal) {
                    newFolderModal.style.display = 'none';
                }
            });
        }

        if (folderListUl) {
            folderListUl.addEventListener('click', (e) => {
                if (e.target.tagName === 'A' && e.target.dataset.folderId) {
                    e.preventDefault();
                    const folderId = e.target.dataset.folderId;
                    setActiveFolderListItem(folderId);
                    filterNotesByFolder(folderId);
                }
            });
        }

        if (tagListUl) {
            tagListUl.addEventListener('click', (e) => {
                if (e.target.tagName === 'A' && e.target.dataset.tagId) {
                    e.preventDefault();
                    const tagId = e.target.dataset.tagId;
                    // Implement tag filtering logic
                    // setActiveTagListItem(tagId);
                    // filterNotesByTag(tagId);
                    console.log("Filter by tag:", tagId);
                }
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
                    alert("Folder created!");
                    loadInitialData(); // Refresh folder list (and other data)
                } else {
                    alert(result.message || "Failed to create folder.");
                }
            })
            .catch(error => {
                console.error('Error creating folder:', error);
                alert("An error occurred while creating the folder.");
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
        if (notesToDisplay.length > 0) {
            // loadNoteIntoEditor(notesToDisplay[0].id);
            // setActiveNoteListItem(notesToDisplay[0].id);
            updateEditorState(null); // Clear editor when changing folders for now
            setActiveNoteListItem(null);
        } else {
            updateEditorState(null); // No notes in this folder
        }
    }

    function filterNotesBySearch(searchTerm) {
        const lowerSearchTerm = searchTerm.toLowerCase();
        const filteredNotes = allNotes.filter(note => {
            return (note.title && note.title.toLowerCase().includes(lowerSearchTerm)) ||
                   (note.content && note.content.toLowerCase().includes(lowerSearchTerm)); // Search content if available
        });
        renderNoteList(filteredNotes);
        if (filteredNotes.length > 0) {
            // updateEditorState(null);
            // setActiveNoteListItem(null);
        } else {
            updateEditorState(null);
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
