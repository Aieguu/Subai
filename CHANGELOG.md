# Changelog

本文件记录 Subai Hugo 主题的版本变更。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)。

版本号的唯一真源是 `package.json` 的 `version` 字段，正式版本以 `vX.Y.Z` 标签标注在主题仓库上。`theme.toml` 中的 `min_version` 表示所需的最低 Hugo 版本，与主题自身版本无关。

---

## [2.0.0] - 2026-11-10

一次覆盖模板、样式架构、脚本与站点配置的**整体重构**，基线为回滚后的 `595af41`（对应旧 `1.0.0`）。主题侧 58 个已跟踪文件变更（+5614 / −5060，其中 7 个删除）、14 个新增文件，另有本次新增的 `CHANGELOG.md`。由于包含多项不兼容的配置与模板变更，主版本号由 1 提升到 2。

本次同时涉及站点仓库（`Aieguu/blog`）的配套调整，见文末「配套站点同步变更」。

### 新增

#### 设计系统与视觉语言
- `layouts/partials/head/styles.html` 的 `:root` 扩充为完整的令牌层：新增 `--color-on-accent`、`--color-primary-tint`、`--color-primary-soft`、`--font-weight-normal/medium/semibold/bold`、`--motion-quick`、`--motion-surface`；字体栈改为 Inter / 苹方 / 微软雅黑等无衬线栈并用 `safeCSS` 输出。
- 圆角重定为固定像素阶梯 `--radius-xs 6 / sm 8 / md 12 / lg 16 / xl 20 / 2xl 26 / pill 999`，避免 `rem` 缩放导致角变形；新增 `assets/css/radius.css`，用 `@supports (corner-shape: squircle)` 给「面」元素连续曲率，胶囊与正圆排除，内层裁剪元素用 `corner-shape: inherit` 继承。
- 组件级变量收口：搜索高亮圆角、分享配色、引语（`--quote-accent` 派生）、表格（`--table-accent` 派生）、灯箱动效（`--image-zoom-*`）、磁贴（`--tile-*`）等，不套阶梯的数值在组件内收进变量并注明豁免理由；`syntax.css` / `highlight-note.css` 作为独立加载子系统保留自有配色。
- 字重、字号、行高与颜色中凡与阶梯等值的裸值统一改为令牌引用（约 188 处等价替换）；`color: #fff` 统一改用 `--color-on-accent`，不随明暗主题翻转。

#### 首页
- Bento 网格重构：桌面 12 列语义布局（最新文章 8×3、天气 4×3、简介 / 音乐 / 引语各 4×1），≤1120px 降为 8 列，≤768px 单列；只靠 `grid-column/row` 跨度自动排布，关闭天气磁贴时右侧自然变成三块竖排，不留空洞。
- 最新文章磁贴改为头条（分类 chip + 日期 + 标题 + 摘要）+ 紧凑列表；音乐磁贴重排为 head / 进度 / 传输控件三段；引语磁贴加标题并放大字号；所有 `data-*` 钩子保持不变。
- 新增**天气磁贴** `assets/js/weather.js`：点阵天空（日月弧线、月相、云层视差、雨雪、地平线山丘）、当日与三日预报、体感温度与降水概率、温度色映射、场景切换淡入淡出与温度滚动动画。数据来自 Open-Meteo（免密钥），定位链为「访客手动选城 > 站点固定坐标 > IP 粗定位 > `fallbackCity`」，支持城市自动补全、右键恢复自动定位、30 分钟缓存；靠 IntersectionObserver / `document.hidden` / `prefers-reduced-motion` 停帧，PJAX 换页统一回收定时器、监听与 Observer。

#### 搜索
- 新增 `layouts/partials/search-dialog.html`，重写 `assets/css/search.css`、`assets/js/search.js` 与 `layouts/_default/search.html`，把原「顶栏小药丸 + 跳转搜索页」改为命令面板：面板与搜索页共用匹配和渲染逻辑。
- 支持 `Ctrl / ⌘ + K` 唤起、`↑` `↓` 选择、`↵` 打开、`Esc` 关闭、焦点陷阱与关闭后焦点归还；空态显示最近搜索（localStorage，最多 6 条）与热门标签；打开时预填 URL 里的 `?q=`。
- 打分规则：标题 140 / 110 > 标签 60 > 分类 50 > 副标题 45 > 摘要 28 > 正文 14，多个关键词必须全部命中。
- `layouts/index.json` 的封面改走 `resources.Get` + `.Fill "96x96 Center webp"`，不再指向不存在的静态路径。

