# -*- coding: utf-8 -*-
"""
Low-level python-docx helpers for assembling the IARS dissertation:
- A4 page / margin / font setup matching the ISAR Doc v1.pdf conventions
  (Times New Roman body, Arial accents, running header, centered footer,
   figure captions below figures, table captions above tables).
- Real Word TOC / List of Figures / List of Tables fields (auto-populate
  on "Update Field" / opening in Word) via raw OOXML field codes.
- A tolerant markdown-ish chapter-content parser used to convert the
  structured subagent output into Word headings / paragraphs / tables /
  figures / code blocks.
"""
import os
import re
from docx import Document
from docx.shared import Pt, Cm, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.section import WD_SECTION
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

ASSETS_DIR = os.path.join(os.path.dirname(__file__), "dissertation_assets")

BODY_FONT = "Times New Roman"
ACCENT_FONT = "Arial"


# ---------------------------------------------------------------------------
# Low level OOXML helpers
# ---------------------------------------------------------------------------

def _set_cell_shading(cell, color_hex):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), color_hex)
    tcPr.append(shd)


def _add_field(paragraph, instr_text, display_text="(Update this field in Word: select all, then press F9)"):
    """Inserts a Word field code (TOC / TC / PAGE etc.) into a paragraph."""
    run = paragraph.add_run()
    fld_begin = OxmlElement("w:fldChar")
    fld_begin.set(qn("w:fldCharType"), "begin")
    r_pr = OxmlElement("w:rPr")
    run._r.append(r_pr)
    run._r.append(fld_begin)

    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = instr_text
    run2 = paragraph.add_run()
    run2._r.append(instr)

    fld_sep = OxmlElement("w:fldChar")
    fld_sep.set(qn("w:fldCharType"), "separate")
    run3 = paragraph.add_run()
    run3._r.append(fld_sep)

    run4 = paragraph.add_run(display_text)
    run4.italic = True
    run4.font.size = Pt(9)

    fld_end = OxmlElement("w:fldChar")
    fld_end.set(qn("w:fldCharType"), "end")
    run5 = paragraph.add_run()
    run5._r.append(fld_end)


def add_toc_field(doc, switches=' TOC \\o "1-3" \\h \\z \\u '):
    p = doc.add_paragraph()
    _add_field(p, switches)
    return p


def add_tc_field(paragraph, text, f_switch):
    """Adds a hidden TC (table-of-contents-entry) field for LoF/LoT building.
    f_switch: 'f' for figures, 't' for tables."""
    instr = ' TC "%s" \\f %s ' % (text.replace('"', "'"), f_switch)
    run = paragraph.add_run()
    fld_begin = OxmlElement("w:fldChar")
    fld_begin.set(qn("w:fldCharType"), "begin")
    run._r.append(fld_begin)
    instr_el = OxmlElement("w:instrText")
    instr_el.set(qn("xml:space"), "preserve")
    instr_el.text = instr
    run2 = paragraph.add_run()
    run2._r.append(instr_el)
    fld_end = OxmlElement("w:fldChar")
    fld_end.set(qn("w:fldCharType"), "end")
    run3 = paragraph.add_run()
    run3._r.append(fld_end)


def set_page_number_field(paragraph, fmt=None):
    _add_field(paragraph, " PAGE ", display_text="1")


def set_section_page_number_format(section, fmt="decimal", start=None):
    sectPr = section._sectPr
    pgNumType = sectPr.find(qn("w:pgNumType"))
    if pgNumType is None:
        pgNumType = OxmlElement("w:pgNumType")
        sectPr.append(pgNumType)
    fmt_map = {"decimal": "decimal", "roman": "lowerRoman", "upperRoman": "upperRoman"}
    pgNumType.set(qn("w:fmt"), fmt_map.get(fmt, "decimal"))
    if start is not None:
        pgNumType.set(qn("w:start"), str(start))


def add_page_break(doc):
    from docx.enum.text import WD_BREAK
    p = doc.add_paragraph()
    p.add_run().add_break(WD_BREAK.PAGE)


# ---------------------------------------------------------------------------
# Document / style setup
# ---------------------------------------------------------------------------

