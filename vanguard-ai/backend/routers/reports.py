"""Report generation API endpoints."""

import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response, JSONResponse
from sqlmodel import Session, select

from database import get_session
from models import Scan, Vulnerability
from services.ai_service import ai_service
from services.report_service import generate_pdf_report

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/{scan_id}/pdf")
async def download_pdf_report(
    scan_id: int,
    session: Session = Depends(get_session),
):
    """Generate and stream a PDF security report."""
    scan = session.get(Scan, scan_id)
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")

    vulns = session.exec(
        select(Vulnerability).where(Vulnerability.scan_id == scan_id)
    ).all()

    # Generate executive summary via AI
    top_vulns = sorted(
        vulns,
        key=lambda v: {"Critical": 0, "High": 1, "Medium": 2, "Low": 3}.get(v.risk, 4)
    )[:10]
    
    executive_summary = await ai_service.generate_executive_summary(scan, top_vulns)

    high_critical = (scan.critical_count or 0) + (scan.high_count or 0)
    medium = scan.medium_count or 0
    low = scan.low_count or 0
    compliance = {
        "owasp_top10": max(0, 100 - high_critical * 15 - medium * 5),
        "pci_dss": max(0, 100 - high_critical * 20 - medium * 8),
        "iso27001": max(0, 100 - high_critical * 10 - medium * 5 - low * 2),
        "soc2": max(0, 100 - high_critical * 12 - medium * 6),
    }

    pdf_bytes = generate_pdf_report(scan, list(vulns), executive_summary, compliance)

    date_str = datetime.utcnow().strftime("%Y-%m-%d")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=vanguard-report-{date_str}.pdf"
        },
    )


@router.get("/{scan_id}/json")
async def download_json_report(
    scan_id: int,
    session: Session = Depends(get_session),
):
    """Download complete scan data as JSON."""
    scan = session.get(Scan, scan_id)
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")

    vulns = session.exec(
        select(Vulnerability).where(Vulnerability.scan_id == scan_id)
    ).all()

    report_data = {
        "report": {
            "tool": "Vanguard AI",
            "version": "1.0.0",
            "generated_at": datetime.utcnow().isoformat(),
        },
        "scan": {
            "id": scan.id,
            "target_url": scan.target_url,
            "status": scan.status,
            "started_at": scan.started_at.isoformat() if scan.started_at else None,
            "completed_at": scan.completed_at.isoformat() if scan.completed_at else None,
            "security_score": scan.security_score,
            "total_vulns": scan.total_vulns,
            "critical_count": scan.critical_count,
            "high_count": scan.high_count,
            "medium_count": scan.medium_count,
            "low_count": scan.low_count,
            "info_count": scan.info_count,
        },
        "vulnerabilities": [
            {
                "id": v.id,
                "name": v.name,
                "risk": v.risk,
                "confidence": v.confidence,
                "url": v.url,
                "method": v.method,
                "param": v.param,
                "evidence": v.evidence,
                "description": v.description,
                "solution": v.solution,
                "cweid": v.cweid,
                "wascid": v.wascid,
                "is_resolved": v.is_resolved,
                "ai_explanation": v.ai_explanation,
                "business_impact": v.business_impact,
            }
            for v in vulns
        ],
    }

    date_str = datetime.utcnow().strftime("%Y-%m-%d")
    return Response(
        content=json.dumps(report_data, indent=2),
        media_type="application/json",
        headers={
            "Content-Disposition": f"attachment; filename=vanguard-report-{date_str}.json"
        },
    )
