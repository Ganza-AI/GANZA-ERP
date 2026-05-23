import { supabase } from './supabaseClient.js'

// ============================================================
// SUPABASE DATA LAYER - CRUD cho ERP Shop Bán Hàng
// Module này cung cấp tất cả hàm giao tiếp với Supabase Database
// ============================================================

// ==================== CUSTOMERS ====================

export async function getCustomers() {
    const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('code', { ascending: true })
    if (error) { console.error('getCustomers error:', error); return [] }
    return data
}

export async function getCustomerByCode(code) {
    const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('code', code)
        .single()
    if (error) { console.error('getCustomerByCode error:', error); return null }
    return data
}

export async function addCustomer(customer) {
    const { data, error } = await supabase
        .from('customers')
        .insert([customer])
        .select()
        .single()
    if (error) { console.error('addCustomer error:', error); throw error }
    return data
}

export async function updateCustomer(id, updates) {
    const { data, error } = await supabase
        .from('customers')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
    if (error) { console.error('updateCustomer error:', error); throw error }
    return data
}

export async function deleteCustomer(id) {
    const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id)
    if (error) { console.error('deleteCustomer error:', error); throw error }
    return true
}

// ==================== SUPPLIERS ====================

export async function getSuppliers() {
    const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('code', { ascending: true })
    if (error) { console.error('getSuppliers error:', error); return [] }
    return data
}

export async function getSupplierByCode(code) {
    const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('code', code)
        .single()
    if (error) { console.error('getSupplierByCode error:', error); return null }
    return data
}

export async function addSupplier(supplier) {
    const { data, error } = await supabase
        .from('suppliers')
        .insert([supplier])
        .select()
        .single()
    if (error) { console.error('addSupplier error:', error); throw error }
    return data
}

export async function updateSupplier(id, updates) {
    const { data, error } = await supabase
        .from('suppliers')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
    if (error) { console.error('updateSupplier error:', error); throw error }
    return data
}

export async function deleteSupplier(id) {
    const { error } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', id)
    if (error) { console.error('deleteSupplier error:', error); throw error }
    return true
}

// ==================== CATEGORIES ====================

export async function getCategories() {
    const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('code', { ascending: true })
    if (error) { console.error('getCategories error:', error); return [] }
    return data
}

export async function addCategory(category) {
    const { data, error } = await supabase
        .from('categories')
        .insert([category])
        .select()
        .single()
    if (error) { console.error('addCategory error:', error); throw error }
    return data
}

export async function updateCategory(id, updates) {
    const { data, error } = await supabase
        .from('categories')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
    if (error) { console.error('updateCategory error:', error); throw error }
    return data
}

export async function deleteCategory(id) {
    const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id)
    if (error) { console.error('deleteCategory error:', error); throw error }
    return true
}

// ==================== PRODUCTS ====================

export async function getProducts() {
    const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('code', { ascending: true })
    if (error) { console.error('getProducts error:', error); return [] }
    return data
}

export async function getProductByCode(code) {
    const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('code', code)
        .single()
    if (error) { console.error('getProductByCode error:', error); return null }
    return data
}

export async function addProduct(product) {
    const { data, error } = await supabase
        .from('products')
        .insert([product])
        .select()
        .single()
    if (error) { console.error('addProduct error:', error); throw error }
    return data
}

export async function updateProduct(id, updates) {
    const { data, error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
    if (error) { console.error('updateProduct error:', error); throw error }
    return data
}

export async function deleteProduct(id) {
    const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id)
    if (error) { console.error('deleteProduct error:', error); throw error }
    return true
}

export async function updateProductStock(id, newStock) {
    const { data, error } = await supabase
        .from('products')
        .update({ stock: newStock })
        .eq('id', id)
        .select()
        .single()
    if (error) { console.error('updateProductStock error:', error); throw error }
    return data
}

// ==================== ORDERS ====================

export async function getOrders() {
    const { data, error } = await supabase
        .from('orders')
        .select(`
            *,
            order_items (*)
        `)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
    if (error) { console.error('getOrders error:', error); return [] }
    return data
}

export async function getOrderByCode(code) {
    const { data, error } = await supabase
        .from('orders')
        .select(`
            *,
            order_items (*)
        `)
        .eq('code', code)
        .single()
    if (error) { console.error('getOrderByCode error:', error); return null }
    return data
}

