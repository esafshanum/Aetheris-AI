/* ==========================================================================
   AETHERIS AUTHENTICATION CONTROLLER
   ========================================================================== */

const Auth = {
    tokenKey: "aetheris_access_token",
    userKey: "aetheris_username",
    
    init() {
        this.bindEvents();
        this.checkSession();
    },

    bindEvents() {
        // Toggle register form
        document.getElementById("go-to-register").addEventListener("click", (e) => {
            e.preventDefault();
            this.clearErrors();
            document.getElementById("login-form").classList.remove("active");
            document.getElementById("register-form").classList.add("active");
            document.getElementById("auth-subtitle").innerText = "Create an account to begin";
        });

        // Toggle login form
        document.getElementById("go-to-login").addEventListener("click", (e) => {
            e.preventDefault();
            this.clearErrors();
            document.getElementById("register-form").classList.remove("active");
            document.getElementById("login-form").classList.add("active");
            document.getElementById("auth-subtitle").innerText = "Enter your credentials to begin your journey";
        });

        // Submit Login Form
        document.getElementById("login-form").addEventListener("submit", async (e) => {
            e.preventDefault();
            const username = document.getElementById("login-username").value.trim();
            const password = document.getElementById("login-password").value;
            await this.login(username, password);
        });

        // Submit Register Form
        document.getElementById("register-form").addEventListener("submit", async (e) => {
            e.preventDefault();
            const username = document.getElementById("register-username").value.trim();
            const password = document.getElementById("register-password").value;
            
            if (password.length < 6) {
                this.showError("Password must be at least 6 characters.");
                return;
            }
            await this.register(username, password);
        });

        // Logout action
        document.getElementById("logout-btn").addEventListener("click", () => {
            this.logout();
        });
    },

    async register(username, password) {
        this.clearErrors();
        try {
            const response = await fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.detail || "Registration failed.");
            }

            // Automatically log in on registration success
            await this.login(username, password);
        } catch (err) {
            this.showError(err.message);
        }
    },

    async login(username, password) {
        this.clearErrors();
        try {
            // OAuth2 requires application/x-www-form-urlencoded
            const params = new URLSearchParams();
            params.append("username", username);
            params.append("password", password);

            const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: params
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.detail || "Authentication failed. Double check your username/password.");
            }

            // Save credentials
            localStorage.setItem(this.tokenKey, data.access_token);
            localStorage.setItem(this.userKey, data.username);

            this.showMainApp();
            
            // Dispatch event to boot app settings and chats
            window.dispatchEvent(new Event("aetheris_auth_success"));
        } catch (err) {
            this.showError(err.message);
        }
    },

    logout() {
        localStorage.removeItem(this.tokenKey);
        localStorage.removeItem(this.userKey);
        
        // Reset forms
        document.getElementById("login-username").value = "";
        document.getElementById("login-password").value = "";
        document.getElementById("register-username").value = "";
        document.getElementById("register-password").value = "";
        
        this.showLoginScreen();
        window.dispatchEvent(new Event("aetheris_logout"));
    },

    async checkSession() {
        const token = this.getToken();
        if (!token) {
            this.showLoginScreen();
            return;
        }

        try {
            // Verify token with backend
            const response = await fetch("/api/auth/me", {
                method: "GET",
                headers: { "Authorization": `Bearer ${token}` }
            });

            if (response.ok) {
                this.showMainApp();
                window.dispatchEvent(new Event("aetheris_auth_success"));
            } else {
                // Token invalid or expired
                this.logout();
            }
        } catch (err) {
            console.error("Session check network error:", err);
            // Standby or offline
            this.showMainApp(); // let user see dashboard offline
        }
    },

    getToken() {
        return localStorage.getItem(this.tokenKey);
    },

    getUsername() {
        return localStorage.getItem(this.userKey) || "User";
    },

    showMainApp() {
        document.getElementById("current-username").innerText = this.getUsername();
        document.getElementById("auth-container").classList.add("hidden");
        document.getElementById("app-container").classList.remove("hidden");
    },

    showLoginScreen() {
        document.getElementById("app-container").classList.add("hidden");
        document.getElementById("auth-container").classList.remove("hidden");
        document.getElementById("login-form").classList.add("active");
        document.getElementById("register-form").classList.remove("active");
    },

    showError(msg) {
        const errBanner = document.getElementById("auth-error");
        document.getElementById("auth-error-msg").innerText = msg;
        errBanner.classList.remove("hidden");
    },

    clearErrors() {
        document.getElementById("auth-error").classList.add("hidden");
        document.getElementById("auth-error-msg").innerText = "";
    }
};

document.addEventListener("DOMContentLoaded", () => {
    Auth.init();
});
