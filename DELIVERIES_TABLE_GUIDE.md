# 📦 Deliveries Table Documentation

## Overview
Bảng `deliveries` lưu trữ thông tin chi tiết về các lần giao hàng cho từng sản phẩm trong các đơn hàng. Tách riêng dữ liệu giao hàng từ bảng `orders` để quản lý tốt hơn.

## Table Schema

### Create Table SQL
```sql
CREATE TABLE deliveries (
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
```

## Column Descriptions

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| `id` | UUID | Khóa chính, tự động tạo | `550e8400-e29b-41d4-a716-446655440000` |
| `order_code` | VARCHAR(50) | Mã đơn hàng (tham chiếu đến orders.code) | `DH001` |
| `product_code` | VARCHAR(50) | Mã sản phẩm | `SP001` |
| `customer_id` | UUID | ID của khách hàng | `550e8400-e29b-41d4-a716-446655440001` |
| `customer_name` | VARCHAR(255) | Tên khách hàng | `Nguyễn Văn A` |
| `product_name` | VARCHAR(255) | Tên sản phẩm | `iPhone 15 Pro` |
| `quantity_ordered` | INTEGER | Số lượng đặt hàng | `10` |
| `quantity_delivered` | INTEGER | Số lượng đã giao | `5` |
| `delivery_date` | DATE | Ngày giao hàng | `2025-05-19` |
| `delivery_time` | TIME | Giờ giao hàng | `14:30:00` |
| `delivery_method` | VARCHAR(100) | Phương thức giao hàng | `Giao hàng tận nơi`, `Lấy tại cửa hàng` |
| `delivery_notes` | TEXT | Ghi chú về giao hàng | `Giao lúc khách hàng có mặt` |
| `status` | VARCHAR(50) | Trạng thái giao hàng | `pending`, `delivered`, `partial`, `cancelled` |
| `created_at` | TIMESTAMP | Thời điểm tạo bản ghi | `2025-05-19 14:30:00` |
| `updated_at` | TIMESTAMP | Thời điểm cập nhật cuối | `2025-05-19 15:45:00` |
| `created_by` | VARCHAR(255) | Người tạo/ghi nhận giao hàng | `nhân viên@company.vn` |

## Indexes

| Index | Columns | Purpose |
|-------|---------|---------|
| `idx_deliveries_order_code` | `order_code` | Tìm nhanh tất cả giao hàng của một đơn hàng |
| `idx_deliveries_product_code` | `product_code` | Tìm nhanh tất cả giao hàng của một sản phẩm |
| `idx_deliveries_customer_id` | `customer_id` | Tìm nhanh tất cả giao hàng của một khách hàng |
| `idx_deliveries_delivery_date` | `delivery_date` | Tìm nhanh giao hàng theo ngày |
| `idx_deliveries_status` | `status` | Tìm nhanh giao hàng theo trạng thái |

## JavaScript API Functions

### CRUD Operations

#### Get all deliveries
```javascript
import { getDeliveries } from '/src/supabaseData.js'

const deliveries = await getDeliveries()
```

#### Get deliveries by order code
```javascript
import { getDeliveriesByOrderCode } from '/src/supabaseData.js'

const orderDeliveries = await getDeliveriesByOrderCode('DH001')
```

#### Add single delivery
```javascript
import { addDelivery } from '/src/supabaseData.js'

const newDelivery = await addDelivery({
    order_code: 'DH001',
    product_code: 'SP001',
    customer_id: 'customer-uuid',
    customer_name: 'Nguyễn Văn A',
    product_name: 'iPhone 15 Pro',
    quantity_ordered: 10,
    quantity_delivered: 5,
    delivery_date: '2025-05-19',
    delivery_time: '14:30',
    delivery_method: 'Giao hàng tận nơi',
    delivery_notes: 'Giao lúc khách hàng có mặt',
    status: 'delivered',
    created_by: 'user@company.vn'
})
```

#### Add multiple deliveries
```javascript
import { addDeliveries } from '/src/supabaseData.js'

const deliveriesList = [
    {
        order_code: 'DH001',
        product_code: 'SP001',
        quantity_delivered: 5,
        delivery_date: '2025-05-19',
        status: 'delivered'
    },
    {
        order_code: 'DH001',
        product_code: 'SP002',
        quantity_delivered: 3,
        delivery_date: '2025-05-19',
        status: 'delivered'
    }
]

const inserted = await addDeliveries(deliveriesList)
```

#### Update delivery
```javascript
import { updateDelivery } from '/src/supabaseData.js'

const updated = await updateDelivery(deliveryId, {
    quantity_delivered: 7,
    status: 'partial',
    delivery_notes: 'Giao một phần, phần còn lại giao sau'
})
```

