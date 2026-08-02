"""Lightweight HTTP security scanner for real vulnerability detection.

Performs actual HTTP requests to analyze security posture without needing
OWASP ZAP. Checks headers, SSL, cookies, CORS, information disclosure,
and common misconfigurations.
"""

import asyncio
import ssl
import socket
from urllib.parse import urlparse
from datetime import datetime
from typing import List
import httpx


class Finding:
    def __init__(self, name, risk, confidence, url, description, solution,
                 param="", evidence="", cweid="", wascid="", method="GET", attack="",
                 verified=True, repro_command=""):
        self.name = name
        self.risk = risk
        self.confidence = confidence
        self.url = url
        self.description = description
        self.solution = solution
        self.param = param
        self.evidence = evidence
        self.cweid = cweid
        self.wascid = wascid
        self.method = method
        self.attack = attack
        # Every HTTP-scanner finding is derived from a real observed response,
        # so it is verified by default and carries a reproduction command.
        self.verified = verified
        self.repro_command = repro_command

    def to_dict(self):
        return {
            "name": self.name,
            "risk": self.risk,
            "confidence": self.confidence,
            "url": self.url,
            "description": self.description,
            "solution": self.solution,
            "param": self.param,
            "evidence": self.evidence,
            "cweid": self.cweid,
            "wascid": self.wascid,
            "method": self.method,
            "attack": self.attack,
            "verified": self.verified,
            "repro_command": self.repro_command,
        }


SECURITY_HEADERS = {
    "Strict-Transport-Security": {
        "name": "Missing Strict-Transport-Security Header",
        "risk": "Medium",
        "cweid": "319",
        "description": "The HTTP Strict-Transport-Security (HSTS) header is not set. This allows man-in-the-middle attackers to intercept traffic by downgrading HTTPS connections to HTTP.",
        "solution": "Add the Strict-Transport-Security header with a long max-age value: Strict-Transport-Security: max-age=31536000; includeSubDomains; preload",
    },
    "Content-Security-Policy": {
        "name": "Content Security Policy (CSP) Header Not Set",
        "risk": "Medium",
        "cweid": "693",
        "description": "Content Security Policy (CSP) is not configured. Without CSP, the site is more vulnerable to Cross-Site Scripting (XSS) attacks as browsers cannot restrict which resources can be loaded.",
        "solution": "Set a Content-Security-Policy header. Start with: Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;",
    },
    "X-Content-Type-Options": {
        "name": "X-Content-Type-Options Header Missing",
        "risk": "Low",
        "cweid": "693",
        "description": "The X-Content-Type-Options header is not set to 'nosniff'. This allows browsers to MIME-sniff the response content, potentially treating non-executable MIME types as executable.",
        "solution": "Add the X-Content-Type-Options header with value 'nosniff': X-Content-Type-Options: nosniff",
    },
    "X-Frame-Options": {
        "name": "Missing Anti-clickjacking Header (X-Frame-Options)",
        "risk": "Medium",
        "cweid": "1021",
        "description": "The X-Frame-Options header is not set. This makes the site vulnerable to clickjacking attacks where an attacker can embed the page in an iframe on a malicious site.",
        "solution": "Set X-Frame-Options to DENY or SAMEORIGIN: X-Frame-Options: DENY",
    },
    "Referrer-Policy": {
        "name": "Missing Referrer-Policy Header",
        "risk": "Low",
        "cweid": "116",
        "description": "The Referrer-Policy header is not set. Without it, the browser may send the full URL (including query parameters with sensitive data) as the Referer header when navigating to other sites.",
        "solution": "Add Referrer-Policy header: Referrer-Policy: strict-origin-when-cross-origin",
    },
    "Permissions-Policy": {
        "name": "Missing Permissions-Policy Header",
        "risk": "Low",
        "cweid": "693",
        "description": "The Permissions-Policy (formerly Feature-Policy) header is not set. This means browser features like camera, microphone, and geolocation are not explicitly restricted.",
        "solution": "Set Permissions-Policy to restrict unnecessary browser features: Permissions-Policy: camera=(), microphone=(), geolocation=()",
    },
}

