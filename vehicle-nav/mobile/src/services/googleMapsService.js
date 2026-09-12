import { GOOGLE_MAPS_API_KEY } from "../constants/config";

// ============================================================
// SIH-168 — Google Maps, Places & Routes Service Engine
// ============================================================

/**
 * Calculates Haversine distance in meters between two lat/lng coordinates
 */
export function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Formats seconds into human-readable duration (e.g. "14 min", "1 hr 20 min")
 */
export function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return "1 min";
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hours} hr ${remMins} min` : `${hours} hr`;
}

/**
 * Formats meters into human-readable distance (e.g. "450 m", "3.8 km")
 */
export function formatDistance(meters) {
  if (!meters || meters <= 0) return "0 m";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Calculates arrival clock time from duration in seconds (e.g. "4:15 PM")
 */
export function calculateEtaTime(durationSeconds) {
  const now = new Date();
  const arrival = new Date(now.getTime() + (durationSeconds || 0) * 1000);
  let hours = arrival.getHours();
  const minutes = arrival.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${hours}:${minutes} ${ampm}`;
}

/**
 * Decodes a Google encoded polyline string into an array of [lat, lng] coordinates
 */
export function decodePolyline(encoded) {
  if (!encoded) return [];
  const points = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

/**
 * Parses maneuver string/type into standard icon symbol & clear instruction
 */
export function parseManeuver(maneuver, modifier = "", text = "") {
  const m = (maneuver || "").toLowerCase();
  const mod = (modifier || "").toLowerCase();

  let icon = "↑";
  let label = text || "Proceed straight";

  if (m.includes("turn") || m.includes("fork")) {
    if (mod.includes("sharp right") || m.includes("sharp-right")) {
      icon = "↱";
    } else if (mod.includes("right") || m.includes("right")) {
      icon = "↱";
    } else if (mod.includes("sharp left") || m.includes("sharp-left")) {
      icon = "↰";
    } else if (mod.includes("left") || m.includes("left")) {
      icon = "↰";
    }
  } else if (m.includes("uturn") || m.includes("u-turn")) {
    icon = "⤹";
  } else if (m.includes("roundabout") || m.includes("rotary")) {
    icon = "⟳";
  } else if (m.includes("ramp") || m.includes("merge")) {
    icon = mod.includes("left") ? "↰" : "↱";
  } else if (m.includes("arrive") || m.includes("destination")) {
    icon = "🏁";
  }

  return { icon, label };
}

/**
 * Searches real places and addresses with Google Places API + Nominatim/Photon fallback
 */
export async function searchPlaces(query, userLat = null, userLng = null) {
  if (!query || query.trim().length < 2) return [];
  const q = query.trim();

  // 1. If Google Maps API Key is provided, use Google Places API
  if (GOOGLE_MAPS_API_KEY && GOOGLE_MAPS_API_KEY.length > 5) {
    try {
      let url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
        q
      )}&key=${GOOGLE_MAPS_API_KEY}`;

      if (userLat && userLng) {
        url += `&location=${userLat},${userLng}&radius=50000`;
      }

      const res = await fetch(url);
      const data = await res.json();

      if (data.status === "OK" && data.predictions && data.predictions.length > 0) {
        // Fetch place coordinates & rich details (Rating, Category, Accessibility)
        const results = await Promise.all(
          data.predictions.slice(0, 6).map(async (pred) => {
            try {
              const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${pred.place_id}&fields=geometry,name,formatted_address,rating,user_ratings_total,types,wheelchair_accessible_entrance,editorial_summary&key=${GOOGLE_MAPS_API_KEY}`;
              const detailRes = await fetch(detailUrl);
              const detailData = await detailRes.json();
              if (detailData.status === "OK" && detailData.result?.geometry?.location) {
                const loc = detailData.result.geometry.location;
                const r = detailData.result;
                const dist = userLat && userLng ? getDistanceMeters(userLat, userLng, loc.lat, loc.lng) : null;
                const primaryType = r.types && r.types.length > 0 ? r.types[0].replace(/_/g, " ") : "Place";
                return {
                  id: pred.place_id,
                  placeId: pred.place_id,
                  title: pred.structured_formatting?.main_text || r.name,
                  subtitle: pred.structured_formatting?.secondary_text || r.formatted_address,
                  address: r.formatted_address,
                  lat: loc.lat,
                  lng: loc.lng,
                  distance: dist,
                  formattedDistance: dist ? formatDistance(dist) : null,
                  icon: getCategoryIcon(pred.types),
                  rating: r.rating || null,
                  userRatingsTotal: r.user_ratings_total || null,
                  placeType: primaryType,
                  isAccessible: r.wheelchair_accessible_entrance === true,
                  summary: r.editorial_summary?.overview || null,
                };
              }
            } catch (_) {}
            return null;
          })
        );
        const valid = results.filter(Boolean);
        if (valid.length > 0) return valid;
      }
    } catch (e) {
      console.log("[Places] Google API fetch error, falling back to Geocoder:", e);
    }
  }

  // 2. High-reliability Production Geocoding Engine (Photon / Nominatim)
  try {
    let photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=8`;
    if (userLat && userLng) {
      photonUrl += `&lat=${userLat}&lon=${userLng}`;
    }

    const res = await fetch(photonUrl);
    const data = await res.json();

    if (data && data.features && data.features.length > 0) {
      return data.features.map((feat, idx) => {
        const coords = feat.geometry.coordinates; // [lng, lat]
        const p = feat.properties || {};
        const title = p.name || p.street || p.city || q;
        const subParts = [p.street, p.district, p.city, p.state, p.country].filter(Boolean);
        const subtitle = subParts.length > 0 ? subParts.join(", ") : "Destination location";
        const dist = userLat && userLng ? getDistanceMeters(userLat, userLng, coords[1], coords[0]) : null;

        return {
          id: `photon_${idx}_${coords[1]}_${coords[0]}`,
          title,
          subtitle,
          lat: coords[1],
          lng: coords[0],
          distance: dist,
          formattedDistance: dist ? formatDistance(dist) : null,
          icon: getCategoryIconFromProps(p),
        };
      });
    }
  } catch (err) {
    console.log("[Places] Photon search error, trying Nominatim fallback:", err);
  }

  // 3. Nominatim Fallback
  try {
    const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      q
    )}&format=json&addressdetails=1&limit=6`;
    const res = await fetch(nomUrl, {
      headers: { "User-Agent": "SIH-168-VehicleNavigation/1.0" },
    });
    const data = await res.json();

    if (Array.isArray(data) && data.length > 0) {
      return data.map((item, idx) => {
        const lat = parseFloat(item.lat);
        const lng = parseFloat(item.lon);
        const dist = userLat && userLng ? getDistanceMeters(userLat, userLng, lat, lng) : null;
        const parts = (item.display_name || "").split(",");
        const title = parts[0] || q;
        const subtitle = parts.slice(1, 4).join(",").trim() || "Destination Location";

        return {
          id: `nom_${idx}_${lat}_${lng}`,
          title,
          subtitle,
          lat,
          lng,
          distance: dist,
          formattedDistance: dist ? formatDistance(dist) : null,
          icon: "📍",
        };
      });
    }
  } catch (nomErr) {
    console.log("[Places] Nominatim error:", nomErr);
  }

  return [];
}

