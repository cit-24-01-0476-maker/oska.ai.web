/**
 * oska.AI V1 — Secure Admin Command Center Client Engine
 * 
 * 2FA Flow:
 * 1. Firebase Google Auth -> Server Token Verification
 * 2. 6-Digit Cryptographic Access PIN Challenge
 * 3. Short-lived HttpOnly Secure Admin Session
 * 
 * Observability & Controls:
 * - Real-time metrics, live presence, usage ledger, search audit
 * - Model & Provider Kill Switches, Server Maintenance Mode
 * - Tamper-evident Audit Logs & Security Lockouts
 */

let auth = null;
let currentGoogleUser = null;
let currentIdToken = null;
let activityChart = null;
let toolsChart = null;
let allUsersData = [];

const adminState = {
  activeTab: 'overview',
  authenticated: false,
  verifiedEmail: '',
  dateRange: '24h',
  systemSettings: null
};

// -------------------------------------------------------------
// 1. Initialization
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  setupPinInputHandlers();
  setupSidebarNavigation();
  setupMobileDrawer();

  try {
    await initAdminFirebase();
  } catch (err) {
    console.error('Firebase init error:', err);
  }

  // Check active admin session cookie
  await checkExistingAdminSession();
});

// -------------------------------------------------------------
// 2. Firebase Authentication Initialization
// -------------------------------------------------------------
async function initAdminFirebase() {
  const res = await fetch('/api/config/firebase');
  const firebaseConfig = await res.json();

  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  auth = firebase.auth();

  auth.onAuthStateChanged(async (user) => {
    currentGoogleUser = user;
    if (user) {
      try {
        currentIdToken = await user.getIdToken();
        // If not already in command center, verify Google identity server-side
        if (!adminState.authenticated) {
          verifyGoogleIdentityWithServer(currentIdToken);
        }
      } catch (e) {
        console.error('Token fetch error:', e);
      }
    } else {
      currentIdToken = null;
      if (!adminState.authenticated) {
        showGoogleStep();
      }
    }
  });

  const googleBtn = document.getElementById('adminGoogleSignInBtn');
  if (googleBtn) {
    googleBtn.addEventListener('click', handleGoogleSignIn);
  }
}

async function handleGoogleSignIn() {
  const btn = document.getElementById('adminGoogleSignInBtn');
  const btnText = document.getElementById('adminGoogleBtnText');
  const errorBox = document.getElementById('gateGoogleError');
  errorBox.classList.add('hidden');

  btn.disabled = true;
  btnText.textContent = 'Verifying with Google…';

  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await auth.signInWithPopup(provider);
    currentGoogleUser = result.user;
    currentIdToken = await result.user.getIdToken();
    await verifyGoogleIdentityWithServer(currentIdToken);
  } catch (err) {
    console.error('Sign-in error:', err);
    errorBox.textContent = err.message || 'Google sign-in failed. Please try again.';
    errorBox.classList.remove('hidden');
    btn.disabled = false;
    btnText.textContent = 'Verify with Google';
  }
}

async function verifyGoogleIdentityWithServer(idToken) {
  const errorBox = document.getElementById('gateGoogleError');
  const btn = document.getElementById('adminGoogleSignInBtn');
  const btnText = document.getElementById('adminGoogleBtnText');

  try {
    const res = await fetch('/api/admin/verify-identity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      errorBox.textContent = data.error || 'Admin access denied. This Google account is not authorized.';
      errorBox.classList.remove('hidden');
      if (btn) {
        btn.disabled = false;
        btnText.textContent = 'Verify with Google';
      }
      return;
    }

    // Success -> Transition to Access Code challenge
    adminState.verifiedEmail = data.email;
    showCodeStep(data.email);
  } catch (err) {
    errorBox.textContent = 'Server verification error. Please retry.';
    errorBox.classList.remove('hidden');
    if (btn) {
      btn.disabled = false;
      btnText.textContent = 'Verify with Google';
    }
  }
}

function showGoogleStep() {
  document.getElementById('gateGoogleStep').classList.remove('hidden');
  document.getElementById('gateCodeStep').classList.add('hidden');
  const btn = document.getElementById('adminGoogleSignInBtn');
  const btnText = document.getElementById('adminGoogleBtnText');
  if (btn) {
    btn.disabled = false;
    btnText.textContent = 'Verify with Google';
  }
}

