@echo off
title Guvenlik Paneli Sunucusu
echo =======================================
echo     Guvenlik Paneli Baslatiliyor...
echo =======================================
cd /d "%~dp0"
node server.js
pause
