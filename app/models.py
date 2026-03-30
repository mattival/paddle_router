from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass
class LatLng:
    lat: float
    lng: float

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> "LatLng":
        return cls(lat=float(payload["lat"]), lng=float(payload["lng"]))


@dataclass
class WindSettings:
    mode: str
    direction_deg: float | None = None
    speed_mps: float | None = None

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> "WindSettings":
        return cls(
            mode=str(payload.get("mode", "forecast")),
            direction_deg=_optional_float(payload.get("direction_deg")),
            speed_mps=_optional_float(payload.get("speed_mps")),
        )


@dataclass
class RoutingWeights:
    directness: float = 1.0
    shelter: float = 2.0
    crosswind_avoidance: float = 2.5
    channel_avoidance: float = 3.0
    channel_crossing_perpendicularity: float = 2.0
    shoreline_following: float = 1.0

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> "RoutingWeights":
        defaults = cls()
        values = asdict(defaults)
        for key in list(values):
            if key in payload:
                values[key] = float(payload[key])
        return cls(**values)


@dataclass
class RouteRequest:
    start: LatLng
    end: LatLng
    waypoints: list[LatLng]
    wind: WindSettings
    weights: RoutingWeights
    paddling_speed_kph: float = 5.0

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> "RouteRequest":
        return cls(
            start=LatLng.from_dict(payload["start"]),
            end=LatLng.from_dict(payload["end"]),
            waypoints=[LatLng.from_dict(item) for item in payload.get("waypoints", [])],
            wind=WindSettings.from_dict(payload.get("wind", {})),
            weights=RoutingWeights.from_dict(payload.get("weights", {})),
            paddling_speed_kph=float(payload.get("paddling_speed_kph", 5.0)),
        )


@dataclass
class SegmentDiagnostics:
    index: int
    distance_m: float
    bearing_deg: float
    wind_relative_angle_deg: float
    exposure_score: float
    shelter_score: float
    channel_crossing: bool

    def to_dict(self) -> dict[str, Any]:
        return {
            "index": self.index,
            "distance_m": round(self.distance_m, 1),
            "bearing_deg": round(self.bearing_deg, 1),
            "wind_relative_angle_deg": round(self.wind_relative_angle_deg, 1),
            "exposure_score": round(self.exposure_score, 3),
            "shelter_score": round(self.shelter_score, 3),
            "channel_crossing": self.channel_crossing,
        }


@dataclass
class RouteResponse:
    route: dict[str, Any]
    segments: list[SegmentDiagnostics]
    summary: dict[str, Any]
    warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "route": self.route,
            "segments": [segment.to_dict() for segment in self.segments],
            "summary": self.summary,
            "warnings": self.warnings,
        }


def _optional_float(value: Any) -> float | None:
    if value in (None, ""):
        return None
    return float(value)
