// frontend/js/admin.js
'use strict';

const ADMIN_API = 'https://smartarch-backend.onrender.com/api/admin';

// ─── State ────────────────────────────────────────────────────────────────────
const state = {
    token: null,
    admin: null,
    currentPage: 'dashboard',
    users: { data: [], page: 1, pages: 1, total: 0, search: '', sort: '-createdAt' },
    projects: { data: [], page: 1, pages: 1, total: 0, search: '', sort: '-createdAt', status: '', type: '' },
    charts: {}
};

// ─── HTTP Helper ──────────────────────────────────────────────────────────────
async function adminRequest(endpoint, options = {}) {
    const url = `${ADMIN_API}${endpoint}`;
    const config = {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(state.token ? { 'Authorization': `Bearer ${state.token}` } : {}),
            ...options.headers
        }
    };
    const res = await fetch(url, config);
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Request failed');
    return data;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
function initAuth() {
    const token = localStorage.getItem('adminToken');
    const admin = localStorage.getItem('adminUser');
    if (token && admin) {
        state.token = token;
        state.admin = JSON.parse(admin);
        return true;
    }
    return false;
}

function requireAdminAuth() {
    if (!initAuth()) {
        window.location.href = 'admin-login.html';
        return false;
    }
    return true;
}

function adminLogout() {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    window.location.href = 'admin-login.html';
}

// ─── Login Page ───────────────────────────────────────────────────────────────
async function handleAdminLogin(e) {
    e.preventDefault();
    const email = document.getElementById('adminEmail').value;
    const password = document.getElementById('adminPassword').value;
    const btn = document.getElementById('loginBtn');
    const errEl = document.getElementById('loginError');

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';
    errEl.style.display = 'none';

    try {
        const data = await adminRequest('/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });

        localStorage.setItem('adminToken', data.token);
        localStorage.setItem('adminUser', JSON.stringify(data.admin));
        window.location.href = 'admin.html';
    } catch (err) {
        errEl.textContent = err.message || 'Invalid credentials';
        errEl.style.display = 'block';
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In to Admin';
    }
}

// ─── Navigation ───────────────────────────────────────────────────────────────
function navigateTo(pageName) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    const page = document.getElementById(`page-${pageName}`);
    if (page) page.classList.add('active');

    document.querySelectorAll(`.nav-item[data-page="${pageName}"]`).forEach(n => n.classList.add('active'));

    state.currentPage = pageName;
    updateTopbarTitle(pageName);

    if (pageName === 'dashboard') loadDashboard();
    else if (pageName === 'users') loadUsers();
    else if (pageName === 'projects') loadProjects();
    else if (pageName === 'analytics') { loadAnalytics(); loadAIScoreAnalytics(); }
    else if (pageName === 'messages' && typeof loadAdminTickets === 'function') loadAdminTickets();
    else if (pageName === 'reviews') loadAdminReviews();
    else if (pageName === 'app-ratings') loadAppRatingStats();

    // Close sidebar on mobile
    if (window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.remove('open');
    }
}

function updateTopbarTitle(page) {
    const titles = {
        dashboard: { title: 'Dashboard', subtitle: 'Overview & analytics' },
        users: { title: 'User Management', subtitle: 'Manage all registered users' },
        projects: { title: 'Project Management', subtitle: 'Manage all projects' },
        messages: { title: 'Support Inbox', subtitle: 'Manage and reply to user tickets' },
        analytics: { title: 'Analytics', subtitle: 'Detailed statistics & charts' },
        reviews: { title: 'Reviews', subtitle: 'Project ratings & user feedback' },
        'app-ratings': { title: 'App Ratings', subtitle: 'Overall platform satisfaction ratings' }
    };
    const t = titles[page] || { title: page, subtitle: '' };
    const el = document.getElementById('pageTitle');
    const sub = document.getElementById('pageSubtitle');
    if (el) el.textContent = t.title;
    if (sub) sub.textContent = t.subtitle;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
async function loadDashboard() {
    try {
        const res = await adminRequest('/dashboard');
        const d = res.data;

        // Stats
        setEl('stat-total-users', d.stats.totalUsers);
        setEl('stat-total-projects', d.stats.totalProjects);
        setEl('stat-projects-today', d.stats.projectsToday);
        setEl('stat-users-today', d.stats.usersToday);
        setEl('stat-users-week', `+${d.stats.usersThisWeek}`);
        setEl('stat-projects-week', `+${d.stats.projectsThisWeek}`);

        renderRecentProjects(d.recentProjects);
        renderRecentUsers(d.recentUsers);
        renderTopUsers(d.topUsers);
        renderActivityFeed(d.recentProjects, d.recentUsers);

        // Charts
        renderLineChart('userGrowthChart', d.userGrowth, 'New Users', '#667eea');
        renderLineChart('projectGrowthChart', d.projectGrowth, 'New Projects', '#11998e');
        renderDonut('statusChart', d.projectsByStatus, 'status');
        renderDonut('typeChart', d.projectsByType, 'type');
        renderPlanChart(d.planDistribution);

    } catch (err) {
        showToast('Failed to load dashboard: ' + err.message, 'error');
    }
}

function setEl(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

function renderRecentProjects(projects) {
    const el = document.getElementById('recentProjectsList');
    if (!el) return;
    if (!projects || !projects.length) {
        el.innerHTML = '<div class="empty-state"><i class="fas fa-folder-open"></i><p>No projects yet</p></div>';
        return;
    }
    el.innerHTML = projects.map(p => `
        <div class="activity-item">
            <div class="activity-icon project"><i class="fas fa-home"></i></div>
            <div class="activity-body">
                <div class="activity-text"><strong>${esc(p.name)}</strong> by ${esc(p.owner?.name || 'Unknown')}</div>
                <div class="activity-time">${formatDate(p.createdAt)} · <span class="badge ${statusBadge(p.status)}">${p.status}</span></div>
            </div>
        </div>
    `).join('');
}

function renderRecentUsers(users) {
    const el = document.getElementById('recentUsersList');
    if (!el) return;
    if (!users || !users.length) {
        el.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i><p>No users yet</p></div>';
        return;
    }
    el.innerHTML = users.map(u => `
        <div class="activity-item">
            <div class="activity-icon user"><i class="fas fa-user-plus"></i></div>
            <div class="activity-body">
                <div class="activity-text"><strong>${esc(u.name)}</strong> joined</div>
                <div class="activity-time">${esc(u.email)} · ${formatDate(u.createdAt)}</div>
            </div>
        </div>
    `).join('');
}

function renderActivityFeed(projects, users) {
    const el = document.getElementById('activityFeed');
    if (!el) return;

    const items = [
        ...projects.map(p => ({ type: 'project', text: `New project <strong>${esc(p.name)}</strong> created`, time: p.createdAt })),
        ...users.map(u => ({ type: 'user', text: `<strong>${esc(u.name)}</strong> registered`, time: u.createdAt }))
    ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 8);

    if (!items.length) {
        el.innerHTML = '<div class="empty-state"><i class="fas fa-history"></i><p>No recent activity</p></div>';
        return;
    }

    el.innerHTML = items.map(item => `
        <div class="activity-item">
            <div class="activity-icon ${item.type}">
                <i class="fas ${item.type === 'project' ? 'fa-home' : 'fa-user'}"></i>
            </div>
            <div class="activity-body">
                <div class="activity-text">${item.text}</div>
                <div class="activity-time">${formatDate(item.time)}</div>
            </div>
        </div>
    `).join('');
}

function renderTopUsers(users) {
    const el = document.getElementById('topUsersList');
    if (!el) return;
    if (!users || !users.length) {
        el.innerHTML = '<div class="empty-state"><i class="fas fa-trophy"></i><p>No data yet</p></div>';
        return;
    }
    el.innerHTML = users.map((u, i) => {
        const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
        return `
            <div class="top-user-item">
                <div class="rank-badge ${rankClass}">${i + 1}</div>
                <div class="user-avatar-sm">${initials(u.name)}</div>
                <div class="top-user-info">
                    <div class="top-user-name">${esc(u.name)}</div>
                    <div class="top-user-email">${esc(u.email)}</div>
                </div>
                <div class="top-user-count">${u.projectCount} <span style="font-size:0.7rem;color:var(--gray);font-weight:400;">projects</span></div>
            </div>
        `;
    }).join('');
}

// ─── Charts ───────────────────────────────────────────────────────────────────
function renderLineChart(canvasId, data, label, color) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    if (state.charts[canvasId]) state.charts[canvasId].destroy();

    const labels = data.map(d => d._id);
    const values = data.map(d => d.count);

    state.charts[canvasId] = new Chart(canvas, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label,
                data: values,
                borderColor: color,
                backgroundColor: color + '20',
                borderWidth: 2.5,
                pointRadius: 3,
                pointBackgroundColor: color,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { display: false }, ticks: { font: { size: 11 } } },
                y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 11 } }, grid: { color: '#f0f0f0' } }
            }
        }
    });
}

