document.addEventListener("DOMContentLoaded", () => {
  // ——— Helper to grab or crash ———
  function $(id) {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Missing #${id} in HTML`);
    return el;
  }

  // ——— DOM ELEMENTS ———
  const videoEl       = $("camera-preview");
  const canvasEl      = $("captured-image");
  const btnCapture    = $("capture-btn");
  const btnDetect     = $("detect-btn");
  const btnRetry      = $("retry-btn");
  const msgError      = $("error-message");
  const msgResults    = $("detection-results");
  const secCamera     = $("camera-section");
  const secResult     = $("result-section");
  const pageBingo     = $("bingo-page");
  const pageCamera    = $("camera-page");
  const pageWin       = $("win-page");
  const lblPoints     = $("points");
  const lblChrono     = $("chrono");
  const lblTimeTaken  = $("time-taken");
  const cells         = Array.from(document.querySelectorAll(".grid-cell"));
  const btnHomes      = document.querySelectorAll(".home-btn");

  // ——— STATE ———
  const API_URL = "https://serverless.roboflow.com/infer/workflows/art-bingo/detect-and-classify";
  const API_KEY = "2GJiBuhHo2eal3cjfv4n";
  let stream      = null;
  let blobImage   = null;
  let activeCell  = null;
  let points      = 0;
  let chrono      = 0;
  let intervalId  = null;

  const answers = {
    "cell-1": "flower", "cell-2": "candle", "cell-3": "person",
    "cell-4": "cross",  "cell-5": "bed",    "cell-6": "bottle",
    "cell-7": "book",   "cell-8": "chair",  "cell-9": "stairs"
  };
  const done = Object.fromEntries(
    Object.keys(answers).map(k => [k, false])
  );

  // ——— NAV ———
  function show(page) {
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    page.classList.add("active");

    if (page === pageBingo) {
      btnHomes.forEach(btn => btn.classList.add("hidden"));
    } else {
      btnHomes.forEach(btn => btn.classList.remove("hidden"));
    }

  }
  btnHomes.forEach(btn =>
    btn.addEventListener("click", () => {
      clearInterval(intervalId);
      intervalId = null;
      activeCell = null;
      show(pageBingo);
    })
  );

  // ——— TIMER / POINTS ———
  function startTimer() {
    if (intervalId) return;
    intervalId = setInterval(() => {
      chrono++;
      const m = Math.floor(chrono/60), s = chrono%60;
      lblChrono.textContent = `${m}:${s<10? "0"+s : s}`;
    }, 1000);
  }
  function updatePoints() {
    lblPoints.textContent = points;
  }
  function resetGame() {
    clearInterval(intervalId); intervalId = null;
    points = 0; chrono = 0;
    Object.keys(done).forEach(k => done[k] = false);
    cells.forEach(c => {
      c.classList.remove("completed");
      c.addEventListener("click", onCellClick);
    });
    updatePoints();
    lblChrono.textContent = "0:00";
    show(pageBingo);
  }

  // ——— CAMERA ———
  async function startCamera() {
    stopCamera();
    msgError.textContent = "";
    msgResults.textContent = "";
    secCamera.style.display = "block";
    secResult.classList.add("hidden");

    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      videoEl.srcObject = stream;
    } catch (e) {
      msgError.textContent = `Camera error: ${e.message}`;
    }
  }
  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
  }
  function onCapture() {
    const ctx = canvasEl.getContext("2d");
    canvasEl.width  = videoEl.videoWidth;
    canvasEl.height = videoEl.videoHeight;
    ctx.drawImage(videoEl, 0, 0);

    canvasEl.toBlob(b => blobImage = b, "image/jpeg", 0.9);
    secCamera.style.display = "none";
    secResult.classList.remove("hidden");
    stopCamera();
  }

  // ——— DETECT ———
  async function onDetect() {
    if (!blobImage) {
      msgError.textContent = "No image to analyze.";
      return;
    }
    btnDetect.disabled = true;
    msgResults.textContent = "Detecting…";
    msgError.textContent = "";

    try {
      // Convert blob to base64
      const base64Image = await blobToBase64(blobImage);

      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: API_KEY,
          inputs: { image: { type: "base64", value: base64Image } }
        })
      });

      const data = await res.json();
      handleResult(data);
    } catch (e) {
      msgError.textContent = `Detection failed: ${e.message}`;
    } finally {
      btnDetect.disabled = false;
    }
  }

  // Helper to convert Blob to Base64
  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(",")[1]); // Remove data:image/...;base64, header
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }


  async function uploadToImgur(b) {
    const fd = new FormData();
    fd.append("image", b);
    const r = await fetch("https://api.imgur.com/3/image", {
      method: "POST",
      headers: { Authorization: "Client-ID 1e3f7ff17203f12" },
      body: fd
    });
    const js = await r.json();
    return js.data.link;
  }
  function handleResult(res) {
    const target = answers[activeCell];
    const preds  = res.results?.[0]?.predictions || [];
    const found  = preds.find(p =>
      p.class.toLowerCase().includes(target) && p.confidence > 0.5
    );

    if (found) {
      msgResults.textContent =
        `✔ ${found.class} (${(found.confidence*100).toFixed(1)}%)`;
      markDone(activeCell);
      btnRetry.classList.add("hidden");
      setTimeout(()=> show(pageBingo), 1200);
    } else {
      msgError.textContent = `No ${target} found.`;
      btnRetry.classList.remove("hidden");
    }
  }

  // ——— MARK / WIN ———
  function markDone(id) {
    if (done[id]) return;
    const cell = document.getElementById(id);
    cell.classList.add("completed");
    cell.removeEventListener("click", onCellClick);
    done[id] = true;
    points += 10; updatePoints();

    if (Object.values(done).every(v => v)) {
      clearInterval(intervalId); intervalId = null;
      const m = Math.floor(chrono/60), s = chrono % 60;
      lblTimeTaken.textContent = `${m}:${s<10?"0"+s:s}`;
      setTimeout(()=> show(pageWin), 1000);
    }
  }

  // ——— EVENTS ———
  function onCellClick(e) {
    const id = e.currentTarget.id;
    if (done[id] || activeCell) return;
    activeCell = id;
    startTimer();
    show(pageCamera);
    startCamera();
  }
  cells.forEach(c => c.addEventListener("click", onCellClick));
  btnCapture.addEventListener("click", onCapture);
  btnDetect.addEventListener("click", onDetect);
  btnRetry.addEventListener("click", () => {
    blobImage = null;
    msgResults.textContent = "";
    msgError.textContent = "";
    btnRetry.classList.add("hidden");
    startCamera();
  });

  // ——— INIT ———
  resetGame();
});
