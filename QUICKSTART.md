# Quick Start Guide for Digonce

## ⚡ Fastest Development (HOT RELOAD - Recommended)

Get instant feedback on your changes without restarting anything!

### Prerequisites
- Docker installed
- Node.js 20+ installed

### Setup (2 commands)

**Terminal 1 - Start Backend + Database:**
```bash
cd /home/harsh/Desktop/manthan/digonce
docker compose up db backend
```

Wait for output: `Application startup complete`

**Terminal 2 - Start Frontend (same project folder):**
```bash
cd frontend
npm install  # First time only
npm run dev
```

### 🎉 That's it!
- Frontend: **http://localhost:5173** (changes reload instantly!)
- Backend: **http://localhost:8001** (auto-reloads on save)
- API Docs: **http://localhost:8001/docs**

**Just edit code and refresh browser - no restart needed!**

---

## 🚀 One-Command Setup (Linux/Mac)

```bash
cd /home/harsh/Desktop/manthan/digonce
chmod +x dev.sh
./dev.sh
```

This automatically starts DB + Backend, then Frontend with hot reload.

For Windows, use `dev.bat` instead.

---

## Other Setup Options

### Prerequisites
- Docker installed ([download here](https://www.docker.com/products/docker-desktop))
- Docker Compose (comes with Docker Desktop)

### Run Everything
```bash
cd digonce
docker compose up --build
```

Then open in your browser:
- **Frontend**: http://localhost:3001
- **Backend API**: http://localhost:8001
- **API Docs**: http://localhost:8001/docs

To stop:
```bash
docker compose down
```

---

## Option 2: Local Development (Manual Setup)

### Prerequisites
- Node.js 20+ ([download here](https://nodejs.org/))
- Python 3.11+ ([download here](https://www.python.org/))
- PostgreSQL with PostGIS installed locally

### Step 1: Setup and Run Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend will run on **http://localhost:5173**

### Step 2: Setup and Run Backend (in a NEW terminal)

```bash
cd backend

# Create virtual environment
python3 -m venv venv

# Activate it
source venv/bin/activate          # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file (copy from example if needed)
cp .env.example .env

# Start the server
uvicorn app.main:app --reload
```

Backend will run on **http://localhost:8000**

API documentation at **http://localhost:8000/docs**

---

## Using the Setup Script (Linux/Mac)

```bash
chmod +x setup.sh
./setup.sh
```

Then select option 1 or 2 based on your preference.

---

## Troubleshooting

### "Port already in use" error

**Docker**: Edit `docker-compose.yml` and change the port mappings:
```yaml
ports:
  - "3001:80"      # Change 3000 to 3001
  - "8001:8000"    # Change 8000 to 8001
```

**Local**: Kill the process using the port:
```bash
# On Linux/Mac
lsof -ti:3000 | xargs kill -9
lsof -ti:8000 | xargs kill -9

# On Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### Database connection error

Make sure the `DATABASE_URL` in `backend/.env` is correct:
- **Docker**: `postgresql://postgres:postgres@db:5432/postgres` (use `db` as hostname)
- **Local**: `postgresql://postgres:password@localhost:5432/your_db_name`

### Frontend not connecting to backend

Add this to your frontend API calls:
```javascript
const API_BASE = import.meta.env.PROD ? '/api' : 'http://localhost:8000';
```

The nginx config automatically proxies `/api` requests to the backend.

### ModuleNotFoundError: No module named 'fastapi'

Make sure you:
1. Created the virtual environment: `python3 -m venv venv`
2. Activated it: `source venv/bin/activate` (or `venv\Scripts\activate` on Windows)
3. Installed dependencies: `pip install -r requirements.txt`

### Docker daemon not running

Start Docker Desktop or run Docker daemon:
```bash
# On Linux
sudo systemctl start docker

# On Mac
open /Applications/Docker.app
```

---

## Common Commands

### Stop Everything
```bash
# Docker
docker-compose down

# Local dev (Ctrl+C in each terminal)
```

### View Logs
```bash
# Docker
docker-compose logs -f          # All services
docker-compose logs -f backend  # Just backend
docker-compose logs -f frontend # Just frontend

# Local dev - watch terminal output
```

### Rebuild Images
```bash
docker-compose build --no-cache
```

### Reset Everything (Remove data)
```bash
docker-compose down -v
```

---

## Project URLs

When running locally:
- Frontend: http://localhost:5173
- Backend: http://localhost:8000
- API Docs (Swagger): http://localhost:8000/docs
- API Docs (ReDoc): http://localhost:8000/redoc

When running with Docker:
- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- API Docs (Swagger): http://localhost:8000/docs
- API Docs (ReDoc): http://localhost:8000/redoc

---

## Next Steps

1. ✅ Get everything running (you've done this!)
2. 📝 Start building features in the frontend (`src/` directory)
3. 🔧 Build API endpoints in the backend (`app/` directory)
4. 🎨 Add UI components: `cd frontend && npx shadcn add <component>`
5. 📚 Read the main [README.md](README.md) for more details

Happy coding! 🚀
