// js/admin-restructured.js  — Architect + Client split modules
// Depends on: admin.js (state, adminRequest, esc, initials, formatDate, showToast,
//             closeModal, buildPaginationBtns, roleBadge, planBadge, statusBadge,
//             loadDashboard, loadProjects, all chart helpers)
'use strict';

/* ─────────────────────────────────────────────────────────────────────────────
   STATE
───────────────────────────────────────────────────────────────────────────── */
const RS = {
    architects : { data:[], page:1, pages:1, total:0, search:'', sort:'-createdAt', verified:'', plan:'' },
    clients    : { data:[], page:1, pages:1, total:0, search:'', sort:'-createdAt' },
    requests   : { data:[], page:1, pages:1, total:0, search:'', sort:'-createdAt', status:'', type:'' },
    currentArchId   : null,
    currentClientId : null,
    currentClientTicketId : null,
};

const CLIENT_TICKET_API = 'https://smartarch-backend.onrender.com/api/client/support';

/* ─────────────────────────────────────────────────────────────────────────────
   NAVIGATION PATCH  — extend existing navigateTo
───────────────────────────────────────────────────────────────────────────── */
(function patchNavigate() {
    const _orig = window.navigateTo;
    const TITLES = {
        architects    : { title:'Architects',       subtitle:'Manage all architect accounts' },
        clients       : { title:'Clients',          subtitle:'Manage all client accounts' },
        requests      : { title:'Requests',         subtitle:'Client ↔ Architect project briefs' },
        'arch-support': { title:'Architect Support',subtitle:'Architect support tickets' },
        'client-support':{ title:'Client Support',  subtitle:'Client support tickets' },
        analytics     : { title:'Analytics',        subtitle:'Detailed statistics & charts' },
    };

    window.navigateTo = function(page) {
        _orig(page);
        if (TITLES[page]) {
            const el  = document.getElementById('pageTitle');
            const sub = document.getElementById('pageSubtitle');
            if (el)  el.textContent  = TITLES[page].title;
            if (sub) sub.textContent = TITLES[page].subtitle;
        }
        if (page === 'architects')     loadArchitects();
        if (page === 'clients')        loadClients();
        if (page === 'requests')       loadRequests();
        if (page === 'arch-support')   loadAdminTickets();
        if (page === 'client-support') loadClientSupportTickets();
        if (page === 'analytics')      { loadAnalyticsArch(); loadAIScoreAnalytics(); }
    };
    window.navigateTo = window.navigateTo; // reassign so admin.js's post-DOMContentLoaded also uses it
})();

/* ─────────────────────────────────────────────────────────────────────────────
   DASHBOARD PATCH — replace loadDashboard to add architects/clients/requests
───────────────────────────────────────────────────────────────────────────── */
(function patchDashboard() {
    const _origLoad = window.loadDashboard || function(){};

    window.loadDashboard = async function() {
        await _origLoad();          // run original (fills projects/charts/topUsers)
        await loadDashboardExtras();
    };

    async function loadDashboardExtras() {
        try {
            const token = (window.state && window.state.token) || localStorage.getItem('adminToken');
            const headers = { 'Content-Type':'application/json', 'Authorization': `Bearer ${token}` };

            // Fetch architect + client counts in parallel
            const [archRes, clientRes, reqRes] = await Promise.all([
                fetch('https://smartarch-backend.onrender.com/api/admin/users?role=architect&limit=1', {headers}).then(r=>r.json()).catch(()=>null),
                fetch('https://smartarch-backend.onrender.com/api/admin/users?role=client&limit=1', {headers}).then(r=>r.json()).catch(()=>null),
                fetch('https://smartarch-backend.onrender.com/api/admin/client-projects?limit=1', {headers}).then(r=>r.json()).catch(()=>null),
            ]);

            const setEl = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v; };

            if (archRes && archRes.pagination) {
                setEl('stat-total-architects', archRes.pagination.total ?? '—');
                const thisWeek = archRes.thisWeek ?? archRes.pagination.thisWeek ?? '—';
                setEl('stat-architects-week', '+' + thisWeek);
            }
            if (clientRes && clientRes.pagination) {
                setEl('stat-total-clients', clientRes.pagination.total ?? '—');
                const thisWeek = clientRes.thisWeek ?? clientRes.pagination.thisWeek ?? '—';
                setEl('stat-clients-week', '+' + thisWeek);
            }
            if (reqRes && reqRes.pagination) {
                setEl('stat-total-requests', reqRes.pagination.total ?? '—');
                const pending = reqRes.pending ?? reqRes.pagination.pending ?? '—';
                setEl('stat-pending-requests', pending + ' pending');
            }

            // Patch "Recent Users" → "Top Architects" rename (DOM title already updated by HTML)
        } catch(e) { console.warn('Dashboard extras error:', e.message); }
    }
})();

