import { initGlobe, focusOnFaction, resizeCanvas } from './globe.js';

// Opt for development or production API
window.apiBase = (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname === ''
)
  ? 'http://localhost:8000'  // Local backend
  : 'https://api.poliaether.com';  // Production backend

// add here production URl in case local connection is not available
const nationalitySelect = document.getElementById('nationalitySelect');
const genderSelect = document.getElementById('genderSelect');

// Visual functions
function showOfflinePage() {
  document.querySelector("main").classList.add("hidden");
  document.body.style.background = "radial-gradient(circle at center, #1f1f1f, #0e0e0e)";
  document.querySelector('footer').style.background = 'none';
  document.getElementById("offline-section").classList.remove("hidden");
}

function showWalletWarning() {
  document.querySelector("main").classList.add("hidden");
  document.body.style.background = "radial-gradient(circle at center, #1f1f1f, #0e0e0e)";
  document.querySelector('footer').style.background = 'none';
  document.getElementById("wallet-warning-section").classList.remove("hidden");
  hideLoader();
}

function showSigning() {
  document.getElementById("login_message").classList.remove("hidden");
}

function hideLoader() {
  document.getElementById("loader").classList.add("hidden");
}

function hideFactionSelect() {
  document.getElementById("faction-select").classList.add("hidden");
}

function showFactionSelect() {
  showMain();
  hideLoader();
  return new Promise((resolve) => {
    const container = document.getElementById("faction-select");
    container.classList.remove("hidden");
    document.querySelectorAll(".faction-card").forEach((card) => {
      card.addEventListener("click", () => {
        const selectedFaction = card.getAttribute("data-faction");
        container.classList.add("hidden");
        resolve(selectedFaction);
      }, { once: true }); // Make sure it only triggers once
    });
  });
}

function waitForFactionSelection() {
  return new Promise((resolve) => {
    const factionCards = document.querySelectorAll('.faction-card');
    factionCards.forEach(card => card.classList.add('enabled'));
    factionCards.forEach(card => {
      card.addEventListener('click', async () => {
        if (!card.classList.contains('enabled')) return;
        const confirmed = await confirmDialog({
          title: "Are you sure?",
          text: "Changing factions later is no easy feat",
          confirmButtonText: "Join",
          cancelButtonText: "Choose another"
        });
        if (confirmed) {
          document.getElementById('faction-select').classList.add('hidden');
          const player = await createPlayer(card.getAttribute('data-faction'));
          resolve(player);
        }
      });
    });
  });
}

function showPlayerInfo() {
  document.getElementById("player-info").style.display = "block";
}

function showGameMap() {
  let elem = document.getElementById("game-map")
  elem.style.display = "block";
}

function showMain() {
  document.getElementById("main").classList.remove("hidden");
}

function openModal(section) {
  const modal = document.getElementById('marketModal');
  const title = document.getElementById('modalTitle');
  const content = document.getElementById('modalContent');
  
  title.textContent = section;
  content.textContent = `Details and options for the ${section.toLowerCase()} section will go here.`;
  modal.classList.remove('hidden');
}

function closeModal() {
  document.getElementById('marketModal').classList.add('hidden');
}

function closeLandTileModal() {
  document.getElementById('landTileModal').classList.add('hidden');
}

function applyReputationColor(el, value) {
  if (!el) return;
  // Remove previous rep classes
  el.classList.remove(
    'rep-burning-red',
    'rep-red',
    'rep-neutral',
    'rep-blue',
    'rep-green',
    'rep-electric-green'
  );
  // Apply appropriate class
  if (value <= -100) {
    el.classList.add('rep-burning-red');
  } else if (value < -30) {
    el.classList.add('rep-red');
  } else if (value < 10) {
    el.classList.add('rep-neutral');
  } else if (value < 30) {
    el.classList.add('rep-blue');
  } else if (value < 100) {
    el.classList.add('rep-green');
  } else {
    el.classList.add('rep-electric-green');
  }
}

async function confirmDialog(options = {}) {
  const {
    title = "Are you sure?",
    text = "This action cannot be undone.",
    confirmButtonText = "Yes, continue",
    cancelButtonText = "Cancel"
  } = options;

  const result = await Swal.fire({
    title,
    text,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText,
    cancelButtonText,
    background: 'radial-gradient(circle at top left, #1e293b, #0f172a)',
    color: "#cbd5e1",
    confirmButtonColor: "#5eead4",
    cancelButtonColor: "#f87171",
    customClass: {
      popup: 'swal-radial-popup',
      title: 'swal-radial-title',
      htmlContainer: 'swal-radial-text',
      confirmButton: 'swal-radial-confirm',
      cancelButton: 'swal-radial-cancel'
    }
  });

  return result.isConfirmed;
}

