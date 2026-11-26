
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { GestureDetector } from "react-native-gesture-handler";
import Animated from "react-native-reanimated";

import { IMPORTANT_LOCATIONS } from "../constants/importantLocations";

// --------------------------------------------------
// TYPES
// --------------------------------------------------

type CampusLocation = (typeof IMPORTANT_LOCATIONS)[number];

export type InfoTab = "Overview" | "Offices" | "Rooms";

type RouteSummary = {
  distance: number;
  duration: number;
};

type Props = {
  selectedLocation: CampusLocation;
  selectedInfoTab: InfoTab;
  routeInfo: RouteSummary | null;
  routeInstructions: string[];
  routeError: string | null;

  isOfflineRoute: boolean;
  isTracking: boolean;
  isLoadingRoute: boolean;
  isRerouting: boolean;
  sheetExpanded: boolean;

  animatedSheetStyle: any;
  sheetDragGesture: any;

  onClose: () => void;
  onToggleSheet: () => void;
  onStartTracking: () => void;
  onStartOrFollow: () => void;
  onMore: () => void;
  onTabChange: (tab: InfoTab) => void;
  onStopTracking: () => void;
};

// --------------------------------------------------
// COMPONENT
// --------------------------------------------------

export default function LocationBottomSheet({
  selectedLocation,
  selectedInfoTab,
  routeInfo,
  routeInstructions,
  routeError,

  isOfflineRoute,
  isTracking,
  isLoadingRoute,
  isRerouting,
  sheetExpanded,

  animatedSheetStyle,
  sheetDragGesture,

  onClose,
  onToggleSheet,
  onStartTracking,
  onStartOrFollow,
  onMore,
  onTabChange,
  onStopTracking,
}: Props) {
  const galleryImages = selectedLocation.galleryImages?.length
    ? selectedLocation.galleryImages
    : selectedLocation.image
      ? [selectedLocation.image]
      : [];

  return (
    <Animated.View
      style={[styles.locationCard, animatedSheetStyle]}
    >
      {/* DRAG HANDLE */}
      <GestureDetector gesture={sheetDragGesture}>
        <Pressable
          style={styles.sheetHandleContainer}
          onPress={onToggleSheet}
        >
          <View style={styles.sheetHandle} />

          <Text style={styles.sheetDragHint}>
            {sheetExpanded ? "" : ""}
          </Text>
        </Pressable>
      </GestureDetector>

      {/* BUILDING HEADER */}
      <View style={styles.sheetHeader}>
        <View style={styles.sheetTitleGroup}>
          <View style={styles.locationCategoryBadge}>
            <Text style={styles.locationCategoryText}>
              {selectedLocation.category}
            </Text>
          </View>

          <Text style={styles.locationName}>
            {selectedLocation.name}
          </Text>

          <Text style={styles.locationBuilding}>
            {selectedLocation.building}
          </Text>

          {routeInfo && (
            <Text style={styles.sheetTravelInfo}>
              {isOfflineRoute
                ? "Saved campus route"
                : "Online walking route"}
              {"  ·  "}
              {(routeInfo.distance / 1000).toFixed(2)} km
              {"  ·  "}
              {Math.max(1, Math.round(routeInfo.duration / 60))} min
            </Text>
          )}
        </View>

        {/* CLOSE BUTTON */}
        <Pressable
          style={({ pressed }) => [
            styles.sheetCloseButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={onClose}
          hitSlop={8}
        >
          <Text style={styles.sheetCloseText}>✕</Text>
        </Pressable>
      </View>

      {/* ACTION BUTTONS */}
      <View style={styles.sheetActions}>
        <Pressable
          style={({ pressed }) => [
            styles.directionsButton,
            pressed && styles.buttonPressed,
            isLoadingRoute && styles.buttonDisabled,
          ]}
          onPress={onStartTracking}
          disabled={isLoadingRoute}
        >
          <Text style={styles.directionsButtonText}>
            ↔  Directions
          </Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.startButton,
            pressed && styles.buttonPressed,
            isLoadingRoute && styles.buttonDisabled,
          ]}
          onPress={onStartOrFollow}
          disabled={isLoadingRoute}
        >
          <Text style={styles.startButtonText}>
            ➤  Start
          </Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.moreButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={onMore}
        >
          <Text style={styles.moreButtonText}>
            •••  More
          </Text>
        </Pressable>
      </View>

      {/* LOADING STATUS */}
      {(isLoadingRoute || isRerouting) && (
        <View style={styles.routeLoadingContainer}>
          <View style={styles.loadingDot} />

          <Text style={styles.sheetStatusText}>
            {isRerouting
              ? "Updating walking route..."
              : "Finding walking route..."}
          </Text>
        </View>
      )}

      {/* PHOTO GALLERY */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.sheetGallery}
        contentContainerStyle={styles.sheetGalleryContent}
      >
        {galleryImages.length > 0 ? (
          galleryImages.map((photo, index) => (
            <Image
              key={`${selectedLocation.id}-photo-${index}`}
              source={photo}
              style={styles.sheetMainPhoto}
              resizeMode="cover"
            />
          ))
        ) : (
          <View style={styles.sheetMainPhotoPlaceholder}>
            <Text style={styles.galleryPlaceholderIcon}>
              ▧
            </Text>

            <Text style={styles.galleryPlaceholderText}>
              No building photos available
            </Text>
          </View>
        )}
      </ScrollView>

      {/* INFORMATION TABS */}
      <View style={styles.sheetTabs}>
        {(["Overview", "Offices", "Rooms"] as const).map((tab) => (
          <Pressable
            key={tab}
            style={[
              styles.sheetTab,
              selectedInfoTab === tab && styles.sheetTabActive,
            ]}
            onPress={() => onTabChange(tab)}
          >
            <Text
              style={[
                styles.sheetTabText,
                selectedInfoTab === tab &&
                  styles.sheetTabTextActive,
              ]}
            >
              {tab}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* TAB CONTENT */}
      <ScrollView
        style={styles.sheetInformation}
        contentContainerStyle={styles.sheetInformationContent}
        showsVerticalScrollIndicator={false}
      >
        {/* OVERVIEW */}
        {selectedInfoTab === "Overview" && (
          <View style={styles.sheetDescriptionCard}>
            <Text style={styles.sheetInfoIcon}>ⓘ</Text>

            <View style={styles.descriptionContent}>
              <Text style={styles.sectionHeading}>
                About this location
              </Text>

              <Text style={styles.sheetDescription}>
                {selectedLocation.description}
              </Text>
            </View>
          </View>
        )}

        {/* OFFICES */}
        {selectedInfoTab === "Offices" && (
          <View style={styles.sheetDetails}>
            <Text style={styles.sectionHeading}>
              Building information
            </Text>

            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Building</Text>
              <Text style={styles.sheetDetailText}>
                {selectedLocation.building}
              </Text>
            </View>

            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Name</Text>
              <Text style={styles.sheetDetailText}>
                {selectedLocation.name}
              </Text>
            </View>

            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Category</Text>
              <Text style={styles.sheetDetailText}>
                {selectedLocation.category}
              </Text>
            </View>

            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Description</Text>
              <Text style={styles.sheetDetailText}>
                {selectedLocation.description}
              </Text>
            </View>
          </View>
        )}

        {/* ROOMS */}
        {selectedInfoTab === "Rooms" && (
          <View style={styles.emptyRoomsContainer}>
            <Text style={styles.emptyRoomsIcon}>▤</Text>

            <Text style={styles.emptyRoomsTitle}>
              Room information
            </Text>

            <Text style={styles.emptyRoomsText}>
              Room information will appear here when you add room details.
            </Text>
          </View>
        )}

        {/* ROUTE STATUS */}
        {isTracking && isOfflineRoute && routeInfo && (
          <View style={styles.offlineNotice}>
            <Text style={styles.noticeIcon}>ⓘ</Text>

            <Text style={styles.sheetWarningText}>
              Following the saved campus walking paths.
            </Text>
          </View>
        )}

        {isTracking &&
          !routeInfo &&
          !isLoadingRoute &&
          !isRerouting && (
            <View style={styles.errorNotice}>
              <Text style={styles.errorNoticeIcon}>!</Text>

              <Text style={styles.errorNoticeText}>
                {routeError ??
                  "No walking route is available. Check your connection and try again."}
              </Text>
            </View>
          )}

        {/* WALKING DIRECTIONS */}
        {isTracking && routeInstructions.length > 0 && (
          <View style={styles.routeInstructions}>
            <View style={styles.routeInstructionsHeader}>
              <Text style={styles.routeInstructionsTitle}>
                Walking directions
              </Text>

              <Text style={styles.routeStepCount}>
                {routeInstructions.length} steps
              </Text>
            </View>

            {routeInstructions.map((instruction, index) => (
              <View
                key={`${index}-${instruction}`}
                style={styles.routeStep}
              >
                <View style={styles.routeStepNumber}>
                  <Text style={styles.routeStepNumberText}>
                    {index + 1}
                  </Text>
                </View>

                <Text style={styles.routeInstructionText}>
                  {instruction}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* STOP TRACKING */}
        {isTracking && (
          <Pressable
            style={({ pressed }) => [
              styles.sheetStopButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={onStopTracking}
          >
            <Text style={styles.sheetStopButtonText}>
              ✕  Stop Tracking
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </Animated.View>
  );
}

// --------------------------------------------------
// BOTTOM SHEET STYLES
// --------------------------------------------------

const styles = StyleSheet.create({
  locationCard: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#1D1D1D",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: "#414141",
    paddingTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 18,
    elevation: 20,
    zIndex: 20,
    overflow: "hidden",
  },

  // DRAG HANDLE
  sheetHandleContainer: {
    width: "100%",
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },

  sheetHandle: {
    width: 48,
    height: 5,
    borderRadius: 5,
    backgroundColor: "#666666",
  },

  sheetDragHint: {
    position: "absolute",
    right: 5,
    color: "#AAAAAA",
    fontSize: 17,
    fontWeight: "700",
  },

  // HEADER
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 15,
  },

  sheetTitleGroup: {
    flex: 1,
    paddingRight: 12,
  },

  locationCategoryBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#38321B",
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    marginBottom: 8,
  },

  locationCategoryText: {
    color: "#FFC900",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },

  locationName: {
    fontSize: 17,
    fontWeight: "800",
    color: "#FFFFFF",
    lineHeight: 23,
  },

  locationBuilding: {
    fontSize: 13,
    color: "#AAAAAA",
    fontWeight: "600",
    marginTop: 4,
  },

  sheetTravelInfo: {
    color: "#FFC900",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 7,
  },

  sheetCloseButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#303030",
    borderWidth: 1,
    borderColor: "#484848",
    alignItems: "center",
    justifyContent: "center",
    marginTop: -15,
  },

  sheetCloseText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
  },

  // ACTION BUTTONS
  sheetActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },

  directionsButton: {
    flex: 1.3,
    height: 42,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#FFC900",
    backgroundColor: "#282516",
    alignItems: "center",
    justifyContent: "center",
  },

  directionsButtonText: {
    color: "#FFC900",
    fontSize: 12,
    fontWeight: "800",
  },

  startButton: {
    flex: 1,
    height: 42,
    borderRadius: 11,
    backgroundColor: "#FFC900",
    alignItems: "center",
    justifyContent: "center",
  },

  startButtonText: {
    color: "#1D1D1D",
    fontSize: 12,
    fontWeight: "900",
  },

  moreButton: {
    flex: 0.9,
    height: 42,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#484848",
    backgroundColor: "#303030",
    alignItems: "center",
    justifyContent: "center",
  },

  moreButtonText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },

  buttonPressed: {
    opacity: 0.7,
  },

  buttonDisabled: {
    opacity: 0.45,
  },

  // ROUTE LOADING
  routeLoadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },

  loadingDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#FFC900",
  },

  // PHOTO GALLERY
  sheetGallery: {
    height: 145,
    flexGrow: 0,
    marginBottom: 12,
  },

  sheetGalleryContent: {
    gap: 9,
  },

  sheetMainPhoto: {
    width: 260,
    height: 140,
    borderRadius: 13,
    backgroundColor: "#303030",
  },

  sheetMainPhotoPlaceholder: {
    width: 260,
    height: 140,
    borderRadius: 13,
    backgroundColor: "#292929",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#414141",
  },

  galleryPlaceholderIcon: {
    fontSize: 30,
    color: "#FFC900",
  },

  galleryPlaceholderText: {
    color: "#AAAAAA",
    fontSize: 11,
    marginTop: 7,
  },

  // INFORMATION TABS
  sheetTabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#414141",
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },

  sheetTab: {
    paddingHorizontal: 13,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },

  sheetTabActive: {
    borderBottomColor: "#FFC900",
  },

  sheetTabText: {
    fontSize: 12,
    color: "#999999",
    fontWeight: "600",
  },

  sheetTabTextActive: {
    color: "#FFC900",
    fontWeight: "800",
  },

  // INFORMATION CONTENT
  sheetInformation: {
    flex: 1,
    marginTop: 14,
  },

  sheetInformationContent: {
    paddingBottom: 20,
  },

  sheetDescriptionCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
    padding: 13,
    backgroundColor: "#292929",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#383838",
  },

  sheetInfoIcon: {
    color: "#FFC900",
    fontSize: 19,
    fontWeight: "700",
  },

  descriptionContent: {
    flex: 1,
  },

  sectionHeading: {
    color: "#FFC900",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 8,
  },

  sheetDescription: {
    color: "#DDDDDD",
    fontSize: 12,
    lineHeight: 21,
    textAlign: "left",
  },

  // BUILDING DETAILS
  sheetDetails: {
    gap: 13,
    padding: 13,
    backgroundColor: "#292929",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#383838",
  },

  detailItem: {
    gap: 4,
    paddingBottom: 9,
    borderBottomWidth: 1,
    borderBottomColor: "#3B3B3B",
  },

  detailLabel: {
    color: "#999999",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },

  sheetDetailText: {
    color: "#F2F2F2",
    fontSize: 12,
    lineHeight: 20,
  },

  // EMPTY ROOMS
  emptyRoomsContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 25,
    backgroundColor: "#292929",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#383838",
  },

  emptyRoomsIcon: {
    color: "#FFC900",
    fontSize: 30,
    marginBottom: 9,
  },

  emptyRoomsTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 6,
  },

  emptyRoomsText: {
    color: "#999999",
    fontSize: 11,
    textAlign: "center",
    lineHeight: 18,
  },

  // ROUTE NOTICES
  offlineNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    padding: 11,
    marginTop: 12,
    backgroundColor: "#302B19",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#594A1A",
  },

  noticeIcon: {
    color: "#FFC900",
    fontSize: 17,
    fontWeight: "800",
  },

  sheetWarningText: {
    flex: 1,
    color: "#FFD978",
    fontSize: 11,
    lineHeight: 17,
  },

  errorNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    padding: 11,
    marginTop: 12,
    backgroundColor: "#351F20",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#663638",
  },

  errorNoticeIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    overflow: "hidden",
    textAlign: "center",
    textAlignVertical: "center",
    backgroundColor: "#FF7070",
    color: "#1D1D1D",
    fontWeight: "900",
  },

  errorNoticeText: {
    flex: 1,
    color: "#FFAAAA",
    fontSize: 11,
    lineHeight: 17,
  },

  sheetStatusText: {
    color: "#FFC900",
    fontSize: 11,
    fontWeight: "600",
  },

  // WALKING DIRECTIONS
  routeInstructions: {
    gap: 12,
    marginTop: 13,
    padding: 13,
    borderRadius: 12,
    backgroundColor: "#292929",
    borderWidth: 1,
    borderColor: "#414141",
  },

  routeInstructionsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 9,
    borderBottomWidth: 1,
    borderBottomColor: "#414141",
  },

  routeInstructionsTitle: {
    color: "#FFC900",
    fontSize: 13,
    fontWeight: "800",
  },

  routeStepCount: {
    color: "#999999",
    fontSize: 10,
    fontWeight: "600",
  },

  routeStep: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },

  routeStepNumber: {
    width: 23,
    height: 23,
    borderRadius: 12,
    backgroundColor: "#403819",
    borderWidth: 1,
    borderColor: "#80691D",
    alignItems: "center",
    justifyContent: "center",
  },

  routeStepNumberText: {
    color: "#FFC900",
    fontSize: 10,
    fontWeight: "800",
  },

  routeInstructionText: {
    flex: 1,
    color: "#E5E5E5",
    fontSize: 11,
    lineHeight: 19,
  },

  // STOP TRACKING
  sheetStopButton: {
    backgroundColor: "#351F20",
    borderWidth: 1,
    borderColor: "#713B3E",
    borderRadius: 11,
    padding: 13,
    alignItems: "center",
    marginTop: 14,
  },

  sheetStopButtonText: {
    color: "#FF9299",
    fontWeight: "800",
    fontSize: 12,
  },
});
