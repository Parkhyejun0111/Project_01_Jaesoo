#!/usr/bin/env bash
# 지역계수 월간 재수집 — cron 이 부르는 래퍼.
#
# 등록 (매월 1일 04:10):
#   crontab -e
#   10 4 1 * * /Users/…/7_27_Final_02/scripts/collect-regional.sh >> /tmp/regional-cron.log 2>&1
#
# 두 공개데이터 API 는 이 배치에서만 호출한다. 앱 런타임은 config/*.json 만 읽는다.
# 수집이 실패하면 직전 계수가 그대로 서비스되고, 실패 사유는 아래 두 곳에 남는다.
#   · config/collect_log.jsonl   수집 건수·계수 변화량 (기계 판독용)
#   · 이 스크립트의 stdout       사람이 읽는 배치 로그
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO/api"

# 가상환경이 있으면 그걸 쓴다 — cron 의 PATH 에는 프로젝트 파이썬이 없다.
if [[ -x "$REPO/.venv/bin/python" ]]; then
  PYTHON="$REPO/.venv/bin/python"
else
  PYTHON="$(command -v python3)"
fi

echo "── 지역계수 배치 시작 $(date '+%Y-%m-%d %H:%M:%S') ──"
"$PYTHON" -m regional.collect "$@"
status=$?
echo "── 지역계수 배치 종료 (exit=$status) ──"
exit "$status"
