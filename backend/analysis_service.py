"""
Phase 4 deterministic temporal change analysis service.
"""

from __future__ import annotations

from collections import Counter
from typing import Any, Dict, List, Optional, Tuple

try:
    from pipeline_config import CLASS_NAMES, STAGE_VERSIONS
except ModuleNotFoundError:  # pragma: no cover
    from backend.pipeline_config import CLASS_NAMES, STAGE_VERSIONS


ANALYSIS_STAGE_VERSION = STAGE_VERSIONS["phase_4_change_detection"]
LAND_CLASSES = ("BareSoil", "BuiltUp", "Vegetation")


class AnalysisService:
    CLASSES = CLASS_NAMES

    def _areas(self, labels: List[str]) -> List[Dict[str, Any]]:
        total = max(len(labels), 1)
        counts = Counter(labels)
        return [
            {
                "class": class_name,
                "pixel_count": int(counts.get(class_name, 0)),
                "percent": float(counts.get(class_name, 0) * 100.0 / total),
            }
            for class_name in self.CLASSES
        ]

    def _transitions(self, t1: List[str], t2: List[str]) -> List[Dict[str, Any]]:
        transition_counts = Counter(zip(t1, t2))
        rows: List[Dict[str, Any]] = []
        for (from_cls, to_cls), pixels in sorted(transition_counts.items()):
            if pixels <= 0:
                continue
            rows.append({"from": from_cls, "to": to_cls, "pixels": int(pixels)})
        return rows

    def _encroachment(
        self,
        t1: List[str],
        t2: List[str],
        t3: Optional[List[str]],
    ) -> Tuple[Dict[str, Any], List[int], List[int]]:
        water_to_land_candidates: List[int] = []
        encroached_idx: List[int] = []
        seasonal_idx: List[int] = []

        persistent_by_class = Counter()
        seasonal_by_class = Counter()

        for idx, (c1, c2) in enumerate(zip(t1, t2)):
            if c1 == "Water" and c2 in LAND_CLASSES:
                water_to_land_candidates.append(idx)
                if t3 is None:
                    seasonal_idx.append(idx)
                    seasonal_by_class[c2] += 1
                    continue

                c3 = t3[idx]
                if c3 in LAND_CLASSES:
                    encroached_idx.append(idx)
                    persistent_by_class[c2] += 1
                else:
                    seasonal_idx.append(idx)
                    seasonal_by_class[c2] += 1

        encroached_pixels = len(encroached_idx)
        seasonal_pixels = len(seasonal_idx)
        candidates = len(water_to_land_candidates)

        if encroached_pixels > 0:
            trend = "encroachment"
        elif seasonal_pixels > 0:
            trend = "seasonal_fluctuation"
        else:
            trend = "no_change"

        summary = {
            "baresoil_loss_pixels": int(persistent_by_class.get("BareSoil", 0)),
            "builtup_gain_pixels": int(persistent_by_class.get("BuiltUp", 0)),
            "vegetation_gain_pixels": int(persistent_by_class.get("Vegetation", 0)),
            "seasonal_baresoil_pixels": int(seasonal_by_class.get("BareSoil", 0)),
            "seasonal_builtup_pixels": int(seasonal_by_class.get("BuiltUp", 0)),
            "seasonal_vegetation_pixels": int(seasonal_by_class.get("Vegetation", 0)),
            "water_to_land_candidates": int(candidates),
            "seasonal_fluctuation_pixels": int(seasonal_pixels),
            "total_encroachment_pixels": int(encroached_pixels),
            "encroached_pixels": int(encroached_pixels),
            "trend": trend,
        }
        return summary, encroached_idx, seasonal_idx

    def analyze_temporal_change(
        self,
        predictions_t1: List[str],
        predictions_t2: List[str],
        predictions_t3: Optional[List[str]] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        persistence_date: Optional[str] = None,
    ) -> Dict[str, Any]:
        if len(predictions_t1) == 0 or len(predictions_t2) == 0:
            return {"success": False, "error": "EMPTY_PREDICTIONS"}
        if len(predictions_t1) != len(predictions_t2):
            return {"success": False, "error": "MISMATCHED_PIXEL_ALIGNMENT"}
        if predictions_t3 is not None and len(predictions_t3) != len(predictions_t1):
            return {"success": False, "error": "MISMATCHED_PERSISTENCE_ALIGNMENT"}

        areas_start = self._areas(predictions_t1)
        areas_end = self._areas(predictions_t2)
        transitions = self._transitions(predictions_t1, predictions_t2)
        summary, encroached_idx, seasonal_idx = self._encroachment(
            predictions_t1, predictions_t2, predictions_t3
        )

        result: Dict[str, Any] = {
            "success": True,
            "analysis_stage_version": ANALYSIS_STAGE_VERSION,
            "period": {"start_date": start_date, "end_date": end_date},
            "areas": {"start": areas_start, "end": areas_end},
            "transitions": transitions,
            "encroached_pixels": summary["encroached_pixels"],
            "trend": summary["trend"],
            "change_summary": summary,
            "total_pixels": len(predictions_t1),
            "encroached_indices": encroached_idx,
            "seasonal_indices": seasonal_idx,
        }
        if predictions_t3 is not None:
            result["areas"]["persistence"] = self._areas(predictions_t3)
            result["period"]["persistence_date"] = persistence_date
        return result


def create_analysis_service() -> AnalysisService:
    return AnalysisService()