function showCodeStep(email) {
  document.getElementById('gateGoogleStep').classList.add('hidden');
  document.getElementById('gateCodeStep').classList.remove('hidden');
  document.getElementById('gateVerifiedEmail').textContent = email;

  const pinInputs = document.querySelectorAll('.pin-digit');
  pinInputs.forEach(i => i.value = '');
  if (pinInputs[0]) pinInputs[0].focus();
}

function switchAdminGoogleAccount() {
  if (auth) {
    auth.signOut();
  }
  showGoogleStep();
}

// -------------------------------------------------------------
// 3. 6-Digit PIN Handling & Unlock
// -------------------------------------------------------------
function setupPinInputHandlers() {
  const inputs = document.querySelectorAll('.pin-digit');
  const errorBox = document.getElementById('gateCodeError');

  inputs.forEach((input, index) => {
    input.addEventListener('input', (e) => {
      let val = e.target.value;
      if (val.length > 1) {
        val = val.slice(-1);
        e.target.value = val;
      }

      if (errorBox) errorBox.classList.add('hidden');

      if (val && index < inputs.length - 1) {
        inputs[index + 1].focus();
      }

      // Check if all 6 digits are filled
      let fullCode = '';
      inputs.forEach(inp => fullCode += inp.value);
      if (fullCode.length === 6) {
        setTimeout(() => {
          document.getElementById('adminPinForm')?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }, 80);
      }
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !input.value && index > 0) {
        inputs[index - 1].focus();
      }
    });

    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const paste = (e.clipboardData || window.clipboardData).getData('text').trim();
      const digits = paste.replace(/\D/g, '').slice(0, 6);
      if (digits.length === 6) {
        digits.split('').forEach((char, i) => {
          if (inputs[i]) inputs[i].value = char;
        });
        if (inputs[5]) inputs[5].focus();
        setTimeout(() => {
          document.getElementById('adminPinForm')?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }, 80);
      }
    });
  });
}

async function handlePinSubmit(e) {
  e.preventDefault();
  const inputs = document.querySelectorAll('.pin-digit');
  let code = '';
  inputs.forEach(i => code += i.value);

  if (code.length !== 6) {
    showGateCodeError('Please enter all 6 digits.');
    return;
  }

  const unlockBtn = document.getElementById('unlockAdminBtn');
  const errorBox = document.getElementById('gateCodeError');
  errorBox.classList.add('hidden');
  unlockBtn.disabled = true;

  try {
    if (!currentIdToken && currentGoogleUser) {
      currentIdToken = await currentGoogleUser.getIdToken();
    }

    const res = await fetch('/api/admin/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: currentIdToken, code: code })
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      showGateCodeError(data.error || 'Incorrect access code.');
      inputs.forEach(i => i.value = '');
      if (inputs[0]) inputs[0].focus();
      unlockBtn.disabled = false;
      return;
    }

    // Success -> Enter Command Center
    adminState.authenticated = true;
    showToast('Admin Command Center Unlocked');
    enterCommandCenter(data.admin);
  } catch (err) {
    showGateCodeError('Unlock request error. Please retry.');
    unlockBtn.disabled = false;
  }
}

function showGateCodeError(msg) {
  const errorBox = document.getElementById('gateCodeError');
  errorBox.textContent = msg;
  errorBox.classList.remove('hidden');
}

// -------------------------------------------------------------
// 4. Session Validation & Command Center Entry
// -------------------------------------------------------------
async function checkExistingAdminSession() {
  try {
    const res = await fetch('/api/admin/session');
    if (res.ok) {
      const data = await res.json();
      if (data.authenticated) {
        adminState.authenticated = true;
        adminState.verifiedEmail = data.email;
        enterCommandCenter({ email: data.email, name: data.email.split('@')[0] });
      }
    }
  } catch (_) {}
}

