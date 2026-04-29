import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Navbar from "@/components/Navbar";
import DualMapViewer from "@/components/DualMapViewer";
import { ArrowLeft, Download, BarChart3, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { parseKMZ, generateWaterPolygon, generateEncroachmentPolygon, getBoundsFromGeometry } from "@/utils/kmzToGeoJSON";

const RamannaDualMap = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ramannaBoundary, setRamannaBoundary] = useState<GeoJSON.Geometry | null>(null);
  const [mockData, setMockData] = useState<any>(null);

  useEffect(() => {
    const loadRamannaData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Parse Ramanna KMZ
        const geojson = await parseKMZ("/data/ramanna.kmz");
        setRamannaBoundary(geojson);

        // Get bounds for centering
        const bounds = getBoundsFromGeometry(geojson);

        // Generate placeholder layers within Ramanna bounds
        const t1Water = generateWaterPolygon(bounds, 0.7); // 70% coverage
        const t2Water = generateWaterPolygon(bounds, 0.5); // 50% coverage
        const encroachment = generateEncroachmentPolygon(bounds); // Lost area

        // Create mock data structure
        const data = {
          t1: {
            classified_geojson: t1Water,
            area_stats: {
              water: 120000,
              builtup: 40000,
              vegetation: 90000,
              baresoil: 30000
            }
          },
          t2: {
            classified_geojson: t2Water,
            area_stats: {
              water: 90000,
              builtup: 70000,
              vegetation: 80000,
              baresoil: 20000
            }
          },
          encroachment: {
            geojson: encroachment,
            total_area_lost: 30000,
            confidence_mean: 0.82
          }
        };

        setMockData(data);

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load Ramanna KMZ');
        console.error('Error loading Ramanna data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadRamannaData();
  }, []);

  // Calculate statistics
  const t1Water = mockData?.t1.area_stats.water || 0;
  const t2Water = mockData?.t2.area_stats.water || 0;
  const areaLost = mockData?.encroachment.total_area_lost || 0;
  const confidence = mockData?.encroachment.confidence_mean || 0;
  const percentLoss = t1Water > 0 ? ((areaLost / t1Water) * 100).toFixed(1) : '0.0';

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-lg text-gray-600">Loading Ramanna Cheruvu KMZ...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <Card className="max-w-md w-full">
              <CardHeader>
                <CardTitle className="text-red-600">Error Loading KMZ</CardTitle>
                <CardDescription>Failed to parse Ramanna Cheruvu boundary</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">{error}</p>
                <Button onClick={() => navigate("/analysis")} className="w-full">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Analysis
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

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
            <h1 className="text-4xl font-bold text-gray-900">Ramanna Cheruvu Dual Map</h1>
            <div className="ml-auto">
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                <MapPin className="h-3 w-3 mr-1" />
                Real KMZ Boundary
              </Badge>
            </div>
          </div>
          <p className="text-gray-600">
            Testing dual map functionality with real Ramanna Cheruvu KMZ boundary and placeholder layers
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
              Water body change analysis using Ramanna Cheruvu boundary
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
              <span>Ramanna Cheruvu Dual Map Visualization</span>
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
              Left map shows T1 (2018), Right map shows T2 (2024) with encroachment overlay.
              Both maps use real Ramanna Cheruvu KMZ boundary.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="p-4">
              {mockData && ramannaBoundary && (
                <DualMapViewer
                  data={mockData}
                  baseAoi={ramannaBoundary}
                  t1Date="January 2018"
                  t2Date="January 2024"
                />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Validation Checklist */}
        <Card className="mt-6 shadow-lg">
          <CardHeader>
            <CardTitle>Ramanna Dual Map Validation</CardTitle>
            <CardDescription>
              Manual verification of real KMZ boundary with placeholder layers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-green-500"></div>
                  <span className="text-sm">Ramanna boundary visible</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-green-500"></div>
                  <span className="text-sm">Both maps centered correctly</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-green-500"></div>
                  <span className="text-sm">Dual sync working</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-green-500"></div>
                  <span className="text-sm">Encroachment visible only on right</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-green-500"></div>
                  <span className="text-sm">No console errors</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-green-500"></div>
                  <span className="text-sm">Map zooms smoothly</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-green-500"></div>
                  <span className="text-sm">KMZ parsing successful</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-green-500"></div>
                  <span className="text-sm">Placeholder layers within bounds</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RamannaDualMap;
