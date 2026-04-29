import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, AlertTriangle, Beaker, TrendingUp, TrendingDown, Info } from 'lucide-react';
import { ScientificReliabilityReport } from '@/lib/api';

interface ValidatedReportViewProps {
  analysisResult: any;
  scientificReliabilityReport?: ScientificReliabilityReport;
}

const ValidatedReportView: React.FC<ValidatedReportViewProps> = ({ 
  analysisResult, 
  scientificReliabilityReport 
}) => {
  const reliabilityGrade = scientificReliabilityReport?.reliability_grade;
  const summary = scientificReliabilityReport?.summary;
  const evaluationResults = scientificReliabilityReport?.evaluation_results;

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'bg-green-100 text-green-800 border-green-200';
      case 'B': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'C': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'D': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getGradeIcon = (grade: string) => {
    switch (grade) {
      case 'A': return <CheckCircle2 className="h-4 w-4" />;
      case 'B': return <CheckCircle2 className="h-4 w-4" />;
      case 'C': return <AlertTriangle className="h-4 w-4" />;
      case 'D': return <AlertTriangle className="h-4 w-4" />;
      default: return <Info className="h-4 w-4" />;
    }
  };

  if (!analysisResult || !analysisResult.result) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          No analysis results available for validated report display.
        </AlertDescription>
      </Alert>
    );
  }

  const { result } = analysisResult;

  return (
    <div className="space-y-6">
      {/* Header with Scientific Validated Badge */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Beaker className="h-6 w-6 text-blue-600" />
            Scientific Validated Analysis Report
          </h2>
          <p className="text-gray-600 mt-1">
            Comprehensive reliability assessment with enhanced scientific validation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            <Beaker className="h-3 w-3 mr-1" />
            Scientific Validated Mode
          </Badge>
          {reliabilityGrade && (
            <Badge className={getGradeColor(reliabilityGrade.grade)}>
              {getGradeIcon(reliabilityGrade.grade)}
              Grade {reliabilityGrade.grade} - {reliabilityGrade.grade_description}
            </Badge>
          )}
        </div>
      </div>

      {/* Executive Summary */}
      {reliabilityGrade && summary && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-blue-600" />
              Executive Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold text-gray-900">Reliability Assessment</h4>
                <div className="mt-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Overall Score:</span>
                    <span className="font-bold">{reliabilityGrade.overall_score.toFixed(1)}/100</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Validated Better:</span>
                    <span className={`font-bold ${summary.is_validated_better ? 'text-green-600' : 'text-red-600'}`}>
                      {summary.is_validated_better ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Key Findings</h4>
                <div className="mt-2 space-y-1">
                  {summary.key_improvements.slice(0, 2).map((improvement, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <CheckCircle2 className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-gray-700">{improvement}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {summary.recommendations.length > 0 && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>Recommendation:</strong> {summary.recommendations[0]}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Standard Analysis Results */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Water Area Analysis */}
        <Card>
          <CardHeader>
            <CardTitle>Water Area Analysis</CardTitle>
            <CardDescription>Changes in water coverage over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-gray-50 rounded">
                  <div className="text-2xl font-bold text-blue-600">
                    {result.areas?.start?.water_pct?.toFixed(1) || 'N/A'}%
                  </div>
                  <div className="text-sm text-gray-600">Start Date</div>
                  <div className="text-xs text-gray-500">
                    {result.dates?.t1 || 'Unknown'}
                  </div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded">
                  <div className="text-2xl font-bold text-blue-600">
                    {result.areas?.end?.water_pct?.toFixed(1) || 'N/A'}%
                  </div>
                  <div className="text-sm text-gray-600">End Date</div>
                  <div className="text-xs text-gray-500">
                    {result.dates?.t2 || 'Unknown'}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-center p-3 bg-blue-50 rounded">
                {result.change_summary?.trend === 'decrease' ? (
                  <TrendingDown className="h-5 w-5 text-blue-600 mr-2" />
                ) : (
                  <TrendingUp className="h-5 w-5 text-blue-600 mr-2" />
                )}
                <span className="font-medium text-blue-900">
                  {result.change_summary?.trend === 'decrease' ? 'Encroachment Detected' : 'No Encroachment'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Classification Results */}
        <Card>
          <CardHeader>
            <CardTitle>Classification Results</CardTitle>
            <CardDescription>Land cover classification breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {result.class_distribution && Object.entries(result.class_distribution).map(([className, count]) => (
                <div key={className} className="flex items-center justify-between">
                  <span className="text-sm font-medium">{className}</span>
                  <Badge variant="outline">{count as number} pixels</Badge>
                </div>
              ))}
              <div className="pt-2 border-t">
                <div className="flex items-center justify-between font-semibold">
                  <span>Total Analyzed</span>
                  <Badge>{result.satellite_pixels || 'N/A'} pixels</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Scientific Reliability Details */}
      {evaluationResults && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Beaker className="h-5 w-5 text-blue-600" />
              Scientific Reliability Assessment
            </CardTitle>
            <CardDescription>
              Detailed evaluation of data quality, model trust, and physical consistency
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Data Quality */}
              <div className="p-4 border rounded">
                <h4 className="font-semibold text-gray-900 mb-2">Data Quality</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Overall Score:</span>
                    <span className="font-medium">{evaluationResults.data_quality?.overall_score?.toFixed(1) || 'N/A'}/100</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Reflectance Issues:</span>
                    <span className="font-medium">{evaluationResults.data_quality?.reflectance_violations?.validated || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Domain Shift:</span>
                    <span className="font-medium">{evaluationResults.data_quality?.domain_shift_percentage?.validated?.toFixed(1) || 'N/A'}%</span>
                  </div>
                </div>
              </div>

              {/* Model Trust */}
              <div className="p-4 border rounded">
                <h4 className="font-semibold text-gray-900 mb-2">Model Trust</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Overall Score:</span>
                    <span className="font-medium">{evaluationResults.model_trust?.overall_score?.toFixed(1) || 'N/A'}/100</span>
                  </div>
                  <div className="flex justify-between">
                    <span>High Confidence:</span>
                    <span className="font-medium">{(evaluationResults.model_trust?.high_confidence_ratio?.validated * 100)?.toFixed(1) || 'N/A'}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Effective Accuracy:</span>
                    <span className="font-medium">{(evaluationResults.model_trust?.effective_accuracy?.validated * 100)?.toFixed(1) || 'N/A'}%</span>
                  </div>
                </div>
              </div>

              {/* Physical Consistency */}
              <div className="p-4 border rounded">
                <h4 className="font-semibold text-gray-900 mb-2">Physical Consistency</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Overall Score:</span>
                    <span className="font-medium">{evaluationResults.physical_consistency?.overall_score?.toFixed(1) || 'N/A'}/100</span>
                  </div>
                  <div className="flex justify-between">
                    <span>NDWI Valid:</span>
                    <span className={`font-medium ${evaluationResults.physical_consistency?.ndwi_water_vs_land?.valid ? 'text-green-600' : 'text-red-600'}`}>
                      {evaluationResults.physical_consistency?.ndwi_water_vs_land?.valid ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>NDBI Valid:</span>
                    <span className={`font-medium ${evaluationResults.physical_consistency?.ndbi_builtup_vs_vegetation?.valid ? 'text-green-600' : 'text-red-600'}`}>
                      {evaluationResults.physical_consistency?.ndbi_builtup_vs_vegetation?.valid ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Change Reliability */}
              <div className="p-4 border rounded">
                <h4 className="font-semibold text-gray-900 mb-2">Change Reliability</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Overall Score:</span>
                    <span className="font-medium">{evaluationResults.change_reliability?.overall_score?.toFixed(1) || 'N/A'}/100</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Confidence Met:</span>
                    <span className={`font-medium ${evaluationResults.change_reliability?.confidence_criteria?.met ? 'text-green-600' : 'text-red-600'}`}>
                      {evaluationResults.change_reliability?.confidence_criteria?.met ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Reliable Pixels:</span>
                    <span className="font-medium">{evaluationResults.change_reliability?.reliable_encroachment_pixels || 0}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Validation Metadata */}
      {result.validation_metadata && (
        <Card>
          <CardHeader>
            <CardTitle>Validation Metadata</CardTitle>
            <CardDescription>Technical details about the validation process</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-semibold mb-2">Validation Status</h4>
                <Badge className={result.validation_metadata.overall_valid ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                  {result.validation_metadata.overall_valid ? 'PASS' : 'WARN'}
                </Badge>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Pipeline Version</h4>
                <Badge variant="outline">{result.pipeline_version || 'validated_v2'}</Badge>
              </div>
            </div>
            
            {result.validation_metadata.seasonal_consistency?.warnings?.length > 0 && (
              <div className="mt-4">
                <h4 className="font-semibold mb-2">Seasonal Warnings</h4>
                <div className="space-y-1">
                  {result.validation_metadata.seasonal_consistency.warnings.map((warning: string, index: number) => (
                    <Alert key={index} className="bg-yellow-50 border-yellow-200">
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      <AlertDescription className="text-sm">{warning}</AlertDescription>
                    </Alert>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Model Information */}
      <Card>
        <CardHeader>
          <CardTitle>Model Information</CardTitle>
          <CardDescription>Details about the classification model used</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-medium">Data Source:</span>
              <div className="mt-1">
                <Badge variant="outline">{analysisResult.data_source || 'Unknown'}</Badge>
              </div>
            </div>
            <div>
              <span className="font-medium">Model Accuracy:</span>
              <div className="mt-1 font-bold">
                {((analysisResult.model_accuracy || 0) * 100).toFixed(2)}%
              </div>
            </div>
            <div>
              <span className="font-medium">Analysis Mode:</span>
              <div className="mt-1">
                <Badge className="bg-blue-100 text-blue-800">
                  Scientific Validated
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ValidatedReportView;
