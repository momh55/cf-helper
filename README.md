# Codeforces Helper 🚀

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/react-%2320232a.svg?style=flat&logo=react&logoColor=%2361DAFB)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=flat&logo=typescript&logoColor=white)
![Plasmo](https://img.shields.io/badge/built%20with-Plasmo-purple)

**Codeforces Helper** 是一款旨在提升 Codeforces 刷题体验的现代化 Chrome 浏览器插件。它引入了类似 VS Code 的侧边栏文件树界面，提供了毫秒级的全网题目搜索、本地数据管理、状态同步以及防剧透等高级功能。

## ✨ 核心特性

### 🧠 智能刷题
- **全网极速搜索**：本地缓存 CF 所有题目（9000+），支持按 ID、名称、标签瞬间检索。
- **高级筛选**：支持按 Rating 范围（如 1500-1900）和标签进行组合筛选。
- **智能排序**：搜索结果自动按相关性、前缀匹配度排序。
- **随机一题 (🎲)**：根据当前的筛选条件，随机跳转一道未做过的题目，模拟比赛环境。

### 📊 数据管理 (New!)
- **本地知识库**：内置 IndexedDB 数据库，支持同步并存储数万条提交记录，无需重复联网，离线可用。
- **高级导出**：支持将你的所有提交历史导出为 **Excel (CSV)** 或 **JSON** 格式。
  - **完美细节**：包含精确的提交时间、内存消耗 (KB)、详细判题结果 (如 `Wrong answer on test 2`)。
  - **智能格式**：自动处理编码，Excel 打开不乱码。

### 📂 题单管理
- **VS Code 风格侧边栏**：支持拖动调整宽度和高度，交互流畅。
- **自定义题单**：创建属于你的训练计划，支持右键菜单快速添加题目。
- **配置备份**：支持一键导出/导入插件配置和自定义题单。

### 🛡️ 体验优化
- **防剧透模式 (Spoiler Blur)**：默认模糊题目标签，鼠标悬停时才显示，防止被提示算法类型。
- **一键辅助**：一键复制样例输入、一键滚动到提交区域。
- **深色模式适配**：基于 CSS 变量的智能主题，支持自定义背景色。

## ⌨️ 快捷键

| 快捷键 | 功能 |
| :--- | :--- |
| `Alt + C` | 快速显示/隐藏侧边栏 |
| `Alt + S` | 打开侧边栏并聚焦搜索框 |

## 📦 安装指南

### 方法一：直接下载使用（推荐普通用户）
如果你不想写代码，只想使用插件，请按以下步骤操作：

1. 进入本仓库的 [Releases 页面](https://github.com/momh55/cf-helper/releases)。
2. 下载最新的 `chrome-mv3-prod.zip` 压缩包并解压。
3. 打开 Chrome 浏览器，访问 `chrome://extensions/`。
4. 开启右上角的 **"开发者模式"**。
5. 点击 **"加载已解压的扩展程序"**，选择解压后的文件夹即可。

---

### 方法二：源码编译安装（推荐开发者）
如果你想自己修改代码或贡献功能，请按以下步骤配置环境：

1. **克隆仓库**
   ```bash
   git clone [https://github.com/momh55/cf-helper.git](https://github.com/momh55/cf-helper.git)
   cd cf-helper
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **启动开发服务**
   ```bash
   npm run dev
   ```

4. **加载插件**
   - 打开 Chrome 浏览器，访问 `chrome://extensions/`。
   - 开启右上角的 **"开发者模式" (Developer mode)**。
   - 点击 **"加载已解压的扩展程序" (Load unpacked)**。
   - 选择项目目录下的 `build/chrome-mv3-dev` 文件夹。

## 🤝 贡献

欢迎提交 Issue 或 Pull Request 来改进这个项目！

## 📄 License

MIT