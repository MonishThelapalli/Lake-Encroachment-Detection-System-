# Water Watcher - KML/KMZ Upload Feature

## Overview

The Water Watcher system now supports uploading KML or KMZ files to define the Area of Interest (AOI) for lake encroachment analysis, in addition to drawing on the map.

This feature improves usability while maintaining strict pipeline safety, validation, and scientific integrity.

## Features

### Frontend (Analysis.tsx)
- **Three AOI Input Methods:**
  1. Draw on map (existing)
  2. Use example lake (existing)  
  3. Upload KML/KMZ file (NEW)

- **Only one AOI source active at a time**
  - Prevents confusion about which AOI is being used
  - Drawing tools disabled when KML AOI is active
  - Visual indicator shows active AOI source

### KML/KMZ Parsing (kmlParser.ts)
- **File Format Support:**
  - `.kml`: XML format KML files
  - `.kmz`: Zipped KML files (auto-extracts)

- **Geometry Validation:**
  - ✅ Accepts: Polygon, MultiPolygon
  - ❌ Rejects: Point, LineString, other types
  - Validates coordinate ranges (WGS84: lon[-180,180], lat[-90,90])
  - Merges multiple polygons into single MultiPolygon if needed

- **Error Messages:**
  - Clear, user-friendly error descriptions
  - Specific guidance on what's invalid

### Map Integration (MapViewer.tsx)
- **Visual Display:**
  - Uploaded KML displays in orange with 40% opacity
  - Distinct from drawn AOI (green)
  - Auto-zooms map to AOI bounds

- **User Actions:**
  - Clear uploaded AOI to return to draw mode
  - Seamless switching between AOI sources

### Backend Validation (app.py)
- **AOI Validation Function:**
  - Validates GeoJSON Feature structure
  - Confirms geometry type (Polygon/MultiPolygon)
  - Checks coordinate ranges
  - Enforces EPSG:4326 CRS (no custom CRS)
  - Returns clear error messages

- **Pipeline Safety:**
  - Validation occurs BEFORE feature extraction
  - No changes to inference or model logic
  - All existing safeguards preserved

## Files Modified

```
water-watcher/
├── package.json                          # Added @tmcw/togeojson, fflate
├── src/
│   ├── pages/
│   │   └── Analysis.tsx                 # KML upload UI, AOI state management
│   ├── components/
│   │   └── MapViewer.tsx               # KML display, auto-zoom
│   └── lib/
│       ├── kmlParser.ts                # KML/KMZ parsing & validation
│       └── kmlParser.test.ts           # Test suite documentation

backend/
└── app.py                              # AOI validation function
```

## Installation & Setup

### 1. Install Dependencies
```bash
cd water-watcher
npm install
```

### 2. Run Frontend
```bash
npm run dev
```

Server will start at http://localhost:5173

### 3. Run Backend
```bash
cd ../backend
python app.py
```

API will start at http://localhost:8000

## Usage

### Upload KML/KMZ File

1. Navigate to **Analysis** page
2. Scroll to "Define Area of Interest (AOI)" section
3. Click **"Choose File"** button
4. Select `.kml` or `.kmz` file from your computer
5. Wait for parsing confirmation
6. Map will auto-zoom and display orange polygon

### Switch Between AOI Methods

- **From KML to Draw Mode:** Click "Switch to Draw" button
- **From Draw to KML:** Upload new KML file

### Run Analysis

1. Select date range
2. Ensure AOI is defined (KML or drawn)
3. Click "Run Analysis"
4. Backend validates AOI before processing
5. Analysis runs with validated AOI

## API Reference

### POST /api/analyze

**Request:**
```json
{
  "start_date": "2024-01-01",
  "end_date": "2024-12-31",
  "aoi": {
    "type": "Feature",
    "geometry": {
      "type": "Polygon",
      "coordinates": [[[lon, lat], [lon, lat], ...]]
    },
    "properties": {"name": "My AOI"}
  },
  "use_mock_data": false
}
```

**Response (Success):**
```json
{
  "success": true,
  "model_ok": true,
  "model_accuracy": 0.99,
  "warnings": [...],
  "result": {...}
}
```

**Response (Invalid AOI):**
```json
{
  "success": false,
  "model_ok": false,
  "error": "Invalid AOI geometry: Invalid geometry type: Point. Only Polygon and MultiPolygon are supported."
}
```

## Validation Rules

### Frontend Validation
- File type: `.kml` or `.kmz`
- Geometry type: Polygon or MultiPolygon
- Coordinates: Valid WGS84 (lon: -180 to 180, lat: -90 to 90)
- Not empty

### Backend Validation  
- GeoJSON Feature structure
- Geometry type check
- Coordinate range validation
- CRS enforcement (EPSG:4326 only)

### Error Handling
- Parsing errors → Clear message + no upload
- Geometry errors → Rejected with reason
- Coordinate errors → Rejected with reason
- Invalid format → Clear error about expected format

## Security & Safety

### Pipeline Safety Guarantees
✅ **No modifications to:**
- Feature extraction logic
- Model inference logic
- Classification algorithm
- Analysis calculations

✅ **Maintained safeguards:**
- Model accuracy check (99.00%)
- Date range validation
- AOI geometry validation
- Warning visibility
- Scientific disclaimer always shown

✅ **No bypass allowed:**
- AOI validation required before analysis
- Invalid geometries rejected outright
- No special cases or exceptions
- Consistent with existing validation

## Testing

### Test Suite Location
`water-watcher/src/lib/kmlParser.test.ts`

### Manual Tests
1. Valid KML polygon upload
2. Valid KMZ (zipped) upload
3. Invalid geometry rejection
4. Out-of-range coordinates rejection
5. Empty coordinates rejection
6. Map display & auto-zoom
7. AOI source switching
8. Backend validation
9. End-to-end analysis
10. Large AOI handling

### Run Tests
```bash
# Unit tests for parsing
npm run test -- kmlParser.test.ts

# Manual verification
# 1. Upload valid KML file
# 2. Verify map display
# 3. Run analysis
# 4. Check results
```

## Troubleshooting

### "Invalid file type"
- Ensure file ends with `.kml` or `.kmz`
- Check file is actually KML (not PDF, image, etc.)

### "No valid geometries found"
- KML must contain at least one Polygon or MultiPolygon
- Check KML file structure in text editor
- Ensure `<Polygon>` or `<MultiPolygon>` tags present

### "Invalid coordinate ranges"
- Longitude must be between -180 and 180
- Latitude must be between -90 and 90
- Check coordinates are in decimal degrees (not degrees:minutes:seconds)

### "Model Status: Not OK"
- Backend services not initialized
- Check backend is running (`http://localhost:8000/health`)

### Map doesn't auto-zoom
- Try manual zoom with mouse wheel
- Ensure KML bounds are valid
- Check browser console for errors

## Performance Notes

- KMZ files are unzipped in-browser (no server upload required)
- Large KML files (1000+ vertices) load within 1-2 seconds
- Parsing happens client-side (responsive UI)
- No additional server load for KML parsing

## Future Enhancements

Potential additions (not in current scope):
- Drag-and-drop KML file upload
- KML URL import
- Shapefile upload
- GeoJSON upload
- AOI templates
- Saved AOI library
- AOI history

## Support & Documentation

For issues or questions:
1. Check error message for specific guidance
2. Review test cases (`kmlParser.test.ts`)
3. Verify KML file format (valid XML)
4. Check coordinate systems (WGS84 required)
5. Review API response for validation details

---

**Water Watcher KML/KMZ Upload Feature v1.0**  
Enhanced usability while maintaining scientific integrity  
All pipeline safety rules strictly enforced
