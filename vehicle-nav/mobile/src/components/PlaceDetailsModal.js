import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  Image,
  Platform,
} from "react-native";

// ============================================================
// SIH-168 — Google Maps Official Place Details Card Component
// Tabs: Overview & Reviews • Star Ratings • Photo Gallery • Navigation CTA
// ============================================================

export default function PlaceDetailsModal({
  visible,
  place,
  onClose,
  onStartRoute,
}) {
  const [activeTab, setActiveTab] = useState("overview"); // 'overview' | 'reviews'

  if (!visible || !place) return null;

  const defaultPhotos = [
    "https://images.unsplash.com/photo-1578637387939-43c525550085?w=600&q=80",
    "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=400&q=80",
    "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=400&q=80",
  ];

  const photos = place.photos && place.photos.length > 0 ? place.photos : defaultPhotos;

  const sampleReviews = [
    {
      id: "r1",
      name: "Lina Wang",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&q=80",
      time: "a month ago",
      rating: 5,
      text: "Outstanding destination! The atmosphere and views were absolutely great. Clean facilities and very easy to navigate.",
    },
    {
      id: "r2",
      name: "Gabriel Sharma",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&q=80",
      time: "a month ago",
      rating: 5,
      text: "Amazing place to visit. Easy approach route, ample parking, and very lively crowd. Highly recommended!",
    },
    {
      id: "r3",
      name: "Agnello Silveira",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&q=80",
      time: "3 months ago",
      rating: 4,
      text: "Great accessibility and landmark location. Quick access from the main highway.",
    },
  ];

  const reviews = place.reviews && place.reviews.length > 0 ? place.reviews : sampleReviews;
  const ratingValue = place.rating || 4.6;
  const ratingCount = place.userRatingsTotal || 13485;
  const placeCategory = place.placeType || place.category || "Point of Interest";
  const description =
    place.summary ||
    place.editorialSummary ||
    place.subtitle ||
    "Iconic landmark and premier destination with easy highway accessibility, verified parking, and amenities.";

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.cardContainer}>
          {/* Top Drag Handle */}
          <View style={styles.handleBar} />

          {/* Header Row: Google Maps branding & Close */}
          <View style={styles.headerRow}>
            <View style={styles.googleMapsBadge}>
              <Text style={styles.googleG}>G</Text>
              <Text style={styles.googleMapsText}>Google Maps</Text>
              <View style={styles.infoDot}>
                <Text style={styles.infoDotText}>ⓘ</Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Title & Metadata */}
            <Text style={styles.placeTitle}>{place.title || place.name || "Destination"}</Text>

            <View style={styles.ratingCategoryRow}>
              <Text style={styles.ratingNumber}>{ratingValue.toFixed(1)}</Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <Text key={s} style={styles.starText}>
                    ★
                  </Text>
                ))}
              </View>
              <Text style={styles.reviewCountText}>({ratingCount.toLocaleString()})</Text>
            </View>

            <Text style={styles.categorySubtitle}>{placeCategory}</Text>

            {/* Action CTA Button */}
            <TouchableOpacity
              style={styles.openInMapsBtn}
              onPress={() => {
                if (onStartRoute) onStartRoute(place);
                onClose();
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.openInMapsText}>Directions & Start Navigation</Text>
            </TouchableOpacity>

            {/* Tab Switcher: Overview / Reviews */}
            <View style={styles.tabBar}>
              <TouchableOpacity
                style={[styles.tabItem, activeTab === "overview" && styles.tabItemActive]}
                onPress={() => setActiveTab("overview")}
              >
                <Text
                  style={[
                    styles.tabItemText,
                    activeTab === "overview" && styles.tabItemTextActive,
                  ]}
                >
                  Overview
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabItem, activeTab === "reviews" && styles.tabItemActive]}
                onPress={() => setActiveTab("reviews")}
              >
                <Text
                  style={[
                    styles.tabItemText,
                    activeTab === "reviews" && styles.tabItemTextActive,
                  ]}
                >
                  Reviews
                </Text>
              </TouchableOpacity>
            </View>

            {/* TAB CONTENT */}
            {activeTab === "overview" ? (
              <View style={styles.overviewSection}>
                {/* Photo Gallery Grid */}
                <View style={styles.photosGrid}>
                  <View style={styles.photoMainWrapper}>
                    <Image
                      source={{ uri: photos[0] }}
                      style={styles.photoMain}
                      resizeMode="cover"
                    />
                    <View style={styles.photoCountBadge}>
                      <Text style={styles.photoCountText}>📷 {photos.length} photos</Text>
                    </View>
                  </View>

                  <View style={styles.photoSideCol}>
                    <Image
                      source={{ uri: photos[1] || photos[0] }}
                      style={styles.photoSideTop}
                      resizeMode="cover"
                    />
                    <Image
                      source={{ uri: photos[2] || photos[0] }}
                      style={styles.photoSideBottom}
                      resizeMode="cover"
                    />
                  </View>
                </View>

                {/* Editorial Summary */}
                <Text style={styles.descriptionText}>{description}</Text>

                {/* Address Row */}
                <View style={styles.addressRow}>
                  <Text style={styles.addressIcon}>📍</Text>
                  <Text style={styles.addressText}>
                    {place.address || place.subtitle || "Location coordinates ready for navigation."}
                  </Text>
                </View>

                {/* Accessibility Badge */}
                {place.isAccessible && (
                  <View style={styles.accessibilityRow}>
                    <Text style={styles.accessibleIcon}>♿</Text>
                    <Text style={styles.accessibleText}>Wheelchair accessible entrance</Text>
                  </View>
                )}
              </View>
            ) : (
              /* REVIEWS TAB */
              <View style={styles.reviewsSection}>
                {reviews.map((rev) => (
                  <View key={rev.id} style={styles.reviewCard}>
                    <View style={styles.reviewerHeader}>
                      <Image source={{ uri: rev.avatar }} style={styles.reviewerAvatar} />
                      <View style={styles.reviewerInfo}>
                        <Text style={styles.reviewerName}>{rev.name}</Text>
                        <Text style={styles.reviewTime}>{rev.time}</Text>
                      </View>
                    </View>

                    <View style={styles.reviewStarsRow}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Text
                          key={s}
                          style={[
                            styles.reviewStar,
                            s <= rev.rating ? styles.starFilled : styles.starEmpty,
                          ]}
                        >
                          ★
                        </Text>
                      ))}
                    </View>

                    <Text style={styles.reviewComment}>{rev.text}</Text>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "flex-end",
  },
  cardContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "88%",
    minHeight: 480,
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 20,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#DADCE0",
    alignSelf: "center",
    marginBottom: 10,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  googleMapsBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  googleG: {
    fontSize: 16,
    fontWeight: "900",
    color: "#4285F4",
  },
  googleMapsText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#5F6368",
    letterSpacing: -0.2,
  },
  infoDot: {
    marginLeft: 2,
  },
  infoDotText: {
    fontSize: 13,
    color: "#70757A",
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F1F3F4",
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: {
    fontSize: 13,
    color: "#5F6368",
    fontWeight: "bold",
  },
  scrollContent: {
    paddingBottom: 24,
  },
  placeTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#202124",
    marginTop: 2,
    letterSpacing: -0.4,
  },
  ratingCategoryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  ratingNumber: {
    fontSize: 14,
    fontWeight: "700",
    color: "#3C4043",
  },
  starsRow: {
    flexDirection: "row",
  },
  starText: {
    fontSize: 14,
    color: "#FBBC04",
  },
  reviewCountText: {
    fontSize: 13,
    color: "#1A73E8",
    textDecorationLine: "underline",
  },
  categorySubtitle: {
    fontSize: 13.5,
    color: "#5F6368",
    marginTop: 2,
    textTransform: "capitalize",
  },
  openInMapsBtn: {
    backgroundColor: "#E8F0FE",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignSelf: "flex-start",
    marginTop: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(26, 115, 232, 0.3)",
  },
  openInMapsText: {
    color: "#1A73E8",
    fontSize: 13.5,
    fontWeight: "700",
  },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E8EAED",
    marginBottom: 14,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderBottomWidth: 2.5,
    borderBottomColor: "transparent",
  },
  tabItemActive: {
    borderBottomColor: "#00796B",
  },
  tabItemText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#5F6368",
  },
  tabItemTextActive: {
    color: "#00796B",
    fontWeight: "700",
  },
  overviewSection: {},
  photosGrid: {
    flexDirection: "row",
    gap: 6,
    height: 160,
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 14,
  },
  photoMainWrapper: {
    flex: 1.2,
    position: "relative",
  },
  photoMain: {
    width: "100%",
    height: "100%",
  },
  photoCountBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  photoCountText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  photoSideCol: {
    flex: 1,
    gap: 6,
  },
  photoSideTop: {
    flex: 1,
    width: "100%",
  },
  photoSideBottom: {
    flex: 1,
    width: "100%",
  },
  descriptionText: {
    fontSize: 13.5,
    lineHeight: 20,
    color: "#3C4043",
    marginBottom: 14,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#F1F3F4",
  },
  addressIcon: {
    fontSize: 16,
    marginTop: 1,
  },
  addressText: {
    flex: 1,
    fontSize: 13,
    color: "#3C4043",
    lineHeight: 18,
  },
  accessibilityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F1F3F4",
  },
  accessibleIcon: {
    fontSize: 14,
  },
  accessibleText: {
    fontSize: 12.5,
    color: "#188038",
    fontWeight: "600",
  },
  reviewsSection: {
    gap: 16,
  },
  reviewCard: {
    borderBottomWidth: 1,
    borderBottomColor: "#F1F3F4",
    paddingBottom: 14,
  },
  reviewerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
  },
  reviewerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#E8EAED",
  },
  reviewerInfo: {
    flex: 1,
  },
  reviewerName: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#202124",
  },
  reviewTime: {
    fontSize: 11,
    color: "#70757A",
  },
  reviewStarsRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  reviewStar: {
    fontSize: 12,
  },
  starFilled: {
    color: "#FBBC04",
  },
  starEmpty: {
    color: "#DADCE0",
  },
  reviewComment: {
    fontSize: 13,
    lineHeight: 19,
    color: "#3C4043",
  },
});
