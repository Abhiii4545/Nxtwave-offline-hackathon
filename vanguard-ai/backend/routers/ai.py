"""AI-powered analysis API endpoints."""

import json
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import List, Optional

from database import get_session
from models import Vulnerability, Scan, ChatMessage
from services.ai_service import ai_service

router = APIRouter(prefix="/api/ai", tags=["ai"])


class ChatRequest(BaseModel):
    messages: List[dict]
    scan_id: Optional[int] = None


@router.post("/explain/{vuln_id}")
async def explain_vulnerability(
    vuln_id: int,
    session: Session = Depends(get_session),
):
    """Generate an AI explanation for a vulnerability.
    
    Caches the result — never regenerates to save API costs.
    """
    vuln = session.get(Vulnerability, vuln_id)
    if not vuln:
        raise HTTPException(status_code=404, detail="Vulnerability not found")

    # Return cached explanation if available
    if vuln.ai_explanation:
        try:
            return json.loads(vuln.ai_explanation)
        except json.JSONDecodeError:
            return {"plain_english": vuln.ai_explanation}

    # Generate new explanation
    explanation = await ai_service.explain_vulnerability(vuln)

    # Cache in database
    vuln.ai_explanation = json.dumps(explanation)
    vuln.business_impact = explanation.get("business_impact", "")
    session.add(vuln)
    session.commit()

    return explanation


@router.post("/fix/{vuln_id}")
async def generate_fix(
    vuln_id: int,
    language: str = Query("python"),
    session: Session = Depends(get_session),
):
    """Generate a code fix for a vulnerability in the specified language.
    
    Caches results per language.
    """
    vuln = session.get(Vulnerability, vuln_id)
    if not vuln:
        raise HTTPException(status_code=404, detail="Vulnerability not found")

    # Check cache by language
    cache_map = {
        "python": "ai_fix_python",
        "javascript": "ai_fix_javascript",
        "java": "ai_fix_java",
    }
    cache_field = cache_map.get(language, "ai_fix_python")
    cached = getattr(vuln, cache_field, None)

    if cached:
        return {"language": language, "code": cached}

    # Generate new fix
    code_fix = await ai_service.generate_code_fix(vuln, language)

    # Cache in database
    setattr(vuln, cache_field, code_fix)
    session.add(vuln)
    session.commit()

    return {"language": language, "code": code_fix}


@router.get("/attack-path/{scan_id}")
async def get_attack_path(
    scan_id: int,
    session: Session = Depends(get_session),
):
    """Generate an AI attack path analysis for all vulnerabilities in a scan."""
    scan = session.get(Scan, scan_id)
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")

    vulns = session.exec(
        select(Vulnerability)
        .where(Vulnerability.scan_id == scan_id)
        .where(Vulnerability.is_resolved == False)
    ).all()

    if not vulns:
        return {
            "chain": [],
            "overall_risk": "LOW",
            "summary": "No unresolved vulnerabilities found.",
        }

    attack_path = await ai_service.generate_attack_path(list(vulns))
    return attack_path


@router.post("/chat")
async def chat(
    request: ChatRequest,
    session: Session = Depends(get_session),
):
    """Multi-turn AI security chat with optional scan context."""
    scan_context = None

    if request.scan_id:
        scan = session.get(Scan, request.scan_id)
        if scan:
            # Get top vulnerability names for context
            vulns = session.exec(
                select(Vulnerability)
                .where(Vulnerability.scan_id == scan.id)
                .where(Vulnerability.risk.in_(["Critical", "High"]))
            ).all()

            scan_context = {
                "target": scan.target_url,
                "security_score": scan.security_score,
                "total_vulns": scan.total_vulns,
                "critical": scan.critical_count,
                "high": scan.high_count,
                "medium": scan.medium_count,
                "low": scan.low_count,
                "top_vulns": [v.name for v in vulns[:5]],
            }

    # Get AI response
    response = await ai_service.chat(request.messages, scan_context)

    # Save messages to database
    if request.messages:
        last_user_msg = request.messages[-1]
        user_msg = ChatMessage(
            scan_id=request.scan_id,
            role="user",
            content=last_user_msg.get("content", ""),
        )
        session.add(user_msg)

    assistant_msg = ChatMessage(
        scan_id=request.scan_id,
        role="assistant",
        content=response,
    )
    session.add(assistant_msg)
    session.commit()

    return {"response": response}
