export function leafletToGeoJSON(layer: any): GeoJSON.Polygon {
  const latlngs = layer.getLatLngs()[0];
  const coords = latlngs.map((p: any) => [p.lng, p.lat]);

  const first = coords[0];
  const last = coords[coords.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    coords.push([...first]);
  }

  return {
    type: "Polygon",
    coordinates: [coords],
  };
}
