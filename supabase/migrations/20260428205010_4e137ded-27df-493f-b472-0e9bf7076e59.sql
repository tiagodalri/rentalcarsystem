-- Adicionar user_id em customers
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON public.customers(user_id);
CREATE INDEX IF NOT EXISTS idx_customers_email ON public.customers(email);

-- Remover policies inseguras
DROP POLICY IF EXISTS "Anyone can update customer by id" ON public.customers;
DROP POLICY IF EXISTS "Anyone can register as customer" ON public.customers;

-- Insert: somente authenticated vinculando próprio user_id
CREATE POLICY "Authenticated can insert own customer" ON public.customers
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Select próprio
CREATE POLICY "Users can view own customer record" ON public.customers
  FOR SELECT USING (auth.uid() = user_id);

-- Update próprio
CREATE POLICY "Users can update own customer record" ON public.customers
  FOR UPDATE USING (auth.uid() = user_id);

-- Trigger: vincular customers órfãos por email no signup
CREATE OR REPLACE FUNCTION public.link_existing_customer_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.customers
  SET user_id = NEW.id
  WHERE email = NEW.email
    AND user_id IS NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS link_existing_customer_trigger ON auth.users;
CREATE TRIGGER link_existing_customer_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.link_existing_customer_on_signup();