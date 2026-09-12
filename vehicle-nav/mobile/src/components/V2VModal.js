import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  Animated,
  Easing,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLanguage } from "../locales/i18n";

export default function V2VModal({ visible, onClose, onBroadcastAnchor, onScanForAnchors }) {
  const { t } = useLanguage();
  const [isScanning, setIsScanning] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotationAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isScanning) {
      // Pulse Effect
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.5,
            duration: 1000,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Rotation Effect
      Animated.loop(
        Animated.timing(rotationAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      pulseAnim.setValue(1);
      rotationAnim.setValue(0);
    }
  }, [isScanning, pulseAnim, rotationAnim]);

  const spin = rotationAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const handleBroadcast = () => {
    onBroadcastAnchor();
    onClose();
  };

  const handleScan = () => {
    setIsScanning(true);
    onScanForAnchors();
    // Auto stop visual scanning after a few seconds if no response (demo purpose)
    setTimeout(() => {
      setIsScanning(false);
      onClose(); // Close modal so user can see map
    }, 2000);
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent={true} animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={24} color="#5F6368" />
          </TouchableOpacity>

          <Text style={styles.title}>V2V Mesh Network</Text>
          <Text style={styles.subtitle}>
            Peer-to-peer location sync via local network relay. No internet required.
          </Text>

          <View style={styles.radarContainer}>
            {isScanning && (
              <Animated.View
                style={[
                  styles.radarCircle,
                  {
                    transform: [{ scale: pulseAnim }],
                    opacity: pulseAnim.interpolate({
                      inputRange: [1, 1.5],
                      outputRange: [0.5, 0],
                    }),
                  },
                ]}
              />
            )}
            <Animated.View
              style={
                isScanning
                  ? { transform: [{ rotate: spin }] }
                  : {}
              }
            >
              <Ionicons
                name="radio"
                size={64}
                color={isScanning ? "#10b981" : "#3b82f6"}
              />
            </Animated.View>
          </View>

          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={[styles.btn, styles.broadcastBtn]}
              onPress={handleBroadcast}
            >
              <Ionicons name="location" size={20} color="#fff" />
              <Text style={styles.btnText}>Broadcast Anchor</Text>
              <Text style={styles.btnSubtext}>(I have fresh GPS)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, styles.scanBtn, isScanning && styles.btnDisabled]}
              onPress={handleScan}
              disabled={isScanning}
            >
              <Ionicons name="search" size={20} color="#fff" />
              <Text style={styles.btnText}>
                {isScanning ? "Scanning..." : "Sync from Anchor"}
              </Text>
              <Text style={styles.btnSubtext}>(I am drifting)</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: "85%",
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  closeBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#202124",
    marginTop: 8,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#5F6368",
    textAlign: "center",
    marginBottom: 24,
  },
  radarContainer: {
    width: 120,
    height: 120,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 32,
  },
  radarCircle: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#10b981",
  },
  buttonGroup: {
    width: "100%",
    gap: 12,
  },
  btn: {
    width: "100%",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },
  broadcastBtn: {
    backgroundColor: "#3b82f6",
  },
  scanBtn: {
    backgroundColor: "#10b981",
  },
  btnDisabled: {
    backgroundColor: "#9CA3AF",
  },
  btnText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
    marginTop: 4,
  },
  btnSubtext: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 12,
  },
});
