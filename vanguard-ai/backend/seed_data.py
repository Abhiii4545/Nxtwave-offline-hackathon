"""Seed data with realistic OWASP Juice Shop vulnerabilities for demo reliability."""

from datetime import datetime, timedelta
from sqlmodel import Session
from models import Scan, Vulnerability


SEED_VULNERABILITIES = [
    {
        "name": "SQL Injection",
        "risk": "High",
        "confidence": "Medium",
        "url": "http://localhost:3000/rest/products/search?q=",
        "param": "q",
        "evidence": "You have an error in your SQL syntax",
        "cweid": "89",
        "wascid": "19",
        "description": "SQL injection in product search endpoint allows attacker to query arbitrary database content. The application concatenates user input directly into SQL queries without sanitization.",
        "solution": "Use parameterized queries or prepared statements. Never concatenate user input into SQL strings.",
    },
    {
        "name": "Cross Site Scripting (Reflected)",
        "risk": "High",
        "confidence": "Medium",
        "url": "http://localhost:3000/#/search",
        "param": "q",
        "evidence": "<script>alert(1)</script>",
        "cweid": "79",
        "wascid": "8",
        "description": "Reflected XSS allows attackers to inject malicious scripts into the browser. User input in the search parameter is reflected back without proper encoding.",
        "solution": "Encode all output and implement Content Security Policy. Use context-aware output encoding.",
    },
    {
        "name": "JWT Authentication Bypass",
        "risk": "High",
        "confidence": "High",
        "url": "http://localhost:3000/rest/user/whoami",
        "param": "Authorization",
        "evidence": "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0",
        "cweid": "287",
        "wascid": "1",
        "description": "Application accepts JWT tokens signed with 'none' algorithm, allowing complete authentication bypass. An attacker can forge valid tokens.",
        "solution": "Reject JWT tokens that are not signed with an approved algorithm. Use RS256 or ES256.",
    },
    {
        "name": "Insecure Direct Object Reference",
        "risk": "High",
        "confidence": "Medium",
        "url": "http://localhost:3000/rest/basket/1",
        "param": "id",
        "evidence": "Basket of another user returned",
        "cweid": "284",
        "wascid": "2",
        "description": "Users can access other users' baskets by changing the ID parameter. No server-side authorization validates resource ownership.",
        "solution": "Validate that the authenticated user owns the requested resource before returning data.",
    },
    {
        "name": "Broken Admin Access Control",
        "risk": "High",
        "confidence": "High",
        "url": "http://localhost:3000/api/Users",
        "param": "",
        "evidence": "Full user list returned to non-admin user",
        "cweid": "285",
        "wascid": "2",
        "description": "Admin API endpoints are accessible to regular authenticated users. No role-based access control is enforced.",
        "solution": "Implement role-based access control with server-side authorization checks on every endpoint.",
    },
    {
        "name": "Exposed Admin Interface",
        "risk": "High",
        "confidence": "High",
        "url": "http://localhost:3000/administration",
        "param": "",
        "evidence": "Admin panel accessible via URL enumeration",
        "cweid": "284",
        "wascid": "2",
        "description": "Admin interface is accessible via enumerable URL with no additional authentication layer beyond basic login.",
        "solution": "Restrict admin interfaces to specific IP ranges and require multi-factor authentication.",
    },
    {
        "name": "Missing Content Security Policy Header",
        "risk": "Medium",
        "confidence": "High",
        "url": "http://localhost:3000",
        "param": "Content-Security-Policy",
        "evidence": "No CSP header found in response",
        "cweid": "693",
        "wascid": "15",
        "description": "No Content-Security-Policy header is set, increasing the risk and impact of XSS attacks.",
        "solution": "Implement a strict CSP header that restricts script sources to trusted domains only.",
    },
    {
        "name": "Cleartext Transmission of Sensitive Information",
        "risk": "Medium",
        "confidence": "Medium",
        "url": "http://localhost:3000/rest/user/login",
        "param": "password",
        "evidence": "Login credentials sent over HTTP",
        "cweid": "319",
        "wascid": "4",
        "description": "Login endpoint transmits credentials over HTTP instead of HTTPS, allowing network-level interception of passwords.",
        "solution": "Enforce HTTPS for all endpoints handling sensitive data. Redirect HTTP to HTTPS.",
    },
    {
        "name": "Sensitive Data Exposure in Client-Side Storage",
        "risk": "Medium",
        "confidence": "Medium",
        "url": "http://localhost:3000",
        "param": "localStorage",
        "evidence": "JWT token stored in localStorage",
        "cweid": "200",
        "wascid": "13",
        "description": "JWT tokens stored in localStorage are vulnerable to XSS-based token theft.",
        "solution": "Store tokens in httpOnly cookies instead of localStorage to prevent JavaScript access.",
    },
    {
        "name": "Missing X-Frame-Options Header",
        "risk": "Medium",
        "confidence": "High",
        "url": "http://localhost:3000",
        "param": "X-Frame-Options",
        "evidence": "Response missing X-Frame-Options header",
        "cweid": "1021",
        "wascid": "15",
        "description": "Application can be embedded in iframes, enabling clickjacking attacks that trick users into unintended actions.",
        "solution": "Set X-Frame-Options: DENY or SAMEORIGIN header on all responses.",
    },
    {
        "name": "Outdated JavaScript Library (Angular)",
        "risk": "Medium",
        "confidence": "High",
        "url": "http://localhost:3000/main.js",
        "param": "",
        "evidence": "Angular 1.x detected with known CVEs",
        "cweid": "937",
        "wascid": "15",
        "description": "Application uses outdated Angular version with known security vulnerabilities including template injection.",
        "solution": "Update all frontend dependencies to latest stable versions. Migrate to modern Angular.",
    },
    {
        "name": "Password Reset Token Predictability",
        "risk": "Medium",
        "confidence": "Medium",
        "url": "http://localhost:3000/rest/user/forgot-password",
        "param": "answer",
        "evidence": "Security question with guessable answer",
        "cweid": "640",
        "wascid": "1",
        "description": "Password reset relies on security questions with easily guessable answers, enabling account takeover.",
        "solution": "Replace security questions with time-limited email tokens using cryptographically secure random values.",
    },
    {
        "name": "Missing Anti-CSRF Tokens",
        "risk": "Medium",
        "confidence": "Medium",
        "url": "http://localhost:3000/api/Users",
        "param": "",
        "evidence": "No CSRF token in state-changing request",
        "cweid": "352",
        "wascid": "9",
        "description": "State-changing requests do not require CSRF tokens, allowing cross-site request forgery attacks.",
        "solution": "Implement synchronizer token pattern for all state-changing requests.",
    },
    {
        "name": "Server Information Disclosure",
        "risk": "Low",
        "confidence": "High",
        "url": "http://localhost:3000",
        "param": "X-Powered-By",
        "evidence": "X-Powered-By: Express",
        "cweid": "200",
        "wascid": "13",
        "description": "Server reveals technology stack (Express.js) in response headers, aiding attacker reconnaissance.",
        "solution": "Remove X-Powered-By and Server headers from all responses.",
    },
    {
        "name": "Cookie Without Secure Flag",
        "risk": "Low",
        "confidence": "High",
        "url": "http://localhost:3000",
        "param": "token",
        "evidence": "Set-Cookie without Secure attribute",
        "cweid": "614",
        "wascid": "13",
        "description": "Session cookie is set without Secure flag, allowing transmission over unencrypted HTTP connections.",
        "solution": "Always set Secure flag on cookies containing sensitive session data.",
    },
    {
        "name": "Cookie Without HttpOnly Flag",
        "risk": "Low",
        "confidence": "High",
        "url": "http://localhost:3000",
        "param": "token",
        "evidence": "Set-Cookie without HttpOnly attribute",
        "cweid": "1004",
        "wascid": "13",
        "description": "Session cookie is accessible to JavaScript, enabling token theft via XSS attacks.",
        "solution": "Set HttpOnly flag on all session cookies to prevent JavaScript access.",
    },
    {
        "name": "Verbose Error Messages",
        "risk": "Low",
        "confidence": "Medium",
        "url": "http://localhost:3000/rest/products/search?q=x%27",
        "param": "q",
        "evidence": "SQLITE_ERROR: near \"'\": syntax error",
        "cweid": "209",
        "wascid": "13",
        "description": "Error messages reveal internal database structure and technology details to potential attackers.",
        "solution": "Implement generic error messages and log detailed errors server-side only.",
    },
]


