'use strict';
const CLIENT_API = 'http://localhost:5000/api';

/* ============================================================
   VIEW SWITCHER
   ============================================================ */
const VIEWS = {
    dashboard: {
        el: 'view-dashboard', navId: 'nav-dashboard',
        title: 'Dashboard', sub: null,
        showDashBtns: true, showPlan: false
    },
    architects: {
        el: 'view-architects', navId: 'nav-architects',
        title: 'Find Architects', sub: 'Browse verified architecture professionals',
        showDashBtns: false, showPlan: true
    },
    connections: {
        el: 'view-connections', navId: 'nav-connections',
        title: 'My Architects', sub: 'Manage your architect connections',
        showDashBtns: false, showPlan: false
    },
    projects: {
        el: 'view-projects', navId: 'nav-projects',
        title: 'My Projects', sub: 'Manage your construction briefs',
        showDashBtns: false, showPlan: false
    },
    shared: {
        el: 'view-shared', navId: 'nav-shared',
        title: 'Design Submissions', sub: 'Review designs submitted by your architects',
        showDashBtns: false, showPlan: false
    },
    settings: {
        el: 'view-settings', navId: 'nav-settings',
        title: 'Settings', sub: 'Manage your account and preferences',
        showDashBtns: false, showPlan: false
    },
    support: {
        el: 'view-support', navId: 'nav-support',
        title: 'Support', sub: 'Get help from the SmartArch team',
        showDashBtns: false, showPlan: false,
        displayType: 'flex'
    },
    documents: {
        el: 'view-documents', navId: 'nav-documents',
        title: 'Documents', sub: 'All your project files and downloaded designs',
        showDashBtns: false, showPlan: false
    }
};

let currentView = 'dashboard';
let architectsLoaded = false;
let connectionsLoaded = false;

function showView(name, event) {
    if (event) event.preventDefault();
    if (name === currentView) { closeSidebar(); return; }

    const prev = VIEWS[currentView];
    const next = VIEWS[name];

    document.getElementById(prev.el).style.display = 'none';
    document.getElementById(next.el).style.display = next.displayType || '';

    document.getElementById(prev.navId).classList.remove('active');
    document.getElementById(next.navId).classList.add('active');

    document.getElementById('topbarTitle').textContent = next.title;
    document.getElementById('topbarSub').textContent   = next.sub || '';

    document.getElementById('notifWrap').style.display       = next.showDashBtns ? '' : 'none';
    document.getElementById('topbarSearchBtn').style.display = next.showDashBtns ? '' : 'none';
    document.getElementById('topbarPlan').style.display      = next.showPlan     ? '' : 'none';

    currentView = name;
    closeSidebar();

    // Lazy-load architects grid on first switch to that view
    if (name === 'architects' && !architectsLoaded) {
        architectsLoaded = true;
        fetchArchitects();
    }
    if (name === 'connections') {
        loadConnections();
    }
    if (name === 'projects') {
        loadClientProjects();
    }
    if (name === 'shared') {
        loadSharedProjects();
    }
    if (name === 'settings') {
        loadClientSettings();
    }
    if (name === 'support') {
        clientSupportInit();
    }
    if (name === 'documents') {
        loadDocuments();
    }
}

/* ============================================================
   AUTH
   ============================================================ */
function requireClientAuth() {
    const token = localStorage.getItem('client_token');
    if (!token) { window.location.href = 'client-index.html?modal=login'; return null; }
    return token;
}
function getToken()    { return localStorage.getItem('client_token'); }
function authHeaders() {
    return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getToken() };
}
// ── Client App Rating Modal (shown on logout) ────────────────────────────────
(function() {
    var CLIENT_RATING_SESSION_KEY = 'smartarch_client_app_rated_session';

    function injectClientRatingStyles() {
        if (document.getElementById('clientArModalStyles')) return;
        var s = document.createElement('style');
        s.id = 'clientArModalStyles';
        s.textContent = [
            '#clientArModal{position:fixed;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);',
            '  display:flex;align-items:center;justify-content:center;z-index:99999;',
            '  opacity:0;transition:opacity .25s;pointer-events:none;}',
            '#clientArModal.ar-visible{opacity:1;pointer-events:all;}',
            '#clientArBox{position:relative;background:#0d1424;border:1px solid rgba(255,255,255,.1);border-radius:16px;',
            '  padding:2rem;width:100%;max-width:380px;box-shadow:0 24px 60px rgba(0,0,0,.6);',
            '  transform:translateY(18px);transition:transform .28s cubic-bezier(.34,1.56,.64,1);}',
            '#clientArModal.ar-visible #clientArBox{transform:translateY(0);}',
            '.client-ar-top-bar{height:4px;background:linear-gradient(90deg,#8b5cf6,#06b6d4);',
            '  border-radius:14px 14px 0 0;margin:-2rem -2rem 1.4rem;}',
            '.client-ar-stars{display:flex;gap:10px;justify-content:center;margin-bottom:1.2rem;}',
            '.client-ar-star{font-size:2rem;color:#2d3748;cursor:pointer;transition:color .15s,transform .12s;}',
            '.client-ar-star:hover,.client-ar-star.ar-on{color:#f59e0b;}',
            '.client-ar-star:hover{transform:scale(1.15);}',
            '.client-ar-comment{width:100%;background:rgba(255,255,255,.06);border:1px solid #2d3651;',
            '  color:#e2e8f0;padding:.6rem .8rem;border-radius:8px;font-size:.82rem;',
            '  resize:none;min-height:70px;font-family:inherit;box-sizing:border-box;}',
            '.client-ar-comment:focus{outline:none;border-color:#8b5cf6;}',
            '.client-ar-comment::placeholder{color:#475569;}',
            '.client-ar-actions{display:flex;gap:.75rem;margin-top:1rem;}',
            '.client-ar-btn-skip{flex:1;padding:.6rem;border-radius:8px;border:1px solid #2d3651;',
            '  background:transparent;color:#fff;cursor:pointer;font-size:.82rem;}',
            '.client-ar-btn-submit{flex:2;padding:.6rem;border-radius:8px;border:none;',
            '  background:linear-gradient(135deg,#8b5cf6,#06b6d4);color:#fff;',
            '  cursor:pointer;font-size:.82rem;font-weight:600;transition:opacity .15s;}',
            '.client-ar-btn-submit:hover{opacity:.88;}',
            '.client-ar-btn-submit:disabled{opacity:.45;cursor:not-allowed;}',
            '.client-ar-close{position:absolute;top:12px;right:14px;background:none;border:none;',
            '  color:#64748b;font-size:1.1rem;cursor:pointer;line-height:1;padding:4px 6px;border-radius:6px;}',
            '.client-ar-close:hover{color:#e2e8f0;background:rgba(255,255,255,.08);}',
            '.client-ar-sent{text-align:center;padding:1rem 0;}',
            '.client-ar-sent-icon{font-size:2.5rem;margin-bottom:.5rem;}',
            '.client-ar-sent-title{font-size:1rem;font-weight:700;color:#f1f5f9;margin-bottom:.3rem;}',
            '.client-ar-sent-sub{font-size:.8rem;color:#64748b;}'
        ].join('');
        document.head.appendChild(s);
    }

    function injectClientRatingModal() {
        var el = document.createElement('div');
        el.id = 'clientArModal';
        el.innerHTML =
            '<div id="clientArBox">' +
                '<div class="client-ar-top-bar"></div>' +
                '<button class="client-ar-close" id="clientArCloseBtn" title="Close">&#x2715;</button>' +
                '<div style="font-size:1.1rem;font-weight:700;color:#f1f5f9;margin-bottom:.3rem;">&#11088; How was your experience?</div>' +
                '<div style="font-size:.82rem;color:#64748b;margin-bottom:1.4rem;line-height:1.5;">Rate SmartArch before you go — helps us improve for clients like you.</div>' +
                '<div class="client-ar-stars" id="clientArStars">' +
                    '<i class="client-ar-star fas fa-star" data-v="1"></i>' +
                    '<i class="client-ar-star fas fa-star" data-v="2"></i>' +
                    '<i class="client-ar-star fas fa-star" data-v="3"></i>' +
                    '<i class="client-ar-star fas fa-star" data-v="4"></i>' +
                    '<i class="client-ar-star fas fa-star" data-v="5"></i>' +
                '</div>' +
                '<textarea id="clientArComment" class="client-ar-comment" maxlength="500"' +
                    ' placeholder="Any thoughts? (optional)"></textarea>' +
                '<div class="client-ar-actions">' +
                    '<button class="client-ar-btn-skip" id="clientArSkip">Skip</button>' +
                    '<button class="client-ar-btn-submit" id="clientArSubmit" disabled>Submit &amp; Logout</button>' +
                '</div>' +
            '</div>';
        document.body.appendChild(el);
        wireClientRatingModal();
    }

    var _clientSelectedRating = 0;
    var _clientLogoutCb = null;

    function wireClientRatingModal() {
        var stars  = document.querySelectorAll('.client-ar-star');
        var submit = document.getElementById('clientArSubmit');
        var skip   = document.getElementById('clientArSkip');
        var close  = document.getElementById('clientArCloseBtn');

        stars.forEach(function(s) {
            s.addEventListener('mouseenter', function() { highlightClientStars(parseInt(s.dataset.v)); });
            s.addEventListener('mouseleave', function() { highlightClientStars(_clientSelectedRating); });
            s.addEventListener('click', function() {
                _clientSelectedRating = parseInt(s.dataset.v);
                highlightClientStars(_clientSelectedRating);
                if (submit) submit.disabled = false;
            });
        });
        if (submit) submit.addEventListener('click', submitClientRating);
        if (skip)   skip.addEventListener('click',   doClientLogout);
        if (close)  close.addEventListener('click',  hideClientRatingModal);
    }

    function highlightClientStars(val) {
        document.querySelectorAll('.client-ar-star').forEach(function(s) {
            s.classList.toggle('ar-on', parseInt(s.dataset.v) <= val);
        });
    }

    async function submitClientRating() {
        if (!_clientSelectedRating) return;
        var submit  = document.getElementById('clientArSubmit');
        var comment = (document.getElementById('clientArComment') ? document.getElementById('clientArComment').value : '').trim();
        if (submit) { submit.disabled = true; submit.textContent = 'Saving...'; }

        try {
            var token = localStorage.getItem('client_token');
            await fetch('http://localhost:5000/api/app-ratings', {
                method:  'POST',
                headers: Object.assign(
                    { 'Content-Type': 'application/json' },
                    token ? { 'Authorization': 'Bearer ' + token } : {}
                ),
                body: JSON.stringify({
                    rating:   _clientSelectedRating,
                    comment:  comment,
                    userRole: 'client',
                    page:     window.location.pathname.split('/').pop() || 'client-dashboard.html'
                })
            });
        } catch(e) { /* non-fatal — still log out */ }

        localStorage.setItem(CLIENT_RATING_SESSION_KEY, '1');
        showClientRatingThanks();
    }

    function showClientRatingThanks() {
        var box = document.getElementById('clientArBox');
        if (box) {
            box.innerHTML =
                '<div class="client-ar-sent">' +
                    '<div class="client-ar-sent-icon">&#x2728;</div>' +
                    '<div class="client-ar-sent-title">Thanks for your feedback!</div>' +
                    '<div class="client-ar-sent-sub">Logging you out...</div>' +
                '</div>';
        }
        setTimeout(doClientLogout, 1200);
    }

    function doClientLogout() {
        hideClientRatingModal();
        if (typeof _clientLogoutCb === 'function') _clientLogoutCb();
    }

    function hideClientRatingModal() {
        var el = document.getElementById('clientArModal');
        if (el) {
            el.classList.remove('ar-visible');
            setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
        }
    }

    window._showClientAppRatingModal = function(cb) {
        injectClientRatingStyles();
        var old = document.getElementById('clientArModal');
        if (old && old.parentNode) old.parentNode.removeChild(old);
        injectClientRatingModal();
        _clientLogoutCb = cb;
        _clientSelectedRating = 0;
        highlightClientStars(0);
        requestAnimationFrame(function() {
            var modal = document.getElementById('clientArModal');
            if (modal) modal.classList.add('ar-visible');
        });
    };
})();

function logout() {
    // If already rated this session, skip modal
    if (localStorage.getItem('smartarch_client_app_rated_session')) {
        localStorage.removeItem('smartarch_client_app_rated_session');
        localStorage.removeItem('client_token');
        localStorage.removeItem('client_user');
        showToast('Logged out successfully', 'info');
        setTimeout(function() { window.location.href = 'client-index.html'; }, 800);
        return;
    }

    // Show rating modal — actual logout fires inside modal callbacks
    if (typeof window._showClientAppRatingModal === 'function') {
        window._showClientAppRatingModal(function() {
            localStorage.removeItem('smartarch_client_app_rated_session');
            localStorage.removeItem('client_token');
            localStorage.removeItem('client_user');
            showToast('Logged out successfully', 'info');
            setTimeout(function() { window.location.href = 'client-index.html'; }, 800);
        });
    } else {
        localStorage.removeItem('client_token');
        localStorage.removeItem('client_user');
        showToast('Logged out successfully', 'info');
        setTimeout(function() { window.location.href = 'client-index.html'; }, 800);
    }
}

/* ============================================================
   USER / SIDEBAR
   ============================================================ */
function loadUser() {
    var userStr = localStorage.getItem('client_user');
    if (!userStr) return;
    try {
        var user = JSON.parse(userStr);
        var avatarUrl = user.avatar ||
            'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.name || 'C') + '&background=8b5cf6&color=fff&bold=true';

        var sname   = document.getElementById('sidebarName');
        var semail  = document.getElementById('sidebarEmail');
        var savatar = document.getElementById('sidebarAvatar');
        if (sname)   sname.textContent  = user.name  || '-';
        if (semail)  semail.textContent = user.email || '-';
        if (savatar) savatar.src = avatarUrl;

        var tavatar = document.getElementById('topbarAvatar');
        if (tavatar) tavatar.src = avatarUrl;

        // Time-based greeting (only shown when dashboard is active)
        var hour = new Date().getHours();
        var greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
        var firstName = user.name ? user.name.split(' ')[0] : 'there';
        document.getElementById('topbarSub').textContent = greeting + ', ' + firstName + '! Welcome back!';

        // Dashboard hero greeting + name
        var dbGreetEl = document.getElementById('dbGreeting');
        var dbNameEl  = document.getElementById('dbFirstName');
        if (dbGreetEl) dbGreetEl.textContent = greeting;
        if (dbNameEl)  dbNameEl.textContent  = firstName;

        // Plan badge
        var pb   = document.getElementById('topbarPlan');
        var plan = user.plan || 'free';
        pb.textContent = plan.charAt(0).toUpperCase() + plan.slice(1);
        pb.className   = 'plan-badge plan-' + plan;

    } catch (e) { console.error('loadUser error', e); }
}

/* ============================================================
   DASHBOARD STATS
   ============================================================ */
async function loadDashboardStats() {
    function countUp(el, target) {
        if (!el) return;
        if (target === 0) { el.textContent = '0'; return; }
        var start = 0;
        var step = Math.ceil(target / 56);
        var timer = setInterval(function() {
            start += step;
            if (start >= target) { start = target; clearInterval(timer); }
            el.textContent = start;
        }, 16);
    }

    var statArch = document.getElementById('dbStatArchitects');
    var statConn = document.getElementById('dbStatConnections');
    var statProj = document.getElementById('dbStatProjects');
    var statDel  = document.getElementById('dbStatDelivered');

    [statArch, statConn, statProj, statDel].forEach(function(el) { if (el) el.textContent = '...'; });

    try {
        var results = await Promise.allSettled([
            fetch(CLIENT_API + '/client/architects?limit=1', { headers: authHeaders() }).then(function(r) { return r.json(); }),
            fetch(CLIENT_API + '/connections/my',            { headers: authHeaders() }).then(function(r) { return r.json(); }),
            fetch(CLIENT_API + '/client/projects',           { headers: authHeaders() }).then(function(r) { return r.json(); }),
            fetch(CLIENT_API + '/shares/my',                 { headers: authHeaders() }).then(function(r) { return r.json(); })
        ]);

        if (results[0].status === 'fulfilled' && results[0].value.pagination) {
            countUp(statArch, results[0].value.pagination.total || 0);
        } else { if (statArch) statArch.textContent = '0'; }

        if (results[1].status === 'fulfilled' && results[1].value.success) {
            var accepted = (results[1].value.data || []).filter(function(c) { return c.status === 'accepted'; }).length;
            countUp(statConn, accepted);
        } else { if (statConn) statConn.textContent = '0'; }

        if (results[2].status === 'fulfilled' && results[2].value.success) {
            var active = (results[2].value.data || []).filter(function(p) {
                return p.status === 'active' || p.status === 'in_progress' || p.status === 'draft';
            }).length;
            countUp(statProj, active);
        } else { if (statProj) statProj.textContent = '0'; }

        if (results[3].status === 'fulfilled' && results[3].value.success) {
            countUp(statDel, (results[3].value.data || []).length);
        } else { if (statDel) statDel.textContent = '0'; }

    } catch (e) {
        [statArch, statConn, statProj, statDel].forEach(function(el) { if (el) el.textContent = '0'; });
    }
}

/* ============================================================
   TOAST
   ============================================================ */
function showToast(msg, type) {
    type = type || 'info';
    var c = document.getElementById('toastContainer');
    var t = document.createElement('div');
    t.className = 'toast-item ' + type;
    var icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' };
    t.innerHTML = '<i class="fas ' + (icons[type] || icons.info) + '"></i><span>' + msg + '</span>';
    c.appendChild(t);
    setTimeout(function() {
        t.style.opacity    = '0';
        t.style.transform  = 'translateX(60px)';
        t.style.transition = 'all 0.3s';
        setTimeout(function() { t.remove(); }, 350);
    }, 3200);
}
function comingSoon(e, name) {
    e.preventDefault();
    showToast(name + ' - coming soon! We are building this for you.', 'info');
}
function comingSoonToast(name) {
    showToast(name + ' - coming soon!', 'info');
}
/* ============================================================
   GLOBAL TOPBAR SEARCH
   ============================================================ */
var _globalSearchDebounce = null;

var _SEARCH_CONTEXT_LABELS = {
    dashboard:   null,           // no search on dashboard
    architects:  'Find Architects',
    connections: 'My Architects',
    projects:    'My Projects',
    shared:      'Design Submissions',
    documents:   'Documents',
    settings:    null,
    support:     null,
    market:      null
};

function openGlobalSearch() {
    var label = _SEARCH_CONTEXT_LABELS[currentView];
    if (!label) {
        showToast('Search is not available in this view.', 'info');
        return;
    }
    var overlay = document.getElementById('globalSearchOverlay');
    document.getElementById('globalSearchContext').textContent = label;
    document.getElementById('globalSearchInput').value = '';
    overlay.style.display = 'flex';
    setTimeout(function() { document.getElementById('globalSearchInput').focus(); }, 60);
}

function closeGlobalSearch() {
    document.getElementById('globalSearchOverlay').style.display = 'none';
    // Clear search so view resets
    onGlobalSearchInput('');
}

function onGlobalSearchInput(val) {
    clearTimeout(_globalSearchDebounce);
    _globalSearchDebounce = setTimeout(function() {
        _applyGlobalSearch(val.trim());
    }, 300);
}

function _applyGlobalSearch(q) {
    if (currentView === 'architects') {
        // Delegates to existing architects search machinery
        archState.search = q;
        archState.page = 1;
        fetchArchitects();

        // Also sync the in-view search input so UI stays consistent
        var inp = document.getElementById('searchInput');
        if (inp) inp.value = q;

    } else if (currentView === 'connections') {
        var lower = q.toLowerCase();
        var filtered = _allConnections.filter(function(c) {
            var arch = c.architect || {};
            return !q
                || (arch.name  || '').toLowerCase().includes(lower)
                || (arch.specialization || '').toLowerCase().includes(lower)
                || (arch.location || '').toLowerCase().includes(lower)
                || (c.project && (c.project.title || '').toLowerCase().includes(lower));
        });
        renderConnections(filtered);

    } else if (currentView === 'projects') {
        var lower = q.toLowerCase();
        var all = window._cachedClientProjects || [];
        var filtered = all.filter(function(p) {
            return !q
                || (p.title || '').toLowerCase().includes(lower)
                || (p.projectType || '').toLowerCase().includes(lower)
                || (p.location || '').toLowerCase().includes(lower)
                || (p.description || '').toLowerCase().includes(lower);
        });
        renderClientProjects(filtered);

    } else if (currentView === 'shared') {
        var lower = q.toLowerCase();
        var all = window._cachedSharedProjects || [];
        var filtered = all.filter(function(s) {
            var proj = s.project || {};
            var arch = s.architect || {};
            return !q
                || (proj.title || '').toLowerCase().includes(lower)
                || (arch.name  || '').toLowerCase().includes(lower)
                || (proj.projectType || '').toLowerCase().includes(lower);
        });
        renderSharedProjects(filtered);

    } else if (currentView === 'documents') {
        // Delegates to existing docs search machinery
        var inp = document.getElementById('docsSearchInput');
        if (inp) {
            inp.value = q;
            if (typeof docsApplyFilters === 'function') docsApplyFilters();
        }
    }
}

/* ============================================================
   MOBILE SIDEBAR
   ============================================================ */
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebarOverlay').classList.toggle('open');
}
function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('open');
}

/* ============================================================
   FIND ARCHITECTS - STATE
   ============================================================ */
var archState = {
    page: 1, limit: 12,
    sort: '-rating',
    search: '', minExp: '', maxExp: '',
    minRating: '0', specialization: '',
    total: 0, pages: 0, loading: false
};
var searchDebounce = null;

/* ============================================================
   FETCH ARCHITECTS
   ============================================================ */
async function fetchArchitects() {
    if (archState.loading) return;
    archState.loading = true;
    renderSkeletons();

    var params = new URLSearchParams({
        page: archState.page, limit: archState.limit, sort: archState.sort
    });
    if (archState.search)         params.set('search',         archState.search);
    if (archState.specialization) params.set('specialization', archState.specialization);
    if (archState.minExp)         params.set('minExperience',  archState.minExp);
    if (archState.maxExp)         params.set('maxExperience',  archState.maxExp);
    if (parseFloat(archState.minRating) > 0) params.set('minRating', archState.minRating);

    try {
        var r = await fetch(CLIENT_API + '/client/architects?' + params, { headers: authHeaders() });
        if (r.status === 401 || r.status === 403) { logout(); return; }
        var d = await r.json();
        if (d.success) {
            archState.total = d.pagination.total;
            archState.pages = d.pagination.pages;
            renderCards(d.data);
            renderPagination();
            document.getElementById('resultsCount').innerHTML =
                '<strong>' + d.pagination.total + '</strong> architect' +
                (d.pagination.total !== 1 ? 's' : '') + ' found';
        } else { renderError(); }
    } catch (err) { renderError(); }
    finally { archState.loading = false; }
}

/* ============================================================
   RENDER CARDS
   ============================================================ */
function renderSkeletons() {
    document.getElementById('architectGrid').innerHTML = Array.from({ length: 6 }).map(function() {
        return '<div class="skel-card">' +
            '<div class="skel-header">' +
                '<div class="skeleton skel-avatar"></div>' +
                '<div class="skel-lines">' +
                    '<div class="skeleton skel-line" style="width:70%"></div>' +
                    '<div class="skeleton skel-line" style="width:50%"></div>' +
                    '<div class="skeleton skel-line" style="width:40%"></div>' +
                '</div>' +
            '</div>' +
            '<div class="skel-stats">' +
                '<div class="skeleton skel-stat"></div>' +
                '<div class="skeleton skel-stat"></div>' +
                '<div class="skeleton skel-stat"></div>' +
            '</div>' +
            '<div class="skel-footer skeleton"></div>' +
        '</div>';
    }).join('');
    document.getElementById('pagination').innerHTML = '';
}

