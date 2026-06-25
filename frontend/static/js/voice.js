/* ==========================================================================
   AETHERIS VOICE CONTROLLER (WEB SPEECH API & SARVAM AI PREMIUM TTS)
   ========================================================================== */

const Voice = {
    recognition: null,
    isListening: false,
    synthesis: window.speechSynthesis,
    voices: [],
    speechRate: 1.0,
    autoRead: false,
    selectedVoiceName: "",
    isPlaying: false,
    audioPlayer: null, // HTML5 Audio for Sarvam AI premium voice playback

    // Sarvam AI specific configurations
    engine: "system",
    sarvamLang: "hi-IN",
    sarvamGender: "female",
    sarvamApiKey: "",

    init() {
        this.initSTT();
        this.initTTS();
        this.bindEvents();
    },

    initSTT() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn("Speech Recognition (STT) is not supported in this browser. Microphone disabled.");
            document.getElementById("mic-btn").classList.add("hidden");
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.lang = "en-US";

        this.recognition.onstart = () => {
            this.isListening = true;
            const micBtn = document.getElementById("mic-btn");
            micBtn.classList.add("active");
            micBtn.innerHTML = '<i class="fa-solid fa-microphone-lines"></i>';
            document.getElementById("chat-textarea").placeholder = "Listening... Speak naturally.";
        };

        this.recognition.onresult = (event) => {
            const resultText = event.results[0][0].transcript;
            const textarea = document.getElementById("chat-textarea");
            if (textarea.value.trim()) {
                textarea.value += " " + resultText;
            } else {
                textarea.value = resultText;
            }
            // Auto resize textarea
            textarea.style.height = 'auto';
            textarea.style.height = textarea.scrollHeight + 'px';
        };

        this.recognition.onerror = (event) => {
            console.error("Speech Recognition Error:", event.error);
            this.stopListening();
        };

        this.recognition.onend = () => {
            this.stopListening();
        };
    },

    initTTS() {
        if (!this.synthesis) {
            console.warn("Speech Synthesis (TTS) is not supported in this browser.");
        }

        // Retrieve saved configurations
        this.autoRead = localStorage.getItem("aetheris_auto_read") === "true";
        this.selectedVoiceName = localStorage.getItem("aetheris_speech_voice") || "";
        this.speechRate = parseFloat(localStorage.getItem("aetheris_speech_rate") || "1.0");

        // Retrieve Sarvam configurations
        this.engine = localStorage.getItem("aetheris_tts_engine") || "system";
        this.sarvamLang = localStorage.getItem("aetheris_sarvam_lang") || "hi-IN";
        this.sarvamGender = localStorage.getItem("aetheris_sarvam_gender") || "female";
        this.sarvamApiKey = localStorage.getItem("aetheris_sarvam_api_key") || "";

        // Sync inputs DOM state
        document.getElementById("settings-auto-read").checked = this.autoRead;
        document.getElementById("settings-speech-rate").value = this.speechRate;
        document.getElementById("rate-val").innerText = this.speechRate + "x";

        document.getElementById("settings-tts-engine").value = this.engine;
        document.getElementById("settings-sarvam-lang").value = this.sarvamLang;
        document.getElementById("settings-sarvam-gender").value = this.sarvamGender;
        document.getElementById("settings-sarvam-api-key").value = this.sarvamApiKey;

        // Toggle layout options
        this.toggleEngineOptions(this.engine);

        // Load voices (handles async chrome loading)
        if (this.synthesis) {
            this.loadVoices();
            if (this.synthesis.onvoiceschanged !== undefined) {
                this.synthesis.onvoiceschanged = () => this.loadVoices();
            }
        }

        // Sync voice toggle button UI
        this.updateVoiceToggleUI();
    },

    toggleEngineOptions(engine) {
        const systemOptions = document.getElementById("system-tts-options");
        const sarvamOptions = document.getElementById("sarvam-tts-options");
        if (engine === "sarvam") {
            systemOptions.classList.add("hidden");
            sarvamOptions.classList.remove("hidden");
        } else {
            systemOptions.classList.remove("hidden");
            sarvamOptions.classList.add("hidden");
        }
    },

    updateVoiceToggleUI() {
        const voiceToggle = document.getElementById("voice-speak-toggle");
        if (voiceToggle) {
            if (this.autoRead) {
                voiceToggle.classList.add("active");
                voiceToggle.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
                voiceToggle.title = "Mute Voice Responses";
            } else {
                voiceToggle.classList.remove("active");
                voiceToggle.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
                voiceToggle.title = "Unmute Voice Responses";
            }
        }
    },

    loadVoices() {
        this.voices = this.synthesis.getVoices();
        const select = document.getElementById("settings-voice-select");
        if (!select) return;

        select.innerHTML = "";
        
        // Filter English and standard voices for better clean experience
        this.voices.forEach(voice => {
            const option = document.createElement("option");
            option.value = voice.name;
            option.textContent = `${voice.name} (${voice.lang})`;
            if (voice.name === this.selectedVoiceName) {
                option.selected = true;
            }
            select.appendChild(option);
        });

        // Default fallback if no voice was selected
        if (!this.selectedVoiceName && this.voices.length > 0) {
            // Prefer English voices
            const defaultVoice = this.voices.find(v => v.lang.startsWith("en-")) || this.voices[0];
            this.selectedVoiceName = defaultVoice.name;
            localStorage.setItem("aetheris_speech_voice", this.selectedVoiceName);
            select.value = this.selectedVoiceName;
        }
    },

    bindEvents() {
        // STT Click Event
        const micBtn = document.getElementById("mic-btn");
        if (micBtn) {
            micBtn.addEventListener("click", (e) => {
                e.preventDefault();
                if (this.isListening) {
                    this.recognition.stop();
                } else {
                    if (this.recognition) {
                        this.recognition.start();
                    }
                }
            });
        }

        // Voice Select Change
        const voiceSelect = document.getElementById("settings-voice-select");
        if (voiceSelect) {
            voiceSelect.addEventListener("change", (e) => {
                this.selectedVoiceName = e.target.value;
                localStorage.setItem("aetheris_speech_voice", this.selectedVoiceName);
            });
        }

        // TTS Engine Select Change
        const engineSelect = document.getElementById("settings-tts-engine");
        if (engineSelect) {
            engineSelect.addEventListener("change", (e) => {
                this.engine = e.target.value;
                localStorage.setItem("aetheris_tts_engine", this.engine);
                this.toggleEngineOptions(this.engine);
            });
        }

        // Sarvam Language Change
        const sarvamLangSelect = document.getElementById("settings-sarvam-lang");
        if (sarvamLangSelect) {
            sarvamLangSelect.addEventListener("change", (e) => {
                this.sarvamLang = e.target.value;
                localStorage.setItem("aetheris_sarvam_lang", this.sarvamLang);
            });
        }

        // Sarvam Gender Change
        const sarvamGenderSelect = document.getElementById("settings-sarvam-gender");
        if (sarvamGenderSelect) {
            sarvamGenderSelect.addEventListener("change", (e) => {
                this.sarvamGender = e.target.value;
                localStorage.setItem("aetheris_sarvam_gender", this.sarvamGender);
            });
        }

        // Sarvam Client Key Change
        const sarvamKeyInput = document.getElementById("settings-sarvam-api-key");
        if (sarvamKeyInput) {
            sarvamKeyInput.addEventListener("input", (e) => {
                this.sarvamApiKey = e.target.value.trim();
                localStorage.setItem("aetheris_sarvam_api_key", this.sarvamApiKey);
            });
        }

        // Speech Rate Slider
        const rateSlider = document.getElementById("settings-speech-rate");
        if (rateSlider) {
            rateSlider.addEventListener("input", (e) => {
                this.speechRate = parseFloat(e.target.value);
                document.getElementById("rate-val").innerText = this.speechRate + "x";
                localStorage.setItem("aetheris_speech_rate", this.speechRate);
                
                // Update active audio player rate dynamically
                if (this.audioPlayer) {
                    this.audioPlayer.playbackRate = this.speechRate;
                }
            });
        }

        // Auto read Checkbox
        const autoReadCheck = document.getElementById("settings-auto-read");
        if (autoReadCheck) {
            autoReadCheck.addEventListener("change", (e) => {
                this.autoRead = e.target.checked;
                localStorage.setItem("aetheris_auto_read", this.autoRead);
                this.updateVoiceToggleUI();
            });
        }

        // Voice speak shortcut button toggle
        const voiceToggle = document.getElementById("voice-speak-toggle");
        if (voiceToggle) {
            voiceToggle.addEventListener("click", (e) => {
                e.preventDefault();
                this.autoRead = !this.autoRead;
                localStorage.setItem("aetheris_auto_read", this.autoRead);
                
                // Sync settings checkbox
                if (autoReadCheck) {
                    autoReadCheck.checked = this.autoRead;
                }
                
                this.updateVoiceToggleUI();
            });
        }
    },

    stopListening() {
        this.isListening = false;
        const micBtn = document.getElementById("mic-btn");
        if (micBtn) {
            micBtn.classList.remove("active");
            micBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
            document.getElementById("chat-textarea").placeholder = "Send a message, ask about files...";
        }
    },

    // --- TTS Synthesis Methods ---

    async speak(text, btn = null) {
        // Cancel current playing speech
        this.stopSpeaking();

        if (!text) return;

        // Clean markdown structures from text for cleaner speech readout
        const cleanedText = text
            .replace(/[\#\*\_`\~\[\]\(\)\-\+\d\.]/g, "")
            .replace(/```[\s\S]*?```/g, "[Code segment omitted]");

        if (this.engine === "sarvam") {
            try {
                this.isPlaying = true;
                if (btn) {
                    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Generating...';
                    btn.disabled = true;
                }

                const token = Auth.getToken();
                const response = await fetch("/api/voice/tts", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Content-Type": "application/json",
                        "X-Sarvam-Key": this.sarvamApiKey || ""
                    },
                    body: JSON.stringify({
                        text: cleanedText,
                        language: this.sarvamLang,
                        gender: this.sarvamGender
                    })
                });

                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.detail || "Sarvam AI TTS API request failed.");
                }

                const audioBlob = await response.blob();
                const audioUrl = URL.createObjectURL(audioBlob);
                this.audioPlayer = new Audio(audioUrl);
                
                // Adjust speed based on the slider
                this.audioPlayer.playbackRate = this.speechRate;

                this.audioPlayer.onended = () => {
                    this.isPlaying = false;
                    if (btn) {
                        btn.innerHTML = '<i class="fa-solid fa-volume-high"></i> Read';
                        btn.disabled = false;
                    }
                };

                this.audioPlayer.onerror = (e) => {
                    console.error("Audio playback error:", e);
                    this.isPlaying = false;
                    if (btn) {
                        btn.innerHTML = '<i class="fa-solid fa-volume-high"></i> Read';
                        btn.disabled = false;
                    }
                };

                if (btn) {
                    btn.innerHTML = '<i class="fa-solid fa-circle-stop"></i> Stop';
                    btn.disabled = false;
                }

                await this.audioPlayer.play();
            } catch (err) {
                console.error("Sarvam AI TTS Error:", err);
                alert("Sarvam AI TTS Error: " + err.message);
                this.isPlaying = false;
                if (btn) {
                    btn.innerHTML = '<i class="fa-solid fa-volume-high"></i> Read';
                    btn.disabled = false;
                }
            }
        } else {
            if (!this.synthesis) return;

            const utterance = new SpeechSynthesisUtterance(cleanedText);
            this.activeUtterance = utterance; // Keep reference to prevent GC

            if (btn) {
                btn.innerHTML = '<i class="fa-solid fa-circle-stop"></i> Stop';
            }

            // Find selected voice
            const voice = this.voices.find(v => v.name === this.selectedVoiceName);
            if (voice) {
                utterance.voice = voice;
            }

            utterance.rate = this.speechRate;

            utterance.onstart = () => {
                this.isPlaying = true;
            };

            utterance.onend = () => {
                this.isPlaying = false;
                if (btn) {
                    btn.innerHTML = '<i class="fa-solid fa-volume-high"></i> Read';
                }
            };

            utterance.onerror = (e) => {
                console.error("Speech Synthesis Error:", e);
                this.isPlaying = false;
                if (btn) {
                    btn.innerHTML = '<i class="fa-solid fa-volume-high"></i> Read';
                }
            };

            this.synthesis.speak(utterance);
        }
    },

    pauseSpeaking() {
        if (this.engine === "sarvam") {
            if (this.audioPlayer && !this.audioPlayer.paused) {
                this.audioPlayer.pause();
            }
        } else {
            if (this.synthesis && this.synthesis.speaking && !this.synthesis.paused) {
                this.synthesis.pause();
            }
        }
    },

    resumeSpeaking() {
        if (this.engine === "sarvam") {
            if (this.audioPlayer && this.audioPlayer.paused) {
                this.audioPlayer.play();
            }
        } else {
            if (this.synthesis && this.synthesis.paused) {
                this.synthesis.resume();
            }
        }
    },

    stopSpeaking() {
        if (this.audioPlayer) {
            this.audioPlayer.pause();
            this.audioPlayer = null;
        }
        if (this.synthesis) {
            this.synthesis.cancel();
        }
        this.isPlaying = false;
    }
};

document.addEventListener("DOMContentLoaded", () => {
    Voice.init();
});