const DONUT_COLORS = ['#667eea', '#11998e', '#f5576c', '#4facfe', '#fa709a', '#fed330', '#26de81'];

function renderDonut(canvasId, data, field) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    if (state.charts[canvasId]) state.charts[canvasId].destroy();

    const labels = data.map(d => d._id || 'unknown');
    const values = data.map(d => d.count);
    const colors = DONUT_COLORS.slice(0, labels.length);

    state.charts[canvasId] = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{ data: values, backgroundColor: colors, borderWidth: 0, hoverOffset: 4 }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: { display: false }
            }
        }
    });

    // Legend
    const legendId = canvasId.replace('Chart', 'Legend');
    const legendEl = document.getElementById(legendId);
    if (legendEl) {
        legendEl.innerHTML = labels.map((l, i) => `
            <div class="legend-item">
                <div class="legend-dot" style="background:${colors[i]}"></div>
                <span class="legend-label">${l}</span>
                <span class="legend-value">${values[i]}</span>
            </div>
        `).join('');
    }
}

function renderPlanChart(planDistribution) {
    if (!planDistribution || !planDistribution.length) return;

    // Normalise: ensure all three plans are present
    const PLAN_ORDER = ['free', 'pro', 'enterprise'];
    const PLAN_COLORS = { free: '#64748b', pro: '#00d4c8', enterprise: '#a78bfa' };
    const PLAN_ICONS  = { free: 'fa-user', pro: 'fa-star', enterprise: 'fa-crown' };

    const countMap = {};
    planDistribution.forEach(d => { countMap[(d._id || 'free').toLowerCase()] = d.count; });
    PLAN_ORDER.forEach(p => { if (!countMap[p]) countMap[p] = 0; });

    const total = PLAN_ORDER.reduce((s, p) => s + countMap[p], 0);
    const labels = PLAN_ORDER.map(p => p.charAt(0).toUpperCase() + p.slice(1));
    const values = PLAN_ORDER.map(p => countMap[p]);
    const colors = PLAN_ORDER.map(p => PLAN_COLORS[p]);

    // Donut chart
    const canvas = document.getElementById('planChart');
    if (canvas) {
        if (state.charts['planChart']) state.charts['planChart'].destroy();
        state.charts['planChart'] = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{ data: values, backgroundColor: colors, borderWidth: 0, hoverOffset: 6 }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: { legend: { display: false } }
            }
        });
    }

    // Donut legend
    const legendEl = document.getElementById('planLegend');
    if (legendEl) {
        legendEl.innerHTML = PLAN_ORDER.map((p, i) => `
            <div class="legend-item">
                <div class="legend-dot" style="background:${colors[i]}"></div>
                <span class="legend-label">${labels[i]}</span>
                <span class="legend-value">${values[i]}</span>
            </div>
        `).join('');
    }

    // Breakdown list — progress bars per plan
    const breakdownEl = document.getElementById('planBreakdownList');
    if (breakdownEl) {
        breakdownEl.innerHTML = PLAN_ORDER.map(p => {
            const count = countMap[p];
            const pct   = total > 0 ? Math.round((count / total) * 100) : 0;
            const icon  = PLAN_ICONS[p];
            const color = PLAN_COLORS[p];
            const label = p.charAt(0).toUpperCase() + p.slice(1);
            return `
            <div class="plan-breakdown-row">
                <div class="plan-breakdown-header">
                    <div class="plan-breakdown-label">
                        <i class="fas ${icon}" style="color:${color};font-size:0.8rem;"></i>
                        <span>${label}</span>
                    </div>
                    <div class="plan-breakdown-stats">
                        <span class="plan-breakdown-count">${count} users</span>
                        <span class="plan-breakdown-pct">${pct}%</span>
                    </div>
                </div>
                <div class="plan-breakdown-bar-track">
                    <div class="plan-breakdown-bar-fill" style="width:${pct}%;background:${color};"></div>
                </div>
            </div>`;
        }).join('');
    }
}

// ─── Users ────────────────────────────────────────────────────────────────────
async function loadUsers() {
    const el = document.getElementById('usersTableBody');
    if (el) el.innerHTML = '<tr><td colspan="7" class="loading-spinner"><i class="fas fa-spinner"></i> Loading...</td></tr>';

    try {
        const params = new URLSearchParams({
            page: state.users.page,
            limit: 15,
            search: state.users.search,
            sort: state.users.sort
        });
        const res = await adminRequest(`/users?${params}`);
        state.users.data = res.data;
        state.users.pages = res.pagination.pages;
        state.users.total = res.pagination.total;

        renderUsersTable(res.data);
        renderUsersPagination(res.pagination);
        setEl('usersTotalCount', `${res.pagination.total} users`);
    } catch (err) {
        if (el) el.innerHTML = `<tr><td colspan="7" class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>${err.message}</p></td></tr>`;
    }
}

function planBadge(plan) {
    const p = (plan || 'free').toLowerCase();
    if (p === 'enterprise') return '<span class="badge badge-plan-enterprise"><i class="fas fa-crown"></i> Enterprise</span>';
    if (p === 'pro')        return '<span class="badge badge-plan-pro"><i class="fas fa-star"></i> Pro</span>';
    return '<span class="badge badge-plan-free"><i class="fas fa-user"></i> Free</span>';
}

function renderUsersTable(users) {
    const el = document.getElementById('usersTableBody');
    if (!el) return;

    if (!users.length) {
        el.innerHTML = '<tr><td colspan="7"><div class="empty-state"><i class="fas fa-users"></i><p>No users found</p></div></td></tr>';
        return;
    }

    el.innerHTML = users.map(u => `
        <tr>
            <td>
                <div class="user-cell">
                    <div class="user-avatar-sm">${initials(u.name)}</div>
                    <div>
                        <div class="user-name">${esc(u.name)}</div>
                        <div class="user-email">${esc(u.email)}</div>
                    </div>
                </div>
            </td>
            <td><span class="badge ${roleBadge(u.role)}">${u.role}</span></td>
            <td>${planBadge(u.plan)}</td>
            <td>${u.projectCount ?? 0}</td>
            <td><span class="badge ${u.suspended ? 'badge-danger' : 'badge-success'}">${u.suspended ? 'Suspended' : 'Active'}</span></td>
            <td>${formatDate(u.createdAt)}</td>
            <td>
                <div class="action-btns">
                    <button class="action-btn view" title="View Details" onclick="openUserModal('${u._id}')"><i class="fas fa-eye"></i></button>
                    <button class="action-btn ${u.suspended ? 'success' : 'edit'}" title="${u.suspended ? 'Activate' : 'Suspend'}" onclick="toggleUserStatus('${u._id}', ${!u.suspended})">
                        <i class="fas ${u.suspended ? 'fa-user-check' : 'fa-user-slash'}"></i>
                    </button>
                    <button class="action-btn danger" title="Delete User" onclick="confirmDeleteUser('${u._id}', '${esc(u.name)}')"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>
    `).join('');
}

function renderUsersPagination(p) {
    setEl('usersPaginationInfo', `Showing ${(p.page - 1) * p.limit + 1}–${Math.min(p.page * p.limit, p.total)} of ${p.total}`);
    const el = document.getElementById('usersPaginationBtns');
    if (!el) return;
    el.innerHTML = buildPaginationBtns(p.page, p.pages, 'usersPage');
}

