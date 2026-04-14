'use strict';

// --- State Management ---
const state = {
    mcq: { dup: false, shuffle: false, shuffleOpts: false, number: false, clean: false },
    yt: { lower: false, capitalize: false },
    hash: { pascal: false, lower: false },
    imgTheme: 'dark',
    imgGradient: 'sunset'
};

const GRADIENTS = {
    sunset: { hex1: '#ff7A00', hex2: '#ff004D', rgb1: '255, 122, 0', rgb2: '255, 0, 77' },
    ocean: { hex1: '#06b6d4', hex2: '#3b82f6', rgb1: '6, 182, 212', rgb2: '59, 130, 246' },
    neon: { hex1: '#8b5cf6', hex2: '#d946ef', rgb1: '139, 92, 246', rgb2: '217, 70, 239' },
    nature: { hex1: '#10b981', hex2: '#14b8a6', rgb1: '16, 185, 129', rgb2: '20, 184, 166' }
};

// --- DOM Elements & Listeners ---
document.getElementById('themeBtn').addEventListener('click', toggleTheme);
const navItems = document.querySelectorAll('.nav-item');
const views = document.querySelectorAll('.view');

navItems.forEach(item => {
    item.addEventListener('click', () => {
        navItems.forEach(n => n.classList.remove('active'));
        item.classList.add('active');
        const target = item.getAttribute('data-target');
        views.forEach(v => {
            if (v.id === 'view-' + target) v.classList.add('active');
            else v.classList.remove('active');
        });
        if (target === 'img') drawMCQImage();
    });
});

document.querySelectorAll('.color-swatch').forEach(swatch => {
    swatch.addEventListener('click', (e) => {
        document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
        e.target.classList.add('active');
        state.imgGradient = e.target.getAttribute('data-gradient');
        drawMCQImage();
    });
});

document.querySelectorAll('.toggle').forEach(toggleElement => {
    toggleElement.addEventListener('click', (e) => {
        const tool = e.target.getAttribute('data-tool');
        const key = e.target.getAttribute('data-key');

        if (tool === 'hash') {
            if (key === 'pascal' && !state.hash.pascal) state.hash.lower = false;
            if (key === 'lower' && !state.hash.lower) state.hash.pascal = false;
        }
        if (tool === 'yt') {
            if (key === 'capitalize' && !state.yt.capitalize) state.yt.lower = false;
            if (key === 'lower' && !state.yt.lower) state.yt.capitalize = false;
        }
        if (tool === 'img') {
            state.imgTheme = key;
            document.getElementById('img-theme-dark').classList.toggle('active', key === 'dark');
            document.getElementById('img-theme-light').classList.toggle('active', key === 'light');
            drawMCQImage();
            return;
        }

        state[tool][key] = !state[tool][key];
        document.querySelectorAll(`.toggle[data-tool="${tool}"]`).forEach(el => {
            let k = el.getAttribute('data-key');
            el.classList.toggle('active', state[tool][k]);
        });
    });
});

document.getElementById('yt-input').addEventListener('keypress', function (e) { if (e.key === 'Enter') processYt(); });
document.getElementById('hash-input').addEventListener('keypress', function (e) { if (e.key === 'Enter') processHash(); });
document.getElementById('fancy-input').addEventListener('input', generateFancyText);
document.getElementById('img-input').addEventListener('input', drawMCQImage);
document.getElementById('img-watermark').addEventListener('input', drawMCQImage);


// ==========================================
// INTERNET FETCHING APIS
// ==========================================
async function fetchFromRapidTags(query, type = 'YouTube') {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://rapidtags.io/api/generator?query=${query}&type=${type}`)}`;
    try {
        const response = await fetch(proxyUrl);
        const data = await response.json();
        return (data && data.tags) ? data.tags : null;
    } catch { return null; }
}

function fetchGoogleSuggest(query) {
    return new Promise((resolve) => {
        const cbName = 'yt_cb_' + Math.random().toString(36).substring(2, 9);
        window[cbName] = function (data) {
            delete window[cbName];
            document.head.removeChild(script);
            resolve((data && data[1]) ? data[1].map(i => i[0]) : []);
        };
        const script = document.createElement('script');
        script.src = `https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&q=${encodeURIComponent(query)}&jsonp=${cbName}`;
        script.onerror = () => { document.head.removeChild(script); resolve([]); };
        document.head.appendChild(script);
    });
}

