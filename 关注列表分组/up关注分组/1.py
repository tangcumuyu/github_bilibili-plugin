import time
from pylab import mpl
import requests
import json
from collections import defaultdict
import matplotlib.pyplot as plt
from collections import OrderedDict
import webbrowser
from pathlib import Path


# 读取分类模板数据
with open("classify_template.json", 'r', encoding='utf-8') as f:
    major_partitions = json.load(f)


partitions_up = {category: [] for category in major_partitions}
partitions_up["等待分组"] = []


 # 发起请求

def getFetch(mid):
    url = f"https://app.biliapi.com/x/v2/space/archive/cursor?vmid={mid}"
    headers = {
        "Referer": "https://space.bilibili.com",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }
    time.sleep(1)
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()  # Raises exception for 4XX/5XX errors
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error: {e}")
        print("up主没有发布视频", mid)
        # 没有投稿的或投稿被删除的up转移至未分组
        partitions_up['未分组'].append(mid)
        return None

# 统计up的tname数量
def statisticsUP(data):
    tnames = {}
    for video in data['data']['item']:
        # print(json.dumps(video, indent=4, ensure_ascii=False))
        tname = video['tname']  # 获取视频分区名称
        # 统计分区出现次数
        if tname in tnames:
            tnames[tname] += 1
        else:
            tnames[tname] = 1
    return tnames


# 过滤账号已注销的mid
def statistics_from_file(file_path):
    """
    从JSON文件读取数据获取所有要分区的up的mid

    参数:
        file_path: JSON文件路径

    返回: mids 所有要统计的up的mid
    """
    mids =[]

    try:
        # 1. 读取JSON文件
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        for i in data:
            if(i['data']):
                for j in i['data']:
                    if j.get('mid') and j.get('uname') != "账号已注销":
                        mids.append(j['mid'])
                    else:
                        print("up主已注销账号：", j['mid'])

        print(len(mids))
        return mids

    except FileNotFoundError:
        print(f"错误: 文件 {file_path} 不存在")
        return []
    except json.JSONDecodeError:
        print("错误: 文件不是有效的JSON格式")
        return []

# mids = statistics_from_file('bilibili_follows_2025-05-25T08-56-22.json')

tnames_data = []

# 主函数
def main(mids):
    for mid in mids:

        up_tnames = {}
        # 使用示例
        try:
            data = getFetch(mid)
            classify_class = statisticsUP(data)

            up_tnames['mid'] = mid
            up_tnames['tnames'] = classify_class

        except Exception as e:
            print(f"Error: {e}")
        print(up_tnames)
        tnames_data.append(up_tnames)

# main(mids)
# 将数据写入JSON文件
with open("process.json", 'w', encoding='utf-8') as f:
    # 使用json.dump()将数据转换为JSON格式并写入文件
    # ensure_ascii=False 确保中文等非ASCII字符能正确显示
    # indent=2 使输出格式更美观，缩进为2个空格
    json.dump(tnames_data, f, ensure_ascii=False, indent=2)


# 统计全部分区出现次数
category_stats = defaultdict(int)
for up in tnames_data:
    if up!={}:
        for category, count in up['tnames'].items():
            category_stats[category] += count


# 查看未被归纳major_partitions的标签，由用户自此归纳

# 按视频数量排序
sorted_stats = OrderedDict(sorted(category_stats.items(), key=lambda x: -x[1]))
# 获取 major_partitions 中所有的子分区
all_sub_partitions = []
for sub_partitions in major_partitions.values():
    all_sub_partitions.extend(sub_partitions)

# 找出在 sorted_stats_keys 但不在 major_partitions 中的元素
missing_in_major = set(list(sorted_stats.keys())) - set(all_sub_partitions)
# 过滤掉空字符串（如果有）
missing_in_major = [x for x in missing_in_major if x]
print("在 sorted_stats.keys() 但不在 major_partitions 中的元素：",missing_in_major)


# 读取过程数据
with open("process.json", 'r', encoding='utf-8') as f:
    existing_data = json.load(f)

### 分类逻辑
for up in existing_data:
    if up != {}:
        # 最标签数量最多的标签
        max_category = max(up['tnames'].items(), key=lambda x: x[1])[0]

        # 分配到一级分区
        categorized = False
        for major, subs in list(major_partitions.items()):
            # print(major, subs)
            if max_category in list(subs):
                partitions_up[major].append(up['mid'])
                categorized = True
                break

        if not categorized:
            partitions_up["未分组"].append(up['mid'])


# 将数据写入JSON文件
with open("UP_classify.json", 'w', encoding='utf-8') as f:
    # 使用json.dump()将数据转换为JSON格式并写入文件
    # ensure_ascii=False 确保中文等非ASCII字符能正确显示
    # indent=2 使输出格式更美观，缩进为2个空格
    json.dump(partitions_up, f, ensure_ascii=False, indent=2)

