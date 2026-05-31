// frontend/js/auth.js

async function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        showLoading('Logging in...');
        const data = await api.login({ email, password });

        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        api.setToken(data.token);

        // Persist avatar in per-user key so it survives logout/login cycles
        if (data.user && data.user.avatar) {
            const uid = data.user.id || data.user._id || 'guest';
            localStorage.setItem('user_avatar_' + uid, data.user.avatar);
        }

        showToast('Login successful!', 'success');
        hideLoading();

        if (typeof closeModal === 'function') closeModal();
        if (typeof updateUIForLoggedInUser === 'function') updateUIForLoggedInUser(data.user);

        setTimeout(() => { window.location.href = 'dashboard.html'; }, 1000);
    } catch (error) {
        hideLoading();
        showToast(error.message || 'Login failed', 'error');
        
    }
}

async function handleRegister(event) {
    event.preventDefault();
    const name     = document.getElementById('registerName').value;
    const email    = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const company  = document.getElementById('registerCompany') ? document.getElementById('registerCompany').value : '';


    // 🔴 Confirm Password Check
    if (password !== confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
    }

    // ── Client-side password strength validation ──────────────────────────
    const pwRules = [
        { test: password.length >= 8,            msg: 'Password must be at least 8 characters.' },
        { test: /[A-Z]/.test(password),           msg: 'Password must contain at least one uppercase letter.' },
        { test: /[a-z]/.test(password),           msg: 'Password must contain at least one lowercase letter.' },
        { test: /[0-9]/.test(password),           msg: 'Password must contain at least one number.' },
        { test: /[^A-Za-z0-9]/.test(password),   msg: 'Password must contain at least one special character (e.g. @#!$%).' }
    ];

    for (const rule of pwRules) {
        if (!rule.test) {
            showToast(rule.msg, 'error');
            return;
        }
    }
      // ────────────────────────────────────────────────────────────────────

    try {
        showLoading('Creating account...');
        const data = await api.register({ name, email, password, company });
        hideLoading();

        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        api.setToken(data.token);

        showToast('Account created successfully!', 'success');

        if (typeof closeModal === 'function') closeModal();

        if (typeof updateUIForLoggedInUser === 'function') {
            updateUIForLoggedInUser(data.user);
        }

        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1000);

        // Fallback (should not reach here with current backend)
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        api.setToken(data.token);
        showToast('Account created successfully!', 'success');
        if (typeof closeModal === 'function') closeModal();
        if (typeof updateUIForLoggedInUser === 'function') updateUIForLoggedInUser(data.user);
        setTimeout(() => { window.location.href = 'dashboard.html'; }, 1000);
    } catch (error) {
        hideLoading();
        if (error.errors && Array.isArray(error.errors)) {
            error.errors.forEach(e => showToast(e.msg, 'error'));
        } else {
            showToast(error.message || 'Registration failed', 'error');
        }
    }
}

// ─── GOOGLE SIGN-IN ──────────────────────────────────────────────────────────
// loginWithGoogle() is the fallback for when GSI renders its own button.
// It is only called by the hidden fallback <button> elements.
function loginWithGoogle() {
    if (typeof google === 'undefined' || !google.accounts) {
        showToast('Google Sign-In is not available. Check your internet connection.', 'error');
        return;
    }
    google.accounts.id.prompt();
}

// Called by Google Identity Services after the user picks an account
async function handleGoogleCredential(response) {
    try {
        showLoading('Signing in with Google...');
        const data = await api.googleAuth(response.credential);

        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        api.setToken(data.token);

        if (data.user && data.user.avatar) {
            const uid = data.user.id || data.user._id || 'guest';
            localStorage.setItem('user_avatar_' + uid, data.user.avatar);
        }

        hideLoading();
        showToast('Signed in with Google!', 'success');

        if (typeof closeModal === 'function') closeModal();
        if (typeof updateUIForLoggedInUser === 'function') updateUIForLoggedInUser(data.user);

        setTimeout(() => { window.location.href = 'dashboard.html'; }, 1000);
    } catch (error) {
        hideLoading();
        showToast(error.message || 'Google sign-in failed. Please try again.', 'error');
    }
}

