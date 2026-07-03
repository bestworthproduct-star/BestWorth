from __future__ import annotations

from datetime import date
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    KeepTogether,
    Flowable,
    Image,
)
from reportlab.lib.utils import ImageReader


ROOT = Path(r"C:\Users\divin\Downloads\BestWorth")
OUTPUT_DIR = ROOT / "output" / "pdf"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
SOT_LOGO = Path(r"C:\Users\divin\Downloads\SOT(1).png")
BESTWORTH_LOGO = Path(r"C:\Users\divin\Downloads\Bestworth-red-1781894584448.png")

TODAY = date(2026, 6, 29)

BRASS = colors.HexColor("#B8860B")
CHARCOAL = colors.HexColor("#1F1B1C")
LIGHT_BG = colors.HexColor("#F8F8F5")
SOFT_BLUE = colors.HexColor("#EEF4FF")
MID_GREY = colors.HexColor("#666666")
LINE_GREY = colors.HexColor("#DDDDDD")


class LogoPlaceholder(Flowable):
    def __init__(self, label: str, width: float = 70 * mm, height: float = 26 * mm):
        super().__init__()
        self.label = label
        self.width = width
        self.height = height

    def wrap(self, availWidth, availHeight):
        return self.width, self.height

    def draw(self):
        self.canv.setStrokeColor(BRASS)
        self.canv.setDash(4, 3)
        self.canv.rect(0, 0, self.width, self.height, stroke=1, fill=0)
        self.canv.setDash()
        self.canv.setFont("Helvetica-Bold", 8)
        self.canv.setFillColor(CHARCOAL)
        self.canv.drawCentredString(self.width / 2, self.height / 2 - 3, self.label)


styles = getSampleStyleSheet()
styles.add(
    ParagraphStyle(
        name="DocTitle",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=24,
        leading=28,
        textColor=CHARCOAL,
        alignment=TA_LEFT,
        spaceAfter=10,
    )
)
styles.add(
    ParagraphStyle(
        name="DocSubtitle",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        textColor=MID_GREY,
        spaceAfter=18,
    )
)
styles.add(
    ParagraphStyle(
        name="Section",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=14,
        leading=18,
        textColor=CHARCOAL,
        spaceBefore=10,
        spaceAfter=8,
    )
)
styles.add(
    ParagraphStyle(
        name="SubSection",
        parent=styles["Heading3"],
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=14,
        textColor=CHARCOAL,
        spaceBefore=6,
        spaceAfter=4,
    )
)
styles.add(
    ParagraphStyle(
        name="Label",
        parent=styles["BodyText"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=BRASS,
        alignment=TA_LEFT,
        spaceAfter=4,
    )
)
styles.add(
    ParagraphStyle(
        name="Body",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=10,
        leading=15,
        textColor=CHARCOAL,
        spaceAfter=7,
    )
)
styles.add(
    ParagraphStyle(
        name="Small",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=12,
        textColor=MID_GREY,
        spaceAfter=5,
    )
)
styles.add(
    ParagraphStyle(
        name="CenteredSmall",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=11,
        textColor=MID_GREY,
        alignment=TA_CENTER,
    )
)
styles.add(
    ParagraphStyle(
        name="TableHeader",
        parent=styles["BodyText"],
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=12,
        textColor=colors.white,
    )
)


def bullet(text: str) -> Paragraph:
    return Paragraph(f"- {text}", styles["Body"])


def table_paragraph(text: str, header: bool = False) -> Paragraph:
    return Paragraph(text, styles["Small"] if not header else styles["TableHeader"])


def title_block(label: str, title: str, subtitle: str):
    return [
        Paragraph(label, styles["Label"]),
        Paragraph(title, styles["DocTitle"]),
        Paragraph(subtitle, styles["DocSubtitle"]),
    ]


def info_table(rows, col_widths):
    table = Table(rows, colWidths=col_widths, hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), CHARCOAL),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("LEADING", (0, 0), (-1, -1), 12),
                ("BACKGROUND", (0, 1), (-1, -1), colors.white),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT_BG]),
                ("GRID", (0, 0), (-1, -1), 0.5, LINE_GREY),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    return table


