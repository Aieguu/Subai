<p align="center">
  <img src="assets/subai.png" width="280" alt="Subai">
</p>

<h1 align="center">Subai Theme</h1>

<p align="center">
  <em>Less is more.</em> — 一个简洁现代的 Hugo 博客主题
</p>

<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT">
  <img src="https://img.shields.io/badge/Hugo-0.149.1+-blue.svg" alt="Hugo">
</p>

---

## 🚀 快速开始

### 1. 安装主题

使用 Git 子模块安装：

```bash
git submodule add https://github.com/Aieguu/Subai.git themes/Subai
```

### 2. 基本配置

在您的 `hugo.toml` 中添加：

```toml
baseURL = "https://example.com"
locale = "zh-cn"
title = "我的博客"
theme = "Subai"

[params]
  author = "您的名字"
  description = "我的个人博客"
  darkMode = true
  search = true

[params.codeBlock]
  enabled = true
  showLineNumbers = false
  copyButton = true
  languageLabel = true
  maxHeight = "32rem"

# 输出格式配置（搜索功能必需）
[outputs]
  home = ["HTML", "RSS", "JSON"]
  page = ["HTML"]
  section = ["HTML", "RSS"]
  taxonomy = ["HTML", "RSS"]
```

### 3. 启动开发服务器

```bash
hugo server -D
```

访问 `http://localhost:1313` 查看您的站点。

如果您在主题仓库的 `exampleSite/` 中本地调试，请确保 `themesDir` 指向主题目录的上级目录；文档与示例配置中的主题名统一使用 `Subai`。

## 🔍 搜索功能配置

### 启用搜索功能

1. **配置文件设置**：
```toml
[params]
  search = true

[outputs]
  home = ["HTML", "RSS", "JSON"]
```

2. **创建搜索页面**：
```bash
# 快速创建
mkdir -p content/search
cat > content/search/_index.md << 'EOF'
---
title: "搜索"
layout: "search"
type: "search"
---
EOF
```

或手动创建 `content/search/_index.md`：
```markdown
---
title: "搜索"
layout: "search"
type: "search"
---
```

3. **重新构建站点**：
```bash
hugo --cleanDestinationDir
```

## 划线笔记插件

