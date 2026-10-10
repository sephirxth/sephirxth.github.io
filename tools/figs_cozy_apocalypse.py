from figlib import FAINT, HAIR, INK, PAPER, SOFT, WHITE, Svg, T, fig

"""Three figures drawn from the fact card and the supplied data copy."""
from figlib import FIGS, main


# 规则常量和公式，位置示意，没有实测轨迹。
# Rule parameters from fact card §3 items 17, 19–21; no measured trajectory.
@fig("cozy-apocalypse-beliefs")
def beliefs(lang):
    s = Svg(366, title=T(lang, "规则观测、预测误差与信念更新", "Rule observations, prediction error and belief updates"))
    s.label(24, 28, T(lang, "规则观测 o", "RULE OBSERVATION o"))
    s.label(316, 28, T(lang, "信念给出预测 p", "BELIEF GIVES p"))
    s.label(584, 28, T(lang, "平均误差的积累", "ACCUMULATING ERROR"))
    s.line(296, 42, 296, 250, HAIR)
    s.line(562, 42, 562, 250, HAIR)

    s.text(24, 53, T(lang, "礼物", "Gift"), "t-small t-soft")
    gifts = [(T(lang, "喜爱", "love"), 1.0, "1.00"),
             (T(lang, "喜欢", "like"), .75, ".75"),
             (T(lang, "不喜欢", "dislike"), .15, ".15")]
    times = [(T(lang, "昼", "day"), .35, ".35"),
             (T(lang, "暮", "dusk"), .62, ".62"),
             (T(lang, "夜", "night"), .90, ".90")]
    for y0, rows in ((64, gifts), (170, times)):
        for i, (word, value, number) in enumerate(rows):
            y = y0 + i * 25
            s.text(24, y + 13, word, "t-small")
            s.rect(112, y + 2, 112, 13, fill=WHITE, stroke=HAIR)
            s.dither(113, y + 3, round(110 * value), 11, 25)
            s.text(276, y + 13, number, "t-num", "end")
    s.line(24, 147, 276, 147, HAIR)
    s.text(24, 161, T(lang, "时段", "Phase"), "t-small t-soft")
    s.text(24, 252, T(lang, "规则把事件映射到 0–1", "Rules map events to 0–1"), "t-small t-soft")

    s.lines(316, 53, T(lang, ["常规事件取相关信念的均值", "p 与 o 都限制在 0–1"],
                                  ["Mean of relevant beliefs", "Both p and o are bounded to 0–1"]), "t-small t-soft", lh=18)
    s.circle(348, 117, 18, fill=WHITE)
    s.circle(512, 117, 18, fill=WHITE)
    s.text(348, 122, "p", "t-node", "middle")
    s.text(512, 122, "o", "t-node", "middle")
    s.line(372, 117, 488, 117, FAINT, dash="3 3")
    s.line(348, 150, 512, 150)
    s.line(348, 144, 348, 156)
    s.line(512, 144, 512, 156)
    s.text(430, 180, "e = |p − o|", "t-num", "middle")
    s.text(430, 202, T(lang, "只取差距，不保留正负", "Magnitude, without the sign"), "t-small", "middle")
    s.text(430, 225, T(lang, "无有效信念键的事件跳过", "Skip events without a valid key"), "t-small t-soft", "middle")
    s.text(430, 248, T(lang, "E 是有效事件的平均误差", "E is the mean valid-event error"), "t-small", "middle")

    s.text(584, 61, "S_new = .45 S_old + E", "t-num")
    s.lines(584, 82, T(lang, ["S 是惊讶值", "保留旧值，再加入本次误差"],
                                  ["S is surprise", "Retain part of S, add this error"]), "t-small t-soft", lh=18)
    s.text(584, 130, "F_new = .72 F_old + E × step", "t-num")
    s.lines(584, 151, T(lang, ["F 是误差积累数值", "step 为实际更新间隔，取非负值"],
                                   ["F is a stored error total", "step is the nonnegative tick interval"]), "t-small t-soft", lh=18)
    s.lines(584, 204, T(lang, ["S / F 的内部值不封顶为 1", "群体情绪还会继续影响 F"],
                                   ["S / F are not capped at 1", "Group emotion also affects F"]), "t-small t-soft", lh=18)

    s.line(24, 270, 856, 270, HAIR)
    s.label(24, 296, T(lang, "信念更新", "BELIEF UPDATE"))
    s.text(210, 296, "b_new = clamp(b_old + .35 × (o − b_old), 0, 1)", "t-num")
    s.text(24, 320, T(lang, "b 保持在 0–1，每次沿观测方向走完差距的 35%。",
                            "b stays in 0–1 and moves 35% of the gap toward the observation."), "t-small")
    s.text(24, 349, T(lang, "规则参数与机制示意，没有实测轨迹，也不代表完整理论实现。",
                            "Rule parameters and a mechanism schematic; no measured trajectory or claim of a complete theory."), "t-small t-soft")
    return s


