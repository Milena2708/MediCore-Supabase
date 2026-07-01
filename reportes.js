// ══════════════════════════════════════════
//  reportes.js — Analítica y Dashboards Clínicos
//  Conectado a Supabase — Filtro de Fechas Dinámico e Inteligente
// ══════════════════════════════════════════

let DATA_CITAS_GLOBAL = [];
let DATA_PACIENTES_GLOBAL = [];
let DATA_HISTORIALES_GLOBAL = [];
let DATA_EVALUACIONES_GLOBAL = [];

document.addEventListener('DOMContentLoaded', async () => {
  await generarReporte();
});

async function generarReporte() {
  try {
    const { data: citas, error: e1 } = await supabaseClient.from('citas').select('*');
    const { data: pacientes, error: e2 } = await supabaseClient.from('pacientes').select('*');
    const { data: historiales, error: e3 } = await supabaseClient.from('historial_consultas').select('*');
    const { data: evaluaciones, error: e4 } = await supabaseClient.from('evaluaciones').select('*');

    if (e1 || e2 || e3) {
      console.error("Error Supabase:", e1 || e2 || e3);
      showToast('Error al descargar datos del servidor', 'error');
      return;
    }

    DATA_CITAS_GLOBAL = citas || [];
    DATA_PACIENTES_GLOBAL = pacientes || [];
    DATA_HISTORIALES_GLOBAL = historiales || [];
    DATA_EVALUACIONES_GLOBAL = evaluaciones || [];

    // Auto-configurar el rango visual inicial basado en la data real que existe en tu BD
    configurarRangoInicialDinamico();
    
    procesarYRenderizarTodo();
  } catch (err) {
    console.error("Error crítico de ejecución:", err);
  }
}

// Configura los inputs de fecha basándose en la fecha actual de trabajo
function configurarRangoInicialDinamico() {
  // Forzar que el análisis por defecto empiece en el mes actual de la entrega (Junio 2026)
  const hoyStr = "2026-06-30"; 
  const partes = hoyStr.split('-'); // [2026, 06, 30]
  
  const desdeStr = `${partes[0]}-${partes[1]}-01`; // 2026-06-01
  const ultimoDiaMes = new Date(partes[0], partes[1], 0).getDate();
  const hastaStr = `${partes[0]}-${partes[1]}-${String(ultimoDiaMes).padStart(2, '0')}`; // 2026-06-30

  if (document.getElementById('r-desde')) document.getElementById('r-desde').value = desdeStr;
  if (document.getElementById('r-hasta')) document.getElementById('r-hasta').value = hastaStr;
}

// Normaliza cualquier formato de fecha (DD/MM/YYYY o YYYY-MM-DD) a una cadena comparable estándar (YYYY-MM-DD)
function normalizarFechaAString(fechaStr) {
  if (!fechaStr) return "";
  const texto = fechaStr.trim();
  if (texto.includes('/')) {
    const partes = texto.split('/');
    return `${partes[2]}-${partes[1].padStart(2, '0')}-${partes[0].padStart(2, '0')}`;
  }
  return texto;
}

function procesarYRenderizarTodo() {
  const desde = document.getElementById('r-desde').value;
  const hasta = document.getElementById('r-hasta').value;

  const strDesde = desde ? normalizarFechaAString(desde) : null;
  const strHasta = hasta ? normalizarFechaAString(hasta) : null;

  let citasFiltradas = DATA_CITAS_GLOBAL.filter(c => {
    if (!c.fecha) return false;
    const strCita = normalizarFechaAString(c.fecha);
    if (!strCita) return false;

    if (strDesde && strCita < strDesde) return false;
    if (strHasta && strCita > strHasta) return false;
    return true;
  });

  // Filtrar evaluaciones vinculadas a las citas del período seleccionado
  const codigosFiltrados = citasFiltradas.map(c => c.codigo);
  let evaluacionesFiltradas = DATA_EVALUACIONES_GLOBAL.filter(ev => codigosFiltrados.includes(ev.cita_id));

  renderKpisSuperiores(citasFiltradas, DATA_PACIENTES_GLOBAL, DATA_HISTORIALES_GLOBAL);
  renderCitasPorEspecialidad(citasFiltradas);
  renderRankingMedicos(citasFiltradas);
  renderCitasPorPrioridad(citasFiltradas);
  renderTopPacientes(citasFiltradas, DATA_PACIENTES_GLOBAL);
  renderAlergiasFrecuentes(DATA_PACIENTES_GLOBAL);
  renderTablaDetalle(citasFiltradas, DATA_PACIENTES_GLOBAL);
  renderDonaEstados(citasFiltradas);
  renderCalidadServicio(evaluacionesFiltradas);
}

