"use client";

import { useCallback, useState } from "react";
import { api, CLAIM_STATUS_VARIANT, CLAIM_VARIANT } from "@jaesoo/api-client";

/**
 * 학원비 영수증 청구 — 백엔드 receipt_verification 연동.
 *
 * 화면 흐름과 백엔드 상태의 대응 (약관 제14조 · receipt_verification/enums.py)
 *   카드 등록 → POST /api/cards            (뒤 4자리만 저장. 전체 번호·CVC 는 거절된다)
 *   청구 생성 → POST /api/claims
 *   영수증    → POST /api/claims/{id}/receipt   (파일 검증 + OCR + 자동 대조)
 *   결과      → GET  /api/claims/{id}/verification
 *
 * 결과 매핑
 *   MATCHED         → matched   (VERIFIED)
 *   REVIEW_REQUIRED → review    (ADDITIONAL_PROOF_REQUIRED 면 proof)
 *   REJECTED        → rejected
 */

export type ClaimVariant = "matched" | "review" | "proof" | "rejected";

export type ClaimOCRResult = {
  card_last4?: string | null;
  payment_amount?: number | null;
  payment_date?: string | null;
  approval_number?: string | null;
  merchant_name?: string | null;
  business_number?: string | null;
  confidence_score?: number;
};

export type ClaimVerificationResult = {
  status?: string;
  final_result?: string;
  anomaly_reasons?: string[];
  next_action?: string | null;
  checks?: Record<string, boolean>;
};

export type UploadedClaimDocument = {
  id: number;
  original_filename: string;
  content_type: string;
  file_size: number;
  document_type: string;
  uploaded_at: string;
};

export type ClaimUploadResult = {
  status?: string;
  document?: UploadedClaimDocument;
  ocr_result?: ClaimOCRResult | null;
  verification?: ClaimVerificationResult | null;
};

/** 등록 카드 입력 — 백엔드 CardCreate 와 1:1 (전체 번호·CVC 는 받지 않는다) */
export type CardInput = {
  company: string;
  last4: string;
  holderName: string;
  relationship: string;
};

export type ClaimState = {
  cardId: number | null;
  claimId: number | null;
  last4: string;
  variant: ClaimVariant | null;
  status: string | null;
  reasons: string[];
  ocrResult: ClaimOCRResult | null;
  verification: ClaimVerificationResult | null;
  documents: UploadedClaimDocument[];
  error: string | null;
  busy: boolean;
};

const EMPTY: ClaimState = {
  cardId: null,
  claimId: null,
  last4: "",
  variant: null,
  status: null,
  reasons: [],
  ocrResult: null,
  verification: null,
  documents: [],
  error: null,
  busy: false,
};

/** 백엔드 응답 → 화면 variant. 상태가 결과보다 우선한다(추가증빙 요구가 더 구체적). */
export function toVariant(status?: string | null, result?: string | null): ClaimVariant | null {
  if (status && CLAIM_STATUS_VARIANT[status]) return CLAIM_STATUS_VARIANT[status] as ClaimVariant;
  if (result && CLAIM_VARIANT[result]) return CLAIM_VARIANT[result] as ClaimVariant;
  return null;
}

