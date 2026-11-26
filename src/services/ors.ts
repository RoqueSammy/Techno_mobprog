const ORS_API_KEY = process.env.EXPO_PUBLIC_ORS_API_KEY;
const ORS_URL =
  "https://api.heigit.org/openrouteservice/v2/directions/foot-walking/geojson";

export async function getWalkingRoute(
  coordinates: [number, number][],
) {
  if (!ORS_API_KEY) {
    throw new Error(
      "ORS API key is missing. Check your .env file and restart Expo.",
    );
  }

  if (coordinates.length < 2) {
    throw new Error("A walking route needs a start and destination.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  let response: Response;
  try {
    response = await fetch(ORS_URL, {
      method: "POST",
      headers: {
        Authorization: ORS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ coordinates }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error?.message ||
        data.message ||
        `ORS request failed with status ${response.status}`,
    );
  }

  if (!data.features?.[0]?.geometry) {
    throw new Error("ORS did not return a valid walking route.");
  }

  return data;
}