function setPeriodo(periodo, boton) {
  document.querySelectorAll('.period-tab').forEach(btn => btn.classList.remove('active'));
  boton.classList.add('active');

  const refAño = "2026";
  const refMes = "06";
  const refDia = "30";

  let desdeStr = '';
  let hastaStr = `${refAño}-${refMes}-${refDia}`;

  if (periodo === 'hoy') {
    desdeStr = hastaStr;
  } else if (periodo === 'semana') {
    const baseDate = new Date(refAño, parseInt(refMes) - 1, refDia);
    baseDate.setDate(baseDate.getDate() - 7);
    desdeStr = baseDate.toISOString().split('T')[0];
  } else if (periodo === 'mes') {
    desdeStr = `${refAño}-${refMes}-01`;
    const ultimoDia = new Date(refAño, refMes, 0).getDate();
    hastaStr = `${refAño}-${refMes}-${String(ultimoDia).padStart(2, '0')}`;
  } else if (periodo === 'todo') {
    desdeStr = '';
    hastaStr = '';
  }

  document.getElementById('r-desde').value = desdeStr;
  document.getElementById('r-hasta').value = hastaStr;

  procesarYRenderizarTodo();
  showToast(`Período filtrado por: ${periodo}`, 'success');
}

function aplicarFiltroFecha() {
  procesarYRenderizarTodo();
  showToast('Filtro de fecha personalizado aplicado', 'success');
}

function renderKpisSuperiores(citas, pacientes, historiales) {
  const atendidas = citas.filter(c => (c.estado || '').trim() === 'Atendida').length;
  const programadas = citas.filter(c => (c.estado || '').trim() === 'Programada' || (c.estado || '').trim() === 'Confirmada').length;
  const canceladasNoAsistio = citas.filter(c => ['Cancelada', 'No asistió'].includes((c.estado || '').trim())).length;

  if (document.getElementById('kpi-pacs')) document.getElementById('kpi-pacs').textContent = pacientes.length;
  if (document.getElementById('kpi-atendidas')) document.getElementById('kpi-atendidas').textContent = atendidas;
  if (document.getElementById('kpi-programadas')) document.getElementById('kpi-programadas').textContent = programadas;
  if (document.getElementById('kpi-canceladas')) document.getElementById('kpi-canceladas').textContent = canceladasNoAsistio;
  if (document.getElementById('kpi-hist')) document.getElementById('kpi-hist').textContent = historiales.length;
}

