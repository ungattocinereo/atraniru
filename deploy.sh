#!/bin/bash

exec > /tmp/deploy.log 2>&1
echo "Deploy started at $(date)"

cd /home/greg/atraniru || exit

echo "Pulling changes..."
git config --global --add safe.directory /home/greg/atraniru
git fetch origin main
git reset --hard origin/main

echo "Installing dependencies..."
/usr/bin/npm install

echo "Building project..."
/usr/bin/npm run build:prod

echo "Deploy finished at $(date)"
