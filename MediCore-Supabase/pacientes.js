// ══════════════════════════════════════════
//  pacientes.js — Lógica de Negocio Asíncrona con Supabase
//  MediCore Grupo 1 - Sin dependencias locales
// ══════════════════════════════════════════

let alergiasSeleccionadas = [];

document.addEventListener('DOMContentLoaded', () => {
  // Inicializar renderizado inicial automático desde la nube
  renderTable();
  renderRecientes();
  updateStats();

  const nacInput = document.getElementById('pac-nacimiento');
  if (nacInput) nacInput.max = new Date().toISOString().split('T')[0];

  const otroInput = document.getElementById('pac-alergia-otro');
  if (otroInput) {
    otroInput.addEventListener('input', actualizarResumenAlergias);
  }
});

// FUNCIÓN CORREGIDA: Esta es la función exacta que invoca tu botón HTML
async function abrirNuevoPacienteModal() {
    // 1. Limpiamos el formulario primero
    await resetForm(); 
    
    // 2. Consultamos la base de datos de Supabase de forma asíncrona para calcular el siguiente ID
    const { data: pacientes, error } = await supabaseClient
        .from('pacientes')
        .select('codigo');

    let siguienteCodigo = 'PAC001';
    if (!error && pacientes && pacientes.length > 0) {
        const nums = pacientes.map(p => parseInt((p.codigo || '').replace('PAC', '')) || 0);
        const maxNum = Math.max(...nums) + 1;
        siguienteCodigo = 'PAC' + String(maxNum).padStart(3, '0');
    }

    // 3. Inyectamos los textos e IDs correspondientes en tu UI nativa
    document.getElementById('pac-codigo').value = siguienteCodigo;
    document.getElementById('pac-title').textContent = 'Nuevo Paciente';
    document.getElementById('pac-codigo-edit').value = '';
    
    // 4. Abrimos tu modal estético
    openModal('modal-nuevo');
}

function onAlergiaChange(checkbox) {
    const valor = checkbox.value;

    if (valor === 'Ninguna' && checkbox.checked) {
        document.querySelectorAll('#check-alergias input[type="checkbox"]').forEach(cb => {
            if (cb.value !== 'Ninguna') cb.checked = false;
        });
        alergiasSeleccionadas = ['Ninguna'];
        document.getElementById('bloque-otro-alergia').style.display = 'none';
    } else if (checkbox.checked) {
        document.querySelectorAll('#check-alergias input[type="checkbox"]').forEach(cb => {
            if (cb.value === 'Ninguna') cb.checked = false;
        });
        if (valor === 'Otro') {
            document.getElementById('bloque-otro-alergia').style.display = 'block';
        }
        alergiasSeleccionadas = status = alergiasSeleccionadas.filter(a => a !== 'Ninguna');
        if (!alergiasSeleccionadas.includes(valor)) {
            alergiasSeleccionadas.push(valor);
        }
    } else {
        if (valor === 'Otro') {
            document.getElementById('bloque-otro-alergia').style.display = 'none';
            document.getElementById('pac-alergia-otro').value = '';
        }
        alergiasSeleccionadas = alergiasSeleccionadas.filter(a => a !== valor);
    }
    actualizarResumenAlergias();
}

function actualizarResumenAlergias() {
    let listaParaMostrar = [...alergiasSeleccionadas];
    
    if (alergiasSeleccionadas.includes('Otro')) {
        const textoOtro = document.getElementById('pac-alergia-otro').value.trim();
        listaParaMostrar = listaParaMostrar.filter(a => a !== 'Otro');
        listaParaMostrar.push(textoOtro ? `Otro: ${textoOtro}` : 'Otro (...)');
    }

    const resumenBox = document.getElementById('alergias-resumen');
    const resumenText = document.getElementById('alergias-resumen-texto');

    if (listaParaMostrar.length > 0 && !alergiasSeleccionadas.includes('Ninguna')) {
        resumenBox.style.display = 'block';
        resumenText.textContent = listaParaMostrar.join(', ');
    } else {
        resumenBox.style.display = 'none';
    }
}

