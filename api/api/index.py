"""Vercel Python 런타임 진입점.

Vercel 은 `api/` 아래의 모듈을 서버리스 함수로 배포한다. FastAPI 앱을 그대로
노출하면 ASGI 핸들러로 인식된다. 라우팅은 vercel.json 의 rewrite 가 모든 경로를
이 함수로 보내므로, 경로 매칭은 FastAPI 가 담당한다.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app  # noqa: E402

# Vercel 이 찾는 이름들
handler = app
application = app
