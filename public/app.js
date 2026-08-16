/**
 * oska.AI V1 — Production Client Architecture
 * Direct Interactive Composer Model & Reasoning Controls
 */

// Model Registry
const DEFAULT_MODELS = [
  {
    id: 'gemini-3.7-flash',
    provider: 'gemini',
    name: 'Gemini 3.7 Flash',
    tag: 'Google · Vision · Reasoning',
    badge: 'Recommended',
    capabilities: { vision: true, reasoning: true, streaming: true },
    supportedEfforts: ['instant', 'medium', 'high', 'extra-high', 'pro']
  },
  {
    id: 'gemini-3.5-flash',
    provider: 'gemini',
    name: 'Gemini 3.5 Flash',
    tag: 'Google · Fast Throughput',
    capabilities: { vision: true, reasoning: true, streaming: true },
    supportedEfforts: ['instant', 'medium', 'high']
  },
  {
    id: 'llama-3.3-70b-versatile',
    provider: 'groq',
    name: 'Llama 3.3 70B',
    tag: 'Groq LPU · Ultra Fast',
    badge: 'Ultra Fast',
    capabilities: { vision: false, reasoning: true, streaming: true },
    supportedEfforts: ['instant', 'medium', 'high']
  },
  {
    id: 'qwen/qwen3.6-27b',
    provider: 'groq',
    name: 'Qwen 3.6 Reasoner',
    tag: 'Groq LPU · Math & Logic',
    capabilities: { vision: false, reasoning: true, streaming: true },
    supportedEfforts: ['instant', 'medium', 'high', 'extra-high', 'pro']
  },
  {
    id: 'openrouter/free',
    provider: 'openrouter',
    name: 'OpenRouter Hub',
    tag: 'Universal AI Router',
    capabilities: { vision: true, reasoning: true, streaming: true },
    supportedEfforts: ['instant', 'medium', 'high']
  },
  {
    id: 'gpt-4o',
    provider: 'openai',
    name: 'GPT-4o',
    tag: 'OpenAI · Flagship Multimodal',
    capabilities: { vision: true, reasoning: true, streaming: true },
    supportedEfforts: ['instant', 'medium', 'high']
  },
  {
    id: 'deepseek-reasoner',
    provider: 'deepseek',
    name: 'DeepSeek R1',
    tag: 'DeepSeek · Chain-of-Thought',
    capabilities: { vision: false, reasoning: true, streaming: true },
    supportedEfforts: ['instant', 'medium', 'high', 'extra-high', 'pro']
  }
];

// Reasoning Effort Metadata
const EFFORT_LEVELS = {
  'instant': {
    name: 'Instant',
    desc: 'Fastest responses with minimal additional reasoning.'
  },
  'medium': {
    name: 'Medium',
    desc: 'Balanced response speed and logical reasoning.'
  },
  'high': {
    name: 'High',
    desc: 'More comprehensive reasoning for complex questions.'
  },
  'extra-high': {
    name: 'Extra High',
    desc: 'Deeper step-by-step reasoning for difficult tasks.'
  },
  'pro': {
    name: 'Pro',
    desc: 'Maximum reasoning depth for advanced problems.'
  }
};

// Persona System
const PERSONAS = {
  general: {
    name: 'General Assistant',
    prompt: 'You are oska.AI, a calm, intelligent, and highly capable AI assistant. Answer queries directly with clarity, nuance, and precision.'
  },
  coder: {
    name: 'Software Engineer',
    prompt: 'You are an expert Principal Software Engineer. Provide clean, modular, production-ready, and secure code with clear architectural explanations.'
  },
  academic: {
    name: 'Academic Researcher',
    prompt: 'You are an Academic Research Assistant. Provide rigorous, structured explanations with scientific accuracy and objective analysis.'
  },
  creative: {
    name: 'Creative Writer',
    prompt: 'You are an imaginative and expressive creative writer. Provide engaging, literary prose and compelling ideas.'
  }
};

class OskaAIApp {
  constructor() {
    const legacyChats = this.loadStorage('aistudio_conversations_v4', null);
    this.conversations = this.loadStorage('oska_conversations_v1', legacyChats || []);
    
    this.currentChatId = null;
    this.activeModel = this.loadStorage('oska_model', 'gemini-3.7-flash');
    this.activePersona = this.loadStorage('oska_persona', 'general');
    this.theme = this.loadStorage('oska_theme', 'light');
    this.effortLevel = this.loadStorage('oska_effort', 'extra-high');
    this.isGenerating = false;
    this.abortController = null;
    this.pendingAttachments = [];

    this.initDOM();
    this.applyTheme(this.theme);
    this.setupMarkdown();
    this.bindEvents();
    this.renderSidebar();
    this.updateControlsUI();
    this.updateGreeting();
    this.updatePageTitle();
  }