function renderCards(architects) {
    var grid = document.getElementById('architectGrid');
    if (!architects.length) {
        grid.innerHTML =
            '<div class="empty-state">' +
                '<div class="empty-icon"><i class="fas fa-user-slash"></i></div>' +
                '<div class="empty-title">No architects found</div>' +
                '<div class="empty-text">Try adjusting your filters or search terms</div>' +
            '</div>';
        return;
    }
    grid.innerHTML = architects.map(function(a, i) {
        var avatar = a.avatar ||
            'https://ui-avatars.com/api/?name=' + encodeURIComponent(a.name) + '&background=8b5cf6&color=fff&bold=true&size=80';
        var bio = a.bio || 'Experienced architect ready to bring your vision to life.';
        var locationHtml = a.location
            ? '<div class="card-location"><i class="fas fa-map-marker-alt" style="font-size:0.65rem"></i>' + esc(a.location) + '</div>'
            : '';
        return '<div class="arch-card" style="animation-delay:' + (i * 0.05) + 's" onclick="openProfile(\'' + a.id + '\')">' +
            '<div class="card-header">' +
                '<div class="card-avatar-wrap">' +
                    '<img class="card-avatar" src="' + avatar + '" alt="' + esc(a.name) + '"' +
                        ' onerror="this.src=\'https://ui-avatars.com/api/?name=' + encodeURIComponent(a.name) + '&background=8b5cf6&color=fff&bold=true\'">' +
                    '<div class="card-avatar-badge"></div>' +
                '</div>' +
                '<div class="card-info">' +
                    '<div class="card-name" title="' + esc(a.name) + '">' + esc(a.name) + '</div>' +
                    '<div class="card-spec">' + esc(a.specialization) + '</div>' +
                    locationHtml +
                '</div>' +
            '</div>' +
            '<div class="card-stats">' +
                '<div class="stat-item"><div class="stat-value">' + (a.experience || 0) + '</div><div class="stat-label">Years Exp.</div></div>' +
                '<div class="stat-item"><div class="stars">' + renderStars(a.rating) + '</div><div class="stat-label">' + (a.rating || 0).toFixed(1) + ' Rating</div></div>' +
                '<div class="stat-item"><div class="stat-value">' + (a.totalProjects || 0) + '</div><div class="stat-label">Projects</div></div>' +
            '</div>' +
            '<div class="card-footer">' +
                '<div class="card-bio">' + esc(bio) + '</div>' +
                '<div style="display:flex;align-items:center;gap:0.5rem;margin-top:0.65rem">' +
                    '<span class="card-cta">View <i class="fas fa-arrow-right" style="font-size:0.7rem"></i></span>' +
                    '<button class="connect-card-btn" id="cbtn-' + a.id + '" ' +
                        'onclick="event.stopPropagation();openConnectModal(\'' + a.id + '\',\'' + esc(a.name) + '\',\'' + esc(a.specialization) + '\',\'' + (a.avatar||'') + '\')"> ' +
                        '<i class="fas fa-user-plus" style="font-size:0.7rem"></i> Connect' +
                    '</button>' +
                '</div>' +
            '</div>' +
        '</div>';
    }).join('');
}

function renderPagination() {
    var el = document.getElementById('pagination');
    if (archState.pages <= 1) { el.innerHTML = ''; return; }
    var html = '<button class="page-btn" onclick="goPage(' + (archState.page - 1) + ')" ' + (archState.page <= 1 ? 'disabled' : '') + '><i class="fas fa-chevron-left"></i></button>';
    for (var p = 1; p <= archState.pages; p++) {
        if (archState.pages > 7 && Math.abs(p - archState.page) > 2 && p !== 1 && p !== archState.pages) {
            if (p === 2 || p === archState.pages - 1) html += '<span style="color:var(--slate);padding:0 4px">...</span>';
            continue;
        }
        html += '<button class="page-btn ' + (p === archState.page ? 'active' : '') + '" onclick="goPage(' + p + ')">' + p + '</button>';
    }
    html += '<button class="page-btn" onclick="goPage(' + (archState.page + 1) + ')" ' + (archState.page >= archState.pages ? 'disabled' : '') + '><i class="fas fa-chevron-right"></i></button>';
    el.innerHTML = html;
}

function renderError() {
    document.getElementById('architectGrid').innerHTML =
        '<div class="empty-state">' +
            '<div class="empty-icon"><i class="fas fa-exclamation-triangle"></i></div>' +
            '<div class="empty-title">Failed to load architects</div>' +
            '<div class="empty-text">Please check that the server is running and try again.</div>' +
        '</div>';
}

/* ============================================================
   MODAL
   ============================================================ */
async function openProfile(id) {
    var backdrop = document.getElementById('modalBackdrop');
    var body     = document.getElementById('modalBody');
    var av       = document.getElementById('modalAvatar');

    body.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--slate)">' +
        '<i class="fas fa-spinner fa-spin" style="font-size:1.5rem;margin-bottom:1rem;display:block"></i>' +
        'Loading profile...</div>';
    av.src = '';
    backdrop.classList.add('open');
    document.body.style.overflow = 'hidden';

    try {
        var r = await fetch(CLIENT_API + '/client/architects/' + id, { headers: authHeaders() });
        var d = await r.json();
        if (!d.success) throw new Error();
        renderModal(d.data);
    } catch (err) {
        body.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--rose)">' +
            '<i class="fas fa-exclamation-circle" style="font-size:1.5rem;margin-bottom:1rem;display:block"></i>' +
            'Could not load architect profile.</div>';
    }
}

function renderModal(a) {
    var av = document.getElementById('modalAvatar');
    var fallback = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(a.name) + '&background=8b5cf6&color=fff&bold=true&size=80';
    av.src = a.avatar || fallback;
    av.onerror = function() { av.src = fallback; };

    var stars      = renderStars(a.rating, true);
    var planBadge  = planBadgeHtml(a.plan);
    var memberYear = a.memberSince ? new Date(a.memberSince).getFullYear() : '-';

    var portfolioHtml = '';
    if (a.portfolio && a.portfolio.length) {
        portfolioHtml = '<div class="modal-section">' +
            '<div class="modal-section-title"><i class="fas fa-link" style="color:var(--violet)"></i> Portfolio Links</div>' +
            '<div class="portfolio-links">' +
            a.portfolio.map(function(url) {
                return '<a href="' + url + '" target="_blank" rel="noopener" class="portfolio-link">' +
                    '<i class="fas fa-external-link-alt portfolio-link-icon"></i>' +
                    '<span class="portfolio-link-text">' + url + '</span>' +
                    '<i class="fas fa-chevron-right portfolio-link-arrow"></i>' +
                '</a>';
            }).join('') +
            '</div></div>';
    }

    var projectsHtml = '';
    if (a.recentProjects && a.recentProjects.length) {
        projectsHtml = '<div class="modal-section">' +
            '<div class="modal-section-title"><i class="fas fa-folder" style="color:var(--violet)"></i> Recent Projects</div>' +
            '<div class="projects-grid">' +
            a.recentProjects.map(function(p) {
                var areaHtml = (p.metadata && p.metadata.totalArea)
                    ? '<div class="project-card-type">' + p.metadata.totalArea.toLocaleString() + ' m2</div>'
                    : '';
                return '<div class="project-card">' +
                    '<div class="project-card-name" title="' + esc(p.name) + '">' + esc(p.name) + '</div>' +
                    '<div class="project-card-type">' + esc(p.type || 'residential') + '</div>' +
                    areaHtml +
                    '<span class="project-tag tag-' + p.status + '">' + p.status.replace('_', ' ') + '</span>' +
                '</div>';
            }).join('') +
            '</div></div>';
    }

    var emailHtml   = a.email   ? '<div class="contact-item"><div class="contact-icon email"><i class="fas fa-envelope"></i></div><div><div class="contact-lbl">Email</div><div class="contact-val">' + esc(a.email) + '</div></div></div>' : '';
    var phoneHtml   = a.phone   ? '<div class="contact-item"><div class="contact-icon phone"><i class="fas fa-phone"></i></div><div><div class="contact-lbl">Phone</div><div class="contact-val">' + esc(a.phone) + '</div></div></div>' : '';
    var companyHtml = a.company ? '<div class="contact-item"><div class="contact-icon company"><i class="fas fa-building"></i></div><div><div class="contact-lbl">Company</div><div class="contact-val">' + esc(a.company) + '</div></div></div>' : '';
    var memberHtml  = '<div class="contact-item"><div class="contact-icon member"><i class="fas fa-calendar-alt"></i></div><div><div class="contact-lbl">Member Since</div><div class="contact-val">' + memberYear + '</div></div></div>';
    var contactHtml = '<div class="modal-section"><div class="modal-section-title"><i class="fas fa-id-card" style="color:var(--violet)"></i> Contact &amp; Info</div><div class="contact-grid">' + emailHtml + phoneHtml + companyHtml + memberHtml + '</div></div>';

    var locationHtml = a.location ? '<div class="modal-meta-item"><i class="fas fa-map-marker-alt"></i>' + esc(a.location) + '</div>' : '';
    var bioHtml = a.bio
        ? '<div class="modal-bio">' + esc(a.bio) + '</div>'
        : '<div class="modal-bio"><span class="modal-bio-empty">No bio provided yet.</span></div>';

    document.getElementById('modalBody').innerHTML =
        '<div class="modal-name">' + esc(a.name) + ' ' + planBadge + '</div>' +
        '<div class="modal-spec">' + esc(a.specialization) + '</div>' +
        '<div class="modal-meta">' + locationHtml + '<div class="modal-meta-item">' + stars + '<span style="margin-left:4px;color:var(--white)">' + (a.rating || 0).toFixed(1) + '</span></div></div>' +
        '<div class="modal-stats">' +
            '<div class="modal-stat"><div class="modal-stat-val">' + (a.experience || 0) + '</div><div class="modal-stat-lbl">Years Exp.</div></div>' +
            '<div class="modal-stat"><div class="modal-stat-val">' + (a.totalProjects || 0) + '</div><div class="modal-stat-lbl">Projects</div></div>' +
            '<div class="modal-stat"><div class="modal-stat-val">' + (a.rating || 0).toFixed(1) + '</div><div class="modal-stat-lbl">Rating</div></div>' +
        '</div>' +
        '<div class="modal-section"><div class="modal-section-title"><i class="fas fa-user" style="color:var(--violet)"></i> About</div>' + bioHtml + '</div>' +
        portfolioHtml + projectsHtml + contactHtml +
        '<div style="padding:0.25rem 0 0.5rem">' +
            '<button class="connect-modal-cta" id="modalConnectBtn" ' +
                'onclick="openConnectModal(\'' + a.id + '\',\'' + esc(a.name) + '\',\'' + esc(a.specialization) + '\',\'' + (a.avatar||'') + '\')"> ' +
                '<i class="fas fa-user-plus"></i> Connect with ' + esc(a.name.split(' ')[0]) +
            '</button>' +
        '</div>';
    // Update connect button state after modal renders
    setTimeout(function() { refreshModalConnectBtn(a.id); }, 100);
}

function closeModal(e) {
    if (e && e.target !== document.getElementById('modalBackdrop')) return;
    closeModalDirect();
}
function closeModalDirect() {
    document.getElementById('modalBackdrop').classList.remove('open');
    document.body.style.overflow = '';
}

/* ============================================================
   FILTER CONTROLS
   ============================================================ */
function setExp(btn, min, max) {
    document.querySelectorAll('[data-exp]').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    archState.minExp = min; archState.maxExp = max; archState.page = 1;
    fetchArchitects();
}
function setRating(btn, rating) {
    document.querySelectorAll('[data-rating]').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    archState.minRating = rating; archState.page = 1;
    fetchArchitects();
}
function goPage(p) {
    if (p < 1 || p > archState.pages) return;
    archState.page = p;
    fetchArchitects();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ============================================================
   HELPERS
   ============================================================ */
function renderStars(rating, large) {
    var sz = large ? '0.85rem' : '0.7rem';
    var html = '';
    for (var i = 1; i <= 5; i++) {
        if (rating >= i)           html += '<i class="fas fa-star star filled" style="font-size:' + sz + '"></i>';
        else if (rating >= i-0.5)  html += '<i class="fas fa-star-half-alt star half" style="font-size:' + sz + '"></i>';
        else                       html += '<i class="far fa-star star" style="font-size:' + sz + '"></i>';
    }
    return html;
}
function planBadgeHtml(plan) {
    var map   = { pro: 'plan-pro', enterprise: 'plan-enterprise', free: 'plan-free' };
    var cls   = map[plan] || 'plan-free';
    var label = (plan || 'free').charAt(0).toUpperCase() + (plan || 'free').slice(1);
    return '<span class="plan-badge ' + cls + '" style="vertical-align:middle;margin-left:0.4rem">' + label + '</span>';
}
function esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', async function() {
    var token = requireClientAuth();
    if (!token) return;

    try {
        var resp = await fetch(CLIENT_API + '/client/me', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (!resp.ok) {
            localStorage.removeItem('client_token');
            localStorage.removeItem('client_user');
            window.location.href = 'client-index.html?modal=login';
            return;
        }
        var data = await resp.json();
        if (data.user) localStorage.setItem('client_user', JSON.stringify(data.user));
    } catch (e) {
        console.warn('Could not refresh user data:', e.message);
    }

    loadUser();
    loadDashboardStats();

    // Hide loader
    var loader = document.getElementById('pageLoader');
    if (loader) {
        loader.style.opacity    = '0';
        loader.style.transition = 'opacity 0.4s';
        setTimeout(function() { loader.remove(); }, 400);
    }

    // Filter event listeners (safe even if elements not visible yet)
    document.getElementById('sortFilter').addEventListener('change', function() {
        archState.sort = this.value; archState.page = 1; fetchArchitects();
    });
    document.getElementById('specFilter').addEventListener('change', function() {
        archState.specialization = this.value; archState.page = 1; fetchArchitects();
    });
    document.getElementById('searchInput').addEventListener('input', function() {
        clearTimeout(searchDebounce);
        var self = this;
        searchDebounce = setTimeout(function() {
            archState.search = self.value.trim(); archState.page = 1; fetchArchitects();
        }, 350);
    });

    // Keyboard shortcut
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') closeModalDirect();
    });

    // ── Heartbeat presence ────────────────────────────────────────────────────
    if (typeof startHeartbeat === 'function') {
        startHeartbeat({
            apiBase:  CLIENT_API,
            getToken: function() { return localStorage.getItem('client_token'); }
        });
    }

    // ── Description char counter ──────────────────────────────────────────────
    var desc = document.getElementById('wf-desc');
    var cnt  = document.getElementById('wf-desc-count');
    if (desc && cnt) desc.addEventListener('input', function() { cnt.textContent = desc.value.length; });
});

/* ============================================================
   CONNECT FEATURE
   ============================================================ */

var connectState = { architectId: null, architectName: null, selectedProjectId: null };
var activeChatConnectionId = null;
var chatPollTimer = null;
var activeConnTab = 'active';
var _allConnections = [];

/* ── Open Connect Modal ──────────────────────────────────────────────── */
async function openConnectModal(archId, archName, archSpec, archAvatar) {
    connectState.architectId   = archId;
    connectState.architectName = archName;
    connectState.selectedProjectId = null;

    // Fill header
    var fallback = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(archName) + '&background=8b5cf6&color=fff&bold=true';
    document.getElementById('connectArchAvatar').src = archAvatar || fallback;
    document.getElementById('connectArchAvatar').onerror = function() { this.src = fallback; };
    document.getElementById('connectArchName').textContent = archName;
    document.getElementById('connectArchSpec').textContent = archSpec || 'Architect';
    document.getElementById('connectIntroMsg').value = '';

    // Check existing status
    try {
        var r = await fetch(CLIENT_API + '/connections/status/' + archId, { headers: authHeaders() });
        var d = await r.json();
        if (d.status === 'accepted') {
            closeModalDirect();
            openChatModal(d.connectionId, archName, archAvatar || fallback);
            return;
        }
        if (d.status === 'pending') {
            closeModalDirect();
            showToast('You already have a pending request with ' + archName + '.', 'info');
            return;
        }
    } catch(e) {}

    // Load client's projects into project picker
    var listEl = document.getElementById('connectProjectList');
    listEl.innerHTML = '<div style="color:var(--slate);font-size:0.85rem"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';

    document.getElementById('connectBackdrop').classList.add('open');
    document.body.style.overflow = 'hidden';

    try {
        var pr = await fetch(CLIENT_API + '/client/projects', { headers: authHeaders() });
        var pd = await pr.json();
        var projects = (pd.data || []).slice(0, 10);
        var createNewHtml = '<div style="margin-top:0.5rem">' +
            '<button onclick="closeConnectModal();openCreateProject()" ' +
            'style="width:100%;padding:0.5rem;border:1.5px dashed rgba(139,92,246,0.4);border-radius:9px;background:rgba(139,92,246,0.05);color:var(--violet);font-size:0.78rem;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:0.4rem">' +
            '<i class="fas fa-plus" style="font-size:0.7rem"></i> Create a new project brief</button></div>';
        if (!projects.length) {
            listEl.innerHTML = '<div style="color:var(--slate);font-size:0.83rem;padding:0.4rem 0">No projects yet — you can still connect without one.</div>' + createNewHtml;
        } else {
            listEl.innerHTML = projects.map(function(p) {
                var badge = p.hasAcceptedConnection
                    ? '<span class="project-pick-connected-badge"><i class="fas fa-check-circle"></i> Connected</span>'
                    : '';
                return '<label class="project-pick-item">' +
                    '<input type="radio" name="connectProject" value="' + p._id + '" onchange="selectConnectProject(\'' + p._id + '\')">' +
                    '<span class="project-pick-label">' +
                        '<span class="project-pick-name">' + esc(p.title || p.name) + '</span>' +
                        '<span class="project-pick-type">' + esc(p.projectType || p.type || 'project') + '</span>' +
                    '</span>' +
                    badge +
                '</label>';
            }).join('') +
            '<label class="project-pick-item">' +
                '<input type="radio" name="connectProject" value="" checked onchange="selectConnectProject(null)">' +
                '<span class="project-pick-label"><span class="project-pick-name" style="color:var(--slate)">No specific project</span></span>' +
            '</label>' + createNewHtml;
        }
    } catch(e) {
        listEl.innerHTML = '<div style="color:var(--slate);font-size:0.83rem">Could not load projects.</div>';
    }
}
async function openConnectAnotherProject(archId, archName, archSpec, archAvatar) {
    // Close the architect profile modal first
    closeModalDirect();

    connectState.architectId   = archId;
    connectState.architectName = archName;
    connectState.selectedProjectId = null;

    var fallback = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(archName) + '&background=8b5cf6&color=fff&bold=true';
    document.getElementById('connectArchAvatar').src = archAvatar || fallback;
    document.getElementById('connectArchAvatar').onerror = function() { this.src = fallback; };
    document.getElementById('connectArchName').textContent = archName;
    document.getElementById('connectArchSpec').textContent = archSpec || 'Architect';
    document.getElementById('connectIntroMsg').value = '';

    var listEl = document.getElementById('connectProjectList');
    listEl.innerHTML = '<div style="color:var(--slate);font-size:0.85rem"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';

    document.getElementById('connectBackdrop').classList.add('open');
    document.body.style.overflow = 'hidden';

    try {
        var pr = await fetch(CLIENT_API + '/client/projects', { headers: authHeaders() });
        var pd = await pr.json();
        // Only show projects NOT already connected to this architect
        var allProjects  = pd.data || [];
        var freeProjects = allProjects.filter(function(p) { return !p.hasAcceptedConnection; });

        var createNewHtml = '<div style="margin-top:0.5rem">' +
            '<button onclick="closeConnectModal();openCreateProject()" ' +
            'style="width:100%;padding:0.5rem;border:1.5px dashed rgba(139,92,246,0.4);border-radius:9px;background:rgba(139,92,246,0.05);color:var(--violet);font-size:0.78rem;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:0.4rem">' +
            '<i class="fas fa-plus" style="font-size:0.7rem"></i> Create a new project brief</button></div>';

        if (!freeProjects.length) {
            listEl.innerHTML =
                '<div style="color:var(--slate);font-size:0.83rem;padding:0.5rem 0;line-height:1.6">' +
                '<i class="fas fa-info-circle" style="color:var(--violet);margin-right:0.4rem"></i>' +
                'All your projects already have an architect connected. Create a new project brief to assign to ' + esc(archName) + '.' +
                '</div>' + createNewHtml;
        } else {
            listEl.innerHTML = freeProjects.map(function(p) {
                return '<label class="project-pick-item">' +
                    '<input type="radio" name="connectProject" value="' + p._id + '" onchange="selectConnectProject(\'' + p._id + '\')">' +
                    '<span class="project-pick-label">' +
                        '<span class="project-pick-name">' + esc(p.title || p.name) + '</span>' +
                        '<span class="project-pick-type">' + esc(p.projectType || p.type || 'project') + '</span>' +
                    '</span>' +
                '</label>';
            }).join('') +
            '<label class="project-pick-item">' +
                '<input type="radio" name="connectProject" value="" checked onchange="selectConnectProject(null)">' +
                '<span class="project-pick-label"><span class="project-pick-name" style="color:var(--slate)">No specific project</span></span>' +
            '</label>' + createNewHtml;
        }
    } catch(e) {
        listEl.innerHTML = '<div style="color:var(--slate);font-size:0.83rem">Could not load projects.</div>';
    }
}

function selectConnectProject(id) {
    connectState.selectedProjectId = id || null;
}

function closeConnectModal(e) {
    if (e && e.target !== document.getElementById('connectBackdrop')) return;
    document.getElementById('connectBackdrop').classList.remove('open');
    document.body.style.overflow = '';
}

/* ── Submit Connect Request ──────────────────────────────────────────── */
async function submitConnectRequest() {
    var btn  = document.getElementById('connectSendBtn');
    var msg  = document.getElementById('connectIntroMsg').value.trim();

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

    try {
        var r = await fetch(CLIENT_API + '/connections/request', {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({
                architectId:  connectState.architectId,
                projectId:    connectState.selectedProjectId,
                introMessage: msg
            })
        });
        var d = await r.json();
        if (!d.success) throw new Error(d.message);

        document.getElementById('connectBackdrop').classList.remove('open');
        document.body.style.overflow = '';
        showToast('Connection request sent to ' + connectState.architectName + '!', 'success');

        // Update card button to "Pending"
        updateCardConnectBtn(connectState.architectId, 'pending');
        var modalBtn = document.getElementById('modalConnectBtn');
        if (modalBtn) { modalBtn.disabled = true; modalBtn.innerHTML = '<i class="fas fa-clock"></i> Request Pending'; }

    } catch(err) {
        showToast(err.message || 'Could not send request.', 'error');
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Request';
    }
}

/* ── Refresh connect button state in card ────────────────────────────── */
async function refreshCardConnectBtn(archId) {
    try {
        var r = await fetch(CLIENT_API + '/connections/status/' + archId, { headers: authHeaders() });
        var d = await r.json();
        updateCardConnectBtn(archId, d.status || 'none', d.connectionId, d.connectionId ? { id: d.connectionId } : null);
    } catch(e) {}
}

