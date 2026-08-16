/**
 * oska.AI V1 — Production AI Platform Client
 * Google-Only Authentication, Clean Auth Gate, Document Intelligence,
 * Multilingual Engine, and Multi-Provider AI Routing.
 */

// -------------------------------------------------------------
// 1. Firebase Authentication Setup
// -------------------------------------------------------------
let firebaseConfig = {
  apiKey: "AIzaSyAynMj77unslQcqn8OWNWpGAkOGvjQyIKE",
  authDomain: "web-ai-5a12f.firebaseapp.com",
  projectId: "web-ai-5a12f",
  storageBucket: "web-ai-5a12f.firebasestorage.app",
  messagingSenderId: "698188933837",
  appId: "1:698188933837:web:7685dd8bb46fba22ec1784"
};

let auth = null;

async function initFirebase() {
  try {
    const res = await fetch('/api/config/firebase').catch(() => null);
    if (res && res.ok) {
      const serverConfig = await res.json();
      if (serverConfig && serverConfig.apiKey) {
        firebaseConfig = { ...firebaseConfig, ...serverConfig };
      }
    }
  } catch (e) {
    // Keep local config
  }

  if (typeof firebase !== 'undefined' && firebase.initializeApp) {
    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
      }
      auth = firebase.auth();
      setupAuthListeners();
    } catch (err) {
      console.warn('Firebase initialization notice:', err);
    }
  }
}

// -------------------------------------------------------------
// 2. Centralized Model & Reasoning Catalog
// -------------------------------------------------------------
const DEFAULT_MODELS = [
  {
    id: 'gemini-3.7-flash',
    provider: 'gemini',
    name: 'Gemini 3.7 Flash',
    tag: 'Google · Vision · Reasoning',
    badge: 'Recommended',
    capabilities: { vision: true, files: true, reasoning: true, streaming: true },
    supportedEfforts: ['instant', 'medium', 'high', 'extra-high', 'pro']
  },
  {
    id: 'gemini-3.5-flash',
    provider: 'gemini',
    name: 'Gemini 3.5 Flash',
    tag: 'Google · Fast Throughput',
    capabilities: { vision: true, files: true, reasoning: true, streaming: true },
    supportedEfforts: ['instant', 'medium', 'high']
  },
  {
    id: 'gpt-4o',
    provider: 'openai',
    name: 'GPT-4o',
    tag: 'OpenAI · Flagship Multimodal',
    capabilities: { vision: true, files: true, reasoning: true, streaming: true },
    supportedEfforts: ['instant', 'medium', 'high']
  },
  {
    id: 'llama-3.3-70b-versatile',
    provider: 'groq',
    name: 'Llama 3.3 70B',
    tag: 'Groq LPU · Ultra Fast',
    badge: 'Ultra Fast',
    capabilities: { vision: false, files: true, reasoning: true, streaming: true },
    supportedEfforts: ['instant', 'medium', 'high']
  },
  {
    id: 'qwen/qwen3.6-27b',
    provider: 'groq',
    name: 'Qwen 3.6 Reasoner',
    tag: 'Groq LPU · Math & Logic',
    capabilities: { vision: false, files: true, reasoning: true, streaming: true },
    supportedEfforts: ['instant', 'medium', 'high', 'extra-high', 'pro']
  },
  {
    id: 'openrouter/free',
    provider: 'openrouter',
    name: 'OpenRouter Hub',
    tag: 'Universal AI Router',
    capabilities: { vision: true, files: true, reasoning: true, streaming: true },
    supportedEfforts: ['instant', 'medium', 'high']
  },
  {
    id: 'deepseek-reasoner',
    provider: 'deepseek',
    name: 'DeepSeek R1',
    tag: 'DeepSeek · CoT Reasoning',
    badge: 'Deep CoT',
    capabilities: { vision: false, files: true, reasoning: true, streaming: true },
    supportedEfforts: ['instant', 'medium', 'high', 'extra-high', 'pro']
  }
];

const REASONING_EFFORT_CONFIG = {
  'instant': { label: 'Instant', budgetTokens: 0, desc: 'Fastest direct answers without reasoning overhead' },
  'medium': { label: 'Medium', budgetTokens: 2048, desc: 'Standard balanced reasoning for general tasks' },
  'high': { label: 'High', budgetTokens: 4096, desc: 'Deeper reasoning for complex code and logic' },
  'extra-high': { label: 'Extra High', budgetTokens: 8192, desc: 'Maximum reasoning effort for advanced analysis' },
  'pro': { label: 'Pro', budgetTokens: 16384, desc: 'Comprehensive multi-step analysis' }
};

// -------------------------------------------------------------
// 3. Application State Store
// -------------------------------------------------------------
let state = {
  user: null,
  conversations: [],
  activeConversationId: null,
  selectedModel: 'gemini-3.7-flash',
  reasoningEffort: 'extra-high',
  responseLanguage: 'auto', // 'auto' | 'english' | 'sinhala' | 'singlish'
  theme: localStorage.getItem('oska_theme') || 'light',
  isGenerating: false,
  generationPhase: 'idle', // 'idle' | 'queued' | 'thinking' | 'analyzing' | 'tool' | 'streaming' | 'completed' | 'failed' | 'cancelled'
  attachments: [],
  activeTool: null,
  abortController: null,
  activeSpeechRecognition: null
};

// -------------------------------------------------------------
// 4. Centralized Authentication Gate (`requireAuth`)
// -------------------------------------------------------------
function requireAuth(actionCallback) {
  if (!state.user) {
    openAuthModal();
    return false;
  }
  if (typeof actionCallback === 'function') {
    actionCallback();
  }
  return true;
}

function openAuthModal() {
  hideAllPopovers();
  const modal = document.getElementById('loginModal');
  if (modal) {
    modal.classList.remove('hidden');
    const googleBtn = document.getElementById('googleSignInBtn');
    if (googleBtn) googleBtn.focus();
  }
}

function closeAuthModal() {
  const modal = document.getElementById('loginModal');
  if (modal) modal.classList.add('hidden');
}

// -------------------------------------------------------------
// 5. Multilingual & Singlish Intelligence Engine
// -------------------------------------------------------------
function detectLanguageIntent(text) {
  if (!text) return 'english';

  // Check for Sinhala Unicode characters
  const hasSinhalaUnicode = /[\u0D80-\u0DFF]/.test(text);
  if (hasSinhalaUnicode) return 'sinhala';

  // Check for Singlish keywords
  const singlishPattern = /\b(mata|oya|mokakda|kohomada|karanna|krnn|hadanna|ekak|thiyenawa|kiyanna|puluwanda|ane|meka|monawada|kohomath|dan|onna|ehema|thama|kiyala|hithanna|danna|wadak|nadda|mokada|kawda|koheda)\b/i;
  if (singlishPattern.test(text)) return 'singlish';

  return 'english';
}

function buildLanguageSystemPrompt(userText, selectedLang) {
  let langMode = selectedLang || 'auto';
  if (langMode === 'auto') {
    langMode = detectLanguageIntent(userText);
  }

  if (langMode === 'sinhala') {
    return 'You are oska.AI V1. The user communicates in Sinhala (සිංහල). Respond naturally, politely, and fluently in Sinhala script. Keep technical terms, code variables, library names, and APIs in English.';
  } else if (langMode === 'singlish') {
    return 'You are oska.AI V1. The user is communicating in Singlish (Romanized Sinhala, e.g. "mata me code eka explain krnn"). Respond naturally and conversationally in friendly Singlish (Romanized characters). Do NOT convert into formal Sinhala Unicode script unless explicitly requested. Keep code and technical terminology in English.';
  } else {
    return 'You are oska.AI V1, a thoughtful, articulate, and helpful AI workspace assistant. Provide clear, direct, and well-formatted answers with natural Markdown formatting.';
  }
}