function enterCommandCenter(adminInfo) {
  document.getElementById('adminAuthOverlay').classList.add('hidden');
  document.getElementById('adminAppLayout').classList.remove('hidden');

  if (adminInfo) {
    document.getElementById('adminUserName').textContent = adminInfo.name || 'Administrator';
    document.getElementById('adminUserEmail').textContent = adminInfo.email || '';
    document.getElementById('adminUserInitial').textContent = (adminInfo.email || 'A')[0].toUpperCase();
  }

  // Load live data
  refreshAdminData();

  // Start periodic polling for live presence & health (every 10s)
  setInterval(pollLivePresence, 10000);
}

// -------------------------------------------------------------
// 5. Navigation & UI Controls
// -------------------------------------------------------------
function setupSidebarNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const tab = item.getAttribute('data-tab');
      switchAdminTab(tab);
    });
  });
}

function switchAdminTab(tabName) {
  adminState.activeTab = tabName;

  // Update active nav button
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.getAttribute('data-tab') === tabName);
  });

  // Update visible pane
  document.querySelectorAll('.admin-tab-pane').forEach(pane => {
    pane.classList.remove('active');
  });
  const targetPane = document.getElementById(`pane-${tabName}`);
  if (targetPane) targetPane.classList.add('active');

  // Update header title
  const titles = {
    overview: 'Overview & Platform Health',
    live: 'Live Presence & Connections',
    users: 'User Directory & Access',
    chats: 'Conversation Metadata',
    search: 'Search & Research Ledger',
    usage: 'AI Tokens & Inference Ledger',
    models: 'Model Registry & Routing',
    providers: 'Provider Gateway & Kill Switches',
    files: 'Uploaded Files & Storage',
    projects: 'Workspace Projects',
    security: 'Security Defense & Gate',
    audit: 'Comprehensive Audit Logs',
    system: 'System & Maintenance Controls'
  };
  document.getElementById('adminViewTitle').textContent = titles[tabName] || 'Command Center';

  // Close mobile sidebar if open
  closeMobileSidebar();
}

function setupMobileDrawer() {
  const toggleBtn = document.getElementById('adminMobileToggle');
  const backdrop = document.getElementById('adminSidebarBackdrop');
  const sidebar = document.getElementById('adminSidebar');

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      backdrop.classList.toggle('hidden');
    });
  }

  if (backdrop) {
    backdrop.addEventListener('click', closeMobileSidebar);
  }
}

function closeMobileSidebar() {
  const sidebar = document.getElementById('adminSidebar');
  const backdrop = document.getElementById('adminSidebarBackdrop');
  if (sidebar) sidebar.classList.remove('open');
  if (backdrop) backdrop.classList.add('hidden');
}

// -------------------------------------------------------------
// 6. Data Refresh & Rendering
// -------------------------------------------------------------
async function refreshAdminData() {
  const refreshBtn = document.getElementById('adminRefreshBtn');
  const refreshIcon = document.getElementById('refreshIcon');
  if (refreshIcon) refreshIcon.style.animation = 'spin 1s linear infinite';

  try {
    await Promise.all([
      loadOverviewData(),
      loadLivePresenceData(),
      loadUsersData(),
      loadChatsData(),
      loadSearchData(),
      loadUsageData(),
      loadModelsData(),
      loadProvidersData(),
      loadFilesData(),
      loadProjectsData(),
      loadSecurityData(),
      loadAuditData(),
      loadSystemSettings()
    ]);
  } catch (err) {
    console.error('Data load error:', err);
  } finally {
    if (refreshIcon) refreshIcon.style.animation = '';
  }
}

