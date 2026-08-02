"""Deep application scanner — JS asset analysis, endpoint discovery, and
active authentication / access-control testing.

This complements the header-level HttpScanner. For modern SPAs the real
attack surface lives in the JavaScript bundle (routes, API endpoints,
hardcoded secrets) and behind the login (authorization logic). This module:

  1. Downloads and parses JS bundles referenced by the page.
  2. Flags hardcoded / predictable credentials and leaked API keys.
  3. Discovers the API base URL and every endpoint the app calls.
  4. Actively tests authentication: predictable-credential login, missing
     authentication, broken access control (privilege escalation), and
     mass-assignment role escalation via registration.

All active tests are bounded, wrapped in try/except, and only emit a finding
when backed by a real observed response. A failure here never breaks the base
scan — it simply returns whatever findings were gathered.
"""

import re
import ipaddress
import socket
from urllib.parse import urlparse, urljoin
from typing import List, Tuple, Optional, Dict

# Reuse the Finding shape from the header scanner so everything maps to the
# same Vulnerability records downstream.
from services.http_scanner import Finding


# ── Secret / credential signatures ──────────────────────────────────────────
# High-signal API-key / token formats. Kept deliberately strict to avoid noise.
SECRET_PATTERNS = [
    ("Groq API Key", r"gsk_[A-Za-z0-9]{40,}"),
    ("OpenAI / Stripe Secret Key", r"sk-(?:live_|proj_)?[A-Za-z0-9]{20,}"),
    ("AWS Access Key ID", r"AKIA[0-9A-Z]{16}"),
    ("Google API Key", r"AIza[0-9A-Za-z_\-]{35}"),
    ("GitHub Token", r"gh[pousr]_[A-Za-z0-9]{36,}"),
    ("Slack Token", r"xox[baprs]-[A-Za-z0-9-]{10,}"),
    ("Private Key Block", r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    ("Stripe Live Publishable Key", r"pk_live_[A-Za-z0-9]{20,}"),
]

# Common login / register endpoint shapes, in priority order.
LOGIN_HINTS = ["/auth/login", "/login", "/signin", "/session", "/token"]
REGISTER_HINTS = ["/auth/register", "/register", "/signup", "/users"]

# Path segments that denote elevated privilege for access-control testing.
PRIVILEGED_SEGMENTS = ("admin", "administrator", "manage", "internal", "root")

MAX_JS_BUNDLES = 8
MAX_JS_BYTES = 3_000_000
MAX_ENDPOINTS_TESTED = 18


def _host_is_public(host: str) -> bool:
    """Only test hosts that resolve to public IPs (SSRF guard for discovered APIs)."""
    if not host:
        return False
    try:
        for info in socket.getaddrinfo(host, None):
            addr = ipaddress.ip_address(info[4][0])
            if addr.is_private or addr.is_loopback or addr.is_link_local:
                return False
    except Exception:
        # If it doesn't resolve we simply won't be able to reach it anyway.
        return True
    return True


async def _fetch_js(client, target_url: str, main_response) -> Tuple[List[str], str]:
    """Download every JS bundle referenced by the page; return (urls, combined_text)."""
    try:
        html = main_response.text
    except Exception:
        return [], ""

    srcs = re.findall(r'<script[^>]+src=["\']([^"\']+\.js[^"\']*)["\']', html, re.I)
    js_urls, combined, total = [], [], 0
    for src in srcs[:MAX_JS_BUNDLES]:
        full = urljoin(target_url, src)
        try:
            r = await client.get(full)
            ctype = r.headers.get("content-type", "").lower()
            if r.status_code == 200 and ("javascript" in ctype or full.endswith(".js")):
                text = r.text[:MAX_JS_BYTES]
                combined.append(text)
                js_urls.append(full)
                total += len(text)
                if total > MAX_JS_BYTES * 2:
                    break
        except Exception:
            continue
    return js_urls, "\n".join(combined)


def _discover_endpoints(js_text: str, target_url: str) -> Tuple[Optional[str], List[Tuple[str, str]]]:
    """Parse the JS for the API base URL and (method, path) endpoint pairs."""
    api_base = None
    # Absolute API base referenced directly in the bundle.
    m = re.search(r'https?://[A-Za-z0-9.\-]+(?::\d+)?/api\b', js_text)
    if m:
        api_base = m.group(0)

    endpoints: List[Tuple[str, str]] = []
    seen = set()
    # axios/fetch-style calls: <ident>.get("/path"), .post(`/path`), etc.
    for meth, path in re.findall(
        r'\.(get|post|put|patch|delete)\(\s*[`"\']([^`"\']+)[`"\']', js_text, re.I
    ):
        path = path.strip()
        if not path.startswith("/") or path.startswith("//"):
            continue
        key = (meth.upper(), path)
        if key not in seen:
            seen.add(key)
            endpoints.append(key)

    if api_base is None and endpoints:
        # Fall back to the scanned origin if no absolute base was found.
        p = urlparse(target_url)
        api_base = f"{p.scheme}://{p.netloc}/api"
    return api_base, endpoints


def _scan_secrets(js_text: str, js_urls: List[str]) -> List[Finding]:
    """Flag hardcoded credentials, predictable password schemes, and leaked keys."""
    findings: List[Finding] = []
    src = js_urls[0] if js_urls else "client JavaScript bundle"

    # 1. Leaked API keys / tokens.
    for label, pattern in SECRET_PATTERNS:
        m = re.search(pattern, js_text)
        if m:
            sample = m.group(0)
            masked = sample[:6] + "…" + sample[-4:] if len(sample) > 12 else sample
            findings.append(Finding(
                name=f"Exposed Secret in Client Bundle ({label})",
                risk="High",
                confidence="High",
                url=src,
                param=label,
                evidence=f"Matched {label} pattern in JS: {masked}",
                description=(
                    f"A {label} is hardcoded in the client-side JavaScript, which is fully "
                    "readable by anyone. Secrets shipped to the browser are effectively public "
                    "and can be extracted and abused."
                ),
                solution=(
                    "Never ship secrets to the client. Move the key server-side, proxy the "
                    "call through your backend, and rotate the exposed key immediately."
                ),
                cweid="798",
                repro_command=f"curl -s {src} | grep -oE '{pattern}'",
            ))

    # 2. Predictable password scheme (e.g. email.split("@")[0] + "123").
    scheme = re.search(r'split\(\s*["\']@["\']\s*\)\s*\[\s*0\s*\]\s*\+\s*["\']([^"\']+)["\']', js_text)
    emails = sorted(set(re.findall(r'[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}', js_text)))
    # Ignore obvious placeholder addresses.
    emails = [e for e in emails if not e.lower().startswith(("name@", "email@", "user@", "example@"))]
    if scheme and emails:
        suffix = scheme.group(1)
        sample = emails[0].split("@")[0] + suffix
        findings.append(Finding(
            name="Predictable Credentials Derived in Client Code",
            risk="Critical",
            confidence="High",
            url=src,
            param="password scheme",
            evidence=(
                f"Client derives passwords as local-part + '{suffix}'. "
                f"Accounts exposed: {', '.join(emails[:6])}. Example: {emails[0]} / {sample}"
            ),
            description=(
                "The login flow builds each account's password from its email address using a "
                "fixed, client-visible scheme. Combined with the account list in the bundle, "
                "anyone can compute working credentials for every role, including administrators."
            ),
            solution=(
                "Remove all demo/seed credentials and password-derivation logic from the client. "
                "Force strong, unique, server-set passwords and rotate every affected account."
            ),
            cweid="259",
            repro_command=f"curl -s {src} | grep -oE 'split\\(\"@\"\\)\\[0\\]\\+\"[^\"]+\"'",
        ))

    # 3. Demo-account arrays: email + password sitting next to each other.
    for mm in re.finditer(
        r'(?:email|username)["\']?\s*[:=]\s*["\']([^"\']+)["\'][^}]{0,60}?password["\']?\s*[:=]\s*["\']([^"\']{3,})["\']',
        js_text, re.I,
    ):
        email, pwd = mm.group(1), mm.group(2)
        findings.append(Finding(
            name="Hardcoded Credentials in Client Bundle",
            risk="Critical",
            confidence="High",
            url=src,
            param=email,
            evidence=f"Hardcoded pair in JS: {email} / {pwd[:2]}{'*' * max(0, len(pwd) - 2)}",
            description=(
                "A working username/password pair is hardcoded in the client-side JavaScript. "
                "Any visitor can read it from the bundle and authenticate."
            ),
            solution="Remove hardcoded credentials from the client and rotate the account.",
            cweid="798",
            repro_command=f"curl -s {src} | grep -i '{email}'",
        ))

    return findings


def _derive_credentials(js_text: str) -> List[Dict[str, str]]:
    """Build candidate {email, password, expect_role} logins from the bundle."""
    creds: List[Dict[str, str]] = []
    scheme = re.search(r'split\(\s*["\']@["\']\s*\)\s*\[\s*0\s*\]\s*\+\s*["\']([^"\']+)["\']', js_text)
    suffix = scheme.group(1) if scheme else None
    emails = sorted(set(re.findall(r'[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}', js_text)))
    emails = [e for e in emails if not e.lower().startswith(("name@", "email@", "user@", "example@"))]
    for e in emails[:6]:
        if suffix:
            creds.append({"email": e, "password": e.split("@")[0] + suffix})
    # Explicit hardcoded pairs.
    for mm in re.finditer(
        r'(?:email|username)["\']?\s*[:=]\s*["\']([^"\']+)["\'][^}]{0,60}?password["\']?\s*[:=]\s*["\']([^"\']{3,})["\']',
        js_text, re.I,
    ):
        creds.append({"email": mm.group(1), "password": mm.group(2)})
    # De-dupe.
    uniq, out = set(), []
    for c in creds:
        k = (c["email"], c["password"])
        if k not in uniq:
            uniq.add(k)
            out.append(c)
    return out


def _extract_token(data) -> Optional[str]:
    """Pull a bearer token out of a login response body."""
    if not isinstance(data, dict):
        return None
    for k in ("token", "access_token", "accessToken", "jwt", "idToken", "id_token"):
        if isinstance(data.get(k), str) and data[k]:
            return data[k]
    for nest in ("data", "result", "user"):
        if isinstance(data.get(nest), dict):
            t = _extract_token(data[nest])
            if t:
                return t
    return None


async def _test_auth(client, api_base: str, endpoints: List[Tuple[str, str]],
                     js_text: str) -> List[Finding]:
    """Active authentication and access-control testing against the discovered API."""
    findings: List[Finding] = []
    if not api_base:
        return findings

    host = urlparse(api_base).hostname
    if not _host_is_public(host):
        return findings

    base = api_base.rstrip("/")
    paths = {p for _, p in endpoints}

    def full(path: str) -> str:
        return base + path if path.startswith("/") else f"{base}/{path}"

    # Endpoints with no path parameters, safe to probe directly.
    static_gets = [p for m, p in endpoints if m == "GET" and "${" not in p and "{" not in p and ":" not in p]
    priv_gets = [p for p in static_gets if any(seg in p.lower() for seg in PRIVILEGED_SEGMENTS)]

    # ── 1. Predictable-credential login ──
    login_path = next((h for h in LOGIN_HINTS if h in paths), None)
    if not login_path:
        login_path = next((p for _, p in endpoints if "login" in p.lower()), None)

    token = None
    role = None
    used_email = None
    if login_path:
        for cred in _derive_credentials(js_text):
            try:
                r = await client.post(full(login_path), json=cred)
            except Exception:
                continue
            if r.status_code == 200:
                try:
                    body = r.json()
                except Exception:
                    body = {}
                tok = _extract_token(body)
                if tok:
                    if token is None:
                        token, role, used_email = tok, body.get("role"), cred["email"]
                    findings.append(Finding(
                        name="Weak / Predictable Login Credentials Accepted",
                        risk="Critical",
                        confidence="High",
                        url=full(login_path),
                        method="POST",
                        param=cred["email"],
                        evidence=f"Login succeeded for {cred['email']} (role: {body.get('role', 'n/a')}) with a client-derivable password.",
                        description=(
                            "The API accepts credentials that are fully derivable from the public "
                            "client bundle, granting real authenticated sessions — including "
                            "privileged roles — to anyone."
                        ),
                        solution="Remove seed credentials, enforce strong unique passwords, add rate limiting and MFA for privileged accounts.",
                        cweid="1391",
                        repro_command=(
                            f"curl -s -X POST {full(login_path)} -H 'Content-Type: application/json' "
                            f"-d '{{\"email\":\"{cred['email']}\",\"password\":\"{cred['password']}\"}}'"
                        ),
                    ))

    # ── 2. Missing authentication on data endpoints ──
    # Only endpoints whose path implies private/user-scoped data are candidates —
    # many endpoints (public content, catalogs, config, health) are intentionally
    # unauthenticated, so flagging every public 200 would be a false positive.
    sensitive = ("user", "account", "profile", "/me", "admin", "order", "payment",
                 "invoice", "billing", "private", "dashboard", "setting", "credential",
                 "token", "secret", "patient", "medical", "record", "ssn", "customer")
    tested = 0
    for p in static_gets:
        if tested >= MAX_ENDPOINTS_TESTED:
            break
        if not any(h in p.lower() for h in sensitive):
            continue
        tested += 1
        try:
            r = await client.get(full(p))
        except Exception:
            continue
        # 200 with a body and no auth on a sensitive path = missing authentication.
        if r.status_code == 200 and len(r.content) > 2:
            ctype = r.headers.get("content-type", "").lower()
            if "json" in ctype or (r.text.strip().startswith(("{", "["))):
                findings.append(Finding(
                    name="Missing Authentication on Sensitive Endpoint",
                    risk="High",
                    confidence="Medium",
                    url=full(p),
                    method="GET",
                    evidence=f"GET {p} returned HTTP 200 with data and NO authentication token (path implies private data).",
                    description=(
                        "This endpoint's path implies user-scoped or privileged data, yet it returned "
                        "data without any authentication token. Verify the response does not expose "
                        "private data to anonymous callers."
                    ),
                    solution="Require and verify an authentication token on every non-public endpoint; default to deny.",
                    cweid="306",
                    repro_command=f"curl -s -o /dev/null -w '%{{http_code}}' {full(p)}",
                ))

    # ── 3. Broken access control (privilege escalation with a low-priv token) ──
    low_priv_token = token if (role and "admin" not in str(role).lower()) else None
    if low_priv_token and priv_gets:
        for p in priv_gets[:6]:
            try:
                r = await client.get(full(p), headers={"Authorization": f"Bearer {low_priv_token}"})
            except Exception:
                continue
            if r.status_code == 200 and len(r.content) > 2:
                findings.append(Finding(
                    name="Broken Access Control (Horizontal/Vertical Privilege Escalation)",
                    risk="Critical",
                    confidence="High",
                    url=full(p),
                    method="GET",
                    param=f"role={role}",
                    evidence=f"Non-admin token (role {role}, {used_email}) read privileged endpoint {p} — HTTP 200.",
                    description=(
                        "A lower-privilege authenticated user can access an administrative endpoint. "
                        "Role checks are missing or not enforced server-side."
                    ),
                    solution="Enforce server-side role/authorization checks on every privileged endpoint.",
                    cweid="285",
                    repro_command=f"curl -s -H 'Authorization: Bearer <low-priv-token>' {full(p)}",
                ))

    # ── 4. Mass-assignment privilege escalation via registration ──
    register_path = next((h for h in REGISTER_HINTS if h in paths), None)
    if not register_path:
        register_path = next((p for _, p in endpoints if "register" in p.lower() or "signup" in p.lower()), None)
    if register_path and priv_gets:
        import time
        probe_email = f"vanguard-probe-{int(time.time())}@vanguardscan.test"
        for role_field in ("role",):
            for role_val in ("ROLE_ADMIN", "admin", "ADMIN"):
                payload = {
                    "email": probe_email,
                    "password": "Probe!Pass123",
                    "fullName": "Vanguard Probe",
                    "name": "Vanguard Probe",
                    role_field: role_val,
                }
                try:
                    rr = await client.post(full(register_path), json=payload)
                except Exception:
                    continue
                if rr.status_code not in (200, 201):
                    continue
                try:
                    ptok = _extract_token(rr.json())
                except Exception:
                    ptok = None
                if not ptok:
                    continue
                # Verify the injected role was actually honored.
                verify_path = priv_gets[0]
                try:
                    vr = await client.get(full(verify_path), headers={"Authorization": f"Bearer {ptok}"})
                except Exception:
                    vr = None
                if vr is not None and vr.status_code == 200:
                    findings.append(Finding(
                        name="Privilege Escalation via Mass Assignment on Registration",
                        risk="Critical",
                        confidence="High",
                        url=full(register_path),
                        method="POST",
                        param=role_field,
                        evidence=(
                            f"Registered {probe_email} with '{role_field}: {role_val}'. The new account "
                            f"read admin endpoint {verify_path} (HTTP 200) — the client-supplied role was honored."
                        ),
                        description=(
                            "The registration endpoint trusts a client-supplied role field, so any "
                            "anonymous user can self-register as an administrator (mass assignment). "
                            f"NOTE: a probe account '{probe_email}' was created during this test and should be deleted."
                        ),
                        solution=(
                            "Never accept privilege/role fields from client input. Assign roles server-side, "
                            "whitelist registration fields, and audit existing accounts for rogue admins."
                        ),
                        cweid="915",
                        repro_command=(
                            f"curl -s -X POST {full(register_path)} -H 'Content-Type: application/json' "
                            f"-d '{{\"email\":\"x@x.com\",\"password\":\"P!123456\",\"{role_field}\":\"{role_val}\"}}'"
                        ),
                    ))
                    return findings  # one confirmed proof is enough; stop probing
    return findings


async def run_deep_scan(client, target_url: str, main_response) -> List[Finding]:
    """Entry point: discovery + secret analysis + active auth testing."""
    findings: List[Finding] = []
    try:
        js_urls, js_text = await _fetch_js(client, target_url, main_response)
        if not js_text:
            return findings
        findings.extend(_scan_secrets(js_text, js_urls))
        api_base, endpoints = _discover_endpoints(js_text, target_url)
        if endpoints:
            findings.extend(await _test_auth(client, api_base, endpoints, js_text))
    except Exception as e:
        print(f"[!] Deep scan step failed (non-fatal): {e}")
    return findings