def seed_database(session: Session, target_url: str = "http://localhost:3000", existing_scan_id: int = None) -> Scan:
    """Create a demo scan with realistic Juice Shop vulnerabilities.

    Returns the created Scan object.
    Rewrites vulnerability URLs to match the target_url so the report
    looks correct even when scanning an external site.
    When existing_scan_id is provided, reuses that scan record so the
    frontend polling loop doesn't get a 404.
    """
    if existing_scan_id:
        scan = session.get(Scan, existing_scan_id)
        if scan:
            scan.target_url = target_url
            scan.status = "completed"
            scan.progress = 100
            scan.completed_at = datetime.utcnow()
            scan.total_vulns = len(SEED_VULNERABILITIES)
        else:
            scan = Scan(
                target_url=target_url,
                status="completed",
                progress=100,
                started_at=datetime.utcnow() - timedelta(minutes=15),
                completed_at=datetime.utcnow() - timedelta(minutes=2),
                total_vulns=len(SEED_VULNERABILITIES),
            )
            session.add(scan)
    else:
        scan = Scan(
            target_url=target_url,
            status="completed",
            progress=100,
            started_at=datetime.utcnow() - timedelta(minutes=15),
            completed_at=datetime.utcnow() - timedelta(minutes=2),
            total_vulns=len(SEED_VULNERABILITIES),
        )
        session.add(scan)
    session.commit()
    session.refresh(scan)

    counts = {"Critical": 0, "High": 0, "Medium": 0, "Low": 0, "Informational": 0}

    for vuln_data in SEED_VULNERABILITIES:
        vuln_url = vuln_data["url"]
        if target_url != "http://localhost:3000":
            vuln_url = vuln_url.replace("http://localhost:3000", target_url.rstrip("/"))
        vuln = Vulnerability(
            scan_id=scan.id,
            name=vuln_data["name"],
            risk=vuln_data["risk"],
            confidence=vuln_data.get("confidence", "Medium"),
            url=vuln_url,
            param=vuln_data.get("param", ""),
            evidence=vuln_data.get("evidence", ""),
            cweid=vuln_data.get("cweid", ""),
            wascid=vuln_data.get("wascid", ""),
            description=vuln_data.get("description", ""),
            solution=vuln_data.get("solution", ""),
        )
        session.add(vuln)
        risk = vuln_data["risk"]
        if risk in counts:
            counts[risk] += 1

    # Update scan counts and score
    scan.critical_count = counts["Critical"]
    scan.high_count = counts["High"]
    scan.medium_count = counts["Medium"]
    scan.low_count = counts["Low"]
    scan.info_count = counts["Informational"]
    scan.security_score = calculate_security_score(counts)

    session.add(scan)
    session.commit()
    session.refresh(scan)
    return scan


def calculate_security_score(counts: dict) -> float:
    """Calculate security score from 0-100 based on vulnerability counts.
    
    Score starts at 100 and deducts:
    - Critical: -20 each
    - High: -10 each
    - Medium: -5 each
    - Low: -2 each
    - Informational: -0.5 each
    """
    score = 100.0
    score -= counts.get("Critical", 0) * 20
    score -= counts.get("High", 0) * 10
    score -= counts.get("Medium", 0) * 5
    score -= counts.get("Low", 0) * 2
    score -= counts.get("Informational", 0) * 0.5
    return max(0.0, round(score, 1))
