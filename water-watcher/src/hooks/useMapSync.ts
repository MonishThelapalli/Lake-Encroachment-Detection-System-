import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';

/**
 * Hook to synchronize two Leaflet maps
 * @param isMap1 Boolean indicating if this is the first (controlling/controlled) map
 * @param otherMapInstance The Leaflet Map instance of the other map to sync with
 */
export function useMapSync(isMap1: boolean, otherMapInstance: L.Map | null) {
    const map = useMap();
    const isSyncingRef = useRef(false);

    useEffect(() => {
        if (!map || !otherMapInstance) return;

        const syncMaps = (sourceMap: L.Map, targetMap: L.Map) => {
            const onMove = () => {
                if (isSyncingRef.current) return;

                isSyncingRef.current = true;

                const center = sourceMap.getCenter();
                const zoom = sourceMap.getZoom();

                targetMap.setView(center, zoom, {
                    animate: false
                });

                // Small timeout to allow the other map's events to fire without triggering a loop
                setTimeout(() => {
                    isSyncingRef.current = false;
                }, 50);
            };

            sourceMap.on('move', onMove);
            sourceMap.on('zoom', onMove);

            return () => {
                sourceMap.off('move', onMove);
                sourceMap.off('zoom', onMove);
            };
        };

        // Set up bi-directional syncing
        const cleanup1 = syncMaps(map, otherMapInstance);
        // Note: We only set up the reverse sync from the other component to avoid doubling events

        return () => {
            cleanup1();
        };
    }, [map, otherMapInstance]);

    return map;
}

// A simpler approach using a shared state object for the parent
export function useMapSyncState() {
    const [map1, setMap1] = useState<L.Map | null>(null);
    const [map2, setMap2] = useState<L.Map | null>(null);
    const isSyncingRef = useRef(false);

    useEffect(() => {
        if (!map1 || !map2) return;

        const onMap1Move = () => {
            if (isSyncingRef.current) return;
            isSyncingRef.current = true;
            map2.setView(map1.getCenter(), map1.getZoom(), { animate: false });
            setTimeout(() => { isSyncingRef.current = false; }, 50);
        };

        const onMap2Move = () => {
            if (isSyncingRef.current) return;
            isSyncingRef.current = true;
            map1.setView(map2.getCenter(), map2.getZoom(), { animate: false });
            setTimeout(() => { isSyncingRef.current = false; }, 50);
        };

        map1.on('move', onMap1Move);
        map2.on('move', onMap2Move);

        return () => {
            map1.off('move', onMap1Move);
            map2.off('move', onMap2Move);
        };
    }, [map1, map2]);

    return { map1, setMap1, map2, setMap2 };
}