async function openUserModal(userId) {
    const modal = document.getElementById('userDetailModal');
    if (!modal) return;
    modal.classList.add('open');
    document.getElementById('userDetailBody').innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner"></i></div>';

    try {
        const res = await adminRequest(`/users/${userId}`);
        const u = res.data;
        document.getElementById('userDetailBody').innerHTML = `
            <div class="user-detail-header">
                <div class="user-avatar-lg">${initials(u.name)}</div>
                <div class="user-detail-info">
                    <h3>${esc(u.name)}</h3>
                    <p>${esc(u.email)}</p>
                    <span class="badge ${u.suspended ? 'badge-danger' : 'badge-success'} mt-1">${u.suspended ? 'Suspended' : 'Active'}</span>
                </div>
            </div>
            <div class="detail-grid">
                <div class="detail-item"><label>Role</label><p>${u.role}</p></div>
                <div class="detail-item"><label>Company</label><p>${u.company || '—'}</p></div>
                <div class="detail-item"><label>Phone</label><p>${u.phone || '—'}</p></div>
                <div class="detail-item"><label>Joined</label><p>${formatDate(u.createdAt)}</p></div>
                <div class="detail-item"><label>Projects</label><p>${u.projects?.length || 0}</p></div>
                <div class="detail-item"><label>Theme</label><p>${u.preferences?.theme || 'light'}</p></div>
            </div>
            ${u.projects?.length ? `
            <div>
                <h4 style="font-size:0.85rem;color:var(--gray);margin-bottom:0.75rem;text-transform:uppercase;letter-spacing:0.5px;">Projects</h4>
                ${u.projects.slice(0, 5).map(p => `
                    <div class="activity-item">
                        <div class="activity-icon project"><i class="fas fa-home"></i></div>
                        <div class="activity-body">
                            <div class="activity-text"><strong>${esc(p.name)}</strong></div>
                            <div class="activity-time"><span class="badge ${statusBadge(p.status)}">${p.status}</span> · ${formatDate(p.createdAt)}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
            ` : ''}
        `;
    } catch (err) {
        document.getElementById('userDetailBody').innerHTML = `<p style="color:var(--danger)">${err.message}</p>`;
    }
}

async function toggleUserStatus(userId, suspend) {
    try {
        await adminRequest(`/users/${userId}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ suspended: suspend })
        });
        showToast(`User ${suspend ? 'suspended' : 'activated'} successfully`, 'success');
        loadUsers();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

let pendingDeleteUserId = null;
function confirmDeleteUser(userId, name) {
    pendingDeleteUserId = userId;
    const modal = document.getElementById('confirmModal');
    document.getElementById('confirmTitle').textContent = 'Delete User';
    document.getElementById('confirmMessage').textContent = `Are you sure you want to delete "${name}"? This will also delete all their projects. This action cannot be undone.`;
    document.getElementById('confirmBtn').onclick = deleteUser;
    modal.classList.add('open');
}

async function deleteUser() {
    if (!pendingDeleteUserId) return;
    try {
        await adminRequest(`/users/${pendingDeleteUserId}`, { method: 'DELETE' });
        showToast('User deleted successfully', 'success');
        closeModal('confirmModal');
        loadUsers();
    } catch (err) {
        showToast(err.message, 'error');
    }
    pendingDeleteUserId = null;
}

// ─── Projects ─────────────────────────────────────────────────────────────────
async function loadProjects() {
    const el = document.getElementById('projectsTableBody');
    if (el) el.innerHTML = '<tr><td colspan="6" class="loading-spinner"><i class="fas fa-spinner"></i> Loading...</td></tr>';

    try {
        const params = new URLSearchParams({
            page: state.projects.page,
            limit: 15,
            search: state.projects.search,
            sort: state.projects.sort,
            status: state.projects.status,
            type: state.projects.type
        });
        const res = await adminRequest(`/projects?${params}`);
        state.projects.data = res.data;
        state.projects.pages = res.pagination.pages;
        state.projects.total = res.pagination.total;

        renderProjectsTable(res.data);
        renderProjectsPagination(res.pagination);
        setEl('projectsTotalCount', `${res.pagination.total} projects`);
    } catch (err) {
        if (el) el.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>${err.message}</p></div></td></tr>`;
    }
}

function renderProjectsTable(projects) {
    const el = document.getElementById('projectsTableBody');
    if (!el) return;

    if (!projects.length) {
        el.innerHTML = '<tr><td colspan="6"><div class="empty-state"><i class="fas fa-folder-open"></i><p>No projects found</p></div></td></tr>';
        return;
    }

    el.innerHTML = projects.map(p => `
        <tr>
            <td>
                <div>
                    <div class="user-name">${esc(p.name)}</div>
                    <div class="user-email">${p.description ? esc(p.description.slice(0, 50)) + '...' : '—'}</div>
                </div>
            </td>
            <td>
                <div class="user-cell">
                    <div class="user-avatar-sm" style="width:28px;height:28px;font-size:0.7rem">${initials(p.owner?.name || '?')}</div>
                    <span style="font-size:0.85rem">${esc(p.owner?.name || 'Unknown')}</span>
                </div>
            </td>
            <td><span class="badge ${statusBadge(p.status)}">${p.status}</span></td>
            <td><span class="badge badge-gray">${p.type}</span></td>
            <td>${formatDate(p.createdAt)}</td>
            <td>
                <div class="action-btns">
                    <button class="action-btn view" title="View Details" onclick="openProjectModal('${p._id}')"><i class="fas fa-eye"></i></button>
                    <button class="action-btn ${p.isPublic ? 'edit' : 'success'}" title="${p.isPublic ? 'Make Private' : 'Make Public'}" onclick="toggleProjectVisibility('${p._id}', ${!p.isPublic})">
                        <i class="fas ${p.isPublic ? 'fa-eye-slash' : 'fa-globe'}"></i>
                    </button>
                    <button class="action-btn danger" title="Delete Project" onclick="confirmDeleteProject('${p._id}', '${esc(p.name)}')"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>
    `).join('');
}

function renderProjectsPagination(p) {
    setEl('projectsPaginationInfo', `Showing ${(p.page - 1) * p.limit + 1}–${Math.min(p.page * p.limit, p.total)} of ${p.total}`);
    const el = document.getElementById('projectsPaginationBtns');
    if (!el) return;
    el.innerHTML = buildPaginationBtns(p.page, p.pages, 'projectsPage');
}

async function openProjectModal(projectId) {
    const modal = document.getElementById('projectDetailModal');
    if (!modal) return;
    modal.classList.add('open');
    document.getElementById('projectDetailBody').innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner"></i></div>';

    try {
        const res = await adminRequest(`/projects/${projectId}`);
        const p = res.data;
        document.getElementById('projectDetailBody').innerHTML = `
            <div class="detail-grid">
                <div class="detail-item"><label>Project Name</label><p>${esc(p.name)}</p></div>
                <div class="detail-item"><label>Owner</label><p>${esc(p.owner?.name || 'Unknown')}</p></div>
                <div class="detail-item"><label>Status</label><p><span class="badge ${statusBadge(p.status)}">${p.status}</span></p></div>
                <div class="detail-item"><label>Type</label><p>${p.type}</p></div>
                <div class="detail-item"><label>Floors</label><p>${p.floors?.length || 0}</p></div>
                <div class="detail-item"><label>Total Area</label><p>${p.metadata?.totalArea ? p.metadata.totalArea.toFixed(1) + ' m²' : '—'}</p></div>
                <div class="detail-item"><label>Total Rooms</label><p>${p.metadata?.totalRooms || 0}</p></div>
                <div class="detail-item"><label>Est. Cost</label><p>${p.metadata?.estimatedCost ? '$' + p.metadata.estimatedCost.toLocaleString() : '—'}</p></div>
                <div class="detail-item"><label>Visibility</label><p><span class="badge ${p.isPublic ? 'badge-success' : 'badge-gray'}">${p.isPublic ? 'Public' : 'Private'}</span></p></div>
                <div class="detail-item"><label>Created</label><p>${formatDate(p.createdAt)}</p></div>
            </div>
            ${p.description ? `<div style="margin-top:1rem"><label style="font-size:0.75rem;color:var(--gray);text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Description</label><p style="margin-top:0.4rem;font-size:0.9rem;color:var(--dark)">${esc(p.description)}</p></div>` : ''}
        `;
    } catch (err) {
        document.getElementById('projectDetailBody').innerHTML = `<p style="color:var(--danger)">${err.message}</p>`;
    }
}

async function toggleProjectVisibility(projectId, isPublic) {
    try {
        await adminRequest(`/projects/${projectId}/visibility`, {
            method: 'PATCH',
            body: JSON.stringify({ isPublic })
        });
        showToast(`Project made ${isPublic ? 'public' : 'private'}`, 'success');
        loadProjects();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

let pendingDeleteProjectId = null;
function confirmDeleteProject(projectId, name) {
    pendingDeleteProjectId = projectId;
    const modal = document.getElementById('confirmModal');
    document.getElementById('confirmTitle').textContent = 'Delete Project';
    document.getElementById('confirmMessage').textContent = `Are you sure you want to delete "${name}"? This action cannot be undone.`;
    document.getElementById('confirmBtn').onclick = deleteProject;
    modal.classList.add('open');
}

async function deleteProject() {
    if (!pendingDeleteProjectId) return;
    try {
        await adminRequest(`/projects/${pendingDeleteProjectId}`, { method: 'DELETE' });
        showToast('Project deleted successfully', 'success');
        closeModal('confirmModal');
        loadProjects();
    } catch (err) {
        showToast(err.message, 'error');
    }
    pendingDeleteProjectId = null;
}

// ─── Pagination Helper ────────────────────────────────────────────────────────
function buildPaginationBtns(currentPage, totalPages, handler) {
    let html = `<button class="page-btn" onclick="${handler}(${currentPage - 1})" ${currentPage <= 1 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>`;
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, currentPage + 2);
    for (let i = start; i <= end; i++) {
        html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="${handler}(${i})">${i}</button>`;
    }
    html += `<button class="page-btn" onclick="${handler}(${currentPage + 1})" ${currentPage >= totalPages ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>`;
    return html;
}

function usersPage(page) {
    state.users.page = page;
    loadUsers();
}

function projectsPage(page) {
    state.projects.page = page;
    loadProjects();
}

// ─── Modal Helpers ────────────────────────────────────────────────────────────
function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('open');
}

