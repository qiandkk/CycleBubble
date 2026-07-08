/**
 * CycleBubble V7 — Frontend rewritten via frontend-design process.
 *
 * 设计语言：
 *   - 视觉核心：呼吸 Bubble，根据近 7 天情绪动态染色（HSL 插值）
 *   - 状态机：auth → onboard? → home / record / growth / resonance
 *   - 5 屏 SPA，底部 tab 仅显示 home/growth/resonance；record 由 home CTA 进入
 *   - 颜色 token 全在 :root，JS 只改 --bubble-hue / --bubble-sat / --bubble-water-hue 等
 *
 * 与后端契约：见 api.js。所有 fetch 经 CB_API；任何错误向上抛并 toast。
 */
(function () {
  'use strict';

  // ===========================================================================
  // 0. 情绪→HSL 染色（signature 元素）
  // ===========================================================================

  // 情绪主导色映射。hue 单位 deg；sat/light 是经验值，避免过饱和。
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
  // 规则：每条记忆按 intensity 加权求 hue 的 sin/cos 平均，再 arctan2 出角度；
  //       sat 取最高（情绪强烈 → 颜色饱和）；water hue 跟随主情绪的水相。
  function aggregateEmotionColor(memories, windowDays) {
    windowDays = windowDays || 7;
    var cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;
    var sumX = 0, sumY = 0, totalW = 0, bestSat = DEFAULT_HUE.s, water = DEFAULT_HUE.water;
    for (var i = 0; i < memories.length; i++) {
      var m = memories[i];
      if (new Date(m.created_at || m.createdAt || 0).getTime() < cutoff) continue;
      var emos = m.emotions || [];
      for (var j = 0; j < emos.length; j++) {
        var e = emos[j];
        var map = EMOTION_HUES[e.name];
        if (!map) continue;
        var w = Math.max(1, e.intensity || 1);
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
    var diffMin = Math.floor((now - d) / 60000);
    if (diffMin < 1) return '刚刚';
    if (diffMin < 60) return diffMin + ' 分钟前';
    var diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return diffH + ' 小时前';
    var diffD = Math.floor(diffH / 24);
    if (diffD < 7) return diffD + ' 天前';
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function showToast(msg) {
    var t = $('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }

  // ===========================================================================
  // 2. 屏幕切换
  // ===========================================================================
  function showScreen(name) {
    $$('.screen').forEach(function (s) { s.classList.toggle('active', s.dataset.screen === name); });
    $$('.tab').forEach(function (t) {
      var active = t.dataset.goto === name;
      t.classList.toggle('active', active);
    });
    $('tabbar').hidden = (name === 'auth' || name === 'onboard');
    // 滚到顶
    var body = document.querySelector('.screen.' + CSS.escape('screen-' + name) + ' .screen-body');
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
      var submit = $('authSubmit');
      submit.disabled = true;
      var origText = submit.textContent;
      submit.textContent = isRegisterMode ? '注册中…' : '登录中…';
      try {
        if (isRegisterMode) {
          await CB_API.register(email, password, nickEl.value.trim() || undefined);
        } else {
          await CB_API.login(email, password);
        }
        errEl.textContent = '';
        await afterLogin();
      } catch (err) {
        errEl.textContent = err.message || '操作失败';
      } finally {
        submit.disabled = false;
        submit.textContent = origText;
      }
    });

    setAuthMode(false);
  }

  // ===========================================================================
  // 4. 登录后流程：判断是否需要 onboarding → 进首页
  // ===========================================================================
  async function afterLogin() {
    // 拉一次 cycle status 看是否有经期数据
    var cycle, periods;
    try {
      cycle = await CB_API.getCycleStatus();
      periods = await CB_API.getPeriods();
    } catch (e) { /* 静默 */ }
    if (!periods || !periods.periods || periods.periods.length === 0) {
      initOnboard();
      showScreen('onboard');
    } else {
      await enterApp();
    }
  }

  async function enterApp() {
    showScreen('home');
    await Promise.all([
      loadHomeData(),
      loadGrowthData(),
      loadResonanceData()
    ]);
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

    function rowAt(idx) {
      var labels = ['最近一次', '上一次', '上上次', '上上上次'];
      var label = labels[idx] || ('第 ' + (idx + 1) + ' 次');
      return '<div class="onboard-row">' +
               '<label>' + label + '</label>' +
               '<input type="date" class="onboard-date-input" data-idx="' + idx + '">' +
             '</div>';
    }
    function render() {
      var count = Math.max(1, list.children.length);
      while (list.children.length < count) list.insertAdjacentHTML('beforeend', rowAt(list.children.length));
    }
    list.innerHTML = rowAt(0);
    addBtn.onclick = function () {
      if (list.children.length >= 6) { showToast('最多记录 6 次'); return; }
      list.insertAdjacentHTML('beforeend', rowAt(list.children.length));
    };
    submitBtn.onclick = async function () {
      errEl.textContent = '';
      var inputs = $$('.onboard-date-input', list);
      var filled = inputs.filter(function (i) { return i.value; });
      if (filled.length === 0) { errEl.textContent = '至少填 1 次（或点「先跳过」）'; return; }
      submitBtn.disabled = true;
      try {
        for (var i = 0; i < filled.length; i++) {
          await CB_API.addPeriod(filled[i].value);
        }
        showToast('已记录 ' + filled.length + ' 次');
        await enterApp();
      } catch (err) {
        errEl.textContent = err.message || '保存失败';
      } finally {
        submitBtn.disabled = false;
      }
    };
    skipBtn.onclick = async function () { await enterApp(); };
  }

  // ===========================================================================
  // 6. 首页
  // ===========================================================================
  var lastMemories = [];

  async function loadHomeData() {
    try {
      var res = await CB_API.getMemories();
      lastMemories = (res && res.memories) || [];
    } catch (e) { lastMemories = []; }

    // 染色
    var theme = aggregateEmotionColor(lastMemories, 7);
    applyBubbleColor(theme);

    // 周期状态
    try {
      var cs = await CB_API.getCycleStatus();
      $('cycleStatus').textContent = cs && cs.message ? cs.message : '周期数据收集中';
    } catch (e) {
      $('cycleStatus').textContent = '';
    }

    // Bubble 或空态
    var bubbleEl = $('mainBubble');
    var emptyEl  = $('bubbleEmpty');
    var phaseEl  = $('bubblePhase');
    var hintEl   = $('bubbleHint');
    var narrationEl = $('growthNarration');
    var emptyHintEl = $('bubbleEmptyHint');

    if (lastMemories.length === 0) {
      bubbleEl.hidden = true;
      emptyEl.hidden = false;
      phaseEl.textContent = '';
      hintEl.textContent = '';
      narrationEl.textContent = '';
      emptyHintEl.textContent = '点下方按钮写下第一条';
    } else {
      bubbleEl.hidden = false;
      emptyEl.hidden = true;
      // 取最近一条主导情绪
      var top = lastMemories[0];
      var mood = top.mood || (top.emotions && top.emotions[0] && top.emotions[0].name) || '在沉淀';
      phaseEl.textContent = mood;
      hintEl.textContent  = '最近记录于 ' + fmtTime(top.created_at || top.createdAt);
      narrationEl.textContent = 'Bubble 已经记住了 ' + lastMemories.length + ' 个时刻';
      // 第一条记录触发纹理出现
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

    input.addEventListener('input', function () {
      count.textContent = input.value.length + ' / 800';
    });

    saveBtn.addEventListener('click', async function () {
      var text = input.value.trim();
      if (!text) { showToast('写点什么吧'); input.focus(); return; }
      saveBtn.disabled = true;
      input.disabled = true;
      settling.hidden = false;
      settlingText.textContent = 'Bubble 正在把今天收进记忆…';
      try {
        var res = await CB_API.createMemory(text, true);
        var insight = (res && res.insight && res.insight.reflection) || '今天的你已经留下来了。';
        settlingText.textContent = insight;
        setTimeout(async function () {
          settling.hidden = true;
          input.value = '';
          count.textContent = '0 / 800';
          input.disabled = false;
          saveBtn.disabled = false;
          showScreen('home');
          await loadHomeData();
          await loadGrowthData();
        }, 1600);
      } catch (err) {
        settling.hidden = true;
        input.disabled = false;
        saveBtn.disabled = false;
        showToast(err.message || '保存失败');
      }
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

    var memories = [];
    try {
      var res = await CB_API.getMemories();
      memories = (res && res.memories) || [];
    } catch (e) {}

    if (memories.length === 0) {
      headEl.textContent = '还没有记忆';
      subEl.textContent  = '写下第一条后，Bubble 会在这里沉积出你的模样。';
      timelineEl.innerHTML = '';
      patternsEl.innerHTML = '';
      return;
    }

    headEl.textContent = 'Bubble 的 ' + memories.length + ' 层沉积';
    subEl.textContent  = '每一层都是你愿意被记住的一个瞬间。';

    timelineEl.innerHTML = memories.slice(0, 20).map(function (m) {
      var tags = [];
      (m.themes || []).forEach(function (t) { tags.push('<span class="tag tag--lavender">' + escapeHtml(t) + '</span>'); });
      (m.emotions || []).slice(0, 3).forEach(function (e) {
        tags.push('<span class="tag tag--petal">' + escapeHtml(e.name) + '</span>');
      });
      return '<article class="timeline-item">' +
               '<div class="timeline-meta">' + fmtTime(m.created_at || m.createdAt) + '</div>' +
               '<p class="timeline-text">' + escapeHtml(m.snippet || m.raw_text || m.rawText || '') + '</p>' +
               '<div class="timeline-tags">' + tags.join('') + '</div>' +
             '</article>';
    }).join('');

    // Patterns（直接调 /api/patterns）
    try {
      var pres = await CB_API.getPatterns();
      var patterns = (pres && pres.patterns) || [];
      if (patterns.length === 0) {
        patternsEl.innerHTML = '<p class="pattern-text">再写几条记录，Bubble 就能看到变化。</p>';
      } else {
        patternsEl.innerHTML = patterns.slice(0, 5).map(function (p) {
          return '<div class="pattern-card"><p class="pattern-text">' + escapeHtml(p.text || p.pattern || '') + '</p></div>';
        }).join('');
      }
    } catch (e) {
      patternsEl.innerHTML = '';
    }
  }

  // ===========================================================================
  // 9. 共鸣
  // ===========================================================================
  async function loadResonanceData() {
    var feedEl = $('resonanceFeed');
    var hintEl = $('resonanceHint');
    feedEl.innerHTML = '<p class="resonance-hint">正在加载…</p>';
    try {
      var res = await CB_API.getResonanceFeed();
      var items = (res && res.feed) || (res && res.items) || (Array.isArray(res) ? res : []);
      if (items.length === 0) {
        feedEl.innerHTML = '';
        hintEl.textContent = '等你写下的感受被更多人看到，这里会出现共鸣。';
        return;
      }
      hintEl.textContent = '';
      feedEl.innerHTML = items.map(function (m) {
        return '<article class="resonance-card" data-memory-id="' + escapeHtml(m.id) + '">' +
                 '<p class="resonance-snippet">' + escapeHtml(m.snippet || m.raw_text || m.rawText || '') + '</p>' +
                 '<div class="resonance-actions">' +
                   '<button class="response-chip" data-type="empathy">🤍 我也是</button>' +
                   '<button class="response-chip" data-type="thanks">🙏 谢谢你</button>' +
                   '<button class="response-chip" data-type="hug">🫂 抱抱你</button>' +
                   '<button class="response-chip" data-type="share">✎ 想说点什么</button>' +
                 '</div>' +
                 '<textarea class="response-text" placeholder="（可选）写下你想说的话…" hidden></textarea>' +
                 '<button class="response-send" hidden>送出回应</button>' +
               '</article>';
      }).join('');

      // 事件
      $$('.response-chip', feedEl).forEach(function (chip) {
        chip.addEventListener('click', function () {
          var card = chip.closest('.resonance-card');
          $$('.response-chip', card).forEach(function (c) { c.classList.remove('selected'); });
          chip.classList.add('selected');
          var isShare = chip.dataset.type === 'share';
          var ta = card.querySelector('.response-text');
          var sendBtn = card.querySelector('.response-send');
          ta.hidden = !isShare;
          sendBtn.hidden = false;
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
          btn.disabled = true;
          try {
            await CB_API.createResponse(memoryId, type, type === 'share' ? content : null);
            showToast('回应已送出');
            btn.textContent = '已回应';
          } catch (err) {
            showToast(err.message || '发送失败');
            btn.disabled = false;
          }
        });
      });
    } catch (e) {
      feedEl.innerHTML = '<p class="resonance-hint">加载失败：' + escapeHtml(e.message || '网络问题') + '</p>';
    }
  }

  // ===========================================================================
  // 10. 全局事件绑定
  // ===========================================================================
  function initNav() {
    document.body.addEventListener('click', function (e) {
      var t = e.target.closest('[data-goto]');
      if (t) {
        var dest = t.dataset.goto;
        if (dest === 'record') { showScreen('record'); return; }
        if (dest === 'home')    { showScreen('home'); return; }
        if (dest === 'growth')  { loadGrowthData().then(function () { showScreen('growth'); }); return; }
        if (dest === 'resonance') { loadResonanceData().then(function () { showScreen('resonance'); }); return; }
      }
      var back = e.target.closest('[data-back]');
      if (back) {
        var dest2 = back.dataset.back || 'home';
        showScreen(dest2);
      }
    });

    // 关于按钮（占位）
    var about = $('aboutLink');
    if (about) {
      about.addEventListener('click', function () {
        showToast('CycleBubble — 帮你理解情绪可能从哪里来');
      });
    }
  }

  // ===========================================================================
  // 11. 启动
  // ===========================================================================
  async function boot() {
    initAuth();
    initRecord();
    initNav();
    if (CB_API.isLoggedIn()) {
      try {
        var u = await CB_API.me();
        await afterLogin();
      } catch (e) {
        CB_API.logout();
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