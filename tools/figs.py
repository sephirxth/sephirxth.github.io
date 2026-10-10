#!/usr/bin/env python3
"""Draw the diagrams and charts on the project pages. No dependencies.

    python3 tools/figs.py            # redraw every figure inside the pages
    python3 tools/figs.py --list     # list figure ids

Each figure is a function of the language ("zh" or "en"). The words of both
languages sit side by side in the code, so a change to one is hard to forget in
the other. See tools/figlib.py for the drawing kit and for how a page marks the
place a figure goes.
"""
from figlib import FAINT, HAIR, INK, PAPER, SOFT, WHITE, Svg, T, fig, main


def car(s, x, y, w=18, h=8, kind="up"):
    """A vehicle seen from above. 'up' is solid, 'down' is dithered, 'mark' is the one to watch."""
    if kind == "up":
        s.rect(x, y, w, h, fill=INK, stroke=None)
    elif kind == "down":
        s.rect(x, y, w, h, fill=WHITE)
        s.dither(x, y, w, h, 50)
        s.rect(x, y, w, h)
    elif kind == "plain":
        s.rect(x, y, w, h, fill=WHITE)
    else:
        s.rect(x, y, w, h, fill=WHITE)
        s.dither(x, y, w, h, 25)
        s.rect(x, y, w, h, width=1)
        s.rect(x - 3, y - 3, w + 6, h + 6, dash="2 2")


def signal(s, x, y, stop=True):
    """A signal head on a short post. Solid means stop, hollow means go."""
    s.line(x, y, x, y - 14)
    s.circle(x + .5, y - 18, 4, fill=INK if stop else WHITE)


# ============================================================ one lane, two directions

@fig("one-lane-plan")
def one_lane_plan(lang):
    s = Svg(292, title=T(lang, "单车道便道的平面示意", "Plan of a single-lane access road"))
    top, bot = 142, 162
    bays = [190, 448, 706]
    half, taper, lift = 40, 16, 24
    pts = [(40, bot), (856, bot), (856, top)]
    for b in reversed(bays):
        pts += [(b + half + taper, top), (b + half, top - lift), (b - half, top - lift), (b - half - taper, top)]
    pts.append((40, top))
    s.poly(pts, fill=WHITE, stroke=INK)
    for b in bays:                                    # the edge between through lane and bay
        s.line(b - half - taper + 6, top, b + half + taper - 6, top, HAIR, dash="4 4")
    # a convoy going right holds the lane at the middle bay while the opposing one waits inside the
    # bay; its tail is still in the section behind it, and the next opposing convoy waits one bay on
    for i in range(4):
        car(s, 400 + i * 26, top + 6, kind="up")
    for i in range(3):
        car(s, 412 + i * 26, top - lift + 8, kind="down")
    for i in range(3):
        car(s, 282 + i * 26, top + 6, kind="up")
    for i in range(3):
        car(s, 670 + i * 26, top - lift + 8, kind="down")
    s.arrow(400, bot + 18, 452, bot + 18)
    s.arrow(282, bot + 18, 334, bot + 18)
    ends = [(bays[0] - half - taper - 8, True), (bays[0] + half + taper + 8, True),
            (bays[1] - half - taper - 8, True), (bays[1] + half + taper + 8, False),
            (bays[2] - half - taper - 8, True), (bays[2] + half + taper + 8, True)]
    for x, stop in ends:                              # a signal at each end of every single-lane section
        signal(s, x, top - 4, stop)
    for b in bays:
        for x in (b - half - taper - 28, b + half + taper + 28):
            s.line(x, top + 2, x, bot - 2, INK, dash="2 2")
    for b in bays:
        s.label(b, top - lift - 38, T(lang, "错车点", "PASSING BAY"), "middle")
        s.line(b, top - lift - 32, b, top - lift - 4, FAINT)
    for a, b in ((bays[0], bays[1]), (bays[1], bays[2])):
        x1, x2 = a + half + taper + 4, b - half - taper - 4
        s.line(x1, bot + 46, x2, bot + 46, FAINT)
        s.line(x1, bot + 40, x1, bot + 52, FAINT)
        s.line(x2, bot + 40, x2, bot + 52, FAINT)
        s.label((x1 + x2) / 2, bot + 68, T(lang, "单车道区间", "SINGLE LANE"), "middle")
    y = 270
    items = [("up", T(lang, "上行车队", "convoy going up")), ("down", T(lang, "下行车队", "convoy going down")),
             ("stop", T(lang, "停", "stop")), ("go", T(lang, "行", "go")), ("det", T(lang, "检测断面", "detector"))]
    x = 40
    for kind, word in items:
        if kind in ("up", "down"):
            car(s, x, y - 8, kind=kind); x += 26
        elif kind in ("stop", "go"):
            s.circle(x + 4.5, y - 4, 4, fill=INK if kind == "stop" else WHITE); x += 16
        else:
            s.line(x + 4, y - 10, x + 4, y + 2, INK, dash="2 2"); x += 14
        s.text(x, y, word, "t-small")
        x += (len(word) * (12.5 if lang == "zh" else 6.4)) + 26
    return s


