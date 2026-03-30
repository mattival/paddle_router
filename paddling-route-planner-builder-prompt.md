# Paddling Route Planner Builder Prompt

Use this prompt to generate a complete MVP web application.

## Prompt

Build a production-quality MVP web application called `Paddling Route Planner`.

The app is a mobile-friendly web-based route planning tool for kayakers and other paddlers. The main purpose is to help users plan safer and more comfortable routes over water between a start point and an end point, optionally including custom waypoints. The app must not behave like a generic shortest-path map. It must make routing decisions based on paddling-specific factors, especially wind exposure, shelter from islands and shorelines, and avoidance of boating channels.

### Product Goals

- Make route planning easy directly on a map
- Prefer safer and more sheltered paddling routes over purely shortest routes
- Use forecasted wind by default
- Allow manual wind override
- Show route exposure visually
- Work well on mobile devices

### Core User Experience

Create a clean, mobile-first interface with:

- A full-screen interactive map as the primary surface
- A compact bottom sheet or side panel for settings
- Clear controls for selecting:
  - start point
  - end point
  - optional waypoints
- Route results displayed directly on the map
- A simple trip summary area showing:
  - total distance
  - estimated travel time
  - wind source and values

The UI should feel intentional, polished, and touch-friendly. It should work well on both desktop and mobile, but mobile is the priority.

### Required Features

Implement the following:

1. Map-based route definition
- User can select a start point and an end point on the map
- User can add, move, and remove custom waypoints
- Route updates when points change

2. Wind input
- By default, fetch forecasted wind direction and wind speed for the route area
- Allow the user to switch to manual wind mode
- In manual mode, allow entry of wind direction and speed

3. Automatic routing
- Route must stay on water
- Route must avoid land
- Route should avoid boating channels whenever practical
- If a boating channel must be crossed, the crossing should be as perpendicular to the channel as feasible
- Route should prefer sheltered water in the lee of islands and shoreline relative to wind direction
- Route should avoid long exposed segments with strong crosswinds
- Direct tailwind and direct headwind are generally preferable to equivalent crosswind exposure
- Routing must support adjustable weighting factors

4. Visualization
- Draw the computed route on the map
- Visualize wind load or exposure along the route
- Clearly distinguish boating channels if channel data is available
- Show warnings for unavoidable exposed sections or channel crossings

5. Summary metrics
- Show total distance
- Show estimated travel time based on a configurable paddling speed

6. Mobile-friendly design
- Responsive layout
- Touch-friendly controls
- Bottom-sheet or compact settings panel on small screens

### Technical Constraints

- Use a Python backend for routing and calculations
- Use Python geospatial tools for route computation
- Separate frontend map/UI concerns from backend routing logic
- Return enough routing diagnostics to explain why the route was chosen

### Recommended Tech Stack

Use this stack unless there is a strong reason to improve it:

- Frontend:
  - React
  - TypeScript
  - MapLibre GL JS
  - Tailwind CSS
- Backend:
  - Python 3.11+
  - FastAPI
  - GeoPandas
  - Shapely
  - NetworkX
  - PyProj
  - NumPy

### Routing Engine Requirements

Implement a graph-based or cost-surface-assisted routing engine in Python.

The route cost should combine these factors:

- distance or travel time
- shelter preference
- crosswind avoidance
- boating channel avoidance
- channel crossing perpendicularity
- shoreline-following preference
- penalty for long exposed segments

Use adjustable weights for these factors.

At a minimum, compute per-segment properties such as:

- segment distance
- route bearing
- relative wind angle
- exposure score
- shelter score
- whether the segment crosses a boating channel

### Wind Logic

For each route segment:

- compute segment bearing
- compare it with wind direction
- heavily penalize crosswinds
- penalize long unsheltered crosswind sections more strongly
- prefer equivalent headwind or tailwind over equivalent crosswind when other factors are similar

### Shelter Logic

Implement a simplified but explainable shelter model.

Preferred behavior:

- segments protected by upwind islands or shoreline should score as more sheltered
- open-water segments exposed to wind fetch should score as less sheltered

Use a practical MVP approach that is fast enough for interactive recalculation.

### Boating Channel Logic

- represent boating channels explicitly in routing
- strongly discourage traveling along them
- allow crossings when necessary
- prefer crossings that are near perpendicular to the local channel direction
- discourage long diagonal movement inside channels

### Backend API

Create at least these endpoints:

1. `POST /api/route`
- Accepts start point, end point, optional waypoints, wind settings, routing weights, and paddling speed
- Returns:
  - route geometry
  - segment-level diagnostics
  - total distance
  - estimated travel time
  - warnings

2. `GET /api/wind`
- Returns forecast wind data for a given location or map area

### Suggested Route Request Shape

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

### Suggested Route Response Shape

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
    "wind_source": "forecast"
  },
  "warnings": [
    "One unavoidable boating channel crossing detected."
  ]
}
```

### Data Requirements

Design the app so data providers can be swapped.

The solution should support these data categories:

- water polygons or water mask
- land polygons
- coastline and island geometry
- boating channel geometry
- wind forecast data

You may use placeholder or mock data adapters if real providers are not wired yet, but structure the code so real sources can be added cleanly.

### MVP Delivery Requirements

Generate:

- a working frontend
- a working Python backend
- a clear project structure
- typed request and response models
- sample routing logic that is modular and replaceable
- a clean responsive UI
- comments only where they add real clarity

### Code Quality Requirements

- Keep the routing engine modular
- Keep data provider logic separate from routing logic
- Use clear naming and readable abstractions
- Make the route scoring explainable
- Favor practical MVP completeness over premature complexity

### Acceptance Criteria

The generated app should satisfy all of the following:

- user can define a route using start and end points on the map
- user can add and edit waypoints
- route never crosses land
- route responds to wind settings
- route tries to avoid boating channels
- channel crossings are treated differently from channel-following movement
- exposure is visualized on the map
- total distance and ETA are displayed
- app is usable on a phone-sized screen

### Output Expectations

Generate the full app with:

- frontend code
- backend code
- setup instructions
- environment variable examples
- sample/mock data strategy if real marine datasets are not included

If any geospatial or forecast provider is unavailable, implement the architecture with a clear mock provider so the app still runs end-to-end.

## Related Project Docs

Use these as the source product and technical references:

- PRD: `paddling-route-planner-prd.md`
- Technical spec: `paddling-route-planner-spec.md`
