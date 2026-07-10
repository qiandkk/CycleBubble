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

  // ====== Memory 结构化抽取 ======
  // 每条 Bubble 自动抽取结构化字段。
  // 这是模拟版：真实产品应由 AI Agent 抽取，这里用关键词匹配模拟。

  var themeKeywords = {
    "认可": ["认可", "肯定", "表扬", "夸", "被看见", "价值", "有没有被", "被需要"],
    "工作": ["工作", "开会", "领导", "同事", "老板", "项目", "加班", "任务", "报告", "绩效"],
    "家庭": ["妈妈", "爸爸", "家", "家里", "父母", "弟弟", "姐姐", "哥哥", "家人"],
    "关系": ["朋友", "他", "她", "伴侣", "恋爱", "分手", "吵架", "冷战", "陪伴"],
    "自我": ["我是不是", "太敏感", "不够好", "为什么我", "是不是我", "自己"],
    "身体": ["累", "疲惫", "失眠", "疼", "不舒服", "周期", "生理期", "黄体"],
    "表达": ["说出来", "表达", "反驳", "没说出口", "想试", "终于说", "开口"]
  };

  var triggerKeywords = {
    "评价": ["评价", "批评", "指责", "说了一句", "领导说", "被说"],
    "比较": ["比别人", "都比我", "别人都", "为什么别人"],
    "冲突": ["吵架", "争执", "冷战", "冲突", "矛盾"],
    "变化": ["变了", "突然", "第一次", "没想到"],
    "周期": ["这个阶段", "又到了", "生理期", "黄体", "激素"]
  };

  var recoveryKeywords = {
    "表达": ["说出来", "写下来", "记录", "倾诉", "聊了"],
    "独处": ["一个人", "安静", "离开一下", "待着", "空间"],
    "连接": ["朋友", "聊", "陪伴", "分享"],
    "运动": ["运动", "跑步", "走路", "瑜伽"],
    "创作": ["画画", "写", "画", "音乐", "创作"]
  };

  var emotionKeywords = {
    "焦虑": ["焦虑", "担心", "怕", "紧张", "不安", "反复想", "纠结"],
    "委屈": ["委屈", "不公平", "凭什么", "为什么我"],
    "愤怒": ["生气", "气", "愤怒", "烦", "讨厌"],
    "低落": ["低落", "难过", "哭", "丧", "没力气", "空虚"],
    "平静": ["平静", "还好", "释然", "接受", "放下"],
    "温暖": ["温暖", "感动", "开心", "幸福", "感激"],
    "力量": ["力量", "勇气", "决定", "终于", "突破"]
  };

  function extractField(text, keywordMap) {
    var found = [];
    for (var category in keywordMap) {
      var words = keywordMap[category];
      for (var i = 0; i < words.length; i++) {
        if (text.indexOf(words[i]) !== -1) {
          if (found.indexOf(category) === -1) found.push(category);
          break;
        }
      }
    }
    return found;
  }

  function extractMemory(rawText, timeLabel) {
    var text = rawText || "";
    var themes = extractField(text, themeKeywords);
    var triggers = extractField(text, triggerKeywords);
    var recovery = extractField(text, recoveryKeywords);
    var emotions = extractField(text, emotionKeywords);

    // 表达方式推断
    var expressionStyle = "倾诉";
    if (/[？?]/.test(text) && text.length < 60) expressionStyle = "提问";
    else if (/我想|我想试|下次|打算|要/.test(text)) expressionStyle = "反思";
    else if (/终于|决定|突破/.test(text)) expressionStyle = "行动";

    // 是否提到行动
    var hasAction = /终于|决定|试|开始|下次|打算/.test(text);

    // 情绪基调（取第一个匹配的情绪，或"未明"）
    var mood = emotions.length > 0 ? emotions[0] : "未明";

    return {
      id: "m_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      time: Date.now(),
      timeLabel: timeLabel || "今天",
      rawText: text,
      snippet: text.length > 50 ? text.substring(0, 50) + "……" : text,
      themes: themes,
      triggers: triggers,
      recovery: recovery,
      emotions: emotions,
      mood: mood,
      expressionStyle: expressionStyle,
      hasAction: hasAction,
      source: "self"
    };
  }

  // ====== 预置 Memory（模拟过去三个月的沉积） ======
  // 仅用于 demo 展示效果。用户点击"重新开始"后，设置 bubbleReset 标记，
  // 之后永不注入种子记忆，变成真正的空状态。
  var seedMemories = [
    extractMemory("今天又因为领导的一句话纠结了一整天。我是不是太敏感了？", "三个月前"),
    extractMemory("和朋友聊了之后好多了。原来不只是我一个人这样。", "两个月前"),
    extractMemory("开会时又想反驳但没说出口。下次想试着表达出来。", "六周前"),
    extractMemory("今天终于主动说出了自己的想法，虽然说出口时手在抖。", "一个月前"),
    extractMemory("这个阶段又到了，提前做好了心理准备。没有像上次那样陷入很久。", "两周前")
  ];

  // 用户是否主动重置过
  var hasReset = false;
  try {
    hasReset = localStorage.getItem("bubbleReset_v6") === "true";
  } catch (e) {}

  // 仅当：没有记忆 + 用户没重置过 → 注入种子记忆（demo 展示用）
  if (bubbleDNA.memories.length === 0 && !hasReset) {
    bubbleDNA.memories = seedMemories.slice();
    bubbleDNA.totalRecords = seedMemories.length;
  }

  // ====== 模式管理：演示 / 正常 ======
  // 通过 URL 参数可强制：?demo=1 强制演示，?mode=app 强制正常
  var urlParams = (function () {
    try { return new URLSearchParams(window.location.search); }
    catch (e) { return null; }
  })();
  var forceDemo = urlParams && urlParams.get('demo') === '1';
  var forceApp = urlParams && urlParams.get('mode') === 'app';
  var isDemoMode = forceDemo || (!forceApp && !(window.CB_API && CB_API.auth && CB_API.auth.isLoggedIn && CB_API.auth.isLoggedIn()));

  function isAppMode() { return !isDemoMode; }

  function refreshDemoBar() {
    var bar = document.getElementById('demoBar');
    if (!bar) return;
    bar.hidden = !isDemoMode;
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

  // ====== 演示模式种子数据 ======
  var demoStories = [
    {
      id: 'demo-1',
      anonymous_name: '一位相似经历的人',
      text_excerpt: '这个月我又开始反复想那件事了，好像每个月都会有一周是这样……',
      themes: ['自我'],
      mood: '难过',
      days_ago: 2
    },
    {
      id: 'demo-2',
      anonymous_name: '一位相似经历的人',
      text_excerpt: '今天朋友说她也是这样，她找到的方法是写下来，我也想试试……',
      themes: ['关系'],
      mood: '平静',
      days_ago: 5
    },
    {
      id: 'demo-3',
      anonymous_name: '一位相似经历的人',
      text_excerpt: '以前会觉得自己太敏感了，现在开始觉得也许只是这个阶段的正常反应……',
      themes: ['自我'],
      mood: '平静',
      days_ago: 9
    }
  ];

  var demoGrowthStories = [
    {
      text: '这两段话是不同时期留下的。',
      tag: '表达方式',
      quotes: [
        { text: '我是不是太敏感了？', time: '三个月前' },
        { text: '好像在意的是自己有没有被认可。', time: '两周前' }
      ]
    },
    {
      text: '最近你提到了两次"朋友"。',
      tag: '关系',
      quotes: [
        { text: '和朋友聊了之后好多了。', time: '两个月前' },
        { text: '今天主动说出了自己的想法。', time: '一周前' }
      ]
    }
  ];

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

    // 液体层次：Memory 越多，矿物层越厚
    var liquidLayers = Math.min(5, Math.floor(memoryCount / 3));

    // 粒子密度：Pattern 越丰富，内部生命越多
    var particleDensity = 2 + Math.floor(patternRichness / 2);

    // 色温：来自近期情绪基调
    var moodData = moodColorMap[p.recentMood] || moodColorMap["未明"];

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
      recentMood: p.recentMood
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
  async function loadCycleStatus() {
    // 演示模式：使用硬编码
    if (isDemoMode) {
      var el = document.getElementById('cycleStatus');
      if (el) el.textContent = '黄体期｜今天身体可能比平时更容易放大情绪感受';
      return;
    }
    try {
      if (!window.CB_API || !window.CB_API.cycle || !window.CB_API.cycle.getStatus) return;
      const status = await window.CB_API.cycle.getStatus();
      if (!status || !status.phase_name) return;
      const text = status.phase_name + "｜" + (status.description || "");
      const confidence = status.confidence;
      let suffix = "";
      if (confidence === "low") suffix = "（估算）";
      else if (confidence === "medium") suffix = "（预测中）";
      else if (confidence === "none") suffix = "";
      const el = document.getElementById("cycleStatus");
      if (el) el.textContent = text + suffix;

      // 同步更新主泡泡上的 phase 标签和提示（如果后端返回了）
      const phaseEl = document.getElementById("bubblePhase");
      if (phaseEl && status.phase_name) phaseEl.textContent = status.phase_name;
    } catch (e) {
      console.warn("加载周期状态失败:", e);
      // 兜底：保留原有 HTML 文案
    }
  }

  async function loadGrowthData() {
    // 演示模式：返回种子数据
    if (isDemoMode) {
      return {
        total_records: 5,
        empty_state: false,
        timeline: [
          { week: '2026-W28', count: 2, first_text: '这个阶段又到了...' },
          { week: '2026-W26', count: 1, first_text: '今天又因为...' },
          { week: '2026-W24', count: 2, first_text: '和朋友聊了之后...' }
        ],
        discoveries: [
          { type: 'mood', title: '最近的主导情绪', content: '难过', evidence_count: 2 },
          { type: 'theme', title: '最常出现的感受主题', content: '自我', evidence_count: 3 }
        ],
        impact: { accompanied_count: 5, response_count: 2 },
        isDemo: true,
        demoStories: demoGrowthStories
      };
    }
    // 正常模式：从 API 获取
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
    // 演示模式：返回种子共鸣故事
    if (isDemoMode) {
      return demoStories;
    }
    // 正常模式：从 API 获取
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
  function buildResonanceCardFromStory(story, index) {
    var inlineStyle = "border:1.5px solid rgba(181,169,207,.3);border-radius:36px 36px 32px 32px;background:radial-gradient(ellipse at 30% 0%,rgba(245,217,216,.4),transparent 50%),radial-gradient(ellipse at 70% 100%,rgba(240,237,247,.45),transparent 50%),linear-gradient(180deg,rgba(255,253,251,.99),rgba(248,244,250,.92));box-shadow:0 20px 48px rgba(82,63,74,.12),inset 0 2px 0 rgba(255,255,255,.8);";
    var activeClass = (index === 0) ? " active" : "";
    // 匿名泡泡编号：根据 id 散列出一个稳定数字
    var num = 10 + ((story.id || 0) * 7 % 80) | 0;
    var text = (story.text_excerpt || "").replace(/[<>&"']/g, function (c) {
      return ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" })[c];
    });
    var html = "";
    html += '<section class="resonance-card' + activeClass + '" style="' + inlineStyle + '" data-index="' + index + '">';
    html += '<p class="anonymous">匿名泡泡 ' + num + '</p>';
    html += '<p class="quote">"' + text + '"</p>';
    html += '<div class="response-options">';
    html += '<button type="button" class="response-chip" data-response="empathy">我也经历过</button>';
    html += '<button type="button" class="response-chip" data-response="thanks">谢谢你的分享</button>';
    html += '<button type="button" class="response-chip" data-response="hug">抱抱你</button>';
    html += '<button type="button" class="response-chip response-chip--expand" data-response="share">分享我的经历</button>';
    html += '</div>';
    html += '<div class="response-expand" hidden>';
    html += '<textarea class="response-input" placeholder="如果你愿意，可以写一点自己的经历……"></textarea>';
    html += '<button type="button" class="response-send">送出</button>';
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
  }

  function bindResponseChips() {
    var responseChips = document.querySelectorAll(".resonance-card .response-chip");
    for (var r = 0; r < responseChips.length; r++) {
      responseChips[r].addEventListener("click", function () {
        var responseType = this.getAttribute("data-response");
        var card = this.closest(".resonance-card");
        if (!card) return;

        if (responseType === "share") {
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

        bubbleDNA.totalResponses++;
        bubbleDNA.relationshipSignals.push({
          type: responseType,
          time: Date.now(),
          source: "resonance"
        });
        bubbleDNA.evolution.push({
          type: "response_given",
          time: Date.now(),
          responseType: responseType
        });
        saveDNA();

        if (responseType === "empathy") addLightPoint("connection");
        else if (responseType === "hug") addLightPoint("warmth");
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
          bubbleDNA.totalResponses++;
          var sharedText = input.value.trim().substring(0, 80);
          bubbleDNA.relationshipSignals.push({
            type: "share",
            content: sharedText,
            time: Date.now(),
            source: "resonance"
          });
          bubbleDNA.evolution.push({
            type: "experience_shared",
            time: Date.now(),
            content: sharedText
          });
          saveDNA();

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
      html += '<p class="evidence-text">' + latest.snippet + '</p>';
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
      html += '<p class="pattern-text">这些记录里，「' + topTheme.name + '」反复出现了 ' + topTheme.count + ' 次。</p>';
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
    html += '<span class="memory-time">' + m.timeLabel + '</span>';
    html += '<p class="memory-snippet">' + m.snippet + '</p>';
    if (m.themes && m.themes.length > 0) {
      html += '<span class="memory-theme">' + m.themes[0] + '</span>';
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

    // 影响卡片（动态，优先用后端数据，否则用本地 bubbleDNA.totalResponses 兜底）
    var impactText = document.querySelector(".impact-text");
    if (impactText && bubbleDNA.totalResponses > 0) {
      var count = 3 + bubbleDNA.totalResponses;
      impactText.innerHTML = "你的经历，陪伴了 <strong>" + count + " 位</strong>正在经历相似感受的人。";
    }
  }

  // 异步加载成长数据，并刷新影响卡片（不阻塞页面渲染）
  async function loadAndApplyGrowthData() {
    var data = await loadGrowthData();
    if (!data) return;

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
      // 空状态下隐藏 action-stack（去看看她们的故事 按钮）
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

    // 更新影响数字（如果后端给了）
    var impactText = document.querySelector(".impact-text");
    if (impactText && data.impact) {
      var accompanied = (data.impact.accompanied_count != null) ? data.impact.accompanied_count : (3 + bubbleDNA.totalResponses);
      var impactSub = impactText.parentNode.querySelector(".impact-sub");
      impactText.innerHTML = "你的经历，陪伴了 <strong>" + accompanied + " 位</strong>正在经历相似感受的人。";
    }
  }

  function renderOneGrowthStory(container, stories) {
    if (!container || stories.length === 0) return;
    var idx = Math.min(growthStoryIndex, stories.length - 1);
    var s = stories[idx];
    var html = '';
    html += '<div class="growth-story-card growth-story-card--single">';
    html += '<span class="growth-story-tag">' + s.tag + '</span>';
    html += '<p class="growth-story-text">' + s.text + '</p>';
    // 展示用户原话引用——以小泡泡形态呈现
    if (s.quotes && s.quotes.length > 0) {
      html += '<div class="story-bubbles">';
      for (var q = 0; q < s.quotes.length; q++) {
        html += '<div class="story-bubble">';
        html += '<div class="story-bubble-liquid"></div>';
        html += '<span class="story-bubble-time">' + s.quotes[q].time + '</span>';
        html += '<p class="story-bubble-text">' + s.quotes[q].text + '</p>';
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
  function switchTo(name) {
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
        showDemoToast('演示模式无法保存，登录后可以记录你的真实情绪');
        return;
      }

      var userInput = "";
      if (recordInput && recordInput.value.trim()) {
        userInput = recordInput.value.trim();
      } else {
        userInput = "今天开会时领导说了一句话，我反复想了一整天。好像在意的是自己有没有被认可。";
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

        // 结构化抽取 Memory（一滴水进入 Bubble，形成新的矿物层）
        var newMemory = extractMemory(userInput, "今天");
        bubbleDNA.memories.push(newMemory);
        bubbleDNA.totalRecords++;

        // 记录 DNA Evolution
        bubbleDNA.evolution.push({
          type: "memory_added",
          time: Date.now(),
          memoryId: newMemory.id,
          themes: newMemory.themes
        });

        saveDNA();

        switchTo("insight");
        applyBubbleState();

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

  // 回应芯片点击（Relationship 维度采集）
  var responseChips = document.querySelectorAll(".response-chip");
  for (var r = 0; r < responseChips.length; r++) {
    responseChips[r].addEventListener("click", function () {
      var responseType = this.getAttribute("data-response");
      var card = this.closest(".resonance-card");

      if (responseType === "share") {
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

      // 记录 Relationship 信号
      bubbleDNA.totalResponses++;
      bubbleDNA.relationshipSignals.push({
        type: responseType,
        time: Date.now(),
        source: "resonance"
      });

      // 记录 Evolution
      bubbleDNA.evolution.push({
        type: "response_given",
        time: Date.now(),
        responseType: responseType
      });

      saveDNA();

      if (responseType === "empathy") addLightPoint("connection");
      else if (responseType === "hug") addLightPoint("warmth");
      else addLightPoint("connection");

      setTimeout(nextCard, 1500);
    });
  }

  // 送出经历（更高权重的 Relationship 信号）
  var responseSends = document.querySelectorAll(".response-send");
  for (var s = 0; s < responseSends.length; s++) {
    responseSends[s].addEventListener("click", function () {
      var card = this.closest(".resonance-card");
      var input = card.querySelector(".response-input");
      if (input && input.value.trim()) {
        bubbleDNA.totalResponses++;
        var sharedText = input.value.trim().substring(0, 80);
        bubbleDNA.relationshipSignals.push({
          type: "share",
          content: sharedText,
          time: Date.now(),
          source: "resonance"
        });

        bubbleDNA.evolution.push({
          type: "experience_shared",
          time: Date.now(),
          content: sharedText
        });

        saveDNA();

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
      if (!password || password.length < 4) { showAuthError('密码至少 4 位'); return; }

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
        refreshDemoBar();

        // 登录/注册成功：隐藏登录页，回到首页
        var loginPill = document.getElementById('loginPill');
        if (loginPill) loginPill.hidden = true;
        if (typeof switchTo === 'function') switchTo('home');
        // 刷新首页数据
        if (typeof loadCycleStatus === 'function') loadCycleStatus();
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

  // 启动时检查登录状态
  (async function initAuthState() {
    if (!window.CB_API || !CB_API.auth) return;
    if (!CB_API.auth.isLoggedIn()) {
      // 未登录：显示登录提示
      var loginPill = document.getElementById('loginPill');
      if (loginPill) loginPill.hidden = false;
      return;
    }
    // 已登录：验证 token 是否有效
    try {
      await CB_API.auth.me();
      var loginPill2 = document.getElementById('loginPill');
      if (loginPill2) loginPill2.hidden = true;
    } catch (e) {
      // token 无效，清除并显示提示
      CB_API.auth.logout();
      // 登出后回到演示模式
      isDemoMode = true;
      refreshDemoBar();
      var loginPill3 = document.getElementById('loginPill');
      if (loginPill3) loginPill3.hidden = false;
    }
  })();

  // ====== 初始化：根据模式显示/隐藏 demo bar ======
  refreshDemoBar();

  // 演示模式 bar 的登录按钮：跳到登录页
  var demoLoginBtn = document.getElementById('demoBarLoginBtn');
  if (demoLoginBtn) {
    demoLoginBtn.addEventListener('click', function () {
      if (typeof switchTo === 'function') switchTo('auth');
    });
  }

  // 登录页"先看看 demo"按钮
  var authDemoBtn = document.getElementById('authDemoBtn');
  if (authDemoBtn) {
    authDemoBtn.addEventListener('click', function () {
      // 切到演示模式 + 显示 demo-bar + 回到首页
      isDemoMode = true;
      refreshDemoBar();
      if (typeof switchTo === 'function') switchTo('home');
      if (typeof loadCycleStatus === 'function') loadCycleStatus();
      // 隐藏登录提示 pill
      var pill = document.getElementById('loginPill');
      if (pill) pill.hidden = true;
    });
  }

})();