function onTipoDocChange() {
    const tipo = document.getElementById('pac-tipo-doc').value;
    const docInput = document.getElementById('pac-doc');
    const hint = document.getElementById('doc-hint');

    docInput.value = '';
    clearFieldError('pac-doc');

    if (tipo === 'DNI') {
        docInput.maxLength = 8;
        hint.textContent = 'Ingrese 8 dígitos numéricos';
    } else if (tipo === 'Pasaporte') {
        docInput.maxLength = 12;
        hint.textContent = 'Máximo 12 caracteres alfanuméricos';
    } else if (tipo === 'Carnet de extranjería') {
        docInput.maxLength = 15;
        hint.textContent = 'Máximo 15 caracteres numéricos';
    } else {
        hint.textContent = 'Seleccione el tipo de documento primero';
    }
}

function onNacimientoChange() {
    const fechaStr = document.getElementById('pac-nacimiento').value;
    const display = document.getElementById('pac-edad-display');
    const bloqueApoderado = document.getElementById('bloque-apoderado');

    if (!fechaStr) {
        display.textContent = '—';
        bloqueApoderado.style.display = 'none';
        return;
    }

    const edad = calcAge(fechaStr);
    display.textContent = `${edad} años`;

    if (edad < 18) {
        bloqueApoderado.style.display = 'block';
    } else {
        bloqueApoderado.style.display = 'none';
    }
    clearFieldError('pac-nacimiento');
}

function validarFormPaciente() {
    clearAllErrors('form-paciente');
    let ok = true;

    const nombres = document.getElementById('pac-nombres').value.trim();
    const apellidos = document.getElementById('pac-apellidos').value.trim();
    const tipoDoc = document.getElementById('pac-tipo-doc').value;
    const doc = document.getElementById('pac-doc').value.trim();
    const nacimiento = document.getElementById('pac-nacimiento').value;
    const telefono = document.getElementById('pac-telefono').value.trim();
    const email = document.getElementById('pac-email').value.trim();

    if (!nombres) { showFieldError('pac-nombres', 'Los nombres son obligatorios'); ok = false; }
    if (!apellidos) { showFieldError('pac-apellidos', 'Los apellidos son obligatorios'); ok = false; }
    if (!tipoDoc) { showFieldError('pac-tipo-doc', 'Seleccione el tipo de documento'); ok = false; }

    if (!doc) {
        showFieldError('pac-doc', 'El número de documento es obligatorio'); ok = false;
    } else if (tipoDoc === 'DNI' && (!/^\d{8}$/.test(doc))) {
        showFieldError('pac-doc', 'El DNI debe tener exactamente 8 dígitos'); ok = false;
    }

    if (!nacimiento) { showFieldError('pac-nacimiento', 'La fecha de nacimiento es obligatoria'); ok = false; }

    if (!telefono) {
        showFieldError('pac-telefono', 'El teléfono es obligatorio'); ok = false;
    } else if (!/^9\d{8}$/.test(telefono)) {
        showFieldError('pac-telefono', 'Celular inválido (Debe tener 9 dígitos e iniciar con 9)'); ok = false;
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showFieldError('pac-email', 'Formato de correo inválido'); ok = false;
    }

    if (nacimiento && calcAge(nacimiento) < 18) {
        const apoderado = document.getElementById('pac-apoderado').value.trim();
        const parentesco = document.getElementById('pac-parentesco-apoderado').value;
        if (!apoderado) { showFieldError('pac-apoderado', 'Nombre del apoderado obligatorio'); ok = false; }
        if (!parentesco) { showFieldError('pac-parentesco-apoderado', 'Seleccione el parentesco'); ok = false; }
    }

    if (alergiasSeleccionadas.length === 0) {
        showFieldError('alergias', 'Seleccione al menos una opción o marque "Ninguna"'); ok = false;
    } else if (alergiasSeleccionadas.includes('Otro') && !document.getElementById('pac-alergia-otro').value.trim()) {
        showFieldError('pac-alergia-otro', 'Especifique la restricción alérgica'); ok = false;
    }

    const emergNombre = document.getElementById('pac-emerg-nombre').value.trim();
    const emergParent = document.getElementById('pac-emerg-parentesco').value;
    const emergTel = document.getElementById('pac-emerg-tel').value.trim();

    if (!emergNombre) { showFieldError('pac-emerg-nombre', 'El nombre es obligatorio'); ok = false; }
    if (!emergParent) { showFieldError('pac-emerg-parentesco', 'Seleccione el parentesco'); ok = false; }
    if (!emergTel) {
        showFieldError('pac-emerg-tel', 'El teléfono de emergencia es obligatorio'); ok = false;
    } else if (!/^9\d{8}$/.test(emergTel)) {
        showFieldError('pac-emerg-tel', 'Debe ser un número celular válido de 9 dígitos'); ok = false;
    }

    return ok;
}

