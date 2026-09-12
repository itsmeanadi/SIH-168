import * as Speech from "expo-speech";
import { formatDistance } from "./googleMapsService";

// ============================================================
// SIH-168 — Intelligent Voice Navigation Assistant Engine
// Free Native TTS • Intent Recognition • GNSS Alert Voice
// Priority: ARRIVAL > IMMEDIATE_MANEUVER > REROUTE > GNSS_STATE > UPCOMING_MANEUVER > QUERY
// ============================================================

export const PRIORITY = {
  QUERY: 1,
  UPCOMING_MANEUVER: 2,
  GNSS_STATE: 3,
  REROUTE: 4,
  IMMEDIATE_MANEUVER: 5,
  ARRIVAL: 6,
};

class VoiceNavigationAssistant {
  constructor() {
    this.isSpeaking = false;
    this.currentPriority = 0;
    this.lastAnnouncedStepIndex = -1;
    this.lastAnnouncedPhase = null; // 'approaching' | 'immediate'
    this.lastAnnouncedMode = null;
    this.lastOffRouteAnnounced = false;
    this.lastArrivalAnnounced = false;
    this.activeSpeechId = 0;
  }

  /**
   * Speaks text using Expo Speech with priority interruption.
   * Higher priority cancels any lower/equal in-progress speech immediately.
   */
  async speak(text, priority = PRIORITY.QUERY) {
    if (!text || typeof text !== "string") return;
    const cleanText = text.trim();
    if (!cleanText) return;

    // If currently speaking a higher priority item, do not interrupt
    if (this.isSpeaking && priority < this.currentPriority) {
      return;
    }

    const currentId = ++this.activeSpeechId;
    this.currentPriority = priority;

    try {
      if (this.isSpeaking) {
        await Speech.stop();
      }

      this.isSpeaking = true;

      Speech.speak(cleanText, {
        language: "en-US",
        rate: 0.98,
        pitch: 1.0,
        onDone: () => {
          if (this.activeSpeechId === currentId) {
            this.isSpeaking = false;
            this.currentPriority = 0;
          }
        },
        onStopped: () => {
          if (this.activeSpeechId === currentId) {
            this.isSpeaking = false;
            this.currentPriority = 0;
          }
        },
        onError: () => {
          if (this.activeSpeechId === currentId) {
            this.isSpeaking = false;
            this.currentPriority = 0;
          }
        },
      });
    } catch (e) {
      console.log("[Voice] Speech error:", e);
      this.isSpeaking = false;
      this.currentPriority = 0;
    }
  }

  /**
   * Cancels any active speech immediately.
   */
  async stop() {
    this.activeSpeechId++;
    this.isSpeaking = false;
    this.currentPriority = 0;
    try {
      await Speech.stop();
    } catch (_) {}
  }

  /**
   * Resets route tracking state when a new navigation session begins.
   */
  resetSession() {
    this.lastAnnouncedStepIndex = -1;
    this.lastAnnouncedPhase = null;
    this.lastOffRouteAnnounced = false;
    this.lastArrivalAnnounced = false;
    this.stop();
  }

  /**
   * Smart Turn-by-Turn Maneuver Announcement.
   * Event-based: avoids repeated chatter.
   * - Phase 1 (Approaching): at ~250m - 400m ("In 300 meters, turn left.")
   * - Phase 2 (Immediate): at < 55m ("Turn left.")
   */
  checkManeuverAnnouncement(step, stepIndex, distanceToStepMeters) {
    if (!step || typeof distanceToStepMeters !== "number") return;

    if (this.lastAnnouncedStepIndex !== stepIndex) {
      this.lastAnnouncedStepIndex = stepIndex;
      this.lastAnnouncedPhase = null;
    }

    const dist = Math.max(0, distanceToStepMeters);

    // Phase 1: Approaching Maneuver (120m - 450m)
    if (dist <= 450 && dist > 120 && this.lastAnnouncedPhase !== "approaching") {
      this.lastAnnouncedPhase = "approaching";
      const readableDist = formatDistance(dist);
      const instruction = step.instruction || "continue on route";
      this.speak(`In ${readableDist}, ${instruction}.`, PRIORITY.UPCOMING_MANEUVER);
      return;
    }

    // Phase 2: Immediate Maneuver (< 55m)
    if (dist <= 55 && dist > 8 && this.lastAnnouncedPhase !== "immediate") {
      this.lastAnnouncedPhase = "immediate";
      const instruction = step.instruction || "make the turn";
      this.speak(`${instruction}.`, PRIORITY.IMMEDIATE_MANEUVER);
    }
  }

