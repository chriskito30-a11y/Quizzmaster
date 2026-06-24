import { $, roomFromUrl, getRoom, watchRoom, patchRoom, getDeviceId, rememberPlayer, getRememberedPlayer, currentQuestion, hasAnswered, remainingSeconds, computeScores, escapeHtml, setStatus, friendlyErrorMessage } from "./quiz-core.js";
let roomId = roomFromUrl();
let playerId = getDeviceId();
let playerName = "";
let room = null;
let stopWatch = null;
let tick = null;

if (roomId) $("#roomId").value = roomId;
const remembered = roomId ? getRememberedPlayer(roomId) : null;
if (remembered?.name) $("#playerName").value = remembered.name;

$("#joinForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  roomId = $("#roomId").value.trim().toLowerCase();
  playerName = $("#playerName").value.trim().slice(0, 32);
  if (!roomId || !playerName) return setStatus("#joinStatus", "Code session et pseudo obligatoires.", "error");
  try {
    const existing = await getRoom(roomId);
    if (!existing) return setStatus("#joinStatus", "Session introuvable.", "error");
    const participantLimit = Number(existing?.limits?.participantsPerEvent ?? existing?.meta?.participantsLimit ?? 30);
    const alreadyJoined = Boolean(existing?.participants?.[playerId]);
    const participantsCount = Object.keys(existing?.participants || {}).length;
    if (!alreadyJoined && participantLimit > 0 && participantsCount >= participantLimit) {
      return setStatus("#joinStatus", `Limite incluse atteinte : ${participantLimit} participant(s) maximum pour ce quiz.`, "error");
    }
    await patchRoom(roomId, { [`participants/${playerId}`]: { name: playerName, joinedAt: existing?.participants?.[playerId]?.joinedAt || Date.now(), lastSeenAt: Date.now() } });
    rememberPlayer(roomId, playerId, playerName);
    history.replaceState(null, "", `player.html?room=${roomId}`);
    $("#joinCard").classList.add("hidden"); $("#playerApp").classList.remove("hidden");
    if (stopWatch) stopWatch();
    stopWatch = watchRoom(roomId, (data) => { room = data; render(); });
    clearInterval(tick); tick = setInterval(renderTimer, 400);
  } catch (error) {
    setStatus("#joinStatus", friendlyErrorMessage(error, "Impossible de rejoindre cette animation."), "error");
  }
});

function renderTimer() { if (!room) return; $("#timer").textContent = room.state?.status === "question" ? `${remainingSeconds(room)}s` : "—"; }

function render() {
  if (!room) return;
  const q = currentQuestion(room);
  const status = room.state?.status || "lobby";
  $("#roomLabel").textContent = room.meta?.title || "Quiz";
  const score = computeScores(room).find((s) => s.playerId === playerId)?.score || 0;
  $("#scoreLabel").textContent = `Score : ${score}`;
  if (!q) { $("#questionTitle").textContent = status === "finished" ? "Quiz terminé" : "En attente"; $("#playerState").textContent = status === "finished" ? "Merci pour votre participation." : "L’organisateur va bientôt lancer une question."; $("#answerZone").innerHTML = ""; return renderTimer(); }
  const answered = hasAnswered(room, playerId);
  $("#questionTitle").textContent = q.text;
  $("#playerState").textContent = status === "question" ? "Choisissez votre réponse." : status === "reveal" ? "Bonne réponse révélée." : "Réponse enregistrée. Attendez la suite.";
  $("#answerStatus").textContent = answered ? "Votre réponse est enregistrée." : (status === "question" ? "Vous pouvez répondre." : "En attente.");
  if (status !== "question") {
    $("#answerZone").innerHTML = q.type === "text" ? `<p class="muted">Réponse attendue : ${status === "reveal" ? escapeHtml(q.correctText) : "—"}</p>` : q.choices.map((choice, i) => `<button class="choice-card ${(status === "reveal" && Number(q.correct) === i) ? "correct" : ""}" disabled>${escapeHtml(choice)}</button>`).join("");
    return renderTimer();
  }
  if (answered) { $("#answerZone").innerHTML = `<p class="muted">Réponse envoyée. Regardez l’écran public.</p>`; return renderTimer(); }
  if (q.type === "text") {
    $("#answerZone").innerHTML = `<form id="textAnswerForm" class="form-grid" style="grid-column:1/-1"><label><span>Votre réponse</span><input id="textAnswer" maxlength="80" autocomplete="off"></label><button class="primary-btn" type="submit">Envoyer</button></form>`;
    $("#textAnswerForm").addEventListener("submit", (event) => { event.preventDefault(); submitAnswer({ text: $("#textAnswer").value }); });
  } else {
    $("#answerZone").innerHTML = q.choices.map((choice, i) => `<button class="choice-card" data-choice="${i}">${escapeHtml(choice)}</button>`).join("");
    document.querySelectorAll("[data-choice]").forEach((btn) => btn.addEventListener("click", () => submitAnswer({ choiceIndex: Number(btn.dataset.choice) })));
  }
  renderTimer();
}

async function submitAnswer(payload) {
  const q = currentQuestion(room);
  if (!q || room.state?.status !== "question" || hasAnswered(room, playerId)) return;
  const answerId = `${room.state.roundId}_${playerId}`.replace(/[^a-zA-Z0-9_-]/g, "_");
  try {
    await patchRoom(roomId, { [`answers/${answerId}`]: { ...payload, answerId, playerId, playerName, questionId: q.id, roundId: room.state.roundId, at: Date.now() } });
  } catch (error) {
    setStatus("#answerStatus", friendlyErrorMessage(error, "Impossible d’envoyer la réponse."), "error");
  }
}

if (roomId && remembered?.name) { $("#playerName").value = remembered.name; setTimeout(() => $("#joinForm").requestSubmit(), 100); }