export async function addOrder(order, items) {
    // Insert order first
    const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert([order])
        .select()
        .single()
    if (orderError) { console.error('addOrder error:', orderError); throw orderError }

    // Insert order items
    if (items && items.length > 0) {
        const orderItems = items.map(item => ({
            ...item,
            order_id: orderData.id,
            delivered_qty: item.deliveredQty || 0,
            discount: item.discount || 0,
            discount_type: item.discountType || 'percent'
        }))
        const { error: itemsError } = await supabase
            .from('order_items')
            .insert(orderItems)
        if (itemsError) { console.error('addOrderItems error:', itemsError); throw itemsError }
    }

    return orderData
}

export async function updateOrder(id, updates) {
    const { data, error } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
    if (error) { console.error('updateOrder error:', error); throw error }
    return data
}

export async function deleteOrder(id) {
    // order_items will be cascade deleted
    const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', id)
    if (error) { console.error('deleteOrder error:', error); throw error }
    return true
}

// ==================== DELIVERIES ====================

export async function getDeliveries() {
    const { data, error } = await supabase
        .from('deliveries')
        .select('*')
        .order('delivery_date', { ascending: false })
    if (error) { console.error('getDeliveries error:', error); return [] }
    return data
}

export async function getDeliveriesByOrderCode(orderCode) {
    const { data, error } = await supabase
        .from('deliveries')
        .select('*')
        .eq('order_code', orderCode)
        .order('delivery_date', { ascending: false })
    if (error) { console.error('getDeliveriesByOrderCode error:', error); return [] }
    return data
}

export async function addDelivery(delivery) {
    const { data, error } = await supabase
        .from('deliveries')
        .insert([delivery])
        .select()
        .single()
    if (error) { console.error('addDelivery error:', error); throw error }
    return data
}

export async function addDeliveries(deliveries) {
    const { data, error } = await supabase
        .from('deliveries')
        .insert(deliveries)
        .select()
    if (error) { console.error('addDeliveries error:', error); throw error }
    return data
}

export async function updateDelivery(id, updates) {
    const { data, error } = await supabase
        .from('deliveries')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
    if (error) { console.error('updateDelivery error:', error); throw error }
    return data
}

export async function deleteDelivery(id) {
    const { error } = await supabase
        .from('deliveries')
        .delete()
        .eq('id', id)
    if (error) { console.error('deleteDelivery error:', error); throw error }
    return true
}

// ==================== PURCHASES ====================

export async function getPurchases() {
    const { data, error } = await supabase
        .from('purchases')
        .select(`
            *,
            purchase_items (*)
        `)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
    if (error) { console.error('getPurchases error:', error); return [] }
    return data
}

export async function addPurchase(purchase, items) {
    const { data: purchaseData, error: purchaseError } = await supabase
        .from('purchases')
        .insert([purchase])
        .select()
        .single()
    if (purchaseError) { console.error('addPurchase error:', purchaseError); throw purchaseError }

    if (items && items.length > 0) {
        const purchaseItems = items.map(item => ({
            ...item,
            purchase_id: purchaseData.id
        }))
        const { error: itemsError } = await supabase
            .from('purchase_items')
            .insert(purchaseItems)
        if (itemsError) { console.error('addPurchaseItems error:', itemsError); throw itemsError }
    }

    return purchaseData
}

export async function updatePurchase(id, updates) {
    const { data, error } = await supabase
        .from('purchases')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
    if (error) { console.error('updatePurchase error:', error); throw error }
    return data
}

export async function deletePurchase(id) {
    const { error } = await supabase
        .from('purchases')
        .delete()
        .eq('id', id)
    if (error) { console.error('deletePurchase error:', error); throw error }
    return true
}

// ==================== INVENTORY HISTORY ====================

export async function getInventoryHistory() {
    const { data, error } = await supabase
        .from('inventory_history')
        .select('*')
        .order('created_at', { ascending: false })
    if (error) { console.error('getInventoryHistory error:', error); return [] }
    return data
}

export async function addInventoryHistory(entry) {
    const { data, error } = await supabase
        .from('inventory_history')
        .insert([entry])
        .select()
        .single()
    if (error) { console.error('addInventoryHistory error:', error); throw error }
    return data
}

