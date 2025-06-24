import tkinter as tk
from tkinter import ttk, filedialog, messagebox, scrolledtext
import json
from collections import defaultdict, OrderedDict
import matplotlib.pyplot as plt
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
from pathlib import Path
import time
import requests
import threading

try:
    import pyi_splash
    pyi_splash.close()
except ImportError:
    pass
class BiliBiliUPClassifier:
    def __init__(self, root):
        self.root = root
        self.root.title("B站UP主分类工具")
        self.root.geometry("1100x750")

        # 初始化数据
        self.major_partitions = {}  # 分类模板数据
        self.partitions_up = {} # 最终导出数据格式
        self.tnames_data = []  # 过程文件数据
        self.missing_in_major = [] # 没匹配标签数据
        self.mids = [] #需要处理up的mid, 除去账号已注销的
        # 创建UI
        self.create_widgets()

    def create_widgets(self):
        # 顶部控制面板
        control_frame = ttk.Frame(self.root, padding="10")
        control_frame.pack(fill=tk.X)
        ttk.Button(control_frame, text="导入分类模板", command=self.load_classify_template).grid(row=0, column=0,
                                                                                                 padx=5)
        ttk.Button(control_frame, text="导入关注列表", command=self.load_follow).grid(row=0, column=1,
                                                                                                 padx=5)
        ttk.Button(control_frame, text="发送请求生成过程数据", command=self.getfetch_process_data).grid(row=0, column=2,
                                                                                                 padx=5)
        ttk.Button(control_frame, text="导入过程数据", command=self.load_process_data).grid(row=0, column=3, padx=5)
        ttk.Button(control_frame, text="开始分类", command=self.start_classification).grid(row=0, column=4, padx=5)
        ttk.Button(control_frame, text="导出结果", command=self.export_results).grid(row=0, column=5, padx=5)

        # 在导出结果按钮后面添加时间设置控件
        ttk.Label(control_frame, text="请求间隔(秒):").grid(row=0, column=6, padx=5)
        self.delay_var = tk.IntVar(value=0.4)  # 默认1秒
        ttk.Spinbox(control_frame, from_=1, to=10, width=3, textvariable=self.delay_var).grid(row=0, column=7, padx=5
                                                                                              )
        # 主内容区域
        main_frame = ttk.Frame(self.root)
        main_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

        # 左侧分区面板
        left_frame = ttk.Frame(main_frame)
        left_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        # 分区统计
        ttk.Label(left_frame, text="分区统计", font=('Arial', 12)).pack(pady=5)
        self.partition_tree = ttk.Treeview(left_frame, columns=("count"), show="tree headings", height=15)
        self.partition_tree.heading("#0", text="分区")
        self.partition_tree.heading("count", text="UP主数量")
        self.partition_tree.column("count", width=100, anchor="center")
        self.partition_tree.pack(fill=tk.BOTH, expand=True)

        # 未匹配分区标签
        ttk.Label(left_frame, text="未匹配的分区标签", font=('Arial', 12)).pack(pady=5)
        self.missing_label = ttk.Label(left_frame, text="0个未匹配标签", foreground="red")
        self.missing_label.pack()

        self.missing_text = scrolledtext.ScrolledText(left_frame, height=8, wrap=tk.WORD)
        self.missing_text.pack(fill=tk.BOTH, expand=True)

        # 右侧UP主列表
        right_frame = ttk.Frame(main_frame, width=300)
        right_frame.pack(side=tk.RIGHT, fill=tk.BOTH)

        self.up_list_label = ttk.Label(right_frame, text="UP主列表", font=('Arial', 12))
        self.up_list_label.pack(pady=5)

        self.up_listbox = tk.Listbox(right_frame)
        self.up_listbox.pack(fill=tk.BOTH, expand=True)

        # 底部状态栏
        self.status_var = tk.StringVar()
        self.status_bar = ttk.Label(self.root, textvariable=self.status_var, relief=tk.SUNKEN)
        self.status_bar.pack(fill=tk.X)

        # 绑定事件
        self.partition_tree.bind("<<TreeviewSelect>>", self.show_up_list)

    def load_classify_template(self):
        file_path = filedialog.askopenfilename(
            title="选择分类模板文件",
            filetypes=[("JSON文件", "*.json")],
            initialdir=".",
            initialfile="classify_template.json"
        )

        if file_path:
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    self.major_partitions = json.load(f)

                self.partitions_up = {category: [] for category in self.major_partitions}
                self.partitions_up["等待分组"] = []


                # 更新分区树
                self.partition_tree.delete(*self.partition_tree.get_children())
                for partition in self.major_partitions:
                    self.partition_tree.insert("", "end", text=partition, values=(0))
                self.partition_tree.insert("", "end", text="等待分组", values=(0))

                self.status_var.set(f"分类模板加载成功: {Path(file_path).name}")
            except Exception as e:
                messagebox.showerror("错误", f"加载分类模板失败: {str(e)}")

    def load_follow(self):
        file_path = filedialog.askopenfilename(
            title="选择关注列表文件",
            filetypes=[("JSON文件", "*.json")],
            initialdir=".",
            initialfile="classify_template.json"
        )

        if file_path:
            try:
                # 1. 读取JSON文件
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)

                for i in data:
                    if (i['data']):
                        for j in i['data']:
                            if j.get('mid') and j.get('uname') != "账号已注销":
                                self.mids.append(j['mid'])
                            else:
                                print("up主已注销账号：", j['mid'])

                print(len(self.mids))
                self.status_var.set(f"关注列表加载成功: {Path(file_path).name}")
            except Exception as e:
                messagebox.showerror("错误", f"加载关注列表失败: {str(e)}")

    def getfetch_process_data(self):
        if not hasattr(self, 'mids') or not self.mids:
            messagebox.showwarning("警告", "请先导入关注数据")
            return

        if not hasattr(self, 'major_partitions') or not self.major_partitions:
            messagebox.showwarning("警告", "请先导入分类模板")
            return

        # 添加确认对话框
        confirm = messagebox.askokcancel("确认", "该操作可能需要较长时间，确定要继续吗？")
        if not confirm:
            return

        # 创建进度窗口
        self.progress_window = tk.Toplevel(self.root)
        self.progress_window.title("数据获取进度")
        self.progress_window.geometry("400x200")

        # 进度条
        self.progress_var = tk.DoubleVar()
        progress_bar = ttk.Progressbar(self.progress_window, variable=self.progress_var, maximum=len(self.mids))
        progress_bar.pack(pady=10, padx=20, fill=tk.X)

        # 状态标签
        self.status_var = tk.StringVar()
        status_label = ttk.Label(self.progress_window, textvariable=self.status_var)
        status_label.pack(pady=5)

        # 已处理UP主显示
        processed_label = ttk.Label(self.progress_window, text="已处理UP主:")
        processed_label.pack()

        self.processed_list = scrolledtext.ScrolledText(self.progress_window, height=5, wrap=tk.WORD)
        self.processed_list.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)


        # 在单独的线程中执行耗时操作
        threading.Thread(target=self.fetch_data_thread, daemon=True).start()

    def fetch_data_thread(self):
        """在单独线程中执行的数据获取逻辑"""
        self.tnames_data = []  # 清空旧数据
        no_video_ups = []  # 记录没有视频的UP主

        try:
            for i, mid in enumerate(self.mids):
                # 更新进度
                mid = str(mid)
                self.progress_var.set(i + 1)
                self.status_var.set(f"正在处理 {i + 1}/{len(self.mids)} (MID: {mid})")
                self.processed_list.insert(tk.END, f"{mid}\n")
                self.processed_list.see(tk.END)
                self.progress_window.update()

                url = f"https://app.biliapi.com/x/v2/space/archive/cursor?vmid={mid}"
                headers = {
                    "Referer": "https://space.bilibili.com",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
                }

                up_tnames = {}
                try:
                    time.sleep(self.delay_var.get())  # 使用用户设置的延迟时间
                    response = requests.get(url, headers=headers)
                    response.raise_for_status()

                    data = response.json()

                    if not data.get('data') or not data['data'].get('item'):
                        raise requests.exceptions.RequestException("没有视频数据")

                    tnames = defaultdict(int)
                    for video in data['data']['item']:
                        tname = str(video['tname'])  # 确保 tname 是字符串
                        tnames[tname] += 1

                    up_tnames['mid'] = mid
                    up_tnames['tnames'] = dict(tnames)
                    self.tnames_data.append(up_tnames)

                except requests.exceptions.RequestException as e:
                    print(f"Error: {e}")
                    no_video_ups.append(mid)

            # 保存结果
            with open("process.json", 'w', encoding='utf-8') as f:
                json.dump(self.tnames_data, f, ensure_ascii=False, indent=2)

            # 显示统计信息
            success_count = len(self.tnames_data) - len(no_video_ups)
            status_text = (
                f"请求完成！\n"
                f"成功处理: {success_count}个\n"
                f"无视频UP主: {len(no_video_ups)}个\n"
                f"已保存到 process.json"
            )

            if no_video_ups:
                status_text += "\n\n无视频UP主列表:\n" + "\n".join(no_video_ups)

            self.status_var.set(status_text)
            messagebox.showinfo("完成", status_text)

        except Exception as e:
            messagebox.showerror("错误", f"处理过程中出错: {str(e)}")
        finally:
            self.progress_window.destroy()

    def load_process_data(self):
        file_path = filedialog.askopenfilename(
            title="选择过程数据文件",
            filetypes=[("JSON文件", "*.json")],
            initialdir=".",
            initialfile="process.json"
        )

        if file_path:
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    self.tnames_data = json.load(f)

                self.status_var.set(f"过程数据加载成功: {Path(file_path).name}")
            except Exception as e:
                messagebox.showerror("错误", f"加载过程数据失败: {str(e)}")

    def start_classification(self):
        if not self.major_partitions:
            messagebox.showwarning("警告", "请先导入分类模板")
            return

        if not self.tnames_data:
            messagebox.showwarning("警告", "请先导入过程数据")
            return

        # 清空现有分类
        for partition in self.partitions_up:
            self.partitions_up[partition] = []

        # 统计全部分区出现次数
        print(self.tnames_data)
        category_stats = defaultdict(int)
        for up in self.tnames_data:
            if up != {}:
                for category, count in up['tnames'].items():
                    category_stats[category] += count

        # 计算未匹配的分区标签
        all_sub_partitions = []
        for sub_partitions in self.major_partitions.values():
            all_sub_partitions.extend(sub_partitions)

        sorted_stats = OrderedDict(sorted(category_stats.items(), key=lambda x: -x[1]))
        self.missing_in_major = list(set(sorted_stats.keys()) - set(all_sub_partitions))
        self.missing_in_major = [x for x in self.missing_in_major if x]

        # 更新未匹配标签显示
        self.missing_label.config(text=f"{len(self.missing_in_major)}个未匹配标签")
        self.missing_text.delete(1.0, tk.END)
        self.missing_text.insert(tk.END, "\n".join(self.missing_in_major))

        # 分类逻辑
        for up in self.tnames_data:
            if up != {}:
                max_category = max(up['tnames'].items(), key=lambda x: x[1])[0]
                categorized = False

                for major, subs in self.major_partitions.items():
                    if max_category in subs:
                        self.partitions_up[major].append(up['mid'])
                        categorized = True
                        break

                if not categorized:
                    self.partitions_up["等待分组"].append(up['mid'])

        # 更新分区树显示
        for partition in self.partitions_up:
            for item in self.partition_tree.get_children():
                if self.partition_tree.item(item)['text'] == partition:
                    self.partition_tree.item(item, values=(len(self.partitions_up[partition])))
                    break

        self.status_var.set(f"分类完成，共处理 {len(self.tnames_data)} 个UP主")

        # 显示分类统计图表
        self.show_chart()

    def show_up_list(self, event):
        selected_item = self.partition_tree.selection()
        if selected_item:
            partition = self.partition_tree.item(selected_item)['text']
            self.up_listbox.delete(0, tk.END)

            for mid in self.partitions_up.get(partition, []):
                self.up_listbox.insert(tk.END, mid)

            self.up_list_label.config(text=f"{partition} (共 {len(self.partitions_up.get(partition, []))} 个UP主)")

    def show_chart(self):
        if not self.partitions_up:
            return

        # 准备图表数据
        labels = []
        sizes = []

        for partition, up_list in self.partitions_up.items():
            if up_list and partition != "等待分组":
                labels.append(partition)
                sizes.append(len(up_list))

        # 创建图表
        # 在创建图表前添加以下代码
        plt.rcParams['font.sans-serif'] = ['SimHei']  # 设置黑体或其他支持中文的字体
        plt.rcParams['axes.unicode_minus'] = False  # 解决负号显示问题
        fig, ax = plt.subplots(figsize=(8, 6))
        ax.pie(sizes, labels=labels, autopct='%1.1f%%', startangle=90)
        ax.axis('equal')
        ax.set_title('UP主分区分布')

        # 在Tkinter中显示图表
        chart_window = tk.Toplevel(self.root)
        chart_window.title("分类结果图表")

        canvas = FigureCanvasTkAgg(fig, master=chart_window)
        canvas.draw()
        canvas.get_tk_widget().pack(fill=tk.BOTH, expand=True)

        # 添加关闭按钮
        ttk.Button(chart_window, text="关闭", command=chart_window.destroy).pack(pady=10)

    def export_results(self):
        if not self.partitions_up:
            messagebox.showwarning("警告", "没有可导出的数据")
            return

        file_path = filedialog.asksaveasfilename(
            title="保存分类结果",
            defaultextension=".json",
            filetypes=[("JSON文件", "*.json")],
            initialfile="UP_classify.json"
        )

        if file_path:
            try:
                with open(file_path, 'w', encoding='utf-8') as f:
                    json.dump(self.partitions_up, f, ensure_ascii=False, indent=2)
                self.status_var.set(f"结果已保存到 {Path(file_path).name}")
            except Exception as e:
                messagebox.showerror("错误", f"导出失败: {str(e)}")


if __name__ == "__main__":
    root = tk.Tk()
    app = BiliBiliUPClassifier(root)
    root.mainloop()