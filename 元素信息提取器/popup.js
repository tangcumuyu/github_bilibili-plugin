document.addEventListener("DOMContentLoaded", function () {
  const toggleBtn = document.getElementById("toggleBtn");
  const clearBtn = document.getElementById("clearBtn");
  const emptyState = document.getElementById("emptyState");
  const elementInfo = document.getElementById("elementInfo");

  let isSelecting = false;

  function toggleSelectionMode() {
    isSelecting = !isSelecting;

    if (isSelecting) {
      toggleBtn.innerHTML = '<i class="fas fa-stop"></i> 停止选择';
      toggleBtn.classList.add("off");
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "startSelection" });
      });
    } else {
      toggleBtn.innerHTML = '<i class="fas fa-play"></i> 启用元素选择';
      toggleBtn.classList.remove("off");
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "stopSelection" });
      });
    }
  }

  // 按钮点击
  toggleBtn.addEventListener("click", toggleSelectionMode);

  // 清除显示的信息
  clearBtn.addEventListener("click", function () {
    emptyState.style.display = "block";
    elementInfo.style.display = "none";
  });

  // 键盘快捷键（明确添加空格键支持）
  document.addEventListener("keydown", function (e) {
    // 确保不是输入框中按的空格
    if (
      (e.code === "Space" || e.key === " ") &&
      !["INPUT", "TEXTAREA"].includes(e.target.tagName)
    ) {
      e.preventDefault();
      // toggleSelectionMode();
    }
  });

  // 监听来自内容脚本的消息
  chrome.runtime.onMessage.addListener(function (
    request,
    sender,
    sendResponse
  ) {
    if (request.action === "elementSelected") {
      displayElementInfo(request.elementData);
    }
  });

  // 显示元素信息
  function displayElementInfo(data) {
    emptyState.style.display = "none";
    elementInfo.style.display = "block";

    // 更新元素概览
    document.getElementById("tagName").textContent = data.tagName;
    document.getElementById("elementId").textContent = data.id || "无";
    document.getElementById("className").textContent = data.className || "无";
    document.getElementById("textContent").textContent = data.textContent
      ? data.textContent.trim().substring(0, 50) +
        (data.textContent.length > 50 ? "..." : "")
      : "无";

    // 更新HTML预览
    document.getElementById("htmlPreview").textContent = data.outerHTML;

    // 更新样式信息
    document.getElementById("computedStyles").textContent = data.computedStyles;

    // 更新位置信息
    document.getElementById("elementWidth").textContent = `${data.width}px`;
    document.getElementById("elementHeight").textContent = `${data.height}px`;
    document.getElementById("elementX").textContent = `${data.x}px`;
    document.getElementById("elementY").textContent = `${data.y}px`;

    // 添加高亮效果
    elementInfo.classList.add("highlight");
    setTimeout(() => {
      elementInfo.classList.remove("highlight");
    }, 2000);
  }

  // 初始模拟数据（实际使用时会被真实数据替换）
  setTimeout(() => {
    displayElementInfo({
      tagName: "H1",
      id: "main-title",
      className: "header-title primary",
      textContent: "欢迎使用元素信息提取器",
      outerHTML:
        '<h1 id="main-title" class="header-title primary">欢迎使用元素信息提取器</h1>',
      computedStyles: `color: #4a6cf7;
  font-size: 24px;
  font-weight: 700;
  margin: 0 0 20px 0;
  text-align: center;`,
      width: 380,
      height: 32,
      x: 120,
      y: 45,
    });
  }, 1500);
});
