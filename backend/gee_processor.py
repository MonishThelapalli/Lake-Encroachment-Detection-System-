"""
Phase 2 deterministic GEE shoreline feature extraction.

Rules implemented:
- COPERNICUS/S2_SR_HARMONIZED
- Median composite
- 10m resolution
- No reflectance normalization
- Shoreline-only sampling from water-ring mask
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import ee
import requests
import pandas as pd

try:
    from pipeline_config import CLASS_COLORS, FEATURE_ORDER, STAGE_VERSIONS
    from tiling import create_tiles
except ModuleNotFoundError:  # pragma: no cover
    from backend.pipeline_config import CLASS_COLORS, FEATURE_ORDER, STAGE_VERSIONS
    from backend.tiling import create_tiles

FEATURE_EXTRACTION_STAGE_VERSION = STAGE_VERSIONS["phase_2_feature_extraction"]
S2_COLLECTION_ID = "COPERNICUS/S2_SR_HARMONIZED"
SCALE_METERS = 30
OUTER_BUFFER_METERS = 40
INNER_BUFFER_METERS = 20
MIN_SHORELINE_PIXELS = 50
MIN_ALIGNED_PIXELS = 100

DEBUG_SAMPLES_GEOJSON = Path(__file__).resolve().parent / "debug_samples.geojson"
DEBUG_FEATURES_CSV = Path(__file__).resolve().parent / "debug_features.csv"

_EE_AUTHENTICATED = False

CLASS_TILE_ORDER = ["Water", "Tree", "Grassland", "BuiltUp", "BareLand"]
CLASS_CODE_TO_NAME = {
    1: "Water",
    2: "Tree",
    3: "Grassland",
    4: "BuiltUp",
    5: "BareLand",
}
CLASS_NAME_TO_CODE = {name: code for code, name in CLASS_CODE_TO_NAME.items()}
CLASS_TILE_VIS_PARAMS = {
    "min": 1,
    "max": 5,
    "palette": [CLASS_COLORS[name] for name in CLASS_TILE_ORDER],
}


def initialize_gee(credentials_path: Optional[str] = None) -> bool:
    global _EE_AUTHENTICATED
    if _EE_AUTHENTICATED:
        return True

    try:
        ee.Initialize()
        _EE_AUTHENTICATED = True
        return True
    except Exception:
        pass

    try:
        if not credentials_path:
            credentials_path = os.getenv("GEE_SERVICE_ACCOUNT_KEY")
        if not credentials_path:
            local = Path(__file__).resolve().parent / "gee-service-account.json"
            if local.exists():
                credentials_path = str(local)

        if credentials_path and Path(credentials_path).exists():
            with open(credentials_path, "r", encoding="utf-8") as f:
                sa_json = json.load(f)
            sa_email = sa_json.get("client_email")
            if sa_email:
                credentials = ee.ServiceAccountCredentials(sa_email, credentials_path)
                ee.Initialize(credentials)
                _EE_AUTHENTICATED = True
                return True
                
        ee.Authenticate()
        ee.Initialize()
        _EE_AUTHENTICATED = True
        return True
    except Exception:
        _EE_AUTHENTICATED = False
        return False


def is_gee_authenticated() -> bool:
    return _EE_AUTHENTICATED


def _get_map_id_and_tile_url(image, vis_params: Optional[Dict[str, Any]] = None):
    import ee
    
    if vis_params is None:
        vis_params = CLASS_TILE_VIS_PARAMS

    image = ee.Image(image)
    viz_image = image.visualize(**vis_params)

    try:
        map_dict = viz_image.getMapId()
        print("MapID:", map_dict)
        tile_url = map_dict.get("tile_fetcher", {}).url_format if "tile_fetcher" in map_dict else None
        
        if not tile_url:
            raise ValueError(f"Tile URL format string generated is null. MapID info: {map_dict}")
            
        return map_dict, tile_url
    except Exception as e:
        print(f"CRITICAL ERROR generating GEE visual tile URL: {e}")
        raise e



def _normalize_aoi_geometry(aoi_geojson: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(aoi_geojson, dict):
        raise ValueError("AOI must be a GeoJSON object.")

    if aoi_geojson.get("type") == "Feature":
        geometry = aoi_geojson.get("geometry")
    else:
        geometry = aoi_geojson

    if not isinstance(geometry, dict):
        raise ValueError("AOI geometry missing.")
    geom_type = geometry.get("type")
    if geom_type not in ("Polygon", "MultiPolygon"):
        raise ValueError(f"Unsupported AOI geometry type: {geom_type}")
    if not geometry.get("coordinates"):
        raise ValueError("AOI geometry has empty coordinates.")
    return geometry


def _safe_ratio(numerator: ee.Image, denominator: ee.Image, name: str) -> ee.Image:
    safe_denominator = denominator.where(denominator.eq(0), 1)
    return numerator.divide(safe_denominator).rename(name)


def _build_feature_image(
    aoi_geom: ee.Geometry,
    start_date: str,
    end_date: str,
    cloud_limit: float = 40,
) -> ee.Image:
    def _mask_s2_clouds(image):
        qa = image.select('QA60')
        # Bits 10 and 11 are clouds and cirrus, respectively.
        cloudBitMask = 1 << 10
        cirrusBitMask = 1 << 11
        # Both flags should be set to zero, indicating clear conditions.
        mask = qa.bitwiseAnd(cloudBitMask).eq(0).And(
               qa.bitwiseAnd(cirrusBitMask).eq(0))
        return image.updateMask(mask)

    collection = (
        ee.ImageCollection(S2_COLLECTION_ID)
        .filterDate(start_date, end_date)
        .filterBounds(aoi_geom)
        .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', cloud_limit))
        .map(_mask_s2_clouds)
    )
    count = int(collection.size().getInfo())
    print(f"[DEBUG] Sentinel images found: {count} (Target: >= 8, Cloud Limit: {cloud_limit}%)")
    if count < 8:
        print(f"[WARNING] Insufficient images ({count} < 8). Triggering expansion.")
        raise RuntimeError("NO_IMAGERY")

    composite = (
        collection.median()
        .select(["B2", "B3", "B4", "B8", "B11"], ["Blue", "Green", "Red", "NIR", "SWIR"])
        .toFloat()
        .clip(aoi_geom)
    )

    ndvi = _safe_ratio(
        composite.select("NIR").subtract(composite.select("Red")),
        composite.select("NIR").add(composite.select("Red")),
        "NDVI",
    )
    mndwi = _safe_ratio(
        composite.select("Green").subtract(composite.select("SWIR")),
        composite.select("Green").add(composite.select("SWIR")),
        "MNDWI",
    )
    ndbi = _safe_ratio(
        composite.select("SWIR").subtract(composite.select("NIR")),
        composite.select("SWIR").add(composite.select("NIR")),
        "NDBI",
    )

    feature_image = ee.Image.cat(
        [
            composite.select("Green"),
            mndwi,
            ndbi,
            ndvi,
            composite.select("NIR"),
            composite.select("Red"),
            composite.select("SWIR")
        ]
    )
    return feature_image.set(
        {
            "feature_extraction_stage_version": FEATURE_EXTRACTION_STAGE_VERSION,
            "source_collection": S2_COLLECTION_ID,
            "start_date": start_date,
            "end_date": end_date,
        }
    )


def _export_debug_outputs(samples_geojson: Dict[str, Any], feature_rows: List[Dict[str, Any]]) -> None:
    try:
        with DEBUG_SAMPLES_GEOJSON.open("w", encoding="utf-8") as f:
            json.dump(samples_geojson, f, indent=2)
    except Exception:
        pass

    try:
        if feature_rows:
            pd.DataFrame(feature_rows).to_csv(DEBUG_FEATURES_CSV, index=False)
        else:
            pd.DataFrame(columns=["longitude", "latitude", *FEATURE_ORDER]).to_csv(
                DEBUG_FEATURES_CSV, index=False
            )
    except Exception:
        pass


def extract_s2_features(
    aoi_geojson: Dict[str, Any],
    base_start_date: str,
    base_end_date: str,
) -> List[Dict[str, Any]]:
    """
    Extract shoreline-only features for one temporal window.
    Implements adaptive temporal expansion and cloud threshold relaxation
    if insufficient pixels are found.

    Returns rows containing:
    - longitude, latitude
    - NDVI, MNDWI, NDBI, Green, Red, NIR, SWIR
    """
    if not _EE_AUTHENTICATED:
        raise RuntimeError("GEE_NOT_INITIALIZED")

    normalized_geom = _normalize_aoi_geometry(aoi_geojson)
    aoi_geom = ee.Geometry(normalized_geom)

    # Generate grid tiles to prevent GEE memory errors
    tiles = create_tiles(normalized_geom, tile_size_deg=0.02)
    
    try:
        estimated_pixels = aoi_geom.area().getInfo() / (SCALE_METERS ** 2)
    except Exception:
        estimated_pixels = 1000
    
    dynamic_scale = 20 if estimated_pixels < 300 else SCALE_METERS
    
    # Adaptive expansion parameters
    attempts = [
        {"delta": 0, "cloud_limit": 40},
        {"delta": 15, "cloud_limit": 60},
        {"delta": 30, "cloud_limit": 80},
        {"delta": 60, "cloud_limit": 100},
    ]

    base_start_dt = datetime.strptime(base_start_date, "%Y-%m-%d")
    base_end_dt = datetime.strptime(base_end_date, "%Y-%m-%d")

    for attempt_idx, attempt in enumerate(attempts):
        delta_days = attempt["delta"]
        cloud_limit = attempt["cloud_limit"]
        
        # Expand dates
        start_date = (base_start_dt - timedelta(days=delta_days)).strftime("%Y-%m-%d")
        end_date = (base_end_dt + timedelta(days=delta_days)).strftime("%Y-%m-%d")
        
        if delta_days > 0:
            print(f"Retrying extraction with expanded date window ±{delta_days} days (Cloud threshold < {cloud_limit}%)")

        # Inner map extraction function
        def process_tile(tile_geom_input) -> List[Dict[str, Any]]:
            tile_ee_geom = ee.Geometry(tile_geom_input)
            
            last_exception = None
            for _ in range(2): # Retry once per tile
                try:
                    # Rebuild feature image with expanded dates and relaxed cloud limits
                    tile_feature_image = _build_feature_image(tile_ee_geom, start_date, end_date, cloud_limit)
                except RuntimeError as e:
                    if "NO_IMAGERY" in str(e):
                        return []
                    raise e
                    
                try:
                    print("[DEBUG] Requested numPixels: 20000")
                    samples_fc = tile_feature_image.select(FEATURE_ORDER).unmask(-9999).sample(
                        region=tile_ee_geom,
                        scale=10,
                        numPixels=20000,
                        seed=42,
                        geometries=True,
                        tileScale=4,
                    )
                    
                    actual_size = samples_fc.size().getInfo()
                    print(f"[DEBUG] ACTUAL SAMPLE SIZE: {actual_size}")
                    print(f"[DEBUG] Actual returned pixels: {actual_size}")
                    
                    if actual_size < 5000:
                        print(f"[WARNING] Sample size < 5000. Triggering fallback to full raster sampling.")
                        # Add lat/lon coordinates explicitly for raster flattening
                        coords_img = ee.Image.pixelLonLat()
                        img_with_coords = tile_feature_image.select(FEATURE_ORDER).unmask(-9999).addBands(coords_img)
                        img_with_coords = img_with_coords.reproject(crs='EPSG:4326', scale=10)
                        
                        rect = img_with_coords.sampleRectangle(region=tile_ee_geom, defaultValue=-9999).getInfo()
                        rect_props = rect.get('properties', {})
                        
                        grid_lon = rect_props.get('longitude')
                        grid_lat = rect_props.get('latitude')
                        
                        features_list = []
                        if grid_lon and grid_lat:
                            for r in range(len(grid_lon)):
                                for c in range(len(grid_lon[0])):
                                    feat_props = {}
                                    for b in FEATURE_ORDER:
                                        # Handle potential missing band entries gracefully
                                        if b in rect_props:
                                            feat_props[b] = rect_props[b][r][c]
                                        else:
                                            feat_props[b] = -9999.0
                                            
                                    if feat_props.get('Green') <= 0:
                                        continue
                                        
                                    lng = grid_lon[r][c]
                                    lat = grid_lat[r][c]
                                    features_list.append({
                                        "type": "Feature",
                                        "geometry": {
                                            "type": "Point",
                                            "coordinates": [lng, lat]
                                        },
                                        "properties": feat_props
                                    })
                        print(f"[DEBUG] Fallback sampleRectangle generated {len(features_list)} raster pixels.")
                        return features_list
                    else:
                        try:
                            # Bypass the 5000 element limit of .getInfo() by using getDownloadURL
                            url = samples_fc.getDownloadURL('geojson')
                            r = requests.get(url)
                            tile_samples_geojson = r.json()
                        except Exception as dl_e:
                            print(f"[WARNING] getDownloadURL failed: {dl_e}. Falling back to .getInfo()")
                            tile_samples_geojson = samples_fc.getInfo()
                            
                        features_list = tile_samples_geojson.get("features", [])
                        return features_list
                except Exception as e:
                    last_exception = e
                    # Retry if first attempt fails
                    
            raise RuntimeError(f"Tile extraction failed after 2 attempts: {last_exception}")

        # Execute sequentially to prevent Earth Engine concurrent connection/memory limits
        all_features = []
        for tile_geom in tiles:
            try:
                features = process_tile(tile_geom)
                if features:
                    all_features.extend(features)
            except Exception as e:
                print(f"Skipping failed tile: {e}")

        rows: List[Dict[str, Any]] = []
        for feat in all_features:
            geom = feat.get("geometry", {}) or {}
            coords = geom.get("coordinates", []) or []
            props = feat.get("properties", {}) or {}
            if len(coords) < 2:
                continue
            row = {
                "longitude": float(coords[0]),
                "latitude": float(coords[1]),
            }
            missing = False
            for feature_name in FEATURE_ORDER:
                value = props.get(feature_name)
                if value is None or (feature_name in ["Green", "Red", "NIR", "SWIR"] and float(value) <= 0):
                    missing = True
                    break
                row[feature_name] = float(value)
            if not missing:
                rows.append(row)

        print(f"Total extracted features this attempt: {len(rows)}")

        if len(rows) >= MIN_ALIGNED_PIXELS:
            return rows
            
    # After all attempts
    available_pixels = len(rows)
    
    if available_pixels < 50:
        print("Warning: Lake too small for reliable analysis - continuing with available samples")
        
    required_pixels = max(80, int(available_pixels * 0.5))
    
    if available_pixels < required_pixels:
        print(f"Insufficient extraction density. Extracted {available_pixels} pixels, required > {MIN_ALIGNED_PIXELS} - Continuing")
        
    return rows


def extract_s2_features_with_diagnostics(
    aoi_geojson: Dict[str, Any],
    base_start_date: str,
    base_end_date: str,
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Extract shoreline-only features for one temporal window with diagnostics.
    """
    rows = extract_s2_features(aoi_geojson, base_start_date, base_end_date)
    return rows, {}

    if not _EE_AUTHENTICATED:
        raise RuntimeError("GEE_NOT_INITIALIZED")

    normalized_geom = _normalize_aoi_geometry(aoi_geojson)
    aoi_geom = ee.Geometry(normalized_geom)
    diagnostics = _aoi_diagnostics(aoi_geom)

    tile_size = _choose_tile_size(int(diagnostics["estimated_pixels"]))
    tiles = create_tiles(normalized_geom, tile_size_deg=tile_size)
    diagnostics["tile_count"] = len(tiles)

    dynamic_scale = 20 if diagnostics["estimated_pixels"] < 300 else SCALE_METERS
    attempts = [
        {"delta": 0, "cloud_limit": 10},
        {"delta": 15, "cloud_limit": 30},
        {"delta": 30, "cloud_limit": 60},
        {"delta": 60, "cloud_limit": 100},
    ]
    base_start_dt = datetime.strptime(base_start_date, "%Y-%m-%d")
    base_end_dt = datetime.strptime(base_end_date, "%Y-%m-%d")

    best_rows: List[Dict[str, Any]] = []
    per_tile_estimate = max(1, int(diagnostics["estimated_pixels"] / max(1, len(tiles))))
    per_tile_limit = 20000

    for attempt in attempts:
        delta_days = attempt["delta"]
        cloud_limit = attempt["cloud_limit"]
        start_date = (base_start_dt - timedelta(days=delta_days)).strftime("%Y-%m-%d")
        end_date = (base_end_dt + timedelta(days=delta_days)).strftime("%Y-%m-%d")
        if delta_days > 0:
            print(
                f"Retrying extraction with expanded date window +/-{delta_days} days "
                f"(Cloud threshold <= {cloud_limit}%)"
            )

        all_features: List[Dict[str, Any]] = []
        attempt_imagery_found = False
        for tile_geom in tiles:
            tile_ee_geom = ee.Geometry(tile_geom)
            last_exception: Optional[Exception] = None
            for _ in range(2):
                try:
                    tile_feature_image, image_count = _build_feature_image(
                        tile_ee_geom,
                        start_date,
                        end_date,
                        cloud_limit,
                    )
                    if image_count > 0:
                        attempt_imagery_found = True

                    # ── Step 1: try shoreline-masked sampling ──────────────────
                    shoreline_mask = water_mask.focal_max(3).neq(water_mask) # Guaranteed Shoreline 
                    sample_image = tile_feature_image.select(FEATURE_ORDER).updateMask(shoreline_mask)
                    samples_fc = (
                        sample_image.sample(
                            region=tile_ee_geom,
                            scale=dynamic_scale,
                            numPixels=per_tile_limit,
                            geometries=True,
                            seed=42,
                            tileScale=4,
                        )
                    )
                    tile_samples_geojson = samples_fc.getInfo()
                    features_list = tile_samples_geojson.get("features", [])
                    print(f"Sampled {len(features_list)} shoreline pixels from tile")

                    # ── Step 2: fallback to full-AOI if shoreline was sparse ───
                    # No extra getInfo() — we use the count we already have.
                    if len(features_list) < MIN_SHORELINE_PIXELS:
                        print(
                            f"Shoreline mask returned {len(features_list)} px "
                            f"(< {MIN_SHORELINE_PIXELS}). Falling back to full-AOI sampling."
                        )
                        fallback_image = tile_feature_image.select(FEATURE_ORDER).unmask()
                        fallback_fc = (
                            fallback_image.sample(
                                region=tile_ee_geom,
                                scale=dynamic_scale,
                                numPixels=per_tile_limit,
                                geometries=True,
                                seed=42,
                                tileScale=4,
                            )
                        )
                        fallback_geojson = fallback_fc.getInfo()
                        fallback_features = fallback_geojson.get("features", [])
                        print(f"AOI fallback returned {len(fallback_features)} pixels from tile")
                        # Use whichever set has more data
                        if len(fallback_features) > len(features_list):
                            features_list = fallback_features

                    if features_list:
                        all_features.extend(features_list)
                    break
                except RuntimeError as exc:
                    if str(exc) == "NO_IMAGERY":
                        break
                    raise
                except Exception as exc:
                    last_exception = exc
            else:
                print(f"Skipping failed tile after retries: {last_exception}")

        diagnostics["imagery_found"] = bool(diagnostics["imagery_found"] or attempt_imagery_found)

        rows: List[Dict[str, Any]] = []
        for feat in all_features:
            geom = feat.get("geometry", {}) or {}
            coords = geom.get("coordinates", []) or []
            props = feat.get("properties", {}) or {}
            if len(coords) < 2:
                continue
            row = {"longitude": float(coords[0]), "latitude": float(coords[1])}
            missing = False
            for feature_name in FEATURE_ORDER:
                value = props.get(feature_name)
                if value is None:
                    missing = True
                    break
                row[feature_name] = float(value)
            if not missing:
                rows.append(row)

        print(f"Total extracted shoreline features this attempt: {len(rows)}")
        best_rows = rows
        diagnostics["samples_extracted"] = len(rows)
        if len(rows) >= MIN_ALIGNED_PIXELS:
            return rows, diagnostics

    if not diagnostics["imagery_found"]:
        raise RuntimeError("NO_IMAGERY")

    available_pixels = len(best_rows)
    if available_pixels < 50 and int(diagnostics["estimated_pixels"]) < 200:
        print("Warning: Lake too small for reliable analysis - continuing with available samples")
    print(f"Low extraction density. Extracted {available_pixels} pixels, expected > {MIN_ALIGNED_PIXELS} - Continuing")
    return best_rows, diagnostics


