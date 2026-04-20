// Shared geometry utilities for field mapping and area calculations

// Haversine distance in meters between two [lat,lon] pairs
export const haversineDist = ([lat1, lon1], [lat2, lon2]) => {
  const R = 6371000;
  const toRad = (d) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Shoelace formula for polygon area in sq meters from [lat,lon] points
export const polygonAreaSqM = (pts) => {
  if (pts.length < 3) return 0;
  // Project to approximate meters using center latitude
  const avgLat = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const mPerDegLat = 111320;
  const mPerDegLon = 111320 * Math.cos(avgLat * Math.PI / 180);
  const projected = pts.map(([lat, lon]) => [(lon - pts[0][1]) * mPerDegLon, (lat - pts[0][0]) * mPerDegLat]);
  let area = 0;
  for (let i = 0; i < projected.length; i++) {
    const j = (i + 1) % projected.length;
    area += projected[i][0] * projected[j][1];
    area -= projected[j][0] * projected[i][1];
  }
  return Math.abs(area) / 2;
};
