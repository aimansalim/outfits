# Firebase OAuth Domain Setup

## ⚠️ Important: Add GitHub Pages Domain to Firebase

The Firebase authentication will not work properly until you add your GitHub Pages domain to the authorized domains list.

### Steps:

1. **Go to Firebase Console:**
   ```
   https://console.firebase.google.com/
   ```

2. **Select your project:** `outfit-generator-sal`

3. **Go to Authentication:**
   - Click **Authentication** in the left sidebar
   - Click the **Settings** tab
   - Click **Authorized domains**

4. **Add your domain:**
   - Click **Add domain**
   - Enter: `aimansalim.github.io`
   - Click **Add**

5. **Save changes**

### Why this is needed:

Firebase restricts OAuth operations (like `signInWithEmailAndPassword`, `createUserWithEmailAndPassword`) to authorized domains for security reasons.

Without adding `aimansalim.github.io`, authentication will still work but you'll see warnings in the console.

### Current authorized domains should include:

- ✅ `localhost`
- ✅ `aimansalim.github.io` ← **ADD THIS!**
- ✅ `outfit-generator-sal.firebaseapp.com`
- ✅ `outfit-generator-sal.web.app`

---

**Note:** This is a one-time setup and only affects authentication operations. Once added, all auth features will work without warnings.

