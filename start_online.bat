@echo off
title Gold Loan System - Online Live Server
cd /d "%~dp0"
echo ====================================================
echo Starting Gold Loan System with Online Public Link...
echo ====================================================

start "Flask Backend" cmd /c "python app.py"
timeout /t 3 /nobreak >nul

echo Starting Online Cloudflare Tunnel...
.\cloudflared.exe tunnel --url http://localhost:5000
pause
