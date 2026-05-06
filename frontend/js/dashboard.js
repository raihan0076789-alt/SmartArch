// frontend/js/dashboard.js
// Original logic preserved; chart hooks + profile picture loading added.
let projects = [];
let currentFilter = 'all';
let deleteProjectId = null;
// Password validation refs
let newPasswordEl, confirmPasswordEl;

document.addEventListener('DOMContentLoaded', function () {

    if (!requireAuth()) return;

    loadUserInfo();
    loadProjects();
    setupNavigation();

    // Fetch full profile from backend on every page load so localStorage
    // always has the latest architect fields (bio, location, etc.)
    loadUserProfile();

    // ── Heartbeat presence ────────────────────────────────────────────────────
    if (typeof startHeartbeat === 'function') {
        startHeartbeat({
            apiBase:  'http://localhost:5000/api',
            getToken: () => localStorage.getItem('token')
        });
    }

    // Pre-fetch connections on load so the badge count is accurate immediately
    if (typeof loadArchConnections === 'function') loadArchConnections();

    // Init architect dashboard home section
    initArchDashboard();

    // open section from URL
    setTimeout(() => {
        openSectionFromURL();
    }, 200);

});

function loadUserInfo() {
    const userStr = localStorage.getItem('user');
    if (userStr) {
        const user = JSON.parse(userStr);
        const el = document.getElementById('userName');
        if (el) el.textContent = user.name;

        // Determine avatar: check per-user localStorage key first (same key used by dashboard-profile.js),
        // then fall back to user.avatar, then ui-avatars
        const uid = user.id || user._id || 'guest';
        const savedPic = localStorage.getItem('user_avatar_' + uid);
        const avatarSrc = savedPic || user.avatar ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=00d4c8&color=060a12&bold=true&size=128`;

        ['sidebarAvatar', 'headerAvatar'].forEach(id => {
            const avatarEl = document.getElementById(id);
            if (avatarEl) avatarEl.src = avatarSrc;
        });
    }
}

// ── Architect Dashboard Home Section ─────────────────────────────────────────
function initArchDashboard() {
    // Set greeting based on time of day
    const greetingEl = document.getElementById('archDbGreeting');
    if (greetingEl) {
        const hour = new Date().getHours();
        greetingEl.textContent = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    }

    // Set first name
    const firstNameEl = document.getElementById('archDbFirstName');
    if (firstNameEl) {
        try {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            const firstName = (user.name || 'Architect').split(' ')[0];
            firstNameEl.textContent = firstName;
        } catch (e) {}
    }

    // Populate stat cards from projects data (re-runs after projects load)
    populateArchDashStats();

    // Re-populate once projects are fully loaded (projects load is async)
    const _origRender = window.renderProjects;
    if (typeof _origRender === 'function') {
        window.renderProjects = function () {
            _origRender.apply(this, arguments);
            populateArchDashStats();
        };
    }
}

function populateArchDashStats() {
    // Total projects
    const total = (window.projects || []).length;
    const valEl = document.getElementById('archDbStatProjects');
    if (valEl) valEl.textContent = total || '—';

    // Approved designs
    const approved = (window.projects || []).filter(p => p.status === 'approved').length;
    const appEl = document.getElementById('archDbStatApproved');
    if (appEl) appEl.textContent = approved || '0';

    // Portfolio value (sum of estimatedCost across projects)
    const totalVal = (window.projects || []).reduce((sum, p) => sum + (p.estimatedCost || 0), 0);
    const portEl = document.getElementById('archDbStatValue');
    if (portEl) portEl.textContent = totalVal > 0 ? '$' + totalVal.toLocaleString() : '—';

    // Client requests — try reading from connection badge count
    const badge = document.getElementById('archConnBadge');
    const clientEl = document.getElementById('archDbStatClients');
    if (clientEl && badge && badge.textContent) {
        clientEl.textContent = badge.textContent;
    } else if (clientEl && clientEl.textContent === '—') {
        // Will be updated when connections load; start at 0
        clientEl.textContent = '0';
    }
}

// Expose so loadArchConnections can update our badge after it resolves
const _origLoadArchConn = window.loadArchConnections;
if (typeof _origLoadArchConn === 'function') {
    window.loadArchConnections = async function () {
        const result = await _origLoadArchConn.apply(this, arguments);
        // After connections load, refresh the client count card
        setTimeout(populateArchDashStats, 300);
        return result;
    };
}

// Handle URL hash navigation (e.g. dashboard.html#messagesSection)
function openSectionFromURL() {
    const hash = window.location.hash;
    if (!hash) return;

    const sectionMap = {
        '#dashboardSection':    'dashboard',
        '#projectsSection':     'projects',
        '#templatesSection':    'templates',
        '#analyticsSection':    'analytics',
        '#settingsSection':     'settings',
        '#messagesSection':     'messages',
        '#connectionsSection':  'connections',
    };

    // Find matching section key
    const sectionKey = Object.keys(sectionMap).find(k => hash.startsWith(k));
    if (!sectionKey) return;

    const section = sectionMap[sectionKey];

    // Activate via nav click simulation
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(b => b.classList.remove('active'));

    const secEl = document.getElementById(`${section}Section`);
    if (secEl) secEl.classList.add('active');

    const navBtn = document.querySelector(`[data-section="${section}"]`);
    if (navBtn) navBtn.classList.add('active');

    // Update header title
    const headerTitles = { dashboard:'Dashboard', projects:'My Projects', templates:'Project Templates', analytics:'Analytics', settings:'Settings', messages:'My Messages', connections:'Client Requests' };
    const headerEl = document.getElementById('headerTitle');
    if (headerEl) headerEl.textContent = headerTitles[section] || section;

    const actionBtn = document.getElementById('headerActionBtn');
    if (actionBtn) actionBtn.style.display = (section === 'projects') ? '' : 'none';

    // Trigger data load
    if (section === 'messages') loadUserTickets();
    if (section === 'analytics') { if (typeof updateAnalytics === 'function') updateAnalytics(); }
    if (section === 'settings') { if (typeof loadUserProfile === 'function') loadUserProfile(); }
    if (section === 'connections') { if (typeof loadArchConnections === 'function') loadArchConnections(); }
}

function setupNavigation() {
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
        item.addEventListener('click', function (e) {
            e.preventDefault();
            const section = this.dataset.section;
            document.querySelectorAll('.sidebar-nav .nav-item').forEach(nav => nav.classList.remove('active'));
            this.classList.add('active');
            document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));
            const secEl = document.getElementById(`${section}Section`);
            if (secEl) secEl.classList.add('active');

            const headers = {
                dashboard:    'Dashboard',
                projects:     'My Projects',
                templates:    'Project Templates',
                analytics:    'Analytics',
                settings:     'Settings',
                messages:     'My Messages',
                Guide:        'How to Use',
                measurement: 'Measurement Tools',
                subscription: 'Subscription',
                connections:  'Client Requests'
            };
            const headerEl = document.getElementById('headerTitle');
            if (headerEl) headerEl.textContent = headers[section] || section;

            // Show/hide New Project button
            const actionBtn = document.getElementById('headerActionBtn');
            if (actionBtn) actionBtn.style.display = (section === 'projects') ? '' : 'none';


            if (section === 'analytics') {
                updateAnalytics();
                // Small delay to let section become visible before drawing charts
                setTimeout(() => { if (typeof refreshCharts === 'function') refreshCharts(); }, 60);
            }
           if (section === 'settings') {
                loadUserProfile();

                // 🔥 ADD THIS (with delay)
                setTimeout(() => {
                    initPasswordValidation();
                }, 100);
            }
            if (section === 'messages') {
                loadUserTickets();
            }
            if (section === 'subscription') {
                if (typeof loadSubscriptionStatus === 'function') loadSubscriptionStatus();
            }
            if (section === 'connections') {
                if (typeof loadArchConnections === 'function') loadArchConnections();
            }
        });
    });
}

async function loadProjects() {
    try {
        showLoading('Loading projects...');
        const data = await api.getProjects({ limit: 50 });
        projects = data.data;
        window.projects = projects; // expose for charts
        renderProjects();
        updateAnalytics();
        hideLoading();
        // Silently fetch AI scores in the background — does not block render
        fetchAllAIScores();
        // Silently fetch review ratings in the background
        fetchAllRatings();
    } catch (error) {
        hideLoading();
        showToast('Failed to load projects', 'error');
    }
}

// Fetch AI feedback scores for all projects in the background.
// When a score arrives it patches the in-memory project object and
// updates only that card's strip — no full re-render, no flicker.
async function fetchAllAIScores() {
    if (!projects || projects.length === 0) return;
    const token = localStorage.getItem('token');
    if (!token) return;

    for (const project of projects) {
        if (project._aiFeedbackLoaded) continue;
        try {
            const res = await fetch('http://localhost:5000/api/projects/' + project._id + '/ai-feedback', {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (!res.ok) continue;
            const data = await res.json();
            project.aiFeedback = (data && data.aiFeedback) ? data.aiFeedback : null;
            project._aiFeedbackLoaded = true;
            patchScoreStrip(project);
        } catch (e) {
            // Non-fatal — card stays "Not analysed"
        }
    }
}

// Replace the score strip HTML for a single card already in the DOM
function patchScoreStrip(project) {
    const card = document.querySelector('.project-card[data-project-id="' + project._id + '"]');
    if (!card) return;
    const strip = card.querySelector('.ai-score-strip');
    if (!strip) return;
    const newStrip = document.createElement('div');
    newStrip.innerHTML = aiScoreStripHtml(project);
    const newEl = newStrip.firstElementChild;
    if (newEl) strip.replaceWith(newEl);
}

// ── Rating badge helpers ──────────────────────────────────────────
function ratingBadgeHtml(project) {
    if (!project._ratingsLoaded) return '<i class="fas fa-star" style="color:#2d3748;font-size:.7rem"></i>';
    if (project._avgRating == null) return '';
    return '<i class="fas fa-star" style="color:#f59e0b;font-size:.7rem"></i> ' + project._avgRating;
}

function patchRatingBadge(project) {
    const el = document.getElementById('rating-' + project._id);
    if (el) el.innerHTML = ratingBadgeHtml(project);
}

// Silently fetch avg rating for every project in the background.
async function fetchAllRatings() {
    if (!projects || !projects.length) return;
    const token = localStorage.getItem('token');
    if (!token) return;

    for (const project of projects) {
        if (project._ratingsLoaded) continue;
        try {
            const res = await fetch('http://localhost:5000/api/reviews/' + project._id, {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (!res.ok) continue;
            const data = await res.json();
            const avg = data.data && data.data.summary && data.data.summary.average;
            project._avgRating = avg != null ? avg : null;
            project._ratingsLoaded = true;
            patchRatingBadge(project);
        } catch (e) { /* non-fatal */ }
    }
}

function renderProjects() {
    const grid = document.getElementById('projectsGrid');
    const emptyState = document.getElementById('emptyState');
    if (!grid) return;

    const filteredProjects = currentFilter === 'all' ? projects : projects.filter(p => p.status === currentFilter);

    if (filteredProjects.length === 0) {
        grid.style.display = 'none';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }

    grid.style.display = 'grid';
    if (emptyState) emptyState.style.display = 'none';

    grid.innerHTML = filteredProjects.map(project => `
        <div class="project-card" data-project-id="${project._id}" onclick="openProject('${project._id}')">
            <div class="project-thumbnail">
                <i class="fas fa-home"></i>
                <span class="project-status status-${project.status}">${formatStatus(project.status)}</span>
            </div>
            <div class="project-info">
                <h3>${escHtml(project.name)}</h3>
                <p>${escHtml(project.description || 'No description')}</p>
                <div class="project-meta">
                    <span><i class="fas fa-ruler-combined"></i> ${project.metadata?.totalArea || 0} m²</span>
                    <span><i class="fas fa-layer-group"></i> ${project.floors?.length || 0} floors</span>
                    <span><i class="fas fa-door-open"></i> ${project.metadata?.totalRooms || 0} rooms</span>
                    <span class="proj-rating-badge" id="rating-${project._id}">${ratingBadgeHtml(project)}</span>
                </div>
                ${estimatedCostBadgeHtml(project)}
                <div class="project-actions" onclick="event.stopPropagation()">
                    <button class="btn btn-sm btn-primary" onclick="openProject('${project._id}')">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-sm btn-share-proj" onclick="openShareModal('${project._id}','${escHtml(project.name)}')" title="Share with client">
                        <i class="fas fa-share-alt"></i> Share
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="confirmDelete('${project._id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            ${aiScoreStripHtml(project)}
        </div>
    `).join('');
}

function escHtml(str) {
    const d = document.createElement('div');
    d.appendChild(document.createTextNode(str));
    return d.innerHTML;
}

function formatStatus(status) {
    const m = { draft: 'Draft', in_progress: 'In Progress', review: 'Review', approved: 'Approved', archived: 'Archived' };
    return m[status] || status;
}

// ── AI Score Strip helpers ──────────────────────────────────────────
function aiScoreColor(score) {
    if (score >= 8) return '#4ade80';
    if (score >= 6) return '#facc15';
    if (score >= 4) return '#fb923c';
    return '#f87171';
}

function aiScoreStripHtml(project) {
    const fb = project.aiFeedback;
    const score = fb && fb.overallScore != null ? fb.overallScore : null;

    if (score === null) {
        return '<div class="ai-score-strip not-analysed">' +
            '<span class="ai-score-strip-label">AI score</span>' +
            '<span class="ai-score-value">Not analysed</span>' +
        '</div>';
    }

    const color = aiScoreColor(score);
    const dots  = Array.from({ length: 10 }, function(_, i) {
        return '<div class="ai-score-dot" style="' + (i < score ? 'background:' + color : '') + '"></div>';
    }).join('');

    return '<div class="ai-score-strip">' +
        '<span class="ai-score-strip-label">AI score</span>' +
        '<div class="ai-score-dots">' + dots + '</div>' +
        '<span class="ai-score-value" style="color:' + color + '">' + score + '/10</span>' +
    '</div>';
}

// ── Project Status Workflow ───────────────────────────────────────────────────
// Renders a compact stepper strip + advance button on each project card.
// Steps: Draft → In Progress → Review → Approved
function statusStepperHtml(project) {
    const STEPS = [
        { key: 'draft',       label: 'Draft',       icon: 'fa-pencil-alt' },
        { key: 'in_progress', label: 'In Progress',  icon: 'fa-tools' },
        { key: 'review',      label: 'Review',       icon: 'fa-search' },
        { key: 'approved',    label: 'Complete',     icon: 'fa-check-circle' }
    ];
    const ORDER    = STEPS.map(s => s.key);
    const curIdx   = ORDER.indexOf(project.status);
    const nextStep = STEPS[curIdx + 1];

    const stepsHtml = STEPS.map((step, i) => {
        const done    = i < curIdx;
        const active  = i === curIdx;
        const cls     = done ? 'ps-step done' : active ? 'ps-step active' : 'ps-step';
        return `<div class="${cls}">
            <div class="ps-dot"><i class="fas ${step.icon}"></i></div>
            <div class="ps-label">${step.label}</div>
        </div>`;
    }).join('<div class="ps-line"></div>');

    const advBtn = nextStep
        ? `<button class="ps-advance-btn" onclick="event.stopPropagation();advanceProjectStatus('${project._id}','${nextStep.key}','${nextStep.label}')">
               <i class="fas fa-arrow-right"></i> Mark as ${nextStep.label}
           </button>`
        : `<span class="ps-complete-badge"><i class="fas fa-check-circle"></i> Complete</span>`;

    return `<div class="ps-stepper" onclick="event.stopPropagation()">
        <div class="ps-steps">${stepsHtml}</div>
        <div class="ps-action">${advBtn}</div>
    </div>`;
}

async function advanceProjectStatus(projectId, newStatus, label) {
    try {
        const result = await api.updateProjectStatus(projectId, newStatus);
        if (!result.success) {
            showToast(result.message || 'Could not update status', 'error');
            return;
        }
        // Update local projects array so re-render reflects new status immediately
        const proj = projects.find(p => p._id === projectId);
        if (proj) proj.status = newStatus;
        renderProjects();
        populateArchDashStats();
        showToast(`Project marked as "${label}" ✓`, 'success');
    } catch (err) {
        showToast('Failed to update status', 'error');
    }
}

function estimatedCostBadgeHtml(project) {
    const ROOM_RATES = {
        living: 1800, bedroom: 1600, bathroom: 2800, kitchen: 3200,
        dining: 1700, office: 1900, garage: 900, staircase: 1400, other: 1500
    };
    const allRooms = (project.floors || []).flatMap(f => f.rooms || []);
    const cost = allRooms.length
        ? allRooms.reduce((s, r) => s + r.width * r.depth * (ROOM_RATES[r.type] || 1500), 0)
        : project.metadata?.estimatedCost;
    if (!cost && cost !== 0) return '';
    const formatted = cost >= 1000000
        ? '$' + (cost / 1000000).toFixed(1) + 'M'
        : '$' + Math.round(cost / 1000) + 'K';
    return `<div class="est-cost-badge">
        <i class="fas fa-dollar-sign"></i>
        <span class="est-cost-label">Est. Cost</span>
        <span class="est-cost-value">${formatted}</span>
    </div>`;
}

function filterByStatus(status) {
    currentFilter = status;
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.filter === status));
    renderProjects();
}

function filterProjects() {
    const term = document.getElementById('searchInput').value.toLowerCase();
    const filtered = projects.filter(p =>
        p.name.toLowerCase().includes(term) ||
        (p.description || '').toLowerCase().includes(term)
    );
    const grid = document.getElementById('projectsGrid');
    if (!grid) return;

    if (filtered.length === 0) {
        grid.style.display = 'none';
        const emptyState = document.getElementById('emptyState');
        if (emptyState) emptyState.style.display = 'block';
        return;
    }

    grid.style.display = 'grid';
    const emptyState = document.getElementById('emptyState');
    if (emptyState) emptyState.style.display = 'none';

    grid.innerHTML = filtered.map(project => `
        <div class="project-card" data-project-id="${project._id}" onclick="openProject('${project._id}')">
            <div class="project-thumbnail">
                <i class="fas fa-home"></i>
                <span class="project-status status-${project.status}">${formatStatus(project.status)}</span>
            </div>
            <div class="project-info">
                <h3>${escHtml(project.name)}</h3>
                <p>${escHtml(project.description || 'No description')}</p>
                <div class="project-meta">
                    <span><i class="fas fa-ruler-combined"></i> ${project.metadata?.totalArea || 0} m²</span>
                    <span><i class="fas fa-layer-group"></i> ${project.floors?.length || 0} floors</span>
                    <span><i class="fas fa-door-open"></i> ${project.metadata?.totalRooms || 0} rooms</span>
                    <span class="proj-rating-badge" id="rating-${project._id}">${ratingBadgeHtml(project)}</span>
                </div>
                ${estimatedCostBadgeHtml(project)}
                <div class="project-actions" onclick="event.stopPropagation()">
                    <button class="btn btn-sm btn-primary" onclick="openProject('${project._id}')">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-sm btn-share-proj" onclick="openShareModal('${project._id}','${escHtml(project.name)}')" title="Share with client">
                        <i class="fas fa-share-alt"></i> Share
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="confirmDelete('${project._id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            ${aiScoreStripHtml(project)}
        </div>
    `).join('');
}

function showNewProjectModal() {
    document.getElementById('projectModal').style.display = 'flex';
}

function closeProjectModal() {
    document.getElementById('projectModal').style.display = 'none';
    document.getElementById('projectForm').reset();
}

async function createProject(event) {
    event.preventDefault();
    const projectData = {
        name:        document.getElementById('projectName').value,
        description: document.getElementById('projectDescription').value,
        totalWidth:  parseFloat(document.getElementById('projectWidth').value),
        totalDepth:  parseFloat(document.getElementById('projectDepth').value),
        type:        document.getElementById('projectType').value,
        specifications: { roofType: document.getElementById('roofType').value },
        floors: [{ level: 1, name: 'Ground Floor', height: 2.7, rooms: [] }]
    };

    try {
        showLoading('Creating project...');
        const data = await api.createProject(projectData);
        hideLoading();
        showToast('Project created successfully!', 'success');
        closeProjectModal();
        window.location.href = `architect.html?id=${data.data._id}`;
    } catch (error) {
        hideLoading();
        // Check for plan limit errors
        const code = error.data?.code;
        if (code === 'PROJECT_LIMIT_REACHED' || code === 'PLAN_REQUIRED' || code === 'PLAN_EXPIRED') {
            closeProjectModal();
            // Refresh plan data then show limit modal
            if (typeof loadSubscriptionStatus === 'function') {
                await loadSubscriptionStatus().catch(() => {});
            }
            if (typeof showPlanLimitModal === 'function') {
                showPlanLimitModal('project', error.data?.currentPlan || 'free');
            } else {
                showToast(error.message || 'Project limit reached. Please upgrade your plan.', 'error');
            }
        } else {
            showToast(error.message || 'Failed to create project', 'error');
        }
    }
}

function openProject(projectId) {
    window.location.href = `architect.html?id=${projectId}`;
}

function confirmDelete(id) {
    deleteProjectId = id;
    document.getElementById('deleteModal').style.display = 'flex';
}

function closeDeleteModal() {
    document.getElementById('deleteModal').style.display = 'none';
    deleteProjectId = null;
}

async function deleteProject() {
    if (!deleteProjectId) return;
    try {
        showLoading('Deleting project...');
        await api.deleteProject(deleteProjectId);
        hideLoading();
        projects = projects.filter(p => p._id !== deleteProjectId);
        window.projects = projects;
        renderProjects();
        updateAnalytics();
        closeDeleteModal();
        showToast('Project deleted', 'success');
    } catch (error) {
        hideLoading();
        showToast('Failed to delete project', 'error');
    }
}

async function createFromTemplate(templateType) {
    // ─────────────────────────────────────────────────────────────────────────
    //  Architecturally accurate template layouts
    //  Rules applied:
    //   • Public zone (living/kitchen/dining) at front (low z)
    //   • Private zone (bedrooms) at rear (high z)
    //   • Wet rooms (bathroom/WC) grouped together, accessible from corridor
    //   • Circulation: hallway/corridor rooms separate public from private
    //   • Doors placed on shared walls; windows on exterior walls only
    //   • Room sizes match real-world standards for each style
    //   • Traditional & Luxury are 2-storey; Modern & Minimalist are 1-storey
    // ─────────────────────────────────────────────────────────────────────────
    const templates = {

        // ── MODERN HOUSE ──────────────────────────────────────────────────────
        // 18 × 13 m · 1 floor · flat roof · open-plan public zone
        // Layout: open-plan L+K+D across full front width
        //         hallway strip separates front from rear
        //         master bedroom + ensuite + bedroom 2 + bathroom at rear
        modern: {
            name: 'Modern House',
            totalWidth: 18, totalDepth: 13,
            type: 'residential', style: 'modern',
            specifications: { roofType: 'flat', floorHeight: 3.0 },
            floors: [{
                level: 1, name: 'Ground Floor', height: 3.0,
                rooms: [
                    // ── Front public zone (z 0–6) ──
                    {
                        name: 'Living Room', type: 'living',
                        width: 8, depth: 6, x: 0, z: 0,
                        windows: [
                            { wall: 'top', pos: 0.25, width: 1.8 },
                            { wall: 'top', pos: 0.70, width: 1.8 },
                            { wall: 'left', pos: 0.5, width: 1.5 }
                        ],
                        doors: [
                            { wall: 'bottom', pos: 0.5, width: 0.9 },   // to hallway
                            { wall: 'right',  pos: 0.5, width: 0.9 }    // to kitchen
                        ]
                    },
                    {
                        name: 'Kitchen', type: 'kitchen',
                        width: 5.5, depth: 4, x: 8, z: 0,
                        windows: [
                            { wall: 'top', pos: 0.5, width: 1.4 }
                        ],
                        doors: [
                            { wall: 'right', pos: 0.5, width: 0.9 }     // to dining
                        ]
                    },
                    {
                        name: 'Dining Room', type: 'dining',
                        width: 4.5, depth: 4, x: 13.5, z: 0,
                        windows: [
                            { wall: 'top',   pos: 0.5, width: 1.4 },
                            { wall: 'right', pos: 0.5, width: 1.2 }
                        ],
                        doors: [
                            { wall: 'bottom', pos: 0.5, width: 0.9 }    // to hallway
                        ]
                    },
                    // ── Utility / laundry (front-right corner) ──
                    {
                        name: 'Utility Room', type: 'other',
                        width: 4.5, depth: 2, x: 13.5, z: 4,
                        windows: [
                            { wall: 'right', pos: 0.5, width: 0.8 }
                        ],
                        doors: [
                            { wall: 'bottom', pos: 0.5, width: 0.9 }
                        ]
                    },
                    // ── Hallway / corridor ──
                    {
                        name: 'Hallway', type: 'other',
                        width: 18, depth: 1.5, x: 0, z: 6,
                        doors: [
                            { wall: 'top',    pos: 0.08, width: 0.9 },  // front entry
                            { wall: 'bottom', pos: 0.15, width: 0.9 },  // to master bed
                            { wall: 'bottom', pos: 0.45, width: 0.9 },  // to ensuite
                            { wall: 'bottom', pos: 0.65, width: 0.9 },  // to bed 2
                            { wall: 'bottom', pos: 0.85, width: 0.9 }   // to bathroom
                        ]
                    },
                    // ── Rear private zone (z 7.5–13) ──
                    {
                        name: 'Master Bedroom', type: 'bedroom',
                        width: 5.5, depth: 5.5, x: 0, z: 7.5,
                        windows: [
                            { wall: 'bottom', pos: 0.35, width: 1.6 },
                            { wall: 'left',   pos: 0.5,  width: 1.2 }
                        ],
                        doors: [
                            { wall: 'top',   pos: 0.5, width: 0.9 },    // to hallway
                            { wall: 'right', pos: 0.7, width: 0.8 }     // to ensuite
                        ]
                    },
                    {
                        name: 'Ensuite', type: 'bathroom',
                        width: 3, depth: 2.5, x: 5.5, z: 7.5,
                        windows: [
                            { wall: 'bottom', pos: 0.5, width: 0.6 }
                        ],
                        doors: [
                            { wall: 'top', pos: 0.5, width: 0.8 }
                        ]
                    },
                    {
                        name: 'Bedroom 2', type: 'bedroom',
                        width: 4.5, depth: 5.5, x: 8.5, z: 7.5,
                        windows: [
                            { wall: 'bottom', pos: 0.5, width: 1.4 }
                        ],
                        doors: [
                            { wall: 'top', pos: 0.5, width: 0.9 }
                        ]
                    },
                    {
                        name: 'Bathroom', type: 'bathroom',
                        width: 3, depth: 2.5, x: 13, z: 7.5,
                        windows: [
                            { wall: 'right', pos: 0.5, width: 0.7 }
                        ],
                        doors: [
                            { wall: 'top', pos: 0.5, width: 0.8 }
                        ]
                    },
                    {
                        name: 'WC', type: 'bathroom',
                        width: 2, depth: 2.5, x: 16, z: 7.5,
                        doors: [
                            { wall: 'top', pos: 0.5, width: 0.7 }
                        ]
                    }
                ]
            }]
        },

        // ── TRADITIONAL HOME ──────────────────────────────────────────────────
        // 22 × 16 m · 2 floors · pitched roof · symmetrical Georgian-style
        // GF: entry hall centre, living left, dining right, kitchen rear-left,
        //     garage rear-right, WC + utility rear-centre
        // FF: landing, master suite, 3 bedrooms, 2 bathrooms
        traditional: {
            name: 'Traditional Home',
            totalWidth: 22, totalDepth: 16,
            type: 'residential', style: 'traditional',
            specifications: { roofType: 'pitched', floorHeight: 2.8 },
            floors: [
                {
                    level: 1, name: 'Ground Floor', height: 2.8,
                    rooms: [
                        // ── Entry hall (centre-front) ──
                        {
                            name: 'Entry Hall', type: 'other',
                            width: 4, depth: 4, x: 9, z: 0,
                            windows: [
                                { wall: 'top', pos: 0.5, width: 0.6 }   // fanlight
                            ],
                            doors: [
                                { wall: 'top',    pos: 0.5, width: 1.0 }, // front door
                                { wall: 'left',   pos: 0.5, width: 0.9 }, // to living
                                { wall: 'right',  pos: 0.5, width: 0.9 }, // to dining
                                { wall: 'bottom', pos: 0.5, width: 0.9 }  // to staircase
                            ]
                        },
                        // ── Staircase (centre) ──
                        {
                            name: 'Staircase', type: 'staircase',
                            width: 4, depth: 4, x: 9, z: 4,
                            doors: [
                                { wall: 'left',  pos: 0.5, width: 0.9 }, // to kitchen
                                { wall: 'right', pos: 0.5, width: 0.9 }  // to WC
                            ]
                        },
                        // ── Living room (left-front) ──
                        {
                            name: 'Living Room', type: 'living',
                            width: 9, depth: 7, x: 0, z: 0,
                            windows: [
                                { wall: 'top',  pos: 0.3, width: 1.6 },
                                { wall: 'top',  pos: 0.7, width: 1.6 },
                                { wall: 'left', pos: 0.5, width: 1.4 }
                            ],
                            doors: [
                                { wall: 'right',  pos: 0.4, width: 0.9 }, // to hall
                                { wall: 'bottom', pos: 0.5, width: 0.9 }  // to dining/rear
                            ]
                        },
                        // ── Dining room (right-front) ──
                        {
                            name: 'Dining Room', type: 'dining',
                            width: 9, depth: 7, x: 13, z: 0,
                            windows: [
                                { wall: 'top',   pos: 0.3, width: 1.6 },
                                { wall: 'top',   pos: 0.7, width: 1.6 },
                                { wall: 'right', pos: 0.5, width: 1.4 }
                            ],
                            doors: [
                                { wall: 'left',   pos: 0.4, width: 0.9 }, // to hall
                                { wall: 'bottom', pos: 0.5, width: 0.9 }  // to kitchen
                            ]
                        },
                        // ── Kitchen (rear-left) ──
                        {
                            name: 'Kitchen', type: 'kitchen',
                            width: 9, depth: 5, x: 0, z: 7,
                            windows: [
                                { wall: 'bottom', pos: 0.3, width: 1.4 },
                                { wall: 'bottom', pos: 0.7, width: 1.4 },
                                { wall: 'left',   pos: 0.5, width: 1.0 }
                            ],
                            doors: [
                                { wall: 'top',   pos: 0.5, width: 0.9 }, // to staircase area
                                { wall: 'right', pos: 0.5, width: 0.9 }  // to utility
                            ]
                        },
                        // ── WC (rear-centre) ──
                        {
                            name: 'WC / Cloakroom', type: 'bathroom',
                            width: 2.5, depth: 2.5, x: 9, z: 8,
                            doors: [
                                { wall: 'top', pos: 0.5, width: 0.7 }
                            ]
                        },
                        // ── Utility (rear-centre lower) ──
                        {
                            name: 'Utility Room', type: 'other',
                            width: 3.5, depth: 2.5, x: 9, z: 10.5,
                            windows: [
                                { wall: 'bottom', pos: 0.5, width: 0.8 }
                            ],
                            doors: [
                                { wall: 'right', pos: 0.5, width: 0.9 }
                            ]
                        },
                        // ── Garage (rear-right) ──
                        {
                            name: 'Garage', type: 'garage',
                            width: 9, depth: 5, x: 13, z: 7,
                            windows: [
                                { wall: 'right', pos: 0.5, width: 1.0 }
                            ],
                            doors: [
                                { wall: 'top',    pos: 0.5, width: 0.9 }, // to dining area
                                { wall: 'bottom', pos: 0.5, width: 2.4 }  // garage door
                            ]
                        }
                    ]
                },
                {
                    level: 2, name: 'First Floor', height: 2.8,
                    rooms: [
                        // ── Landing ──
                        {
                            name: 'Landing', type: 'staircase',
                            width: 4, depth: 3, x: 9, z: 0,
                            doors: [
                                { wall: 'left',   pos: 0.5, width: 0.9 },
                                { wall: 'right',  pos: 0.5, width: 0.9 },
                                { wall: 'bottom', pos: 0.5, width: 0.9 }
                            ]
                        },
                        // ── Master bedroom (left-front) ──
                        {
                            name: 'Master Bedroom', type: 'bedroom',
                            width: 9, depth: 6, x: 0, z: 0,
                            windows: [
                                { wall: 'top',  pos: 0.3, width: 1.6 },
                                { wall: 'top',  pos: 0.7, width: 1.6 },
                                { wall: 'left', pos: 0.5, width: 1.2 }
                            ],
                            doors: [
                                { wall: 'right',  pos: 0.4, width: 0.9 }, // to landing
                                { wall: 'bottom', pos: 0.8, width: 0.8 }  // to ensuite
                            ]
                        },
                        // ── Ensuite ──
                        {
                            name: 'Ensuite', type: 'bathroom',
                            width: 4, depth: 3, x: 0, z: 6,
                            windows: [
                                { wall: 'left', pos: 0.5, width: 0.7 }
                            ],
                            doors: [
                                { wall: 'top', pos: 0.5, width: 0.8 }
                            ]
                        },
                        // ── Bedroom 2 (right-front) ──
                        {
                            name: 'Bedroom 2', type: 'bedroom',
                            width: 9, depth: 6, x: 13, z: 0,
                            windows: [
                                { wall: 'top',   pos: 0.3, width: 1.6 },
                                { wall: 'top',   pos: 0.7, width: 1.6 },
                                { wall: 'right', pos: 0.5, width: 1.2 }
                            ],
                            doors: [
                                { wall: 'left', pos: 0.4, width: 0.9 }
                            ]
                        },
                        // ── Bedroom 3 (left-rear) ──
                        {
                            name: 'Bedroom 3', type: 'bedroom',
                            width: 6, depth: 5, x: 0, z: 9,
                            windows: [
                                { wall: 'bottom', pos: 0.5, width: 1.4 },
                                { wall: 'left',   pos: 0.5, width: 1.0 }
                            ],
                            doors: [
                                { wall: 'right', pos: 0.5, width: 0.9 }
                            ]
                        },
                        // ── Family bathroom (centre-rear) ──
                        {
                            name: 'Family Bathroom', type: 'bathroom',
                            width: 5, depth: 3.5, x: 9, z: 3,
                            windows: [
                                { wall: 'right', pos: 0.5, width: 0.7 }
                            ],
                            doors: [
                                { wall: 'top', pos: 0.5, width: 0.8 }
                            ]
                        },
                        // ── Bedroom 4 (right-rear) ──
                        {
                            name: 'Bedroom 4', type: 'bedroom',
                            width: 6, depth: 5, x: 16, z: 9,
                            windows: [
                                { wall: 'bottom', pos: 0.5, width: 1.4 },
                                { wall: 'right',  pos: 0.5, width: 1.0 }
                            ],
                            doors: [
                                { wall: 'left', pos: 0.5, width: 0.9 }
                            ]
                        }
                    ]
                }
            ]
        },

        // ── MINIMALIST HOME ───────────────────────────────────────────────────
        // 16 × 11 m · 1 floor · flat roof · fewest walls, max glazing
        // One single open-plan spine across the full front
        // Two bedrooms + bathroom slip behind a single flush partition
        minimalist: {
            name: 'Minimalist Home',
            totalWidth: 16, totalDepth: 11,
            type: 'residential', style: 'minimalist',
            specifications: { roofType: 'flat', floorHeight: 3.2 },
            floors: [{
                level: 1, name: 'Ground Floor', height: 3.2,
                rooms: [
                    // ── Open-plan (full front width) ──
                    {
                        name: 'Open Living · Dining · Kitchen', type: 'living',
                        width: 16, depth: 6.5, x: 0, z: 0,
                        windows: [
                            { wall: 'top',   pos: 0.15, width: 2.4 }, // floor-to-ceiling bays
                            { wall: 'top',   pos: 0.45, width: 2.4 },
                            { wall: 'top',   pos: 0.75, width: 2.4 },
                            { wall: 'left',  pos: 0.5,  width: 1.8 },
                            { wall: 'right', pos: 0.5,  width: 1.8 }
                        ],
                        doors: [
                            { wall: 'top',    pos: 0.05, width: 1.0 }, // main entry
                            { wall: 'bottom', pos: 0.35, width: 0.9 }, // to master bed
                            { wall: 'bottom', pos: 0.72, width: 0.9 }  // to bed 2 / bath
                        ]
                    },
                    // ── Master bedroom (rear-left) ──
                    {
                        name: 'Master Bedroom', type: 'bedroom',
                        width: 6.5, depth: 4.5, x: 0, z: 6.5,
                        windows: [
                            { wall: 'bottom', pos: 0.4, width: 1.8 },
                            { wall: 'left',   pos: 0.5, width: 1.2 }
                        ],
                        doors: [
                            { wall: 'top',   pos: 0.5, width: 0.9 },
                            { wall: 'right', pos: 0.7, width: 0.8 }  // to ensuite
                        ]
                    },
                    // ── Ensuite (rear, behind master) ──
                    {
                        name: 'Ensuite', type: 'bathroom',
                        width: 3, depth: 4.5, x: 6.5, z: 6.5,
                        windows: [
                            { wall: 'bottom', pos: 0.5, width: 0.6 }
                        ],
                        doors: [
                            { wall: 'top', pos: 0.5, width: 0.8 }
                        ]
                    },
                    // ── Bedroom 2 (rear-right) ──
                    {
                        name: 'Bedroom 2', type: 'bedroom',
                        width: 6.5, depth: 4.5, x: 9.5, z: 6.5,
                        windows: [
                            { wall: 'bottom', pos: 0.5, width: 1.6 },
                            { wall: 'right',  pos: 0.5, width: 1.0 }
                        ],
                        doors: [
                            { wall: 'top', pos: 0.5, width: 0.9 }
                        ]
                    }
                ]
            }]
        },

        // ── LUXURY VILLA ──────────────────────────────────────────────────────
        // 28 × 22 m · 2 floors · hip roof · grand classical proportions
        // GF: grand foyer, formal living, library, formal dining,
        //     chef's kitchen + scullery, family room, WC, service wing
        // FF: master suite + dressing + ensuite, 3 bedrooms each with ensuite,
        //     study, sitting room
        villa: {
            name: 'Luxury Villa',
            totalWidth: 28, totalDepth: 22,
            type: 'residential', style: 'luxury',
            specifications: { roofType: 'hip', floorHeight: 3.5 },
            floors: [
                {
                    level: 1, name: 'Ground Floor', height: 3.5,
                    rooms: [
                        // ── Grand foyer (centre-front) ──
                        {
                            name: 'Grand Foyer', type: 'other',
                            width: 6, depth: 5, x: 11, z: 0,
                            windows: [
                                { wall: 'top', pos: 0.25, width: 0.8 },
                                { wall: 'top', pos: 0.75, width: 0.8 }
                            ],
                            doors: [
                                { wall: 'top',    pos: 0.5,  width: 1.2 }, // grand entrance
                                { wall: 'left',   pos: 0.5,  width: 1.0 }, // to formal living
                                { wall: 'right',  pos: 0.5,  width: 1.0 }, // to library
                                { wall: 'bottom', pos: 0.5,  width: 1.0 }  // to staircase
                            ]
                        },
                        // ── Grand staircase ──
                        {
                            name: 'Grand Staircase', type: 'staircase',
                            width: 6, depth: 5, x: 11, z: 5,
                            doors: [
                                { wall: 'left',   pos: 0.5, width: 1.0 },
                                { wall: 'right',  pos: 0.5, width: 1.0 },
                                { wall: 'bottom', pos: 0.5, width: 1.0 }
                            ]
                        },
                        // ── Formal living room (left-front) ──
                        {
                            name: 'Formal Living Room', type: 'living',
                            width: 11, depth: 8, x: 0, z: 0,
                            windows: [
                                { wall: 'top',  pos: 0.25, width: 2.0 },
                                { wall: 'top',  pos: 0.65, width: 2.0 },
                                { wall: 'left', pos: 0.4,  width: 1.8 },
                                { wall: 'left', pos: 0.75, width: 1.8 }
                            ],
                            doors: [
                                { wall: 'right',  pos: 0.3, width: 1.0 }, // to foyer
                                { wall: 'bottom', pos: 0.5, width: 1.0 }  // to formal dining
                            ]
                        },
                        // ── Library / study (right-front) ──
                        {
                            name: 'Library', type: 'office',
                            width: 11, depth: 8, x: 17, z: 0,
                            windows: [
                                { wall: 'top',   pos: 0.25, width: 2.0 },
                                { wall: 'top',   pos: 0.65, width: 2.0 },
                                { wall: 'right', pos: 0.4,  width: 1.8 },
                                { wall: 'right', pos: 0.75, width: 1.8 }
                            ],
                            doors: [
                                { wall: 'left',   pos: 0.3, width: 1.0 }, // to foyer
                                { wall: 'bottom', pos: 0.5, width: 1.0 }  // to family room
                            ]
                        },
                        // ── Formal dining (left-rear) ──
                        {
                            name: 'Formal Dining Room', type: 'dining',
                            width: 8, depth: 6, x: 0, z: 8,
                            windows: [
                                { wall: 'left',   pos: 0.5, width: 1.8 },
                                { wall: 'bottom', pos: 0.5, width: 1.6 }
                            ],
                            doors: [
                                { wall: 'top',   pos: 0.5, width: 1.0 }, // to living
                                { wall: 'right', pos: 0.5, width: 1.0 }  // to kitchen
                            ]
                        },
                        // ── Chef's kitchen (centre-rear) ──
                        {
                            name: "Chef's Kitchen", type: 'kitchen',
                            width: 8, depth: 6, x: 8, z: 8,
                            windows: [
                                { wall: 'bottom', pos: 0.3, width: 1.4 },
                                { wall: 'bottom', pos: 0.7, width: 1.4 }
                            ],
                            doors: [
                                { wall: 'top',   pos: 0.5, width: 1.0 }, // to staircase area
                                { wall: 'right', pos: 0.5, width: 0.9 }  // to scullery
                            ]
                        },
                        // ── Scullery / back kitchen (centre-rear) ──
                        {
                            name: 'Scullery', type: 'kitchen',
                            width: 4, depth: 3.5, x: 16, z: 8,
                            windows: [
                                { wall: 'bottom', pos: 0.5, width: 0.8 }
                            ],
                            doors: [
                                { wall: 'top',   pos: 0.5, width: 0.9 },
                                { wall: 'right', pos: 0.5, width: 0.9 }
                            ]
                        },
                        // ── Family / casual living (right-rear) ──
                        {
                            name: 'Family Room', type: 'living',
                            width: 8, depth: 6, x: 20, z: 8,
                            windows: [
                                { wall: 'right',  pos: 0.4, width: 1.8 },
                                { wall: 'right',  pos: 0.75,width: 1.8 },
                                { wall: 'bottom', pos: 0.5, width: 1.6 }
                            ],
                            doors: [
                                { wall: 'top',  pos: 0.5, width: 1.0 }, // to library
                                { wall: 'left', pos: 0.5, width: 0.9 }  // to scullery
                            ]
                        },
                        // ── Guest WC (centre) ──
                        {
                            name: 'Guest WC', type: 'bathroom',
                            width: 3, depth: 2.5, x: 11, z: 10,
                            doors: [
                                { wall: 'top', pos: 0.5, width: 0.8 }
                            ]
                        },
                        // ── Service / utility wing (rear-strip) ──
                        {
                            name: 'Utility & Laundry', type: 'other',
                            width: 8, depth: 4, x: 0, z: 14,
                            windows: [
                                { wall: 'left',   pos: 0.5, width: 1.0 },
                                { wall: 'bottom', pos: 0.5, width: 1.0 }
                            ],
                            doors: [
                                { wall: 'top',    pos: 0.5, width: 0.9 },
                                { wall: 'bottom', pos: 0.5, width: 1.0 } // service entrance
                            ]
                        },
                        // ── Staff / guest quarters (rear-right) ──
                        {
                            name: 'Staff Room', type: 'bedroom',
                            width: 6, depth: 4, x: 20, z: 14,
                            windows: [
                                { wall: 'right',  pos: 0.5, width: 1.2 },
                                { wall: 'bottom', pos: 0.5, width: 1.0 }
                            ],
                            doors: [
                                { wall: 'top',  pos: 0.5, width: 0.9 },
                                { wall: 'left', pos: 0.5, width: 0.8 }
                            ]
                        }
                    ]
                },
                {
                    level: 2, name: 'First Floor', height: 3.5,
                    rooms: [
                        // ── Upper landing ──
                        {
                            name: 'Upper Landing', type: 'staircase',
                            width: 6, depth: 4, x: 11, z: 0,
                            doors: [
                                { wall: 'left',   pos: 0.5, width: 1.0 },
                                { wall: 'right',  pos: 0.5, width: 1.0 },
                                { wall: 'bottom', pos: 0.5, width: 1.0 }
                            ]
                        },
                        // ── Master suite (left-front) ──
                        {
                            name: 'Master Bedroom Suite', type: 'bedroom',
                            width: 11, depth: 8, x: 0, z: 0,
                            windows: [
                                { wall: 'top',  pos: 0.25, width: 2.2 },
                                { wall: 'top',  pos: 0.65, width: 2.2 },
                                { wall: 'left', pos: 0.5,  width: 1.8 }
                            ],
                            doors: [
                                { wall: 'right',  pos: 0.3, width: 1.0 }, // to landing
                                { wall: 'bottom', pos: 0.25,width: 0.9 }, // to dressing room
                                { wall: 'bottom', pos: 0.75,width: 0.9 }  // to master ensuite
                            ]
                        },
                        // ── Dressing room ──
                        {
                            name: 'Dressing Room', type: 'other',
                            width: 5, depth: 4, x: 0, z: 8,
                            doors: [
                                { wall: 'top',   pos: 0.5, width: 0.9 },
                                { wall: 'right', pos: 0.5, width: 0.8 }
                            ]
                        },
                        // ── Master ensuite ──
                        {
                            name: 'Master Ensuite', type: 'bathroom',
                            width: 6, depth: 4, x: 5, z: 8,
                            windows: [
                                { wall: 'left',   pos: 0.5, width: 0.8 },
                                { wall: 'bottom', pos: 0.5, width: 0.8 }
                            ],
                            doors: [
                                { wall: 'top', pos: 0.5, width: 0.9 }
                            ]
                        },
                        // ── Sitting room / upstairs lounge (right-front) ──
                        {
                            name: 'Sitting Room', type: 'living',
                            width: 11, depth: 8, x: 17, z: 0,
                            windows: [
                                { wall: 'top',   pos: 0.25, width: 2.2 },
                                { wall: 'top',   pos: 0.65, width: 2.2 },
                                { wall: 'right', pos: 0.5,  width: 1.8 }
                            ],
                            doors: [
                                { wall: 'left', pos: 0.3, width: 1.0 }
                            ]
                        },
                        // ── Bedroom 2 with ensuite (left-rear) ──
                        {
                            name: 'Bedroom 2', type: 'bedroom',
                            width: 8, depth: 6, x: 0, z: 12,
                            windows: [
                                { wall: 'left',   pos: 0.5, width: 1.6 },
                                { wall: 'bottom', pos: 0.5, width: 1.6 }
                            ],
                            doors: [
                                { wall: 'right', pos: 0.3, width: 0.9 },
                                { wall: 'right', pos: 0.75,width: 0.8 }  // to ensuite
                            ]
                        },
                        {
                            name: 'Ensuite 2', type: 'bathroom',
                            width: 3.5, depth: 3, x: 8, z: 12,
                            doors: [{ wall: 'left', pos: 0.5, width: 0.8 }]
                        },
                        // ── Bedroom 3 with ensuite (centre-rear) ──
                        {
                            name: 'Bedroom 3', type: 'bedroom',
                            width: 8, depth: 6, x: 11, z: 12,
                            windows: [
                                { wall: 'bottom', pos: 0.5, width: 1.6 }
                            ],
                            doors: [
                                { wall: 'top',   pos: 0.3, width: 0.9 },
                                { wall: 'right', pos: 0.7, width: 0.8 }
                            ]
                        },
                        {
                            name: 'Ensuite 3', type: 'bathroom',
                            width: 3.5, depth: 3, x: 19, z: 12,
                            doors: [{ wall: 'left', pos: 0.5, width: 0.8 }]
                        },
                        // ── Bedroom 4 with ensuite (right-rear) ──
                        {
                            name: 'Bedroom 4', type: 'bedroom',
                            width: 5, depth: 6, x: 23, z: 12,
                            windows: [
                                { wall: 'right',  pos: 0.5, width: 1.4 },
                                { wall: 'bottom', pos: 0.5, width: 1.2 }
                            ],
                            doors: [
                                { wall: 'top',  pos: 0.5, width: 0.9 },
                                { wall: 'left', pos: 0.7, width: 0.8 }
                            ]
                        },
                        {
                            name: 'Ensuite 4', type: 'bathroom',
                            width: 3.5, depth: 3, x: 23, z: 9,
                            doors: [{ wall: 'bottom', pos: 0.5, width: 0.8 }]
                        }
                    ]
                }
            ]
        }
    };

    const template = templates[templateType];
    if (!template) return;

    // Ensure every room has doors/windows arrays (safety net)
    if (template.floors) {
        template.floors.forEach(floor => {
            if (floor.rooms) {
                floor.rooms.forEach(room => {
                    if (!room.doors)   room.doors   = [];
                    if (!room.windows) room.windows = [];
                    if (!room.height)  room.height  = floor.height || 2.8;
                });
            }
        });
    }

    try {
        showLoading('Creating from template...');
        const data = await api.createProject(template);
        hideLoading();
        showToast('Project created from template!', 'success');
        window.location.href = `architect.html?id=${data.data._id}`;
    } catch (error) {
        hideLoading();
        const code = error.data?.code;
        if (code === 'PROJECT_LIMIT_REACHED' || code === 'PLAN_REQUIRED' || code === 'PLAN_EXPIRED') {
            if (typeof loadSubscriptionStatus === 'function') {
                await loadSubscriptionStatus().catch(() => {});
            }
            if (typeof showPlanLimitModal === 'function') {
                showPlanLimitModal('project', error.data?.currentPlan || 'free');
            } else {
                showToast(error.message || 'Project limit reached. Please upgrade your plan.', 'error');
            }
        } else {
            showToast(error.message || 'Failed to create from template', 'error');
        }
    }
}

async function updateAnalytics() {
    const projs   = window.projects || [];
    const conns   = window._archConnectionsCache || [];
    const el      = id => document.getElementById(id);
    const fmt     = n => n >= 1000000 ? '$' + (n/1000000).toFixed(1) + 'M' : n >= 1000 ? '$' + (n/1000).toFixed(0) + 'k' : '$' + n;

    // ── KPI counts ────────────────────────────────────────────────────────────
    const totalProjects   = projs.length;
    const completed       = projs.filter(p => p.status === 'approved').length;
    const inProgress      = projs.filter(p => p.status === 'in_progress').length;
    const inReview        = projs.filter(p => p.status === 'review').length;
    const inDraft         = projs.filter(p => p.status === 'draft').length;
    const totalArea       = projs.reduce((s, p) => s + (p.metadata?.totalArea || 0), 0);
    const totalRooms      = projs.reduce((s, p) => s + (p.metadata?.totalRooms || 0), 0);
    const totalValue      = projs.reduce((s, p) => s + (p.metadata?.estimatedCost || 0), 0);
    const acceptedClients = conns.filter(c => c.status === 'accepted').length;
    const completionPct   = totalProjects > 0 ? Math.round((completed / totalProjects) * 100) : 0;
    const avgArea         = totalProjects > 0 ? Math.round(totalArea / totalProjects) : 0;
    const avgRooms        = totalProjects > 0 ? (totalRooms / totalProjects).toFixed(1) : '0';
    const avgValue        = totalProjects > 0 ? Math.round(totalValue / totalProjects) : 0;

    // ── Set KPI card values ───────────────────────────────────────────────────
    if (el('totalProjects'))    el('totalProjects').textContent    = totalProjects;
    if (el('completedProjects'))el('completedProjects').textContent= completed;
    if (el('totalClients'))     el('totalClients').textContent     = acceptedClients;
    if (el('totalAreaStat'))    el('totalAreaStat').textContent    = totalArea.toLocaleString();
    if (el('totalRoomsStat'))   el('totalRoomsStat').textContent   = totalRooms;
    if (el('totalValue'))       el('totalValue').textContent       = fmt(totalValue);
    if (el('analyticsLastUpdated')) el('analyticsLastUpdated').textContent = 'Updated ' + new Date().toLocaleTimeString('en-US', {hour:'2-digit',minute:'2-digit'});

    // ── Completion Ring (mini doughnut) ───────────────────────────────────────
    if (el('completionRingPct'))   el('completionRingPct').textContent   = completionPct + '%';
    if (el('completionRingLabel')) el('completionRingLabel').textContent = `${completed} of ${totalProjects} projects done`;
    _buildCompletionRing(completionPct);

    // ── Client Pipeline breakdown ──────────────────────────────────────────────
    const pipelineEl = el('clientPipelineList');
    if (pipelineEl) {
        const pending  = conns.filter(c => c.status === 'pending').length;
        const rejected = conns.filter(c => c.status === 'rejected').length;
        const items = [
            { label: 'Active Clients',   val: acceptedClients, color: '#10b981', pct: conns.length > 0 ? (acceptedClients/conns.length)*100 : 0 },
            { label: 'Pending Requests', val: pending,         color: '#f59e0b', pct: conns.length > 0 ? (pending/conns.length)*100 : 0 },
            { label: 'Declined',         val: rejected,        color: '#ef4444', pct: conns.length > 0 ? (rejected/conns.length)*100 : 0 },
        ];
        pipelineEl.innerHTML = items.map(it => `
            <div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
                    <span style="font-size:0.72rem;color:#94a3b8;">${it.label}</span>
                    <span style="font-size:0.75rem;font-weight:700;color:${it.color};">${it.val}</span>
                </div>
                <div style="height:5px;border-radius:3px;background:rgba(255,255,255,0.06);overflow:hidden;">
                    <div style="height:100%;border-radius:3px;background:${it.color};width:${it.pct.toFixed(1)}%;transition:width 0.8s ease;"></div>
                </div>
            </div>`).join('');
    }

    // ── Averages per project ───────────────────────────────────────────────────
    const avgEl = el('avgMetricsList');
    if (avgEl) {
        const metrics = [
            { icon: 'fa-ruler-combined', label: 'Avg Area',   val: avgArea + ' m²',  color: '#00d4c8' },
            { icon: 'fa-door-open',      label: 'Avg Rooms',  val: avgRooms,          color: '#8b5cf6' },
            { icon: 'fa-dollar-sign',    label: 'Avg Value',  val: fmt(avgValue),     color: '#ec4899' },
            { icon: 'fa-layer-group',    label: 'Avg Floors', val: (totalProjects > 0 ? (projs.reduce((s,p)=>(s+(p.floors?.length||1)),0)/totalProjects).toFixed(1) : '0'), color: '#f59e0b' },
        ];
        avgEl.innerHTML = metrics.map(m => `
            <div style="display:flex;align-items:center;gap:0.65rem;">
                <div style="width:28px;height:28px;border-radius:7px;background:${m.color}1a;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                    <i class="fas ${m.icon}" style="font-size:0.7rem;color:${m.color};"></i>
                </div>
                <div style="flex:1;min-width:0;">
                    <div style="font-size:0.68rem;color:#64748b;">${m.label}</div>
                    <div style="font-size:0.88rem;font-weight:700;color:#e2e8f0;">${m.val}</div>
                </div>
            </div>`).join('');
    }

    // ── Build all charts ───────────────────────────────────────────────────────
    if (typeof buildCharts === 'function') buildCharts(projs);
    _buildTimelineChart(projs);
    _buildStyleRadarChart(projs);

    // ── Load reviews async ────────────────────────────────────────────────────
    _loadAllReviews(projs);
}

// ── Completion ring mini chart ─────────────────────────────────────────────────
let _completionRingInst = null;
function _buildCompletionRing(pct) {
    const ctx = document.getElementById('completionRingChart');
    if (!ctx) return;
    if (_completionRingInst) { _completionRingInst.destroy(); _completionRingInst = null; }
    _completionRingInst = new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [pct, 100 - pct],
                backgroundColor: ['rgba(16,185,129,0.85)', 'rgba(255,255,255,0.05)'],
                borderColor: 'transparent',
                borderWidth: 0,
            }]
        },
        options: {
            responsive: false,
            cutout: '76%',
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            animation: { duration: 900, easing: 'easeInOutQuart' }
        }
    });
}

// ── Timeline chart: projects created per month ─────────────────────────────────
let _timelineChartInst = null;
function _buildTimelineChart(projs) {
    const ctx = document.getElementById('timelineChart');
    if (!ctx) return;
    if (_timelineChartInst) { _timelineChartInst.destroy(); _timelineChartInst = null; }

    // Build monthly buckets for the last 8 months
    const months = [];
    const counts = [];
    const now = new Date();
    for (let i = 7; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push(d.toLocaleString('en-US', { month: 'short', year: '2-digit' }));
        const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
        counts.push(projs.filter(p => {
            if (!p.createdAt) return false;
            const c = new Date(p.createdAt);
            return c >= d && c < next;
        }).length);
    }

    const gradCtx = ctx.getContext('2d');
    const grad = gradCtx.createLinearGradient(0, 0, 0, 200);
    grad.addColorStop(0, 'rgba(139,92,246,0.3)');
    grad.addColorStop(1, 'rgba(139,92,246,0)');

    _timelineChartInst = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: months,
            datasets: [{
                label: 'Projects',
                data: counts,
                backgroundColor: counts.map((_, i) => i === counts.length - 1 ? 'rgba(139,92,246,0.9)' : 'rgba(139,92,246,0.45)'),
                borderColor: 'transparent',
                borderRadius: 5,
                borderSkipped: false,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#0d1424',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    titleColor: '#f1f5f9',
                    bodyColor: '#94a3b8',
                    padding: 10,
                    callbacks: { label: c => ` ${c.parsed.y} project${c.parsed.y !== 1 ? 's' : ''}` }
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 11 } }, border: { color: 'rgba(255,255,255,0.07)' } },
                y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#64748b', font: { size: 11 }, stepSize: 1, callback: v => Number.isInteger(v) ? v : '' }, border: { color: 'rgba(255,255,255,0.07)' }, beginAtZero: true }
            }
        }
    });
}

// ── Style radar chart ─────────────────────────────────────────────────────────
let _styleRadarInst = null;
function _buildStyleRadarChart(projs) {
    const ctx = document.getElementById('styleRadarChart');
    if (!ctx) return;
    if (_styleRadarInst) { _styleRadarInst.destroy(); _styleRadarInst = null; }

    const styleKeys = ['modern', 'minimalist', 'traditional', 'luxury'];
    const labels    = ['Modern', 'Minimalist', 'Traditional', 'Luxury'];
    const counts    = styleKeys.map(s => projs.filter(p => p.style === s).length);

    _styleRadarInst = new Chart(ctx, {
        type: 'radar',
        data: {
            labels,
            datasets: [{
                label: 'Projects',
                data: counts,
                backgroundColor: 'rgba(0,212,200,0.15)',
                borderColor: 'rgba(0,212,200,0.8)',
                pointBackgroundColor: '#00d4c8',
                pointBorderColor: '#0d1424',
                pointBorderWidth: 2,
                pointRadius: 4,
                borderWidth: 2,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#0d1424',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    titleColor: '#f1f5f9',
                    bodyColor: '#94a3b8',
                    padding: 10,
                }
            },
            scales: {
                r: {
                    grid: { color: 'rgba(255,255,255,0.07)' },
                    angleLines: { color: 'rgba(255,255,255,0.07)' },
                    pointLabels: { color: '#94a3b8', font: { size: 11 } },
                    ticks: { display: false, stepSize: 1 },
                    beginAtZero: true,
                }
            }
        }
    });
}

// ── Reviews loader ─────────────────────────────────────────────────────────────
async function _loadAllReviews(projs) {
    const listEl = document.getElementById('reviewsList');
    const distEl = document.getElementById('ratingDistribution');
    const distBarsEl = document.getElementById('ratingDistBars');
    const badgeEl = document.getElementById('overallRatingBadge');
    const overallValEl = document.getElementById('overallRatingVal');
    const overallCntEl = document.getElementById('overallRatingCount');
    const avgStatEl = document.getElementById('avgRatingStat');
    if (!listEl) return;

    if (!projs.length) {
        listEl.innerHTML = '<div style="text-align:center;padding:2rem;color:#475569;font-size:0.82rem;">No projects yet — reviews will appear here.</div>';
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const headers = token ? { 'Authorization': 'Bearer ' + token } : {};
        const allReviews = [];

        // Fetch reviews for all projects in parallel
        await Promise.all(projs.map(async p => {
            try {
                const res  = await fetch('http://localhost:5000/api/reviews/' + p._id, { headers });
                const data = await res.json();
                if (data.success && data.data?.reviews?.length) {
                    data.data.reviews.forEach(r => {
                        allReviews.push({ ...r, projectName: p.name, projectId: p._id });
                    });
                }
            } catch (e) {}
        }));

        if (!allReviews.length) {
            listEl.innerHTML = '<div style="text-align:center;padding:2rem;color:#475569;font-size:0.82rem;"><i class="fas fa-comment-slash" style="display:block;font-size:1.5rem;margin-bottom:0.5rem;color:#334155;"></i>No client reviews yet</div>';
            if (badgeEl) badgeEl.style.display = 'none';
            if (distEl) distEl.style.display = 'none';
            return;
        }

        // Compute overall stats
        const totalRev  = allReviews.length;
        const sumRating = allReviews.reduce((s, r) => s + (r.rating || 0), 0);
        const avgRating = (sumRating / totalRev).toFixed(1);

        // Update KPI avg rating
        if (avgStatEl) avgStatEl.textContent = avgRating;
        if (badgeEl) { badgeEl.style.display = 'block'; }
        if (overallValEl) overallValEl.textContent = avgRating;
        if (overallCntEl) overallCntEl.textContent = totalRev + ' review' + (totalRev !== 1 ? 's' : '');

        // Rating distribution bars (5→1)
        if (distEl && distBarsEl) {
            distEl.style.display = 'block';
            distBarsEl.innerHTML = [5,4,3,2,1].map(star => {
                const cnt = allReviews.filter(r => r.rating === star).length;
                const pct = totalRev > 0 ? (cnt / totalRev) * 100 : 0;
                const color = star >= 4 ? '#10b981' : star === 3 ? '#f59e0b' : '#ef4444';
                return `<div style="display:flex;align-items:center;gap:0.5rem;">
                    <span style="font-size:0.7rem;color:#94a3b8;width:14px;text-align:right;">${star}</span>
                    <i class="fas fa-star" style="font-size:0.6rem;color:${color};flex-shrink:0;"></i>
                    <div style="flex:1;height:7px;border-radius:4px;background:rgba(255,255,255,0.06);overflow:hidden;">
                        <div style="height:100%;border-radius:4px;background:${color};width:${pct.toFixed(1)}%;transition:width 0.8s ease;"></div>
                    </div>
                    <span style="font-size:0.68rem;color:#64748b;min-width:22px;">${cnt}</span>
                </div>`;
            }).join('');
        }

        // Sort by newest first
        allReviews.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

        // Render review cards
        listEl.innerHTML = allReviews.map(r => {
            const stars = '★'.repeat(r.rating || 0) + '☆'.repeat(5 - (r.rating || 0));
            const starColor = (r.rating || 0) >= 4 ? '#f59e0b' : (r.rating || 0) >= 3 ? '#94a3b8' : '#ef4444';
            const avatarUrl = r.reviewer?.avatar
                ? r.reviewer.avatar
                : 'https://ui-avatars.com/api/?name=' + encodeURIComponent(r.reviewer?.name || 'C') + '&background=8b5cf6&color=fff&bold=true&size=40';
            const timeStr = r.createdAt
                ? new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : '';
            return `<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:0.85rem;display:flex;gap:0.75rem;transition:background 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='rgba(255,255,255,0.03)'">
                <img src="${avatarUrl}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;flex-shrink:0;" onerror="this.src='https://ui-avatars.com/api/?name=C&background=8b5cf6&color=fff&bold=true&size=40'">
                <div style="flex:1;min-width:0;">
                    <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.25rem;">
                        <span style="font-size:0.82rem;font-weight:700;color:#e2e8f0;">${r.reviewer?.name || 'Anonymous'}</span>
                        <span style="font-size:0.68rem;color:#475569;">·</span>
                        <span style="font-size:0.7rem;color:#64748b;">${r.projectName || ''}</span>
                        <span style="font-size:0.68rem;color:#475569;margin-left:auto;">${timeStr}</span>
                    </div>
                    <div style="color:${starColor};font-size:0.8rem;letter-spacing:1px;margin-bottom:0.35rem;">${stars}</div>
                    ${r.comment ? `<p style="font-size:0.78rem;color:#94a3b8;margin:0;line-height:1.55;">${r.comment}</p>` : ''}
                </div>
            </div>`;
        }).join('');

    } catch (err) {
        listEl.innerHTML = '<div style="text-align:center;padding:2rem;color:#475569;font-size:0.82rem;">Could not load reviews.</div>';
    }
}

async function loadUserProfile() {
    try {
        const data = await api.getProfile();
        const user = data.user;

        // ── Persist full profile to localStorage so overview & forms always have fresh data ──
        try {
            const stored = JSON.parse(localStorage.getItem('user') || '{}');
            const merged = Object.assign(stored, {
                id:             user.id             || user._id,
                name:           user.name           || '',
                email:          user.email          || '',
                role:           user.role           || '',
                company:        user.company        || '',
                phone:          user.phone          || '',
                avatar:         user.avatar         || stored.avatar || '',
                bio:            user.bio            || '',
                location:       user.location       || '',
                specialization: user.specialization || '',
                experience:     user.experience     != null ? user.experience : 0,
                rating:         user.rating         || 0,
                portfolio:      user.portfolio      || [],
                totalProjects:  user.totalProjects  || 0,
                plan:           user.plan,
                planExpiresAt:  user.planExpiresAt,
                preferences:    user.preferences    || stored.preferences,
                emailVerified:  user.emailVerified
            });
            localStorage.setItem('user', JSON.stringify(merged));
        } catch (e) { /* ignore */ }

        const el = id => document.getElementById(id);
        if (el('profileName'))    el('profileName').value    = user.name    || '';
        if (el('profileEmail'))   el('profileEmail').value   = user.email   || '';
        if (el('profileCompany')) el('profileCompany').value = user.company || '';
        if (el('profilePhone'))   el('profilePhone').value   = user.phone   || '';

        // Also populate professional fields if they exist in the DOM
        if (el('profileLocation'))       el('profileLocation').value       = user.location       || '';
        if (el('profileSpecialization')) el('profileSpecialization').value = user.specialization || '';
        if (el('profileExperience'))     el('profileExperience').value     = user.experience != null ? user.experience : '';
        if (el('profileBio'))            el('profileBio').value            = user.bio            || '';

        // Sync overview tab
        if (window.populateProfileOverview) populateProfileOverview();
        // Sync professional form
        if (window.loadProfessionalInfoForm) loadProfessionalInfoForm();
    } catch (error) {
        console.error('Failed to load profile:', error);
    }
}

async function updateProfile(event) {
    event.preventDefault();
    const profileData = {
        name:    document.getElementById('profileName').value,
        email:   document.getElementById('profileEmail').value,
        company: document.getElementById('profileCompany').value,
        phone:   document.getElementById('profilePhone').value,
    };
    try {
        showLoading('Updating profile...');
        await api.updateProfile(profileData);
        // Update cached user name
        const userStr = localStorage.getItem('user');
        if (userStr) {
            try {
                const user = JSON.parse(userStr);
                Object.assign(user, profileData);
                localStorage.setItem('user', JSON.stringify(user));
            } catch (e) { /* ignore */ }
        }
        hideLoading();
        showToast('Profile updated!', 'success');
        // Re-fetch full profile so localStorage and overview are in sync
        await loadUserProfile();
        loadUserInfo();
        // Navigate to Overview tab to show updated data
        if (typeof switchToOverviewTab === 'function') switchToOverviewTab();
    } catch (error) {
        hideLoading();
        showToast(error.message || 'Update failed', 'error');
    }
}

// Close modals on backdrop click
document.addEventListener('click', function (e) {
    if (e.target.classList.contains('modal')) e.target.style.display = 'none';
});

function initPasswordValidation() {
    newPasswordEl = document.getElementById("newPassword");
    confirmPasswordEl = document.getElementById("confirmPassword");

    if (!newPasswordEl || !confirmPasswordEl) return;

    function checkMatch() {
        const newVal = newPasswordEl.value;
        const confirmVal = confirmPasswordEl.value;

        confirmPasswordEl.classList.remove("input-success", "input-error");

        if (confirmVal === "") return;

        if (newVal === confirmVal) {
            confirmPasswordEl.classList.add("input-success"); // ✅ green
        } else {
            confirmPasswordEl.classList.add("input-error"); // ❌ red
        }
    }

    newPasswordEl.addEventListener("input", checkMatch);
    confirmPasswordEl.addEventListener("input", checkMatch);
}
// ═══════════════════════════════════════════════════════════════════════════════
// SUPPORT CHAT SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════


const TICKET_API = 'http://localhost:5000/api/tickets';
let chatState = {
    tickets: [],
    activeId: null,
    composing: false
};

// ── Auth header helper ────────────────────────────────────────────────────────
function chatHeaders() {
    const token = localStorage.getItem('token');
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
}

// ── Get user data from localStorage (set on login) ───────────────────────────
function getChatUser() {
    try {
        const raw = localStorage.getItem('user');
        return raw ? JSON.parse(raw) : {};
    } catch(e) { return {}; }
}

// ── Unread badge polling ──────────────────────────────────────────────────────
function startUserTicketPolling() {
    pollUserUnread();
    setInterval(pollUserUnread, 60000);
}

async function pollUserUnread() {
    try {
        const res = await fetch(`${TICKET_API}/my/unread`, { headers: chatHeaders() });
        if (!res.ok) return;
        const data = await res.json();
        const badge = document.getElementById('userMsgBadge');
        if (!badge) return;
        if (data.count > 0) {
            badge.textContent = data.count;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    } catch(e) {}
}

// ── Load tickets and render sidebar list ─────────────────────────────────────
async function loadUserTickets() {
    const listEl = document.getElementById('chatThreadList');
    if (!listEl) return;
    listEl.innerHTML = '<div class="chat-list-loading"><i class="fas fa-spinner fa-spin"></i></div>';

    try {
        const res = await fetch(`${TICKET_API}/my`, { headers: chatHeaders() });
        const data = await res.json();
        if (!data.success) { listEl.innerHTML = '<div class="chat-list-empty"><i class="fas fa-exclamation-circle"></i><p>Failed to load</p></div>'; return; }

        chatState.tickets = data.tickets;
        renderChatList();

        // Clear unread badge
        const badge = document.getElementById('userMsgBadge');
        if (badge) badge.style.display = 'none';

        // If coming back to an active ticket, refresh it
        if (chatState.activeId) {
            const t = chatState.tickets.find(t => t._id === chatState.activeId);
            if (t) renderThreadView(t);
        }
    } catch(e) {
        listEl.innerHTML = '<div class="chat-list-empty"><i class="fas fa-wifi"></i><p>Network error</p></div>';
    }
}

function renderChatList() {
    const listEl = document.getElementById('chatThreadList');
    if (!listEl) return;

    if (!chatState.tickets.length) {
        listEl.innerHTML = `<div class="chat-list-empty">
            <i class="fas fa-comment-slash"></i>
            <p>No conversations yet.<br>Tap the pencil to start one.</p>
        </div>`;
        return;
    }

    const statusColors = { new: '#f59e0b', seen: '#3b82f6', replied: '#10b981', closed: '#64748b' };

    listEl.innerHTML = chatState.tickets.map(t => {
        const unread  = !t.userRead && t.replies.length > 0;
        const color   = statusColors[t.status] || '#64748b';
        const preview = t.replies.length
            ? t.replies[t.replies.length - 1].message
            : t.message;
        const time = relativeTime(t.updatedAt || t.createdAt);
        const isActive = t._id === chatState.activeId;

        return `<div class="chat-list-item ${unread ? 'unread' : ''} ${isActive ? 'active' : ''}"
            onclick="openChatThread('${t._id}')" data-tid="${t._id}">
            <div class="chat-list-item-subject">
                ${unread ? '<span class="chat-unread-dot"></span>' : ''}
                ${escHtml(t.subject)}
            </div>
            <div class="chat-list-item-meta">
                <span class="chat-list-item-preview">${escHtml(preview.slice(0, 55))}${preview.length > 55 ? '…' : ''}</span>
                <span class="chat-list-time">${time}</span>
            </div>
            <span class="chat-status-pill" style="background:${color}22;color:${color};border:1px solid ${color}44;">${t.status}</span>
        </div>`;
    }).join('');
}

// ── Open a thread ─────────────────────────────────────────────────────────────
function openChatThread(id) {
    chatState.activeId = id;
    const ticket = chatState.tickets.find(t => t._id === id);
    if (!ticket) return;

    // Update sidebar active state
    document.querySelectorAll('.chat-list-item').forEach(el => el.classList.remove('active'));
    const item = document.querySelector(`.chat-list-item[data-tid="${id}"]`);
    if (item) item.classList.add('active');

    hideComposePanel(false);
    renderThreadView(ticket);
}

function renderThreadView(ticket) {
    const emptyEl   = document.getElementById('chatEmptyState');
    const composeEl = document.getElementById('chatComposePanel');
    const threadEl  = document.getElementById('chatThreadView');
    if (emptyEl)   emptyEl.style.display   = 'none';
    if (composeEl) composeEl.style.display = 'none';
    if (threadEl)  threadEl.style.display  = 'flex';

    // Header
    const statusColors = { new: '#f59e0b', seen: '#3b82f6', replied: '#10b981', closed: '#64748b' };
    const color = statusColors[ticket.status] || '#64748b';
    const subjectEl = document.getElementById('chatThreadSubject');
    const metaEl    = document.getElementById('chatThreadMeta');
    const statusEl  = document.getElementById('chatThreadStatus');
    if (subjectEl) subjectEl.textContent = ticket.subject;
    if (metaEl)    metaEl.textContent    = `${ticket.category} · ${new Date(ticket.createdAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}`;
    if (statusEl)  statusEl.innerHTML    = `<span class="chat-status-pill" style="background:${color}22;color:${color};border:1px solid ${color}44;">${ticket.status}</span>`;

    // Show/hide reply box vs closed notice
    const replyBox     = document.getElementById('chatReplyBox');
    const closedNotice = document.getElementById('chatClosedNotice');
    if (ticket.status === 'closed') {
        if (replyBox)     replyBox.style.display     = 'none';
        if (closedNotice) closedNotice.style.display = 'flex';
    } else {
        if (replyBox)     replyBox.style.display     = 'flex';
        if (closedNotice) closedNotice.style.display = 'none';
    }

    // Build messages
    const allMsgs = [
        { sender: 'user', senderName: ticket.name, message: ticket.message, createdAt: ticket.createdAt },
        ...ticket.replies
    ];

    const msgsEl = document.getElementById('chatMessages');
    if (msgsEl) {
        msgsEl.innerHTML = allMsgs.map(msg => {
            const isAdmin = msg.sender === 'admin';
            const rowClass = isAdmin ? 'from-admin' : 'from-user';
            const senderLabel = isAdmin ? '🛡 SmartArch Support' : '👤 You';
            const time = new Date(msg.createdAt).toLocaleString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
            return `<div class="chat-bubble-row ${rowClass}">
                <span class="chat-bubble-sender">${senderLabel}</span>
                <div class="chat-bubble">${escHtml(msg.message)}</div>
                <span class="chat-bubble-time">${time}</span>
            </div>`;
        }).join('');
        // Scroll to bottom
        setTimeout(() => { msgsEl.scrollTop = msgsEl.scrollHeight; }, 30);
    }
}

// ── Compose Panel ─────────────────────────────────────────────────────────────
function showComposePanel() {
    chatState.composing = true;

    // Hide other panels
    const emptyEl  = document.getElementById('chatEmptyState');
    const threadEl = document.getElementById('chatThreadView');
    const composeEl= document.getElementById('chatComposePanel');
    if (emptyEl)   emptyEl.style.display   = 'none';
    if (threadEl)  threadEl.style.display  = 'none';
    if (composeEl) composeEl.style.display = 'flex';

    // Deselect active thread
    document.querySelectorAll('.chat-list-item').forEach(el => el.classList.remove('active'));
    chatState.activeId = null;

    // Auto-fill from user session — user can edit before sending
    const user = getChatUser();
    const nameEl    = document.getElementById('composeFrom');
    const emailEl   = document.getElementById('composeEmail');
    const companyEl = document.getElementById('composeCompany');

    if (nameEl    && !nameEl.value)    nameEl.value    = user.name    || '';
    if (emailEl   && !emailEl.value)   emailEl.value   = user.email   || '';
    if (companyEl && !companyEl.value) companyEl.value = user.company || '';

    // Wire char counter
    const msgEl = document.getElementById('composeMessage');
    const cntEl = document.getElementById('composeCharCount');
    if (msgEl && cntEl) {
        msgEl.oninput = () => { cntEl.textContent = msgEl.value.length; };
        msgEl.value = '';
        cntEl.textContent = '0';
    }

    // Focus subject
    setTimeout(() => { const s = document.getElementById('composeSubject'); if (s) s.focus(); }, 80);
}

function hideComposePanel(showEmpty = true) {
    chatState.composing = false;
    const composeEl = document.getElementById('chatComposePanel');
    const emptyEl   = document.getElementById('chatEmptyState');
    const threadEl  = document.getElementById('chatThreadView');
    if (composeEl) composeEl.style.display = 'none';
    if (showEmpty && !chatState.activeId) {
        if (emptyEl)  emptyEl.style.display  = 'flex';
        if (threadEl) threadEl.style.display = 'none';
    }
}

async function submitComposeForm() {
    const name     = (document.getElementById('composeFrom')?.value || '').trim();
    const email    = (document.getElementById('composeEmail')?.value || '').trim();
    const company  = (document.getElementById('composeCompany')?.value || '').trim();
    const subject  = document.getElementById('composeSubject')?.value || '';
    const category = subject; // subject IS the category now
    const message  = (document.getElementById('composeMessage')?.value || '').trim();

    // Validate
    const errs = [];
    if (!name)                                             errs.push('Name is required.');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.push('Valid email is required.');
    if (!subject)  errs.push('Please select a subject.');
    if (!message || message.length < 10)                   errs.push('Message must be at least 10 characters.');
    if (errs.length) { showDashToast(errs[0], 'error'); return; }

    const btn = document.getElementById('composeSendBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending…'; }

    try {
        const res = await fetch(TICKET_API, {
            method: 'POST',
            headers: chatHeaders(),
            body: JSON.stringify({ name, email, company, subject, category, message })
        });
        const data = await res.json();
        if (data.success) {
            showDashToast('Message sent! We\'ll reply soon.', 'success');
            // Clear form
            ['composeSubject','composeMessage'].forEach(id => {
                const el = document.getElementById(id); if (el) el.value = '';
            });
            const cntEl = document.getElementById('composeCharCount');
            if (cntEl) cntEl.textContent = '0';
            // Reload and show new ticket
            await loadUserTickets();
            // Open the newest ticket (first in list)
            if (chatState.tickets.length) openChatThread(chatState.tickets[0]._id);
        } else {
            showDashToast(data.message || 'Failed to send.', 'error');
        }
    } catch(e) {
        showDashToast('Network error. Please try again.', 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Message'; }
    }
}

// ── User reply inside thread ──────────────────────────────────────────────────
async function submitUserReply() {
    const inputEl = document.getElementById('chatReplyInput');
    const message = (inputEl?.value || '').trim();
    if (!message) return;

    const ticket = chatState.tickets.find(t => t._id === chatState.activeId);
    if (!ticket) return;

    const btn = document.querySelector('.chat-reply-send');
    if (btn) btn.disabled = true;

    try {
        // We use the same submit endpoint but append to existing ticket as a follow-up
        // Create a new ticket is intentional UX for follow-ups, but here we send to admin via a new ticket
        // Actually, for a "reply" from user's side we need to POST a new ticket with a reference
        // or we post the message as a new ticket with subject "Re: <original>"
        // Best UX: POST /api/tickets with subject "Re: original" and link
        const user    = getChatUser();
        const subject = ticket.subject.startsWith('Re: ') ? ticket.subject : `Re: ${ticket.subject}`;
        const res = await fetch(TICKET_API, {
            method: 'POST',
            headers: chatHeaders(),
            body: JSON.stringify({
                name: user.name || ticket.name,
                email: user.email || ticket.email,
                company: user.company || ticket.company || '',
                subject,
                category: ticket.category,
                message
            })
        });
        const data = await res.json();
        if (data.success) {
            if (inputEl) inputEl.value = '';
            await loadUserTickets();
            // Open the new ticket
            if (chatState.tickets.length) openChatThread(chatState.tickets[0]._id);
        } else {
            showDashToast(data.message || 'Failed to send reply.', 'error');
        }
    } catch(e) {
        showDashToast('Network error.', 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
}

function handleReplyKeydown(e) {
    // Enter sends, Shift+Enter adds newline
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submitUserReply();
    }
}

// ── Mobile: show list ─────────────────────────────────────────────────────────
function showChatListOnMobile() {
    chatState.activeId = null;
    const threadEl  = document.getElementById('chatThreadView');
    const composeEl = document.getElementById('chatComposePanel');
    const emptyEl   = document.getElementById('chatEmptyState');
    const sidebar   = document.getElementById('chatSidebar');
    if (threadEl)  threadEl.style.display  = 'none';
    if (composeEl) composeEl.style.display = 'none';
    if (emptyEl)   emptyEl.style.display   = 'flex';
    if (sidebar)   { sidebar.classList.add('mobile-visible'); }
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function escHtml(str) {
    return String(str)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function relativeTime(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)   return 'just now';
    if (mins < 60)  return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)   return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7)   return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function showDashToast(message, type = 'info') {
    // Try using existing toast system
    if (typeof showToast === 'function') { showToast(message, type); return; }
    const container = document.getElementById('toastContainer') || document.body;
    const colors = { success: '#10b981', error: '#ef4444', info: '#3b82f6' };
    const toast = document.createElement('div');
    toast.style.cssText = `position:fixed;bottom:1.5rem;right:1.5rem;z-index:9999;background:#0d1424;border:1px solid rgba(255,255,255,0.1);border-left:3px solid ${colors[type]||colors.info};border-radius:10px;padding:0.875rem 1.25rem;color:#f1f5f9;font-size:0.875rem;min-width:260px;box-shadow:0 20px 40px rgba(0,0,0,0.4);animation:slideInRight 0.3s ease;`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; setTimeout(() => toast.remove(), 300); }, 3500);
}

// ── Start polling ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => { startUserTicketPolling(); });

// ── Expose globals ────────────────────────────────────────────────────────────
window.loadUserTickets     = loadUserTickets;
window.openChatThread      = openChatThread;
window.showComposePanel    = showComposePanel;
window.hideComposePanel    = hideComposePanel;
window.submitComposeForm   = submitComposeForm;
window.submitUserReply     = submitUserReply;
window.handleReplyKeydown  = handleReplyKeydown;
window.showChatListOnMobile= showChatListOnMobile;
window.toggleTicketThread  = function(){};
// ═══════════════════════════════════════════════════════════════════════════════
// ARCHITECT — CLIENT CONNECTIONS FEATURE
// ═══════════════════════════════════════════════════════════════════════════════

const CONN_API = 'http://localhost:5000/api/connections';

function connHeaders() {
    const token = localStorage.getItem('token');
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
}

let activeArchChatId   = null;
let archChatPollTimer  = null;

// ── Load all connections for this architect ───────────────────────────────────
async function loadArchConnections() {
    const body = document.getElementById('archConnectionsBody');
    if (!body) return;
    body.innerHTML = '<div style="text-align:center;padding:3rem;color:#94a3b8"><i class="fas fa-spinner fa-spin" style="font-size:1.5rem"></i><div style="margin-top:1rem">Loading requests...</div></div>';

    try {
        const res  = await fetch(`${CONN_API}/my`, { headers: connHeaders() });
        const data = await res.json();
        if (!data.success) throw new Error();
        window._archConnectionsCache = data.data;
        renderArchConnections(data.data);
        updateArchConnBadge(data.data);
        // Seed status tracker so pollArchConnBadge doesn't false-fire on first poll
        if (typeof _lastKnownProjectStatuses !== 'undefined') {
            (data.data || []).forEach(conn => {
                if (conn.architectProject?._id) {
                    _lastKnownProjectStatuses[String(conn.architectProject._id)] = conn.architectProject.status;
                }
            });
        }
    } catch (e) {
        body.innerHTML = '<div style="text-align:center;padding:3rem;color:#f43f5e"><i class="fas fa-exclamation-circle" style="font-size:1.5rem"></i><div style="margin-top:1rem">Could not load connections.</div></div>';
    }
}
/* ── Connection Section Tabs ─────────────────────────────────────────── */
function switchConnTab(tab) {
    const activeTab   = document.getElementById('connTab-active');
    const historyTab  = document.getElementById('connTab-history');
    const activeBody  = document.getElementById('archConnectionsBody');
    const historyBody = document.getElementById('archHistoryBody');
    if (!activeTab || !historyTab) return;

    const activeSel   = 'background:linear-gradient(135deg,rgba(139,92,246,0.25),rgba(0,212,200,0.15));color:#f1f5f9;border:1px solid rgba(139,92,246,0.3);';
    const inactiveSel = 'background:transparent;color:#64748b;border:1px solid transparent;';

    if (tab === 'active') {
        activeTab.style.cssText  += activeSel;
        historyTab.style.cssText += inactiveSel;
        activeBody.style.display  = '';
        historyBody.style.display = 'none';
 } else {
        historyTab.style.cssText  += activeSel;
        activeTab.style.cssText   += inactiveSel;
        activeBody.style.display  = 'none';
        historyBody.style.display = '';
        // Always fetch fresh data for history
        historyBody.innerHTML = '<div style="text-align:center;padding:3rem;color:#94a3b8"><i class="fas fa-spinner fa-spin" style="font-size:1.5rem"></i><div style="margin-top:1rem">Loading history...</div></div>';
        fetch(`${CONN_API}/my`, { headers: connHeaders() })
            .then(r => r.json())
            .then(d => {
                if (d.success) {
                    window._archConnectionsCache = d.data;
                    renderArchHistory(d.data);
                }
            })
            .catch(() => {
                historyBody.innerHTML = '<div style="text-align:center;padding:3rem;color:#f43f5e">Could not load history.</div>';
            });
    }
}

function renderArchHistory(conns) {
    const body = document.getElementById('archHistoryBody');
    if (!body) return;

    // Completed: accepted connections where architect's shared project is 'approved'
    // Also catches connections with no architectProject but whose additionalProjects are approved
    const completed = conns.filter(c => {
        if (c.status !== 'accepted') return false;
        if (c.architectProject && c.architectProject.status === 'approved') return true;
        // Check additional projects too
        if (c.additionalProjects && c.additionalProjects.some(ap =>
            ap.architectProject && ap.architectProject.status === 'approved')) return true;
        return false;
    });

    // Rejected: connections the architect declined
    const rejected = conns.filter(c => c.status === 'rejected');

    if (!completed.length && !rejected.length) {
        body.innerHTML = `
        <div style="text-align:center;padding:4rem 2rem;color:#94a3b8">
            <i class="fas fa-history" style="font-size:2.5rem;color:rgba(139,92,246,0.3);display:block;margin-bottom:1rem"></i>
            <div style="font-size:1.1rem;font-weight:700;color:#f1f5f9;margin-bottom:0.5rem">No history yet</div>
            <div style="font-size:0.875rem">Completed and declined projects will appear here.</div>
        </div>`;
        return;
    }

    const fmtDate = iso => {
        if (!iso) return '—';
        return new Date(iso).toLocaleString('en-IN', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
    };

    const getApprovedAt = (proj) => {
        if (!proj || !proj.statusHistory) return null;
        const entry = [...proj.statusHistory].reverse().find(h => h.status === 'approved');
        return entry ? entry.changedAt : null;
    };

    const sectionTitle = (icon, label, color) => `
        <div style="display:flex;align-items:center;gap:0.5rem;margin:1.25rem 0 0.75rem;font-size:0.7rem;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:${color};">
            <i class="fas ${icon}" style="font-size:0.65rem;"></i>${label}
        </div>`;

    const card = (icon, iconColor, bg, border, rows) => `
        <div style="background:${bg};border:1px solid ${border};border-radius:12px;padding:0.9rem 1.1rem;margin-bottom:0.65rem;display:flex;gap:0.85rem;align-items:flex-start;">
            <div style="width:36px;height:36px;border-radius:9px;background:rgba(255,255,255,0.04);border:1px solid ${border};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                <i class="fas ${icon}" style="color:${iconColor};font-size:0.85rem;"></i>
            </div>
            <div style="min-width:0;flex:1;">${rows}</div>
        </div>`;

    let html = '';

    if (completed.length) {
        html += sectionTitle('fa-check-circle', 'Completed Projects', '#10b981');
        completed.forEach(c => {
            const client = c.client || {};

            // Collect all completed project entries from this connection
            const completedProjects = [];
            if (c.architectProject && c.architectProject.status === 'approved') {
                completedProjects.push({ proj: c.architectProject, label: c.projectName || 'Primary Project' });
            }
            (c.additionalProjects || []).forEach(ap => {
                if (ap.architectProject && ap.architectProject.status === 'approved') {
                    completedProjects.push({ proj: ap.architectProject, label: ap.projectName || 'Additional Project' });
                }
            });

            completedProjects.forEach(({ proj, label }) => {
                const approvedAt = getApprovedAt(proj);
                html += card('fa-check-circle', '#10b981', 'rgba(16,185,129,0.05)', 'rgba(16,185,129,0.18)', `
                    <div style="font-weight:700;font-size:0.88rem;color:#f1f5f9;margin-bottom:0.15rem;">${escHtml(proj.name || label)}</div>
                    <div style="font-size:0.75rem;color:#94a3b8;margin-bottom:0.3rem;">
                        <i class="fas fa-user" style="font-size:0.65rem;margin-right:0.3rem;color:#64748b;"></i>${escHtml(client.name || client.email || 'Client')}
                    </div>
                    <div style="display:flex;gap:1rem;flex-wrap:wrap;">
                        <span style="font-size:0.7rem;color:#10b981;display:flex;align-items:center;gap:0.25rem;">
                            <i class="fas fa-calendar-check" style="font-size:0.62rem;"></i> Completed ${fmtDate(approvedAt)}
                        </span>
                        ${proj.type ? `<span style="font-size:0.7rem;color:#64748b;display:flex;align-items:center;gap:0.25rem;"><i class="fas fa-tag" style="font-size:0.62rem;"></i> ${escHtml(proj.type)}</span>` : ''}
                    </div>`);
            });
        });
    }

    if (rejected.length) {
        html += sectionTitle('fa-times-circle', 'Declined Requests', '#f43f5e');
        rejected.forEach(c => {
            const client = c.client || {};
            html += card('fa-times-circle', '#f43f5e', 'rgba(244,63,94,0.04)', 'rgba(244,63,94,0.18)', `
                <div style="font-weight:700;font-size:0.88rem;color:#f1f5f9;margin-bottom:0.15rem;">${escHtml(client.name || client.email || 'Client')}</div>
                <div style="font-size:0.75rem;color:#94a3b8;margin-bottom:0.3rem;">${escHtml(c.projectName || 'No project specified')}</div>
                <div style="display:flex;gap:1rem;flex-wrap:wrap;">
                    <span style="font-size:0.7rem;color:#f43f5e;display:flex;align-items:center;gap:0.25rem;">
                        <i class="fas fa-calendar-times" style="font-size:0.62rem;"></i> Declined ${fmtDate(c.updatedAt)}
                    </span>
                    ${c.introMessage ? `<span style="font-size:0.7rem;color:#64748b;font-style:italic;">"${escHtml(c.introMessage.slice(0,60))}${c.introMessage.length>60?'…':''}"</span>` : ''}
                </div>`);
        });
    }

    body.innerHTML = html;
}
window.switchConnTab   = switchConnTab;
window.renderArchHistory = renderArchHistory;

function updateArchConnBadge(conns) {
    const badge   = document.getElementById('archConnBadge');
    if (!badge) return;
    const pending = conns.filter(c => c.status === 'pending').length;
    const unread  = conns.filter(c => c.unreadByArchitect > 0 && c.status === 'accepted').length;
    const total   = pending + unread;
    if (total > 0) { badge.textContent = total; badge.style.display = 'inline-block'; }
    else             badge.style.display = 'none';
}

function renderArchConnections(conns) {
    const body = document.getElementById('archConnectionsBody');
    if (!body) return;

    if (!conns.length) {
        body.innerHTML = `<div style="text-align:center;padding:4rem 2rem;color:#94a3b8">
            <i class="fas fa-user-friends" style="font-size:2.5rem;color:rgba(139,92,246,0.3);display:block;margin-bottom:1rem"></i>
            <div style="font-size:1.1rem;font-weight:700;color:#f1f5f9;margin-bottom:0.5rem">No connection requests yet</div>
            <div style="font-size:0.875rem">Clients who want to work with you will appear here.</div>
        </div>`;
        return;
    }
    
    // Split into pending first, then accepted/rejected
  const pending  = conns.filter(c => c.status === 'pending');
    const twoDaysAgo = Date.now() - (2 * 24 * 60 * 60 * 1000);
    const accepted = conns.filter(c => {
        if (c.status !== 'accepted') return false;
        if (!c.architectProject || c.architectProject.status !== 'approved') return true;
        const history = c.architectProject.statusHistory || [];
        const approvedEntry = [...history].reverse().find(h => h.status === 'approved');
        if (!approvedEntry) return true;
        return new Date(approvedEntry.changedAt).getTime() > twoDaysAgo;
    }); 
    const ordered  = [...pending, ...accepted];
    // rejected go to History tab only

  // Expand connections: primary card + one card per additional project
    const allCards = [];
    ordered.forEach(c => {
        allCards.push(archConnCardHtml(c, null));   // primary card
        if (c.status === 'accepted' && c.additionalProjects && c.additionalProjects.length) {
            c.additionalProjects.forEach(ap => {
                allCards.push(archConnCardHtml(c, ap));  // additional project card
            });
        }
    });

    body.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:1.25rem;">
        ${allCards.join('')}
    </div>`;
}

function archConnCardHtml(c, additionalProject) {
    const client = c.client || {};
    const avatar = client.avatar ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(client.name || 'C')}&background=00d4c8&color=060a12&bold=true`;

    // ── Status chip ───────────────────────────────────────────────────────────
    const statusStyles = {
        pending:  { bg: 'rgba(245,158,11,0.12)',  color: '#f59e0b', border: 'rgba(245,158,11,0.3)',  label: 'Pending'   },
        accepted: { bg: 'rgba(16,185,129,0.12)',  color: '#10b981', border: 'rgba(16,185,129,0.3)',  label: 'Connected' },
        rejected: { bg: 'rgba(244,63,94,0.1)',    color: '#f43f5e', border: 'rgba(244,63,94,0.25)',  label: 'Declined'  },
    };
    const ss = statusStyles[c.status] || statusStyles.pending;
    const statusChip = `<span style="display:inline-block;font-size:0.68rem;font-weight:700;padding:2px 9px;border-radius:20px;text-transform:uppercase;letter-spacing:0.3px;background:${ss.bg};color:${ss.color};border:1px solid ${ss.border}">${ss.label}</span>`;

    // ── Project banner (thumbnail strip matching .project-thumbnail style) ────
   // Resolve display name & banner color based on whether this is an additional project card
    const isAdditional   = !!additionalProject;
    const displayName    = isAdditional ? additionalProject.projectName : c.projectName;
    const bannerGradient = isAdditional
        ? 'linear-gradient(135deg,rgba(0,212,200,0.13) 0%,rgba(139,92,246,0.08) 100%)'
        : 'linear-gradient(135deg,rgba(139,92,246,0.13) 0%,rgba(0,212,200,0.08) 100%)';
    const folderColor    = isAdditional ? '#00d4c8' : '#8b5cf6';
    const folderBorder   = isAdditional ? 'rgba(0,212,200,0.22)' : 'rgba(139,92,246,0.22)';
    const folderBg       = isAdditional ? 'rgba(0,212,200,0.12)' : 'rgba(139,92,246,0.12)';

    const proj = c.project || {};
    const projTypeLabel = isAdditional ? 'Additional Project' : (proj.type
        ? proj.type.charAt(0).toUpperCase() + proj.type.slice(1)
        : (c.projectName ? 'Project' : ''));
    const projectBanner = displayName ? `
        <div style="background:${bannerGradient};border-bottom:1px solid rgba(255,255,255,0.07);padding:0.75rem 1.1rem;display:flex;align-items:center;gap:0.6rem;">
            <div style="width:32px;height:32px;border-radius:8px;background:${folderBg};border:1px solid ${folderBorder};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                <i class="fas fa-folder-open" style="color:${folderColor};font-size:0.85rem;"></i>
            </div>
            <div style="min-width:0;">
                <div style="font-size:0.82rem;font-weight:700;color:#f1f5f9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(displayName)}</div>
                ${projTypeLabel ? `<div style="font-size:0.7rem;color:#64748b;text-transform:capitalize;">${escHtml(projTypeLabel)}</div>` : ''}
            </div>
            ${isAdditional ? `<span style="margin-left:auto;font-size:0.6rem;font-weight:700;padding:2px 7px;border-radius:20px;background:rgba(0,212,200,0.1);color:#00d4c8;border:1px solid rgba(0,212,200,0.2);white-space:nowrap;">+ Additional</span>` : `<i class="fas fa-chevron-right" style="margin-left:auto;color:#475569;font-size:0.7rem;flex-shrink:0;"></i>`}
        </div>` : '';

    // ── Description (intro message, 2-line clamp matching .project-info > p) ──
    const descHtml = c.introMessage ? `
        <div style="font-size:0.82rem;color:#64748b;line-height:1.5;margin:0.6rem 0 0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">
            <i class="fas fa-quote-left" style="font-size:0.6rem;color:rgba(139,92,246,0.4);margin-right:0.3rem;"></i>${escHtml(c.introMessage)}
        </div>` : '';

    // ── Online presence badge ─────────────────────────────────────────────────
    const clientLastSeen = (c.client || {}).lastSeen || null;
    const isOnlineConn   = typeof isOnline === 'function' ? isOnline(clientLastSeen) : false;
    const onlineDot = isOnlineConn
        ? `<span style="display:inline-flex;align-items:center;gap:3px;font-size:0.68rem;color:#10b981;margin-top:3px;"><span style="width:7px;height:7px;border-radius:50%;background:#10b981;box-shadow:0 0 5px #10b981;display:inline-block;flex-shrink:0;"></span>Online</span>`
        : `<span style="display:inline-flex;align-items:center;gap:3px;font-size:0.68rem;color:#64748b;margin-top:3px;"><span style="width:7px;height:7px;border-radius:50%;background:#475569;display:inline-block;flex-shrink:0;"></span>Offline</span>`;

    // ── Unread badge ──────────────────────────────────────────────────────────
    const unreadBadge = c.unreadByArchitect > 0
        ? `<span style="background:#ef4444;color:#fff;border-radius:20px;padding:1px 7px;font-size:0.68rem;font-weight:700;margin-left:0.35rem;">${c.unreadByArchitect} new</span>`
        : '';

   return `
    <div ${isAdditional ? `data-additional-project-id="${additionalProject.projectId}"` : ''}
        onclick="${isAdditional ? `openAdditionalProjectModal('${c._id}','${additionalProject.projectId}')` : `openConnDetailModal('${c._id}')`}"
        style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:var(--r-lg,14px);overflow:hidden;transition:all 0.25s cubic-bezier(0.22,1,0.36,1);cursor:pointer;position:relative;"
        onmouseover="this.style.transform='translateY(-4px)';this.style.borderColor='rgba(139,92,246,0.28)';this.style.background='rgba(139,92,246,0.04)';this.style.boxShadow='0 20px 60px rgba(0,0,0,0.4),0 0 30px rgba(139,92,246,0.06)';"
        onmouseout="this.style.transform='';this.style.borderColor='rgba(255,255,255,0.07)';this.style.background='rgba(255,255,255,0.04)';this.style.boxShadow='';">

        ${projectBanner}

        <div style="padding:1rem 1.1rem 1.1rem;">
            <!-- Client identity row -->
            <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.6rem;">
                <img src="${avatar}" alt="${escHtml(client.name)}"
                    style="width:44px;height:44px;border-radius:50%;object-fit:cover;border:2px solid rgba(139,92,246,0.3);flex-shrink:0;"
                    onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(client.name||'C')}&background=8b5cf6&color=fff&bold=true'">
                <div style="min-width:0;">
                    <div style="font-family:'Syne',sans-serif;font-weight:700;font-size:0.95rem;color:#f1f5f9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(client.name)}</div>
                    <div style="font-size:0.75rem;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(client.email || '')}</div>
                    ${onlineDot}
                </div>
                <div style="margin-left:auto;flex-shrink:0;">${statusChip}</div>
            </div>

            ${descHtml}

           ${c.status === 'accepted' && !isAdditional ? connStatusStepperHtml(c) : ''}
            ${c.status === 'accepted' && isAdditional ? additionalProjectStepperHtml(c, additionalProject) : ''}
            

            <!-- Click hint + action buttons row -->
            <div style="display:flex;align-items:center;gap:0.6rem;padding-top:0.875rem;border-top:1px solid rgba(255,255,255,0.07);">
                <span style="font-size:0.7rem;color:#475569;display:flex;align-items:center;gap:0.3rem;margin-right:auto;">
                    <i class="fas fa-expand-alt" style="font-size:0.6rem;"></i> Click to view details
                </span>
                ${c.status === 'pending' ? `
                <button onclick="event.stopPropagation();respondToConnection('${c._id}','accept')"
                    style="padding:0.45rem 0.9rem;background:linear-gradient(135deg,#10b981,#059669);color:#fff;font-weight:700;font-size:0.75rem;border:none;border-radius:8px;cursor:pointer;display:flex;align-items:center;gap:0.35rem;transition:all 0.2s;"
                    onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 4px 12px rgba(16,185,129,0.3)';"
                    onmouseout="this.style.transform='';this.style.boxShadow='';">
                    <i class="fas fa-check"></i> Accept
                </button>
                <button onclick="event.stopPropagation();respondToConnection('${c._id}','reject')"
                    style="padding:0.45rem 0.75rem;background:rgba(244,63,94,0.08);color:#f43f5e;font-weight:700;font-size:0.75rem;border:1px solid rgba(244,63,94,0.25);border-radius:8px;cursor:pointer;transition:all 0.2s;"
                    onmouseover="this.style.background='rgba(244,63,94,0.18)';"
                    onmouseout="this.style.background='rgba(244,63,94,0.08)';">
                    <i class="fas fa-times"></i>
                </button>` : c.status === 'accepted' ? `
                <button onclick="event.stopPropagation();openArchChatModal('${c._id}','${escHtml(client.name)}','${avatar}')"
                    style="padding:0.45rem 0.9rem;background:linear-gradient(135deg,#10b981,#059669);color:#fff;font-weight:700;font-size:0.75rem;border:none;border-radius:8px;cursor:pointer;display:flex;align-items:center;gap:0.35rem;transition:all 0.2s;"
                    onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 4px 12px rgba(16,185,129,0.3)';"
                    onmouseout="this.style.transform='';this.style.boxShadow='';">
                    <i class="fas fa-comments"></i> Chat ${unreadBadge}
                </button>` : `
                <span style="font-size:0.75rem;color:#f43f5e;display:flex;align-items:center;gap:0.3rem;">
                    <i class="fas fa-times-circle"></i> Declined
                </span>`}
            </div>
        </div>
    </div>`;
}

// ── Status stepper for Client Request cards (accepted connections) ─────────────
function connStatusStepperHtml(c) {
    const proj = c.architectProject;
    if (!proj || !proj._id) return `
        <div style="margin-top:0.75rem;padding:0.6rem 0.9rem;background:rgba(255,255,255,0.02);border:1px dashed rgba(255,255,255,0.08);border-radius:10px;text-align:center;">
            <span style="font-size:0.72rem;color:#475569;display:flex;align-items:center;justify-content:center;gap:0.4rem;">
                <i class="fas fa-folder-open" style="font-size:0.65rem;color:rgba(139,92,246,0.4);"></i>
                No project shared yet — share a project to track progress here
            </span>
        </div>`;

    const STEPS = [
        { key: 'draft',       label: 'Draft',       icon: 'fa-pencil-alt' },
        { key: 'in_progress', label: 'In Progress',  icon: 'fa-tools'      },
        { key: 'review',      label: 'Review',       icon: 'fa-search'     },
        { key: 'approved',    label: 'Complete',     icon: 'fa-check-circle'}
    ];
    const ORDER  = STEPS.map(s => s.key);
    const curIdx = ORDER.indexOf(proj.status);
    // Architects can only advance up to 'review' — 'approved' is set by client
    const nextStep = (curIdx < ORDER.length - 1 && STEPS[curIdx + 1].key !== 'approved')
        ? STEPS[curIdx + 1]
        : null;

    // Build a status → timestamp map from statusHistory
    const histMap = {};
    if (Array.isArray(proj.statusHistory)) {
        // Keep the latest timestamp per status
        proj.statusHistory.forEach(h => { histMap[h.status] = h.changedAt; });
    }

    const fmtDate = iso => {
        if (!iso) return null;
        const d = new Date(iso);
        return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const stepsHtml = STEPS.map((step, i) => {
        const done   = i < curIdx;
        const active = i === curIdx;
        const cls    = done ? 'ps-step done' : active ? 'ps-step active' : 'ps-step';
        const ts     = fmtDate(histMap[step.key]);
        const tsHtml = ts
            ? `<div style="font-size:0.52rem;color:${done ? '#10b981' : active ? '#00d4c8' : '#334155'};margin-top:2px;white-space:nowrap;max-width:70px;overflow:hidden;text-overflow:ellipsis;" title="${ts}">${ts}</div>`
            : '';
        return `<div class="${cls}">
            <div class="ps-dot"><i class="fas ${step.icon}"></i></div>
            <div class="ps-label">${step.label}</div>
            ${tsHtml}
        </div>`;
    }).join('<div class="ps-line"></div>');

    const reviewNote = nextStep && nextStep.key === 'review'
        ? `<div style="font-size:0.65rem;color:#f59e0b;display:flex;align-items:center;gap:0.3rem;margin-left:auto;">
               <i class="fas fa-share-alt" style="font-size:0.6rem;"></i> Notifies &amp; shares with client
           </div>`
        : '';

    // When at 'review' — waiting for client; when 'approved' — complete
    const atReview   = proj.status === 'review';
    const atApproved = proj.status === 'approved';

    const advBtn = atApproved
        ? `<span class="ps-complete-badge"><i class="fas fa-check-circle"></i> Complete</span>`
        : atReview
        ? `<span style="font-size:0.72rem;color:#a78bfa;display:flex;align-items:center;gap:0.35rem;">
               <i class="fas fa-hourglass-half" style="font-size:0.65rem;"></i> Awaiting client review
           </span>`
        : nextStep
        ? `<div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
               <button class="ps-advance-btn" onclick="event.stopPropagation();advanceConnProjectStatus('${c._id}','${proj._id}','${nextStep.key}','${nextStep.label}')">
                   <i class="fas fa-arrow-right"></i> Mark as ${nextStep.label}
               </button>
               ${reviewNote}
           </div>`
        : `<span class="ps-complete-badge"><i class="fas fa-check-circle"></i> Complete</span>`;

    return `<div class="ps-stepper" onclick="event.stopPropagation()" style="margin-top:0.75rem;">
        <div style="font-size:0.6rem;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:0.5rem;display:flex;align-items:center;gap:0.4rem;">
            <i class="fas fa-tasks" style="font-size:0.55rem;"></i> Project Progress
        </div>
        <div class="ps-steps">${stepsHtml}</div>
        <div class="ps-action">${advBtn}</div>
    </div>`;
}

// ── Status stepper for Additional Project cards ────────────────────────────────
function additionalProjectStepperHtml(c, ap) {
    // Check if architect has already shared a project for this additional request
    // We store it in ap.architectProject once the architect links one
    const proj = ap.architectProject || null;

    if (!proj || !proj._id) {
        // No workspace project linked yet — show prompt to start one
        const clientName   = escHtml((c.client || {}).name || '');
        const assignedDate = ap.assignedAt
            ? new Date(ap.assignedAt).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })
            : '';
       const apStatus = ap.acceptanceStatus || 'pending';

        // ── Declined state ────────────────────────────────────────────────────
        if (apStatus === 'declined') {
            return `
            <div style="margin-top:0.75rem;padding:0.6rem 0.9rem;background:rgba(244,63,94,0.05);border:1px dashed rgba(244,63,94,0.2);border-radius:10px;" onclick="event.stopPropagation()">
                <div style="font-size:0.6rem;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:0.4rem;display:flex;align-items:center;gap:0.35rem;">
                    <i class="fas fa-tasks" style="font-size:0.55rem;color:#f43f5e;"></i> Project Progress
                </div>
                <div style="font-size:0.75rem;color:#f43f5e;display:flex;align-items:center;gap:0.35rem;">
                    <i class="fas fa-times-circle" style="font-size:0.7rem;"></i> You declined this project request
                </div>
            </div>`;
        }

        // ── Pending state — show Accept / Decline buttons ─────────────────────
        if (apStatus === 'pending') {
            return `
            <div style="margin-top:0.75rem;padding:0.6rem 0.9rem;background:rgba(245,158,11,0.05);border:1px dashed rgba(245,158,11,0.22);border-radius:10px;" onclick="event.stopPropagation()">
                <div style="font-size:0.6rem;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:0.4rem;display:flex;align-items:center;gap:0.35rem;">
                    <i class="fas fa-tasks" style="font-size:0.55rem;color:#f59e0b;"></i> Project Progress
                </div>
                <div style="font-size:0.75rem;color:#94a3b8;margin-bottom:0.6rem;">
                    <i class="fas fa-clock" style="font-size:0.65rem;color:rgba(245,158,11,0.6);margin-right:0.3rem;"></i>
                    New request${assignedDate ? ' · received ' + assignedDate : ''} — awaiting your response
                </div>
                <div style="display:flex;gap:0.5rem;">
                    <button onclick="event.stopPropagation();respondToAdditionalProject('${c._id}','${ap.projectId}','accept')"
                        style="flex:1;padding:0.45rem 0.6rem;background:linear-gradient(135deg,#10b981,#059669);color:#fff;font-weight:700;font-size:0.72rem;border:none;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:0.35rem;transition:all 0.2s;"
                        onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 4px 12px rgba(16,185,129,0.3)';"
                        onmouseout="this.style.transform='';this.style.boxShadow='';">
                        <i class="fas fa-check"></i> Accept
                    </button>
                    <button onclick="event.stopPropagation();respondToAdditionalProject('${c._id}','${ap.projectId}','decline')"
                        style="flex:1;padding:0.45rem 0.6rem;background:rgba(244,63,94,0.08);color:#f43f5e;font-weight:700;font-size:0.72rem;border:1px solid rgba(244,63,94,0.25);border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:0.35rem;transition:all 0.2s;"
                        onmouseover="this.style.background='rgba(244,63,94,0.18)';"
                        onmouseout="this.style.background='rgba(244,63,94,0.08)';">
                        <i class="fas fa-times"></i> Decline
                    </button>
                </div>
            </div>`;
        }

        // ── Accepted state — show Start in Workspace ──────────────────────────
        return `
        <div style="margin-top:0.75rem;padding:0.6rem 0.9rem;background:rgba(0,212,200,0.04);border:1px dashed rgba(0,212,200,0.18);border-radius:10px;" onclick="event.stopPropagation()">
            <div style="font-size:0.6rem;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:0.4rem;display:flex;align-items:center;gap:0.35rem;">
                <i class="fas fa-tasks" style="font-size:0.55rem;color:#00d4c8;"></i> Project Progress
            </div>
            <div style="font-size:0.75rem;color:#64748b;margin-bottom:0.5rem;">
                <i class="fas fa-info-circle" style="font-size:0.65rem;color:rgba(0,212,200,0.5);margin-right:0.3rem;"></i>
                New request${assignedDate ? ' · received ' + assignedDate : ''} — no design started yet
            </div>
            <button onclick="event.stopPropagation();openWorkspaceForAdditional('${c._id}','${clientName}','${escHtml(ap.projectName)}','${ap.projectId}')"
                style="width:100%;padding:0.45rem 0.75rem;background:linear-gradient(135deg,rgba(0,212,200,0.15),rgba(139,92,246,0.1));color:#00d4c8;font-weight:700;font-size:0.72rem;border:1px solid rgba(0,212,200,0.25);border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:0.4rem;transition:all 0.2s;"
                onmouseover="this.style.background='linear-gradient(135deg,rgba(0,212,200,0.25),rgba(139,92,246,0.15))';"
                onmouseout="this.style.background='linear-gradient(135deg,rgba(0,212,200,0.15),rgba(139,92,246,0.1))';">
                <i class="fas fa-drafting-compass"></i> Start in Workspace
            </button>
        </div>`;
    }

    // Architect has a linked project — show full stepper (reuse same logic as primary)
    const STEPS = [
        { key: 'draft',       label: 'Draft',       icon: 'fa-pencil-alt' },
        { key: 'in_progress', label: 'In Progress',  icon: 'fa-tools'      },
        { key: 'review',      label: 'Review',       icon: 'fa-search'     },
        { key: 'approved',    label: 'Complete',     icon: 'fa-check-circle'}
    ];
    const ORDER  = STEPS.map(s => s.key);
    const curIdx = ORDER.indexOf(proj.status);
    const nextStep = (curIdx < ORDER.length - 1 && STEPS[curIdx + 1].key !== 'approved')
        ? STEPS[curIdx + 1] : null;

    const histMap = {};
    if (Array.isArray(proj.statusHistory)) {
        proj.statusHistory.forEach(h => { histMap[h.status] = h.changedAt; });
    }

    const fmtDate = iso => {
        if (!iso) return null;
        const d = new Date(iso);
        return d.toLocaleString('en-IN', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
    };

    const stepsHtml = STEPS.map((step, i) => {
        const done   = i < curIdx;
        const active = i === curIdx;
        const cls    = done ? 'ps-step done' : active ? 'ps-step active' : 'ps-step';
        const ts     = fmtDate(histMap[step.key]);
        const tsHtml = ts
            ? `<div style="font-size:0.52rem;color:${done ? '#10b981' : active ? '#00d4c8' : '#334155'};margin-top:2px;white-space:nowrap;max-width:70px;overflow:hidden;text-overflow:ellipsis;" title="${ts}">${ts}</div>`
            : '';
        return `<div class="${cls}">
            <div class="ps-dot"><i class="fas ${step.icon}"></i></div>
            <div class="ps-label">${step.label}</div>
            ${tsHtml}
        </div>`;
    }).join('<div class="ps-line"></div>');

    const atReview   = proj.status === 'review';
    const atApproved = proj.status === 'approved';

    const advBtn = atApproved
        ? `<span class="ps-complete-badge"><i class="fas fa-check-circle"></i> Complete</span>`
        : atReview
        ? `<span style="font-size:0.72rem;color:#a78bfa;display:flex;align-items:center;gap:0.35rem;">
               <i class="fas fa-hourglass-half" style="font-size:0.65rem;"></i> Awaiting client review
           </span>`
        : nextStep
        ? `<button class="ps-advance-btn" onclick="event.stopPropagation();advanceConnProjectStatus('${c._id}','${proj._id}','${nextStep.key}','${nextStep.label}')">
               <i class="fas fa-arrow-right"></i> Mark as ${nextStep.label}
           </button>`
        : `<span class="ps-complete-badge"><i class="fas fa-check-circle"></i> Complete</span>`;

    return `<div class="ps-stepper" onclick="event.stopPropagation()" style="margin-top:0.75rem;">
        <div style="font-size:0.6rem;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:0.5rem;display:flex;align-items:center;gap:0.4rem;">
            <i class="fas fa-tasks" style="font-size:0.55rem;"></i> Project Progress
        </div>
        <div class="ps-steps">${stepsHtml}</div>
        <div class="ps-action">${advBtn}</div>
    </div>`;
}

async function advanceConnProjectStatus(connId, projectId, newStatus, label) {
    try {
        const res = await api.updateProjectStatus(projectId, newStatus);
        if (!res.success) { showToast(res.message || 'Could not update status', 'error'); return; }

        // Update the cached connection's project status + history
        const cache = window._archConnectionsCache || [];
        const conn  = cache.find(x => String(x._id) === String(connId));
        if (conn) {
            // Update primary project if it matches
            if (conn.architectProject && String(conn.architectProject._id) === String(projectId)) {
                conn.architectProject.status = newStatus;
                if (!conn.architectProject.statusHistory) conn.architectProject.statusHistory = [];
                conn.architectProject.statusHistory.push({ status: newStatus, changedAt: new Date().toISOString() });
            }
            // Also check additional projects
            (conn.additionalProjects || []).forEach(ap => {
                if (ap.architectProject && String(ap.architectProject._id) === String(projectId)) {
                    ap.architectProject.status = newStatus;
                    if (!ap.architectProject.statusHistory) ap.architectProject.statusHistory = [];
                    ap.architectProject.statusHistory.push({ status: newStatus, changedAt: new Date().toISOString() });
                }
            });
        }
        renderArchConnections(cache);

        let msg = `Project marked as "${label}" ✓`;
        if (newStatus === 'review') msg += ' — Client notified and project shared!';
        showToast(msg, 'success');
    } catch (err) {
        showToast('Failed to update project status', 'error');
    }
}


// Opens a slide-in side panel with full connection + project brief details.
async function openConnDetailModal(connId) {
    const backdrop = document.getElementById('connDetailBackdrop');
    const cover    = document.getElementById('connDetailCover');
    const scroll   = document.getElementById('connDetailScroll');
    const footer   = document.getElementById('connDetailFooter');
    if (!backdrop || !cover || !scroll || !footer) return;

    // ── Find base connection from cache ───────────────────────────────────────
    const cached = window._archConnectionsCache || [];
    const c = cached.find(x => String(x._id) === String(connId));
    if (!c) return;

    const client = c.client || {};
    const avatar = client.avatar ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(client.name || 'C')}&background=8b5cf6&color=fff&bold=true`;

    // ── Render cover + skeleton immediately ───────────────────────────────────
    cover.innerHTML  = _connPanelCover(c, client, avatar, null);
    scroll.innerHTML = _skeletonRows(6);
    footer.innerHTML = '';

    backdrop.classList.add('open');
    document.body.style.overflow = 'hidden';

    // ── Fetch full brief ──────────────────────────────────────────────────────
    let brief = null;
    if (c.projectName) {
        try {
            const res  = await fetch(`${CONN_API}/${connId}/project-brief`, { headers: connHeaders() });
            const data = await res.json();
            if (data.success) brief = data.data;
        } catch (e) { /* render without brief */ }
    }

    // Fetch additional project briefs in parallel
    let additionalBriefs = [];
    if (c.additionalProjects && c.additionalProjects.length > 0) {
        additionalBriefs = await Promise.all(
            c.additionalProjects.map(async p => {
                try {
                    const r = await fetch(`${CONN_API}/${connId}/additional-projects/${p.projectId}`, { headers: connHeaders() });
                    const d = await r.json();
                    return d.success ? { meta: p, brief: d.data } : { meta: p, brief: null };
                } catch { return { meta: p, brief: null }; }
            })
        );
    }

    // ── Re-render with full data ──────────────────────────────────────────────
    cover.innerHTML  = _connPanelCover(c, client, avatar, brief);
    scroll.innerHTML = _briefBody(c, client, avatar, brief) + _additionalProjectsBody(additionalBriefs);
    footer.innerHTML = _connPanelFooter(c, client, avatar);

}

// ── Sub-renderers ─────────────────────────────────────────────────────────────

function _connPanelCover(c, client, avatar, brief) {
    const statusColor  = c.status === 'pending' ? '#f59e0b' : c.status === 'accepted' ? '#10b981' : '#f43f5e';
    const statusLabel  = c.status === 'pending' ? 'Pending'  : c.status === 'accepted' ? 'Connected' : 'Declined';
    const statusBorder = c.status === 'pending' ? 'rgba(245,158,11,0.3)' : c.status === 'accepted' ? 'rgba(16,185,129,0.3)' : 'rgba(244,63,94,0.3)';
    const statusBg     = c.status === 'pending' ? 'rgba(245,158,11,0.1)' : c.status === 'accepted' ? 'rgba(16,185,129,0.1)' : 'rgba(244,63,94,0.1)';
    const projType     = (brief && (brief.projectType || brief.type)) || null;
    const cap          = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

    const clientLastSeen = (c.client || {}).lastSeen || null;
    const online = typeof isOnline === 'function' ? isOnline(clientLastSeen) : false;
    const onlineDot = online
        ? `<span style="display:inline-flex;align-items:center;gap:4px;font-size:0.7rem;color:#10b981;"><span style="width:7px;height:7px;border-radius:50%;background:#10b981;box-shadow:0 0 6px #10b981;flex-shrink:0;display:inline-block;"></span>Online now</span>`
        : `<span style="display:inline-flex;align-items:center;gap:4px;font-size:0.7rem;color:#475569;"><span style="width:7px;height:7px;border-radius:50%;background:#475569;flex-shrink:0;display:inline-block;"></span>Offline</span>`;

    const reqDate = c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : '';

    return `
        <button onclick="closeConnDetailModal()"
            style="position:absolute;top:1rem;right:1rem;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);color:#64748b;width:32px;height:32px;border-radius:9px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:0.9rem;transition:all 0.2s;z-index:2;"
            onmouseover="this.style.background='rgba(255,255,255,0.14)';this.style.color='#f1f5f9';"
            onmouseout="this.style.background='rgba(255,255,255,0.07)';this.style.color='#64748b';">
            <i class="fas fa-times"></i>
        </button>

        <div style="display:flex;align-items:flex-start;gap:1rem;margin-bottom:1rem;">
            <div style="position:relative;flex-shrink:0;">
                <img src="${avatar}" alt="${escHtml(client.name)}"
                    style="width:64px;height:64px;border-radius:50%;object-fit:cover;border:3px solid rgba(139,92,246,0.4);display:block;"
                    onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(client.name||'C')}&background=8b5cf6&color=fff&bold=true'">
                ${online ? `<span style="position:absolute;bottom:2px;right:2px;width:12px;height:12px;border-radius:50%;background:#10b981;border:2px solid #0b1120;box-shadow:0 0 6px #10b981;"></span>` : ''}
            </div>
            <div style="min-width:0;padding-top:0.2rem;">
                <div style="font-family:'Syne',sans-serif;font-weight:800;font-size:1.15rem;color:#f1f5f9;letter-spacing:-0.3px;margin-bottom:2px;">${escHtml(client.name)}</div>
                <div style="font-size:0.78rem;color:#64748b;margin-bottom:5px;">${escHtml(client.email || '')}</div>
                ${onlineDot}
            </div>
        </div>

        ${c.projectName ? `
        <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(139,92,246,0.18);border-radius:10px;padding:0.7rem 0.875rem;display:flex;align-items:center;gap:0.6rem;margin-bottom:0.875rem;">
            <div style="width:30px;height:30px;border-radius:7px;background:rgba(139,92,246,0.12);border:1px solid rgba(139,92,246,0.22);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                <i class="fas fa-folder-open" style="color:#8b5cf6;font-size:0.8rem;"></i>
            </div>
            <div style="min-width:0;flex:1;">
                <div style="font-family:'Syne',sans-serif;font-weight:800;font-size:0.975rem;color:#f1f5f9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(c.projectName)}</div>
                ${projType ? `<div style="font-size:0.7rem;color:#64748b;text-transform:capitalize;margin-top:1px;">${escHtml(cap(projType))}</div>` : ''}
            </div>
        </div>` : ''}

        <div style="display:flex;align-items:center;gap:0.6rem;flex-wrap:wrap;">
            <span style="font-size:0.68rem;font-weight:700;padding:3px 10px;border-radius:20px;text-transform:uppercase;letter-spacing:0.5px;background:${statusBg};color:${statusColor};border:1px solid ${statusBorder};">
                ${statusLabel}
            </span>
            ${reqDate ? `<span style="font-size:0.72rem;color:#475569;display:flex;align-items:center;gap:0.3rem;"><i class="fas fa-calendar-alt" style="font-size:0.6rem;"></i>${reqDate}</span>` : ''}
            ${c.unreadByArchitect > 0 ? `<span style="background:#ef4444;color:#fff;border-radius:20px;padding:2px 8px;font-size:0.68rem;font-weight:700;margin-left:auto;"><i class="fas fa-bell" style="font-size:0.6rem;margin-right:3px;"></i>${c.unreadByArchitect} new</span>` : ''}
        </div>`;
}

// ── Panel footer (action buttons) ─────────────────────────────────────────────
function _connPanelFooter(c, client, avatar) {
    const clientName = escHtml(client.name || '');
    if (c.status === 'pending') {
        return `
            <div style="display:flex;gap:0.75rem;">
                <button onclick="respondToConnection('${c._id}','accept');closeConnDetailModal();"
                    style="flex:1;padding:0.75rem;background:linear-gradient(135deg,#10b981,#059669);color:#fff;font-weight:700;font-size:0.875rem;border:none;border-radius:11px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:0.5rem;transition:all 0.2s;"
                    onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 6px 20px rgba(16,185,129,0.35)';"
                    onmouseout="this.style.transform='';this.style.boxShadow='';">
                    <i class="fas fa-check"></i> Accept Request
                </button>
                <button onclick="respondToConnection('${c._id}','reject');closeConnDetailModal();"
                    style="flex:1;padding:0.75rem;background:rgba(244,63,94,0.08);color:#f43f5e;font-weight:700;font-size:0.875rem;border:1px solid rgba(244,63,94,0.25);border-radius:11px;cursor:pointer;transition:all 0.2s;"
                    onmouseover="this.style.background='rgba(244,63,94,0.18)';"
                    onmouseout="this.style.background='rgba(244,63,94,0.08)';">
                    <i class="fas fa-times"></i> Decline
                </button>
            </div>`;
    }
    if (c.status === 'accepted') {
        return `
            <div style="display:flex;gap:0.75rem;">
                <button onclick="openArchChatModal('${c._id}','${clientName}','${avatar}');closeConnDetailModal();"
                    style="flex:1;padding:0.75rem;background:linear-gradient(135deg,#10b981,#059669);color:#fff;font-weight:700;font-size:0.875rem;border:none;border-radius:11px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:0.5rem;transition:all 0.2s;"
                    onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 6px 20px rgba(16,185,129,0.3)';"
                    onmouseout="this.style.transform='';this.style.boxShadow='';">
                    <i class="fas fa-comments"></i> Chat
                </button>
                <button onclick="openWorkspaceForClient('${c._id}','${clientName}','${escHtml(c.projectName || '')}')"
                    style="flex:1;padding:0.75rem;background:rgba(139,92,246,0.1);color:#a78bfa;font-weight:700;font-size:0.875rem;border:1px solid rgba(139,92,246,0.25);border-radius:11px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:0.5rem;transition:all 0.2s;"
                    onmouseover="this.style.background='rgba(139,92,246,0.2)';this.style.color='#c4b5fd';"
                    onmouseout="this.style.background='rgba(139,92,246,0.1)';this.style.color='#a78bfa';">
                    <i class="fas fa-drafting-compass"></i> Open Workspace
                </button>
            </div>`;
    }
    return `<div style="text-align:center;font-size:0.82rem;color:#f43f5e;padding:0.25rem 0;"><i class="fas fa-times-circle" style="margin-right:0.4rem;"></i>This request was declined</div>`;
}

function _additionalPanelFooter(c, client, avatar, ap) {
    const clientName = escHtml(client.name || '');
    return `
        <div style="display:flex;gap:0.75rem;">
            <button onclick="openArchChatModal('${c._id}','${clientName}','${avatar}');closeConnDetailModal();"
                style="flex:1;padding:0.75rem;background:linear-gradient(135deg,#10b981,#059669);color:#fff;font-weight:700;font-size:0.875rem;border:none;border-radius:11px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:0.5rem;transition:all 0.2s;"
                onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 6px 20px rgba(16,185,129,0.3)';"
                onmouseout="this.style.transform='';this.style.boxShadow='';">
                <i class="fas fa-comments"></i> Chat
            </button>
            <button onclick="openWorkspaceForAdditional('${c._id}','${clientName}','${escHtml(ap.projectName)}','${ap.projectId}')"
                style="flex:1;padding:0.75rem;background:rgba(0,212,200,0.1);color:#00d4c8;font-weight:700;font-size:0.875rem;border:1px solid rgba(0,212,200,0.25);border-radius:11px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:0.5rem;transition:all 0.2s;"
                onmouseover="this.style.background='rgba(0,212,200,0.2)';this.style.color='#67e8f9';"
                onmouseout="this.style.background='rgba(0,212,200,0.1)';this.style.color='#00d4c8';">
                <i class="fas fa-drafting-compass"></i> Open Workspace
            </button>
        </div>`;
}

function _briefBody(c, client, avatar, brief) {
    const MAIN_API = 'http://localhost:5000';


    // ── Reusable table row ────────────────────────────────────────────────────
    const trow = (label, value) => (value !== null && value !== undefined && value !== '')
        ? `<div style="display:grid;grid-template-columns:130px 1fr;align-items:baseline;padding:0.7rem 0;border-bottom:1px solid rgba(255,255,255,0.05);">
               <span style="font-size:0.68rem;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.6px;">${label}</span>
               <span style="font-size:0.875rem;color:#e2e8f0;font-weight:500;">${value}</span>
           </div>`
        : '';

    // ── Section heading ───────────────────────────────────────────────────────
    const sectionHead = (icon, title, color = '#00d4c8') =>
        `<div style="display:flex;align-items:center;gap:0.5rem;margin:1.25rem 0 0.5rem;padding-bottom:0.4rem;border-bottom:1px solid rgba(255,255,255,0.06);">
             <i class="${icon}" style="color:${color};font-size:0.8rem;"></i>
             <span style="font-size:0.68rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.6px;">${title}</span>
         </div>`;

    // ── Format helpers ────────────────────────────────────────────────────────
    const cap   = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
    const fmtBudget = b => {
        if (!b || (b.min == null && b.max == null)) return null;
        const sym = b.currency === 'INR' ? '₹' : '$';
        const fmt = n => n >= 10000000 ? sym + (n/10000000).toFixed(1) + 'Cr'
                       : n >= 100000   ? sym + (n/100000).toFixed(1)   + 'L'
                       : sym + n.toLocaleString('en-IN');
        if (b.min != null && b.max != null) return `${fmt(b.min)} – ${fmt(b.max)}`;
        if (b.min != null) return `From ${fmt(b.min)}`;
        return `Up to ${fmt(b.max)}`;
    };
    const fmtTimeline = t => ({
        'asap':'ASAP', '1-3months':'1–3 Months', '3-6months':'3–6 Months',
        '6-12months':'6–12 Months', 'flexible':'Flexible'
    }[t] || cap(t));
    const fmtLand = ls => ls && ls.value ? `${ls.value.toLocaleString()} ${ls.unit ? ls.unit.toUpperCase() : ''}` : null;

    let html = '';

    if (!brief) {
        // ── No ClientProject found — show connection-level info only ──────────
        html += sectionHead('fas fa-info-circle', 'Request Info');
        html += `<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:0 0.875rem;">`;
        html += trow('Requested', c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : '—');
        if (c.unreadByArchitect > 0) html += trow('Unread', `<span style="color:#ef4444;font-weight:700;">${c.unreadByArchitect} new message${c.unreadByArchitect > 1 ? 's' : ''}</span>`);
        html += `</div>`;

        if (c.introMessage) {
            html += sectionHead('fas fa-comment-alt', 'Message from Client');
            html += `<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-left:3px solid rgba(0,212,200,0.4);border-radius:0 12px 12px 0;padding:0.875rem 1rem;">
                <p style="font-size:0.875rem;color:#94a3b8;line-height:1.65;margin:0;font-style:italic;">${escHtml(c.introMessage)}</p>
            </div>`;
        }
    } else {
        // ── Full ClientProject brief ──────────────────────────────────────────

        // 1. Overview table
        html += sectionHead('fas fa-clipboard-list', 'Project Overview', '#00d4c8');
        html += `<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:0 0.875rem;">`;
        html += trow('Type',     cap(brief.projectType));
        html += trow('Status',   `<span style="color:${brief.status==='active'?'#10b981':brief.status==='in_progress'?'#f59e0b':'#94a3b8'};font-weight:600;">${cap(brief.status?.replace(/_/g,' ') || '')}</span>`);
        html += trow('Budget',   fmtBudget(brief.budget));
        html += trow('Land Size',fmtLand(brief.landSize));
        html += trow('Style',    cap(brief.style));
        html += trow('Timeline', brief.timeline ? fmtTimeline(brief.timeline) : null);
        html += `</div>`;

        // 2. Space requirements
        const req = brief.requirements || {};
        const hasReqs = req.bedrooms || req.bathrooms || req.floors;
        if (hasReqs) {
            html += sectionHead('fas fa-th-large', 'Space Requirements', '#8b5cf6');
            html += `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.6rem;">`;
            const statBox = (icon, label, val, color) => val
                ? `<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:0.75rem 0.625rem;text-align:center;">
                       <i class="${icon}" style="color:${color};font-size:1rem;display:block;margin-bottom:0.35rem;"></i>
                       <div style="font-size:1.1rem;font-weight:800;color:#f1f5f9;font-family:'Syne',sans-serif;">${val}</div>
                       <div style="font-size:0.65rem;color:#64748b;text-transform:uppercase;letter-spacing:0.4px;margin-top:2px;">${label}</div>
                   </div>`
                : '';
            html += statBox('fas fa-bed',        'Bedrooms',  req.bedrooms,  '#818cf8');
            html += statBox('fas fa-bath',       'Bathrooms', req.bathrooms, '#22d3ee');
            html += statBox('fas fa-layer-group','Floors',    req.floors,    '#a78bfa');
            html += `</div>`;
        }

        // 3. Extras (garage, pool, garden)
        const extras = [];
        if (req.garage) extras.push({ icon: 'fas fa-car',     label: 'Garage' });
        if (req.pool)   extras.push({ icon: 'fas fa-swimming-pool', label: 'Pool' });
        if (req.garden) extras.push({ icon: 'fas fa-leaf',    label: 'Garden' });
        if (extras.length) {
            html += sectionHead('fas fa-star', 'Extras', '#f59e0b');
            html += `<div style="display:flex;gap:0.5rem;flex-wrap:wrap;">`;
            extras.forEach(e => {
                html += `<span style="display:inline-flex;align-items:center;gap:0.4rem;padding:0.35rem 0.75rem;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);border-radius:8px;font-size:0.8rem;color:#fbbf24;font-weight:600;">
                    <i class="${e.icon}" style="font-size:0.72rem;"></i>${e.label}
                </span>`;
            });
            html += `</div>`;
        }

        // 4. Description
        if (brief.description) {
            html += sectionHead('fas fa-align-left', 'Description', '#00d4c8');
            html += `<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-left:3px solid rgba(0,212,200,0.35);border-radius:0 10px 10px 0;padding:0.875rem 1rem;">
                <p style="font-size:0.875rem;color:#94a3b8;line-height:1.65;margin:0;">${escHtml(brief.description)}</p>
            </div>`;
        }

        // 5. Client intro message
        if (c.introMessage) {
            html += sectionHead('fas fa-comment-alt', 'Message from Client', '#00d4c8');
            html += `<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-left:3px solid rgba(139,92,246,0.4);border-radius:0 10px 10px 0;padding:0.875rem 1rem;">
                <p style="font-size:0.875rem;color:#94a3b8;line-height:1.65;margin:0;font-style:italic;">${escHtml(c.introMessage)}</p>
            </div>`;
        }

        // 6. Attachments
        if (brief.attachments && brief.attachments.length) {
            html += sectionHead('fas fa-paperclip', `Attachments (${brief.attachments.length})`, '#64748b');
            html += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(90px,1fr));gap:0.6rem;">`;
            brief.attachments.forEach(att => {
                const url  = `${MAIN_API}${att.url}`;
                const isImg = att.mimetype && att.mimetype.startsWith('image/');
                html += `<a href="${url}" target="_blank" rel="noopener"
                    style="display:block;border-radius:10px;overflow:hidden;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.03);transition:border-color 0.2s;text-decoration:none;aspect-ratio:1;"
                    onmouseover="this.style.borderColor='rgba(0,212,200,0.35)';"
                    onmouseout="this.style.borderColor='rgba(255,255,255,0.1)';">
                    ${isImg
                        ? `<img src="${url}" alt="${escHtml(att.originalName)}" style="width:100%;height:100%;object-fit:cover;display:block;"
                               onerror="this.parentElement.innerHTML='<div style=\\'width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:8px;\\'><i class=\\'fas fa-file\\' style=\\'color:#475569;font-size:1.25rem;\\'></i><span style=\\'font-size:0.6rem;color:#475569;text-align:center;word-break:break-all;\\'>${escHtml(att.originalName)}</span></div>'">`
                        : `<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:8px;">
                               <i class="fas fa-file-alt" style="color:#475569;font-size:1.25rem;"></i>
                               <span style="font-size:0.6rem;color:#475569;text-align:center;word-break:break-all;line-clamp:2;">${escHtml(att.originalName)}</span>
                           </div>`
                    }
                </a>`;
            });
            html += `</div>`;
        }
    }

    return html;
}

