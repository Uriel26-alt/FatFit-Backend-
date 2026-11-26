-- =====================================================================
-- FatFit · Cuentas de prueba. SOLO para desarrollo y demostraciones:
-- las contraseñas son públicas. No lo ejecutes en un entorno real.
-- =====================================================================

-- ---------- Cuentas de prueba (solo para desarrollo) ----------
--   admin@fatfit.mx / Admin1234      (administrador)
--   ana@fatfit.mx   / Ana12345       (usuaria de ejemplo del front)
INSERT INTO auth.usuarios (id, nombre, correo, contrasena_hash, rol) VALUES
('00000000-0000-4000-8000-000000000001', 'Administrador FatFit', 'admin@fatfit.mx', crypt('Admin1234', gen_salt('bf', 10)), 'admin'),
('00000000-0000-4000-8000-000000000002', 'Ana Rodríguez',        'ana@fatfit.mx',   crypt('Ana12345',  gen_salt('bf', 10)), 'usuario');

INSERT INTO auth.consentimientos (usuario_id, tipo, version) VALUES
('00000000-0000-4000-8000-000000000002', 'terminos',    '2026-11'),
('00000000-0000-4000-8000-000000000002', 'datos_salud', '2026-11');

INSERT INTO salud.perfiles_salud (usuario_id, edad, sexo, altura_cm, peso_inicial_kg, nivel_actividad, objetivo, lugar, minutos, alimentos) VALUES
('00000000-0000-4000-8000-000000000002', 34, 'mujer', 165, 82, 'ligero', 'bajar', 'casa', 30, ARRAY['Tortillas', 'Refresco', 'Pollo', 'Frijoles']);
INSERT INTO salud.condiciones_salud VALUES ('00000000-0000-4000-8000-000000000002', 'rodilla');

INSERT INTO salud.mediciones (usuario_id, fecha, peso_kg)
SELECT '00000000-0000-4000-8000-000000000002', current_date - (7 * (8 - n))::int, kg
FROM unnest(ARRAY[82.0, 81.6, 81.3, 80.9, 80.6, 80.2, 79.9, 79.6]) WITH ORDINALITY AS t (kg, n);

INSERT INTO fati.suscripciones (usuario_id, plan_id) VALUES ('00000000-0000-4000-8000-000000000002', 'basico');
