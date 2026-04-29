import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface ClassifiedMapProps {
  tileUrl: string;
  center: [number, number];
  zoom: number;
  className?: string;
  attribution?: string;
  onError?: (error: string) => void;
  aoi?: GeoJSON.Geometry; // Add AOI for bounds
}

const ClassifiedMap: React.FC<ClassifiedMapProps> = ({
  tileUrl,
  center,
  zoom,
  className = "",
  attribution = 'Google Earth Engine',
  onError,
  aoi
}) => {
  const mapRef = useRef<L.Map>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    if (mapRef.current && tileUrl) {
      const map = mapRef.current;
      
      // 🔥 STEP 6: Clear old layers before adding new ones
      map.eachLayer((layer) => {
        map.removeLayer(layer);
      });

      // 🔥 STEP 2: Add base map FIRST
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
      }).addTo(map);

      // 🔥 STEP 3: Add GEE tile layer properly
      L.tileLayer(tileUrl, {
        maxZoom: 18,
        minZoom: 8,
        tileSize: 256,
        crossOrigin: true,
        attribution: attribution
      }).addTo(map);

      // 🔥 STEP 1: Fit map to AOI bounds if available
      if (aoi) {
        try {
          const bounds = L.geoJSON(aoi).getBounds();
          if (bounds.isValid()) {
            map.fitBounds(bounds);
          }
        } catch (boundsError) {
          console.warn('Failed to fit bounds:', boundsError);
          // 🔥 STEP 4: Force map center as fallback
          map.setView([17.537, 78.407], 14);
        }
      } else {
        // 🔥 STEP 4: Force map center as fallback
        map.setView(center, zoom);
      }

      // 🔥 STEP 7: Debug tile loading
      console.log("T1 Tile URL:", tileUrl);
      console.log("Map center:", center);
      console.log("Map zoom:", zoom);
    }
  }, [tileUrl, center, zoom, aoi]);

  const handleTileError = () => {
    const errorMsg = `Failed to load map tiles from ${tileUrl}`;
    setMapError(errorMsg);
    onError?.(errorMsg);
  };

  if (mapError) {
    return (
      <div className={`w-full h-full flex items-center justify-center bg-gray-100 ${className}`}>
        <div className="text-center p-4">
          <div className="text-red-500 text-sm mb-2">⚠️ Map Error</div>
          <p className="text-gray-600 text-sm">{mapError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full h-full ${className}`} style={{ height: '500px', width: '100%' }}>
      <MapContainer
        ref={mapRef}
        center={center}
        zoom={zoom}
        className="w-full h-full"
        zoomControl={true}
        whenCreated={(map) => {
          // 🔥 Initial setup when map is created
          map.setView([17.537, 78.407], 14);
          
          // Add base map initially
          L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution: '© OpenStreetMap contributors'
          }).addTo(map);
        }}
      >
        {/* Tile layers will be added programmatically */}
      </MapContainer>
    </div>
  );
};

export default ClassifiedMap;
