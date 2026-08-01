"""Scan management API endpoints."""

import json
import ipaddress
from urllib.parse import urlparse
from datetime import datetime
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import Optional
import socket

from database import get_session
from models import Scan, Vulnerability
from services.zap_service import zap_service
from services.ai_service import ai_service
from seed_data import seed_database

router = APIRouter(prefix="/api/scans", tags=["scans"])

BLOCKED_HOSTS = {"localhost", "127.0.0.1", "0.0.0.0", "[::1]", "metadata.google.internal"}


def _validate_target(url: str) -> str:
    """Validate and sanitize target URL to prevent SSRF."""
    parsed = urlparse(url)
    host = parsed.hostname or ""
    if not host:
        raise HTTPException(status_code=400, detail="Invalid URL: no hostname")
    if host in BLOCKED_HOSTS or host.endswith(".internal"):
        raise HTTPException(status_code=400, detail="Scanning internal/private hosts is not allowed")
    try:
        for info in socket.getaddrinfo(host, None):
            addr = ipaddress.ip_address(info[4][0])
            if addr.is_private or addr.is_loopback or addr.is_link_local:
                raise HTTPException(status_code=400, detail="Scanning private/internal IP addresses is not allowed")
    except socket.gaierror:
        pass
    return url


class StartScanRequest(BaseModel):
    target_url: str = "https://example.com"


class ScanResponse(BaseModel):
    scan_id: int
    status: str
    message: str


@router.post("/start", response_model=ScanResponse)
async def start_scan(
    request: StartScanRequest,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
):
    """Start a new security scan against a target URL."""
    target = request.target_url.strip()
    if not target.startswith("http://") and not target.startswith("https://"):
        target = f"https://{target}"
    target = _validate_target(target)

    scan = Scan(
        target_url=target,
        status="pending",
        progress=0,
        started_at=datetime.utcnow(),
    )
    session.add(scan)
    session.commit()
    session.refresh(scan)

    background_tasks.add_task(
        zap_service.run_full_scan,
        scan.id,
        target,
        None,
    )

    return ScanResponse(
        scan_id=scan.id,
        status="pending",
        message="Scan initiated. Poll /api/scans/{scan_id}/status for progress.",
    )


@router.get("/{scan_id}/status")
async def get_scan_status(
    scan_id: int,
    session: Session = Depends(get_session),
):
    """Get the current status and progress of a scan."""
    scan = session.get(Scan, scan_id)
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")

    progress = scan.progress
    if scan.status == "pending":
        message = "Initializing scanner..."
    elif scan.status == "running":
        if progress < 10:
            message = "Connecting to target..."
        elif progress < 30:
            message = "Analyzing security headers..."
        elif progress < 50:
            message = "Checking SSL/TLS configuration..."
        elif progress < 70:
            message = "Scanning for misconfigurations..."
        elif progress < 90:
            message = "Probing sensitive paths..."
        else:
            message = "Generating AI analysis..."
    elif scan.status == "completed":
        message = f"Scan complete — {scan.total_vulns} vulnerabilities found"
    else:
        message = "Scan failed"

    return {
        "scan_id": scan.id,
        "status": scan.status,
        "progress": scan.progress,
        "message": message,
        "total_vulns": scan.total_vulns,
        "security_score": scan.security_score,
    }


@router.get("/{scan_id}/results")
async def get_scan_results(
    scan_id: int,
    session: Session = Depends(get_session),
):
    """Get full scan results with all vulnerabilities."""
    scan = session.get(Scan, scan_id)
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")

    vulns = session.exec(
        select(Vulnerability).where(Vulnerability.scan_id == scan_id)
    ).all()

    return {
        "scan": {
            "id": scan.id,
            "target_url": scan.target_url,
            "status": scan.status,
            "progress": scan.progress,
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
                "param": v.param,
                "cweid": v.cweid,
                "is_resolved": v.is_resolved,
            }
            for v in vulns
        ],
    }


