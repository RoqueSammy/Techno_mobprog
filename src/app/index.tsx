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
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";

import { CAMPUS_BOUNDARY } from "../constants/campusBoundary";
import { IMPORTANT_LOCATIONS } from "../constants/importantLocations";
import { MAP_IMAGE, gpsToImage } from "../constants/mapCalibration";
import { getOfflineWalkingRoute } from "../services/offlineRouting";
import { getWalkingRoute } from "../services/ors";

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

const MIN_REROUTE_DISTANCE_METERS = 15;
const MIN_REROUTE_INTERVAL_MS = 8_000;

// --------------------------------------------------
// SEARCH ALIASES
// --------------------------------------------------

const SEARCH_ALIASES: Record<number, string[]> = {
  1: ["IT", "CITC", "Information Technology", "Building 9"],
  2: ["Nursing", "Building 28"],
  3: ["Clinic", "Health Center", "Medical"],
  4: ["Technology", "College of Technology"],
  5: ["Big Foot"],
  6: ["Gate", "Entrance", "Starting Point"],
  7: ["Cafeteria", "Food", "Canteen"],
  8: ["CEA", "Engineering", "Architecture"],
  9: ["Movable Classroom", "Classroom"],
  10: ["LRC", "Learning Resource Center", "Resource Center"],
  11: ["SHS", "Senior High", "Senior High School"],
  12: ["Building 41", "Science", "Science Complex"],
  13: ["NSTP", "National Service Training Program"],
  14: ["Culinary", "Culinary Building"],
  15: ["Medicine", "College of Medicine"],
  16: ["Lounge", "Student Lounge"],
  17: ["DRER", "Gym", "Gymnasium", "DRER Memorial Hall"],
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

// --------------------------------------------------
// MAIN SCREEN
// --------------------------------------------------

export default function HomeScreen() {
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

  // DESTINATION
  const [selectedLocation, setSelectedLocation] =
    useState<CampusLocation | null>(null);

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

  const animatedMapStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: zoom.value },
    ],
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

        const destinationPoint: GPSPoint = {
          latitude: requestDestination.latitude,
          longitude: requestDestination.longitude,
        };
        const offlineFallbackRoute = getOfflineWalkingRoute(
          requestOrigin,
          destinationPoint,
        );

        // Show the saved campus route immediately. If the online route succeeds,
        // it replaces this path; if the device is offline, this path remains.
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
            const lastCoordinate = coordinates[coordinates.length - 1];
            const snappedDestination: GPSPoint = {
              latitude: lastCoordinate[1],
              longitude: lastCoordinate[0],
            };
            const startConnector = calculateDistance(requestOrigin, snappedStart);
            const destinationConnector = calculateDistance(snappedDestination, {
              latitude: requestDestination.latitude,
              longitude: requestDestination.longitude,
            });
            // Only draw short connectors between the user/building marker and
            // the routed walkway. Longer straight connectors can cut across
            // buildings or courtyards and look like part of the walking path.
            const includeStart = startConnector <= 12;
            const includeDestination = destinationConnector <= 12;
            const connectorDistance =
              (includeStart ? startConnector : 0) +
              (includeDestination ? destinationConnector : 0);
            const displayedCoordinates = [
              ...(includeStart
                ? [[requestOrigin.longitude, requestOrigin.latitude] as [number, number]]
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
            } else {
              // Never draw a straight line as if it were a walking path.
              const distance = calculateDistance(
                requestOrigin,
                destinationPoint,
              );
              setRouteCoordinates([]);
              setRouteInfo({ distance, duration: distance / 1.2 });
            }

            setIsOfflineRoute(true);
            state.lastOrigin = requestOrigin;
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

    async function startGPS() {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();

        if (!active) return;

        if (permission.status !== "granted") {
          setLocationMessage("Location permission is required.");
          return;
        }

        const servicesEnabled = await Location.hasServicesEnabledAsync();

        if (!active) return;

        if (!servicesEnabled) {
          setLocationMessage(
            "Turn on Location in your phone settings to use GPS.",
          );
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

        const initialLocation = await Location.getCurrentPositionAsync({
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

        if (active) {
          setLocationMessage(
            "GPS could not get a current fix. Turn on Location and try outdoors.",
          );
        }
      }
    }

    function updateGPSPosition(location: Location.LocationObject) {
      const coords = location.coords;

      setUserLocation(coords);

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

  // --------------------------------------------------
  // SELECT DESTINATION
  // --------------------------------------------------

  function selectLocation(location: CampusLocation) {
    const isSameDestination =
      selectedDestinationRef.current?.id === location.id;

    setSelectedLocation(location);
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

    // These imperative updates reset the Reanimated map gesture state.
    // eslint-disable-next-line react-hooks/immutability
    zoom.value = INITIAL_ZOOM;
    savedZoom.value = INITIAL_ZOOM;

    // eslint-disable-next-line react-hooks/immutability
    translateX.value = 0;
    // eslint-disable-next-line react-hooks/immutability
    translateY.value = 0;
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
  const hasOfflineWalkingRoute = isOfflineRoute && routeCoordinates.length >= 2;

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
            {IMPORTANT_LOCATIONS.map((location) => {
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

              return (
                <Pressable
                  key={location.id}
                  style={[
                    styles.buildingMarker,
                    isDestination && styles.destinationMarker,
                    {
                      left: pixel.x * scale - 15,
                      top: pixel.y * scale - 15,
                    },
                  ]}
                  onPress={() => selectLocation(location)}
                >
                  <Text
                    style={[
                      styles.buildingMarkerText,
                      isDestination && styles.destinationMarkerText,
                    ]}
                  >
                    {location.id}
                  </Text>
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
                    onPress={() => selectLocation(location)}
                  >
                    <View style={styles.resultNumber}>
                      <Text style={styles.resultNumberText}>{location.id}</Text>
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

      {/* GPS STATUS */}
      <View
        style={[
          styles.status,
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
        style={[styles.followButton, isFollowing && styles.followButtonActive]}
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
      <Pressable style={styles.resetButton} onPress={resetMapPosition}>
        <Text style={styles.resetButtonText}>⟲</Text>
      </Pressable>

      {/* SELECTED BUILDING CARD */}
      {selectedLocation && (
        <View style={styles.locationCard}>
          <View style={styles.locationHeader}>
            {selectedLocation.image ? (
              <Image
                source={selectedLocation.image}
                style={styles.locationPhoto}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.locationPhotoPlaceholder}>
                <Text style={styles.locationPhotoPlaceholderIcon}>▧</Text>
                <Text style={styles.locationPhotoPlaceholderText}>
                  Photo slot
                </Text>
              </View>
            )}

            <View style={styles.locationTitleGroup}>
              <Text style={styles.locationBuilding}>
                {selectedLocation.building}
              </Text>

              <Text style={styles.locationName}>{selectedLocation.name}</Text>
            </View>
          </View>

          <Text style={styles.locationDescription}>
            {selectedLocation.description}
          </Text>

          {isTracking && routeInfo && (
            <Text style={styles.routeInfoText}>
              {hasOfflineWalkingRoute
                ? "Saved campus walking route"
                : isOfflineRoute
                  ? "Offline straight-line distance only"
                : "Walking route"}
              : {(routeInfo.distance / 1000).toFixed(2)} km
              {(!isOfflineRoute || hasOfflineWalkingRoute) && (
                <>
                  {" · "}
                  {isOfflineRoute ? "~" : ""}
                  {Math.max(1, Math.round(routeInfo.duration / 60))} min
                </>
              )}
            </Text>
          )}

          {isTracking && isOfflineRoute && hasOfflineWalkingRoute && (
            <Text style={styles.offlineRouteWarning}>
              This route follows saved campus paths. If a marker is away from a
              path, follow the nearest walkway to reach it.
            </Text>
          )}

          {isTracking && isOfflineRoute && !hasOfflineWalkingRoute && (
            <Text style={styles.offlineRouteWarning}>
              No saved walking path connects your location to this destination.
              This is only an approximate straight-line distance.
            </Text>
          )}

          {isRerouting && (
            <Text style={styles.reroutingText}>Updating walking route...</Text>
          )}

          {/* TRACK */}
          <Pressable
            style={[
              styles.trackButton,
              isLoadingRoute && styles.trackButtonDisabled,
            ]}
            onPress={startTracking}
            disabled={isLoadingRoute}
          >
            <Text style={styles.trackButtonText}>
              {isLoadingRoute
                ? "Finding walking route..."
                : isTracking
                  ? "Refresh Route"
                  : "Track"}
            </Text>
          </Pressable>

          {/* STOP */}
          {isTracking && (
            <Pressable style={styles.stopTrackButton} onPress={stopTracking}>
              <Text style={styles.stopTrackButtonText}>Stop Tracking</Text>
            </Pressable>
          )}

          {/* CLOSE */}
          <Pressable
            style={styles.closeButton}
            onPress={() => setSelectedLocation(null)}
          >
            <Text style={styles.closeButtonText}>Close</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// --------------------------------------------------
// STYLES
// --------------------------------------------------

const styles = StyleSheet.create({
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
    borderRadius: 6,
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
    fontSize: 25,
    color: "#FFC900",
    marginRight: 10,
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
    right: 18,
    bottom: 90,
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
    right: 18,
    bottom: 30,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#1D1D1D",
    alignItems: "center",
    justifyContent: "center",
    elevation: 7,
  },

  resetButtonText: {
    fontSize: 30,
    color: "#FFC900",
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