#### 页面与模板
- 新增 `assets/css/article.css` / `assets/js/article.js`，文章页重做为阅读面板（808px 正文 + 280px 目录）：面包屑 → 分类与标签 → H1 → 副标题 → 作者 / 日期 / 更新 / 字数，正文 17px / 1.85，文末「全文完」+ 标签 + 回到顶部；目录带百分比读数与进度线，是文章页**唯一**的阅读进度指示。
- 新增 `/browse/` 浏览页模板 `layouts/_default/browse.html`：上半分类卡、下半按热度排序的标签云；分类 / 标签列表页合并到参数化的 `layouts/partials/taxonomy-list.html`，由 `kind` 配置表派生文案、class 与 i18n key，两个 `list.html` 只做单行调用。
- 新增 `layouts/partials/icon.html`，分类 / 标签图标统一为两枚 SVG，去掉 `#` 前缀。
- 新增 `layouts/partials/img.html` 响应式图片管线：`srcset` + `sizes` + 宽高属性 + WebP，支持 `mode=cover|fit` 与比例裁切，缺失资源时 `warnf` 回退；接入卡片封面、首页头像与正文图渲染钩子。
- 新增 `i18n/zh-cn.toml` 与 `i18n/en.toml`（各约 150 条），补齐页脚主题三态切换、搜索、文章元信息等文案；`head/meta.html` 的 description 与 `img.html` 的外部 URL 判断各自只求值一次。

#### 交互
- 图片灯箱 `assets/js/image-lightbox.js` 改用 **View Transitions 共享元素形变 + 原生 `<dialog>.showModal()`**：删掉 `position:fixed` 克隆代理、手写 FLIP 与 `!important` 叠层；`--image-zoom-duration: 380ms` / `--image-zoom-ease` 作为唯一节奏源，CSS 伪元素与 WAAPI 降级都读它；打开时锁滚动并补偿滚动条宽度，`img.decode()` 避免快照空白，`showModal()` 负责 inert 背景与焦点归还；不支持 VT 或开启减动效时降级为淡入淡出。
- 正文图片回归常规流静态呈现（`display:block`，无 transform / 悬浮阴影 / hover 上浮），可放大仅保留 `cursor: zoom-in` 与静态焦点环。
- PJAX 导航新增 `syncHead()`，换页时同步 description / keywords / author / og / twitter / canonical 与 `<html lang>`，并把焦点移到 `#main-content`；`window.Subai.register('initSearchPage', …)` 保证搜索模块在每次换页后重新初始化。
- Header 三栏改为 `minmax(0,1fr) auto minmax(0,1fr)` 使导航严格居中；滚动后（>24px）收成「悬浮岛屿」，宽度 / 圆角 / 底色 / 阴影共用同一缓动曲线，容器 `padding-inline` 同步补偿，`--sbw` 消除滚动条带来的约 7px 漂移；移动菜单改为整幅 `clip-path` 展开 + 逐条错峰，汉堡按钮做真正的形变；阅读态只替换品牌那一格、带 32/56px 迟滞且仅在文章页生效，标题可点击回顶。

### 变更

