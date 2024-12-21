document.addEventListener("DOMContentLoaded", () => {
   
    // Select the grid cells by their position
      const firstCell = document.getElementById("cell-1");
      const secondCell = document.getElementById("cell-2");
      const thirdCell = document.getElementById("cell-3");
      const fourthCell = document.getElementById("cell-4");
      const fifthCell = document.getElementById("cell-5");
      const sixthCell = document.getElementById("cell-6");
      const seventhCell = document.getElementById("cell-7");
      const eighthCell = document.getElementById("cell-8");
      const ninthCell = document.getElementById("cell-9");
    
      // Add click event listener to the first cell
      firstCell.addEventListener("click", () => {
          console.log("IT WORKS DAMMIT"); // Display the message in the console
          alert("IT WORKS DAMMIT"); // Optionally display an alert on the page
      });
  
      // Add click event listener to the second cell
      secondCell.addEventListener("click", () => {
          console.log("IT WORKS DAMMIT 2"); // Display the message in the console
          alert("IT WORKS DAMMIT 2"); // Optionally display an alert on the page
      });
    
    // Add click event listener to the third cell
      thirdCell.addEventListener("click", () => {
          console.log("IT WORKS DAMMIT 3"); // Display the message in the console
          alert("IT WORKS DAMMIT 3"); // Optionally display an alert on the page
      });
    
    // Add click event listener to the fourth cell
      fourthCell.addEventListener("click", () => {
          console.log("IT WORKS DAMMIT 4"); // Display the message in the console
          alert("IT WORKS DAMMIT 4"); // Optionally display an alert on the page
      });
    
    // Add click event listener to the fifth cell
      fifthCell.addEventListener("click", () => {
          console.log("IT WORKS DAMMIT 5"); // Display the message in the console
          alert("IT WORKS DAMMIT 5"); // Optionally display an alert on the page
      });
    
    // Add click event listener to the sixth cell
      sixthCell.addEventListener("click", () => {
          console.log("IT WORKS DAMMIT 6"); // Display the message in the console
          alert("IT WORKS DAMMIT 6"); // Optionally display an alert on the page
      });
    
    // Add click event listener to the seventh cell
      seventhCell.addEventListener("click", () => {
          console.log("IT WORKS DAMMIT 7"); // Display the message in the console
          alert("IT WORKS DAMMIT 7"); // Optionally display an alert on the page
      });
    
    // Add click event listener to the eighth cell
      eighthCell.addEventListener("click", () => {
          console.log("IT WORKS DAMMIT 8"); // Display the message in the console
          alert("IT WORKS DAMMIT 8"); // Optionally display an alert on the page
      });
    
    // Add click event listener to the ninth cell
      ninthCell.addEventListener("click", () => {
          console.log("IT WORKS DAMMIT 9"); // Display the message in the console
          alert("IT WORKS DAMMIT 9"); // Optionally display an alert on the page
      });
  });
   
  //Trying to make the Api button work again
    
  const apiKeyButton = document.getElementById('api-key-btn');
  const apiKeyPopup = document.getElementById('api-key-popup');
  const apiKeyInput = document.getElementById('api-key-input');
  const saveApiKeyButton = document.getElementById('save-api-key-btn');
  
  const HUGGING_FACE_API_URL = "https://api-inference.huggingface.co/models/facebook/detr-resnet-50";
  let HUGGING_FACE_API_TOKEN = null;
  
  // Popup Handlers
  function showApiKeyPopup() {
      const storedApiKey = localStorage.getItem('huggingFaceApiKey');
      if (storedApiKey) {
          apiKeyInput.value = storedApiKey;
      } else {
          apiKeyInput.value = '';
      }
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
  
  // Load API Key on Startup
  document.addEventListener('DOMContentLoaded', () => {
      const storedApiKey = localStorage.getItem('huggingFaceApiKey');
      if (storedApiKey) {
          HUGGING_FACE_API_TOKEN = storedApiKey;
      }
      initializeCamera();
  });
  
  // Event Listeners
  apiKeyButton.addEventListener('click', showApiKeyPopup);
  saveApiKeyButton.addEventListener('click', saveApiKey);
