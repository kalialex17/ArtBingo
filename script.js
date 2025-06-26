document.addEventListener("DOMContentLoaded", () => {
  // ------- DOM ELEMENTS -------
  const videoElement = document.getElementById("camera-preview");
  const canvasElement = document.getElementById("captured-image");
  const captureButton = document.getElementById("capture-btn");
  const detectButton = document.getElementById("detect-btn");
  const retryButton = document.getElementById("retry-btn");
  const errorMessageElement = document.getElementById("error-message");
  const detectionResultsElement = document.getElementById("detection-results");
  const cameraSection = document.getElementById("camera-section");
  const resultSection = document.getElementById("result-section");
  const bingoPage = document.getElementById("bingo-page");
  const cameraPage = document.getElementById("camera-page");
  const winPage = document.getElementById("win-page");
  const pointsLabel = document.getElementById("points");
  const chronoLabel = document.getElementById("chrono");
  const timeTakenLabel = document.getElementById("time-taken");
  const gridCells = Array.from(document.querySelectorAll(".grid-cell"));
  const homeButtons = document.querySelectorAll(".home-btn");

  // ------- STATE -------
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
    "cell-9": "stairs",
  };
  const isCellCompleted = Object.fromEntries(
    Object.keys(correctAnswers).map(key => [key, false])
  );

  // ------- PAGE NAVIGATION -------
  function showPage(pageToShow) {
    document.querySelectorAll(".page").forEach(page => page.classList.remove("active"));
    pageToShow.classList.add("active");
  }

  homeButtons.forEach(button => {
    button.addEventListener("click", () => showPage(bingoPage));
  });

  // ------- TIMER & POINTS -------
  function startTime() {
    if (!timerInterval) {
      timerInterval = setInterval(() => {
        chrono++;
        const minutes = Math.floor(chrono / 60);
        const seconds = chrono % 60;
        chronoLabel.innerText = `${minutes}:${seconds < 10 ? "0" + seconds : seconds}`;
      }, 1000);
    }
  }

  function updatePoints() {
    pointsLabel.innerText = points;
  }

  function startGame() {
    points = 0;
    chrono = 0;
    pointsLabel.innerText = points;
    chronoLabel.innerText = "0:00";
    showPage(bingoPage);
  }

  // ------- CAMERA -------
  function stopCamera() {
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
    }
  }

  async function initializeCamera() {
    try {
      stopCamera();
      mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });
      videoElement.srcObject = mediaStream;
      cameraSection.style.display = "block";
      resultSection.style.display = "none";
      detectionResultsElement.textContent = "";
      errorMessageElement.textContent = "";
    } catch (error) {
      errorMessageElement.textContent = `Camera access error: ${error.message}`;
    }
  }

  // ------- PHOTO CAPTURE -------
  function capturePhoto() {
    const context = canvasElement.getContext("2d");
    canvasElement.width = videoElement.videoWidth;
    canvasElement.height = videoElement.videoHeight;
    context.drawImage(videoElement, 0, 0);
    canvasElement.toBlob(blob => {
      capturedImageBlob = blob;
    }, "image/jpeg", 0.9);
    cameraSection.style.display = "none";
    resultSection.style.display = "block";
    stopCamera();
  }

  // ------- OBJECT DETECTION -------
  async function detectObjects() {
    if (!capturedImageBlob) {
      errorMessageElement.textContent = "No image captured.";
      return;
    }
    try {
      detectionResultsElement.textContent = "Detecting objects... Please wait.";
      errorMessageElement.textContent = "";
      const imageUrl = await uploadImageToImgur(capturedImageBlob);
      const response = await fetch(ROBOFLOW_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: ROBOFLOW_API_KEY,
          inputs: { image: { type: "url", value: imageUrl } }
        })
      });
      const result = await response.json();
      processDetectionResult(result);
    } catch (error) {
      errorMessageElement.textContent = `Detection failed: ${error.message}`;
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
    const requiredObject = correctAnswers[activeCellId];
    const predictions = result.results?.[0]?.predictions || [];
    const match = predictions.find(pred => pred.class.toLowerCase().includes(requiredObject));
    if (match && match.confidence > 0.5) {
      detectionResultsElement.textContent = `Match: ${match.class} (${(match.confidence * 100).toFixed(1)}%)`;
      markCellAsCompleted(activeCellId);
      retryButton.style.display = "none";
      setTimeout(() => showPage(bingoPage), 1500);
    } else {
      errorMessageElement.textContent = `No ${requiredObject} found.`;
      retryButton.style.display = "block";
    }
  }

  function markCellAsCompleted(cellId) {
    const cell = document.getElementById(cellId);
    if (cell) {
      cell.classList.add("completed");
      cell.removeEventListener("click", handleCellClick);
      isCellCompleted[cellId] = true;
      points += 10;
      updatePoints();
    }
    if (Object.values(isCellCompleted).every(Boolean)) {
      const minutes = Math.floor(chrono / 60);
      const seconds = chrono % 60;
      timeTakenLabel.innerText = `${minutes}:${seconds < 10 ? "0" + seconds : seconds}`;
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

  function handleCellClick(event) {
    const cell = event.target;
    activeCellId = cell.id;
    startTime();
    showPage(cameraPage);
    initializeCamera();
  }

  gridCells.forEach(cell => {
    cell.addEventListener("click", handleCellClick);
  });

  startGame();
  captureButton.addEventListener("click", capturePhoto);
  detectButton.addEventListener("click", detectObjects);
  retryButton.addEventListener("click", retryCapture);
});
