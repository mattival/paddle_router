from __future__ import annotations

import math
from typing import Iterable

from app.models import LatLng

EARTH_RADIUS_M = 6_371_000.0


def clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def lerp(start: float, end: float, t: float) -> float:
    return start + (end - start) * t


def haversine_distance_m(a: LatLng, b: LatLng) -> float:
    lat1 = math.radians(a.lat)
    lat2 = math.radians(b.lat)
    d_lat = lat2 - lat1
    d_lng = math.radians(b.lng - a.lng)
    sin_dlat = math.sin(d_lat / 2.0)
    sin_dlng = math.sin(d_lng / 2.0)
    root = sin_dlat**2 + math.cos(lat1) * math.cos(lat2) * sin_dlng**2
    return 2.0 * EARTH_RADIUS_M * math.asin(math.sqrt(root))


def bearing_deg(a: LatLng, b: LatLng) -> float:
    lat1 = math.radians(a.lat)
    lat2 = math.radians(b.lat)
    d_lng = math.radians(b.lng - a.lng)
    y = math.sin(d_lng) * math.cos(lat2)
    x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(d_lng)
    return (math.degrees(math.atan2(y, x)) + 360.0) % 360.0


def relative_angle_deg(bearing: float, wind_from_deg: float) -> float:
    wind_to_deg = (wind_from_deg + 180.0) % 360.0
    delta = abs(((bearing - wind_to_deg + 180.0) % 360.0) - 180.0)
    return delta


def midpoint(a: LatLng, b: LatLng) -> LatLng:
    return LatLng(lat=(a.lat + b.lat) / 2.0, lng=(a.lng + b.lng) / 2.0)


def project_point(origin: LatLng, distance_m: float, bearing_from_north_deg: float) -> LatLng:
    bearing = math.radians(bearing_from_north_deg)
    lat1 = math.radians(origin.lat)
    lng1 = math.radians(origin.lng)
    angular_distance = distance_m / EARTH_RADIUS_M

    lat2 = math.asin(
        math.sin(lat1) * math.cos(angular_distance)
        + math.cos(lat1) * math.sin(angular_distance) * math.cos(bearing)
    )
    lng2 = lng1 + math.atan2(
        math.sin(bearing) * math.sin(angular_distance) * math.cos(lat1),
        math.cos(angular_distance) - math.sin(lat1) * math.sin(lat2),
    )
    return LatLng(lat=math.degrees(lat2), lng=math.degrees(lng2))


def point_in_polygon(point: LatLng, polygon: list[LatLng]) -> bool:
    inside = False
    j = len(polygon) - 1
    for i, vertex in enumerate(polygon):
        xi = vertex.lng
        yi = vertex.lat
        xj = polygon[j].lng
        yj = polygon[j].lat
        intersects = ((yi > point.lat) != (yj > point.lat)) and (
            point.lng < (xj - xi) * (point.lat - yi) / ((yj - yi) or 1e-12) + xi
        )
        if intersects:
            inside = not inside
        j = i
    return inside


def ccw(a: LatLng, b: LatLng, c: LatLng) -> bool:
    return (c.lat - a.lat) * (b.lng - a.lng) > (b.lat - a.lat) * (c.lng - a.lng)


def segments_intersect(a1: LatLng, a2: LatLng, b1: LatLng, b2: LatLng) -> bool:
    return ccw(a1, b1, b2) != ccw(a2, b1, b2) and ccw(a1, a2, b1) != ccw(a1, a2, b2)


def segment_intersects_polygon(a: LatLng, b: LatLng, polygon: list[LatLng]) -> bool:
    if point_in_polygon(a, polygon) or point_in_polygon(b, polygon):
        return True
    for start, end in polygon_edges(polygon):
        if segments_intersect(a, b, start, end):
            return True
    return False


def polygon_edges(polygon: list[LatLng]) -> Iterable[tuple[LatLng, LatLng]]:
    for index in range(len(polygon)):
        yield polygon[index], polygon[(index + 1) % len(polygon)]


def distance_point_to_segment_m(point: LatLng, start: LatLng, end: LatLng) -> float:
    px, py = to_local_xy(point, point)
    ax, ay = to_local_xy(start, point)
    bx, by = to_local_xy(end, point)
    abx = bx - ax
    aby = by - ay
    ab_len_sq = abx * abx + aby * aby
    if ab_len_sq == 0:
        return math.hypot(px - ax, py - ay)
    t = clamp(((px - ax) * abx + (py - ay) * aby) / ab_len_sq, 0.0, 1.0)
    closest_x = ax + t * abx
    closest_y = ay + t * aby
    return math.hypot(px - closest_x, py - closest_y)


def to_local_xy(point: LatLng, origin: LatLng) -> tuple[float, float]:
    lat_scale = 111_320.0
    lng_scale = math.cos(math.radians(origin.lat)) * 111_320.0
    return (
        (point.lng - origin.lng) * lng_scale,
        (point.lat - origin.lat) * lat_scale,
    )


def polyline_distance_m(points: list[LatLng]) -> float:
    return sum(haversine_distance_m(points[index], points[index + 1]) for index in range(len(points) - 1))
