/**
 * Frontend API client for Water Watcher backend
 * Handles requests to /api/analyze endpoint
 */

// const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
const API_BASE = "https://lake-encroachment-detection-system--monish2932.replit.app";

console.log("API URL:", API_BASE);

// Request and response types (aligned to DETECTED_RESPONSE_SCHEMA.json)
export interface AnalysisRequest {
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  geometry: GeoJSON.Geometry; // GeoJSON Polygon or MultiPolygon
}

// Import analysis types
import { ClassArea, ChangeSummary, AnalyzeResponse } from "@/types/analysis";

// Re-export as type-only to avoid runtime import errors
export type { ClassArea, ChangeSummary, AnalyzeResponse as AnalyzeResponse };

// Predefined Lakes
export interface PredefinedLake {
  id: string;
  name: string;
  area_km2: number;
}

export interface PredefinedLakeDetail {
  id: string;
  name: string;
  area_km2: number;
  geojson: GeoJSON.Feature;
}

export async function parseKML(file: File): Promise<GeoJSON.Feature> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE}/api/parse-kml`, {
    method: "POST",
    body: formData,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.detail || "KML parse failed");
  }

  return data as GeoJSON.Feature;
}

/**
 * Fetch list of predefined lakes
 */
export async function fetchPredefinedLakes(): Promise<PredefinedLake[]> {
  const response = await fetch(`${API_BASE}/predefined-lakes`);
  if (!response.ok) {
    throw new Error("Failed to fetch predefined lakes");
  }
  return response.json();
}

/**
 * Fetch detailed GeoJSON for a specific lake
 */
export async function fetchLakeDetail(lakeId: string): Promise<PredefinedLakeDetail> {
  const response = await fetch(`${API_BASE}/predefined-lakes/${lakeId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch lake ${lakeId}`);
  }
  return response.json();
}

/**
 * Check API health status
 */
export async function checkApiHealth(): Promise<{
  status: string;
  model_ok: boolean;
}> {
  try {
    const response = await fetch(`${API_BASE}/health`);
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('API health check failed:', error);
    return {
      status: 'offline',
      model_ok: false
    };
  }
}

/**
 * Validate AOI GeoJSON
 */
export function validateAOI(aoi: any): boolean {
  if (!aoi) return false;

  // Check basic structure
  if (aoi.type === 'Polygon' && Array.isArray(aoi.coordinates)) {
    return true;
  }

  if (aoi.type === 'Feature' && aoi.geometry) {
    return validateAOI(aoi.geometry);
  }

  if (aoi.type === 'FeatureCollection' && Array.isArray(aoi.features)) {
    return aoi.features.length > 0;
  }

  return false;
}

/**
 * Send analysis request to backend (Standard Mode)
 */
export async function analyzeAOI(
  geometry: any,
  startDate: Date,
  endDate: Date
): Promise<AnalyzeResponse> {
  if (!geometry || !geometry.type || !geometry.coordinates) {
    throw new Error("Invalid geometry: must be GeoJSON Polygon or MultiPolygon");
  }

  const feature = {
    type: "Feature",
    geometry: geometry,
    properties: {}
  };

  const payload = {
    aoi: feature,
    start_date: startDate.toISOString().slice(0, 10),
    end_date: endDate.toISOString().slice(0, 10),
  };

  console.log("FINAL PAYLOAD", JSON.stringify(payload, null, 2));
  console.log("### FRONTEND VERSION 2 ACTIVE - CALLING API ###");

  // Helper to call backend once with a given date window
  async function callAnalyze(p: typeof payload): Promise<any> {
    const res = await fetch(`${API_BASE}/api/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(p),
    });

    const text = await res.text();

    if (!res.ok) {
      console.error("BACKEND ERROR:", text);
      throw new Error(text);
    }

    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  const first: any = await callAnalyze(payload);

  // If backend reports satellite coverage issues, transparently expand window once.
  if (
    first &&
    first.success === false &&
    (first.reason === "cloud_mask_removed_pixels" ||
      first.reason === "no_tiles_in_date_range")
  ) {
    console.warn(
      "Satellite coverage unavailable for selected period — automatically expanding search window"
    );

    const expandedStart = new Date(startDate);
    expandedStart.setFullYear(expandedStart.getFullYear() - 1);
    const expandedEnd = new Date(endDate);
    expandedEnd.setFullYear(expandedEnd.getFullYear() + 1);

    const retryPayload = {
      ...payload,
      start_date: expandedStart.toISOString().slice(0, 10),
      end_date: expandedEnd.toISOString().slice(0, 10),
    };

    console.log(
      "RETRY PAYLOAD (expanded window)",
      JSON.stringify(retryPayload, null, 2)
    );

    const second: any = await callAnalyze(retryPayload);
    if (second && second.success) {
      // Attach a soft warning so the UI can inform the user.
      second.warnings = second.warnings || [];
      second.warnings.push(
        "Satellite coverage unavailable for selected period — automatically expanded search window."
      );
      (second as any).retry_reason =
        "Satellite coverage unavailable for selected period — automatically expanding search window";
      return second as AnalyzeResponse;
    }

    // If retry also fails, surface the original failure.
    return first as AnalyzeResponse;
  }

  return first as AnalyzeResponse;
}

