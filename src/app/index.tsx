import * as Location from "expo-location";
import { useNetworkState } from "expo-network";
import { useEffect, useRef, useState } from "react";

import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Gesture, GestureDetector } from "react-native-gesture-handler";

import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { CAMPUS_BOUNDARY } from "../constants/campusBoundary";
import {
  CAMPUS_STUDENT_GATE,
  IMPORTANT_LOCATIONS,
} from "../constants/importantLocations";
import { MAP_IMAGE, gpsToImage } from "../constants/mapCalibration";
import { getOfflineWalkingRoute } from "../services/offlineRouting";
import { getWalkingRoute } from "../services/ors";
import LocationBottomSheet, {
  type InfoTab,
} from "../components/location-bottom-sheet";
import LoadingScreen from "../components/loading-screen";

// --------------------------------------------------
// TYPES
// --------------------------------------------------

type CampusLocation = (typeof IMPORTANT_LOCATIONS)[number];

function getCategoryColor(category?: string | null) {
  const value = (category ?? "").toLowerCase();

  if (value.includes("academic") || value.includes("education") || value.includes("college")) return "#4DA3FF";
  if (value.includes("administrative") || value.includes("office") || value.includes("admin")) return "#B58BFF";
  if (value.includes("health") || value.includes("clinic") || value.includes("medical")) return "#FF6B7A";
  if (value.includes("food") || value.includes("cafeteria") || value.includes("dining")) return "#FF9F43";
  if (value.includes("facility") || value.includes("utility") || value.includes("service")) return "#36C9A5";
  if (value.includes("sports") || value.includes("recreation") || value.includes("gym")) return "#E879C7";
  if (value.includes("entrance") || value.includes("gate")) return "#F4D35E";

  const categoryPalette = ["#4DA3FF", "#B58BFF", "#FF6B7A", "#FF9F43", "#36C9A5", "#E879C7", "#5BC0BE"];
  const categoryHash = [...value].reduce((total, character) => total + character.charCodeAt(0), 0);
  return value ? categoryPalette[categoryHash % categoryPalette.length] : "#FFC900";
}

type GPSPoint = {
  latitude: number;
  longitude: number;
};

type ImagePoint = {
  x: number;
  y: number;
};

type RouteSummary = {
  distance: number;
  duration: number;
};

type RouteRequestState = {
  inFlight: boolean;
  pending: boolean;
  forceNext: boolean;
  lastOrigin: GPSPoint | null;
  lastRequestTime: number;
  latestOrigin: GPSPoint | null;
  latestDestination: CampusLocation | null;
  destinationId: number | null;
  preferredEntranceDestinationId: number | null;
  preferredEntrance: GPSPoint | null;
  preferredEntranceOrigin: GPSPoint | null;
};

// Keep the route start close to a moving GPS marker without rerouting on every
// small GPS wobble. Emulator steps and walking updates are often only a few m.
const MIN_REROUTE_DISTANCE_METERS = 1;
const MIN_REROUTE_INTERVAL_MS = 1_000;
const ENTRANCE_RESELECT_DISTANCE_METERS = 15;
const LOADING_DURATION = 3_000;
const SHEET_SPRING = { damping: 24, stiffness: 180, mass: 0.8 };

// --------------------------------------------------
// SEARCH ALIASES
// --------------------------------------------------

const SEARCH_ALIASES: Record<number, string[]> = {
  1: ["National Service Training Program"],
  2: ["Culinary Building"],
  3: ["Engineering", "Building 43", "Engineering Complex II"],
  4: ["Engineering", "Building 42", "Performing Arts Theater", "Performing Arts Theatre", "PAT"],
  5: ["Food", "Canteen"],
  6: [
    "CITC",
    "CITC 9",
    "Building 9",
    "Information Technology",
    "Computing",
    "Technology",
  ],
  7: ["Medicine"],
  8: ["Classroom"],
  9: ["LRC", "Resource Center"],
  10: ["Cashier", "Display Center", "Building 14"],
  11: ["DRER", "Memorial Hall", "Sports Hall"],
  12: ["Nursing", "Building 28"],
  13: ["Health Center", "Building 27"],
  14: ["Engineering", "Building 24"],
  15: ["Technology", "College of Technology", "Building 47", "COT"],
  16: ["Food", "Innovation", "Building 26"],
  17: ["Food", "Innovation", "Building 25"],
  18: ["SHS", "Senior High School", "Building 14"],
  19: ["Administration", "Admin"],
  20: ["Big Foot", "Student Lounge"],
  21: ["Engineering", "Old Engineering", "Building 5"],
  22: ["Dorm", "Dormitory", "Building 51"],
  23: ["Mechanical Lab", "Laboratory Shop", "Building 45"],
  24: ["CEA Deans Office", "Dean's Office", "Deans Office", "Dean", "CEA"],
  25: ["43-101", "Room 43-101", "CEA Accreditation Room", "Geodetic Engineering"],
  26: ["43-102", "Room 43-102", "CEA Accreditation Room", "Geodetic Engineering"],
  27: ["Field", "Campus Open Field"],
  60: ["Science Complex", "Science", "Building 41", "Bldg 41"],
  61: ["Research Director", "Office of Research Director", "OR Director"],
  62: ["Research Office", "Office of Research"],
  63: ["42-102", "EE Laboratory", "EE Lab", "IGIS"],
  64: ["Engineering and Architecture Library", "TEA Library", "Room 43-201", "43-201"],
  65: ["42-201", "Mechanical Engineering Laboratory", "Mechanical Engineering Lab"],
  66: ["42-202", "Laboratory"],
  67: ["42-203", "Diode Applications Trainer", "Diode Applications Trainer Laboratory"],
  68: ["42-301"],
  69: ["42-302"],
  70: ["42-303"],
  71: ["42-304"],
  72: ["42-401"],
  73: ["42-402"],
  74: ["42-403"],
  75: ["42-404"],
  76: ["42-501"],
  77: ["42-502"],
  78: ["42-503"],
  79: ["42-504"],
  80: ["41-101", "Room 41-101", "Guidance and Counseling", "Guidance & Counseling Services"],
  81: ["41-102", "Room 41-102", "Admissions", "Admission Testing Unit"],
  82: ["41-103", "Laboratory", "Lab Room 41-103"],
  83: ["41-105", "Room 41-105", "CSM CON Library", "CSM/CON Library"],
  84: ["Admission Scholarship Office", "Admissions and Scholarship"],
  85: ["Vice Chancellor Academic Affairs", "Office of the Vice Chancellor"],
  86: ["41-201", "Instruments Laboratory", "Instruments Lab 1"],
  87: ["41-202", "Instruments Laboratory", "Microbiological Testing Laboratory", "Antibacterial Assay"],
  88: ["41-203", "Laboratory Room 41-203"],
  89: ["41-204", "Center for Research Advanced Science", "CRAS"],
  90: ["41-205", "Instruments Laboratory", "Instruments Lab"],
  91: ["41-206", "Clinical Chemistry", "Clinical Chemistry Laboratory"],
  92: ["41-301", "Physics Lab 1", "Physics Laboratory 1"],
  93: ["41-302", "Physics Instrument Room", "Instrument Room"],
  94: ["41-303", "Physics Lab 2", "Physics Laboratory 2"],
  95: ["41-304", "Physics Laboratory"],
  96: ["41-305", "FST Stockroom", "Food Science and Technology Stockroom"],
  97: ["41-306", "FST Research Laboratory", "Food Science and Technology Research Laboratory"],
  98: ["41-401", "Lecture Room 41-401", "Mathematics Lecture Room"],
  99: ["41-402", "EST Laboratory"],
  100: ["41-403", "Laboratory Room 41-403"],
  101: ["41-404", "Environmental Science Laboratory", "Environmental Science Lab"],
  102: ["41-405", "Food Preparation Laboratory", "Food Prep Lab"],
  103: ["41-406"],
  104: ["41-407", "EST Department", "FST Department", "EST and FST Departments"],
  105: ["41-501", "Chemistry Department", "Chemistry Dept"],
  106: ["41-502", "Stock Room 41-502", "Stockroom 41-502"],
  107: ["41-503", "Chemical Storage", "Stock Room 41-503", "Stockroom 41-503"],
  108: ["41-504", "Chemistry Laboratory", "Chemistry Lab"],
  109: ["41-505"],
  110: ["41-506"],
  111: ["Dispensing Room"],
  112: ["Faculty Office", "Department of Information Technology", "CITC Faculty"],
  113: ["ICT Audio Visual Room", "Audio Visual Room", "AV Room"],
  114: ["Digital Transformation", "DT Office"],
  115: ["CITC Collabrary", "Collabrary", "CITC Library"],
  116: ["9-401", "Room 9-401"],
  117: ["9-402", "Room 9-402"],
  118: ["9-403", "Room 9-403"],
  119: ["9-404", "Room 9-404"],
  120: ["CITC Lab", "Laboratory", "Rooms 9-301 to 9-309"],
  121: ["9-301", "Room 9-301"],
  122: ["9-302", "Room 9-302"],
  123: ["9-303", "Room 9-303"],
  124: ["9-304", "Room 9-304"],
  125: ["9-305", "Room 9-305"],
  126: ["9-306", "Room 9-306"],
  127: ["9-307", "Room 9-307"],
  128: ["9-308", "Room 9-308"],
  129: ["9-309", "Room 9-309"],
  130: ["9-101", "Room 9-101", "Career Center"],
  131: ["9-102", "Room 9-102", "Speech Laboratory", "Speech Lab"],
  132: ["9-103", "Room 9-103"],
  133: ["9-104", "Room 9-104", "Office of the Dean", "Dean's Office"],
  134: ["9-105", "Room 9-105", "Lecture Room", "International Affairs Office"],
  135: ["Student Lounge", "North Student Lounge"],
  136: ["Student Lounge", "South Student Lounge"],
};

