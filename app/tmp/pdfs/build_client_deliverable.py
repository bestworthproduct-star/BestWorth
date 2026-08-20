from pathlib import Path
import html
import re

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    ListFlowable,
    ListItem,
    PageBreak,
    PageTemplate,
    Paragraph,
    Preformatted,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "CLIENT_DELIVERABLE_2026-08-20.md"
OUTPUT = ROOT / "output" / "pdf" / "Bestworth_Client_Delivery_and_Test_Guide_2026-08-20.pdf"
OUTPUT.parent.mkdir(parents=True, exist_ok=True)

NAVY = colors.HexColor("#102B4C")
BLUE = colors.HexColor("#060273")
RED = colors.HexColor("#D64545")
PALE = colors.HexColor("#F5F8FC")
MID = colors.HexColor("#64748B")
LINE = colors.HexColor("#D9E1EA")
WHITE = colors.white


def inline_markup(text: str) -> str:
    text = text.replace("—", "-").replace("–", "-").replace("‑", "-")
    safe = html.escape(text.strip())
    safe = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", safe)
    safe = re.sub(r"`(.+?)`", r'<font name="Courier">\1</font>', safe)
    return safe


styles = getSampleStyleSheet()
styles.add(ParagraphStyle(
    name="BodyBW", parent=styles["BodyText"], fontName="Helvetica", fontSize=9.4,
    leading=14.2, textColor=NAVY, spaceAfter=5.5 * mm, allowWidows=0, allowOrphans=0,
))
styles.add(ParagraphStyle(
    name="H1BW", parent=styles["Heading1"], fontName="Helvetica", fontSize=20,
    leading=24, textColor=NAVY, spaceBefore=2 * mm, spaceAfter=6 * mm, keepWithNext=True,
))
styles.add(ParagraphStyle(
    name="H2BW", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=14,
    leading=18, textColor=NAVY, spaceBefore=5 * mm, spaceAfter=4 * mm, keepWithNext=True,
))
styles.add(ParagraphStyle(
    name="H3BW", parent=styles["Heading3"], fontName="Helvetica-Bold", fontSize=10.8,
    leading=14, textColor=BLUE, spaceBefore=4 * mm, spaceAfter=2.5 * mm, keepWithNext=True,
))
styles.add(ParagraphStyle(
    name="SmallBW", parent=styles["BodyText"], fontName="Helvetica", fontSize=7.7,
    leading=11, textColor=MID,
))
styles.add(ParagraphStyle(
    name="ListBW", parent=styles["BodyBW"], leftIndent=0, firstLineIndent=0,
    spaceAfter=1.5 * mm,
))
styles.add(ParagraphStyle(
    name="ExpectedBW", parent=styles["BodyBW"], fontName="Helvetica-Bold", fontSize=9,
    leading=13.5, textColor=NAVY, leftIndent=4 * mm, rightIndent=4 * mm,
    borderColor=LINE, borderWidth=0.6, borderPadding=4 * mm, backColor=PALE,
    spaceBefore=2 * mm, spaceAfter=6 * mm,
))
styles.add(ParagraphStyle(
    name="CodeBW", fontName="Courier", fontSize=8, leading=11, textColor=NAVY,
    leftIndent=5 * mm, rightIndent=5 * mm, borderColor=LINE, borderWidth=0.5,
    borderPadding=3 * mm, backColor=PALE, spaceAfter=5 * mm,
))


class BestworthDocTemplate(BaseDocTemplate):
    def afterPage(self):
        pass


def draw_page(canvas, doc):
    page = canvas.getPageNumber()
    width, height = A4
    canvas.saveState()
    if page == 1:
        canvas.setFillColor(BLUE)
        canvas.rect(0, 0, width, height, fill=1, stroke=0)
        canvas.setFillColor(RED)
        canvas.rect(0, height - 9 * mm, width, 9 * mm, fill=1, stroke=0)
        canvas.setStrokeColor(colors.Color(1, 1, 1, alpha=0.16))
        canvas.setLineWidth(0.8)
        canvas.circle(width - 25 * mm, 30 * mm, 42 * mm, fill=0, stroke=1)
        canvas.circle(width - 25 * mm, 30 * mm, 25 * mm, fill=0, stroke=1)
    else:
        canvas.setStrokeColor(LINE)
        canvas.setLineWidth(0.45)
        canvas.line(20 * mm, height - 15 * mm, width - 20 * mm, height - 15 * mm)
        canvas.setFont("Helvetica-Bold", 7)
        canvas.setFillColor(NAVY)
        canvas.drawString(20 * mm, height - 11.5 * mm, "BESTWORTH PRODUCTS LIMITED")
        canvas.setFont("Helvetica", 7)
        canvas.setFillColor(MID)
        canvas.drawRightString(width - 20 * mm, height - 11.5 * mm, "CLIENT DELIVERY & ACCEPTANCE GUIDE")
        canvas.line(20 * mm, 14 * mm, width - 20 * mm, 14 * mm)
        canvas.drawString(20 * mm, 9.5 * mm, "20 AUGUST 2026")
        canvas.drawRightString(width - 20 * mm, 9.5 * mm, f"PAGE {page}")
    canvas.restoreState()


