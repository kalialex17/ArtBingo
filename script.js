document.addEventListener("DOMContentLoaded", () => {
  // ——— Helper to grab elements or fail fast ———
  function $(id) {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Missing #${id} in HTML`);
    return el;
  }

  // ——— DOM ELEMENTS ———
  const videoElement            = $("camera-preview");
  const canvasElement           = $("captured-image");
  const captureButton           = $("capture-btn");
  const detectButton            = $("detect-btn");
  const retryButton             = $("retry-btn");
  const errorMessageElement     = $("error-message");
  const detectionResultsElement = $("detection-results");
  const cameraSection           = $("camera-section");
  const resultSection           = $("result-section");
  const bingoPage               = $("bingo-page");
  const cameraPage              = $("camera-page");
  const winPage                 = $("win-page");
  const pointsLabel             = $("points");
  const chronoLabel             = $("chrono");
  const timeTakenLabel          = $("time-taken");
  const gridCells               = Array.from(document.querySelectorAll(".grid-cell"));
  const homeButtons             = document.querySelectorAll(".home-btn");

  // ——— STATE ———
  const ROBOFLOW_API_URL = "https://serverless.roboflow.com/infer/workflows/art-bingo/detect-and-classify";
  const ROBOFLOW_API_KEY = "2GJiBuhHo2eal3cjfv4n";
  let mediaStream = null;
  let capturedImageBlob = null;
  let activeCellId = null;
  let points = 0;
  let chrono = 0;
  let timerInterval = null;

  const correctAnswers = {
    "cell-1": "flower",
    "cell-2": "candle",
    "cell-3": "person",
    "cell-4": "cross",
    "cell-5": "bed",
    "cell-6": "bottle",
    "cell-7": "book",
    "cell-8": "chair",
    "cell-9": "stairs"
  };

  const isCellCompleted = Object.fromEntries(
    Object.keys(correctAnswers).map(key => [key, false])
  );

  // ——— NAVIGATION ———
  function showPage(page) {
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    page.classList.add("active");
  }

  homeButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      clearInterval(timerInterval);
      timerInterval = null;
      showPage(bingoPage);
    });
  });

  // ——— TIMER & POINTS ———
  function startTime() {
    if (timerInterval) return;
    timerInterval = setInterval(() => {
      chrono++;
      const m = Math.floor(chrono / 60);
      const s = chrono % 60;
      chronoLabel.textContent = `${m}:${s < 10 ? "0" + s : s}`;
    }, 1000);
  }

  function updatePoints() {
    pointsLabel.textContent = points;
  }

  function startGame() {
    clearInterval(timerInterval);
    timerInterval = null;
    points = 0;
    chrono = 0;
    Object.keys(isCellCompleted).forEach(k => isCellCompleted[k] = false);
    gridCells.forEach(c => {
      c.classList.remove("completed");
      c.addEventListener("click", handleCellClick);
    });
    updatePoints();
    chronoLabel.textContent = "0:00";
    showPage(bingoPage);
  }

  // ——— CAMERA FLOW ———
  function stopCamera() {
    if (mediaStream) {
      mediaStream.getTracks().forEach(t => t.stop());
      mediaStream = null;
    }
  }

  async function initializeCamera() {
    stopCamera();
    errorMessageElement.textContent = "";
    detectionResultsElement.textContent = "";
    cameraSection.style.display = "block";
    resultSection.style.display = "none";

    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });
      videoElement.srcObject = mediaStream;
    } catch (err) {
      errorMessageElement.textContent = `Camera access error: ${err.message}`;
    }
  }

  function capturePhoto() {
    const ctx = canvasElement.getContext("2d");
    canvasElement.width  = videoElement.videoWidth;
    canvasElement.height = videoElement.videoHeight;
    ctx.drawImage(videoElement, 0, 0);

    canvasElement.toBlob(blob => {
      capturedImageBlob = blob;
    }, "image/jpeg", 0.9);

    cameraSection.style.display = "none";
    resultSection.style.display = "block";
    stopCamera();
  }

  // ——— DETECTION ———
  async function detectObjects() {
    if (!capturedImageBlob) {
      errorMessageElement.textContent = "No image captured.";
      return;
    }

    detectButton.disabled = true;
    detectionResultsElement.textContent = "Detecting objects…";
    errorMessageElement.textContent = "";

    try {
      const imageUrl = await uploadImageToImgur(capturedImageBlob);
      const resp = await fetch(ROBOFLOW_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: ROBOFLOW_API_KEY,
          inputs: { image: { type: "url", value: imageUrl } }
        })
      });
      const result = await resp.json();
      processDetectionResult(result);
    } catch (err) {
      errorMessageElement.textContent = `Detection failed: ${err.message}`;
    } finally {
      detectButton.disabled = false;
    }
  }

  async function uploadImageToImgur(blob) {
    const formData = new FormData();
    formData.append("image", blob);
    const res = await fetch("https://api.imgur.com/3/image", {
      method: "POST",
      headers: { Authorization: "Client-ID 1e3f7ff17203f12" },
      body: formData
    });
    const data = await res.json();
    return data.data.link;
  }

  function processDetectionResult(result) {
    const target = correctAnswers[activeCellId];
    const preds  = result.results?.[0]?.predictions || [];
    const match  = preds.find(p => 
      p.class.toLowerCase().includes(target) && p.confidence > 0.5
    );

    if (match) {
      detectionResultsElement.textContent = 
        `Match: ${match.class} (${(match.confidence * 100).toFixed(1)}%)`;
      markCellAsCompleted(activeCellId);
      retryButton.style.display = "none";
      setTimeout(() => showPage(bingoPage), 1500);
    } else {
      errorMessageElement.textContent = `No ${target} found.`;
      retryButton.style.display = "block";
    }
  }

  function markCellAsCompleted(cellId) {
    const cell = document.getElementById(cellId);
    if (!cell || isCellCompleted[cellId]) return;

    cell.classList.add("completed");
    cell.removeEventListener("click", handleCellClick);
    isCellCompleted[cellId] = true;
    points += 10;
    updatePoints();

    if (Object.values(isCellCompleted).every(Boolean)) {
      clearInterval(timerInterval);
      timerInterval = null;

      const m = Math.floor(chrono / 60);
      const s = chrono % 60;
      timeTakenLabel.textContent = 
        `${m}:${s < 10 ? "0" + s : s}`;

      setTimeout(() => showPage(winPage), 2000);
    }
  }

  function retryCapture() {
    capturedImageBlob = null;
    detectionResultsElement.textContent = "";
    errorMessageElement.textContent = "";
    retryButton.style.display = "none";
    initializeCamera();
  }

  // ——— CELL CLICK HANDLER ———
  function handleCellClick(e) {
    const cell = e.currentTarget;
    if (isCellCompleted[cell.id] || activeCellId) return;

    activeCellId = cell.id;
    startTime();
    showPage(cameraPage);
    initializeCamera();
  }

  // ——— EVENT BINDINGS ———
  gridCells.forEach(cell => cell.addEventListener("click", handleCellClick));
  captureButton.addEventListener("click", capturePhoto);
  detectButton.addEventListener("click", detectObjects);
  retryButton.addEventListener("click", retryCapture);

  // ——— LAUNCH ———
  startGame();
});
