// ══════════════════════════════════════════
//  sala-espera.js — Gestión de Cola en Tiempo Real
//  Conectado a la tabla operativa: sala_espera (Opción B)
// ══════════════════════════════════════════

const PRIO_ORD = { Urgente: 0, Preferencial: 1, Normal: 2 };

document.addEventListener('DOMContentLoaded', async () => {
  await cargarMedicosSelect();
  await renderSala();
  setInterval(renderSala, 15000); // Auto-refresh cada 15 segundos para simular tiempo real
});

// Carga dinámica de médicos basada en las citas de la nube
async function cargarMedicosSelect() {
  const { data: citas } = await supabaseClient.from('citas').select('medico');
  if (!citas) return;
  
  const medicos = [...new Set(citas.map(c => c.medico).filter(Boolean))];
  const sel     = document.getElementById('f-medico');
  if (sel) {
    sel.innerHTML = '<option value="">Todos los médicos</option>';
    medicos.forEach(m => {
      const o = document.createElement('option');
      o.value = o.textContent = m;
      sel.appendChild(o);
    });
  }
}

async function renderSala() {
  const fMed = document.getElementById('f-medico').value;
  const fEsp = document.getElementById('f-especialidad').value;
  let fEst = document.getElementById('f-estado-sala').value;

  // Homologar "Atendido" de la opción HTML con "Atendida" de tu CHECK SQL
  if (fEst === 'Atendido') fEst = 'Atendida';

  // 1. Descargar la data exclusivamente desde la tabla operativa 'sala_espera' enlazando su cita maestra
  const { data: cola, error: errCola } = await supabaseClient.from('sala_espera').select('*, citas(*)');
  const { data: pacientes, error: errPacs } = await supabaseClient.from('pacientes').select('*');

  if (errCola || !cola) return;

  // Mapear los datos unificados leyendo el estado y los tiempos de atención reales de 'sala_espera'
  let filtradas = cola.map(item => {
    const c = item.citas || {};
    return {
      ...c,
      estado: item.estado, // Estado dinámico de la sala de espera
      hora_llegada: item.hora_llegada, // Extraído de tu columna SQL de sala_espera
      hora_inicio_atencion: item.hora_inicio_atencion, // Extraído de tu columna SQL de sala_espera
      prioridad_num: item.orden_prioridad
    };
  });

  // Filtrar según los criterios de búsqueda activos de la UI
  filtradas = filtradas.filter(c => {
    if (!c.codigo) return false;
    if (!['En espera', 'En atención', 'Atendida', 'No asistió'].includes(c.estado)) return false;
    if (fMed && c.medico !== fMed) return false;
    if (fEsp && c.especialidad !== fEsp) return false;
    if (fEst && c.estado !== fEst) return false;
    return true;
  });

  // Ordenar usando el peso numérico de prioridad de tu tabla 'sala_espera'
  filtradas.sort((a, b) => {
    const pA = PRIO_ORD[a.prioridad] ?? 2, pB = PRIO_ORD[b.prioridad] ?? 2;
    if (pA !== pB) return pA - pB;
    return (a.hora_llegada || '99:99').localeCompare(b.hora_llegada || '99:99');
  });

  const lista = document.getElementById('sala-lista');
  const empty = document.getElementById('empty-sala');

  updateStats(filtradas);
  updateSidebar(filtradas, pacientes);

  if (!filtradas.length) { 
    lista.innerHTML = ''; 
    empty.style.display = 'block'; 
    return; 
  }
  empty.style.display = 'none';

  let turnoNum = 0;
  lista.innerHTML = filtradas.map((c) => {
    const pac = pacientes ? pacientes.find(p => p.codigo === c.paciente_id) : null;
    const nombre = pac ? `${pac.nombres} ${pac.apellidos}` : '(Paciente no encontrado)';
    const priClass = (c.prioridad || '').toLowerCase();
    const alNoNing = pac?.alergias?.length && pac.alergias[0] !== 'Ninguna';
    const edad = pac ? calcAge(pac.fecha_nacimiento) : '';

    if (c.estado === 'En espera') turnoNum++;
    const numDisplay = c.estado === 'En atención' ? '🩺' : c.estado === 'Atendida' ? '✓' : c.estado === 'No asistió' ? '✗' : turnoNum;

    let acciones = '';
    if (c.estado === 'En espera') {
      acciones = `
        <button class="btn btn-success btn-sm" onclick="pasarAtencion('${c.codigo}')">🩺 Atender</button>
        <button class="btn btn-danger btn-sm"  onclick="pedirNoAsistio('${c.codigo}')">✗ No asistió</button>`;
    }
    if (c.estado === 'En atención') {
      acciones = `<button class="btn btn-primary btn-sm" onclick="pedirAtendido('${c.codigo}')">✅ Finalizar</button>`;
    }
    if (c.estado === 'Atendida') {
      acciones = `<a href="historial.html?cita=${c.codigo}" class="btn btn-outline btn-sm">📋 Registrar historial</a>`;
    }

    const estadoClass = c.estado === 'En atención' ? 'en-atencion' : c.estado === 'Atendida' ? 'atendido' : '';
    
    return `<div class="turno-card ${priClass} ${estadoClass}">
      <div class="turno-num ${priClass}">${numDisplay}</div>
      <div class="turno-body">
        <div class="turno-header">
          <span class="turno-nombre">${nombre}</span>
          <span class="badge badge-${c.estado === 'En espera' ? 'espera' : c.estado === 'En atención' ? 'atencion' : c.estado === 'Atendida' ? 'atendida' : c.estado === 'No asistió' ? 'noasistio' : c.estado.toLowerCase()}">${c.estado}</span>
          <span class="badge badge-${priClass}">${c.prioridad}</span>
        </div>
        <div class="turno-meta">
          <span>👨‍⚕️ ${c.medico}</span>
          <span>🏥 ${c.especialidad}</span>
          <span>🕐 Cita: ${c.hora}</span>
          ${pac ? `<span>🎂 ${edad} años</span>` : ''}
        </div>
        <div class="turno-motivo">${c.motivo}</div>
        ${alNoNing ? `<div class="turno-allergy">⚠️ Alergias: ${pac.alergias.join(', ')}</div>` : ''}
        <div class="turno-tiempos">
          <span class="turno-tiempo-chip">📅 ${formatDate(c.fecha)}</span>
          ${c.hora_llegada ? `<span class="turno-tiempo-chip llegada">🚶 Llegó: ${c.hora_llegada}</span>` : ''}
          ${c.hora_inicio_atencion ? `<span class="turno-tiempo-chip atencion">🩺 Atención: ${c.hora_inicio_atencion}</span>` : ''}
        </div>
      </div>
      <div class="turno-acciones">${acciones}</div>
    </div>`;
  }).join('');
}

