// ══════════════════════════════════════════
//  historial.js — Registro Clínico y Consultas
//  Conectado a la tabla: historial_consultas
// ══════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {
  await inicializarModuloHistorial();
});

async function inicializarModuloHistorial() {
  const urlParams = new URLSearchParams(window.location.search);
  const citaCodigo = urlParams.get('cita');

  if (citaCodigo) {
    // Registrar nueva consulta para esta cita
    await cargarDatosCitaPrevia(citaCodigo);
  } else {
    // Listar historiales clínicos guardados
    await listarHistorialesClinicos();
  }
}

async function cargarDatosCitaPrevia(codigo) {
  const { data: cita, error: errCita } = await supabaseClient
    .from('citas')
    .select('*')
    .eq('codigo', codigo)
    .single();

  if (errCita || !cita) {
    showToast('No se pudieron recuperar los detalles de la cita', 'error');
    return;
  }

  const { data: pac, error: errPac } = await supabaseClient
    .from('pacientes')
    .select('*')
    .eq('codigo', cita.paciente_id)
    .single();

  if (errPac || !pac) return;

  const bloqueInfo = document.getElementById('paciente-consulta-info');
  if (bloqueInfo) {
    bloqueInfo.innerHTML = `
      <div class="patient-info-strip">
        <div class="pi-avatar">${pac.nombres[0]}${pac.apellidos[0]}</div>
        <div class="pi-data">
          <div class="pi-name">${pac.nombres} ${pac.apellidos}</div>
          <div class="pi-meta">DNI: ${pac.documento} | Médico: ${cita.medico} (${cita.especialidad})</div>
        </div>
      </div>
      <input type="hidden" id="h-cita-codigo" value="${cita.codigo}"/>
      <input type="hidden" id="h-paciente-id" value="${pac.codigo}"/>
      <input type="hidden" id="h-medico" value="${cita.medico}"/>
      <input type="hidden" id="h-especialidad" value="${cita.especialidad}"/>
      <input type="hidden" id="h-sintomas" value="${cita.motivo}"/>
    `;
    bloqueInfo.style.display = 'block';
  }
}

async function guardarConsultaClinica() {
  const citaCodigo = document.getElementById('h-cita-codigo')?.value;
  const pacienteId = document.getElementById('h-paciente-id')?.value;
  const medico     = document.getElementById('h-medico')?.value;
  const esp        = document.getElementById('h-especialidad')?.value;
  const sintomas   = document.getElementById('h-sintomas')?.value;
  
  const diag       = document.getElementById('txt-diagnostico').value.trim();
  const trat       = document.getElementById('txt-tratamiento').value.trim();
  
  // Captura opcional de observaciones y próxima cita si existen en tu formulario
  const obs        = document.getElementById('txt-observaciones')?.value.trim() || '';
  const proxCita   = document.getElementById('txt-proxima-cita')?.value || null;

  if (!diag || diag.length < 10) { showToast('El diagnóstico debe tener mínimo 10 caracteres', 'error'); return; }
  if (!trat || trat.length < 10) { showToast('El tratamiento debe tener mínimo 10 caracteres', 'error'); return; }

  // 1. Generar código correlativo secuencial para el historial (HIST001, HIST002...)
  const { data: historiales } = await supabaseClient.from('historial_consultas').select('codigo');
  let siguienteCodigo = 'HIST001';
  if (historiales && historiales.length > 0) {
    const nums = historiales.map(h => parseInt((h.codigo || '').replace('HIST', '')) || 0);
    const maxNum = Math.max(...nums) + 1;
    siguienteCodigo = 'HIST' + String(maxNum).padStart(3, '0');
  }

  // 2. Mapeo exacto hacia las columnas reales de tu base de datos SQL
  const historialData = {
    codigo:         siguienteCodigo,
    paciente_id:    pacienteId,
    cita_id:        citaCodigo,
    medico:         medico,
    especialidad:   esp,
    fecha_atencion: new Date().toISOString().split('T')[0], // YYYY-MM-DD
    sintomas:       sintomas || 'Consulta regular',
    diagnostico:    diag,
    treatment:      trat, // Ajustado a tu BD
    observaciones:  obs || null,
    proxima_cita:   proxCita,
    medicamentos:   [] // Se envía arreglo vacío por defecto para cumplir con tu JSONB
  };

  const { error } = await supabaseClient.from('historial_consultas').insert([historialData]);

  if (error) {
    showToast(`Error al guardar: ${error.message}`, 'error');
    return;
  }

  showToast('Consulta clínica registrada con éxito', 'success');
  setTimeout(() => { window.location.href = 'historial.html'; }, 1200);
}

async function listarHistorialesClinicos() {
  const container = document.getElementById('historial-lista-container');
  if (!container) return;

  const { data: historiales, error: errHist } = await supabaseClient.from('historial_consultas').select('*');
  const { data: pacientes, error: errPacs } = await supabaseClient.from('pacientes').select('codigo, nombres, apellidos');

  if (errHist || !historiales || historiales.length === 0) {
    container.innerHTML = '<div class="empty-state">No hay expedientes clínicos registrados.</div>';
    return;
  }

  container.innerHTML = historiales.map(h => {
    const pac = pacientes ? pacientes.find(p => p.codigo === h.paciente_id) : null;
    const nombrePac = pac ? `${pac.nombres} ${pac.apellidos}` : '(Paciente no encontrado)';
    
    return `
      <div class="card" style="margin-bottom: 1rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:.5rem;">
          <strong style="color:var(--blue)">Expediente: ${h.codigo} (Cita: ${h.cita_id})</strong>
          <small style="color:var(--text-muted)">📅 Atendido el: ${formatDate(h.fecha_atencion)}</small>
        </div>
        <div style="font-size: .95rem; font-weight:700; margin-bottom: .4rem;">Paciente: ${nombrePac}</div>
        <div style="font-size: .8rem; color:var(--text-muted); margin-bottom: .5rem;">🩺 ${h.especialidad} — ${h.medico}</div>
        <div style="font-size: .82rem; margin-bottom: .4rem;"><strong>Síntomas reportados:</strong> ${h.sintomas}</div>
        <div style="font-size: .85rem; background: var(--gray-50); padding: .5rem; border-radius: var(--radius-sm); margin-bottom: .25rem;"><strong>Diagnóstico:</strong> ${h.diagnostico}</div>
        <div style="font-size: .85rem; background: var(--gray-50); padding: .5rem; border-radius: var(--radius-sm);"><strong>Tratamiento:</strong> ${h.tratamiento}</div>
        ${h.proxima_cita ? `<div style="font-size: .75rem; color: var(--orange); margin-top: .5rem;">⏳ Próxima cita sugerida: ${formatDate(h.proxima_cita)}</div>` : ''}
      </div>
    `;
  }).join('');
}