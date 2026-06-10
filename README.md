# Ji Theme

自己用用的 Hugo 主题。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Hugo](https://img.shields.io/badge/Hugo-0.149.1+-blue.svg)](https://gohugo.io/)

## 🚀 快速开始

### 1. 安装主题

使用 Git 子模块安装：

```bash
git submodule add https://github.com/Aieguu/Ji.git themes/Ji
```

### 2. 基本配置

在您的 `hugo.toml` 中添加：

```toml
baseURL = "https://example.com"
languageCode = "zh-cn"
title = "我的博客"
theme = "Ji"

# 中文支持配置
hasCJKLanguage = true

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

如果您在主题仓库的 `exampleSite/` 中本地调试，请确保 `themesDir` 指向主题目录的上级目录；文档与示例配置中的主题名统一使用 `Ji`。

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
  writeTokenStorageKey = "ji.highlightNote.writeToken"
  maxSelectionLength = 2000
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
theme = "Ji"

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
cd themes/Ji
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
2. 搜索已有的 [Issues](https://github.com/jizuiba/Ji/issues)
3. 创建新的 Issue 描述您的问题

---

**注意：本主题仅供学习使用，非专业 Hugo 主题。**

