/**
 * CycleBubble v4 — Emotional OS
 * 不只是记录情绪，而是持续理解一个人。
 * 每一次表达，都会成为未来理解自己的线索。
 */
(function () {
  "use strict";

  // ====== Bubble DNA（成长模型，不可逆） ======
  var bubbleDNA = {
    stability: 35,
    depth: 28,
    openness: 18,
    vitality: 22,
    memoryLayers: [],
    evolution: "remember",
    totalRecords: 6
  };

  try {
    var saved = localStorage.getItem("bubbleDNA");
    if (saved) {
      var parsed = JSON.parse(saved);
      for (var k in parsed) {
        if (bubbleDNA.hasOwnProperty(k)) bubbleDNA[k] = parsed[k];
      }
    }
  } catch (e) {}

  function saveDNA() {
    try { localStorage.setItem("bubbleDNA", JSON.stringify(bubbleDNA)); } catch (e) {}
  }

  function updateEvolution() {
    var s = bubbleDNA.stability + bubbleDNA.depth + bubbleDNA.openness + bubbleDNA.vitality;
    if (s >= 240) bubbleDNA.evolution = "resonate";
    else if (s >= 120) bubbleDNA.evolution = "remember";
    else bubbleDNA.evolution = "reflect";
  }

  // ====== 预置记忆（模拟过去三个月的成长轨迹） ======
  var seedMemories = [
    { timeLabel: "三个月前", snippet: "今天又因为领导的一句话纠结了一整天。我是不是太敏感了？", theme: "自我怀疑" },
    { timeLabel: "两个月前", snippet: "和朋友聊了之后好多了。原来不只是我一个人这样。", theme: "连接" },
    { timeLabel: "六周前", snippet: "开会时又想反驳但没说出口。下次想试着表达出来。", theme: "渴望表达" },
    { timeLabel: "一个月前", snippet: "今天终于主动说出了自己的想法，虽然说出口时手在抖。", theme: "突破" },
    { timeLabel: "两周前", snippet: "这个阶段又到了，提前做好了心理准备。没有像上次那样陷入很久。", theme: "觉察" }
  ];

  // ====== 成长故事（AI 长期观察结果） ======
  var growthStories = [
    { text: "你发现了吗？最近三个月，你从「我是不是太敏感」变成了「我可以试着表达出来」。", tag: "表达方式" },
    { text: "每一次和朋友交流之后，你的恢复速度都在加快。", tag: "恢复能力" },
    { text: "你已经找到了属于自己的恢复方式——先离开一下，再回到问题里。", tag: "自我照顾" },
    { text: "这个阶段又来了，但你比上次更早察觉到了它。", tag: "周期觉察" }
  ];

  // ====== 成长旁白系统 ======
  function getGrowthNarration() {
    var s = bubbleDNA.stability + bubbleDNA.depth + bubbleDNA.openness + bubbleDNA.vitality;
    if (s >= 240) return "Bubble 越来越懂你了";
    if (s >= 120) return "Bubble 开始记住你的节奏了";
    return "Bubble 还在慢慢认识你";
  }

  function getGrowthHeadline() {
    var s = bubbleDNA.stability + bubbleDNA.depth + bubbleDNA.openness + bubbleDNA.vitality;
    if (s >= 240) return "你已经不是三个月前的自己了";
    if (s >= 120) return "你已经在悄悄变化了";
    return "Bubble 正在认识你";
  }

  function getGrowthSub() {
    var s = bubbleDNA.stability + bubbleDNA.depth + bubbleDNA.openness + bubbleDNA.vitality;
    if (s >= 240) return "每一次表达，都在塑造更完整的你。";
    if (s >= 120) return "你已经留下了痕迹，它们正在慢慢长出形状。";
    return "每一次表达，都是 Bubble 理解你的一步。";
  }

  // ====== 由 DNA 计算 Bubble 状态 ======
  function computeBubbleState() {
    var d = bubbleDNA;
    return {
      breatheDuration: Math.max(3.8, 5.8 - d.stability * 0.02),
      brightness: 1 + d.vitality * 0.0025,
      saturation: 1 + d.depth * 0.0015,
      opacity: Math.max(0.72, 1 - d.openness * 0.003),
      textureLayers: Math.min(5, Math.floor(d.depth / 20)),
      particleDensity: 1 + Math.floor(d.vitality / 15)
    };
  }

  function applyBubbleState() {
    var st = computeBubbleState();
    var bubble = document.getElementById("mainBubble");
    var liquid = document.getElementById("bubbleLiquid");
    var texture = document.getElementById("bubbleTexture");
    var narration = document.getElementById("growthNarration");

    if (bubble) {
      bubble.style.filter = "brightness(" + st.brightness.toFixed(3) + ") saturate(" + st.saturation.toFixed(3) + ")";
      bubble.style.animationDuration = st.breatheDuration.toFixed(1) + "s";
    }
    if (liquid) {
      liquid.style.opacity = st.opacity.toFixed(2);
    }
    if (texture) {
      texture.innerHTML = "";
      for (var i = 0; i < st.textureLayers; i++) {
        var layer = document.createElement("span");
        layer.style.cssText =
          "position:absolute;inset:0;border-radius:50%;opacity:0.08;pointer-events:none;" +
          "background:radial-gradient(circle at " + (20 + i * 15) + "% " + (30 + i * 10) + "%, rgba(255,255,255,.6), transparent 40%);";
        texture.appendChild(layer);
      }
      if (st.textureLayers > 0) texture.classList.add("visible");
    }
    if (narration) {
      narration.textContent = getGrowthNarration();
    }
  }

  applyBubbleState();

  // ====== 成长页渲染 ======
  function renderGrowthPage() {
    var headline = document.getElementById("growthHeadline");
    if (headline) headline.textContent = getGrowthHeadline();

    var sub = document.getElementById("growthSub");
    if (sub) sub.textContent = getGrowthSub();

    // 记忆时间线
    var timeline = document.getElementById("memoryTimeline");
    if (timeline) {
      var allMemories = seedMemories.concat(bubbleDNA.memoryLayers);
      var html = "";
      for (var i = allMemories.length - 1; i >= 0; i--) {
        var m = allMemories[i];
        var isLatest = (i === allMemories.length - 1);
        html += '<div class="memory-entry' + (isLatest ? ' memory-entry--latest' : '') + '">';
        html += '<span class="memory-dot"></span>';
        html += '<div class="memory-content">';
        html += '<span class="memory-time">' + m.timeLabel + '</span>';
        html += '<p class="memory-snippet">' + m.snippet + '</p>';
        html += '<span class="memory-theme">' + m.theme + '</span>';
        html += '</div>';
        html += '</div>';
        if (i > 0) html += '<span class="memory-line"></span>';
      }
      timeline.innerHTML = html;
    }

    // 成长故事
    var storiesEl = document.getElementById("growthStories");
    if (storiesEl) {
      var sHtml = "";
      for (var j = 0; j < growthStories.length; j++) {
        sHtml += '<div class="growth-story-card">';
        sHtml += '<p class="growth-story-text">' + growthStories[j].text + '</p>';
        sHtml += '<span class="growth-story-tag">' + growthStories[j].tag + '</span>';
        sHtml += '</div>';
      }
      storiesEl.innerHTML = sHtml;
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
    if (name === "growth") renderGrowthPage();
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

  // ====== 记录页：放进泡泡 → Bubble 收下今天 → 理解 ======
  var saveBtn = document.getElementById("saveBtn");
  var bubbleSettling = document.getElementById("bubbleSettling");
  var settlingLiquid = document.getElementById("settlingLiquid");
  var settlingText = document.getElementById("settlingText");
  var recordInput = document.getElementById("recordInput");
  var noteField = document.getElementById("noteField");
  var recordHead = document.getElementById("recordHead");

  var settlingMessages = [
    "Bubble 正在把今天收进记忆……",
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

      // 3 秒后：存入记忆层 → DNA 成长 → 跳转理解页
      setTimeout(function () {
        clearInterval(msgInterval);

        // 存入记忆层（用户真实的表达）
        var snippet = userInput.length > 50 ? userInput.substring(0, 50) + "……" : userInput;
        bubbleDNA.memoryLayers.push({
          timeLabel: "今天",
          snippet: snippet,
          theme: "今天的表达"
        });

        bubbleDNA.totalRecords++;
        bubbleDNA.stability = Math.min(100, bubbleDNA.stability + 5);
        bubbleDNA.depth = Math.min(100, bubbleDNA.depth + 3);
        bubbleDNA.vitality = Math.min(100, bubbleDNA.vitality + 2);
        updateEvolution();
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

  // ====== 共鸣页 ======
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

  var empathyBtns = document.querySelectorAll(".empathy-btn");
  for (var e = 0; e < empathyBtns.length; e++) {
    empathyBtns[e].addEventListener("click", function () {
      this.classList.add("responded");
      this.textContent = "已表达";
      this.disabled = true;
      addLightPoint("connection");
      bubbleDNA.openness = Math.min(100, bubbleDNA.openness + 4);
      saveDNA();
      setTimeout(nextCard, 1200);
    });
  }

  var thankBtns = document.querySelectorAll(".thank-btn");
  for (var th = 0; th < thankBtns.length; th++) {
    thankBtns[th].addEventListener("click", function () {
      this.classList.add("responded");
      this.textContent = "已感谢";
      this.disabled = true;
      addLightPoint("warmth");
      bubbleDNA.openness = Math.min(100, bubbleDNA.openness + 4);
      bubbleDNA.vitality = Math.min(100, bubbleDNA.vitality + 1);
      saveDNA();
      setTimeout(nextCard, 1200);
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

  // ====== 漂浮粒子 ======
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

  // ====== 泡泡水流动画 ======
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

})();
