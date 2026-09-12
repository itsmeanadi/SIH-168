import React from "react";
import { View, Text, TouchableOpacity, Modal } from "react-native";
import { styles } from "../styles/appStyles";
import { PRESET_DESTINATIONS } from "../constants/destinations";

// ============================================================
// SIH-168 — Destination Search & Preset Modal Component
// ============================================================

export default function DestinationModal({
  visible,
  onClose,
  onSelectPreset,
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Destination</Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.modalCloseButton}
            >
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.modalHint}>
            👉 You can also tap anywhere on the map directly to route there!
          </Text>

          <Text style={styles.presetSectionTitle}>Quick Destinations</Text>

          {PRESET_DESTINATIONS.map((preset, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.presetItem}
              onPress={() => onSelectPreset(preset)}
              activeOpacity={0.7}
            >
              <View style={styles.presetIconOrb}>
                <Text style={styles.presetIconText}>{preset.icon}</Text>
              </View>
              <View style={styles.presetTextCol}>
                <Text style={styles.presetTitle}>{preset.title}</Text>
                <Text style={styles.presetSub}>{preset.desc}</Text>
              </View>
              <Text style={styles.presetArrow}>➔</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Modal>
  );
}
