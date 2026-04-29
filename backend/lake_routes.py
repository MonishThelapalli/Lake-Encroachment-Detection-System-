"""
Routes for managing predefined lakes.
"""
from fastapi import HTTPException, APIRouter
from pathlib import Path
import json
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/predefined-lakes")
async def get_predefined_lakes():
    """Get list of predefined lakes for quick analysis"""
    lakes = []
    predefined_dir = Path(__file__).parent / "predefined_lakes"
    
    if predefined_dir.exists():
        for json_file in predefined_dir.glob("*.json"):
            try:
                with open(json_file, 'r') as f:
                    lake_data = json.load(f)
                    lakes.append({
                        "id": json_file.stem,
                        "name": lake_data.get('name', json_file.stem.replace('_', ' ').title()),
                        "area_km2": lake_data.get('area_km2', 0)
                    })
            except Exception as e:
                logger.warning(f"Failed to load lake {json_file}: {e}")
    
    return lakes


@router.get("/predefined-lakes/{lake_id}")
async def get_lake_detail(lake_id: str):
    """Get detailed GeoJSON for a specific lake"""
    lake_file = Path(__file__).parent / "predefined_lakes" / f"{lake_id}.json"
    
    if not lake_file.exists():
        raise HTTPException(status_code=404, detail=f"Lake {lake_id} not found")
    
    try:
        with open(lake_file, 'r') as f:
            lake_data = json.load(f)
        
        return {
            "id": lake_id,
            "name": lake_data.get('name', lake_id.replace('_', ' ').title()),
            "area_km2": lake_data.get('area_km2', 0),
            "geojson": lake_data.get('geojson', {"type": "Feature", "geometry": {"type": "Polygon", "coordinates": []}})
        }
    except Exception as e:
        logger.error(f"Failed to load lake detail for {lake_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Error loading lake {lake_id}")
