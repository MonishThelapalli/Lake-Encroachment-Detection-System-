@echo off
cd water-watcher
call npm run build
call npx serve -s dist
pause
