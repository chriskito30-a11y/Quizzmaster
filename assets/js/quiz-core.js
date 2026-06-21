import { db, ref, set, update, onValue, get, remove, FIREBASE_READY } from "./firebase-config.js";

export const APP_NAME = "QuizMaster";
export const ROOT_PATH = "quizRooms";

export const DEFAULT_QUESTIONS = [
  {
    id: "q-demo-1",
    type: "qcm",
    text: "Quelle est la bonne réponse ?",
    durationSec: 20,
    choices: ["Réponse A", "Réponse B", "Réponse C", "Réponse D"],
    correct: 1,
    points: 100
  },
  {
    id: "q-demo-2",
    type: "true_false",
    text: "Un quiz interactif peut être joué depuis un téléphone.",
    durationSec: 15,
    choices: ["Vrai", "Faux"],
    correct: 0,
    points: 100
  }
];

export const DEFAULT_ROOM = {
  meta: {
    title: "Quiz interactif",
    subtitle: "Session live Modulys",
    createdAt: 0,
    updatedAt: 0,
    mode: "prototype"
  },
  settings: {
    defaultDurationSec: 25,
    showLiveAnswers: true,
    allowTextQuestion: true
  },
  questions: DEFAULT_QUESTIONS,
  state: {
    status: "lobby", // lobby | question | answers | reveal | finished
    currentIndex: -1,
    roundId: "",
    startedAt: 0,
    durationSec: 25,
    revealCorrect: false
  },
  participants: {},
  answers: {},
  scores: {}
};

export function $(selector, root = document) { return root.querySelector(selector); }
export function $all(selector, root = document) { return Array.from(root.querySelectorAll(selector)); }
export function now() { return Date.now(); }

export function normalizeRoomId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36);
}

export function randomRoomId() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i += 1) code += letters[Math.floor(Math.random() * letters.length)];
  return code.toLowerCase();
}

export function roomFromUrl() {
  return normalizeRoomId(new URLSearchParams(window.location.search).get("room"));
}

export function roomPath(roomId, suffix = "") {
  const clean = normalizeRoomId(roomId);
  const s = String(suffix || "").replace(/^\/+/, "");
  return s ? `${ROOT_PATH}/${clean}/${s}` : `${ROOT_PATH}/${clean}`;
}

export function publicUrl(page, roomId) {
  const url = new URL(page, window.location.href);
  url.searchParams.set("room", normalizeRoomId(roomId));
  return url.href;
}

export function qrCodeUrl(url, size = 220) {
  const cleanSize = Math.min(520, Math.max(120, Number.parseInt(size, 10) || 220));
  return `https://api.qrserver.com/v1/create-qr-code/?size=${cleanSize}x${cleanSize}&margin=12&data=${encodeURIComponent(url)}`;
}

export function cleanText(value, max = 180) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, max);
}

export function clampNumber(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function makeQuestionId() {
  return `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function getDeviceId() {
  const key = "quizMasterDeviceId";
  let id = localStorage.getItem(key);
  if (!id) {
    const cryptoApi = globalThis.crypto || globalThis.msCrypto;
    id = cryptoApi?.randomUUID
      ? cryptoApi.randomUUID()
      : `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(key, id);
  }
  return id.replace(/[^a-zA-Z0-9_-]/g, "");
}