- **视觉减法**：卡片移除阅读时长与右下箭头，去掉双层渐变、彩色光晕、`backdrop-filter`、`text-shadow` 与 h2 前的蓝色短线；`/posts/`、`/browse/` 不再渲染可见大标题，只保留 `.sr-only` 的 h1；文章面板与目录去掉外描边。
- **块引用重做**：视觉从 `reset.css` 全部移到 `article.css` 的 `.content blockquote`，改为四角 `--radius-lg` squircle 面板 + 左侧 2px 渐隐细引线，底色 / 描边 / 引线 / marker 都由 `--quote-accent` 派生；深色、移动端与打印各有降级。
- **表格重做**：`layouts/_default/single.html` 在构建期用 `replaceRE` 给 `<table>` 包一层 `.table-wrap`，滚动 / 圆角 / 外框交给容器，`table` 回归 `display: table; width: 100%`；表头淡主色底、行线满宽、窄屏 `table-layout: fixed` 且表头可换行。
- **图片分辨率**：`img.html` 的候选阶梯改为覆盖「实际渲染宽度 × 2」，正文 400/740/1110/1480、卡片 112/176/352/528、头像 26/52/78，原图比阶梯窄时自动补一档；灯箱优先取 `data-zoom-src` 并用 width/height 定死画框，换大图不再二次撑大。
- **性能与工程**：删除 `post.css` 中与 `cards.css` 重复的 314 行、仅剩注释的 `assets/css/main.css`、空转的 `initAnimations()`、`.theme-transitioning *` 与常驻 `will-change`；`registry.js` 精简；`main.css` 打包清单加入 `radius.css` 与 `article.css`。
- **运行时健壮性**：`math.js` 选择器改为 `#article-content` 并删旧兼容层；`main.js` 用 `safeGet/safeSet` 包住 localStorage、对非法主题值兜底、不再覆盖式赋值 `body.className`；灯箱补焦点陷阱与背景 inert；音量滑块点击热区 4px → 24px。
- **文档与元数据**：署名统一为 Aieguu（LICENSE / `theme.toml` / `package.json` / README / exampleSite）；`package.json` 的 dev/serve/build 脚本改为 `--source exampleSite --themesDir ../..`，exampleSite 补齐 `content/{browse,search,theme}/_index.md`、菜单、`avatar = "subai.png"` 与空 playlist，可独立构建；主题立绘 `assets/subai.png` 更换为新版看板娘。
- **配置口径**：`languageCode` / `hasCJKLanguage` 改为 `locale`，`markup.tableOfContents.endLevel` 由 4 改 5，代码块复制文案改中文，导航入口由「首页 / 文章 / 分类 / 标签 / 关于主题」收敛为「首页 / 文章 / 浏览 / 主题」，`/theme/` 从页脚移到主导航。

### 修复

- `head/styles.html` 里字体栈被 `html/template` 判定为非法 CSS 而输出 `ZgotmplZ`，导致整站回退浏览器默认字体。
- 表格 `display:block` 使内部匿名表格按内容收缩，表头底色与行分隔线只画到约 2/3 宽度。
- 正文图片在 DPR ≥ 1.5 的屏幕上发虚：`srcset` 最大只到 1000w，灯箱按 `currentSrc` 铺开时上采样达 2×。
- 分页当前页 hover 后被 `a.pagination-number:hover` 盖成白底白字；页脚 GitHub 按钮 hover 时内部 SVG 跟着位移跳动。
- `IsMenuCurrent "main"` 对以 `url` 定义的菜单项恒为 false，导航当前态高亮从未生效（改为精确 / 段落前缀匹配并补 `aria-current`）。
- Header 岛屿展开动画因容器 `padding-inline` 没有过渡而显得「瞬变」，以及 1200–1232px 区间的 7px 残留位移。
- `.post-card-unified` 固定 176px 高导致带副标题的卡片溢出；嵌套 `<main>` 与全页 h1 层级错误；触摸设备 `:focus-visible` 焦点环被 `!important` 清空；`data-quotes` / `data-playlist` 中的单引号截断属性；`--font-weight-bold` 未定义使列表标题字重失效。
- 阅读进度曾先后实现为顶部直线条与 Header 岛屿环绕描边，按最终取舍**整体撤销**，只保留右侧 TOC 的读数与进度线。

### 移除与破坏性变更

> 升级前请读「升级指南」，以下改动无法在不改配置 / 内容的前提下平滑过渡。