仓库地址：[https://github.com/Aieguu/highlight-note-api](https://github.com/Aieguu/highlight-note-api)

Ji 的划线笔记由主题前端和独立 API 服务组成。主题只负责选中文本、渲染标记和读取静态笔记；创建、编辑、删除和同步由 `highlight-note-api` 处理。

### 主题配置

```toml
[params.plugins.highlightNote]
  enabled = true
  apiBase = "https://your-project.vercel.app"
```

## 📝 内容管理

### 创建文章

```bash
# 创建新文章
hugo new posts/我的第一篇文章.md

# 创建关于页面
hugo new about.md

# 创建分类页面
hugo new categories/技术.md
```

### 文章前置参数

```markdown
---
title: "文章标题"
subtitle: "副标题"
author: "作者"
date: 2025-01-01
draft: false
tags: ["标签1", "标签2"]
categories: ["分类1"]
cover_image: "/images/cover.jpg"
summary: "文章摘要"
---
```

## 🎨 自定义配置

### 设计语言与设计令牌

Subai 采用「纸 · 墨 · 朱砂」的编辑排版语言：暖纸底色、墨色文字、单一朱红强调色，标题使用衬线字体（思源宋体，已自托管子集分片），正文使用系统黑体。全站组件以 1px 发丝线分隔，不使用渐变卡片与大投影。

默认色板与字体可通过站点配置覆盖（无需修改主题源码）：

```toml
[params.colors]
  primary            = "#A63D2A"   # 强调色（朱砂赭红）
  primaryHover       = "#8C3221"
  bg                 = "#FAF9F6"   # 浅色：暖纸
  bgSecondary        = "#F2F0EB"
  text               = "#1C1B19"   # 墨色
  textSecondary      = "#57534D"
  textMuted          = "#A39E97"
  border             = "#E6E3DD"
  borderHover        = "#CFCAC2"
  bgDark             = "#161412"   # 深色：暖墨
  bgSecondaryDark    = "#1F1C19"
  textDark           = "#E9E6E1"
  textSecondaryDark  = "#B8B2AA"
  textMutedDark      = "#7A746C"
  borderDark         = "#2E2A26"
  borderHoverDark    = "#453F39"
  primaryOnDark      = "#D0684F"   # 深色模式下强调色（提亮）
  primaryHoverOnDark = "#DE8070"

[params.fonts]
  base    = "system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif"
  heading = "'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', serif"
  mono    = "'JetBrains Mono', 'SF Mono', Consolas, monospace"
```

其他设计约定：

- 正文字号 17px、行高 1.85（中文长文优化），正文栏宽默认 50rem（可用 `params.contentMaxWidth` 覆盖）
- 标题字阶按 1.333 模数比例，全部使用衬线 600 字重
- 动效统一 `cubic-bezier(0.16, 1, 0.3, 1)`（expo.out），主题切换使用 View Transitions 圆形展开（不支持时自动回退淡入）
- 自托管字体位于 `static/fonts/`（Noto Serif SC 600 全部 unicode-range 分片 + JetBrains Mono 400/500），浏览器按需加载分片

### 动效体系

全站动效统一 `cubic-bezier(0.16, 1, 0.3, 1)`（expo.out），遵循"同一屏只有一个东西在动"：

- **PJAX 进度**：页顶 1.5px 朱砂发丝线，缓行至 82%，就绪后瞬间走完淡出（笔尖划纸）
- **换页晕染**：旧页模糊淡出（墨散于水），新页从模糊收敛清晰（墨落定形）
- **图标笔顺**：主题切换时日月图标以 stroke-dashoffset 逐笔"画出"（太阳光芒 stagger）；搜索放大镜展开时先画镜片后画手柄；汉堡菜单三线真形变为 ×
- **卡片**：hover 时标题朱砂下划线扫入（`background-size` 动画），按压 `scale(0.99)` spring 回弹
- **阅读进度**：文章页 TOC 左侧发丝轨道随滚动被朱砂填充
- **图片显影**：正文/卡片图片加载前模糊半透明，`onload` 后收敛清晰（相纸显影）
- **标题锚点**：h2–h4 hover 时左侧浮现朱砂 §，点击平滑定位并更新地址栏
- **Lightbox**：原位飞入/飞出 + 竖向拖拽关闭（背板随位移淡出，过阈值松手关闭，否则弹回）

以上全部尊重 `prefers-reduced-motion`（降级为无动画或直接呈现终态）。

### 纸墨细节

主题内置一系列"只有纸墨博客才有"的元素：

- **印章落款**：文章末尾自动生成竖排干支纪年落款（如「丙午年秋」）+ 朱砂印章；首页个人磁贴右侧也有印章，每会话首次进入视口时播放一次"落印"动画。印文默认从作者名推导——中文取前两字竖排，拉丁首字母 "A" 启用内置篆刻字形（直刀笔画 + 糙边 SVG），其余字母按衬线文字渲染；可覆盖：

  ```toml
  [params.seal]
    text = "自在"   # 1–2 个汉字（竖排）或 1 个拉丁字母
  ```

- **洇墨打字机**：首页每日一句逐字从模糊洇开到定形，朱砂块状光标；`prefers-reduced-motion` 下退化为纯文本逐字
- **时辰与节气**：首页时钟磁贴下方显示十二时辰（如「未时」）；页脚版权行尾显示当前节气与物候（如「白露 · 鸿雁来」），纯本地计算，零网络请求
- **山水频谱**：音乐磁贴底部的水墨山峦随播放起伏——WebAudio 频谱映射成三层山脊（远山淡、近山浓），暂停时静止为剪影；分析器单例跨 PJAX 复用，`prefers-reduced-motion` 下只画静态剪影
- **朱批**：划线笔记全面融入纸墨体系——划线为朱笔圈点（悬停朱砂晕染），同步状态以朱砂为记，弹窗改纸面卡片与衬线标题，状态色由插件局部令牌 `--note-*` 管理
- **404 墨圈**：404 页面为一笔未合拢的墨圈（SVG 描边动画 + 糙边滤镜），配「此处无物」
- **牌记**：「关于主题」页文末自动附仿古籍刊记——双线方框竖排：「Subai 主题 / 岁在丙午重刊 / 某氏藏版」，干支纪年由模板计算

### 导航菜单

```toml
[[menu.main]]
  name = "首页"
  url = "/"
  weight = 1

[[menu.main]]
  name = "文章"
  url = "/posts"
  weight = 2

[[menu.main]]
  name = "分类"
  url = "/categories"
  weight = 3

[[menu.main]]
  name = "标签"
  url = "/tags"
  weight = 4
```

### 社交链接

```toml
[[menu.social]]
  name = "GitHub"
  url = "https://github.com/yourusername"

[[menu.social]]
  name = "Twitter"
  url = "https://twitter.com/yourusername"
```

### 分页配置

```toml
[pagination]
  pagerSize = 8
  path = "page"
```

### 语法高亮

```toml
[params.codeBlock]
  enabled = true
  showLineNumbers = false
  copyButton = true
  languageLabel = true
  maxHeight = "32rem"
  copyText = "Copy"
  copiedText = "Copied!"
  copyErrorText = "Error"
```

## 🔧 高级配置

### 完整配置示例

```toml
# 基本站点信息
baseURL = "https://example.com"
languageCode = "zh-cn"
title = "我的博客"
# themesDir = ""
theme = "Subai"

# 中文支持配置
hasCJKLanguage = true

# 站点参数配置
[params]
  # 基本信息
  title = "我的博客"
  description = "我的个人博客"
  author = "您的名字"
  dateFormat = "2006年1月2日"

  # 主题功能开关
  darkMode = true              # 启用深色模式
  search = true                # 启用搜索功能
  pagination = true            # 启用分页功能

[params.codeBlock]
  enabled = true               # 是否启用主题代码块系统
  showLineNumbers = false      # 是否显示行号
  copyButton = true            # 是否显示复制按钮
  languageLabel = true         # 是否显示语言标签
  maxHeight = "32rem"          # 代码块最大高度
  copyText = "复制"
  copiedText = "已复制"
  copyErrorText = "失败"

# 首页配置
[params.homeTiles]
  introTitle = "个人介绍"
  nickname = "nickname"
  bio = "签名"
  avatar = "/images/avatar.jpeg"
  timezone = "Asia/Shanghai"
  latestCount = 5

[params.homeTiles.music]
  playlist = [
  "/audio/music1.mp3",
  "/audio/music2.mp3"
  ]

[params.homeTiles.dailyQuote]
  switchTime = 5000 # 停留多久
  typeSpeed = 90 # 打字速度，越小越快
  deleteSpeed = 60 # 删除速度，越小越快
  items = [
    "把喜欢的事情做到极致，惊喜会在路上出现。",
    "慢一点也没关系，重要的是一直在向前。",
    "认真生活的人，总会和美好不期而遇。"
  ]

[params.homeTiles.image]
  src = "/images/home.jpg"
  alt = "首页展示图片"
  # link = "/posts"

# 分页配置
[pagination]
  pagerSize = 8                # 每页显示文章数量
  path = "page"                # 分页URL路径

# 导航菜单
[[menu.main]]
  name = "首页"
  url = "/"
  weight = 1

[[menu.main]]
  name = "文章"
  url = "/posts"
  weight = 2

[[menu.main]]
  name = "分类"
  url = "/categories"
  weight = 3

[[menu.main]]
  name = "标签"
  url = "/tags"
  weight = 4

  # 社交链接
[[menu.social]]
  name = "GitHub"
  url = "https://github.com/Aieguu"
  # 可自定义图标
  # pre = "<svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'><path d='M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22'></path></svg>"

# Markup 配置
[markup]
  [markup.goldmark]
    [markup.goldmark.renderer]
      # 安全提示：unsafe = true 允许在 Markdown 中嵌入原始 HTML（包括 <script> 等标签）。
      # 仅在内容完全可信的环境下使用，否则存在 XSS 注入风险。
      unsafe = true

  # 目录配置
  [markup.tableOfContents]
    startLevel = 2
    endLevel = 4

# 输出格式配置
[outputs]
  home = ["HTML", "RSS", "JSON"]
  page = ["HTML"]
  section = ["HTML", "RSS"]
  taxonomy = ["HTML", "RSS"]
```

## 🔄 更新主题

```bash
cd themes/Subai
git pull origin main
```

## 🙏 资源鸣谢

- 首页音乐播放器图标来自 **Iconfont**
- 图标作者：**一只老羊来了**
- 使用位置：`static/icons/music/`

## 📄 许可证

本项目采用 [MIT License](https://opensource.org/licenses/MIT) 许可证。

## 📞 支持

如果您在使用过程中遇到问题，请：

1. 查看本文档的常见问题部分
2. 搜索已有的 [Issues](https://github.com/Aieguu/Subai/issues)
3. 创建新的 Issue 描述您的问题

---

**注意：本主题仅供学习使用，非专业 Hugo 主题。**

