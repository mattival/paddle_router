# Paddling Route Planner PRD

## 1. Product Summary

The Paddling Route Planner is a web-based map tool that helps paddlers plan safer and more comfortable routes between two points on the water. Unlike generic route planners, it considers wind, shelter from islands and shorelines, and boating channels when suggesting a route.

The product should feel simple and approachable for recreational users while producing route suggestions that reflect paddling-specific judgment.

## 2. Problem Statement

Paddlers often plan routes using generic maps or manual judgment alone. Those tools do not account well for wind exposure, sheltered water, or the need to avoid boating channels. As a result, users may choose routes that are shorter on paper but less safe, less comfortable, or less realistic in actual conditions.

There is a need for a lightweight planning tool that helps users compare route options on the map and better understand how wind and exposure affect the trip.

## 3. Vision

Help paddlers make better route decisions by turning wind-aware, shelter-aware planning into a fast, map-based experience that works well on mobile devices.

## 4. Goals

- Make it easy to create a paddling route by selecting points on a map.
- Suggest routes that are more sheltered and safer than a simple straight line.
- Use forecasted wind automatically while still allowing manual overrides.
- Make route tradeoffs visible through wind exposure visualization.
- Deliver a mobile-friendly experience suitable for field use.

## 5. Non-Goals

- Real-time trip navigation
- Voice guidance
- Social route sharing in the first release
- Professional-grade marine navigation replacement
- Advanced weather and sea-state modeling beyond wind in the first release

## 6. Target Users

### Primary Users

- Recreational kayakers
- Sea kayakers planning day trips
- Mobile users planning outings near the water

### Secondary Users

- Touring paddlers comparing route alternatives
- Safety-conscious users who want to minimize exposed crossings

## 7. User Needs

- I need to quickly define where I want to start and end.
- I need to shape the route through specific places if I choose.
- I need help understanding how wind affects the route.
- I need the route to prefer sheltered water when possible.
- I need warnings around exposed sections and boating channels.
- I need a clear estimate of distance and trip duration.
- I need the interface to work well on a phone.

## 8. Core User Stories

- As a paddler, I want to select a start and end point on a map so I can create a route without typing coordinates.
- As a paddler, I want to add waypoints so I can force the route through places I want to visit or avoid.
- As a paddler, I want the app to use current forecast wind by default so I don’t need to enter weather details manually.
- As a paddler, I want to manually set wind direction and speed so I can test scenarios or use my own assessment.
- As a paddler, I want the route to stay on water and avoid boating channels so the plan better matches safe paddling practice.
- As a paddler, I want the route to prefer sheltered areas behind islands and shorelines so I can reduce wind exposure.
- As a paddler, I want to see which parts of the route are wind-exposed so I can judge whether the trip is suitable.
- As a paddler, I want total distance and estimated time so I can decide whether the trip is realistic.

## 9. Product Principles

- Safety-aware over purely shortest-path behavior
- Simple enough for casual users
- Explainable routing rather than opaque magic
- Mobile-first interaction
- Fast feedback when inputs change

## 10. MVP Scope

### In Scope

- Interactive web map
- Start point and end point selection
- Optional custom waypoints
- Default forecast wind retrieval
- Manual wind direction and speed override
- Automatic route generation over water
- Routing that avoids boating channels where practical
- Preference for perpendicular channel crossings when crossings are necessary
- Preference for sheltered routes relative to wind direction
- Visualization of route and wind load
- Total distance and estimated travel time
- Responsive mobile-friendly UI

### Out of Scope for MVP

- Saved routes
- User accounts
- Offline mode
- Real-time GPS tracking
- Community features
- Wave, tide, and current analysis

## 11. Key Features

### 11.1 Route Planning on Map

Users can tap or click the map to create a route. They can also add custom waypoints to shape the route.

### 11.2 Wind-Aware Routing

The app fetches forecasted wind by default. Users can manually override wind direction and speed if needed.

### 11.3 Shelter-Seeking Routing

Route selection should prefer areas sheltered by islands and land when wind conditions make exposure less desirable.

### 11.4 Boating Channel Avoidance

The route should avoid boating channels when possible and cross them as directly and safely as feasible.

### 11.5 Exposure Visualization

The route should visually communicate wind load so users can see harder or more exposed sections at a glance.

### 11.6 Trip Summary

The app should show total distance and estimated paddling time.

## 12. User Experience Requirements

- The interface should be immediately understandable.
- The map should be the primary interaction surface.
- On mobile, settings should be accessible without covering too much of the map.
- The user should be able to switch between forecast and manual wind input easily.
- Route updates should happen quickly enough to support experimentation.
- The app should explain important warnings clearly, especially channel crossings or exposed sections.

## 13. Success Metrics

### Product Metrics

- Users can create a valid route from start to finish without onboarding.
- Users can successfully adjust wind settings and see route updates.
- Users can understand which route sections are most exposed.
- Users can complete route planning comfortably on mobile devices.

### Quality Metrics

- Route never crosses land.
- Route usually avoids boating channels when a practical alternative exists.
- Route selection changes meaningfully when wind direction changes in exposed geographies.
- Route recomputation feels responsive for typical trip lengths.

## 14. Main User Flow

1. User opens the app and sees a map.
2. User sets a start point and end point.
3. User optionally adds waypoints.
4. App loads forecast wind automatically.
5. App calculates and displays a suggested route.
6. App shows route exposure, total distance, and estimated time.
7. User optionally adjusts wind or routing preferences.
8. App recalculates and updates the route.
9. User reviews the final plan.

## 15. Risks and Unknowns

- Data quality for boating channels may vary by geography.
- Shelter modeling can become technically complex if overdesigned too early.
- Forecast wind data quality and availability may vary by provider.
- Routing quality depends heavily on the quality of water and land geometry.
- There is a tradeoff between route realism and fast interactive recalculation.

## 16. Assumptions

- Users are planning before departure rather than navigating live on the water.
- A fixed average paddling speed is sufficient for ETA in the first release.
- Wind is the most important environmental factor to model in MVP.
- Users will accept a practical route recommendation rather than a mathematically perfect marine model.

## 17. Release Criteria

The MVP is ready when:

- Users can create routes on the map with start, end, and optional waypoints.
- Wind is available from forecast by default and can be manually overridden.
- Routes stay on water and reflect channel avoidance and shelter preference.
- The app clearly visualizes route exposure.
- Distance and estimated time are shown.
- The UI works well on mobile browsers.

## 18. Future Opportunities

- Save and reload routes
- Shareable route links
- Region-specific marine datasets
- Wind timeline selection by forecast hour
- Current, wave, and tide integration
- Difficulty scoring
- Route alternatives comparison
- Export to GPX

## 19. Relationship to Technical Spec

This PRD defines the product intent, target users, user value, and MVP scope. It should be used together with the technical specification for implementation details such as routing logic, APIs, geospatial processing, and backend architecture.
