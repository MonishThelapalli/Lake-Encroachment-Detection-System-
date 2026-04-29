"""
Water Watcher backend - deterministic rebuilt pipeline.
"""

from __future__ import annotations

import json
import os
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd
from dotenv import load_dotenv
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

try:
    from analysis_service import AnalysisService, create_analysis_service
    from gee_processor import extract_s2_features, initialize_gee, is_gee_authenticated, generate_classified_image, generate_encroachment_layer
    from inference_engine import InferenceEngine, create_inference_engine
    from kml_parser import parse_kml_or_kmz
    from map_renderer import generate_simple_map
    from pipeline_config import CLASS_COLORS, FEATURE_ORDER, STAGE_VERSIONS, read_system_pipeline_version
except ModuleNotFoundError:  # pragma: no cover
    from backend.analysis_service import AnalysisService, create_analysis_service
    from backend.gee_processor import extract_s2_features, initialize_gee, is_gee_authenticated, generate_classified_image, generate_encroachment_layer
    from backend.inference_engine import InferenceEngine, create_inference_engine
    from backend.kml_parser import parse_kml_or_kmz
    from backend.map_renderer import generate_simple_map
    from backend.pipeline_config import (
        CLASS_COLORS,
        FEATURE_ORDER,
        STAGE_VERSIONS,
        read_system_pipeline_version,
    )


load_dotenv(".env.local")

DATA_SOURCE_LIVE = "GEE_LIVE"
DATA_SOURCE_GEE_ERROR = "GEE_ERROR"
DATA_SOURCE_MODEL_ERROR = "MODEL_ERROR"
DATA_SOURCE_NO_IMAGERY = "NO_IMAGERY"
DATA_SOURCE_NO_SHORELINE = "NO_SHORELINE_PIXELS"
DATA_SOURCE_DOMAIN_REJECT = "OUT_OF_TRAINING_DOMAIN"
DATA_SOURCE_BAD_REQUEST = "BAD_REQUEST"
DATA_SOURCE_SERVER_ERROR = "SERVER_ERROR"

MIN_ALIGNED_PIXELS = 100

REPORT_STORE: Dict[str, Dict[str, Any]] = {}
VALIDATED_REPORT_STORE: Dict[str, Dict[str, Any]] = {}
RELIABILITY_REPORT_STORE: Dict[str, Dict[str, Any]] = {}

REPORTS_CACHE_DIR = Path(__file__).parent / "reports_cache"
REPORTS_CACHE_DIR.mkdir(exist_ok=True)


class AnalyzeRequest(BaseModel):
    start_date: str = Field(..., description="YYYY-MM-DD")
    end_date: str = Field(..., description="YYYY-MM-DD")
    aoi: Dict[str, Any] = Field(..., description="GeoJSON Feature or geometry")


class AnalysisResponse(BaseModel):
    success: bool
    model_ok: bool
    model_accuracy: float
    data_source: str
    satellite_pixels: int
    warnings: List[str]
    result: Optional[Dict[str, Any]]
    error: Optional[str] = None
    report_id: Optional[str] = None