function populatePlayer(player) {
  Object.entries(player.reputation).forEach(([factionName, rep]) => {
    const repSymbolContainer = document.getElementById(`${factionName.toLowerCase()}-reputation`);
    repSymbolContainer.innerHTML = new Intl.NumberFormat("en-US", {
        signDisplay: "exceptZero"
    }).format(rep.value); // Displays the positive and negative before the numbers
    applyReputationColor(repSymbolContainer, rep.value);
    //repSymbolContainer.classList.add(rep.class);
  });
  document.getElementById('player-name').textContent = player.name;
  document.getElementById(`${player.faction.toLowerCase()}-selection`).classList.add('selected')
  hideFactionSelect();
  showPlayerInfo();
  showGameMap();
}

// Legacy visual functions
function switchToRegister() {
  fetchNationalities();
  fetchGenders();
  document.getElementById("auth-title").textContent = "Register";
  document.getElementById("extra-fields").style.display = "block";
  document.getElementById("login-btn").style.display = "none";
  document.getElementById("register-btn").style.display = "inline-block";
  document.getElementById("switch-to-register-btn").style.display = "none";
}

function showAuthBox() {
  document.getElementById('auth-section').style.display = 'flex';
  document.getElementById("auth-section").classList.remove("hidden");
}

function hideAuthBox() {
  document.getElementById('auth-status').innerText = '';
  document.getElementById("auth-section").classList.add("hidden");
}

// Logical local functions
async function isPlayerCreated(user) {
  if (!user.player) {
    showFactionSelect();
    const newPlayer = await waitForFactionSelection();
    populatePlayer(newPlayer);
  } else {
    populatePlayer(user.player);
  }
}


function addPolicy({name, description, value = null, icon = "shield", category = "civic", genesis = null}) {
  genesis = Array.isArray(genesis) ? genesis : [];
  const isLocked = genesis.includes(window.user.player.faction);
  const policyList = document.getElementById("policies-container");
  const categoryColors = {
    military: "text-red-300",
    economic: "text-yellow-300",
    civic: "text-green-300",
    governance: "text-blue-300",
    social: "text-pink-300",
    environmental: "text-emerald-300",
  };
  const iconColor = categoryColors[category] || "text-gray-300";
  const details = document.createElement("details");
  details.id = name;
  details.className = "group w-full mt-4 rounded-lg bg-gray-800 border border-gray-700";
  details.innerHTML = `
    <summary class="flex items-center justify-between text-sm text-gray-300 px-4 py-2 cursor-pointer select-none">
      <div class="flex items-center gap-2">
        <i data-lucide="${icon}" class="w-4 h-4 ${iconColor}"></i>
        <span class="font-medium">${name}</span>
        ${isLocked ? '<i data-lucide="lock" class="w-4 h-4 text-gray-500 ml-1"></i>' : ''}
      </div>
      <i data-lucide="chevron-down" class="w-4 h-4 transition-transform duration-500 ease-in-out group-open:rotate-180"></i>
    </summary>
    <div class="text-gray-300 text-xs px-4 py-3 rounded-b-lg border-t border-gray-700">
      <div class="text-white text-sm mb-2">${description}</div>
      ${value ? `<div class="text-yellow-400 font-semibold">${value}</div>` : ""}
    </div>
  `;
  policyList.appendChild(details);
  lucide.createIcons(); // re-render icons
}

// Logical remote functions
async function checkServerStatus() {
  try {
    const res = await fetch(`${apiBase}/health`, { cache: "no-store" });
    if (!res.ok) throw new Error("API not OK");
    const data = await res.json();
    if (data.status !== "ok") throw new Error("API status not OK");
    return true;
  } catch (e) {
    console.error("API offline:", e);
    showOfflinePage();
    hideLoader();
    return false;
  }
}

async function registerUser() {
  const username = document.getElementById('auth-username').value;
  const password = document.getElementById('auth-password').value;
  const origin = document.getElementById('nationalitySelect').value;
  const type = document.getElementById('genderSelect').value;

  const res = await fetch(`${apiBase}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, origin, type })
  })

  const data = await res.json();
  document.getElementById('auth-status').innerText = data.message || JSON.stringify(data);
  loginUser();
}

async function loginUser() {
  const username = document.getElementById('auth-username').value;
  const password = document.getElementById('auth-password').value;

  const res = await fetch(`${apiBase}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });

  if (res.ok) {
    const data = await res.json();
    localStorage.setItem('token', data.access_token);
    hideAuthBox();
    isPlayerCreated(data);
  } else {
    const err = await res.json();
    document.getElementById('auth-status').innerText = err.detail || "Login failed";
  }
}

async function logoutUser() {
  const token = localStorage.getItem('token');
  if (!token) {
    alert("You're not logged in.");
    return;
  }

  try {
    const res = await fetch(`${apiBase}/auth/logout`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!res.ok) {
      const err = await res.json();
      alert("Logout failed: " + (err.detail || res.statusText));
      return;
    }

    // Clear token and redirect or refresh page
    localStorage.removeItem('token');
    alert("Logged out successfully.");
    window.location.href = '/';  // or wherever your login page is
  } catch (err) {
    console.error(err);
    alert("Logout request failed.");
  }
}