- **划词笔记插件整体淘汰**：删除 `assets/js/highlight-note.js`、`assets/css/highlight-note.css`、`layouts/partials/highlight-note.html`、`layouts/shortcodes/hl.html`、`baseof.html` 与 `index.html` 中的引用、README 与主题页的插件章节；站点需删除 `[params.plugins.highlightNote]`、`content/notes/` 及文章里的 `{{< hl >}}` 标记，否则构建会因 shortcode 不存在而失败。
- **PWA 彻底移除**：删除 `static/sw.js`、`static/offline.html` 与注册逻辑，移除 `package.json` 的 `pwa` 关键字。
- **首页配置变更**：`[params.homeTiles.image]` 被 `[params.homeTiles.weather]` 取代，`introTitle` 移除；音乐 `playlist` 中的文件扩展名在站点侧由 `.mp3` 改为 `.m4a`。
- **导航变更**：`/categories/`、`/tags/` 两个入口合并为 `/browse/`（需要站点新增 `content/browse/_index.md` 并设 `layout: browse`）；`/theme/` 改为主导航项。
- **资源管线变更**：图片从 `static/images/` 迁到 `assets/images/` 并交给 `img.html` 处理，旧 `cover_image` 路径需同步更新；正文图片不再支持 hover 上浮效果。
- 共删除 7 个文件：`assets/css/main.css`（仅剩注释）、`assets/css/highlight-note.css`、`assets/js/highlight-note.js`、`layouts/partials/highlight-note.html`、`layouts/shortcodes/hl.html`、`static/sw.js`、`static/offline.html`；`responsive.css` 中大部分独立规则迁入各组件文件；顶部直线阅读进度条不再提供。

### 升级指南

1. 更新子模块：`git submodule update --remote themes/Subai`（`.gitmodules` 建议补 `branch = main`）。
2. 删除 `[params.plugins.highlightNote]`、`[params.homeTiles.image]`、`introTitle`；新增 `[params.homeTiles.weather]`（不想启用就写 `enabled = false`）。
3. 把 `languageCode` 改为 `locale`，删掉 `hasCJKLanguage`；`markup.tableOfContents.endLevel = 5`。
4. 新增 `content/browse/_index.md`（`layout: browse`），主菜单改为「首页 / 文章 / 浏览 / 主题」四项。
5. 把文章中的 `{{< hl "…" "…" >}}` 改为普通加粗，删除 `content/notes/`；`cover_image` 与正文图片路径改为 `assets/images/` 下的新文件名。
6. 音频转 AAC / M4A 后更新 `homeTiles.music.playlist`；Hugo ≥ 0.149.1，CI 建议锁定 0.165.0，构建命令加 `--cleanDestinationDir` 清理旧 fingerprint 资源。
7. 主题自带 `exampleSite/` 可作为最小可用配置参考：`npm run dev` 即可独立预览。

---

### 配套站点同步变更（`Aieguu/blog` 仓库，不随主题版本发布）

本次站点侧同步改动，用于适配上述主题接口；它们是站点内容与资源的调整，不属于 Subai 版本号的范围。

- **资源**：图片由 `static/images/` 迁到 `assets/images/`，新增 6 张（Avatar / Docker / SpringAI / Subai / GitWorktree 多分支协作指南 / RAG 知识增强信息图），删除 7 张旧图；6 篇文章的 `cover_image` 与正文图路径同步更新；两首音频由 320k MP3（19.6 MB）换成 112k AAC/M4A（约 6.6 MB）；`favicon.ico` 由 264 KB 压到 6.9 KB；主题页换用新版立绘。
- **内容**：新增 `content/browse/_index.md`；删除 `content/notes/`（含 `.gitkeep` 与一篇同步笔记）；《RAG 检索优化》中的 `{{< hl >}}` 改为加粗；主题页删除划线笔记插件段落。
- **配置**：删除 `[params.plugins.highlightNote]`，`[params.homeTiles.image]` 换成 `[params.homeTiles.weather]`，音乐路径改 `.m4a`，导航改为四项，`endLevel` 注释修正。
- **工程**：CI 的 Hugo 版本由 `latest` 锁定为 `0.165.0`，构建命令加 `--cleanDestinationDir`；`.gitmodules` 补 `branch = main`；`.gitignore` 增加 `.workbuddy/`；子模块指针更新到本版本 `v2.0.0`。

---

## 版本说明

- **`2.0.0`（本次）**：主版本提升。理由：模板与 CSS 架构整体重写、多项配置键与菜单结构调整、划词笔记插件与 PWA 移除、`{{< hl >}}` shortcode 删除、图片资源管线迁移——对现有站点均不兼容，需要按升级指南手动调整。
- **`1.0.0`（旧）**：主题重构前的初始版本，未打正式 `v*` 标签。标签 `backup/v1-paper-ink-cinnabar-20260930` 是被回滚的「纸 · 墨 · 朱砂」设计语言存档，分支 `feat/prism-design-language` 是基于它的 Prism 换代实验，两者都**不是**发布版本，也不在本 changelog 的版本线上。
