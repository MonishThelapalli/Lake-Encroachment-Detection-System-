import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, GeoJSON, ZoomControl, useMap, Pane } from 'react-leaflet';
import { LatLngBounds, Map as LeafletMap } from 'leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Checkbox } from '@/components/ui/checkbox';
import type { ClassifiedTileSet, ClassifiedLayerName } from '@/types/analysis';

// ─── GEE-style class colours ────────────────────────────────────────────────
const CLASS_COLORS: Record<string, string> = {
    Water: '#4285F4',
    BuiltUp: '#ff0000',
    Vegetation: '#00ff00',
    BareSoil: '#ffb300',
};

interface MapData {
    tile_url?: string;
    class_tiles?: ClassifiedTileSet;
    classified_geojson?: GeoJSON.FeatureCollection | null;
    bounds?: number[][][];
    aoi_geojson?: any;
}

interface LayerState {
    Water: boolean;
    BuiltUp: boolean;
    Vegetation: boolean;
    BareSoil: boolean;
    Encroachment: boolean;
}

interface DualLakeViewerProps {
    t1?: MapData;
    t2?: MapData;
    encroachment?: any;
    dateT1: string;
    dateT2: string;
    stats?: {
        t1WaterPx: number;
        t2WaterPx: number;
        netChange: number;
    };
}



// ─── Inner sync helper will be replaced by direct ref use ───────────────

// ─── FitBounds component ──────────────────────────────────────────────────────
const FitBounds: React.FC<{ bounds: any }> = ({ bounds }) => {
    const map = useMap();
    useEffect(() => {
        if (map && bounds) {
            map.fitBounds(bounds, { padding: [30, 30], animate: true });
        }
    }, [map, bounds]);
    return null;
};

// ─── InvalidateSize component ─────────────────────────────────────────────────
const InvalidateSize: React.FC = () => {
    const map = useMap();
    useEffect(() => {
        const t = setTimeout(() => map.invalidateSize(), 300);
        return () => clearTimeout(t);
    }, [map]);
    return null;
};

// ─── Overlay renderer (stable per map) ───────────────────────────────────────
interface OverlayProps { data?: MapData; layers: LayerState; cacheKey: string; }

// const MapOverlay: React.FC<OverlayProps> = ({ data, layers, cacheKey }) => {
//     if (!data) return null;

//     // Priority 1: single combined GEE tile URL

//     if (data.tile_url) {
//         console.debug(`[DualLakeViewer] ${cacheKey} → rendering single tile_url: ${data.tile_url.slice(0, 80)}…`);
//         return <TileLayer key={`${cacheKey}-tile`} url={data.tile_url} opacity={0.9} zIndex={20} maxZoom={19} />;
//     }

//     // Priority 2: GeoJSON fallback
//     if (data.classified_geojson) {
//         const fc = data.classified_geojson;
//         const featureCount = 'features' in fc ? fc.features?.length ?? 0 : 0;
//         console.debug(`[DualLakeViewer] ${cacheKey} → GeoJSON fallback (${featureCount} features)`);
//         const style = makeGeoJSONStyle(layers);
//         return (
//             <GeoJSON
//                 key={`${cacheKey}-geojson-${JSON.stringify(layers)}`}
//                 data={fc}
//                 style={style}
//             />
//         );
//     }

