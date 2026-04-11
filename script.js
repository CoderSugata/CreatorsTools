'use strict'; // Enforces cleaner, safer JavaScript

// --- State Management ---
const opts = { dup: false, shuffle: false, number: false, clean: false };

// --- DOM Elements ---
const inputArea = document.getElementById('input');
const outputArea = document.getElementById('output');
const qCount = document.getElementById('q');
const wCount = document.getElementById('w');
const rCount = document.getElementById('r');

// Buttons
const themeBtn = document.getElementById('themeBtn');
const clearBtn = document.getElementById('clearBtn');
const copyBtn = document.getElementById('copyBtn');
const processBtn = document.getElementById('processBtn');
const toggleDivs = document.querySelectorAll('.toggle');

// Modal Elements
const donateModal = document.getElementById('donateModal');
const footerDonateBtn = document.getElementById('footerDonateBtn');
const floatingDonateBtn = document.getElementById('floatingDonateBtn');
const closeDonateBtn = document.getElementById('closeDonateBtn');


// --- Event Listeners ---
themeBtn.addEventListener('click', toggleTheme);
clearBtn.addEventListener('click', clearAll);
copyBtn.addEventListener('click', copyOutput);
processBtn.addEventListener('click', processText);

footerDonateBtn.addEventListener('click', openDonate);
floatingDonateBtn.addEventListener('click', openDonate);
closeDonateBtn.addEventListener('click', closeDonate);

// Attach event listeners to all option toggles dynamically
toggleDivs.forEach(toggleElement => {
    toggleElement.addEventListener('click', (e) => {
        const key = e.target.getAttribute('data-key');
        opts[key] = !opts[key];
        e.target.classList.toggle('active');
    });
});

// Show floating donate button after short delay
setTimeout(() => {
    floatingDonateBtn.style.display = 'flex';
}, 1);


// --- Core Functions ---

function deepClean(t) {
    return t.replace(/correct answer:.*/gi, '').replace(/next question/gi, '');
}

function processText() {
    let text = inputArea.value.trim();
    if (!text) {
        resetStats();
        return;
    }

    if (opts.clean) text = deepClean(text);

    let blocks = text.split(/\n\n+/).filter(b => b.trim());
    let removed = 0;

    // 1. Remove Duplicates
    if (opts.dup) {
        let set = new Set();
        blocks = blocks.filter(b => {
            let key = b.toLowerCase().replace(/\s+/g, ' ').trim();
            if (set.has(key)) {
                removed++;
                return false;
            }
            set.add(key);
            return true;
        });
    }

    // 2. Shuffle (Fisher-Yates algorithm)
    if (opts.shuffle) {
        for (let i = blocks.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
        }
    }

    // 3. Auto Number
    if (opts.number) {
        blocks = blocks.map((b, i) => {
            let cleanBlock = b.replace(/^(Q?\d+[\.\)]\s*)/i, '');
            return `${i + 1}. ${cleanBlock}`;
        });
    }

    let out = blocks.join("\n\n");
    outputArea.value = out;

    updateStats(blocks.length, out ? out.split(/\s+/).length : 0, removed);
}

// --- Utility Functions ---

function copyOutput() {
    let outText = outputArea.value;
    if (!outText) return;

    navigator.clipboard.writeText(outText).then(() => {
        let originalText = copyBtn.innerText;
        copyBtn.innerText = "Copied! ✅";
        setTimeout(() => { copyBtn.innerText = originalText; }, 2000);
    });
}

function clearAll() {
    inputArea.value = "";
    outputArea.value = "";
    resetStats();
}

function updateStats(q, w, r) {
    qCount.textContent = q;
    wCount.textContent = w;
    rCount.textContent = r;
}

function resetStats() {
    updateStats(0, 0, 0);
    outputArea.value = "";
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

function openDonate() {
    donateModal.style.display = 'flex';
}

function closeDonate() {
    donateModal.style.display = 'none';
}