// -------------------------------------------------------------
// 6. Universal Document & File Parsers
// -------------------------------------------------------------
async function parseUploadedFile(file) {
  const fileName = file.name;
  const ext = fileName.split('.').pop().toLowerCase();
  const fileType = file.type;

  // 1. Images
  if (fileType.startsWith('image/')) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve({
          name: fileName,
          type: 'image',
          mimeType: fileType,
          dataUrl: e.target.result,
          base64: e.target.result.split(',')[1],
          textContext: `[Uploaded Image: ${fileName}]`
        });
      };
      reader.readAsDataURL(file);
    });
  }

  // 2. PDF Documents
  if (ext === 'pdf' || fileType === 'application/pdf') {
    try {
      if (typeof pdfjsLib !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let extractedText = '';
        for (let i = 1; i <= Math.min(pdf.numPages, 30); i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map(item => item.str).join(' ');
          extractedText += `\n--- [PDF Page ${i}/${pdf.numPages}] ---\n${pageText}\n`;
        }
        return {
          name: fileName,
          type: 'pdf',
          textContext: `Document [${fileName}] Content (${pdf.numPages} pages):\n${extractedText.slice(0, 40000)}`
        };
      }
    } catch (e) {
      console.warn('PDF parse fallback:', e);
    }
  }

  // 3. Word Documents (.docx)
  if (ext === 'docx') {
    try {
      if (typeof mammoth !== 'undefined') {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        return {
          name: fileName,
          type: 'docx',
          textContext: `Word Document [${fileName}] Content:\n${result.value.slice(0, 40000)}`
        };
      }
    } catch (e) {
      console.warn('DOCX parse fallback:', e);
    }
  }

  // 4. Spreadsheets (.xlsx, .xls, .csv) with Statistical Summaries
  if (['xlsx', 'xls', 'csv'].includes(ext)) {
    try {
      if (typeof XLSX !== 'undefined') {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        let summaryText = `Spreadsheet [${fileName}] Overview:\n`;
        let chartableData = null;

        workbook.SheetNames.forEach((sheetName) => {
          const sheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
          if (jsonData.length > 0) {
            summaryText += `\nSheet: "${sheetName}" (${jsonData.length} rows, ${jsonData[0] ? jsonData[0].length : 0} cols)\n`;
            const previewRows = jsonData.slice(0, 25);
            summaryText += previewRows.map(row => (Array.isArray(row) ? row.join(' | ') : '')).join('\n') + '\n';
            if (!chartableData && jsonData.length > 1) {
              chartableData = { headers: jsonData[0], rows: jsonData.slice(1) };
            }
          }
        });

        return {
          name: fileName,
          type: 'spreadsheet',
          chartData: chartableData,
          textContext: summaryText
        };
      }
    } catch (e) {
      console.warn('Spreadsheet parse fallback:', e);
    }
  }

  // 5. Code, Markdown, JSON, Text
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      resolve({
        name: fileName,
        type: 'text',
        textContext: `Attached File [${fileName}]:\n\`\`\`${ext}\n${text.slice(0, 40000)}\n\`\`\``
      });
    };
    reader.readAsText(file);
  });
}

// -------------------------------------------------------------
// 7. Persistence & Storage Helpers (Isolated Per Google User)
// -------------------------------------------------------------
function getStorageKey() {
  if (!state.user) return null;
  return `oska_conversations_${state.user.uid}`;
}

function loadSavedConversations() {
  const key = getStorageKey();
  if (!key) {
    state.conversations = [];
    return;
  }
  try {
    const saved = localStorage.getItem(key);
    state.conversations = saved ? JSON.parse(saved) : [];
  } catch (e) {
    state.conversations = [];
  }
}

function saveConversationsToStorage() {
  const key = getStorageKey();
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(state.conversations));
  } catch (e) {
    console.warn('Storage save notice:', e);
  }
}

// -------------------------------------------------------------
// 8. Initialization & DOM Setup
// -------------------------------------------------------------
// -------------------------------------------------------------
// 8. Initialization & DOM Setup
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  document.documentElement.setAttribute('data-theme', state.theme);
  updateThemeIcon();

  initFirebase();
  setupUIEventListeners();
  setupSpeechRecognition();
  renderModelPopoverList();
  renderEffortPopoverList();
  renderConversationsList();

  if (typeof hljs !== 'undefined') {
    hljs.configure({ ignoreUnescapedHTML: true });
  }

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
});

// -------------------------------------------------------------
// 9. Authentication Management (Google-Only)
// -------------------------------------------------------------
function setupAuthListeners() {
  if (auth) {
    auth.onAuthStateChanged((user) => {
      state.user = user;
      updateUserProfileUI(user);
      loadSavedConversations();
      renderConversationsList();

      // Check admin privileges
      const adminEmails = ['oshadhaperer@gmail.com', 'cit24010476@gmail.com'];
      const menuAdminBtn = document.getElementById('menuAdminBtn');
      if (menuAdminBtn) {
        menuAdminBtn.style.display = (user && adminEmails.includes(user.email)) ? 'flex' : 'none';
      }
    });
  }

  // Google Sign-In Button inside Modal
  const googleSignInBtn = document.getElementById('googleSignInBtn');
  const googleSignInBtnText = document.getElementById('googleSignInBtnText');
  const closeLoginModalBtn = document.getElementById('closeLoginModalBtn');
  const loginDismissBtn = document.getElementById('loginDismissBtn');

  if (googleSignInBtn) {
    googleSignInBtn.addEventListener('click', async () => {
      if (!auth) {
        showToast('Connecting to authentication service...');
        await initFirebase();
        if (!auth) {
          showToast('Authentication initialization notice. Check connectivity.');
          return;
        }
      }
      try {
        googleSignInBtn.disabled = true;
        if (googleSignInBtnText) googleSignInBtnText.textContent = 'Connecting to Google...';

        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        await auth.signInWithPopup(provider);

        closeAuthModal();
        showToast('Signed in successfully with Google!');
      } catch (err) {
        if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
          // User closed popup
        } else if (err.code === 'auth/unauthorized-domain') {
          console.error('Domain authorization notice:', err);
          showToast('Domain authorization notice: Add domain in Firebase Console.');
        } else {
          console.error('Google Sign-In notice:', err);
          showToast('Unable to sign in with Google. Please try again.');
        }
      } finally {
        googleSignInBtn.disabled = false;
        if (googleSignInBtnText) googleSignInBtnText.textContent = 'Continue with Google';
      }
    });
  }

  if (closeLoginModalBtn) closeLoginModalBtn.addEventListener('click', closeAuthModal);
  if (loginDismissBtn) loginDismissBtn.addEventListener('click', closeAuthModal);

  // Sign out handler
  const menuSignOutBtn = document.getElementById('menuSignOutBtn');
  if (menuSignOutBtn) {
    menuSignOutBtn.addEventListener('click', async () => {
      if (auth) {
        await auth.signOut();
        state.user = null;
        state.conversations = [];
        updateUserProfileUI(null);
        renderConversationsList();
        createNewConversation();
        hideAllPopovers();
        showToast('Signed out of oska.AI');
      }
    });
  }
}