# ============================================================ emergence in lane changing

@fig("lane-change-wave")
def lane_change_wave(lang):
    s = Svg(338, title=T(lang, "一次换道引起的减速往后传", "One lane change and the slowdown that travels back"))
    x0, x1 = 120, 852
    rows = [56, 152, 248]
    names = [T(lang, "换道之前", "BEFORE"), T(lang, "换进空当", "INTO THE GAP"), T(lang, "几秒之后", "SECONDS LATER")]
    # car positions (x of rear end) per row: (slow lane, fast lane, marked car lane/pos)
    slow = [[640, 596, 508, 464, 420, 330, 240, 150], [668, 624, 500, 456, 412, 322, 232, 142], [700, 656, 520, 476, 432, 342, 252, 162]]
    fast = [[760, 668, 576, 484, 392, 300, 208], [800, 708, 616, 500, 408, 316, 224], [822, 740, 660, 560, 520, 482, 446, 380, 290, 196]]
    mark = [(552, "slow"), (566, "fast"), (612, "fast")]
    for r, y in enumerate(rows):
        s.label(48, y + 30, names[r])
        s.rect(x0, y, x1 - x0, 44, fill=WHITE)
        s.line(x0 + 1, y + 22, x1 - 1, y + 22, HAIR, dash="10 8")
        s.rect(712 if r == 0 else (740 if r == 1 else 772), y + 6, 46, 10, fill=INK, stroke=None)      # the slow truck
        for x in slow[r]:
            if x != mark[r][0]:
                car(s, x, y + 6, 22, 10, "plain")
        for x in fast[r]:
            car(s, x, y + 28, 22, 10, "plain")
        mx, lane = mark[r]
        car(s, mx, y + (6 if lane == "slow" else 28), 22, 10, "mark")
    # annotations
    s.arrow(563, rows[0] + 20, 563, rows[0] + 40)
    s.text(712 + 23, rows[0] - 8, T(lang, "慢车", "slow truck"), "t-small t-soft", "middle")
    s.text(563, rows[0] - 8, T(lang, "想换道的车", "the car that wants out"), "t-small t-soft", "middle")
    s.text(511, rows[1] + 62, T(lang, "后车被迫刹车", "the car behind has to brake"), "t-small", "middle")
    s.line(511, rows[1] + 40, 511, rows[1] + 50, FAINT)
    x_a, x_b = 446, 582
    s.line(x_a, rows[2] + 52, x_b, rows[2] + 52, INK)
    s.line(x_a, rows[2] + 46, x_a, rows[2] + 58, INK)
    s.line(x_b, rows[2] + 46, x_b, rows[2] + 58, INK)
    s.text((x_a + x_b) / 2, rows[2] + 72, T(lang, "挤成一串，减速继续往后传", "bunched up, and the slowdown keeps moving back"), "t-small", "middle")
    s.arrow(430, rows[2] + 52, 372, rows[2] + 52)
    s.arrow(820, 24, 852, 24)
    s.text(812, 28, T(lang, "行驶方向", "direction of travel"), "t-small t-soft", "end")
    return s


# ============================================================ passing the tests