def new_document():
    doc = Document()
    section = doc.sections[0]
    section.page_height = Cm(29.7)
    section.page_width = Cm(21.0)
    section.left_margin = Inches(1.5)
    section.right_margin = Inches(1.0)
    section.top_margin = Inches(1.0)
    section.bottom_margin = Inches(1.0)
    section.header_distance = Inches(0.5)
    section.footer_distance = Inches(0.5)

    styles = doc.styles

    normal = styles["Normal"]
    normal.font.name = BODY_FONT
    normal.font.size = Pt(12)
    normal.paragraph_format.line_spacing = 1.5
    normal.paragraph_format.space_after = Pt(10)
    normal.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    rpr = normal.element.rPr
    rpr.rFonts.set(qn("w:eastAsia"), BODY_FONT)

    h1 = styles["Heading 1"]
    h1.font.name = ACCENT_FONT
    h1.font.size = Pt(18)
    h1.font.bold = True
    h1.font.color.rgb = RGBColor(0x1B, 0x1B, 0x1B)
    h1.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    h1.paragraph_format.space_before = Pt(0)
    h1.paragraph_format.space_after = Pt(24)
    h1.paragraph_format.line_spacing = 1.0

    h2 = styles["Heading 2"]
    h2.font.name = ACCENT_FONT
    h2.font.size = Pt(14)
    h2.font.bold = True
    h2.font.color.rgb = RGBColor(0x1B, 0x1B, 0x1B)
    h2.paragraph_format.space_before = Pt(20)
    h2.paragraph_format.space_after = Pt(10)
    h2.paragraph_format.line_spacing = 1.0
    h2.paragraph_format.keep_with_next = True

    h3 = styles["Heading 3"]
    h3.font.name = ACCENT_FONT
    h3.font.size = Pt(12.5)
    h3.font.bold = True
    h3.font.italic = False
    h3.font.color.rgb = RGBColor(0x1B, 0x1B, 0x1B)
    h3.paragraph_format.space_before = Pt(14)
    h3.paragraph_format.space_after = Pt(8)
    h3.paragraph_format.line_spacing = 1.0
    h3.paragraph_format.keep_with_next = True

    if "Caption" in [s.name for s in styles]:
        cap = styles["Caption"]
    else:
        cap = styles.add_style("Caption", 1)
    cap.font.name = ACCENT_FONT
    cap.font.size = Pt(10.5)
    cap.font.italic = True
    cap.font.bold = False
    cap.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    cap.paragraph_format.space_before = Pt(4)
    cap.paragraph_format.space_after = Pt(14)

    tcap = styles.add_style("TableCaption", 1)
    tcap.font.name = ACCENT_FONT
    tcap.font.size = Pt(10.5)
    tcap.font.italic = False
    tcap.font.bold = True
    tcap.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.LEFT
    tcap.paragraph_format.space_before = Pt(14)
    tcap.paragraph_format.space_after = Pt(4)

    code = styles.add_style("CodeBlock", 1)
    code.font.name = "Consolas"
    code.font.size = Pt(9.5)
    code.paragraph_format.space_before = Pt(4)
    code.paragraph_format.space_after = Pt(10)
    code.paragraph_format.line_spacing = 1.15
    code.paragraph_format.left_indent = Inches(0.3)

    toc_h = styles.add_style("FrontMatterHeading", 1)
    toc_h.font.name = ACCENT_FONT
    toc_h.font.size = Pt(16)
    toc_h.font.bold = True
    toc_h.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
    toc_h.paragraph_format.space_after = Pt(18)

    return doc


def start_new_section(doc, header_text=None, footer_page_fmt="decimal", restart_at=None, first_section=False):
    """Starts a new Word section (page-break) with its own header/footer,
    so running headers and page-number formats can change per chapter."""
    if first_section:
        section = doc.sections[0]
    else:
        section = doc.add_section(WD_SECTION.NEW_PAGE)
    section.page_height = Cm(29.7)
    section.page_width = Cm(21.0)
    section.left_margin = Inches(1.5)
    section.right_margin = Inches(1.0)
    section.top_margin = Inches(1.0)
    section.bottom_margin = Inches(1.0)
    section.header_distance = Inches(0.5)
    section.footer_distance = Inches(0.5)

    section.header.is_linked_to_previous = False
    section.footer.is_linked_to_previous = False

    if header_text:
        hp = section.header.paragraphs[0]
        hp.text = ""
        run = hp.add_run(header_text)
        run.font.name = ACCENT_FONT
        run.font.size = Pt(9)
        run.font.italic = True
        run.font.color.rgb = RGBColor(0x55, 0x55, 0x55)
        hp.alignment = WD_ALIGN_PARAGRAPH.CENTER
        pf = hp.paragraph_format
        pf.space_after = Pt(0)
        pbdr = OxmlElement("w:pBdr")
        bottom = OxmlElement("w:bottom")
        bottom.set(qn("w:val"), "single")
        bottom.set(qn("w:sz"), "4")
        bottom.set(qn("w:space"), "4")
        bottom.set(qn("w:color"), "999999")
        pbdr.append(bottom)
        hp.paragraph_format.element.get_or_add_pPr().append(pbdr)
    else:
        section.header.paragraphs[0].text = ""

    fp = section.footer.paragraphs[0]
    fp.text = ""
    fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    set_page_number_field(fp)
    for run in fp.runs:
        run.font.name = ACCENT_FONT
        run.font.size = Pt(10)

    set_section_page_number_format(section, fmt=footer_page_fmt, start=restart_at)
    return section


