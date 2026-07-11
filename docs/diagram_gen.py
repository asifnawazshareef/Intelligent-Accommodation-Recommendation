"""
Reusable diagram-generation helpers for the IARS dissertation.
Produces clean, correct, schematic PNG diagrams (architecture / UML-style)
using matplotlib only (no external UML tools required).

These are intentionally simple/auto-layouted rather than hand-polished UML
art; they exist to give the dissertation accurate, labeled, submission-ready
figures that can later be redrawn in a dedicated UML tool if desired.
"""

import os
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, Ellipse, Circle
from matplotlib.lines import Line2D

OUT_DIR = os.path.join(os.path.dirname(__file__), "dissertation_assets")
os.makedirs(OUT_DIR, exist_ok=True)

FONT = {"family": "DejaVu Sans"}
plt.rcParams["font.family"] = FONT["family"]
plt.rcParams["font.size"] = 10

BOX_FACE = "#EAF1FB"
BOX_EDGE = "#2C3E6B"
ACTOR_FACE = "#FDF3E3"
ACTOR_EDGE = "#8A5A00"
NOTE_FACE = "#F1F1F1"


def _save(fig, filename):
    path = os.path.join(OUT_DIR, filename + ".png")
    fig.savefig(path, dpi=200, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    return path


def _wrap(text, width=22):
    import textwrap
    return "\n".join(textwrap.wrap(text, width))


# ---------------------------------------------------------------------------
# 1. Generic layered flow / activity / pipeline / architecture diagram
# ---------------------------------------------------------------------------

def flow_diagram(levels, edges, filename, node_w=2.6, node_h=0.9,
                  h_gap=0.9, v_gap=1.5, title=None, node_styles=None,
                  figsize_scale=1.0):
    """
    levels: list of list-of-node-ids, top row first e.g. [["A"],["B","C"],["D"]]
    Each node id maps to a label via `labels` dict passed inside edges tuple set,
    but simpler: levels item can be (id, label) tuples.
    edges: list of (from_id, to_id, label_or_None)
    node_styles: optional dict id -> 'actor'|'note'|'default'
    """
    node_styles = node_styles or {}
    positions = {}
    node_row = {}
    max_row_len = max(len(row) for row in levels)
    fig_w = max(6.5, max_row_len * (node_w + h_gap) * figsize_scale)
    fig_h = max(3.5, len(levels) * (node_h + v_gap))
    max_half_width = max(len(row) * node_w + (len(row) - 1) * h_gap for row in levels) / 2
    fig, ax = plt.subplots(figsize=(fig_w, fig_h))

    for r, row in enumerate(levels):
        row_w = len(row) * node_w + (len(row) - 1) * h_gap
        start_x = -row_w / 2
        y = -(r * (node_h + v_gap))
        for i, item in enumerate(row):
            node_id, label = item if isinstance(item, tuple) else (item, item)
            x = start_x + i * (node_w + h_gap)
            positions[node_id] = (x + node_w / 2, y + node_h / 2)
            node_row[node_id] = r
            style = node_styles.get(node_id, "default")
            if style == "actor":
                face, edge = ACTOR_FACE, ACTOR_EDGE
                box = Ellipse((x + node_w / 2, y + node_h / 2), node_w, node_h,
                              facecolor=face, edgecolor=edge, linewidth=1.4, zorder=2)
            elif style == "decision":
                face, edge = "#FCEEEE", "#8B2E2E"
                box = FancyBboxPatch((x, y), node_w, node_h,
                                      boxstyle="round,pad=0.02,rounding_size=0.35",
                                      facecolor=face, edgecolor=edge, linewidth=1.3, zorder=2)
            else:
                face, edge = BOX_FACE, BOX_EDGE
                box = FancyBboxPatch((x, y), node_w, node_h,
                                      boxstyle="round,pad=0.02,rounding_size=0.12",
                                      facecolor=face, edgecolor=edge, linewidth=1.3, zorder=2)
            ax.add_patch(box)
            ax.text(x + node_w / 2, y + node_h / 2, _wrap(label, 24),
                     ha="center", va="center", fontsize=9.3, zorder=3, wrap=True)

    bypass_x = max_half_width + 0.9
    bypass_lane_count = {}
    fanout_count = {}

    for frm, to, elabel in edges:
        if frm not in positions or to not in positions:
            continue
        x1, y1 = positions[frm]
        x2, y2 = positions[to]
        row_gap = abs(node_row[to] - node_row[frm])
        if row_gap >= 2:
            # Skips over at least one intervening row: route around the side
            # so the connector and its label never cross another node's box.
            lane_key = min(node_row[frm], node_row[to]), max(node_row[frm], node_row[to])
            lane_idx = bypass_lane_count.get(lane_key, 0)
            bypass_lane_count[lane_key] = lane_idx + 1
            bx = bypass_x + lane_idx * 1.1
            ax.plot([x1, bx, bx], [y1, y1, y2], color="#333333", lw=1.2, zorder=1)
            ax.annotate("", xy=(x2, y2), xytext=(bx, y2),
                        arrowprops=dict(arrowstyle="-|>", color="#333333", lw=1.2, shrinkB=18),
                        zorder=1)
            if elabel:
                ax.text(bx + 0.15, (y1 + y2) / 2, elabel, fontsize=8, color="#444444", style="italic",
                        ha="left", va="center", zorder=4,
                        bbox=dict(boxstyle="round,pad=0.15", fc="white", ec="none", alpha=0.85))
            continue
        if y1 == y2 and x1 != x2:
            # Lateral transition between nodes in the same row: bow the
            # connector below the row so the label never sits on top of
            # either node's own text.
            dip = node_h / 2 + 0.5
            ax.annotate("", xy=(x2, y2), xytext=(x1, y1),
                        arrowprops=dict(arrowstyle="-|>", color="#333333", lw=1.2,
                                         shrinkA=18, shrinkB=18,
                                         connectionstyle=f"arc3,rad={-0.45 if x2 > x1 else 0.45}"),
                        zorder=1)
            if elabel:
                mx = (x1 + x2) / 2
                ax.text(mx, y1 - dip, elabel, fontsize=8, color="#444444", style="italic",
                         ha="center", va="top", zorder=4,
                         bbox=dict(boxstyle="round,pad=0.15", fc="white", ec="none", alpha=0.85))
            continue
        ax.annotate("", xy=(x2, y2 + node_h / 2 * 0 + (0.46 if y2 < y1 else -0.46) if y1 != y2 else 0),
                    xytext=(x1, y1), arrowprops=dict(arrowstyle="-|>", color="#333333",
                                                      lw=1.2, shrinkA=18, shrinkB=18,
                                                      connectionstyle="arc3,rad=0.06"),
                    zorder=1)
        if elabel:
            # When several edges fan out from the same source into the same
            # target row, their geometric midpoints share the same height;
            # stagger each subsequent label's vertical offset to keep them
            # from overlapping one another.
            fan_key = (frm, node_row[to])
            fan_idx = fanout_count.get(fan_key, 0)
            fanout_count[fan_key] = fan_idx + 1
            mx, my = (x1 + x2) / 2, (y1 + y2) / 2
            my_adj = my + fan_idx * (0.24 if y2 < y1 else -0.24)
            ax.text(mx + 0.18, my_adj, elabel, fontsize=8, color="#444444", style="italic",
                     ha="left", va="center", zorder=4,
                     bbox=dict(boxstyle="round,pad=0.15", fc="white", ec="none", alpha=0.85))

    max_lane = max(bypass_lane_count.values(), default=0)
    right_lim = max(fig_w / 1.7, bypass_x + 1.5 + max_lane * 1.1)
    ax.set_xlim(-fig_w / 1.7, right_lim)
    ax.set_ylim(-(len(levels)) * (node_h + v_gap) + 0.2, node_h + 0.6)
    ax.axis("off")
    if title:
        ax.set_title(title, fontsize=11, fontweight="bold", pad=14)
    return _save(fig, filename)


# ---------------------------------------------------------------------------
# 1b. UML Use Case Diagram (system boundary + actors + use-case ovals)
# ---------------------------------------------------------------------------

def _draw_actor(ax, x, y, label, scale=0.42):
    """Draws a simple UML stick-figure actor centred at (x, y) with a label below."""
    head_r = 0.11 * scale / 0.42
    head_cy = y + 0.62 * scale / 0.42
    ax.add_patch(Circle((x, head_cy), head_r, facecolor=ACTOR_FACE, edgecolor=ACTOR_EDGE,
                         linewidth=1.3, zorder=4))
    body_top = head_cy - head_r
    body_bot = y - 0.05
    ax.plot([x, x], [body_top, body_bot], color=ACTOR_EDGE, lw=1.4, zorder=4)
    arm_y = body_top - 0.10
    ax.plot([x - 0.24, x + 0.24], [arm_y, arm_y], color=ACTOR_EDGE, lw=1.4, zorder=4)
    ax.plot([x, x - 0.20], [body_bot, body_bot - 0.28], color=ACTOR_EDGE, lw=1.4, zorder=4)
    ax.plot([x, x + 0.20], [body_bot, body_bot - 0.28], color=ACTOR_EDGE, lw=1.4, zorder=4)
    ax.text(x, body_bot - 0.45, label, ha="center", va="top", fontsize=8.6,
            fontweight="bold", zorder=4)


def usecase_diagram(actors, usecases, associations, filename, title=None,
                     boundary_label="IARS Platform", cols=3):
    """
    actors: list of (actor_id, label, side) where side is 'left' or 'right'
    usecases: list of (uc_id, label) laid out in a grid inside the system boundary
    associations: list of (actor_id, uc_id) plain (unlabelled, undirected) lines
    """
    n = len(usecases)
    rows = (n + cols - 1) // cols
    oval_w, oval_h = 2.5, 0.85
    h_gap, v_gap = 0.55, 0.45
    grid_w = cols * oval_w + (cols - 1) * h_gap
    grid_h = rows * oval_h + (rows - 1) * v_gap
    margin = 0.7
    boundary_x0, boundary_y0 = 0, 0
    boundary_w = grid_w + margin * 2
    boundary_h = grid_h + margin * 2 + 0.5

    actor_col_w = 2.0
    fig_w = actor_col_w * 2 + boundary_w + 1.0
    fig_h = max(boundary_h, len(actors) * 1.35) + 1.0
    fig, ax = plt.subplots(figsize=(fig_w * 0.92, fig_h * 0.78))

    bx = actor_col_w + 0.5
    by = -(boundary_h - 1.0)
    ax.add_patch(FancyBboxPatch((bx, by), boundary_w, boundary_h, boxstyle="square,pad=0",
                                 facecolor="#FBFCFE", edgecolor=BOX_EDGE, linewidth=1.5, zorder=1))
    ax.text(bx + 0.15, by + boundary_h - 0.28, boundary_label,
            ha="left", va="center", fontsize=10.5, fontweight="bold",
            style="italic", color="#2C3E6B", zorder=2)

    uc_positions = {}
    grid_x0 = bx + margin
    grid_y0 = by + boundary_h - margin - 0.6
    for idx, (uc_id, label) in enumerate(usecases):
        r, c = divmod(idx, cols)
        cx = grid_x0 + c * (oval_w + h_gap) + oval_w / 2
        cy = grid_y0 - r * (oval_h + v_gap) - oval_h / 2
        uc_positions[uc_id] = (cx, cy)
        ax.add_patch(Ellipse((cx, cy), oval_w, oval_h, facecolor=BOX_FACE, edgecolor=BOX_EDGE,
                              linewidth=1.2, zorder=3))
        ax.text(cx, cy, _wrap(label, 20), ha="center", va="center", fontsize=7.6, zorder=4)

    left_actors = [a for a in actors if a[2] == "left"]
    right_actors = [a for a in actors if a[2] == "right"]
    actor_positions = {}
    for i, (aid, label, side) in enumerate(left_actors):
        ay = by + boundary_h - 1.1 - i * (boundary_h - 1.4) / max(1, len(left_actors) - 1 or 1)
        ax_ = 0.55
        _draw_actor(ax, ax_, ay, label)
        actor_positions[aid] = (ax_ + 0.24, ay + 0.2)
    for i, (aid, label, side) in enumerate(right_actors):
        ay = by + boundary_h - 1.1 - i * (boundary_h - 1.4) / max(1, len(right_actors) - 1 or 1)
        ax_ = bx + boundary_w + 1.1
        _draw_actor(ax, ax_, ay, label)
        actor_positions[aid] = (ax_ - 0.24, ay + 0.2)

    for aid, uc_id in associations:
        if aid not in actor_positions or uc_id not in uc_positions:
            continue
        x1, y1 = actor_positions[aid]
        x2, y2 = uc_positions[uc_id]
        ax.plot([x1, x2], [y1, y2], color="#888888", lw=0.8, alpha=0.75, zorder=2)

    ax.set_xlim(-0.3, fig_w * 0.98)
    ax.set_ylim(by - 0.3, boundary_h * 0.0 + 0.6)
    ax.set_aspect("equal")
    ax.axis("off")
    if title:
        ax.set_title(title, fontsize=11.5, fontweight="bold", pad=18)
    return _save(fig, filename)


# ---------------------------------------------------------------------------
# 2. Sequence diagram
# ---------------------------------------------------------------------------

def seq_diagram(participants, messages, filename, title=None):
    """
    participants: list of participant names, left to right
    messages: list of dicts: {from, to, label, type: 'sync'|'return'|'note', order}
              'note' type -> to == from, draws a note box on that lifeline
    """
    n = len(participants)
    x_positions = {p: i * 3.0 for i, p in enumerate(participants)}
    row_h = 0.62
    top_y = len(messages) * row_h + 1.4
    fig_w = max(7.5, n * 2.6)
    fig_h = max(4.0, top_y + 1.0)
    fig, ax = plt.subplots(figsize=(fig_w, fig_h))

    # Lifeline headers
    for p in participants:
        x = x_positions[p]
        box = FancyBboxPatch((x - 1.15, top_y), 2.3, 0.7,
                              boxstyle="round,pad=0.02,rounding_size=0.1",
                              facecolor=BOX_FACE, edgecolor=BOX_EDGE, linewidth=1.3, zorder=3)
        ax.add_patch(box)
        ax.text(x, top_y + 0.35, _wrap(p, 20), ha="center", va="center",
                 fontsize=9.3, fontweight="bold", zorder=4)
        ax.add_line(Line2D([x, x], [top_y, -0.6], color="#999999",
                            linestyle="--", linewidth=1.1, zorder=1))

    y = top_y - 0.15
    for i, m in enumerate(messages):
        y -= row_h
        x1 = x_positions[m["from"]]
        x2 = x_positions[m["to"]]
        label = _wrap(m.get("label", ""), 42)
        if m.get("type") == "note":
            ax.add_patch(FancyBboxPatch((x1 - 1.05, y - 0.18), 2.1, 0.5,
                                         boxstyle="round,pad=0.02",
                                         facecolor="#FFF6D8", edgecolor="#B8952E",
                                         linewidth=1.0, zorder=3))
            ax.text(x1, y + 0.07, label, ha="center", va="center", fontsize=8, zorder=4)
            continue
        style = "-|>" if m.get("type", "sync") == "sync" else "-|>"
        linestyle = "-" if m.get("type", "sync") == "sync" else "--"
        if x1 == x2:
            # self message (loop)
            ax.annotate("", xy=(x1 + 0.55, y - 0.28), xytext=(x1, y),
                        arrowprops=dict(arrowstyle=style, color="#333333", lw=1.1,
                                        connectionstyle="arc3,rad=1.4"), zorder=2)
            ax.text(x1 + 0.75, y - 0.1, label, fontsize=8, ha="left", va="center", zorder=4)
        else:
            ax.annotate("", xy=(x2, y), xytext=(x1, y),
                        arrowprops=dict(arrowstyle=style, color="#333333", lw=1.2,
                                        linestyle=linestyle, shrinkA=2, shrinkB=2), zorder=2)
            mx = (x1 + x2) / 2
            ax.text(mx, y + 0.1, label, fontsize=8, ha="center", va="bottom", zorder=4,
                     bbox=dict(boxstyle="round,pad=0.12", fc="white", ec="none", alpha=0.9))

    ax.set_xlim(-1.8, (n - 1) * 3.0 + 1.8)
    ax.set_ylim(y - 0.8, top_y + 0.9)
    ax.axis("off")
    if title:
        ax.set_title(title, fontsize=11, fontweight="bold", pad=10)
    return _save(fig, filename)


# ---------------------------------------------------------------------------
# 3. ERD
# ---------------------------------------------------------------------------

def erd_diagram(entities, relationships, filename, title=None, cols=4):
    """
    entities: dict name -> list of field strings (first field should be the key, prefixed 'PK'/'FK' as desired)
    relationships: list of (from_entity, to_entity, label)  e.g. ("User","Property","1..* owns")
    """
    names = list(entities.keys())
    n = len(names)
    rows = (n + cols - 1) // cols
    box_w, header_h, row_h = 3.4, 0.5, 0.34
    h_gap, v_gap = 1.5, 2.1
    positions = {}
    fig_w = cols * (box_w + h_gap)
    max_h_per_entity = {name: header_h + row_h * len(fields) for name, fields in entities.items()}
    row_unit = max(max_h_per_entity.values())
    fig_h = rows * (row_unit + v_gap) + 1

    def row_top(r):
        return -(r * (row_unit + v_gap))

    fig, ax = plt.subplots(figsize=(fig_w * 0.95, fig_h * 0.95))

    for idx, name in enumerate(names):
        r, c = divmod(idx, cols)
        x = c * (box_w + h_gap)
        fields = entities[name]
        h = header_h + row_h * len(fields)
        y = row_top(r)
        positions[name] = {"cx": x + box_w / 2, "cy": y - h / 2, "x": x, "top": y, "h": h, "row": r, "col": c}
        ax.add_patch(FancyBboxPatch((x, y - h), box_w, h, boxstyle="square,pad=0",
                                     facecolor="white", edgecolor=BOX_EDGE, linewidth=1.3, zorder=2))
        ax.add_patch(FancyBboxPatch((x, y - header_h), box_w, header_h, boxstyle="square,pad=0",
                                     facecolor=BOX_EDGE, edgecolor=BOX_EDGE, linewidth=1.3, zorder=3))
        ax.text(x + box_w / 2, y - header_h / 2, name, ha="center", va="center",
                 fontsize=10, color="white", fontweight="bold", zorder=4)
        for fi, field in enumerate(fields):
            fy = y - header_h - row_h * (fi + 0.5)
            ax.text(x + 0.15, fy, field, ha="left", va="center", fontsize=8.2, zorder=4)
            if fi < len(fields) - 1:
                ax.plot([x, x + box_w], [y - header_h - row_h * (fi + 1)] * 2,
                        color="#DDDDDD", lw=0.7, zorder=3)

    for frm, to, label in relationships:
        if frm not in positions or to not in positions:
            continue
        a, b = positions[frm], positions[to]
        same_row = a["row"] == b["row"]
        skips_over = same_row and abs(a["col"] - b["col"]) > 1
        if skips_over:
            # Route above the row (over the tops of any intervening entity boxes)
            y_clear = min(a["top"], b["top"]) + 0.28
            ax.plot([a["cx"], a["cx"], b["cx"], b["cx"]],
                    [a["top"], y_clear, y_clear, b["top"]],
                    color="#555555", lw=1.1, zorder=1)
            lx, ly = (a["cx"] + b["cx"]) / 2, y_clear
            va = "bottom"
        else:
            ax.annotate("", xy=(b["cx"], b["cy"]), xytext=(a["cx"], a["cy"]),
                        arrowprops=dict(arrowstyle="-", color="#555555", lw=1.1,
                                         connectionstyle="arc3,rad=0.15"), zorder=1)
            lx, ly = (a["cx"] + b["cx"]) / 2, (a["cy"] + b["cy"]) / 2
            va = "center"
        ax.text(lx, ly, label, fontsize=7.6, color="#333333", style="italic", ha="center", va=va,
                 bbox=dict(boxstyle="round,pad=0.12", fc="#FFFDE8", ec="#CCCC99", alpha=0.95), zorder=5)

    ax.set_xlim(-0.4, fig_w * 0.98)
    ax.set_ylim(-fig_h * 0.98, 0.9)
    ax.axis("off")
    if title:
        ax.set_title(title, fontsize=11, fontweight="bold", pad=10)
    return _save(fig, filename)


# ---------------------------------------------------------------------------
# 4. Class diagram (3-compartment UML boxes)
# ---------------------------------------------------------------------------

def class_diagram(classes, relationships, filename, title=None, cols=3):
    """
    classes: dict name -> {"attrs": [...], "methods": [...]}
    relationships: list of (from, to, label)
    """
    names = list(classes.keys())
    n = len(names)
    rows = (n + cols - 1) // cols
    box_w = 3.5
    h_gap, v_gap = 1.6, 2.1
    positions = {}
    heights = {}
    for name, c in classes.items():
        heights[name] = 0.5 + 0.28 * max(1, len(c.get("attrs", []))) + 0.28 * max(1, len(c.get("methods", []))) + 0.35
    fig_w = cols * (box_w + h_gap)
    max_h = max(heights.values())
    fig_h = rows * (max_h + v_gap) + 1
    fig, ax = plt.subplots(figsize=(fig_w * 0.95, fig_h * 0.95))

    for idx, name in enumerate(names):
        r, c = divmod(idx, cols)
        x = c * (box_w + h_gap)
        y = -(r * (max_h + v_gap))
        h = heights[name]
        positions[name] = {"cx": x + box_w / 2, "cy": y - h / 2, "top": y, "h": h, "row": r, "col": c}
        ax.add_patch(FancyBboxPatch((x, y - h), box_w, h, boxstyle="square,pad=0",
                                     facecolor="white", edgecolor=BOX_EDGE, linewidth=1.3, zorder=2))
        ax.text(x + box_w / 2, y - 0.25, name, ha="center", va="center",
                 fontsize=9.6, fontweight="bold", zorder=4)
        ax.plot([x, x + box_w], [y - 0.5, y - 0.5], color=BOX_EDGE, lw=1.1, zorder=3)
        attrs = classes[name].get("attrs", [])
        cy = y - 0.5
        for a in attrs:
            cy -= 0.28
            ax.text(x + 0.12, cy, "- " + a, ha="left", va="center", fontsize=7.4, zorder=4)
        cy -= 0.06
        ax.plot([x, x + box_w], [cy, cy], color=BOX_EDGE, lw=1.1, zorder=3)
        methods = classes[name].get("methods", [])
        for me in methods:
            cy -= 0.28
            ax.text(x + 0.12, cy, "+ " + me, ha="left", va="center", fontsize=7.4,
                     style="italic", zorder=4)

    def row_top(r):
        return -(r * (max_h + v_gap))

    diag_lane_count = {}

    for frm, to, label in relationships:
        if frm not in positions or to not in positions:
            continue
        a, b = positions[frm], positions[to]
        same_row = a["row"] == b["row"]
        adjacent_same_row = same_row and abs(a["col"] - b["col"]) <= 1
        same_col_diff_row = (a["col"] == b["col"]) and not same_row
        if adjacent_same_row or same_col_diff_row:
            ax.annotate("", xy=(b["cx"], b["cy"]), xytext=(a["cx"], a["cy"]),
                        arrowprops=dict(arrowstyle="-|>", color="#555555", lw=1.1,
                                         connectionstyle="arc3,rad=0.12"), zorder=1)
            lx, ly, va = (a["cx"] + b["cx"]) / 2, (a["cy"] + b["cy"]) / 2, "center"
        elif same_row:
            # Same row but skips over an intervening box: route above the row.
            y_clear = min(a["top"], b["top"]) + 0.3
            ax.plot([a["cx"], a["cx"], b["cx"]], [a["top"], y_clear, y_clear],
                    color="#555555", lw=1.1, zorder=1)
            ax.annotate("", xy=(b["cx"], y_clear), xytext=(b["cx"], y_clear + 0.35),
                        arrowprops=dict(arrowstyle="-|>", color="#555555", lw=1.1), zorder=1)
            ax.plot([b["cx"], b["cx"]], [y_clear, b["top"]], color="#555555", lw=1.1, zorder=1)
            lx, ly, va = (a["cx"] + b["cx"]) / 2, y_clear, "bottom"
        else:
            # Diagonal across rows and columns: route through the clear
            # horizontal corridor between the two rows to avoid crossing
            # through any box that sits directly between them.
            lower, upper = (a, b) if a["row"] > b["row"] else (b, a)
            lane_key = (upper["row"], lower["row"])
            lane_idx = diag_lane_count.get(lane_key, 0)
            diag_lane_count[lane_key] = lane_idx + 1
            gap_y = row_top(lower["row"]) + v_gap * (0.3 + 0.18 * lane_idx)
            ax.plot([upper["cx"], upper["cx"], lower["cx"]],
                    [upper["top"] - upper["h"], gap_y, gap_y],
                    color="#555555", lw=1.1, zorder=1)
            if lower is b:
                ax.annotate("", xy=(lower["cx"], lower["top"]), xytext=(lower["cx"], gap_y),
                            arrowprops=dict(arrowstyle="-|>", color="#555555", lw=1.1), zorder=1)
            else:
                ax.plot([lower["cx"], lower["cx"]], [gap_y, lower["top"]], color="#555555", lw=1.1, zorder=1)
                ax.annotate("", xy=(upper["cx"], upper["top"]), xytext=(upper["cx"], gap_y),
                            arrowprops=dict(arrowstyle="-|>", color="#555555", lw=1.1), zorder=1)
            lx, ly, va = (upper["cx"] + lower["cx"]) / 2, gap_y, "bottom"
        ax.text(lx, ly, label, fontsize=7.4, color="#333333", style="italic", ha="center", va=va,
                 bbox=dict(boxstyle="round,pad=0.1", fc="#FFFDE8", ec="#CCCC99", alpha=0.95), zorder=5)

    ax.set_xlim(-0.4, fig_w * 0.98)
    ax.set_ylim(-fig_h * 0.98, 0.9)
    ax.axis("off")
    if title:
        ax.set_title(title, fontsize=11, fontweight="bold", pad=10)
    return _save(fig, filename)


# ---------------------------------------------------------------------------
# 5. Simple grouped bar chart (for evaluation results)
# ---------------------------------------------------------------------------

def bar_chart(categories, series, filename, title=None, ylabel="Score", ylim=(0, 1)):
    """
    series: dict label -> list of values aligned with categories
    """
    fig, ax = plt.subplots(figsize=(6.5, 4))
    n_series = len(series)
    width = 0.8 / n_series
    x = range(len(categories))
    colors = ["#2C3E6B", "#5B8DB8", "#C97B3C", "#7A9E5C"]
    for i, (label, values) in enumerate(series.items()):
        offsets = [xi + (i - (n_series - 1) / 2) * width for xi in x]
        ax.bar(offsets, values, width=width * 0.9, label=label, color=colors[i % len(colors)])
    ax.set_xticks(list(x))
    ax.set_xticklabels(categories)
    ax.set_ylabel(ylabel)
    ax.set_ylim(*ylim)
    ax.legend(fontsize=8)
    ax.grid(axis="y", linestyle="--", alpha=0.4)
    if title:
        ax.set_title(title, fontsize=11, fontweight="bold")
    fig.tight_layout()
    return _save(fig, filename)


if __name__ == "__main__":
    print("diagram_gen module loaded OK. Output dir:", OUT_DIR)
