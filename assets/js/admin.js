import { $, roomFromUrl, verifyRoomPassword, rememberPassword, getRememberedPassword, watchRoom, patchRoom, publicUrl, safeQuestions, currentQuestion, currentRoundAnswers, remainingSeconds, computeScores, isCorrectAnswer, escapeHtml, setStatus } from "./quiz-core.js";
import { enforceModuleAccess } from "./modulys-access.js";
const __modulysAccessOk = await enforceModuleAccess("quizmaster", { mode: "hard" });
if (!__modulysAccessOk) throw new Error("Modulys access denied");


const roomId = roomFromUrl();
let room = null;
let timerInterval = null;
if (!roomId) location.href = "index.html";
$("#authRoomName").textContent = roomId;

async function tryAuth(password) {
  const ok = await verifyRoomPassword(roomId, password);
  if (!ok) return false;
  rememberPassword(roomId, password);
  $("#authCard").classList.add("hidden");
  $("#adminApp").classList.remove("hidden");
  openAdmin();
  return true;
}

$("#authForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const ok = await tryAuth($("#authPassword").value);
  setStatus("#authStatus", ok ? "" : "Mot de passe incorrect ou salle introuvable.", ok ? "success" : "error");
});

async function bootAuth() { const remembered = getRememberedPassword(roomId); if (remembered) await tryAuth(remembered); }

function openAdmin() {
  $("#setupLink").href = publicUrl("setup.html", roomId);
  $("#screenLink").href = publicUrl("screen.html", roomId);
  $("#playerLink").href = publicUrl("player.html", roomId);
  watchRoom(roomId, (data) => { room = data; render(); });
  timerInterval = setInterval(renderTimer, 300);
}

function renderTimer() {
  if (!room) return;
  const left = remainingSeconds(room);
  $("#timer").textContent = room.state?.status === "question" ? `${left}s` : "—";
  if (room.state?.status === "question" && left <= 0) patchRoom(roomId, { "state/status": "answers" });
}

function render() {
  if (!room) return;
  const questions = safeQuestions(room);
  const q = currentQuestion(room);
  const answers = currentRoundAnswers(room);
  const status = room.state?.status || "lobby";
  $("#quizTitle").textContent = room.meta?.title || "Quiz";
  $("#stateLabel").textContent = { lobby: "Session en attente.", question: "Question ouverte.", answers: "Réponses affichées.", reveal: "Bonne réponse révélée.", finished: "Quiz terminé." }[status] || status;
  $("#questionCounter").textContent = q ? `Question ${(room.state.currentIndex || 0) + 1} / ${questions.length}` : `${questions.length} question(s) prête(s)`;
  $("#questionIndex").textContent = q ? `${(room.state.currentIndex || 0) + 1}/${questions.length}` : "0";
  $("#playersCount").textContent = Object.keys(room.participants || {}).length;
  $("#answersCount").textContent = answers.length;
  $("#currentQuestionText").textContent = q ? q.text : "Aucune question lancée.";
  $("#currentChoices").innerHTML = q && q.type !== "text" ? q.choices.map((choice, i) => `<button class="choice-card ${(status === "reveal" && Number(q.correct) === i) ? "correct" : ""}" disabled>${escapeHtml(choice)}</button>`).join("") : (q ? `<p class="muted">Question texte court : réponse attendue masquée jusqu’à la révélation.</p>` : "");
  renderAnswers(q, answers, status);
  renderScores();
  renderTimer();
}

function renderAnswers(q, answers, status) {
  if (!answers.length) { $("#answersList").innerHTML = `<p class="muted">Aucune réponse pour cette question.</p>`; return; }
  $("#answersList").innerHTML = answers.sort((a,b) => (a.at || 0) - (b.at || 0)).map((answer) => {
    const correct = q ? isCorrectAnswer(q, answer) : false;
    const text = q?.type === "text" ? answer.text : q?.choices?.[answer.choiceIndex];
    const cls = status === "reveal" ? (correct ? "correct" : "wrong") : "";
    return `<article class="answer-card ${cls}"><strong>${escapeHtml(answer.playerName || "Joueur")}</strong><p>${escapeHtml(text || "—")}</p>${status === "reveal" ? `<small>${correct ? "Bonne réponse" : "Réponse incorrecte"}</small>` : ""}</article>`;
  }).join("");
}

function renderScores() {
  const scores = computeScores(room).slice(0, 12);
  $("#scoreboard").innerHTML = scores.length ? scores.map((s, i) => `<div class="score-row"><span class="rank">${i + 1}</span><span>${escapeHtml(s.name)}<br><small>${s.correct} bonne(s) réponse(s)</small></span><b>${s.score}</b></div>`).join("") : `<p class="muted">Le classement apparaîtra après les réponses.</p>`;
}

async function startQuestion(next = false) {
  const questions = safeQuestions(room || {});
  if (!questions.length) return;
  let index = Number(room?.state?.currentIndex ?? -1);
  if (next || index < 0 || room?.state?.status === "finished") index += 1;
  if (index >= questions.length) return patchRoom(roomId, { "state/status": "finished", scores: computeScores(room) });
  const q = questions[index];
  await patchRoom(roomId, { "state/status": "question", "state/currentIndex": index, "state/roundId": `${q.id}-${Date.now()}`, "state/startedAt": Date.now(), "state/durationSec": q.durationSec, "state/revealCorrect": false });
}

$("#startBtn").addEventListener("click", () => startQuestion(false));
$("#nextBtn").addEventListener("click", () => startQuestion(true));
$("#showAnswersBtn").addEventListener("click", () => patchRoom(roomId, { "state/status": "answers" }));
$("#revealBtn").addEventListener("click", async () => { await patchRoom(roomId, { "state/status": "reveal", "state/revealCorrect": true, scores: computeScores(room) }); });
$("#finishBtn").addEventListener("click", () => patchRoom(roomId, { "state/status": "finished", scores: computeScores(room) }));

window.addEventListener("beforeunload", () => clearInterval(timerInterval));
bootAuth();
