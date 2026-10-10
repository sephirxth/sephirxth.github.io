from figlib import FAINT, HAIR, INK, PAPER, SOFT, WHITE, Svg, T, fig


# A fictional example of the historical correction:
# each node represents an intent, and an edge records its source.
@fig("intent-tree-origin")
def intent_tree_origin(lang):
    s = Svg(336, title=T(lang, "意图从哪里分出来", "Where an intent comes from"))
    s.label(40, 32, T(lang, "虚构例子", "FICTIONAL EXAMPLE"))
    s.label(648, 32, T(lang, "另一个根", "ANOTHER ROOT"))

    s.box(232, 62, 220, 58, T(lang, "做一个小游戏", "Make a small game"))
    s.box(82, 180, 200, 58, T(lang, "设计关卡", "Design levels"), shade=25)
    s.box(362, 180, 200, 58, T(lang, "调试操作", "Debug controls"))
    s.line(342, 120, 342, 150)
    s.line(182, 150, 462, 150)
    s.line(182, 150, 182, 180)
    s.line(462, 150, 462, 180)
    s.label(182, 266, T(lang, "当前关注", "CURRENT FOCUS"), "middle")

    s.line(606, 54, 606, 272, HAIR, dash="4 4")
    s.box(648, 62, 200, 58, T(lang, "学做面包", "Learn to bake bread"))
    s.lines(748, 166, T(lang, "没有来源关系，\n就另开一棵树", "Without a source link,\nstart a separate tree"),
            "t-small t-soft", "middle", lh=18)

    s.text(40, 298, T(lang, "边表示来源，不代表聊天先后。", "Edges show origin, not chat order."), "t-small")
    s.text(40, 318, T(lang, "这是历史修正方向，自动判断没有验证过。", "This was the historical correction, automatic detection was not verified."), "t-small t-soft")
    return s


# Data: intent-tree-historical-counts.csv
# intent-tree-review-excerpt.txt lines 1, 5, 6 (original review lines 73, 77, 78).
# The node bars are exactly 608 px long, one pixel per node. The tree matrix
# has exactly 135 cells. These are distinct views, not additive categories.
@fig("intent-tree-history")
def intent_tree_history(lang):
    s = Svg(372, title=T(lang, "旧结构留下的统计", "Counts from the old structure"))
    s.label(40, 30, T(lang, "旧结构的历史统计", "HISTORICAL COUNTS"))
    s.text(40, 50, T(lang, "复盘汇总，本次未重新计数，也未读取原始意图数据。", "Review summary, not recounted here. Original intent data was not read."), "t-small t-soft")

    s.label(40, 84, T(lang, "节点", "NODES"))
    s.text(110, 84, T(lang, "608", "608"), "t-num")
    s.text(146, 84, T(lang, "个", "total"), "t-small t-soft")
    rows = [
        (108, 534, T(lang, "关系由程序写死", "Program-fixed relation")),
        (164, 517, T(lang, "没有父节点", "No parent node")),
    ]
    for y, count, label in rows:
        s.text(40, y + 16, label, "t-small")
        s.text(40, y + 35, T(lang, f"{count} / 608", f"{count} / 608"), "t-num")
        s.rect(240, y, 608, 24, fill=WHITE)
        s.dither(240, y, count, 24, 25)
        s.rect(240, y, 608, 24)
        s.line(240 + count, y, 240 + count, y + 24)

    s.line(40, 212, 848, 212, HAIR)
    s.label(40, 242, T(lang, "树", "TREES"))
    s.text(110, 242, T(lang, "135", "135"), "t-num")
    s.text(146, 242, T(lang, "棵", "total"), "t-small t-soft")
    s.text(40, 266, T(lang, "有父子边", "With parent-child edges"), "t-small")
    s.text(40, 288, T(lang, "7 / 135", "7 / 135"), "t-num")
    for i in range(135):
        x, y = 240 + (i % 27) * 22, 228 + (i // 27) * 18
        s.rect(x, y, 16, 16, fill=WHITE)
        if i < 7:
            s.dither(x + 1, y + 1, 14, 14, 25)
    s.text(240, 330, T(lang, "一格是一棵树，点纹标出有父子边的 7 棵。", "Each cell is a tree, 7 shaded cells have parent-child edges."), "t-small t-soft")
    s.text(40, 354, T(lang, "两条节点统计可能重叠，不相加，树的分母另计。", "The node counts may overlap. Trees have their own denominator."), "t-small t-soft")
    return s


# Historical mechanism: is a set of status
# names, not a transition diagram. supplies no formal command names.
# The historical closed status is rendered as plain Chinese "做完".
@fig("intent-tree-document")
def intent_tree_document(lang):
    s = Svg(376, title=T(lang, "当时怎样维护意图文档", "How the intent document was maintained"))
    s.label(40, 30, T(lang, "历史维护方式", "HISTORICAL MAINTENANCE"))

    s.box(40, 62, 164, 58, T(lang, "人", "Person"), T(lang, "表达想做什么", "states an intent"))
    s.box(40, 166, 164, 82, T(lang, "agent", "agent"),
          T(lang, "负责维护的程序\n更新这份文档", "the maintainer\nupdates the document"))
    s.arrow(122, 120, 122, 166)
    s.arrow(204, 207, 280, 207)
    s.lines(40, 278, T(lang, "新开、分叉、切换、结束时\n维护文档", "On a new intent, a branch,\na switch, or an ending"),
            "t-small t-soft", lh=18)

    # A document, with the same fictional game example visibly indented.
    s.box(280, 62, 328, 56, T(lang, "意图文档", "Intent document"), shade=25)
    s.rect(280, 118, 328, 190, fill=WHITE)
    s.text(304, 148, T(lang, "做一个小游戏", "Make a small game"), "t-small")
    s.line(318, 158, 318, 208, FAINT)
    s.line(318, 176, 330, 176, FAINT)
    s.line(318, 208, 330, 208, FAINT)
    s.text(336, 180, T(lang, "设计关卡", "Design levels"), "t-small")
    s.text(584, 180, T(lang, "活跃", "active"), "t-small t-soft", "end")
    s.text(336, 212, T(lang, "调试操作", "Debug controls"), "t-small")
    s.text(584, 212, T(lang, "挂起", "on hold"), "t-small t-soft", "end")
    s.text(304, 238, T(lang, "以上内容为虚构例子", "FICTIONAL EXAMPLE"), "t-small t-soft")
    s.line(296, 250, 592, 250, HAIR)
    s.label(304, 273, T(lang, "历史状态集合", "HISTORICAL STATES"))
    s.text(304, 295, T(lang, "活跃 · 挂起 · 做完 · 放弃", "active · on hold · closed · abandoned"), "t-small t-soft")

    s.box(680, 62, 176, 72, T(lang, "历史画布", "Past canvas"),
          T(lang, "显示人在追什么", "shows what a person seeks"))
    s.arrow(608, 98, 680, 98)
    s.box(680, 228, 176, 80, T(lang, "子 agent", "Sub-agent"),
          T(lang, "读取意图上下文\n历史上注入两份文档", "reads intent context\ntwo docs were supplied"))
    s.arrow(608, 268, 680, 268)

    s.text(40, 338, T(lang, "图中是历史关系，不表示当前接口。", "These are historical relationships, the current interface was not checked."), "t-small")
    s.text(40, 358, T(lang, "这里只列状态，完整的转换条件没有查到。", "Only the state set is shown, full transition rules were not found."), "t-small t-soft")
    return s


if __name__ == "__main__":
    from figlib import main
    main()
