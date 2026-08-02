"""ZAP (Zed Attack Proxy) integration service for vulnerability scanning."""

import os
import json
import time
import asyncio
import httpx
from datetime import datetime
from sqlmodel import Session, select
from models import Scan, Vulnerability
from seed_data import calculate_security_score


class ZapService:
    """Manages OWASP ZAP scanner interactions."""

    def __init__(self):
        self.api_url = os.getenv("ZAP_API_URL", "http://localhost:8080")
        self.api_key = os.getenv("ZAP_API_KEY", "vanguard-zap-key")
        self.base_url = f"{self.api_url}/JSON"

    async def _zap_request(self, component: str, action_type: str, action: str, **params):
        """Make an HTTP request to the ZAP API."""
        url = f"{self.api_url}/JSON/{component}/{action_type}/{action}/"
        params["apikey"] = self.api_key
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            return resp.json()

    async def wait_for_zap_ready(self, timeout: int = 30):
        """Wait for ZAP to finish starting up. Short timeout to fail fast to HTTP scanner."""
        start = time.time()
        while time.time() - start < timeout:
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    resp = await client.get(
                        f"{self.api_url}/JSON/core/view/version/",
                        params={"apikey": self.api_key}
                    )
                    if resp.status_code == 200:
                        return True
            except (httpx.ConnectError, httpx.ReadTimeout, httpx.ConnectTimeout):
                pass
            await asyncio.sleep(3)
        raise TimeoutError("ZAP did not become ready within timeout")

    async def spider_target(self, target_url: str, scan_id: int, session: Session):
        """Run ZAP spider to discover all pages and endpoints."""
        await self._zap_request("spider", "action", "setOptionMaxDepth", Integer="2")
        await self._zap_request("spider", "action", "setOptionMaxDuration", Integer="2")

        result = await self._zap_request("spider", "action", "scan", url=target_url)
        spider_id = result.get("scan", "0")

        while True:
            status = await self._zap_request("spider", "view", "status", scanId=spider_id)
            progress = int(status.get("status", "0"))
            scan_progress = int(progress * 0.4)
            scan = session.get(Scan, scan_id)
            if scan:
                scan.progress = scan_progress
                session.add(scan)
                session.commit()
            if progress >= 100:
                break
            await asyncio.sleep(2)

    async def active_scan(self, target_url: str, scan_id: int, session: Session):
        """Run ZAP active scanner for deep vulnerability testing."""
        result = await self._zap_request("ascan", "action", "scan", url=target_url)
        scan_zap_id = result.get("scan", "0")

        while True:
            status = await self._zap_request("ascan", "view", "status", scanId=scan_zap_id)
            progress = int(status.get("status", "0"))
            scan_progress = 40 + int(progress * 0.55)
            scan = session.get(Scan, scan_id)
            if scan:
                scan.progress = min(scan_progress, 95)
                session.add(scan)
                session.commit()
            if progress >= 100:
                break
            await asyncio.sleep(3)

    async def get_alerts(self, target_url: str):
        """Retrieve all vulnerability alerts found by ZAP."""
        result = await self._zap_request(
            "alert", "view", "alerts",
            baseurl=target_url, start="0", count="500"
        )
        return result.get("alerts", [])

    async def run_full_scan(self, scan_id: int, target_url: str, _session=None):
        """Orchestrate a complete scan: try ZAP first, fall back to real HTTP scanner.

        Creates its own DB session to avoid SQLite thread-safety issues.
        """
        from database import engine
        with Session(engine) as bg_session:
            await self._run_scan_impl(scan_id, target_url, bg_session)

    async def _run_scan_impl(self, scan_id: int, target_url: str, session: Session):
        scan = session.get(Scan, scan_id)
        if not scan:
            return

        try:
            if not target_url.startswith('http://') and not target_url.startswith('https://'):
                target_url = f"https://{target_url}"

            scan.status = "running"
            scan.progress = 0
            session.add(scan)
            session.commit()

            await self.wait_for_zap_ready()

            scan.progress = 5
            session.add(scan)
            session.commit()

            await self.spider_target(target_url, scan_id, session)
            await self.active_scan(target_url, scan_id, session)

            alerts = await self.get_alerts(target_url)

            self._save_alerts(session, scan_id, target_url, alerts)
            self._finalize_scan(session, scan_id)

        except Exception as e:
            print(f"[!] ZAP unavailable ({e}). Running real HTTP security scan for {target_url}...")
            await self._run_http_scan(scan_id, target_url, session)

    async def _run_http_scan(self, scan_id: int, target_url: str, session: Session):
        """Run real HTTP-based security scan as primary fallback."""
        from services.http_scanner import http_scanner

        scan = session.get(Scan, scan_id)
        if not scan:
            return

        scan.status = "running"
        scan.progress = 5
        session.add(scan)
        session.commit()

        async def update_progress(progress):
            s = session.get(Scan, scan_id)
            if s:
                s.progress = progress
                session.add(s)
                session.commit()

        try:
            findings = await http_scanner.scan(target_url, progress_callback=update_progress)

            counts = {"Critical": 0, "High": 0, "Medium": 0, "Low": 0, "Informational": 0}

            for f in findings:
                vuln = Vulnerability(
                    scan_id=scan_id,
                    name=f.name,
                    risk=f.risk,
                    confidence=f.confidence,
                    url=f.url,
                    method=f.method,
                    param=f.param,
                    attack=f.attack,
                    evidence=f.evidence,
                    description=f.description,
                    solution=f.solution,
                    cweid=f.cweid,
                    wascid=f.wascid,
                    verified=getattr(f, "verified", True),
                    repro_command=getattr(f, "repro_command", None),
                )
                session.add(vuln)
                if f.risk in counts:
                    counts[f.risk] += 1

            # A target that was not reachable (404/error/DNS) is not a real
            # assessment surface — it must not receive a normal, high-looking
            # security score, and AI suggestions would only hallucinate issues.
            unreachable = any(
                f.name.startswith("Target URL Not Reachable") or f.name == "Target Unreachable"
                for f in findings
            )

            scan = session.get(Scan, scan_id)
            scan.status = "completed"
            scan.progress = 100
            scan.completed_at = datetime.utcnow()
            scan.total_vulns = len(findings)
            scan.critical_count = counts["Critical"]
            scan.high_count = counts["High"]
            scan.medium_count = counts["Medium"]
            scan.low_count = counts["Low"]
            scan.info_count = counts["Informational"]
            scan.security_score = 0 if unreachable else calculate_security_score(counts)
            session.add(scan)
            session.commit()

            print(f"[+] HTTP scan complete for {target_url}: {len(findings)} real findings")

            if unreachable:
                # No live page → give an honest message instead of AI-invented findings.
                scan.ai_suggestions = json.dumps({
                    "summary": (
                        "The target URL could not be reached — it returned an error status or does not "
                        "exist, so no security assessment could be performed. Confirm the URL is correct "
                        "and points to a live, publicly reachable page, then scan again."
                    ),
                    "overall_risk": "UNKNOWN",
                    "suggestions": [],
                })
                session.add(scan)
                session.commit()
            else:
                # Generate AI suggestions from real data
                try:
                    from services.ai_service import ai_service
                    all_vulns = session.exec(
                        select(Vulnerability).where(Vulnerability.scan_id == scan_id)
                    ).all()
                    suggestions = await ai_service.generate_security_suggestions(scan, list(all_vulns))
                    scan.ai_suggestions = json.dumps(suggestions)
                    session.add(scan)
                    session.commit()
                    print(f"[+] AI suggestions generated for scan {scan_id}")
                except Exception as ai_err:
                    print(f"[!] AI suggestions failed: {ai_err}")

        except Exception as scan_err:
            print(f"[!] HTTP scan also failed ({scan_err}). Falling back to seed data for {target_url}...")
            from seed_data import seed_database
            seed_database(session, target_url, existing_scan_id=scan_id)

    def _save_alerts(self, session, scan_id, target_url, alerts):
        """Save ZAP alerts as Vulnerability records."""
        counts = {"Critical": 0, "High": 0, "Medium": 0, "Low": 0, "Informational": 0}

        for alert in alerts:
            risk = alert.get("risk", "Informational")
            risk_map = {"0": "Informational", "1": "Low", "2": "Medium", "3": "High"}
            if risk in risk_map:
                risk = risk_map[risk]

            vuln = Vulnerability(
                scan_id=scan_id,
                name=alert.get("name", "Unknown"),
                risk=risk,
                confidence=alert.get("confidence", "Medium"),
                url=alert.get("url", target_url),
                method=alert.get("method", "GET"),
                param=alert.get("param", ""),
                attack=alert.get("attack", ""),
                evidence=alert.get("evidence", ""),
                description=alert.get("description", ""),
                solution=alert.get("solution", ""),
                reference=alert.get("reference", ""),
                cweid=alert.get("cweid", ""),
                wascid=alert.get("wascid", ""),
            )
            session.add(vuln)
            if risk in counts:
                counts[risk] += 1

        scan = session.get(Scan, scan_id)
        scan.status = "completed"
        scan.progress = 100
        scan.completed_at = datetime.utcnow()
        scan.total_vulns = len(alerts)
        scan.critical_count = counts["Critical"]
        scan.high_count = counts["High"]
        scan.medium_count = counts["Medium"]
        scan.low_count = counts["Low"]
        scan.info_count = counts["Informational"]
        scan.security_score = calculate_security_score(counts)
        session.add(scan)
        session.commit()

    def _finalize_scan(self, session, scan_id):
        """Generate AI suggestions after ZAP scan completes."""
        try:
            scan = session.get(Scan, scan_id)
            from services.ai_service import ai_service
            all_vulns = session.exec(
                select(Vulnerability).where(Vulnerability.scan_id == scan_id)
            ).all()
            import asyncio
            suggestions = asyncio.get_event_loop().run_until_complete(
                ai_service.generate_security_suggestions(scan, list(all_vulns))
            )
            scan.ai_suggestions = json.dumps(suggestions)
            session.add(scan)
            session.commit()
            print(f"[+] AI suggestions generated for scan {scan_id}")
        except Exception as e:
            print(f"[!] AI suggestions failed: {e}")


# Singleton instance
zap_service = ZapService()
