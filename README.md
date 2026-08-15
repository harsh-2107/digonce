Digonce (React + FastAPI + PostGIS)

This repository contains a Vite React frontend with Tailwind CSS and shadcn/ui, a FastAPI backend, and PostGIS (Postgres) database, all configured via Docker Compose.

## Quick Start with Docker

### Prerequisites
- Docker and Docker Compose installed

### Run with Docker Compose
```bash
cd digonce
docker compose up --build
```

This will start:
- **Frontend**: http://localhost:3001 (Vite React app served via nginx)
- **Backend API**: http://localhost:8001 (FastAPI)
- **Database**: PostgreSQL with PostGIS on port 5433

To stop the services:
```bash
docker compose down
```

To view logs:
```bash
docker compose logs -f
```

**Note**: Using non-standard ports (3001, 8001, 5433) to avoid conflicts with system services. See [DOCKER_PORTS.md](DOCKER_PORTS.md) for details.

---

## Local Development

### Prerequisites
- Node.js 20+ (for frontend)
- Python 3.11+ (for backend)
- PostgreSQL with PostGIS installed locally

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Run development server with hot reload
npm run dev
```

Frontend will be available at http://localhost:5173

Build for production:
```bash
npm run build
npm run preview
```

### Backend Setup

```bash
cd backend

# Create .env file (if not exists)
cp .env.example .env

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the API server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend will be available at http://localhost:8000

API documentation available at:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### Database

If running locally, ensure PostgreSQL with PostGIS is running and update `DATABASE_URL` in `backend/.env`:

```
DATABASE_URL=postgresql://postgres:password@localhost:5432/your_db_name
```

---

## Project Structure

```
digonce/
├── docker-compose.yml       # Docker services orchestration
├── frontend/                # Vite React app
│   ├── Dockerfile          # Frontend container config
│   ├── nginx.conf          # Nginx config for production
│   ├── package.json        # React dependencies
│   ├── vite.config.ts      # Vite configuration
│   ├── tailwind.config.js  # Tailwind CSS config
│   ├── tsconfig.json       # TypeScript config
│   └── src/                # React source code
├── backend/                # FastAPI application
│   ├── Dockerfile          # Backend container config
│   ├── requirements.txt    # Python dependencies
│   ├── .env.example        # Environment variables template
│   └── app/                # FastAPI app code
└── README.md              # This file
```

---

## Environment Variables

### Backend (.env)

```
DATABASE_URL=postgresql://postgres:postgres@db:5432/postgres
```

---

## Technology Stack

**Frontend:**
- Vite (build tool)
- React 19
- TypeScript
- Tailwind CSS
- shadcn/ui (component library)
- Lucide React (icons)

**Backend:**
- FastAPI (Python web framework)
- Uvicorn (ASGI server)
- SQLAlchemy (ORM)
- PostgreSQL with PostGIS (spatial database)

**DevOps:**
- Docker & Docker Compose
- Nginx (reverse proxy & static server)

---

## Common Commands

### Docker Compose
```bash
# Start all services
docker compose up

# Start in background
docker compose up -d

# Stop all services
docker compose down

# Remove containers and volumes
docker compose down -v

# View logs
docker compose logs -f

# View specific service logs
docker compose logs -f backend

# Rebuild images
docker compose build

# Run command in container
docker compose exec backend bash
```

### Frontend (Development)
```bash
npm run dev          # Start dev server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run linter
```

### Backend (Development)
```bash
uvicorn app.main:app --reload              # Start with auto-reload
uvicorn app.main:app --host 0.0.0.0        # Make accessible to network
```

---

## Troubleshooting

### Port already in use
If ports 3000, 8000, or 5432 are already in use, modify `docker-compose.yml`:

```yaml
ports:
  - "3001:80"      # Frontend on 3001
  - "8001:8000"    # Backend on 8001
  - "5433:5432"    # DB on 5433
```

### Database connection issues
Ensure the `DATABASE_URL` is correct and PostgreSQL is running. For Docker, the hostname should be `db` (service name in docker-compose.yml).

### Frontend build fails
Clear node_modules and reinstall:
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run build
```

---

## Adding Components

To add a new shadcn/ui component:
```bash
cd frontend
npx shadcn add button        # Example: button component
npx shadcn add input
npx shadcn add card
```

See [shadcn/ui documentation](https://ui.shadcn.com/docs/components/accordion) for available components.

---

## License

MIT
