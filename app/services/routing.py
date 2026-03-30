from __future__ import annotations

from dataclasses import dataclass
import heapq
import math

from app.models import LatLng, RouteRequest, RouteResponse, SegmentDiagnostics
from app.services.geometry import (
    bearing_deg,
    clamp,
    distance_point_to_segment_m,
    haversine_distance_m,
    midpoint,
    point_in_polygon,
    polyline_distance_m,
    project_point,
    relative_angle_deg,
    segment_intersects_polygon,
)
from app.services.mock_marine_data import Channel, MockMarineDataProvider
from app.services.wind import WindService


@dataclass
class Node:
    index: int
    point: LatLng


@dataclass
class EdgeFeatures:
    distance_m: float
    bearing_deg: float
    wind_relative_angle_deg: float
    exposure_score: float
    shelter_score: float
    shoreline_score: float
    channel_travel_penalty: float
    channel_crossing_penalty: float
    channel_crossing: bool


class RoutingError(Exception):
    pass


class Router:
    def __init__(self, provider: MockMarineDataProvider, wind_service: WindService) -> None:
        self.provider = provider
        self.wind_service = wind_service
        self.lat_steps = 34
        self.lng_steps = 48
        self.nodes: dict[tuple[int, int], Node] = {}
        self.point_index: dict[int, tuple[int, int]] = {}
        self.adjacency: dict[int, list[int]] = {}
        self._build_grid_graph()

    def route(self, request: RouteRequest) -> RouteResponse:
        control_points = [request.start, *request.waypoints, request.end]
        for point in control_points:
            if not self.provider.point_in_bounds(point):
                raise RoutingError("Selected point is outside the demo routing area.")
            if not self.provider.point_on_water(point):
                raise RoutingError("Selected point falls on land. Move it to nearby water and try again.")

        effective_wind = self.wind_service.get_effective_wind(request.wind, request.start)
        route_points: list[LatLng] = []
        warnings: list[str] = []

        for leg_start, leg_end in zip(control_points, control_points[1:]):
            leg_points = self._route_leg(leg_start, leg_end, request, effective_wind)
            if route_points and leg_points:
                route_points.extend(leg_points[1:])
            else:
                route_points.extend(leg_points)

        segments = self._build_segment_diagnostics(route_points, request, effective_wind)
        if any(segment.channel_crossing for segment in segments):
            warnings.append("One or more boating channel crossings were required in the computed route.")
        if max((segment.exposure_score for segment in segments), default=0.0) > 0.78:
            warnings.append("Some route segments remain strongly wind-exposed under the current settings.")

        distance_km = polyline_distance_m(route_points) / 1000.0
        travel_time_h = distance_km / max(1.0, request.paddling_speed_kph)
        summary = {
            "distance_km": round(distance_km, 2),
            "estimated_time_h": round(travel_time_h, 2),
            "wind_source": effective_wind["source"],
            "wind_direction_deg": effective_wind["direction_deg"],
            "wind_speed_mps": effective_wind["speed_mps"],
            "forecast_valid_at": effective_wind["forecast_valid_at"],
        }
        return RouteResponse(
            route={
                "type": "LineString",
                "coordinates": [[round(point.lng, 6), round(point.lat, 6)] for point in route_points],
            },
            segments=segments,
            summary=summary,
            warnings=warnings,
        )

    def _route_leg(
        self,
        start: LatLng,
        end: LatLng,
        request: RouteRequest,
        effective_wind: dict[str, object],
    ) -> list[LatLng]:
        start_node = self._nearest_accessible_node(start)
        end_node = self._nearest_accessible_node(end)
        node_path = self._a_star(start_node.index, end_node.index, request, effective_wind)
        if not node_path:
            raise RoutingError("Unable to find a water-only route between selected points.")

        leg_points = [start]
        leg_points.extend(self.nodes_by_index(node_index).point for node_index in node_path)
        leg_points.append(end)
        return self._dedupe_points(leg_points)

    def _build_grid_graph(self) -> None:
        south = self.provider.bbox["south"]
        north = self.provider.bbox["north"]
        west = self.provider.bbox["west"]
        east = self.provider.bbox["east"]

        index = 0
        for row in range(self.lat_steps + 1):
            lat = south + ((north - south) * row / self.lat_steps)
            for col in range(self.lng_steps + 1):
                lng = west + ((east - west) * col / self.lng_steps)
                point = LatLng(lat=lat, lng=lng)
                if self.provider.point_on_water(point):
                    node = Node(index=index, point=point)
                    self.nodes[(row, col)] = node
                    self.point_index[index] = (row, col)
                    self.adjacency[index] = []
                    index += 1

        offsets = [
            (-1, -1),
            (-1, 0),
            (-1, 1),
            (0, -1),
            (0, 1),
            (1, -1),
            (1, 0),
            (1, 1),
        ]
        for (row, col), node in self.nodes.items():
            for d_row, d_col in offsets:
                neighbor_key = (row + d_row, col + d_col)
                if neighbor_key not in self.nodes:
                    continue
                neighbor = self.nodes[neighbor_key]
                if not self._segment_hits_land(node.point, neighbor.point):
                    self.adjacency[node.index].append(neighbor.index)

    def _a_star(
        self,
        start_index: int,
        goal_index: int,
        request: RouteRequest,
        effective_wind: dict[str, object],
    ) -> list[int]:
        frontier: list[tuple[float, int]] = [(0.0, start_index)]
        came_from: dict[int, int | None] = {start_index: None}
        cost_so_far: dict[int, float] = {start_index: 0.0}

        while frontier:
            _, current = heapq.heappop(frontier)
            if current == goal_index:
                break

            for neighbor in self.adjacency[current]:
                current_point = self.nodes_by_index(current).point
                neighbor_point = self.nodes_by_index(neighbor).point
                edge_features = self._score_edge(
                    current_point,
                    neighbor_point,
                    request,
                    effective_wind,
                )
                new_cost = cost_so_far[current] + self._edge_cost(edge_features, request)
                if neighbor not in cost_so_far or new_cost < cost_so_far[neighbor]:
                    cost_so_far[neighbor] = new_cost
                    heuristic = haversine_distance_m(neighbor_point, self.nodes_by_index(goal_index).point) / 1000.0
                    priority = new_cost + heuristic
                    heapq.heappush(frontier, (priority, neighbor))
                    came_from[neighbor] = current

        if goal_index not in came_from:
            return []

        path: list[int] = []
        current = goal_index
        while current is not None:
            path.append(current)
            current = came_from[current]
        path.reverse()
        return path

    def _score_edge(
        self,
        start: LatLng,
        end: LatLng,
        request: RouteRequest,
        effective_wind: dict[str, object],
    ) -> EdgeFeatures:
        distance_m = haversine_distance_m(start, end)
        bearing = bearing_deg(start, end)
        wind_relative = relative_angle_deg(bearing, float(effective_wind["direction_deg"]))
        midpoint_point = midpoint(start, end)
        shelter_score = self._shelter_score(midpoint_point, float(effective_wind["direction_deg"]))
        shoreline_score = self._shoreline_score(midpoint_point)
        speed_factor = clamp(float(effective_wind["speed_mps"]) / 12.0, 0.15, 1.4)
        crosswind_factor = math.sin(math.radians(wind_relative)) ** 2
        exposure_score = clamp(crosswind_factor * speed_factor * (1.05 - 0.65 * shelter_score), 0.0, 1.0)

        channel_travel_penalty = 0.0
        channel_crossing_penalty = 0.0
        channel_crossing = False
        for channel in self.provider.channels:
            relationship = self._channel_relationship(start, end, channel)
            channel_travel_penalty = max(channel_travel_penalty, relationship["travel_penalty"])
            channel_crossing_penalty = max(channel_crossing_penalty, relationship["crossing_penalty"])
            channel_crossing = channel_crossing or relationship["crossing"]

        return EdgeFeatures(
            distance_m=distance_m,
            bearing_deg=bearing,
            wind_relative_angle_deg=wind_relative,
            exposure_score=exposure_score,
            shelter_score=shelter_score,
            shoreline_score=shoreline_score,
            channel_travel_penalty=channel_travel_penalty,
            channel_crossing_penalty=channel_crossing_penalty,
            channel_crossing=channel_crossing,
        )

    def _edge_cost(self, features: EdgeFeatures, request: RouteRequest) -> float:
        base_cost = (features.distance_m / 1000.0) * request.weights.directness
        multiplier = 1.0
        multiplier += request.weights.crosswind_avoidance * features.exposure_score * 0.95
        multiplier += request.weights.channel_avoidance * features.channel_travel_penalty * 1.45
        multiplier += (
            request.weights.channel_crossing_perpendicularity * features.channel_crossing_penalty * 0.8
        )
        multiplier -= request.weights.shelter * features.shelter_score * 0.18
        multiplier -= request.weights.shoreline_following * features.shoreline_score * 0.12
        multiplier = max(0.18, multiplier)
        return base_cost * multiplier

    def _channel_relationship(self, start: LatLng, end: LatLng, channel: Channel) -> dict[str, float | bool]:
        start_offset = distance_point_to_segment_m(start, channel.start, channel.end)
        end_offset = distance_point_to_segment_m(end, channel.start, channel.end)
        mid_offset = distance_point_to_segment_m(midpoint(start, end), channel.start, channel.end)
        half_width = channel.width_m / 2.0
        within_corridor = min(start_offset, end_offset, mid_offset) < half_width
        crossing = self._segments_intersect_channel(start, end, channel)
        angle_diff = abs(((bearing_deg(start, end) - channel.direction_deg + 180.0) % 360.0) - 180.0)
        alignment_penalty = clamp(1.0 - (min(angle_diff, 180.0 - angle_diff) / 90.0), 0.0, 1.0)
        crossing_perpendicularity = abs(90.0 - min(angle_diff, 180.0 - angle_diff)) / 90.0

        travel_penalty = alignment_penalty if within_corridor else 0.0
        if within_corridor and not crossing:
            travel_penalty = max(travel_penalty, 0.65)
        if crossing:
            travel_penalty = max(travel_penalty, 0.25)
        return {
            "travel_penalty": travel_penalty,
            "crossing_penalty": crossing_perpendicularity if crossing else 0.0,
            "crossing": crossing,
        }

    def _segments_intersect_channel(self, start: LatLng, end: LatLng, channel: Channel) -> bool:
        # Crossing the centerline is enough for this MVP because channels are modeled as directional fairways.
        from app.services.geometry import segments_intersect

        return segments_intersect(start, end, channel.start, channel.end)

    def _shelter_score(self, point: LatLng, wind_from_deg: float) -> float:
        ray_lengths = [250.0, 500.0, 900.0, 1400.0, 1800.0]
        score = 0.0
        for distance_m in ray_lengths:
            sample = project_point(point, distance_m, wind_from_deg)
            if any(point_in_polygon(sample, polygon) for polygon in self.provider.land_polygons):
                score = max(score, 1.0 - (distance_m / 2000.0))
        return clamp(score, 0.0, 1.0)

    def _shoreline_score(self, point: LatLng) -> float:
        nearest = math.inf
        for polygon in self.provider.land_polygons:
            for index in range(len(polygon)):
                start = polygon[index]
                end = polygon[(index + 1) % len(polygon)]
                nearest = min(nearest, distance_point_to_segment_m(point, start, end))
        if nearest == math.inf:
            return 0.0
        if nearest <= 180.0:
            return 1.0
        if nearest >= 1200.0:
            return 0.0
        return clamp(1.0 - ((nearest - 180.0) / 1020.0), 0.0, 1.0)

    def _nearest_accessible_node(self, point: LatLng) -> Node:
        ranked = sorted(self.nodes.values(), key=lambda node: haversine_distance_m(point, node.point))
        for node in ranked[:24]:
            if not self._segment_hits_land(point, node.point):
                return node
        raise RoutingError("Unable to connect one of the selected points to the water routing graph.")

    def _segment_hits_land(self, start: LatLng, end: LatLng) -> bool:
        return any(segment_intersects_polygon(start, end, polygon) for polygon in self.provider.land_polygons)

    def _build_segment_diagnostics(
        self,
        points: list[LatLng],
        request: RouteRequest,
        effective_wind: dict[str, object],
    ) -> list[SegmentDiagnostics]:
        segments: list[SegmentDiagnostics] = []
        for index in range(len(points) - 1):
            features = self._score_edge(points[index], points[index + 1], request, effective_wind)
            segments.append(
                SegmentDiagnostics(
                    index=index,
                    distance_m=features.distance_m,
                    bearing_deg=features.bearing_deg,
                    wind_relative_angle_deg=features.wind_relative_angle_deg,
                    exposure_score=features.exposure_score,
                    shelter_score=features.shelter_score,
                    channel_crossing=features.channel_crossing,
                )
            )
        return segments

    def nodes_by_index(self, index: int) -> Node:
        row, col = self.point_index[index]
        return self.nodes[(row, col)]

    def _dedupe_points(self, points: list[LatLng]) -> list[LatLng]:
        deduped: list[LatLng] = []
        for point in points:
            if not deduped:
                deduped.append(point)
                continue
            if haversine_distance_m(point, deduped[-1]) > 1.0:
                deduped.append(point)
        return deduped
