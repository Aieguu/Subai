# Prism 迁移与实施计划

配套文档：[`PRISM.md`](./PRISM.md)（设计语言规范）

本文包含两部分：**已执行的 Git 操作**（含回溯方法）与**分阶段实施计划**。
代码改动在方案确认后才会开始。

---

## 第一部分：Git 操作

### 1.1 已执行（本轮完成）

全部在子仓库 `themes/Subai` 内执行，外层 `blog` 仓库未被触碰。

```bash
cd themes/Subai

# ① 从当前状态（含未提交改动）新建存档分支并切换
git checkout -b legacy/paper-ink-cinnabar

# ② 把 v1 全量落库（含此前只在工作区的 13 个文件改动）
git add -A
git commit -F - <<'EOF'
archive: 冻结「纸 · 墨 · 朱砂」设计语言 v1（存档分支）
...（详见提交正文，含冻结范围、收录的未完成改动、验证结论）
EOF

# ③ 从存档点切出开发分支
git checkout -b feat/prism-design-language legacy/paper-ink-cinnabar
```

**结果**

| 分支 | SHA | 说明 |
| --- | --- | --- |
| `main` | `0f7ea64` | 保持原样，未改动（本地领先 origin 1 个提交，未推送） |
| `legacy/paper-ink-cinnabar` | `17c6665` | **v1 存档**，13 files / +461 −41 |
| `feat/prism-design-language` | `17c6665` | **当前所在**，开发分支，工作区干净 |

`main` 一字未动。存档分支与开发分支同指向 `17c6665`，
即开发分支的起点就是 v1 的完整状态——任何时刻都能 `git diff legacy/... ` 对照。

### 1.2 尚未执行（需要你操作）

**推送存档分支到远端。** 本机 `credential.helper` 未配置可用助手，非交互环境下
拿不到 GitHub 凭据，所以我没有执行 push。建议手动推一次，让存档不依赖本地磁盘：

```bash
cd themes/Subai
git push -u origin legacy/paper-ink-cinnabar
```

（可选）打一个标签，比分支名更好记：

```bash
git tag -a v1-paper-ink -m "纸 · 墨 · 朱砂 设计语言冻结" legacy/paper-ink-cinnabar
git push origin v1-paper-ink
```

### 1.3 回溯方法（三档，按需要选）

```bash
# 只是想看看 / 对比——不动任何文件
git diff legacy/paper-ink-cinnabar..feat/prism-design-language -- assets/css/
git show legacy/paper-ink-cinnabar:layouts/partials/head/styles.html

# 临时回到 v1 外观验证问题（会离开开发分支，记得切回来）
git checkout legacy/paper-ink-cinnabar
# ... 验证 ...
git checkout feat/prism-design-language

# 彻底放弃 v2，让开发分支回到 v1
git checkout feat/prism-design-language
git reset --hard legacy/paper-ink-cinnabar
```

⚠️ 第三档 `reset --hard` 会丢弃开发分支上的所有提交。只在明确要放弃时执行，
且执行前确认 `git status` 里没有想留的东西。

### 1.4 外层仓库

迁移期间外层 `blog` 仓库的 submodule 指针会变化（子仓库有新提交才有新指针）。
指针更新留到最后统一做，避免中间态污染外层历史：

```bash
# 迁移完成、子仓库提交就绪后，在外层执行
cd ../..            # 回到 blog 根
git add themes/Subai
git commit -m "chore: 更新 Subai 子模块至 Prism 设计语言"
```

外层 `content/posts/给 MCP 服务器做管理员工具分级.md` 目前仍是未跟踪状态，
**本轮未提交**，保持原样。

---

## 第二部分：分阶段实施计划

原则：**每一阶段结束都可构建、可访问、可回退**。不做「改到一半跑不起来」的大爆炸。

### 阶段 0 · 版本保护 ✅ 已完成

存档分支 + 开发分支就绪，工作区干净，构建通过（131 页 / 2.4s）。

交付物：本文档第一部分。

---

### 阶段 1 · 令牌层落地（约 1 个提交）

- 新增 `assets/css/primitives.css`（第 1 层原始令牌）
- 新增 `assets/css/tokens-prism.css`（v2 语义令牌，浅/深双套）
- `head/styles.html`：输出 `data-design` 属性，两个新文件加入 Concat 顺序
  （放在 fonts 之后、reset 之前）
- `hugo.toml` 侧新增 `params.design` 开关（默认 `paper`）

**验收**：`params.design = "prism"` 与 `"paper"` 都能构建；切到 prism 时全站颜色、
圆角、字距已整体变化，**但没有任何组件文件被改过**——证明语义层沿用命名的策略成立。
两种模式都可能有个别元素比例失调，这正常，交给后续阶段修。

---

### 阶段 2 · 基础排版与结构（约 1 个提交）

- 字体栈切换：Geist（Latin）+ 系统中文；`scripts/fetch-fonts.mjs` 改抓取目标
- **删除** `static/fonts/noto-serif-sc/` 104 个分片，加入 Geist latin 可变字体
  （体积核算：预计从 ~2MB 降到 ~150KB 量级，需实测确认）
