from pathlib import Path

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor


OUTPUT = Path(r"C:\Users\divin\Downloads\BestWorth\output\documents\BestWorth_Client_Discovery_Questionnaire.docx")

NAVY = "102B4C"
DEEP_BLUE = "0A0875"
RED = "D64545"
INK = "213547"
MUTED = "66788A"
LINE = "D9E1E8"
PALE = "F4F7FA"
PALE_BLUE = "EEF3F8"
WHITE = "FFFFFF"


def set_cell_shading(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill)


def set_cell_border(cell, **edges):
    tc_pr = cell._tc.get_or_add_tcPr()
    borders = tc_pr.first_child_found_in("w:tcBorders")
    if borders is None:
        borders = OxmlElement("w:tcBorders")
        tc_pr.append(borders)
    for edge, attrs in edges.items():
        tag = "w:" + edge
        element = borders.find(qn(tag))
        if element is None:
            element = OxmlElement(tag)
            borders.append(element)
        for key, value in attrs.items():
            element.set(qn("w:" + key), str(value))


def set_cell_margins(cell, top=100, start=130, bottom=100, end=130):
    tc = cell._tc
    tc_pr = tc.get_or_add_tcPr()
    tc_mar = tc_pr.first_child_found_in("w:tcMar")
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tc_pr.append(tc_mar)
    for margin, value in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = tc_mar.find(qn("w:" + margin))
        if node is None:
            node = OxmlElement("w:" + margin)
            tc_mar.append(node)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")


def prevent_row_split(row):
    tr_pr = row._tr.get_or_add_trPr()
    node = OxmlElement("w:cantSplit")
    tr_pr.append(node)


def repeat_table_header(row):
    tr_pr = row._tr.get_or_add_trPr()
    node = OxmlElement("w:tblHeader")
    node.set(qn("w:val"), "true")
    tr_pr.append(node)


def set_repeat_table_header(row):
    repeat_table_header(row)


def keep_paragraph(paragraph, keep_next=False):
    p_pr = paragraph._p.get_or_add_pPr()
    keep = OxmlElement("w:keepLines")
    p_pr.append(keep)
    if keep_next:
        nxt = OxmlElement("w:keepNext")
        p_pr.append(nxt)


def set_run_font(run, size=None, bold=None, color=None, name="Calibri"):
    run.font.name = name
    run._element.rPr.rFonts.set(qn("w:eastAsia"), name)
    if size:
        run.font.size = Pt(size)
    if bold is not None:
        run.bold = bold
    if color:
        run.font.color.rgb = RGBColor.from_string(color)


def add_page_number(paragraph):
    paragraph.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    run = paragraph.add_run("PAGE ")
    set_run_font(run, 8, True, MUTED)
    fld_char1 = OxmlElement("w:fldChar")
    fld_char1.set(qn("w:fldCharType"), "begin")
    instr_text = OxmlElement("w:instrText")
    instr_text.set(qn("xml:space"), "preserve")
    instr_text.text = " PAGE "
    fld_char2 = OxmlElement("w:fldChar")
    fld_char2.set(qn("w:fldCharType"), "end")
    run._r.extend([fld_char1, instr_text, fld_char2])


def add_response_lines(cell, count=2, hint="Type response here"):
    cell.text = ""
    p = cell.paragraphs[0]
    p.paragraph_format.space_after = Pt(4)
    run = p.add_run(hint)
    run.italic = True
    set_run_font(run, 9, False, MUTED)
    for _ in range(max(1, count - 1)):
        p = cell.add_paragraph("________________________________________________________________________________")
        p.paragraph_format.space_before = Pt(3)
        p.paragraph_format.space_after = Pt(0)
        for r in p.runs:
            set_run_font(r, 8, False, LINE)


