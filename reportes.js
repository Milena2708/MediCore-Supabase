// ══════════════════════════════════════════
//  reportes.js — Métricas y Analítica Clínica
//  Conectado a Supabase Database (supabaseClient)
// ══════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {
  await inicializarModuloReportes();
});

async function inicializarModuloReportes() {
  // 1. Descargar toda la data histórica de la nube en paralelo
  const { data: citas } = await supabaseClient.from('citas').select('*');
  const { data: pacientes } = await supabaseClient.from('pacientes').select('*');
  const { data: historiales } = await supabaseClient.from('historial_consultas').select('*');

  if (!citas || !pacientes) {
    showToast('Error al cargar datos para reportes', 'error');
    return;
  }

  // 2. Procesar y renderizar cada sección del cuadro de mando
  calcularKpisGlobales(citas, pacientes, historiales);
  renderGraficoEspecialidades(citas);
  renderTablaEficienciaMedicos(citas, historiales);
  renderDistribucionPrioridades(citas);
}

// ── 1. CÁLCULO DE KPIS Y TARJETAS DE INDICADORES ──────────────────────
function calcularKpisGlobales(citas, pacientes, historiales) {
  const totalCitas = citas.length;
  
  // Tasa de Asistencia = (Atendidas / (Total - Canceladas)) * 100
  const validas = citas.filter(c => c.estado !== 'Cancelada').length;
  const atendidas = citas.filter(c => c.estado === 'Atendida').length;
  const tasaAsistencia = validas > 0 ? Math.round((atendidas / validas) * 100) : 0;

  // Pacientes críticos (con alertas de alergias activas)
  const criticos = pacientes.filter(p => p.alergias && p.alergias.length > 0 && p.alergias[0] !== 'Ninguna').length;

  // Ticket Promedio de Atención Recetada
  const conMeds = historiales ? historiales.filter(h => h.medicamentos && h.medicamentos.length > 0).length : 0;

  // Inyectar en los IDs de tus tarjetas de reporte
  if (document.getElementById('rep-total-citas')) document.getElementById('rep-total-citas').textContent = totalCitas;
  if (document.getElementById('rep-tasa-asistencia')) document.getElementById('rep-tasa-asistencia').textContent = `${tasaAsistencia}%`;
  if (document.getElementById('rep-pacs-criticos')) document.getElementById('rep-pacs-criticos').textContent = criticos;
  if (document.getElementById('rep-con-receta')) document.getElementById('rep-con-receta').textContent = conMeds;
}

// ── 2. GRÁFICO / BARRAS DE ESPECIALIDADES MÁS DEMANDADAS ──────────────
function renderGraficoEspecialidades(citas) {
  const container = document.getElementById('rep-especialidades-list');
  if (!container) return;

  // Contar frecuencias por especialidad
  const conteo = {};
  citas.forEach(c => {
    conteo[c.especialidad] = (conteo[c.especialidad] || 0) + 1;
  });

  const total = citas.length || 1;
  const ordenado = Object.entries(conteo).sort((a, b) => b[1] - a[1]);

  if (ordenado.length === 0) {
    container.innerHTML = '<div style="font-size:.8rem;color:var(--gray-400)">Sin datos de especialidades</div>';
    return;
  }

  // Generar barras estéticas utilizando CSS vanilla basado en porcentajes
  container.innerHTML = ordenado.map(([esp, cant]) => {
    const pct = Math.round((cant / total) * 100);
    return `
      <div style="margin-bottom: .85rem;">
        <div style="display:flex; justify-content:space-between; font-size:.8rem; margin-bottom:.25rem;">
          <span style="font-weight:600; color:var(--gray-700)">${esp}</span>
          <span style="color:var(--gray-500)">${cant} citas (${pct}%)</span>
        </div>
        <div style="width:100%; height:8px; background:var(--gray-100); border-radius:4px; overflow:hidden;">
          <div style="width:${pct}%; height:100%; background:var(--blue); border-radius:4px;"></div>
        </div>
      </div>
    `;
  }).join('');
}

// ── 3. TABLA DE EFICIENCIA OPERATIVA POR MÉDICO ────────────────────────
function renderTablaEficienciaMedicos(citas, historiales) {
  const tbody = document.getElementById('rep-tabla-medicos-body');
  if (!tbody) return;

  // Agrupar métricas por cada médico
  const medicosData = {};

  citas.forEach(c => {
    if (!medicosData[c.medico]) {
      medicosData[c.medico] = { nombre: c.medico, especialidad: c.especialidad, total: 0, atendidas: 0, canceladas: 0 };
    }
    medicosData[c.medico].total++;
    if (c.estado === 'Atendida') medicosData[c.medico].atendidas++;
    if (c.estado === 'Cancelada') medicosData[c.medico].canceladas++;
  });

  const filas = Object.values(medicosData).sort((a, b) => b.atendidas - a.atendidas);

  if (filas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--gray-400)">No hay registros médicos activos</td></tr>';
    return;
  }

  tbody.innerHTML = filas.map(m => {
    const rendimiento = m.total > 0 ? Math.round((m.atendidas / m.total) * 100) : 0;
    let rankClass = rendimiento >= 75 ? 'badge-espera' : rendimiento >= 40 ? 'badge-atencion' : 'badge-noasistio';
    
    return `
      <tr>
        <td><strong>${m.nombre}</strong><br><small style="color:var(--gray-400)">${m.especialidad}</small></td>
        <td style="text-align:center">${m.total}</td>
        <td style="text-align:center;color:var(--green);font-weight:600">${m.atendidas}</td>
        <td style="text-align:right">
          <span class="badge ${rankClass}">${rendimiento}% Eficacia</span>
        </td>
      </tr>
    `;
  }).join('');
}

// ── 4. PANEL DE DISTRIBUCIÓN DE PRIORIDADES DE ATENCIÓN ────────────────
function renderDistribucionPrioridades(citas) {
  const pEl = document.getElementById('rep-prioridades-container');
  if (!pEl) return;

  const urgentes = citas.filter(c => c.prioridad === 'Urgente').length;
  const preferenciales = citas.filter(c => c.prioridad === 'Preferencial').length;
  const normales = citas.filter(c => c.prioridad === 'Normal').length;
  const total = citas.length || 1;

  pEl.innerHTML = `
    <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:.5rem; text-align:center;">
      <div style="background:var(--red-pale); padding:.75rem; border-radius:var(--radius)">
        <div style="font-size:1.25rem; font-weight:800; color:var(--red)">${urgentes}</div>
        <div style="font-size:.65rem; text-transform:uppercase; color:var(--red); font-weight:700">Urgentes</div>
        <div style="font-size:.65rem; color:var(--gray-400)">${Math.round((urgentes/total)*100)}%</div>
      </div>
      <div style="background:var(--orange-pale); padding:.75rem; border-radius:var(--radius)">
        <div style="font-size:1.25rem; font-weight:800; color:var(--orange)">${preferenciales}</div>
        <div style="font-size:.65rem; text-transform:uppercase; color:var(--orange); font-weight:700">Preferencial</div>
        <div style="font-size:.65rem; color:var(--gray-400)">${Math.round((preferenciales/total)*100)}%</div>
      </div>
      <div style="background:var(--blue-pale); padding:.75rem; border-radius:var(--radius)">
        <div style="font-size:1.25rem; font-weight:800; color:var(--blue)">${normales}</div>
        <div style="font-size:.65rem; text-transform:uppercase; color:var(--blue); font-weight:700">Normal</div>
        <div style="font-size:.65rem; color:var(--gray-400)">${Math.round((normales/total)*100)}%</div>
      </div>
    </div>
  `;
}
}