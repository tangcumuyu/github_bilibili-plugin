// todo 关注列表的导入和导出
// 发起网络请求 公共函数
async function fetch_get(url, headers) {
  try {
    const data = await fetch(url, {
      method: "GET",
      headers: headers,
      credentials: "include",
    });
    return await data.json();
  } catch (error) {
    console.error("获取数据失败:", error);
  }
}

// 获取cookie 公共函数
function getCookie() {
  const cookies = document.cookie;
  return cookies;
}

//获取cookie某个值
function getCookiename(name) {
  const cookies = document.cookie;
  const match = cookies.match(new RegExp(`(^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[2]) : null;
}
// 一批关注24
async function fetchClassifyPage(mid, tagid, page, pageSize = 24) {
  try {
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
    const response = await fetch_get(url, relation_headers);
    if (!response || !response.data) {
      throw new Error(`无效的响应数据: ${JSON.stringify(response)}`);
    }
    return response.data;
  } catch (error) {
    console.error("fetchClassifyPage函数出错", error);
    throw error;
  }
}

//获取所有的关注分组， tagid参数
async function getFollowList() {
  try {
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
    return responseData;
  } catch (error) {
    console.error("getFollowList函数出错", error);
    throw error;
  }
}

// 获取某个分组下的所有关注
async function fetchAllFollowsByTag(mid, tagid, pageSize = 24) {
  let allData = [];
  let currentPage = 1;
  let hasMoreData = true;

  while (hasMoreData) {
    const pageData = await fetchClassifyPage(mid, tagid, currentPage, pageSize);

    if (pageData.length === 0) {
      console.log(`tagid=${tagid} 的第 ${currentPage} 页没有数据，终止请求`);
      hasMoreData = false;
      return [];
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

    // 添加请求间隔（防止被封禁）
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return allData;
}

// 全局变量用于存储数据
let allData = [];

//导出关注列表
async function exportFollowList(mid) {
  let followList = await getFollowList();
  // 修复循环变量声明
  for (let i = 0; i < followList.data.length; i++) {
    try {
      let data = await fetchAllFollowsByTag(mid, followList.data[i].tagid);

      const tagInfo = {
        data: data,
        title: followList.data[i].name, // 使用当前项的name
        tip: followList.data[i].tip, // 使用当前项的tip
        tagid: followList.data[i].tagid, // 添加tagid便于追踪
      };

      allData.push(tagInfo);
    } catch (error) {
      console.error(
        `Error fetching follows for tag ${followList.data[i].tagid}:`,
        error
      );
    }
  }

  console.log("完整数据:", allData);

  // 发送数据和导出指令
  const status = await chrome.runtime.sendMessage({
    action: "exportFollows",
    data: allData,
  });
}

// 发起关注up请求
async function fetchfollow(fid, act) {
  const url = new URL("https://api.bilibili.com/x/relation/modify");

  // 添加查询参数
  url.searchParams.append(
    "statistics",
    JSON.stringify({ appId: 100, platform: 5 })
  );
  url.searchParams.append(
    "x-bili-device-req-json",
    JSON.stringify({
      platform: "web",
      device: "pc",
      spmid: "333.1387",
    })
  );

  // 构造表单数据
  const csrfToken = getCookiename("bili_jct");
  const formData = new FormData();
  formData.append("fid", fid);
  formData.append("act", act.toString()); // 1-关注，2-取消关注
  formData.append("re_src", "11");
  formData.append("gaia_source", "web_main");
  formData.append("spmid", "333.1387");
  formData.append(
    "extend_content",
    JSON.stringify({
      entity: "user",
      entity_id: fid,
    })
  );
  formData.append("is_from_frontend_component", "true");
  formData.append("csrf", csrfToken);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Referer: "https://www.bilibili.com",
        Origin: "https://www.bilibili.com",
      },
      credentials: "include", // 包含cookie
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`请求状态: ${response.status}`);
    }

    const data = await response.json();
    console.log(data);
    return data;
  } catch (error) {
    console.error("请求失败:", error);
    throw error;
  }
}

// 封装JSON文件读取功能
function readJsonFile(file) {
  return new Promise((resolve, reject) => {
    // 验证文件类型
    const isValid =
      file.type === "application/json" ||
      file.name.toLowerCase().endsWith(".json");
    if (!isValid) {
      return reject(new Error("请选择.json文件"));
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        resolve(JSON.parse(e.target.result));
      } catch (err) {
        reject(new Error("无效的JSON格式"));
      }
    };
    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsText(file);
  });
}

// 打开或创建IndexedDB数据库
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("BilibiliFollowDB", 1);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("followedUps")) {
        db.createObjectStore("followedUps", { keyPath: "mid" });
      }
    };

    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

// 检查UP主是否已关注
async function isUpFollowed(mid) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["followedUps"], "readonly");
      const store = transaction.objectStore("followedUps");
      const request = store.get(mid);

      request.onsuccess = () => resolve(!!request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("检查关注状态失败:", err);
    return false;
  }
}

// 存储已关注的UP主
async function storeFollowedUp(mid) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["followedUps"], "readwrite");
      const store = transaction.objectStore("followedUps");
      const request = store.put({ mid, timestamp: Date.now() });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("存储关注记录失败:", err);
  }
}

let executionCount = 0; // 全局计数器

// 分组请求
async function groupbyFollow(jsonData) {
  // 处理每个分组
  for (const element of jsonData) {
    // 检查data字段是否存在
    if (!element.hasOwnProperty("data")) {
      console.warn("分组缺少data字段:", element);
      continue;
    }

    // 处理空数组情况
    if (!element.data || element.data.length === 0) {
      console.log("当前分组数据为空");
      continue;
    }

    // 批量关注UP主
    for (const e of element.data) {
      if (!e.mid) {
        console.warn("缺少UP主MID:", e);
        continue;
      }

      try {
        // 检查是否已关注
        const alreadyFollowed = await isUpFollowed(e.mid);
        if (alreadyFollowed) {
          console.log(`UP主 ${e.mid} 已关注，跳过`);
          continue;
        }

        // 关注UP主
        await fetchfollow(e.mid, 1);

        console.log(executionCount++);
        console.log(`已关注UP主: ${e.mid}`);

        // 存储到数据库
        await storeFollowedUp(e.mid);

        // 添加适当延迟避免请求过于频繁
        await new Promise((resolve) => setTimeout(resolve, 3000));
      } catch (err) {
        console.error(`关注UP主 ${e.mid} 失败:`, err);
      }
    }
  }

  console.log("已完成关注");
}

// 上传文件按钮加载 和 点击逻辑
function inputFileButton() {
  // 找到目标容器
  const followMainTitle = document.querySelector(".follow-main-title");
  followMainTitle.style.display = "flex";
  followMainTitle.style.justifyContent = "space-between";
  followMainTitle.style.alignItems = "center";

  const follow_batch = document.querySelector(".follow-main-title-batch");

  if (followMainTitle && follow_batch) {
    // 检查是否已存在上传按钮，避免重复添加
    if (!followMainTitle.querySelector(".upload-file-btn")) {
      const newHTML = `
        <div style="display:flex;align-items: center;">
           <button data-v-69356b15="" class="vui_button delete_grouping" style="">一键删除分组</button>
          <button data-v-69356b15="" class="vui_button grouping" style="margin-left: 10px;">一键分组</button>
          <button class="vui_button export-file-btn" style="margin-right: 10px; margin-left: 10px;">一键导出</button>
          <button class="vui_button upload-file-btn" style="margin-right: ${
            follow_batch.clientWidth + 10
          }px;">批量关注</button>
        </div>
      `;

      if (follow_batch) {
        follow_batch.insertAdjacentHTML("beforebegin", newHTML);
      }

      // 创建隐藏的文件input元素
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.style.display = "none";
      document.body.appendChild(fileInput);

      // 创建隐藏的文件input元素 处理分组
      const groupingInput = document.createElement("input");
      groupingInput.type = "file";
      groupingInput.style.display = "none";
      document.body.appendChild(groupingInput);

      // 批量关注已导出的关注分组列表 (用于把关注分组列表从小号转移到大号)
      const uploadButton = document.querySelector(".upload-file-btn");
      // 一键导出关注分组列表
      const exportButton = document.querySelector(".export-file-btn");
      // 一键分组(导出的关注分组列表利用python处理)
      const groupingButton = document.querySelector(".grouping");
      // 一键删除分组
      const deleteGrouping = document.querySelector(".delete_grouping");

      uploadButton.addEventListener("click", () => {
        const shouldProceed = confirm(`确定要执行一键关注操作吗？\n`);
        if (!shouldProceed) return;
        fileInput.click();
      });
      exportButton.addEventListener("click", () => {
        const mid = getCookiename("DedeUserID"); // 确保mid已定义
        const shouldProceed = confirm(`确定要执行导出关注操作吗？\n`);
        if (!shouldProceed) return;

        exportFollowList(mid);
      });
      groupingButton.addEventListener("click", () => {
        // 显示确认对话框 确定执行groupbyFollow
        const shouldProceed = confirm(`确定要执行一键分组操作吗？\n`);
        if (!shouldProceed) return;
        groupingInput.click();
      });

      deleteGrouping.addEventListener("click", async () => {
        // 显示确认对话框 确定执行groupbyFollow
        const shouldProceed = confirm(`确定要执行一键删除分组操作吗？\n`);
        if (!shouldProceed) return;

        let grouping_data = await Grouping_data();
        let tagids = [];
        grouping_data.data.forEach(async (e) => {
          if (e.name != "特别关注" && e.name != "默认分组")
            tagids.push(e.tagid);
        });
        // console.log(names);
        await new_Grouping("del", tagids);

        // https://api.bilibili.com/x/relation/tag/del
      });

      fileInput.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          const jsonData = await readJsonFile(file);
          console.log("获取到JSON数据:", jsonData);

          let sum = 0;
          jsonData.forEach((element) => {
            sum += element.data.length;
          });

          groupbyFollow(jsonData);
        } catch (error) {
          console.error("处理JSON文件失败:", error);
          alert(`错误: ${error.message}`);
        }
      });

      groupingInput.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          const jsonData = await readJsonFile(file);
          console.log("获取到JSON数据:", jsonData);

          await Grouping(jsonData);
        } catch (error) {
          console.error("处理JSON文件失败:", error);
          alert(`错误: ${error.message}`);
        }
      });
    }
  }
}

// 分组主函数
async function Grouping(jsonData) {
  // 遍历
  await new_Grouping("create", Object.keys(jsonData));
  let grouping_data = await Grouping_data();
  // grouping_data.data
  console.log(grouping_data);
  Object.keys(jsonData).forEach((key) => {
    grouping_data.data.forEach(async (e) => {
      if (e.name == key) {
        console.log(jsonData[key].length);
        const BATCH_SIZE = 40;
        if (jsonData[key].length < BATCH_SIZE) {
          const resources = jsonData[key].map((item) => `${item}`).join(",");
          console.log(resources);
          await fetchaddUsers(resources, e.tagid);
        } else {
          for (let i = 0; i < jsonData[key].length; i += BATCH_SIZE) {
            const batch = jsonData[key].slice(i, i + BATCH_SIZE);
            const resources = batch.map((item) => `${item}`).join(",");
            console.log(resources);
            await fetchaddUsers(resources, e.tagid);
          }
        }
      }
    });
  });
}

//up分组移动
async function fetchaddUsers(fids, tagids) {
  const url = new URL("https://api.bilibili.com/x/relation/tags/addUsers");
  url.searchParams.append(
    "x-bili-device-req-json",
    JSON.stringify({
      platform: "web",
      device: "pc",
      spmid: "333.1387",
    })
  );

  const csrf = getCookiename("bili_jct"); // 确保能正确获取 CSRF token

  // 遍历每个分组名，单独发送请求

  const formData = new FormData();
  formData.append("csrf", csrf);
  formData.append("fids", fids);
  formData.append("tagids", tagids);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Referer: "https://www.bilibili.com",
        Origin: "https://www.bilibili.com",
      },
      credentials: "include", // 包含 Cookie
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP 错误: ${response.status}`);
    }

    const data = await response.json();

    // 如果 API 返回错误码，抛出异常
    if (data.code !== 0) {
      throw new Error(`fetchaddUsers错误: ${data.message}`);
    }
  } catch (error) {
    console.error(`up分组移动失败:`, error);
    throw error; // 可以选择继续或终止
  }
}

