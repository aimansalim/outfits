// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyCp8RAzj2iElW5G2rINfAzxdYxeWcJrrDg",
  authDomain: "outfit-generator-sal.firebaseapp.com",
  projectId: "outfit-generator-sal",
  storageBucket: "outfit-generator-sal.firebasestorage.app",
  messagingSenderId: "1096370548797",
  appId: "1:1096370548797:web:0ad96d420bacac9ac27a54"
};

// Inizializza Firebase
let app, auth, db, storage;

async function initFirebase() {
  // Importa Firebase modules
  const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
  const { getAuth, onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
  const { getFirestore } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
  const { getStorage } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js');
  
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
  
  return { app, auth, db, storage };
}

export { initFirebase, firebaseConfig };

