from figlib import FAINT, HAIR, INK, PAPER, SOFT, WHITE, Svg, T, fig


# abstract event sheets, not sampled memory contents.
@fig("theseus-memory-evidence")
def theseus_memory_evidence(lang):
    s = Svg(376, title=T(lang, "受管长期笔记要引用原始事件", "Long-term notes must cite their source events"))
    s.label(24, 28, T(lang, "原始事件", "SOURCE EVENTS"))
    s.label(304, 28, T(lang, "提炼与写入", "EXTRACT AND WRITE"))
    s.label(550, 28, T(lang, "受管长期笔记", "MANAGED LONG-TERM NOTES"))

    # Staggered sheets show preserved event records without inventing their text.
    s.rect(36, 72, 212, 128, fill=WHITE)
    s.rect(30, 64, 212, 128, fill=WHITE)
    s.rect(24, 56, 212, 128, fill=WHITE)
    s.dither(36, 69, 34, 5, 25)
    s.text(36, 99, T(lang, "L1 · 原始事件", "L1 · Raw event"), "t-node")
    for y, end in ((118, 214), (132, 202), (146, 220)):
        s.line(36, y, end, y, HAIR)
    s.rect(36, 160, 8, 8, fill=INK, stroke=None)
    s.text(52, 168, T(lang, "事件引用", "Event citation"), "t-small t-soft")
    s.text(24, 218, T(lang, "事件只追加，保留原文", "Events are append-only"), "t-small")

    # A new sheet is appended, rather than overwriting the sheet above.
    s.rect(24, 240, 212, 56, fill=WHITE, dash="3 3")
    s.line(38, 259, 50, 259)
    s.line(44, 253, 44, 265)
    s.text(62, 263, T(lang, "追加新事件", "Append a new event"), "t-small")
    s.line(38, 278, 216, 278, HAIR)

    s.arrow(248, 103, 304, 103)
    s.box(304, 70, 194, 66, T(lang, "agent", "Agent"),
          T(lang, "提炼可复用认识", "Extract reusable knowledge"), shade=25)
    s.arrow(401, 136, 401, 230)
    s.box(304, 230, 194, 66, T(lang, "记忆命令行", "Memory CLI"),
          T(lang, "检查笔记中的引用", "Check note citations"), shade=25)

    # The content citation and --refs declaration must refer to the same event.
    s.elbow([(498, 263), (524, 263), (524, 116), (550, 116)])
    s.rect(550, 60, 170, 112, fill=WHITE)
    s.text(562, 87, T(lang, "有引用", "With citation"), "t-node")
    s.text(562, 110, T(lang, "正文引用原始事件", "Source cited in note"), "t-small")
    s.text(562, 130, T(lang, "--refs 声明同一事件", "Also declared in --refs"), "t-small")
    s.dither(562, 147, 20, 8, 25)
    s.line(589, 155, 706, 155, INK)
    s.arrow(720, 116, 750, 116)
    s.box(750, 86, 102, 60, "L2", T(lang, "写入", "Written"), shade=25)

    # The dashed arrow points from the stored L2 note back to L1 evidence.
    s.elbow([(801, 146), (801, 196), (264, 196), (264, 168), (248, 168)],
            color=SOFT, dash="4 4")
    s.text(678, 190, T(lang, "L2 → L1：引用", "L2 → L1: citation"),
           "t-small t-soft", "middle")

    s.arrow(498, 263, 550, 263)
    s.rect(550, 238, 170, 94, fill=WHITE)
    s.text(562, 265, T(lang, "缺引用", "No citation"), "t-node")
    s.line(562, 283, 704, 283, HAIR)
    s.line(562, 297, 684, 297, HAIR)
    s.rect(562, 309, 144, 9, fill=PAPER, stroke=HAIR, dash="2 2")
    s.arrow(720, 287, 750, 287)
    s.box(750, 255, 102, 64, T(lang, "拒绝", "Rejected"),
          T(lang, "退出码 2", "Exit code 2"))

    s.text(24, 346, T(lang,
           "remember --durable 同时留事件，并建立带引用的长期笔记。",
           "remember --durable creates an event and a cited long-term note."), "t-small t-soft")
    s.text(24, 365, T(lang,
           "L1 还有对话与附件，只追加规则针对事件。",
           "L1 also holds conversations and assets; the append-only rule applies to events."), "t-small t-soft")
    return s


