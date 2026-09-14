CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  requested_role TEXT;
BEGIN
  requested_role := NEW.raw_user_meta_data->>'role';

  INSERT INTO public.profiles (id, name, role)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'name', ''), NEW.email),
    CASE
      WHEN requested_role IN ('admin', 'caixa', 'cozinha', 'atendente', 'cliente')
        THEN requested_role::public.user_role
      ELSE 'cliente'::public.user_role
    END
  )
  ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
