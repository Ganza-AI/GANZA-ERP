-- Add rollback metadata to purchase items.
-- Run this on existing Supabase databases so deleting a purchase can restore
-- product stock/cost fields and remove purchase-created products after reload.

ALTER TABLE IF EXISTS public.purchase_items ADD COLUMN IF NOT EXISTS product_code TEXT;
ALTER TABLE IF EXISTS public.purchase_items ADD COLUMN IF NOT EXISTS created_product BOOLEAN DEFAULT false;
ALTER TABLE IF EXISTS public.purchase_items ADD COLUMN IF NOT EXISTS previous_stock INTEGER;
ALTER TABLE IF EXISTS public.purchase_items ADD COLUMN IF NOT EXISTS previous_import_price NUMERIC;
ALTER TABLE IF EXISTS public.purchase_items ADD COLUMN IF NOT EXISTS previous_supplier TEXT;
ALTER TABLE IF EXISTS public.purchase_items ADD COLUMN IF NOT EXISTS previous_purchased_qty INTEGER;

