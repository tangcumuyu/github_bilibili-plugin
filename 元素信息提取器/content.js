(function () {
  class ElementModificationStore {
    static MAX_HISTORY = 50;

    static saveModification(url, xpath, oldText, newText) {
      const history = this.getHistory();
      const record = {
        url,
        xpath,
        oldText,
        newText,
        timestamp: new Date().toISOString(),
      };

      // 去重并限制数量
      const newHistory = [
        record,
        ...history.filter(
          (item) => !(item.url === url && item.xpath === xpath)
        ),
      ].slice(0, this.MAX_HISTORY);

      localStorage.setItem(
        "elementModificationHistory",
        JSON.stringify(newHistory)
      );
    }

    static getModificationsByUrl(url) {
      return this.getHistory().filter((item) => item.url === url);
    }

    static getHistory() {
      return (
        JSON.parse(localStorage.getItem("elementModificationHistory")) || []
      );
    }

    static clearHistory() {
      localStorage.removeItem("elementModificationHistory");
    }
  }

  class ElementInspector {
    constructor() {
      this.isSelecting = false;
      this.currentHighlight = null;
      this.isDragging = false;
      this.offsetX = 0;
      this.offsetY = 0;
      this.hoverHighlight = null; // 用于存储悬停高亮元素
      this.highlightStyle = {
        border: "2px dashed #4a6cf7",
        backgroundColor: "rgba(74, 108, 247, 0.2)",
        position: "absolute",
        pointerEvents: "none",
        zIndex: "2147483644",
        boxSizing: "border-box",
      };

      // 其他初始化代码
      this.currentPageUrl = window.location.href;
      this.loadPageModifications();
      this.inspector = new ElementModificationStore();

      this.initElements();
      this.initStyles();
      this.initEventListeners();
      this.initDragHandling();
      this.Message();
    }
    // 创建悬停高亮元素
    createHoverHighlight(target) {
      this.removeHoverHighlight(); // 先移除现有的高亮

      this.hoverHighlight = document.createElement("div");
      const rect = target.getBoundingClientRect();

      Object.assign(this.hoverHighlight.style, this.highlightStyle, {
        left: `${rect.left + window.scrollX}px`,
        top: `${rect.top + window.scrollY}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
      });

      document.body.appendChild(this.hoverHighlight);
    }

    // 移除悬停高亮
    removeHoverHighlight() {
      if (this.hoverHighlight) {
        this.hoverHighlight.remove();
        this.hoverHighlight = null;
      }
    }

    // 更新悬停高亮位置
    updateHoverHighlight(target) {
      if (!this.hoverHighlight) return;

      const rect = target.getBoundingClientRect();
      Object.assign(this.hoverHighlight.style, {
        left: `${rect.left + window.scrollX}px`,
        top: `${rect.top + window.scrollY}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
      });
    }

    // 加载当前页面的修改记录
    loadPageModifications() {
      let startTime = Date.now();
      const MAX_RUNTIME_MS = 5000;
      const RETRY_INTERVAL = 10;

      const intervalId = setInterval(() => {
        if (Date.now() - startTime > MAX_RUNTIME_MS) {
          clearInterval(intervalId);
          console.log("Stopped after 5 seconds");
          return;
        }

        const allHistory =
          JSON.parse(localStorage.getItem("elementModificationHistory")) || [];
        const pageHistory = allHistory.filter((item) => {
          const getBiliUid = (url) => {
            const match = url.match(/space\.bilibili\.com\/(\d+)/);
            return match ? match[1] : null;
          };
          return getBiliUid(item.url) === getBiliUid(this.currentPageUrl);
        });

        console.log(pageHistory);

        // Try applying modifications
        const success = pageHistory.every((record) =>
          this.applyModification(record.xpath, record.newText)
        );

        // Stop if all modifications were successful
        if (success) {
          clearInterval(intervalId);
          console.log("All modifications applied successfully");
        }
      }, RETRY_INTERVAL);
    }
    // 根据XPath应用修改
    applyModification(xpath, newText) {
      console.log(xpath);
      try {
        const xpath_element = this.getElementByXPath(xpath);
        console.log("element2", xpath_element);
        if (xpath_element) {
          xpath_element.textContent = newText;
          console.log(`已恢复元素修改: ${xpath}`);
          return true;
        }
        return false;
      } catch (error) {
        console.error(`恢复修改失败: ${xpath}`, error);
        return false;
      }
    }
    // 初始化DOM元素
    initElements() {
      // 创建Shadow DOM容器
      this.shadowHost = document.createElement("div");
      document.body.appendChild(this.shadowHost);
      this.shadowRoot = this.shadowHost.attachShadow({ mode: "open" });

      // 创建悬浮窗容器在Shadow DOM内
      this.floatingWindow = document.createElement("div");
      this.floatingWindow.id = "element-inspector-floating-window";
      this.shadowRoot.appendChild(this.floatingWindow);

      // 创建控制按钮也在Shadow DOM内
      this.toggleButtonEl = document.createElement("div");
      this.toggleButtonEl.id = "element-inspector-toggle";
      this.shadowRoot.appendChild(this.toggleButtonEl);
      this.toggleButtonEl.innerHTML = `
      <svg t="1751436284777" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="2340" width="16" height="16">
        <path d="M924 439.8L686.2 202c-27.7-27.7-59.4-50.1-94.4-66.8C560 120 509.1 102 446.1 102h-2.2c-97.9 0.6-171.9 45.6-209.1 74.1-15-20.9-45.6-40.2-93.1-58.8-91.3-36.5-97-89.8-97.3-95.1v-0.3C44.3 9.8 34.4 0 22.3 0 10 0 0 10 0 22.3c0 3.5 1.4 86.9 125.5 136.5 61.9 24.2 73.4 42.8 75.2 46.7-0.1 0.6-0.1 1.1-0.1 1.7-32.2 34-97.8 118.1-98.6 236.8-0.4 63.3 17.5 114.7 32.6 146.7 16.7 35.4 39.4 67.6 67.4 95.5L439.8 924c64.4 64.5 150.4 100 242.1 100 91.7 0 177.7-35.5 242.1-100 64.5-64.4 100-150.4 100-242.1 0-91.7-35.5-177.7-100-242.1z m-31.4 452.8c-56 56-130.8 86.9-210.6 86.9-79.8 0-154.6-30.9-210.6-86.9L316.5 737.8c-9.9 4.6-19.9 9.1-30.1 13.4-2.8 1.2-5.7 1.7-8.6 1.7-8.7 0-17-5.1-20.5-13.7-4.7-11.3 0.6-24.4 12-29.1 4.6-1.9 9.1-3.9 13.6-5.9l-49.4-49.4c-24.3-24.3-44.1-52.3-58.6-83.1-10.8-22.8-28.7-69.6-28.3-127.4 0.9-125.7 88.2-209.3 98.2-218.4 20.1-18.4 94-78.6 199.5-79.3 55.4-0.5 100.5 15.5 128.5 28.8 30.4 14.5 58 34 82 58.1l35 35c1.6-4.3 3.1-8.6 4.6-13 4-11.6 16.6-17.9 28.2-13.9 11.6 4 17.9 16.6 13.9 28.2-3.8 11.2-7.9 22.2-12.2 33.2l168.2 168.2c56 56 86.9 130.8 86.9 210.6 0.1 79.9-30.8 154.7-86.8 210.8z" fill="#2c2c2c" p-id="2341"></path>
        <path d="M349.5 304.3c-8.7-8.7-22.8-8.7-31.5 0s-8.7 22.8 0 31.5l94.4 94.4c4.3 4.3 10 6.5 15.7 6.5s11.4-2.2 15.7-6.5c8.7-8.7 8.7-22.8 0-31.5l-94.3-94.4z" fill="#2c2c2c" p-id="2342"></path>
        <path d="M724.3 303.1c4.3-11 8.4-22 12.2-33.2 4-11.6-2.3-24.3-13.9-28.2-11.6-4-24.3 2.3-28.2 13.9-1.5 4.3-3.1 8.7-4.6 13-70.3 194.4-217.4 352-406.9 435.6-4.5 2-9 4-13.6 5.9-11.3 4.7-16.7 17.8-12 29.1 3.6 8.5 11.8 13.7 20.5 13.7 2.9 0 5.8-0.6 8.6-1.7 10.1-4.2 20.1-8.7 30.1-13.4 186.8-87.2 332.9-243 407.8-434.7z" fill="#2c2c2c" p-id="2343"></path>
      </svg>
    `;
      // 设置悬浮窗内容
      this.floatingWindow.innerHTML = `
          <!-- 保持原有的HTML结构 -->
<div class="container">
  <header>
    <h1><i class="fas fa-mouse-pointer"></i> 元素信息提取器</h1>
    <p class="tagline">点击页面上的任意元素获取其详细信息</p>
    <div class="controls">
      <button id="toggleBtn" class="btn">
        <i class="fas fa-play"></i> 启用元素选择
      </button>
      <button id="clearBtn" class="btn off">
        <i class="fas fa-trash"></i> 清除信息
      </button>
      <button id="closeBtn" class="btn off">
        <i class="fas fa-times"></i> 关闭窗口
      </button>
    </div>
  </header>

  <main class="info-container">
    <div id="emptyState" class="empty-state">
      <i class="fas fa-mouse"></i>
      <h3>没有选择元素</h3>
      <p>点击"启用元素选择"按钮，然后在页面上点击任意元素</p>
    </div>

    <div id="elementInfo" style="display: none">
      <div class="info-section">
        <div class="info-header">
          <i class="fas fa-info-circle"></i>
          <h2>元素概览</h2>
        </div>
        <div class="info-grid">
         <div class="groups">
              <div class="info-group">
                  <span class="info-label">标签名</span>
                  <span id="tagName" class="info-value">div</span>
              </div>
              <div class="info-group">
                  <span class="info-label">ID</span>
                  <span id="elementId" class="info-value">header</span>
              </div>
              <div class="info-group">
                  <span class="info-label">类名</span>
                  <span id="className" class="info-value">main-header</span>
              </div>
        </div>
          <div class="info-item">
            <span class="info-label">文本内容</span>
            <span id="textContent" class="info-value">欢迎访问我们的网站</span>
          </div>
          <div class="info-item">
            <span class="info-label">编辑文本内容</span>
            <textarea id="textContentInput" class="text-edit-input"></textarea>
            <div class="text-edit-btns">
              <button class="save-btn" id="saveTextBtn">保存</button>
              <button class="cancel-btn" id="cancelTextBtn">清空</button>
              <button class="store-btn" id="storeTextBtn">存储</button>
            </div>
          </div>
          <div class="info-item">
            <span class="info-label">元素xpath</span>
            <span id="xpath" class="info-value">欢迎访问我们的网站</span>
          </div>
        </div>
      </div>
      <div class="info-section">
        <div class="info-header">
          <i class="fas fa-code"></i>
          <h2>HTML 结构</h2>
        </div>
        <div class="element-preview" id="htmlPreview">
          &lt;div id="header" class="main-header"&gt;
          &lt;h1&gt;欢迎访问我们的网站&lt;/h1&gt; &lt;/div&gt;
        </div>
      </div>

      <div class="info-section">
        <div class="info-header">
          <i class="fas fa-paint-brush"></i>
          <h2>样式信息</h2>
        </div>
        <div class="info-content" id="computedStyles">
          font-size: 16px; color: #333; background-color: #f0f0f0; padding: 20px;
        </div>
      </div>

      <div class="info-section">
        <div class="info-header">
          <i class="fas fa-layer-group"></i>
          <h2>位置信息</h2>
        </div>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">宽度</span>
            <span id="elementWidth" class="info-value">1200px</span>
          </div>
          <div class="info-item">
            <span class="info-label">高度</span>
            <span id="elementHeight" class="info-value">80px</span>
          </div>
          <div class="info-item">
            <span class="info-label">X 坐标</span>
            <span id="elementX" class="info-value">120px</span>
          </div>
          <div class="info-item">
            <span class="info-label">Y 坐标</span>
            <span id="elementY" class="info-value">45px</span>
          </div>
        </div>
      </div>
    </div>



  </main>
</div>
<footer>
  <p>元素信息提取器 v1.0 &copy; 2023</p>
  <!-- 添加打赏按钮 -->
  <button id="donate-btn" style="
    background-color: #fb7299;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    margin-top: 10px;
  ">打赏支持</button>
  
  <!-- 打赏图片弹窗 -->
  <div id="donate-modal" style="
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0,0,0,0.7);
    z-index: 1000;
    justify-content: center;
    align-items: center;
  ">
    <div style="position: relative;">
      <img id="donate-img" src="" style="max-width: 80%; max-height: 80%;">
      <!-- 关闭按钮 -->
      <button id="close-modal" style="
        position: absolute;
        top: -0px;
        left: -0px;
        width: 30px;
        height: 30px;
        background: #ff4d4f;
        color: white;
        border: none;
        border-radius: 50%;
        font-size: 18px;
        cursor: pointer;
        display: flex;
        justify-content: center;
        align-items: center;
      ">×</button>
    </div>
  </div>
</footer>
</div>
            
    `;

      // 获取关键元素引用
      this.toggleBtn = this.floatingWindow.querySelector("#toggleBtn");
      this.clearBtn = this.floatingWindow.querySelector("#clearBtn");
      this.emptyState = this.floatingWindow.querySelector("#emptyState");
      this.elementInfo = this.floatingWindow.querySelector("#elementInfo");
      this.closeBtn = this.floatingWindow.querySelector("#closeBtn");
      this.header = this.floatingWindow.querySelector("header");

      //编辑文本
      this.saveTextBtn = this.floatingWindow.querySelector("#saveTextBtn");
      this.cancelTextBtn = this.floatingWindow.querySelector("#cancelTextBtn");
      this.storeTextBtn = this.floatingWindow.querySelector("#storeTextBtn");

      //打赏
      this.donateBtn = this.floatingWindow.querySelector("#donate-btn");
      this.donateModal = this.floatingWindow.querySelector("#donate-modal");
      this.donateImg = this.floatingWindow.querySelector("#donate-img");
      this.closeModalBtn = this.floatingWindow.querySelector("#close-modal");
      // 设置打赏图片URL
      this.donateImageUrl =
        "https://img.picui.cn/free/2025/07/02/6865444643f83.jpg";
    }

    // 初始化样式
    initStyles() {
      const style = document.createElement("style");
      style.textContent = `

    /* 悬浮窗主容器 */
    #element-inspector-floating-window {
      position: fixed;
      right: 20px;
      top: 50%;
      transform: translateY(-50%);
      width: 400px;
      max-height: 80vh;
      z-index: 2147483647;
      font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
      border-radius: 12px;
      overflow: hidden;
      background: linear-gradient(135deg, #1a2a6c, #b21f1f, #1a2a6c);
      color: #fff;
      transition: all 0.3s ease;
    }
    
    #element-inspector-floating-window * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    #element-inspector-floating-window .container {
      max-width: 100%;
      background: rgba(25, 25, 35, 0.9);
      height: 100%;
    }
    
    #element-inspector-floating-window header {
      background: rgba(10, 15, 30, 0.9);
      padding: 20px;
      text-align: center;
      border-bottom: 2px solid #4a6cf7;
    }
    
    #element-inspector-floating-window h1 {
      font-size: 24px;
      margin-bottom: 10px;
      color: #4a6cf7;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
    }
    
    #element-inspector-floating-window .tagline {
      color: #9ab3f5;
      font-size: 14px;
      margin-bottom: 15px;
    }
    
    #element-inspector-floating-window .controls {
      display: flex;
      justify-content: center;
      gap: 15px;
      padding: 10px 0;
    }
    
    #element-inspector-floating-window .btn {
      padding: 10px 20px;
      border-radius: 30px;
      border: none;
      font-weight: 400;
      cursor: pointer;
      display: flex;
      align-items: center;
      font-size: 10px !important;
      gap: 5px;
      transition: all 0.3s ease;
      background: linear-gradient(to right, #4a6cf7, #8a2be2);
      color: white;
      box-shadow: 0 4px 15px rgba(74, 108, 247, 0.4);
    }
    
    #element-inspector-floating-window .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(74, 108, 247, 0.6);
    }
    
    #element-inspector-floating-window .btn:active {
      transform: translateY(1px);
    }
    
    #element-inspector-floating-window .btn.off {
      background: linear-gradient(to right, #f54a4a, #be2e8a);
    }
    
  #element-inspector-floating-window .info-container {
      padding: 20px;
      overflow-y: auto;  /* 添加垂直滚动条 */
      max-height: calc(100% - 120px); /* 设置最大高度，减去header和footer的高度 */
      scrollbar-width: thin; /* Firefox支持 */
  }
    
    #element-inspector-floating-window .info-section {
      background: rgba(30, 35, 50, 0.7);
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 20px;
      border-left: 3px solid #4a6cf7;
    }
    
    #element-inspector-floating-window .info-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 15px;
      color: #9ab3f5;
    }
    
    #element-inspector-floating-window .info-content {
      background: rgba(20, 25, 40, 0.6);
      border-radius: 6px;
      padding: 15px;
      font-family: monospace;
      font-size: 14px;
      max-height: 200px;
      overflow: auto;
      white-space: pre-wrap;
    }
    
    #element-inspector-floating-window .info-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 12px;
      margin-top: 15px;
    }
    #element-inspector-floating-window .groups {
        display: flex;        /* 启用 flex 布局 */
        flex-wrap: nowrap;    /* 不换行 */
        gap: 16px;            /* 元素之间的间距，可根据需要调整 */
        background: rgba(40, 45, 60, 0.7);
        border-radius: 6px;
        padding: 10px;
        flex-wrap: nowrap;
    }
    #element-inspector-floating-window .groups .info-group {
        display: flex;
        flex: 1; /* 关键！让所有子项等宽 */
        min-width: 0; /* 防止内容溢出影响布局 */
        flex-direction: column;  /* 垂直排列 */
        gap: 4px;               /* 标签和值之间的间隔 */
        margin-right: 16px;     /* 组与组之间的间隔 */
        align-items: center;
        text-align: center; /* 让 inline-block 子元素居中 */
    }
    #element-inspector-floating-window .info-item {
      background: rgba(40, 45, 60, 0.7);
      border-radius: 6px;
      padding: 10px;
      display: flex;
      flex-direction: column;
    }
    
    #element-inspector-floating-window .info-label {
      font-size: 12px;
      color: #9ab3f5;
      margin-bottom: 5px;
    }
    
    #element-inspector-floating-window .info-value {
      font-size: 14px;
      font-weight: 600;
      color: #fff;
      word-break: break-all;
    }
    #element-inspector-floating-window .text-edit-input  {
      font-size: 14px;
      font-weight: 600;
      color: #fff;
      word-break: break-all;
      background: rgba(40, 45, 60, 0.7);
      height:80%;
      min-height:100px;
    }

    #element-inspector-floating-window .text-edit-btns {
      display: flex;
      gap: 12px;
      margin: 15px 15px 15px 0px;
    }

    #element-inspector-floating-window .text-edit-btns .save-btn,
    #element-inspector-floating-window .text-edit-btns .cancel-btn,
    #element-inspector-floating-window .text-edit-btns .store-btn{
      flex: 1;
      min-width: 15px;
      padding: 6px 6px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      border: none;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    
    /* 保存按钮专属样式 */
    #element-inspector-floating-window .text-edit-btns .save-btn {
      background: linear-gradient(135deg, #4a6cf7, #6a8aff);
      color: white;
    }

    /* 取消按钮专属样式 */
    #element-inspector-floating-window .text-edit-btns .cancel-btn {
      background: linear-gradient(135deg, #f54a4a, #ff6b6b);
      color: white;
    }

    /* 存储按钮专属样式 */
    #element-inspector-floating-window .text-edit-btns .store-btn{
      background: linear-gradient(135deg,rgb(50, 176, 185),rgb(55, 185, 174));
      color: white;
    }

    /* 悬停效果 */
    #element-inspector-floating-window .text-edit-btns .save-btn:hover {
      background: linear-gradient(135deg, #3a5bd9, #5a7aee);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(74, 108, 247, 0.3);
    }

    #element-inspector-floating-window .text-edit-btns .cancel-btn:hover {
      background: linear-gradient(135deg, #e53a3a, #ee5b5b);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(245, 74, 74, 0.3);
    }

    /* 点击效果 */
    #element-inspector-floating-window .text-edit-btns .save-btn:active {
      transform: translateY(1px);
      box-shadow: 0 1px 4px rgba(74, 108, 247, 0.3);
    }

    #element-inspector-floating-window .text-edit-btns .cancel-btn:active {
      transform: translateY(1px);
      box-shadow: 0 1px 4px rgba(245, 74, 74, 0.3);
    }

    /* 禁用状态 */
    #element-inspector-floating-window .text-edit-btns button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none !important;
    }
    
    
    #element-inspector-floating-window .empty-state {
      text-align: center;
      padding: 40px 20px;
      color: #9ab3f5;
    }
    
    #element-inspector-floating-window .empty-state i {
      font-size: 48px;
      margin-bottom: 20px;
      color: #4a6cf7;
    }
    
    #element-inspector-floating-window .empty-state h3 {
      font-size: 20px;
      margin-bottom: 10px;
    }
    
    #element-inspector-floating-window .element-preview {
      background: rgba(20, 25, 40, 0.6);
      border-radius: 8px;
      padding: 15px;
      margin-top: 10px;
      border: 1px solid #4a6cf7;
      max-height: 150px;
      overflow: auto;
      font-size: 14px;
    }
    
    #element-inspector-floating-window footer {
      text-align: center;
      padding: 15px;
      font-size: 12px;
      color: #9ab3f5;
      border-top: 1px solid rgba(74, 108, 247, 0.3);
    }
    
    /* 滚动条样式 */
    #element-inspector-floating-window ::-webkit-scrollbar {
      width: 8px;
    }
    
    #element-inspector-floating-window ::-webkit-scrollbar-track {
      background: rgba(30, 35, 50, 0.5);
      border-radius: 4px;
    }
    
    #element-inspector-floating-window ::-webkit-scrollbar-thumb {
      background: #4a6cf7;
      border-radius: 4px;
    }
    
    /* 高亮样式 */
    #element-inspector-floating-window .highlight {
      animation: highlight 2s ease;
    }
    
    @keyframes highlight {
      0% {
        background: rgba(74, 108, 247, 0.3);
      }
      100% {
        background: transparent;
      }
    }
  
    
    /* 控制按钮样式 */
    #element-inspector-toggle {
      position: fixed;
      right: 10px;
      top: 10px;
      width: 40px;
      height: 40px;
      background:rgb(223, 225, 231);
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 2147483646;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      transition: all 0.3s ease;
    }
    
    #element-inspector-toggle:hover {
      background:rgb(169, 169, 172);
      transform: scale(1.1);
    }
    
    /* 隐藏状态 */
     .hidden {
      transform: translateY(-50%) translateX(120%);
      opacity: 0;
      display:none;
    }
    
    /* 滚动容器 */
    #element-inspector-floating-window .info-container {
      padding: 20px;
      overflow-y: auto;
      max-height: calc(80vh - 160px);
      overscroll-behavior: contain; /* 阻止滚动传播 */
    }
    
    /* 阻止悬浮窗滚动时影响外部页面 */
    #element-inspector-floating-window .info-container::-webkit-scrollbar-track {
      background: rgba(30, 35, 50, 0.5);
    }
    
    #element-inspector-floating-window .info-container::-webkit-scrollbar-thumb {
      background: #4a6cf7;
    }

    /* 存储成功的弹窗样式 */
    .custom-notification {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #4CAF50;
      color: white;
      padding: 15px 20px;
      border-radius: 4px;
      box-shadow: 0 3px 10px rgba(0,0,0,0.2);
      display: flex;
      align-items: center;
      transform: translateY(100px);
      opacity: 0;
      transition: all 0.3s ease;
      z-index: 9999;
    }

    .show {
      transform: translateY(0);
      opacity: 1;
    }

    .error {
      background: #f44336;
    }

    .notification-content {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
  `;
      this.shadowRoot.appendChild(style);
    }

    // 初始化事件监听
    initEventListeners() {
      this.morenshowWindow();
      // 控制按钮事件
      this.toggleButtonEl.addEventListener("click", () => this.toggleWindow());

      // 窗口内按钮事件
      this.toggleBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.toggleSelectionMode();
      });

      this.clearBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.clearSelection();
      });

      this.closeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.hideWindow();
      });

      // 阻止悬浮窗滚动事件传播
      this.floatingWindow.addEventListener(
        "wheel",
        (e) => {
          e.stopPropagation();
        },
        { passive: false }
      );

      // 根据xpath修改页面
      this.saveTextBtn.addEventListener("click", (e) => {
        const xpath = this.floatingWindow.querySelector("#xpath").textContent;
        const textContentInput =
          this.floatingWindow.querySelector("#textContentInput").value;
        console.log("xpath", xpath);
        console.log("textContentInput", textContentInput);
        if (!xpath) return;

        try {
          const element = this.getElementByXPath(xpath);
          console.log("element", element);
          if (element) {
            element.textContent = textContentInput;
          } else {
            alert("未找到匹配的元素");
          }
        } catch (error) {
          console.error("XPath错误:", error);
          alert("XPath格式不正确");
        }
      });

      // 根据xpath修改页面
      this.cancelTextBtn.addEventListener("click", (e) => {
        const textContentInput =
          this.floatingWindow.querySelector("#textContentInput");
        textContentInput.value = "";
      });

      this.storeTextBtn.addEventListener("click", (e) => {
        const oldtextContent =
          this.floatingWindow.querySelector("#textContent").textContent;
        const newContentInput =
          this.floatingWindow.querySelector("#textContentInput").value;
        const xpath = this.floatingWindow.querySelector("#xpath").textContent;

        const isSaved = this.handleTextSave(
          oldtextContent,
          newContentInput,
          xpath
        );

        if (isSaved) {
          this.showSaveNotification("存储成功", "success");
        }
      });

      // 添加打赏点击事件
      this.donateBtn.addEventListener("click", () => {
        console.log("按钮被点击");

        // 预加载图片
        const img = new Image();
        img.src = this.donateImageUrl;
        console.log(this.donateImageUrl);
        img.onload = () => {
          console.log("图片加载完成");
          this.donateImg.src = this.donateImageUrl;
          this.donateModal.style.display = "flex";
          this.donateModal.style.zIndex = "9999"; // 确保在最上层
        };

        img.onerror = () => {
          console.error("图片加载失败");
          this.donateModal.innerHTML =
            '<p style="color:white">图片加载失败，请稍后再试</p>';
          this.donateModal.style.display = "flex";
        };
      });

      // 关闭按钮点击事件
      this.closeModalBtn.addEventListener("click", () => {
        this.donateModal.style.display = "none";
      });

      // 点击模态框外部关闭
      this.donateModal.addEventListener("click", (e) => {
        if (e.target === this.donateModal) {
          this.donateModal.style.display = "none";
        }
      });
    }

    // 存储成功的弹窗
    showSaveNotification(message, type = "success") {
      const notification = document.createElement("div");
      notification.className = `custom-notification ${type}`;
      notification.innerHTML = `
        <div class="notification-content">
          <span>${message}</span>
        </div>
      `;
      this.floatingWindow.appendChild(notification);

      // 添加 show
      setTimeout(() => {
        notification.classList.add("show");
      }, 10);

      setTimeout(() => {
        notification.classList.remove("show");
        setTimeout(() => {
          notification.remove();
        }, 300);
      }, 3000);
    }
    // 初始化拖动处理
    initDragHandling() {
      this.header.addEventListener("mousedown", (e) => {
        if (e.target.tagName === "BUTTON") return;

        this.isDragging = true;
        const rect = this.floatingWindow.getBoundingClientRect();
        this.offsetX = e.clientX - rect.left;
        this.offsetY = e.clientY - rect.top;
        this.floatingWindow.style.cursor = "grabbing";
      });

      document.addEventListener("mousemove", (e) => {
        if (!this.isDragging) return;

        this.floatingWindow.style.left = `${e.clientX - this.offsetX}px`;
        this.floatingWindow.style.top = `${e.clientY - this.offsetY}px`;
        this.floatingWindow.style.right = "auto";
        this.floatingWindow.style.transform = "none";
      });

      document.addEventListener("mouseup", () => {
        this.isDragging = false;
        this.floatingWindow.style.cursor = "";
      });
    }

    // 通过给定的 XPath 表达式在网页中查找并返回对应的 DOM 元素
    getElementByXPath(xpath) {
      // 类型检查
      if (typeof xpath !== "string") {
        console.error("XPath参数必须是字符串");
        return null;
      }

      // 空值检查
      if (!xpath.trim()) {
        console.error("XPath不能为空");
        return null;
      }

      try {
        // 添加默认前缀（如果用户忘记加/）
        const processedXpath = xpath.startsWith("/") ? xpath : `//${xpath}`;

        const result = document.evaluate(
          processedXpath,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        );

        const element = result.singleNodeValue;
        if (!element) {
          throw new Error("未找到匹配的元素");
        }
        return element;
      } catch (error) {
        console.error(`XPath错误: ${error.message}`, {
          invalidXpath: xpath,
          errorType: error.name,
        });
        console.log("XPath错误");
        return null;
      }
    }

    // 显示窗口
    showWindow() {
      this.floatingWindow.classList.remove("hidden");
      this.toggleButtonEl.style.display = "";
      this.positionWindow();
    }
    // 默认显示窗口
    morenshowWindow() {
      this.floatingWindow.classList.add("hidden");
      this.toggleButtonEl.style.display = "";
      this.positionWindow();
    }

    // 应用已存储的页面元素修改
    applyStoredModifications() {
      // 1. 从存储中获取当前页面的所有修改记录
      ElementModificationStore.getModificationsByUrl(this.currentPageUrl)
        // 2. 遍历每条记录
        .forEach(({ xpath, newText }) => {
          // 3. 对每条记录应用修改
          this.applyModification(xpath, newText);
        });
    }

    handleTextSave(oldtextContent, newContentInput, xpath) {
      try {
        ElementModificationStore.saveModification(
          this.currentPageUrl,
          xpath,
          oldtextContent,
          newContentInput
        );
        return true;
      } catch (error) {
        console.error("handleTextSave:", error);
        return false;
      }
    }
    // 切换窗口显示/隐藏状态
    toggleWindow() {
      if (this.floatingWindow.classList.contains("hidden")) {
        this.floatingWindow.classList.remove("hidden");
        this.positionWindow();
      } else {
        this.floatingWindow.classList.add("hidden");

        // 如果正在选择模式，退出选择
        if (this.isSelecting) {
          this.toggleSelectionMode();
        }
      }
    }

    Message() {
      // 监听来自background.js的消息
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.type === "BACKGROUND_TO_CONTENT") {
          console.log("收到来自background.js的消息:", request.message);

          // 发送响应
          sendResponse({
            type: "CONTENT_REPLY",
            message: "content.js已收到你的消息",
          });
        }
        this.morenshowWindow();
        // 保持通道开放以支持异步响应
        return true;
      });
    }
    // 隐藏窗口
    hideWindow() {
      this.floatingWindow.classList.add("hidden");
      this.toggleButtonEl.style.display = "none";
      if (this.isSelecting) {
        this.toggleSelectionMode();
      }
    }

    // 定位窗口
    positionWindow() {
      this.floatingWindow.style.right = "20px";
      this.floatingWindow.style.top = "50%";
      this.floatingWindow.style.transform = "translateY(-50%)";
    }

    toggleSelectionMode() {
      this.isSelecting = !this.isSelecting;

      if (this.isSelecting) {
        this.toggleBtn.innerHTML = '<i class="fas fa-stop"></i> 停止选择';
        this.toggleBtn.classList.add("off");
        document.body.style.cursor = "crosshair";

        // 添加鼠标移动监听
        document.addEventListener("mousemove", this.handleMouseMove, {
          capture: true,
          passive: true,
        });

        document.addEventListener("click", this.handleElementSelection, {
          capture: true,
          passive: false,
        });
      } else {
        this.toggleBtn.innerHTML = '<i class="fas fa-play"></i> 启用元素选择';
        this.toggleBtn.classList.remove("off");
        document.body.style.cursor = "";

        document.removeEventListener("mousemove", this.handleMouseMove, {
          capture: true,
        });
        document.removeEventListener("click", this.handleElementSelection, {
          capture: true,
        });
        this.removeHoverHighlight();
        this.removeHighlight();
      }
    }

    // 添加鼠标移动处理函数
    handleMouseMove = (e) => {
      if (!this.isSelecting) return;

      const target = e.target;
      if (
        target === this.hoverHighlight ||
        target === this.currentHighlight ||
        target === this.floatingWindow
      ) {
        return;
      }

      if (!this.hoverHighlight) {
        this.createHoverHighlight(target);
      } else {
        this.updateHoverHighlight(target);
      }
    };

    // 处理元素选择
    handleElementSelection = (e) => {
      // 彻底阻止所有默认行为和传播
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      if (!this.isSelecting) return;

      const target = e.target;
      this.removeHighlight();
      this.createHighlight(target);
      this.displayElementInfo(target);
      this.toggleSelectionMode();
    };

    // 创建高亮效果
    createHighlight(target) {
      this.currentHighlight = document.createElement("div");
      const rect = target.getBoundingClientRect();
      this.currentHighlight.style.cssText = `
      position: absolute;
      left: ${rect.left}px;
      top: ${rect.top}px;
      width: ${rect.width}px;
      height: ${rect.height}px;
      border: 2px solid #4a6cf7;
      background-color: rgba(74, 108, 247, 0.3);
      pointer-events: none;
      z-index: 2147483645;
    `;
      document.body.appendChild(this.currentHighlight);
    }

    // 移除高亮效果
    removeHighlight() {
      if (this.currentHighlight) {
        this.currentHighlight.remove();
        this.currentHighlight = null;
      }
    }

    // 获取元素的 XPath 路径
    getXPath(element) {
      if (element.id !== "") {
        // 如果元素具有 ID 属性
        return '//*[@id="' + element.id + '"]'; // 返回格式为 '//*[@id="elementId"]' 的 XPath 路径
      }
      if (element === document.body) {
        // 如果当前元素是 document.body
        return "/html/body"; // 返回 '/html/body' 的 XPath 路径
      }

      var index = 1;
      const childNodes = element.parentNode
        ? element.parentNode.childNodes
        : []; // 获取当前元素的父节点的子节点列表
      var siblings = childNodes;

      for (var i = 0; i < siblings.length; i++) {
        var sibling = siblings[i];
        if (sibling === element) {
          // 遍历到当前元素
          // 递归调用，获取父节点的 XPath 路径，然后拼接当前元素的标签名和索引
          return (
            this.getXPath(element.parentNode) +
            "/" +
            element.tagName +
            "[" +
            index +
            "]"
          );
        }
        if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
          // 遍历到具有相同标签名的元素
          index++; // 增加索引值
        }
      }
    }
    // 显示元素信息
    displayElementInfo(target) {
      const rect = target.getBoundingClientRect();
      const elementData = {
        tagName: target.tagName,
        id: target.id || "无",
        className: target.className || "无",
        textContent: target.textContent || "无",
        outerHTML: target.outerHTML,
        computedStyles: this.getComputedStyles(target),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        XPath: this.getXPath(target),
      };

      this.emptyState.style.display = "none";
      this.elementInfo.style.display = "block";

      // 更新UI显示
      this.floatingWindow.querySelector("#tagName").textContent =
        elementData.tagName;
      this.floatingWindow.querySelector("#elementId").textContent =
        elementData.id;
      this.floatingWindow.querySelector("#className").textContent =
        elementData.className;
      this.floatingWindow.querySelector("#textContent").textContent =
        elementData.textContent;
      this.floatingWindow.querySelector("#xpath").textContent =
        elementData.XPath;
      this.floatingWindow.querySelector("#htmlPreview").textContent =
        elementData.outerHTML;
      this.floatingWindow.querySelector("#computedStyles").textContent =
        elementData.computedStyles;
      this.floatingWindow.querySelector(
        "#elementWidth"
      ).textContent = `${elementData.width}px`;
      this.floatingWindow.querySelector(
        "#elementHeight"
      ).textContent = `${elementData.height}px`;
      this.floatingWindow.querySelector(
        "#elementX"
      ).textContent = `${elementData.x}px`;
      this.floatingWindow.querySelector(
        "#elementY"
      ).textContent = `${elementData.y}px`;

      // 添加高亮动画
      this.elementInfo.classList.add("highlight");
      setTimeout(() => {
        this.elementInfo.classList.remove("highlight");
      }, 2000);
    }

    // 获取计算样式
    getComputedStyles(element) {
      const computed = window.getComputedStyle(element);
      const importantStyles = [
        "color",
        "background-color",
        "font-size",
        "font-family",
        "width",
        "height",
        "padding",
        "margin",
        "border",
        "display",
        "position",
        "top",
        "left",
        "right",
        "bottom",
      ];

      return importantStyles
        .map((prop) => `${prop}: ${computed.getPropertyValue(prop)};`)
        .join("\n");
    }

    // 清除选择
    clearSelection() {
      this.emptyState.style.display = "block";
      this.elementInfo.style.display = "none";
      this.removeHighlight();
    }
  }

  if (!window.elementInspectorInstance) {
    window.elementInspectorInstance = new ElementInspector();
  }
})();
