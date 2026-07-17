/* ==========================================================================
   AETHERIS CENTRAL APPLICATION ENGINE
   ========================================================================== */

const App = {
    activeSessionId: null,
    isGenerating: false,
    abortController: null,
    serverHasApiKey: false,
    activeSpeakingBtn: null,
    
    // Settings configuration state
    settings: {
        apiKey: "",
        model: "gpt-4o",
        temperature: 0.7,
        maxTokens: 1000
    },

    init() {
        this.initMobileHeight();
        this.loadSettings();
        this.bindEvents();
        this.initTheme();
        
        // Listen for authentication changes
        window.addEventListener("aetheris_auth_success", () => this.onAuthSuccess());
        window.addEventListener("aetheris_logout", () => this.onLogout());
    },

    initMobileHeight() {
        const setVh = () => {
            const vh = window.innerHeight * 0.01;
            document.documentElement.style.setProperty('--vh', `${vh}px`);
        };
        window.addEventListener('resize', setVh);
        window.addEventListener('orientationchange', setVh);
        setVh();
    },

    // --- SETUP & UTILS ---
    
    loadSettings() {
        this.settings.apiKey = localStorage.getItem("aetheris_client_key") || "";
        this.settings.model = localStorage.getItem("aetheris_model") || "gpt-4o";
        this.settings.temperature = parseFloat(localStorage.getItem("aetheris_temp") || "0.7");
        this.settings.maxTokens = parseInt(localStorage.getItem("aetheris_max_tokens") || "1000");

        // Sync to settings modal DOM
        document.getElementById("settings-api-key").value = this.settings.apiKey;
        document.getElementById("settings-model").value = this.settings.model;
        document.getElementById("settings-temp").value = this.settings.temperature;
        document.getElementById("temp-val").innerText = this.settings.temperature;
        document.getElementById("settings-max-tokens").value = this.settings.maxTokens;
        document.getElementById("tokens-val").innerText = this.settings.maxTokens;
    },

    saveSettings() {
        const apiKey = document.getElementById("settings-api-key").value.trim();
        const model = document.getElementById("settings-model").value;
        const temp = parseFloat(document.getElementById("settings-temp").value);
        const maxTokens = parseInt(document.getElementById("settings-max-tokens").value);

        this.settings.apiKey = apiKey;
        this.settings.model = model;
        this.settings.temperature = temp;
        this.settings.maxTokens = maxTokens;

        localStorage.setItem("aetheris_client_key", apiKey);
        localStorage.setItem("aetheris_model", model);
        localStorage.setItem("aetheris_temp", temp);
        localStorage.setItem("aetheris_max_tokens", maxTokens);

        this.checkDemoBadge();
    },

    initTheme() {
        const savedTheme = localStorage.getItem("aetheris_theme") || "dark";
        document.documentElement.setAttribute("data-theme", savedTheme);
        this.updateThemeIcon(savedTheme);
    },

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute("data-theme");
        const newTheme = currentTheme === "dark" ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", newTheme);
        localStorage.setItem("aetheris_theme", newTheme);
        this.updateThemeIcon(newTheme);
    },

    updateThemeIcon(theme) {
        const btn = document.getElementById("theme-toggle-btn");
        if (theme === "dark") {
            btn.innerHTML = '<i class="fa-solid fa-moon"></i>';
        } else {
            btn.innerHTML = '<i class="fa-solid fa-sun"></i>';
        }
    },

    showConfirm(message, title = "Aetheris says", okText = "OK", cancelText = "Cancel") {
        return new Promise((resolve) => {
            const modal = document.getElementById("confirm-modal");
            const titleEl = modal.querySelector(".modal-header h3");
            const messageEl = document.getElementById("confirm-message");
            const okBtn = document.getElementById("confirm-ok-btn");
            const cancelBtn = document.getElementById("confirm-cancel-btn");
            const closeBtn = document.getElementById("confirm-close-btn");

            // Update text content
            titleEl.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${title}`;
            messageEl.textContent = message;
            okBtn.textContent = okText;
            cancelBtn.textContent = cancelText;

            // Adjust button type styling if deleting vs normal
            if (okText.toLowerCase() === "delete" || okText.toLowerCase() === "remove") {
                okBtn.className = "btn btn-danger";
            } else {
                okBtn.className = "btn btn-primary";
            }

            // Show modal
            modal.classList.remove("hidden");

            // Clean up and resolve
            const handleResolve = (val) => {
                modal.classList.add("hidden");
                okBtn.removeEventListener("click", onOk);
                cancelBtn.removeEventListener("click", onCancel);
                closeBtn.removeEventListener("click", onCancel);
                window.removeEventListener("click", onOutsideClick);
                resolve(val);
            };

            const onOk = () => handleResolve(true);
            const onCancel = () => handleResolve(false);
            const onOutsideClick = (e) => {
                if (e.target === modal) handleResolve(false);
            };

            okBtn.addEventListener("click", onOk);
            cancelBtn.addEventListener("click", onCancel);
            closeBtn.addEventListener("click", onCancel);
            setTimeout(() => {
                window.addEventListener("click", onOutsideClick);
            }, 0);
        });
    },

    async checkServerApiKey() {
        try {
            const response = await fetch("/api/settings", {
                method: "GET",
                headers: { "Authorization": `Bearer ${Auth.getToken()}` }
            });
            if (response.ok) {
                const data = await response.json();
                this.serverHasApiKey = data.has_api_key;
            }
        } catch (err) {
            console.error("Failed to query settings:", err);
        }
        this.checkDemoBadge();
    },

    checkDemoBadge() {
        const demoBadge = document.getElementById("demo-badge");
        // Demo badge is visible only if neither server key nor client key is set
        if (!this.serverHasApiKey && !this.settings.apiKey) {
            demoBadge.classList.remove("hidden");
        } else {
            demoBadge.classList.add("hidden");
        }
    },

    bindEvents() {
        // Theme button
        document.getElementById("theme-toggle-btn").addEventListener("click", () => this.toggleTheme());
        
        // Settings triggers
        document.getElementById("settings-toggle-btn").addEventListener("click", () => {
            document.getElementById("settings-modal").classList.remove("hidden");
        });
        document.getElementById("close-settings-btn").addEventListener("click", () => {
            document.getElementById("settings-modal").classList.add("hidden");
        });
        document.getElementById("save-settings-btn").addEventListener("click", () => {
            this.saveSettings();
            document.getElementById("settings-modal").classList.add("hidden");
        });

        // Sliders feedback
        document.getElementById("settings-temp").addEventListener("input", (e) => {
            document.getElementById("temp-val").innerText = e.target.value;
        });
        document.getElementById("settings-max-tokens").addEventListener("input", (e) => {
            document.getElementById("tokens-val").innerText = e.target.value;
        });

        // Sidebar collapsible controls
        document.getElementById("sidebar-toggle-btn").addEventListener("click", () => {
            document.getElementById("sidebar").classList.toggle("active");
        });
        document.getElementById("close-sidebar-mobile-btn").addEventListener("click", () => {
            document.getElementById("sidebar").classList.remove("active");
        });

        // Chat text area auto growth
        const textarea = document.getElementById("chat-textarea");
        const adjustTextareaHeight = () => {
            if (!textarea) return;
            textarea.style.height = "auto";
            const newHeight = Math.max(24, textarea.scrollHeight - 4);
            textarea.style.height = newHeight + "px";
        };
        textarea.addEventListener("input", adjustTextareaHeight);
        window.addEventListener("resize", adjustTextareaHeight);
        
        // Prevent placeholder cutoffs by executing height checks on initial load
        setTimeout(adjustTextareaHeight, 150);
        setTimeout(adjustTextareaHeight, 600);

        // Reset scroll when input loses focus (fixes keyboard layout shifts in iOS Safari)
        textarea.addEventListener("blur", () => {
            window.scrollTo(0, 0);
        });

        // Dismiss mobile sidebar when tapping on messages area
        document.getElementById("messages-container").addEventListener("click", () => {
            if (window.innerWidth <= 868) {
                document.getElementById("sidebar").classList.remove("active");
            }
        });

        // Press Enter to submit prompt
        textarea.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                this.handleSendMessage();
            }
        });

        // Send & Stop action buttons
        document.getElementById("send-btn").addEventListener("click", () => this.handleSendMessage());
        document.getElementById("stop-btn").addEventListener("click", () => this.stopGeneration());

        // Create new chat
        document.getElementById("new-chat-btn").addEventListener("click", () => this.createNewSession());

        // Search chats
        document.getElementById("search-history").addEventListener("input", (e) => {
            this.loadSessionsList(e.target.value.trim());
        });

        // File Uploader attachments trigger
        document.getElementById("attach-file-btn").addEventListener("click", () => {
            document.getElementById("file-uploader").click();
        });
        document.getElementById("file-uploader").addEventListener("change", (e) => {
            this.handleFileUpload(e.target.files);
        });

        // Clean configure, account, and admin modal close on click outside
        window.addEventListener("click", (e) => {
            const modal = document.getElementById("settings-modal");
            if (e.target === modal) {
                modal.classList.add("hidden");
            }
            const accountModal = document.getElementById("account-modal");
            if (e.target === accountModal) {
                accountModal.classList.add("hidden");
            }
            const adminModal = document.getElementById("admin-modal");
            if (e.target === adminModal) {
                Admin.closePanel();
            }
        });

        // Account Details Modal triggers (clicking on .user-profile container)
        const userProfile = document.querySelector(".user-profile");
        if (userProfile) {
            userProfile.addEventListener("click", () => {
                const modal = document.getElementById("account-modal");
                if (modal) {
                    const username = localStorage.getItem("aetheris_username") || "User";
                    const isAdmin = localStorage.getItem("aetheris_is_admin") === "true";
                    const createdAt = localStorage.getItem("aetheris_created_at");
                    
                    document.getElementById("account-username-display").innerText = username;
                    document.getElementById("account-role-display").innerText = `Role: ${isAdmin ? "Administrator" : "Regular User"}`;
                    
                    let dateStr = "N/A";
                    if (createdAt) {
                        dateStr = new Date(createdAt).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        });
                    }
                    document.getElementById("account-date-display").innerText = `Member Since: ${dateStr}`;
                    
                    // Reset fields
                    document.getElementById("change-curr-pass").value = "";
                    document.getElementById("change-new-pass").value = "";
                    document.getElementById("change-pass-error").classList.add("hidden");
                    document.getElementById("change-pass-success").classList.add("hidden");
                    
                    modal.classList.remove("hidden");
                }
            });
        }

        // Close Account Modal
        const closeAccountBtn = document.getElementById("account-close-btn");
        if (closeAccountBtn) {
            closeAccountBtn.addEventListener("click", () => {
                document.getElementById("account-modal").classList.add("hidden");
            });
        }

        // Account Details Modal Sign Out Button
        const accountLogoutBtn = document.getElementById("account-logout-btn");
        if (accountLogoutBtn) {
            accountLogoutBtn.addEventListener("click", () => {
                Auth.logout();
            });
        }

        // Close Admin Modal
        const closeAdminBtn = document.getElementById("admin-close-btn");
        if (closeAdminBtn) {
            closeAdminBtn.addEventListener("click", () => {
                Admin.closePanel();
            });
        }

        // Submit Change Password Form
        const changePasswordForm = document.getElementById("change-password-form");
        if (changePasswordForm) {
            changePasswordForm.addEventListener("submit", async (e) => {
                e.preventDefault();
                const currentPassword = document.getElementById("change-curr-pass").value;
                const newPassword = document.getElementById("change-new-pass").value;
                
                const errBanner = document.getElementById("change-pass-error");
                const successBanner = document.getElementById("change-pass-success");
                
                errBanner.classList.add("hidden");
                successBanner.classList.add("hidden");
                
                if (newPassword.length < 6) {
                    document.getElementById("change-pass-error-msg").innerText = "New password must be at least 6 characters.";
                    errBanner.classList.remove("hidden");
                    return;
                }
                
                try {
                    const response = await fetch("/api/auth/change-password", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${Auth.getToken()}`
                        },
                        body: JSON.stringify({
                            current_password: currentPassword,
                            new_password: newPassword
                        })
                    });
                    
                    const data = await response.json();
                    if (!response.ok) {
                        throw new Error(data.detail || "Failed to update password.");
                    }
                    
                    successBanner.classList.remove("hidden");
                    document.getElementById("change-curr-pass").value = "";
                    document.getElementById("change-new-pass").value = "";
                    setTimeout(() => {
                        document.getElementById("account-modal").classList.add("hidden");
                    }, 1500);
                } catch (err) {
                    document.getElementById("change-pass-error-msg").innerText = err.message;
                    errBanner.classList.remove("hidden");
                }
            });
        }
    },

    // --- LIFE CYCLE CALLBACKS ---

    onAuthSuccess() {
        this.checkServerApiKey();
        this.loadSessionsList();
        this.showLandingWelcome();
        this.setupStealthAdmin();
        
        // Adjust height on login success to ensure placeholder is visible
        setTimeout(() => {
            const textarea = document.getElementById("chat-textarea");
            if (textarea) {
                textarea.style.height = "auto";
                textarea.style.height = Math.max(24, textarea.scrollHeight - 4) + "px";
            }
        }, 200);
    },

    setupStealthAdmin() {
        if (localStorage.getItem("aetheris_is_admin") === "true") {
            const brandLogo = document.querySelector(".sidebar-header .brand");
            if (brandLogo) {
                brandLogo.style.cursor = "pointer";
                brandLogo.removeEventListener("dblclick", this._onAdminDblClick);
                this._onAdminDblClick = () => {
                    Admin.openPanel();
                };
                brandLogo.addEventListener("dblclick", this._onAdminDblClick);
            }
        }
    },

    onLogout() {
        this.activeSessionId = null;
        this.stopSpeaking();
        this.showLandingWelcome();
        
        // Hide modals
        document.getElementById("account-modal").classList.add("hidden");
        Admin.closePanel();
        
        // Reset logo state
        const brandLogo = document.querySelector(".sidebar-header .brand");
        if (brandLogo) {
            brandLogo.style.cursor = "";
            brandLogo.removeEventListener("dblclick", this._onAdminDblClick);
        }
    },

    // --- CHAT SESSION CRUD ---

    async loadSessionsList(searchQuery = "") {
        const listContainer = document.getElementById("sessions-list");
        listContainer.innerHTML = "";

        try {
            let url = "/api/chats";
            if (searchQuery) {
                url = `/api/chats/search?q=${encodeURIComponent(searchQuery)}`;
            }

            const response = await fetch(url, {
                headers: { "Authorization": `Bearer ${Auth.getToken()}` }
            });

            if (!response.ok) return;
            const sessions = await response.json();

            if (sessions.length === 0) {
                listContainer.innerHTML = '<p class="text-center muted-text" style="font-size: 0.8rem; margin-top:20px;">No conversations found</p>';
                return;
            }

            sessions.forEach(s => {
                const pill = document.createElement("div");
                pill.className = `session-pill ${s.id === this.activeSessionId ? 'active' : ''}`;
                pill.dataset.id = s.id;
                
                pill.innerHTML = `
                    <div class="session-left">
                        <i class="fa-regular fa-message session-icon"></i>
                        <span class="session-title">${s.title}</span>
                    </div>
                    <div class="session-actions">
                        <button class="btn-session-action edit" title="Rename"><i class="fa-regular fa-pen-to-square"></i></button>
                        <button class="btn-session-action export-btn" title="Export"><i class="fa-solid fa-file-arrow-down"></i></button>
                        <button class="btn-session-action delete" title="Delete"><i class="fa-regular fa-trash-can"></i></button>
                    </div>
                `;

                // Handle select session click (ignoring action button clicks)
                pill.addEventListener("click", (e) => {
                    if (e.target.closest(".btn-session-action")) return;
                    this.selectSession(s.id);
                });

                // Double click rename trigger
                pill.querySelector(".session-left").addEventListener("dblclick", () => {
                    this.triggerRenameSession(pill, s.id, s.title);
                });

                // Action buttons bindings
                pill.querySelector(".edit").addEventListener("click", () => {
                    this.triggerRenameSession(pill, s.id, s.title);
                });

                pill.querySelector(".export-btn").addEventListener("click", () => {
                    this.triggerExportSession(s.id);
                });

                pill.querySelector(".delete").addEventListener("click", () => {
                    this.deleteSession(s.id);
                });

                listContainer.appendChild(pill);
            });
        } catch (err) {
            console.error("Error loading chat sessions:", err);
        }
    },

    async createNewSession(preventViewportReset = false) {
        try {
            const response = await fetch("/api/chats", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${Auth.getToken()}`
                },
                body: JSON.stringify({ title: "New Conversation" })
            });

            if (!response.ok) throw new Error("Could not create chat session.");
            const session = await response.json();
            
            this.activeSessionId = session.id;
            await this.loadSessionsList();
            
            if (preventViewportReset) {
                // Highlight active sidebar pill without resetting viewport
                document.querySelectorAll(".session-pill").forEach(p => {
                    if (p.dataset.id === session.id) p.classList.add("active");
                    else p.classList.remove("active");
                });
                document.getElementById("active-chat-title").innerText = session.title;
            } else {
                await this.selectSession(session.id);
            }
        } catch (err) {
            alert(err.message);
        }
    },

    async selectSession(sessionId) {
        this.activeSessionId = sessionId;
        this.stopSpeaking();
        
        // Highlight active sidebar pill
        document.querySelectorAll(".session-pill").forEach(p => {
            if (p.dataset.id === sessionId) p.classList.add("active");
            else p.classList.remove("active");
        });

        // Hide mobile sidebar
        document.getElementById("sidebar").classList.remove("active");

        const msgContainer = document.getElementById("messages-container");
        msgContainer.innerHTML = "";
        
        const welcomeScreen = document.getElementById("welcome-screen");
        if (welcomeScreen) welcomeScreen.classList.add("hidden");
        msgContainer.classList.remove("hidden");

        // Show loading spinner
        msgContainer.innerHTML = `
            <div class="welcome-box">
                <i class="fa-solid fa-circle-notch fa-spin welcome-logo gradient-text"></i>
                <p class="muted-text">Retrieving chat history...</p>
            </div>
        `;

        try {
            const response = await fetch(`/api/chats/${sessionId}`, {
                headers: { "Authorization": `Bearer ${Auth.getToken()}` }
            });

            if (!response.ok) throw new Error("Failed to load conversation details.");
            const details = await response.json();
            
            // Set header title
            document.getElementById("active-chat-title").innerText = details.title;

            // Clear loading spinner
            msgContainer.innerHTML = "";

            if (details.messages.length === 0) {
                this.showLandingWelcome(true);
            } else {
                if (welcomeScreen) welcomeScreen.classList.add("hidden");
                msgContainer.classList.remove("hidden");
                details.messages.forEach(m => {
                    this.renderMessageBubble(m.sender, m.content, m.id);
                });
                this.scrollToBottom();
            }

            // Render uploaded files in bar
            this.renderDocumentPills(details.documents);

        } catch (err) {
            msgContainer.innerHTML = `<div class="error-banner"><i class="fa-solid fa-circle-exclamation"></i> ${err.message}</div>`;
        }
    },

    triggerRenameSession(pill, sessionId, currentTitle) {
        const titleSpan = pill.querySelector(".session-title");
        const actionsDiv = pill.querySelector(".session-actions");
        
        // Hide icons, replace text with input box
        actionsDiv.style.display = "none";
        const input = document.createElement("input");
        input.type = "text";
        input.className = "session-rename-input";
        input.value = currentTitle;
        
        titleSpan.innerHTML = "";
        titleSpan.appendChild(input);
        input.focus();
        input.select();

        const submitRename = async () => {
            const newTitle = input.value.trim();
            if (newTitle && newTitle !== currentTitle) {
                try {
                    const response = await fetch(`/api/chats/${sessionId}`, {
                        method: "PUT",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${Auth.getToken()}`
                        },
                        body: JSON.stringify({ title: newTitle })
                    });
                    if (response.ok) {
                        this.loadSessionsList();
                        if (sessionId === this.activeSessionId) {
                            document.getElementById("active-chat-title").innerText = newTitle;
                        }
                    }
                } catch (e) {
                    console.error("Rename failed:", e);
                }
            } else {
                // Restore old text
                this.loadSessionsList();
            }
        };

        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") submitRename();
            if (e.key === "Escape") this.loadSessionsList();
        });
        input.addEventListener("blur", submitRename);
    },

    async deleteSession(sessionId) {
        const confirmed = await this.showConfirm("Are you sure you want to delete this chat session? All transcripts and file indexes will be lost permanently.", "Aetheris says", "Delete", "Cancel");
        if (!confirmed) return;

        try {
            const response = await fetch(`/api/chats/${sessionId}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${Auth.getToken()}` }
            });

            if (response.ok) {
                if (sessionId === this.activeSessionId) {
                    this.activeSessionId = null;
                    this.showLandingWelcome();
                }
                this.loadSessionsList();
            }
        } catch (err) {
            console.error("Delete session failure:", err);
        }
    },

    triggerExportSession(sessionId) {
        const dropdownHtml = `
            <div id="export-dropdown-${sessionId}" class="glass-panel" style="position:absolute; right:10px; background:var(--bg-secondary); border:1px solid var(--glass-border); padding:8px; border-radius:var(--radius-sm); z-index:1000; box-shadow:0 4px 12px rgba(0,0,0,0.25);">
                <button class="btn-session-action" onclick="App.executeExport('${sessionId}', 'txt')" style="display:flex; width:100%; align-items:center; gap:8px; padding:6px; font-size:0.8rem; color:var(--text-primary); text-align:left;"><i class="fa-regular fa-file-lines"></i> Export as Text (.txt)</button>
                <button class="btn-session-action" onclick="App.executeExport('${sessionId}', 'docx')" style="display:flex; width:100%; align-items:center; gap:8px; padding:6px; font-size:0.8rem; color:var(--text-primary); text-align:left; margin-top:4px;"><i class="fa-regular fa-file-word"></i> Export as Word (.docx)</button>
                <button class="btn-session-action" onclick="App.executeExport('${sessionId}', 'pdf')" style="display:flex; width:100%; align-items:center; gap:8px; padding:6px; font-size:0.8rem; color:var(--text-primary); text-align:left; margin-top:4px;"><i class="fa-regular fa-file-pdf"></i> Export as PDF (.pdf)</button>
            </div>
        `;
        
        // Remove existing dropdowns
        const existing = document.querySelector('[id^="export-dropdown-"]');
        if (existing) {
            existing.remove();
            if (existing.id === `export-dropdown-${sessionId}`) return;
        }

        // Append to body and align
        const btn = document.querySelector(`.session-pill[data-id="${sessionId}"] .export-btn`);
        const rect = btn.getBoundingClientRect();
        
        const wrapper = document.createElement("div");
        wrapper.innerHTML = dropdownHtml;
        const dropdown = wrapper.firstElementChild;
        document.body.appendChild(dropdown);
        
        dropdown.style.top = `${rect.bottom + window.scrollY + 6}px`;
        dropdown.style.left = `${rect.left + window.scrollX - 110}px`;

        // Close dropdown when clicking outside
        const closeDropdown = (e) => {
            if (!dropdown.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
                dropdown.remove();
                window.removeEventListener("click", closeDropdown);
            }
        };
        setTimeout(() => window.addEventListener("click", closeDropdown), 10);
    },

    executeExport(sessionId, format) {
        const token = Auth.getToken();
        const url = `/api/chats/${sessionId}/export/${format}`;
        
        // Simply trigger download using standard link trigger
        const a = document.createElement("a");
        a.href = url;
        // Send authorization token as query param fallback? No!
        // Browser download trigger using fetch is safer for Auth header headers!
        fetch(url, {
            headers: { "Authorization": `Bearer ${token}` }
        })
        .then(response => {
            if (!response.ok) throw new Error("Export download failed.");
            return response.blob();
        })
        .then(blob => {
            const downloadUrl = window.URL.createObjectURL(blob);
            a.href = downloadUrl;
            a.download = `chat_export_${sessionId}.${format}`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(downloadUrl);
        })
        .catch(err => alert(err.message));
        
        const existing = document.getElementById(`export-dropdown-${sessionId}`);
        if (existing) existing.remove();
    },

    showLandingWelcome(showMetaOnly = false) {
        document.getElementById("active-chat-title").innerText = showMetaOnly ? "New Conversation" : "Aetheris AI Chatbot";
        
        const welcomeScreen = document.getElementById("welcome-screen");
        const msgContainer = document.getElementById("messages-container");
        
        if (welcomeScreen) welcomeScreen.classList.remove("hidden");
        if (msgContainer) {
            msgContainer.classList.add("hidden");
            msgContainer.innerHTML = "";
        }
        
        // Hide file uploader status bar
        document.getElementById("upload-status-bar").classList.add("hidden");
        document.getElementById("rag-status-indicator").classList.add("hidden");

        // Clear sidebar selection
        if (!showMetaOnly) {
            document.querySelectorAll(".session-pill").forEach(p => p.classList.remove("active"));
        }
    },

    // --- UPLOAD & DOCUMENT HANDLING ---

    async handleFileUpload(files) {
        if (files.length === 0) return;
        
        // If no active session, create one first
        if (!this.activeSessionId) {
            await this.createNewSession(true);
        }

        const bar = document.getElementById("upload-status-bar");
        const container = document.getElementById("attached-files-container");
        bar.classList.remove("hidden");

        for (const file of files) {
            // Append temporary uploading capsule
            const pillId = "temp-upload-" + Math.floor(Math.random() * 1000000);
            const pill = document.createElement("div");
            pill.className = "file-pill";
            pill.id = pillId;
            pill.innerHTML = `
                <i class="fa-solid fa-spinner fa-spin file-icon"></i>
                <span>Indexing ${file.name}...</span>
            `;
            container.appendChild(pill);

            // Prepare payload
            const formData = new FormData();
            formData.append("file", file);

            try {
                const response = await fetch(`/api/chats/${this.activeSessionId}/documents`, {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${Auth.getToken()}`,
                        "X-OpenAI-Key": this.settings.apiKey || ""
                    },
                    body: formData
                });

                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.detail || `Upload failed for ${file.name}`);
                }

                const doc = await response.json();
                
                // Replace loading pill with standard active document pill
                this.replaceDocumentPill(pillId, doc);
                this.toggleRagBadge(true);

            } catch (err) {
                pill.classList.add("error");
                pill.innerHTML = `
                    <i class="fa-solid fa-circle-exclamation" style="color:var(--error-color)"></i>
                    <span style="color:var(--error-color)">Failed: ${file.name}</span>
                    <button class="btn-delete-file" onclick="document.getElementById('${pillId}').remove()"><i class="fa-solid fa-xmark"></i></button>
                `;
                console.error("Document upload failed:", err.message);
            }
        }

        // Reset file input
        document.getElementById("file-uploader").value = "";
    },

    renderDocumentPills(documents) {
        const bar = document.getElementById("upload-status-bar");
        const container = document.getElementById("attached-files-container");
        container.innerHTML = "";

        if (!documents || documents.length === 0) {
            bar.classList.add("hidden");
            this.toggleRagBadge(false);
            return;
        }

        bar.classList.remove("hidden");
        this.toggleRagBadge(true);

        documents.forEach(doc => {
            const pill = this.createDocumentPillElement(doc);
            container.appendChild(pill);
        });
    },

    createDocumentPillElement(doc) {
        const pill = document.createElement("div");
        pill.className = "file-pill";
        pill.dataset.id = doc.id;
        
        let fileIcon = "fa-file-lines";
        if (doc.file_type === "pdf") fileIcon = "fa-file-pdf";
        else if (["xlsx", "xls", "csv"].includes(doc.file_type)) fileIcon = "fa-file-excel";
        else if (doc.file_type === "docx") fileIcon = "fa-file-word";
        else if (doc.file_type === "md") fileIcon = "fa-file-pen";

        // Size conversion
        const kbSize = (doc.file_size / 1024).toFixed(1);

        pill.innerHTML = `
            <i class="fa-regular ${fileIcon} file-icon"></i>
            <a href="/api/chats/${this.activeSessionId}/documents/${doc.id}/download" target="_blank" class="file-link" style="color:inherit;text-decoration:none;" title="Download file">${doc.filename} (${kbSize} KB)</a>
            <button class="btn-delete-file" title="Remove Document" onclick="App.deleteDocument(${doc.id})"><i class="fa-regular fa-trash-can"></i></button>
        `;
        return pill;
    },

    replaceDocumentPill(tempId, doc) {
        const tempPill = document.getElementById(tempId);
        if (!tempPill) return;

        const newPill = this.createDocumentPillElement(doc);
        tempPill.replaceWith(newPill);
    },

    async deleteDocument(docId) {
        const confirmed = await this.showConfirm("Remove this document from memory context?", "Aetheris says", "Remove", "Cancel");
        if (!confirmed) return;

        // Find and show loading spinner inside pill
        const pill = document.querySelector(`.file-pill[data-id="${docId}"]`);
        if (pill) {
            pill.innerHTML = `
                <i class="fa-solid fa-spinner fa-spin file-icon"></i>
                <span>Removing & Rebuilding index...</span>
            `;
        }

        try {
            const response = await fetch(`/api/chats/${this.activeSessionId}/documents/${docId}`, {
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${Auth.getToken()}`,
                    "X-OpenAI-Key": this.settings.apiKey || ""
                }
            });

            if (response.ok) {
                if (pill) pill.remove();
                
                // Hide uploader status bar if empty
                const container = document.getElementById("attached-files-container");
                if (container.children.length === 0) {
                    document.getElementById("upload-status-bar").classList.add("hidden");
                    this.toggleRagBadge(false);
                }
            } else {
                throw new Error("Could not delete file index.");
            }
        } catch (err) {
            alert(err.message);
            this.selectSession(this.activeSessionId); // reload
        }
    },

    toggleRagBadge(active) {
        const badge = document.getElementById("rag-status-indicator");
        if (active) badge.classList.remove("hidden");
        else badge.classList.add("hidden");
    },

    // --- MESSAGE SENDING & STREAMING ENGINE ---

    async handleSendMessage() {
        try {
            if (this.isGenerating) return;

            const textarea = document.getElementById("chat-textarea");
            const messageText = textarea.value.trim();
            if (!messageText) return;

            // Auto create session if none active
            if (!this.activeSessionId) {
                await this.createNewSession(true);
            }

            // Clear textarea, reset height
            textarea.value = "";
            textarea.style.height = "auto";

            // Stop current speaking
            this.stopSpeaking();

            // 1. Render User message in UI
            const msgContainer = document.getElementById("messages-container");
            if (msgContainer) msgContainer.classList.remove("hidden");

            this.renderMessageBubble("user", messageText);
            this.scrollToBottom();

            // Hide landing welcome if visible
            const welcomeScreen = document.getElementById("welcome-screen");
            if (welcomeScreen) welcomeScreen.classList.add("hidden");

            // 2. Set streaming UI state
            this.setGeneratingState(true);

            // 3. Render typing indicator bubble
            const typingPill = document.createElement("div");
            typingPill.className = "message-wrapper ai animate-fade-in";
            typingPill.id = "aetheris-typing-indicator";
            typingPill.innerHTML = `
                <div class="msg-avatar"><i class="fa-solid fa-wand-magic-sparkles"></i></div>
                <div class="msg-body">
                    <div class="msg-bubble glass-panel typing-bubble">
                        <span class="typing-dot"></span>
                        <span class="typing-dot"></span>
                        <span class="typing-dot"></span>
                    </div>
                </div>
            `;
            msgContainer.appendChild(typingPill);
            this.scrollToBottom();

            // Prepare Abort Controller to let users interrupt stream
            this.abortController = new AbortController();

            // 4. Create empty AI message wrapper in DOM
            const aiWrapper = document.createElement("div");
            aiWrapper.className = "message-wrapper ai animate-fade-in hidden";
            const aiMsgId = "ai-msg-stream-" + Math.floor(Math.random() * 1000000);
            aiWrapper.id = aiMsgId;
            aiWrapper.innerHTML = `
                <div class="msg-avatar"><i class="fa-solid fa-wand-magic-sparkles"></i></div>
                <div class="msg-body">
                    <div class="msg-bubble glass-panel markdown-content"></div>
                    <div class="msg-controls">
                        <button class="msg-action-btn speak-btn" onclick="App.playSpeechBubble('${aiMsgId}')"><i class="fa-solid fa-volume-high"></i> Read</button>
                        <button class="msg-action-btn copy-btn" onclick="App.copyMessageText('${aiMsgId}')"><i class="fa-regular fa-copy"></i> Copy</button>
                    </div>
                </div>
            `;
            msgContainer.appendChild(aiWrapper);

            let fullContent = "";
            let streamError = "";

            try {
                const response = await fetch(`/api/chats/${this.activeSessionId}/messages`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${Auth.getToken()}`,
                        "X-OpenAI-Key": this.settings.apiKey || "",
                        "X-Model": this.settings.model,
                        "X-Temperature": this.settings.temperature.toString(),
                        "X-Max-Tokens": this.settings.maxTokens.toString()
                    },
                    body: JSON.stringify({ content: messageText }),
                    signal: this.abortController.signal
                });

                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.detail || "API connection failed.");
                }

                // Remove typing indicator, show empty bubble wrapper
                typingPill.remove();
                aiWrapper.classList.remove("hidden");

                const bubble = aiWrapper.querySelector(".markdown-content");

                // Read ReadableStream chunk output
                const reader = response.body.getReader();
                const decoder = new TextDecoder("utf-8");
                let buffer = "";

                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split("\n\n");
                    buffer = lines.pop(); // save incomplete line

                    for (const line of lines) {
                        if (line.startsWith("data: ")) {
                            const payload = line.substring(6).trim();
                            if (payload === "[DONE]") {
                                break;
                            }

                            try {
                                const data = JSON.parse(payload);
                                if (data.content) {
                                    fullContent += data.content;
                                    // Parse Markdown on the fly
                                    bubble.innerHTML = marked.parse(fullContent);
                                    this.highlightCodeBlocks(bubble);
                                    this.scrollToBottom();
                                } else if (data.error) {
                                    streamError = data.error;
                                    bubble.innerHTML += `<div class="error-banner"><i class="fa-solid fa-triangle-exclamation"></i> ${data.error}</div>`;
                                }
                            } catch (e) {
                                // JSON parsing errors on partial chunks
                            }
                        }
                    }
                }

                // Cleanup Abort Controller
                this.abortController = null;
                this.setGeneratingState(false);

                // Re-render final block with highlighting
                if (fullContent) {
                    bubble.innerHTML = marked.parse(fullContent);
                    this.highlightCodeBlocks(bubble);
                }
                if (streamError) {
                    bubble.innerHTML += `<div class="error-banner"><i class="fa-solid fa-triangle-exclamation"></i> ${streamError}</div>`;
                }
                this.scrollToBottom();

                // Refresh sessions list in background to update title if changed
                this.loadSessionsList();

                // Trigger TTS auto read if configured
                if (Voice.autoRead) {
                    Voice.speak(fullContent);
                }

            } catch (err) {
                if (typingPill && typingPill.parentNode) typingPill.remove();
                if (err.name === "AbortError") {
                    console.log("Streaming interrupted by user.");
                    // Update bubble content if anything was printed
                    if (fullContent) {
                        aiWrapper.classList.remove("hidden");
                        aiWrapper.querySelector(".markdown-content").innerHTML = marked.parse(fullContent) + '<p class="muted-text" style="font-size:0.78rem;margin-top:10px;"><i class="fa-solid fa-ban"></i> Stream generation halted by user.</p>';
                    } else {
                        aiWrapper.remove();
                    }
                } else {
                    aiWrapper.classList.remove("hidden");
                    aiWrapper.querySelector(".markdown-content").innerHTML = `<div class="error-banner"><i class="fa-solid fa-circle-exclamation"></i> ${err.message}</div>`;
                }
                this.setGeneratingState(false);
                this.abortController = null;
                this.scrollToBottom();
            }
        } catch (globalErr) {
            console.error("Global handleSendMessage error:", globalErr);
            alert("Global Error: " + globalErr.message + "\nStack: " + globalErr.stack);
        }
    },

    stopGeneration() {
        if (this.abortController) {
            this.abortController.abort();
        }
    },

    setGeneratingState(generating) {
        this.isGenerating = generating;
        const textarea = document.getElementById("chat-textarea");
        const sendBtn = document.getElementById("send-btn");
        const stopBtn = document.getElementById("stop-btn");
        const micBtn = document.getElementById("mic-btn");

        if (generating) {
            textarea.disabled = true;
            micBtn.disabled = true;
            sendBtn.classList.add("hidden");
            stopBtn.classList.remove("hidden");
        } else {
            textarea.disabled = false;
            micBtn.disabled = false;
            stopBtn.classList.add("hidden");
            sendBtn.classList.remove("hidden");
            textarea.focus();
        }
    },

    // --- UI RENDERERS & HELPERS ---

    renderMessageBubble(sender, content, msgId = "") {
        const msgContainer = document.getElementById("messages-container");
        const wrapper = document.createElement("div");
        wrapper.className = `message-wrapper ${sender} animate-fade-in`;
        if (msgId) wrapper.dataset.msgId = msgId;

        const avatarIcon = sender === "user" ? '<i class="fa-solid fa-user-ninja"></i>' : '<i class="fa-solid fa-wand-magic-sparkles"></i>';
        
        // Parse Markdown contents
        const bodyContent = sender === "user" ? SecurityUtils_escapeHtml(content) : marked.parse(content);
        
        let controlsHtml = "";
        if (sender === "ai") {
            const uniqueId = msgId || "msg-id-" + Math.floor(Math.random() * 1000000);
            wrapper.id = uniqueId;
            controlsHtml = `
                <div class="msg-controls">
                    <button class="msg-action-btn speak-btn" onclick="App.playSpeechBubble('${uniqueId}')"><i class="fa-solid fa-volume-high"></i> Read</button>
                    <button class="msg-action-btn copy-btn" onclick="App.copyMessageText('${uniqueId}')"><i class="fa-regular fa-copy"></i> Copy</button>
                </div>
            `;
        } else {
            // User message action controls: edit and regenerate
            const uniqueId = msgId || "user-msg-id-" + Math.floor(Math.random() * 1000000);
            wrapper.id = uniqueId;
            controlsHtml = `
                <div class="msg-controls">
                    <button class="msg-action-btn edit-btn" onclick="App.triggerEditPrompt('${uniqueId}', \`${content.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`)"><i class="fa-regular fa-pen-to-square"></i> Edit</button>
                </div>
            `;
        }

        wrapper.innerHTML = `
            <div class="msg-avatar">${avatarIcon}</div>
            <div class="msg-body">
                <div class="msg-bubble glass-panel markdown-content">${bodyContent}</div>
                ${controlsHtml}
            </div>
        `;
        msgContainer.appendChild(wrapper);
        
        if (sender === "ai") {
            const bubble = wrapper.querySelector(".markdown-content");
            this.highlightCodeBlocks(bubble);
        }
    },

    highlightCodeBlocks(element) {
        element.querySelectorAll("pre code").forEach(block => {
            // Check if highlight.js has already run on this block
            if (block.dataset.highlighted) return;

            // Wrap in standard code-container
            const pre = block.parentNode;
            const container = document.createElement("div");
            container.className = "code-container";
            
            // Get language class
            let lang = "code";
            const classes = Array.from(block.classList);
            const langClass = classes.find(c => c.startsWith("language-"));
            if (langClass) lang = langClass.replace("language-", "");

            const header = document.createElement("div");
            header.className = "code-header";
            header.innerHTML = `
                <span><i class="fa-solid fa-code"></i> ${lang.toUpperCase()}</span>
                <button class="btn-copy-code"><i class="fa-regular fa-clipboard"></i> Copy</button>
            `;

            // Setup copy listener
            header.querySelector(".btn-copy-code").addEventListener("click", (e) => {
                const codeText = block.innerText;
                navigator.clipboard.writeText(codeText).then(() => {
                    const btn = e.currentTarget;
                    btn.innerHTML = '<i class="fa-solid fa-check" style="color:var(--success-color)"></i> <span style="color:var(--success-color)">Copied!</span>';
                    setTimeout(() => {
                        btn.innerHTML = '<i class="fa-regular fa-clipboard"></i> Copy';
                    }, 2000);
                });
            });

            // Reconstruct block
            pre.parentNode.insertBefore(container, pre);
            container.appendChild(header);
            container.appendChild(pre);

            // Highlight syntax
            hljs.highlightElement(block);
            block.dataset.highlighted = "true";
        });
    },

    scrollToBottom() {
        const container = document.getElementById("messages-container");
        container.scrollTop = container.scrollHeight;
    },

    // --- MESSAGE INTERACTIVE BINDINGS ---

    playSpeechBubble(wrapperId) {
        const wrapper = document.getElementById(wrapperId);
        if (!wrapper) return;

        const bubble = wrapper.querySelector(".markdown-content");
        const btn = wrapper.querySelector(".speak-btn");
        
        // If clicking on the currently active speaking button
        if (Voice.isPlaying && this.activeSpeakingBtn === btn) {
            // Pause/Stop toggle
            const isPaused = Voice.engine === "sarvam"
                ? (Voice.audioPlayer ? Voice.audioPlayer.paused : true)
                : Voice.synthesis.paused;

            if (isPaused) {
                Voice.resumeSpeaking();
                btn.innerHTML = '<i class="fa-solid fa-pause"></i> Pause';
            } else {
                Voice.pauseSpeaking();
                btn.innerHTML = '<i class="fa-solid fa-volume-high"></i> Resume';
            }
        } else {
            // Reset old speaking button if any
            if (this.activeSpeakingBtn && this.activeSpeakingBtn !== btn) {
                this.activeSpeakingBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i> Read';
                this.activeSpeakingBtn.disabled = false;
            }
            this.activeSpeakingBtn = btn;

            // Read new speech
            const textContent = bubble.innerText;
            Voice.speak(textContent, btn);
        }
    },

    stopSpeaking() {
        Voice.stopSpeaking();
    },

    copyMessageText(wrapperId) {
        const wrapper = document.getElementById(wrapperId);
        if (!wrapper) return;

        const textContent = wrapper.querySelector(".markdown-content").innerText;
        navigator.clipboard.writeText(textContent).then(() => {
            const btn = wrapper.querySelector(".copy-btn");
            btn.innerHTML = '<i class="fa-solid fa-check" style="color:var(--success-color)"></i> Copied';
            setTimeout(() => {
                btn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy';
            }, 2000);
        });
    },

    triggerEditPrompt(wrapperId, originalContent) {
        const wrapper = document.getElementById(wrapperId);
        if (!wrapper) return;

        const bubble = wrapper.querySelector(".markdown-content");
        const controls = wrapper.querySelector(".msg-controls");
        
        // Hide controls, swap bubble text with textarea editor
        controls.style.display = "none";
        
        bubble.innerHTML = `
            <div class="edit-prompt-area" style="display:flex; flex-direction:column; gap:10px; width:100%;">
                <textarea class="glass-panel" style="width:100%; border-radius:var(--radius-md); padding:10px; font-family:var(--font-primary); font-size:0.95rem; background:var(--bg-primary); border:1px solid var(--glass-border); color:var(--text-primary); resize:vertical; min-height:80px;">${originalContent}</textarea>
                <div class="edit-actions" style="display:flex; gap:10px; justify-content:flex-end;">
                    <button class="btn btn-primary btn-save-edit" style="padding:6px 12px; font-size:0.8rem;"><i class="fa-solid fa-check"></i> Resend</button>
                    <button class="btn btn-close-modal btn-cancel-edit" style="padding:6px 12px; font-size:0.8rem; border:1px solid var(--glass-border); border-radius:var(--radius-md);">Cancel</button>
                </div>
            </div>
        `;

        const textarea = bubble.querySelector("textarea");
        textarea.focus();

        const cancelEdit = () => {
            bubble.innerHTML = SecurityUtils_escapeHtml(originalContent);
            controls.style.display = "flex";
        };

        const saveEdit = async () => {
            const newPrompt = textarea.value.trim();
            if (!newPrompt) return;

            // Remove all subsequent messages in chat history from database or client UI?
            // To emulate ChatGPT, we append the edited prompt and call completion.
            // Let's copy it to prompt area and click send
            document.getElementById("chat-textarea").value = newPrompt;
            cancelEdit();
            this.handleSendMessage();
        };

        bubble.querySelector(".btn-cancel-edit").addEventListener("click", cancelEdit);
        bubble.querySelector(".btn-save-edit").addEventListener("click", saveEdit);
    }
};

// --- HELPER SANITIZERS ---

function SecurityUtils_escapeHtml(text) {
    if (!text) return "";
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// --- STEALTH ADMIN MODULE ---

const Admin = {
    modalId: "admin-modal",
    
    async openPanel() {
        const modal = document.getElementById(this.modalId);
        if (!modal) return;
        
        modal.classList.remove("hidden");
        await this.loadStats();
        await this.loadUsers();
    },
    
    closePanel() {
        const modal = document.getElementById(this.modalId);
        if (modal) modal.classList.add("hidden");
    },
    
    async loadStats() {
        try {
            const response = await fetch("/api/admin/stats", {
                headers: { "Authorization": `Bearer ${Auth.getToken()}` }
            });
            if (!response.ok) throw new Error("Failed to fetch admin stats.");
            const data = await response.json();
            
            document.getElementById("admin-stat-users").innerText = data.total_users;
            document.getElementById("admin-stat-chats").innerText = data.total_sessions;
            document.getElementById("admin-stat-messages").innerText = data.total_messages;
            
            const sizeBytes = data.total_files_size_bytes;
            let formattedSize = "0 KB";
            if (sizeBytes >= 1024 * 1024) {
                formattedSize = (sizeBytes / (1024 * 1024)).toFixed(2) + " MB";
            } else if (sizeBytes >= 1024) {
                formattedSize = (sizeBytes / 1024).toFixed(2) + " KB";
            } else if (sizeBytes > 0) {
                formattedSize = sizeBytes + " Bytes";
            }
            document.getElementById("admin-stat-storage").innerText = `${formattedSize} (${data.total_files_count} files)`;
        } catch (err) {
            console.error("Admin stats fetch error:", err);
        }
    },
    
    async loadUsers() {
        const tbody = document.getElementById("admin-user-table-body");
        if (!tbody) return;
        
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--text-secondary);">Loading registered users...</td></tr>';
        
        try {
            const response = await fetch("/api/admin/users", {
                headers: { "Authorization": `Bearer ${Auth.getToken()}` }
            });
            if (!response.ok) throw new Error("Failed to fetch user list.");
            const users = await response.json();
            
            tbody.innerHTML = "";
            if (users.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--text-secondary);">No user accounts found.</td></tr>';
                return;
            }
            
            const currentUsername = Auth.getUsername();
            users.forEach(u => {
                const tr = document.createElement("tr");
                const dateStr = new Date(u.created_at).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
                
                const isSelf = u.username === currentUsername;
                const deleteBtn = isSelf 
                    ? '<span class="muted-text" style="font-size:0.8rem;padding-right:10px;">(You)</span>' 
                    : `<button class="btn-danger-sm" onclick="Admin.deleteUser(${u.id}, '${u.username}')"><i class="fa-solid fa-user-minus"></i> Delete</button>`;
                
                tr.innerHTML = `
                    <td style="padding: 10px 15px; color: var(--text-secondary); font-family: monospace;">#${u.id}</td>
                    <td style="padding: 10px 15px; font-weight: 500;">
                        ${u.username}
                        <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:2px;">Joined: ${dateStr}</div>
                    </td>
                    <td style="padding: 10px 15px;">
                        <span style="font-size:0.76rem; padding: 3px 8px; border-radius: 20px; font-weight: 600;
                              background: ${u.is_admin ? 'rgba(255,189,230,0.15)' : 'rgba(255,255,255,0.03)'};
                              color: ${u.is_admin ? 'var(--accent-primary)' : 'var(--text-secondary)'};
                              border: 1px solid ${u.is_admin ? 'rgba(255,189,230,0.3)' : 'var(--glass-border)'};">
                            ${u.is_admin ? 'Administrator' : 'Regular User'}
                        </span>
                    </td>
                    <td style="padding: 10px 15px; text-align: right;">
                        ${deleteBtn}
                    </td>
                `;
                tbody.appendChild(tr);
            });
        } catch (err) {
            console.error("Admin user list fetch error:", err);
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--error-color);"><i class="fa-solid fa-circle-exclamation"></i> Error loading user list.</td></tr>';
        }
    },
    
    async deleteUser(userId, username) {
        if (!confirm(`Are you absolutely sure you want to delete the user account "${username}"?\nThis will permanently delete all of their conversations, uploaded documents, and database records!`)) {
            return;
        }
        
        try {
            const response = await fetch(`/api/admin/users/${userId}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${Auth.getToken()}` }
            });
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.detail || "Delete operation failed.");
            }
            
            await this.loadStats();
            await this.loadUsers();
        } catch (err) {
            alert(`Error deleting user: ${err.message}`);
        }
    }
};

window.Admin = Admin;

document.addEventListener("DOMContentLoaded", () => {
    App.init();
});
