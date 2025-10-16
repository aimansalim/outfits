#!/bin/bash
# Health Dashboard Viewer - Auto-updates and opens dashboard

cd "$(dirname "$0")"

echo "============================================"
echo "Health Dashboard Viewer"
echo "============================================"

# Check for new export ZIP and extract if needed
echo ""
echo "Checking for Health export updates..."
python3 auto_update_health.py

echo ""
echo "Starting HTTP server..."
echo "Dashboard: http://localhost:8080/dashboard.html"
echo ""
echo "Press Ctrl+C to stop server"
echo ""

# Start server and open browser
cd public/health
open http://localhost:8080/dashboard.html
python3 -m http.server 8080

