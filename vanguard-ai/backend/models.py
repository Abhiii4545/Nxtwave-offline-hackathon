"""SQLModel data models for Vanguard AI."""

from datetime import datetime
from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship


class Scan(SQLModel, table=True):
    """Represents a security scan run against a target."""
    id: Optional[int] = Field(default=None, primary_key=True)
    target_url: str
    status: str = "pending"  # pending, running, completed, failed
    progress: int = 0  # 0-100
    started_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    security_score: Optional[float] = None
    total_vulns: int = 0
    critical_count: int = 0
    high_count: int = 0
    medium_count: int = 0
    low_count: int = 0
    info_count: int = 0
    ai_suggestions: Optional[str] = None  # JSON string of AI security suggestions

    vulnerabilities: List["Vulnerability"] = Relationship(back_populates="scan")


class Vulnerability(SQLModel, table=True):
    """Represents a single vulnerability found during a scan."""
    id: Optional[int] = Field(default=None, primary_key=True)
    scan_id: int = Field(foreign_key="scan.id")
    name: str
    risk: str  # Critical, High, Medium, Low, Informational
    confidence: str = "Medium"
    url: str
    method: str = "GET"
    param: Optional[str] = None
    attack: Optional[str] = None
    evidence: Optional[str] = None
    description: Optional[str] = None
    solution: Optional[str] = None
    reference: Optional[str] = None
    cweid: Optional[str] = None
    wascid: Optional[str] = None
    ai_explanation: Optional[str] = None  # Claude's explanation (JSON string)
    ai_fix_python: Optional[str] = None  # Claude's Python fix
    ai_fix_javascript: Optional[str] = None  # Claude's JavaScript fix
    ai_fix_java: Optional[str] = None  # Claude's Java fix
    business_impact: Optional[str] = None  # Claude's business impact
    is_resolved: bool = False
    # Proof / verification — every finding ships with reproducible evidence
    verified: bool = False  # True when we captured direct, reproducible proof
    repro_command: Optional[str] = None  # A runnable command to reproduce the finding

    scan: Optional[Scan] = Relationship(back_populates="vulnerabilities")


class ChatMessage(SQLModel, table=True):
    """Stores chat conversation messages with the AI assistant."""
    id: Optional[int] = Field(default=None, primary_key=True)
    scan_id: Optional[int] = None
    role: str  # user or assistant
    content: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