function _additionalProjectsBody(additionalBriefs) {
    if (!additionalBriefs || !additionalBriefs.length) return '';

    const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
    const trow = (label, value) => (value !== null && value !== undefined && value !== '')
        ? `<div style="display:grid;grid-template-columns:130px 1fr;align-items:baseline;padding:0.7rem 0;border-bottom:1px solid rgba(255,255,255,0.05);">
               <span style="font-size:0.68rem;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.6px;">${label}</span>
               <span style="font-size:0.875rem;color:#e2e8f0;font-weight:500;">${value}</span>
           </div>`
        : '';

    const fmtBudget = b => {
        if (!b || (b.min == null && b.max == null)) return null;
        const sym = b.currency === 'INR' ? '₹' : '$';
        const fmt = n => n >= 10000000 ? sym+(n/10000000).toFixed(1)+'Cr' : n >= 100000 ? sym+(n/100000).toFixed(1)+'L' : sym+n.toLocaleString('en-IN');
        if (b.min != null && b.max != null) return `${fmt(b.min)} – ${fmt(b.max)}`;
        return b.min != null ? `From ${fmt(b.min)}` : `Up to ${fmt(b.max)}`;
    };

    return additionalBriefs.map(({ meta, brief }, idx) => {
        const assignedDate = meta.assignedAt
            ? new Date(meta.assignedAt).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })
            : '';

        let html = `
        <div style="margin-top:1.5rem;padding-top:1rem;border-top:2px dashed rgba(0,212,200,0.15);">
            <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.75rem;">
                <div style="width:26px;height:26px;border-radius:7px;background:rgba(0,212,200,0.1);border:1px solid rgba(0,212,200,0.2);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                    <i class="fas fa-plus" style="color:#00d4c8;font-size:0.65rem;"></i>
                </div>
                <div>
                    <div style="font-size:0.85rem;font-weight:700;color:#f1f5f9;">${escHtml(meta.projectName || 'Additional Project')}</div>
                    ${assignedDate ? `<div style="font-size:0.65rem;color:#475569;">Assigned ${assignedDate}</div>` : ''}
                </div>
            </div>`;

        if (!brief) {
            html += `<div style="padding:0.6rem 0.875rem;background:rgba(255,255,255,0.02);border:1px dashed rgba(255,255,255,0.07);border-radius:10px;font-size:0.78rem;color:#475569;text-align:center;">
                <i class="fas fa-folder-open" style="margin-right:0.4rem;"></i>Brief details not available
            </div>`;
        } else {
            html += `<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(0,212,200,0.1);border-radius:12px;padding:0 0.875rem;">`;
            html += trow('Type',     cap(brief.projectType));
            html += trow('Budget',   fmtBudget(brief.budget));
            html += trow('Style',    cap(brief.style));
            html += trow('Timeline', brief.timeline ? cap(brief.timeline.replace(/-/g,' ')) : null);
            if (brief.description) {
                html += `</div><div style="margin-top:0.6rem;padding:0.75rem 1rem;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-left:3px solid rgba(0,212,200,0.35);border-radius:0 10px 10px 0;font-size:0.82rem;color:#94a3b8;line-height:1.6;font-style:italic;">${escHtml(brief.description)}</div>`;
            } else {
                html += `</div>`;
            }
        }

        html += `</div>`;
        return html;
    }).join('');
}