INFO_DISCLOSURE_HEADERS = {
    "Server": {
        "name": "Server Information Disclosure via HTTP Header",
        "risk": "Low",
        "cweid": "200",
        "description": "The Server header reveals web server software and version information, helping attackers identify known vulnerabilities in the specific version.",
        "solution": "Remove or obfuscate the Server header in your web server configuration.",
    },
    "X-Powered-By": {
        "name": "Technology Stack Disclosure via X-Powered-By",
        "risk": "Low",
        "cweid": "200",
        "description": "The X-Powered-By header reveals the backend technology framework, helping attackers target known vulnerabilities specific to that framework.",
        "solution": "Remove the X-Powered-By header. In Express.js: app.disable('x-powered-by'). In PHP: expose_php = Off.",
    },
    "X-AspNet-Version": {
        "name": "ASP.NET Version Disclosure",
        "risk": "Low",
        "cweid": "200",
        "description": "The X-AspNet-Version header reveals the ASP.NET framework version being used, aiding attackers in targeting version-specific vulnerabilities.",
        "solution": "Remove X-AspNet-Version by setting enableVersionHeader=\"false\" in web.config.",
    },
    "X-AspNetMvc-Version": {
        "name": "ASP.NET MVC Version Disclosure",
        "risk": "Low",
        "cweid": "200",
        "description": "The X-AspNetMvc-Version header discloses the MVC framework version.",
        "solution": "Remove X-AspNetMvc-Version in Application_Start: MvcHandler.DisableMvcResponseHeader = true.",
    },
}

# Each entry: (path, name, risk, description, signatures)
# `signatures` is a list of case-insensitive substrings the response body MUST contain
# for the finding to be valid. This eliminates false positives (e.g. SPA fallback pages
# returning 200 for every path). An empty list means "any 200 response counts".
SENSITIVE_PATHS = [
    (".env", "Environment File Exposed", "High",
     "Environment configuration file (.env) is publicly accessible. This may contain database credentials, API keys, secret keys, and other sensitive configuration.",
     ["=", "\n"], ["<html", "<!doctype", "<body"]),
    (".git/config", "Git Repository Exposed", "High",
     "Git repository configuration is publicly accessible. An attacker can download the full source code, including hardcoded secrets and internal logic.",
     ["[core]", "repositoryformatversion"], ["<html", "<!doctype"]),
    ("wp-admin/", "WordPress Admin Panel Exposed", "Medium",
     "WordPress admin login page is publicly accessible, making it a target for brute-force attacks.",
     ["wp-login", "wordpress", "wp-submit", "wp-content"], []),
    ("wp-login.php", "WordPress Login Page Exposed", "Medium",
     "WordPress login page is reachable, making it a target for credential brute-force attacks.",
     ["wp-login", "wordpress", "wp-submit"], []),
    ("admin/", "Admin Panel Accessible", "Medium",
     "An administrative interface is publicly accessible without apparent IP restriction.",
     ["admin", "login", "password", "sign in", "dashboard"], ["not found", "page not found", "404"]),
    ("administrator/", "Joomla Admin Panel Exposed", "Medium",
     "A Joomla-style administrator interface is publicly accessible.",
     ["joomla", "administrator", "login"], []),
    ("phpmyadmin/", "phpMyAdmin Exposed", "High",
     "phpMyAdmin database interface is publicly accessible, enabling direct database attacks.",
     ["phpmyadmin", "pma_"], []),
    ("api/swagger", "API Documentation Exposed", "Low",
     "Swagger/OpenAPI documentation is publicly accessible, revealing all API endpoints, parameters, and data structures.",
     ["swagger", "openapi"], []),
    ("swagger-ui.html", "Swagger UI Exposed", "Low",
     "Swagger UI documentation is publicly accessible.",
     ["swagger", "openapi"], []),
    ("api/docs", "API Documentation Exposed", "Low",
     "API documentation endpoint is publicly accessible.",
     ["swagger", "openapi", "redoc", "api documentation"], []),
    (".DS_Store", "macOS Directory Listing Exposed", "Low",
     "A macOS .DS_Store file is publicly accessible, potentially revealing directory structure and filenames.",
     ["Bud1"], ["<html"]),
    ("crossdomain.xml", "Flash Cross-Domain Policy", "Informational",
     "A crossdomain.xml file exists which may allow Flash-based cross-origin requests.",
     ["cross-domain-policy", "allow-access-from"], []),
    (".well-known/security.txt", "security.txt Present", "Informational",
     "A security.txt file provides vulnerability disclosure contact information.",
     ["contact:", "expires:", "policy:"], []),
    ("backup.zip", "Backup Archive Exposed", "High",
     "A backup archive is publicly accessible, potentially exposing source code and databases.",
     [], []),
    ("backup.sql", "SQL Backup Exposed", "High",
     "A SQL database backup is publicly accessible.",
     ["insert into", "create table", "-- mysql"], ["<html"]),
    ("config.php", "PHP Config File Exposed", "High",
     "A PHP configuration file may be exposed containing credentials.",
     ["<?php", "define(", "$config"], ["<html"]),
    (".htaccess", "Apache .htaccess Exposed", "Medium",
     "The Apache .htaccess file is publicly readable, revealing rewrite rules and security config.",
     ["rewriteengine", "rewriterule", "options"], ["<html"]),
]


