"""Generate FYP documentation PDF from markdown source."""
from __future__ import annotations

import re
import sys
from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parent
MD_FILE = ROOT / "FYP-Recommendation-System-Documentation.md"
PDF_FILE = ROOT / "FYP-Recommendation-System-Documentation.pdf"


class FypDocPDF(FPDF):
    def header(self):
        if self.page_no() > 1:
            self.set_font("Helvetica", "I", 8)
            self.set_text_color(100, 100, 100)
            self.cell(0, 8, "ChaletsBooking (IARS) - FYP Recommendation System Documentation", align="C")
            self.ln(4)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(100, 100, 100)
        self.cell(0, 10, f"Page {self.page_no()}", align="C")


def sanitize(text: str) -> str:
    replacements = {
        "\u2014": "-",
        "\u2013": "-",
        "\u2018": "'",
        "\u2019": "'",
        "\u201c": '"',
        "\u201d": '"',
        "\u2192": "->",
        "\u2265": ">=",
        "\u2264": "<=",
        "\u00d7": "x",
        "\u2212": "-",
        "\u2022": "-",
        "\u2705": "[OK]",
    }
    for src, dst in replacements.items():
        text = text.replace(src, dst)
    return text.encode("latin-1", errors="replace").decode("latin-1")


def write_wrapped(pdf: FypDocPDF, text: str, size: int = 10, style: str = "", lh: float = 5.5):
    text = sanitize(text).strip()
    if not text:
        return
    pdf.set_font("Helvetica", style, size)
    usable_width = pdf.w - pdf.l_margin - pdf.r_margin
    if usable_width < 10:
        pdf.add_page()
        usable_width = pdf.w - pdf.l_margin - pdf.r_margin
    pdf.multi_cell(usable_width, lh, text)


def parse_markdown_to_pdf(md_path: Path, pdf_path: Path) -> None:
    lines = md_path.read_text(encoding="utf-8").splitlines()
    pdf = FypDocPDF()
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.add_page()

    in_code = False
    code_buffer: list[str] = []
    in_table = False

    for raw in lines:
        line = raw.rstrip()

        if line.strip().startswith("```"):
            if in_code:
                pdf.set_font("Courier", "", 8)
                pdf.set_fill_color(245, 245, 245)
                block = "\n".join(code_buffer)
                usable_width = pdf.w - pdf.l_margin - pdf.r_margin
                pdf.multi_cell(usable_width, 4.5, sanitize(block), fill=True)
                pdf.ln(2)
                code_buffer = []
                in_code = False
            else:
                in_code = True
            continue

        if in_code:
            code_buffer.append(line)
            continue

        if line.startswith("# "):
            pdf.ln(4)
            write_wrapped(pdf, line[2:].strip(), size=18, style="B", lh=8)
            pdf.ln(2)
            continue

        if line.startswith("## "):
            pdf.ln(3)
            write_wrapped(pdf, line[3:].strip(), size=14, style="B", lh=7)
            pdf.ln(1)
            continue

        if line.startswith("### "):
            pdf.ln(2)
            write_wrapped(pdf, line[4:].strip(), size=12, style="B", lh=6)
            pdf.ln(1)
            continue

        if line.startswith("#### "):
            pdf.ln(1)
            write_wrapped(pdf, line[5:].strip(), size=11, style="B", lh=6)
            continue

        if line.strip() == "---":
            pdf.ln(2)
            pdf.set_draw_color(200, 200, 200)
            pdf.line(pdf.l_margin, pdf.get_y(), pdf.w - pdf.r_margin, pdf.get_y())
            pdf.ln(3)
            continue

        if line.strip().startswith("|") and "|" in line:
            cells = [c.strip() for c in line.strip().strip("|").split("|")]
            if all(set(c) <= {"-", ":", " "} for c in cells):
                in_table = True
                continue
            pdf.set_font("Helvetica", "", 9)
            row = " | ".join(cells)
            usable_width = pdf.w - pdf.l_margin - pdf.r_margin
            pdf.multi_cell(usable_width, 5, sanitize(row))
            in_table = False
            continue

        if line.strip().startswith("- ") or line.strip().startswith("* "):
            bullet = re.sub(r"^\s*[-*]\s+", "", line)
            bullet = re.sub(r"\*\*(.+?)\*\*", r"\1", bullet)
            write_wrapped(pdf, f"  - {bullet.strip()}", size=10)
            continue

        if re.match(r"^\d+\.\s", line.strip()):
            write_wrapped(pdf, f"  {line.strip()}", size=10)
            continue

        if not line.strip():
            if not in_table:
                pdf.ln(2)
            continue

        clean = re.sub(r"\*\*(.+?)\*\*", r"\1", line)
        clean = re.sub(r"`(.+?)`", r"\1", clean)
        clean = re.sub(r"\[(.+?)\]\(.+?\)", r"\1", clean)
        write_wrapped(pdf, clean.strip(), size=10)

    pdf.output(str(pdf_path))
    print(f"PDF generated: {pdf_path}")


if __name__ == "__main__":
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else MD_FILE
    dst = Path(sys.argv[2]) if len(sys.argv) > 2 else PDF_FILE
    parse_markdown_to_pdf(src, dst)
