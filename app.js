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
const quickLogBtn = document.getElementById('quick-log-btn');
const inlineSetTemplate = document.getElementById('inline-set-template');
const showSessionsTab = document.getElementById('show-sessions-tab');
const showStatsTab = document.getElementById('show-stats-tab');
const sessionsContainer = document.getElementById('sessions-container');
const statsContainer = document.getElementById('stats-container');
const statsContent = document.getElementById('stats-content');

let currentUser = null;
let mostFrequentLake = '';
let allSessions = [];

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
  
  signupBtn.disabled = true;
  signupBtn.textContent = 'Signing up...';

  const email = emailInput.value;
  const password = passwordInput.value;

  const { data, error } = await supabaseClient.auth.signUp({
    email: email,
    password: password
  });
  
  if (error) {
    showError(error.message);
    signupBtn.disabled = false;
    signupBtn.textContent = 'Sign Up';
  } else {
    showError("Account created successfully!");
    authError.classList.remove('text-red-500');
    authError.classList.add('text-green-500');
    
    // If no session was automatically created, sign them in manually
    if (!data.session) {
      showError("Account created! Logging you in...");
      const { error: loginError } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password
      });
      if (loginError) {
        showError("Account created, but auto-login failed. Please log in manually.");
        signupBtn.disabled = false;
        signupBtn.textContent = 'Sign Up';
      }
    }
  }
});

// Tab Switching
showSessionsTab?.addEventListener('click', () => {
  showSessionsTab.classList.add('text-blue-600', 'border-b-2', 'border-blue-600');
  showSessionsTab.classList.remove('text-gray-500');
  showStatsTab.classList.remove('text-blue-600', 'border-b-2', 'border-blue-600');
  showStatsTab.classList.add('text-gray-500');
  sessionsContainer.classList.remove('hidden');
  statsContainer.classList.add('hidden');
});

