'use strict';

// --- State Management ---
const state = {
    mcq: { dup: false, shuffle: false, shuffleOpts: false, number: false, clean: false },
    yt: { lower: false, capitalize: false },
    hash: { pascal: false, lower: false },
    imgTheme: 'dark',
    imgGradient: 'sunset'
};

// --- Gradient Color Dictionary ---
const GRADIENTS = {
    sunset: { hex1: '#f58529', hex2: '#dd2a7b', rgb1: '245, 133, 41', rgb2: '221, 42, 123' },
    ocean: { hex1: '#06b6d4', hex2: '#3b82f6', rgb1: '6, 182, 212', rgb2: '59, 130, 246' },
    neon: { hex1: '#8b5cf6', hex2: '#d946ef', rgb1: '139, 92, 246', rgb2: '217, 70, 239' },
    nature: { hex1: '#10b981', hex2: '#14b8a6', rgb1: '16, 185, 129', rgb2: '20, 184, 166' },
    fire: { hex1: '#ef4444', hex2: '#eab308', rgb1: '239, 68, 68', rgb2: '234, 179, 8' }
};

// --- DOM Elements ---
const themeBtn = document.getElementById('themeBtn');
const toggleDivs = document.querySelectorAll('.toggle');
const navItems = document.querySelectorAll('.nav-item');
const views = document.querySelectorAll('.view');
const viewTitle = document.getElementById('view-title');

const donateModal = document.getElementById('donateModal');
const footerDonateBtn = document.getElementById('footerDonateBtn');
const floatingDonateBtn = document.getElementById('floatingDonateBtn');
const closeDonateBtn = document.getElementById('closeDonateBtn');

// --- Initialization & Event Listeners ---
themeBtn.addEventListener('click', toggleTheme);
footerDonateBtn.addEventListener('click', openDonate);
floatingDonateBtn.addEventListener('click', openDonate);
closeDonateBtn.addEventListener('click', closeDonate);

setTimeout(() => { floatingDonateBtn.style.display = 'flex'; }, 1);

// Navigation Switcher
navItems.forEach(item => {
    item.addEventListener('click', () => {
        navItems.forEach(n => n.classList.remove('active'));
        item.classList.add('active');
        viewTitle.textContent = item.textContent;

        const target = item.getAttribute('data-target');
        views.forEach(v => {
            if (v.id === 'view-' + target) v.classList.add('active');
            else v.classList.remove('active');
        });

        if (target === 'img') drawMCQImage();
    });
});

// Gradient Swatch Event Listeners
document.querySelectorAll('.color-swatch').forEach(swatch => {
    swatch.addEventListener('click', (e) => {
        document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
        e.target.classList.add('active');
        state.imgGradient = e.target.getAttribute('data-gradient');
        drawMCQImage();
    });
});

// Toggle Buttons
toggleDivs.forEach(toggleElement => {
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

        // Special logic for Image Theme Radio Buttons
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

        if (tool === 'mcq') processMcq();
    });
});

document.getElementById('mcq-input').addEventListener('input', processMcq);
document.getElementById('yt-input').addEventListener('keypress', function (e) { if (e.key === 'Enter') processYt(); });
document.getElementById('hash-input').addEventListener('keypress', function (e) { if (e.key === 'Enter') processHash(); });

document.getElementById('fancy-input').addEventListener('input', generateFancyText);
document.getElementById('img-input').addEventListener('input', drawMCQImage);
document.getElementById('img-watermark').addEventListener('input', drawMCQImage);

// --- INTERNET FETCHING APIS ---
async function fetchFromRapidTags(query, type = 'YouTube') {
    const targetUrl = `https://rapidtags.io/api/generator?query=${encodeURIComponent(query)}&type=${type}`;
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
    try {
        const response = await fetch(proxyUrl);
        const data = await response.json();
        return (data && data.tags) ? data.tags : null;
    } catch (err) {
        return null;
    }
}

function fetchGoogleSuggest(query) {
    return new Promise((resolve) => {
        const cbName = 'yt_cb_' + Math.random().toString(36).substring(2, 9);
        window[cbName] = function (data) {
            delete window[cbName];
            document.head.removeChild(script);
            resolve((data && data[1]) ? data[1].map(item => item[0]) : []);
        };
        const script = document.createElement('script');
        script.src = `https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&q=${encodeURIComponent(query)}&jsonp=${cbName}`;
        script.onerror = () => { document.head.removeChild(script); resolve([]); };
        document.head.appendChild(script);
    });
}