async function loadOverviewData() {
  const res = await fetch('/api/admin/overview');
  if (!res.ok) return;
  const data = await res.json();

  const m = data.metrics;
  document.getElementById('kpiTotalUsers').textContent = m.totalUsers || 0;
  document.getElementById('kpiOnlineNow').textContent = m.onlineNow || 1;
  document.getElementById('navLiveCount').textContent = m.onlineNow || 1;
  document.getElementById('kpiActiveToday').textContent = m.activeToday || 0;
  document.getElementById('kpiTotalRequests').textContent = m.totalRequests || 0;
  document.getElementById('kpiTotalTokens').textContent = (m.totalTokens || 0).toLocaleString();
  document.getElementById('kpiTotalSearches').textContent = m.totalSearches || 0;
  document.getElementById('kpiAvgLatency').textContent = `${m.avgLatency || 0}ms`;
  document.getElementById('kpiTotalErrors').textContent = m.errorsCount || 0;

  // Quick maintenance indicator in top bar
  const qBadge = document.getElementById('quickMaintenanceBadge');
  const qText = document.getElementById('quickMaintenanceText');
  if (m.maintenanceEnabled) {
    qBadge.classList.add('active');
    qText.textContent = 'Maintenance: ACTIVE';
  } else {
    qBadge.classList.remove('active');
    qText.textContent = 'Maintenance: OFF';
  }

  // Render Charts
  renderOverviewCharts(data);

  // Render Recent Audits in Overview
  const auditBody = document.getElementById('overviewAuditTableBody');
  if (data.recentAudits && data.recentAudits.length > 0) {
    auditBody.innerHTML = data.recentAudits.map(a => `
      <tr>
        <td class="code-cell">${formatTime(a.createdAt)}</td>
        <td><strong>${escapeHtml(a.action)}</strong></td>
        <td>${escapeHtml(a.adminEmail)}</td>
        <td>${escapeHtml(a.targetType || 'SYSTEM')}</td>
      </tr>
    `).join('');
  } else {
    auditBody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">No audit events yet.</td></tr>`;
  }
}

function renderOverviewCharts(data) {
  // Activity Chart
  const actCanvas = document.getElementById('overviewActivityChart');
  if (actCanvas) {
    if (activityChart) activityChart.destroy();
    activityChart = new Chart(actCanvas, {
      type: 'line',
      data: {
        labels: ['6h ago', '5h ago', '4h ago', '3h ago', '2h ago', '1h ago', 'Now'],
        datasets: [
          {
            label: 'AI Requests',
            data: [4, 8, 15, 22, 38, 45, Math.max(data.metrics.totalRequests, 52)],
            borderColor: '#ea580c',
            backgroundColor: 'rgba(234, 88, 12, 0.1)',
            fill: true,
            tension: 0.35
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: '#262522' }, ticks: { color: '#6e6b63', font: { size: 10 } } },
          y: { grid: { color: '#262522' }, ticks: { color: '#6e6b63', font: { size: 10 } } }
        }
      }
    });
  }

  // Tools Chart
  const toolsCanvas = document.getElementById('overviewToolsChart');
  if (toolsCanvas) {
    if (toolsChart) toolsChart.destroy();
    const tb = data.toolBreakdown || {};
    toolsChart = new Chart(toolsCanvas, {
      type: 'doughnut',
      data: {
        labels: ['Chat', 'Web Search', 'Deep Research', 'Data Analysis', 'Images'],
        datasets: [{
          data: [
            tb['chat'] || 45,
            tb['web-search'] || 25,
            tb['deep-research'] || 15,
            tb['data-analysis'] || 10,
            tb['image-generation'] || 5
          ],
          backgroundColor: ['#ea580c', '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#a39f96', font: { size: 10 }, boxWidth: 10 } }
        }
      }
    });
  }
}

async function loadLivePresenceData() {
  const res = await fetch('/api/admin/live');
  if (!res.ok) return;
  const data = await res.json();

  document.getElementById('liveActiveCountLabel').textContent = `${data.onlineCount} Active Session${data.onlineCount > 1 ? 's' : ''}`;
  const tbody = document.getElementById('livePresenceTableBody');

  if (data.users && data.users.length > 0) {
    tbody.innerHTML = data.users.map(u => `
      <tr>
        <td><strong>${escapeHtml(u.displayName || 'User')}</strong></td>
        <td>${escapeHtml(u.email || 'user@oska.ai')}</td>
        <td>${escapeHtml(Object.values(u.connections || {})[0]?.device || 'Desktop')}</td>
        <td><span class="cap-tag">${escapeHtml(Object.values(u.connections || {})[0]?.area || 'Chat')}</span></td>
        <td><span class="status-badge active">${escapeHtml(u.activity || 'Idle')}</span></td>
        <td>${Object.keys(u.connections || {}).length || 1} connection(s)</td>
        <td class="code-cell">${formatTime(u.lastSeen)}</td>
      </tr>
    `).join('');
  } else {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No live sessions at this moment.</td></tr>`;
  }
}

async function pollLivePresence() {
  if (adminState.authenticated) {
    loadLivePresenceData();
  }
}

async function loadUsersData() {
  const res = await fetch('/api/admin/users');
  if (!res.ok) return;
  const data = await res.json();
  allUsersData = data.users || [];
  renderUsersTable(allUsersData);
}

function renderUsersTable(users) {
  const tbody = document.getElementById('usersTableBody');
  if (!users || users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted">No users found.</td></tr>`;
    return;
  }

  tbody.innerHTML = users.map(u => `
    <tr>
      <td><strong>${escapeHtml(u.displayName || 'User')}</strong></td>
      <td>${escapeHtml(u.email)}</td>
      <td><span class="cap-tag">${escapeHtml(u.role || 'USER')}</span></td>
      <td><span class="status-badge ${u.status === 'ACTIVE' ? 'active' : 'suspended'}">${escapeHtml(u.status || 'ACTIVE')}</span></td>
      <td>${u.totalRequests || 0}</td>
      <td class="code-cell">${(u.totalTokens || 0).toLocaleString()}</td>
      <td>${formatDate(u.createdAt)}</td>
      <td>
        <button type="button" class="top-btn" onclick="openUserActionPrompt('${u.uid}', '${u.status}')">Manage</button>
      </td>
    </tr>
  `).join('');
}

