import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import ClassifiedTileLayers from '@/components/ClassifiedTileLayers';
import { CLASS_LAYER_COLORS, hasClassTileLayers } from '@/lib/classifiedTiles';

// ── Sync maps logic ─────────────────────────────────────────────────────────
function syncMaps(map1: L.Map | null, map2: L.Map | null) {
    if (!map1 || !map2) return () => { };

    let isSyncing = false;

    const onMap1Move = () => {
        if (isSyncing) return;
        isSyncing = true;
        map2.setView(map1.getCenter(), map1.getZoom(), { animate: false });
        setTimeout(() => { isSyncing = false; }, 50);
    };

    const onMap2Move = () => {
        if (isSyncing) return;
        isSyncing = true;
        map1.setView(map2.getCenter(), map2.getZoom(), { animate: false });
        setTimeout(() => { isSyncing = false; }, 50);
    };

    map1.on('move', onMap1Move);
    map2.on('move', onMap2Move);

    return () => {
        map1.off('move', onMap1Move);
        map2.off('move', onMap2Move);
    };
}

// ── MapInstanceCapturer ──────────────────────────────────────────────────────
function MapInstanceCapturer({ setMap }: { setMap: (map: L.Map) => void }) {
    const map = useMap();
    useEffect(() => {
        if (map) setMap(map);
    }, [map, setMap]);
    return null;
}

