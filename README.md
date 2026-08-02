# 🛡️ Vanguard AI — Autonomous Security Engineer

AI-powered security scanning you can actually trust. Vanguard runs **real** HTTP security checks against any live target, ships every finding with reproducible proof, and pairs it with **AI analysis** (Groq · Llama 3.3 70B) — explanations, code fixes, and an interactive security assistant.

> Built for the NxtWave Hackathon.

**🔗 Live demo:** https://vanguard-frontend-ozau.onrender.com
**📦 Repository:** https://github.com/Abhiii4545/Nxtwave-offline-hackathon

---

## ✨ Features

### Real security scanning (no false-positive noise)
- **HTTP surface** — security headers (CSP, HSTS, X-Frame-Options, …), TLS/SSL version & certificate checks, cookie flags (HttpOnly/Secure/SameSite), CORS misconfigurations, sensitive-path exposure, information disclosure.
- **Deep application scan** — downloads and analyzes JavaScript bundles to discover the API surface, and flags **hardcoded/predictable credentials** and **leaked API keys** shipped to the browser.
- **Active auth & access-control testing** — predictable-credential login, missing authentication on sensitive endpoints, broken access control (privilege escalation), and mass-assignment role escalation via registration.
- **Unreachable-target detection** — a dead/404 URL is reported honestly instead of receiving a fake assessment.

### AI-powered analysis (Groq · Llama 3.3 70B)
- Plain-English + technical vulnerability explanations, with attack scenario and business impact.
- Secure **code-fix generation** in Python / JavaScript / Java.
- Interactive **AI security assistant** (chat) with scan context.
- Prioritized, actionable **remediation suggestions** per scan.

### Dashboard & reporting
- Unified **0–100 security score**, risk distribution, vulnerability trend, and compliance badges (OWASP Top 10, PCI DSS, ISO 27001, SOC 2).
- **Remediation diff** — compare a scan against the previous one of the same target to verify fixes.
- Exportable **PDF / JSON** reports.
- **Firebase authentication** (email/password + Google) gating the workspace.

---

## 🧱 Tech stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, Vite, Tailwind CSS, Framer Motion, Recharts, Zustand, React Query, Firebase Auth |
| **Backend** | FastAPI, SQLModel, SQLite, httpx, Groq SDK, ReportLab |
| **AI** | Groq API — Llama 3.3 70B |
| **Auth** | Firebase Authentication |
| **Deploy** | Render (backend + frontend via Blueprint), Vercel (alternate frontend) |

---

## 🏗️ Architecture

```
Browser ── React SPA (Firebase Auth gate)
   │  VITE_API_URL
   ▼
FastAPI backend ──► HttpScanner ──► live HTTP checks (headers, TLS, cookies, CORS, paths)
   │                     └────────► DeepScanner (JS analysis + active auth testing)
   ├──► Groq (Llama 3.3 70B) ──► explanations, fixes, chat, suggestions
   └──► SQLite (scans, vulnerabilities, chat messages)
```

---

## 📂 Project structure

```
.
├── render.yaml                 # Render Blueprint (provisions backend + frontend)
├── vanguard-ai/
│   ├── backend/                # FastAPI application
│   │   ├── main.py             # App entry, routes, dashboard stats, health
│   │   ├── database.py         # SQLModel engine/session
│   │   ├── models.py           # Scan, Vulnerability, ChatMessage
│   │   ├── seed_data.py        # Demo data + security-score calculation
│   │   ├── routers/            # scans, vulnerabilities, ai, reports
│   │   └── services/
│   │       ├── http_scanner.py # Header/TLS/cookie/CORS/path checks
│   │       ├── deep_scanner.py # JS analysis + active auth/access-control tests
│   │       └── ai_service.py   # Groq integration (+ mock fallback)
│   └── frontend/               # React + Vite SPA
│       └── src/
│           ├── pages/          # Dashboard, ScanPage, VulnList, VulnDetail, ChatPage, Reports, Login
│           ├── components/     # UI, charts, panels
│           ├── auth/           # Firebase AuthContext + ProtectedRoute
│           └── api/client.js   # Axios API client
```

---

## 🚀 Local development

### Prerequisites
- Python 3.11
- Node.js 18+
- A free [Groq API key](https://console.groq.com/keys) (optional — the app falls back to mock AI without one)

### Backend
```bash
cd vanguard-ai/backend
pip install -r requirements.txt

# optional — enables real AI (otherwise mock responses are used)
export GROQ_API_KEY=gsk_your_key_here     # Windows: set GROQ_API_KEY=...

uvicorn main:app --reload --port 8000
```
The API runs at `http://localhost:8000` (docs at `/docs`). Demo data is auto-seeded on first run.

### Frontend
```bash
cd vanguard-ai/frontend
npm install
npm run dev
```
The app runs at `http://localhost:5173` and proxies `/api` to `http://localhost:8000` in dev.

---

## 🔧 Environment variables

### Backend
| Variable | Purpose | Default |
|---|---|---|
| `GROQ_API_KEY` | Enables real Llama 3.3 70B AI. Without it, mock responses are used. | *(unset → mock)* |
| `CORS_ORIGINS` | Comma-separated allowed origins. | `*` |
| `DATABASE_URL` | SQLModel database URL. | `sqlite:///./vanguard.db` |
| `PORT` | Server port. | `8000` |

### Frontend (build-time, `VITE_` prefix)
| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Backend base URL (e.g. `https://vanguard-backend-4ibe.onrender.com`) |
| `VITE_FIREBASE_*` | Firebase config overrides (falls back to the bundled public web config) |

---

## ☁️ Deployment

The repo ships a **Render Blueprint** (`render.yaml`) that provisions both services in one step:

1. Push to GitHub.
2. In Render: **New + → Blueprint**, connect this repo, **Apply**.
3. Set `GROQ_API_KEY` on the **vanguard-backend** service (Environment tab) to enable real AI.

The frontend is also deployable to **Vercel** (set `VITE_API_URL`; `vercel.json` handles SPA routing and excludes `/api`).

---

## 🗄️ Where data is stored

| Data | Where | Notes |
|---|---|---|
| **User accounts** (email, password hashes, Google identities) | **Firebase Authentication** (project `nexus-vangaurdai`) | Managed by Google; view at Firebase Console → Authentication → Users. The backend never sees these. |
| **Scans, vulnerabilities, chat messages** | Backend **SQLite** (`vanguard.db`) | On Render's free tier the filesystem is **ephemeral** — this data resets on every redeploy/restart and is re-seeded with demo data. |

There is no link between Firebase users and backend records — the backend API is currently unauthenticated (demo scope).

---

## ⚠️ Responsible use

Vanguard performs **active** security tests (login attempts, endpoint probing, registration checks). Only scan targets **you own or are explicitly authorized to test**. Active testing of third-party systems without permission may be illegal.

---

## 📄 License

For educational / hackathon use.
