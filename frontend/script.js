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

  var bubbleDNA = JSON.parse(JSON.stringify(defaultDNA));
  var isAppReady = false; // 数据是否已从 API 加载

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
    // No-op: 数据由后端 API 管理，不再存 localStorage
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
    var p = getPatterns();
    var st = computeBubbleState();
    var bubble = document.getElementById("mainBubble");
    var bubbleEmpty = document.getElementById("bubbleEmpty");
    var liquid = document.getElementById("bubbleLiquid");
    var texture = document.getElementById("bubbleTexture");
    var narration = document.getElementById("growthNarration");

    // 无记录：显示空状态，隐藏 Bubble
    if (p.totalMemories === 0) {
      if (bubble) bubble.hidden = true;
      if (bubbleEmpty) bubbleEmpty.hidden = false;
      if (narration) narration.textContent = "";
      return;
    }

    // 有记录：显示 Bubble，隐藏空状态
    if (bubble) bubble.hidden = false;
    if (bubbleEmpty) bubbleEmpty.hidden = true;

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
    var p = getPatterns();
    var headline = document.getElementById("growthHeadline");
    var sub = document.getElementById("growthSub");
    var memorySection = document.getElementById("memorySection");
    var storiesSection = document.getElementById("growthStoriesSection");

    // 无数据：完整空状态
    if (p.totalMemories === 0) {
      if (headline) headline.textContent = "暂无成长数据";
      if (sub) sub.textContent = "继续记录，你会逐渐发现自己的长期模式。";
      if (memorySection) memorySection.style.display = "none";
      if (storiesSection) storiesSection.style.display = "none";
      var impactSec = document.getElementById("impactSection");
      if (impactSec) impactSec.hidden = true;
      return;
    }

    // 有数据：正常渲染
    if (headline) headline.textContent = getGrowthHeadline();
    if (sub) sub.textContent = getGrowthSub();
    if (memorySection) memorySection.style.display = "";

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

    // 影响卡片：从 API 获取真实数据
    var impactSection = document.getElementById('impactSection');
    var resonanceLead = document.getElementById('resonanceLead');
    if (impactSection) {
      CB_API.getGrowth().then(function (data) {
        var impact = data.impact || {};
        var accompanied = impact.accompanied_count || 0;
        if (accompanied > 0) {
          impactSection.hidden = false;
          impactSection.innerHTML =
            '<h3 class="section-label">你的陪伴</h3>' +
            '<div class="impact-card">' +
            '<p class="impact-text">你的经历，陪伴了 <strong>' + accompanied + ' 位</strong>正在经历相似感受的人。</p>' +
            '</div>';
        } else {
          impactSection.hidden = true;
        }
      }).catch(function () { impactSection.hidden = true; });
    }
    if (resonanceLead) resonanceLead.hidden = true; // 社区统计暂不展示假数据
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
    if (name === "resonance") loadResonanceFeed();
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
      var userInput = "";
      if (recordInput && recordInput.value.trim()) {
        userInput = recordInput.value.trim();
      } else {
        // 没有输入就不处理，不允许假数据
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

      // 3 秒后：API 抽取 → 存入 Memory → Pattern 更新 → 跳转理解页
      setTimeout(function () {
        clearInterval(msgInterval);

        // 调用后端 API 做结构化抽取
        CB_API.createMemory(userInput).then(function (result) {
          var newMemory = result.memory;
          // 转换为前端兼容格式
          var mem = {
            id: newMemory.id,
            snippet: newMemory.snippet,
            rawText: newMemory.rawText,
            timeLabel: newMemory.timeLabel,
            themes: newMemory.themes,
            triggers: newMemory.triggers,
            recovery: newMemory.recovery,
            emotions: newMemory.emotions,
            mood: newMemory.mood,
            expressionStyle: newMemory.expressionStyle,
            hasAction: newMemory.hasAction,
            event: newMemory.event
          };
          bubbleDNA.memories.push(mem);
          bubbleDNA.totalRecords++;

          // 记录 DNA Evolution
          bubbleDNA.evolution.push({
            type: "memory_added",
            time: Date.now(),
            memoryId: mem.id,
            themes: mem.themes
          });

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
        }).catch(function (err) {
          // API 失败：回退到本地抽取
          console.error("[API] createMemory failed:", err);
          var newMemory = extractMemory(userInput, "今天");
          bubbleDNA.memories.push(newMemory);
          bubbleDNA.totalRecords++;
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
        });
      }, 3000);
    });
  }

  // ====== 回应系统（从 API 动态加载） ======
  var resonanceStack = document.getElementById("resonanceStack");
  var resonancePager = document.querySelector(".resonance-pager");
  var lightPoints = document.getElementById("lightPoints");
  var resonanceStories = [];
  var resonanceIndex = 0;

  function renderResonanceCard(story, index) {
    var isActive = index === 0;
    var card = document.createElement("section");
    card.className = "resonance-card" + (isActive ? " active" : "");
    card.setAttribute("data-index", index);
    card.setAttribute("data-story-id", story.id || "");
    card.innerHTML =
      '<p class="anonymous">' + (story.anon_name || "匿名") + '</p>' +
      '<p class="quote">"' + (story.snippet || "") + '"</p>' +
      '<div class="response-options">' +
        '<button type="button" class="response-chip" data-response="empathy">我也经历过</button>' +
        '<button type="button" class="response-chip" data-response="thanks">谢谢你的分享</button>' +
        '<button type="button" class="response-chip" data-response="hug">抱抱你</button>' +
        '<button type="button" class="response-chip response-chip--expand" data-response="share">分享我的经历</button>' +
      '</div>' +
      '<div class="response-expand" hidden>' +
        '<textarea class="response-input" placeholder="如果你愿意，可以写一点自己的经历……"></textarea>' +
        '<button type="button" class="response-send">送出</button>' +
      '</div>';
    return card;
  }

  function renderResonancePager(count) {
    if (!resonancePager) return;
    if (count <= 1) {
      resonancePager.style.display = "none";
      return;
    }
    resonancePager.style.display = "";
    var html = "";
    for (var i = 0; i < count; i++) {
      html += '<i class="' + (i === 0 ? "active" : "") + '"></i>';
    }
    resonancePager.innerHTML = html;
  }

  function loadResonanceFeed() {
    if (!resonanceStack) return;
    CB_API.getResonanceFeed().then(function (data) {
      resonanceStories = data.stories || [];
      resonanceStack.innerHTML = "";

      if (resonanceStories.length === 0) {
        resonanceStack.innerHTML = '<div class="resonance-empty">还没有其他人的故事。<br>等你写下的感受被更多人看到，这里会出现共鸣。</div>';
        if (resonancePager) resonancePager.style.display = "none";
        return;
      }

      for (var i = 0; i < resonanceStories.length; i++) {
        resonanceStack.appendChild(renderResonanceCard(resonanceStories[i], i));
      }
      renderResonancePager(resonanceStories.length);
      bindResonanceEvents();
    }).catch(function (err) {
      console.error("[API] getResonanceFeed failed:", err);
      resonanceStack.innerHTML = '<div class="resonance-empty">故事加载中……</div>';
    });
  }

  function bindResonanceEvents() {
    var cards = resonanceStack.querySelectorAll(".resonance-card");
    var dots = resonancePager ? resonancePager.querySelectorAll("i") : [];
    var currentIdx = 0;

    function updatePager(idx) {
      for (var d = 0; d < dots.length; d++) dots[d].classList.remove("active");
      if (dots[idx]) dots[idx].classList.add("active");
    }

    function nextCard() {
      if (currentIdx >= cards.length - 1) return;
      cards[currentIdx].classList.remove("active");
      cards[currentIdx].classList.add("leaving");
      var oldIdx = currentIdx;
      setTimeout(function () {
        cards[oldIdx].classList.remove("leaving");
        currentIdx++;
        if (cards[currentIdx]) cards[currentIdx].classList.add("active");
        updatePager(currentIdx);
      }, 450);
    }

    // 回应芯片
    var chips = resonanceStack.querySelectorAll(".response-chip");
    for (var r = 0; r < chips.length; r++) {
      chips[r].addEventListener("click", function () {
        var responseType = this.getAttribute("data-response");
        var card = this.closest(".resonance-card");
        var storyId = card ? card.getAttribute("data-story-id") : "";

        if (responseType === "share") {
          var expand = card.querySelector(".response-expand");
          if (expand) expand.hidden = !expand.hidden;
          return;
        }

        var allChips = card.querySelectorAll(".response-chip");
        for (var c = 0; c < allChips.length; c++) allChips[c].disabled = true;

        bubbleDNA.totalResponses++;
        bubbleDNA.relationshipSignals.push({ type: responseType, time: Date.now() });

        if (storyId && storyId.indexOf("seed_") !== 0) {
          CB_API.createResponse(storyId, responseType).catch(function () {});
        }

        if (responseType === "empathy") addLightPoint("connection");
        else if (responseType === "hug") addLightPoint("warmth");
        else addLightPoint("connection");

        setTimeout(nextCard, 1500);
      });
    }

    // 送出经历
    var sends = resonanceStack.querySelectorAll(".response-send");
    for (var s = 0; s < sends.length; s++) {
      sends[s].addEventListener("click", function () {
        var card = this.closest(".resonance-card");
        var input = card.querySelector(".response-input");
        var storyId = card ? card.getAttribute("data-story-id") : "";
        if (input && input.value.trim()) {
          bubbleDNA.totalResponses++;
          bubbleDNA.relationshipSignals.push({
            type: "share", content: input.value.trim().substring(0, 80), time: Date.now()
          });

          if (storyId && storyId.indexOf("seed_") !== 0) {
            CB_API.createResponse(storyId, "share", input.value.trim()).catch(function () {});
          }

          addLightPoint("warmth");
          addLightPoint("connection");

          var expand = card.querySelector(".response-expand");
          if (expand) expand.hidden = true;
          var allChips = card.querySelectorAll(".response-chip");
          for (var c = 0; c < allChips.length; c++) allChips[c].disabled = true;
          input.value = "";
          setTimeout(nextCard, 1500);
        }
      });
    }
  }

  function addLightPoint(type) {
    if (!lightPoints) return;
    var point = document.createElement("span");
    point.className = "light-point light-point--" + type;
    point.style.left = (15 + Math.random() * 70) + "%";
    point.style.bottom = (10 + Math.random() * 60) + "%";
    lightPoints.appendChild(point);
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

  // 退出登录：清除 token，回到登录页
  window.__bubbleLogout = function () {
    if (typeof CB_API !== "undefined") CB_API.logout();
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

  // ====== 登录/注册页逻辑 ======
  var authScreen = document.querySelector('.screen-auth');
  var homeScreen = document.querySelector('.screen-home');
  var authSubmit = document.getElementById('authSubmit');
  var authToggle = document.getElementById('authToggle');
  var authEmail = document.getElementById('authEmail');
  var authPassword = document.getElementById('authPassword');
  var authNickname = document.getElementById('authNickname');
  var authError = document.getElementById('authError');
  var isRegisterMode = false;

  function showScreen(screenName) {
    var screens = document.querySelectorAll('.screen');
    for (var i = 0; i < screens.length; i++) {
      screens[i].classList.remove('active');
    }
    var target = document.querySelector('.screen-' + screenName);
    if (target) target.classList.add('active');
    var tabbar = document.querySelector('.tabbar');
    if (tabbar) tabbar.style.display = (screenName === 'home' || screenName === 'growth' || screenName === 'resonance') ? '' : 'none';
  }

  function showAuthScreen() { showScreen('auth'); }

  function showOnboardScreen() { showScreen('onboard'); }

  function showApp() {
    showScreen('home');
    applyBubbleState();
    updateCycleDisplay();
  }

  // 登录/注册切换
  if (authToggle) {
    authToggle.addEventListener('click', function () {
      isRegisterMode = !isRegisterMode;
      if (isRegisterMode) {
        authSubmit.textContent = '注册';
        authToggle.textContent = '已有账号？登录';
        authNickname.style.display = '';
      } else {
        authSubmit.textContent = '登录';
        authToggle.textContent = '还没有账号？注册';
        authNickname.style.display = 'none';
      }
      authError.textContent = '';
    });
  }

  // 提交
  if (authSubmit) {
    authSubmit.addEventListener('click', async function () {
      var email = authEmail.value.trim();
      var password = authPassword.value;

      if (!email || !password) {
        authError.textContent = '请填写邮箱和密码';
        return;
      }

      authSubmit.disabled = true;
      authSubmit.textContent = '...';

      try {
        if (isRegisterMode) {
          await CB_API.register(email, password, authNickname.value.trim() || undefined);
        } else {
          await CB_API.login(email, password);
        }

        authError.textContent = '';
        await loadUserData();

        // 新注册用户 → 经期引导；老用户 → 直接进首页
        if (isRegisterMode) {
          showOnboardScreen();
        } else {
          showApp();
        }
      } catch (err) {
        authError.textContent = err.message || '操作失败';
      } finally {
        authSubmit.disabled = false;
        authSubmit.textContent = isRegisterMode ? '注册' : '登录';
      }
    });
  }

  // ====== 经期 Onboarding 逻辑 ======
  var onboardDates = document.getElementById('onboardDates');
  var onboardAdd = document.getElementById('onboardAdd');
  var onboardSkip = document.getElementById('onboardSkip');
  var onboardSubmit = document.getElementById('onboardSubmit');
  var onboardError = document.getElementById('onboardError');
  var onboardDateCount = 1;

  var dateLabels = ['最近一次', '上一次', '再上一次', '更早一次', '更早一次', '更早一次'];

  if (onboardAdd) {
    onboardAdd.addEventListener('click', function () {
      if (onboardDateCount >= 6) return;
      onboardDateCount++;
      var row = document.createElement('div');
      row.className = 'onboard-date-row';
      var label = dateLabels[onboardDateCount - 1] || '更早一次';
      row.innerHTML = '<label>' + label + '</label><input type="date" class="onboard-date-input" data-idx="' + (onboardDateCount - 1) + '">';
      onboardDates.appendChild(row);
      if (onboardDateCount >= 6) onboardAdd.style.display = 'none';
    });
  }

  if (onboardSkip) {
    onboardSkip.addEventListener('click', function () {
      showApp();
    });
  }

  if (onboardSubmit) {
    onboardSubmit.addEventListener('click', async function () {
      var inputs = onboardDates.querySelectorAll('.onboard-date-input');
      var dates = [];
      for (var i = 0; i < inputs.length; i++) {
        if (inputs[i].value) dates.push(inputs[i].value);
      }

      if (dates.length === 0) {
        onboardError.textContent = '至少填写一次经期日期，或点"先跳过"';
        return;
      }

      onboardSubmit.disabled = true;
      onboardSubmit.textContent = '保存中...';

      try {
        // 按时间正序提交（最早的先提交）
        dates.sort();
        for (var d = 0; d < dates.length; d++) {
          await CB_API.addPeriod(dates[d]);
        }
        showApp();
      } catch (err) {
        onboardError.textContent = err.message || '保存失败';
      } finally {
        onboardSubmit.disabled = false;
        onboardSubmit.textContent = '完成';
      }
    });
  }

  // 周期状态显示
  async function updateCycleDisplay() {
    var cycleStatus = document.getElementById('cycleStatus');
    var bubblePhase = document.getElementById('bubblePhase');
    var bubbleHint = document.getElementById('bubbleHint');
    if (!cycleStatus) return;

    try {
      var cycle = await CB_API.getCycleStatus();
      if (!cycle.has_data) {
        cycleStatus.textContent = '周期数据收集中';
        if (bubblePhase) bubblePhase.textContent = '';
        if (bubbleHint) bubbleHint.textContent = '';
        return;
      }

      // phase 是 dict: {key, label, day_range, copy}
      var phaseObj = cycle.phase || {};
      var phaseLabel = phaseObj.label || '';
      var phaseCopy = phaseObj.copy || '';
      var confidence = cycle.confidence || 'low';
      var confidenceLabel = confidence === 'high' ? '' : (confidence === 'medium' ? '（预测中）' : '（估算）');

      cycleStatus.textContent = phaseLabel + '｜' + phaseCopy + confidenceLabel;
      if (bubblePhase) bubblePhase.textContent = phaseLabel;
      if (bubbleHint) bubbleHint.textContent = phaseCopy;
    } catch (err) {
      cycleStatus.textContent = '周期数据收集中';
    }
  }

  // 从 API 加载用户数据
  async function loadUserData() {
    try {
      var data = await CB_API.getMemories();
      bubbleDNA.memories = (data.memories || []).map(function (m) {
        return {
          id: m.id,
          snippet: m.snippet,
          rawText: m.rawText,
          timeLabel: m.timeLabel,
          themes: m.themes,
          triggers: m.triggers,
          recovery: m.recovery,
          emotions: m.emotions,
          mood: m.mood,
          expressionStyle: m.expressionStyle,
          hasAction: m.hasAction,
          event: m.event
        };
      });
      bubbleDNA.totalRecords = bubbleDNA.memories.length;
      isAppReady = true;
    } catch (err) {
      console.error('[API] loadUserData failed:', err);
      isAppReady = true;
      throw err; // 重新抛出，让调用方知道失败了
    }
  }

  // 启动：始终先显示登录页，然后异步验证 token
  // 这样即使有旧 token 也不会直接跳过登录页
  showAuthScreen();

  if (typeof CB_API !== 'undefined' && CB_API.isLoggedIn()) {
    // 有 token：异步验证，成功才进 App，失败则留在登录页
    loadUserData().then(function () {
      showApp();
    }).catch(function () {
      CB_API.logout();
    });
  }

})();
