document.addEventListener('DOMContentLoaded', function () {
    const loginFormContainer = document.getElementById('loginFormContainer');
    const registerFormContainer = document.getElementById('registerFormContainer');
    const otpFormContainer = document.getElementById('otpFormContainer'); // New OTP form

    const showRegisterLink = document.getElementById('showRegister');
    const showLoginLink = document.getElementById('showLogin');
    const cancelOtpLoginLink = document.getElementById('cancelOtpLogin'); // New

    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const otpForm = document.getElementById('otpForm'); // New

    const loginMessage = document.getElementById('loginMessage');
    const registerMessage = document.getElementById('registerMessage');
    const otpMessage = document.getElementById('otpMessage'); // New

    // --- Toggle between Login, Register, and OTP forms ---
    function showAuthForm(formToShow) { // 'login', 'register', 'otp'
        if(loginFormContainer) loginFormContainer.style.display = (formToShow === 'login') ? 'block' : 'none';
        if(registerFormContainer) registerFormContainer.style.display = (formToShow === 'register') ? 'block' : 'none';
        if(otpFormContainer) otpFormContainer.style.display = (formToShow === 'otp') ? 'block' : 'none';
        clearMessagesAndErrors();
    }

    if (showRegisterLink) {
        showRegisterLink.addEventListener('click', function (e) { e.preventDefault(); showAuthForm('register'); });
    }
    if (showLoginLink) {
        showLoginLink.addEventListener('click', function (e) { e.preventDefault(); showAuthForm('login'); });
    }
    if (cancelOtpLoginLink) {
        cancelOtpLoginLink.addEventListener('click', function(e) { e.preventDefault(); showAuthForm('login'); });
    }


    // --- Helper function to display messages ---
    function showMessage(element, message, isSuccess) {
        if (!element) return;
        element.textContent = message;
        element.className = 'form-message';
        if (isSuccess) element.classList.add('success');
        else element.classList.add('error');
        element.style.display = 'block';
    }

    // --- Helper function to display field errors ---
    function displayFieldErrors(formId, errors) {
        const formElement = document.getElementById(formId);
        if(!formElement) return;

        formElement.querySelectorAll('.error-message').forEach(el => el.textContent = '');

        for (const field in errors) {
            let targetErrorId = '';
            if (formId === 'loginForm') targetErrorId = `login${field.charAt(0).toUpperCase() + field.slice(1)}Error`;
            else if (formId === 'registerForm') {
                targetErrorId = `register${field.charAt(0).toUpperCase() + field.slice(1)}Error`;
                if (field === 'confirm_password') targetErrorId = 'confirmPasswordError';
            }
            // Add for otpForm if specific field errors are expected

            const fieldErrorEl = document.getElementById(targetErrorId);
            if (fieldErrorEl) fieldErrorEl.textContent = errors[field];
        }
    }

    function clearMessagesAndErrors() {
        if(loginMessage) loginMessage.style.display = 'none';
        if(registerMessage) registerMessage.style.display = 'none';
        if(otpMessage) otpMessage.style.display = 'none';
        document.querySelectorAll('.error-message').forEach(el => el.textContent = '');
        if(loginForm) loginForm.reset();
        if(registerForm) registerForm.reset();
        if(otpForm) otpForm.reset();
    }


    // --- Handle Login Form Submission ---
    if (loginForm) {
        loginForm.addEventListener('submit', function (e) {
            e.preventDefault();
            clearMessagesAndErrors();
            const formData = new FormData(loginForm);

            fetch('../php/login.php', { method: 'POST', body: formData })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    if (data.twofa_required) {
                        // Password correct, but 2FA is needed
                        showMessage(loginMessage, data.message, true); // Show "Password correct..."
                        setTimeout(() => {
                            showAuthForm('otp'); // Switch to OTP form
                            if(document.getElementById('otpCode')) document.getElementById('otpCode').focus();
                        }, 500); // Short delay to read message
                    } else {
                        // Login fully successful, redirect
                        showMessage(loginMessage, data.message, true);
                        setTimeout(() => {
                            window.location.href = data.redirect_url || '/dashboard';
                        }, 1000);
                    }
                } else {
                    showMessage(loginMessage, data.message || 'Login failed. Please check your credentials.', false);
                    if (data.errors) displayFieldErrors('loginForm', data.errors);
                }
            })
            .catch(error => {
                console.error('Login Error:', error);
                showMessage(loginMessage, 'An error occurred. Please try again.', false);
            });
        });
    }

    // --- Handle OTP Form Submission ---
    if (otpForm) {
        otpForm.addEventListener('submit', function(e) {
            e.preventDefault();
            if(otpMessage) otpMessage.style.display = 'none';
            const otpCodeInputEl = document.getElementById('otpCode');
            if (!otpCodeInputEl || !otpCodeInputEl.value) {
                showMessage(otpMessage, "OTP Code is required.", false);
                return;
            }
            const formData = new FormData(otpForm);

            fetch('../php/verify_2fa.php', { method: 'POST', body: formData })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showMessage(otpMessage, data.message || "Verification successful! Redirecting...", true);
                    setTimeout(() => {
                        window.location.href = data.redirect_url || '/dashboard';
                    }, 1000);
                } else {
                    showMessage(otpMessage, data.message || "OTP verification failed.", false);
                    if(otpCodeInputEl) otpCodeInputEl.value = ''; // Clear OTP input on failure
                    if(otpCodeInputEl) otpCodeInputEl.focus();
                }
            })
            .catch(error => {
                console.error('OTP Verification Error:', error);
                showMessage(otpMessage, 'An error occurred during OTP verification.', false);
            });
        });
    }


    // --- Handle Register Form Submission ---
    if (registerForm) {
        registerForm.addEventListener('submit', function (e) {
            e.preventDefault();
            clearMessagesAndErrors();
            const formData = new FormData(registerForm);
            const password = formData.get('password');
            const confirmPassword = formData.get('confirm_password');
            if (password !== confirmPassword) {
                showMessage(registerMessage, 'Passwords do not match.', false);
                displayFieldErrors('registerForm', { confirm_password: 'Passwords do not match.' });
                return;
            }

            fetch('../php/register.php', { method: 'POST', body: formData })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showMessage(registerMessage, data.message, true);
                    registerForm.reset();
                    setTimeout(() => {
                        showAuthForm('login');
                        showMessage(loginMessage, "Registration successful! Please log in.", true);
                    }, 2000);
                } else {
                    showMessage(registerMessage, data.message || 'Registration failed. Please correct the errors.', false);
                    if (data.errors) displayFieldErrors('registerForm', data.errors);
                }
            })
            .catch(error => {
                console.error('Registration Error:', error);
                showMessage(registerMessage, 'An error occurred during registration. Please try again.', false);
            });
        });
    }

    // Initial form state
    showAuthForm('login');

});