- 字阶双档（UI 15px / 阅读 17px）落地
- 间距 4px 网格 + 流式段距
- `layout.css` / `reset.css` 按新尺度调整

**风险点**：删字体是破坏性操作，先确认 Geist 抓取得到了再删；中文改走系统栈后
Windows 与 macOS 观感会有差异，需要在两端各看一眼。
**验收**：中英混排、代码块、长标题都不破版；`hugo --minify` 通过。

---

### 阶段 3 · 组件改造（约 3–4 个提交，按组件拆）

按依赖顺序推进，每个组件一个提交：

1. **按钮与表单**（`post.css` / `share.css` / `search.css`）
   44px 触控、圆角 12、焦点环 2px+2px offset、错误态三重编码
2. **卡片与列表**（`cards.css` / `taxonomy.css` / `home.css`）
   圆角 16、表面阶梯分层、hover 上浮 + 描边转强、封面 16:10
3. **导航与搜索**（`header.css`）
   顶栏 64px、当前项指示条、搜索框 ⌘K chip、移动端底部 sheet
4. **TOC / 分页 / 代码块 / 分享**（`toc.css` / `pagination.css` / `syntax.css` / `share.css`）

**验收**：每个提交单独可构建；键盘走查一遍焦点环；移动端 375px 宽度无横向滚动。

---

### 阶段 4 · 图标与品牌元素（约 2 个提交）

- 图标统一到 Lucide（24 / 2px / round），激活态用实心变体
- 音乐播放器 6 个 Iconfont 图标保留（作者署名已在 README），统一到 24px 网格
- 品牌元素换材质：印章 → 荧光印；404 墨圈 → 断棱光环；新增光晕与颗粒噪点
- v1 的纸墨细节（干支纪年落款、十二时辰、节气、山水频谱、洇墨打字机）
  **全部保留**，只换材质，不删除功能

**验收**：`prefers-reduced-motion` 下全部呈现终态；404 页与印章在深浅两色下都清晰。

---

### 阶段 5 · 动效与交互（约 2 个提交）

- 曲线分工（弹簧做交互、缓出做入场、standard 做颜色）
- 时长与 stagger 调整（40ms / 封顶 8 项）
- 主题切换圆心改为触发按钮位置，时长 200 → 320ms
- PJAX 换页改为淡入 + 上移 6px（去掉模糊晕染）
- 新增 ⌘K 唤起搜索

**验收**：降低 `prefers-reduced-motion` 下无残留动画；PJAX 重入无泄漏
（旧页面 rAF、音频分析器都要正确释放——v1 的 home-widgets 里已有这个约定，别改坏）。

---

### 阶段 6 · 收尾（约 1–2 个提交）

- 可访问性走查：对比度过 WCAG AA、焦点环全覆盖、触控目标 ≥ 44px
- 深浅两色全页面截图走查
- 删除 `paper` 那一轨令牌，prism 提升为默认
- `README.md` 设计语言章节整段替换；`theme.toml` / `package.json` 特性描述更新
- 外层仓库更新 submodule 指针（见 1.4）

**验收**：`./hugo.exe --minify` 通过；构建产物体积与 v1 对比有记录；
外层仓库只有 submodule 指针变化。

---

## 第三部分：待确认的决策点

开始动手前，这几条需要你点头（都会实质影响观感与工作量）：

1. **Geist vs Inter**（Latin 字体）。Geist 更「2026」、更开发者向；Inter 更中性安全。
   两者同为 OFL。我倾向 Geist。
2. **中文是否真的放弃自托管**。放弃 → 体积大降、Windows/macOS 观感有差异；
   保留 → 维持一致性但要重新抓思源黑体的分片（工作量不小）。我倾向放弃。
3. **折射色用于标签**是否要做。这是全案里最「活泼」的一笔，也最可能显花。
   不做也完全成立（标签全用灰阶 chip）。我倾向做，但只给圆点不给底色。
4. **纸墨细节保留程度**。我默认全保留换材质。若你觉得「印章/节气/洇墨」与
   「年轻现代」冲突，可以只保留节气与落款，砍掉印章与洇墨。
5. **是否需要 `params.design` 长期保留为开关**。若确定不再回退，
   阶段 6 之后可以彻底删掉 paper 轨（我的计划里是删）。

---

## 附：常用验证命令

```bash
# 构建（在 blog 根目录，约 2.4s / 131 页）
./hugo.exe --minify

# 本地预览
./hugo.exe server -D

# 只对比 CSS 令牌变化
git diff legacy/paper-ink-cinnabar -- assets/css/ | head -100

# 确认没碰到主题之外的文件（子仓库内应只有 docs/ 与 assets/css 等）
cd themes/Subai && git status --short
```

注意：不要用 `--cleanDestinationDir`，清目录会撞 WorkBuddy 的批量删除守卫。
