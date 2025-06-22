document.addEventListener('DOMContentLoaded', function () {
    const loginFormContainer = document.getElementById('loginFormContainer');
    const registerFormContainer = document.getElementById('registerFormContainer');
    const showRegisterLink = document.getElementById('showRegister');
    const showLoginLink = document.getElementById('showLogin');

    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    const loginMessage = document.getElementById('loginMessage');
    const registerMessage = document.getElementById('registerMessage');

    // --- Toggle between Login and Register forms ---
    if (showRegisterLink) {
        showRegisterLink.addEventListener('click', function (e) {
            e.preventDefault();
            loginFormContainer.style.display = 'none';
            registerFormContainer.style.display = 'block';
            clearMessagesAndErrors();
        });
    }

    if (showLoginLink) {
        showLoginLink.addEventListener('click', function (e) {
            e.preventDefault();
            registerFormContainer.style.display = 'none';
            loginFormContainer.style.display = 'block';
            clearMessagesAndErrors();
        });
    }

    // --- Helper function to display messages ---
    function showMessage(element, message, isSuccess) {
        element.textContent = message;
        element.className = 'form-message'; // Reset classes
        if (isSuccess) {
            element.classList.add('success');
        } else {
            element.classList.add('error');
        }
        element.style.display = 'block';
    }

    // --- Helper function to display field errors ---
    function displayFieldErrors(formId, errors) {
        // Clear previous errors
        document.querySelectorAll(`#${formId} .error-message`).forEach(el => el.textContent = '');

        for (const field in errors) {
            const errorEl = document.getElementById(`${formId.replace('Form','')}Error`); // e.g., loginUsernameError from loginForm, username
            // A bit more specific for registration form fields
            let targetErrorId = '';
            if (formId === 'loginForm') {
                 targetErrorId = `login${field.charAt(0).toUpperCase() + field.slice(1)}Error`; // loginUsernameError
            } else if (formId === 'registerForm') {
                 targetErrorId = `register${field.charAt(0).toUpperCase() + field.slice(1)}Error`; // registerUsernameError
                 if (field === 'confirm_password') targetErrorId = 'confirmPasswordError'; // Handle underscore
            }

            const fieldErrorEl = document.getElementById(targetErrorId);
            if (fieldErrorEl) {
                fieldErrorEl.textContent = errors[field];
            }
        }
    }

    function clearMessagesAndErrors() {
        if(loginMessage) loginMessage.style.display = 'none';
        if(registerMessage) registerMessage.style.display = 'none';
        document.querySelectorAll('.error-message').forEach(el => el.textContent = '');
        // Clear form fields as well for better UX
        if(loginForm) loginForm.reset();
        if(registerForm) registerForm.reset();
    }


    // --- Handle Login Form Submission ---
    if (loginForm) {
        loginForm.addEventListener('submit', function (e) {
            e.preventDefault();
            clearMessagesAndErrors(); // Clear previous messages
            const formData = new FormData(loginForm);

            fetch('../php/login.php', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showMessage(loginMessage, data.message, true);
                    // Redirect after a short delay
                    setTimeout(() => {
                        window.location.href = data.redirect_url || '/dashboard'; // Updated to extension-less URL
                    }, 1000);
                } else {
                    showMessage(loginMessage, data.message || 'Login failed. Please check your credentials.', false);
                    if (data.errors) {
                        displayFieldErrors('loginForm', data.errors);
                    }
                }
            })
            .catch(error => {
                console.error('Login Error:', error);
                showMessage(loginMessage, 'An error occurred. Please try again.', false);
            });
        });
    }

    // --- Handle Register Form Submission ---
    if (registerForm) {
        registerForm.addEventListener('submit', function (e) {
            e.preventDefault();
            clearMessagesAndErrors(); // Clear previous messages
            const formData = new FormData(registerForm);

            // Basic client-side validation (optional, as server validates too)
            const password = formData.get('password');
            const confirmPassword = formData.get('confirm_password');
            if (password !== confirmPassword) {
                showMessage(registerMessage, 'Passwords do not match.', false);
                displayFieldErrors('registerForm', { confirm_password: 'Passwords do not match.' });
                return;
            }

            fetch('../php/register.php', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showMessage(registerMessage, data.message, true);
                    registerForm.reset(); // Clear form on successful registration
                    // Optionally switch to login form
                    setTimeout(() => {
                        registerFormContainer.style.display = 'none';
                        loginFormContainer.style.display = 'block';
                        clearMessagesAndErrors();
                        showMessage(loginMessage, "Registration successful! Please log in.", true);
                    }, 2000);
                } else {
                    showMessage(registerMessage, data.message || 'Registration failed. Please correct the errors.', false);
                    if (data.errors) {
                        displayFieldErrors('registerForm', data.errors);
                    }
                }
            })
            .catch(error => {
                console.error('Registration Error:', error);
                showMessage(registerMessage, 'An error occurred during registration. Please try again.', false);
            });
        });
    }
});
