// ══════════════════════════════════════════
//  citas.js — Lógica de Programación Médica
//  Conectado a Supabase Database (supabaseClient)
// ══════════════════════════════════════════

const MEDICOS = {
  'Medicina general': ['Dr. Carlos Ramos', 'Dra. Ana Torres', 'Dr. José Peña'],
  'Pediatría':        ['Dra. Lucía Herrera', 'Dr. Marco Díaz'],
  'Cardiología':      ['Dr. Eduardo Vela', 'Dra. Patricia Quispe'],
  'Dermatología':     ['Dra. Sofía Lara', 'Dr. Andrés Castro'],
  'Traumatología':    ['Dr. Luis Ramírez', 'Dr. Roberto Huanca'],
  'Ginecología':      ['Dra. María Salinas', 'Dra. Carmen Huanca'],
  'Odontología':      ['Dr. Jorge Soto', 'Dra. Fiorella Núñez'],
};

const HORAS = Array.from({ length: 20 }, (_, i) => {
  const h = Math.floor(i / 2) + 8;
  const m = i % 2 === 0 ? '00' : '30';
  return `${String(h).padStart(2, '0')}:${m}`;
}).filter(h => { const [hh] = h.split(':'); return parseInt(hh) < 18; });

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('cita-fecha').min = todayStr();
  const sel = document.getElementById('cita-hora');
  if (sel && sel.options.length <= 1) {
    HORAS.forEach(h => {
      const o = document.createElement('option');
      o.value = o.textContent = h;
      sel.appendChild(o);
    });
  }
  renderCitas();
  updateStats();
});

async function abrirNuevaCita() {
  await resetFormCita();
  document.getElementById('modal-cita-title').textContent = 'Nueva Cita';
  await cargarPacientesSelect();
  openModal('modal-cita');
}

// Carga dinámica de pacientes directo desde la nube
async function cargarPacientesSelect(selected = '') {
  const sel = document.getElementById('cita-paciente');
  sel.innerHTML = '<option value="">Seleccionar paciente…</option>';
  
  const { data: pacientes, error } = await supabaseClient
    .from('pacientes')
    .select('codigo, nombres, apellidos, documento');

  if (error || !pacientes) {
    showToast('Error al cargar la lista de pacientes', 'error');
    return;
  }

  pacientes.forEach(p => {
    const o = document.createElement('option');
    o.value = p.codigo;
    o.textContent = `${p.nombres} ${p.apellidos} — ${p.documento}`;
    if (p.codigo === selected) o.selected = true;
    sel.appendChild(o);
  });
}

function onEspecialidadChange() {
  const esp = document.getElementById('cita-especialidad').value;
  const sel  = document.getElementById('cita-medico');
  sel.innerHTML = '';
  if (!esp) { sel.innerHTML = '<option value="">Seleccione especialidad primero</option>'; return; }
  sel.innerHTML = '<option value="">Seleccionar médico…</option>';
  (MEDICOS[esp] || []).forEach(m => {
    const o = document.createElement('option');
    o.value = o.textContent = m;
    sel.appendChild(o);
  });
  clearFieldError('cita-especialidad');
}

// Ficha informativa dinámica asíncrona
async function onPacienteChange() {
  const codigo = document.getElementById('cita-paciente').value;
  const strip  = document.getElementById('pac-info-strip');
  const bloque = document.getElementById('bloque-pac-info');
  if (!codigo) { bloque.style.display = 'none'; return; }
  
  const { data: p, error } = await supabaseClient
    .from('pacientes')
    .select('*')
    .eq('codigo', codigo)
    .single();

  if (error || !p) { bloque.style.display = 'none'; return; }
  
  const edad = calcAge(p.fecha_nacimiento);
  const alNoNing = p.alergias && p.alergias.length && p.alergias[0] !== 'Ninguna';
  strip.innerHTML = `
    <div class="patient-info-strip">
      <div class="pi-avatar">${p.nombres[0]}${p.apellidos[0]}</div>
      <div class="pi-data">
        <div class="pi-name">${p.nombres} ${p.apellidos}</div>
        <div class="pi-meta">${edad} años · ${p.telefono} · ${p.tipo_documento}: ${p.documento}</div>
      </div>
      ${alNoNing ? `<div class="allergy-alert">⚠️ ${p.alergias.join(', ')}</div>` : ''}
    </div>`;
  bloque.style.display = 'block';
  clearFieldError('cita-paciente');
}

function onPrioridadChange() {
  const val = document.getElementById('cita-prioridad').value;
  document.getElementById('bloque-justificacion').style.display = val === 'Urgente' ? 'block' : 'none';
}

