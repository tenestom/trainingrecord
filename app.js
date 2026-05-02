// app.js
const SUPABASE_URL = 'https://gzqbseefmyvytiewsjup.supabase.co';

// WARNING: Do NOT use the service_role (secret) key in the frontend!
// The anon key is required for client-side applications to safely utilize 
// RLS (Row Level Security). The anon key is safe to be public because RLS 
// protects your data.
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY_HERE';

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

let currentUser = null;

// Initialization
async function init() {
  if (SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY_HERE') {
    alert("Please replace YOUR_SUPABASE_ANON_KEY_HERE in app.js with your actual Supabase anon key to test the app.");
  }

  const { data: { session } } = await supabase.auth.getSession();
  updateAuthState(session);

  supabase.auth.onAuthStateChange((_event, session) => {
    updateAuthState(session);
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
  
  const { error } = await supabase.auth.signInWithPassword({
    email: emailInput.value,
    password: passwordInput.value
  });
  
  if (error) showError(error.message);
  else authError.classList.add('hidden');
});

signupBtn.addEventListener('click', async (e) => {
  e.preventDefault();
  if(!authForm.checkValidity()) return authForm.reportValidity();
  
  const { error } = await supabase.auth.signUp({
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
  await supabase.auth.signOut();
});

function showError(msg) {
  authError.textContent = msg;
  authError.classList.remove('hidden', 'text-green-500');
  authError.classList.add('text-red-500');
}

// Dashboard Handlers
async function loadSessions() {
  sessionsList.innerHTML = '<p class="text-gray-500 text-center mt-10" id="sessions-loading">Loading sessions...</p>';
  
  const { data, error } = await supabase
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
        <span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-medium">${session.sets.length} sets</span>
      </div>
      <p class="text-sm text-gray-600 mb-1">📍 ${session.lake}</p>
      <p class="text-xs text-gray-500">⭐ Avg Satisfaction: ${avgSat}</p>
      ${session.notes ? `<p class="text-sm text-gray-700 mt-2 italic">"${session.notes}"</p>` : ''}
    `;
    sessionsList.appendChild(div);
  });
}

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

addSetBtn.addEventListener('click', addSet);

function addSet() {
  const node = setTemplate.content.cloneNode(true);
  const setItem = node.querySelector('.set-item');
  
  node.querySelector('.remove-set-btn').addEventListener('click', () => {
    setItem.remove();
  });
  
  setsContainer.appendChild(node);
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
    setsData.push({
      discipline: el.querySelector('.set-discipline').value,
      satisfaction: parseInt(el.querySelector('.set-satisfaction').value, 10),
      notes: el.querySelector('.set-notes').value
    });
  });

  // 1. Insert Session
  const { data: sessionData, error: sessionError } = await supabase
    .from('sessions')
    .insert([{ date, lake, notes, user_id: currentUser.id }])
    .select()
    .single();

  if (sessionError) {
    // If user_id is required and not defaulting, we might need to include it
    // Wait, the schema I provided does not default user_id. Let's fix that in schema or include it here.
    alert('Error saving session: ' + sessionError.message);
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Session';
    saveBtn.classList.remove('opacity-75');
    return;
  }

  // 2. Insert Sets if any
  if (setsData.length > 0) {
    const setsToInsert = setsData.map(s => ({ ...s, session_id: sessionData.id }));
    const { error: setsError } = await supabase
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