def wrap_table_rows(rows):
    wrapped = []
    for row_index, row in enumerate(rows):
        wrapped.append(
            [table_paragraph(str(cell), header=(row_index == 0)) for cell in row]
        )
    return wrapped


def fit_image(path: Path, max_width: float, max_height: float):
    reader = ImageReader(str(path))
    width, height = reader.getSize()
    scale = min(max_width / width, max_height / height)
    return Image(str(path), width=width * scale, height=height * scale)


def build_doc(path: Path, story: list):
    doc = BaseDocTemplate(
        str(path),
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title=path.stem.replace("_", " ").title(),
        author="OpenAI Codex for SOT",
    )

    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="normal")

    def on_page(canvas, document):
        canvas.saveState()
        canvas.setFillColor(CHARCOAL)
        canvas.setFont("Helvetica-Bold", 8)
        canvas.drawString(doc.leftMargin, A4[1] - 12 * mm, "BESTWORTH DOCUMENT PACK")
        canvas.setFillColor(MID_GREY)
        canvas.setFont("Helvetica", 8)
        canvas.drawRightString(A4[0] - doc.rightMargin, 10 * mm, f"Page {document.page}")
        canvas.drawString(doc.leftMargin, 10 * mm, f"Prepared {TODAY.isoformat()}")
        canvas.restoreState()

    doc.addPageTemplates([PageTemplate(id="main", frames=[frame], onPage=on_page)])
    doc.build(story)


def expenses_story():
    story = []
    story += title_block(
        "OPERATIONS EXPENSES",
        "Website Service Expense Guide",
        "This document explains the three live services required to keep the Bestworth website available, secure, and functional after handover."
    )
    story += [
        Paragraph("Purpose", styles["Section"]),
        Paragraph(
            "The website depends on three paid cloud services. Each service covers a different responsibility. If one is not maintained, a part of the website will stop working.",
            styles["Body"],
        ),
        bullet("Render hosts the website and backend API."),
        bullet("MongoDB Atlas stores products, leadership records, inquiries, CMS content, and supporting data."),
        bullet("SendGrid delivers inquiry alerts, confirmation emails, and admin replies."),
        Spacer(1, 6),
        Paragraph("Service Overview", styles["Section"]),
        info_table(
            wrap_table_rows([
                ["Service", "What It Covers", "If Not Maintained"],
                ["Render", "Production hosting, API uptime, environment variables, public deployment", "Website or admin area may go offline"],
                ["MongoDB Atlas", "Database storage for live content, inquiries, leadership, products, and settings", "Content and data access may fail"],
                ["SendGrid", "Outgoing email for new inquiries, user confirmations, and admin replies", "Inquiry emails and replies may stop sending"],
            ]),
            [30 * mm, 84 * mm, 52 * mm],
        ),
        Spacer(1, 10),
        Paragraph("Billing and Subscription Links", styles["Section"]),
        bullet("Render billing and plan management: https://dashboard.render.com/web/srv-d8o1sh8g4nts73c6llog/plan"),
        bullet("SendGrid billing and plan selection: https://app.sendgrid.com/account/billing/choose_plan"),
        bullet("MongoDB Atlas billing overview: https://cloud.mongodb.com/v2#/org/6a3019c22654b504044929f1/billing/overview"),
        Spacer(1, 10),
        Paragraph("How To Manage Each Service", styles["Section"]),
        Paragraph("1. Render", styles["SubSection"]),
        bullet("Use Render to keep the live website deployed and reachable on the public domain."),
        bullet("Review service health, instance type, restart history, and environment variables here."),
        bullet("When billing is interrupted, the production site may suspend or fail to start."),
        Paragraph("2. MongoDB Atlas", styles["SubSection"]),
        bullet("Use Atlas to monitor storage, backups, connection health, and cluster billing."),
        bullet("This database holds the live CMS content, products, leadership data, and inquiries."),
        bullet("If the database is unavailable, the website can load but content and admin functions may return service errors."),
        Paragraph("3. SendGrid", styles["SubSection"]),
        bullet("Use SendGrid to keep transactional email delivery active."),
        bullet("This includes inquiry notifications to the company, customer confirmation emails, and replies from admin."),
        bullet("If SendGrid is not maintained, inquiries can still save to the database, but email delivery may fail."),
        PageBreak(),
        Paragraph("Why These Costs Matter", styles["Section"]),
        bullet("Hosting cost keeps the site publicly reachable."),
        bullet("Database cost keeps live content and operational records available."),
        bullet("Email cost keeps communication professional and automatic."),
        Spacer(1, 8),
        Paragraph("Monthly Maintenance Checklist", styles["Section"]),
        bullet("Confirm Render billing is active and the service status is healthy."),
        bullet("Confirm MongoDB Atlas billing is active and storage usage is within plan limits."),
        bullet("Confirm SendGrid billing is active and email sending is still accepted."),
        bullet("Send one test inquiry from the public site and confirm the company receives the notification."),
        bullet("Sign into the admin panel and confirm products, leadership, and CMS content still load."),
        Spacer(1, 8),
        Paragraph("Ownership Recommendations", styles["Section"]),
        bullet("Use a company-owned billing card or managed finance process for all three services."),
        bullet("Keep more than one authorized company contact on each platform where possible."),
        bullet("Store platform recovery details, invoice emails, and support contacts in the handover file."),
        bullet("Review usage every month and re-evaluate plan size only when traffic, storage, or email volume increases."),
        Spacer(1, 10),
        Paragraph("Decision Guidance", styles["Section"]),
        Paragraph(
            "The safest approach is to keep all three services active at all times. Render covers availability, MongoDB Atlas covers data continuity, and SendGrid covers professional communication. Removing any one of them reduces the reliability of the full system.",
            styles["Body"],
        ),
    ]
    return story


