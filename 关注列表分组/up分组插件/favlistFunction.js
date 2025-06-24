// 其余代码保持不变...
const currentUrl = window.location.href;
console.log(currentUrl);

if (currentUrl.includes("/favlist")) {
  // 收藏列表页面逻辑
  setTimeout(() => {
    if (typeof insertfavlist_btn === "function") {
      console.log("收藏页面加载");
      insertfavlist_btn();
    }
  }, 1000);
} else if (currentUrl.includes("/relation/follow")) {
  // 关注列表页面逻辑
  console.log("关注列表页面加载");
  main();
} else if (currentUrl.includes("/dynamic")) {
  // 关注列表页面逻辑
  console.log("动态页面加载");
  mainDynamic();
}

let lastUrl = window.location.href;
console.log(lastUrl);
const observer = new MutationObserver(() => {
  if (lastUrl !== window.location.href) {
    lastUrl = window.location.href;
    // 重新检查URL并执行相应逻辑
    if (lastUrl.includes("/favlist")) {
      console.log("收藏页面加载");
      insertfavlist_btn();
    }
    if (lastUrl.includes("/relation/follow")) {
      // 关注列表页面逻辑
      console.log("关注列表页面加载");
      main();
    }
    if (lastUrl.includes("dynamic")) {
      // 关注列表页面逻辑
      console.log("动态页面加载");
      mainDynamic();
    }
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
});
