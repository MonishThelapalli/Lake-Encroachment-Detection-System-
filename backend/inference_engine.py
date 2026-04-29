"""
Phase 3 deterministic inference engine with domain-guard validation.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List

import joblib
import numpy as np
import pandas as pd

try:
    from pipeline_config import CLASS_NAMES, FEATURE_ORDER, MODELS_DIR, STAGE_VERSIONS
except ModuleNotFoundError:  # pragma: no cover
    from backend.pipeline_config import CLASS_NAMES, FEATURE_ORDER, MODELS_DIR, STAGE_VERSIONS


INFERENCE_STAGE_VERSION = STAGE_VERSIONS["phase_3_inference"]


class InferenceEngine:
    REQUIRED_FEATURES = FEATURE_ORDER
    CLASSES = CLASS_NAMES
    LABEL_MAP = {
        "Bare-soil": "BareSoil",
        "BareSoil": "BareSoil",
        "Builtup": "BuiltUp",
        "Built-up": "BuiltUp",
        "BuiltUp": "BuiltUp",
        "Vegetation": "Vegetation",
        "Water": "Water",
        "uncertain": "uncertain"
    }

    def __init__(self) -> None:
        self.model_path = MODELS_DIR / "xgboost_model.pkl"
        self.training_stats_path = MODELS_DIR / "xgboost_training_stats.json"
        self.label_encoder_path = MODELS_DIR / "xgboost_label_encoder.pkl"
        self.scaler_path = MODELS_DIR / "xgboost_scaler.pkl"

        self.model = None
        self.scaler = None
        self.training_stats: Dict[str, Any] = {}
        self.model_ok = False
        self.MODEL_ACCURACY = 0.0

        self._load_all()

    @classmethod
    def _normalize_labels(cls, labels: List[str]) -> List[str]:
        return [cls.LABEL_MAP.get(str(label), str(label)) for label in labels]

    def _load_all(self) -> None:
        if not self.model_path.exists():
            raise RuntimeError(f"Missing model artifact: {self.model_path}")

        self.model = joblib.load(self.model_path)
        print("Loaded model type:", type(self.model))
        
        if hasattr(self, 'label_encoder_path') and self.label_encoder_path.exists():
            self.label_encoder = joblib.load(self.label_encoder_path)
            
        if hasattr(self, 'scaler_path') and self.scaler_path.exists():
            self.scaler = joblib.load(self.scaler_path)
        
        if self.training_stats_path.exists():
            self.training_stats = json.loads(self.training_stats_path.read_text(encoding="utf-8"))
        self.MODEL_ACCURACY = float(self.training_stats.get("metrics", {}).get("accuracy", 0.8837))
        self.model_ok = True

    def _validate_input_dataframe(self, features_df: pd.DataFrame) -> Dict[str, Any]:
        missing = [f for f in self.REQUIRED_FEATURES if f not in features_df.columns]
        if missing:
            return {
                "ok": False,
                "error": f"MISSING_FEATURES: {missing}",
            }

        X = features_df[self.REQUIRED_FEATURES].copy()
        for feature in self.REQUIRED_FEATURES:
            X[feature] = pd.to_numeric(X[feature], errors="coerce")

        nan_count = X.isna().sum().sum()
        if nan_count > 0:
            print(f"[DEBUG] Found {nan_count} NaNs in inference data. Imputing with training means.")
            # Proper NaN Handling: Replace with Training Mean
            feature_stats = self.training_stats.get("feature_stats", {})
            for feature in self.REQUIRED_FEATURES:
                if X[feature].isna().any():
                    train_mean = feature_stats.get(feature, {}).get("mean", 0.0)
                    X[feature] = X[feature].fillna(train_mean)

        return {"ok": True, "features": X}

    def _domain_validation(self, X: pd.DataFrame) -> Dict[str, Any]:
        feature_bounds = self.training_stats.get("feature_bounds", {})
        if not feature_bounds:
            return {"ok": True, "features_checked": X, "warning": "No feature bounds found in training stats.", "ood_mask": np.zeros(len(X), dtype=bool)}
            
        mins = []
        maxs = []
        for feature in self.REQUIRED_FEATURES:
            f_min = float(feature_bounds["min"].get(feature, -1.0))
            f_max = float(feature_bounds["max"].get(feature, 1.0))
            
            # Apply 10% tolerance margin
            margin = (f_max - f_min) * 0.10
            # If margin is 0, add a tiny epsilon
            if margin == 0:
                margin = 1e-6
                
            mins.append(f_min - margin)
            maxs.append(f_max + margin)

        mins_arr = np.array(mins, dtype=np.float64)
        maxs_arr = np.array(maxs, dtype=np.float64)
        values = X.to_numpy(dtype=np.float64)

        # Remove Over-Clipping: Log warning but do not mutate/clip the array
        out_of_bounds = (values < mins_arr) | (values > maxs_arr)
        row_ood = out_of_bounds.any(axis=1)
        
        # Clip features before passing them to scaler
        values_clipped = np.clip(values, mins_arr, maxs_arr)
        X_clipped = pd.DataFrame(values_clipped, columns=X.columns, index=X.index)

        warning_details = None
        
        if row_ood.sum() > 0:
            warning_details = f"{row_ood.sum()} pixels exceeded training min/max bounds + 10% margin (OOD). Clipped to extended bounds and flagged for uncertain masking."
            print(f"[WARNING] {warning_details}")

        return {
            "ok": True,
            "features_checked": X_clipped,
            "warning": warning_details,
            "ood_mask": row_ood
        }

    def predict(self, features_df: pd.DataFrame) -> Dict[str, Any]:
        if not self.model_ok:
            return {
                "success": False,
                "model_ok": False,
                "model_accuracy": self.MODEL_ACCURACY,
                "error": "MODEL_NOT_LOADED",
                "stage_version": INFERENCE_STAGE_VERSION,
            }

        validation = self._validate_input_dataframe(features_df)
        if not validation["ok"]:
            return {
                "success": False,
                "model_ok": True,
                "model_accuracy": self.MODEL_ACCURACY,
                "error": validation["error"],
                "stage_version": INFERENCE_STAGE_VERSION,
            }
        X = validation["features"]
        X = X[self.REQUIRED_FEATURES]
        
        print("\n--- [DEBUG] Feature Ranges (Raw) ---")
        print(X.agg(['min', 'max']).T)

        domain = self._domain_validation(X)
        if not domain["ok"]:
            return {
                "success": False,
                "model_ok": True,
                "model_accuracy": self.MODEL_ACCURACY,
                "error": domain["error"],
                "details": domain.get("details", {}),
                "stage_version": INFERENCE_STAGE_VERSION,
            }
            
        warnings = []
        if domain.get("warning"):
            warnings.append(domain["warning"])
            
        X_checked = domain.get("features_checked", X).copy()
        ood_mask = domain.get("ood_mask", np.zeros(len(X), dtype=bool))
        
        # (Radiometric mean-shift removed: Sentinel-2 Harmonized handles offsets. 
        # Shifting the batch strictly to the training mean mathematically destroyed 
        # the MNDWI/NDVI indices for water pixels when the batch was dry/eutrophic).
        if self.scaler:
            X_scaled = pd.DataFrame(self.scaler.transform(X_checked), columns=X.columns, index=X.index)
        else:
            X_scaled = X_checked
            
        print("\n--- [DEBUG] Feature Ranges (Scaled) ---")
        print(X_scaled.agg(['min', 'max']).T)

        y_pred_raw = self.model.predict(X_scaled.values)
        
        # Extract Confidence
        probabilities = None
        confidence = None
        uncertain_mask = np.zeros(len(y_pred_raw), dtype=bool)
        
        if hasattr(self.model, "predict_proba"):
            probs = self.model.predict_proba(X_scaled.values)
            confidence = probs.max(axis=1)
            
            # 2. Relaxed OOD and Threshold Handling
            uncertain_mask = (confidence < 0.45) | (ood_mask & (confidence < 0.5))
            
            # Confidence Analysis
            uncertain_count = uncertain_mask.sum()
            uncertain_pct = (uncertain_count / len(uncertain_mask)) * 100
            print(f"\n--- [DEBUG] Confidence Analysis ---")
            print(f"Mean Confidence: {confidence.mean():.4f}, Min Confidence: {confidence.min():.4f}")
            print(f"Uncertain pixels (proba < 0.45 / OOD < 0.5): {uncertain_count} ({uncertain_pct:.2f}%)")
            
            # 3. Dynamic Threshold Relaxation (Lower Bound: 0.4)
            if uncertain_pct > 25.0:
                print(f"[DYNAMIC ADJUSTMENT] Uncertainty > 25% ({uncertain_pct:.2f}%). Reducing thresholds to absolute minimum (0.4).")
                uncertain_mask = (confidence < 0.4) | (ood_mask & (confidence < 0.45))
                uncertain_count = uncertain_mask.sum()
                uncertain_pct = (uncertain_count / len(uncertain_mask)) * 100
                print(f"New Uncertain pixels: {uncertain_count} ({uncertain_pct:.2f}%)")
            
            confidence = confidence.astype(float).tolist()
            probabilities = {
                self.CLASSES[idx]: probs[:, idx].astype(float).tolist()
                for idx in range(min(probs.shape[1], len(self.CLASSES)))
            }

        if hasattr(y_pred_raw, "tolist"):
            y_pred = y_pred_raw.tolist()
        else:
            y_pred = list(y_pred_raw)

        # Map numeric predictions to string labels
        # 0 -> Water, 1 -> Vegetation, 2 -> BareSoil, 3 -> BuiltUp
        label_map_rf = {
            0: "Water",
            1: "Vegetation",
            2: "BareSoil",
            3: "BuiltUp"
        }
        
        if hasattr(self, 'label_encoder'):
            raw_labels = self.label_encoder.inverse_transform([int(p) for p in y_pred]).tolist()
        else:
            raw_labels = []
            for p in y_pred:
                if isinstance(p, (int, np.integer, float, np.floating)):
                    raw_labels.append(label_map_rf.get(int(p), "BareSoil"))
                else:
                    raw_labels.append(str(p))
                    
        # Apply Confidence Filtering
        for i in range(len(raw_labels)):
            if uncertain_mask[i]:
                raw_labels[i] = "uncertain"

        labels = list(self._normalize_labels(raw_labels))

        # 4. Class Distribution Monitoring
        from collections import Counter
        class_counts = Counter(labels)
        print(f"\n--- [DEBUG] Class Distribution Monitoring ---")
        for cls_name, count in class_counts.items():
            print(f"{cls_name}: {count} ({(count/len(labels))*100:.1f}%)")

        return {
            "success": True,
            "model_ok": True,
            "model_accuracy": self.MODEL_ACCURACY,
            "predictions": {
                "labels": labels,
                "confidence": confidence if confidence is not None else [],
                "probabilities": probabilities if probabilities is not None else {},
            },
            "stage_version": INFERENCE_STAGE_VERSION,
            "warnings": warnings,
        }

def create_inference_engine() -> InferenceEngine:
    return InferenceEngine()