doc = BestworthDocTemplate(
    str(OUTPUT), pagesize=A4,
    leftMargin=20 * mm, rightMargin=20 * mm, topMargin=21 * mm, bottomMargin=19 * mm,
    title="Bestworth Client Delivery and Acceptance Test Guide",
    author="Bestworth Products Limited",
    subject="System delivery summary and client acceptance testing guide",
)
frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="content")
doc.addPageTemplates([PageTemplate(id="all", frames=[frame], onPage=draw_page)])

story = []

# Cover
story.extend([
    Spacer(1, 49 * mm),
    Paragraph("BESTWORTH PRODUCTS LIMITED", ParagraphStyle(
        "CoverEyebrow", fontName="Helvetica-Bold", fontSize=8.5, leading=11,
        textColor=colors.HexColor("#F17B72"), tracking=2.1, spaceAfter=8 * mm,
    )),
    Paragraph("Client Delivery &<br/>Acceptance Test Guide", ParagraphStyle(
        "CoverTitle", fontName="Helvetica", fontSize=29, leading=35,
        textColor=WHITE, spaceAfter=9 * mm,
    )),
    Paragraph("Role-based administration, News & Media, newsletter capture, video publishing and public-site experience improvements.", ParagraphStyle(
        "CoverSub", fontName="Helvetica", fontSize=11, leading=17,
        textColor=colors.HexColor("#CFD8E5"), spaceAfter=18 * mm, rightIndent=34 * mm,
    )),
])

metrics = Table([
    [Paragraph("6", ParagraphStyle("Metric", fontName="Helvetica", fontSize=22, textColor=WHITE)),
     Paragraph("50MB", ParagraphStyle("Metric2", fontName="Helvetica", fontSize=22, textColor=WHITE)),
     Paragraph("10", ParagraphStyle("Metric3", fontName="Helvetica", fontSize=22, textColor=WHITE))],
    [Paragraph("permission modules", styles["SmallBW"]),
     Paragraph("video upload limit", styles["SmallBW"]),
     Paragraph("acceptance tests", styles["SmallBW"])],
], colWidths=[52 * mm, 52 * mm, 52 * mm], rowHeights=[10 * mm, 8 * mm])
metrics.setStyle(TableStyle([
    ("TEXTCOLOR", (0, 1), (-1, 1), colors.HexColor("#B9C6D7")),
    ("LINEBEFORE", (1, 0), (1, -1), 0.5, colors.Color(1, 1, 1, alpha=0.2)),
    ("LINEBEFORE", (2, 0), (2, -1), 0.5, colors.Color(1, 1, 1, alpha=0.2)),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("LEFTPADDING", (0, 0), (-1, -1), 0),
    ("RIGHTPADDING", (0, 0), (-1, -1), 5 * mm),
    ("TOPPADDING", (0, 0), (-1, -1), 0),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
]))
story.extend([
    metrics,
    Spacer(1, 24 * mm),
    Paragraph("DELIVERY DATE", ParagraphStyle("CoverLabel", fontName="Helvetica-Bold", fontSize=7, textColor=colors.HexColor("#AAB9CC"), tracking=1.7)),
    Spacer(1, 2 * mm),
    Paragraph("20 August 2026", ParagraphStyle("CoverDate", fontName="Helvetica", fontSize=10, textColor=WHITE)),
    PageBreak(),
])

