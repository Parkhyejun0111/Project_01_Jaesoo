/**
 * 재수없수 백엔드(FastAPI) 공유 클라이언트 — 웹(Vite)·앱(Next) 공용.
 *
 * 설계 원칙
 *  · API_BASE 결정 로직을 한 곳에만 둔다. Vite 는 VITE_API_URL, Next 는
 *    NEXT_PUBLIC_API_URL 을 쓰므로 둘 다 읽는다. Vite 환경변수는 **빌드 시점에
 *    박히므로** 배포 전 반드시 설정해야 한다.
 *  · 모든 호출에 타임아웃을 둔다. 백엔드가 꺼져 있어도 화면이 멈추지 않아야 한다.
 *  · 요청 경합 취소를 지원한다(레거시 SPA 의 `_llmReq` 패턴을 일반화한 `sequence()`).
 *  · 실패는 예외가 아니라 `{ ok:false, error }` 로 돌려주고, 폴백은 호출부가 정한다.
 */

const DEFAULT_BASE = "http://localhost:8000";
const DEFAULT_TIMEOUT = 15_000;

/**
 * 빌드 시점 환경변수 읽기.
 *
 * ★ `process.env.NEXT_PUBLIC_API_URL` / `import.meta.env.VITE_API_URL` 을
 *   **표현식 그대로** 써야 한다. 번들러는 정확히 그 형태만 값으로 치환한다.
 *   변수에 담아(`const e = process.env; e.NEXT_PUBLIC_API_URL`) 접근하거나
 *   동적 키(`process.env[key]`)를 쓰면 치환되지 않아 브라우저에서 빈 값이 되고,
 *   조용히 기본값(localhost:8000)으로 떨어져 배포 후 API 호출이 전부 실패한다.
 */
function viteApiUrl() {
  try {
    return import.meta.env.VITE_API_URL;
  } catch {
    return undefined; // import.meta 를 지원하지 않는 런타임
  }
}

function nextApiUrl() {
  try {
    return process.env.NEXT_PUBLIC_API_URL;
  } catch {
    return undefined; // process 가 없는 런타임
  }
}

export function resolveBase(explicit) {
  const base = explicit || viteApiUrl() || nextApiUrl() || DEFAULT_BASE;
  return String(base).replace(/\/+$/, "");
}

/** 백엔드 부재·타임아웃·HTTP 오류를 구분해 담는 결과 객체. */
function fail(error, kind) {
  return { ok: false, error: String(error), kind };
}

function ok(data) {
  return { ok: true, data };
}

export class ApiClient {
  constructor({ base, timeout = DEFAULT_TIMEOUT, fetchImpl } = {}) {
    this.base = resolveBase(base);
    this.timeout = timeout;
    this._fetch = fetchImpl || (typeof fetch !== "undefined" ? fetch.bind(globalThis) : null);
    this._sequences = new Map();
  }

  _url(path, params) {
    const url = new URL(this.base + path);
    for (const [k, v] of Object.entries(params || {})) {
      if (v === undefined || v === null || v === "") continue;
      url.searchParams.set(k, Array.isArray(v) ? v.join(",") : String(v));
    }
    return url.toString();
  }

