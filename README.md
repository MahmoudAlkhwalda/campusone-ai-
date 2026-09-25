<div align="center">

<img src="artifacts/campusone-ai/public/brand/campusone-lockup.png" alt="CampusOne" height="56" />

# CampusOne

**Your Financial Digital Twin for University Life**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-24-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![Express](https://img.shields.io/badge/Express-5-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Drizzle_ORM-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://orm.drizzle.team/)

*Ahli Fintech Hackathon / Jo FinTech Festival 2026 · Track 1: Smarter Campuses with AI · Team NEXORA*

</div>

---

## The Problem

Students know how much money they have today — but they often cannot see whether it will last through the semester.

Tuition timing, monthly living expenses, income, and academic decisions all affect the same semester budget. Students typically evaluate each separately, in isolation, and without a forward-looking view. By the time financial pressure appears, it's already difficult to act.

## The Solution

CampusOne is a **Financial Digital Twin for university life**. It takes a student's academic context, tuition payment schedule, income, and living expenses, and produces a month-by-month semester cash-flow forecast — before financial pressure becomes a problem.

The core idea: let students *see* the financial impact of their decisions before they make them.

> "The Financial Twin calculates. Ask CampusOne AI explains."

---

## Screenshots

<table>
<tr>
<td><img src="screenshots/campusone-home-final.jpg" alt="CampusOne landing page" /></td>
<td><img src="screenshots/campusone-setup.jpg" alt="Financial Twin setup" /></td>
</tr>
<tr>
<td align="center"><em>Landing page</em></td>
<td align="center"><em>Financial Twin setup</em></td>
</tr>
</table>

---

## Core Journey

```
 01 Predict      → Semester cash-flow forecast from academic + financial inputs
 02 Simulate     → What-if scenarios with FutureMe
 03 Optimize     → Deterministic plan optimization with Fix My Semester
 04 Access Support → Relevant scholarships, aid, and paid opportunities
 05 Recalculate  → Updated Financial Twin after applying a plan or opportunity
```

---

## Key Features

### Financial Twin (Overview)
Month-by-month semester cash-flow projection. Shows projected ending balance, lowest projected balance, first risk month, financial health indicator, and major forecast drivers — all from deterministic arithmetic applied to the student's actual inputs.

### FutureMe
Side-by-side what-if comparison. Students adjust credit hours, monthly income, living expenses, and tuition assumptions. The same Financial Twin engine recalculates in real time so the student can see the financial impact of a decision before committing.

### Fix My Semester
Deterministic plan optimizer. Evaluates a bounded grid of candidate profiles (living-cost adjustments up to 20%, income additions up to 300 JOD/month, one-month tuition rescheduling, modeled support up to 15% of out-of-pocket tuition, 3-credit reduction only for severe gaps). Ranks candidates by stability first, then gap reduction, then smallest intervention magnitude. Returns the best recommendation plus alternatives, each with an intervention-level explanation.

### Access Support (Opportunity Matcher)
Matches the student's Financial Twin state against a catalog of scholarships, aid programs, internships, and paid opportunities. Matching is rule-based: filters by active status, application window, major keywords, and minimum duration. Impact is calculated transparently from published amounts. **Match scores are not official eligibility determinations.**

### Ask CampusOne (AI Copilot)
An LLM-powered contextual assistant grounded in the student's current Financial Twin state. Accepts an OpenAI or Groq API key (`OPENAI_API_KEY`). If the key is absent or the call fails, the copilot falls back to a deterministic, structured explanation built from the saved Financial Twin data — so the journey continues even without an LLM key.

### University Dashboard
Aggregated, privacy-conscious institutional view showing cohort-level financial wellness signals, pressure timeline, and support demand indicators. **All institutional metrics shown are synthetic demo data.** No individual student details are exposed.

### Company Portal
Allows companies to publish internships and paid opportunities that enter the shared opportunity catalog and become available in Access Support for student simulation.

---

## How AI Is Used

CampusOne makes a deliberate distinction between its deterministic and AI-powered components:

| Component | Implementation |
|---|---|
| Financial Twin Engine | Deterministic arithmetic — month-by-month balance calculation |
| FutureMe | Calls the same deterministic simulation engine with adjusted inputs |
| Fix My Semester | Deterministic bounded grid search + scoring rules (no ML) |
| Opportunity Matcher | Rule-based filtering and transparent scoring (no ML) |
| **Ask CampusOne** | **LLM (OpenAI / Groq) — the only AI layer** |

The Financial Twin engine is the numerical source of truth. Ask CampusOne reads the structured output of that engine and explains it in natural language, guiding the student toward FutureMe, Fix My Semester, or Access Support where appropriate.

Financial Health Score and Opportunity Match Score are computed from explicit formulas, not machine learning models. They are transparent, deterministic, and explainable.

---

## Architecture

```mermaid
graph TD
    A[Student inputs<br/>Academic + Financial] --> B[Financial Twin Engine<br/>simulateSemester]
    B --> C[Projected Semester State<br/>Monthly balances, risk month, health score]
    C --> D[FutureMe<br/>What-if re-simulation]
    C --> E[Fix My Semester<br/>Bounded optimization]
    C --> F[Access Support<br/>Rule-based opportunity matching]
    D --> G[Updated Financial Twin]
    E --> G
    F --> G
    C --> H[Ask CampusOne AI Copilot<br/>LLM — OpenAI / Groq]
    H --> I[Contextual explanation<br/>and guidance]
```

```mermaid
graph LR
    Students --> CampusOne
    CampusOne --> UniversityDashboard[University Dashboard<br/>Aggregated demo insights]
    CampusOne --> CompanyPortal[Company Portal<br/>Opportunity publishing]
    CompanyPortal --> OpportunityMatcher[Access Support<br/>Student opportunity matching]
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 24, TypeScript 5.9 |
| Frontend | React 19, Vite 7, Tailwind CSS v4, Wouter (routing) |
| UI Components | Radix UI primitives, Lucide React icons, Recharts, Framer Motion |
| API | Express 5, OpenAPI 3.1 spec (Orval codegen) |
| Database | PostgreSQL + Drizzle ORM (`drizzle-zod` for schema validation) |
| Validation | Zod v4 |
| Auth | scrypt password hashing, session tokens (SHA-256 hashed), HTTP-only cookies |
| AI Copilot | OpenAI Chat Completions API (also compatible with Groq) |
| Monorepo | pnpm workspaces |
| Build | esbuild (API server), Vite (frontend) |

---

## Project Structure

```
campusone-ai/
├── artifacts/
│   ├── api-server/          # Express 5 API server
│   │   └── src/
│   │       ├── lib/
│   │       │   ├── simulation.ts     # Financial Twin engine (single source of truth)
│   │       │   ├── optimizer.ts      # Fix My Semester — deterministic optimizer
│   │       │   └── opportunities.ts  # Opportunity matching logic
│   │       └── routes/
│   │           ├── simulation.ts     # POST /api/simulate, /api/optimize
│   │           ├── opportunities.ts  # POST /api/opportunities/match, /company
│   │           ├── copilot.ts        # POST /api/copilot (LLM layer)
│   │           ├── auth.ts           # Sign-up, log-in, session, profile
│   │           └── health.ts         # GET /api/healthz
│   └── campusone-ai/        # React frontend
│       ├── src/
│       │   ├── App.tsx              # All pages and routes
│       │   ├── opportunities.ts     # Demo opportunity catalog
│       │   ├── index.css            # Main design system
│       │   ├── futureme.css         # FutureMe styles
│       │   └── journey.css          # Journey/optimization styles
│       ├── public/brand/            # Logos and app icon
│       └── tests/e2e/               # Playwright end-to-end tests
├── lib/
│   ├── api-spec/            # OpenAPI 3.1 source (openapi.yaml)
│   ├── api-client-react/    # Generated React Query hooks (from Orval)
│   ├── api-zod/             # Generated Zod schemas (from Orval)
│   └── db/                  # Drizzle ORM schema and connection
│       └── src/schema/
│           ├── opportunities.ts     # Opportunities table
│           └── campusone-auth.ts    # Users, sessions, profiles tables
├── screenshots/             # Product screenshots
├── .env.example             # Environment variable template
├── pnpm-workspace.yaml      # Workspace configuration
└── package.json             # Root workspace scripts
```

---

## Getting Started

### Prerequisites

- [Node.js 24+](https://nodejs.org/)
- [pnpm 12+](https://pnpm.io/) — install with `npm install -g pnpm`
- [PostgreSQL 14+](https://www.postgresql.org/) — running locally or a hosted instance

### Clone

```bash
git clone https://github.com/<your-username>/campusone-ai.git
cd campusone-ai
```

### Install Dependencies

```bash
pnpm install
```

> On first install, pnpm may prompt you to approve build scripts. Run `pnpm approve-builds --all` if required, then re-run `pnpm install`.

### Environment Configuration

```bash
cp .env.example .env
```

Edit `.env` and set at minimum:

```env
DATABASE_URL=postgres://postgres:your_password@localhost:5432/campusone
```

The `OPENAI_API_KEY` is optional. Without it, Ask CampusOne falls back to a deterministic explanation — all other features work fully.

### Database Setup

Create the database and push the schema:

```bash
# Create the database (if it doesn't exist)
createdb campusone

# Push Drizzle schema to the database
pnpm --filter @workspace/db run push
```

### Run — Development

Start both servers in separate terminals:

```bash
# Terminal 1 — API server (port 5000)
pnpm --filter @workspace/api-server run dev

# Terminal 2 — Frontend dev server (port 3000, proxies /api to port 5000)
pnpm --filter @workspace/campusone-ai run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Build — Production

```bash
# Type-check all packages
pnpm run typecheck

# Build API server (esbuild → dist/)
pnpm --filter @workspace/api-server run build

# Build frontend (Vite → dist/public/)
pnpm --filter @workspace/campusone-ai run build
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `OPENAI_API_KEY` | No | OpenAI API key (`sk-...`) or Groq key (`gsk_...`) for the AI Copilot |
| `PORT` | No | API server port (default: `5000`) |
| `NODE_ENV` | No | `development` or `production` (affects cookie security and log formatting) |

See [`.env.example`](.env.example) for the full template.

---

## Demo

The landing page offers **Ahmad's Demo** — a pre-filled student profile for a Computer Science student with:

- 15 credit hours at 50 JOD/credit
- 1,050 JOD starting balance
- 100 JOD/month income
- Split tuition payments (300 JOD in Month 1, 450 JOD in Month 3)

This demo profile runs through the real Financial Twin engine with no mocking. All values are synthetic.

The **Demo Opportunities** catalog (8 entries) and the **University Dashboard** metrics are entirely synthetic demo data, clearly labelled as such in the UI. They are not connected to real providers, real institutions, or real students.

---

## Privacy and Responsible Design

- **No automated financial-aid decisions.** CampusOne does not make eligibility decisions for scholarships, aid, or loans.
- **Financial Health is not a credit score.** It is a transparent, explainable indicator derived from the semester forecast.
- **Opportunity Match Score is not official eligibility.** Matches are based on publicly available program attributes and the student's plan inputs only.
- **University Dashboard uses synthetic demo data.** No real student data is displayed.
- **Financial calculations are deterministic and explainable.** Every number shown can be traced back to the inputs and formulas in `simulation.ts`.
- **Ask CampusOne AI Copilot is grounded.** The LLM receives only structured Financial Twin context — it is instructed not to invent balances, eligibility, or outcomes.

---

## Hackathon

**Ahli Fintech Hackathon / Jo FinTech Festival 2026**  
Track 1 — Smarter Campuses with AI  
Team: **NEXORA**

---

## Future Development

The following are potential directions for future development — they are not features of the current project.

- Real university integrations with consent-based data sharing
- Verified opportunity providers with official eligibility checking
- Consent-based FinTech integrations (open banking, tuition payment APIs)
- Enhanced recommendation intelligence using historical cohort patterns
- Longitudinal financial insights across multiple semesters

---

## License

This project does not currently have an open-source license.

> **Before choosing a license, consider what rights you want to grant.** Common options:
> - **MIT** — permissive, anyone can use, modify, and distribute with attribution (very common for open-source projects)
> - **Apache 2.0** — like MIT but with explicit patent grant
> - **GPL v3** — copyleft, derivatives must also be open source
> - **No license** — all rights reserved by default; others cannot legally use or distribute the code
>
> Please tell me which license you'd like, and I will add it.
