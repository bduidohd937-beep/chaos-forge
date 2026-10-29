@echo off
REM CHAOS FORGE 업로드 스크립트 (Windows)
setlocal
set REPO=https://github.com/bduidohd937-beep/chaos-forge.git

where gh >nul 2>nul
if errorlevel 1 (
  echo GitHub CLI(gh^)가 필요합니다: https://cli.github.com/
  pause
  exit /b 1
)

gh auth status >nul 2>nul
if errorlevel 1 gh auth login
gh auth setup-git

if not exist .git git init -b main
git add -A
git commit -m "CHAOS FORGE v1.0 (React + Vite)"
git remote remove origin 2>nul
git remote add origin %REPO%
git push -u origin main

echo.
echo 업로드 완료: %REPO%
echo 다음: 저장소 Settings -^> Pages -^> Source 를 GitHub Actions 로 설정하세요.
pause