// ── Skeleton loader rows ──────────────────────────────────────────────────────
function _skeletonRows(n) {
    const pulse = `animation:connSkeletonPulse 1.4s ease-in-out infinite;`;
    let rows = '';
    for (let i = 0; i < n; i++) {
        const w = [65, 80, 55, 70, 60, 75][i % 6];
        rows += `<div style="display:grid;grid-template-columns:130px 1fr;gap:0.5rem;padding:0.7rem 0;border-bottom:1px solid rgba(255,255,255,0.04);">
            <div style="height:11px;border-radius:4px;background:rgba(255,255,255,0.06);width:70%;${pulse}"></div>
            <div style="height:11px;border-radius:4px;background:rgba(255,255,255,0.08);width:${w}%;${pulse}"></div>
        </div>`;
    }
    return `<div style="margin-top:1rem;">${rows}</div>`;
}

// ── Open Workspace for a client connection ────────────────────────────────────
// Navigates to architect.html, carrying connection context as query params so
// the workspace can display a client-brief banner without breaking normal flow.
function openWorkspaceForClient(connId, clientName, projectName) {
    closeConnDetailModal();

    // Look up the connection from cache — enriched with architectProject by backend
    const cached = window._archConnectionsCache || [];
    const conn   = cached.find(x => String(x._id) === String(connId));

    const params = new URLSearchParams();
    params.set('connectionId', connId);
    if (clientName)  params.set('clientName',  clientName);

    // ── Determine which architect project to open ─────────────────────────────
    // conn.architectProject is set by the backend (via ProjectShare lookup).
    // conn.project stores the CLIENT's brief ID — never use it as ?id=.
    const archProj   = conn?.architectProject || null;
    const archProjId = archProj?._id || null;

    if (archProjId) {
        // Open the existing shared architect project — enables save + live updates
        params.set('id', archProjId);
        // Still pass the client's project name as a label for the banner,
        // but the workspace title comes from the loaded project itself.
        if (projectName) params.set('clientProjectName', projectName);
    } else {
        // No project shared yet — open blank workspace pre-labelled with client's brief name
        if (projectName) {
            params.set('projectName', projectName);
        }
    }

    window.location.href = `architect.html?${params.toString()}`;
}