// ─── Utility ──────────────────────────────────────────────────────────────────
function esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function initials(name) {
    if (!name) return '?';
    return name.trim().split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function statusBadge(status) {
    const map = {
        draft: 'badge-gray',
        in_progress: 'badge-info',
        review: 'badge-warning',
        approved: 'badge-success',
        archived: 'badge-gray'
    };
    return map[status] || 'badge-gray';
}

function roleBadge(role) {
    const map = { user: 'badge-info', architect: 'badge-purple', admin: 'badge-danger' };
    return map[role] || 'badge-gray';
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';
    toast.innerHTML = `<i class="fas ${icon}"></i><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        toast.style.transition = 'all 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // Detect which page we're on
    if (document.getElementById('adminLoginForm')) {
        // Login page
        document.getElementById('adminLoginForm').addEventListener('submit', handleAdminLogin);
        return;
    }

    // Dashboard page
    if (!requireAdminAuth()) return;

    // Populate admin info
    const admin = state.admin;
    if (admin) {
        setEl('adminName', admin.name);
        setEl('adminEmail', admin.email);
        setEl('adminNameInitials', initials(admin.name));
    }

    // Nav items
    document.querySelectorAll('.nav-item[data-page]').forEach(item => {
        item.addEventListener('click', () => navigateTo(item.dataset.page));
    });

    // Search users
    const userSearch = document.getElementById('userSearch');
    if (userSearch) {
        let searchTimeout;
        userSearch.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                state.users.search = userSearch.value;
                state.users.page = 1;
                loadUsers();
            }, 400);
        });
    }

    // Sort users
    const userSort = document.getElementById('userSort');
    if (userSort) {
        userSort.addEventListener('change', () => {
            state.users.sort = userSort.value;
            state.users.page = 1;
            loadUsers();
        });
    }

    // Search projects
    const projectSearch = document.getElementById('projectSearch');
    if (projectSearch) {
        let t;
        projectSearch.addEventListener('input', () => {
            clearTimeout(t);
            t = setTimeout(() => {
                state.projects.search = projectSearch.value;
                state.projects.page = 1;
                loadProjects();
            }, 400);
        });
    }

    // Filter projects by status/type
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
        statusFilter.addEventListener('change', () => {
            state.projects.status = statusFilter.value;
            state.projects.page = 1;
            loadProjects();
        });
    }
    const typeFilter = document.getElementById('typeFilter');
    if (typeFilter) {
        typeFilter.addEventListener('change', () => {
            state.projects.type = typeFilter.value;
            state.projects.page = 1;
            loadProjects();
        });
    }

    // Close modals on overlay click
    document.querySelectorAll('.modal-overlay').forEach(m => {
        m.addEventListener('click', (e) => { if (e.target === m) m.classList.remove('open'); });
    });

    // Mobile sidebar toggle
    const menuBtn = document.getElementById('mobileMenuBtn');
    if (menuBtn) {
        menuBtn.addEventListener('click', () => document.getElementById('sidebar').classList.toggle('open'));
    }

    // Initial load
    navigateTo('dashboard');
    startTicketBadgePolling(); // safe to start — auth confirmed above
});

// Expose globals needed by inline onclick
window.navigateTo = navigateTo;
window.openUserModal = openUserModal;
window.openProjectModal = openProjectModal;
window.toggleUserStatus = toggleUserStatus;
window.toggleProjectVisibility = toggleProjectVisibility;
window.confirmDeleteUser = confirmDeleteUser;
window.confirmDeleteProject = confirmDeleteProject;
window.deleteUser = deleteUser;
window.deleteProject = deleteProject;
window.closeModal = closeModal;
window.adminLogout = adminLogout;
window.usersPage = usersPage;
window.projectsPage = projectsPage;

// ─── SUPPORT MESSAGING SYSTEM ──────────────────────────────────────────────────

const TICKET_API = 'https://smartarch-backend.onrender.com/api/tickets';
let currentTicketId = null;

function adminAuthHeaders() {
    const token = state.token || localStorage.getItem('adminToken');
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
}

// Poll for unread badge every 30s
function startTicketBadgePolling() {
    pollAdminUnread();
    setInterval(pollAdminUnread, 30000);
}

async function pollAdminUnread() {
    if (!state.token && !localStorage.getItem('adminToken')) return; // not logged in yet
    try {
        const res = await fetch(`${TICKET_API}/admin/unread-count`, { headers: adminAuthHeaders() });
        const data = await res.json();
        const badge = document.getElementById('adminMsgBadge');
        if (!badge) return;
        if (data.count > 0) {
            badge.textContent = data.count;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    } catch (e) {}
}

async function loadAdminTickets() {
    const filter = document.getElementById('ticketStatusFilter')?.value || 'all';
    const listEl  = document.getElementById('ticketList');
    const countEl = document.getElementById('ticketCountBadge');
    if (!listEl) return; // page not in DOM yet
    listEl.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:120px;color:#6c757d;"><i class="fas fa-spinner fa-spin"></i></div>';
    try {
        const res = await fetch(`${TICKET_API}/admin/all?status=${filter}&limit=50`, { headers: adminAuthHeaders() });
        const data = await res.json();
        if (!data.success) return;
        if (countEl) countEl.textContent = data.total ? `${data.total} ticket${data.total !== 1 ? 's' : ''}` : '';

        if (!data.tickets.length) {
            listEl.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:200px;gap:0.75rem;color:#6c757d;">
                <i class="fas fa-inbox" style="font-size:1.8rem;opacity:0.3;"></i>
                <p style="margin:0;font-size:0.85rem;">No tickets found</p>
            </div>`;
            return;
        }

        listEl.innerHTML = data.tickets.map(t => {
            const isNew = t.status === 'new';
            const statusColors = { new: '#ef4444', seen: '#f59e0b', replied: '#10b981', closed: '#64748b' };
            const statusBg    = { new: 'rgba(239,68,68,0.15)', seen: 'rgba(245,158,11,0.15)', replied: 'rgba(16,185,129,0.15)', closed: 'rgba(100,116,139,0.15)' };
            const color = statusColors[t.status] || '#6c757d';
            const bg    = statusBg[t.status]    || 'rgba(100,116,139,0.15)';
            const time = new Date(t.createdAt).toLocaleDateString('en-US', { month:'short', day:'numeric' });
            return `<div class="ticket-item" onclick="openAdminTicket('${t._id}')" data-id="${t._id}"
                style="padding:0.875rem 1.125rem;border-bottom:1px solid #dee2e6;cursor:pointer;transition:background 0.15s;border-left:3px solid ${isNew ? '#dc3545' : 'transparent'};"
                onmouseover="this.style.background='rgba(255,255,255,0.04)'" onmouseout="if(!this.classList.contains('selected'))this.style.background='transparent'">
                <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:0.5rem;margin-bottom:3px;">
                    <span style="font-weight:${isNew ? '700' : '500'};color:${isNew ? '#1a1a2e' : '#495057'};font-size:0.85rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:190px;">${t.subject}</span>
                    <span style="color:#6c757d;font-size:0.7rem;flex-shrink:0;">${time}</span>
                </div>
                <div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;margin-bottom:3px;">
                    <span style="color:#6c757d;font-size:0.775rem;">${t.name}</span>
                    <span style="background:${bg};color:${color};border:1px solid ${color}44;padding:1px 8px;border-radius:20px;font-size:0.65rem;font-weight:700;text-transform:uppercase;">${t.status}</span>
                </div>
                <p style="margin:0;color:#868e96;font-size:0.75rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${t.message.slice(0, 65)}…</p>
            </div>`;
        }).join('');

        pollAdminUnread();
    } catch (e) {
        console.error('loadAdminTickets error:', e);
    }
}