def handover_story():
    story = []
    story += title_block(
        "PROJECT HANDOVER",
        "SOT To Bestworth Website Handover",
        "This handover document records the transfer of operational access, supporting services, and administrative responsibility for the new Bestworth website."
    )
    sot_logo = fit_image(SOT_LOGO, 40 * mm, 26 * mm)
    bestworth_logo = fit_image(BESTWORTH_LOGO, 40 * mm, 26 * mm)
    logo_table = Table(
        [[sot_logo, bestworth_logo], [Paragraph("SOT", styles["CenteredSmall"]), Paragraph("BESTWORTH", styles["CenteredSmall"])]],
        colWidths=[80 * mm, 80 * mm],
        rowHeights=[32 * mm, None],
        hAlign="LEFT",
    )
    logo_table.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, 0), 1, BRASS),
                ("INNERGRID", (0, 0), (-1, 0), 1, BRASS),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ALIGN", (0, 0), (-1, 0), "CENTER"),
                ("TOPPADDING", (0, 0), (-1, 0), 10),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 10),
            ]
        )
    )
    story += [logo_table, Spacer(1, 12)]
    story += [
        Paragraph("Handover Summary", styles["Section"]),
        Paragraph(
            "This document should be completed and signed when operational control is formally transferred from SOT to Bestworth. It is designed to capture access handover, account responsibilities, and sign-off expectations.",
            styles["Body"],
        ),
        Paragraph("Accounts and Services To Transfer", styles["Section"]),
        info_table(
            wrap_table_rows([
                ["Item", "What Is Being Handed Over", "Status / Notes"],
                ["Admin Login", "Primary administrator access for the new website", "Preview password currently active"],
                ["Company Gmail Account", "Email account used for operational continuity and/or recovery where applicable", "To be completed at handover"],
                ["Render", "Production hosting account or managed service access", "To be completed at handover"],
                ["MongoDB Atlas", "Live database management and billing access", "To be completed at handover"],
                ["SendGrid", "Email delivery service and billing access", "To be completed at handover"],
                ["Source Code Repository", "Project repository access and ownership record", "To be completed at handover"],
                ["Domain / DNS", "Website domain, DNS records, and registrar relationship if applicable", "To be completed at handover"],
            ]),
            [34 * mm, 78 * mm, 54 * mm],
        ),
        Spacer(1, 10),
        Paragraph("Recommended Handover Checklist", styles["Section"]),
        bullet("Confirm the final preview state of the website is approved."),
        bullet("Confirm the working admin login provided to Bestworth."),
        bullet("Confirm whether password change remains locked during preview or is re-enabled after acceptance."),
        bullet("Transfer or record access to Render, MongoDB Atlas, SendGrid, and the source repository."),
        bullet("Transfer the Gmail account or document the exact account ownership and recovery process."),
        bullet("Document all operational contacts, billing contacts, and fallback recovery contacts."),
        Spacer(1, 10),
        Paragraph("Provided Account Details", styles["Section"]),
        info_table(
            wrap_table_rows([
                ["Service", "Username / Email", "Password", "Notes"],
                ["Company Gmail Account", "bestworthproduct@gmail.com", "BESTWORTH", "Provided for handover. Change after acceptance if desired."],
            ]),
            [34 * mm, 52 * mm, 28 * mm, 50 * mm],
        ),
        PageBreak(),
        Paragraph("Account Inventory", styles["Section"]),
        Paragraph("Use the following space to complete the actual handover details.", styles["Body"]),
        Spacer(1, 4),
    ]

    inventory_rows = [
        ["Account / Asset", "Username or Owner", "Recovery Email / Phone", "Notes"],
        ["Admin panel", "", "", ""],
        ["Gmail account", "bestworthproduct@gmail.com", "", "Password provided in handover details"],
        ["Render", "", "", ""],
        ["MongoDB Atlas", "", "", ""],
        ["SendGrid", "", "", ""],
        ["Git repository", "", "", ""],
        ["Domain / registrar", "", "", ""],
    ]
    story += [info_table(wrap_table_rows(inventory_rows), [34 * mm, 40 * mm, 46 * mm, 50 * mm]), Spacer(1, 10)]
    story += [
        Paragraph("Operational Notes", styles["Section"]),
        bullet("The website includes secured admin access and protected content management."),
        bullet("The website depends on active Render, MongoDB Atlas, and SendGrid services."),
        bullet("Inquiry records are saved to the database and email delivery is handled through SendGrid."),
        bullet("The admin interface controls products, leadership, inquiries, CMS content, and account settings."),
        Spacer(1, 10),
        Paragraph("Acceptance And Sign-Off", styles["Section"]),
        Paragraph("SOT Representative Name: ________________________________________________", styles["Body"]),
        Paragraph("Bestworth Representative Name: __________________________________________", styles["Body"]),
        Paragraph("Handover Date: ____________________________________________________________", styles["Body"]),
        Paragraph("Signature - SOT: __________________________________________________________", styles["Body"]),
        Paragraph("Signature - Bestworth: _________________________________________________", styles["Body"]),
        Spacer(1, 10),
        Paragraph("Final Note", styles["Section"]),
        Paragraph(
            "This document should be stored alongside the expense guide and user manual so the client always has one location for operational reference, access continuity, and support history.",
            styles["Body"],
        ),
    ]
    return story