# Executive contents page
story.extend([
    Paragraph("Document overview", styles["H1BW"]),
    Paragraph("This handoff records the delivered system capabilities, the deployment conditions required before review, and a structured client acceptance process.", styles["BodyBW"]),
    Spacer(1, 3 * mm),
])
contents = [
    ("01", "Delivery summary", "Owner and worker access, publishing, newsletter and public experience"),
    ("02", "Deployment checklist", "Environment, backend restart and one-time role migration"),
    ("03", "Client acceptance tests", "Ten practical tests with clear expected outcomes"),
    ("04", "Acceptance record", "A concise sign-off matrix for the client review"),
    ("05", "Operational notes", "Autoplay, external services, upload limits and account deletion"),
]
for number, title, description in contents:
    row = Table([[Paragraph(number, ParagraphStyle("TOCNo", fontName="Helvetica-Bold", fontSize=9, textColor=RED)),
                  Paragraph(f"<b>{title}</b><br/><font color='#64748B' size='8'>{description}</font>", styles["BodyBW"])]],
                colWidths=[14 * mm, 140 * mm])
    row.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBELOW", (0, 0), (-1, -1), 0.45, LINE),
        ("TOPPADDING", (0, 0), (-1, -1), 4 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4 * mm),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3 * mm),
    ]))
    story.append(row)
story.append(PageBreak())


lines = SOURCE.read_text(encoding="utf-8").splitlines()
# Skip the Markdown title and metadata block; the PDF cover replaces it.
start_index = next(i for i, line in enumerate(lines) if line.startswith("## 1."))
lines = lines[start_index:]

i = 0
while i < len(lines):
    line = lines[i].strip()
    if not line:
        i += 1
        continue

    if line.startswith("## "):
        if story and not isinstance(story[-1], PageBreak):
            story.append(PageBreak())
        story.append(Paragraph(inline_markup(line[3:]), styles["H1BW"]))
        i += 1
        continue

    if line.startswith("### "):
        story.append(Paragraph(inline_markup(line[4:]), styles["H2BW"] if line.startswith("### Test") else styles["H3BW"]))
        i += 1
        continue

    if line.startswith("```text"):
        code_lines = []
        i += 1
        while i < len(lines) and not lines[i].strip().startswith("```"):
            code_lines.append(lines[i].strip())
            i += 1
        story.append(Preformatted("\n".join(code_lines), styles["CodeBW"]))
        i += 1
        continue

    if line.startswith("| "):
        table_lines = []
        while i < len(lines) and lines[i].strip().startswith("|"):
            table_lines.append(lines[i].strip())
            i += 1
        rows = []
        for idx, raw in enumerate(table_lines):
            cells = [cell.strip() for cell in raw.strip("|").split("|")]
            if idx == 1 and all(set(cell) <= {"-", ":"} for cell in cells):
                continue
            style = ParagraphStyle("TableHead" if idx == 0 else "TableCell", parent=styles["SmallBW"], fontName="Helvetica-Bold" if idx == 0 else "Helvetica", textColor=WHITE if idx == 0 else NAVY, leading=10)
            rows.append([Paragraph(inline_markup(cell), style) for cell in cells])
        table = Table(rows, colWidths=[64 * mm, 30 * mm, 60 * mm], repeatRows=1)
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), NAVY),
            ("GRID", (0, 0), (-1, -1), 0.4, LINE),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 3 * mm),
            ("RIGHTPADDING", (0, 0), (-1, -1), 3 * mm),
            ("TOPPADDING", (0, 0), (-1, -1), 3 * mm),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3 * mm),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, PALE]),
        ]))
        story.extend([table, Spacer(1, 5 * mm)])
        continue

    if re.match(r"^\d+\. ", line):
        items = []
        start_number = int(re.match(r"^(\d+)\. ", line).group(1))
        while i < len(lines) and re.match(r"^\d+\. ", lines[i].strip()):
            item_text = re.sub(r"^\d+\.\s+", "", lines[i].strip())
            items.append(ListItem(Paragraph(inline_markup(item_text), styles["ListBW"]), leftIndent=5 * mm))
            i += 1
        story.append(ListFlowable(items, bulletType="1", start=str(start_number), leftIndent=7 * mm, bulletFontName="Helvetica-Bold", bulletFontSize=8, bulletColor=RED, spaceAfter=4 * mm))
        continue

    if line.startswith("- "):
        items = []
        while i < len(lines) and lines[i].strip().startswith("- "):
            item_text = lines[i].strip()[2:]
            items.append(ListItem(Paragraph(inline_markup(item_text), styles["ListBW"]), leftIndent=5 * mm))
            i += 1
        story.append(ListFlowable(items, bulletType="bullet", bulletChar="-", leftIndent=7 * mm, bulletFontName="Helvetica", bulletFontSize=8, bulletColor=RED, spaceAfter=4 * mm))
        continue

    if line.startswith("**Expected result:**"):
        story.append(Paragraph(inline_markup(line), styles["ExpectedBW"]))
        i += 1
        continue

    story.append(Paragraph(inline_markup(line), styles["BodyBW"]))
    i += 1

doc.build(story)
print(OUTPUT)