// --------------------------------------------------
// DISTANCE CALCULATION
// --------------------------------------------------

function calculateDistance(a: GPSPoint, b: GPSPoint) {
  const earthRadius = 6371000;

  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;

  const deltaLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const deltaLon = ((b.longitude - a.longitude) * Math.PI) / 180;

  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;

  return earthRadius * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function getRouteDestination(destination: CampusLocation, origin: GPSPoint) {
  const buildingPoint = {
    latitude: destination.latitude,
    longitude: destination.longitude,
  };

  if (destination.routeEntrances.length === 0) {
    return {
      point: buildingPoint,
      buildingPoint,
      hasConfirmedEntrance: false,
      offlineRoute: null,
    };
  }

  const options = destination.routeEntrances.map((point) => ({
    point,
    route: getOfflineWalkingRoute(origin, point, true),
  }));
  const reachableOptions = options.filter(
    (option): option is typeof option & { route: NonNullable<typeof option.route> } =>
      option.route !== null,
  );
  const bestOption = reachableOptions.reduce<(typeof reachableOptions)[number] | null>(
    (best, option) =>
      !best ||
      option.route.distance + calculateDistance(option.point, buildingPoint) <
        best.route.distance + calculateDistance(best.point, buildingPoint)
        ? option
        : best,
    null,
  );

  if (bestOption) {
    return {
      point: bestOption.point,
      buildingPoint,
      hasConfirmedEntrance: true,
      offlineRoute: bestOption.route,
    };
  }

  const point = destination.routeEntrances.reduce((closest, entrance) =>
    calculateDistance(origin, entrance) < calculateDistance(origin, closest)
      ? entrance
      : closest,
  );

  return { point, buildingPoint, hasConfirmedEntrance: true, offlineRoute: null };
}

// --------------------------------------------------
// CAMPUS PERIMETER CHECK
// --------------------------------------------------

function isInsideCampus(longitude: number, latitude: number) {
  const boundary = CAMPUS_BOUNDARY;

  // Approximately 8 metres of tolerance.
  const tolerance = 0.000072;

  let inside = false;

  for (let i = 0, j = boundary.length - 1; i < boundary.length; j = i++) {
    const xi = boundary[i].longitude;
    const yi = boundary[i].latitude;

    const xj = boundary[j].longitude;
    const yj = boundary[j].latitude;

    // Check whether the GPS point is close to this boundary segment.
    const dx = (xj - xi) * Math.cos((latitude * Math.PI) / 180);
    const dy = yj - yi;

    const px = (longitude - xi) * Math.cos((latitude * Math.PI) / 180);
    const py = latitude - yi;

    const lengthSquared = dx * dx + dy * dy;

    const t =
      lengthSquared === 0
        ? 0
        : Math.max(0, Math.min(1, (px * dx + py * dy) / lengthSquared));

    const closestX = xi + t * (xj - xi);
    const closestY = yi + t * (yj - yi);

    const distance = Math.hypot(
      (longitude - closestX) * Math.cos((latitude * Math.PI) / 180),
      latitude - closestY,
    );

    if (distance <= tolerance) {
      return true;
    }

    // Standard ray-casting algorithm.
    const intersects =
      yi > latitude !== yj > latitude &&
      longitude < ((xj - xi) * (latitude - yi)) / (yj - yi) + xi;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

// Use the perimeter only as a safety check for an on-campus route. It never
// contributes vertices or edges to the walking graph or displayed route.
function routeStaysInsideCampus(coordinates: [number, number][]) {
  if (coordinates.length < 2) return false;

  for (let index = 0; index < coordinates.length - 1; index += 1) {
    const [startLongitude, startLatitude] = coordinates[index];
    const [endLongitude, endLatitude] = coordinates[index + 1];
    const start = { latitude: startLatitude, longitude: startLongitude };
    const end = { latitude: endLatitude, longitude: endLongitude };
    const steps = Math.max(1, Math.ceil(calculateDistance(start, end) / 5));

    for (let step = 0; step <= steps; step += 1) {
      const ratio = step / steps;
      const latitude = startLatitude + (endLatitude - startLatitude) * ratio;
      const longitude = startLongitude + (endLongitude - startLongitude) * ratio;
      if (!isInsideCampus(longitude, latitude)) return false;
    }
  }

  return true;
}

// --------------------------------------------------
// MAIN SCREEN
// --------------------------------------------------

export default function HomeScreen() {
  const networkState = useNetworkState();
  const isInternetReachable = networkState.isInternetReachable === true;

  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [isGPSReady, setIsGPSReady] = useState(false);
  const [isMinimumLoadingTimeComplete, setIsMinimumLoadingTimeComplete] =
    useState(false);
  const [showLoadingScreen, setShowLoadingScreen] = useState(true);

  useEffect(() => {
    const timer = setTimeout(
      () => setIsMinimumLoadingTimeComplete(true),
      LOADING_DURATION,
    );
    return () => clearTimeout(timer);
  }, []);

  // GPS
  const [userLocation, setUserLocation] =
    useState<Location.LocationObjectCoords | null>(null);

  const [locationMessage, setLocationMessage] = useState(
    "Waiting for GPS location...",
  );

  const [isInside, setIsInside] = useState<boolean | null>(null);

  // MAP
  const [mapSize, setMapSize] = useState({
    width: 0,
    height: 0,
  });

  // SEARCH
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [showCategoryFilters, setShowCategoryFilters] = useState(false);
  const menuProgress = useSharedValue(0);
  const menuTopLineStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: menuProgress.value * 7 },
      { rotate: `${menuProgress.value * 45}deg` },
    ],
  }));
  const menuMiddleLineStyle = useAnimatedStyle(() => ({
    opacity: 1 - menuProgress.value,
    transform: [{ scaleX: 1 - menuProgress.value }],
  }));
  const menuBottomLineStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -menuProgress.value * 7 },
      { rotate: `${menuProgress.value * -45}deg` },
    ],
  }));
  const categoryPanelStyle = useAnimatedStyle(() => ({
    opacity: menuProgress.value,
    transform: [
      { translateY: (1 - menuProgress.value) * -12 },
      { scale: 0.98 + menuProgress.value * 0.02 },
    ],
  }));
  const [focusedLocationId, setFocusedLocationId] = useState<number | null>(null);
  const [selectedInfoTab, setSelectedInfoTab] = useState<InfoTab>("Overview");
  const [sheetExpanded, setSheetExpanded] = useState(false);

  const availableCategories = [
    "All",
    ...Array.from(
      new Set(
        IMPORTANT_LOCATIONS.map((location) => location.category).filter(
          (category): category is string => Boolean(category),
        ),
      ),
    ),
  ];
  const visibleLocations =
    selectedCategory === "All"
      ? IMPORTANT_LOCATIONS
      : IMPORTANT_LOCATIONS.filter(
          (location) => location.category === selectedCategory,
        );

  const sheetHeight = useSharedValue(0);
  const sheetDragStart = useSharedValue(0);
  const sheetDragCurrent = useSharedValue(0);
  const collapsedSheetHeight = mapSize.height * 0.43;
  const expandedSheetHeight = mapSize.height * 0.85;

  function expandSheet() {
    setSheetExpanded(true);
    sheetHeight.value = withSpring(expandedSheetHeight, SHEET_SPRING);
  }

  function collapseSheet() {
    setSheetExpanded(false);
    sheetHeight.value = withSpring(collapsedSheetHeight, SHEET_SPRING);
  }

  function toggleSheet() {
    if (sheetExpanded) collapseSheet();
    else expandSheet();
  }

  // DESTINATION
  const [selectedLocation, setSelectedLocation] =
    useState<CampusLocation | null>(null);

  // NAVIGATION
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>(
    [],
  );

  const [routeInfo, setRouteInfo] = useState<RouteSummary | null>(null);
  const [routeInstructions, setRouteInstructions] = useState<string[]>([]);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [isOfflineRoute, setIsOfflineRoute] = useState(false);

  const [isTracking, setIsTracking] = useState(false);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [isRerouting, setIsRerouting] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);

  // Keep current navigation state available to asynchronous requests.
  const isTrackingRef = useRef(false);
  const selectedDestinationRef = useRef<CampusLocation | null>(null);

  const routeRequestRef = useRef<RouteRequestState>({
    inFlight: false,
    pending: false,
    forceNext: false,
    lastOrigin: null,
    lastRequestTime: 0,
    latestOrigin: null,
    latestDestination: null,
    destinationId: null,
    preferredEntranceDestinationId: null,
    preferredEntrance: null,
    preferredEntranceOrigin: null,
  });

  // --------------------------------------------------
  // INITIAL MAP ZOOM
  // --------------------------------------------------

  const INITIAL_ZOOM = 1.35;

  // ZOOM BUTTON VERTICAL POSITION
  // Increase these values to move the zoom buttons UP.
  // Decrease these values to move the zoom buttons DOWN.
  const ZOOM_CONTROLS_BOTTOM = 300;
  const ZOOM_CONTROLS_SHEET_GAP = 34;

  // Extra vertical offset for the zoom buttons.
  // Increase this number to move them UP; decrease it to move them DOWN.
  const ZOOM_CONTROLS_VERTICAL_OFFSET = 70;

  const scale =
    mapSize.width > 0 && mapSize.height > 0
      ? Math.max(
          mapSize.width / MAP_IMAGE.width,
          mapSize.height / MAP_IMAGE.height,
        )
      : 0;

  const renderedWidth = MAP_IMAGE.width * scale;
  const renderedHeight = MAP_IMAGE.height * scale;

  const offsetX = (mapSize.width - renderedWidth) / 2;
  const offsetY = (mapSize.height - renderedHeight) / 2;

  // --------------------------------------------------
  // ZOOM AND PAN
  // --------------------------------------------------

  const zoom = useSharedValue(INITIAL_ZOOM);
  const savedZoom = useSharedValue(INITIAL_ZOOM);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  const clampTranslation = (
    value: number,
    imageSize: number,
    viewportSize: number,
    currentZoom: number,
  ) => {
    "worklet";

    const maximum = Math.max(0, (imageSize * currentZoom - viewportSize) / 2);

    return Math.min(maximum, Math.max(-maximum, value));
  };

  const panGesture = Gesture.Pan()
    .onBegin(() => {
      runOnJS(setIsFollowing)(false);

      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onUpdate((event) => {
      translateX.value = clampTranslation(
        startX.value + event.translationX,
        renderedWidth,
        mapSize.width,
        zoom.value,
      );

      translateY.value = clampTranslation(
        startY.value + event.translationY,
        renderedHeight,
        mapSize.height,
        zoom.value,
      );
    });

  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      const nextZoom = Math.min(4, Math.max(1, savedZoom.value * event.scale));

      zoom.value = nextZoom;

      translateX.value = clampTranslation(
        translateX.value,
        renderedWidth,
        mapSize.width,
        nextZoom,
      );

      translateY.value = clampTranslation(
        translateY.value,
        renderedHeight,
        mapSize.height,
        nextZoom,
      );
    })
    .onEnd(() => {
      savedZoom.value = zoom.value;
    });

  const mapGesture = Gesture.Simultaneous(panGesture, pinchGesture);

  useEffect(() => {
    if (!selectedLocation || mapSize.height <= 0) return;
    sheetHeight.value = withSpring(
      mapSize.height * (sheetExpanded ? 0.85 : 0.43),
      SHEET_SPRING,
    );
  }, [mapSize.height, selectedLocation, sheetExpanded, sheetHeight]);

  const sheetDragGesture = Gesture.Pan()
    .activeOffsetY([-8, 8])
    .failOffsetX([-20, 20])
    .onBegin(() => {
      sheetDragStart.value = sheetHeight.value;
      sheetDragCurrent.value = sheetHeight.value;
    })
    .onUpdate((event) => {
      const nextHeight = Math.max(
        collapsedSheetHeight,
        Math.min(
          expandedSheetHeight,
          sheetDragStart.value - event.translationY,
        ),
      );
      sheetDragCurrent.value = nextHeight;
      // eslint-disable-next-line react-hooks/immutability
      sheetHeight.value = nextHeight;
    })
    .onEnd((event) => {
      const shouldExpand =
        sheetDragCurrent.value >
          (collapsedSheetHeight + expandedSheetHeight) / 2 ||
        event.velocityY < -500;
      // eslint-disable-next-line react-hooks/immutability
      sheetHeight.value = withSpring(
        shouldExpand ? expandedSheetHeight : collapsedSheetHeight,
        SHEET_SPRING,
      );
      runOnJS(setSheetExpanded)(shouldExpand);
    });

  const animatedSheetStyle = useAnimatedStyle(() => ({
    height: sheetHeight.value,
  }));

  const animatedMapStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: zoom.value },
    ],
  }));

  const focusedMarkerScale = useSharedValue(1);
  useEffect(() => {
    if (focusedLocationId === null) {
      focusedMarkerScale.value = withTiming(1);
      return;
    }
    focusedMarkerScale.value = 1;
    focusedMarkerScale.value = withRepeat(
      withSequence(
        withTiming(1.5, { duration: 500, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 500, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [focusedLocationId, focusedMarkerScale]);

  const focusedMarkerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: focusedMarkerScale.value }],
  }));

  // --------------------------------------------------
  // GPS TO IMAGE COORDINATES
  // --------------------------------------------------

  const userPixel = userLocation
    ? gpsToImage(userLocation.latitude, userLocation.longitude)
    : null;

  const gpsAccuracyDiameter = Math.max(
    22,
    Math.min(
      90,
      (userLocation?.accuracy ?? 8) *
        3.9565 *
        (MAP_IMAGE.width / 2048) *
        scale *
        2,
    ),
  );
  const gpsAccuracyRadius = gpsAccuracyDiameter / 2;

  // Is the user's GPS coordinate inside the map image?
  const userIsVisible =
    userPixel !== null &&
    userPixel.x >= 0 &&
    userPixel.x <= MAP_IMAGE.width &&
    userPixel.y >= 0 &&
    userPixel.y <= MAP_IMAGE.height;

  // IMPORTANT:
  // The marker is displayed only if BOTH conditions are true:
  // 1. GPS is inside the campus perimeter.
  // 2. GPS is inside the displayed map image.
  const shouldShowGPSMarker =
    isInside === true && userIsVisible && userPixel !== null;

  // --------------------------------------------------
  // FOLLOW MODE
  // --------------------------------------------------

  useEffect(() => {
    if (!isFollowing || !shouldShowGPSMarker || !userPixel) return;

    if (!mapSize.width || !mapSize.height || !scale) return;

    const currentZoom = zoom.value;

    const targetX = -(userPixel.x * scale - renderedWidth / 2) * currentZoom;

    const targetY = -(userPixel.y * scale - renderedHeight / 2) * currentZoom;

    // Reanimated shared values are intentionally updated from this effect.
    // eslint-disable-next-line react-hooks/immutability
    translateX.value = clampTranslation(
      targetX,
      renderedWidth,
      mapSize.width,
      currentZoom,
    );

    // eslint-disable-next-line react-hooks/immutability
    translateY.value = clampTranslation(
      targetY,
      renderedHeight,
      mapSize.height,
      currentZoom,
    );
  }, [
    isFollowing,
    shouldShowGPSMarker,
    userLocation,
    mapSize.width,
    mapSize.height,
    scale,
    renderedWidth,
    renderedHeight,
    translateX,
    translateY,
    zoom,
    userPixel,
  ]);

  // --------------------------------------------------
  // SEARCH
  // --------------------------------------------------

  const searchResults = IMPORTANT_LOCATIONS.filter((location) => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) return false;

    const searchableText = [
      location.building,
      location.name,
      location.description,
      location.category,
      ...(SEARCH_ALIASES[location.id] || []),
    ]
      .join(" ")
      .toLowerCase();

    return searchableText.includes(query);
  });

  // --------------------------------------------------
  // ROUTE REQUEST QUEUE
  // --------------------------------------------------

  async function requestNewRoute(
    origin: GPSPoint,
    destination: CampusLocation,
    force = false,
  ) {
    const state = routeRequestRef.current;

    state.latestOrigin = origin;
    state.latestDestination = destination;
    state.destinationId = destination.id;

    if (force) {
      state.forceNext = true;
    }

    // If a request is already running, save the newest position.
    if (state.inFlight) {
      state.pending = true;
      return;
    }

    state.inFlight = true;

    try {
      while (true) {
        state.pending = false;

        const requestOrigin = state.latestOrigin;
        const requestDestination = state.latestDestination;
        const forceThisRequest = state.forceNext;

        state.forceNext = false;

        if (!requestOrigin || !requestDestination) break;

        if (
          state.destinationId !== requestDestination.id ||
          selectedDestinationRef.current?.id !== requestDestination.id ||
          !isTrackingRef.current
        ) {
          break;
        }

        if (!forceThisRequest && state.lastOrigin) {
          const movement = calculateDistance(state.lastOrigin, requestOrigin);
          const timeSinceLastRoute = Date.now() - state.lastRequestTime;

          // Avoid GPS-noise reroutes, while refreshing often enough for the
          // route start to follow someone walking along campus paths.
          if (
            movement < MIN_REROUTE_DISTANCE_METERS ||
            timeSinceLastRoute < MIN_REROUTE_INTERVAL_MS
          ) {
            if (!state.pending) break;
            continue;
          }
        }

        state.lastRequestTime = Date.now();

        const routeDestination = getRouteDestination(
          requestDestination,
          requestOrigin,
        );
        let destinationPoint = routeDestination.point;
        const originInsideCampus = isInsideCampus(
          requestOrigin.longitude,
          requestOrigin.latitude,
        );
        const destinationInsideCampus = isInsideCampus(
          routeDestination.buildingPoint.longitude,
          routeDestination.buildingPoint.latitude,
        );
        const isCampusToCampusRoute =
          originInsideCampus && destinationInsideCampus;
        const rawOfflineFallbackRoute =
          routeDestination.offlineRoute ??
          getOfflineWalkingRoute(
            requestOrigin,
            destinationPoint,
            routeDestination.hasConfirmedEntrance,
          );
        // Keep the route on traced walkways. A straight line from the walkway
        // to a building marker can cross a wall, so only a surveyed entrance
        // may be used as the route endpoint.
        const candidateOfflineRoute = rawOfflineFallbackRoute;
        const offlineFallbackRoute =
          candidateOfflineRoute &&
          (!isCampusToCampusRoute ||
            routeStaysInsideCampus(candidateOfflineRoute.coordinates))
            ? candidateOfflineRoute
            : null;
        const hasSavedCampusRoute =
          offlineFallbackRoute !== null &&
          offlineFallbackRoute.coordinates.length >= 2;

        // Show the saved route immediately while an online route is requested;
        // it remains the fallback if the network service is unavailable.
        if (
          offlineFallbackRoute &&
          offlineFallbackRoute.coordinates.length >= 2 &&
          state.destinationId === requestDestination.id &&
          selectedDestinationRef.current?.id === requestDestination.id &&
          isTrackingRef.current
        ) {
          setRouteCoordinates(offlineFallbackRoute.coordinates);
          setRouteInfo({
            distance: offlineFallbackRoute.distance,
            duration: offlineFallbackRoute.distance / 1.2,
          });
          setIsOfflineRoute(true);
          state.lastOrigin = requestOrigin;
        }

        if (forceThisRequest) {
          setIsLoadingRoute(true);
        } else {
          setIsRerouting(true);
        }

        // Use surveyed campus routes when available while offline. With an
        // internet connection, request a pedestrian route for campus trips too.
        if (!isInternetReachable) {
          if (
            state.destinationId === requestDestination.id &&
            selectedDestinationRef.current?.id === requestDestination.id &&
            isTrackingRef.current
          ) {
            if (hasSavedCampusRoute && offlineFallbackRoute) {
              setRouteCoordinates(offlineFallbackRoute.coordinates);
              setRouteInfo({
                distance: offlineFallbackRoute.distance,
                duration: offlineFallbackRoute.distance / 1.2,
              });
              setRouteInstructions([]);
              setRouteError(null);
              setIsOfflineRoute(true);
            } else {
              setRouteCoordinates([]);
              setRouteInfo(null);
              setRouteInstructions([]);
              setRouteError("No saved route is available offline. Connect to the internet and try again.");
              setIsOfflineRoute(true);
            }

            state.lastOrigin = requestOrigin;
          }
        } else {
          try {
            const start: [number, number] = [
              requestOrigin.longitude,
              requestOrigin.latitude,
            ];

            const end: [number, number] = [
              destinationPoint.longitude,
              destinationPoint.latitude,
            ];

            let data: Awaited<ReturnType<typeof getWalkingRoute>>;
            const cachedEntrance =
              state.preferredEntranceDestinationId === requestDestination.id &&
              state.preferredEntranceOrigin &&
              calculateDistance(state.preferredEntranceOrigin, requestOrigin) <
                ENTRANCE_RESELECT_DISTANCE_METERS
                ? state.preferredEntrance
                : null;

            if (requestDestination.routeEntrances.length && !cachedEntrance) {
              const candidates = await Promise.allSettled(
                requestDestination.routeEntrances.map(async (entrance) => {
                  const entranceCoordinate: [number, number] = [
                    entrance.longitude,
                    entrance.latitude,
                  ];
                  const coordinates: [number, number][] =
                    !originInsideCampus && destinationInsideCampus
                      ? [
                          start,
                          [
                            CAMPUS_STUDENT_GATE.longitude,
                            CAMPUS_STUDENT_GATE.latitude,
                          ] as [number, number],
                          entranceCoordinate,
                        ]
                      : [start, entranceCoordinate];
                  const candidateData = await getWalkingRoute(coordinates);
                  const candidateFeature = candidateData.features?.[0];
                  const candidateGeometry = candidateFeature?.geometry
                    ?.coordinates as [number, number][] | undefined;
                  const lastCoordinate = candidateGeometry?.[
                    (candidateGeometry?.length ?? 0) - 1
                  ];

                  if (
                    !candidateGeometry ||
                    candidateGeometry.length < 2 ||
                    !lastCoordinate
                  ) {
                    throw new Error("ORS returned an invalid entrance route.");
                  }
                  if (
                    isCampusToCampusRoute &&
                    !routeStaysInsideCampus(candidateGeometry)
                  ) {
                    throw new Error(
                      "The walking route leaves the campus boundary.",
                    );
                  }

                  const destinationSnapDistance = calculateDistance(
                    { latitude: lastCoordinate[1], longitude: lastCoordinate[0] },
                    entrance,
                  );
                  const routeDistance = Number(
                    candidateFeature.properties?.summary?.distance ??
                      Number.POSITIVE_INFINITY,
                  );

                  return {
                    entrance,
                    data: candidateData,
                    userDistance: calculateDistance(requestOrigin, entrance),
                    routeScore: routeDistance + destinationSnapDistance,
                    destinationSnapDistance,
                  };
                }),
              );
              const reachableCandidates = candidates
                .filter(
                  (candidate): candidate is PromiseFulfilledResult<{
                    entrance: GPSPoint;
                    data: Awaited<ReturnType<typeof getWalkingRoute>>;
                    userDistance: number;
                    routeScore: number;
                    destinationSnapDistance: number;
                  }> => candidate.status === "fulfilled",
                )
                .map((candidate) => candidate.value)
                .filter(
                  (candidate) =>
                    Number.isFinite(candidate.userDistance) &&
                    Number.isFinite(candidate.routeScore) &&
                    candidate.destinationSnapDistance <= 35,
                )
                .sort(
                  (a, b) =>
                    a.userDistance - b.userDistance ||
                    a.routeScore - b.routeScore,
                );
              const bestEntrance = reachableCandidates[0];

              if (!bestEntrance) {
                throw new Error(
                  "No walking route could reach a mapped building entrance.",
                );
              }

              destinationPoint = bestEntrance.entrance;
              data = bestEntrance.data;
              state.preferredEntranceDestinationId = requestDestination.id;
              state.preferredEntrance = bestEntrance.entrance;
              state.preferredEntranceOrigin = requestOrigin;
            } else {
              const routeEnd = cachedEntrance
                ? [cachedEntrance.longitude, cachedEntrance.latitude] as [number, number]
                : end;
              destinationPoint = cachedEntrance ?? destinationPoint;
              const routeCoordinates: [number, number][] =
                !originInsideCampus && destinationInsideCampus
                  ? [
                      start,
                      [
                        CAMPUS_STUDENT_GATE.longitude,
                        CAMPUS_STUDENT_GATE.latitude,
                      ] as [number, number],
                      routeEnd,
                    ]
                  : [start, routeEnd];
              data = await getWalkingRoute(routeCoordinates);
            }

          if (
            state.destinationId === requestDestination.id &&
            selectedDestinationRef.current?.id === requestDestination.id &&
            isTrackingRef.current
          ) {
            const feature = data.features?.[0];

            const coordinates = feature?.geometry?.coordinates as
              | [number, number][]
              | undefined;

            if (!coordinates || coordinates.length < 2) {
              throw new Error("ORS returned an invalid walking route.");
            }
            if (
              isCampusToCampusRoute &&
              !routeStaysInsideCampus(coordinates)
            ) {
              throw new Error(
                "The walking route leaves the campus boundary.",
              );
            }

            const snappedStart: GPSPoint = {
              latitude: coordinates[0][1],
              longitude: coordinates[0][0],
            };
            const lastCoordinate = coordinates[coordinates.length - 1];
            const snappedDestination: GPSPoint = {
              latitude: lastCoordinate[1],
              longitude: lastCoordinate[0],
            };
            const startConnector = calculateDistance(requestOrigin, snappedStart);
            const destinationConnector = calculateDistance(
              snappedDestination,
              destinationPoint,
            );
            const includeStart = startConnector <= 20;
            const includeDestination = destinationConnector <= 12;
            const connectorDistance =
              (includeStart ? startConnector : 0) +
              (includeDestination ? destinationConnector : 0);
            const displayedCoordinates = [
              ...(includeStart
                ? [[requestOrigin.longitude, requestOrigin.latitude] as [number, number]]
                : []),
              ...coordinates,
              ...(includeDestination
                ? [[destinationPoint.longitude, destinationPoint.latitude] as [number, number]]
                : []),
            ];

            setRouteCoordinates(displayedCoordinates);
            setRouteError(null);
            const instructionSegments = feature.properties?.segments as
              | { steps?: { instruction?: string }[] }[]
              | undefined;
            setRouteInstructions(
              instructionSegments
                ?.flatMap((segment) => segment.steps ?? [])
                .map((step) => step.instruction?.trim() ?? "")
                .filter(Boolean) ?? [],
            );

            setRouteInfo({
              distance:
                Number(feature.properties?.summary?.distance ?? 0) +
                connectorDistance,
              duration:
                Number(feature.properties?.summary?.duration ?? 0) +
                connectorDistance / 1.2,
            });
            setIsOfflineRoute(false);

            state.lastOrigin = requestOrigin;

            console.log("Walking route updated:", coordinates.length, "points");
          }
          } catch (error) {
            console.error("ORS route error:", error);

            if (
              state.destinationId === requestDestination.id &&
              selectedDestinationRef.current?.id === requestDestination.id &&
              isTrackingRef.current
            ) {
              if (
                offlineFallbackRoute &&
                offlineFallbackRoute.coordinates.length >= 2
              ) {
                setRouteCoordinates(offlineFallbackRoute.coordinates);
                setRouteInfo({
                  distance: offlineFallbackRoute.distance,
                  duration: offlineFallbackRoute.distance / 1.2,
                });
                setRouteInstructions([]);
                setRouteError(null);
                setIsOfflineRoute(true);
              } else {
                setRouteCoordinates([]);
                setRouteInfo(null);
                setRouteInstructions([]);
                setRouteError(
                  error instanceof Error
                    ? error.message
                    : "Could not find a walking route. Check your connection and try again.",
                );
                setIsOfflineRoute(false);
              }

              state.lastOrigin = requestOrigin;
            }
          }
        }

        // Process the latest GPS update if one arrived during the request.
        if (state.pending) continue;

        break;
      }
    } finally {
      state.inFlight = false;

      setIsLoadingRoute(false);
      setIsRerouting(false);

      if (
        state.pending &&
        state.latestOrigin &&
        state.latestDestination &&
        isTrackingRef.current
      ) {
        state.pending = false;

        requestNewRoute(state.latestOrigin, state.latestDestination, false);
      }
    }
  }

  // --------------------------------------------------
  // GPS TRACKING
  // --------------------------------------------------

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;
    let active = true;
    let latestAcceptedTimestamp = 0;

    async function startGPS() {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();

        if (!active) return;

        if (permission.status !== "granted") {
          setLocationMessage("Location permission is required.");
          setIsGPSReady(true);
          return;
        }

        const servicesEnabled = await Location.hasServicesEnabledAsync();

        if (!active) return;

        if (!servicesEnabled) {
          setLocationMessage(
            "Turn on Location in your phone settings to use GPS.",
          );
          setIsGPSReady(true);
          return;
        }

        setLocationMessage("Getting your current GPS position...");

        // A recent cached fix can show the user's position immediately while
        // the device looks for a fresh satellite fix, which may take longer offline.
        const lastKnownLocation = await Location.getLastKnownPositionAsync({
          maxAge: 60_000,
          requiredAccuracy: 100,
        });

        if (active && lastKnownLocation) {
          updateGPSPosition(lastKnownLocation);
          setLocationMessage(
            "Using your last GPS position while finding a fresh fix...",
          );
        }

        // Start the live listener before waiting for a one-shot fix. A slow
        // current-position request must not leave the app stuck on its cached
        // location, and the timestamp guard below prevents a late result from
        // replacing a newer live update.
        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 1000,
            distanceInterval: 1,
          },
          (location) => {
            if (!active) return;

            updateGPSPosition(location);
          },
        );

        const initialLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.BestForNavigation,
        });

        if (!active) return;

        updateGPSPosition(initialLocation);
      } catch (error) {
        console.warn("Unable to get a current GPS fix:", error);

        if (active) {
          setLocationMessage(
            "GPS could not get a current fix. Turn on Location and try outdoors.",
          );
          setIsGPSReady(true);
        }
      }
    }

    function updateGPSPosition(location: Location.LocationObject) {
      if (location.timestamp < latestAcceptedTimestamp) return;
      latestAcceptedTimestamp = location.timestamp;

      const coords = location.coords;

      setUserLocation(coords);
      setIsGPSReady(true);

      const inside = isInsideCampus(coords.longitude, coords.latitude);

      setIsInside(inside);

      setLocationMessage(
        inside
          ? "You are inside the USTP coverage area."
          : "You are outside the USTP coverage area.",
      );

      console.log(
        "GPS UPDATE:",
        coords.latitude,
        coords.longitude,
        "Accuracy:",
        coords.accuracy,
        "Inside campus:",
        inside,
      );
    }

    startGPS();

    return () => {
      active = false;
      subscription?.remove();
    };
  }, []);

  // --------------------------------------------------
  // AUTOMATIC REROUTING
  // --------------------------------------------------

  useEffect(() => {
    if (!isTracking || !selectedLocation || !userLocation) return;

    requestNewRoute(
      {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
      },
      selectedLocation,
      false,
    );
    // The changing request function must not retrigger this routing effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation, isTracking, selectedLocation]);

  // Connectivity changes trigger a route refresh. Campus routes keep using
  // the saved walkway graph; OpenRouteService is used when that graph cannot
  // route the trip or when the destination is outside campus.
  useEffect(() => {
    if (!isInternetReachable || !isTracking || !selectedLocation || !userLocation) {
      return;
    }

    requestNewRoute(
      {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
      },
      selectedLocation,
      true,
    );
    // Only rerun this effect when connectivity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInternetReachable]);

  // --------------------------------------------------
  // SELECT DESTINATION
  // --------------------------------------------------

  function selectLocation(location: CampusLocation) {
    const isSameDestination =
      selectedDestinationRef.current?.id === location.id;

    setSelectedLocation(location);
    setSelectedInfoTab("Overview");
    setSheetExpanded(false);
    // eslint-disable-next-line react-hooks/immutability
    sheetHeight.value = withSpring(collapsedSheetHeight, SHEET_SPRING);
    selectedDestinationRef.current = location;

    setSearchQuery("");
    setShowSearchResults(false);

    // Keep the route when selecting the same destination again.
    if (isSameDestination) return;

    // Stop the previous destination's navigation.
    isTrackingRef.current = false;

    setIsTracking(false);
    setIsFollowing(false);

    setRouteCoordinates([]);
    setRouteInfo(null);
    setRouteInstructions([]);
    setRouteError(null);
    setIsOfflineRoute(false);

    setIsLoadingRoute(false);
    setIsRerouting(false);

    const routeState = routeRequestRef.current;
    routeState.pending = false;
    routeState.forceNext = false;
    routeState.lastOrigin = null;
    routeState.lastRequestTime = 0;
    routeState.latestOrigin = null;
    routeState.latestDestination = null;
    routeState.destinationId = location.id;
    routeState.preferredEntranceDestinationId = null;
    routeState.preferredEntrance = null;
    routeState.preferredEntranceOrigin = null;
  }

  function selectSearchedLocation(location: CampusLocation) {
    selectLocation(location);
    setFocusedLocationId(location.id);
    setShowCategoryFilters(false);
    setIsFollowing(false);

    if (!mapSize.width || !mapSize.height || !scale) return;
    const pixel = gpsToImage(location.latitude, location.longitude);
    const finalZoom = Math.min(4, Math.max(zoom.value, 2.2));
    const targetX = -(pixel.x * scale - renderedWidth / 2) * finalZoom;
    const targetY = -(pixel.y * scale - renderedHeight * 0.47) * finalZoom;

    // eslint-disable-next-line react-hooks/immutability
    zoom.value = withTiming(finalZoom, {
      duration: 700,
      easing: Easing.out(Easing.cubic),
    });
    savedZoom.value = finalZoom;
    // eslint-disable-next-line react-hooks/immutability
    translateX.value = withTiming(
      clampTranslation(targetX, renderedWidth, mapSize.width, finalZoom),
      { duration: 700, easing: Easing.out(Easing.cubic) },
    );
    // eslint-disable-next-line react-hooks/immutability
    translateY.value = withTiming(
      clampTranslation(targetY, renderedHeight, mapSize.height, finalZoom),
      { duration: 700, easing: Easing.out(Easing.cubic) },
    );
  }

  function selectMapMarker(location: CampusLocation) {
    selectSearchedLocation(location);
  }

  // --------------------------------------------------
  // CLOSE LOCATION SHEET
  // --------------------------------------------------

  function finishClosingLocationSheet() {
    setSelectedLocation(null);
    setSelectedInfoTab("Overview");
    setFocusedLocationId(null);
    setSheetExpanded(false);
  }

  function closeLocationSheet() {
    // Stop navigation first so an in-flight route cannot update the closed sheet.
    stopTracking();
    setIsFollowing(false);

    selectedDestinationRef.current = null;

    const routeState = routeRequestRef.current;
    routeState.pending = false;
    routeState.forceNext = false;
    routeState.lastOrigin = null;
    routeState.lastRequestTime = 0;
    routeState.latestOrigin = null;
    routeState.latestDestination = null;
    routeState.destinationId = null;
    routeState.preferredEntranceDestinationId = null;
    routeState.preferredEntrance = null;
    routeState.preferredEntranceOrigin = null;

    // Slide the sheet down before unmounting it.
    sheetHeight.value = withTiming(
      0,
      {
        duration: 320,
        easing: Easing.out(Easing.cubic),
      },
      (finished) => {
        if (finished) {
          runOnJS(finishClosingLocationSheet)();
        }
      },
    );

    // Smoothly return the map to its initial campus view.
    zoom.value = withTiming(INITIAL_ZOOM, {
      duration: 750,
      easing: Easing.out(Easing.cubic),
    });
    savedZoom.value = INITIAL_ZOOM;

    translateX.value = withTiming(0, {
      duration: 750,
      easing: Easing.out(Easing.cubic),
    });
    translateY.value = withTiming(0, {
      duration: 750,
      easing: Easing.out(Easing.cubic),
    });
  }

  // --------------------------------------------------
  // START TRACKING
  // --------------------------------------------------

  async function startTracking() {
    if (!selectedLocation) return;

    if (!userLocation) {
      Alert.alert(
        "GPS unavailable",
        "Wait until your GPS position is available.",
      );
      return;
    }

    if (!userIsVisible) {
      Alert.alert(
        "Outside map coverage",
        "Your GPS position is outside the displayed campus map.",
      );
      return;
    }

    const destination = selectedLocation;

    selectedDestinationRef.current = destination;
    isTrackingRef.current = true;

    const routeState = routeRequestRef.current;
    routeState.pending = true;
    routeState.forceNext = true;
    routeState.lastOrigin = null;
    routeState.lastRequestTime = 0;
    routeState.latestOrigin = {
      latitude: userLocation.latitude,
      longitude: userLocation.longitude,
    };
    routeState.latestDestination = destination;
    routeState.destinationId = destination.id;
    routeState.preferredEntranceDestinationId = null;
    routeState.preferredEntrance = null;
    routeState.preferredEntranceOrigin = null;

    setIsTracking(true);
    setIsFollowing(true);

    await requestNewRoute(
      {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
      },
      destination,
      true,
    );
  }

  // --------------------------------------------------
  // STOP TRACKING
  // --------------------------------------------------

  function stopTracking() {
    isTrackingRef.current = false;

    setIsTracking(false);
    setIsFollowing(false);

    setRouteCoordinates([]);
    setRouteInfo(null);
    setRouteInstructions([]);
    setRouteError(null);
    setIsOfflineRoute(false);

    const routeState = routeRequestRef.current;
    routeState.pending = false;
    routeState.forceNext = false;
    routeState.lastOrigin = null;
    routeState.lastRequestTime = 0;
    routeState.latestOrigin = null;
    routeState.latestDestination = null;
    routeState.destinationId = selectedLocation?.id ?? null;
    routeState.preferredEntranceDestinationId = null;
    routeState.preferredEntrance = null;
    routeState.preferredEntranceOrigin = null;
  }

  // --------------------------------------------------
  // FOLLOW GPS
  // --------------------------------------------------

  function followMyLocation() {
    if (!userLocation) {
      Alert.alert("GPS unavailable", "Waiting for GPS location.");
      return;
    }

    if (!shouldShowGPSMarker) {
      Alert.alert(
        "Outside campus coverage",
        "Your current GPS position is outside the USTP campus perimeter or displayed map.",
      );
      return;
    }

    setIsFollowing(true);
  }

  function adjustZoom(direction: "in" | "out") {
    const nextZoom = Math.min(
      4,
      Math.max(1, zoom.value + (direction === "in" ? 0.25 : -0.25)),
    );
    // eslint-disable-next-line react-hooks/immutability
    zoom.value = withTiming(nextZoom, { duration: 250 });
    savedZoom.value = nextZoom;
    // eslint-disable-next-line react-hooks/immutability
    translateX.value = withTiming(
      clampTranslation(translateX.value, renderedWidth, mapSize.width, nextZoom),
      { duration: 250 },
    );
    // eslint-disable-next-line react-hooks/immutability
    translateY.value = withTiming(
      clampTranslation(translateY.value, renderedHeight, mapSize.height, nextZoom),
      { duration: 250 },
    );
  }

  // --------------------------------------------------
  // RESET MAP
  // --------------------------------------------------

  function resetMapPosition() {
    setIsFollowing(false);
    setFocusedLocationId(null);

    zoom.value = withTiming(INITIAL_ZOOM, {
      duration: 600,
      easing: Easing.out(Easing.cubic),
    });
    savedZoom.value = INITIAL_ZOOM;

    translateX.value = withTiming(0, {
      duration: 600,
      easing: Easing.out(Easing.cubic),
    });
    translateY.value = withTiming(0, {
      duration: 600,
      easing: Easing.out(Easing.cubic),
    });
  }

  // --------------------------------------------------
  // ROUTE DISPLAY
  // --------------------------------------------------

  // Render the exact route returned by ORS. Do not shift its starting point
  // using every GPS update; small GPS fluctuations can make the route appear
  // to move even when the user is standing still.
  const routeDisplayPoints: ImagePoint[] = routeCoordinates.map(
    ([longitude, latitude]) => gpsToImage(latitude, longitude),
  );

  // --------------------------------------------------
  // ROUTE SEGMENT RENDERER
  // --------------------------------------------------

  function renderRouteSegment(
    pointA: ImagePoint,
    pointB: ImagePoint,
    key: string,
  ) {
    const dx = (pointB.x - pointA.x) * scale;
    const dy = (pointB.y - pointA.y) * scale;

    const length = Math.sqrt(dx * dx + dy * dy);

    if (!Number.isFinite(length) || length < 0.1) {
      return null;
    }

    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

    const middleX = ((pointA.x + pointB.x) / 2) * scale;
    const middleY = ((pointA.y + pointB.y) / 2) * scale;

    return (
      <View
        key={key}
        pointerEvents="none"
        style={[
          styles.routeSegment,
          {
            width: length + 2,
            left: middleX - length / 2 - 1,
            top: middleY - 3,
            transform: [{ rotate: `${angle}deg` }],
          },
        ]}
      />
    );
  }

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------

  return (
    <View
      style={styles.container}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setMapSize({ width, height });
      }}
    >
      {/* CAMPUS MAP */}
      {scale > 0 && (
        <GestureDetector gesture={mapGesture}>
          <Animated.View
            style={[
              styles.mapFrame,
              {
                width: renderedWidth,
                height: renderedHeight,
                left: offsetX,
                top: offsetY,
              },
              animatedMapStyle,
            ]}
          >
            <Image
              source={MAP_IMAGE.source}
              style={styles.mapImage}
              resizeMode="stretch"
              onLoad={() => setIsMapLoaded(true)}
              onError={() => setIsMapLoaded(true)}
            />

            {/* BLUE WALKING ROUTE */}
            {routeDisplayPoints.slice(0, -1).map((point, index) => {
              const nextPoint = routeDisplayPoints[index + 1];

              if (
                (point.x < -100 && nextPoint.x < -100) ||
                (point.x > MAP_IMAGE.width + 100 &&
                  nextPoint.x > MAP_IMAGE.width + 100) ||
                (point.y < -100 && nextPoint.y < -100) ||
                (point.y > MAP_IMAGE.height + 100 &&
                  nextPoint.y > MAP_IMAGE.height + 100)
              ) {
                return null;
              }

              return renderRouteSegment(point, nextPoint, `route-${index}`);
            })}

            {/* BUILDING MARKERS */}
            {visibleLocations
              .filter((location) => location.showOnMap !== false)
              .map((location) => {
              const pixel = gpsToImage(location.latitude, location.longitude);

              if (
                pixel.x < 0 ||
                pixel.x > MAP_IMAGE.width ||
                pixel.y < 0 ||
                pixel.y > MAP_IMAGE.height
              ) {
                return null;
              }

              const isDestination =
                isTracking && selectedLocation?.id === location.id;
              const isFocused = focusedLocationId === location.id;
              const markerSize = location.markerSize === "small" ? 20 : 30;

              return (
                <Pressable
                  key={location.id}
                  hitSlop={8}
                  style={[
                    styles.buildingMarker,
                    location.markerSize === "small" && styles.smallBuildingMarker,
                    { borderColor: getCategoryColor(location.category) },
                    isDestination && styles.destinationMarker,
                    isFocused && styles.focusedBuildingMarker,
                    {
                      left: pixel.x * scale - markerSize / 2,
                      top: pixel.y * scale - markerSize / 2,
                    },
                  ]}
                  onPress={() => selectMapMarker(location)}
                >
                  <Animated.Text
                    style={[
                      styles.buildingMarkerText,
                      { color: getCategoryColor(location.category) },
                      location.markerSize === "small" && styles.smallBuildingMarkerText,
                      isDestination && styles.destinationMarkerText,
                      isFocused && styles.focusedBuildingMarkerText,
                      isFocused && focusedMarkerAnimatedStyle,
                    ]}
                  >
                    {location.markerLabel}
                  </Animated.Text>
                </Pressable>
              );
              })}

            {/* GPS MARKER: INSIDE CAMPUS ONLY */}
            {shouldShowGPSMarker && userPixel && (
              <View
                pointerEvents="none"
                style={[
                  styles.gpsMarker,
                  {
                    width: gpsAccuracyDiameter,
                    height: gpsAccuracyDiameter,
                    borderRadius: gpsAccuracyRadius,
                    left: userPixel.x * scale - gpsAccuracyRadius,
                    top: userPixel.y * scale - gpsAccuracyRadius,
                  },
                ]}
              >
                <View style={styles.gpsMarkerCenter} />
              </View>
            )}
          </Animated.View>
        </GestureDetector>
      )}

      {/* SEARCH BAR */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>⌕</Text>

          <TextInput
            style={styles.searchInput}
            placeholder="Search USTP buildings..."
            placeholderTextColor="#888"
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              setShowSearchResults(text.trim().length > 0);
            }}
            onFocus={() => {
              setShowSearchResults(searchQuery.trim().length > 0);
            }}
            autoCorrect={false}
            returnKeyType="search"
          />

          {searchQuery.length > 0 && (
            <Pressable
              onPress={() => {
                setSearchQuery("");
                setShowSearchResults(false);
              }}
            >
              <Text style={styles.clearSearch}>✕</Text>
            </Pressable>
          )}

          <Pressable
            style={styles.menuButton}
            onPress={() => {
              const nextVisible = !showCategoryFilters;
              setShowCategoryFilters(nextVisible);
              menuProgress.value = withTiming(nextVisible ? 1 : 0, {
                duration: 260,
                easing: Easing.out(Easing.cubic),
              });
              setShowSearchResults(false);
            }}
            accessibilityRole="button"
            accessibilityLabel="Toggle category filters"
          >
            <View style={styles.menuIcon}>
              <Animated.View style={[styles.menuIconLine, menuTopLineStyle]} />
              <Animated.View style={[styles.menuIconLine, menuMiddleLineStyle]} />
              <Animated.View style={[styles.menuIconLine, menuBottomLineStyle]} />
            </View>
          </Pressable>
        </View>

        {/* SEARCH RESULTS */}
        {showSearchResults && searchQuery.trim().length > 0 && (
          <View style={styles.searchResults}>
            <ScrollView keyboardShouldPersistTaps="handled">
              {searchResults.length > 0 ? (
                searchResults.map((location) => (
                  <Pressable
                    key={location.id}
                    style={styles.searchResultItem}
                    onPress={() => selectSearchedLocation(location)}
                  >
                    <View style={[styles.resultNumber, { backgroundColor: getCategoryColor(location.category) }]}>
                      <Text style={styles.resultNumberText}>
                        {location.markerLabel}
                      </Text>
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.resultBuilding}>
                        {location.building}
                      </Text>

                      <Text style={styles.resultName}>{location.name}</Text>
                    </View>
                  </Pressable>
                ))
              ) : (
                <Text style={styles.noResults}>
                  No matching locations found.
                </Text>
              )}
            </ScrollView>
          </View>
        )}
      </View>

      <Animated.View
        pointerEvents={showCategoryFilters ? "auto" : "none"}
        style={[styles.categoryContainer, categoryPanelStyle]}
      >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryList}
          >
            {availableCategories.map((category) => {
              const active = selectedCategory === category;
              return (
                <Pressable
                  key={category}
                  style={[
                    styles.categoryChip,
                    active && styles.categoryChipActive,
                  ]}
                  onPress={() => {
                    setSelectedCategory(category);
                    setShowSearchResults(false);
                  }}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      active && styles.categoryChipTextActive,
                    ]}
                  >
                    {category}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
      </Animated.View>

      {/* GPS STATUS */}
      <View
        style={[
          styles.status,
          showCategoryFilters && styles.statusBelowFilters,
          isInside === true
            ? styles.insideStatus
            : isInside === false
              ? styles.outsideStatus
              : styles.checkingStatus,
        ]}
      >
        <Text style={styles.statusText}>{locationMessage}</Text>

        {userLocation && (
          <Text style={styles.coordinatesText}>
            {userLocation.latitude.toFixed(6)},{" "}
            {userLocation.longitude.toFixed(6)}
          </Text>
        )}

        {userLocation?.accuracy != null && (
          <Text style={styles.coordinatesText}>
            GPS accuracy: about ±{Math.round(userLocation.accuracy)} m
          </Text>
        )}

        {userLocation && isInside === false && (
          <Text style={styles.coordinatesText}>
            GPS marker hidden: outside campus perimeter.
          </Text>
        )}

        {userLocation && isInside === true && !userIsVisible && (
          <Text style={styles.coordinatesText}>
            GPS marker hidden: outside displayed map image.
          </Text>
        )}
      </View>

      <Text pointerEvents="none" style={styles.mapAttribution}>
        © OpenStreetMap contributors
      </Text>

      {/* MY LOCATION / FOLLOW */}
      <Pressable
        style={[
          styles.followButton,
          { bottom: 90 },
          isFollowing && styles.followButtonActive,
        ]}
        onPress={followMyLocation}
      >
        <Text
          style={[
            styles.followButtonText,
            isFollowing && styles.followButtonTextActive,
          ]}
        >
          {isFollowing ? "◎" : "⌖"}
        </Text>
      </Pressable>

      {/* RESET */}
      <Pressable
        style={[
          styles.resetButton,
          { bottom: 30 },
        ]}
        onPress={resetMapPosition}
      >
        <Text style={styles.resetButtonText}>⟲</Text>
      </Pressable>

      <View
        style={[
          styles.zoomControls,
          {
            // Keep the zoom controls in a fixed position underneath the bottom sheet.
            bottom: ZOOM_CONTROLS_BOTTOM + ZOOM_CONTROLS_VERTICAL_OFFSET,
          },
        ]}
      >
        <Pressable
          style={styles.zoomButton}
          onPress={() => adjustZoom("in")}
          accessibilityRole="button"
          accessibilityLabel="Zoom in"
        >
          <Text style={styles.zoomButtonText}>+</Text>
        </Pressable>
        <Pressable
          style={styles.zoomButton}
          onPress={() => adjustZoom("out")}
          accessibilityRole="button"
          accessibilityLabel="Zoom out"
        >
          <Text style={styles.zoomButtonText}>−</Text>
        </Pressable>
      </View>

      {selectedLocation && (
        <LocationBottomSheet
          selectedLocation={selectedLocation}
          selectedInfoTab={selectedInfoTab}
          routeInfo={routeInfo}
          routeInstructions={routeInstructions}
          routeError={routeError}
          isOfflineRoute={isOfflineRoute}
          isTracking={isTracking}
          isLoadingRoute={isLoadingRoute}
          isRerouting={isRerouting}
          sheetExpanded={sheetExpanded}
          animatedSheetStyle={animatedSheetStyle}
          sheetDragGesture={sheetDragGesture}
          onClose={closeLocationSheet}
          onToggleSheet={toggleSheet}
          onStartTracking={startTracking}
          onStartOrFollow={() => {
            if (isTracking) followMyLocation();
            else void startTracking();
          }}
          onMore={() => {
            setSelectedInfoTab("Offices");
            expandSheet();
          }}
          onTabChange={setSelectedInfoTab}
          onStopTracking={stopTracking}
        />
      )}

      {showLoadingScreen && (
        <LoadingScreen
          mapReady={isMapLoaded}
          gpsReady={isGPSReady}
          minTimeDone={isMinimumLoadingTimeComplete}
          duration={LOADING_DURATION}
          onFinished={() => setShowLoadingScreen(false)}
        />
      )}
    </View>
  );
}

