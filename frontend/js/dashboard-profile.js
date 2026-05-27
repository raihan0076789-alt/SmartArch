// dashboard-profile.js — Profile picture upload & sync for SmartArch
// Works alongside existing auth.js / dashboard.js without touching them.

// ── Profile Picture IDs present in dashboard.html ──────────────
const AVATAR_IDS = ['sidebarAvatar', 'headerAvatar', 'settingsProfilePic', 'overviewProfilePic'];

// Returns a per-user storage key so each user's avatar is stored independently.
function getAvatarStorageKey() {
    try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const uid = user.id || user._id || 'guest';
        return 'user_avatar_' + uid;
    } catch (e) {
        return 'user_avatar_guest';
    }
}

// ── On load: restore saved profile picture ─────────────────────
document.addEventListener('DOMContentLoaded', function () {
    restoreProfilePicture();
    initSettingsNav();
    loadPreferences();
    populateProfileOverview();
    
});

// ── Restore profile picture from localStorage ──────────────────
function restoreProfilePicture() {
    const STORAGE_KEY = getAvatarStorageKey();
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        setAllAvatars(saved);
    } else {
        // Fall back to user data from backend (avatar field only — no generated fallback)
        const userStr = localStorage.getItem('user');
        if (userStr) {
            try {
                const user = JSON.parse(userStr);
                if (user.avatar) {
                    setAllAvatars(user.avatar);
                }
                // No avatar at all → leave the default initials/placeholder shown by HTML
            } catch (e) { /* ignore */ }
        }
    }
}

function setAllAvatars(src) {
    AVATAR_IDS.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.src = src;
    });
}

// ── Handle file upload ─────────────────────────────────────────
function handleProfilePicUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validate type
    if (!file.type.startsWith('image/')) {
        showToast('Please select a valid image file.', 'error');
        return;
    }

    // Validate size (5MB)
    if (file.size > 5 * 1024 * 1024) {
        showToast('Image must be less than 5MB.', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        const dataUrl = e.target.result;
        const STORAGE_KEY = getAvatarStorageKey();

        // Save to localStorage under per-user key
        localStorage.setItem(STORAGE_KEY, dataUrl);

        // Update all avatar elements
        setAllAvatars(dataUrl);

        // Persist in user object stored in localStorage
        const userStr = localStorage.getItem('user');
        if (userStr) {
            try {
                const user = JSON.parse(userStr);
                user.avatar = dataUrl;
                localStorage.setItem('user', JSON.stringify(user));
            } catch (e) { /* ignore */ }
        }

        // Push to backend (fire-and-forget — doesn't break anything if it fails)
        pushAvatarToBackend(dataUrl);

        showToast('Profile picture updated!', 'success');
    };
    reader.readAsDataURL(file);

    // Reset input so same file can be re-selected
    event.target.value = '';
}

// ── Remove profile picture ─────────────────────────────────────
function removeProfilePic() {
    const STORAGE_KEY = getAvatarStorageKey();
    localStorage.removeItem(STORAGE_KEY);

    const userStr = localStorage.getItem('user');
    if (userStr) {
        try {
            const user = JSON.parse(userStr);
            user.avatar = '';
            localStorage.setItem('user', JSON.stringify(user));
        } catch (e) { /* ignore */ }
    }

    // Clear src on all avatar elements — the HTML/CSS initials placeholder will show instead
    AVATAR_IDS.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.src = '';
    });
    showToast('Profile picture removed.', 'info');
}

// ── Push avatar to backend (non-blocking) ─────────────────────
async function pushAvatarToBackend(avatarDataUrl) {
    try {
        const token = localStorage.getItem('token');
        if (!token) return;
        await fetch('https://smartarch-backend.onrender.com/api/architect/profile', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ avatar: avatarDataUrl })
        });
    } catch (e) {
        // Silent fail — local storage is the source of truth
    }
}


// ── Profile sub-tab switching (Overview / Edit Profile) ────────
function switchProfileTab(tabName, clickedBtn) {
    // Update tab button states
    document.querySelectorAll('.profile-tab').forEach(btn => btn.classList.remove('active'));
    clickedBtn.classList.add('active');

    // Show matching content panel
    document.querySelectorAll('.profile-content').forEach(panel => panel.classList.remove('active'));
    const target = document.getElementById('profile-tab-' + tabName);
    if (target) target.classList.add('active');

    // Populate overview data on switch
    if (tabName === 'overview') populateProfileOverview();
}

