import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  Animated,
  Easing,
  Vibration,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function CrashSOSModal({ visible, onCancel, onBroadcastSOS }) {
  const [countdown, setCountdown] = useState(10);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let timer;
    if (visible) {
      setCountdown(10);
      Vibration.vibrate([500, 500, 500, 500], true); // Repeated vibration

      // Intense pulsing animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 300,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 300,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
        ])
      ).start();

      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            Vibration.cancel();
            onBroadcastSOS();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      Vibration.cancel();
      pulseAnim.setValue(1);
    }

    return () => {
      if (timer) clearInterval(timer);
      Vibration.cancel();
    };
  }, [visible, onBroadcastSOS]);

  const handleCancel = () => {
    Vibration.cancel();
    onCancel();
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent={true} animationType="fade">
      <View style={styles.overlay}>
        <Animated.View
          style={[styles.modalContainer, { transform: [{ scale: pulseAnim }] }]}
        >
          <Ionicons name="warning" size={64} color="#ef4444" style={{ marginBottom: 16 }} />
          
          <Text style={styles.title}>CRASH DETECTED</Text>
          <Text style={styles.subtitle}>
            Are you okay? Broadcasting Emergency SOS to nearby vehicles in:
          </Text>

          <Text style={styles.countdown}>{countdown}s</Text>

          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={[styles.btn, styles.cancelBtn]}
              onPress={handleCancel}
            >
              <Text style={styles.cancelBtnText}>I'M OK (CANCEL)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, styles.sendBtn]}
              onPress={() => {
                Vibration.cancel();
                onBroadcastSOS();
              }}
            >
              <Text style={styles.sendBtnText}>SEND SOS NOW</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(220, 38, 38, 0.9)", // Deep red tint overlay
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: "85%",
    backgroundColor: "#111827", // Dark slate background for contrast
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
    borderWidth: 2,
    borderColor: "#ef4444",
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#fca5a5",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#d1d5db",
    textAlign: "center",
    marginBottom: 24,
  },
  countdown: {
    fontSize: 72,
    fontWeight: "900",
    color: "#ef4444",
    marginBottom: 32,
  },
  buttonGroup: {
    width: "100%",
    gap: 16,
  },
  btn: {
    width: "100%",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtn: {
    backgroundColor: "#10b981", // Green for safety
  },
  cancelBtnText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
  },
  sendBtn: {
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: "#ef4444",
  },
  sendBtnText: {
    color: "#ef4444",
    fontSize: 16,
    fontWeight: "700",
  },
});
