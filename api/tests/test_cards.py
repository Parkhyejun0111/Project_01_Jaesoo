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
