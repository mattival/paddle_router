const MAP_WIDTH = 2200;
const MAP_HEIGHT = 1600;
const MIN_SCALE = 0.6;
const MAX_SCALE = 2.8;

const state = {
  mapData: null,
  placementMode: "start",
  start: null,
  end: null,
  waypoints: [],
  routeResult: null,
  error: "",
  wind: {
    mode: "forecast",
    direction_deg: null,
    speed_mps: null,
    forecast_valid_at: null,
    source: null,
  },
  paddlingSpeedKph: 5.0,
  weights: {
    directness: 1.0,
    shelter: 2.0,
    crosswind_avoidance: 2.5,
    channel_avoidance: 3.0,
    channel_crossing_perpendicularity: 2.0,
    shoreline_following: 1.0,
  },
  mapScale: 1,
  dragTarget: null,
  pendingRouteTimer: null,
};

const weightMeta = [
  ["directness", "Route Directness", 1.0],
  ["shelter", "Shelter Preference", 2.0],
  ["crosswind_avoidance", "Crosswind Avoidance", 2.5],
  ["channel_avoidance", "Channel Avoidance", 3.0],
  ["channel_crossing_perpendicularity", "Crossing Perpendicularity", 2.0],
  ["shoreline_following", "Shoreline Following", 1.0],
];

const mapSvg = document.getElementById("mapSvg");
const mapScroll = document.getElementById("mapScroll");
const pointList = document.getElementById("pointList");
const distanceValue = document.getElementById("distanceValue");
const etaValue = document.getElementById("etaValue");
const windValue = document.getElementById("windValue");
const sourceValue = document.getElementById("sourceValue");
const warningsList = document.getElementById("warningsList");
const errorBox = document.getElementById("errorBox");
const windMeta = document.getElementById("windMeta");
const mapToast = document.getElementById("mapToast");
const paddlingSpeedInput = document.getElementById("paddlingSpeedInput");
const paddlingSpeedValue = document.getElementById("paddlingSpeedValue");
const manualWindToggle = document.getElementById("manualWindToggle");
const windDirectionInput = document.getElementById("windDirectionInput");
const windSpeedInput = document.getElementById("windSpeedInput");
const weightControls = document.getElementById("weightControls");
const windOverlay = document.getElementById("windOverlay");
const windArrow = document.getElementById("windArrow");
const windOverlayTitle = document.getElementById("windOverlayTitle");
const windOverlayText = document.getElementById("windOverlayText");

document.getElementById("clearRouteButton").addEventListener("click", clearRoute);
document.getElementById("zoomInButton").addEventListener("click", () => zoomMap(1.2));
document.getElementById("zoomOutButton").addEventListener("click", () => zoomMap(1 / 1.2));
document.getElementById("resetViewButton").addEventListener("click", resetView);

document.querySelectorAll(".mode-button").forEach((button) => {
  button.addEventListener("click", () => {
    state.placementMode = button.dataset.mode;
    updateModeButtons();
    showToast(`Tap water to place ${button.textContent.toLowerCase()}.`);
  });
});

manualWindToggle.addEventListener("change", async () => {
  state.wind.mode = manualWindToggle.checked ? "manual" : "forecast";
  toggleWindInputs();
  if (state.wind.mode === "forecast") {
    await refreshForecastWind();
  } else {
    state.wind.direction_deg = parseFloat(windDirectionInput.value || "220");
    state.wind.speed_mps = parseFloat(windSpeedInput.value || "6");
    state.wind.source = "manual";
  }
  queueRouteUpdate();
  render();
});

windDirectionInput.addEventListener("input", () => {
  if (state.wind.mode === "manual") {
    state.wind.direction_deg = parseFloat(windDirectionInput.value || "0");
    render();
    queueRouteUpdate();
  }
});

windSpeedInput.addEventListener("input", () => {
  if (state.wind.mode === "manual") {
    state.wind.speed_mps = parseFloat(windSpeedInput.value || "0");
    render();
    queueRouteUpdate();
  }
});

paddlingSpeedInput.addEventListener("input", () => {
  state.paddlingSpeedKph = parseFloat(paddlingSpeedInput.value);
  paddlingSpeedValue.textContent = `${state.paddlingSpeedKph.toFixed(1)} km/h`;
  queueRouteUpdate();
});

mapSvg.addEventListener("pointerdown", handlePointerDown);
mapSvg.addEventListener("pointermove", handlePointerMove);
mapSvg.addEventListener("pointerup", handlePointerUp);
mapSvg.addEventListener("pointerleave", handlePointerUp);
mapSvg.addEventListener("pointercancel", handlePointerUp);

