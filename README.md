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

### 设计语言 —— Prism · 棱镜

> 一束白光，折射成可读的层次。

四条理念，也是遇到争议时的裁决依据：

1. **暗底为家** —— 深色不是浅色的反色，是主设计面。深色先画好，再推浅色版。
2. **一束强光** —— 全站只有一个高饱和强调色（电光朱）。其余是带冷偏的石墨灰阶。
   强调色只允许出现在三种语义上：可点击 / 当前所在 / 需要注意。
3. **折射出层次** —— 层次靠表面明度阶梯 + 1px 描边 + 极柔双层阴影，不靠色块和渐变堆。
4. **动效要有来处与去处** —— 每次动画都要能回答「从哪来、到哪去」。答不上来就删。

#### 反 AI 审美清单（硬约束）

「年轻 + 现代」极易滑向 AI 生成风格的平均值。判断标准只有一条：
**这个处理有没有具体来源？** 说不出来源的装饰一律删。

明令禁止：紫蓝 / 彩虹渐变、玻璃拟态 `backdrop-filter`、aurora 光斑背景、霓虹发光、
渐变文字、万物 `999px` 圆角、emoji 当图标、粉彩低对比、到处弹簧回弹、
无来源的浮动装饰几何。

替代手法（都有来源）：瑞士网格 + hairline 分栏、**等宽字体做元信息**、
硬边偏移阴影、颗粒噪点、Risograph 油墨色谱。

两个允许的例外：**同色**渐变做下划线扫入（技术手段，不是配色）、
45° 斜纹（工程制图与印刷网点的实物参照）。

#### 设计令牌

分三层，组件只消费第二层：

| 层 | 文件 | 内容 |
| --- | --- | --- |
| 原始层 | `assets/css/primitives.css` | `--p-*`：色板、字阶、间距、圆角、时长、曲线。组件禁止直接引用 |
| 语义层 | `assets/css/tokens-prism.css` | `--color-*` / `--space-*` / `--radius-*` … 含明暗双通道 |
| 组件层 | 各组件文件内 | `--card-*` / `--code-*` / `--note-*` |

**语义层的变量名沿用 v1**（`--color-bg` / `--radius-md` / `--ease-out` …），只换值。
这是换肤时大多数组件不必改选择器的原因，也是新增令牌时应当遵守的约定：
**可以加，不要重命名。**

默认色板与字体可通过站点配置覆盖，无需改主题源码（由
`layouts/partials/head/token-overrides.html` 在主样式表之后输出）：

```toml
[params.colors]
  primary            = "#F5451F"   # 强调色（电光朱）
  primaryHover       = "#D8320F"
  bg                 = "#FFFFFF"   # 浅色：白纸
  bgSecondary        = "#F7F8FA"
  text               = "#0C0D11"   # 石墨
  textSecondary      = "#525866"
  textMuted          = "#9AA0AF"
  border             = "rgb(12 13 17 / 0.09)"
  borderHover        = "rgb(12 13 17 / 0.16)"
  bgDark             = "#0C0D11"   # 深色：主设计面
  bgSecondaryDark    = "#15171C"
  textDark           = "#EFF1F5"
  textSecondaryDark  = "#CBCFD9"
  textMutedDark      = "#9AA0AF"
  borderDark         = "rgb(255 255 255 / 0.10)"
  borderHoverDark    = "rgb(255 255 255 / 0.18)"
  primaryOnDark      = "#FF7253"   # 深色模式强调色（提亮）
  primaryHoverOnDark = "#FF9E88"

[params.fonts]
  base    = "'Geist', 'Noto Sans SC', system-ui, sans-serif"
  heading = "'Geist', 'Noto Sans SC', system-ui, sans-serif"
  mono    = "'JetBrains Mono', 'Cascadia Code', Consolas, monospace"
```

其他设计约定：

- 正文字号 17px、行高 1.8（中文长文优化）；正文栏宽默认 46rem（`params.contentMaxWidth` 可覆盖）
- 字阶双档：UI 15px 基准 / 阅读 17px 基准
- 标题字距 −0.01em（中文；Latin 可用 −0.02em）
- 圆角上限 16px，`full` 只给头像与圆形图标钮
- 触控目标 ≥ 44px；焦点环 2px + 2px offset，全站可键盘到达
- 颗粒底纹由 `--grain-image` 控制，设为 `none` 即关闭

#### 字体