// 新建分组请求
// create 创建
// del 删除
async function new_Grouping(Operation, names) {
  // const url = new URL("https://api.bilibili.com/x/relation/tag/create");
  const url = new URL(`https://api.bilibili.com/x/relation/tag/${Operation}`);
  url.searchParams.append(
    "x-bili-device-req-json",
    JSON.stringify({
      platform: "web",
      device: "pc",
      spmid: "333.1387",
    })
  );

  const csrf = getCookiename("bili_jct"); // 确保能正确获取 CSRF token

  if (!Array.isArray(names)) {
    names = [names];
  }

  // 遍历每个分组名，单独发送请求
  for (const name of names) {
    const formData = new FormData();
    formData.append("csrf", csrf);

    if (Operation == "create") {
      formData.append("tag", name);
    }
    if (Operation == "del") {
      formData.append("tagid", name);
    }
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Referer: "https://www.bilibili.com",
          Origin: "https://www.bilibili.com",
        },
        credentials: "include", // 包含 Cookie
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP 错误: ${response.status}`);
      }

      const data = await response.json();
      console.log(`分组 "${name}" 创建结果:`, data);

      // 如果 API 返回错误码，抛出异常
      if (data.code !== 0) {
        throw new Error(`B站API错误: ${data.message}`);
      }
    } catch (error) {
      console.error(`创建分组 "${name}" 失败:`, error);
      throw error; // 可以选择继续或终止
    }
  }

  return { success: true }; // 所有分组创建成功
}

//分组信息
async function Grouping_data() {
  url = "https://api.bilibili.com/x/relation/tags?web_location=333.1387";
  return await fetch_get(url, (headers = {}));
}

function main() {
  const followMain = document.querySelector(".follow-main");
  if (followMain) {
    inputFileButton();
  } else {
    setTimeout(main, 500); // 每500ms检查一次
  }
}
