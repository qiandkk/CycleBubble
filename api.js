/**
 * CycleBubble 前端 API 客户端
 * 与 FastAPI 后端通信
 */

(function () {
  'use strict';

  // Base URL 自动适配：本地连 localhost:8000，其他用 Render
  const BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:8000'
    : 'https://cyclebubble-api.onrender.com';

  const TOKEN_KEY = 'cb_token';

  // ===== Token 管理 =====
  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }
  function setToken(token) {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  }
  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  }

  // ===== 演示模式标记 =====
  function isDemoMode() {
    try { return localStorage.getItem('cb_demo_mode') === '1'; }
    catch (e) { return false; }
  }
  function setDemoMode(on) {
    try {
      if (on) localStorage.setItem('cb_demo_mode', '1');
      else localStorage.removeItem('cb_demo_mode');
    } catch (e) {}
  }

  // ===== 通用请求封装 =====
  async function request(path, options = {}) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    const token = getToken();
    // 真实模式：附带 Bearer token
    if (token && !isDemoMode()) headers['Authorization'] = 'Bearer ' + token;
    // 演示模式：附带 X-Demo-Mode header（后端会跳过 token 校验，从 demo 库读种子）
    if (isDemoMode()) headers['X-Demo-Mode'] = '1';

    let res;
    try {
      res = await fetch(BASE + path, Object.assign({}, options, { headers: headers }));
    } catch (e) {
      throw new Error('网络错误，请检查后端服务');
    }

    if (res.status === 401) {
      clearToken();
      throw new Error('未登录或登录已过期');
    }

    let data;
    const text = await res.text();
    try {
      data = text ? JSON.parse(text) : null;
    } catch (e) {
      data = { detail: text };
    }

    if (!res.ok) {
      throw new Error((data && data.detail) ? data.detail : '请求失败');
    }
    return data;
  }

  // ===== 认证 =====
  const auth = {
    async register(email, password, nickname) {
      const data = await request('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, nickname: nickname || '' })
      });
      if (data.token) setToken(data.token);
      return data;
    },

    async login(email, password) {
      const data = await request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      if (data.token) setToken(data.token);
      return data;
    },

    async me() {
      return await request('/api/auth/me', { method: 'GET' });
    },

    logout() {
      clearToken();
    },

    isLoggedIn() {
      return !!getToken();
    }
  };

  // ===== 周期 =====
  const cycle = {
    async addPeriod(startDate, endDate, flow) {
      return await request('/api/cycle/periods', {
        method: 'POST',
        body: JSON.stringify({
          start_date: startDate,
          end_date: endDate || null,
          flow: flow || null,
          source: 'manual'
        })
      });
    },

    async importManyou(periods) {
      return await request('/api/cycle/import/manyou', {
        method: 'POST',
        body: JSON.stringify({ periods: periods })
      });
    },

    async importAppleHealth(records) {
      return await request('/api/cycle/import/apple-health', {
        method: 'POST',
        body: JSON.stringify({ records: records })
      });
    },

    async listPeriods() {
      return await request('/api/cycle/periods', { method: 'GET' });
    },

    async getStatus() {
      return await request('/api/cycle/status', { method: 'GET' });
    }
  };

  // ===== 记忆 =====
  const memory = {
    async create(rawText, isPublic) {
      return await request('/api/memories', {
        method: 'POST',
        body: JSON.stringify({
          raw_text: rawText,
          is_public: isPublic || false
        })
      });
    },

    async list(limit, offset) {
      const params = new URLSearchParams();
      if (limit) params.set('limit', limit);
      if (offset) params.set('offset', offset);
      const qs = params.toString();
      return await request('/api/memories' + (qs ? '?' + qs : ''), { method: 'GET' });
    }
  };

  // ===== 共鸣 =====
  const resonance = {
    async getFeed(limit) {
      const params = new URLSearchParams();
      if (limit) params.set('limit', limit);
      const qs = params.toString();
      return await request('/api/resonance/feed' + (qs ? '?' + qs : ''), { method: 'GET' });
    },

    async respond(memoryId, type, content) {
      return await request('/api/resonance/' + memoryId + '/respond', {
        method: 'POST',
        body: JSON.stringify({
          type: type,
          content: content || null
        })
      });
    }
  };

  // ===== 成长 =====
  const growth = {
    async get() {
      return await request('/api/growth', { method: 'GET' });
    }
  };

  // ===== 暴露到全局 =====
  window.CB_API = {
    BASE: BASE,
    auth: auth,
    cycle: cycle,
    memory: memory,
    resonance: resonance,
    growth: growth,
    getToken: getToken,
    clearToken: clearToken,
    isDemoMode: isDemoMode,
    setDemoMode: setDemoMode
  };
})();
