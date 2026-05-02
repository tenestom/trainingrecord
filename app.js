// app.js
const SUPABASE_URL = 'https://gzqbseefmyvytiewsjup.supabase.co';

// WARNING: Do NOT use the Secret key (sb_secret_...) in the frontend!
// The Publishable key (sb_publishable_...) is required for client-side applications 
// to safely utilize RLS (Row Level Security). The Publishable key is safe to be 
// public because RLS protects your data.
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_aviePZLzSniwS7lEOBSvZQ_DcATZJmc';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

// DOM Elements
const authView = document.getElementById('auth-view');
const dashboardView = document.getElementById('dashboard-view');
const sessionFormView = document.getElementById('session-form-view');
const logoutBtn = document.getElementById('logout-btn');

const authForm = document.getElementById('auth-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const authError = document.getElementById('auth-error');
const loginBtn = document.getElementById('login-btn');
const signupBtn = document.getElementById('signup-btn');

const sessionsList = document.getElementById('sessions-list');
const newSessionBtn = document.getElementById('new-session-btn');
const backToDashboardBtn = document.getElementById('back-to-dashboard-btn');

const sessionForm = document.getElementById('session-form');
const setsContainer = document.getElementById('sets-container');
const addSetBtn = document.getElementById('add-set-btn');
const setTemplate = document.getElementById('set-template');
const slalomResultTemplate = document.getElementById('slalom-result-template');
const jumpResultTemplate = document.getElementById('jump-result-template');
const trickResultTemplate = document.getElementById('trick-result-template');

let currentUser = null;

// Initialization
async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  updateAuthState(session);

  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
      updateAuthState(session);
    }
  });
}

function updateAuthState(session) {
  if (session) {
    currentUser = session.user;
    showView(dashboardView);
    logoutBtn.classList.remove('hidden');
    loadSessions();
  } else {
    currentUser = null;
    showView(authView);
    logoutBtn.classList.add('hidden');
  }
}

function showView(view) {
  authView.classList.add('hidden');
  dashboardView.classList.add('hidden');
  sessionFormView.classList.add('hidden');
  view.classList.remove('hidden');
}

// Auth Handlers
loginBtn.addEventListener('click', async (e) => {
  e.preventDefault();
  if(!authForm.checkValidity()) return authForm.reportValidity();
  
  const { error } = await supabaseClient.auth.signInWithPassword({
    email: emailInput.value,
    password: passwordInput.value
  });
  
  if (error) showError(error.message);
  else authError.classList.add('hidden');
});

signupBtn.addEventListener('click', async (e) => {
  e.preventDefault();
  if(!authForm.checkValidity()) return authForm.reportValidity();
  
  const { error } = await supabaseClient.auth.signUp({
    email: emailInput.value,
    password: passwordInput.value
  });
  
  if (error) showError(error.message);
  else {
    showError("Signup successful! Please log in (or check email if confirmation is required).");
    authError.classList.remove('text-red-500');
    authError.classList.add('text-green-500');
  }
});

logoutBtn.addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
});

function showError(msg) {
  authError.textContent = msg;
  authError.classList.remove('hidden', 'text-green-500');
  authError.classList.add('text-red-500');
}

