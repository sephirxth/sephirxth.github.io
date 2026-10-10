from figlib import FAINT, HAIR, INK, PAPER, SOFT, WHITE, Svg, T, fig


# File dates for 2022/2024 are references, never project start dates.
@fig("self-running-worlds-timeline")
def worlds_timeline(lang):
    """Years and engines as the owner's own development notes record them; a solid frame means
    commits or files from that stage were found, a dashed one that only the notes mention it."""
    s = Svg(318, title=T(lang, "换过的引擎", "The engines along the way"))
    x0, x1, y = 60, 820, 150
    xx = lambda yr: round(x0 + (x1 - x0) * (yr - 2017) / 9)
    s.line(x0 - 20, y, x1 + 20, y)
    for yr in range(2017, 2027):
        s.line(xx(yr), y - 3, xx(yr), y + 4, FAINT)
    stages = [
        (2017, "Laya", T(lang, "开始想用格子和邻居写世界", "first notes on a world of cells"), False, True),
        (2018, "Phaser", T(lang, "换了引擎接着做", "carried on in another engine"), False, False),
        (2021, T(lang, "Unity、Bevy", "Unity, Bevy"), T(lang, "三维格子上的温度", "temperature on a 3D grid"), True, True),
        (2022, "Unity", T(lang, "二维生灭规则", "2D birth and death rule"), True, False),
        (2024, "Bevy", T(lang, "同一条生灭规则，比了几个引擎", "the same rule, engines compared"), True, True),
        (2026, "Bevy", T(lang, "沙漠里的水、热和化学反应", "water, heat and chemistry in a desert"), True, False),
    ]
    bw, bh = 236, 58
    for yr, engine, what, found, above in stages:
        x = xx(yr)
        bx = min(max(x - bw // 2, 24), 856 - bw)
        by = y - 30 - bh if above else y + 30
        s.line(x, y - 8, x, y + 9)
        s.line(x, by + bh if above else y + 9, x, y - 8 if above else by, FAINT)
        s.rect(bx, by, bw, bh, fill=WHITE, dash=None if found else "4 3")
        s.text(bx + 12, by + 23, str(yr), "t-num")
        s.text(bx + 52, by + 24, engine, "t-node")
        s.text(bx + 12, by + 45, what, "t-small t-soft")
    s.rect(24, 286, 22, 14, fill=WHITE)
    s.text(54, 298, T(lang, "找得到提交记录或文件", "commits or files found"), "t-small")
    lx = T(lang, 220, 250)
    s.rect(lx, 286, 22, 14, fill=WHITE, dash="4 3")
    s.text(lx + 30, 298, T(lang, "只在开发日志里有记录，原件没找到", "in the development notes only; originals not found"), "t-small")
    return s


# eight surrounding cells, self excluded; survival at 2/3, birth at 3.
# read the old grid, write the next grid, then exchange them.
# The 3×3 neighborhood is an explanatory diagram, not a historical run.
@fig("self-running-worlds-neighbors")
def self_running_worlds_neighbors(lang):
    s = Svg(372, title=T(lang, "八邻居生灭规则", "Birth and death with eight neighbors"))
    s.label(24, 30, T(lang, "八邻居生灭规则", "BIRTH AND DEATH WITH EIGHT NEIGHBORS"))
    s.text(24, 65, T(lang, "只数周边八格", "Count the eight surrounding cells"), "t-small")
    for row in range(3):
        for col in range(3):
            x, y = 48 + col * 48, 86 + row * 48
            center = row == 1 and col == 1
            s.rect(x, y, 48, 48, fill=WHITE)
            if center:
                s.text(x + 24, y + 29, T(lang, "本格", "self"), "t-small", "middle")
            else:
                s.circle(x + 24, y + 24, 5, fill=INK)
    s.text(120, 252, T(lang, "中心不计入", "The center is excluded"), "t-small t-soft", "middle")

    x0, label_w, cell_w = 248, 104, 56
    s.text(x0, 65, T(lang, "下一轮状态（按活邻居数）", "Next state by live neighbor count"), "t-small")
    s.rect(x0, 86, 608, 144, fill=WHITE)
    s.line(x0, 134, 856, 134, HAIR)
    s.line(x0, 182, 856, 182, HAIR)
    s.text(x0 + 12, 116, T(lang, "活邻居数", "Live count"), "t-small")
    s.text(x0 + 12, 164, T(lang, "当前活", "Alive now"), "t-small")
    s.text(x0 + 12, 212, T(lang, "当前死", "Dead now"), "t-small")
    for n in range(9):
        x = x0 + label_w + n * cell_w
        s.line(x, 86, x, 230, HAIR)
        s.text(x + 28, 116, str(n), "t-num", "middle")
        s.text(x + 28, 164, T(lang, "活", "alive") if n in (2, 3) else T(lang, "死", "dead"), "t-small", "middle")
        s.text(x + 28, 212, T(lang, "活", "alive") if n == 3 else T(lang, "死", "dead"), "t-small", "middle")
    s.box(248, 250, 286, 58, T(lang, "活格：2 或 3 个活邻居时保留", "Alive: survives with 2 or 3"),
          T(lang, "其余为死", "Otherwise dead"), shade=25, tcls="t-small")
    s.box(566, 250, 286, 58, T(lang, "死格：3 个活邻居时出生", "Dead: born with 3"),
          T(lang, "其余仍死", "Otherwise stays dead"), shade=25, tcls="t-small")
    s.text(24, 333, T(lang, "整轮读取旧格、写入新格，算完才交换。",
                     "Read the old grid, write the next grid, then exchange them."), "t-small t-soft")
    s.text(24, 358, T(lang, "格子仅作示意，不是历史运行结果。",
                     "The cells illustrate the neighborhood; they are not a historical run."), "t-small t-soft")
    return s


# copied verbatim from../data/ecs-capacity-presets.csv; no runtime CSV read.
# CSV fields: substrate, retention, permeability, catalysis
# These are base presets, not measurements or per-cell final values
@fig("self-running-worlds-ground")
def self_running_worlds_ground(lang):
    s = Svg(350, title=T(lang, "四种地表的基础参数", "Base parameters for four ground presets"))
    s.label(24, 30, T(lang, "四种地表的基础参数", "BASE PARAMETERS FOR FOUR GROUND PRESETS"))
    columns = [(184, T(lang, "保水 retention", "Retention")),
               (420, T(lang, "流动 permeability", "Permeability")),
               (656, T(lang, "催化 catalysis", "Catalysis"))]
    rows = [
        (T(lang, "沙地", "Sand"), ("0.14", "0.82", "0.07")),
        (T(lang, "岩石", "Rock"), ("0.05", "0.13", "0.18")),
        (T(lang, "黏土", "Clay"), ("0.76", "0.2", "0.46")),
        (T(lang, "反光平地", "Reflective flat"), ("0.08", "0.34", "0.03")),
    ]
    for x, title in columns:
        s.text(x + 76, 61, title, "t-small", "middle")
        s.line(x, 80, x + 152, 80, HAIR)
        for end, number in ((x, "0"), (x + 152, "1")):
            s.line(end, 76, end, 85, HAIR)
            s.text(end, 98, number, "t-num", "middle")
    for row_i, (name, values) in enumerate(rows):
        y = 121 + row_i * 46
        s.text(24, y + 7, name, "t-small")
        for (x, _), raw in zip(columns, values):
            length = round(float(raw) * 152)
            s.line(x, y + 3, x + 152, y + 3, HAIR)
            s.dither(x, y - 6, length, 18, level=25)
            s.rect(x, y - 6, length, 18, fill="none", stroke=INK)
            s.text(x + 200, y + 7, raw, "t-num", "end")
    s.line(24, 292, 856, 292, HAIR)
    s.text(24, 313, T(lang, "基础预设值，每格还会加入扰动并限制范围。",
                     "Base presets; each cell also receives noise and clamping."), "t-small t-soft")
    s.text(24, 336, T(lang, "归一化参数，未校准物理单位。",
                     "Normalized parameters; physical units are not calibrated."), "t-small t-soft")
    return s


if __name__ == "__main__":
    import figlib
    import os
    figlib.inject([os.path.join(os.path.dirname(__file__), "index.html")])