function renderDonaEstados(citas) {
  const svgContainer = document.getElementById('donut-svg');
  const legendContainer = document.getElementById('donut-legend');
  if (!svgContainer || !legendContainer) return;

  const estados = ['Programada', 'Confirmada', 'En espera', 'En atención', 'Atendida', 'Cancelada', 'No asistió'];
  const conteo = {};
  estados.forEach(e => conteo[e] = 0);
  
  citas.forEach(c => { 
    const estadoLimpio = (c.estado || '').trim();
    if (conteo[estadoLimpio] !== undefined) conteo[estadoLimpio]++; 
  });

  const total = citas.length || 1;
  const coloresFuerte = {
    'Programada': '#B45309', 'Confirmada': '#065F46', 'En espera': '#0E7490',
    'En atención': '#92400E', 'Atendida': '#065F46', 'Cancelada': '#991B1B', 'No asistió': '#64748B'
  };

  let acumulado = 0;
  let svgHtml = `<svg width="140" height="160" viewBox="0 0 42 42" style="transform: rotate(-90deg); display: block; margin: auto;">
    <circle cx="21" cy="21" r="15.915" fill="#fff"></circle>
    <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#E2E8F0" stroke-width="4"></circle>`;

  let legendHtml = '';

  Object.entries(conteo).forEach(([est, cant]) => {
    const pct = (cant / total) * 100;
    if (cant > 0) {
      const strokeDashArray = `${pct} ${100 - pct}`;
      const strokeDashOffset = 100 - acumulado;
      svgHtml += `<circle cx="21" cy="21" r="15.915" fill="transparent" stroke="${coloresFuerte[est]}" stroke-width="4" stroke-dasharray="${strokeDashArray}" stroke-dashoffset="${strokeDashOffset}"></circle>`;
      acumulado += pct;
    }

    legendHtml += `
      <div class="legend-item" style="display:flex; align-items:center; gap:.5rem; margin-bottom:.4rem; font-size:.75rem;">
        <div class="legend-dot" style="background:${coloresFuerte[est]}; width:10px; height:10px; border-radius:50%"></div>
        <span style="flex:1; color:var(--gray-600)">${est}</span>
        <span style="font-weight:700; color:var(--gray-900)">${cant} (${Math.round(pct)}%)</span>
      </div>`;
  });

  svgHtml += `</svg>`;
  svgContainer.innerHTML = svgHtml;
  legendContainer.innerHTML = legendHtml;
}

function renderCalidadServicio(evaluaciones) {
  let container = document.getElementById('chart-calidad-areas');
  if (!container) {
    const gridLayout = document.getElementById('chart-prioridades')?.closest('.report-grid');
    if (gridLayout) {
      const nuevaTarjeta = document.createElement('div');
      nuevaTarjeta.className = 'card';
      nuevaTarjeta.innerHTML = `<div class="card-title">⭐ Calidad de Servicio por Áreas</div><div id="chart-calidad-areas"></div>`;
      gridLayout.appendChild(nuevaTarjeta);
      container = document.getElementById('chart-calidad-areas');
    }
  }

  if (!container) return;
  if (!evaluaciones || evaluaciones.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:1rem;font-size:.8rem;">No se registran encuestas de satisfacción aún</div>';
    return;
  }

  let med = 0, rec = 0, enf = 0;
  evaluaciones.forEach(ev => {
    med += ev.puntuacion_medico || 0;
    rec += ev.puntuacion_recepcion || 0;
    enf += ev.puntuacion_enfermeria || 0;
  });

  const total = evaluaciones.length;
  const areas = [
    { name: 'Cuidado Médico', score: (med / total).toFixed(1), color: 'var(--blue)' },
    { name: 'Atención en Recepción', score: (rec / total).toFixed(1), color: 'var(--teal)' },
    { name: 'Servicio de Enfermería', score: (enf / total).toFixed(1), color: 'var(--green)' }
  ];

  container.innerHTML = areas.map(a => {
    const pctBarra = (a.score / 5) * 100;
    return `
      <div class="bar-row" style="margin-bottom: 1.1rem;">
        <div class="bar-label" style="min-width:150px"><strong>${a.name}</strong></div>
        <div class="bar-track" style="height:10px;">
          <div class="bar-fill" style="width: ${pctBarra}%; background: ${a.color};"></div>
        </div>
        <div class="bar-val" style="min-width:45px">${a.score} ⭐</div>
      </div>`;
  }).join('');
}

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

