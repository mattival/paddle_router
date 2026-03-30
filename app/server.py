from __future__ import annotations

from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from app.models import LatLng, RouteRequest
from app.services.mock_marine_data import MockMarineDataProvider
from app.services.routing import Router, RoutingError
from app.services.wind import WindService

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

DATA_PROVIDER = MockMarineDataProvider()
WIND_SERVICE = WindService()
ROUTER = Router(DATA_PROVIDER, WIND_SERVICE)


class AppHandler(BaseHTTPRequestHandler):
    server_version = "PaddlingRoutePlanner/0.1"

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path == "/":
            return self._serve_file(STATIC_DIR / "index.html", "text/html; charset=utf-8")
        if parsed.path.startswith("/static/"):
            file_path = STATIC_DIR / parsed.path.removeprefix("/static/")
            return self._serve_file(file_path, _guess_content_type(file_path.suffix))
        if parsed.path == "/api/map-data":
            return self._send_json(DATA_PROVIDER.get_map_payload())
        if parsed.path == "/api/wind":
            query = parse_qs(parsed.query)
            lat = float(query.get("lat", ["60.17"])[0])
            lng = float(query.get("lng", ["24.95"])[0])
            payload = WIND_SERVICE.get_forecast(LatLng(lat=lat, lng=lng))
            return self._send_json(payload)
        self._send_error_json(HTTPStatus.NOT_FOUND, "Endpoint not found.")

    def do_POST(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path != "/api/route":
            return self._send_error_json(HTTPStatus.NOT_FOUND, "Endpoint not found.")

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            body = self.rfile.read(content_length)
            payload = json.loads(body.decode("utf-8"))
            request = RouteRequest.from_dict(payload)
            response = ROUTER.route(request)
            self._send_json(response.to_dict())
        except RoutingError as exc:
            self._send_error_json(HTTPStatus.BAD_REQUEST, str(exc))
        except (json.JSONDecodeError, KeyError, TypeError, ValueError) as exc:
            self._send_error_json(HTTPStatus.BAD_REQUEST, f"Invalid request payload: {exc}")
        except Exception as exc:  # pragma: no cover - defensive response for manual testing
            self._send_error_json(HTTPStatus.INTERNAL_SERVER_ERROR, f"Unexpected server error: {exc}")

    def log_message(self, format: str, *args: object) -> None:
        return

    def _serve_file(self, file_path: Path, content_type: str) -> None:
        if not file_path.exists() or not file_path.is_file():
            return self._send_error_json(HTTPStatus.NOT_FOUND, "File not found.")
        data = file_path.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _send_json(self, payload: dict[str, object] | list[object], status: HTTPStatus = HTTPStatus.OK) -> None:
        data = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _send_error_json(self, status: HTTPStatus, message: str) -> None:
        self._send_json({"error": message}, status=status)


def run_server() -> None:
    host = os.environ.get("PADDLING_APP_HOST", "127.0.0.1")
    port = int(os.environ.get("PADDLING_APP_PORT", "8000"))
    httpd = ThreadingHTTPServer((host, port), AppHandler)
    print(f"Paddling Route Planner listening on http://{host}:{port}")
    httpd.serve_forever()


def _guess_content_type(suffix: str) -> str:
    return {
        ".css": "text/css; charset=utf-8",
        ".js": "application/javascript; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".svg": "image/svg+xml",
    }.get(suffix, "application/octet-stream")
