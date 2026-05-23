-- Persist order payment receipts and actual collected amounts.
-- Run this once on existing Supabase projects that were created before these fields existed.

ALTER TABLE IF EXISTS public.orders
    ADD COLUMN IF NOT EXISTS paid_amount NUMERIC DEFAULT 0;

ALTER TABLE IF EXISTS public.orders
    ADD COLUMN IF NOT EXISTS remaining_balance NUMERIC DEFAULT 0;

ALTER TABLE IF EXISTS public.orders
    ADD COLUMN IF NOT EXISTS payment_history JSONB DEFAULT '[]'::jsonb;