// --- TOOL 1: MCQ Formatter ---
function shuffleMcqInternals(block) {
    let lines = block.split('\n');
    let questionLines = [];
    let options = [];
    let originalOptionsMap = {};
    let ansLineObj = null;

    const optRegex = /^([A-Ea-e])[\)\.]\s*(.*)/;
    const ansRegex = /^(?:correct\s+)?answer[\s:]/i;

    for (let line of lines) {
        let tLine = line.trim();
        if (!tLine) continue;

        if (ansRegex.test(tLine)) { ansLineObj = tLine; continue; }

        let optMatch = tLine.match(optRegex);
        if (optMatch) {
            let letter = optMatch[1].toUpperCase();
            let text = optMatch[2].trim();
            options.push(text);
            originalOptionsMap[letter] = text;
        } else {
            questionLines.push(tLine);
        }
    }

    if (options.length <= 1) return block;

    for (let i = options.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [options[i], options[j]] = [options[j], options[i]];
    }

    let letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    let newOptionsLines = options.map((opt, i) => `${letters[i]}) ${opt}`);

    let finalAnswerLine = ansLineObj;

    if (ansLineObj) {
        let ansMatch = ansLineObj.match(/^(?:correct\s+)?answer[\s:]*/i);
        let answerPrefix = ansMatch ? ansMatch[0] : "correct answer: ";
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

    let result = questionLines.join('\n');
    result += '\n' + newOptionsLines.join('\n');
    if (finalAnswerLine) result += '\n' + finalAnswerLine;

    return result;
}

function processMcq() {
    let text = document.getElementById('mcq-input').value.trim();
    if (!text) return clearTool('mcq');

    text = text.replace(/next question/gi, '');
    let blocks = text.split(/\n\n+/).filter(b => b.trim());
    let removed = 0;

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

    if (state.mcq.shuffleOpts) blocks = blocks.map(b => shuffleMcqInternals(b));
    if (state.mcq.clean) blocks = blocks.map(b => b.replace(/^(?:correct\s+)?answer[\s:].*/gim, '').trim());

    if (state.mcq.number) {
        blocks = blocks.map((b, i) => {
            let cleanBlock = b.replace(/^(Q?\d+[\.\)]\s*)/i, '');
            return `${i + 1}. ${cleanBlock}`;
        });
    }

    let out = blocks.join("\n\n");
    document.getElementById('mcq-output').value = out;
    document.getElementById('mcq-q').textContent = blocks.length;
    document.getElementById('mcq-w').textContent = out ? out.split(/\s+/).length : 0;
    document.getElementById('mcq-r').textContent = removed;
}

// --- TOOL 2: YouTube Tags Generator ---
async function processYt() {
    let keyword = document.getElementById('yt-input').value.trim();
    if (!keyword) return clearTool('yt');

    let btn = document.getElementById('yt-generate-btn');
    btn.innerHTML = "Fetching... ⏳";
    btn.disabled = true;

    try {
        let rawTags = await fetchFromRapidTags(keyword, 'YouTube');

        if (!rawTags || rawTags.length === 0) {
            const currentYear = new Date().getFullYear();
            let responses = await Promise.all([
                fetchGoogleSuggest(keyword),
                fetchGoogleSuggest(keyword + " "),
                fetchGoogleSuggest(keyword + " " + currentYear)
            ]);
            rawTags = [...responses[0], ...responses[1], ...responses[2]];
            rawTags.unshift(keyword);
        }

        let tags = [];
        let seen = new Set();

        rawTags.forEach(t => {
            let lowerMatch = t.toLowerCase();
            if (!seen.has(lowerMatch) && t.length > 1) {
                seen.add(lowerMatch);
                if (state.yt.capitalize) t = t.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                else if (state.yt.lower) t = t.toLowerCase();
                tags.push(t);
            }
        });

        let out = tags.join(", ");
        document.getElementById('yt-output').value = out;
        document.getElementById('yt-count').textContent = tags.length;
        let charDisplay = document.getElementById('yt-chars');
        charDisplay.textContent = `${out.length}/500`;
        charDisplay.style.color = out.length > 500 ? '#ef4444' : 'inherit';

    } catch (err) {
        alert("Failed to fetch tags. Check your connection.");
    } finally {
        btn.innerHTML = "🔍 Generate Tags";
        btn.disabled = false;
    }
}

