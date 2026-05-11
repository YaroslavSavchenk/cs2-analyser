from __future__ import annotations

import requests


class OllamaClient:
    def __init__(self, host: str = "http://localhost:11434", model: str = "qwen2.5-vl:7b") -> None:
        self.host = host.rstrip("/")
        self.model = model

    def is_available(self) -> bool:
        try:
            response = requests.get(f"{self.host}/api/tags", timeout=1.0)
            return response.status_code == 200
        except Exception:
            return False

    def generate(self, prompt: str, images: list[bytes] | None = None) -> str:
        raise NotImplementedError("Ollama integration arrives in v0.3")
