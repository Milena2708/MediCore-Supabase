// ══════════════════════════════════════════
//  historial.js — Gestión de Expedientes Clínicos
//  Conectado a la tabla: historial_consultas
// ══════════════════════════════════════════

let listaMedsLocal = [];

document.addEventListener('DOMContentLoaded', async () => {
  await inicializarModuloHistorial();
  
  // Si venimos directo desde la Sala de Espera con un código de cita por URL
  const urlParams = new URLSearchParams(window.location.search);
  const citaUrl = urlParams.get('cita');
  if (citaUrl) {
    await abrirModalRegistroHistorial(citaUrl);
  }
});

async function inicializarModuloHistorial() {
  await renderCitasAtendidas();
  await updateStatsHistorial();
}


// ── 1. RENDER DE LA BARRA LATERAL (CITAS ATENDIDAS) ───────────────────
async function renderCitasAtendidas() {
  const listaEl = document.getElementById('lista-citas-atendidas');
  const q = (document.getElementById('search-citas-at').value || '').toLowerCase();
  if (!listaEl) return;

  // MODIFICACIÓN CLAVE: Consultamos todas las citas que pasaron por la sala para garantizar que se listen
  const { data: citas } = await supabaseClient.from('citas').select('*').in('estado', ['Atendida', 'En atención', 'En espera']);
  const { data: historiales } = await supabaseClient.from('historial_consultas').select('cita_id');
  const { data: pacientes } = await supabaseClient.from('pacientes').select('codigo, nombres, apellidos');

  if (!citas || citas.length === 0) {
    listaEl.innerHTML = '<div style="font-size:.75rem;color:var(--gray-400);padding:1rem;text-align:center">No hay citas atendidas hoy</div>';
    return;
  }

  const codigosConHistorial = historiales ? historiales.map(h => h.cita_id) : [];

  let filtradas = citas.filter(c => {
    const pac = pacientes ? pacientes.find(p => p.codigo === c.paciente_id) : null;
    const nombre = pac ? `${pac.nombres} ${pac.apellidos}`.toLowerCase() : '';
    return nombre.includes(q) || c.codigo.toLowerCase().includes(q) || c.medico.toLowerCase().includes(q);
  });

  if (filtradas.length === 0) {
    listaEl.innerHTML = '<div style="font-size:.75rem;color:var(--gray-400);padding:1rem;text-align:center">No hay coincidencias</div>';
    return;
  }

  listaEl.innerHTML = filtradas.map(c => {
    const pac = pacientes ? pacientes.find(p => p.codigo === c.paciente_id) : null;
    const nombre = pac ? `${pac.nombres} ${pac.apellidos}` : '(Paciente no encontrado)';
    const yaTieneHist = codigosConHistorial.includes(c.codigo);

    return `
      <div class="cita-atendida-item ${yaTieneHist ? 'has-hist' : ''}" onclick="seleccionarCitaHistorial('${c.codigo}', '${c.paciente_id}')">
        <div class="cai-icon">${yaTieneHist ? '✅' : '🩺'}</div>
        <div class="cai-main">
          <div class="cai-nombre">${nombre}</div>
          <div class="cai-meta">Cita: ${c.codigo} · ${c.especialidad}</div>
          <div class="cai-meta">👨‍⚕️ ${c.medico}</div>
        </div>
        <div class="cai-badge">
          ${yaTieneHist ? '' : `<button class="btn btn-primary btn-xs" style="font-size:.65rem;padding:.2rem .4rem" onclick="event.stopPropagation(); abrirModalRegistroHistorial('${c.codigo}')">📝 Crear</button>`}
        </div>
      </div>
    `;
  }).join('');
}

