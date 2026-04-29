import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { 
  Layers, 
  ZoomIn,
  ZoomOut,
  Maximize2,
  Calendar
} from "lucide-react";
import Navbar from "@/components/Navbar";
import MapContainer from "@/components/MapContainer";
import L from "leaflet";

const MapViewer = () => {
  const [layers, setLayers] = useState({
    waterBody: true,
    buffer500: true,
    buffer1000: true,
    buffer2000: false,
    deforestation: true,
    landCover: false,
    nbrTrend: false,
    saviTrend: false,
  });

  const [opacity, setOpacity] = useState({
    deforestation: 80,
    landCover: 70,
  });

  const [timelineYear, setTimelineYear] = useState(2020);
  const [baseMap, setBaseMap] = useState<"satellite" | "streets" | "terrain" | "hybrid">("satellite");
  const mapRef = useRef<L.Map | null>(null);

  const toggleLayer = (layerKey: keyof typeof layers) => {
    setLayers(prev => ({ ...prev, [layerKey]: !prev[layerKey] }));
  };

  const handleZoomIn = () => {
    mapRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    mapRef.current?.zoomOut();
  };

  const handleFullscreen = () => {
    const mapContainer = document.querySelector('.leaflet-container');
    if (mapContainer && document.fullscreenEnabled) {
      mapContainer.requestFullscreen();
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      
      <main className="flex-1 relative">
        <div className="absolute inset-0 flex">
          {/* Map Container */}
          <div className="flex-1 relative">
            <MapContainer
              className="absolute inset-0"
              onMapReady={(map) => { mapRef.current = map; }}
              layers={layers}
              opacity={opacity}
              baseMap={baseMap}
            />

            {/* Map Controls */}
            <div className="absolute top-4 right-4 space-y-2 z-[1000]">
              <Button size="icon" variant="secondary" className="shadow-lg" onClick={handleZoomIn}>
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="secondary" className="shadow-lg" onClick={handleZoomOut}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="secondary" className="shadow-lg" onClick={handleFullscreen}>
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>

            {/* Timeline Slider */}
            <Card className="absolute bottom-4 left-1/2 -translate-x-1/2 w-full max-w-2xl shadow-xl z-[1000]">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <Calendar className="h-5 w-5 text-primary" />
                  <div className="flex-1 space-y-2">
                    <div className="flex justify-between items-center">
                      <Label className="text-sm font-medium">Timeline: {timelineYear}</Label>
                      <span className="text-xs text-muted-foreground">2000 - 2025</span>
                    </div>
                    <Slider
                      value={[timelineYear]}
                      onValueChange={(value) => setTimelineYear(value[0])}
                      min={2000}
                      max={2025}
                      step={1}
                      className="w-full"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Legend */}
            <Card className="absolute top-4 left-4 w-64 shadow-xl z-[1000]">
              <CardContent className="p-4 space-y-3">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  Map Legend
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-sm bg-[#0ea5e9]"></div>
                    <span>Water Body Boundary</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-sm bg-[#22d3ee]"></div>
                    <span>500m Buffer Zone</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-sm bg-[#10b981]"></div>
                    <span>1000m Buffer Zone</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-sm bg-[#f59e0b]"></div>
                    <span>2000m Buffer Zone</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-sm bg-destructive"></div>
                    <span>Deforestation Area</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-sm bg-warning"></div>
                    <span>Land Cover Change</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Layer Control Panel */}
          <div className="w-80 border-l border-border bg-card overflow-y-auto">
            <div className="p-6 space-y-6">
              <div>
                <h2 className="text-lg font-semibold mb-4">Layer Controls</h2>
                
                {/* Base Map Selection */}
                <div className="space-y-3 mb-6">
                  <Label className="text-sm font-medium">Base Map</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["satellite", "streets", "terrain", "hybrid"] as const).map((map) => (
                      <Button
                        key={map}
                        variant={baseMap === map ? "default" : "outline"}
                        size="sm"
                        onClick={() => setBaseMap(map)}
                        className="capitalize"
                      >
                        {map}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Water Body & Buffers */}
                <div className="space-y-3 pb-4 border-b">
                  <Label className="text-sm font-medium">Water Body & Buffers</Label>
                  {[
                    { key: "waterBody", label: "Water Body Boundary" },
                    { key: "buffer500", label: "500m Buffer" },
                    { key: "buffer1000", label: "1000m Buffer" },
                    { key: "buffer2000", label: "2000m Buffer" },
                  ].map(({ key, label }) => (
                    <div key={key} className="flex items-center justify-between">
                      <Label className="text-sm cursor-pointer" htmlFor={key}>{label}</Label>
                      <Switch
                        id={key}
                        checked={layers[key as keyof typeof layers]}
                        onCheckedChange={() => toggleLayer(key as keyof typeof layers)}
                      />
                    </div>
                  ))}
                </div>

                {/* Analysis Layers */}
                <div className="space-y-3 pt-4">
                  <Label className="text-sm font-medium">Analysis Layers</Label>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm cursor-pointer" htmlFor="deforestation">
                          Deforestation Attribution
                        </Label>
                        <Switch
                          id="deforestation"
                          checked={layers.deforestation}
                          onCheckedChange={() => toggleLayer("deforestation")}
                        />
                      </div>
                      {layers.deforestation && (
                        <div className="pl-4 space-y-1">
                          <Label className="text-xs text-muted-foreground">
                            Opacity: {opacity.deforestation}%
                          </Label>
                          <Slider
                            value={[opacity.deforestation]}
                            onValueChange={(value) => setOpacity(prev => ({ ...prev, deforestation: value[0] }))}
                            max={100}
                            step={5}
                          />
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm cursor-pointer" htmlFor="landCover">
                          Land Cover Change Heat Map
                        </Label>
                        <Switch
                          id="landCover"
                          checked={layers.landCover}
                          onCheckedChange={() => toggleLayer("landCover")}
                        />
                      </div>
                      {layers.landCover && (
                        <div className="pl-4 space-y-1">
                          <Label className="text-xs text-muted-foreground">
                            Opacity: {opacity.landCover}%
                          </Label>
                          <Slider
                            value={[opacity.landCover]}
                            onValueChange={(value) => setOpacity(prev => ({ ...prev, landCover: value[0] }))}
                            max={100}
                            step={5}
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <Label className="text-sm cursor-pointer" htmlFor="nbrTrend">
                        NBR Trend Heat Map
                      </Label>
                      <Switch
                        id="nbrTrend"
                        checked={layers.nbrTrend}
                        onCheckedChange={() => toggleLayer("nbrTrend")}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label className="text-sm cursor-pointer" htmlFor="saviTrend">
                        SAVI Trend Heat Map
                      </Label>
                      <Switch
                        id="saviTrend"
                        checked={layers.saviTrend}
                        onCheckedChange={() => toggleLayer("saviTrend")}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default MapViewer;