async function resetFormCita() {
  document.getElementById('form-cita').reset();
  document.getElementById('cita-codigo-edit').value = '';
  
  // Autogeneración secuencial del ID de CITA consultando la realidad de la BD
  const { data: citas } = await supabaseClient.from('citas').select('codigo');
  let siguienteCodigo = 'CITA001';
  if (citas && citas.length > 0) {
    const nums = citas.map(c => parseInt((c.codigo || '').replace('CITA', '')) || 0);
    const maxNum = Math.max(...nums) + 1;
    siguienteCodigo = 'CITA' + String(maxNum).padStart(3, '0');
  }

  document.getElementById('cita-codigo').value = siguienteCodigo;
  document.getElementById('bloque-pac-info').style.display = 'none';
  document.getElementById('bloque-justificacion').style.display = 'none';
  document.getElementById('cita-medico').innerHTML = '<option value="">Seleccione especialidad primero</option>';
  clearAllErrors('form-cita');
}

async function validarFormCita() {
  clearAllErrors('form-cita');
  let ok = true;
  const editCodigo   = document.getElementById('cita-codigo-edit').value;
  const paciente     = document.getElementById('cita-paciente').value;
  const especialidad = document.getElementById('cita-especialidad').value;
  const medico       = document.getElementById('cita-medico').value;
  const fecha        = document.getElementById('cita-fecha').value;
  const hora         = document.getElementById('cita-hora').value;
  const prioridad    = document.getElementById('cita-prioridad').value;
  const motivo       = document.getElementById('cita-motivo').value.trim();
  const justific     = document.getElementById('cita-justificacion').value.trim();

  if (!paciente)     { showFieldError('cita-paciente',    'Seleccione un paciente');         ok = false; }
  if (!especialidad) { showFieldError('cita-especialidad','Seleccione la especialidad');      ok = false; }
  if (!medico)       { showFieldError('cita-medico',      'Seleccione el médico');            ok = false; }
  if (!fecha)        { showFieldError('cita-fecha',       'La fecha es obligatoria');         ok = false; }
  else if (fecha < todayStr()) { showFieldError('cita-fecha', 'No se permiten fechas pasadas'); ok = false; }
  if (!hora)         { showFieldError('cita-hora',        'Seleccione la hora');              ok = false; }
  if (!prioridad)    { showFieldError('cita-prioridad',   'Seleccione la prioridad');         ok = false; }
  if (prioridad === 'Urgente' && justific.length < 10) { showFieldError('cita-justificacion', 'La justificación debe tener mínimo 10 caracteres'); ok = false; }
  if (!motivo || motivo.length < 10) { showFieldError('cita-motivo', 'El motivo debe tener mínimo 10 caracteres'); ok = false; }
  else if (motivo.length > 200)      { showFieldError('cita-motivo', 'Máximo 200 caracteres'); ok = false; }

  if (ok) {
    // Validación asíncrona de solapamiento de agenda médica
    const { data: conflMed } = await supabaseClient
      .from('citas')
      .select('codigo')
      .eq('medico', medico)
      .eq('fecha', fecha)
      .eq('hora', hora)
      .not('estado', 'in', '("Cancelada","No asistió")')
      .neq('codigo', editCodigo);

    if (conflMed && conflMed.length > 0) {
      showFieldError('cita-hora', 'El médico ya tiene una cita reservada en ese horario');
      ok = false;
    }

    const { data: conflPac } = await supabaseClient
      .from('citas')
      .select('codigo')
      .eq('paciente_id', paciente)
      .eq('fecha', fecha)
      .eq('hora', hora)
      .not('estado', 'in', '("Cancelada","No asistió")')
      .neq('codigo', editCodigo);

    if (conflPac && conflPac.length > 0) {
      showFieldError('cita-hora', 'El paciente ya cuenta con una cita en ese mismo horario');
      ok = false;
    }
  }
  return ok;
}

async function guardarCita() {
  const isValid = await validarFormCita();
  if (!isValid) { showToast('Corrija los errores', 'error'); return; }
  
  const editCodigo = document.getElementById('cita-codigo-edit').value;
  
  let estadoActual = 'Programada';
  if (editCodigo) {
    const { data: existente } = await supabaseClient.from('citas').select('estado').eq('codigo', editCodigo).single();
    if (existente) estadoActual = existente.estado;
  }

  const citaData = {
    codigo:       editCodigo || document.getElementById('cita-codigo').value,
    paciente_id:  document.getElementById('cita-paciente').value,
    especialidad: document.getElementById('cita-especialidad').value,
    medico:       document.getElementById('cita-medico').value,
    fecha:        document.getElementById('cita-fecha').value,
    hora:         document.getElementById('cita-hora').value,
    prioridad:    document.getElementById('cita-prioridad').value,
    motivo:       document.getElementById('cita-motivo').value.trim(),
    justificacion_prioridad: document.getElementById('cita-justificacion').value.trim() || null,
    estado:       estadoActual
  };

  if (editCodigo) {
    const { error } = await supabaseClient.from('citas').update(citaData).eq('codigo', editCodigo);
    if (error) { showToast(`Error: ${error.message}`, 'error'); return; }
    showToast('Cita médica actualizada', 'success');
  } else {
    const { error } = await supabaseClient.from('citas').insert([citaData]);
    if (error) { showToast(`Error: ${error.message}`, 'error'); return; }
    showToast('Cita agendada exitosamente', 'success');
  }

  closeModal('modal-cita');
  renderCitas();
  updateStats();
}

