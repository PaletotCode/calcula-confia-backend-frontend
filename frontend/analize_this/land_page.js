(function(){
  'use strict';
  function readEnv(){
    try {
      var el = document.getElementById('env-config');
      if (el && el.textContent) return JSON.parse(el.textContent);
    } catch(_){}
    return (window.ENV || {});
  }
  var ENV = readEnv();
  var API = (ENV.NEXT_PUBLIC_API_URL || ENV.NEXT_PUBLIC_API_BASE_URL)
    || ((location.hostname === 'localhost' || location.hostname === '127.0.0.1')
      ? 'http://localhost:8000/api/v1'
      : 'https://calculaconfia-production.up.railway.app/api/v1');
  var MP_PUBLIC_KEY = ENV.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY || '';
  window.CC = window.CC || {};
  window.CC.env = {
    raw: ENV,
    API_BASE: API,
    MP_PUBLIC_KEY: MP_PUBLIC_KEY,
    get: function(k){ return ENV[k]; }
  };
})();

(function(){
  'use strict';
  var TOKEN_KEY = 'cc_token';
  var RETURNING_KEY = 'cc_isReturningUser';
  var LIFETIME_KEY = 'cc_lifetime_access';
  var PAUSE_KEY = 'cc_pause_auto_platform';
  const PLATFORM_LOOP_KEY = 'cc_platform_redirect_meta';
  const PLATFORM_LOOP_WINDOW_MS = 4000;
  const PLATFORM_LOOP_THRESHOLD = 2;
  const PLATFORM_LOOP_COOLDOWN_MS = 15000;

  function safeGet(key){ try { return localStorage.getItem(key); } catch(_) { return null; } }
  function safeSet(key, val){ try { localStorage.setItem(key, val); } catch(_){} }
  function safeRm(key){ try { localStorage.removeItem(key); } catch(_){} }

  window.CC = window.CC || {};
  window.CC.session = {
    TOKEN_KEY: TOKEN_KEY,
    getToken: function(){ return safeGet(TOKEN_KEY); },
    setToken: function(){ safeSet(TOKEN_KEY, '1'); },
    clearToken: function(){ safeRm(TOKEN_KEY); },
    setReturning: function(){ safeSet(RETURNING_KEY, 'true'); },
    isReturning: function(){ try { return !!(safeGet(TOKEN_KEY) || (localStorage.getItem(RETURNING_KEY) === 'true')); } catch(_) { return false; } },
    hasLifetime: function(){ try { return localStorage.getItem(LIFETIME_KEY) === '1'; } catch(_) { return false; } },
    setLifetime: function(){ safeSet(LIFETIME_KEY, '1'); },
    pauseAutoPlatform: function(){ try { sessionStorage.setItem(PAUSE_KEY, String(Date.now())); } catch(_){} },
    clearPause: function(){ try { sessionStorage.removeItem(PAUSE_KEY); } catch(_){} },
    isPaused: function(ttlMs){
      ttlMs = ttlMs || 300000; // 5 min default
      try { var ts = Number(sessionStorage.getItem(PAUSE_KEY)||'0'); if (!ts) return false; if (Date.now()-ts>ttlMs){ sessionStorage.removeItem(PAUSE_KEY); return false; } return true; } catch(_) { return false; }
    }
  };
})();

(function(){
  'use strict';
  var CC = window.CC = window.CC || {};
  var token = false;
  try { token = !!(CC.session && CC.session.getToken && CC.session.getToken()); } catch(_){ }
  var hasLifetime = false;
  try { hasLifetime = !!(CC.session && CC.session.hasLifetime && CC.session.hasLifetime()); } catch(_){ }
  var state = {
    auth: { isAuthenticated: token },
    billing: { hasCreditsOrPaid: hasLifetime },
    ui: { activeCard: 'none' }
  };
  var listeners = new Set();
  function notify(){ listeners.forEach(function(fn){ try{ fn(state); }catch(_){}}); }
  CC.store = {
    state: state,
    setAuth: function(v){ state.auth.isAuthenticated = !!v; notify(); },
    setBilling: function(v){ state.billing.hasCreditsOrPaid = !!v; notify(); },
    setActiveCard: function(v){ state.ui.activeCard = v || 'none'; notify(); },
    onChange: function(fn){ if (typeof fn === 'function') listeners.add(fn); }
  };
  CC.openCard = function(name, fn){
    if (state.ui.activeCard !== 'none') return false;
    state.ui.activeCard = name || 'other';
    try { if (typeof fn === 'function') fn(); } catch(_){ }
    return true;
  };
  CC.closeCard = function(){
    state.ui.activeCard = 'none';
  };
})();(function(){
  'use strict';
  var CC = window.CC = window.CC || {};
  var API = (CC.env && CC.env.API_BASE) || '';

  async function parseError(res){
    var text = '';
    try { text = await res.text(); } catch(_){}
    try {
      var data = text ? JSON.parse(text) : null;
      if (data && (data.detail || data.message || data.error)) return String(data.detail || data.message || data.error);
      return text || ('Erro '+res.status);
    } catch(_){ return text || ('Erro '+res.status); }
  }

  async function request(path, opts){
    opts = opts || {};
    var headers = opts.headers || {};
    var res = await fetch(API + path, {
      method: opts.method||'GET',
      headers: headers,
      body: opts.body,
      credentials: 'include'
    });
    if (!res.ok) {
      var msg = await parseError(res);
      var err = new Error(msg); err.status = res.status; throw err;
    }
    var ct = res.headers.get('content-type') || '';
    return /json/i.test(ct) ? res.json() : res.text();
  }

  CC.api = {
    raw: request,
    me: function(){ return request('/me'); },
    login: function(email, password){
      var body = new URLSearchParams({ username: email, password: password });
      return fetch(API + '/login', {
        method:'POST',
        headers:{ 'Content-Type':'application/x-www-form-urlencoded', Accept:'application/json' },
        body: body,
        credentials: 'include'
      })
        .then(function(r){ if(!r.ok) return parseError(r).then(function(m){ var e=new Error(m); e.status=r.status; throw e; }); return r.json(); });
    },
    register: function(payload){ return request('/register', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(payload) }); },
    sendVerification: function(email){ return request('/auth/send-verification-code', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ email: email }) }); },
    verifyAccount: function(email, code){ return request('/auth/verify-account', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ email: email, code: code }) }); },
    creditsBalance: function(){ return request('/credits/balance'); },
    creditsHistory: function(){ return request('/credits/history'); },
    createOrder: function(){ return request('/payments/create-order', { method:'POST' }); },
    logout: function(){ return request('/logout', { method:'POST' }); }
  };
})();

// CalculaConfia Centralized Router v2.1 (Fixed)
// Handles platform redirection with proper server configuration // test

(function () {
  'use strict';

  const VERSION = '2.1';

  // Global namespace
  window.CCRouter = window.CCRouter || {};
  const R = window.CCRouter;

  // Logs storage and debug utilities
  window.__cc_logs = window.__cc_logs || [];

  R.version = VERSION;

  // Debug utilities
  R.isDebug = function() {
    try {
      const v = (localStorage.getItem('cc_debug_router') || sessionStorage.getItem('cc_debug_router') || '').toString().toLowerCase();
      return v === '1' || v === 'true';
    } catch(_) { return false; }
  };

  R.setDebug = function(on) {
    try { localStorage.setItem('cc_debug_router', on ? '1' : '0'); } catch(_){}
    try { sessionStorage.setItem('cc_debug_router', on ? '1' : '0'); } catch(_){}
    if (console && console.info) console.info('[CC][router] debug =', !!on);
  };

  R.log = function(event, data) {
    try {
      window.__cc_logs.push({ 
        ts: new Date().toISOString(), 
        scope: 'router', 
        version: VERSION,
        event, 
        data: data || null 
      });
      if (R.isDebug() && console && console.info) {
        console.info('[CC][router]', event, data || '');
      }
    } catch(_){}
  };

  // Path utilities
  R.isOnPlatformHtml = function() {
    try {
      return /\/platform\.html(\?.*)?$/i.test(location.pathname);
    } catch(_) { return false; }
  };

  R.isOnPlatform = function() {
    try {
      const path = location.pathname.replace(/\/+$/, '');
      return /\/platform(\.html)?$/i.test(path);
    } catch(_) { return false; }
  };

  R.isOnPlatformPath = function() {
    try {
      const path = location.pathname.replace(/\/+$/, '');
      return path === '/platform' || path === '/platform.html';
    } catch(_) { return false; }
  };

  R.shouldRedirectToPlatform = function(userHasCredits) {
    if (!userHasCredits) return false;
    const path = location.pathname.replace(/\/+$/, '');
    // Redirect to platform if user is on landing page and has credits
    return path === '' || path === '/' || path === '/index.html' || path === '/land_page.html' || path === '/land_page';
  };

  // Platform DOM verification
  R.ensurePlatformDom = function() {
    try {
      if (!R.isOnPlatform()) return;
      
      const hasPlatformElements = !!(
        document.querySelector('#page-container') &&
        document.querySelector('#calculate-container') &&
        document.querySelector('.nav-container')
      );
      
      if (hasPlatformElements) {
        R.log('ensurePlatformDom:already_correct');
        return true;
      }

      R.log('ensurePlatformDom:wrong_dom_detected', {
        path: location.pathname,
        title: document.title
      });

      // Force reload to correct page
      if (location.pathname === '/platform') {
        R.log('ensurePlatformDom:force_reload_platform_html');
        location.replace('/platform.html');
        return false;
      }
      
      return false;
    } catch(error) {
      R.log('ensurePlatformDom:error', { error: error.message });
      return false;
    }
  };

  // Anti-loop protection
  let redirectCount = 0;
  const MAX_REDIRECTS = 2;
  const REDIRECT_RESET_TIME = 10000; // 10 seconds

  R.resetRedirectCount = function() {
    redirectCount = 0;
  };

  // Auto-reset redirect count periodically
  setInterval(R.resetRedirectCount, REDIRECT_RESET_TIME);

  // Main redirect function
  R.redirectToPlatform = function() {
    try {
      if (redirectCount >= MAX_REDIRECTS) {
        R.log('guard:max_redirects_reached', { count: redirectCount });
        return;
      }

      redirectCount++;
      
      const currentPath = location.pathname.replace(/\/+$/, '');
      R.log('redirect:called', { 
        path: currentPath, 
        count: redirectCount 
      });

      // If already on platform path, ensure DOM is correct
      if (R.isOnPlatform()) {
        if (R.ensurePlatformDom()) {
          R.log('redirect:noop_already_on_platform');
          return;
        }
        // ensurePlatformDom handles the redirect if needed
        return;
      }

      // Redirect to platform.html (most reliable)
      R.log('redirect:executing', { 
        from: currentPath, 
        to: '/platform.html' 
      });
      
      location.assign('/platform.html');
      
    } catch(error) {
      R.log('redirect:error', { error: error.message });
    }
  };

  // Initialize
  R.log('router:initialized', { 
    version: VERSION,
    path: location.pathname,
    isOnPlatform: R.isOnPlatform()
  });

  // Export for debugging
  if (R.isDebug()) {
    console.info('[CC][router] Router v' + VERSION + ' loaded. Use CCRouter.setDebug(false) to disable logs.');
  }

})();
(function(){
  'use strict';

  // As funções openModalPreferredView e redirectToPlatform já existem globalmente em app.js
  // Esta delegação de eventos garante que os botões funcionem mesmo que app.js demore para carregar.

  document.addEventListener('click', function(evt){
    const unlock = evt.target.closest('#unlock-cta');
    if (unlock) {
      evt.preventDefault();
      if (window.openModalPreferredView) {
        window.openModalPreferredView();
      }
    }
  }, true);
})();

