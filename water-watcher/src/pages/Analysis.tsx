import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import { Box } from '@mui/material';
import { cn } from "@/lib/utils";
import { MapPin, CalendarIcon, Play, CheckCircle2, Upload, X, AlertCircle, Beaker } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Navbar from "@/components/Navbar";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { analyzeAOI, analyzeAOIValidated, generateScientificReliabilityReport, fetchPredefinedLakes, fetchLakeDetail, parseKML, PredefinedLake } from "@/lib/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GEEStatusBadge } from "@/components/GEEStatusBadge";
import { MapSection } from "@/components/MapSection";

const Analysis = () => {
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [isRunning, setIsRunning] = useState(false);
  const [aoiGeometry, setAoiGeometry] = useState<GeoJSON.Geometry | null>(null);
  const [uploadedAOIName, setUploadedAOIName] = useState<string>("");
  const [kmlError, setKmlError] = useState("");
  const [error, setError] = useState("");
  const [kmlLoading, setKmlLoading] = useState(false);
  const [aoiSource, setAoiSource] = useState<"draw" | "upload" | "predefined">("draw");
  const [analysisMode, setAnalysisMode] = useState<"standard" | "validated">("standard");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [predefinedLakes, setPredefinedLakes] = useState<PredefinedLake[]>([]);
  const [selectedLakeId, setSelectedLakeId] = useState("");
  const [lakeLoading, setLakeLoading] = useState(false);
  const [geeStatus, setGeeStatus] = useState("loading");

  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const API_URL = import.meta.env.VITE_API_BASE || "http://localhost:8000";
    fetch(`${API_URL}/gee-status`)
      .then(res => res.json())
      .then(data => {
        if (data.status === "connected") {
          setGeeStatus("connected");
        } else {
          setGeeStatus("error");
        }
      })
      .catch(() => setGeeStatus("error"));
  }, []);

  // Load predefined lakes on mount
  useEffect(() => {
    const loadLakes = async () => {
      try {
        const lakes = await fetchPredefinedLakes();
        setPredefinedLakes(lakes);
      } catch (error) {
        console.error("Failed to load predefined lakes:", error);
      }
    };
    loadLakes();
  }, []);

  // Handle predefined lake selection
  const handleLakeSelection = async (lakeId: string) => {
    if (!lakeId) return;

    setLakeLoading(true);
    setSelectedLakeId(lakeId);

    try {
      const lakeDetail = await fetchLakeDetail(lakeId);
      setAoiGeometry(lakeDetail.geojson.geometry as GeoJSON.Geometry);
      setUploadedAOIName(lakeDetail.name);
      setAoiSource("predefined");
      setError("");

      toast({
        title: "Lake Loaded",
        description: `${lakeDetail.name} (${lakeDetail.area_km2.toFixed(3)} km²) ready for analysis`
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load lake geometry",
        variant: "destructive"
      });
    } finally {
      setLakeLoading(false);
    }
  };

  const handleKMLFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setKmlLoading(true);
    setKmlError("");
    setError("");

    try {
      const feature = await parseKML(file);
      if (!feature?.geometry) {
        throw new Error("Invalid parse response: missing geometry");
      }

      {
        setAoiGeometry(feature.geometry as GeoJSON.Geometry);
        setUploadedAOIName(file.name.replace(/\.[^/.]+$/, ""));
        setAoiSource("upload");
        setError("");

        toast({
          title: "KML Uploaded Successfully",
          description: "KML/KMZ file parsed and ready for analysis"
        });
        setKmlError("");
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      setKmlError(errorMsg);
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive"
      });
    } finally {
      setKmlLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRunAnalysis = async () => {
    setError("");

    if (!startDate || !endDate) {
      toast({
        title: "Missing Dates",
        description: "Please select start and end dates",
        variant: "destructive"
      });
      return;
    }

    if (startDate >= endDate) {
      toast({
        title: "Invalid Date Range",
        description: "Start date must be before end date",
        variant: "destructive"
      });
      return;
    }

    if (!aoiGeometry) {
      toast({
        title: "Missing AOI",
        description: "Please draw or upload an AOI",
        variant: "destructive"
      });
      return;
    }

    setIsRunning(true);

    try {
      let result: any;

      if (analysisMode === "standard") {
        // Standard Mode: Use existing pipeline
        const response = await analyzeAOI(aoiGeometry, startDate, endDate);

        if (response.retry_reason) {
          toast({
            title: "Satellite coverage notice",
            description: "Satellite coverage unavailable for selected period — automatically expanding search window",
          });
        }

        // SUCCESS ONLY WHEN report_id EXISTS
        if (response.success === true && response.report_id) {
          navigate(`/reports/${response.report_id}?mode=standard`);
          return;
        }

        // NO IMAGERY CASE (informational)
        if (response.data_source === "NO_IMAGERY") {
          toast({
            title: "No Clear Satellite Imagery",
            description: response.error || "No usable satellite imagery found for this period. Try wider dates.",
            variant: "default"
          });
          setIsRunning(false);
          return;
        }

        // BACKEND FAILURE (real error)
        toast({
          title: "Analysis Failed",
          description: response.error || "Server could not generate report.",
          variant: "destructive"
        });
        setIsRunning(false);
        return;
      } else {
        // Scientific Validated Mode: Use validated pipeline + reliability report
        toast({
          title: "Running Scientific Validated Analysis",
          description: "This may take longer as it runs comprehensive validation...",
        });

        try {
          // First run validated pipeline
          const validatedResult = await analyzeAOIValidated(aoiGeometry, startDate, endDate);

          // SUCCESS ONLY WHEN validated_report_id EXISTS
          if (validatedResult.success === true && validatedResult.validated_report_id) {
            navigate(`/reports/${validatedResult.validated_report_id}?mode=validated`);
            return;
          }

          // NO IMAGERY CASE (informational)
          if (validatedResult.data_source === "NO_IMAGERY") {
            toast({
              title: "No Clear Satellite Imagery",
              description: validatedResult.error || "No usable satellite imagery found for this period. Try wider dates.",
              variant: "default"
            });
            setIsRunning(false);
            return;
          }

          // BACKEND FAILURE (real error)
          toast({
            title: "Validated Analysis Failed",
            description: validatedResult.error || "Server could not generate validated report.",
            variant: "destructive"
          });
          setIsRunning(false);
          return;
        } catch (validatedError) {
          // Validated mode completely failed - show error and suggest Standard Mode
          const errorMessage = validatedError instanceof Error ? validatedError.message : "Validated analysis failed. Please try Standard Mode.";
          toast({
            title: "Validated Analysis Failed",
            description: `${errorMessage}\n\nTip: Try Standard Mode for basic analysis.`,
            variant: "destructive"
          });
          setIsRunning(false);
          return; // Stop here - don't proceed to redirect
        }
      }

    } catch (error) {
      setError(error instanceof Error ? error.message : "Analysis failed");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Configure Analysis</h1>
          <p className="text-gray-600">Set up your water body encroachment detection parameters</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Left Column - AOI Selection */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Define Area of Interest (AOI)
                </CardTitle>
                <CardDescription>
                  Choose one method: draw on the map, use example lake, or upload KML/KMZ file
                </CardDescription>

                {/* GEE Status Display */}
                <div className="pt-2 space-y-2">
                  {geeStatus === "loading" && (
                    <div className="text-sm text-gray-500 flex items-center gap-2">
                      Checking connection...
                    </div>
                  )}

                  {geeStatus === "error" && (
                    <div className="error-box border border-red-200 bg-red-50 text-red-800 p-3 rounded-md text-sm flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      ⚠️ Live Data Not Connected - GEE authentication failed
                    </div>
                  )}

                  {geeStatus === "connected" && (
                    <div className="success-box border border-green-200 bg-green-50 text-green-800 p-3 rounded-md text-sm flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ✅ Google Earth Engine Connected
                    </div>
                  )}
                </div>

                {/* Analysis Mode Selector */}
                <div className="pt-4">
                  <Label className="text-base font-medium">Analysis Mode</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <Button
                      variant={analysisMode === "standard" ? "default" : "outline"}
                      onClick={() => setAnalysisMode("standard")}
                      className="flex items-center gap-2"
                    >
                      <Play className="h-4 w-4" />
                      Standard Mode
                    </Button>
                    <Button
                      variant={analysisMode === "validated" ? "default" : "outline"}
                      onClick={() => setAnalysisMode("validated")}
                      className="flex items-center gap-2"
                    >
                      <Beaker className="h-4 w-4" />
                      Scientific Validated Mode
                    </Button>
                  </div>
                  {analysisMode === "validated" && (
                    <Alert className="mt-3">
                      <Beaker className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Scientific Validated Mode</strong> runs comprehensive validation including:
                        reflectance scaling, cloud masking, seasonal consistency, and reliability grading.
                        This provides enhanced scientific reliability but takes longer to process.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Analysis Disabled Warning (Removed per request as geeStatus handles this) */}

                {/* AOI Source Indicator */}
                {aoiGeometry && (
                  <Alert className="bg-green-50 border-green-200">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertDescription className="flex items-center justify-between">
                      <span className="text-green-800">
                        <strong>{aoiSource === "predefined" ? "Predefined Lake Active" : "KML/KMZ AOI Active"}</strong> - {uploadedAOIName || 'Uploaded AOI'}
                      </span>
                      <Button
                        onClick={() => {
                          setAoiGeometry(null);
                          setUploadedAOIName("");
                          setAoiSource("draw");
                          setSelectedLakeId("");
                          setError("");
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                        className="ml-2 h-6 px-2 text-xs text-green-700 hover:text-green-900"
                        variant="ghost"
                        size="sm"
                      >
                        <X className="h-3 w-3 mr-1" />
                        Switch to Draw
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Predefined Lakes Dropdown */}
                <div className="space-y-2">
                  <Label>Quick Select: Predefined Lakes</Label>
                  <Select
                    value={selectedLakeId}
                    onValueChange={handleLakeSelection}
                    disabled={lakeLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a lake example..." />
                    </SelectTrigger>
                    <SelectContent>
                      {predefinedLakes.map((lake) => (
                        <SelectItem key={lake.id} value={lake.id}>
                          {lake.name} ({lake.area_km2.toFixed(3)} km²)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {lakeLoading && (
                    <p className="text-sm text-gray-500">Loading lake geometry...</p>
                  )}
                </div>

                <div className="text-center text-sm text-gray-500 font-medium">OR</div>

                <Label>Draw AOI on Map</Label>

                {/* KML Upload Section */}
                <div className="space-y-2">
                  <Label>Or upload KML / KMZ file</Label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleKMLFileChange}
                    accept=".kml,.kmz"
                    className="hidden"
                  />
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={kmlLoading || !!aoiGeometry}
                    variant="outline"
                    className="w-full gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    {kmlLoading ? "Parsing..." : aoiGeometry ? "KML Loaded" : "Choose File"}
                  </Button>
                  <p className="text-xs text-gray-500">Accepts .kml or .kmz (zipped KML)</p>

                  {/* KML Error Message */}
                  {kmlError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{kmlError}</AlertDescription>
                    </Alert>
                  )}

                  {/* KML Success Message */}
                  {aoiGeometry && !kmlError && aoiSource === "upload" && (
                    <Alert className="bg-green-50 border-green-200">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-800">
                        KML/KMZ file loaded successfully. The AOI will be displayed on the map.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                <p className="text-sm text-gray-500 italic">
                  Your AOI will be analyzed against real satellite data from Google Earth Engine
                </p>
              </CardContent>
            </Card>

            {/* Map Container - Isolated Component */}
            <MapSection
              uploadedAOI={aoiGeometry}
              onAOIChange={(geometry) => {
                setAoiGeometry(geometry);
                setAoiSource("draw");
                setUploadedAOIName("");
                setError("");
              }}
              aoiSource={aoiSource}
              setAoiSource={setAoiSource}
              setUploadedAOI={setAoiGeometry}
              setSelectedLakeId={setSelectedLakeId}
              onToast={(title, description) => {
                toast({ title, description });
              }}
            />
          </div>

          {/* Right Column - Parameters & Run */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5" />
                  Analysis Parameters
                </CardTitle>
                <CardDescription>Configure the time range for your analysis</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Time Range</Label>
                  <LocalizationProvider dateAdapter={AdapterDayjs}>
                    <Box display="flex" gap={2}>
                      <DatePicker
                        label="Start Date"
                        value={startDate ? dayjs(startDate) : null}
                        onChange={(newValue) => setStartDate(newValue ? newValue.toDate() : undefined)}
                        disableFuture
                        slotProps={{
                          textField: {
                            fullWidth: true,
                            size: "medium"
                          }
                        }}
                      />

                      <DatePicker
                        label="End Date"
                        value={endDate ? dayjs(endDate) : null}
                        onChange={(newValue) => setEndDate(newValue ? newValue.toDate() : undefined)}
                        disableFuture
                        minDate={startDate ? dayjs(startDate) : undefined}
                        slotProps={{
                          textField: {
                            fullWidth: true,
                            size: "medium"
                          }
                        }}
                      />
                    </Box>
                  </LocalizationProvider>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800">
                    <strong>Model:</strong> Using XGBoost model with 99.9% accuracy
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Ready to Run Analysis?</CardTitle>
                <CardDescription>This will process your AOI with the selected parameters</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={handleRunAnalysis}
                  disabled={!aoiGeometry || geeStatus !== "connected"}
                  className="w-full"
                  size="lg"
                >
                  {isRunning ? (
                    <>
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Processing...
                    </>
                  ) : !aoiGeometry ? (
                    <>
                      <AlertCircle className="mr-2 h-4 w-4" />
                      Analysis Disabled
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Run Analysis
                    </>
                  )}
                </Button>
                {error && (
                  <Alert variant="destructive" className="mt-3">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analysis;