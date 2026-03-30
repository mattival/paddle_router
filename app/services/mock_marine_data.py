from __future__ import annotations

from dataclasses import dataclass

from app.models import LatLng
from app.services.geometry import point_in_polygon


@dataclass
class Channel:
    name: str
    start: LatLng
    end: LatLng
    width_m: float
    direction_deg: float

    def to_dict(self) -> dict[str, object]:
        return {
            "name": self.name,
            "start": {"lat": self.start.lat, "lng": self.start.lng},
            "end": {"lat": self.end.lat, "lng": self.end.lng},
            "width_m": self.width_m,
            "direction_deg": self.direction_deg,
        }


class MockMarineDataProvider:
    def __init__(self) -> None:
        self.bbox = {
            "south": 60.105,
            "west": 24.84,
            "north": 60.235,
            "east": 25.08,
        }
        self.land_polygons = [
            [
                LatLng(60.207, 24.867),
                LatLng(60.226, 24.891),
                LatLng(60.218, 24.916),
                LatLng(60.196, 24.905),
                LatLng(60.192, 24.879),
            ],
            [
                LatLng(60.156, 24.932),
                LatLng(60.181, 24.947),
                LatLng(60.177, 24.978),
                LatLng(60.148, 24.981),
                LatLng(60.142, 24.952),
            ],
            [
                LatLng(60.191, 24.988),
                LatLng(60.205, 25.004),
                LatLng(60.196, 25.026),
                LatLng(60.175, 25.021),
                LatLng(60.176, 24.997),
            ],
            [
                LatLng(60.122, 24.876),
                LatLng(60.143, 24.889),
                LatLng(60.138, 24.912),
                LatLng(60.116, 24.904),
            ],
            [
                LatLng(60.128, 25.006),
                LatLng(60.145, 25.019),
                LatLng(60.139, 25.043),
                LatLng(60.117, 25.037),
                LatLng(60.115, 25.016),
            ],
            [
                LatLng(60.171, 24.862),
                LatLng(60.180, 24.875),
                LatLng(60.171, 24.892),
                LatLng(60.158, 24.883),
            ],
        ]
        self.channels = [
            Channel(
                name="West Fairway",
                start=LatLng(60.111, 24.913),
                end=LatLng(60.229, 24.972),
                width_m=220.0,
                direction_deg=28.0,
            ),
            Channel(
                name="East Fairway",
                start=LatLng(60.118, 24.985),
                end=LatLng(60.224, 25.056),
                width_m=180.0,
                direction_deg=35.0,
            ),
        ]

    def point_on_water(self, point: LatLng) -> bool:
        if not self.point_in_bounds(point):
            return False
        return not any(point_in_polygon(point, polygon) for polygon in self.land_polygons)

    def point_in_bounds(self, point: LatLng) -> bool:
        return (
            self.bbox["south"] <= point.lat <= self.bbox["north"]
            and self.bbox["west"] <= point.lng <= self.bbox["east"]
        )

    def get_map_payload(self) -> dict[str, object]:
        return {
            "bbox": self.bbox,
            "landPolygons": [
                [{"lat": point.lat, "lng": point.lng} for point in polygon] for polygon in self.land_polygons
            ],
            "channels": [channel.to_dict() for channel in self.channels],
            "demoNotes": [
                "This MVP uses a built-in demo archipelago instead of live marine datasets.",
                "Routing logic is real but data is mocked so the app runs end-to-end without external services.",
            ],
        }