@fig("tests-vs-model")
def tests_vs_model(lang):
    s = Svg(316, title=T(lang, "通过测试和建对模型不是一回事", "Passing the tests and building the right model are different things"))
    y = 36
    s.box(40, y, 190, 64, T(lang, "一段文字", "A paragraph"), T(lang, "描述一个调度问题", "describing a scheduling problem"))
    s.arrow(230, y + 32, 270, y + 32)
    s.box(270, y, 130, 64, T(lang, "大模型", "LLM"), T(lang, "读题，建模", "reads it, models it"), shade=25)
    s.arrow(400, y + 32, 440, y + 32)
    s.box(440, y, 216, 64, T(lang, "优化模型", "Optimization model"), T(lang, "变量、约束、目标", "variables, constraints, objective"))
    s.arrow(548, y + 64, 548, 160)
    ya, yb = 172, 244
    s.box(440, 160, 216, 128, T(lang, "求解", "Solve"))
    s.box(170, ya, 230, 44, T(lang, "测试里的那组数", "The numbers in the test"), tcls="t-small")
    s.box(170, yb, 230, 44, T(lang, "换一批数，题目不变", "New numbers, same problem"), tcls="t-small")
    s.arrow(400, ya + 22, 440, ya + 22)
    s.arrow(400, yb + 22, 440, yb + 22)
    s.arrow(656, ya + 22, 696, ya + 22)
    s.arrow(656, yb + 22, 696, yb + 22)
    s.path([(708, ya + 23), (718, ya + 33), (736, ya + 11)], width=2)            # a tick
    s.path([(710, yb + 12), (734, yb + 34)], width=2)                            # a cross
    s.path([(734, yb + 12), (710, yb + 34)], width=2)
    s.text(750, ya + 27, T(lang, "答案对上了", "answer matches"), "t-small")
    s.text(750, yb + 27, T(lang, "答案错了", "wrong answer"), "t-small")
    return s


# ============================================================ flow and dynamic difficulty
# Every number below is copied from the controller's source (its likelihood tables,
# preferences, starting belief and parameter limits). Nothing here is measured play.

FLOW_STATES = lambda lang: [T(lang, "焦虑", "ANXIETY"), T(lang, "心流", "FLOW"), T(lang, "无聊", "BOREDOM")]
FLOW_A = {
    "hp": [[.6, .05, 0], [.3, .15, 0], [.1, .6, .1], [0, .2, .3], [0, 0, .6]],
    "enc": [[.7, .1, 0], [.3, .7, .1], [0, .2, .4], [0, 0, .5]],
    "streak": [[.5, 0, .4], [.3, .1, .1], [.1, .3, .1], [.1, .4, .1], [0, .2, .3]],
}
FLOW_PRIOR = [.1, .8, .1]


def shade_of(p):
    """Probability to dither level."""
    return None if p == 0 else 6 if p <= .1 else 12 if p <= .2 else 25 if p <= .35 else 50 if p <= .55 else 75


@fig("flow-loop")
def flow_loop(lang):
    s = Svg(372, title=T(lang, "控制回路", "The control loop"))
    s.rect(544, 30, 328, 322, fill="none", stroke=FAINT, dash="4 4")
    s.label(556, 22, T(lang, "控制器", "THE CONTROLLER"))
    s.box(40, 52, 190, 64, T(lang, "玩家", "Player"), T(lang, "移动，选升级", "moves, picks upgrades"))
    s.box(280, 52, 220, 64, T(lang, "战况", "The fight"), T(lang, "血量、敌人位置、击杀", "health, enemy positions, kills"))
    s.box(560, 52, 296, 64, T(lang, "三个信号，各自分档", "Three signals, binned"), T(lang, "血量 5 档 · 包围 4 档 · 连杀 5 档", "health 5 · encirclement 4 · kill streak 5"), shade=25)
    s.box(560, 160, 296, 64, T(lang, "信念", "Belief"), T(lang, "焦虑、心流、无聊，三个概率", "anxiety, flow, boredom: three probabilities"), shade=25)
    s.box(560, 268, 296, 64, T(lang, "给 7 个动作打分，抽一个", "Score 7 actions, sample one"), T(lang, "预期的观测离想看到的有多远", "how far the expected fight is from the wanted one"), shade=25)
    s.box(280, 268, 220, 64, T(lang, "三个旋钮", "Three knobs"), T(lang, "刷怪间隔 · 回血掉落 · 掉落物寿命", "spawn gap · heal drops · pickup lifetime"))
    s.box(40, 268, 190, 64, T(lang, "刷怪和掉落", "Spawns and drops"))
    s.arrow(230, 84, 280, 84)
    s.arrow(500, 84, 560, 84)
    s.arrow(708, 116, 708, 160)
    s.arrow(708, 224, 708, 268)
    s.arrow(560, 300, 500, 300)
    s.arrow(280, 300, 230, 300)
    s.elbow([(135, 268), (135, 192), (390, 192), (390, 116)])
    s.text(262, 182, T(lang, "每 60 次更新走一圈，大约一秒", "one lap every 60 updates, about a second"), "t-small t-soft", "middle")
    return s


