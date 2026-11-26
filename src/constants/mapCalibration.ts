import { CAMPUS_BOUNDARY } from "./campusBoundary";

// The campus map image is a north-up OSM-derived plan. These image bounds
// align the geographic campus boundary with its outline in the source image.
export const MAP_IMAGE = {
  width: 6444,
  height: 6140,
  source: require("../../assets/maps/School_Campus_map.png"),
};

const GEO_BOUNDS = {
  south: Math.min(...CAMPUS_BOUNDARY.map(({ latitude }) => latitude)),
  west: Math.min(...CAMPUS_BOUNDARY.map(({ longitude }) => longitude)),
  north: Math.max(...CAMPUS_BOUNDARY.map(({ latitude }) => latitude)),
  east: Math.max(...CAMPUS_BOUNDARY.map(({ longitude }) => longitude)),
};

// Pixel bounds are calibrated to the OSM junction at the shared GPS reference
// point (8.486279, 124.656212), which appears just above-left of the prior fit.
const IMAGE_BOUNDS = {
  left: 327,
  top: 306,
  right: 6399,
  bottom: 5654,
};

function mercatorY(latitude: number) {
  const radians = (latitude * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + radians / 2));
}

const northingTop = mercatorY(GEO_BOUNDS.north);
const northingBottom = mercatorY(GEO_BOUNDS.south);

export function gpsToImage(latitude: number, longitude: number) {
  const xRatio =
    (longitude - GEO_BOUNDS.west) / (GEO_BOUNDS.east - GEO_BOUNDS.west);
  const yRatio =
    (northingTop - mercatorY(latitude)) / (northingTop - northingBottom);

  return {
    x: IMAGE_BOUNDS.left + xRatio * (IMAGE_BOUNDS.right - IMAGE_BOUNDS.left),
    y: IMAGE_BOUNDS.top + yRatio * (IMAGE_BOUNDS.bottom - IMAGE_BOUNDS.top),
  };
}
