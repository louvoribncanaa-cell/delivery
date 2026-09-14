UPDATE auth.users
SET instance_id = '00000000-0000-0000-0000-000000000000',
    aud = 'authenticated',
    role = 'authenticated',
    email = lower(email),
    encrypted_password = extensions.crypt('jak088910', extensions.gen_salt('bf')),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    confirmation_token = COALESCE(confirmation_token, ''),
    recovery_token = COALESCE(recovery_token, ''),
    email_change_token_current = COALESCE(email_change_token_current, ''),
    email_change_token_new = COALESCE(email_change_token_new, ''),
    updated_at = now()
WHERE lower(email) = 'jakbitencourtcachos@gmail.com';
