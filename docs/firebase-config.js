// Firebase Configuration
// IMPORTANTE: Dovrai sostituire questi valori con i tuoi dopo aver creato il progetto Firebase

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
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

