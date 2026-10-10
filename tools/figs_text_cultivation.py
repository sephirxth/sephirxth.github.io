from figlib import FAINT, HAIR, INK, PAPER, SOFT, WHITE, Svg, T, fig


# Inputs and strict thresholds read from code.
# separates Genesis ecology from the Sandbox/Tribulation physics loop.
@fig("text-cultivation-materials")
def materials(lang):
    s = Svg(424, title=T(lang, "材料入口与七条温度转化", "Material inputs and seven temperature rules"))
    s.label(24, 30, T(lang, "材料入口", "MATERIAL INPUTS"))
    s.label(400, 30, T(lang, "温度转化 · 渡劫与沙盘", "TEMPERATURE RULES · TWO PHYSICS SCENES"))
    s.box(24, 56, 338, 76, T(lang, "渡劫", "Tribulation"),
          T(lang, "水 · 火 · 金 · 木", "Water · Fire · Metal · Wood"))
    s.box(24, 156, 338, 76, T(lang, "沙盘", "Sandbox"),
          T(lang, "汽 · 水 · 冰 · 火 · 雷 · 木 · 金", "Vapor · Water · Ice · Fire\nLightning · Wood · Metal"))
    s.box(24, 256, 338, 90, T(lang, "创世 · 自动生态", "Genesis · automatic ecology"),
          T(lang, "沙 · 水 · 菌 · 苔 · 虫 · 粪 · 骸\n石只作装饰，不参与生态", "Sand · Water · Fungus · Moss\nBug · Dung · Remains, with decorative stone"))
    s.text(24, 376, T(lang, "入口分场景，创世另走生态规则", "Inputs differ by scene, Genesis has its own rules"), "t-small t-soft")
    s.text(24, 398, T(lang, "不能自由输入任意文字", "No free text input"), "t-small t-soft")

    s.text(436, 62, T(lang, "原材料", "MATERIAL"), "t-small t-soft", "middle")
    s.text(574, 62, T(lang, "温度（K）", "TEMPERATURE (K)"), "t-small t-soft", "middle")
    s.text(764, 62, T(lang, "变化后", "BECOMES"), "t-small t-soft", "middle")
    rows = [
        (T(lang, "水", "Water"), T(lang, "> 373", "> 373"), T(lang, "汽", "Vapor")),
        (T(lang, "汽", "Vapor"), T(lang, "< 280", "< 280"), T(lang, "水", "Water")),
        (T(lang, "水", "Water"), T(lang, "< 273", "< 273"), T(lang, "冰", "Ice")),
        (T(lang, "冰", "Ice"), T(lang, "> 273", "> 273"), T(lang, "水", "Water")),
        (T(lang, "木", "Wood"), T(lang, "> 600", "> 600"), T(lang, "火 + 灰", "Fire + Ash")),
        (T(lang, "固态金", "Solid metal"), T(lang, "> 1370", "> 1370"), T(lang, "液态金", "Liquid metal")),
        (T(lang, "液态金", "Liquid metal"), T(lang, "< 1370", "< 1370"), T(lang, "固态金", "Solid metal")),
    ]
    for i, (source, threshold, target) in enumerate(rows):
        y = 76 + i * 40
        s.line(400, y, 848, y, HAIR)
        s.text(436, y + 25, source, "t-small", "middle")
        s.text(574, y + 25, threshold, "t-num", "middle")
        if i == 4:
            s.box(684, y + 6, 160, 28, target, tcls="t-small", shade=25)
        else:
            s.text(764, y + 25, target, "t-small", "middle")
    s.line(400, 356, 848, 356, HAIR)
    s.text(400, 376, T(lang, "严格大于或小于，等于阈值时不变", "Strict inequalities, no change at equality"), "t-small t-soft")
    s.text(400, 398, T(lang, "这七条只列温度转化，不是全部更新规则", "Seven temperature rules, not the whole update loop"), "t-small t-soft")
    return s