// ==================== EXPENSES ====================

export async function getExpenses() {
    const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
    if (error) {
        if (isMissingExpensesTable(error)) {
            _expensesTableAvailable = false
            console.warn('⚠️ Supabase expenses table is missing. Run supabase_expenses_migration.sql to persist operating expenses.')
        } else {
            console.error('getExpenses error:', error)
        }
        return []
    }
    return data
}

// ==================== COMPANY SETTINGS ====================

export async function getCompanySettings() {
    const { data, error } = await supabase
        .from('company_settings')
        .select('*')
    if (error) { console.error('getCompanySettings error:', error); return [] }
    return data
}

export async function getCompanySetting(key) {
    const { data, error } = await supabase
        .from('company_settings')
        .select('value')
        .eq('key', key)
        .single()
    if (error) { return null }
    return data?.value
}

export async function setCompanySetting(key, value) {
    const { data, error } = await supabase
        .from('company_settings')
        .upsert({ key, value }, { onConflict: 'key' })
        .select()
        .single()
    if (error) { console.error('setCompanySetting error:', error); throw error }
    return data
}

// ==================== HELPER: Load tất cả data ====================

/**
 * Load toàn bộ dữ liệu từ Supabase - dùng cho khởi tạo app
 * Trả về object tương thích với format demoData cũ
 */