function updateStats(citas) {
  document.getElementById('st-urgentes').textContent     = citas.filter(c => c.prioridad === 'Urgente'      && c.estado === 'En espera').length;
  document.getElementById('st-preferencial').textContent = citas.filter(c => c.prioridad === 'Preferencial' && c.estado === 'En espera').length;
  document.getElementById('st-espera').textContent       = citas.filter(c => c.estado === 'En espera').length;
  document.getElementById('st-atencion').textContent     = citas.filter(c => c.estado === 'En atención').length;
  document.getElementById('st-atendidos').textContent    = citas.filter(c => c.estado === 'Atendida').length;
}

function updateSidebar(citas, pacientes) {
  const enAtencion = citas.find(c => c.estado === 'En atención');
  if (enAtencion) {
    const pac = pacientes ? pacientes.find(p => p.codigo === enAtencion.paciente_id) : null;
    document.getElementById('ticker-num').textContent = enAtencion.codigo;
    document.getElementById('ticker-pac').textContent = pac ? `${pac.nombres} ${pac.apellidos}` : '—';
    document.getElementById('ticker-esp').textContent = `${enAtencion.especialidad} · ${enAtencion.medico}`;
  } else {
    document.getElementById('ticker-num').textContent = '—';
    document.getElementById('ticker-pac').textContent = 'Ninguno';
    document.getElementById('ticker-esp').textContent = '—';
  }

  const total    = citas.length;
  const espera   = citas.filter(c => c.estado === 'En espera').length;
  const atencion = citas.filter(c => c.estado === 'En atención').length;
  const atend    = citas.filter(c => c.estado === 'Atendida').length;
  const noAsist  = citas.filter(c => c.estado === 'No asistió').length;
  document.getElementById('resumen-dia').innerHTML = `
    <div class="resumen-item"><span class="resumen-label">Total en sala</span><span class="resumen-val">${total}</span></div>
    <div class="resumen-item"><span class="resumen-label">En espera</span><span class="resumen-val" style="color:var(--teal)">${espera}</span></div>
    <div class="resumen-item"><span class="resumen-label">En atención</span><span class="resumen-val" style="color:var(--orange)">${atencion}</span></div>
    <div class="resumen-item"><span class="resumen-label">Atendidos</span><span class="resumen-val" style="color:var(--green)">${atend}</span></div>
    <div class="resumen-item"><span class="resumen-label">No asistió</span><span class="resumen-val" style="color:var(--gray-400)">${noAsist}</span></div>`;

  const proximos = citas.filter(c => c.estado === 'En espera').slice(0, 3);
  const pEl      = document.getElementById('proximos-lista');
  if (!pEl) return;
  if (!proximos.length) { pEl.innerHTML = '<div style="font-size:.75rem;color:var(--gray-400);padding:.5rem 0">Sin pacientes en espera</div>'; return; }
  pEl.innerHTML = proximos.map((c, i) => {
    const pac = pacientes ? pacientes.find(p => p.codigo === c.paciente_id) : null;
    const nombre = pac ? `${pac.nombres} ${pac.apellidos}` : '—';
    const priColor = c.prioridad === 'Urgente' ? 'var(--red)' : c.prioridad === 'Preferencial' ? 'var(--orange)' : 'var(--blue)';
    return `
      <div style="display:flex;align-items:center;gap:.65rem;padding:.65rem 0;border-bottom:1px solid var(--gray-100)">
        <div style="width:28px;height:28px;border-radius:50%;background:${priColor};color:white;display:flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:700;flex-shrink:0">${i + 1}</div>
        <div>
          <div style="font-size:.8rem;font-weight:600;color:var(--gray-900)">${nombre}</div>
          <div style="font-size:.68rem;color:var(--gray-400)">${c.especialidad} · ${c.hora}</div>
        </div>
      </div>`;
  }).join('');
}

