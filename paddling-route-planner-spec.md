# Paddling Route Planner Specification

## 1. Product Overview

Build a mobile-friendly web application for planning paddling routes between a user-selected start point and end point, with optional intermediate waypoints. The application must generate safe and practical routes over water while accounting for wind conditions, land shelter, boating channels, and route efficiency.

The app is intended for kayakers and other paddlers who want route suggestions that are safer and more comfortable than a simple shortest-path line.

The application should use Python-based tools and services for all routing, spatial analysis, and wind-exposure calculations.

## 2. Goals

- Let users create paddling routes directly on an interactive map.
- Produce routes that stay on water and reflect paddling-specific safety preferences.
- Incorporate forecasted or manually entered wind conditions into route planning.
- Visualize route geometry and wind exposure clearly on mobile and desktop.
- Provide practical trip metrics including total distance and estimated travel time.

## 3. Non-Goals

- Turn-by-turn voice navigation.
- Real-time GPS tracking during the trip.
- Social sharing or community route libraries in the first version.
- Full nautical chart replacement for professional marine navigation.
- Tidal, current, wave, or weather hazard modeling beyond wind in the first version.

## 4. Target Users

- Recreational kayakers planning day trips.
- Touring paddlers who want safer crossings and more sheltered routes.
- Mobile-first users planning on the go.

## 5. Core User Stories

- As a user, I want to tap a map to choose a start point and end point so I can quickly create a route.
- As a user, I want to add, move, and remove waypoints so I can shape the route manually.
- As a user, I want the app to fetch forecasted wind direction and speed by default so route planning reflects current conditions.
- As a user, I want to override wind direction and speed manually so I can test scenarios or use my own weather judgment.
- As a user, I want the generated route to stay on water, avoid boating channels when possible, and cross channels safely when needed.
- As a user, I want routes to prefer sheltered water near islands and shorelines when wind is unfavorable.
- As a user, I want adjustable routing weights so I can prioritize safety, shelter, or directness differently.
- As a user, I want to see wind load along the route so I can understand where conditions may be harder or riskier.
- As a user, I want total distance and estimated paddling time so I can judge trip feasibility.
- As a user on mobile, I want a clear interface that works well with touch controls.

## 6. Functional Requirements

### 6.1 Map Interaction

- Display an interactive map centered on the user’s last viewed area or a default region.
- Allow the user to set:
  - Start point
  - End point
  - Zero or more custom waypoints
- Allow drag-and-drop editing of all selected points.
- Allow insertion of waypoints between existing route points.
- Allow deletion of waypoints.
- Show the final computed route as a highlighted polyline.

### 6.2 Wind Input

- By default, fetch forecasted wind direction and wind speed for the route area.
- Show the source timestamp and forecast validity time if available.
- Allow the user to switch to manual mode.
- In manual mode, allow entry of:
  - Wind direction in degrees
  - Wind speed in m/s, km/h, or knots
- Convert manual inputs internally to a normalized unit system.

### 6.3 Automatic Routing

- The route must remain inside navigable water polygons.
- The route must avoid boating channels whenever a reasonable alternative exists.
- If crossing a boating channel is necessary, the crossing angle should be as close to perpendicular as feasible.
- The route should prefer segments sheltered by islands or shoreline relative to current wind direction.
- The route should penalize long exposed sections with strong crosswinds.
- Direct headwind and direct tailwind should generally be preferred over equivalent crosswind exposure, if all other factors are similar.
- Routing behavior must support adjustable weighting factors.
- Routing must recompute when:
  - Start/end points change
  - Waypoints change
  - Wind mode or values change
  - Weighting settings change

### 6.4 Route Metrics and Visualization

- Display total route distance.
- Display estimated travel time based on configurable average paddling speed.
- Visualize wind load along the route using a clear styling method such as:
  - Segment coloring
  - Heat overlay
  - Exposure score markers
- Distinguish boating channels visually on the map.
- Optionally show detected channel crossings and their crossing angle quality.

### 6.5 Mobile UX

- The UI must be responsive and optimized for narrow screens.
- Core actions must be possible with one hand and touch input.
- The route settings panel should work as a bottom sheet or compact drawer on mobile.
- Map interaction and settings must remain usable without precise mouse input.

## 7. Routing Logic Specification

### 7.1 Routing Approach

Use a graph-based routing engine implemented in Python.

Suggested approach:

1. Build or derive a water-only navigation graph from geospatial data.
2. Remove or heavily penalize land cells and non-water barriers.
3. Represent boating channels as special cost zones or crossing constraints.
4. Compute route cost using a weighted multi-factor scoring model.
5. Run shortest-path search such as A* or Dijkstra over the weighted graph.

Suitable Python libraries may include:

- `geopandas`
- `shapely`
- `networkx`
- `pyproj`
- `rasterio` if raster cost surfaces are used
- `scipy` or `numpy` for geometric and numeric operations
- `xarray` if forecast gridded weather data is consumed

### 7.2 Cost Function