async function initialize() {
  buildWeightControls();
  updateModeButtons();
  toggleWindInputs();
  paddlingSpeedValue.textContent = `${state.paddlingSpeedKph.toFixed(1)} km/h`;
  const response = await fetch("/api/map-data");
  state.mapData = await response.json();
  render();
  centerMapInitial();
  showToast("Place a start point on open water to begin.");
}

function buildWeightControls() {
  weightControls.innerHTML = "";
  weightMeta.forEach(([key, label, value]) => {
    const row = document.createElement("label");
    row.className = "weight-row";
    row.innerHTML = `
      <div>
        <span>${label}</span>
        <strong id="${key}Value">${value.toFixed(1)}</strong>
      </div>
      <input id="${key}Input" type="range" min="0" max="4" step="0.1" value="${value}" />
    `;
    weightControls.appendChild(row);
    row.querySelector("input").addEventListener("input", (event) => {
      state.weights[key] = parseFloat(event.target.value);
      document.getElementById(`${key}Value`).textContent = event.target.value;
      queueRouteUpdate();
    });
  });
}

function clearRoute() {
  state.start = null;
  state.end = null;
  state.waypoints = [];
  state.routeResult = null;
  state.error = "";
  render();
  updateSummary();
  showToast("Route cleared.");
}

function resetView() {
  state.mapScale = 1;
  applyMapScale();
  centerMapInitial();
}

function centerMapInitial() {
  window.requestAnimationFrame(() => {
    mapScroll.scrollLeft = Math.max(0, (mapScroll.scrollWidth - mapScroll.clientWidth) / 2);
    mapScroll.scrollTop = Math.max(0, (mapScroll.scrollHeight - mapScroll.clientHeight) / 2);
  });
}

function zoomMap(factor) {
  const nextScale = clamp(state.mapScale * factor, MIN_SCALE, MAX_SCALE);
  if (nextScale === state.mapScale) {
    return;
  }

  const centerRatioX = (mapScroll.scrollLeft + (mapScroll.clientWidth / 2)) / Math.max(1, mapScroll.scrollWidth);
  const centerRatioY = (mapScroll.scrollTop + (mapScroll.clientHeight / 2)) / Math.max(1, mapScroll.scrollHeight);

  state.mapScale = nextScale;
  applyMapScale();

  window.requestAnimationFrame(() => {
    mapScroll.scrollLeft = Math.max(0, (mapScroll.scrollWidth * centerRatioX) - (mapScroll.clientWidth / 2));
    mapScroll.scrollTop = Math.max(0, (mapScroll.scrollHeight * centerRatioY) - (mapScroll.clientHeight / 2));
  });
}

function applyMapScale() {
  mapSvg.style.width = `${MAP_WIDTH * state.mapScale}px`;
  mapSvg.style.height = `${MAP_HEIGHT * state.mapScale}px`;
}

function updateModeButtons() {
  document.querySelectorAll(".mode-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === state.placementMode);
  });
}

function toggleWindInputs() {
  const disabled = state.wind.mode !== "manual";
  windDirectionInput.disabled = disabled;
  windSpeedInput.disabled = disabled;
}

function render() {
  renderMap();
  renderPointList();
  updateSummary();
  updateWindOverlay();
}

function renderMap() {
  if (!state.mapData) {
    return;
  }

  const { landPolygons, channels } = state.mapData;
  const fragments = [];
  fragments.push(buildGrid());
  fragments.push(buildContours());
  fragments.push('<text class="chart-water-label" x="60" y="94">Outer Archipelago</text>');
  fragments.push('<text class="chart-water-label" x="1450" y="1340">Sheltered Reach</text>');
  fragments.push(buildWindStreams());

  landPolygons.forEach((polygon) => {
    fragments.push(
      `<polygon class="land-shape" points="${polygon.map((point) => pointToWorld(point).join(",")).join(" ")}" />`,
    );
  });

  channels.forEach((channel) => {
    const [x1, y1] = pointToWorld(channel.start);
    const [x2, y2] = pointToWorld(channel.end);
    fragments.push(`<line class="channel-line" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" />`);
  });

  fragments.push(buildRouteMarkup());
  fragments.push(buildMarkerMarkup());
  mapSvg.innerHTML = fragments.join("");
}

function buildGrid() {
  const lines = [];
  for (let index = 1; index < 12; index += 1) {
    const x = (MAP_WIDTH / 12) * index;
    lines.push(`<line class="grid-line" x1="${x}" y1="0" x2="${x}" y2="${MAP_HEIGHT}" />`);
  }
  for (let index = 1; index < 9; index += 1) {
    const y = (MAP_HEIGHT / 9) * index;
    lines.push(`<line class="grid-line" x1="0" y1="${y}" x2="${MAP_WIDTH}" y2="${y}" />`);
  }
  return lines.join("");
}

