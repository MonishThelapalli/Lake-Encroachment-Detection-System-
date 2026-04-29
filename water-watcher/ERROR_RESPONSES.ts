/**
 * KML/KMZ Upload Feature - Error Response Examples
 * Water Watcher API
 * 
 * This file documents all possible error responses from KML parsing,
 * geometry validation, and backend AOI validation.
 */

// ============================================================================
// FRONTEND VALIDATION ERRORS (kmlParser.ts)
// ============================================================================

/**
 * ERROR: File type not supported
 */
const err_invalid_file_type = {
  success: false,
  error: "Invalid file type. Please upload a .kml or .kmz file.",
  geojson: undefined
};

/**
 * ERROR: No valid geometries in KML
 */
const err_no_geometries = {
  success: false,
  error: "No valid geometries found in the KML/KMZ file",
  geojson: undefined
};

/**
 * ERROR: Invalid geometry type (not Polygon/MultiPolygon)
 */
const err_invalid_geometry_type = {
  success: false,
  error: "No Polygon or MultiPolygon geometries found. Please upload a KML with polygon features.",
  geojson: undefined
};

/**
 * ERROR: Point geometry detected
 */
const err_point_geometry = {
  success: false,
  error: "Invalid geometry type: Point. Only Polygon and MultiPolygon are supported.",
  geojson: undefined
};

/**
 * ERROR: LineString geometry detected
 */
const err_line_geometry = {
  success: false,
  error: "Invalid geometry type: LineString. Only Polygon and MultiPolygon are supported.",
  geojson: undefined
};

/**
 * ERROR: Coordinates out of WGS84 range
 */
const err_coordinates_out_of_range = {
  success: false,
  error: "Invalid coordinate ranges. Coordinates must be in WGS84 (lon: -180 to 180, lat: -90 to 90)",
  geojson: undefined
};

/**
 * ERROR: Empty coordinates
 */
const err_empty_coordinates = {
  success: false,
  error: "Empty coordinates",
  geojson: undefined
};

/**
 * ERROR: KMZ extraction failed
 */
const err_kmz_extraction = {
  success: false,
  error: "Failed to extract KML from KMZ: No KML file found in the KMZ archive",
  geojson: undefined
};

/**
 * ERROR: Invalid XML/KML syntax
 */
const err_invalid_xml = {
  success: false,
  error: "Failed to parse KML: Invalid XML/KML syntax",
  geojson: undefined
};

/**
 * SUCCESS: Valid KML parsed
 */
const success_kml_parsed = {
  success: true,
  geojson: {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [[
        [74.2, 31.5],
        [74.3, 31.5],
        [74.3, 31.6],
        [74.2, 31.6],
        [74.2, 31.5]
      ]]
    },
    properties: {
      name: "example_lake",
      source: "uploaded_kml",
      uploadedAt: "2025-02-11T10:30:00Z"
    }
  },
  message: "Successfully parsed 1 polygon(s) from KML file"
};

// ============================================================================
// GEOMETRY VALIDATION ERRORS (validateGeometry)
// ============================================================================

/**
 * ERROR: No geometry provided
 */
const err_no_geometry = {
  valid: false,
  error: "No geometry found"
};

/**
 * ERROR: Invalid geometry structure
 */
const err_invalid_structure = {
  valid: false,
  error: "Invalid coordinates structure"
};

/**
 * ERROR: Empty polygon
 */
const err_empty_polygon = {
  valid: false,
  error: "Empty coordinates"
};

// ============================================================================
// BACKEND VALIDATION ERRORS (validate_aoi_geojson - app.py)
// ============================================================================

/**
 * ERROR: AOI is not a GeoJSON Feature
 */
const api_err_not_feature = {
  success: false,
  model_ok: false,
  error: "Invalid AOI geometry: AOI must be a GeoJSON Feature object",
  warnings: []
};

/**
 * ERROR: AOI Feature missing geometry
 */
const api_err_no_geometry_field = {
  success: false,
  model_ok: false,
  error: "Invalid AOI geometry: AOI Feature must have a geometry",
  warnings: []
};

/**
 * ERROR: Invalid geometry type (Point)
 */
const api_err_point_type = {
  success: false,
  model_ok: false,
  error: "Invalid AOI geometry: Invalid geometry type: Point. Only Polygon and MultiPolygon are supported.",
  warnings: []
};

/**
 * ERROR: Invalid geometry type (LineString)
 */
const api_err_line_type = {
  success: false,
  model_ok: false,
  error: "Invalid AOI geometry: Invalid geometry type: LineString. Only Polygon and MultiPolygon are supported.",
  warnings: []
};

/**
 * ERROR: Invalid coordinate ranges
 */
const api_err_coord_range = {
  success: false,
  model_ok: false,
  error: "Invalid AOI geometry: Invalid coordinate ranges. Coordinates must be in WGS84 format (lon: -180 to 180, lat: -90 to 90)",
  warnings: []
};

/**
 * ERROR: Custom CRS not allowed
 */
const api_err_custom_crs = {
  success: false,
  model_ok: false,
  error: "Invalid AOI geometry: AOI must use EPSG:4326 (WGS84). Custom CRS not supported.",
  warnings: []
};