function openWorkspaceForAdditional(connId, clientName, projectName, projectId) {
    closeConnDetailModal();

    // Check if this additional project already has a linked architect project
    const cached = window._archConnectionsCache || [];
    const conn   = cached.find(x => String(x._id) === String(connId));
    const ap     = conn && (conn.additionalProjects || []).find(p => String(p.projectId) === String(projectId));
    const existingArchProjId = ap && ap.architectProjectId ? ap.architectProjectId : null;

    const params = new URLSearchParams();
    params.set('connectionId',        connId);
    params.set('clientName',          clientName);
    params.set('additionalProjectId', projectId);  // tells architect.js this is an additional project

    if (existingArchProjId) {
        // Open the existing project directly — same as primary flow
        params.set('id',                existingArchProjId);
        params.set('clientProjectName', projectName);
    } else {
        // Blank workspace — pre-fill title
        params.set('projectName', projectName);
    }

    window.location.href = `architect.html?${params.toString()}`;
}

async function openAdditionalProjectModal(connId, projectId) {
    const backdrop = document.getElementById('connDetailBackdrop');
    const cover    = document.getElementById('connDetailCover');
    const scroll   = document.getElementById('connDetailScroll');
    const footer   = document.getElementById('connDetailFooter');
    if (!backdrop || !cover || !scroll || !footer) return;

    const cached = window._archConnectionsCache || [];
    const c = cached.find(x => String(x._id) === String(connId));
    if (!c) return;

    const client = c.client || {};
    const avatar = client.avatar ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(client.name || 'C')}&background=00d4c8&color=060a12&bold=true`;
    const ap = (c.additionalProjects || []).find(p => String(p.projectId) === String(projectId));
    if (!ap) return;

    // Show skeleton
    cover.innerHTML  = _connPanelCover(c, client, avatar, null);
    scroll.innerHTML = _skeletonRows(6);
    footer.innerHTML = '';
    backdrop.classList.add('open');
    document.body.style.overflow = 'hidden';

    // Fetch the additional project brief
    let brief = null;
    try {
        const r = await fetch(`${CONN_API}/${connId}/additional-projects/${projectId}`, { headers: connHeaders() });
        const d = await r.json();
        if (d.success) brief = d.data;
    } catch (e) {}

    // Render with additional project context
    const fakeConn = Object.assign({}, c, { projectName: ap.projectName });
    cover.innerHTML  = _connPanelCover(fakeConn, client, avatar, brief);
    scroll.innerHTML = _briefBody(fakeConn, client, avatar, brief);
    footer.innerHTML = _additionalPanelFooter(c, client, avatar, ap);
}

function closeConnDetailModal() {
    const backdrop = document.getElementById('connDetailBackdrop');
    if (backdrop) backdrop.classList.remove('open');
    document.body.style.overflow = '';
}

// ── Accept / Reject ───────────────────────────────────────────────────────────
async function respondToConnection(connId, action) {
    try {
        const res  = await fetch(`${CONN_API}/${connId}/respond`, {
            method:  'PUT',
            headers: connHeaders(),
            body:    JSON.stringify({ action })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message);

        if (typeof showToast === 'function') {
            showToast(action === 'accept' ? 'Connection accepted! Chat is now open.' : 'Request declined.', action === 'accept' ? 'success' : 'info');
        }
        // Reload the list
        loadArchConnections();
    } catch (err) {
        if (typeof showToast === 'function') showToast(err.message || 'Action failed.', 'error');
    }
}

async function respondToAdditionalProject(connectionId, projectId, action) {
    try {
        const r = await fetch(`http://localhost:5000/api/connections/${connectionId}/additional-projects/${projectId}/respond`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (localStorage.getItem('token') || '') },
            body: JSON.stringify({ action })
        });
        const d = await r.json();
        if (!d.success) throw new Error(d.message);

        if (action === 'decline') {
            // Find and animate-remove the card containing this project
            const allCards = document.querySelectorAll('[data-additional-project-id]');
            let removed = false;
            allCards.forEach(card => {
                if (card.dataset.additionalProjectId === String(projectId)) {
                    card.style.transition = 'all 0.35s ease';
                    card.style.opacity = '0';
                    card.style.transform = 'scale(0.92)';
                    setTimeout(() => card.remove(), 350);
                    removed = true;
                }
            });

            // Fallback: if cards don't have data attributes, reload
            if (!removed) {
                if (typeof loadConnections === 'function') loadConnections();
                else if (typeof renderConnectionCards === 'function') renderConnectionCards();
            }

            if (typeof showToast === 'function') showToast('Project declined. Client has been notified.', 'info');
        } else {
            if (typeof showToast === 'function') showToast('Project accepted. Client has been notified.', 'success');
            if (typeof loadConnections === 'function') loadConnections();
            else if (typeof renderConnectionCards === 'function') renderConnectionCards();
        }
    } catch(err) {
        if (typeof showToast === 'function') showToast(err.message || 'Could not respond to project.', 'error');
    }
}

