// ============================================================
// app.js
// Save this file as: app.js
// Place in the same folder as index.html and styles.css
// ============================================================

/* ══════════════════════════════════════════════════════════
   CONSTANTS & STATE
══════════════════════════════════════════════════════════ */
const LS_KEY_API  = 'gemini_api_key';
const LS_KEY_CHAT = 'gemini_chat_history';

// Gemini REST endpoint (gemini-1.5-flash — fast & free-tier friendly)
const GEMINI_URL = key =>
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;

// In-memory copy of chat messages: [{ role:'user'|'bot', text }]
let chatHistory = [];

/* ══════════════════════════════════════════════════════════
   DOM REFS
══════════════════════════════════════════════════════════ */
const $  = id => document.getElementById(id);
const messagesEl  = $('messages');
const chatWindow  = $('chat-window');
const userInput   = $('user-input');
const sendBtn     = $('send-btn');
const apiKeyInput = $('api-key-input');
const saveKeyBtn  = $('save-key-btn');
const keyStatus   = $('key-status');
const clearChatBtn= $('clear-chat-btn');
const clearKeyBtn = $('clear-key-btn');
const canvasEl    = $('canvas');
const canvasArea  = $('canvas-area');
const menuToggle  = $('menu-toggle');
const sidebar     = $('sidebar');

/* ══════════════════════════════════════════════════════════
   MOBILE SIDEBAR OVERLAY
══════════════════════════════════════════════════════════ */
// Inject overlay element
const overlay = document.createElement('div');
overlay.id = 'sidebar-overlay';
document.body.appendChild(overlay);

function openSidebar()  { sidebar.classList.add('open');  overlay.classList.add('active'); }
function closeSidebar() { sidebar.classList.remove('open'); overlay.classList.remove('active'); }

menuToggle.addEventListener('click', () =>
  sidebar.classList.contains('open') ? closeSidebar() : openSidebar()
);
overlay.addEventListener('click', closeSidebar);

/* ══════════════════════════════════════════════════════════
   API KEY — LOAD / SAVE / CLEAR
══════════════════════════════════════════════════════════ */
function getApiKey() {
  return localStorage.getItem(LS_KEY_API) || '';
}

function loadApiKeyUI() {
  const key = getApiKey();
  if (key) {
    apiKeyInput.value = key;
    setKeyStatus('Key loaded ✓', 'ok');
  }
}

function setKeyStatus(msg, type = '') {
  keyStatus.textContent = msg;
  keyStatus.className   = 'key-status ' + type;
}

saveKeyBtn.addEventListener('click', () => {
  const val = apiKeyInput.value.trim();
  if (!val) { setKeyStatus('Enter a key first.', 'err'); return; }
  localStorage.setItem(LS_KEY_API, val);
  setKeyStatus('Saved to localStorage ✓', 'ok');
  closeSidebar();
});

clearKeyBtn.addEventListener('click', () => {
  localStorage.removeItem(LS_KEY_API);
  apiKeyInput.value = '';
  setKeyStatus('Key removed.', '');
});

/* ══════════════════════════════════════════════════════════
   CHAT HISTORY — PERSIST / LOAD
══════════════════════════════════════════════════════════ */
function saveChatHistory() {
  localStorage.setItem(LS_KEY_CHAT, JSON.stringify(chatHistory));
}

function loadChatHistory() {
  try {
    const raw = localStorage.getItem(LS_KEY_CHAT);
    chatHistory = raw ? JSON.parse(raw) : [];
  } catch { chatHistory = []; }

  // Render persisted messages
  chatHistory.forEach(m => renderMessage(m.role, m.text, false));
  scrollToBottom();
}

clearChatBtn.addEventListener('click', () => {
  if (!confirm('Clear all chat history?')) return;
  chatHistory = [];
  saveChatHistory();
  messagesEl.innerHTML = '';
  canvasEl.innerHTML   = '';
  closeSidebar();
});

/* ══════════════════════════════════════════════════════════
   RENDER A MESSAGE BUBBLE
══════════════════════════════════════════════════════════ */
function renderMessage(role, text, animate = true) {
  const wrap = document.createElement('div');
  wrap.className = `msg ${role}`;
  if (!animate) wrap.style.animation = 'none';

  const avatar = document.createElement('div');
  avatar.className = 'msg-avatar';
  avatar.textContent = role === 'user' ? '👤' : '✦';

  const body = document.createElement('div');
  body.className = 'msg-body';

  const name = document.createElement('div');
  name.className = 'msg-name';
  name.textContent = role === 'user' ? 'You' : 'Gemini';

  const bubble = document.createElement('div');
  bubble.className = 'msg-text';
  // Convert markdown-ish code fences to <pre><code>
  bubble.innerHTML = formatText(text);

  body.appendChild(name);
  body.appendChild(bubble);
  wrap.appendChild(avatar);
  wrap.appendChild(body);
  messagesEl.appendChild(wrap);
  return wrap;
}