/* ─────────────────────────────────────────────────────────────────────────────
   ARCHITECTS MODULE
───────────────────────────────────────────────────────────────────────────── */
async function loadArchitects() {
    const tbody = document.getElementById('archsTableBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="9"><div class="loading-spinner"><i class="fas fa-spinner"></i></div></td></tr>';

    try {
        const params = new URLSearchParams({
            page    : RS.architects.page,
            limit   : 15,
            search  : RS.architects.search,
            sort    : RS.architects.sort,
            role    : 'architect',
        });
        if (RS.architects.verified !== '') params.set('verified', RS.architects.verified);
        if (RS.architects.plan)            params.set('plan',     RS.architects.plan);

        const res = await adminRequest(`/users?${params}`);
        RS.architects.data  = res.data;
        RS.architects.pages = res.pagination.pages;
        RS.architects.total = res.pagination.total;

        renderArchsTable(res.data);
        renderArchsPagination(res.pagination);
        setEl2('archsTotalCount', `${res.pagination.total} architects`);

        // Stats bar
        const stats = res.roleStats || {};
        setEl2('arch-stat-total',     res.pagination.total);
        setEl2('arch-stat-verified',  stats.verified  ?? '—');
        setEl2('arch-stat-pending',   stats.unverified ?? '—');
        setEl2('arch-stat-suspended', stats.suspended  ?? '—');
    } catch(err) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>${esc(err.message)}</p></div></td></tr>`;
    }
}

function renderArchsTable(users) {
    const el = document.getElementById('archsTableBody');
    if (!el) return;
    if (!users.length) { el.innerHTML = '<tr><td colspan="9"><div class="empty-state"><i class="fas fa-hard-hat"></i><p>No architects found</p></div></td></tr>'; return; }

    el.innerHTML = users.map(u => `
        <tr>
            <td>
                <div class="user-cell">
                    <div class="user-avatar-sm">${initials(u.name)}</div>
                    <div><div class="user-name">${esc(u.name)}</div><div class="user-email">${esc(u.email)}</div></div>
                </div>
            </td>
            <td><span class="text-muted-sm">${esc(u.specialization || '—')}</span></td>
            <td>${planBadge(u.plan)}</td>
            <td><strong>${u.projectCount ?? 0}</strong></td>
            <td>
                ${u.rating ? `<span class="rating-pill"><i class="fas fa-star"></i> ${Number(u.rating).toFixed(1)}</span>` : '<span style="color:var(--gray)">—</span>'}
            </td>
            <td>
                ${u.isVerified
                    ? '<span class="badge badge-success"><i class="fas fa-check"></i> Verified</span>'
                    : '<span class="badge badge-warning"><i class="fas fa-clock"></i> Pending</span>'}
            </td>
            <td><span class="badge ${u.suspended ? 'badge-danger' : 'badge-success'}">${u.suspended ? 'Suspended' : 'Active'}</span></td>
            <td>${formatDate(u.createdAt)}</td>
            <td>
                <div class="action-btns">
                    <button class="action-btn view"   title="View Profile"  onclick="openArchModal('${u._id}')"><i class="fas fa-eye"></i></button>
                    <button class="action-btn ${u.isVerified ? 'edit' : 'success'}" title="${u.isVerified ? 'Revoke Verification' : 'Verify Architect'}" onclick="quickVerifyArch('${u._id}', ${!u.isVerified})">
                        <i class="fas ${u.isVerified ? 'fa-times-circle' : 'fa-check-circle'}"></i>
                    </button>
                    <button class="action-btn ${u.suspended ? 'success' : 'edit'}" title="${u.suspended ? 'Activate' : 'Suspend'}" onclick="toggleArchStatus('${u._id}', ${!u.suspended})">
                        <i class="fas ${u.suspended ? 'fa-user-check' : 'fa-user-slash'}"></i>
                    </button>
                    <button class="action-btn danger" title="Delete" onclick="confirmDeleteArch('${u._id}','${esc(u.name)}')"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>
    `).join('');
}

function renderArchsPagination(p) {
    setEl2('archsPaginationInfo', `Showing ${Math.min((p.page-1)*p.limit+1, p.total)}–${Math.min(p.page*p.limit, p.total)} of ${p.total}`);
    const el = document.getElementById('archsPaginationBtns');
    if (el) el.innerHTML = buildPaginationBtns(p.page, p.pages, 'archsPage');
}

window.archsPage = function(page) { RS.architects.page = page; loadArchitects(); };

async function openArchModal(userId) {
    RS.currentArchId = userId;
    const modal = document.getElementById('archDetailModal');
    if (!modal) return;
    modal.classList.add('open');
    document.getElementById('archDetailBody').innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner"></i></div>';

    try {
        const res = await adminRequest(`/users/${userId}`);
        const u   = res.data;
        document.getElementById('archDetailBody').innerHTML = `
            <div class="user-detail-header">
                <div class="user-avatar-lg">${initials(u.name)}</div>
                <div class="user-detail-info">
                    <h3>${esc(u.name)}</h3>
                    <p>${esc(u.email)}</p>
                    <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:0.4rem;">
                        <span class="badge ${u.suspended ? 'badge-danger' : 'badge-success'}">${u.suspended ? 'Suspended' : 'Active'}</span>
                        ${u.isVerified ? '<span class="badge badge-success"><i class="fas fa-check"></i> Verified</span>' : '<span class="badge badge-warning">Unverified</span>'}
                        ${planBadge(u.plan)}
                    </div>
                </div>
            </div>
            <div class="detail-grid">
                <div class="detail-item"><label>Specialization</label><p>${esc(u.specialization || '—')}</p></div>
                <div class="detail-item"><label>Experience</label><p>${u.experience ? u.experience + ' yrs' : '—'}</p></div>
                <div class="detail-item"><label>Location</label><p>${esc(u.location || '—')}</p></div>
                <div class="detail-item"><label>Company</label><p>${esc(u.company || '—')}</p></div>
                <div class="detail-item"><label>Phone</label><p>${esc(u.phone || '—')}</p></div>
                <div class="detail-item"><label>Rating</label><p>${u.rating ? `<span class="rating-pill"><i class="fas fa-star"></i> ${Number(u.rating).toFixed(1)}</span>` : '—'}</p></div>
                <div class="detail-item"><label>Total Projects</label><p>${u.projects?.length ?? u.projectCount ?? 0}</p></div>
                <div class="detail-item"><label>Joined</label><p>${formatDate(u.createdAt)}</p></div>
            </div>
            ${u.bio ? `<div style="margin-top:1rem"><label style="font-size:0.75rem;color:var(--gray);text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Bio</label><p style="margin-top:0.4rem;font-size:0.9rem;color:var(--dark)">${esc(u.bio)}</p></div>` : ''}
            ${u.projects?.length ? `
            <div style="margin-top:1.25rem">
                <h4 style="font-size:0.85rem;color:var(--gray);margin-bottom:0.75rem;text-transform:uppercase;letter-spacing:0.5px;">Recent Projects</h4>
                ${u.projects.slice(0,4).map(p=>`
                    <div class="activity-item">
                        <div class="activity-icon project"><i class="fas fa-home"></i></div>
                        <div class="activity-body">
                            <div class="activity-text"><strong>${esc(p.name)}</strong></div>
                            <div class="activity-time"><span class="badge ${statusBadge(p.status)}">${p.status}</span> · ${formatDate(p.createdAt)}</div>
                        </div>
                    </div>`).join('')}
            </div>` : ''}
        `;
        // Show action buttons
        const verifyBtn = document.getElementById('archVerifyBtn');
        const suspendBtn = document.getElementById('archToggleSuspendBtn');
        if (verifyBtn) {
            verifyBtn.style.display = u.isVerified ? 'none' : '';
            verifyBtn.dataset.userId = userId;
            verifyBtn.dataset.verify = 'true';
        }
        if (suspendBtn) {
            suspendBtn.style.display = '';
            suspendBtn.dataset.userId   = userId;
            suspendBtn.dataset.suspend  = String(!u.suspended);
            suspendBtn.innerHTML = u.suspended
                ? '<i class="fas fa-user-check"></i> Activate'
                : '<i class="fas fa-user-slash"></i> Suspend';
            suspendBtn.className = u.suspended ? 'btn btn-success' : 'btn btn-warning';
        }
    } catch(err) {
        document.getElementById('archDetailBody').innerHTML = `<p style="color:var(--danger)">${esc(err.message)}</p>`;
    }
}

window.verifyArchitectModal = async function() {
    const btn = document.getElementById('archVerifyBtn');
    if (!btn) return;
    const userId = btn.dataset.userId;
    await quickVerifyArch(userId, true);
    closeModal('archDetailModal');
};

window.toggleArchSuspend = async function() {
    const btn = document.getElementById('archToggleSuspendBtn');
    if (!btn) return;
    const userId  = btn.dataset.userId;
    const suspend = btn.dataset.suspend === 'true';
    await toggleArchStatus(userId, suspend);
    closeModal('archDetailModal');
};

async function quickVerifyArch(userId, verify) {
    try {
        await adminRequest(`/users/${userId}/verify`, { method:'PATCH', body: JSON.stringify({ isVerified: verify }) });
        showToast(`Architect ${verify ? 'verified' : 'unverified'} successfully`, 'success');
        loadArchitects();
    } catch(err) { showToast(err.message, 'error'); }
}

async function toggleArchStatus(userId, suspend) {
    try {
        await adminRequest(`/users/${userId}/status`, { method:'PATCH', body: JSON.stringify({ suspended: suspend }) });
        showToast(`Architect ${suspend ? 'suspended' : 'activated'}`, 'success');
        loadArchitects();
    } catch(err) { showToast(err.message, 'error'); }
}

let _pendingDeleteArch = null;
function confirmDeleteArch(userId, name) {
    _pendingDeleteArch = userId;
    document.getElementById('confirmTitle').textContent   = 'Delete Architect';
    document.getElementById('confirmMessage').textContent = `Delete "${name}"? This will also delete all their projects.`;
    document.getElementById('confirmBtn').onclick = async function() {
        try {
            await adminRequest(`/users/${_pendingDeleteArch}`, { method:'DELETE' });
            showToast('Architect deleted', 'success');
            closeModal('confirmModal');
            loadArchitects();
        } catch(err) { showToast(err.message, 'error'); }
        _pendingDeleteArch = null;
    };
    document.getElementById('confirmModal').classList.add('open');
}

// DOMContentLoaded – wire Architect search/filter/sort
document.addEventListener('DOMContentLoaded', () => {
    // Arch search
    const archSearch = document.getElementById('archSearch');
    if (archSearch) {
        let t;
        archSearch.addEventListener('input', () => {
            clearTimeout(t);
            t = setTimeout(() => { RS.architects.search = archSearch.value; RS.architects.page = 1; loadArchitects(); }, 400);
        });
    }
    // Arch filters
    ['archVerifiedFilter','archPlanFilter','archSort'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('change', () => {
            if (id === 'archVerifiedFilter') RS.architects.verified = el.value;
            if (id === 'archPlanFilter')     RS.architects.plan     = el.value;
            if (id === 'archSort')           RS.architects.sort     = el.value;
            RS.architects.page = 1;
            loadArchitects();
        });
    });
});

/* ─────────────────────────────────────────────────────────────────────────────
   CLIENTS MODULE
───────────────────────────────────────────────────────────────────────────── */
async function loadClients() {
    const tbody = document.getElementById('clientsTableBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="7"><div class="loading-spinner"><i class="fas fa-spinner"></i></div></td></tr>';

    try {
        const params = new URLSearchParams({
            page  : RS.clients.page,
            limit : 15,
            search: RS.clients.search,
            sort  : RS.clients.sort,
            role  : 'client',
        });
        const res = await adminRequest(`/users?${params}`);
        RS.clients.data  = res.data;
        RS.clients.pages = res.pagination.pages;
        RS.clients.total = res.pagination.total;

        renderClientsTable(res.data);
        renderClientsPagination(res.pagination);
        setEl2('clientsTotalCount', `${res.pagination.total} clients`);

        const stats = res.roleStats || {};
        setEl2('client-stat-total',        res.pagination.total);
        setEl2('client-stat-active',       stats.active        ?? '—');
        setEl2('client-stat-with-requests',stats.withRequests   ?? '—');
        setEl2('client-stat-new-week',     stats.newThisWeek    ?? '—');
    } catch(err) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>${esc(err.message)}</p></div></td></tr>`;
    }
}

