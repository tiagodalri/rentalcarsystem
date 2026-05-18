
-- financial_categories
CREATE TABLE public.financial_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('income','expense')),
  description text NULL,
  color text NULL,
  icon text NULL,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(name, type)
);

-- financial_accounts
CREATE TABLE public.financial_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  type text NOT NULL CHECK (type IN ('bank','card','cash','wallet')),
  initial_balance numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL
);

-- financial_transactions
CREATE TABLE public.financial_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('income','expense')),
  amount numeric NOT NULL CHECK (amount > 0),
  description text NOT NULL,
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  category_id uuid NULL REFERENCES public.financial_categories(id) ON DELETE SET NULL,
  account_id uuid NULL REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
  vehicle_id uuid NULL REFERENCES public.vehicles(id) ON DELETE SET NULL,
  booking_id uuid NULL REFERENCES public.bookings(id) ON DELETE SET NULL,
  notes text NULL,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','booking_auto','expense_auto')),
  is_cancelled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_ft_transaction_date ON public.financial_transactions(transaction_date);
CREATE INDEX idx_ft_category_id ON public.financial_transactions(category_id);
CREATE INDEX idx_ft_account_id ON public.financial_transactions(account_id);
CREATE INDEX idx_ft_vehicle_id ON public.financial_transactions(vehicle_id);
CREATE INDEX idx_ft_booking_id ON public.financial_transactions(booking_id);
CREATE INDEX idx_ft_type ON public.financial_transactions(type);
CREATE INDEX idx_ft_is_cancelled ON public.financial_transactions(is_cancelled);

-- RLS
ALTER TABLE public.financial_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance can manage categories" ON public.financial_categories
  FOR ALL USING (has_any_role(auth.uid(), ARRAY['admin'::app_role,'finance'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role,'finance'::app_role]));

CREATE POLICY "Finance can manage accounts" ON public.financial_accounts
  FOR ALL USING (has_any_role(auth.uid(), ARRAY['admin'::app_role,'finance'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role,'finance'::app_role]));

CREATE POLICY "Finance can manage transactions" ON public.financial_transactions
  FOR ALL USING (has_any_role(auth.uid(), ARRAY['admin'::app_role,'finance'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role,'finance'::app_role]));

-- Seeds: income categories
INSERT INTO public.financial_categories (name, type, icon, color, sort_order) VALUES
  ('Reservas', 'income', 'Calendar', '#10b981', 1),
  ('Indicações', 'income', 'Users', '#3b82f6', 2),
  ('Serviços Extras', 'income', 'Plus', '#8b5cf6', 3),
  ('Vendas Avulsas', 'income', 'ShoppingCart', '#f59e0b', 4),
  ('Outros', 'income', 'CircleDollarSign', '#6b7280', 5);

-- Seeds: expense categories
INSERT INTO public.financial_categories (name, type, icon, color, sort_order) VALUES
  ('Manutenção', 'expense', 'Wrench', '#ef4444', 1),
  ('Combustível', 'expense', 'Fuel', '#f97316', 2),
  ('Seguros', 'expense', 'Shield', '#3b82f6', 3),
  ('Multas', 'expense', 'AlertTriangle', '#dc2626', 4),
  ('Documentação', 'expense', 'FileText', '#6366f1', 5),
  ('Peças', 'expense', 'Cog', '#71717a', 6),
  ('Limpeza', 'expense', 'Sparkles', '#06b6d4', 7),
  ('Salários', 'expense', 'UsersRound', '#a855f7', 8),
  ('Marketing', 'expense', 'Megaphone', '#ec4899', 9),
  ('Outros', 'expense', 'MoreHorizontal', '#6b7280', 10);

-- Seeds: accounts
INSERT INTO public.financial_accounts (name, type, initial_balance, currency) VALUES
  ('Caixa', 'cash', 0, 'USD'),
  ('Conta Corrente', 'bank', 0, 'USD'),
  ('Cartão de Crédito', 'card', 0, 'USD');