// ── FitBounds ─────────────────────────────────────────────────────────────────
// Prefers AOI (the drawn polygon); falls back to any GeoJSON FeatureCollection.
function FitBounds({ aoi, geojson }: { aoi?: any; geojson?: any }) {
    const map = useMap();
    useEffect(() => {
        // Priority 1: fit to the AOI outline
        if (aoi) {
            try {
                const layer = L.geoJSON(aoi);
                const bounds = layer.getBounds();
                if (bounds.isValid()) {
                    map.fitBounds(bounds, { padding: [20, 20] });
                    return;
                }
            } catch (e) {
                console.error('Error fitting AOI bounds', e);
            }
        }
        // Priority 2: fall back to classified GeoJSON
        if (!geojson || geojson.type !== 'FeatureCollection') return;
        try {
            const layer = L.geoJSON(geojson);
            const bounds = layer.getBounds();
            if (!bounds.isValid()) return;
            map.fitBounds(bounds, { padding: [20, 20] });
        } catch (e) {
            console.error('Error fitting GeoJSON bounds', e);
        }
    }, [aoi, geojson, map]);
    return null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const ENCROACHMENT_COLOR = '#FF0000';

function filterGeoJSON(geojson: any, showClasses: Record<string, boolean>) {
    if (!geojson || !geojson.features) return null;
    const filteredFeatures = geojson.features.filter((f: any) => {
        const cls = f.properties?.class || f.properties?.Class;
        if (cls === 'Encroachment') return showClasses.Encroachment;
        if (!cls && f.properties?.color === '#444444') return true;
        return showClasses[cls] ?? true;
    });

    // Cap at 3000 features for performance
    if (filteredFeatures.length > 3000) {
        filteredFeatures.length = 3000;
    }

    return { ...geojson, features: filteredFeatures };
}

// ── CartoDB Voyager base tile — lighter, higher contrast than OSM ─────────────
const CARTO_VOYAGER_URL =
    'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const CARTO_ATTRIBUTION =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>';

// ── Component ─────────────────────────────────────────────────────────────────
interface DualMapViewerProps {
    data: any;
    baseAoi?: any;
    t1Date: string;
    t2Date: string;
}

const DualMapViewer: React.FC<DualMapViewerProps> = ({ data, baseAoi, t1Date, t2Date }) => {
    const [map1, setMap1] = useState<L.Map | null>(null);
    const [map2, setMap2] = useState<L.Map | null>(null);

    const [filters, setFilters] = useState({
        Water: true,
        BuiltUp: true,
        Vegetation: true,
        BareSoil: true,
        Encroachment: true,
    });

    useEffect(() => {
        return syncMaps(map1, map2);
    }, [map1, map2]);

    useEffect(() => {
        const timer = setTimeout(() => {
            map1?.invalidateSize();
            map2?.invalidateSize();
        }, 200);
        return () => clearTimeout(timer);
    }, [map1, map2]);

    // ── Extract tile data from API result ──────────────────────────────────────
    const t1TileUrl = data?.t1?.tile_url;
    const t2TileUrl = data?.t2?.tile_url;
    const t1ClassTiles = data?.t1?.class_tiles;
    const t2ClassTiles = data?.t2?.class_tiles;

    // Visibility map fed into ClassifiedTileLayers (controls per-class GEE tiles)
    const rasterVisibility = {
        Water: filters.Water,
        BuiltUp: filters.BuiltUp,
        Vegetation: filters.Vegetation,
        BareSoil: filters.BareSoil,
    };

    // True when at least one GEE tile URL is available for each time period
    const hasT1Raster = hasClassTileLayers(t1ClassTiles) || Boolean(t1TileUrl);
    const hasT2Raster = hasClassTileLayers(t2ClassTiles) || Boolean(t2TileUrl);

    // GeoJSON versions of each layer (used only as fallback when no tiles exist)
    const t1Filtered = useMemo(
        () => filterGeoJSON(data?.t1?.classified_geojson, filters),
        [data?.t1?.classified_geojson, filters],
    );
    const t2Filtered = useMemo(
        () => filterGeoJSON(data?.t2?.classified_geojson, filters),
        [data?.t2?.classified_geojson, filters],
    );

    useEffect(() => {
        if (t1ClassTiles || t2ClassTiles) {
            console.log('T1 class tiles:', t1ClassTiles);
            console.log('T2 class tiles:', t2ClassTiles);
        }
    }, [t1ClassTiles, t2ClassTiles]);

    const encroachmentRaw = useMemo(() => {
        const raw = data?.encroachment?.geojson;
        if (!raw || raw.type !== 'FeatureCollection' || !raw.features) return null;
        return {
            ...raw,
            features: raw.features.map((f: any) => ({
                ...f,
                properties: { ...f.properties, class: 'Encroachment' },
            })),
        };
    }, [data?.encroachment?.geojson]);

    const encroachmentFiltered = useMemo(
        () => filterGeoJSON(encroachmentRaw, filters),
        [encroachmentRaw, filters],
    );

    // ── Styles ─────────────────────────────────────────────────────────────────
    const aoiStyle = {
        color: '#000000',
        fillColor: 'transparent',
        weight: 2,
        dashArray: '5, 5',
        fillOpacity: 0,
    };

    const styleFeature = (feature: any) => {
        const cls = feature.properties?.class || feature.properties?.Class;
        const color =
            feature.properties?.color ||
            CLASS_LAYER_COLORS[cls as keyof typeof CLASS_LAYER_COLORS] ||
            '#444';

        if (cls === 'Encroachment') {
            return { color: ENCROACHMENT_COLOR, fillColor: ENCROACHMENT_COLOR, weight: 1, fillOpacity: 0.9 };
        }

        return { color, fillColor: color, weight: 1, fillOpacity: 0.6 };
    };

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col w-full h-full relative bg-slate-50">

            {/* Layer toggle checkboxes */}
            <div className="w-full bg-white border-b border-slate-200 p-3 shadow-sm z-10 flex flex-wrap gap-6 justify-center items-center">
                <span className="text-sm font-bold text-slate-500 mr-2">LAYERS:</span>
                {Object.entries(filters).map(([cls, isActive]) => (
                    <label key={cls} className="flex items-center gap-2 cursor-pointer group">
                        <input
                            type="checkbox"
                            checked={isActive}
                            onChange={() => setFilters(prev => ({ ...prev, [cls]: !isActive }))}
                            className="form-checkbox h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 cursor-pointer"
                        />
                        <span className="text-sm font-semibold text-slate-700 group-hover:text-slate-900 transition-colors">
                            {cls}
                        </span>
                    </label>
                ))}
            </div>

            {/* Dual Maps Layout */}
            <div style={{ display: 'flex' }} className="w-full min-h-[500px] relative select-none">

                {/* ── LEFT MAP: T1 ─────────────────────────────────────────────────── */}
                <div style={{ flex: 1 }} className="relative border-r border-slate-300 h-full flex flex-col bg-white overflow-hidden z-0" id="mapT1">
                    {/* Map label */}
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[400] bg-white/95 backdrop-blur px-5 py-2 rounded-full shadow-md text-sm font-black border border-slate-200 text-slate-800 tracking-wide pointer-events-none flex items-center gap-2">
                        T1 (Start Date) • {t1Date}
                        {hasT1Raster && (
                            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-full px-2 py-0.5 tracking-normal">
                                GEE
                            </span>
                        )}
                    </div>

                    <div className="w-full h-full min-h-[500px] relative">
                        <MapContainer
                            center={[17.4, 78.4]}
                            zoom={13}
                            style={{ height: '500px', width: '100%' }}
                            className="w-full h-full min-h-[500px]"
                            zoomControl={false}
                        >
                            <MapInstanceCapturer setMap={setMap1} />

                            {/* CartoDB Voyager base map */}
                            <TileLayer
                                url={CARTO_VOYAGER_URL}
                                attribution={CARTO_ATTRIBUTION}
                                maxZoom={19}
                            />

                            {/*
                             * GEE tile layers — PRIMARY renderer.
                             * ClassifiedTileLayers respects the `visible` prop, so layer
                             * toggle checkboxes control per-class GEE tile visibility.
                             * Default opacity is 0.82 (set in ClassifiedTileLayers), allowing
                             * the base map to show through.
                             */}
                            <ClassifiedTileLayers
                                classTiles={t1ClassTiles}
                                fallbackTileUrl={t1TileUrl}
                                visible={rasterVisibility}
                                zIndexBase={10}
                            />

                            {/* GeoJSON fallback — only rendered when NO tile URL exists at all */}
                            {!hasT1Raster && t1Filtered && (
                                <GeoJSON data={t1Filtered} style={styleFeature} />
                            )}

                            {/* AOI outline */}
                            {baseAoi && <GeoJSON data={baseAoi} style={aoiStyle} />}

                            {/* Auto-fit: prefers AOI, falls back to GeoJSON extent */}
                            <FitBounds aoi={baseAoi} geojson={data?.t1?.classified_geojson} />
                        </MapContainer>
                    </div>
                </div>

                {/* ── RIGHT MAP: T2 ────────────────────────────────────────────────── */}
                <div style={{ flex: 1 }} className="relative h-full flex flex-col bg-white overflow-hidden z-0" id="mapT2">
                    {/* Map label */}
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[400] bg-white/95 backdrop-blur px-5 py-2 rounded-full shadow-md text-sm font-black border border-slate-200 text-slate-800 tracking-wide pointer-events-none flex items-center gap-2">
                        T2 (End Date) • {t2Date}
                        {hasT2Raster && (
                            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-full px-2 py-0.5 tracking-normal">
                                GEE
                            </span>
                        )}
                    </div>

                    <div className="w-full h-full min-h-[500px] relative">
                        <MapContainer
                            center={[17.4, 78.4]}
                            zoom={13}
                            style={{ height: '500px', width: '100%' }}
                            className="w-full h-full min-h-[500px]"
                            zoomControl={true}
                        >
                            <MapInstanceCapturer setMap={setMap2} />

                            {/* CartoDB Voyager base map */}
                            <TileLayer
                                url={CARTO_VOYAGER_URL}
                                attribution={CARTO_ATTRIBUTION}
                                maxZoom={19}
                            />

                            {/* GEE tile layers — PRIMARY renderer */}
                            <ClassifiedTileLayers
                                classTiles={t2ClassTiles}
                                fallbackTileUrl={t2TileUrl}
                                visible={rasterVisibility}
                                zIndexBase={10}
                            />

                            {/* GeoJSON fallback — only rendered when NO tile URL exists at all */}
                            {!hasT2Raster && t2Filtered && (
                                <GeoJSON data={t2Filtered} style={styleFeature} />
                            )}

                            {/* AOI outline */}
                            {baseAoi && <GeoJSON data={baseAoi} style={aoiStyle} />}

                            {/* Encroachment — GEE tile layer when backend provides one, GeoJSON otherwise */}
                            {filters.Encroachment && data?.encroachment?.tile_url && (
                                <TileLayer
                                    key={data.encroachment.tile_url}
                                    url={data.encroachment.tile_url}
                                    maxZoom={19}
                                    opacity={0.9}
                                    zIndex={20}
                                />
                            )}
                            {filters.Encroachment && !data?.encroachment?.tile_url && encroachmentFiltered && (
                                <GeoJSON data={encroachmentFiltered} style={styleFeature} />
                            )}

                            {/* Auto-fit: prefers AOI, falls back to GeoJSON extent */}
                            <FitBounds aoi={baseAoi} geojson={data?.t2?.classified_geojson} />
                        </MapContainer>

                        {/* Legend Panel */}
                        <div className="map-legend absolute bottom-6 right-6 z-[400] bg-white/95 backdrop-blur border border-slate-200 p-4 rounded-xl shadow-2xl text-sm min-w-[160px] pointer-events-auto transition-shadow hover:shadow-black/10">
                            <h4 className="font-bold text-slate-800 mb-3 pb-2 border-b border-slate-200 flex items-center gap-2">
                                Legend
                            </h4>
                            <div className="space-y-2.5">
                                <div className="flex items-center gap-3">
                                    <span className="legend-color water w-4 h-4 rounded shadow-inner flex-shrink-0" style={{ backgroundColor: CLASS_LAYER_COLORS.Water, opacity: 0.7 }} />
                                    <span className="font-medium text-slate-700">Water Body</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="legend-color built w-4 h-4 rounded shadow-inner flex-shrink-0" style={{ backgroundColor: CLASS_LAYER_COLORS.BuiltUp, opacity: 0.7 }} />
                                    <span className="font-medium text-slate-700">BuiltUp</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="legend-color veg w-4 h-4 rounded shadow-inner flex-shrink-0" style={{ backgroundColor: CLASS_LAYER_COLORS.Vegetation, opacity: 0.7 }} />
                                    <span className="font-medium text-slate-700">Vegetation</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="legend-color soil w-4 h-4 rounded shadow-inner flex-shrink-0" style={{ backgroundColor: CLASS_LAYER_COLORS.BareSoil, opacity: 0.7 }} />
                                    <span className="font-medium text-slate-700">BareSoil</span>
                                </div>
                                <div className="flex items-center gap-3 pt-1 border-t border-slate-100 mt-1">
                                    <span className="legend-color enc w-4 h-4 rounded shadow-inner flex-shrink-0" style={{ backgroundColor: ENCROACHMENT_COLOR, opacity: 0.9 }} />
                                    <span className="font-bold text-red-600">Encroachment</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default DualMapViewer;
