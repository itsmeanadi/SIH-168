// ============================================================
// SIH-168 — Google-Maps-Style Navigation Cartography & Camera Engine
// Real-Time Road Centerline Map Matching Model (MMM) & Day/Night Mode
// ============================================================

export const MAP_HTML = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>

<style>
  * { box-sizing: border-box; }
  html, body {
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Google Sans", sans-serif;
    user-select: none;
    -webkit-user-select: none;
    background-color: #F8F9FA !important;
  }

  /* DAY MODE (Google Maps Daytime Theme) */
  body.day-mode {
    background-color: #F8F9FA !important;
  }
  body.day-mode #map {
    background-color: #F8F9FA !important;
  }
  body.day-mode .leaflet-container {
    background-color: #F8F9FA !important;
  }
  body.day-mode .leaflet-tile {
    filter: saturate(1.05) contrast(1.02);
  }

  /* NIGHT MODE (Google Maps Dark Theme) */
  body.dark-mode {
    background-color: #12161f !important;
  }
  body.dark-mode #map {
    background-color: #12161f !important;
  }
  body.dark-mode .leaflet-container {
    background-color: #12161f !important;
  }
  body.dark-mode .leaflet-tile {
    filter: brightness(0.85) contrast(1.1);
  }

  #map {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    height: 100%;
  }

  /* Navigation Vehicle Puck */
  .vehicle-wrapper {
    width: 52px;
    height: 52px;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.12s cubic-bezier(0.2, 0, 0.2, 1);
  }

  .vehicle-pulse {
    position: absolute;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    animation: navPulse 2.4s infinite ease-out;
  }

  /* Day Mode Puck */
  body.day-mode .vehicle-pulse {
    background: rgba(26, 115, 232, 0.22);
    border: 1.5px solid rgba(26, 115, 232, 0.65);
  }
  body.day-mode .vehicle-dr .vehicle-pulse {
    background: rgba(234, 134, 0, 0.25);
    border-color: rgba(234, 134, 0, 0.85);
  }
  body.day-mode .vehicle-disc {
    width: 34px;
    height: 34px;
    background: radial-gradient(circle, #FFFFFF 0%, #E8F0FE 100%);
    border-radius: 50%;
    border: 2.5px solid #1A73E8;
    box-shadow: 0 0 12px rgba(26, 115, 232, 0.5), 0 3px 8px rgba(0,0,0,0.25);
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    z-index: 2;
  }
  body.day-mode .vehicle-dr .vehicle-disc {
    border-color: #F29900;
    box-shadow: 0 0 14px rgba(242, 153, 0, 0.7), 0 3px 8px rgba(0,0,0,0.25);
  }
  body.day-mode .vehicle-red-arrow {
    display: flex;
    align-items: center;
    justify-content: center;
    filter: drop-shadow(0 1px 3px rgba(0,0,0,0.35));
  }
  body.day-mode .gps-dot {
    width: 13px;
    height: 13px;
    background: #1A73E8;
    border: 2.5px solid #FFFFFF;
    border-radius: 50%;
    box-shadow: 0 2px 8px rgba(26, 115, 232, 0.45);
  }

  /* Night Mode Puck */
  body.dark-mode .vehicle-pulse {
    background: rgba(66, 133, 244, 0.22);
    border: 1.5px solid rgba(66, 133, 244, 0.6);
  }
  body.dark-mode .vehicle-dr .vehicle-pulse {
    background: rgba(245, 158, 11, 0.25);
    border-color: rgba(245, 158, 11, 0.85);
  }
  body.dark-mode .vehicle-disc {
    width: 34px;
    height: 34px;
    background: radial-gradient(circle, #1E293B 0%, #0F172A 100%);
    border-radius: 50%;
    border: 2.5px solid #4285F4;
    box-shadow: 0 0 14px rgba(66, 133, 244, 0.65), 0 4px 10px rgba(0,0,0,0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    z-index: 2;
  }
  body.dark-mode .vehicle-dr .vehicle-disc {
    border-color: #FACC15;
    box-shadow: 0 0 16px rgba(250, 204, 21, 0.8), 0 4px 10px rgba(0,0,0,0.6);
  }
  body.dark-mode .vehicle-red-arrow {
    display: flex;
    align-items: center;
    justify-content: center;
    filter: drop-shadow(0 0 6px rgba(239, 68, 68, 0.95));
  }
  body.dark-mode .gps-dot {
    width: 13px;
    height: 13px;
    background: #64748B;
    border: 2px solid #FFFFFF;
    border-radius: 50%;
    box-shadow: 0 2px 6px rgba(0,0,0,0.5);
  }

  /* Google Maps Spotlight Pin Markers (27dp x 43dp) */
  .markers_spo {
    width: 27px;
    height: 43px;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.35));
    animation: bounceIn 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }
  .markers_spo_head {
    width: 27px;
    height: 27px;
    border-radius: 50%;
    background: #EA4335;
    border: 2px solid #FFFFFF;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #FFFFFF;
    font-size: 13px;
    font-weight: bold;
    z-index: 2;
  }
  .markers_spo_point {
    width: 0;
    height: 0;
    border-left: 6px solid transparent;
    border-right: 6px solid transparent;
    border-top: 10px solid #EA4335;
    margin-top: -3px;
    z-index: 1;
  }
  .markers_spo_shadow {
    width: 14px;
    height: 4px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.3);
    margin-top: 2px;
  }

  /* Google Maps Pinlet Markers (24dp x 32dp) */
  .markers_pin {
    width: 24px;
    height: 32px;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    filter: drop-shadow(0 3px 5px rgba(0,0,0,0.3));
    animation: bounceIn 0.3s ease-out;
  }
  .markers_pin_head {
    width: 24px;
    height: 24px;
    border-radius: 12px;
    background: #D93025;
    border: 2px solid #FFFFFF;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #FFFFFF;
    font-size: 11px;
    z-index: 2;
  }
  .markers_pin_point {
    width: 0;
    height: 0;
    border-left: 5px solid transparent;
    border-right: 5px solid transparent;
    border-top: 7px solid #D93025;
    margin-top: -2px;
    z-index: 1;
  }

  /* Google Maps Current Location Marker (24dp x 24dp) */
  .markers_cur {
    width: 24px;
    height: 24px;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .markers_cur_puck {
    width: 22px;
    height: 22px;
    background: #1A73E8;
    border: 2.5px solid #FFFFFF;
    border-radius: 50%;
    box-shadow: 0 0 10px rgba(26, 115, 232, 0.8), 0 2px 5px rgba(0,0,0,0.3);
    z-index: 2;
  }
  .markers_cur_pulse {
    position: absolute;
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: rgba(26, 115, 232, 0.25);
    border: 1px solid rgba(26, 115, 232, 0.6);
    animation: navPulse 2s infinite ease-out;
    z-index: 1;
  }

  @keyframes navPulse {
    0% { transform: scale(0.6); opacity: 1; }
    100% { transform: scale(1.45); opacity: 0; }
  }

  @keyframes bounceIn {
    0% { transform: scale(0.3) translateY(-20px); opacity: 0; }
    70% { transform: scale(1.1) translateY(0); opacity: 1; }
    100% { transform: scale(1); }
  }

  /* ZUPT stationary pulsing */
  @keyframes zuptPulse {
    0% { transform: scale(1); opacity: 1; filter: brightness(1); }
    50% { transform: scale(0.92); opacity: 0.7; filter: brightness(0.7) grayscale(0.5); }
    100% { transform: scale(1); opacity: 1; filter: brightness(1); }
  }
  .vehicle-zupt-pulse {
    animation: zuptPulse 2s infinite ease-in-out;
  }

  /* Google Maps 3D Navigation Arrow */
  .vehicle-nav-arrow {
    display: flex;
    align-items: center;
    justify-content: center;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.35));
  }

  /* Google Maps STOP Sign Marker (Red Octagon) */
  .map-stop-sign {
    width: 20px;
    height: 20px;
    background: #D93025;
    clip-path: polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%);
    border: 1.5px solid #FFFFFF;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #FFFFFF;
    font-size: 6px;
    font-weight: 900;
    font-family: -apple-system, Roboto, sans-serif;
    letter-spacing: -0.2px;
  }

  /* Google Maps Traffic Light Capsule Marker */
  .map-traffic-light {
    width: 14px;
    height: 26px;
    background: #202124;
    border-radius: 7px;
    border: 1.5px solid #FFFFFF;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.35);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-evenly;
    padding: 2px 0;
  }
  .traffic-light-dot {
    width: 5px;
    height: 5px;
    border-radius: 2.5px;
  }
  .t-red { background: #EA4335; box-shadow: 0 0 3px #EA4335; }
  .t-yellow { background: #FBBC04; }
  .t-green { background: #34A853; box-shadow: 0 0 3px #34A853; }

  /* Google Maps "Similar ETA" Speech Bubble */
  .map-similar-eta {
    background: #FFFFFF;
    border: 1px solid #DADCE0;
    border-radius: 12px;
    padding: 3px 8px;
    font-size: 11px;
    font-weight: 700;
    color: #5F6368;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.18);
    white-space: nowrap;
    display: flex;
    align-items: center;
    pointer-events: none;
  }

  /* Route Traffic Delay Badge */
  .map-delay-badge {
    background: #EA4335;
    border-radius: 10px;
    padding: 2px 6px;
    font-size: 10px;
    font-weight: 800;
    color: #FFFFFF;
    box-shadow: 0 2px 5px rgba(234, 67, 53, 0.4);
    white-space: nowrap;
    border: 1px solid #FFFFFF;
  }
</style>
</head>
<body class="day-mode">
<div id="map"></div>

<script>
let currentTheme = "day"; // Default: Day Mode

let map = L.map("map", {
  zoomControl: false,
  attributionControl: false,
  fadeAnimation: true,
  zoomAnimation: true
}).setView([22.6667, 75.8919], 17);

const DAY_TILE_URL = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
const NIGHT_TILE_URL = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

let tileLayer = L.tileLayer(
  currentTheme === "night" ? NIGHT_TILE_URL : DAY_TILE_URL,
  {
    maxZoom: 20,
    subdomains: "abcd",
    updateWhenZooming: false,
    updateInterval: 120,
    attribution: ""
  }
).addTo(map);

let vehicleMarker = null;
let gpsMarker = null;
let destinationMarker = null;
let routeLineCasing = null;
let routeLine = null;
let trafficPolylines = [];
let routeFeatureMarkers = [];
let hasCenteredInitial = false;

// Navigation & Camera Tracking State
let isNavigating = false;
let isCameraFollowing = true;
let currentHeading = 0;
let currentVehiclePos = null;
let activeRouteCoordinates = null;

// Road Network Storage for Map Matching Model
let roadNetworkSegments = [];
let lastMatchedSegment = null;
let lastSnappedPos = null;

// Dynamic Trajectory Trail & Flow Ray State
let trailSegments = [];
let currentTrailSegment = null;
let lastTrailPos = null;
let flowLine = null;
let flowArrowHead = null;

const vehicleIcon = L.divIcon({
  className: "",
  html: '<div id="vehicle-element" class="vehicle-wrapper">' +
        '  <div class="vehicle-pulse"></div>' +
        '  <div class="vehicle-disc">' +
        '    <div class="vehicle-nav-arrow">' +
        '      <svg viewBox="0 0 24 24" width="24" height="24">' +
        '        <polygon points="12,2 12,16 3,21" fill="#4285F4" stroke="#FFFFFF" stroke-width="1.6" stroke-linejoin="round"/>' +
        '        <polygon points="12,2 21,21 12,16" fill="#1A73E8" stroke="#FFFFFF" stroke-width="1.6" stroke-linejoin="round"/>' +
        '      </svg>' +
        '    </div>' +
        '  </div>' +
        '</div>',
  iconSize: [52, 52],
  iconAnchor: [26, 26]
});

const gpsIcon = L.divIcon({
  className: "",
  html: '<div class="gps-dot"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7]
});

const destIcon = L.divIcon({
  className: "",
  html: '<div class="markers_spo">' +
        '  <div class="markers_spo_head">🏁</div>' +
        '  <div class="markers_spo_point"></div>' +
        '  <div class="markers_spo_shadow"></div>' +
        '</div>',
  iconSize: [27, 43],
  iconAnchor: [13.5, 41]
});

function createPinletIcon(glyph, bgColor) {
  const bg = bgColor || '#D93025';
  return L.divIcon({
    className: "",
    html: '<div class="markers_pin">' +
          '  <div class="markers_pin_head" style="background:' + bg + ';">' + (glyph || '📍') + '</div>' +
          '  <div class="markers_pin_point" style="border-top-color:' + bg + ';"></div>' +
          '</div>',
    iconSize: [24, 32],
    iconAnchor: [12, 30]
  });
}

function getDistMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function getBearing(lat1, lon1, lat2, lon2) {
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
  const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
            Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
  const brng = Math.atan2(y, x) * 180 / Math.PI;
  return (brng + 360) % 360;
}

function getForwardPoint(lat, lng, headingDeg, distM) {
  const R = 6378137;
  const d = (distM || 26) / R;
  const brng = (headingDeg * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lon1 = (lng * Math.PI) / 180;
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng));
  const lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
  return [lat2 * 180 / Math.PI, lon2 * 180 / Math.PI];
}

function projectPointOnSegment(pLat, pLng, aLat, aLng, bLat, bLng) {
  const dx = bLng - aLng;
  const dy = bLat - aLat;
  if (dx === 0 && dy === 0) {
    return { lat: aLat, lng: aLng, t: 0, dist: getDistMeters(pLat, pLng, aLat, aLng) };
  }

  const cosLat = Math.cos(aLat * Math.PI / 180);
  const segDx = dx * cosLat;
  const segDy = dy;
  const pDx = (pLng - aLng) * cosLat;
  const pDy = pLat - aLat;

  const lenSq = segDx * segDx + segDy * segDy;
  let t = (pDx * segDx + pDy * segDy) / (lenSq || 1e-10);
  t = Math.max(0, Math.min(1, t));

  const projLat = aLat + t * dy;
  const projLng = aLng + t * dx;
  const dist = getDistMeters(pLat, pLng, projLat, projLng);
  return { lat: projLat, lng: projLng, t, dist };
}

// ============================================================
// ADVANCED MAP MATCHING MODEL (MMM)
// HMM Distance + Heading Likelihood Scoring & Centerline Locking
// ============================================================
function matchToRoadNetwork(rawLat, rawLng, rawHeading, speedKmh) {
  // Collect candidate segments
  let candidateSegments = [];

  if (activeRouteCoordinates && activeRouteCoordinates.length >= 2) {
    for (let i = 0; i < activeRouteCoordinates.length - 1; i++) {
      candidateSegments.push({
        p1: activeRouteCoordinates[i],
        p2: activeRouteCoordinates[i + 1],
        segIndex: i,
        source: "route"
      });
    }
  } else if (roadNetworkSegments && roadNetworkSegments.length > 0) {
    candidateSegments = roadNetworkSegments;
  }

  if (candidateSegments.length === 0) {
    return {
      lat: rawLat,
      lng: rawLng,
      heading: rawHeading,
      isSnapped: false,
      matchedSegIndex: -1
    };
  }

  let bestScore = -Infinity;
  let bestCandidate = null;
  let bestProj = null;
  let bestBearing = rawHeading;

  const sigmaDist = 12.0; // Standard deviation for distance likelihood (meters)

  for (let i = 0; i < candidateSegments.length; i++) {
    const seg = candidateSegments[i];
    const p1 = seg.p1;
    const p2 = seg.p2;

    const proj = projectPointOnSegment(rawLat, rawLng, p1[0], p1[1], p2[0], p2[1]);
    if (proj.dist > 42.0) continue; // Outside road corridor

    const segBearing = getBearing(p1[0], p1[1], p2[0], p2[1]);

    // 1. Distance Emission Likelihood L_dist = exp(-d^2 / (2 * sigma^2))
    const lDist = Math.exp(-(proj.dist * proj.dist) / (2 * sigmaDist * sigmaDist));

    // 2. Heading Alignment Likelihood L_head
    const headingDiff = Math.abs(((rawHeading - segBearing + 180) % 360) - 180);
    let lHead = Math.exp(-(headingDiff * headingDiff) / (2 * 40 * 40));
    if (speedKmh < 1.5) {
      // Lower heading penalty when vehicle is nearly stationary
      lHead = 0.6 + 0.4 * lHead;
    }

    // 3. Temporal Transition / Continuity Bonus
    let continuityBonus = 1.0;
    if (lastMatchedSegment && lastMatchedSegment.source === seg.source) {
      if (lastMatchedSegment.segIndex === seg.segIndex) {
        continuityBonus = 2.0; // Staying on same segment
      } else if (lastMatchedSegment.segIndex + 1 === seg.segIndex) {
        continuityBonus = 2.4; // Progressing along route downstream
      }
    }

    const score = lDist * (0.35 + 0.65 * lHead) * continuityBonus;

    if (score > bestScore) {
      bestScore = score;
      bestCandidate = seg;
      bestProj = proj;
      bestBearing = segBearing;
    }
  }

  // Snapping Threshold Check (<= 38m corridor and positive score)
  if (bestProj && bestProj.dist <= 38.0 && bestScore > 0.015) {
    let finalLat = bestProj.lat;
    let finalLng = bestProj.lng;

    // Smooth temporal LERP along road to eliminate micro-jitter
    if (lastSnappedPos) {
      const dStep = getDistMeters(lastSnappedPos.lat, lastSnappedPos.lng, bestProj.lat, bestProj.lng);
      if (dStep < 0.2) {
        finalLat = lastSnappedPos.lat;
        finalLng = lastSnappedPos.lng;
      } else if (dStep < 14.0) {
        const alpha = 0.84;
        finalLat = lastSnappedPos.lat + alpha * (bestProj.lat - lastSnappedPos.lat);
        finalLng = lastSnappedPos.lng + alpha * (bestProj.lng - lastSnappedPos.lng);
      }
    }

    // Road bearing alignment: Lock vehicle puck orientation to road segment
    let finalHeading = rawHeading;
    const headingDiff = Math.abs(((rawHeading - bestBearing + 180) % 360) - 180);
    if (speedKmh >= 3.0 || headingDiff < 65) {
      finalHeading = Math.round(bestBearing);
    }

    lastMatchedSegment = bestCandidate;
    lastSnappedPos = { lat: finalLat, lng: finalLng, heading: finalHeading };

    return {
      lat: finalLat,
      lng: finalLng,
      heading: finalHeading,
      isSnapped: true,
      matchedSegIndex: bestCandidate.segIndex,
      bestSeg: bestCandidate,
      bestBearing: bestBearing
    };
  }

  // Off-Road (Parking lot, open field, or true off-route)
  lastMatchedSegment = null;
  lastSnappedPos = null;
  return {
    lat: rawLat,
    lng: rawLng,
    heading: rawHeading,
    isSnapped: false,
    matchedSegIndex: -1
  };
}

// ============================================================
// ROAD-CONFORMING PROBABLE PATH GENERATOR
// Traces downstream along road centerline; NEVER crosses buildings
// ============================================================
function getProbableRoadPath(snappedLat, snappedLng, headingDeg, matchedSegIndex, isSnapped, lookaheadMeters = 30) {
  if (isSnapped && activeRouteCoordinates && activeRouteCoordinates.length >= 2 && matchedSegIndex >= 0) {
    const pathCoords = [[snappedLat, snappedLng]];
    let remainingDist = lookaheadMeters;
    let currLat = snappedLat;
    let currLng = snappedLng;
    let lastBearing = headingDeg;

    for (let i = matchedSegIndex; i < activeRouteCoordinates.length - 1 && remainingDist > 0; i++) {
      const nextPt = activeRouteCoordinates[i + 1];
      const segDist = getDistMeters(currLat, currLng, nextPt[0], nextPt[1]);
      const segBearing = getBearing(currLat, currLng, nextPt[0], nextPt[1]);

      if (segDist <= remainingDist) {
        pathCoords.push([nextPt[0], nextPt[1]]);
        remainingDist -= segDist;
        currLat = nextPt[0];
        currLng = nextPt[1];
        lastBearing = segBearing;
      } else {
        const frac = remainingDist / (segDist || 1);
        const endLat = currLat + frac * (nextPt[0] - currLat);
        const endLng = currLng + frac * (nextPt[1] - currLng);
        pathCoords.push([endLat, endLng]);
        lastBearing = segBearing;
        remainingDist = 0;
        break;
      }
    }

    if (pathCoords.length >= 2) {
      return {
        coords: pathCoords,
        endPoint: pathCoords[pathCoords.length - 1],
        endHeading: Math.round(lastBearing),
        isSnappedToRoad: true
      };
    }
  }

  // Unsnapped Fallback: smooth heading vector starting from current point
  const forwardCoord = getForwardPoint(snappedLat, snappedLng, headingDeg, lookaheadMeters);
  return {
    coords: [[snappedLat, snappedLng], forwardCoord],
    endPoint: forwardCoord,
    endHeading: headingDeg,
    isSnappedToRoad: false
  };
}

function clearTrail() {
  if (trailSegments && trailSegments.length > 0) {
    for (let i = 0; i < trailSegments.length; i++) {
      const seg = trailSegments[i];
      if (seg.glowLine) map.removeLayer(seg.glowLine);
      if (seg.coreLine) map.removeLayer(seg.coreLine);
    }
  }
  trailSegments = [];
  currentTrailSegment = null;
  lastTrailPos = null;
}

function recordTrailPoint(lat, lng, mode) {
  // When GNSS is lost (DR, BLACKOUT, or ALIGNING), do NOT record or draw any trail
  const isDR = (mode === "DR" || mode === "BLACKOUT" || mode === "ALIGNING");
  if (isDR) {
    currentTrailSegment = null;
    lastTrailPos = null;
    return;
  }

  const targetMode = "GNSS";

  if (lastTrailPos) {
    const d = getDistMeters(lastTrailPos.lat, lastTrailPos.lng, lat, lng);
    if (d < 0.6) return;
  }

  const newCoord = [lat, lng];

  if (!currentTrailSegment || currentTrailSegment.mode !== targetMode) {
    const pts = [];
    if (lastTrailPos) {
      pts.push([lastTrailPos.lat, lastTrailPos.lng]);
    }
    pts.push(newCoord);

    const isDay = (currentTheme === "day");
    const glowColor = isDay ? "rgba(26, 115, 232, 0.4)" : "#1A73E8";
    const coreColor = isDay ? "#1A73E8" : "#4285F4";

    const glowLine = L.polyline(pts, {
      color: glowColor,
      weight: 7,
      opacity: 0.4,
      lineCap: "round",
      lineJoin: "round"
    }).addTo(map);

    const coreLine = L.polyline(pts, {
      color: coreColor,
      weight: 4.2,
      opacity: 0.95,
      lineCap: "round",
      lineJoin: "round"
    }).addTo(map);

    currentTrailSegment = {
      mode: targetMode,
      points: pts,
      glowLine,
      coreLine
    };
    trailSegments.push(currentTrailSegment);
  } else {
    currentTrailSegment.points.push(newCoord);
    currentTrailSegment.glowLine.setLatLngs(currentTrailSegment.points);
    currentTrailSegment.coreLine.setLatLngs(currentTrailSegment.points);
  }

  lastTrailPos = { lat, lng };
}

function updateFlowArrow(snappedLat, snappedLng, headingDeg, matchedSegIndex, isSnapped) {
  const probable = getProbableRoadPath(snappedLat, snappedLng, headingDeg, matchedSegIndex, isSnapped, 28);
  const arrowCoords = probable.coords;
  const forwardCoord = probable.endPoint;
  const finalHeading = probable.endHeading;

  const strokeColor = "#1A73E8";

  if (!flowLine) {
    flowLine = L.polyline(arrowCoords, {
      color: strokeColor,
      weight: 3.8,
      opacity: 0.95,
      dashArray: "5, 6",
      lineCap: "round",
      lineJoin: "round"
    }).addTo(map);
  } else {
    flowLine.setLatLngs(arrowCoords);
  }

  const arrowIcon = L.divIcon({
    className: "",
    html: '<div style="transform: rotate(' + finalHeading + 'deg); width:20px; height:20px; display:flex; align-items:center; justify-content:center;">' +
          '  <svg width="20" height="20" viewBox="0 0 20 20">' +
          '    <polygon points="10,1 19,18 10,14 1,18" fill="#1A73E8" stroke="#FFFFFF" stroke-width="1.8"/>' +
          '  </svg>' +
          '</div>',
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });

  if (!flowArrowHead) {
    flowArrowHead = L.marker(forwardCoord, { icon: arrowIcon, zIndexOffset: 990 }).addTo(map);
  } else {
    flowArrowHead.setLatLng(forwardCoord);
    flowArrowHead.setIcon(arrowIcon);
  }
}

// Stabilized Position & Heading State (EMA Smoothing & Deadband)
let smoothVehiclePos = null;
let smoothHeadingDeg = 0;
let lastCameraCenterPos = null;

function updateVehicle(lat, lng, heading, mode, speed, zuptActive) {
  if (!lat || !lng || (lat === 0 && lng === 0) || isNaN(lat) || isNaN(lng)) return;

  const rawHeading = (typeof heading === "number" && !isNaN(heading)) ? heading : 0;
  const currentSpeedKmh = Math.max(0, (typeof speed === "number" && !isNaN(speed)) ? speed : 0);

  // Run Real-Time Road Map Matching Model
  const matchResult = matchToRoadNetwork(lat, lng, rawHeading, currentSpeedKmh);
  const targetLat = matchResult.lat;
  const targetLng = matchResult.lng;
  const targetHeading = matchResult.heading;

  // Initialize smoothing state on first fix
  if (!smoothVehiclePos) {
    smoothVehiclePos = { lat: targetLat, lng: targetLng };
    smoothHeadingDeg = targetHeading;
  } else {
    // 1. Position Stabilization (Stationary Deadband + EMA Smoothing)
    const distDelta = getDistMeters(smoothVehiclePos.lat, smoothVehiclePos.lng, targetLat, targetLng);

    if (currentSpeedKmh < 3.0 && distDelta < 4.0) {
      // Vehicle is stationary: suppress noisy GPS drift (increased to 4.0m to handle indoor/urban multipath)
    } else {
      // Moving: smooth coordinate transition (LERP / EMA)
      const alphaPos = distDelta > 15 ? 0.8 : 0.35;
      smoothVehiclePos.lat = smoothVehiclePos.lat + alphaPos * (targetLat - smoothVehiclePos.lat);
      smoothVehiclePos.lng = smoothVehiclePos.lng + alphaPos * (targetLng - smoothVehiclePos.lng);
    }

    // 2. Heading Stabilization (Compass noise suppression & shortest angular path)
    // Require minimum displacement (distDelta > 3.0) to update heading, neutralizing stationary GPS speed noise.
    if (currentSpeedKmh >= 2.0 && distDelta > 3.0) {
      let diff = ((targetHeading - smoothHeadingDeg + 540) % 360) - 180;
      if (Math.abs(diff) > 1.5) {
        const alphaHeading = Math.abs(diff) > 45 ? 0.5 : 0.28;
        smoothHeadingDeg = (smoothHeadingDeg + alphaHeading * diff + 360) % 360;
      }
    }
  }

  const renderLat = smoothVehiclePos.lat;
  const renderLng = smoothVehiclePos.lng;
  const renderHeading = Math.round(smoothHeadingDeg);

  currentVehiclePos = { lat: renderLat, lng: renderLng };
  currentHeading = renderHeading;

  if (!vehicleMarker) {
    vehicleMarker = L.marker([renderLat, renderLng], { icon: vehicleIcon, zIndexOffset: 1000 }).addTo(map);
    if (!hasCenteredInitial) {
      hasCenteredInitial = true;
      map.setView([renderLat, renderLng], 17);
      lastCameraCenterPos = { lat: renderLat, lng: renderLng };
    }
  } else {
    vehicleMarker.setLatLng([renderLat, renderLng]);
  }

  const el = document.getElementById("vehicle-element");
  if (el) {
    el.style.transform = "rotate(" + renderHeading + "deg)";
    if (mode === "DR" || mode === "BLACKOUT") {
      el.classList.add("vehicle-dr");
    } else {
      el.classList.remove("vehicle-dr");
    }

    if (zuptActive) {
      el.classList.add("vehicle-zupt-pulse");
    } else {
      el.classList.remove("vehicle-zupt-pulse");
    }
  }

  // Record breadcrumb trail strictly when moving
  if (currentSpeedKmh >= 3.0) {
    recordTrailPoint(renderLat, renderLng, mode);
  }

  // Update forward road-conforming probable path
  updateFlowArrow(renderLat, renderLng, renderHeading, matchResult.matchedSegIndex, matchResult.isSnapped);

  // Smooth & Debounced Camera Follow during Navigation Mode
  if (isNavigating && isCameraFollowing) {
    if (!lastCameraCenterPos) {
      lastCameraCenterPos = { lat: renderLat, lng: renderLng };
      map.panTo([renderLat, renderLng], { animate: true, duration: 0.5 });
    } else {
      const camDist = getDistMeters(lastCameraCenterPos.lat, lastCameraCenterPos.lng, renderLat, renderLng);
      if (camDist > 2.5) {
        lastCameraCenterPos = { lat: renderLat, lng: renderLng };
        map.panTo([renderLat, renderLng], { animate: true, duration: 0.5, easeLinearity: 0.25 });
      }
    }
  }
}

function updateGPS(lat, lng) {
  if (!lat || !lng) return;
  if (!vehicleMarker) {
    updateVehicle(lat, lng, 0, "GNSS", 0);
  }
  if (!gpsMarker) {
    gpsMarker = L.marker([lat, lng], { icon: gpsIcon, zIndexOffset: 500 }).addTo(map);
  } else {
    gpsMarker.setLatLng([lat, lng]);
  }

  if (!hasCenteredInitial) {
    hasCenteredInitial = true;
    map.setView([lat, lng], 17);
  }
}

function refreshRouteColors() {
  if (!routeLine) return;
  const isDay = (currentTheme === "day");
  if (routeLineCasing) {
    routeLineCasing.setStyle({
      color: isDay ? "#1557B0" : "#185ABC",
      opacity: isDay ? 0.95 : 0.9
    });
  }
  if (routeLine) {
    routeLine.setStyle({
      color: isDay ? "#1A73E8" : "#4285F4"
    });
  }
}

function setTheme(theme) {
  currentTheme = (theme === "night" || theme === "dark") ? "night" : "day";
  if (currentTheme === "night") {
    document.body.classList.remove("day-mode");
    document.body.classList.add("dark-mode");
    if (tileLayer) tileLayer.setUrl(NIGHT_TILE_URL);
  } else {
    document.body.classList.remove("dark-mode");
    document.body.classList.add("day-mode");
    if (tileLayer) tileLayer.setUrl(DAY_TILE_URL);
  }
  refreshRouteColors();
}

function drawRoute(coordinates, destLat, destLng, fitBounds = true) {
  clearRoute();

  if (!coordinates || coordinates.length === 0) return;

  activeRouteCoordinates = coordinates;

  // Add route segments into permanent road network cache
  for (let i = 0; i < coordinates.length - 1; i++) {
    roadNetworkSegments.push({
      p1: coordinates[i],
      p2: coordinates[i + 1],
      segIndex: i,
      source: "route"
    });
  }

  const isDay = (currentTheme === "day");

  // Google Maps Style Polyline (Outer Darker Casing for High Contrast)
  routeLineCasing = L.polyline(coordinates, {
    color: isDay ? "#1557B0" : "#185ABC",
    weight: 9.5,
    opacity: isDay ? 0.95 : 0.9,
    lineCap: "round",
    lineJoin: "round"
  }).addTo(map);

  // Multi-Segment Traffic Coloring (Blue -> Orange -> Red -> Blue)
  if (coordinates.length >= 8) {
    const p1 = Math.floor(coordinates.length * 0.35);
    const p2 = Math.floor(coordinates.length * 0.60);
    const p3 = Math.floor(coordinates.length * 0.78);

    const seg1Coords = coordinates.slice(0, p1 + 1);
    const seg2Coords = coordinates.slice(p1, p2 + 1);
    const seg3Coords = coordinates.slice(p2, p3 + 1);
    const seg4Coords = coordinates.slice(p3);

    // Segment 1: Blue Clear Traffic
    const line1 = L.polyline(seg1Coords, {
      color: isDay ? "#1A73E8" : "#4285F4",
      weight: 5.5,
      opacity: 1.0,
      lineCap: "round",
      lineJoin: "round"
    }).addTo(map);
    trafficPolylines.push(line1);

    // Segment 2: Orange Moderate Traffic Slowdown
    const line2 = L.polyline(seg2Coords, {
      color: "#FB8C00",
      weight: 5.5,
      opacity: 1.0,
      lineCap: "round",
      lineJoin: "round"
    }).addTo(map);
    trafficPolylines.push(line2);

    // Segment 3: Red Congestion
    const line3 = L.polyline(seg3Coords, {
      color: "#EA4335",
      weight: 5.5,
      opacity: 1.0,
      lineCap: "round",
      lineJoin: "round"
    }).addTo(map);
    trafficPolylines.push(line3);

    // Segment 4: Blue Clear Final Approach
    const line4 = L.polyline(seg4Coords, {
      color: isDay ? "#1A73E8" : "#4285F4",
      weight: 5.5,
      opacity: 1.0,
      lineCap: "round",
      lineJoin: "round"
    }).addTo(map);
    trafficPolylines.push(line4);

    // Add Authentic Google Maps Roadway Features along the Route
    // 1. Red Octagonal STOP Sign at First Major Intersection
    const stopIcon = L.divIcon({
      className: "",
      html: '<div class="map-stop-sign">STOP</div>',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });
    const stopMarker1 = L.marker(coordinates[p1], { icon: stopIcon, zIndexOffset: 750 }).addTo(map);
    routeFeatureMarkers.push(stopMarker1);

    // 2. Traffic Light Capsule at Signalized Junction
    const tlIcon = L.divIcon({
      className: "",
      html: '<div class="map-traffic-light">' +
            '  <div class="traffic-light-dot t-red"></div>' +
            '  <div class="traffic-light-dot t-yellow"></div>' +
            '  <div class="traffic-light-dot t-green"></div>' +
            '</div>',
      iconSize: [14, 26],
      iconAnchor: [7, 13]
    });
    const tlMarker = L.marker(coordinates[p2], { icon: tlIcon, zIndexOffset: 760 }).addTo(map);
    routeFeatureMarkers.push(tlMarker);

    // 3. Second STOP Sign near destination turn
    const stopMarker2 = L.marker(coordinates[p3], { icon: stopIcon, zIndexOffset: 750 }).addTo(map);
    routeFeatureMarkers.push(stopMarker2);

    // 4. "Similar ETA" Speech Bubble along detour
    const etaIcon = L.divIcon({
      className: "",
      html: '<div class="map-similar-eta">Similar ETA</div>',
      iconSize: [85, 24],
      iconAnchor: [42, 12]
    });
    const etaPt = coordinates[Math.max(1, Math.floor(coordinates.length * 0.18))];
    const etaMarker = L.marker(etaPt, { icon: etaIcon, zIndexOffset: 700 }).addTo(map);
    routeFeatureMarkers.push(etaMarker);

  } else {
    // Shorter or fallback single core line
    routeLine = L.polyline(coordinates, {
      color: isDay ? "#1A73E8" : "#4285F4",
      weight: 5.5,
      opacity: 1.0,
      lineCap: "round",
      lineJoin: "round"
    }).addTo(map);
  }

  if (destLat && destLng) {
    destinationMarker = L.marker([destLat, destLng], { icon: destIcon, zIndexOffset: 950 }).addTo(map);
  }

  if (fitBounds) {
    const boundsTarget = routeLineCasing || routeLine;
    if (boundsTarget) {
      map.fitBounds(boundsTarget.getBounds(), {
        paddingTopLeft: [50, 100],
        paddingBottomRight: [50, 220],
        animate: true
      });
    }
  }

  if (currentVehiclePos) {
    updateFlowArrow(currentVehiclePos.lat, currentVehiclePos.lng, currentHeading, 0, true);
  }
}

function clearRoute() {
  activeRouteCoordinates = null;
  lastMatchedSegment = null;
  if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
  if (routeLineCasing) { map.removeLayer(routeLineCasing); routeLineCasing = null; }
  if (trafficPolylines && trafficPolylines.length > 0) {
    trafficPolylines.forEach(p => map.removeLayer(p));
    trafficPolylines = [];
  }
  if (routeFeatureMarkers && routeFeatureMarkers.length > 0) {
    routeFeatureMarkers.forEach(m => map.removeLayer(m));
    routeFeatureMarkers = [];
  }
  if (destinationMarker) { map.removeLayer(destinationMarker); destinationMarker = null; }
  if (currentVehiclePos) {
    updateFlowArrow(currentVehiclePos.lat, currentVehiclePos.lng, currentHeading, -1, false);
  }
}

// Detect manual user drag/pan on map
map.on("dragstart", function() {
  if (isNavigating) {
    isCameraFollowing = false;
    sendMessage({ type: "user_panned_map" });
  }
});

// Changed from 'click' to 'contextmenu' to require a long-press on mobile
map.on("contextmenu", function(e) {
  sendMessage({
    type: "map_clicked",
    lat: e.latlng.lat,
    lng: e.latlng.lng
  });
});

function sendMessage(msgObj) {
  const jsonStr = JSON.stringify(msgObj);
  if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
    window.ReactNativeWebView.postMessage(jsonStr);
  } else if (window.parent && window.parent.postMessage) {
    window.parent.postMessage(jsonStr, "*");
  }
}

function handleMessage(event) {
  try {
    const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
    if (!data) return;

    if (data.type === "set_theme") {
      setTheme(data.theme);
    } else if (data.type === "vehicle_position") {
      updateVehicle(data.lat, data.lng, data.heading, data.nav_mode, data.speed, data.zupt_active);
    } else if (data.type === "phone_gps") {
      updateGPS(data.lat, data.lng);
    } else if (data.type === "initial_location") {
      updateGPS(data.lat, data.lng);
      map.setView([data.lat, data.lng], 17, { animate: true });
    } else if (data.type === "draw_route") {
      drawRoute(data.coordinates, data.destLat, data.destLng, data.fitBounds !== false);
    } else if (data.type === "clear_route") {
      clearRoute();
    } else if (data.type === "clear_trail") {
      clearTrail();
    } else if (data.type === "set_navigation_state") {
      isNavigating = Boolean(data.isNavigating);
      isCameraFollowing = true;
      if (isNavigating && currentVehiclePos) {
        map.setView([currentVehiclePos.lat, currentVehiclePos.lng], 18, { animate: true });
      }
    } else if (data.type === "recenter") {
      isCameraFollowing = true;
      const target = data.lat && data.lng ? [data.lat, data.lng] : (currentVehiclePos ? [currentVehiclePos.lat, currentVehiclePos.lng] : null);
      if (target) {
        map.setView(target, isNavigating ? 18 : 17, { animate: true });
        map.invalidateSize();
      }
    } else if (data.type === "road_network_seed") {
      if (data.lat && data.lng) {
        // Add nearest road anchor to cache
        if (roadNetworkSegments.length > 50) roadNetworkSegments.shift();
        const fwd = getForwardPoint(data.lat, data.lng, 90, 20);
        roadNetworkSegments.push({
          p1: [data.lat, data.lng],
          p2: fwd,
          segIndex: roadNetworkSegments.length,
          source: "nearest_seed"
        });
      }
    } else if (data.type === "zoom_in") {
      map.zoomIn();
    } else if (data.type === "zoom_out") {
      map.zoomOut();
    } else if (data.type === "invalidate_size") {
      map.invalidateSize();
    }
  } catch (e) {
    console.log("[Map] Event message error:", e);
  }
}

document.addEventListener("message", handleMessage);
window.addEventListener("message", handleMessage);

window.onload = function() {
  setTimeout(function() {
    map.invalidateSize();
  }, 250);
};

window.addEventListener("resize", function() {
  map.invalidateSize();
});
</script>
</body>
</html>
`;
