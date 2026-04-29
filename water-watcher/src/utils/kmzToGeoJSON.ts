import JSZip from 'jszip';
import * as toGeoJSON from '@tmcw/togeojson';

/**
 * Parse KMZ file and convert to GeoJSON
 * @param kmzPath - Path to KMZ file (relative to public directory)
 * @returns Promise<GeoJSON.Geometry> - Polygon geometry
 */
export async function parseKMZ(kmzPath: string): Promise<GeoJSON.Geometry> {
  try {
    // Fetch KMZ file
    const response = await fetch(kmzPath);
    if (!response.ok) {
      throw new Error(`Failed to fetch KMZ: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    
    // Unzip KMZ using JSZip
    const zip = await JSZip.loadAsync(arrayBuffer);
    
    // Find KML file (look for .kml extension)
    let kmlContent: string | null = null;
    let kmlFileName = '';
    
    for (const [filename, file] of Object.entries(zip.files)) {
      if (filename.toLowerCase().endsWith('.kml') && !filename.includes('__MACOSX')) {
        kmlContent = await file.async('string');
        kmlFileName = filename;
        break;
      }
    }
    
    if (!kmlContent) {
      throw new Error('No KML file found in KMZ archive');
    }
    
    // Parse KML to DOM
    const parser = new DOMParser();
    const kmlDom = parser.parseFromString(kmlContent, 'text/xml');
    
    // Convert to GeoJSON
    const geoJSON = toGeoJSON.kml(kmlDom);
    
    // Extract polygon geometry from the first feature
    if (geoJSON.type === 'FeatureCollection' && geoJSON.features.length > 0) {
      const firstFeature = geoJSON.features[0];
      if (firstFeature.geometry) {
        return firstFeature.geometry;
      }
    }
    
    throw new Error('No valid polygon geometry found in KML');
    
  } catch (error) {
    console.error('Error parsing KMZ:', error);
    throw error;
  }
}

/**
 * Get bounds from GeoJSON geometry
 * @param geometry - GeoJSON geometry
 * @returns Array of [[minLat, minLng], [maxLat, maxLng]]
 */
export function getBoundsFromGeometry(geometry: GeoJSON.Geometry): [[number, number], [number, number]] {
  const coords: number[][] = [];
  
  function extractCoordinates(geom: any): void {
    if (geom.type === 'Polygon') {
      coords.push(...geom.coordinates.flat());
    } else if (geom.type === 'MultiPolygon') {
      coords.push(...geom.coordinates.flat().flat());
    } else if (geom.type === 'GeometryCollection') {
      geom.geometries.forEach(extractCoordinates);
    }
  }
  
  extractCoordinates(geometry);
  
  if (coords.length === 0) {
    throw new Error('No coordinates found in geometry');
  }
  
  // Find bounds [lat, lng]
  const lats = coords.map(coord => coord[1]);
  const lngs = coords.map(coord => coord[0]);
  
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  
  return [[minLat, minLng], [maxLat, maxLng]];
}

/**
 * Generate placeholder water polygon within bounds
 * @param bounds - [[minLat, minLng], [maxLat, maxLng]]
 * @param coverage - Percentage of area to cover (0-1)
 * @returns GeoJSON.FeatureCollection
 */
export function generateWaterPolygon(
  bounds: [[number, number], [number, number]], 
  coverage: number
): GeoJSON.FeatureCollection {
  const [[minLat, minLng], [maxLat, maxLng]] = bounds;
  
  // Calculate polygon dimensions based on coverage
  const latRange = (maxLat - minLat) * coverage;
  const lngRange = (maxLng - minLng) * coverage;
  
  // Center the polygon within bounds
  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;
  
  const halfLat = latRange / 2;
  const halfLng = lngRange / 2;
  
  const coordinates = [
    [centerLng - halfLng, centerLat - halfLat],
    [centerLng + halfLng, centerLat - halfLat],
    [centerLng + halfLng, centerLat + halfLat],
    [centerLng - halfLng, centerLat + halfLat],
    [centerLng - halfLng, centerLat - halfLat]
  ];
  
  return {
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      properties: { class: "Water" },
      geometry: {
        type: "Polygon",
        coordinates: [coordinates]
      }
    }]
  };
}

/**
 * Generate encroachment polygon (area between T1 and T2 water)
 * @param bounds - [[minLat, minLng], [maxLat, maxLng]]
 * @returns GeoJSON.FeatureCollection
 */
export function generateEncroachmentPolygon(
  bounds: [[number, number], [number, number]]
): GeoJSON.FeatureCollection {
  const [[minLat, minLng], [maxLat, maxLng]] = bounds;
  
  // Create encroachment on the eastern edge (representing water loss)
  const centerLat = (minLat + maxLat) / 2;
  const encroachmentWidth = (maxLng - minLng) * 0.2; // 20% of width
  const encroachmentHeight = (maxLat - minLat) * 0.6; // 60% of height
  
  const coordinates = [
    [maxLng - encroachmentWidth, centerLat - encroachmentHeight/2],
    [maxLng, centerLat - encroachmentHeight/2],
    [maxLng, centerLat + encroachmentHeight/2],
    [maxLng - encroachmentWidth, centerLat + encroachmentHeight/2],
    [maxLng - encroachmentWidth, centerLat - encroachmentHeight/2]
  ];
  
  return {
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      properties: { class: "Encroachment" },
      geometry: {
        type: "Polygon",
        coordinates: [coordinates]
      }
    }]
  };
}
