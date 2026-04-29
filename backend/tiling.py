import math
from typing import Any, Dict, List
import ee

def create_tiles(geometry: Dict[str, Any], tile_size_deg: float = 0.01) -> List[Dict[str, Any]]:
    """
    Splits a GeoJSON polygon or multipolygon into a grid of smaller tiles 
    to prevent Google Earth Engine from hitting memory/computation limits.
        
    Args:
        geometry: GeoJSON geometry (Polygon or MultiPolygon)
        tile_size_deg: Size of the tile in degrees (e.g., 0.01 is roughly 1km)
        
    Returns:
        List of GeoJSON Polygon geometries
    """
    ee_geom = ee.Geometry(geometry)
    bounds = ee_geom.bounds().getInfo()
    
    # Extract bounding box coordinates
    if bounds['type'] == 'Polygon':
        coords = bounds['coordinates'][0]
        lons = [c[0] for c in coords]
        lats = [c[1] for c in coords]
        min_lon, max_lon = min(lons), max(lons)
        min_lat, max_lat = min(lats), max(lats)
    else:
        raise ValueError(f"Unexpected bounds type: {bounds['type']}")

    tiles = []
    
    # Calculate number of tiles needed
    num_lon = math.ceil((max_lon - min_lon) / tile_size_deg)
    num_lat = math.ceil((max_lat - min_lat) / tile_size_deg)
    
    # If the AOI is extremely small, just return it as one tile
    if num_lon <= 1 and num_lat <= 1:
        return [geometry]
        
    # Generate the grid tiles
    for i in range(num_lon):
        for j in range(num_lat):
            tile_min_lon = min_lon + i * tile_size_deg
            tile_max_lon = min((min_lon + (i + 1) * tile_size_deg), max_lon)
            
            tile_min_lat = min_lat + j * tile_size_deg
            tile_max_lat = min((min_lat + (j + 1) * tile_size_deg), max_lat)
            
            # Create a GeoJSON polygon for this tile
            tile_geom = {
                "type": "Polygon",
                "coordinates": [[
                    [tile_min_lon, tile_min_lat],
                    [tile_max_lon, tile_min_lat],
                    [tile_max_lon, tile_max_lat],
                    [tile_min_lon, tile_max_lat],
                    [tile_min_lon, tile_min_lat]
                ]]
            }
            
            # Only keep the tile if it intersects with the original geometry
            try:
                # Use earth engine locally to ensure intersection
                # We can do this without server calls if we want to be strict,
                # but GEE handles this quickly.
                intersection = ee.Geometry(tile_geom).intersection(ee_geom)
                if intersection.area().getInfo() > 0:
                    tiles.append(tile_geom)
            except Exception as e:
                # Fallback: just append the tile and let the extraction step filter it empty
                print(f"Tile intersection error: {e}")
                tiles.append(tile_geom)
                
    return tiles
