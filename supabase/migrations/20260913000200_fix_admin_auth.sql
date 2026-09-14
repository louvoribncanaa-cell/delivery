-- Completa a identidade de email criada pelo seed inicial.
DO $$
DECLARE
  admin_id UUID;
BEGIN
  SELECT id INTO admin_id
  FROM auth.users
  WHERE lower(email) = 'jakbitencourtcachos@gmail.com'
  LIMIT 1;

  IF admin_id IS NULL THEN
    RAISE EXCEPTION 'Usuário administrador não encontrado';
  END IF;

  UPDATE auth.users
  SET email = 'jakbitencourtcachos@gmail.com',
      encrypted_password = extensions.crypt('jak088910', extensions.gen_salt('bf')),
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      aud = 'authenticated',
      role = 'authenticated',
      updated_at = now()
  WHERE id = admin_id;

  INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    admin_id,
    'jakbitencourtcachos@gmail.com',
    jsonb_build_object('sub', admin_id::text, 'email', 'jakbitencourtcachos@gmail.com'),
    'email',
    now(),
    now()
  )
  ON CONFLICT (provider, provider_id) DO UPDATE
  SET user_id = EXCLUDED.user_id,
      identity_data = EXCLUDED.identity_data,
      updated_at = now();

  UPDATE public.profiles
  SET name = 'Jak', role = 'admin'
  WHERE id = admin_id;
END $$;
