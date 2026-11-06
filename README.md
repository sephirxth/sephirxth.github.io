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
| `tools/add_cf_beacon.py`、`tools/add_umami.py`、`tools/add_ga.py` | 给每一页加上（或换掉）访问统计的代码：Cloudflare、Umami、GA4 各一个 |
| `tools/make_sitemap.py` | 生成 `sitemap.xml` |
| `sitemap.xml`、`robots.txt` | 站点地图（脚本生成，不要手改）；`robots.txt` 手写，指向站点地图 |
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
7. 提交前按下面"写新页面以后"重跑脚本，站点地图才会收进新页面。

## 访问统计

用的是 Cloudflare Web Analytics：不用 cookie，不用给访客弹提示。统计代码是放在 `</body>` 前面的一行 `<script>`，前后有 `<!-- Cloudflare Web Analytics -->` 标记；只做跳转的旧地址页面不放。复制现成页面来改，新页面自然带着这行。漏了或者要换 token，就重跑：

```bash
python3 tools/add_cf_beacon.py . <token>        # 先加 --dry-run 看会改几页
```

数据在 Cloudflare 后台的 Web Analytics 里看。装了广告屏蔽插件的访客不会被记到，所以实际人数会比后台多。

2026-10-18 起另有两套，也是有标记的块，只做跳转的页面同样不放：

- Umami（自建）：`</body>` 前一行，紧跟 Cloudflare 那行，前后是 `<!-- Umami -->` 标记。
- Google Analytics 4：`<head>` 后面紧挨着 11 行，是 Google 给的 gtag.js 原样代码，前后是 `<!-- Google Analytics -->` 标记。GA4 会在访客浏览器里写 cookie。

## 写新页面以后

复制现成页面来改，三套统计代码已经带着，但站点地图每加一页都要重跑。新页面写好、提交之前，在仓库根目录依次跑这四条：

```bash
python3 tools/add_cf_beacon.py . a5f31fd19bf14dda997cec8c57718059     # Cloudflare
python3 tools/add_umami.py . 5b204497-f89b-4179-a471-cdeef73fc96f https://aws-ec2-oregon.tail17a64.ts.net/glyph.js   # Umami
python3 tools/add_ga.py . G-GWLH236264                                # GA4
python3 tools/make_sitemap.py .                                       # 站点地图，最后跑
```

- 四条都能重复跑：已有的块原样换掉，不会重复插。想先看会改几页，末尾加 `--dry-run`。`add_umami.py`、`add_ga.py` 加 `--remove`（不带 ID）是从所有页面撤掉那一块。
- 上面写的 token、网站 ID、衡量 ID 本来就在网页源码里，不是秘密。Umami 的脚本地址换了，就带新地址重跑第二条。
- `make_sitemap.py` 收进所有真实页面，不收只做跳转的旧地址页和 `404.html`；`lastmod` 取该文件最后一次提交的日期，还没提交的改动算今天。所以它要在这个 git 仓库里跑、放在最后跑，再把页面和 `sitemap.xml` 一起提交。
- `robots.txt` 不用动。Google Search Console 里提交的站点地图地址是 `https://sephirxth.github.io/sitemap.xml`。

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

首页的 Rule 110 动图由同一套规则、初始状态、裁切和两色配色生成，第一帧对应原 PNG：

```bash
python3 tools/animate_rule110.py   # 需要 Pillow，生成 80 帧 GIF
```

两个首页默认用 JavaScript 切到 GIF，访客可暂停；系统选择减少动态效果、脚本不可用时显示原 PNG。`assets/js/rule110.js` 只管这张图。

末日港湾页面保留历史地址，但不再从首页或当前项目导航展示；两页设为 `noindex`，并由 `tools/make_sitemap.py` 排除。恢复展示时须同时恢复这几处。

想换成自己的截图，先把它处理成同样的两色抖点风格再放进来，页面风格才统一。

## 本地预览

```bash
python3 -m http.server 8000   # 然后打开 http://127.0.0.1:8000/
```

## 文字修仙网页试玩

在线元胞实验版：<https://sephirxth-text-cultivation.vercel.app/>。它是材料规则的格子改写，不是原型完整版移植。源代码放在 `demos/text-cultivation/`；Vercel 部署只上传该目录，直接提供静态文件，不需要构建。`demos/` 由独立试玩维护，不纳入主站的统计脚本批量维护或站点地图。