// --------------------------------------------------
// STYLES
// --------------------------------------------------

const styles = StyleSheet.create({
  menuButton: {
    width: 35,
    height: 35,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },

  menuIcon: {
    width: 18,
    height: 16,
    justifyContent: "space-between",
    alignItems: "center",
  },

  menuIconLine: {
    width: 17,
    height: 2,
    borderRadius: 3,
    backgroundColor: "#FFC900",
  },

  categoryContainer: {
    position: "absolute",
    top: 102,
    left: 0,
    right: 0,
    zIndex: 9,
  },

  categoryList: {
    paddingHorizontal: 16,
    paddingVertical: 5,
    gap: 8,
  },

  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 22,
    backgroundColor: "rgba(29, 29, 29, 0.96)",
    borderWidth: 1,
    borderColor: "#505050",
  },

  categoryChipActive: {
    backgroundColor: "#FFC900",
    borderColor: "#FFC900",
  },

  categoryChipText: {
    color: "#F2F2F2",
    fontSize: 12,
    fontWeight: "700",
  },

  categoryChipTextActive: {
    color: "#171717",
  },

  container: {
    flex: 1,
    backgroundColor: "#343434",
    overflow: "hidden",
  },

  mapFrame: {
    position: "absolute",
  },

  mapImage: {
    width: "100%",
    height: "100%",
  },

  // Walking route
  routeSegment: {
    position: "absolute",
    height: 6,
    borderRadius: 2,
    backgroundColor: "#FFC900",
    zIndex: 4,
    elevation: 4,
  },

  // Building markers
  buildingMarker: {
    position: "absolute",
    width: 30,
    height: 30,
    borderRadius: 18,
    backgroundColor: "#1D1D1D",
    borderWidth: 2,
    borderColor: "#FFC900",
    alignItems: "center",
    justifyContent: "center",
    elevation: 5,
    zIndex: 5,
  },

  smallBuildingMarker: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
  },

  smallBuildingMarkerText: {
    fontSize: 8,
  },

  destinationMarker: {
    backgroundColor: "#FFC900",
    borderColor: "#F2F2F2",
    borderWidth: 3,
    width: 36,
    height: 36,
    borderRadius: 20,
  },

  buildingMarkerText: {
    color: "#FFC900",
    fontSize: 12,
    fontWeight: "bold",
  },

  destinationMarkerText: {
    color: "#111111",
  },

  focusedBuildingMarker: {
    backgroundColor: "#FFC900",
    borderColor: "#FFFFFF",
    borderWidth: 3,
    elevation: 12,
    zIndex: 20,
  },

  focusedBuildingMarkerText: {
    color: "#150E3C",
    fontWeight: "900",
  },

  // GPS marker
  gpsMarker: {
    position: "absolute",
    width: 22,
    height: 22,
    borderRadius: 15,
    backgroundColor: "rgba(255, 201, 0, 0.2)",
    borderWidth: 2,
    borderColor: "#F2F2F2",
    alignItems: "center",
    justifyContent: "center",
    elevation: 10,
    zIndex: 8,
  },

  gpsMarkerCenter: {
    width: 10,
    height: 10,
    borderRadius: 6,
    backgroundColor: "#F04452",
  },

  // Search
  searchContainer: {
    position: "absolute",
    top: 45,
    left: 15,
    right: 15,
    zIndex: 10,
  },

  searchBar: {
    height: 52,
    backgroundColor: "#1D1D1D",
    borderWidth: 1,
    borderColor: "#343434",
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    elevation: 6,
  },

  searchIcon: {
    fontSize: 27,
    color: "#FFC900",
    marginRight: 10,
    top: -3,
  },

  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#F2F2F2",
    height: "100%",
  },

  clearSearch: {
    fontSize: 19,
    color: "#FFC900",
    padding: 5,
  },

  searchResults: {
    backgroundColor: "#1D1D1D",
    borderWidth: 1,
    borderColor: "#343434",
    borderRadius: 14,
    marginTop: 8,
    maxHeight: 280,
    elevation: 7,
    overflow: "hidden",
  },

  searchResultItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#343434",
  },

  resultNumber: {
    width: 35,
    height: 35,
    borderRadius: 20,
    backgroundColor: "#FFC900",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  resultNumberText: {
    color: "#111111",
    fontWeight: "700",
  },

  resultBuilding: {
    fontSize: 11,
    color: "#FFC900",
    fontWeight: "700",
  },

  resultName: {
    fontSize: 14,
    color: "#F2F2F2",
    fontWeight: "600",
    marginTop: 3,
  },

  noResults: {
    padding: 20,
    color: "#A6A6A6",
    textAlign: "center",
  },

  // GPS status
  status: {
    position: "absolute",
    top: 110,
    left: 20,
    right: 20,
    padding: 12,
    borderRadius: 12,
    elevation: 5,
  },

  insideStatus: {
    backgroundColor: "#1D1D1D",
    borderWidth: 1,
    borderColor: "#FFC900",
  },

  outsideStatus: {
    backgroundColor: "#2A191B",
    borderWidth: 1,
    borderColor: "#F04452",
  },

  checkingStatus: {
    backgroundColor: "#1D1D1D",
    borderWidth: 1,
    borderColor: "#4A4A4A",
  },

  statusBelowFilters: {
    top: 158,
  },

  statusText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },

  coordinatesText: {
    color: "#FFFFFF",
    fontSize: 11,
    textAlign: "center",
    marginTop: 5,
  },

  mapAttribution: {
    position: "absolute",
    left: 10,
    bottom: 6,
    color: "#FFFFFF",
    fontSize: 9,
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowRadius: 2,
    zIndex: 6,
  },

  // Follow button
  followButton: {
    position: "absolute",
    left: 18,
    bottom: 90,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#1D1D1D",
    alignItems: "center",
    justifyContent: "center",
    elevation: 5,
    zIndex: 5,
    borderWidth: 1,
    borderColor: "#4A4A4A",
  },

  followButtonActive: {
    backgroundColor: "#FFC900",
    borderColor: "#F2F2F2",
  },

  followButtonText: {
    fontSize: 27,
    color: "#FFC900",
    fontWeight: "bold",
  },

  followButtonTextActive: {
    color: "#111111",
  },

  // Reset button
  resetButton: {
    position: "absolute",
    left: 18,
    bottom: 30,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#1D1D1D",
    alignItems: "center",
    justifyContent: "center",
    elevation: 5,
    zIndex: 5,
  },

  resetButtonText: {
    fontSize: 30,
    color: "#FFC900",
  },

  zoomControls: {
    position: "absolute",
    right: 18,
    alignItems: "center",
    gap: 8,
    // Lower stacking level: the location bottom sheet must cover these.
    zIndex: 5,
    elevation: 5,
  },

  zoomButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#1D1D1D",
    borderWidth: 1,
    borderColor: "#4A4A4A",
    alignItems: "center",
    justifyContent: "center",
    elevation: 7,
  },

  zoomButtonText: {
    color: "#FFC900",
    fontSize: 28,
    fontWeight: "600",
    lineHeight: 32,
  },

  // Building card
  locationCard: {
    position: "absolute",
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: "#1D1D1D",
    borderWidth: 1,
    borderColor: "#343434",
    padding: 18,
    borderRadius: 16,
    elevation: 8,
    zIndex: 20,
  },

  locationHeader: {
    flexDirection: "row",
    alignItems: "center",
  },

  locationPhoto: {
    width: 88,
    height: 88,
    borderRadius: 10,
    marginRight: 12,
    backgroundColor: "#272727",
  },

  locationPhotoPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 10,
    marginRight: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#5A5A5A",
    backgroundColor: "#272727",
    alignItems: "center",
    justifyContent: "center",
  },

  locationPhotoPlaceholderIcon: {
    fontSize: 26,
    color: "#FFC900",
  },

  locationPhotoPlaceholderText: {
    fontSize: 10,
    color: "#A6A6A6",
    marginTop: 2,
  },

  locationTitleGroup: {
    flex: 1,
  },

  locationBuilding: {
    fontSize: 12,
    color: "#FFC900",
    fontWeight: "700",
  },

  locationName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#F2F2F2",
    marginTop: 5,
  },

  locationDescription: {
    fontSize: 14,
    color: "#A6A6A6",
    marginTop: 8,
  },

  routeInfoText: {
    color: "#FFC900",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 12,
  },

  reroutingText: {
    color: "#FFC900",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 8,
  },

  offlineRouteWarning: {
    color: "#FFD166",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 8,
  },

  trackButton: {
    backgroundColor: "#FFC900",
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 16,
  },

  trackButtonDisabled: {
    opacity: 0.6,
  },

  trackButtonText: {
    color: "#111111",
    fontSize: 15,
    fontWeight: "700",
  },

  stopTrackButton: {
    backgroundColor: "#2A191B",
    borderWidth: 1,
    borderColor: "#613037",
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
    marginTop: 8,
  },

  stopTrackButtonText: {
    color: "#FF8A94",
    fontSize: 14,
    fontWeight: "700",
  },

  closeButton: {
    alignItems: "center",
    marginTop: 15,
    padding: 10,
  },

  closeButtonText: {
    color: "#FFC900",
    fontWeight: "700",
  },
});
