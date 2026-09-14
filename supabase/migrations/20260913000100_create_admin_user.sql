-- Cria o usuário administrador inicial sem expor a senha no frontend.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DO $$
DECLARE
  admin_id UUID;
BEGIN
  SELECT id INTO admin_id
  FROM auth.users
  WHERE email = 'jakbitencourtcachos@gmail.com'
  LIMIT 1;

  IF admin_id IS NULL THEN
    admin_id := gen_random_uuid();

    INSERT INTO auth.users (
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    ) VALUES (
      admin_id,
      'authenticated',
      'authenticated',
      'jakbitencourtcachos@gmail.com',
      extensions.crypt('jak088910', extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"name":"Jak","role":"admin"}'::jsonb,
      now(),
      now()
    );
  ELSE
    UPDATE auth.users
    SET encrypted_password = extensions.crypt('jak088910', extensions.gen_salt('bf')),
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"name":"Jak","role":"admin"}'::jsonb,
        updated_at = now()
    WHERE id = admin_id;
  END IF;

  INSERT INTO public.profiles (id, name, role)
  VALUES (admin_id, 'Jak', 'admin')
  ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name,
      role = 'admin';
END $$;
