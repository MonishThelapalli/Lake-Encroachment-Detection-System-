import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix for default marker icons in Leaflet with bundlers
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

interface MapContainerProps {
  center?: [number, number];
  zoom?: number;
  className?: string;
  onMapReady?: (map: L.Map) => void;
  layers?: {
    waterBody?: boolean;
    buffer500?: boolean;
    buffer1000?: boolean;
    buffer2000?: boolean;
    deforestation?: boolean;
    landCover?: boolean;
  };
  opacity?: {
    deforestation?: number;
    landCover?: number;
  };
  baseMap?: "satellite" | "streets" | "terrain" | "hybrid";
  enableDrawing?: boolean;
  onAoiDrawn?: (geojson: any) => void;
}

// Sample AOI for demonstration (Ameenpur Lake area, Hyderabad)
const SAMPLE_WATER_BODY: L.LatLngExpression[] = [
  [17.5050, 78.3190],
  [17.5080, 78.3230],
  [17.5060, 78.3280],
  [17.5020, 78.3260],
  [17.5000, 78.3220],
  [17.5050, 78.3190],
];

const MapContainer = ({
  center = [17.505, 78.323],
  zoom = 13,
  className = "",
  onMapReady,
  layers = {},
  opacity = {},
  baseMap = "satellite",
  enableDrawing = false,
  onAoiDrawn,
}: MapContainerProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupsRef = useRef<{ [key: string]: L.Layer }>({});
  const baseTileRef = useRef<L.TileLayer | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const drawnPointsRef = useRef<L.LatLng[]>([]);
  const drawingLayerRef = useRef<L.Polygon | null>(null);

  // Base map tile URLs
  const baseMaps: { [key: string]: { url: string; attribution: string } } = {
    satellite: {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      attribution: "Tiles &copy; Esri",
    },
    streets: {
      url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    },
    terrain: {
      url: "https://stamen-tiles-{s}.a.ssl.fastly.net/terrain/{z}/{x}/{y}{r}.png",
      attribution: 'Map tiles by <a href="http://stamen.com">Stamen Design</a>',
    },
    hybrid: {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      attribution: "Tiles &copy; Esri",
    },
  };

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: center,
      zoom: zoom,
      zoomControl: false,
    });

    // Add initial base layer
    const baseConfig = baseMaps[baseMap];
    baseTileRef.current = L.tileLayer(baseConfig.url, {
      attribution: baseConfig.attribution,
      maxZoom: 19,
    }).addTo(map);

    // Add labels for hybrid view
    if (baseMap === "hybrid") {
      L.tileLayer(
        "https://stamen-tiles-{s}.a.ssl.fastly.net/toner-labels/{z}/{x}/{y}{r}.png",
        { maxZoom: 19 }
      ).addTo(map);
    }

    mapInstanceRef.current = map;
    onMapReady?.(map);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Handle base map changes
  useEffect(() => {
    if (!mapInstanceRef.current || !baseTileRef.current) return;

    const map = mapInstanceRef.current;
    map.removeLayer(baseTileRef.current);

    const baseConfig = baseMaps[baseMap];
    baseTileRef.current = L.tileLayer(baseConfig.url, {
      attribution: baseConfig.attribution,
      maxZoom: 19,
    }).addTo(map);

    // Move to bottom
    baseTileRef.current.bringToBack();
  }, [baseMap]);

  // Handle layer visibility
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // Remove existing layers
    Object.values(layerGroupsRef.current).forEach((layer) => {
      map.removeLayer(layer);
    });
    layerGroupsRef.current = {};

    // Water body polygon
    if (layers.waterBody) {
      const waterPolygon = L.polygon(SAMPLE_WATER_BODY, {
        color: "#0ea5e9",
        fillColor: "#0ea5e9",
        fillOpacity: 0.4,
        weight: 2,
      }).addTo(map);
      layerGroupsRef.current.waterBody = waterPolygon;
    }

    // Buffer zones
    const bufferColors = {
      buffer500: { color: "#22d3ee", radius: 500 },
      buffer1000: { color: "#10b981", radius: 1000 },
      buffer2000: { color: "#f59e0b", radius: 2000 },
    };

    const waterCenter = L.polygon(SAMPLE_WATER_BODY).getBounds().getCenter();

    if (layers.buffer500) {
      const buffer = L.circle(waterCenter, {
        radius: 500,
        color: bufferColors.buffer500.color,
        fillColor: bufferColors.buffer500.color,
        fillOpacity: 0.1,
        weight: 2,
        dashArray: "5, 5",
      }).addTo(map);
      layerGroupsRef.current.buffer500 = buffer;
    }

    if (layers.buffer1000) {
      const buffer = L.circle(waterCenter, {
        radius: 1000,
        color: bufferColors.buffer1000.color,
        fillColor: bufferColors.buffer1000.color,
        fillOpacity: 0.1,
        weight: 2,
        dashArray: "5, 5",
      }).addTo(map);
      layerGroupsRef.current.buffer1000 = buffer;
    }

    if (layers.buffer2000) {
      const buffer = L.circle(waterCenter, {
        radius: 2000,
        color: bufferColors.buffer2000.color,
        fillColor: bufferColors.buffer2000.color,
        fillOpacity: 0.1,
        weight: 2,
        dashArray: "5, 5",
      }).addTo(map);
      layerGroupsRef.current.buffer2000 = buffer;
    }

    // Deforestation layer (sample heatmap-style overlay)
    if (layers.deforestation) {
      const deforestationPolygon = L.polygon(
        [
          [17.508, 78.328],
          [17.512, 78.332],
          [17.510, 78.340],
          [17.504, 78.336],
        ],
        {
          color: "#ef4444",
          fillColor: "#ef4444",
          fillOpacity: (opacity.deforestation || 80) / 100 * 0.6,
          weight: 1,
        }
      ).addTo(map);
      deforestationPolygon.bindPopup("Deforestation Zone: 12.5 hectares detected");
      layerGroupsRef.current.deforestation = deforestationPolygon;
    }

    // Land cover change overlay
    if (layers.landCover) {
      const landCoverPolygon = L.polygon(
        [
          [17.500, 78.315],
          [17.505, 78.318],
          [17.502, 78.325],
          [17.497, 78.320],
        ],
        {
          color: "#f59e0b",
          fillColor: "#f59e0b",
          fillOpacity: (opacity.landCover || 70) / 100 * 0.5,
          weight: 1,
        }
      ).addTo(map);
      landCoverPolygon.bindPopup("Land Cover Change: Agricultural to Built-up");
      layerGroupsRef.current.landCover = landCoverPolygon;
    }
  }, [layers, opacity]);

  // Handle drawing mode
  useEffect(() => {
    if (!mapInstanceRef.current || !enableDrawing) return;

    const map = mapInstanceRef.current;

    const handleClick = (e: L.LeafletMouseEvent) => {
      if (!isDrawing) return;

      drawnPointsRef.current.push(e.latlng);

      // Update or create polygon
      if (drawingLayerRef.current) {
        map.removeLayer(drawingLayerRef.current);
      }

      if (drawnPointsRef.current.length >= 3) {
        drawingLayerRef.current = L.polygon(drawnPointsRef.current, {
          color: "#6366f1",
          fillColor: "#6366f1",
          fillOpacity: 0.3,
          weight: 2,
        }).addTo(map);
      }
    };

    map.on("click", handleClick);

    return () => {
      map.off("click", handleClick);
    };
  }, [enableDrawing, isDrawing]);

  const startDrawing = () => {
    setIsDrawing(true);
    drawnPointsRef.current = [];
    if (drawingLayerRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(drawingLayerRef.current);
      drawingLayerRef.current = null;
    }
  };

  const finishDrawing = () => {
    setIsDrawing(false);
    if (drawnPointsRef.current.length >= 3) {
      const geojson = {
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [
            drawnPointsRef.current.map((p) => [p.lng, p.lat]),
          ],
        },
      };
      onAoiDrawn?.(geojson);
    }
  };

  const clearDrawing = () => {
    setIsDrawing(false);
    drawnPointsRef.current = [];
    if (drawingLayerRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(drawingLayerRef.current);
      drawingLayerRef.current = null;
    }
  };

  return (
    <div className={`relative ${className}`}>
      <div ref={mapRef} className="absolute inset-0 z-0" />
      
      {enableDrawing && (
        <div className="absolute top-4 left-4 z-[1000] flex gap-2">
          {!isDrawing ? (
            <button
              onClick={startDrawing}
              className="px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium shadow-lg hover:bg-primary/90 transition-colors"
            >
              Start Drawing AOI
            </button>
          ) : (
            <>
              <button
                onClick={finishDrawing}
                className="px-3 py-2 bg-success text-success-foreground rounded-md text-sm font-medium shadow-lg hover:bg-success/90 transition-colors"
              >
                Finish
              </button>
              <button
                onClick={clearDrawing}
                className="px-3 py-2 bg-destructive text-destructive-foreground rounded-md text-sm font-medium shadow-lg hover:bg-destructive/90 transition-colors"
              >
                Clear
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default MapContainer;
