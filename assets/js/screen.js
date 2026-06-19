import { $, roomFromUrl, watchRoom, publicUrl, qrCodeUrl, currentQuestion, currentRoundAnswers, remainingSeconds, computeScores, escapeHtml } from "./quiz-core.js";
const roomId = roomFromUrl();
let room = null;
let tick = null;
if (!roomId) {
  document.querySelector("#screenTitle").textContent = "Ajoutez ?room=CODE à l’URL";
} else {
  watchRoom(roomId, (data) => { room = data; render(); });
  tick = setInterval(renderTimer, 400);
}

function renderTimer() {
  if (!room) return;
  const status = room.state?.status || "lobby";
  $("#timer").textContent = status === "question" ? `${remainingSeconds(room)}s` : status === "finished" ? "Fin" : "—";
}

function render() {
  if (!room) return;
  const q = currentQuestion(room);
  const status = room.state?.status || "lobby";
  const answers = currentRoundAnswers(room);
  $("#screenTitle").textContent = room.meta?.title || "Quiz interactif";
  $("#roomBadge").textContent = `Code ${roomId.toUpperCase()}`;
  $("#answersCount").textContent = `${answers.length} réponse${answers.length > 1 ? "s" : ""}`;
  if (status === "finished") return renderFinished();
  if (!q || status === "lobby") return renderLobby();
  $("#joinBlock")?.classList.add("hidden");
  $("#screenContent").innerHTML = `<h2 class="screen-question">${escapeHtml(q.text)}</h2>`;
  if (q.type === "text") {
    $("#screenChoices").innerHTML = `<div class="screen-choice ${status === "reveal" ? "correct" : ""}" style="grid-column:1/-1">${status === "reveal" ? `Réponse : ${escapeHtml(q.correctText)}` : "Réponse texte courte"}</div>`;
  } else {
    $("#screenChoices").innerHTML = q.choices.map((choice, i) => `<div class="screen-choice ${status === "reveal" && Number(q.correct) === i ? "correct" : ""}">${escapeHtml(choice)}</div>`).join("");
  }
  $("#scoreboard").innerHTML = status === "reveal" ? renderScoresHtml(5) : "";
  renderTimer();
}

function renderLobby() {
  const playerUrl = publicUrl("player.html", roomId);
  $("#screenContent").innerHTML = `<h2 class="screen-question">Scannez le QR code pour rejoindre le quiz.</h2><div id="joinBlock" class="actions-row"><img class="qr-code" src="${qrCodeUrl(playerUrl, 260)}" alt="QR code participant"><div><p class="lead">Code session : <strong>${roomId.toUpperCase()}</strong></p><p class="muted">${playerUrl}</p></div></div>`;
  $("#screenChoices").innerHTML = "";
  $("#scoreboard").innerHTML = "";
  renderTimer();
}

function renderFinished() {
  $("#screenContent").innerHTML = `<h2 class="screen-question">Classement final</h2>`;
  $("#screenChoices").innerHTML = "";
  $("#scoreboard").innerHTML = renderScoresHtml(10);
  renderTimer();
}

function renderScoresHtml(limit = 10) {
  const scores = computeScores(room).slice(0, limit);
  return scores.length ? scores.map((s, i) => `<div class="score-row"><span class="rank">${i + 1}</span><span>${escapeHtml(s.name)}<br><small>${s.correct} bonne(s) réponse(s)</small></span><b>${s.score}</b></div>`).join("") : `<p class="lead">Aucun score pour le moment.</p>`;
}

window.addEventListener("beforeunload", () => clearInterval(tick));
