// ══════════════════════════════════════════
//  evaluaciones.js — Control Analítico del Paciente
//  Conectado a la tabla: evaluaciones y citas
// ══════════════════════════════════════════

let PACIENTE_CODIGO_GLOBAL = null;

document.addEventListener('DOMContentLoaded', async () => {
  inicializarEstrellasClic();
  await identificarYcargarModulo();
});

function inicializarEstrellasClic() {
  document.querySelectorAll('.stars-input').forEach(group => {
    const stars = group.querySelectorAll('.star');
    stars.forEach(star => {
      star.addEventListener('click', () => {
        const val = star.getAttribute('data-value');
        group.setAttribute('data-rating', val);
        
        // Renderizar encendido visual de estrellas
        stars.forEach(s => {
          const sVal = s.getAttribute('data-value');
          if (parseInt(sVal) <= parseInt(val)) {
            s.classList.add('active');
          } else {
            s.classList.remove('active');
          }
        });
        
        // Limpiar errores visuales si existían
        const errId = group.parentElement.querySelector('.form-error').id;
        document.getElementById(errId).textContent = '';
      });
    });
  });
}

async function identificarYcargarModulo() {
  try {
    // 1. Obtener correo del usuario autenticado en la sesión activa
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) { window.location.href = 'login.html'; return; }

    // 2. Extraer el código clínico real (PAC001, etc.) desde la tabla de pacientes
    const { data: pac } = await supabaseClient.from('pacientes').select('codigo').eq('correo', user.email).single();
    if (!pac) return;

    PACIENTE_CODIGO_GLOBAL = pac.codigo;

    // 3. Renderizar componentes paralelos
    await cargarComboCitasDisponibles();
    await cargarGraficosSatisfaccionPersonal();
  } catch (err) {
    console.error(err);
  }
}

async function cargarComboCitasDisponibles() {
  const select = document.getElementById('eval-cita');
  if (!select) return;

  // Descargar citas atendidas de este paciente específico
  const { data: citas } = await supabaseClient.from('citas').select('*').eq('paciente_id', PACIENTE_CODIGO_GLOBAL).eq('estado', 'Atendida');
  // Descargar evaluaciones ya realizadas para no duplicar votos
  const { data: yaVotadas } = await supabaseClient.from('evaluaciones').select('cita_id').eq('paciente_id', PACIENTE_CODIGO_GLOBAL);

  const listadoVotados = yaVotadas ? yaVotadas.map(v => v.cita_id) : [];
  const pendientes = citas ? citas.filter(c => !listadoVotados.includes(c.codigo)) : [];

  if (pendientes.length === 0) {
    document.getElementById('panel-formulario').style.display = 'none';
    return;
  }

  // Si hay pendientes, mostramos el panel del formulario
  document.getElementById('panel-formulario').style.display = 'block';
  select.innerHTML = '<option value="">Selecciona una consulta atendida…</option>';
  pendientes.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.codigo;
    opt.textContent = `Cita: ${c.codigo} — Dr(a). ${c.medico} (${c.fecha})`;
    select.appendChild(opt);
  });
}

async function cargarGraficosSatisfaccionPersonal() {
  const container = document.getElementById('chart-mis-votos');
  if (!container) return;

  const { data: misVotos } = await supabaseClient.from('evaluaciones').select('*').eq('paciente_id', PACIENTE_CODIGO_GLOBAL);

  if (!misVotos || misVotos.length === 0) {
    document.getElementById('stat-promedio').textContent = '0.0 ⭐';
    document.getElementById('stat-total-votos').textContent = '0';
    container.innerHTML = '<div class="empty-state" style="padding:1rem; font-size:.8rem;">Aún no has calificado ninguna consulta médica.</div>';
    return;
  }

  let med = 0, rec = 0, enf = 0;
  misVotos.forEach(v => {
    med += v.puntuacion_medico || 0;
    rec += v.puntuacion_recepcion || 0;
    enf += v.puntuacion_enfermeria || 0;
  });

  const total = misVotos.length;
  const pMed = (med / total).toFixed(1);
  const pRec = (rec / total).toFixed(1);
  const pEnf = (enf / total).toFixed(1);
  const general = ((parseFloat(pMed) + parseFloat(pRec) + parseFloat(pEnf)) / 3).toFixed(1);

  document.getElementById('stat-promedio').textContent = `${general} ⭐`;
  document.getElementById('stat-total-votos').textContent = total;

  const metricas = [
    { name: '👨‍⚕️ Mi Médico Tratante', score: pMed, color: 'var(--blue)' },
    { name: '🛎️ Personal de Recepción', score: pRec, color: 'var(--teal)' },
    { name: '🩺 Servicio de Enfermería', score: pEnf, color: 'var(--green)' }
  ];

  container.innerHTML = metricas.map(m => {
    const pct = (m.score / 5) * 100;
    return `
      <div class="bar-row" style="margin-bottom: 1.25rem;">
        <div class="bar-label" style="min-width:160px; font-size:.78rem;"><strong>${m.name}</strong></div>
        <div class="bar-track" style="height:12px; background: var(--gray-100);">
          <div class="bar-fill" style="width: ${pct}%; background: ${m.color}; height:100%;"></div>
        </div>
        <div class="bar-val" style="min-width:45px; font-size:.78rem; text-align:right;">${m.score} ⭐</div>
      </div>`;
  }).join('');
}

async function enviarEvaluacion() {
  const cita = document.getElementById('eval-cita').value;
  const ratingMed = document.getElementById('stars-medico').getAttribute('data-rating');
  const ratingRec = document.getElementById('stars-recepcion').getAttribute('data-rating');
  const ratingEnf = document.getElementById('stars-enfermeria').getAttribute('data-rating');
  const comentarios = document.getElementById('eval-comentarios').value.trim();

  let ok = true;
  if (!cita) { document.getElementById('eval-cita-err').textContent = 'Selecciona una consulta'; ok = false; }
  if (ratingMed === "0") { document.getElementById('eval-medico-err').textContent = 'Califica este campo'; ok = false; }
  if (ratingRec === "0") { document.getElementById('eval-recepcion-err').textContent = 'Califica este campo'; ok = false; }
  if (ratingEnf === "0") { document.getElementById('eval-enfermeria-err').textContent = 'Califica este campo'; ok = false; }

  if (!ok) return;

  const payload = {
    cita_id: cita,
    paciente_id: PACIENTE_CODIGO_GLOBAL,
    puntuacion_medico: parseInt(ratingMed),
    puntuacion_recepcion: parseInt(ratingRec),
    puntuacion_enfermeria: parseInt(ratingEnf),
    comentarios: comentarios || null
  };

  const { error } = await supabaseClient.from('evaluaciones').insert([payload]);

  if (error) {
    showToast(`Error: ${error.message}`, 'error');
    return;
  }

  showToast('Evaluación guardada con éxito', 'success');
  
  // Limpiar e intercambiar flujos visuales de forma inmediata
  document.getElementById('form-evaluacion').reset();
  document.querySelectorAll('.star').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.stars-input').forEach(g => g.setAttribute('data-rating', '0'));

  await cargarAllModulo();
}

function limpiarErroresCampos() {
  document.getElementById('eval-cita-err').textContent = '';
}

async function cargarAllModulo() {
  await cargarComboCitasDisponibles();
  await cargarGraficosSatisfaccionPersonal();
}