// --- TOOL 3: Trending Hashtag Generator ---
async function processHash() {
    let keyword = document.getElementById('hash-input').value.trim();
    if (!keyword) return clearTool('hash');

    let btn = document.getElementById('hash-generate-btn');
    btn.innerHTML = "Fetching... ⏳";
    btn.disabled = true;

    try {
        let rawTags = await fetchFromRapidTags(keyword, 'TikTok');
        if (!rawTags || rawTags.length === 0) {
            let responses = await Promise.all([fetchGoogleSuggest(keyword), fetchGoogleSuggest(keyword + " ")]);
            rawTags = [...responses[0], ...responses[1]];
        }

        let tags = [];
        let seen = new Set();

        const addTag = (text) => {
            let words = text.trim().split(/\s+/);
            if (words.length > 4) return;

            let cleaned = text.replace(/[^\p{L}\p{N}\s]+/gu, '').trim();
            if (!cleaned || cleaned.length < 3) return;

            let formattedStr = '';
            if (state.hash.pascal) formattedStr = cleaned.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
            else if (state.hash.lower) formattedStr = cleaned.toLowerCase().replace(/\s+/g, '');
            else formattedStr = cleaned.replace(/\s+/g, '');

            let finalTag = '#' + formattedStr;
            let lowerMatch = finalTag.toLowerCase();

            if (!seen.has(lowerMatch)) {
                seen.add(lowerMatch);
                tags.push(finalTag);
            }
        };

        let coreWords = keyword.split(/\s+/);
        if (coreWords.length > 1) coreWords.forEach(w => { if (w.length > 2) addTag(w); });

        addTag(keyword);
        rawTags.forEach(t => addTag(t));

        let out = tags.join(" ");
        document.getElementById('hash-output').value = out;
        document.getElementById('hash-count').textContent = tags.length;

    } catch (err) {
        alert("Failed to fetch hashtags. Check your connection!");
    } finally {
        btn.innerHTML = "🔍 Generate Hashtags";
        btn.disabled = false;
    }
}

// --- TOOL 4: Fancy Text Generator ---
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const FONT_MAPS = {
    'Bold': '𝗔𝗕𝗖𝗗𝗘𝗙𝗚𝗛𝗜𝗝𝗞𝗟𝗠𝗡𝗢𝗣𝗤𝗥𝗦𝗧𝗨𝗩𝗪𝗫𝗬𝗭𝗮𝗯𝗰𝗱𝗲𝗳𝗴𝗵𝗶𝗷𝗸𝗹𝗺𝗻𝗼𝗽𝗾𝗿𝘀𝘁𝘂𝘃𝘄𝘅𝘆𝘇𝟬𝟭𝟮𝟯𝟰𝟱𝟲𝟳𝟴𝟵',
    'Italic': '𝘈𝘉𝘊𝘋𝘌𝘍𝘎𝘏𝘐𝘑𝘒𝘓𝘔𝘕𝘖𝘗𝘘𝘙𝘚𝘛𝘜𝘝𝘞𝘟𝘠𝘡𝘢𝘣𝘤𝘥𝘦𝘧𝘨𝘩𝘪𝘫𝘬𝘭𝘮𝘯𝘰𝘱𝘲𝘳𝘴𝘵𝘶𝘷𝘸𝘹𝘺𝘻0123456789',
    'Monospace': '𝙰𝙱𝙲𝙳𝙴𝙵𝙶𝙷𝙸𝙹𝙺𝙻𝙼𝙽𝙾𝙿𝚀𝚁𝚂𝚃𝚄𝚅𝚆𝚇𝚈𝚉𝚊𝚋𝚌𝚍𝚎𝚏𝚐𝚑𝚒𝚓𝚔𝚕𝚖𝚗𝚘𝚙𝚚𝚛𝚜𝚝𝚞𝚟𝚠𝚡𝚢𝚣𝟶𝟷𝟸𝟹𝟺𝟻𝟼𝟽𝟾𝟿',
    'Gothic': '𝕬𝕭𝕮𝕯𝕰𝕱𝕲𝕳𝕴𝕵𝕶𝕷𝕸𝕹𝕺𝕻𝕼𝕽𝕾𝕿𝖀𝖁𝖂𝖃𝖄𝖅𝖆𝖇𝖈𝖉𝖊𝖋𝖌𝖍𝖎𝖏𝖐𝖑𝖒𝖓𝖔𝖕𝖖𝖗𝖘𝖙𝖚𝖛𝖜𝖝𝖞𝖟0123456789',
    'Script': '𝒜ℬ𝒞𝒟ℰℱ𝒢ℋℐ𝒥𝒦ℒℳ𝒩𝒪𝒫𝒬ℛ𝒮𝒯𝒰𝒱𝒲𝒳𝒴𝒵𝒶𝒷𝒸𝒹ℯ𝒻ℊ𝒽𝒾𝒿𝓀𝓁𝓂𝓃ℴ𝓅𝓆𝓇𝓈𝓉𝓊𝓋𝓌𝓍𝓎𝓏0123456789'
};

