// ══════════════════════════════════════════
//  reportes.js — Analítica y Dashboards Clínicos
//  Conectado a Supabase y acoplado a reportes.html
// ══════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {
  await generarReporte();
});

async function generarReporte() {
  // 1. Descargar toda la información de la nube
  const { data: citas } = await supabaseClient.from('citas').select('*');
  const { data: pacientes } = await supabaseClient.from('pacientes').select('*');
  const { data: historiales } = await supabaseClient.from('historial_consultas').select('*');

  if (!citas || !pacientes || !historiales) {
    showToast('Error al conectar y descargar analíticas', 'error');
    return;
  }

  // 2. Ejecutar renderizado modular
  renderKpisSuperiores(citas, pacientes, historiales);
  renderCitasPorEspecialidad(citas);
  renderRankingMedicos(citas);
  renderCitasPorPrioridad(citas);
  renderTopPacientes(citas, pacientes);
  renderAlergiasFrecuentes(pacientes);
  renderTablaDetalle(citas, pacientes);
}

// ── 1. RENDERIZAR LAS TARJETAS KPI SUPERIORES ─────────────────────────
function renderKpisSuperiores(citas, pacientes, historiales) {
  const atendidas = citas.filter(c => c.estado === 'Atendida').length;
  const programadas = citas.filter(c => c.estado === 'Programada' || c.estado === 'Confirmada').length;
  const canceladasNoAsistio = citas.filter(c => ['Cancelada', 'No asistió'].includes(c.estado)).length;

  if (document.getElementById('kpi-pacs')) document.getElementById('kpi-pacs').textContent = pacientes.length;
  if (document.getElementById('kpi-atendidas')) document.getElementById('kpi-atendidas').textContent = atendidas;
  if (document.getElementById('kpi-programadas')) document.getElementById('kpi-programadas').textContent = programadas;
  if (document.getElementById('kpi-canceladas')) document.getElementById('kpi-canceladas').textContent = canceladasNoAsistio;
  if (document.getElementById('kpi-hist')) document.getElementById('kpi-hist').textContent = historiales.length;
}

// ── 2. GRÁFICO MANUAL DE BARRAS: CITAS POR ESPECIALIDAD ───────────────
function renderCitasPorEspecialidad(citas) {
  const container = document.getElementById('chart-especialidades');
  if (!container) return;

  const conteo = {};
  citas.forEach(c => conteo[c.especialidad] = (conteo[c.especialidad] || 0) + 1);

  const total = citas.length || 1;
  const ordenado = Object.entries(conteo).sort((a, b) => b[1] - a[1]);

  container.innerHTML = ordenado.map(([esp, cant]) => {
    const pct = Math.round((cant / total) * 100);
    return `
      <div class="bar-row">
        <div class="bar-label">${esp}</div>
        <div class="bar-track">
          <div class="bar-fill" style="width: ${pct}%; background: var(--blue);"></div>
        </div>
        <div class="bar-val">${cant} <span style="font-size:10px;font-weight:400;color:var(--gray-400)">(${pct}%)</span></div>
      </div>`;
  }).join('');
}

// ── 3. RANKING DE MÉDICOS CON MEDALLAS (ESTILOS COMPLETO) ─────────────
function renderRankingMedicos(citas) {
  const container = document.getElementById('chart-medicos');
  if (!container) return;

  const conteo = {};
  citas.filter(c => c.estado === 'Atendida').forEach(c => conteo[c.medico] = (conteo[c.medico] || 0) + 1);

  const ordenado = Object.entries(conteo).sort((a, b) => b[1] - a[1]).slice(0, 5);

  if (ordenado.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:1rem;font-size:.8rem;">Sin consultas finalizadas aún</div>';
    return;
  }

  const medallas = ['gold', 'silver', 'bronze'];

  container.innerHTML = ordenado.map(([medico, cant], index) => {
    const posClass = medallas[index] ? medallas[index] : '';
    return `
      <div class="rank-item">
        <div class="rank-pos ${posClass}">${index + 1}</div>
        <div class="rank-name">${medico}</div>
        <div class="rank-val">${cant} Atenciones</div>
      </div>`;
  }).join('');
}

// ── 4. BARRAS MANUALES: CITAS POR PRIORIDAD ───────────────────────────
function renderCitasPorPrioridad(citas) {
  const container = document.getElementById('chart-prioridades');
  if (!container) return;

  const conteo = { Urgente: 0, Preferencial: 0, Normal: 0 };
  citas.forEach(c => { if (conteo[c.prioridad] !== undefined) conteo[c.prioridad]++; });

  const total = citas.length || 1;
  const colores = { Urgente: 'var(--red)', Preferencial: 'var(--orange)', Normal: 'var(--blue-light)' };

  container.innerHTML = Object.entries(conteo).map(([prio, cant]) => {
    const pct = Math.round((cant / total) * 100);
    return `
      <div class="bar-row">
        <div class="bar-label">${prio}</div>
        <div class="bar-track">
          <div class="bar-fill" style="width: ${pct}%; background: ${colores[prio]};"></div>
        </div>
        <div class="bar-val">${cant} <span style="font-size:10px;font-weight:400;color:var(--gray-400)">(${pct}%)</span></div>
      </div>`;
  }).join('');
}

