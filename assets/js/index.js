import { enforceModuleAccess } from "./modulys-access.js";
import { isFirebaseReady, setStatus } from "./quiz-core.js";
setStatus("#firebaseStatus", isFirebaseReady() ? "Firebase est configuré : les sessions utiliseront Realtime Database." : "Mode démo local actif : ajoute ta configuration Firebase dans assets/js/firebase-config.js pour le live multi-appareils.", isFirebaseReady() ? "success" : "");

enforceModuleAccess("quizmaster", { mode: "soft" });