def add_question(doc, number, question, choices=None, lines=2, note=None, critical=False):
    table = doc.add_table(rows=2, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    table.columns[0].width = Inches(6.5)
    table.rows[0].cells[0].width = Inches(6.5)
    qcell = table.rows[0].cells[0]
    acell = table.rows[1].cells[0]
    for cell in (qcell, acell):
        set_cell_margins(cell)
        set_cell_border(cell, top={"val": "single", "sz": 6, "color": LINE}, bottom={"val": "single", "sz": 6, "color": LINE}, start={"val": "single", "sz": 6, "color": LINE}, end={"val": "single", "sz": 6, "color": LINE})
    set_cell_shading(qcell, PALE_BLUE if critical else PALE)
    set_cell_shading(acell, WHITE)
    qcell.text = ""
    p = qcell.paragraphs[0]
    p.paragraph_format.space_after = Pt(0)
    label = p.add_run(f"{number}  ")
    set_run_font(label, 9.5, True, RED if critical else DEEP_BLUE)
    if critical:
        tag = p.add_run("DECISION REQUIRED  ")
        set_run_font(tag, 7.5, True, RED)
    run = p.add_run(question)
    set_run_font(run, 9.5, True, INK)
    keep_paragraph(p, True)
    acell.text = ""
    if choices:
        p = acell.paragraphs[0]
        p.paragraph_format.space_after = Pt(4)
        run = p.add_run("Select one or more:  " + "    ".join(f"☐ {item}" for item in choices))
        set_run_font(run, 9, False, INK)
        if lines:
            p2 = acell.add_paragraph("Additional detail: ______________________________________________________________")
            p2.paragraph_format.space_after = Pt(0)
            for r in p2.runs:
                set_run_font(r, 8.5, False, MUTED)
    elif lines <= 0:
        p = acell.paragraphs[0]
        run = p.add_run("Complete the table below or attach an approved document.")
        run.italic = True
        set_run_font(run, 8.5, False, MUTED)
    else:
        add_response_lines(acell, lines)
    if note:
        p = acell.add_paragraph(note)
        p.paragraph_format.space_before = Pt(5)
        p.paragraph_format.space_after = Pt(0)
        run = p.runs[0]
        run.italic = True
        set_run_font(run, 8, False, MUTED)
    for row in table.rows:
        prevent_row_split(row)
    doc.add_paragraph().paragraph_format.space_after = Pt(1)


def add_section_heading(doc, number, title, intro=None):
    p = doc.add_paragraph()
    p.style = doc.styles["Heading 1"]
    p.paragraph_format.space_before = Pt(12)
    p.paragraph_format.space_after = Pt(4)
    r1 = p.add_run(f"{number}  ")
    set_run_font(r1, 10, True, RED)
    r2 = p.add_run(title)
    set_run_font(r2, 15, True, NAVY)
    keep_paragraph(p, True)
    if intro:
        p = doc.add_paragraph(intro)
        p.paragraph_format.space_after = Pt(8)
        for r in p.runs:
            set_run_font(r, 9, False, MUTED)
        keep_paragraph(p, True)


def add_simple_table(doc, headers, rows, widths=None):
    table = doc.add_table(rows=1, cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    hdr = table.rows[0]
    for idx, header in enumerate(headers):
        cell = hdr.cells[idx]
        if widths:
            cell.width = Inches(widths[idx])
        set_cell_shading(cell, NAVY)
        set_cell_margins(cell, top=90, bottom=90)
        cell.text = header
        for r in cell.paragraphs[0].runs:
            set_run_font(r, 8, True, WHITE)
        cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
    repeat_table_header(hdr)
    prevent_row_split(hdr)
    for row_values in rows:
        row = table.add_row()
        prevent_row_split(row)
        for idx, value in enumerate(row_values):
            cell = row.cells[idx]
            if widths:
                cell.width = Inches(widths[idx])
            set_cell_margins(cell, top=80, bottom=80)
            set_cell_shading(cell, WHITE)
            set_cell_border(cell, bottom={"val": "single", "sz": 4, "color": LINE}, start={"val": "single", "sz": 4, "color": LINE}, end={"val": "single", "sz": 4, "color": LINE})
            cell.text = value
            for r in cell.paragraphs[0].runs:
                set_run_font(r, 8.3, False, MUTED if "Type" in value or "List" in value else INK)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    return table


def build_document():
    doc = Document()
    doc.settings.odd_and_even_pages_header_footer = True
    section = doc.sections[0]
    section.different_first_page_header_footer = False
    section.page_width = Inches(8.5)
    section.page_height = Inches(11)
    section.top_margin = Inches(0.78)
    section.bottom_margin = Inches(0.7)
    section.left_margin = Inches(1)
    section.right_margin = Inches(1)
    section.header_distance = Inches(0.35)
    section.footer_distance = Inches(0.35)

    normal = doc.styles["Normal"]
    normal.font.name = "Calibri"
    normal._element.rPr.rFonts.set(qn("w:eastAsia"), "Calibri")
    normal.font.size = Pt(9.5)
    normal.font.color.rgb = RGBColor.from_string(INK)
    normal.paragraph_format.space_after = Pt(6)
    normal.paragraph_format.line_spacing = 1.08

    for style_name in ("Heading 1", "Heading 2", "Heading 3"):
        style = doc.styles[style_name]
        style.font.name = "Calibri"
        style._element.rPr.rFonts.set(qn("w:eastAsia"), "Calibri")
        style.font.color.rgb = RGBColor.from_string(NAVY)

    # Compact customer-pack header and footer. Populate both odd and even
    # definitions explicitly because Microsoft Word preserves parity-specific
    # parts even when a document begins from a minimal template.
    def populate_header(header):
        table = header.add_table(rows=1, cols=2, width=Inches(6.5))
        table.autofit = False
        table.columns[0].width = Inches(4.7)
        table.columns[1].width = Inches(1.8)
        left, right = table.rows[0].cells
        left.text = "BESTWORTH PRODUCTS LIMITED"
        right.text = "DISCOVERY QUESTIONNAIRE"
        for r in left.paragraphs[0].runs:
            set_run_font(r, 8, True, NAVY)
        right.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.RIGHT
        for r in right.paragraphs[0].runs:
            set_run_font(r, 7.5, True, RED)
        for c in (left, right):
            set_cell_border(c, bottom={"val": "single", "sz": 8, "color": LINE})
            set_cell_margins(c, top=20, bottom=60, start=0, end=0)

    def populate_footer(footer):
        p = footer.paragraphs[0]
        p.text = "Confidential business requirements • Version 1.0 • 24 August 2026"
        for r in p.runs:
            set_run_font(r, 7.5, False, MUTED)
        add_page_number(footer.add_paragraph())

    populate_header(section.header)
    populate_header(section.even_page_header)
    populate_footer(section.footer)
    populate_footer(section.even_page_footer)

    # Opening panel.
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(14)
    p.paragraph_format.space_after = Pt(3)
    r = p.add_run("BUSINESS DISCOVERY")
    set_run_font(r, 8, True, RED)
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(5)
    r = p.add_run("Retail & Product Breakdown Questionnaire")
    set_run_font(r, 20, True, NAVY)
    keep_paragraph(p, True)
    p = doc.add_paragraph("Information required before the Builders Mart website section and internal product breakdown workflow are designed or built.")
    p.paragraph_format.space_after = Pt(12)
    for r in p.runs:
        set_run_font(r, 10, False, MUTED)

    meta = doc.add_table(rows=2, cols=4)
    meta.alignment = WD_TABLE_ALIGNMENT.CENTER
    meta.autofit = False
    labels = [("Completed by", "Type name"), ("Role / department", "Type role"), ("Date", "DD / MM / YYYY"), ("Contact", "Type email or phone")]
    for idx, (label, value) in enumerate(labels):
        row = idx // 2
        col = (idx % 2) * 2
        lc, vc = meta.rows[row].cells[col], meta.rows[row].cells[col + 1]
        lc.width = Inches(1.25)
        vc.width = Inches(2.0)
        set_cell_shading(lc, PALE_BLUE)
        set_cell_shading(vc, WHITE)
        set_cell_margins(lc)
        set_cell_margins(vc)
        set_cell_border(lc, bottom={"val": "single", "sz": 5, "color": LINE})
        set_cell_border(vc, bottom={"val": "single", "sz": 5, "color": LINE})
        lc.text = label.upper()
        vc.text = value
        for r in lc.paragraphs[0].runs:
            set_run_font(r, 7.5, True, NAVY)
        for r in vc.paragraphs[0].runs:
            r.italic = True
            set_run_font(r, 8.5, False, MUTED)
    doc.add_paragraph()

    callout = doc.add_table(rows=1, cols=1)
    cell = callout.cell(0, 0)
    set_cell_shading(cell, PALE_BLUE)
    set_cell_margins(cell, top=140, start=170, bottom=140, end=170)
    set_cell_border(cell, start={"val": "single", "sz": 22, "color": RED})
    cell.text = ""
    p = cell.paragraphs[0]
    r = p.add_run("HOW TO COMPLETE")
    set_run_font(r, 8, True, RED)
    p = cell.add_paragraph("Complete this with the people responsible for retail operations, pricing, accounts and website content. Tick the closest option, add detail where requested, and write N/A where a question does not apply.")
    p.paragraph_format.space_after = Pt(4)
    for r in p.runs:
        set_run_font(r, 9, False, INK)
    p = cell.add_paragraph("Please attach existing examples. Do not include passwords, private keys or complete bank account numbers in this document.")
    p.paragraph_format.space_after = Pt(0)
    for r in p.runs:
        r.bold = True
        set_run_font(r, 8.5, True, NAVY)

    add_section_heading(doc, "01", "Organization identity & ownership", "Confirm the names and relationships that must appear publicly and on official documents.")
    add_question(doc, "1.1", "What is the exact legal name of the main company?", lines=1, critical=True, note="Please confirm spelling exactly as registered; the voice-note transcription may contain errors.")
    add_question(doc, "1.2", "What public trading or brand name should visitors see?", lines=1)
    add_question(doc, "1.3", "Is “BestWorth Builders Mart” the confirmed retail name?", ["Yes", "No", "Name still being decided"], lines=1, critical=True)
    add_question(doc, "1.4", "How is the Builders Mart related to the main company?", ["Department", "Trading division", "Subsidiary", "Separate company", "Not yet decided"], lines=1, critical=True)
    add_question(doc, "1.5", "List any other company, division or sub-company names that must be represented and explain their relationship.", lines=3)
    add_question(doc, "1.6", "Which legal name, logo, address and contact details must appear on generated breakdown documents?", lines=3, critical=True)

    add_section_heading(doc, "02", "Builders Mart purpose & offering", "Define what the retail section promises and what visitors should be able to do.")
    add_question(doc, "2.1", "What is the primary purpose of the Builders Mart section?", ["Introduce the retail outlet", "Show products", "Collect enquiries", "Take orders", "Accept online payment"], lines=1, critical=True)
    add_question(doc, "2.2", "Should this phase include e-commerce features?", ["No—information and enquiry only", "Order request without payment", "Cart and checkout", "Not yet decided"], lines=1, critical=True)
    add_question(doc, "2.3", "Who are the main customers?", ["Individuals", "Retailers", "Contractors", "Developers", "Government / institutions", "Other"], lines=1)
    add_question(doc, "2.4", "Which products are manufactured by BestWorth, and which are supplied or resold?", lines=4)
    add_question(doc, "2.5", "Should Builders Mart use the existing product catalogue or maintain a separate retail catalogue?", ["Use existing catalogue", "Separate catalogue", "Shared products with retail-only details", "Not decided"], lines=1, critical=True)
    add_question(doc, "2.6", "What action should visitors take from the section?", ["Make an enquiry", "Call", "WhatsApp", "Visit the store", "Request a quotation", "Start an order"], lines=1)
    add_question(doc, "2.7", "Provide the retail location, service areas, phone/WhatsApp, opening hours and delivery information.", lines=4)
    add_question(doc, "2.8", "What content will be available for launch?", ["Store photographs", "Product photographs", "Retail logo", "Map/location", "Price information", "Promotional copy"], lines=1)

    add_section_heading(doc, "03", "Public website placement & presentation", "Resolve the requested homepage order without disturbing the current page structure.")
    add_question(doc, "3.1", "Where should Builders Mart appear on the homepage?", ["Before News & Media", "After News & Media", "Before Products", "Other"], lines=1, critical=True)
    add_question(doc, "3.2", "In the voice note, what did “before the placeholder” refer to? Name or describe the exact existing section.", lines=2, critical=True)
    add_question(doc, "3.3", "Should Builders Mart have its own navigation item and full page?", ["Homepage section only", "Homepage section + full page", "Full page only", "Not decided"], lines=1)
    add_question(doc, "3.4", "How should retail products be presented?", ["Compact featured selection", "Category explorer", "All retail products", "Link to existing catalogue"], lines=1)
    add_question(doc, "3.5", "Should retail prices be visible publicly?", ["No prices", "Starting prices", "Exact prices", "Only after enquiry", "Not decided"], lines=1, critical=True)

    add_section_heading(doc, "04", "Product breakdown document", "Confirm whether this is a quotation-style internal tool and define its official purpose.")
    add_question(doc, "4.1", "What should the generated document be called?", ["Product Breakdown", "Quotation", "Proforma Invoice", "Price List", "Other"], lines=1, critical=True)
    add_question(doc, "4.2", "Who will create it?", ["Owner only", "Sales workers", "Accounts workers", "Any authorized worker", "Customer on public site"], lines=1, critical=True)
    add_question(doc, "4.3", "How should staff start a new document?", ["From an existing enquiry", "From a standalone admin page", "Either method", "Other"], lines=1)
    add_question(doc, "4.4", "Who receives the completed document?", ["Customer contact", "Company / organization", "Internal team", "Multiple recipients"], lines=1)
    add_question(doc, "4.5", "Describe the current process from receiving a request to sending the final document.", lines=5)
    add_question(doc, "4.6", "Which document statuses are needed?", ["Draft", "Awaiting approval", "Approved", "Sent", "Accepted", "Expired", "Void"], lines=1)
    add_question(doc, "4.7", "Can a sent document be edited?", ["No—create a revision", "Yes, with audit history", "Owner only", "Not decided"], lines=1, critical=True)

    add_section_heading(doc, "05", "Recipient, references & document header", "Identify every field that must appear on the letterhead and customer-facing output.")
    add_question(doc, "5.1", "Which recipient fields are required?", ["Contact name", "Organization", "Email", "Phone", "Address", "Attention / department"], lines=1)
    add_question(doc, "5.2", "Should the inquiry/reference number be generated automatically?", ["Yes", "Entered manually", "Both allowed", "Not decided"], lines=1, critical=True)
    add_question(doc, "5.3", "If automatic, what reference format is required? Provide an example.", lines=2, note="Example only: BW-Q-2026-0001. The actual format will follow your answer.")
    add_question(doc, "5.4", "Which dates should appear?", ["Issue date", "Valid-until date", "Delivery date", "Payment due date", "Other"], lines=1)
    add_question(doc, "5.5", "Which company details belong in the header or footer?", ["Logo", "Registered address", "Phone", "Email", "Website", "Registration number", "Tax number"], lines=1)
    add_question(doc, "5.6", "Should staff add a subject, introduction, notes, terms or customer-specific message?", lines=3)

    add_section_heading(doc, "06", "Products, specifications & units", "Define the structured product data needed for expandable product and size selection.")
    add_question(doc, "6.1", "Confirm the initial product groups mentioned in the voice note.", ["Nails", "Cement", "Wire mesh", "Screws", "Other"], lines=1)
    add_question(doc, "6.2", "Confirm the nail sizes and measurement format.", ["1 inch", "1.5 inches", "2 inches", "2.5 inches", "3 inches", "4 inches", "5 inches", "6 inches"], lines=1)
    add_question(doc, "6.3", "Can one product have more than one specification type (for example size, grade, gauge, colour or brand)?", ["Yes", "No", "Not decided"], lines=1)
    add_question(doc, "6.4", "Should staff be able to add a one-off product or size that is not in the catalogue?", ["Yes", "No", "Owner approval required"], lines=1)
    add_question(doc, "6.5", "Complete the starter product matrix below or attach an approved product/price list.", lines=0)
    add_simple_table(
        doc,
        ["Product / category", "Sizes or variants", "Unit sold", "Source", "SKU / notes"],
        [["Type product", "List sizes / grades", "e.g. bag, roll, carton", "☐ Made  ☐ Supplied", "Type code or note"] for _ in range(7)],
        [1.25, 1.55, 1.25, 1.1, 1.35],
    )

    add_section_heading(doc, "07", "Pricing, quantities & totals", "Agree the calculation rules before any totals are automated.")
    add_question(doc, "7.1", "How should price be entered?", ["Manually for every line", "Saved default price", "Default price with manual override", "Imported price list"], lines=1, critical=True)
    add_question(doc, "7.2", "What currency or currencies are required?", ["NGN only", "NGN + other currencies", "Other"], lines=1)
    add_question(doc, "7.3", "What does quantity represent for each product?", lines=3, note="Examples: bags, pieces, cartons, rolls, bundles, tonnes or square metres.")
    add_question(doc, "7.4", "Can quantities contain decimals?", ["Whole numbers only", "Decimals allowed", "Depends on the product"], lines=1)
    add_question(doc, "7.5", "Which additional calculations are required?", ["VAT / tax", "Discount", "Delivery", "Handling", "Other charges", "None"], lines=1, critical=True)
    add_question(doc, "7.6", "Should additional charges apply per line or to the document total? Explain the rule.", lines=3)
    add_question(doc, "7.7", "How should money be rounded and displayed?", ["2 decimal places", "Whole naira", "Depends on currency", "Other"], lines=1)
    add_question(doc, "7.8", "How long should quoted prices remain valid?", ["7 days", "14 days", "30 days", "Entered per document", "No validity period"], lines=1)
    add_question(doc, "7.9", "Confirm the expected calculation.", ["Quantity × unit price = line total; line totals + charges − discounts = net total", "Different rule"], lines=2, critical=True)

    add_section_heading(doc, "08", "Payment & bank details", "Keep sensitive payment information controlled and out of public website data.")
    callout = doc.add_table(rows=1, cols=1)
    cell = callout.cell(0, 0)
    set_cell_shading(cell, "FFF5F3")
    set_cell_margins(cell)
    set_cell_border(cell, start={"val": "single", "sz": 18, "color": RED})
    p = cell.paragraphs[0]
    p.text = "SECURITY NOTE"
    for r in p.runs:
        set_run_font(r, 8, True, RED)
    p = cell.add_paragraph("Do not enter complete bank account numbers here. Confirm the handling rules only; approved account details should be supplied through a secure setup channel.")
    p.paragraph_format.space_after = Pt(0)
    for r in p.runs:
        set_run_font(r, 8.5, False, INK)
    doc.add_paragraph().paragraph_format.space_after = Pt(1)
    add_question(doc, "8.1", "Should bank details appear on every document?", ["Yes", "Optional per document", "Only after approval", "No"], lines=1, critical=True)
    add_question(doc, "8.2", "How many approved payment accounts may staff choose from?", ["One", "Multiple", "Not decided"], lines=1)
    add_question(doc, "8.3", "Who may create, edit or remove payment account records?", ["Owner only", "Owner + accounts manager", "Authorized workers", "Not decided"], lines=1, critical=True)
    add_question(doc, "8.4", "Which payment instructions or warnings must appear?", lines=3)
    add_question(doc, "8.5", "Is payment confirmation handled outside the system or should staff record it?", ["Outside system", "Record status only", "Upload payment evidence", "Not decided"], lines=1)

    add_section_heading(doc, "09", "Approval, delivery & records", "Define what happens between a draft and a customer receiving the document.")
    add_question(doc, "9.1", "Does a worker-created document require approval before sending?", ["Always", "Only above a value limit", "No", "Depends on worker"], lines=1, critical=True)
    add_question(doc, "9.2", "Who can approve?", ["Owner only", "Owner + delegated manager", "Accounts", "Sales lead", "Other"], lines=1)
    add_question(doc, "9.3", "How should the final document be delivered?", ["PDF by email", "Download PDF", "Print", "WhatsApp attachment", "View-only link"], lines=1, critical=True)
    add_question(doc, "9.4", "Which email address should appear as the sender or reply-to address?", lines=1)
    add_question(doc, "9.5", "Should the system record delivery results?", ["Sent date only", "Email delivery status", "Customer acceptance", "No tracking"], lines=1)
    add_question(doc, "9.6", "How long should documents be retained?", ["Indefinitely", "1 year", "3 years", "7 years", "Other"], lines=1)
    add_question(doc, "9.7", "Who may void, archive or permanently delete a document?", lines=2)

    add_section_heading(doc, "10", "Roles, permissions & audit trail", "Fit the new module into the existing owner/worker access model.")
    add_question(doc, "10.1", "Should “Product Breakdowns” be a separate admin permission?", ["Yes—None / View / Manage", "Combine with Inquiries", "Combine with Catalog", "Not decided"], lines=1, critical=True)
    add_question(doc, "10.2", "Complete the access expectations below.", lines=0)
    add_simple_table(
        doc,
        ["Action", "Owner", "Worker—View", "Worker—Manage", "Notes / exception"],
        [
            ["View breakdowns", "☐", "☐", "☐", "Type rule"],
            ["Create / edit draft", "☐", "☐", "☐", "Type rule"],
            ["Enter / override prices", "☐", "☐", "☐", "Type rule"],
            ["Approve / finalize", "☐", "☐", "☐", "Type rule"],
            ["Send to customer", "☐", "☐", "☐", "Type rule"],
            ["Manage bank details", "☐", "☐", "☐", "Type rule"],
            ["Void / delete", "☐", "☐", "☐", "Type rule"],
        ],
        [1.65, 0.65, 1.0, 1.1, 2.1],
    )
    add_question(doc, "10.3", "Should workers see all breakdowns or only records they created / were assigned?", ["All records permitted by module access", "Own records only", "Assigned records", "Rule depends on role"], lines=1, critical=True)
    add_question(doc, "10.4", "Which actions must appear in the activity log?", ["Create", "Edit", "Price change", "Approval", "Send", "Void", "Bank-detail change"], lines=1)
    add_question(doc, "10.5", "Should the existing “created by” hierarchy rule also protect breakdown records or approvals? Explain.", lines=2)

    add_section_heading(doc, "11", "Content, examples & launch information", "Collect the source materials needed to match the existing website and official documents.")
    add_question(doc, "11.1", "Who owns the final content and pricing decisions? Provide names, roles and contact details.", lines=3)
    add_question(doc, "11.2", "List the documents or assets that will be supplied.", ["Official logo", "Letterhead", "Existing quotation", "Product list", "Price list", "Bank-detail wording", "Store images", "Retail contact details"], lines=1)
    add_question(doc, "11.3", "Are there regulatory, tax, legal or industry statements that must appear?", lines=3)
    add_question(doc, "11.4", "What must be ready for the first launch, and what may wait for a later phase?", lines=4)
    add_question(doc, "11.5", "Who will test the website section and admin workflow before approval?", lines=2)

    add_section_heading(doc, "12", "Final decisions & authorization", "Record unresolved items and confirm that the answers are approved for solution design.")
    add_question(doc, "12.1", "List any decisions still awaiting confirmation, including the responsible person and expected date.", lines=5)
    add_question(doc, "12.2", "List any requirements discussed elsewhere that are missing from this questionnaire.", lines=4)
    add_question(doc, "12.3", "May the project team use these answers as the approved basis for architecture and UI planning?", ["Yes", "Yes, subject to listed corrections", "No—further meeting required"], lines=2, critical=True)

    sign = doc.add_table(rows=3, cols=4)
    sign.alignment = WD_TABLE_ALIGNMENT.CENTER
    sign.autofit = False
    sign_data = [
        ("Approved by", "Type full name", "Role", "Type role"),
        ("Signature / confirmation", "Type name or sign", "Date", "DD / MM / YYYY"),
        ("Project contact", "Type name", "Contact", "Type email / phone"),
    ]
    for row, values in zip(sign.rows, sign_data):
        prevent_row_split(row)
        for idx, value in enumerate(values):
            cell = row.cells[idx]
            set_cell_margins(cell, top=90, bottom=90)
            set_cell_border(cell, bottom={"val": "single", "sz": 5, "color": LINE})
            if idx % 2 == 0:
                set_cell_shading(cell, PALE_BLUE)
                for r in cell.paragraphs[0].runs:
                    set_run_font(r, 8, True, NAVY)
            else:
                set_cell_shading(cell, WHITE)
                for r in cell.paragraphs[0].runs:
                    r.italic = True
                    set_run_font(r, 8.5, False, MUTED)
            cell.text = value
            if idx % 2 == 0:
                for r in cell.paragraphs[0].runs:
                    set_run_font(r, 8, True, NAVY)
            else:
                for r in cell.paragraphs[0].runs:
                    r.italic = True
                    set_run_font(r, 8.5, False, MUTED)

    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(12)
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("END OF QUESTIONNAIRE")
    set_run_font(r, 8, True, RED)

    doc.core_properties.title = "BestWorth Retail & Product Breakdown Discovery Questionnaire"
    doc.core_properties.subject = "Client discovery for Builders Mart and product breakdown workflow"
    doc.core_properties.author = "BestWorth Products Limited"
    doc.core_properties.keywords = "BestWorth, Builders Mart, retail, product breakdown, discovery"

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc.save(OUTPUT)
    print(OUTPUT)


if __name__ == "__main__":
    build_document()