# ---------------------------------------------------------------------------
# Content builders
# ---------------------------------------------------------------------------

def add_chapter_title(doc, chapter_label, title):
    p = doc.add_paragraph(chapter_label, style="Heading 1")
    p2 = doc.add_paragraph(title)
    p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
    for r in p2.runs:
        pass
    if not p2.runs:
        p2.add_run(title)
    for r in p2.runs:
        r.font.name = ACCENT_FONT
        r.font.size = Pt(15)
        r.font.bold = True
    p2.paragraph_format.space_after = Pt(28)
    return p


def add_paragraph_text(doc, text):
    text = text.strip()
    if not text:
        return None
    p = doc.add_paragraph()
    _add_inline_runs(p, text)
    return p


BOLD_RE = re.compile(r"\*\*(.+?)\*\*")
ITALIC_RE = re.compile(r"(?<!\*)\*([^*]+?)\*(?!\*)")
CODE_RE = re.compile(r"`([^`]+?)`")


def _add_inline_runs(paragraph, text):
    """Very small inline markdown handler: **bold**, *italic*, `code`."""
    tokens = []
    pos = 0
    pattern = re.compile(r"(\*\*.+?\*\*|`[^`]+?`|\*[^*]+?\*)")
    for m in pattern.finditer(text):
        if m.start() > pos:
            tokens.append(("text", text[pos:m.start()]))
        token = m.group(0)
        if token.startswith("**"):
            tokens.append(("bold", token[2:-2]))
        elif token.startswith("`"):
            tokens.append(("code", token[1:-1]))
        else:
            tokens.append(("italic", token[1:-1]))
        pos = m.end()
    if pos < len(text):
        tokens.append(("text", text[pos:]))
    if not tokens:
        tokens = [("text", text)]
    for kind, val in tokens:
        run = paragraph.add_run(val)
        if kind == "bold":
            run.bold = True
        elif kind == "italic":
            run.italic = True
        elif kind == "code":
            run.font.name = "Consolas"
            run.font.size = Pt(10.5)


def add_table_caption(doc, text):
    p = doc.add_paragraph(text, style="TableCaption")
    return p


def add_figure_caption(doc, text):
    p = doc.add_paragraph(text, style="Caption")
    add_tc_field(p, text, "f")
    return p


def add_table_caption_with_tc(doc, text):
    p = add_table_caption(doc, text)
    add_tc_field(p, text, "t")
    return p


def add_markdown_table(doc, rows):
    """rows: list of list-of-cell-strings, first row = header."""
    if not rows:
        return None
    n_cols = max(len(r) for r in rows)
    table = doc.add_table(rows=0, cols=n_cols)
    table.style = "Table Grid"
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = True
    for ri, row in enumerate(rows):
        cells = table.add_row().cells
        for ci in range(n_cols):
            text = row[ci] if ci < len(row) else ""
            cell = cells[ci]
            cell.text = ""
            p = cell.paragraphs[0]
            p.paragraph_format.space_after = Pt(2)
            _add_inline_runs(p, text.strip())
            for run in p.runs:
                run.font.size = Pt(9.5)
                run.font.name = BODY_FONT
                if ri == 0:
                    run.bold = True
            if ri == 0:
                _set_cell_shading(cell, "D9E2F3")
    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    return table


def add_figure(doc, image_path, width_inches=5.6, placeholder_label=None):
    from docx.shared import Inches as _In
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    if image_path and os.path.exists(image_path):
        run = p.add_run()
        run.add_picture(image_path, width=_In(width_inches))
    else:
        # Placeholder box for missing screenshots (no live app instance captured)
        ph_path = ensure_placeholder_image(placeholder_label or "Screenshot placeholder")
        run = p.add_run()
        run.add_picture(ph_path, width=_In(width_inches))
    return p


_placeholder_cache = {}


