// main.js
import { ModelLoader } from './model-loader.js';

// ================= CONFIG =================
// Masukkan token GitHub dan Vercel di sini (private)
// Jangan taruh token di HTML/public
const GITHUB_TOKEN = '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';
const GITHUB_USERNAME = 'hiuraaaaa''

const VERCEL_TOKEN = 'vercel_XXXXXXXXXXXXXXXXXXXX';
const VERCEL_PROJECT_ID = 'proj_XXXXXXXXXXXX';
const VERCEL_TEAM_ID = ''; // optional, kosong jika personal

// ==========================================

const fileListEl = document.getElementById('fileList');
const fileEditor = document.getElementById('fileEditor');
const dropZone = document.getElementById('dropZone');
const repoDropdown = document.getElementById('repoDropdown');

let currentFile = null;
let currentRepo = null;
const fileContents = {}; // { filename: content }
const modelLoader = new ModelLoader();

// --- Load repo dropdown (ubah sesuai akun/repo kamu) ---
const repos = ['multiAI', 'myAIRepo', 'testRepo'];
repos.forEach(r => {
  const opt = document.createElement('option');
  opt.value = r;
  opt.textContent = r;
  repoDropdown.appendChild(opt);
});

// --- Render file list ---
function renderFileList() {
  fileListEl.innerHTML = '';
  Object.keys(fileContents).forEach(f => {
    const li = document.createElement('li');
    li.textContent = f;
    li.onclick = () => {
      currentFile = f;
      fileEditor.textContent = fileContents[f];
    };
    fileListEl.appendChild(li);
  });
}

// --- Add new file ---
document.getElementById('addFileBtn').onclick = () => {
  const fname = prompt('Enter new filename (e.g., copilot.js)');
  if (!fname) return;
  if (fileContents[fname]) return alert('File already exists');
  fileContents[fname] = '';
  currentFile = fname;
  renderFileList();
  fileEditor.textContent = '';
};

// --- Delete file ---
document.getElementById('deleteFileBtn').onclick = () => {
  if (!currentFile) return alert('Select a file first');
  if (!confirm(`Delete ${currentFile}?`)) return;
  delete fileContents[currentFile];
  currentFile = null;
  renderFileList();
  fileEditor.textContent = '';
};

// --- Editor input ---
fileEditor.addEventListener('input', () => {
  if (currentFile) fileContents[currentFile] = fileEditor.textContent;
});

// --- Drag & Drop ---
dropZone.ondragover = (e) => { e.preventDefault(); dropZone.classList.add('dragover'); };
dropZone.ondragleave = (e) => { e.preventDefault(); dropZone.classList.remove('dragover'); };
dropZone.ondrop = async (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  const files = e.dataTransfer.files;
  for (const f of files) {
    if (f.type === 'application/javascript' || f.name.endsWith('.js')) {
      const text = await f.text();
      fileContents[f.name] = text;
    }
  }
  renderFileList();
};

// --- Click dropzone to create new file manually ---
dropZone.onclick = () => {
  const fname = prompt('Enter filename (e.g., copilot.js)');
  if (!fname) return;
  if (!fileContents[fname]) fileContents[fname] = '';
  currentFile = fname;
  renderFileList();
  fileEditor.textContent = fileContents[fname];
};

// --- Load repo ---
document.getElementById('loadRepoBtn').onclick = () => {
  const repo = repoDropdown.value;
  if (!repo) return alert('Select a repo');
  currentRepo = repo;
  alert(`Loaded repo: ${repo}`);
};

// --- Commit file to GitHub ---
async function commitFileToGitHub(filename) {
  if (!currentRepo) return alert('Select a repo first');
  if (!fileContents[filename]) return alert('File content empty');

  const url = `https://api.github.com/repos/${GITHUB_USERNAME}/${currentRepo}/contents/${filename}`;

  // Check if file exists
  let sha;
  const getRes = await fetch(url, {
    headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
  });

  if (getRes.ok) {
    const data = await getRes.json();
    sha = data.sha;
  }

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: sha ? `Update ${filename}` : `Add ${filename}`,
      content: btoa(unescape(encodeURIComponent(fileContents[filename]))),
      sha
    })
  });

  if (res.ok) {
    alert(`${filename} committed to ${currentRepo}!`);
  } else {
    const err = await res.json();
    alert(`Failed to commit: ${err.message}`);
  }
}

// --- Save / Commit button ---
document.getElementById('saveFileBtn').onclick = async () => {
  if (!currentFile) return alert('Select a file first');
  fileContents[currentFile] = fileEditor.textContent;
  await commitFileToGitHub(currentFile);
};

// --- Deploy to Vercel ---
document.getElementById('deployVercelBtn').onclick = async () => {
  if (!currentRepo) return alert('Select a repo first');
  try {
    const res = await fetch('https://api.vercel.com/v13/deployments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: currentRepo,
        gitSource: { type: 'github', repoId: currentRepo, orgId: VERCEL_TEAM_ID || undefined },
        target: 'production'
      })
    });
    if (!res.ok) throw new Error('Vercel deploy failed');
    const data = await res.json();
    alert(`Deployment started! URL: ${data.url || 'check Vercel dashboard'}`);
  } catch (err) {
    alert(`Vercel deploy error: ${err.message}`);
  }
};

// --- Load model dynamically from current file ---
async function loadCurrentModel() {
  if (!currentFile) return;
  const model = await modelLoader.addModelFromFile(currentFile);
  if (model) alert(`Model ${model.name} loaded from ${currentFile}`);
  else alert('No model exported in this file');
}
