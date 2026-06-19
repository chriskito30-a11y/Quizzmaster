const CACHE_NAME = "quizmaster-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./setup.html",
  "./admin.html",
  "./player.html",
  "./screen.html",
  "./assets/css/quiz.css",
  "./assets/js/firebase-config.js",
  "./assets/js/quiz-core.js",
  "./assets/js/index.js",
  "./assets/js/setup.js",
  "./assets/js/admin.js",
  "./assets/js/player.js",
  "./assets/js/screen.js",
  "./assets/js/pwa.js",
  "./assets/img/icon.svg"
];
self.addEventListener("install", (event) => event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(() => null)));
self.addEventListener("activate", (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))));
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
