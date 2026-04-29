"""
Shared deterministic configuration for the rebuilt encroachment pipeline.
"""

from __future__ import annotations

from pathlib import Path
from typing import Dict, List


PROJECT_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = Path(__file__).resolve().parent
MODELS_DIR = PROJECT_ROOT / "models"

SYSTEM_PIPELINE_VERSION_FILE = PROJECT_ROOT / "SYSTEM_PIPELINE_VERSION.txt"

FEATURE_ORDER: List[str] = ["Green", "MNDWI", "NDBI", "NDVI", "NIR", "Red", "SWIR"]
CLASS_NAMES: List[str] = ["BareSoil", "BuiltUp", "Vegetation", "Water"]

S2_COLLECTION_ID = "COPERNICUS/S2_SR_HARMONIZED"
# SCL classes retained for clear-sky analysis
# 4: Vegetation, 5: Not Vegetated, 6: Water, 7: Unclassified
S2_SCL_CLEAR_CLASSES: List[int] = [4, 5, 6, 7]

BASE_TILE_SIZE_DEG = 0.05
MEDIUM_TILE_SIZE_DEG = 0.02
SMALL_TILE_SIZE_DEG = 0.01
TARGET_PIXELS_PER_TILE = 2000
SAMPLE_PIXEL_CAP_PER_TILE = 3000

CLASS_COLORS: Dict[str, str] = {
    "Water": "#0000FF",       # Blue
    "Tree": "#006400",        # Dark Green
    "Grassland": "#FFFF00",   # Yellow
    "BuiltUp": "#FF0000",     # Red
    "BareLand": "#808080",    # Gray
    "Vegetation": "#2e8b57",  # Existing
    "BareSoil": "#fdae61",    # Existing
}

STAGE_VERSIONS: Dict[str, str] = {
    "phase_1_training": "phase1.training.v1",
    "phase_2_feature_extraction": "phase2.gee_shoreline.v1",
    "phase_3_inference": "phase3.inference_domain_guard.v1",
    "phase_4_change_detection": "phase4.persistence_change.v1",
    "phase_5_api": "phase5.api_contract.v1",
    "phase_6_viewer": "phase6.temporal_viewer.v1",
    "phase_7_validation": "phase7.parity_validation.v1",
}


def read_system_pipeline_version() -> str:
    if not SYSTEM_PIPELINE_VERSION_FILE.exists():
        return "UNSET"
    return SYSTEM_PIPELINE_VERSION_FILE.read_text(encoding="utf-8").strip()
