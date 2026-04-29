import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Navbar from "@/components/Navbar";
import DualMapViewer from "@/components/DualMapViewer";
import { mockAnalysis } from "@/mock/mockAnalysis";
import { ArrowLeft, Download, BarChart3 } from "lucide-react";
import { useNavigate } from "react-router-dom";

const MockAnalysis = () => {
  const navigate = useNavigate();
  const data = mockAnalysis;

  // Calculate statistics
  const t1Water = data.t1.area_stats.water;
  const t2Water = data.t2.area_stats.water;
  const areaLost = data.encroachment.total_area_lost;
  const confidence = data.encroachment.confidence_mean;
  const percentLoss = ((areaLost / t1Water) * 100).toFixed(1);

  // Mock AOI for display (using the water extent as boundary)
  const mockAoi = {
    type: "Polygon",
    coordinates: [[[78.475, 17.375], [78.495, 17.375], [78.495, 17.395], [78.475, 17.395], [78.475, 17.375]]]
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Button
              variant="outline"
              onClick={() => navigate("/analysis")}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Analysis
            </Button>
            <h1 className="text-4xl font-bold text-gray-900">Mock Dual Map Viewer</h1>
            <div className="ml-auto">
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                Test Mode - Using Mock Data
              </Badge>
            </div>
          </div>
          <p className="text-gray-600">
            Testing dual map functionality with hardcoded placeholder GeoJSON data
          </p>
        </div>

        {/* Statistics Panel */}
        <Card className="mb-6 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Encroachment Statistics
            </CardTitle>
            <CardDescription>
              Water body change analysis between T1 (2018) and T2 (2024)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{t1Water.toLocaleString()}</div>
                <div className="text-sm text-gray-600">T1 Water (m²)</div>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{t2Water.toLocaleString()}</div>
                <div className="text-sm text-gray-600">T2 Water (m²)</div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{areaLost.toLocaleString()}</div>
                <div className="text-sm text-gray-600">Area Lost (m²)</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{percentLoss}%</div>
                <div className="text-sm text-gray-600">Water Loss</div>
              </div>
            </div>
            
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-lg font-semibold text-gray-700">Confidence Score</div>
                <div className="text-2xl font-bold text-gray-900">{(confidence * 100).toFixed(1)}%</div>
                <div className="text-sm text-gray-600">Model confidence in encroachment detection</div>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-lg font-semibold text-gray-700">Analysis Period</div>
                <div className="text-2xl font-bold text-gray-900">6 Years</div>
                <div className="text-sm text-gray-600">January 2018 → January 2024</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dual Map Viewer */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Dual Map Visualization</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export T1
                </Button>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export T2
                </Button>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export Encroachment
                </Button>
              </div>
            </CardTitle>
            <CardDescription>
              Left map shows T1 (2018), Right map shows T2 (2024) with encroachment overlay
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="p-4">
              <DualMapViewer
                data={data}
                baseAoi={mockAoi}
                t1Date="January 2018"
                t2Date="January 2024"
              />
            </div>
          </CardContent>
        </Card>

        {/* Validation Checklist */}
        <Card className="mt-6 shadow-lg">
          <CardHeader>
            <CardTitle>Validation Checklist</CardTitle>
            <CardDescription>
              Manual verification of dual map functionality
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-green-500"></div>
                  <span className="text-sm">Two maps visible side-by-side</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-green-500"></div>
                  <span className="text-sm">Same center & zoom synchronization</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-green-500"></div>
                  <span className="text-sm">Encroachment polygon visible in red</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-green-500"></div>
                  <span className="text-sm">Stats panel updates correctly</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-green-500"></div>
                  <span className="text-sm">No console errors</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-green-500"></div>
                  <span className="text-sm">No blank map tiles</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-green-500"></div>
                  <span className="text-sm">Map resizes correctly</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-green-500"></div>
                  <span className="text-sm">Proper layer styling</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MockAnalysis;