// ==========================================
// TOOL 1: MCQ Formatter (FIXED LOGIC)
// ==========================================
function shuffleMcqInternals(block) {
    let lines = block.split('\n');
    let preText = [];
    let options = [];
    let postText = [];
    let originalOptionsMap = {};
    let ansLineObj = null;
    let foundFirstOption = false;

    const optRegex = /^([A-Ea-e])[\)\.]\s*(.*)/;
    const ansRegex = /^(?:correct\s+)?answer[\s:]/i;

    for (let line of lines) {
        let tLine = line.trim();
        if (!tLine) continue;

        // Catch the answer line
        if (ansRegex.test(tLine)) {
            ansLineObj = tLine;
            foundFirstOption = true;
            continue;
        }

        // Catch options
        let optMatch = tLine.match(optRegex);
        if (optMatch) {
            foundFirstOption = true;
            let letter = optMatch[1].toUpperCase();
            let text = optMatch[2].trim();
            options.push(text);
            originalOptionsMap[letter] = text;
        } else {
            // Sort remaining text into "before options" (Questions) or "after options" (explanations, next question)
            if (!foundFirstOption) {
                preText.push(tLine);
            } else {
                postText.push(tLine);
            }
        }
    }

    if (options.length <= 1) return block;

    // Shuffle the options
    for (let i = options.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [options[i], options[j]] = [options[j], options[i]];
    }

    // Rename A, B, C, D
    let letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    let newOptionsLines = options.map((opt, i) => `${letters[i]}) ${opt}`);

    let finalAnswerLine = ansLineObj;

    // Automatically update the Correct Answer letter to match the shuffled options
    if (ansLineObj) {
        let ansMatch = ansLineObj.match(/^(?:correct\s+)?answer[\s:]*/i);
        let answerPrefix = ansMatch ? ansMatch[0] : "Correct Answer: ";
        let rawAns = ansLineObj.substring(answerPrefix.length).trim();
        let correctAnswerText = "";

        let stripAns = rawAns.match(optRegex);
        if (stripAns) correctAnswerText = stripAns[2].trim();
        else {
            let justLetterMatch = rawAns.match(/^([A-Ea-e])[\)\.]?$/);
            if (justLetterMatch) correctAnswerText = originalOptionsMap[justLetterMatch[1].toUpperCase()] || rawAns;
            else correctAnswerText = rawAns;
        }

        let normCorrect = correctAnswerText.toLowerCase().replace(/\s+/g, ' ').trim();
        let foundIdx = options.findIndex(opt => {
            let normOpt = opt.toLowerCase().replace(/\s+/g, ' ').trim();
            return normOpt === normCorrect || normOpt.includes(normCorrect) || normCorrect.includes(normOpt);
        });

        if (foundIdx !== -1) finalAnswerLine = `${answerPrefix}${letters[foundIdx]}) ${options[foundIdx]}`;
    }

    // Rebuild the block perfectly
    let result = preText.join('\n');
    result += '\n' + newOptionsLines.join('\n');
    if (finalAnswerLine) result += '\n' + finalAnswerLine;
    if (postText.length > 0) result += '\n' + postText.join('\n');

    return result;
}

function processMcq() {
    let text = document.getElementById('mcq-input').value.trim();
    if (!text) return clearTool('mcq');

    let blocks = text.split(/\n\n+/).filter(b => b.trim());
    let removed = 0;

    // FIX: ONLY remove next question if Clean Text toggle is on!
    if (state.mcq.clean) {
        blocks = blocks.map(b => b.replace(/next question/gi, '').trim());
        blocks = blocks.map(b => b.replace(/^(?:correct\s+)?answer[\s:].*/gim, '').trim());
        blocks = blocks.filter(b => b.trim() !== ''); // Remove completely empty blocks created by cleaning
    }

    if (state.mcq.dup) {
        let set = new Set();
        blocks = blocks.filter(b => {
            let key = b.toLowerCase().replace(/\s+/g, ' ').trim();
            if (set.has(key)) { removed++; return false; }
            set.add(key); return true;
        });
    }

    if (state.mcq.shuffle) {
        for (let i = blocks.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
        }
    }

    if (state.mcq.shuffleOpts) {
        blocks = blocks.map(b => shuffleMcqInternals(b));
    }

    if (state.mcq.number) {
        blocks = blocks.map((b, i) => `${i + 1}. ${b.replace(/^(Q?\d+[\.\)]\s*)/i, '')}`);
    }

    let out = blocks.join("\n\n");
    document.getElementById('mcq-output').value = out;
    document.getElementById('mcq-q').textContent = blocks.length;
    document.getElementById('mcq-w').textContent = out ? out.split(/\s+/).length : 0;
    document.getElementById('mcq-r').textContent = removed;
}

