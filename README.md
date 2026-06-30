# 🏥 MediCore — Sistema de Gestión Clínica Integral

MediCore es una plataforma web modular diseñada para optimizar el flujo operativo de una clínica médica. Permite gestionar de extremo a extremo la experiencia del paciente, la agenda de citas del personal administrativo, la atención en salas de espera y el registro de expedientes clínicos. El sistema destaca por una persistencia real y segura en la nube, control estricto de roles y dashboards analíticos en tiempo real.

## 👥 Integrantes y División de Responsabilidades
* **Milena (Desarrolladora Principal):** Responsable absoluta del diseño de la interfaz de usuario (HTML5/CSS3), programación de la lógica asíncrona de negocio (JavaScript Vanilla), estructuración del modelo relacional de la base de datos SQL, implementación de seguridad y autenticación (Supabase Auth/RLS) y desarrollo de los algoritmos de analítica y dashboards.

---

## 🚀 Caso Elegido y Descripción del Sistema
Se seleccionó el **Sistema de Gestión de Clínica** para mitigar los problemas clásicos de solapamiento de horarios, falta de visibilidad en el flujo de pacientes presentes y el aislamiento de las encuestas de satisfacción. 

MediCore unifica la gestión mediante una arquitectura basada en eventos que reacciona instantáneamente a los cambios de estado de las citas en Supabase.

---

## 🛠️ Tecnologías Usadas
* **Frontend:** HTML5, CSS3 Moderno (Variables nativas, Flexbox, Grid) y JavaScript Vanilla (ES6+) sin frameworks externos.
* **Backend como Servicio (BaaS):** Supabase (Auth, PostgreSQL Relacional, Row-Level Security).
* **Librerías Externas:** Cliente oficial de Supabase (`@supabase/supabase-js`).
* **Control de Versiones:** Git y GitHub.

---

## 📦 Módulos Desarrollados
1. **Módulo 00 — Inicio / Dashboard General:** Panel centralizado con KPIs dinámicos (Pacientes Totales, Citas de Hoy, Pacientes en Espera) jala data directa desde la nube.
2. **Módulo 01 — Registro de Pacientes:** Ficha demográfica completa con validaciones estrictas y control de arrays nativos para alertas de alergias en tiempo real.
3. **Módulo 02 — Programación de Citas:** Gestión de agendas médicas con algoritmos avanzados para evitar el cruce de horarios del médico o del paciente el mismo día.
4. **Módulo 03 — Sala de Espera Virtual:** Monitoreo del flujo de pacientes ordenados automáticamente por prioridad clínica (Urgente, Preferencial, Normal) y hora de llegada.
5. **Módulo 04 — Historial de Consultas:** Expediente médico seguro que registra síntomas, diagnósticos, tratamientos y recetas dinámicas en formato JSONB.
6. **Módulo 05 — Reportes y Analítica:** Panel ejecutivo para el Administrador con gráficos circulares SVG dinámicos y métricas de calidad de servicio filtradas por rangos de fecha.
7. **Módulo Plus — Experiencia del Paciente:** Interfaz interactiva de encuestas de satisfacción con inputs de estrellas para evaluar la atención.

---

## 🔑 Roles Implementados y Credenciales de Prueba
El sistema cuenta con protección de rutas estricta a través de `shared.js`. Si un usuario intenta escribir una URL manualmente para un módulo no permitido, el sistema lo redirige de inmediato a su área correspondiente:

* **Administrador:** Acceso completo a todos los módulos, incluyendo la visualización de Analítica y Reportes.
  * *Usuario:* `admin@medicore.com` / *Contraseña:* `admin123`
* **Recepción:** Encargado del alta de pacientes y programación/confirmación de citas médicas. No ve reportes ni historiales.
  * *Usuario:* `recepcion@medicore.com` / *Contraseña:* `recepcion123`
* **Médico / Enfermería:** Visualizan únicamente la Sala de Espera y el Historial Clínico para registrar atenciones.
  * *Usuario Médico:* `medico@medicore.com` / *Contraseña:* `medico123`
  * *Usuario Enfermería:* `enfermeria@medicore.com` / *Contraseña:* `enfermera123`
