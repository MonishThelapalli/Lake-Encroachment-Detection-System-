export interface ClassArea {
  class: string;
  pixel_count: number;
  percent: number;
}

export interface Transition {
  from: string;
  to: string;
  pixels: number;
}

export type ChangeTrend = "encroachment" | "stabilization" | "no_change";

export interface ChangeSummary {
  baresoil_loss_pixels: number;
  builtup_gain_pixels: number;
  vegetation_gain_pixels: number;
  total_encroachment_pixels: number;
  trend: ChangeTrend;
}

export interface AnalysisPeriod {
  start_date: string;
  end_date: string;
}

export interface AnalysisAreas {
  start: ClassArea[];
  end: ClassArea[];
}

export interface AnalysisDates {
  t1: string;
  t2: string;
}

export type ClassifiedLayerName = "Water" | "BuiltUp" | "Vegetation" | "BareSoil";

export type ClassifiedTileSet = Partial<Record<ClassifiedLayerName, string>>;

export interface DualMapWaterLayer {
  classified_geojson: GeoJSON.FeatureCollection;
  tile_url?: string;
  class_tiles?: ClassifiedTileSet;
  layer_order?: ClassifiedLayerName[];
  area_stats: ClassArea[];
}

export interface EncroachmentLayerPayload {
  geojson: GeoJSON.FeatureCollection;
  tile_url?: string;
  total_area_lost: number;
  confidence_mean: number;
  total_pixels: number;
  trend: ChangeTrend;
  summary: ChangeSummary;
}

export interface AnalysisResultPayload {
  success: boolean;
  t1: DualMapWaterLayer;
  t2: DualMapWaterLayer;
  encroachment: EncroachmentLayerPayload;
  pipeline_versions?: any;
  period?: AnalysisPeriod;
  dates?: AnalysisDates;
  bounds?: GeoJSON.Feature;
  method?: string | null;
  total_pixels?: number;
  transitions?: Transition[];
}

export interface AnalyzeResponse {
  success: boolean;
  model_ok: boolean;
  model_accuracy: number;
  data_source: string;
  satellite_pixels: number;
  warnings: string[];
  error?: string | null;
  result?: AnalysisResultPayload | null;
  analysisMode?: string;
  scientificReliabilityReport?: ScientificReliabilityReport;
  validated_report_id?: string;
}

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

