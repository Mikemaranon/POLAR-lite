import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from .exceptions import ModelOperationError, ProviderUnavailableError


class JsonHttpClient:
    def __init__(self, timeout_seconds=120):
        self.timeout_seconds = timeout_seconds

    def get_json(self, url, *, headers=None, provider_name=None):
        request = Request(url, headers=headers or {}, method="GET")
        return self._send(request, provider_name=provider_name)

    def post_json(self, url, payload, *, headers=None, provider_name=None):
        request_headers = {"Content-Type": "application/json"}
        if headers:
            request_headers.update(headers)

        request = Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers=request_headers,
            method="POST",
        )
        return self._send(request, provider_name=provider_name)

    def _send(self, request, *, provider_name=None):
        try:
            with urlopen(request, timeout=self.timeout_seconds) as response:
                body = response.read().decode("utf-8")
                if not body:
                    return {}
                return json.loads(body)
        except HTTPError as error:
            payload = self._read_error_payload(error)
            message = self._extract_error_message(payload) or str(error)
            raise ModelOperationError(
                message,
                provider=provider_name,
                status_code=error.code,
                details=payload if isinstance(payload, dict) else {"raw": payload},
            ) from error
        except URLError as error:
            raise ProviderUnavailableError(
                f"Could not reach provider endpoint: {error.reason}",
                provider=provider_name,
            ) from error
        except json.JSONDecodeError as error:
            raise ModelOperationError(
                "Provider returned an invalid JSON response.",
                provider=provider_name,
            ) from error

    def _read_error_payload(self, error):
        try:
            raw_payload = error.read().decode("utf-8")
        except Exception:
            return {"status": error.code}

        if not raw_payload:
            return {"status": error.code}

        try:
            return json.loads(raw_payload)
        except json.JSONDecodeError:
            return {"status": error.code, "raw": raw_payload}

    def _extract_error_message(self, payload):
        if not isinstance(payload, dict):
            return None

        error_value = payload.get("error")
        if isinstance(error_value, dict):
            return error_value.get("message")
        if isinstance(error_value, str):
            return error_value

        return payload.get("message")
