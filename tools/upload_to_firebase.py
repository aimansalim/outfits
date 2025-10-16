#!/usr/bin/env python3
"""
Script to upload existing clothes to Firebase for a specific user.
Reads images from public/assets/ and uploads them to Firebase Storage and Firestore.
"""

import os
import json
import sys
from pathlib import Path

def parse_item_from_filename(filename, category):
    """Extract item info from filename"""
    name = filename.replace('.png', '').replace('.jpg', '').replace('-', ' ').title()
    
    # Extract color hints
    colors = []
    filename_lower = filename.lower()
    color_map = {
        'black': 'black',
        'white': 'white',
        'navy': 'navy',
        'grey': 'grey',
        'gray': 'grey',
        'beige': 'beige',
        'brown': 'brown',
        'green': 'green',
        'blue': 'blue',
        'red': 'red',
        'military': 'green',
        'bordeaux': 'red',
        'golden': 'beige'
    }
    
    for color_key, color_value in color_map.items():
        if color_key in filename_lower and color_value not in colors:
            colors.append(color_value)
    
    # Extract style hints
    styles = []
    if 'polo' in filename_lower or 'formal' in filename_lower:
        styles.append('casual')
    if 'sport' in filename_lower or 'nike' in filename_lower or 'adidas' in filename_lower:
        styles.append('sport')
    if 'street' in filename_lower or 'hoodie' in filename_lower:
        styles.append('street')
    
    # Default to casual if no style detected
    if not styles:
        styles.append('casual')
    
    return {
        'name': name,
        'colors': colors,
        'styles': styles
    }

def scan_assets_folder():
    """Scan the assets folder and create item list"""
    assets_path = Path('/Users/aiman/Biz/Aiman/Coding/outfit-generator/docs/assets')
    
    items = []
    
    # Category mapping: folder -> category
    category_map = {
        'tees': 'top',
        'midlayer': 'top',
        'jackets': 'jacket',
        'pants': 'pants',
        'shoes': 'shoes'
    }
    
    # Top layer mapping for tops
    top_layer_map = {
        'tees': 'base',
        'midlayer': 'overshirt'
    }
    
    for folder_name, category in category_map.items():
        folder_path = assets_path / folder_name
        
        if not folder_path.exists():
            print(f"Warning: Folder {folder_path} does not exist")
            continue
        
        for img_file in folder_path.glob('*.png'):
            if img_file.name == 'Generative Fill.png':
                continue
            
            item_info = parse_item_from_filename(img_file.name, category)
            
            item = {
                'name': item_info['name'],
                'category': category,
                'file': str(img_file),
                'colorHints': item_info['colors'],
                'styleHints': item_info['styles']
            }
            
            # Add topLayer for tops
            if folder_name in top_layer_map:
                item['topLayer'] = top_layer_map[folder_name]
            
            items.append(item)
    
    return items

def main():
    print("🔍 Scanning assets folder...")
    items = scan_assets_folder()
    
    print(f"\n✅ Found {len(items)} items:")
    
    # Group by category
    by_category = {}
    for item in items:
        cat = item['category']
        if cat not in by_category:
            by_category[cat] = []
        by_category[cat].append(item)
    
    for cat, items_list in sorted(by_category.items()):
        print(f"  {cat}: {len(items_list)} items")
    
    # Save to JSON for the upload script
    output_file = Path('/Users/aiman/Biz/Aiman/Coding/outfit-generator/tools/items_to_upload.json')
    with open(output_file, 'w') as f:
        json.dump(items, f, indent=2)
    
    print(f"\n💾 Saved items list to: {output_file}")
    print("\n📝 Now create the Node.js upload script to send these to Firebase...")

if __name__ == '__main__':
    main()

