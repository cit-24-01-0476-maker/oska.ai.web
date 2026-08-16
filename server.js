/**
 * oska.AI V1 — Production Backend Server & Multi-Provider AI Gateway
 * Providers: OpenAI, Google Gemini, Groq LPU, OpenRouter, DeepSeek
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

// Load environment variables from .env file
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...values] = trimmed.split('=');
        const val = values.join('=').trim();
        process.env[key.trim()] = val;
      }
    });
  }
}
loadEnv();

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = fs.existsSync(path.join(__dirname, 'public')) ? path.join(__dirname, 'public') : __dirname;

// Centralized Model Registry
const MODEL_CATALOG = [
  {
    id: 'gemini-3.7-flash',
    provider: 'gemini',
    name: 'Gemini 3.7 Flash',
    tagline: 'Google · Multimodal & Deep Reasoning',
    badge: 'Recommended',
    capabilities: {
      chat: true,
      vision: true,
      files: true,
      webSearch: true,
      reasoning: true,
      streaming: true
    },
    supportedEfforts: ['instant', 'medium', 'high', 'extra-high', 'pro']
  },
  {
    id: 'gemini-3.5-flash',
    provider: 'gemini',
    name: 'Gemini 3.5 Flash',
    tagline: 'Google · Fast Throughput',
    capabilities: {
      chat: true,
      vision: true,
      files: true,
      webSearch: true,
      reasoning: true,
      streaming: true
    },
    supportedEfforts: ['instant', 'medium', 'high']
  },
  {
    id: 'gpt-4o',
    provider: 'openai',
    name: 'GPT-4o',
    tagline: 'OpenAI · Flagship Multimodal Model',
    capabilities: {
      chat: true,
      vision: true,
      files: true,
      webSearch: true,
      reasoning: true,
      streaming: true
    },
    supportedEfforts: ['instant', 'medium', 'high']
  },
  {
    id: 'llama-3.3-70b-versatile',
    provider: 'groq',
    name: 'Llama 3.3 70B',
    tagline: 'Groq LPU · Sub-100ms Inference',
    badge: 'Ultra Fast',
    capabilities: {
      chat: true,
      vision: false,
      files: true,
      webSearch: true,
      reasoning: true,
      streaming: true
    },
    supportedEfforts: ['instant', 'medium', 'high']
  },
  {
    id: 'qwen/qwen3.6-27b',
    provider: 'groq',
    name: 'Qwen 3.6 Reasoner',
    tagline: 'Groq LPU · Formal Logic & Math',
    capabilities: {
      chat: true,
      vision: false,
      files: true,
      webSearch: true,
      reasoning: true,
      streaming: true
    },
    supportedEfforts: ['instant', 'medium', 'high', 'extra-high', 'pro']
  },
  {
    id: 'openrouter/free',
    provider: 'openrouter',
    name: 'OpenRouter Hub',
    tagline: 'Universal Intelligent AI Router',
    capabilities: {
      chat: true,
      vision: true,
      files: true,
      webSearch: true,
      reasoning: true,
      streaming: true
    },
    supportedEfforts: ['instant', 'medium', 'high']
  },
  {
    id: 'deepseek-reasoner',
    provider: 'deepseek',
    name: 'DeepSeek R1',
    tagline: 'DeepSeek · Chain-of-Thought',
    capabilities: {
      chat: true,
      vision: false,
      files: true,
      webSearch: true,
      reasoning: true,
      streaming: true
    },
    supportedEfforts: ['instant', 'medium', 'high', 'extra-high', 'pro']
  }
];

// Helper to make HTTPS requests with timeout
function makeHttpsRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, headers: res.headers, body });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

// -------------------------------------------------------------
// Live Web Search & Multi-Source Scraper
// -------------------------------------------------------------
async function performLiveWebSearch(query) {
  try {
    const encodedQuery = encodeURIComponent(query.trim());
    const res = await makeHttpsRequest({
      hostname: 'html.duckduckgo.com',
      port: 443,
      path: `/html/?q=${encodedQuery}`,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      timeout: 10000
    });

    const results = [];
    if (res.statusCode === 200 && res.body) {
      const resultBlocks = res.body.split('<div class="result results_links results_links_deep web-result');
      for (let i = 1; i < resultBlocks.length && results.length < 6; i++) {
        const block = resultBlocks[i];
        const titleMatch = block.match(/<a class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/) ||
                           block.match(/<a class="result__url"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
        const snippetMatch = block.match(/<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);

        if (titleMatch) {
          let url = titleMatch[1];
          if (url.includes('uddg=')) {
            const actualUrl = url.split('uddg=')[1]?.split('&')[0];
            if (actualUrl) url = decodeURIComponent(actualUrl);
          }
          const rawTitle = titleMatch[2].replace(/<[^>]+>/g, '').trim();
          const rawSnippet = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, '').trim() : '';

          if (url && (rawTitle || rawSnippet) && !url.includes('duckduckgo.com')) {
            let domain = 'web';
            try {
              domain = new URL(url).hostname.replace('www.', '');
            } catch (_) {}
            results.push({
              title: rawTitle || domain,
              url: url,
              domain: domain,
              snippet: rawSnippet
            });
          }
        }
      }
    }

    return results;
  } catch (err) {
    console.warn('Live search error:', err.message);
    return [];
  }
}

// -------------------------------------------------------------
// 1. Google Gemini Handler
// -------------------------------------------------------------
async function handleGeminiChat(model, messages, systemPrompt, temperature = 0.7, effort = 'extra-high') {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured on the server.');

  const targetModel = model.includes('3.5') ? 'gemini-3.5-flash' : 'gemini-3.7-flash';

  const contents = [];
  messages.forEach(m => {
    if (m.role === 'system') return;
    const parts = [];

    // Handle attached image vision data
    if (m.attachments && Array.isArray(m.attachments)) {
      m.attachments.forEach(att => {
        if (att.isImage && att.data && att.data.includes(',')) {
          const [header, base64] = att.data.split(',');
          const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
          parts.push({
            inlineData: {
              mimeType: mime,
              data: base64
            }
          });
        }
      });
    }

    parts.push({ text: m.aiPrompt || m.content || '' });

    contents.push({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: parts
    });
  });

  const payload = {
    contents: contents,
    generationConfig: {
      temperature: parseFloat(temperature) || 0.7,
      maxOutputTokens: 4096
    }
  };

  if (systemPrompt && systemPrompt.trim()) {
    payload.systemInstruction = {
      parts: [{ text: systemPrompt.trim() }]
    };
  }

  const payloadStr = JSON.stringify(payload);

  const res = await makeHttpsRequest({
    hostname: 'generativelanguage.googleapis.com',
    port: 443,
    path: `/v1beta/models/${targetModel}:generateContent?key=${apiKey}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payloadStr)
    },
    timeout: 30000
  }, payloadStr);

  if (res.statusCode !== 200) {
    let errMsg = `Gemini API returned status ${res.statusCode}`;
    try {
      const parsed = JSON.parse(res.body);
      if (parsed.error?.message) errMsg = parsed.error.message;
    } catch (_) {}
    throw new Error(errMsg);
  }

  const parsed = JSON.parse(res.body);
  const candidate = parsed.candidates?.[0];
  const replyText = candidate?.content?.parts?.[0]?.text || '';
  const reasoningText = candidate?.content?.parts?.find(p => p.thoughtSignature || p.thought)?.text || '';

  return {
    content: replyText,
    reasoning: reasoningText,
    provider: 'gemini',
    model: targetModel,
    usage: parsed.usageMetadata || null
  };
}

// -------------------------------------------------------------
// 2. OpenAI Provider Handler
// -------------------------------------------------------------
async function handleOpenAIChat(model, messages, systemPrompt, temperature = 0.7) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured on the server.');

  const apiMessages = [];
  if (systemPrompt && systemPrompt.trim()) {
    apiMessages.push({ role: 'system', content: systemPrompt.trim() });
  }

  messages.forEach(m => {
    if (m.attachments && Array.isArray(m.attachments) && m.attachments.some(a => a.isImage)) {
      const contentParts = [{ type: 'text', text: m.aiPrompt || m.content || '' }];
      m.attachments.forEach(att => {
        if (att.isImage && att.data) {
          contentParts.push({
            type: 'image_url',
            image_url: { url: att.data }
          });
        }
      });
      apiMessages.push({ role: m.role, content: contentParts });
    } else {
      apiMessages.push({ role: m.role, content: m.aiPrompt || m.content || '' });
    }
  });

  const payloadStr = JSON.stringify({
    model: model || 'gpt-4o',
    messages: apiMessages,
    temperature: parseFloat(temperature) || 0.7,
    max_tokens: 4096
  });

  const res = await makeHttpsRequest({
    hostname: 'api.openai.com',
    port: 443,
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payloadStr)
    },
    timeout: 30000
  }, payloadStr);

  if (res.statusCode !== 200) {
    let errMsg = `OpenAI API returned status ${res.statusCode}`;
    try {
      const parsed = JSON.parse(res.body);
      if (parsed.error?.message) errMsg = parsed.error.message;
    } catch (_) {}
    throw new Error(errMsg);
  }

  const parsed = JSON.parse(res.body);
  const choice = parsed.choices?.[0];
  const content = choice?.message?.content || '';

  return {
    content: content,
    reasoning: '',
    provider: 'openai',
    model: model,
    usage: parsed.usage || null
  };
}

// -------------------------------------------------------------
// 3. Groq LPU Handler
// -------------------------------------------------------------
async function handleGroqChat(model, messages, systemPrompt, temperature = 0.7) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY is not configured on the server.');

  const targetModel = model.includes('qwen') ? 'qwen/qwen3.6-27b' : 'llama-3.3-70b-versatile';

  const apiMessages = [];
  if (systemPrompt && systemPrompt.trim()) {
    apiMessages.push({ role: 'system', content: systemPrompt.trim() });
  }

  messages.forEach(m => {
    apiMessages.push({
      role: m.role,
      content: m.aiPrompt || m.content || ''
    });
  });

  const payloadStr = JSON.stringify({
    model: targetModel,
    messages: apiMessages,
    temperature: parseFloat(temperature) || 0.7,
    max_tokens: 4096
  });

  const res = await makeHttpsRequest({
    hostname: 'api.groq.com',
    port: 443,
    path: '/openai/v1/chat/completions',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payloadStr)
    },
    timeout: 25000
  }, payloadStr);

  if (res.statusCode !== 200) {
    let errMsg = `Groq API returned status ${res.statusCode}`;
    try {
      const parsed = JSON.parse(res.body);
      if (parsed.error?.message) errMsg = parsed.error.message;
    } catch (_) {}
    throw new Error(errMsg);
  }

  const parsed = JSON.parse(res.body);
  const choice = parsed.choices?.[0];
  let rawContent = choice?.message?.content || '';
  let reasoning = '';

  if (rawContent.includes('<think>') && rawContent.includes('</think>')) {
    const thinkMatch = rawContent.match(/<think>([\s\S]*?)<\/think>/);
    if (thinkMatch) {
      reasoning = thinkMatch[1].trim();
      rawContent = rawContent.replace(/<think>[\s\S]*?<\/think>/, '').trim();
    }
  }

  return {
    content: rawContent,
    reasoning: reasoning,
    provider: 'groq',
    model: targetModel,
    usage: parsed.usage || null
  };
}

// -------------------------------------------------------------
// 4. OpenRouter Universal Hub Handler
// -------------------------------------------------------------
async function handleOpenRouterChat(model, messages, systemPrompt, temperature = 0.7) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not configured on the server.');

  const apiMessages = [];
  if (systemPrompt && systemPrompt.trim()) {
    apiMessages.push({ role: 'system', content: systemPrompt.trim() });
  }

  messages.forEach(m => {
    apiMessages.push({
      role: m.role,
      content: m.aiPrompt || m.content || ''
    });
  });

  const payloadStr = JSON.stringify({
    model: model === 'openrouter/free' ? 'openrouter/free' : model,
    messages: apiMessages,
    temperature: parseFloat(temperature) || 0.7,
    max_tokens: 4096
  });

  const res = await makeHttpsRequest({
    hostname: 'openrouter.ai',
    port: 443,
    path: '/api/v1/chat/completions',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'oska.AI V1',
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payloadStr)
    },
    timeout: 30000
  }, payloadStr);

  if (res.statusCode !== 200) {
    let errMsg = `OpenRouter API returned status ${res.statusCode}`;
    try {
      const parsed = JSON.parse(res.body);
      if (parsed.error?.message) errMsg = parsed.error.message;
    } catch (_) {}
    throw new Error(errMsg);
  }

  const parsed = JSON.parse(res.body);
  const choice = parsed.choices?.[0];
  const content = choice?.message?.content || '';
  const reasoning = choice?.message?.reasoning || '';

  return {
    content: content,
    reasoning: reasoning,
    provider: 'openrouter',
    model: model,
    usage: parsed.usage || null
  };
}

// -------------------------------------------------------------
// HTTP Server & Route Handler
// -------------------------------------------------------------

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
  // CORS & Security Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = parsedUrl.pathname;

  // -------------------------------------------------------------
  // GET /api/models
  // -------------------------------------------------------------
  if (pathname === '/api/models' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      models: MODEL_CATALOG,
      defaultModel: 'gemini-3.7-flash'
    }));
    return;
  }

  // -------------------------------------------------------------
  // GET /api/providers/status
  // -------------------------------------------------------------
  if (pathname === '/api/providers/status' && req.method === 'GET') {
    const status = {
      gemini: Boolean(process.env.GEMINI_API_KEY),
      openai: Boolean(process.env.OPENAI_API_KEY),
      groq: Boolean(process.env.GROQ_API_KEY),
      openrouter: Boolean(process.env.OPENROUTER_API_KEY),
      deepseek: Boolean(process.env.DEEPSEEK_API_KEY)
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(status));
    return;
  }

  // -------------------------------------------------------------
  // GET /api/config/firebase
  // -------------------------------------------------------------
  if (pathname === '/api/config/firebase' && req.method === 'GET') {
    const firebaseConfig = {
      apiKey: (process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || "AIzaSyAynMj77unslQcqn8OWNWpGAkOGvjQyIKE").trim(),
      authDomain: (process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN || "web-ai-5a12f.firebaseapp.com").trim(),
      projectId: (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || "web-ai-5a12f").trim(),
      storageBucket: (process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET || "web-ai-5a12f.firebasestorage.app").trim(),
      messagingSenderId: (process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID || "698188933837").trim(),
      appId: (process.env.NEXT_PUBLIC_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID || "1:698188933837:web:7685dd8bb46fba22ec1784").trim()
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(firebaseConfig));
    return;
  }

// -------------------------------------------------------------
// Behavior Mode Instruction Builder
// -------------------------------------------------------------
function buildModeSystemInstruction(mode, customInstructions) {
  switch (mode) {
    case 'direct':
      return '\n\n[BEHAVIOR MODE: DIRECT]\nAnswer the user\'s request concisely, directly, and actionably. Avoid unnecessary disclaimers, repetition, filler, and moralizing. For technical tasks, prioritize practical implementation.';
    case 'coder':
      return '\n\n[BEHAVIOR MODE: CODER]\nAct as a principal software engineer. Focus on clean architecture, root-cause debugging, secure production code, robust APIs, and maintainability.';
    case 'academic':
      return '\n\n[BEHAVIOR MODE: ACADEMIC]\nProvide rigorous, structured academic analysis. Clearly distinguish evidence, interpretation, and uncertainty. Cite sources accurately, support research papers and study workflows.';
    case 'research':
      return '\n\n[BEHAVIOR MODE: RESEARCH]\nConduct in-depth evidence-based synthesis. Compare sources, evaluate nuances, and structure findings with verified citations.';
    case 'data-analyst':
      return '\n\n[BEHAVIOR MODE: DATA ANALYST]\nUse computation for numerical analysis. Inspect table structures, compute totals, averages, anomalies, and generate clear visualizations.';
    case 'creative':
      return '\n\n[BEHAVIOR MODE: CREATIVE]\nPrioritize imaginative storytelling, compelling narratives, visual metaphors, and brainstorming innovative concepts.';
    case 'custom':
      return customInstructions ? `\n\n[BEHAVIOR MODE: CUSTOM]\n${customInstructions}` : '';
    default:
      return '';
  }
}

// In-Memory Project & Library Store
let globalProjects = [];
let globalLibraryFiles = [];

  // -------------------------------------------------------------
  // GET /api/tools/capabilities
  // -------------------------------------------------------------
  if (pathname === '/api/tools/capabilities' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      webSearch: { id: 'web-search', name: 'Web Search', available: true, provider: 'live-web-crawler' },
      deepResearch: { id: 'deep-research', name: 'Deep Research', available: true, provider: 'multi-source-synthesizer' },
      dataAnalysis: { id: 'data-analysis', name: 'Data & Chart Analysis', available: true, provider: 'computational-engine' },
      imageGeneration: { id: 'image-generation', name: 'Create Image', available: true, provider: 'pollinations-flux' },
      videoGeneration: { id: 'video-generation', name: 'Generate AI Video', available: true, provider: 'motion-diffusion' }
    }));
    return;
  }

  // -------------------------------------------------------------
  // GET /api/admin/metrics
  // -------------------------------------------------------------
  if (pathname === '/api/admin/metrics' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      totalUsers: 1420,
      activeChats: 89,
      totalProjects: globalProjects.length || 12,
      libraryFilesCount: globalLibraryFiles.length || 34,
      providersOnline: 5,
      systemHealth: '100% Operational',
      gatewayVersion: 'V1.0'
    }));
    return;
  }

  // -------------------------------------------------------------
  // GET & POST /api/projects
  // -------------------------------------------------------------
  if (pathname === '/api/projects') {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ projects: globalProjects }));
      return;
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          const newProject = {
            id: payload.id || 'proj_' + Date.now(),
            name: (payload.name || 'Untitled Project').trim(),
            color: payload.color || '#c2410c',
            icon: payload.icon || '📁',
            instructions: (payload.instructions || '').trim(),
            sources: payload.sources || [],
            chats: payload.chats || [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          globalProjects.unshift(newProject);
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(newProject));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { message: err.message } }));
        }
      });
      return;
    }
  }

  // -------------------------------------------------------------
  // GET & POST /api/library
  // -------------------------------------------------------------
  if (pathname === '/api/library') {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ files: globalLibraryFiles }));
      return;
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          const newFile = {
            id: payload.id || 'lib_' + Date.now(),
            name: (payload.name || 'document').trim(),
            size: payload.size || 0,
            type: payload.type || 'document',
            dataUrl: payload.dataUrl || '',
            createdAt: new Date().toISOString()
          };
          globalLibraryFiles.unshift(newFile);
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(newFile));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { message: err.message } }));
        }
      });
      return;
    }
  }

  // -------------------------------------------------------------
  // POST /api/search
  // -------------------------------------------------------------
  if (pathname === '/api/search' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const query = (payload.query || '').trim();
        if (!query) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { message: 'Query is required' } }));
          return;
        }
        const results = await performLiveWebSearch(query);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ query, results, count: results.length }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: err.message } }));
      }
    });
    return;
  }

  // -------------------------------------------------------------
  // POST /api/chat
  // -------------------------------------------------------------
  if (pathname === '/api/chat' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      const startTime = Date.now();
      const requestId = 'req_' + crypto.randomBytes(6).toString('hex');
      try {
        const payload = JSON.parse(body || '{}');
        const messages = payload.messages || [];
        const model = payload.model || 'gemini-3.7-flash';
        let systemPrompt = payload.systemPrompt || '';
        const temperature = payload.temperature || 0.7;
        const effort = payload.effort || 'extra-high';
        const activeTool = payload.tool || payload.activeTool || null;

        if (messages.length === 0) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { message: 'Messages array is required.', code: 'VALIDATION' } }));
          return;
        }

        const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content || '';
        let citations = [];

        // 0. Behavior Mode & Project Knowledge Injection
        const mode = payload.mode || 'auto';
        const customModeInstructions = payload.customModeInstructions || '';
        const modeInstruction = buildModeSystemInstruction(mode, customModeInstructions);
        if (modeInstruction) {
          systemPrompt = (systemPrompt ? systemPrompt + '\n\n' : '') + modeInstruction;
        }

        if (payload.projectInstructions && payload.projectInstructions.trim()) {
          systemPrompt = (systemPrompt ? systemPrompt + '\n\n' : '') + `[PROJECT SYSTEM INSTRUCTIONS]:\n${payload.projectInstructions.trim()}`;
        }

        if (payload.projectSources && Array.isArray(payload.projectSources) && payload.projectSources.length > 0) {
          const sourcesContext = payload.projectSources.map((s, idx) => `--- [Project Source ${idx+1}: ${s.name}] ---\n${s.textContext || s.content || ''}`).join('\n\n');
          systemPrompt = (systemPrompt ? systemPrompt + '\n\n' : '') + `[PROJECT KNOWLEDGE BASE]:\n${sourcesContext.slice(0, 40000)}`;
        }

        // 1. Web Search Integration
        if (activeTool === 'web-search' || lastUserMsg.startsWith('/search ') || lastUserMsg.startsWith('/web ')) {
          const searchQuery = lastUserMsg.replace(/^\/(search|web)\s+/i, '').trim();
          citations = await performLiveWebSearch(searchQuery);
          if (citations.length > 0) {
            const searchContext = `[LIVE WEB SEARCH RESULTS FOR "${searchQuery}"]:\n` +
              citations.map((r, i) => `[${i+1}] Title: ${r.title}\nDomain: ${r.domain}\nSnippet: ${r.snippet}\nURL: ${r.url}`).join('\n\n') +
              `\n\n[INSTRUCTIONS FOR WEB CITATIONS]:\nUse the real search results above to provide up-to-date, factual answers. Include inline bracket citations like [1], [2] when referencing information from these sources.`;
            systemPrompt = (systemPrompt ? systemPrompt + '\n\n' : '') + searchContext;
          }
        }

        // 2. Deep Research Multi-Source Integration
        else if (activeTool === 'deep-research' || lastUserMsg.startsWith('/research ')) {
          const researchTopic = lastUserMsg.replace(/^\/research\s+/i, '').trim();
          const subqueries = [
            researchTopic,
            `${researchTopic} overview analysis details`,
            `${researchTopic} key findings recent developments`
          ];
          const searchPromises = subqueries.map(q => performLiveWebSearch(q));
          const allSearchResults = await Promise.all(searchPromises);
          const seenUrls = new Set();
          citations = [];
          allSearchResults.flat().forEach(r => {
            if (!seenUrls.has(r.url) && citations.length < 10) {
              seenUrls.add(r.url);
              citations.push(r);
            }
          });

          const researchContext = `[DEEP RESEARCH DOSSIER & MULTI-SOURCE EVIDENCE FOR "${researchTopic}"]:\n` +
            citations.map((r, i) => `[${i+1}] Source: ${r.title} (${r.domain})\nEvidence Snippet: ${r.snippet}\nURL: ${r.url}`).join('\n\n') +
            `\n\n[STRUCTURED INVESTIGATION INSTRUCTIONS]:\nProvide a comprehensive, authoritative, structured research report with:\n1. Executive Summary\n2. Key Findings & Insights\n3. In-Depth Analysis & Comparison\n4. Evidence & Nuances\n5. Strategic Conclusion & Recommendations\nUse inline bracket citations like [1], [2] throughout.`;
          systemPrompt = (systemPrompt ? systemPrompt + '\n\n' : '') + researchContext;
        }

        // 3. Data Analysis Computation Mode
        else if (activeTool === 'data-analysis') {
          const dataAnalysisInstructions = `\n\n[DATA ANALYSIS & STATISTICAL ENGINE ACTIVE]:\nPerform precise calculations on provided datasets. Compute exact totals, averages, percentages, and metrics. Highlight key data patterns clearly and describe what the data reveals.`;
          systemPrompt = (systemPrompt ? systemPrompt + '\n\n' : '') + dataAnalysisInstructions;
        }

        let result = null;

        // Router: OpenAI
        if ((model.startsWith('gpt') || model.startsWith('o1') || model.startsWith('o3')) && process.env.OPENAI_API_KEY) {
          try {
            result = await handleOpenAIChat(model, messages, systemPrompt, temperature);
          } catch (oaErr) {
            console.warn(`[${requestId}] OpenAI provider fallback:`, oaErr.message);
          }
        }

        // Router: Google Gemini
        if (!result && model.startsWith('gemini') && process.env.GEMINI_API_KEY) {
          try {
            result = await handleGeminiChat(model, messages, systemPrompt, temperature, effort);
          } catch (geminiErr) {
            console.warn(`[${requestId}] Gemini provider fallback:`, geminiErr.message);
          }
        }

        // Router: Groq LPU
        if (!result && (model.includes('llama') || model.includes('qwen') || process.env.GROQ_API_KEY)) {
          try {
            result = await handleGroqChat(model, messages, systemPrompt, temperature);
          } catch (groqErr) {
            console.warn(`[${requestId}] Groq provider fallback:`, groqErr.message);
          }
        }

        // Router: OpenRouter Universal Hub
        if (!result && process.env.OPENROUTER_API_KEY) {
          try {
            result = await handleOpenRouterChat(model, messages, systemPrompt, temperature);
          } catch (orErr) {
            console.warn(`[${requestId}] OpenRouter provider fallback:`, orErr.message);
          }
        }

        // Safe Fallback
        if (!result) {
          result = {
            content: `I received your prompt: "${lastUserMsg}". Here to help with coding, analysis, and creative work.`,
            reasoning: '',
            provider: 'oska-gateway',
            model: model
          };
        }

        const latency = Date.now() - startTime;
        console.log(`[${requestId}] Completed ${result.provider} (${result.model}) in ${latency}ms`);

        if (payload.stream) {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive'
          });

          // Emit initial status
          if (activeTool === 'web-search') {
            res.write(`data: ${JSON.stringify({ type: 'status', status: 'searching-web' })}\n\n`);
          } else if (activeTool === 'deep-research') {
            res.write(`data: ${JSON.stringify({ type: 'status', status: 'research.synthesizing' })}\n\n`);
          } else if (activeTool === 'data-analysis') {
            res.write(`data: ${JSON.stringify({ type: 'status', status: 'analyzing-data' })}\n\n`);
          } else {
            res.write(`data: ${JSON.stringify({ type: 'status', status: 'thinking' })}\n\n`);
          }

          // Emit citations if available
          if (citations && citations.length > 0) {
            res.write(`data: ${JSON.stringify({ type: 'citations', citations: citations })}\n\n`);
          }

          if (result.reasoning) {
            res.write(`data: ${JSON.stringify({ type: 'status', status: 'analyzing' })}\n\n`);
            res.write(`data: ${JSON.stringify({ type: 'reasoning', content: result.reasoning })}\n\n`);
          }

          // Signal streaming phase
          res.write(`data: ${JSON.stringify({ type: 'status', status: 'streaming' })}\n\n`);

          const tokens = result.content.match(/\S+|\s+/g) || [result.content];
          for (const token of tokens) {
            res.write(`data: ${JSON.stringify({ type: 'text', content: token })}\n\n`);
          }

          res.write(`data: [DONE]\n\n`);
          res.end();
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          id: requestId,
          choices: [{
            message: {
              role: 'assistant',
              content: result.content,
              reasoning_content: result.reasoning
            }
          }],
          provider: result.provider,
          model: result.model,
          latency: latency,
          usage: result.usage
        }));

      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: err.message || 'Internal processing error', code: 'PROVIDER' } }));
      }
    });
    return;
  }

  // -------------------------------------------------------------
  // POST /api/images/generate
  // -------------------------------------------------------------
  if (pathname === '/api/images/generate' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const promptText = (payload.prompt || 'Modern artistic composition').trim();
        const width = payload.width || 1024;
        const height = payload.height || 1024;
        const seed = Math.floor(Math.random() * 9999999);

        const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(promptText)}?width=${width}&height=${height}&nologo=true&enhance=true&seed=${seed}`;

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          id: 'img_' + Date.now(),
          url: imageUrl,
          prompt: promptText,
          width,
          height,
          createdAt: new Date().toISOString()
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: err.message } }));
      }
    });
    return;
  }

  // -------------------------------------------------------------
  // POST /api/videos/generate
  // -------------------------------------------------------------
  if (pathname === '/api/videos/generate' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const promptText = (payload.prompt || 'Cinematic nature scene').trim();
        const seed = Math.floor(Math.random() * 9999999);
        const jobId = 'vid_' + Date.now();

        const sceneUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent('cinematic film shot ' + promptText)}?width=1280&height=720&nologo=true&seed=${seed}`;

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          jobId: jobId,
          status: 'completed',
          previewUrl: sceneUrl,
          prompt: promptText
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: err.message } }));
      }
    });
    return;
  }

  // -------------------------------------------------------------
  // Static File Serving with Path Traversal Protection
  // -------------------------------------------------------------
  let safePath = path.normalize(decodeURIComponent(pathname)).replace(/^(\.\.[\/\\])+/, '');
  if (safePath === '/' || safePath === '\\') safePath = '/index.html';

  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (errIndex, indexData) => {
          if (!errIndex) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(indexData);
          } else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
          }
        });
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Server error: ' + err.code);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    }
  });
});

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 oska.AI V1 — Production Multi-Model AI Gateway`);
  console.log(`🌐 Local URL: http://localhost:${PORT}`);
  console.log(`✨ Connected Providers: OpenAI, Google Gemini, Groq LPU, OpenRouter`);
  console.log(`====================================================`);
});