# Mechanism sketch, not particle positions from a run.
# The outer radius is 48 px for local heat exchange. The inner radius is
# 36 px for fuel transfer, and only wood snapshot temperatures > 500 K qualify.
@fig("text-cultivation-fire-rule")
def fire_rule(lang):
    s = Svg(380, title=T(lang, "木与火之间的热交换和燃料转移", "Heat and fuel between wood and fire"))
    s.label(24, 30, T(lang, "一次局部交换", "ONE LOCAL EXCHANGE"))
    s.label(484, 30, T(lang, "木何时生火", "WHEN WOOD IGNITES"))
    s.line(456, 52, 456, 356, HAIR)

    # Spatial sketch at twice the displayed radius, with integer coordinates.
    s.circle(164, 172, 96, fill="url(#d6)", stroke=HAIR)
    s.circle(164, 172, 72, fill="url(#d12)", stroke=INK)
    s.box(140, 148, 48, 48, T(lang, "火", "Fire"), shade=25)
    s.box(208, 148, 48, 48, T(lang, "木", "Wood"))
    s.arrow(164, 132, 232, 132)
    s.text(198, 122, T(lang, "热", "Heat"), "t-small", "middle")
    s.arrow(232, 212, 164, 212)
    s.text(198, 234, T(lang, "燃料", "Fuel"), "t-small", "middle")
    s.line(239, 112, 274, 102, HAIR)
    s.text(284, 106, T(lang, "48 px", "48 px"), "t-num")
    s.text(284, 124, T(lang, "局部热交换", "Local heat"), "t-small t-soft")
    s.line(233, 142, 274, 150, INK)
    s.text(284, 154, T(lang, "36 px", "36 px"), "t-num")
    s.text(284, 172, T(lang, "取燃料", "Take fuel"), "t-small t-soft")
    s.text(24, 294, T(lang, "48 px 内选热交换评分最高的邻居", "Within 48 px, choose the top heat-exchange score"), "t-small t-soft")
    s.text(24, 316, T(lang, "取燃料要求木快照温度 > 500 K", "Fuel needs wood snapshot temperature > 500 K"), "t-small")
    s.text(24, 338, T(lang, "火最多存 5，每秒耗 1，耗尽删除", "Fire stores at most 5, uses 1/s, then is removed"), "t-small t-soft")

    s.box(484, 56, 364, 62, T(lang, "木温度 > 600 K", "Wood temperature > 600 K"),
          T(lang, "扣 0.3 质量，移交 1–5 燃料", "Transfer 0.3 mass and 1–5 fuel"), shade=25)
    s.text(536, 154, T(lang, "变化前", "Before"), "t-small t-soft", "middle")
    s.text(536, 202, T(lang, "木", "Wood"), "t-node", "middle")
    s.arrow(570, 194, 644, 194)
    s.text(692, 202, T(lang, "灰", "Ash"), "t-node", "middle")
    s.box(752, 158, 64, 48, T(lang, "火", "Fire"), shade=25)
    s.text(784, 138, T(lang, "生成火", "New fire"), "t-small t-soft", "middle")
    s.text(680, 234, T(lang, "木变灰，旁边生成火", "Wood becomes ash and creates fire"), "t-small", "middle")
    s.label(484, 278, T(lang, "燃料也可触发", "FUEL CAN ALSO TRIGGER"))
    s.text(484, 302, T(lang, "木燃料在本帧从 ≥ 0.5 跨到 < 0.5", "Wood fuel crosses from ≥ 0.5 to < 0.5 this frame"), "t-small")
    s.text(484, 324, T(lang, "同样生火并变灰", "Also creates fire and ash"), "t-small t-soft")
    return s


# Five original observations in the supplied excerpt of
# PROGRESS lines 194–205, an existing automatic experiment, not a human playtest.
# Values are hard-coded as (seconds after ignition, left x px, right x px).
# Do not add an observation at t=0, interpolate, or smooth these measurements.
FIRE_OBSERVATIONS = [(0.5, -63, 32), (1.0, -159, 159), (2.0, -287, 350), (3.1, -512, 480), (3.6, -639, 609)]


@fig("text-cultivation-fire-spread")
def fire_spread(lang):
    s = Svg(396, title=T(lang, "左右火头位置的五次观测", "Five observations of left and right fire fronts"))
    s.label(24, 30, T(lang, "自动实验 · 五次观测", "AUTOMATIC RUN · FIVE OBSERVATIONS"))
    s.rect(440, 19, 10, 10, fill=INK, stroke=None)
    s.text(460, 29, T(lang, "左火头", "Left front"), "t-small")
    s.rect(584, 19, 10, 10, fill=WHITE)
    s.dither(585, 20, 8, 8, 25)
    s.text(604, 29, T(lang, "右火头", "Right front"), "t-small")
    s.text(856, 57, T(lang, "横向位置 x（px）", "Horizontal position x (px)"), "t-small t-soft", "end")
    s.text(24, 81, T(lang, "点火后 s", "After fire, s"), "t-small t-soft")
    x0, x1 = 144, 800

    def xp(value):
        return x0 + round((value + 700) * (x1 - x0) / 1400)

    s.line(x0, 90, x1, 90)
    for value in (-700, -350, 0, 350, 700):
        x = xp(value)
        s.line(x, 85, x, 95)
        label = str(value) if value <= 0 else "+" + str(value)
        s.text(x, 78, T(lang, label, label), "t-num", "middle")
    s.line(xp(0), 100, xp(0), 346, HAIR, dash="3 4")
    for t, left, right in FIRE_OBSERVATIONS:
        y = 100 + round(t * 64)
        s.line(x0, y, x1, y, HAIR, dash="2 4")
        s.text(88, y + 4, T(lang, f"{t:.1f}", f"{t:.1f}"), "t-num", "end")
        xl, xr = xp(left), xp(right)
        s.rect(xl - 4, y - 4, 9, 9, fill=INK, stroke=None)
        s.rect(xr - 4, y - 4, 9, 9, fill=WHITE)
        s.dither(xr - 3, y - 3, 7, 7, 25)
        s.text(xl - 10, y + 4, T(lang, str(left), str(left)), "t-num", "end")
        s.text(xr + 10, y + 4, T(lang, "+" + str(right), "+" + str(right)), "t-num")
    s.text(24, 376, T(lang, "位置单位 px，左侧为负，右侧为正，没有补点", "Position in px, negative left and positive right, no added samples"), "t-small t-soft")
    return s