# 两条活动路径、候选公式与固定结算的静态查证。
# No prediction–outcome error comparison or error writeback was found.
@fig("cozy-apocalypse-actions")
def actions(lang):
    s = Svg(380, title=T(lang, "两条活动路径与候选评分", "Two activity paths and candidate scoring"))
    s.label(24, 29, T(lang, "旧规则活动", "OLD RULE PATH"))
    s.text(168, 29, T(lang, "约 .75 秒刷新", "refresh ≈ .75 s"), "t-small")
    s.arrow(277, 25, 316, 25)
    s.text(330, 29, T(lang, "规则评分 + 可选建议", "rule score + optional hints"), "t-small")
    s.arrow(526, 25, 566, 25)
    s.text(580, 29, T(lang, "原有活动", "existing activities"), "t-small")
    s.line(24, 48, 856, 48, HAIR)

    s.label(24, 81, T(lang, "切换时启动候选", "AT PHASE CHANGE"))
    s.text(24, 107, T(lang, "昼 → 暮 → 夜", "day → dusk → night"), "t-small")
    s.lines(24, 137, T(lang, ["可选外部语言模型给出候选", "缺接口时回退本地候选"],
                                  ["Optional language-model candidates", "No interface: use local candidates"]), "t-small t-soft", lh=20)
    s.arrow(120, 168, 120, 190)
    for i in (2, 1, 0):
        s.rect(44 + 7 * i, 196 + 7 * i, 152, 42, fill=WHITE)
    s.text(120, 221, T(lang, "最多 3 个候选", "up to 3 candidates"), "t-small", "middle")
    s.arrow(210, 217, 242, 217)
    s.text(24, 270, T(lang, "两条路径保留不同的活动入口", "The paths keep separate activity entries"), "t-small t-soft")

    s.label(254, 81, T(lang, "预测结果 b′", "PREDICTED b′"))
    s.text(254, 107, "b′ = clamp(b + Δ, 0, 1)", "t-num")
    s.text(254, 132, T(lang, "Δ 是预测的信念变化", "Δ is the predicted belief change"), "t-small t-soft")
    s.rect(272, 153, 172, 12, fill=WHITE, stroke=HAIR)
    s.dither(273, 154, 170, 10, 12)
    s.line(272, 148, 272, 171)
    s.line(444, 148, 444, 171)
    s.text(272, 190, "0", "t-num", "middle")
    s.text(444, 190, "1", "t-num", "middle")
    s.text(254, 214, T(lang, "外部 Δ 限在 −.2 至 .2", "External Δ is limited to ±.2"), "t-small t-soft")
    s.text(254, 237, "u(b) = 1 − 2|b − .5|", "t-num")
    s.text(254, 257, T(lang, "u 是不确定性替代量", "u is an uncertainty proxy"), "t-small t-soft")
    s.line(278, 280, 438, 280, HAIR)
    s.path([(278, 280), (358, 265), (438, 280)])
    s.text(278, 295, "0", "t-num", "middle")
    s.text(358, 295, ".5", "t-num", "middle")
    s.text(438, 295, "1", "t-num", "middle")
    s.arrow(460, 169, 492, 169)

    s.label(514, 81, T(lang, "候选分数 G", "CANDIDATE SCORE G"))
    s.text(514, 111, "G = Σ w (b′ − preferred)²", "t-num")
    s.text(546, 132, T(lang, "偏好偏离，越大越不利", "Preference gap: larger is worse"), "t-small t-soft")
    s.text(542, 160, "− .3 Σ w [u(b) − u(b′)]", "t-num")
    s.text(546, 181, T(lang, "不确定性降低越多，扣得越多", "Uncertainty reduction lowers G"), "t-small t-soft")
    s.text(514, 206, T(lang, "preferred 是期望，w 是重要程度", "preferred is the target; w is importance"), "t-small t-soft")
    s.line(514, 223, 856, 223, HAIR)
    s.text(672, 246, "Pr ∝ exp(−4G)", "t-num", "middle")
    s.text(672, 267, T(lang, "G 越低越有利，随机抽取一个", "Lower G is favored; sample one"), "t-small", "middle")
    s.arrow(672, 275, 672, 300)

    s.box(576, 300, 192, 45, T(lang, "执行活动", "Execute activity"), tcls="t-small", shade=25)
    s.arrow(576, 322, 536, 322)
    s.box(342, 300, 194, 45, T(lang, "固定结果表", "Fixed outcome table"), tcls="t-small")
    s.arrow(342, 322, 302, 322)
    s.box(108, 300, 194, 45, T(lang, "回写信念 b", "Update belief b"), tcls="t-small")
    s.text(24, 361, T(lang, "活动结果直接加到信念，未查到预测与结果的误差比较和回写。",
                            "Fixed outcomes update beliefs; no prediction–outcome error comparison or writeback was found."), "t-small t-soft")
    s.text(24, 375, T(lang, "规则参数与机制示意，未运行验证。",
                            "Rule parameters and a mechanism schematic; runtime behavior was not verified."), "t-small t-soft")
    return s