async function renderCitas() {
  const q    = (document.getElementById('f-buscar').value || '').toLowerCase();
  const fF   = document.getElementById('f-fecha').value;
  const fE   = document.getElementById('f-estado').value;
  const fEsp = document.getElementById('f-especialidad').value;
  const fP   = document.getElementById('f-prioridad').value;

  const { data: citas, error: errCitas } = await supabaseClient.from('citas').select('*');
  const { data: pacientes, error: errPacs } = await supabaseClient.from('pacientes').select('*');

  if (errCitas || !citas) return;

  let filtradas = citas.filter(c => {
    const pac = pacientes ? pacientes.find(p => p.codigo === c.paciente_id) : null;
    const nombre = pac ? `${pac.nombres} ${pac.apellidos}`.toLowerCase() : '';
    if (q && !nombre.includes(q) && !c.medico.toLowerCase().includes(q) && !c.codigo.toLowerCase().includes(q)) return false;
    if (fF   && c.fecha        !== fF)   return false;
    if (fE   && c.estado       !== fE)   return false;
    if (fEsp && c.especialidad !== fEsp) return false;
    if (fP   && c.prioridad    !== fP)   return false;
    return true;
  });

  const priOrd = { Urgente: 0, Preferencial: 1, Normal: 2 };
  filtradas.sort((a, b) => priOrd[a.prioridad] - priOrd[b.prioridad] || a.fecha.localeCompare(b.fecha) || a.hora.localeCompare(b.hora));

  const grid  = document.getElementById('cita-card-grid');
  const empty = document.getElementById('empty-citas');
  if (!filtradas.length) { grid.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';

  grid.innerHTML = filtradas.map(c => {
    const pac      = pacientes ? pacientes.find(p => p.codigo === c.paciente_id) : null;
    const nombre   = pac ? `${pac.nombres} ${pac.apellidos}` : '(Paciente no encontrado)';
    const alNoNing = pac?.alergias?.length && pac.alergias[0] !== 'Ninguna';
    const priClass = c.prioridad === 'Urgente' ? 'urgente' : c.prioridad === 'Preferencial' ? 'preferencial' : '';

    let acciones = '';
    if (c.estado === 'Programada') acciones = `<button class="btn btn-success btn-sm" onclick="cambiarEstado('${c.codigo}','Confirmada')">✔ Confirmar</button><button class="btn btn-danger btn-sm" onclick="pedirCancelacion('${c.codigo}')">✕ Cancelar</button>`;
    if (c.estado === 'Confirmada') acciones = `<button class="btn btn-info btn-sm" onclick="cambiarEstado('${c.codigo}','En espera')">🏥 A sala espera</button><button class="btn btn-danger btn-sm" onclick="pedirCancelacion('${c.codigo}')">✕ Cancelar</button>`;
    if (c.estado === 'En espera')  acciones = `<a href="sala-espera.html" class="btn btn-outline btn-sm">Ver Sala →</a>`;
    if (c.estado === 'Programada' || c.estado === 'Confirmada') acciones += `<button class="btn btn-ghost btn-sm" onclick="editarCita('${c.codigo}')">✏️</button>`;

    return `<div class="cita-card ${priClass}">
      <div class="cita-main">
        <div class="cita-header">
          <span class="cita-code">${c.codigo}</span>
          <span class="badge badge-${c.estado.toLowerCase().replace(/ /g, '')} badge-${c.estado === 'En espera' ? 'espera' : c.estado === 'En atención' ? 'atencion' : c.estado === 'No asistió' ? 'noasistio' : c.estado.toLowerCase()}">${c.estado}</span>
          <span class="badge badge-${c.prioridad.toLowerCase()}">${c.prioridad}</span>
        </div>
        <div class="cita-paciente">${nombre}</div>
        <div class="cita-meta">
          <span>👨‍⚕️ ${c.medico}</span>
          <span>🏥 ${c.especialidad}</span>
          <span>📅 ${formatDate(c.fecha)}</span>
          <span>🕐 ${c.hora}</span>
        </div>
        <div class="cita-motivo">💬 ${c.motivo}</div>
        ${alNoNing ? `<div class="cita-allergy">⚠️ Alergias: ${pac.alergias.join(', ')}</div>` : ''}
        ${c.prioridad === 'Urgente' && c.justificacion_prioridad ? `<div style="font-size:.7rem;color:var(--red);margin-top:.35rem">🚨 ${c.justificacion_prioridad}</div>` : ''}
      </div>
      <div class="cita-actions">${acciones}</div>
    </div>`;
  }).join('');
}

async function cambiarEstado(codigo, nuevoEstado) {
  const { data: c } = await supabaseClient.from('citas').select('*').eq('codigo', codigo).single();
  if (!c) return;
  if (nuevoEstado === 'En espera' && c.estado === 'Cancelada') { showToast('No se puede enviar a espera una cita cancelada', 'error'); return; }
  
  // 1. Actualizar el estado en la tabla maestra de citas
  const updateData = { estado: nuevoEstado };
  await supabaseClient.from('citas').update(updateData).eq('codigo', codigo);

  // 2. ¡CONEXIÓN CLAVE CON LA OPCIÓN B!: Si se envía a sala de espera, insertar el registro operativo
  if (nuevoEstado === 'En espera') {
    const horaLlegada = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    
    // Mapeo numérico interno de prioridades para tu columna 'orden_prioridad'
    const prioNum = c.prioridad === 'Urgente' ? 0 : c.prioridad === 'Preferencial' ? 1 : 2;

    const { error: errSala } = await supabaseClient
      .from('sala_espera')
      .insert([{
        cita_id: codigo,          // Apunta al código correlativo de la cita (Ej: CITA001)
        hora_llegada: horaLlegada, // Hora real de presencia en clínica
        estado: 'En espera',
        orden_prioridad: prioNum
      }]);

    if (errSala) {
      showToast(`Error al crear registro en sala: ${errSala.message}`, 'error');
      return;
    }
  }

  showToast(`Estado actualizado: ${nuevoEstado}`, 'success');
  renderCitas();
  updateStats();
}

function pedirCancelacion(codigo) {
  document.getElementById('cita-cancelar-codigo').value = codigo;
  document.getElementById('motivo-cancelacion').value   = '';
  clearFieldError('motivo-cancelacion');
  openModal('modal-cancelar');
}

async function confirmarCancelacion() {
  const motivo = document.getElementById('motivo-cancelacion').value.trim();
  if (!motivo) { showFieldError('motivo-cancelacion', 'Ingrese el motivo de cancelación'); return; }
  const codigo = document.getElementById('cita-cancelar-codigo').value;
  
  await supabaseClient.from('citas').update({ estado: 'Cancelada', motivo_cancelacion: motivo }).eq('codigo', codigo);
  closeModal('modal-cancelar');
  showToast('Cita médica cancelada', 'warn');
  renderCitas();
  updateStats();
}

async function editarCita(codigo) {
  const { data: c, error } = await supabaseClient.from('citas').select('*').eq('codigo', codigo).single();
  if (error || !c) return;
  
  await resetFormCita();
  await cargarPacientesSelect(c.paciente_id);
  
  document.getElementById('modal-cita-title').textContent     = 'Editar Cita';
  document.getElementById('cita-codigo-edit').value           = c.codigo;
  document.getElementById('cita-codigo').value                = c.codigo;
  document.getElementById('cita-paciente').value              = c.paciente_id;
  await onPacienteChange();
  document.getElementById('cita-especialidad').value          = c.especialidad;
  onEspecialidadChange();
  
  setTimeout(() => {
    document.getElementById('cita-medico').value = c.medico;
    document.getElementById('cita-hora').value   = c.hora;
  }, 100);
  
  document.getElementById('cita-fecha').value     = c.fecha;
  document.getElementById('cita-prioridad').value = c.prioridad;
  document.getElementById('cita-motivo').value    = c.motivo;
  document.getElementById('cita-justificacion').value = c.justificacion_prioridad || '';
  if (c.prioridad === 'Urgente') document.getElementById('bloque-justificacion').style.display = 'block';
  openModal('modal-cita');
}

function limpiarFiltros() {
  ['f-buscar', 'f-fecha', 'f-estado', 'f-especialidad', 'f-prioridad'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  renderCitas();
}

async function updateStats() {
  const { data: citas } = await supabaseClient.from('citas').select('*');
  if (!citas) return;
  const today = todayStr();
  
  document.getElementById('st-total').textContent    = citas.length;
  document.getElementById('st-hoy').textContent      = citas.filter(c => c.fecha === today && !['Cancelada', 'No asistió'].includes(c.estado)).length;
  document.getElementById('st-espera').textContent   = citas.filter(c => c.estado === 'En espera').length;
  document.getElementById('st-urgentes').textContent = citas.filter(c => c.prioridad === 'Urgente' && !['Cancelada', 'No asistió', 'Atendida'].includes(c.estado)).length;
}