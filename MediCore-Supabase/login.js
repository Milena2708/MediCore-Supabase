// ══════════════════════════════════════════
//  login.js — Lógica de Autenticación y Perfiles
//  Conectado a Supabase Auth y Database (supabaseClient)
// ══════════════════════════════════════════

function switchTab(tab) {
  clearAllErrors('form-login');
  clearAllErrors('form-register');
  if (tab === 'login') {
    document.getElementById('tab-login').classList.add('active');
    document.getElementById('tab-register').classList.remove('active');
    document.getElementById('form-login').style.display = 'block';
    document.getElementById('form-register').style.display = 'none';
  } else {
    document.getElementById('tab-login').classList.remove('active');
    document.getElementById('tab-register').classList.add('active');
    document.getElementById('form-login').style.display = 'none';
    document.getElementById('form-register').style.display = 'block';
  }
}

async function ejecutarLogin() {
  clearAllErrors('form-login');
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-password').value;
  let ok = true;

  if (!email) { showFieldError('login-email', 'El correo es obligatorio'); ok = false; }
  if (!pass) { showFieldError('login-password', 'La contraseña es obligatoria'); ok = false; }

  if (!ok) return;

  // Autenticación con Supabase Auth usando el cliente unificado
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email: email, password: pass });

  if (error) {
    showToast('Credenciales incorrectas o inválidas', 'error');
    return;
  }

  // Descargar el perfil del usuario utilizando 'supabaseClient' de shared.js
  const { data: perfil, error: errPerfil } = await supabaseClient
    .from('usuarios_perfil')
    .select('rol, nombre')
    .eq('user_id', data.user.id)
    .single();

  if (errPerfil || !perfil) {
    showToast('Error al obtener el rol del usuario', 'error');
    return;
  }

  // Guardar datos básicos de sesión activa de forma segura
  sessionStorage.setItem('medicore_user_rol', perfil.rol);
  sessionStorage.setItem('medicore_user_name', perfil.nombre);

  showToast(`¡Bienvenido, ${perfil.nombre}!`, 'success');
  setTimeout(() => { window.location.href = 'index.html'; }, 1000);
}

async function ejecutarRegistro() {
  clearAllErrors('form-register');
  const nombre = document.getElementById('reg-nombre').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const pass = document.getElementById('reg-password').value;
  const passConf = document.getElementById('reg-password-conf').value;
  const rol = document.getElementById('reg-rol').value;
  let ok = true;

  if (!nombre) { showFieldError('reg-nombre', 'El nombre es obligatorio'); ok = false; }
  if (!email) { showFieldError('reg-email', 'El correo es obligatorio'); ok = false; }
  if (!pass || pass.length < 6) { showFieldError('reg-password', 'Mínimo 6 caracteres'); ok = false; }
  if (pass !== passConf) { showFieldError('reg-password-conf', 'Las contraseñas no coinciden'); ok = false; }
  if (!rol) { showFieldError('reg-rol', 'El rol es obligatorio'); ok = false; }

  if (!ok) return;

  // 1. Crear el usuario en Supabase Auth
  const { data, error } = await supabaseClient.auth.signUp({ email: email, password: pass });

  if (error) {
    showToast(error.message, 'error');
    return;
  }

  if (data?.user) {
    // 2. Inyectar el registro de rol en la tabla usuarios_perfil utilizando 'supabaseClient'
    const { error: errPerfil } = await supabaseClient
      .from('usuarios_perfil')
      .insert([{ user_id: data.user.id, nombre: nombre, correo: email, rol: rol }]);

    if (errPerfil) {
      showToast('Error al registrar las propiedades del rol', 'error');
      return;
    }

    showToast('Registro exitoso. Ya puedes iniciar sesión.', 'success');
    setTimeout(() => { switchTab('login'); document.getElementById('form-register').reset(); }, 1500);
  }
}