"""PDF report generation service using ReportLab."""

import io
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from models import Scan, Vulnerability
from typing import List


# Vanguard brand colors
CYAN = colors.HexColor("#00D4FF")
DARK_BG = colors.HexColor("#0A0E1A")
CARD_BG = colors.HexColor("#0F1628")
CRITICAL_RED = colors.HexColor("#FF3366")
HIGH_ORANGE = colors.HexColor("#FF9500")
MEDIUM_YELLOW = colors.HexColor("#FFD60A")
LOW_GREEN = colors.HexColor("#00FF88")
TEXT_COLOR = colors.HexColor("#1a1a2e")
HEADER_BG = colors.HexColor("#0A0E1A")


def get_risk_color(risk: str) -> colors.Color:
    """Map risk level to ReportLab color."""
    mapping = {
        "Critical": CRITICAL_RED,
        "High": HIGH_ORANGE,
        "Medium": MEDIUM_YELLOW,
        "Low": LOW_GREEN,
        "Informational": colors.HexColor("#6B7E99"),
    }
    return mapping.get(risk, colors.grey)


def generate_pdf_report(
    scan: Scan,
    vulnerabilities: List[Vulnerability],
    executive_summary: str = "",
    compliance: dict = None,
) -> bytes:
    """Generate a professional PDF security report.
    
    Returns PDF as bytes.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=60,
        leftMargin=60,
        topMargin=60,
        bottomMargin=60,
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        "VanguardTitle",
        parent=styles["Title"],
        fontSize=28,
        textColor=colors.HexColor("#0A0E1A"),
        spaceAfter=6,
        fontName="Helvetica-Bold",
    )

    subtitle_style = ParagraphStyle(
        "VanguardSubtitle",
        parent=styles["Normal"],
        fontSize=14,
        textColor=colors.HexColor("#6B7E99"),
        spaceAfter=20,
    )

    heading_style = ParagraphStyle(
        "VanguardHeading",
        parent=styles["Heading1"],
        fontSize=18,
        textColor=colors.HexColor("#0A0E1A"),
        spaceBefore=20,
        spaceAfter=10,
        fontName="Helvetica-Bold",
    )

    subheading_style = ParagraphStyle(
        "VanguardSubheading",
        parent=styles["Heading2"],
        fontSize=14,
        textColor=colors.HexColor("#1E2D4A"),
        spaceBefore=12,
        spaceAfter=6,
        fontName="Helvetica-Bold",
    )

    body_style = ParagraphStyle(
        "VanguardBody",
        parent=styles["Normal"],
        fontSize=10,
        textColor=TEXT_COLOR,
        spaceAfter=8,
        leading=14,
    )

    elements = []

    # ── Cover Section ──
    elements.append(Spacer(1, 40))
    elements.append(Paragraph("VANGUARD AI", title_style))
    elements.append(Paragraph("Autonomous Security Assessment Report", subtitle_style))
    elements.append(HRFlowable(width="100%", thickness=2, color=CYAN))
    elements.append(Spacer(1, 20))

    # Report metadata
    meta_data = [
        ["Target:", scan.target_url],
        ["Scan Date:", scan.started_at.strftime("%B %d, %Y at %H:%M UTC") if scan.started_at else "N/A"],
        ["Security Score:", f"{scan.security_score}/100" if scan.security_score else "N/A"],
        ["Total Findings:", str(scan.total_vulns)],
        ["Report Generated:", datetime.utcnow().strftime("%B %d, %Y at %H:%M UTC")],
    ]
    meta_table = Table(meta_data, colWidths=[120, 370])
    meta_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#1E2D4A")),
        ("TEXTCOLOR", (1, 0), (1, -1), TEXT_COLOR),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(meta_table)
    elements.append(Spacer(1, 30))

    # ── Risk Summary ──
    elements.append(Paragraph("Risk Distribution", heading_style))

    risk_data = [
        ["Risk Level", "Count", "Impact"],
        ["Critical", str(scan.critical_count), "Immediate exploitation possible"],
        ["High", str(scan.high_count), "Significant risk, fix within current sprint"],
        ["Medium", str(scan.medium_count), "Moderate risk, plan remediation"],
        ["Low", str(scan.low_count), "Minor risk, address in backlog"],
        ["Informational", str(scan.info_count), "No direct risk, review recommended"],
    ]
    risk_table = Table(risk_data, colWidths=[100, 60, 330])
    risk_table.setStyle(TableStyle([
        # Header
        ("BACKGROUND", (0, 0), (-1, 0), HEADER_BG),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 10),
        # Body
        ("FONTSIZE", (0, 1), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        # Risk level colors
        ("TEXTCOLOR", (0, 1), (0, 1), CRITICAL_RED),
        ("TEXTCOLOR", (0, 2), (0, 2), HIGH_ORANGE),
        ("TEXTCOLOR", (0, 3), (0, 3), colors.HexColor("#B8960A")),
        ("TEXTCOLOR", (0, 4), (0, 4), LOW_GREEN),
        ("FONTNAME", (0, 1), (0, -1), "Helvetica-Bold"),
        # Grid
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E0E0E0")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8F9FA")]),
    ]))
    elements.append(risk_table)
    elements.append(Spacer(1, 20))

    # ── Executive Summary ──
    if executive_summary:
        elements.append(Paragraph("Executive Summary", heading_style))
        for para in executive_summary.split("\n\n"):
            if para.strip():
                elements.append(Paragraph(para.strip(), body_style))
        elements.append(Spacer(1, 10))

    # ── Detailed Findings ──
    elements.append(PageBreak())
    elements.append(Paragraph("Detailed Vulnerability Findings", heading_style))
    elements.append(HRFlowable(width="100%", thickness=1, color=CYAN))
    elements.append(Spacer(1, 10))

    # Sort by risk severity
    risk_order = {"Critical": 0, "High": 1, "Medium": 2, "Low": 3, "Informational": 4}
    sorted_vulns = sorted(vulnerabilities, key=lambda v: risk_order.get(v.risk, 5))

    for i, vuln in enumerate(sorted_vulns, 1):
        elements.append(Paragraph(
            f"{i}. {vuln.name}",
            subheading_style
        ))

        vuln_meta = [
            ["Risk:", vuln.risk, "CWE:", f"CWE-{vuln.cweid}" if vuln.cweid else "N/A"],
            ["URL:", vuln.url, "Parameter:", vuln.param or "N/A"],
        ]
        vuln_table = Table(vuln_meta, colWidths=[60, 200, 70, 160])
        vuln_table.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
            ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("TEXTCOLOR", (0, 0), (-1, -1), TEXT_COLOR),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        elements.append(vuln_table)

        if vuln.description:
            elements.append(Paragraph(
                f"<b>Description:</b> {vuln.description}",
                body_style
            ))

        if vuln.evidence:
            elements.append(Paragraph(
                f"<b>Evidence:</b> <font face='Courier' size='9'>{vuln.evidence[:200]}</font>",
                body_style
            ))

        if vuln.solution:
            elements.append(Paragraph(
                f"<b>Recommendation:</b> {vuln.solution}",
                body_style
            ))

        if vuln.business_impact:
            elements.append(Paragraph(
                f"<b>Business Impact:</b> {vuln.business_impact}",
                body_style
            ))

        elements.append(Spacer(1, 10))
        if i < len(sorted_vulns):
            elements.append(HRFlowable(
                width="80%", thickness=0.5,
                color=colors.HexColor("#E0E0E0")
            ))

    # ── Footer ──
    elements.append(PageBreak())
    elements.append(Paragraph("Compliance Mapping", heading_style))

    high_critical = (scan.critical_count or 0) + (scan.high_count or 0)
    medium = scan.medium_count or 0
    low = scan.low_count or 0
    c = compliance or {}
    owasp = c.get("owasp_top10", max(0, 100 - high_critical * 15 - medium * 5))
    pci = c.get("pci_dss", max(0, 100 - high_critical * 20 - medium * 8))
    iso = c.get("iso27001", max(0, 100 - high_critical * 10 - medium * 5 - low * 2))
    soc2 = c.get("soc2", max(0, 100 - high_critical * 12 - medium * 6))

    def _status(score):
        if score >= 80:
            return "Compliant"
        if score >= 50:
            return "Partial"
        return "Non-Compliant"

    compliance_data = [
        ["Framework", "Coverage", "Status"],
        ["OWASP Top 10", f"{owasp}%", _status(owasp)],
        ["PCI DSS", f"{pci}%", _status(pci)],
        ["ISO 27001", f"{iso}%", _status(iso)],
        ["SOC 2", f"{soc2}%", _status(soc2)],
    ]
    comp_table = Table(compliance_data, colWidths=[160, 100, 230])
    comp_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), HEADER_BG),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E0E0E0")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8F9FA")]),
    ]))
    elements.append(comp_table)
    elements.append(Spacer(1, 30))

    elements.append(HRFlowable(width="100%", thickness=1, color=CYAN))
    elements.append(Spacer(1, 10))
    elements.append(Paragraph(
        "Generated by Vanguard AI — Autonomous Security Engineer",
        ParagraphStyle("Footer", parent=body_style, fontSize=9,
                       textColor=colors.HexColor("#6B7E99"), alignment=TA_CENTER)
    ))

    # Build PDF
    doc.build(elements)
    buffer.seek(0)
    return buffer.getvalue()