  /**
   * SIH-168 GNSS Loss & Recovery Voice Notification.
   * Crucial differentiator: speaks once on genuine mode transition.
   */
  checkGnssTransitionAnnouncement(currentMode, isBlackout) {
    const effectiveMode = isBlackout ? "DR" : currentMode;

    if (this.lastAnnouncedMode === null) {
      this.lastAnnouncedMode = effectiveMode;
      return;
    }

    if (this.lastAnnouncedMode !== effectiveMode) {
      if (effectiveMode === "DR") {
        this.speak("GPS signal lost. Dead reckoning navigation is active.", PRIORITY.GNSS_STATE);
      } else if (effectiveMode === "GNSS") {
        this.speak("GPS signal recovered.", PRIORITY.GNSS_STATE);
      }
      this.lastAnnouncedMode = effectiveMode;
    }
  }

  /**
   * Off-Route State Voice Notification.
   */
  checkOffRouteAnnouncement(navState) {
    if (navState === "OFF_ROUTE" && !this.lastOffRouteAnnounced) {
      this.lastOffRouteAnnounced = true;
      this.speak("You're off route. Finding a new route.", PRIORITY.REROUTE);
    } else if (navState === "NAVIGATING" && this.lastOffRouteAnnounced) {
      this.lastOffRouteAnnounced = false;
      this.speak("Route updated.", PRIORITY.REROUTE);
    }
  }

  /**
   * Arrival Voice Notification.
   */
  checkArrivalAnnouncement() {
    if (!this.lastArrivalAnnounced) {
      this.lastArrivalAnnounced = true;
      this.speak("You've arrived.", PRIORITY.ARRIVAL);
    }
  }

