import { enforceModuleAccess } from "./modulys-access.js";
import { isFirebaseReady, setStatus } from "./quiz-core.js";

const __modulysAccessOk = await enforceModuleAccess("quizmaster", { mode: "hard" });
if (!__modulysAccessOk) throw new Error("Accès non autorisé");

setStatus("#firebaseStatus", isFirebaseReady() ? "Connexion prête : les sessions live sont actives sur plusieurs appareils." : "Mode local actif : le test reste possible sur cet appareil, mais le live multi-appareils peut être limité.", isFirebaseReady() ? "success" : "");