function convertText(text, mapString) {
    let mapArray = Array.from(mapString);
    let result = '';
    for (let char of text) {
        let idx = CHARS.indexOf(char);
        result += (idx !== -1) ? mapArray[idx] : char;
    }
    return result;
}

function generateFancyText() {
    let input = document.getElementById('fancy-input').value;
    let grid = document.getElementById('fancy-outputs');
    grid.innerHTML = '';

    if (!input) input = "Type your text here...";

    for (let fontName in FONT_MAPS) {
        let converted = convertText(input, FONT_MAPS[fontName]);

        let div = document.createElement('div');
        div.className = 'fancy-item';
        div.innerHTML = `
            <div class="fancy-text">${converted}</div>
            <button class="fancy-copy-btn" onclick="copyDirect('${converted}', this)">Copy</button>
        `;
        grid.appendChild(div);
    }
}
generateFancyText();


// --- TOOL 5: MCQ to HTML Canvas Image (DYNAMIC GRADIENTS) ---
function drawMCQImage() {
    const canvas = document.getElementById('mcq-canvas');
    const ctx = canvas.getContext('2d');
    let text = document.getElementById('img-input').value.trim();
    let watermarkText = document.getElementById('img-watermark').value.trim();

    // Get Selected Gradient Colors
    let activeGrad = GRADIENTS[state.imgGradient];

    if (!watermarkText) watermarkText = "Generated by SM Tools";

    // 1. Base Background Color
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = state.imgTheme === 'dark' ? '#09090b' : '#f8fafc';
    ctx.fillRect(0, 0, 1080, 1080);

    // 2. Glowing Radial Orbs (Using Dynamic Colors)
    const drawOrb = (x, y, r, color1, color2) => {
        let grad = ctx.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, color1);
        grad.addColorStop(1, color2);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    };

    let intensity1 = state.imgTheme === 'dark' ? '0.45' : '0.25';
    let intensity2 = state.imgTheme === 'dark' ? '0.35' : '0.20';

    drawOrb(200, 200, 650, `rgba(${activeGrad.rgb1}, ${intensity1})`, `rgba(${activeGrad.rgb1}, 0)`);
    drawOrb(900, 900, 750, `rgba(${activeGrad.rgb2}, ${intensity2})`, `rgba(${activeGrad.rgb2}, 0)`);

    if (!text) text = "Which country is known as the 'Land of the Rising Sun'?\nA) Taiwan\nB) India\nC) Australia\nD) Japan";

    // Basic Parser
    let lines = text.split('\n').map(l => l.trim()).filter(l => l !== '');
    let question = "";
    let options = [];

    lines.forEach(l => {
        if (/^[A-Ea-e][\)\.]\s/.test(l)) {
            options.push(l);
        } else if (!/^(?:correct\s+)?answer/i.test(l)) {
            question += l + " ";
        }
    });

    if (!question) question = "Enter your question here...";
    if (options.length === 0) options = ["A) Option 1", "B) Option 2"];

    const textColor = state.imgTheme === 'dark' ? '#ffffff' : '#0f172a';

    // 3. Draw Question Text
    ctx.fillStyle = textColor;
    ctx.font = 'bold 55px Inter, Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    let lineHeigth = 70;
    let y = 140;
    let words = question.split(' ');
    let line = '';

    for (let n = 0; n < words.length; n++) {
        let testLine = line + words[n] + ' ';
        let metrics = ctx.measureText(testLine);
        if (metrics.width > 900 && n > 0) {
            ctx.fillText(line, 80, y);
            line = words[n] + ' ';
            y += lineHeigth;
        } else {
            line = testLine;
        }
    }
    ctx.fillText(line, 80, y);
    y += lineHeigth + 50;

    // 4. Draw Frosted Glass Options
    ctx.font = '50px Inter, Arial, sans-serif';
    options.slice(0, 5).forEach((opt) => {

        ctx.save();
        ctx.shadowColor = state.imgTheme === 'dark' ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.1)';
        ctx.shadowBlur = 30;
        ctx.shadowOffsetY = 15;

        ctx.fillStyle = state.imgTheme === 'dark' ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.6)';
        ctx.beginPath();
        ctx.roundRect(80, y, 920, 100, 20);
        ctx.fill();
        ctx.restore();

        ctx.lineWidth = 1.5;
        ctx.strokeStyle = state.imgTheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.8)';
        ctx.stroke();

        // Dynamic Accent Line (Brand Gradient)
        let accentGrad = ctx.createLinearGradient(80, y, 80, y + 100);
        accentGrad.addColorStop(0, activeGrad.hex1);
        accentGrad.addColorStop(1, activeGrad.hex2);
        ctx.fillStyle = accentGrad;
        ctx.beginPath();
        ctx.roundRect(80, y, 12, 100, [20, 0, 0, 20]);
        ctx.fill();

        ctx.fillStyle = textColor;
        let optText = opt;
        if (ctx.measureText(optText).width > 830) optText = optText.substring(0, 35) + "...";
        ctx.fillText(optText, 120, y + 25);

        y += 130;
    });

    // 5. Draw Custom Watermark
    ctx.fillStyle = state.imgTheme === 'dark' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)';
    ctx.font = '28px Inter, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(watermarkText, 540, 1020);
}

