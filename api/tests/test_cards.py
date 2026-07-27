from fastapi.testclient import TestClient


def test_register_card(client: TestClient, card_payload: dict):
    response = client.post("/api/cards", json=card_payload)

    assert response.status_code == 201
    assert response.json()["card_last4"] == "4821"
    assert response.json()["is_active"] is True


def test_rejects_card_last4_not_four_digits(
    client: TestClient, card_payload: dict
):
    card_payload["card_last4"] = "12345"

    response = client.post("/api/cards", json=card_payload)

    assert response.status_code == 422


def test_registering_new_card_deactivates_previous(
    client: TestClient, card_payload: dict
):
    first = client.post("/api/cards", json=card_payload).json()
    second_payload = {
        **card_payload,
        "card_company": "국민카드",
        "card_last4": "9999",
    }

    second = client.post("/api/cards", json=second_payload)
    active = client.get("/api/cards/users/1/active")
    old = client.put(f"/api/cards/{first['id']}", json={})

    assert second.status_code == 201
    assert active.json()["id"] == second.json()["id"]
    assert old.json()["is_active"] is False


def test_lists_user_cards_active_first(client: TestClient, card_payload: dict):
    """청구 1단계 목록 — 비활성(과거) 카드도 함께, 활성 카드가 맨 앞에."""
    client.post("/api/cards", json=card_payload)
    client.post(
        "/api/cards",
        json={**card_payload, "card_company": "국민카드", "card_last4": "9910"},
    )

    response = client.get("/api/cards/users/1")

    assert response.status_code == 200
    cards = response.json()["cards"]
    assert [card["card_last4"] for card in cards] == ["9910", "4821"]
    assert cards[0]["is_active"] is True
    assert cards[1]["is_active"] is False


def test_lists_only_active_cards_when_requested(
    client: TestClient, card_payload: dict
):
    client.post("/api/cards", json=card_payload)
    client.post(
        "/api/cards",
        json={**card_payload, "card_company": "국민카드", "card_last4": "9910"},
    )

    response = client.get("/api/cards/users/1", params={"active_only": True})

    cards = response.json()["cards"]
    assert [card["card_last4"] for card in cards] == ["9910"]


def test_lists_empty_for_user_without_cards(client: TestClient):
    """카드 미등록은 오류가 아니라 빈 목록이다."""
    response = client.get("/api/cards/users/999")

    assert response.status_code == 200
    assert response.json()["cards"] == []
