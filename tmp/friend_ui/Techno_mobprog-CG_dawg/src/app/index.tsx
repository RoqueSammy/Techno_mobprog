import * as Location from "expo-location";
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
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { CAMPUS_BOUNDARY } from "../constants/campusBoundary";
import { IMPORTANT_LOCATIONS } from "../constants/importantLocations";
import { MAP_IMAGE, gpsToImage } from "../constants/mapCalibration";
import { getOfflineWalkingRoute } from "../services/offlineRouting";
import { getWalkingRoute } from "../services/ors";

import LocationBottomSheet, {
  type InfoTab,
} from "../components/location-bottom-sheet";

// --------------------------------------------------
// TYPES
// --------------------------------------------------

type CampusLocation = (typeof IMPORTANT_LOCATIONS)[number];

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
};

type LoadingScreenProps = {
  mapReady: boolean;
  gpsReady: boolean;
  minTimeDone: boolean;
  duration: number;
  onFinished: () => void;
};

const MIN_REROUTE_DISTANCE_METERS = 15;
const MIN_REROUTE_INTERVAL_MS = 8_000;

const SHEET_SPRING = {
  damping: 24,
  stiffness: 180,
  mass: 0.8,
};

const MAP_SPRING = {
  damping: 20,
  stiffness: 150,
  mass: 0.8,
};

// --------------------------------------------------
// SEARCH ALIASES
// --------------------------------------------------

const SEARCH_ALIASES: Record<number, string[]> = {
  9: ["IT", "CITC", "Information Technology", "Building 9"],
  28: ["Nursing", "Building 28", "Old Science Building"],
  27: ["Clinic", "Health Center", "Medical"],
  47: ["Technology", "College of Technology"],
  40: ["Big Foot", "Mosquito Breeding"],
  0: ["Gate", "Entrance", "Starting Point"],
  20: ["Cafeteria", "Food", "Canteen"],
  42: ["CEA", "Engineering", "Architecture"],
  8: ["Movable Classroom", "Classroom"],
  23: ["LRC", "Learning Resource Center", "Resource Center"],
  14: ["SHS", "Senior High", "Senior High School", "Finance And Accounting", "Building 14"],
  41: ["Building 41", "Science", "Science Complex"],
  19: ["NSTP", "National Service Training Program"],
  18: ["Culinary", "Culinary Building"],
  3: ["Medicine", "College of Medicine", "Building 3", "COM"],
  4: ["Lounge", "Student Lounge"],
  16: ["DRER", "Gym", "Gymnasium", "DRER Memorial Hall"],
};

// --------------------------------------------------
// ANIMATED LOADING SCREEN - RIPPLE RING
// --------------------------------------------------

function Ring({ delay }: { delay: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, {
          duration: 2600,
          easing: Easing.out(Easing.quad),
        }),
        -1,
        false,
      ),
    );
  }, []);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0.5, 0]),
    transform: [
      {
        scale: interpolate(progress.value, [0, 1], [0.7, 2.1]),
      },
    ],
  }));

  return <Animated.View style={[loadingStyles.ring, ringStyle]} />;
}

// --------------------------------------------------
// ANIMATED LOADING SCREEN
// --------------------------------------------------

