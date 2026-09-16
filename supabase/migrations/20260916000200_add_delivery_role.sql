-- Adds the driver role and permits drivers to see and complete ready orders.
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'entregador';

CREATE OR REPLACE FUNCTION public.sync_profile_roles()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  valid_roles TEXT[] := ARRAY['admin', 'caixa', 'cozinha', 'atendente', 'entregador', 'cliente'];
  cleaned TEXT[];
BEGIN
  IF TG_OP = 'INSERT' AND NOT (NEW.role::text = ANY(COALESCE(NEW.roles, ARRAY[]::TEXT[]))) THEN
    NEW.roles := ARRAY[NEW.role::text] || COALESCE(NEW.roles, ARRAY[]::TEXT[]);
  END IF;
  IF NEW.roles IS NULL OR cardinality(NEW.roles) = 0 THEN
    NEW.roles := ARRAY[NEW.role::text];
  END IF;
  SELECT COALESCE(array_agg(r ORDER BY array_position(valid_roles, r)), ARRAY[]::TEXT[])
    INTO cleaned
    FROM (SELECT DISTINCT r FROM unnest(NEW.roles) AS r WHERE r = ANY(valid_roles)) AS allowed;
  NEW.roles := cleaned;
  IF cardinality(cleaned) > 0 THEN NEW.role := cleaned[1]::public.user_role; END IF;
  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "Orders can be viewed by staff" ON public.orders;
CREATE POLICY "Orders can be viewed by staff" ON public.orders FOR SELECT USING (
  public.has_any_role(ARRAY['atendente', 'entregador', 'cliente', 'admin'])
);

DROP POLICY IF EXISTS "Orders can be updated by cashier" ON public.orders;
CREATE POLICY "Orders can be updated by cashier" ON public.orders FOR UPDATE USING (
  public.has_any_role(ARRAY['caixa', 'entregador', 'admin'])
) WITH CHECK (
  public.has_any_role(ARRAY['caixa', 'entregador', 'admin'])
);