export async function loadAllData() {
    const [customers, suppliers, products, categories, orders, purchases, inventoryHistory, deliveries, expenses] = await Promise.all([
        getCustomers(),
        getSuppliers(),
        getProducts(),
        getCategories(),
        getOrders(),
        getPurchases(),
        getInventoryHistory(),
        getDeliveries(),
        getExpenses()
    ])

    // Map Supabase data sang format cũ tương thích với VietnameseERP class
    const mappedCustomers = customers.map(c => ({
        id: c.code,
        _supabaseId: c.id,
        name: c.name,
        type: c.type,
        phone: c.phone || '',
        address: c.address || '',
        province: c.province || '',
        district: c.district || '',
        ward: c.ward || '',
        companyName: c.company_name || '',
        department: c.department || '',
        taxCode: c.tax_code || '',
        debt: Number(c.debt) || 0,
        notes: c.notes || ''
    }))

    const mappedSuppliers = suppliers.map(s => ({
        id: s.code,
        _supabaseId: s.id,
        name: s.name,
        phone: s.phone || '',
        email: s.email || '',
        address: s.address || '',
        products: s.products_desc || ''
    }))

    const mappedProducts = products.map(p => ({
        id: p.code,
        _supabaseId: p.id,
        name: p.name,
        category: p.category || '',
        price: Number(p.price) || 0,
        importPrice: Number(p.import_price) || 0,
        stock: p.stock || 0,
        minStock: p.min_stock || 5,
        supplier: p.supplier_code || '',
        soldQty: p.sold_qty || 0,
        purchasedQty: p.purchased_qty || 0
    }))

    const mappedCategories = categories.map(c => ({
        id: c.code,
        _supabaseId: c.id,
        name: c.name,
        parent: c.parent_id ? (categories.find(pc => pc.id === c.parent_id)?.code || null) : null
    }))

    const mappedOrders = orders.map(o => ({
        id: o.code,
        _supabaseId: o.id,
        customerId: o.customer_id ? (customers.find(c => c.id === o.customer_id)?.code || '') : '',
        customerName: o.customer_name || '',
        date: o.date,
        time: o.time || '',
        products: (o.order_items || []).map(item => ({
            id: item.product_code || '',
            name: item.product_name,
            quantity: item.quantity,
            price: Number(item.price) || 0,
            deliveredQty: Number(item.delivered_qty) || 0,
            discount: Number(item.discount) || 0,
            discountType: item.discount_type || 'percent'
        })),
        total: Number(o.total) || 0,
        expense: Number(o.expense) || 0,
        shippingFee: Number(o.shipping_fee) || 0,
        deliveryMethod: o.delivery_method || '',
        deliveryNotes: o.delivery_notes || '',
        status: o.status || 'Mới',
        paymentMethod: o.payment_method || 'Tiền mặt',
        paymentStatus: o.payment_status || 'Chưa thanh toán',
        paymentHistory: Array.isArray(o.payment_history) ? o.payment_history : [],
        paidAmount: Number(o.paid_amount) || 0,
        remainingBalance: Number(o.remaining_balance) || 0
    }))

    const mappedPurchases = purchases.map(p => ({
        id: p.code,
        _supabaseId: p.id,
        supplierId: p.supplier_id ? (suppliers.find(s => s.id === p.supplier_id)?.code || '') : '',
        supplierName: p.supplier_name || '',
        date: p.date,
        products: (p.purchase_items || []).map(item => ({
            name: item.product_name,
            quantity: item.quantity,
            price: Number(item.price) || 0
        })),
        total: Number(p.total) || 0,
        status: p.status || 'Đang chờ',
        paymentStatus: p.payment_status || 'Chưa thanh toán'
    }))

    const mappedInventoryHistory = inventoryHistory.map(h => {
        const createdAt = h.created_at ? new Date(h.created_at) : new Date();
        const formattedDate = createdAt.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
        const formattedTime = createdAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'Asia/Ho_Chi_Minh' });
        return {
            id: h.id,
            _supabaseId: h.id,
            productCode: h.product_code || '',
            productName: h.product_name || '',
            type: h.type,
            quantity: h.quantity,
            oldStock: h.old_stock,
            newStock: h.new_stock,
            reason: h.reason || '',
            referenceCode: h.reference_code || '',
            deliveryMethod: h.delivery_method || '',
            customerId: h.customer_id || '',
            customerName: h.customer_name || '',
            notes: h.notes || '',
            date: formattedDate,
            time: formattedTime,
            timestamp: h.created_at
        }
    })

    const mappedDeliveries = deliveries.map(d => ({
        id: d.id,
        orderCode: d.order_code || '',
        productCode: d.product_code || '',
        customerId: d.customer_id || '',
        customerName: d.customer_name || '',
        productName: d.product_name || '',
        quantityOrdered: Number(d.quantity_ordered) || 0,
        quantityDelivered: Number(d.quantity_delivered) || 0,
        deliveryDate: d.delivery_date || '',
        deliveryTime: d.delivery_time || '',
        deliveryMethod: d.delivery_method || '',
        deliveryNotes: d.delivery_notes || '',
        status: d.status || 'pending',
        createdAt: d.created_at || '',
        updatedAt: d.updated_at || '',
        createdBy: d.created_by || ''
    }))

    const mappedExpenses = expenses.map(e => ({
        id: e.code || e.id,
        _supabaseId: e.id,
        date: e.date || '',
        category: e.category || 'Khác',
        amount: Number(e.amount) || 0,
        paymentMethod: e.payment_method || 'Tiền mặt',
        payee: e.payee || '',
        notes: e.notes || '',
        createdAt: e.created_at || ''
    }))
    const expenseCategories = Array.from(new Set([
        'Lương',
        'Thuê kho',
        'Vận chuyển',
        'Marketing',
        'Điện nước',
        'Văn phòng phẩm',
        'Bảo trì',
        'Khác',
        ...mappedExpenses.map(e => e.category).filter(Boolean)
    ]))

    return {
        customers: mappedCustomers,
        suppliers: mappedSuppliers,
        products: mappedProducts,
        categories: mappedCategories,
        orders: mappedOrders,
        purchases: mappedPurchases,
        expenses: mappedExpenses,
        expenseCategories,
        sales: [], // Sales được tính từ orders
        debts: [],
        inventoryHistory: mappedInventoryHistory,
        deliveries: mappedDeliveries
    }
}

// ==================== SYNC: Đồng bộ demoData lên Supabase ====================

// Debounce timer
let _syncTimer = null
let _isSyncing = false
let _paymentTrackingColumnsAvailable = true
let _expensesTableAvailable = true

function getOrderPaymentTracking(order) {
    const paymentHistory = Array.isArray(order.paymentHistory) ? order.paymentHistory.map(payment => ({
        id: payment.id,
        date: payment.date,
        amount: Number(payment.amount) || 0,
        method: payment.method || order.paymentMethod || 'Tiền mặt',
        notes: payment.notes || '',
        timestamp: payment.timestamp || ''
    })) : []
    const paidAmount = paymentHistory.length > 0
        ? paymentHistory.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0)
        : Number(order.paidAmount) || 0
    const remainingBalance = Math.max((Number(order.total) || 0) - paidAmount, 0)

    return {
        paymentHistory,
        paidAmount,
        remainingBalance
    }
}

