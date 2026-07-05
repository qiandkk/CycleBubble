/**
 * CycleBubble 精简版
 * 核心流程：首页"写点什么" → 记录页"放进泡泡" → 共鸣页看到相似内容
 */
(function () {
  "use strict";

  // ====== 页面切换 ======
  function switchTo(name) {
    var screens = document.querySelectorAll(".screen");
    for (var i = 0; i < screens.length; i++) {
      screens[i].classList.remove("active");
    }
    var target = document.querySelector('.screen[data-screen="' + name + '"]');
    if (target) {
      target.classList.add("active");
      var body = target.querySelector(".screen-body");
      if (body) body.scrollTop = 0;
    }

    var tabs = document.querySelectorAll(".tab-item");
    for (var j = 0; j < tabs.length; j++) {
      tabs[j].classList.remove("active");
    }
    var activeTab = document.querySelector('.tab-item[data-goto="' + name + '"]');
    if (activeTab) activeTab.classList.add("active");
  }

  // 绑定 Tab
  var tabItems = document.querySelectorAll(".tab-item");
  for (var t = 0; t < tabItems.length; t++) {
    tabItems[t].addEventListener("click", function () {
      switchTo(this.getAttribute("data-goto"));
    });
  }

  // 绑定跳转按钮（data-goto）
  var gotoEls = document.querySelectorAll("[data-goto]");
  for (var g = 0; g < gotoEls.length; g++) {
    if (!gotoEls[g].classList.contains("tab-item")) {
      gotoEls[g].addEventListener("click", function () {
        switchTo(this.getAttribute("data-goto"));
      });
    }
  }

  // 绑定返回按钮
  var backEls = document.querySelectorAll("[data-back]");
  for (var b = 0; b < backEls.length; b++) {
    backEls[b].addEventListener("click", function () {
      switchTo(this.getAttribute("data-back"));
    });
  }

  // ====== 记录页：放进泡泡 → AI 理解 → 跳共鸣 ======
  var saveBtn = document.getElementById("saveBtn");
  var aiProcessing = document.getElementById("aiProcessing");
  var recordInput = document.getElementById("recordInput");

  if (saveBtn) {
    saveBtn.addEventListener("click", function () {
      // 如果用户没写内容，填入默认内容
      if (recordInput && !recordInput.value.trim()) {
        recordInput.value = "今天会议里有一句评价，我一直反复想起。好像不是那句话本身，而是我很在意自己有没有被认可。";
      }

      // 隐藏按钮，显示 AI 过程态
      saveBtn.style.display = "none";
      aiProcessing.hidden = false;

      // 2 秒后跳转到 AI 理解结果页
      setTimeout(function () {
        switchTo("insight");
        // 重置记录页，方便再次体验
        setTimeout(function () {
          saveBtn.style.display = "";
          aiProcessing.hidden = true;
          if (recordInput) recordInput.value = "";
        }, 500);
      }, 2000);
    });
  }

  // ====== 共鸣页：连续翻阅 ======
  var resonanceCards = document.querySelectorAll(".resonance-card");
  var pageDots = document.querySelectorAll("#pageDots i");
  var currentIndex = 0;
  var totalCards = resonanceCards.length;

  function updatePager() {
    for (var d = 0; d < pageDots.length; d++) {
      pageDots[d].classList.remove("active");
    }
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

  var empathyBtns = document.querySelectorAll(".empathy-btn");
  var thankBtns = document.querySelectorAll(".thank-btn");

  for (var e = 0; e < empathyBtns.length; e++) {
    empathyBtns[e].addEventListener("click", function () {
      this.classList.add("responded");
      this.textContent = "已表达";
      this.disabled = true;
      setTimeout(nextCard, 1200);
    });
  }

  for (var th = 0; th < thankBtns.length; th++) {
    thankBtns[th].addEventListener("click", function () {
      this.classList.add("responded");
      this.textContent = "已感谢";
      this.disabled = true;
      setTimeout(nextCard, 1200);
    });
  }

  // ====== 关于弹层 ======
  var aboutLink = document.getElementById("aboutLink");
  var aboutModal = document.getElementById("aboutModal");
  var aboutClose = document.getElementById("aboutClose");

  if (aboutLink) {
    aboutLink.addEventListener("click", function () {
      aboutModal.hidden = false;
    });
  }

  if (aboutClose) {
    aboutClose.addEventListener("click", function () {
      aboutModal.hidden = true;
    });
  }

  if (aboutModal) {
    aboutModal.addEventListener("click", function (e) {
      if (e.target === aboutModal) aboutModal.hidden = true;
    });
  }

  // ====== 泡泡水流动画 — 实时更新 SVG path ======
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
        var w = waves[i];
        w.el.setAttribute("d", buildWavePath(t, w.amp, w.freq, w.speed, w.phase));
      }
      requestAnimationFrame(animateWaves);
    }
    requestAnimationFrame(animateWaves);
  }

})();