def manual_story():
    story = []
    story += title_block(
        "USER MANUAL",
        "Bestworth Website And Admin Manual",
        "This manual explains how to use, review, and test the public website and the secured admin system after deployment."
    )
    story += [
        Paragraph("System Overview", styles["Section"]),
        bullet("Public website for visitors, product discovery, leadership viewing, and inquiry submission."),
        bullet("Admin portal for products, leadership, inquiries, CMS content, and account settings."),
        bullet("Database-backed content and operational records."),
        bullet("Email automation for inquiry notification, customer confirmation, and admin replies."),
        Spacer(1, 8),
        Paragraph("Public Website Features", styles["Section"]),
        bullet("Hero section with controlled content and idle fade behavior."),
        bullet("About section, values section, products, leadership section, and contact section."),
        bullet("Leadership section includes paginated slides and biography modal behavior where biography text exists."),
        bullet("Inquiry submission form saves to the database and triggers email workflows."),
        Spacer(1, 8),
        Paragraph("Admin Access", styles["Section"]),
        bullet("Open the admin login page and sign in with the provided administrator credentials."),
        bullet("If preview lock is active, password changes are temporarily disabled even though login still works."),
        bullet("If the database is unavailable, the system redirects to a service-unavailable page instead of failing silently."),
        PageBreak(),
        Paragraph("Admin Sections", styles["Section"]),
        Paragraph("1. Overview", styles["SubSection"]),
        bullet("Shows total catalog items, new inquiries, and leadership count."),
        bullet("Shows a quick system status summary."),
        Paragraph("2. Catalog", styles["SubSection"]),
        bullet("Create, edit, feature, and delete products."),
        bullet("Upload or paste product images."),
        bullet("Manage product categories used on the public site."),
        Paragraph("3. Leadership", styles["SubSection"]),
        bullet("Create, edit, and delete executive profiles."),
        bullet("Set executive name, role, portrait, display order, and biography."),
        bullet("Configure public leadership slider settings, including auto-slide and delay seconds."),
        Paragraph("4. Communications", styles["SubSection"]),
        bullet("View all inquiries submitted from the public site."),
        bullet("Mark inquiries as read, archive them, delete them, or send a reply."),
        bullet("Use prebuilt email templates or save custom templates."),
        Paragraph("5. Site CMS", styles["SubSection"]),
        bullet("Branding Assets: logo and favicon."),
        bullet("Hero Content: heading, text, media, and idle fade settings."),
        bullet("About Us Section: text and image."),
        bullet("Contact Information: company contact details."),
        bullet("Our Values: add, remove, reorder, and edit values."),
        bullet("Footer and Socials: default links plus additional handle-based social items."),
        Paragraph("6. Settings", styles["SubSection"]),
        bullet("Update admin username and company notification emails."),
        bullet("Password updates are available only when password change is not locked."),
        Spacer(1, 8),
        Paragraph("How To Test The System", styles["Section"]),
        bullet("Public test: open the website and confirm all sections load correctly."),
        bullet("Product test: add or edit a product in admin and confirm the public products section updates."),
        bullet("Leadership test: add or edit an executive and confirm the public leadership section updates."),
        bullet("Inquiry test: submit a public inquiry and confirm it appears in the admin panel."),
        bullet("Email test: confirm the company receives the new inquiry email and the user receives the confirmation email."),
        bullet("Reply test: send an admin reply and confirm the reply is stored on the inquiry record."),
        PageBreak(),
        Paragraph("Recommended Monthly Checks", styles["Section"]),
        bullet("Confirm public pages load and images appear correctly."),
        bullet("Confirm admin login still works."),
        bullet("Send one test inquiry and verify email delivery."),
        bullet("Review Render, MongoDB Atlas, and SendGrid billing and health."),
        bullet("Review leadership slider behavior if leadership count grows."),
        Spacer(1, 8),
        Paragraph("Troubleshooting Basics", styles["Section"]),
        bullet("If the site loads but data is missing, check MongoDB Atlas connection health."),
        bullet("If inquiries save but no email arrives, check SendGrid activity and billing."),
        bullet("If admin features stop responding, confirm the Render service is healthy and environment variables are present."),
        bullet("If the system shows a service-unavailable page, check database availability first."),
        Spacer(1, 8),
        Paragraph("Important Environment And Service Notes", styles["Section"]),
        bullet("PUBLIC_APP_URL sets the public application address used in links and media resolution."),
        bullet("MONGODB_URI controls the production database connection."),
        bullet("EMAIL_PROVIDER and SENDGRID_API_KEY control email delivery."),
        bullet("ALLOW_ADMIN_PASSWORD_CHANGE can temporarily lock password updates during preview."),
        Spacer(1, 8),
        Paragraph("Operational Best Practice", styles["Section"]),
        Paragraph(
            "Always test the public inquiry flow after any email, hosting, or database change. The website is more than a visual brochure - it is a live operational system with hosting, content, inquiries, and email dependencies working together.",
            styles["Body"],
        ),
    ]
    return story


def main():
    build_doc(OUTPUT_DIR / "bestworth_expenses_guide.pdf", expenses_story())
    build_doc(OUTPUT_DIR / "bestworth_handover_document.pdf", handover_story())
    build_doc(OUTPUT_DIR / "bestworth_user_manual.pdf", manual_story())
    print("Generated PDFs in", OUTPUT_DIR)


if __name__ == "__main__":
    main()