function updateUserProfileUI(user) {
  const userAvatar = document.getElementById('userAvatar');
  const menuUserAvatar = document.getElementById('menuUserAvatar');
  const userDisplayName = document.getElementById('userDisplayName');
  const userEmailText = document.getElementById('userEmailText');
  const menuUserName = document.getElementById('menuUserName');
  const menuUserEmail = document.getElementById('menuUserEmail');
  const menuLoginBtn = document.getElementById('menuLoginBtn');
  const menuSignOutBtn = document.getElementById('menuSignOutBtn');

  if (user) {
    const initial = (user.displayName || user.email || 'U').charAt(0).toUpperCase();
    if (user.photoURL) {
      userAvatar.innerHTML = `<img src="${user.photoURL}" alt="${user.displayName || 'User'}">`;
      menuUserAvatar.innerHTML = `<img src="${user.photoURL}" alt="${user.displayName || 'User'}">`;
    } else {
      userAvatar.textContent = initial;
      menuUserAvatar.textContent = initial;
    }
    userDisplayName.textContent = user.displayName || 'Google Account';
    userEmailText.textContent = user.email || 'Connected';
    menuUserName.textContent = user.displayName || 'Google Account';
    menuUserEmail.textContent = user.email || '';
    if (menuLoginBtn) menuLoginBtn.classList.add('hidden');
    if (menuSignOutBtn) menuSignOutBtn.classList.remove('hidden');
  } else {
    userAvatar.innerHTML = `<i data-lucide="user" style="width: 14px; height: 14px;"></i>`;
    menuUserAvatar.innerHTML = `<i data-lucide="user" style="width: 18px; height: 18px;"></i>`;
    userDisplayName.textContent = 'Sign in';
    userEmailText.textContent = 'Use oska.AI with Google';
    menuUserName.textContent = 'oska.AI Account';
    menuUserEmail.textContent = 'Sign in with Google';
    if (menuLoginBtn) menuLoginBtn.classList.remove('hidden');
    if (menuSignOutBtn) menuSignOutBtn.classList.add('hidden');
  }

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// -------------------------------------------------------------
// 10. UI Events & Interactive Control Bindings
// -------------------------------------------------------------
function setupUIEventListeners() {
  const chatInput = document.getElementById('chatInput');
  const sendBtn = document.getElementById('sendBtn');
  const stopBtn = document.getElementById('stopBtn');
  const newChatBtn = document.getElementById('newChatBtn');
  const headerNewChatBtn = document.getElementById('headerNewChatBtn');
  const brandHomeBtn = document.getElementById('brandHomeBtn');
  const attachBtn = document.getElementById('attachBtn');
  const fileInput = document.getElementById('fileInput');
  const toolsMenuBtn = document.getElementById('toolsMenuBtn');
  const composerLangBtn = document.getElementById('composerLangBtn');
  const composerModelBtn = document.getElementById('composerModelBtn');
  const composerEffortBtn = document.getElementById('composerEffortBtn');
  const userProfileBtn = document.getElementById('userProfileBtn');
  const popoverBackdrop = document.getElementById('popoverBackdrop');
  const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
  const sidebarBackdrop = document.getElementById('sidebarBackdrop');
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const openSettingsBtn = document.getElementById('openSettingsBtn');
  const closeSettingsBtn = document.getElementById('closeSettingsBtn');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const clearAllHistoryBtn = document.getElementById('clearAllHistoryBtn');
  const menuLoginBtn = document.getElementById('menuLoginBtn');
  const menuSettingsBtn = document.getElementById('menuSettingsBtn');
  const menuThemeBtn = document.getElementById('menuThemeBtn');
  const menuAdminBtn = document.getElementById('menuAdminBtn');
  const closeAdminBtn = document.getElementById('closeAdminBtn');

  // Input auto-expand & send button toggle
  chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 180) + 'px';
    sendBtn.disabled = !chatInput.value.trim() && state.attachments.length === 0;
  });

  // Enter to send (Shift+Enter for newline)
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!sendBtn.disabled && !state.isGenerating) {
        handleSendMessage();
      }
    }
  });

  // Global Shortcuts: Escape to close modals, Ctrl+K for new chat
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAuthModal();
      document.getElementById('settingsModal').classList.add('hidden');
      document.getElementById('adminModal').classList.add('hidden');
      hideAllPopovers();
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      createNewConversation();
    }
  });

  sendBtn.addEventListener('click', handleSendMessage);
  stopBtn.addEventListener('click', handleStopGeneration);

  newChatBtn.addEventListener('click', () => {
    if (!state.user && state.conversations.length > 0) {
      openAuthModal();
    } else {
      createNewConversation();
    }
  });

  if (headerNewChatBtn) {
    headerNewChatBtn.addEventListener('click', () => {
      createNewConversation();
    });
  }

  brandHomeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    createNewConversation();
  });

  // Protected File Attachment
  attachBtn.addEventListener('click', () => {
    requireAuth(() => fileInput.click());
  });

  fileInput.addEventListener('change', (e) => {
    requireAuth(() => handleFileUpload(e));
  });

  // Tools Popover
  toolsMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePopover('toolsPopover');
  });

  // Language Popover
  composerLangBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePopover('languagePopover');
  });

  // Language selection buttons
  document.querySelectorAll('#languagePopoverList [data-lang]').forEach(btn => {
    btn.addEventListener('click', () => {
      const lang = btn.getAttribute('data-lang');
      state.responseLanguage = lang;
      document.getElementById('composerLangLabel').textContent = btn.querySelector('.item-title').textContent.split(' ')[0];
      document.querySelectorAll('#languagePopoverList [data-lang]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      hideAllPopovers();
      showToast(`Language set to ${btn.querySelector('.item-title').textContent}`);
    });
  });

  // Model & Reasoning Popovers
  composerModelBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePopover('composerModelPopover');
  });

  composerEffortBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePopover('composerEffortPopover');
  });

  // Profile Button: If unauthenticated, directly open Google login modal; if logged in, open account dropdown
  userProfileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!state.user) {
      openAuthModal();
    } else {
      togglePopover('accountPopover');
    }
  });

  popoverBackdrop.addEventListener('click', hideAllPopovers);

  // Sidebar Toggle (Mobile & Desktop)
  sidebarToggleBtn.addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar');
    if (window.innerWidth <= 768) {
      sidebar.classList.toggle('mobile-open');
      sidebarBackdrop.classList.toggle('hidden', !sidebar.classList.contains('mobile-open'));
    } else {
      sidebar.classList.toggle('collapsed');
    }
  });

  sidebarBackdrop.addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('mobile-open');
    sidebarBackdrop.classList.add('hidden');
  });

  // Theme Toggle
  themeToggleBtn.addEventListener('click', () => {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', state.theme);
    localStorage.setItem('oska_theme', state.theme);
    updateThemeIcon();
  });

  // Settings Modal
  openSettingsBtn.addEventListener('click', () => {
    hideAllPopovers();
    document.getElementById('settingsModal').classList.remove('hidden');
  });
  closeSettingsBtn.addEventListener('click', () => document.getElementById('settingsModal').classList.add('hidden'));
  saveSettingsBtn.addEventListener('click', () => document.getElementById('settingsModal').classList.add('hidden'));

  // Menu Settings & Theme buttons
  if (menuSettingsBtn) {
    menuSettingsBtn.addEventListener('click', () => {
      hideAllPopovers();
      document.getElementById('settingsModal').classList.remove('hidden');
    });
  }

  if (menuThemeBtn) {
    menuThemeBtn.addEventListener('click', () => {
      state.theme = state.theme === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', state.theme);
      localStorage.setItem('oska_theme', state.theme);
      updateThemeIcon();
      hideAllPopovers();
      showToast(`Switched to ${state.theme === 'light' ? 'Light' : 'Dark'} theme`);
    });
  }

  // Admin Console Modal
  if (menuAdminBtn) {
    menuAdminBtn.addEventListener('click', () => {
      hideAllPopovers();
      document.getElementById('adminModal').classList.remove('hidden');
      document.getElementById('metricTotalChats').textContent = state.conversations.length;
    });
  }
  if (closeAdminBtn) {
    closeAdminBtn.addEventListener('click', () => document.getElementById('adminModal').classList.add('hidden'));
  }

  // Clear History
  clearAllHistoryBtn.addEventListener('click', () => {
    if (confirm('Clear all conversation logs and history?')) {
      state.conversations = [];
      saveConversationsToStorage();
      createNewConversation();
      document.getElementById('settingsModal').classList.add('hidden');
      showToast('All conversation history cleared');
    }
  });

  if (menuLoginBtn) {
    menuLoginBtn.addEventListener('click', () => {
      hideAllPopovers();
      openAuthModal();
    });
  }

  // Protected Workspace Tools buttons
  setupWorkspaceToolsButtons();

  // Welcome prompt shortcut chips
  document.querySelectorAll('.shortcut-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const prompt = chip.getAttribute('data-prompt');
      if (prompt) {
        document.getElementById('chatInput').value = prompt;
        document.getElementById('sendBtn').disabled = false;
        handleSendMessage();
      }
    });
  });
}