/**
 * Computes driving route using Google Routes API / Directions API with OSRM fallback
 */
export async function getRoute(origin, destination, lang = "en") {
  if (!origin || !destination) {
    throw new Error("Invalid origin or destination coordinates.");
  }

  const { lat: origLat, lng: origLng } = origin;
  const { lat: destLat, lng: destLng } = destination;

  // 1. Google Routes API (Directions API v2 / v1) if key is present
  if (GOOGLE_MAPS_API_KEY && GOOGLE_MAPS_API_KEY.length > 5) {
    try {
      // Try Google Routes API v2
      const routesV2Url = "https://routes.googleapis.com/directions/v2:computeRoutes";
      const body = {
        origin: { location: { latLng: { latitude: origLat, longitude: origLng } } },
        destination: { location: { latLng: { latitude: destLat, longitude: destLng } } },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
        units: "METRIC",
        languageCode: lang,
      };

      const res = await fetch(routesV2Url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
          "X-Goog-FieldMask":
            "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.steps",
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (data && data.routes && data.routes.length > 0) {
        const r = data.routes[0];
        const distMeters = r.distanceMeters || 0;
        const durationSec = parseInt((r.duration || "0s").replace("s", ""), 10) || 0;
        const coordinates = decodePolyline(r.polyline?.encodedPolyline);

        const steps = (r.legs?.[0]?.steps || []).map((s) => {
          const maneuverInfo = parseManeuver(
            s.navigationInstruction?.maneuver,
            "",
            s.navigationInstruction?.instructions
          );
          return {
            instruction: s.navigationInstruction?.instructions || maneuverInfo.label,
            icon: maneuverInfo.icon,
            distanceMeters: s.distanceMeters || 0,
            formattedDistance: formatDistance(s.distanceMeters || 0),
          };
        });

        return {
          source: "GOOGLE_ROUTES_API",
          distanceMeters: distMeters,
          durationSeconds: durationSec,
          formattedDistance: formatDistance(distMeters),
          formattedDuration: formatDuration(durationSec),
          etaTime: calculateEtaTime(durationSec),
          coordinates,
          steps: steps.length > 0 ? steps : [{ instruction: "Follow the route", icon: "↑", distanceMeters: distMeters, formattedDistance: formatDistance(distMeters) }],
          initialManeuver: steps[0] || { instruction: "Proceed along route", icon: "↑", formattedDistance: "300 m" },
        };
      }
    } catch (e) {
      console.log("[Routes] Google Routes API error, falling back to Directions API/OSRM:", e);
    }
  }

  // 2. High-Performance Project OSRM Routing Engine
  const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${origLng},${origLat};${destLng},${destLat}?overview=full&geometries=geojson&steps=true&language=${lang}`;
  const res = await fetch(osrmUrl);
  const data = await res.json();

  if (data.code === "Ok" && data.routes && data.routes.length > 0) {
    const route = data.routes[0];
    const distMeters = route.distance || 0;
    const durationSec = Math.round(route.duration || 0);
    const coordinates = (route.geometry?.coordinates || []).map((coord) => [coord[1], coord[0]]);

    const rawSteps = route.legs?.[0]?.steps || [];
    const steps = rawSteps.map((step) => {
      const maneuverType = step.maneuver?.type || "proceed";
      const modifier = step.maneuver?.modifier || "";
      const streetName = step.name ? ` onto ${step.name}` : "";
      const instructionText = `${capitalize(maneuverType)}${modifier ? " " + modifier : ""}${streetName}`;
      const { icon, label } = parseManeuver(maneuverType, modifier, instructionText);

      return {
        instruction: label,
        icon,
        distanceMeters: step.distance || 0,
        formattedDistance: formatDistance(step.distance || 0),
      };
    });

    const initialManeuver = steps.length > 1 ? steps[1] : steps[0] || { instruction: "Proceed on route", icon: "↑", formattedDistance: "300 m" };

    return {
      source: "OSRM_ROUTING_ENGINE",
      distanceMeters: distMeters,
      durationSeconds: durationSec,
      formattedDistance: formatDistance(distMeters),
      formattedDuration: formatDuration(durationSec),
      etaTime: calculateEtaTime(durationSec),
      coordinates,
      steps,
      initialManeuver,
    };
  }

  throw new Error("Unable to calculate driving route to destination.");
}

/**
 * Checks if current vehicle position has strayed off the active route polyline
 */
export function isOffRoute(vehiclePos, routeCoords, thresholdMeters = 45) {
  if (!vehiclePos || !routeCoords || routeCoords.length < 2) return false;
  let minDistance = Infinity;

  // Find minimum perpendicular distance to any segment on the route
  for (let i = 0; i < routeCoords.length - 1; i++) {
    const p1 = routeCoords[i];
    const p2 = routeCoords[i + 1];
    const dist = distanceToSegment(vehiclePos.lat, vehiclePos.lng, p1[0], p1[1], p2[0], p2[1]);
    if (dist < minDistance) {
      minDistance = dist;
    }
    if (minDistance <= thresholdMeters) {
      return false; // Close enough to route
    }
  }

  return minDistance > thresholdMeters;
}

/**
 * Shortest distance from a point to a line segment
 */
function distanceToSegment(pLat, pLng, aLat, aLng, bLat, bLng) {
  const dAB = getDistanceMeters(aLat, aLng, bLat, bLng);
  if (dAB === 0) return getDistanceMeters(pLat, pLng, aLat, aLng);

  // Project point onto segment
  const t = Math.max(
    0,
    Math.min(
      1,
      ((pLat - aLat) * (bLat - aLat) + (pLng - aLng) * (bLng - aLng)) /
        ((bLat - aLat) ** 2 + (bLng - aLng) ** 2)
    )
  );

  const projLat = aLat + t * (bLat - aLat);
  const projLng = aLng + t * (bLng - aLng);
  return getDistanceMeters(pLat, pLng, projLat, projLng);
}

function getCategoryIcon(types = []) {
  if (!types || !Array.isArray(types)) return "📍";
  const t = types.join(" ");
  if (t.includes("airport")) return "✈️";
  if (t.includes("gas_station") || t.includes("charging")) return "⛽";
  if (t.includes("hospital") || t.includes("health")) return "🏥";
  if (t.includes("transit") || t.includes("station") || t.includes("subway")) return "🚉";
  if (t.includes("restaurant") || t.includes("food") || t.includes("cafe")) return "🍽️";
  if (t.includes("shopping") || t.includes("mall") || t.includes("store")) return "🛍️";
  if (t.includes("lodging") || t.includes("hotel")) return "🏨";
  return "📍";
}

function getCategoryIconFromProps(p = {}) {
  const osmKey = p.osm_key || "";
  const osmVal = p.osm_value || "";
  if (osmKey === "aeroway" || osmVal === "aerodrome") return "✈️";
  if (osmVal === "fuel" || osmVal === "charging_station") return "⚡";
  if (osmVal === "hospital" || osmVal === "pharmacy") return "🏥";
  if (osmVal === "station" || osmVal === "bus_stop" || osmVal === "halt") return "🚉";
  if (osmVal === "restaurant" || osmVal === "cafe" || osmVal === "fast_food") return "🍽️";
  if (osmVal === "supermarket" || osmVal === "mall" || osmVal === "department_store") return "🛍️";
  if (osmVal === "hotel" || osmVal === "guest_house") return "🏨";
  return "📍";
}

function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Reverse geocodes a lat/lng position into a human-readable nearby location name
 */
export async function reverseGeocode(lat, lng) {
  if (!lat || !lng) return null;

  // 1. Google Reverse Geocoding if API key is set
  if (GOOGLE_MAPS_API_KEY && GOOGLE_MAPS_API_KEY.length > 5) {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === "OK" && data.results && data.results.length > 0) {
        const top = data.results[0];
        const compound = top.address_components?.find((c) =>
          c.types.includes("sublocality") || c.types.includes("neighborhood") || c.types.includes("route")
        );
        return compound?.long_name || top.formatted_address?.split(",")[0] || top.formatted_address;
      }
    } catch (_) {}
  }

  // 2. Nominatim / OpenStreetMap Reverse Geocoder
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": "SIH-168-Vehicle-Nav/1.0" },
    });
    const data = await res.json();
    if (data && data.address) {
      const a = data.address;
      const place = a.road || a.suburb || a.neighbourhood || a.commercial || a.city || a.town;
      if (place) return place;
      if (data.display_name) return data.display_name.split(",")[0];
    }
  } catch (err) {
    console.log("[ReverseGeocode] Lookup error:", err);
  }

  return null;
}

/**
 * Snaps a coordinate to the nearest road using Google Roads API + OSRM fallback
 * Returns nearest road centerline coordinates, road name, and distance in meters
 */
export async function snapToNearestRoad(lat, lng) {
  if (!lat || !lng || isNaN(lat) || isNaN(lng)) return null;

  // 1. Google Roads API: nearestRoads
  if (GOOGLE_MAPS_API_KEY && GOOGLE_MAPS_API_KEY.length > 5) {
    try {
      const url = `https://roads.googleapis.com/v1/nearestRoads?points=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data && data.snappedPoints && data.snappedPoints.length > 0) {
        const top = data.snappedPoints[0];
        const snappedLat = top.location.latitude;
        const snappedLng = top.location.longitude;
        const dist = getDistanceMeters(lat, lng, snappedLat, snappedLng);
        return {
          lat: snappedLat,
          lng: snappedLng,
          name: top.placeId ? "Road Centerline" : "",
          placeId: top.placeId,
          distance: dist,
        };
      }
    } catch (_) {}
  }

  // 2. OSRM Nearest Service fallback
  try {
    const url = `https://router.project-osrm.org/nearest/v1/driving/${lng},${lat}?number=3`;
    const res = await fetch(url);
    const data = await res.json();
    if (data && data.code === "Ok" && data.waypoints && data.waypoints.length > 0) {
      const top = data.waypoints[0];
      return {
        lat: top.location[1],
        lng: top.location[0],
        name: top.name || "",
        distance: top.distance || 0,
        candidates: data.waypoints.map((wp) => ({
          lat: wp.location[1],
          lng: wp.location[0],
          name: wp.name || "",
          distance: wp.distance || 0,
        })),
      };
    }
  } catch (_) {}
  return null;
}