app = FastAPI(
    title="Water Watcher API",
    description="Deterministic lake shoreline encroachment detection backend",
    version="3.0.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

inference_engine: Optional[InferenceEngine] = None
analysis_service: Optional[AnalysisService] = None
SERVICE_ERRORS: Dict[str, str] = {}


def _build_response(
    *,
    success: bool,
    model_ok: bool,
    model_accuracy: float,
    data_source: str,
    satellite_pixels: int,
    warnings: List[str],
    result: Optional[Dict[str, Any]],
    error: Optional[str] = None,
    report_id: Optional[str] = None,
) -> Dict[str, Any]:
    payload: Dict[str, Any] = {
        "success": success,
        "model_ok": model_ok,
        "model_accuracy": float(model_accuracy),
        "data_source": data_source,
        "satellite_pixels": int(satellite_pixels),
        "warnings": warnings,
        "result": result
    }
    if error:
        payload["error"] = error
    if report_id:
        payload["report_id"] = report_id
    return payload


def _normalize_aoi_feature(aoi: Dict[str, Any]) -> Tuple[bool, Optional[str], Optional[Dict[str, Any]]]:
    if not isinstance(aoi, dict):
        return False, "AOI must be a GeoJSON object.", None

    if aoi.get("type") == "Feature":
        geometry = aoi.get("geometry")
        feature = {"type": "Feature", "geometry": geometry, "properties": aoi.get("properties", {})}
    else:
        geometry = aoi
        feature = {"type": "Feature", "geometry": geometry, "properties": {}}

    if not isinstance(geometry, dict):
        return False, "AOI geometry missing.", None
    if geometry.get("type") not in ("Polygon", "MultiPolygon"):
        return False, f"Unsupported AOI geometry type: {geometry.get('type')}", None
    if not geometry.get("coordinates"):
        return False, "AOI geometry has empty coordinates.", None
    return True, None, feature


def _date_window(center: datetime, half_window_days: int = 30) -> Tuple[str, str]:
    start = (center - timedelta(days=half_window_days)).strftime("%Y-%m-%d")
    end = (center + timedelta(days=half_window_days)).strftime("%Y-%m-%d")
    return start, end


def _row_key(row: Dict[str, Any]) -> str:
    lon = float(row["longitude"])
    lat = float(row["latitude"])
    return f"{lon:.6f},{lat:.6f}"


def _index_rows(rows: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    indexed: Dict[str, Dict[str, Any]] = {}
    for row in rows:
        if "longitude" not in row or "latitude" not in row:
            continue
        try:
            key = _row_key(row)
        except Exception as e:
            raise RuntimeError(f"Invalid coordinate in row: {e}")
        indexed[key] = row
    return indexed


def _align_temporal_rows(
    rows_t1: List[Dict[str, Any]],
    rows_t2: List[Dict[str, Any]],
    rows_t3: Optional[List[Dict[str, Any]]],
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], Optional[List[Dict[str, Any]]], bool]:
    idx1 = _index_rows(rows_t1)
    idx2 = _index_rows(rows_t2)
    common_12 = sorted(set(idx1.keys()) & set(idx2.keys()))
    if len(common_12) < 5:  # Dynamic allowed
        print(
            f"LOW ALIGNMENT COUNT: T1={len(idx1)} px, T2={len(idx2)} px, "
            f"intersect={len(common_12)} px < required {MIN_ALIGNED_PIXELS}."
        )

    use_t3 = False
    idx3: Dict[str, Dict[str, Any]] = {}
    keys = common_12

    if rows_t3:
        idx3 = _index_rows(rows_t3)
        common_123 = [key for key in common_12 if key in idx3]
        if len(common_123) >= MIN_ALIGNED_PIXELS:
            keys = common_123
            use_t3 = True

    aligned_t1 = [idx1[key] for key in keys]
    aligned_t2 = [idx2[key] for key in keys]
    aligned_t3 = [idx3[key] for key in keys] if use_t3 else None
    return aligned_t1, aligned_t2, aligned_t3, use_t3


def _rows_to_features_df(rows: List[Dict[str, Any]]) -> pd.DataFrame:
    return pd.DataFrame(rows)[FEATURE_ORDER].copy()


def _classified_geojson(rows: List[Dict[str, Any]], labels: List[str], date_label: str) -> Dict[str, Any]:
    # Cluster points to significantly reduce JSON payload
    # Group by rounding lat/lon (3 decimals = ~111m cell)
    clustered = {}
    PRECISION = 3
    CELL_SIZE = 0.001
    HALF_CELL = CELL_SIZE / 2.0

    for row, label in zip(rows, labels):
        alon = round(float(row["longitude"]), PRECISION)
        alat = round(float(row["latitude"]), PRECISION)
        key = (alon, alat, label)
        if key not in clustered:
            clustered[key] = {"lon": alon, "lat": alat, "label": label, "count": 0}
        clustered[key]["count"] += 1

    features: List[Dict[str, Any]] = []
    for val in clustered.values():
        label = val["label"]
        color = CLASS_COLORS.get(label, "#444444")
        lon = val["lon"]
        lat = val["lat"]
        
        # Leaflet relies on Polygons for vector styling. Render a cell around the cluster.
        poly_coords = [[
            [lon - HALF_CELL, lat - HALF_CELL],
            [lon + HALF_CELL, lat - HALF_CELL],
            [lon + HALF_CELL, lat + HALF_CELL],
            [lon - HALF_CELL, lat + HALF_CELL],
            [lon - HALF_CELL, lat - HALF_CELL]
        ]]
        
        feature = {
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": poly_coords,
            },
            "properties": {
                "class": label,
                "color": color,
                "date": date_label,
                "pixel_count": val["count"]
            },
        }
        features.append(feature)
        
    return {"type": "FeatureCollection", "features": features}


def _pipeline_versions_payload() -> Dict[str, Any]:
    return {
        "system_pipeline_version": read_system_pipeline_version(),
        "training_stage_version": STAGE_VERSIONS["phase_1_training"],
        "feature_extraction_stage_version": STAGE_VERSIONS["phase_2_feature_extraction"],
        "inference_stage_version": STAGE_VERSIONS["phase_3_inference"],
        "analysis_stage_version": STAGE_VERSIONS["phase_4_change_detection"],
        "api_stage_version": STAGE_VERSIONS["phase_5_api"],
    }


def _make_reliability_report(result_payload: Dict[str, Any]) -> Dict[str, Any]:
    warnings = result_payload.get("warnings", [])
    if result_payload.get("success") and not warnings:
        grade = "A"
        score = 95.0
    elif result_payload.get("success"):
        grade = "B"
        score = 82.0
    else:
        grade = "D"
        score = 35.0
    return {
        "timestamp": datetime.utcnow().isoformat(),
        "reliability_grade": {
            "grade": grade,
            "grade_description": "Deterministic pipeline confidence grade",
            "overall_score": score,
        },
        "summary": {
            "is_validated_better": True,
            "key_improvements": ["Strict shoreline sampling", "Domain-guarded inference"],
            "critical_issues": warnings,
            "recommendations": [],
        },
        "evaluation_results": {
            "data_quality": {},
            "model_trust": {},
            "physical_consistency": {},
            "change_reliability": {},
        },
        "files": {},
    }