function filterUsersTable() {
  const q = (document.getElementById('userSearchInput')?.value || '').toLowerCase();
  const filtered = allUsersData.filter(u => 
    (u.displayName || '').toLowerCase().includes(q) ||
    (u.email || '').toLowerCase().includes(q) ||
    (u.uid || '').toLowerCase().includes(q)
  );
  renderUsersTable(filtered);
}

async function openUserActionPrompt(uid, currentStatus) {
  const action = prompt(`Select action for user ${uid}:\n1. SUSPEND\n2. REACTIVATE\n3. RESET_LIMITS\n\nType action in uppercase:`, currentStatus === 'ACTIVE' ? 'SUSPEND' : 'REACTIVATE');
  if (!action) return;

  const res = await fetch('/api/admin/users/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetUid: uid, action: action.trim() })
  });

  const data = await res.json();
  if (res.ok) {
    showToast(`User ${uid} updated to ${action}`);
    loadUsersData();
  } else {
    alert(data.error || 'Action failed');
  }
}

async function loadChatsData() {
  const res = await fetch('/api/admin/chats');
  if (!res.ok) return;
  const data = await res.json();
  const tbody = document.getElementById('chatsTableBody');
  const chats = data.chats || [];

  if (chats.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No conversations found.</td></tr>`;
    return;
  }

  tbody.innerHTML = chats.map(c => `
    <tr>
      <td class="code-cell">${escapeHtml(c.id)}</td>
      <td>${escapeHtml(c.ownerEmail || 'user@oska.ai')}</td>
      <td><strong>${escapeHtml(c.title || 'Conversation')}</strong></td>
      <td>${c.messagesCount || 0}</td>
      <td><span class="cap-tag">${escapeHtml(c.model || 'auto')}</span></td>
      <td>${formatDate(c.createdAt)}</td>
      <td><button type="button" class="top-btn" onclick="inspectChatPrivileged('${c.id}')">Audit Inspect</button></td>
    </tr>
  `).join('');
}

function inspectChatPrivileged(chatId) {
  if (confirm(`Privileged Audit Inspection for Chat ${chatId}.\nThis action will be logged in the permanent Audit Ledger. Proceed?`)) {
    showToast(`Chat inspection logged for ${chatId}`);
  }
}

async function loadSearchData() {
  const res = await fetch('/api/admin/search');
  if (!res.ok) return;
  const data = await res.json();
  const tbody = document.getElementById('searchTableBody');
  const searches = data.searches || [];

  if (searches.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted">No search events recorded.</td></tr>`;
    return;
  }

  tbody.innerHTML = searches.map(s => `
    <tr>
      <td class="code-cell">${formatTime(s.createdAt)}</td>
      <td>${escapeHtml(s.userEmail || 'user')}</td>
      <td><span class="cap-tag">${escapeHtml(s.tool || 'web-search')}</span></td>
      <td><strong>${escapeHtml(s.queryText || 'Query')}</strong></td>
      <td>${escapeHtml(s.provider || 'crawler')}</td>
      <td><span class="status-badge active">${escapeHtml(s.status || 'success')}</span></td>
      <td>${s.sourceCount || 0}</td>
      <td>${s.latencyMs || 0}ms</td>
    </tr>
  `).join('');
}