// ── 5. TOP PACIENTES CON MÁS CONSULTAS (BARRA LATERAL) ────────────────
function renderTopPacientes(citas, pacientes) {
  const container = document.getElementById('chart-top-pacs');
  if (!container) return;

  const conteo = {};
  citas.forEach(c => conteo[c.paciente_id] = (conteo[c.paciente_id] || 0) + 1);

  const ordenado = Object.entries(conteo).sort((a, b) => b[1] - a[1]).slice(0, 4);

  container.innerHTML = ordenado.map(([pacId, cant], index) => {
    const pac = pacientes.find(p => p.codigo === pacId);
    const nombre = pac ? `${pac.nombres} ${pac.apellidos}` : 'Paciente Clínico';
    return `
      <div class="rank-item">
        <div class="rank-pos">${index + 1}</div>
        <div class="rank-name">${nombre} <br><small style="color:var(--gray-400);font-weight:400;">Código: ${pacId}</small></div>
        <div class="rank-val">${cant} Citas</div>
      </div>`;
  }).join('');
}

// ── 6. GRÁFICO DE ALERGIAS MÁS FRECUENTES (INGENIERÍA CLÍNICA) ────────
function renderAlergiasFrecuentes(pacientes) {
  const container = document.getElementById('chart-alergias');
  if (!container) return;

  const conteo = {};
  let totalPacientesConAlergia = 0;

  pacientes.forEach(p => {
    if (p.alergias && p.alergias.length > 0 && p.alergias[0] !== 'Ninguna') {
      totalPacientesConAlergia++;
      p.alergias.forEach(al => {
        conteo[al] = (conteo[al] || 0) + 1;
      });
    }
  });

  const ordenado = Object.entries(conteo).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const totalDivisor = totalPacientesConAlergia || 1;

  if (ordenado.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:1rem;font-size:.8rem;">No se registran pacientes con alergias activas</div>';
    return;
  }

  container.innerHTML = ordenado.map(([alergia, cant]) => {
    const pct = Math.round((cant / totalDivisor) * 100);
    return `
      <div class="bar-row">
        <div class="bar-label" style="min-width:110px">${alergia}</div>
        <div class="bar-track">
          <div class="bar-fill" style="width: ${pct}%; background: #EF4444;"></div>
        </div>
        <div class="bar-val">${cant} pacs</div>
      </div>`;
  }).join('');
}

// ── 7. DETALLE DE LA TABLA COMPLETA INFERIOR (HISTORIAL DE CITAS) ─────
async function renderTablaDetalle(citasFiltradas = null, pacientesLista = null) {
  const tbody = document.getElementById('tbody-reporte');
  if (!tbody) return;

  const citas = citasFiltradas || (await supabaseClient.from('citas').select('*')).data;
  const pacientes = pacientesLista || (await supabaseClient.from('pacientes').select('*')).data;

  const q = (document.getElementById('r-buscar').value || '').toLowerCase();
  const fEstado = document.getElementById('r-estado-tabla').value;

  if (!citas) return;

  let filtradas = citas.filter(c => {
    const pac = pacientes ? pacientes.find(p => p.codigo === c.paciente_id) : null;
    const nombre = pac ? `${pac.nombres} ${pac.apellidos}`.toLowerCase() : '';

    if (q && !nombre.includes(q) && !c.medico.toLowerCase().includes(q) && !c.codigo.toLowerCase().includes(q)) return false;
    if (fEstado && c.estado !== fEstado) return false;
    return true;
  });

  if (filtradas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--gray-400)">No se encontraron registros coincidentes</td></tr>';
    return;
  }

  tbody.innerHTML = filtradas.map(c => {
    const pac = pacientes ? pacientes.find(p => p.codigo === c.paciente_id) : null;
    const nombre = pac ? `${pac.nombres} ${pac.apellidos}` : '(Paciente no encontrado)';
    
    return `
      <tr>
        <td><strong>${c.codigo}</strong></td>
        <td>${nombre}</td>
        <td>${c.medico}</td>
        <td>${c.especialidad}</td>
        <td>${formatDate(c.fecha)}</td>
        <td>${c.hora}</td>
        <td><span class="badge badge-${c.estado.toLowerCase().replace(/ /g, '')}">${c.estado}</span></td>
        <td><span class="badge badge-${c.prioridad.toLowerCase()}">${c.prioridad}</span></td>
      </tr>`;
  }).join('');
}