async function fetchNationalities() {
  const res = await fetch(`${apiBase}/nationalities`);
  const nationalities = await res.json();
  nationalitySelect.innerHTML = '<option value="">Select Origin</option>';
  nationalities.forEach(n => {
    const opt = document.createElement('option');
    opt.value = n;
    opt.textContent = n.name;
    nationalitySelect.appendChild(opt);
  });
}

async function fetchGenders() {
  const res = await fetch(`${apiBase}/genders`);
  const genders = await res.json();
  genderSelect.innerHTML = '<option value="">Select Type</option>';
  genders.forEach(g => {
    const opt = document.createElement('option');
    opt.value = g;
    opt.textContent = g;
    genderSelect.appendChild(opt);
  });
}

async function fetchPolicies() {
  const token = localStorage.getItem('token');
  try {
    const response = await fetch(`${apiBase}/policies`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const data = await response.json();
    // Loop through the policy name keys
    Object.entries(data).forEach(([name, config]) => {
      const description = config.description;
      const value = config.value || null;
      const icon = config.icon;
      const category = config.category;
      const genesis = config.genesis || false;
      addPolicy({name, description, value, icon, category, genesis});
    });
  } catch (error) {
    console.error("Failed to fetch region policies:", error);
  }
}

async function createPlayer(faction) {    
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiBase}/player/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`},
        body: JSON.stringify({ faction })
      });

      if (!res.ok) {
        const err = await res.json();
        alert("Error: " + err.detail);
        return;
      }

      const data = await res.json();
      window.user.player = data.player;
      return data.player;
    } catch (err) {
      console.error(err);
      alert("Failed to contact server.");
    }
}

// Logical bitcoin functions
async function connectWallet() {
  if (!window.unisat) {
    showWalletWarning();
    return;
  }
  const accounts = await window.unisat.requestAccounts();
  const address = accounts[0];
  showSigning();
  return address;
}

async function loginWithBitcoin() {
  const address = await connectWallet();
  if (!address) return;
  // Fetch nonce from backend
  const res = await fetch(`${apiBase}/auth/nonce/${address}`);
  if (!res.ok) {
    const err = await res.json();
    document.getElementById("login_message").innerHTML = res.statusText || "Failed to get signing message";
    return;

  }
  const message = await res.json();
  let signature
  try {
    signature = await window.unisat.signMessage(message);
  } catch (err) {
    const reply = "Please refresh and try again";
    if (err.code === 4001) {
      document.getElementById("login_message").innerHTML = `Signature request rejected<br>${reply}`;
    } else {
      document.getElementById("login_message").innerHTML = `Unexpected error during signing: ${err}<br>${reply}`;
    }
    return;
  }
  document.getElementById("login_message").innerHTML = `Message signed successfully`;
  // Send signed login request
  const loginRes = await fetch(`${apiBase}/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, signature })
  });
  if (loginRes.ok) {
    const data = await loginRes.json();
    localStorage.setItem('token', data.access_token);
    return data;
  } else {
    const err = await loginRes.json();
    document.getElementById("login_message").innerHTML = err.detail || "Login failed";
  }
}

async function validateToken() {
  const token = localStorage.getItem('token');
  const res = await fetch(`${apiBase}/me`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  let data;
  if (!res.ok) {
    //showAuthBox();
    data = await loginWithBitcoin();
  } else {
    data = await res.json();
  }
  return data;
}

async function initApp() {
  // API status availability
  const online = await checkServerStatus();
  if (!online) {
    return;
  }

  // Get game configuration
  fetch(`${window.apiBase}/config`)
    .then(res => res.json())
    .then(config => {
      window.factions = config.factions;
    });

  // Open modal on marketplace button click
  document.querySelectorAll(".grid button").forEach(button => {
    button.addEventListener("click", () => {
      const section = button.innerText.trim();
      openModal(section);
    });
  });

  // Click outside modal box closes it
  document.getElementById('marketModal').addEventListener('click', (e) => {
    const box = document.getElementById('modalTitle');
    if (!box.contains(e.target)) {
      closeModal();
    }
  });
  document.getElementById('landTileModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('landTileModal')) {
      closeLandTileModal();
    }
  });

  // Scroll once to center globe
  let scrolledOnce = false;
  let scrollTimeout;
  window.addEventListener("scroll", () => {
    if (!scrolledOnce) {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const canvas = document.getElementById("game-map");
        if (canvas) {
          canvas.scrollIntoView({
            behavior: "smooth",
            block: "center"
          });
          scrolledOnce = true;
        }
      }, 100); // delay in ms
    }
  });

  //triggers();
  window.user = await validateToken();
  lucide.createIcons();
  window.addEventListener('resize', resizeCanvas);
  if (window.user) {
    await isPlayerCreated(window.user);
    let world = await initGlobe();
    await fetchPolicies();
    showMain();
    resizeCanvas();
    hideLoader();
  }
}

window.addEventListener("DOMContentLoaded", () => {
  initApp();
});