/** Minimal text formatter: fenced code blocks → <pre><code>, inline `code` → <code> */
function formatText(raw) {
  // Escape HTML first
  let escaped = raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Fenced code blocks ```lang\n...\n```
  escaped = escaped.replace(/```[\w]*\n?([\s\S]*?)```/g, (_, code) =>
    `<pre><code>${code.trim()}</code></pre>`
  );

  // Inline code
  escaped = escaped.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Line breaks
  escaped = escaped.replace(/\n/g, '<br>');

  return escaped;
}

/* ══════════════════════════════════════════════════════════
   TYPING INDICATOR
══════════════════════════════════════════════════════════ */
function showTyping() {
  const wrap = document.createElement('div');
  wrap.className = 'msg bot';
  wrap.id = 'typing-indicator';

  const avatar = document.createElement('div');
  avatar.className = 'msg-avatar';
  avatar.textContent = '✦';

  const body = document.createElement('div');
  body.className = 'msg-body';

  const name = document.createElement('div');
  name.className = 'msg-name';
  name.textContent = 'Gemini';

  const dots = document.createElement('div');
  dots.className = 'msg-text typing-dots';
  dots.innerHTML = '<span></span><span></span><span></span>';

  body.appendChild(name);
  body.appendChild(dots);
  wrap.appendChild(avatar);
  wrap.appendChild(body);
  messagesEl.appendChild(wrap);
  scrollToBottom();
  return wrap;
}
function hideTyping() {
  const el = $('typing-indicator');
  if (el) el.remove();
}