def ensure_placeholder_image(label):
    if label in _placeholder_cache:
        return _placeholder_cache[label]
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.patches import FancyBboxPatch
    fig, ax = plt.subplots(figsize=(6.2, 3.6))
    ax.add_patch(FancyBboxPatch((0.03, 0.03), 0.94, 0.94, boxstyle="round,pad=0.02",
                                 facecolor="#FAFAFA", edgecolor="#999999",
                                 linewidth=1.4, linestyle="--"))
    ax.text(0.5, 0.58, "SCREENSHOT PLACEHOLDER", ha="center", va="center",
            fontsize=13, fontweight="bold", color="#666666")
    import textwrap
    wrapped = "\n".join(textwrap.wrap(label, 46))
    ax.text(0.5, 0.38, wrapped, ha="center", va="center", fontsize=9.5, color="#444444")
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis("off")
    safe_name = re.sub(r"[^a-zA-Z0-9]+", "_", label)[:40]
    out_path = os.path.join(ASSETS_DIR, "placeholder_%s.png" % safe_name)
    fig.savefig(out_path, dpi=180, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    _placeholder_cache[label] = out_path
    return out_path


def add_code_block(doc, code_text):
    lines = code_text.strip("\n").split("\n")
    p = doc.add_paragraph(style="CodeBlock")
    for i, line in enumerate(lines):
        if i > 0:
            p.add_run().add_break()
        p.add_run(line if line.strip() else " ")
    shading = OxmlElement("w:shd")
    shading.set(qn("w:val"), "clear")
    shading.set(qn("w:fill"), "F2F2F2")
    p.paragraph_format.element.get_or_add_pPr().append(shading)
    pbdr = OxmlElement("w:pBdr")
    for side in ("top", "left", "bottom", "right"):
        el = OxmlElement("w:%s" % side)
        el.set(qn("w:val"), "single")
        el.set(qn("w:sz"), "4")
        el.set(qn("w:space"), "4")
        el.set(qn("w:color"), "CCCCCC")
        pbdr.append(el)
    p.paragraph_format.element.get_or_add_pPr().append(pbdr)
    return p


# ---------------------------------------------------------------------------
# Chapter markdown parser
# ---------------------------------------------------------------------------

def parse_markdown_table_block(lines, start_idx):
    rows = []
    i = start_idx
    while i < len(lines) and lines[i].strip().startswith("|"):
        raw = lines[i].strip()
        if re.match(r"^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?$", raw):
            i += 1
            continue
        cells = [c.strip() for c in raw.strip("|").split("|")]
        rows.append(cells)
        i += 1
    return rows, i


def render_chapter_markdown(doc, text, figure_map):
    """
    Parses the structured chapter text produced by the drafting subagents
    and appends the corresponding Word content to `doc`.
    figure_map: dict figure_placeholder_id -> absolute image path (or None
    for a labeled placeholder, e.g. Chapter 6 screenshots).
    """
    lines = text.replace("\r\n", "\n").split("\n")
    i = 0
    pending_figure_caption = None
    in_code = False
    code_buf = []
    while i < len(lines):
        raw = lines[i]
        line = raw.rstrip()
        stripped = line.strip()

        if stripped.startswith("```"):
            if not in_code:
                in_code = True
                code_buf = []
            else:
                in_code = False
                add_code_block(doc, "\n".join(code_buf))
            i += 1
            continue
        if in_code:
            code_buf.append(line)
            i += 1
            continue

        if not stripped:
            i += 1
            continue

        if stripped.startswith("### "):
            doc.add_paragraph(stripped[4:].strip(), style="Heading 3")
            i += 1
            continue
        if stripped.startswith("## "):
            doc.add_paragraph(stripped[3:].strip(), style="Heading 2")
            i += 1
            continue
        if stripped.startswith("# "):
            doc.add_paragraph(stripped[2:].strip(), style="Heading 2")
            i += 1
            continue

        if stripped.upper().startswith("TABLE_CAPTION:"):
            caption = stripped.split(":", 1)[1].strip()
            j = i + 1
            while j < len(lines) and not lines[j].strip().startswith("|"):
                if lines[j].strip():
                    break
                j += 1
            add_table_caption_with_tc(doc, caption)
            if j < len(lines) and lines[j].strip().startswith("|"):
                rows, j2 = parse_markdown_table_block(lines, j)
                add_markdown_table(doc, rows)
                i = j2
            else:
                i = j
            continue

        if stripped.upper().startswith("FIGURE_CAPTION:"):
            pending_figure_caption = stripped.split(":", 1)[1].strip()
            i += 1
            continue

        if stripped.upper().startswith("FIGURE_PLACEHOLDER:"):
            fig_id = stripped.split(":", 1)[1].strip()
            caption = pending_figure_caption or fig_id
            img_path = figure_map.get(fig_id)
            add_figure(doc, img_path, placeholder_label=caption)
            add_figure_caption(doc, caption)
            pending_figure_caption = None
            i += 1
            continue

        if stripped.startswith("|"):
            rows, j2 = parse_markdown_table_block(lines, i)
            add_markdown_table(doc, rows)
            i = j2
            continue

        # regular paragraph (possibly multi-line — merge until blank line or special marker)
        para_lines = [stripped]
        i += 1
        while i < len(lines) and lines[i].strip() and not lines[i].strip().startswith(("#", "|", "```")) \
                and not lines[i].strip().upper().startswith(("TABLE_CAPTION:", "FIGURE_CAPTION:", "FIGURE_PLACEHOLDER:")):
            para_lines.append(lines[i].strip())
            i += 1
        add_paragraph_text(doc, " ".join(para_lines))
    return doc