(function(){
  'use strict';
  var CC = window.CC = window.CC || {};
  function init(){
    var toggle = document.getElementById('session-toggle');
    var panel = document.getElementById('session-panel');
    var statusEl = document.getElementById('session-status');
    var nameEl = document.getElementById('session-name');
    var logoutBtn = document.getElementById('session-logout');
    if (!toggle || toggle._wired) return; toggle._wired = true;
    toggle.addEventListener('click', function(){ if (panel) panel.classList.toggle('hidden'); });
    if (logoutBtn && !logoutBtn._wired) {
      logoutBtn._wired = true;
      logoutBtn.addEventListener('click', function(e){
        e.preventDefault();
        if (window.logoutRedirectHome) window.logoutRedirectHome();
      });
    }
    // status
    if (CC.session && CC.session.getToken && CC.session.getToken()) {
      if (CC.api && CC.api.me) {
        CC.api.me().then(function(me){ var first = (me && (me.first_name || me.firstname)) || (me && me.name ? String(me.name).split(/\s+/)[0] : 'Usuário'); if (statusEl) statusEl.textContent='Logado como '+first; if (nameEl) nameEl.textContent='Você está logado como '+first; }).catch(function(){ if (statusEl) statusEl.textContent='Não logado'; });
      } else { if (statusEl) statusEl.textContent='Logado'; }
    } else { if (statusEl) statusEl.textContent='Não logado'; }
  }
  if (document.readyState === 'complete' || document.readyState === 'interactive') init(); else document.addEventListener('DOMContentLoaded', init);
})();
// CalculaConfia Frontend App JS - FIXED VERSION
// Corrige problemas de autenticação com cookies httpOnly

