// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyB0VSIxR8fEIlBqyxcdhUvuySNuxwUypDI",
  authDomain: "calendariofinanciero-bd9cb.firebaseapp.com",
  projectId: "calendariofinanciero-bd9cb",
  storageBucket: "calendariofinanciero-bd9cb.firebasestorage.app",
  messagingSenderId: "781230488204",
  appId: "1:781230488204:web:eb9f793027e98b4cb7d9a9",
  measurementId: "G-MY5TVJ6KB5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
// const analytics = getAnalytics(app);

export { db };
