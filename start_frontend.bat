@echo off
echo Starting Frontend HTTP Server on port 8080...
cd frontend
python -m http.server 8080
pause