async function openAdminTicket(id) {
    currentTicketId = id;
    // Highlight selected
    document.querySelectorAll('.ticket-item').forEach(el => { el.style.background = 'transparent'; el.classList.remove('selected'); });
    const sel = document.querySelector(`.ticket-item[data-id="${id}"]`);
    if (sel) { sel.style.background = '#eef0fb'; sel.classList.add('selected'); }

    try {
        const res = await fetch(`${TICKET_API}/admin/${id}`, { headers: adminAuthHeaders() });
        const data = await res.json();
        if (!data.success) return;
        renderAdminTicketDetail(data.ticket);
        loadAdminTickets(); // refresh list to clear new badge
    } catch (e) { console.error(e); }
}

function renderAdminTicketDetail(ticket) {
    document.getElementById('ticketDetailEmpty').style.display = 'none';
    const content = document.getElementById('ticketDetailContent');
    content.style.display = 'flex';

    document.getElementById('tdSubject').textContent = ticket.subject;
    document.getElementById('tdMeta').textContent = `${ticket.name} <${ticket.email}>${ticket.company ? ' · ' + ticket.company : ''} · ${new Date(ticket.createdAt).toLocaleString()}`;

    const statusColors = { new: '#ef4444', seen: '#f59e0b', replied: '#10b981', closed: '#64748b' };
    const statusBgs   = { new: 'rgba(239,68,68,0.15)', seen: 'rgba(245,158,11,0.15)', replied: 'rgba(16,185,129,0.15)', closed: 'rgba(100,116,139,0.15)' };
    const badge = document.getElementById('tdStatusBadge');
    badge.textContent = ticket.status.toUpperCase();
    badge.style.cssText = `padding:3px 12px;border-radius:20px;font-size:0.7rem;font-weight:700;border:1px solid ${statusColors[ticket.status]}55;background:${statusBgs[ticket.status]};color:${statusColors[ticket.status]};`;

    const sel = document.getElementById('tdStatusSelect');
    sel.value = ticket.status === 'new' ? 'seen' : ticket.status;

    // Build thread
    const thread = document.getElementById('tdThread');
    const allMessages = [
        { sender: 'user', senderName: ticket.name, message: ticket.message, createdAt: ticket.createdAt },
        ...ticket.replies
    ];

    thread.innerHTML = allMessages.map(msg => {
        const isAdmin = msg.sender === 'admin';
        const time = new Date(msg.createdAt).toLocaleString('en-US', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
        return `<div style="display:flex;flex-direction:column;align-items:${isAdmin ? 'flex-end' : 'flex-start'};">
            <div style="max-width:78%;background:${isAdmin ? 'linear-gradient(135deg,#667eea,#764ba2)' : '#fff'};border:1px solid ${isAdmin ? 'transparent' : '#dee2e6'};border-radius:${isAdmin ? '14px 14px 4px 14px' : '14px 14px 14px 4px'};padding:0.75rem 1rem;box-shadow:0 2px 6px rgba(0,0,0,0.07);">
                <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:5px;">
                    <span style="font-weight:700;font-size:0.75rem;color:${isAdmin ? 'rgba(255,255,255,0.85)' : '#6c757d'};">${isAdmin ? '🛡 ' + msg.senderName : '👤 ' + msg.senderName}</span>
                    <span style="color:${isAdmin ? 'rgba(255,255,255,0.6)' : '#adb5bd'};font-size:0.7rem;">${time}</span>
                </div>
                <p style="margin:0;color:${isAdmin ? '#fff' : '#1a1a2e'};font-size:0.875rem;line-height:1.65;white-space:pre-wrap;">${msg.message}</p>
            </div>
        </div>`;
    }).join('');

    // Scroll to bottom
    setTimeout(() => { thread.scrollTop = thread.scrollHeight; }, 50);
}

async function sendAdminReply() {
    if (!currentTicketId) return;
    const box = document.getElementById('replyBox');
    const message = box.value.trim();
    if (!message) { box.style.borderColor = '#ef4444'; setTimeout(() => box.style.borderColor = 'rgba(255,255,255,0.1)', 1500); return; }

    try {
        const res = await fetch(`${TICKET_API}/admin/${currentTicketId}/reply`, {
            method: 'POST', headers: adminAuthHeaders(),
            body: JSON.stringify({ message })
        });
        const data = await res.json();
        if (data.success) {
            box.value = '';
            renderAdminTicketDetail(data.ticket);
            loadAdminTickets();
        } else {
            alert(data.message || 'Failed to send reply.');
        }
    } catch (e) { alert('Network error.'); }
}

async function changeTicketStatus(status) {
    if (!currentTicketId) return;
    try {
        const res = await fetch(`${TICKET_API}/admin/${currentTicketId}/status`, {
            method: 'PATCH', headers: adminAuthHeaders(),
            body: JSON.stringify({ status })
        });
        const data = await res.json();
        if (data.success) { renderAdminTicketDetail(data.ticket); loadAdminTickets(); }
    } catch (e) {}
}

// Expose globals
window.loadAdminTickets = loadAdminTickets;
window.openAdminTicket = openAdminTicket;
window.sendAdminReply = sendAdminReply;
window.changeTicketStatus = changeTicketStatus;
window.startTicketBadgePolling = startTicketBadgePolling;

// Start badge polling — only after auth is confirmed (called from init block below)
// DOMContentLoaded hook removed; polling is started by requireAdminAuth success path instead
// ─── Analytics Page ──────────────────────────────────────────────────────────
async function loadAnalytics() {
    // Reuse dashboard data to populate the analytics stat cards + duplicate charts
    try {
        const res = await adminRequest('/dashboard');
        const d = res.data;
        const setEl2 = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        setEl2('stat-total-users-2',    d.stats.totalUsers);
        setEl2('stat-total-projects-2', d.stats.totalProjects);
        setEl2('stat-users-week-2',     d.stats.usersThisWeek);
        setEl2('stat-projects-week-2',  d.stats.projectsThisWeek);

        renderLineChart('userGrowthChart2',    d.userGrowth,        'New Users',    '#667eea');
        renderLineChart('projectGrowthChart2', d.projectGrowth,     'New Projects', '#11998e');
        renderDonut('statusChart2', d.projectsByStatus, 'status');
        renderDonut('typeChart2',   d.projectsByType,   'type');

        const topEl = document.getElementById('topUsersListAnalytics');
        if (topEl) {
            if (!d.topUsers || !d.topUsers.length) {
                topEl.innerHTML = '<div class="empty-state"><i class="fas fa-trophy"></i><p>No data yet</p></div>';
            } else {
                topEl.innerHTML = d.topUsers.map((u, i) => {
                    const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
                    return `<div class="top-user-item">
                        <div class="rank-badge ${rankClass}">${i + 1}</div>
                        <div class="user-avatar-sm">${initials(u.name)}</div>
                        <div class="top-user-info">
                            <div class="top-user-name">${esc(u.name)}</div>
                            <div class="top-user-email">${esc(u.email)}</div>
                        </div>
                        <div class="top-user-count">${u.projectCount} <span style="font-size:0.7rem;color:var(--gray);font-weight:400;">projects</span></div>
                    </div>`;
                }).join('');
            }
        }
    } catch (err) {
        console.error('loadAnalytics error:', err.message);
    }
}

// ─── AI Score Analytics ───────────────────────────────────────────────────────
// All state kept locally — no collision with existing state object.
let _aiScoreData = null;

async function loadAIScoreAnalytics() {
    try {
        const res = await adminRequest('/ai-scores');
        _aiScoreData = res.data;
        renderAIScoreCards(_aiScoreData);
        renderAIRadarChart(_aiScoreData);
        renderAITopProjects(_aiScoreData.topProjects);
        renderAIScoreTable();
    } catch (err) {
        console.error('AI score analytics error:', err.message);
        const tb = document.getElementById('aiScoreTableBody');
        if (tb) tb.innerHTML = `<tr><td colspan="10"><div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>${err.message}</p></div></td></tr>`;
    }
}

function renderAIScoreCards(d) {
    const setCard = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    if (d.analysedProjects === 0) {
        setCard('ais-avg',      'N/A');
        setCard('ais-coverage', '0');
        setCard('ais-high',     'N/A');
        setCard('ais-low',      'N/A');
        setCard('ais-avg-label',      'No analysed projects');
        setCard('ais-coverage-sub',   `0 of ${d.totalProjects} projects`);
        setCard('ais-high-name', '—');
        setCard('ais-low-name',  '—');
        return;
    }

    setCard('ais-avg',           d.averageScore + '/10');
    setCard('ais-coverage',      d.coveragePercent + '%');
    setCard('ais-high',          d.highestScore + '/10');
    setCard('ais-low',           d.lowestScore + '/10');
    setCard('ais-avg-label',     aiScoreLabel(d.averageScore));
    setCard('ais-coverage-sub',  `${d.analysedProjects} of ${d.totalProjects} projects`);

    // Best and worst project names
    const sorted = [...d.allProjects].sort((a, b) => b.overallScore - a.overallScore);
    setCard('ais-high-name', sorted[0]?.name ? sorted[0].name.slice(0, 20) : '—');
    setCard('ais-low-name',  sorted[sorted.length - 1]?.name ? sorted[sorted.length - 1].name.slice(0, 20) : '—');
}

function renderAIRadarChart(d) {
    const canvas = document.getElementById('aiRadarChart');
    const empty  = document.getElementById('aiRadarEmpty');
    if (!canvas) return;

    if (d.analysedProjects === 0) {
        canvas.style.display = 'none';
        if (empty) empty.style.display = 'block';
        return;
    }

    if (empty) empty.style.display = 'none';
    canvas.style.display = 'block';

    if (state.charts['aiRadarChart']) state.charts['aiRadarChart'].destroy();

    const dims = d.dimensionAverages;
    const labels = ['Space', 'Room Flow', 'Light', 'Style', 'Function'];
    const keys   = ['spaceUtilisation', 'roomFlow', 'naturalLight', 'styleConsistency', 'functionalCompleteness'];
    const values = keys.map(k => dims[k]?.average ?? 0);

    state.charts['aiRadarChart'] = new Chart(canvas, {
        type: 'radar',
        data: {
            labels,
            datasets: [{
                label: 'Avg score',
                data: values,
                backgroundColor: 'rgba(102,126,234,0.15)',
                borderColor: '#667eea',
                borderWidth: 2,
                pointBackgroundColor: '#667eea',
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    min: 0,
                    max: 10,
                    ticks: {
                        stepSize: 2,
                        font: { size: 10 },
                        color: '#aaa',
                        backdropColor: 'transparent'
                    },
                    grid:        { color: 'rgba(0,0,0,0.06)' },
                    angleLines:  { color: 'rgba(0,0,0,0.06)' },
                    pointLabels: { font: { size: 11, weight: '600' }, color: '#444' }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => ` ${ctx.parsed.r.toFixed(1)} / 10`
                    }
                }
            }
        }
    });
}

