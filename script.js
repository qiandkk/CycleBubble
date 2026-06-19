/**
 * CycleBubble 可交互 Demo
 * 线性流程：今日 → 记录 → 共鸣 → 规律（每页有"下一步"按钮）
 * 分支页：周期（从今日链接进入，可返回）
 */
(function () {
  "use strict";

  // ====== 页面切换 ======
  function switchTo(name, isBack) {
    var screens = document.querySelectorAll(".screen");
    for (var i = 0; i < screens.length; i++) {
      screens[i].classList.remove("active", "from-back");
    }
    var target = document.querySelector('.screen[data-screen="' + name + '"]');
    if (target) {
      target.classList.add("active");
      if (isBack) target.classList.add("from-back");
      // 滚动到顶部
      var body = target.querySelector(".screen-body");
      if (body) body.scrollTop = 0;
    }
  }

  // 绑定"下一步"按钮（data-next）
  var nextEls = document.querySelectorAll("[data-next]");
  for (var i = 0; i < nextEls.length; i++) {
    nextEls[i].addEventListener("click", function () {
      switchTo(this.getAttribute("data-next"), false);
    });
  }

  // 绑定"返回"按钮（data-back）
  var backEls = document.querySelectorAll("[data-back]");
  for (var j = 0; j < backEls.length; j++) {
    backEls[j].addEventListener("click", function () {
      switchTo(this.getAttribute("data-back"), true);
    });
  }

  // 绑定普通跳转链接（data-goto，如"了解周期背景"）
  var gotoEls = document.querySelectorAll("[data-goto]");
  for (var k = 0; k < gotoEls.length; k++) {
    gotoEls[k].addEventListener("click", function (e) {
      e.preventDefault();
      switchTo(this.getAttribute("data-goto"), false);
    });
  }

  // ====== 记录页：标签选择 ======
  var selectedChips = [];
  var chipBtns = document.querySelectorAll("#chips button");
  for (var c = 0; c < chipBtns.length; c++) {
    chipBtns[c].addEventListener("click", function () {
      this.classList.toggle("selected");
      var chip = this.getAttribute("data-chip");
      var idx = selectedChips.indexOf(chip);
      if (idx > -1) {
        selectedChips.splice(idx, 1);
      } else {
        selectedChips.push(chip);
      }
    });
  }

  // ====== 记录页：保存 → AI 理解过程 → 下一步 ======
  var saveBtn = document.getElementById("saveBtn");
  var aiProcessing = document.getElementById("aiProcessing");
  var aiResult = document.getElementById("aiResult");
  var recordInput = document.getElementById("recordInput");

  if (saveBtn) {
    saveBtn.addEventListener("click", function () {
      var text = recordInput ? recordInput.value.trim() : "";

      // 如果用户没写内容也没选标签，用默认内容
      if (!text && selectedChips.length === 0) {
        if (recordInput) {
          recordInput.value = "今天会议里有一句评价，我一直反复想起。好像不是那句话本身，而是我很在意自己有没有被认可。";
        }
        text = recordInput.value.trim();
      }

      // 如果没选标签，自动选"被评价"
      if (selectedChips.length === 0) {
        var defaultChip = document.querySelector('#chips button[data-chip="被评价"]');
        if (defaultChip) {
          defaultChip.classList.add("selected");
          selectedChips.push("被评价");
        }
      }

      // 隐藏保存按钮，显示 AI 过程态
      saveBtn.style.display = "none";
      aiProcessing.hidden = false;

      // 模拟 AI 理解过程（2 秒）
      setTimeout(function () {
        aiProcessing.hidden = true;
        aiResult.hidden = false;

        // 根据用户选的标签更新结果文案
        var resultText = aiResult.querySelector("p:not(.label)");
        if (resultText && selectedChips.length > 0) {
          var chipStr = selectedChips.join("、");
          resultText.innerHTML =
            "你提到的场景，和 <strong>" + chipStr + "</strong> 有关。这类感受在<strong>黄体期</strong>更容易出现。";
        }

        // 3 秒后自动进入共鸣页（下一步）
        setTimeout(function () {
          switchTo("resonance", false);
          // 重置记录页状态，方便再次体验
          setTimeout(function () {
            saveBtn.style.display = "";
            aiResult.hidden = true;
            aiProcessing.hidden = true;
          }, 500);
        }, 2800);
      }, 2000);
    });
  }

  // ====== 共鸣页：我也有过 ======
  var empathyBtn = document.getElementById("empathyBtn");
  var empathyFeedback = document.getElementById("empathyFeedback");

  if (empathyBtn) {
    empathyBtn.addEventListener("click", function () {
      this.style.background = "var(--coral)";
      this.style.color = "#fffdfb";
      this.textContent = "已表达";
      this.disabled = true;
      if (empathyFeedback) empathyFeedback.hidden = false;
    });
  }

})();
