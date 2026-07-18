// Aetheris dynamic production backend configuration
// When deploying to production, replace empty string with your Railway deployment URL (e.g. "https://chatbot-production.up.railway.app")
window.API_BASE_URL = "";

// Dynamic fetch interceptor to prepend backend URL automatically for all backend API routes
(function() {
    const originalFetch = window.fetch;
    window.fetch = function(input, init) {
        if (typeof input === "string" && input.startsWith("/api/")) {
            const base = window.API_BASE_URL || "";
            // Ensure no trailing slash on base, and no leading slash conflict
            const sanitizedBase = base.endsWith("/") ? base.slice(0, -1) : base;
            input = sanitizedBase + input;
        }
        return originalFetch(input, init);
    };
})();