function LoadingScreen({
  mapReady,
  gpsReady,
  minTimeDone,
  duration,
  onFinished,
}: LoadingScreenProps) {
  const screenOpacity = useSharedValue(1);
  const exitScale = useSharedValue(1);

  const logoIn = useSharedValue(0);
  const logoFloat = useSharedValue(0);
  const titleIn = useSharedValue(0);
  const taglineIn = useSharedValue(0);
  const barIn = useSharedValue(0);
  const progress = useSharedValue(0);

  const isReady = mapReady && gpsReady && minTimeDone;

  const statusText = !mapReady
    ? "Loading campus map..."
    : !gpsReady
      ? "Finding your location..."
      : !minTimeDone
        ? "Almost there..."
        : "Ready!";

  // ENTRANCE ANIMATIONS
  useEffect(() => {
    logoIn.value = withSpring(1, {
      damping: 12,
      stiffness: 110,
    });

    logoFloat.value = withDelay(
      600,
      withRepeat(
        withSequence(
          withTiming(-7, {
            duration: 1400,
            easing: Easing.inOut(Easing.quad),
          }),
          withTiming(0, {
            duration: 1400,
            easing: Easing.inOut(Easing.quad),
          }),
        ),
        -1,
        false,
      ),
    );

    titleIn.value = withDelay(
      350,
      withTiming(1, {
        duration: 600,
        easing: Easing.out(Easing.cubic),
      }),
    );

    taglineIn.value = withDelay(
      550,
      withTiming(1, {
        duration: 600,
        easing: Easing.out(Easing.cubic),
      }),
    );

    barIn.value = withDelay(
      800,
      withTiming(1, { duration: 500 }),
    );

    progress.value = withDelay(
      800,
      withTiming(0.9, {
        duration: Math.max(500, duration - 800),
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, []);

  // EXIT ANIMATION
  useEffect(() => {
    if (!isReady) return;

    progress.value = withTiming(1, {
      duration: 300,
      easing: Easing.out(Easing.quad),
    });

    exitScale.value = withDelay(
      450,
      withTiming(1.08, {
        duration: 600,
        easing: Easing.in(Easing.quad),
      }),
    );

    screenOpacity.value = withDelay(
      450,
      withTiming(
        0,
        { duration: 600 },
        (finished) => {
          if (finished) {
            runOnJS(onFinished)();
          }
        },
      ),
    );
  }, [isReady]);

  const screenStyle = useAnimatedStyle(() => ({
    opacity: screenOpacity.value,
  }));

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ scale: exitScale.value }],
  }));

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoIn.value,
    transform: [
      { translateY: logoFloat.value },
      {
        scale: interpolate(logoIn.value, [0, 1], [0.5, 1]),
      },
    ],
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleIn.value,
    transform: [
      {
        translateY: interpolate(titleIn.value, [0, 1], [16, 0]),
      },
    ],
  }));

  const taglineStyle = useAnimatedStyle(() => ({
    opacity: taglineIn.value,
    transform: [
      {
        translateY: interpolate(taglineIn.value, [0, 1], [12, 0]),
      },
    ],
  }));

  const barContainerStyle = useAnimatedStyle(() => ({
    opacity: barIn.value,
  }));

  const barFillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  return (
    <Animated.View style={[loadingStyles.screen, screenStyle]}>
      <View
        pointerEvents="none"
        style={loadingStyles.glow}
      />

      <Animated.View
        style={[loadingStyles.content, contentStyle]}
      >
        <View style={loadingStyles.logoWrapper}>
          <Ring delay={0} />
          <Ring delay={870} />
          <Ring delay={1740} />

          <Animated.Image
            source={require("../../assets/images/logo.png")}
            style={[loadingStyles.logo, logoStyle]}
            resizeMode="contain"
          />
        </View>

        <Animated.Text
          style={[loadingStyles.title, titleStyle]}
        >
          TRAIL-IT
        </Animated.Text>

        <Animated.Text
          style={[loadingStyles.tagline, taglineStyle]}
        >
          Find your way around USTP
        </Animated.Text>

        <Animated.View
          style={[
            loadingStyles.progressArea,
            barContainerStyle,
          ]}
        >
          <View style={loadingStyles.progressTrack}>
            <Animated.View
              style={[
                loadingStyles.progressFill,
                barFillStyle,
              ]}
            />
          </View>

          <Text style={loadingStyles.statusText}>
            {statusText}
          </Text>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

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
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLon / 2) ** 2;

  return (
    earthRadius *
    2 *
    Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
  );
}

// --------------------------------------------------
// CAMPUS PERIMETER CHECK
// --------------------------------------------------

