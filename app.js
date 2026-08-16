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

const BEHAVIOR_MODES = [
  {
    id: 'auto',
    name: 'Auto',
    tag: 'Adaptive Intelligence',
    desc: 'Automatically chooses optimal behavior & tools'
  },
  {
    id: 'general',
    name: 'General',
    tag: 'Everyday Assistant',
    desc: 'Thoughtful, balanced conversational assistant'
  },
  {
    id: 'direct',
    name: 'Direct',
    tag: 'Concise & Actionable',
    desc: 'Direct, concise, no disclaimers or moralizing filler'
  },
  {
    id: 'coder',
    name: 'Coder',
    tag: 'Senior Engineer',
    desc: 'Software architecture, debugging, production code'
  },
  {
    id: 'academic',
    name: 'Academic',
    tag: 'Scholarly Research',
    desc: 'Rigorous analysis, structured thesis style, citations'
  },
  {
    id: 'research',
    name: 'Research',
    tag: 'Evidence Synthesis',
    desc: 'Deep multi-source comparison and source citations'
  },
  {
    id: 'data-analyst',
    name: 'Data Analyst',
    tag: 'Computation & Stats',
    desc: 'Calculations, data tables, anomalies, and charts'
  },
  {
    id: 'creative',
    name: 'Creative',
    tag: 'Ideation & Metaphor',
    desc: 'Compelling writing, storytelling, visual concepts'
  },
  {
    id: 'custom',
    name: 'Custom',
    tag: 'User Persona',
    desc: 'User-defined custom instructions'
  }
];

// -------------------------------------------------------------
// 3. Application State Store
// -------------------------------------------------------------
let state = {
  user: null,
  conversations: [],
  activeConversationId: null,
  projects: JSON.parse(localStorage.getItem('oska_projects') || '[]'),
  activeProjectId: null,
  libraryFiles: JSON.parse(localStorage.getItem('oska_library') || '[]'),
  selectedModel: 'gemini-3.7-flash',
  reasoningEffort: 'extra-high',
  selectedMode: localStorage.getItem('oska_mode') || 'auto',
  customModeInstructions: localStorage.getItem('oska_custom_mode_prompt') || '',
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
// 6. Universal Document & Multimodal File Parsers
// -------------------------------------------------------------
function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getFileIconName(type) {
  switch (type) {
    case 'pdf': return 'file-text';
    case 'docx': return 'file-edit';
    case 'pptx': return 'presentation';
    case 'spreadsheet': return 'table';
    case 'image': return 'image';
    case 'code': return 'file-code';
    default: return 'paperclip';
  }
}

async function parseUploadedFile(file) {
  const fileName = file.name;
  const ext = fileName.split('.').pop().toLowerCase();
  const fileType = file.type;
  const fileSize = file.size;

  // 1. Images
  if (fileType.startsWith('image/')) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve({
          id: 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          name: fileName,
          type: 'image',
          mimeType: fileType,
          size: fileSize,
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
      const arrayBuffer = await file.arrayBuffer();
      let extractedText = '';
      let pageCount = 1;

      if (typeof pdfjsLib !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
        pageCount = pdf.numPages;
        for (let i = 1; i <= Math.min(pageCount, 35); i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map(item => item.str).join(' ');
          extractedText += `\n--- [PDF Page ${i}/${pageCount}] ---\n${pageText}\n`;
        }
      }

      return {
        id: 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        name: fileName,
        type: 'pdf',
        size: fileSize,
        pageCount: pageCount,
        arrayBuffer: arrayBuffer,
        textContext: `Document [${fileName}] Content (${pageCount} pages):\n${extractedText.slice(0, 45000)}`
      };
    } catch (e) {
      console.warn('PDF parse notice:', e);
    }
  }

  // 3. Word Documents (.docx)
  if (ext === 'docx') {
    try {
      const arrayBuffer = await file.arrayBuffer();
      let htmlOutput = '';
      let rawText = '';

      if (typeof mammoth !== 'undefined') {
        const resHtml = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer.slice(0) }).catch(() => null);
        if (resHtml) htmlOutput = resHtml.value;
        const resText = await mammoth.extractRawText({ arrayBuffer: arrayBuffer.slice(0) }).catch(() => null);
        if (resText) rawText = resText.value;
      }

      return {
        id: 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        name: fileName,
        type: 'docx',
        size: fileSize,
        arrayBuffer: arrayBuffer,
        htmlContent: htmlOutput,
        rawContent: rawText,
        textContext: `Word Document [${fileName}] Content:\n${(rawText || htmlOutput).slice(0, 45000)}`
      };
    } catch (e) {
      console.warn('DOCX parse notice:', e);
    }
  }

  // 4. PowerPoint Presentations (.pptx)
  if (ext === 'pptx') {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const textDecoder = new TextDecoder('utf-8');
      const rawString = textDecoder.decode(new Uint8Array(arrayBuffer));
      // Extract slide texts from XML fragments
      const textMatches = rawString.match(/<a:t>([^<]+)<\/a:t>/g) || [];
      const cleanedFragments = textMatches.map(m => m.replace(/<\/?a:t>/g, '').trim()).filter(Boolean);
      
      const slides = [];
      const chunkSize = Math.max(3, Math.ceil(cleanedFragments.length / 8));
      for (let i = 0; i < cleanedFragments.length; i += chunkSize) {
        slides.push({
          number: slides.length + 1,
          title: `Slide ${slides.length + 1}`,
          text: cleanedFragments.slice(i, i + chunkSize).join(' ')
        });
      }

      const summaryText = slides.map(s => `[Slide ${s.number}]: ${s.text}`).join('\n\n');

      return {
        id: 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        name: fileName,
        type: 'pptx',
        size: fileSize,
        slides: slides.length ? slides : [{ number: 1, title: 'Slide 1', text: 'Presentation loaded.' }],
        textContext: `PowerPoint [${fileName}] Slides (${slides.length} slides):\n${summaryText.slice(0, 40000)}`
      };
    } catch (e) {
      console.warn('PPTX parse notice:', e);
    }
  }

  // 5. Spreadsheets (.xlsx, .xls, .csv, .tsv)
  if (['xlsx', 'xls', 'csv', 'tsv'].includes(ext)) {
    try {
      if (typeof XLSX !== 'undefined') {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        let summaryText = `Spreadsheet [${fileName}] Overview:\n`;
        const sheets = [];
        let chartableData = null;

        workbook.SheetNames.forEach((sheetName) => {
          const sheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
          if (jsonData.length > 0) {
            sheets.push({ name: sheetName, data: jsonData });
            summaryText += `\nSheet: "${sheetName}" (${jsonData.length} rows, ${jsonData[0] ? jsonData[0].length : 0} cols)\n`;
            const previewRows = jsonData.slice(0, 25);
            summaryText += previewRows.map(row => (Array.isArray(row) ? row.join(' | ') : '')).join('\n') + '\n';
            if (!chartableData && jsonData.length > 1) {
              chartableData = { headers: jsonData[0], rows: jsonData.slice(1) };
            }
          }
        });

        return {
          id: 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          name: fileName,
          type: 'spreadsheet',
          size: fileSize,
          sheets: sheets,
          sheetData: sheets[0] ? sheets[0].data : [],
          chartData: chartableData,
          textContext: summaryText
        };
      }
    } catch (e) {
      console.warn('Spreadsheet parse notice:', e);
    }
  }

  // 6. Code, Markdown, JSON, Structured Text
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const isCode = ['js', 'ts', 'tsx', 'jsx', 'py', 'java', 'c', 'cpp', 'cs', 'go', 'rs', 'php', 'html', 'css', 'sql', 'sh', 'json'].includes(ext);
      resolve({
        id: 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        name: fileName,
        type: isCode ? 'code' : 'text',
        size: fileSize,
        rawContent: text,
        textContext: `Attached File [${fileName}]:\n\`\`\`${ext}\n${text.slice(0, 45000)}\n\`\`\``
      });
    };
    reader.readAsText(file);
  });
}