  async request(path, { method = "GET", params, body, signal, timeout } = {}) {
    if (!this._fetch) return fail("fetch 를 사용할 수 없는 환경입니다", "unsupported");

    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = controller
      ? setTimeout(() => controller.abort(), timeout ?? this.timeout)
      : null;
    // 호출부가 넘긴 signal 과 타임아웃 signal 을 함께 존중한다
    if (signal && controller) {
      if (signal.aborted) controller.abort();
      else signal.addEventListener("abort", () => controller.abort(), { once: true });
    }

    try {
      const res = await this._fetch(this._url(path, params), {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller ? controller.signal : undefined,
      });
      if (!res.ok) return fail(`HTTP ${res.status}`, "http");
      const data = await res.json();
      // 백엔드는 200 으로 { error } 를 돌려주는 경우가 있다 (엔드포인트 관례)
      if (data && typeof data === "object" && data.error && data.ok !== true) {
        return fail(data.error, "backend");
      }
      return ok(data);
    } catch (e) {
      const aborted = e && (e.name === "AbortError" || e.name === "TimeoutError");
      return fail(aborted ? "요청 시간이 초과되었거나 취소되었습니다" : e, aborted ? "abort" : "network");
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /**
   * 같은 키의 이전 요청 결과를 버린다 — 사용자가 빠르게 연속 입력할 때
   * 늦게 도착한 옛 응답이 화면을 덮는 것을 막는다(레거시 `_llmReq` 패턴).
   * 취소된 호출은 `{ ok:false, kind:"stale" }` 를 돌려주므로 호출부는 무시하면 된다.
   */
  async sequence(key, fn) {
    const seq = (this._sequences.get(key) || 0) + 1;
    this._sequences.set(key, seq);
    const result = await fn();
    if (this._sequences.get(key) !== seq) return fail("최신 요청이 아닙니다", "stale");
    return result;
  }

  // ── 상태 ──────────────────────────────────────────────────────────────
  health() {
    return this.request("/api/health", { timeout: 4_000 });
  }

  // ── 상품·요율 ─────────────────────────────────────────────────────────
  /** 티어 비교표. remainingMonths = 잔여 납입개월(33=고1 3월 최초 … 6=고3 6월 마감). */
  tiers(remainingMonths) {
    return this.request("/api/tiers", { params: { remaining_months: remainingMonths } });
  }
  /** 가입 시점별 월납 조견표 (약관 별표2). */
  quote() {
    return this.request("/api/quote");
  }
  /** 청약서 거주지 선택지 → 학원밀집도지수. */
  regions() {
    return this.request("/api/regions");
  }

  // ── 청약 ──────────────────────────────────────────────────────────────
  enroll(payload) {
    return this.request("/api/enroll", { method: "POST", body: payload, timeout: 20_000 });
  }

  // ── 학생·개인화 ───────────────────────────────────────────────────────
  students() {
    return this.request("/api/students");
  }
  student(id) {
    return this.request(`/api/student/${encodeURIComponent(id)}`);
  }
  scores(id) {
    return this.request(`/api/student/${encodeURIComponent(id)}/scores`);
  }
  premiumBreakdown(id) {
    return this.request(`/api/student/${encodeURIComponent(id)}/premium-breakdown`);
  }
  /** 보장 대상 판정. actualGrade 없으면 '판정 전' 상태. */
  eligibility(id, actualGrade) {
    return this.request(`/api/student/${encodeURIComponent(id)}/eligibility`, {
      params: { actual_grade: actualGrade },
    });
  }
  renewals(id) {
    return this.request(`/api/student/${encodeURIComponent(id)}/renewals`);
  }

  // ── 돈워리 계산기 ─────────────────────────────────────────────────────
  costForms() {
    return this.request("/api/cost-forms");
  }
  costEstimate(params) {
    return this.request("/api/cost-estimate", { params });
  }

  // ── 약관 챗봇 ─────────────────────────────────────────────────────────
  /** 약관 RAG. studentId 를 주면 개인화 컨텍스트가 붙는다. */
  chat({ message, history, studentId, signal }) {
    return this.sequence("chat", () =>
      this.request("/api/chat", {
        method: "POST",
        body: { message, history: history || [], student_id: studentId || null },
        timeout: 60_000,
        signal,
      }),
    );
  }
  /** 근거 조항 전문. anchors = 앵커 배열. 비우면 목차를 돌려준다. */
  policySections(anchors) {
    return this.request("/api/policy/sections", { params: { a: anchors } });
  }

  // ── 학원비 영수증 청구 ────────────────────────────────────────────────
  registerCard(payload) {
    return this.request("/api/cards", { method: "POST", body: payload });
  }
  activeCard(userId) {
    return this.request(`/api/cards/users/${encodeURIComponent(userId)}/active`);
  }
  updateCard(cardId, payload) {
    return this.request(`/api/cards/${encodeURIComponent(cardId)}`, {
      method: "PUT",
      body: payload,
    });
  }
  createClaim(payload) {
    return this.request("/api/claims", { method: "POST", body: payload });
  }
  claim(claimId) {
    return this.request(`/api/claims/${encodeURIComponent(claimId)}`);
  }
  claimVerification(claimId) {
    return this.request(`/api/claims/${encodeURIComponent(claimId)}/verification`);
  }

  /**
   * 영수증 업로드 (multipart). 파일 검증 → OCR → 등록 카드와 자동 대조까지 한 번에 돈다.
   * JSON 이 아니라 FormData 를 보내야 하므로 request() 를 거치지 않는다.
   */
  async uploadReceipt(claimId, file, { kind = "receipt", signal } = {}) {
    if (!this._fetch) return fail("fetch 를 사용할 수 없는 환경입니다", "unsupported");
    const path =
      kind === "proof"
        ? `/api/claims/${encodeURIComponent(claimId)}/additional-proof`
        : `/api/claims/${encodeURIComponent(claimId)}/receipt`;
    const form = new FormData();
    form.append("file", file);

    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 60_000) : null;
    if (signal && controller) {
      if (signal.aborted) controller.abort();
      else signal.addEventListener("abort", () => controller.abort(), { once: true });
    }
    try {
      const res = await this._fetch(this._url(path), {
        method: "POST",
        body: form,
        signal: controller ? controller.signal : undefined,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        // 백엔드는 파일 형식·크기·중복을 4xx + detail 로 알려준다
        return fail(data?.detail || `HTTP ${res.status}`, "http");
      }
      return ok(data);
    } catch (e) {
      const aborted = e && (e.name === "AbortError" || e.name === "TimeoutError");
      return fail(aborted ? "업로드가 취소되었거나 시간이 초과되었습니다" : e, aborted ? "abort" : "network");
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

/** 앱·웹이 공유하는 기본 인스턴스. 필요하면 new ApiClient({base}) 로 따로 만든다. */
export const api = new ApiClient();

// ── 표시 헬퍼 (웹·앱이 같은 포맷을 쓰도록) ────────────────────────────────
export const won = (n) =>
  typeof n === "number" && Number.isFinite(n) ? n.toLocaleString("ko-KR") + "원" : "—";

export const manwon = (n) =>
  typeof n === "number" && Number.isFinite(n)
    ? Math.round(n / 10_000).toLocaleString("ko-KR") + "만원"
    : "—";

/**
 * 서비스가 다루는 성적 단위는 **백분위**(0~100, 높을수록 우수)다.
 * 약관 별표3 의 밴드 판정만 등급 단위로 이뤄지고, 그 환산은 백엔드가 처리한다.
 */
export const SCORE_SCALE = { min: 0, max: 100, betterIsHigher: true, unit: "percentile" };

/** 심각도 코드 ↔ 화면 라벨 (백엔드 engine.eligibility 의 result 와 1:1). */
export const SEVERITY_LABEL = { none: "비대상", mild: "경증", severe: "중증" };

/** 청구 검증 결과 ↔ 앱 화면 variant (백엔드 FinalResult/ClaimStatus 와 1:1). */
export const CLAIM_VARIANT = {
  MATCHED: "matched",
  REVIEW_REQUIRED: "review",
  REJECTED: "rejected",
};
export const CLAIM_STATUS_VARIANT = {
  VERIFIED: "matched",
  ADDITIONAL_PROOF_REQUIRED: "proof",
  ADDITIONAL_PROOF_UPLOADED: "proof",
  MANUAL_REVIEW: "review",
  REJECTED: "rejected",
};
