# 🔧 Troubleshooting Upload Issues

## Problem: Upload gets stuck after "Processing..."

### Quick Check:

1. **Open browser console** (F12 or Cmd+Option+I)
2. Look for error messages

### Common Issues:

#### 1. Firestore Rules Not Set Correctly

**Symptoms:** Error like "Missing or insufficient permissions"

**Fix:** Go to [Firebase Console](https://console.firebase.google.com/) → Your Project → Firestore Database → Rules

Make sure your rules are:

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    
    // Users collection - users can read/write their own data
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Usernames collection
    match /usernames/{username} {
      allow read: if true;
      allow create: if request.auth != null && request.resource.data.uid == request.auth.uid;
      allow update, delete: if false;
    }
  }
}
```

Click **Publish**.

#### 2. Storage Rules Not Set Correctly

**Symptoms:** Error like "Storage: User does not have permission"

**Fix:** Go to Firebase Console → Your Project → Storage → Rules

Make sure your rules are:

```
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    
    match /clothes/{userId}/{fileName} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Click **Publish**.

#### 3. User Document Doesn't Exist

**Symptoms:** Upload fails silently or with "Document not found"

**Fix:** The new code now handles this automatically with `setDoc` and `merge: true`.

Try again after the site updates (wait 1-2 minutes after git push).

#### 4. File Size Too Large

**Symptoms:** Upload hangs or fails on large images

**Fix:** The compression should handle this, but if you have VERY large files (>10MB), try:
- Uploading in smaller batches (10-15 items at a time)
- Pre-compress images manually before upload

#### 5. Network Issues

**Symptoms:** Timeout errors, "fetch failed"

**Fix:**
- Check your internet connection
- Try refreshing the page and uploading again
- Upload in smaller batches

---

## How to Verify Firebase Setup:

### 1. Check Firestore Rules:
```
Firebase Console → Firestore Database → Rules
```
Should show: `allow write: if request.auth != null && request.auth.uid == userId`

### 2. Check Storage Rules:
```
Firebase Console → Storage → Rules
```
Should show: `allow write: if request.auth != null && request.auth.uid == userId`

### 3. Check if user document exists:
```
Firebase Console → Firestore Database → Data → users → [your-user-id]
```

If it doesn't exist, the bulk upload will create it.

---

## Still Having Issues?

1. **Clear browser cache and cookies**
2. **Try in incognito/private mode**
3. **Check browser console for detailed error messages**
4. **Make sure you're logged in with the correct account**

---

## Manual Upload Alternative

If bulk upload continues to fail, you can upload items one-by-one at:
```
https://aimansalim.github.io/outfits/upload.html
```

This is slower but more reliable for troubleshooting.

