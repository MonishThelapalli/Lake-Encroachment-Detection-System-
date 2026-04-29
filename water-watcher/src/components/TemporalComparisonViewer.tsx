import React, { useEffect, useMemo, useRef } from "react";
import { GeoJSON, MapContainer, TileLayer } from "react-leaflet";
import { LatLngBounds, Map as LeafletMap } from "leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface TemporalComparisonViewerProps {
  t1TileUrl?: string;
  t2TileUrl?: string;
  bounds: LatLngBounds;
  dateT1: string;
  dateT2: string;
}

const CLASS_COLORS: Record<string, string> = {
  Water: "#1f78ff",
  Vegetation: "#2e8b57",
  BareSoil: "#8b5a2b",
  BuiltUp: "#d73027",
};



const TemporalComparisonViewer: React.FC<TemporalComparisonViewerProps> = ({
  t1TileUrl,
  t2TileUrl,
  bounds,
  dateT1,
  dateT2,
}) => {
  const leftMapRef = useRef<LeafletMap | null>(null);
  const rightMapRef = useRef<LeafletMap | null>(null);
  const syncingRef = useRef(false);

  const center = bounds.getCenter();

  useEffect(() => {
    const left = leftMapRef.current;
    const right = rightMapRef.current;
    if (!left || !right) return;

    const sync =
      (source: LeafletMap, target: LeafletMap) =>
        () => {
          if (syncingRef.current) return;
          syncingRef.current = true;
          target.setView(source.getCenter(), source.getZoom(), { animate: false });
          syncingRef.current = false;
        };

    const leftToRight = sync(left, right);
    const rightToLeft = sync(right, left);

    left.on("move", leftToRight);
    left.on("zoom", leftToRight);
    right.on("move", rightToLeft);
    right.on("zoom", rightToLeft);

    return () => {
      left.off("move", leftToRight);
      left.off("zoom", leftToRight);
      right.off("move", rightToLeft);
      right.off("zoom", rightToLeft);
    };
  }, [bounds]);



  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-white/80 px-4 py-3">
        <span className="text-sm font-semibold">Legend</span>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: CLASS_COLORS.BuiltUp }} />
          <span className="text-xs">BuiltUp</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: CLASS_COLORS.Vegetation }} />
          <span className="text-xs">Vegetation</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: CLASS_COLORS.BareSoil }} />
          <span className="text-xs">BareSoil</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: CLASS_COLORS.Water }} />
          <span className="text-xs">Water</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2" style={{ minHeight: "620px" }}>
        <div className="overflow-hidden rounded-lg border bg-white">
          <div className="border-b bg-sky-50 px-4 py-2 text-center text-sm font-semibold text-sky-900">
            T1 Classified - {dateT1}
          </div>
          <MapContainer
            ref={leftMapRef}
            center={center}
            zoom={14}
            style={{ height: "560px", width: "100%" }}
            bounds={bounds}
            maxBounds={bounds.pad(0.15)}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            {t1TileUrl && <TileLayer key={t1TileUrl} url={t1TileUrl} maxZoom={19} opacity={1} zIndex={10} />}
          </MapContainer>
        </div>

        <div className="overflow-hidden rounded-lg border bg-white">
          <div className="border-b bg-emerald-50 px-4 py-2 text-center text-sm font-semibold text-emerald-900">
            T2 Classified - {dateT2}
          </div>
          <MapContainer
            ref={rightMapRef}
            center={center}
            zoom={14}
            style={{ height: "560px", width: "100%" }}
            bounds={bounds}
            maxBounds={bounds.pad(0.15)}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            {t2TileUrl && <TileLayer key={t2TileUrl} url={t2TileUrl} maxZoom={19} opacity={1} zIndex={10} />}
          </MapContainer>
        </div>
      </div>
    </div>
  );
};

export default TemporalComparisonViewer;