/**
 * Searches real nearby places (e.g. Gas Stations, Hospitals, Parking, Food) using Google Places Nearby Search API
 */
export async function fetchNearbyPlaces(categoryType, userLat, userLng, radius = 5000) {
  if (!userLat || !userLng) return [];

  const categoryMap = {
    fuel: "gas_station",
    hospital: "hospital",
    parking: "parking",
    food: "restaurant",
    atm: "atm",
    service: "car_repair",
  };

  const gType = categoryMap[categoryType] || categoryType || "gas_station";

  if (GOOGLE_MAPS_API_KEY && GOOGLE_MAPS_API_KEY.length > 5) {
    try {
      const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${userLat},${userLng}&radius=${radius}&type=${gType}&key=${GOOGLE_MAPS_API_KEY}`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.status === "OK" && data.results && data.results.length > 0) {
        return data.results.slice(0, 10).map((r) => {
          const loc = r.geometry?.location || {};
          const dist = getDistanceMeters(userLat, userLng, loc.lat, loc.lng);
          return {
            id: r.place_id,
            placeId: r.place_id,
            title: r.name,
            subtitle: r.vicinity || r.formatted_address || "Nearby location",
            address: r.vicinity,
            lat: loc.lat,
            lng: loc.lng,
            distance: dist,
            formattedDistance: formatDistance(dist),
            rating: r.rating || null,
            userRatingsTotal: r.user_ratings_total || null,
            isOpen: r.opening_hours?.open_now,
            icon: getCategoryIcon(r.types),
            placeType: r.types?.[0]?.replace(/_/g, " ") || gType,
          };
        });
      }
    } catch (e) {
      console.log("[PlacesNearby] Error fetching nearby places:", e);
    }
  }

  return [];
}

/**
 * Retrieves elevation in meters for a coordinate from Google Elevation API
 */
export async function fetchElevation(lat, lng) {
  if (!lat || !lng || !GOOGLE_MAPS_API_KEY) return null;
  try {
    const url = `https://maps.googleapis.com/maps/api/elevation/json?locations=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status === "OK" && data.results && data.results.length > 0) {
      return {
        elevationMeters: data.results[0].elevation,
        resolution: data.results[0].resolution,
      };
    }
  } catch (_) {}
  return null;
}
