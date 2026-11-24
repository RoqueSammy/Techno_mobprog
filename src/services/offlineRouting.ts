import campusPathData from "../data/osmCampusPaths.json";

type GPSPoint = {
  latitude: number;
  longitude: number;
};

type OSMNode = GPSPoint & {
  id: string;
};

type OSMWay = {
  id: string;
  highway: string;
  foot: string | null;
  access: string | null;
  nodes: OSMNode[];
};

type PathEdge = {
  key: string;
  start: OSMNode;
  end: OSMNode;
};

type Snap = {
  edgeKey: string;
  t: number;
  id: string;
  point: GPSPoint;
  distance: number;
};

type GraphLink = {
  id: string;
  distance: number;
};

export type OfflineRoute = {
  coordinates: [number, number][];
  distance: number;
  startSnapDistance: number;
  destinationSnapDistance: number;
};

const MAX_SNAP_DISTANCE_METERS = 45;
// Surveyed entrances may sit a short distance off the mapped path centerline.
const SHOW_CONNECTOR_DISTANCE_METERS = 15;
const METERS_PER_DEGREE = 111_000;
const REFERENCE_LATITUDE = 8.486;
const COS_REFERENCE_LATITUDE = Math.cos(
  (REFERENCE_LATITUDE * Math.PI) / 180,
);
const CAMPUS_WAYS = campusPathData.ways as OSMWay[];
const NODES = new Map<string, OSMNode>();
const EDGES = new Map<string, PathEdge>();
const CONFIRMED_JUNCTIONS: GPSPoint[] = [
  { latitude: 8.485406, longitude: 124.656541 },
  { latitude: 8.485594, longitude: 124.657005 },
  { latitude: 8.485645, longitude: 124.657107 },
  { latitude: 8.485833, longitude: 124.657102 },
  { latitude: 8.485862, longitude: 124.657461 },
  { latitude: 8.486215, longitude: 124.657061 },
  { latitude: 8.485921, longitude: 124.65803 },
  { latitude: 8.486549, longitude: 124.656962 },
  { latitude: 8.486549, longitude: 124.656898 },
  { latitude: 8.48626, longitude: 124.656214 },
  { latitude: 8.486547, longitude: 124.656093 },
  { latitude: 8.486085, longitude: 124.655688 },
  { latitude: 8.485974, longitude: 124.655396 },
  { latitude: 8.486743, longitude: 124.65505 },
  { latitude: 8.485883, longitude: 124.656359 },
  // Field-surveyed path starts and crossings that closely match the OSM paths.
  { latitude: 8.4847464, longitude: 124.6565524 },
  { latitude: 8.485201, longitude: 124.656588 },
  { latitude: 8.4853575, longitude: 124.6565598 },
  { latitude: 8.4856908, longitude: 124.6571456 },
  { latitude: 8.4858407, longitude: 124.6570842 },
  { latitude: 8.4858785, longitude: 124.6574523 },
  { latitude: 8.4859793, longitude: 124.6580069 },
  { latitude: 8.4861279, longitude: 124.6580012 },
  { latitude: 8.4862777, longitude: 124.6570564 },
  { latitude: 8.4862834, longitude: 124.6562074 },
  { latitude: 8.4860556, longitude: 124.6555889 },
  { latitude: 8.4860881, longitude: 124.6556529 },
];
const JUNCTION_SNAP_DISTANCE_METERS = 4;

for (const way of CAMPUS_WAYS) {
  if (way.foot === "no" || way.access === "no") continue;

  for (let index = 0; index < way.nodes.length - 1; index += 1) {
    const start = way.nodes[index];
    const end = way.nodes[index + 1];

    if (start.id === end.id) continue;

    NODES.set(start.id, start);
    NODES.set(end.id, end);

    const key = edgeKey(start.id, end.id);

    if (!EDGES.has(key)) {
      EDGES.set(key, { key, start, end });
    }
  }
}

