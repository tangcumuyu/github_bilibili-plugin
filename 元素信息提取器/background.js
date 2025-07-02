// 后台服务工作者 - 处理消息传递

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 处理来自内容脚本的消息
  if (message.action === "elementSelected") {
    // 将消息转发给弹出窗口
    chrome.runtime.sendMessage(message);
  }
});

// background.js
chrome.action.onClicked.addListener(async (tab) => {
  // 当扩展图标被点击时，执行下面的代码
  console.log("扩展图标被点击了！");
  try {
    // 首先确保内容脚本已注入
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    });

    // 发送消息到 content.js 并等待响应
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: "BACKGROUND_TO_CONTENT",
      message: "你好，这是来自background.js的消息",
    });

    console.log("收到来自content.js的回复:", response);
  } catch (error) {
    console.error("通信失败:", error);
  }
});
