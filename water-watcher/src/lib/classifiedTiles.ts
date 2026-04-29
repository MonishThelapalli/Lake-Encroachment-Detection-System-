import type { ClassifiedLayerName, ClassifiedTileSet } from "@/types/analysis";

export const CLASS_LAYER_ORDER: ClassifiedLayerName[] = [
  "Water",
  "BuiltUp",
  "Vegetation",
  "BareSoil",
];

export const CLASS_LAYER_COLORS: Record<ClassifiedLayerName, string> = {
  Water: "#1f78ff",
  BuiltUp: "#d73027",
  Vegetation: "#2e8b57",
  BareSoil: "#fdae61",
};

export function hasClassTileLayers(classTiles?: ClassifiedTileSet | null): boolean {
  return CLASS_LAYER_ORDER.some((layerName) => Boolean(classTiles?.[layerName]));
}
