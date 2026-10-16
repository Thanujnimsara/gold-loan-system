@echo off
title Gold Loan Management System
echo ====================================================
echo Starting Gold Loan Management System...
echo ====================================================
cd /d "%~dp0"

echo Opening browser at http://localhost:5000 ...
timeout /t 2 /nobreak >nul
start "" "http://localhost:5000"

python app.py
pause