export function useClaim(studentId: string | null) {
  const [state, setState] = useState<ClaimState>(EMPTY);

  const patch = (p: Partial<ClaimState>) => setState((s) => ({ ...s, ...p }));

  /**
   * 등록 카드 확인 — 없으면 만든다.
   * 필드명은 백엔드 CardCreate 스키마와 정확히 같아야 한다(extra="forbid" 라
   * 오타가 있으면 422 로 거절된다). 전체 카드번호·CVC 는 스키마가 받지 않는다 —
   * 뒤 4자리만 저장하는 것이 개인정보 설계다.
   */
  const ensureCard = useCallback(
    async (card: CardInput, userId: number) => {
      patch({ busy: true, error: null });
      const existing = await api.activeCard(String(userId));
      if (existing.ok && (existing.data as { id?: number })?.id) {
        const found = existing.data as { id: number; card_last4?: string };
        if (found.card_last4 !== card.last4) {
          const updated = await api.updateCard(String(found.id), {
            card_company: card.company,
            card_last4: card.last4,
            card_holder_name: card.holderName,
            relationship_to_student: card.relationship,
            is_active: true,
          });
          if (!updated.ok) {
            patch({ busy: false, error: updated.error });
            return null;
          }
        }
        patch({ busy: false, cardId: found.id, last4: card.last4 });
        return found.id;
      }
      const created = await api.registerCard({
        user_id: userId,
        card_company: card.company,
        card_last4: card.last4,
        card_holder_name: card.holderName,
        relationship_to_student: card.relationship,
      });
      if (!created.ok) {
        patch({ busy: false, error: created.error });
        return null;
      }
      const row = created.data as { id: number };
      patch({ busy: false, cardId: row.id, last4: card.last4 });
      return row.id;
    },
    [],
  );

  const changeCard = useCallback(
    async (cardId: number, card: Partial<CardInput>) => {
      patch({ busy: true, error: null });
      const res = await api.updateCard(String(cardId), {
        ...(card.company ? { card_company: card.company } : {}),
        ...(card.last4 ? { card_last4: card.last4 } : {}),
        ...(card.holderName ? { card_holder_name: card.holderName } : {}),
        ...(card.relationship ? { relationship_to_student: card.relationship } : {}),
      });
      patch({ busy: false, last4: card.last4 ?? state.last4, error: res.ok ? null : res.error });
      return res.ok;
    },
    [state.last4],
  );

  const createClaim = useCallback(
    async (cardId: number, userId: number) => {
      if (!studentId) {
        patch({ error: "학생 정보가 없어 청구를 만들 수 없어요." });
        return null;
      }
      patch({ busy: true, error: null });
      const res = await api.createClaim({
        user_id: userId,
        student_id: studentId,
        registered_card_id: cardId,
      });
      if (!res.ok) {
        patch({ busy: false, error: res.error });
        return null;
      }
      const claim = res.data as { id: number };
      patch({ busy: false, claimId: claim.id });
      return claim.id;
    },
    [studentId],
  );

  /** 영수증 업로드 → 파일 검증 · OCR · 자동 대조까지 백엔드가 한 번에 처리한다. */
  const uploadReceipt = useCallback(
    async (claimId: number, file: File, kind: "receipt" | "proof" = "receipt") => {
      patch({ busy: true, error: null });
      const res = await api.uploadReceipt(claimId, file, { kind });
      if (!res.ok) {
        patch({ busy: false, error: res.error });
        return null;
      }
      const d = res.data as ClaimUploadResult;
      patch({
        busy: false,
        status: d.status ?? null,
        variant: toVariant(d.status, d.verification?.final_result) ?? null,
        reasons: d.verification?.anomaly_reasons ?? [],
        ocrResult: d.ocr_result ?? null,
        verification: d.verification ?? null,
        documents: d.document ? [...state.documents, d.document] : state.documents,
      });
      return d;
    },
    [state.documents],
  );

  /** 검증 결과 조회 — 업로드 후 호출한다. */
  const refreshVerification = useCallback(async (claimId: number) => {
    patch({ busy: true, error: null });
    const res = await api.claimVerification(String(claimId));
    if (!res.ok) {
      patch({ busy: false, error: res.error });
      return null;
    }
    const d = res.data as {
      status?: string;
      final_result?: string;
      anomaly_reasons?: string[];
    };
    const variant = toVariant(d.status, d.final_result);
    patch({
      busy: false,
      variant,
      status: d.status ?? null,
      reasons: d.anomaly_reasons ?? [],
      verification: d,
    });
    return variant;
  }, []);

  const reset = useCallback(() => setState(EMPTY), []);

  return {
    ...state,
    ensureCard,
    changeCard,
    createClaim,
    uploadReceipt,
    refreshVerification,
    reset,
  };
}
