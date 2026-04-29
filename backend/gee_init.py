"""
Google Earth Engine Initialization Guard

Provides reusable GEE initialization function to ensure EE is available
in all endpoints, not just at server startup.
"""

import ee
import os
import json


def ensure_gee():
    """
    Ensure Google Earth Engine is initialized.
    
    Returns:
        bool: True if initialization successful
        
    Raises:
        RuntimeError: If GEE credentials are missing or initialization fails
    """
    try:
        # Test if EE is already initialized
        ee.Number(1).getInfo()
        return True
    except Exception:
        # EE not initialized, attempt initialization
        credentials_path = "gee-service-account.json"
        
        if not os.path.exists(credentials_path):
            raise RuntimeError("GEE credentials missing. Please ensure gee-service-account.json exists.")
        
        try:
            service_account = json.load(open(credentials_path))["client_email"]
            credentials = ee.ServiceAccountCredentials(service_account, credentials_path)
            ee.Initialize(credentials)
            return True
        except Exception:
            try:
                ee.Authenticate()
                ee.Initialize()
                return True
            except Exception as e:
                raise RuntimeError(f"Failed to initialize Google Earth Engine: {str(e)}")


def check_gee_status():
    """
    Check if Google Earth Engine is currently initialized.
    
    Returns:
        bool: True if EE is initialized, False otherwise
    """
    try:
        ee.Number(1).getInfo()
        return True
    except Exception:
        return False