function updateThemeIcon() {
  const icon = document.getElementById('themeIcon');
  if (icon) {
    icon.setAttribute('data-lucide', state.theme === 'light' ? 'moon' : 'sun');
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
}

// -------------------------------------------------------------
// 11. Popover Management
// -------------------------------------------------------------
function togglePopover(popoverId) {
  const popover = document.getElementById(popoverId);
  const backdrop = document.getElementById('popoverBackdrop');
  const isHidden = popover.classList.contains('hidden');

  hideAllPopovers();

  if (isHidden) {
    popover.classList.remove('hidden');
    backdrop.classList.remove('hidden');
  }
}

function hideAllPopovers() {
  document.querySelectorAll('.composer-popover, .account-popover').forEach(p => p.classList.add('hidden'));
  const backdrop = document.getElementById('popoverBackdrop');
  if (backdrop) backdrop.classList.add('hidden');
}

// -------------------------------------------------------------
// 12. Model & Reasoning Popover Renderers
// -------------------------------------------------------------
function renderModelPopoverList() {
  const container = document.getElementById('modelPopoverList');
  if (!container) return;

  container.innerHTML = DEFAULT_MODELS.map(model => `
    <button type="button" class="popover-item ${model.id === state.selectedModel ? 'active' : ''}" data-model-id="${model.id}">
      <div class="popover-item-left">
        <div>
          <div class="item-title">${model.name}</div>
          <div class="item-desc">${model.tag}</div>
        </div>
      </div>
      <span class="check-icon">✓</span>
    </button>
  `).join('');

  container.querySelectorAll('.popover-item').forEach(btn => {
    const handleSelect = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const modelId = btn.getAttribute('data-model-id');
      selectModel(modelId);
      hideAllPopovers();
    };
    btn.addEventListener('click', handleSelect);
  });
}

function selectModel(modelId) {
  const model = DEFAULT_MODELS.find(m => m.id === modelId) || DEFAULT_MODELS[0];
  state.selectedModel = model.id;

  // Auto-adjust reasoning effort if unsupported by chosen model
  if (model.supportedEfforts && !model.supportedEfforts.includes(state.reasoningEffort)) {
    state.reasoningEffort = model.supportedEfforts[model.supportedEfforts.length - 1] || 'medium';
    const effortConfig = REASONING_EFFORT_CONFIG[state.reasoningEffort] || REASONING_EFFORT_CONFIG['medium'];
    document.getElementById('composerEffortLabel').textContent = effortConfig.label;
  }

  document.getElementById('composerModelLabel').textContent = model.name;
  renderModelPopoverList();
  renderEffortPopoverList();
  showToast(`Active model: ${model.name}`);
}

function renderEffortPopoverList() {
  const container = document.getElementById('effortPopoverList');
  if (!container) return;

  const currentModel = DEFAULT_MODELS.find(m => m.id === state.selectedModel) || DEFAULT_MODELS[0];
  const supported = currentModel.supportedEfforts || ['instant', 'medium', 'high', 'extra-high', 'pro'];

  container.innerHTML = Object.entries(REASONING_EFFORT_CONFIG)
    .filter(([key]) => supported.includes(key))
    .map(([effortKey, config]) => `
      <button type="button" class="popover-item ${effortKey === state.reasoningEffort ? 'active' : ''}" data-effort-key="${effortKey}">
        <div class="popover-item-left">
          <div>
            <div class="item-title">${config.label}</div>
            <div class="item-desc">${config.desc}</div>
          </div>
        </div>
        <span class="check-icon">✓</span>
      </button>
    `).join('');

  container.querySelectorAll('.popover-item').forEach(btn => {
    const handleSelect = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const effortKey = btn.getAttribute('data-effort-key');
      selectEffort(effortKey);
      hideAllPopovers();
    };
    btn.addEventListener('click', handleSelect);
  });
}

function selectEffort(effortKey) {
  state.reasoningEffort = effortKey;
  const config = REASONING_EFFORT_CONFIG[effortKey] || REASONING_EFFORT_CONFIG['medium'];
  document.getElementById('composerEffortLabel').textContent = config.label;
  renderEffortPopoverList();
  showToast(`Reasoning effort: ${config.label}`);
}

// -------------------------------------------------------------
// 13. Workspace Tools & Media Generators (Auth-Protected)
// -------------------------------------------------------------
function setupWorkspaceToolsButtons() {
  const toolWebSearchBtn = document.getElementById('toolWebSearchBtn');
  const toolResearchBtn = document.getElementById('toolResearchBtn');
  const toolDataAnalysisBtn = document.getElementById('toolDataAnalysisBtn');
  const toolCreateImageBtn = document.getElementById('toolCreateImageBtn');
  const toolCreateVideoBtn = document.getElementById('toolCreateVideoBtn');

  if (toolWebSearchBtn) {
    toolWebSearchBtn.addEventListener('click', () => {
      hideAllPopovers();
      if (!requireAuth()) return;
      const input = document.getElementById('chatInput');
      input.value = `/search ${input.value}`.trim() + ' ';
      input.focus();
      showToast('Web Search Mode activated');
    });
  }

  if (toolResearchBtn) {
    toolResearchBtn.addEventListener('click', () => {
      hideAllPopovers();
      if (!requireAuth()) return;
      const input = document.getElementById('chatInput');
      input.value = `/research ${input.value}`.trim() + ' ';
      input.focus();
      showToast('Deep Research Mode activated');
    });
  }

  if (toolDataAnalysisBtn) {
    toolDataAnalysisBtn.addEventListener('click', () => {
      hideAllPopovers();
      if (!requireAuth()) return;
      document.getElementById('fileInput').click();
      showToast('Attach an Excel, CSV, or document for Data Analysis');
    });
  }

  if (toolCreateImageBtn) {
    toolCreateImageBtn.addEventListener('click', () => {
      hideAllPopovers();
      if (!requireAuth()) return;
      const input = document.getElementById('chatInput');
      input.value = `/image a serene minimalist architectural studio in Kyoto during sunset, 8k cinematic lighting`;
      input.focus();
      document.getElementById('sendBtn').disabled = false;
      showToast('Image Generation Prompt prepared');
    });
  }

  if (toolCreateVideoBtn) {
    toolCreateVideoBtn.addEventListener('click', () => {
      hideAllPopovers();
      if (!requireAuth()) return;
      const input = document.getElementById('chatInput');
      input.value = `/video smooth drone flyover of mist-covered pine mountains at dawn`;
      input.focus();
      document.getElementById('sendBtn').disabled = false;
      showToast('AI Video Prompt prepared');
    });
  }
}