async function refreshModalConnectBtn(archId) {
    var btn = document.getElementById('modalConnectBtn');
    if (!btn) return;
    btn.dataset.archid = archId;
    try {
        var r = await fetch(CLIENT_API + '/connections/status/' + archId, { headers: authHeaders() });
        var d = await r.json();
        if (d.status === 'accepted') {
            btn.innerHTML = '<i class="fas fa-comments"></i> Open Chat';
            btn.onclick = function() { openChatModal(d.connectionId, btn.dataset.name || '', btn.dataset.avatar || ''); };
            // Inject "Connect Another Project" button if not already present
            if (!document.getElementById('modalAssignNewBtn')) {
                var assignBtn = document.createElement('button');
                assignBtn.id = 'modalAssignNewBtn';
                assignBtn.className = 'connect-modal-cta';
                assignBtn.style.cssText = 'margin-top:0.6rem;background:rgba(139,92,246,0.12);border:1.5px solid rgba(139,92,246,0.35);color:var(--violet);';
                assignBtn.innerHTML = '<i class="fas fa-plus-circle"></i> Connect Another Project';
                assignBtn.onclick = function() {
                    var cachedArchId   = btn.closest('[data-arch-id]') ? btn.closest('[data-arch-id]').dataset.archId : null;
                    var cachedArchName = btn.dataset.name || document.getElementById('modalConnectBtn').dataset.name || '';
                    var cachedArchSpec = '';
                    var cachedArchAvatar = '';
                    // Read from rendered modal header if available
                    var av = document.getElementById('modalAvatar');
                    if (av) cachedArchAvatar = av.src || '';
                    var nameEl = document.querySelector('#modalBody .modal-name');
                    // Use archId stored on the button itself
                    var resolvedArchId = btn.dataset.archid || archId;
                    openConnectAnotherProject(resolvedArchId, btn.dataset.name || archId, cachedArchSpec, cachedArchAvatar);
                };
                btn.parentNode.insertBefore(assignBtn, btn.nextSibling);
            }
        } else if (d.status === 'pending') {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-clock"></i> Request Pending';
        }
    } catch(e) {}
}

function updateCardConnectBtn(archId, status, connectionId, archData) {
    var btn = document.getElementById('cbtn-' + archId);
    if (!btn) return;
    if (status === 'pending') {
        btn.className = 'connect-card-btn status-pending';
        btn.innerHTML = '<i class="fas fa-clock" style="font-size:0.7rem"></i> Pending';
        btn.onclick = function(e) { e.stopPropagation(); showToast('Request is awaiting architect response.', 'info'); };
    } else if (status === 'accepted') {
        btn.className = 'connect-card-btn status-accepted';
        btn.innerHTML = '<i class="fas fa-comments" style="font-size:0.7rem"></i> Chat';
        btn.onclick = function(e) {
            e.stopPropagation();
            var av = btn.closest('.arch-card') ? btn.closest('.arch-card').querySelector('.card-avatar') : null;
            openChatModal(connectionId, btn.dataset.archname || archId, av ? av.src : '');
        };
    }
}

/* ── Load My Connections View ────────────────────────────────────────── */
function showCustomConfirm(title, message, onConfirm) {
    var backdrop = document.getElementById('customConfirmBackdrop');
    document.getElementById('customConfirmTitle').textContent = title;
    document.getElementById('customConfirmMsg').textContent   = message;
    backdrop.style.display = 'flex';

    var okBtn     = document.getElementById('customConfirmOk');
    var cancelBtn = document.getElementById('customConfirmCancel');

    function cleanup() {
        backdrop.style.display = 'none';
        okBtn.replaceWith(okBtn.cloneNode(true));
        cancelBtn.replaceWith(cancelBtn.cloneNode(true));
    }

    document.getElementById('customConfirmOk').addEventListener('click', function() {
        cleanup(); onConfirm();
    });
    document.getElementById('customConfirmCancel').addEventListener('click', cleanup);
    backdrop.addEventListener('click', function handler(e) {
        if (e.target === backdrop) { cleanup(); backdrop.removeEventListener('click', handler); }
    });
}

async function cancelConnectionRequest(connectionId, archName) {
    showCustomConfirm(
        'Cancel Request',
        'Cancel your pending request to ' + archName + '? You can send a new request later.',
        async function() {
            try {
                var r = await fetch(CLIENT_API + '/connections/' + connectionId, {
                    method:  'DELETE',
                    headers: authHeaders()
                });
                var d = await r.json();
                if (!d.success) throw new Error(d.message);
                showToast('Request to ' + archName + ' cancelled.', 'success');
                await loadConnections();
            } catch(err) {
                showToast(err.message || 'Could not cancel request.', 'error');
            }
        }
    );
}

/* ── Delete a rejected connection card ───────────────────────────────── */
async function deleteRejectedConnection(connectionId, archName) {
    showCustomConfirm(
        'Delete Connection',
        'Remove this rejected request from ' + archName + '? This will permanently delete the card.',
        async function() {
            try {
                var r = await fetch(CLIENT_API + '/connections/' + connectionId + '/rejected', {
                    method:  'DELETE',
                    headers: authHeaders()
                });
                var d = await r.json();
                if (!d.success) throw new Error(d.message);
                showToast('Connection with ' + archName + ' deleted.', 'success');
                await loadConnections();
            } catch(err) {
                showToast(err.message || 'Could not delete connection.', 'error');
            }
        }
    );
}

/* ── Re-request a rejected connection ────────────────────────────────── */
async function rerequestConnection(connectionId, archId, archName, archSpec, archAvatar) {
    showCustomConfirm(
        'Send New Request',
        'Send a fresh connection request to ' + archName + '? The previous rejected request will be removed first.',
        async function() {
            try {
                // Delete the old rejected connection first
                var delR = await fetch(CLIENT_API + '/connections/' + connectionId + '/rejected', {
                    method:  'DELETE',
                    headers: authHeaders()
                });
                var delD = await delR.json();
                if (!delD.success) throw new Error(delD.message);

                // Now open the connect modal to send a new request
                await loadConnections();
                openConnectModal(archId, archName, archSpec, archAvatar);
            } catch(err) {
                showToast(err.message || 'Could not initiate re-request.', 'error');
            }
        }
    );
}
var activeConnTab    = 'active';
var _allConnections  = [];
var _allShares       = [];   // ProjectShare records — used to detect completed connections

async function loadConnections() {
    var body = document.getElementById('connectionsBody');
    body.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--slate)"><i class="fas fa-spinner fa-spin" style="font-size:1.5rem"></i><div style="margin-top:1rem">Loading...</div></div>';

    try {
        var [connRes, shareRes] = await Promise.all([
            fetch(CLIENT_API + '/connections/my', { headers: authHeaders() }),
            fetch(CLIENT_API + '/shares/my',      { headers: authHeaders() })
        ]);
        var connData  = await connRes.json();
        var shareData = await shareRes.json();
        if (!connData.success) throw new Error();
        _allShares = (shareData.success && shareData.data) ? shareData.data : [];
        activeConnTab = 'active';
        renderConnections(connData.data);
    } catch(e) {
        body.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--rose)"><i class="fas fa-exclamation-circle" style="font-size:1.5rem"></i><div style="margin-top:1rem">Could not load connections.</div></div>';
    }
}

function renderConnections(conns) {
    _allConnections = conns;

    // Nav badge — pending + unread
    var pending = conns.filter(function(c) { return c.status === 'pending'; }).length;
    var unread  = conns.filter(function(c) { return c.unreadByClient > 0; }).length;
    var badge   = document.getElementById('connNavBadge');
    if (pending + unread > 0) { badge.textContent = pending + unread; badge.style.display = ''; }
    else { badge.style.display = 'none'; }

    _updateConnTabBadges(conns);
    switchConnTab('active');
}

// ── Determine if a connection's architect has completed a project for this client ──
function _isCompletedWithArchitect(conn) {
    var archId = conn.architect && (conn.architect._id || conn.architect.id || conn.architect);
    if (!archId) return false;
    archId = String(archId);
    return _allShares.some(function(s) {
        var shareArchId = s.sharedBy && (s.sharedBy._id || s.sharedBy.id || s.sharedBy);
        if (String(shareArchId) !== archId) return false;
        var proj = s.project;
        return proj && typeof proj === 'object' && proj.status === 'completed';
    });
}

function switchConnTab(tab) {
    activeConnTab = tab;
    ['active','completed','pending','history'].forEach(function(t) {
        var el = document.getElementById('connTab-' + t);
        if (el) el.classList.toggle('active', t === tab);
    });
    _renderConnTab(tab);
}

function _updateConnTabBadges(conns) {
    var active    = conns.filter(function(c) { return c.status === 'accepted' && !_isCompletedWithArchitect(c); });
    var completed = conns.filter(function(c) { return _isCompletedWithArchitect(c); });
    var pending   = conns.filter(function(c) { return c.status === 'pending'; });

    var set = function(id, count) {
        var el = document.getElementById('connTabBadge-' + id);
        if (!el) return;
        el.textContent = count;
        el.classList.toggle('visible', count > 0);
    };
    set('active',    active.length);
    set('completed', completed.length);
    set('pending',   pending.length);
    set('history',   conns.length);
}

function _renderConnTab(tab) {
    var body  = document.getElementById('connectionsBody');
    var conns = _allConnections;
    if (tab === 'active') {
        _renderConnCards(conns.filter(function(c) { return c.status === 'accepted' && !_isCompletedWithArchitect(c); }), body, false);
    } else if (tab === 'completed') {
        _renderConnCards(conns.filter(function(c) { return _isCompletedWithArchitect(c); }), body, true);
    } else if (tab === 'pending') {
        _renderConnCards(conns.filter(function(c) { return c.status === 'pending'; }), body, false);
    } else {
        _renderConnHistory(conns, body);
    }
}

function _renderConnCards(conns, body, isCompleted) {
    if (!conns.length) {
        var icon = isCompleted ? 'check-circle' : (activeConnTab === 'pending' ? 'clock' : 'user-friends');
        var title = isCompleted ? 'No completed projects yet'
            : activeConnTab === 'pending' ? 'No pending requests' : 'No active connections';
        var sub = isCompleted ? 'Completed project connections will appear here.'
            : activeConnTab === 'pending' ? 'Requests you send to architects will appear here.'
            : 'Browse architects and click Connect to send a request.';
        body.innerHTML =
            '<div class="conn-empty">' +
                '<div class="conn-empty-icon"><i class="fas fa-' + icon + '"></i></div>' +
                '<div class="conn-empty-title">' + title + '</div>' +
                '<div class="conn-empty-sub">' + sub + '</div>' +
                (activeConnTab === 'active' ? '<button class="btn-primary" onclick="showView(\'architects\')" style="margin-top:1.5rem;padding:0.65rem 1.5rem;border-radius:9px;font-size:0.875rem;font-weight:700;border:none;cursor:pointer;"><i class="fas fa-search"></i> Find Architects</button>' : '') +
            '</div>';
        return;
    }

    body.innerHTML = '<div class="conn-grid">' + conns.map(function(c) {
        var arch    = c.architect || {};
        var avatar  = arch.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(arch.name || 'A') + '&background=8b5cf6&color=fff&bold=true';
        var isOnlineConn = (typeof isOnline === 'function') ? isOnline(arch.lastSeen || null) : false;
        var onlineDot = isOnlineConn
            ? '<span style="display:inline-flex;align-items:center;gap:3px;font-size:0.68rem;color:#10b981;margin-top:3px;"><span style="width:7px;height:7px;border-radius:50%;background:#10b981;box-shadow:0 0 5px #10b981;display:inline-block;flex-shrink:0;"></span>Online</span>'
            : '<span style="display:inline-flex;align-items:center;gap:3px;font-size:0.68rem;color:#64748b;margin-top:3px;"><span style="width:7px;height:7px;border-radius:50%;background:#475569;display:inline-block;flex-shrink:0;"></span>Offline</span>';
        var projHtml    = c.projectName ? '<div class="conn-project"><i class="fas fa-folder" style="font-size:0.65rem;color:var(--violet)"></i> ' + esc(c.projectName) + '</div>' : '';
        var intro       = c.introMessage ? '<div class="conn-intro">' + esc(c.introMessage) + '</div>' : '';
        var unreadBadge = c.unreadByClient > 0 ? '<span class="conn-unread-badge">' + c.unreadByClient + ' new</span>' : '';
        var completedBadgeHtml = isCompleted ? '<div class="conn-completed-badge"><i class="fas fa-check-circle"></i> Project Completed</div>' : '';

        var statusMap = { pending: 'Pending', accepted: 'Accepted', rejected: 'Rejected' };
        var statusCls = { pending: 'status-pending', accepted: 'status-accepted', rejected: 'status-rejected' };

        var actionBtn = '';
        if (c.status === 'accepted') {
            actionBtn = '<button class="conn-chat-btn" onclick="openChatModal(\'' + c._id + '\',\'' + esc(arch.name) + '\',\'' + avatar + '\')">' +
                '<i class="fas fa-comments"></i> Chat ' + unreadBadge + '</button>';
        } else if (c.status === 'pending') {
            actionBtn = '<div class="conn-pending-note"><i class="fas fa-clock"></i> Awaiting response</div>' +
                '<button class="conn-cancel-btn" onclick="cancelConnectionRequest(\'' + c._id + '\',\'' + esc(arch.name) + '\')">' +
                '<i class="fas fa-times"></i> Cancel Request</button>';
        } else {
            actionBtn =
                '<div class="conn-rejected-note"><i class="fas fa-times-circle"></i> Request not accepted</div>' +
                '<div class="conn-rejected-actions">' +
                    '<button class="conn-rerequest-btn" onclick="rerequestConnection(\'' + c._id + '\',\'' + esc(arch.id || arch._id) + '\',\'' + esc(arch.name) + '\',\'' + esc(arch.specialization || '') + '\',\'' + avatar + '\')">' +
                        '<i class="fas fa-redo"></i> Re-request</button>' +
                    '<button class="conn-delete-btn" onclick="deleteRejectedConnection(\'' + c._id + '\',\'' + esc(arch.name) + '\')">' +
                        '<i class="fas fa-trash-alt"></i> Delete</button>' +
                '</div>';
        }

        return `<div class="conn-card${isCompleted ? ' is-completed' : ''}">
    <div class="conn-card-top">
        <img class="conn-arch-avatar" src="${avatar}" alt="${esc(arch.name)}"
             onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(arch.name||'A')}&background=8b5cf6&color=fff&bold=true'">
        <div class="conn-arch-info">
            <div class="conn-arch-name">${esc(arch.name)}</div>
            <div class="conn-arch-spec">${esc(arch.specialization || 'Architect')}</div>
            ${onlineDot}
            <span class="conn-status-chip ${statusCls[c.status] || ''}">${statusMap[c.status] || c.status}</span>
            ${completedBadgeHtml}
        </div>
    </div>
    ${projHtml}
    ${intro}
    <div class="conn-card-footer">${actionBtn}</div>
</div>`;
    }).join('') + '</div>';
}

function _renderConnHistory(conns, body) {
    if (!conns.length) {
        body.innerHTML = '<div class="conn-empty"><div class="conn-empty-icon"><i class="fas fa-history"></i></div><div class="conn-empty-title">No history yet</div><div class="conn-empty-sub">All your architect connections will be listed here.</div></div>';
        return;
    }
    var sorted = conns.slice().sort(function(a,b){ return new Date(b.createdAt)-new Date(a.createdAt); });
    var rows = sorted.map(function(c) {
        var arch   = c.architect || {};
        var avatar = arch.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(arch.name||'A') + '&background=8b5cf6&color=fff&bold=true';
        var projLabel = c.projectName ? '<span class="conn-history-proj"><i class="fas fa-folder" style="font-size:0.6rem;color:var(--violet)"></i> ' + esc(c.projectName) + '</span>' : '';
        var dateLabel = c.createdAt ? '<span class="conn-history-date"><i class="fas fa-calendar-alt" style="font-size:0.6rem"></i> ' + new Date(c.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) + '</span>' : '';
        var isCompleted = _isCompletedWithArchitect(c);
        var finalStatus = isCompleted ? 'completed' : c.status;
        var statusLabels = { accepted:'Active', completed:'Completed', rejected:'Rejected', pending:'Pending' };
        var statusCls    = { accepted:'hs-accepted', completed:'hs-completed', rejected:'hs-rejected', pending:'hs-pending' };
        return `<div class="conn-history-item">
    <img class="conn-history-avatar" src="${avatar}" alt="${esc(arch.name)}"
         onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(arch.name||'A')}&background=8b5cf6&color=fff&bold=true'">
    <div class="conn-history-info">
        <div class="conn-history-name">${esc(arch.name)}</div>
        <div class="conn-history-spec">${esc(arch.specialization||'Architect')}</div>
        <div class="conn-history-meta">${projLabel}${dateLabel}</div>
    </div>
    <span class="conn-history-status ${statusCls[finalStatus]||'hs-accepted'}">${statusLabels[finalStatus]||finalStatus}</span>
</div>`;
    }).join('');
    body.innerHTML = '<div class="conn-history-list">' + rows + '</div>';
}

/* ── Chat Modal ──────────────────────────────────────────────────────── */
function openChatModal(connectionId, archName, archAvatar) {
    activeChatConnectionId = connectionId;
    clearClientChatImg();
    document.getElementById('chatModalName').textContent   = archName;
    document.getElementById('chatModalAvatar').src         = archAvatar ||
        'https://ui-avatars.com/api/?name=' + encodeURIComponent(archName) + '&background=8b5cf6&color=fff&bold=true';
    document.getElementById('chatModalMessages').innerHTML =
        '<div style="text-align:center;padding:2rem;color:var(--slate)"><i class="fas fa-spinner fa-spin"></i></div>';
    document.getElementById('chatModalInput').value = '';

    document.getElementById('chatBackdrop').classList.add('open');
    document.body.style.overflow = 'hidden';

    loadChatMessages();

    // Poll for new messages every 8 seconds
    clearInterval(chatPollTimer);
    chatPollTimer = setInterval(loadChatMessages, 8000);
}

function closeChatModal(e) {
    if (e && e.target !== document.getElementById('chatBackdrop')) return;
    document.getElementById('chatBackdrop').classList.remove('open');
    document.body.style.overflow = '';
    clearInterval(chatPollTimer);
    chatPollTimer = null;
    activeChatConnectionId = null;
    clearClientChatImg();
    document.getElementById('chatModalInput').value = '';
}

async function loadChatMessages() {
    if (!activeChatConnectionId) return;
    try {
        var r = await fetch(CLIENT_API + '/connections/' + activeChatConnectionId + '/messages', { headers: authHeaders() });
        var d = await r.json();
        if (!d.success) return;
        // Backend returns { success, data: { connection, messages } }
        var payload = d.data || {};
        renderChatMessages(payload.messages, payload.connection);
        _updateClientChatOnlineBadge(payload.connection);
    } catch(e) {}
}

function _updateClientChatOnlineBadge(connection) {
    var statusEl = document.getElementById('chatModalStatus');
    if (!statusEl) return;
    // connection.architect is populated with { name, avatar, lastSeen }
    var lastSeen = (connection && connection.architect && connection.architect.lastSeen)
        ? connection.architect.lastSeen
        : null;
    var online = (typeof isOnline === 'function') ? isOnline(lastSeen) : false;
    var dotColor = online ? '#10b981' : '#64748b';
    var glow     = online ? 'box-shadow:0 0 6px #10b981;' : '';
    var dot = '<span style="width:7px;height:7px;border-radius:50%;background:' + dotColor + ';' + glow + 'display:inline-block;flex-shrink:0;"></span>';
    statusEl.innerHTML = dot + (online
        ? ' <span style="color:#10b981">Connected · Online</span>'
        : ' <span style="color:#64748b">Connected · Offline</span>');
}

function renderChatMessages(messages, connection) {
    var clientId = (JSON.parse(localStorage.getItem('client_user') || '{}') || {}).id || '';
    var el = document.getElementById('chatModalMessages');

    if (!messages || !messages.length) {
        // Show intro message if exists
        var intro = connection && connection.introMessage;
        if (intro) {
            el.innerHTML = '<div class="chat-msg chat-msg-self"><div class="chat-msg-bubble">' + esc(intro) + '</div><div class="chat-msg-time">Request message</div></div>' +
                '<div class="chat-msg-divider">Waiting for architect to respond...</div>';
        } else {
            el.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--slate)">No messages yet. Say hello!</div>';
        }
        return;
    }

    var BASE = 'http://localhost:5000';
    var html = '';
    // Show intro message first if any
    if (connection && connection.introMessage) {
        html += '<div class="chat-msg chat-msg-self"><div class="chat-msg-bubble">' + esc(connection.introMessage) + '</div><div class="chat-msg-time">Request message</div></div>';
    }
    messages.forEach(function(m) {
        var isSelf = m.senderRole === 'client';
        var time   = new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        var bubble;
        if (m.type === 'image' && m.imageUrl) {
            var src = BASE + m.imageUrl;
            bubble = '<img src="' + src + '" class="chat-bubble-img" onclick="openClientChatLightbox(\'' + src + '\')" onerror="this.style.display=\'none\'" alt="image">';
        } else {
            bubble = '<div class="chat-msg-bubble">' + esc(m.text) + '</div>';
        }

        html += '<div class="chat-msg ' + (isSelf ? 'chat-msg-self' : 'chat-msg-other') + '">' +
            bubble +
            '<div class="chat-msg-time">' + time + '</div>' +
        '</div>';
    });

    el.innerHTML = html;
    el.scrollTop = el.scrollHeight;
}

// ── Client chat image helpers ─────────────────────────────────────────────────
var _clientChatPendingImg = null;

function onClientChatImgSelected(e) {
    var file = e.target.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    _clientChatPendingImg = file;
    var thumb   = document.getElementById('clientChatImgThumb');
    var preview = document.getElementById('clientChatImgPreview');
    if (thumb)   thumb.src = URL.createObjectURL(file);
    if (preview) preview.style.display = 'flex';
}

function clearClientChatImg() {
    _clientChatPendingImg = null;
    var input   = document.getElementById('clientChatImgInput');
    var preview = document.getElementById('clientChatImgPreview');
    if (input)   input.value = '';
    if (preview) preview.style.display = 'none';
}

function openClientChatLightbox(src) {
    var lb  = document.getElementById('clientChatImgLightbox');
    var img = document.getElementById('clientChatImgLightboxImg');
    if (!lb || !img) return;
    img.src = src;
    lb.classList.add('open');
}

async function sendChatMessage() {
    if (!activeChatConnectionId) return;

    // ── Image send ────────────────────────────────────────────────────────────
    if (_clientChatPendingImg) {
        var file    = _clientChatPendingImg;
        var imgBtn  = document.getElementById('clientChatImgBtn');
        var sendBtn = document.querySelector('#chatModalPanel .chat-modal-send-btn');
        clearClientChatImg();
        if (imgBtn)  imgBtn.disabled  = true;
        if (sendBtn) sendBtn.disabled = true;

        try {
            var form  = new FormData();
            form.append('image', file);
            var token = localStorage.getItem('client_token');
            var r = await fetch(CLIENT_API + '/connections/' + activeChatConnectionId + '/messages/image', {
                method:  'POST',
                headers: { 'Authorization': 'Bearer ' + token },
                body:    form
            });
            var d = await r.json();
            if (!d.success) throw new Error(d.message);
            await loadChatMessages();
        } catch(err) {
            showToast(err.message || 'Could not send image.', 'error');
        } finally {
            if (imgBtn)  imgBtn.disabled  = false;
            if (sendBtn) sendBtn.disabled = false;
        }
        return;
    }

    // ── Text send ─────────────────────────────────────────────────────────────
    var input = document.getElementById('chatModalInput');
    var text  = input.value.trim();
    if (!text) return;

    input.value = '';
    input.disabled = true;

    try {
        var r = await fetch(CLIENT_API + '/connections/' + activeChatConnectionId + '/messages', {
            method:  'POST',
            headers: authHeaders(),
            body:    JSON.stringify({ text: text })
        });
        var d = await r.json();
        if (!d.success) throw new Error(d.message);
        await loadChatMessages();
    } catch(err) {
        showToast(err.message || 'Could not send message.', 'error');
        input.value = text;
    } finally {
        input.disabled = false;
        input.focus();
    }
}

function handleChatKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChatMessage();
    }
}

/* ============================================================
   CLIENT PROJECT FEATURE
   ============================================================ */

var cpState = {
    step:         1,
    projectType:  '',
    attachFiles:  [],    // File objects staged for upload
    editingId:    null   // null = create, string = edit mode
};

/* ── Open / Close Wizard ──────────────────────────────────────────────────── */
function openCreateProject(prefillType) {
    cpState = { step: 1, projectType: prefillType || '', attachFiles: [], editingId: null };
    document.getElementById('wizardTitle').textContent    = 'New Project';
    document.getElementById('wizardNextBtn').textContent  = 'Next ';
    document.getElementById('wizardNextBtn').innerHTML    = 'Next <i class="fas fa-arrow-right"></i>';
    resetWizardFields();
    if (prefillType) selectTypeByVal(prefillType);
    goWizardStep(1);
    document.getElementById('wizardBackdrop').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeWizard() {
    document.getElementById('wizardBackdrop').classList.remove('open');
    document.body.style.overflow = '';
    cpState.attachFiles = [];
}

function resetWizardFields() {
    ['wf-title','wf-budgetMin','wf-budgetMax','wf-landVal','wf-desc'].forEach(id => {
        var el = document.getElementById(id); if (el) el.value = '';
    });
    ['wf-landUnit','wf-style','wf-timeline'].forEach(id => {
        var el = document.getElementById(id); if (el) el.selectedIndex = 0;
    });
    ['wf-bedrooms','wf-bathrooms','wf-floors'].forEach(id => {
        var el = document.getElementById(id); if (el) el.value = '';
    });
    ['wf-garage','wf-pool','wf-garden'].forEach(id => {
        var el = document.getElementById(id); if (el) el.checked = false;
    });
    document.querySelectorAll('.type-btn').forEach(function(b) { b.classList.remove('active'); });
    cpState.projectType = '';
    document.getElementById('attachPreviewGrid').innerHTML = '';
    document.getElementById('wf-desc-count').textContent = '0';
    // Reset timeline date picker
    var tlDateWrap = document.getElementById('wf-timeline-date-wrap');
    var tlDateInput = document.getElementById('wf-timeline-date');
    var tlDateErr = document.getElementById('wf-timeline-date-error');
    if (tlDateWrap) tlDateWrap.style.display = 'none';
    if (tlDateInput) { tlDateInput.value = ''; tlDateInput.style.borderColor = ''; }
    if (tlDateErr) tlDateErr.style.display = 'none';
}
/* ── Timeline date picker ─────────────────────────────────────────────────── */
function handleTimelineChange(sel) {
    var wrap = document.getElementById('wf-timeline-date-wrap');
    var dateInput = document.getElementById('wf-timeline-date');
    var err = document.getElementById('wf-timeline-date-error');
    if (sel.value === 'pick-date') {
        var tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        dateInput.min = tomorrow.toISOString().split('T')[0];
        dateInput.value = '';
        wrap.style.display = '';
        err.style.display = 'none';
    } else {
        wrap.style.display = 'none';
        dateInput.value = '';
        err.style.display = 'none';
    }
}

function handleTimelineDateInput(input) {
    var err = document.getElementById('wf-timeline-date-error');
    var today = new Date(); today.setHours(0,0,0,0);
    var picked = new Date(input.value + 'T00:00:00');
    if (!input.value || picked <= today) {
        err.style.display = '';
        input.style.borderColor = '#f87171';
    } else {
        err.style.display = 'none';
        input.style.borderColor = '';
    }
}

function getTimelineValue() {
    var sel = document.getElementById('wf-timeline');
    if (sel.value === 'pick-date') {
        var dateInput = document.getElementById('wf-timeline-date');
        if (dateInput && dateInput.value) return 'date:' + dateInput.value;
        return 'pick-date';
    }
    return sel.value;
}

function getTimelineLabel(val) {
    if (!val) return 'Flexible';
    if (val.startsWith('date:')) {
        var d = new Date(val.slice(5) + 'T00:00:00');
        return 'By ' + d.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
    }
    return val.replace(/-/g, ' ');
}



/* ── Step navigation ──────────────────────────────────────────────────────── */
function goWizardStep(n) {
    [1,2,3,4].forEach(function(i) {
        var s = document.getElementById('wstep-' + i);
        if (s) s.style.display = (i === n) ? '' : 'none';
        var dot = document.getElementById('wdot-' + i);
        if (dot) {
            dot.classList.toggle('active',    i <= n);
            dot.classList.toggle('completed', i < n);
        }
        var line = document.getElementById('wline-' + i);
        if (line) line.classList.toggle('active', i < n);
    });
    var labels = ['Basic Info','Requirements','Attachments','Review & Submit'];
    document.getElementById('wizardStepLabel').textContent = 'Step ' + n + ' of 4 — ' + labels[n-1];
    document.getElementById('wizardBackBtn').style.display = n > 1 ? '' : 'none';
    var nextBtn = document.getElementById('wizardNextBtn');
    if (n === 4) {
        nextBtn.innerHTML = '<i class="fas fa-check"></i> Submit Project';
    } else {
        nextBtn.innerHTML = 'Next <i class="fas fa-arrow-right"></i>';
    }
    cpState.step = n;
    if (n === 4) buildReviewCard();
}

function wizardNext() {
    var s = cpState.step;
    if (s === 1) {
        if (!document.getElementById('wf-title').value.trim()) {
            showToast('Please enter a project title.', 'error'); return;
        }
        if (!cpState.projectType) {
            showToast('Please select a project type.', 'error'); return;
        }
        goWizardStep(2);
    } else if (s === 2) {
        // ── Required field & limit validation ────────────────────────────────
        var bMin = parseFloat(document.getElementById('wf-budgetMin').value);
        var bMax = parseFloat(document.getElementById('wf-budgetMax').value);
        var lVal = parseFloat(document.getElementById('wf-landVal').value);
        var tlVal = document.getElementById('wf-timeline').value;

        // Clear previous error highlights
        ['wf-budgetMin','wf-budgetMax','wf-landVal'].forEach(function(id) {
            document.getElementById(id).classList.remove('wizard-input-error');
        });

        // Min Budget required + limits (₹1L – ₹50Cr)
        if (!document.getElementById('wf-budgetMin').value) {
            document.getElementById('wf-budgetMin').classList.add('wizard-input-error');
            showToast('Please enter a minimum budget.', 'error'); return;
        }
        if (isNaN(bMin) || bMin < 100000) {
            document.getElementById('wf-budgetMin').classList.add('wizard-input-error');
            showToast('Minimum budget must be at least ₹1,00,000.', 'error'); return;
        }
        if (bMin > 500000000) {
            document.getElementById('wf-budgetMin').classList.add('wizard-input-error');
            showToast('Minimum budget cannot exceed ₹50 Crore.', 'error'); return;
        }

        // Max Budget required + limits
        if (!document.getElementById('wf-budgetMax').value) {
            document.getElementById('wf-budgetMax').classList.add('wizard-input-error');
            showToast('Please enter a maximum budget.', 'error'); return;
        }
        if (isNaN(bMax) || bMax < 100000) {
            document.getElementById('wf-budgetMax').classList.add('wizard-input-error');
            showToast('Maximum budget must be at least ₹1,00,000.', 'error'); return;
        }
        if (bMax > 500000000) {
            document.getElementById('wf-budgetMax').classList.add('wizard-input-error');
            showToast('Maximum budget cannot exceed ₹50 Crore.', 'error'); return;
        }
        if (bMax < bMin) {
            document.getElementById('wf-budgetMax').classList.add('wizard-input-error');
            showToast('Maximum budget must be greater than or equal to minimum budget.', 'error'); return;
        }

        // Land Size required + limits (1 – 1,00,000 of any unit)
        if (!document.getElementById('wf-landVal').value) {
            document.getElementById('wf-landVal').classList.add('wizard-input-error');
            showToast('Please enter the land size.', 'error'); return;
        }
        if (isNaN(lVal) || lVal < 1) {
            document.getElementById('wf-landVal').classList.add('wizard-input-error');
            showToast('Land size must be at least 1.', 'error'); return;
        }
        if (lVal > 100000) {
            document.getElementById('wf-landVal').classList.add('wizard-input-error');
            showToast('Land size cannot exceed 1,00,000 units.', 'error'); return;
        }

        // Timeline required — must not be left on the placeholder (flexible is valid, but pick-date needs a date)
        if (tlVal === 'pick-date') {
            var tlDateInput = document.getElementById('wf-timeline-date');
            var today = new Date(); today.setHours(0,0,0,0);
            var picked = tlDateInput.value ? new Date(tlDateInput.value + 'T00:00:00') : null;
            if (!picked || picked <= today) {
                document.getElementById('wf-timeline-date-error').style.display = '';
                tlDateInput.style.borderColor = '#f87171';
                showToast('Please select a future date for your timeline.', 'error');
                return;
            }
        }
        goWizardStep(3);
    } else if (s === 3) {
        goWizardStep(4);
    } else if (s === 4) {
        submitWizard();
    }
}

function wizardBack() {
    if (cpState.step > 1) goWizardStep(cpState.step - 1);
}

/* ── Step 1 helpers ───────────────────────────────────────────────────────── */
function selectType(btn) {
    document.querySelectorAll('.type-btn').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    cpState.projectType = btn.dataset.val;
}
function selectTypeByVal(val) {
    var btn = document.querySelector('.type-btn[data-val="' + val + '"]');
    if (btn) selectType(btn);
}

/* ── Step 3 — Attachments ─────────────────────────────────────────────────── */
function handleAttachSelect(files) {
    Array.from(files).forEach(function(f) { addAttachFile(f); });
    document.getElementById('attachFileInput').value = '';
}
function handleAttachDrop(e) {
    e.preventDefault();
    document.getElementById('attachDropZone').classList.remove('drag-over');
    Array.from(e.dataTransfer.files).forEach(function(f) { addAttachFile(f); });
}
function addAttachFile(file) {
    if (cpState.attachFiles.length >= 10) {
        showToast('Maximum 10 files allowed.', 'error'); return;
    }
    if (file.size > 10 * 1024 * 1024) {
        showToast(file.name + ' exceeds 10 MB limit.', 'error'); return;
    }
    cpState.attachFiles.push(file);
    renderAttachPreviews();
}
function removeAttachFile(idx) {
    cpState.attachFiles.splice(idx, 1);
    renderAttachPreviews();
}
function renderAttachPreviews() {
    var grid = document.getElementById('attachPreviewGrid');
    if (!cpState.attachFiles.length) { grid.innerHTML = ''; return; }
    grid.innerHTML = cpState.attachFiles.map(function(f, i) {
        var isImg = f.type.startsWith('image/');
        var icon  = isImg ? '' : '<i class="fas fa-file-alt" style="font-size:1.5rem;color:var(--violet)"></i>';
        var thumb = '';
        if (isImg) {
            // Use object URL for preview
            thumb = '<img src="' + URL.createObjectURL(f) + '" style="width:100%;height:100%;object-fit:cover;border-radius:7px">';
        }
        var kb = (f.size / 1024).toFixed(0);
        return '<div class="attach-thumb">' +
            (isImg ? thumb : '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:0.35rem">' + icon + '<span style="font-size:0.65rem;color:var(--slate);text-align:center;word-break:break-all;padding:0 4px">' + esc(f.name) + '</span></div>') +
            '<div class="attach-thumb-info">' + esc(f.name.length > 12 ? f.name.slice(0,12)+'…' : f.name) + ' · ' + kb + 'KB</div>' +
            '<button class="attach-thumb-remove" onclick="removeAttachFile(' + i + ')"><i class="fas fa-times"></i></button>' +
        '</div>';
    }).join('');
}

/* ── Step 4 — Review card ─────────────────────────────────────────────────── */
function buildReviewCard() {
    var title   = document.getElementById('wf-title').value.trim();
    var ptype   = cpState.projectType;
    var bMin    = document.getElementById('wf-budgetMin').value;
    var bMax    = document.getElementById('wf-budgetMax').value;
    var lVal    = document.getElementById('wf-landVal').value;
    var lUnit   = document.getElementById('wf-landUnit').value;
    var style   = document.getElementById('wf-style').value;
    var beds    = document.getElementById('wf-bedrooms').value;
    var baths   = document.getElementById('wf-bathrooms').value;
    var floors  = document.getElementById('wf-floors').value;
    var garage  = document.getElementById('wf-garage').checked;
    var pool    = document.getElementById('wf-pool').checked;
    var garden  = document.getElementById('wf-garden').checked;
    var timeline= getTimelineValue();
    var desc    = document.getElementById('wf-desc').value.trim();
    var files   = cpState.attachFiles.length;

    var budgetStr = (bMin || bMax)
        ? '₹' + (bMin ? Number(bMin).toLocaleString('en-IN') : '0') + ' – ₹' + (bMax ? Number(bMax).toLocaleString('en-IN') : '∞')
        : 'Not specified';
    var landStr = lVal ? lVal + ' ' + lUnit : 'Not specified';
    var extrasArr = [];
    if (garage) extrasArr.push('Garage');
    if (pool)   extrasArr.push('Pool');
    if (garden) extrasArr.push('Garden');

    document.getElementById('reviewCard').innerHTML =
        '<div class="review-row"><span class="review-lbl">Title</span><span class="review-val">' + esc(title) + '</span></div>' +
        '<div class="review-row"><span class="review-lbl">Type</span><span class="review-val" style="text-transform:capitalize">' + esc(ptype) + '</span></div>' +
        '<div class="review-row"><span class="review-lbl">Budget</span><span class="review-val">' + budgetStr + '</span></div>' +
        '<div class="review-row"><span class="review-lbl">Land Size</span><span class="review-val">' + landStr + '</span></div>' +
        (style ? '<div class="review-row"><span class="review-lbl">Style</span><span class="review-val" style="text-transform:capitalize">' + esc(style) + '</span></div>' : '') +
        ((beds||baths||floors) ? '<div class="review-row"><span class="review-lbl">Rooms</span><span class="review-val">' + [beds&&(beds+'BD'),baths&&(baths+'BA'),floors&&(floors+' fl')].filter(Boolean).join(' · ') + '</span></div>' : '') +
        (extrasArr.length ? '<div class="review-row"><span class="review-lbl">Extras</span><span class="review-val">' + extrasArr.join(', ') + '</span></div>' : '') +
        '<div class="review-row"><span class="review-lbl">Timeline</span><span class="review-val">' + esc(getTimelineLabel(timeline)) + '</span></div>' +
        (desc ? '<div class="review-row review-desc"><span class="review-lbl">Description</span><div class="review-val" style="margin-top:4px">' + esc(desc) + '</div></div>' : '') +
        '<div class="review-row"><span class="review-lbl">Attachments</span><span class="review-val">' + files + ' file' + (files!==1?'s':'') + '</span></div>';
}

/* ── Submit ───────────────────────────────────────────────────────────────── */
async function submitWizard() {
    var btn = document.getElementById('wizardNextBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
        var fd = new FormData();
        fd.append('title',       document.getElementById('wf-title').value.trim());
        fd.append('projectType', cpState.projectType);
        fd.append('style',       document.getElementById('wf-style').value);
        fd.append('timeline',    getTimelineValue());
        fd.append('description', document.getElementById('wf-desc').value.trim());
        fd.append('budget', JSON.stringify({
            min: parseFloat(document.getElementById('wf-budgetMin').value) || null,
            max: parseFloat(document.getElementById('wf-budgetMax').value) || null,
            currency: 'INR'
        }));
        fd.append('landSize', JSON.stringify({
            value: parseFloat(document.getElementById('wf-landVal').value) || null,
            unit:  document.getElementById('wf-landUnit').value
        }));
        fd.append('requirements', JSON.stringify({
            bedrooms:  parseInt(document.getElementById('wf-bedrooms').value)  || null,
            bathrooms: parseInt(document.getElementById('wf-bathrooms').value) || null,
            floors:    parseInt(document.getElementById('wf-floors').value)    || null,
            garage:    document.getElementById('wf-garage').checked,
            pool:      document.getElementById('wf-pool').checked,
            garden:    document.getElementById('wf-garden').checked
        }));
        cpState.attachFiles.forEach(function(f) { fd.append('attachments', f); });

        var token = getToken();
        var method = cpState.editingId ? 'PUT' : 'POST';
        var url    = CLIENT_API + '/client/projects' + (cpState.editingId ? '/' + cpState.editingId : '');
        var r = await fetch(url, { method: method, headers: { 'Authorization': 'Bearer ' + token }, body: fd });
        var d = await r.json();
        if (!d.success) throw new Error(d.message);

        closeWizard();
        showToast(cpState.editingId ? 'Project updated!' : 'Project created!', 'success');
        loadClientProjects();
    } catch(err) {
        showToast(err.message || 'Could not save project.', 'error');
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-check"></i> Submit Project';
    }
}

/* ── Load & render projects ───────────────────────────────────────────────── */
async function loadClientProjects() {
    var grid = document.getElementById('clientProjectsGrid');
    if (!grid) return;
    grid.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--slate)"><i class="fas fa-spinner fa-spin" style="font-size:1.5rem"></i><div style="margin-top:1rem">Loading...</div></div>';
    try {
        var r = await fetch(CLIENT_API + '/client/projects', { headers: authHeaders() });
        var d = await r.json();
        if (!d.success) throw new Error();
        renderClientProjects(d.data);
    } catch(e) {
        grid.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--rose)"><i class="fas fa-exclamation-circle" style="font-size:1.5rem"></i><div style="margin-top:1rem">Could not load projects.</div></div>';
    }
}

var PROJECT_TYPE_ICONS = {
    residential:'fa-home', commercial:'fa-building', interior:'fa-couch',
    renovation:'fa-tools', landscape:'fa-tree', industrial:'fa-industry', other:'fa-project-diagram'
};
var STATUS_CONFIG = {
    active:      { label:'Active',      cls:'status-active' },
    draft:       { label:'Draft',       cls:'status-draft' },
    in_progress: { label:'In Progress', cls:'status-inprog' },
    completed:   { label:'Completed',   cls:'status-done' },
    cancelled:   { label:'Cancelled',   cls:'status-cancelled' }
};

// Returns a status pill showing the architect's project progress for the card
function _archProjectStatusBadge(status, architectName) {
    var cfg = {
        draft:       { label: 'Draft',       icon: 'fa-pencil-alt',    color: '#64748b', bg: 'rgba(100,116,139,0.15)',  border: 'rgba(100,116,139,0.3)'  },
        in_progress: { label: 'In Progress', icon: 'fa-tools',         color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.3)'  },
        review:      { label: 'In Review',   icon: 'fa-search',        color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.3)'  },
        approved:    { label: 'Completed',   icon: 'fa-check-circle',  color: '#10b981', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.3)'  },
    };
    var s   = cfg[status] || { label: 'Working', icon: 'fa-drafting-compass', color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.3)' };
    var tip = architectName ? 'Architect: ' + architectName : 'Architect assigned';
    return '<div title="' + tip + '" style="display:inline-flex;align-items:center;gap:0.35rem;' +
        'padding:0.3rem 0.65rem;border-radius:7px;border:1px solid ' + s.border + ';' +
        'background:' + s.bg + ';color:' + s.color + ';font-size:0.72rem;font-weight:700;white-space:nowrap;cursor:default;">' +
        '<i class="fas ' + s.icon + '" style="font-size:0.65rem;"></i>' +
        s.label +
    '</div>';
}

function renderClientProjects(projects) {
    window._cachedClientProjects = projects; // cache for detail modal use
    _updateTabBadges(projects);
    switchProjectTab(_activeProjectTab);
}
function _renderClientProjectsOriginal(projects) {
    var grid = document.getElementById('clientProjectsGrid');
    if (!projects.length) {
        grid.innerHTML =
            '<div style="text-align:center;padding:4rem 2rem">' +
                '<div style="font-size:2.5rem;color:rgba(139,92,246,0.3);margin-bottom:1rem"><i class="fas fa-folder-open"></i></div>' +
                '<div style="font-size:1.15rem;font-weight:700;color:var(--white);margin-bottom:0.5rem">No projects yet</div>' +
                '<div style="font-size:0.875rem;color:var(--slate);margin-bottom:1.5rem">Create your first project brief and find the perfect architect.</div>' +
                '<button class="btn-primary" onclick="openCreateProject()" style="padding:0.7rem 1.5rem;border-radius:10px;font-weight:700;border:none;cursor:pointer;display:inline-flex;align-items:center;gap:0.5rem"><i class="fas fa-plus"></i> Create Project</button>' +
            '</div>';
        return;
    }
    grid.innerHTML = '<div class="cp-grid">' + projects.map(function(p) {
        var iconCls = PROJECT_TYPE_ICONS[p.projectType] || 'fa-project-diagram';
        var sc      = STATUS_CONFIG[p.status] || { label: p.status, cls: 'status-draft' };
        var bStr = '';
        if (p.budget && (p.budget.min || p.budget.max)) {
            var fmt = function(n) { return n >= 100000 ? '₹' + (n/100000).toFixed(1) + 'L' : '₹' + n.toLocaleString('en-IN'); };
            bStr = (p.budget.min ? fmt(p.budget.min) : '') + (p.budget.min && p.budget.max ? ' – ' : '') + (p.budget.max ? fmt(p.budget.max) : '');
        }
        var lStr = (p.landSize && p.landSize.value) ? p.landSize.value + ' ' + p.landSize.value + ' ' + p.landSize.unit : '';
        if (p.landSize && p.landSize.value) lStr = p.landSize.value + ' ' + p.landSize.unit;
        var attCount = (p.attachments || []).length;
        var date = new Date(p.createdAt).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
        return '<div class="cp-card">' +
            '<div class="cp-card-top">' +
                '<div class="cp-type-icon"><i class="fas ' + iconCls + '"></i></div>' +
                '<div class="cp-card-info">' +
                    '<div class="cp-title">' + esc(p.title) + '</div>' +
                    '<div class="cp-type-tag">' + esc(p.projectType) + '</div>' +
                '</div>' +
                '<span class="cp-status ' + sc.cls + '">' + sc.label + '</span>' +
            '</div>' +
            '<div class="cp-meta-row">' +
                (bStr ? '<div class="cp-meta-item"><i class="fas fa-rupee-sign"></i>' + esc(bStr) + '</div>' : '') +
                (lStr ? '<div class="cp-meta-item"><i class="fas fa-expand-arrows-alt"></i>' + esc(lStr) + '</div>' : '') +
                (p.style ? '<div class="cp-meta-item"><i class="fas fa-paint-brush"></i>' + esc(p.style) + '</div>' : '') +
                (attCount ? '<div class="cp-meta-item"><i class="fas fa-paperclip"></i>' + attCount + ' file' + (attCount>1?'s':'') + '</div>' : '') +
            '</div>' +
            (p.description ? '<div class="cp-desc">' + esc(p.description) + '</div>' : '') +
            '<div class="cp-date">Created ' + date + '</div>' +
            '<div class="cp-actions">' +
                '<button class="cp-btn cp-btn-view"    onclick="viewClientProject(\'' + p._id + '\')"><i class="fas fa-eye"></i> View</button>' +
                '<button class="cp-btn cp-btn-edit"    onclick="editClientProject(\'' + p._id + '\')"><i class="fas fa-edit"></i> Edit</button>' +
                (p.hasAcceptedConnection
                    ? _archProjectStatusBadge(p.architectProjectStatus, p.architectName)
                    : '<button class="cp-btn cp-btn-connect" onclick="connectFromProject(\'' + p._id + '\',\'' + esc(p.title) + '\')"><i class="fas fa-user-plus"></i> Find Architect</button>') +
                '<button class="cp-btn cp-btn-delete"  onclick="deleteClientProject(\'' + p._id + '\')"><i class="fas fa-trash"></i></button>' +
            '</div>' +
        '</div>';
    }).join('') + '</div>';
}

