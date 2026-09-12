// ============================================================
// SIH-168 — Constants & Configuration
// ============================================================

export const SERVER_IP = "10.89.225.193";
export const SERVER_PORT = 8765;
export const WEBSOCKET_URL = `ws://${SERVER_IP}:${SERVER_PORT}`;
export const G_TO_MS2 = 9.80665;

// Google Maps & Routes API Key configuration
export const GOOGLE_MAPS_API_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
  process.env.GOOGLE_MAPS_API_KEY ||
  "AIzaSyBP6FegoqfbZjxpL-qSsGT3Eau6BrE260w";
