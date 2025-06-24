// 获取var mid
STORAGE_KEY = "time_tracker";
function getStoredVideoData() {
  const storedData = localStorage.getItem(STORAGE_KEY);
  return storedData ? JSON.parse(storedData) : [];
}
const time_tracker = getStoredVideoData();
var [mid] = Object.keys(time_tracker);

async function fetch_get(url, headers) {
  try {
    const data = await fetch(url, {
      method: "GET",
      headers: headers,
      credentials: "include",
    });
    return await data.json(); // 等待解析 JSON
  } catch (error) {
    console.error("获取数据失败:", error);
  }
}

/**
 * 打开或创建 IndexedDB 数据库
 * @returns {Promise<IDBDatabase>}
 */
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("BiliClassifyDB", 1);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("classifyData")) {
        db.createObjectStore("classifyData", { keyPath: "tagid" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

/**
 * 检查指定tagid的缓存是否有效
 * @param {string|number} tagid - 分类标签ID
 * @returns {Promise<Array|null>} 返回缓存数据或null
 */
async function checkClassifyCache(tagid) {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("classifyData", "readonly");
      const store = transaction.objectStore("classifyData");
      const request = store.get(tagid);

      request.onsuccess = () => {
        if (request.result) {
          const cachedData = request.result;
          const now = new Date();
          const cacheTime = new Date(cachedData.timestamp);
          const hoursDiff = (now - cacheTime) / (1000 * 60 * 60);

          if (hoursDiff > 8) {
            console.log(`缓存数据已超过8小时，tagid=${tagid}`);
            resolve(null);
          } else {
            console.log(
              `从IndexedDB中读取到 tagid=${tagid} 的数据，共 ${cachedData.data.length} 条`
            );
            resolve(cachedData.data);
          }
        } else {
          resolve(null);
        }
      };

      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn(`读取缓存失败，tagid=${tagid}`, error);
    return null;
  }
}

/**
 * 保存数据到IndexedDB
 * @param {string|number} tagid - 分类标签ID
 * @param {Array} data - 要保存的数据
 * @returns {Promise<void>}
 */
async function saveClassifyCache(tagid, data) {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("classifyData", "readwrite");
      const store = transaction.objectStore("classifyData");

      const record = {
        tagid: tagid,
        data: data,
        timestamp: new Date().getTime(),
      };

      const request = store.put(record);

      request.onsuccess = () => {
        console.log(
          `成功存储 tagid=${tagid} 的数据到IndexedDB，共 ${data.length} 条`
        );
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("保存数据到IndexedDB失败:", error);
    throw error;
  }
}

/**
 * 获取单页分类数据
 * @param {string} mid - 用户MID
 * @param {string|number} tagid - 分类标签ID
 * @param {number} page - 页码
 * @param {number} pageSize - 每页数据量
 * @returns {Promise<Array>} 返回当页数据
 */
async function fetchClassifyPage(mid, tagid, page, pageSize = 24) {
  const url = `https://api.bilibili.com/x/relation/tag?tagid=${tagid}&pn=${page}&ps=${pageSize}&mid=${mid}&web_location=333.1387`;
  const relation_headers = {
    Accept: "*/*",
    Origin: "https://space.bilibili.com",
    Referer: `https://space.bilibili.com/${mid}/relation/follow`,
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36 Edg/136.0.0.0",
    "Sec-Ch-Ua":
      '"Chromium";v="136", "Microsoft Edge";v="136", "Not.A/Brand";v="99"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    Cookie: getCookie(),
  };
  // const headers = {};
  console.log(`请求 tagid=${tagid} 的第 ${page} 页数据...`);
  const response = await fetch_get(url, relation_headers);

  if (!response || !response.data) {
    throw new Error(`无效的响应数据: ${JSON.stringify(response)}`);
  }

  return response.data;
}

/**
 * 获取全部分类数据（带缓存检查）
 * @param {string} mid - 用户MID
 * @param {string|number} tagid - 分类标签ID
 * @param {number} [pageSize=24] - 每页数据量
 * @param {boolean} [forceRefresh=false] - 是否强制刷新缓存
 * @returns {Promise<Array>} 返回所有数据
 */
async function getClassifyDataWithCache(
  mid,
  tagid,
  pageSize = 24,
  forceRefresh = false
) {
  // 如果不强制刷新，先检查缓存
  if (!forceRefresh) {
    const cachedData = await checkClassifyCache(tagid);
    if (cachedData) {
      return cachedData;
    }
  }

  // 没有有效缓存或强制刷新，开始请求数据
  const allData = [];
  let currentPage = 1;
  let hasMoreData = true;

  try {
    while (hasMoreData) {
      const pageData = await fetchClassifyPage(
        mid,
        tagid,
        currentPage,
        pageSize
      );

      if (pageData.length === 0) {
        console.log(`tagid=${tagid} 的第 ${currentPage} 页没有数据，终止请求`);
        hasMoreData = false;
        break;
      }

      allData.push(...pageData);
      console.log(`成功获取 ${pageData.length} 条数据`);

      // 判断是否是最后一页
      if (pageData.length < pageSize) {
        hasMoreData = false;
        console.log(`tagid=${tagid} 的数据已全部获取，共 ${allData.length} 条`);
      } else {
        currentPage++;
      }

      // 添加请求间隔
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // 保存到IndexedDB
    if (allData.length > 0) {
      await saveClassifyCache(tagid, allData);
    }

    return allData;
  } catch (error) {
    console.error(`获取 tagid=${tagid} 的数据时出错:`, error);
    throw error;
  }
}

/**
 * 从IndexedDB中读取指定tagid的数据
 * @param {string|number} tagid - 分类标签ID
 * @returns {Promise<Array|null>} 返回数据数组或null
 */
async function getDataFromIndexedDB(tagid) {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("classifyData", "readonly");
      const store = transaction.objectStore("classifyData");
      const request = store.get(tagid);

      request.onsuccess = () => {
        if (request.result) {
          console.log(`读取到 tagid=${tagid} 的数据`, request.result);
          resolve(request.result.data);
        } else {
          console.log(`未找到 tagid=${tagid} 的数据`);
          resolve(null);
        }
      };

      request.onerror = () => {
        console.error("读取数据失败:", request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error("数据库访问失败:", error);
    throw error;
  }
}

var bili_dyn_live_users;
var bili_live_users__header;

// 添加元素
setTimeout(async () => {
  const left = this.document.querySelector(".left");

  if (!this.document.querySelector(".bili-dyn-live-users")) {
    bili_dyn_live_users = document.createElement("div");
    bili_dyn_live_users.className = "bili-dyn-live-users";
    // bili_dyn_live_users.style.position = "sticky";
    // bili_dyn_live_users.style.top = "72px";
    bili_dyn_live_users.style.margin = "0px";
    bili_dyn_live_users.style.padding = "0px";
    left.appendChild(bili_dyn_live_users);

    bili_live_users__header = document.createElement("div");
    bili_live_users__header.className = "bili-dyn-live-users__header";
    bili_dyn_live_users.appendChild(bili_live_users__header);
  } else {
    bili_dyn_live_users = this.document.querySelector(".bili-dyn-live-users");
    bili_live_users__header = this.document.querySelector(
      ".bili-dyn-live-users__header"
    );
  }

  const container = document.createElement("div");
  container.style.maxWidth = "99.9%";
  container.style.width = "99.9%";
  container.style.margin = "0 auto";
  // container.style.padding = "18px";
  // container.style.border = "1px solid #f0f0f0";
  container.style.fontFamily = "system-ui, -apple-system, sans-serif";

  // Create the list
  const groupList = document.createElement("ul");
  groupList.style.listStyle = "none";
  groupList.style.padding = "0";
  groupList.style.margin = "0";
  groupList.style.border = "1px solid #e7e7e7";
  groupList.style.borderRadius = "4px";
  // groupList.style.overflow = "hidden";

  const relation_headers = {
    Accept: "*/*",
    Origin: "https://space.bilibili.com",
    Referer: `https://space.bilibili.com/${mid}/relation/follow`,
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36 Edg/136.0.0.0",
    "Sec-Ch-Ua":
      '"Chromium";v="136", "Microsoft Edge";v="136", "Not.A/Brand";v="99"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    Cookie: getCookie(),
  };
  let responseData = await fetch_get(
    "https://api.bilibili.com/x/relation/tags?web_location=333.1387",
    relation_headers
  );

  // 在遍历前，添加一个 "全部关注" 的虚拟分组
  responseData.data.unshift({
    tagid: -1, // 使用一个特殊的 ID（比如 -1）表示"全部"
    name: "全部关注", // 显示名称
    count: responseData.data.reduce((sum, group) => sum + group.count, 0), // 计算总人数
    tip: "", // 可选的提示信息
  });

  responseData.data.forEach((group) => {
    const listItem = document.createElement("li");
    listItem.style.display = "flex";
    listItem.style.justifyContent = "space-between";
    listItem.style.alignItems = "center";
    listItem.style.padding = "12px 15px";
    listItem.style.borderBottom = "1px solid #f0f0f0";
    listItem.style.cursor = "pointer";
    listItem.style.transition = "background-color 0.2s";

    if (group.tagid === -10) {
      listItem.style.backgroundColor = "#fff8e6";
    }

    listItem.addEventListener("mouseenter", () => {
      listItem.style.backgroundColor = "#f9f9f9";
    });

    listItem.addEventListener("mouseleave", () => {
      listItem.style.backgroundColor =
        group.tagid === -10 ? "#fff8e6" : "transparent";
    });

    const groupInfo = document.createElement("div");

    const groupName = document.createElement("span");
    groupName.textContent = group.name;
    groupName.style.fontSize = "16px";
    groupName.style.fontWeight = "500";

    if (group.tip) {
      const groupTip = document.createElement("span");
      groupTip.textContent = "";
      groupTip.style.display = "block";
      groupTip.style.fontSize = "12px";
      groupTip.style.color = "#999";
      groupTip.style.marginTop = "4px";
      groupInfo.appendChild(groupTip);
    }

    const groupCount = document.createElement("span");
    groupCount.textContent = group.count;
    groupCount.style.backgroundColor = "#f4f4f4";
    groupCount.style.color = "#666";
    groupCount.style.padding = "2px 8px";
    groupCount.style.borderRadius = "10px";
    groupCount.style.fontSize = "12px";

    groupInfo.appendChild(groupName);
    listItem.appendChild(groupInfo);
    listItem.appendChild(groupCount);

    listItem.addEventListener("click", () => {
      window.scrollTo({
        top: 0,
        // behavior: "smooth", // 平滑滚动动画
      });
      handleGroupClick(group.tagid, group.name);
    });

    groupList.appendChild(listItem);
  });

  groupList.lastChild.style.borderBottom = "none";

  container.appendChild(groupList);

  bili_dyn_live_users.insertBefore(container, bili_live_users__header);

  bili_dyn_live_users.style.margin = "0";
  bili_dyn_live_users.style.padding = "0";
}, 500);

// todo 获取cookie
function getCookie() {
  const cookies = document.cookie;
  return cookies;
}

async function handleGroupClick(tagid, name) {
  const list__content = this.document.querySelector(
    ".bili-dyn-up-list__content"
  );
  const active = list__content.querySelectorAll(".bili-dyn-up-list__item")[0];
  var event = new MouseEvent("click", {
    // 模拟点击
    view: window,
    bubbles: true,
    cancelable: true,
  });
  active.dispatchEvent(event);

  if (tagid == -1 && name == "全部关注") {
    document.querySelectorAll(".bili-dyn-up-list__item").forEach((node) => {
      node.style.display = "";
    });
    document.querySelectorAll(".bili-dyn-list__item").forEach((node) => {
      node.style.display = "";
    });
    return;
  }
  console.log(`Clicked group: ${name} (ID: ${tagid})`);

  const mymid = mid;
  await getClassifyDataWithCache(mymid, tagid, (pageSize = 24));

  const current_tagid_data = await getDataFromIndexedDB(tagid);
  if (current_tagid_data == null) {
    return;
  }
  const dbTagIds = current_tagid_data.map((item) => item.uname);

  // 提取重复的过滤逻辑为单独函数
  function filterItems(container, selector, upname, dbTagIds) {
    const items = container.querySelectorAll(selector);
    items.forEach((node) => {
      const upName = node.textContent.trim();
      const item = node.closest(upname.split(" ")[0]);
      item.style.display = dbTagIds.includes(upName) ? "" : "none";
    });
  }

  // 过滤显示
  const containers = [
    {
      container: ".bili-dyn-up-list__window",
      selector: ".bili-dyn-up-list__item__name.bili-ellipsis",
      upname: ".bili-dyn-up-list__item",
    },
    {
      container: ".bili-dyn-list__items",
      selector: ".bili-dyn-title__text",
      upname: ".bili-dyn-list__item",
    },
  ];

  containers.forEach(({ container, selector, upname }) => {
    filterItems(document.querySelector(container), selector, upname, dbTagIds);
  });

  // todo    创建 MutationObserver 实例
  // 创建 MutationObserver 实例
  const observer = new MutationObserver((mutationsList, observer) => {
    filterItems(
      document.querySelector(".bili-dyn-list__items"),
      ".bili-dyn-title__text",
      ".bili-dyn-list__item",
      dbTagIds
    );
  });
  // 配置观察选项
  const config = { childList: true };
  // 开始观察目标盒子
  observer.observe(document.querySelector(".bili-dyn-list__items"), config);
}
