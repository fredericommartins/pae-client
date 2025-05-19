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

const apiBase = 'http://localhost:8000'; // Adjust as needed

async function register() {
const username = document.getElementById('auth-username').value;
const password = document.getElementById('auth-password').value;

const res = await fetch(`${apiBase}/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username, password })
});

const data = await res.json();
document.getElementById('auth-status').innerText = data.message || JSON.stringify(data);
}

async function login() {
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
  document.getElementById('auth-section').style.display = 'none';
  document.getElementById('auth-status').innerText = '';
} else {
  const err = await res.json();
  document.getElementById('auth-status').innerText = err.detail || "Login failed";
}
}

function checkAuthSession() {
const token = localStorage.getItem('token');
if (token) {
  // Optionally validate token with backend
  document.getElementById('auth-section').style.display = 'none';
} else {
  document.getElementById('auth-section').style.display = 'flex';
}
}

window.addEventListener('DOMContentLoaded', checkAuthSession);

async function logout() {
const token = localStorage.getItem('access_token');
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
  localStorage.removeItem('access_token');
  alert("Logged out successfully.");
  window.location.href = '/';  // or wherever your login page is

} catch (err) {
  console.error(err);
  alert("Logout request failed.");
}
}


const nationalitySelect = document.getElementById('nationalitySelect');
const genderSelect = document.getElementById('genderSelect');
const factionCards = document.querySelectorAll('.faction-card');

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

function checkInputs() {
const nat = nationalitySelect.value;
const gen = genderSelect.value;
if (nat && gen) {
  factionCards.forEach(card => card.classList.add('enabled'));
} else {
  factionCards.forEach(card => card.classList.remove('enabled'));
}
}

nationalitySelect.addEventListener('change', checkInputs);
genderSelect.addEventListener('change', checkInputs);

factionCards.forEach(card => {
card.addEventListener('click', async () => {
  if (!card.classList.contains('enabled')) return;

  const faction = card.getAttribute('data-faction');
  const nationality = nationalitySelect.value;
  const gender = genderSelect.value;

  try {
    const res = await fetch(`${apiBase}/player/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nationality, gender, faction })
    });

    if (!res.ok) {
      const err = await res.json();
      alert("Error: " + err.detail);
      return;
    }

    const data = await res.json();
    const player = data.player;

    // Replace bar rendering with symbolic figures
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
  } catch (err) {
    console.error(err);
    alert("Failed to contact server.");
  }
});
});

// Initialize
fetchNationalities();
fetchGenders();

// Dummy map rendering
const mapElement = document.getElementById("map");
for (let i = 0; i < 100; i++) {
const tile = document.createElement("div");
tile.className = "tile";
mapElement.appendChild(tile);
}