// ==========================================
// TOOL 2: YouTube Tags & Hashtags 
// ==========================================
async function processYt() {
    let keyword = document.getElementById('yt-input').value.trim();
    if (!keyword) return clearTool('yt');

    let btn = document.getElementById('yt-generate-btn');
    btn.innerHTML = "Wait..."; btn.disabled = true;

    try {
        let rawTags = await fetchFromRapidTags(keyword, 'YouTube');
        if (!rawTags) {
            let res = await Promise.all([fetchGoogleSuggest(keyword), fetchGoogleSuggest(keyword + " ")]);
            rawTags = [...res[0], ...res[1]];
            rawTags.unshift(keyword);
        }

        let tags = []; let seen = new Set();
        rawTags.forEach(t => {
            let low = t.toLowerCase();
            if (!seen.has(low) && t.length > 1) {
                seen.add(low);
                if (state.yt.capitalize) t = t.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                else if (state.yt.lower) t = t.toLowerCase();
                tags.push(t);
            }
        });

        let out = tags.join(", ");
        document.getElementById('yt-output').value = out;
        document.getElementById('yt-count').textContent = tags.length;
        document.getElementById('yt-chars').textContent = `${out.length}/500`;
        document.getElementById('yt-chars').style.color = out.length > 500 ? '#ef4444' : 'inherit';
    } finally { btn.innerHTML = "Generate"; btn.disabled = false; }
}

async function processHash() {
    let keyword = document.getElementById('hash-input').value.trim();
    if (!keyword) return clearTool('hash');

    let btn = document.getElementById('hash-generate-btn');
    btn.innerHTML = "Wait..."; btn.disabled = true;

    try {
        let rawTags = await fetchFromRapidTags(keyword, 'TikTok');
        if (!rawTags) {
            let res = await Promise.all([fetchGoogleSuggest(keyword), fetchGoogleSuggest(keyword + " ")]);
            rawTags = [...res[0], ...res[1]];
        }

        let tags = []; let seen = new Set();
        const addTag = (text) => {
            let cleaned = text.replace(/[^\p{L}\p{N}\s]+/gu, '').trim();
            if (!cleaned || cleaned.length < 3) return;

            let str = '';
            if (state.hash.pascal) str = cleaned.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
            else if (state.hash.lower) str = cleaned.toLowerCase().replace(/\s+/g, '');
            else str = cleaned.replace(/\s+/g, '');

            let finalTag = '#' + str;
            if (!seen.has(finalTag.toLowerCase())) { seen.add(finalTag.toLowerCase()); tags.push(finalTag); }
        };

        keyword.split(/\s+/).forEach(w => { if (w.length > 2) addTag(w); });
        addTag(keyword);
        rawTags.forEach(t => addTag(t));

        document.getElementById('hash-output').value = tags.join(" ");
        document.getElementById('hash-count').textContent = tags.length;
    } finally { btn.innerHTML = "Generate"; btn.disabled = false; }
}