async function pasarAtencion(codigo) {
  const { data: activos } = await supabaseClient.from('sala_espera').select('*, citas(*)').eq('estado', 'En atención');
  const { data: citaMaestra } = await supabaseClient.from('citas').select('medico').eq('codigo', codigo).single();

  const yaEnAtencion = activos ? activos.find(x => x.citas?.medico === citaMaestra?.medico) : null;
  if (yaEnAtencion) { showToast(`El médico ${citaMaestra.medico} ya tiene un paciente en atención`, 'warn'); return; }

  const horaAhora = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });

  // 1. Actualizar tabla sala_espera
  await supabaseClient.from('sala_espera').update({ estado: 'En atención', hora_inicio_atencion: horaAhora }).eq('cita_id', codigo);
  // 2. Sincronizar estado maestro en citas
  await supabaseClient.from('citas').update({ estado: 'En atención' }).eq('codigo', codigo);

  showToast('Paciente ingresó a consultorio', 'success');
  await renderSala();
}

function pedirNoAsistio(codigo) {
  document.getElementById('noasistio-codigo').value = codigo;
  openModal('modal-noasistio');
}

async function confirmarNoAsistio() {
  const codigo = document.getElementById('noasistio-codigo').value;

  await supabaseClient.from('sala_espera').update({ estado: 'No asistió' }).eq('cita_id', codigo);
  await supabaseClient.from('citas').update({ estado: 'No asistió' }).eq('codigo', codigo);

  closeModal('modal-noasistio');
  showToast('Marcado como No asistió', 'warn');
  await renderSala();
}

function pedirAtendido(codigo) {
  document.getElementById('atendido-codigo').value = codigo;
  document.getElementById('btn-ir-historial').style.display = 'none';
  openModal('modal-a-historial');
}

async function confirmarAtendido() {
  const codigo = document.getElementById('atendido-codigo').value;
  const horaFin = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  
  // 1. Finalizar de forma operativa en la tabla relacional sala_espera
  const { error: errSala } = await supabaseClient
    .from('sala_espera')
    .update({ estado: 'Atendida', hora_fin: horaFin })
    .eq('cita_id', codigo);

  if (errSala) {
    showToast(`Error en sala: ${errSala.message}`, 'error');
    return;
  }

  // 2. Sincronizar estado final en la tabla general de citas
  await supabaseClient.from('citas').update({ estado: 'Atendida' }).eq('codigo', codigo);

  const btnH = document.getElementById('btn-ir-historial');
  if (btnH) {
    btnH.href = `historial.html?cita=${codigo}`;
    btnH.style.display = 'inline-flex';
  }
  
  showToast('Consulta finalizada con éxito.', 'success');
  closeModal('modal-a-historial');
  await renderSala();
}