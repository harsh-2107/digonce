# Docker Port Configuration Fix

## Problem
Your system has PostgreSQL running on port 5432, which conflicts with Docker containers trying to use the same port.

## Solution
Updated `docker-compose.yml` to use alternative ports:

### New Port Mappings

| Service | Port | URL |
|---------|------|-----|
| Frontend | 3001 | http://localhost:3001 |
| Backend | 8001 | http://localhost:8001 |
| Database | 5433 | postgresql://localhost:5433 |
| API Docs | 8001 | http://localhost:8001/docs |

### Changes Made

1. **docker-compose.yml**
   - Database: 5432 → 5433
   - Frontend: 3000 → 3001  
   - Backend: 8000 → 8001
   - Added health checks for database

2. **backend/app/main.py**
   - Added CORS origin for http://localhost:3001

## How to Start

```bash
cd /home/harsh/Desktop/manthan/digonce
docker compose up --build
```

The `compose` command (v2) is preferred. If you need `docker-compose` (v1), use that instead.

## Access Your Application

### Development URLs
- **Frontend**: http://localhost:3001
- **Backend API**: http://localhost:8001
- **API Documentation**: http://localhost:8001/docs
- **API ReDoc**: http://localhost:8001/redoc

### Database Connection (if connecting externally)
- **Host**: localhost
- **Port**: 5433
- **User**: postgres
- **Password**: postgres
- **Database**: postgres

## Troubleshooting

### Still getting port conflicts?
Check what's using the ports:
```bash
lsof -i :3001
lsof -i :8001
lsof -i :5433
```

Kill the process if needed:
```bash
kill -9 <PID>
```

### Permission denied connecting to Docker?
Add your user to the docker group:
```bash
sudo usermod -aG docker $USER
newgrp docker
```

### Containers won't start?
Clean up and restart:
```bash
docker compose down -v
docker compose up --build
```

## Keeping Your System PostgreSQL

Your system PostgreSQL (port 5432) will continue running undisturbed. Docker containers now use port 5433 to avoid conflicts.

If you want to completely remove Docker containers and volumes:
```bash
docker compose down -v
```

This removes containers and volumes but doesn't affect your system PostgreSQL.