  // -------------------------------------------------------------
  // Storage & State Helpers
  // -------------------------------------------------------------
  loadStorage(key, fallback) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  saveStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {}
  }

  // -------------------------------------------------------------
  // DOM Initialization
  // -------------------------------------------------------------
  initDOM() {
    this.sidebar = document.getElementById('sidebar');
    this.sidebarBackdrop = document.getElementById('sidebarBackdrop');
    this.sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
    this.sidebarHistory = document.getElementById('sidebarHistory');
    this.sidebarSearchInput = document.getElementById('sidebarSearchInput');
    this.newChatBtn = document.getElementById('newChatBtn');
    this.headerNewChatBtn = document.getElementById('headerNewChatBtn');
    this.brandHomeBtn = document.getElementById('brandHomeBtn');
    this.headerChatTitle = document.getElementById('headerChatTitle');

    this.chatScrollArea = document.getElementById('chatScrollArea');
    this.welcomeScreen = document.getElementById('welcomeScreen');
    this.welcomeGreeting = document.getElementById('welcomeGreeting');
    this.conversationContainer = document.getElementById('conversationContainer');

    this.composerBox = document.getElementById('composerBox');
    this.chatInput = document.getElementById('chatInput');
    this.sendBtn = document.getElementById('sendBtn');
    this.stopBtn = document.getElementById('stopBtn');
    this.attachBtn = document.getElementById('attachBtn');
    this.fileInput = document.getElementById('fileInput');
    this.attachmentPreviewBar = document.getElementById('attachmentPreviewBar');

    // Independent Composer Control Buttons
    this.composerModelBtn = document.getElementById('composerModelBtn');
    this.composerModelLabel = document.getElementById('composerModelLabel');
    this.composerModelPopover = document.getElementById('composerModelPopover');
    this.modelPopoverList = document.getElementById('modelPopoverList');

    this.composerEffortBtn = document.getElementById('composerEffortBtn');
    this.composerEffortLabel = document.getElementById('composerEffortLabel');
    this.composerEffortPopover = document.getElementById('composerEffortPopover');
    this.effortPopoverList = document.getElementById('effortPopoverList');

    this.popoverBackdrop = document.getElementById('popoverBackdrop');

    // Voice Input Elements
    this.voiceMicBtn = document.getElementById('voiceMicBtn');
    this.voiceWaveformBadge = document.getElementById('voiceWaveformBadge');
    this.recognition = null;
    this.isListening = false;

    // Tools & Settings
    this.toolsMenuBtn = document.getElementById('toolsMenuBtn');
    this.toolsPopover = document.getElementById('toolsPopover');
    this.toolWebSearchBtn = document.getElementById('toolWebSearchBtn');
    this.toolCreateImageBtn = document.getElementById('toolCreateImageBtn');
    this.toolCreateVideoBtn = document.getElementById('toolCreateVideoBtn');

    this.themeToggleBtn = document.getElementById('themeToggleBtn');
    this.themeIcon = document.getElementById('themeIcon');
    this.openSettingsBtn = document.getElementById('openSettingsBtn');
    this.closeSettingsBtn = document.getElementById('closeSettingsBtn');
    this.saveSettingsBtn = document.getElementById('saveSettingsBtn');
    this.settingsModal = document.getElementById('settingsModal');
    this.themeSelect = document.getElementById('themeSelect');
    this.defaultModelSelect = document.getElementById('defaultModelSelect');
    this.clearAllHistoryBtn = document.getElementById('clearAllHistoryBtn');
    this.toastContainer = document.getElementById('toastContainer');

    this.initVoiceRecognition();
  }

  // -------------------------------------------------------------
  // Markdown & Highlight Setup
  // -------------------------------------------------------------
  setupMarkdown() {
    if (window.marked) {
      marked.setOptions({
        highlight: (code, lang) => {
          if (window.hljs) {
            const language = hljs.getLanguage(lang) ? lang : 'plaintext';
            return hljs.highlight(code, { language }).value;
          }
          return code;
        },
        breaks: true,
        gfm: true
      });
    }
  }

  // -------------------------------------------------------------
  // Theme Management
  // -------------------------------------------------------------
  applyTheme(theme) {
    this.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    this.saveStorage('oska_theme', theme);
    if (this.themeSelect) this.themeSelect.value = theme;
    if (this.themeIcon) {
      this.themeIcon.setAttribute('data-lucide', theme === 'dark' ? 'sun' : 'moon');
      this.refreshIcons();
    }
  }

  // -------------------------------------------------------------
  // Smart Greeting & Page Title
  // -------------------------------------------------------------
  updateGreeting() {
    if (!this.welcomeGreeting) return;
    const hour = new Date().getHours();
    let timeGreeting = 'What would you like to explore today?';
    if (hour < 12) timeGreeting = 'Good morning. What can I help with?';
    else if (hour < 18) timeGreeting = 'Good afternoon. How can I assist?';
    else timeGreeting = 'Good evening. What would you like to work on?';
    this.welcomeGreeting.textContent = timeGreeting;
  }

  updatePageTitle() {
    const chat = this.conversations.find(c => c.id === this.currentChatId);
    if (chat && chat.title) {
      document.title = `${chat.title} | oska.AI`;
      if (this.headerChatTitle) this.headerChatTitle.textContent = chat.title;
    } else {
      document.title = 'oska.AI V1';
      if (this.headerChatTitle) this.headerChatTitle.textContent = 'New chat';
    }
  }

  // -------------------------------------------------------------
  // Voice Input (Speech-to-Text)
  // -------------------------------------------------------------
  initVoiceRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;

      this.recognition.onstart = () => {
        this.isListening = true;
        this.voiceMicBtn.classList.add('listening');
        this.voiceWaveformBadge.classList.remove('hidden');
        this.showToast('Voice listening active...', 'info');
      };

      this.recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript) {
          this.chatInput.value = transcript;
          this.autoResizeTextarea();
          this.updateSendButtonState();
        }
      };

      this.recognition.onerror = (event) => {
        console.warn('Speech recognition error:', event.error);
        this.stopVoiceRecognition();
      };

      this.recognition.onend = () => {
        this.stopVoiceRecognition();
      };
    }
  }

  toggleVoiceRecognition() {
    if (!this.recognition) {
      this.showToast('Speech recognition not supported in this browser.', 'error');
      return;
    }

    if (this.isListening) {
      this.recognition.stop();
      this.stopVoiceRecognition();
    } else {
      try {
        this.recognition.start();
      } catch (err) {
        this.stopVoiceRecognition();
      }
    }
  }

  stopVoiceRecognition() {
    this.isListening = false;
    if (this.voiceMicBtn) this.voiceMicBtn.classList.remove('listening');
    if (this.voiceWaveformBadge) this.voiceWaveformBadge.classList.add('hidden');
  }

  // -------------------------------------------------------------
  // Composer Controls UI & Popovers Rendering
  // -------------------------------------------------------------
  updateControlsUI() {
    const model = DEFAULT_MODELS.find(m => m.id === this.activeModel) || DEFAULT_MODELS[0];
    
    // Validate supported effort level for this model
    if (model.supportedEfforts && !model.supportedEfforts.includes(this.effortLevel)) {
      this.effortLevel = model.supportedEfforts[model.supportedEfforts.length - 1];
      this.saveStorage('oska_effort', this.effortLevel);
    }

    const effort = EFFORT_LEVELS[this.effortLevel] || EFFORT_LEVELS['extra-high'];

    if (this.composerModelLabel) this.composerModelLabel.textContent = model.name;
    if (this.composerEffortLabel) this.composerEffortLabel.textContent = effort.name;

    // Render Model Popover List
    if (this.modelPopoverList) {
      this.modelPopoverList.innerHTML = '';
      DEFAULT_MODELS.forEach(m => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = `popover-item ${m.id === this.activeModel ? 'active' : ''}`;
        item.innerHTML = `
          <div class="popover-item-left">
            <div>
              <span class="item-title">${this.escapeHtml(m.name)}</span>
              <span class="item-desc">${this.escapeHtml(m.tag)}</span>
            </div>
          </div>
          <span class="check-icon">✓</span>
        `;
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          this.activeModel = m.id;
          this.saveStorage('oska_model', m.id);

          const chat = this.conversations.find(c => c.id === this.currentChatId);
          if (chat) chat.selectedModelId = m.id;

          this.updateControlsUI();
          this.closeAllPopovers();
          this.showToast(`Model: ${m.name}`, 'info');
        });
        this.modelPopoverList.appendChild(item);
      });
    }

    // Render Effort Popover List
    if (this.effortPopoverList) {
      this.effortPopoverList.innerHTML = '';
      const allowedEfforts = model.supportedEfforts || ['instant', 'medium', 'high', 'extra-high', 'pro'];
      
      allowedEfforts.forEach(effKey => {
        const effData = EFFORT_LEVELS[effKey];
        if (!effData) return;

        const item = document.createElement('button');
        item.type = 'button';
        item.className = `popover-item ${effKey === this.effortLevel ? 'active' : ''}`;
        item.innerHTML = `
          <div class="popover-item-left">
            <div>
              <span class="item-title">${this.escapeHtml(effData.name)}</span>
              <span class="item-desc">${this.escapeHtml(effData.desc)}</span>
            </div>
          </div>
          <span class="check-icon">✓</span>
        `;
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          this.effortLevel = effKey;
          this.saveStorage('oska_effort', effKey);

          const chat = this.conversations.find(c => c.id === this.currentChatId);
          if (chat) chat.reasoningLevel = effKey;

          this.updateControlsUI();
          this.closeAllPopovers();
          this.showToast(`Reasoning: ${effData.name}`, 'info');
        });
        this.effortPopoverList.appendChild(item);
      });
    }
  }

  toggleModelPopover() {
    if (this.isGenerating) return;
    const isHidden = this.composerModelPopover.classList.contains('hidden');
    this.closeAllPopovers();
    if (isHidden) {
      this.updateControlsUI();
      this.positionPopover(this.composerModelPopover, this.composerModelBtn, true);
      this.composerModelPopover.classList.remove('hidden');
      this.composerModelBtn.classList.add('active');
      this.composerModelBtn.setAttribute('aria-expanded', 'true');
      if (window.innerWidth <= 768 && this.popoverBackdrop) {
        this.popoverBackdrop.classList.remove('hidden');
      }
    }
  }

  toggleEffortPopover() {
    if (this.isGenerating) return;
    const isHidden = this.composerEffortPopover.classList.contains('hidden');
    this.closeAllPopovers();
    if (isHidden) {
      this.updateControlsUI();
      this.positionPopover(this.composerEffortPopover, this.composerEffortBtn, true);
      this.composerEffortPopover.classList.remove('hidden');
      this.composerEffortBtn.classList.add('active');
      this.composerEffortBtn.setAttribute('aria-expanded', 'true');
      if (window.innerWidth <= 768 && this.popoverBackdrop) {
        this.popoverBackdrop.classList.remove('hidden');
      }
    }
  }

  // -------------------------------------------------------------
  // Event Bindings
  // -------------------------------------------------------------
  bindEvents() {
    // Sidebar toggle for desktop & mobile
    this.sidebarToggleBtn.addEventListener('click', () => {
      if (window.innerWidth <= 768) {
        const isOpen = this.sidebar.classList.toggle('mobile-open');
        this.sidebarBackdrop.classList.toggle('hidden', !isOpen);
      } else {
        this.sidebar.classList.toggle('collapsed');
      }
    });

    // Mobile backdrop click to close sidebar
    if (this.sidebarBackdrop) {
      this.sidebarBackdrop.addEventListener('click', () => {
        this.sidebar.classList.remove('mobile-open');
        this.sidebarBackdrop.classList.add('hidden');
      });
    }

    // Generic Popover Backdrop Click to Close
    if (this.popoverBackdrop) {
      this.popoverBackdrop.addEventListener('click', () => this.closeAllPopovers());
    }

    // Theme toggle button
    this.themeToggleBtn.addEventListener('click', () => {
      this.applyTheme(this.theme === 'dark' ? 'light' : 'dark');
    });

    // Voice button trigger
    this.voiceMicBtn.addEventListener('click', () => this.toggleVoiceRecognition());

    // Direct Model & Effort Button Click Triggers
    this.composerModelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleModelPopover();
    });

    this.composerEffortBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleEffortPopover();
    });

    // Tools Menu Popover Trigger
    this.toolsMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = this.toolsPopover.classList.contains('hidden');
      this.closeAllPopovers();
      if (isHidden) {
        this.positionPopover(this.toolsPopover, this.toolsMenuBtn, true);
        this.toolsPopover.classList.remove('hidden');
        if (window.innerWidth <= 768 && this.popoverBackdrop) {
          this.popoverBackdrop.classList.remove('hidden');
        }
      }
    });

    // Tools Actions
    if (this.toolWebSearchBtn) {
      this.toolWebSearchBtn.addEventListener('click', () => {
        this.closeAllPopovers();
        this.chatInput.value = '/search ';
        this.chatInput.focus();
        this.autoResizeTextarea();
        this.updateSendButtonState();
        this.showToast('Web Search mode enabled. Enter query.', 'info');
      });
    }

    this.toolCreateImageBtn.addEventListener('click', () => {
      this.closeAllPopovers();
      this.chatInput.value = '/image ';
      this.chatInput.focus();
      this.autoResizeTextarea();
      this.updateSendButtonState();
      this.showToast('Image mode activated. Describe your visual.', 'info');
    });

    this.toolCreateVideoBtn.addEventListener('click', () => {
      this.closeAllPopovers();
      this.chatInput.value = '/video ';
      this.chatInput.focus();
      this.autoResizeTextarea();
      this.updateSendButtonState();
      this.showToast('Video mode activated. Describe your scene.', 'info');
    });

    // New chat triggers
    const handleNewChat = () => this.startNewChat();
    this.newChatBtn.addEventListener('click', handleNewChat);
    this.headerNewChatBtn.addEventListener('click', handleNewChat);
    this.brandHomeBtn.addEventListener('click', handleNewChat);

    // Global keyboard shortcuts: Ctrl+K for new chat, Esc to close popovers
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        this.startNewChat();
      } else if (e.key === 'Escape') {
        this.closeAllPopovers();
      }
    });

    // Composer Input Events
    this.chatInput.addEventListener('input', () => {
      this.autoResizeTextarea();
      this.updateSendButtonState();
    });

    this.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!this.sendBtn.disabled && !this.isGenerating) {
          this.handleSendMessage();
        }
      }
    });

    this.sendBtn.addEventListener('click', () => this.handleSendMessage());
    this.stopBtn.addEventListener('click', () => this.stopGeneration());

    // File attachments
    this.attachBtn.addEventListener('click', () => this.fileInput.click());
    this.fileInput.addEventListener('change', (e) => this.handleFileUpload(e.target.files));

    // Welcome Shortcut Chips
    document.querySelectorAll('.shortcut-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const prompt = chip.getAttribute('data-prompt');
        this.chatInput.value = prompt;
        this.autoResizeTextarea();
        this.updateSendButtonState();
        this.chatInput.focus();
      });
    });

    // Settings Modal
    this.openSettingsBtn.addEventListener('click', () => {
      this.settingsModal.classList.remove('hidden');
    });
    this.closeSettingsBtn.addEventListener('click', () => {
      this.settingsModal.classList.add('hidden');
    });
    this.saveSettingsBtn.addEventListener('click', () => {
      this.applyTheme(this.themeSelect.value);
      this.activeModel = this.defaultModelSelect.value;
      this.saveStorage('oska_model', this.activeModel);
      this.updateControlsUI();
      this.settingsModal.classList.add('hidden');
      this.showToast('Settings saved', 'success');
    });

    this.clearAllHistoryBtn.addEventListener('click', () => {
      this.conversations = [];
      this.saveStorage('oska_conversations_v1', []);
      this.startNewChat();
      this.settingsModal.classList.add('hidden');
      this.showToast('Conversation history cleared', 'info');
    });

    // Sidebar search
    this.sidebarSearchInput.addEventListener('input', (e) => {
      this.renderSidebar(e.target.value.trim().toLowerCase());
    });

    // Global click-outside to close popovers
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.composer-popover') && 
          !e.target.closest('#composerModelBtn') && 
          !e.target.closest('#composerEffortBtn') && 
          !e.target.closest('#toolsMenuBtn')) {
        this.closeAllPopovers();
      }
    });
  }

  // -------------------------------------------------------------
  // Popover Helpers
  // -------------------------------------------------------------
  closeAllPopovers() {
    if (this.composerModelPopover) this.composerModelPopover.classList.add('hidden');
    if (this.composerEffortPopover) this.composerEffortPopover.classList.add('hidden');
    if (this.toolsPopover) this.toolsPopover.classList.add('hidden');
    if (this.popoverBackdrop) this.popoverBackdrop.classList.add('hidden');

    if (this.composerModelBtn) {
      this.composerModelBtn.classList.remove('active');
      this.composerModelBtn.setAttribute('aria-expanded', 'false');
    }
    if (this.composerEffortBtn) {
      this.composerEffortBtn.classList.remove('active');
      this.composerEffortBtn.setAttribute('aria-expanded', 'false');
    }
  }

  positionPopover(popover, triggerEl, isUpward = false) {
    if (window.innerWidth <= 768) return; // Handled by responsive mobile bottom sheet CSS
    const rect = triggerEl.getBoundingClientRect();
    if (isUpward) {
      popover.style.bottom = `${window.innerHeight - rect.top + 8}px`;
      popover.style.top = 'auto';
      popover.style.left = `${Math.min(rect.left, window.innerWidth - 310)}px`;
      popover.style.right = 'auto';
    } else {
      popover.style.top = `${rect.bottom + 6}px`;
      popover.style.bottom = 'auto';
      popover.style.left = `${Math.min(rect.left, window.innerWidth - 310)}px`;
      popover.style.right = 'auto';
    }
  }

  // -------------------------------------------------------------
  // Composer & Textarea Sizing
  // -------------------------------------------------------------
  autoResizeTextarea() {
    this.chatInput.style.height = 'auto';
    this.chatInput.style.height = `${Math.min(this.chatInput.scrollHeight, 180)}px`;
  }

  updateSendButtonState() {
    const hasText = Boolean(this.chatInput.value.trim());
    const hasAttachments = this.pendingAttachments.length > 0;
    this.sendBtn.disabled = (!hasText && !hasAttachments) || this.isGenerating;
  }

  // -------------------------------------------------------------
  // Attachment Handling
  // -------------------------------------------------------------
  handleFileUpload(files) {
    if (!files || files.length === 0) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      const isImage = file.type.startsWith('image/');
      
      reader.onload = (e) => {
        const attachment = {
          id: 'att_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
          name: file.name,
          size: file.size,
          type: file.type,
          isImage: isImage,
          data: e.target.result
        };
        this.pendingAttachments.push(attachment);
        this.renderAttachmentChips();
        this.updateSendButtonState();
      };

      if (isImage) {
        reader.readAsDataURL(file);
      } else {
        reader.readAsText(file);
      }
    });
    this.fileInput.value = '';
  }

  renderAttachmentChips() {
    if (this.pendingAttachments.length === 0) {
      this.attachmentPreviewBar.classList.add('hidden');
      this.attachmentPreviewBar.innerHTML = '';
      return;
    }

    this.attachmentPreviewBar.classList.remove('hidden');
    this.attachmentPreviewBar.innerHTML = '';

    this.pendingAttachments.forEach((att, index) => {
      const chip = document.createElement('div');
      chip.className = 'attachment-chip';
      chip.innerHTML = `
        ${att.isImage ? `<img src="${att.data}" class="chip-thumb" alt="Preview">` : `<i data-lucide="file-text" style="width: 14px; height: 14px;"></i>`}
        <span class="chip-name">${this.escapeHtml(att.name)}</span>
        <button type="button" class="chip-remove" title="Remove" aria-label="Remove attachment">✕</button>
      `;
      chip.querySelector('.chip-remove').addEventListener('click', () => {
        this.pendingAttachments.splice(index, 1);
        this.renderAttachmentChips();
        this.updateSendButtonState();
      });
      this.attachmentPreviewBar.appendChild(chip);
    });
    this.refreshIcons();
  }

  // -------------------------------------------------------------
  // Conversation Management
  // -------------------------------------------------------------
  startNewChat() {
    this.currentChatId = null;
    this.welcomeScreen.classList.remove('hidden');
    this.conversationContainer.classList.add('hidden');
    this.conversationContainer.innerHTML = '';
    this.chatInput.value = '';
    this.pendingAttachments = [];
    this.renderAttachmentChips();
    this.autoResizeTextarea();
    this.updateSendButtonState();
    this.renderSidebar();
    this.updatePageTitle();
    this.chatInput.focus();

    // Close mobile drawer if open
    if (window.innerWidth <= 768) {
      this.sidebar.classList.remove('mobile-open');
      this.sidebarBackdrop.classList.add('hidden');
    }
  }

  loadChat(chatId) {
    const chat = this.conversations.find(c => c.id === chatId);
    if (!chat) return;

    this.currentChatId = chatId;
    if (chat.selectedModelId) this.activeModel = chat.selectedModelId;
    if (chat.reasoningLevel) this.effortLevel = chat.reasoningLevel;

    this.welcomeScreen.classList.add('hidden');
    this.conversationContainer.classList.remove('hidden');
    this.conversationContainer.innerHTML = '';

    chat.messages.forEach(msg => {
      this.renderMessageElement(msg);
    });

    this.updateControlsUI();
    this.renderSidebar();
    this.updatePageTitle();
    this.scrollToBottom();

    // Close mobile drawer if open
    if (window.innerWidth <= 768) {
      this.sidebar.classList.remove('mobile-open');
      this.sidebarBackdrop.classList.add('hidden');
    }
  }

  deleteChat(chatId, e) {
    if (e) e.stopPropagation();
    this.conversations = this.conversations.filter(c => c.id !== chatId);
    this.saveStorage('oska_conversations_v1', this.conversations);
    if (this.currentChatId === chatId) {
      this.startNewChat();
    } else {
      this.renderSidebar();
    }
    this.showToast('Conversation deleted', 'info');
  }

  renderSidebar(filterQuery = '') {
    this.sidebarHistory.innerHTML = '';

    let chats = [...this.conversations].sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
    if (filterQuery) {
      chats = chats.filter(c => c.title.toLowerCase().includes(filterQuery));
    }

    if (chats.length === 0) {
      this.sidebarHistory.innerHTML = `<div style="font-size: 0.8rem; color: var(--text-muted); padding: 1rem 0.5rem; text-align: center;">No conversations yet</div>`;
      return;
    }

    // Time groups: Today, Yesterday, Previous 7 days, Older
    const now = new Date();
    const groups = {
      today: { title: 'Today', items: [] },
      yesterday: { title: 'Yesterday', items: [] },
      week: { title: 'Previous 7 days', items: [] },
      older: { title: 'Older', items: [] }
    };

    chats.forEach(chat => {
      const chatDate = new Date(chat.updatedAt || chat.createdAt);
      const diffHours = (now - chatDate) / (1000 * 60 * 60);

      if (diffHours < 24 && now.getDate() === chatDate.getDate()) {
        groups.today.items.push(chat);
      } else if (diffHours < 48) {
        groups.yesterday.items.push(chat);
      } else if (diffHours < 168) {
        groups.week.items.push(chat);
      } else {
        groups.older.items.push(chat);
      }
    });

    Object.values(groups).forEach(group => {
      if (group.items.length === 0) return;

      const groupHeader = document.createElement('div');
      groupHeader.className = 'history-group-title';
      groupHeader.textContent = group.title;
      this.sidebarHistory.appendChild(groupHeader);

      group.items.forEach(chat => {
        const item = document.createElement('div');
        item.className = `chat-item ${chat.id === this.currentChatId ? 'active' : ''}`;
        item.innerHTML = `
          <span class="chat-item-title">${this.escapeHtml(chat.title || 'New Conversation')}</span>
          <div class="chat-item-actions">
            <button type="button" class="chat-action-btn delete" title="Delete conversation" aria-label="Delete conversation">
              <i data-lucide="trash-2" style="width: 13px; height: 13px;"></i>
            </button>
          </div>
        `;

        item.addEventListener('click', () => this.loadChat(chat.id));
        item.querySelector('.delete').addEventListener('click', (e) => this.deleteChat(chat.id, e));

        this.sidebarHistory.appendChild(item);
      });
    });

    this.refreshIcons();
  }

  // -------------------------------------------------------------
  // Message Sending & AI Execution
  // -------------------------------------------------------------
  async handleSendMessage() {
    const rawText = this.chatInput.value.trim();
    const attachments = [...this.pendingAttachments];

    if (!rawText && attachments.length === 0) return;

    // Reset composer state & close popovers
    this.closeAllPopovers();
    this.chatInput.value = '';
    this.pendingAttachments = [];
    this.renderAttachmentChips();
    this.autoResizeTextarea();
    this.updateSendButtonState();

    // Hide welcome screen
    this.welcomeScreen.classList.add('hidden');
    this.conversationContainer.classList.remove('hidden');

    // Create or retrieve active conversation
    let chat = this.conversations.find(c => c.id === this.currentChatId);
    if (!chat) {
      chat = {
        id: 'chat_' + Date.now(),
        title: rawText.slice(0, 32) || 'New Conversation',
        selectedModelId: this.activeModel,
        reasoningLevel: this.effortLevel,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: []
      };
      this.conversations.unshift(chat);
      this.currentChatId = chat.id;
    } else {
      chat.selectedModelId = this.activeModel;
      chat.reasoningLevel = this.effortLevel;
    }

    // User Message
    const userMsg = {
      role: 'user',
      content: rawText,
      attachments: attachments,
      timestamp: new Date().toISOString()
    };
    chat.messages.push(userMsg);
    chat.updatedAt = new Date().toISOString();
    this.renderMessageElement(userMsg);
    this.updatePageTitle();
    this.scrollToBottom();

    // Check for Image / Video / Search Commands
    if (rawText.startsWith('/search')) {
      const searchQuery = rawText.replace('/search', '').trim();
      userMsg.aiPrompt = `[Web Search Mode] Please perform a real-time web search and provide up-to-date factual analysis with sources for: "${searchQuery}"`;
    } else if (rawText.startsWith('/image')) {
      await this.handleImageGeneration(rawText.replace('/image', '').trim(), chat);
      return;
    } else if (rawText.startsWith('/video')) {
      await this.handleVideoGeneration(rawText.replace('/video', '').trim(), chat);
      return;
    }

    // Execute AI Model Chat
    await this.executeAICompletion(chat);
  }

  async executeAICompletion(chat) {
    this.isGenerating = true;
    this.composerModelBtn.disabled = true;
    this.composerEffortBtn.disabled = true;
    this.sendBtn.classList.add('hidden');
    this.stopBtn.classList.remove('hidden');
    this.abortController = new AbortController();

    const assistantMsg = {
      role: 'assistant',
      content: '',
      reasoning_content: '',
      timestamp: new Date().toISOString()
    };
    chat.messages.push(assistantMsg);

    const messageRow = this.renderMessageElement(assistantMsg);
    const bubble = messageRow.querySelector('.message-bubble');
    bubble.innerHTML = '<span class="typing-indicator">...</span>';

    try {
      const persona = PERSONAS[this.activePersona] || PERSONAS.general;
      const payload = {
        model: this.activeModel,
        messages: chat.messages.slice(0, -1),
        systemPrompt: persona.prompt,
        temperature: 0.7,
        effort: this.effortLevel
      };

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: this.abortController.signal
      });

      if (!res.ok) {
        throw new Error(`API returned HTTP ${res.status}`);
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || 'No response generated.';
      const reasoning = data.choices?.[0]?.message?.reasoning_content || '';

      assistantMsg.content = content;
      assistantMsg.reasoning_content = reasoning;

      // Stream text smoothly into the message bubble
      let streamText = '';
      const words = content.split(' ');
      
      let reasoningHeaderHtml = '';
      if (reasoning) {
        reasoningHeaderHtml = `
          <div class="reasoning-box">
            <div class="reasoning-header">
              <span>Thought Process</span>
              <i data-lucide="chevron-down" style="width: 14px; height: 14px;"></i>
            </div>
            <div class="reasoning-content">${this.escapeHtml(reasoning)}</div>
          </div>
        `;
      }

      for (let i = 0; i < words.length; i++) {
        if (this.abortController?.signal.aborted) break;
        streamText += (i === 0 ? '' : ' ') + words[i];
        bubble.innerHTML = reasoningHeaderHtml + this.renderMarkdown(streamText);
        this.scrollToBottom();
        await new Promise(r => setTimeout(r, 12));
      }

      bubble.innerHTML = reasoningHeaderHtml + this.renderMarkdown(content);
      this.setupMessageActionListeners(messageRow, assistantMsg);
      this.refreshIcons();

    } catch (err) {
      if (err.name !== 'AbortError') {
        bubble.innerHTML = `<div style="color: var(--text-secondary); font-style: italic;">Response paused or connection timed out. Click regenerate to retry.</div>`;
      }
    } finally {
      this.isGenerating = false;
      this.composerModelBtn.disabled = false;
      this.composerEffortBtn.disabled = false;
      this.sendBtn.classList.remove('hidden');
      this.stopBtn.classList.add('hidden');
      this.saveStorage('oska_conversations_v1', this.conversations);
      this.renderSidebar();
      this.updateSendButtonState();
    }
  }

  // -------------------------------------------------------------
  // Image Generation Handler
  // -------------------------------------------------------------
  async handleImageGeneration(promptText, chat) {
    this.isGenerating = true;
    this.sendBtn.classList.add('hidden');
    this.stopBtn.classList.remove('hidden');

    const assistantMsg = {
      role: 'assistant',
      content: `### 🎨 oska.AI Visual Generation\n*Prompt: "${promptText}"*\n\nGenerating visual composition...`,
      timestamp: new Date().toISOString()
    };
    chat.messages.push(assistantMsg);

    const messageRow = this.renderMessageElement(assistantMsg);
    const bubble = messageRow.querySelector('.message-bubble');

    try {
      const res = await fetch('/api/images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptText })
      });

      const data = await res.json();
      if (data.url) {
        bubble.innerHTML = `
          <div class="ai-media-card">
            <img src="${data.url}" alt="${this.escapeHtml(promptText)}" loading="lazy">
            <div class="ai-media-footer">
              <span>${this.escapeHtml(promptText)}</span>
              <a href="${data.url}" target="_blank" download="oska_image.jpg" class="media-action-btn">
                <i data-lucide="download" style="width: 13px; height: 13px;"></i>
                <span>Download</span>
              </a>
            </div>
          </div>
        `;
        assistantMsg.content = `[Image generated for: ${promptText}]`;
      }
    } catch (_) {
      bubble.innerHTML = `<p>Image generation service unavailable. Please retry.</p>`;
    } finally {
      this.isGenerating = false;
      this.sendBtn.classList.remove('hidden');
      this.stopBtn.classList.add('hidden');
      this.saveStorage('oska_conversations_v1', this.conversations);
      this.refreshIcons();
    }
  }

  // -------------------------------------------------------------
  // Video Generation Handler
  // -------------------------------------------------------------
  async handleVideoGeneration(promptText, chat) {
    this.isGenerating = true;
    this.sendBtn.classList.add('hidden');
    this.stopBtn.classList.remove('hidden');

    const assistantMsg = {
      role: 'assistant',
      content: `### 🎬 oska.AI Video Generation\n*Prompt: "${promptText}"*\n\nGenerating cinematic keyframes...`,
      timestamp: new Date().toISOString()
    };
    chat.messages.push(assistantMsg);

    const messageRow = this.renderMessageElement(assistantMsg);
    const bubble = messageRow.querySelector('.message-bubble');

    try {
      const res = await fetch('/api/videos/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptText })
      });

      const data = await res.json();
      if (data.previewUrl) {
        bubble.innerHTML = `
          <div class="ai-media-card">
            <img src="${data.previewUrl}" alt="${this.escapeHtml(promptText)}" loading="lazy">
            <div class="ai-media-footer">
              <span>Cinematic Scene • Completed</span>
              <a href="${data.previewUrl}" target="_blank" download="oska_video_scene.jpg" class="media-action-btn">
                <i data-lucide="download" style="width: 13px; height: 13px;"></i>
                <span>Save Scene</span>
              </a>
            </div>
          </div>
        `;
        assistantMsg.content = `[AI Video generated for: ${promptText}]`;
      }
    } catch (_) {
      bubble.innerHTML = `<p>Video generation service timed out. Please retry.</p>`;
    } finally {
      this.isGenerating = false;
      this.sendBtn.classList.remove('hidden');
      this.stopBtn.classList.add('hidden');
      this.saveStorage('oska_conversations_v1', this.conversations);
      this.refreshIcons();
    }
  }

  stopGeneration() {
    if (this.abortController) {
      this.abortController.abort();
    }
    this.isGenerating = false;
    this.composerModelBtn.disabled = false;
    this.composerEffortBtn.disabled = false;
    this.sendBtn.classList.remove('hidden');
    this.stopBtn.classList.add('hidden');
    this.showToast('Generation stopped', 'info');
  }

  // -------------------------------------------------------------
  // Message Element Rendering & Markdown
  // -------------------------------------------------------------
  renderMessageElement(msg) {
    const row = document.createElement('div');
    row.className = `message-row ${msg.role}`;

    let attachmentsHtml = '';
    if (msg.attachments && msg.attachments.length > 0) {
      attachmentsHtml = `
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.5rem;">
          ${msg.attachments.map(att => att.isImage ? `<img src="${att.data}" style="max-height: 120px; border-radius: 6px;" alt="Image">` : `<div class="attachment-chip"><i data-lucide="file"></i> ${this.escapeHtml(att.name)}</div>`).join('')}
        </div>
      `;
    }

    let reasoningHeaderHtml = '';
    if (msg.reasoning_content) {
      reasoningHeaderHtml = `
        <div class="reasoning-box">
          <div class="reasoning-header">
            <span>Thought Process</span>
            <i data-lucide="chevron-down" style="width: 14px; height: 14px;"></i>
          </div>
          <div class="reasoning-content">${this.escapeHtml(msg.reasoning_content)}</div>
        </div>
      `;
    }

    row.innerHTML = `
      ${attachmentsHtml}
      <div class="message-bubble">
        ${reasoningHeaderHtml}
        ${this.renderMarkdown(msg.content)}
      </div>
      <div class="message-actions">
        <button type="button" class="msg-action-btn copy-msg" title="Copy text" aria-label="Copy message">
          <i data-lucide="copy" style="width: 13px; height: 13px;"></i>
          <span>Copy</span>
        </button>
      </div>
    `;

    this.setupMessageActionListeners(row, msg);
    this.conversationContainer.appendChild(row);
    this.refreshIcons();
    return row;
  }

  setupMessageActionListeners(row, msg) {
    // Copy message action
    const copyBtn = row.querySelector('.copy-msg');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(msg.content);
        this.showToast('Copied to clipboard', 'info');
      });
    }

    // Toggle reasoning accordion
    const rHeader = row.querySelector('.reasoning-header');
    if (rHeader) {
      rHeader.addEventListener('click', () => {
        rHeader.closest('.reasoning-box').classList.toggle('collapsed');
      });
    }

    // Code block copy buttons
    row.querySelectorAll('.copy-code-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const code = btn.closest('.code-block-container').querySelector('code').innerText;
        navigator.clipboard.writeText(code);
        btn.innerHTML = `<i data-lucide="check" style="width: 12px; height: 12px;"></i> Copied`;
        this.refreshIcons();
        setTimeout(() => {
          btn.innerHTML = `<i data-lucide="copy" style="width: 12px; height: 12px;"></i> Copy`;
          this.refreshIcons();
        }, 1800);
      });
    });
  }

  renderMarkdown(text) {
    if (!text) return '';
    if (window.marked) {
      const html = marked.parse(text);
      // Format code blocks
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      tempDiv.querySelectorAll('pre').forEach(pre => {
        const codeEl = pre.querySelector('code');
        const langClass = codeEl ? codeEl.className : '';
        const langMatch = langClass.match(/language-(\w+)/);
        const lang = langMatch ? langMatch[1] : 'code';

        const wrapper = document.createElement('div');
        wrapper.className = 'code-block-container';
        wrapper.innerHTML = `
          <div class="code-header">
            <span>${lang}</span>
            <button type="button" class="copy-code-btn" aria-label="Copy code">
              <i data-lucide="copy" style="width: 12px; height: 12px;"></i>
              <span>Copy</span>
            </button>
          </div>
        `;
        pre.parentNode.insertBefore(wrapper, pre);
        wrapper.appendChild(pre);
      });
      return tempDiv.innerHTML;
    }
    return `<p>${this.escapeHtml(text)}</p>`;
  }

  scrollToBottom() {
    this.chatScrollArea.scrollTop = this.chatScrollArea.scrollHeight;
  }

  escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  refreshIcons() {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span>${this.escapeHtml(message)}</span>`;
    this.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 2800);
  }
}

// Instantiate on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new OskaAIApp();
});
