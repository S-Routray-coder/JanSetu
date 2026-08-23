/**
 * JanSetu Frontend API Client
 * Connects frontend dashboard, reporting, and auth with the FastAPI backend.
 */

const API_BASE_URL = (typeof window !== "undefined" && window.location.origin && window.location.origin.startsWith("http"))
    ? `${window.location.origin}/api/v1`
    : "http://127.0.0.1:8000/api/v1";

const JanSetuAPI = {
    // Helper to get auth token
    getToken() {
        return localStorage.getItem("jansetu_token");
    },

    // Set auth token
    setToken(token) {
        localStorage.setItem("jansetu_token", token);
    },

    // Helper for authenticated fetch
    async fetchWithAuth(endpoint, options = {}) {
        const token = this.getToken();
        const headers = {
            "Content-Type": "application/json",
            ...(options.headers || {})
        };

        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        }

        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers
        });

        if (response.status === 401) {
            // Token expired or invalid
            console.warn("Session expired. Please log in again.");
        }

        return response;
    },

    // --- AUTHENTICATION ---
    async signup(fullName, email, password, role = "citizen", ward = "Ward 12") {
        const res = await fetch(`${API_BASE_URL}/auth/signup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ full_name: fullName, email, password, role, ward })
        });
        const data = await res.json();
        if (res.ok && data.access_token) {
            this.setToken(data.access_token);
        }
        return { ok: res.ok, status: res.status, data };
    },

    async login(email, password) {
        const res = await fetch(`${API_BASE_URL}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (res.ok && data.access_token) {
            this.setToken(data.access_token);
        }
        return { ok: res.ok, status: res.status, data };
    },

    async getProfile() {
        const res = await this.fetchWithAuth("/auth/me");
        return res.json();
    },

    // --- AI TRIAGE & PREVIEW ---
    async getAIPreview(description, language = "en") {
        const res = await fetch(`${API_BASE_URL}/triage/preview`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ description, language })
        });
        return res.json();
    },

    async checkDuplicates(description, latitude = null, longitude = null) {
        const res = await fetch(`${API_BASE_URL}/triage/check-duplicates`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ description, latitude, longitude })
        });
        return res.json();
    },

    // --- GRIEVANCES ---
    async submitGrievance(grievanceData) {
        const res = await this.fetchWithAuth("/grievances/", {
            method: "POST",
            body: JSON.stringify(grievanceData)
        });
        return { ok: res.ok, status: res.status, data: await res.json() };
    },

    async getGrievances(filters = {}) {
        const queryParams = new URLSearchParams(filters).toString();
        const res = await fetch(`${API_BASE_URL}/grievances/?${queryParams}`);
        return res.json();
    },

    async getMyGrievances() {
        const res = await this.fetchWithAuth("/grievances/my");
        return res.json();
    },

    async getGrievanceDetail(idOrTicket) {
        const cleanId = String(idOrTicket || "").replace(/^#+/, "").trim();
        const res = await fetch(`${API_BASE_URL}/grievances/${encodeURIComponent(cleanId)}`);
        return res.json();
    },

    async updateGrievanceStatus(id, updateData) {
        const res = await this.fetchWithAuth(`/grievances/${id}/status`, {
            method: "PATCH",
            body: JSON.stringify(updateData)
        });
        return res.json();
    },

    async supportGrievance(id) {
        const res = await this.fetchWithAuth(`/grievances/${id}/support`, {
            method: "POST"
        });
        return res.json();
    },

    // --- CITIZEN REVIEWS & EVIDENCE PROOF ---
    async submitGrievanceReview(grievanceId, reviewData) {
        const res = await this.fetchWithAuth(`/grievances/${grievanceId}/reviews`, {
            method: "POST",
            body: JSON.stringify(reviewData)
        });
        return res.json();
    },

    async getGrievanceReviews(grievanceId) {
        const res = await fetch(`${API_BASE_URL}/grievances/${grievanceId}/reviews`);
        return res.json();
    },

    async upvoteReviewHelpful(reviewId) {
        const res = await this.fetchWithAuth(`/grievances/reviews/${reviewId}/helpful`, {
            method: "POST"
        });
        return res.json();
    },

    async assignGrievanceContractor(grievanceId, assignData) {
        const res = await this.fetchWithAuth(`/grievances/${grievanceId}/assign`, {
            method: "POST",
            body: JSON.stringify(assignData)
        });
        return res.json();
    },

    // --- PARTICIPATORY BUDGETING ---
    async getBudgetProjects(ward = null) {
        const query = ward ? `?ward=${encodeURIComponent(ward)}` : "";
        const res = await this.fetchWithAuth(`/budget/projects${query}`);
        return res.json();
    },

    async voteOnProject(projectId, voteType = "support") {
        const res = await this.fetchWithAuth(`/budget/projects/${projectId}/vote`, {
            method: "POST",
            body: JSON.stringify({ vote_type: voteType })
        });
        return res.json();
    },

    async getBudgetSummary() {
        const res = await fetch(`${API_BASE_URL}/budget/summary`);
        return res.json();
    },

    // --- CIVIC MAP & GEO-INTELLIGENCE ---
    async getMapConfig() {
        try {
            const res = await fetch(`${API_BASE_URL}/map/config`);
            const data = await res.json();
            if (data && data.google_maps_api_key && typeof JanSetuMaps !== "undefined") {
                JanSetuMaps.apiKey = data.google_maps_api_key;
            }
            return data;
        } catch (e) {
            return { google_maps_api_key: "" };
        }
    },

    async getMapPoints(category = null) {
        const query = category ? `?category=${encodeURIComponent(category)}` : "";
        const res = await fetch(`${API_BASE_URL}/map/points${query}`);
        return res.json();
    },

    async getHotspots() {
        const res = await fetch(`${API_BASE_URL}/map/hotspots`);
        return res.json();
    },

    // --- ANALYTICS ---
    async getCitizenAnalytics() {
        const res = await this.fetchWithAuth("/analytics/citizen");
        return res.json();
    },

    async getOfficerAnalytics() {
        const res = await this.fetchWithAuth("/analytics/officer");
        return res.json();
    },

    // --- NOTIFICATIONS ---
    async getNotifications() {
        const res = await this.fetchWithAuth("/notifications/");
        return res.json();
    },

    async markNotificationRead(id) {
        const res = await this.fetchWithAuth(`/notifications/${id}/read`, {
            method: "PATCH"
        });
        return res.json();
    },

    // --- EVIDENCE & MEDIA ---
    async uploadEvidence(file, grievanceId = null, evidenceType = "report_proof") {
        const token = this.getToken();
        const formData = new FormData();
        formData.append("file", file);
        if (grievanceId) formData.append("grievance_id", grievanceId);
        formData.append("evidence_type", evidenceType);

        const headers = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch(`${API_BASE_URL}/evidence/upload`, {
            method: "POST",
            headers,
            body: formData
        });
        return { ok: res.ok, status: res.status, data: await res.json() };
    },

    async getEvidenceList(filters = {}) {
        const queryParams = new URLSearchParams(filters).toString();
        const res = await fetch(`${API_BASE_URL}/evidence/?${queryParams}`);
        return res.json();
    },

    async reviewEvidence(evidenceId, isVerified, notes = "") {
        const token = this.getToken();
        const formData = new FormData();
        formData.append("is_verified", isVerified ? "true" : "false");
        if (notes) formData.append("notes", notes);

        const headers = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch(`${API_BASE_URL}/evidence/${evidenceId}/review`, {
            method: "PATCH",
            headers,
            body: formData
        });
        return res.json();
    },

    // --- WARD COMMUNITY BULLETINS & ANNOUNCEMENTS ---
    async getWardBulletins(ward = null) {
        const query = ward ? `?ward=${encodeURIComponent(ward)}` : "";
        const res = await fetch(`${API_BASE_URL}/grievances/bulletin/list${query}`);
        return res.json();
    },

    async createWardBulletin(bulletinData) {
        const res = await this.fetchWithAuth("/grievances/bulletin/create", {
            method: "POST",
            body: JSON.stringify(bulletinData)
        });
        return res.json();
    },

    // --- AI MULTILINGUAL TRANSLATION & GEOCODING ---
    async translateText(text, targetLang = "hi") {
        try {
            const res = await fetch(`${API_BASE_URL}/triage/translate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text, target_lang: targetLang })
            });
            return res.json();
        } catch (e) {
            return { original_text: text, translated_text: text, target_lang: targetLang, language_name: "English" };
        }
    },

    async geocodeLocation(query, lat = null, lng = null) {
        try {
            const res = await fetch(`${API_BASE_URL}/triage/geocode`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query, latitude: lat, longitude: lng })
            });
            return res.json();
        } catch (e) {
            return { latitude: 20.2742, longitude: 85.8324, address: query, ward: "Ward 12" };
        }
    },

    // --- MULTILINGUAL VOICE SPEECH SYNTHESIS (HINDI, ODIA, BENGALI, TAMIL, TELUGU, MARATHI, ENGLISH) ---
    speakText(text, lang = "en", onStart = null, onEnd = null) {
        if (typeof window === "undefined" || !("speechSynthesis" in window)) {
            console.warn("Speech synthesis not supported in this browser.");
            return false;
        }

        try {
            window.speechSynthesis.cancel(); // stop previous speech
            if (window.speechSynthesis.paused) {
                window.speechSynthesis.resume();
            }

            const cleanText = String(text || "").replace(/[#*_`]/g, " ").trim();
            if (!cleanText) return false;

            const utterance = new SpeechSynthesisUtterance(cleanText);
            window._activeSpeechUtterance = utterance; // Prevent GC bug in Chrome/Safari

            const langMap = {
                "hi": "hi-IN",
                "or": "hi-IN", // phonetic Indian voice for Odia
                "bn": "bn-IN",
                "ta": "ta-IN",
                "te": "te-IN",
                "mr": "mr-IN",
                "gu": "gu-IN",
                "kn": "kn-IN",
                "en": "en-IN"
            };

            const targetLocale = langMap[lang] || "en-IN";
            utterance.lang = targetLocale;
            const rateMult = (typeof window !== "undefined" && window.currentVoicePlaybackRate) ? window.currentVoicePlaybackRate : 1.0;
            utterance.rate = Math.max(0.6, Math.min(2.0, rateMult * 0.95));
            utterance.pitch = 1.0;

            const voices = window.speechSynthesis.getVoices();
            if (voices && voices.length > 0) {
                let matchingVoice = voices.find(v => v.lang === targetLocale || v.lang.replace('_', '-').startsWith(targetLocale) || v.lang.startsWith(lang));
                if (!matchingVoice && lang !== "en") {
                    // Fallback to any Indian voice engine for natural phonetics
                    matchingVoice = voices.find(v => v.lang.includes("IN") || v.name.includes("India") || v.name.includes("Hindi") || v.name.includes("Bangla") || v.name.includes("Lekha") || v.name.includes("Rishi") || v.name.includes("Veena"));
                }
                if (matchingVoice) {
                    utterance.voice = matchingVoice;
                }
            }

            if (onStart) utterance.onstart = onStart;
            utterance.onend = (e) => {
                if (onEnd) onEnd(e);
                window._activeSpeechUtterance = null;
            };
            utterance.onerror = (e) => {
                console.warn("Speech synthesis error:", e);
                if (onEnd) onEnd(e);
                window._activeSpeechUtterance = null;
            };

            window.speechSynthesis.speak(utterance);
            return true;
        } catch (err) {
            console.warn("Speech synthesis execution error:", err);
            return false;
        }
    }
};

// Export to window for vanilla JS access
if (typeof window !== "undefined") {
    window.JanSetuAPI = JanSetuAPI;
}