async function guardarPaciente() {
    if (!validarFormPaciente()) { 
        showToast('Corrija los errores en el formulario', 'error'); 
        return; 
    }

    const editCodigo = document.getElementById('pac-codigo-edit').value;
    const nacimiento = document.getElementById('pac-nacimiento').value;
    
    let datosApoderado = null;
    const esMenor = document.getElementById('bloque-apoderado').style.display === 'block';
    if (esMenor) {
        datosApoderado = {
            nombre: document.getElementById('pac-apoderado').value.trim(),
            parentesco: document.getElementById('pac-parentesco-apoderado').value
        };
    }

    let listaAlergiasFinal = [...alergiasSeleccionadas];
    if (listaAlergiasFinal.includes('Otro')) {
        const especificarOtro = document.getElementById('pac-alergia-otro').value.trim();
        listaAlergiasFinal = listaAlergiasFinal.filter(a => a !== 'Otro');
        listaAlergiasFinal.push(`Otro: ${especificarOtro}`);
    }

    // Habilitar campo correo temporalmente antes de capturar el envío a Supabase
    document.getElementById('pac-email').disabled = false;

    const pacienteData = {
        codigo: editCodigo || document.getElementById('pac-codigo').value,
        nombres: document.getElementById('pac-nombres').value.trim(),
        apellidos: document.getElementById('pac-apellidos').value.trim(),
        tipo_documento: document.getElementById('pac-tipo-doc').value,
        documento: document.getElementById('pac-doc').value.trim(),
        fecha_nacimiento: nacimiento,
        telefono: document.getElementById('pac-telefono').value.trim(),
        correo: document.getElementById('pac-email').value.trim() || null,
        direccion: document.getElementById('pac-direccion').value.trim() || null,
        alergias: listaAlergiasFinal, 
        apoderado: datosApoderado,       
        contacto_emergencia_nombre: document.getElementById('pac-emerg-nombre').value.trim(),
        contacto_emergencia_parentesco: document.getElementById('pac-emerg-parentesco').value,
        contacto_emergencia_telefono: document.getElementById('pac-emerg-tel').value.trim()
    };

    // Volver a bloquear visualmente el input
    document.getElementById('pac-email').disabled = true;

    if (editCodigo) {
        const { error } = await supabaseClient
            .from('pacientes')
            .update(pacienteData)
            .eq('codigo', editCodigo);

        if (error) {
            showToast(`Error al actualizar: ${error.message}`, 'error');
            return;
        }
        showToast('Ficha de paciente actualizada correctamente', 'success');
    } else {
        const { error } = await supabaseClient
            .from('pacientes')
            .insert([pacienteData]);

        if (error) {
            if (error.code === '23505') { 
                showToast('Este número de documento ya está registrado', 'error');
            } else {
                showToast(`Error al registrar: ${error.message}`, 'error');
            }
            return;
        }
        showToast('Paciente registrado en el servidor clínico', 'success');
    }

    closeModal('modal-nuevo');
    await resetForm(); 
    renderTable();
    renderRecientes();
    updateStats();
}

