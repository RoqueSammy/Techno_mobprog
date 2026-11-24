export const MAP_IMAGE = {
  width: 2048,
  height: 1627,
  source: require("../../assets/maps/ustp_map_clean.jpg"),
};

export const MAP_REFERENCE_POINTS = [
  {
    id: "P1",
    x: 1412.1834,
    y: 704.1827,
    latitude: 8.486292,
    longitude: 124.657246,
  },
  {
    id: "P2",
    x: 931.3782,
    y: 862.1102,
    latitude: 8.485971,
    longitude: 124.656163,
  },
  {
    id: "P3",
    x: 707.2193,
    y: 874.1416,
    latitude: 8.485931,
    longitude: 124.655656,
  },
  {
    id: "P4",
    x: 550.8721,
    y: 523.6279,
    latitude: 8.486796,
    longitude: 124.655297,
  },
  {
    id: "P5",
    x: 944.3752,
    y: 1163.1583,
    latitude: 8.485318,
    longitude: 124.656294,
  },
  {
    id: "P6",
    x: 1079.8102,
    y: 1330.5072,
    latitude: 8.484817848015897,
    longitude: 124.65651382893256,
  },
  {
    id: "P7",
    x: 1176.6091,
    y: 1170.1529,
    latitude: 8.485199,
    longitude: 124.656788,
  },
  {
    id: "P8",
    x: 1330.975,
    y: 1333.3213,
    latitude: 8.484796,
    longitude: 124.657077,
  },
  {
    id: "P9",
    x: 1104.9319,
    y: 658.8103,
    latitude: 8.48651,
    longitude: 124.656565,
  },
];

// Affine GPS-to-image fit from the nine campus reference points above.
// East/north offsets are in metres around the center of the campus controls.
export function gpsToImage(latitude: number, longitude: number) {
  const referenceLatitude = 8.486;
  const referenceLongitude = 124.656;
  const metersPerDegree = 111_000;
  const east =
    (longitude - referenceLongitude) *
    metersPerDegree *
    Math.cos((referenceLatitude * Math.PI) / 180);
  const north = (latitude - referenceLatitude) * metersPerDegree;

  const base = {
    x:
      3.9564810044870375 * east +
      0.07071249014218317 * north +
      857.0438839691362,
    y:
      -0.16621371920871297 * east -
      3.798869072500816 * north +
      861.239788287443,
  };

  // Blend measured control-point residuals to compensate for distortions
  // in the campus illustration.
  let totalWeight = 0;
  let correctionX = 0;
  let correctionY = 0;

  for (const reference of MAP_REFERENCE_POINTS) {
    const referenceEast =
      (reference.longitude - referenceLongitude) *
      metersPerDegree *
      Math.cos((referenceLatitude * Math.PI) / 180);
    const referenceNorth =
      (reference.latitude - referenceLatitude) * metersPerDegree;
    const distanceSquared =
      (east - referenceEast) ** 2 + (north - referenceNorth) ** 2;

    if (distanceSquared < 0.0001) {
      return { x: reference.x, y: reference.y };
    }

    const weight = 1 / distanceSquared;
    totalWeight += weight;
    correctionX +=
      (reference.x -
        (3.9564810044870375 * referenceEast +
          0.07071249014218317 * referenceNorth +
          857.0438839691362)) *
      weight;
    correctionY +=
      (reference.y -
        (-0.16621371920871297 * referenceEast -
          3.798869072500816 * referenceNorth +
          861.239788287443)) *
      weight;
  }

  return {
    x: base.x + correctionX / totalWeight,
    y: base.y + correctionY / totalWeight,
  };
}