// ── Populate Overview tab with current user data ───────────────
function populateProfileOverview() {
    try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const el = id => document.getElementById(id);

        // Basic fields (unchanged)
        if (el('overviewName'))    el('overviewName').textContent    = user.name    || '—';
        if (el('overviewEmail'))   el('overviewEmail').textContent   = user.email   || '—';
        if (el('overviewPhone'))   el('overviewPhone').textContent   = user.phone   || '—';
        if (el('overviewCompany')) el('overviewCompany').textContent = user.company || '—';

        // New architect fields
        if (el('overviewBio'))            el('overviewBio').textContent            = user.bio            || '—';
        if (el('overviewLocation'))       el('overviewLocation').textContent       = user.location       || '—';
        if (el('overviewSpecialization')) el('overviewSpecialization').textContent = user.specialization || '—';
        if (el('overviewExperience'))     el('overviewExperience').textContent     = user.experience != null ? `${user.experience} yr${user.experience === 1 ? '' : 's'}` : '—';
        if (el('overviewRating'))         el('overviewRating').textContent         = user.rating ? `${Number(user.rating).toFixed(1)} / 5` : '—';

        // Total Projects: prefer live count from dashboard.js projects array, then from user object
        if (el('overviewTotalProjects')) {
            const liveCount = (window.projects && Array.isArray(window.projects)) ? window.projects.length : null;
            el('overviewTotalProjects').textContent = liveCount != null ? liveCount : (user.totalProjects || 0);
        }

        // Portfolio links
        const portfolioContainer = el('overviewPortfolio');
        if (portfolioContainer) {
            const urls = Array.isArray(user.portfolio) && user.portfolio.length > 0 ? user.portfolio : [];
            if (urls.length === 0) {
                portfolioContainer.innerHTML = '<span style="color:var(--muted,#64748b)">No portfolio links yet.</span>';
            } else {
                portfolioContainer.innerHTML = urls.map(u =>
                    `<a href="${u}" target="_blank" rel="noopener noreferrer"
                        style="display:block;color:var(--cyan,#00d4c8);font-size:0.82rem;
                               text-overflow:ellipsis;overflow:hidden;white-space:nowrap;margin-bottom:4px;"
                        title="${u}">${u}</a>`
                ).join('');
            }
        }

        // Avatar
        const STORAGE_KEY = getAvatarStorageKey();
        const saved = localStorage.getItem(STORAGE_KEY);
        const src = saved || user.avatar || '';
        if (el('overviewProfilePic')) el('overviewProfilePic').src = src;
    } catch (e) { /* ignore */ }
}

// ── Settings sub-navigation ────────────────────────────────────
function initSettingsNav() {
    document.querySelectorAll('.settings-nav-item').forEach(btn => {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.settings-nav-item').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            const panel = this.dataset.panel;
            document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
            const el = document.getElementById('panel-' + panel);
            if (el) el.classList.add('active');
        });
    });
}

// ── Settings navigation helper (from header avatar click) ──────
function switchToSettings() {
    // Click the settings nav item in sidebar
    const btn = document.querySelector('[data-section="settings"]');
    if (btn) btn.click();
}

// ── Save preferences to localStorage ──────────────────────────
function savePreference(key, value) {
    const prefs = JSON.parse(localStorage.getItem('user_prefs') || '{}');
    prefs[key] = value;
    localStorage.setItem('user_prefs', JSON.stringify(prefs));
    showToast('Preference saved.', 'success');
}

// ── Load and apply preferences ─────────────────────────────────
function loadPreferences() {
    const prefs = JSON.parse(localStorage.getItem('user_prefs') || '{}');
    const el = id => document.getElementById(id);

    if (el('autoSaveToggle'))   el('autoSaveToggle').checked   = prefs.autoSave   !== false;
    if (el('emailNotifToggle')) el('emailNotifToggle').checked  = prefs.emailNotif === true;
    if (el('defaultViewToggle'))el('defaultViewToggle').checked = prefs.defaultView === true;
    if (el('defaultUnit') && prefs.unit) el('defaultUnit').value = prefs.unit;
}

