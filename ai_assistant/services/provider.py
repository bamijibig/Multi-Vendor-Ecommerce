"""Provider abstraction for the AI assistant.

The rest of the application never talks to a vendor SDK directly. Set
``AI_PROVIDER``, ``AI_API_KEY`` and ``AI_MODEL`` in the backend .env to enable
an external model; when they are absent, callers fall back to the deterministic
local drafting logic in ``content_generator.py``.
"""

from __future__ import annotations

import base64
import json
import logging
import re
from typing import Any

import requests
from django.conf import settings

logger = logging.getLogger(__name__)


class AIProviderError(Exception):
    """Raised when an external provider is unavailable or returns bad data."""


def _settings_value(name: str, default: str = "") -> str:
    value = getattr(settings, name, None)
    if value is None:
        return default
    return str(value).strip()


def _timeout() -> float:
    try:
        return float(_settings_value("AI_TIMEOUT_SECONDS", "15") or 15)
    except (TypeError, ValueError):
        return 15.0


def extract_json(text: str) -> dict[str, Any]:
    """Pull a JSON object from a provider response, tolerating code fences."""
    if not text:
        raise AIProviderError("The AI provider returned an empty response.")
    cleaned = text.strip()
    fenced = re.search(r"```(?:json)?\s*(.*?)```", cleaned, re.DOTALL | re.IGNORECASE)
    if fenced:
        cleaned = fenced.group(1).strip()
    try:
        payload = json.loads(cleaned)
    except json.JSONDecodeError:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise AIProviderError("The AI provider did not return valid JSON.")
        try:
            payload = json.loads(cleaned[start : end + 1])
        except json.JSONDecodeError as exc:
            raise AIProviderError("The AI provider did not return valid JSON.") from exc
    if not isinstance(payload, dict):
        raise AIProviderError("The AI provider returned an unexpected payload.")
    return payload


class BaseAIProvider:
    name = "base"
    supports_images = False

    def generate_json(
        self, *, system_prompt: str, user_prompt: str, timeout: float | None = None
    ) -> dict[str, Any]:
        raise NotImplementedError

    def generate_image(self, *, prompt: str, timeout: float | None = None) -> bytes | None:
        return None


class OpenAICompatibleProvider(BaseAIProvider):
    """OpenAI chat completions, also usable with OpenRouter-compatible APIs."""

    def __init__(self, *, api_key: str, model: str, base_url: str | None = None):
        self.api_key = api_key
        self.model = model or "gpt-4o-mini"
        self.base_url = (base_url or "https://api.openai.com/v1").rstrip("/")
        self.name = "openai"
        self.supports_images = bool(_settings_value("AI_IMAGE_MODEL"))

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def generate_json(
        self, *, system_prompt: str, user_prompt: str, timeout: float | None = None
    ) -> dict[str, Any]:
        response = requests.post(
            f"{self.base_url}/chat/completions",
            headers=self._headers(),
            json={
                "model": self.model,
                "temperature": 0.35,
                "response_format": {"type": "json_object"},
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
            },
            timeout=timeout or _timeout(),
        )
        response.raise_for_status()
        data = response.json()
        content = (
            data.get("choices", [{}])[0]
            .get("message", {})
            .get("content", "")
        )
        return extract_json(content)

    def generate_image(self, *, prompt: str, timeout: float | None = None) -> bytes | None:
        image_model = _settings_value("AI_IMAGE_MODEL")
        if not image_model:
            return None
        response = requests.post(
            f"{self.base_url}/images/generations",
            headers=self._headers(),
            json={
                "model": image_model,
                "prompt": prompt,
                "n": 1,
                "size": "1024x1024",
            },
            timeout=timeout or max(_timeout(), 30),
        )
        response.raise_for_status()
        first = (response.json().get("data") or [{}])[0]
        if first.get("b64_json"):
            return base64.b64decode(first["b64_json"])
        if first.get("url"):
            image_response = requests.get(
                first["url"], timeout=timeout or max(_timeout(), 30)
            )
            image_response.raise_for_status()
            return image_response.content
        return None


class GeminiProvider(BaseAIProvider):
    name = "gemini"
    supports_images = False

    def __init__(self, *, api_key: str, model: str):
        self.api_key = api_key
        self.model = model or "gemini-1.5-flash"

    def generate_json(
        self, *, system_prompt: str, user_prompt: str, timeout: float | None = None
    ) -> dict[str, Any]:
        response = requests.post(
            (
                "https://generativelanguage.googleapis.com/v1beta/models/"
                f"{self.model}:generateContent"
            ),
            params={"key": self.api_key},
            json={
                "contents": [
                    {
                        "parts": [
                            {"text": f"{system_prompt}\n\n{user_prompt}"}
                        ]
                    }
                ],
                "generationConfig": {"responseMimeType": "application/json"},
            },
            timeout=timeout or _timeout(),
        )
        response.raise_for_status()
        data = response.json()
        content = (
            data.get("candidates", [{}])[0]
            .get("content", {})
            .get("parts", [{}])[0]
            .get("text", "")
        )
        return extract_json(content)


def get_provider() -> BaseAIProvider | None:
    """Return the configured provider, or ``None`` for local fallback mode."""
    provider_name = _settings_value("AI_PROVIDER").lower()
    api_key = _settings_value("AI_API_KEY")
    model = _settings_value("AI_MODEL")
    if not api_key or provider_name in {"", "fallback", "none", "local"}:
        return None

    if provider_name in {"openai", "openrouter", "openai-compatible"}:
        base_url = _settings_value("AI_BASE_URL")
        if provider_name == "openrouter" and not base_url:
            base_url = "https://openrouter.ai/api/v1"
        return OpenAICompatibleProvider(
            api_key=api_key, model=model, base_url=base_url or None
        )
    if provider_name in {"gemini", "google"}:
        return GeminiProvider(api_key=api_key, model=model)

    logger.warning("Unknown AI_PROVIDER %r; using local fallback.", provider_name)
    return None
