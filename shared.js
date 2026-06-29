/* ============================================================
   MediCore — shared.js
   Utilidades compartidas: storage, toast, navegación, helpers
   ============================================================ */

// ── LocalStorage helpers ─────────────────────────────────────
const DB = {
  get: (key) => JSON.parse(localStorage.getItem('medicore_' + key) || '[]'),
  set: (key, val) => localStorage.setItem('medicore_' + key, JSON.stringify(val)),
  getObj: (key) => JSON.parse(localStorage.getItem('medicore_' + key) || 'null'),
  setObj: (key, val) => localStorage.setItem('medicore_' + key, JSON.stringify(val)),
};

// ── Auto-increment ID ────────────────────────────────────────
function nextId(prefix, list, field = 'codigo') {
  if (!list.length) return prefix + '001';
  const nums = list.map(x => parseInt((x[field] || '').replace(prefix,'')) || 0);
  const next = Math.max(...nums) + 1;
  return prefix + String(next).padStart(3, '0');
}

// ── Toast ─────────────────────────────────────────────────────
function showToast(msg, type = 'info', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warn: '⚠️' };
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span class="toast-icon">${icons[type]||'ℹ️'}</span><span>${msg}</span>`;
  container.appendChild(t);
  setTimeout(() => { t.style.opacity='0'; t.style.transform='translateX(20px)'; t.style.transition='all .3s'; setTimeout(()=>t.remove(),300); }, duration);
}

// ── Modal helpers ─────────────────────────────────────────────
function openModal(id) {
  const m = document.getElementById(id);
  if (m) { m.classList.add('active'); document.body.style.overflow='hidden'; }
}
function closeModal(id) {
  const m = document.getElementById(id);
  if (m) { m.classList.remove('active'); document.body.style.overflow=''; }
}
function closeAllModals() {
  document.querySelectorAll('.modal-overlay.active').forEach(m=>{m.classList.remove('active');});
  document.body.style.overflow='';
}

// Close modal on overlay click
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) closeAllModals();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeAllModals();
});

// ── Clock ─────────────────────────────────────────────────────
function startClock() {
  const el = document.getElementById('nav-clock');
  if (!el) return;
  const tick = () => {
    const n = new Date();
    el.textContent = n.toLocaleTimeString('es-PE', {hour:'2-digit',minute:'2-digit',second:'2-digit'});
  };
  tick(); setInterval(tick, 1000);
}

// ── Active nav ────────────────────────────────────────────────
function setActiveNav() {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-item').forEach(a => {
    const href = a.getAttribute('href') || '';
    if (href === page || (page === '' && href === 'index.html')) {
      a.classList.add('active');
    }
  });
}

// ── Form validation helpers ───────────────────────────────────
const Validate = {
  required: (v) => v !== null && v !== undefined && String(v).trim() !== '',
  minLen: (v, n) => String(v).trim().length >= n,
  maxLen: (v, n) => String(v).trim().length <= n,
  noOnlyNumbers: (v) => !/^\d+$/.test(String(v).trim()),
  email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim()),
  dni: (v) => /^\d{8}$/.test(String(v).trim()),
  phone: (v) => /^\d{9}$/.test(String(v).trim()),
  noFutureDate: (v) => v && new Date(v) <= new Date(),
  futureDate: (v) => v && new Date(v) > new Date(),
  noOnlySpaces: (v) => String(v).trim() !== '',
};

function showFieldError(id, msg) {
  const input = document.getElementById(id);
  const error = document.getElementById(id + '-err');
  if (input)  input.classList.add('is-error');
  if (error)  { error.textContent = msg; error.classList.add('show'); }
}

function clearFieldError(id) {
  const input = document.getElementById(id);
  const error = document.getElementById(id + '-err');
  if (input)  { input.classList.remove('is-error'); input.classList.remove('is-valid'); }
  if (error)  { error.textContent = ''; error.classList.remove('show'); }
}

function markFieldValid(id) {
  const input = document.getElementById(id);
  if (input) { input.classList.remove('is-error'); input.classList.add('is-valid'); }
  const error = document.getElementById(id + '-err');
  if (error) error.classList.remove('show');
}

function clearAllErrors(formId) {
  const form = formId ? document.getElementById(formId) : document;
  if (!form) return;
  form.querySelectorAll('.is-error').forEach(el => el.classList.remove('is-error'));
  form.querySelectorAll('.form-error').forEach(el => el.classList.remove('show'));
}

// ── Date helpers ──────────────────────────────────────────────
function calcAge(dob) {
  if (!dob) return null;
  const today = new Date();
  const birth = new Date(dob);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function isMinor(dob) {
  const age = calcAge(dob);
  return age !== null && age < 18;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('es-PE', { day:'2-digit', month:'2-digit', year:'numeric' });
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

// ── Patient helpers (used by citas, sala, historial) ──────────
function getPaciente(codigo) {
  return DB.get('pacientes').find(p => p.codigo === codigo) || null;
}

function getAllPacientes() {
  return DB.get('pacientes');
}

function getCitas() {
  return DB.get('citas');
}

function saveCita(cita) {
  const citas = getCitas();
  const idx = citas.findIndex(c => c.codigo === cita.codigo);
  if (idx >= 0) citas[idx] = cita; else citas.push(cita);
  DB.set('citas', citas);
}

function getHistorial() {
  return DB.get('historial');
}

// ── Render allergy pills (shared display) ─────────────────────
function renderAlergias(alergias) {
  if (!alergias || !alergias.length || alergias[0] === 'Ninguna') {
    return '<span style="color:var(--gray-400);font-size:.72rem">Ninguna</span>';
  }
  return alergias.map(a =>
    `<span style="background:var(--red-pale);color:#991B1B;border-radius:var(--radius-full);padding:.15rem .5rem;font-size:.65rem;font-weight:600;">${a}</span>`
  ).join(' ');
}

// ── Stats counter animation ───────────────────────────────────
function animateCount(el, target, duration = 1000) {
  if (!el) return;
  const start = performance.now();
  function step(now) {
    const p = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(2, -8 * p);
    el.textContent = Math.round(eased * target);
    if (p < 1) requestAnimationFrame(step);
    else el.textContent = target.toLocaleString('es-PE');
  }
  requestAnimationFrame(step);
}

// ── Init on DOM ready ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  startClock();
  setActiveNav();
});