function isMissingPaymentTrackingColumn(error) {
    const message = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase()
    const mentionsPaymentColumn = 
        message.includes('payment_history') ||
        message.includes('paid_amount') ||
        message.includes('remaining_balance')
    return mentionsPaymentColumn && (error?.code === '42703' || error?.code === 'PGRST204' || message.includes('column'))
}

function isMissingExpensesTable(error) {
    const message = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase()
    return error?.code === '42P01' || error?.code === 'PGRST205' || (message.includes('expenses') && message.includes('schema cache'))
}

/**
 * Đồng bộ toàn bộ demoData từ VietnameseERP lên Supabase
 * Sử dụng upsert (insert or update) theo code
 * Debounced 2 giây để tránh gọi quá nhiều lần
 */
export function syncAllDataToSupabase(demoData) {
    if (_syncTimer) {
        clearTimeout(_syncTimer)
    }
    _syncTimer = setTimeout(async () => {
        await _performSync(demoData)
    }, 2000)
}

/**
 * Đồng bộ ngay lập tức (không debounce)
 */
export async function syncAllDataToSupabaseImmediate(demoData) {
    if (_syncTimer) {
        clearTimeout(_syncTimer)
        _syncTimer = null
    }
    while (_isSyncing) {
        await new Promise(resolve => setTimeout(resolve, 100))
    }
    return await _performSync(demoData)
}

