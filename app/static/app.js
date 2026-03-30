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

document.getElementById("clearRouteButton").addEventListener("click", clearRoute);
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
  }
  queueRouteUpdate();
});

windDirectionInput.addEventListener("input", () => {
  if (state.wind.mode === "manual") {
    state.wind.direction_deg = parseFloat(windDirectionInput.value || "0");
    queueRouteUpdate();
  }
});

windSpeedInput.addEventListener("input", () => {
  if (state.wind.mode === "manual") {
    state.wind.speed_mps = parseFloat(windSpeedInput.value || "0");
    queueRouteUpdate();
  }
});

paddlingSpeedInput.addEventListener("input", () => {
  state.paddlingSpeedKph = parseFloat(paddlingSpeedInput.value);
  paddlingSpeedValue.textContent = `${state.paddlingSpeedKph.toFixed(1)} km/h`;
  queueRouteUpdate();
});

async function initialize() {
  buildWeightControls();
  updateModeButtons();
  toggleWindInputs();
  paddlingSpeedValue.textContent = `${state.paddlingSpeedKph.toFixed(1)} km/h`;
  const response = await fetch("/api/map-data");
  state.mapData = await response.json();
  render();
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
    const input = row.querySelector("input");
    input.addEventListener("input", () => {
      state.weights[key] = parseFloat(input.value);
      document.getElementById(`${key}Value`).textContent = input.value;
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
}

function renderMap() {
  if (!state.mapData) {
    return;
  }
  const { bbox, landPolygons, channels } = state.mapData;
  const fragments = [];

  for (let index = 1; index < 8; index += 1) {
    const x = (1000 / 8) * index;
    const y = (700 / 8) * index;
    fragments.push(`<line class="grid-line" x1="${x}" y1="0" x2="${x}" y2="700" />`);
    fragments.push(`<line class="grid-line" x1="0" y1="${y}" x2="1000" y2="${y}" />`);
  }
  fragments.push(`<text class="chart-water-label" x="46" y="82">Gulf Reach</text>`);

  landPolygons.forEach((polygon) => {
    fragments.push(`<polygon class="land-shape" points="${polygon.map((point) => pointToSvg(point).join(",")).join(" ")}" />`);
  });

  channels.forEach((channel) => {
    const [x1, y1] = pointToSvg(channel.start);
    const [x2, y2] = pointToSvg(channel.end);
    fragments.push(`<line class="channel-line" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" />`);
  });

  if (state.routeResult) {
    const coordinates = state.routeResult.route.coordinates;
    const segments = state.routeResult.segments || [];
    coordinates.slice(0, -1).forEach((coordinate, index) => {
      const next = coordinates[index + 1];
      const start = pointToSvg({ lat: coordinate[1], lng: coordinate[0] });
      const end = pointToSvg({ lat: next[1], lng: next[0] });
      fragments.push(`<line class="route-glow" x1="${start[0]}" y1="${start[1]}" x2="${end[0]}" y2="${end[1]}" />`);
      fragments.push(
        `<line class="route-segment" stroke="${segmentColor(segments[index]?.exposure_score ?? 0)}" x1="${start[0]}" y1="${start[1]}" x2="${end[0]}" y2="${end[1]}" />`,
      );
    });
  }

  buildMarkers().forEach((marker) => {
    const [x, y] = pointToSvg(marker.point);
    fragments.push(`
      <g class="marker marker-${marker.kind}" data-kind="${marker.kind}" data-index="${marker.index}" transform="translate(${x} ${y})">
        <circle class="marker-ring" r="16"></circle>
        <circle class="marker-core" r="10"></circle>
        <text class="marker-label" y="1">${marker.label}</text>
      </g>
    `);
  });

  mapSvg.innerHTML = fragments.join("");
  mapSvg.onpointerdown = handlePointerDown;
  mapSvg.onpointermove = handlePointerMove;
  mapSvg.onpointerup = handlePointerUp;
  mapSvg.onpointerleave = handlePointerUp;
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
    items.push(pointRow(`Waypoint ${index + 1}`, point, () => {
      state.waypoints.splice(index, 1);
      queueRouteUpdate();
      render();
    }));
  });
  if (state.end) {
    items.push(pointRow("End", state.end, null));
  }

  if (items.length === 0) {
    pointList.innerHTML = `<p class="hint">No points placed yet.</p>`;
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
  windMeta.textContent = `Forecast: ${wind.direction_deg}°, ${wind.speed_mps} m/s${wind.forecast_valid_at ? `, valid ${wind.forecast_valid_at}` : ""}`;
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
  } catch (error) {
    state.routeResult = null;
    state.error = error.message;
  }
  render();
}

function updateSummary() {
  if (state.routeResult) {
    distanceValue.textContent = `${state.routeResult.summary.distance_km.toFixed(2)} km`;
    etaValue.textContent = `${state.routeResult.summary.estimated_time_h.toFixed(2)} h`;
    windValue.textContent = `${state.routeResult.summary.wind_direction_deg}° / ${state.routeResult.summary.wind_speed_mps} m/s`;
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
    windValue.textContent = state.wind.direction_deg !== null ? `${state.wind.direction_deg}° / ${state.wind.speed_mps} m/s` : "-";
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

function pointToSvg(point) {
  const { south, west, north, east } = state.mapData.bbox;
  const x = ((point.lng - west) / (east - west)) * 1000;
  const y = 700 - (((point.lat - south) / (north - south)) * 700);
  return [x, y];
}

function svgToPoint(x, y) {
  const rect = mapSvg.getBoundingClientRect();
  const svgX = (x - rect.left) * (1000 / rect.width);
  const svgY = (y - rect.top) * (700 / rect.height);
  const { south, west, north, east } = state.mapData.bbox;
  return {
    lng: west + (svgX / 1000) * (east - west),
    lat: south + ((700 - svgY) / 700) * (north - south),
  };
}

function segmentColor(score) {
  if (score < 0.33) {
    return getCssVar("--line-sheltered");
  }
  if (score < 0.66) {
    return getCssVar("--line-medium");
  }
  return getCssVar("--line-exposed");
}

function getCssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function handlePointerDown(event) {
  const markerGroup = event.target.closest(".marker");
  if (markerGroup) {
    state.dragTarget = {
      kind: markerGroup.dataset.kind,
      index: parseInt(markerGroup.dataset.index || "0", 10),
    };
    mapSvg.setPointerCapture(event.pointerId);
    return;
  }

  placePointFromEvent(event);
}

function handlePointerMove(event) {
  if (!state.dragTarget) {
    return;
  }
  const point = svgToPoint(event.clientX, event.clientY);
  if (!isWaterPoint(point)) {
    return;
  }
  assignDraggedPoint(point);
  render();
}

function handlePointerUp(event) {
  if (state.dragTarget) {
    assignDraggedPoint(svgToPoint(event.clientX, event.clientY));
    state.dragTarget = null;
    queueRouteUpdate();
  }
}

function placePointFromEvent(event) {
  const point = svgToPoint(event.clientX, event.clientY);
  if (!isWaterPoint(point)) {
    showToast("That point is on land. Pick open water instead.");
    return;
  }
  if (state.placementMode === "start") {
    state.start = point;
    showToast("Start point placed.");
    if (state.wind.mode === "forecast") {
      refreshForecastWind();
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
    const intersect = yi > point.lat !== yj > point.lat
      && point.lng < ((xj - xi) * (point.lat - yi)) / ((yj - yi) || 1e-12) + xi;
    if (intersect) {
      inside = !inside;
    }
  }
  return inside;
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