// ─── App Rating Modal ─────────────────────────────────────────────────────────
// Injected into DOM on first call, works on every page that loads auth.js.
// Clear any stale key from older builds
sessionStorage.removeItem('smartarch_app_rated');
localStorage.removeItem('smartarch_app_rated');
(function () {
    const STORAGE_KEY = 'smartarch_app_rated_session';

    function _injectStyles() {
        if (document.getElementById('arModalStyles')) return;
        const s = document.createElement('style');
        s.id = 'arModalStyles';
        s.textContent = `
#arModal{position:fixed;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);
  display:flex;align-items:center;justify-content:center;z-index:99999;
  opacity:0;transition:opacity .25s;pointer-events:none;}
#arModal.ar-visible{opacity:1;pointer-events:all;}
#arBox{position:relative;background:#0d1424;border:1px solid rgba(255,255,255,.1);border-radius:16px;
  padding:2rem;width:100%;max-width:380px;box-shadow:0 24px 60px rgba(0,0,0,.6);
  transform:translateY(18px);transition:transform .28s cubic-bezier(.34,1.56,.64,1);}
#arModal.ar-visible #arBox{transform:translateY(0);}
.ar-top-bar{height:4px;background:linear-gradient(90deg,#667eea,#764ba2);
  border-radius:4px 4px 0 0;margin:-2rem -2rem 1.4rem;border-radius:14px 14px 0 0;}
.ar-emoji{font-size:2rem;margin-bottom:.5rem;}
.ar-title{font-size:1.1rem;font-weight:700;color:#f1f5f9;margin-bottom:.3rem;align:center;}
.ar-sub{font-size:.82rem;color:#64748b;margin-bottom:1.4rem;line-height:1.5;}
.ar-stars{display:flex;gap:10px;justify-content:center;margin-bottom:1.2rem;}
.ar-star{font-size:2rem;color:#2d3748;cursor:pointer;transition:color .15s,transform .12s;}
.ar-star:hover,.ar-star.ar-on{color:#f59e0b;}
.ar-star:hover{transform:scale(1.15);}
.ar-comment{width:100%;background:rgba(255,255,255,.06);border:1px solid #2d3651;
  color:#e2e8f0;padding:.6rem .8rem;border-radius:8px;font-size:.82rem;
  resize:none;min-height:70px;font-family:inherit;box-sizing:border-box;}
.ar-comment:focus{outline:none;border-color:#667eea;}
.ar-comment::placeholder{color:#475569;}
.ar-actions{display:flex;gap:.75rem;margin-top:1rem;}
.ar-btn-skip{flex:1;padding:.6rem;border-radius:8px;border:1px solid #2d3651;
  background:transparent;color:#fff;cursor:pointer;font-size:.82rem;transition:all .15s;}
.ar-btn-skip:hover{border-color:#475569;color:#fff;}
.ar-btn-submit{flex:2;padding:.6rem;border-radius:8px;border:none;
  background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;
  cursor:pointer;font-size:.82rem;font-weight:600;transition:opacity .15s;}
.ar-btn-submit:hover{opacity:.88;}
.ar-btn-submit:disabled{opacity:.45;cursor:not-allowed;}
.ar-close-btn{position:absolute;top:12px;right:14px;background:none;border:none;color:#64748b;font-size:1.1rem;cursor:pointer;line-height:1;padding:4px 6px;border-radius:6px;}
.ar-close-btn:hover{color:#e2e8f0;background:rgba(255,255,255,.08);}
.ar-sent{text-align:center;padding:1rem 0;}
.ar-sent-icon{font-size:2.5rem;margin-bottom:.5rem;}
.ar-sent-title{font-size:1rem;font-weight:700;color:#f1f5f9;margin-bottom:.3rem;}
.ar-sent-sub{font-size:.8rem;color:#64748b;}`;
        document.head.appendChild(s);
    }

    function _injectModal() {
        const el = document.createElement('div');
        el.id = 'arModal';
        el.innerHTML = `
<div id="arBox">
  <div class="ar-top-bar"></div>
  <button class="ar-close-btn" id="arCloseBtn" title="Close">&times;</button>
  <div class="ar-title"> ⭐ How was your experience?</div>
  <div class="ar-sub">Rate SmartArch before you go — it only takes 5 seconds and helps us improve.</div>
  <div class="ar-stars" id="arStars">
    <i class="ar-star fas fa-star" data-v="1"></i>
    <i class="ar-star fas fa-star" data-v="2"></i>
    <i class="ar-star fas fa-star" data-v="3"></i>
    <i class="ar-star fas fa-star" data-v="4"></i>
    <i class="ar-star fas fa-star" data-v="5"></i>
  </div>
  <textarea id="arComment" class="ar-comment" maxlength="500"
    placeholder="Any thoughts? (optional)"></textarea>
  <div class="ar-actions">
    <button class="ar-btn-skip" id="arSkip">Skip</button>
    <button class="ar-btn-submit" id="arSubmit" disabled>Submit &amp; Logout</button>
  </div>
</div>`;
        document.body.appendChild(el);
        _wireModal();
    }

    let _selectedRating = 0;
    let _logoutCallback = null;

    function _wireModal() {
        const stars  = document.querySelectorAll('.ar-star');
        const submit = document.getElementById('arSubmit');
        const skip   = document.getElementById('arSkip');

        stars.forEach(s => {
            s.addEventListener('mouseenter', () => _highlightStars(parseInt(s.dataset.v)));
            s.addEventListener('mouseleave', () => _highlightStars(_selectedRating));
            s.addEventListener('click', () => {
                _selectedRating = parseInt(s.dataset.v);
                _highlightStars(_selectedRating);
                if (submit) submit.disabled = false;
            });
        });

        if (submit) submit.addEventListener('click', _submitRating);
        if (skip)   skip.addEventListener('click',   _doLogout);
        const close = document.getElementById('arCloseBtn');
        if (close)  close.addEventListener('click',  _hideModal);
    }

    function _highlightStars(val) {
        document.querySelectorAll('.ar-star').forEach(s => {
            s.classList.toggle('ar-on', parseInt(s.dataset.v) <= val);
        });
    }

    async function _submitRating() {
        if (!_selectedRating) return;
        const submit  = document.getElementById('arSubmit');
        const comment = (document.getElementById('arComment')?.value || '').trim();
        if (submit) { submit.disabled = true; submit.textContent = 'Saving…'; }

        try {
            const token = localStorage.getItem('token');
            await fetch('https://smartarch-backend.onrender.com/api/app-ratings', {
                method:  'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': 'Bearer ' + token } : {})
                },
                body: JSON.stringify({
                    rating:  _selectedRating,
                    comment,
                    page: window.location.pathname.split('/').pop() || 'index.html'
                })
            });
        } catch (e) { /* non-fatal — still log out */ }

        localStorage.setItem(STORAGE_KEY, '1');
        _showThanks();
    }

    function _showThanks() {
        const box = document.getElementById('arBox');
        if (box) {
            box.innerHTML = `
<div class="ar-sent">
  <div class="ar-sent-icon">✨</div>
  <div class="ar-sent-title">Thanks for your feedback!</div>
  <div class="ar-sent-sub">Logging you out…</div>
</div>`;
        }
        setTimeout(_doLogout, 1200);
    }

    function _doLogout() {
        _hideModal();
        if (typeof _logoutCallback === 'function') _logoutCallback();
    }

    function _showModal(cb) {
        _injectStyles();
        // Always remove stale modal so we start fresh
        const old = document.getElementById('arModal');
        if (old) old.remove();
        _injectModal();
        _logoutCallback = cb;
        _selectedRating = 0;
        _highlightStars(0);
        requestAnimationFrame(() => {
            document.getElementById('arModal')?.classList.add('ar-visible');
        });
    }

    function _hideModal() {
        const el = document.getElementById('arModal');
        if (el) {
            el.classList.remove('ar-visible');
            setTimeout(() => el.remove(), 300);
        }
    }

    // Expose so logout() can call it
    window._showAppRatingModal = _showModal;
})();