async function renderTable() {
    const q = (document.getElementById('search-pac').value || '').toLowerCase();
    const filterAlergia = document.getElementById('filter-alergia').value;

    let { data: pacientes, error } = await supabaseClient
        .from('pacientes')
        .select('*')
        .order('fecha_creacion', { ascending: false });

    if (error) {
        showToast('Error al consultar lista de pacientes', 'error');
        return;
    }

    const tbody = document.getElementById('tbody-pac');
    const empty = document.getElementById('empty-pac');

    if (!pacientes || !pacientes.length) {
        tbody.innerHTML = '';
        empty.style.display = 'block';
        return;
    }

    // ── ADICIÓN DE CONTROL DE PRIVACIDAD: FILTRAR SI EL ROL ACTIVO ES PACIENTE ──
    const userRol = sessionStorage.getItem('medicore_user_rol');
    if (userRol === 'Paciente') {
        const { data: userData } = await supabaseClient.auth.getUser();
        const miCorreo = userData?.user?.email;
        pacientes = pacientes.filter(p => p.correo === miCorreo);
        
        // Ocultar barras de búsqueda global para los pacientes
        const searchInputBox = document.querySelector('.search-bar');
        if (searchInputBox) searchInputBox.style.display = 'none';
    }

    let filtrados = pacientes.filter(p => {
        const nombreCompleto = `${p.nombres} ${p.apellidos}`.toLowerCase();
        if (q && !nombreCompleto.includes(q) && !p.documento.includes(q) && !p.codigo.toLowerCase().includes(q)) return false;
        
        if (filterAlergia === 'si' && (!p.alergias || p.alergias.length === 0 || p.alergias[0] === 'Ninguna')) return false;
        if (filterAlergia === 'no' && p.alergias && p.alergias.length > 0 && p.alergias[0] !== 'Ninguna') return false;
        
        return true;
    });

    if (!filtrados.length) {
        tbody.innerHTML = '';
        empty.style.display = 'block';
        return;
    }
    empty.style.display = 'none';

    tbody.innerHTML = filtrados.map(p => {
        const edad = calcAge(p.fecha_nacimiento);
        const alNoNing = p.alergias && p.alergias.length && p.alergias[0] !== 'Ninguna';
        const alText = alNoNing
            ? `<span style="color:var(--red);font-size:.7rem;font-weight:600">⚠️ ${p.alergias.join(', ')}</span>`
            : `<span style="color:var(--gray-400);font-size:.72rem">Ninguna</span>`;

        // Si es el rol Paciente, limitamos sus acciones de edición/eliminación global
        const accionesHtml = userRol === 'Paciente'
            ? `<button class="btn btn-ghost btn-sm" onclick="verDetalle('${p.codigo}')" title="Ver mi ficha">👁️ Ficha</button>
               <button class="btn btn-ghost btn-sm" onclick="editarPaciente('${p.codigo}')" title="Actualizar mis datos">✏️ Editar</button>`
            : `<button class="btn btn-ghost btn-sm" onclick="verDetalle('${p.codigo}')" title="Ver ficha">👁️</button>
               <button class="btn btn-ghost btn-sm" onclick="editarPaciente('${p.codigo}')" title="Editar">✏️</button>
               <button class="btn btn-ghost btn-sm" style="color:var(--red);" onclick="eliminarPaciente('${p.codigo}')" title="Eliminar">🗑️</button>`;

        return `<tr>
            <td class="td-code">${p.codigo}</td>
            <td>
                <div style="display:flex;align-items:center;gap:.6rem">
                    <div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,var(--blue),var(--blue-light));color:white;display:flex;align-items:center;justify-content:center;font-size:.75rem;font-weight:700;flex-shrink:0">
                        ${p.nombres[0]}${p.apellidos[0]}
                    </div>
                    <div>
                        <div class="td-main">${p.nombres} ${p.apellidos}</div>
                        <div style="font-size:.68rem;color:var(--gray-400)">${p.correo || '—'}</div>
                    </div>
                </div>
            </td>
            <td>${p.tipo_documento}: <strong>${p.documento}</strong></td>
            <td>
                ${edad} año${edad !== 1 ? 's' : ''}
                ${edad < 18 ? '<span style="background:var(--orange-pale);color:#92400E;font-size:.62rem;padding:.1rem .4rem;border-radius:var(--radius-full);font-weight:600;margin-left:.25rem;">menor</span>' : ''}
            </td>
            <td>${p.telefono}</td>
            <td>${alText}</td>
            <td><div class="actions">${accionesHtml}</div></td>
        </tr>`;
    }).join('');
}

async function renderRecientes() {
    const userRol = sessionStorage.getItem('medicore_user_rol');
    const container = document.getElementById('lista-recientes');
    if (!container) return;

    // ── ADICIÓN DE CONTROL DE PRIVACIDAD: OCULTAR TARJETA DE RECIENTES AL PACIENTE ──
    if (userRol === 'Paciente') {
        const sidebarCard = container.closest('.card') || container;
        if (sidebarCard) sidebarCard.style.display = 'none';
        return;
    }

    let { data: pacientes, error } = await supabaseClient
        .from('pacientes')
        .select('*')
        .order('fecha_creacion', { ascending: false })
        .limit(4);

    if (error || !pacientes || !pacientes.length) {
        container.innerHTML = '<div style="font-size:.74rem;color:var(--gray-400);padding:1rem;">No hay registros recientes.</div>';
        return;
    }

    container.innerHTML = pacientes.map(p => `
        <div class="patient-list-item" onclick="verDetalle('${p.codigo}')" style="cursor:pointer;">
            <div class="pli-avatar">${p.nombres[0]}${p.apellidos[0]}</div>
            <div style="flex-grow:1;">
                <div class="pli-name">${p.nombres} ${p.apellidos}</div>
                <div class="pli-meta">${p.tipo_documento}: ${p.documento} · ${p.telefono}</div>
            </div>
            <div class="pli-code">${p.codigo}</div>
        </div>
    `).join('');
}

