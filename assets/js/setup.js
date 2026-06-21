import { enforceModuleAccess, assertCanCreateModuleEvent, buildModuleEntityMeta, recordModuleEventUsage } from "./modulys-access.js";
import { $, DEFAULT_QUESTIONS, ensureRoom, getRoom, patchRoom, publicUrl, qrCodeUrl, randomRoomId, sanitizeQuestion, safeQuestions, setStatus, rememberPassword, cleanText, clampNumber } from "./quiz-core.js";
const __modulysAccessOk = await enforceModuleAccess("quizmaster", { mode: "hard" });
if (!__modulysAccessOk) throw new Error("Modulys access denied");


let roomId = new URLSearchParams(location.search).get("room") || "";
let questions = structuredClone(DEFAULT_QUESTIONS);
let password = "";
const moduleAccessReady = Promise.resolve(true);

const roomInput = $("#roomId");
roomInput.value = roomId || randomRoomId();

function updateLinks() {
  const clean = roomInput.value.trim();
  const links = [
    ["Participants", "player.html"],
    ["Écran public", "screen.html"],
    ["Admin", "admin.html"],
    ["Configuration", "setup.html"]
  ];
  $("#shareGrid").innerHTML = clean ? links.map(([label, page]) => {
    const url = publicUrl(page, clean);
    return `<article class="share-card"><strong>${label}</strong><img class="qr-code" src="${qrCodeUrl(url, 180)}" alt="QR code ${label}"><input class="share-url" value="${url}" readonly><a class="share-open" href="${url}">Ouvrir</a></article>`;
  }).join("") : `<p class="muted">Créez une salle pour obtenir les liens.</p>`;
  $("#adminLink").href = clean ? publicUrl("admin.html", clean) : "#";
  $("#goAdminBtn").href = clean ? publicUrl("admin.html", clean) : "#";
}

function questionEditor(q, index) {
  const safe = sanitizeQuestion(q, index);
  const choices = safe.type === "true_false" ? ["Vrai", "Faux"] : (safe.choices.length ? safe.choices : ["", "", "", ""]);
  return `<article class="question-card" data-index="${index}">
    <div class="question-head"><strong>Question ${index + 1}</strong><button type="button" class="ghost-btn" data-action="delete">Supprimer</button></div>
    <div class="two-cols"><label><span>Type</span><select data-field="type"><option value="qcm" ${safe.type === "qcm" ? "selected" : ""}>QCM</option><option value="true_false" ${safe.type === "true_false" ? "selected" : ""}>Vrai / faux</option><option value="text" ${safe.type === "text" ? "selected" : ""}>Texte court</option></select></label><label><span>Durée</span><input data-field="durationSec" type="number" min="5" max="180" value="${safe.durationSec}"></label></div>
    <label><span>Question</span><textarea data-field="text">${safe.text}</textarea></label>
    <div class="choice-editor" data-choices>${choices.map((c, i) => `<div class="two-cols"><label><span>Réponse ${i + 1}</span><input data-choice="${i}" value="${c || ""}" ${safe.type === "true_false" ? "readonly" : ""}></label><label><span>Bonne réponse ?</span><select data-correct="${i}"><option value="no">Non</option><option value="yes" ${Number(safe.correct) === i ? "selected" : ""}>Oui</option></select></label></div>`).join("")}</div>
    <label class="${safe.type === "text" ? "" : "hidden"}" data-text-correct><span>Réponse texte exacte attendue</span><input data-field="correctText" value="${safe.correctText || ""}"></label>
  </article>`;
}

function renderQuestions() {
  $("#questionsList").innerHTML = questions.map(questionEditor).join("");
}