// ==========================================
// TOOL 3: Fancy Text Generator
// ==========================================
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const FONT_MAPS = {
    'Bold': '𝗔𝗕𝗖𝗗𝗘𝗙𝗚𝗛𝗜𝗝𝗞𝗟𝗠𝗡𝗢𝗣𝗤𝗥𝗦𝗧𝗨𝗩𝗪𝗫𝗬𝗭𝗮𝗯𝗰𝗱𝗲𝗳𝗴𝗵𝗶𝗷𝗸𝗹𝗺𝗻𝗼𝗽𝗾𝗿𝘀𝘁𝘂𝘃𝘄𝘅𝘆𝘇𝟬𝟭𝟮𝟯𝟰𝟱𝟲𝟳𝟴𝟵',
    'Italic': '𝘈𝘉𝘊𝘋𝘌𝘍𝘎𝘏𝘐𝘑𝘒𝘓𝘔𝘕𝘖𝘗𝘘𝘙𝘚𝘛𝘜𝘝𝘞𝘟𝘠𝘡𝘢𝘣𝘤𝘥𝘦𝘧𝘨𝘩𝘪𝘫𝘬𝘭𝘮𝘯𝘰𝘱𝘲𝘳𝘴𝘵𝘶𝘷𝘸𝘹𝘺𝘻0123456789',
    'Monospace': '𝙰𝙱𝙲𝙳𝙴𝙵𝙶𝙷𝙸𝙹𝙺𝙻𝙼𝙽𝙾𝙿𝚀𝚁𝚂𝚃𝚄𝚅𝚆𝚇𝚈𝚉𝚊𝚋𝚌𝚍𝚎𝚏𝚐𝚑𝚒𝚓𝚔𝚕𝚖𝚗𝚘𝚙𝚚𝚛𝚜𝚝𝚞𝚟𝚠𝚡𝚢𝚣𝟶𝟷𝟸𝟹𝟺𝟻𝟼𝟽𝟾𝟿',
    'Script': '𝒜ℬ𝒞𝒟ℰℱ𝒢ℋℐ𝒥𝒦ℒℳ𝒩𝒪𝒫𝒬ℛ𝒮𝒯𝒰𝒱𝒲𝒳𝒴𝒵𝒶𝒷𝒸𝒹ℯ𝒻ℊ𝒽𝒾𝒿𝓀𝓁𝓂𝓃ℴ𝓅𝓆𝓇𝓈𝓉𝓊𝓋𝓌𝓍𝓎𝓏0123456789'
};

function generateFancyText() {
    let input = document.getElementById('fancy-input').value || "Type your text here...";
    let grid = document.getElementById('fancy-outputs'); grid.innerHTML = '';

    for (let font in FONT_MAPS) {
        let map = Array.from(FONT_MAPS[font]);
        let conv = '';
        for (let char of input) {
            let idx = CHARS.indexOf(char);
            conv += (idx !== -1) ? map[idx] : char;
        }
        grid.innerHTML += `<div class="fancy-item"><div class="fancy-text">${conv}</div><button class="btn-secondary" onclick="copyDirect('${conv}', this)">Copy</button></div>`;
    }
}
generateFancyText();