/* ── Project Tabs ──────────────────────────────────────────────────────────── */
var _activeProjectTab = 'all';

function switchProjectTab(tab) {
    _activeProjectTab = tab;
    ['all','inprogress','completed','notconnected','history'].forEach(function(t) {
        var btn = document.getElementById('cpTab-' + t);
        if (btn) btn.classList.toggle('active', t === tab);
    });
    var projects = window._cachedClientProjects || [];
    if (tab === 'history') { renderProjectHistory(projects); }
    else { renderFilteredProjects(projects, tab); }
}

function _updateTabBadges(projects) {
    var counts = {
        all:          projects.length,
        inprogress:   projects.filter(function(p){ return p.hasAcceptedConnection && p.architectProjectStatus !== 'approved'; }).length,
        completed:    projects.filter(function(p){ return p.hasAcceptedConnection && p.architectProjectStatus === 'approved'; }).length,
        notconnected: projects.filter(function(p){ return !p.hasAcceptedConnection; }).length
    };
    Object.keys(counts).forEach(function(key) {
        var badge = document.getElementById('cpBadge-' + key);
        if (badge) badge.textContent = counts[key];
    });
}

function renderFilteredProjects(projects, tab) {
    var grid = document.getElementById('clientProjectsGrid');
    if (!grid) return;
    if (!projects.length) {
        var msgs = {
            all:          { icon: 'fa-folder-open', title: 'No projects yet',            sub: 'Create your first project brief and find the perfect architect.' },
            inprogress:   { icon: 'fa-tools',        title: 'No active projects',         sub: 'Projects that are active or in progress will appear here.' },
            completed:    { icon: 'fa-check-circle', title: 'No completed projects yet',  sub: 'Projects you have marked as complete will appear here.' },
            notconnected: { icon: 'fa-user-slash',   title: 'All projects are connected', sub: 'Projects without an assigned architect will appear here.' }
        };
        var m = msgs[tab] || msgs.all;
        grid.innerHTML = '<div class="cp-tab-empty">' +
            '<div><i class="fas ' + m.icon + '"></i></div>' +
            '<div class="cp-tab-empty-title">' + m.title + '</div>' +
            '<div class="cp-tab-empty-sub">' + m.sub + '</div>' +
            (tab === 'all' || tab === 'notconnected'
                ? '<br><button class="btn-primary" onclick="openCreateProject()" style="padding:0.7rem 1.5rem;border-radius:10px;font-weight:700;border:none;cursor:pointer;display:inline-flex;align-items:center;gap:0.5rem"><i class="fas fa-plus"></i> Create Project</button>'
                : '') +
        '</div>';
        return;
    }
   var filtered = tab === 'all'          ? projects
                 : tab === 'inprogress'   ? projects.filter(function(p){
                       return p.hasAcceptedConnection && p.architectProjectStatus !== 'approved';
                   })
                 : tab === 'completed'    ? projects.filter(function(p){
                       return p.hasAcceptedConnection && p.architectProjectStatus === 'approved';
                   })
                 : tab === 'notconnected' ? projects.filter(function(p){ return !p.hasAcceptedConnection; })
                 : projects;
    grid.innerHTML = '<div class="cp-grid">' + filtered.map(function(p) {
        var iconCls = PROJECT_TYPE_ICONS[p.projectType] || 'fa-project-diagram';
        var sc      = STATUS_CONFIG[p.status] || { label: p.status, cls: 'status-draft' };
        var bStr = '';
        if (p.budget && (p.budget.min || p.budget.max)) {
            var fmt = function(n) { return n >= 100000 ? '₹' + (n/100000).toFixed(1) + 'L' : '₹' + n.toLocaleString('en-IN'); };
            bStr = (p.budget.min ? fmt(p.budget.min) : '') + (p.budget.min && p.budget.max ? ' – ' : '') + (p.budget.max ? fmt(p.budget.max) : '');
        }
        var lStr = (p.landSize && p.landSize.value) ? p.landSize.value + ' ' + p.landSize.unit : '';
        var attCount = (p.attachments || []).length;
        var date = new Date(p.createdAt).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
        return '<div class="cp-card">' +
            '<div class="cp-card-top">' +
                '<div class="cp-type-icon"><i class="fas ' + iconCls + '"></i></div>' +
                '<div class="cp-card-info">' +
                    '<div class="cp-title">' + esc(p.title) + '</div>' +
                    '<div class="cp-type-tag">' + esc(p.projectType) + '</div>' +
                '</div>' +
                '<span class="cp-status ' + sc.cls + '">' + sc.label + '</span>' +
            '</div>' +
            '<div class="cp-meta-row">' +
                (bStr ? '<div class="cp-meta-item"><i class="fas fa-rupee-sign"></i>' + esc(bStr) + '</div>' : '') +
                (lStr ? '<div class="cp-meta-item"><i class="fas fa-expand-arrows-alt"></i>' + esc(lStr) + '</div>' : '') +
                (p.style ? '<div class="cp-meta-item"><i class="fas fa-paint-brush"></i>' + esc(p.style) + '</div>' : '') +
                (attCount ? '<div class="cp-meta-item"><i class="fas fa-paperclip"></i>' + attCount + ' file' + (attCount > 1 ? 's' : '') + '</div>' : '') +
            '</div>' +
            (p.description ? '<div class="cp-desc">' + esc(p.description) + '</div>' : '') +
            '<div class="cp-date">Created ' + date + '</div>' +
           (p.hasAcceptedConnection && p.architectProjectStatus === 'approved' && p.updatedAt
                ? '<div class="cp-completed-date"><i class="fas fa-check-circle"></i> Completed ' + new Date(p.updatedAt).toLocaleString('en-IN', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) + '</div>'
                : '') +
            (p.hasAcceptedConnection && p.architectName
                ? '<div class="cp-architect-name"><i class="fas fa-user-tie"></i> ' + esc(p.architectName) + '</div>'
                : '') +
            '<div class="cp-actions">' +
                '<button class="cp-btn cp-btn-view"   onclick="viewClientProject(\'' + p._id + '\')"><i class="fas fa-eye"></i> View</button>' +
                (p.hasAcceptedConnection && p.architectProjectStatus === 'approved'
                    ? ''
                    : '<button class="cp-btn cp-btn-edit"   onclick="editClientProject(\'' + p._id + '\')"><i class="fas fa-edit"></i> Edit</button>') +
                (p.hasAcceptedConnection
                    ? _archProjectStatusBadge(p.architectProjectStatus, p.architectName)
                    : '<button class="cp-btn cp-btn-connect" onclick="connectFromProject(\'' + p._id + '\',\'' + esc(p.title) + '\')"><i class="fas fa-user-plus"></i> Find Architect</button>') +
                '<button class="cp-btn cp-btn-delete" onclick="deleteClientProject(\'' + p._id + '\')"><i class="fas fa-trash"></i></button>' +
            '</div>' +
        '</div>';
    }).join('') + '</div>';
}

function renderProjectHistory(projects) {
    var grid = document.getElementById('clientProjectsGrid');
    if (!grid) return;
    if (!projects.length) {
        grid.innerHTML = '<div class="cp-tab-empty">' +
            '<div><i class="fas fa-history"></i></div>' +
            '<div class="cp-tab-empty-title">No project history</div>' +
            '<div class="cp-tab-empty-sub">Your project activity will appear here once you create projects.</div>' +
        '</div>';
        return;
    }
    var sorted = projects.slice().sort(function(a, b) {
        return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
    });
    var statusIcons = {
        active:      { icon: 'fa-play-circle',  color: '#10b981' },
        draft:       { icon: 'fa-pencil-alt',   color: '#94a3b8' },
        in_progress: { icon: 'fa-tools',        color: '#3b82f6' },
        completed:   { icon: 'fa-check-circle', color: '#8b5cf6' },
        cancelled:   { icon: 'fa-times-circle', color: '#f43f5e' }
    };
    grid.innerHTML = '<div class="cp-history-list">' +
        sorted.map(function(p) {
            var sc          = STATUS_CONFIG[p.status] || { label: p.status, cls: 'status-draft' };
            var si          = statusIcons[p.status]   || { icon: 'fa-circle', color: '#94a3b8' };
            var iconCls     = PROJECT_TYPE_ICONS[p.projectType] || 'fa-project-diagram';
            var createdDate = new Date(p.createdAt).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
            var updatedDate = new Date(p.updatedAt || p.createdAt).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
            var bStr = '';
            if (p.budget && (p.budget.min || p.budget.max)) {
                var fmt = function(n) { return n >= 100000 ? '₹' + (n/100000).toFixed(1) + 'L' : '₹' + n.toLocaleString('en-IN'); };
                bStr = (p.budget.min ? fmt(p.budget.min) : '') + (p.budget.min && p.budget.max ? ' – ' : '') + (p.budget.max ? fmt(p.budget.max) : '');
            }
            return '<div class="cp-history-item">' +
                '<div class="cp-history-icon" style="color:' + si.color + ';border-color:' + si.color + '33;background:' + si.color + '15;">' +
                    '<i class="fas ' + iconCls + '"></i>' +
                '</div>' +
                '<div class="cp-history-body">' +
                    '<div class="cp-history-title">' + esc(p.title) + '</div>' +
                    '<div class="cp-history-meta">' +
                        '<span class="cp-status ' + sc.cls + '" style="font-size:0.62rem">' + sc.label + '</span>' +
                        '<span style="text-transform:capitalize;font-size:0.73rem">' + esc(p.projectType) + '</span>' +
                        (bStr ? '<span style="font-size:0.73rem">' + esc(bStr) + '</span>' : '') +
                         (p.hasAcceptedConnection
                            ? '<span style="color:#10b981;font-size:0.73rem"><i class="fas fa-user-tie"></i> ' + esc(p.architectName || 'Architect assigned') + '</span>'
                            : '<span style="color:#94a3b8;font-size:0.73rem"><i class="fas fa-user-slash"></i> No architect</span>') +
                        (p.hasAcceptedConnection && p.architectProjectStatus === 'approved' && p.updatedAt
                            ? '<span style="color:#8b5cf6;font-size:0.73rem"><i class="fas fa-check-circle"></i> Completed ' + new Date(p.updatedAt).toLocaleString('en-IN', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) + '</span>'
                            : '') +
                        '<span class="cp-history-date">Created ' + createdDate + (updatedDate !== createdDate ? ' · Updated ' + updatedDate : '') + '</span>' +
                    '</div>' +
                '</div>' +
                '<div style="display:flex;gap:0.4rem;flex-shrink:0;align-items:flex-start">' +
                    '<button class="cp-btn cp-btn-view" onclick="viewClientProject(\'' + p._id + '\')" style="font-size:0.7rem;padding:4px 9px"><i class="fas fa-eye"></i></button>' +
                    // '<button class="cp-btn cp-btn-edit" onclick="editClientProject(\'' + p._id + '\')" style="font-size:0.7rem;padding:4px 9px"><i class="fas fa-edit"></i></button>' +
                '</div>' +
            '</div>';
        }).join('') +
    '</div>';
}
/* ── Project actions ─────────────────────────────────────────────────────── */
async function viewClientProject(id) {
    document.getElementById('pdBody').innerHTML = '<div style="text-align:center;padding:2rem;color:var(--slate)"><i class="fas fa-spinner fa-spin"></i></div>';
    document.getElementById('projDetailBackdrop').classList.add('open');
    document.body.style.overflow = 'hidden';
    try {
        var r = await fetch(CLIENT_API + '/client/projects/' + id, { headers: authHeaders() });
        var d = await r.json();
        if (!d.success) throw new Error();
        renderProjectDetail(d.data);
    } catch(e) {
        document.getElementById('pdBody').innerHTML = '<div style="padding:2rem;color:var(--rose)">Could not load project.</div>';
    }
}

function renderProjectDetail(p) {
    var sc = STATUS_CONFIG[p.status] || { label: p.status, cls: 'status-draft' };
    document.getElementById('pdTitle').textContent = p.title;
    document.getElementById('pdMeta').innerHTML =
        '<span style="text-transform:capitalize">' + esc(p.projectType) + '</span>' +
        ' · <span class="cp-status ' + sc.cls + '" style="font-size:0.68rem">' + sc.label + '</span>';

    var r   = p.requirements || {};
    var bStr = '';
    if (p.budget && (p.budget.min || p.budget.max)) {
        var fmt = function(n) { return '₹' + Number(n).toLocaleString('en-IN'); };
        bStr = (p.budget.min ? fmt(p.budget.min) : '0') + ' – ' + (p.budget.max ? fmt(p.budget.max) : '∞');
    }
    var lStr = (p.landSize && p.landSize.value) ? p.landSize.value + ' ' + p.landSize.unit : '';

    var rows = [
        ['Budget',      bStr || '—'],
        ['Land Size',   lStr || '—'],
        ['Style',       p.style || '—'],
        ['Timeline',    getTimelineLabel(p.timeline || 'flexible')],
        ['Bedrooms',    r.bedrooms  || '—'],
        ['Bathrooms',   r.bathrooms || '—'],
        ['Floors',      r.floors    || '—'],
        ['Extras',      [r.garage&&'Garage', r.pool&&'Pool', r.garden&&'Garden'].filter(Boolean).join(', ') || 'None'],
    ];
    var detailHtml = '<div class="pd-grid">' +
        rows.map(function(row) {
            return '<div class="review-row"><span class="review-lbl">' + row[0] + '</span><span class="review-val" style="text-transform:capitalize">' + esc(String(row[1])) + '</span></div>';
        }).join('') + '</div>';

    if (p.description) {
        detailHtml += '<div style="margin:1rem 0"><div style="font-size:0.78rem;font-weight:700;color:var(--slate);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:0.5rem">Description</div><div style="font-size:0.875rem;color:var(--white);line-height:1.6">' + esc(p.description) + '</div></div>';
    }

    // Attachments
    if (p.attachments && p.attachments.length) {
        detailHtml += '<div style="margin-top:1rem"><div style="font-size:0.78rem;font-weight:700;color:var(--slate);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:0.75rem">Attachments</div>' +
            '<div style="display:flex;flex-wrap:wrap;gap:0.5rem">' +
            p.attachments.map(function(a) {
                var isImg = a.mimetype && a.mimetype.startsWith('image/');
                var href  = 'http://localhost:5000' + a.url;
                if (isImg) {
                    return '<a href="' + href + '" target="_blank" style="display:block;width:80px;height:80px;border-radius:8px;overflow:hidden;border:1px solid var(--border)">' +
                        '<img src="' + href + '" style="width:100%;height:100%;object-fit:cover" loading="lazy">' + '</a>';
                }
                return '<a href="' + href + '" target="_blank" class="cp-btn cp-btn-view" style="text-decoration:none;display:inline-flex;align-items:center;gap:0.35rem;font-size:0.75rem">' +
                    '<i class="fas fa-file-alt"></i>' + esc(a.originalName) + '</a>';
            }).join('') + '</div></div>';
    }

    // Check if already connected using the cached list
    var cached = (window._cachedClientProjects || []).find(function(cp) { return String(cp._id) === String(p._id); });
    var isConnected = cached ? cached.hasAcceptedConnection : false;
    var archStatus  = cached ? cached.architectProjectStatus : null;
    var archName    = cached ? cached.architectName : null;

    detailHtml += '<div style="display:flex;gap:0.75rem;margin-top:1.5rem;flex-wrap:wrap;align-items:center">' +
        (isConnected
            ? '<div style="flex:1;min-width:140px;display:flex;align-items:center;gap:0.5rem;">' +
                '<i class="fas fa-check-circle" style="color:#10b981;font-size:0.85rem;"></i>' +
                '<span style="font-size:0.82rem;color:#94a3b8;">Architect assigned</span>' +
                _archProjectStatusBadge(archStatus, archName) +
              '</div>'
            : '<button class="connect-send-btn" style="flex:1;min-width:140px;justify-content:center" onclick="closeProjDetail();connectFromProject(\'' + p._id + '\',\'' + esc(p.title) + '\')">' +
                '<i class="fas fa-user-plus"></i> Find Architect</button>') +
        '<button class="connect-cancel-btn" onclick="closeProjDetail();editClientProject(\'' + p._id + '\')">' +
            '<i class="fas fa-edit"></i> Edit</button>' +
    '</div>';

    document.getElementById('pdBody').innerHTML = detailHtml;
}

function closeProjDetail(e) {
    if (e && e.target !== document.getElementById('projDetailBackdrop')) return;
    document.getElementById('projDetailBackdrop').classList.remove('open');
    document.body.style.overflow = '';
}

async function editClientProject(id) {
    try {
        var r = await fetch(CLIENT_API + '/client/projects/' + id, { headers: authHeaders() });
        var d = await r.json();
        if (!d.success) throw new Error();
        var p = d.data;
        cpState = { step: 1, projectType: p.projectType, attachFiles: [], editingId: id };
        resetWizardFields();
        document.getElementById('wf-title').value       = p.title || '';
        document.getElementById('wf-style').value       = p.style || '';
        var tlVal = p.timeline || 'flexible';
        if (tlVal.startsWith('date:')) {
            document.getElementById('wf-timeline').value = 'pick-date';
            var tlDateInput = document.getElementById('wf-timeline-date');
            var tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
            tlDateInput.min = tomorrow.toISOString().split('T')[0];
            tlDateInput.value = tlVal.slice(5);
            document.getElementById('wf-timeline-date-wrap').style.display = '';
        } else {
            document.getElementById('wf-timeline').value = tlVal;
            document.getElementById('wf-timeline-date-wrap').style.display = 'none';
        }
        document.getElementById('wf-desc').value        = p.description || '';
        document.getElementById('wf-desc-count').textContent = (p.description||'').length;
        if (p.budget) {
            if (p.budget.min) document.getElementById('wf-budgetMin').value = p.budget.min;
            if (p.budget.max) document.getElementById('wf-budgetMax').value = p.budget.max;
        }
        if (p.landSize) {
            if (p.landSize.value) document.getElementById('wf-landVal').value  = p.landSize.value;
            if (p.landSize.unit)  document.getElementById('wf-landUnit').value = p.landSize.unit;
        }
        var req = p.requirements || {};
        if (req.bedrooms)  document.getElementById('wf-bedrooms').value  = req.bedrooms;
        if (req.bathrooms) document.getElementById('wf-bathrooms').value = req.bathrooms;
        if (req.floors)    document.getElementById('wf-floors').value    = req.floors;
        if (req.garage)    document.getElementById('wf-garage').checked  = true;
        if (req.pool)      document.getElementById('wf-pool').checked    = true;
        if (req.garden)    document.getElementById('wf-garden').checked  = true;
        selectTypeByVal(p.projectType);
        document.getElementById('wizardTitle').textContent   = 'Edit Project';
        document.getElementById('wizardNextBtn').innerHTML   = 'Next <i class="fas fa-arrow-right"></i>';
        goWizardStep(1);
        document.getElementById('wizardBackdrop').classList.add('open');
        document.body.style.overflow = 'hidden';
    } catch(e) {
        showToast('Could not load project for editing.', 'error');
    }
}

async function deleteClientProject(id) {
    if (!confirm('Delete this project? This cannot be undone.')) return;
    try {
        var r = await fetch(CLIENT_API + '/client/projects/' + id, {
            method: 'DELETE', headers: authHeaders()
        });
        var d = await r.json();
        if (!d.success) throw new Error(d.message);
        showToast('Project deleted.', 'success');
        loadClientProjects();
    } catch(e) {
        showToast(e.message || 'Delete failed.', 'error');
    }
}

/* ── Connect from project card ────────────────────────────────────────────── */
function connectFromProject(projectId, projectTitle) {
    // Pre-select this project in the connect modal and switch to architects view
    cpState._pendingConnectProjectId    = projectId;
    cpState._pendingConnectProjectTitle = projectTitle;
    showView('architects');
    showToast('Now pick an architect to connect — your project is pre-selected.', 'info');
}

/* ── Patch openConnectModal to honour pre-selected project ───────────────── */
var _origOpenConnectModal = openConnectModal;
openConnectModal = async function(archId, archName, archSpec, archAvatar) {
    // If a project was pre-selected from the projects view, auto-select it
    if (cpState._pendingConnectProjectId) {
        connectState.architectId            = archId;
        connectState.architectName          = archName;
        connectState.selectedProjectId      = cpState._pendingConnectProjectId;
        var pendingTitle                    = cpState._pendingConnectProjectTitle;
        cpState._pendingConnectProjectId    = null;
        cpState._pendingConnectProjectTitle = null;
        // Call original but patch project list after it opens
        await _origOpenConnectModal(archId, archName, archSpec, archAvatar);
        // Pre-tick the matching radio button
        var radios = document.querySelectorAll('input[name="connectProject"]');
        radios.forEach(function(radio) {
            if (radio.value === connectState.selectedProjectId) {
                radio.checked = true;
                selectConnectProject(radio.value);
            }
        });
    } else {
        await _origOpenConnectModal(archId, archName, archSpec, archAvatar);
    }
};

/* ============================================================
   CLIENT SETTINGS
   ============================================================ */

