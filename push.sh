#!/usr/bin/env bash
# CHAOS FORGE 업로드 스크립트 (macOS / Linux)
set -e
REPO="https://github.com/bduidohd937-beep/chaos-forge.git"

echo "▶ GitHub CLI 확인..."
if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI(gh)가 필요합니다: https://cli.github.com/ 설치 후 다시 실행하세요."
  exit 1
fi

echo "▶ GitHub 로그인 (이미 로그인되어 있으면 생략됩니다)"
gh auth status >/dev/null 2>&1 || gh auth login
gh auth setup-git >/dev/null 2>&1 || true

echo "▶ 커밋 준비"
[ -d .git ] || git init -b main
git add -A
git commit -m "CHAOS FORGE v1.0 (React + Vite)" || echo "  (변경 사항 없음)"

echo "▶ 원격 연결 및 푸시"
git remote remove origin 2>/dev/null || true
git remote add origin "$REPO"
git push -u origin main

echo ""
echo "✅ 업로드 완료: $REPO"
echo "다음: 저장소 Settings → Pages → Source 를 'GitHub Actions' 로 설정하세요."