@fig("flow-likelihood")
def flow_likelihood(lang):
    s = Svg(338, title=T(lang, "三个信号在三种状态下各有多大可能", "How likely each reading is under each state"))
    tables = [
        ("hp", T(lang, "血量", "HEALTH"), T(lang, "当前血量 / 上限", "current / max"),
         [T(lang, "危急", "critical"), T(lang, "低", "low"), T(lang, "中", "mid"), T(lang, "偏高", "upper"), T(lang, "高", "high")],
         ["<20%", "20–40%", "40–60%", "60–80%", "≥80%"], [2]),
        ("enc", T(lang, "包围", "ENCIRCLEMENT"), T(lang, "8 个方向里几个有敌人", "of 8 directions, how many hold an enemy"),
         [T(lang, "围死", "tight"), T(lang, "有缺口", "gaps"), T(lang, "松散", "loose"), T(lang, "空旷", "open")],
         ["7–8", "5–6", "3–4", "0–2"], [1]),
        ("streak", T(lang, "连杀", "KILL STREAK"), T(lang, "上次挨打之后杀了几个", "kills since last being hit"),
         ["0–2", "3–5", "6–10", "11–15", "≥16"], ["", "", "", "", ""], [3, 4]),
    ]
    cw, ch, lab = 56, 30, 98
    x = 24
    for key, name, sub, rows, ranges, liked in tables:
        s.label(x, 34, name)
        s.text(x, 52, sub, "t-small t-soft")
        gx, gy = x + lab, 96
        for j, st in enumerate(FLOW_STATES(lang)):
            s.text(gx + j * cw + cw / 2, gy - 10, st, "t-small" if lang == "zh" else "t-caps t-tiny", "middle")
        for i, row in enumerate(FLOW_A[key]):
            yy = gy + i * ch
            if i in liked:
                s.poly([(x, yy + 9), (x + 7, yy + 15), (x, yy + 21)], INK)
            s.text(x + 12, yy + 19, rows[i], "t-small")
            s.text(gx - 8, yy + 19, ranges[i], "t-num", "end")
            for j, p in enumerate(row):
                cx = gx + j * cw
                s.rect(cx, yy, cw + 1, ch + 1, fill=WHITE)
                lv = shade_of(p)
                if lv:
                    s.dither(cx + 1, yy + 1, cw - 1, ch - 1, lv)
                if p:
                    s.rect(cx + 13, yy + 8, 31, 15, fill=WHITE, stroke=None)
                    s.text(cx + cw / 2 + .5, yy + 20, f"{p:.2f}".lstrip("0") if p < 1 else "1", "t-num", "middle", INK)
        x += lab + 3 * cw + 20
    s.poly([(24, 296), (31, 302), (24, 308)], INK)
    s.text(38, 306, T(lang, "控制器最想看到的那一档", "the reading the controller most wants to see"), "t-small t-soft")
    lx = T(lang, 300, 380)
    for lv, word in ((6, "≤.10"), (12, "≤.20"), (25, "≤.35"), (50, "≤.55"), (75, ">.55")):
        s.rect(lx, 294, 22, 15, fill=WHITE)
        s.dither(lx + 1, 295, 20, 13, lv)
        s.text(lx + 28, 306, word, "t-num")
        lx += 76
    return s


@fig("flow-beliefs")
def flow_beliefs(lang):
    s = Svg(312, title=T(lang, "六种战况各被读成什么", "What six situations are read as"))
    cases = [((0, 0, 0), T(lang, "血量危急，被围死，连杀 0–2", "health critical, tight ring, streak 0–2")),
             ((1, 0, 2), T(lang, "血量低，被围死，连杀 6–10", "health low, tight ring, streak 6–10")),
             ((1, 1, 1), T(lang, "血量低，有缺口，连杀 3–5", "health low, gaps, streak 3–5")),
             ((2, 1, 3), T(lang, "血量中，有缺口，连杀 11–15", "health mid, gaps, streak 11–15")),
             ((3, 2, 4), T(lang, "血量偏高，松散，连杀 16 以上", "health upper, loose, streak 16+")),
             ((4, 3, 0), T(lang, "血量高，四周空旷，连杀 0–2", "health high, open field, streak 0–2"))]
    bx, bw = 330, 400
    for j, (st, lv) in enumerate(zip(FLOW_STATES(lang), (75, None, 25))):
        x = bx + (0, 150, 290)[j]
        s.rect(x, 26, 22, 15, fill=WHITE)
        if lv:
            s.dither(x + 1, 27, 20, 13, lv)
        s.text(x + 30, 38, st, "t-small" if lang == "zh" else "t-caps t-tiny")
    for i, ((h, e, k), words) in enumerate(cases):
        y = 66 + i * 38
        q = [FLOW_PRIOR[n] * (FLOW_A["hp"][h][n] + 1e-16) * (FLOW_A["enc"][e][n] + 1e-16) * (FLOW_A["streak"][k][n] + 1e-16) for n in range(3)]
        z = sum(q)
        q = [v / z for v in q]
        s.text(bx - 16, y + 16, words, "t-small", "end")
        s.rect(bx, y, bw + 1, 24, fill=WHITE)
        x = bx
        for n, lv in enumerate((75, None, 25)):
            w = round(bw * q[n])
            if lv and w > 1:
                s.dither(x + 1, y + 1, w - 1, 22, lv)
            if 0 < n and 1 < w < bw and x > bx:
                s.line(x, y, x, y + 24)
            x += w
        s.text(bx + bw + 16, y + 16, " / ".join(f"{v:.2f}" for v in q), "t-num")
    return s