// ── Panel / Tab switchers ─────────────────────────────────────────────────────
function switchClientSettingsPanel(name, btn) {
    document.querySelectorAll('#view-settings .settings-nav-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('#view-settings .settings-panel').forEach(p => p.classList.remove('active'));
    if (btn) btn.classList.add('active');
    var panel = document.getElementById('cs-panel-' + name);
    if (panel) panel.classList.add('active');
}

function switchClientProfileTab(name, btn) {
    document.querySelectorAll('#cs-panel-profile .profile-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('#cs-panel-profile .profile-content').forEach(p => p.classList.remove('active'));
    if (btn) btn.classList.add('active');
    var tab = document.getElementById('cs-tab-' + name);
    if (tab) tab.classList.add('active');
}

// ── Load settings (called every time view is opened) ──────────────────────────
var _csUserCache = null;

async function loadClientSettings() {
    var token = requireClientAuth();
    if (!token) return;
    try {
        var resp = await fetch(CLIENT_API + '/client/me', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        var data = await resp.json();
        if (!data.user) return;
        _csUserCache = data.user;
        localStorage.setItem('client_user', JSON.stringify(data.user));
        _csPopulateOverview(data.user);
        _csPopulateEditForm(data.user);
        _csPopulatePreferences(data.user);
    } catch (e) {
        console.error('loadClientSettings error', e);
        // Fall back to cached user
        var cached = localStorage.getItem('client_user');
        if (cached) {
            var u = JSON.parse(cached);
            _csUserCache = u;
            _csPopulateOverview(u);
            _csPopulateEditForm(u);
            _csPopulatePreferences(u);
        }
    }
}

function _csPopulateOverview(u) {
    var avatarUrl = u.avatar ||
        'https://ui-avatars.com/api/?name=' + encodeURIComponent(u.name || 'C') + '&background=8b5cf6&color=fff&bold=true';

    var el = function(id) { return document.getElementById(id); };
    var img = el('cs-overviewAvatar');
    if (img) img.src = avatarUrl;
    if (el('cs-overviewName'))    el('cs-overviewName').textContent    = u.name    || '—';
    if (el('cs-overviewEmail'))   el('cs-overviewEmail').textContent   = u.email   || '—';
    if (el('cs-overviewPhone'))   el('cs-overviewPhone').textContent   = u.phone   || '—';
    if (el('cs-overviewCompany')) el('cs-overviewCompany').textContent = u.company || '—';
    if (el('cs-overviewLocation'))el('cs-overviewLocation').textContent= u.location|| '—';
    if (el('cs-overviewBio'))     el('cs-overviewBio').textContent     = u.bio     || '—';
    if (el('cs-overviewSince')) {
        var d = u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }) : '—';
        el('cs-overviewSince').textContent = d;
    }
}

function _csPopulateEditForm(u) {
    var el = function(id) { return document.getElementById(id); };
    var avatarUrl = u.avatar ||
        'https://ui-avatars.com/api/?name=' + encodeURIComponent(u.name || 'C') + '&background=8b5cf6&color=fff&bold=true';
    var img = el('cs-editAvatar');
    if (img) img.src = avatarUrl;
    if (el('cs-editName'))     el('cs-editName').value     = u.name     || '';
    if (el('cs-editEmail'))    el('cs-editEmail').value    = u.email    || '';
    if (el('cs-editCompany'))  el('cs-editCompany').value  = u.company  || '';
    if (el('cs-editPhone'))    el('cs-editPhone').value    = u.phone    || '';
    if (el('cs-editLocation')) el('cs-editLocation').value = u.location || '';
    if (el('cs-editBio'))      el('cs-editBio').value      = u.bio      || '';
}

function _csPopulatePreferences(u) {
    var prefs = u.preferences || {};
    var stored = {};
    try { stored = JSON.parse(localStorage.getItem('cs_prefs') || '{}'); } catch(e) {}
    var merged = Object.assign({}, prefs, stored);

    var emailNotif = document.getElementById('cs-emailNotif');
    var connAlerts = document.getElementById('cs-connAlerts');
    var currency   = document.getElementById('cs-currency');
    if (emailNotif) emailNotif.checked = merged.emailNotif !== false;
    if (connAlerts) connAlerts.checked = merged.connAlerts !== false;
    if (currency && merged.currency)   currency.value = merged.currency;
}

// ── Save profile ──────────────────────────────────────────────────────────────
async function saveClientProfile(event) {
    if (event) event.preventDefault();
    var token = requireClientAuth();
    if (!token) return;

    var btn = document.getElementById('csEpSaveBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…'; }

    var el = function(id) { return document.getElementById(id); };

    var body = {
        name:     (el('cs-editName')     ? el('cs-editName').value.trim()     : ''),
        company:  (el('cs-editCompany')  ? el('cs-editCompany').value.trim()  : ''),
        phone:    (el('cs-editPhone')    ? el('cs-editPhone').value.trim()    : ''),
        location: (el('cs-editLocation') ? el('cs-editLocation').value.trim() : ''),
        bio:      (el('cs-editBio')      ? el('cs-editBio').value.trim()      : '')
    };

    // Include avatar if it was changed (stored as base64 on the img src)
    var avatarImg = el('cs-editAvatar');
    if (avatarImg && avatarImg.src && avatarImg.src.startsWith('data:')) {
        body.avatar = avatarImg.src;
    } else if (avatarImg && avatarImg.dataset.removed === 'true') {
        body.avatar = '';
    }

    try {
        var resp = await fetch(CLIENT_API + '/client/profile', {
            method:  'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body:    JSON.stringify(body)
        });
        var data = await resp.json();
        if (!resp.ok || !data.success) throw new Error(data.message || 'Update failed');

        // Persist updated user
        var updated = data.user || Object.assign(_csUserCache || {}, body);
        localStorage.setItem('client_user', JSON.stringify(updated));
        _csUserCache = updated;

        // Refresh overview + sidebar
        _csPopulateOverview(updated);
        loadUser();

        showToast('Profile updated successfully!', 'success');
        // Switch back to overview tab
        var overviewBtn = document.querySelector('#cs-panel-profile .profile-tab');
        switchClientProfileTab('overview', overviewBtn);

    } catch (e) {
        showToast(e.message || 'Could not save profile.', 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check"></i> Save Changes'; }
    }
}

function discardClientProfileChanges() {
    if (_csUserCache) {
        _csPopulateEditForm(_csUserCache);
    }
    var overviewBtn = document.querySelector('#cs-panel-profile .profile-tab');
    switchClientProfileTab('overview', overviewBtn);
    showToast('Changes discarded.', 'info');
}

// ── Avatar upload / remove ────────────────────────────────────────────────────
function handleClientAvatarUpload(event) {
    var file = event.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast('Image must be under 5 MB.', 'error'); return; }
    var reader = new FileReader();
    reader.onload = function(e) {
        var img = document.getElementById('cs-editAvatar');
        if (img) {
            img.src = e.target.result;
            img.dataset.removed = 'false';
        }
        // Also update overview avatar live
        var ov = document.getElementById('cs-overviewAvatar');
        if (ov) ov.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function removeClientAvatar() {
    var fallback = 'https://ui-avatars.com/api/?name=' +
        encodeURIComponent((_csUserCache && _csUserCache.name) || 'C') +
        '&background=8b5cf6&color=fff&bold=true';
    var img = document.getElementById('cs-editAvatar');
    if (img) { img.src = fallback; img.dataset.removed = 'true'; }
    var ov = document.getElementById('cs-overviewAvatar');
    if (ov) ov.src = fallback;
}

// ── Change password ───────────────────────────────────────────────────────────
async function updateClientPassword(event) {
    if (event) event.preventDefault();
    var token = requireClientAuth();
    if (!token) return;

    var cur  = document.getElementById('cs-currentPw');
    var nw   = document.getElementById('cs-newPw');
    var conf = document.getElementById('cs-confirmPw');

    if (!cur || !nw || !conf) return;
    if (nw.value.length < 8) { showToast('New password must be at least 8 characters.', 'error'); return; }
    if (nw.value !== conf.value) { showToast('Passwords do not match.', 'error'); return; }

    try {
        var resp = await fetch(CLIENT_API + '/auth/password', {
            method:  'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body:    JSON.stringify({ currentPassword: cur.value, newPassword: nw.value })
        });
        var data = await resp.json();
        if (!resp.ok || !data.success) throw new Error(data.message || 'Password update failed');

        cur.value = ''; nw.value = ''; conf.value = '';
        showToast('Password updated successfully!', 'success');
    } catch (e) {
        showToast(e.message || 'Could not update password.', 'error');
    }
}

// ── Password eye toggle ───────────────────────────────────────────────────────
function csTogglePw(inputId, icon) {
    var inp = document.getElementById(inputId);
    if (!inp) return;
    var show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    icon.classList.toggle('fa-eye',      !show);
    icon.classList.toggle('fa-eye-slash', show);
}

// ── Preferences (persisted to localStorage) ───────────────────────────────────
function saveClientPreference(key, value) {
    var stored = {};
    try { stored = JSON.parse(localStorage.getItem('cs_prefs') || '{}'); } catch(e) {}
    stored[key] = value;
    localStorage.setItem('cs_prefs', JSON.stringify(stored));
    showToast('Preference saved.', 'success');
}

// ── Delete account ────────────────────────────────────────────────────────────
async function deleteClientAccount() {
    var confirmed = window.confirm(
        'This will permanently delete your account, all your projects, and connections.\n\nThis cannot be undone. Are you sure?'
    );
    if (!confirmed) return;

    var token = requireClientAuth();
    if (!token) return;

    try {
        var resp = await fetch(CLIENT_API + '/client/account', {
            method:  'DELETE',
            headers: { 'Authorization': 'Bearer ' + token }
        });
        var data = await resp.json();
        if (!resp.ok && resp.status !== 404) throw new Error(data.message || 'Could not delete account.');
        localStorage.removeItem('client_token');
        localStorage.removeItem('client_user');
        localStorage.removeItem('cs_prefs');
        showToast('Account deleted. Redirecting…', 'info');
        setTimeout(function() { window.location.href = 'client-index.html'; }, 1800);
    } catch (e) {
        showToast(e.message || 'Could not delete account.', 'error');
    }
}

/* ============================================================
   NOTIFICATION BELL MODULE
   ============================================================ */
(function() {
'use strict';

/* ── Storage keys ─────────────────────────────────── */
var STORAGE_KEY   = 'smartarch_client_notifications';
var DISMISSED_KEY = 'smartarch_client_notif_dismissed';

/* ── In-memory store (also synced to localStorage) ── */
var _notifications = [];   // [{id, type, text, time, read}]
var _dismissed     = {};   // {id: true} — survives clear, prevents re-add
var _dropdownOpen  = false;

/* ── Load persisted notifications ───────────────────── */
function _load() {
    try {
        var raw = localStorage.getItem(STORAGE_KEY);
        _notifications = raw ? JSON.parse(raw) : [];
    } catch(e) { _notifications = []; }
    try {
        var dis = localStorage.getItem(DISMISSED_KEY);
        _dismissed = dis ? JSON.parse(dis) : {};
    } catch(e) { _dismissed = {}; }
}

function _save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(_notifications.slice(0, 50))); } catch(e) {}
}

function _saveDismissed() {
    try { localStorage.setItem(DISMISSED_KEY, JSON.stringify(_dismissed)); } catch(e) {}
}

/* ── Add a notification (dedup by id + dismissed check) ── */
function _add(id, type, text, time) {
    if (_dismissed[id]) return false;
    if (_notifications.some(function(n) { return n.id === id; })) return false;
    _notifications.unshift({ id: id, type: type, text: text, time: time || new Date().toISOString(), read: false });
    _save();
    return true;
}

/* ── Render the dropdown ─────────────────────────────── */
function _render() {
    var list  = document.getElementById('notifList');
    var badge = document.getElementById('notifBadge');
    var clearBtn = document.getElementById('notifClearBtn');
    if (!list) return;

    var unread = _notifications.filter(function(n) { return !n.read; }).length;

    /* Badge */
    if (unread > 0) {
        badge.textContent = unread > 99 ? '99+' : String(unread);
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }

    /* Clear btn visibility */
    if (clearBtn) clearBtn.style.display = _notifications.length ? '' : 'none';

    /* List */
    if (!_notifications.length) {
        list.innerHTML = '<div class="notif-empty"><i class="fas fa-check-circle" style="color:var(--violet);font-size:1.3rem;margin-bottom:0.5rem;display:block"></i>You\'re all caught up!</div>';
        return;
    }

    var iconMap = { accepted: 'fa-user-check', message: 'fa-comment-alt', rejected: 'fa-times-circle', pending: 'fa-clock', support: 'fa-headset', shared: 'fa-share-alt' };

    list.innerHTML = _notifications.map(function(n) {
        var iconCls = iconMap[n.type] || 'fa-bell';
        var timeStr = _relTime(n.time);
        return '<div class="notif-item' + (n.read ? '' : ' unread') + '" data-id="' + n.id + '" onclick="notifItemClick(\'' + n.id.replace(/'/g, '') + '\')" style="cursor:pointer">' +
            '<div class="notif-icon ' + (n.type || 'message') + '"><i class="fas ' + iconCls + '"></i></div>' +
            '<div class="notif-text">' +
                '<div class="notif-text-main">' + _esc(n.text) + '</div>' +
                '<div class="notif-text-time">' + timeStr + '</div>' +
            '</div>' +
            (!n.read ? '<div class="notif-unread-dot"></div>' : '') +
        '</div>';
    }).join('');
}

/* ── Relative time helper ────────────────────────────── */
function _relTime(iso) {
    try {
        var diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
        if (diff < 60)   return 'Just now';
        if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
        if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
        return Math.floor(diff / 86400) + 'd ago';
    } catch(e) { return ''; }
}

function _esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── Mark all as read ────────────────────────────────── */
function _markAllRead() {
    _notifications.forEach(function(n) { n.read = true; });
    _save();
    _render();
}

/* ── Toggle dropdown ─────────────────────────────────── */
window.toggleNotifDropdown = function(e) {
    e.stopPropagation();
    var panel = document.getElementById('notifDropdown');
    if (!panel) return;
    _dropdownOpen = !_dropdownOpen;
    panel.style.display = _dropdownOpen ? 'block' : 'none';
    if (_dropdownOpen) {
        _markAllRead();
        _render();
    }
};

/* ── Clear all ───────────────────────────────────────── */
window.clearAllNotifications = function() {
    /* Mark every current notification id as dismissed so polling never re-adds them */
    _notifications.forEach(function(n) { _dismissed[n.id] = true; });
    _saveDismissed();
    _notifications = [];
    _save();
    _render();
};

/* ── Navigate to the right view based on notification type ── */
window.notifItemClick = function(id) {
    document.getElementById('notifDropdown').style.display = 'none';
    _dropdownOpen = false;
    if (typeof showView !== 'function') return;

    /* Find the notification to determine its type */
    var notif = id ? _notifications.find(function(n) { return n.id === id; }) : null;
    var type  = notif ? notif.type : null;

    if (type === 'support') {
        showView('support');
    } else if (type === 'shared') {
        showView('shared');
    } else {
        showView('connections');
    }
};

/* ── Outside-click to close ──────────────────────────── */
document.addEventListener('click', function(e) {
    if (!_dropdownOpen) return;
    var wrap = document.getElementById('notifWrap');
    if (wrap && !wrap.contains(e.target)) {
        document.getElementById('notifDropdown').style.display = 'none';
        _dropdownOpen = false;
    }
});

/* ── Escape key ──────────────────────────────────────── */
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && _dropdownOpen) {
        document.getElementById('notifDropdown').style.display = 'none';
        _dropdownOpen = false;
    }
});

/* ════════════════════════════════════════════════════
   POLL CONNECTIONS & BUILD NOTIFICATIONS
   ════════════════════════════════════════════════════ */
var _lastKnownConnections = null;  // Map<id, {status, unreadByClient}>

async function _pollConnections() {
    var token = localStorage.getItem('client_token');
    if (!token) return;
    try {
        var r = await fetch((window.CLIENT_API || 'http://localhost:5000/api') + '/connections/my', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (!r.ok) return;
        var d = await r.json();
        if (!d.success) return;
        _processConnections(d.data || []);
    } catch(e) {}
}

function _processConnections(conns) {
    var changed = false;
    conns.forEach(function(c) {
        var arch     = c.architect || {};
        var archName = arch.name || 'An architect';
        var cid      = c._id;

        var prev = _lastKnownConnections ? _lastKnownConnections[cid] : null;

        /* Request accepted */
        if (c.status === 'accepted' && (!prev || prev.status !== 'accepted')) {
            if (_add('accepted-' + cid, 'accepted',
                archName + ' accepted your connection request!', c.updatedAt)) changed = true;
        }

        /* Request rejected */
        if (c.status === 'rejected' && (!prev || prev.status !== 'rejected')) {
            if (_add('rejected-' + cid, 'rejected',
                archName + ' declined your connection request.', c.updatedAt)) changed = true;
        }

        /* New unread messages from architect */
        if (c.unreadByClient > 0) {
            var prevUnread = prev ? (prev.unreadByClient || 0) : 0;
            if (c.unreadByClient > prevUnread) {
                var msgId = 'msg-' + cid + '-' + c.unreadByClient;
                var count = c.unreadByClient - prevUnread;
                var txt   = count === 1
                    ? archName + ' sent you a message.'
                    : archName + ' sent you ' + count + ' new messages.';
                if (_add(msgId, 'message', txt, new Date().toISOString())) changed = true;
            }
        }
    });

    /* Build fresh snapshot */
    var snap = {};
    conns.forEach(function(c) { snap[c._id] = { status: c.status, unreadByClient: c.unreadByClient || 0 }; });
    _lastKnownConnections = snap;

    if (changed) _render();
}

/* ════════════════════════════════════════════════════
   POLL SUPPORT TICKET REPLIES → BELL NOTIFICATIONS
   ════════════════════════════════════════════════════ */

async function _pollSupportReplies() {
    var token = localStorage.getItem('client_token');
    if (!token) return;
    try {
        var r = await fetch((window.CLIENT_API || 'http://localhost:5000/api') + '/client/support', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (!r.ok) return;
        var d = await r.json();
        if (!d.success) return;

        var tickets = d.tickets || [];

        /* Fire a bell notification for every ticket where the admin has replied
           and the client hasn't read it yet (userRead === false).
           _add() deduplicates by id and respects _dismissed, so:
           - Tickets already notified and not dismissed are skipped (no duplicate bell).
           - Tickets the user "Clear All"-ed are in _dismissed and won't reappear.
           - New admin replies that arrive between polls ring the bell immediately. */
        var changed = false;
        tickets.forEach(function(t) {
            if (t.userRead !== false) return;   // admin hasn't replied, or client already read it
            var notifId = 'support-reply-' + t._id;
            var subject = t.subject || 'your support ticket';
            if (_add(notifId, 'support',
                'Support replied to: ' + subject,
                t.updatedAt || new Date().toISOString())) {
                changed = true;
            }
        });

        if (changed) _render();
    } catch(e) {}
}

/* ════════════════════════════════════════════════════
   POLL SHARED PROJECTS → BELL NOTIFICATIONS
   ════════════════════════════════════════════════════ */

/* Track share ids we have already notified about */
var _lastKnownShareIds = null;  // Set<shareId> or null

async function _pollSharedProjects() {
    var token = localStorage.getItem('client_token');
    if (!token) return;
    try {
        var r = await fetch((window.CLIENT_API || 'http://localhost:5000/api') + '/shares/my', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (!r.ok) return;
        var d = await r.json();
        if (!d.success) return;

        var shares = d.data || [];
        var currentIds = new Set(shares.map(function(s) { return s._id; }));

        if (_lastKnownShareIds === null) {
            /* First poll: baseline snapshot. Only treat shares that have
               never been viewed as new (viewedAt === null). */
            _lastKnownShareIds = currentIds;

            /* Still surface unseen shares that existed before this session */
            var changed = false;
            shares.forEach(function(s) {
                if (s.viewedAt) return;   // already viewed in a past session
                var arch = (s.sharedBy && s.sharedBy.name) ? s.sharedBy.name : 'An architect';
                var proj = (s.project && s.project.name) ? s.project.name : 'a project';
                var notifId = 'shared-proj-' + s._id;
                if (_add(notifId, 'shared',
                    arch + ' shared "' + proj + '" with you!',
                    s.createdAt || new Date().toISOString())) changed = true;
            });
            if (changed) _render();
            return;
        }

        /* Subsequent polls: fire bell for brand-new shares */
        var changed = false;
        shares.forEach(function(s) {
            if (_lastKnownShareIds.has(s._id)) return;
            var arch = (s.sharedBy && s.sharedBy.name) ? s.sharedBy.name : 'An architect';
            var proj = (s.project && s.project.name) ? s.project.name : 'a project';
            var notifId = 'shared-proj-' + s._id;
            if (_add(notifId, 'shared',
                arch + ' shared "' + proj + '" with you!',
                s.createdAt || new Date().toISOString())) changed = true;
        });

        _lastKnownShareIds = currentIds;
        if (changed) _render();
    } catch(e) {}
}

/* ── Boot ──────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', function() {
    _load();
    _render();

    /* Start polling after a short delay so auth is ready */
    setTimeout(function() {
        _pollConnections();
        setInterval(_pollConnections, 20000);   // every 20 s

        /* Support-reply notifications — poll every 30 s */
        _pollSupportReplies();
        setInterval(_pollSupportReplies, 30000);

        /* Shared-project notifications — poll every 30 s */
        _pollSharedProjects();
        setInterval(_pollSharedProjects, 30000);
    }, 2000);
});

})();

/* ============================================================
   SHARED WITH ME — projects sent by architects to this client
   ============================================================ */

async function loadSharedProjects() {
    var grid = document.getElementById('sharedProjectsGrid');
    if (!grid) return;
    grid.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--slate)"><i class="fas fa-spinner fa-spin" style="font-size:1.5rem"></i><div style="margin-top:1rem">Loading shared projects…</div></div>';

    try {
        var r = await fetch(CLIENT_API + '/shares/my', { headers: authHeaders() });
        var d = await r.json();
        if (!d.success) throw new Error();
        renderSharedProjects(d.data);
    } catch(e) {
        grid.innerHTML = '<div class="shared-empty"><div class="shared-empty-icon"><i class="fas fa-exclamation-circle"></i></div><div>Could not load shared projects.</div></div>';
    }
}

/* ── Shared Projects Tab State ───────────────────────────────────────────── */
var _activeSharedTab = 'inprogress';

function switchSharedTab(tab) {
    _activeSharedTab = tab;
    // Update tab button active state
    ['inprogress','completed','history'].forEach(function(t) {
        var btn = document.getElementById('spTab-' + t);
        if (btn) btn.classList.toggle('active', t === tab);
    });
    // Show/hide grid vs history panel
    var grid = document.getElementById('sharedProjectsGrid');
    var histPanel = document.getElementById('sharedHistoryPanel');
    if (tab === 'history') {
        if (grid) grid.style.display = 'none';
        if (histPanel) histPanel.style.display = '';
        renderSharedHistory(window._cachedSharedProjects || []);
    } else {
        if (grid) grid.style.display = '';
        if (histPanel) histPanel.style.display = 'none';
        renderSharedProjects(window._cachedSharedProjects || []);
    }
}

