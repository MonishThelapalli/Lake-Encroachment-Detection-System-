"""
KML/KMZ parser for Water Watcher.

Extracts Polygon or MultiPolygon geometries from KML/KMZ files.
Supports:
- Placemark → Polygon
- Placemark → MultiGeometry → Polygon
- Placemark → MultiGeometry → MultiPolygon (multiple Polygon children)

Returns GeoJSON geometry dict. Rejects Point geometries.
Raises HTTP 400-level error if no polygon found.
"""

from __future__ import annotations

import io
import zipfile
import xml.etree.ElementTree as ET
from typing import Dict, Any, List


def _parse_coordinate_string(coord_string: str) -> List[List[float]]:
    """Parse KML coordinate string (lon,lat,alt or lon,lat) into [[lon,lat],...]."""
    coords: List[List[float]] = []
    for point in coord_string.strip().split():
        point = point.strip()
        if not point:
            continue
        parts = point.split(",")
        if len(parts) >= 2:
            lon, lat = float(parts[0]), float(parts[1])
            coords.append([lon, lat])
    return coords


def _extract_polygons_from_xml(root: ET.Element) -> List[List[List[float]]]:
    """
    Recursively find all Polygon elements and extract outer boundary coordinates.
    Returns list of rings, each ring is [[lon,lat],...].
    """
    ns = {"kml": "http://www.opengis.net/kml/2.2"}
    all_polygons: List[List[List[float]]] = []

    # Find all Polygon elements (handles Placemark > Polygon and Placemark > MultiGeometry > Polygon)
    polygons = root.findall(".//kml:Polygon", ns)
    if not polygons:
        polygons = root.findall(".//Polygon")

    for poly in polygons:
        # outerBoundaryIs > LinearRing > coordinates
        coords_elem = poly.find(".//kml:outerBoundaryIs//kml:LinearRing//kml:coordinates", ns)
        if coords_elem is None:
            coords_elem = poly.find(".//kml:outerBoundaryIs//kml:coordinates", ns)
        if coords_elem is None:
            coords_elem = poly.find(".//outerBoundaryIs//LinearRing/coordinates")
        if coords_elem is None:
            coords_elem = poly.find(".//outerBoundaryIs//coordinates")

        if coords_elem is not None and coords_elem.text:
            ring = _parse_coordinate_string(coords_elem.text)
            if len(ring) >= 3:
                if ring[0] != ring[-1]:
                    ring.append(ring[0])
                all_polygons.append(ring)

    return all_polygons


def _kml_content_to_geojson(kml_content: str) -> Dict[str, Any]:
    """Parse KML XML string into GeoJSON Polygon or MultiPolygon."""
    root = ET.fromstring(kml_content)
    all_polygons = _extract_polygons_from_xml(root)

    if not all_polygons:
        raise ValueError("No Polygon or MultiPolygon geometries found")

    if len(all_polygons) == 1:
        return {"type": "Polygon", "coordinates": all_polygons}
    return {"type": "MultiPolygon", "coordinates": [[p] for p in all_polygons]}


def parse_kml_or_kmz(file_bytes: bytes) -> Dict[str, Any]:
    """
    Parse KML or KMZ file bytes into GeoJSON Polygon or MultiPolygon.

    - KMZ: unzips and reads doc.kml (or first .kml in archive)
    - KML: parses XML directly

    Supports:
    - Placemark → Polygon
    - Placemark → MultiGeometry → Polygon
    - Placemark → MultiGeometry → MultiPolygon

    Rejects Point geometries. If no polygon found, raises ValueError.
    """
    # Detect KMZ (ZIP magic)
    if file_bytes[:2] == b"PK" or file_bytes[:4] == b"\x50\x4b\x03\x04":
        with zipfile.ZipFile(io.BytesIO(file_bytes), "r") as zf:
            kml_name = None
            for name in zf.namelist():
                if name.lower().endswith(".kml") and "__MACOSX" not in name:
                    kml_name = name
                    break
            if not kml_name:
                raise ValueError("No KML file found in KMZ archive")
            kml_content = zf.read(kml_name).decode("utf-8", errors="replace")
    else:
        kml_content = file_bytes.decode("utf-8", errors="replace")

    return _kml_content_to_geojson(kml_content)