/**
 * ERROR: Empty coordinates
 */
const api_err_empty = {
  success: false,
  model_ok: false,
  error: "Invalid AOI geometry: Geometry coordinates cannot be empty",
  warnings: []
};

/**
 * SUCCESS: Valid AOI accepted, analysis proceeds
 */
const api_success_analysis = {
  success: true,
  model_ok: true,
  model_accuracy: 0.99,
  warnings: [
    "Using mock data for demonstration (no GEE credentials)",
    "DISCLAIMER: This analysis is for research/monitoring purposes only. Results indicate trends, not legal boundaries. Consult official data sources."
  ],
  result: {
    period: {
      start_date: "2024-01-01",
      end_date: "2024-12-31"
    },
    areas: {
      start: [...],
      end: [...]
    },
    change_summary: {
      baresoil_loss_pixels: 1200,
      builtup_gain_pixels: 3400,
      vegetation_gain_pixels: 2100,
      total_encroachment_pixels: 4600,
      trend: "encroachment"
    },
    total_pixels: 10000,
    model_info: {
      accuracy: 0.99,
      accuracy_text: "99.00%",
      trained_samples: 1000,
      training_source: "Ground truth annotations (Datapoints 2 - Sheet1.csv)",
      confidence_scores: {
        t1_mean: 0.943,
        t1_min: 0.612,
        t1_max: 0.998,
        t2_mean: 0.941,
        t2_min: 0.608,
        t2_max: 0.997
      }
    },
    method: "Random Forest classifier with spectral indices"
  }
};

// ============================================================================
// UI ERROR DISPLAY EXAMPLES
// ============================================================================

/**
 * Frontend Toast Notification Examples
 */

// When file fails to parse
const ui_error_toast = {
  title: "KML Parse Error",
  description: "Invalid file type. Please upload a .kml or .kmz file.",
  variant: "destructive"
};

// When file uploads successfully
const ui_success_toast = {
  title: "KML Uploaded Successfully",
  description: "KML/KMZ file parsed and ready for analysis",
  variant: "default"
};

// When coordinates are invalid
const ui_coord_error_toast = {
  title: "KML Parse Error",
  description: "Invalid coordinate ranges. Coordinates must be in WGS84 (lon: -180 to 180, lat: -90 to 90)",
  variant: "destructive"
};

// ============================================================================
// EXAMPLE CURL REQUESTS
// ============================================================================

/**
 * Test 1: Valid AOI Analysis
 * 
 * curl -X POST http://localhost:8000/api/analyze \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "start_date": "2024-01-01",
 *     "end_date": "2024-12-31",
 *     "aoi": {
 *       "type": "Feature",
 *       "geometry": {
 *         "type": "Polygon",
 *         "coordinates": [[[74.2, 31.5], [74.3, 31.5], [74.3, 31.6], [74.2, 31.6], [74.2, 31.5]]]
 *       },
 *       "properties": {"name": "Lake AOI"}
 *     },
 *     "use_mock_data": true
 *   }'
 * 
 * Expected: 200 OK with result
 */

/**
 * Test 2: Invalid Geometry Type (Point)
 * 
 * curl -X POST http://localhost:8000/api/analyze \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "start_date": "2024-01-01",
 *     "end_date": "2024-12-31",
 *     "aoi": {
 *       "type": "Feature",
 *       "geometry": {
 *         "type": "Point",
 *         "coordinates": [74.25, 31.55]
 *       }
 *     },
 *     "use_mock_data": true
 *   }'
 * 
 * Expected: 200 (FastAPI doesn't HTTP error, but success: false)
 * Response: {"success": false, "model_ok": false, "error": "Invalid AOI geometry: ..."}
 */

/**
 * Test 3: Out-of-Range Coordinates
 * 
 * curl -X POST http://localhost:8000/api/analyze \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "start_date": "2024-01-01",
 *     "end_date": "2024-12-31",
 *     "aoi": {
 *       "type": "Feature",
 *       "geometry": {
 *         "type": "Polygon",
 *         "coordinates": [[[200, 40], [210, 40], [210, 50], [200, 50], [200, 40]]]
 *       }
 *     },
 *     "use_mock_data": true
 *   }'
 * 
 * Expected: 200 (FastAPI doesn't HTTP error)
 * Response: {"success": false, "model_ok": false, "error": "Invalid AOI geometry: Invalid coordinate ranges..."}
 */

// ============================================================================
// EXPORT FOR TESTING
// ============================================================================

export {
  // Frontend errors
  err_invalid_file_type,
  err_no_geometries,
  err_invalid_geometry_type,
  err_point_geometry,
  err_line_geometry,
  err_coordinates_out_of_range,
  err_empty_coordinates,
  err_kmz_extraction,
  err_invalid_xml,
  success_kml_parsed,
  
  // Geometry validation
  err_no_geometry,
  err_invalid_structure,
  err_empty_polygon,
  
  // Backend API errors
  api_err_not_feature,
  api_err_no_geometry_field,
  api_err_point_type,
  api_err_line_type,
  api_err_coord_range,
  api_err_custom_crs,
  api_err_empty,
  api_success_analysis,
  
  // UI toasts
  ui_error_toast,
  ui_success_toast,
  ui_coord_error_toast
};