function isInsideCampus(longitude: number, latitude: number) {
  const boundary = CAMPUS_BOUNDARY;
  const tolerance = 0.000072;

  let inside = false;

  for (let i = 0, j = boundary.length - 1; i < boundary.length; j = i++) {
    const xi = boundary[i].longitude;
    const yi = boundary[i].latitude;

    const xj = boundary[j].longitude;
    const yj = boundary[j].latitude;

    const dx = (xj - xi) * Math.cos((latitude * Math.PI) / 180);
    const dy = yj - yi;

    const px = (longitude - xi) * Math.cos((latitude * Math.PI) / 180);
    const py = latitude - yi;

    const lengthSquared = dx * dx + dy * dy;

    const t =
      lengthSquared === 0
        ? 0
        : Math.max(
            0,
            Math.min(1, (px * dx + py * dy) / lengthSquared),
          );

    const closestX = xi + t * (xj - xi);
    const closestY = yi + t * (yj - yi);

    const distance = Math.hypot(
      (longitude - closestX) * Math.cos((latitude * Math.PI) / 180),
      latitude - closestY,
    );

    if (distance <= tolerance) {
      return true;
    }

    const intersects =
      (yi > latitude) !== (yj > latitude) &&
      longitude <
        ((xj - xi) * (latitude - yi)) / (yj - yi) + xi;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

// --------------------------------------------------
// MAIN SCREEN
// --------------------------------------------------

export default function HomeScreen() {
  // --------------------------------------------------
  // INITIAL LOADING SCREEN
  // --------------------------------------------------

  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [isGPSReady, setIsGPSReady] = useState(false);

  const [
    isMinimumLoadingTimeComplete,
    setIsMinimumLoadingTimeComplete,
  ] = useState(false);

  const [showLoadingScreen, setShowLoadingScreen] = useState(true);

  const LOADING_DURATION = 3000;

  useEffect(() => {
    const loadingTimer = setTimeout(() => {
      setIsMinimumLoadingTimeComplete(true);
    }, LOADING_DURATION);

    return () => {
      clearTimeout(loadingTimer);
    };
  }, []);

  // GPS
  const [userLocation, setUserLocation] =
    useState<Location.LocationObjectCoords | null>(null);

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

  const availableCategories = [
    "All",
    ...Array.from(
      new Set(
        IMPORTANT_LOCATIONS
          .map((location) => location.category)
          .filter((category): category is string => Boolean(category)),
      ),
    ),
  ];

  const visibleLocations =
    selectedCategory === "All"
      ? IMPORTANT_LOCATIONS
      : IMPORTANT_LOCATIONS.filter(
          (location) => location.category === selectedCategory,
        );

  // DESTINATION
  const [selectedLocation, setSelectedLocation] =
    useState<CampusLocation | null>(null);

  // SEARCHED BUILDING HIGHLIGHT
  const [focusedLocationId, setFocusedLocationId] =
    useState<number | null>(null);

  // BUILDING INFORMATION TABS
  const [selectedInfoTab, setSelectedInfoTab] =
    useState<InfoTab>("Overview");

  // BOTTOM SHEET STATE AND ANIMATION
  const [sheetExpanded, setSheetExpanded] = useState(false);

  const sheetHeight = useSharedValue(0);
  const sheetDragStart = useSharedValue(0);
  const sheetDragCurrent = useSharedValue(0);

  const collapsedSheetHeight = mapSize.height * 0.43;
  const expandedSheetHeight = mapSize.height * 0.85;

  function expandSheet() {
    setSheetExpanded(true);

    sheetHeight.value = withSpring(
      expandedSheetHeight,
      SHEET_SPRING,
    );
  }

  function collapseSheet() {
    setSheetExpanded(false);

    sheetHeight.value = withSpring(
      collapsedSheetHeight,
      SHEET_SPRING,
    );
  }

  function toggleSheet() {
    if (sheetExpanded) {
      collapseSheet();
    } else {
      expandSheet();
    }
  }

  // NAVIGATION
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>(
    [],
  );

  const [routeInfo, setRouteInfo] = useState<RouteSummary | null>(null);
  const [isOfflineRoute, setIsOfflineRoute] = useState(false);

  const [isTracking, setIsTracking] = useState(false);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [isRerouting, setIsRerouting] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);

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
  });

  // --------------------------------------------------
  // INITIAL MAP ZOOM
  // --------------------------------------------------

  const INITIAL_ZOOM = 1.35;

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

    const maximum = Math.max(
      0,
      (imageSize * currentZoom - viewportSize) / 2,
    );

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
      const nextZoom = Math.min(
        4,
        Math.max(1, savedZoom.value * event.scale),
      );

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

  // --------------------------------------------------
  // BOTTOM SHEET ANIMATION
  // --------------------------------------------------

  useEffect(() => {
    if (mapSize.height <= 0) return;

    const targetHeight =
      mapSize.height * (sheetExpanded ? 0.85 : 0.43);

    sheetHeight.value = withSpring(
      targetHeight,
      SHEET_SPRING,
    );
  }, [mapSize.height, sheetExpanded]);

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
      sheetHeight.value = nextHeight;
    })
    .onEnd((event) => {
      const middleHeight =
        (collapsedSheetHeight + expandedSheetHeight) / 2;

      const shouldExpand =
        sheetDragCurrent.value > middleHeight ||
        event.velocityY < -500;

      const targetHeight = shouldExpand
        ? expandedSheetHeight
        : collapsedSheetHeight;

      sheetHeight.value = withSpring(
        targetHeight,
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

  // --------------------------------------------------
  // SELECTED BUILDING NUMBER ANIMATION
  // --------------------------------------------------

  const focusedMarkerScale = useSharedValue(1);

  useEffect(() => {
    if (focusedLocationId === null) {
      focusedMarkerScale.value = withTiming(1);
      return;
    }

    focusedMarkerScale.value = 1;

    focusedMarkerScale.value = withRepeat(
      withSequence(
        withTiming(1.5, {
          duration: 500,
          easing: Easing.out(Easing.quad),
        }),
        withTiming(1, {
          duration: 500,
          easing: Easing.inOut(Easing.quad),
        }),
      ),
      -1,
      false,
    );
  }, [focusedLocationId]);

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
    Math.min(90, (userLocation?.accuracy ?? 8) * 3.9565 * scale * 2),
  );

  const gpsAccuracyRadius = gpsAccuracyDiameter / 2;

  const userIsVisible =
    userPixel !== null &&
    userPixel.x >= 0 &&
    userPixel.x <= MAP_IMAGE.width &&
    userPixel.y >= 0 &&
    userPixel.y <= MAP_IMAGE.height;

  const shouldShowGPSMarker =
    isInside === true && userIsVisible && userPixel !== null;

  // --------------------------------------------------
  // FOLLOW MODE
  // --------------------------------------------------

  useEffect(() => {
    if (!isFollowing || !shouldShowGPSMarker || !userPixel) return;

    if (!mapSize.width || !mapSize.height || !scale) return;

    const currentZoom = zoom.value;

    const targetX =
      -(userPixel.x * scale - renderedWidth / 2) * currentZoom;

    const targetY =
      -(userPixel.y * scale - renderedHeight / 2) * currentZoom;

    // eslint-disable-next-line react-hooks/immutability
    translateX.value = withTiming(
      clampTranslation(
        targetX,
        renderedWidth,
        mapSize.width,
        currentZoom,
      ),
      { duration: 400 },
    );

    // eslint-disable-next-line react-hooks/immutability
    translateY.value = withTiming(
      clampTranslation(
        targetY,
        renderedHeight,
        mapSize.height,
        currentZoom,
      ),
      { duration: 400 },
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

  const searchResults = visibleLocations.filter((location) => {
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
          const movement = calculateDistance(
            state.lastOrigin,
            requestOrigin,
          );

          const timeSinceLastRoute =
            Date.now() - state.lastRequestTime;

          if (
            movement < MIN_REROUTE_DISTANCE_METERS ||
            timeSinceLastRoute < MIN_REROUTE_INTERVAL_MS
          ) {
            if (!state.pending) break;
            continue;
          }
        }

        state.lastRequestTime = Date.now();

        const destinationPoint: GPSPoint = {
          latitude: requestDestination.latitude,
          longitude: requestDestination.longitude,
        };

        const offlineFallbackRoute = getOfflineWalkingRoute(
          requestOrigin,
          destinationPoint,
        );

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

        try {
          const start: [number, number] = [
            requestOrigin.longitude,
            requestOrigin.latitude,
          ];

          const end: [number, number] = [
            requestDestination.longitude,
            requestDestination.latitude,
          ];

          const data = await getWalkingRoute(start, end);

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

            const snappedStart: GPSPoint = {
              latitude: coordinates[0][1],
              longitude: coordinates[0][0],
            };

            const lastCoordinate =
              coordinates[coordinates.length - 1];

            const snappedDestination: GPSPoint = {
              latitude: lastCoordinate[1],
              longitude: lastCoordinate[0],
            };

            const startConnector = calculateDistance(
              requestOrigin,
              snappedStart,
            );

            const destinationConnector = calculateDistance(
              snappedDestination,
              {
                latitude: requestDestination.latitude,
                longitude: requestDestination.longitude,
              },
            );

            const includeStart = startConnector <= 12;
            const includeDestination = destinationConnector <= 12;

            const connectorDistance =
              (includeStart ? startConnector : 0) +
              (includeDestination ? destinationConnector : 0);

            const displayedCoordinates = [
              ...(includeStart
                ? [
                    [
                      requestOrigin.longitude,
                      requestOrigin.latitude,
                    ] as [number, number],
                  ]
                : []),
              ...coordinates,
              ...(includeDestination ? [end] : []),
            ];

            setRouteCoordinates(displayedCoordinates);

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

            console.log(
              "Walking route updated:",
              coordinates.length,
              "points",
            );
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
            } else {
              const distance = calculateDistance(
                requestOrigin,
                destinationPoint,
              );

              setRouteCoordinates([]);
              setRouteInfo({
                distance,
                duration: distance / 1.2,
              });
            }

            setIsOfflineRoute(true);
            state.lastOrigin = requestOrigin;
          }
        }

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

        requestNewRoute(
          state.latestOrigin,
          state.latestDestination,
          false,
        );
      }
    }
  }

  // --------------------------------------------------
  // GPS TRACKING
  // --------------------------------------------------

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;
    let active = true;

    async function startGPS() {
      try {
        const permission =
          await Location.requestForegroundPermissionsAsync();

        if (!active) return;

        if (permission.status !== "granted") {
          return;
        }

        const servicesEnabled =
          await Location.hasServicesEnabledAsync();

        if (!active) return;

        if (!servicesEnabled) {
          return;
        }

        const lastKnownLocation =
          await Location.getLastKnownPositionAsync({
            maxAge: 60_000,
            requiredAccuracy: 100,
          });

        if (active && lastKnownLocation) {
          updateGPSPosition(lastKnownLocation);
        }

        const initialLocation =
          await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.BestForNavigation,
          });

        if (!active) return;

        updateGPSPosition(initialLocation);

        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 3000,
            distanceInterval: 3,
          },
          (location) => {
            if (!active) return;

            updateGPSPosition(location);
          },
        );
      } catch (error) {
        console.warn("Unable to get a current GPS fix:", error);
      }
    }

    function updateGPSPosition(location: Location.LocationObject) {
      const coords = location.coords;

      setUserLocation(coords);

      const inside = isInsideCampus(
        coords.longitude,
        coords.latitude,
      );

      setIsInside(inside);

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

    startGPS().finally(() => {
      if (active) {
        setIsGPSReady(true);
      }
    });

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

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation, isTracking, selectedLocation]);

  // --------------------------------------------------
  // SELECT DESTINATION
  // --------------------------------------------------

  function selectLocation(location: CampusLocation) {
    const isSameDestination =
      selectedDestinationRef.current?.id === location.id;

    setSelectedLocation(location);
    setSelectedInfoTab("Overview");
    setSheetExpanded(false);

    sheetHeight.value = withSpring(
      collapsedSheetHeight,
      SHEET_SPRING,
    );

    selectedDestinationRef.current = location;

    setSearchQuery("");
    setShowSearchResults(false);

    if (isSameDestination) return;

    isTrackingRef.current = false;

    setIsTracking(false);
    setIsFollowing(false);

    setRouteCoordinates([]);
    setRouteInfo(null);
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
  }

  // --------------------------------------------------
  // SELECT SEARCH RESULT AND FOCUS ON BUILDING
  // --------------------------------------------------

  function selectSearchedLocation(location: CampusLocation) {
    selectLocation(location);

    setFocusedLocationId(location.id);

    setIsFollowing(false);

    if (
      !mapSize.width ||
      !mapSize.height ||
      !scale ||
      renderedWidth <= 0 ||
      renderedHeight <= 0
    ) {
      return;
    }

    const pixel = gpsToImage(
      location.latitude,
      location.longitude,
    );

    const targetZoom = Math.max(zoom.value, 2.2);
    const finalZoom = Math.min(4, targetZoom);

    const targetX =
      -(pixel.x * scale - renderedWidth / 2) * finalZoom;

    const targetY =
      -(pixel.y * scale - renderedHeight * 0.47) * finalZoom;

    zoom.value = withTiming(finalZoom, {
      duration: 700,
      easing: Easing.out(Easing.cubic),
    });

    savedZoom.value = finalZoom;

    translateX.value = withTiming(
      clampTranslation(
        targetX,
        renderedWidth,
        mapSize.width,
        finalZoom,
      ),
      {
        duration: 700,
        easing: Easing.out(Easing.cubic),
      },
    );

    translateY.value = withTiming(
      clampTranslation(
        targetY,
        renderedHeight,
        mapSize.height,
        finalZoom,
      ),
      {
        duration: 700,
        easing: Easing.out(Easing.cubic),
      },
    );
  }

  // --------------------------------------------------
  // SELECT BUILDING MARKER AND FOCUS ON BUILDING
  // --------------------------------------------------

  function selectMapMarker(location: CampusLocation) {
    selectSearchedLocation(location);
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
    setIsOfflineRoute(false);

    const routeState = routeRequestRef.current;

    routeState.pending = false;
    routeState.forceNext = false;
    routeState.lastOrigin = null;
    routeState.lastRequestTime = 0;
    routeState.latestOrigin = null;
    routeState.latestDestination = null;
    routeState.destinationId = selectedLocation?.id ?? null;
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

  // --------------------------------------------------
  // RESET MAP
  // --------------------------------------------------

  function resetMapPosition() {
    setIsFollowing(false);

    zoom.value = withSpring(INITIAL_ZOOM, MAP_SPRING);
    savedZoom.value = INITIAL_ZOOM;

    translateX.value = withSpring(0, MAP_SPRING);
    translateY.value = withSpring(0, MAP_SPRING);
  }

  // --------------------------------------------------
  // ZOOM IN / ZOOM OUT BUTTONS
  // --------------------------------------------------

  function adjustZoom(direction: "in" | "out") {
    const nextZoom = Math.min(
      4,
      Math.max(
        1,
        zoom.value + (direction === "in" ? 0.25 : -0.25),
      ),
    );

    zoom.value = withTiming(nextZoom, {
      duration: 250,
    });

    savedZoom.value = nextZoom;

    translateX.value = withTiming(
      clampTranslation(
        translateX.value,
        renderedWidth,
        mapSize.width,
        nextZoom,
      ),
      { duration: 250 },
    );

    translateY.value = withTiming(
      clampTranslation(
        translateY.value,
        renderedHeight,
        mapSize.height,
        nextZoom,
      ),
      { duration: 250 },
    );

    setIsFollowing(false);
  }

  // --------------------------------------------------
  // ROUTE DISPLAY
  // --------------------------------------------------

  const routeDisplayPoints: ImagePoint[] = routeCoordinates.map(
    ([longitude, latitude]) =>
      gpsToImage(latitude, longitude),
  );

  const hasOfflineWalkingRoute =
    isOfflineRoute && routeCoordinates.length >= 2;

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

    const angle =
      (Math.atan2(dy, dx) * 180) / Math.PI;

    const middleX =
      ((pointA.x + pointB.x) / 2) * scale;

    const middleY =
      ((pointA.y + pointB.y) / 2) * scale;

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

              return renderRouteSegment(
                point,
                nextPoint,
                `route-${index}`,
              );
            })}

            {/* BUILDING MARKERS */}
            {visibleLocations.map((location) => {
              const pixel = gpsToImage(
                location.latitude,
                location.longitude,
              );

              if (
                pixel.x < 0 ||
                pixel.x > MAP_IMAGE.width ||
                pixel.y < 0 ||
                pixel.y > MAP_IMAGE.height
              ) {
                return null;
              }

              const isDestination =
                isTracking &&
                selectedLocation?.id === location.id;

              const isFocused =
                focusedLocationId === location.id;

              return (
                <Pressable
                  key={location.id}
                  style={[
                    styles.buildingMarker,
                    isDestination && styles.destinationMarker,
                    isFocused && styles.focusedBuildingMarker,
                    {
                      left: pixel.x * scale - 15,
                      top: pixel.y * scale - 15,
                    },
                  ]}
                  onPress={() => selectMapMarker(location)}
                >
                  <Animated.Text
                    style={[
                      styles.buildingMarkerText,
                      isDestination && styles.destinationMarkerText,
                      isFocused && styles.focusedBuildingMarkerText,
                      isFocused && focusedMarkerAnimatedStyle,
                    ]}
                  >
                    {location.id}
                  </Animated.Text>
                </Pressable>
              );
            })}

            {/* GPS MARKER */}
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

      {/* SEARCH BAR WITH BURGER MENU */}
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
              setShowSearchResults(
                searchQuery.trim().length > 0,
              );
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
              setShowCategoryFilters((current) => !current);
              setShowSearchResults(false);
            }}
            accessibilityRole="button"
            accessibilityLabel="Toggle category filters"
          >
            <Text style={styles.menuButtonText}>
              {showCategoryFilters ? "✕" : "☰"}
            </Text>
          </Pressable>
        </View>

        {/* SEARCH RESULTS */}
        {showSearchResults &&
          searchQuery.trim().length > 0 && (
            <View style={styles.searchResults}>
              <ScrollView keyboardShouldPersistTaps="handled">
                {searchResults.length > 0 ? (
                  searchResults.map((location) => (
                    <Pressable
                      key={location.id}
                      style={styles.searchResultItem}
                      onPress={() => selectSearchedLocation(location)}
                    >
                      <View style={styles.resultNumber}>
                        <Text style={styles.resultNumberText}>
                          {location.id}
                        </Text>
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={styles.resultBuilding}>
                          {location.building}
                        </Text>

                        <Text style={styles.resultName}>
                          {location.name}
                        </Text>
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

      {/* CATEGORY FILTERS */}
      {showCategoryFilters && (
        <View style={styles.categoryContainer}>
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
        </View>
      )}

      <Text pointerEvents="none" style={styles.mapAttribution}>
        © OpenStreetMap contributors
      </Text>

      {/* MY LOCATION / FOLLOW */}
      <Pressable
        style={[
          styles.followButton,
          selectedLocation && styles.followButtonAboveCard,
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
          selectedLocation && styles.resetButtonAboveCard,
        ]}
        onPress={resetMapPosition}
      >
        <Text style={styles.resetButtonText}>⟲</Text>
      </Pressable>

      {/* ZOOM IN / ZOOM OUT */}
      <View
        style={[
          styles.zoomControls,
          selectedLocation && styles.zoomControlsAboveCard,
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

      {/* SELECTED BUILDING BOTTOM SHEET COMPONENT */}
      {selectedLocation && (
        <LocationBottomSheet
          selectedLocation={selectedLocation}
          selectedInfoTab={selectedInfoTab}
          routeInfo={routeInfo}
          isOfflineRoute={isOfflineRoute}
          isTracking={isTracking}
          isLoadingRoute={isLoadingRoute}
          isRerouting={isRerouting}
          sheetExpanded={sheetExpanded}
          animatedSheetStyle={animatedSheetStyle}
          sheetDragGesture={sheetDragGesture}
          onClose={() => {
            setSelectedLocation(null);
            setSelectedInfoTab("Overview");
            setSheetExpanded(false);
            setFocusedLocationId(null);
            resetMapPosition();
          }}
          onToggleSheet={toggleSheet}
          onStartTracking={startTracking}
          onStartOrFollow={() => {
            if (isTracking) {
              followMyLocation();
            } else {
              startTracking();
            }
          }}
          onMore={() => {
            setSelectedInfoTab("Details");
            expandSheet();
          }}
          onTabChange={setSelectedInfoTab}
          onStopTracking={stopTracking}
        />
      )}

      {/* NEW ANIMATED LOADING SCREEN */}
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
// LOADING SCREEN STYLES
// --------------------------------------------------

const loadingStyles = StyleSheet.create({
  screen: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#1D1D1D",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    elevation: 9999,
    overflow: "hidden",
  },

  glow: {
    position: "absolute",
    width: 420,
    height: 420,
    borderRadius: 210,
    backgroundColor: "rgba(255, 201, 0, 0.06)",
    transform: [{ translateY: -90 }],
  },

  content: {
    width: "100%",
    alignItems: "center",
    paddingHorizontal: 50,
  },

  logoWrapper: {
    width: 200,
    height: 200,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 30,
  },

  ring: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
    borderColor: "#FFC900",
  },

  logo: {
    width: 170,
    height: 170,
  },

  title: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: 6,
  },

  tagline: {
    color: "#FFC900",
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 1.2,
    marginTop: 8,
  },

  progressArea: {
    width: "70%",
    alignItems: "center",
    marginTop: 50,
  },

  progressTrack: {
    width: "100%",
    height: 5,
    borderRadius: 5,
    backgroundColor: "#343434",
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    borderRadius: 5,
    backgroundColor: "#FFC900",
  },

  statusText: {
    color: "#A6A6A6",
    fontSize: 12,
    marginTop: 12,
  },
});

// --------------------------------------------------
// MAIN MAP STYLES
// --------------------------------------------------

const styles = StyleSheet.create({
  // BURGER MENU
  menuButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
    backgroundColor: "transparent",
  },

  menuButtonText: {
    color: "#FFC900",
    fontSize: 22,
    fontWeight: "800",
  },

  // CATEGORY FILTERS
  categoryContainer: {
    position: "absolute",
    top: 105,
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

  // MAIN CONTAINER
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

  // WALKING ROUTE
  routeSegment: {
    position: "absolute",
    height: 6,
    borderRadius: 6,
    backgroundColor: "#FFC900",
    zIndex: 4,
    elevation: 4,
  },

  // BUILDING MARKERS
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

  destinationMarker: {
    backgroundColor: "#FFC900",
    borderColor: "#F2F2F2",
    borderWidth: 3,
    width: 36,
    height: 36,
    borderRadius: 20,
  },

  // SEARCHED BUILDING HIGHLIGHT
  focusedBuildingMarker: {
    backgroundColor: "#FFC900",
    borderColor: "#FFFFFF",
    borderWidth: 3,
    elevation: 12,
    zIndex: 20,
  },

  buildingMarkerText: {
    color: "#FFC900",
    fontSize: 12,
    fontWeight: "bold",
  },

  destinationMarkerText: {
    color: "#111111",
  },

  focusedBuildingMarkerText: {
    color: "#150E3C",
    fontWeight: "900",
  },

  // GPS MARKER
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

  // SEARCH
  searchContainer: {
    position: "absolute",
    top: 45,
    left: 15,
    right: 15,
    zIndex: 10,
  },

  searchBar: {
    height: 52,
    backgroundColor: "rgba(29, 29, 29, 0.97)",
    borderWidth: 1,
    borderColor: "#555555",
    borderRadius: 17,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    elevation: 6,
  },

  searchIcon: {
    fontSize: 28,
    color: "#FFC900",
    marginRight: 10,
    marginLeft: 8,
    marginTop: -7,
  },

  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#F2F2F2",
    height: "100%",
    minWidth: 0,
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

  // MAP ATTRIBUTION
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

  // FOLLOW BUTTON
  followButton: {
    position: "absolute",
    right: 350,
    bottom: 92,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#1D1D1D",
    alignItems: "center",
    justifyContent: "center",
    elevation: 7,
    borderWidth: 1,
    borderColor: "#4A4A4A",
  },

  followButtonAboveCard: {
    bottom: 350,
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

  // RESET BUTTON
  resetButton: {
    position: "absolute",
    right: 350,
    bottom: 30,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#1D1D1D",
    alignItems: "center",
    justifyContent: "center",
    elevation: 7,
  },

  resetButtonAboveCard: {
    bottom: 292,
  },

  resetButtonText: {
    fontSize: 30,
    color: "#FFC900",
  },

  // ZOOM CONTROLS
  zoomControls: {
    position: "absolute",
    right: 18,
    bottom: 345,
    alignItems: "center",
    gap: 8,
    zIndex: 10,
  },

  zoomControlsAboveCard: {
    bottom: 410,
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
});