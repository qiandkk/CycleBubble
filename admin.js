/**
 * CycleBubble Admin 后台客户端
 *
 * - 登录态：localStorage `cb_admin_token`
 * - 调用 /admin/* 接口，header: Authorization: Bearer <token>
 * - Base URL：与主前端一致，遵循 window.__API_BASE__ 覆盖
 */
(function () {
  'use strict';

  const BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? (window.__ADMIN_API_BASE__ || 'http://localhost:8000')
    : (window.__API_BASE__ !== undefined ? window.__API_BASE__ : '');

  const TOKEN_KEY = 'cb_admin_token';
  const USER_KEY = 'cb_admin_username';

  function getToken() { return localStorage.getItem(TOKEN_KEY); }
  function setToken(t) { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); }
  function getUser() { return localStorage.getItem(USER_KEY) || 'admin'; }

  async function request(path, options) {
    options = options || {};
    const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    const token = getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;

    let res;
    try {
      res = await fetch(BASE + path, Object.assign({}, options, { headers: headers }));
    } catch (e) {
      throw new Error('网络错误，请检查后端服务');
    }
    if (res.status === 401) {
      setToken(null);
      showLogin();
      throw new Error('登录已过期');
    }
    const text = await res.text();
    let data;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = { detail: text }; }
    if (!res.ok) {
      // FastAPI 422 校验错误时 detail 是数组，必须提取 msg 拼成字符串
      var detailx = (data && data.detail) || null;
      var errorMsg = 'HTTP ' + res.status;
      if (detailx) {
        if (typeof detailx === 'string') {
          errorMsg = detailx;
        } else if (Array.isArray(detailx)) {
          var msgs = [];
          for (var di = 0; di < detailx.length; di++) {
            if (detailx[di] && detailx[di].msg) msgs.push(detailx[di].msg);
          }
          errorMsg = msgs.length > 0 ? msgs.join('；') : errorMsg;
        } else if (typeof detailx === 'object') {
          errorMsg = detailx.msg || detailx.message || errorMsg;
        }
      }
      throw new Error(errorMsg);
    }
    return data;
  }

  function showScreen(name) {
    var screens = document.querySelectorAll('.screen');
    for (var i = 0; i < screens.length; i++) screens[i].classList.remove('active');
    var target = document.querySelector('.screen[data-screen="' + name + '"]');
    if (target) target.classList.add('active');
  }

  function showLogin() {
    showScreen('admin-login');
  }

  function showApp() {
    showScreen('admin-app');
    var nameEl = document.getElementById('adminSignedName');
    if (nameEl) nameEl.textContent = getUser();
    loadStats();
    loadReports();
    loadAudit();
    loadAiSettings();
  }

  function showError(id, message) {
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent = message || '';
    el.hidden = !message;
  }

  // ===== 登录 =====
  var loginForm = document.getElementById('adminLoginForm');
  if (loginForm) loginForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    showError('adminLoginError', '');
    var username = document.getElementById('adminUsername').value.trim();
    var password = document.getElementById('adminPassword').value;
    var btn = document.getElementById('adminLoginBtn');
    btn.disabled = true;
    try {
      var data = await request('/admin/login', {
        method: 'POST',
        body: JSON.stringify({ username: username, password: password }),
      });
      setToken(data.token);
      localStorage.setItem(USER_KEY, data.username || username);
      showApp();
    } catch (err) {
      showError('adminLoginError', err.message || '登录失败');
    } finally {
      btn.disabled = false;
    }
  });

  var logoutBtn = document.getElementById('adminLogoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', function () {
    setToken(null);
    localStorage.removeItem(USER_KEY);
    showLogin();
  });

  // ===== 数据概览 =====
  async function loadStats() {
    try {
      var data = await request('/admin/stats');
      document.getElementById('statUsers').textContent = (data.users && data.users.total) || 0;
      document.getElementById('statActive7d').textContent = (data.users && data.users.active_7d) || 0;
      document.getElementById('statMemories').textContent = (data.memories && data.memories.total) || 0;
      document.getElementById('statPublic').textContent = (data.memories && data.memories.public) || 0;
      document.getElementById('statSensitive').textContent = (data.memories && data.memories.sensitive) || 0;
      document.getElementById('statCycles').textContent = data.cycles || 0;
      document.getElementById('statReportsOpen').textContent = (data.reports && data.reports.open) || 0;
    } catch (e) {
      console.warn('加载概览失败:', e);
    }
  }

  var refreshStatsBtn = document.getElementById('refreshStatsBtn');
  if (refreshStatsBtn) refreshStatsBtn.addEventListener('click', loadStats);

  // ===== 举报队列 =====
  var currentReportId = null;

  async function loadReports() {
    try {
      var data = await request('/admin/reports?status_filter=open&page=1&page_size=20');
      var list = document.getElementById('adminReportsList');
      var empty = document.getElementById('adminReportsEmpty');
      list.textContent = '';
      if (!data.reports || data.reports.length === 0) {
        empty.hidden = false;
        return;
      }
      empty.hidden = true;
      data.reports.forEach(function (r) {
        var card = document.createElement('div');
        card.className = 'admin-report-card';
        var meta = document.createElement('div');
        meta.className = 'admin-report-meta';
        meta.textContent = '#' + r.id + ' · ' + r.reason + ' · 记忆 ' + r.memory_id + ' · ' + r.created_at;
        var btn = document.createElement('button');
        btn.className = 'btn-link';
        btn.type = 'button';
        btn.textContent = '查看';
        btn.addEventListener('click', function () { openReport(r.id); });
        card.appendChild(meta);
        card.appendChild(btn);
        list.appendChild(card);
      });
    } catch (e) {
      console.warn('加载举报失败:', e);
    }
  }

  async function openReport(reportId) {
    currentReportId = reportId;
    try {
      var r = await request('/admin/reports/' + reportId);
      var detail = document.getElementById('adminReportDetail');
      detail.textContent = '';
      function row(label, value) {
        var p = document.createElement('p');
        p.className = 'admin-detail-row';
        var s = document.createElement('span'); s.textContent = label;
        var v = document.createElement('span'); v.textContent = value == null ? '' : String(value);
        p.appendChild(s); p.appendChild(v);
        detail.appendChild(p);
      }
      row('举报 #', r.id);
      row('举报人', (r.reporter_nickname || '') + ' (' + r.reporter_user_id + ')');
      row('原因', r.reason);
      row('备注', r.note || '');
      row('状态', r.status);
      row('时间', r.created_at);
      if (r.memory) {
        row('记忆 ID', r.memory.id);
        row('记忆内容', r.memory.raw_text);
        row('情绪', r.memory.mood);
        row('公开', r.memory.is_public ? '是' : '否');
        row('敏感', r.memory.is_sensitive ? '是' : '否');
      }
      document.getElementById('adminReportDetailSection').hidden = false;
    } catch (e) {
      console.warn('打开举报失败:', e);
    }
  }

  var dismissBtn = document.getElementById('dismissReportBtn');
  if (dismissBtn) dismissBtn.addEventListener('click', async function () {
    if (!currentReportId) return;
    try {
      await request('/admin/reports/' + currentReportId + '/action', {
        method: 'POST',
        body: JSON.stringify({ action: 'dismiss' }),
      });
      document.getElementById('adminReportDetailSection').hidden = true;
      loadReports();
      loadStats();
    } catch (e) {
      alert(e.message || '操作失败');
    }
  });

  var deleteBtn = document.getElementById('deleteMemoryBtn');
  if (deleteBtn) deleteBtn.addEventListener('click', async function () {
    if (!currentReportId) return;
    if (!window.confirm('确认删除该记忆并核结举报？此操作不可撤销。')) return;
    try {
      await request('/admin/reports/' + currentReportId + '/action', {
        method: 'POST',
        body: JSON.stringify({ action: 'delete_memory' }),
      });
      document.getElementById('adminReportDetailSection').hidden = true;
      loadReports();
      loadStats();
    } catch (e) {
      alert(e.message || '操作失败');
    }
  });

  var closeDetailBtn = document.getElementById('closeReportDetailBtn');
  if (closeDetailBtn) closeDetailBtn.addEventListener('click', function () {
    document.getElementById('adminReportDetailSection').hidden = true;
  });

  // ===== 一次性访问令牌 =====
  var accessForm = document.getElementById('adminAccessForm');
  if (accessForm) accessForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    var memoryId = parseInt(document.getElementById('adminAccessMemoryId').value || '0', 10);
    var reason = document.getElementById('adminAccessReason').value.trim();
    if (!memoryId || reason.length < 10) {
      alert('请提供记忆 ID 和至少 10 字的理由');
      return;
    }
    try {
      var token = await request('/admin/memory-access-tokens', {
        method: 'POST',
        body: JSON.stringify({ memory_id: memoryId, reason: reason }),
      });
      var result = document.getElementById('adminAccessResult');
      result.hidden = false;
      result.innerHTML = '<p class="admin-access-info">令牌（10 分钟内、一次访问有效）：</p><pre class="admin-access-token">' + token.access_token + '</pre>' +
        '<button class="btn-primary" type="button" id="adminAccessUseBtn">立即用此令牌查看</button>';
      document.getElementById('adminAccessUseBtn').addEventListener('click', async function () {
        try {
          var data = await request('/admin/memories/' + memoryId + '?access_token=' + encodeURIComponent(token.access_token));
          result.innerHTML += '<pre class="admin-access-content">' + JSON.stringify(data, null, 2) + '</pre>';
        } catch (e) {
          alert(e.message || '访问失败');
        }
      });
    } catch (e) {
      alert(e.message || '签发失败');
    }
  });

  // ===== AI 设置 =====
  async function loadAiSettings() {
    try {
      var data = await request('/admin/ai/settings');
      document.getElementById('aiDefaultProvider').value = data.default_provider;
      document.getElementById('aiMinimaxModel').value = data.minimax_model;
      document.getElementById('aiDeepseekModel').value = data.deepseek_model;
      document.getElementById('aiEnableThirdParty').checked = data.enable_third_party_ai;
      document.getElementById('aiEnableKeywordFallback').checked = data.enable_keyword_fallback;
      var status = document.getElementById('aiStatus');
      status.textContent = '当前 minimax key: ' + (data.has_minimax_key ? data.minimax_api_key_masked : '未配置') +
        ' · deepseek key: ' + (data.has_deepseek_key ? data.deepseek_api_key_masked : '未配置');
    } catch (e) {
      console.warn('加载 AI 设置失败:', e);
    }
  }

  var aiForm = document.getElementById('adminAiForm');
  if (aiForm) aiForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    var payload = {
      default_provider: document.getElementById('aiDefaultProvider').value,
      minimax_model: document.getElementById('aiMinimaxModel').value,
      deepseek_model: document.getElementById('aiDeepseekModel').value,
      enable_third_party_ai: document.getElementById('aiEnableThirdParty').checked,
      enable_keyword_fallback: document.getElementById('aiEnableKeywordFallback').checked,
      minimax_api_key: document.getElementById('aiMinimaxKey').value || null,
      deepseek_api_key: document.getElementById('aiDeepseekKey').value || null,
    };
    try {
      await request('/admin/ai/settings', { method: 'PUT', body: JSON.stringify(payload) });
      document.getElementById('aiMinimaxKey').value = '';
      document.getElementById('aiDeepseekKey').value = '';
      loadAiSettings();
      alert('设置已保存');
    } catch (err) {
      alert(err.message || '保存失败');
    }
  });

  var aiTestBtn = document.getElementById('aiTestBtn');
  if (aiTestBtn) aiTestBtn.addEventListener('click', async function () {
    var status = document.getElementById('aiStatus');
    status.textContent = '测试中...';
    try {
      var r = await request('/admin/ai/test', { method: 'POST' });
      // 新结构：{ ok, primary_provider, providers: { minimax: {...}, deepseek: {...} } }
      // 兼容旧结构：{ ok, provider, model, latency_ms }
      var providers = r.providers || (r.provider ? { [r.provider]: r } : null);
      if (!providers) {
        status.textContent = '❌ ' + (r.error || '返回结构异常');
        return;
      }
      var parts = [];
      var anyOk = false;
      Object.keys(providers).forEach(function (pname) {
        var p = providers[pname];
        if (p.ok) {
          anyOk = true;
          parts.push(pname + ' ✅ ' + p.latency_ms + 'ms (' + p.model + ')');
        } else {
          parts.push(pname + ' ❌ ' + (p.error || p.status_code || '失败'));
        }
      });
      var tag = r.primary_provider ? ' [主: ' + r.primary_provider + ']' : '';
      status.textContent = (anyOk ? '✅ ' : '❌ ') + tag + ' ' + parts.join(' · ');
    } catch (e) {
      status.textContent = '❌ ' + (e.message || '测试失败');
    }
  });

  // ===== 审计 =====
  async function loadAudit() {
    try {
      var data = await request('/admin/audit?page=1&page_size=20');
      var box = document.getElementById('adminAudit');
      box.textContent = '';
      if (!data.entries || data.entries.length === 0) {
        box.textContent = '暂无审计记录。';
        return;
      }
      data.entries.forEach(function (e) {
        var p = document.createElement('p');
        p.className = 'admin-audit-row';
        p.textContent = '[' + e.timestamp + '] ' + e.admin_username + ' · ' + e.action + ' · ' + e.target + (e.reason ? ' · ' + e.reason : '');
        box.appendChild(p);
      });
    } catch (e) {
      console.warn('加载审计失败:', e);
    }
  }

  // 启动：已登录则直接进后台，否则显示登录
  if (getToken()) {
    showApp();
  } else {
    showLogin();
  }
})();