/**
 * Alias for analyzeAOI for backwards compatibility
 */
export async function analyzeArea(request: AnalysisRequest): Promise<AnalyzeResponse> {
  return analyzeAOI(
    request.geometry,
    new Date(request.start_date),
    new Date(request.end_date)
  );
}

/**
 * Format results for display
 */
export function formatResults(result: AnalyzeResponse): {
  displayAccuracy: string;
  displayTrend: string;
  areasBefore: ClassArea[];
  areasAfter: ClassArea[];
  warnings: string[];
  changePixels: number;
  changeTrend: string;
} {
  if (!result.result) {
    return {
      displayAccuracy: 'N/A',
      displayTrend: 'Error',
      areasBefore: [],
      areasAfter: [],
      warnings: result.warnings || [],
      changePixels: 0,
      changeTrend: 'unknown',
    };
  }

  const r = result.result;
  return {
    displayAccuracy: `${(result.model_accuracy * 100).toFixed(2)}%`,
    displayTrend: r.encroachment.trend,
    areasBefore: r.t1.area_stats,
    areasAfter: r.t2.area_stats,
    warnings: result.warnings || [],
    changePixels: r.encroachment.summary.total_encroachment_pixels,
    changeTrend: r.encroachment.trend,
  };
}

// Types for scientific reliability report
export interface ScientificReliabilityReport {
  timestamp: string;
  reliability_grade: {
    grade: 'A' | 'B' | 'C' | 'D';
    grade_description: string;
    overall_score: number;
  };
  summary: {
    is_validated_better: boolean;
    key_improvements: string[];
    critical_issues: string[];
    recommendations: string[];
  };
  evaluation_results: {
    data_quality: any;
    model_trust: any;
    physical_consistency: any;
    change_reliability: any;
  };
  files: {
    reliability_report: string;
    comparison_report?: string;
  };
}

/**
 * Send analysis request to validated pipeline (Scientific Validated Mode)
 */
export async function analyzeAOIValidated(
  geometry: any,
  startDate: Date,
  endDate: Date
): Promise<AnalyzeResponse> {
  if (!geometry || !geometry.type || !geometry.coordinates) {
    throw new Error("Invalid geometry: must be GeoJSON Polygon or MultiPolygon");
  }

  const feature = {
    type: "Feature",
    geometry: geometry,
    properties: {}
  };

  const payload = {
    aoi: feature,
    start_date: startDate.toISOString().slice(0, 10),
    end_date: endDate.toISOString().slice(0, 10),
  };

  console.log("VALIDATED PIPELINE PAYLOAD", JSON.stringify(payload, null, 2));
  console.log("### FRONTEND VALIDATED PIPELINE ACTIVE ###");

  const response = await fetch(`${API_BASE}/run-analysis-validated`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.detail || `HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Generate comprehensive scientific reliability report
 */
export async function generateScientificReliabilityReport(
  geometry: any,
  startDate: Date,
  endDate: Date
): Promise<ScientificReliabilityReport> {
  if (!geometry || !geometry.type || !geometry.coordinates) {
    throw new Error("Invalid geometry: must be GeoJSON Polygon or MultiPolygon");
  }

  const feature = {
    type: "Feature",
    geometry: geometry,
    properties: {}
  };

  const payload = {
    aoi: feature,
    start_date: startDate.toISOString().slice(0, 10),
    end_date: endDate.toISOString().slice(0, 10),
  };

  console.log("SCIENTIFIC RELIABILITY REPORT PAYLOAD", JSON.stringify(payload, null, 2));
  console.log("### FRONTEND SCIENTIFIC RELIABILITY ACTIVE ###");

  const response = await fetch(`${API_BASE}/generate-scientific-reliability-report`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.detail || `HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

/**
 * List available scientific reliability reports
 */
export async function listScientificReliabilityReports(): Promise<{
  success: boolean;
  reports_available: boolean;
  total_reports: number;
  reports: Array<{
    filename: string;
    timestamp: string;
    grade: string;
    overall_score: number;
    is_validated_better: boolean;
  }>;
}> {
  const response = await fetch(`${API_BASE}/scientific-reliability-reports`);

  if (!response.ok) {
    throw new Error(`Failed to list scientific reliability reports: ${response.status}`);
  }

  return response.json();
}

/**
 * Fetch a stored standard analysis report by ID
 */
export async function fetchReport(reportId: string): Promise<any> {
  const response = await fetch(`${API_BASE}/api/reports/${reportId}`);
  if (!response.ok) {
    throw new Error(`Report not found: ${reportId}`);
  }
  return response.json();
}

/**
 * Fetch a stored validated analysis report by ID
 */
export async function fetchValidatedReport(reportId: string): Promise<any> {
  const response = await fetch(`${API_BASE}/api/validated-reports/${reportId}`);
  if (!response.ok) {
    throw new Error(`Validated report not found: ${reportId}`);
  }
  return response.json();
}