// ── Architect Chat Modal ──────────────────────────────────────────────────────
function openArchChatModal(connectionId, clientName, clientAvatar) {
    activeArchChatId = connectionId;
    const nameEl   = document.getElementById('archChatName');
    const avatarEl = document.getElementById('archChatAvatar');
    if (nameEl)   nameEl.textContent = clientName;
    if (avatarEl) avatarEl.src       = clientAvatar;

    const msgsEl = document.getElementById('archChatMessages');
    if (msgsEl) msgsEl.innerHTML = '<div style="text-align:center;padding:2rem;color:#94a3b8"><i class="fas fa-spinner fa-spin"></i></div>';

    const inputEl = document.getElementById('archChatInput');
    if (inputEl) inputEl.value = '';

    const backdrop = document.getElementById('archChatBackdrop');
    if (backdrop) backdrop.classList.add('open');
    document.body.style.overflow = 'hidden';

    loadArchChatMessages();

    clearInterval(archChatPollTimer);
    archChatPollTimer = setInterval(loadArchChatMessages, 8000);
}

function closeArchChatModal(e) {
    if (e && e.target !== document.getElementById('archChatBackdrop')) return;
    const backdrop = document.getElementById('archChatBackdrop');
    if (backdrop) backdrop.classList.remove('open');
    document.body.style.overflow = '';
    clearInterval(archChatPollTimer);
    archChatPollTimer = null;
    activeArchChatId  = null;
    loadArchConnections();
}