function logout() {
    // Show rating modal unless already rated this login session
    if (localStorage.getItem('smartarch_app_rated_session')) {
        localStorage.removeItem('smartarch_app_rated_session');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        api.setToken(null);
        showToast('Logged out successfully', 'info');
        setTimeout(() => { window.location.href = 'index.html'; }, 800);
        return;
    }

    // Show rating modal; actual logout happens inside modal callbacks
    if (typeof window._showAppRatingModal === 'function') {
        window._showAppRatingModal(function () {
            localStorage.removeItem('smartarch_app_rated_session');
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            api.setToken(null);
            showToast('Logged out successfully', 'info');
            setTimeout(() => { window.location.href = 'index.html'; }, 800);
        });
    } else {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        api.setToken(null);
        showToast('Logged out successfully', 'info');
        setTimeout(() => { window.location.href = 'index.html'; }, 800);
    }
}

async function checkAuth() {
    const token   = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');

    if (token && userStr) {
        try {
            api.setToken(token);
            const userData = JSON.parse(userStr);
            if (typeof updateUIForLoggedInUser === 'function') {
                updateUIForLoggedInUser(userData);
            }
        } catch (error) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
        }
    }
}

function requireAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'index.html';
        return false;
    }
    api.setToken(token);
    return true;
}

function updateUIForLoggedInUser(user) {
    const navAuth = document.getElementById('navAuth');
    const navUser = document.getElementById('navUser');
    const mobileNavAuth = document.getElementById('mobileNavAuth');
    const mobileNavUser = document.getElementById('mobileNavUser');

    if (navAuth) navAuth.style.display = 'none';
    if (navUser) {
        navUser.style.display = 'flex';
        const avatar = document.getElementById('userAvatar');
        if (avatar) {
            const uid = user.id || user._id || 'guest';
            const savedPic = localStorage.getItem('user_avatar_' + uid);
            avatar.src = savedPic || user.avatar ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=00d4c8&color=060a12&bold=true`;
        }
    }
    if (mobileNavAuth) mobileNavAuth.style.display = 'none';
    if (mobileNavUser) {
        mobileNavUser.style.display = 'flex';
        mobileNavUser.style.flexDirection = 'column';
    }
}

window.handleLogin            = handleLogin;
window.handleRegister         = handleRegister;
window.logout                 = logout;
window.checkAuth              = checkAuth;
window.requireAuth            = requireAuth;
window.updateUIForLoggedInUser = updateUIForLoggedInUser;
window.loginWithGoogle        = loginWithGoogle;
window.handleGoogleCredential = handleGoogleCredential;