# An eleven-row summary of documented changes, not a commit timeline.
# Dates are unknown for v1–v8 and v9 itself. The v9 row names the v9.3 check
# date 2026-05-24; v10 and v11 checks/builds are 2026-07-26 and 2026-07-27.
@fig("text-cultivation-versions")
def versions(lang):
    s = Svg(660, title=T(lang, "第 1 至第 11 版的变化", "Changes from v1 through v11"))
    s.label(24, 30, T(lang, "十一版开发记录", "ELEVEN DOCUMENTED VERSIONS"))
    s.text(40, 62, T(lang, "版本", "VERSION"), "t-small t-soft")
    s.text(106, 62, T(lang, "主要变化", "MAIN CHANGE"), "t-small t-soft")
    s.text(458, 62, T(lang, "改动原因", "WHY"), "t-small t-soft")
    s.text(696, 62, T(lang, "记录日期", "RECORDED DATE"), "t-small t-soft")
    entries = [
        ("v1", T(lang, "战斗切片，剑、火与画面特效", "Combat slice with sword, fire and effects"), T(lang, "先让特效和镜头跑起来", "Make effects and camera run")),
        ("v2", T(lang, "独立 HUD 相机，粒子淡出", "Separate HUD camera, fading particles"), T(lang, "修正界面缩放与粒子消失", "Fix HUD scaling and particle fade")),
        ("v3", T(lang, "构建 WASM 浏览器版本", "Build WASM for the browser"), T(lang, "让 demo 在浏览器运行", "Run demo in the browser")),
        ("v4", T(lang, "字体裁剪，网页包体缩小", "Subset font and shrink web build"), T(lang, "移去没有用到的字形", "Remove unused glyphs")),
        ("v5", T(lang, "公共反应引擎、沙盘与渡劫", "Shared reactions, sandbox, tribulation"), T(lang, "先实验，再供关卡调用", "Test rules, then use in the level")),
        ("v6", T(lang, "修正字体初始化，程序包缩小", "Fix font init and shrink the build"), T(lang, "修正启动异常", "Fix the startup crash")),
        ("v7", T(lang, "共享字图集，减少视野外计算", "Shared atlas, less off-screen work"), T(lang, "减少渲染和计算开销", "Reduce rendering and computation")),
        ("v8", T(lang, "两字配方改为温度、电与运动", "Heat, charge and motion replace recipes"), T(lang, "让现象由材料状态产生", "Derive events from material state")),
        ("v9", T(lang, "创世及后续的参数、水与食物网", "Genesis, then parameters and ecology"), T(lang, "加入生态展示场景", "Add an ecology scene")),
        ("v10", T(lang, "玩家写字、灵力、死亡重开", "Player writing, mana, death and reset"), T(lang, "把渡劫变成可干预关卡", "Make tribulation a playable level")),
        ("v11", T(lang, "木排传火，燃料转移与数值上限", "Fire spread, fuel transfer and limits"), T(lang, "修正点不着木和数值溢出", "Fix failed ignition and overflow")),
    ]
    for i, (version, change, reason) in enumerate(entries):
        y = 78 + i * 48
        s.line(24, y, 856, y, HAIR)
        s.box(32, y + 8, 52, 30, T(lang, version, version), tcls="t-num", shade=25 if version in ("v8", "v11") else None)
        s.text(106, y + 28, change, "t-small")
        s.text(458, y + 28, reason, "t-small")
        if version == "v9":
            s.text(696, y + 20, T(lang, "v9 日期没查到", "v9 date not found"), "t-small t-soft")
            s.text(696, y + 37, T(lang, "v9.3 2026-05-24", "v9.3 2026-05-24"), "t-num")
        elif version == "v10":
            s.text(696, y + 28, T(lang, "2026-07-26", "2026-07-26"), "t-num")
        elif version == "v11":
            s.text(696, y + 28, T(lang, "2026-07-27", "2026-07-27"), "t-num")
        else:
            s.text(696, y + 28, T(lang, "没查到", "Not found"), "t-small t-soft")
    s.line(24, 606, 856, 606, HAIR)
    s.text(24, 636, T(lang, "日期来自文档验证或构建记录，不是提交日期", "Dates are document checks or builds, not commit dates"), "t-small t-soft")
    return s


if __name__ == "__main__":
    from figlib import inject
    from pathlib import Path
    inject([str(Path(__file__).with_name("index.html"))])
