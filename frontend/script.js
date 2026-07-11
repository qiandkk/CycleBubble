/**
 * CycleBubble V7.1 — Frontend (polish pass).
 *
 * 设计语言：
 *   - 视觉核心：呼吸 Bubble，根据近 7 天情绪动态染色（HSL 插值）
 *   - 状态机：auth → onboard? → home / record / growth / resonance
 *   - 5 屏 SPA，底部 tab 仅显示 home/growth/resonance；record 由 home CTA 进入
 *   - 颜色 token 全在 :root，JS 只改 --bubble-hue / --bubble-sat / --bubble-water-hue 等
 *
 * 改进：
 *   - 真正区分 401（跳回登录）/ 网络错误（toast）/ 业务错误（toast）
 *   - Loading skeleton + 错误态文案
 *   - About 真实 dialog
 *   - 登出入口（nav-right）
 *   - record 页保存后双按钮「再写一条 / 回今日」
 *   - 字数 near-limit (>=720) 变橙、over-limit (>=800) 变红
 *   - bubble-empty 加呼吸动画
 *   - aggre 染色算法支持中文 emotion 名 + 兜底
 *
 * 与后端契约：见 api.js。所有 fetch 经 CB_API；任何错误向上抛并 toast。
 */
(function () {
  'use strict';

  // ===========================================================================
  // 0. 情绪→HSL 染色（signature 元素）
  // ===========================================================================

  // 情绪主导色映射。hue 单位 deg；sat 是经验值，避免过饱和。
  // 兼容后端返回的中文情绪名；不在表里的情绪用 DEFAULT_HUE 兜底。
  var EMOTION_HUES = {
    '焦虑':   { h: 18,  s: 52, water: { h: 28,  s: 58 } },
    '愤怒':   { h: 0,   s: 60, water: { h: 350, s: 60 } },
    '委屈':   { h: 200, s: 30, water: { h: 210, s: 38 } },
    '低落':   { h: 220, s: 28, water: { h: 230, s: 36 } },
    '平静':   { h: 180, s: 22, water: { h: 185, s: 30 } },
    '温暖':   { h: 30,  s: 50, water: { h: 25,  s: 56 } },
    '力量':   { h: 320, s: 48, water: { h: 312, s: 52 } }
  };
  var DEFAULT_HUE = { h: 340, s: 32, water: { h: 318, s: 48 } };

  // 把最近 N 天的 emotions 聚合成一个 HSL。
  function aggregateEmotionColor(memories, windowDays) {
    windowDays = windowDays || 7;
    var cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;
    var sumX = 0, sumY = 0, totalW = 0, bestSat = DEFAULT_HUE.s, water = DEFAULT_HUE.water;
    for (var i = 0; i < memories.length; i++) {
      var m = memories[i];
      var created = new Date(m.created_at || m.createdAt || 0).getTime();
      if (!isFinite(created) || created < cutoff) continue;
      var emos = m.emotions || [];
      for (var j = 0; j < emos.length; j++) {
        var e = emos[j];
        var name = (e && e.name) ? String(e.name).trim() : '';
        var map = EMOTION_HUES[name];
        if (!map) continue;
        var w = Math.max(1, Number(e.intensity) || 1);
        var rad = map.h * Math.PI / 180;
        sumX += Math.cos(rad) * w;
        sumY += Math.sin(rad) * w;
        totalW += w;
        if (map.s > bestSat) bestSat = map.s;
        // 取最近一条的 water
        water = map.water;
      }
    }
    if (totalW === 0) return DEFAULT_HUE;
    var angle = Math.atan2(sumY, sumX) * 180 / Math.PI;
    if (angle < 0) angle += 360;
    return { h: Math.round(angle), s: bestSat, water: water };
  }

  function applyBubbleColor(theme) {
    if (!theme) theme = DEFAULT_HUE;
    var root = document.documentElement;
    root.style.setProperty('--bubble-hue', String(theme.h));
    root.style.setProperty('--bubble-sat', theme.s + '%');
    root.style.setProperty('--bubble-water-hue', String(theme.water.h));
    root.style.setProperty('--bubble-water-sat', theme.water.s + '%');
  }

  // ===========================================================================
  // 1. 工具
  // ===========================================================================
  function $(id) { return document.getElementById(id); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c];
    });
  }

  function fmtTime(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    var now = new Date();
    var diffMs = now - d;
    if (diffMs < 0) return '刚刚';
    var diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return '刚刚';
    if (diffMin < 60) return diffMin + ' 分钟前';
    var diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return diffH + ' 小时前';
    var diffD = Math.floor(diffH / 24);
    if (diffD < 7) return diffD + ' 天前';
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function showToast(msg, kind) {
    var t = $('toast');
    if (!t) return;
    t.textContent = msg;
    t.className = 'toast show' + (kind ? ' ' + kind : '');
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(function () { t.className = 'toast' + (kind ? ' ' + kind : ''); }, 2400);
  }

  function classifyError(err) {
    var msg = (err && err.message) || String(err || '未知错误');
    if (/登录已过期|重新登录/.test(msg))  return { kind: 'auth', message: msg };
    if (/账号或密码错误|密码/.test(msg))  return { kind: 'creds', message: msg };
    if (/网络无法连接|fetch|Failed to fetch|TypeError/i.test(msg)) return { kind: 'network', message: '网络无法连接到后端（检查 dev.bat 是否启动）' };
    return { kind: 'business', message: msg };
  }

  // ===========================================================================
  // 2. 屏幕切换
  // ===========================================================================
  function showScreen(name) {
    $$('.screen').forEach(function (s) { s.classList.toggle('active', s.dataset.screen === name); });
    $$('.tab').forEach(function (t) {
      t.classList.toggle('active', t.dataset.goto === name);
    });
    $('tabbar').hidden = (name === 'auth' || name === 'onboard');
    var body = document.querySelector('.screen.' + CSS.escape('screen-' + name) + ' .screen-body, .screen.' + CSS.escape('screen-' + name) + ' .home-stage, .screen.' + CSS.escape('screen-' + name) + ' .onboard-stage, .screen.' + CSS.escape('screen-' + name) + ' .auth-stage');
    if (body) body.scrollTop = 0;
  }

  // ===========================================================================
  // 3. 登录 / 注册
  // ===========================================================================
  var isRegisterMode = false;

  function setAuthMode(register) {
    isRegisterMode = register;
    var submit = $('authSubmit');
    var toggle = $('authToggle');
    var nickField = $('authNicknameField');
    submit.textContent = register ? '注册' : '登录';
    toggle.textContent = register ? '已有账号？登录' : '还没有账号？注册';
    nickField.hidden = !register;
    $('authError').textContent = '';
    if (register && nickField) {
      // 切到注册模式时自动聚焦昵称
      setTimeout(function () {
        var emailEl = $('authEmail');
        if (emailEl && emailEl.value) nickField.querySelector('input').focus();
      }, 50);
    }
  }

  function initAuth() {
    var emailEl = $('authEmail');
    var pwEl = $('authPassword');
    var nickEl = $('authNickname');
    var form = $('authForm');
    var toggle = $('authToggle');
    var quick = $('authQuick');
    var errEl = $('authError');

    toggle.addEventListener('click', function () { setAuthMode(!isRegisterMode); });

    quick.addEventListener('click', function () {
      if (isRegisterMode) setAuthMode(false);
      emailEl.value = 'demo';
      pwEl.value = 'demo';
      errEl.textContent = '';
      emailEl.focus();
    });

    form.addEventListener('submit', async function (ev) {
      ev.preventDefault();
      var email = emailEl.value.trim();
      var password = pwEl.value;
      if (!email || !password) {
        errEl.textContent = '请填写账号和密码';
        return;
      }
      if (password.length < 4) {
        errEl.textContent = '密码至少 4 位';
        return;
      }
      var submit = $('authSubmit');
      submit.disabled = true;
      var origText = submit.textContent;
      submit.textContent = isRegisterMode ? '注册中…' : '登录中…';
      errEl.textContent = '';
      try {
        if (isRegisterMode) {
          await CB_API.register(email, password, nickEl.value.trim() || undefined);
          showToast('注册成功', 'success');
        } else {
          await CB_API.login(email, password);
          showToast('欢迎回来', 'success');
        }
        await afterLogin();
      } catch (err) {
        var c = classifyError(err);
        errEl.textContent = c.message;
        showToast(c.message, c.kind === 'network' ? 'error' : '');
      } finally {
        submit.disabled = false;
        submit.textContent = origText;
      }
    });

    setAuthMode(false);
  }

  // ===========================================================================
  // 4. 登录后流程
  // ===========================================================================
  async function afterLogin() {
    var periods = null;
    try {
      periods = await CB_API.getPeriods();
    } catch (e) {
      // 网络/服务器错误：让用户先进 app，per-screen 自己处理
      console.warn('[afterLogin] periods fetch failed:', e);
    }
    var hasPeriods = periods && Array.isArray(periods.periods) && periods.periods.length > 0;
    if (!hasPeriods) {
      initOnboard();
      showScreen('onboard');
    } else {
      await enterApp();
    }
  }

  async function enterApp() {
    // 首次注册用户：播放 Bubble Genesis
    var hasSeenGenesis = false;
    try { hasSeenGenesis = localStorage.getItem('cb_genesis_seen') === '1'; } catch (e) {}

    if (!hasSeenGenesis) {
      await playGenesis();
      try { localStorage.setItem('cb_genesis_seen', '1'); } catch (e) {}
    }

    showScreen('home');
    await Promise.all([
      loadHomeData(),
      loadGrowthData(),
      loadResonanceData()
    ]);
  }

  // ===========================================================================
  // 4b. Bubble Genesis — 首次注册教育动画
  // ===========================================================================
  function playGenesis() {
    return new Promise(function (resolve) {
      var overlay = $('genesisOverlay');
      var bubble = $('genesisBubble');
      var textEl = $('genesisText');
      var particlesEl = $('genesisParticles');
      var connectionsEl = $('genesisConnections');
      var skipBtn = $('genesisSkip');

      if (!overlay) { resolve(); return; }

      // 清空粒子/连接
      particlesEl.innerHTML = '';
      connectionsEl.innerHTML = '';

      // 跳过逻辑
      var skipped = false;
      function finish() {
        if (skipped) return;
        skipped = true;
        overlay.classList.add('leaving');
        setTimeout(function () {
          overlay.hidden = true;
          overlay.classList.remove('leaving', 'phase-2', 'phase-3', 'phase-4');
          resolve();
        }, 600);
      }
      skipBtn.onclick = finish;

      // 文案切换
      function setText(t) {
        textEl.classList.add('changing');
        setTimeout(function () {
          textEl.textContent = t;
          textEl.classList.remove('changing');
        }, 400);
      }

      // 生成粒子
      function spawnParticle(x, y) {
        var p = document.createElement('span');
        p.className = 'g-particle';
        p.style.left = x + '%';
        p.style.top = y + '%';
        particlesEl.appendChild(p);
      }

      // 生成连接线
      function spawnConnection(x1, y1, x2, y2) {
        var dx = x2 - x1;
        var dy = y2 - y1;
        var len = Math.sqrt(dx * dx + dy * dy);
        var angle = Math.atan2(dy, dx) * 180 / Math.PI;
        var c = document.createElement('span');
        c.className = 'g-conn';
        c.style.left = x1 + '%';
        c.style.top = y1 + '%';
        c.style.width = len + '%';
        c.style.transform = 'rotate(' + angle + 'deg)';
        connectionsEl.appendChild(c);
      }

      // ---- 动画时间线 ----
      // Phase 1: 初始状态（0-2.5s）
      overlay.hidden = false;
      setText('每一次记录，都是了解自己的一个线索。');

      // Phase 2: 第一次记录进入（2.5s）
      setTimeout(function () {
        if (skipped) return;
        overlay.classList.add('phase-2');
        spawnParticle(50, 70);
        setText('一次体验被保存。');
      }, 2500);

      // Phase 3: 多次记录形成 Pattern（4.5s）
      setTimeout(function () {
        if (skipped) return;
        overlay.classList.add('phase-3');
        // 生成更多粒子
        var positions = [
          { x: 30, y: 40 },
          { x: 65, y: 35 },
          { x: 50, y: 55 },
          { x: 25, y: 60 },
          { x: 70, y: 60 }
        ];
        for (var i = 0; i < positions.length; i++) {
          spawnParticle(positions[i].x, positions[i].y);
        }
        // 生成连接线
        spawnConnection(30, 40, 65, 35);
        spawnConnection(65, 35, 50, 55);
        spawnConnection(50, 55, 25, 60);
        spawnConnection(25, 60, 70, 60);
        setText('相似的体验逐渐形成 Pattern。');
      }, 4500);

      // Phase 4: Bubble 形成（7s）
      setTimeout(function () {
        if (skipped) return;
        overlay.classList.add('phase-4');
        setText('你的 Bubble 会随着理解慢慢形成。');
      }, 7000);

      // 结束（9.5s）
      setTimeout(function () {
        if (skipped) return;
        // 加结束文案
        setText('开始记录，让 Bubble 慢慢认识你。');
      }, 9000);

      setTimeout(function () {
        finish();
      }, 10000);
    });
  }

  // ===========================================================================
  // 5. Onboarding（经期）
  // ===========================================================================
  function initOnboard() {
    var list = $('onboardDates');
    var addBtn = $('onboardAdd');
    var submitBtn = $('onboardSubmit');
    var skipBtn = $('onboardSkip');
    var errEl = $('onboardError');

    var LABELS = ['最近一次', '上一次', '上上次', '上上上次', '再上一次', '再上上一次'];

    function rowAt(idx) {
      var label = LABELS[idx] || ('第 ' + (idx + 1) + ' 次');
      return '<div class="onboard-row">' +
               '<label>' + label + '</label>' +
               '<input type="date" class="onboard-date-input" data-idx="' + idx + '" max="' + new Date().toISOString().slice(0,10) + '">' +
             '</div>';
    }
    list.innerHTML = rowAt(0);

    addBtn.onclick = function () {
      if (list.children.length >= 6) { showToast('最多记录 6 次'); return; }
      list.insertAdjacentHTML('beforeend', rowAt(list.children.length));
      // focus 新增的输入
      var inputs = $$('.onboard-date-input', list);
      var last = inputs[inputs.length - 1];
      if (last && last.showPicker) { try { last.showPicker(); } catch (e) { last.focus(); } }
    };

    submitBtn.onclick = async function () {
      errEl.textContent = '';
      var inputs = $$('.onboard-date-input', list);
      var filled = inputs.filter(function (i) { return i.value; });
      if (filled.length === 0) { errEl.textContent = '至少填 1 次（或点「先跳过」）'; return; }
      submitBtn.disabled = true;
      addBtn.disabled = true;
      var origText = submitBtn.textContent;
      submitBtn.textContent = '保存中…';
      try {
        for (var i = 0; i < filled.length; i++) {
          await CB_API.addPeriod(filled[i].value);
        }
        showToast('已记录 ' + filled.length + ' 次', 'success');
        await enterApp();
      } catch (err) {
        var c = classifyError(err);
        if (c.kind === 'auth') {
          showToast('登录已过期，请重新登录', 'error');
          CB_API.logout();
        } else {
          errEl.textContent = c.message;
        }
      } finally {
        submitBtn.disabled = false;
        addBtn.disabled = false;
        submitBtn.textContent = origText;
      }
    };

    skipBtn.onclick = async function () { await enterApp(); };
  }

  // ===========================================================================
  // 6. 首页
  // ===========================================================================
  var lastMemories = [];

  async function loadHomeData() {
    var bubbleEl = $('mainBubble');
    var emptyEl  = $('bubbleEmpty');
    var phaseEl  = $('bubblePhase');
    var hintEl   = $('bubbleHint');
    var narrationEl = $('growthNarration');
    var cycleEl  = $('cycleStatus');

    try {
      var res = await CB_API.getMemories();
      lastMemories = (res && res.memories) || [];
    } catch (err) {
      var c = classifyError(err);
      if (c.kind === 'auth') { CB_API.logout(); return; }
      lastMemories = [];
      cycleEl.textContent = c.kind === 'network' ? '网络连接异常' : '加载失败：' + c.message;
      cycleEl.style.color = 'var(--danger)';
    }

    // 染色
    var theme = aggregateEmotionColor(lastMemories, 7);
    applyBubbleColor(theme);

    // 周期状态
    try {
      var cs = await CB_API.getCycleStatus();
      cycleEl.style.color = '';
      cycleEl.textContent = (cs && cs.message) ? cs.message : '';
    } catch (e) {
      cycleEl.textContent = '';
    }

    if (lastMemories.length === 0) {
      bubbleEl.hidden = true;
      emptyEl.hidden = false;
      phaseEl.textContent = '';
      hintEl.textContent = '';
      narrationEl.textContent = '你的记录正在慢慢形成属于你的 Pattern。';
    } else {
      bubbleEl.hidden = false;
      emptyEl.hidden = true;
      var top = lastMemories[0];
      var mood = top.mood || (top.emotions && top.emotions[0] && top.emotions[0].name) || '在沉淀';
      phaseEl.textContent = mood;
      hintEl.textContent  = '最近记录于 ' + fmtTime(top.created_at || top.createdAt);
      narrationEl.textContent = 'Bubble 已经记住了 ' + lastMemories.length + ' 个时刻';
      if (lastMemories.length >= 3) {
        $('bubbleTexture').classList.add('visible');
        spawnParticles(8);
      }
    }
  }

  function spawnParticles(n) {
    var host = $('floatingParticles');
    if (!host || host.dataset.seeded === '1') return;
    host.dataset.seeded = '1';
    for (var i = 0; i < n; i++) {
      var s = document.createElement('span');
      s.style.left = (Math.random() * 90 + 5) + '%';
      s.style.top  = (Math.random() * 80 + 10) + '%';
      s.style.animationDelay = (Math.random() * 6) + 's';
      s.style.setProperty('--dx', (Math.random() * 40 - 20) + 'px');
      s.style.setProperty('--dy', (Math.random() * -50 - 10) + 'px');
      host.appendChild(s);
    }
  }

  // ===========================================================================
  // 7. 记录
  // ===========================================================================
  function initRecord() {
    var input = $('recordInput');
    var count = $('recordCount');
    var saveBtn = $('saveBtn');
    var settling = $('bubbleSettling');
    var settlingText = $('settlingText');
    var settlingActions = $('settlingActions');
    var actionStack = $('recordActionStack');
    var anotherBtn = $('anotherBtn');
    var backHomeBtn = $('backHomeBtn');

    function updateCount() {
      var len = input.value.length;
      count.textContent = len + ' / 800';
      count.classList.toggle('near-limit', len >= 720 && len < 800);
      count.classList.toggle('over-limit', len >= 800);
    }
    input.addEventListener('input', updateCount);

    function resetRecordUI() {
      settling.hidden = true;
      settlingActions.hidden = true;
      actionStack.hidden = false;
      input.value = '';
      input.disabled = false;
      saveBtn.disabled = false;
      updateCount();
    }

    saveBtn.addEventListener('click', async function () {
      var text = input.value.trim();
      if (!text) { showToast('写点什么吧'); input.focus(); return; }
      saveBtn.disabled = true;
      input.disabled = true;
      settling.hidden = false;
      settlingActions.hidden = true;
      actionStack.hidden = true;
      settlingText.textContent = 'Bubble 正在把今天收进记忆…';
      try {
        var res = await CB_API.createMemory(text, true);
        var insight = (res && res.insight && res.insight.reflection) || '今天的你已经留下来了。';
        settlingText.textContent = insight;
        setTimeout(function () {
          settling.hidden = true;
          settlingActions.hidden = false;
          // 危机信号检测 — 永远不阻断保存，资源 modal 主动弹出
          if (res && res.crisis && res.crisis.risk_level && res.crisis.risk_level !== 'none') {
            showCrisisModal(res.crisis);
          }
        }, 1400);
      } catch (err) {
        var c = classifyError(err);
        settling.hidden = true;
        actionStack.hidden = false;
        input.disabled = false;
        saveBtn.disabled = false;
        if (c.kind === 'auth') {
          showToast('登录已过期，请重新登录', 'error');
          CB_API.logout();
        } else {
          showToast(c.message, 'error');
        }
      }
    });

    anotherBtn.addEventListener('click', function () {
      resetRecordUI();
      input.focus();
    });

    backHomeBtn.addEventListener('click', async function () {
      resetRecordUI();
      showScreen('home');
      await loadHomeData();
      await loadGrowthData();
    });
  }

  // ===========================================================================
  // 8. 成长
  // ===========================================================================
  async function loadGrowthData() {
    var timelineEl = $('memoryTimeline');
    var patternsEl = $('patternsList');
    var headEl = $('growthHeadline');
    var subEl  = $('growthSub');
    var memSkel = $('memorySkeleton');
    var patSkel = $('patternSkeleton');

    memSkel.hidden = false;
    patSkel.hidden = false;
    timelineEl.innerHTML = '';
    patternsEl.innerHTML = '';

    var memories = [];
    try {
      var res = await CB_API.getMemories();
      memories = (res && res.memories) || [];
    } catch (err) {
      memSkel.hidden = true;
      patSkel.hidden = true;
      var c = classifyError(err);
      if (c.kind === 'auth') { CB_API.logout(); return; }
      headEl.textContent = '加载失败';
      subEl.textContent  = c.message;
      timelineEl.innerHTML = '';
      patternsEl.innerHTML = '';
      return;
    }
    memSkel.hidden = true;

    if (memories.length === 0) {
      headEl.textContent = '还没有记忆';
      subEl.textContent  = '写下第一条后，Bubble 会在这里沉积出你的模样。';
      timelineEl.innerHTML = '';
      patternsEl.innerHTML = '';
      patSkel.hidden = true;
      return;
    }

    headEl.textContent = 'Bubble 的 ' + memories.length + ' 层沉积';
    subEl.textContent  = '每一层都是你愿意被记住的一个瞬间。';

    timelineEl.innerHTML = memories.slice(0, 30).map(function (m) {
      var tags = [];
      (m.themes || []).forEach(function (t) { tags.push('<span class="tag tag--lavender">' + escapeHtml(t) + '</span>'); });
      (m.emotions || []).slice(0, 3).forEach(function (e) {
        var name = (e && e.name) ? e.name : '';
        if (name) tags.push('<span class="tag tag--petal">' + escapeHtml(name) + '</span>');
      });
      return '<article class="timeline-item">' +
               '<div class="timeline-meta">' + fmtTime(m.created_at || m.createdAt) + '</div>' +
               '<p class="timeline-text">' + escapeHtml(m.snippet || m.raw_text || m.rawText || '') + '</p>' +
               '<div class="timeline-tags">' + tags.join('') + '</div>' +
             '</article>';
    }).join('');

    // Patterns
    try {
      var pres = await CB_API.getPatterns();
      var patterns = (pres && pres.patterns) || [];
      patSkel.hidden = true;
      if (patterns.length === 0) {
        patternsEl.innerHTML = '<div class="patterns-empty">再写几条记录，Bubble 就能看到变化。</div>';
      } else {
        patternsEl.innerHTML = patterns.slice(0, 6).map(function (p) {
          return '<div class="pattern-card"><p class="pattern-text">' + escapeHtml(p.text || p.pattern || p.description || '') + '</p></div>';
        }).join('');
      }
    } catch (err) {
      patSkel.hidden = true;
      var c2 = classifyError(err);
      patternsEl.innerHTML = '<div class="patterns-empty">' + escapeHtml(c2.message) + '</div>';
    }
  }

  // ===========================================================================
  // 9. 共鸣
  // ===========================================================================
  async function loadResonanceData() {
    var feedEl = $('resonanceFeed');
    var hintEl = $('resonanceHint');
    var skel = $('resonanceSkeleton');

    feedEl.innerHTML = '';
    hintEl.textContent = '';
    hintEl.classList.remove('error');
    skel.hidden = false;

    try {
      var res = await CB_API.getResonanceFeed();
      skel.hidden = true;

      // 兼容多种返回结构
      var items = [];
      if (res) {
        if (Array.isArray(res)) items = res;
        else if (Array.isArray(res.feed))     items = res.feed;
        else if (Array.isArray(res.items))    items = res.items;
        else if (Array.isArray(res.memories)) items = res.memories;
        else if (Array.isArray(res.stories))  items = res.stories;
      }

      if (items.length === 0) {
        feedEl.innerHTML = '';
        hintEl.textContent = '等你写下的感受被更多人看到，这里会出现共鸣。';
        return;
      }

      hintEl.textContent = '';

      feedEl.innerHTML = items.map(function (m) {
        return '<article class="resonance-card" data-memory-id="' + escapeHtml(m.id) + '">' +
                 '<p class="resonance-meta">' + fmtTime(m.created_at || m.createdAt) + '</p>' +
                 '<p class="resonance-snippet">' + escapeHtml(m.snippet || m.raw_text || m.rawText || '') + '</p>' +
                 '<div class="resonance-actions">' +
                   '<button class="response-chip" data-type="empathy" type="button">🤍 我也是</button>' +
                   '<button class="response-chip" data-type="thanks"  type="button">🙏 谢谢你</button>' +
                   '<button class="response-chip" data-type="hug"     type="button">🫂 抱抱你</button>' +
                   '<button class="response-chip" data-type="share"   type="button">✎ 想说点什么</button>' +
                 '</div>' +
                 '<textarea class="response-text" placeholder="（可选）写下你想说的话…" hidden></textarea>' +
                 '<button class="response-send" type="button" hidden>送出回应</button>' +
               '</article>';
      }).join('');

      $$('.response-chip', feedEl).forEach(function (chip) {
        chip.addEventListener('click', function () {
          var card = chip.closest('.resonance-card');
          $$('.response-chip', card).forEach(function (c) { c.classList.remove('selected'); });
          chip.classList.add('selected');
          card.classList.add('selected');
          var isShare = chip.dataset.type === 'share';
          var ta = card.querySelector('.response-text');
          var sendBtn = card.querySelector('.response-send');
          ta.hidden = !isShare;
          sendBtn.hidden = false;
          sendBtn.classList.remove('sent');
          sendBtn.textContent = '送出回应';
          sendBtn.disabled = false;
          if (isShare) ta.focus();
        });
      });

      $$('.response-send', feedEl).forEach(function (btn) {
        btn.addEventListener('click', async function () {
          var card = btn.closest('.resonance-card');
          var memoryId = card.dataset.memoryId;
          var selected = card.querySelector('.response-chip.selected');
          if (!selected) { showToast('选一种回应方式'); return; }
          var type = selected.dataset.type;
          var content = (card.querySelector('.response-text') || {}).value || null;
          if (type === 'share' && content && content.trim().length > 500) {
            showToast('回应最多 500 字'); return;
          }
          btn.disabled = true;
          btn.textContent = '送出中…';
          try {
            await CB_API.createResponse(memoryId, type, type === 'share' ? (content || null) : null);
            showToast('回应已送出', 'success');
            btn.classList.add('sent');
            btn.textContent = '已回应 ✓';
            card.classList.remove('selected');
            $$('.response-chip', card).forEach(function (c) { c.classList.remove('selected'); });
          } catch (err) {
            var c2 = classifyError(err);
            if (c2.kind === 'auth') {
              showToast('登录已过期，请重新登录', 'error');
              CB_API.logout();
              return;
            }
            btn.disabled = false;
            btn.textContent = '送出回应';
            showToast(c2.message, 'error');
          }
        });
      });
    } catch (err) {
      skel.hidden = true;
      var c3 = classifyError(err);
      if (c3.kind === 'auth') { CB_API.logout(); return; }
      hintEl.classList.add('error');
      hintEl.textContent = '加载失败：' + c3.message;
      feedEl.innerHTML = '';
    }
  }

  // ===========================================================================
  // 10. Modal (About) + 登出
  // ===========================================================================
  function initModal() {
    var link = $('aboutLink');
    var modal = $('aboutModal');
    var close = $('aboutClose');
    if (!link || !modal || !close) return;
    function open()  { modal.hidden = false; }
    function closeM(){ modal.hidden = true; }
    link.addEventListener('click', open);
    close.addEventListener('click', closeM);
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeM();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !modal.hidden) closeM();
    });
  }

  // 危机信号兜底：永远不阻断保存，只在风险等级 non-none 时弹资源 modal
  function showCrisisModal(crisis) {
    var modal = $('crisisModal');
    var body  = $('crisisBody');
    var close = $('crisisClose');
    if (!modal || !body || !close) return;
    var r = crisis && crisis.resources ? crisis.resources : {};
    var hotlines = r.hotline || [];
    var textRes  = r.text || [];
    var msg = r.message || '请记得——你不必一个人面对。';

    var html = '<p class="crisis-msg">' + escapeHtml(msg) + '</p>';
    if (hotlines.length) {
      html += '<h3 class="crisis-h3">立即可拨打的热线</h3>';
      html += '<ul class="crisis-list">';
      for (var i = 0; i < hotlines.length; i++) {
        var h = hotlines[i];
        html += '<li><strong>' + escapeHtml(h.name) + '</strong>'
              + ' — <a href="tel:' + escapeHtml(h.phone) + '">' + escapeHtml(h.phone) + '</a>'
              + ' <span class="crisis-meta">' + escapeHtml(h.hours || '') + ' · ' + escapeHtml(h.region || '') + '</span></li>';
      }
      html += '</ul>';
    }
    if (textRes.length) {
      html += '<h3 class="crisis-h3">也可以在线寻求帮助</h3>';
      html += '<ul class="crisis-list">';
      for (var j = 0; j < textRes.length; j++) {
        var t = textRes[j];
        html += '<li><a href="' + escapeHtml(t.url) + '" target="_blank" rel="noopener">'
              + escapeHtml(t.name) + '</a> — <span class="crisis-meta">'
              + escapeHtml(t.desc || '') + '</span></li>';
      }
      html += '</ul>';
    }
    body.innerHTML = html;
    modal.hidden = false;

    // ESC / 点背景 / 按钮都能关
    function closeM() { modal.hidden = true; }
    close.onclick = closeM;
    modal.onclick = function (e) { if (e.target === modal) closeM(); };
    function onKey(e) { if (e.key === 'Escape' && !modal.hidden) { closeM(); document.removeEventListener('keydown', onKey); } }
    document.addEventListener('keydown', onKey);
  }

  function initLogout() {
    var btn = $('logoutLink');
    if (!btn) return;
    btn.addEventListener('click', function () {
      if (!confirm('确定要登出当前账号？')) return;
      CB_API.logout();
    });
  }

  // ===========================================================================
  // 11. 全局导航
  // ===========================================================================
  function initNav() {
    document.body.addEventListener('click', function (e) {
      var t = e.target.closest('[data-goto]');
      if (t) {
        var dest = t.dataset.goto;
        if (dest === 'record')  { showScreen('record');  $('recordInput').focus(); return; }
        if (dest === 'home')    { showScreen('home'); return; }
        if (dest === 'growth')  { showScreen('growth'); loadGrowthData(); return; }
        if (dest === 'resonance') { showScreen('resonance'); loadResonanceData(); return; }
      }
      var back = e.target.closest('[data-back]');
      if (back) {
        var dest2 = back.dataset.back || 'home';
        showScreen(dest2);
        if (dest2 === 'home') loadHomeData();
      }
    });
  }

  // ===========================================================================
  // 12. 启动
  // ===========================================================================
  async function boot() {
    initAuth();
    initRecord();
    initNav();
    initModal();
    initLogout();

    if (CB_API.isLoggedIn()) {
      try {
        await CB_API.me();
        await afterLogin();
      } catch (err) {
        var c = classifyError(err);
        if (c.kind === 'auth') {
          // token 失效：清空、回登录页
          CB_API.logout();
        } else {
          // 网络/服务器：仍保留 token 让用户能看到登录页 + 提示
          showToast('后端暂不可达：' + c.message, 'error');
        }
        showScreen('auth');
      }
    } else {
      showScreen('auth');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();