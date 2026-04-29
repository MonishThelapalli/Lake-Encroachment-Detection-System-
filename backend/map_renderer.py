import ee


def generate_simple_map(aoi, start_date, end_date):

    # Sentinel-2 harmonized dataset
    collection = (
        ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        .filterBounds(aoi)
        .filterDate(start_date, end_date)
        .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 60))
    )

    # If no images found expand the window
    size = collection.size().getInfo()

    if size == 0:
        collection = (
            ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
            .filterBounds(aoi)
            .filterDate("2017-01-01", "2025-12-31")
            .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 80))
        )

    image = collection.median().clip(aoi)

    # Ensure required bands exist
    image = image.select(["B2", "B3", "B4", "B8", "B11"])

    # Spectral indices
    ndvi = image.normalizedDifference(["B8", "B4"]).rename("NDVI")
    ndwi = image.normalizedDifference(["B3", "B8"]).rename("NDWI")
    ndbi = image.normalizedDifference(["B11", "B8"]).rename("NDBI")

    # Class rules
    water = ndwi.gt(0.15)
    vegetation = ndvi.gt(0.35)
    built = ndbi.gt(0.1)

    bare = water.Or(vegetation).Or(built).Not()

    # Class map (Priority: Water > Vegetation > BuiltUp > Bare)
    # Start with base image of BareSoil (2)
    classified = ee.Image.constant(2).clip(aoi).rename("class")
    
    # Overwrite sequentially
    classified = classified.where(built, 0)
    classified = classified.where(vegetation, 1)
    classified = classified.where(water, 3)

    # Smooth raster rendering
    vis = classified.resample("bilinear").visualize(
        min=0,
        max=3,
        palette=[
            "#ff0000",   # BuiltUp
            "#00ff00",   # Vegetation
            "#ffb300",   # BareSoil
            "#4285F4"    # Water
        ]
    )

    map_dict = vis.getMapId()

    tile_url = map_dict["tile_fetcher"].url_format

    return tile_url