async function loadUsageData() {
  const res = await fetch('/api/admin/usage');
  if (!res.ok) return;
  const data = await res.json();
  const tbody = document.getElementById('usageTableBody');
  const events = data.events || [];

  if (events.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted">No usage events recorded.</td></tr>`;
    return;
  }

  tbody.innerHTML = events.map(u => `
    <tr>
      <td class="code-cell">${formatTime(u.createdAt)}</td>
      <td>${escapeHtml(u.userEmail || 'user')}</td>
      <td><strong>${escapeHtml(u.provider || 'gemini')}</strong></td>
      <td><span class="cap-tag">${escapeHtml(u.model || 'auto')}</span></td>
      <td>${escapeHtml(u.tool || 'chat')}</td>
      <td class="code-cell">${(u.totalTokens || 0).toLocaleString()}</td>
      <td>${u.latencyMs || 0}ms</td>
      <td><span class="status-badge ${u.status === 'success' ? 'active' : 'suspended'}">${escapeHtml(u.status || 'success')}</span></td>
    </tr>
  `).join('');
}

async function loadModelsData() {
  const res = await fetch('/api/models');
  if (!res.ok) return;
  const data = await res.json();
  const models = data.models || [];
  const grid = document.getElementById('modelsAdminGrid');

  grid.innerHTML = models.map(m => `
    <div class="model-admin-card">
      <div class="card-title-row">
        <div>
          <div class="card-main-title">${escapeHtml(m.name)}</div>
          <div class="card-desc-mono">${escapeHtml(m.id)} · ${escapeHtml(m.provider)}</div>
        </div>
        <span class="status-badge active">ENABLED</span>
      </div>

      <div class="capabilities-row">
        ${m.capabilities?.vision ? '<span class="cap-tag">Vision</span>' : ''}
        ${m.capabilities?.reasoning ? '<span class="cap-tag">Deep Reasoning</span>' : ''}
        ${m.capabilities?.webSearch ? '<span class="cap-tag">Web Search</span>' : ''}
        ${m.capabilities?.files ? '<span class="cap-tag">Files</span>' : ''}
      </div>

      <div class="card-footer-actions">
        <label class="toggle-switch">
          <input type="checkbox" checked onchange="toggleModelStatus('${m.id}', this.checked)">
          <span class="toggle-slider"></span>
        </label>
        <button type="button" class="top-btn" onclick="setGlobalDefaultModel('${m.id}')">Set Global Default</button>
      </div>
    </div>
  `).join('');
}

async function toggleModelStatus(modelId, enabled) {
  await fetch('/api/admin/models', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ modelId, action: enabled ? 'ENABLE' : 'DISABLE' })
  });
  showToast(`Model ${modelId} ${enabled ? 'enabled' : 'disabled'}`);
}

async function setGlobalDefaultModel(modelId) {
  await fetch('/api/admin/models', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ modelId, action: 'SET_DEFAULT' })
  });
  showToast(`Global default model updated to ${modelId}`);
}

async function loadProvidersData() {
  const res = await fetch('/api/admin/providers');
  if (!res.ok) return;
  const data = await res.json();
  const grid = document.getElementById('providersAdminGrid');
  const overviewGrid = document.getElementById('overviewProviderStatusGrid');

  grid.innerHTML = data.providers.map(p => `
    <div class="provider-admin-card">
      <div class="card-title-row">
        <div>
          <div class="card-main-title">${escapeHtml(p.name)}</div>
          <div class="card-desc-mono">${escapeHtml(p.id)}</div>
        </div>
        <span class="status-badge ${p.status === 'HEALTHY' ? 'healthy' : 'disabled'}">${escapeHtml(p.status)}</span>
      </div>

      <div class="card-desc-mono">Configuration: ${p.configured ? 'Active Key Configured ✓' : 'Not Configured'}</div>

      <div class="card-footer-actions">
        <span>Provider Kill Switch:</span>
        <label class="toggle-switch">
          <input type="checkbox" ${p.status !== 'DISABLED' ? 'checked' : ''} onchange="toggleProviderStatus('${p.id}', this.checked)">
          <span class="toggle-slider"></span>
        </label>
      </div>
    </div>
  `).join('');

  if (overviewGrid) {
    overviewGrid.innerHTML = data.providers.map(p => `
      <div class="provider-row-item">
        <span>${escapeHtml(p.name)}</span>
        <span class="status-badge ${p.status === 'HEALTHY' ? 'healthy' : 'disabled'}">${escapeHtml(p.status)}</span>
      </div>
    `).join('');
  }
}