# host entries reference a single source; no body copies.
@fig("theseus-shared-skills")
def theseus_shared_skills(lang):
    s = Svg(376, title=T(lang, "两个宿主入口引用同一份能力正文", "Two host entries reference the same skill source"))
    s.label(24, 28, T(lang, "登记与管理", "REGISTRY AND MANAGEMENT"))
    s.label(584, 28, T(lang, "同一份能力正文", "ONE SKILL SOURCE"))
    s.box(24, 52, 218, 72, T(lang, "登记表", "Registry"),
          T(lang, "记录状态与正源位置", "State and source location"))
    s.arrow(242, 88, 298, 88)
    s.box(298, 52, 218, 72, T(lang, "管理程序", "Manager"),
          T(lang, "定位正源，管理链接", "Locate source, manage links"), shade=25)

    # The folder and its document are one physical source, not a third host.
    s.dither(588, 68, 264, 200, 25)
    s.rect(584, 64, 108, 22, fill=WHITE)
    s.rect(584, 85, 264, 179, fill=WHITE)
    s.rect(610, 108, 212, 112, fill=PAPER)
    s.text(716, 140, T(lang, "能力正文", "Skill text"), "t-node", "middle")
    for y, end in ((160, 802), (174, 790), (188, 802), (202, 766)):
        s.line(630, y, end, y, HAIR)
    s.text(716, 245, T(lang, "撤链接时保留", "Kept when links are removed"),
           "t-small t-soft", "middle")

    # Manager actions end at each host entry; citation arrows point to source.
    s.elbow([(354, 124), (354, 172), (133, 172), (133, 210)])
    s.arrow(407, 124, 407, 210)
    s.text(24, 164, T(lang, "创建 / 撤销软链接", "Create / remove symbolic links"), "t-small")
    s.box(24, 210, 218, 66, T(lang, "宿主入口 A", "Host entry A"),
          T(lang, "软链接", "Symbolic link"))
    s.box(298, 210, 218, 66, T(lang, "宿主入口 B", "Host entry B"),
          T(lang, "软链接", "Symbolic link"))
    s.elbow([(242, 243), (266, 243), (266, 296), (562, 296), (562, 206), (584, 206)],
            color=SOFT, dash="4 4")
    s.arrow(516, 243, 584, 243, color=SOFT, dash="4 4")
    s.text(550, 230, T(lang, "引用", "Reference"), "t-small t-soft", "middle")

    s.text(24, 327, T(lang,
           "登记不等于启用，真实启用看宿主软链接。",
           "Registration does not mean enabled; host links determine actual enablement."), "t-small")
    s.text(24, 347, T(lang,
           "管理程序撤销链接，不删除能力正文。",
           "Removing a host link preserves the skill text."), "t-small t-soft")
    s.text(24, 366, T(lang,
           "服务命令行是说明正本，生成的技能由管理程序更新并启用。",
           "Service CLI instructions generate a Skill; the manager updates it and its host links."), "t-small t-soft")
    return s


# All seven original rows from 20261010-armory-state-counts.csv, unchanged.
# grouped registry-state counts, not enabled-skill counts.
STATE_COUNTS = [
    ("active", 226),
    ("archived", 2),
    ("deleted_by_user", 5),
    ("model_coverage_user_decision", 56),
    ("moved_to_gamedevsuite", 3),
    ("plugin_uninstalled", 71),
    ("reference_only", 6),
]


@fig("theseus-registry-states")
def theseus_registry_states(lang):
    labels = {
        "active": T(lang, "活跃登记", "Active"),
        "plugin_uninstalled": T(lang, "插件已卸载", "Plugin removed"),
        "model_coverage_user_decision": T(lang, "由模型覆盖（用户决定）", "Model covers it"),
        "reference_only": T(lang, "仅作引用", "Reference only"),
        "deleted_by_user": T(lang, "用户已删除", "User deleted"),
        "moved_to_gamedevsuite": T(lang, "已移至其他项目", "Moved elsewhere"),
        "archived": T(lang, "已归档", "Archived"),
    }
    s = Svg(368, title=T(lang, "369 项技能登记的状态分组", "Registry states of 369 skill entries"))
    s.text(24, 32, T(lang, "登记状态 · 合计 369 项", "Registry states · 369 entries in total"), "t-node")
    s.text(24, 53, T(lang, "登记表全量分组，不是启用数", "All registry states; these are not enabled counts"), "t-small t-soft")
    x0, scale = 324, 2
    s.text(850, 53, T(lang, "单位：项", "Entries"), "t-small t-soft", "end")
    for tick in range(0, 251, 50):
        x = x0 + tick * scale
        s.text(x, 77, str(tick), "t-num", "middle")
        s.line(x, 86, x, 304, HAIR if tick == 0 else FAINT,
               dash=None if tick == 0 else "1 5")
    for i, (state, count) in enumerate(sorted(STATE_COUNTS, key=lambda row: -row[1])):
        y = 91 + i * 30
        s.text(24, y + 14, labels[state], "t-small")
        s.dither(x0 + 1, y + 1, count * scale - 2, 16, 25)
        s.rect(x0, y, count * scale, 18)
        s.text(x0 + count * scale + 12, y + 14, str(count), "t-num")
    s.line(24, 317, 856, 317, HAIR)
    s.text(24, 340, T(lang,
           "7 种登记状态，合计 369 项，不能据此得出实际启用数量。",
           "All 7 states total 369 entries; this does not establish the number actually enabled."), "t-small")
    s.text(24, 359, T(lang,
           "实际启用由宿主软链接决定。",
           "Actual enablement is determined by host symbolic links."), "t-small t-soft")
    return s


if __name__ == "__main__":
    from figlib import main
    main()