function _updateArchChatOnlineBadge(connection) {
    const statusEl = document.getElementById('archChatStatus');
    if (!statusEl) return;
    // connection.client is populated with { name, avatar, lastSeen }
    const lastSeen = connection && connection.client && connection.client.lastSeen
        ? connection.client.lastSeen
        : null;
    const online = typeof isOnline === 'function' ? isOnline(lastSeen) : false;
    const dot = `<span style="width:7px;height:7px;border-radius:50%;background:${online ? '#10b981' : '#64748b'};${online ? 'box-shadow:0 0 6px #10b981;' : ''}display:inline-block;flex-shrink:0;"></span>`;
    statusEl.innerHTML = online
        ? `${dot} <span style="color:#10b981">Client · Online</span>`
        : `${dot} <span style="color:#64748b">Client · Offline</span>`;
}

async function loadArchChatMessages() {
    if (!activeArchChatId) return;
    try {
        const res  = await fetch(`${CONN_API}/${activeArchChatId}/messages`, { headers: connHeaders() });
        const data = await res.json();
        if (!data.success) return;
        // Backend returns { success, data: { connection, messages } }
        const payload = data.data || {};
        renderArchChatMessages(payload.messages, payload.connection);
        _updateArchChatOnlineBadge(payload.connection);
    } catch (e) {}
}

