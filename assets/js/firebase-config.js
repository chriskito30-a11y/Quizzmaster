import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  update,
  onValue,
  get,
  remove,
  push,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

// Remplace ces valeurs par la configuration Web Firebase du projet Modulys / QuizMaster.
// Tant que la configuration contient les valeurs VOTRE_..., le module bascule en mode démo local.
const firebaseConfig = {
  apiKey: "VOTRE_API_KEY",
  authDomain: "VOTRE_PROJET.firebaseapp.com",
  databaseURL: "https://VOTRE_PROJET-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "VOTRE_PROJET",
  storageBucket: "VOTRE_PROJET.firebasestorage.app",
  messagingSenderId: "VOTRE_SENDER_ID",
  appId: "VOTRE_APP_ID"
};

export const FIREBASE_READY = !Object.values(firebaseConfig).some((value) => String(value || "").includes("VOTRE_"));

let app = null;
let db = null;

if (FIREBASE_READY) {
  app = initializeApp(firebaseConfig);
  db = getDatabase(app);
}

export {
  app,
  db,
  ref,
  set,
  update,
  onValue,
  get,
  remove,
  push,
  serverTimestamp
};
