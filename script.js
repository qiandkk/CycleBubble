/**
 * CycleBubble V6 — Emotional OS (Biology 版)
 * 核心资产是理解能力，不是成长。
 * Bubble 是一个随用户经历沉积出独特晶体结构的生命体。
 * Settling, not Growing.
 */
(function () {
  "use strict";

  // ====== Bubble Biology 数据模型 ======
  // DNA 是 Pattern 型，不是数值型。
  // 后端维护 Memory，不维护成长值。

  var defaultDNA = {
    // 结构化 Memory 数组（每条记录是一层矿物沉积）
    memories: [],
    // Pattern 聚合（从 memories 计算，不直接存储）
    // patterns 在运行时动态计算，这里只存缓存标记
    _patternsCache: null,
    _patternsCacheVersion: 0,
    // 时间切片（支持跨期对比）
    timeline: [],
    // Relationship 维度：用户如何回应别人
    relationshipSignals: [],
    // Community 维度：用户与什么内容产生共鸣
    communitySignals: [],
    // DNA 变化记录（Evolution）
    evolution: [],
    // 统计
    totalRecords: 0,
    totalResponses: 0
  };

  var bubbleDNA;
  try {
    var saved = localStorage.getItem("bubbleDNA_v6");
    if (saved) {
      var parsed = JSON.parse(saved);
      bubbleDNA = mergeDNA(defaultDNA, parsed);
    } else {
      bubbleDNA = JSON.parse(JSON.stringify(defaultDNA));
    }
  } catch (e) {
    bubbleDNA = JSON.parse(JSON.stringify(defaultDNA));
  }

  function mergeDNA(defaults, saved) {
    var result = JSON.parse(JSON.stringify(defaults));
    for (var k in saved) {
      if (saved.hasOwnProperty(k)) result[k] = saved[k];
    }
    // 确保数组存在
    if (!Array.isArray(result.memories)) result.memories = [];
    if (!Array.isArray(result.timeline)) result.timeline = [];
    if (!Array.isArray(result.relationshipSignals)) result.relationshipSignals = [];
    if (!Array.isArray(result.communitySignals)) result.communitySignals = [];
    if (!Array.isArray(result.evolution)) result.evolution = [];
    return result;
  }

  function saveDNA() {
    try {
      bubbleDNA._patternsCacheVersion++;
      localStorage.setItem("bubbleDNA_v6", JSON.stringify(bubbleDNA));
    } catch (e) {}
  }

  // ====== HTML 转义 helper ======
  // 所有往 .innerHTML 塞的"用户原文/后端返回字符串"必须先过这个函数，
  // 否则用户在原文里写 <script>...</script> 会被当脚本执行。
  // 这关系到 JWT 存于 localStorage 的连带风险（一旦 XSS 发生，攻击者可读 token）。
  var HTML_ESCAPE_MAP = { "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" };
  function escapeHTML(s) {
    if (s == null) return "";
    return String(s).replace(/[<>&"']/g, function (c) { return HTML_ESCAPE_MAP[c]; });
  }

  // ====== Memory 结构化抽取 ======
  // 已移除前端关键词匹配和 extractMemory()。结构化字段完全由后端提供：
  // - 真实模式：后端 AI 提取（失败时按后端关键词后备）
  // - 演示模式：seed_demo.py 预置

  // ====== 不再注入前端硬编码种子记忆 ======
  // 双数据库架构下，demo 模式的种子数据从 cyclebubble_demo.db 读取（后端 seed_demo.py 预置）。
  // 前端 bubbleDNA.memories 始终是真实数据（或空状态），与 demo/真实模式无关。
  // 保留 bubbleReset 标记语义（点击"重新开始"后清空本地缓存）。

  // ====== 模式管理：演示 / 正常 ======
  // 通过 URL 参数可强制：?demo=1 强制演示，?mode=app 强制正常
  var urlParams = (function () {
    try { return new URLSearchParams(window.location.search); }
    catch (e) { return null; }
  })();
  // 移除 ?demo=1：演示模式仅由用户主动从登录页点击触发
  var forceApp = urlParams && urlParams.get('mode') === 'app';
  var isDemoMode = false;
  var authAutoSwitched = false; // 防止 initAuthState 重复切屏

  // ===== Demo 模式半自动引导 =====
  // 设计：避免"色温 = 评分"的误解。
  // Bubble 色温不随 mood 切换，只在 demo 模式下展示累积感（纹理/层次/连接逐步出现）。
  // 流程：进入 demo 后自动放一段开场（约 8 秒），然后由"下一步"按钮驱动 4 个阶段：
  //   1. 时间线：展示 5 条 seed memory 的 90 天跨度
  //   2. AI 理解：展示 CycleBubble 如何从原文提取 Pattern（不实时调用 AI，用 seed 已有的 themes/triggers/recovery）
  //   3. 共鸣：交互环节，用户点 chip 模拟回应（仅前端 local state）
  //   4. 价值总结：突出"理解 / 接纳 / 自我观察"，避免医疗化诊断化语言
  var _demoPlaybackIdx = 0;       // 当前阶段 0..3（intro 自动放，然后 1..4 手动）
  var _demoPlaybackTimer = null;  // intro 自动播放定时器
  var _demoPlaybackMood = null;   // 留 null，Bubble 不再被 mood 驱动
  var _demoIntroPlayed = false;   // 是否已放过开场
  var _demoVisibleMemoryCount = 1; // demo 模式下 Bubble 看到的"累积记忆数"，控制层次动画
  var DEMO_STEPS = [
    { id: 'intro',   auto_ms: 8000, label: '已形成的 Bubble',        desc: '一段已经走过的旅程' },
    { id: 'timeline', auto_ms: 0,  label: '90 天时间线',             desc: '5 段记录横跨约 90 天' },
    { id: 'ai',      auto_ms: 0,  label: 'AI 看到的 Pattern',        desc: '不是判断你是什么样的人，而是观察你的变化' },
    { id: 'resonance', auto_ms: 0, label: '匿名共鸣',                 desc: '你并不孤独 —— 有人经历过类似的阶段' },
    { id: 'summary', auto_ms: 0,  label: '理解 ≠ 评判',                desc: 'CycleBubble 不预测你的情绪，只是帮你观察自己的节律' },
  ];
  // 与 seed_demo.py 的 SEED_MEMORIES 顺序对齐的引文
  var DEMO_QUOTES = [
    '今天又因为领导的一句话纠结了一整天。我是不是太敏感了？',
    '和朋友聊了之后好多了。原来不只是我一个人这样。',
    '开会时又想反驳但没说出口。下次想试着表达出来。',
    '今天终于主动说出了自己的想法，虽然说出口时手在抖。',
    '这个阶段又到了，提前做好了心理准备。没有像上次那样陷入很久。',
  ];

  function isAppMode() { return !isDemoMode; }

  function _stopDemoPlayback() {
    if (_demoPlaybackTimer) {
      clearInterval(_demoPlaybackTimer);
      _demoPlaybackTimer = null;
    }
    _demoPlaybackIdx = 0;
    _demoIntroPlayed = false;
    _demoVisibleMemoryCount = 1;
    var ticker = document.getElementById('demoPlaybackTicker');
    if (ticker) ticker.hidden = true;
    var stepBtn = document.getElementById('demoNextStepBtn');
    if (stepBtn) stepBtn.hidden = true;
    var quoteBox = document.getElementById('demoQuoteBox');
    if (quoteBox) quoteBox.hidden = true;
    var stage = document.getElementById('demoStage');
    if (stage) stage.hidden = true;
  }

  function _startDemoPlayback() {
    _stopDemoPlayback();
    _showDemoStep(0); // 开场自动播放
  }

  function _showDemoStep(idx) {
    _demoPlaybackIdx = idx;
    var step = DEMO_STEPS[idx];
    if (!step) return;

    // intro 阶段：自动放 8 秒后跳到 timeline
    if (step.id === 'intro') {
      _demoVisibleMemoryCount = 1;
      _demoIntroPlayed = false;
      // 自动播放：8 秒后切到下一步
      if (_demoPlaybackTimer) clearTimeout(_demoPlaybackTimer);
      _demoPlaybackTimer = setTimeout(function () {
        _demoIntroPlayed = true;
        if (!isDemoMode) return;
        _showDemoStep(1);
      }, step.auto_ms);
      // 渲染 intro 阶段 UI
      _renderDemoStage(step, idx);
    } else {
      // 手动阶段：累积记忆数递增（演示"层次累积"而非"色温变化"）
      if (idx === 1) _demoVisibleMemoryCount = 5;       // 时间线：5 条全展示
      else if (idx === 2) _demoVisibleMemoryCount = 5;  // AI 理解：5 条都参与
      else if (idx === 3) _demoVisibleMemoryCount = 5;  // 共鸣
      else if (idx === 4) _demoVisibleMemoryCount = 5;  // 总结
      _renderDemoStage(step, idx);
    }

    if (typeof applyBubbleState === 'function') applyBubbleState();
  }

  function _nextDemoStep() {
    if (!isDemoMode) return;
    var next = Math.min(_demoPlaybackIdx + 1, DEMO_STEPS.length - 1);
    if (next === _demoPlaybackIdx) return;
    _showDemoStep(next);
  }

  // 把当前阶段信息渲染到底部 ticker + 大字说明
  function _renderDemoStage(step, idx) {
    var ticker = document.getElementById('demoPlaybackTicker');
    var stepBtn = document.getElementById('demoNextStepBtn');
    var stage = document.getElementById('demoStage');

    if (ticker) {
      ticker.hidden = false;
      var dots = '';
      for (var i = 1; i < DEMO_STEPS.length; i++) {
        dots += '<span class="demo-playback-dot' + (i <= idx ? ' active' : '') + '"></span>';
      }
      ticker.innerHTML =
        '<div class="demo-playback-label">阶段 ' + idx + ' / ' + (DEMO_STEPS.length - 1) + ' · ' + step.label + '</div>' +
        '<div class="demo-playback-dots">' + dots + '</div>';
    }

    if (stepBtn) {
      // intro 自动放，不显示按钮；最后阶段（summary）禁用按钮
      if (idx === 0) {
        stepBtn.hidden = true;
      } else if (idx === DEMO_STEPS.length - 1) {
        stepBtn.hidden = true;
      } else {
        stepBtn.hidden = false;
        stepBtn.textContent = '下一步 · ' + DEMO_STEPS[idx + 1].label;
      }
    }

    // 在首页叠加一段大字价值介绍
    if (stage) {
      stage.hidden = false;
      var stageText = '<div class="demo-stage-eyebrow">' + step.label + '</div>' +
        '<div class="demo-stage-desc">' + escapeHTML(step.desc) + '</div>';
      if (idx === 0) {
        stageText += '<div class="demo-stage-quote">"' + escapeHTML(DEMO_QUOTES[0]) + '"</div>';
      } else if (idx === 1) {
        stageText += '<div class="demo-stage-quote">"' + escapeHTML(DEMO_QUOTES[Math.min(_demoPlaybackIdx, DEMO_QUOTES.length - 1)]) + '"</div>';
      } else if (idx === 4) {
        // 价值总结（避免医疗化、诊断化）
        stageText +=
          '<div class="demo-stage-summary">' +
            '<div class="demo-stage-line demo-stage-line--accent">理解</div>' +
            '<div class="demo-stage-line">看见身体的节律、情绪的起伏、相似经历的他人</div>' +
            '<div class="demo-stage-line demo-stage-line--accent">接纳</div>' +
            '<div class="demo-stage-line">不评判自己，不贴标签，记录本身就是观察</div>' +
            '<div class="demo-stage-line demo-stage-line--accent">自我观察</div>' +
            '<div class="demo-stage-line">CycleBubble 不预测你的情绪，只是帮你看见自己的节律</div>' +
          '</div>';
      }
      stage.innerHTML = stageText;
    }
  }

  function refreshDemoBar() {
    var bar = document.getElementById('demoBar');
    var pill = document.getElementById('loginPill');
    if (bar) bar.hidden = !isDemoMode;
    // loginPill 仅在 demo 模式下显示，作为"想用完整功能"的入口
    if (pill) pill.hidden = !isDemoMode;
  }

  function showDemoToast(message) {
    var existing = document.getElementById('demoToast');
    if (existing) existing.remove();
    var toast = document.createElement('div');
    toast.id = 'demoToast';
    toast.className = 'demo-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(function () { toast.classList.add('demo-toast--show'); }, 10);
    setTimeout(function () {
      toast.classList.remove('demo-toast--show');
      setTimeout(function () { toast.remove(); }, 300);
    }, 2500);
  }

  // ====== 演示模式标记同步 ======
  // 后端双数据库架构：演示模式请求会带 X-Demo-Mode: 1 header，
  // 后端从 cyclebubble_demo.db 读种子数据并跳过 token 校验。
  // 前端不再需要硬编码 demo 数据，所有展示都通过 API 拿。
  function syncDemoFlag() {
    try {
      if (window.CB_API && CB_API.setDemoMode) {
        CB_API.setDemoMode(isDemoMode);
      }
    } catch (e) {}
  }

  // ====== 援助 modal 触发逻辑 ======
  function showCrisisModal(resources) {
    var modal = document.getElementById('crisisModal');
    var list = document.getElementById('crisisResources');
    if (!modal || !list) return;

    // 渲染资源列表
    list.innerHTML = '';
    if (!resources || resources.length === 0) {
      // 后端没有传 resources，用硬编码兜底
      resources = [
        { name: '全国心理援助热线', phone: '400-161-9995', hours: '24h', type: 'phone' },
        { name: '北京心理危机研究与干预中心', phone: '010-82951332', hours: '24h', type: 'phone' },
        { name: '希望24热线', phone: '400-161-9995', hours: '24h', type: 'phone' },
        { name: '简单心理', url: 'https://www.simplecare.cn', type: 'online' }
      ];
    }

    resources.forEach(function (r) {
      var item = document.createElement('div');
      item.className = 'crisis-resource';

      var icon = document.createElement('div');
      icon.className = 'crisis-resource-icon';
      icon.textContent = r.type === 'online' ? '✦' : '☎';

      var body = document.createElement('div');
      body.className = 'crisis-resource-body';

      var name = document.createElement('div');
      name.className = 'crisis-resource-name';
      name.textContent = r.name;

      var detail = document.createElement('div');
      detail.className = 'crisis-resource-detail';
      if (r.phone) {
        detail.innerHTML = '<a href="tel:' + r.phone + '">' + r.phone + '</a>' + (r.hours ? ' · ' + r.hours : '');
      } else if (r.url) {
        detail.innerHTML = '<a href="' + r.url + '" target="_blank" rel="noopener">' + r.url + '</a>';
      }

      body.appendChild(name);
      body.appendChild(detail);
      item.appendChild(icon);
      item.appendChild(body);
      list.appendChild(item);
    });

    modal.hidden = false;
  }

  function hideCrisisModal() {
    var modal = document.getElementById('crisisModal');
    if (modal) modal.hidden = true;
  }

  // 关闭按钮
  var crisisCloseBtn = document.getElementById('crisisCloseBtn');
  if (crisisCloseBtn) crisisCloseBtn.addEventListener('click', hideCrisisModal);
  var crisisDismissBtn = document.getElementById('crisisDismissBtn');
  if (crisisDismissBtn) crisisDismissBtn.addEventListener('click', hideCrisisModal);

  // ====== Pattern 聚合层 ======
  // 从 memories 动态计算 Pattern，不存储。
  // AI 只能调用已存在的 Pattern，不能创造不存在的 Pattern。

  function computePatterns() {
    var memories = bubbleDNA.memories;
    var patterns = {
      themes: {},
      triggers: {},
      recovery: {},
      emotions: {},
      expressions: {},
      totalMemories: memories.length,
      themeCount: 0,
      recoveryCount: 0,
      triggerCount: 0,
      moodDistribution: {},
      recentMood: "未明",
      hasRecoveryPattern: false,
      hasTriggerPattern: false,
      timelineSpan: 0
    };

    if (memories.length === 0) return patterns;

    // 聚合各维度
    for (var i = 0; i < memories.length; i++) {
      var m = memories[i];
      addToCount(patterns.themes, m.themes);
      addToCount(patterns.triggers, m.triggers);
      addToCount(patterns.recovery, m.recovery);
      addToCount(patterns.emotions, m.emotions);
      if (m.expressionStyle) {
        patterns.expressions[m.expressionStyle] = (patterns.expressions[m.expressionStyle] || 0) + 1;
      }
    }

    patterns.themeCount = Object.keys(patterns.themes).length;
    patterns.recoveryCount = Object.keys(patterns.recovery).length;
    patterns.triggerCount = Object.keys(patterns.triggers).length;

    // 近期情绪基调（最近 3 条记忆的主导情绪）
    var recent = memories.slice(-3);
    var moodTally = {};
    for (var r = 0; r < recent.length; r++) {
      if (recent[r].mood && recent[r].mood !== "未明") {
        moodTally[recent[r].mood] = (moodTally[recent[r].mood] || 0) + 1;
      }
    }
    var topMood = "未明";
    var topCount = 0;
    for (var mood in moodTally) {
      if (moodTally[mood] > topCount) {
        topMood = mood;
        topCount = moodTally[mood];
      }
    }
    patterns.recentMood = topMood;

    // 情绪分布
    for (var e in patterns.emotions) {
      patterns.moodDistribution[e] = patterns.emotions[e];
    }

    // 是否有恢复方式 Pattern
    patterns.hasRecoveryPattern = patterns.recoveryCount >= 2;

    // 是否有触发因素 Pattern
    patterns.hasTriggerPattern = patterns.triggerCount >= 2;

    // 时间跨度
    if (memories.length >= 2) {
      patterns.timelineSpan = memories[memories.length - 1].time - memories[0].time;
    }

    return patterns;
  }

  function addToCount(countMap, items) {
    if (!items) return;
    for (var i = 0; i < items.length; i++) {
      countMap[items[i]] = (countMap[items[i]] || 0) + 1;
    }
  }

  function getPatterns() {
    if (bubbleDNA._patternsCache && bubbleDNA._patternsCacheVersion === bubbleDNA._patternsCacheVersion_cached) {
      return bubbleDNA._patternsCache;
    }
    var p = computePatterns();
    bubbleDNA._patternsCache = p;
    bubbleDNA._patternsCacheVersion_cached = bubbleDNA._patternsCacheVersion;
    return p;
  }

  function getTopPattern(patternMap, minCount) {
    minCount = minCount || 2;
    var top = null;
    var topVal = 0;
    for (var k in patternMap) {
      if (patternMap[k] > topVal && patternMap[k] >= minCount) {
        top = k;
        topVal = patternMap[k];
      }
    }
    return top ? { name: top, count: topVal } : null;
  }

  // ====== 成长故事（展示原话，让用户自己看见变化，不由 Bubble 宣布） ======
  function dedupeMemories(arr) {
    var seen = {};
    var result = [];
    for (var i = 0; i < arr.length; i++) {
      if (!seen[arr[i].id]) {
        seen[arr[i].id] = true;
        result.push(arr[i]);
      }
    }
    return result;
  }

  function generateGrowthStories() {
    var p = getPatterns();
    var stories = [];

    // 记忆太少时，不生成任何"发现"
    if (p.totalMemories < 2) {
      return stories;
    }

    // 表达方式：把不同时期的原话放在一起，让用户自己看到差异（至少 2 条不同记忆）
    var selfMemories = findMemoriesByTheme("自我");
    var expressMemories = findMemoriesByTheme("表达");
    // concat 后按 id 去重
    var allExpress = dedupeMemories(selfMemories.concat(expressMemories));
    if (allExpress.length >= 2) {
      var first = allExpress[0];
      var last = allExpress[allExpress.length - 1];
      // 确保最早和最近不是同一条，且文本内容不同
      if (first.id !== last.id && first.snippet !== last.snippet) {
        var quotes = [];
        quotes.push({ time: first.timeLabel, text: first.snippet });
        quotes.push({ time: last.timeLabel, text: last.snippet });
        stories.push({
          text: "这两段话，是不同时期留下的。",
          tag: "表达方式",
          evidence: allExpress,
          quotes: quotes
        });
      }
    }

    // 恢复方式：至少 2 条不同内容才展示
    var recoveryMemories = dedupeMemories(findMemoriesByRecovery());
    if (recoveryMemories.length >= 2) {
      var rFirst = recoveryMemories[0];
      var rLast = recoveryMemories[recoveryMemories.length - 1];
      if (rFirst.snippet !== rLast.snippet) {
        var recoveryQuotes = [
          { time: rFirst.timeLabel, text: rFirst.snippet },
          { time: rLast.timeLabel, text: rLast.snippet }
        ];
        stories.push({
          text: "这些记录里，都提到了让自己好起来的方式。",
          tag: "恢复方式",
          evidence: recoveryMemories,
          quotes: recoveryQuotes
        });
      }
    }

    // 与他人的连接：展示用户回应过的内容
    if (bubbleDNA.totalResponses > 0) {
      stories.push({
        text: "最近你开始回应别人的故事了。",
        tag: "与他人的连接",
        evidence: bubbleDNA.relationshipSignals.slice(-3),
        quotes: []
      });
    }

    // 周期觉察：至少 2 条不同内容才展示
    var cycleMemories = dedupeMemories(findMemoriesByTheme("身体"));
    if (cycleMemories.length >= 2) {
      var cFirst = cycleMemories[0];
      var cLast = cycleMemories[cycleMemories.length - 1];
      if (cFirst.snippet !== cLast.snippet) {
        var cycleQuotes = [
          { time: cFirst.timeLabel, text: cFirst.snippet },
          { time: cLast.timeLabel, text: cLast.snippet }
        ];
        stories.push({
          text: "关于身体的变化，你留下了这些。",
          tag: "身体的节奏",
          evidence: cycleMemories,
          quotes: cycleQuotes
        });
      }
    }

    return stories;
  }

  function findMemoriesByTheme(theme) {
    var result = [];
    for (var i = 0; i < bubbleDNA.memories.length; i++) {
      if (bubbleDNA.memories[i].themes.indexOf(theme) !== -1) {
        result.push(bubbleDNA.memories[i]);
      }
    }
    return result;
  }

  function findMemoriesByRecovery() {
    var result = [];
    for (var i = 0; i < bubbleDNA.memories.length; i++) {
      if (bubbleDNA.memories[i].recovery.length > 0) {
        result.push(bubbleDNA.memories[i]);
      }
    }
    return result;
  }

  // ====== 成长旁白系统（基于 Pattern 丰富度，非数值总分） ======
  function getGrowthNarration() {
    var p = getPatterns();
    var richness = p.themeCount + p.recoveryCount;

    if (p.totalMemories === 0) {
      return "Bubble 还在等你";
    }
    if (richness >= 5 && bubbleDNA.totalResponses >= 2) {
      return "Bubble 好像越来越懂你了";
    }
    if (richness >= 3) {
      return "Bubble 开始记住你的节奏了";
    }
    return "Bubble 还在慢慢认识你";
  }

  function getGrowthHeadline() {
    var p = getPatterns();
    var richness = p.themeCount + p.recoveryCount;

    if (p.totalMemories === 0) {
      return "Bubble 还在等你写下第一句话";
    }
    if (richness >= 5 && bubbleDNA.totalResponses >= 2) {
      return "Bubble 想和你分享一些最近才发现的变化";
    }
    if (richness >= 3) {
      return "Bubble 发现了一些也许值得看看的变化";
    }
    return "Bubble 正在慢慢认识你";
  }

  function getGrowthSub() {
    var p = getPatterns();
    var richness = p.themeCount + p.recoveryCount;

    if (p.totalMemories === 0) {
      return "每一段表达，都会成为 Bubble 理解你的开始。";
    }
    if (richness >= 5) {
      return "这些变化不是结论，只是一种观察。你自己觉得呢？";
    }
    if (richness >= 3) {
      return "这些只是 Bubble 的观察，不一定是答案。";
    }
    return "每一次表达，都是 Bubble 理解你的一步。";
  }

  // ====== 由 Pattern 计算 Bubble Biology 状态 ======
  // 视觉表达理解深度，不表达成长分数。
  // 液体层次 ← Memory 层数（矿物沉积）
  // 粒子密度 ← Pattern 丰富度
  // 色温 ← 近期情绪基调
  // 呼吸节奏 ← 记录连续性

  var moodColorMap = {
    "焦虑": { hue: 265, sat: 0.15 },   // 薰衣草紫
    "委屈": { hue: 340, sat: 0.14 },   // 玫瑰粉
    "愤怒": { hue: 10, sat: 0.18 },    // 珊瑚红
    "低落": { hue: 220, sat: 0.08 },   // 雾蓝
    "平静": { hue: 180, sat: 0.06 },   // 薄荷青
    "温暖": { hue: 35, sat: 0.14 },    // 暖橙
    "力量": { hue: 50, sat: 0.16 },    // 金色
    "未明": { hue: 275, sat: 0.08 }    // 柔紫（空状态默认）
  };

  function computeBubbleState() {
    var p = getPatterns();
    var memoryCount = p.totalMemories;
    var patternRichness = p.themeCount + p.recoveryCount + p.triggerCount;

    // 演示模式：用 _demoVisibleMemoryCount 控制"累积动画"
    // 真实模式：用真实 memoryCount
    if (isDemoMode) {
      memoryCount = _demoVisibleMemoryCount;
    }

    // 液体层次：Memory 越多，矿物层越厚
    var liquidLayers = Math.min(5, Math.floor(memoryCount / 1)); // demo 用累加动画，1 层→5 层逐步展开

    // 粒子密度：Pattern 越丰富，内部生命越多
    var particleDensity = 2 + Math.floor(patternRichness / 2);

    // 色温：演示模式下锁定为"柔紫"中性色，避免被理解为"评分"
    // 真实模式下仍按最近情绪基调变化
    var effectiveMood = p.recentMood;
    if (isDemoMode) effectiveMood = "未明";
    var moodData = moodColorMap[effectiveMood] || moodColorMap["未明"];

    // 呼吸节奏：记录越多越稳定（越慢）
    var breatheDuration = Math.max(4.0, 6.0 - memoryCount * 0.15);

    // 液体不透明度：Memory 越多，液体越有质感（越不透明）
    var opacity = Math.min(0.95, 0.72 + memoryCount * 0.015);

    // 纹理层数：Pattern 丰富度
    var textureLayers = Math.min(5, Math.floor(patternRichness / 2));

    return {
      liquidLayers: liquidLayers,
      particleDensity: particleDensity,
      moodHue: moodData.hue,
      moodSat: moodData.sat,
      breatheDuration: breatheDuration,
      opacity: opacity,
      textureLayers: textureLayers,
      patternRichness: patternRichness,
      memoryCount: memoryCount,
      recentMood: effectiveMood
    };
  }

  function applyBubbleState() {
    var st = computeBubbleState();
    var bubble = document.getElementById("mainBubble");
    var liquid = document.getElementById("bubbleLiquid");
    var texture = document.getElementById("bubbleTexture");
    var narration = document.getElementById("growthNarration");

    if (bubble) {
      // 色温来自情绪基调，不是"好坏"
      var filterStr = "brightness(" + (1 + st.moodSat * 0.3).toFixed(3) + ")";
      filterStr += " saturate(" + (1 + st.moodSat).toFixed(3) + ")";
      filterStr += " hue-rotate(" + ((st.moodHue - 275) * 0.6).toFixed(1) + "deg)";
      bubble.style.filter = filterStr;
      bubble.style.animationDuration = st.breatheDuration.toFixed(1) + "s";
    }
    if (liquid) {
      liquid.style.opacity = st.opacity.toFixed(2);
    }
    if (texture) {
      texture.innerHTML = "";
      // 纹理层 = 矿物沉积，每层有不同的质感和色调
      for (var i = 0; i < st.textureLayers; i++) {
        var layer = document.createElement("span");
        var layerOpacity = 0.06 + i * 0.02;
        var xPos = 20 + i * 15;
        var yPos = 30 + i * 10;
        layer.style.cssText =
          "position:absolute;inset:0;border-radius:50%;opacity:" + layerOpacity + ";pointer-events:none;" +
          "background:radial-gradient(circle at " + xPos + "% " + yPos + "%, " +
          "hsla(" + st.moodHue + ", 40%, 70%, .5), transparent 40%);";
        texture.appendChild(layer);
      }
      if (st.textureLayers > 0) texture.classList.add("visible");
    }
    if (narration) {
      narration.textContent = getGrowthNarration();
    }

    // 回应页卡片顶部色温 = 主 Bubble 情绪基调
    var resonanceCards = document.querySelectorAll(".resonance-card");
    for (var rc = 0; rc < resonanceCards.length; rc++) {
      // 顶部弧形光感用情绪色温
      var topGradient = "linear-gradient(90deg, transparent 0%, hsla(" + st.moodHue + ",45%,70%,.5) 20%, hsla(" + st.moodHue + ",50%,72%,.45) 50%, hsla(" + st.moodHue + ",45%,70%,.5) 80%, transparent 100%)";
      // 背景顶部加情绪色光斑
      var bgColor = "radial-gradient(ellipse at 30% 0%, hsla(" + st.moodHue + ",40%,80%,.35), transparent 50%), radial-gradient(ellipse at 70% 100%, rgba(240,237,247,.4), transparent 50%), linear-gradient(180deg, rgba(255,253,251,.99), rgba(248,244,250,.9))";
      resonanceCards[rc].style.background = bgColor;
      // 用 CSS 变量传递顶部色温（::before 无法直接设 style，用 inline CSS 变量）
      resonanceCards[rc].style.setProperty("--mood-hue", st.moodHue);
    }
  }

  applyBubbleState();

  // ====== 数据加载（接后端 API）======
  // 仅替换硬编码数据来源，不改视觉。失败时保留原 HTML 兜底。

  // 后端 Memory → 本地 bubbleDNA.memory 格式转换
  function backendMemoryToLocal(m) {
    var text = m.raw_text || "";
    return {
      id: "remote_" + m.id,
      remoteId: m.id,
      time: m.created_at ? new Date(m.created_at).getTime() : Date.now(),
      timeLabel: formatTimeLabel(m.created_at),
      rawText: text,
      snippet: text.length > 50 ? text.substring(0, 50) + "……" : text,
      themes: m.themes || [],
      triggers: m.triggers || [],
      recovery: m.recovery || [],
      emotions: (m.emotions || []).map(function (e) { return e.name || e; }),
      mood: m.mood || "未明",
      expressionStyle: "倾诉",
      hasAction: false,
      source: "backend"
    };
  }

  function formatTimeLabel(iso) {
    if (!iso) return "今天";
    try {
      var d = new Date(iso);
      var now = new Date();
      var diffDays = Math.floor((now - d) / 86400000);
      if (diffDays === 0) return "今天";
      if (diffDays === 1) return "昨天";
      if (diffDays < 7) return diffDays + "天前";
      if (diffDays < 30) return Math.floor(diffDays / 7) + "周前";
      if (diffDays < 365) return Math.floor(diffDays / 30) + "个月前";
      return Math.floor(diffDays / 365) + "年前";
    } catch (e) {
      return "今天";
    }
  }

  // 从后端拉取真实记忆，覆盖本地 bubbleDNA.memories
  async function loadMemoriesFromBackend() {
    if (!window.CB_API || !CB_API.memory || !CB_API.memory.list) return null;
    try {
      var resp = await CB_API.memory.list(50, 0);
      var items = (resp && resp.memories) ? resp.memories : [];
      // 按时间正序（旧→新），与本地约定一致
      items.sort(function (a, b) {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
      var localMemories = items.map(backendMemoryToLocal);
      bubbleDNA.memories = localMemories;
      bubbleDNA.totalRecords = localMemories.length;
      bubbleDNA._patternsCache = null;
      bubbleDNA._patternsCacheVersion++;
      saveDNA();
      return localMemories;
    } catch (e) {
      console.warn("加载记忆失败:", e);
      return null;
    }
  }

  async function loadCycleStatus() {
    // 演示/真实模式都通过 API 拿，后端根据 X-Demo-Mode header 自动切库
    // demo 模式：cyclebubble_demo.db 已有种子经期 → 返回 phase=排卵期等
    // 真实模式：cyclebubble.db 没有经期 → confidence=none，文案空
    var phaseEl = document.getElementById("bubblePhase");
    var hintEl = document.getElementById("bubbleHint");
    var statusEl = document.getElementById("cycleStatus");
    var resetToPlaceholder = function () {
      if (phaseEl) phaseEl.textContent = "–";
      if (hintEl) hintEl.textContent = "Bubble 在慢慢认识你";
      if (statusEl) statusEl.textContent = "Bubble 正在了解你的节奏";
    };
    if (!window.CB_API || !window.CB_API.cycle || !window.CB_API.cycle.getStatus) {
      resetToPlaceholder();
      return;
    }
    try {
      const status = await window.CB_API.cycle.getStatus();
      if (!status || !status.phase_name || status.confidence === "none" || status.phase === "unknown") {
        resetToPlaceholder();
        return;
      }
      const text = status.phase_name + "｜" + (status.description || "");
      const confidence = status.confidence;
      let suffix = "";
      if (confidence === "low") suffix = "（估算）";
      else if (confidence === "medium") suffix = "（预测中）";
      if (statusEl) statusEl.textContent = text + suffix;
      if (phaseEl) phaseEl.textContent = status.phase_name;
      if (hintEl) hintEl.textContent = status.description || "Bubble 在慢慢认识你";
    } catch (e) {
      console.warn("加载周期状态失败:", e);
      resetToPlaceholder();
    }
  }

  async function loadGrowthData() {
    // 演示/真实模式都通过 API 拿，后端根据 X-Demo-Mode header 自动切库
    try {
      if (!window.CB_API || !window.CB_API.growth || !window.CB_API.growth.get) return null;
      const data = await window.CB_API.growth.get();
      return data || null;
    } catch (e) {
      console.warn("加载成长数据失败:", e);
      return null;
    }
  }

  async function loadResonanceFeed() {
    // 演示/真实模式都通过 API 拿，后端根据 X-Demo-Mode header 自动切库
    try {
      if (!window.CB_API || !window.CB_API.resonance || !window.CB_API.resonance.getFeed) return [];
      const data = await window.CB_API.resonance.getFeed(10);
      return (data && data.stories) ? data.stories : [];
    } catch (e) {
      console.warn("加载共鸣流失败:", e);
      return [];
    }
  }

  // 渲染单张共鸣卡片（DOM 结构与 HTML 中的种子卡片一致，class 全保留）
  // data-response 使用后端 VALID_RESPONSE_TYPES 中的中文枚举
  var RESPONSE_CHIP_LABELS = {
    "我也经历过": "我也经历过",
    "谢谢": "谢谢你的分享",
    "抱抱": "抱抱你",
    "继续说": "继续说",
    "分享我的经历": "分享我的经历"
  };
  function buildResonanceCardFromStory(story, index) {
    var inlineStyle = "border:1.5px solid rgba(181,169,207,.3);border-radius:36px 36px 32px 32px;background:radial-gradient(ellipse at 30% 0%,rgba(245,217,216,.4),transparent 50%),radial-gradient(ellipse at 70% 100%,rgba(240,237,247,.45),transparent 50%),linear-gradient(180deg,rgba(255,253,251,.99),rgba(248,244,250,.92));box-shadow:0 20px 48px rgba(82,63,74,.12),inset 0 2px 0 rgba(255,255,255,.8);";
    var activeClass = (index === 0) ? " active" : "";
    // 匿名泡泡编号：根据 id 散列出一个稳定数字
    var num = 10 + ((story.id || 0) * 7 % 80) | 0;
    var text = (story.text_excerpt || "").replace(/[<>&"']/g, function (c) {
      return ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" })[c];
    });
    var html = "";
    html += '<section class="resonance-card' + activeClass + '" style="' + inlineStyle + '" data-index="' + index + '" data-memory-id="' + (story.id || 0) + '">';
    html += '<p class="anonymous">匿名泡泡 ' + num + '</p>';
    html += '<p class="quote">"' + text + '"</p>';
    html += '<div class="response-options">';
    html += '<button type="button" class="response-chip" data-response="我也经历过">我也经历过</button>';
    html += '<button type="button" class="response-chip" data-response="谢谢">谢谢你的分享</button>';
    html += '<button type="button" class="response-chip" data-response="抱抱">抱抱你</button>';
    html += '<button type="button" class="response-chip response-chip--expand" data-response="分享我的经历">分享我的经历</button>';
    html += '</div>';
    html += '<div class="response-expand" hidden>';
    html += '<textarea class="response-input" placeholder="如果你愿意，可以写一点自己的经历……"></textarea>';
    html += '<button type="button" class="response-send">送出</button>';
    html += '</div>';
    html += '<div class="resonance-card-footer">';
    html += '<button type="button" class="resonance-report-btn" data-memory-id="' + (story.id || 0) + '">举报</button>';
    html += '</div>';
    html += '</section>';
    return html;
  }

  // 把共鸣流渲染到回应页（含空状态、视觉结构 100% 复用 HTML 原版）
  async function renderResonanceFeed() {
    var stack = document.getElementById("resonanceStack");
    var dots = document.getElementById("pageDots");
    var empty = document.getElementById("resonanceEmptyState");
    if (!stack) return;

    var stories = await loadResonanceFeed();
    if (!stories || stories.length === 0) {
      // 空状态：隐藏 stack 和 dots，显示空状态元素
      stack.style.display = "none";
      if (dots && dots.parentNode) dots.parentNode.style.display = "none";
      if (empty) empty.hidden = false;
      return;
    }

    // 渲染 stories
    var html = "";
    for (var i = 0; i < stories.length; i++) {
      html += buildResonanceCardFromStory(stories[i], i);
    }
    stack.innerHTML = html;
    if (empty) empty.hidden = true;

    // 重新初始化分页器与回应芯片
    initResonancePager();

    // 更新 dots 数量
    if (dots) {
      var dotsHtml = "";
      for (var d = 0; d < stories.length; d++) {
        dotsHtml += d === 0 ? '<i class="active"></i>' : '<i></i>';
      }
      dots.innerHTML = dotsHtml;
    }
  }

  function initResonancePager() {
    resonanceCards = document.querySelectorAll(".resonance-card");
    pageDots = document.querySelectorAll("#pageDots i");
    currentIndex = 0;
    totalCards = resonanceCards.length;
    if (totalCards > 0 && resonanceCards[0]) resonanceCards[0].classList.add("active");
    bindResponseChips();
    bindResponseSends();
    bindReportButtons();
  }

  function bindReportButtons() {
    var btns = document.querySelectorAll(".resonance-card .resonance-report-btn");
    for (var i = 0; i < btns.length; i++) {
      (function (btn) {
        btn.addEventListener("click", function () {
          var card = btn.closest(".resonance-card");
          if (!card) return;
          openReportPanel(card, parseInt(btn.getAttribute("data-memory-id") || "0", 10));
        });
      })(btns[i]);
    }
  }

  function openReportPanel(card, memoryId) {
    if (!card || !memoryId) return;
    var existing = card.querySelector(".resonance-report-panel");
    if (existing) { existing.remove(); return; }
    var panel = document.createElement("div");
    panel.className = "resonance-report-panel";
    panel.innerHTML =
      '<select class="resonance-report-reason">' +
      '<option value="spam">垃圾广告</option>' +
      '<option value="harassment">人身攻击</option>' +
      '<option value="self_harm_concern">涉及自我伤害</option>' +
      '<option value="other">其他</option>' +
      '</select>' +
      '<textarea class="resonance-report-note" rows="2" placeholder="补充说明（选填）"></textarea>' +
      '<div class="resonance-report-actions">' +
      '<button type="button" class="btn-link resonance-report-cancel">取消</button>' +
      '<button type="button" class="btn-primary resonance-report-submit">提交举报</button>' +
      '</div>';
    card.querySelector(".resonance-card-footer").after(panel);
    panel.querySelector(".resonance-report-cancel").addEventListener("click", function () {
      panel.remove();
    });
    panel.querySelector(".resonance-report-submit").addEventListener("click", async function () {
      if (isDemoMode) { showDemoToast("演示模式下举报不会提交，登录后可以保护共鸣流"); return; }
      var reason = panel.querySelector(".resonance-report-reason").value;
      var note = panel.querySelector(".resonance-report-note").value.trim();
      try {
        await CB_API.reports.create(memoryId, reason, note);
        panel.innerHTML = '<p style="margin:0;color:var(--subtle);font-size:12px;">已提交，感谢你的反馈。</p>';
      } catch (e) {
        showDemoToast(e.message || "举报失败");
      }
    });
  }

  function bindResponseChips() {
    var responseChips = document.querySelectorAll(".resonance-card .response-chip");
    for (var r = 0; r < responseChips.length; r++) {
      responseChips[r].addEventListener("click", function () {
        var responseType = this.getAttribute("data-response");
        var card = this.closest(".resonance-card");
        if (!card) return;

        // "分享我的经历" 是展开输入框的特殊动作，不立即发送
        if (responseType === "分享我的经历") {
          var expand = card.querySelector(".response-expand");
          if (expand) {
            expand.hidden = !expand.hidden;
            if (!expand.hidden) {
              var input = expand.querySelector(".response-input");
              if (input) input.focus();
            }
          }
          return;
        }

        var allChips = card.querySelectorAll(".response-chip");
        for (var c = 0; c < allChips.length; c++) {
          allChips[c].disabled = true;
        }
        this.classList.add("responded");
        this.textContent = "已送出";

        sendResponseToBackend(card, responseType, null);
        trackLocalResponse(responseType, null);

        if (responseType === "我也经历过") addLightPoint("connection");
        else if (responseType === "抱抱") addLightPoint("warmth");
        else addLightPoint("connection");

        setTimeout(nextCard, 1500);
      });
    }
  }

  function bindResponseSends() {
    var responseSends = document.querySelectorAll(".resonance-card .response-send");
    for (var s = 0; s < responseSends.length; s++) {
      responseSends[s].addEventListener("click", function () {
        var card = this.closest(".resonance-card");
        if (!card) return;
        var input = card.querySelector(".response-input");
        if (input && input.value.trim()) {
          var sharedText = input.value.trim().substring(0, 80);
          trackLocalResponse("分享我的经历", sharedText);

          sendResponseToBackend(card, "分享我的经历", sharedText);

          addLightPoint("warmth");
          addLightPoint("connection");

          var expand = card.querySelector(".response-expand");
          if (expand) expand.hidden = true;

          var allChips = card.querySelectorAll(".response-chip");
          for (var c = 0; c < allChips.length; c++) {
            allChips[c].disabled = true;
          }
          input.value = "";
          setTimeout(nextCard, 1500);
        }
      });
    }
  }

  function trackLocalResponse(responseType, content) {
    bubbleDNA.totalResponses++;
    bubbleDNA.relationshipSignals.push({
      type: responseType,
      content: content || null,
      time: Date.now(),
      source: "resonance"
    });
    bubbleDNA.evolution.push({
      type: content ? "experience_shared" : "response_given",
      time: Date.now(),
      responseType: responseType,
      content: content || null
    });
    saveDNA();
  }

  function sendResponseToBackend(card, responseType, content) {
    if (!card) return;
    var memoryId = parseInt(card.getAttribute("data-memory-id") || "0", 10);
    if (!memoryId) return;
    if (isDemoMode) return; // 演示模式只走本地兜底
    if (!window.CB_API || !CB_API.resonance || !CB_API.resonance.respond) return;
    CB_API.resonance.respond(memoryId, responseType, content).catch(function (err) {
      console.warn("回应发送失败:", err);
      showDemoToast("回应未送达，请稍后再试");
    });
  }

  // 立即触发一次周期状态加载（首页文案）
  loadCycleStatus();

  // ====== 理解页渲染（Evidence → Pattern → Reflection，动态引用用户原话） ======
  var growthStoryIndex = 0;

  function renderInsightPage() {
    var body = document.getElementById("insightBody");
    if (!body) return;

    var memories = bubbleDNA.memories;
    var latest = memories.length > 0 ? memories[memories.length - 1] : null;
    var p = getPatterns();

    var html = '';

    // 1. Evidence：用户刚写的话（原样奉还，不评价）
    if (latest) {
      html += '<section class="insight-evidence">';
      html += '<p class="evidence-label">你刚刚写下的</p>';
      html += '<p class="evidence-text">' + escapeHTML(latest.snippet) + '</p>';
      html += '</section>';
    }

    // 2. Pattern：一个轻轻的观察（只说一个，不解释）
    var topTheme = getTopPattern(p.themes, 2);
    if (p.totalMemories <= 1) {
      // 第一条记录：不找模式，只说收下了
      html += '<section class="insight-pattern">';
      html += '<p class="pattern-text">这是你留给 Bubble 的第一段话。</p>';
      html += '</section>';
    } else if (topTheme && topTheme.count >= 2) {
      html += '<section class="insight-pattern">';
      html += '<p class="pattern-text">这些记录里，「' + escapeHTML(topTheme.name) + '」反复出现了 ' + topTheme.count + ' 次。</p>';
      html += '</section>';
    } else {
      html += '<section class="insight-pattern">';
      html += '<p class="pattern-text">Bubble 把它收下了。</p>';
      html += '</section>';
    }

    // 3. Reflection：留白（一句话，不解释）
    html += '<section class="insight-space">';
    html += '<p class="space-text">你自己觉得呢？</p>';
    html += '</section>';

    // 按钮
    html += '<div class="action-stack" style="padding:0; margin-top:24px;">';
    html += '<button class="primary-action" type="button" data-goto="growth">看看 Bubble 记住了什么</button>';
    html += '</div>';

    body.innerHTML = html;

    // 重新绑定按钮
    var btn = body.querySelector('[data-goto="growth"]');
    if (btn) {
      btn.addEventListener("click", function () {
        switchTo("growth");
      });
    }
  }

  // ====== 成长页渲染（一次一个发现，像翻书） ======
  function buildMemoryEntry(m, isLatest) {
    var html = '<div class="memory-entry' + (isLatest ? ' memory-entry--latest' : '') + '">';
    html += '<span class="memory-dot"></span>';
    html += '<div class="memory-content">';
    html += '<span class="memory-time">' + escapeHTML(m.timeLabel) + '</span>';
    html += '<p class="memory-snippet">' + escapeHTML(m.snippet) + '</p>';
    if (m.themes && m.themes.length > 0) {
      html += '<span class="memory-theme">' + escapeHTML(m.themes[0]) + '</span>';
    } else {
      html += '<span class="memory-theme">今天的表达</span>';
    }
    html += '</div>';
    html += '</div>';
    return html;
  }

  function renderGrowthPage() {
    var headline = document.getElementById("growthHeadline");
    if (headline) headline.textContent = getGrowthHeadline();

    var sub = document.getElementById("growthSub");
    if (sub) sub.textContent = getGrowthSub();

    var p = getPatterns();

    // 异步加载成长数据（含陪伴人数、空状态）
    loadAndApplyGrowthData();

    // 记忆时间线（只展示最早和最近，形成时间对比，不列全部）
    var timeline = document.getElementById("memoryTimeline");
    if (timeline) {
      var allMemories = bubbleDNA.memories;
      var html = "";
      if (allMemories.length === 0) {
        html += '<div class="memory-empty">Bubble 还在等待你的第一次表达。</div>';
      } else if (allMemories.length <= 2) {
        // 两条以内，直接展示
        for (var i = allMemories.length - 1; i >= 0; i--) {
          var m = allMemories[i];
          var isLatest = (i === allMemories.length - 1);
          html += buildMemoryEntry(m, isLatest);
          if (i > 0) html += '<span class="memory-line"></span>';
        }
      } else {
        // 超过两条：只展示最早和最近，中间省略
        var earliest = allMemories[0];
        var latest = allMemories[allMemories.length - 1];
        var hiddenCount = allMemories.length - 2;

        html += buildMemoryEntry(latest, true);
        html += '<span class="memory-line"></span>';
        html += '<div class="memory-gap">还有 ' + hiddenCount + ' 条沉淀</div>';
        html += '<span class="memory-line"></span>';
        html += buildMemoryEntry(earliest, false);
      }
      timeline.innerHTML = html;
    }

    // 成长故事（一次只展示一个发现，像翻书）
    var storiesEl = document.getElementById("growthStories");
    var storiesSection = storiesEl ? storiesEl.closest('.growth-stories-section') : null;
    if (storiesEl) {
      var stories = generateGrowthStories();
      growthStoryIndex = 0;
      if (stories.length === 0) {
        // 没有足够记忆做发现，隐藏整个 section
        storiesEl.innerHTML = '';
        if (storiesSection) storiesSection.style.display = 'none';
      } else {
        if (storiesSection) storiesSection.style.display = '';
        renderOneGrowthStory(storiesEl, stories);
      }
    }

    // 影响卡片：仅 demo 模式用本地 bubbleDNA.totalResponses 兜底
    // 真实模式留给 loadAndApplyGrowthData 用后端 impact.accompanied_count 写入
    var impactText = document.querySelector(".impact-text");
    if (impactText && isDemoMode && bubbleDNA.totalResponses > 0) {
      var count = 3 + bubbleDNA.totalResponses;
      impactText.innerHTML = "你的经历，陪伴了 <strong>" + count + " 位</strong>正在经历相似感受的人。";
    }
  }

  // 异步加载成长数据，并刷新影响卡片（不阻塞页面渲染）
  async function loadAndApplyGrowthData() {
    var data = await loadGrowthData();
    if (!data) {
      // 后端不可达：保持本地 renderGrowthPage 已渲染的内容
      return;
    }

    // 空状态：后端没有数据 → 显示空状态元素、隐藏主内容
    var empty = document.getElementById("growthEmptyState");
    var memorySection = document.getElementById("memorySection");
    var storiesSection = document.getElementById("growthStoriesSection");
    var impactSection = document.getElementById("impactSection");
    var resonanceLead = document.querySelector(".resonance-lead");
    var screen = document.querySelector('.screen[data-screen="growth"]');
    var body = screen ? screen.querySelector(".screen-body") : null;
    var hasLocalData = bubbleDNA.memories.length > 0;

    if (data.empty_state === true && !hasLocalData) {
      // 真·空状态
      if (empty) empty.hidden = false;
      if (memorySection) memorySection.style.display = "none";
      if (storiesSection) storiesSection.style.display = "none";
      if (impactSection) impactSection.style.display = "none";
      if (resonanceLead) resonanceLead.style.display = "none";
      var actionStack = screen ? screen.querySelector(".action-stack") : null;
      if (actionStack) actionStack.style.display = "none";
      return;
    }

    // 非空状态：恢复显示
    if (empty) empty.hidden = true;
    if (memorySection) memorySection.style.display = "";
    if (storiesSection) storiesSection.style.display = "";
    if (impactSection) impactSection.style.display = "";
    if (resonanceLead) resonanceLead.style.display = "";
    var actionStack2 = screen ? screen.querySelector(".action-stack") : null;
    if (actionStack2) actionStack2.style.display = "";

    // 优先使用后端 discoveries + timeline
    if (Array.isArray(data.discoveries) && data.discoveries.length > 0) {
      renderBackendDiscoveries(data.discoveries);
    } else if (!isDemoMode) {
      // 真实账号且后端无发现 → 隐藏发现区
      if (storiesSection) storiesSection.style.display = "none";
    }

    if (Array.isArray(data.timeline) && data.timeline.length > 0) {
      renderBackendTimeline(data.timeline);
    } else if (!isDemoMode) {
      // 真实账号且后端无 timeline → 显示本地记忆列表
      renderLocalTimeline();
    } else {
      renderLocalTimeline();
    }

    // 更新影响数字（如果后端给了）
    var impactText = document.querySelector(".impact-text");
    if (impactText && data.impact) {
      var accompanied = (data.impact.accompanied_count != null) ? data.impact.accompanied_count : (3 + bubbleDNA.totalResponses);
      impactText.innerHTML = "你的经历，陪伴了 <strong>" + accompanied + " 位</strong>正在经历相似感受的人。";
    }

    // 填充"今天还有 N 位处于相似阶段"占位（来自后端 impact.similar_phase_count）
    var similarEl = document.getElementById('similarPhaseCount');
    if (similarEl && data.impact && data.impact.similar_phase_count != null) {
      similarEl.textContent = data.impact.similar_phase_count + ' 位';
    }
  }

  function renderBackendDiscoveries(discoveries) {
    var storiesEl = document.getElementById("growthStories");
    var storiesSection = storiesEl ? storiesEl.closest('.growth-stories-section') : null;
    if (!storiesEl) return;
    if (storiesSection) storiesSection.style.display = '';
    var html = '';
    for (var i = 0; i < discoveries.length; i++) {
      var d = discoveries[i] || {};
      html += '<div class="growth-story-card growth-story-card--single">';
      html += '<span class="growth-story-tag">' + (d.title || "发现") + '</span>';
      html += '<p class="growth-story-text">' + (d.content || "") + '</p>';
      if (d.evidence_count) {
        html += '<p class="growth-story-meta">基于 ' + d.evidence_count + ' 条记录</p>';
      }
      html += '</div>';
    }
    storiesEl.innerHTML = html;
  }

  function renderBackendTimeline(timeline) {
    var timelineEl = document.getElementById("memoryTimeline");
    if (!timelineEl) return;
    var html = '';
    for (var i = 0; i < timeline.length; i++) {
      var item = timeline[i] || {};
      html += '<div class="memory-entry">';
      html += '<span class="memory-dot"></span>';
      html += '<div class="memory-content">';
      html += '<span class="memory-time">' + escapeHTML(item.week || "") + '</span>';
      html += '<p class="memory-snippet">' + escapeHTML(item.first_text || "") + '</p>';
      if (item.count) {
        html += '<span class="memory-theme">本周 ' + item.count + ' 条</span>';
      }
      html += '</div></div>';
    }
    timelineEl.innerHTML = html;
  }

  function renderLocalTimeline() {
    var timelineEl = document.getElementById("memoryTimeline");
    if (!timelineEl) return;
    var allMemories = bubbleDNA.memories;
    var html = "";
    if (allMemories.length === 0) {
      html += '<div class="memory-empty">Bubble 还在等待你的第一次表达。</div>';
    } else if (allMemories.length <= 2) {
      for (var i = allMemories.length - 1; i >= 0; i--) {
        var m = allMemories[i];
        var isLatest = (i === allMemories.length - 1);
        html += buildMemoryEntry(m, isLatest);
        if (i > 0) html += '<span class="memory-line"></span>';
      }
    } else {
      var earliest = allMemories[0];
      var latest = allMemories[allMemories.length - 1];
      var hiddenCount = allMemories.length - 2;
      html += buildMemoryEntry(latest, true);
      html += '<span class="memory-line"></span>';
      html += '<div class="memory-gap">还有 ' + hiddenCount + ' 条沉淀</div>';
      html += '<span class="memory-line"></span>';
      html += buildMemoryEntry(earliest, false);
    }
    timelineEl.innerHTML = html;
  }

  function renderOneGrowthStory(container, stories) {
    if (!container || stories.length === 0) return;
    var idx = Math.min(growthStoryIndex, stories.length - 1);
    var s = stories[idx];
    var html = '';
    html += '<div class="growth-story-card growth-story-card--single">';
    html += '<span class="growth-story-tag">' + escapeHTML(s.tag) + '</span>';
    html += '<p class="growth-story-text">' + escapeHTML(s.text) + '</p>';
    // 展示用户原话引用——以小泡泡形态呈现
    if (s.quotes && s.quotes.length > 0) {
      html += '<div class="story-bubbles">';
      for (var q = 0; q < s.quotes.length; q++) {
        html += '<div class="story-bubble">';
        html += '<div class="story-bubble-liquid"></div>';
        html += '<span class="story-bubble-time">' + escapeHTML(s.quotes[q].time) + '</span>';
        html += '<p class="story-bubble-text">' + escapeHTML(s.quotes[q].text) + '</p>';
        html += '</div>';
        if (q < s.quotes.length - 1) {
          html += '<div class="story-bubble-link"><span></span></div>';
        }
      }
      html += '</div>';
    }
    html += '</div>';

    // 如果还有更多发现，显示一个轻轻的提示
    if (idx < stories.length - 1) {
      html += '<button class="story-next-hint" type="button">';
      html += '还有一个发现';
      html += '</button>';
    }

    container.innerHTML = html;

    // 绑定"还有一个发现"
    var nextBtn = container.querySelector('.story-next-hint');
    if (nextBtn) {
      nextBtn.addEventListener("click", function () {
        growthStoryIndex++;
        renderOneGrowthStory(container, stories);
      });
    }
  }

  // ====== 我的：资料、数据与经期管理 ======
  function setProfileActionState(button, busy, label) {
    if (!button) return;
    button.disabled = busy;
    button.setAttribute('aria-busy', busy ? 'true' : 'false');
    // 带图标和说明的资料行保持原有结构，只标记进行中状态。
    if (button.children.length) return;
    if (!button.dataset.defaultLabel) button.dataset.defaultLabel = button.textContent;
    button.textContent = busy ? label : button.dataset.defaultLabel;
  }

  function setProfileIdentity(name, email, state) {
    var nameEl = document.getElementById('profileName');
    var emailEl = document.getElementById('profileEmail');
    var stateEl = document.getElementById('profileState');
    if (nameEl) nameEl.textContent = name;
    if (emailEl) emailEl.textContent = email || '';
    if (stateEl) stateEl.textContent = state;
  }

  function setProfileManagementVisibility(isDemo) {
    var privacy = document.getElementById('profilePrivacySection');
    var demoNote = document.getElementById('profileDemoNote');
    var logout = document.getElementById('profileLogoutBtn');
    if (privacy) privacy.hidden = isDemo;
    if (demoNote) demoNote.hidden = !isDemo;
    if (logout) logout.hidden = isDemo;
  }

  async function renderProfilePage() {
    var memoryCount = document.getElementById('profileMemoryCount');
    var cycleCount = document.getElementById('profilePeriodCount');
    if (isDemoMode) {
      setProfileIdentity('体验用户 · 这是 Bubble 旅程样例', '探索模式', '所有内容不会保存 · 登录后可以使用完整功能');
      if (memoryCount) memoryCount.textContent = bubbleDNA.totalRecords || '–';
      if (cycleCount) cycleCount.textContent = '–';
      setProfileManagementVisibility(true);
      return;
    }
    setProfileManagementVisibility(false);
    setProfileIdentity('正在加载', '', '这是只属于你的私密空间');
    if (memoryCount) memoryCount.textContent = '–';
    if (cycleCount) cycleCount.textContent = '–';
    try {
      var summary = await CB_API.profile.summary();
      setProfileIdentity(summary.nickname || '还没有昵称', summary.email, '这是只属于你的私密空间');
      if (memoryCount) memoryCount.textContent = String(summary.memory_count || 0);
      if (cycleCount) cycleCount.textContent = String(summary.cycle_count || 0);
    } catch (e) {
      setProfileIdentity('暂时无法加载资料', '', e.message || '请稍后重试');
    }
  }

  function showPeriodError(message) {
    var error = document.getElementById('periodFormError');
    if (!error) return;
    error.textContent = message || '';
    error.hidden = !message;
  }

  function resetPeriodForm() {
    var form = document.getElementById('periodForm');
    var id = document.getElementById('periodEditingId');
    var button = document.getElementById('periodSaveBtn');
    var cancel = document.getElementById('periodCancelBtn');
    if (form) form.reset();
    if (id) id.value = '';
    if (button) {
      button.textContent = '添加记录';
      button.dataset.defaultLabel = '添加记录';
    }
    if (cancel) cancel.hidden = true;
    showPeriodError('');
  }

  function flowLabel(flow) {
    return ({ light: '量少', medium: '适中', heavy: '量多' })[flow] || '未记录流量';
  }

  function renderPeriodsList(periods) {
    var list = document.getElementById('periodsList');
    var empty = document.getElementById('periodsEmptyState');
    if (!list || !empty) return;
    list.textContent = '';
    empty.hidden = periods.length !== 0;
    for (var i = 0; i < periods.length; i++) {
      (function (period) {
        var row = document.createElement('div');
        row.className = 'period-row';
        var main = document.createElement('div');
        main.className = 'period-row-main';
        var date = document.createElement('span');
        date.className = 'period-row-date';
        date.textContent = period.start_date + (period.end_date ? ' 至 ' + period.end_date : ' 开始');
        var meta = document.createElement('span');
        meta.className = 'period-row-meta';
        meta.textContent = flowLabel(period.flow) + ' · ' + (period.source === 'manual' ? '手动记录' : '已导入');
        main.appendChild(date);
        main.appendChild(meta);
        var edit = document.createElement('button');
        edit.type = 'button'; edit.className = 'period-row-action'; edit.textContent = '编辑';
        edit.addEventListener('click', function () {
          document.getElementById('periodEditingId').value = period.id;
          document.getElementById('periodStartDate').value = period.start_date;
          document.getElementById('periodEndDate').value = period.end_date || '';
          document.getElementById('periodFlow').value = period.flow || '';
          document.getElementById('periodSaveBtn').textContent = '保存修改';
          document.getElementById('periodSaveBtn').dataset.defaultLabel = '保存修改';
          document.getElementById('periodCancelBtn').hidden = false;
          document.getElementById('periodStartDate').focus();
        });
        var remove = document.createElement('button');
        remove.type = 'button'; remove.className = 'period-row-action period-row-action--delete'; remove.textContent = '删除';
        remove.addEventListener('click', async function () {
          if (!window.confirm('删除这条经期记录？')) return;
          try {
            await CB_API.cycle.deletePeriod(period.id);
            await loadPeriods();
            await loadCycleStatus();
            renderProfilePage();
          } catch (e) { showPeriodError(e.message || '删除失败'); }
        });
        row.appendChild(main); row.appendChild(edit); row.appendChild(remove);
        list.appendChild(row);
      })(periods[i]);
    }
  }

  async function loadPeriods() {
    if (isDemoMode) {
      showDemoToast('这是体验样例 · 登录后可以管理自己的经期记录');
      switchTo('profile');
      return;
    }
    try {
      var result = await CB_API.cycle.listPeriods();
      renderPeriodsList((result && result.periods) || []);
    } catch (e) {
      showPeriodError(e.message || '加载经期记录失败');
    }
  }

  var periodForm = document.getElementById('periodForm');
  if (periodForm) periodForm.addEventListener('submit', async function (event) {
    event.preventDefault();
    var id = document.getElementById('periodEditingId').value;
    var start = document.getElementById('periodStartDate').value;
    var end = document.getElementById('periodEndDate').value;
    var flow = document.getElementById('periodFlow').value;
    var button = document.getElementById('periodSaveBtn');
    if (end && end < start) { showPeriodError('结束日期必须晚于开始日期'); return; }
    showPeriodError('');
    setProfileActionState(button, true, '正在保存');
    try {
      if (id) await CB_API.cycle.updatePeriod(id, { start_date: start, end_date: end || null, flow: flow || null });
      else await CB_API.cycle.addPeriod(start, end || null, flow || null);
      resetPeriodForm();
      await loadPeriods();
      await loadCycleStatus();
      renderProfilePage();
    } catch (e) { showPeriodError(e.message || '保存失败'); }
    finally { setProfileActionState(button, false); }
  });

  var periodCancel = document.getElementById('periodCancelBtn');
  if (periodCancel) periodCancel.addEventListener('click', resetPeriodForm);

  function bindProfileButton(id, handler) {
    var button = document.getElementById(id);
    if (button) button.addEventListener('click', handler);
  }

  bindProfileButton('periodsEntryBtn', function () {
    if (isDemoMode) { showDemoToast('这是体验样例 · 登录后可以管理自己的经期记录'); return; }
    switchTo('periods');
  });
  bindProfileButton('profileImportBtn', function () {
    if (isDemoMode) { showDemoToast('这是体验样例 · 登录后可以导入自己的经期数据'); return; }
    switchTo('import');
  });
  bindProfileButton('exportJsonBtn', async function () {
    var button = this; setProfileActionState(button, true, '正在准备');
    try { await CB_API.profile.exportJson(); } catch (e) { showDemoToast(e.message || '导出失败'); }
    finally { setProfileActionState(button, false); }
  });
  bindProfileButton('exportHtmlBtn', async function () {
    var button = this; setProfileActionState(button, true, '正在准备');
    try { await CB_API.profile.exportHtml(); } catch (e) { showDemoToast(e.message || '导出失败'); }
    finally { setProfileActionState(button, false); }
  });
  bindProfileButton('deleteAccountEntryBtn', function () { switchTo('delete-account'); });
  bindProfileButton('profileLogoutBtn', function () {
    CB_API.auth.logout();
    isDemoMode = false;
    syncDemoFlag();
    refreshDemoBar();
    switchTo('auth');
  });

  var deleteAccountForm = document.getElementById('deleteAccountForm');
  if (deleteAccountForm) deleteAccountForm.addEventListener('submit', async function (event) {
    event.preventDefault();
    var password = document.getElementById('deleteAccountPassword').value;
    var acknowledged = document.getElementById('deleteAccountAcknowledged').checked;
    var error = document.getElementById('deleteAccountError');
    var button = document.getElementById('deleteAccountSubmit');
    error.hidden = true;
    if (!password || !acknowledged) {
      error.textContent = '请输入当前密码并确认删除后无法恢复'; error.hidden = false; return;
    }
    setProfileActionState(button, true, '正在永久删除');
    try {
      await CB_API.profile.deleteAccount(password, acknowledged);
      CB_API.auth.logout();
      isDemoMode = false;
      syncDemoFlag();
      refreshDemoBar();
      bubbleDNA = JSON.parse(JSON.stringify(defaultDNA));
      saveDNA();
      deleteAccountForm.reset();
      switchTo('auth');
    } catch (e) { error.textContent = e.message || '删除失败'; error.hidden = false; }
    finally { setProfileActionState(button, false); }
  });

  // ====== 登录/注册状态与 helper ======
  // 与后端 CB_API.auth.* 配合。仅添加事件处理，不触碰视觉/Bubble 状态逻辑。
  var isRegisterMode = false;

  function showAuthError(message) {
    var errEl = document.getElementById('authError');
    if (!errEl) return;
    if (message) {
      errEl.textContent = message;
      errEl.hidden = false;
    } else {
      errEl.hidden = true;
    }
  }

  function updateAuthMode() {
    var submitBtn = document.getElementById('authSubmit');
    var toggleBtn = document.getElementById('authToggle');
    var nickField = document.getElementById('authNicknameField');
    if (submitBtn) submitBtn.textContent = isRegisterMode ? '注册' : '登录';
    if (toggleBtn) toggleBtn.textContent = isRegisterMode ? '已有账号？登录' : '还没有账号？注册';
    if (nickField) nickField.hidden = !isRegisterMode;
    showAuthError('');
  }

  // ====== 页面切换 ======
  function isUserLoggedIn() {
    return !!(window.CB_API && CB_API.auth && CB_API.auth.isLoggedIn && CB_API.auth.isLoggedIn());
  }

  // 未登录时允许停留/进入的页面
  var PUBLIC_SCREENS = {
    auth: true,
    home: true
  };

  // 未登录时统一把目标页改写为登录页，避免被任何入口绕过。
  function guardRoute(name) {
    if (!name) return 'auth';
    if (isDemoMode) return name; // 演示模式不拦截
    if (isUserLoggedIn()) return name;
    if (PUBLIC_SCREENS[name]) return name;
    return 'auth';
  }

  function switchTo(name) {
    name = guardRoute(name);
    var screens = document.querySelectorAll(".screen");
    for (var i = 0; i < screens.length; i++) screens[i].classList.remove("active");
    var target = document.querySelector('.screen[data-screen="' + name + '"]');
    if (target) {
      target.classList.add("active");
      var body = target.querySelector(".screen-body");
      if (body) body.scrollTop = 0;
    }
    var tabs = document.querySelectorAll(".tab-item");
    for (var j = 0; j < tabs.length; j++) tabs[j].classList.remove("active");
    var at = document.querySelector('.tab-item[data-goto="' + name + '"]');
    if (at) at.classList.add("active");

    if (name === "home") applyBubbleState();
    if (name === "insight") renderInsightPage();
    if (name === "growth") renderGrowthPage();
    if (name === "resonance") renderResonanceFeed();
    if (name === "profile") renderProfilePage();
    if (name === "periods") loadPeriods();
  }

  var tabItems = document.querySelectorAll(".tab-item");
  for (var t = 0; t < tabItems.length; t++) {
    tabItems[t].addEventListener("click", function () {
      switchTo(this.getAttribute("data-goto"));
    });
  }

  var gotoEls = document.querySelectorAll("[data-goto]");
  for (var g = 0; g < gotoEls.length; g++) {
    if (!gotoEls[g].classList.contains("tab-item")) {
      gotoEls[g].addEventListener("click", function () {
        switchTo(this.getAttribute("data-goto"));
      });
    }
  }

  var backEls = document.querySelectorAll("[data-back]");
  for (var b = 0; b < backEls.length; b++) {
    backEls[b].addEventListener("click", function () {
      switchTo(this.getAttribute("data-back"));
    });
  }

  // ====== 记录页：放进泡泡 → 沉淀 → 理解 ======
  var saveBtn = document.getElementById("saveBtn");
  var bubbleSettling = document.getElementById("bubbleSettling");
  var settlingLiquid = document.getElementById("settlingLiquid");
  var settlingText = document.getElementById("settlingText");
  var recordInput = document.getElementById("recordInput");
  var noteField = document.getElementById("noteField");
  var recordHead = document.getElementById("recordHead");

  var settlingMessages = [
    "Bubble 正在把今天收进来……",
    "今天正在慢慢沉淀……",
    "Bubble 正在记住这个瞬间……",
    "今天正在成为理解你的一部分……"
  ];

  if (saveBtn) {
    saveBtn.addEventListener("click", function () {
      // 演示模式拦截：弹 toast 提示但不保存
      if (isDemoMode) {
        showDemoToast('这是体验样例 · 登录后可以记录你自己的情绪');
        return;
      }

      // 没输入任何文字时直接提示并返回，绝不虚拟造假。
      // 之前会用 "今天开会时领导说了一句话..." 这种默认文本冒充用户记录，
      // 严重违背"只属于你的私密空间"的产品承诺——即使没有 AI 也不能伪造。
      var rawInput = recordInput && recordInput.value ? recordInput.value : '';
      var userInput = rawInput.trim();
      if (!userInput) {
        showDemoToast('请先写点什么，再放进泡泡');
        if (recordInput) recordInput.focus();
        return;
      }

      saveBtn.style.display = "none";
      if (noteField) noteField.style.display = "none";
      if (recordHead) recordHead.style.display = "none";
      if (bubbleSettling) bubbleSettling.hidden = false;

      var msgIdx = 0;
      if (settlingText) settlingText.textContent = settlingMessages[0];
      var msgInterval = setInterval(function () {
        msgIdx = (msgIdx + 1) % settlingMessages.length;
        if (settlingText) settlingText.textContent = settlingMessages[msgIdx];
      }, 1800);

      if (settlingLiquid) settlingLiquid.classList.add("rising");

      // 3 秒后：结构化抽取 → 存入 Memory → Pattern 更新 → 跳转理解页
      setTimeout(function () {
        clearInterval(msgInterval);

        if (isDemoMode) {
          // 演示模式：后端会 403 拒绝。前端给个友好提示后直接跳到 insight。
          showDemoToast('这是体验样例 · 登录后可以记录你自己的情绪');
          switchTo("insight");
          applyBubbleState();
        } else {
          // 真实模式：调后端持久化
          persistMemoryToBackend(userInput).then(function (ok) {
            switchTo("insight");
            applyBubbleState();
          }).catch(function (err) {
            // 后端失败：不静默写本地（避免演示模式记忆伪装成真实记录）
            console.warn('保存到后端失败:', err);
            showDemoToast('保存失败，请稍后再试');
            switchTo("insight");
            applyBubbleState();
          });
        }

        setTimeout(function () {
          saveBtn.style.display = "";
          if (recordInput) recordInput.value = "";
          if (noteField) noteField.style.display = "";
          if (recordHead) recordHead.style.display = "";
          if (bubbleSettling) bubbleSettling.hidden = true;
          if (settlingLiquid) settlingLiquid.classList.remove("rising");
        }, 500);
      }, 3000);
    });
  }

  // 真实模式：调后端 POST /api/memories，成功后用后端返回的数据更新 bubbleDNA
  function isRecordPublicChecked() {
    var box = document.getElementById('recordIsPublic');
    return !!(box && box.checked);
  }

  function ackFirstPublic() {
    try {
      if (localStorage.getItem('cb_public_ack') === '1') return true;
      localStorage.setItem('cb_public_ack', '1');
    } catch (e) { return false; }
    return false;
  }

  async function persistMemoryToBackend(rawText) {
    if (!window.CB_API || !CB_API.memory || !CB_API.memory.create) {
      throw new Error('API 不可用');
    }
    var isPublic = isRecordPublicChecked();
    if (isPublic && !ackFirstPublic()) {
      showDemoToast('记录将匿名出现在共鸣流，请确认内容可以分享');
    }
    var resp = await CB_API.memory.create(rawText, isPublic);
    if (!resp || !resp.id) {
      throw new Error('后端响应无效');
    }
    var local = backendMemoryToLocal(resp);
    bubbleDNA.memories.push(local);
    bubbleDNA.totalRecords = bubbleDNA.memories.length;
    bubbleDNA._patternsCache = null;
    bubbleDNA._patternsCacheVersion++;
    bubbleDNA.evolution.push({
      type: "memory_added",
      time: Date.now(),
      memoryId: local.id,
      themes: local.themes
    });
    saveDNA();
    // 危机信号：如果后端检测到风险词，前端弹援助 modal
    if (resp.crisis && resp.crisis.risk_level && resp.crisis.risk_level !== 'none') {
      showCrisisModal(resp.crisis.resources);
    }
    return true;
  }

  // ====== 回应系统 ======
  var resonanceCards = document.querySelectorAll(".resonance-card");
  var pageDots = document.querySelectorAll("#pageDots i");
  var currentIndex = 0;
  var totalCards = resonanceCards.length;

  function updatePager() {
    for (var d = 0; d < pageDots.length; d++) pageDots[d].classList.remove("active");
    if (pageDots[currentIndex]) pageDots[currentIndex].classList.add("active");
  }

  function nextCard() {
    if (currentIndex >= totalCards - 1) return;
    resonanceCards[currentIndex].classList.remove("active");
    resonanceCards[currentIndex].classList.add("leaving");
    setTimeout(function () {
      resonanceCards[currentIndex].classList.remove("leaving");
      currentIndex++;
      resonanceCards[currentIndex].classList.add("active");
      updatePager();
    }, 450);
  }

  var lightPoints = document.getElementById("lightPoints");

  function addLightPoint(type) {
    if (!lightPoints) return;
    var point = document.createElement("span");
    point.className = "light-point light-point--" + type;
    point.style.left = (15 + Math.random() * 70) + "%";
    point.style.bottom = (10 + Math.random() * 60) + "%";
    lightPoints.appendChild(point);
  }

  // 回应芯片与送出按钮的逻辑已统一由 bindResponseChips / bindResponseSends 处理
  // 真正共鸣卡（renderResonanceFeed 渲染）会调用这两个函数。
  // 此处保留空占位，避免对未来静态卡片重复绑定。

  // ====== 关于弹层 ======
  var aboutLink = document.getElementById("aboutLink");
  var aboutModal = document.getElementById("aboutModal");
  var aboutClose = document.getElementById("aboutClose");

  if (aboutLink) aboutLink.addEventListener("click", function () { aboutModal.hidden = false; });
  if (aboutClose) aboutClose.addEventListener("click", function () { aboutModal.hidden = true; });
  if (aboutModal) aboutModal.addEventListener("click", function (e) {
    if (e.target === aboutModal) aboutModal.hidden = true;
  });

  // 重新开始：清除所有数据，设置重置标记，变成真正的空状态
  // 挂载到 window 以便内联 onclick 也能调用
  window.__bubbleReset = function () {
    try {
      localStorage.removeItem("bubbleDNA_v6");
      localStorage.removeItem("bubbleSeeded_v6");
      localStorage.setItem("bubbleReset_v6", "true");
    } catch (e) {}
    var modal = document.getElementById("aboutModal");
    if (modal) modal.hidden = true;
    setTimeout(function () {
      window.location.reload();
    }, 200);
  };

  var aboutReset = document.getElementById("aboutReset");
  if (aboutReset) {
    aboutReset.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      window.__bubbleReset();
    });
  }

  // ====== 漂浮粒子（内部生命） ======
  var floatingParticles = document.getElementById("floatingParticles");
  var settlingParticles = document.getElementById("settlingParticles");

  function spawnParticle(container) {
    if (!container) return;
    var st = computeBubbleState();
    var existing = container.querySelectorAll(".particle");
    if (existing.length >= st.particleDensity + 3) {
      if (existing[0].parentNode) existing[0].parentNode.removeChild(existing[0]);
    }
    var p = document.createElement("span");
    p.className = "particle";
    var size = 2 + Math.random() * 3;
    p.style.width = size + "px";
    p.style.height = size + "px";
    p.style.left = (10 + Math.random() * 80) + "%";
    p.style.bottom = (5 + Math.random() * 50) + "%";
    var duration = 4 + Math.random() * 6;
    p.style.animationDuration = duration + "s";
    p.style.animationDelay = (Math.random() * 2) + "s";
    p.style.opacity = "0";
    container.appendChild(p);
    setTimeout(function () {
      if (p.parentNode) p.parentNode.removeChild(p);
    }, (duration + 3) * 1000);
  }

  function startParticles(container) {
    if (!container) return;
    spawnParticle(container);
    var interval = 2000 + Math.random() * 2000;
    setTimeout(function () { startParticles(container); }, interval);
  }
  startParticles(floatingParticles);
  startParticles(settlingParticles);

  // ====== 泡泡水流动画（液体表面，始终流动） ======
  var waveBack = document.getElementById("waveBack");
  var waveMid = document.getElementById("waveMid");
  var waveFront = document.getElementById("waveFront");

  if (waveBack && waveMid && waveFront) {
    var waves = [
      { el: waveBack, amp: 10, freq: 0.04, speed: 0.7, phase: 0 },
      { el: waveMid, amp: 8, freq: 0.05, speed: 1.0, phase: 1.5 },
      { el: waveFront, amp: 6, freq: 0.045, speed: 0.5, phase: 3.0 }
    ];

    function buildWavePath(t, amp, freq, speed, phase) {
      var points = [];
      var baseline = 20;
      for (var x = 0; x <= 600; x += 10) {
        var y = baseline + Math.sin(x * freq + t * speed + phase) * amp;
        points.push(x + "," + y.toFixed(2));
      }
      return "M" + points.join(" L") + " L600,40 L0,40 Z";
    }

    var startTime = performance.now();
    function animateWaves(now) {
      var t = (now - startTime) / 1000;
      for (var i = 0; i < waves.length; i++) {
        waves[i].el.setAttribute("d", buildWavePath(t, waves[i].amp, waves[i].freq, waves[i].speed, waves[i].phase));
      }
      requestAnimationFrame(animateWaves);
    }
    requestAnimationFrame(animateWaves);
  }

  // ====== 经期导入交互（手动 / 美柚 / Apple Health） ======
  // 只追加：helpers + 事件绑定。不触碰视觉与 Bubble 状态逻辑。
  // 屏幕切换复用现有 switchTo() 函数。

  function showImportPanel(name) {
    ['importManualPanel', 'importManyouPanel', 'importApplePanel', 'importSuccessPanel'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.hidden = (id !== name);
    });
  }

  function showImportSuccess(message) {
    var textEl = document.getElementById('importSuccessText');
    if (textEl) textEl.textContent = message;
    showImportPanel('importSuccessPanel');
  }

  // 构建手动输入的 6 行日期输入框
  function buildManualDateInputs() {
    var list = document.getElementById('importManualList');
    if (!list) return;
    list.innerHTML = '';
    var labels = ['最近一次', '上一次', '再上一次', '更早一次', '更早两次', '更早三次'];
    for (var i = 0; i < 6; i++) {
      var row = document.createElement('div');
      row.className = 'import-manual-row';
      var label = document.createElement('label');
      label.textContent = labels[i];
      var input = document.createElement('input');
      input.type = 'date';
      input.dataset.idx = String(i);
      row.appendChild(label);
      row.appendChild(input);
      list.appendChild(row);
    }
  }

  // 齿轮按钮：进入导入页
  var gearBtn = document.getElementById('gearBtn');
  if (gearBtn) {
    gearBtn.addEventListener('click', function () {
      if (typeof switchTo === 'function') {
        switchTo('import');
      }
      buildManualDateInputs();
      // 进入时显示选项列表：隐藏所有具体 panel
      ['importManualPanel', 'importManyouPanel', 'importApplePanel', 'importSuccessPanel'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.hidden = true;
      });
    });
  }

  // 三个选项按钮
  var importOptionBtns = document.querySelectorAll('.import-option');
  for (var io = 0; io < importOptionBtns.length; io++) {
    importOptionBtns[io].addEventListener('click', function () {
      var source = this.getAttribute('data-source');
      if (source === 'manual') {
        showImportPanel('importManualPanel');
        buildManualDateInputs();
      } else if (source === 'manyou') {
        showImportPanel('importManyouPanel');
      } else if (source === 'apple') {
        showImportPanel('importApplePanel');
      }
    });
  }

  // 取消按钮（各自返回选项列表）
  var manualCancel = document.getElementById('importManualCancel');
  if (manualCancel) manualCancel.addEventListener('click', function () {
    var el = document.getElementById('importManualPanel');
    if (el) el.hidden = true;
  });

  var manyouCancel = document.getElementById('importManyouCancel');
  if (manyouCancel) manyouCancel.addEventListener('click', function () {
    var el = document.getElementById('importManyouPanel');
    if (el) el.hidden = true;
    var manyouFileInputReset = document.getElementById('importManyouFile');
    if (manyouFileInputReset) manyouFileInputReset.value = '';
    var previewReset = document.getElementById('importManyouPreview');
    if (previewReset) previewReset.textContent = '';
    var submitReset = document.getElementById('importManyouSubmit');
    if (submitReset) submitReset.disabled = true;
  });

  var appleCancel = document.getElementById('importAppleCancel');
  if (appleCancel) appleCancel.addEventListener('click', function () {
    var el = document.getElementById('importApplePanel');
    if (el) el.hidden = true;
    var appleFileInputReset = document.getElementById('importAppleFile');
    if (appleFileInputReset) appleFileInputReset.value = '';
    var previewReset = document.getElementById('importApplePreview');
    if (previewReset) previewReset.textContent = '';
    var submitReset = document.getElementById('importAppleSubmit');
    if (submitReset) submitReset.disabled = true;
  });

  // 手动提交：逐条调用 addPeriod
  var manualSubmit = document.getElementById('importManualSubmit');
  if (manualSubmit) {
    manualSubmit.addEventListener('click', async function () {
      var inputs = document.querySelectorAll('#importManualList input[type="date"]');
      var toSubmit = [];
      inputs.forEach(function (inp) { if (inp.value) toSubmit.push(inp.value); });
      if (toSubmit.length === 0) {
        alert('请至少填写一个日期');
        return;
      }
      manualSubmit.disabled = true;
      var origText = manualSubmit.textContent;
      manualSubmit.textContent = '导入中...';
      var ok = 0, fail = 0;
      for (var i = 0; i < toSubmit.length; i++) {
        try {
          await CB_API.cycle.addPeriod(toSubmit[i], null, null);
          ok++;
        } catch (e) {
          console.warn('导入失败:', e);
          fail++;
        }
      }
      manualSubmit.disabled = false;
      manualSubmit.textContent = origText || '提交';
      showImportSuccess('成功导入 ' + ok + ' 条经期记录' + (fail > 0 ? '，' + fail + ' 条失败' : ''));
      // 清空表单
      inputs.forEach(function (inp) { inp.value = ''; });
      // 刷新首页状态
      if (typeof loadCycleStatus === 'function') loadCycleStatus();
    });
  }

  // 美柚文件选择 + 预览
  var manyouFileInput = document.getElementById('importManyouFile');
  if (manyouFileInput) {
    manyouFileInput.addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (ev) {
        try {
          var content = JSON.parse(ev.target.result);
          // 尝试多种格式
          var periods = content.periods || content.data || content;
          if (!Array.isArray(periods)) throw new Error('JSON 中没有找到 periods 数组');
          // 标准化字段名
          var normalized = periods.map(function (p) {
            return {
              start_date: p.start_date || p.startDate || p.start,
              end_date: p.end_date || p.endDate || p.end || null,
              flow: p.flow || null
            };
          }).filter(function (p) { return p.start_date; });
          // 预览
          var preview = document.getElementById('importManyouPreview');
          if (preview) {
            preview.textContent = '检测到 ' + normalized.length + ' 条记录:\n' +
              normalized.slice(0, 5).map(function (p) {
                return '• ' + p.start_date + (p.end_date ? ' → ' + p.end_date : '');
              }).join('\n') +
              (normalized.length > 5 ? '\n... 等 ' + normalized.length + ' 条' : '');
          }
          // 暂存
          manyouFileInput._normalized = normalized;
          var submit = document.getElementById('importManyouSubmit');
          if (submit) submit.disabled = normalized.length === 0;
        } catch (err) {
          var preview2 = document.getElementById('importManyouPreview');
          if (preview2) preview2.textContent = '文件解析失败：' + err.message;
          manyouFileInput._normalized = [];
          var submit2 = document.getElementById('importManyouSubmit');
          if (submit2) submit2.disabled = true;
        }
      };
      reader.onerror = function () {
        var previewErr = document.getElementById('importManyouPreview');
        if (previewErr) previewErr.textContent = '文件读取失败';
      };
      reader.readAsText(file);
    });
  }

  // 美柚提交
  var manyouSubmit = document.getElementById('importManyouSubmit');
  if (manyouSubmit) {
    manyouSubmit.addEventListener('click', async function () {
      var data = manyouFileInput && manyouFileInput._normalized ? manyouFileInput._normalized : [];
      if (data.length === 0) return;
      manyouSubmit.disabled = true;
      var origManyouText = manyouSubmit.textContent;
      manyouSubmit.textContent = '导入中...';
      try {
        var res = await CB_API.cycle.importManyou(data);
        showImportSuccess('成功导入 ' + ((res && res.imported_count) || 0) + ' 条美柚经期数据');
        // 重置文件
        if (manyouFileInput) {
          manyouFileInput.value = '';
          manyouFileInput._normalized = [];
        }
        var previewR = document.getElementById('importManyouPreview');
        if (previewR) previewR.textContent = '';
        // 刷新首页状态
        if (typeof loadCycleStatus === 'function') loadCycleStatus();
      } catch (e) {
        alert('导入失败：' + (e && e.message ? e.message : e));
        manyouSubmit.disabled = false;
        manyouSubmit.textContent = origManyouText || '导入';
      }
    });
  }

  // Apple Health 文件选择 + 预览
  var appleFileInput = document.getElementById('importAppleFile');
  if (appleFileInput) {
    appleFileInput.addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (ev) {
        try {
          var content = JSON.parse(ev.target.result);
          var records = content.records || content.data || content;
          if (!Array.isArray(records)) throw new Error('JSON 中没有找到 records 数组');
          var normalized = records.map(function (r) {
            return {
              startDate: r.startDate || r.start_date || r.start,
              endDate: r.endDate || r.end_date || r.end || null,
              flow: r.flow || null
            };
          }).filter(function (r) { return r.startDate; });
          var preview = document.getElementById('importApplePreview');
          if (preview) {
            preview.textContent = '检测到 ' + normalized.length + ' 条记录:\n' +
              normalized.slice(0, 5).map(function (p) {
                return '• ' + p.startDate + (p.endDate ? ' → ' + p.endDate : '');
              }).join('\n') +
              (normalized.length > 5 ? '\n... 等 ' + normalized.length + ' 条' : '');
          }
          appleFileInput._normalized = normalized;
          var submit = document.getElementById('importAppleSubmit');
          if (submit) submit.disabled = normalized.length === 0;
        } catch (err) {
          var preview2 = document.getElementById('importApplePreview');
          if (preview2) preview2.textContent = '文件解析失败：' + err.message;
          appleFileInput._normalized = [];
          var submit2 = document.getElementById('importAppleSubmit');
          if (submit2) submit2.disabled = true;
        }
      };
      reader.onerror = function () {
        var previewErr = document.getElementById('importApplePreview');
        if (previewErr) previewErr.textContent = '文件读取失败';
      };
      reader.readAsText(file);
    });
  }

  // Apple Health 提交
  var appleSubmit = document.getElementById('importAppleSubmit');
  if (appleSubmit) {
    appleSubmit.addEventListener('click', async function () {
      var data = appleFileInput && appleFileInput._normalized ? appleFileInput._normalized : [];
      if (data.length === 0) return;
      appleSubmit.disabled = true;
      var origAppleText = appleSubmit.textContent;
      appleSubmit.textContent = '导入中...';
      try {
        var res = await CB_API.cycle.importAppleHealth(data);
        showImportSuccess('成功导入 ' + ((res && res.imported_count) || 0) + ' 条 Apple Health 数据');
        if (appleFileInput) {
          appleFileInput.value = '';
          appleFileInput._normalized = [];
        }
        var previewR = document.getElementById('importApplePreview');
        if (previewR) previewR.textContent = '';
        if (typeof loadCycleStatus === 'function') loadCycleStatus();
      } catch (e) {
        alert('导入失败：' + (e && e.message ? e.message : e));
        appleSubmit.disabled = false;
        appleSubmit.textContent = origAppleText || '导入';
      }
    });
  }

  // 返回首页按钮（data-back="home"）
  var backHomeBtns = document.querySelectorAll('[data-back="home"]');
  for (var bh = 0; bh < backHomeBtns.length; bh++) {
    backHomeBtns[bh].addEventListener('click', function () {
      if (typeof switchTo === 'function') switchTo('home');
      // 同时刷新首页 cycle-status
      if (typeof loadCycleStatus === 'function') loadCycleStatus();
    });
  }

  // ====== 登录/注册交互（与 CB_API.auth.* 配合） ======

  // 切换登录/注册模式
  var authToggle = document.getElementById('authToggle');
  if (authToggle) {
    authToggle.addEventListener('click', function () {
      isRegisterMode = !isRegisterMode;
      updateAuthMode();
    });
  }

  // 表单提交（登录或注册）
  var authForm = document.getElementById('authForm');
  if (authForm) {
    authForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      showAuthError('');

      var emailEl = document.getElementById('authEmail');
      var passEl = document.getElementById('authPassword');
      var nickEl = document.getElementById('authNickname');
      var submitBtn = document.getElementById('authSubmit');

      var email = (emailEl && emailEl.value || '').trim();
      var password = (passEl && passEl.value || '').trim();
      var nickname = (nickEl && nickEl.value || '').trim();

      if (!email) { showAuthError('请输入邮箱'); return; }
      if (!password || password.length < 8) { showAuthError('密码至少 8 位'); return; }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = isRegisterMode ? '注册中...' : '登录中...';
      }

      try {
        var data = isRegisterMode
          ? await CB_API.auth.register(email, password, nickname)
          : await CB_API.auth.login(email, password);

        // 登录/注册成功：切换到正常模式
        isDemoMode = false;
        syncDemoFlag();
        refreshDemoBar();
        if (typeof _stopDemoPlayback === 'function') _stopDemoPlayback();

        // 登录/注册成功：清掉本地 demo 种子记忆 + 从后端拉真实数据
        try {
          localStorage.removeItem('bubbleReset_v6');
          bubbleDNA.memories = [];
          bubbleDNA.totalRecords = 0;
          bubbleDNA.totalResponses = 0;
          bubbleDNA.relationshipSignals = [];
          bubbleDNA.communitySignals = [];
          bubbleDNA.evolution = [];
          bubbleDNA._patternsCache = null;
          bubbleDNA._patternsCacheVersion++;
          await loadMemoriesFromBackend();
        } catch (e) {
          console.warn('加载真实记忆失败:', e);
        }

        // 登录/注册成功：隐藏登录页，回到首页
        var loginPill = document.getElementById('loginPill');
        if (loginPill) loginPill.hidden = true;
        if (typeof switchTo === 'function') switchTo('home');
        // 刷新首页数据
        if (typeof loadCycleStatus === 'function') loadCycleStatus();
        // 首次注册：播放 Bubble Genesis 引导动画
        // 触发条件：只要是从"注册"流程进来的用户就一定播放，不再受 cb_genesis_seen 影响
        // （每个新账号都应该有自己的"首次体验"，老用户的 cb_genesis_seen 不应阻断新用户）
        if (isRegisterMode && typeof playGenesis === 'function') {
          // 清掉旧账号留下的 cb_genesis_seen 标记，让当前这个新账号能看到自己的开场动画
          try { localStorage.removeItem('cb_genesis_seen'); } catch (e) {}
          playGenesis(function () {
            var narration = document.getElementById('growthNarration');
            if (narration) narration.textContent = '你的记录正在慢慢形成属于你的 Pattern。';
          });
        }
        // 重置表单
        emailEl.value = '';
        passEl.value = '';
        if (nickEl) nickEl.value = '';
        isRegisterMode = false;
        updateAuthMode();
      } catch (err) {
        showAuthError(err.message || '操作失败，请重试');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = isRegisterMode ? '注册' : '登录';
        }
      }
    });
  }

  // 首页登录提示 → 进入登录页
  var loginPill = document.getElementById('loginPill');
  if (loginPill) {
    loginPill.addEventListener('click', function () {
      isRegisterMode = false;
      updateAuthMode();
      if (typeof switchTo === 'function') switchTo('auth');
    });
  }

  // ====== Bubble Genesis（首次体验引导） ======
  // 3 幕 4 阶段叙事，总约 18 秒。
  // Act 1 (Why): 身体变化 → 情绪变化
  // Act 2 (How): 记录留下痕迹 → 形成 Pattern
  // Act 3 (What): 看见变化，接纳自己
  // 状态记录在 localStorage cb_genesis_seen，播放完成或跳过后永久写入。

  var GENESIS_PHASES = [
    { duration: 5500, text: "身体会变化，所以情绪也会变化。", textDelay: 400 },
    { duration: 4500, text: "每一次记录，都会留下理解自己的线索。", textDelay: 300 },
    { duration: 4500, text: "慢慢沉淀，形成属于你的 Pattern（理解轨迹）。", textDelay: 300 },
    { duration: 4000, text: "慢慢理解自己，发现身体与情绪之间的联系。", textDelay: 200 }
  ];

  function hasSeenGenesis() {
    try { return localStorage.getItem('cb_genesis_seen') === '1'; }
    catch (e) { return false; }
  }

  function markGenesisSeen() {
    try { localStorage.setItem('cb_genesis_seen', '1'); }
    catch (e) {}
  }

  var genesisWaveRAF = null;

  function startGenesisWaves() {
    var waveBack = document.getElementById('genesisWaveBack');
    var waveMid = document.getElementById('genesisWaveMid');
    var waveFront = document.getElementById('genesisWaveFront');
    if (!waveBack || !waveMid || !waveFront) return;

    var waves = [
      { el: waveBack, amp: 7, freq: 0.04, speed: 0.5, phase: 0 },
      { el: waveMid, amp: 5, freq: 0.05, speed: 0.8, phase: 1.5 },
      { el: waveFront, amp: 4, freq: 0.045, speed: 0.4, phase: 3.0 }
    ];

    var startTime = performance.now();

    function animate(now) {
      var t = (now - startTime) / 1000;
      for (var i = 0; i < waves.length; i++) {
        var w = waves[i];
        var points = [];
        var baseline = 20;
        for (var x = 0; x <= 600; x += 10) {
          var y = baseline + Math.sin(x * w.freq + t * w.speed + w.phase) * w.amp;
          points.push(x + "," + y.toFixed(2));
        }
        w.el.setAttribute("d", "M" + points.join(" L") + " L600,40 L0,40 Z");
      }
      genesisWaveRAF = requestAnimationFrame(animate);
    }
    genesisWaveRAF = requestAnimationFrame(animate);
  }

  function stopGenesisWaves() {
    if (genesisWaveRAF) {
      cancelAnimationFrame(genesisWaveRAF);
      genesisWaveRAF = null;
    }
  }

  function playGenesis(onComplete) {
    var overlay = document.getElementById('genesisOverlay');
    if (!overlay) { if (onComplete) onComplete(); return; }

    overlay.hidden = false;
    overlay.classList.remove('genesis-leaving');
    overlay.setAttribute('data-phase', '1');

    var textEl = document.getElementById('genesisText');
    var dots = overlay.querySelectorAll('.genesis-dot');
    var skipBtn = document.getElementById('genesisSkip');
    var particlesEl = document.getElementById('genesisParticles');
    var connectionsEl = document.getElementById('genesisConnections');
    var textureEl = document.getElementById('genesisTexture');

    // 粒子位置（模拟记录进入 Bubble）
    var particlePositions = [
      { left: '32%', bottom: '38%' },
      { left: '55%', bottom: '52%' },
      { left: '42%', bottom: '28%' },
      { left: '62%', bottom: '35%' }
    ];

    // 连线配置（粒子之间的柔和连接 = Pattern 形成）
    var connectionConfigs = [
      { left: '32%', bottom: '38%', width: '55px', rotate: '25deg' },
      { left: '55%', bottom: '52%', width: '48px', rotate: '-35deg' },
      { left: '42%', bottom: '28%', width: '50px', rotate: '40deg' }
    ];

    var timers = [];
    var finished = false;

    function spawnParticle(index) {
      if (!particlesEl) return;
      var p = document.createElement('span');
      p.className = 'genesis-particle';
      var pos = particlePositions[index] || particlePositions[0];
      p.style.left = pos.left;
      p.style.bottom = pos.bottom;
      particlesEl.appendChild(p);
    }

    function spawnConnections() {
      if (!connectionsEl) return;
      for (var i = 0; i < connectionConfigs.length; i++) {
        var c = document.createElement('span');
        c.className = 'genesis-connection';
        c.style.left = connectionConfigs[i].left;
        c.style.bottom = connectionConfigs[i].bottom;
        c.style.width = connectionConfigs[i].width;
        c.style.setProperty('--rot', connectionConfigs[i].rotate);
        c.style.animationDelay = (i * 0.35) + 's';
        connectionsEl.appendChild(c);
      }
    }

    // Phase 2：添加初始纹理层（记录留下的痕迹）
    function addTextureLayers(count) {
      if (!textureEl) return;
      textureEl.innerHTML = '';
      for (var i = 0; i < count; i++) {
        var layer = document.createElement('span');
        var layerOpacity = 0.06 + i * 0.025;
        var xPos = 20 + i * 15;
        var yPos = 30 + i * 10;
        layer.style.cssText =
          'position:absolute;inset:0;border-radius:50%;opacity:' + layerOpacity +
          ';pointer-events:none;background:radial-gradient(circle at ' + xPos + '% ' + yPos + '%, ' +
          'hsla(275, 40%, 70%, .5), transparent 40%);';
        textureEl.appendChild(layer);
      }
    }

    function setPhase(idx) {
      if (finished || idx >= GENESIS_PHASES.length) {
        finishGenesis();
        return;
      }

      var phase = GENESIS_PHASES[idx];
      overlay.setAttribute('data-phase', String(idx + 1));

      // 更新进度点
      for (var d = 0; d < dots.length; d++) {
        dots[d].classList.toggle('active', d === idx);
      }

      // 文字延迟出现（呼吸感：先看到 Bubble 变化，再读到文字）
      var textTimer = setTimeout(function () {
        if (finished || !textEl) return;
        textEl.classList.remove('genesis-text-anim');
        textEl.offsetHeight; // force reflow
        textEl.textContent = phase.text;
        textEl.classList.add('genesis-text-anim');
      }, phase.textDelay || 0);
      timers.push(textTimer);

      // 微阶段视觉触发（Bubble 6 阶段成长）
      if (idx === 1) {
        // Phase 2 (Act 2a)：记录留下痕迹
        // t=2s: 第一个粒子缓慢进入（第一次记录的痕迹）
        var p1Timer = setTimeout(function () {
          if (!finished) spawnParticle(0);
        }, 2000);
        timers.push(p1Timer);
      } else if (idx === 2) {
        // Phase 3 (Act 2b)：Pattern 形成
        // t=1.2s: 更多粒子进入
        var p2Timer = setTimeout(function () {
          if (!finished) { spawnParticle(1); spawnParticle(2); }
        }, 1200);
        timers.push(p2Timer);
        // t=2.5s: 连线形成（Pattern 关联）
        var connTimer = setTimeout(function () {
          if (!finished) spawnConnections();
        }, 2500);
        timers.push(connTimer);
        // t=1s: 第一层纹理
        var texTimer = setTimeout(function () {
          if (!finished) addTextureLayers(1);
        }, 1000);
        timers.push(texTimer);
        // t=3s: 更丰富纹理
        var tex2Timer = setTimeout(function () {
          if (!finished) addTextureLayers(3);
        }, 3000);
        timers.push(tex2Timer);
      } else if (idx === 3) {
        // Phase 4 (Act 3)：最后一个粒子（完整沉淀）
        spawnParticle(3);
      }

      // 调度下一阶段
      var timer = setTimeout(function () {
        setPhase(idx + 1);
      }, phase.duration);
      timers.push(timer);
    }

    function finishGenesis() {
      if (finished) return;
      finished = true;

      // 清除所有定时器
      for (var i = 0; i < timers.length; i++) {
        clearTimeout(timers[i]);
      }

      // 停止波浪动画
      stopGenesisWaves();

      // 永久标记已看过
      markGenesisSeen();

      // 淡出 overlay
      overlay.classList.add('genesis-leaving');

      setTimeout(function () {
        overlay.hidden = true;
        overlay.classList.remove('genesis-leaving');
        overlay.removeAttribute('data-phase');

        // 清理粒子和连线
        if (particlesEl) particlesEl.innerHTML = '';
        if (connectionsEl) connectionsEl.innerHTML = '';
        if (textureEl) textureEl.innerHTML = '';

        if (onComplete) onComplete();
      }, 800);
    }

    // 跳过按钮
    if (skipBtn) {
      skipBtn.onclick = function () {
        finishGenesis();
      };
    }

    // 启动波浪动画
    startGenesisWaves();

    // 开始第一阶段
    setPhase(0);
  }

  // 启动时检查登录状态
  (async function initAuthState() {
    if (!window.CB_API || !CB_API.auth) return;
    if (!CB_API.auth.isLoggedIn()) {
      // 未登录：自动切到登录页（除非是 demo 模式）
      if (!isDemoMode && !authAutoSwitched && typeof switchTo === 'function') {
        authAutoSwitched = true;
        switchTo('auth');
      }
      return;
    }
    // 已登录：验证 token 是否有效
    try {
      await CB_API.auth.me();
      // 已登录：从真实库加载 memories
      try {
        localStorage.removeItem('bubbleReset_v6');
        bubbleDNA.memories = [];
        bubbleDNA.totalRecords = 0;
        bubbleDNA.totalResponses = 0;
        bubbleDNA.relationshipSignals = [];
        bubbleDNA.communitySignals = [];
        bubbleDNA.evolution = [];
        bubbleDNA._patternsCache = null;
        bubbleDNA._patternsCacheVersion++;
        await loadMemoriesFromBackend();
      } catch (e) {
        console.warn('加载真实记忆失败，保持空状态:', e);
      }
      // 已登录：若当前在 auth 页，切回 home
      var authScreen = document.querySelector('.screen.screen-auth');
      if (authScreen && authScreen.classList.contains('active') && typeof switchTo === 'function') {
        switchTo('home');
      }
    } catch (e) {
      // token 无效，清除并切登录页
      CB_API.auth.logout();
      if (!isDemoMode && typeof switchTo === 'function') {
        switchTo('auth');
      }
    }
  })();

  // ====== 初始化：根据模式显示/隐藏 demo bar ======
  syncDemoFlag();
  refreshDemoBar();

  // 演示模式 bar 的登录按钮：跳到登录页
  var demoLoginBtn = document.getElementById('demoBarLoginBtn');
  if (demoLoginBtn) {
    demoLoginBtn.addEventListener('click', function () {
      if (typeof switchTo === 'function') switchTo('auth');
    });
  }

  // 登录页"演示模式"按钮
  var authDemoBtn = document.getElementById('authDemoBtn');
  if (authDemoBtn) {
    authDemoBtn.addEventListener('click', function () {
      // 进入演示模式
      isDemoMode = true;
      syncDemoFlag(); // 通知 api.js 后续请求带 X-Demo-Mode header
      refreshDemoBar(); // 同时显示 demo-bar 和 loginPill
      // 重新加载首页数据（demo 库的）
      if (typeof switchTo === 'function') switchTo('home');
      if (typeof loadCycleStatus === 'function') loadCycleStatus();
      if (typeof loadAndApplyGrowthData === 'function') loadAndApplyGrowthData();
      if (typeof renderResonanceFeed === 'function') renderResonanceFeed();
      if (typeof loadMemoriesFromBackend === 'function') loadMemoriesFromBackend().then(function () {
        if (typeof applyBubbleState === 'function') applyBubbleState();
        // 启动半自动引导流程：开场 8 秒自动播放，之后由"下一步"按钮驱动
        _startDemoPlayback();
      });
    });
  }

  // 演示模式"下一步"按钮：驱动半自动引导流程
  var demoNextStepBtn = document.getElementById('demoNextStepBtn');
  if (demoNextStepBtn) {
    demoNextStepBtn.addEventListener('click', function () {
      _nextDemoStep();
    });
  }

  // 退出演示模式（保留为预留入口，目前通过登录后自动切真实模式）
  window.__cbExitDemo = function () {
    isDemoMode = false;
    syncDemoFlag();
    refreshDemoBar();
    _stopDemoPlayback();
    if (typeof applyBubbleState === 'function') applyBubbleState();
  };

})();
