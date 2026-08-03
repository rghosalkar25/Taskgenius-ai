# TaskGenius AI — Smart NLP-Based To-Do List & Productivity Assistant

TaskGenius AI turns plain-English input into structured tasks. Type
*"Team standup every Monday at 9am #work urgent"* and it's parsed into a
due date, time, priority, category, tag, and recurring schedule — no forms,
no dropdowns, live preview as you type.

**Live demo:** [taskgenius-ai.vercel.app](https://taskgenius-ai.vercel.app)
**API docs:** [taskgenius-ai.onrender.com/docs](https://taskgenius-ai.onrender.com/docs)

> Note: the backend runs on Render's free tier, which spins down after
> inactivity. The first request after a while may take 30–60s to wake up.

---

## Features

- **NLP-powered task entry** — custom regex-based pipeline extracts due
  date/time, priority, category, `#tags`, and recurrence from free text,
  with a live preview as you type (see [How the NLP engine works](#how-the-nlp-engine-works))
- **User accounts** — JWT authentication, all data scoped per user
- **Subtasks** — expandable checklists nested under any task
- **Recurring tasks** — completing a recurring task auto-generates the next occurrence (daily/weekly/monthly)
- **Custom reminders** — browser notifications with configurable offsets (at due time, 5/15/30 min, 1 hour, 1 day before)
- **Focus Timer** — start/stop timer inside the task detail view; logs real time spent per task
- **Task detail editor** — full editor per task: notes, tags, reminders, repeat rules, subtasks
- **Analytics dashboard** — completion streaks, overdue count, 7-day completion trend, category/priority breakdowns, time invested, top tags

## Tech stack

| Layer | Tech |
|---|---|
| Backend | FastAPI, SQLAlchemy, SQLite, JWT (python-jose), bcrypt |
| Frontend | React + Vite, Tailwind CSS, Framer Motion, Recharts, lucide-react |
| NLP | Hand-written regex + rule-based classification (no external NLP library or LLM at inference time) |
| Deployment | Render (backend), Vercel (frontend) |

---

## Backend setup

```bash
cd backend
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

API docs (Swagger UI): http://localhost:8000/docs

### Environment variables (optional for local dev, required for deployment)

| Variable | Purpose | Default |
|---|---|---|
| `TASKGENIUS_SECRET_KEY` | Signs JWTs — set a real value in production | dev fallback string |
| `FRONTEND_URL` | Extra allowed CORS origin(s), comma-separated | `http://localhost:5173` only |
| `PYTHON_VERSION` | Pins Python version on Render (3.14 lacks prebuilt `pydantic-core` wheels) | `3.11.9` |

### Key endpoints

**Auth**
- `POST /api/auth/register` — create account, returns JWT
- `POST /api/auth/login` — OAuth2 password flow (form fields: `username`=email, `password`), returns JWT
- `GET /api/auth/me` — current user info

**Tasks** *(all require `Authorization: Bearer <token>`)*
- `POST /api/tasks/parse` — run the NLP pipeline only, no DB write (live preview)
- `POST /api/tasks/` — parse + save a new task from raw text (`parent_id` optional, for subtasks)
- `GET /api/tasks/?filter=today|upcoming|high_priority|completed`
- `GET /api/tasks/{id}`
- `PATCH /api/tasks/{id}` — update any field: title, notes, due date/time, reminder offset, priority, category, tags, recurrence, completion
- `DELETE /api/tasks/{id}`
- `POST /api/tasks/{id}/log-time` — increments the Focus Timer total server-side (`{"seconds": N}`)

**Analytics**
- `GET /api/analytics/summary` — completion %, streak, overdue count, category/priority distribution, 7-day trend, top tags, total time invested

---

## Frontend setup

```bash
cd frontend
npm install
npm run dev
```

Set `VITE_API_BASE_URL` in a `.env` file if your backend runs somewhere
other than `http://localhost:8000`:
```
VITE_API_BASE_URL=http://localhost:8000
```

---

## How the NLP engine works

`backend/app/services/nlp_engine.py` is a fully deterministic, rule-based
pipeline — no ML model, no external NLP library, no LLM call at inference
time. It runs in this order on every input:

1. **Tag extraction** — regex `#(\w+)` pulls out hashtags, de-duplicated, stripped from the working text
2. **Recurrence detection** — matches `daily`/`every day`, `weekly`/`every week`, `monthly`/`every month`
3. **Temporal parsing** — hand-written regex + manual date arithmetic (not `dateparser.search_dates`, which proved unreliable for phrases like "next Monday" during testing):
   - Weekday resolution handles `this/next/on/every <weekday>`, each with different date-math rules
   - `every <weekday>` also flags weekly recurrence
   - Relative dates (`today`, `tomorrow`, `tonight`) and 12-hour time parsing (`10am`, `noon`, etc.)
4. **Priority classification** — keyword lookup (`urgent`/`asap`/`critical` → high, etc.), defaults to low
5. **Category classification** — keyword lookup across 6 buckets (study/work/personal/health/finance/general), defaults to general
6. **Title extraction** — strips dates, filler words, and dangling punctuation from what's left, capitalizes the result

Every parse returns a structured object (title, due date/time, priority,
category, tags, recurrence) consumed by both the live-preview endpoint and
actual task creation.

---

## Deployment
Currently deployed as two separate services:
- **Backend → Render**: root directory `backend`, build `pip install -r requirements.txt`, start `uvicorn main:app --host 0.0.0.0 --port $PORT`
- **Frontend → Vercel**: root directory `frontend`, Vite preset auto-detected

Both auto-deploy from the `main` branch on push.

---

## Project structure
```
taskgenius-ai/
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   ├── runtime.txt
│   └── app/
│       ├── database.py
│       ├── models/        # User, Task (SQLAlchemy)
│       ├── schemas/       # Pydantic request/response models
│       ├── core/          # security.py (JWT, password hashing)
│       ├── api/
│       │   ├── dependencies.py   # get_current_user
│       │   └── endpoints/        # auth.py, tasks.py, analytics.py
│       └── services/
│           └── nlp_engine.py
└── frontend/
    └── src/
        ├── App.jsx
        ├── lib/api.js             # authenticated fetch wrapper
        ├── context/AuthContext.jsx
        ├── hooks/useReminders.js
        ├── pages/                 # Login, Register, Dashboard
        └── components/            # SmartInputBar, TaskList, Analytics, TaskDetailModal
```

---

## Author
Riddhi Ghosalkar ([@rghosalkar25](https://github.com/rghosalkar25))