function renderClientsTable(users) {
    const el = document.getElementById('clientsTableBody');
    if (!el) return;
    if (!users.length) { el.innerHTML = '<tr><td colspan="7"><div class="empty-state"><i class="fas fa-user-tie"></i><p>No clients found</p></div></td></tr>'; return; }

    el.innerHTML = users.map(u => `
        <tr>
            <td>
                <div class="user-cell">
                    <div class="user-avatar-sm client-avatar">${initials(u.name)}</div>
                    <div><div class="user-name">${esc(u.name)}</div><div class="user-email">${esc(u.email)}</div></div>
                </div>
            </td>
            <td><span class="text-muted-sm">${esc(u.company || '—')}</span></td>
            <td><span class="text-muted-sm">${esc(u.phone || '—')}</span></td>
            <td><strong>${u.requestCount ?? 0}</strong></td>
            <td><span class="badge ${u.suspended ? 'badge-danger' : 'badge-success'}">${u.suspended ? 'Suspended' : 'Active'}</span></td>
            <td>${formatDate(u.createdAt)}</td>
            <td>
                <div class="action-btns">
                    <button class="action-btn view" title="View Profile" onclick="openClientModal('${u._id}')"><i class="fas fa-eye"></i></button>
                    <button class="action-btn ${u.suspended ? 'success' : 'edit'}" title="${u.suspended ? 'Activate' : 'Suspend'}" onclick="toggleClientStatus('${u._id}', ${!u.suspended})">
                        <i class="fas ${u.suspended ? 'fa-user-check' : 'fa-user-slash'}"></i>
                    </button>
                    <button class="action-btn danger" title="Delete" onclick="confirmDeleteClient('${u._id}','${esc(u.name)}')"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>
    `).join('');
}

