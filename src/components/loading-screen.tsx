import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
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

type LoadingScreenProps = {
  mapReady: boolean;
  gpsReady: boolean;
  minTimeDone: boolean;
  duration: number;
  onFinished: () => void;
};
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
  }, [delay, progress]);

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
  }, [barIn, duration, logoFloat, logoIn, progress, taglineIn, titleIn]);

  // EXIT ANIMATION
  useEffect(() => {
    if (!isReady) return;
    // eslint-disable-next-line react-hooks/immutability
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
  }, [exitScale, isReady, onFinished, progress, screenOpacity]);

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

export default LoadingScreen;



