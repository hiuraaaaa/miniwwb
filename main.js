// main.js
import { ModelLoader } from './model-loader.js';

// === CONFIG ===
// Masukkan token GitHub di sini (PRIVATE, jangan taruh di HTML)
const GITHUB_TOKEN = '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';
const GITHUB_USER = 'hiuraaaaa';

// === DOM ELEMENTS ===
const fileListEl = document.getElementById('fileList');
const fileEditor = document.getElementById('fileEditor');
const dropZone = document.getElementById('dropZone');
const repoDropdown = document.getElementById('repoDropdown');

let currentFile = null;
let currentRepo = null;
const fileContents = {}; // { filename: content }
const modelLoader = new ModelLoader();

// --- Load repo dropdown (real GitHub) ---
async function loadUserRepos() {
  const res = await fetch(`https://api.github.com/users/${GITHUB_USER}/repos`, {
    headers: { Authorization: `token ${GITHUB_TOKEN}` }
  });
  const data = await res.json();
  data.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r.name;
    opt.textContent = r.name;
    repoDropdown.appendChild(opt);
  });
}
loadUserRepos();

// --- Render file list ---
function renderFileList() {
  fileListEl.innerHTML = '';
  Object.keys(fileContents).forEach(f => {
    const li = document.createElement('li');
    li.textContent = f;
    li.onclick = () => {
      currentFile = f;
      fileEditor.textContent = fileContents[f];
      Array.from(fileListEl.children).forEach(c => c.classList.remove('active'));
      li.classList.add('active');
    };
    fileListEl.appendChild(li);
  });
}

// --- Load repo from GitHub ---
async function loadRepoFiles(repo) {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_USER}/${repo}/contents/`, {
    headers: { Authorization: `token ${GITHUB_TOKEN}` }
  });
  if (!res.ok) return alert('Failed to load repo');
  const data = await res.json();
  fileContents = {};
  data.forEach(f => {
    if (f.type === 'file' && f.name.endsWith('.js')) fileContents[f.name] = '';
  });

  // Fetch content for each file
  for (const fname of Object.keys(fileContents)) {
    const fRes = await fetch(`https://api.github.com/repos/${GITHUB_USER}/${repo}/contents/${fname}`, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });
    const fData = await fRes.json();
    fileContents[fname] = atob(fData.content);
  }

  renderFileList();
  alert(`Loaded repo: ${repo}`);
}

// --- Save / Commit file ---
async function commitFileToGitHub(filename) {
  if (!currentRepo) return alert('Select a repo first');
  if (!fileContents[filename]) return alert('File content is empty');

  const url = `https://api.github.com/repos/${GITHUB_USER}/${currentRepo}/contents/${filename}`;
  let sha;
  // Check if file exists
  const getRes = await fetch(url, { headers: { Authorization: `token ${GITHUB_TOKEN}` } });
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

  if (res.ok) alert(`${filename} committed to ${currentRepo}!`);
  else {
    const err = await res.json();
    alert(`Failed to commit: ${err.message}`);
  }
}

// --- Button Handlers ---
document.getElementById('loadRepoBtn').onclick = () => {
  const repo = repoDropdown.value;
  if (!repo) return alert('Select a repo');
  currentRepo = repo;
  loadRepoFiles(repo);
};

document.getElementById('saveFileBtn').onclick = async () => {
  if (!currentFile) return alert('Select a file first');
  fileContents[currentFile] = fileEditor.textContent;
  await commitFileToGitHub(currentFile);
};

document.getElementById('addFileBtn').onclick = () => {
  const fname = prompt('Enter new filename (e.g., copilot.js)');
  if (!fname) return;
  if (fileContents[fname]) return alert('File already exists');
  fileContents[fname] = '';
  currentFile = fname;
  renderFileList();
  fileEditor.textContent = '';
};

document.getElementById('deleteFileBtn').onclick = async () => {
  if (!currentFile) return alert('Select a file first');
  if (!confirm(`Delete ${currentFile}?`)) return;
  const url = `https://api.github.com/repos/${GITHUB_USER}/${currentRepo}/contents/${currentFile}`;
  const getRes = await fetch(url, { headers: { Authorization: `token ${GITHUB_TOKEN}` } });
  let sha;
  if (getRes.ok) {
    const data = await getRes.json();
    sha = data.sha;
  }
  if (!sha) { delete fileContents[currentFile]; renderFileList(); fileEditor.textContent = ''; return; }
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { 
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ message: `Delete ${currentFile}`, sha })
  });
  if (res.ok) alert(`${currentFile} deleted!`);
  delete fileContents[currentFile];
  currentFile = null;
  renderFileList();
  fileEditor.textContent = '';
};

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

// --- Editor input (auto-save) ---
fileEditor.addEventListener('input', () => {
  if (currentFile) fileContents[currentFile] = fileEditor.textContent;
});

// --- Drop zone click to add file manually ---
dropZone.onclick = () => {
  const fname = prompt('Enter filename to create/upload (e.g., copilot.js)');
  if (!fname) return;
  if (!fileContents[fname]) fileContents[fname] = '';
  currentFile = fname;
  renderFileList();
  fileEditor.textContent = fileContents[fname];
};

// --- Load current file as model dynamically ---
async function loadCurrentModel() {
  if (!currentFile) return;
  const model = await modelLoader.addModelFromFile(currentFile);
  if (model) alert(`Model ${model.name} loaded from ${currentFile}`);
  else alert('No model exported in this file');
};
