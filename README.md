<p align="center">
  <img src="assets/subai.png" width="280" alt="Subai">
</p>

<h1 align="center">Subai Theme</h1>

<p align="center">
  <em>Less is more.</em> — 一个简洁现代的 Hugo 博客主题
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Version-2.0.0-green.svg" alt="Version: 2.0.0">
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

```bash
cd themes/Subai
hugo server -D --source exampleSite --themesDir ../..
```

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

### 使用方式

- 点击顶栏右侧的搜索入口，或按 `Ctrl / ⌘ + K` 唤起命令面板
- 输入关键词即时看到结果：`↑` `↓` 选择、`↵` 打开、`Esc` 关闭
- 面板与 `/search/` 页面共用同一套匹配规则（标题 > 标签 > 分类 > 摘要 > 正文），命中关键词会高亮
- 面板默认展示「最近搜索」（浏览器 localStorage）与「热门标签」，可一键清除
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

### 导航菜单

导航只保留互不重复的入口。分类与标签合并到 `/browse/` 浏览页（主题自带模板，
无需额外配置），低频页面（如「关于主题」）建议放在页脚，避免占掉顶部主轴。

```toml
[[menu.main]]
  name = "首页"
  url = "/"
  weight = 1

[[menu.main]]
  name = "文章"
  url = "/posts/"
  weight = 2

[[menu.main]]
  name = "浏览"
  url = "/browse/"
  weight = 3
```

### Header 行为

| 状态 | 触发 | 表现 |
| --- | --- | --- |
| 顶部 | 页面未滚动 | 满宽、无描边，导航严格居中 |
| 悬浮岛屿 | `scrollY > 24` | 宽度收窄到容器宽、脱开顶边、圆角浮起 |
| 阅读态 | 文章页下滑超过正文标题 | 标题占用左侧「品牌」那一格，导航与搜索原地保留 |
| 恢复导航 | 向上累计滚动 ≥ 56px | 品牌淡回、标题淡出（带迟滞，避免抖动） |

阅读态以 `#post-title` 为标题源，只在带该标题的页面生效；列表 / 分类 /
标签 / 搜索页不会触发。点击标题回到文章顶部。

搜索入口在 ≥1280px 显示「图标 + 文案 + 快捷键」，更窄时收为纯图标，
悬停或键盘聚焦时再展开文案。

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
  copyText = "复制"
  copiedText = "已复制"
  copyErrorText = "失败"
```

## 🔧 高级配置

### 完整配置示例

```toml
# 基本站点信息
baseURL = "https://example.com"
locale = "zh-cn"
title = "我的博客"
# themesDir = ""
theme = "Subai"


# 站点参数配置
[params]
  # 基本信息
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

[params.homeTiles.weather]
  enabled = true
  # 不填经纬度时按访客 IP 粗略定位；填了就固定城市（city 用作显示名）
  # latitude = 30.27
  # longitude = 120.15
  # city = "杭州"
  fallbackCity = "上海"          # 定位失败时的兜底城市
  fallbackLatitude = 31.23
  fallbackLongitude = 121.47
  refreshMinutes = 30           # 天气数据缓存时长
  unit = "celsius"              # celsius | fahrenheit
  allowCityChange = true        # 允许访客点击城市名切换（右键恢复自动定位）

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
  url = "/posts/"
  weight = 2

[[menu.main]]
  name = "浏览"
  url = "/browse/"
  weight = 3

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
    endLevel = 5

# 输出格式配置
[outputs]
  home = ["HTML", "RSS", "JSON"]
  page = ["HTML"]
  section = ["HTML", "RSS"]
  taxonomy = ["HTML", "RSS"]
```

## 🔄 更新主题

在站点根目录执行（主题以 Git 子模块方式安装）：

```bash
git submodule update --remote themes/Subai
```

当前版本 **2.0.0**。本次为不兼容重构（划词笔记插件与 PWA 已移除、菜单与首页配置调整），
升级前请先阅读 [CHANGELOG.md](CHANGELOG.md) 的「升级指南」，按其中的配置与内容改动逐项迁移。

## 🧩 首页磁贴布局

首页是一块 Bento 风格网格：桌面端 12 列，≤1120px 降为 8 列，≤768px 单列堆叠。
磁贴共用一套圆角、间距、阴影与表面色（`assets/css/home.css` 顶部的 `--tile-*` 令牌），
层级差异由内容密度与字号承担，只有引语磁贴保留一层淡主色底。

| 磁贴 | 跨度（桌面） | 说明 |
| --- | --- | --- |
| 最新文章 | 8×3 | 头条 + 最新列表，`homeTiles.latestCount` 控制总条数（头条占 1 条） |
| 天气 | 4×3 | 与最新文章同高，右侧成列 |
| 个人简介 | 4×1 | 头像与签名（关掉天气磁贴时改为显示本地时间） |
| 音乐播放器 | 4×1 | `homeTiles.music.playlist` |
| 每日引语 | 4×1 | `homeTiles.dailyQuote.items` |

关闭天气磁贴时，右侧会自然变成简介 / 音乐 / 引语竖排，不会留下空洞。

天气磁贴是一块点阵天空：太阳和月亮按当地时间沿弧线移动，云随风漂移，雨雪按帧下落，
夜里显示当月月相与星空，地平线用点阵山丘收边。数据取自
[Open-Meteo](https://open-meteo.com/)（免密钥），定位优先使用访客手动选择的城市，
其次站点固定坐标，再按 IP 粗略定位，全部失败时退回 `fallbackCity`。

- 想固定城市：填 `latitude` / `longitude`，并把 `city` 写成显示名；
- 不想让访客改城市：`allowCityChange = false`；
- 访客手动选过城市后，右键城市名即可恢复「按 IP 自动定位」；
- 天气请求会带上访客的 IP（用于粗定位）与坐标（用于取预报），不涉及本站任何账号数据。

## 🙏 资源鸣谢

- 首页音乐播放器图标来自 **Iconfont**
- 图标作者：**一只老羊来了**
- 使用位置：`static/icons/music/`
- 首页天气磁贴的点阵天空设计参考了开源项目 [映间 MARGIN](https://github.com/jiuyang5354/bilibili-margin)（MIT），实现按本站语境重写

## 📄 许可证

本项目采用 [MIT License](https://opensource.org/licenses/MIT) 许可证。

## 📞 支持

如果您在使用过程中遇到问题，请：

1. 查看本文档的配置说明
2. 搜索已有的 [Issues](https://github.com/Aieguu/Subai/issues)
3. 创建新的 Issue 描述您的问题

---

**注意：本主题仅供学习使用，非专业 Hugo 主题。**