// -------------------------------------------------------------
// 14. File Upload Handler & Attachment Bar
// -------------------------------------------------------------
async function handleFileUpload(e) {
  const files = Array.from(e.target.files);
  if (!files.length) return;

  showToast(`Processing ${files.length} file(s)...`);

  for (const file of files) {
    const parsed = await parseUploadedFile(file);
    state.attachments.push(parsed);
  }

  renderAttachmentBar();
  document.getElementById('sendBtn').disabled = false;
  e.target.value = '';
}

function renderAttachmentBar() {
  const bar = document.getElementById('attachmentPreviewBar');
  if (!state.attachments.length) {
    bar.classList.add('hidden');
    bar.innerHTML = '';
    return;
  }

  bar.classList.remove('hidden');
  bar.innerHTML = state.attachments.map((att, idx) => `
    <div class="attachment-chip">
      ${att.type === 'image' ? `<img src="${att.dataUrl}" class="chip-thumb" alt="${att.name}">` : `<i data-lucide="file-text" style="width: 14px; height: 14px;"></i>`}
      <span class="chip-name">${att.name}</span>
      <button type="button" class="chip-remove" onclick="removeAttachment(${idx})">
        <i data-lucide="x" style="width: 12px; height: 12px;"></i>
      </button>
    </div>
  `).join('');

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

window.removeAttachment = function(idx) {
  state.attachments.splice(idx, 1);
  renderAttachmentBar();
  const input = document.getElementById('chatInput');
  document.getElementById('sendBtn').disabled = !input.value.trim() && state.attachments.length === 0;
};

// -------------------------------------------------------------
// 15. Voice Recognition (Speech to Text)
// -------------------------------------------------------------
function setupSpeechRecognition() {
  const micBtn = document.getElementById('voiceMicBtn');
  const badge = document.getElementById('voiceWaveformBadge');
  if (!micBtn) return;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    micBtn.style.display = 'none';
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onstart = () => {
    micBtn.classList.add('listening');
    if (badge) badge.classList.remove('hidden');
  };

  recognition.onresult = (event) => {
    let transcript = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
    }
    const input = document.getElementById('chatInput');
    input.value = transcript;
    input.dispatchEvent(new Event('input'));
  };

  recognition.onend = () => {
    micBtn.classList.remove('listening');
    if (badge) badge.classList.add('hidden');
  };

  recognition.onerror = () => {
    micBtn.classList.remove('listening');
    if (badge) badge.classList.add('hidden');
  };

  micBtn.addEventListener('click', () => {
    if (!requireAuth()) return;
    if (micBtn.classList.contains('listening')) {
      recognition.stop();
    } else {
      try {
        recognition.start();
      } catch (err) {
        console.warn('Speech recognition notice:', err);
      }
    }
  });
}

// -------------------------------------------------------------
// 16. Conversation Management & Rendering
// -------------------------------------------------------------
function createNewConversation() {
  state.activeConversationId = null;
  state.attachments = [];
  renderAttachmentBar();

  const welcomeScreen = document.getElementById('welcomeScreen');
  const container = document.getElementById('conversationContainer');
  const title = document.getElementById('headerChatTitle');

  welcomeScreen.classList.remove('hidden');
  container.classList.add('hidden');
  container.innerHTML = '';
  title.textContent = 'New chat';

  document.getElementById('chatInput').value = '';
  document.getElementById('chatInput').focus();
  document.getElementById('sendBtn').disabled = true;

  document.querySelectorAll('.chat-item').forEach(item => item.classList.remove('active'));
}