function edgeKey(a: string, b: string) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function toLocalMeters(point: GPSPoint) {
  return {
    x:
      (point.longitude - 124.656) *
      METERS_PER_DEGREE *
      COS_REFERENCE_LATITUDE,
    y: (point.latitude - REFERENCE_LATITUDE) * METERS_PER_DEGREE,
  };
}

function distanceMeters(a: GPSPoint, b: GPSPoint) {
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const deltaLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const deltaLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;

  return 6_371_000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function snapToEdge(point: GPSPoint, virtualId: string, edge: PathEdge): Snap {
  const localPoint = toLocalMeters(point);
  const startLocal = toLocalMeters(edge.start);
  const endLocal = toLocalMeters(edge.end);
  const dx = endLocal.x - startLocal.x;
  const dy = endLocal.y - startLocal.y;
  const lengthSquared = dx * dx + dy * dy;
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            ((localPoint.x - startLocal.x) * dx +
              (localPoint.y - startLocal.y) * dy) /
              lengthSquared,
          ),
        );
  const snappedPoint = {
    latitude: edge.start.latitude + t * (edge.end.latitude - edge.start.latitude),
    longitude: edge.start.longitude + t * (edge.end.longitude - edge.start.longitude),
  };
  const id =
    t < 0.000001
      ? edge.start.id
      : t > 0.999999
        ? edge.end.id
        : virtualId;

  return {
    edgeKey: edge.key,
    t,
    id,
    point: snappedPoint,
    distance: distanceMeters(point, snappedPoint),
  };
}

function snapToNearestPath(point: GPSPoint, virtualId: string): Snap | null {
  let bestSnap: Snap | null = null;

  for (const edge of EDGES.values()) {
    const snap = snapToEdge(point, virtualId, edge);
    if (!bestSnap || snap.distance < bestSnap.distance) bestSnap = snap;
  }

  if (!bestSnap || bestSnap.distance > MAX_SNAP_DISTANCE_METERS) return null;

  return bestSnap;
}

function addLink(
  graph: Map<string, GraphLink[]>,
  a: string,
  b: string,
  distance: number,
) {
  if (a === b) return;

  const linksA = graph.get(a) ?? [];
  const linksB = graph.get(b) ?? [];

  linksA.push({ id: b, distance });
  linksB.push({ id: a, distance });
  graph.set(a, linksA);
  graph.set(b, linksB);
}

function shortestPath(
  graph: Map<string, GraphLink[]>,
  startId: string,
  destinationId: string,
) {
  const distances = new Map<string, number>([[startId, 0]]);
  const previous = new Map<string, string>();
  const unvisited = new Set(graph.keys());

  while (unvisited.size > 0) {
    let currentId: string | null = null;
    let currentDistance = Number.POSITIVE_INFINITY;

    for (const candidate of unvisited) {
      const candidateDistance = distances.get(candidate) ?? Number.POSITIVE_INFINITY;

      if (candidateDistance < currentDistance) {
        currentId = candidate;
        currentDistance = candidateDistance;
      }
    }

    if (currentId === null || !Number.isFinite(currentDistance)) return null;
    if (currentId === destinationId) break;

    unvisited.delete(currentId);

    for (const link of graph.get(currentId) ?? []) {
      if (!unvisited.has(link.id)) continue;

      const nextDistance = currentDistance + link.distance;

      if (nextDistance < (distances.get(link.id) ?? Number.POSITIVE_INFINITY)) {
        distances.set(link.id, nextDistance);
        previous.set(link.id, currentId);
      }
    }
  }

  if (!distances.has(destinationId)) return null;

  const path = [destinationId];
  let currentId = destinationId;

  while (currentId !== startId) {
    const previousId = previous.get(currentId);
    if (!previousId) return null;
    path.unshift(previousId);
    currentId = previousId;
  }

  return { nodeIds: path, distance: distances.get(destinationId) ?? 0 };
}