- **Latin：Geist**（OFL 1.1），自托管 latin 子集 400 / 500 / 600
- **中文：Noto Sans SC** 的 `chinese-simplified` 子集，自托管 **400 + 700 两个字重**
- **等宽：JetBrains Mono** 400 / 500，自托管；用于日期、字数、标签、分类、语言标等元信息

三条踩过坑的约定，改字体前务必先读：

- **中文必须给两个字重。** 只给一个字重时，标题的 600 请求会落到 500，
  浏览器再用 `font-synthesis` 伪粗体化补出假加粗 —— 中文笔画密，一描就糊。
  `reset.css` 里设了 `font-synthesis-weight: none` 从源头禁掉（只禁 weight，不禁 style）。
- **字体栈顺序不能反。** Noto Sans SC 的 `chinese-simplified` 子集**没有
  `unicode-range`**，等于全字符覆盖；Geist 自带 latin 的 `unicode-range`，
  必须排在它前面才能接住拉丁字符，汉字才会落到 Noto Sans SC。
- **中文不能走系统栈。** Geist 与各 OS 自带中文的字形粗细、渲染方式都不一致，
  同屏混排会被读成「发虚」。中文读者对字体一致性比拉丁读者敏感得多。

字体总体积约 2.4MB，用 `node scripts/fetch-fonts.mjs` 重新抓取。
（该脚本不再依赖 fontsource 的 CSS 注释判断子集 —— 它们已经去掉了注释，
旧写法会静默产出空的 `fonts.css`。）

#### 品牌元素

- **朱印** —— 全站唯一的实心强调色块。双圈刻边 + 一道 2px 硬边偏移（无模糊的实心错位，
  像套印时印版没对齐留下的痕迹，印刷品才有）。印文默认从作者名推导，
  中文取前两字竖排，拉丁首字母 "A" 启用内置篆刻字形：

  ```toml
  [params.seal]
    text = "自在"   # 1–2 个汉字（竖排）或 1 个拉丁字母
  ```

- **折射光谱** —— 分类与标签用 `mod (hash.FNV32a <名称>) 5` 算一个稳定色位，
  落到 6px 折射色圆点上。同一个标签在任何页面都是同一个颜色。
  折射色只用于圆点、分类色条与代码语言标，不用于文字和底色。
- **断棱光环（404）** —— 几何光环留一个缺口，裂处漏出三道折射光。
  棱镜把光拆成光谱，而这一页「没有光」。
- **颗粒底纹** —— body 与顶栏铺 5.5% 灰度噪点，把纯色平面变成有纸纹的面。
- **牌记与落款** —— 干支纪年、十二时辰、节气等纸墨细节保留，材质换成 Prism 的。

### 动效体系

全站遵循「同一屏只有一个东西在动」：

- **曲线分工** —— 入场用缓出（`--ease-out`，有方向）；hover 与颜色变化用
  standard（快、无戏剧性）；浮层收放用 snap；**弹簧只用于 `:active` 按压**。
  处处回弹是 AI 的「愉悦感」套路，会让人觉得界面在撒娇。
- **时长档位** —— micro 100ms / fast 160ms / base 240ms / slow 400ms / deliberate 640ms；
  列表入场 stagger 40ms，封顶 8 项。
- **PJAX 换页** —— 旧页淡出上移 6px，新页从下方落定，160ms 走完。
  （v1 的「墨散于水」模糊晕染已去掉：换页时整屏发糊拖慢感知，且是纯合成开销。）
- **PJAX 进度** —— 页顶 2px 电光朱发丝线，缓行至 82%，就绪后瞬间走完淡出。
- **主题切换** —— View Transitions 圆形展开，圆心取触发按钮的位置，320ms；
  不支持时回退淡入。
- **图标笔顺** —— 日月图标以 `stroke-dashoffset` 逐笔画出；搜索放大镜展开时先画镜片后画手柄；
  汉堡菜单三线真形变为 ×。
- **卡片** —— hover 时标题电光朱下划线扫入（`background-size` 动画），按压 `scale(0.99)` spring 回弹。
- **阅读进度** —— 文章页 TOC 左侧发丝轨道随滚动被电光朱填充。
- **图片显影** —— 正文与卡片图片加载前模糊半透明，`onload` 后收敛清晰。

以上全部尊重 `prefers-reduced-motion`，降级为**呈现终态**而不是把时长归零。

### 键盘

- **⌘K / Ctrl+K** —— 唤起顶栏搜索（Mac 显示 ⌘K，其余平台显示 Ctrl K）
- **Esc** —— 关闭搜索
- **Tab** —— 全站可键盘到达，焦点环 2px 电光朱 + 2px offset


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