* **Paciente:** Visualiza sus propias citas de forma aislada y accede al módulo de Evaluaciones.
  * *Usuario:* `paciente@medicore.com` / *Contraseña:* `paciente123`

---

## 🗄️ Estructura de Tablas SQL (Supabase)
El modelo relacional fue creado bajo un esquema limpio y optimizado mediante las siguientes tablas:

```sql
-- 1. Control de Roles de la Clínica
CREATE TABLE public.usuarios_perfil (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE,
    nombre TEXT NOT NULL,
    correo TEXT NOT NULL,
    rol TEXT NOT NULL CHECK (rol IN ('Administrador', 'Recepción', 'Médico', 'Enfermería', 'Paciente')),
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Ficha Demográfica del Paciente
CREATE TABLE public.pacientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo TEXT UNIQUE NOT NULL,
    nombres TEXT NOT NULL,
    apellidos TEXT NOT NULL,
    tipo_documento TEXT NOT NULL,
    documento TEXT UNIQUE NOT NULL,
    fecha_nacimiento DATE NOT NULL,
    telefono TEXT NOT NULL,
    correo TEXT,
    direccion TEXT,
    alergias TEXT[] DEFAULT '{}'::TEXT[],
    apoderado JSONB,
    contacto_emergencia_nombre TEXT NOT NULL,
    contacto_emergencia_parentesco TEXT NOT NULL,
    contacto_emergencia_telefono TEXT NOT NULL,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Programación de Citas Médicas
CREATE TABLE public.citas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo TEXT UNIQUE NOT NULL,
    paciente_id TEXT REFERENCES public.pacientes(codigo) ON DELETE RESTRICT,
    especialidad TEXT NOT NULL,
    medico TEXT NOT NULL,
    fecha DATE NOT NULL,
    hora TEXT NOT NULL,
    motivo TEXT NOT NULL,
    prioridad TEXT NOT NULL CHECK (prioridad IN ('Normal', 'Preferencial', 'Urgente')),
    justificacion_prioridad TEXT,
    estado TEXT NOT NULL DEFAULT 'Programada' CHECK (estado IN ('Programada', 'Confirmada', 'En espera', 'En atención', 'Atendida', 'Cancelada', 'No asistió')),
    motivo_cancelacion TEXT,
    hora_llegada TEXT,
    hora_inicio_atencion TEXT,
    hora_fin TEXT,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_medico_agenda UNIQUE (medico, fecha, hora)
);

-- 4. Sala de Espera en Tiempo Real
CREATE TABLE public.sala_espera (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cita_id TEXT REFERENCES public.citas(codigo) ON DELETE CASCADE,
    hora_llegada TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'En espera',
    orden_prioridad INT DEFAULT 2
);

-- 5. Expediente Médico / Historial Clínico
CREATE TABLE public.historial_consultas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo TEXT UNIQUE NOT NULL,
    paciente_id TEXT REFERENCES public.pacientes(codigo) ON DELETE RESTRICT,
    cita_id TEXT UNIQUE REFERENCES public.citas(codigo) ON DELETE RESTRICT,
    medico TEXT NOT NULL,
    especialidad TEXT NOT NULL,
    fecha_atencion DATE NOT NULL,
    sintomas TEXT NOT NULL,
    diagnostico TEXT NOT NULL,
    tratamiento TEXT NOT NULL,
    medicamentos JSONB DEFAULT '[]'::JSONB,
    observaciones TEXT,
    proxima_cita DATE,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Encuestas de Calidad y Satisfacción
CREATE TABLE public.evaluaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cita_id TEXT UNIQUE REFERENCES public.citas(codigo) ON DELETE CASCADE,
    paciente_id TEXT REFERENCES public.pacientes(codigo) ON DELETE CASCADE,
    puntuacion_medico INT CHECK (puntuacion_medico BETWEEN 1 AND 5),
    puntuacion_recepcion INT CHECK (puntuacion_recepcion BETWEEN 1 AND 5),
    puntuacion_enfermeria INT CHECK (puntuacion_enfermeria BETWEEN 1 AND 5),
    comentarios TEXT,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);