async function _performSync(demoData) {
    if (_isSyncing) {
        console.log('⏳ Sync already in progress, skipping...')
        return false
    }
    _isSyncing = true
    console.log('☁️ Syncing data to Supabase...')

    try {
        const errors = []

        // 1. Sync Customers
        if (demoData.customers && demoData.customers.length > 0) {
            const customersData = demoData.customers.map(c => ({
                code: c.id,
                name: c.name,
                type: c.type || 'ca-nhan',
                phone: c.phone || null,
                address: c.address || null,
                province: c.province || null,
                district: c.district || null,
                ward: c.ward || null,
                company_name: c.companyName || null,
                department: c.department || null,
                tax_code: c.taxCode || null,
                debt: c.debt || 0,
                notes: c.notes || null
            }))
            const { error } = await supabase
                .from('customers')
                .upsert(customersData, { onConflict: 'code' })
            if (error) errors.push({ table: 'customers', error })
        }

        // Delete customers not in demoData
        await _deleteRemovedRecords('customers', 'code', demoData.customers?.map(c => c.id) || [])

        // 2. Sync Suppliers
        if (demoData.suppliers && demoData.suppliers.length > 0) {
            const suppliersData = demoData.suppliers.map(s => ({
                code: s.id,
                name: s.name,
                phone: s.phone || null,
                email: s.email || null,
                address: s.address || null,
                products_desc: s.products || null
            }))
            const { error } = await supabase
                .from('suppliers')
                .upsert(suppliersData, { onConflict: 'code' })
            if (error) errors.push({ table: 'suppliers', error })
        }
        await _deleteRemovedRecords('suppliers', 'code', demoData.suppliers?.map(s => s.id) || [])

        // 3. Sync Categories (parent categories first)
        if (demoData.categories && demoData.categories.length > 0) {
            // First, upsert all categories without parent
            const catsWithoutParent = demoData.categories.map(c => ({
                code: c.id,
                name: c.name,
                parent_id: null // Will set later
            }))
            const { error: catErr } = await supabase
                .from('categories')
                .upsert(catsWithoutParent, { onConflict: 'code' })
            if (catErr) errors.push({ table: 'categories', error: catErr })

            // Now update parent references
            const catsWithParent = demoData.categories.filter(c => c.parent)
            for (const cat of catsWithParent) {
                // Find parent's supabase id
                const { data: parentData } = await supabase
                    .from('categories')
                    .select('id')
                    .eq('code', cat.parent)
                    .single()
                if (parentData) {
                    await supabase
                        .from('categories')
                        .update({ parent_id: parentData.id })
                        .eq('code', cat.id)
                }
            }
        }
        await _deleteRemovedRecords('categories', 'code', demoData.categories?.map(c => c.id) || [])

        // 4. Sync Products
        if (demoData.products && demoData.products.length > 0) {
            const productsData = demoData.products.map(p => ({
                code: p.id,
                name: p.name,
                category: p.category || null,
                price: p.price || 0,
                import_price: p.importPrice || 0,
                stock: p.stock || 0,
                min_stock: p.minStock || 5,
                supplier_code: p.supplier || null,
                sold_qty: p.soldQty || 0,
                purchased_qty: p.purchasedQty || 0
            }))
            const { error } = await supabase
                .from('products')
                .upsert(productsData, { onConflict: 'code' })
            if (error) errors.push({ table: 'products', error })
        }
        await _deleteRemovedRecords('products', 'code', demoData.products?.map(p => p.id) || [])

        // 5. Sync Orders + Order Items
        if (demoData.orders && demoData.orders.length > 0) {
            for (const order of demoData.orders) {
                // Find customer's supabase id
                let customerId = null
                if (order.customerId) {
                    const { data: custData } = await supabase
                        .from('customers')
                        .select('id')
                        .eq('code', order.customerId)
                        .single()
                    customerId = custData?.id || null
                }

                const paymentTracking = getOrderPaymentTracking(order)
                const baseOrderData = {
                    code: order.id,
                    customer_id: customerId,
                    customer_name: order.customerName || null,
                    date: order.date || new Date().toISOString().split('T')[0],
                    time: order.time || null,
                    total: order.total || 0,
                    expense: order.expense || 0,
                    shipping_fee: order.shippingFee || 0,
                    delivery_method: order.deliveryMethod || null,
                    delivery_notes: order.deliveryNotes || null,
                    status: order.status || 'Mới',
                    payment_method: order.paymentMethod || 'Tiền mặt',
                    payment_status: order.paymentStatus || 'Chưa thanh toán'
                }
                const orderData = _paymentTrackingColumnsAvailable ? {
                    ...baseOrderData,
                    paid_amount: paymentTracking.paidAmount,
                    remaining_balance: paymentTracking.remainingBalance,
                    payment_history: paymentTracking.paymentHistory
                } : baseOrderData

                let { data: upsertedOrder, error: orderErr } = await supabase
                    .from('orders')
                    .upsert(orderData, { onConflict: 'code' })
                    .select()
                    .single()

                if (orderErr && _paymentTrackingColumnsAvailable && isMissingPaymentTrackingColumn(orderErr)) {
                    _paymentTrackingColumnsAvailable = false
                    console.warn('⚠️ Supabase orders table is missing payment tracking columns. Run supabase_payment_tracking_migration.sql to persist payment history.')
                    const retryResult = await supabase
                        .from('orders')
                        .upsert(baseOrderData, { onConflict: 'code' })
                        .select()
                        .single()
                    upsertedOrder = retryResult.data
                    orderErr = retryResult.error
                }

                if (orderErr) {
                    errors.push({ table: 'orders', error: orderErr })
                    continue
                }

                // Sync order items: delete old + insert new
                if (upsertedOrder) {
                    await supabase
                        .from('order_items')
                        .delete()
                        .eq('order_id', upsertedOrder.id)

                    if (order.products && order.products.length > 0) {
                        const items = order.products.map(p => ({
                            order_id: upsertedOrder.id,
                            product_code: p.id || null,
                            product_name: p.name,
                            quantity: p.quantity || 1,
                            price: p.price || 0,
                            delivered_qty: p.deliveredQty || 0,
                            discount: p.discount || 0,
                            discount_type: p.discountType || 'percent'
                        }))
                        const { error: itemsErr } = await supabase
                            .from('order_items')
                            .insert(items)
                        if (itemsErr) errors.push({ table: 'order_items', error: itemsErr })
                    }
                }
            }
        }
        await _deleteRemovedRecords('orders', 'code', demoData.orders?.map(o => o.id) || [])

        // 6. Sync Purchases + Purchase Items
        if (demoData.purchases && demoData.purchases.length > 0) {
            for (const purchase of demoData.purchases) {
                let supplierId = null
                if (purchase.supplierId) {
                    const { data: suppData } = await supabase
                        .from('suppliers')
                        .select('id')
                        .eq('code', purchase.supplierId)
                        .single()
                    supplierId = suppData?.id || null
                }

                const purchaseData = {
                    code: purchase.id,
                    supplier_id: supplierId,
                    supplier_name: purchase.supplierName || null,
                    date: purchase.date || new Date().toISOString().split('T')[0],
                    total: purchase.total || 0,
                    status: purchase.status || 'Đang chờ',
                    payment_status: purchase.paymentStatus || 'Chưa thanh toán'
                }

                const { data: upsertedPurchase, error: purchaseErr } = await supabase
                    .from('purchases')
                    .upsert(purchaseData, { onConflict: 'code' })
                    .select()
                    .single()

                if (purchaseErr) {
                    errors.push({ table: 'purchases', error: purchaseErr })
                    continue
                }

                if (upsertedPurchase) {
                    await supabase
                        .from('purchase_items')
                        .delete()
                        .eq('purchase_id', upsertedPurchase.id)

                    if (purchase.products && purchase.products.length > 0) {
                        const items = purchase.products.map(p => ({
                            purchase_id: upsertedPurchase.id,
                            product_name: p.name,
                            quantity: p.quantity || 1,
                            price: p.price || 0
                        }))
                        const { error: itemsErr } = await supabase
                            .from('purchase_items')
                            .insert(items)
                        if (itemsErr) errors.push({ table: 'purchase_items', error: itemsErr })
                    }
                }
            }
        }
        await _deleteRemovedRecords('purchases', 'code', demoData.purchases?.map(p => p.id) || [])

        // 7. Sync Expenses
        if (_expensesTableAvailable && demoData.expenses && demoData.expenses.length > 0) {
            const expensesData = demoData.expenses.map(expense => ({
                code: expense.id,
                date: expense.date || new Date().toISOString().split('T')[0],
                category: expense.category || 'Khác',
                amount: Number(expense.amount) || 0,
                payment_method: expense.paymentMethod || 'Tiền mặt',
                payee: expense.payee || null,
                notes: expense.notes || null,
                created_at: expense.createdAt || new Date().toISOString()
            }))

            const { error } = await supabase
                .from('expenses')
                .upsert(expensesData, { onConflict: 'code' })

            if (error) {
                if (isMissingExpensesTable(error)) {
                    _expensesTableAvailable = false
                    console.warn('⚠️ Supabase expenses table is missing. Run supabase_expenses_migration.sql to persist operating expenses.')
                } else {
                    errors.push({ table: 'expenses', error })
                }
            }
        }
        if (_expensesTableAvailable) {
            await _deleteRemovedRecords('expenses', 'code', demoData.expenses?.map(e => e.id) || [])
        }

        // 8. Sync Inventory History (insert only, no upsert needed since entries are immutable)
        // Only sync new entries that don't have a UUID _supabaseId
        if (demoData.inventoryHistory && demoData.inventoryHistory.length > 0) {
            const newEntries = demoData.inventoryHistory.filter(h => !h._supabaseId)
            if (newEntries.length > 0) {
                const historyData = newEntries.map(h => ({
                    product_code: h.productCode || null,
                    product_name: h.productName || null,
                    type: h.type || 'adjust',
                    quantity: h.quantity || 0,
                    old_stock: h.oldStock ?? null,
                    new_stock: h.newStock ?? null,
                    reason: h.reason || null,
                    reference_code: h.referenceCode || null,
                    delivery_method: h.deliveryMethod || null,
                    customer_id: h.customerId || null,
                    customer_name: h.customerName || null,
                    notes: h.notes || null,
                    created_at: h.timestamp || (h.date ? new Date(`${h.date} ${h.time || '00:00:00'}`).toISOString() : new Date().toISOString())
                }))
                const { data: insertedHistory, error } = await supabase
                    .from('inventory_history')
                    .insert(historyData)
                    .select()
                if (error) {
                    errors.push({ table: 'inventory_history', error })
                } else if (insertedHistory && insertedHistory.length === newEntries.length) {
                    insertedHistory.forEach((row, index) => {
                        const entry = newEntries[index]
                        if (entry) {
                            entry._supabaseId = row.id
                            entry.id = row.id
                        }
                    })
                    try {
                        localStorage.setItem('erp_vietnam_data', JSON.stringify(demoData))
                        console.log('✅ Persisted synced inventory history IDs to localStorage')
                    } catch (persistError) {
                        console.warn('⚠️ Could not persist synced inventory history IDs to localStorage:', persistError)
                    }
                }
            }
        }

        // 9. Sync Deliveries
        if (demoData.deliveries && demoData.deliveries.length > 0) {
            const newDeliveries = demoData.deliveries.filter(d => !d._supabaseId)
            if (newDeliveries.length > 0) {
                const deliveriesData = newDeliveries.map(d => ({
                    order_code: d.orderCode || null,
                    product_code: d.productCode || null,
                    customer_id: d.customerId || null,
                    customer_name: d.customerName || null,
                    product_name: d.productName || null,
                    quantity_ordered: d.quantityOrdered || 0,
                    quantity_delivered: d.quantityDelivered || 0,
                    delivery_date: d.deliveryDate || null,
                    delivery_time: d.deliveryTime || null,
                    delivery_method: d.deliveryMethod || null,
                    delivery_notes: d.deliveryNotes || null,
                    status: d.status || 'pending',
                    created_by: d.createdBy || null
                }))
                const { data: insertedDeliveries, error } = await supabase
                    .from('deliveries')
                    .insert(deliveriesData)
                    .select()
                if (error) {
                    errors.push({ table: 'deliveries', error })
                } else if (insertedDeliveries && insertedDeliveries.length === newDeliveries.length) {
                    insertedDeliveries.forEach((row, index) => {
                        const delivery = newDeliveries[index]
                        if (delivery) {
                            delivery._supabaseId = row.id
                            delivery.id = row.id
                        }
                    })
                    try {
                        localStorage.setItem('erp_vietnam_data', JSON.stringify(demoData))
                        console.log('✅ Persisted synced deliveries IDs to localStorage')
                    } catch (persistError) {
                        console.warn('⚠️ Could not persist synced deliveries IDs to localStorage:', persistError)
                    }
                }
            }
        }

        if (errors.length > 0) {
            console.warn('⚠️ Sync completed with errors:', errors)
            return false
        } else {
            console.log('✅ Data synced to Supabase successfully!')
            return true
        }
    } catch (err) {
        console.error('❌ Sync to Supabase failed:', err)
        return false
    } finally {
        _isSyncing = false
    }
}

