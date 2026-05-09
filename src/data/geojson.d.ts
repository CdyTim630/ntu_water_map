declare module '*.geojson' {
  interface GeoJsonFeature {
    type: 'Feature';
    properties: Record<string, unknown>;
    geometry:
      | { type: 'Point'; coordinates: [number, number] }
      | { type: 'LineString'; coordinates: [number, number][] };
  }
  const value: {
    type: 'FeatureCollection';
    name?: string;
    features: GeoJsonFeature[];
  };
  export default value;
}
