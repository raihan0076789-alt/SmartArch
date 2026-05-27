// frontend/js/api.js
// Main backend  (auth + projects) : port 5000
// AI backend   (layout + chat)   : port 3001

const API_BASE_URL    = 'https://smartarch-backend.onrender.com/api';
const AI_API_BASE_URL = 'http://localhost:3001/api/architecture';

// ─────────────────────────────────────────────
//  Main API class  (auth + projects + models)
// ─────────────────────────────────────────────
class API {
    constructor() {
        this.token = localStorage.getItem('token');
    }

    setToken(token) {
        this.token = token;
    }

    getHeaders() {
        const headers = { 'Content-Type': 'application/json' };
        if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
        return headers;
    }

    async request(endpoint, options = {}) {
        const url    = `${API_BASE_URL}${endpoint}`;
        const config = { ...options, headers: { ...this.getHeaders(), ...options.headers } };

        try {
            const response = await fetch(url, config);
            const data     = await response.json();
            if (!response.ok) {
                const err = new Error(data.message || 'Something went wrong');
                err.data  = data;
                err.requiresVerification = data.requiresVerification || false;
                throw err;
            }
            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    // ── Auth (unchanged) ──────────────────────────────────────────────────────
    async register(userData)              { return this.request('/auth/register', { method: 'POST', body: JSON.stringify(userData) }); }
    async login(credentials)             { return this.request('/auth/login',    { method: 'POST', body: JSON.stringify(credentials) }); }
    async googleAuth(credential)         { return this.request('/auth/google',   { method: 'POST', body: JSON.stringify({ credential }) }); }
    async googleProfile(profile)         { return this.request('/auth/google-profile', { method: 'POST', body: JSON.stringify(profile) }); }
    async forgotPassword(email)          { return this.request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }); }
    async resetPassword(token, password) { return this.request(`/auth/reset-password/${token}`, { method: 'PUT', body: JSON.stringify({ password }) }); }
    async verifyOtp(email, otp)          { return this.request('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ email, otp }) }); }
    async resendVerification(email)      { return this.request('/auth/resend-verification', { method: 'POST', body: JSON.stringify({ email }) }); }

    // ── Profile ───────────────────────────────────────────────────────────────
    // getProfile() routes to /architect/profile (richer response with pro fields).
    // Falls back to /auth/me so nothing breaks if architect route is unreachable.
    async getProfile() {
        try {
            return await this.request('/architect/profile');
        } catch (e) {
            return this.request('/auth/me');
        }
    }

    // updateProfile() — used by existing dashboard code.
    // Routes to /architect/profile (handles all fields including new ones).
    // Also mirrors to /auth/profile for backward-compat (avatar, name, phone, company).
    async updateProfile(profileData) {
        // Update architect profile (canonical)
        const result = await this.request('/architect/profile', {
            method: 'PUT',
            body:   JSON.stringify(profileData)
        });
        // Fire-and-forget mirror to legacy /auth/profile so any code still using
        // that endpoint sees up-to-date basic fields
        const { name, email, phone, company, preferences, avatar } = profileData;
        const basicData = { name, email, phone, company, preferences, avatar };
        this.request('/auth/profile', { method: 'PUT', body: JSON.stringify(basicData) }).catch(() => {});
        return result;
    }

    // Explicit architect profile methods (used by new architect-profile.js)
    async getArchitectProfile()          { return this.request('/architect/profile'); }
    async updateArchitectProfile(data)   { return this.request('/architect/profile', { method: 'PUT', body: JSON.stringify(data) }); }

    // ── Projects (unchanged) ──────────────────────────────────────────────────
    async getProjects(params = {}) {
        const qs = new URLSearchParams(params).toString();
        return this.request(`/projects${qs ? `?${qs}` : ''}`);
    }
    async getProject(id)                       { return this.request(`/projects/${id}`); }
    async createProject(projectData)           { return this.request('/projects', { method: 'POST', body: JSON.stringify(projectData) }); }
    async updateProject(id, projectData)       { return this.request(`/projects/${id}`, { method: 'PUT',  body: JSON.stringify(projectData) }); }
    async updateProjectStatus(id, status, clientFeedback) { return this.request(`/projects/${id}/status`, { method: 'PUT', body: JSON.stringify({ status, clientFeedback }) }); }
    async deleteProject(id)                    { return this.request(`/projects/${id}`, { method: 'DELETE' }); }
    async addCollaborator(projectId, data)     { return this.request(`/projects/${projectId}/collaborators`, { method: 'POST', body: JSON.stringify(data) }); }
    async getProjectVersions(projectId)        { return this.request(`/projects/${projectId}/versions`); }
    async restoreVersion(projectId, versionId) { return this.request(`/projects/${projectId}/versions/${versionId}/restore`, { method: 'POST' }); }

    // ── AI Feedback (unchanged) ───────────────────────────────────────────────
    async getAIFeedback(projectId)             { return this.request(`/projects/${projectId}/ai-feedback`); }
    async saveAIFeedback(projectId, feedback)  { return this.request(`/projects/${projectId}/ai-feedback`, { method: 'PUT', body: JSON.stringify({ feedback }) }); }

    // ── Reviews (unchanged) ───────────────────────────────────────────────────
    async getProjectReviews(projectId)                   { return this.request(`/reviews/${projectId}`); }
    async upsertReview(projectId, rating, comment = '')  { return this.request(`/reviews/${projectId}`, { method: 'POST', body: JSON.stringify({ rating, comment }) }); }
    async deleteReview(projectId)                        { return this.request(`/reviews/${projectId}`, { method: 'DELETE' }); }
    async getAdminReviewStats()                          { return this.request('/reviews/admin/stats'); }
    async adminDeleteReview(reviewId)                    { return this.request(`/reviews/admin/${reviewId}`, { method: 'DELETE' }); }

    // ── Subscriptions (unchanged) ─────────────────────────────────────────────
    async getSubscriptionStatus()            { return this.request('/subscriptions/status'); }
    async createSubscriptionOrder(plan)      { return this.request('/subscriptions/subscribe', { method: 'POST', body: JSON.stringify({ plan }) }); }
    async verifySubscriptionPayment(payload) { return this.request('/subscriptions/verify',   { method: 'POST', body: JSON.stringify(payload) }); }

    // ── Models (unchanged) ────────────────────────────────────────────────────
    async generateFloorPlan(projectId)        { return this.request(`/models/${projectId}/floorplan`, { method: 'POST' }); }
    async generate3DModel(projectId)          { return this.request(`/models/${projectId}/3d`,        { method: 'POST' }); }
    async getModelStats(projectId)            { return this.request(`/models/${projectId}/stats`); }

    async exportModel(projectId, format) {
        const url      = `${API_BASE_URL}/models/${projectId}/export/${format}`;
        const response = await fetch(url, { headers: this.getHeaders() });
        if (!response.ok) throw new Error('Export failed');
        const blob        = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a           = document.createElement('a');
        a.href            = downloadUrl;
        a.download        = `house-model.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(downloadUrl);
    }
}

// ─────────────────────────────────────────────
//  AI Architecture API  (port 3001)
// ─────────────────────────────────────────────
class ArchitectureAPI {
    async generateFloorplan(params) {
        const response = await fetch(`${AI_API_BASE_URL}/floorplan/generate`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Floorplan generation failed');
        return data;
    }

    async uploadFloorplanImage(file, scaleFactor = 20) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('scaleFactor', String(scaleFactor));
        const response = await fetch(`${AI_API_BASE_URL}/floorplan/upload-image`, { method: 'POST', body: formData });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Image upload failed');
        return data;
    }

    async chat(message) {
        const response = await fetch(`${AI_API_BASE_URL}/chat`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Chat request failed');
        return data;
    }

    async requestAIFeedback(projectData) {
        const token    = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/ai/feedback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
            body: JSON.stringify({ projectData }),
        });
        const data = await response.json();
        if (!response.ok) { const err = new Error(data.message || 'Feedback request failed'); err.data = data; throw err; }
        return data;
    }
}

// ── Singletons ────────────────────────────────────────────────────────────────
const api             = new API();
const architectureAPI = new ArchitectureAPI();
window.api            = api;
window.architectureAPI = architectureAPI;

// ── UI utilities (unchanged) ──────────────────────────────────────────────────
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast     = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
        <span>${message}</span>
    `;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity   = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function showLoading(message = 'Loading...') {
    let overlay = document.getElementById('loadingOverlay');
    if (!overlay) {
        overlay           = document.createElement('div');
        overlay.id        = 'loadingOverlay';
        overlay.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;color:white;font-size:1.2rem;flex-direction:column;gap:1rem;`;
        overlay.innerHTML = `<i class="fas fa-spinner fa-spin fa-2x"></i><span id="loadingMsg">${message}</span>`;
        document.body.appendChild(overlay);
    } else {
        document.getElementById('loadingMsg').textContent = message;
        overlay.style.display = 'flex';
    }
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.style.display = 'none';
}

window.showToast   = showToast;
window.showLoading = showLoading;
window.hideLoading = hideLoading;