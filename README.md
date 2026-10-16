# sephirxth.github.io

游渊 YouYuan 的个人主页和文章。**没有生成器**：每一页都是直接写好的 HTML，改哪页就改哪个文件，推到 `master` 就上线。2026-10-09 之前这里是 Hexo 加 NexT 生成的站点，那一版留在标签 `hexo-final` 上。

## 文件在哪

| 路径 | 内容 |
|---|---|
| `index.html` | 首页：一句话介绍、GAMES / SYSTEMS / RESEARCH 三栏、文章列表 |
| `about/index.html` | 关于 |
| `en/index.html` | 英文首页，和中文首页一一对应 |
| `en/about/index.html` | 英文“关于” |
| `projects/<代号>/index.html` | 项目介绍页，一个项目一页（中文） |
| `en/projects/<代号>/index.html` | 项目介绍页的英文版 |
| `tools/figlib.py`、`tools/figs.py`、`tools/figs_*.py` | 项目页里的图：画图工具和每张图的代码 |
| `archives/index.html` | 全部文章，按年份 |
| `YYYY/MM/DD/<标题>/index.html` | 一篇文章一个目录，沿用旧地址，不要改名 |
| `en/YYYY/MM/DD/<代号>/index.html` | 文章的英文版（有英文版的文章才有），代号和中文版相同 |
| `tools/add_cf_beacon.py` | 给每一页加上（或换掉）访问统计的代码 |
| `feed.xml` | Atom 订阅，手写 |
| `assets/css/site.css` | 全站唯一的样式表 |
| `assets/img/` | 1-bit 像素画，由 `tools/art.py` 画出 |
| `assets/fonts/` | Crimson Pro、Unica One（SIL OFL 许可） |
| `attachment/`、`images/` | 文章里的图片、站点图标 |
| `tags/`、`categories/`、`schedule/`、`随想/` | 旧地址，只放跳转 |

## 加一篇文章

1. 复制最近一篇文章的 `index.html` 到 `YYYY/MM/DD/<标题>/index.html`，换掉 `<title>`、`<h1>`、日期、正文和标签。正文只用 `h2 h3 p ul ol blockquote pre code img table` 这些标签，样式表都认识。
2. 文章配图放进 `attachment/`，正文里写 `/attachment/文件名`。
3. 在三处各加一行：首页的 WRITING 列表（只留最近 5 篇）、`archives/index.html`、`feed.xml`（同时改 `<updated>`）。
4. 给上一篇文章底部的翻页链接补上“较新的一篇”。
5. 2026-10-16 起，新文章的目录名用英文短代号（如 `theseus-personal-ai-os`），链接贴到别处不会变成一长串 `%E4%BB…`。旧文章的地址不动。
6. 要出英文版时放到 `en/YYYY/MM/DD/<同一代号>/`，两页头部互相链接（`English` / `中文`），`<head>` 里写好三条 `hreflang`，英文首页的 WRITING 列表指向英文版。

## 访问统计

用的是 Cloudflare Web Analytics：不用 cookie，不用给访客弹提示。统计代码是放在 `</body>` 前面的一行 `<script>`，前后有 `<!-- Cloudflare Web Analytics -->` 标记；只做跳转的旧地址页面不放。复制现成页面来改，新页面自然带着这行。漏了或者要换 token，就重跑：

```bash
python3 tools/add_cf_beacon.py . <token>        # 先加 --dry-run 看会改几页
```

数据在 Cloudflare 后台的 Web Analytics 里看。装了广告屏蔽插件的访客不会被记到，所以实际人数会比后台多。

## 改首页上的项目

每个项目是一个 `<article class="item">`：标题、一段话、一行小字。带 `lead-out` 的那一项，标题后面的细线会连到右边的图。

首页有中英两个版本。改了 index.html 里某个项目的文字，同时改 en/index.html 里对应的那一条；新加文章时，英文首页的 WRITING 列表也加一行（英文标题，链接仍指向中文文章）。

## 项目页

首页上每个项目的标题链接到它的介绍页。一页的结构是固定的：标题、一段导语、一张小表（TYPE、STATUS、WHEN 等）、几节正文、几张图。新加一个项目就复制一页现成的来改，再到首页（中英各一处）加上链接。

项目页里的图是直接写在页面里的 SVG，由 `tools/figs.py` 画出来再填进去。页面里放图的地方是一对标记：

```html
<!-- fig:flow-loop:zh -->
……（这里的内容由脚本生成，不要手改）
<!-- /fig -->
```

改图就改 `tools/` 里对应的函数，然后重画：

```bash
python3 tools/figs.py
```

每张图的中英文标签写在同一个函数里。图里的数只能来自代码或记录，凭印象画的示意图要在图注里写明“示意图”。改了中文页的文字，英文页对应的地方也要改。

## 首页和页脚上的像素画

所有图都是两种颜色的 1-bit 图，按整数倍放大显示（`class="px"`）。重画：

```bash
python3 tools/art.py
```

想换成自己的截图，先把它处理成同样的两色抖点风格再放进来，页面风格才统一。

## 本地预览

```bash
python3 -m http.server 8000   # 然后打开 http://127.0.0.1:8000/
```