function renderAITopProjects(projects) {
    const el = document.getElementById('aiTopProjectsList');
    if (!el) return;
    if (!projects || !projects.length) {
        el.innerHTML = '<div class="empty-state"><i class="fas fa-folder-open"></i><p>No analysed projects yet</p></div>';
        return;
    }
    const rankClass = i => ['gold','silver','bronze','other','other'][i] || 'other';
    el.innerHTML = projects.map((p, i) => `
        <div class="ais-project-row">
            <div class="ais-rank ${rankClass(i)}">${i + 1}</div>
            <div style="flex:1;min-width:0;">
                <div style="font-size:0.85rem;font-weight:600;color:var(--dark);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(p.name)}</div>
                <div style="font-size:0.75rem;color:var(--gray);">${esc(p.owner?.name || 'Unknown')}</div>
            </div>
            <div class="ais-score-pill ${aiScorePillClass(p.overallScore)}">${p.overallScore}/10</div>
        </div>
    `).join('');
}

function renderAIScoreTable() {
    const el   = document.getElementById('aiScoreTableBody');
    const sort = document.getElementById('aiScoreSort')?.value || 'score-desc';
    if (!el) return;

    if (!_aiScoreData || !_aiScoreData.allProjects) {
        el.innerHTML = '<tr><td colspan="10"><div class="loading-spinner"><i class="fas fa-spinner"></i></div></td></tr>';
        return;
    }

    if (!_aiScoreData.allProjects.length) {
        el.innerHTML = '<tr><td colspan="10"><div class="empty-state"><i class="fas fa-folder-open"></i><p>No analysed projects yet</p></div></td></tr>';
        return;
    }

    const rows = [..._aiScoreData.allProjects].sort((a, b) => {
        if (sort === 'score-desc') return b.overallScore - a.overallScore;
        if (sort === 'score-asc')  return a.overallScore - b.overallScore;
        if (sort === 'name')       return (a.name || '').localeCompare(b.name || '');
        if (sort === 'date')       return new Date(b.analysedAt || 0) - new Date(a.analysedAt || 0);
        return 0;
    });

    const dimCell = v => v != null
        ? `<td class="ais-dim-cell" style="color:${aiDimColor(v)}">${v}</td>`
        : `<td class="ais-dim-cell" style="color:#ddd">—</td>`;

    el.innerHTML = rows.map((p, i) => `
        <tr>
            <td style="font-size:0.78rem;color:var(--gray);font-weight:600;">${i + 1}</td>
            <td>
                <div style="font-size:0.85rem;font-weight:600;color:var(--dark);">${esc(p.name)}</div>
                <div style="font-size:0.75rem;color:var(--gray);">${p.analysedAt ? formatDate(p.analysedAt) : '—'}</div>
            </td>
            <td>
                <div class="user-cell">
                    <div class="user-avatar-sm" style="width:26px;height:26px;font-size:0.65rem">${initials(p.owner?.name || '?')}</div>
                    <span style="font-size:0.82rem">${esc(p.owner?.name || 'Unknown')}</span>
                </div>
            </td>
            <td style="text-align:center"><span class="ais-score-pill ${aiScorePillClass(p.overallScore)}">${p.overallScore}/10</span></td>
            ${dimCell(p.dimensions?.spaceUtilisation)}
            ${dimCell(p.dimensions?.roomFlow)}
            ${dimCell(p.dimensions?.naturalLight)}
            ${dimCell(p.dimensions?.styleConsistency)}
            ${dimCell(p.dimensions?.functionalCompleteness)}
            <td style="font-size:0.75rem;color:var(--gray);">${p.analysedAt ? formatDate(p.analysedAt) : '—'}</td>
        </tr>
    `).join('');
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function aiScoreLabel(score) {
    if (score >= 9) return 'Excellent';
    if (score >= 7) return 'Good';
    if (score >= 5) return 'Needs work';
    if (score >= 3) return 'Poor';
    return 'Critical';
}

function aiScorePillClass(score) {
    if (score >= 8) return 'excellent';
    if (score >= 6) return 'good';
    if (score >= 4) return 'needs';
    return 'poor';
}

function aiDimColor(v) {
    if (v >= 8) return '#059669';
    if (v >= 6) return '#b45309';
    if (v >= 4) return '#c2410c';
    return '#dc2626';
}

// Expose globally so the sort <select> inline onchange works
window.renderAIScoreTable    = renderAIScoreTable;
window.loadAIScoreAnalytics  = loadAIScoreAnalytics;

// ─── Reviews ──────────────────────────────────────────────────────────────────
async function reviewsRequest(endpoint, options = {}) {
    const url = `https://smartarch-backend.onrender.com/api/reviews${endpoint}`;
    const config = {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(state.token ? { 'Authorization': `Bearer ${state.token}` } : {}),
            ...options.headers
        }
    };
    const res  = await fetch(url, config);
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Request failed');
    return data;
}