function renderConversationsList() {
  const listContainer = document.getElementById('sidebarHistory');
  if (!listContainer) return;

  if (!state.user) {
    listContainer.innerHTML = `
      <div class="sidebar-auth-hint" onclick="openAuthModal()">
        <i data-lucide="lock" style="width: 16px; height: 16px; margin-bottom: 2px;"></i>
        <span style="font-weight: 500;">Sign in to view your chats</span>
        <span style="font-size: 0.72rem; color: var(--text-muted);">Sync across all your devices</span>
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }

  if (!state.conversations.length) {
    listContainer.innerHTML = `<div style="padding: 1.5rem 0.5rem; text-align: center; color: var(--text-muted); font-size: 0.8rem;">No conversations yet</div>`;
    return;
  }

  listContainer.innerHTML = `
    <div class="history-group-title">Recent Chats</div>
    ${state.conversations.map(conv => `
      <div class="chat-item ${conv.id === state.activeConversationId ? 'active' : ''}" data-conv-id="${conv.id}">
        <span class="chat-item-title">${escapeHtml(conv.title || 'Conversation')}</span>
        <div class="chat-item-actions">
          <button type="button" class="chat-action-btn delete" onclick="event.stopPropagation(); deleteConversation('${conv.id}')" title="Delete">
            <i data-lucide="trash-2" style="width: 13px; height: 13px;"></i>
          </button>
        </div>
      </div>
    `).join('')}
  `;

  listContainer.querySelectorAll('.chat-item').forEach(item => {
    item.addEventListener('click', () => {
      const convId = item.getAttribute('data-conv-id');
      loadConversation(convId);
    });
  });

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function loadConversation(convId) {
  const conv = state.conversations.find(c => c.id === convId);
  if (!conv) return;

  state.activeConversationId = convId;
  document.getElementById('headerChatTitle').textContent = conv.title || 'Conversation';
  document.getElementById('welcomeScreen').classList.add('hidden');
  const container = document.getElementById('conversationContainer');
  container.classList.remove('hidden');
  container.innerHTML = '';

  conv.messages.forEach(msg => {
    appendMessageToDOM(msg.role, msg.content, msg.reasoning, msg.media, msg.citations, msg.chart);
  });

  renderConversationsList();
  scrollChatToBottom();
}

window.deleteConversation = function(convId) {
  state.conversations = state.conversations.filter(c => c.id !== convId);
  saveConversationsToStorage();
  if (state.activeConversationId === convId) {
    createNewConversation();
  } else {
    renderConversationsList();
  }
  showToast('Conversation deleted');
};

// -------------------------------------------------------------
// 17. Chat Streaming & Execution Flow (Auth Gate Protected)
// -------------------------------------------------------------
async function handleSendMessage() {
  const input = document.getElementById('chatInput');
  const prompt = input.value.trim();
  const currentAttachments = [...state.attachments];

  if (!prompt && !currentAttachments.length) return;
  if (state.isGenerating) return;

  // 1. Strict Auth Gate: If unauthenticated, open login modal and PRESERVE the prompt in chatInput!
  if (!requireAuth()) {
    return;
  }

  // Clear composer only after auth passes
  input.value = '';
  input.style.height = 'auto';
  state.attachments = [];
  renderAttachmentBar();
  document.getElementById('sendBtn').disabled = true;

  // Ensure active conversation
  let conv = state.conversations.find(c => c.id === state.activeConversationId);
  if (!conv) {
    conv = {
      id: 'conv_' + Date.now(),
      title: prompt.slice(0, 32) || 'Document Analysis',
      createdAt: new Date().toISOString(),
      messages: []
    };
    state.conversations.unshift(conv);
    state.activeConversationId = conv.id;
  }

  // Switch from welcome screen
  document.getElementById('welcomeScreen').classList.add('hidden');
  document.getElementById('conversationContainer').classList.remove('hidden');
  document.getElementById('headerChatTitle').textContent = conv.title;

  // Format prompt with attached context
  let finalUserPrompt = prompt;
  let hasSpreadsheet = false;
  let chartData = null;

  if (currentAttachments.length) {
    const fileContexts = currentAttachments.map(att => {
      if (att.chartData) {
        hasSpreadsheet = true;
        chartData = att.chartData;
      }
      return att.textContext || `[Attached: ${att.name}]`;
    }).join('\n\n');
    finalUserPrompt = `${prompt}\n\n[FILE CONTEXT]:\n${fileContexts}`.trim();
  }

  // Render User Message
  conv.messages.push({ role: 'user', content: prompt, attachments: currentAttachments.map(a => a.name) });
  appendMessageToDOM('user', prompt, null, null, null, null);
  saveConversationsToStorage();
  renderConversationsList();

  // Create Assistant Message Placeholder with thinking indicator
  const assistantBubbleId = 'msg_' + Date.now();
  const assistantRow = appendMessageToDOM('assistant', '', '', null, null, null, assistantBubbleId);
  const bubbleContent = assistantRow.querySelector('.message-bubble');

  // Determine initial contextual status based on prompt, attachments, and effort
  const initialStatus = getContextualStatus(prompt, currentAttachments, state.reasoningEffort);

  // Show the thinking indicator immediately
  showThinkingIndicator(bubbleContent, initialStatus);
  setGeneratingState(true);
  state.generationPhase = 'queued';

  // Handle Slash Commands (/image, /video)
  if (prompt.startsWith('/image ')) {
    updateThinkingStatus(bubbleContent, 'Creating your image…');
    await handleImageGeneration(prompt.replace('/image ', ''), bubbleContent, conv);
    state.generationPhase = 'completed';
    setGeneratingState(false);
    return;
  }

  if (prompt.startsWith('/video ')) {
    updateThinkingStatus(bubbleContent, 'Generating your video…');
    await handleVideoGeneration(prompt.replace('/video ', ''), bubbleContent, conv);
    state.generationPhase = 'completed';
    setGeneratingState(false);
    return;
  }

  // Multilingual System Prompt Preparation
  const systemPrompt = buildLanguageSystemPrompt(prompt, state.responseLanguage);

  // API Streaming Request with 35s timeout
  state.abortController = new AbortController();
  let assistantText = '';
  let reasoningText = '';
  let streamStarted = false;
  const timeoutId = setTimeout(() => {
    if (state.abortController) {
      state.abortController.abort();
    }
  }, 35000);

  // Slow-provider safeguard: if still thinking after 8s, update status
  const slowTimerId = setTimeout(() => {
    if (state.generationPhase === 'thinking' || state.generationPhase === 'queued') {
      updateThinkingStatus(bubbleContent, 'Still working…');
    }
  }, 8000);

  try {
    state.generationPhase = 'thinking';
    const messagesPayload = [
      { role: 'system', content: systemPrompt },
      ...conv.messages.slice(-8).map(m => ({ role: m.role, content: m.content }))
    ];

    const imageAttachment = currentAttachments.find(a => a.type === 'image');
    let inlineImage = imageAttachment ? { mimeType: imageAttachment.mimeType, base64: imageAttachment.base64 } : null;

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.user ? state.user.uid : ''}`
      },
      body: JSON.stringify({
        messages: messagesPayload,
        model: state.selectedModel,
        reasoningEffort: state.reasoningEffort,
        inlineImage: inlineImage,
        stream: true
      }),
      signal: state.abortController.signal
    });

    clearTimeout(timeoutId);
    clearTimeout(slowTimerId);

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson.error?.message || `API returned status ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';

    // If server returned direct JSON (non-streaming)
    if (contentType.includes('application/json')) {
      const json = await response.json();
      assistantText = json.choices?.[0]?.message?.content || json.content || '';
      reasoningText = json.choices?.[0]?.message?.reasoning_content || json.reasoning || '';
      transitionToStreaming(bubbleContent);
      streamStarted = true;
      state.generationPhase = 'streaming';
      updateAssistantMessageDOM(bubbleContent, assistantText, reasoningText, true);
      scrollChatToBottom();
    } else {
      // SSE Streaming Reader
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const raw = line.slice(6).trim();
            if (raw === '[DONE]') continue;
            try {
              const data = JSON.parse(raw);

              // Handle status events from the server
              if (data.type === 'status') {
                state.generationPhase = data.status;
                if (data.status === 'thinking') {
                  updateThinkingStatus(bubbleContent, initialStatus);
                } else if (data.status === 'analyzing') {
                  updateThinkingStatus(bubbleContent, 'Analyzing…');
                } else if (data.status === 'searching-web') {
                  updateThinkingStatus(bubbleContent, 'Searching the web…');
                } else if (data.status === 'reading-file') {
                  updateThinkingStatus(bubbleContent, 'Reading the file…');
                } else if (data.status === 'analyzing-data') {
                  updateThinkingStatus(bubbleContent, 'Analyzing the data…');
                } else if (data.status === 'streaming' && !streamStarted) {
                  transitionToStreaming(bubbleContent);
                  streamStarted = true;
                }
                continue;
              }

              if (data.type === 'text') {
                if (!streamStarted) {
                  transitionToStreaming(bubbleContent);
                  streamStarted = true;
                  state.generationPhase = 'streaming';
                }
                assistantText += data.content;
                updateAssistantMessageDOM(bubbleContent, assistantText, reasoningText, true);
              } else if (data.type === 'reasoning') {
                reasoningText += data.content;
                // Don't expose reasoning to UI, but store it
              }
            } catch (e) {
              if (!streamStarted) {
                transitionToStreaming(bubbleContent);
                streamStarted = true;
                state.generationPhase = 'streaming';
              }
              assistantText += raw;
              updateAssistantMessageDOM(bubbleContent, assistantText, reasoningText, true);
            }
          } else if (line.trim() && !line.startsWith(':')) {
            try {
              const data = JSON.parse(line.trim());
              if (data.choices?.[0]?.message?.content) {
                if (!streamStarted) {
                  transitionToStreaming(bubbleContent);
                  streamStarted = true;
                  state.generationPhase = 'streaming';
                }
                assistantText = data.choices[0].message.content;
                updateAssistantMessageDOM(bubbleContent, assistantText, reasoningText, true);
              }
            } catch (_) {}
          }
        }
        scrollChatToBottom();
      }
    }

    if (!assistantText.trim()) {
      assistantText = 'I am ready to assist with your questions, code, and analysis.';
      if (!streamStarted) transitionToStreaming(bubbleContent);
      updateAssistantMessageDOM(bubbleContent, assistantText, reasoningText, false);
    } else {
      // Remove streaming cursor from final message
      updateAssistantMessageDOM(bubbleContent, assistantText, reasoningText, false);
    }

    // Chart Generation for Spreadsheets
    let generatedChart = null;
    if (hasSpreadsheet && chartData && (prompt.toLowerCase().includes('chart') || prompt.toLowerCase().includes('graph') || prompt.toLowerCase().includes('visualize') || prompt.toLowerCase().includes('revenue'))) {
      generatedChart = renderSpreadsheetChart(bubbleContent, chartData);
    }

    conv.messages.push({
      role: 'assistant',
      content: assistantText,
      reasoning: reasoningText,
      chart: generatedChart
    });

    state.generationPhase = 'completed';
    saveConversationsToStorage();

  } catch (err) {
    clearTimeout(timeoutId);
    clearTimeout(slowTimerId);
    if (err.name === 'AbortError') {
      state.generationPhase = 'cancelled';
      showToast('Generation stopped');
      if (!streamStarted || !assistantText.trim()) {
        showThinkingError(bubbleContent, 'Request timed out or was cancelled.', prompt);
      } else {
        updateAssistantMessageDOM(bubbleContent, assistantText, reasoningText, false);
      }
    } else {
      state.generationPhase = 'failed';
      console.error('Chat error:', err);
      showThinkingError(bubbleContent, err.message || 'Check model availability', prompt);
    }
  } finally {
    clearTimeout(timeoutId);
    clearTimeout(slowTimerId);
    setGeneratingState(false);
  }
}

function handleStopGeneration() {
  if (state.abortController) {
    state.abortController.abort();
    state.abortController = null;
  }
  setGeneratingState(false);
}

function setGeneratingState(isGenerating) {
  state.isGenerating = isGenerating;
  const sendBtn = document.getElementById('sendBtn');
  const stopBtn = document.getElementById('stopBtn');

  if (isGenerating) {
    sendBtn.classList.add('hidden');
    stopBtn.classList.remove('hidden');
  } else {
    sendBtn.classList.remove('hidden');
    stopBtn.classList.add('hidden');
    if (state.generationPhase !== 'streaming') {
      state.generationPhase = 'idle';
    }
    const input = document.getElementById('chatInput');
    sendBtn.disabled = !input.value.trim() && state.attachments.length === 0;
  }
}

// -------------------------------------------------------------
// 17b. oska.AI Premium Thinking Indicator System
// -------------------------------------------------------------

/**
 * Determine the initial contextual status label based on prompt content,
 * attachments, and reasoning effort. Uses REAL context, not fake timers.
 */
function getContextualStatus(prompt, attachments, effort) {
  const p = prompt.toLowerCase();

  // Slash commands
  if (p.startsWith('/search ') || p.startsWith('/web ')) return 'Searching the web…';
  if (p.startsWith('/research ')) return 'Researching sources…';
  if (p.startsWith('/image ')) return 'Creating your image…';
  if (p.startsWith('/video ')) return 'Generating your video…';

  // Attachment-based status
  if (attachments.length > 0) {
    const hasImage = attachments.some(a => a.type === 'image');
    const hasSpreadsheet = attachments.some(a => a.chartData || (a.name && /\.(xlsx|csv|xls)$/i.test(a.name)));
    const hasPDF = attachments.some(a => a.name && /\.pdf$/i.test(a.name));
    if (hasImage) return 'Looking at the image…';
    if (hasSpreadsheet) return 'Analyzing the spreadsheet…';
    if (hasPDF) return `Reading ${attachments.find(a => /\.pdf$/i.test(a.name))?.name || 'the document'}…`;
    return `Reading ${attachments[0]?.name || 'the file'}…`;
  }

  // Code-related prompts
  if (p.includes('code') || p.includes('debug') || p.includes('function') || p.includes('algorithm') || p.includes('error') || p.includes('bug')) {
    return effort === 'high' || effort === 'extra-high' || effort === 'pro' ? 'Analyzing…' : 'Thinking…';
  }

  // Reasoning effort-based
  if (effort === 'instant') return 'Thinking…';
  if (effort === 'medium') return 'Thinking…';
  if (effort === 'high') return 'Analyzing…';
  if (effort === 'extra-high' || effort === 'pro') return 'Analyzing your request…';

  return 'Thinking…';
}

/**
 * Render the oska.AI thinking indicator inside the assistant bubble.
 * This replaces the empty bubble content with the branded indicator.
 */
function showThinkingIndicator(bubbleElement, statusText) {
  const useShimmer = state.reasoningEffort !== 'instant';
  bubbleElement.innerHTML = `
    <div class="oska-thinking" id="oskaThinkingIndicator">
      <div class="oska-thinking-mark">O</div>
      <div class="oska-thinking-status${useShimmer ? ' shimmer' : ''}">
        <span class="oska-thinking-label">${escapeHtml(statusText)}</span>
        <span class="oska-thinking-dots"><span></span><span></span><span></span></span>
      </div>
    </div>
  `;
}

/**
 * Smoothly update the thinking status label with a fade transition.
 */
function updateThinkingStatus(bubbleElement, newStatus) {
  const label = bubbleElement.querySelector('.oska-thinking-label');
  if (!label) return;
  if (label.textContent === newStatus) return;

  label.classList.add('fading');
  setTimeout(() => {
    label.textContent = newStatus;
    label.classList.remove('fading');
  }, 180);
}

/**
 * Transition from thinking indicator to streaming content.
 * Dissolves the indicator, then shows the response mark + content area.
 */
function transitionToStreaming(bubbleElement) {
  const indicator = bubbleElement.querySelector('#oskaThinkingIndicator');
  if (indicator) {
    indicator.classList.add('dissolving');
    setTimeout(() => {
      indicator.remove();
    }, 250);
  }
}

/**
 * Show an error state where the thinking indicator was, with a Retry button.
 */
function showThinkingError(bubbleElement, message, originalPrompt) {
  bubbleElement.innerHTML = `
    <div class="oska-thinking">
      <div class="oska-thinking-mark" style="animation: none; opacity: 0.5;">O</div>
      <div class="oska-thinking-error">
        <span>Couldn't generate a response. ${escapeHtml(message)}</span>
        <button type="button" class="oska-retry-btn" onclick="retryLastMessage()">Retry</button>
      </div>
    </div>
  `;
}

/** Retry the last user message */
window.retryLastMessage = function() {
  const conv = state.conversations.find(c => c.id === state.activeConversationId);
  if (!conv || conv.messages.length === 0) return;

  // Find the last user message
  const lastUserMsg = [...conv.messages].reverse().find(m => m.role === 'user');
  if (!lastUserMsg) return;

  // Remove the failed assistant message from DOM (last .message-row.assistant)
  const container = document.getElementById('conversationContainer');
  const lastAssistantRow = container?.querySelector('.message-row.assistant:last-child');
  if (lastAssistantRow) lastAssistantRow.remove();

  // Remove the failed assistant message from conversation data (if it exists)
  if (conv.messages[conv.messages.length - 1]?.role === 'assistant') {
    conv.messages.pop();
  }
  // Also remove the user message so handleSendMessage re-adds it
  conv.messages.pop();

  // Remove the user message row from DOM
  const lastUserRow = container?.querySelector('.message-row.user:last-child');
  if (lastUserRow) lastUserRow.remove();

  // Re-send
  const input = document.getElementById('chatInput');
  input.value = lastUserMsg.content;
  handleSendMessage();
};

// -------------------------------------------------------------
// 18. Image & Video Generation Handlers
// -------------------------------------------------------------
async function handleImageGeneration(prompt, bubbleElement, conv) {
  bubbleElement.innerHTML = `<p>🎨 <em>Creating high-resolution visual for: "${escapeHtml(prompt)}"...</em></p>`;
  try {
    const res = await fetch('/api/images/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.user ? state.user.uid : ''}`
      },
      body: JSON.stringify({ prompt })
    });
    const data = await res.json();
    if (data.imageUrl) {
      bubbleElement.innerHTML = `
        <p>Generated image for: <strong>${escapeHtml(prompt)}</strong></p>
        <div class="ai-media-card">
          <img src="${data.imageUrl}" alt="${escapeHtml(prompt)}">
          <div class="ai-media-footer">
            <span>oska.AI Diffusion Engine</span>
            <a href="${data.imageUrl}" target="_blank" download="oska-image.png" class="media-action-btn">
              <i data-lucide="download" style="width: 12px; height: 12px;"></i> Download
            </a>
          </div>
        </div>
      `;
      conv.messages.push({ role: 'assistant', content: `Generated image for: ${prompt}`, media: { type: 'image', url: data.imageUrl } });
      saveConversationsToStorage();
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
  } catch (err) {
    bubbleElement.innerHTML = `<p style="color: #ef4444;">Image generation notice: ${escapeHtml(err.message)}</p>`;
  }
}

