/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const generateRoutineBtn = document.getElementById("generateRoutine");

// Array to store the chat history for context
let chatHistory = [];

/* Show initial placeholder until user selects a category */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

/* Load product data from JSON file */
async function loadProducts() {
  const response = await fetch("products.json");
  const data = await response.json();
  return data.products;
}

// Array to keep track of selected products
let selectedProducts = [];

// Try to load selected products from localStorage on page load
function loadSelectedProductsFromStorage() {
  const saved = localStorage.getItem("selectedProducts");
  if (saved) {
    try {
      selectedProducts = JSON.parse(saved);
    } catch (e) {
      selectedProducts = [];
    }
  }
}

// Save selected products to localStorage
function saveSelectedProductsToStorage() {
  localStorage.setItem("selectedProducts", JSON.stringify(selectedProducts));
}

// Function to update the Selected Products section
function updateSelectedProductsList() {
  const selectedProductsList = document.getElementById("selectedProductsList");
  // Add a clear all button if there are any selected products
  if (selectedProducts.length === 0) {
    selectedProductsList.innerHTML = `<div class="placeholder-message">No products selected</div>`;
    // Remove clear all button if present
    const clearBtn = document.getElementById("clearAllSelectedBtn");
    if (clearBtn) clearBtn.remove();
    saveSelectedProductsToStorage();
    return;
  }
  // Show each selected product with a remove button
  selectedProductsList.innerHTML = selectedProducts
    .map(
      (product) => `
        <div class="selected-product-item" data-id="${product.id}">
          <img src="${product.image}" alt="${product.name}" title="${product.name}">
          <span>${product.name}</span>
          <button class="remove-selected-btn" title="Remove">&times;</button>
        </div>
      `
    )
    .join("");

  // Add or show the clear all button
  let clearBtn = document.getElementById("clearAllSelectedBtn");
  if (!clearBtn) {
    clearBtn = document.createElement("button");
    clearBtn.id = "clearAllSelectedBtn";
    clearBtn.textContent = "Clear All";
    clearBtn.className = "clear-all-btn";
    clearBtn.type = "button";
    selectedProductsList.parentElement.insertBefore(
      clearBtn,
      selectedProductsList.nextSibling
    );
  }
  clearBtn.style.display = "inline-block";
  clearBtn.onclick = function () {
    selectedProducts = [];
    // Unselect all cards in grid
    document
      .querySelectorAll(".product-card.selected")
      .forEach((card) => card.classList.remove("selected"));
    updateSelectedProductsList();
  };

  // Add event listeners to remove buttons
  const removeBtns = document.querySelectorAll(".remove-selected-btn");
  removeBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const parent = e.target.closest(".selected-product-item");
      const id = Number(parent.getAttribute("data-id"));
      selectedProducts = selectedProducts.filter((p) => p.id !== id);
      // Also unselect in grid
      const card = document.querySelector(`.product-card[data-id='${id}']`);
      if (card) card.classList.remove("selected");
      updateSelectedProductsList();
    });
  });
  saveSelectedProductsToStorage();
}

/* Create HTML for displaying product cards, with selection and hover overlay */
function displayProducts(products) {
  productsContainer.innerHTML = products
    .map(
      (product) => `
    <div class="product-card${
      selectedProducts.some((p) => p.id === product.id) ? " selected" : ""
    }" data-id="${product.id}">
      <img src="${product.image}" alt="${product.name}">
      <div class="product-info">
        <h3>${product.name}</h3>
        <p>${product.brand}</p>
      </div>
      <div class="product-overlay">
        <p>${product.description}</p>
      </div>
    </div>
  `
    )
    .join("");

  // Add click event to each product card for select/unselect
  const cards = document.querySelectorAll(".product-card");
  cards.forEach((card) => {
    card.addEventListener("click", () => {
      const id = Number(card.getAttribute("data-id"));
      const product = products.find((p) => p.id === id);
      const isSelected = selectedProducts.some((p) => p.id === id);
      if (isSelected) {
        // Unselect
        selectedProducts = selectedProducts.filter((p) => p.id !== id);
        card.classList.remove("selected");
      } else {
        // Select
        selectedProducts.push(product);
        card.classList.add("selected");
      }
      updateSelectedProductsList();
      saveSelectedProductsToStorage();
    });
    // Prevent click on remove button in selected list from toggling card
    card
      .querySelector(".product-overlay")
      .addEventListener("click", (e) => e.stopPropagation());
  });
}

// Store all products for filtering
let allProducts = [];
const productSearch = document.getElementById("productSearch");

