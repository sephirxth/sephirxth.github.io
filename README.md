# sephirxth.github.io

游渊 YouYuan 的个人主页和文章。**没有生成器**：每一页都是直接写好的 HTML，改哪页就改哪个文件，推到 `master` 就上线。2026-10-09 之前这里是 Hexo 加 NexT 生成的站点，那一版留在标签 `hexo-final` 上。

## 文件在哪

| 路径 | 内容 |
|---|---|
| `index.html` | 首页：一句话介绍、GAMES / SYSTEMS / RESEARCH 三栏、文章列表 |
| `about/index.html` | 关于 |
| `en/index.html` | 英文首页，和中文首页一一对应 |
| `en/about/index.html` | 英文“关于” |
| `archives/index.html` | 全部文章，按年份 |
| `YYYY/MM/DD/<标题>/index.html` | 一篇文章一个目录，沿用旧地址，不要改名 |
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

## 改首页上的项目

每个项目是一个 `<article class="item">`：标题、一段话、一行小字。带 `lead-out` 的那一项，标题后面的细线会连到右边的图。

首页有中英两个版本。改了 index.html 里某个项目的文字，同时改 en/index.html 里对应的那一条；新加文章时，英文首页的 WRITING 列表也加一行（英文标题，链接仍指向中文文章）。

## 图

所有图都是两种颜色的 1-bit 图，按整数倍放大显示（`class="px"`）。重画：

```bash
python3 tools/art.py
```

想换成自己的截图，先把它处理成同样的两色抖点风格再放进来，页面风格才统一。

## 本地预览

```bash
python3 -m http.server 8000   # 然后打开 http://127.0.0.1:8000/
```