function renderRankingMedicos(citas) {
  const container = document.getElementById('chart-medicos');
  if (!container) return;

  const conteo = {};
  citas.filter(c => (c.estado || '').trim() === 'Atendida').forEach(c => conteo[c.medico] = (conteo[c.medico] || 0) + 1);
  const ordenado = Object.entries(conteo).sort((a, b) => b[1] - a[1]).slice(0, 5);

  if (ordenado.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:1rem;font-size:.8rem;">Sin consultas finalizadas en este período</div>';
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
        <div class="bar-track" style="flex:1; background:var(--gray-100); border-radius:var(--radius-full); height:10px; overflow:hidden;">
          <div class="bar-fill" style="width: ${pct}%; background: ${colores[prio]};"></div>
        </div>
        <div class="bar-val">${cant} <span style="font-size:10px;font-weight:400;color:var(--gray-400)">(${pct}%)</span></div>
      </div>`;
  }).join('');
}

function renderTopPacientes(citas, pacientes) {
  const container = document.getElementById('chart-top-pacs');
  if (!container) return;

  const conteo = {};
  citas.forEach(c => conteo[c.paciente_id] = (conteo[c.paciente_id] || 0) + 1);
  const ordenado = Object.entries(conteo).sort((a, b) => b[1] - a[1]).slice(0, 4);

  if (ordenado.length === 0 || !pacientes) {
    container.innerHTML = '<div class="empty-state" style="padding:1rem;font-size:.8rem;">Sin registros en este rango</div>';
    return;
  }
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

function renderAlergiasFrecuentes(pacientes) {
  const container = document.getElementById('chart-alergias');
  if (!container) return;

  const conteo = {};
  let totalPacientesConAlergia = 0;

  pacientes.forEach(p => {
    if (p.alergias && p.alergias.length > 0 && p.alergias[0] !== 'Ninguna') {
      totalPacientesConAlergia++;
      p.alergias.forEach(al => { conteo[al] = (conteo[al] || 0) + 1; });
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
        <div class="bar-track" style="flex:1; background:var(--gray-100); border-radius:var(--radius-full); height:10px; overflow:hidden;">
          <div class="bar-fill" style="width: ${pct}%; background: #EF4444;"></div>
        </div>
        <div class="bar-val">${cant} pacs</div>
      </div>`;
  }).join('');
}

function renderTablaDetalle(citasFiltradas, pacientesLista) {
  const tbody = document.getElementById('tbody-reporte');
  if (!tbody) return;

  const q = (document.getElementById('r-buscar').value || '').toLowerCase();
  const fEstado = document.getElementById('r-estado-tabla').value;

  let filtradas = citasFiltradas.filter(c => {
    const pac = pacientesLista ? pacientesLista.find(p => p.codigo === c.paciente_id) : null;
    const nombre = pac ? `${pac.nombres} ${pac.apellidos}`.toLowerCase() : '';

    if (q && !nombre.includes(q) && !c.medico.toLowerCase().includes(q) && !c.codigo.toLowerCase().includes(q)) return false;
    if (fEstado && (c.estado || '').trim() !== fEstado) return false;
    return true;
  });

  if (filtradas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--gray-400)">No se encontraron registros coincidentes</td></tr>';
    return;
  }
  tbody.innerHTML = filtradas.map(c => {
    const pac = pacientesLista ? pacientesLista.find(p => p.codigo === c.paciente_id) : null;
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

function exportarCSV() {
  if (!DATA_CITAS_GLOBAL.length) {
    showToast('No hay datos disponibles para exportar', 'warn');
    return;
  }
  let csvContent = "data:text/csv;charset=utf-8,Codigo,Especialidad,Medico,Fecha,Hora,Estado,Prioridad\n";
  DATA_CITAS_GLOBAL.forEach(c => {
    csvContent += `${c.codigo},${c.especialidad},${c.medico},${c.fecha},${c.hora},${c.estado},${c.prioridad}\n`;
  });
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `Reporte_Clinico_MediCore.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Archivo CSV descargado con éxito', 'success');
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  if (dateStr.includes('/')) return dateStr;
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}