// Dashboard Handlers
async function loadSessions() {
  sessionsList.innerHTML = '<p class="text-gray-500 text-center mt-10" id="sessions-loading">Loading sessions...</p>';
  
  const { data, error } = await supabaseClient
    .from('sessions')
    .select('*, sets(*)')
    .order('date', { ascending: false });

  if (error) {
    sessionsList.innerHTML = `<p class="text-red-500 text-center mt-10">Error loading sessions: ${error.message}</p>`;
    return;
  }

  if (data.length === 0) {
    sessionsList.innerHTML = '<p class="text-gray-500 text-center mt-10">No sessions yet. Click + to add one!</p>';
    return;
  }

  // Populate Lake Suggestions
  const lakeCounts = {};
  data.forEach(session => {
    if (session.lake) {
      const normalizedLake = session.lake.trim();
      const key = normalizedLake.toLowerCase();
      if (!lakeCounts[key]) {
        lakeCounts[key] = { count: 0, display: normalizedLake };
      }
      lakeCounts[key].count++;
    }
  });

  const sortedLakes = Object.values(lakeCounts)
    .sort((a, b) => b.count - a.count)
    .map(lake => lake.display);

  const lakeSuggestions = document.getElementById('lake-suggestions');
  if (lakeSuggestions) {
    lakeSuggestions.innerHTML = sortedLakes.map(lake => `<option value="${lake}"></option>`).join('');
  }

  sessionsList.innerHTML = '';
  data.forEach(session => {
    const avgSat = session.sets.length > 0 
      ? (session.sets.reduce((sum, set) => sum + set.satisfaction, 0) / session.sets.length).toFixed(1)
      : 'N/A';

    const div = document.createElement('div');
    div.className = 'bg-white p-4 rounded-lg shadow border border-gray-100';
    div.innerHTML = `
      <div class="flex justify-between items-center mb-2">
        <h3 class="font-bold text-gray-800">${session.date}</h3>
        <button class="text-xs text-red-500 hover:text-red-700 delete-session-btn font-medium" data-id="${session.id}">Delete Session</button>
      </div>
      <p class="text-sm text-gray-600 mb-1">📍 ${session.lake}</p>
      <div class="flex justify-between items-center">
        <p class="text-xs text-gray-500">⭐ Avg Satisfaction: ${avgSat}</p>
        <span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-medium">${session.sets.length} sets</span>
      </div>
      ${session.notes ? `<p class="text-sm text-gray-700 mt-2 italic">"${session.notes}"</p>` : ''}
      
      <div class="mt-3 border-t border-gray-100 pt-2 space-y-2">
        ${session.sets.map(set => {
          let resultStr = '';
          if (set.result_data && set.discipline === 'Slalom') {
            resultStr = `<span class="ml-2 text-blue-600 font-medium">${set.result_data.buoys} @ ${set.result_data.line_length}m, ${set.result_data.speed}kph</span>`;
          } else if (set.result_data && set.discipline === 'Jump') {
            resultStr = `<span class="ml-2 text-green-600 font-medium">${set.result_data.distance_meters}m</span>`;
          } else if (set.result_data && set.discipline === 'Trick') {
            resultStr = `<span class="ml-2 text-purple-600 font-medium">${set.result_data.points} pts</span>`;
          }
          return `
          <div class="flex justify-between items-center bg-gray-50 p-2 rounded text-sm border border-gray-100">
            <div><span class="font-semibold text-gray-700">${set.discipline}</span> <span class="text-xs text-gray-500">(⭐ ${set.satisfaction})</span>${resultStr}</div>
            <button class="text-red-400 hover:text-red-600 delete-set-btn px-2" data-id="${set.id}">🗑️</button>
          </div>
        `}).join('')}
      </div>
    `;
    sessionsList.appendChild(div);
  });
}

sessionsList.addEventListener('click', async (e) => {
  const deleteSessionBtn = e.target.closest('.delete-session-btn');
  const deleteSetBtn = e.target.closest('.delete-set-btn');

  if (deleteSessionBtn) {
    if (confirm('Are you sure you want to delete this entire session and all its sets?')) {
      const sessionId = deleteSessionBtn.dataset.id;
      const { error } = await supabaseClient.from('sessions').delete().eq('id', sessionId);
      if (error) alert('Error deleting session: ' + error.message);
      else loadSessions(); // refresh list
    }
  }

  if (deleteSetBtn) {
    if (confirm('Delete this set?')) {
      const setId = deleteSetBtn.dataset.id;
      const { error } = await supabaseClient.from('sets').delete().eq('id', setId);
      if (error) alert('Error deleting set: ' + error.message);
      else loadSessions(); // refresh list
    }
  }
});

// Session Form Handlers
newSessionBtn.addEventListener('click', () => {
  document.getElementById('session-date').valueAsDate = new Date();
  document.getElementById('session-lake').value = '';
  document.getElementById('session-notes').value = '';
  setsContainer.innerHTML = '';
  addSet(); // add one empty set by default
  showView(sessionFormView);
});

backToDashboardBtn.addEventListener('click', () => {
  showView(dashboardView);
});

addSetBtn.addEventListener('click', () => addSet());

async function getLastSlalomResult() {
  const { data } = await supabaseClient
    .from('sessions')
    .select('sets(result_data, discipline)')
    .order('date', { ascending: false })
    .limit(10);

  if (data) {
    for (const session of data) {
      if (session.sets) {
        const slalomSet = session.sets.find(s => s.discipline === 'Slalom' && s.result_data);
        if (slalomSet) return slalomSet.result_data;
      }
    }
  }
  return null;
}