画面在 `render-gl.mjs`（WebGL2）：磁青纸底、泥金界栏和洒金，材料按矿物颜料上色。火是从燃烧格向上采样的火焰场；水、熔金、汽、冰先叠成连续的场，再画成水面、熔池和云；发光的材料照亮纸面，另有泛光和热浪扭曲。字形是马善政毛笔楷书的子集（`assets/brush-kai.woff2`，SIL OFL 1.1，许可证见 `assets/FONT-LICENSE.txt`），运行时生成距离场字图，用来做落笔、燃烧、蒸发、结冰、熔化的过渡。浏览器拿不到 WebGL2 时退回 `effects.mjs` 的 Canvas 2D 画法；地址加 `?renderer=2d` 可强制使用它，检查退回路径。`simulation.mjs` 给每格加了随格移动的 `uid`，只供画面跟踪移动和状态变化，规则不读它。默认示例“山水”：雷落在最高的树上引起山火。页面打开先播一段开场（`opening.mjs`，约 20 秒）：“我”在雪峰上聚金成剑，御剑穿云，渡七道雷劫后飞升，再进入山水；点画布、按任意键或“跳过开场”可跳过，示例里选“开场：剑修渡劫”可重看，系统减少动态时不播。开场只驱动渲染层的舞台，不碰材料模拟。页面是全屏游戏：画布铺满窗口，控件浮在上面，材料栏和字囊放在底部的坞里，画布只到坞的上沿；“说明”打开规则，“全屏”调用浏览器全屏。施法参照《失落的魔法》（Lost Magic，NDS）：按住右键在“我”身边唤出法阵（八个锚点），左键连锚点画符，上·右下·左下为火，四个斜角为土，沿阵边一段弧为风，绕阵一圈为收；锚点随笔画亮起并按五声音阶响，认出的符吸附成标准形落进阵里，最多叠两个成阵（烈焰、飓风、山岳、火龙卷、熔岩、沙暴，`formation.mjs`）。松开右键选方向，左键释放：火、土、熔岩和收飞出去碰到东西才发作，“收”把打中的一片相连材料收进字囊；风从“我”身上吹出。没有右键时选“符”点画布唤阵，从阵心向外一划释放。画符按笔画长短耗灵力。对着“我”滚轮往里推（或点“内观”、按 I）进入内观（`inner.mjs`）：字囊里的字放进下丹田、泥丸、膻中，灵气按五行生克在穴位间放大或削弱，合计定下灵力上限与恢复（`Simulation.maxSpirit`、`regen`，默认 180 和 12/秒）和各种符的亲和（风算木，木生火）。燃烧、沸腾、熔化等反应冒出的灵气飞回“我”，按周天吸收。风是模拟里的一张风场（`World.addWind`），只有刮风时才消耗随机数。法阵读符、飞行、收字、风与五行的检查在 `tests/formation.test.mjs`。第一次打开在开场后出现九步新手引导（写字、唤阵、火符、释放、叠阵、收字、内观、放字、出定），每步等玩家做到才往下走，画符的步骤在法阵上浮出虚线示范，记在 localStorage 里，“说明”里可重看。背景是半分辨率的月夜水墨山（月、星、高云、三重山脊与山间雾），随鼠标做视差，触屏上缓慢漂移，开场升空时群山下沉。液体只在八格内有可落的空处时才横移，平地上的水会静止，不再来回游走。程序合成音效在 `audio.mjs`：每种材料对应五音之一（土宫、金商、木角、火徵、水羽），落笔的横向位置决定音级，整体过一层混响。`app.mjs` 只消费引擎给出的真实反应事件，表现层不改变材料演化。声音默认关闭，必须由玩家主动开启；暂停、后台和画布离屏会静音。动态按钮及系统的减少动态设置会减弱运动和震动。桌面与手机分别限制短期特效数量，避免持续写入造成堆积。画成的符会按元素颜色留在法阵上，直到释放。“渡劫”（`trial.mjs`）是七重妖劫：天地换成劫台场景（左边下沉的湖、右边一片树林，劫台是不被风吹走的夯土），“我”坐镇台顶不能移动；木魅、火妖、土傀、冰魄从两边来，扑到“我”身上就伤道心，道心归零即失败，撑过七重就飞升。妖物是叠在画面上的角色，不占格子，但读同一张世界：火、热、熔金烧它，水泡它、让它变慢，带电的格子电它，被土埋住就动不了并慢慢掘出，风场推它；它们也反过来改世界（火妖点燃木，冰魄冻住水，被挡住时会掘墙）。伤害按五行相克加减（水克火妖，土克冰魄，风属木克土傀，雷属金克木魅；火也烧木魅、融冰魄），克制时头上冒“克”字。第三、五、七重有天雷：落点先亮光圈，雷劈在这一列的第一个实物上，“我”头顶有金或木就挡住，土会落下挡不住。血条变金（三成以下）时用“收”打中，就把妖收进字囊，调息时内观放进穴位，提高灵力和道心上限。两重之间调息九秒，灵力回满；打斗时不能内观。最好成绩记在 localStorage。

修改材料模拟后，在仓库根目录运行行为检查：

```bash
node demos/text-cultivation/tests/simulation.test.mjs
node demos/text-cultivation/tests/formation.test.mjs
node demos/text-cultivation/tests/trial.test.mjs
```