function renderSharedProjects(shares) {
    var grid  = document.getElementById('sharedProjectsGrid');
    window._cachedSharedProjects = shares; // cache for global search
    var badge = document.getElementById('sharedNavBadge');

    // Badge: count unviewed shares
    var unviewed = shares.filter(function(s){ return !s.viewedAt; }).length;
    if (unviewed > 0) {
        badge.textContent = unviewed;
        badge.style.display = '';
    } else {
        badge.style.display = 'none';
    }

    // Partition by status
    var inProgressStatuses = ['draft','in_progress','review'];
    var completedStatuses  = ['approved'];

    var inProgressShares = shares.filter(function(s){
        return inProgressStatuses.indexOf((s.project || {}).status) !== -1;
    });
    var completedShares = shares.filter(function(s){
        return completedStatuses.indexOf((s.project || {}).status) !== -1;
    });

    // Update tab badges
    var setBadge = function(id, count) {
        var el = document.getElementById(id);
        if (el) el.textContent = count;
    };
    setBadge('spBadge-inprogress', inProgressShares.length);
    setBadge('spBadge-completed',  completedShares.length);
    setBadge('spBadge-history',    completedShares.length); // history = completed architects

    // If history tab active, don't touch the grid
    if (_activeSharedTab === 'history') return;

    // Filter by active tab
    var filtered = _activeSharedTab === 'completed' ? completedShares : inProgressShares;

    if (!filtered.length) {
        var emptyMsg = _activeSharedTab === 'completed'
            ? 'No completed projects yet.'
            : 'No in-progress projects at the moment.';
        grid.innerHTML =
            '<div class="shared-empty">' +
                '<div class="shared-empty-icon"><i class="fas fa-' + (_activeSharedTab === 'completed' ? 'check-circle' : 'spinner') + '"></i></div>' +
                '<div style="font-size:1rem;font-weight:600;color:#f1f5f9;margin-bottom:0.5rem;">' + emptyMsg + '</div>' +
            '</div>';
        return;
    }

    var isCompletedTab = _activeSharedTab === 'completed';

    var viewModes = [
        { icon: 'fa-th-large',      label: '2D Plan'    },
        { icon: 'fa-cube',          label: '3D View'    },
        { icon: 'fa-vector-square', label: 'Wireframe'  },
        { icon: 'fa-walking',       label: 'Walkthrough'},
        { icon: 'fa-home',          label: 'Dollhouse'  }
    ];

    grid.innerHTML = '<div class="shared-grid">' + filtered.map(function(share) {
        var proj  = share.project || {};
        var arch  = share.sharedBy || {};
        var isNew = !share.viewedAt;

        var archAvatar = arch.avatar ||
            'https://ui-avatars.com/api/?name=' + encodeURIComponent(arch.name || 'A') + '&background:7c3aed&color=fff&bold=true&size=40';

        var metaHtml =
            '<div class="shared-meta-chip"><i class="fas fa-ruler-combined"></i>' + (proj.metadata && proj.metadata.totalArea ? proj.metadata.totalArea.toLocaleString() + ' m²' : '—') + '</div>' +
            '<div class="shared-meta-chip"><i class="fas fa-layer-group"></i>' + ((proj.floors && proj.floors.length) || 0) + ' floors</div>' +
            '<div class="shared-meta-chip"><i class="fas fa-door-open"></i>' + (proj.metadata && proj.metadata.totalRooms || 0) + ' rooms</div>';

        var viewModesHtml = '<div class="view-mode-grid">' +
            viewModes.map(function(m){
                return '<div class="view-mode-chip"><i class="fas ' + m.icon + '" style="font-size:0.6rem"></i>' + m.label + '</div>';
            }).join('') + '</div>';

        var msgHtml = share.message
            ? '<div class="shared-card-msg">' + esc(share.message) + '</div>'
            : '';

        var newBadge = isNew ? '<span class="shared-new-badge">New</span>' : '';

        var archRating = arch.rating ? parseFloat(arch.rating).toFixed(1) : null;
        var ratingPill = archRating && parseFloat(archRating) > 0
            ? '<span style="display:inline-flex;align-items:center;gap:0.3rem;background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.3);border-radius:20px;padding:2px 8px;font-size:0.7rem;color:#f59e0b;font-weight:600;"><i class="fas fa-star" style="font-size:0.6rem"></i>' + archRating + '</span>'
            : '';

        var sharedDate = share.createdAt
            ? new Date(share.createdAt).toLocaleDateString(undefined, { day:'numeric', month:'short', year:'numeric' })
            : '';

        // Footer: disable chat/connect for completed tab
        var footerBtn;
        if (isCompletedTab) {
            footerBtn =
                '<button class="shared-view-btn" onclick="event.stopPropagation();openSharedProject(\'' + share.shareToken + '\')">' +
                    '<i class="fas fa-eye"></i> Open Project Viewer' +
                '</button>' +
                '<button class="shared-chat-disabled" title="Chat is disabled for completed projects" disabled>' +
                    '<i class="fas fa-comment-slash"></i>' +
                '</button>';
        } else {
            footerBtn =
                '<button class="shared-view-btn" onclick="event.stopPropagation();openSharedProject(\'' + share.shareToken + '\')">' +
                    '<i class="fas fa-eye"></i> Open Project Viewer' +
                '</button>' +
                clientProjectStatusHtml(proj, share);
        }

        return '<div class="shared-card' + (isCompletedTab ? ' shared-card-completed' : '') + '" onclick="openSharedProject(\'' + share.shareToken + '\')">' +
            '<div class="shared-card-top"></div>' +
            '<div class="shared-card-body">' +
                '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:0.5rem;">' +
                    '<div class="shared-card-title">' + esc(proj.name || 'Untitled Project') + '</div>' +
                    '<div style="display:flex;gap:0.4rem;align-items:center;flex-shrink:0;">' +
                        clientProjectStatusChip(proj.status) +
                        newBadge +
                    '</div>' +
                '</div>' +
                '<div class="shared-card-arch">' +
                    '<img src="' + archAvatar + '" alt="' + esc(arch.name || '') + '" style="width:20px;height:20px;border-radius:50%;object-fit:cover;flex-shrink:0;" onerror="this.src=\'https://ui-avatars.com/api/?name=A&background=7c3aed&color=fff&bold=true\'">' +
                    esc(arch.name || 'Architect') +
                    (arch.specialization ? ' · ' + esc(arch.specialization) : '') +
                    ratingPill +
                    (sharedDate ? '<span style="margin-left:auto;color:#475569;font-size:0.7rem;">' + sharedDate + '</span>' : '') +
                '</div>' +
                '<div class="shared-card-meta">' + metaHtml + '</div>' +
                viewModesHtml +
                msgHtml +
                (isCompletedTab ? '<div class="shared-completed-banner"><i class="fas fa-check-circle"></i> Project Completed — Chat Disabled</div>' : '') +
                '<div class="shared-card-footer">' + footerBtn + '</div>' +
            '</div>' +
        '</div>';
    }).join('') + '</div>';
}

function renderSharedHistory(shares) {
    var listEl = document.getElementById('sharedHistoryList');
    if (!listEl) return;

    // Collect unique completed architects
    var completedStatuses = ['approved'];
    var completedShares = shares.filter(function(s){
        return completedStatuses.indexOf((s.project || {}).status) !== -1;
    });

    if (!completedShares.length) {
        listEl.innerHTML = '<div class="shared-empty"><div class="shared-empty-icon"><i class="fas fa-history"></i></div>' +
            '<div style="font-size:1rem;font-weight:600;color:#f1f5f9;margin-bottom:0.5rem;">No history yet</div>' +
            '<div style="font-size:0.85rem;color:#64748b;">Completed projects and their architects will appear here.</div></div>';
        return;
    }

    // Group by architect
    var archMap = {};
    completedShares.forEach(function(share) {
        var arch = share.sharedBy || {};
        var archId = arch._id || arch.id || arch.name || 'unknown';
        if (!archMap[archId]) {
            archMap[archId] = { arch: arch, projects: [] };
        }
        archMap[archId].projects.push(share.project || {});
    });

    listEl.innerHTML = Object.values(archMap).map(function(entry) {
        var arch = entry.arch;
        var projects = entry.projects;
        var avatar = arch.avatar ||
            'https://ui-avatars.com/api/?name=' + encodeURIComponent(arch.name || 'A') + '&background=7c3aed&color=fff&bold=true&size=60';
        var archRating = arch.rating ? parseFloat(arch.rating).toFixed(1) : null;
        var ratingHtml = archRating && parseFloat(archRating) > 0
            ? '<span class="sp-hist-rating"><i class="fas fa-star"></i>' + archRating + '</span>' : '';

        var projListHtml = projects.map(function(p) {
            var startedStr  = p.createdAt
                ? new Date(p.createdAt).toLocaleDateString(undefined, {day:'numeric', month:'short', year:'numeric'})
                : '—';
            var completedStr = p.updatedAt
                ? new Date(p.updatedAt).toLocaleDateString(undefined, {day:'numeric', month:'short', year:'numeric'})
                : '—';
            return '<div class="sp-hist-proj-item">' +
                '<i class="fas fa-folder-open" style="color:var(--cyan);font-size:0.7rem"></i>' +
                '<div class="sp-hist-proj-detail">' +
                    '<span class="sp-hist-proj-name">' + esc(p.name || 'Untitled Project') + '</span>' +
                    '<div class="sp-hist-proj-dates">' +
                        '<span><i class="fas fa-play-circle" style="color:#7c3aed;font-size:0.6rem"></i> Started: ' + startedStr + '</span>' +
                        '<span><i class="fas fa-check-circle" style="color:#10b981;font-size:0.6rem"></i> Completed: ' + completedStr + '</span>' +
                    '</div>' +
                '</div>' +
            '</div>';
        }).join('');

        return '<div class="sp-hist-card">' +
            '<div class="sp-hist-top">' +
                '<img class="sp-hist-avatar" src="' + avatar + '" alt="' + esc(arch.name||'') + '" onerror="this.src=\'https://ui-avatars.com/api/?name=A&background=7c3aed&color=fff&bold=true\'">' +
                '<div class="sp-hist-info">' +
                    '<div class="sp-hist-name">' + esc(arch.name || 'Architect') + '</div>' +
                    '<div class="sp-hist-spec">' + esc(arch.specialization || 'Architect') + ' ' + ratingHtml + '</div>' +
                    '<div class="sp-hist-count"><i class="fas fa-check-circle" style="color:#10b981;font-size:0.65rem"></i> ' + projects.length + ' project' + (projects.length > 1 ? 's' : '') + ' completed</div>' +
                '</div>' +
            '</div>' +
            '<div class="sp-hist-proj-list">' + projListHtml + '</div>' +
        '</div>';
    }).join('');
}
function openSharedProject(token) {
    var backUrl = encodeURIComponent('client-dashboard.html#shared');
    window.open('project-viewer.html?token=' + token + '&back=' + backUrl, '_blank');
}

// ── Project Status Helpers (client side) ──────────────────────────────────────
function clientProjectStatusChip(status) {
    var STATUS_MAP = {
        draft:       { label: 'Draft',       color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.25)' },
        in_progress: { label: 'In Progress', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.3)'  },
        review:      { label: 'Awaiting Your Approval', color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.3)' },
        approved:    { label: 'Completed',   color: '#10b981', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.3)'  }
    };
    if (!status) return '';
    var s = STATUS_MAP[status] || { label: status, color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.2)' };
    return '<span style="display:inline-flex;align-items:center;gap:0.3rem;padding:2px 8px;border-radius:20px;font-size:0.65rem;font-weight:700;letter-spacing:0.03em;' +
        'background:' + s.bg + ';color:' + s.color + ';border:1px solid ' + s.border + ';white-space:nowrap;">' +
        s.label + '</span>';
}

function clientProjectStatusHtml(proj, share) {
    if (!proj || !proj._id) return '';
    if (proj.status !== 'review') return '';
    // Only show approve button when project is in review stage
    return '<button class="client-approve-btn" onclick="event.stopPropagation();clientApproveProject(\'' + proj._id + '\',\'' + share._id + '\')">' +
        '<i class="fas fa-check-circle"></i> Approve & Complete' +
        '</button>';
}

async function clientApproveProject(projectId, shareId) {
    if (!confirm('Approve this project as complete? This will notify your architect.')) return;
    try {
        var token = localStorage.getItem('token');
        var r = await fetch((window.CLIENT_API || 'http://localhost:5000/api') + '/projects/' + projectId + '/status', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify({ status: 'approved' })
        });
        var data = await r.json();
        if (!data.success) {
            alert(data.message || 'Could not approve project.');
            return;
        }
        showToastClient('Project approved! Your architect has been notified. ✓', 'success');
        // Refresh the shared projects view to reflect new status
        if (typeof loadSharedProjects === 'function') loadSharedProjects();
    } catch (e) {
        alert('Failed to approve project. Please try again.');
    }
}

function showToastClient(msg, type) {
    // Use existing showToast if available, otherwise fallback
    if (typeof showToast === 'function') { showToast(msg, type); return; }
    var t = document.createElement('div');
    t.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;padding:12px 20px;border-radius:10px;font-size:0.85rem;font-weight:600;color:#fff;' +
        (type === 'success' ? 'background:#10b981;' : 'background:#ef4444;');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function(){ t.remove(); }, 3500);
}



/* ═══════════════════════════════════════════════════════════════════════════════
   CLIENT SUPPORT — Ticket System
   Mirrors architect dashboard.js chat logic, adapted for the client role.
   API base: /api/client/support  (requires client JWT)
   ═══════════════════════════════════════════════════════════════════════════════ */

const CLIENT_SUPPORT_API = CLIENT_API + '/client/support';

// ── Module state ──────────────────────────────────────────────────────────────
var clientSupportState = {
    tickets:    [],
    activeId:   null,
    composing:  false,
    initialised: false,
    pollTimer:  null
};

// ── Auth header helper ────────────────────────────────────────────────────────
function clientSupportHeaders() {
    var token = localStorage.getItem('client_token');
    return {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
    };
}

// ── Init (called once when view first becomes active) ────────────────────────
function clientSupportInit() {
    clientSupportLoadTickets();
    // Start unread polling (every 60s)
    if (!clientSupportState.pollTimer) {
        clientSupportPollUnread();
        clientSupportState.pollTimer = setInterval(clientSupportPollUnread, 60000);
    }
}

// ── Poll unread count and update sidebar badge ────────────────────────────────
async function clientSupportPollUnread() {
    try {
        var res  = await fetch(CLIENT_SUPPORT_API + '/unread', { headers: clientSupportHeaders() });
        if (!res.ok) return;
        var data = await res.json();
        var badge = document.getElementById('clientSupportBadge');
        if (!badge) return;
        if (data.count > 0) {
            badge.textContent    = data.count;
            badge.style.display  = 'inline-block';
        } else {
            badge.style.display  = 'none';
        }
    } catch (e) { /* silent */ }
}

// ── Load and render ticket list ───────────────────────────────────────────────
async function clientSupportLoadTickets() {
    var listEl = document.getElementById('clientChatThreadList');
    if (!listEl) return;

    listEl.innerHTML = '<div class="client-chat-list-loading"><i class="fas fa-spinner fa-spin"></i></div>';

    try {
        var res  = await fetch(CLIENT_SUPPORT_API, { headers: clientSupportHeaders() });
        var data = await res.json();

        if (!data.success) {
            listEl.innerHTML = '<div class="client-chat-list-empty"><i class="fas fa-exclamation-circle"></i><p>Failed to load tickets</p></div>';
            return;
        }

        clientSupportState.tickets = data.tickets || [];
        clientSupportRenderList();

        // Clear nav badge now that user is looking at the list
        var badge = document.getElementById('clientSupportBadge');
        if (badge) badge.style.display = 'none';

        // Re-render active thread if one was open
        if (clientSupportState.activeId) {
            var active = clientSupportState.tickets.find(function(t) { return t._id === clientSupportState.activeId; });
            if (active) clientSupportRenderThread(active);
        }
    } catch (e) {
        listEl.innerHTML = '<div class="client-chat-list-empty"><i class="fas fa-wifi"></i><p>Network error.<br>Check your connection.</p></div>';
    }
}

// ── Render thread list in sidebar ─────────────────────────────────────────────
function clientSupportRenderList() {
    var listEl = document.getElementById('clientChatThreadList');
    if (!listEl) return;

    if (!clientSupportState.tickets.length) {
        listEl.innerHTML = '<div class="client-chat-list-empty">' +
            '<i class="fas fa-comment-slash"></i>' +
            '<p>No tickets yet.<br>Tap <i class="fas fa-edit"></i> to open one.</p>' +
            '</div>';
        return;
    }

    var statusColors = { open: '#f59e0b', replied: '#10b981', closed: '#64748b' };

    listEl.innerHTML = clientSupportState.tickets.map(function(t) {
        var unread  = !t.userRead && t.replies && t.replies.length > 0;
        var color   = statusColors[t.status] || '#64748b';
        var lastMsg = (t.replies && t.replies.length)
            ? t.replies[t.replies.length - 1].message
            : t.message;
        var preview = lastMsg ? lastMsg.slice(0, 55) + (lastMsg.length > 55 ? '…' : '') : '';
        var time    = clientSupportRelTime(t.updatedAt || t.createdAt);
        var isActive = t._id === clientSupportState.activeId;

        return '<div class="client-chat-list-item' +
            (unread   ? ' unread' : '') +
            (isActive ? ' active' : '') +
            '" onclick="clientSupportOpenThread(\'' + t._id + '\')" data-stid="' + t._id + '">' +
            '<div class="client-chat-list-subject">' +
            (unread ? '<span class="client-chat-unread-dot"></span>' : '') +
            clientSupportEsc(t.subject) +
            '</div>' +
            '<div class="client-chat-list-meta">' +
            '<span class="client-chat-list-preview">' + clientSupportEsc(preview) + '</span>' +
            '<span class="client-chat-list-time">' + time + '</span>' +
            '</div>' +
            '<span class="client-chat-status-pill" style="background:' + color + '22;color:' + color + ';border:1px solid ' + color + '44;">' +
            t.status + '</span>' +
            '</div>';
    }).join('');
}

// ── Open a ticket thread ──────────────────────────────────────────────────────
function clientSupportOpenThread(id) {
    clientSupportState.activeId = id;

    // Update active state in sidebar
    document.querySelectorAll('.client-chat-list-item').forEach(function(el) {
        el.classList.remove('active');
    });
    var item = document.querySelector('.client-chat-list-item[data-stid="' + id + '"]');
    if (item) item.classList.add('active');

    // Dismiss compose if open
    clientSupportHideCompose(false);

    var ticket = clientSupportState.tickets.find(function(t) { return t._id === id; });
    if (ticket) {
        clientSupportRenderThread(ticket);
        // Mark read via GET single ticket (fires server-side userRead = true)
        if (!ticket.userRead) {
            fetch(CLIENT_SUPPORT_API + '/' + id, { headers: clientSupportHeaders() })
                .then(function(r) { return r.json(); })
                .then(function(d) {
                    if (d.success) {
                        // Update local state
                        var idx = clientSupportState.tickets.findIndex(function(t) { return t._id === id; });
                        if (idx !== -1) clientSupportState.tickets[idx] = d.ticket;
                        clientSupportRenderList();
                        clientSupportPollUnread();
                    }
                })
                .catch(function() {});
        }
    }
}

