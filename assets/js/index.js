import { enforceModuleAccess } from "./modulys-access.js";
import { isFirebaseReady, setStatus } from "./quiz-core.js";

const __modulysAccessOk = await enforceModuleAccess("quizmaster", { mode: "hard" });
if (!__modulysAccessOk) throw new Error("Modulys access denied");

setStatus("#firebaseStatus", isFirebaseReady() ? "Firebase est configuré : les sessions utiliseront Realtime Database." : "Mode démo local actif : ajoute ta configuration Firebase dans assets/js/firebase-config.js pour le live multi-appareils.", isFirebaseReady() ? "success" : "");
