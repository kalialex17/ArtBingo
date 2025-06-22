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


    const HUGGING_FACE_API_URL = "https://proxy.cors.sh/https://api-inference.huggingface.co/models/google/vit-base-patch16-224";
    let HUGGING_FACE_API_TOKEN = null;
    let mediaStream = null;
    let capturedImageBlob = null; // Replace capturedImageBase64 with this
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

    const CLASS_MAPPING = {
        'flower': ['daisy', 'sunflower', 'vase', 'flower', 'bouquet'],
        'candle': ['candle', 'lantern', 'candlestick'],
        'person': ['person', 'man', 'woman', 'child', 'face'],
        'cross': ['cross', 'crucifix', 'christian cross'],
        'bed': ['bed', 'four-poster bed', 'crib'],
        'bottle': ['bottle', 'wine bottle', 'perfume bottle', 'vase'],
        'book': ['book', 'notebook', 'booklet', 'bible'],
        'chair': ['chair', 'folding chair', 'rocking chair', 'bench'],
        'stairs': ['stairway', 'staircase', 'steps']
    };

    const isCellCompleted = {
        'cell-1': true,
        'cell-2': true,
        'cell-3': true,
        'cell-4': true,
        'cell-5': true,
        'cell-6': true,
        'cell-7': true,
        'cell-8': true,
        'cell-9': true
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
      
        // Get image as Blob instead of base64
        canvasElement.toBlob((blob) => {
          capturedImageBlob = blob;
        }, 'image/jpeg', 0.8);
      
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
    if (!capturedImageBlob) {
        errorMessageElement.textContent = 'No image captured. Please capture a photo first.';
        return;
    }

    try {
        detectionResultsElement.textContent = 'Detecting objects... Please wait.';
        errorMessageElement.textContent = '';

        // Convert Blob to base64
        const reader = new FileReader();
        reader.readAsDataURL(capturedImageBlob);
        
        const base64data = await new Promise((resolve) => {
            reader.onloadend = () => resolve(reader.result.split(',')[1]);
        });

        const response = await fetch(HUGGING_FACE_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${HUGGING_FACE_API_TOKEN}`,
                'Content-Type': 'application/json',
                'x-cors-api-key': 'temp_0a4a4a4a4a4a4a4a4a4a4a4a4a4a4a4a', // Free temporary key
                'Origin': 'https://kalialex17.github.io'
            },
            body: JSON.stringify({ inputs: base64data })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! Status: ${response.status}, Details: ${errorText}`);
        }

        const results = await response.json();
        processTopDetectionResult(results);

    } catch (error) {
        console.error('Detection error:', error);
        errorMessageElement.textContent = `Detection failed: ${error.message}`;
        detectionResultsElement.textContent = '';
    }
}

    
    // --------------- Process Top Detection Result ---------------
function processTopDetectionResult(results) {
    if (!results || results.length === 0) {
        detectionResultsElement.textContent = 'No objects detected. Please retry.';
        retryButton.style.display = 'block';
        return;
    }

        // Get the required object for the active cell (e.g. "flower")
        const requiredObject = correctAnswers[activeCellId];
        // Get allowed labels from CLASS_MAPPING (e.g. ["daisy", "sunflower"...])
        const allowedLabels = CLASS_MAPPING[requiredObject] || [requiredObject];

        // Sort results by confidence score (highest first)
        const sortedResults = results.sort((a, b) => b.score - a.score);
        
        // Check top 3 predictions for matches
        const topPredictions = sortedResults.slice(0, 3);
        const match = topPredictions.find(prediction => {
            const predictionLabel = prediction.label.toLowerCase();
            return allowedLabels.some(label => predictionLabel.includes(label));
        });

        if (match && match.score > 0.65) { // 65% confidence threshold
            detectionResultsElement.textContent = `Match found: ${match.label} (${(match.score * 100).toFixed(1)}% confidence)`;
            markCellAsCompleted(activeCellId);
            retryButton.style.display = 'none';
            setTimeout(() => showPage(bingoPage), 1500);
        } else {
            const detectedLabels = topPredictions.map(p => p.label).join(', ');
            errorMessageElement.textContent = `No ${requiredObject} found. Detected: ${detectedLabels}`;
            retryButton.style.display = 'block';
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
        capturedImageBlob = null; // Changed from capturedImageBase64
        detectionResultsElement.textContent = '';
        errorMessageElement.textContent = '';
        retryButton.style.display = 'none';
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