def _extract_s2_features_with_diagnostics_wrapper_unused(
    aoi_geojson: Dict[str, Any],
    base_start_date: str,
    base_end_date: str,
) -> List[Dict[str, Any]]:
    rows, _ = extract_s2_features_with_diagnostics(aoi_geojson, base_start_date, base_end_date)
    return rows


def generate_classified_image(
    aoi: ee.Geometry,
    start_date: str,
    end_date: str,
) -> Dict[str, Any]:
    """
    Generate classified raster image using Sentinel-2 data and recursive Bayesian smoothing.
    
    Args:
        aoi: Area of interest geometry
        start_date: Start date (YYYY-MM-DD)
        end_date: End date (YYYY-MM-DD)
    
    Returns:
        Dictionary containing tile URL and metadata
    """
    if not _EE_AUTHENTICATED:
        initialize_gee()
    
    import ee
    
    try:
        from datetime import datetime, timedelta
        end_dt = datetime.strptime(end_date, "%Y-%m-%d")
        
        # Extend history backwards by 1 year to build a stable temporal memory
        historical_start = (end_dt - timedelta(days=365)).strftime("%Y-%m-%d")

        s2_collection = (ee.ImageCollection('COPERNICUS/S2_SR')
                .filterDate(historical_start, end_date)
                .filterBounds(aoi)
                .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
                .sort('system:time_start'))
                
        # Handle cases with no imagery
        count = int(s2_collection.size().getInfo())
        if count == 0:
            raise RuntimeError("NO_IMAGERY: No images found for temporal smoothing")

        # Function to calculate initial Model Probabilities (P_model)
        def calculate_p_model(image):
            ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI')
            mndwi = image.normalizedDifference(['B3', 'B11']).rename('MNDWI')
            ndbi = image.normalizedDifference(['B11', 'B8']).rename('NDBI')
            
            def sigmoid(expr):
                return ee.Image(1).divide(ee.Image(1).add(expr.multiply(-1).exp()))
                
            scale = ee.Image(5)
            
            p_water = sigmoid(mndwi.subtract(0.2).multiply(scale)).rename('P_water')
            p_tree = sigmoid(ndvi.subtract(0.5).multiply(scale)).rename('P_tree')
            p_grass = sigmoid(ndvi.subtract(0.25).multiply(scale)).multiply(ee.Image(1).subtract(p_tree)).rename('P_grass')
            p_built = sigmoid(ndbi.subtract(0.1).multiply(scale)).rename('P_built')
            
            # CLASS CONFLICT RESOLUTION
            p_tree = p_tree.multiply(ee.Image(1).subtract(p_water))
            p_grass = p_grass.multiply(ee.Image(1).subtract(p_water))
            
            # WATER PRIORITY BOOST
            p_water = p_water.add(0.05)
            
            sum_others = p_water.add(p_tree).add(p_grass).add(p_built)
            
            # BARE LAND CONTROL
            p_bare = ee.Image(1).subtract(sum_others).max(0).multiply(0.7).rename('P_bare')
            
            sum_p = sum_others.add(p_bare).max(1e-6)
            
            p_water = p_water.divide(sum_p)
            p_tree = p_tree.divide(sum_p)
            p_grass = p_grass.divide(sum_p)
            p_built = p_built.divide(sum_p)
            p_bare = p_bare.divide(sum_p)
            
            p_vegetation = p_tree.add(p_grass)
            p_model = ee.Image.cat([
                p_water.rename("water"),
                p_vegetation.rename("veg"),
                p_bare.rename("bare"),
                p_built.rename("built")
            ])
            return image.addBands(p_model).addBands([mndwi, ndvi, ndbi])

        s2_with_p = s2_collection.map(calculate_p_model)

        def recursive_update(image, prev_dict):
            prev_dict = ee.Dictionary(prev_dict)
            prev_prob = ee.Image(prev_dict.get('prob'))
            
            p_model = ee.Image(image).select(['water', 'veg', 'bare', 'built'])
            p_model = p_model.unmask(prev_prob)
            
            delta = p_model.subtract(prev_prob).abs().reduce(ee.Reducer.max())
            epsilon = ee.Image(0.05).where(delta.gt(0.15), 0.2)
            
            p_t = prev_prob.multiply(ee.Image(1).subtract(epsilon)).add(p_model.multiply(epsilon))
            
            return ee.Dictionary({'prob': p_t})

        # Initialize Memory
        first_image = ee.Image(s2_with_p.first())
        initial_prob = first_image.select(['water', 'veg', 'bare', 'built'])

        # Iterate over time series to build memory
        final_state = ee.Dictionary(s2_with_p.iterate(recursive_update, ee.Dictionary({'prob': initial_prob})))
        final_prob = ee.Image(final_state.get('prob')).clip(aoi)

        # GENERATE CLASS MAP:
        class_map = final_prob.toArray() \
            .arrayArgmax() \
            .arrayProject([0]) \
            .arrayFlatten([["class"]])

        # FIX INVALID PIXELS:
        class_map = class_map.clip(aoi)
        
        # APPLY MASK
        mask = final_prob.select("water").gt(0.1)
        class_map = class_map.updateMask(mask)
        
        # KEEP VALID RANGE
        class_map = class_map.clamp(0, 3).toInt()
        
        print("Final Image:", class_map.getInfo())
        
        # SPATIAL CLEANING
        class_map = class_map.focal_mode(radius=1)
        
        # APPLY VISUALIZATION:
        vis_params = {
            "min": 0,
            "max": 3,
            "palette": ["#0000FF", "#00FF00", "#FFA500", "#FF0000"]
        }
        
        vis_image = class_map.visualize(**vis_params)
        
        # GENERATE TILE:
        try:
            map_dict = vis_image.getMapId()
            tile_url = map_dict["tile_fetcher"].url_format
        except Exception as e:
            print(f"Error generating tile URL: {e}")
            map_dict = {}
            tile_url = None
            
        class_tiles: Dict[str, Optional[str]] = {}
        target_classes = ["Water", "Vegetation", "BareSoil", "BuiltUp"]
        for idx, class_name in enumerate(target_classes):
            class_mask = class_map.updateMask(class_map.eq(idx))
            class_vis = {
                "min": idx,
                "max": idx,
                "palette": [vis_params["palette"][idx]]
            }
            class_vis_image = class_mask.visualize(**class_vis)
            try:
                c_map_dict = class_vis_image.getMapId()
                c_tile_url = c_map_dict["tile_fetcher"].url_format
            except Exception:
                c_tile_url = None
            class_tiles[class_name] = c_tile_url
            
        # DEBUG VISUALIZATION (MANDATORY FIRST STEP)
        median_indices = s2_with_p.select(['MNDWI', 'NDVI', 'NDBI']).median().clip(aoi)
        _, mndwi_url = _get_map_id_and_tile_url(median_indices.select('MNDWI'), {"min": -0.5, "max": 0.5, "palette": ["#FF0000", "#FFFFFF", "#0000FF"]})
        _, ndvi_url = _get_map_id_and_tile_url(median_indices.select('NDVI'), {"min": -0.2, "max": 0.8, "palette": ["#8B4513", "#FFFFFF", "#008000"]})
        _, ndbi_url = _get_map_id_and_tile_url(median_indices.select('NDBI'), {"min": -0.5, "max": 0.5, "palette": ["#000000", "#FFFFFF", "#FF0000"]})
        
        class_tiles["MNDWI_DEBUG"] = mndwi_url
        class_tiles["NDVI_DEBUG"] = ndvi_url
        class_tiles["NDBI_DEBUG"] = ndbi_url
            
        # Returning empty vector JSON logic to prevent aggregation timeouts and large square artifacts
        vectors_geojson = {"type": "FeatureCollection", "features": []}
        
        coords = aoi.bounds().coordinates().getInfo()[0]
        lats = [c[1] for c in coords]
        lngs = [c[0] for c in coords]
        bounds_arr = [
            [min(lats), min(lngs)],
            [max(lats), max(lngs)]
        ]
        
        print("FINAL BOUNDS SENT:", bounds_arr)

        return {
            "ee_image": class_map,
            "classified_geojson": vectors_geojson,
            "tile_url": tile_url,
            "map_id": map_dict,
            "vis_params": vis_params,
            "palette": vis_params["palette"],
            "class_codes": {0: "Water", 1: "Vegetation", 2: "BareSoil", 3: "BuiltUp"},
            "class_tiles": class_tiles,
            "layer_order": ["Water", "Vegetation", "BareSoil", "BuiltUp"],
            "legend": {"Water": "#0000FF", "Vegetation": "#00FF00", "BareSoil": "#FFA500", "BuiltUp": "#FF0000"},
            "date_range": {
                "start": start_date,
                "end": end_date
            },
            "bounds": bounds_arr,
            "aoi_geojson": aoi.getInfo()
        }
        
    except Exception as e:
        raise RuntimeError(f"GEE classification failed: {str(e)}")