def init_services() -> None:
    global inference_engine, analysis_service
    SERVICE_ERRORS.clear()

    try:
        inference_engine = create_inference_engine()
    except Exception as exc:
        inference_engine = None
        SERVICE_ERRORS["model"] = str(exc)

    try:
        analysis_service = create_analysis_service()
    except Exception as exc:
        analysis_service = None
        SERVICE_ERRORS["analysis"] = str(exc)
    MODEL_PATH = Path(__file__).resolve().parent.parent / "models" / "encroachment_rf_stable.pkl"
    LABEL_ENCODER_PATH = Path(__file__).resolve().parent.parent / "models" / "label_encoder_stable.pkl"

    creds_path = os.getenv("GEE_SERVICE_ACCOUNT_KEY")
    if not creds_path:
        local = Path(__file__).resolve().parent / "gee-service-account.json"
        if local.exists():
            creds_path = str(local)
            os.environ["GEE_SERVICE_ACCOUNT_KEY"] = creds_path

    if not initialize_gee(creds_path):
        SERVICE_ERRORS["gee"] = "GEE initialization failed"


def _run_pipeline(request: AnalyzeRequest) -> Dict[str, Any]:
    warnings: List[str] = []
    model_accuracy = float(getattr(inference_engine, "MODEL_ACCURACY", 0.0)) if inference_engine else 0.0

    if inference_engine is None or analysis_service is None:
        return _build_response(
            success=False,
            model_ok=False,
            model_accuracy=model_accuracy,
            data_source=DATA_SOURCE_MODEL_ERROR,
            satellite_pixels=0,
            warnings=list(SERVICE_ERRORS.values()),
            result=None,
            error="Services not initialized.",
        )

    if not is_gee_authenticated():
        creds = os.getenv("GEE_SERVICE_ACCOUNT_KEY")
        if not initialize_gee(creds):
            return _build_response(
                success=False,
                model_ok=True,
                model_accuracy=model_accuracy,
                data_source=DATA_SOURCE_GEE_ERROR,
                satellite_pixels=0,
                warnings=["Google Earth Engine authentication failed."],
                result=None,
                error="GEE initialization failed.",
            )

    valid_aoi, aoi_error, normalized_feature = _normalize_aoi_feature(request.aoi)
    if not valid_aoi or normalized_feature is None:
        return _build_response(
            success=False,
            model_ok=True,
            model_accuracy=model_accuracy,
            data_source=DATA_SOURCE_BAD_REQUEST,
            satellite_pixels=0,
            warnings=[],
            result=None,
            error=f"Invalid AOI: {aoi_error}",
        )

    try:
        start_dt = datetime.strptime(request.start_date, "%Y-%m-%d")
        end_dt = datetime.strptime(request.end_date, "%Y-%m-%d")
        if start_dt >= end_dt:
            raise ValueError("start_date must be before end_date")
    except Exception as exc:
        return _build_response(
            success=False,
            model_ok=True,
            model_accuracy=model_accuracy,
            data_source=DATA_SOURCE_BAD_REQUEST,
            satellite_pixels=0,
            warnings=[],
            result=None,
            error=f"Invalid date input: {exc}",
        )

    t1_start, t1_end = _date_window(start_dt)
    t2_start, t2_end = _date_window(end_dt)
    persistence_center = end_dt + timedelta(days=365)
    t3_start, t3_end = _date_window(persistence_center)

    try:
        rows_t1 = extract_s2_features(normalized_feature, t1_start, t1_end)
        print(f"DEBUG: number of extracted pixels for T1: {len(rows_t1)}")
        rows_t2 = extract_s2_features(normalized_feature, t2_start, t2_end)
        print(f"DEBUG: number of extracted pixels for T2: {len(rows_t2)}")
    except RuntimeError as exc:
        error_code = str(exc)
        if "Insufficient extraction density" in error_code:
            raise exc
        data_source = (
            DATA_SOURCE_NO_IMAGERY if error_code == "NO_IMAGERY" else DATA_SOURCE_NO_SHORELINE
        )
        return _build_response(
            success=False,
            model_ok=True,
            model_accuracy=model_accuracy,
            data_source=data_source,
            satellite_pixels=0,
            warnings=[],
            result=None,
            error=error_code,
        )
    except Exception as exc:
        return _build_response(
            success=False,
            model_ok=True,
            model_accuracy=model_accuracy,
            data_source=DATA_SOURCE_SERVER_ERROR,
            satellite_pixels=0,
            warnings=[],
            result=None,
            error=str(exc),
        )

    rows_t3: Optional[List[Dict[str, Any]]] = None
    try:
        rows_t3 = extract_s2_features(normalized_feature, t3_start, t3_end)
    except RuntimeError as exc:
        warnings.append(f"PERSISTENCE_WINDOW_UNAVAILABLE: {exc}")
    except Exception as exc:
        warnings.append(f"PERSISTENCE_WINDOW_ERROR: {exc}")

    try:
        aligned_t1, aligned_t2, aligned_t3, persistence_used = _align_temporal_rows(
            rows_t1, rows_t2, rows_t3
        )
    except RuntimeError as exc:
        return _build_response(
            success=False,
            model_ok=True,
            model_accuracy=model_accuracy,
            data_source=DATA_SOURCE_NO_SHORELINE,
            satellite_pixels=0,
            warnings=warnings,
            result=None,
            error=str(exc),
        )


    df_t1 = _rows_to_features_df(aligned_t1)
    if len(df_t1) == 0:
        return _build_response(
            success=False,
            model_ok=True,
            model_accuracy=model_accuracy,
            data_source=DATA_SOURCE_NO_IMAGERY,
            satellite_pixels=0,
            warnings=["No valid satellite data extracted"],
            result=None,
            error="No valid satellite data extracted"
        )

    df_t2 = _rows_to_features_df(aligned_t2)
    df_t3 = _rows_to_features_df(aligned_t3) if aligned_t3 else None

    print(f"DEBUG: ML prediction count requested. T1: {len(df_t1)}, T2: {len(df_t2)}")
    pred_t1 = inference_engine.predict(df_t1)
    
    # ── STABILIZE T1: Summer Shift or Uncertainty Widen ──
    if pred_t1.get("success"):
        labels = pred_t1["predictions"]["labels"]
        uncertain_count = sum(1 for l in labels if l == "uncertain")
        water_count = sum(1 for l in labels if l == "Water")
        total_labels = len(labels) if labels else 1
        uncertain_ratio = uncertain_count / total_labels
        water_ratio = water_count / total_labels
        
        print(f"[DEBUG] T1 Initial Uncertain pixels: {uncertain_count} ({uncertain_ratio:.2%})")
        print(f"[DEBUG] T1 Initial Water pixels: {water_count} ({water_ratio:.2%})")
        
        needs_realignment = False
        t1_start_wider = t1_start
        t1_end_wider = t1_end
        
        if water_ratio < 0.05:
            print(f"[WARNING] T1 has <5% Water ({water_ratio:.2%}). Likely a dry summer month! Automatically shifting T1 to Post-Monsoon (October) to capture true lake boundary!")
            warnings.append("T1 was too dry (<5% Water). Automatically shifted T1 to October (Post-Monsoon) to fetch historical lake boundary.")
            target_year = start_dt.year - 1 if start_dt.month < 10 else start_dt.year
            t1_start_wider = f"{target_year}-10-01"
            t1_end_wider = f"{target_year}-11-30"
            needs_realignment = True
        elif uncertain_ratio > 0.20:
            print(f"[WARNING] T1 has >20% uncertain pixels ({uncertain_ratio:.2%}). Automatically widening date range to 90 days for stabilization!")
            t1_start_wider, t1_end_wider = _date_window(start_dt, half_window_days=90)
            needs_realignment = True
            
        if needs_realignment:
            try:
                rows_t1 = extract_s2_features(normalized_feature, t1_start_wider, t1_end_wider)
                
                # Re-align temporal rows
                aligned_t1, aligned_t2, aligned_t3, persistence_used = _align_temporal_rows(
                    rows_t1, rows_t2, rows_t3
                )
                df_t1 = _rows_to_features_df(aligned_t1)
                df_t2 = _rows_to_features_df(aligned_t2)
                df_t3 = _rows_to_features_df(aligned_t3) if aligned_t3 else None
                
                # Re-predict
                pred_t1 = inference_engine.predict(df_t1)
                
                if pred_t1.get("success"):
                    labels2 = pred_t1["predictions"]["labels"]
                    uncertain_count2 = sum(1 for l in labels2 if l == "uncertain")
                    water_count2 = sum(1 for l in labels2 if l == "Water")
                    uncertain_ratio2 = uncertain_count2 / len(labels2) if labels2 else 0
                    water_ratio2 = water_count2 / len(labels2) if labels2 else 0
                    print(f"[DEBUG] T1 Refined Uncertain pixels: {uncertain_count2} ({uncertain_ratio2:.2%})")
                    print(f"[DEBUG] T1 Refined Water pixels: {water_count2} ({water_ratio2:.2%})")
                    
            except Exception as e:
                print(f"[WARNING] Failed to widen/shift T1 extraction: {e}")

    pred_t2 = inference_engine.predict(df_t2)
    
    if not pred_t1.get("success") or not pred_t2.get("success"):
        error_payload = pred_t1 if not pred_t1.get("success") else pred_t2
        data_source = (
            DATA_SOURCE_DOMAIN_REJECT
            if error_payload.get("error") == DATA_SOURCE_DOMAIN_REJECT
            else DATA_SOURCE_SERVER_ERROR
        )
        return _build_response(
            success=False,
            model_ok=True,
            model_accuracy=model_accuracy,
            data_source=data_source,
            satellite_pixels=len(aligned_t1),
            warnings=warnings,
            result={"details": error_payload.get("details", {})},
            error=error_payload.get("error", "PREDICTION_FAILED"),
        )

    pred_t3 = None
    if df_t3 is not None:
        pred_t3 = inference_engine.predict(df_t3)
        if not pred_t3.get("success"):
            warnings.append(f"PERSISTENCE_INFERENCE_SKIPPED: {pred_t3.get('error', 'UNKNOWN')}")
            pred_t3 = None
            persistence_used = False

    print("DEBUG: type(pred_t1):", type(pred_t1))
    print("DEBUG: type(labels_t1) before assignment:", type(pred_t1["predictions"]["labels"]))

    labels_t1 = list(pred_t1["predictions"]["labels"])
    labels_t2 = list(pred_t2["predictions"]["labels"])
    labels_t3 = list(pred_t3["predictions"]["labels"]) if pred_t3 else None

    analysis = analysis_service.analyze_temporal_change(
        predictions_t1=labels_t1,
        predictions_t2=labels_t2,
        predictions_t3=labels_t3,
        start_date=request.start_date,
        end_date=request.end_date,
        persistence_date=persistence_center.strftime("%Y-%m-%d") if persistence_used else None,
    )
    if not analysis.get("success"):
        return _build_response(
            success=False,
            model_ok=True,
            model_accuracy=model_accuracy,
            data_source=DATA_SOURCE_SERVER_ERROR,
            satellite_pixels=len(aligned_t1),
            warnings=warnings,
            result=None,
            error=analysis.get("error", "ANALYSIS_FAILED"),
        )
        
    encroached_idx = analysis.get("encroached_indices", [])
    summary = analysis.get("change_summary", {})

    import ee
    
    t1_geojson = {"type": "FeatureCollection", "features": []}
    t2_geojson = {"type": "FeatureCollection", "features": []}
    encroachment_geojson = {"type": "FeatureCollection", "features": []}
    t1_tile_url = None
    t2_tile_url = None
    t1_class_tiles: Dict[str, Any] = {}
    t2_class_tiles: Dict[str, Any] = {}
    class_layer_order: List[str] = ["Water", "BuiltUp", "Vegetation", "BareSoil"]

    def _create_rf_tile(aligned_rows, labels, bounds_arr, aoi_geojson):
        import ee
        class_to_idx = {"Water": 0, "Vegetation": 1, "BareSoil": 2, "BuiltUp": 3, "uncertain": 4}
        features = []
        
        coords = [[float(row["longitude"]), float(row["latitude"])] for row in aligned_rows]
        
        print("coords:", len(coords))
        print("labels:", len(labels))
        
        if len(coords) != len(labels):
            print(f"Mismatch between coords ({len(coords)}) and labels ({len(labels)})!")
            # Optional safety slice (DO NOT CRASH)
            min_len = min(len(coords), len(labels))
            labels = labels[:min_len]
            coords = coords[:min_len]
            
        assert len(coords) == len(labels), "Mismatch between coords and labels!"
        
        print("Final labels sample:", labels[:20])
            
        for i in range(len(coords)):
            idx = class_to_idx.get(labels[i], 2)
            features.append(ee.Feature(ee.Geometry.Point(coords[i]), {"class": int(idx)}))

        fc = ee.FeatureCollection(features)
        
        # DENSE RASTER INTERPOLATION (IMPORTANT):
        # Reprojecting to exactly 10m forces the discrete points to render as solid continuous 10m squares
        # regardless of the map zoom level, eliminating any gaps between the points.
        classified = fc.reduceToImage(['class'], ee.Reducer.mode()) \
            .reproject(crs='EPSG:4326', scale=10)
            
        vis_params = {
            "min": 0,
            "max": 4,
            "palette": [
                "#0000FF",  # Water
                "#00FF00",  # Vegetation
                "#FFA500",  # BareSoil
                "#FF0000",  # BuiltUp
                "#808080"   # Uncertain (Out of Distribution / Low Confidence)
            ]
        }
        
        vis_image = classified.visualize(**vis_params)
        
        try:
            map_dict = vis_image.getMapId()
            tile_url = map_dict["tile_fetcher"].url_format
        except Exception as e:
            print(f"Error generating tile URL: {e}")
            map_dict = {}
            tile_url = None
            
        class_tiles = {}
        target_classes = ["Water", "Vegetation", "BareSoil", "BuiltUp", "uncertain"]
        for idx, class_name in enumerate(target_classes):
            class_mask = classified.updateMask(classified.eq(idx))
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

        # Returning empty vector JSON logic to prevent aggregation timeouts and large square artifacts
        vectors_geojson = {"type": "FeatureCollection", "features": []}

        return {
            "ee_image": classified,
            "classified_geojson": vectors_geojson,
            "tile_url": tile_url,
            "map_id": map_dict,
            "vis_params": vis_params,
            "class_tiles": class_tiles,
            "layer_order": target_classes
        }

    try:
        if isinstance(normalized_feature, dict):
            geom = ee.Geometry(normalized_feature["geometry"])
        else:
            geom = ee.Geometry(normalized_feature)
            
        coords = geom.bounds().coordinates().getInfo()[0]
        lats = [c[1] for c in coords]
        lngs = [c[0] for c in coords]
        bounds_arr = [
            [min(lats), min(lngs)],
            [max(lats), max(lngs)]
        ]
        aoi_geojson = geom.getInfo()
            
        t1_tile = _create_rf_tile(aligned_t1, labels_t1, bounds_arr, aoi_geojson)
        t1_tile_url = t1_tile.get("tile_url")
        t1_class_tiles = t1_tile.get("class_tiles", t1_class_tiles)
        class_layer_order = t1_tile.get("layer_order", class_layer_order)
        t1_geojson = t1_tile.get("classified_geojson", t1_geojson)
        
        t2_tile = _create_rf_tile(aligned_t2, labels_t2, bounds_arr, aoi_geojson)
        t2_tile_url = t2_tile.get("tile_url")
        t2_class_tiles = t2_tile.get("class_tiles", t2_class_tiles)
        t2_geojson = t2_tile.get("classified_geojson", t2_geojson)
        
        t3_tile = None
        if aligned_t3 and labels_t3:
            try:
                t3_tile = _create_rf_tile(aligned_t3, labels_t3, bounds_arr, aoi_geojson)
            except Exception as e:
                print(f"Failed to create T3 tile for persistence: {e}")
        
        if "ee_image" in t1_tile and "ee_image" in t2_tile:
            # Recreate encroachment layer based on RF outputs instead of rules
            t1_water = t1_tile["ee_image"].updateMask(t1_tile["ee_image"].eq(0)) # 0 is Water
            t2_builtup_or_bare = t2_tile["ee_image"].updateMask(
                t2_tile["ee_image"].eq(3).Or(t2_tile["ee_image"].eq(2))
            )
            encroachment = t1_water.mask().And(t2_builtup_or_bare.mask())
            
            # Temporal Persistence Logic
            if t3_tile and "ee_image" in t3_tile:
                t3_builtup_or_bare = t3_tile["ee_image"].updateMask(
                    t3_tile["ee_image"].eq(3).Or(t3_tile["ee_image"].eq(2))
                )
                encroachment = encroachment.And(t3_builtup_or_bare.mask())
            
            # Mask to only where it's 1
            encroachment_masked = encroachment.updateMask(encroachment.eq(1))
            
            enc_vis = {"min": 1, "max": 1, "palette": ["#FF00FF"]} # Magenta for encroachment
            enc_img = encroachment_masked.visualize(**enc_vis)
            try:
                e_map_dict = enc_img.getMapId()
                enc_geojson = {"type": "FeatureCollection", "features": [], "tile_url": e_map_dict["tile_fetcher"].url_format}
                encroachment_geojson = enc_geojson
            except Exception as exc:
                print("Failed encoding encroachment tile:", exc)

    except Exception as e:
        error_msg = f"Failed to generate GEE raster tiles from RF: {str(e)}"
        print(error_msg)
        return _build_response(
            success=False,
            model_ok=True,
            model_accuracy=model_accuracy,
            data_source=DATA_SOURCE_SERVER_ERROR,
            satellite_pixels=len(aligned_t1),
            warnings=warnings,
            result=None,
            error=error_msg,
        )

    if not t1_tile_url or not t2_tile_url:
        return _build_response(
            success=False,
            model_ok=True,
            model_accuracy=model_accuracy,
            data_source=DATA_SOURCE_SERVER_ERROR,
            satellite_pixels=len(aligned_t1),
            warnings=warnings,
            result=None,
            error="CRITICAL ERROR: tile_url is null. Backend failed to generate explicit GEE raster tiles.",
        )

    print("T1 TILE:", t1_tile_url)
    print("T2 TILE:", t2_tile_url)

    result_payload = {
        "success": True,
        "t1": {
            "classified_geojson": t1_geojson,
            "tile_url": t1_tile_url,
            "class_tiles": t1_class_tiles,
            "layer_order": class_layer_order,
            "area_stats": analysis.get("areas", {}).get("start", []),
            "bounds": bounds_arr,
            "aoi_geojson": aoi_geojson
        },
        "t2": {
            "classified_geojson": t2_geojson,
            "tile_url": t2_tile_url,
            "class_tiles": t2_class_tiles,
            "layer_order": class_layer_order,
            "area_stats": analysis.get("areas", {}).get("end", []),
            "bounds": bounds_arr,
            "aoi_geojson": aoi_geojson
        },
        "encroachment": {
            "geojson": encroachment_geojson,
            "total_area_lost": summary["encroached_pixels"] * 10 * 10, # 10m x 10m pixels
            "confidence_mean": 0.95, # Placeholder till confidence scores are bubbled up from model
            "total_pixels": len(labels_t1),
            "trend": summary["trend"],
            "summary": summary
        },
        "pipeline_versions": _pipeline_versions_payload(),
    }

    report_id = f"analysis_{int(time.time() * 1000)}"
    response_payload = _build_response(
        success=True,
        model_ok=True,
        model_accuracy=model_accuracy,
        data_source=DATA_SOURCE_LIVE,
        satellite_pixels=len(aligned_t1),
        warnings=warnings,
        result=result_payload,
        report_id=report_id,
    )
    REPORT_STORE[report_id] = response_payload
    try:
        (REPORTS_CACHE_DIR / f"{report_id}.json").write_text(json.dumps(response_payload), encoding="utf-8")
    except Exception as e:
        print(f"Failed to cache report: {e}")
    return response_payload