export async function sha256(text) {
  const value = String(text || "");
  const cryptoApi = globalThis.crypto || globalThis.msCrypto;

  // Méthode moderne : disponible en HTTPS ou localhost.
  if (cryptoApi?.subtle?.digest && globalThis.TextEncoder) {
    const bytes = new TextEncoder().encode(value);
    const digest = await cryptoApi.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  // Fallback prototype : évite le crash si crypto.subtle est indisponible.
  // Suffisant pour tester en local ou sur un hébergement non sécurisé,
  // mais à remplacer par une vraie sécurité serveur avant commercialisation.
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < value.length; i += 1) {
    const ch = value.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hex = `${(h2 >>> 0).toString(16).padStart(8, "0")}${(h1 >>> 0).toString(16).padStart(8, "0")}`;
  return hex.repeat(4).slice(0, 64);
}

export function makeSalt() {
  const arr = new Uint8Array(16);
  const cryptoApi = globalThis.crypto || globalThis.msCrypto;
  if (cryptoApi?.getRandomValues) {
    cryptoApi.getRandomValues(arr);
  } else {
    for (let i = 0; i < arr.length; i += 1) arr[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashPassword(roomId, password, salt) {
  return sha256(`${normalizeRoomId(roomId)}|${salt}|${password}`);
}

function localKey(roomId) { return `quizMasterRoom:${normalizeRoomId(roomId)}`; }
function channelName(roomId) { return `quizMasterChannel:${normalizeRoomId(roomId)}`; }

export function isFirebaseReady() { return FIREBASE_READY && Boolean(db); }

function readLocalRoom(roomId) {
  try { return JSON.parse(localStorage.getItem(localKey(roomId)) || "null"); }
  catch { return null; }
}

function writeLocalRoom(roomId, data) {
  localStorage.setItem(localKey(roomId), JSON.stringify(data));
  try { new BroadcastChannel(channelName(roomId)).postMessage({ type: "room-updated", roomId, at: now() }); } catch {}
  window.dispatchEvent(new CustomEvent("quiz-local-room-updated", { detail: { roomId } }));
}

export async function getRoom(roomId) {
  const clean = normalizeRoomId(roomId);
  if (!clean) return null;
  if (isFirebaseReady()) {
    const snap = await get(ref(db, roomPath(clean)));
    return snap.exists() ? snap.val() : null;
  }
  return readLocalRoom(clean);
}

export function watchRoom(roomId, callback) {
  const clean = normalizeRoomId(roomId);
  if (!clean) return () => {};
  if (isFirebaseReady()) {
    return onValue(ref(db, roomPath(clean)), (snap) => callback(snap.exists() ? snap.val() : null));
  }
  const emit = () => callback(readLocalRoom(clean));
  emit();
  let bc = null;
  try {
    bc = new BroadcastChannel(channelName(clean));
    bc.onmessage = emit;
  } catch {}
  const storageHandler = (event) => { if (event.key === localKey(clean)) emit(); };
  const customHandler = (event) => { if (event.detail?.roomId === clean) emit(); };
  window.addEventListener("storage", storageHandler);
  window.addEventListener("quiz-local-room-updated", customHandler);
  return () => {
    window.removeEventListener("storage", storageHandler);
    window.removeEventListener("quiz-local-room-updated", customHandler);
    try { bc?.close(); } catch {}
  };
}

export async function saveRoom(roomId, data) {
  const clean = normalizeRoomId(roomId);
  if (isFirebaseReady()) return set(ref(db, roomPath(clean)), data);
  writeLocalRoom(clean, data);
}

export async function patchRoom(roomId, patch = {}) {
  const clean = normalizeRoomId(roomId);
  if (isFirebaseReady()) return update(ref(db, roomPath(clean)), patch);
  const current = readLocalRoom(clean) || {};
  const next = structuredClone(current);
  Object.entries(patch).forEach(([path, value]) => {
    const parts = path.split("/").filter(Boolean);
    let target = next;
    parts.slice(0, -1).forEach((part) => { target[part] = target[part] || {}; target = target[part]; });
    target[parts.at(-1)] = value;
  });
  writeLocalRoom(clean, next);
}

export async function ensureRoom(roomId, password, title = "Quiz interactif", options = {}) {
  const clean = normalizeRoomId(roomId || randomRoomId());
  if (!clean) throw new Error("Code session invalide.");
  if (!password || password.length < 4) throw new Error("Choisis un mot de passe organisateur d’au moins 4 caractères.");

  const existing = await getRoom(clean);
  if (existing) return { roomId: clean, created: false };

  const salt = makeSalt();
  const passwordHash = await hashPassword(clean, password, salt);
  const t = now();
  const moduleMeta = typeof options.getCreateMeta === "function" ? await options.getCreateMeta(clean) : {};
  const room = structuredClone(DEFAULT_ROOM);
  Object.assign(room, moduleMeta);
  room.meta.title = cleanText(title, 90) || DEFAULT_ROOM.meta.title;
  room.meta.ownerUid = moduleMeta.ownerUid || "";
  room.meta.moduleId = moduleMeta.moduleId || "quizmaster";
  room.meta.planId = moduleMeta.planId || "free";
  room.meta.billingPeriod = moduleMeta.billingPeriod || "";
  room.meta.participantsLimit = Number(moduleMeta?.limits?.participantsPerEvent ?? 30);
  room.meta.createdAt = t;
  room.meta.updatedAt = t;
  room.private = { salt, passwordHash, createdAt: t };
  await saveRoom(clean, room);
  return { roomId: clean, created: true };
}

export async function verifyRoomPassword(roomId, password) {
  const room = await getRoom(roomId);
  const priv = room?.private || {};
  if (!priv.salt || !priv.passwordHash) return false;
  const attempt = await hashPassword(roomId, password || "", priv.salt);
  return attempt === priv.passwordHash;
}

export function rememberPassword(roomId, password) { sessionStorage.setItem(`quizMasterPassword:${normalizeRoomId(roomId)}`, password); }
export function getRememberedPassword(roomId) { return sessionStorage.getItem(`quizMasterPassword:${normalizeRoomId(roomId)}`) || ""; }
export function rememberPlayer(roomId, playerId, name) { localStorage.setItem(`quizMasterPlayer:${normalizeRoomId(roomId)}`, JSON.stringify({ playerId, name })); }
export function getRememberedPlayer(roomId) { try { return JSON.parse(localStorage.getItem(`quizMasterPlayer:${normalizeRoomId(roomId)}`) || "null"); } catch { return null; } }

export function safeQuestions(room = {}) {
  const list = Array.isArray(room.questions) ? room.questions : Object.values(room.questions || {});
  return list.map((q, index) => sanitizeQuestion(q, index)).filter((q) => q.text);
}

export function sanitizeQuestion(q = {}, index = 0) {
  const type = ["qcm", "true_false", "text"].includes(q.type) ? q.type : "qcm";
  let choices = Array.isArray(q.choices) ? q.choices.map((c) => cleanText(c, 80)).filter(Boolean) : [];
  if (type === "true_false") choices = ["Vrai", "Faux"];
  if (type === "qcm") choices = choices.slice(0, 4);
  const correct = type === "text" ? cleanText(q.correctText || q.correct || "", 80) : clampNumber(q.correct, 0, Math.max(0, choices.length - 1), 0);
  return {
    id: cleanText(q.id, 60) || makeQuestionId(),
    type,
    text: cleanText(q.text, 240) || `Question ${index + 1}`,
    durationSec: clampNumber(q.durationSec, 5, 180, 25),
    choices,
    correct,
    correctText: type === "text" ? String(correct) : "",
    points: clampNumber(q.points, 0, 1000, 100)
  };
}

export function currentQuestion(room = {}) {
  const questions = safeQuestions(room);
  const index = Number(room.state?.currentIndex ?? -1);
  return questions[index] || null;
}

export function currentRoundAnswers(room = {}) {
  const roundId = room.state?.roundId || "";
  const all = room.answers || {};
  return Object.values(all).filter((a) => a && a.roundId === roundId);
}

export function hasAnswered(room = {}, playerId = "") {
  return currentRoundAnswers(room).some((a) => a.playerId === playerId);
}

export function normalizeAnswer(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isCorrectAnswer(question = {}, answer = {}) {
  if (!question) return false;
  if (question.type === "text") return normalizeAnswer(answer.text) === normalizeAnswer(question.correctText || question.correct);
  return Number(answer.choiceIndex) === Number(question.correct);
}

export function remainingSeconds(room = {}) {
  const state = room.state || {};
  if (state.status !== "question" || !state.startedAt || !state.durationSec) return 0;
  const end = Number(state.startedAt) + Number(state.durationSec) * 1000;
  return Math.max(0, Math.ceil((end - now()) / 1000));
}

export function computeScores(room = {}) {
  const participants = room.participants || {};
  const scores = {};
  Object.entries(participants).forEach(([id, p]) => { scores[id] = { playerId: id, name: p.name || "Joueur", score: 0, correct: 0, answered: 0 }; });
  const questions = safeQuestions(room);
  Object.values(room.answers || {}).forEach((answer) => {
    const q = questions.find((item) => item.id === answer.questionId);
    if (!q || !answer.playerId) return;
    scores[answer.playerId] = scores[answer.playerId] || { playerId: answer.playerId, name: answer.playerName || "Joueur", score: 0, correct: 0, answered: 0 };
    scores[answer.playerId].answered += 1;
    if (answer.correct === true || isCorrectAnswer(q, answer)) {
      scores[answer.playerId].score += Number(q.points || 100);
      scores[answer.playerId].correct += 1;
    }
  });
  return Object.values(scores).sort((a, b) => b.score - a.score || b.correct - a.correct || a.name.localeCompare(b.name));
}

export function escapeHtml(value = "") {
  return String(value).replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
}

export function setStatus(selector, text, type = "") {
  const el = $(selector);
  if (!el) return;
  el.textContent = text || "";
  el.className = `status-text ${type}`.trim();
}
