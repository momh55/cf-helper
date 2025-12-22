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

## 🤖 AI 智能体推荐

如果你在学习算法竞赛时需要 AI 辅助，不想一个个尝试，这里为你整理了几个免费可靠的选择：

### 推荐列表

| AI 助手 | 免费额度 | 适用场景 | 优势 | 限制 |
| :--- | :--- | :--- | :--- | :--- |
| **GitHub Copilot** (学生免费) | 学生/教师免费 | 代码补全、算法实现 | 代码质量高，IDE 集成好 | 需要学生认证 |
| **ChatGPT 3.5** | 每日免费使用 | 算法讲解、思路引导 | 解释清晰，交互性强 | 响应速度较慢 |
| **Claude** (Anthropic) | 免费版本 | 深度算法分析 | 逻辑严谨，适合学习 | 使用次数有限 |
| **Gemini** (Google) | 完全免费 | 多轮对话辅导 | 免费无限制使用 | 代码能力略弱 |
| **Cursor** (编辑器) | 免费版可用 | 实时编码辅助 | IDE 深度集成 | 高级功能需付费 |
| **Codeium** | 完全免费 | 代码自动补全 | 永久免费，速度快 | 功能相对简单 |

### 💡 使用建议

1. **初学阶段**：使用 Gemini 或 ChatGPT 3.5 理解算法概念
   - 提问示例："请详细解释 Dijkstra 算法的原理和实现步骤"
   - 让 AI 生成测试用例帮助理解边界情况

2. **刷题练习**：配合 GitHub Copilot (学生) 或 Codeium
   - 先自己思考解题思路
   - 使用 AI 辅助代码实现和调试
   - 对比 AI 建议与自己的思路

3. **竞赛准备**：使用 Claude 进行深度分析
   - 分析复杂题目的多种解法
   - 学习时间复杂度优化技巧
   - 总结算法模板和套路

4. **代码优化**：结合多个 AI 工具
   - Cursor/Copilot 用于快速编码
   - ChatGPT/Claude 用于算法优化建议
   - Gemini 用于学习算法背后的数学原理

### ⚠️ 注意事项

- **不要完全依赖 AI**：AI 是辅助工具，核心还是要自己理解算法。比如 AI 可能对某些数据结构建议低效算法，需要自己判断
- **验证 AI 答案**：AI 可能给出错误答案，务必用边界情况和极端数据测试验证。例如空数组、最大值、负数等
- **学生认证优先**：如果你是学生，优先申请 GitHub Education Pack，可获得大量免费资源
- **组合使用**：不同 AI 各有优势，可以组合使用以获得最佳效果

### 🎓 获取学生优惠

如果你是在校学生，强烈推荐申请 [GitHub Education Pack](https://education.github.com/pack)，可免费获得：
- GitHub Copilot 完整版
- 各种云服务器资源
- 数十个付费开发工具的免费使用权

## 🤝 贡献

欢迎提交 Issue 或 Pull Request 来改进这个项目！

## 📄 License

MIT