# oska.AI V1 — Production Multi-Model AI Platform

A production-grade, multi-provider conversational AI platform inspired by the calm, minimal, and typography-first principles of modern AI workspaces.

---

## 🌟 Key Features

1. **Brand & Identity (`oska.AI V1`)**:
   - Clean, refined, and calm aesthetic with light (warm cream `#faf9f6`) and dark (warm charcoal `#181716`) themes.
   - Zero gaming, cyberpunk, or neon clutter.
2. **Multi-Provider AI Gateway Architecture**:
   - **Google Gemini** (`gemini-3.7-flash`, `gemini-3.5-flash`) via official Generative Language API.
   - **OpenAI** (`gpt-4o`, `gpt-4o-mini`, `o1`, `o3-mini`) with full multimodal support.
   - **Groq LPU** (`llama-3.3-70b-versatile`, `qwen/qwen3.6-27b`) for sub-100ms ultra-low latency inference.
   - **OpenRouter Universal Hub** (`openrouter/free`) for intelligent cloud routing.
   - **DeepSeek** (`deepseek-reasoner`) for formal step-by-step reasoning.
3. **Direct Interactive Composer Controls**:
   - Two separate, obvious buttons: `[ Model Name ⌄ ]` and `[ Reasoning Level ⌄ ]`.
   - Upward floating popovers on desktop; responsive bottom sheets on mobile.
4. **Multimodal Intelligence & Tools**:
   - Multimodal file attachments (Images with visual analysis, PDF, TXT, Markdown, Code).
   - Real Web Search mode (`/search <query>` or Tools menu).
   - AI Image generation (`/image <prompt>` or Tools menu).
   - AI Video generation (`/video <prompt>` or Tools menu).
   - Speech-to-Text Voice recognition with live green audio waveform visualizer.
5. **Responsive Architecture**:
   - Fully responsive across 4K monitors, 1366×768 laptops, tablets, and mobile screens (320px–480px) with `100dvh` and safe-area insets.
6. **Security & Production Safety**:
   - 100% server-side isolated credentials via `.env` (local) and Vercel Environment Variables (production).
   - Zero API keys exposed to browser bundles or client network logs.

---

## 🚀 Local Development Setup

```bash
# 1. Clone repository
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd oska-ai-v1

# 2. Copy environment template and add your API keys
cp .env.example .env

# 3. Start local development server
npm start
```

Access the app at: **`http://localhost:3000`**

---

## 🌐 Production Deployment (GitHub → Vercel)

### Step 1: Push to Private GitHub Repository
```bash
git init
git add .
git commit -m "feat: initial oska.AI V1 production release"
git branch -M main
git remote add origin https://github.com/<YOUR_USERNAME>/oska-ai-v1.git
git push -u origin main
```

### Step 2: Import into Vercel
1. Go to [vercel.com](https://vercel.com) and click **"Add New Project"**.
2. Select your `oska-ai-v1` GitHub repository.
3. Framework Preset: **Other** (Root directory: `./`).
4. In **Settings → Environment Variables**, add your keys:
   - `OPENAI_API_KEY`
   - `GEMINI_API_KEY`
   - `GROQ_API_KEY`
   - `OPENROUTER_API_KEY`
   - `DEEPSEEK_API_KEY`
5. Click **Deploy**.

---

## ⚙️ Available Scripts

```bash
# Start local server
npm start

# Run syntax & lint validation
npm run lint

# Run unit tests
npm test

# Verify production build
npm run build
```

---

## 📜 License
MIT © oska.AI Engineering Team
