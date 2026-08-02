"""AI service using Groq API (Llama 3.3 70B) for security analysis."""

import os
import json
from groq import Groq
from typing import List, Optional
from models import Vulnerability, Scan


SYSTEM_PROMPT = """You are Vanguard AI, an expert autonomous security engineer.
You have deep expertise in OWASP Top 10, web application security,
penetration testing, and secure software development.
Be technical but clear. Focus on practical, actionable information.
Always explain business impact. Be concise but complete.
When generating code, use proper formatting with comments."""


class AIService:
    """Groq-powered security analysis service using Llama 3.3 70B."""

    def __init__(self):
        self._client = None
        self.model = "meta-llama/llama-4-scout-17b-16e-instruct"
        self._last_chat_error = None

    @property
    def client(self):
        if self._client is None:
            api_key = os.getenv("GROQ_API_KEY", "")
            if api_key and not api_key.startswith("your-"):
                self._client = Groq(api_key=api_key)
        return self._client

    def _is_available(self) -> bool:
        """Check if Groq API is configured."""
        return self.client is not None

    def _chat_completion(self, system: str, user_prompt: str, max_tokens: int = 1500) -> str:
        """Make a chat completion request to Groq."""
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=max_tokens,
            temperature=0.3,
        )
        if not response.choices:
            raise ValueError("Empty response from AI service")
        content = response.choices[0].message.content
        return (content or "").strip()

    async def explain_vulnerability(self, vuln: Vulnerability) -> dict:
        """Generate a comprehensive AI explanation of a vulnerability.

        Returns dict with: plain_english, technical_detail, attack_scenario,
        business_impact, severity_justification
        """
        if not self._is_available():
            return self._mock_explanation(vuln)

        prompt = f"""Analyze this web application vulnerability and provide a detailed explanation.

Vulnerability: {vuln.name}
Risk Level: {vuln.risk}
URL: {vuln.url}
Parameter: {vuln.param or 'N/A'}
Evidence: {vuln.evidence or 'N/A'}
CWE ID: {vuln.cweid or 'N/A'}
Description: {vuln.description or 'N/A'}

Respond in this exact JSON format:
{{
    "plain_english": "2-3 sentence explanation for non-technical stakeholders",
    "technical_detail": "Technical explanation for developers with specific details",
    "attack_scenario": "Step-by-step attack scenario showing how an attacker would exploit this",
    "business_impact": "What happens to the business if this is exploited - data loss, compliance, reputation",
    "severity_justification": "Why this risk level is appropriate for this vulnerability"
}}

Return ONLY valid JSON, no markdown formatting."""

        try:
            response_text = self._chat_completion(SYSTEM_PROMPT, prompt)
            # Handle potential markdown wrapping
            if response_text.startswith("```"):
                response_text = response_text.split("```")[1]
                if response_text.startswith("json"):
                    response_text = response_text[4:]
                response_text = response_text.strip()
            return json.loads(response_text)
        except Exception as e:
            print(f"AI explanation error: {e}")
            return self._mock_explanation(vuln)

    async def generate_code_fix(self, vuln: Vulnerability, language: str = "python") -> str:
        """Generate secure code fix for a vulnerability.

        Returns formatted code string with vulnerable and secure versions.
        """
        if not self._is_available():
            return self._mock_code_fix(vuln, language)

        prompt = f"""Generate a code fix for this vulnerability in {language}.

Vulnerability: {vuln.name}
CWE ID: {vuln.cweid or 'N/A'}
Description: {vuln.description or 'N/A'}
Parameter: {vuln.param or 'N/A'}

Provide the response in this exact format (plain text, not JSON):

=== VULNERABLE CODE ===
// Code that demonstrates the vulnerability
[vulnerable code here with comments explaining what's wrong]

=== SECURE CODE ===
// Fixed code with security best practices
[secure code here with comments explaining each security improvement]

=== EXPLANATION ===
Brief explanation of what was changed and why.

Use {language} syntax. Make the code realistic and practical, not just pseudocode."""

        try:
            return self._chat_completion(SYSTEM_PROMPT, prompt, max_tokens=2000)
        except Exception as e:
            print(f"AI code fix error: {e}")
            return self._mock_code_fix(vuln, language)

    async def generate_attack_path(self, vulnerabilities: List[Vulnerability]) -> dict:
        """Analyze vulnerabilities and generate an attack chain visualization.

        Returns dict with chain steps, overall risk, and summary.
        """
        if not self._is_available():
            return self._mock_attack_path(vulnerabilities)

        vuln_list = "\n".join([
            f"- {v.name} ({v.risk}): {v.description[:100] if v.description else 'N/A'}"
            for v in vulnerabilities[:10]
        ])

        prompt = f"""Analyze these vulnerabilities and generate a realistic attack chain showing how an attacker could chain them together for maximum impact.

Vulnerabilities found:
{vuln_list}

Respond in this exact JSON format:
{{
    "entry_point": "One sentence: where/how the attacker gains their first foothold",
    "final_impact": "One sentence: the worst-case outcome if the full chain succeeds",
    "chain": [
        {{"step": 1, "vuln": "Vulnerability Name", "phase": "Reconnaissance", "action": "What the attacker does in this step", "technique": "The specific technique or tool used", "consequence": "What they gain from this step", "severity": "Low", "mitigation": "The single most effective control that breaks the chain here", "icon": "search"}},
        {{"step": 2, "vuln": "Next Vulnerability", "phase": "Exploitation", "action": "Next action", "technique": "Specific method", "consequence": "What they gain", "severity": "High", "mitigation": "How to stop it here", "icon": "key"}}
    ],
    "overall_risk": "CRITICAL or HIGH or MEDIUM or LOW",
    "summary": "2-3 sentence summary of the complete attack path and its business impact"
}}

Rules:
- "phase" must be one of: Reconnaissance, Initial Access, Exploitation, Privilege Escalation, Lateral Movement, Impact.
- "severity" must be one of: Low, Medium, High, Critical — reflecting the danger of THIS step.
- "technique" is concrete (e.g. "MIME-sniffing a text response into executable script", "session cookie theft via injected JavaScript").
- "mitigation" is the one control that would break the chain at this step.
- Use these icon names: search, key, database, shield, server, user, lock, alert, code, globe
- Generate 4-6 steps showing realistic vulnerability chaining that only uses the vulnerabilities listed above.
- Return ONLY valid JSON."""

        try:
            response_text = self._chat_completion(SYSTEM_PROMPT, prompt)
            if response_text.startswith("```"):
                response_text = response_text.split("```")[1]
                if response_text.startswith("json"):
                    response_text = response_text[4:]
                response_text = response_text.strip()
            return json.loads(response_text)
        except Exception as e:
            print(f"AI attack path error: {e}")
            return self._mock_attack_path(vulnerabilities)

    async def chat(self, messages: List[dict], scan_context: Optional[dict] = None) -> str:
        """Multi-turn security Q&A chat with optional scan context."""
        if not self._is_available():
            return self._mock_chat_response(messages[-1]["content"] if messages else "")

        system = SYSTEM_PROMPT
        if scan_context:
            system += f"""

Current Scan Context:
- Target: {scan_context.get('target', 'N/A')}
- Security Score: {scan_context.get('security_score', 'N/A')}/100
- Total Vulnerabilities: {scan_context.get('total_vulns', 0)}
- Critical: {scan_context.get('critical', 0)}, High: {scan_context.get('high', 0)}, Medium: {scan_context.get('medium', 0)}, Low: {scan_context.get('low', 0)}
- Top Findings: {', '.join(scan_context.get('top_vulns', []))}

Use this context to provide specific, actionable security guidance."""

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "system", "content": system}] + messages,
                max_tokens=2000,
                temperature=0.4,
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            print(f"AI chat error: {e}")
            self._last_chat_error = f"{type(e).__name__}: {str(e)[:400]}"
            return self._mock_chat_response(messages[-1]["content"] if messages else "")

    async def generate_executive_summary(self, scan: Scan, top_vulns: List[Vulnerability]) -> str:
        """Generate an executive summary for the PDF report."""
        if not self._is_available():
            return self._mock_executive_summary(scan)

        vuln_list = "\n".join([f"- {v.name} ({v.risk})" for v in top_vulns[:10]])

        prompt = f"""Write a 3-4 paragraph executive summary for a security assessment report.

Target: {scan.target_url}
Security Score: {scan.security_score}/100
Total Vulnerabilities: {scan.total_vulns}
Critical: {scan.critical_count}, High: {scan.high_count}, Medium: {scan.medium_count}, Low: {scan.low_count}

Key Findings:
{vuln_list}

Write in professional, non-technical language suitable for C-level executives.
Focus on business risk, compliance implications, and recommended priorities.
Do not use markdown formatting."""

        try:
            return self._chat_completion(SYSTEM_PROMPT, prompt, max_tokens=1000)
        except Exception as e:
            return self._mock_executive_summary(scan)

    async def generate_security_suggestions(self, scan: Scan, vulnerabilities: List[Vulnerability]) -> dict:
        """Generate prioritized, actionable security suggestions after a scan.

        Returns dict with: suggestions (list of actionable items), summary, overall_priority
        """
        if not self._is_available():
            return self._mock_security_suggestions(scan, vulnerabilities)

        vuln_summary = "\n".join([
            f"- {v.name} ({v.risk}): {v.url} | CWE-{v.cweid or 'N/A'} | {(v.description or 'No description')[:120]}"
            for v in vulnerabilities[:20]
        ])

        prompt = f"""Analyze the results of a security scan and generate actionable security improvement suggestions.

Target: {scan.target_url}
Security Score: {scan.security_score}/100
Total Vulnerabilities: {scan.total_vulns}
Critical: {scan.critical_count}, High: {scan.high_count}, Medium: {scan.medium_count}, Low: {scan.low_count}, Info: {scan.info_count}

Vulnerabilities Found:
{vuln_summary}

Generate 6-10 specific, actionable security suggestions to improve the website's security posture. Each suggestion should be a concrete change the developer can implement.

Respond in this exact JSON format:
{{
    "suggestions": [
        {{
            "title": "Short descriptive title of the change",
            "priority": "Critical" or "High" or "Medium" or "Low",
            "category": "Headers" or "Authentication" or "Input Validation" or "Encryption" or "Configuration" or "Dependencies" or "Access Control" or "Monitoring",
            "description": "Clear explanation of what needs to change and why",
            "implementation_steps": ["Step 1: ...", "Step 2: ...", "Step 3: ..."],
            "estimated_effort": "Quick Fix (< 1 hour)" or "Small Task (1-4 hours)" or "Medium Task (1-2 days)" or "Large Task (3-5 days)"
        }}
    ],
    "summary": "2-3 sentence overview of the security posture and top priorities",
    "overall_priority": "CRITICAL" or "HIGH" or "MEDIUM" or "LOW"
}}

Order suggestions by priority (Critical first). Be specific to the vulnerabilities found — don't give generic advice.
Return ONLY valid JSON, no markdown formatting."""

        try:
            response_text = self._chat_completion(SYSTEM_PROMPT, prompt, max_tokens=3000)
            if response_text.startswith("```"):
                response_text = response_text.split("```")[1]
                if response_text.startswith("json"):
                    response_text = response_text[4:]
                response_text = response_text.strip()
            return json.loads(response_text)
        except Exception as e:
            print(f"AI suggestions error: {e}")
            return self._mock_security_suggestions(scan, vulnerabilities)

    # ── Mock responses for when Groq API is not configured ──

    def _mock_explanation(self, vuln: Vulnerability) -> dict:
        return {
            "plain_english": f"{vuln.name} is a security flaw that could allow attackers to compromise your application. This vulnerability was found at {vuln.url} and could lead to unauthorized access or data theft.",
            "technical_detail": f"The {vuln.name} vulnerability (CWE-{vuln.cweid}) exists because the application fails to properly validate or sanitize input at the '{vuln.param}' parameter. {vuln.description}",
            "attack_scenario": f"1. Attacker identifies the vulnerable endpoint at {vuln.url}\n2. Attacker crafts malicious input targeting the '{vuln.param}' parameter\n3. The application processes the malicious input without proper validation\n4. Attacker gains unauthorized access to sensitive data or functionality",
            "business_impact": f"If exploited, this {vuln.risk}-severity vulnerability could lead to data breaches, regulatory fines (GDPR, PCI-DSS), reputation damage, and potential lawsuits. Immediate remediation is recommended.",
            "severity_justification": f"This vulnerability is rated {vuln.risk} because it {('can be exploited remotely with minimal skill' if vuln.risk in ['Critical', 'High'] else 'requires specific conditions to exploit but still poses significant risk')}."
        }

    def _mock_code_fix(self, vuln: Vulnerability, language: str) -> str:
        fixes = {
            "SQL Injection": {
                "python": """=== VULNERABLE CODE ===
# DANGEROUS: Direct string concatenation in SQL query
def search_products(query):
    sql = f"SELECT * FROM products WHERE name LIKE '%{query}%'"
    cursor.execute(sql)  # SQL Injection vulnerability!
    return cursor.fetchall()

=== SECURE CODE ===
# SECURE: Using parameterized queries
def search_products(query):
    sql = "SELECT * FROM products WHERE name LIKE ?"
    cursor.execute(sql, (f"%{query}%",))  # Parameter binding prevents injection
    return cursor.fetchall()

=== EXPLANATION ===
The vulnerable code concatenates user input directly into the SQL query string, allowing attackers to inject arbitrary SQL. The fix uses parameterized queries where user input is passed as a separate parameter, ensuring it's treated as data, not executable SQL.""",
                "javascript": """=== VULNERABLE CODE ===
// DANGEROUS: String concatenation in SQL query
app.get('/search', (req, res) => {
    const query = req.query.q;
    const sql = `SELECT * FROM products WHERE name LIKE '%${query}%'`;
    db.query(sql, (err, results) => {  // SQL Injection!
        res.json(results);
    });
});

=== SECURE CODE ===
// SECURE: Using parameterized queries
app.get('/search', (req, res) => {
    const query = req.query.q;
    const sql = 'SELECT * FROM products WHERE name LIKE ?';
    db.query(sql, [`%${query}%`], (err, results) => {  // Safe parameterized query
        res.json(results);
    });
});

=== EXPLANATION ===
The fix replaces string interpolation with parameterized queries, preventing SQL injection by separating code from data."""
            },
            "Cross Site Scripting (Reflected)": {
                "python": """=== VULNERABLE CODE ===
# DANGEROUS: Reflecting user input without encoding
@app.route('/search')
def search():
    query = request.args.get('q', '')
    return f'<h1>Results for: {query}</h1>'  # XSS vulnerability!

=== SECURE CODE ===
# SECURE: Using proper output encoding
from markupsafe import escape

@app.route('/search')
def search():
    query = request.args.get('q', '')
    return f'<h1>Results for: {escape(query)}</h1>'  # HTML encoded output

=== EXPLANATION ===
The vulnerable code reflects user input directly into HTML without encoding. The fix uses markupsafe.escape() to encode special characters, preventing script injection.""",
                "javascript": """=== VULNERABLE CODE ===
// DANGEROUS: innerHTML with unsanitized user input
const query = new URLSearchParams(window.location.search).get('q');
document.getElementById('results').innerHTML = `Results for: ${query}`;  // XSS!

=== SECURE CODE ===
// SECURE: Using textContent instead of innerHTML
const query = new URLSearchParams(window.location.search).get('q');
document.getElementById('results').textContent = `Results for: ${query}`;  // Safe

=== EXPLANATION ===
Using textContent instead of innerHTML ensures user input is treated as text, not executable HTML/JavaScript."""
            }
        }

        default_fix = f"""=== VULNERABLE CODE ===
# Example vulnerable code for {vuln.name}
# This code does not properly validate or sanitize input
def vulnerable_function(user_input):
    # Direct use of user input without validation
    process(user_input)  # {vuln.name} vulnerability

=== SECURE CODE ===
# Fixed code with proper security controls
def secure_function(user_input):
    # Validate and sanitize input
    validated = validate_input(user_input)
    if not validated:
        raise ValueError("Invalid input")
    # Use sanitized input safely
    process(sanitized_input)

=== EXPLANATION ===
The fix adds input validation and sanitization to prevent {vuln.name}. {vuln.solution}"""

        if vuln.name in fixes and language in fixes[vuln.name]:
            return fixes[vuln.name][language]
        return default_fix

    def _mock_attack_path(self, vulnerabilities: List[Vulnerability]) -> dict:
        """Deterministic fallback chain built from the ACTUAL findings.

        Used only when the AI service is unavailable. Rather than inventing
        unrelated vulnerabilities, it orders the real ones into a plausible
        kill chain so the output still reflects the scan.
        """
        # Map finding keywords → a chain role, so the fallback stays realistic.
        phase_order = [
            "Reconnaissance", "Initial Access", "Exploitation",
            "Privilege Escalation", "Lateral Movement", "Impact",
        ]
        icon_by_kw = [
            (("server", "disclosure", "info"), "search", "Reconnaissance"),
            (("cookie", "httponly", "samesite", "secure"), "key", "Initial Access"),
            (("csp", "content security", "x-content", "xss", "script"), "code", "Exploitation"),
            (("hsts", "http", "tls", "ssl", "redirect"), "globe", "Lateral Movement"),
            (("admin", "auth", "jwt", "access control"), "shield", "Privilege Escalation"),
        ]

        risk_rank = {"Critical": 0, "High": 1, "Medium": 2, "Low": 3, "Informational": 4}
        ordered = sorted(vulnerabilities, key=lambda v: risk_rank.get(v.risk, 5))[:6]

        chain = []
        for i, v in enumerate(ordered, 1):
            name_l = (v.name or "").lower()
            icon, phase = "alert", phase_order[min(i - 1, len(phase_order) - 1)]
            for kws, ic, ph in icon_by_kw:
                if any(k in name_l for k in kws):
                    icon, phase = ic, ph
                    break
            chain.append({
                "step": i,
                "vuln": v.name,
                "phase": phase,
                "action": f"Attacker leverages '{v.name}' as observed in the scan.",
                "technique": (v.description or "Exploits the weakness described in the finding.")[:120],
                "consequence": v.business_impact or "Advances the attacker one step closer to full compromise.",
                "severity": v.risk if v.risk in risk_rank else "Medium",
                "mitigation": (v.solution or "Apply the recommended remediation for this finding.")[:140],
                "icon": icon,
            })

        top = ordered[0].name if ordered else "an exposed weakness"
        return {
            "entry_point": f"The attacker begins with {top.lower()}, harvested directly from the target's live responses.",
            "final_impact": "Chained together, these weaknesses erode the target's defense-in-depth and expand the blast radius of any single exploit.",
            "chain": chain,
            "overall_risk": ordered[0].risk.upper() if ordered else "LOW",
            "summary": "Each finding above is individually modest, but chaining reconnaissance, weak transport/cookie controls, and missing browser protections meaningfully raises the odds and impact of a successful attack.",
        }

    def _mock_chat_response(self, question: str) -> str:
        q_lower = question.lower()
        if "critical" in q_lower or "most" in q_lower:
            return """Based on the current scan results, the most critical vulnerabilities are:

1. **SQL Injection** (High Risk) - Found in the product search endpoint. This allows attackers to extract any data from the database, including user credentials and personal information.

2. **JWT Authentication Bypass** (High Risk) - The application accepts unsigned JWT tokens, allowing complete authentication bypass without needing valid credentials.

3. **Broken Admin Access Control** (High Risk) - Regular users can access admin API endpoints, escalating their privileges.

**Recommended Priority:** Fix SQL Injection first as it provides the broadest attack surface, then address the JWT bypass which enables account takeover."""

        if "chain" in q_lower or "attack" in q_lower:
            return """The vulnerabilities can be chained into a devastating attack path:

1. **Reconnaissance** → Server headers reveal Express.js stack
2. **SQL Injection** → Extract user table with email/password hashes
3. **JWT Bypass** → Forge admin token using 'none' algorithm
4. **Admin Access** → Full control of admin panel
5. **XSS Injection** → Plant persistent scripts to harvest other users' sessions

This chain demonstrates how seemingly minor information disclosure combined with critical injection flaws can lead to **complete system compromise** in minutes."""

        if "fix" in q_lower or "first" in q_lower:
            return """Here's my recommended remediation priority:

### Immediate (This Sprint)
1. **SQL Injection** - Switch to parameterized queries in all database calls
2. **JWT Authentication** - Enforce RS256 algorithm, reject 'none'
3. **Access Control** - Implement RBAC middleware on all admin endpoints

### Short-term (Next 2 Weeks)
4. **XSS Prevention** - Implement CSP headers and output encoding
5. **CSRF Protection** - Add synchronizer tokens to state-changing requests
6. **Secure Cookies** - Set HttpOnly, Secure, SameSite flags

### Medium-term (Next Month)
7. **Security Headers** - Deploy full security header suite
8. **Dependency Updates** - Update Angular and other outdated libraries
9. **Error Handling** - Implement generic error responses

This prioritization is based on **exploitability × business impact**."""

        return f"""That's a great security question. Based on the current scan data, here's my analysis:

The application at localhost:3000 (OWASP Juice Shop) has multiple security weaknesses that require attention. The security score of 31.5/100 indicates significant risk exposure.

Key areas of concern include injection vulnerabilities, broken authentication, and missing security headers. Each of these can be addressed through well-established security patterns and frameworks.

Would you like me to dive deeper into any specific vulnerability or provide detailed remediation steps for a particular finding?"""

    def _mock_executive_summary(self, scan: Scan) -> str:
        return f"""Security Assessment Executive Summary

A comprehensive security assessment was conducted against {scan.target_url} using automated vulnerability scanning and AI-powered analysis. The assessment identified {scan.total_vulns} security vulnerabilities across multiple risk categories, resulting in a security score of {scan.security_score}/100.

The assessment revealed {scan.high_count} high-severity vulnerabilities that require immediate attention, including SQL injection, authentication bypass, and broken access control issues. These findings indicate that the application is susceptible to data breaches and unauthorized access, which could result in regulatory penalties, reputation damage, and financial losses.

Additionally, {scan.medium_count} medium-severity issues were identified related to missing security headers, insecure data storage, and outdated dependencies. While these present lower immediate risk, they contribute to the overall attack surface and should be addressed in the near-term security roadmap.

We recommend prioritizing the remediation of high-severity findings within the current sprint cycle, followed by a systematic approach to addressing medium and low-severity issues. Implementing a continuous security testing pipeline would help prevent the introduction of new vulnerabilities in future releases."""

    def _mock_security_suggestions(self, scan: Scan, vulnerabilities: List[Vulnerability]) -> dict:
        """Generate realistic mock security suggestions based on scan results."""
        suggestions = []
        vuln_names = [v.name.lower() for v in vulnerabilities]

        # Build context-aware suggestions based on actual vulnerabilities found
        if any("sql" in n for n in vuln_names):
            suggestions.append({
                "title": "Implement Parameterized Queries Across All Database Operations",
                "priority": "Critical",
                "category": "Input Validation",
                "description": "SQL Injection vulnerabilities were detected. All database queries must use parameterized statements instead of string concatenation to prevent attackers from manipulating SQL commands.",
                "implementation_steps": [
                    "Audit all database query functions for string concatenation patterns",
                    "Replace raw SQL strings with parameterized queries using ? or :param placeholders",
                    "Implement an ORM layer (e.g., SQLAlchemy, Prisma) as an additional safety layer",
                    "Add input validation middleware to reject suspicious SQL characters"
                ],
                "estimated_effort": "Medium Task (1-2 days)"
            })

        if any("xss" in n or "cross site scripting" in n for n in vuln_names):
            suggestions.append({
                "title": "Deploy Content Security Policy (CSP) Headers",
                "priority": "Critical",
                "category": "Headers",
                "description": "Cross-Site Scripting vulnerabilities found. Implement strict CSP headers to prevent unauthorized script execution and mitigate XSS attacks even if input validation is bypassed.",
                "implementation_steps": [
                    "Add Content-Security-Policy header with strict default-src 'self' policy",
                    "Whitelist only trusted script sources with script-src directive",
                    "Enable CSP reporting with report-uri to monitor policy violations",
                    "Implement output encoding on all user-generated content rendered in HTML"
                ],
                "estimated_effort": "Small Task (1-4 hours)"
            })

        if any("jwt" in n or "auth" in n or "session" in n for n in vuln_names):
            suggestions.append({
                "title": "Strengthen Authentication & Token Security",
                "priority": "Critical",
                "category": "Authentication",
                "description": "Authentication bypass vulnerabilities detected. JWT implementation must enforce strong algorithms and proper token validation to prevent unauthorized access.",
                "implementation_steps": [
                    "Enforce RS256 or ES256 algorithm in JWT verification — reject 'none' algorithm",
                    "Set short token expiration (15 min access, 7 day refresh)",
                    "Implement token revocation/blocklist for logout and password changes",
                    "Add rate limiting on login endpoints (max 5 attempts per minute)"
                ],
                "estimated_effort": "Medium Task (1-2 days)"
            })

        if any("access" in n or "admin" in n or "privilege" in n for n in vuln_names):
            suggestions.append({
                "title": "Implement Role-Based Access Control (RBAC)",
                "priority": "High",
                "category": "Access Control",
                "description": "Broken access control vulnerabilities allow unauthorized users to access restricted endpoints. Implement proper RBAC middleware to enforce authorization checks.",
                "implementation_steps": [
                    "Define role hierarchy: admin, manager, user, guest",
                    "Create authorization middleware that validates user roles before every protected route",
                    "Implement server-side resource ownership checks — never trust client-side role claims",
                    "Add audit logging for all privilege escalation attempts"
                ],
                "estimated_effort": "Medium Task (1-2 days)"
            })

        # Always-relevant suggestions
        suggestions.append({
            "title": "Add Comprehensive Security Headers Suite",
            "priority": "High",
            "category": "Headers",
            "description": "Multiple missing security headers leave the application vulnerable to clickjacking, MIME sniffing, and protocol downgrade attacks. Deploy a complete security header suite.",
            "implementation_steps": [
                "Add Strict-Transport-Security: max-age=31536000; includeSubDomains for HSTS",
                "Add X-Content-Type-Options: nosniff to prevent MIME sniffing",
                "Add X-Frame-Options: DENY to prevent clickjacking",
                "Add Referrer-Policy: strict-origin-when-cross-origin",
                "Add Permissions-Policy to restrict browser feature access"
            ],
            "estimated_effort": "Quick Fix (< 1 hour)"
        })

        suggestions.append({
            "title": "Enable HTTPS Everywhere with HSTS Preloading",
            "priority": "High",
            "category": "Encryption",
            "description": "Ensure all communication is encrypted via TLS 1.3. Submit domain to HSTS preload list to prevent SSL stripping attacks.",
            "implementation_steps": [
                "Obtain and install a valid TLS certificate (Let's Encrypt recommended)",
                "Configure automatic HTTP → HTTPS redirect (301) on all routes",
                "Set HSTS header with preload directive",
                "Submit domain to hstspreload.org for browser-level enforcement"
            ],
            "estimated_effort": "Small Task (1-4 hours)"
        })

        suggestions.append({
            "title": "Implement API Rate Limiting and Request Throttling",
            "priority": "Medium",
            "category": "Configuration",
            "description": "Without rate limiting, the application is vulnerable to brute-force attacks, credential stuffing, and denial-of-service. Add intelligent rate limiting per endpoint.",
            "implementation_steps": [
                "Install rate limiting middleware (e.g., express-rate-limit, slowapi)",
                "Set global limit: 100 requests/minute per IP",
                "Set stricter limits on auth endpoints: 5 requests/minute",
                "Implement progressive delays for repeated failed login attempts",
                "Add CAPTCHA for suspicious traffic patterns"
            ],
            "estimated_effort": "Small Task (1-4 hours)"
        })

        suggestions.append({
            "title": "Set Up Security Monitoring and Alerting Pipeline",
            "priority": "Medium",
            "category": "Monitoring",
            "description": "No evidence of security monitoring was detected. Implement real-time alerting for security events to enable rapid incident response.",
            "implementation_steps": [
                "Integrate a SIEM solution (e.g., ELK Stack, Datadog Security)",
                "Configure alerts for: failed login spikes, SQL error patterns, unusual API patterns",
                "Set up automated weekly vulnerability re-scans",
                "Create incident response runbooks for top 5 vulnerability types"
            ],
            "estimated_effort": "Large Task (3-5 days)"
        })

        suggestions.append({
            "title": "Update Outdated Dependencies and Enable Automated Scanning",
            "priority": "Medium",
            "category": "Dependencies",
            "description": "Outdated libraries may contain known CVEs. Enable automated dependency scanning in your CI/CD pipeline to catch vulnerabilities early.",
            "implementation_steps": [
                "Run npm audit / pip audit and fix all critical and high findings",
                "Enable GitHub Dependabot or Snyk for automated dependency PRs",
                "Pin dependency versions and review changelogs before upgrading",
                "Add OWASP Dependency-Check to CI/CD pipeline"
            ],
            "estimated_effort": "Small Task (1-4 hours)"
        })

        # Determine overall priority
        has_critical = scan.critical_count > 0
        has_high = scan.high_count > 0
        overall = "CRITICAL" if has_critical else ("HIGH" if has_high else ("MEDIUM" if scan.medium_count > 0 else "LOW"))

        return {
            "suggestions": suggestions,
            "summary": f"The security assessment of {scan.target_url} identified {scan.total_vulns} vulnerabilities with a security score of {scan.security_score}/100. {'Immediate action is required on critical SQL injection and authentication bypass issues. ' if has_critical or has_high else ''}Implementing the {len(suggestions)} recommendations below would significantly improve the application's security posture and compliance readiness.",
            "overall_priority": overall
        }


# Singleton instance
ai_service = AIService()