function renderArchChatMessages(messages, connection) {
    const el = document.getElementById('archChatMessages');
    if (!el) return;

    let html = '';

    // Show client's intro message at the top
    if (connection && connection.introMessage) {
        html += `<div style="display:flex;flex-direction:column;max-width:78%;align-self:flex-start;align-items:flex-start;margin-bottom:0.5rem">
            <div style="padding:0.6rem 0.9rem;border-radius:14px 14px 14px 4px;font-size:0.875rem;line-height:1.5;background:rgba(255,255,255,0.07);color:#f1f5f9;word-break:break-word">${escHtml(connection.introMessage)}</div>
            <div style="font-size:0.68rem;color:#64748b;margin-top:3px">Request message</div>
        </div>`;
    }

    if (!messages || !messages.length) {
        if (!connection || !connection.introMessage) {
            el.innerHTML = '<div style="text-align:center;padding:2rem;color:#94a3b8">No messages yet. Reply to start the conversation!</div>';
            return;
        }
        el.innerHTML = html + '<div style="text-align:center;color:#64748b;font-size:0.75rem;padding:0.75rem 0;border-top:1px dashed rgba(255,255,255,0.07);margin-top:0.5rem">Send a message to get started</div>';
        return;
    }

    const BASE = 'http://localhost:5000';
    messages.forEach(m => {
        const isSelf = m.senderRole === 'architect';
        const time   = new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const align  = isSelf ? 'align-self:flex-end;align-items:flex-end' : 'align-self:flex-start;align-items:flex-start';
        const bubbleStyle = isSelf
            ? 'background:linear-gradient(135deg,#8b5cf6,#6d28d9);color:#fff;border-radius:14px 14px 4px 14px;'
            : 'background:rgba(255,255,255,0.07);color:#f1f5f9;border-radius:14px 14px 14px 4px;';

        let bubble;
        if (m.type === 'image' && m.imageUrl) {
            const src = BASE + m.imageUrl;
            bubble = `<img src="${src}" class="chat-bubble-img"
                onclick="openChatLightbox('${src}')"
                onerror="this.style.display='none'" alt="image">`;
        } else {
            bubble = `<div style="padding:0.6rem 0.9rem;${bubbleStyle}font-size:0.875rem;line-height:1.5;word-break:break-word;">${escHtml(m.text)}</div>`;
        }

        html += `<div style="display:flex;flex-direction:column;max-width:78%;${align}">
            ${bubble}
            <div style="font-size:0.68rem;color:#64748b;margin-top:3px">${time}</div>
        </div>`;
    });

    el.innerHTML = `<div style="display:flex;flex-direction:column;gap:0.5rem">${html}</div>`;
    el.scrollTop = el.scrollHeight;
}