#### Delete delivery
```javascript
import { deleteDelivery } from '/src/supabaseData.js'

await deleteDelivery(deliveryId)
```

## Data Flow

### When a delivery is recorded:
1. User nhập thông tin giao hàng trong app
2. App tạo `delivery` object và thêm vào `demoData.deliveries` array
3. `saveToLocalStorage()` được gọi để lưu vào localStorage
4. `syncAllDataToSupabase()` được gọi (debounce 2 giây)
5. Sync function đẩy deliveries lên Supabase `deliveries` table
6. Mỗi delivery mới được gán `_supabaseId` UUID
7. Dữ liệu được lưu lại vào localStorage với IDs

### When app loads:
1. `initializeApp()` gọi `loadAllData()` từ Supabase
2. `getDeliveries()` lấy tất cả deliveries từ bảng
3. Dữ liệu được map vào format tương thích (`orderCode`, `quantityDelivered`, v.v)
4. Trả về trong object `deliveries: mappedDeliveries`
5. Data được lưu vào localStorage làm backup

## Status Values

| Status | Description |
|--------|-------------|
| `pending` | Chưa giao |
| `delivered` | Đã giao hết |
| `partial` | Giao một phần |
| `cancelled` | Đơn hàng bị hủy |

## Delivery Methods

Common delivery methods:
- `Giao hàng tận nơi` - Giao hàng tận nhà/cửa hàng khách
- `Lấy tại cửa hàng` - Khách hàng tới lấy
- `Giao qua đối tác` - Giao qua đối tác vận chuyển
- `Tự đến nhân` - Khách tự đến nhân hàng
- `Khác` - Phương thức khác

## Migration & Setup

### 1. Run SQL Migration
Chạy file `supabase_deliveries_migration.sql` trên Supabase SQL Editor:
- Vào Supabase Dashboard → SQL Editor
- Tạo query mới
- Copy toàn bộ nội dung từ `supabase_deliveries_migration.sql`
- Click "Run"

### 2. Set RLS Policies (tùy chọn)
Nếu dùng Row Level Security:
```sql
-- Enable RLS on deliveries table
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read/write
CREATE POLICY "Allow authenticated users" ON deliveries
    FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');
```

### 3. Code tương thích
- `src/supabaseData.js` đã cập nhật với CRUD functions
- `src/main.js` đã cập nhật để load/sync deliveries
- Dữ liệu sẽ tự động đồng bộ khi có hoạt động

## Usage Example in main.js

```javascript
// Ghi nhận giao hàng cho sản phẩm trong đơn hàng
async recordDelivery(orderIndex, productIndex, quantityDelivered) {
    const order = this.demoData.orders[orderIndex];
    const product = order.products[productIndex];
    
    const delivery = {
        orderCode: order.id,
        productCode: product.id,
        customerId: order.customerId,
        customerName: order.customerName,
        productName: product.name,
        quantityOrdered: product.quantity,
        quantityDelivered: quantityDelivered,
        deliveryDate: this.getVietnamTime().toISOString().split('T')[0],
        deliveryTime: this.formatVietnameseTime().split(' ')[1],
        deliveryMethod: order.deliveryMethod,
        deliveryNotes: order.deliveryNotes,
        status: quantityDelivered >= product.quantity ? 'delivered' : 'partial',
        createdBy: 'current-user@company.vn'
    };
    
    // Thêm vào demoData
    if (!this.demoData.deliveries) {
        this.demoData.deliveries = [];
    }
    this.demoData.deliveries.push(delivery);
    
    // Lưu lại
    this.saveToLocalStorage();
    
    this.showNotification('✓ Đã ghi nhận giao hàng', 'success');
}
```

## Performance Tips

1. **Index lookups**: Luôn sử dụng `order_code` hoặc `product_code` để tìm kiếm
2. **Date range queries**: Sử dụng `delivery_date` index cho báo cáo theo ngày
3. **Status filtering**: Sử dụng `status` index cho lọc giao hàng chưa hoàn thành
4. **Batch operations**: Sử dụng `addDeliveries()` thay vì loop `addDelivery()`

## Backup & Recovery

Deliveries được đồng bộ tự động:
- ✅ Lưu vào `localStorage` (`erp_vietnam_data`)
- ✅ Đẩy lên Supabase với debounce 2 giây
- ✅ Auto-recover từ Supabase khi app load
- ✅ Included trong backup/restore

---

**Last Updated**: 2025-05-19  
**Author**: ERP Development Team
