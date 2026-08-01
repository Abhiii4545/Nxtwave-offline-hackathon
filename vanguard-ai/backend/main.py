"""Vanguard AI — Autonomous Security Engineer Platform.

FastAPI application that integrates OWASP ZAP scanning, Claude AI analysis,
and provides a comprehensive security dashboard API.
"""

import os
from contextlib import asynccontextmanager
from datetime import datetime
from dotenv import load_dotenv
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select

load_dotenv()

from database import create_db_and_tables, get_session
from models import Scan, Vulnerability
from seed_data import seed_database

from routers import scans, vulnerabilities, ai, reports


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle."""
    # Startup: Create tables and seed data if empty
    create_db_and_tables()

    # Auto-seed if no scans exist (demo reliability)
    from database import engine
    with Session(engine) as session:
        existing_scans = session.exec(select(Scan)).first()
        if not existing_scans:
            print("[*] No scans found - seeding demo data...")
            seed_database(session)
            print("[+] Demo data seeded successfully")

    yield
    # Shutdown: cleanup if needed


app = FastAPI(
    title="Vanguard AI",
    description="AI-Powered Autonomous Security Engineer — vulnerability scanning, AI analysis, and remediation",
    version="1.0.0",
    lifespan=lifespan,
)

CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=CORS_ORIGINS != ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(scans.router)
app.include_router(vulnerabilities.router)
app.include_router(ai.router)
app.include_router(reports.router)


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "Vanguard AI",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat(),
    }


@app.get("/api/dashboard/stats")
async def get_dashboard_stats(
    scan_id: int | None = None,
    session: Session = Depends(get_session),
):
    """Get comprehensive dashboard statistics.

    Returns the latest scan data (or a specific scan when `scan_id` is provided),
    risk distribution, compliance scores, and top critical vulnerabilities.
    """
    if scan_id is not None:
        latest_scan = session.get(Scan, scan_id)
    else:
        latest_scan = session.exec(
            select(Scan).order_by(Scan.id.desc())
        ).first()

    if not latest_scan:
        return {
            "latest_scan": None,
            "security_score": 100,
            "total_vulnerabilities": 0,
            "critical": 0,
            "high": 0,
            "medium": 0,
            "low": 0,
            "info": 0,
            "top_critical_vulns": [],
            "risk_distribution": {},
            "compliance": {
                "owasp_top10": 100,
                "pci_dss": 100,
                "iso27001": 100,
                "soc2": 100,
            },
        }

    # Get top critical/high vulns
    top_vulns = session.exec(
        select(Vulnerability)
        .where(Vulnerability.scan_id == latest_scan.id)
        .where(Vulnerability.is_resolved == False)
        .where(Vulnerability.risk.in_(["Critical", "High"]))
    ).all()

    # Risk distribution
    risk_distribution = {
        "Critical": latest_scan.critical_count,
        "High": latest_scan.high_count,
        "Medium": latest_scan.medium_count,
        "Low": latest_scan.low_count,
        "Informational": latest_scan.info_count,
    }

    # Calculate compliance scores based on vulnerability types
    total_vulns = latest_scan.total_vulns or 1
    high_critical = latest_scan.critical_count + latest_scan.high_count
    
    owasp_score = max(0, 100 - (high_critical * 15) - (latest_scan.medium_count * 5))
    pci_score = max(0, 100 - (high_critical * 20) - (latest_scan.medium_count * 8))
    iso_score = max(0, 100 - (high_critical * 10) - (latest_scan.medium_count * 5) - (latest_scan.low_count * 2))
    soc2_score = max(0, 100 - (high_critical * 12) - (latest_scan.medium_count * 6))

    # Get all scans for trend data
    all_scans = session.exec(
        select(Scan).where(Scan.status == "completed").order_by(Scan.id.desc())
    ).all()

    trend_data = [
        {
            "scan_id": s.id,
            "date": s.completed_at.isoformat() if s.completed_at else s.started_at.isoformat(),
            "critical": s.critical_count,
            "high": s.high_count,
            "medium": s.medium_count,
            "low": s.low_count,
            "score": s.security_score,
        }
        for s in all_scans[:7]
    ]

    return {
        "latest_scan": {
            "id": latest_scan.id,
            "target_url": latest_scan.target_url,
            "status": latest_scan.status,
            "started_at": latest_scan.started_at.isoformat() if latest_scan.started_at else None,
            "completed_at": latest_scan.completed_at.isoformat() if latest_scan.completed_at else None,
            "security_score": latest_scan.security_score,
            "total_vulns": latest_scan.total_vulns,
        },
        "security_score": latest_scan.security_score or 0,
        "total_vulnerabilities": latest_scan.total_vulns,
        "critical": latest_scan.critical_count,
        "high": latest_scan.high_count,
        "medium": latest_scan.medium_count,
        "low": latest_scan.low_count,
        "info": latest_scan.info_count,
        "top_critical_vulns": [
            {
                "id": v.id,
                "name": v.name,
                "risk": v.risk,
                "url": v.url,
                "cweid": v.cweid,
            }
            for v in top_vulns[:5]
        ],
        "risk_distribution": risk_distribution,
        "trend_data": trend_data,
        "compliance": {
            "owasp_top10": owasp_score,
            "pci_dss": pci_score,
            "iso27001": iso_score,
            "soc2": soc2_score,
        },
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port)