/* ══════════════════════════════════════════════════════════
   SCROLL
══════════════════════════════════════════════════════════ */
function scrollToBottom() {
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

/* ══════════════════════════════════════════════════════════
   SYSTEM PROMPT — tells Gemini how to behave
══════════════════════════════════════════════════════════ */
const SYSTEM_PROMPT = `You are an AI assistant embedded in a chat interface that also has a live DOM canvas.

When the user asks you to CREATE or ADD a UI component (button, counter, todo list, input form, color picker, timer, calculator, etc.):
1. Respond with a brief friendly sentence confirming you are creating it.
2. Then output a SINGLE fenced JavaScript code block (no HTML file, no CSS file) that:
   - Creates DOM elements programmatically using document.createElement.
   - Applies inline styles or injects a <style> tag for styling.
   - Appends the root element to a div with id="canvas".
   - Wraps everything in an immediately-invoked function to avoid global scope pollution.
   - Is completely self-contained — no external libraries.
   - Uses the accent color #f5a623 for primary interactive elements.
   - Gives the widget a visible heading/label.
3. Do NOT use document.write, alert, or redirect.
4. Keep code clean, readable, and fully functional.

For ALL other messages: respond naturally and helpfully as a conversational AI assistant.
Keep responses concise unless the user asks for detail.`;

/* ══════════════════════════════════════════════════════════
   CALL GEMINI API
══════════════════════════════════════════════════════════ */
async function callGemini(userText) {
  const key = getApiKey();
  if (!key) {
    return '⚠️ No API key found. Please paste your Gemini API key in the sidebar and save it.';
  }

  // Build the contents array with the system instruction prepended as a user turn
  // (Gemini REST doesn't have a separate system role in this endpoint)
  const contents = [
    { role: 'user',  parts: [{ text: SYSTEM_PROMPT }] },
    { role: 'model', parts: [{ text: 'Understood. I am ready to help.' }] },
    // Include last N turns for context (keeps prompt small)
    ...chatHistory.slice(-10).map(m => ({
      role:  m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }]
    })),
    { role: 'user', parts: [{ text: userText }] }
  ];

  const body = {
    contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 2048
    }
  };

  let response;
  try {
    response = await fetch(GEMINI_URL(key), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (networkErr) {
    return `⚠️ Network error: ${networkErr.message}. Check your connection.`;
  }

  if (!response.ok) {
    let errMsg = `API error ${response.status}`;
    try {
      const errData = await response.json();
      errMsg += ': ' + (errData?.error?.message || JSON.stringify(errData));
    } catch { /* ignore */ }
    if (response.status === 400) errMsg += '\n\nTip: Check your API key is valid and has Gemini access.';
    if (response.status === 429) errMsg += '\n\nTip: You have hit the rate limit. Wait a moment and retry.';
    return `⚠️ ${errMsg}`;
  }

  let data;
  try {
    data = await response.json();
  } catch {
    return '⚠️ Failed to parse the API response. Please try again.';
  }

  // Extract text
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return '⚠️ Gemini returned an empty response. Try rephrasing your message.';

  return text;
}

/* ══════════════════════════════════════════════════════════
   EXECUTE JAVASCRIPT FROM AI RESPONSE
══════════════════════════════════════════════════════════ */
function extractAndRunCode(botReply) {
  // Match ```js ... ``` or ```javascript ... ``` or plain ``` ... ```
  const codeMatch = botReply.match(/```(?:javascript|js)?\s*([\s\S]*?)```/i);
  if (!codeMatch) return; // No code block found

  const code = codeMatch[1].trim();
  if (!code) return;

  // Show canvas area
  canvasArea.style.display = 'block';

  // Safety: only execute if it doesn't contain obviously dangerous patterns
  const dangerous = [
    /\beval\s*\(/i,
    /\bdocument\.write\s*\(/i,
    /\bwindow\.location\s*=/i,
    /fetch\s*\(/i,
    /XMLHttpRequest/i,
    /\blocalStorage\.clear\s*\(/i
  ];
  for (const pattern of dangerous) {
    if (pattern.test(code)) {
      console.warn('Blocked potentially unsafe code pattern:', pattern);
      appendBotNote('⚠️ The generated code was blocked for safety reasons.');
      return;
    }
  }

  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function('canvas', code);
    fn(canvasEl);
    // Scroll canvas into view
    canvasArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (err) {
    console.error('Code execution error:', err);
    appendBotNote(`⚠️ The widget code had a runtime error: ${err.message}`);
  }
}

/** Append a small note bubble without saving to history */
function appendBotNote(text) {
  renderMessage('bot', text);
  scrollToBottom();
}

/* ══════════════════════════════════════════════════════════
   SEND A MESSAGE
══════════════════════════════════════════════════════════ */
async function sendMessage() {
  const text = userInput.value.trim();
  if (!text) return;

  // Lock UI
  userInput.value = '';
  userInput.style.height = 'auto';
  sendBtn.disabled = true;

  // Show user message
  renderMessage('user', text);
  chatHistory.push({ role: 'user', text });
  saveChatHistory();
  scrollToBottom();

  // Show typing
  showTyping();

  // Call API
  const reply = await callGemini(text);

  // Hide typing, show bot reply
  hideTyping();
  renderMessage('bot', reply);
  chatHistory.push({ role: 'bot', text: reply });
  saveChatHistory();
  scrollToBottom();

  // Attempt to run any JS code block in the reply
  extractAndRunCode(reply);

  // Unlock UI
  sendBtn.disabled = false;
  userInput.focus();
}

/* ══════════════════════════════════════════════════════════
   INPUT BAR EVENTS
══════════════════════════════════════════════════════════ */
// Auto-resize textarea
userInput.addEventListener('input', () => {
  userInput.style.height = 'auto';
  userInput.style.height = Math.min(userInput.scrollHeight, 160) + 'px';
});

// Enter to send (Shift+Enter = newline)
userInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

sendBtn.addEventListener('click', sendMessage);

/* ══════════════════════════════════════════════════════════
   HINT CHIPS
══════════════════════════════════════════════════════════ */
document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    userInput.value = chip.dataset.hint;
    userInput.focus();
    closeSidebar();
    sendMessage();
  });
});

/* ══════════════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════════════ */
(function init() {
  loadApiKeyUI();
  loadChatHistory();

  // If no history, show a welcome message
  if (chatHistory.length === 0) {
    renderMessage('bot',
      `👋 Welcome to Chat Studio!\n\n` +
      `1. Paste your **Gemini API key** in the sidebar (click ☰ on mobile).\n` +
      `2. Chat naturally, or try a command like:\n` +
      `   • *create a counter*\n` +
      `   • *create a todo list*\n` +
      `   • *add a color picker*\n\n` +
      `Generated widgets will appear in the panel below. Let's go! ✦`,
      false
    );
  }

  // Hide canvas if empty
  if (!canvasEl.innerHTML.trim()) {
    canvasArea.style.display = 'none';
  }
})();
