import React from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface ImageOverlayProps {
  url: string;
  bounds: L.LatLngBounds;
  opacity?: number;
  attribution?: string;
}

const ImageOverlay: React.FC<ImageOverlayProps> = ({ url, bounds, opacity = 0.8, attribution = '' }) => {
  const [overlay, setOverlay] = React.useState<L.ImageOverlay | null>(null);

  React.useEffect(() => {
    if (!url || !bounds) return;

    const icon = L.icon({
      iconUrl: url,
      iconSize: [bounds.getEast() - bounds.getWest(), bounds.getNorth() - bounds.getSouth()],
      iconAnchor: [0, 0],
      className: 'leaflet-image-overlay'
    });

    const imageOverlay = L.imageOverlay(icon, bounds, {
      attribution,
      opacity
    });

    setOverlay(imageOverlay);

    return () => {
      if (overlay) {
        map.removeLayer(overlay);
        setOverlay(null);
      }
    };
  }, [url, bounds, attribution, opacity]);

  return null;
};

export default ImageOverlay;