async function handleVideoGeneration(prompt, bubbleElement, conv) {
  bubbleElement.innerHTML = `<p>🎬 <em>Generating cinematic motion shot for: "${escapeHtml(prompt)}"...</em></p>`;
  try {
    const res = await fetch('/api/videos/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.user ? state.user.uid : ''}`
      },
      body: JSON.stringify({ prompt })
    });
    const data = await res.json();
    if (data.videoUrl) {
      bubbleElement.innerHTML = `
        <p>Generated cinematic shot for: <strong>${escapeHtml(prompt)}</strong></p>
        <div class="ai-media-card">
          <img src="${data.videoUrl}" alt="${escapeHtml(prompt)}">
          <div class="ai-media-footer">
            <span>oska.AI Motion Engine · 1080p Cinematic</span>
            <a href="${data.videoUrl}" target="_blank" class="media-action-btn">
              <i data-lucide="play" style="width: 12px; height: 12px;"></i> Full Preview
            </a>
          </div>
        </div>
      `;
      conv.messages.push({ role: 'assistant', content: `Generated video for: ${prompt}`, media: { type: 'video', url: data.videoUrl } });
      saveConversationsToStorage();
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
  } catch (err) {
    bubbleElement.innerHTML = `<p style="color: #ef4444;">Video generation notice: ${escapeHtml(err.message)}</p>`;
  }
}