// ── Change password helper ─────────────────────────────────────
async function updatePassword(event) {
    event.preventDefault();
    const current = document.getElementById('currentPassword').value;
    const next    = document.getElementById('newPassword').value;
    const confirm = document.getElementById('confirmPassword').value;

    if (!current || !next || !confirm) {
        showToast('Please fill in all password fields.', 'error');
        return;
    }
    if (next !== confirm) {
        showToast('New passwords do not match.', 'error');
        return;
    }
    if (next.length < 8) {
        showToast('New password must be at least 8 characters.', 'error');
        return;
    }

    try {
        showLoading('Updating password...');
        const token = localStorage.getItem('token');
        const res = await fetch('https://smartarch-backend.onrender.com/api/auth/password', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ currentPassword: current, newPassword: next })
        });
        const data = await res.json();
        hideLoading();
        if (!res.ok) throw new Error(data.message || 'Failed to update password');
        if (data.token) {
            localStorage.setItem('token', data.token);
            if (window.api) window.api.setToken(data.token);
        }
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value     = '';
        document.getElementById('confirmPassword').value = '';
        showToast('Password updated successfully!', 'success');
    } catch (err) {
        hideLoading();
        showToast(err.message || 'Failed to update password', 'error');
    }
}

// ── Unified Save — collects all sections and fires two API calls ──
async function saveAllProfileChanges(event) {
    event.preventDefault();

    // Basic validation
    const phone = (document.getElementById('profilePhone')?.value || '').trim();
    if (phone && !/^(\+91[\-\s]?)?[6-9]\d{9}$/.test(phone)) {
        showToast('Enter a valid Indian mobile number.', 'error');
        return;
    }

    // Collect portfolio URLs
    const portfolioInputs = document.querySelectorAll('.portfolio-link-input');
    const portfolio = Array.from(portfolioInputs).map(i => i.value.trim()).filter(Boolean);
    const invalidUrls = portfolio.filter(u => { try { new URL(u); return false; } catch { return true; } });
    if (invalidUrls.length) {
        showToast('Please enter valid portfolio URLs (include https://).', 'error');
        return;
    }

    const val = id => (document.getElementById(id)?.value || '').trim();
    const expRaw = val('profileExperience');

    const payload = {
        // Personal
        name:           val('profileName'),
        email:          val('profileEmail'),
        company:        val('profileCompany'),
        phone:          phone,
        // Professional
        location:       val('profileLocation'),
        specialization: val('profileSpecialization'),
        experience:     expRaw !== '' ? parseInt(expRaw, 10) : null,
        bio:            val('profileBio'),
        // Portfolio
        portfolio:      portfolio,
    };

    try {
        // Show loading state on button
        const btn = document.getElementById('epSaveBtn');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…'; }

        showLoading('Saving profile…');
        const token = localStorage.getItem('token');
        const res = await fetch('https://smartarch-backend.onrender.com/api/architect/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        hideLoading();

        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check"></i> Save Changes'; }

        if (!res.ok) throw new Error(data.message || 'Update failed');

        // Re-sync localStorage from backend
        if (typeof loadUserProfile === 'function') await loadUserProfile();
        if (typeof loadUserInfo    === 'function') loadUserInfo();

        showToast('Profile saved!', 'success');
        switchToOverviewTab();
    } catch (err) {
        hideLoading();
        const btn = document.getElementById('epSaveBtn');
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check"></i> Save Changes'; }
        showToast(err.message || 'Failed to save profile', 'error');
    }
}

// ── Discard — reload data from localStorage/backend ──────────
function discardProfileChanges() {
    if (typeof loadUserProfile === 'function') loadUserProfile();
    switchToOverviewTab();
}

window.saveAllProfileChanges  = saveAllProfileChanges;
window.discardProfileChanges  = discardProfileChanges;

window.handleProfilePicUpload = handleProfilePicUpload;
window.switchProfileTab       = switchProfileTab;

// ── Switch to Overview tab programmatically (no click element needed) ──
function switchToOverviewTab() {
    const overviewBtn = document.querySelector('[data-profile-tab="overview"]');
    if (overviewBtn) {
        switchProfileTab('overview', overviewBtn);
        // Smooth scroll to top of profile area
        const panel = document.getElementById('profile-tab-overview');
        if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}
window.switchToOverviewTab = switchToOverviewTab;
window.populateProfileOverview = populateProfileOverview;
window.removeProfilePic       = removeProfilePic;
window.switchToSettings       = switchToSettings;
window.savePreference         = savePreference;
window.updatePassword         = updatePassword;

// ── Load professional info into edit form ──────────────────────
function loadProfessionalInfoForm() {
    try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const el = id => document.getElementById(id);
        if (el('profileLocation'))       el('profileLocation').value       = user.location       || '';
        if (el('profileSpecialization')) el('profileSpecialization').value = user.specialization || '';
        if (el('profileExperience'))     el('profileExperience').value     = user.experience != null ? user.experience : '';
        if (el('profileBio'))            el('profileBio').value            = user.bio            || '';
        renderPortfolioLinks(Array.isArray(user.portfolio) ? user.portfolio : []);
    } catch (e) { /* ignore */ }
}

// ── Save Professional Info ─────────────────────────────────────
async function updateProfessionalInfo(event) {
    event.preventDefault();
    const val = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
    const expRaw = val('profileExperience');
    const payload = {
        location:       val('profileLocation'),
        specialization: val('profileSpecialization'),
        experience:     expRaw !== '' ? parseInt(expRaw, 10) : null,
        bio:            val('profileBio')
    };
    try {
        showLoading('Saving professional info…');
        const token = localStorage.getItem('token');
        const res = await fetch('https://smartarch-backend.onrender.com/api/architect/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        hideLoading();
        if (!res.ok) throw new Error(data.message || 'Update failed');
        // Re-fetch full profile from backend to keep localStorage in sync
        if (typeof loadUserProfile === 'function') await loadUserProfile();
        else {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            Object.assign(user, payload);
            localStorage.setItem('user', JSON.stringify(user));
            populateProfileOverview();
        }
        showToast('Professional info saved!', 'success');
        switchToOverviewTab();
    } catch (err) {
        hideLoading();
        showToast(err.message || 'Failed to save professional info', 'error');
    }
}

// ── Portfolio link UI helpers ──────────────────────────────────
function renderPortfolioLinks(urls) {
    const container = document.getElementById('portfolioLinksContainer');
    if (!container) return;
    if (urls.length === 0) urls = [''];
    container.innerHTML = urls.map((url, i) => `
        <div class="form-group" style="display:flex;gap:0.5rem;align-items:center;margin-bottom:0.6rem;" id="portfolio-row-${i}">
            <input type="url" class="form-control portfolio-link-input" value="${url}"
                   placeholder="https://your-portfolio.com" style="flex:1;">
            <button type="button" class="btn btn-ghost btn-sm" onclick="removePortfolioRow(${i})" title="Remove">
                <i class="fas fa-times"></i>
            </button>
        </div>`).join('');
}

function addPortfolioLink() {
    const inputs = document.querySelectorAll('.portfolio-link-input');
    if (inputs.length >= 10) { showToast('Maximum 10 portfolio links allowed.', 'error'); return; }
    const urls = Array.from(inputs).map(i => i.value.trim());
    urls.push('');
    renderPortfolioLinks(urls);
}

function removePortfolioRow(index) {
    const inputs = document.querySelectorAll('.portfolio-link-input');
    const urls = Array.from(inputs).map(i => i.value.trim()).filter((_, i) => i !== index);
    renderPortfolioLinks(urls.length ? urls : ['']);
}

async function savePortfolioLinks() {
    const inputs = document.querySelectorAll('.portfolio-link-input');
    const portfolio = Array.from(inputs).map(i => i.value.trim()).filter(Boolean);
    // Basic URL check
    const invalid = portfolio.filter(u => { try { new URL(u); return false; } catch { return true; } });
    if (invalid.length) { showToast('Please enter valid URLs (include https://).', 'error'); return; }
    try {
        showLoading('Saving portfolio…');
        const token = localStorage.getItem('token');
        const res = await fetch('https://smartarch-backend.onrender.com/api/architect/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ portfolio })
        });
        const data = await res.json();
        hideLoading();
        if (!res.ok) throw new Error(data.message || 'Update failed');
        // Re-fetch full profile from backend to keep localStorage in sync
        if (typeof loadUserProfile === 'function') await loadUserProfile();
        else {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            user.portfolio = portfolio;
            localStorage.setItem('user', JSON.stringify(user));
            populateProfileOverview();
        }
        showToast('Portfolio saved!', 'success');
        switchToOverviewTab();
    } catch (err) {
        hideLoading();
        showToast(err.message || 'Failed to save portfolio', 'error');
    }
}

window.updateProfessionalInfo = updateProfessionalInfo;
window.addPortfolioLink       = addPortfolioLink;
window.removePortfolioRow     = removePortfolioRow;
window.savePortfolioLinks     = savePortfolioLinks;
window.loadProfessionalInfoForm = loadProfessionalInfoForm;

// Auto-populate professional form when Edit Profile tab is shown
const _origSwitchProfileTab = window.switchProfileTab;
window.switchProfileTab = function(tabName, clickedBtn) {
    _origSwitchProfileTab(tabName, clickedBtn);
    if (tabName === 'edit') loadProfessionalInfoForm();
};

// Also load on initial DOMContentLoaded if edit tab is active
document.addEventListener('DOMContentLoaded', function() {
    loadProfessionalInfoForm();
});