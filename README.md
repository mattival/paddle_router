# Paddling Route Planner MVP

This is a runnable MVP for the paddling route planner described in the PRD and technical specification.

## What This MVP Includes

- Interactive web UI with a marine-style demo map
- Zoomable and pannable larger map canvas
- Start point, end point, and draggable waypoints
- Forecast wind mode and manual wind override
- Wind direction visualization in the UI and on the map
- Water-only routing over a built-in mock archipelago
- Boating channel avoidance and perpendicular crossing preference
- Shelter-aware and crosswind-aware route scoring with improved upwind cover checks
- Route exposure visualization
- Distance and estimated travel time summary
- Mobile-friendly responsive layout

## Why The MVP Uses Mock Data

The workspace did not include marine datasets or a JavaScript build toolchain, so this version is designed to run immediately with Python alone. It uses:

- a built-in demo archipelago map
- mock boating channels
- a deterministic mock wind forecast service

The code structure is modular so real map tiles, weather APIs, and marine datasets can replace the mock providers later.

## Run Locally On Windows Or Linux

From the project root:

```powershell
python -m app.main
```

Then open:

```text
http://127.0.0.1:8000
```

You can change the bind address with environment variables:

- `PADDLING_APP_HOST`
- `PADDLING_APP_PORT`

Example:

```powershell
$env:PADDLING_APP_HOST="0.0.0.0"
$env:PADDLING_APP_PORT="8080"
python -m app.main
```

## Deploy To Internal Linux

This MVP can be deployed to a Linux server as-is because it only requires Python 3.11+.

Example:

```bash
export PADDLING_APP_HOST=0.0.0.0
export PADDLING_APP_PORT=8000
python -m app.main
```

You can place it behind your normal reverse proxy such as Nginx or an internal load balancer.

## Project Structure

- `app/main.py` starts the server
- `app/server.py` serves the API and static UI
- `app/services/routing.py` contains the routing engine
- `app/services/wind.py` contains wind logic
- `app/services/mock_marine_data.py` contains demo land and channel data
- `app/static/` contains the frontend

## Suggested Next Steps

- Replace the mock marine provider with real coastline, water, and fairway data
- Replace the mock wind forecast with a real weather API
- Swap the SVG demo map for a real tile-based map frontend
- Move the server to FastAPI once dependencies are available

## Change Management

This repository now includes a lightweight documented change workflow:

- Workflow guide: `docs/git-change-workflow.md`
- Template: `docs/change-requests/change-request-template.md`
- Current baseline record: `docs/change-requests/CR-000-baseline-mvp.md`
- Active enhancement record: `docs/change-requests/CR-001-map-wind-coverage.md`

Use that flow for significant feature, scope, API, or routing changes so the documentation and code stay aligned.
