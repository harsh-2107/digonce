#!/bin/bash

# Development Script for Digonce
# Runs backend in Docker + frontend locally for instant hot reload

set -e

echo "🚀 Digonce Development Setup"
echo "============================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed"
    exit 1
fi

echo -e "${GREEN}✓ Docker found${NC}"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed"
    exit 1
fi

echo -e "${GREEN}✓ Node.js found${NC}"
echo ""

# Start Docker containers (DB + Backend)
echo -e "${YELLOW}Starting Database and Backend in Docker...${NC}"
echo "Run this in another terminal when ready:"
echo ""
echo -e "${YELLOW}  cd frontend && npm run dev${NC}"
echo ""

docker compose up db backend &
DOCKER_PID=$!

# Wait for backend to start
echo -e "${YELLOW}Waiting for backend to be ready...${NC}"
sleep 5

for i in {1..30}; do
    if curl -s http://localhost:8001/health > /dev/null; then
        echo -e "${GREEN}✓ Backend is ready!${NC}"
        break
    fi
    echo "  Checking... ($i/30)"
    sleep 1
done

echo ""
echo -e "${YELLOW}Starting Frontend with hot reload...${NC}"
echo ""

# Start frontend
cd frontend
npm run dev

# Cleanup
trap "kill $DOCKER_PID" EXIT
