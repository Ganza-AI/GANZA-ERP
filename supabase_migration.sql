-- ============================================================
-- SUPABASE MIGRATION SCRIPT - ERP SHOP BÁN HÀNG
-- Chạy script này trong Supabase SQL Editor:
-- Dashboard → SQL Editor → New Query → Paste → Run
-- ============================================================

-- 1. BẢNG KHÁCH HÀNG (customers)
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'ca-nhan' CHECK (type IN ('ca-nhan', 'doanh-nghiep')),
    phone TEXT,
    address TEXT,
    province TEXT,
    district TEXT,
    ward TEXT,
    company_name TEXT,
    department TEXT,
    tax_code TEXT,
    debt NUMERIC DEFAULT 0,
    notes TEXT,
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. BẢNG NHÀ CUNG CẤP (suppliers)
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    products_desc TEXT,
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. BẢNG DANH MỤC (categories)
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. BẢNG SẢN PHẨM (products)
CREATE TABLE IF NOT EXISTS public.products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category TEXT,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    price NUMERIC NOT NULL DEFAULT 0,
    import_price NUMERIC DEFAULT 0,
    stock INTEGER DEFAULT 0,
    min_stock INTEGER DEFAULT 5,
    supplier_code TEXT,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    sold_qty INTEGER DEFAULT 0,
    purchased_qty INTEGER DEFAULT 0,
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. BẢNG ĐƠN HÀNG (orders)
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_name TEXT,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    time TEXT,
    total NUMERIC DEFAULT 0,
    expense NUMERIC DEFAULT 0,
    shipping_fee NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'Mới' CHECK (status IN ('Mới', 'Đang xử lý', 'Đã giao', 'Hoàn thành', 'Hủy')),
    payment_method TEXT DEFAULT 'Tiền mặt',
    payment_status TEXT DEFAULT 'Chưa thanh toán' CHECK (payment_status IN ('Chưa thanh toán', 'Đã thanh toán', 'Công nợ')),
    discount NUMERIC DEFAULT 0,
    discount_type TEXT DEFAULT 'percent',
    notes TEXT,
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. BẢNG CHI TIẾT ĐƠN HÀNG (order_items)
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    product_code TEXT,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    delivered_qty INTEGER NOT NULL DEFAULT 0,
    price NUMERIC NOT NULL DEFAULT 0,
    discount NUMERIC DEFAULT 0,
    discount_type TEXT DEFAULT 'percent',
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE IF EXISTS public.order_items ADD COLUMN IF NOT EXISTS delivered_qty INTEGER NOT NULL DEFAULT 0;