// ── Render a ticket thread in the main pane ───────────────────────────────────
function clientSupportRenderThread(ticket) {
    var emptyEl   = document.getElementById('clientChatEmpty');
    var composeEl = document.getElementById('clientChatCompose');
    var threadEl  = document.getElementById('clientChatThread');

    if (emptyEl)   emptyEl.style.display   = 'none';
    if (composeEl) composeEl.style.display = 'none';
    if (threadEl)  threadEl.style.display  = 'flex';

    // Header
    var statusColors = { open: '#f59e0b', replied: '#10b981', closed: '#64748b' };
    var color = statusColors[ticket.status] || '#64748b';

    var subjectEl = document.getElementById('clientThreadSubject');
    var metaEl    = document.getElementById('clientThreadMeta');
    var statusEl  = document.getElementById('clientThreadStatus');

    if (subjectEl) subjectEl.textContent = ticket.subject;
    if (metaEl)    metaEl.textContent    = new Date(ticket.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    if (statusEl)  statusEl.innerHTML   = '<span class="client-chat-status-pill" style="background:' + color + '22;color:' + color + ';border:1px solid ' + color + '44;">' + ticket.status + '</span>';

    // Reply box vs closed notice
    var replyBox     = document.getElementById('clientChatReplyBox');
    var closedNotice = document.getElementById('clientChatClosedNotice');
    if (ticket.status === 'closed') {
        if (replyBox)     replyBox.style.display     = 'none';
        if (closedNotice) closedNotice.style.display = 'flex';
    } else {
        if (replyBox)     replyBox.style.display     = 'flex';
        if (closedNotice) closedNotice.style.display = 'none';
        // Focus reply input
        setTimeout(function() {
            var inp = document.getElementById('clientChatReplyInput');
            if (inp) inp.focus();
        }, 80);
    }

    // Build message thread: original message + replies
    var allMsgs = [
        { sender: 'client', senderName: ticket.clientName, message: ticket.message, createdAt: ticket.createdAt }
    ].concat(ticket.replies || []);

    var msgsEl = document.getElementById('clientChatMessages');
    if (msgsEl) {
        msgsEl.innerHTML = allMsgs.map(function(msg) {
            var isAdmin     = msg.sender === 'admin';
            var rowClass    = isAdmin ? 'from-admin' : 'from-client';
            var senderLabel = isAdmin ? '🛡 SmartArch Support' : '👤 You';
            var time        = new Date(msg.createdAt).toLocaleString('en-US', {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            });
            return '<div class="client-bubble-row ' + rowClass + '">' +
                '<span class="client-bubble-sender">' + senderLabel + '</span>' +
                '<div class="client-bubble">' + clientSupportEsc(msg.message) + '</div>' +
                '<span class="client-bubble-time">' + time + '</span>' +
                '</div>';
        }).join('');

        // Scroll to latest message
        setTimeout(function() { msgsEl.scrollTop = msgsEl.scrollHeight; }, 40);
    }
}

// ── Show compose panel ────────────────────────────────────────────────────────
function clientSupportShowCompose() {
    clientSupportState.composing = true;
    clientSupportState.activeId  = null;

    // Deselect sidebar items
    document.querySelectorAll('.client-chat-list-item').forEach(function(el) {
        el.classList.remove('active');
    });

    var emptyEl   = document.getElementById('clientChatEmpty');
    var threadEl  = document.getElementById('clientChatThread');
    var composeEl = document.getElementById('clientChatCompose');

    if (emptyEl)   emptyEl.style.display   = 'none';
    if (threadEl)  threadEl.style.display  = 'none';
    if (composeEl) composeEl.style.display = 'flex';

    // Reset form
    var subjectEl = document.getElementById('clientComposeSubject');
    var msgEl     = document.getElementById('clientComposeMessage');
    var cntEl     = document.getElementById('clientComposeCharCount');
    if (subjectEl) subjectEl.value    = '';
    if (msgEl)     msgEl.value        = '';
    if (cntEl)     cntEl.textContent  = '0';

    // Focus
    setTimeout(function() { if (subjectEl) subjectEl.focus(); }, 80);
}

// ── Hide compose panel ────────────────────────────────────────────────────────
function clientSupportHideCompose(showEmpty) {
    if (showEmpty === undefined) showEmpty = true;
    clientSupportState.composing = false;

    var composeEl = document.getElementById('clientChatCompose');
    var emptyEl   = document.getElementById('clientChatEmpty');
    var threadEl  = document.getElementById('clientChatThread');

    if (composeEl) composeEl.style.display = 'none';

    if (showEmpty && !clientSupportState.activeId) {
        if (emptyEl)  emptyEl.style.display  = 'flex';
        if (threadEl) threadEl.style.display = 'none';
    }
}

// ── Submit a new ticket ───────────────────────────────────────────────────────
async function clientSupportSubmitTicket() {
    var subject = (document.getElementById('clientComposeSubject')?.value || '').trim();
    var message = (document.getElementById('clientComposeMessage')?.value || '').trim();

    if (!subject)               { clientSupportToast('Subject is required.', 'error'); return; }
    if (message.length < 10)    { clientSupportToast('Message must be at least 10 characters.', 'error'); return; }

    var btn = document.getElementById('clientComposeSendBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending…'; }

    try {
        var res  = await fetch(CLIENT_SUPPORT_API, {
            method:  'POST',
            headers: clientSupportHeaders(),
            body:    JSON.stringify({ subject: subject, message: message })
        });
        var data = await res.json();

        if (data.success) {
            clientSupportToast('Ticket submitted! We\'ll reply soon.', 'success');
            await clientSupportLoadTickets();
            // Open the new ticket (first in list = most recent)
            if (clientSupportState.tickets.length) {
                clientSupportOpenThread(clientSupportState.tickets[0]._id);
            }
        } else {
            clientSupportToast(data.message || 'Failed to submit ticket.', 'error');
        }
    } catch (e) {
        clientSupportToast('Network error. Please try again.', 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Ticket'; }
    }
}

// ── Send a reply inside an open thread ───────────────────────────────────────
async function clientSupportSendReply() {
    var inputEl = document.getElementById('clientChatReplyInput');
    var message = (inputEl ? inputEl.value : '').trim();
    if (!message) return;

    var id = clientSupportState.activeId;
    if (!id) return;

    var btn = document.getElementById('clientChatReplySend');
    if (btn) btn.disabled = true;

    try {
        var res  = await fetch(CLIENT_SUPPORT_API + '/' + id + '/reply', {
            method:  'POST',
            headers: clientSupportHeaders(),
            body:    JSON.stringify({ message: message })
        });
        var data = await res.json();

        if (data.success) {
            if (inputEl) inputEl.value = '';
            // Update local ticket and re-render thread immediately
            var idx = clientSupportState.tickets.findIndex(function(t) { return t._id === id; });
            if (idx !== -1) clientSupportState.tickets[idx] = data.ticket;
            clientSupportRenderList();
            clientSupportRenderThread(data.ticket);
        } else {
            clientSupportToast(data.message || 'Failed to send reply.', 'error');
        }
    } catch (e) {
        clientSupportToast('Network error. Please try again.', 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
}

// ── Keyboard shortcut: Enter sends, Shift+Enter newline ──────────────────────
function clientSupportReplyKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        clientSupportSendReply();
    }
}

// ── Mobile: show sidebar list ─────────────────────────────────────────────────
function clientSupportShowList() {
    clientSupportState.activeId = null;
    var threadEl  = document.getElementById('clientChatThread');
    var composeEl = document.getElementById('clientChatCompose');
    var emptyEl   = document.getElementById('clientChatEmpty');
    var sidebar   = document.getElementById('clientChatSidebar');

    if (threadEl)  threadEl.style.display  = 'none';
    if (composeEl) composeEl.style.display = 'none';
    if (emptyEl)   emptyEl.style.display   = 'flex';
    if (sidebar)   sidebar.classList.add('mobile-visible');

    document.querySelectorAll('.client-chat-list-item').forEach(function(el) {
        el.classList.remove('active');
    });
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function clientSupportEsc(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function clientSupportRelTime(dateStr) {
    var diff = Date.now() - new Date(dateStr).getTime();
    var mins = Math.floor(diff / 60000);
    if (mins < 1)   return 'just now';
    if (mins < 60)  return mins + 'm ago';
    var hrs = Math.floor(mins / 60);
    if (hrs < 24)   return hrs + 'h ago';
    var days = Math.floor(hrs / 24);
    if (days < 7)   return days + 'd ago';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function clientSupportToast(message, type) {
    type = type || 'info';
    // Prefer existing toast system
    if (typeof showToast === 'function')       { showToast(message, type); return; }
    if (typeof clientShowToast === 'function') { clientShowToast(message, type); return; }
    var colors = { success: '#10b981', error: '#ef4444', info: '#3b82f6' };
    var toast  = document.createElement('div');
    toast.style.cssText = [
        'position:fixed', 'bottom:1.5rem', 'right:1.5rem', 'z-index:9999',
        'background:#0d1424', 'border:1px solid rgba(255,255,255,0.1)',
        'border-left:3px solid ' + (colors[type] || colors.info),
        'border-radius:10px', 'padding:0.875rem 1.25rem',
        'color:#f1f5f9', 'font-size:0.875rem', 'min-width:260px',
        'box-shadow:0 20px 40px rgba(0,0,0,0.4)'
    ].join(';');
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(function() {
        toast.style.transition = 'opacity 0.3s';
        toast.style.opacity    = '0';
        setTimeout(function() { toast.remove(); }, 300);
    }, 3500);
}

// ── Bootstrap unread polling on page load ─────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
    // Start polling regardless of which view is active
    clientSupportPollUnread();
    setInterval(clientSupportPollUnread, 60000);
});

// ── Expose to inline HTML handlers ───────────────────────────────────────────
window.clientSupportInit          = clientSupportInit;
window.clientSupportShowCompose   = clientSupportShowCompose;
window.clientSupportHideCompose   = clientSupportHideCompose;
window.clientSupportSubmitTicket  = clientSupportSubmitTicket;
window.clientSupportOpenThread    = clientSupportOpenThread;
window.clientSupportSendReply     = clientSupportSendReply;
window.clientSupportReplyKeydown  = clientSupportReplyKeydown;
window.clientSupportShowList      = clientSupportShowList;

/* ═══════════════════════════════════════════════════════════════════════════════
   DOCUMENTS MODULE
   Centralised file hub: project attachments + downloaded project-viewer files.
   ─────────────────────────────────────────────────────────────────────────────
   Storage keys:
     'sa_downloaded_docs'  → JSON array of { name, url, type, projectName, size, downloadedAt }
   ═══════════════════════════════════════════════════════════════════════════════ */

var DOCS_STATE = {
    allFiles:    [],   // merged array of { id, name, originalName, url, mime, size, projectId, projectName, source, createdAt }
    filtered:    [],
    activeTab:   'all',
    uploadFiles: [],
    projects:    []    // cache of client projects for filter dropdown
};

var DOCS_DL_KEY = 'sa_downloaded_docs';

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function docsFormatSize(bytes) {
    if (!bytes || bytes === 0) return '—';
    if (bytes < 1024)       return bytes + ' B';
    if (bytes < 1048576)    return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
}

function docsGetTypeCategory(mime, name) {
    if (!mime && name) {
        var ext = (name.split('.').pop() || '').toLowerCase();
        if (['png','jpg','jpeg','gif','webp','svg','bmp'].includes(ext)) return 'image';
        if (ext === 'pdf') return 'pdf';
        if (['obj','stl','glb','gltf','fbx','dxf','dwg','svg'].includes(ext)) return 'cad';
        return 'other';
    }
    if (!mime) return 'other';
    if (mime.startsWith('image/')) return 'image';
    if (mime === 'application/pdf') return 'pdf';
    if (['model/obj','model/stl','model/gltf-binary','model/gltf+json',
         'application/octet-stream','text/plain'].includes(mime)) {
        var n = (name || '').toLowerCase();
        if (n.endsWith('.obj')||n.endsWith('.stl')||n.endsWith('.glb')||
            n.endsWith('.gltf')||n.endsWith('.fbx')) return 'cad';
    }
    return 'other';
}

function docsTypeIcon(category, mime, name) {
    var ext = (name || '').split('.').pop().toLowerCase();
    if (category === 'image') return { icon: 'fa-file-image',    color: '#00d4c8' };
    if (category === 'pdf')   return { icon: 'fa-file-pdf',      color: '#ef4444' };
    if (category === 'cad') {
        if (ext === 'svg') return { icon: 'fa-bezier-curve',     color: '#f59e0b' };
        return                   { icon: 'fa-drafting-compass',   color: '#8b5cf6' };
    }
    if (ext === 'json')       return { icon: 'fa-file-code',     color: '#10b981' };
    if (['zip','rar','7z'].includes(ext)) return { icon: 'fa-file-archive', color: '#f97316' };
    return                             { icon: 'fa-file-alt',    color: '#94a3b8' };
}

function docsRelTime(iso) {
    if (!iso) return '';
    var d = new Date(iso), now = Date.now(), diff = now - d.getTime();
    if (diff < 60000)   return 'just now';
    if (diff < 3600000) return Math.floor(diff/60000) + 'm ago';
    if (diff < 86400000)return Math.floor(diff/3600000) + 'h ago';
    if (diff < 604800000)return Math.floor(diff/86400000) + 'd ago';
    return d.toLocaleDateString(undefined, { day:'numeric', month:'short', year:'numeric' });
}

/* ── Downloaded docs localStorage store ─────────────────────────────────── */
function docsGetDownloaded() {
    try { return JSON.parse(localStorage.getItem(DOCS_DL_KEY) || '[]'); }
    catch(e) { return []; }
}

function docsSaveDownloaded(arr) {
    try { localStorage.setItem(DOCS_DL_KEY, JSON.stringify(arr)); } catch(e) {}
}

/* Public: called by project-viewer (via localStorage message) and internally */
function docsAddDownloaded(name, url, mimeOrExt, projectName, sizeBytes) {
    var arr = docsGetDownloaded();
    // Avoid exact duplicates by name+url
    var exists = arr.some(function(f){ return f.name === name && f.url === url; });
    if (!exists) {
        arr.unshift({
            id:           'dl_' + Date.now() + '_' + Math.random().toString(36).slice(2,7),
            name:         name,
            url:          url,
            mime:         mimeOrExt || '',
            projectName:  projectName || 'Delivered Project',
            size:         sizeBytes || 0,
            source:       'downloaded',
            downloadedAt: new Date().toISOString()
        });
        // Keep max 200 entries
        if (arr.length > 200) arr = arr.slice(0, 200);
        docsSaveDownloaded(arr);
    }
    // If documents view is currently active, refresh
    if (typeof currentView !== 'undefined' && currentView === 'documents') {
        loadDocuments();
    }
}
window.docsAddDownloaded = docsAddDownloaded;

/* Listen for cross-tab messages from project-viewer */
window.addEventListener('storage', function(e) {
    if (e.key === DOCS_DL_KEY && currentView === 'documents') {
        // Another tab (project-viewer) updated the key – refresh our view
        _docsBuildAllFiles(DOCS_STATE.projects);
        docsApplyFilters();
    }
});

/* ── Load / Build ──────────────────────────────────────────────────────────── */
async function loadDocuments() {
    var grid = document.getElementById('docsFileGrid');
    if (grid) grid.innerHTML = '<div class="docs-loading"><i class="fas fa-spinner fa-spin"></i><span>Loading documents…</span></div>';

    try {
        var r = await fetch(CLIENT_API + '/client/projects', { headers: authHeaders() });
        var d = await r.json();
        var projects = (d.success && d.data) ? d.data : [];
        DOCS_STATE.projects = projects;

        _docsPopulateProjectFilters(projects);
        _docsBuildAllFiles(projects);
        docsApplyFilters();
    } catch(e) {
        if (grid) grid.innerHTML = '<div class="docs-empty"><i class="fas fa-exclamation-circle" style="color:var(--rose);font-size:2rem;margin-bottom:0.75rem;display:block"></i><div>Could not load documents.</div></div>';
    }
}

function _docsPopulateProjectFilters(projects) {
    var sel1 = document.getElementById('docsProjectFilter');
    var sel2 = document.getElementById('docsUploadProject');
    if (sel1) {
        sel1.innerHTML = '<option value="all">All Projects</option>' +
            projects.map(function(p){ return '<option value="'+p._id+'">'+_docsEsc(p.title)+'</option>'; }).join('');
    }
    if (sel2) {
        sel2.innerHTML = '<option value="">— choose a project —</option>' +
            projects.map(function(p){ return '<option value="'+p._id+'">'+_docsEsc(p.title)+'</option>'; }).join('');
    }
}

function _docsBuildAllFiles(projects) {
    var all = [];

    // 1. Project attachments
    projects.forEach(function(proj) {
        (proj.attachments || []).forEach(function(att) {
            var cat = docsGetTypeCategory(att.mimetype, att.originalName);
            all.push({
                id:          proj._id + '_' + att.originalName,
                name:        att.originalName,
                url:         'http://localhost:5000' + att.url,
                mime:        att.mimetype || '',
                size:        att.size || 0,
                projectId:   proj._id,
                projectName: proj.title,
                source:      'project',
                category:    cat,
                createdAt:   proj.updatedAt || proj.createdAt
            });
        });
    });

    // 2. Downloaded files from project-viewer (localStorage)
    var downloads = docsGetDownloaded();
    downloads.forEach(function(dl) {
        var cat = docsGetTypeCategory(dl.mime, dl.name);
        all.push({
            id:          dl.id,
            name:        dl.name,
            url:         dl.url,
            mime:        dl.mime || '',
            size:        dl.size || 0,
            projectId:   'downloaded',
            projectName: dl.projectName || 'Delivered Project',
            source:      'downloaded',
            category:    cat,
            createdAt:   dl.downloadedAt
        });
    });

    DOCS_STATE.allFiles = all;

    // Update stats
    var dlCount  = downloads.length;
    var projCount = all.length - dlCount;
    var totalSize = all.reduce(function(s,f){ return s + (f.size||0); }, 0);
    var el;
    el = document.getElementById('docsTotalCount');   if(el) el.textContent = all.length;
    el = document.getElementById('docsTotalSize');    if(el) el.textContent = docsFormatSize(totalSize);
    el = document.getElementById('docsProjectCount'); if(el) el.textContent = projCount;
    el = document.getElementById('docsDownloadCount');if(el) el.textContent = dlCount;
}

/* ── Filter / Render ─────────────────────────────────────────────────────── */
function docsSetTab(btn, type) {
    document.querySelectorAll('.docs-tab').forEach(function(b){ b.classList.remove('active'); });
    btn.classList.add('active');
    DOCS_STATE.activeTab = type;
    docsApplyFilters();
}

function docsApplyFilters() {
    var tab     = DOCS_STATE.activeTab;
    var project = (document.getElementById('docsProjectFilter') || {}).value || 'all';
    var query   = ((document.getElementById('docsSearchInput') || {}).value || '').toLowerCase().trim();

    var filtered = DOCS_STATE.allFiles.filter(function(f) {
        // Tab filter
        if (tab === 'downloaded' && f.source !== 'downloaded') return false;
        if (tab !== 'all' && tab !== 'downloaded' && f.category !== tab) return false;
        // Project filter
        if (project !== 'all' && f.projectId !== project) return false;
        // Search
        if (query && !f.name.toLowerCase().includes(query) &&
                     !f.projectName.toLowerCase().includes(query)) return false;
        return true;
    });

    DOCS_STATE.filtered = filtered;
    docsRenderGrid(filtered);
}

function docsRenderGrid(files) {
    var grid = document.getElementById('docsFileGrid');
    if (!grid) return;

    if (!files.length) {
        grid.innerHTML =
            '<div class="docs-empty">' +
                '<i class="fas fa-folder-open" style="font-size:2.5rem;color:var(--slate-2);display:block;margin-bottom:0.75rem"></i>' +
                '<div style="font-weight:600;color:var(--slate);margin-bottom:0.35rem">No files found</div>' +
                '<div style="font-size:0.82rem;color:var(--slate-2)">Upload files to a project or download designs from the Project Viewer.</div>' +
            '</div>';
        return;
    }

    grid.innerHTML = files.map(function(f) {
        var ti       = docsTypeIcon(f.category, f.mime, f.name);
        var srcBadge = f.source === 'downloaded'
            ? '<span class="docs-src-badge docs-src-dl"><i class="fas fa-download"></i> Download</span>'
            : '<span class="docs-src-badge docs-src-proj"><i class="fas fa-paperclip"></i> Project</span>';
        var preview  = _docsCanPreview(f) ? '<button class="docs-card-btn" onclick="event.stopPropagation();docsPreview(\''+_docsEsc(f.id)+'\')"><i class="fas fa-eye"></i></button>' : '';

        return '<div class="docs-file-card" onclick="docsPreview(\''+_docsEsc(f.id)+'\')">' +
                '<div class="docs-card-icon-wrap" style="--ic:'+ti.color+'">' +
                    '<i class="fas '+ti.icon+' docs-card-icon"></i>' +
                '</div>' +
                '<div class="docs-card-info">' +
                    '<div class="docs-card-name" title="'+_docsEsc(f.name)+'">'+_docsEsc(f.name)+'</div>' +
                    '<div class="docs-card-meta">' +
                        '<span class="docs-card-project"><i class="fas fa-folder" style="font-size:0.6rem"></i> '+_docsEsc(f.projectName)+'</span>' +
                        '<span class="docs-card-size">'+docsFormatSize(f.size)+'</span>' +
                        '<span class="docs-card-time">'+docsRelTime(f.createdAt)+'</span>' +
                    '</div>' +
                    '<div class="docs-card-badges">'+srcBadge+'</div>' +
                '</div>' +
                '<div class="docs-card-actions">' +
                    preview +
                    '<a class="docs-card-btn" href="'+f.url+'" download="'+_docsEsc(f.name)+'" target="_blank" onclick="event.stopPropagation()" title="Download"><i class="fas fa-download"></i></a>' +
                '</div>' +
            '</div>';
    }).join('');
}

/* ── Preview ───────────────────────────────────────────────────────────────── */
function _docsCanPreview(f) {
    return f.category === 'image' || f.category === 'pdf';
}

function docsPreview(fileId) {
    var f = DOCS_STATE.allFiles.find(function(x){ return x.id === fileId; });
    if (!f) return;

    var overlay = document.getElementById('docsPreviewOverlay');
    var title   = document.getElementById('docsPreviewTitle');
    var body    = document.getElementById('docsPreviewBody');
    var meta    = document.getElementById('docsPreviewMeta');
    var dlBtn   = document.getElementById('docsPreviewDownloadBtn');

    title.textContent = f.name;
    dlBtn.href        = f.url;
    dlBtn.download    = f.name;

    // Build preview content
    if (f.category === 'image') {
        body.innerHTML = '<img src="'+f.url+'" alt="'+_docsEsc(f.name)+'" class="docs-preview-img" onerror="this.style.display=\'none\';document.getElementById(\'docsPreviewBody\').innerHTML=\'<div class=docs-preview-unavail><i class=\\\"fas fa-image\\\"></i><div>Image could not be loaded.</div><div style=\\\"font-size:0.8rem;color:#64748b;margin-top:0.35rem\\\">The file may require the backend server.</div></div>\'">';
    } else if (f.category === 'pdf') {
        body.innerHTML = '<iframe src="'+f.url+'" class="docs-preview-iframe" title="'+_docsEsc(f.name)+'"></iframe>';
    } else {
        // Non-previewable — show info card
        var ti = docsTypeIcon(f.category, f.mime, f.name);
        body.innerHTML =
            '<div class="docs-preview-unavail">' +
                '<i class="fas '+ti.icon+'" style="font-size:3rem;color:'+ti.color+'"></i>' +
                '<div style="font-size:1rem;font-weight:600;margin-top:0.75rem">'+_docsEsc(f.name)+'</div>' +
                '<div style="font-size:0.82rem;color:#64748b;margin-top:0.35rem">Preview not available for this file type.</div>' +
                '<a href="'+f.url+'" download="'+_docsEsc(f.name)+'" target="_blank" class="docs-preview-download-cta"><i class="fas fa-download"></i> Download to open</a>' +
            '</div>';
    }

    meta.innerHTML =
        '<span><i class="fas fa-folder" style="color:var(--cyan);font-size:0.7rem"></i> '+_docsEsc(f.projectName)+'</span>' +
        '<span>'+docsFormatSize(f.size)+'</span>' +
        '<span>'+docsRelTime(f.createdAt)+'</span>' +
        (f.source === 'downloaded' ? '<span style="color:var(--violet)"><i class="fas fa-download" style="font-size:0.7rem"></i> Downloaded file</span>' : '<span style="color:var(--cyan)"><i class="fas fa-paperclip" style="font-size:0.7rem"></i> Project attachment</span>');

    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function docsClosePreview(e) {
    if (e && e.target !== document.getElementById('docsPreviewOverlay')) return;
    document.getElementById('docsPreviewOverlay').style.display = 'none';
    document.getElementById('docsPreviewBody').innerHTML = '';
    document.body.style.overflow = '';
}

/* ── Upload ────────────────────────────────────────────────────────────────── */
function docsOpenUpload() {
    _docsPopulateProjectFilters(DOCS_STATE.projects);
    DOCS_STATE.uploadFiles = [];
    _docsRenderUploadPreviews();
    document.getElementById('docsFileInput').value = '';
    document.getElementById('docsUploadProject').value = '';
    document.getElementById('docsUploadOverlay').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function docsCloseUpload(e) {
    if (e && e.target !== document.getElementById('docsUploadOverlay')) return;
    document.getElementById('docsUploadOverlay').style.display = 'none';
    document.body.style.overflow = '';
    DOCS_STATE.uploadFiles = [];
}

function docsHandleFileSelect(e) {
    Array.from(e.target.files).forEach(function(f){ _docsAddUploadFile(f); });
    _docsRenderUploadPreviews();
}

function docsHandleDrop(e) {
    e.preventDefault();
    document.getElementById('docsDropZone').classList.remove('dragover');
    Array.from(e.dataTransfer.files).forEach(function(f){ _docsAddUploadFile(f); });
    _docsRenderUploadPreviews();
}

function _docsAddUploadFile(file) {
    if (DOCS_STATE.uploadFiles.length >= 10) { showToast('Maximum 10 files allowed.', 'error'); return; }
    DOCS_STATE.uploadFiles.push(file);
}

function _docsRenderUploadPreviews() {
    var wrap = document.getElementById('docsUploadPreview');
    if (!wrap) return;
    if (!DOCS_STATE.uploadFiles.length) { wrap.innerHTML = ''; return; }
    wrap.innerHTML = DOCS_STATE.uploadFiles.map(function(f, i) {
        var ti = docsTypeIcon(docsGetTypeCategory(f.type, f.name), f.type, f.name);
        return '<div class="docs-upload-file-item">' +
            '<i class="fas '+ti.icon+'" style="color:'+ti.color+';font-size:1rem;flex-shrink:0"></i>' +
            '<div class="docs-upload-file-name">'+_docsEsc(f.name)+'</div>' +
            '<div class="docs-upload-file-size">'+docsFormatSize(f.size)+'</div>' +
            '<button class="docs-upload-file-remove" onclick="docsRemoveUploadFile('+i+')"><i class="fas fa-times"></i></button>' +
        '</div>';
    }).join('');
}

function docsRemoveUploadFile(idx) {
    DOCS_STATE.uploadFiles.splice(idx, 1);
    _docsRenderUploadPreviews();
}

async function docsSubmitUpload() {
    var projectId = document.getElementById('docsUploadProject').value;
    if (!projectId)                      { showToast('Please select a project.', 'error'); return; }
    if (!DOCS_STATE.uploadFiles.length)  { showToast('Please select at least one file.', 'error'); return; }

    var btn = document.getElementById('docsUploadSubmitBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading…';

    try {
        var fd = new FormData();
        DOCS_STATE.uploadFiles.forEach(function(f){ fd.append('attachments', f); });
        // Keep other fields minimal (PUT update)
        var r = await fetch(CLIENT_API + '/client/projects/' + projectId, {
            method: 'PUT',
            headers: { 'Authorization': 'Bearer ' + getToken() },
            body: fd
        });
        var d = await r.json();
        if (!d.success) throw new Error(d.message || 'Upload failed.');
        showToast('Files uploaded successfully!', 'success');
        docsCloseUpload();
        await loadDocuments();
    } catch(e) {
        showToast(e.message || 'Upload failed.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-upload"></i> Upload';
    }
}

function _docsEsc(str) {
    return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// Expose globals needed by HTML onclick attributes
window.docsSetTab         = docsSetTab;
window.docsApplyFilters   = docsApplyFilters;
window.docsOpenUpload     = docsOpenUpload;
window.docsCloseUpload    = docsCloseUpload;
window.docsHandleFileSelect = docsHandleFileSelect;
window.docsHandleDrop     = docsHandleDrop;
window.docsRemoveUploadFile = docsRemoveUploadFile;
window.docsSubmitUpload   = docsSubmitUpload;
window.docsPreview        = docsPreview;
window.docsClosePreview   = docsClosePreview;
window.loadDocuments      = loadDocuments;