function buildContours() {
  const paths = [
    "M 80 1340 C 420 1190, 780 1280, 1120 1160 S 1720 980, 2100 1080",
    "M 140 1120 C 450 980, 790 1020, 1120 940 S 1660 760, 2060 840",
    "M 180 860 C 510 760, 800 760, 1140 690 S 1700 540, 2100 630",
    "M 240 620 C 520 560, 820 530, 1080 460 S 1640 360, 1980 420",
  ];
  return paths.map((path) => `<path class="contour-line" d="${path}" />`).join("");
}

function buildWindStreams() {
  if (state.wind.direction_deg === null) {
    return "";
  }
  const windTo = (state.wind.direction_deg + 180) % 360;
  const rows = [
    [300, 260],
    [620, 420],
    [1020, 620],
    [1380, 830],
    [1760, 1050],
  ];
  return rows
    .map(([x, y], index) => {
      const length = 150 + index * 18;
      const angle = windTo - 90;
      const opacityScale = 0.22 + (index * 0.05);
      return `
        <g transform="translate(${x} ${y}) rotate(${angle})">
          <path class="wind-stream" style="opacity:${opacityScale}" d="M 0 0 C ${length * 0.25} -18, ${length * 0.68} -18, ${length} 0" />
          <path class="wind-tip" style="opacity:${opacityScale + 0.12}" d="M ${length - 12} -8 L ${length + 16} 0 L ${length - 12} 8 Z" />
        </g>
      `;
    })
    .join("");
}

function buildRouteMarkup() {
  if (!state.routeResult) {
    return "";
  }
  const coordinates = state.routeResult.route.coordinates;
  const segments = state.routeResult.segments || [];
  return coordinates
    .slice(0, -1)
    .map((coordinate, index) => {
      const next = coordinates[index + 1];
      const start = pointToWorld({ lat: coordinate[1], lng: coordinate[0] });
      const end = pointToWorld({ lat: next[1], lng: next[0] });
      return `
        <line class="route-glow" x1="${start[0]}" y1="${start[1]}" x2="${end[0]}" y2="${end[1]}" />
        <line class="route-segment" stroke="${segmentColor(segments[index]?.exposure_score ?? 0)}" x1="${start[0]}" y1="${start[1]}" x2="${end[0]}" y2="${end[1]}" />
      `;
    })
    .join("");
}

function buildMarkerMarkup() {
  return buildMarkers()
    .map((marker) => {
      const [x, y] = pointToWorld(marker.point);
      return `
        <g class="marker marker-${marker.kind}" data-kind="${marker.kind}" data-index="${marker.index}" transform="translate(${x} ${y})">
          <circle class="marker-ring" r="16"></circle>
          <circle class="marker-core" r="10"></circle>
          <text class="marker-label" y="1">${marker.label}</text>
        </g>
      `;
    })
    .join("");
}

function buildMarkers() {
  const markers = [];
  if (state.start) {
    markers.push({ kind: "start", index: 0, point: state.start, label: "S" });
  }
  if (state.end) {
    markers.push({ kind: "end", index: 0, point: state.end, label: "E" });
  }
  state.waypoints.forEach((point, index) => {
    markers.push({ kind: "waypoint", index, point, label: `${index + 1}` });
  });
  return markers;
}

function renderPointList() {
  const items = [];
  if (state.start) {
    items.push(pointRow("Start", state.start, null));
  }
  state.waypoints.forEach((point, index) => {
    items.push(
      pointRow(`Waypoint ${index + 1}`, point, () => {
        state.waypoints.splice(index, 1);
        queueRouteUpdate();
        render();
      }),
    );
  });
  if (state.end) {
    items.push(pointRow("End", state.end, null));
  }

  if (items.length === 0) {
    pointList.innerHTML = '<p class="hint">No points placed yet.</p>';
    return;
  }

  pointList.innerHTML = "";
  items.forEach((item) => pointList.appendChild(item));
}

function pointRow(label, point, onRemove) {
  const row = document.createElement("div");
  row.className = "point-row";
  row.innerHTML = `
    <div>
      <span>${label}</span>
      <strong>${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}</strong>
    </div>
  `;
  if (onRemove) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Remove";
    button.addEventListener("click", onRemove);
    row.appendChild(button);
  }
  return row;
}

