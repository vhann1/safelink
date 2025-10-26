const firebaseConfig = {
  apiKey: "AIzaSyBNpesYF9moPKBJix7hjJ9QYLA1W83qQAA",
  authDomain: "safelink-project-d0448.firebaseapp.com",
  projectId: "safelink-project-d0448",
  storageBucket: "safelink-project-d0448.firebasestorage.app",
  messagingSenderId: "923231570309",
  appId: "1:923231570309:web:0c9ec68881f94a5b6b5cec",
  measurementId: "G-6YGXFN4DF6"
};

// Initialize Firebase
try {
    firebase.initializeApp(firebaseConfig);
    console.log("Firebase initialized successfully");
} catch (error) {
    console.error("Firebase initialization error:", error);
}

// Initialize services
const auth = firebase.auth();
const db = firebase.firestore();

// Enable offline persistence
db.enablePersistence()
  .catch((err) => {
      console.log("Firebase persistence error: ", err);
  });