async function updateStats() {
    let { data: pacientes, error } = await supabaseClient.from('pacientes').select('*');
    if (error || !pacientes) return;

    const total = pacientes.length;
    let adultos = 0;
    let menores = 0;
    let conAlergias = 0;

    pacientes.forEach(p => {
        const edad = calcAge(p.fecha_nacimiento);
        if (edad >= 18) adultos++; else menores++;
        if (p.alergias && p.alergias.length > 0 && p.alergias[0] !== 'Ninguna') conAlergias++;
    });

    document.getElementById('st-total').textContent = total;
    document.getElementById('st-adultos').textContent = adultos;
    document.getElementById('st-menores').textContent = menores;
    document.getElementById('st-alergias').textContent = conAlergias;
}

async function verDetalle(codigo) {
    let { data: p, error } = await supabaseClient
        .from('pacientes')
        .select('*')
        .eq('codigo', codigo)
        .single();

    if (error || !p) {
        showToast('No se pudo encontrar la ficha del paciente', 'error');
        return;
    }

    const edad = calcAge(p.fecha_nacimiento);
    let apoderadoHtml = '';
    if (p.apoderado) {
        apoderadoHtml = `
            <div style="grid-column: span 2; background: var(--gray-50); padding: .75rem; border-radius: var(--radius); margin-top: .5rem; border: 1px solid var(--gray-200);">
                <strong style="font-size:.65rem; color:var(--gray-500); text-transform:uppercase; display:block; margin-bottom:.25rem">Apoderado Legal (Menor de edad)</strong>
                <div style="font-size:.82rem; color:var(--gray-900)">${p.apoderado.nombre} (${p.apoderado.parentesco})</div>
            </div>`;
    }

    document.getElementById('det-titulo').textContent = `${p.nombres} ${p.apellidos}`;
    document.getElementById('det-codigo').textContent = `Ficha clínica: ${p.codigo}`;

    document.getElementById('det-contenido').innerHTML = `
        <div class="detail-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: .75rem; font-size: .82rem;">
            <div class="detail-item"><label style="display:block; font-size:.68rem; color:var(--gray-400);">Documento de Identidad</label><span>${p.tipo_documento} ${p.documento}</span></div>
            <div class="detail-item"><label style="display:block; font-size:.68rem; color:var(--gray-400);">Edad / Nacimiento</label><span>${edad} años (${p.fecha_nacimiento})</span></div>
            <div class="detail-item"><label style="display:block; font-size:.68rem; color:var(--gray-400);">Teléfono Celular</label><span>${p.telefono}</span></div>
            <div class="detail-item"><label style="display:block; font-size:.68rem; color:var(--gray-400);">Correo Electrónico</label><span>${p.correo || '—'}</span></div>
            <div class="detail-item" style="grid-column: span 2;"><label style="display:block; font-size:.68rem; color:var(--gray-400);">Dirección Residencia</label><span>${p.direccion || '—'}</span></div>
            <div class="detail-item" style="grid-column: span 2;"><label style="display:block; font-size:.68rem; color:var(--gray-400);">Alergias Clínicas</label><span style="color: ${p.alergias[0] !== 'Ninguna' ? 'var(--red)' : 'var(--gray-900)'}; font-weight:600">${p.alergias.join(', ')}</span></div>
            
            <div style="grid-column: span 2; margin-top: .5rem; border-top: 1px dashed var(--gray-200); padding-top: .75rem;">
                <strong style="font-size:.65rem; color:var(--gray-500); text-transform:uppercase; display:block; margin-bottom:.4rem">Contacto en Caso de Emergencia</strong>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap: .4rem">
                    <div class="detail-item"><label style="display:block; font-size:.68rem; color:var(--gray-400);">Nombre Completo</label><span>${p.contacto_emergencia_nombre}</span></div>
                    <div class="detail-item"><label style="display:block; font-size:.68rem; color:var(--gray-400);">Parentesco / Teléfono</label><span>${p.contacto_emergencia_parentesco} — ${p.contacto_emergencia_telefono}</span></div>
                </div>
            </div>
            ${apoderadoHtml}
        </div>`;

    document.getElementById('det-btn-editar').onclick = () => {
        closeModal('modal-detail');
        editarPaciente(p.codigo);
    };

    openModal('modal-detalle');
}