async function refreshForecastWind() {
  const anchor = state.start || centerPoint();
  const response = await fetch(`/api/wind?lat=${anchor.lat}&lng=${anchor.lng}`);
  const wind = await response.json();
  state.wind.direction_deg = wind.direction_deg;
  state.wind.speed_mps = wind.speed_mps;
  state.wind.forecast_valid_at = wind.forecast_valid_at;
  state.wind.source = wind.source;
  windDirectionInput.value = wind.direction_deg;
  windSpeedInput.value = wind.speed_mps;
  windMeta.textContent = `Forecast: ${wind.direction_deg} deg, ${wind.speed_mps} m/s${wind.forecast_valid_at ? `, valid ${wind.forecast_valid_at}` : ""}`;
}

function centerPoint() {
  const { south, west, north, east } = state.mapData.bbox;
  return { lat: (south + north) / 2, lng: (west + east) / 2 };
}

function queueRouteUpdate() {
  window.clearTimeout(state.pendingRouteTimer);
  state.pendingRouteTimer = window.setTimeout(updateRoute, 220);
}

async function updateRoute() {
  if (!state.start || !state.end) {
    state.routeResult = null;
    state.error = "";
    render();
    return;
  }

  if (state.wind.mode === "forecast") {
    await refreshForecastWind();
  }

  try {
    const payload = {
      start: state.start,
      end: state.end,
      waypoints: state.waypoints,
      wind: {
        mode: state.wind.mode,
        direction_deg: state.wind.mode === "manual" ? state.wind.direction_deg : null,
        speed_mps: state.wind.mode === "manual" ? state.wind.speed_mps : null,
      },
      weights: state.weights,
      paddling_speed_kph: state.paddlingSpeedKph,
    };
    const response = await fetch("/api/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json();
    if (!response.ok) {
      throw new Error(body.error || "Route request failed.");
    }
    state.routeResult = body;
    state.error = "";
    focusOnRouteIfNeeded();
  } catch (error) {
    state.routeResult = null;
    state.error = error.message;
  }
  render();
}

function focusOnRouteIfNeeded() {
  if (!state.routeResult || !state.routeResult.route.coordinates.length) {
    return;
  }
  const xs = state.routeResult.route.coordinates.map((coordinate) => pointToWorld({ lat: coordinate[1], lng: coordinate[0] })[0]);
  const ys = state.routeResult.route.coordinates.map((coordinate) => pointToWorld({ lat: coordinate[1], lng: coordinate[0] })[1]);
  const padding = 140 * state.mapScale;
  const minX = Math.max(0, Math.min(...xs) - padding);
  const maxX = Math.min(MAP_WIDTH * state.mapScale, Math.max(...xs) + padding);
  const minY = Math.max(0, Math.min(...ys) - padding);
  const maxY = Math.min(MAP_HEIGHT * state.mapScale, Math.max(...ys) + padding);

  window.requestAnimationFrame(() => {
    mapScroll.scrollLeft = Math.max(0, minX - ((mapScroll.clientWidth - (maxX - minX)) / 2));
    mapScroll.scrollTop = Math.max(0, minY - ((mapScroll.clientHeight - (maxY - minY)) / 2));
  });
}

function updateSummary() {
  if (state.routeResult) {
    distanceValue.textContent = `${state.routeResult.summary.distance_km.toFixed(2)} km`;
    etaValue.textContent = `${state.routeResult.summary.estimated_time_h.toFixed(2)} h`;
    windValue.textContent = `${state.routeResult.summary.wind_direction_deg} deg / ${state.routeResult.summary.wind_speed_mps} m/s`;
    sourceValue.textContent = state.routeResult.summary.wind_source;
    windMeta.textContent = state.routeResult.summary.forecast_valid_at
      ? `Forecast valid at ${state.routeResult.summary.forecast_valid_at}`
      : "Manual wind is active.";
    warningsList.innerHTML = "";
    (state.routeResult.warnings || []).forEach((warning) => {
      const item = document.createElement("div");
      item.className = "warning-item";
      item.textContent = warning;
      warningsList.appendChild(item);
    });
  } else {
    distanceValue.textContent = "-";
    etaValue.textContent = "-";
    windValue.textContent =
      state.wind.direction_deg !== null ? `${state.wind.direction_deg} deg / ${state.wind.speed_mps} m/s` : "-";
    sourceValue.textContent = state.wind.mode;
    warningsList.innerHTML = "";
  }

  if (state.error) {
    errorBox.classList.remove("hidden");
    errorBox.textContent = state.error;
  } else {
    errorBox.classList.add("hidden");
    errorBox.textContent = "";
  }
}

function updateWindOverlay() {
  if (state.wind.direction_deg === null || state.wind.speed_mps === null) {
    windOverlay.classList.add("hidden");
    return;
  }
  windOverlay.classList.remove("hidden");
  windArrow.style.transform = `rotate(${state.wind.direction_deg}deg)`;
  windOverlayTitle.textContent = `Wind from ${cardinalDirection(state.wind.direction_deg)}`;
  windOverlayText.textContent = `${state.wind.direction_deg} deg at ${state.wind.speed_mps} m/s${state.wind.source ? `, ${state.wind.source}` : ""}`;
}

function pointToWorld(point) {
  const { south, west, north, east } = state.mapData.bbox;
  const x = ((point.lng - west) / (east - west)) * MAP_WIDTH * state.mapScale;
  const y = (MAP_HEIGHT - (((point.lat - south) / (north - south)) * MAP_HEIGHT)) * state.mapScale;
  return [x, y];
}

function worldToPoint(worldX, worldY) {
  const { south, west, north, east } = state.mapData.bbox;
  return {
    lng: west + ((worldX / state.mapScale) / MAP_WIDTH) * (east - west),
    lat: south + (((MAP_HEIGHT - (worldY / state.mapScale)) / MAP_HEIGHT) * (north - south)),
  };
}

function screenToPoint(clientX, clientY) {
  const rect = mapSvg.getBoundingClientRect();
  const svgX = clientX - rect.left;
  const svgY = clientY - rect.top;
  return worldToPoint(svgX, svgY);
}

function segmentColor(score) {
  if (score < 0.28) {
    return getCssVar("--line-sheltered");
  }
  if (score < 0.58) {
    return getCssVar("--line-medium");
  }
  return getCssVar("--line-exposed");
}

function getCssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function handlePointerDown(event) {
  const markerGroup = event.target.closest(".marker");
  if (!markerGroup) {
    return;
  }
  state.dragTarget = {
    kind: markerGroup.dataset.kind,
    index: parseInt(markerGroup.dataset.index || "0", 10),
  };
  mapSvg.setPointerCapture(event.pointerId);
}

function handlePointerMove(event) {
  if (!state.dragTarget) {
    return;
  }
  assignDraggedPoint(screenToPoint(event.clientX, event.clientY));
  render();
}

function handlePointerUp(event) {
  if (!state.dragTarget) {
    if (event.target.closest(".marker")) {
      return;
    }
    placePointFromScreen(event.clientX, event.clientY);
    return;
  }
  assignDraggedPoint(screenToPoint(event.clientX, event.clientY));
  state.dragTarget = null;
  queueRouteUpdate();
  render();
}

function placePointFromScreen(clientX, clientY) {
  const point = screenToPoint(clientX, clientY);
  if (!isWaterPoint(point)) {
    showToast("That point is on land. Pick open water instead.");
    return;
  }

  if (state.placementMode === "start") {
    state.start = point;
    showToast("Start point placed.");
    if (state.wind.mode === "forecast") {
      refreshForecastWind().then(render);
    }
  } else if (state.placementMode === "end") {
    state.end = point;
    showToast("End point placed.");
  } else {
    state.waypoints.push(point);
    showToast(`Waypoint ${state.waypoints.length} added.`);
  }

  render();
  queueRouteUpdate();
}

function assignDraggedPoint(point) {
  if (!isWaterPoint(point)) {
    return;
  }
  if (state.dragTarget.kind === "start") {
    state.start = point;
  } else if (state.dragTarget.kind === "end") {
    state.end = point;
  } else {
    state.waypoints[state.dragTarget.index] = point;
  }
}

function isWaterPoint(point) {
  const { south, west, north, east } = state.mapData.bbox;
  if (point.lat < south || point.lat > north || point.lng < west || point.lng > east) {
    return false;
  }
  return !state.mapData.landPolygons.some((polygon) => pointInPolygon(point, polygon));
}

function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;
    const intersect =
      yi > point.lat !== yj > point.lat
      && point.lng < (((xj - xi) * (point.lat - yi)) / ((yj - yi) || 1e-12)) + xi;
    if (intersect) {
      inside = !inside;
    }
  }
  return inside;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function cardinalDirection(directionDeg) {
  const labels = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const index = Math.round((((directionDeg % 360) + 360) % 360) / 45) % labels.length;
  return labels[index];
}

function showToast(message) {
  mapToast.textContent = message;
  mapToast.classList.remove("hidden");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => mapToast.classList.add("hidden"), 1800);
}

initialize().catch((error) => {
  state.error = error.message;
  updateSummary();
});