/**
 * Xóa records trong Supabase mà không còn trong demoData
 */
async function _deleteRemovedRecords(table, codeField, currentCodes) {
    try {
        if (currentCodes.length === 0) {
            // Nếu demoData trống, xóa toàn bộ bảng
            await supabase.from(table).delete().neq(codeField, '__impossible__')
            return
        }
        // Lấy tất cả codes hiện có trên Supabase
        const { data: existingRows } = await supabase
            .from(table)
            .select(codeField)
        if (existingRows) {
            const removedCodes = existingRows
                .map(r => r[codeField])
                .filter(code => !currentCodes.includes(code))
            if (removedCodes.length > 0) {
                await supabase
                    .from(table)
                    .delete()
                    .in(codeField, removedCodes)
            }
        }
    } catch (err) {
        console.warn(`⚠️ Error deleting removed records from ${table}:`, err)
    }
}

// ==================== DELETE ALL DATA FROM SUPABASE ====================

/**
 * Xóa toàn bộ dữ liệu trên Supabase (tất cả các bảng)
 * Xóa bảng con trước để tránh lỗi foreign key
 */
export async function deleteAllDataFromSupabase() {
    console.log('🗑️ Đang xóa toàn bộ dữ liệu trên Supabase...')
    const errors = []

    // Xóa bảng con trước (order_items, purchase_items)
    const childTables = ['order_items', 'purchase_items']
    for (const table of childTables) {
        const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000')
        if (error) errors.push({ table, error })
    }

    // Xóa bảng cha
    const parentTables = ['inventory_history', 'expenses', 'orders', 'purchases', 'products', 'categories', 'suppliers', 'customers', 'company_settings']
    for (const table of parentTables) {
        const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000')
        if (error && !(table === 'expenses' && isMissingExpensesTable(error))) errors.push({ table, error })
    }

    if (errors.length > 0) {
        console.warn('⚠️ Xóa dữ liệu Supabase có lỗi:', errors)
        return { success: false, errors }
    }
    console.log('✅ Đã xóa toàn bộ dữ liệu trên Supabase!')
    return { success: true }
}
