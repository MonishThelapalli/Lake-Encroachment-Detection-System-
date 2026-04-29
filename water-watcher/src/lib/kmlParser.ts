/**
 * KML/KMZ Parser Utility for Water Watcher
 * Handles parsing, validation, and conversion of KML/KMZ files to GeoJSON
 */

import { kml } from '@tmcw/togeojson';
import { unzipSync, strFromU8 } from 'fflate';

export interface ParsedKML {
  success: boolean;
  geojson?: any;
  error?: string;
  message?: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Extract KML from a KMZ file (zipped KML)
 * @param file - The KMZ file
 * @returns The uncompressed KML string
 */
async function extractKMLFromKMZ(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const buffer = reader.result as ArrayBuffer;
        const uint8Array = new Uint8Array(buffer);
        const unzipped = unzipSync(uint8Array);

        // Find the KML file in the archive
        const kmlFile = Object.keys(unzipped).find(
          (key) => key.endsWith('.kml') && !key.includes('__MACOSX')
        );

        if (!kmlFile) {
          reject(new Error('No KML file found in the KMZ archive'));
          return;
        }

        const kmlContent = strFromU8(unzipped[kmlFile]);
        resolve(kmlContent);
      } catch (error) {
        reject(new Error(`Failed to extract KML from KMZ: ${error}`));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read KMZ file'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Parse KML content to GeoJSON
 * @param kmlContent - The KML XML string
 * @returns GeoJSON FeatureCollection
 */
function parseKMLToGeoJSON(kmlContent: string): any {
  try {
    const parser = new DOMParser();
    const kmlDOM = parser.parseFromString(kmlContent, 'text/xml');

    if (kmlDOM.getElementsByTagName('parsererror').length > 0) {
      throw new Error('Invalid XML/KML syntax');
    }

    const geojson = kml(kmlDOM);
    return geojson;
  } catch (error) {
    throw new Error(`Failed to parse KML: ${error}`);
  }
}

/**
 * Validate coordinate ranges (WGS84)
 * @param coordinates - Nested coordinate array
 * @returns true if valid
 */
function validateCoordinateRanges(coordinates: any[]): boolean {
  const validateCoord = (coord: any): boolean => {
    if (Array.isArray(coord[0])) {
      return coord.every(validateCoord);
    }
    const [lon, lat] = coord;
    return (
      typeof lon === 'number' &&
      typeof lat === 'number' &&
      lon >= -180 &&
      lon <= 180 &&
      lat >= -90 &&
      lat <= 90
    );
  };

  return validateCoord(coordinates);
}

/**
 * Validate geometry is Polygon or MultiPolygon
 * @param geometry - The geometry object
 * @returns ValidationResult
 */export function validateGeometry(geometry: any): ValidationResult {
  if (!geometry) {
    return { valid: false, error: 'No geometry found' };
  }

  const validTypes = ['Polygon', 'MultiPolygon'];
  if (!validTypes.includes(geometry.type)) {
    return {
      valid: false,
      error: `Invalid geometry type: ${geometry.type}. Only Polygon and MultiPolygon are supported.`
    };
  }

  if (!geometry.coordinates || !Array.isArray(geometry.coordinates)) {
    return { valid: false, error: 'Invalid coordinates structure' };
  }

  if (geometry.coordinates.length === 0) {
    return { valid: false, error: 'Empty coordinates' };
  }

  // Validate coordinate ranges
  if (!validateCoordinateRanges(geometry.coordinates)) {
    return {
      valid: false,
      error: 'Invalid coordinate ranges. Coordinates must be in WGS84 (lon: -180 to 180, lat: -90 to 90)'
    };
  }

  return { valid: true };
}

/**
 * Extract the first valid Polygon/MultiPolygon feature from GeoJSON
 * @param geojson - The GeoJSON FeatureCollection
 * @returns The first valid geometry, or null if none found
 */
function extractPolygonFeature(geojson: any): any {
  if (!geojson || !geojson.features) {
    return null;
  }

  for (const feature of geojson.features) {
    if (
      feature.geometry &&
      (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon')
    ) {
      return feature.geometry;
    }
  }

  return null;
}

/**
 * Merge multiple polygons into a single MultiPolygon
 * @param geometries - Array of Polygon geometries
 * @returns A single Polygon or MultiPolygon
 */
function mergePolygons(geometries: any[]): any {
  if (geometries.length === 1) {
    return geometries[0];
  }

  // Collect all polygon rings
  const allCoordinates: any[] = [];
  geometries.forEach((geom) => {
    if (geom.type === 'Polygon') {
      allCoordinates.push(geom.coordinates);
    } else if (geom.type === 'MultiPolygon') {
      allCoordinates.push(...geom.coordinates);
    }
  });

  return {
    type: 'MultiPolygon',
    coordinates: allCoordinates
  };
}

/**
 * Parse KML file
 * @param file - The KML or KMZ file
 * @returns ParsedKML result
 */
export async function parseKMLFile(file: File): Promise<ParsedKML> {
  try {
    // Validate file type
    const fileName = file.name.toLowerCase();
    const isKML = fileName.endsWith('.kml');
    const isKMZ = fileName.endsWith('.kmz');

    if (!isKML && !isKMZ) {
      return {
        success: false,
        error: 'Invalid file type. Please upload a .kml or .kmz file.'
      };
    }

    // Extract KML content
    let kmlContent: string;
    if (isKMZ) {
      kmlContent = await extractKMLFromKMZ(file);
    } else {
      kmlContent = await file.text();
    }

    // Parse KML to GeoJSON
    const geojson = parseKMLToGeoJSON(kmlContent);

    if (!geojson || !geojson.features || geojson.features.length === 0) {
      return {
        success: false,
        error: 'No valid geometries found in the KML/KMZ file'
      };
    }

    // Extract all Polygon/MultiPolygon features
    const polygonFeatures = geojson.features.filter(
      (f: any) =>
        f.geometry &&
        (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon')
    );

    if (polygonFeatures.length === 0) {
      return {
        success: false,
        error: 'No Polygon or MultiPolygon geometries found. Please upload a KML with polygon features.'
      };
    }

    // Get the first geometry or merge all if needed
    const geometries = polygonFeatures.map((f: any) => f.geometry);
    const mergedGeometry = mergePolygons(geometries);

    // Validate the geometry
    const validationResult = validateGeometry(mergedGeometry);
    if (!validationResult.valid) {
      return {
        success: false,
        error: validationResult.error
      };
    }

    // Create GeoJSON Feature
    const aoiFeature = {
      type: 'Feature',
      geometry: mergedGeometry,
      properties: {
        name: file.name.replace(/\.[^/.]+$/, ''), // Remove file extension
        source: 'uploaded_kml',
        uploadedAt: new Date().toISOString()
      }
    };

    return {
      success: true,
      geojson: aoiFeature,
      message: `Successfully parsed ${polygonFeatures.length} polygon(s) from ${isKML ? 'KML' : 'KMZ'} file`
    };
  } catch (error) {
    return {
      success: false,
      error: `Error parsing file: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Get bounds of a GeoJSON geometry
 * @param geometry - The geometry object
 * @returns [minLon, minLat, maxLon, maxLat]
 */
export function getGeometryBounds(
  geometry: any
): [number, number, number, number] {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;

  const processCoor = (coord: any) => {
    if (Array.isArray(coord[0])) {
      coord.forEach(processCoor);
    } else {
      const [lon, lat] = coord;
      minLon = Math.min(minLon, lon);
      maxLon = Math.max(maxLon, lon);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }
  };

  processCoor(geometry.coordinates);
  return [minLon, minLat, maxLon, maxLat];
}
