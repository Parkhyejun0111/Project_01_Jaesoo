from __future__ import annotations

import rag_light


def test_langsmith_usage_metadata_maps_openai_usage() -> None:
    usage = {
        "prompt_tokens": 120,
        "completion_tokens": 30,
        "total_tokens": 150,
        "prompt_tokens_details": {
            "cached_tokens": 40,
            "audio_tokens": 2,
        },
        "completion_tokens_details": {
            "reasoning_tokens": 8,
            "audio_tokens": 1,
        },
    }

    assert rag_light._langsmith_usage_metadata(usage) == {
        "input_tokens": 120,
        "output_tokens": 30,
        "total_tokens": 150,
        "input_token_details": {
            "cache_read": 40,
            "audio": 2,
        },
        "output_token_details": {
            "reasoning": 8,
            "audio": 1,
        },
    }


def test_langsmith_usage_metadata_handles_missing_usage() -> None:
    assert rag_light._langsmith_usage_metadata(None) == {}
    assert rag_light._langsmith_usage_metadata({}) == {}


def test_langsmith_trace_inputs_do_not_log_secrets() -> None:
    processed = rag_light._langsmith_llm_inputs(
        {
            "url": "https://api.openai.com/v1/chat/completions",
            "api_key": "sk-secret",
            "provider": "openai",
            "model": "gpt-4o",
            "messages": [{"role": "user", "content": "hello"}],
        }
    )

    assert processed == {
        "model": "gpt-4o",
        "messages": [{"role": "user", "content": "hello"}],
    }
    assert "api_key" not in processed
    assert "url" not in processed


def test_post_chat_completion_sets_model_and_usage(monkeypatch) -> None:
    class FakeRun:
        def __init__(self) -> None:
            self.updates: list[dict] = []

        def set(self, **kwargs) -> None:
            self.updates.append(kwargs)

    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict:
            return {
                "choices": [
                    {"message": {"role": "assistant", "content": "answer"}}
                ],
                "usage": {
                    "prompt_tokens": 10,
                    "completion_tokens": 2,
                    "total_tokens": 12,
                },
            }

    fake_run = FakeRun()
    monkeypatch.setattr(rag_light, "get_current_run_tree", lambda: fake_run)

    import httpx

    monkeypatch.setattr(httpx, "post", lambda *args, **kwargs: FakeResponse())
    undecorated = getattr(
        rag_light._post_chat_completion,
        "__wrapped__",
        rag_light._post_chat_completion,
    )

    result = undecorated(
        "https://api.openai.com/v1/chat/completions",
        "sk-test",
        "openai",
        "gpt-4o",
        [{"role": "user", "content": "hello"}],
    )

    assert result["choices"][0]["message"]["content"] == "answer"
    assert fake_run.updates == [
        {
            "metadata": {
                "ls_provider": "openai",
                "ls_model_name": "gpt-4o",
                "ls_temperature": 0.1,
                "ls_max_tokens": 1200,
            }
        },
        {
            "usage_metadata": {
                "input_tokens": 10,
                "output_tokens": 2,
                "total_tokens": 12,
            }
        },
    ]
