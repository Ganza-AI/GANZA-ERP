-- Add product expiry date support.
-- Run this on existing Supabase databases so product expiry reminders
-- can persist across local, deployed, and reloaded sessions.

ALTER TABLE IF EXISTS public.products ADD COLUMN IF NOT EXISTS expiry_date DATE;

CREATE INDEX IF NOT EXISTS idx_products_expiry_date ON public.products(expiry_date);