export function getOfflineWalkingRoute(
  start: GPSPoint,
  destination: GPSPoint,
): OfflineRoute | null {
  const startSnap = snapToNearestPath(start, "@route-start");
  const destinationSnap = snapToNearestPath(destination, "@route-destination");

  if (!startSnap || !destinationSnap) return null;

  if (
    startSnap.edgeKey === destinationSnap.edgeKey &&
    Math.abs(startSnap.t - destinationSnap.t) < 0.000001
  ) {
    destinationSnap.id = startSnap.id;
  }

  const graph = new Map<string, GraphLink[]>();
  const routeNodes = new Map(NODES);
  const junctionLinks: {
    junctionId: string;
    pathNodeId: string;
    distance: number;
  }[] = [];
  const junctionSplits = new Map<string, Snap[]>();

  if (startSnap.id.startsWith("@")) {
    routeNodes.set(startSnap.id, {
      id: startSnap.id,
      ...startSnap.point,
    });
  }

  if (destinationSnap.id.startsWith("@")) {
    routeNodes.set(destinationSnap.id, {
      id: destinationSnap.id,
      ...destinationSnap.point,
    });
  }

  CONFIRMED_JUNCTIONS.forEach((junction, index) => {
    const junctionId = `@junction-${index}`;
    routeNodes.set(junctionId, { id: junctionId, ...junction });

    for (const edge of EDGES.values()) {
      const snap = snapToEdge(
        junction,
        `${junctionId}-${edge.key}`,
        edge,
      );

      if (snap.distance > JUNCTION_SNAP_DISTANCE_METERS) continue;

      if (snap.id.startsWith("@")) {
        routeNodes.set(snap.id, { id: snap.id, ...snap.point });
        const splits = junctionSplits.get(edge.key) ?? [];
        splits.push(snap);
        junctionSplits.set(edge.key, splits);
      }

      junctionLinks.push({
        junctionId,
        pathNodeId: snap.id,
        distance: snap.distance,
      });
    }
  });

  for (const edge of EDGES.values()) {
    const splitPoints = [
      { t: 0, node: edge.start },
      { t: 1, node: edge.end },
    ];

    if (startSnap.edgeKey === edge.key && startSnap.id.startsWith("@")) {
      splitPoints.push({
        t: startSnap.t,
        node: routeNodes.get(startSnap.id) as OSMNode,
      });
    }

    if (
      destinationSnap.edgeKey === edge.key &&
      destinationSnap.id.startsWith("@")
    ) {
      splitPoints.push({
        t: destinationSnap.t,
        node: routeNodes.get(destinationSnap.id) as OSMNode,
      });
    }

    splitPoints.push(
      ...(junctionSplits.get(edge.key) ?? []).map((snap) => ({
        t: snap.t,
        node: routeNodes.get(snap.id) as OSMNode,
      })),
    );

    splitPoints.sort((a, b) => a.t - b.t);

    for (let index = 0; index < splitPoints.length - 1; index += 1) {
      const pointA = splitPoints[index].node;
      const pointB = splitPoints[index + 1].node;

      addLink(graph, pointA.id, pointB.id, distanceMeters(pointA, pointB));
    }
  }

  for (const link of junctionLinks) {
    addLink(graph, link.junctionId, link.pathNodeId, link.distance);
  }

  const result = shortestPath(graph, startSnap.id, destinationSnap.id);
  if (!result) return null;

  const coordinates = result.nodeIds
    .map((id) => routeNodes.get(id))
    .filter((node): node is OSMNode => node !== undefined)
    .map((node) => [node.longitude, node.latitude] as [number, number]);

  if (startSnap.distance <= SHOW_CONNECTOR_DISTANCE_METERS) {
    coordinates.unshift([start.longitude, start.latitude]);
  }

  if (destinationSnap.distance <= SHOW_CONNECTOR_DISTANCE_METERS) {
    coordinates.push([destination.longitude, destination.latitude]);
  }

  const connectorDistance =
    (startSnap.distance <= SHOW_CONNECTOR_DISTANCE_METERS
      ? startSnap.distance
      : 0) +
    (destinationSnap.distance <= SHOW_CONNECTOR_DISTANCE_METERS
      ? destinationSnap.distance
      : 0);

  return {
    coordinates,
    distance: result.distance + connectorDistance,
    startSnapDistance: startSnap.distance,
    destinationSnapDistance: destinationSnap.distance,
  };
}
