document.addEventListener("DOMContentLoaded", () => {
  const ROBLOFLOW_API_URL = "https://detect.roboflow.com/YOUR_PROJECT_NAME/1";
  let storedApiKey = localStorage.getItem("roboflowApiKey") || "";
  let activeCellId = null;
  let capturedImageBlob = null;
  let points = 0;
  let chrono = 0;
  let timerInterval = null;

  const video = document.getElementById("camera-preview");
  const canvas = document.getElementById("captured-image");
  const captureBtn = document.getElementById("capture-btn");
  const detectBtn = document.getElementById("detect-btn");
  const retryBtn = document.getElementById("retry-btn");
  const detectionResults = document.getElementById("detection-results");
  const errorMessage = document.getElementById("error-message");
  const resultSection = document.getElementById("result-section");

  const apiKeyPopup = document.getElementById("api-key-popup");
  const apiKeyInput = document.getElementById("api-key-input");
  const saveApiKeyBtn = document.getElementById("save-api-key-btn");
  const closePopupBtn = document.getElementById("close-popup-btn");
  const apiKeyBtn = document.getElementById("api-key-btn");

  const bingoPage = document.getElementById("bingo-page");
  const cameraPage = document.getElementById("camera-page");
  const winPage = document.getElementById("win-page");
  const pointsLabel = document.getElementById("points");
  const chronoLabel = document.getElementById("chrono");
  const timeTakenLabel = document.getElementById("time-taken");

  const gridCells = Array.from(document.querySelectorAll(".grid-cell"));
  const homeButtons = document.querySelectorAll(".home-btn");

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

  const isCellCompleted = Object.fromEntries(Object.keys(correctAnswers).map(k => [k, false]));

  function showPage(pageToShow) {
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    pageToShow.classList.add("active");
  }

  homeButtons.forEach(btn => {
    btn.addEventListener("click", () => showPage(bingoPage));
  });

  function startTime() {
    if (!timerInterval) {
      timerInterval = setInterval(() => {
        chrono++;
        const m = Math.floor(chrono / 60);
        const s = chrono % 60;
        chronoLabel.innerText = `${m}:${s < 10 ? "0" + s : s}`;
      }, 1000);
    }
  }

  function updatePoints() {
    pointsLabel.innerText = points;
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
    if (Object.values(isCellCompleted).every(v => v)) {
      const m = Math.floor(chrono / 60);
      const s = chrono % 60;
      timeTakenLabel.innerText = `${m}:${s < 10 ? "0" + s : s}`;
      setTimeout(() => showPage(winPage), 2000);
    }
  }

  function handleCellClick(e) {
    activeCellId = e.target.id;
    startTime();
    showPage(cameraPage);
    initializeCamera();
  }

  gridCells.forEach(cell => cell.addEventListener("click", handleCellClick));

  function initializeCamera() {
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(stream => video.srcObject = stream);
  }

  captureBtn.addEventListener("click", () => {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);
    resultSection.style.display = "block";
    canvas.toBlob(blob => {
      capturedImageBlob = blob;
    }, "image/jpeg");
  });

  detectBtn.addEventListener("click", () => {
    if (!storedApiKey) {
      alert("Please set your Roboflow API key.");
      return;
    }
    if (!capturedImageBlob || !activeCellId) return;

    const formData = new FormData();
    formData.append("file", capturedImageBlob);

    fetch(`${ROBLOFLOW_API_URL}?api_key=${storedApiKey}`, {
      method: "POST",
      body: formData
    }).then(res => res.json())
      .then(data => matchDetection(data.predictions))
      .catch(err => {
        errorMessage.innerText = `Detection error: ${err.message}`;
        detectionResults.innerText = "";
      });
  });

  function matchDetection(predictions) {
    const required = correctAnswers[activeCellId];
    const validLabels = CLASS_MAPPING[required] || [required];
    const match = predictions.find(p => validLabels.some(label => p.class.toLowerCase().includes(label)));

    if (match) {
      drawBoxes(predictions);
      detectionResults.innerText = `Matched: ${match.class}`;
      markCellAsCompleted(activeCellId);
      retryBtn.style.display = "none";
      setTimeout(() => showPage(bingoPage), 1500);
    } else {
      const labels = predictions.map(p => p.class).join(", ");
      errorMessage.innerText = `No match. Detected: ${labels}`;
      retryBtn.style.display = "block";
    }
  }

  function drawBoxes(predictions) {
    const ctx = canvas.getContext("2d");
    predictions.forEach(pred => {
      ctx.strokeStyle = "#00FF00";
      ctx.lineWidth = 2;
      ctx.strokeRect(
        pred.x - pred.width / 2,
        pred.y - pred.height / 2,
        pred.width,
        pred.height
      );
      ctx.font = "14px Arial";
      ctx.fillStyle = "#00FF00";
      ctx.fillText(pred.class, pred.x - pred.width / 2, pred.y - pred.height / 2 - 5);
    });
  }

  retryBtn.addEventListener("click", () => {
    resultSection.style.display = "none";
    initializeCamera();
  });

  apiKeyBtn.addEventListener("click", () => {
    apiKeyPopup.style.display = "block";
    apiKeyInput.value = storedApiKey;
  });

  saveApiKeyBtn.addEventListener("click", () => {
    storedApiKey = apiKeyInput.value.trim();
    localStorage.setItem("roboflowApiKey", storedApiKey);
    apiKeyPopup.style.display = "none";
  });

  closePopupBtn.addEventListener("click", () => {
    apiKeyPopup.style.display = "none";
  });
});
