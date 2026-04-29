import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getGeometryBounds } from "@/lib/kmlParser";

interface MapViewerProps {
  onAOIChange: (coordinates: number[][][]) => void;
  uploadedAOI?: any;
}

const MapViewer = ({ onAOIChange, uploadedAOI }: MapViewerProps) => {
  const mapRef = useRef<L.Map | null>(null);
  const drawnItemsRef = useRef<L.FeatureGroup | null>(null);
  const kmlLayerRef = useRef<L.Layer | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    if (mapLoaded) return;

    // Initialize map
    const map = L.map("map").setView([31.5, 74.2], 9);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap contributors",
    }).addTo(map);

    // Create feature group for drawn items
    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);
    drawnItemsRef.current = drawnItems;

    // Add example lake polygon
    const exampleLake = L.polygon(
      [[31.5, 74.2], [31.5, 74.3], [31.6, 74.3], [31.6, 74.2]],
      {
        color: "blue",
        fillColor: "lightblue",
        fillOpacity: 0.3,
        weight: 2,
        dashArray: "5, 5",
      }
    ).bindPopup("Example Lake (Latitude: 31.5-31.6°N, Longitude: 74.2-74.3°E)");
    drawnItems.addLayer(exampleLake);

    // Initialize drawing controls with simple implementation
    addDrawingControls(map, drawnItems, onAOIChange);

    mapRef.current = map;
    setMapLoaded(true);

    return () => {
      map.remove();
    };
  }, [mapLoaded, onAOIChange]);

  // Handle uploaded KML AOI display
  useEffect(() => {
    if (!mapRef.current || !uploadedAOI) return;

    // Remove previous KML layer if exists
    if (kmlLayerRef.current) {
      mapRef.current.removeLayer(kmlLayerRef.current);
    }

    try {
      const geometry = uploadedAOI.geometry;

      if (geometry.type === "Polygon") {
        const latLngs = geometry.coordinates[0].map((coord: number[]) => [coord[1], coord[0]]);
        const polygon = L.polygon(latLngs, {
          color: "orange",
          fillColor: "lightyellow",
          fillOpacity: 0.4,
          weight: 3,
        }).bindPopup(`KML AOI: ${uploadedAOI.properties?.name || 'Uploaded'}`);
        polygon.addTo(mapRef.current);
        kmlLayerRef.current = polygon;

        // Auto-zoom to KML bounds
        if (polygon.getBounds()) {
          mapRef.current.fitBounds(polygon.getBounds(), { padding: [50, 50] });
        }
      } else if (geometry.type === "MultiPolygon") {
        const featureGroup = L.featureGroup();
        geometry.coordinates.forEach((polygonCoords: number[][][]) => {
          const latLngs = polygonCoords[0].map((coord: number[]) => [coord[1], coord[0]]);
          const polygon = L.polygon(latLngs, {
            color: "orange",
            fillColor: "lightyellow",
            fillOpacity: 0.4,
            weight: 3,
          });
          featureGroup.addLayer(polygon);
        });
        featureGroup.addTo(mapRef.current);
        kmlLayerRef.current = featureGroup;

        // Auto-zoom to MultiPolygon bounds
        if (featureGroup.getBounds()) {
          mapRef.current.fitBounds(featureGroup.getBounds(), { padding: [50, 50] });
        }
      }
    } catch (error) {
      console.error("Error displaying KML AOI:", error);
    }
  }, [uploadedAOI]);

  const addDrawingControls = (
    map: L.Map,
    featureGroup: L.FeatureGroup,
    onAOIChange: (coordinates: number[][][]) => void
  ) => {
    // Create custom drawing toolbar
    const toolbar = L.control({ position: "topright" });
    
    toolbar.onAdd = () => {
      const div = L.DomUtil.create("div", "leaflet-draw-toolbar leaflet-bar");
      div.style.backgroundColor = "white";
      div.style.borderRadius = "4px";
      
      // Draw polygon button
      const polygonBtn = L.DomUtil.create("a", "leaflet-draw-edit-draw-polygon", div);
      polygonBtn.href = "#";
      polygonBtn.title = "Draw Polygon";
      polygonBtn.innerHTML = "✏️ Polygon";
      
      polygonBtn.addEventListener("click", (e) => {
        e.preventDefault();
        startDrawingPolygon(map, featureGroup, onAOIChange);
      });
      
      // Draw rectangle button
      const rectBtn = L.DomUtil.create("a", "leaflet-draw-edit-draw-rectangle", div);
      rectBtn.href = "#";
      rectBtn.title = "Draw Rectangle";
      rectBtn.innerHTML = "📦 Rect";
      
      rectBtn.addEventListener("click", (e) => {
        e.preventDefault();
        startDrawingRectangle(map, featureGroup, onAOIChange);
      });
      
      // Clear button
      const clearBtn = L.DomUtil.create("a", "leaflet-draw-edit-remove", div);
      clearBtn.href = "#";
      clearBtn.title = "Clear Drawings";
      clearBtn.innerHTML = "🗑️ Clear";
      
      clearBtn.addEventListener("click", (e) => {
        e.preventDefault();
        featureGroup.eachLayer((layer) => {
          if (!(layer instanceof L.Polygon && layer.getLatLngs()[0].length === 5 && 
                layer.getLatLngs()[0][0].lat === 31.5)) {
            featureGroup.removeLayer(layer);
          }
        });
      });
      
      return div;
    };
    
    toolbar.addTo(map);
  };

  const startDrawingPolygon = (
    map: L.Map,
    featureGroup: L.FeatureGroup,
    onAOIChange: (coordinates: number[][][]) => void
  ) => {
    const points: L.LatLng[] = [];
    const polyline = L.polyline([], { color: "red", weight: 2 }).addTo(map);
    
    const onMapClick = (e: L.LeafletMouseEvent) => {
      points.push(e.latlng);
      polyline.setLatLngs(points);
      
      if (points.length === 1) {
        showToast("Click to add vertices, double-click to finish");
      }
    };
    
    const onMapDblClick = () => {
      if (points.length >= 3) {
        // Close the polygon
        const closedPoints = [...points, points[0]];
        const polygon = L.polygon(closedPoints, {
          color: "green",
          fillColor: "lightgreen",
          fillOpacity: 0.3,
          weight: 2,
        }).addTo(featureGroup);
        
        extractCoordinates(polygon, onAOIChange);
        showToast("Polygon created!");
      }
      
      map.off("click", onMapClick);
      map.off("dblclick", onMapDblClick);
      map.removeLayer(polyline);
    };
    
    map.on("click", onMapClick);
    map.on("dblclick", onMapDblClick);
    showToast("Click on the map to start drawing polygon");
  };

  const startDrawingRectangle = (
    map: L.Map,
    featureGroup: L.FeatureGroup,
    onAOIChange: (coordinates: number[][][]) => void
  ) => {
    let corner1: L.LatLng | null = null;
    const rectangle = L.polyline([], { color: "red", weight: 2, dashArray: "5, 5" }).addTo(map);
    
    const onMapClick = (e: L.LeafletMouseEvent) => {
      if (!corner1) {
        corner1 = e.latlng;
        showToast("Click again to complete rectangle");
      } else {
        const corner2 = e.latlng;
        const rect = L.rectangle(
          [
            [Math.min(corner1.lat, corner2.lat), Math.min(corner1.lng, corner2.lng)],
            [Math.max(corner1.lat, corner2.lat), Math.max(corner1.lng, corner2.lng)],
          ],
          {
            color: "green",
            fillColor: "lightgreen",
            fillOpacity: 0.3,
            weight: 2,
          }
        ).addTo(featureGroup);
        
        extractCoordinates(rect, onAOIChange);
        showToast("Rectangle created!");
        
        map.off("click", onMapClick);
        map.removeLayer(rectangle);
      }
    };
    
    map.on("click", onMapClick);
    showToast("Click on the map to draw rectangle");
  };

  const extractCoordinates = (
    layer: L.Polygon | L.Rectangle,
    onAOIChange: (coordinates: number[][][]) => void
  ) => {
    const latlngs = layer.getLatLngs() as L.LatLng[][];
    const coords: number[][][] = [
      latlngs[0].map((ll) => [ll.lng, ll.lat]),
    ];
    onAOIChange(coords);
  };

  const showToast = (message: string) => {
    console.log(message);
    // Would integrate with toast component in real app
  };

  return (
    <div className="space-y-4">
      <div id="map" className="w-full h-96 rounded-lg border border-border shadow-md" />
      <div className="text-xs text-muted-foreground p-3 bg-muted rounded-lg">
        <p className="font-medium mb-2">📍 How to use:</p>
        <ul className="space-y-1 list-disc list-inside">
          <li><strong>Polygon:</strong> Click vertices, double-click to finish</li>
          <li><strong>Rectangle:</strong> Click two opposite corners</li>
          <li><strong>Clear:</strong> Remove all drawn shapes (keeps example)</li>
          <li>The blue dashed box shows example lake (31.5-31.6°N, 74.2-74.3°E)</li>
        </ul>
      </div>
    </div>
  );
};

export default MapViewer;
