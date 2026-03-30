from __future__ import annotations

from datetime import UTC, datetime
import math

from app.models import LatLng, WindSettings


class WindService:
    def get_effective_wind(self, wind: WindSettings, point: LatLng) -> dict[str, object]:
        if wind.mode == "manual" and wind.direction_deg is not None and wind.speed_mps is not None:
            return {
                "source": "manual",
                "direction_deg": wind.direction_deg % 360.0,
                "speed_mps": max(0.0, wind.speed_mps),
                "forecast_valid_at": None,
            }
        return self.get_forecast(point)

    def get_forecast(self, point: LatLng) -> dict[str, object]:
        now = datetime.now(UTC).replace(microsecond=0)
        seed = (point.lat * 17.0) + (point.lng * 23.0)
        direction = (215.0 + math.sin(seed) * 45.0 + math.cos(seed / 3.0) * 22.0) % 360.0
        speed = max(2.0, 6.5 + math.sin(seed / 5.0) * 1.8 + math.cos(seed / 9.0) * 1.2)
        return {
            "source": "forecast",
            "direction_deg": round(direction, 1),
            "speed_mps": round(speed, 1),
            "forecast_valid_at": now.isoformat().replace("+00:00", "Z"),
        }