//     console.warn(`[DualLakeViewer] ${cacheKey} → NO tile_url, class_tiles, or classified_geojson found!`, data);
//     return null;
// };
const MapOverlay: React.FC<OverlayProps> = ({ data, layers, cacheKey }) => {
    const tileUrl = useMemo(() => {
        if (data?.tile_url) {
            console.log(`[DualLakeViewer] rendering GEE raster`);
        }
        return data?.tile_url;
    }, [data?.tile_url]);

    if (!layers.Water && !layers.BuiltUp && !layers.Vegetation && !layers.BareSoil) {
        return null;
    }


    if (!data || Object.keys(data).length === 0) {
        return <div style={{ padding: "20px", color: "red", fontWeight: "bold" }}>No data available for this AOI</div>;
    }


    if (!tileUrl) {
        return (
            <div className="absolute inset-0 z-[9999] flex items-center justify-center bg-slate-50 border-4 border-red-500/20 p-6 text-center">
                <div className="bg-red-50 rounded-lg p-4 border border-red-200 shadow-sm">
                    <h3 className="text-red-700 font-bold mb-1">Rendering Error</h3>
                    <p className="text-red-600 text-sm">Failed to load high-resolution satellite tiles.<br />Fallback grid rendering has been disabled.</p>
                </div>
            </div>
        );
    }

    return (
        <Pane name="gee-layer" style={{ zIndex: 1000 }}>
            <TileLayer
                key={tileUrl}
                url={tileUrl}
                opacity={0.8}
            />
        </Pane>
    );
};
// ─── Main Component ────────────────────────────────────────────────────────────
const DualLakeViewer: React.FC<DualLakeViewerProps> = ({
    t1, t2, encroachment, dateT1, dateT2, stats,
}) => {
    const map1Ref = useRef<LeafletMap | null>(null);
    const map2Ref = useRef<LeafletMap | null>(null);
    const isSyncing = useRef(false);

    const [layers, setLayers] = useState<LayerState>({
        Water: true, BuiltUp: true, Vegetation: true, BareSoil: true, Encroachment: false,
    });

    const toggleLayer = useCallback((layer: keyof LayerState) => {
        setLayers(prev => ({ ...prev, [layer]: !prev[layer] }));
    }, []);

    // Debug data on mount / change
    useEffect(() => {
        console.log("t1.tile_url:", t1?.tile_url);
        console.log("t2.tile_url:", t2?.tile_url);
        console.log("RECEIVED BOUNDS:", t1?.bounds);
    }, [t1, t2]);

    useEffect(() => {
        const setup = () => {
            const map1 = map1Ref.current;
            const map2 = map2Ref.current;
            if (!map1 || !map2) return;

            // Single shared flag — prevents A→B→A→B infinite calls.
            // Using a ref (not local var) so both handlers share the same slot.
            const syncing = { current: false };

            const onMap1Move = () => {
                if (syncing.current) return;
                syncing.current = true;
                map2.setView(map1.getCenter(), map1.getZoom(), { animate: false });
                syncing.current = false;
            };

            const onMap2Move = () => {
                if (syncing.current) return;
                syncing.current = true;
                map1.setView(map2.getCenter(), map2.getZoom(), { animate: false });
                syncing.current = false;
            };

            // moveend fires ONCE after animation completes — not continuously during pan.
            map1.on('moveend', onMap1Move);
            map2.on('moveend', onMap2Move);

            return () => {
                map1.off('moveend', onMap1Move);
                map2.off('moveend', onMap2Move);
            };
        };

        // If maps aren't ready yet, retry after a short delay.
        if (map1Ref.current && map2Ref.current) {
            return setup();
        }
        const timer = setTimeout(setup, 200);
        return () => clearTimeout(timer);
    }, []); // Only run once on mount — maps don't change.

    const displayBounds = useMemo(() => {
        if (t1?.bounds?.length === 2) {
            const [[minLat, minLng], [maxLat, maxLng]] = t1.bounds;
            return L.latLngBounds([minLat, minLng], [maxLat, maxLng]);
        }
        return null;
    }, [t1]);

    const mapStyle: React.CSSProperties = { height: '100%', width: '100%' };

    return (
        <div className="border border-slate-200 rounded-xl shadow-sm bg-white overflow-hidden flex flex-col">

            {/* ── Layer Toggle Bar ─────────────────────────────────────────────── */}
            <div className="flex flex-col border-b border-slate-100 bg-slate-50">
                <div className="flex flex-wrap items-center justify-center gap-5 px-4 py-3">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Layers:</span>
                    {(['Water', 'BuiltUp', 'Vegetation', 'BareSoil', 'Encroachment'] as const).map(layer => (
                        <label key={layer} className="flex items-center gap-2 cursor-pointer select-none">
                            <Checkbox
                                checked={layers[layer]}
                                onCheckedChange={() => toggleLayer(layer)}
                                className="data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                            />
                            <span className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-700">
                                {layer !== 'Encroachment' && (
                                    <span className="inline-block w-3 h-3 rounded-[2px]"
                                        style={{ backgroundColor: CLASS_COLORS[layer] ?? '#ff0000' }} />
                                )}
                                {layer}
                            </span>
                        </label>
                    ))}
                    <span className="text-[10px] text-slate-400 font-medium ml-2 border-l border-slate-200 pl-4 hidden md:inline-block">Layer filtering is limited for raster output</span>
                </div>
            </div>

            {/* ── Maps ─────────────────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 h-[600px]">

                {/* Map 1: T1 BEFORE */}
                <div className="relative h-full">
                    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[400] bg-white/95 text-slate-800 font-bold px-4 py-1.5 rounded-full shadow-md text-sm border border-slate-200 pointer-events-none whitespace-nowrap">
                        📅 Before: {dateT1 || '—'}
                    </div>
                    {displayBounds && (
                        <MapContainer
                            key={JSON.stringify(t1?.bounds)}
                            ref={map1Ref}
                            bounds={displayBounds}
                            zoomControl={false}
                            style={{ height: "600px", width: "100%" }}
                        >
                            <InvalidateSize />
                            <FitBounds bounds={displayBounds} />
                            <TileLayer
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                attribution="&copy; OpenStreetMap contributors"
                            />
                            <MapOverlay data={t1} layers={layers} cacheKey="t1" />
                            {t1?.aoi_geojson && (
                                <GeoJSON
                                    key="aoi-boundary-t1"
                                    data={t1.aoi_geojson as any}
                                    style={{
                                        color: "#000000",
                                        weight: 2,
                                        fillOpacity: 0,
                                        opacity: 1
                                    }}
                                />
                            )}
                        </MapContainer>
                    )}
                </div>

                {/* Map 2: T2 AFTER */}
                <div className="relative h-full">
                    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[400] bg-white/95 text-slate-800 font-bold px-4 py-1.5 rounded-full shadow-md text-sm border border-slate-200 pointer-events-none whitespace-nowrap">
                        📅 After: {dateT2 || '—'}
                    </div>
                    {displayBounds && (
                        <MapContainer
                            key={JSON.stringify(t2?.bounds)}
                            ref={map2Ref}
                            bounds={displayBounds}
                            zoomControl={false}
                            style={{ height: "600px", width: "100%" }}
                        >
                            <ZoomControl position="topleft" />
                            <InvalidateSize />
                            <FitBounds bounds={displayBounds} />
                            <TileLayer
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                attribution="&copy; OpenStreetMap contributors"
                            />
                            <MapOverlay data={t2} layers={layers} cacheKey="t2" />
                            {t2?.aoi_geojson && (
                                <GeoJSON
                                    key="aoi-boundary-t2"
                                    data={t2.aoi_geojson as any}
                                    style={{
                                        color: "#000000",
                                        weight: 2,
                                        fillOpacity: 0,
                                        opacity: 1
                                    }}
                                />
                            )}

                            {/* Encroachment — always GeoJSON, solid red, rendered last (on top) */}
                            {layers.Encroachment && encroachment?.geojson && (
                                <GeoJSON
                                    key="encroachment-layer"
                                    data={encroachment.geojson}
                                    style={{ color: "red", fillColor: "#ff0000", fillOpacity: 0.85, weight: 1.5 }}
                                />
                            )}

                            {/* Floating Legend */}
                            <div className="absolute bottom-5 right-5 bg-white/96 p-3.5 rounded-xl shadow-lg border border-slate-100 z-[400] min-w-[130px]">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5">Legend</p>
                                <div className="space-y-2">
                                    {Object.entries(CLASS_COLORS).map(([cls, color]) => (
                                        <div key={cls} className="flex items-center gap-2.5">
                                            <span className="w-3.5 h-3.5 rounded-[3px] flex-shrink-0" style={{ backgroundColor: color }} />
                                            <span className="text-[12px] font-semibold text-slate-700">{cls}</span>
                                        </div>
                                    ))}
                                    <div className="flex items-center gap-2.5 pt-0.5 border-t border-slate-100 mt-1">
                                        <span className="w-3.5 h-3.5 rounded-[3px] flex-shrink-0 bg-red-600" />
                                        <span className="text-[12px] font-semibold text-slate-700">Encroachment</span>
                                    </div>
                                </div>
                            </div>
                        </MapContainer>
                    )}
                </div>
            </div>

            {/* ── Stats Footer ─────────────────────────────────────────────────── */}
            <div className="grid grid-cols-3 divide-x divide-slate-100 bg-white border-t border-slate-200">
                <div className="p-4 text-center">
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">T1 (Before) Water</div>
                    <div className="text-lg font-extrabold text-slate-800">{stats?.t1WaterPx?.toLocaleString() ?? '—'} px</div>
                </div>
                <div className="p-4 text-center bg-red-50/40">
                    <div className="text-[10px] text-red-400 font-bold uppercase tracking-wider mb-1">Net Change</div>
                    <div className="text-lg font-extrabold text-red-600">
                        {(stats?.netChange ?? 0) > 0 ? '+' : ''}{(stats?.netChange ?? 0).toFixed(1)}%
                    </div>
                </div>
                <div className="p-4 text-center">
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">T2 (After) Water</div>
                    <div className="text-lg font-extrabold text-slate-800">{stats?.t2WaterPx?.toLocaleString() ?? '—'} px</div>
                </div>
            </div>
        </div>
    );
};

export default DualLakeViewer;
