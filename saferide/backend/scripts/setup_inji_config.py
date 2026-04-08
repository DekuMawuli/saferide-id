"""Upsert the SafeRide credential configuration into Inji Certify.

Run from the backend directory:
    uv run python scripts/setup_inji_config.py

By default this reads:
    ../../inji/docs/postman-collections/saferide-credential-configuration.payload.json

It then checks whether the credential configuration already exists and:
- `POST`s it when missing
- `PUT`s it when present
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

import httpx


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _default_payload_path() -> Path:
    return _repo_root() / "inji" / "docs" / "postman-collections" / "saferide-credential-configuration.payload.json"


def _credential_base_url(raw_base_url: str) -> str:
    base = (raw_base_url or "").strip().rstrip("/")
    if not base:
        raise ValueError("INJI_CERTIFY_BASE_URL is not set")
    if base.endswith("/v1/certify"):
        return base
    return f"{base}/v1/certify"


def _load_payload(path: Path) -> dict:
    if not path.is_file():
        raise FileNotFoundError(f"Payload file not found: {path}")
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError("Payload JSON must be an object")
    key_id = (data.get("credentialConfigKeyId") or "").strip()
    if not key_id:
        raise ValueError("Payload is missing credentialConfigKeyId")
    return data


def upsert_credential_config(*, base_url: str, payload: dict, timeout: float) -> None:
    config_id = payload["credentialConfigKeyId"].strip()
    collection_url = f"{base_url}/credential-configurations"
    item_url = f"{collection_url}/{config_id}"

    with httpx.Client(timeout=timeout) as client:
        existing = client.get(item_url, headers={"Accept": "application/json"})
        if existing.status_code == 404:
            response = client.post(
                collection_url,
                json=payload,
                headers={"Accept": "application/json", "Content-Type": "application/json"},
            )
            response.raise_for_status()
            print(f"Created credential configuration: {config_id}")
            return

        existing.raise_for_status()
        response = client.put(
            item_url,
            json=payload,
            headers={"Accept": "application/json", "Content-Type": "application/json"},
        )
        response.raise_for_status()
        print(f"Updated credential configuration: {config_id}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Upsert the SafeRide Inji credential configuration")
    parser.add_argument(
        "--payload",
        type=Path,
        default=_default_payload_path(),
        help="Path to the SafeRide credential configuration payload JSON",
    )
    parser.add_argument(
        "--base-url",
        default=os.getenv("INJI_CERTIFY_BASE_URL", "http://127.0.0.1:8090"),
        help="Inji Certify base URL including /v1/certify",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=float(os.getenv("INJI_CERTIFY_TIMEOUT", "30")),
        help="HTTP timeout in seconds",
    )
    args = parser.parse_args()

    payload = _load_payload(args.payload)
    upsert_credential_config(
        base_url=_credential_base_url(args.base_url),
        payload=payload,
        timeout=args.timeout,
    )


if __name__ == "__main__":
    main()
