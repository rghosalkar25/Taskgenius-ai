# TaskGenius AI — Smart NLP-Based To-Do List & Productivity Assistant

## Backend setup

```bash
cd backend
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
python -m spacy download en_core_web_sm
uvicorn main:app --reload --port 8000
```

API docs (Swagger UI): http://localhost:8000/docs

Key endpoints:
- `POST /api/tasks/parse` — run the NLP pipeline only, no DB write (used for live preview)
- `POST /api/tasks/` — parse + save a new task from raw text
- `GET /api/tasks/?filter=today|upcoming|high_priority|completed`
- `PATCH /api/tasks/{id}` — update / mark complete
- `DELETE /api/tasks/{id}`
- `GET /api/analytics/summary` — completion %, category & priority distribution

## Frontend setup

```bash
cd frontend
npm create vite@latest . -- --template react
npm install
npm install framer-motion recharts lucide-react
# Tailwind:
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

Set `VITE_API_BASE_URL=http://localhost:8000` in a `.env` file if your backend
runs somewhere other than the default.

Drop `SmartInputBar.jsx` into `src/components/` and wire it into your
`Dashboard.jsx` page, e.g.:

```jsx
import SmartInputBar from "../components/SmartInputBar";

function Dashboard() {
  const handleCreateTask = async (text) => {
    await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/tasks/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    // refresh task list here
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <SmartInputBar onCreateTask={handleCreateTask} />
    </div>
  );
}
```

## Notes

- All backend `.py` files have been syntax-checked (`py_compile`) and are
  ready to run once dependencies are installed — the sandbox this project
  was generated in has no network access, so `dateparser`/`spacy` could not
  be installed to run a live end-to-end test here. Test locally after
  `pip install -r requirements.txt`.
- `TaskList.jsx` and `Analytics.jsx` (front-end) weren't in the required
  deliverables list — ask if you'd like those built out next.