// ── Image selection & upload helpers ─────────────────────────────────────────
let _archChatPendingImg = null;

function onArchChatImgSelected(e) {
    const file = e.target.files[0];
    if (!file) return;
    _archChatPendingImg = file;
    const thumb = document.getElementById('archChatImgThumb');
    const preview = document.getElementById('archChatImgPreview');
    if (thumb) thumb.src = URL.createObjectURL(file);
    if (preview) preview.style.display = 'flex';
}

function clearArchChatImg() {
    _archChatPendingImg = null;
    const input   = document.getElementById('archChatImgInput');
    const preview = document.getElementById('archChatImgPreview');
    if (input)   input.value = '';
    if (preview) preview.style.display = 'none';
}

async function sendArchChatMessage() {
    if (!activeArchChatId) return;

    // ── Image send ────────────────────────────────────────────────────────────
    if (_archChatPendingImg) {
        const file    = _archChatPendingImg;
        const imgBtn  = document.getElementById('archChatImgBtn');
        const sendBtn = document.querySelector('#archChatPanel .chat-modal-send-btn');
        clearArchChatImg();
        if (imgBtn)  imgBtn.disabled  = true;
        if (sendBtn) sendBtn.disabled = true;

        try {
            const form = new FormData();
            form.append('image', file);
            const token = localStorage.getItem('token');
            const res   = await fetch(`${CONN_API}/${activeArchChatId}/messages/image`, {
                method:  'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body:    form
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message);
            await loadArchChatMessages();
        } catch (err) {
            if (typeof showToast === 'function') showToast(err.message || 'Could not send image.', 'error');
        } finally {
            if (imgBtn)  imgBtn.disabled  = false;
            if (sendBtn) sendBtn.disabled = false;
        }
        return;
    }

    // ── Text send ─────────────────────────────────────────────────────────────
    const inputEl = document.getElementById('archChatInput');
    const text    = (inputEl?.value || '').trim();
    if (!text) return;

    inputEl.value    = '';
    inputEl.disabled = true;

    try {
        const res  = await fetch(`${CONN_API}/${activeArchChatId}/messages`, {
            method:  'POST',
            headers: connHeaders(),
            body:    JSON.stringify({ text })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message);
        await loadArchChatMessages();
    } catch (err) {
        if (typeof showToast === 'function') showToast(err.message || 'Could not send.', 'error');
        if (inputEl) inputEl.value = text;
    } finally {
        if (inputEl) { inputEl.disabled = false; inputEl.focus(); }
    }
}

function openChatLightbox(src) {
    const lb  = document.getElementById('chatImgLightbox');
    const img = document.getElementById('chatImgLightboxImg');
    if (!lb || !img) return;
    img.src = src;
    lb.classList.add('open');
}

function handleArchChatKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendArchChatMessage(); }
}

// ── Poll architect badge on page load ─────────────────────────────────────────
// Track last-known project statuses so we can detect client-driven changes
var _lastKnownProjectStatuses = {};

async function pollArchConnBadge() {
    try {
        const res  = await fetch(`${CONN_API}/my`, { headers: connHeaders() });
        const data = await res.json();
        if (!data.success) return;

        updateArchConnBadge(data.data);

        // ── Detect client-driven status changes (approve / re-request) ────────
        (data.data || []).forEach(conn => {
            const proj = conn.architectProject;
            if (!proj || !proj._id) return;
            const pid  = String(proj._id);
            const prev = _lastKnownProjectStatuses[pid];

            if (prev !== undefined && prev !== proj.status) {
                const clientName = conn.client?.name || 'Your client';
                if (proj.status === 'approved') {
                    showToast(`🎉 ${clientName} has approved the project!`, 'success');
                } else if (proj.status === 'in_progress') {
                    showToast(`🔄 ${clientName} requested updates — check the chat.`, 'info');
                    // Refresh connections so the card shows new status
                    loadArchConnections();
                }
            }
            _lastKnownProjectStatuses[pid] = proj.status;
        });

        // Seed initial statuses on first run
        if (Object.keys(_lastKnownProjectStatuses).length === 0) {
            (data.data || []).forEach(conn => {
                if (conn.architectProject?._id) {
                    _lastKnownProjectStatuses[String(conn.architectProject._id)] = conn.architectProject.status;
                }
            });
        }
    } catch (e) {}
}

document.addEventListener('DOMContentLoaded', () => {
    pollArchConnBadge();
    setInterval(pollArchConnBadge, 60000);
});

// ── Expose globals ────────────────────────────────────────────────────────────
window.loadArchConnections   = loadArchConnections;
window.respondToConnection   = respondToConnection;
window.openArchChatModal     = openArchChatModal;
window.closeArchChatModal    = closeArchChatModal;
window.sendArchChatMessage   = sendArchChatMessage;
window.handleArchChatKeydown = handleArchChatKeydown;
window.onArchChatImgSelected = onArchChatImgSelected;
window.clearArchChatImg      = clearArchChatImg;
window.openChatLightbox      = openChatLightbox;
window.openConnDetailModal      = openConnDetailModal;
window.closeConnDetailModal     = closeConnDetailModal;
window.openWorkspaceForClient   = openWorkspaceForClient;
window.openWorkspaceForAdditional = openWorkspaceForAdditional;
window.openAdditionalProjectModal = openAdditionalProjectModal;

// ── Close side panel on Escape ────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const backdrop = document.getElementById('connDetailBackdrop');
        if (backdrop && backdrop.classList.contains('open')) {
            closeConnDetailModal();
        }
        // Close share modal on Escape too
        closeShareModal();
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  PROJECT SHARING  —  architect shares a completed project with a client
// ═══════════════════════════════════════════════════════════════════════════════

let _shareProjectId   = null;
let _shareProjectName = null;

async function openShareModal(projectId, projectName) {
    _shareProjectId   = projectId;
    _shareProjectName = projectName;

    const modal = document.getElementById('shareProjectModal');
    if (!modal) return;

    // Reset state
    document.getElementById('shareClientSelect').innerHTML = '<option value="">Loading clients…</option>';
    document.getElementById('shareMessage').value = '';
    document.getElementById('shareLinkBox').style.display = 'none';
    document.getElementById('shareLinkInput').value = '';
    document.getElementById('shareTabConnection').classList.add('active');
    document.getElementById('shareTabLink').classList.remove('active');
    document.getElementById('shareConnectionPane').style.display = '';
    document.getElementById('shareLinkPane').style.display = 'none';
    document.getElementById('shareModalProjectName').textContent = projectName;

    modal.style.display = 'flex';

    // Load connected clients
    try {
        const token = localStorage.getItem('token');
        const res   = await fetch('http://localhost:5000/api/shares/connected-clients', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const data  = await res.json();
        const sel   = document.getElementById('shareClientSelect');
        if (data.success && data.data.length) {
            sel.innerHTML = '<option value="">— Select a client —</option>' +
                data.data.map(c =>
                    `<option value="${c.client._id}">${escHtml(c.client.name)} (${escHtml(c.client.email)})</option>`
                ).join('');
        } else {
            sel.innerHTML = '<option value="">No accepted connections yet</option>';
        }
    } catch (e) {
        document.getElementById('shareClientSelect').innerHTML = '<option value="">Could not load clients</option>';
    }
}

function closeShareModal() {
    const modal = document.getElementById('shareProjectModal');
    if (modal) modal.style.display = 'none';
    _shareProjectId   = null;
    _shareProjectName = null;
}

function switchShareTab(tab) {
    const isConn = tab === 'connection';
    document.getElementById('shareTabConnection').classList.toggle('active', isConn);
    document.getElementById('shareTabLink').classList.toggle('active', !isConn);
    document.getElementById('shareConnectionPane').style.display = isConn ? '' : 'none';
    document.getElementById('shareLinkPane').style.display       = isConn ? 'none' : '';
}

async function submitShareWithClient() {
    const clientId = document.getElementById('shareClientSelect').value;
    const message  = document.getElementById('shareMessage').value.trim();
    if (!clientId) { showToast('Please select a client.', 'error'); return; }
    if (!_shareProjectId) return;

    try {
        const token = localStorage.getItem('token');
        const res   = await fetch(`http://localhost:5000/api/projects/${_shareProjectId}/share`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body:    JSON.stringify({ mode: 'connection', clientId, message })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message || 'Share failed');
        showToast('Project shared successfully! Client will see it in their dashboard.', 'success');
        closeShareModal();
    } catch (e) {
        showToast(e.message || 'Failed to share project.', 'error');
    }
}

async function generateShareLink() {
    if (!_shareProjectId) return;
    const message = document.getElementById('shareLinkMessage').value.trim();
    const btn     = document.getElementById('generateLinkBtn');
    btn.disabled  = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating…';

    try {
        const token = localStorage.getItem('token');
        const res   = await fetch(`http://localhost:5000/api/projects/${_shareProjectId}/share`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body:    JSON.stringify({ mode: 'link', message })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message || 'Failed');
        const viewerUrl = `${window.location.origin}/project-viewer.html?token=${data.data.shareToken}`;
        document.getElementById('shareLinkInput').value = viewerUrl;
        document.getElementById('shareLinkBox').style.display = 'flex';
        showToast('Shareable link generated!', 'success');
    } catch (e) {
        showToast(e.message || 'Could not generate link.', 'error');
    } finally {
        btn.disabled  = false;
        btn.innerHTML = '<i class="fas fa-link"></i> Generate Link';
    }
}

function copyShareLink() {
    const input = document.getElementById('shareLinkInput');
    if (!input || !input.value) return;
    navigator.clipboard.writeText(input.value)
        .then(() => showToast('Link copied to clipboard!', 'success'))
        .catch(() => {
            input.select();
            document.execCommand('copy');
            showToast('Link copied!', 'success');
        });
}

// Expose to global scope (called from inline onclick)
window.openShareModal       = openShareModal;
window.closeShareModal      = closeShareModal;
window.connStatusStepperHtml    = connStatusStepperHtml;
window.advanceConnProjectStatus = advanceConnProjectStatus;
window.switchShareTab       = switchShareTab;
window.submitShareWithClient = submitShareWithClient;
window.generateShareLink    = generateShareLink;
window.copyShareLink        = copyShareLink;
// ═══ Measurement Tools Tab Switcher ═══
window.switchMeasDbTab = function(cat) {
    document.querySelectorAll('.meas-db-tab').forEach(function(t){ t.classList.remove('active'); });
    document.querySelectorAll('.meas-db-category').forEach(function(c){ c.classList.remove('active'); });
    var tab = document.getElementById('mdbtab-' + cat);
    var body = document.getElementById('mdbcat-' + cat);
    if (tab) tab.classList.add('active');
    if (body) body.classList.add('active');
};
window.dbConv = function(fromId, toId, fn) {
    var fromEl = document.getElementById(fromId);
    var toEl   = document.getElementById(toId);
    if (!fromEl || !toEl) return;
    var val = parseFloat(fromEl.value);
    toEl.value = isNaN(val) ? '' : parseFloat(fn(val).toFixed(6));
};