if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
        if (w < 2 * r) r = w / 2;
        if (h < 2 * r) r = h / 2;
        this.beginPath();
        this.moveTo(x + r, y);
        this.arcTo(x + w, y, x + w, y + h, r);
        this.arcTo(x + w, y + h, x, y + h, r);
        this.arcTo(x, y + h, x, y, r);
        this.arcTo(x, y, x + w, y, r);
        this.closePath();
        return this;
    }
}

function downloadImage() {
    let canvas = document.getElementById('mcq-canvas');
    let link = document.createElement('a');
    link.download = 'Community_Post.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
}


// --- Global Utility Functions ---
function copyOutput(outputId, btnId) {
    let outText = document.getElementById(outputId).value;
    if (!outText) return;
    executeCopy(outText, document.getElementById(btnId));
}

function copyDirect(text, btnElement) {
    executeCopy(text, btnElement);
}

function executeCopy(text, btnElement) {
    navigator.clipboard.writeText(text).then(() => {
        let originalText = btnElement.innerHTML;
        btnElement.innerHTML = "Copied! ✅";
        setTimeout(() => { btnElement.innerHTML = originalText; }, 2000);
    });
}

function clearTool(tool) {
    if (document.getElementById(`${tool}-input`)) document.getElementById(`${tool}-input`).value = "";
    if (document.getElementById(`${tool}-output`)) document.getElementById(`${tool}-output`).value = "";

    if (tool === 'mcq') {
        document.getElementById('mcq-q').textContent = '0';
        document.getElementById('mcq-w').textContent = '0';
        document.getElementById('mcq-r').textContent = '0';
    } else if (tool === 'yt') {
        document.getElementById('yt-count').textContent = '0';
        document.getElementById('yt-chars').textContent = '0/500';
        document.getElementById('yt-chars').style.color = 'inherit';
    } else if (tool === 'hash') {
        document.getElementById('hash-count').textContent = '0';
    }
}

function toggleTheme() {
    let root = document.documentElement;
    if (root.dataset.theme === 'dark') {
        root.dataset.theme = 'light';
        themeBtn.textContent = '☀️ Light';
    } else {
        root.dataset.theme = 'dark';
        themeBtn.textContent = '🌙 Dark';
    }
    if (document.getElementById('view-img').classList.contains('active')) drawMCQImage();
}

function openDonate() { donateModal.style.display = 'flex'; }
function closeDonate() { donateModal.style.display = 'none'; }