(function () {
  'use strict';

  // ---- Utilities ----
  // Ensure a minimal CCRouter shim exists even if router.js didn't load
  (function ensureRouterShim(){
    try {
      if (!window.CCRouter) window.CCRouter = {};
      const R = window.CCRouter;
      if (typeof R.isDebug !== 'function') {
        R.isDebug = function(){
          try {
            const v = (localStorage.getItem('cc_debug_router') || sessionStorage.getItem('cc_debug_router') || '').toString().toLowerCase();
            return v === '1' || v === 'true';
          } catch(_) { return false; }
        };
      }
      if (typeof R.setDebug !== 'function') {
        R.setDebug = function(on){
          try { localStorage.setItem('cc_debug_router', on ? '1' : '0'); } catch(_){}
          try { sessionStorage.setItem('cc_debug_router', on ? '1' : '0'); } catch(_){}
          if (console && console.info) console.info('[CC][router] debug =', !!on);
        };
      }
      if (typeof R.log !== 'function') {
        R.log = function(event, data){
          try {
            window.__cc_logs = window.__cc_logs || [];
            window.__cc_logs.push({ ts: new Date().toISOString(), scope: 'router', event, data });
            if (R.isDebug() && console && console.info) console.info('[CC][router]', event, data || '');
          } catch(_){}
        };
      }
      if (typeof R.redirectToPlatform !== 'function') {
        R.redirectToPlatform = function(){ try { window.location.assign('/platform.html'); } catch(_){} };
      }
    } catch(_){}
  })();

  const qs = (sel, ctx = document) => ctx.querySelector(sel);
  const qsa = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const setText = (el, msg = '') => { if (el) el.textContent = String(msg || ''); };
  const show = (el) => el && el.classList.remove('hidden');
  const hide = (el) => el && el.classList.add('hidden');
  const toggle = (el, on) => el && el.classList.toggle('hidden', !on);

  // Environment config (read from JSON script to be CSP-friendly)
  function readEnv() {
    try {
      const el = document.getElementById('env-config');
      if (el && el.textContent) return JSON.parse(el.textContent);
    } catch (_) {}
    return (window.ENV || {});
  }
  const ENV = readEnv();
  const API = (ENV.NEXT_PUBLIC_API_URL || ENV.NEXT_PUBLIC_API_BASE_URL)
    || ((location.hostname === 'localhost' || location.hostname === '127.0.0.1')
      ? 'http://localhost:8000/api/v1'
      : 'https://calculaconfia-production.up.railway.app/api/v1');
  const MP_PUBLIC_KEY = ENV.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY || '';

  // ===== FIXED: AUTHENTICATION STATE MANAGEMENT =====
  // Com cookies httpOnly, não usamos mais localStorage para verificar autenticação
  // Em vez disso, fazemos uma verificação real com o backend
  
  const TOKEN_KEY = 'cc_token';
  const RETURNING_KEY = 'cc_isReturningUser';
  const LIFETIME_KEY = 'cc_lifetime_access';
  const AUTH_STATE_KEY = 'cc_auth_state'; // Novo: cache do estado de autenticação

  // Cache local do estado de autenticação (válido por pouco tempo)
  let authCache = { isAuth: false, lastCheck: 0, user: null };
  const AUTH_CACHE_TTL = 30000; // 30 segundos

  const setReturning = () => { try { localStorage.setItem(RETURNING_KEY, 'true'); } catch (_) {} };
  const hasLifetimeFlag = () => { try { return localStorage.getItem(LIFETIME_KEY) === '1'; } catch(_) { return false; } };
  const setLifetimeFlag = () => { try { localStorage.setItem(LIFETIME_KEY, '1'); } catch(_){} };
  const isReturning = () => {
    try {
      if (authCache.isAuth) return true; // Se está logado, é returning
      return localStorage.getItem(RETURNING_KEY) === 'true';
    } catch (_) { return false; }
  };

  // FIXED: Função para verificar se o usuário está autenticado
  const isAuthenticated = () => {
    const now = Date.now();
    // Verifica cache primeiro
    if (now - authCache.lastCheck < AUTH_CACHE_TTL && authCache.lastCheck > 0) {
      return authCache.isAuth;
    }
    // Se não tem cache válido, verifica localStorage como fallback
    try {
      return !!(localStorage.getItem(TOKEN_KEY) || localStorage.getItem(AUTH_STATE_KEY));
    } catch(_) { 
      return false; 
    }
  };

  // FIXED: Função para marcar usuário como autenticado
  const setAuthenticated = (user = null) => {
    authCache = { isAuth: true, lastCheck: Date.now(), user };
    try {
      localStorage.setItem(TOKEN_KEY, 'authenticated');
      localStorage.setItem(AUTH_STATE_KEY, 'true');
      localStorage.setItem(RETURNING_KEY, 'true');
    } catch(_){}
  };

  function readPlatformLoopMeta() {
    try {
      const raw = sessionStorage.getItem(PLATFORM_LOOP_KEY);
      if (!raw) return null;
      const meta = JSON.parse(raw);
      if (!meta || typeof meta !== 'object') return null;
      return meta;
    } catch (_) { return null; }
  }

  function savePlatformLoopMeta(meta) {
    try {
      if (!meta) sessionStorage.removeItem(PLATFORM_LOOP_KEY);
      else sessionStorage.setItem(PLATFORM_LOOP_KEY, JSON.stringify(meta));
    } catch (_) {}
  }

  function clearPlatformLoopMeta() {
    try { sessionStorage.removeItem(PLATFORM_LOOP_KEY); } catch(_){}
  }

  function isPlatformRedirectBlocked(meta) {
    if (!meta) return false;
    const now = Date.now();
    if (meta.blockedUntil && now < meta.blockedUntil) {
      return true;
    }
    if (meta.blockedUntil && now >= meta.blockedUntil) {
      clearPlatformLoopMeta();
    }
    return false;
  }

  function registerPlatformRedirectAttempt() {
    const now = Date.now();
    let meta = readPlatformLoopMeta();
    if (meta && meta.blockedUntil && now < meta.blockedUntil) {
      return meta;
    }
    if (!meta || typeof meta !== 'object' || !meta.firstAt || (now - meta.firstAt) > PLATFORM_LOOP_WINDOW_MS) {
      meta = { firstAt: now, count: 0 };
    }
    meta.count = (meta.count || 0) + 1;
    if (meta.count >= PLATFORM_LOOP_THRESHOLD) {
      meta.blockedUntil = now + PLATFORM_LOOP_COOLDOWN_MS;
      meta.lastBlockedAt = now;
    } else {
      meta.blockedUntil = 0;
    }
    savePlatformLoopMeta(meta);
    return meta;
  }

  function handlePlatformRedirectBlocked(meta) {
    try {
      if (window.CC && window.CC.session && typeof window.CC.session.pauseAutoPlatform === 'function') {
        window.CC.session.pauseAutoPlatform();
      }
    } catch (_) {}
    try { sessionStorage.removeItem('cc_redirected_to_platform'); } catch(_){}
    try {
      if (window.CCRouter && CCRouter.log) {
        CCRouter.log('redirect:loop_blocked', {
          count: meta && meta.count,
          blockedUntil: meta && meta.blockedUntil
        });
      }
    } catch (_) {}
    try { window.dispatchEvent(new CustomEvent('cc:platform-redirect-blocked', { detail: meta || {} })); } catch(_){}
  }
  
  // FIXED: Função para limpar estado de autenticação
  const clearAuthenticated = () => {
    authCache = { isAuth: false, lastCheck: 0, user: null };
    clearPlatformLoopMeta();
    window.routingInProgress = false;
    window.checkingAuth = false;
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(RETURNING_KEY);
      localStorage.removeItem(LIFETIME_KEY);
      localStorage.removeItem(AUTH_STATE_KEY);
    } catch(_){}
  };

  const headersJson = (extra = {}) => ({ 'Content-Type': 'application/json', ...extra });

  const isAutoPlatformPaused = () => {
    try {
      return window.CC && window.CC.session &&
        typeof window.CC.session.isPaused === 'function' &&
        window.CC.session.isPaused();
    } catch (_) { return false; }
  };

  const clearAutoPlatformPause = () => {
    try {
      if (window.CC && window.CC.session && typeof window.CC.session.clearPause === 'function') {
        window.CC.session.clearPause();
      }
    } catch (_) {}
  };

  try {
    window.addEventListener('cc:login-success', function(){
      try { if (window.CC && window.CC.store) window.CC.store.setAuth(true); } catch(_){ }
    });
  } catch(_){}

  // FIXED: Logout com limpeza completa do estado
  async function logoutRedirectHome() {
    let ok = false;
    try {
      const data = await api('/logout', { method: 'POST' });
      ok = data && data.message === 'Logged out';
    } catch(_){}
    
    clearAuthenticated(); // FIXED: Usa nova função de limpeza
    
    try {
      if (window.CC && CC.store) {
        CC.store.setAuth(false);
        CC.store.setBilling(false);
        if (CC.closeCard) CC.closeCard();
      }
    } catch(_){}
    try { if (window.CCRouter && CCRouter.log) CCRouter.log('logout:done', { apiSuccess: ok }); } catch(_){}
    
    updateLoginBadge();
    window.location.replace('/');
  }

  // Lazy script loader (for robustness if SDK not yet ready)
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.async = true; s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function ensureMpSdk() {
    if (window.MercadoPago) return true;
    try {
      await loadScript('https://sdk.mercadopago.com/js/v2');
      return !!window.MercadoPago;
    } catch (_) {
      return false;
    }
  }

  function getMp() {
    try {
      if (!MP_PUBLIC_KEY) return null;
      if (!window.MercadoPago) return null;
      return new window.MercadoPago(MP_PUBLIC_KEY, { locale: 'pt-BR' });
    } catch (_) { return null; }
  }

  async function openCheckout(preferenceId, initPoint) {
    const ready = await ensureMpSdk();
    let navigated = false;

    function markNavigated() { navigated = true; }
    try {
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') markNavigated(); }, { once: true });
      window.addEventListener('pagehide', markNavigated, { once: true });
    } catch(_){}

    if (ready && MP_PUBLIC_KEY) {
      try {
        const mp = getMp();
        if (mp && preferenceId) {
          mp.checkout({ preference: { id: preferenceId }, autoOpen: true });
          if (initPoint) {
            setTimeout(() => { if (!navigated) window.location.href = initPoint; }, 1200);
          }
          return;
        }
      } catch (_) { /* will fallback below */ }
    }
    if (initPoint) { window.location.href = initPoint; }
  }

  async function parseError(res) {
    const text = await res.text().catch(() => '');
    try {
      const data = text ? JSON.parse(text) : null;
      if (data && (data.detail || data.message || data.error)) return String(data.detail || data.message || data.error);
      return text || `Erro ${res.status}`;
    } catch (_) {
      return text || `Erro ${res.status}`;
    }
  }

  async function api(path, options = {}) {
    // Rate limiting básico
    const now = Date.now();
    window.lastApiCall = window.lastApiCall || 0;
    if (now - window.lastApiCall < 100) {
      await new Promise(r => setTimeout(r, 100));
    }
    window.lastApiCall = Date.now();
    
    const res = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Accept: 'application/json'
      },
      credentials: 'include'
    });
    if (!res.ok) {
      const message = await parseError(res);
      const error = new Error(message);
      error.status = res.status;
      throw error;
    }
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) return res.json();
    return res.text();
  }

  // ---- Payment + Credits helpers ----
  async function httpCreditsBalance() {
    try {
      const data = await api('/credits/balance', { method: 'GET' });
      try { window.CCRouter && CCRouter.log('api:credits_balance:ok', { data }); } catch(_){}
      const pick = (obj) => {
        if (typeof obj === 'number') return obj;
        if (!obj || typeof obj !== 'object') return NaN;
        const keys = ['balance', 'credits', 'creditos', 'valid_credits', 'saldo'];
        for (const k of keys) { if (typeof obj[k] === 'number') return obj[k]; }
        return NaN;
      };
      let num = pick(data);
      if (Number.isNaN(num)) {
        try { const n = Number(data); if (!Number.isNaN(n)) num = n; } catch (_) {}
      }
      return Number.isFinite(num) ? num : 0;
    } catch (err) {
      try { window.CCRouter && CCRouter.log('api:credits_balance:error', { status: err?.status, message: String(err?.message || '') }); } catch(_){}
      if (err && err.status === 401) return -1; // sessão expirada / não autenticado
      return 0;
    }
  }

  // FIXED: Função httpMe com cache de autenticação
  async function httpMe() {
    try {
      const me = await api('/me', { method: 'GET' });
      if (me) {
        setAuthenticated(me); // FIXED: Marca como autenticado ao receber dados do usuário
      }
      try { window.CCRouter && CCRouter.log('api:me:ok', { me: !!me }); } catch(_){}
      return me;
    } catch (e) {
      if (e && (e.status === 401 || e.status === 403)) {
        clearAuthenticated(); // FIXED: Limpa cache se não autenticado
      }
      try { window.CCRouter && CCRouter.log('api:me:error', { status: e?.status, message: String(e?.message || '') }); } catch(_){}
      return null;
    }
  }

  async function httpCreditsHistoryHasPurchase() {
    try {
      const data = await api('/credits/history', { method: 'GET' });
      try { window.CCRouter && CCRouter.log('api:credits_history:ok', { items: Array.isArray(data) ? data.length : (Array.isArray(data?.items) ? data.items.length : null) }); } catch(_){}
      const list = Array.isArray(data)
        ? data
        : (Array.isArray(data?.items) ? data.items : (Array.isArray(data?.transactions) ? data.transactions : []));
      const ok = list.some(it => {
        const t = (it?.transaction_type || it?.type || '').toString().toLowerCase();
        return t === 'purchase' || t === 'compra';
      });
      if (ok) setLifetimeFlag();
      return ok;
    } catch(err) { try { window.CCRouter && CCRouter.log('api:credits_history:error', { status: err?.status, message: String(err?.message || '') }); } catch(_){} return false; }
  }

  async function httpCreateOrder() {
    const data = await api('/payments/create-order', { method: 'POST' });
    try { window.CCRouter && CCRouter.log('api:create_order', { ok: !!data }); } catch(_){}
    const preference_id = data.preference_id || data.id || data.preferenceId || null;
    const init_point = data.init_point || data.initPoint || data.sandbox_init_point || null;
    if (!preference_id && !init_point) throw new Error('Não foi possível criar a ordem de pagamento.');
    return { preference_id, init_point };
  }

  // Pending payment state in localStorage (for reliable resume after redirect)
  const PENDING_KEY = 'cc_pending_payment';
  function setPendingPayment(state) { try { localStorage.setItem(PENDING_KEY, JSON.stringify(state)); } catch(_){} }
  function getPendingPayment() { try { return JSON.parse(localStorage.getItem(PENDING_KEY) || 'null'); } catch(_) { return null; } }
  function clearPendingPayment() { try { localStorage.removeItem(PENDING_KEY); } catch(_){} }

  async function pollCreditsUntilChange(base, { timeoutMs = 120000, intervalMs = 2500 } = {}) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const nowBal = await httpCreditsBalance();
      if (nowBal === -1) { // unauthorized
        const e = new Error('UNAUTH'); e.code = 'UNAUTH'; throw e;
      }
      if (nowBal > (base ?? 0)) return nowBal;
      await new Promise(r => setTimeout(r, intervalMs));
    }
    return null;
  }

  function isOnPlatformHtml() {
    try {
      if (window.CCRouter && typeof window.CCRouter.isOnPlatformHtml === 'function') return window.CCRouter.isOnPlatformHtml();
      return /\/platform\.html$/.test(location.pathname);
    } catch(_) { return false; }
  }

  function isOnPlatform() {
    try {
      if (window.CCRouter && typeof window.CCRouter.isOnPlatform === 'function') return window.CCRouter.isOnPlatform();
      const path = location.pathname.replace(/\/+$/, '');
      return /\/platform(?:\.html)?$/.test(path);
    } catch(_) { return false; }
  }

  function isOtpPlatform() { return isOnPlatform(); }
  try {
    window.isOnPlatform = isOnPlatform;
    window.isOtpPlatform = isOtpPlatform;
  } catch (_) {}

  function redirectToPlatform() {
    const existingMeta = readPlatformLoopMeta();
    if (isPlatformRedirectBlocked(existingMeta)) {
      handlePlatformRedirectBlocked(existingMeta);
      return;
    }

    const meta = registerPlatformRedirectAttempt();
    if (isPlatformRedirectBlocked(meta)) {
      handlePlatformRedirectBlocked(meta);
      return;
    }
    // CORREÇÃO: Marca que está redirecionando para a plataforma
    try {
      sessionStorage.setItem('cc_redirected_to_platform', Date.now().toString());
    } catch(_) {}
    
    if (window.CCRouter && typeof window.CCRouter.redirectToPlatform === 'function') { window.CCRouter.redirectToPlatform(); return; }
    try {
      const path = location.pathname.replace(/\/+$/, '');
      if (/\/platform$/.test(path) && !/platform\.html$/.test(path)) { window.location.replace('/platform.html'); return; }
      if (isOnPlatformHtml()) return;
    } catch(_) {}
    window.location.assign('/platform.html');
  }

  function showPaymentCard(message) {
    // FIXED: Não abre se modal de auth estiver visível
    const authModal = qs('#auth-modal-overlay');
    if (authModal && !authModal.classList.contains('hidden')) {
        return;
    }
    try { if (window.CC && window.CC.store && window.CC.store.state.billing.hasCreditsOrPaid) return; } catch(_){}
    const run = function(){
      const overlay = qs('#payment-card-overlay');
      const status = qs('#payment-card-status');
      if (!overlay) return;
      if (message) { status && (status.textContent = message) && status.classList.remove('hidden'); }
      overlay.classList.remove('hidden');
      try { if (window.lucide && window.lucide.createIcons) window.lucide.createIcons(); } catch(_){}
    };
    if (window.CC && window.CC.openCard) {
      if (!window.CC.openCard('credits', run)) return;
    } else {
      run();
    }
  }
  function hidePaymentCard() {
    const overlay = qs('#payment-card-overlay'); if (overlay) overlay.classList.add('hidden');
    try { if (window.CC && window.CC.closeCard) window.CC.closeCard(); } catch(_){}
  }

  // FIXED: Login badge com verificação real de autenticação
  async function updateLoginBadge() {
    try {
      const toggle = qs('#session-toggle');
      const panel = qs('#session-panel');
      const nameEl = qs('#session-name');
      const statusEl = qs('#session-status');
      const logoutBtn = qs('#session-logout');
      const loginBtn = qs('#open-login-btn');
      if (!toggle || !statusEl) return;
      
      // Wire toggle once
      if (!toggle._wired) {
        toggle._wired = true;
        toggle.addEventListener('click', ()=>{ if (panel) panel.classList.toggle('hidden'); });
      }
      if (logoutBtn && !logoutBtn._wired) {
        logoutBtn._wired = true;
        logoutBtn.addEventListener('click', (e)=>{ e.preventDefault(); logoutRedirectHome(); });
      }

      // FIXED: Verifica autenticação real via API, não localStorage
      const me = await httpMe();
      const isAuth = !!me;
      
      if (!isAuth) {
        statusEl.textContent = 'Não logado';
        nameEl && (nameEl.textContent = 'Você não está logado');
        loginBtn && loginBtn.classList.add('hidden');
        return;
      }

      let first = me.first_name || me.firstname || (me.name ? String(me.name).split(/\s+/)[0] : 'Usuário');
      statusEl.textContent = `Logado como ${first}`;
      nameEl && (nameEl.textContent = `Você está logado como ${first}`);
      if (loginBtn && !isOnPlatform()) {
        loginBtn.classList.remove('hidden');
      }
    } catch(_){}
  }

  // FIXED: Função routeAfterAuth com verificação de autenticação real
  async function routeAfterAuth() {
  if (!isAuthenticated()) {
    const me = await httpMe();
    if (!me) {
      console.warn('[CC] routeAfterAuth called but user is not authenticated');
      return;
    }
  }

  // CORREÇÃO: Não redireciona se já está na plataforma
  if (isOnPlatform()) {
    try { window.CCRouter && CCRouter.log('routeAfterAuth:already_on_platform'); } catch(_){}
    return;
  }

  try { if (isAutoPlatformPaused()) { window.CCRouter && CCRouter.log && CCRouter.log('routeAfterAuth:paused'); return; } } catch(_){ }
  try {
    const lifetime = hasLifetimeFlag();
    const [purchased, balance] = await Promise.all([
      lifetime ? Promise.resolve(true) : httpCreditsHistoryHasPurchase().catch(() => false),
      httpCreditsBalance().catch(() => 0),
    ]);
    try { window.CCRouter && CCRouter.log('routeAfterAuth:computed', { lifetime, purchased, balance }); } catch(_){}

    const hasCred = lifetime || purchased || balance >= 1;
    try { if (window.CC && window.CC.store) window.CC.store.setBilling(hasCred); } catch(_){ }
    
    if (hasCred) {
      try { window.CCRouter && CCRouter.log('routeAfterAuth:redirect'); } catch(_){}
      clearPendingPayment();
      redirectToPlatform();
    } else {
      try { window.CCRouter && CCRouter.log('routeAfterAuth:show_payment'); } catch(_){}
      closeModal();
      showPaymentCard();
    }
  } catch (_) {
    try { window.CCRouter && CCRouter.log('routeAfterAuth:error_fallback'); } catch(_){}
    redirectToPlatform();
  }
}
  // ---- Icons & Swiper ----
  (function ensureIcons(){
    function run(){ try { if (window.lucide && lucide.createIcons) lucide.createIcons(); } catch(_){} }
    if (document.readyState === 'complete' || document.readyState === 'interactive') run();
    else document.addEventListener('DOMContentLoaded', run, { once: true });
    window.addEventListener('load', run, { once: true });
    const s = document.getElementById('lucide-script');
    if (s) s.addEventListener('load', () => { run(); setTimeout(run, 500); setTimeout(run, 2000); });
    let tries = 0; const iv = setInterval(()=>{ run(); if (++tries > 60) clearInterval(iv); }, 100);
  })();

  // Swiper: init when script ready
  let swiper = null;
  function initSwiperIfReady() {
    try {
      if (!swiper && window.Swiper) {
        swiper = new Swiper('.hero-carousel', {
          loop: true,
          autoplay: { delay: 5000, disableOnInteraction: false },
          pagination: { el: '.swiper-pagination', clickable: true },
          effect: 'fade',
          fadeEffect: { crossFade: true },
        });
        const slides = qsa('.hero-carousel .swiper-slide');
        const getActiveVideo = () => {
          const active = document.querySelector('.hero-carousel .swiper-slide-active video');
          return active || null;
        };
        function syncVideos() {
          qsa('.hero-carousel video').forEach(v => { try { v.pause(); } catch(_){} });
          const v = getActiveVideo(); if (v) { try { v.play().catch(()=>{}); } catch(_){} }
        }
        swiper.on('init', syncVideos);
        swiper.on('slideChangeTransitionEnd', syncVideos);
        setTimeout(syncVideos, 0);
      }
    } catch (_) {}
  }
  initSwiperIfReady();
  window.addEventListener('load', initSwiperIfReady, { once: true });

  // ---- FIXED: Smooth scroll SOMENTE para âncoras reais (não intercepta CTAs) ----
  qsa('a[href^="#"]').forEach(anchor => {
    // FIXED: Ignora CTAs que têm lógica especial
    if (anchor.id === 'unlock-cta') return;
    if (anchor.classList.contains('cta-button')) return;
    
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (!targetId || targetId === '#') return;
      e.preventDefault();
      const targetElement = qs(targetId);
      if (targetElement) targetElement.scrollIntoView({ behavior: 'smooth' });
    });
  });

  // ---- Section animations ----
  try {
    const scrollObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        if (entry.target.id === 'comofunciona') {
          qsa('.step-card', entry.target).forEach(card => card.classList.add('is-visible'));
        }
        if (entry.target.id === 'testimonials') {
          qsa('.testimonial-grid-card', entry.target).forEach((card, index) => {
            setTimeout(() => card.classList.add('is-visible'), index * 150);
          });
        }
        scrollObserver.unobserve(entry.target);
      });
    }, { threshold: 0.15 });
    qsa('#comofunciona, #testimonials').forEach(section => scrollObserver.observe(section));
  } catch (_) {}

  // ---- Auth Modal Logic ----
  const authModalOverlay = qs('#auth-modal-overlay');
  const closeAuthBtn = qs('#auth-close-btn');
  const closeAuthTextBtn = qs('#auth-close-text');
  const authSpinner = qs('#auth-spinner');

  const loginView = qs('#login-view');
  const registerView = qs('#register-view');
  const forgotView = qs('#forgot-view');
  const verifyView = qs('#verify-view');

  const authTabs = qsa('.auth-tab');
  const tabLinks = qsa('[data-tab-link]');
  const forgotPasswordLink = qs('#forgot-password-link');

  const loginForm = qs('#login-form');
  const registerForm = qs('#register-form');
  const forgotForm = qs('#forgot-form');
  const verifyForm = qs('#verify-form');
  const resendCodeBtn = qs('#resend-code-btn');

  const loginError = qs('#login-error');
  const loginSuccessMsg = qs('#login-success');
  const registerError = qs('#register-error');
  const forgotError = qs('#forgot-error');
  const forgotSuccess = qs('#forgot-success');
  const verifyError = qs('#verify-error');
  const verifySuccess = qs('#verify-success');

  const views = [loginView, registerView, forgotView, verifyView];

  function showView(viewToShow) {
    try { document.body.classList.add('animate-switch'); setTimeout(()=>document.body.classList.remove('animate-switch'), 180); } catch(_){}
    views.forEach(v => v && v.classList.add('hidden'));
    if (viewToShow) viewToShow.classList.remove('hidden');
    authTabs.forEach(tab => {
      tab.classList.remove('active-tab');
      if (viewToShow && viewToShow.id.includes(tab.dataset.tab)) tab.classList.add('active-tab');
    });
    [loginError, registerError, forgotError, forgotSuccess, verifyError, verifySuccess].forEach(el => setText(el, ''));
    if (viewToShow === registerView) try { setRegisterStep(1); } catch(_){}
  }

  function openModalPreferredView() {
    const run = function(){
      show(authModalOverlay);
      showView(registerView);
      setReturning();
    };
    if (window.CC && window.CC.openCard) window.CC.openCard('signup', run); else run();
  }

  function openModalForce(view) {
    const run = function(){
      show(authModalOverlay);
      showView(view);
      setReturning();
    };
    if (window.CC && window.CC.openCard) window.CC.openCard('signup', run); else run();
  }

  function closeModal() { hide(authModalOverlay); try { window.CC && window.CC.closeCard && window.CC.closeCard(); } catch(_){} }

  if (closeAuthBtn) closeAuthBtn.addEventListener('click', closeModal);
  if (closeAuthTextBtn) closeAuthTextBtn.addEventListener('click', closeModal);

  window.addEventListener('cc:platform-redirect-blocked', () => {
    try {
      if (authModalOverlay) show(authModalOverlay);
      if (typeof showView === 'function' && loginView) showView(loginView);
      setText(loginError, 'Não foi possível abrir a plataforma automaticamente. Faça login novamente.');
    } catch (_) {}
  });

  // FIXED: Header login button e badge
  try {
    if (document.readyState === 'complete' || document.readyState === 'interactive') updateLoginBadge();
    else document.addEventListener('DOMContentLoaded', updateLoginBadge, { once: true });
    window.addEventListener('cc:login-success', updateLoginBadge);
    const openLoginBtn = qs('#open-login-btn');
    if (openLoginBtn) openLoginBtn.addEventListener('click', (e)=>{
      e.preventDefault();
      clearAutoPlatformPause();
      redirectToPlatform();
    });
  } catch(_){}

  authTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const viewId = `${tab.dataset.tab}-view`;
      const view = qs(`#${viewId}`);
      showView(view);
    });
  });

  // FIXED: Event listeners para CTAs que devem APENAS rolar a página
  qsa('a[href="#preco"]:not(#unlock-cta)').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation(); // FIXED: Impede propagação para outros listeners
      const targetElement = qs('#preco');
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth' });
      }
    }, { capture: true }); // FIXED: Usa capture para ter prioridade
  });

  tabLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const viewId = `${link.dataset.tabLink}-view`;
      const view = qs(`#${viewId}`);
      showView(view);
    });
  });

  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener('click', (e) => {
      e.preventDefault();
      showView(forgotView);
    });
  }

  const showSpinner = (on) => toggle(authSpinner, on);

  // ---- Performance heuristics ----
  const LOW_SPEC = (navigator.deviceMemory && navigator.deviceMemory <= 2)
    || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
  const PREFERS_REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // FIXED: ÚNICO botão que deve abrir modal - "Desbloquear Análise por R$5"
  try {
    const unlock = qs('#unlock-cta');
    if (unlock) {
      unlock.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openModalPreferredView();
      }, { capture: true });
    }
  } catch(_){}

  // ---- HTTP calls per FRONTEND.md ----
  async function httpRegister({ email, password, first_name, last_name, applied_referral_code }) {
    return api('/register', {
      method: 'POST',
      headers: headersJson(),
      body: JSON.stringify({ email, password, first_name, last_name, ...(applied_referral_code ? { applied_referral_code } : {}) }),
    });
  }

  async function httpLogin({ email, password }) {
    const body = new URLSearchParams({ username: email, password });
    const res = await fetch(`${API}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body,
      credentials: 'include',
    });
    if (!res.ok) {
      const msg = await parseError(res);
      const err = new Error(msg); err.status = res.status; throw err;
    }
    return res.json();
  }

  async function httpSendVerificationCode(email) {
    return api('/auth/send-verification-code', {
      method: 'POST',
      headers: headersJson(),
      body: JSON.stringify({ email }),
    });
  }

  async function httpVerifyAccount(email, code) {
    return api('/auth/verify-account', {
      method: 'POST',
      headers: headersJson(),
      body: JSON.stringify({ email, code }),
    });
  }

  // FIXED: Form handlers com melhor gestão de estado de autenticação
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      setText(loginError, '');
      setText(loginSuccessMsg, '');
      const submitBtn = loginForm.querySelector('button[type="submit"]');
      submitBtn && (submitBtn.disabled = true);
      showSpinner(true);
      try {
        const email = qs('#login-email').value.trim();
        const password = qs('#login-password').value;
        try { window.CCRouter && CCRouter.log('login:attempt', { email: email || '(empty)' }); } catch(_){}
        
        const data = await httpLogin({ email, password });
        
        // FIXED: Após login bem-sucedido, verificar se usuário realmente está autenticado
        const me = await httpMe();
        if (!me) {
          throw new Error('Falha ao verificar autenticação após login');
        }
        
        setAuthenticated(me); // FIXED: Marca como autenticado com dados do usuário
        
        try { if (window.CC && window.CC.store) window.CC.store.setAuth(true); } catch(_){ }
        try { window.CCRouter && CCRouter.log('login:success', { gotToken: !!data }); } catch(_){}
        
        setText(loginSuccessMsg, 'Login bem-sucedido! Bem-vindo de volta.');
        
        // notificar listeners
        try { window.dispatchEvent(new CustomEvent('cc:login-success')); } catch(_){}
        try { sessionStorage.removeItem('cc_pause_auto_platform'); } catch(_){}
        clearAutoPlatformPause();
        
        setTimeout(() => { closeModal(); routeAfterAuth(); }, 600);
      } catch (err) {
        try { window.CCRouter && CCRouter.log('login:error', { status: err?.status, message: String(err?.message || '') }); } catch(_){}
        const status = err && err.status;
        let msg = err && err.message ? String(err.message) : 'Falha no login.';
        const unverified = /verifi|inativ|ativar|unverified|verify/i.test(msg) || status === 403 || (status === 401 && /inactive/i.test(msg));
        if (unverified) {
          try {
            const email = qs('#login-email').value.trim();
            if (email) {
              await httpSendVerificationCode(email);
              localStorage.setItem('cc_pending_verify_email', email);
              const vEmail = qs('#verify-email'); if (vEmail) vEmail.value = email;
              setText(verifySuccess, 'Código reenviado. Verifique seu e-mail.');
              showView(verifyView);
              return;
            }
          } catch (_) {}
          msg = 'Sua conta ainda não está verificada. Enviamos um novo código.';
        } else if (status === 400 || status === 401) {
          msg = 'E-mail ou senha inválidos.';
        } else if (!status) {
          msg = 'Não foi possível conectar. Tente novamente.';
        }
        setText(loginError, msg);
      } finally {
        showSpinner(false);
        submitBtn && (submitBtn.disabled = false);
      }
    });
  }

  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      setText(registerError, '');
      const submitBtn = registerForm.querySelector('button[type="submit"]');
      submitBtn && (submitBtn.disabled = true);

      const password = qs('#register-password').value;
      const passwordConfirm = qs('#register-password-confirm').value;
      if (password !== passwordConfirm) { setText(registerError, 'As senhas não coincidem.'); submitBtn && (submitBtn.disabled = false); return; }
      
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z]).{6,}$/u;
      if (!passwordRegex.test(password)) {
        setText(registerError, 'A senha deve ter no mínimo 6 caracteres, com letras maiúsculas e minúsculas.');
        submitBtn && (submitBtn.disabled = false);
        return;
      }

      showSpinner(true);
      try {
        const payload = {
          first_name: qs('#register-firstname').value.trim(),
          last_name: qs('#register-lastname').value.trim(),
          email: qs('#register-email').value.trim(),
          password,
        };
        await httpRegister(payload);
        
        try {
          await httpSendVerificationCode(payload.email);
          const vEmail = qs('#verify-email'); if (vEmail) vEmail.value = payload.email;
          showView(verifyView);
        } catch (err) {
          setText(registerError, 'Cadastro criado, mas não foi possível enviar o código de verificação. Tente reenviar mais tarde.');
        }
      } catch (err) {
        const status = err && err.status;
        let msg = err && err.message ? String(err.message) : 'Falha no cadastro.';
        if (status === 409) msg = 'E-mail já cadastrado.';
        setText(registerError, msg);
      } finally {
        showSpinner(false);
        submitBtn && (submitBtn.disabled = false);
      }
    });
  }

  // ---- Register Wizard logic ----
  function setRegisterStep(step) {
    const steps = [qs('#reg-step-1'), qs('#reg-step-2'), qs('#reg-step-3')];
    steps.forEach((el, idx) => { if (el) el.classList.toggle('hidden', idx !== (step-1)); });
    const bar = qs('#reg-progress'); if (bar) { const pct = step===1?33:(step===2?66:100); bar.style.width = pct + '%'; }
  }
  try {
    const n1 = qs('#reg-next-1'); const n2 = qs('#reg-next-2'); const b2 = qs('#reg-back-2'); const b3 = qs('#reg-back-3');
    if (n1) n1.addEventListener('click', ()=>{
      const fn = qs('#register-firstname').value.trim();
      const ln = qs('#register-lastname').value.trim();
      if (!fn || !ln) { setText(registerError, 'Informe nome e sobrenome.'); return; }
      setText(registerError, ''); setRegisterStep(2);
    });
    if (b2) b2.addEventListener('click', ()=>{ setRegisterStep(1); });
    if (n2) n2.addEventListener('click', ()=>{
      const email = qs('#register-email').value.trim();
      const ok = /.+@.+\..+/.test(email);
      if (!ok) { setText(registerError, 'Informe um e‑mail válido.'); return; }
      setText(registerError, ''); setRegisterStep(3);
    });
    if (b3) b3.addEventListener('click', ()=>{ setRegisterStep(2); });
  } catch(_){}

  // ---- Password realtime feedback ----
  (function passwordFeedback(){
    const input = qs('#register-password');
    const confirm = qs('#register-password-confirm');
    const box = qs('#password-feedback');
    if (!input || !box) return;
    function render() {
      const v = input.value || '';
      const hasLower = /[a-z]/.test(v);
      const hasUpper = /[A-Z]/.test(v);
      const hasLen = v.length >= 6;
      const checks = [
        { ok: hasLen, text: 'Mínimo 6 caracteres' },
        { ok: hasUpper, text: 'Inclui letra maiúscula' },
        { ok: hasLower, text: 'Inclui letra minúscula' },
      ];
      const html = checks.map(c => `<div class="pw-check ${c.ok ? 'pw-good' : 'pw-bad'}"><i data-lucide="${c.ok ? 'check-circle-2' : 'x-circle'}"></i><span>${c.text}</span></div>`).join('');
      let matchHtml = '';
      if (confirm && confirm.value) {
        const ok = v === confirm.value;
        matchHtml = `<div class="pw-check ${ok ? 'pw-good' : 'pw-bad'}"><i data-lucide="${ok ? 'check-circle-2' : 'x-circle'}"></i><span>${ok ? 'Senhas iguais' : 'Senhas diferentes'}</span></div>`;
      }
      box.innerHTML = html + matchHtml;
      try { if (window.lucide && lucide.createIcons) lucide.createIcons(); } catch(_){}
      if (confirm) confirm.disabled = v.length === 0;
    }
    input.addEventListener('input', render);
    if (confirm) confirm.addEventListener('input', render);
    render();
  })();

  if (forgotForm) {
    forgotForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      setText(forgotError, '');
      setText(forgotSuccess, '');
      showSpinner(true);
      try {
        await new Promise(r => setTimeout(r, 800));
        setText(forgotSuccess, 'Se o e-mail estiver cadastrado, um link foi enviado.');
        forgotForm.reset();
      } finally {
        showSpinner(false);
      }
    });
  }

  if (verifyForm) {
    verifyForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      setText(verifyError, '');
      setText(verifySuccess, '');
      const submitBtn = verifyForm.querySelector('button[type="submit"]');
      submitBtn && (submitBtn.disabled = true);
      showSpinner(true);
      try {
        const email = qs('#verify-email').value.trim();
        const code = qs('#verify-code').value.trim();
        if (!/^\d{6}$/.test(code)) { throw Object.assign(new Error('Código deve ter 6 dígitos numéricos.'), { status: 422 }); }
        await httpVerifyAccount(email, code);
        setText(verifySuccess, 'Conta verificada com sucesso! Realizando login...');
        let autoLogged = false;
        try {
          const password = qs('#register-password').value;
          if (password) {
            const data = await httpLogin({ email, password });
            if (data) {
              const me = await httpMe(); // FIXED: Verifica dados do usuário após login
              if (me) {
                setAuthenticated(me);
                try { if (window.CC && window.CC.store) window.CC.store.setAuth(true); } catch(_){ }
                try { window.dispatchEvent(new CustomEvent('cc:login-success')); } catch(_){}
                autoLogged = true;
              }
            }
          }
        } catch (_) {}
        try { localStorage.removeItem('cc_pending_verify_email'); } catch(_){}
        if (autoLogged) {
          setTimeout(() => { closeModal(); routeAfterAuth(); }, 600);
        } else {
          setText(verifySuccess, 'Conta verificada com sucesso! Faça login para continuar.');
          const loginEmail = qs('#login-email'); if (loginEmail) loginEmail.value = email;
          showView(loginView);
        }
      } catch (err) {
        const status = err && err.status;
        let msg = err && err.message ? String(err.message) : 'Falha ao verificar conta.';
        if (status === 400 || status === 422) msg = 'Código inválido ou expirado.';
        setText(verifyError, msg);
      } finally {
        showSpinner(false);
        submitBtn && (submitBtn.disabled = false);
      }
    });
  }

  if (resendCodeBtn) {
    const STORAGE_KEY = 'cc_resend_meta';
    const schedule = [120, 300, 1800]; // 2min, 5min, 30min
    let intervalId = null;

    const loadAll = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch(_) { return {}; } };
    const saveAll = (obj) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(obj)); } catch(_){} };
    const getMeta = (email) => (loadAll()[email] || { attempt: 0, nextAt: 0 });
    const setMeta = (email, meta) => { const all = loadAll(); all[email] = meta; saveAll(all); };

    function updateResendUI() {
      const email = (qs('#verify-email')?.value || '').trim();
      if (!email) return;
      const { nextAt } = getMeta(email);
      const now = Date.now();
      if (now < nextAt) {
        const remaining = Math.ceil((nextAt - now) / 1000);
        resendCodeBtn.disabled = true;
        resendCodeBtn.textContent = `Reenviar código em ${remaining}s`;
      } else {
        resendCodeBtn.disabled = false;
        resendCodeBtn.textContent = 'Reenviar código';
      }
    }

    function startCountdown() {
      if (intervalId) clearInterval(intervalId);
      intervalId = setInterval(updateResendUI, 1000);
      updateResendUI();
    }

    resendCodeBtn.addEventListener('click', async () => {
      setText(verifyError, '');
      setText(verifySuccess, '');
      const email = (qs('#verify-email')?.value || '').trim();
      if (!email) { setText(verifyError, 'Informe seu e-mail.'); return; }
      const meta = getMeta(email);
      const now = Date.now();
      if (now < meta.nextAt) { updateResendUI(); return; }
      const idx = Math.min(meta.attempt, schedule.length - 1);
      const waitSec = schedule[idx];
      showSpinner(true);
      try {
        await httpSendVerificationCode(email);
        setText(verifySuccess, 'Código reenviado! Verifique sua caixa de entrada.');
        setMeta(email, { attempt: meta.attempt + 1, nextAt: now + waitSec * 1000 });
        startCountdown();
      } catch (err) {
        setText(verifyError, err && err.message ? String(err.message) : 'Falha ao reenviar código.');
      } finally { showSpinner(false); }
    });

    const vEmail = qs('#verify-email');
    if (vEmail) vEmail.addEventListener('input', updateResendUI);
    startCountdown();
  }

  // ---- Payment Card events ----
  (function setupPaymentCard(){
    const overlay = qs('#payment-card-overlay');
    if (!overlay) return;
    const buyBtn = qs('#buy-credits-btn');
    const closeBtn = qs('#payment-card-close');
    const checkBtn = qs('#check-balance-btn');
    const statusBox = qs('#payment-card-status');

    const setStatus = (msg) => { if (!statusBox) return; if (msg) { statusBox.textContent = msg; statusBox.classList.remove('hidden'); } else { statusBox.textContent = ''; statusBox.classList.add('hidden'); } };

    async function onBuyCredits() {
      // FIXED: Verifica autenticação real, não localStorage
      if (!isAuthenticated()) {
        const me = await httpMe();
        if (!me) {
          openModalPreferredView();
          return;
        }
      }
      
      try {
        buyBtn && (buyBtn.disabled = true);
        setStatus('Criando ordem de pagamento e abrindo o checkout...');
        const base = await httpCreditsBalance();
        const { preference_id, init_point } = await httpCreateOrder();
        setPendingPayment({ startedAt: Date.now(), baseBalance: base });
        try { resumePaymentWatcher(true); } catch(_){}
        await openCheckout(preference_id, init_point);
      } catch (err) {
        setStatus(err && err.message ? String(err.message) : 'Não foi possível iniciar o pagamento.');
      } finally {
        buyBtn && (buyBtn.disabled = false);
      }
    }

    async function onCheckBalance() {
      // FIXED: Verifica autenticação real
      if (!isAuthenticated()) {
        const me = await httpMe();
        if (!me) {
          openModalPreferredView();
          return;
        }
      }
      
      setStatus('Verificando seu saldo...');
      const pending = getPendingPayment();
      const base = pending && typeof pending.baseBalance === 'number' ? pending.baseBalance : await httpCreditsBalance();
      try {
        const changed = await pollCreditsUntilChange(base, { timeoutMs: 20000, intervalMs: 3000 });
        if (changed && changed >= 1) { clearPendingPayment(); redirectToPlatform(); return; }
        setStatus('Ainda não confirmado. Tente novamente em instantes.');
      } catch (err) {
        if (err && (err.code === 'UNAUTH' || err.status === 401)) {
          setStatus('Sessão expirada. Faça login para finalizar.');
          openModalPreferredView();
          const once = () => { window.removeEventListener('cc:login-success', once); onCheckBalance(); };
          window.addEventListener('cc:login-success', once, { once: true });
        } else {
          setStatus('Erro ao verificar saldo. Tente novamente.');
        }
      }
    }

    function onClose() { hidePaymentCard(); }

    buyBtn && buyBtn.addEventListener('click', onBuyCredits);
    checkBtn && checkBtn.addEventListener('click', onCheckBalance);
    closeBtn && closeBtn.addEventListener('click', onClose);
  })();

  // Resume payment watcher after returning from Mercado Pago
  let paymentWatcherActive = false;
  async function resumePaymentWatcher(showUI = false) {
    if (paymentWatcherActive) return;
    const pending = getPendingPayment();
    
    // FIXED: Verifica autenticação real
    if (!pending || !isAuthenticated()) {
      const me = await httpMe();
      if (!me) return;
    }
    
    paymentWatcherActive = true;
    try { window.CCRouter && CCRouter.log('paymentWatcher:start', { base: pending.baseBalance }); } catch(_){}
    if (showUI) showPaymentCard('Aguardando confirmação do pagamento (PIX)...');
    try {
      const next = await pollCreditsUntilChange(pending.baseBalance ?? 0, { timeoutMs: 180000, intervalMs: 3000 });
      if (next && next >= 1) { try { window.CCRouter && CCRouter.log('paymentWatcher:credits_detected', { next }); } catch(_){} setLifetimeFlag(); clearPendingPayment(); redirectToPlatform(); }
    } catch (err) {
      if (err && (err.code === 'UNAUTH' || err.status === 401)) {
        try { window.CCRouter && CCRouter.log('paymentWatcher:unauth'); } catch(_){}
        showPaymentCard('Sessão expirada. Faça login para finalizar.');
        openModalPreferredView();
        const once = async () => { window.removeEventListener('cc:login-success', once); paymentWatcherActive = false; await resumePaymentWatcher(true); };
        window.addEventListener('cc:login-success', once, { once: true });
        return;
      }
    }
    paymentWatcherActive = false;
  }

  function isReturningFromMp() {
    try {
      const p = new URLSearchParams(location.search);
      const keys = ['preference_id','payment_id','collection_id','merchant_order_id','payment_status','status'];
      return keys.some(k => p.get(k));
    } catch(_) { return false; }
  }

  function ensurePlatformAlias() { /* disabled to avoid external rewrites causing loops */ }

  // FIXED: Boot routing com verificação correta de autenticação
  (async function bootRouting(){
  if (window.bootingInProgress) return;
  window.bootingInProgress = true;
  
  try { window.CCRouter && CCRouter.log('bootRouting:start', { path: location.pathname }); } catch(_){}
  
  // CORREÇÃO: Se já está na plataforma, não faz routing
  if (isOnPlatform()) {
    window.bootingInProgress = false;
    return;
  }
  
  // Verifica se está autenticado
  const me = await httpMe();
  if (!me) {
    window.bootingInProgress = false;
    return;
  }

  try { if (isAutoPlatformPaused()) { window.CCRouter && CCRouter.log && CCRouter.log('bootRouting:paused'); window.bootingInProgress = false; return; } } catch(_){ }
  
  // Verifica créditos/histórico
  try {
    const lifetime = hasLifetimeFlag(); 
    let hasPurchase = false; 
    if (!lifetime) hasPurchase = await httpCreditsHistoryHasPurchase();
    const bal = await httpCreditsBalance();
    
    const hasCred = lifetime || hasPurchase || bal >= 1;
    
    if (window.CCRouter && typeof CCRouter.log === 'function') {
      CCRouter.log('bootRouting:decision', { lifetime, hasPurchase, balance: bal, hasCred });
    }
    
    if (hasCred) {
      clearPendingPayment(); 
      redirectToPlatform(); 
      return;
    }
  } catch(_){}
  
  // CORREÇÃO: Só mostra payment card se não tem créditos E está na landing
  window.bootingInProgress = false;
})();

  // Se houver verificação pendente, abrir diretamente a tela de verificação
  try {
    const pending = localStorage.getItem('cc_pending_verify_email');
    if (pending) {
      if (authModalOverlay) show(authModalOverlay);
      const vEmail = qs('#verify-email'); if (vEmail) vEmail.value = pending;
      showView(verifyView);
    }
  } catch (_) {}

  // ---- Visual effects kept unchanged ----
  (function lazyVanta(){
    if (PREFERS_REDUCED) return;
    let loaded = false;
    function loadScript(src) {
      return new Promise((resolve, reject) => {
        const s = document.createElement('script'); s.src = src; s.async = true; s.onload = resolve; s.onerror = reject; document.head.appendChild(s);
      });
    }
    async function ensureVanta() {
      if (loaded) return; loaded = true;
      try {
        if (!window.THREE) await loadScript('https://cdn.jsdelivr.net/npm/three@0.134.0/build/three.min.js');
        if (!window.VANTA) await loadScript('https://cdn.jsdelivr.net/npm/vanta@0.5.24/dist/vanta.net.min.js');
        const opts = { mouseControls: true, touchControls: true, gyroControls: false, minHeight: 200.00, minWidth: 200.00, scale: 1.00, scaleMobile: 1.00, color: 0xcccccc, backgroundColor: 0xffffff, points: 11.00, maxDistance: 22.00, spacing: 18.00 };
        const lite = { ...opts, points: 9.00, maxDistance: 18.00, spacing: 20.00 };
        const conf = LOW_SPEC ? lite : opts;
        if (document.querySelector('#comofunciona')) window.VANTA.NET({ el: '#comofunciona', ...conf });
        if (document.querySelector('#testimonials')) window.VANTA.NET({ el: '#testimonials', ...conf });
      } catch (_) {}
    }
    try {
      const io = new IntersectionObserver((entries) => {
        entries.forEach(e => { if (e.isIntersecting) { ensureVanta(); io.disconnect(); } });
      }, { rootMargin: '200px' });
      const t1 = document.getElementById('comofunciona');
      const t2 = document.getElementById('testimonials');
      if (t1) io.observe(t1); if (t2) io.observe(t2);
    } catch (_) { setTimeout(ensureVanta, 1200); }
  })();

  try {
    const heroText = qs('#hero-text-content');
    if (heroText && !PREFERS_REDUCED) {
      let ticking = false;
      window.addEventListener('scroll', () => {
        if (ticking) return; ticking = true;
        requestAnimationFrame(() => {
          const scrollPosition = window.scrollY;
          if (scrollPosition < window.innerHeight) {
            heroText.style.transform = `translateY(${scrollPosition * 0.5}px)`;
            heroText.style.opacity = String(1 - (scrollPosition / (window.innerHeight / 1.5)));
          }
          ticking = false;
        });
      }, { passive: true });
    }
  } catch (_) {}
  
  // Tilt effects
  (function tiltEffects(){
    function loadScript(src){ return new Promise((res, rej)=>{ const s=document.createElement('script'); s.src=src; s.async=true; s.onload=res; s.onerror=rej; document.head.appendChild(s); }); }
    const pointerFine = matchMedia('(pointer: fine)').matches;

    // Pointer devices: VanillaTilt
    async function ensurePointerTilt(){
      try {
        if (!window.VanillaTilt) await loadScript('https://cdn.jsdelivr.net/npm/vanilla-tilt@1.7.2/dist/vanilla-tilt.min.js');
        const opts = { max: 15, speed: 400, glare: true, 'max-glare': 0.5, scale: 1.05 };
        const lite = { max: 10, speed: 300, glare: false, scale: 1.03 };
        const conf = LOW_SPEC ? lite : opts;
        VanillaTilt.init(qsa('.tilt-card, .faq-item-static'), conf);
      } catch(_){}
    }

    // Coarse pointer (mobile): gyroscope-based 3D for tilt-card and FAQ items
    function ensureGyroTilt(){
      const els = qsa('.tilt-card, .faq-item-static');
      els.forEach(el => el.classList.add('card-3d'));
      let enabled = false, raf = null, last = { beta:0, gamma:0 };
      const factor = 0.03; // sensitivity

      function apply(){
        raf = null;
        els.forEach(el => {
          el.classList.add('card-3d--active');
          const rotX = Math.max(-15, Math.min(15, -last.beta * factor));
          const rotY = Math.max(-15, Math.min(15, last.gamma * factor));
          el.style.transform = `perspective(800px) rotateX(${rotX}deg) rotateY(${rotY}deg)`;
        });
      }
      function onOrient(e){
        last.beta = e.beta || 0; // front-back
        last.gamma = e.gamma || 0; // left-right
        if (!raf) raf = requestAnimationFrame(apply);
      }
      function start(){
        if (enabled) return; enabled = true;
        window.addEventListener('deviceorientation', onOrient);
      }
      // iOS permission flow
      function requestPermIfNeeded(){
        const D = window.DeviceOrientationEvent;
        if (!D) { return start(); }
        if (typeof D.requestPermission === 'function') {
          D.requestPermission().then(state => { if (state === 'granted') start(); }).catch(()=>{});
        } else { start(); }
      }
      // kick off on first user interaction to satisfy permissions without UI changes
      document.addEventListener('touchstart', requestPermIfNeeded, { once: true, passive: true });
      document.addEventListener('click', requestPermIfNeeded, { once: true });
    }

    try {
      const io = new IntersectionObserver((entries)=>{
        entries.forEach(e=>{
          if (!e.isIntersecting) return;
          if (pointerFine) ensurePointerTilt(); else ensureGyroTilt();
          io.disconnect();
        });
      }, { rootMargin: '200px' });
      const target = document.querySelector('.tilt-card') || document.querySelector('.faq-item-static');
      if (target) io.observe(target);
    } catch(_) { if (pointerFine) ensurePointerTilt(); else ensureGyroTilt(); }
  })();

  try {
    const pricingDetails = qs('#pricing-details');
    const pricingDetailsToggle = qs('#pricing-details-toggle');
    if (pricingDetails && pricingDetailsToggle) {
      pricingDetailsToggle.addEventListener('click', () => {
        const icon = pricingDetailsToggle.querySelector('i');
        if (pricingDetails.style.maxHeight) {
          pricingDetails.style.maxHeight = null;
          const span = pricingDetailsToggle.querySelector('span'); if (span) span.textContent = 'Entenda o porquê';
          if (icon) icon.style.transform = 'rotate(0deg)';
        } else {
          pricingDetails.style.maxHeight = pricingDetails.scrollHeight + 'px';
          const span = pricingDetailsToggle.querySelector('span'); if (span) span.textContent = 'Mostrar menos';
          if (icon) icon.style.transform = 'rotate(180deg)';
        }
      });
    }
  } catch (_) {}

  try {
    qsa('.spotlight-section').forEach(section => {
      section.addEventListener('mousemove', e => {
        const rect = section.getBoundingClientRect();
        const x = e.clientX - rect.left; const y = e.clientY - rect.top;
        section.style.setProperty('--x', `${x}px`);
        section.style.setProperty('--y', `${y}px`);
      });
    });
  } catch (_) {}
  
  function hidePaymentStatusOverlay() {
    const overlay = qs('#payment-status-overlay');
    if (!overlay) return;
    overlay.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
  }

  function showPaymentStatusOverlay(type) {
    const overlay = qs('#payment-status-overlay');
    if (!overlay) return;
    const icon = overlay.querySelector('[data-role="icon"]');
    const title = overlay.querySelector('[data-role="title"]');
    const message = overlay.querySelector('[data-role="message"]');
    const statusBox = overlay.querySelector('[data-role="status"]');
    const primaryBtn = overlay.querySelector('[data-role="primary"]');
    const secondaryBtn = overlay.querySelector('[data-role="secondary"]');

    const configs = {
      success: {
        icon: 'check-circle-2',
        iconClass: 'text-green-600',
        title: 'Pagamento aprovado!',
        message: 'Vamos te redirecionar para a plataforma. Se preferir, clique abaixo.',
        primary: {
          text: 'Ir para a plataforma',
          className: 'bg-green-600 hover:bg-green-700 text-white focus:ring-green-500',
          onClick: () => {
            hidePaymentStatusOverlay();
            try { clearPendingPayment(); } catch(_){}
            window.location.assign('/platform.html');
          }
        },
        secondary: {
          text: 'Voltar ao início',
          className: 'bg-slate-200 hover:bg-slate-300 text-slate-800 focus:ring-slate-400',
          onClick: () => {
            hidePaymentStatusOverlay();
            window.location.assign('/');
          }
        },
        statusMessage: '',
        autoRedirectMs: 4000
      },
      failure: {
        icon: 'x-circle',
        iconClass: 'text-red-600',
        title: 'Pagamento não concluído',
        message: 'Você pode tentar novamente. Caso já tenha pago, verifique seu saldo.',
        primary: {
          text: 'Comprar créditos',
          className: 'bg-green-600 hover:bg-green-700 text-white focus:ring-green-500',
          onClick: () => {
            hidePaymentStatusOverlay();
            showPaymentCard('Clique em "Comprar créditos" para finalizar sua análise.');
          }
        },
        secondary: {
          text: 'Voltar ao início',
          className: 'bg-slate-200 hover:bg-slate-300 text-slate-800 focus:ring-slate-400',
          onClick: () => {
            hidePaymentStatusOverlay();
            window.location.assign('/');
          }
        },
        statusMessage: ''
      }
    };

    const config = configs[type];
    if (!config) return;

    overlay.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');

    if (icon) {
      icon.dataset.lucide = config.icon;
      icon.className = `w-12 h-12 mx-auto mb-4 ${config.iconClass}`;
    }
    if (title) title.textContent = config.title;
    if (message) message.textContent = config.message;
    if (statusBox) {
      if (config.statusMessage) {
        statusBox.textContent = config.statusMessage;
        statusBox.classList.remove('hidden');
      } else {
        statusBox.textContent = '';
        statusBox.classList.add('hidden');
      }
    }

    if (primaryBtn) {
      primaryBtn.textContent = config.primary.text;
      primaryBtn.className = `flex-1 font-semibold py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 ${config.primary.className}`;
      primaryBtn.onclick = (evt) => { evt.preventDefault(); config.primary.onClick(); };
    }
    if (secondaryBtn) {
      secondaryBtn.textContent = config.secondary.text;
      secondaryBtn.className = `flex-1 font-semibold py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 ${config.secondary.className}`;
      secondaryBtn.onclick = (evt) => { evt.preventDefault(); config.secondary.onClick(); };
    }

    try { if (window.lucide && window.lucide.createIcons) window.lucide.createIcons(); } catch(_){}

    if (config.autoRedirectMs) {
      setTimeout(() => { try { config.primary.onClick(); } catch(_){} }, config.autoRedirectMs);
    }
  }

  (function setupPaymentStatusOverlay(){
    const overlay = qs('#payment-status-overlay');
    if (!overlay) return;
    const closeBtn = overlay.querySelector('[data-role="close"]');
    if (closeBtn) closeBtn.addEventListener('click', () => hidePaymentStatusOverlay());
    overlay.addEventListener('click', (event) => { if (event.target === overlay) hidePaymentStatusOverlay(); });
  })();

  function detectPaymentStatusFromLocation() {
    try {
      const path = (location.pathname || '').toLowerCase();
      let status = null;
      if (/payment-success/.test(path)) status = 'success';
      else if (/payment-failure/.test(path)) status = 'failure';
      else if (/payment-pending/.test(path)) status = 'pending';
      else {
        const params = new URLSearchParams(location.search || '');
        const alt = (params.get('status') || params.get('payment_status') || '').toLowerCase();
        if (alt === 'success' || alt === 'approved') status = 'success';
        else if (alt === 'pending' || alt === 'in_process') status = 'pending';
        else if (alt === 'failure' || alt === 'rejected') status = 'failure';
      }
      if (!status) return;
      if (status === 'pending') {
        showPaymentCard('Aguardando confirmação do pagamento (PIX)...');
        try { resumePaymentWatcher(true); } catch(_){}
      } else {
        showPaymentStatusOverlay(status);
      }
      try {
        const newUrl = '/' + (location.search || '') + (location.hash || '');
        window.history.replaceState(null, '', newUrl);
      } catch(_){}
    } catch(_){}
  }

  detectPaymentStatusFromLocation();

  try {
    const heroCarouselElement = qs('.hero-carousel');
    if (heroCarouselElement) {
      const autoplayObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (!swiper || !swiper.autoplay) return;
          if (entry.isIntersecting) swiper.autoplay.start(); else swiper.autoplay.stop();
        });
      }, { threshold: 0 });
      autoplayObserver.observe(heroCarouselElement);
    }
  } catch (_) {}
})();