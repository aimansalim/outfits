#!/usr/bin/env python3
"""
Auto Health Data Updater - Monitors HEALTH folder for new exports and auto-updates dashboard
"""

import os
import sys
import time
import zipfile
import shutil
from pathlib import Path
from datetime import datetime

HEALTH_FOLDER = Path.home() / "Library/Mobile Documents/com~apple~CloudDocs/HEALTH"
HEALTH_EXPORT_PATH = HEALTH_FOLDER / "apple_health_export"
EXPORT_XML = HEALTH_EXPORT_PATH / "export.xml"

def find_latest_export_zip():
    """Find the most recent export.zip in HEALTH folder"""
    zip_files = list(HEALTH_FOLDER.glob("export*.zip")) + list(HEALTH_FOLDER.glob("Export*.zip"))
    if not zip_files:
        return None
    # Sort by modification time, newest first
    return max(zip_files, key=lambda p: p.stat().st_mtime)

def extract_export_zip(zip_path):
    """Extract export.zip to apple_health_export folder"""
    print(f"📦 Found new export: {zip_path.name}")
    print(f"📂 Extracting to: {HEALTH_EXPORT_PATH}")
    
    # Remove old export folder if exists
    if HEALTH_EXPORT_PATH.exists():
        print("🗑️  Removing old export...")
        shutil.rmtree(HEALTH_EXPORT_PATH)
    
    # Extract new export
    HEALTH_EXPORT_PATH.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        zip_ref.extractall(HEALTH_EXPORT_PATH)
    
    print(f"✅ Extracted {zip_path.name}")
    return EXPORT_XML

def run_health_analyzer():
    """Run the health analyzer script"""
    print("\n🔄 Running health analyzer...")
    import subprocess
    result = subprocess.run([sys.executable, "health_analyzer.py"], 
                          capture_output=True, text=True)
    if result.returncode == 0:
        print("✅ Dashboard updated successfully!")
        return True
    else:
        print(f"❌ Error: {result.stderr}")
        return False

def check_and_update():
    """Check for new export and update if found"""
    latest_zip = find_latest_export_zip()
    
    if not latest_zip:
        print("⚠️  No export.zip found in HEALTH folder")
        print(f"📍 Looking in: {HEALTH_FOLDER}")
        return False
    
    # Check if XML already exists and is newer than ZIP
    if EXPORT_XML.exists():
        xml_mtime = EXPORT_XML.stat().st_mtime
        zip_mtime = latest_zip.stat().st_mtime
        
        if xml_mtime >= zip_mtime:
            print(f"✅ Export already up to date (last modified: {datetime.fromtimestamp(xml_mtime)})")
            return False
    
    # Extract and update
    extract_export_zip(latest_zip)
    return run_health_analyzer()

def main():
    print("=" * 60)
    print("🏥 Auto Health Data Updater")
    print("=" * 60)
    print(f"📂 Monitoring: {HEALTH_FOLDER}")
    print()
    
    check_and_update()
    
    print("\n" + "=" * 60)
    print("💡 TIP: Just export from iPhone and save to HEALTH folder")
    print("   Then run this script to auto-extract and update!")
    print("=" * 60)

if __name__ == '__main__':
    main()

