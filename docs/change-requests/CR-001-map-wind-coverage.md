# Change Request

## Title

Improve Wind Visualization, Map Detail, And Shelter Accuracy

## ID

`CR-001`

## Date

`2026-03-30`

## Requested By

User request during MVP review

## Current Baseline

- PRD: `paddling-route-planner-prd.md`
- Spec: `paddling-route-planner-spec.md`
- Builder prompt: `paddling-route-planner-builder-prompt.md`
- Current app state: initial Python-served MVP on branch baseline from `main`

## Summary

Improve the MVP so wind direction is clearly visualized, the map is significantly larger and easier to inspect, and route exposure better reflects actual land shelter. The current MVP works functionally, but the map interaction is too constrained and the shelter model can incorrectly mark obviously covered water as exposed.

## Business Or User Reason

Users need to trust both the route visualization and the wind-exposure overlay. If the map is cramped or the exposure overlay appears wrong near clear land cover, confidence in the planner drops quickly.

## Requested Changes

- Visualize wind direction in the UI and on the map
- Make the map larger, more detailed, zoomable, and scrollable/pannable
- Improve shelter scoring so covered sections near land read as less exposed

## In Scope

- Frontend wind-direction visualization
- Larger and more navigable map interaction
- Routing exposure and shelter-model improvements
- Minor supporting UI changes

## Out Of Scope

- Real tile-map provider integration
- Live nautical datasets
- Replacing the demo map with production marine charts

## Product Impact

Users can inspect routes more comfortably, understand wind direction visually, and see exposure coloring that better matches the visible geography.

## Technical Impact

- Frontend map rendering and pointer interaction need to support pan and zoom
- Frontend map rendering will include wind-direction overlays
- Routing logic will use a richer upwind shelter model instead of sparse single-ray sampling

## Files Likely Affected

- `app/static/index.html`
- `app/static/styles.css`
- `app/static/app.js`
- `app/services/routing.py`
- `README.md`

## Risks

- Pan, zoom, and point placement interactions can conflict if not tuned carefully
- Shelter scoring can still be imperfect with mock land geometry

## Dependencies

- Existing mock marine geometry
- Existing route segment diagnostics and route rendering flow

## Acceptance Criteria

- Wind direction is visible in the interface and on the map
- The map supports zooming and panning without breaking point placement
- The usable map area is noticeably larger than before
- Water in the lee of visible land is less likely to be shown as strongly exposed
- Routing and summary behavior continue to work end to end

## Priority

`High`

## Target Release

`MVP`

## Git Implementation Plan

- Suggested branch name: `codex/cr-001-map-wind-coverage`
- Expected commit prefixes: `docs:`, `feat:`, `fix:`
- Pull request title: `CR-001: Improve wind visualization, map interaction, and shelter accuracy`

## Approval

- Requested by:
- Reviewed by:
- Approved by:

## Implementation Notes

Use this change request as the reference document for all code and documentation updates in this branch.