@router.get("/")
async def get_all_scans(session: Session = Depends(get_session)):
    """Return list of all scans for scan history."""
    scans = session.exec(select(Scan).order_by(Scan.id.desc())).all()
    return [
        {
            "id": s.id,
            "target_url": s.target_url,
            "status": s.status,
            "progress": s.progress,
            "started_at": s.started_at.isoformat() if s.started_at else None,
            "completed_at": s.completed_at.isoformat() if s.completed_at else None,
            "security_score": s.security_score,
            "total_vulns": s.total_vulns,
            "critical_count": s.critical_count,
            "high_count": s.high_count,
            "medium_count": s.medium_count,
            "low_count": s.low_count,
            "info_count": s.info_count,
        }
        for s in scans
    ]


@router.get("/{scan_id}/suggestions")
async def get_scan_suggestions(
    scan_id: int,
    session: Session = Depends(get_session),
):
    """Get AI-generated security suggestions for a completed scan.

    Returns cached suggestions if available, otherwise generates and caches them.
    """
    scan = session.get(Scan, scan_id)
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")

    if scan.ai_suggestions:
        try:
            cached = json.loads(scan.ai_suggestions)
            if isinstance(cached, dict) and "suggestions" in cached:
                return cached
        except json.JSONDecodeError:
            pass

    vulns = session.exec(
        select(Vulnerability)
        .where(Vulnerability.scan_id == scan_id)
        .where(Vulnerability.is_resolved == False)
    ).all()

    suggestions = await ai_service.generate_security_suggestions(scan, list(vulns))

    scan.ai_suggestions = json.dumps(suggestions)
    session.add(scan)
    session.commit()

    return suggestions


def _vuln_key(v: Vulnerability) -> str:
    """Stable identity for a finding across scans of the same target."""
    return f"{v.name}::{v.param or ''}"


@router.get("/{scan_id}/diff")
async def get_scan_diff(
    scan_id: int,
    session: Session = Depends(get_session),
):
    """Compare a scan against the previous completed scan of the same target.

    Returns which findings were fixed, which are new, and which persist —
    turning the scan history into a remediation-verification loop.
    """
    scan = session.get(Scan, scan_id)
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")

    # Find the most recent earlier completed scan of the same target
    previous = session.exec(
        select(Scan)
        .where(Scan.target_url == scan.target_url)
        .where(Scan.id < scan_id)
        .where(Scan.status == "completed")
        .order_by(Scan.id.desc())
    ).first()

    current_vulns = session.exec(
        select(Vulnerability).where(Vulnerability.scan_id == scan_id)
    ).all()

    if not previous:
        return {
            "has_baseline": False,
            "target_url": scan.target_url,
            "current_scan_id": scan_id,
            "previous_scan_id": None,
            "fixed": [],
            "new": [],
            "persisting": [],
            "summary": {"fixed": 0, "new": 0, "persisting": 0},
        }

    previous_vulns = session.exec(
        select(Vulnerability).where(Vulnerability.scan_id == previous.id)
    ).all()

    current_map = {_vuln_key(v): v for v in current_vulns}
    previous_map = {_vuln_key(v): v for v in previous_vulns}

    def brief(v):
        return {"id": v.id, "name": v.name, "risk": v.risk, "param": v.param, "url": v.url}

    fixed = [brief(v) for k, v in previous_map.items() if k not in current_map]
    new = [brief(v) for k, v in current_map.items() if k not in previous_map]
    persisting = [brief(v) for k, v in current_map.items() if k in previous_map]

    risk_order = {"Critical": 0, "High": 1, "Medium": 2, "Low": 3, "Informational": 4}
    for lst in (fixed, new, persisting):
        lst.sort(key=lambda x: risk_order.get(x["risk"], 5))

    return {
        "has_baseline": True,
        "target_url": scan.target_url,
        "current_scan_id": scan_id,
        "previous_scan_id": previous.id,
        "current_score": scan.security_score,
        "previous_score": previous.security_score,
        "previous_date": previous.started_at.isoformat() if previous.started_at else None,
        "fixed": fixed,
        "new": new,
        "persisting": persisting,
        "summary": {"fixed": len(fixed), "new": len(new), "persisting": len(persisting)},
    }


@router.post("/seed")
async def seed_data(session: Session = Depends(get_session)):
    """Seed the database with demo data for reliability."""
    scan = seed_database(session)
    return {
        "message": "Database seeded with demo data",
        "scan_id": scan.id,
        "total_vulns": scan.total_vulns,
        "security_score": scan.security_score,
    }
