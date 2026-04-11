'use strict';

// --- State Management ---
const state = {
    mcq: { dup: false, shuffle: false, number: false, clean: false },
    yt: { lower: false, capitalize: false },
    hash: { pascal: false, lower: false }
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
function processMcq() {
    let text = document.getElementById('mcq-input').value.trim();
    if (!text) return clearTool('mcq');

    if (state.mcq.clean) text = text.replace(/correct answer:.*/gi, '').replace(/next question/gi, '');

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

// --- TOOL 3: Tuberanker-Style Hashtag Generator ---
async function processHash() {
    let keyword = document.getElementById('hash-input').value.trim();
    if (!keyword) return clearTool('hash');

    let btn = document.getElementById('hash-generate-btn');
    btn.innerHTML = "Fetching... ⏳";
    btn.disabled = true;

    try {
        let rawTags = await fetchFromRapidTags(keyword, 'TikTok');

        if (!rawTags || rawTags.length === 0) {
            let responses = await Promise.all([
                fetchGoogleSuggest(keyword),
                fetchGoogleSuggest(keyword + " ")
            ]);
            rawTags = [...responses[0], ...responses[1]];
        }

        let tags = [];
        let seen = new Set();

        const addTag = (text) => {
            // TUBERANKER FILTER: Ignore queries that are too long (more than 4 words). 
            // Nobody searches for "#howtomakechocolatecakeathomein10minutes"
            let words = text.trim().split(/\s+/);
            if (words.length > 4) return;

            // Clean symbols
            let cleaned = text.replace(/[^\p{L}\p{N}\s]+/gu, '').trim();
            if (!cleaned || cleaned.length < 3) return; // Skip tiny/empty tags

            let formattedStr = '';
            if (state.hash.pascal) {
                formattedStr = cleaned.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
            } else if (state.hash.lower) {
                formattedStr = cleaned.toLowerCase().replace(/\s+/g, '');
            } else {
                formattedStr = cleaned.replace(/\s+/g, '');
            }

            let finalTag = '#' + formattedStr;
            let lowerMatch = finalTag.toLowerCase();

            if (!seen.has(lowerMatch)) {
                seen.add(lowerMatch);
                tags.push(finalTag);
            }
        };

        // 1. Add core individual keywords (if keyword is multiple words)
        let coreWords = keyword.split(/\s+/);
        if (coreWords.length > 1) {
            coreWords.forEach(w => {
                if (w.length > 2) addTag(w); // Only add words longer than 2 letters (e.g. ignore 'in', 'at')
            });
        }

        // 2. Add the exact full phrase combined
        addTag(keyword);

        // 3. Add the premium filtered internet suggestions
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

// --- Utility Functions ---
function copyOutput(outputId, btnId) {
    let outText = document.getElementById(outputId).value;
    if (!outText) return;

    let copyBtn = document.getElementById(btnId);
    navigator.clipboard.writeText(outText).then(() => {
        let originalText = copyBtn.innerHTML;
        copyBtn.innerHTML = "Copied! ✅";
        setTimeout(() => { copyBtn.innerHTML = originalText; }, 2000);
    });
}

function clearTool(tool) {
    document.getElementById(`${tool}-input`).value = "";
    document.getElementById(`${tool}-output`).value = "";

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
}

function openDonate() { donateModal.style.display = 'flex'; }
function closeDonate() { donateModal.style.display = 'none'; }
