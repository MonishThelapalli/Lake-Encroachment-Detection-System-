export const mockAnalysis = {
  t1: {
    classified_geojson: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { class: "Water" },
          geometry: {
            type: "Polygon",
            coordinates: [[[78.48, 17.38], [78.49, 17.38], [78.49, 17.39], [78.48, 17.39], [78.48, 17.38]]]
          }
        }
      ]
    },
    area_stats: {
      water: 120000,
      builtup: 40000,
      vegetation: 90000,
      baresoil: 30000
    }
  },
  t2: {
    classified_geojson: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { class: "Water" },
          geometry: {
            type: "Polygon",
            coordinates: [[[78.48, 17.38], [78.485, 17.38], [78.485, 17.385], [78.48, 17.385], [78.48, 17.38]]]
          }
        }
      ]
    },
    area_stats: {
      water: 90000,
      builtup: 70000,
      vegetation: 80000,
      baresoil: 20000
    }
  },
  encroachment: {
    geojson: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { class: "Encroachment" },
          geometry: {
            type: "Polygon",
            coordinates: [[[78.485, 17.385], [78.49, 17.385], [78.49, 17.39], [78.485, 17.39], [78.485, 17.385]]]
          }
        }
      ]
    },
    total_area_lost: 30000,
    confidence_mean: 0.82
  }
};