@fig("flow-knobs")
def flow_knobs(lang):
    s = Svg(318, title=T(lang, "控制器能动的三个参数", "The three parameters the controller can move"))
    x0, x1 = 316, 836
    knobs = [
        (T(lang, "刷怪间隔", "Spawn gap"), T(lang, "隔多少次更新出一个敌人", "updates between enemy spawns"), 5, 100, 60, 5,
         ["5", "100", "60"], T(lang, "动作 0：减 5，敌人更密", "action 0: minus 5, more enemies"), T(lang, "动作 1：加 5", "action 1: plus 5")),
        (T(lang, "回血掉落", "Heal drops"), T(lang, "击杀后掉回血的概率", "chance that a kill drops healing"), .01, .80, .05, .05,
         ["0.01", "0.80", "0.05"], T(lang, "动作 3：减 0.05", "action 3: minus 0.05"), T(lang, "动作 2：加 0.05", "action 2: plus 0.05")),
        (T(lang, "掉落物寿命", "Pickup lifetime"), T(lang, "掉在地上的东西留多久", "how long a drop stays on the ground"), 10, 60, 30, 5,
         [T(lang, "10 秒", "10 s"), T(lang, "60 秒", "60 s"), T(lang, "30 秒", "30 s")], T(lang, "动作 5：减 5 秒", "action 5: minus 5 s"), T(lang, "动作 4：加 5 秒", "action 4: plus 5 s")),
    ]
    for i, (name, sub, lo, hi, start, step, words, left, right) in enumerate(knobs):
        y = 62 + i * 82
        s.text(40, y - 2, name, "t-node")
        s.text(40, y + 18, sub, "t-small t-soft")
        f = lambda v: round(x0 + (x1 - x0) * (v - lo) / (hi - lo))
        s.line(x0, y, x1, y)
        n = round((hi - lo) / step)
        for k in range(n + 1):
            xx = f(min(hi, lo + k * step)) if lo != .01 else f(min(hi, round(.05 * k, 2)) if k else lo)
            s.line(xx, y - 3, xx, y + 4, FAINT)
        s.line(x0, y - 7, x0, y + 8)
        s.line(x1, y - 7, x1, y + 8)
        xs = f(start)
        s.dither(x0, y - 3, max(2, xs - x0), 7, 50)
        s.rect(xs - 4, y - 8, 9, 17, fill=INK, stroke=None)
        s.text(x0, y + 26, words[0], "t-num", "middle")
        s.text(x1, y + 26, words[1], "t-num", "middle")
        if xs - x0 < 70:
            s.text(xs + 22, y + 26, T(lang, "起始 ", "starts at ") + words[2], "t-num")
        else:
            s.text(xs, y + 26, T(lang, "起始 ", "starts at ") + words[2], "t-num", "middle")
        s.text(xs - 14, y - 16, "← " + left, "t-small", "end") if xs - x0 > 150 else s.text(x0, y - 16, "← " + left, "t-small")
        s.text(max(xs + 14, x0 + (190 if xs - x0 <= 150 else 0)), y - 16, right + " →", "t-small")
    s.text(40, 296, T(lang, "动作 6：这一圈什么都不改。", "Action 6: change nothing this lap."), "t-small t-soft")
    return s


# figures of the other project pages live in their own files
import figs_cozy_apocalypse  # noqa: E402,F401
import figs_intent_tree  # noqa: E402,F401
import figs_self_running_worlds  # noqa: E402,F401
import figs_text_cultivation  # noqa: E402,F401
import figs_theseus  # noqa: E402,F401

if __name__ == "__main__":
    main()