// -------------------------------------------------------------
// 19. DOM Rendering & Chart Creation
// -------------------------------------------------------------
function appendMessageToDOM(role, content, reasoning, media, citations, chart, rowId) {
  const container = document.getElementById('conversationContainer');
  const row = document.createElement('div');
  row.className = `message-row ${role}`;
  if (rowId) row.id = rowId;

  let renderedHTML = '';

  if (reasoning) {
    renderedHTML += `
      <div class="reasoning-box">
        <div class="reasoning-header" onclick="this.parentElement.classList.toggle('collapsed')">
          <span>💭 Thought Process & Reasoning</span>
          <i data-lucide="chevron-down" style="width: 14px; height: 14px;"></i>
        </div>
        <div class="reasoning-content">${escapeHtml(reasoning)}</div>
      </div>
    `;
  }

  renderedHTML += renderMarkdown(content);

  if (media && media.url) {
    renderedHTML += `
      <div class="ai-media-card">
        <img src="${media.url}" alt="AI generated content">
      </div>
    `;
  }

  row.innerHTML = `
    <div class="message-bubble">${renderedHTML}</div>
    <div class="message-actions">
      <button type="button" class="msg-action-btn" onclick="copyMessageText(this)" title="Copy message">
        <i data-lucide="copy" style="width: 13px; height: 13px;"></i> Copy
      </button>
    </div>
  `;

  container.appendChild(row);
  scrollChatToBottom();

  if (typeof lucide !== 'undefined') lucide.createIcons();
  return row;
}

function updateAssistantMessageDOM(bubbleElement, text, reasoning, isStreaming) {
  let html = '';

  // Small oska.AI mark at top of response
  html += '<div class="oska-response-mark">O</div>';

  if (reasoning) {
    html += `
      <div class="reasoning-box">
        <div class="reasoning-header" onclick="this.parentElement.classList.toggle('collapsed')">
          <span>💭 Thinking (${reasoning.length} chars)</span>
          <i data-lucide="chevron-down" style="width: 14px; height: 14px;"></i>
        </div>
        <div class="reasoning-content">${escapeHtml(reasoning)}</div>
      </div>
    `;
  }

  html += '<div class="oska-stream-content">';
  html += renderMarkdown(text);
  // Show streaming cursor while actively streaming
  if (isStreaming) {
    html += '<span class="oska-stream-cursor"></span>';
  }
  html += '</div>';

  bubbleElement.innerHTML = html;
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderSpreadsheetChart(bubbleElement, chartData) {
  try {
    const chartId = 'chart_' + Date.now();
    const chartCard = document.createElement('div');
    chartCard.className = 'ai-chart-card';
    chartCard.innerHTML = `
      <div class="ai-chart-header">
        <i data-lucide="bar-chart-2" style="width: 16px; height: 16px; color: var(--accent-primary);"></i>
        <span>Interactive Data Visualization</span>
      </div>
      <div class="chart-canvas-wrapper">
        <canvas id="${chartId}"></canvas>
      </div>
    `;
    bubbleElement.appendChild(chartCard);

    const labels = chartData.rows.slice(0, 8).map(r => String(r[0] || ''));
    const values = chartData.rows.slice(0, 8).map(r => Number(r[1]) || 0);

    setTimeout(() => {
      const ctx = document.getElementById(chartId);
      if (ctx && typeof Chart !== 'undefined') {
        new Chart(ctx, {
          type: 'bar',
          data: {
            labels: labels,
            datasets: [{
              label: chartData.headers[1] || 'Values',
              data: values,
              backgroundColor: 'rgba(194, 65, 12, 0.7)',
              borderColor: '#c2410c',
              borderWidth: 1,
              borderRadius: 4
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: true } }
          }
        });
      }
    }, 100);

    return true;
  } catch (e) {
    console.warn('Chart render notice:', e);
    return false;
  }
}

// -------------------------------------------------------------
// 20. Markdown & Code Block Formatter
// -------------------------------------------------------------
function renderMarkdown(content) {
  if (!content) return '';
  if (typeof marked !== 'undefined') {
    return marked.parse(content);
  }
  return `<p>${escapeHtml(content).replace(/\n/g, '<br>')}</p>`;
}

window.copyMessageText = function(btn) {
  const bubble = btn.closest('.message-row').querySelector('.message-bubble');
  const text = bubble ? bubble.innerText : '';
  navigator.clipboard.writeText(text);
  showToast('Copied to clipboard');
};

function scrollChatToBottom() {
  const area = document.getElementById('chatScrollArea');
  if (area) {
    area.scrollTop = area.scrollHeight;
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// -------------------------------------------------------------
// 21. Toast Notifications
// -------------------------------------------------------------
function showToast(message) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<i data-lucide="check" style="width: 14px; height: 14px;"></i> <span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  if (typeof lucide !== 'undefined') lucide.createIcons();

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 200);
  }, 2800);
}
