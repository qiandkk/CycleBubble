/**
 * CycleBubble 前端 API 客户端
 * 与 FastAPI 后端通信
 */

(function () {
  'use strict';

  // Base URL 自动适配：
  // 1. localhost/127.0.0.1 本地开发 → http://localhost:8000
  // 2. 部署环境默认同源（用 Nginx 反代 /api/，零配置）
  // 3. 可被 window.__API_BASE__ 显式覆盖（Render 等跨域部署场景）
  const BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:8000'
    : (window.__API_BASE__ !== undefined ? window.__API_BASE__ : '');

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
  function authHeaders(options, forceReal) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, (options && options.headers) || {});
    const token = getToken();
    // 真实模式：附带 Bearer token
    if (token && !isDemoMode()) headers['Authorization'] = 'Bearer ' + token;
    // 演示模式：附带 X-Demo-Mode header（后端会跳过 token 校验，从 demo 库读种子）
    // 但被 forceReal 强制时（如注册/登录），不能带这个 header，否则会写错库
    if (isDemoMode() && !forceReal) headers['X-Demo-Mode'] = '1';
    return headers;
  }

  async function request(path, options = {}) {
    // 内部标记：__force_real=true 时即使在 demo 模式也不带 X-Demo-Mode header
    // （注册/登录/获取 token 必须走真实库）
    const forceReal = !!options.__force_real;
    const headers = authHeaders(options, forceReal);

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
      // FastAPI 422 校验错误时 detail 是数组（[{loc, msg, type}, ...]），
      // 必须提取 msg 字段拼成字符串，否则 new Error(数组) → "[object Object]"
      var detail = (data && data.detail) || null;
      var errorMsg = '请求失败';
      if (detail) {
        if (typeof detail === 'string') {
          errorMsg = detail;
        } else if (Array.isArray(detail)) {
          // 提取每个校验错误的 msg（取第一个非空的）
          var msgs = [];
          for (var di = 0; di < detail.length; di++) {
            if (detail[di] && detail[di].msg) msgs.push(detail[di].msg);
          }
          errorMsg = msgs.length > 0 ? msgs.join('；') : '请求数据格式有误';
        } else if (typeof detail === 'object') {
          errorMsg = detail.msg || detail.message || JSON.stringify(detail);
        }
      }
      throw new Error(errorMsg);
    }
    return data;
  }

  // ===== 认证 =====
  const auth = {
    async register(email, password, nickname) {
      // 注册/登录必须强制真实模式，避免 demo 标记残留导致写错库。
      // 显式传 __force_real：true 走 noDemo 通道，request 会忽略 X-Demo-Mode。
      const data = await request('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, nickname: nickname || '' }),
        __force_real: true
      });
      if (data.token) {
        setToken(data.token);
        // 注册成功后立即清除 demo 标记，确保后续所有请求走真实库
        setDemoMode(false);
      }
      return data;
    },

    async login(email, password) {
      const data = await request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
        __force_real: true
      });
      if (data.token) {
        setToken(data.token);
        setDemoMode(false);
      }
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
    },

    async updatePeriod(periodId, fields) {
      return await request('/api/cycle/periods/' + periodId, {
        method: 'PATCH',
        body: JSON.stringify(fields)
      });
    },

    async deletePeriod(periodId) {
      return await request('/api/cycle/periods/' + periodId, { method: 'DELETE' });
    }
  };

  async function download(path) {
    let res;
    try {
      res = await fetch(BASE + path, { method: 'GET', headers: authHeaders() });
    } catch (e) {
      throw new Error('网络错误，请检查后端服务');
    }
    if (res.status === 401) {
      clearToken();
      throw new Error('未登录或登录已过期');
    }
    if (!res.ok) {
      let detail = '下载失败';
      try {
        const body = await res.json();
        detail = body.detail || detail;
      } catch (e) {}
      throw new Error(detail);
    }
    const disposition = res.headers.get('Content-Disposition') || '';
    const matched = disposition.match(/filename="?([^";]+)"?/i);
    const filename = matched ? matched[1] : 'cyclebubble-data';
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 0);
  }

  const profile = {
    async summary() {
      return await request('/api/profile/summary', { method: 'GET' });
    },

    async exportJson() {
      return await download('/api/profile/export/json');
    },

    async exportHtml() {
      return await download('/api/profile/export/html');
    },

    async deleteAccount(password, acknowledged) {
      return await request('/api/profile/account', {
        method: 'DELETE',
        body: JSON.stringify({ password: password, acknowledged: acknowledged })
      });
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
    },
    async getBubbleParams() {
      return await request('/api/growth/bubble-params', { method: 'GET' });
    }
  };

  // ===== 举报 =====
  const reports = {
    async create(memoryId, reason, note) {
      return await request('/api/reports', {
        method: 'POST',
        body: JSON.stringify({
          memory_id: memoryId,
          reason: reason,
          note: note || ''
        })
      });
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
    profile: profile,
    reports: reports,
    getToken: getToken,
    clearToken: clearToken,
    isDemoMode: isDemoMode,
    setDemoMode: setDemoMode
  };
})();