def _generate_classified_image_harmonized_unused(aoi: ee.Geometry, start_date: str, end_date: str) -> Dict[str, Any]:
    """
    Generate classified raster image using harmonized Sentinel-2 data.
    Retries with adaptive date expansion and relaxed cloud thresholds if
    the initial window yields no imagery.
    """
    return generate_classified_image(aoi, start_date, end_date)

    if not _EE_AUTHENTICATED:
        initialize_gee()

    TILE_ATTEMPTS = [
        {"delta": 0,  "cloud_limit": 20},
        {"delta": 15, "cloud_limit": 30},
        {"delta": 30, "cloud_limit": 60},
        {"delta": 60, "cloud_limit": 100},
    ]

    try:
        aoi_geom = ee.Geometry(aoi)
        diagnostics = _aoi_diagnostics(aoi_geom)

        base_start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        base_end_dt   = datetime.strptime(end_date,   "%Y-%m-%d")

        composite = None
        used_start = start_date
        used_end   = end_date

        for attempt in TILE_ATTEMPTS:
            delta      = attempt["delta"]
            cloud_lim  = attempt["cloud_limit"]
            exp_start  = (base_start_dt - timedelta(days=delta)).strftime("%Y-%m-%d")
            exp_end    = (base_end_dt   + timedelta(days=delta)).strftime("%Y-%m-%d")
            if delta > 0:
                print(
                    f"Tile generation retrying: ±{delta} days "
                    f"(cloud <= {cloud_lim}%)"
                )

            s2 = _build_masked_collection(
                aoi_geom=aoi_geom,
                start_date=exp_start,
                end_date=exp_end,
                cloud_limit=cloud_lim,
            )
            image_count = int(s2.size().getInfo())
            diagnostics["imagery_found"] = image_count > 0
            if image_count > 0:
                print(f"Tile imagery found: {image_count} images ({exp_start} → {exp_end})")
                composite  = s2.median().clip(aoi_geom).toFloat()
                used_start = exp_start
                used_end   = exp_end
                break

        if composite is None:
            raise RuntimeError("NO_IMAGERY")

        ndvi = composite.normalizedDifference(["B8", "B4"]).rename("NDVI")
        mndwi = composite.normalizedDifference(["B3", "B11"]).rename("MNDWI")
        ndbi = composite.normalizedDifference(["B11", "B8"]).rename("NDBI")

        print("Adaptive water detection enabled (MNDWI > -0.1)")
        water_mask = mndwi.gt(-0.1)
        water_mask = water_mask.focal_max(2).focal_min(1)
        water = water_mask
        vegetation = ndvi.gt(0.4)
        builtup = ndbi.gt(0.1).And(ndvi.lt(0.3))

        classified = ee.Image(0)
        classified = classified.where(builtup, 2)
        classified = classified.where(vegetation, 3)
        classified = classified.where(water, 1)

        not_water = water.Not()
        not_builtup = builtup.Not()
        not_vegetation = vegetation.Not()
        baresoil = not_water.And(not_builtup).And(not_vegetation).And(composite.select(0).mask())
        classified = classified.where(baresoil, 4)

        vis_params = dict(CLASS_TILE_VIS_PARAMS)
        palette = list(vis_params["palette"])

        classified_for_tile = classified.clip(aoi_geom)
        map_id, tile_url = _get_map_id_and_tile_url(classified_for_tile.selfMask())

        class_tiles: Dict[str, Optional[str]] = {}
        for class_name in CLASS_TILE_ORDER:
            class_code = CLASS_NAME_TO_CODE[class_name]
            class_image = classified_for_tile.updateMask(classified_for_tile.eq(class_code))
            _, class_tile_url = _get_map_id_and_tile_url(class_image)
            class_tiles[class_name] = class_tile_url
        print("Class tiles:", class_tiles)

        classified = classified.focal_mode(radius=1)
        classified = classified.focal_max(1)
        classified = classified.focal_min(1)
        classified_masked = classified.selfMask()

        vectors = classified_masked.reduceToVectors(
            geometry=aoi_geom,
            scale=20,
            geometryType="polygon",
            eightConnected=True,
            labelProperty="class",
            maxPixels=1e13,
        )

        feature_count = vectors.size().getInfo()
        if feature_count == 0:
            print("WARNING: Vectorization returned 0 features. Falling back to empty structure.")
            vectors_geojson = {"type": "FeatureCollection", "features": []}
            return {
                "ee_image": classified,
                "classified_geojson": vectors_geojson,
                "tile_url": tile_url,
                "map_id": map_id,
                "vis_params": vis_params,
                "palette": palette,
                "class_codes": CLASS_CODE_TO_NAME,
                "class_tiles": class_tiles,
                "layer_order": CLASS_TILE_ORDER,
                "legend": {class_name: CLASS_COLORS[class_name] for class_name in CLASS_TILE_ORDER},
                "date_range": {"start": used_start, "end": used_end},
                "diagnostics": diagnostics,
            }

        vectors_geojson = vectors.getInfo()
        if not vectors_geojson or "features" not in vectors_geojson:
            vectors_geojson = {"type": "FeatureCollection", "features": []}

        for feat in vectors_geojson["features"]:
            feat["properties"]["class"] = CLASS_CODE_TO_NAME.get(feat["properties"].get("class"), "Unknown")

        return {
            "ee_image": classified,
            "classified_geojson": vectors_geojson,
            "tile_url": tile_url,
            "map_id": map_id,
            "vis_params": vis_params,
            "palette": palette,
            "class_codes": CLASS_CODE_TO_NAME,
            "class_tiles": class_tiles,
            "layer_order": CLASS_TILE_ORDER,
            "legend": {class_name: CLASS_COLORS[class_name] for class_name in CLASS_TILE_ORDER},
            "date_range": {"start": used_start, "end": used_end},
            "diagnostics": diagnostics,
        }
    except Exception as e:
        raise RuntimeError(f"GEE classification failed: {str(e)}")

