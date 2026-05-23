-- Persist operating expenses such as salary, warehouse rent, marketing, and other expandable cost types.
-- Run this once on existing Supabase projects.

CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    category TEXT NOT NULL DEFAULT 'Khác',
    amount NUMERIC NOT NULL DEFAULT 0,
    payment_method TEXT DEFAULT 'Tiền mặt',
    payee TEXT,
    notes TEXT,
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'expenses' AND policyname = 'Authenticated users can read expenses'
    ) THEN
        CREATE POLICY "Authenticated users can read expenses"
            ON public.expenses FOR SELECT
            TO authenticated
            USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'expenses' AND policyname = 'Authenticated users can insert expenses'
    ) THEN
        CREATE POLICY "Authenticated users can insert expenses"
            ON public.expenses FOR INSERT
            TO authenticated
            WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'expenses' AND policyname = 'Authenticated users can update expenses'
    ) THEN
        CREATE POLICY "Authenticated users can update expenses"
            ON public.expenses FOR UPDATE
            TO authenticated
            USING (true)
            WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'expenses' AND policyname = 'Authenticated users can delete expenses'
    ) THEN
        CREATE POLICY "Authenticated users can delete expenses"
            ON public.expenses FOR DELETE
            TO authenticated
            USING (true);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_expenses_code ON public.expenses(code);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses(category);

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER on_expenses_updated
    BEFORE UPDATE ON public.expenses
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