Each candidate segment or edge should have a total cost computed from weighted sub-costs:

`total_cost = distance_cost + shelter_cost + crosswind_cost + channel_cost + crossing_penalty + shoreline_proximity_cost + waypoint_constraint_cost`

Required cost components:

- `distance_cost`
  - Base travel distance or time cost.
- `shelter_cost`
  - Lower cost when islands or land shield the segment from wind.
- `crosswind_cost`
  - Higher cost for wind angles close to 90 degrees relative to travel direction.
- `head_tail_preference`
  - Lower penalty for near-0 degree or near-180 degree relative wind angles than for crosswinds of similar strength.
- `channel_cost`
  - High penalty for traveling along boating channels.
- `crossing_penalty`
  - Additional penalty when a channel crossing deviates from perpendicular.
- `exposure_length_penalty`
  - Extra penalty for long continuous unsheltered segments.
- `shoreline_proximity_cost`
  - Configurable component to encourage sheltered near-shore travel without forcing unrealistic zig-zagging.

The implementation may fold some of these into fewer terms, but the user-facing behavior must match the above.

### 7.3 Wind Angle Model

For each segment:

- Compute route bearing.
- Compute relative wind angle between wind direction and route bearing.
- Classify exposure roughly as:
  - Tailwind favorable
  - Headwind acceptable or moderately penalized
  - Quartering wind moderately penalized
  - Crosswind heavily penalized
- Scale penalties by wind speed.

Example design rule:

- Strong crosswinds should be penalized more heavily than equally strong headwinds or tailwinds.

### 7.4 Shelter Model

The shelter calculation should estimate whether upwind land masses or islands reduce wind exposure on a segment.

Possible implementation strategies:

- Vector-based:
  - Cast rays upwind from route segments and measure whether land interrupts wind fetch.
- Raster-based:
  - Generate a directional shelter/exposure surface from land-water geometry and wind direction.

Preferred first-version behavior:

- Use a simplified but explainable shelter model that is fast enough for interactive recalculation.

### 7.5 Boating Channel Handling

- Boating channels must be represented explicitly in the routing model.
- Travel within channel zones should carry a high penalty.
- Crossing is allowed when necessary.
- Crossing segments should be scored based on angle to the local channel direction.
- Crossings closest to 90 degrees should have the lowest crossing penalty.
- Long diagonal travel inside a channel should be strongly discouraged.

## 8. User-Adjustable Settings

Provide a compact settings panel with the following controls:

- Wind source:
  - Forecast
  - Manual
- Manual wind direction
- Manual wind speed
- Average paddling speed for ETA
- Routing weights:
  - Route directness
  - Shelter preference
  - Crosswind avoidance
  - Boating channel avoidance
  - Channel crossing perpendicularity preference
  - Shoreline-following preference

Weight controls should be understandable to non-expert users. Use sliders with labels such as Low, Medium, High or numeric values with helper text.

## 9. Data Requirements

### 9.1 Required Geospatial Data

- Water polygons or water mask
- Land polygons
- Boating channel geometries
- Coastline and island geometry

### 9.2 Required Weather Data

- Forecasted wind direction and speed for the map region
- Forecast time metadata

### 9.3 Data Source Expectations

The implementation should use replaceable providers so the app is not tightly coupled to one data vendor.

Examples of provider categories:

- Base maps: MapLibre-compatible tile source or similar
- Water and land geometry: OpenStreetMap-derived or official geospatial datasets
- Boating channels: official nautical/open marine datasets where available
- Weather: a forecast API that provides wind vectors by location and time

## 10. Suggested System Architecture

### 10.1 Frontend

Recommended:

- Web app optimized for mobile and desktop
- React, Vue, or similar component framework
- Map rendering with MapLibre GL JS or Leaflet

Frontend responsibilities:

- Map rendering and user interaction
- Display of route and wind exposure styling
- Settings UI
- Calling backend routing APIs
- Showing loading, error, and fallback states

### 10.2 Backend

Recommended:

- Python backend using `FastAPI`

Backend responsibilities:

- Wind data retrieval and normalization
- Geospatial preprocessing
- Route graph construction
- Route optimization
- Route metric calculations
- Exposure scoring

### 10.3 Processing Model

- The frontend sends route request parameters to the backend.
- The backend computes the route and returns:
  - Route geometry
  - Segment-level exposure scores
  - Total distance
  - Estimated time
  - Diagnostics or warnings if routing quality is limited

## 11. API Specification

### 11.1 `POST /api/route`

Request body:

```json
{
  "start": { "lat": 60.123, "lng": 24.123 },
  "end": { "lat": 60.456, "lng": 24.456 },
  "waypoints": [
    { "lat": 60.200, "lng": 24.200 }
  ],
  "wind": {
    "mode": "forecast",
    "direction_deg": null,
    "speed_mps": null
  },
  "weights": {
    "directness": 1.0,
    "shelter": 2.0,
    "crosswind_avoidance": 2.5,
    "channel_avoidance": 3.0,
    "channel_crossing_perpendicularity": 2.0,
    "shoreline_following": 1.0
  },
  "paddling_speed_kph": 5.0
}
```