function renderClientsPagination(p) {
    setEl2('clientsPaginationInfo', `Showing ${Math.min((p.page-1)*p.limit+1, p.total)}–${Math.min(p.page*p.limit, p.total)} of ${p.total}`);
    const el = document.getElementById('clientsPaginationBtns');
    if (el) el.innerHTML = buildPaginationBtns(p.page, p.pages, 'clientsPage');
}

window.clientsPage = function(page) { RS.clients.page = page; loadClients(); };

async function openClientModal(userId) {
    RS.currentClientId = userId;
    const modal = document.getElementById('clientDetailModal');
    if (!modal) return;
    modal.classList.add('open');
    document.getElementById('clientDetailBody').innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner"></i></div>';

    try {
        const res = await adminRequest(`/users/${userId}`);
        const u   = res.data;

        document.getElementById('clientDetailBody').innerHTML = `
            <div class="user-detail-header">
                <div class="user-avatar-lg client-avatar">${initials(u.name)}</div>
                <div class="user-detail-info">
                    <h3>${esc(u.name)}</h3>
                    <p>${esc(u.email)}</p>
                    <span class="badge ${u.suspended ? 'badge-danger' : 'badge-success'} mt-1">${u.suspended ? 'Suspended' : 'Active'}</span>
                </div>
            </div>
            <div class="detail-grid">
                <div class="detail-item"><label>Company</label><p>${esc(u.company || '—')}</p></div>
                <div class="detail-item"><label>Phone</label><p>${esc(u.phone || '—')}</p></div>
                <div class="detail-item"><label>Joined</label><p>${formatDate(u.createdAt)}</p></div>
                <div class="detail-item"><label>Total Requests</label><p>${u.requestCount ?? 0}</p></div>
            </div>
        `;

        const suspendBtn = document.getElementById('clientToggleSuspendBtn');
        if (suspendBtn) {
            suspendBtn.style.display  = '';
            suspendBtn.dataset.userId  = userId;
            suspendBtn.dataset.suspend = String(!u.suspended);
            suspendBtn.innerHTML = u.suspended ? '<i class="fas fa-user-check"></i> Activate' : '<i class="fas fa-user-slash"></i> Suspend';
            suspendBtn.className = u.suspended ? 'btn btn-success' : 'btn btn-warning';
        }
    } catch(err) {
        document.getElementById('clientDetailBody').innerHTML = `<p style="color:var(--danger)">${esc(err.message)}</p>`;
    }
}

window.toggleClientSuspend = async function() {
    const btn = document.getElementById('clientToggleSuspendBtn');
    if (!btn) return;
    await toggleClientStatus(btn.dataset.userId, btn.dataset.suspend === 'true');
    closeModal('clientDetailModal');
};

async function toggleClientStatus(userId, suspend) {
    try {
        await adminRequest(`/users/${userId}/status`, { method:'PATCH', body: JSON.stringify({ suspended: suspend }) });
        showToast(`Client ${suspend ? 'suspended' : 'activated'}`, 'success');
        loadClients();
    } catch(err) { showToast(err.message, 'error'); }
}

let _pendingDeleteClient = null;
function confirmDeleteClient(userId, name) {
    _pendingDeleteClient = userId;
    document.getElementById('confirmTitle').textContent   = 'Delete Client';
    document.getElementById('confirmMessage').textContent = `Delete "${name}"? This cannot be undone.`;
    document.getElementById('confirmBtn').onclick = async function() {
        try {
            await adminRequest(`/users/${_pendingDeleteClient}`, { method:'DELETE' });
            showToast('Client deleted', 'success');
            closeModal('confirmModal');
            loadClients();
        } catch(err) { showToast(err.message, 'error'); }
        _pendingDeleteClient = null;
    };
    document.getElementById('confirmModal').classList.add('open');
}