function readQuestionsFromDom() {
  return Array.from(document.querySelectorAll(".question-card")).map((card, index) => {
    const type = card.querySelector('[data-field="type"]').value;
    const choices = Array.from(card.querySelectorAll("[data-choice]")).map((input) => cleanText(input.value, 80)).filter(Boolean).slice(0, 4);
    const correctSelect = Array.from(card.querySelectorAll("[data-correct]")).find((sel) => sel.value === "yes");
    return sanitizeQuestion({
      id: questions[index]?.id,
      type,
      text: card.querySelector('[data-field="text"]').value,
      durationSec: card.querySelector('[data-field="durationSec"]').value,
      choices,
      correct: correctSelect ? Number(correctSelect.dataset.correct) : 0,
      correctText: card.querySelector('[data-field="correctText"]')?.value || "",
      points: 100
    }, index);
  });
}

$("#roomForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    password = $("#password").value;
    const hasAccess = await moduleAccessReady;
    if (!hasAccess) throw new Error("Accès Modulys indisponible pour ce module.");
    let usageContext = null;
    const result = await ensureRoom(roomInput.value, password, $("#quizTitle").value, {
      getCreateMeta: async () => {
        usageContext = await assertCanCreateModuleEvent("quizmaster");
        return buildModuleEntityMeta(usageContext);
      }
    });
    if (result.created) await recordModuleEventUsage("quizmaster", result.roomId, usageContext);
    roomId = result.roomId;
    roomInput.value = roomId;
    rememberPassword(roomId, password);
    const room = await getRoom(roomId);
    questions = safeQuestions(room);
    await patchRoom(roomId, {
      "meta/title": cleanText($("#quizTitle").value, 90) || "Quiz interactif",
      "settings/defaultDurationSec": clampNumber($("#defaultDuration").value, 5, 180, 25),
      "meta/updatedAt": Date.now()
    });
    renderQuestions(); updateLinks();
    history.replaceState(null, "", `setup.html?room=${roomId}`);
    setStatus("#roomStatus", result.created ? "Salle créée." : "Salle existante ouverte.", "success");
  } catch (err) { setStatus("#roomStatus", err.message || "Erreur de création.", "error"); }
});

$("#addQuestionBtn").addEventListener("click", () => { questions = readQuestionsFromDom(); questions.push({ id: crypto.randomUUID?.() || String(Date.now()), type: "qcm", text: "Nouvelle question", durationSec: 25, choices: ["Réponse A", "Réponse B", "Réponse C", "Réponse D"], correct: 0, points: 100 }); renderQuestions(); });
$("#loadDemoBtn").addEventListener("click", () => { questions = structuredClone(DEFAULT_QUESTIONS); renderQuestions(); setStatus("#questionsStatus", "Questions démo chargées. Pense à enregistrer."); });
$("#questionsList").addEventListener("click", (event) => { if (event.target.dataset.action === "delete") { questions = readQuestionsFromDom(); questions.splice(Number(event.target.closest(".question-card").dataset.index), 1); renderQuestions(); } });
$("#questionsList").addEventListener("change", (event) => { if (event.target.dataset.field === "type") { questions = readQuestionsFromDom(); renderQuestions(); } if (event.target.dataset.correct) { const card = event.target.closest(".question-card"); card.querySelectorAll("[data-correct]").forEach((sel) => { if (sel !== event.target) sel.value = "no"; }); } });
$("#saveQuestionsBtn").addEventListener("click", async () => { if (!roomInput.value) return setStatus("#questionsStatus", "Crée d’abord une salle.", "error"); questions = readQuestionsFromDom(); if (!questions.length) return setStatus("#questionsStatus", "Ajoute au moins une question.", "error"); await patchRoom(roomInput.value, { questions, "meta/updatedAt": Date.now() }); updateLinks(); setStatus("#questionsStatus", "Questions enregistrées.", "success"); });

async function boot() { if (roomId) { const room = await getRoom(roomId); if (room) { roomInput.value = roomId; $("#quizTitle").value = room.meta?.title || "Quiz interactif"; $("#defaultDuration").value = room.settings?.defaultDurationSec || 25; questions = safeQuestions(room); } } renderQuestions(); updateLinks(); }
boot();