// Filter and display products by category and search
async function filterAndDisplayProducts() {
  if (allProducts.length === 0) {
    allProducts = await loadProducts();
  }
  const selectedCategory = categoryFilter.value;
  const searchTerm = productSearch.value.trim().toLowerCase();

  let filtered = allProducts;
  if (selectedCategory) {
    filtered = filtered.filter(
      (product) => product.category === selectedCategory
    );
  }
  if (searchTerm) {
    filtered = filtered.filter(
      (product) =>
        product.name.toLowerCase().includes(searchTerm) ||
        product.brand.toLowerCase().includes(searchTerm) ||
        (product.description &&
          product.description.toLowerCase().includes(searchTerm))
    );
  }
  displayProducts(filtered);
  updateSelectedProductsList();
}

// Update products when category changes
categoryFilter.addEventListener("change", filterAndDisplayProducts);
// Update products when search input changes
productSearch.addEventListener("input", filterAndDisplayProducts);

// On page load, load all products for search to work
loadProducts().then((products) => {
  allProducts = products;
});

// Helper function to add a message to the chat window
function addMessageToChat(role, text) {
  // role: "user" or "assistant"
  const messageDiv = document.createElement("div");
  messageDiv.className = `chat-message ${role}`;
  messageDiv.textContent = text;
  chatWindow.appendChild(messageDiv);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

// Function to call OpenAI API with chat history
async function getOpenAIResponse(messages) {
  // Call our Cloudflare Worker (which securely forwards to OpenAI API)
  const WORKER_URL = "https://gentle-tooth-092d.evanrsc.workers.dev/";

  const response = await fetch(WORKER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: messages,
      max_tokens: 500,
      temperature: 0.7,
    }),
  });
  const data = await response.json();
  return data.choices && data.choices[0] && data.choices[0].message.content
    ? data.choices[0].message.content
    : "Sorry, I couldn't generate a response.";
}

// Handle Generate Routine button click
generateRoutineBtn.addEventListener("click", async () => {
  if (selectedProducts.length === 0) {
    addMessageToChat(
      "assistant",
      "Please select at least one product to generate a routine."
    );
    return;
  }
  // Prepare product info for the AI
  const productInfo = selectedProducts.map((p) => ({
    name: p.name,
    brand: p.brand,
    category: p.category,
    description: p.description,
  }));

  // Add user message to chat history
  const userMsg = `Here are my selected products: ${productInfo
    .map((p) => `${p.name} (${p.brand}) - ${p.category}`)
    .join(
      ", "
    )}. Please build a step-by-step routine using these products. Explain each step simply.`;
  chatHistory.push({ role: "user", content: userMsg });
  addMessageToChat("user", userMsg);

  // Add a system prompt to keep the AI focused on beauty topics
  if (!chatHistory.some((m) => m.role === "system")) {
    chatHistory.unshift({
      role: "system",
      content:
        "You are a helpful beauty advisor. Only answer questions about the generated routine, skincare, haircare, makeup, fragrance, or related beauty topics. If asked about something else, politely say you can only help with beauty routines and products.",
    });
  }

  // Show loading message
  addMessageToChat("assistant", "Generating your routine...");

  // Get AI response
  const aiResponse = await getOpenAIResponse(chatHistory);

  // Remove loading message and show AI response
  const loadingMsg = chatWindow.querySelector(
    ".chat-message.assistant:last-child"
  );
  if (loadingMsg && loadingMsg.textContent === "Generating your routine...") {
    loadingMsg.remove();
  }
  addMessageToChat("assistant", aiResponse);

  // Add AI response to chat history
  chatHistory.push({ role: "assistant", content: aiResponse });

  // Save selected products after routine generation (in case user added/removed before clicking)
  saveSelectedProductsToStorage();
});

// Handle chat form submission for follow-up questions
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const userInput = document.getElementById("userInput").value.trim();
  if (!userInput) return;
  addMessageToChat("user", userInput);
  chatHistory.push({ role: "user", content: userInput });

  // Show loading message
  addMessageToChat("assistant", "Thinking...");

  // Get AI response
  const aiResponse = await getOpenAIResponse(chatHistory);

  // Remove loading message and show AI response
  const loadingMsg = chatWindow.querySelector(
    ".chat-message.assistant:last-child"
  );
  if (loadingMsg && loadingMsg.textContent === "Thinking...") {
    loadingMsg.remove();
  }
  addMessageToChat("assistant", aiResponse);
  chatHistory.push({ role: "assistant", content: aiResponse });

  // Save selected products in case user changed them during chat
  saveSelectedProductsToStorage();

  // Clear input
  document.getElementById("userInput").value = "";
});
// On page load, restore selected products and update UI
window.addEventListener("DOMContentLoaded", () => {
  loadSelectedProductsFromStorage();
  updateSelectedProductsList();
});
