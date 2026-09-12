import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Animated,
  ActivityIndicator,
  Modal,
  Platform,
} from "react-native";

// ============================================================
// SIH-168 — Voice Navigation Assistant Interaction Bar
// Interactive Tap-to-Talk Mic • Web Speech • Multi-Language Prompts
// ============================================================

export default function VoiceAssistantBar({
  visible,
  onClose,
  onProcessCommand,
  voiceState, // 'IDLE' | 'LISTENING' | 'PROCESSING' | 'SPEAKING' | 'ERROR'
  transcriptText,
  responseFeedback,
}) {
  const [manualInput, setManualInput] = useState("");
  const [isWebListening, setIsWebListening] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnim1 = useRef(new Animated.Value(0.3)).current;
  const waveAnim2 = useRef(new Animated.Value(0.5)).current;
  const waveAnim3 = useRef(new Animated.Value(0.7)).current;
  const recognitionRef = useRef(null);

  // Helper to start Web Speech Recognition
  const startListening = () => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          if (recognitionRef.current) {
            try {
              recognitionRef.current.abort();
            } catch (_) {}
          }
          const recognition = new SpeechRecognition();
          recognition.continuous = false;
          recognition.interimResults = true;
          recognition.lang = "en-IN"; // English (India) works great with Hinglish names

          recognition.onstart = () => {
            setIsWebListening(true);
          };

          recognition.onresult = (event) => {
            const currentTranscript = Array.from(event.results)
              .map((res) => res[0].transcript)
              .join("");
            if (event.results[0].isFinal) {
              setIsWebListening(false);
              onProcessCommand(currentTranscript);
            }
          };

          recognition.onerror = (e) => {
            console.log("[Voice] Recognition error:", e.error);
            setIsWebListening(false);
          };

          recognition.onend = () => {
            setIsWebListening(false);
          };

          recognition.start();
          recognitionRef.current = recognition;
        } catch (err) {
          console.log("[Voice] Start error:", err);
          setIsWebListening(false);
        }
      }
    }
  };

  // Start listening automatically when modal opens
  useEffect(() => {
    if (visible) {
      startListening();
    }
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (_) {}
        recognitionRef.current = null;
      }
      setIsWebListening(false);
    };
  }, [visible]);

  // Pulsing animation for LISTENING state
  useEffect(() => {
    const active = voiceState === "LISTENING" || isWebListening;
    if (active) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.25,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1.0,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1.0);
    }
  }, [voiceState, isWebListening]);

  // Wave animation for SPEAKING state
  useEffect(() => {
    if (voiceState === "SPEAKING") {
      const createWave = (anim, duration) =>
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: 1.0,
              duration,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0.2,
              duration,
              useNativeDriver: true,
            }),
          ])
        );

      const a1 = createWave(waveAnim1, 300);
      const a2 = createWave(waveAnim2, 450);
      const a3 = createWave(waveAnim3, 350);

      a1.start();
      a2.start();
      a3.start();

      return () => {
        a1.stop();
        a2.stop();
        a3.stop();
      };
    }
  }, [voiceState]);

  const handleMicTap = () => {
    if (voiceState === "LISTENING" || isWebListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (_) {}
      }
      setIsWebListening(false);
    } else {
      startListening();
    }
  };

  const handleSubmitManual = () => {
    const q = manualInput.trim();
    if (q.length > 0) {
      setManualInput("");
      onProcessCommand(q);
    }
  };

  const QUICK_PROMPTS = [
    "Take me to DB Mall",
    "What's my speed?",
    "Where am I?",
    "What's the next turn?",
    "How far is destination?",
    "Recenter map",
    "Start navigation",
  ];

  if (!visible) return null;

  const isCurrentlyListening = voiceState === "LISTENING" || isWebListening;

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          style={styles.capsuleContainer}
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Top Status Header */}
          <View style={styles.headerRow}>
            <View style={styles.assistantBadge}>
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor: isCurrentlyListening
                      ? "#10B981"
                      : voiceState === "PROCESSING"
                      ? "#F59E0B"
                      : voiceState === "SPEAKING"
                      ? "#4285F4"
                      : "#94A3B8",
                  },
                ]}
              />
              <Text style={styles.assistantTitle}>VOICE NAVIGATION</Text>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Main Visual Indicator Center (Interactive Tap-to-Talk) */}
          <View style={styles.micCenterArea}>
            {isCurrentlyListening && (
              <Animated.View
                style={[
                  styles.pulseRing,
                  { transform: [{ scale: pulseAnim }] },
                ]}
              />
            )}

            <TouchableOpacity
              style={[
                styles.micCircle,
                isCurrentlyListening && styles.micCircleListening,
                voiceState === "SPEAKING" && styles.micCircleSpeaking,
              ]}
              onPress={handleMicTap}
              activeOpacity={0.8}
            >
              {voiceState === "PROCESSING" ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : voiceState === "SPEAKING" ? (
                <View style={styles.audioWaveContainer}>
                  <Animated.View
                    style={[
                      styles.waveBar,
                      { transform: [{ scaleY: waveAnim1 }] },
                    ]}
                  />
                  <Animated.View
                    style={[
                      styles.waveBar,
                      { transform: [{ scaleY: waveAnim2 }] },
                    ]}
                  />
                  <Animated.View
                    style={[
                      styles.waveBar,
                      { transform: [{ scaleY: waveAnim3 }] },
                    ]}
                  />
                </View>
              ) : (
                <Text style={styles.micEmoji}>🎙️</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.statusMainLabel}>
              {isCurrentlyListening
                ? "Listening... Speak now"
                : voiceState === "PROCESSING"
                ? "Processing command…"
                : voiceState === "SPEAKING"
                ? "Speaking…"
                : voiceState === "ERROR"
                ? "Didn't catch that. Try again."
                : "Tap Mic or select a command"}
            </Text>

            {transcriptText ? (
              <Text style={styles.transcriptQuote}>"{transcriptText}"</Text>
            ) : null}

            {responseFeedback ? (
              <Text style={styles.feedbackText}>{responseFeedback}</Text>
            ) : null}
          </View>

          {/* Command Pill Suggestions (One-Tap Action) */}
          <View style={styles.promptsScroll}>
            {QUICK_PROMPTS.map((prompt, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.promptPill}
                onPress={() => onProcessCommand(prompt)}
                activeOpacity={0.7}
              >
                <Text style={styles.promptPillText}>{prompt}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Direct Input */}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.textInput}
              placeholder="Or type e.g. 'Take me to DB Mall'..."
              placeholderTextColor="#64748B"
              value={manualInput}
              onChangeText={setManualInput}
              onSubmitEditing={handleSubmitManual}
              returnKeyType="go"
              clearButtonMode="while-editing"
            />
            {manualInput.trim().length > 0 && (
              <TouchableOpacity
                style={styles.sendButton}
                onPress={handleSubmitManual}
              >
                <Text style={styles.sendButtonText}>➔</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(3, 7, 18, 0.65)",
    justifyContent: "flex-end",
  },
  capsuleContainer: {
    backgroundColor: "#0F172A",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === "ios" ? 34 : 24,
    borderWidth: 1,
    borderColor: "rgba(51, 65, 85, 0.7)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  assistantBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(30, 41, 59, 0.75)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(71, 85, 105, 0.4)",
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 7,
  },
  assistantTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94A3B8",
    letterSpacing: 0.8,
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(30, 41, 59, 0.9)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  closeText: {
    fontSize: 12,
    color: "#94A3B8",
    fontWeight: "700",
  },
  micCenterArea: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    position: "relative",
  },
  pulseRing: {
    position: "absolute",
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: "rgba(16, 185, 129, 0.25)",
    borderWidth: 1.5,
    borderColor: "rgba(16, 185, 129, 0.6)",
  },
  micCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#1E293B",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#334155",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  micCircleListening: {
    backgroundColor: "#065F46",
    borderColor: "#10B981",
  },
  micCircleSpeaking: {
    backgroundColor: "#1E3A8A",
    borderColor: "#4285F4",
  },
  micEmoji: {
    fontSize: 24,
  },
  audioWaveContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 22,
    width: 26,
    gap: 4,
  },
  waveBar: {
    width: 4,
    height: 20,
    backgroundColor: "#60A5FA",
    borderRadius: 2,
  },
  statusMainLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#F8FAFC",
    marginTop: 8,
  },
  transcriptQuote: {
    fontSize: 13,
    fontStyle: "italic",
    color: "#38BDF8",
    marginTop: 3,
    textAlign: "center",
    paddingHorizontal: 16,
  },
  feedbackText: {
    fontSize: 12.5,
    color: "#94A3B8",
    marginTop: 3,
    textAlign: "center",
    paddingHorizontal: 16,
  },
  promptsScroll: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginVertical: 10,
    justifyContent: "center",
  },
  promptPill: {
    backgroundColor: "rgba(30, 41, 59, 0.85)",
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(71, 85, 105, 0.5)",
  },
  promptPillText: {
    fontSize: 11.5,
    color: "#CBD5E1",
    fontWeight: "600",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E293B",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 10 : 4,
    borderWidth: 1,
    borderColor: "#334155",
    marginTop: 4,
  },
  textInput: {
    flex: 1,
    fontSize: 13.5,
    color: "#F8FAFC",
    paddingVertical: 4,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#4285F4",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  sendButtonText: {
    fontSize: 15,
    color: "#FFFFFF",
    fontWeight: "bold",
  },
});