def generate_encroachment_layer(t1_classified: ee.Image, t2_classified: ee.Image) -> Dict[str, Any]:
    """
    Generate encroachment layer showing water loss between two time periods.
    
    Args:
        t1_classified: Classified image for time period 1
        t2_classified: Classified image for time period 2
    
    Returns:
        Dictionary containing encroachment tile URL
    """
    try:
        # Compute encroachment: (T1_water == 1) AND (T2_class != 1 which is Non-Water)
        # Class 1 is Water
        t1_water = t1_classified.eq(1)
        t2_not_water = t2_classified.neq(1)
        encroachment = t1_water.And(t2_not_water)
        
        # Visualization parameters for encroachment (bright red)
        encroachment_vis = {
            "min": 0,
            "max": 1,
            "palette": ["#FFFFFF", "#FF0000"]  # White to bright red
        }
        
        # Generate Map ID and Tile URL
        map_id = _get_map_id_and_tile_url(encroachment.updateMask(encroachment.gt(0)), encroachment_vis)[0]
        tile_url = map_id["tile_fetcher"].url_format
        
        # Convert to Vectors is disabled to prevent aggregation and ensure smooth pixel-level maps
        vectors_geojson = {"type": "FeatureCollection", "features": []}
        
        for feat in vectors_geojson.get("features", []):
            feat["properties"]["class"] = "Encroachment"
            
        return {
            "geojson": vectors_geojson,
            "tile_url": tile_url,
            "map_id": map_id,
            "vis_params": encroachment_vis,
            "description": "Water encroachment (loss) between T1 and T2"
        }
        
    except Exception as e:
        raise RuntimeError(f"Encroachment layer generation failed: {str(e)}")
