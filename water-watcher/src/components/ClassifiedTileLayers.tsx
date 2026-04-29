import { useEffect } from "react";
import { TileLayer } from "react-leaflet";

import { CLASS_LAYER_ORDER, hasClassTileLayers } from "@/lib/classifiedTiles";
import type { ClassifiedLayerName, ClassifiedTileSet } from "@/types/analysis";

interface ClassifiedTileLayersProps {
  classTiles?: ClassifiedTileSet | null;
  fallbackTileUrl?: string | null;
  visible?: Partial<Record<ClassifiedLayerName, boolean>>;
  opacity?: number;
  maxZoom?: number;
  zIndexBase?: number;
}

const ClassifiedTileLayers = ({
  classTiles,
  fallbackTileUrl,
  visible,
  opacity = 0.82,
  maxZoom = 19,
  zIndexBase = 10,
}: ClassifiedTileLayersProps) => {
  useEffect(() => {
    if (hasClassTileLayers(classTiles)) {
      console.log("Mounted class tile layers:", classTiles);
    } else if (fallbackTileUrl) {
      console.log("Mounted fallback classified tile:", fallbackTileUrl);
    }
  }, [classTiles, fallbackTileUrl]);

  if (!hasClassTileLayers(classTiles)) {
    return fallbackTileUrl ? (
      <TileLayer
        key={fallbackTileUrl}
        url={fallbackTileUrl}
        maxZoom={maxZoom}
        opacity={opacity}
        zIndex={zIndexBase}
      />
    ) : null;
  }

  return (
    <>
      {CLASS_LAYER_ORDER.map((layerName, index) => {
        const tileUrl = classTiles?.[layerName];
        if (!tileUrl || visible?.[layerName] === false) {
          return null;
        }
        return (
          <TileLayer
            key={`${layerName}-${tileUrl}`}
            url={tileUrl}
            maxZoom={maxZoom}
            opacity={opacity}
            zIndex={zIndexBase + index}
          />
        );
      })}
    </>
  );
};

export default ClassifiedTileLayers;