// -------------------------------------------------------------
// Universal File Preview Engine (Modal & Reader)
// -------------------------------------------------------------
let activePreviewDoc = null;
let activePdfInstance = null;
let currentPdfPageNum = 1;
let pdfScale = 1.1;

function openFilePreview(item) {
  if (!item) return;
  const modal = document.getElementById('filePreviewModal');
  const title = document.getElementById('filePreviewTitle');
  const subtitle = document.getElementById('filePreviewSubtitle');
  const body = document.getElementById('filePreviewBody');
  const downloadBtn = document.getElementById('previewDownloadBtn');
  const attachBtn = document.getElementById('previewAttachChatBtn');
  if (!modal || !body) return;

  activePreviewDoc = item;
  title.textContent = item.name || 'Document Preview';
  subtitle.textContent = `${(item.type || 'Document').toUpperCase()} · ${item.size ? formatFileSize(item.size) : 'Ready'}`;

  if (item.dataUrl) {
    downloadBtn.href = item.dataUrl;
    downloadBtn.setAttribute('download', item.name || 'download');
    downloadBtn.style.display = 'inline-flex';
  } else {
    downloadBtn.style.display = 'none';
  }

  attachBtn.onclick = () => {
    state.attachments.push(item);
    renderAttachmentBar();
    modal.classList.add('hidden');
    showToast(`Attached ${item.name} to chat`);
  };

  body.innerHTML = '<div style="display:flex; justify-content:center; align-items:center; height:200px;"><span class="pulse-dot"></span> Loading preview...</div>';
  modal.classList.remove('hidden');

  // Route preview by file type
  if (item.type === 'pdf') {
    renderPdfPreview(item, body);
  } else if (item.type === 'docx') {
    renderDocxPreview(item, body);
  } else if (item.type === 'pptx') {
    renderPptxPreview(item, body);
  } else if (item.type === 'spreadsheet') {
    renderSpreadsheetPreview(item, body);
  } else if (item.type === 'image') {
    body.innerHTML = `
      <div class="image-lightbox-wrapper">
        <img src="${item.dataUrl}" alt="${escapeHtml(item.name)}">
      </div>
    `;
  } else {
    const raw = item.rawContent || item.textContext || 'No preview available.';
    body.innerHTML = `
      <pre class="code-preview-block"><code>${escapeHtml(raw)}</code></pre>
    `;
    if (typeof hljs !== 'undefined') {
      body.querySelectorAll('pre code').forEach(el => hljs.highlightElement(el));
    }
  }

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeFilePreview() {
  const modal = document.getElementById('filePreviewModal');
  if (modal) modal.classList.add('hidden');
  activePreviewDoc = null;
  activePdfInstance = null;
}

async function renderPdfPreview(item, container) {
  try {
    if (!item.arrayBuffer && item.dataUrl) {
      const res = await fetch(item.dataUrl);
      item.arrayBuffer = await res.arrayBuffer();
    }
    if (typeof pdfjsLib !== 'undefined' && item.arrayBuffer) {
      const pdf = await pdfjsLib.getDocument({ data: item.arrayBuffer }).promise;
      activePdfInstance = pdf;
      currentPdfPageNum = 1;
      pdfScale = 1.1;

      container.innerHTML = `
        <div class="pdf-preview-container">
          <div class="pdf-toolbar">
            <button type="button" class="icon-btn" onclick="changePdfPage(-1)" title="Previous page"><i data-lucide="chevron-left" style="width:14px;height:14px;"></i></button>
            <span id="pdfPageIndicator">Page 1 of ${pdf.numPages}</span>
            <button type="button" class="icon-btn" onclick="changePdfPage(1)" title="Next page"><i data-lucide="chevron-right" style="width:14px;height:14px;"></i></button>
            <span style="color:var(--border-medium); margin: 0 4px;">|</span>
            <button type="button" class="icon-btn" onclick="zoomPdf(-0.2)" title="Zoom Out"><i data-lucide="zoom-out" style="width:14px;height:14px;"></i></button>
            <span id="pdfZoomIndicator">110%</span>
            <button type="button" class="icon-btn" onclick="zoomPdf(0.2)" title="Zoom In"><i data-lucide="zoom-in" style="width:14px;height:14px;"></i></button>
          </div>
          <div class="pdf-canvas-wrapper">
            <canvas id="pdfPreviewCanvas"></canvas>
          </div>
        </div>
      `;
      if (typeof lucide !== 'undefined') lucide.createIcons();
      drawPdfPage(1);
      return;
    }
  } catch (err) {
    console.warn('PDF preview rendering notice:', err);
  }
  container.innerHTML = `<div class="docx-preview-content"><p>${escapeHtml(item.textContext || 'PDF text content.')}</p></div>`;
}

async function drawPdfPage(num) {
  if (!activePdfInstance) return;
  const page = await activePdfInstance.getPage(num);
  const canvas = document.getElementById('pdfPreviewCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const viewport = page.getViewport({ scale: pdfScale });
  canvas.height = viewport.height;
  canvas.width = viewport.width;
  await page.render({ canvasContext: ctx, viewport }).promise;
  const pageIndicator = document.getElementById('pdfPageIndicator');
  if (pageIndicator) pageIndicator.textContent = `Page ${num} of ${activePdfInstance.numPages}`;
}

window.changePdfPage = function(delta) {
  if (!activePdfInstance) return;
  const newPage = currentPdfPageNum + delta;
  if (newPage >= 1 && newPage <= activePdfInstance.numPages) {
    currentPdfPageNum = newPage;
    drawPdfPage(currentPdfPageNum);
  }
};

window.zoomPdf = function(delta) {
  pdfScale = Math.max(0.6, Math.min(2.4, pdfScale + delta));
  const zoomIndicator = document.getElementById('pdfZoomIndicator');
  if (zoomIndicator) zoomIndicator.textContent = `${Math.round(pdfScale * 100)}%`;
  drawPdfPage(currentPdfPageNum);
};

function renderDocxPreview(item, container) {
  if (item.htmlContent) {
    container.innerHTML = `<div class="docx-preview-content">${item.htmlContent}</div>`;
    return;
  }
  container.innerHTML = `<div class="docx-preview-content"><p>${escapeHtml(item.rawContent || item.textContext || 'Document content')}</p></div>`;
}

function renderPptxPreview(item, container) {
  const slides = item.slides || [
    { number: 1, title: 'Slide 1', text: item.textContext || 'Presentation content' }
  ];
  container.innerHTML = `
    <div class="pptx-slide-deck">
      ${slides.map(s => `
        <div class="pptx-slide-card">
          <div class="slide-counter">Slide ${s.number}</div>
          <div class="slide-title">${escapeHtml(s.title || `Slide ${s.number}`)}</div>
          <div class="slide-body-text">${escapeHtml(s.text || '')}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderSpreadsheetPreview(item, container) {
  const sheets = item.sheets && item.sheets.length ? item.sheets : [{ name: 'Sheet1', data: item.sheetData || [] }];

  function renderSheetView(sheetIdx) {
    const targetSheet = sheets[sheetIdx] || sheets[0];
    const data = targetSheet.data || [];
    const headers = data[0] || [];
    const rows = data.slice(1, 100);

    container.innerHTML = `
      <div class="spreadsheet-preview-container">
        ${sheets.length > 1 ? `
          <div class="sheet-tabs-bar">
            ${sheets.map((s, idx) => `
              <button type="button" class="sheet-tab-btn ${idx === sheetIdx ? 'active' : ''}" onclick="switchPreviewSheet(${idx})">
                ${escapeHtml(s.name)}
              </button>
            `).join('')}
          </div>
        ` : ''}
        <div class="spreadsheet-preview-table-wrapper">
          <table class="spreadsheet-preview-table">
            <thead>
              <tr>
                <th style="width: 40px;">#</th>
                ${headers.map(h => `<th>${escapeHtml(String(h))}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${rows.map((row, rIdx) => `
                <tr>
                  <td style="color: var(--text-muted); font-size: 0.7rem;">${rIdx + 1}</td>
                  ${headers.map((_, colIdx) => `<td>${escapeHtml(String(row[colIdx] !== undefined ? row[colIdx] : ''))}</td>`).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  window.switchPreviewSheet = function(idx) {
    renderSheetView(idx);
  };

  renderSheetView(0);
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
  renderModePopoverList();
  renderProjectsSidebar();
  renderConversationsList();
  renderMobileAiSheet();
  updateMobileAiSettingsLabel();

  const mode = BEHAVIOR_MODES.find(m => m.id === state.selectedMode) || BEHAVIOR_MODES[0];
  const modeLabel = document.getElementById('composerModeLabel');
  if (modeLabel) modeLabel.textContent = mode.name;

  const chatInput = document.getElementById('chatInput');
  if (chatInput && window.innerWidth <= 768) {
    chatInput.placeholder = 'Message oska.AI…';
  }

  window.addEventListener('resize', () => {
    updateMobileAiSettingsLabel();
    if (chatInput && !state.activeTool) {
      chatInput.placeholder = window.innerWidth <= 768 ? 'Message oska.AI…' : 'Message oska.AI... (Shift + Enter for new line)';
    }
  });

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
      selectResponseLanguage(lang);
      hideAllPopovers();
    });
  });

  // Model, Effort, and Mode Popovers (Desktop)
  composerModelBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePopover('composerModelPopover');
  });

  composerEffortBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePopover('composerEffortPopover');
  });

  const composerModeBtn = document.getElementById('composerModeBtn');
  if (composerModeBtn) {
    composerModeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePopover('composerModePopover');
    });
  }

  // Mobile Unified AI Settings Sheet Trigger & Actions
  const mobileAiSettingsBtn = document.getElementById('mobileAiSettingsBtn');
  if (mobileAiSettingsBtn) {
    mobileAiSettingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      renderMobileAiSheet();
      togglePopover('mobileAiSheet');
    });
  }

  const closeMobileAiSheetBtn = document.getElementById('closeMobileAiSheetBtn');
  const mobileAiSheetDoneBtn = document.getElementById('mobileAiSheetDoneBtn');
  if (closeMobileAiSheetBtn) closeMobileAiSheetBtn.addEventListener('click', hideAllPopovers);
  if (mobileAiSheetDoneBtn) mobileAiSheetDoneBtn.addEventListener('click', hideAllPopovers);

    // Projects UI Events
    const sidebarNewProjectBtn = document.getElementById('sidebarNewProjectBtn');
    if (sidebarNewProjectBtn) {
      sidebarNewProjectBtn.addEventListener('click', () => {
        requireAuth(() => openNewProjectModal());
      });
    }

    const closeProjectModalBtn = document.getElementById('closeProjectModalBtn');
    const cancelProjectBtn = document.getElementById('cancelProjectBtn');
    if (closeProjectModalBtn) closeProjectModalBtn.addEventListener('click', closeProjectModal);
    if (cancelProjectBtn) cancelProjectBtn.addEventListener('click', closeProjectModal);

    // Color dots for projects
    document.querySelectorAll('#projectColorPicker .color-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        document.querySelectorAll('#projectColorPicker .color-dot').forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
      });
    });

    const projectUploadFileBtn = document.getElementById('projectUploadFileBtn');
    const projectFileInput = document.getElementById('projectFileInput');
    if (projectUploadFileBtn && projectFileInput) {
      projectUploadFileBtn.addEventListener('click', () => {
        requireAuth(() => projectFileInput.click());
      });
      projectFileInput.addEventListener('change', (e) => {
        handleProjectFileUpload(e);
      });
    }

    const projectNewChatBtn = document.getElementById('projectNewChatBtn');
    if (projectNewChatBtn) {
      projectNewChatBtn.addEventListener('click', () => {
        if (state.activeProjectId) {
          startProjectChat(state.activeProjectId);
        } else {
          createNewConversation();
        }
      });
    }

    const projectSettingsBtn = document.getElementById('projectSettingsBtn');
    if (projectSettingsBtn) {
      projectSettingsBtn.addEventListener('click', () => {
        if (state.activeProjectId) {
          openNewProjectModal(state.activeProjectId);
        }
      });
    }

    // Library UI Events
    const openLibraryBtn = document.getElementById('openLibraryBtn');
    const closeLibraryBtn = document.getElementById('closeLibraryBtn');
    if (openLibraryBtn) {
      openLibraryBtn.addEventListener('click', () => {
        requireAuth(() => openLibraryModal());
      });
    }
    if (closeLibraryBtn) {
      closeLibraryBtn.addEventListener('click', closeLibraryModal);
    }

    document.querySelectorAll('#libraryFilterTabs .library-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('#libraryFilterTabs .library-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        renderLibraryGrid(tab.getAttribute('data-filter') || 'all');
      });
    });

    // File Preview Modal Close
    const closeFilePreviewBtn = document.getElementById('closeFilePreviewBtn');
    if (closeFilePreviewBtn) {
      closeFilePreviewBtn.addEventListener('click', closeFilePreview);
    }

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

function updateMobileAiSettingsLabel() {
  const label = document.getElementById('mobileAiSettingsLabel');
  if (!label) return;

  const model = DEFAULT_MODELS.find(m => m.id === state.selectedModel) || DEFAULT_MODELS[0];
  const shortModel = model.name.replace('Flash', '').replace('Reasoner', '').replace('Hub', '').trim();
  const effortConfig = REASONING_EFFORT_CONFIG[state.reasoningEffort] || REASONING_EFFORT_CONFIG['medium'];

  if (window.innerWidth <= 380) {
    label.textContent = shortModel.split(' ')[0] || 'AI';
  } else {
    label.textContent = `${shortModel} · ${effortConfig.label}`;
  }
}

function renderMobileAiSheet() {
  // 1. Behavior Modes
  const modeContainer = document.getElementById('mobileModeGrid');
  if (modeContainer) {
    modeContainer.innerHTML = BEHAVIOR_MODES.map(mode => `
      <button type="button" class="sheet-pill-btn ${mode.id === state.selectedMode ? 'active' : ''}" data-mode-id="${mode.id}">
        <span>${mode.name}</span>
        <span class="mode-badge-tag">${mode.tag}</span>
      </button>
    `).join('');

    modeContainer.querySelectorAll('.sheet-pill-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        selectBehaviorMode(btn.getAttribute('data-mode-id'));
      });
    });
  }

  // 2. AI Models
  const modelContainer = document.getElementById('mobileModelGrid');
  if (modelContainer) {
    modelContainer.innerHTML = DEFAULT_MODELS.map(model => `
      <button type="button" class="sheet-pill-btn ${model.id === state.selectedModel ? 'active' : ''}" data-model-id="${model.id}">
        <span>${model.name}</span>
      </button>
    `).join('');

    modelContainer.querySelectorAll('.sheet-pill-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        selectModel(btn.getAttribute('data-model-id'));
      });
    });
  }

  // 3. Reasoning Efforts
  const effortContainer = document.getElementById('mobileEffortGrid');
  if (effortContainer) {
    const currentModel = DEFAULT_MODELS.find(m => m.id === state.selectedModel) || DEFAULT_MODELS[0];
    const supported = currentModel.supportedEfforts || ['instant', 'medium', 'high', 'extra-high', 'pro'];

    effortContainer.innerHTML = Object.entries(REASONING_EFFORT_CONFIG)
      .filter(([key]) => supported.includes(key))
      .map(([key, config]) => `
        <button type="button" class="sheet-pill-btn ${key === state.reasoningEffort ? 'active' : ''}" data-effort-key="${key}">
          <span>${config.label}</span>
        </button>
      `).join('');

    effortContainer.querySelectorAll('.sheet-pill-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        selectEffort(btn.getAttribute('data-effort-key'));
      });
    });
  }

  // 4. Response Languages
  const langContainer = document.getElementById('mobileLangGrid');
  if (langContainer) {
    langContainer.querySelectorAll('.sheet-pill-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-lang') === state.responseLanguage);
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        selectResponseLanguage(btn.getAttribute('data-lang'));
      };
    });
  }
}

function selectResponseLanguage(lang) {
  state.responseLanguage = lang;
  const desktopLabel = document.getElementById('composerLangLabel');
  const matchingBtn = document.querySelector(`#languagePopoverList [data-lang="${lang}"]`);
  if (desktopLabel && matchingBtn) {
    desktopLabel.textContent = matchingBtn.querySelector('.item-title').textContent.split(' ')[0];
  }
  document.querySelectorAll('#languagePopoverList [data-lang]').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-lang') === lang);
  });
  renderMobileAiSheet();
  showToast(`Language set to ${lang}`);
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
  renderMobileAiSheet();
  updateMobileAiSettingsLabel();
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
  renderMobileAiSheet();
  updateMobileAiSettingsLabel();
  showToast(`Reasoning effort: ${config.label}`);
}

// -------------------------------------------------------------
// 13. Workspace Tools System (Normalized Catalog & Active Mode)
// -------------------------------------------------------------
const WORKSPACE_TOOLS = [
  {
    id: 'web-search',
    name: 'Web Search',
    description: 'Live search with real source citations',
    icon: 'globe',
    placeholder: 'Search the web and ask anything… (Shift + Enter for new line)',
    statusMsg: 'Searching the web…'
  },
  {
    id: 'deep-research',
    name: 'Deep Research',
    description: 'Multi-source structured investigation',
    icon: 'book-open-check',
    placeholder: 'Enter research question or topic for in-depth investigation…',
    statusMsg: 'Researching sources…'
  },
  {
    id: 'data-analysis',
    name: 'Data & Chart Analysis',
    description: 'Interactive stats and visualization',
    icon: 'line-chart',
    placeholder: 'Ask questions, calculate metrics, or visualize attached data…',
    statusMsg: 'Analyzing your data…'
  },
  {
    id: 'image-generation',
    name: 'Create Image',
    description: 'Generate visuals with AI',
    icon: 'image',
    placeholder: 'Describe the image you want to create in detail…',
    statusMsg: 'Creating your image…'
  },
  {
    id: 'video-generation',
    name: 'Generate AI Video',
    description: 'Create cinematic motion shots',
    icon: 'video',
    placeholder: 'Describe the video scene you want to generate…',
    statusMsg: 'Generating your video…'
  }
];

function selectWorkspaceTool(toolId) {
  if (!requireAuth()) return;

  if (state.activeTool === toolId) {
    state.activeTool = null;
    showToast('Standard chat mode restored');
  } else {
    state.activeTool = toolId;
    const tool = WORKSPACE_TOOLS.find(t => t.id === toolId);
    showToast(`${tool ? tool.name : 'Tool'} mode activated`);
    if (toolId === 'data-analysis' && state.attachments.length === 0) {
      const fileInput = document.getElementById('fileInput');
      if (fileInput) fileInput.click();
    }
  }

  renderActiveToolBar();
  renderToolsMenuState();
  hideAllPopovers();
}

function renderActiveToolBar() {
  const bar = document.getElementById('activeToolBar');
  const input = document.getElementById('chatInput');
  if (!bar) return;

  if (!state.activeTool) {
    bar.classList.add('hidden');
    bar.innerHTML = '';
    if (input) input.placeholder = 'Message oska.AI... (Shift + Enter for new line)';
    return;
  }

  const tool = WORKSPACE_TOOLS.find(t => t.id === state.activeTool);
  if (!tool) return;

  bar.classList.remove('hidden');
  bar.innerHTML = `
    <div class="active-tool-chip">
      <i data-lucide="${tool.icon}" style="width: 13px; height: 13px;"></i>
      <span>${tool.name}</span>
      <button type="button" class="tool-chip-remove" onclick="removeActiveTool()" title="Deactivate tool">
        <i data-lucide="x" style="width: 12px; height: 12px;"></i>
      </button>
    </div>
  `;

  if (input) {
    input.placeholder = tool.placeholder;
    input.focus();
  }

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

window.removeActiveTool = function() {
  state.activeTool = null;
  renderActiveToolBar();
  renderToolsMenuState();
  showToast('Standard chat mode restored');
};

function renderToolsMenuState() {
  document.querySelectorAll('#toolsPopover .popover-item').forEach(btn => {
    const toolId = btn.getAttribute('data-tool-id');
    btn.classList.toggle('active', toolId === state.activeTool);
  });
}

function setupWorkspaceToolsButtons() {
  document.querySelectorAll('#toolsPopover .popover-item').forEach(btn => {
    const toolId = btn.getAttribute('data-tool-id');
    if (toolId) {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        selectWorkspaceTool(toolId);
      });
    }
  });
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
// 15b. Behavior Mode Management & Popover
// -------------------------------------------------------------
function renderModePopoverList() {
  const container = document.getElementById('modePopoverList');
  if (!container) return;

  container.innerHTML = BEHAVIOR_MODES.map(mode => `
    <button type="button" class="popover-item ${mode.id === state.selectedMode ? 'active' : ''}" data-mode-id="${mode.id}">
      <div class="popover-item-left">
        <div>
          <div class="item-title">${mode.name} <span class="mode-item-badge">${mode.tag}</span></div>
          <div class="item-desc">${mode.desc}</div>
        </div>
      </div>
      <span class="check-icon">✓</span>
    </button>
  `).join('');

  container.querySelectorAll('.popover-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const modeId = btn.getAttribute('data-mode-id');
      selectBehaviorMode(modeId);
      hideAllPopovers();
    });
  });
}

function selectBehaviorMode(modeId) {
  const mode = BEHAVIOR_MODES.find(m => m.id === modeId) || BEHAVIOR_MODES[0];
  state.selectedMode = mode.id;
  localStorage.setItem('oska_mode', mode.id);

  if (modeId === 'custom' && !state.customModeInstructions) {
    const customPrompt = prompt('Enter custom system instructions for oska.AI:', state.customModeInstructions || '');
    if (customPrompt !== null) {
      state.customModeInstructions = customPrompt;
      localStorage.setItem('oska_custom_mode_prompt', customPrompt);
    }
  }

  const label = document.getElementById('composerModeLabel');
  if (label) label.textContent = mode.name;
  renderModePopoverList();
  renderMobileAiSheet();
  updateMobileAiSettingsLabel();
  showToast(`Behavior mode: ${mode.name}`);
}

// -------------------------------------------------------------
// 15c. Projects System (Workspaces & Knowledge Base)
// -------------------------------------------------------------
function renderProjectsSidebar() {
  const list = document.getElementById('sidebarProjectsList');
  if (!list) return;

  if (!state.user || !state.projects.length) {
    list.innerHTML = `<div style="padding: 0.35rem 0.5rem; font-size: 0.72rem; color: var(--text-muted);">No projects yet</div>`;
    return;
  }

  list.innerHTML = state.projects.map(p => `
    <div class="sidebar-project-item ${p.id === state.activeProjectId ? 'active' : ''}" onclick="openProjectWorkspace('${p.id}')" title="${escapeHtml(p.name)}">
      <div class="project-item-left">
        <span class="project-color-dot" style="background-color: ${p.color || '#c2410c'};"></span>
        <span class="project-item-name">${escapeHtml(p.name)}</span>
      </div>
      <button type="button" class="chat-action-btn" onclick="event.stopPropagation(); deleteProject('${p.id}')" title="Delete Project">
        <i data-lucide="trash-2" style="width: 12px; height: 12px;"></i>
      </button>
    </div>
  `).join('');

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function openNewProjectModal(editProjectId) {
  const modal = document.getElementById('projectModal');
  const title = document.getElementById('projectModalTitle');
  const nameInput = document.getElementById('projectNameInput');
  const instructionsInput = document.getElementById('projectInstructionsInput');
  const saveBtn = document.getElementById('saveProjectBtn');
  if (!modal) return;

  if (editProjectId) {
    const proj = state.projects.find(p => p.id === editProjectId);
    if (proj) {
      title.textContent = 'Project Settings';
      nameInput.value = proj.name;
      instructionsInput.value = proj.instructions || '';
      saveBtn.textContent = 'Save Changes';
      modal.setAttribute('data-edit-id', editProjectId);
    }
  } else {
    title.textContent = 'New Project';
    nameInput.value = '';
    instructionsInput.value = '';
    saveBtn.textContent = 'Create Project';
    modal.removeAttribute('data-edit-id');
  }

  modal.classList.remove('hidden');
  nameInput.focus();
}

function closeProjectModal() {
  const modal = document.getElementById('projectModal');
  if (modal) modal.classList.add('hidden');
}

window.saveProject = function() {
  const modal = document.getElementById('projectModal');
  const nameInput = document.getElementById('projectNameInput');
  const instructionsInput = document.getElementById('projectInstructionsInput');
  const editId = modal ? modal.getAttribute('data-edit-id') : null;

  const name = nameInput.value.trim();
  if (!name) return;

  const activeDot = document.querySelector('#projectColorPicker .color-dot.active');
  const color = activeDot ? activeDot.getAttribute('data-color') : '#c2410c';
  const instructions = instructionsInput.value.trim();

  if (editId) {
    const proj = state.projects.find(p => p.id === editId);
    if (proj) {
      proj.name = name;
      proj.color = color;
      proj.instructions = instructions;
      proj.updatedAt = new Date().toISOString();
      showToast(`Updated project "${name}"`);
    }
  } else {
    const newProj = {
      id: 'proj_' + Date.now(),
      name: name,
      color: color,
      icon: '📁',
      instructions: instructions,
      sources: [],
      chats: [],
      createdAt: new Date().toISOString()
    };
    state.projects.unshift(newProj);
    showToast(`Created project "${name}"`);
    openProjectWorkspace(newProj.id);
  }

  localStorage.setItem('oska_projects', JSON.stringify(state.projects));
  renderProjectsSidebar();
  closeProjectModal();
};

window.deleteProject = function(projectId) {
  if (!confirm('Are you sure you want to delete this project?')) return;
  state.projects = state.projects.filter(p => p.id !== projectId);
  localStorage.setItem('oska_projects', JSON.stringify(state.projects));
  if (state.activeProjectId === projectId) {
    state.activeProjectId = null;
    createNewConversation();
  } else {
    renderProjectsSidebar();
  }
  showToast('Project deleted');
};

function openProjectWorkspace(projectId) {
  const proj = state.projects.find(p => p.id === projectId);
  if (!proj) return;

  state.activeProjectId = projectId;
  renderProjectsSidebar();

  // Switch to project screen view
  document.getElementById('welcomeScreen').classList.add('hidden');
  document.getElementById('conversationContainer').classList.add('hidden');
  const screen = document.getElementById('projectScreen');
  screen.classList.remove('hidden');

  document.getElementById('headerChatTitle').textContent = proj.name;
  document.getElementById('projectNameHeading').textContent = proj.name;
  document.getElementById('projectMetaText').textContent = `Created ${new Date(proj.createdAt).toLocaleDateString()} · ${proj.sources.length} sources · ${proj.chats.length} chats`;

  const instructionsDisplay = document.getElementById('projectInstructionsDisplay');
  instructionsDisplay.textContent = proj.instructions || 'No custom instructions set. Chats in this project use standard mode.';

  // Render project knowledge sources
  const sourcesGrid = document.getElementById('projectSourcesGrid');
  if (proj.sources.length === 0) {
    sourcesGrid.innerHTML = `<div style="grid-column: 1/-1; padding: 1rem; text-align: center; color: var(--text-muted); font-size: 0.78rem;">No documents uploaded yet. Upload PDF, Word, Excel, or code files to share context across all chats in this project.</div>`;
  } else {
    sourcesGrid.innerHTML = proj.sources.map((s, idx) => `
      <div class="project-source-card">
        <div class="source-card-left" onclick="openFilePreviewByIdx('${escapeHtml(s.name)}', ${idx}, 'project')">
          <i data-lucide="${getFileIconName(s.type)}" style="width: 15px; height: 15px; color: var(--accent-primary);"></i>
          <div>
            <div class="source-card-name">${escapeHtml(s.name)}</div>
            <div style="font-size: 0.65rem; color: var(--text-muted);">${formatFileSize(s.size)}</div>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap: 4px;">
          <button type="button" class="chat-action-btn" onclick="attachProjectSourceToChat(${idx})" title="Attach to Chat">
            <i data-lucide="plus" style="width: 13px; height: 13px;"></i>
          </button>
          <button type="button" class="chat-action-btn delete" onclick="removeProjectSource('${proj.id}', ${idx})" title="Remove Source">
            <i data-lucide="trash-2" style="width: 13px; height: 13px;"></i>
          </button>
        </div>
      </div>
    `).join('');
  }

  // Render project chats
  const chatsList = document.getElementById('projectChatsList');
  const projectChats = state.conversations.filter(c => c.projectId === proj.id);
  if (projectChats.length === 0) {
    chatsList.innerHTML = `<div style="padding: 0.8rem; text-align: center; color: var(--text-muted); font-size: 0.78rem;">No chats in this project yet. Click "+ New Chat" to start.</div>`;
  } else {
    chatsList.innerHTML = projectChats.map(c => `
      <div class="project-chat-item" onclick="loadConversation('${c.id}')">
        <div style="display:flex; align-items:center; gap: 0.5rem;">
          <i data-lucide="message-square" style="width: 14px; height: 14px; color: var(--accent-primary);"></i>
          <span style="font-size: 0.82rem; font-weight: 500;">${escapeHtml(c.title || 'Project Chat')}</span>
        </div>
        <span style="font-size: 0.7rem; color: var(--text-muted);">${c.messages.length} messages</span>
      </div>
    `).join('');
  }

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function handleProjectFileUpload(e) {
  if (!state.activeProjectId) return;
  const proj = state.projects.find(p => p.id === state.activeProjectId);
  if (!proj) return;

  const files = Array.from(e.target.files);
  if (!files.length) return;

  showToast(`Uploading ${files.length} file(s) to project knowledge...`);

  for (const file of files) {
    const parsed = await parseUploadedFile(file);
    proj.sources.push(parsed);
    // Also save to global user library
    state.libraryFiles.push({
      id: parsed.id,
      name: parsed.name,
      type: parsed.type,
      size: parsed.size,
      dataUrl: parsed.dataUrl || '',
      createdAt: new Date().toISOString()
    });
  }

  localStorage.setItem('oska_projects', JSON.stringify(state.projects));
  localStorage.setItem('oska_library', JSON.stringify(state.libraryFiles));
  openProjectWorkspace(state.activeProjectId);
  showToast('Project knowledge base updated');
  e.target.value = '';
}

function startProjectChat(projectId) {
  state.activeProjectId = projectId;
  createNewConversation();
  const conv = state.conversations.find(c => c.id === state.activeConversationId);
  if (conv) {
    conv.projectId = projectId;
    saveConversationsToStorage();
  }
}

window.removeProjectSource = function(projId, idx) {
  const proj = state.projects.find(p => p.id === projId);
  if (!proj) return;
  proj.sources.splice(idx, 1);
  localStorage.setItem('oska_projects', JSON.stringify(state.projects));
  openProjectWorkspace(projId);
  showToast('Source removed from project');
};

window.attachProjectSourceToChat = function(idx) {
  if (!state.activeProjectId) return;
  const proj = state.projects.find(p => p.id === state.activeProjectId);
  if (!proj || !proj.sources[idx]) return;
  state.attachments.push(proj.sources[idx]);
  renderAttachmentBar();
  showToast(`Attached ${proj.sources[idx].name} to composer`);
};

// -------------------------------------------------------------
// 15d. File Library (My Files)
// -------------------------------------------------------------
function openLibraryModal() {
  const modal = document.getElementById('libraryModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  renderLibraryGrid('all');
}

function closeLibraryModal() {
  const modal = document.getElementById('libraryModal');
  if (modal) modal.classList.add('hidden');
}

function renderLibraryGrid(filter) {
  const grid = document.getElementById('libraryGrid');
  if (!grid) return;

  let files = state.libraryFiles || [];
  if (filter && filter !== 'all') {
    files = files.filter(f => f.type === filter);
  }

  if (files.length === 0) {
    grid.innerHTML = `<div style="grid-column: 1/-1; padding: 2rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">No files found in this category</div>`;
    return;
  }

  grid.innerHTML = files.map((f, idx) => `
    <div class="library-file-card">
      <div class="library-card-top">
        <i data-lucide="${getFileIconName(f.type)}" style="width: 20px; height: 20px; color: var(--accent-primary); flex-shrink: 0;"></i>
        <div style="min-width: 0;">
          <div class="library-card-title" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</div>
          <div class="library-card-meta">${(f.type || 'file').toUpperCase()} · ${formatFileSize(f.size)}</div>
        </div>
      </div>
      <div class="library-card-actions">
        <button type="button" class="preview-action-btn" onclick="openFilePreview(${JSON.stringify(f).replace(/"/g, '&quot;')})">
          <i data-lucide="eye" style="width: 12px; height: 12px;"></i> Preview
        </button>
        <button type="button" class="preview-action-btn" onclick="addLibraryFileToChat('${f.id}')">
          <i data-lucide="plus" style="width: 12px; height: 12px;"></i> Attach
        </button>
      </div>
    </div>
  `).join('');

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function addLibraryFileToChat(fileId) {
  const file = state.libraryFiles.find(f => f.id === fileId);
  if (!file) return;
  state.attachments.push(file);
  renderAttachmentBar();
  closeLibraryModal();
  showToast(`Added ${file.name} to chat`);
}

window.openFilePreviewByIdx = function(name, idx, context) {
  if (context === 'project' && state.activeProjectId) {
    const proj = state.projects.find(p => p.id === state.activeProjectId);
    if (proj && proj.sources[idx]) {
      openFilePreview(proj.sources[idx]);
      return;
    }
  }

  const att = state.attachments.find(a => a.name === name) || state.attachments[idx];
  if (att) {
    openFilePreview(att);
  } else {
    const activeConv = state.conversations.find(c => c.id === state.activeConversationId);
    if (activeConv) {
      for (const msg of activeConv.messages) {
        if (msg.attachments && Array.isArray(msg.attachments)) {
          const found = msg.attachments.find(a => (typeof a === 'string' ? a === name : a.name === name));
          if (found) {
            openFilePreview(typeof found === 'object' ? found : { name: found, type: 'document' });
            return;
          }
        }
      }
    }
    openFilePreview({ name: name, type: 'document', textContext: 'Attached file context.' });
  }
};

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
    appendMessageToDOM(msg.role, msg.content, msg.reasoning, msg.media, msg.citations, msg.chart, null, msg.attachments);
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

  // 1. Strict Auth Gate: If unauthenticated, open login modal and PRESERVE prompt!
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
  conv.messages.push({ role: 'user', content: prompt, attachments: currentAttachments });
  appendMessageToDOM('user', prompt, null, null, null, null, null, currentAttachments);
  saveConversationsToStorage();
  renderConversationsList();

  // Save attached files to user library
  currentAttachments.forEach(att => {
    if (!state.libraryFiles.some(f => f.name === att.name && f.size === att.size)) {
      state.libraryFiles.push({
        id: att.id || 'lib_' + Date.now(),
        name: att.name,
        type: att.type,
        size: att.size || 0,
        dataUrl: att.dataUrl || '',
        createdAt: new Date().toISOString()
      });
    }
  });
  localStorage.setItem('oska_library', JSON.stringify(state.libraryFiles));

  // Create Assistant Message Placeholder with thinking indicator
  const assistantBubbleId = 'msg_' + Date.now();
  const assistantRow = appendMessageToDOM('assistant', '', '', null, null, null, assistantBubbleId);
  const bubbleContent = assistantRow.querySelector('.message-bubble');

  // Determine initial contextual status based on prompt, attachments, effort, and active tool
  const initialStatus = getContextualStatus(prompt, currentAttachments, state.reasoningEffort);

  // Show the thinking indicator immediately
  showThinkingIndicator(bubbleContent, initialStatus);
  setGeneratingState(true);
  state.generationPhase = 'queued';

  // Handle Active Media Tools & Slash Commands (/image, /video)
  if (state.activeTool === 'image-generation' || prompt.startsWith('/image ')) {
    const imgPrompt = prompt.replace(/^\/image\s+/i, '').trim() || 'Modern artistic composition with soft lighting';
    updateThinkingStatus(bubbleContent, 'Creating your image…');
    await handleImageGeneration(imgPrompt, bubbleContent, conv);
    state.generationPhase = 'completed';
    setGeneratingState(false);
    return;
  }

  if (state.activeTool === 'video-generation' || prompt.startsWith('/video ')) {
    const vidPrompt = prompt.replace(/^\/video\s+/i, '').trim() || 'Cinematic nature landscape';
    updateThinkingStatus(bubbleContent, 'Generating your video…');
    await handleVideoGeneration(vidPrompt, bubbleContent, conv);
    state.generationPhase = 'completed';
    setGeneratingState(false);
    return;
  }

  // Multilingual System Prompt Preparation
  const systemPrompt = buildLanguageSystemPrompt(prompt, state.responseLanguage);

  // Active Project Context
  const activeProj = state.projects.find(p => p.id === conv.projectId || p.id === state.activeProjectId);
  const projectInstructions = activeProj ? activeProj.instructions : '';
  const projectSources = activeProj ? activeProj.sources : [];

  // API Streaming Request with 35s timeout
  state.abortController = new AbortController();
  let assistantText = '';
  let reasoningText = '';
  let currentCitations = [];
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
        mode: state.selectedMode,
        customModeInstructions: state.customModeInstructions,
        projectInstructions: projectInstructions,
        projectSources: projectSources,
        inlineImage: inlineImage,
        tool: state.activeTool,
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
      currentCitations = json.citations || [];
      transitionToStreaming(bubbleContent);
      streamStarted = true;
      state.generationPhase = 'streaming';
      updateAssistantMessageDOM(bubbleContent, assistantText, reasoningText, true, currentCitations);
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
                } else if (data.status === 'research.planning') {
                  updateThinkingStatus(bubbleContent, 'Planning research queries…');
                } else if (data.status === 'research.searching') {
                  updateThinkingStatus(bubbleContent, 'Gathering multi-source evidence…');
                } else if (data.status === 'research.synthesizing') {
                  updateThinkingStatus(bubbleContent, 'Synthesizing investigation report…');
                } else if (data.status === 'streaming' && !streamStarted) {
                  transitionToStreaming(bubbleContent);
                  streamStarted = true;
                }
                continue;
              }

              // Handle real citations event
              if (data.type === 'citations') {
                currentCitations = data.citations || [];
                updateAssistantMessageDOM(bubbleContent, assistantText, reasoningText, true, currentCitations);
                continue;
              }

              if (data.type === 'text') {
                if (!streamStarted) {
                  transitionToStreaming(bubbleContent);
                  streamStarted = true;
                  state.generationPhase = 'streaming';
                }
                assistantText += data.content;
                updateAssistantMessageDOM(bubbleContent, assistantText, reasoningText, true, currentCitations);
              } else if (data.type === 'reasoning') {
                reasoningText += data.content;
              }
            } catch (e) {
              if (!streamStarted) {
                transitionToStreaming(bubbleContent);
                streamStarted = true;
                state.generationPhase = 'streaming';
              }
              assistantText += raw;
              updateAssistantMessageDOM(bubbleContent, assistantText, reasoningText, true, currentCitations);
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
                updateAssistantMessageDOM(bubbleContent, assistantText, reasoningText, true, currentCitations);
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
      updateAssistantMessageDOM(bubbleContent, assistantText, reasoningText, false, currentCitations);
    } else {
      updateAssistantMessageDOM(bubbleContent, assistantText, reasoningText, false, currentCitations);
    }

    // Chart Generation for Spreadsheets or Data Analysis
    let generatedChart = null;
    if (hasSpreadsheet && chartData) {
      generatedChart = renderSpreadsheetChart(bubbleContent, chartData);
    }

    conv.messages.push({
      role: 'assistant',
      content: assistantText,
      reasoning: reasoningText,
      citations: currentCitations,
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
        updateAssistantMessageDOM(bubbleContent, assistantText, reasoningText, false, currentCitations);
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

function getContextualStatus(prompt, attachments, effort) {
  const p = prompt.toLowerCase();

  // Active Tool Status
  if (state.activeTool === 'web-search' || p.startsWith('/search ') || p.startsWith('/web ')) return 'Searching the web…';
  if (state.activeTool === 'deep-research' || p.startsWith('/research ')) return 'Researching sources…';
  if (state.activeTool === 'data-analysis') return 'Analyzing your data…';
  if (state.activeTool === 'image-generation' || p.startsWith('/image ')) return 'Creating your image…';
  if (state.activeTool === 'video-generation' || p.startsWith('/video ')) return 'Generating your video…';

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

function transitionToStreaming(bubbleElement) {
  const indicator = bubbleElement.querySelector('#oskaThinkingIndicator');
  if (indicator) {
    indicator.classList.add('dissolving');
    setTimeout(() => {
      indicator.remove();
    }, 250);
  }
}

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

window.retryLastMessage = function() {
  const conv = state.conversations.find(c => c.id === state.activeConversationId);
  if (!conv || conv.messages.length === 0) return;

  const lastUserMsg = [...conv.messages].reverse().find(m => m.role === 'user');
  if (!lastUserMsg) return;

  const container = document.getElementById('conversationContainer');
  const lastAssistantRow = container?.querySelector('.message-row.assistant:last-child');
  if (lastAssistantRow) lastAssistantRow.remove();

  if (conv.messages[conv.messages.length - 1]?.role === 'assistant') {
    conv.messages.pop();
  }
  conv.messages.pop();

  const lastUserRow = container?.querySelector('.message-row.user:last-child');
  if (lastUserRow) lastUserRow.remove();

  const input = document.getElementById('chatInput');
  input.value = lastUserMsg.content;
  handleSendMessage();
};

// -------------------------------------------------------------
// 18. Image & Video Generation Handlers
// -------------------------------------------------------------
async function handleImageGeneration(prompt, bubbleElement, conv) {
  bubbleElement.innerHTML = `
    <div class="oska-thinking">
      <div class="oska-thinking-mark">🎨</div>
      <div class="oska-thinking-status shimmer">
        <span class="oska-thinking-label">Creating your image…</span>
        <span class="oska-thinking-dots"><span></span><span></span><span></span></span>
      </div>
    </div>
  `;

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
    if (data.url) {
      bubbleElement.innerHTML = `
        <div class="oska-response-mark">🎨</div>
        <p>Generated image for: <strong>${escapeHtml(prompt)}</strong></p>
        <div class="ai-media-card">
          <img src="${data.url}" alt="${escapeHtml(prompt)}" class="generated-img" onclick="window.open('${data.url}', '_blank')">
          <div class="ai-media-footer">
            <span>FLUX.1 Diffusion Engine · 1024×1024</span>
            <div class="media-actions-group">
              <button type="button" class="media-action-btn" onclick="useImageAsAttachment('${data.url}', '${escapeHtml(prompt)}')">
                <i data-lucide="paperclip" style="width: 12px; height: 12px;"></i> Use as Attachment
              </button>
              <a href="${data.url}" target="_blank" download="oska-image.png" class="media-action-btn">
                <i data-lucide="download" style="width: 12px; height: 12px;"></i> Download
              </a>
            </div>
          </div>
        </div>
      `;
      conv.messages.push({ role: 'assistant', content: `Generated image for: ${prompt}`, media: { type: 'image', url: data.url } });
      saveConversationsToStorage();
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
  } catch (err) {
    bubbleElement.innerHTML = `<p style="color: #ef4444;">Image generation notice: ${escapeHtml(err.message)}</p>`;
  }
}

window.useImageAsAttachment = function(url, prompt) {
  state.attachments.push({
    name: `oska_image_${Date.now()}.png`,
    type: 'image',
    dataUrl: url,
    textContext: `[Attached Previous AI Generated Image: "${prompt}"]`
  });
  renderAttachmentBar();
  showToast('Image attached to composer for follow-up refinement');
};

async function handleVideoGeneration(prompt, bubbleElement, conv) {
  bubbleElement.innerHTML = `
    <div class="oska-thinking">
      <div class="oska-thinking-mark">🎬</div>
      <div class="oska-thinking-status shimmer">
        <span class="oska-thinking-label">Generating cinematic video…</span>
        <span class="oska-thinking-dots"><span></span><span></span><span></span></span>
      </div>
    </div>
  `;

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
    if (data.previewUrl) {
      bubbleElement.innerHTML = `
        <div class="oska-response-mark">🎬</div>
        <p>Generated cinematic motion shot for: <strong>${escapeHtml(prompt)}</strong></p>
        <div class="ai-media-card">
          <img src="${data.previewUrl}" alt="${escapeHtml(prompt)}" class="generated-video-thumb">
          <div class="ai-media-footer">
            <span>oska.AI Motion Engine · 1280×720</span>
            <div class="media-actions-group">
              <a href="${data.previewUrl}" target="_blank" download="oska-motion.jpg" class="media-action-btn">
                <i data-lucide="download" style="width: 12px; height: 12px;"></i> Download Shot
              </a>
            </div>
          </div>
        </div>
      `;
      conv.messages.push({ role: 'assistant', content: `Generated video shot for: ${prompt}`, media: { type: 'video', url: data.previewUrl } });
      saveConversationsToStorage();
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
  } catch (err) {
    bubbleElement.innerHTML = `<p style="color: #ef4444;">Video generation notice: ${escapeHtml(err.message)}</p>`;
  }
}

// -------------------------------------------------------------
// 19. Source Cards, Markdown, & Chart Creation
// -------------------------------------------------------------
function renderSourceCards(citations) {
  if (!citations || !Array.isArray(citations) || citations.length === 0) return '';
  return `
    <div class="sources-container">
      <div class="sources-header">
        <i data-lucide="compass" style="width: 14px; height: 14px; color: var(--accent-primary);"></i>
        <span>Verified Web Sources (${citations.length})</span>
      </div>
      <div class="sources-grid">
        ${citations.map((c, idx) => `
          <a href="${escapeHtml(c.url)}" target="_blank" rel="noopener noreferrer" class="source-card" title="${escapeHtml(c.title || c.url)}">
            <div class="source-card-badge">${idx + 1}</div>
            <div class="source-card-info">
              <div class="source-card-title">${escapeHtml(c.title || c.domain)}</div>
              <div class="source-card-domain">${escapeHtml(c.domain || 'web')}</div>
            </div>
            <i data-lucide="external-link" style="width: 12px; height: 12px;" class="source-card-ext"></i>
          </a>
        `).join('')}
      </div>
    </div>
  `;
}

function appendMessageToDOM(role, content, reasoning, media, citations, chart, rowId, attachments) {
  const container = document.getElementById('conversationContainer');
  const row = document.createElement('div');
  row.className = `message-row ${role}`;
  if (rowId) row.id = rowId;

  let renderedHTML = '';

  if (role === 'user' && attachments && attachments.length > 0) {
    renderedHTML += `
      <div class="chat-attachments-row">
        ${attachments.map((att, idx) => `
          <div class="chat-file-chip" onclick="openFilePreviewByIdx('${escapeHtml(typeof att === 'string' ? att : att.name)}', ${idx})" title="Click to preview ${escapeHtml(typeof att === 'string' ? att : att.name)}">
            <i data-lucide="${getFileIconName(typeof att === 'object' ? att.type : 'document')}" class="chip-icon" style="width: 14px; height: 14px;"></i>
            <span class="chip-name">${escapeHtml(typeof att === 'string' ? att : att.name)}</span>
            <span class="chip-type-tag">${escapeHtml(typeof att === 'object' ? (att.type || 'file') : 'file')}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  renderedHTML += renderMarkdown(content);

  if (citations && citations.length > 0) {
    renderedHTML += renderSourceCards(citations);
  }

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

function updateAssistantMessageDOM(bubbleElement, text, reasoning, isStreaming, citations) {
  let html = '';

  // Small oska.AI mark at top of response
  html += '<div class="oska-response-mark">O</div>';

  html += '<div class="oska-stream-content">';
  html += renderMarkdown(text);
  if (isStreaming) {
    html += '<span class="oska-stream-cursor"></span>';
  }
  html += '</div>';

  if (citations && citations.length > 0) {
    html += renderSourceCards(citations);
  }

  bubbleElement.innerHTML = html;
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderSpreadsheetChart(bubbleElement, chartData) {
  try {
    const chartId = 'chart_' + Date.now();
    const chartCard = document.createElement('div');
    chartCard.className = 'ai-chart-card';

    const labels = chartData.rows.slice(0, 10).map(r => String(r[0] || ''));
    const values = chartData.rows.slice(0, 10).map(r => Number(r[1]) || 0);
    const labelTitle = chartData.headers[1] || chartData.headers[0] || 'Metrics';

    chartCard.innerHTML = `
      <div class="ai-chart-header">
        <div class="ai-chart-header-left">
          <i data-lucide="bar-chart-2" style="width: 16px; height: 16px; color: var(--accent-primary);"></i>
          <span>Data Visualization · ${escapeHtml(labelTitle)}</span>
        </div>
        <div class="ai-chart-controls">
          <button type="button" class="chart-btn active" onclick="switchChartType('${chartId}', 'bar', this)">Bar</button>
          <button type="button" class="chart-btn" onclick="switchChartType('${chartId}', 'line', this)">Line</button>
          <button type="button" class="chart-btn" onclick="switchChartType('${chartId}', 'doughnut', this)">Donut</button>
        </div>
      </div>
      <div class="chart-canvas-wrapper">
        <canvas id="${chartId}"></canvas>
      </div>
    `;
    bubbleElement.appendChild(chartCard);

    setTimeout(() => {
      const ctx = document.getElementById(chartId);
      if (ctx && typeof Chart !== 'undefined') {
        window['chart_instance_' + chartId] = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: labels,
            datasets: [{
              label: labelTitle,
              data: values,
              backgroundColor: 'rgba(194, 65, 12, 0.75)',
              borderColor: '#c2410c',
              borderWidth: 1.5,
              borderRadius: 4
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: true }
            }
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

window.switchChartType = function(chartId, newType, btn) {
  const instance = window['chart_instance_' + chartId];
  if (!instance) return;

  instance.config.type = newType;
  instance.update();

  const container = btn.closest('.ai-chart-controls');
  if (container) {
    container.querySelectorAll('.chart-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }
};

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
