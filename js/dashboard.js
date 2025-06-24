document.addEventListener('DOMContentLoaded', function() {
    // --- DOM Elements ---
    // ... (all existing DOM elements from previous overwrite) ...
    const usernameDisplay = document.getElementById('usernameDisplay');
    const adminLinkContainer = document.getElementById('adminLinkContainer');
    const userSettingsBtn = document.createElement('button');
    userSettingsBtn.id = 'userSettingsBtn'; userSettingsBtn.innerHTML = '&#9881;'; userSettingsBtn.title = "User Settings";
    userSettingsBtn.classList.add('button'); userSettingsBtn.style.marginLeft = '10px';
    const newNoteBtn = document.getElementById('newNoteBtn'); /* ... etc ... */
    const twoFaSetupModal = document.getElementById('twoFaSetupModal');
    const close2faModalBtn = twoFaSetupModal ? twoFaSetupModal.querySelector('.close-button') : null;
    const twoFaStatusText = document.getElementById('2faStatusText');
    const enable2faInitBtn = document.getElementById('enable2faInitBtn');
    const disable2faBtn = document.getElementById('disable2faBtn');
    const twoFaQrCodeSection = document.getElementById('2faQrCodeSection');
    const twoFaQrCodeDisplay = document.getElementById('2faQrCodeDisplay');
    const twoFaSecretKeyDisplay = document.getElementById('2faSecretKeyDisplay');
    const verify2faForm = document.getElementById('verify2faForm');
    const otpCodeInput = document.getElementById('otpCodeInput');
    const cancel2faSetupBtn = document.getElementById('cancel2faSetupBtn');
    const twoFaRecoveryCodesSection = document.getElementById('2faRecoveryCodesSection');
    const twoFaRecoveryCodesList = document.getElementById('2faRecoveryCodesList');
    const finish2faSetupBtn = document.getElementById('finish2faSetupBtn');
    let twoFaQrCodeGenerator = null;


    // --- State Variables ---
    // ... (all existing state variables) ...
    let currentUser = null; // Will store more complete user data including 2FA status

    // --- Initialization ---
    function initializeDashboard() {
        fetchUserData(); // Fetches initial user data including 2FA status now
        loadInitialData(() => { handleDeepLinking(); });
        setupEventListeners();
        // ... (rest of init)
    }
    // ... (handleDeepLinking, local storage functions, updateSyncToServerButtonVisibility, syncAllOfflineNotesToServer remain same) ...

    // --- Core Data Functions ---
    function fetchUserData() {
        fetch('../php/dashboard.php?action=get_user_info') // This endpoint should now also return 2FA status for the logged-in user
            .then(response => response.json())
            .then(data => {
                if (data.success && data.username && usernameDisplay) {
                    usernameDisplay.textContent = `Welcome, ${data.username}!`;
                    currentUser = data; // currentUser now has { user_id, username, role, email, twofa_enabled (from this call) }

                    if (data.role === 'admin' && adminLinkContainer) { adminLinkContainer.innerHTML = `<a href="/admin_dashboard" class="button button-secondary">Admin Panel</a>`; }
                    if (usernameDisplay && usernameDisplay.parentNode) {
                        if(!document.getElementById('syncToServerBtn')) usernameDisplay.parentNode.insertBefore(syncToServerBtn, adminLinkContainer);
                        if(!document.getElementById('userSettingsBtn')) usernameDisplay.parentNode.insertBefore(userSettingsBtn, syncToServerBtn.nextSibling);
                    }
                    // Update 2FA UI elements if they exist, based on initial user data
                    if (twoFaStatusText && enable2faInitBtn && disable2faBtn) {
                        if (currentUser.twofa_enabled) { // Assuming 'twofa_enabled' is part of `data`
                            twoFaStatusText.textContent = "Enabled";
                            enable2faInitBtn.style.display = 'none';
                            disable2faBtn.style.display = 'inline-block';
                        } else {
                            twoFaStatusText.textContent = "Disabled";
                            enable2faInitBtn.style.display = 'inline-block';
                            disable2faBtn.style.display = 'none';
                        }
                    }

                } else if (!data.success) { console.error('Failed to fetch user info:', data.message); }
            }).catch(error => { console.error('Error fetching user data:', error); });
    }
    // ... (loadInitialData remains same) ...

    // --- Rendering Functions ---
    // ... (All rendering functions remain same) ...

    // --- Editor Functions ---
    // ... (All editor functions remain same) ...

    // --- 2FA UI Functions ---
    function open2faModal() {
        if (!twoFaSetupModal) return;
        // Reset view
        if(twoFaQrCodeSection) twoFaQrCodeSection.style.display = 'none';
        if(twoFaRecoveryCodesSection) twoFaRecoveryCodesSection.style.display = 'none';
        if(document.getElementById('2faInitialActions')) document.getElementById('2faInitialActions').style.display = 'block';
        if(otpCodeInput) otpCodeInput.value = '';

        // Fetch current 2FA status for the user to ensure UI is accurate
        fetch('../php/user_settings_handler.php?action=get_2fa_status', { method: 'GET' })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                currentUser.twofa_enabled = data.twofa_enabled; // Update global current user state
                if (data.twofa_enabled) {
                    if(twoFaStatusText) twoFaStatusText.textContent = "Enabled";
                    if(enable2faInitBtn) enable2faInitBtn.style.display = 'none';
                    if(disable2faBtn) disable2faBtn.style.display = 'inline-block';
                } else {
                    if(twoFaStatusText) twoFaStatusText.textContent = "Disabled";
                    if(enable2faInitBtn) enable2faInitBtn.style.display = 'inline-block';
                    if(disable2faBtn) disable2faBtn.style.display = 'none';
                }
            } else {
                 showGlobalNotification(data.message || "Could not fetch 2FA status.", "error");
            }
        })
        .catch(error => {
            console.error("Error fetching 2FA status:", error);
            showGlobalNotification("Error fetching 2FA status.", "error");
        });
        twoFaSetupModal.style.display = 'flex';
    }

    function handleEnable2faInit() {
        fetch('../php/user_settings_handler.php?action=generate_2fa_secret', { method: 'POST' })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                if(twoFaQrCodeDisplay) {
                    twoFaQrCodeDisplay.innerHTML = '';
                    if (typeof QRCode !== 'undefined') {
                         // qrcode.js expects the DOM element itself, not its ID string for the first argument
                         if(twoFaQrCodeGenerator) twoFaQrCodeGenerator.clear(); // Clear previous if any
                         twoFaQrCodeGenerator = new QRCode(twoFaQrCodeDisplay, {
                            text: data.qr_code_url_data, // Use the otpauth:// string
                            width: 180, height: 180,
                            colorDark : "#000000", colorLight : "#ffffff",
                            correctLevel : QRCode.CorrectLevel.H
                        });
                    } else { twoFaQrCodeDisplay.textContent = "QR Code library not loaded."; }
                }
                if(twoFaSecretKeyDisplay) twoFaSecretKeyDisplay.textContent = data.secret;
                if(document.getElementById('2faInitialActions')) document.getElementById('2faInitialActions').style.display = 'none';
                if(twoFaQrCodeSection) twoFaQrCodeSection.style.display = 'block';
            } else { showGlobalNotification(data.message || "Failed to generate 2FA secret.", "error"); }
        })
        .catch(error => { console.error("Error generating 2FA secret:", error); showGlobalNotification("An error occurred.", "error"); });
    }

    function handleVerifyAndEnable2fa(e) { /* ... same (uses stubs from backend) ... */ }
    function handleDisable2fa() { /* ... same (uses stubs from backend) ... */ }

    // --- Event Listeners Setup ---
    function setupEventListeners() {
        // ... (all existing event listeners from previous full file overwrite)
        if (userSettingsBtn) {
            userSettingsBtn.addEventListener('click', open2faModal);
        }
        // 2FA Modal Listeners
        if(close2faModalBtn && twoFaSetupModal) close2faModalBtn.addEventListener('click', () => twoFaSetupModal.style.display = 'none');
        if(enable2faInitBtn) enable2faInitBtn.addEventListener('click', handleEnable2faInit);
        if(disable2faBtn) disable2faBtn.addEventListener('click', handleDisable2fa);
        if(verify2faForm) verify2faForm.addEventListener('submit', handleVerifyAndEnable2fa);
        if(cancel2faSetupBtn) cancel2faSetupBtn.addEventListener('click', () => {
            if(twoFaQrCodeSection) twoFaQrCodeSection.style.display = 'none';
            if(document.getElementById('2faInitialActions')) document.getElementById('2faInitialActions').style.display = 'block';
        });
        if(finish2faSetupBtn && twoFaSetupModal) finish2faSetupBtn.addEventListener('click', () => {
            if(twoFaRecoveryCodesSection) twoFaRecoveryCodesSection.style.display = 'none'; // Hide recovery codes
            if(document.getElementById('2faInitialActions')) document.getElementById('2faInitialActions').style.display = 'block'; // Show initial state
            twoFaSetupModal.style.display = 'none';
        });
        // Add twoFaSetupModal to generic closing
        [newFolderModal, renameFolderModal, shareNoteModal, qrCodeModal, twoFaSetupModal].forEach(modal => {
            if (modal) { /* ... same close logic ... */ }
        });
        // ... (Rest of setupEventListeners)
    }

    // --- All other functions ---
    // ... (These functions are assumed to be complete and correct from the previous step's full overwrite)

    initializeDashboard();
});

let notificationTimeout;
function showGlobalNotification(message, type = 'info', duration = 3000) { /* ... same ... */ }
