"""Vulnerability management API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from typing import Optional

from database import get_session
from models import Vulnerability, Scan
from seed_data import calculate_security_score

router = APIRouter(prefix="/api/vulnerabilities", tags=["vulnerabilities"])


@router.get("/")
async def get_vulnerabilities(
    scan_id: Optional[int] = Query(None),
    risk: Optional[str] = Query(None),
    resolved: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    sort_by: Optional[str] = Query("risk"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    session: Session = Depends(get_session),
):
    """Get filtered and paginated vulnerability list."""
    query = select(Vulnerability)

    if scan_id:
        query = query.where(Vulnerability.scan_id == scan_id)
    if risk:
        query = query.where(Vulnerability.risk == risk)
    if resolved is not None:
        query = query.where(Vulnerability.is_resolved == resolved)
    if search:
        query = query.where(Vulnerability.name.contains(search))

    # Get total count before pagination
    all_results = session.exec(query).all()
    total = len(all_results)

    # Sort
    risk_order = {"Critical": 0, "High": 1, "Medium": 2, "Low": 3, "Informational": 4}
    if sort_by == "risk":
        all_results.sort(key=lambda v: risk_order.get(v.risk, 5))
    elif sort_by == "name":
        all_results.sort(key=lambda v: v.name)

    # Paginate
    paginated = all_results[skip: skip + limit]

    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "vulnerabilities": [
            {
                "id": v.id,
                "scan_id": v.scan_id,
                "name": v.name,
                "risk": v.risk,
                "confidence": v.confidence,
                "url": v.url,
                "method": v.method,
                "param": v.param,
                "cweid": v.cweid,
                "wascid": v.wascid,
                "description": v.description,
                "is_resolved": v.is_resolved,
                "verified": bool(getattr(v, "verified", False)),
                "has_ai_explanation": v.ai_explanation is not None,
                "has_ai_fix": v.ai_fix_python is not None,
            }
            for v in paginated
        ],
    }


@router.get("/{vuln_id}")
async def get_vulnerability(
    vuln_id: int,
    session: Session = Depends(get_session),
):
    """Get a single vulnerability with all details including AI fields."""
    vuln = session.get(Vulnerability, vuln_id)
    if not vuln:
        raise HTTPException(status_code=404, detail="Vulnerability not found")

    return {
        "id": vuln.id,
        "scan_id": vuln.scan_id,
        "name": vuln.name,
        "risk": vuln.risk,
        "confidence": vuln.confidence,
        "url": vuln.url,
        "method": vuln.method,
        "param": vuln.param,
        "attack": vuln.attack,
        "evidence": vuln.evidence,
        "verified": bool(getattr(vuln, "verified", False)),
        "repro_command": getattr(vuln, "repro_command", None),
        "description": vuln.description,
        "solution": vuln.solution,
        "reference": vuln.reference,
        "cweid": vuln.cweid,
        "wascid": vuln.wascid,
        "ai_explanation": vuln.ai_explanation,
        "ai_fix_python": vuln.ai_fix_python,
        "ai_fix_javascript": vuln.ai_fix_javascript,
        "ai_fix_java": vuln.ai_fix_java,
        "business_impact": vuln.business_impact,
        "is_resolved": vuln.is_resolved,
    }


@router.patch("/{vuln_id}/resolve")
async def resolve_vulnerability(
    vuln_id: int,
    session: Session = Depends(get_session),
):
    """Mark a vulnerability as resolved and recalculate the scan security score."""
    vuln = session.get(Vulnerability, vuln_id)
    if not vuln:
        raise HTTPException(status_code=404, detail="Vulnerability not found")

    vuln.is_resolved = not vuln.is_resolved
    session.add(vuln)
    session.commit()

    # Recalculate scan security score based on unresolved vulns
    scan = session.get(Scan, vuln.scan_id)
    if scan:
        unresolved = session.exec(
            select(Vulnerability)
            .where(Vulnerability.scan_id == scan.id)
            .where(Vulnerability.is_resolved == False)
        ).all()

        counts = {"Critical": 0, "High": 0, "Medium": 0, "Low": 0, "Informational": 0}
        for v in unresolved:
            if v.risk in counts:
                counts[v.risk] += 1

        scan.security_score = calculate_security_score(counts)
        scan.critical_count = counts["Critical"]
        scan.high_count = counts["High"]
        scan.medium_count = counts["Medium"]
        scan.low_count = counts["Low"]
        scan.info_count = counts["Informational"]
        session.add(scan)
        session.commit()
        session.refresh(scan)

    return {
        "id": vuln.id,
        "is_resolved": vuln.is_resolved,
        "new_security_score": scan.security_score if scan else None,
        "message": f"Vulnerability {'resolved' if vuln.is_resolved else 'reopened'}",
    }
