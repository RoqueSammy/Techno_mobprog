type GPSPoint = {
  latitude: number;
  longitude: number;
};

export type OfflineRoute = {
  coordinates: [number, number][];
  distance: number;
  startSnapDistance: number;
  destinationSnapDistance: number;
};

// Reset requested: no old surveyed walkway coordinates are retained.
export function getOfflineWalkingRoute(
  _start: GPSPoint,
  _destination: GPSPoint,
  _destinationIsConfirmedEntrance = false,
): OfflineRoute | null {
  return null;
}