async function editarPaciente(codigo) {
    let { data: p, error } = await supabaseClient
        .from('pacientes')
        .select('*')
        .eq('codigo', codigo)
        .single();

    if (error || !p) {
        showToast('Error al descargar datos del paciente', 'error');
        return;
    }

    await resetForm();

    document.getElementById('pac-title').textContent = 'Editar Paciente';
    document.getElementById('pac-codigo-edit').value = p.codigo;
    document.getElementById('pac-codigo').value = p.codigo;
    document.getElementById('pac-nombres').value = p.nombres;
    document.getElementById('pac-apellidos').value = p.apellidos;
    document.getElementById('pac-tipo-doc').value = p.tipo_documento;
    onTipoDocChange();
    document.getElementById('pac-doc').value = p.documento;
    document.getElementById('pac-nacimiento').value = p.fecha_nacimiento;
    onNacimientoChange();
    document.getElementById('pac-telefono').value = p.telefono;
    document.getElementById('pac-email').value = p.correo || '';
    document.getElementById('pac-direccion').value = p.direccion || '';

    if (p.apoderado) {
        document.getElementById('pac-apoderado').value = p.apoderado.nombre || '';
        document.getElementById('pac-parentesco-apoderado').value = p.apoderado.parentesco || '';
    }

    alergiasSeleccionadas = [];
    document.querySelectorAll('#check-alergias input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
    });

    p.alergias.forEach(a => {
        if (a.startsWith('Otro:')) {
            const cbOtro = document.querySelector('#check-alergias input[value="Otro"]');
            if (cbOtro) cbOtro.checked = true;
            alergiasSeleccionadas.push('Otro');
            document.getElementById('bloque-otro-alergia').style.display = 'block';
            document.getElementById('pac-alergia-otro').value = a.replace('Otro: ', '').trim();
        } else {
            const cb = document.querySelector(`#check-alergias input[value="${a}"]`);
            if (cb) cb.checked = true;
            alergiasSeleccionadas.push(a);
        }
    });

    actualizarResumenAlergias();
    openModal('modal-nuevo');
}

async function eliminarPaciente(codigo) {
    const confirmacion = confirm(`¿Está seguro de eliminar permanentemente al paciente ${codigo}?`);
    if (!confirmacion) return;

    const { error } = await supabaseClient
        .from('pacientes')
        .delete()
        .eq('codigo', codigo);

    if (error) {
        if (error.code === '23503') { 
            showToast('No se puede eliminar: el paciente tiene citas activas enlazadas.', 'error');
        } else {
            showToast(`Error: ${error.message}`, 'error');
        }
        return;
    }

    showToast('Paciente removido correctamente', 'warn');
    renderTable();
    renderRecientes();
    updateStats();
}

async function resetForm() {
    document.getElementById('form-paciente').reset();
    document.getElementById('pac-codigo-edit').value = '';
    document.getElementById('pac-edad-display').textContent = '—';
    document.getElementById('bloque-apoderado').style.display = 'none';
    document.getElementById('bloque-otro-alergia').style.display = 'none';
    document.getElementById('alergias-resumen').style.display = 'none';
    document.getElementById('doc-hint').textContent = 'Seleccione el tipo de documento primero';
    alergiasSeleccionadas = [];
    clearAllErrors('form-paciente');

    // ADICIÓN DE SEGURIDAD EXCLUSIVA: Sincronizar el correo en sesión de forma automática
    const userRol = sessionStorage.getItem('medicore_user_rol');
    if (userRol === 'Paciente') {
        const { data: { user } } = await supabaseClient.auth.getUser();
        const emailInput = document.getElementById('pac-email');
        if (user && emailInput) {
            emailInput.value = user.email;
            emailInput.disabled = true; 
        }
    } else {
        const emailInput = document.getElementById('pac-email');
        if (emailInput) emailInput.disabled = false;
    }
}