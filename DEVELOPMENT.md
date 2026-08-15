# Development Setup - Hot Reload Guide

## Option 1: Run Frontend Locally (FASTEST - Recommended)

This gives you **instant hot reload** for both frontend and backend changes.

### Setup

**Terminal 1 - Start Backend + Database in Docker:**
```bash
cd /home/harsh/Desktop/manthan/digonce
docker compose up db backend
```

Wait for the backend to be ready (you'll see `Application startup complete`).

**Terminal 2 - Run Frontend Locally:**
```bash
cd /home/harsh/Desktop/manthan/digonce/frontend
npm install  # Only needed first time
npm run dev
```

Frontend will start on **http://localhost:5173** with hot reload! 🚀

### How It Works
- **Frontend changes** → Instant reload (hot module replacement)
- **Backend changes** → Automatic reload (uvicorn --reload flag)
- **Database** → Runs in Docker

### Test the Changes
1. Edit any file in `frontend/src/`
2. Save
3. See changes instantly in browser (no restart needed!)

---

## Option 2: Docker Development Mode (With Hot Reload)

If you prefer everything in Docker but with hot reload:

```bash
cd /home/harsh/Desktop/manthan/digonce
docker compose -f docker-compose.dev.yml up --build
```

Access:
- **Frontend**: http://localhost:5173 (with hot reload)
- **Backend**: http://localhost:8001 (with auto-reload)

### How It Works
- Uses `Dockerfile.dev` for frontend (runs `npm run dev`)
- Mounts source code as volumes for live updates
- Frontend changes show instantly
- Backend changes auto-reload via uvicorn

---

## Option 3: Full Local Setup (No Docker)

For maximum speed without Docker:

**Terminal 1 - Start Database:**
```bash
# Make sure you have PostgreSQL installed locally
# Or skip this and update DATABASE_URL in backend/.env to use system PostgreSQL
```

**Terminal 2 - Start Backend:**
```bash
cd /home/harsh/Desktop/manthan/digonce/backend
source venv/bin/activate
cp .env.example .env
uvicorn app.main:app --reload
```

Backend runs on **http://localhost:8001**

**Terminal 3 - Start Frontend:**
```bash
cd /home/harsh/Desktop/manthan/digonce/frontend
npm run dev
```

Frontend runs on **http://localhost:5173**

Both have auto-reload and changes appear instantly!

---

## Quick Comparison

| Setup | Speed | Setup Time | Frontend Reload | Backend Reload |
|-------|-------|-----------|-----------------|----------------|
| **Option 1** (Recommended) | ⚡ Fastest | 2 min | Hot (instant) | Auto (1-2s) |
| **Option 2** | ⚡ Fast | 3 min | Hot (instant) | Auto (1-2s) |
| **Option 3** | ⚡ Fastest | 5 min | Hot (instant) | Auto (1-2s) |

---

## What Files to Edit

### Frontend Changes (Instant reload)
```
frontend/src/
├── pages/
│   ├── LoginPage.tsx
│   ├── MapPage.tsx
│   └── DashboardPage.tsx
├── components/
│   ├── ProtectedRoute.tsx
│   └── DashboardOverview.tsx
├── context/
│   └── AuthContext.tsx
├── App.tsx
└── App.css
```

### Backend Changes (Auto-reload with uvicorn)
```
backend/app/
├── main.py        ← Edit this for API endpoints
├── models/        ← Add database models here
└── routes/        ← Add route handlers here
```

---

## Common Development Commands

### Stop all services
```bash
Ctrl+C in each terminal
```

### Clean and restart
```bash
docker compose down -v
docker compose up db backend
# In another terminal:
npm run dev
```

### View backend logs
If running via Docker:
```bash
docker compose logs -f backend
```

### View frontend logs
Check the terminal where you ran `npm run dev`

---

## Tips for Efficient Development

1. **Use browser DevTools** - Open http://localhost:5173 and press F12
2. **Check console errors** - React errors show in browser console
3. **Use VS Code extension** - Install "ES7+ React/Redux" for better snippets
4. **Watch your edits** - Files save automatically and reload instantly
5. **Test API calls** - Use browser Network tab or Postman to test `/api/auth/login`

---

## Recommended Development Workflow

1. Start with **Option 1** (Frontend local + Backend Docker)
2. Open browser to http://localhost:5173
3. Keep VS Code open in the editor
4. Make changes and watch them reload instantly
5. Open DevTools (F12) to see any errors
6. When adding backend endpoints, restart won't be needed with `--reload`

That's it! Start editing and see changes in real-time! 🚀
