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
            order_id: orderData.id
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
    const [customers, suppliers, products, categories, orders, purchases, inventoryHistory] = await Promise.all([
        getCustomers(),
        getSuppliers(),
        getProducts(),
        getCategories(),
        getOrders(),
        getPurchases(),
        getInventoryHistory()
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
            price: Number(item.price) || 0
        })),
        total: Number(o.total) || 0,
        status: o.status || 'Mới',
        paymentMethod: o.payment_method || 'Tiền mặt',
        paymentStatus: o.payment_status || 'Chưa thanh toán'
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

    const mappedInventoryHistory = inventoryHistory.map(h => ({
        id: h.id,
        productCode: h.product_code || '',
        productName: h.product_name || '',
        type: h.type,
        quantity: h.quantity,
        oldStock: h.old_stock,
        newStock: h.new_stock,
        reason: h.reason || '',
        referenceCode: h.reference_code || '',
        timestamp: h.created_at
    }))

    return {
        customers: mappedCustomers,
        suppliers: mappedSuppliers,
        products: mappedProducts,
        categories: mappedCategories,
        orders: mappedOrders,
        purchases: mappedPurchases,
        sales: [], // Sales được tính từ orders
        debts: [],
        inventoryHistory: mappedInventoryHistory
    }
}

// ==================== SYNC: Đồng bộ demoData lên Supabase ====================

// Debounce timer
let _syncTimer = null
let _isSyncing = false

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
    await _performSync(demoData)
}

async function _performSync(demoData) {
    if (_isSyncing) {
        console.log('⏳ Sync already in progress, skipping...')
        return
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

                const orderData = {
                    code: order.id,
                    customer_id: customerId,
                    customer_name: order.customerName || null,
                    date: order.date || new Date().toISOString().split('T')[0],
                    time: order.time || null,
                    total: order.total || 0,
                    status: order.status || 'Mới',
                    payment_method: order.paymentMethod || 'Tiền mặt',
                    payment_status: order.paymentStatus || 'Chưa thanh toán'
                }

                const { data: upsertedOrder, error: orderErr } = await supabase
                    .from('orders')
                    .upsert(orderData, { onConflict: 'code' })
                    .select()
                    .single()

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
                            price: p.price || 0
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

        // 7. Sync Inventory History (insert only, no upsert needed since entries are immutable)
        // Only sync new entries that don't have a UUID _supabaseId
        if (demoData.inventoryHistory && demoData.inventoryHistory.length > 0) {
            const newEntries = demoData.inventoryHistory.filter(h => !h.id || typeof h.id !== 'string' || h.id.length < 30)
            if (newEntries.length > 0) {
                const historyData = newEntries.map(h => ({
                    product_code: h.productCode || null,
                    product_name: h.productName || null,
                    type: h.type || 'adjust',
                    quantity: h.quantity || 0,
                    old_stock: h.oldStock ?? null,
                    new_stock: h.newStock ?? null,
                    reason: h.reason || null,
                    reference_code: h.referenceCode || null
                }))
                const { error } = await supabase
                    .from('inventory_history')
                    .insert(historyData)
                if (error) errors.push({ table: 'inventory_history', error })
            }
        }

        if (errors.length > 0) {
            console.warn('⚠️ Sync completed with errors:', errors)
        } else {
            console.log('✅ Data synced to Supabase successfully!')
        }
    } catch (err) {
        console.error('❌ Sync to Supabase failed:', err)
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
    const parentTables = ['inventory_history', 'orders', 'purchases', 'products', 'categories', 'suppliers', 'customers', 'company_settings']
    for (const table of parentTables) {
        const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000')
        if (error) errors.push({ table, error })
    }

    if (errors.length > 0) {
        console.warn('⚠️ Xóa dữ liệu Supabase có lỗi:', errors)
        return { success: false, errors }
    }
    console.log('✅ Đã xóa toàn bộ dữ liệu trên Supabase!')
    return { success: true }
}