// ==========================================
// TOOL 4: MCQ Image Generator
// ==========================================
function drawMCQImage() {
    const canvas = document.getElementById('mcq-canvas');
    const ctx = canvas.getContext('2d');
    let text = document.getElementById('img-input').value.trim();
    let watermarkText = document.getElementById('img-watermark').value.trim() || "Made With ❤️ by SM";
    let activeGrad = GRADIENTS[state.imgGradient];

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = state.imgTheme === 'dark' ? '#09090b' : '#f8fafc';
    ctx.fillRect(0, 0, 1080, 1080);

    const drawOrb = (x, y, r, c1, c2) => {
        let grad = ctx.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, c1); grad.addColorStop(1, c2);
        ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    };

    let i1 = state.imgTheme === 'dark' ? '0.4' : '0.2';
    drawOrb(200, 200, 650, `rgba(${activeGrad.rgb1}, ${i1})`, `rgba(${activeGrad.rgb1}, 0)`);
    drawOrb(900, 900, 750, `rgba(${activeGrad.rgb2}, ${i1})`, `rgba(${activeGrad.rgb2}, 0)`);

    if (!text) text = "Which country is known as the 'Land of the Rising Sun'?\nA) Taiwan\nB) India\nC) Australia\nD) Japan";

    let lines = text.split('\n').map(l => l.trim()).filter(l => l !== '');
    let question = ""; let options = [];
    lines.forEach(l => { if (/^[A-Ea-e][\)\.]\s/.test(l)) options.push(l); else if (!/^(?:correct\s+)?answer/i.test(l)) question += l + " "; });

    if (!question) question = "Enter your question here...";
    if (options.length === 0) options = ["A) Option 1", "B) Option 2"];

    const tc = state.imgTheme === 'dark' ? '#ffffff' : '#09090b';
    ctx.fillStyle = tc;
    ctx.font = 'bold 55px system-ui, sans-serif';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';

    let y = 140; let line = '';
    question.split(' ').forEach(w => {
        let test = line + w + ' ';
        if (ctx.measureText(test).width > 900 && line !== '') { ctx.fillText(line, 80, y); line = w + ' '; y += 70; }
        else { line = test; }
    });
    ctx.fillText(line, 80, y); y += 120;

    ctx.font = '50px system-ui, sans-serif';
    options.slice(0, 5).forEach((opt) => {
        ctx.save();
        ctx.shadowColor = state.imgTheme === 'dark' ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.1)';
        ctx.shadowBlur = 30; ctx.shadowOffsetY = 15;
        ctx.fillStyle = state.imgTheme === 'dark' ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.6)';
        ctx.beginPath(); ctx.roundRect(80, y, 920, 100, 20); ctx.fill(); ctx.restore();

        ctx.lineWidth = 1.5; ctx.strokeStyle = state.imgTheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.8)'; ctx.stroke();

        let aGrad = ctx.createLinearGradient(80, y, 80, y + 100);
        aGrad.addColorStop(0, activeGrad.hex1); aGrad.addColorStop(1, activeGrad.hex2);
        ctx.fillStyle = aGrad; ctx.beginPath(); ctx.roundRect(80, y, 12, 100, [20, 0, 0, 20]); ctx.fill();

        ctx.fillStyle = tc;
        ctx.fillText(ctx.measureText(opt).width > 830 ? opt.substring(0, 35) + "..." : opt, 120, y + 25);
        y += 130;
    });

    ctx.fillStyle = state.imgTheme === 'dark' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)';
    ctx.font = '28px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(watermarkText, 540, 1020);
}

function downloadImage() {
    let link = document.createElement('a'); link.download = 'Community_Post.png';
    link.href = document.getElementById('mcq-canvas').toDataURL('image/png'); link.click();
}

// ==========================================
// UTILITIES
// ==========================================

// NEW FUNCTION: Moves generated output back into the input box
function moveOutputToInput(tool) {
    let output = document.getElementById(`${tool}-output`).value;
    if (output) {
        document.getElementById(`${tool}-input`).value = output;
        document.getElementById(`${tool}-output`).value = ''; // Optional: clears output
    }
}

function copyOutput(outputId, btnId) {
    let txt = document.getElementById(outputId).value;
    if (txt) executeCopy(txt, document.getElementById(btnId));
}

function copyDirect(text, btn) { executeCopy(text, btn); }

function executeCopy(text, btn) {
    navigator.clipboard.writeText(text).then(() => {
        let og = btn.innerHTML; btn.innerHTML = "Copied! ✅";
        setTimeout(() => { btn.innerHTML = og; }, 2000);
    });
}

function clearTool(tool) {
    if (document.getElementById(`${tool}-input`)) document.getElementById(`${tool}-input`).value = "";
    if (document.getElementById(`${tool}-output`)) document.getElementById(`${tool}-output`).value = "";

    // Reset stats when clear is clicked
    if (tool === 'mcq') {
        document.getElementById('mcq-q').textContent = '0';
        document.getElementById('mcq-w').textContent = '0';
        document.getElementById('mcq-r').textContent = '0';
    }
}

function toggleTheme() {
    let root = document.documentElement;
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    if (document.getElementById('view-img').classList.contains('active')) drawMCQImage();
}

// --- DONATE MODAL LOGIC ---
document.getElementById('footerDonateBtn').addEventListener('click', () => document.getElementById('donateModal').classList.add('active'));
document.getElementById('floatingDonateBtn').addEventListener('click', () => document.getElementById('donateModal').classList.add('active'));
document.getElementById('closeDonateBtn').addEventListener('click', () => document.getElementById('donateModal').classList.remove('active'));