-- 7. BẢNG ĐƠN MUA HÀNG (purchases)
CREATE TABLE IF NOT EXISTS public.purchases (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    supplier_name TEXT,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    total NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'Đang chờ' CHECK (status IN ('Đang chờ', 'Đã nhận hàng', 'Hủy')),
    payment_status TEXT DEFAULT 'Chưa thanh toán' CHECK (payment_status IN ('Chưa thanh toán', 'Đã thanh toán')),
    notes TEXT,
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 8. BẢNG CHI TIẾT ĐƠN MUA (purchase_items)
CREATE TABLE IF NOT EXISTS public.purchase_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    price NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. BẢNG LỊCH SỬ KHO (inventory_history)
CREATE TABLE IF NOT EXISTS public.inventory_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    product_code TEXT,
    product_name TEXT,
    type TEXT NOT NULL CHECK (type IN ('import', 'export', 'adjust', 'order', 'purchase', 'return', 'delivery')),
    quantity INTEGER NOT NULL,
    old_stock INTEGER,
    new_stock INTEGER,
    reason TEXT,
    reference_code TEXT,
    delivery_method TEXT,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_name TEXT,
    notes TEXT,
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 10. BẢNG CÀI ĐẶT SHOP (company_settings)
CREATE TABLE IF NOT EXISTS public.company_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value TEXT,
    user_id UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- BẬT ROW LEVEL SECURITY (RLS) CHO TẤT CẢ BẢNG
-- Chỉ authenticated users mới được truy cập
-- ============================================================

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- TẠO POLICIES - Cho phép authenticated users đọc/ghi
-- ============================================================

-- CUSTOMERS policies
CREATE POLICY "Authenticated users can read customers"
    ON public.customers FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert customers"
    ON public.customers FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can update customers"
    ON public.customers FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Authenticated users can delete customers"
    ON public.customers FOR DELETE
    TO authenticated
    USING (true);

-- SUPPLIERS policies
CREATE POLICY "Authenticated users can read suppliers"
    ON public.suppliers FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert suppliers"
    ON public.suppliers FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can update suppliers"
    ON public.suppliers FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Authenticated users can delete suppliers"
    ON public.suppliers FOR DELETE
    TO authenticated
    USING (true);

-- CATEGORIES policies
CREATE POLICY "Authenticated users can read categories"
    ON public.categories FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert categories"
    ON public.categories FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can update categories"
    ON public.categories FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Authenticated users can delete categories"
    ON public.categories FOR DELETE
    TO authenticated
    USING (true);

-- PRODUCTS policies
CREATE POLICY "Authenticated users can read products"
    ON public.products FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert products"
    ON public.products FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can update products"
    ON public.products FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Authenticated users can delete products"
    ON public.products FOR DELETE
    TO authenticated
    USING (true);

-- ORDERS policies
CREATE POLICY "Authenticated users can read orders"
    ON public.orders FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert orders"
    ON public.orders FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can update orders"
    ON public.orders FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Authenticated users can delete orders"
    ON public.orders FOR DELETE
    TO authenticated
    USING (true);

-- ORDER_ITEMS policies
CREATE POLICY "Authenticated users can read order_items"
    ON public.order_items FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert order_items"
    ON public.order_items FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can update order_items"
    ON public.order_items FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Authenticated users can delete order_items"
    ON public.order_items FOR DELETE
    TO authenticated
    USING (true);

-- PURCHASES policies
CREATE POLICY "Authenticated users can read purchases"
    ON public.purchases FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert purchases"
    ON public.purchases FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can update purchases"
    ON public.purchases FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Authenticated users can delete purchases"
    ON public.purchases FOR DELETE
    TO authenticated
    USING (true);

-- PURCHASE_ITEMS policies
CREATE POLICY "Authenticated users can read purchase_items"
    ON public.purchase_items FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert purchase_items"
    ON public.purchase_items FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can update purchase_items"
    ON public.purchase_items FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Authenticated users can delete purchase_items"
    ON public.purchase_items FOR DELETE
    TO authenticated
    USING (true);

-- INVENTORY_HISTORY policies
CREATE POLICY "Authenticated users can read inventory_history"
    ON public.inventory_history FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert inventory_history"
    ON public.inventory_history FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can update inventory_history"
    ON public.inventory_history FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Authenticated users can delete inventory_history"
    ON public.inventory_history FOR DELETE
    TO authenticated
    USING (true);

-- COMPANY_SETTINGS policies
CREATE POLICY "Authenticated users can read company_settings"
    ON public.company_settings FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert company_settings"
    ON public.company_settings FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can update company_settings"
    ON public.company_settings FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Authenticated users can delete company_settings"
    ON public.company_settings FOR DELETE
    TO authenticated
    USING (true);

-- ============================================================
-- TẠO INDEXES CHO PERFORMANCE
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_customers_code ON public.customers(code);
CREATE INDEX IF NOT EXISTS idx_customers_name ON public.customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_type ON public.customers(type);

CREATE INDEX IF NOT EXISTS idx_suppliers_code ON public.suppliers(code);

CREATE INDEX IF NOT EXISTS idx_categories_code ON public.categories(code);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON public.categories(parent_id);

CREATE INDEX IF NOT EXISTS idx_products_code ON public.products(code);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_supplier ON public.products(supplier_id);

CREATE INDEX IF NOT EXISTS idx_orders_code ON public.orders(code);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_date ON public.orders(date);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON public.order_items(product_id);

CREATE INDEX IF NOT EXISTS idx_purchases_code ON public.purchases(code);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON public.purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON public.purchases(date);

CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON public.purchase_items(purchase_id);

CREATE INDEX IF NOT EXISTS idx_inventory_history_product ON public.inventory_history(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_history_type ON public.inventory_history(type);
CREATE INDEX IF NOT EXISTS idx_inventory_history_created ON public.inventory_history(created_at);

CREATE INDEX IF NOT EXISTS idx_company_settings_key ON public.company_settings(key);

-- ============================================================
-- TẠO FUNCTION TỰ ĐỘNG CẬP NHẬT updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger cho mỗi bảng có updated_at
CREATE OR REPLACE TRIGGER on_customers_updated
    BEFORE UPDATE ON public.customers
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER on_suppliers_updated
    BEFORE UPDATE ON public.suppliers
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER on_products_updated
    BEFORE UPDATE ON public.products
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER on_orders_updated
    BEFORE UPDATE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER on_purchases_updated
    BEFORE UPDATE ON public.purchases
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER on_company_settings_updated
    BEFORE UPDATE ON public.company_settings
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- CHÈN DỮ LIỆU MẪU (DEMO DATA)
-- ============================================================

-- Demo Customers
INSERT INTO public.customers (code, name, type, phone, address, province, district, ward, debt, notes)
VALUES
    ('KH001', 'Nguyễn Văn A', 'ca-nhan', '0901234567', 'Số 1, Đường A', 'Hà Nội', 'Quận Hoàn Kiếm', 'Phường Hàng Bạc', 0, ''),
    ('KH002', 'Trần Thị B', 'ca-nhan', '0912345678', 'Số 2, Đường B', 'TP.HCM', 'Quận 1', 'Phường Bến Nghé', 0, ''),
    ('KH003', 'Lê Minh C', 'doanh-nghiep', '0923456789', 'Lô 3, KCN C', 'Đà Nẵng', 'Quận Hải Châu', 'Phường Thuận Phước', 0, ''),
    ('KH004', 'Phạm Thu D', 'doanh-nghiep', '0934567890', 'Số 4, Đường D', 'Cần Thơ', 'Quận Ninh Kiều', 'Phường An Cư', 0, ''),
    ('KH005', 'Hoàng Văn E', 'ca-nhan', '0945678901', 'Số 5, Đường E', 'Hải Phòng', 'Quận Ngô Quyền', 'Phường Máy Tơ', 0, '')
ON CONFLICT (code) DO NOTHING;

-- Update KH003 and KH004 with company info
UPDATE public.customers SET company_name = 'Công ty TNHH Minh Châu', department = 'Phòng mua hàng', tax_code = '0123456789' WHERE code = 'KH003';
UPDATE public.customers SET company_name = 'Công ty Cổ phần Thu Đức', department = 'Phòng kế toán', tax_code = '0987654321' WHERE code = 'KH004';

-- Demo Suppliers
INSERT INTO public.suppliers (code, name, phone, email, address, products_desc)
VALUES
    ('NCC001', 'Công ty TNHH ABC', '024-3456-7890', 'abc@company.vn', 'Hà Nội', 'Điện tử'),
    ('NCC002', 'Công ty XYZ', '028-3456-7891', 'xyz@company.vn', 'TP.HCM', 'Gia dụng'),
    ('NCC003', 'Công ty DEF', '0236-3456-792', 'def@company.vn', 'Đà Nẵng', 'Thời trang')
ON CONFLICT (code) DO NOTHING;

-- Demo Categories
INSERT INTO public.categories (code, name, parent_id)
VALUES
    ('CAT001', 'Sản phẩm', NULL),
    ('CAT004', 'Điện thoại', NULL),
    ('CAT005', 'Laptop', NULL),
    ('CAT006', 'Tablet', NULL),
    ('CAT007', 'Phụ kiện', NULL)
ON CONFLICT (code) DO NOTHING;

-- Sub-categories (need parent_id)
INSERT INTO public.categories (code, name, parent_id)
VALUES
    ('CAT002', 'Bóng đá', (SELECT id FROM public.categories WHERE code = 'CAT001')),
    ('CAT003', 'Pickle Ball', (SELECT id FROM public.categories WHERE code = 'CAT001'))
ON CONFLICT (code) DO NOTHING;

-- Demo Products
INSERT INTO public.products (code, name, category, price, import_price, stock, min_stock, supplier_code, sold_qty, purchased_qty)
VALUES
    ('SP001', 'iPhone 15 Pro', 'Điện thoại', 28900000, 25000000, 5, 10, 'NCC001', 0, 0),
    ('SP002', 'Samsung Galaxy S24', 'Điện thoại', 24900000, 22000000, 100, 15, 'NCC001', 0, 0),
    ('SP003', 'MacBook Air M2', 'Laptop', 28900000, 26000000, 15, 5, 'NCC001', 0, 0),
    ('SP004', 'iPad Pro 11 inch', 'Tablet', 19900000, 18000000, 8, 12, 'NCC001', 0, 0),
    ('SP005', 'AirPods Pro', 'Phụ kiện', 6490000, 5500000, 25, 20, 'NCC001', 0, 0),
    ('SP006', 'Quả bóng đá FIFA', 'Sản phẩm > Bóng đá', 500000, 350000, 50, 30, 'NCC002', 0, 0),
    ('SP007', 'Vợt Pickle Ball Pro', 'Sản phẩm > Pickle Ball', 800000, 650000, 30, 10, 'NCC002', 0, 0)
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- HOÀN THÀNH! 
-- 10 bảng đã được tạo với RLS, indexes, triggers và demo data
-- ============================================================