showStatsTab?.addEventListener('click', () => {
  showStatsTab.classList.add('text-blue-600', 'border-b-2', 'border-blue-600');
  showStatsTab.classList.remove('text-gray-500');
  showSessionsTab.classList.remove('text-blue-600', 'border-b-2', 'border-blue-600');
  showSessionsTab.classList.add('text-gray-500');
  sessionsContainer.classList.add('hidden');
  statsContainer.classList.remove('hidden');
  renderStats();
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
  const { data, error } = await supabaseClient
    .from('sessions')
    .select('*, sets(*)')
    .order('date', { ascending: false });

  if (error) {
    sessionsList.innerHTML = `<p class="text-red-500 text-center mt-10">Error loading sessions: ${error.message}</p>`;
    return;
  }

  allSessions = data;

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

  if (sortedLakes.length > 0) {
    mostFrequentLake = sortedLakes[0];
  }

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
        <div class="flex items-center space-x-2">
          <span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-medium">${session.sets.length} sets</span>
          <button class="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded hover:bg-gray-200 add-inline-set-btn" data-id="${session.id}">+ Add Set</button>
        </div>
      </div>
      ${session.notes ? `<p class="text-sm text-gray-700 mt-2 italic">"${session.notes}"</p>` : ''}
      
      <div class="mt-3 border-t border-gray-100 pt-2 space-y-2">
        ${session.sets.map(set => {
          let resultStr = '';
          if (set.result_data && set.discipline === 'Slalom') {
            const b = set.result_data.buoys ?? '?';
            const l = set.result_data.line_length ?? '?';
            const s = set.result_data.speed ?? '?';
            resultStr = `<span class="ml-2 text-blue-600 font-medium">${b} @ ${l}m, ${s}kph</span>`;
          } else if (set.result_data && set.discipline === 'Jump') {
            const d = set.result_data.distance_meters ?? '?';
            resultStr = `<span class="ml-2 text-green-600 font-medium">${d}m</span>`;
          } else if (set.result_data && set.discipline === 'Trick') {
            const p = set.result_data.points ?? '?';
            resultStr = `<span class="ml-2 text-purple-600 font-medium">${p} pts</span>`;
          }
          return `
          <div class="flex justify-between items-center bg-gray-50 p-2 rounded text-sm border border-gray-100 set-row" data-id="${set.id}">
            <div><span class="font-semibold text-gray-700">${set.discipline}</span> <span class="text-xs text-gray-500">(⭐ ${set.satisfaction})</span>${resultStr}</div>
            <div class="flex items-center space-x-1">
              <button class="text-blue-400 hover:text-blue-600 edit-set-btn px-1" data-id="${set.id}">✏️</button>
              <button class="text-red-400 hover:text-red-600 delete-set-btn px-1" data-id="${set.id}">🗑️</button>
            </div>
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

  const editSetBtn = e.target.closest('.edit-set-btn');
  const addInlineSetBtn = e.target.closest('.add-inline-set-btn');

  if (editSetBtn || addInlineSetBtn) {
    const isEdit = !!editSetBtn;
    const setId = isEdit ? editSetBtn.dataset.id : null;
    const sessionId = isEdit ? null : addInlineSetBtn.dataset.id;
    const targetElement = isEdit ? editSetBtn.closest('.set-row') : addInlineSetBtn.closest('.bg-white');

    let foundSet = null;
    if (isEdit) {
      for (const session of allSessions) {
        foundSet = session.sets.find(s => s.id === setId);
        if (foundSet) break;
      }
      if (!foundSet) return;
    }

    // Check if form already exists in this context
    if (!isEdit && targetElement.querySelector('.inline-set-form')) return;

    const node = inlineSetTemplate.content.cloneNode(true);
    const form = node.querySelector('.inline-set-form');
    const resultContainer = node.querySelector('.inline-result-container');
    const disciplineInput = node.querySelector('.inline-discipline');

    const renderInlineResultFields = (discipline, initialData = null) => {
      resultContainer.innerHTML = '';
      if (discipline === 'Slalom') resultContainer.appendChild(slalomResultTemplate.content.cloneNode(true));
      else if (discipline === 'Jump') resultContainer.appendChild(jumpResultTemplate.content.cloneNode(true));
      else if (discipline === 'Trick') resultContainer.appendChild(trickResultTemplate.content.cloneNode(true));
      
      resultContainer.querySelectorAll('input, select').forEach(el => el.classList.add('text-xs', 'py-0.5'));
      
      if (initialData) {
        if (discipline === 'Slalom') {
          const b = form.querySelector('.slalom-buoys');
          const l = form.querySelector('.slalom-length');
          const s = form.querySelector('.slalom-speed');
          if (b) b.value = initialData.buoys ?? '';
          if (l) l.value = initialData.line_length ?? '';
          if (s) s.value = initialData.speed ?? '';
        } else if (discipline === 'Jump') {
          const d = form.querySelector('.jump-distance');
          if (d) d.value = initialData.distance_meters ?? '';
        } else if (discipline === 'Trick') {
          const p = form.querySelector('.trick-points');
          if (p) p.value = initialData.points ?? '';
        }
      }
    };

    if (isEdit) {
      disciplineInput.value = foundSet.discipline;
      form.querySelector('.inline-satisfaction').value = foundSet.satisfaction;
      form.querySelector('.inline-notes').value = foundSet.notes || '';
      renderInlineResultFields(foundSet.discipline, foundSet.result_data);
    } else {
      renderInlineResultFields('Slalom');
    }

    disciplineInput.addEventListener('input', (e) => renderInlineResultFields(e.target.value));

    node.querySelector('.cancel-inline-set').addEventListener('click', () => isEdit ? loadSessions() : form.remove());
    node.querySelector('.save-inline-set').addEventListener('click', async () => {
      const discipline = disciplineInput.value;
      let result_data = null;

      if (discipline === 'Slalom') {
        const b = form.querySelector('.slalom-buoys')?.value;
        const l = form.querySelector('.slalom-length')?.value;
        const s = form.querySelector('.slalom-speed')?.value;
        if (b || l || s) result_data = { buoys: b ? parseFloat(b) : null, line_length: l ? parseFloat(l) : null, speed: s ? parseFloat(s) : null };
      } else if (discipline === 'Jump') {
        const d = form.querySelector('.jump-distance')?.value;
        if (d) result_data = { distance_meters: parseFloat(d) };
      } else if (discipline === 'Trick') {
        const p = form.querySelector('.trick-points')?.value;
        if (p) result_data = { points: parseInt(p, 10) };
      }

      const payload = {
        discipline,
        satisfaction: parseInt(form.querySelector('.inline-satisfaction').value, 10),
        notes: form.querySelector('.inline-notes').value,
        result_type: result_data ? discipline.toLowerCase() : null,
        result_data
      };

      let result;
      if (isEdit) {
        result = await supabaseClient.from('sets').update(payload).eq('id', setId);
      } else {
        result = await supabaseClient.from('sets').insert([{ ...payload, session_id: sessionId }]);
      }

      if (result.error) alert('Error saving set: ' + result.error.message);
      else loadSessions();
    });

    if (isEdit) {
      targetElement.replaceWith(form);
    } else {
      targetElement.appendChild(node);
    }
  }
});

// Session Form Handlers
newSessionBtn.addEventListener('click', () => {
  document.getElementById('session-date').valueAsDate = new Date();
  document.getElementById('session-lake').value = mostFrequentLake;
  document.getElementById('session-notes').value = '';
  setsContainer.innerHTML = '';
  addSet(); // add one empty set by default
  showView(sessionFormView);
});

backToDashboardBtn.addEventListener('click', () => {
  showView(dashboardView);
});

quickLogBtn.addEventListener('click', quickLogSession);

async function quickLogSession() {
  quickLogBtn.disabled = true;
  quickLogBtn.textContent = '⚡ Logging...';

  try {
    const defaults = await getLastSetDefaults();
    
    // 1. Create Session
    const { data: session, error: sErr } = await supabaseClient
      .from('sessions')
      .insert([{ 
        date: new Date().toISOString().split('T')[0], 
        lake: mostFrequentLake || 'Unknown Lake',
        user_id: currentUser.id 
      }])
      .select()
      .single();

    if (sErr) throw sErr;

    // 2. Create Initial Set
    const { error: setErr } = await supabaseClient
      .from('sets')
      .insert([{
        session_id: session.id,
        discipline: defaults.discipline,
        satisfaction: defaults.satisfaction,
        result_type: defaults.result_type,
        result_data: defaults.result_data
      }]);

    if (setErr) throw setErr;

    await loadSessions();
  } catch (err) {
    alert('Quick Log Failed: ' + err.message);
  } finally {
    quickLogBtn.disabled = false;
    quickLogBtn.textContent = '⚡ Quick Log';
  }
}

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

async function getLastSetDefaults() {
  const { data } = await supabaseClient
    .from('sessions')
    .select('sets(*)')
    .order('created_at', { ascending: false }) // Use created_at if available, otherwise we might need a better way. 
    // Wait, sessions table HAS created_at.
    .limit(5);

  if (data && data.length > 0) {
    for (const session of data) {
      if (session.sets && session.sets.length > 0) {
        // Return the first set of the most recent session
        return session.sets[0];
      }
    }
  }
  return { discipline: 'Slalom', satisfaction: 3, result_data: null };
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
      const buoysStr = el.querySelector('.slalom-buoys')?.value;
      const lengthStr = el.querySelector('.slalom-length')?.value;
      const speedStr = el.querySelector('.slalom-speed')?.value;
      
      const buoys = buoysStr ? parseFloat(buoysStr) : null;
      const length = lengthStr ? parseFloat(lengthStr) : null;
      const speed = speedStr ? parseFloat(speedStr) : null;
      
      if (buoys !== null || length !== null || speed !== null) {
        result_data = {};
        if (buoys !== null) result_data.buoys = buoys;
        if (length !== null) result_data.line_length = length;
        if (speed !== null) result_data.speed = speed;
      }
    } else if (discipline === 'Jump') {
      const distanceStr = el.querySelector('.jump-distance')?.value;
      if (distanceStr) {
        result_data = { distance_meters: parseFloat(distanceStr) };
      }
    } else if (discipline === 'Trick') {
      const pointsStr = el.querySelector('.trick-points')?.value;
      if (pointsStr) {
        result_data = { points: parseInt(pointsStr, 10) };
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

function renderStats() {
  if (!allSessions || allSessions.length === 0) {
    statsContent.innerHTML = '<p class="text-gray-500 text-center mt-10">No data available for stats yet.</p>';
    return;
  }

  // 1. Aggregation
  let totalSessions = allSessions.length;
  let totalSets = 0;
  let totalSatisfaction = 0;
  let satisfactionCount = 0;

  const disciplines = { Slalom: 0, Jump: 0, Trick: 0, Other: 0 };
  
  let bestSlalom = { buoys: -1, length: 19, speed: -1 }; 
  let bestJump = 0;
  let bestTrick = 0;

  allSessions.forEach(session => {
    totalSets += session.sets.length;
    session.sets.forEach(set => {
      // Discipline count
      const disc = set.discipline || 'Other';
      if (disciplines[disc] !== undefined) disciplines[disc]++;
      else disciplines.Other++;

      // Satisfaction
      if (set.satisfaction !== null && set.satisfaction !== undefined) {
        totalSatisfaction += set.satisfaction;
        satisfactionCount++;
      }

      // Best results
      if (set.result_data) {
        if (set.discipline === 'Slalom') {
          const d = set.result_data;
          // Individually best metrics
          if (d.buoys !== null && d.buoys > bestSlalom.buoys) bestSlalom.buoys = d.buoys;
          if (d.line_length !== null && d.line_length < bestSlalom.length) bestSlalom.length = d.line_length;
          if (d.speed !== null && d.speed > bestSlalom.speed) bestSlalom.speed = d.speed;
        } else if (set.discipline === 'Jump') {
          if (set.result_data.distance_meters > bestJump) bestJump = set.result_data.distance_meters;
        } else if (set.discipline === 'Trick') {
          if (set.result_data.points > bestTrick) bestTrick = set.result_data.points;
        }
      }
    });
  });

  const avgSat = satisfactionCount > 0 ? (totalSatisfaction / satisfactionCount).toFixed(1) : 'No ratings yet';

  // 2. UI Generation
  statsContent.innerHTML = `
    <!-- Training Volume -->
    <div class="grid grid-cols-2 gap-4">
      <div class="bg-white p-4 rounded-lg shadow border border-gray-100 text-center">
        <p class="text-xs text-gray-500 uppercase font-bold">Sessions</p>
        <p class="text-2xl font-bold text-gray-800">${totalSessions}</p>
      </div>
      <div class="bg-white p-4 rounded-lg shadow border border-gray-100 text-center">
        <p class="text-xs text-gray-500 uppercase font-bold">Sets</p>
        <p class="text-2xl font-bold text-gray-800">${totalSets}</p>
      </div>
    </div>

    <!-- Best Performance -->
    <div class="bg-white p-4 rounded-lg shadow border border-gray-100">
      <h3 class="text-sm font-bold text-gray-700 mb-3 uppercase flex items-center">
        <span class="mr-2">🏆</span> Best Performance
      </h3>
      <div class="space-y-3">
        <div class="flex justify-between items-center border-b border-gray-50 pb-2">
          <span class="text-sm text-gray-600">Slalom</span>
          <span class="text-sm font-bold text-blue-600 text-right">
            ${bestSlalom.buoys >= 0 ? `${bestSlalom.buoys} @ ${bestSlalom.length}m @ ${bestSlalom.speed}kph` : 'No results yet'}
          </span>
        </div>
        <div class="flex justify-between items-center border-b border-gray-50 pb-2">
          <span class="text-sm text-gray-600">Jump</span>
          <span class="text-sm font-bold text-green-600">
            ${bestJump > 0 ? `${bestJump}m` : 'No results yet'}
          </span>
        </div>
        <div class="flex justify-between items-center">
          <span class="text-sm text-gray-600">Tricks</span>
          <span class="text-sm font-bold text-purple-600">
            ${bestTrick > 0 ? `${bestTrick} pts` : 'No results yet'}
          </span>
        </div>
      </div>
    </div>

    <!-- Discipline Breakdown -->
    <div class="bg-white p-4 rounded-lg shadow border border-gray-100">
      <h3 class="text-sm font-bold text-gray-700 mb-3 uppercase">📈 Discipline Breakdown</h3>
      <div class="grid grid-cols-2 gap-2">
        ${Object.entries(disciplines).map(([name, count]) => `
          <div class="flex justify-between text-sm">
            <span class="text-gray-600">${name}</span>
            <span class="font-bold">${count}</span>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Avg Satisfaction -->
    <div class="bg-blue-600 p-4 rounded-lg shadow text-center text-white">
      <p class="text-xs uppercase font-bold opacity-80">Average Satisfaction</p>
      <p class="text-3xl font-bold">${avgSat}${satisfactionCount > 0 ? ' ⭐' : ''}</p>
    </div>
  `;
}

// Start app
init();