document.addEventListener('DOMContentLoaded', () => {
    const clientSearch = document.getElementById('clientSearch');
    if (clientSearch) {
        let t;
        clientSearch.addEventListener('input', () => {
            clearTimeout(t);
            t = setTimeout(() => { RS.clients.search = clientSearch.value; RS.clients.page = 1; loadClients(); }, 400);
        });
    }
    const clientSort = document.getElementById('clientSort');
    if (clientSort) {
        clientSort.addEventListener('change', () => { RS.clients.sort = clientSort.value; RS.clients.page = 1; loadClients(); });
    }
});

/* ─────────────────────────────────────────────────────────────────────────────
   REQUESTS MODULE (ClientProject briefs)
───────────────────────────────────────────────────────────────────────────── */
async function loadRequests() {
    const tbody = document.getElementById('requestsTableBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="7"><div class="loading-spinner"><i class="fas fa-spinner"></i></div></td></tr>';

    try {
        const params = new URLSearchParams({
            page  : RS.requests.page,
            limit : 15,
            search: RS.requests.search,
            sort  : RS.requests.sort,
        });
        if (RS.requests.status) params.set('status', RS.requests.status);
        if (RS.requests.type)   params.set('projectType', RS.requests.type);

        const res = await adminRequest(`/client-projects?${params}`);
        RS.requests.data  = res.data;
        RS.requests.pages = res.pagination.pages;
        RS.requests.total = res.pagination.total;

        renderRequestsTable(res.data);
        renderRequestsPagination(res.pagination);
        setEl2('requestsTotalCount', `${res.pagination.total} requests`);

        const stats = res.stats || {};
        setEl2('req-stat-total',    res.pagination.total);
        setEl2('req-stat-pending',  stats.pending   ?? '—');
        setEl2('req-stat-accepted', stats.accepted  ?? '—');
        setEl2('req-stat-rejected', stats.rejected  ?? '—');
    } catch(err) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>${esc(err.message)}</p></div></td></tr>`;
    }
}

function renderRequestsTable(requests) {
    const el = document.getElementById('requestsTableBody');
    if (!el) return;
    if (!requests.length) { el.innerHTML = '<tr><td colspan="7"><div class="empty-state"><i class="fas fa-handshake"></i><p>No requests found</p></div></td></tr>'; return; }

    el.innerHTML = requests.map(r => {
        const budgetStr = r.budget && (r.budget.min || r.budget.max)
            ? `${r.budget.currency || '₹'} ${fmtBudget(r.budget.min)}${r.budget.max ? ' – ' + fmtBudget(r.budget.max) : '+'}`
            : '—';
        return `
        <tr>
            <td>
                <div class="user-name">${esc(r.title)}</div>
                <div class="user-email">${esc(r.style || '')}</div>
            </td>
            <td>
                <div class="user-cell">
                    <div class="user-avatar-sm client-avatar" style="width:28px;height:28px;font-size:0.7rem">${initials(r.client?.name || '?')}</div>
                    <div>
                        <div style="font-size:0.85rem;font-weight:500">${esc(r.client?.name || 'Unknown')}</div>
                        <div class="user-email">${esc(r.client?.email || '')}</div>
                    </div>
                </div>
            </td>
            <td><span class="badge badge-gray">${r.projectType}</span></td>
            <td><span class="text-muted-sm">${budgetStr}</span></td>
            <td><span class="badge ${reqStatusBadge(r.status)}">${r.status}</span></td>
            <td>${formatDate(r.createdAt)}</td>
            <td>
                <div class="action-btns">
                    <button class="action-btn view" title="View Details" onclick="openRequestModal('${r._id}')"><i class="fas fa-eye"></i></button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

function fmtBudget(n) {
    if (!n) return '';
    if (n >= 10000000) return (n/10000000).toFixed(1) + 'Cr';
    if (n >= 100000)   return (n/100000).toFixed(1) + 'L';
    if (n >= 1000)     return (n/1000).toFixed(0) + 'K';
    return String(n);
}

function reqStatusBadge(s) {
    const map = { pending:'badge-warning', accepted:'badge-success', rejected:'badge-danger', completed:'badge-info', cancelled:'badge-gray' };
    return map[s] || 'badge-gray';
}

function renderRequestsPagination(p) {
    setEl2('requestsPaginationInfo', `Showing ${Math.min((p.page-1)*p.limit+1, p.total)}–${Math.min(p.page*p.limit, p.total)} of ${p.total}`);
    const el = document.getElementById('requestsPaginationBtns');
    if (el) el.innerHTML = buildPaginationBtns(p.page, p.pages, 'requestsPage');
}

window.requestsPage = function(page) { RS.requests.page = page; loadRequests(); };

async function openRequestModal(reqId) {
    const modal = document.getElementById('requestDetailModal');
    if (!modal) return;
    modal.classList.add('open');
    document.getElementById('requestDetailBody').innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner"></i></div>';

    try {
        const res = await adminRequest(`/client-projects/${reqId}`);
        const r   = res.data;
        const budgetStr = r.budget && (r.budget.min || r.budget.max)
            ? `${r.budget.currency || '₹'} ${fmtBudget(r.budget.min)} – ${fmtBudget(r.budget.max)}`
            : '—';

        document.getElementById('requestDetailBody').innerHTML = `
            <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:1.25rem;">
                <div style="width:44px;height:44px;border-radius:10px;background:linear-gradient(135deg,#667eea,#764ba2);display:flex;align-items:center;justify-content:center;">
                    <i class="fas fa-handshake" style="color:#fff;font-size:1rem;"></i>
                </div>
                <div>
                    <h3 style="margin:0;font-size:1rem;font-weight:700">${esc(r.title)}</h3>
                    <span class="badge ${reqStatusBadge(r.status)}" style="margin-top:3px;">${r.status}</span>
                </div>
            </div>
            <div class="detail-grid">
                <div class="detail-item"><label>Client</label><p>${esc(r.client?.name || 'Unknown')}</p></div>
                <div class="detail-item"><label>Client Email</label><p>${esc(r.client?.email || '—')}</p></div>
                <div class="detail-item"><label>Project Type</label><p>${r.projectType}</p></div>
                <div class="detail-item"><label>Style</label><p>${r.style || '—'}</p></div>
                <div class="detail-item"><label>Budget</label><p>${budgetStr}</p></div>
                <div class="detail-item"><label>Land Size</label><p>${r.landSize?.value ? r.landSize.value + ' ' + r.landSize.unit : '—'}</p></div>
                <div class="detail-item"><label>Bedrooms</label><p>${r.requirements?.bedrooms ?? '—'}</p></div>
                <div class="detail-item"><label>Bathrooms</label><p>${r.requirements?.bathrooms ?? '—'}</p></div>
                <div class="detail-item"><label>Submitted</label><p>${formatDate(r.createdAt)}</p></div>
            </div>
            ${r.description ? `<div style="margin-top:1rem"><label style="font-size:0.75rem;color:var(--gray);text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Description</label><p style="margin-top:0.4rem;font-size:0.9rem;color:var(--dark)">${esc(r.description)}</p></div>` : ''}
        `;
    } catch(err) {
        document.getElementById('requestDetailBody').innerHTML = `<p style="color:var(--danger)">${esc(err.message)}</p>`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const reqSearch = document.getElementById('requestSearch');
    if (reqSearch) {
        let t;
        reqSearch.addEventListener('input', () => {
            clearTimeout(t);
            t = setTimeout(() => { RS.requests.search = reqSearch.value; RS.requests.page = 1; loadRequests(); }, 400);
        });
    }
    ['requestStatusFilter','requestTypeFilter'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('change', () => {
            if (id === 'requestStatusFilter') RS.requests.status = el.value;
            if (id === 'requestTypeFilter')   RS.requests.type   = el.value;
            RS.requests.page = 1;
            loadRequests();
        });
    });
});

/* ─────────────────────────────────────────────────────────────────────────────
   CLIENT SUPPORT  (ClientTicket model  /api/client/support/admin/*)
───────────────────────────────────────────────────────────────────────────── */
function clientTicketAuthHeaders() {
    const token = (window.state && window.state.token) || localStorage.getItem('adminToken');
    return { 'Content-Type':'application/json', 'Authorization': `Bearer ${token}` };
}

// Poll unread client tickets
function pollClientSupportUnread() {
    _pollClientUnread();
    setInterval(_pollClientUnread, 30000);
}

async function _pollClientUnread() {
    try {
        const res  = await fetch(`${CLIENT_TICKET_API}/admin/unread-count`, { headers: clientTicketAuthHeaders() });
        const data = await res.json();
        const badge = document.getElementById('clientSupportBadge');
        if (!badge) return;
        if (data.count > 0) {
            badge.textContent    = data.count;
            badge.style.display  = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    } catch(e) {}
}

window.loadClientSupportTickets = async function() {
    const filter  = document.getElementById('clientTicketStatusFilter')?.value || 'all';
    const listEl  = document.getElementById('clientTicketList');
    const countEl = document.getElementById('clientTicketCountBadge');
    if (!listEl) return;

    listEl.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:120px;color:#6c757d;"><i class="fas fa-spinner fa-spin"></i></div>';

    try {
        const url = `${CLIENT_TICKET_API}/admin/all?status=${filter}&limit=50`;
        const res  = await fetch(url, { headers: clientTicketAuthHeaders() });
        const data = await res.json();
        if (!data.success) return;

        if (countEl) countEl.textContent = data.total ? `${data.total} ticket${data.total !== 1 ? 's' : ''}` : '';

        if (!data.tickets.length) {
            listEl.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:200px;gap:0.75rem;color:#6c757d;">
                <i class="fas fa-inbox" style="font-size:1.8rem;opacity:0.3;"></i>
                <p style="margin:0;font-size:0.85rem;">No client tickets found</p></div>`;
            return;
        }

        const statusColor = { open:'#ef4444', replied:'#10b981', closed:'#64748b' };
        const statusBg    = { open:'rgba(239,68,68,0.15)', replied:'rgba(16,185,129,0.15)', closed:'rgba(100,116,139,0.15)' };

        listEl.innerHTML = data.tickets.map(t => {
            const isNew  = t.status === 'open' && !t.adminRead;
            const color  = statusColor[t.status] || '#6c757d';
            const bg     = statusBg[t.status]    || 'rgba(100,116,139,0.15)';
            const time   = new Date(t.createdAt).toLocaleDateString('en-US', { month:'short', day:'numeric' });
            return `<div class="ticket-item" onclick="openClientSupportTicket('${t._id}')" data-id="${t._id}"
                style="padding:0.875rem 1.125rem;border-bottom:1px solid #dee2e6;cursor:pointer;transition:background 0.15s;border-left:3px solid ${isNew ? '#0891b2' : 'transparent'};"
                onmouseover="this.style.background='#f0f2f5'" onmouseout="if(!this.classList.contains('selected'))this.style.background='transparent'">
                <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:0.5rem;margin-bottom:3px;">
                    <span style="font-weight:${isNew ? '700' : '500'};color:${isNew ? '#1a1a2e' : '#495057'};font-size:0.85rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:190px;">${esc2(t.subject)}</span>
                    <span style="color:#6c757d;font-size:0.7rem;flex-shrink:0;">${time}</span>
                </div>
                <div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;margin-bottom:3px;">
                    <span style="color:#6c757d;font-size:0.775rem;">${esc2(t.clientName)}</span>
                    <span style="background:${bg};color:${color};border:1px solid ${color}44;padding:1px 8px;border-radius:20px;font-size:0.65rem;font-weight:700;text-transform:uppercase;">${t.status}</span>
                </div>
                <p style="margin:0;color:#868e96;font-size:0.75rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc2(t.message.slice(0, 65))}…</p>
            </div>`;
        }).join('');

        _pollClientUnread();
    } catch(e) { console.error('loadClientSupportTickets error:', e); }
};

window.openClientSupportTicket = async function(id) {
    RS.currentClientTicketId = id;
    document.querySelectorAll('#clientTicketList .ticket-item').forEach(el => { el.style.background = 'transparent'; el.classList.remove('selected'); });
    const sel = document.querySelector(`#clientTicketList .ticket-item[data-id="${id}"]`);
    if (sel) { sel.style.background = 'rgba(0,212,200,0.06)'; sel.classList.add('selected'); }

    try {
        const res  = await fetch(`${CLIENT_TICKET_API}/admin/${id}`, { headers: clientTicketAuthHeaders() });
        const data = await res.json();
        if (!data.success) return;
        renderClientTicketDetail(data.ticket);
        loadClientSupportTickets();
    } catch(e) { console.error(e); }
};

function renderClientTicketDetail(ticket) {
    document.getElementById('clientTicketDetailEmpty').style.display = 'none';
    const content = document.getElementById('clientTicketDetailContent');
    content.style.display = 'flex';

    document.getElementById('clientTdSubject').textContent = ticket.subject;
    document.getElementById('clientTdMeta').textContent    = `${ticket.clientName} <${ticket.clientEmail}> · ${new Date(ticket.createdAt).toLocaleString()}`;

    const statusColor = { open:'#ef4444', replied:'#10b981', closed:'#64748b' };
    const statusBg    = { open:'rgba(239,68,68,0.15)', replied:'rgba(16,185,129,0.15)', closed:'rgba(100,116,139,0.15)' };
    const badge = document.getElementById('clientTdStatusBadge');
    badge.textContent = ticket.status.toUpperCase();
    badge.style.cssText = `padding:3px 12px;border-radius:20px;font-size:0.7rem;font-weight:700;border:1px solid ${statusColor[ticket.status]}55;background:${statusBg[ticket.status]};color:${statusColor[ticket.status]};`;

    const sel = document.getElementById('clientTdStatusSelect');
    sel.value = ticket.status;

    const thread = document.getElementById('clientTdThread');
    const allMessages = [
        { sender:'client', senderName: ticket.clientName, message: ticket.message, createdAt: ticket.createdAt },
        ...ticket.replies
    ];

    thread.innerHTML = allMessages.map(msg => {
        const isAdmin = msg.sender === 'admin';
        const time = new Date(msg.createdAt).toLocaleString('en-US', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
        return `<div style="display:flex;flex-direction:column;align-items:${isAdmin ? 'flex-end' : 'flex-start'};">
            <div style="max-width:78%;background:${isAdmin ? 'linear-gradient(135deg,#0891b2,#0e7490)' : '#fff'};border:1px solid ${isAdmin ? 'transparent' : '#dee2e6'};border-radius:${isAdmin ? '14px 14px 4px 14px' : '14px 14px 14px 4px'};padding:0.75rem 1rem;box-shadow:0 2px 6px rgba(0,0,0,0.07);">
                <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:5px;">
                    <span style="font-weight:700;font-size:0.75rem;color:${isAdmin ? 'rgba(255,255,255,0.85)' : '#6c757d'};">${isAdmin ? '🛡 ' + msg.senderName : '👤 ' + msg.senderName}</span>
                    <span style="color:${isAdmin ? 'rgba(255,255,255,0.6)' : '#adb5bd'};font-size:0.7rem;">${time}</span>
                </div>
                <p style="margin:0;color:${isAdmin ? '#fff' : '#1a1a2e'};font-size:0.875rem;line-height:1.65;white-space:pre-wrap;">${esc2(msg.message)}</p>
            </div>
        </div>`;
    }).join('');

    setTimeout(() => { thread.scrollTop = thread.scrollHeight; }, 50);
}

window.sendClientTicketReply = async function() {
    if (!RS.currentClientTicketId) return;
    const box     = document.getElementById('clientReplyBox');
    const message = box.value.trim();
    if (!message) { box.style.borderColor = '#ef4444'; setTimeout(() => box.style.borderColor = '', 1500); return; }

    try {
        const res  = await fetch(`${CLIENT_TICKET_API}/admin/${RS.currentClientTicketId}/reply`, {
            method:'POST', headers: clientTicketAuthHeaders(),
            body: JSON.stringify({ message })
        });
        const data = await res.json();
        if (data.success) {
            box.value = '';
            renderClientTicketDetail(data.ticket);
            loadClientSupportTickets();
        } else { alert(data.message || 'Failed to send reply.'); }
    } catch(e) { alert('Network error.'); }
};

window.changeClientTicketStatus = async function(status) {
    if (!RS.currentClientTicketId) return;
    try {
        const res  = await fetch(`${CLIENT_TICKET_API}/admin/${RS.currentClientTicketId}/status`, {
            method:'PATCH', headers: clientTicketAuthHeaders(),
            body: JSON.stringify({ status })
        });
        const data = await res.json();
        if (data.success) { renderClientTicketDetail(data.ticket); loadClientSupportTickets(); }
    } catch(e) {}
};

/* ─────────────────────────────────────────────────────────────────────────────
   ANALYTICS — tabbed (Architect / Client)
───────────────────────────────────────────────────────────────────────────── */
window.switchAnalyticsTab = function(tab) {
    document.getElementById('analyticsArchPanel').style.display   = tab === 'arch'   ? '' : 'none';
    document.getElementById('analyticsClientPanel').style.display = tab === 'client' ? '' : 'none';
    document.getElementById('analyticsTabArch').classList.toggle('active',   tab === 'arch');
    document.getElementById('analyticsTabClient').classList.toggle('active', tab === 'client');
    if (tab === 'client') loadClientAnalytics();
};

// Architect analytics — delegates to original admin.js loadAnalytics()
async function loadAnalyticsArch() {
    if (typeof loadAnalytics === 'function') { loadAnalytics(); }
}

// Client analytics
async function loadClientAnalytics() {
    try {
        const token   = (window.state && window.state.token) || localStorage.getItem('adminToken');
        const headers = { 'Content-Type':'application/json', 'Authorization': `Bearer ${token}` };

        const [clientRes, reqRes] = await Promise.all([
            fetch('https://smartarch-backend.onrender.com/api/admin/users?role=client&limit=1', {headers}).then(r=>r.json()).catch(()=>null),
            fetch('https://smartarch-backend.onrender.com/api/admin/client-projects/analytics', {headers}).then(r=>r.json()).catch(()=>null),
        ]);

        if (clientRes && clientRes.pagination) {
            setEl2('an-client-total', clientRes.pagination.total ?? '—');
            setEl2('an-client-week',  clientRes.pagination.thisWeek ?? '—');
        }
        if (reqRes && reqRes.data) {
            const d = reqRes.data;
            setEl2('an-client-requests', d.total     ?? '—');
            setEl2('an-client-accepted', d.accepted  ?? '—');

            if (window.Chart) {
                // Client growth line chart
                if (d.clientGrowth && document.getElementById('clientGrowthChart')) {
                    renderLineChart('clientGrowthChart', d.clientGrowth, 'New Clients', '#0891b2');
                }
                // Request type donut
                if (d.byType && document.getElementById('requestTypeChart')) {
                    renderDonut('requestTypeChart', d.byType, 'type');
                }
                // Request status donut
                if (d.byStatus && document.getElementById('requestStatusChart')) {
                    renderDonut('requestStatusChart', d.byStatus, 'status');
                }
            }
        }
    } catch(e) { console.warn('Client analytics error:', e.message); }
}

/* ─────────────────────────────────────────────────────────────────────────────
   PROJECTS — patch table to show "Architect" column (replaces old "Owner")
───────────────────────────────────────────────────────────────────────────── */
(function patchProjectsTable() {
    const _origRender = window.renderProjectsTable;
    if (!_origRender) return;

    window.renderProjectsTable = function(projects) {
        const el = document.getElementById('projectsTableBody');
        if (!el) return;
        if (!projects.length) {
            el.innerHTML = '<tr><td colspan="6"><div class="empty-state"><i class="fas fa-folder-open"></i><p>No projects found</p></div></td></tr>';
            return;
        }
        el.innerHTML = projects.map(p => `
            <tr>
                <td>
                    <div class="user-name">${esc(p.name)}</div>
                    <div class="user-email">${p.description ? esc(p.description.slice(0,50)) + '…' : '—'}</div>
                </td>
                <td>
                    <div class="user-cell">
                        <div class="user-avatar-sm" style="width:28px;height:28px;font-size:0.7rem">${initials(p.owner?.name || '?')}</div>
                        <div>
                            <div style="font-size:0.85rem;font-weight:500">${esc(p.owner?.name || 'Unknown')}</div>
                            <div class="user-email">${esc(p.owner?.email || '')}</div>
                        </div>
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
                        <button class="action-btn danger" title="Delete" onclick="confirmDeleteProject('${p._id}','${esc(p.name)}')"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `).join('');
    };
})();

/* ─────────────────────────────────────────────────────────────────────────────
   UTILITY HELPERS (local to this module)
───────────────────────────────────────────────────────────────────────────── */
function setEl2(id, val) { const el = document.getElementById(id); if (el) el.textContent = val ?? '—'; }
function esc2(str)       { return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

/* ─────────────────────────────────────────────────────────────────────────────
   INIT
───────────────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
    // Start client support unread badge polling (alongside existing arch polling)
    const token = localStorage.getItem('adminToken');
    if (token) {
        pollClientSupportUnread();
    }

    // Mobile menu button
    if (window.innerWidth <= 768) {
        const btn = document.getElementById('mobileMenuBtn');
        if (btn) btn.style.display = 'flex';
    }
});

/* ─────────────────────────────────────────────────────────────────────────────
   GLOBAL EXPORTS
───────────────────────────────────────────────────────────────────────────── */
window.loadArchitects           = loadArchitects;
window.loadClients              = loadClients;
window.loadRequests             = loadRequests;
window.openArchModal            = openArchModal;
window.openClientModal          = openClientModal;
window.openRequestModal         = openRequestModal;
window.quickVerifyArch          = quickVerifyArch;
window.toggleArchStatus         = toggleArchStatus;
window.toggleClientStatus       = toggleClientStatus;
window.confirmDeleteArch        = confirmDeleteArch;
window.confirmDeleteClient      = confirmDeleteClient;
window.loadClientSupportTickets = loadClientSupportTickets;
window.switchAnalyticsTab       = switchAnalyticsTab;