class HttpScanner:
    """Performs real HTTP-based security checks against target URLs."""

    def __init__(self):
        self.timeout = 15.0
        self.user_agent = "Vanguard-AI-Scanner/1.0 (Security Assessment)"

    async def scan(self, target_url: str, progress_callback=None) -> List[Finding]:
        findings: List[Finding] = []
        parsed = urlparse(target_url)
        base_url = f"{parsed.scheme}://{parsed.netloc}"

        async with httpx.AsyncClient(
            timeout=self.timeout,
            follow_redirects=True,
            verify=False,
            headers={"User-Agent": self.user_agent},
        ) as client:
            if progress_callback:
                await progress_callback(5)

            main_response = None
            try:
                main_response = await client.get(target_url)
            except Exception as e:
                findings.append(Finding(
                    name="Target Unreachable",
                    risk="High",
                    confidence="High",
                    url=target_url,
                    description=f"Could not connect to the target URL: {str(e)}",
                    solution="Verify the URL is correct and the server is running.",
                    cweid="16",
                ))
                return findings

            if progress_callback:
                await progress_callback(15)

            findings.extend(self._check_security_headers(main_response, target_url))

            if progress_callback:
                await progress_callback(30)

            findings.extend(self._check_info_disclosure(main_response, target_url))

            if progress_callback:
                await progress_callback(40)

            findings.extend(self._check_cookies(main_response, target_url, parsed))

            if progress_callback:
                await progress_callback(50)

            cors_findings = await self._check_cors(client, target_url)
            findings.extend(cors_findings)

            if progress_callback:
                await progress_callback(60)

            if parsed.scheme == "https":
                ssl_findings = await self._check_ssl(parsed.netloc)
                findings.extend(ssl_findings)
            else:
                findings.append(Finding(
                    name="HTTPS Not Used",
                    risk="High",
                    confidence="High",
                    url=target_url,
                    description="The site is served over plain HTTP without encryption. All traffic including credentials and session tokens can be intercepted by anyone on the network.",
                    solution="Obtain an SSL/TLS certificate and enforce HTTPS. Use Let's Encrypt for free certificates.",
                    cweid="319",
                ))

            if progress_callback:
                await progress_callback(70)

            redirect_findings = await self._check_http_redirect(client, parsed)
            findings.extend(redirect_findings)

            if progress_callback:
                await progress_callback(75)

            path_findings = await self._check_sensitive_paths(client, base_url)
            findings.extend(path_findings)

            if progress_callback:
                await progress_callback(80)

            findings.extend(self._check_cache_headers(main_response, target_url))

            # Deep scan: JS asset analysis + active authentication / access-control
            # testing. Isolated so any failure never breaks the header-level scan.
            try:
                from services.deep_scanner import run_deep_scan
                deep_findings = await run_deep_scan(client, target_url, main_response)
                findings.extend(deep_findings)
            except Exception as e:
                print(f"[!] Deep scan unavailable (non-fatal): {e}")

            if progress_callback:
                await progress_callback(95)

        return findings

    def _check_security_headers(self, response, url) -> List[Finding]:
        findings = []
        headers = response.headers

        # Some sites deliver CSP / X-Frame-Options via <meta> tag in HTML.
        # Parse the body once so we can avoid flagging those as missing.
        body_lower = ""
        try:
            content_type = headers.get("content-type", "").lower()
            if "html" in content_type:
                body_lower = response.text[:20000].lower()
        except Exception:
            pass

        meta_csp_present = 'http-equiv="content-security-policy"' in body_lower or "http-equiv='content-security-policy'" in body_lower
        meta_xfo_present = 'http-equiv="x-frame-options"' in body_lower

        # Snapshot of the security-relevant headers actually returned — this is
        # the proof that a given header is genuinely absent.
        watched = list(SECURITY_HEADERS.keys()) + ["Server", "Set-Cookie", "Cache-Control"]
        watched_lower = {w.lower() for w in watched}
        present = sorted({k for k in headers if k.lower() in watched_lower})
        observed = ", ".join(present) or "(no security headers returned)"
        repro = f"curl -sI {url}"

        for header_name, info in SECURITY_HEADERS.items():
            if header_name == "Content-Security-Policy" and meta_csp_present:
                continue
            if header_name == "X-Frame-Options" and meta_xfo_present:
                continue
            if header_name.lower() not in {k.lower(): k for k in headers}:
                findings.append(Finding(
                    name=info["name"],
                    risk=info["risk"],
                    confidence="High",
                    url=url,
                    param=header_name,
                    evidence=f"'{header_name}' not present in response. Headers returned: {observed}",
                    description=info["description"],
                    solution=info["solution"],
                    cweid=info["cweid"],
                    repro_command=repro,
                ))
            else:
                actual_key = next((k for k in headers if k.lower() == header_name.lower()), None)
                if actual_key and header_name == "Strict-Transport-Security":
                    val = headers[actual_key]
                    if "max-age" in val.lower():
                        import re
                        match = re.search(r'max-age=(\d+)', val)
                        if match and int(match.group(1)) < 86400:
                            findings.append(Finding(
                                name="Weak Strict-Transport-Security max-age",
                                risk="Low",
                                confidence="High",
                                url=url,
                                param=header_name,
                                evidence=f"{actual_key}: {val}",
                                description=f"HSTS max-age is set to {match.group(1)} seconds, which is less than 1 day. Attackers have a window to perform SSL stripping.",
                                solution="Increase HSTS max-age to at least 31536000 (1 year): Strict-Transport-Security: max-age=31536000; includeSubDomains",
                                cweid="319",
                                repro_command=repro,
                            ))

        return findings

    def _check_info_disclosure(self, response, url) -> List[Finding]:
        findings = []
        headers = response.headers

        for header_name, info in INFO_DISCLOSURE_HEADERS.items():
            actual_key = next((k for k in headers if k.lower() == header_name.lower()), None)
            if actual_key:
                val = headers[actual_key]
                findings.append(Finding(
                    name=info["name"],
                    risk=info["risk"],
                    confidence="High",
                    url=url,
                    param=header_name,
                    evidence=f"{actual_key}: {val}",
                    description=info["description"],
                    solution=info["solution"],
                    cweid=info["cweid"],
                    repro_command=f"curl -sI {url} | grep -i '{header_name}'",
                ))

        return findings

    def _check_cookies(self, response, url, parsed) -> List[Finding]:
        findings = []
        is_https = parsed.scheme == "https"

        for cookie_header in response.headers.get_list("set-cookie") if hasattr(response.headers, 'get_list') else [response.headers.get("set-cookie", "")]:
            if not cookie_header:
                continue
            cookie_lower = cookie_header.lower()
            cookie_name = cookie_header.split("=")[0].strip()

            cookie_repro = f"curl -sI {url} | grep -i set-cookie"

            if "httponly" not in cookie_lower:
                findings.append(Finding(
                    name="Cookie Without HttpOnly Flag",
                    risk="Medium",
                    confidence="High",
                    url=url,
                    param=cookie_name,
                    evidence=f"Set-Cookie: {cookie_header[:200]}",
                    description=f"The cookie '{cookie_name}' does not have the HttpOnly flag set. JavaScript can access this cookie, making it vulnerable to theft via XSS attacks.",
                    solution="Add the HttpOnly flag to the cookie: Set-Cookie: {name}=value; HttpOnly",
                    cweid="1004",
                    repro_command=cookie_repro,
                ))

            if is_https and "secure" not in cookie_lower:
                findings.append(Finding(
                    name="Cookie Without Secure Flag",
                    risk="Medium",
                    confidence="High",
                    url=url,
                    param=cookie_name,
                    evidence=f"Set-Cookie: {cookie_header[:200]}",
                    description=f"The cookie '{cookie_name}' is set without the Secure flag on an HTTPS site. The cookie can be transmitted over unencrypted HTTP connections.",
                    solution="Add the Secure flag: Set-Cookie: {name}=value; Secure",
                    cweid="614",
                    repro_command=cookie_repro,
                ))

            if "samesite" not in cookie_lower:
                findings.append(Finding(
                    name="Cookie Without SameSite Attribute",
                    risk="Low",
                    confidence="High",
                    url=url,
                    param=cookie_name,
                    evidence=f"Set-Cookie: {cookie_header[:200]}",
                    description=f"The cookie '{cookie_name}' does not have the SameSite attribute set, potentially making it vulnerable to Cross-Site Request Forgery (CSRF) attacks.",
                    solution="Add SameSite attribute: Set-Cookie: {name}=value; SameSite=Lax (or Strict)",
                    cweid="352",
                    repro_command=cookie_repro,
                ))

        return findings

    async def _check_cors(self, client, url) -> List[Finding]:
        findings = []
        try:
            resp = await client.options(url, headers={
                "Origin": "https://evil-attacker.com",
                "Access-Control-Request-Method": "GET",
            })
            cors_repro = f"curl -s -I -H 'Origin: https://evil-attacker.com' -X OPTIONS {url}"
            acao = resp.headers.get("Access-Control-Allow-Origin", "")
            if acao == "*":
                findings.append(Finding(
                    name="Wildcard CORS Policy",
                    risk="Medium",
                    confidence="High",
                    url=url,
                    param="Access-Control-Allow-Origin",
                    evidence=f"Access-Control-Allow-Origin: {acao}",
                    description="The server uses a wildcard (*) CORS policy, allowing any website to make cross-origin requests. If the API returns sensitive data, any malicious website can read it.",
                    solution="Replace wildcard with specific trusted origins: Access-Control-Allow-Origin: https://yourdomain.com",
                    cweid="942",
                    repro_command=cors_repro,
                ))
            elif "evil-attacker.com" in acao:
                findings.append(Finding(
                    name="CORS Origin Reflection (Misconfigured)",
                    risk="High",
                    confidence="High",
                    url=url,
                    param="Access-Control-Allow-Origin",
                    evidence=f"Sent Origin: https://evil-attacker.com → Access-Control-Allow-Origin: {acao}",
                    description="The server reflects arbitrary Origin headers in Access-Control-Allow-Origin, meaning any attacker-controlled website can make authenticated cross-origin requests and read responses.",
                    solution="Validate the Origin header against a whitelist of trusted domains.",
                    cweid="942",
                    repro_command=cors_repro,
                ))

            acac = resp.headers.get("Access-Control-Allow-Credentials", "")
            if acac.lower() == "true" and acao == "*":
                findings.append(Finding(
                    name="CORS Allows Credentials with Wildcard Origin",
                    risk="High",
                    confidence="High",
                    url=url,
                    param="Access-Control-Allow-Credentials",
                    evidence=f"ACAO: {acao}, ACAC: {acac}",
                    description="The server allows credentials (cookies, auth headers) with a wildcard origin. Any website can make authenticated requests and read the response.",
                    solution="Never combine Access-Control-Allow-Credentials: true with Access-Control-Allow-Origin: *.",
                    cweid="942",
                    repro_command=cors_repro,
                ))
        except Exception:
            pass
        return findings

    async def _check_ssl(self, hostname) -> List[Finding]:
        findings = []
        host = hostname.split(":")[0]
        port = 443
        ssl_repro = f"echo | openssl s_client -connect {host}:443 -servername {host} 2>/dev/null | openssl x509 -noout -dates -issuer"

        try:
            ctx = ssl.create_default_context()
            with socket.create_connection((host, port), timeout=10) as sock:
                with ctx.wrap_socket(sock, server_hostname=host) as ssock:
                    cert = ssock.getpeercert()
                    protocol = ssock.version()

                    if protocol in ("TLSv1", "TLSv1.1"):
                        findings.append(Finding(
                            name=f"Outdated TLS Version ({protocol})",
                            risk="High",
                            confidence="High",
                            url=f"https://{hostname}",
                            evidence=f"Negotiated TLS Version: {protocol}",
                            description=f"The server supports {protocol} which is deprecated and has known vulnerabilities. Modern browsers are dropping support for these versions.",
                            solution="Configure the server to support only TLS 1.2 and TLS 1.3. Disable TLS 1.0 and 1.1.",
                            cweid="326",
                            repro_command=f"echo | openssl s_client -connect {host}:443 -servername {host} 2>/dev/null | grep Protocol",
                        ))

                    not_after = cert.get("notAfter", "")
                    if not_after:
                        from email.utils import parsedate_to_datetime
                        try:
                            expiry = parsedate_to_datetime(not_after)
                            days_left = (expiry - datetime.now(expiry.tzinfo)).days
                            if days_left < 0:
                                findings.append(Finding(
                                    name="Expired SSL/TLS Certificate",
                                    risk="High",
                                    confidence="High",
                                    url=f"https://{hostname}",
                                    evidence=f"Certificate notAfter: {not_after} (expired)",
                                    description="The SSL/TLS certificate has expired. Browsers will show security warnings, and encrypted connections cannot be trusted.",
                                    solution="Renew the SSL/TLS certificate immediately. Use Let's Encrypt for free auto-renewing certificates.",
                                    cweid="295",
                                    repro_command=ssl_repro,
                                ))
                            elif days_left < 30:
                                findings.append(Finding(
                                    name="SSL/TLS Certificate Expiring Soon",
                                    risk="Low",
                                    confidence="High",
                                    url=f"https://{hostname}",
                                    evidence=f"Certificate notAfter: {not_after} ({days_left} days remaining)",
                                    description=f"The SSL/TLS certificate expires in {days_left} days. If not renewed, the site will show security warnings.",
                                    solution="Renew the SSL certificate before expiration. Enable auto-renewal with certbot or your certificate provider.",
                                    cweid="295",
                                    repro_command=ssl_repro,
                                ))
                        except Exception:
                            pass
        except ssl.SSLCertVerificationError as e:
            findings.append(Finding(
                name="Invalid SSL/TLS Certificate",
                risk="High",
                confidence="High",
                url=f"https://{hostname}",
                evidence=f"Verification error: {str(e)[:200]}",
                description="The SSL/TLS certificate failed verification. This could mean the certificate is self-signed, expired, or issued for a different domain.",
                solution="Install a valid SSL certificate from a trusted Certificate Authority (CA).",
                cweid="295",
                repro_command=ssl_repro,
            ))
        except Exception:
            pass

        return findings

    async def _check_http_redirect(self, client, parsed) -> List[Finding]:
        findings = []
        if parsed.scheme != "https":
            return findings

        http_url = f"http://{parsed.netloc}{parsed.path or '/'}"
        try:
            resp = await client.get(http_url, follow_redirects=False)
            location = resp.headers.get("location", "")
            redirect_repro = f"curl -sI {http_url}"
            if resp.status_code in (301, 302, 307, 308):
                if not location.startswith("https://"):
                    findings.append(Finding(
                        name="HTTP to HTTPS Redirect Missing",
                        risk="Medium",
                        confidence="High",
                        url=http_url,
                        evidence=f"HTTP {resp.status_code} → Location: {location or '(none)'}",
                        description="The HTTP version of the site does not redirect to HTTPS. Users accessing the site via HTTP will have their traffic sent unencrypted.",
                        solution="Configure the server to redirect all HTTP requests to HTTPS with a 301 redirect.",
                        cweid="319",
                        repro_command=redirect_repro,
                    ))
            elif resp.status_code == 200:
                findings.append(Finding(
                    name="Site Accessible Over HTTP Without Redirect",
                    risk="Medium",
                    confidence="High",
                    url=http_url,
                    evidence=f"HTTP 200 served over plain http:// (no redirect to https://)",
                    description="The site serves content over plain HTTP without redirecting to HTTPS. Traffic can be intercepted and modified by attackers on the same network.",
                    solution="Add a server-level redirect from HTTP to HTTPS. Example nginx: return 301 https://$server_name$request_uri;",
                    cweid="319",
                    repro_command=redirect_repro,
                ))
        except Exception:
            pass
        return findings

    async def _check_sensitive_paths(self, client, base_url) -> List[Finding]:
        """Check for exposed sensitive paths using body-content validation.

        A path is only flagged when the FINAL response (after following redirects)
        is a 200 AND the body actually looks like the expected resource. This
        eliminates false positives from SPA fallback pages, 301→404 chains, or
        WAFs that return 200 with a login/error page.
        """
        findings = []

        # First fetch the site's 404 body so we can fingerprint SPA fallbacks
        # that return HTTP 200 for every unknown path.
        spa_fallback_hash = None
        try:
            probe_url = f"{base_url}/vanguard-nonexistent-probe-{id(self)}"
            probe = await client.get(probe_url, follow_redirects=True)
            if probe.status_code == 200:
                spa_fallback_hash = hash(probe.text[:2000])
        except Exception:
            pass

        async def check_path(path, name, risk, description, required_sigs, negative_sigs):
            try:
                url = f"{base_url}/{path}"
                # Always follow redirects — a 301→404 is not a finding
                resp = await client.get(url, follow_redirects=True)

                if resp.status_code != 200:
                    return
                if len(resp.content) < 10:
                    return

                body = resp.text[:8000].lower()

                # Reject SPA fallback pages (site returns identical HTML for any path)
                if spa_fallback_hash is not None and hash(resp.text[:2000]) == spa_fallback_hash:
                    return

                # Negative signatures — if any present, this is a 404/error page
                if negative_sigs:
                    for neg in negative_sigs:
                        if neg.lower() in body:
                            return

                # Positive signatures — at least one MUST appear in the body,
                # unless the list is empty (accept any 200)
                if required_sigs:
                    matched = next((s for s in required_sigs if s.lower() in body), None)
                    if not matched:
                        return
                    evidence_marker = matched
                else:
                    evidence_marker = "resource present"

                findings.append(Finding(
                    name=name,
                    risk=risk,
                    confidence="High",
                    url=url,
                    evidence=f"HTTP 200 · {len(resp.content)} bytes · body signature matched: '{evidence_marker}'",
                    description=description,
                    solution=f"Restrict access to /{path} using server configuration. Return 404 for sensitive paths.",
                    cweid="538" if ("git" in path.lower() or "env" in path.lower() or "config" in path.lower()) else "200",
                    repro_command=f"curl -s -o /dev/null -w '%{{http_code}}' {url}",
                ))
            except Exception:
                pass

        tasks = [
            check_path(path, name, risk, desc, required, negative)
            for path, name, risk, desc, required, negative in SENSITIVE_PATHS
        ]
        await asyncio.gather(*tasks)

        return findings

    def _check_cache_headers(self, response, url) -> List[Finding]:
        findings = []
        cache_control = response.headers.get("Cache-Control", "")
        pragma = response.headers.get("Pragma", "")

        if not cache_control and not pragma:
            findings.append(Finding(
                name="No Cache-Control Header Set",
                risk="Informational",
                confidence="High",
                url=url,
                param="Cache-Control",
                evidence="Neither 'Cache-Control' nor 'Pragma' present in response headers.",
                description="No Cache-Control header is set. Sensitive pages may be cached by browsers or proxies, potentially exposing data to unauthorized users on shared computers.",
                solution="For sensitive pages: Cache-Control: no-store, no-cache, must-revalidate. For static assets: Cache-Control: public, max-age=31536000.",
                cweid="525",
                repro_command=f"curl -sI {url} | grep -i cache-control",
            ))

        return findings


http_scanner = HttpScanner()
