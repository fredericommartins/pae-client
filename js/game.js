const factionsData = {
  gaia: {
    name: "Gaia",
    description: "Post-growth liquid anarchist collective",
    extra: "Gaia focuses on ecological balance, community governance, and sustainable living beyond endless growth models."
  },
  anarcap: {
    name: "Anarcap",
    description: "Liquid anarcho-capitalist frontier society",
    extra: "Anarcap champions voluntary exchange, private property rights, and decentralized markets without traditional governments."
  },
  nullstate: {
    name: "Nullstate",
    description: "Crypto-anarchist decentralized enclave",
    extra: "Nullstate leverages cryptographic privacy, decentralized protocols, and anonymity to build a stateless digital frontier."
  }
};

// Opt for development or production API
const apiBase = (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname === ''
)
  ? 'http://localhost:8000'  // Local backend
  : 'https://api.poliaether.com';  // Production backend

// add here production URl in case local connection is not available
const nationalitySelect = document.getElementById('nationalitySelect');
const genderSelect = document.getElementById('genderSelect');
const factionCards = document.querySelectorAll('.faction-card');

// Visual functions
function showOfflinePage() {
  document.querySelector("main").style.display = "none";
  document.getElementById("offline-section").style.display = "block";
}

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

function hideLoader() {
  document.getElementById("loader").style.display = "none";
}

function hideFactionSelect() {
  document.getElementById("faction-select").style.display = "none";
}

function showFactionSelect() {
  document.getElementById("faction-select").style.display = "block";
}

function showPlayerInfo() {
  document.getElementById("player-info").style.display = "block";
}

function showGameMap() {
  document.getElementById("game-map").style.display = "block";
}

function showMain() {
  document.getElementById("main").style.display = "block";
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
  const repSymbolContainer = document.getElementById('reputation-symbols');
  repSymbolContainer.innerHTML = '<h3>Faction Reputation</h3>';

  Object.entries(player.reputation).forEach(([factionName, rep]) => {
    const item = document.createElement('div');
    item.style.margin = '0.3rem 0';
    item.innerHTML = `<strong>${factionName}:</strong> ${rep.symbol} (${rep.value})`;
    repSymbolContainer.appendChild(item);
  });
  document.getElementById('player-name').textContent = player.id;
  document.getElementById('player-faction').textContent = player.faction;
  hideFactionSelect();
  showPlayerInfo();
  showGameMap();
}

// Logical local functions
function isPlayerCreated(user) {
  if (!user.player) {
    showFactionSelect();
  } else {
    populatePlayer(user.player);
  }
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
    isPlayerCreated(data.user);
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
      const player = data.player;
      populatePlayer(player);
    } catch (err) {
      console.error(err);
      alert("Failed to contact server.");
    }
}

// Optionally, validate with backend
async function validateToken() {
  const token = localStorage.getItem('token');
  const res = await fetch(`${apiBase}/me`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  if (!res.ok) {
    showAuthBox();
  } else {
    const data = await res.json();
    hideAuthBox();
    isPlayerCreated(data);
  }
}

async function initApp() {
  // API status availability
  const online = await checkServerStatus();
  if (!online) {
    return
  }

  // Dummy map rendering
  const mapElement = document.getElementById("map");
  for (let i = 0; i < 100; i++) {
  const tile = document.createElement("div");
  tile.className = "tile";
  mapElement.appendChild(tile);
  }

  // Faction select
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
        createPlayer(card.getAttribute('data-faction'));
      } else {
        return;
      }

    });
  });

  validateToken();
  hideLoader();
  showMain();
}

window.addEventListener("DOMContentLoaded", () => {
  initApp();
});
