-- ============================================================
-- DELIVERIES TABLE - Lưu trữ thông tin giao hàng chi tiết
-- Tách riêng dữ liệu giao hàng từ bảng orders để quản lý tốt hơn
-- ============================================================

-- Tạo bảng deliveries
CREATE TABLE IF NOT EXISTS deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_code VARCHAR(50) NOT NULL,
    product_code VARCHAR(50) NOT NULL,
    customer_id UUID,
    customer_name VARCHAR(255),
    product_name VARCHAR(255),
    quantity_ordered INTEGER DEFAULT 0,
    quantity_delivered INTEGER DEFAULT 0,
    delivery_date DATE,
    delivery_time TIME,
    delivery_method VARCHAR(100),
    delivery_notes TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(255),
    CONSTRAINT fk_order_code FOREIGN KEY (order_code) REFERENCES orders(code) ON DELETE CASCADE
);

-- Tạo indexes để tối ưu hiệu suất
CREATE INDEX IF NOT EXISTS idx_deliveries_order_code ON deliveries(order_code);
CREATE INDEX IF NOT EXISTS idx_deliveries_product_code ON deliveries(product_code);
CREATE INDEX IF NOT EXISTS idx_deliveries_customer_id ON deliveries(customer_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_delivery_date ON deliveries(delivery_date);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);

-- Thêm comments để giải thích các cột
COMMENT ON TABLE deliveries IS 'Bảng lưu trữ thông tin chi tiết về các lần giao hàng cho từng sản phẩm trong đơn hàng';
COMMENT ON COLUMN deliveries.order_code IS 'Mã đơn hàng - tham chiếu đến bảng orders';
COMMENT ON COLUMN deliveries.product_code IS 'Mã sản phẩm - tham chiếu đến bảng products';
COMMENT ON COLUMN deliveries.quantity_ordered IS 'Số lượng sản phẩm được đặt hàng';
COMMENT ON COLUMN deliveries.quantity_delivered IS 'Số lượng sản phẩm đã giao';
COMMENT ON COLUMN deliveries.delivery_date IS 'Ngày giao hàng';
COMMENT ON COLUMN deliveries.delivery_time IS 'Giờ giao hàng';
COMMENT ON COLUMN deliveries.delivery_method IS 'Phương thức giao hàng (Giao hàng tận nơi, Lấy tại cửa hàng, v.v)';
COMMENT ON COLUMN deliveries.status IS 'Trạng thái giao hàng: pending, delivered, partial, cancelled';
COMMENT ON COLUMN deliveries.created_by IS 'Người tạo/ghi nhận giao hàng';

-- Tạo trigger để tự động cập nhật updated_at
CREATE OR REPLACE FUNCTION update_deliveries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_deliveries_updated_at
BEFORE UPDATE ON deliveries
FOR EACH ROW
EXECUTE FUNCTION update_deliveries_updated_at();
