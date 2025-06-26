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
  const apiKeyButton = document.getElementById("api-key-btn");
  const apiKeyPopup = document.getElementById("api-key-popup");
  const apiKeyInput = document.getElementById("api-key-input");
  const saveApiKeyButton = document.getElementById("save-api-key-btn");
  const closePopupButton = document.getElementById("close-popup-btn");

  const bingoPage = document.getElementById("bingo-page");
  const cameraPage = document.getElementById("camera-page");
  const winPage = document.getElementById("win-page");

  const pointsLabel = document.getElementById("points");
  const chronoLabel = document.getElementById("chrono");
  const timeTakenLabel = document.getElementById("time-taken");

  const gridCells = Array.from(document.querySelectorAll(".grid-cell"));
  const homeButtons = document.querySelectorAll(".home-btn");

  // ------- STATE -------
  const HUGGING_FACE_API_URL = "https://proxy.cors.sh/https://api-inference.huggingface.co/models/google/vit-base-patch16-224";
  let HUGGING_FACE_API_TOKEN = null;
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

  const CLASS_MAPPING = {
    flower: ["daisy", "sunflower", "vase", "flower", "bouquet"],
    candle: ["candle", "lantern", "candlestick"],
    person: ["person", "man", "woman", "child", "face"],
    cross: ["cross", "crucifix", "christian cross"],
    bed: ["bed", "four-poster bed", "crib"],
    bottle: ["bottle", "wine bottle", "perfume bottle", "vase"],
    book: ["book", "notebook", "booklet", "bible"],
    chair: ["chair", "folding chair", "rocking chair", "bench"],
    stairs: ["stairway", "staircase", "steps"],
  };

  const isCellCompleted = {
    "cell-1": false, "cell-2": false, "cell-3": false,
    "cell-4": false, "cell-5": false, "cell-6": false,
    "cell-7": false, "cell-8": false, "cell-9": false
  };

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
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      videoElement.srcObject = mediaStream;
      cameraSection.style.display = "block";
      resultSection.style.display = "none";
      detectionResultsElement.textContent = "";
      errorMessageElement.textContent = "";
    } catch (error) {
      errorMessageElement.textContent = `Camera access error: ${error.message}`;
      console.error("Camera initialization error:", error);
    }
  }
  // ------- PHOTO CAPTURE -------
  function capturePhoto() {
    const maxWidth = 800;
    const maxHeight = 600;
    const originalWidth = videoElement.videoWidth;
    const originalHeight = videoElement.videoHeight;

    let newWidth = originalWidth;
    let newHeight = originalHeight;

    if (originalWidth > maxWidth || originalHeight > maxHeight) {
      const aspectRatio = originalWidth / originalHeight;
      if (originalWidth > originalHeight) {
        newWidth = maxWidth;
        newHeight = Math.round(maxWidth / aspectRatio);
      } else {
        newHeight = maxHeight;
        newWidth = Math.round(maxHeight * aspectRatio);
      }
    }

    canvasElement.width = newWidth;
    canvasElement.height = newHeight;
    const context = canvasElement.getContext("2d");
    context.drawImage(videoElement, 0, 0, newWidth, newHeight);

    canvasElement.toBlob(blob => {
      capturedImageBlob = blob;
    }, "image/jpeg", 0.8);

    cameraSection.style.display = "none";
    resultSection.style.display = "block";
    stopCamera();
  }

  // ------- OBJECT DETECTION -------
  async function detectObjects() {
    if (!HUGGING_FACE_API_TOKEN) {
      errorMessageElement.textContent = "API key is missing. Please set the API key first.";
      return;
    }
    if (!capturedImageBlob) {
      errorMessageElement.textContent = "No image captured. Please capture a photo first.";
      return;
    }

    try {
      detectionResultsElement.textContent = "Detecting objects... Please wait.";
      errorMessageElement.textContent = "";

      const reader = new FileReader();
      reader.readAsDataURL(capturedImageBlob);

      const base64data = await new Promise(resolve => {
        reader.onloadend = () => resolve(reader.result.split(",")[1]);
      });

      const response = await fetch(HUGGING_FACE_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HUGGING_FACE_API_TOKEN}`,
          "Content-Type": "application/json",
          "x-cors-api-key": "temp_0a4a4a4a4a4a4a4a4a4a4a4a4a4a4a4a",
          Origin: "https://kalialex17.github.io",
        },
        body: JSON.stringify({ inputs: base64data }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! Status: ${response.status}, Details: ${errorText}`);
      }

      const results = await response.json();

      if (!Array.isArray(results)) {
        throw new Error("Unexpected API response format");
      }

      processTopDetectionResult(results);
    } catch (error) {
      console.error("Detection error:", error);
      errorMessageElement.textContent = `Detection failed: ${error.message}`;
      detectionResultsElement.textContent = "";
    }
  }
  // ------- PROCESS DETECTION RESULT -------
  function processTopDetectionResult(results) {
    const requiredObject = correctAnswers[activeCellId];
    const allowedLabels = CLASS_MAPPING[requiredObject] || [requiredObject];

    const sortedResults = results.sort((a, b) => b.score - a.score);
    const topPredictions = sortedResults.slice(0, 3);

    const match = topPredictions.find(prediction => {
      const predictionLabel = prediction.label.toLowerCase();
      return allowedLabels.some(label => predictionLabel.includes(label));
    });

    if (match && match.score > 0.65) {
      detectionResultsElement.textContent = `Match found: ${match.label} (${(match.score * 100).toFixed(1)}% confidence)`;
      markCellAsCompleted(activeCellId);
      retryButton.style.display = "none";
      setTimeout(() => showPage(bingoPage), 1500);
    } else {
      const detectedLabels = topPredictions.map(p => p.label).join(", ");
      errorMessageElement.textContent = `No ${requiredObject} found. Detected: ${detectedLabels}`;
      retryButton.style.display = "block";
    }
  }

  // ------- MARK CELL COMPLETED -------
  function markCellAsCompleted(cellId) {
    const cell = document.getElementById(cellId);
    if (cell) {
      cell.classList.add("completed");
      cell.removeEventListener("click", handleCellClick);
      isCellCompleted[cellId] = true;
      points += 10;
      updatePoints();
    }

    const allCellsCompleted = Object.values(isCellCompleted).every(v => v);
    if (allCellsCompleted) {
      const minutes = Math.floor(chrono / 60);
      const seconds = chrono % 60;
      timeTakenLabel.innerText = `${minutes}:${seconds < 10 ? "0" + seconds : seconds}`;
      setTimeout(() => showPage(winPage), 2000);
    }
  }
  // ------- RETRY CAPTURE -------
  function retryCapture() {
    capturedImageBlob = null;
    detectionResultsElement.textContent = "";
    errorMessageElement.textContent = "";
    retryButton.style.display = "none";
    initializeCamera();
  }

  // ------- API KEY MANAGEMENT -------
  function showApiKeyPopup() {
    const storedApiKey = localStorage.getItem("huggingFaceApiKey");
    apiKeyInput.value = storedApiKey || "";
    apiKeyPopup.style.display = "block";
  }

  function saveApiKey() {
    const apiKey = apiKeyInput.value.trim();
    if (apiKey) {
      localStorage.setItem("huggingFaceApiKey", apiKey);
      HUGGING_FACE_API_TOKEN = apiKey;
      apiKeyPopup.style.display = "none";
    } else {
      alert("API key cannot be empty.");
    }
  }

  function closeApiKeyPopup() {
    apiKeyPopup.style.display = "none";
  }

  // ------- GRID CELL INTERACTIONS -------
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

  // ------- STARTUP -------
  const storedApiKey = localStorage.getItem("huggingFaceApiKey");
  if (storedApiKey) {
    HUGGING_FACE_API_TOKEN = storedApiKey;
  }

  startGame();

  // Button event listeners
  apiKeyButton.addEventListener("click", showApiKeyPopup);
  saveApiKeyButton.addEventListener("click", saveApiKey);
  closePopupButton.addEventListener("click", closeApiKeyPopup);
  captureButton.addEventListener("click", capturePhoto);
  detectButton.addEventListener("click", detectObjects);
  retryButton.addEventListener("click", retryCapture);
});
