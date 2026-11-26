
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

export type InfoTab = "Overview" | "Details" | "Rooms";

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
      style={[
        styles.locationCard,
        animatedSheetStyle,
      ]}
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

      {/* BUILDING TITLE */}
      <View style={styles.sheetHeader}>
        <View style={styles.sheetTitleGroup}>

          <Text style={styles.locationName}>
            {selectedLocation.name}
          </Text>

          <Text style={styles.locationBuilding}>
            {selectedLocation.building}
          </Text>

          {routeInfo && (
            <Text style={styles.sheetTravelInfo}>
              {isOfflineRoute ? "Saved campus route" : "Online walking route"} ·{" "}
              {(routeInfo.distance / 1000).toFixed(2)} km ·{" "}
              {Math.max(1, Math.round(routeInfo.duration / 60))} min
            </Text>
          )}
        </View>

        <Pressable
          style={styles.sheetCloseButton}
          onPress={onClose}
        >
          <Text style={styles.sheetCloseText}>✕</Text>
        </Pressable>
      </View>

      {/* ACTION BUTTONS */}
      <View style={styles.sheetActions}>
        <Pressable
          style={styles.directionsButton}
          onPress={onStartTracking}
          disabled={isLoadingRoute}
        >
          <Text style={styles.directionsButtonText}>
            <Text style={styles.directionsIcon}>☇</Text>
            <Text> Directions</Text>
          </Text>
        </Pressable>

        <Pressable
          style={styles.startButton}
          onPress={onStartOrFollow}
          disabled={isLoadingRoute}
        >
          <Text style={styles.startButtonText}>
            ➤ Start
          </Text>
        </Pressable>

        <Pressable
          style={styles.moreButton}
          onPress={onMore}
        >
          <Text style={styles.moreButtonText}>••• More</Text>
        </Pressable>
      </View>

      {/* PHOTO GALLERY */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.sheetGallery}
        contentContainerStyle={styles.sheetGalleryContent}
      >
        {galleryImages.length ? (
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
            <Text style={styles.galleryPlaceholderIcon}>▧</Text>
            <Text style={styles.galleryPlaceholderText}>
              Building photo
            </Text>
          </View>
        )}

      </ScrollView>

      {/* INFORMATION TABS */}
      <View style={styles.sheetTabs}>
        {(["Overview", "Details", "Rooms"] as const).map((tab) => (
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
                selectedInfoTab === tab && styles.sheetTabTextActive,
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
        showsVerticalScrollIndicator={false}
      >
        {selectedInfoTab === "Overview" && (
          <View style={styles.sheetDescriptionRow}>
            <Text style={styles.sheetInfoIcon}>ⓘ</Text>

            <Text style={styles.sheetDescription}>
              {selectedLocation.description}
            </Text>
          </View>
        )}

        {selectedInfoTab === "Details" && (
          <View style={styles.sheetDetails}>
            <Text style={styles.sheetDetailText}>
              Building: {selectedLocation.building}
            </Text>

            <Text style={styles.sheetDetailText}>
              Name: {selectedLocation.name}
            </Text>

            <Text style={styles.sheetDetailText}>
              Category: {selectedLocation.category}
            </Text>

            <Text style={styles.sheetDetailText}>
              {selectedLocation.description}
            </Text>
          </View>
        )}

        {selectedInfoTab === "Rooms" && (
          <Text style={styles.sheetDetailText}>
            Room information will appear here when you add room details.
          </Text>
        )}

        {isLoadingRoute && (
          <Text style={styles.sheetStatusText}>
            Finding walking route...
          </Text>
        )}

        {isRerouting && (
          <Text style={styles.sheetStatusText}>
            Updating walking route...
          </Text>
        )}

        {isTracking && isOfflineRoute && routeInfo && (
          <Text style={styles.sheetWarningText}>
            Following the saved campus walking paths.
          </Text>
        )}

        {isTracking && !routeInfo && !isLoadingRoute && !isRerouting && (
          <Text style={styles.sheetWarningText}>
            {routeError ?? "No walking route is available. Check your connection and try again."}
          </Text>
        )}

        {isTracking && routeInstructions.length > 0 && (
          <View style={styles.routeInstructions}>
            <Text style={styles.routeInstructionsTitle}>Walking directions</Text>
            {routeInstructions.map((instruction, index) => (
              <Text key={`${index}-${instruction}`} style={styles.routeInstructionText}>
                {index + 1}. {instruction}
              </Text>
            ))}
          </View>
        )}

        {isTracking && (
          <Pressable
            style={styles.sheetStopButton}
            onPress={onStopTracking}
          >
            <Text style={styles.sheetStopButtonText}>
              Stop Tracking
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
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: "#555555",
    paddingTop: 10,
    paddingHorizontal: 14,
    paddingBottom: 15,
    elevation: 15,
    zIndex: 20,
    overflow: "hidden",
  },

  // DRAG HANDLE
  sheetHandleContainer: {
    width: "100%",
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 5,
  },

  sheetHandle: {
    width: 55,
    height: 5,
    borderRadius: 5,
    backgroundColor: "#555555",
  },

  sheetDragHint: {
    position: "absolute",
    right: 8,
    color: "#AAAAAA",
    fontSize: 17,
    fontWeight: "700",
  },

  // BUILDING HEADER
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  sheetTitleGroup: {
    flex: 1,
    paddingRight: 10,
  },

  locationBuilding: {
    fontSize: 13,
    color: "#F2F2F2",
    fontWeight: "600",
    marginTop: 3,
  },

  locationName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#F2F2F2",
  },

  sheetTravelInfo: {
    color: "#AAAAAA",
    fontSize: 10,
    marginTop: 4,
  },

  sheetCloseButton: {
    width: 35,
    height: 35,
    alignItems: "center",
    justifyContent: "center",
  },

  sheetCloseText: {
    color: "#F2F2F2",
    fontSize: 17,
  },

  // ACTION BUTTONS
  sheetActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },

  directionsButton: {
    flex: 1.3,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FFC900",
    alignItems: "center",
    justifyContent: "center",
  },

  directionsButtonText: {
    color: "#FFC900",
    fontSize: 13,
    fontWeight: "700",
    top: -2,
  },

  directionsIcon: {
    fontSize: 17,
    fontWeight: "bold",
  },

  startButton: {
    flex: 1,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FFC900",
    alignItems: "center",
    justifyContent: "center",
  },

  startButtonText: {
    color: "#FFC900",
    fontSize: 12,
    fontWeight: "700",
  },

  moreButton: {
    flex: 0.9,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FFC900",
    alignItems: "center",
    justifyContent: "center",
  },

  moreButtonText: {
    color: "#FFC900",
    fontSize: 12,
    fontWeight: "700",
  },

  // PHOTO GALLERY
  sheetGallery: {
    height: 135,
    flexGrow: 0,
    marginBottom: 8,
  },

  sheetGalleryContent: {
    gap: 8,
  },

  sheetMainPhoto: {
    width: 260,
    height: 135,
    borderRadius: 12,
    backgroundColor: "#303030",
  },

  sheetMainPhotoPlaceholder: {
    width: 260,
    height: 135,
    borderRadius: 12,
    backgroundColor: "#303030",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#444444",
  },

  sheetSidePhotos: {
    width: 100,
    height: 135,
    gap: 7,
  },

  sheetSmallPhotoPlaceholder: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: "#303030",
    alignItems: "center",
    justifyContent: "center",
  },

  galleryPlaceholderIcon: {
    fontSize: 25,
    color: "#FFC900",
  },

  galleryPlaceholderText: {
    color: "#AAAAAA",
    fontSize: 11,
    marginTop: 5,
  },

  // INFORMATION TABS
  sheetTabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#555555",
    marginHorizontal: -14,
    paddingHorizontal: 14,
  },

  sheetTab: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },

  sheetTabActive: {
    borderBottomColor: "#FFC900",
  },

  sheetTabText: {
    fontSize: 12,
    color: "#CCCCCC",
    fontWeight: "500",
  },

  sheetTabTextActive: {
    color: "#FFC900",
    fontWeight: "700",
  },

  // INFORMATION CONTENT
  sheetInformation: {
    flex: 1,
    marginTop: 12,
  },

  sheetDescriptionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    paddingBottom: 15,
  },

  sheetInfoIcon: {
    color: "#FFC900",
    fontSize: 17,
  },

  sheetDescription: {
    flex: 1,
    color: "#F2F2F2",
    fontSize: 12,
    lineHeight: 22,
    textAlign: "justify",
  },

  sheetDetails: {
    gap: 12,
    paddingBottom: 15,
  },

  sheetDetailText: {
    color: "#F2F2F2",
    fontSize: 12,
    lineHeight: 21,
  },

  routeInstructions: {
    gap: 7,
    marginTop: 12,
    padding: 11,
    borderRadius: 10,
    backgroundColor: "#242424",
  },

  routeInstructionsTitle: {
    color: "#FFC900",
    fontSize: 12,
    fontWeight: "700",
  },

  routeInstructionText: {
    color: "#F2F2F2",
    fontSize: 12,
    lineHeight: 18,
  },

  sheetStatusText: {
    color: "#FFC900",
    fontSize: 12,
    marginTop: 10,
  },

  sheetWarningText: {
    color: "#FFD166",
    fontSize: 11,
    marginTop: 8,
  },

  sheetStopButton: {
    backgroundColor: "#2A191B",
    borderWidth: 1,
    borderColor: "#613037",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    marginTop: 12,
    marginBottom: 15,
  },

  sheetStopButtonText: {
    color: "#FF8A94",
    fontWeight: "700",
    fontSize: 12,
  },
});