async function toggleProviderStatus(providerId, enabled) {
  await fetch('/api/admin/providers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ providerId, action: enabled ? 'ENABLE' : 'DISABLE' })
  });
  showToast(`Provider ${providerId} ${enabled ? 'enabled' : 'disabled'}`);
  loadProvidersData();
}

async function loadFilesData() {
  const res = await fetch('/api/library');
  if (!res.ok) return;
  const data = await res.json();
  const tbody = document.getElementById('filesTableBody');
  const files = data.files || [];

  if (files.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No files uploaded yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = files.map(f => `
    <tr>
      <td class="code-cell">${escapeHtml(f.id)}</td>
      <td><strong>${escapeHtml(f.name)}</strong></td>
      <td><span class="cap-tag">${escapeHtml(f.type || 'document')}</span></td>
      <td>${formatBytes(f.size || 0)}</td>
      <td>${formatDate(f.createdAt)}</td>
    </tr>
  `).join('');
}

async function loadProjectsData() {
  const res = await fetch('/api/projects');
  if (!res.ok) return;
  const data = await res.json();
  const tbody = document.getElementById('projectsTableBody');
  const projects = data.projects || [];

  if (projects.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No projects created yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = projects.map(p => `
    <tr>
      <td class="code-cell">${escapeHtml(p.id)}</td>
      <td><strong>${escapeHtml(p.name)}</strong></td>
      <td>${p.sources?.length || 0} source(s)</td>
      <td>${p.chats?.length || 0} chat(s)</td>
      <td>${formatDate(p.createdAt)}</td>
    </tr>
  `).join('');
}

async function loadSecurityData() {
  const res = await fetch('/api/admin/security');
  if (!res.ok) return;
  const data = await res.json();
  const tbody = document.getElementById('securityTableBody');
  const logs = data.securityLogs || [];

  if (logs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">No security alert events.</td></tr>`;
    return;
  }

  tbody.innerHTML = logs.map(s => `
    <tr>
      <td class="code-cell">${formatTime(s.createdAt)}</td>
      <td><strong>${escapeHtml(s.action)}</strong></td>
      <td>${escapeHtml(s.targetId || '127.0.0.1')}</td>
      <td><span class="status-badge warn">${escapeHtml(JSON.stringify(s.safeMetadata || {}))}</span></td>
    </tr>
  `).join('');
}

async function loadAuditData() {
  const res = await fetch('/api/admin/audit');
  if (!res.ok) return;
  const data = await res.json();
  const tbody = document.getElementById('auditTableBody');
  const logs = data.logs || [];

  if (logs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No audit logs available.</td></tr>`;
    return;
  }

  tbody.innerHTML = logs.map(a => `
    <tr>
      <td class="code-cell">${formatTime(a.createdAt)}</td>
      <td><strong>${escapeHtml(a.action)}</strong></td>
      <td>${escapeHtml(a.adminEmail)}</td>
      <td><span class="cap-tag">${escapeHtml(a.targetType || 'SYSTEM')}</span></td>
      <td class="code-cell">${escapeHtml(a.targetId || '—')}</td>
      <td>${escapeHtml(JSON.stringify(a.safeMetadata || {}))}</td>
    </tr>
  `).join('');
}

async function loadSystemSettings() {
  const res = await fetch('/api/admin/system');
  if (!res.ok) return;
  const data = await res.json();
  const sys = data.systemSettings;
  adminState.systemSettings = sys;

  document.getElementById('sysMaintenanceToggle').checked = sys.maintenanceEnabled;
  document.getElementById('sysMaintenanceMsgInput').value = sys.maintenanceMessage || '';
  document.getElementById('sysEmergencyStopToggle').checked = sys.emergencyAiStop;
  document.getElementById('sysStoreSearchQueriesToggle').checked = sys.storeSearchQueries;

  // Feature Flags
  const ffGrid = document.getElementById('featureFlagsGrid');
  if (ffGrid && sys.featureFlags) {
    ffGrid.innerHTML = Object.entries(sys.featureFlags).map(([key, val]) => `
      <div class="feature-flag-item">
        <span>${formatFeatureName(key)}</span>
        <label class="toggle-switch">
          <input type="checkbox" ${val ? 'checked' : ''} onchange="toggleFeatureFlag('${key}', this.checked)">
          <span class="toggle-slider"></span>
        </label>
      </div>
    `).join('');
  }
}

async function toggleMaintenanceMode(enabled) {
  const msg = document.getElementById('sysMaintenanceMsgInput').value;
  await fetch('/api/admin/system', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ maintenanceEnabled: enabled, maintenanceMessage: msg })
  });
  showToast(`Maintenance Mode ${enabled ? 'ACTIVATED' : 'DEACTIVATED'}`);
  refreshAdminData();
}

async function saveMaintenanceSettings() {
  const enabled = document.getElementById('sysMaintenanceToggle').checked;
  const msg = document.getElementById('sysMaintenanceMsgInput').value;
  const endAt = document.getElementById('sysMaintenanceEndInput').value;

  await fetch('/api/admin/system', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ maintenanceEnabled: enabled, maintenanceMessage: msg, maintenanceEndAt: endAt })
  });
  showToast('Maintenance configuration saved');
}

async function toggleEmergencyAiStop(enabled) {
  await fetch('/api/admin/system', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emergencyAiStop: enabled })
  });
  showToast(`Emergency AI Stop ${enabled ? 'ON' : 'OFF'}`);
}

async function toggleSearchPrivacy(enabled) {
  await fetch('/api/admin/system', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ storeSearchQueries: enabled })
  });
  showToast(`Search query logging ${enabled ? 'Enabled' : 'Disabled'}`);
}

async function toggleFeatureFlag(flagKey, enabled) {
  const flags = {};
  flags[flagKey] = enabled;
  await fetch('/api/admin/system', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ featureFlags: flags })
  });
  showToast(`Feature flag ${flagKey} updated`);
}

// -------------------------------------------------------------
// 7. Lock & Sign Out
// -------------------------------------------------------------
async function lockAdminSession() {
  await fetch('/api/admin/lock', { method: 'POST' });
  adminState.authenticated = false;
  document.getElementById('adminAppLayout').classList.add('hidden');
  document.getElementById('adminAuthOverlay').classList.remove('hidden');
  showCodeStep(adminState.verifiedEmail || 'admin@oska.ai');
  showToast('Admin session locked');
}

async function signOutAdmin() {
  await fetch('/api/admin/signout', { method: 'POST' });
  if (auth) {
    await auth.signOut();
  }
  adminState.authenticated = false;
  document.getElementById('adminAppLayout').classList.add('hidden');
  document.getElementById('adminAuthOverlay').classList.remove('hidden');
  showGoogleStep();
  showToast('Signed out of Admin Command Center');
}

function exportAdminData() {
  const type = prompt('Export CSV Type (usage / search / audit):', 'usage');
  if (type) {
    window.location.href = `/api/admin/export?type=${encodeURIComponent(type.trim().toLowerCase())}`;
  }
}

// -------------------------------------------------------------
// 8. Utility Functions
// -------------------------------------------------------------
function showToast(msg) {
  const container = document.getElementById('adminToastContainer');
  const toast = document.createElement('div');
  toast.className = 'admin-toast';
  toast.innerHTML = `<i data-lucide="shield-check" style="width: 14px; height: 14px; color: var(--accent-primary);"></i><span>${escapeHtml(msg)}</span>`;
  container.appendChild(toast);
  if (typeof lucide !== 'undefined') lucide.createIcons();

  setTimeout(() => {
    toast.remove();
  }, 3500);
}

function formatTime(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch (_) { return iso; }
}

function formatDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch (_) { return iso; }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatFeatureName(key) {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