async function loadAdminReviews() {
    try {
        const res  = await reviewsRequest('/admin/stats');
        const data = res.data;

        // ── Stat cards ────────────────────────────────────────────────────────
        setEl('rv-stat-total', data.totalReviews ?? '0');
        setEl('rv-stat-avg',   data.overallAverage != null ? `${data.overallAverage} ★` : '—');
        setEl('rv-stat-five',  data.distribution ? data.distribution[4] : '0');
        setEl('rv-stat-top',
            data.topProjects && data.topProjects.length
                ? data.topProjects[0].projectName
                : '—'
        );

        // ── Distribution bar chart ────────────────────────────────────────────
        const distCtx = document.getElementById('rvDistChart');
        if (distCtx) {
            if (distCtx._rvChart) distCtx._rvChart.destroy();
            distCtx._rvChart = new Chart(distCtx, {
                type: 'bar',
                data: {
                    labels: ['1 ★', '2 ★', '3 ★', '4 ★', '5 ★'],
                    datasets: [{
                        label: 'Reviews',
                        data: data.distribution || [0,0,0,0,0],
                        backgroundColor: [
                            'rgba(239,68,68,.75)',
                            'rgba(249,115,22,.75)',
                            'rgba(234,179,8,.75)',
                            'rgba(34,197,94,.75)',
                            'rgba(102,126,234,.85)'
                        ],
                        borderRadius: 6,
                        borderSkipped: false
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { grid: { color: 'rgba(255,255,255,.06)' }, ticks: { color: '#94a3b8' } },
                        y: {
                            grid: { color: 'rgba(255,255,255,.06)' },
                            ticks: { color: '#94a3b8', stepSize: 1 },
                            beginAtZero: true
                        }
                    }
                }
            });
        }

        // ── Top rated projects list ───────────────────────────────────────────
        const topEl = document.getElementById('rvTopProjectsList');
        if (topEl) {
            if (!data.topProjects || !data.topProjects.length) {
                topEl.innerHTML = '<p style="color:var(--gray);font-size:.85rem">No reviews yet.</p>';
            } else {
                topEl.innerHTML = data.topProjects.map((p, i) => `
                    <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.05)">
                        <span style="font-size:1rem;width:22px;text-align:center">${['🥇','🥈','🥉','4️⃣','5️⃣'][i] || (i+1)}</span>
                        <div style="flex:1;min-width:0">
                            <div style="font-size:.85rem;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escAdm(p.projectName)}</div>
                            <div style="font-size:.75rem;color:var(--gray)">${escAdm(p.ownerName || '')} · ${p.reviewCount} review${p.reviewCount !== 1 ? 's' : ''}</div>
                        </div>
                        <div style="text-align:right;flex-shrink:0">
                            <div style="font-size:.9rem;font-weight:700;color:#f59e0b">${p.avgRating} ★</div>
                        </div>
                    </div>`).join('');
            }
        }

        // ── Recent reviews feed ───────────────────────────────────────────────
        const feedEl = document.getElementById('rvRecentFeed');
        if (feedEl) {
            if (!data.recentReviews || !data.recentReviews.length) {
                feedEl.innerHTML = '<p style="color:var(--gray);font-size:.85rem">No reviews yet.</p>';
            } else {
                feedEl.innerHTML = `
                    <table style="width:100%;border-collapse:collapse;font-size:.83rem">
                        <thead>
                            <tr style="color:var(--gray);text-align:left;border-bottom:1px solid rgba(255,255,255,.08)">
                                <th style="padding:6px 10px">Reviewer</th>
                                <th style="padding:6px 10px">Project</th>
                                <th style="padding:6px 10px;text-align:center">Rating</th>
                                <th style="padding:6px 10px">Comment</th>
                                <th style="padding:6px 10px">Date</th>
                                <th style="padding:6px 10px;text-align:center">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.recentReviews.map(r => `
                            <tr style="border-bottom:1px solid rgba(255,255,255,.04);transition:background .15s" onmouseover="this.style.background='rgba(255,255,255,.03)'" onmouseout="this.style.background=''">
                                <td style="padding:8px 10px">
                                    <div style="font-weight:600;color:var(--text)">${escAdm(r.reviewer?.name || 'Unknown')}</div>
                                    <div style="font-size:.73rem;color:var(--gray)">${escAdm(r.reviewer?.email || '')}</div>
                                </td>
                                <td style="padding:8px 10px;color:var(--text-secondary);max-width:140px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                                    ${escAdm(r.project?.name || '—')}
                                </td>
                                <td style="padding:8px 10px;text-align:center">
                                    <span style="color:#f59e0b;font-weight:700">${r.rating} ★</span>
                                </td>
                                <td style="padding:8px 10px;color:var(--gray);max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                                    ${r.comment ? escAdm(r.comment) : '<em style="color:#475569">No comment</em>'}
                                </td>
                                <td style="padding:8px 10px;color:var(--gray);white-space:nowrap">
                                    ${new Date(r.createdAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
                                </td>
                                <td style="padding:8px 10px;text-align:center">
                                    <button onclick="adminRemoveReview('${r._id}')"
                                        style="background:rgba(239,68,68,.15);border:none;color:#f87171;padding:3px 10px;border-radius:5px;cursor:pointer;font-size:.75rem">
                                        <i class="fas fa-trash-alt"></i>
                                    </button>
                                </td>
                            </tr>`).join('')}
                        </tbody>
                    </table>`;
            }
        }
    } catch (err) {
        console.error('loadAdminReviews error:', err);
    }
}

async function adminRemoveReview(reviewId) {
    if (!confirm('Delete this review? This cannot be undone.')) return;
    try {
        await reviewsRequest(`/admin/${reviewId}`, { method: 'DELETE' });
        loadAdminReviews();
    } catch (err) {
        alert(err.message || 'Could not delete review');
    }
}

function escAdm(str) {
    return String(str || '')
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

window.adminRemoveReview = adminRemoveReview;
window.loadAdminReviews  = loadAdminReviews;

// ─── App Ratings ──────────────────────────────────────────────────────────────
async function appRatingsRequest(endpoint, options = {}) {
    const url = `https://smartarch-backend.onrender.com/api/app-ratings${endpoint}`;
    const config = {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(state.token ? { 'Authorization': `Bearer ${state.token}` } : {}),
            ...options.headers
        }
    };
    const res  = await fetch(url, config);
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Request failed');
    return data;
}

// Stores full recent list for client-side filtering
let _arAllRecent = [];
let _arActiveFilter = 'all';

function _buildMiniChart(canvasId, dist, color) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    if (ctx._miniChart) ctx._miniChart.destroy();
    ctx._miniChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['1','2','3','4','5'],
            datasets: [{ data: dist,
                backgroundColor: color + '99',
                borderColor: color,
                borderWidth: 1,
                borderRadius: 3,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            scales: {
                x: { display: false },
                y: { display: false, beginAtZero: true }
            }
        }
    });
}

function _renderArFeed(list) {
    const feedEl = document.getElementById('arRecentFeed');
    if (!feedEl) return;
    if (!list || !list.length) {
        feedEl.innerHTML = '<p style="color:var(--gray);font-size:.85rem">No ratings for this filter.</p>';
        return;
    }

    const roleBadge = (r) => {
        if (r.userRole === 'client')    return '<span style="background:rgba(6,182,212,.15);color:#06b6d4;border-radius:4px;padding:1px 7px;font-size:.68rem;font-weight:600">Client</span>';
        if (r.userRole === 'architect') return '<span style="background:rgba(124,58,237,.15);color:#7c3aed;border-radius:4px;padding:1px 7px;font-size:.68rem;font-weight:600">Architect</span>';
        return '<span style="background:rgba(148,163,184,.1);color:#94a3b8;border-radius:4px;padding:1px 7px;font-size:.68rem">Guest</span>';
    };

    feedEl.innerHTML =
        '<table style="width:100%;border-collapse:collapse;font-size:.83rem">' +
            '<thead><tr style="color:var(--gray);text-align:left;border-bottom:1px solid rgba(255,255,255,.08)">' +
                '<th style="padding:6px 10px">User</th>' +
                '<th style="padding:6px 10px">Role</th>' +
                '<th style="padding:6px 10px;text-align:center">Rating</th>' +
                '<th style="padding:6px 10px">Comment</th>' +
                '<th style="padding:6px 10px">Page</th>' +
                '<th style="padding:6px 10px">Date</th>' +
                '<th style="padding:6px 10px;text-align:center">Action</th>' +
            '</tr></thead>' +
            '<tbody>' +
            list.map(r =>
                '<tr style="border-bottom:1px solid rgba(255,255,255,.04)" ' +
                    'onmouseover="this.style.background=\'rgba(255,255,255,.03)\'" ' +
                    'onmouseout="this.style.background=\'\'">' +
                    '<td style="padding:8px 10px">' +
                        (r.user
                            ? '<div style="font-weight:600;color:var(--text)">' + escAdm(r.user.name) + '</div>' +
                              '<div style="font-size:.73rem;color:var(--gray)">' + escAdm(r.user.email) + '</div>'
                            : '<div style="color:var(--gray);font-style:italic">Guest</div>') +
                    '</td>' +
                    '<td style="padding:8px 10px">' + roleBadge(r) + '</td>' +
                    '<td style="padding:8px 10px;text-align:center"><span style="color:#f59e0b;font-weight:700">' + r.rating + ' ★</span></td>' +
                    '<td style="padding:8px 10px;color:var(--gray);max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' +
                        (r.comment ? escAdm(r.comment) : '<em style="color:#475569">—</em>') +
                    '</td>' +
                    '<td style="padding:8px 10px;color:var(--gray);font-size:.75rem">' + escAdm(r.page || '—') + '</td>' +
                    '<td style="padding:8px 10px;color:var(--gray);white-space:nowrap">' +
                        new Date(r.createdAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) +
                    '</td>' +
                    '<td style="padding:8px 10px;text-align:center">' +
                        '<button onclick="adminDeleteAppRating(\'' + r._id + '\')" ' +
                            'style="background:rgba(239,68,68,.15);border:none;color:#f87171;padding:3px 10px;border-radius:5px;cursor:pointer;font-size:.75rem">' +
                            '<i class="fas fa-trash-alt"></i>' +
                        '</button>' +
                    '</td>' +
                '</tr>'
            ).join('') +
            '</tbody></table>';
}

function filterArFeed(role) {
    _arActiveFilter = role;
    // Update button styles
    ['all','architect','client'].forEach(function(r) {
        const btn = document.getElementById('ar-filter-' + r);
        if (!btn) return;
        if (r === role) {
            btn.style.background = 'linear-gradient(135deg,rgba(102,126,234,.25),rgba(118,75,162,.25))';
            btn.style.color      = '#f1f5f9';
            btn.style.fontWeight = '600';
        } else {
            btn.style.background = 'none';
            btn.style.color      = '#94a3b8';
            btn.style.fontWeight = 'normal';
        }
    });
    const filtered = role === 'all' ? _arAllRecent : _arAllRecent.filter(r => r.userRole === role);
    _renderArFeed(filtered);
}

async function loadAppRatingStats() {
    try {
        const res  = await appRatingsRequest('/admin/stats');
        const data = res.data;

        setEl('ar-stat-total', data.total ?? '0');
        setEl('ar-stat-avg',   data.overallAverage != null ? `${data.overallAverage} ★` : '—');
        setEl('ar-stat-five',  data.distribution ? data.distribution[4] : '0');

        // Most common rating
        const dist = data.distribution || [0,0,0,0,0];
        const topIdx = dist.indexOf(Math.max(...dist));
        setEl('ar-stat-common', topIdx >= 0 ? `${topIdx + 1} ★` : '—');

        // Role breakdown cards
        const arch   = (data.byRole && data.byRole.architect) || null;
        const client = (data.byRole && data.byRole.client)    || null;
        setEl('ar-arch-count',   arch   ? arch.count       : '0');
        setEl('ar-arch-avg',     arch   ? arch.avg + ' ★'  : '—');
        setEl('ar-client-count', client ? client.count      : '0');
        setEl('ar-client-avg',   client ? client.avg + ' ★' : '—');

        // Mini bar charts for role cards
        _buildMiniChart('arArchMiniChart',   arch   ? arch.distribution   : [0,0,0,0,0], '#7c3aed');
        _buildMiniChart('arClientMiniChart', client ? client.distribution : [0,0,0,0,0], '#06b6d4');

        // Main distribution bar chart
        const ctx = document.getElementById('arDistChart');
        if (ctx) {
            if (ctx._arChart) ctx._arChart.destroy();
            ctx._arChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['1 ★','2 ★','3 ★','4 ★','5 ★'],
                    datasets: [{
                        label: 'Ratings',
                        data: dist,
                        backgroundColor: [
                            'rgba(239,68,68,.75)',
                            'rgba(249,115,22,.75)',
                            'rgba(234,179,8,.75)',
                            'rgba(34,197,94,.75)',
                            'rgba(102,126,234,.85)'
                        ],
                        borderRadius: 6,
                        borderSkipped: false
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { grid: { color:'rgba(255,255,255,.06)' }, ticks: { color:'#94a3b8' } },
                        y: { grid: { color:'rgba(255,255,255,.06)' }, ticks: { color:'#94a3b8', stepSize:1 }, beginAtZero: true }
                    }
                }
            });
        }

        // Recent feed — store and render with current filter
        _arAllRecent = data.recent || [];
        filterArFeed(_arActiveFilter);

    } catch (err) {
        console.error('loadAppRatingStats error:', err);
    }
}

async function adminDeleteAppRating(id) {
    if (!confirm('Delete this rating?')) return;
    try {
        await appRatingsRequest(`/admin/${id}`, { method: 'DELETE' });
        loadAppRatingStats();
    } catch (err) {
        alert(err.message || 'Could not delete rating');
    }
}

window.loadAppRatingStats     = loadAppRatingStats;
window.adminDeleteAppRating   = adminDeleteAppRating;
window.filterArFeed           = filterArFeed;