# Day lengths and the progress formula are the constants in the game's code
# (day 300 s, dusk 180 s, night 120 s; weights 0.40 / 0.25 / 0.18 / 0.10 / 0.07).
@fig("cozy-apocalypse-day")
def cozy_day(lang):
    s = Svg(316, title=T(lang, "一天十分钟，进度看五样", "A ten-minute day and the five things that count"))
    x0, w = 40, 800
    s.label(x0, 34, T(lang, "一天", "ONE DAY"))
    s.text(x0 + (46 if lang == "zh" else 80), 34, T(lang, "默认速度下 10 分钟", "10 minutes at default speed"), "t-small t-soft")
    y = 52
    parts = [(300, None, T(lang, "昼", "Day"), T(lang, "出去拾荒、探索、推任务", "scavenge, explore, push quests")),
             (180, 25, T(lang, "暮", "Dusk"), T(lang, "修补、加固、储备", "repair, reinforce, stock up")),
             (120, 75, T(lang, "夜", "Night"), T(lang, "篝火边和镇民说话", "talk at the campfire"))]
    x = x0
    for sec, lv, name, what in parts:
        pw = round(w * sec / 600)
        s.rect(x, y, pw + 1, 30, fill=WHITE)
        if lv:
            s.dither(x + 1, y + 1, pw - 1, 28, lv)
        s.text(x + 10, y + 52, name, "t-node")
        s.text(x + 10, y + 70, what, "t-small t-soft")
        s.text(x + pw - 6, y + 52, T(lang, f"{sec // 60} 分钟", f"{sec // 60} min"), "t-num", "end")
        x += pw
    y = 190
    s.line(x0, y - 34, x0 + w, y - 34, HAIR)
    s.label(x0, y - 10, T(lang, "复兴进度", "RECOVERY"))
    s.text(x0 + (72 if lang == "zh" else 84), y - 10, T(lang, "五项加权，每项封顶，加到 1 进结局", "five capped terms, weighted; the ending comes at 1"), "t-small t-soft")
    terms = [(40, 75, T(lang, "好感", "Affinity"), T(lang, "三位镇民合计 210", "210 across three people")),
             (25, 50, T(lang, "建筑", "Buildings"), T(lang, "7 种关键设施", "7 key kinds")),
             (18, 25, T(lang, "任务", "Quests"), T(lang, "9 项", "9 done")),
             (10, 12, T(lang, "灯笼", "Lanterns"), T(lang, "8 盏", "8 lit")),
             (7, None, T(lang, "共餐", "Meals"), T(lang, "5 次", "5 shared"))]
    x = x0
    for i, (pct, lv, name, full) in enumerate(terms):
        pw = round(w * pct / 100)
        s.rect(x, y, pw + 1, 30, fill=WHITE)
        if lv:
            s.dither(x + 1, y + 1, pw - 1, 28, lv)
        s.rect(x + pw / 2 - 17, y + 8, 35, 15, fill=WHITE, stroke=None)
        s.text(x + pw / 2 + .5, y + 20, f".{pct:02d}", "t-num", "middle", INK)
        s.text(x + 2, y + 52, name, "t-small")
        s.text(x + 2, y + 69, full, "t-small t-soft") if pw > 70 else s.text(x + 2, y + 69, full, "t-small t-soft")
        x += pw
    s.arrow(x0, 292, x0 + 40, 292)
    s.text(x0 + 50, 296, T(lang, "进度到 1 触发结局，之后在同一个世界里继续经营。", "At 1 the ending plays, and you keep running the same world afterwards."), "t-small")
    return s
