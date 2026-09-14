-- Remove o usuário criado manualmente e permite recriação pelo Auth oficial.
DELETE FROM auth.users
WHERE lower(email) = 'jakbitencourtcachos@gmail.com';
