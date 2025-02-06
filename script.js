document.addEventListener("DOMContentLoaded", () => {
    // Common DOM Elements
    const videoElement = document.getElementById('camera-preview');
    const canvasElement = document.getElementById('captured-image');
    const captureButton = document.getElementById('capture-btn');
    const detectButton = document.getElementById('detect-btn');
    const retryButton = document.getElementById('retry-btn');
    const errorMessageElement = document.getElementById('error-message');
    const detectionResultsElement = document.getElementById('detection-results');
    const cameraSection = document.getElementById('camera-section');
    const resultSection = document.getElementById('result-section');
    const apiKeyButton = document.getElementById('api-key-btn');
    const apiKeyPopup = document.getElementById('api-key-popup');
    const apiKeyInput = document.getElementById('api-key-input');
    const saveApiKeyButton = document.getElementById('save-api-key-btn');
    const closePopupButton = document.getElementById('close-popup-btn');

    const HUGGING_FACE_API_URL = "https://api-inference.huggingface.co/models/facebook/detr-resnet-50";
    let HUGGING_FACE_API_TOKEN = null;
    let mediaStream = null;
    let capturedImageBase64 = null;
    let originalImage = null;

    // Game State
    const gameState = {
        points: 0,
        chrono: 0,
        timerInterval: null,
        isCellCompleted: {
            'cell-1': true,
            'cell-2': true,
            'cell-3': false,
            'cell-4': true,
            'cell-5': true,
            'cell-6': true,
            'cell-7': true,
            'cell-8': true,
            'cell-9': true
        },
        activeCellId: null
    };

    // Mapping for correct answers per cell
    const correctAnswers = {
        'cell-1': 'flower',
        'cell-2': 'candle',
        'cell-3': 'person',
        'cell-4': 'cross',
        'cell-5': 'bed',
        'cell-6': 'bottle',
        'cell-7': 'book',
        'cell-8': 'chair',
        'cell-9': 'stairs'
    };

    // Page Management
    const bingoPage = document.getElementById("bingo-page");
    const cameraPage = document.getElementById("camera-page");
    const winPage = document.getElementById("win-page");

    function showPage(pageToShow) {
        document.querySelectorAll(".page").forEach(page => page.classList.remove("active"));
        pageToShow.classList.add("active");
    }

    // Home Button
    const homeButtons = document.querySelectorAll(".home-btn");
    homeButtons.forEach(button => {
        button.addEventListener("click", () => {
            showPage(bingoPage);
        });
    });

    // Initialize Game
    const pointsLabel = document.getElementById("points");
    const chronoLabel = document.getElementById("chrono");
    const timeTakenLabel = document.getElementById("time-taken");

    function startGame() {
        gameState.points = 0;
        gameState.chrono = 0;
        pointsLabel.textContent = gameState.points;
        chronoLabel.textContent = '0:00';
        showPage(bingoPage);
    }

    function startTimer() {
        if (!gameState.timerInterval) {
            gameState.timerInterval = setInterval(() => {
                gameState.chrono++;
                const minutes = Math.floor(gameState.chrono / 60);
                const seconds = gameState.chrono % 60;
                chronoLabel.textContent = `${minutes}:${seconds < 10 ? '0' + seconds : seconds}`;
            }, 1000);
        }
    }

    function stopTimer() {
        clearInterval(gameState.timerInterval);
        gameState.timerInterval = null;
    }

    // Initialize Camera
    async function initializeCamera() {
        try {
            mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
            });
            videoElement.srcObject = mediaStream;
            cameraSection.style.display = 'block';
            resultSection.style.display = 'none';
            detectionResultsElement.textContent = '';
            errorMessageElement.textContent = '';
        } catch (error) {
            errorMessageElement.textContent = `Camera access error: ${error.message}`;
            console.error('Camera initialization error:', error);
        }
    }

    function stopCamera() {
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
        }
    }

    // Capture Photo
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
        const context = canvasElement.getContext('2d');
        context.drawImage(videoElement, 0, 0, newWidth, newHeight);

        originalImage = new Image();
        originalImage.src = canvasElement.toDataURL('image/jpeg');
        capturedImageBase64 = canvasElement.toDataURL('image/jpeg').split(',')[1];

        cameraSection.style.display = 'none';
        resultSection.style.display = 'block';

        stopCamera();
    }

    // Detect Objects
    async function detectObjects() {
        if (!HUGGING_FACE_API_TOKEN) {
            errorMessageElement.textContent = 'API key is missing. Please set the API key first.';
            return;
        }
        if (!capturedImageBase64) {
            errorMessageElement.textContent = 'No image captured. Please capture a photo first.';
            return;
        }

        try {
            detectionResultsElement.textContent = 'Detecting objects... Please wait.';
            errorMessageElement.textContent = '';

            const response = await fetch(HUGGING_FACE_API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${HUGGING_FACE_API_TOKEN}`,
                    'Content-Type': 'application/json',
                    'x-wait-for-model': 'true',
                },
                body: JSON.stringify({
                    inputs: { image: capturedImageBase64 },
                    parameters: { threshold: 0.7 }
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const results = await response.json();
            processTopDetectionResult(results);
        } catch (error) {
            console.error('Error during object detection:', error);
            errorMessageElement.innerHTML = `<span class="error">Object Detection Error:</span> <br>${error.message}`;
            detectionResultsElement.textContent = '';
        }
    }

    // Process Top Detection Result
    function processTopDetectionResult(results) {
        if (!results || results.length === 0) {
            detectionResultsElement.textContent = 'No objects detected. Please retry.';
            retryButton.style.display = 'block';
            return;
        }

        const topResult = results.sort((a, b) => b.score - a.score)[0];
        const { label, score } = topResult;

        detectionResultsElement.textContent = `Detected: ${label} (Confidence: ${(score * 100).toFixed(2)}%)`;

        if (gameState.activeCellId && correctAnswers[gameState.activeCellId] === label.toLowerCase()) {
            markCellAsCompleted(gameState.activeCellId);
            retryButton.style.display = 'none';
            setTimeout(() => {
                showPage(bingoPage);
            }, 1000);
        } else {
            errorMessageElement.textContent = `The detected object "${label}" does not match the required object (${correctAnswers[gameState.activeCellId]}).`;
            retryButton.style.display = 'block';
        }
    }

    // Mark Cell as Completed
    function markCellAsCompleted(cellId) {
        const cell = document.getElementById(cellId);
        if (cell) {
            cell.classList.add('completed');
            cell.removeEventListener('click', handleCellClick);
            gameState.isCellCompleted[cellId] = true;
            gameState.points += 10;
            updatePoints();

            const allCellsCompleted = Object.values(gameState.isCellCompleted).every(value => value);
            if (allCellsCompleted) {
                stopTimer();
                const minutes = Math.floor(gameState.chrono / 60);
                const seconds = gameState.chrono % 60;
                timeTakenLabel.textContent = `${minutes}:${seconds < 10 ? '0' + seconds : seconds}`;
                setTimeout(() => {
                    showPage(winPage);
                }, 2000);
            }
        }
    }

    function updatePoints() {
        pointsLabel.textContent = gameState.points;
    }

    // Retry Capture
    function retryCapture() {
        initializeCamera();
        capturedImageBase64 = null;
        detectionResultsElement.textContent = '';
        errorMessageElement.textContent = '';
        retryButton.style.display = 'none';
    }

    // API Key Handlers
    function showApiKeyPopup() {
        const storedApiKey = localStorage.getItem('huggingFaceApiKey');
        apiKeyInput.value = storedApiKey || '';
        apiKeyPopup.classList.remove('hidden');
    }

    function saveApiKey() {
        const apiKey = apiKeyInput.value.trim();
        if (apiKey) {
            localStorage.setItem('huggingFaceApiKey', apiKey);
            HUGGING_FACE_API_TOKEN = apiKey;
            apiKeyPopup.classList.add('hidden');
        } else {
            alert('API key cannot be empty.');
        }
    }

    function closeApiKeyPopup() {
        apiKeyPopup.classList.add('hidden');
    }

    // Grid Interactions
    const gridCells = Array.from(document.querySelectorAll('.grid-cell'));

    function handleCellClick(event) {
        const cell = event.target;
        gameState.activeCellId = cell.id;
        startTimer();
        showPage(cameraPage);
        initializeCamera();
    }

    gridCells.forEach(cell => {
        cell.addEventListener('click', handleCellClick);
    });

    // Startup
    const storedApiKey = localStorage.getItem('huggingFaceApiKey');
    if (storedApiKey) HUGGING_FACE_API_TOKEN = storedApiKey;

    startGame();

    apiKeyButton.addEventListener('click', showApiKeyPopup);
    saveApiKeyButton.addEventListener('click', saveApiKey);
    closePopupButton.addEventListener('click', closeApiKeyPopup);
    captureButton.addEventListener('click', capturePhoto);
    detectButton.addEventListener('click', detectObjects);
    retryButton.addEventListener('click', retryCapture);
});