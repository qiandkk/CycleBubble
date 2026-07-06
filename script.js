/**
 * CycleBubble v3 — Bubble Constitution
 * AI 永远隐藏在 Bubble 身后，Bubble 才是真正的主角。
 */
(function () {
  "use strict";

  // ====== Bubble DNA（成长模型，不可逆） ======
  var bubbleDNA = {
    stability: 0,
    depth: 0,
    openness: 0,
    vitality: 0,
    memoryLayers: [],
    evolution: "reflect",
    totalRecords: 0
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

  // ====== 由 DNA 计算 Bubble 状态（不展示给用户） ======
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
  }

  applyBubbleState();

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

  // ====== 记录页：放进泡泡 → Bubble 收下今天 → 发现 ======
  var saveBtn = document.getElementById("saveBtn");
  var bubbleSettling = document.getElementById("bubbleSettling");
  var settlingLiquid = document.getElementById("settlingLiquid");
  var settlingText = document.getElementById("settlingText");
  var recordInput = document.getElementById("recordInput");
  var noteField = document.getElementById("noteField");
  var recordHead = document.getElementById("recordHead");

  var settlingMessages = [
    "Bubble 正在轻轻回应今天……",
    "今天正在慢慢沉淀……",
    "Bubble 正在收下今天……",
    "今天正在成为 Bubble 的一部分……"
  ];

  if (saveBtn) {
    saveBtn.addEventListener("click", function () {
      if (recordInput && !recordInput.value.trim()) {
        recordInput.value = "今天开会时领导说了一句话，我反复想了一整天。好像在意的是自己有没有被认可。";
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

      // 3 秒后：DNA 成长（不可逆）→ 跳转发现页
      setTimeout(function () {
        clearInterval(msgInterval);

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

  // ====== 漂浮粒子 — 让 Bubble 持续"活着" ======
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
