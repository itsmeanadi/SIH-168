import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  ActivityIndicator,
  Keyboard,
  ScrollView,
} from "react-native";
import { searchPlaces, fetchNearbyPlaces } from "../services/googleMapsService";
import { PRESET_DESTINATIONS } from "../constants/destinations";

// ============================================================
// SIH-168 — Google-Maps-Style Destination Search & Nearby POI Modal
// Google Places Autocomplete + Nearby Search + Category Chips
// ============================================================

const NEARBY_CATEGORIES = [
  { id: "fuel", label: "Fuel / EV", icon: "⛽" },
  { id: "hospital", label: "Hospitals", icon: "🏥" },
  { id: "parking", label: "Parking", icon: "🅿️" },
  { id: "food", label: "Food", icon: "🍽️" },
  { id: "atm", label: "ATM", icon: "🏧" },
  { id: "service", label: "Mechanic", icon: "🛠️" },
];

export default function DestinationSearchModal({
  visible,
  onClose,
  onSelectDestination,
  userLocation,
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const debounceTimer = useRef(null);

  useEffect(() => {
    if (!visible) {
      setQuery("");
      setResults([]);
      setIsLoading(false);
      setSelectedCategory(null);
      return;
    }
  }, [visible]);

  const handleQueryChange = (text) => {
    setQuery(text);
    setSelectedCategory(null);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    if (!text || text.trim().length < 2) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    debounceTimer.current = setTimeout(async () => {
      try {
        const places = await searchPlaces(
          text,
          userLocation?.lat,
          userLocation?.lng
        );
        setResults(places);
      } catch (e) {
        console.log("[SearchModal] Error fetching places:", e);
      } finally {
        setIsLoading(false);
      }
    }, 350);
  };

  const handleCategoryPress = async (cat) => {
    setSelectedCategory(cat.id);
    setIsLoading(true);
    setResults([]);
    Keyboard.dismiss();

    const baseLat = userLocation?.lat || 22.6667;
    const baseLng = userLocation?.lng || 75.8919;

    try {
      const places = await fetchNearbyPlaces(cat.id, baseLat, baseLng, 6000);
      if (places && places.length > 0) {
        setResults(places);
      } else {
        // Fallback to text search for the category
        const fallback = await searchPlaces(cat.label, baseLat, baseLng);
        setResults(fallback);
      }
    } catch (e) {
      console.log("[SearchModal] Category query error:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectPreset = (preset) => {
    Keyboard.dismiss();
    const baseLat = userLocation?.lat || 22.6667;
    const baseLng = userLocation?.lng || 75.8919;
    onSelectDestination({
      title: preset.title,
      subtitle: preset.desc,
      lat: baseLat + preset.latOffset,
      lng: baseLng + preset.lngOffset,
    });
  };

  const handleSelectResult = (item) => {
    Keyboard.dismiss();
    onSelectDestination({
      title: item.title,
      subtitle: item.subtitle || item.address,
      lat: item.lat,
      lng: item.lng,
      rating: item.rating,
      userRatingsTotal: item.userRatingsTotal,
      placeType: item.placeType,
      isAccessible: item.isAccessible,
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={searchStyles.modalBackdrop}>
        <View style={searchStyles.modalCard}>
          {/* Header & Search Bar */}
          <View style={searchStyles.headerRow}>
            <View style={searchStyles.inputWrapper}>
              <Text style={searchStyles.searchIcon}>🔍</Text>
              <TextInput
                style={searchStyles.textInput}
                placeholder="Search destination, place or address..."
                placeholderTextColor="#94A3B8"
                value={query}
                onChangeText={handleQueryChange}
                autoFocus={true}
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
              {isLoading && (
                <ActivityIndicator
                  size="small"
                  color="#4285F4"
                  style={{ marginRight: 6 }}
                />
              )}
              {query.length > 0 && !isLoading && (
                <TouchableOpacity
                  onPress={() => handleQueryChange("")}
                  style={searchStyles.clearInputBtn}
                >
                  <Text style={searchStyles.clearInputText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={searchStyles.closeButton}
            >
              <Text style={searchStyles.closeText}>Cancel</Text>
            </TouchableOpacity>
          </View>

          {/* Google Nearby Category Chips Horizontal Strip */}
          <View style={searchStyles.categoriesStripWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={searchStyles.categoriesScroll}
            >
              {NEARBY_CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      searchStyles.catChip,
                      isSelected && searchStyles.catChipSelected,
                    ]}
                    onPress={() => handleCategoryPress(cat)}
                    activeOpacity={0.75}
                  >
                    <Text style={searchStyles.catChipIcon}>{cat.icon}</Text>
                    <Text
                      style={[
                        searchStyles.catChipText,
                        isSelected && searchStyles.catChipTextSelected,
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Results List or Quick Presets */}
          {results.length > 0 ? (
            <FlatList
              data={results}
              keyExtractor={(item) => item.id || `${item.lat}-${item.lng}`}
              keyboardShouldPersistTaps="handled"
              style={searchStyles.list}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={searchStyles.resultItem}
                  onPress={() => handleSelectResult(item)}
                  activeOpacity={0.7}
                >
                  <View style={searchStyles.resultIconOrb}>
                    <Text style={searchStyles.resultIconText}>
                      {item.icon || "📍"}
                    </Text>
                  </View>
                  <View style={searchStyles.resultTextCol}>
                    <Text style={searchStyles.resultTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={searchStyles.resultSubtitle} numberOfLines={1}>
                      {item.subtitle || item.address}
                    </Text>

                    {/* Rich Google Place Badges */}
                    {(item.rating || item.placeType || item.isAccessible) && (
                      <View style={searchStyles.badgesRow}>
                        {item.rating ? (
                          <Text style={searchStyles.ratingBadge}>
                            ⭐ {item.rating.toFixed(1)}{" "}
                            {item.userRatingsTotal
                              ? `(${item.userRatingsTotal > 999 ? `${(item.userRatingsTotal / 1000).toFixed(1)}k` : item.userRatingsTotal})`
                              : ""}
                          </Text>
                        ) : null}
                        {item.placeType ? (
                          <Text style={searchStyles.typeBadge}>
                            {item.placeType}
                          </Text>
                        ) : null}
                        {item.isAccessible ? (
                          <Text style={searchStyles.accessibleBadge}>
                            ♿
                          </Text>
                        ) : null}
                      </View>
                    )}
                  </View>
                  {item.formattedDistance && (
                    <Text style={searchStyles.resultDistance}>
                      {item.formattedDistance}
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            />
          ) : query.length >= 2 && !isLoading ? (
            <View style={searchStyles.emptyState}>
              <Text style={searchStyles.emptyEmoji}>🗺️</Text>
              <Text style={searchStyles.emptyTitle}>No exact places found</Text>
              <Text style={searchStyles.emptySub}>
                Try searching for a nearby street, landmark or city name
              </Text>
            </View>
          ) : (
            <View style={searchStyles.presetContainer}>
              <Text style={searchStyles.presetHeader}>Quick Suggestions</Text>

              {PRESET_DESTINATIONS.map((preset, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={searchStyles.presetItem}
                  onPress={() => handleSelectPreset(preset)}
                  activeOpacity={0.7}
                >
                  <View style={searchStyles.presetIconOrb}>
                    <Text style={searchStyles.presetIconText}>
                      {preset.icon}
                    </Text>
                  </View>
                  <View style={searchStyles.presetTextCol}>
                    <Text style={searchStyles.presetTitle}>{preset.title}</Text>
                    <Text style={searchStyles.presetSub}>{preset.desc}</Text>
                  </View>
                  <Text style={searchStyles.presetArrow}>➔</Text>
                </TouchableOpacity>
              ))}

              <View style={searchStyles.mapHintBox}>
                <Text style={searchStyles.mapHintText}>
                  💡 Tip: You can also tap anywhere on the map to drop a pin and start routing.
                </Text>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const searchStyles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "flex-end",
  },

  modalCard: {
    backgroundColor: "#121826",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    maxHeight: "85%",
    minHeight: 440,
    borderTopWidth: 1,
    borderColor: "rgba(51, 65, 85, 0.8)",
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },

  inputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(30, 41, 59, 0.85)",
    borderRadius: 16,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(51, 65, 85, 0.8)",
  },

  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },

  textInput: {
    flex: 1,
    height: 44,
    fontSize: 14.5,
    color: "#F8FAFC",
    fontWeight: "500",
  },

  clearInputBtn: {
    padding: 4,
  },

  clearInputText: {
    color: "#94A3B8",
    fontSize: 14,
    fontWeight: "bold",
  },

  closeButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },

  closeText: {
    color: "#38BDF8",
    fontSize: 14,
    fontWeight: "700",
  },

  categoriesStripWrapper: {
    marginBottom: 12,
  },

  categoriesScroll: {
    flexDirection: "row",
    gap: 7,
    paddingVertical: 2,
  },

  catChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(30, 41, 59, 0.9)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(71, 85, 105, 0.5)",
    gap: 5,
  },

  catChipSelected: {
    backgroundColor: "#1A73E8",
    borderColor: "#4285F4",
  },

  catChipIcon: {
    fontSize: 13,
  },

  catChipText: {
    fontSize: 12,
    color: "#CBD5E1",
    fontWeight: "600",
  },

  catChipTextSelected: {
    color: "#FFFFFF",
    fontWeight: "800",
  },

  list: {
    flex: 1,
  },

  resultItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(51, 65, 85, 0.4)",
    gap: 12,
  },

  resultIconOrb: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(30, 41, 59, 0.9)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(71, 85, 105, 0.5)",
  },

  resultIconText: {
    fontSize: 16,
  },

  resultTextCol: {
    flex: 1,
  },

  resultTitle: {
    color: "#F8FAFC",
    fontSize: 14.5,
    fontWeight: "700",
  },

  resultSubtitle: {
    color: "#94A3B8",
    fontSize: 11.5,
    marginTop: 2,
  },

  badgesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },

  ratingBadge: {
    color: "#FBBF24",
    fontSize: 10.5,
    fontWeight: "700",
  },

  typeBadge: {
    color: "#93C5FD",
    fontSize: 10,
    fontWeight: "600",
    textTransform: "capitalize",
    backgroundColor: "rgba(59, 130, 246, 0.15)",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },

  accessibleBadge: {
    fontSize: 11,
  },

  resultDistance: {
    color: "#38BDF8",
    fontSize: 12,
    fontWeight: "700",
  },

  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 36,
  },

  emptyEmoji: {
    fontSize: 36,
    marginBottom: 8,
  },

  emptyTitle: {
    color: "#F8FAFC",
    fontSize: 15,
    fontWeight: "700",
  },

  emptySub: {
    color: "#94A3B8",
    fontSize: 12,
    textAlign: "center",
    marginTop: 4,
    paddingHorizontal: 20,
  },

  presetContainer: {
    paddingTop: 4,
  },

  presetHeader: {
    color: "#94A3B8",
    fontSize: 11.5,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 10,
  },

  presetItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(30, 41, 59, 0.6)",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(51, 65, 85, 0.4)",
    gap: 12,
  },

  presetIconOrb: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    alignItems: "center",
    justifyContent: "center",
  },

  presetIconText: {
    fontSize: 15,
  },

  presetTextCol: {
    flex: 1,
  },

  presetTitle: {
    color: "#F8FAFC",
    fontSize: 13.5,
    fontWeight: "700",
  },

  presetSub: {
    color: "#94A3B8",
    fontSize: 11,
    marginTop: 1,
  },

  presetArrow: {
    color: "#64748B",
    fontSize: 14,
    fontWeight: "bold",
  },

  mapHintBox: {
    backgroundColor: "rgba(2, 132, 199, 0.12)",
    borderRadius: 12,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.25)",
  },

  mapHintText: {
    color: "#38BDF8",
    fontSize: 11,
    lineHeight: 16,
  },
});
