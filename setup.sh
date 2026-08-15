#!/bin/bash

# Digonce Project Setup Script
# This script sets up and runs the entire Digonce project

set -e

echo "🚀 Digonce Setup Script"
echo "======================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed. Please install Docker first.${NC}"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed. Please install Docker Compose first.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Docker and Docker Compose found${NC}"
echo ""

# Ask user what they want to do
echo "What would you like to do?"
echo "1. Run with Docker (recommended)"
echo "2. Run locally (requires Node.js and Python)"
echo "3. Exit"
read -p "Enter your choice (1-3): " choice

case $choice in
    1)
        echo ""
        echo -e "${YELLOW}Starting services with Docker Compose...${NC}"
        echo ""
        docker-compose up --build
        ;;
    2)
        echo ""
        echo -e "${YELLOW}Setting up local development environment...${NC}"
        echo ""
        
        # Setup Frontend
        echo -e "${YELLOW}Setting up Frontend...${NC}"
        cd frontend
        if [ ! -d "node_modules" ]; then
            npm install
        fi
        
        # Start frontend in background
        npm run dev &
        FRONTEND_PID=$!
        cd ..
        echo -e "${GREEN}✓ Frontend started (PID: $FRONTEND_PID)${NC}"
        echo ""
        
        # Setup Backend
        echo -e "${YELLOW}Setting up Backend...${NC}"
        cd backend
        
        if [ ! -d "venv" ]; then
            python3 -m venv venv
        fi
        
        source venv/bin/activate
        pip install -q -r requirements.txt
        
        # Check if .env file exists
        if [ ! -f ".env" ]; then
            echo "Creating .env file..."
            cp .env.example .env
        fi
        
        echo -e "${GREEN}✓ Backend dependencies installed${NC}"
        echo ""
        
        # Start backend
        echo -e "${YELLOW}Starting Backend...${NC}"
        uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
        ;;
    3)
        echo "Exiting..."
        exit 0
        ;;
    *)
        echo -e "${RED}Invalid choice. Please enter 1, 2, or 3.${NC}"
        exit 1
        ;;
esac