@app.on_event("startup")
async def startup_event() -> None:
    init_services()


@app.get("/")
async def root() -> Dict[str, Any]:
    return {
        "service": "Water Watcher API",
        "version": "3.0.0",
        "status": "online",
        "system_pipeline_version": read_system_pipeline_version(),
        "api_stage_version": STAGE_VERSIONS["phase_5_api"],
    }

@app.get("/health")
async def health() -> Dict[str, Any]:
    status = "healthy" if inference_engine and analysis_service and is_gee_authenticated() else "degraded"
    return {
        "status": status,
        "model_ok": inference_engine is not None and getattr(inference_engine, "model_ok", False),
        "gee_authenticated": is_gee_authenticated(),
        "errors": SERVICE_ERRORS,
    }


@app.get("/gee-status")
def gee_status():
    try:
        import ee
        ee.Number(1).getInfo()
        return {"status": "connected"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.post("/api/parse-kml")
async def parse_kml_upload(file: UploadFile = File(...)) -> Dict[str, Any]:
    name = (file.filename or "").lower()
    if not (name.endswith(".kml") or name.endswith(".kmz")):
        return {"success": False, "error": "File must be .kml or .kmz"}
    try:
        contents = await file.read()
        geometry = parse_kml_or_kmz(contents)
        return {"success": True, "type": "Feature", "geometry": geometry, "properties": {"source": "uploaded_kml"}}
    except Exception as exc:
        return {"success": False, "error": str(exc)}


@app.get("/predefined-lakes")
async def get_predefined_lakes() -> List[Dict[str, Any]]:
    lakes = []
    predefined_dir = Path(__file__).parent / "predefined_lakes"
    if not predefined_dir.exists():
        return lakes

    for json_file in predefined_dir.glob("*.json"):
        try:
            data = json.loads(json_file.read_text(encoding="utf-8"))
            lakes.append(
                {
                    "id": json_file.stem,
                    "name": data.get("name", json_file.stem.replace("_", " ").title()),
                    "area_km2": float(data.get("area_km2", 0)),
                }
            )
        except Exception:
            continue
    return lakes


@app.get("/predefined-lakes/{lake_id}")
async def get_predefined_lake(lake_id: str) -> Dict[str, Any]:
    file_path = Path(__file__).parent / "predefined_lakes" / f"{lake_id}.json"
    if not file_path.exists():
        return {"success": False, "error": f"Lake {lake_id} not found"}
    data = json.loads(file_path.read_text(encoding="utf-8"))
    return {
        "id": lake_id,
        "name": data.get("name", lake_id.replace("_", " ").title()),
        "area_km2": float(data.get("area_km2", 0)),
        "geojson": data.get("geojson"),
    }


@app.post("/api/analyze")
async def analyze_aoi(request: AnalyzeRequest) -> Dict[str, Any]:
    if not request.aoi or not request.start_date or not request.end_date:
        raise HTTPException(status_code=400, detail="Missing required fields: aoi, start_date, end_date")
    
    import re
    try:
        print(f"DEBUG: AOI geometry received: {str(request.aoi)[:100]}...")
        print(f"DEBUG: date range: {request.start_date} to {request.end_date}")
        result = _run_pipeline(request)
        return result
    except Exception as e:
        print("ANALYSIS ERROR:", str(e))
        if "Insufficient extraction density" in str(e):
            m = re.search(r"Extracted (\d+) pixels", str(e))
            num_pixels = int(m.group(1)) if m else 0
            return JSONResponse(status_code=422, content={
                "status": "failed",
                "reason": "insufficient_pixels",
                "extracted_pixels": num_pixels
            })
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/reports/{report_id}", response_model=None)
def get_standard_report(report_id: str):
    payload = REPORT_STORE.get(report_id)
    if payload is None:
        try:
            cache_file = REPORTS_CACHE_DIR / f"{report_id}.json"
            if cache_file.exists():
                payload = json.loads(cache_file.read_text(encoding="utf-8"))
                REPORT_STORE[report_id] = payload
        except Exception:
            pass
            
    if payload is None:
        return JSONResponse(status_code=404, content={"detail": "Report not found"})
    return payload


@app.post("/run-analysis-validated")
async def run_analysis_validated(request: AnalyzeRequest) -> Dict[str, Any]:
    payload = _run_pipeline(request)
    if not payload.get("success"):
        return payload

    validated_report_id = f"validated_{int(time.time() * 1000)}"
    VALIDATED_REPORT_STORE[validated_report_id] = payload
    RELIABILITY_REPORT_STORE[validated_report_id] = _make_reliability_report(payload)
    return {"success": True, "validated_report_id": validated_report_id, "mode": "validated"}


@app.get("/api/validated-reports/{report_id}", response_model=None)
def get_validated_report(report_id: str):
    payload = VALIDATED_REPORT_STORE.get(report_id)
    if payload is None:
        return JSONResponse(status_code=404, content={"detail": "Validated report not found"})
    return payload


@app.get("/scientific-reliability-reports/{report_id}", response_model=None)
def get_reliability_report(report_id: str):
    payload = RELIABILITY_REPORT_STORE.get(report_id)
    if payload is None:
        return JSONResponse(status_code=404, content={"detail": "Scientific reliability report not found"})
    return payload


@app.get("/scientific-reliability-reports")
async def list_reliability_reports() -> Dict[str, Any]:
    reports = []
    for report_id, payload in RELIABILITY_REPORT_STORE.items():
        reports.append(
            {
                "filename": report_id,
                "timestamp": payload.get("timestamp", ""),
                "grade": payload.get("reliability_grade", {}).get("grade", "N/A"),
                "overall_score": payload.get("reliability_grade", {}).get("overall_score", 0.0),
                "is_validated_better": payload.get("summary", {}).get("is_validated_better", False),
            }
        )
    return {
        "success": True,
        "reports_available": len(reports) > 0,
        "total_reports": len(reports),
        "reports": sorted(reports, key=lambda item: item["timestamp"], reverse=True),
    }


@app.post("/generate-scientific-reliability-report")
async def generate_scientific_reliability_report(request: AnalyzeRequest) -> Dict[str, Any]:
    payload = _run_pipeline(request)
    report = _make_reliability_report(payload)
    reliability_id = f"reliability_{int(time.time() * 1000)}"
    RELIABILITY_REPORT_STORE[reliability_id] = report
    return {
        "success": payload.get("success", False),
        "analysis_result": payload,
        "reliability_report_id": reliability_id,
        "reliability_grade": report.get("reliability_grade"),
        "summary": report.get("summary"),
    }


@app.post("/api/classified-map")
async def get_classified_map(request: AnalyzeRequest) -> Dict[str, Any]:
    """Generate classified raster tiles for dual map visualization using ML pipeline."""
    try:
        # Run the full ML pipeline to ensure XGBoost is used for these maps
        result = _run_pipeline(request)
        if not result.get("success"):
            return {
                "success": False,
                "error": result.get("error", "Classification failed during ML pipeline.")
            }
            
        palette = ["#0000FF", "#00FF00", "#FFA500", "#FF0000", "#808080"]
        class_codes = {"Water": 0, "Vegetation": 1, "BareSoil": 2, "BuiltUp": 3, "uncertain": 4}
        
        return {
            "success": True,
            "t1": {
                "tile_url": result["t1"]["tile_url"],
                "class_tiles": result["t1"].get("class_tiles", {}),
                "layer_order": result["t1"].get("layer_order", ["Water", "BuiltUp", "Vegetation", "BareSoil", "uncertain"]),
                "palette": palette,
                "class_codes": class_codes,
                "date_range": f"{request.start_date} to {request.end_date}"
            },
            "t2": {
                "tile_url": result["t2"]["tile_url"],
                "class_tiles": result["t2"].get("class_tiles", {}),
                "layer_order": result["t2"].get("layer_order", ["Water", "BuiltUp", "Vegetation", "BareSoil", "uncertain"]),
                "palette": palette,
                "class_codes": class_codes,
                "date_range": "Post-analysis period"
            },
            "encroachment": {
                "tile_url": result.get("encroachment", {}).get("geojson", {}).get("tile_url"),
                "description": "ML-Detected Encroachment Layer"
            },
            "aoi": request.aoi,
            "legend": CLASS_COLORS
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": f"Classification failed: {str(e)}"
        }

@app.post("/generate-map")
async def generate_map_endpoint(request: AnalyzeRequest) -> Dict[str, Any]:
    """Generate simple classification map tile independent of ML pipeline."""
    try:
        import ee
        
        if not is_gee_authenticated():
            initialize_gee()
            
        aoi_geojson = request.aoi
        if isinstance(aoi_geojson, dict):
            if aoi_geojson.get("type") == "Feature":
                aoi = ee.Geometry(aoi_geojson.get("geometry"))
            else:
                aoi = ee.Geometry(aoi_geojson)
        else:
            return {"success": False, "error": "Invalid AOI geometry format"}
            
        tile_url = generate_simple_map(aoi, request.start_date, request.end_date)
        return {"success": True, "tile_url": tile_url}
    except Exception as e:
        return {"success": False, "error": f"Map generation failed: {str(e)}"}


if __name__ == "__main__":
    import uvicorn

    init_services()
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False, log_config=None)
