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
    const closePopupButton = document.getElementById('close-popup-btn'); // Added close button reference

    const HUGGING_FACE_API_URL = "https://api-inference.huggingface.co/models/facebook/detr-resnet-50";
    let HUGGING_FACE_API_TOKEN = null;
    let mediaStream = null;
    let capturedImageBase64 = null;
    let originalImage = null;

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

    const isCellCompleted = {
        'cell-1': false,
        'cell-2': false,
        'cell-3': false,
        'cell-4': false,
        'cell-5': false,
        'cell-6': false,
        'cell-7': false,
        'cell-8': false,
        'cell-9': false
    };

    let activeCellId = null; // Track which cell is currently active


    // ---------------- Page Management -----------------
    const bingoPage = document.getElementById("bingo-page");
    const cameraPage = document.getElementById("camera-page");
    const winPage = document.getElementById("win-page");

    function showPage(pageToShow) {
        document.querySelectorAll(".page").forEach(page => page.classList.remove("active"));
        pageToShow.classList.add("active");
    }


    // ---------------- Home button -----------------
    const homeButtons = document.querySelectorAll(".home-btn");

    // Add event listeners to all home buttons
    homeButtons.forEach(button => {
        button.addEventListener("click", () => {
            showPage(bingoPage); // Navigate back to the Bingo page
        });
    });

    // --------------- Initialize Game -----------------
    points_label = document.getElementById("points");
    chrono_label = document.getElementById("chrono");
    time_taken_label = document.getElementById("time-taken");
    let points = 0;
    let chrono = 0;
    let timerInterval = null;

    function startGame() {
        points = 0;
        chrono = 0;
        points_label.innerText = points;
        chrono_label.innerText = chrono;
        showPage(bingoPage);
    }

    function startTime() {
        if (!timerInterval) {
            timerInterval = setInterval(() => {
                chrono++;
                let minutes = Math.floor(chrono / 60);
                let seconds = chrono % 60;
                chrono_label.innerText = `${minutes}:${seconds < 10 ? '0' + seconds : seconds}`;
            }, 1000);
        }
    }


    // --------------- Initialize Camera -----------------
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

    // ---------------- Capture Photo -----------------
    function capturePhoto() {
        canvasElement.width = videoElement.videoWidth;
        canvasElement.height = videoElement.videoHeight;
        const context = canvasElement.getContext('2d');
        context.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);

        originalImage = new Image();
        originalImage.src = canvasElement.toDataURL('image/jpeg');
        capturedImageBase64 = canvasElement.toDataURL('image/jpeg').split(',')[1];

        cameraSection.style.display = 'none';
        resultSection.style.display = 'block';
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
        }
    }

    // ---------------- Detect Objects -----------------
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
    
    // --------------- Process Top Detection Result ---------------
    function processTopDetectionResult(results) {
        if (!results || results.length === 0) {
            detectionResultsElement.textContent = 'No objects detected. Please retry.';
            retryButton.style.display = 'block'; // Show Retry Button
            return;
        }

        // Get the top result
        const topResult = results.sort((a, b) => b.score - a.score)[0];
        const { label, score } = topResult;

        detectionResultsElement.textContent = `Detected: ${label} (Confidence: ${(score * 100).toFixed(2)}%)`;

        // Check if the result matches the correct answer for the active cell
        if (activeCellId && correctAnswers[activeCellId] === label.toLowerCase()) {
            markCellAsCompleted(activeCellId);
            retryButton.style.display = 'none'; // Hide Retry Button if successful
            setTimeout(() => {
                showPage(bingoPage);
            }, 1000);
        } else {
            errorMessageElement.textContent = `The detected object "${label}" does not match the required object (${correctAnswers[activeCellId]}).`;
            retryButton.style.display = 'block'; // Show Retry Button
        }
    }

    // --------------- Mark Cell as Completed ---------------
    function markCellAsCompleted(cellId) {
        const cell = document.getElementById(cellId);
        if (cell) {
            cell.classList.add('completed');
            cell.removeEventListener('click', handleCellClick);
            isCellCompleted[cellId] = true;
            points += 10;
        }
       
    function updatePoints() {
            points_label.innerText = points;
        }
        
        // Check if all cells are completed
        const allCellsCompleted = Object.values(isCellCompleted).every(value => value);
        if (allCellsCompleted) {

            let minutes = Math.floor(chrono / 60);
            let seconds = chrono % 60;
            time_taken_label.innerText = `${minutes}:${seconds < 10 ? '0' + seconds : seconds}`;
            setTimeout(() => {
                showPage(winPage);
            }, 2000);
        }
    }

    // ---------------- Retry Capture -----------------
    function retryCapture() {
        initializeCamera();
        capturedImageBase64 = null;
        detectionResultsElement.textContent = '';
        errorMessageElement.textContent = '';
        retryButton.style.display = 'none'; // Hide Retry Button when retrying
    }

    // ---------------- API Key Handlers -----------------
    function showApiKeyPopup() {
        const storedApiKey = localStorage.getItem('huggingFaceApiKey');
        apiKeyInput.value = storedApiKey || '';
        apiKeyPopup.style.display = 'block';
    }

    function saveApiKey() {
        const apiKey = apiKeyInput.value.trim();
        if (apiKey) {
            localStorage.setItem('huggingFaceApiKey', apiKey);
            HUGGING_FACE_API_TOKEN = apiKey;
            apiKeyPopup.style.display = 'none';
        } else {
            alert('API key cannot be empty.');
        }
    }

    function closeApiKeyPopup() {
        apiKeyPopup.style.display = 'none';
    }

    // ---------------- Grid Interactions -----------------
    const gridCells = Array.from(document.querySelectorAll('.grid-cell'));

    function handleCellClick(event) {
        const cell = event.target;
        activeCellId = cell.id; // Set the active cell ID
        startTime(); // Start the timer
        showPage(cameraPage);
        initializeCamera();
    }

    gridCells.forEach(cell => {
        cell.addEventListener('click', handleCellClick);
    });

    // ---------------- Startup -----------------
    const storedApiKey = localStorage.getItem('huggingFaceApiKey');
    if (storedApiKey) HUGGING_FACE_API_TOKEN = storedApiKey;


    startGame(); // Start the game

    apiKeyButton.addEventListener('click', showApiKeyPopup);
    saveApiKeyButton.addEventListener('click', saveApiKey);
    closePopupButton.addEventListener('click', closeApiKeyPopup); // Close popup event
    captureButton.addEventListener('click', capturePhoto);
    detectButton.addEventListener('click', detectObjects);
    retryButton.addEventListener('click', retryCapture);
});