# 🚀 Bulk Upload Instructions

## Upload all your existing clothes to Firebase

### Steps:

1. **Go to the bulk upload page:**
   ```
   https://aimansalim.github.io/outfits/bulk-upload.html
   ```

2. **Make sure you're logged in** as `info@aimansalim.com`

3. **Select all clothing images:**
   - Click on the upload area
   - Navigate to: `/Users/aiman/Biz/Aiman/Coding/outfit-generator/docs/assets/`
   - Select ALL folders: `tees/`, `midlayer/`, `jackets/`, `pants/`, `shoes/`
   - Or select all .png files from those folders individually

4. **Click "Upload All Items"**
   - The page will automatically:
     - Compress each image
     - Detect category from folder/filename
     - Extract colors and styles from filename
     - Upload to Firebase Storage
     - Save to your Firestore database
   
5. **Wait for completion**
   - You'll see a progress bar
   - Real-time log of each item being uploaded
   - Total: ~35 items should be uploaded

6. **Done!**
   - You'll be redirected to your closet page
   - All items will now appear in your outfit generator

---

## What the script detects:

### Categories:
- **tees/** → Top (Base Layer)
- **midlayer/** → Top (Overshirt Layer)
- **jackets/** → Jacket
- **pants/** → Pants
- **shoes/** → Shoes

### Colors (from filename):
- black, white, navy, grey/gray, beige, brown, green, blue, red
- military → green
- bordeaux → red

### Styles (from filename):
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

