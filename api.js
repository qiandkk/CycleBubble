/**
 * CycleBubble API 客户端 — 与后端 REST 接口对接
 * 约定：
 *   - 本地开发连 http://localhost:8765 (dev.ps1 端口)
 *   - 线上连 Render 后端 (cyclebubble-api.onrender.com)
 *   - 任何 401 自动清 token，由前端决定是否回到登录页
 */
(function () {
  'use strict';

  var BASE;
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    BASE = 'http://localhost:8765';
  } else {
    BASE = 'https://cyclebubble-api.onrender.com';
  }

  var TOKEN_KEY = 'cb_token';
  var USER_KEY  = 'cb_user';

  // ---------- Token helpers ----------
  function getToken() {
    try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; }
  }
  function setToken(t) {
    try { localStorage.setItem(TOKEN_KEY, t); } catch (e) {}
  }
  function setUser(u) {
    try { localStorage.setItem(USER_KEY, JSON.stringify(u)); } catch (e) {}
  }
  function getUser() {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch (e) { return null; }
  }
  function clearAuth() {
    try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); } catch (e) {}
  }
  function isLoggedIn() { return !!getToken(); }

  // ---------- Core request ----------
  async function request(method, path, body) {
    var headers = { 'Content-Type': 'application/json' };
    var token = getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;

    var opts = { method: method, headers: headers };
    if (body !== undefined && body !== null) opts.body = JSON.stringify(body);

    var res;
    try {
      res = await fetch(BASE + path, opts);
    } catch (netErr) {
      throw new Error('网络无法连接到 ' + BASE + '（检查 dev 服务是否启动）');
    }

    if (res.status === 401) {
      clearAuth();
      throw new Error('未登录或登录已过期');
    }

    var data = null;
    try { data = await res.json(); } catch (e) { data = null; }

    if (!res.ok) {
      // FastAPI default 错误结构: { detail: "..." } 或 { detail: [{msg, loc}] }
      var msg = '请求失败';
      if (data) {
        if (typeof data.detail === 'string') msg = data.detail;
        else if (Array.isArray(data.detail) && data.detail[0] && data.detail[0].msg) msg = data.detail[0].msg;
      }
      throw new Error(msg);
    }
    return data;
  }

  // ---------- Auth ----------
  async function register(email, password, nickname) {
    var body = { email: email, password: password };
    if (nickname) body.nickname = nickname;
    var data = await request('POST', '/api/auth/register', body);
    setToken(data.token);
    setUser(data.user);
    return data;
  }
  async function login(email, password) {
    var data = await request('POST', '/api/auth/login', { email: email, password: password });
    setToken(data.token);
    setUser(data.user);
    return data;
  }
  async function me() {
    return request('GET', '/api/auth/me');
  }
  function logout() {
    clearAuth();
    window.location.reload();
  }

  // ---------- Memory ----------
  async function createMemory(rawText, isPublic) {
    return request('POST', '/api/memories', {
      raw_text: rawText,
      is_public: !!isPublic
    });
  }
  async function getMemories() {
    return request('GET', '/api/memories');
  }

  // ---------- Pattern + Bubble ----------
  async function getPatterns() {
    return request('GET', '/api/patterns');
  }
  async function getBubbleState() {
    return request('GET', '/api/bubble-state');
  }

  // ---------- Growth ----------
  async function getGrowth() {
    return request('GET', '/api/growth');
  }

  // ---------- Resonance ----------
  async function getResonanceFeed() {
    return request('GET', '/api/resonance/feed');
  }
  async function createResponse(memoryId, responseType, content) {
    return request('POST', '/api/resonance/' + memoryId + '/responses', {
      response_type: responseType,
      content: content || null
    });
  }

  // ---------- Cycle ----------
  async function addPeriod(periodStart, periodEnd) {
    var body = { period_start: periodStart };
    if (periodEnd) body.period_end = periodEnd;
    return request('POST', '/api/cycle/periods', body);
  }
  async function getCycleStatus() {
    return request('GET', '/api/cycle/status');
  }
  async function getPeriods() {
    return request('GET', '/api/cycle/periods');
  }

  window.CB_API = {
    BASE: BASE,
    isLoggedIn: isLoggedIn,
    getToken: getToken,
    getUser: getUser,
    register: register,
    login: login,
    me: me,
    logout: logout,
    createMemory: createMemory,
    getMemories: getMemories,
    getPatterns: getPatterns,
    getBubbleState: getBubbleState,
    getGrowth: getGrowth,
    getResonanceFeed: getResonanceFeed,
    createResponse: createResponse,
    addPeriod: addPeriod,
    getCycleStatus: getCycleStatus,
    getPeriods: getPeriods
  };
})();