async function addSet() {
  const node = setTemplate.content.cloneNode(true);
  const setItem = node.querySelector('.set-item');
  const disciplineInput = node.querySelector('.set-discipline');
  const resultContainer = node.querySelector('.result-fields-container');
  
  node.querySelector('.remove-set-btn').addEventListener('click', () => {
    setItem.remove();
  });

  const renderResultFields = async (discipline) => {
    resultContainer.innerHTML = '';
    if (discipline === 'Slalom') {
      const slalomNode = slalomResultTemplate.content.cloneNode(true);
      resultContainer.appendChild(slalomNode);
      // Try to pre-fill
      const lastResult = await getLastSlalomResult();
      if (lastResult) {
        setItem.querySelector('.slalom-buoys').value = lastResult.buoys ?? '';
        setItem.querySelector('.slalom-length').value = lastResult.line_length ?? '';
        setItem.querySelector('.slalom-speed').value = lastResult.speed ?? '';
      }
    } else if (discipline === 'Jump') {
      const jumpNode = jumpResultTemplate.content.cloneNode(true);
      resultContainer.appendChild(jumpNode);
    } else if (discipline === 'Trick') {
      const trickNode = trickResultTemplate.content.cloneNode(true);
      resultContainer.appendChild(trickNode);
    }
  };

  // Initial render (defaults to Slalom in template)
  renderResultFields('Slalom');

  disciplineInput.addEventListener('input', (e) => {
    renderResultFields(e.target.value);
  });
  
  setsContainer.appendChild(setItem); // append the actual element, not the fragment
}

sessionForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const saveBtn = document.getElementById('save-session-btn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';
  saveBtn.classList.add('opacity-75');

  const date = document.getElementById('session-date').value;
  const lake = document.getElementById('session-lake').value;
  const notes = document.getElementById('session-notes').value;

  // Gather sets
  const setElements = setsContainer.querySelectorAll('.set-item');
  const setsData = [];
  
  setElements.forEach(el => {
    const discipline = el.querySelector('.set-discipline').value;
    let result_data = null;

    if (discipline === 'Slalom') {
      const buoys = parseFloat(el.querySelector('.slalom-buoys')?.value);
      const length = parseFloat(el.querySelector('.slalom-length')?.value);
      const speed = parseFloat(el.querySelector('.slalom-speed')?.value);
      if (!isNaN(buoys) && !isNaN(length) && !isNaN(speed)) {
        result_data = { buoys, line_length: length, speed };
      }
    } else if (discipline === 'Jump') {
      const distance = parseFloat(el.querySelector('.jump-distance')?.value);
      if (!isNaN(distance)) {
        result_data = { distance_meters: distance };
      }
    } else if (discipline === 'Trick') {
      const points = parseInt(el.querySelector('.trick-points')?.value, 10);
      if (!isNaN(points)) {
        result_data = { points };
      }
    }

    setsData.push({
      discipline: discipline,
      satisfaction: parseInt(el.querySelector('.set-satisfaction').value, 10),
      notes: el.querySelector('.set-notes').value,
      result_type: result_data ? discipline.toLowerCase() : null,
      result_data: result_data
    });
  });

  // 1. Insert Session
  const { data: sessionData, error: sessionError } = await supabaseClient
    .from('sessions')
    .insert([{ date, lake, notes, user_id: currentUser.id }])
    .select()
    .single();

  if (sessionError) {
    alert('Error saving session: ' + sessionError.message);
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Session';
    saveBtn.classList.remove('opacity-75');
    return;
  }

  // 2. Insert Sets if any
  if (setsData.length > 0) {
    const setsToInsert = setsData.map(s => ({ ...s, session_id: sessionData.id }));
    const { error: setsError } = await supabaseClient
      .from('sets')
      .insert(setsToInsert);

    if (setsError) {
      alert('Error saving sets: ' + setsError.message);
    }
  }

  saveBtn.disabled = false;
  saveBtn.textContent = 'Save Session';
  saveBtn.classList.remove('opacity-75');
  showView(dashboardView);
  loadSessions();
});

// Start app
init();
