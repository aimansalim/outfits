# 🚀 Bulk Upload Instructions

## Upload all your existing clothes to Firebase

### Steps:

1. **Go to the bulk upload page:**
   ```
   https://aimansalim.github.io/outfits/bulk-upload.html
   ```

2. **Make sure you're logged in** as `info@aimansalim.com`

3. **Select your entire clothing folder:**
   - Click on the upload area
   - Navigate to: `/Users/aiman/Downloads/HIGH-QUALITY-NO-BG/`
   - **Select the entire folder** (the browser will ask you to select a folder)
   - The script will automatically:
     - Include: `tees/`, `midlayer/`, `jackets/`, `pants/`, `shoes/`
     - Skip: `accessories/` and EDC items
     - Filter out: Generated/temp files

4. **Review the selection**
   - You'll see: "X clothing items selected (Y total files)"
   - Breakdown by category: tops, jackets, pants, shoes
   - Expected: ~33-35 clothing items

5. **Click "Upload All Items"**
   - The page will automatically:
     - Compress each image (saves ~70% space)
     - Detect category from folder name
     - Extract colors and styles from filename
     - Upload to Firebase Storage
     - Save to your Firestore database
   
6. **Wait for completion**
   - You'll see a progress bar
   - Real-time log of each item being uploaded
   - Takes ~2-5 minutes for 35 items

7. **Done!**
   - You'll be redirected to your closet page
   - All items will now appear in your outfit generator

---

## What the script detects:

### Categories (from folder structure):
- **tees/** or **t-shirt/** → Top (Base Layer)
- **midlayer/** or **overshirts/** or **long-sleeve/** → Top (Overshirt Layer)
- **jackets/** or **outerwear/** → Jacket
- **pants/** or **trousers/** or **bottoms/** → Pants
- **shoes/** or **footwear/** or **sneakers/** → Shoes

### Filters out:
- ❌ **accessories/** folder (EDC items like bags, watches, tech)
- ❌ Files with "Generative Fill" or "Generated Image" in the name
- ❌ Non-image files

### Colors (auto-detected from filename):
- black, white, navy, grey/gray, beige, brown, green, blue, red
- military → green
- bordeaux → red
- khaki → beige

### Styles (auto-detected from filename):
- polo/button → casual
- nike/adidas/sport → sport
- street/hoodie → street
- Default → casual

---

## Troubleshooting:

If upload fails:
1. Check browser console for errors
2. Make sure you're logged in with the correct account
3. Try uploading in smaller batches (10-15 items at a time)
4. Check Firebase Storage and Firestore rules are properly set

