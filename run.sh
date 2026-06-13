#!/usr/bin/env bash
set -e

cd /root/task

echo "Starting CareSlot full-stack deployment..."
docker compose up -d --build

echo "Waiting for PostgreSQL to become ready..."
for i in $(seq 1 30); do
  if docker exec careslot-postgres pg_isready -U careslot -d careslot >/dev/null 2>&1; then
    echo "PostgreSQL is ready."
    break
  fi
  echo "  PostgreSQL not ready yet ($i/30)..."
  sleep 3
  if [ "$i" -eq 30 ]; then
    echo "PostgreSQL failed to become ready."
    docker compose logs
    exit 1
  fi
done

echo "Waiting for the application API to respond..."
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
    echo "API is responding and connected to PostgreSQL."
    break
  fi
  echo "  API not ready yet ($i/30)..."
  sleep 3
  if [ "$i" -eq 30 ]; then
    echo "Application API failed to respond."
    docker compose logs
    exit 1
  fi
done

echo "Verifying the frontend is reachable..."
for i in $(seq 1 15); do
  if curl -sf http://127.0.0.1:3000/ >/dev/null 2>&1; then
    echo "Frontend is reachable."
    break
  fi
  echo "  Frontend not ready yet ($i/15)..."
  sleep 2
  if [ "$i" -eq 15 ]; then
    echo "Frontend failed to respond."
    docker compose logs
    exit 1
  fi
done

echo ""
echo "Deployment successful!"
echo "Frontend:  http://127.0.0.1:3000/"
echo "API:       http://127.0.0.1:3000/api/health"