  /**
   * Deterministic Natural-Language Intent Parser.
   * Maps raw spoken user commands to actionable navigation intents without LLM.
   */
  parseVoiceIntent(rawText) {
    if (!rawText || typeof rawText !== "string") {
      return { type: "UNKNOWN", text: "" };
    }

    const t = rawText.trim().toLowerCase().replace(/[.,!?;:]/g, "");

    // 1. ACTION: START NAVIGATION (English & Hindi)
    if (
      t === "start navigation" ||
      t === "start" ||
      t === "begin navigation" ||
      t === "begin" ||
      t === "let's go" ||
      t === "lets go" ||
      t === "start route" ||
      t.includes("start nav") ||
      t.includes("shuru karo") ||
      t.includes("chalo") ||
      t.includes("start karo")
    ) {
      return { type: "START_NAVIGATION" };
    }

    // 2. ACTION: STOP / CANCEL NAVIGATION (English & Hindi)
    if (
      t === "stop navigation" ||
      t === "cancel navigation" ||
      t === "stop" ||
      t === "cancel" ||
      t === "exit navigation" ||
      t === "end route" ||
      t.includes("stop nav") ||
      t.includes("cancel route") ||
      t.includes("band karo") ||
      t.includes("roko") ||
      t.includes("khatam karo")
    ) {
      return { type: "STOP_NAVIGATION" };
    }

    // 3. ACTION: RECENTER CAMERA
    if (
      t === "recenter" ||
      t === "recenter the map" ||
      t === "re-center" ||
      t === "center map" ||
      t === "find me" ||
      t === "focus" ||
      t.includes("recenter") ||
      t.includes("center karo")
    ) {
      return { type: "RECENTER" };
    }

    // 4. INFORMATION: SPEED (English & Hindi)
    if (
      t.includes("speed") ||
      t.includes("how fast") ||
      t === "what is my speed" ||
      t === "what's my speed" ||
      t.includes("my speed") ||
      t.includes("kitni speed") ||
      t.includes("gaadi ki speed") ||
      t.includes("speed batao") ||
      t.includes("raftaar")
    ) {
      return { type: "QUERY_SPEED" };
    }

    // 5. INFORMATION: CURRENT LOCATION ("Where am I?" / "Hum kaha hai?")
    if (
      t === "where am i" ||
      t.includes("where am i") ||
      t.includes("current location") ||
      t.includes("what place is this") ||
      t.includes("my position") ||
      t.includes("kaha hu") ||
      t.includes("kaha hai") ||
      t.includes("meri location")
    ) {
      return { type: "QUERY_POSITION" };
    }

    // 6. INFORMATION: ETA / DURATION ("How long will it take?" / "Kitna time lagega?")
    if (
      t.includes("how long") ||
      t.includes("eta") ||
      t.includes("how much time") ||
      t.includes("when will we arrive") ||
      t.includes("arrival time") ||
      t.includes("kitna time") ||
      t.includes("kitna samay") ||
      t.includes("kab pahuchenge") ||
      t.includes("der lagegi")
    ) {
      return { type: "QUERY_ETA" };
    }

    // 7. INFORMATION: REMAINING DISTANCE ("How far is the destination?" / "Kitni door hai?")
    if (
      t.includes("how far") ||
      t.includes("remaining distance") ||
      t.includes("distance left") ||
      t.includes("how much distance") ||
      t.includes("kitni door") ||
      t.includes("door hai") ||
      t.includes("kitna distance")
    ) {
      return { type: "QUERY_DISTANCE" };
    }

    // 8. NAVIGATION: NEXT TURN / MANEUVER ("Next turn?" / "Agla turn?")
    if (
      t.includes("next turn") ||
      t.includes("next maneuver") ||
      t.includes("where do i turn") ||
      t.includes("what's the next turn") ||
      t.includes("how far until the next turn") ||
      t.includes("which turn") ||
      t.includes("agla turn") ||
      t.includes("kaha mudna") ||
      t.includes("kidhar mudna")
    ) {
      return { type: "QUERY_NEXT_MANEUVER" };
    }

    // 9. DESTINATION INTENTS ("Take me to DB Mall", "Navigate to Bhopal Railway Station", "DB mall le chalo")
    const destPatterns = [
      /^(?:take me to|navigate to|go to|drive to|directions to|route to|find)\s+(.+)$/i,
      /^(?:i want to go to|head to)\s+(.+)$/i,
      /^(.+?)\s+(?:le chalo|chalo|le jao|jaana hai)$/i,
    ];

    for (const pattern of destPatterns) {
      const match = t.match(pattern);
      if (match && match[1]) {
        const query = match[1].trim();
        if (query.length >= 2) {
          return { type: "DESTINATION_SEARCH", query };
        }
      }
    }

    // 10. Fallback: If it's a short 1-4 word query that isn't a known question, treat as destination
    const words = t.split(/\s+/);
    if (
      words.length >= 1 &&
      words.length <= 5 &&
      !t.includes("what") &&
      !t.includes("how") &&
      !t.includes("where") &&
      !t.includes("kaha") &&
      !t.includes("kitna")
    ) {
      return { type: "DESTINATION_SEARCH", query: rawText.trim() };
    }

    return { type: "UNKNOWN", text: rawText };
  }
}

export const voiceAssistant = new VoiceNavigationAssistant();
