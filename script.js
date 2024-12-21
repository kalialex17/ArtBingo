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

    const HUGGING_FACE_API_URL = "https://api-inference.huggingface.co/models/facebook/detr-resnet-50";
    let HUGGING_FACE_API_TOKEN = null;
    let mediaStream = null;
    let capturedImageBase64 = null;
    let originalImage = null;

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
                body: JSON.stringify({ inputs: capturedImageBase64, parameters: { threshold: 0.7 } }),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
            }
            const results = await response.json();
            displayDetectionResults(results);
        } catch (error) {
            console.error('Full error object:', error);
            errorMessageElement.innerHTML = `<span class="error">Object Detection Error:</span> <br>${error.message}`;
            detectionResultsElement.textContent = '';
        }
    }

    // --------------- Display Detection Results ---------------
    function displayDetectionResults(results) {
        if (!results || results.length === 0) {
            detectionResultsElement.textContent = 'No objects detected.';
            return;
        }

        const sortedResults = results.sort((a, b) => b.score - a.score);
        const context = canvasElement.getContext('2d');
        context.drawImage(originalImage, 0, 0, canvasElement.width, canvasElement.height);

        const resultHTML = sortedResults.map(item => {
            context.beginPath();
            context.rect(item.box.xmin, item.box.ymin, item.box.xmax - item.box.xmin, item.box.ymax - item.box.ymin);
            context.lineWidth = 3;
            context.strokeStyle = 'red';
            context.stroke();
            context.font = '16px Arial';
            context.fillStyle = 'red';
            context.fillText(`${item.label} (${(item.score * 100).toFixed(2)}%)`, item.box.xmin, item.box.ymin - 10);
            return `<div><strong>Object:</strong> ${item.label} <strong>Confidence:</strong> ${(item.score * 100).toFixed(2)}%</div>`;
        }).join('<hr>');

        detectionResultsElement.innerHTML = resultHTML;
    }

    // ---------------- Retry Capture -----------------
    function retryCapture() {
        initializeCamera();
        capturedImageBase64 = null;
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

    // ---------------- Grid Interactions -----------------
    const gridCells = Array.from(document.querySelectorAll('.grid-cell'));

    gridCells.forEach((cell, index) => {
        cell.addEventListener('click', () => {
            console.log(`Navigating to camera page from cell ${index + 1}`);
            showPage(cameraPage);
        });
    });

    // ---------------- Startup -----------------
    const storedApiKey = localStorage.getItem('huggingFaceApiKey');
    if (storedApiKey) HUGGING_FACE_API_TOKEN = storedApiKey;
    initializeCamera();

    // ---------------- Page Navigation -----------------
    const bingoPage = document.getElementById("bingo-page");
    const cameraPage = document.getElementById("camera-page");

    // Function to switch between pages
    function showPage(pageToShow) {
        // Hide all pages
        document.querySelectorAll(".page").forEach(page => page.classList.remove("active"));

        // Show the selected page
        pageToShow.classList.add("active");
    }
});