// ── 2. MOSTRAR EXPEDIENTE EN PANEL CENTRAL AL SELECCIONAR ──────────────
async function seleccionarCitaHistorial(citaCodigo, pacienteId) {
  const mainPanel = document.getElementById('main-historial');
  if (!mainPanel) return;

  // Remover selecciones previas visuales
  document.querySelectorAll('.cita-atendida-item').forEach(el => el.classList.remove('selected'));
  if (event && event.currentTarget) {
    event.currentTarget.classList.add('selected');
  }

  const { data: historial } = await supabaseClient.from('historial_consultas').select('*').eq('cita_id', citaCodigo).maybeSingle();
  const { data: pac } = await supabaseClient.from('pacientes').select('*').eq('codigo', pacienteId).maybeSingle();

  if (!historial) {
    mainPanel.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📝</div>
        <div class="empty-title">Sin historial registrado</div>
        <div class="empty-sub">Esta cita no cuenta con registro clínico todavía.</div>
        <button class="btn btn-primary" style="margin-top:1rem" onclick="abrirModalRegistroHistorial('${citaCodigo}')">📝 Registrar Consulta Médica</button>
      </div>`;
    return;
  }

  const nombrePac = pac ? `${pac.nombres} ${pac.apellidos}` : '(Paciente no encontrado)';
  const edad = pac ? calcAge(pac.fecha_nacimiento) : '';
  
  // Parsear medicamentos JSONB de tu BD de forma segura
  let medsHtml = '<div style="font-size:.8rem;color:var(--gray-400)">Ninguno recetado</div>';
  if (historial.medicamentos && historial.medicamentos.length > 0) {
    medsHtml = historial.medicamentos.map(m => `
      <div class="med-item">
        <div class="med-nombre">💊 ${m.nombre} (${m.cantidad})</div>
        <div class="med-detalle">Dosis: ${m.dosis} por ${m.duracion}</div>
      </div>
    `).join('');
  }

  mainPanel.innerHTML = `
    <div class="hist-card">
      <div class="hist-card-header">
        <div>
          <span class="hist-code">EXPEDIENTE: ${historial.codigo}</span>
          <h2 style="margin:.25rem 0 .5rem 0;font-size:1.4rem;color:var(--navy)">${nombrePac}</h2>
          <div style="font-size:.78rem;color:var(--gray-500)">DNI: ${pac?.documento || '—'} · Edad: ${edad} años · Tel: ${pac?.telefono || '—'}</div>
        </div>
        <div style="text-align:right">
          <span class="hist-fecha">📅 ${formatDate(historial.fecha_atencion)}</span>
          <div style="font-size:.75rem;color:var(--blue);font-weight:600;margin-top:.25rem">🩺 ${historial.especialidad}</div>
          <div style="font-size:.72rem;color:var(--gray-500)">Atendido por: ${historial.medico}</div>
        </div>
      </div>

      <hr class="hist-divider"/>

      <div class="hist-section">
        <div class="hist-section-title">Síntomas Reportados</div>
        <div class="hist-section-body">${historial.sintomas}</div>
      </div>

      <div class="hist-section">
        <div class="hist-section-title">Diagnóstico Médico</div>
        <div class="hist-section-body" style="font-weight:600;color:var(--gray-900)">📌 ${historial.diagnostico}</div>
      </div>

      <div class="hist-section">
        <div class="hist-section-title">Tratamiento e Indicaciones</div>
        <div class="hist-section-body">${historial.tratamiento}</div>
      </div>

      <div class="hist-section">
        <div class="hist-section-title">Medicamentos Recetados</div>
        <div>${medsHtml}</div>
      </div>

      ${historial.observaciones ? `
      <div class="hist-section">
        <div class="hist-section-title">Observaciones Adicionales</div>
        <div class="hist-section-body" style="font-style:italic">${historial.observaciones}</div>
      </div>` : ''}

      ${historial.proxima_cita ? `
      <div style="margin-top:1.25rem">
        <div class="prox-cita-chip">⏳ Próxima Consulta Recomendada: ${formatDate(historial.proxima_cita)}</div>
      </div>` : ''}
    </div>`;
}

// ── 3. MANEJO DEL MODAL DE REGISTRO (FORMULARIO) ──────────────────────
async function abrirModalRegistroHistorial(citaCodigo) {
  const { data: cita } = await supabaseClient.from('citas').select('*').eq('codigo', citaCodigo).single();
  if (!cita) return;

  const { data: pac } = await supabaseClient.from('pacientes').select('*').eq('codigo', cita.paciente_id).single();

  document.getElementById('form-historial').reset();
  listaMedsLocal = [];
  document.getElementById('med-lista').innerHTML = '';

  // Configurar campos automáticos/lectura
  document.getElementById('hist-cita-codigo').value = cita.codigo;
  document.getElementById('hist-medico').value = cita.medico;
  document.getElementById('hist-especialidad').value = cita.especialidad;
  document.getElementById('hist-fecha').value = formatDate(new Date().toISOString().split('T')[0]);
  document.getElementById('hist-sintomas').value = cita.motivo;

  // Generar correlativo de Historial HISTXXX
  const { data: historiales } = await supabaseClient.from('historial_consultas').select('codigo');
  let proxId = 'HIST001';
  if (historiales && historiales.length > 0) {
    const nums = historiales.map(h => parseInt((h.codigo || '').replace('HIST', '')) || 0);
    proxId = 'HIST' + String(Math.max(...nums) + 1).padStart(3, '0');
  }
  document.getElementById('hist-codigo').value = proxId;

  // Renderizar la franja del paciente en el modal
  const strip = document.getElementById('hist-pac-strip');
  if (strip && pac) {
    strip.innerHTML = `
      <div class="patient-info-strip">
        <div class="pi-avatar">${pac.nombres[0]}${pac.apellidos[0]}</div>
        <div class="pi-data">
          <div class="pi-name">${pac.nombres} ${pac.apellidos}</div>
          <div class="pi-meta">DNI: ${pac.documento} · Teléfono: ${pac.telefono}</div>
        </div>
      </div>`;
  }

  // Listener para los contadores de texto
  setupContadorCaracteres('hist-sintomas', 'hist-sintomas-cnt', 300);
  setupContadorCaracteres('hist-diagnostico', 'hist-diagnostico-cnt', 300);
  setupContadorCaracteres('hist-tratamiento', 'hist-tratamiento-cnt', 400);
  setupContadorCaracteres('hist-observaciones', 'hist-observaciones-cnt', 300);

  openModal('modal-historial');
}

// ── 4. AGREGAR MEDICAMENTOS DINÁMICOS AL FORMULARIO ────────────────────
function agregarMed() {
  const container = document.getElementById('med-lista');
  const index = container.children.length;

  const row = document.createElement('div');
  row.className = 'med-row';
  row.style.marginBottom = '.5rem';
  row.id = `med-row-${index}`;
  row.innerHTML = `
    <div class="form-group" style="margin:0"><label class="form-label">Medicamento</label><input type="text" class="form-control form-control-sm h-med-nombre" placeholder="Ej: Amoxicilina 500mg"/></div>
    <div class="form-group" style="margin:0"><label class="form-label">Cant.</label><input type="text" class="form-control form-control-sm h-med-cant" placeholder="10 tabs"/></div>
    <div class="form-group" style="margin:0"><label class="form-label">Dosis / Frecuencia</label><input type="text" class="form-control form-control-sm h-med-dosis" placeholder="Cada 8 horas"/></div>
    <div class="form-group" style="margin:0"><label class="form-label">Duración</label><input type="text" class="form-control form-control-sm h-med-duracion" placeholder="7 días"/></div>
    <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.remove()" style="padding:.4rem .6rem">✕</button>
  `;
  container.appendChild(row);
}

// ── 5. GUARDAR EL EXPEDIENTE EN SUPABASE ──────────────────────────────
async function guardarHistorial() {
  clearAllErrors('form-historial');
  
  const citaId = document.getElementById('hist-cita-codigo').value;
  const codigo = document.getElementById('hist-codigo').value;
  const medico = document.getElementById('hist-medico').value;
  const esp = document.getElementById('hist-especialidad').value;
  
  const sintomas = document.getElementById('hist-sintomas').value.trim();
  const diagnostico = document.getElementById('hist-diagnostico').value.trim();
  const tratamiento = document.getElementById('hist-tratamiento').value.trim();
  const observaciones = document.getElementById('hist-observaciones').value.trim();
  const proximaCita = document.getElementById('hist-prox-cita').value || null;

  let isValid = true;
  if (sintomas.length < 10) { showFieldError('hist-sintomas', 'Mínimo 10 caracteres'); isValid = false; }
  if (diagnostico.length < 10) { showFieldError('hist-diagnostico', 'Mínimo 10 caracteres'); isValid = false; }
  if (tratamiento.length < 10) { showFieldError('hist-tratamiento', 'Mínimo 10 caracteres'); isValid = false; }

  if (!isValid) { showToast('Corrija los campos requeridos', 'error'); return; }

  // Recolectar la lista dinámica de medicamentos recetados
  const medsData = [];
  document.querySelectorAll('.med-row').forEach(row => {
    const nombre = row.querySelector('.h-med-nombre').value.trim();
    const cantidad = row.querySelector('.h-med-cant').value.trim();
    const dosis = row.querySelector('.h-med-dosis').value.trim();
    const duracion = row.querySelector('.h-med-duracion').value.trim();
    if (nombre) medsData.push({ nombre, cantidad, dosis, duracion });
  });

  // Re-confirmar el paciente de la cita
  const { data: c } = await supabaseClient.from('citas').select('paciente_id').eq('codigo', citaId).single();

  const insertData = {
    codigo,
    cita_id: citaId,
    paciente_id: c.paciente_id,
    medico,
    especialidad: esp,
    fecha_atencion: new Date().toISOString().split('T')[0], // CORRECCIÓN 406: Apunta solo a fecha_atencion existente en tu tabla
    sintomas,
    diagnostico,
    tratamiento,
    medicamentos: medsData, 
    observaciones: observaciones || null,
    proxima_cita: proximaCita
  };

  const { error } = await supabaseClient.from('historial_consultas').insert([insertData]);

  if (error) {
    showToast(`Error: ${error.message}`, 'error');
    return;
  }

  showToast('Expediente clínico guardado con éxito', 'success');
  closeModal('modal-historial');
  await inicializarModuloHistorial();
  
  // Auto-cargar visualmente el expediente recién guardado
  await seleccionarCitaHistorial(citaId, c.paciente_id);
}

// ── 6. CONTADORES DE ESTADÍSTICAS SUPERIORES ──────────────────────────
async function updateStatsHistorial() {
  const { data: hist } = await supabaseClient.from('historial_consultas').select('*');
  const { data: citas } = await supabaseClient.from('citas').select('estado').eq('estado', 'Atendida');

  const totalHist = hist ? hist.length : 0;
  const totalAtendidas = citas ? citas.length : 0;
  const sinHistorial = Math.max(0, totalAtendidas - totalHist);

  let conMeds = 0;
  let pacientesUnicos = new Set();

  if (hist) {
    hist.forEach(h => {
      pacientesUnicos.add(h.paciente_id);
      if (h.medicamentos && h.medicamentos.length > 0) conMeds++;
    });
  }

  document.getElementById('st-hist').textContent = totalHist;
  document.getElementById('st-pendientes').textContent = sinHistorial;
  document.getElementById('st-con-meds').textContent = conMeds;
  document.getElementById('st-pacs-hist').textContent = pacientesUnicos.size;
}

function setupContadorCaracteres(inputId, countId, max) {
  const input = document.getElementById(inputId);
  const counter = document.getElementById(countId);
  if (!input || !counter) return;
  
  counter.textContent = `${input.value.length} / ${max}`;
  input.oninput = () => { counter.textContent = `${input.value.length} / ${max}`; };
}

// UTILERÍA LOCAL PARCHE PARA ELIMINAR EL REFERENCEERROR DE FORMA DEFINITIVA
function formatDate(dateStr) {
  if (!dateStr) return '—';
  if (dateStr.includes('/')) return dateStr;
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('es-PE', { day:'2-digit', month:'2-digit', year:'numeric' });
}