import { useRef, useEffect } from "react";
import { MapContainer, TileLayer, FeatureGroup, Polygon } from "react-leaflet";
import { EditControl } from "react-leaflet-draw";
import L from 'leaflet';
import { leafletToGeoJSON } from "@/lib/geojson";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";

interface MapSectionProps {
  uploadedAOI: GeoJSON.Geometry | null;
  onAOIChange: (geometry: GeoJSON.Geometry | null) => void;
  aoiSource: "draw" | "upload" | "predefined";
  setAoiSource: (source: "draw" | "upload" | "predefined") => void;
  setUploadedAOI: (aoi: any) => void;
  setSelectedLakeId: (id: string) => void;
  onToast: (title: string, description: string) => void;
}

// Fix Leaflet default icon
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

export const MapSection = ({
  uploadedAOI,
  onAOIChange,
  aoiSource,
  setAoiSource,
  setUploadedAOI,
  setSelectedLakeId,
  onToast
}: MapSectionProps) => {
  const mapRef = useRef<L.Map>(null);
  const featureGroupRef = useRef<L.FeatureGroup>(null);

  // Handle polygon creation
  const onCreated = (e: any) => {
    const geoJSON = leafletToGeoJSON(e.layer);
    onAOIChange(geoJSON);
    setAoiSource('draw');
  };

  // Handle polygon editing
  const onEdited = (e: any) => {
    const layers = e.layers;
    layers.eachLayer((layer: any) => {
      const geoJSON = leafletToGeoJSON(layer);
      onAOIChange(geoJSON);
    });
  };

  const onDeleted = () => {
    onAOIChange(null);
    setAoiSource("draw");
  };

  // Fit map to uploaded/predefined AOI bounds
  useEffect(() => {
    if (uploadedAOI && mapRef.current && (aoiSource === 'upload' || aoiSource === 'predefined')) {
      const coords =
        uploadedAOI.type === "Polygon"
          ? uploadedAOI.coordinates
          : uploadedAOI.type === "MultiPolygon"
            ? uploadedAOI.coordinates[0]
            : null;

      if (coords && coords[0]) {
        const latLngs = coords[0].map((c: number[]) => [c[1], c[0]]);
        const bounds = L.latLngBounds(latLngs);
        mapRef.current.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [uploadedAOI, aoiSource]);

  return (
    <div style={{ height: "400px", width: "100%" }} className="border rounded-lg overflow-hidden bg-slate-100">
      <MapContainer
        ref={mapRef}
        center={[17.45, 78.38]}
        zoom={15}
        style={{ height: "400px", width: "100%" }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        <FeatureGroup ref={featureGroupRef}>
          <EditControl
            position="topright"
            onCreated={onCreated}
            onEdited={onEdited}
            onDeleted={onDeleted}
            draw={{
              polygon: {
                allowIntersection: false,
                showArea: true
              },
              rectangle: false,
              circle: false,
              marker: false,
              polyline: false,
              circlemarker: false
            }}
            edit={{
              edit: false,
              remove: true
            }}
          />
        </FeatureGroup>

        {uploadedAOI && (aoiSource === 'upload' || aoiSource === 'predefined') && (
          <Polygon
            positions={
              (
                uploadedAOI.type === "Polygon"
                  ? uploadedAOI.coordinates[0]
                  : uploadedAOI.type === "MultiPolygon"
                    ? uploadedAOI.coordinates[0][0]
                    : []
              ).map((c: number[]) => [c[1], c[0]])
            }
            pathOptions={{
              color: aoiSource === 'predefined' ? '#3b82f6' : '#10b981',
              fillColor: aoiSource === 'predefined' ? '#93c5fd' : '#6ee7b7',
              fillOpacity: 0.3,
              weight: 2
            }}
          />
        )}
      </MapContainer>
    </div>
  );
};