Response body:

```json
{
  "route": {
    "type": "LineString",
    "coordinates": [
      [24.123, 60.123],
      [24.124, 60.124]
    ]
  },
  "segments": [
    {
      "index": 0,
      "distance_m": 240,
      "bearing_deg": 35,
      "wind_relative_angle_deg": 78,
      "exposure_score": 0.81,
      "shelter_score": 0.22,
      "channel_crossing": false
    }
  ],
  "summary": {
    "distance_km": 14.3,
    "estimated_time_h": 2.9,
    "wind_source": "forecast",
    "forecast_valid_at": "2026-03-30T12:00:00Z"
  },
  "warnings": [
    "One unavoidable boating channel crossing detected."
  ]
}
```

### 11.2 `GET /api/wind`

Purpose:

- Return forecasted wind data for a given point or bounding box.

Suggested query parameters:

- `lat`
- `lng`
- optional `bbox`
- optional `time`

## 12. Error Handling Requirements

- If forecast wind data is unavailable, allow manual wind entry without blocking route creation.
- If a complete water-only route cannot be found, return a clear error and, if possible, a best-effort partial diagnostic.
- If input points fall on land, prompt the user to adjust them or snap them to nearest valid water location.
- If data coverage is incomplete in the selected region, show a warning.

## 13. Performance Requirements

- Initial route result should typically return within 2 to 5 seconds for common trip distances.
- Recalculation after weight changes should feel interactive, ideally under 2 seconds for typical routes.
- The app should remain usable on modern mobile browsers.
- Geometry and exposure payloads should be compact enough to render smoothly on mobile networks.

## 14. Accessibility and UX Requirements

- Controls must be touch-friendly.
- Text and map overlays must have sufficient contrast.
- The route line and exposure colors must remain distinguishable for common color-vision deficiencies.
- Important route warnings must not rely on color alone.
- Form controls should have accessible labels.

## 15. Security and Privacy

- No account is required in version 1 unless later added.
- Do not store precise user route data longer than necessary for processing unless the user explicitly saves it.
- Keep third-party API keys server-side.

## 16. MVP Scope

The MVP must include:

- Interactive map
- Start and end point selection
- Optional waypoints
- Forecasted wind retrieval
- Manual wind override
- Water-only route generation
- Boating channel avoidance and perpendicular crossing preference
- Shelter-aware and crosswind-aware routing
- Route display with wind exposure visualization
- Total distance and ETA
- Mobile-friendly UI

The MVP may defer:

- Saved routes
- User accounts
- Multi-day planning
- Offline support
- Advanced marine hazards beyond wind

## 17. Acceptance Criteria

- A user can define start and end points on the map and receive a route.
- A user can add at least three custom waypoints and the route respects waypoint order.
- The route never traverses land.
- The route avoids boating channels when a practical alternative exists.
- If a channel is crossed, the route does not follow the channel diagonally for a long distance.
- Changing wind direction significantly changes route selection in exposed areas when alternative sheltered paths exist.
- Increasing crosswind avoidance weight produces visibly less crosswind-exposed routes in comparable scenarios.
- The map displays route geometry and wind exposure clearly on a mobile viewport.
- The app returns total distance and estimated travel time for each computed route.

## 18. Open Design Decisions

These should be resolved during implementation planning:

- Which specific geospatial datasets will be used for water polygons and boating channels in the target geography.
- Which weather API will be used for forecast wind data.
- Whether the routing graph should be vector-based, raster cost-surface based, or hybrid.
- Whether ETA should be based on a fixed paddling speed only or lightly adjusted by wind exposure.
- Whether the app should support region-specific nautical constraints in later versions.

## 19. Build Guidance for a Generative App Builder

If this specification is used as input to a generative builder, prioritize the following:

- Generate a clean mobile-first web UI with a full-screen map and a compact bottom-sheet settings panel.
- Use a Python backend for all route calculations.
- Keep routing logic modular so cost weights and data providers can be changed independently.
- Separate map display concerns from routing computation concerns.
- Make the routing engine explainable by returning segment-level scoring details.
- Use sensible defaults so the app works immediately without manual tuning.

## 20. Recommended Initial Tech Stack

- Frontend:
  - React
  - TypeScript
  - MapLibre GL JS
  - Tailwind CSS or equivalent responsive UI system
- Backend:
  - Python 3.11+
  - FastAPI
  - GeoPandas
  - Shapely
  - NetworkX
  - PyProj
  - NumPy
- Deployment:
  - Containerized backend
  - Static frontend hosting or integrated web serving

## 21. Summary

This application should deliver paddling-specific route planning rather than generic map routing. The defining capabilities are wind-aware routing, shelter-seeking behavior near islands and shorelines, strong avoidance of boating channels, and meaningful mobile visualization of route exposure and trip metrics.
