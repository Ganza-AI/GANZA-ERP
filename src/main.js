import { supabase, getSession } from '/src/supabaseClient.js'
import { loadAllData, syncAllDataToSupabase, syncAllDataToSupabaseImmediate, deleteAllDataFromSupabase } from '/src/supabaseData.js'

// Flag để biết đã load data từ Supabase chưa
window._supabaseDataLoaded = false
window._supabaseData = null
        // HOSTING SOLUTION: Global storage với localStorage backup
        window.companyAssets = { 
            logo: localStorage.getItem('company_logo') || null, 
            qr: localStorage.getItem('company_qr') || null 
        };

        // Auto-restore every 1 second - ensures logo/QR always visible từ localStorage
        setInterval(function() {
            // Restore logo từ localStorage nếu cần
            const savedLogo = localStorage.getItem('company_logo');
            if (savedLogo) {
                window.companyAssets.logo = savedLogo;
                const logoDisplay = document.getElementById('logo-display');
                if (logoDisplay && !logoDisplay.innerHTML.includes('<img')) {
                    logoDisplay.innerHTML = `<img src="${savedLogo}" alt="Logo" style="max-width: 100%; max-height: 140px; object-fit: contain;">`;
                }
            }

            // Restore QR từ localStorage nếu cần
            const savedQR = localStorage.getItem('company_qr');
            if (savedQR) {
                window.companyAssets.qr = savedQR;
                const qrDisplay = document.getElementById('qr-display');
                if (qrDisplay && !qrDisplay.innerHTML.includes('<img')) {
                    qrDisplay.innerHTML = `<img src="${savedQR}" alt="QR Code" style="max-width: 100%; max-height: 140px; object-fit: contain;">`;
                }
            }
        }, 1000);

        // Force browser to use latest version (cache buster)
        console.log('🔄 PAGE LOAD TIME:', new Date().toLocaleString('vi-VN'));
        console.log('🔄 Cache busting - timestamp:', Date.now());

        // Vietnamese ERP Offline Application  
        class VietnameseERP {
            constructor() {
                this.currentPage = 'dashboard';
                // Clear old data with wrong dates
                this.clearOldDataIfNeeded();

                // LUÔN thử load từ localStorage trước, chỉ tạo demo data nếu HOÀN TOÀN trống
                this.initializeData();

                this.init();
            }

            initializeData() {
                // Kiểm tra xem data đã được load từ Supabase chưa
                if (window._supabaseDataLoaded && window._supabaseData) {
                    console.log('☁️ LOADING DATA FROM SUPABASE');
                    if (this.isSupabaseDataUseful(window._supabaseData)) {
                        this.demoData = window._supabaseData;

                        // Đảm bảo các trường bắt buộc tồn tại
                        this.demoData.customers = this.demoData.customers || [];
                        this.demoData.suppliers = this.demoData.suppliers || [];
                        this.demoData.products = this.demoData.products || [];
                        this.demoData.categories = this.demoData.categories || [];
                        this.demoData.orders = this.demoData.orders || [];
                        this.demoData.purchases = this.demoData.purchases || [];
                        this.demoData.expenses = this.demoData.expenses || [];
                        this.demoData.expenseCategories = this.demoData.expenseCategories || this.getDefaultExpenseCategories();
                        this.demoData.sales = this.demoData.sales || [];
                        this.demoData.debts = this.demoData.debts || [];
                        this.demoData.inventoryHistory = this.demoData.inventoryHistory || [];
                        this.demoData.deliveries = this.demoData.deliveries || [];

                        // Migrate data nếu cần
                        this.migrateProductData();
                        this.migrateLegacyOrderAndHistoryData();

                        console.log('📊 Supabase Data Summary:');
                        console.log(`   - Customers: ${this.demoData.customers.length}`);
                        console.log(`   - Products: ${this.demoData.products.length}`);
                        console.log(`   - Orders: ${this.demoData.orders.length}`);
                        console.log(`   - Suppliers: ${this.demoData.suppliers.length}`);
                        console.log(`   - Categories: ${this.demoData.categories.length}`);
                        console.log(`   - Deliveries: ${this.demoData.deliveries.length}`);

                        // Cũng lưu vào localStorage làm backup/cache
                        this.saveToLocalStorage();
                        return;
                    }

                    console.warn('⚠️ Supabase data is empty or incomplete, falling back to localStorage');
                    window._supabaseDataLoaded = false;
                    window._supabaseData = null;
                }

                // Fallback: load từ localStorage nếu Supabase không khả dụng
                console.log('⚠️ Supabase data not available, falling back to localStorage');

                // Check if user requested empty mode (deleted all data)
                const emptyMode = localStorage.getItem('erp_vietnam_empty_mode');
                if (emptyMode === 'true') {
                    console.log('📭 EMPTY MODE - Starting with no data');
                    this.demoData = {
                        customers: [],
                        suppliers: [],
                        products: [],
                        categories: [],
                        orders: [],
                        purchases: [],
                        expenses: [],
                        expenseCategories: this.getDefaultExpenseCategories(),
                        sales: [],
                        debts: [],
                        inventoryHistory: [],
                        deliveries: []
                    };
                    return;
                }

                const saved = localStorage.getItem('erp_vietnam_data');
                if (saved && saved.trim() !== '') {
                    try {
                        this.demoData = JSON.parse(saved);
                        console.log('✅ LOADED EXISTING DATA FROM LOCALSTORAGE');
                        console.log('   Data size:', saved.length, 'bytes');
                        console.log('DEBUG loaded demoData:', {
                            orders: (this.demoData.orders || []).map(o => ({
                                id: o.id,
                                status: o.status,
                                deliveryMethod: o.deliveryMethod,
                                deliveryNotes: o.deliveryNotes,
                                products: (o.products || []).map(p => ({ id: p.id, quantity: p.quantity, deliveredQty: p.deliveredQty }))
                            })),
                            inventoryHistory: (this.demoData.inventoryHistory || []).slice(-5)
                        });

                        // Migrate data: Thêm minStock cho sản phẩm cũ nếu chưa có
                        this.migrateProductData();
                        this.migrateLegacyOrderAndHistoryData();

                        // Legacy data may not contain `debt`; đảm bảo luôn có trường với giá trị 0
                        this.demoData.customers = this.demoData.customers.map(c => ({
                            ...c,
                            debt: typeof c.debt === 'number' ? c.debt : 0
                        }));
                        this.demoData.purchases = Array.isArray(this.demoData.purchases) ? this.demoData.purchases : [];

                        // Đảm bảo inventoryHistory tồn tại
                        if (!Array.isArray(this.demoData.inventoryHistory)) {
                            this.demoData.inventoryHistory = [];
                        }

                        console.log('📊 Data Summary:');
                        console.log(`   - Customers: ${this.demoData.customers.length}`);
                        console.log(`   - Products: ${this.demoData.products.length}`);
                        console.log(`   - Orders: ${this.demoData.orders.length}`);
                        return; // Thoát ngay lập tức, KHÔNG tạo demo data
                    } catch (e) {
                        console.error('❌ Error parsing saved data:', e);
                    }
                }

                // Chỉ tạo demo data nếu localStorage hoàn toàn trống
                console.log('🆕 NO SAVED DATA - CREATING FRESH DEMO DATA');
                this.demoData = this.generateDemoData();
                this.saveToLocalStorage();
            }

            isSupabaseDataUseful(data) {
                if (!data || typeof data !== 'object') {
                    return false;
                }

                const arraysToCheck = ['customers', 'suppliers', 'products', 'categories', 'orders', 'purchases', 'expenses', 'inventoryHistory'];
                return arraysToCheck.some(key => Array.isArray(data[key]) && data[key].length > 0);
            }

            // Migrate data để thêm minStock cho sản phẩm cũ
            migrateProductData() {
                let needsSave = false;

                // Đảm bảo tất cả sản phẩm đều có trường minStock, soldQty và purchasedQty
                if (this.demoData.products) {
                    this.demoData.products.forEach(product => {
                        if (typeof product.minStock === 'undefined') {
                            // Đặt mặc định minStock dựa trên tồn kho hiện tại
                            product.minStock = Math.max(5, Math.floor(product.stock * 0.2));
                            needsSave = true;
                            console.log(`📦 Thêm minStock=${product.minStock} cho sản phẩm ${product.name}`);
                        }
                        if (typeof product.soldQty === 'undefined') {
                            product.soldQty = 0;
                            needsSave = true;
                        }
                        if (typeof product.purchasedQty === 'undefined') {
                            product.purchasedQty = 0;
                            needsSave = true;
                        }
                    });
                }

                if (needsSave) {
                    this.saveToLocalStorage();
                    console.log('✅ Đã cập nhật dữ liệu sản phẩm với trường minStock, soldQty và purchasedQty');
                }
            }

            migrateLegacyOrderAndHistoryData() {
                let needsSave = false;

                this.demoData.orders = Array.isArray(this.demoData.orders) ? this.demoData.orders : [];
                this.demoData.orders.forEach(order => {
                    if (!order.deliveryMethod && order.delivery_method) {
                        order.deliveryMethod = order.delivery_method;
                        needsSave = true;
                    }
                    if (!order.deliveryNotes && (order.delivery_notes || order.deliveryNote || order.delivery_note)) {
                        order.deliveryNotes = order.delivery_notes || order.deliveryNote || order.delivery_note;
                        needsSave = true;
                    }
                    if (typeof order.shippingFee === 'undefined' && typeof order.shipping_fee !== 'undefined') {
                        order.shippingFee = Number(order.shipping_fee) || 0;
                        needsSave = true;
                    }
                    if (!Array.isArray(order.products)) {
                        order.products = [];
                        needsSave = true;
                    }
                    order.products.forEach(product => {
                        if (typeof product.discount === 'undefined' && typeof product.discount_amount !== 'undefined') {
                            product.discount = Number(product.discount_amount) || 0;
                            needsSave = true;
                        }
                        if (!product.discountType && product.discount_type) {
                            product.discountType = product.discount_type;
                            needsSave = true;
                        }
                        const deliveredQty = Number(product.deliveredQty ?? product.delivered_qty ?? 0);
                        if (product.deliveredQty !== deliveredQty) {
                            product.deliveredQty = deliveredQty;
                            needsSave = true;
                        }
                        if (typeof product.quantity === 'string') {
                            product.quantity = Number(product.quantity) || 0;
                            needsSave = true;
                        }
                        if (typeof product.price === 'string') {
                            product.price = Number(product.price) || 0;
                            needsSave = true;
                        }
                        if (typeof product.discount === 'string') {
                            product.discount = Number(product.discount) || 0;
                            needsSave = true;
                        }
                        if (!product.discountType) {
                            product.discountType = 'percent';
                            needsSave = true;
                        }
                    });
                    if (!order.status) {
                        order.status = 'Mới';
                        needsSave = true;
                    }
                    if (!Array.isArray(order.paymentHistory)) {
                        order.paymentHistory = [];
                        needsSave = true;
                    }
                    order.paymentHistory.forEach(payment => {
                        const normalizedAmount = Number(payment.amount) || 0;
                        if (payment.amount !== normalizedAmount) {
                            payment.amount = normalizedAmount;
                            needsSave = true;
                        }
                        if (!payment.method && order.paymentMethod) {
                            payment.method = order.paymentMethod;
                            needsSave = true;
                        }
                        if (!payment.date && order.date) {
                            payment.date = order.date;
                            needsSave = true;
                        }
                    });

                    if (order.paymentStatus === 'Đã thanh toán' && order.paymentHistory.length === 0 && Number(order.total) > 0) {
                        const customer = (this.demoData.customers || []).find(c => c.id === order.customerId);
                        this.recordOrderPayment(order, customer, Number(order.total) || 0, {
                            id: `PAY_INIT_${order.id}`,
                            date: order.date || this.getVietnamTime().toISOString().split('T')[0],
                            method: order.paymentMethod || 'Tiền mặt',
                            notes: 'Khôi phục lịch sử thanh toán cho đơn đã thanh toán',
                            timestamp: order.time || this.formatTimeNow(),
                            remainingDebt: customer ? Number(customer.debt) || 0 : 0
                        });
                        needsSave = true;
                    } else if (this.syncOrderPaymentTotals(order)) {
                        needsSave = true;
                    }
                });

                const defaultExpenseCategories = this.getDefaultExpenseCategories();
                this.demoData.expenses = Array.isArray(this.demoData.expenses) ? this.demoData.expenses : [];
                this.demoData.expenseCategories = Array.isArray(this.demoData.expenseCategories) && this.demoData.expenseCategories.length > 0
                    ? Array.from(new Set([...defaultExpenseCategories, ...this.demoData.expenseCategories.filter(Boolean)]))
                    : defaultExpenseCategories;

                this.demoData.expenses.forEach(expense => {
                    if (!expense.id) {
                        expense.id = `CP${Date.now()}${Math.floor(Math.random() * 1000)}`;
                        needsSave = true;
                    }
                    if (!expense.date) {
                        expense.date = this.getVietnamTime().toISOString().split('T')[0];
                        needsSave = true;
                    }
                    if (!expense.category) {
                        expense.category = 'Khác';
                        needsSave = true;
                    }
                    if (typeof expense.amount === 'string') {
                        expense.amount = Number(expense.amount) || 0;
                        needsSave = true;
                    }
                    if (!expense.paymentMethod) {
                        expense.paymentMethod = 'Tiền mặt';
                        needsSave = true;
                    }
                    if (!this.demoData.expenseCategories.includes(expense.category)) {
                        this.demoData.expenseCategories.push(expense.category);
                        needsSave = true;
                    }
                });

                if (this.syncCustomerDebtTotals()) {
                    needsSave = true;
                }

                this.demoData.inventoryHistory = Array.isArray(this.demoData.inventoryHistory) ? this.demoData.inventoryHistory : [];
                this.demoData.inventoryHistory.forEach(entry => {
                    const createdAt = entry.timestamp ? new Date(entry.timestamp) : entry.created_at ? new Date(entry.created_at) : null;
                    if (createdAt) {
                        const dateValue = createdAt.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
                        const timeValue = createdAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'Asia/Ho_Chi_Minh' });
                        if (!entry.date || entry.date !== dateValue) {
                            entry.date = entry.date || dateValue;
                            needsSave = true;
                        }
                        if (!entry.time || entry.time !== timeValue) {
                            entry.time = entry.time || timeValue;
                            needsSave = true;
                        }
                    }
                    if (!entry.deliveryMethod && entry.delivery_method) {
                        entry.deliveryMethod = entry.delivery_method;
                        needsSave = true;
                    }
                    if (!entry.customerId && entry.customer_id) {
                        entry.customerId = entry.customer_id;
                        needsSave = true;
                    }
                    if (!entry.customerName && entry.customer_name) {
                        entry.customerName = entry.customer_name;
                        needsSave = true;
                    }
                    if (!entry.productId && entry.product_code) {
                        entry.productId = entry.product_code;
                        needsSave = true;
                    }
                    if (!entry.productName && entry.product_name) {
                        entry.productName = entry.product_name;
                        needsSave = true;
                    }
                    if (typeof entry.quantity === 'string') {
                        entry.quantity = Number(entry.quantity) || 0;
                        needsSave = true;
                    }
                });

                if (needsSave) {
                    this.saveToLocalStorage();
                    console.log('✅ Đã migrate dữ liệu đơn hàng/lich sử kho cũ để hiển thị đúng');
                }
            }

            getOrderPaidAmount(order) {
                if (!order) return 0;
                if (Array.isArray(order.paymentHistory) && order.paymentHistory.length > 0) {
                    return order.paymentHistory.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
                }
                return Number(order.paidAmount) || 0;
            }

            getOrderRemainingBalance(order) {
                if (!order) return 0;
                const total = Number(order.total) || 0;
                const paidAmount = this.getOrderPaidAmount(order);
                return Math.max(total - paidAmount, 0);
            }

            syncOrderPaymentTotals(order) {
                if (!order) return false;
                const paidAmount = this.getOrderPaidAmount(order);
                const remainingBalance = this.getOrderRemainingBalance(order);
                let changed = false;

                if (Number(order.paidAmount) !== paidAmount) {
                    order.paidAmount = paidAmount;
                    changed = true;
                }
                if (Number(order.remainingBalance) !== remainingBalance) {
                    order.remainingBalance = remainingBalance;
                    changed = true;
                }

                return changed;
            }

            recordOrderPayment(order, customer, amount, options = {}) {
                const paymentAmount = Number(amount) || 0;
                if (!order || paymentAmount <= 0) return null;

                if (!Array.isArray(order.paymentHistory)) {
                    order.paymentHistory = [];
                }

                const receipt = {
                    id: options.id || `PAY_${Date.now()}_${order.id || 'ORDER'}`,
                    date: options.date || order.date || this.getVietnamTime().toISOString().split('T')[0],
                    amount: paymentAmount,
                    method: options.method || order.paymentMethod || 'Tiền mặt',
                    notes: options.notes || '',
                    timestamp: options.timestamp || this.formatTimeNow()
                };

                const receiptExists = order.paymentHistory.some(payment => payment.id === receipt.id);
                if (!receiptExists) {
                    order.paymentHistory.push(receipt);
                }

                this.syncOrderPaymentTotals(order);

                if (customer) {
                    if (!Array.isArray(customer.paymentHistory)) {
                        customer.paymentHistory = [];
                    }

                    const linkExists = customer.paymentHistory.some(payment => 
                        payment.id === receipt.id &&
                        Array.isArray(payment.ordersAffected) &&
                        payment.ordersAffected.some(affectedOrder => affectedOrder.orderId === order.id)
                    );

                    if (!linkExists) {
                        customer.paymentHistory.push({
                            id: receipt.id,
                            date: receipt.date,
                            amount: paymentAmount,
                            method: receipt.method,
                            notes: receipt.notes,
                            timestamp: receipt.timestamp,
                            ordersAffected: [{
                                orderId: order.id,
                                amount: paymentAmount,
                                remainingBalance: this.getOrderRemainingBalance(order)
                            }],
                            remainingDebt: typeof options.remainingDebt === 'number' ? options.remainingDebt : this.getCustomerDebt(customer.id)
                        });
                    }
                }

                return receipt;
            }

            getDefaultExpenseCategories() {
                return ['Lương', 'Thuê kho', 'Chi phí mua hàng', 'Vận chuyển', 'Marketing', 'Điện nước', 'Văn phòng phẩm', 'Bảo trì', 'Khác'];
            }

            getExpenseCategories() {
                const categories = Array.isArray(this.demoData.expenseCategories) ? this.demoData.expenseCategories : [];
                const fromExpenses = (this.demoData.expenses || []).map(expense => expense.category).filter(Boolean);
                return Array.from(new Set([...this.getDefaultExpenseCategories(), ...categories, ...fromExpenses]));
            }

            getExpensesInRange(fromDate, toDate) {
                const startDate = fromDate ? new Date(fromDate) : null;
                const endDate = toDate ? new Date(toDate) : null;
                if (endDate) endDate.setHours(23, 59, 59, 999);

                return (this.demoData.expenses || []).filter(expense => {
                    const expenseDate = new Date(expense.date);
                    if (startDate && expenseDate < startDate) return false;
                    if (endDate && expenseDate > endDate) return false;
                    return true;
                });
            }

            formatDateInputValue(date) {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            }

            getProductExpiryInfo(product) {
                if (!product.expiryDate) return null;
                const today = this.getVietnamTime();
                today.setHours(0, 0, 0, 0);
                const expiry = new Date(product.expiryDate);
                expiry.setHours(0, 0, 0, 0);
                const diffTime = expiry - today;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                const diffMonths = diffDays / 30;
                const displayDate = expiry.toLocaleDateString('vi-VN');

                if (diffDays < 0) {
                    return { statusText: `Đã hết hạn ${Math.abs(diffDays)} ngày`, statusColor: '#dc2626', statusIcon: '🔴', displayDate, diffDays, expired: true };
                } else if (diffDays === 0) {
                    return { statusText: 'Hết hạn hôm nay!', statusColor: '#dc2626', statusIcon: '🔴', displayDate, diffDays, expired: true };
                } else if (diffMonths <= 1) {
                    return { statusText: `Còn ${diffDays} ngày`, statusColor: '#ea580c', statusIcon: '🟠', displayDate, diffDays, expired: false };
                } else if (diffMonths <= 3) {
                    return { statusText: `Còn ${Math.floor(diffMonths)} tháng ${diffDays % 30} ngày`, statusColor: '#f59e0b', statusIcon: '🟡', displayDate, diffDays, expired: false };
                } else {
                    return { statusText: `Còn ${Math.floor(diffMonths)} tháng`, statusColor: '#10b981', statusIcon: '🟢', displayDate, diffDays, expired: false };
                }
            }

            renderProductExpiryAlerts() {
                const alerts = this.demoData.products
                    .map(product => ({ product, info: this.getProductExpiryInfo(product) }))
                    .filter(({ info }) => info && (info.expired || info.diffDays <= 90))
                    .sort((a, b) => a.info.diffDays - b.info.diffDays);

                if (alerts.length === 0) return '';

                const maxVisible = 6;
                const visibleAlerts = alerts.slice(0, maxVisible);
                const hiddenCount = alerts.length - maxVisible;

                return `
                    <div style="background: linear-gradient(135deg, #fff7ed 0%, #fed7aa 100%); border: 2px solid #ea580c; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                            <div>
                                <h3 style="margin: 0; color: #9a3412; font-size: 18px;">⏰ Nhắc hạn sử dụng sản phẩm</h3>
                                <p style="margin: 4px 0 0 0; color: #9a3412; font-size: 13px;">${alerts.length} sản phẩm đã hết hạn hoặc còn dưới 3 tháng.</p>
                            </div>
                            <button onclick="app.loadPage('products')" style="background: #ea580c; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-weight: 600;">Xem sản phẩm</button>
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 10px;">
                            ${visibleAlerts.map(({ product, info }) => `
                                <div style="background: white; border: 1px solid #fed7aa; border-radius: 8px; padding: 12px;">
                                    <div style="display: flex; justify-content: space-between; gap: 8px; margin-bottom: 6px;">
                                        <strong style="color: #1f2937;">${product.name}</strong>
                                        <span style="color: ${info.statusColor}; font-weight: 700;">${info.statusIcon}</span>
                                    </div>
                                    <div style="font-size: 13px; color: #4b5563;">${product.id} · HSD: ${info.displayDate}</div>
                                    <div style="font-size: 13px; color: ${info.statusColor}; font-weight: 700; margin-top: 4px;">${info.statusText}</div>
                                </div>
                            `).join('')}
                        </div>
                        ${hiddenCount > 0 ? `<div style="text-align: center; margin-top: 10px; font-size: 13px; color: #9a3412;">... và ${hiddenCount} sản phẩm khác</div>` : ''}
                    </div>
                `;
            }

            getExpensePeriodRange(period = 'month') {
                const today = this.getVietnamTime();
                const startDate = new Date(today);
                const endDate = new Date(today);

                if (period === 'all') {
                    return {
                        fromDate: '',
                        toDate: ''
                    };
                }

                if (period === 'day') {
                    return {
                        fromDate: this.formatDateInputValue(today),
                        toDate: this.formatDateInputValue(today)
                    };
                }

                if (period === 'week') {
                    const dayOfWeek = today.getDay();
                    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                    startDate.setDate(today.getDate() - daysFromMonday);
                    return {
                        fromDate: this.formatDateInputValue(startDate),
                        toDate: this.formatDateInputValue(endDate)
                    };
                }

                startDate.setDate(1);
                return {
                    fromDate: this.formatDateInputValue(startDate),
                    toDate: this.formatDateInputValue(endDate)
                };
            }

            getExpensePeriodLabel(period) {
                const labels = {
                    all: 'Tất cả',
                    day: 'Theo ngày',
                    week: 'Theo tuần',
                    month: 'Theo tháng',
                    custom: 'Tùy chỉnh'
                };
                return labels[period] || labels.custom;
            }

            getExpenseRangeText(fromDate, toDate) {
                const fromText = fromDate ? this.formatDateForDisplay(fromDate) : 'đầu dữ liệu';
                const toText = toDate ? this.formatDateForDisplay(toDate) : 'hiện tại';
                return `${fromText} - ${toText}`;
            }

            getExpenseBreakdown(expenses = this.demoData.expenses || []) {
                return expenses.reduce((breakdown, expense) => {
                    const category = expense.category || 'Khác';
                    breakdown[category] = (breakdown[category] || 0) + (Number(expense.amount) || 0);
                    return breakdown;
                }, {});
            }

            renderExpenseBreakdownRows(expenses = this.demoData.expenses || []) {
                const totalExpenses = expenses.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);
                const breakdown = this.getExpenseBreakdown(expenses);

                return Object.entries(breakdown)
                    .sort((a, b) => b[1] - a[1])
                    .map(([category, amount]) => {
                        const percent = totalExpenses > 0 ? (amount / totalExpenses * 100).toFixed(1) : '0.0';
                        return `
                            <div style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
                                <div style="display: flex; justify-content: space-between; gap: 12px; margin-bottom: 6px;">
                                    <strong>${category}</strong>
                                    <span style="font-weight: 700; color: #dc2626;">${amount.toLocaleString('vi-VN')} VNĐ</span>
                                </div>
                                <div style="height: 6px; background: #e5e7eb; border-radius: 3px; overflow: hidden;">
                                    <div style="height: 100%; width: ${percent}%; background: #ef4444;"></div>
                                </div>
                                <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">${percent}% tổng chi phí đang xem</div>
                            </div>
                        `;
                    }).join('') || '<div style="padding: 20px; color: #6b7280; text-align: center;">Chưa có dữ liệu chi phí trong kỳ đang xem</div>';
            }

            getOrderCost(order) {
                return (order.products || []).reduce((sum, product) => {
                    const productDetails = this.demoData.products.find(prod => prod.id === product.id);
                    const importPrice = productDetails ? (Number(productDetails.importPrice) || 0) : 0;
                    return sum + importPrice * (Number(product.quantity) || 0);
                }, 0);
            }

            getOrderRevenueInRange(fromDate, toDate) {
                const startDate = fromDate ? new Date(fromDate) : null;
                const endDate = toDate ? new Date(toDate) : null;
                if (endDate) endDate.setHours(23, 59, 59, 999);

                return (this.demoData.orders || []).reduce((total, order) => {
                    const orderDate = new Date(order.date);
                    if (startDate && orderDate < startDate) return total;
                    if (endDate && orderDate > endDate) return total;
                    return total + (Number(order.total) || 0);
                }, 0);
            }

            getTotalOutstandingDebt(orders = this.demoData.orders || []) {
                return orders.reduce((sum, order) => sum + this.getOrderRemainingBalance(order), 0);
            }

            syncCustomerDebtTotals() {
                if (!Array.isArray(this.demoData.customers) || !Array.isArray(this.demoData.orders)) return false;
                let changed = false;

                this.demoData.customers.forEach(customer => {
                    const actualDebt = this.demoData.orders
                        .filter(order => order.customerId === customer.id || order.customerName === customer.name)
                        .reduce((sum, order) => sum + this.getOrderRemainingBalance(order), 0);

                    if (Number(customer.debt) !== actualDebt) {
                        customer.debt = actualDebt;
                        changed = true;
                    }
                });

                return changed;
            }

            getCollectedAmountInRange(fromDate, toDate) {
                const startDate = fromDate ? new Date(fromDate) : null;
                const endDate = toDate ? new Date(toDate) : null;
                if (endDate) endDate.setHours(23, 59, 59, 999);

                return (this.demoData.orders || []).reduce((total, order) => {
                    if (Array.isArray(order.paymentHistory) && order.paymentHistory.length > 0) {
                        return total + order.paymentHistory.reduce((sum, payment) => {
                            const paymentDate = new Date(payment.date || order.date);
                            if (startDate && paymentDate < startDate) return sum;
                            if (endDate && paymentDate > endDate) return sum;
                            return sum + (Number(payment.amount) || 0);
                        }, 0);
                    }

                    const orderDate = new Date(order.date);
                    const inRange = (!startDate || orderDate >= startDate) && (!endDate || orderDate <= endDate);
                    return inRange && order.paymentStatus === 'Đã thanh toán' ? total + (Number(order.total) || 0) : total;
                }, 0);
            }

            // Clear corrupted data only when localStorage contains invalid JSON
            clearOldDataIfNeeded() {
                const storedData = localStorage.getItem('erp_vietnam_data');
                if (!storedData) {
                    return false;
                }

                try {
                    JSON.parse(storedData);
                    return false;
                } catch (e) {
                    console.log('Invalid localStorage data detected, removing corrupted erp_vietnam_data:', e);
                    localStorage.removeItem('erp_vietnam_data');
                    return true;
                }
            }

            init() {
                console.log('Initializing Vietnamese ERP...');

                // Debug: Show current Vietnam time
                const vietnamTime = this.getVietnamTime();
                console.log('🕐 Thời gian Việt Nam hiện tại:', this.formatVietnameseTime());
                if (this.demoData.orders.length > 0) {
                    console.log('Sample order date:', this.demoData.orders[0].date);
                }

                this.setupNavigation();
                this.setupEventListeners();
                this.loadPage('dashboard');

                // Khởi tạo filter state cho báo cáo
                this.initFilterState();

                // Initialize auto backup if enabled
                if (localStorage.getItem('auto_backup_enabled') === 'true') {
                    this.startAutoBackup();
                }

                // Force refresh activities every time dashboard loads
                console.log('🔄 FORCE REFRESH - Testing getRecentActivities()');
                const testActivities = this.getRecentActivities();
                console.log('🔄 Activities HTML Length:', testActivities.length);

                // Show date debug info to user
                this.showNotification(`Hệ thống khởi tạo lúc: ${this.formatVietnameseTime()}`, 'info');
                console.log('Vietnamese ERP initialized successfully');
            }

            generateDemoData() {
                return {
                    customers: [
                        { id: 'KH001', name: 'Nguyễn Văn A', type: 'ca-nhan', phone: '0901234567', address: 'Số 1, Đường A', province: 'Hà Nội', district: 'Quận Hoàn Kiếm', ward: 'Phường Hàng Bạc', notes: '' },
                        { id: 'KH002', name: 'Trần Thị B', type: 'ca-nhan', phone: '0912345678', address: 'Số 2, Đường B', province: 'TP.HCM', district: 'Quận 1', ward: 'Phường Bến Nghé', notes: '' },
                        { id: 'KH003', name: 'Lê Minh C', type: 'doanh-nghiep', companyName: 'Công ty TNHH Minh Châu', department: 'Phòng mua hàng', phone: '0923456789', address: 'Lô 3, KCN C', province: 'Đà Nẵng', district: 'Quận Hải Châu', ward: 'Phường Thuận Phước', taxCode: '0123456789', notes: '' },
                        { id: 'KH004', name: 'Phạm Thu D', type: 'doanh-nghiep', companyName: 'Công ty Cổ phần Thu Đức', department: 'Phòng kế toán', phone: '0934567890', address: 'Số 4, Đường D', province: 'Cần Thơ', district: 'Quận Ninh Kiều', ward: 'Phường An Cư', taxCode: '0987654321', notes: '' },
                        { id: 'KH005', name: 'Hoàng Văn E', type: 'ca-nhan', phone: '0945678901', address: 'Số 5, Đường E', province: 'Hải Phòng', district: 'Quận Ngô Quyền', ward: 'Phường Máy Tơ', notes: '' }
                    ],
                    suppliers: [
                        { id: 'NCC001', name: 'Công ty TNHH ABC', phone: '024-3456-7890', email: 'abc@company.vn', address: 'Hà Nội', products: 'Điện tử' },
                        { id: 'NCC002', name: 'Công ty XYZ', phone: '028-3456-7891', email: 'xyz@company.vn', address: 'TP.HCM', products: 'Gia dụng' },
                        { id: 'NCC003', name: 'Công ty DEF', phone: '0236-3456-792', email: 'def@company.vn', address: 'Đà Nẵng', products: 'Thời trang' }
                    ],
                    products: [
                        { id: 'SP001', name: 'iPhone 15 Pro', category: 'Điện thoại', price: 28900000, importPrice: 25000000, stock: 5, minStock: 10, supplier: 'NCC001' },
                        { id: 'SP002', name: 'Samsung Galaxy S24', category: 'Điện thoại', price: 24900000, importPrice: 22000000, stock: 100, minStock: 15, supplier: 'NCC001' },
                        { id: 'SP003', name: 'MacBook Air M2', category: 'Laptop', price: 28900000, importPrice: 26000000, stock: 15, minStock: 5, supplier: 'NCC001' },
                        { id: 'SP004', name: 'iPad Pro 11 inch', category: 'Tablet', price: 19900000, importPrice: 18000000, stock: 8, minStock: 12, supplier: 'NCC001' },
                        { id: 'SP005', name: 'AirPods Pro', category: 'Phụ kiện', price: 6490000, importPrice: 5500000, stock: 25, minStock: 20, supplier: 'NCC001' },
                        { id: 'SP006', name: 'Quả bóng đá FIFA', category: 'Sản phẩm > Bóng đá', price: 500000, importPrice: 350000, stock: 50, minStock: 30, supplier: 'NCC002' },
                        { id: 'SP007', name: 'Vợt Pickle Ball Pro', category: 'Sản phẩm > Pickle Ball', price: 800000, importPrice: 650000, stock: 30, minStock: 10, supplier: 'NCC002' }
                    ],
                    categories: [
                        { id: 'CAT001', name: 'Sản phẩm', parent: null },
                        { id: 'CAT002', name: 'Bóng đá', parent: 'CAT001' },
                        { id: 'CAT003', name: 'Pickle Ball', parent: 'CAT001' },
                        { id: 'CAT004', name: 'Điện thoại', parent: null },
                        { id: 'CAT005', name: 'Laptop', parent: null },
                        { id: 'CAT006', name: 'Tablet', parent: null },
                        { id: 'CAT007', name: 'Phụ kiện', parent: null }
                    ],
                    orders: this.generateOrdersWithCurrentDate(),
                    expenses: [],
                    expenseCategories: this.getDefaultExpenseCategories(),
                    purchases: [
                        {
                            id: 'PH001',
                            supplierId: 'NCC001',
                            supplierName: 'Công ty TNHH ABC',
                            date: this.getVietnamTime().toISOString().split('T')[0],
                            products: [
                                { name: 'iPhone 15 Pro', quantity: 2, price: 25000000 }
                            ],
                            total: 50000000,
                            status: 'Đang chờ',
                            paymentStatus: 'Chưa thanh toán'
                        },
                        {
                            id: 'PH002',
                            supplierId: 'NCC002',
                            supplierName: 'Công ty XYZ',
                            date: this.getVietnamTime().toISOString().split('T')[0],
                            products: [
                                { name: 'Quả bóng đá FIFA', quantity: 10, price: 350000 }
                            ],
                            total: 3500000,
                            status: 'Đã nhận hàng',
                            paymentStatus: 'Đã thanh toán'
                        }
                    ],
                    sales: this.generateSalesWithCurrentDate(),
                    debts: [],
                    inventoryHistory: [],
                    deliveries: []
                };
            }

            // Tạo orders với ngày hiện tại (giờ Việt Nam)
            generateOrdersWithCurrentDate() {
                const today = this.getVietnamTime();
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);
                const twoDaysAgo = new Date(today);
                twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
                const threeDaysAgo = new Date(today);
                threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
                const fourDaysAgo = new Date(today);
                fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);

                return [
                    // Đơn hàng từ khách hàng doanh nghiệp - để test hiển thị
                    { 
                        id: 'DH007', 
                        customerId: 'KH003', 
                        customerName: 'Lê Minh C',
                        date: today.toISOString().split('T')[0], 
                        time: '17:30',
                        products: [
                            { id: 'SP003', name: 'MacBook Air M2', quantity: 2, price: 28900000 }
                        ],
                        total: 57800000,
                        status: 'Mới',
                        paymentMethod: 'Chuyển khoản',
                        paymentStatus: 'Công nợ'
                    },
                    // Đơn hàng mới nhất trước (hôm nay)
                    { 
                        id: 'DH006', 
                        customerId: 'KH001', 
                        customerName: 'Nguyễn Văn A',
                        date: today.toISOString().split('T')[0], 
                        time: '16:45',
                        products: [
                            { id: 'SP001', name: 'iPhone 15 Pro', quantity: 1, price: 28900000 }
                        ],
                        total: 28900000,
                        status: 'Mới',
                        paymentMethod: 'Chuyển khoản',
                        paymentStatus: 'Công nợ'
                    },
                    { 
                        id: 'DH002', 
                        customerId: 'KH002', 
                        customerName: 'Trần Thị B',
                        date: today.toISOString().split('T')[0], 
                        time: '14:15',
                        products: [
                            { id: 'SP002', name: 'Samsung Galaxy S24', quantity: 1, price: 24900000 }
                        ],
                        total: 24900000,
                        status: 'Đang xử lý',
                        paymentMethod: 'Tiền mặt',
                        paymentStatus: 'Công nợ'
                    },
                    { 
                        id: 'DH001', 
                        customerId: 'KH001', 
                        customerName: 'Nguyễn Văn A',
                        date: today.toISOString().split('T')[0], 
                        time: '10:30',
                        products: [
                            { id: 'SP001', name: 'iPhone 15 Pro', quantity: 1, price: 28900000 },
                            { id: 'SP005', name: 'AirPods Pro', quantity: 1, price: 6490000 }
                        ],
                        total: 35390000,
                        status: 'Hoàn thành',
                        paymentMethod: 'Chuyển khoản',
                        paymentStatus: 'Đã thanh toán'
                    },
                    { 
                        id: 'DH003', 
                        customerId: 'KH003', 
                        customerName: 'Lê Minh C',
                        date: yesterday.toISOString().split('T')[0], 
                        time: '16:45',
                        products: [
                            { id: 'SP003', name: 'MacBook Air M2', quantity: 1, price: 28900000 },
                            { id: 'SP004', name: 'iPad Pro 11 inch', quantity: 1, price: 19900000 }
                        ],
                        total: 48800000,
                        status: 'Hoàn thành',
                        paymentMethod: 'Chuyển khoản',
                        paymentStatus: 'Đã thanh toán'
                    },
                    { 
                        id: 'DH004', 
                        customerId: 'KH004', 
                        customerName: 'Phạm Thu D',
                        date: twoDaysAgo.toISOString().split('T')[0], 
                        time: '09:20',
                        products: [
                            { id: 'SP006', name: 'Quả bóng đá FIFA', quantity: 2, price: 500000 }
                        ],
                        total: 1000000,
                        status: 'Đã giao',
                        paymentMethod: 'Tiền mặt',
                        paymentStatus: 'Công nợ'
                    },
                    { 
                        id: 'DH005', 
                        customerId: 'KH005', 
                        customerName: 'Hoàng Văn E',
                        date: threeDaysAgo.toISOString().split('T')[0], 
                        time: '11:30',
                        products: [
                            { id: 'SP007', name: 'Vợt Pickle Ball Pro', quantity: 1, price: 800000 },
                            { id: 'SP005', name: 'AirPods Pro', quantity: 2, price: 6490000 }
                        ],
                        total: 13780000,
                        status: 'Hủy',
                        paymentMethod: 'Chuyển khoản',
                        paymentStatus: 'Công nợ'
                    }
                ];
            }

            // Tạo sales với ngày hiện tại (giờ Việt Nam)
            generateSalesWithCurrentDate() {
                const today = this.getVietnamTime();
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);
                const twoDaysAgo = new Date(today);
                twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

                return [
                    { id: 'DH001', date: today.toISOString().split('T')[0], customer: 'Nguyễn Văn A', total: 2500000, status: 'Hoàn thành', items: 3 },
                    { id: 'DH002', date: today.toISOString().split('T')[0], customer: 'Trần Thị B', total: 1800000, status: 'Chờ xử lý', items: 2 },
                    { id: 'DH003', date: yesterday.toISOString().split('T')[0], customer: 'Lê Minh C', total: 3200000, status: 'Đang giao', items: 4 },
                    { id: 'DH004', date: yesterday.toISOString().split('T')[0], customer: 'Phạm Thu D', total: 950000, status: 'Hoàn thành', items: 1 },
                    { id: 'DH005', date: twoDaysAgo.toISOString().split('T')[0], customer: 'Hoàng Văn E', total: 4200000, status: 'Hoàn thành', items: 5 }
                ];
            }

            // Helper function để lấy thời gian Việt Nam (UTC+7)
            getVietnamTime() {
                const now = new Date();
                // Lấy thời gian hiện tại theo múi giờ Việt Nam (Asia/Ho_Chi_Minh)
                return new Date(now.toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"}));
            }

            // Tính toán khoảng thời gian từ thời điểm hiện tại
            getTimeAgo(pastTime) {
                const now = this.getVietnamTime();
                const diff = now.getTime() - pastTime.getTime();
                const minutes = Math.floor(diff / (1000 * 60));
                const hours = Math.floor(minutes / 60);
                const days = Math.floor(hours / 24);

                if (minutes < 1) return "Vừa xong";
                if (minutes < 60) return `${minutes} phút trước`;
                if (hours < 24) return `${hours} giờ trước`;
                if (days < 30) return `${days} ngày trước`;
                return pastTime.toLocaleDateString('vi-VN');
            }

            // Tạo thời gian hoạt động thực tế
            generateRealisticActivityTimes() {
                const now = this.getVietnamTime();
                return [
                    new Date(now.getTime() - 10 * 60 * 1000), // 10 phút trước
                    new Date(now.getTime() - 25 * 60 * 1000), // 25 phút trước  
                    new Date(now.getTime() - 1 * 60 * 60 * 1000), // 1 giờ trước
                    new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2 giờ trước
                    new Date(now.getTime() - 3 * 60 * 60 * 1000), // 3 giờ trước
                ];
            }

            // Format hiển thị thời gian Việt Nam đẹp
            formatVietnameseTime(date = null) {
                const targetDate = date || this.getVietnamTime();
                return targetDate.toLocaleString('vi-VN', { 
                    timeZone: 'Asia/Ho_Chi_Minh',
                    year: 'numeric',
                    month: '2-digit', 
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                });
            }

            // Format thời gian hiện tại dạng HH:MM
            formatTimeNow() {
                const now = this.getVietnamTime();
                return now.toLocaleString('vi-VN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'Asia/Ho_Chi_Minh'
                });
            }

            // Thêm mục lịch sử kho hàng
            addInventoryHistory(entry) {
                if (!this.demoData.inventoryHistory) {
                    this.demoData.inventoryHistory = [];
                }

                const historyEntry = {
                    id: `IH${Date.now()}`,
                    ...entry,
                    timestamp: new Date().toISOString()
                };

                // Thêm vào đầu mảng (mới nhất ở trên)
                this.demoData.inventoryHistory.unshift(historyEntry);
                console.log('📝 Lịch sử kho được thêm:', historyEntry);
            }

            // Helper function để sắp xếp đơn hàng theo ngày mới nhất
            sortOrdersByDate(orders) {
                return [...orders].sort((a, b) => {
                    // Tạo đối tượng Date để so sánh
                    const dateA = new Date(a.date + (a.time ? ' ' + a.time : ' 00:00:00'));
                    const dateB = new Date(b.date + (b.time ? ' ' + b.time : ' 00:00:00'));

                    // Nếu không parse được date, dùng fallback
                    const timeA = isNaN(dateA.getTime()) ? new Date(a.date).getTime() : dateA.getTime();
                    const timeB = isNaN(dateB.getTime()) ? new Date(b.date).getTime() : dateB.getTime();

                    return timeB - timeA; // Mới nhất lên trên
                });
            }

            // Tạo danh sách hoạt động với thời gian thực (UNUSED - dùng getRecentActivities thay thế)
            generateActivityItems() {
                const activityTimes = this.generateRealisticActivityTimes();
                console.log('🕐 Thời gian hoạt động:', activityTimes.map(t => this.getTimeAgo(t)));
                return `
                        <div class="activity-item">
                            <div class="activity-icon success">💰</div>
                            <div class="activity-content">
                                <div class="activity-title">Đơn hàng DH001 đã hoàn thành</div>
                                <div class="activity-desc">Khách hàng Nguyễn Văn A đã thanh toán đơn hàng 2.500.000 VNĐ</div>
                            </div>
                            <div class="activity-time">${this.getTimeAgo(activityTimes[0])}</div>
                        </div>

                        <div class="activity-item">
                            <div class="activity-icon info">📋</div>
                            <div class="activity-content">
                                <div class="activity-title">Đơn hàng mới DH002</div>
                                <div class="activity-desc">Khách hàng Trần Thị B đặt hàng trị giá 1.800.000 VNĐ</div>
                            </div>
                            <div class="activity-time">${this.getTimeAgo(activityTimes[1])}</div>
                        </div>

                        <div class="activity-item">
                            <div class="activity-icon warning">⚠️</div>
                            <div class="activity-content">
                                <div class="activity-title">Sản phẩm sắp hết hàng</div>
                                <div class="activity-desc">iPhone 15 Pro chỉ còn 5 sản phẩm trong kho</div>
                            </div>
                            <div class="activity-time">${this.getTimeAgo(activityTimes[2])}</div>
                        </div>

                        <div class="activity-item">
                            <div class="activity-icon success">👥</div>
                            <div class="activity-content">
                                <div class="activity-title">Khách hàng mới</div>
                                <div class="activity-desc">Lê Minh C đã đăng ký làm khách hàng</div>
                            </div>
                            <div class="activity-time">${this.getTimeAgo(activityTimes[3])}</div>
                        </div>

                        <div class="activity-item">
                            <div class="activity-icon info">📦</div>
                            <div class="activity-content">
                                <div class="activity-title">Nhập kho hoàn thành</div>
                                <div class="activity-desc">Đã nhập 100 sản phẩm Samsung Galaxy S24 vào kho</div>
                            </div>
                            <div class="activity-time">${this.getTimeAgo(activityTimes[4])}</div>
                        </div>
                `;
            }

            // Force refresh activities
            refreshActivities() {
                const container = document.getElementById('activities-container');
                if (container) {
                    console.log('🔄 Refreshing activities at:', this.formatVietnameseTime());
                    const newContent = this.getRecentActivities();
                    container.innerHTML = newContent;
                    console.log('✅ Activities manually refreshed at:', this.formatVietnameseTime());
                    this.showNotification(`Đã cập nhật lúc ${this.formatVietnameseTime()}`, 'success');
                }
            }

            setupNavigation() {
                const navItems = document.querySelectorAll('.nav-item');
                console.log('Setting up navigation for', navItems.length, 'items');
                navItems.forEach(item => {
                    item.addEventListener('click', (e) => {
                        e.preventDefault();
                        const page = item.getAttribute('data-page');
                        console.log('Navigation clicked:', page);
                        this.loadPage(page);
                        this.setActiveNav(item);
                    });
                });
            }

            setupEventListeners() {
                // Mobile menu toggle (if needed)
                document.addEventListener('click', (e) => {
                    const actionButton = e.target.closest('.action-button');
                    if (actionButton && !actionButton.hasAttribute('onclick')) {
                        const title = actionButton.querySelector('.action-title').textContent;
                        this.showNotification(`Chức năng "${title}" sẽ được phát triển trong phiên bản tới`, 'info');
                    }
                });
            }

            setActiveNav(activeItem) {
                document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
                activeItem.classList.add('active');
            }

            loadPage(pageName) {
                console.log('📄 Loading page:', pageName);
                this.currentPage = pageName;

                // FORCE reload toàn bộ dữ liệu từ localStorage
                console.log('🔄 FORCE RELOADING DATA FOR PAGE:', pageName);
                this.initializeData();

                const content = this.getPageContent(pageName);
                const titles = this.getPageTitles(pageName);

                document.getElementById('page-title').textContent = titles.title;
                document.getElementById('page-subtitle').textContent = titles.subtitle;
                document.getElementById('main-content').innerHTML = content;

                // Add fade in animation
                document.getElementById('main-content').classList.add('fade-in');
                setTimeout(() => {
                    document.getElementById('main-content').classList.remove('fade-in');

                    // Restore logo/QR for company-info page
                    if (pageName === 'company-info') {
                        this.restoreLogoAndQR();
                    }
                }, 500);
                console.log('✅ Page loaded with FRESH data:', pageName);
            }

            getPageTitles(pageName) {
                const titles = {
                    dashboard: { title: 'Hệ thống Quản lý', subtitle: 'Quản lý bán hàng doanh nghiệp Việt Nam' },
                    customers: { title: 'Quản lý Khách hàng', subtitle: 'Danh sách và thông tin khách hàng' },
                    suppliers: { title: 'Quản lý Nhà cung cấp', subtitle: 'Danh sách và thông tin nhà cung cấp' },
                    products: { title: 'Quản lý Sản phẩm', subtitle: 'Danh mục và kho hàng sản phẩm' },
                    categories: { title: 'Quản lý Danh mục', subtitle: 'Quản lý danh mục sản phẩm phân cấp' },
                    inventory: { title: 'Quản lý Kho hàng', subtitle: 'Theo dõi tồn kho và nhập xuất' },
                    'inventory-history': { title: 'Lịch sử Kho hàng', subtitle: 'Theo dõi lịch sử thay đổi tồn kho' },
                    'inventory-flow': { title: 'Lưu lượng Tồn kho', subtitle: 'Phân tích chi tiết lưu lượng nhập, giao, xuất' },
                    purchases: { title: 'Quản lý Mua hàng', subtitle: 'Đơn mua và nhập hàng từ nhà cung cấp' },
                    expenses: { title: 'Quản lý Chi phí', subtitle: 'Ghi nhận lương, thuê kho và chi phí vận hành' },
                    debts: { title: 'Quản lý Công nợ', subtitle: 'Theo dõi công nợ khách hàng và nhà cung cấp' },
                    reports: { title: 'Báo cáo Tổng hợp', subtitle: 'Báo cáo doanh thu và hoạt động kinh doanh' },
                    settings: { title: 'Cài đặt Hệ thống', subtitle: 'Cấu hình và sao lưu dữ liệu' }
                };
                return titles[pageName] || titles.dashboard;
            }

            getPageContent(pageName) {
                switch(pageName) {
                    case 'customers':
                        return this.getCustomersContent();
                    case 'suppliers':
                        return this.getSuppliersContent();
                    case 'products':
                        return this.getProductsContent();
                    case 'inventory':
                        return this.getInventoryContent();
                    case 'inventory-history':
                        return this.getInventoryHistoryContent();
                    case 'inventory-flow':
                        return this.getInventoryFlowContent();
                    case 'purchases':
                        return this.getPurchasesContent();
                    case 'expenses':
                        return this.getExpensesContent();
                    case 'categories':
                        return this.getCategoriesContent();
                    case 'debts':
                        return this.getDebtsContent();
                    case 'payment-history':
                        return this.getPaymentTransactionHistoryContent();
                    case 'orders':
                        return this.getOrdersContent();
                    case 'reports':
                        return this.getReportsContent();
                    case 'settings':
                        return this.getSettingsContent();
                    case 'company-info':
                        return this.getCompanyInfoContent();
                    default:
                        return this.getDashboardContent();
                }
            }

            getDashboardContent() {
                const totalRevenue = Array.isArray(this.demoData.sales) ? this.demoData.sales.reduce((sum, sale) => sum + (sale.total || 0), 0) : 0;
                const totalOrders = Array.isArray(this.demoData.orders) ? this.demoData.orders.length : 0;

                return `
                    <div class="fade-in">
                        <!-- Stats Grid -->
                        <div class="stats-grid">
                            <div class="stat-card revenue">
                                <div class="stat-header">
                                    <span class="stat-title">Doanh thu hôm nay</span>
                                    <span class="stat-icon">💰</span>
                                </div>
                                <div class="stat-value">${totalRevenue.toLocaleString('vi-VN')} VNĐ</div>
                                <div class="stat-change positive">↗ +12.5% so với hôm qua</div>
                            </div>

                            <div class="stat-card orders">
                                <div class="stat-header">
                                    <span class="stat-title">Đơn hàng mới</span>
                                    <span class="stat-icon">📋</span>
                                </div>
                                <div class="stat-value">${totalOrders}</div>
                                <div class="stat-change positive">↗ +8.2% so với hôm qua</div>
                            </div>

                            <div class="stat-card customers">
                                <div class="stat-header">
                                    <span class="stat-title">Khách hàng</span>
                                    <span class="stat-icon">👥</span>
                                </div>
                                <div class="stat-value">${this.demoData.customers.length}</div>
                                <div class="stat-change positive">↗ +5.1% so với tuần trước</div>
                            </div>

                            <div class="stat-card products">
                                <div class="stat-header">
                                    <span class="stat-title">Sản phẩm</span>
                                    <span class="stat-icon">📦</span>
                                </div>
                                <div class="stat-value">${this.demoData.products.length}</div>
                                <div class="stat-change positive">↗ +2.3% so với tuần trước</div>
                            </div>
                        </div>

                        ${this.renderProductExpiryAlerts()}

                        <!-- Quick Actions -->
                        <div class="quick-actions">
                            <h2 class="section-title">Thao tác nhanh</h2>
                            <div class="action-grid">
                                <div class="action-button" onclick="console.log('CLICKED: Tạo đơn bán hàng - FORM MỚI #2'); app.showCreateOrderForm();">
                                    <div class="action-icon">📝</div>
                                    <div class="action-title">Tạo đơn bán hàng</div>
                                    <div class="action-desc">Form mới với chiết khấu từng sản phẩm</div>
                                </div>

                                <div class="action-button" onclick="app.showAddCustomerForm()">
                                    <div class="action-icon">👤</div>
                                    <div class="action-title">Thêm khách hàng</div>
                                    <div class="action-desc">Thêm thông tin khách hàng mới</div>
                                </div>

                                <div class="action-button" onclick="app.showAddProductForm()">
                                    <div class="action-icon">📦</div>
                                    <div class="action-title">Thêm sản phẩm</div>
                                    <div class="action-desc">Thêm sản phẩm mới vào kho</div>
                                </div>

                                <div class="action-button" onclick="app.loadPage('reports')">
                                    <div class="action-icon">📊</div>
                                    <div class="action-title">Xem báo cáo</div>
                                    <div class="action-desc">Báo cáo doanh thu và bán hàng</div>
                                </div>

                                <div class="action-button" onclick="app.resetDashboardMetrics()">
                                    <div class="action-icon">🔄</div>
                                    <div class="action-title">Đặt lại Dashboard</div>
                                    <div class="action-desc">Reset doanh thu và đơn hàng về 0</div>
                                </div>

                            </div>
                        </div>

                        <!-- Recent Activity -->
                        <div class="recent-activity">
                            <h2 class="section-title">Hoạt động gần đây 
                                <button onclick="app.refreshActivities()" style="background: #059669; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px; margin-left: 8px;" title="Nhấn để cập nhật thời gian thực">🔄 REFRESH</button>
                                <span style="font-size: 12px; color: #666; margin-left: 8px;">[${this.formatVietnameseTime()}]</span>
                            </h2>
                            <div id="activities-container" data-timestamp="${Date.now()}">
                                ${this.getRecentActivities()}
                            </div>
                        </div>
                    </div>
                `;
            }

            getCustomersContent() {
                const customersTable = this.demoData.customers.map((customer, index) => {
                    // Xác định loại khách hàng và icon tương ứng
                    const typeDisplay = customer.type === 'doanh-nghiep' ? '🏢 Doanh nghiệp' : '👤 Cá nhân';
                    const iconClass = customer.type === 'doanh-nghiep' ? 'warning' : 'info';
                    const iconSymbol = customer.type === 'doanh-nghiep' ? '🏢' : '👤';

                    // Thông tin bổ sung cho doanh nghiệp
                    const companyInfo = customer.type === 'doanh-nghiep' && customer.companyName ? 
                        ` | Công ty: ${customer.companyName}` : '';
                    const departmentInfo = customer.type === 'doanh-nghiep' && customer.department ? 
                        ` | Phòng ban: ${customer.department}` : '';
                    const taxCodeInfo = customer.type === 'doanh-nghiep' && customer.taxCode ? 
                        ` | MST: ${customer.taxCode}` : '';

                    return `
                        <div class="activity-item">
                            <div class="activity-icon ${iconClass}">${iconSymbol}</div>
                            <div class="activity-content">
                                <div class="activity-title">${customer.name} (${customer.id})</div>
                                <div class="activity-desc">${typeDisplay}${companyInfo}${departmentInfo}${taxCodeInfo}</div>
                                <div class="activity-desc">📞 ${customer.phone} | � ${customer.address}${customer.ward ? ', ' + customer.ward : ''}${customer.district ? ', ' + customer.district : ''}${customer.province ? ', ' + customer.province : ''}</div>
                            </div>
                            <div style="display: flex; gap: 8px; align-items: center;">
                                <div class="activity-time">${customer.type === 'doanh-nghiep' ? 'Doanh nghiệp' : 'Cá nhân'}</div>
                                <button onclick="app.showCustomerDetails(${index})" style="background: #059669; color: white; padding: 4px 8px; border: none; border-radius: 4px; cursor: pointer;">Chi tiết</button>
                                <button onclick="app.editCustomer(${index})" style="background: #3b82f6; color: white; padding: 4px 8px; border: none; border-radius: 4px; cursor: pointer;">Sửa</button>
                                <button onclick="app.deleteCustomer(${index})" style="background: #ef4444; color: white; padding: 4px 8px; border: none; border-radius: 4px; cursor: pointer;">Xóa</button>
                            </div>
                        </div>
                    `;
                }).join('');

                return `
                    <div class="fade-in">
                        <div class="quick-actions">
                            <h2 class="section-title">Danh sách Khách hàng (${this.demoData.customers.length})</h2>
                            <div class="action-grid" style="margin-bottom: 24px;">
                                <div class="action-button" onclick="app.showAddCustomerForm()">
                                    <div class="action-icon">👤➕</div>
                                    <div class="action-title">Thêm khách hàng</div>
                                </div>
                                <div class="action-button" onclick="app.showSearchCustomer()">
                                    <div class="action-icon">🔍</div>
                                    <div class="action-title">Tìm kiếm</div>
                                </div>
                                <div class="action-button" onclick="app.exportCustomers()">
                                    <div class="action-icon">📊</div>
                                    <div class="action-title">Xuất báo cáo</div>
                                </div>
                                <div class="action-button" onclick="app.showUploadCustomersForm()">
                                    <div class="action-icon">📤</div>
                                    <div class="action-title">Upload Excel</div>
                                </div>
                                <div class="action-button" onclick="app.deleteAllCustomers()">
                                    <div class="action-icon">🗑️</div>
                                    <div class="action-title">Xóa tất cả</div>
                                </div>
                            </div>

                            <!-- Search Box -->
                            <div id="search-box" style="display: none; margin-bottom: 20px;">
                                <input type="text" id="customer-search" placeholder="Tìm theo tên, điện thoại, địa chỉ, tỉnh/quận/phường..." 
                                       style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 16px;"
                                       onkeyup="app.searchCustomers(this.value)">
                            </div>

                            <div id="customers-list">
                                ${customersTable}
                            </div>
                        </div>
                    </div>
                `;
            }

            getSuppliersContent() {
                const suppliersTable = this.demoData.suppliers.map((supplier, index) => {
                    const typeDisplay = supplier.type === 'doanh-nghiep' ? '🏢 Doanh nghiệp' : '👤 Cá nhân';
                    const taxDisplay = supplier.taxCode ? ` | 🆔 MST: ${supplier.taxCode}` : '';
                    const codeDisplay = supplier.supplierCode ? ` | 📋 Mã: ${supplier.supplierCode}` : '';
                    const bankDisplay = supplier.bankAccount ? ` | 🏦 ${supplier.bankName}` : '';

                    return `
                        <div class="activity-item">
                            <div class="activity-icon ${supplier.type === 'doanh-nghiep' ? 'warning' : 'success'}">🏢</div>
                            <div class="activity-content">
                                <div class="activity-title">${supplier.name} (${supplier.id})</div>
                                <div class="activity-desc">${typeDisplay}${codeDisplay}${taxDisplay}</div>
                                <div class="activity-desc">📞 ${supplier.phone} | 📧 ${supplier.email || 'Chưa có'}${bankDisplay}</div>
                                ${supplier.notes ? `<div class="activity-desc">📝 ${supplier.notes}</div>` : ''}
                            </div>
                            <div style="display: flex; gap: 8px; align-items: center;">
                                <div class="activity-time">${supplier.products}</div>
                                <button onclick="app.editSupplier(${index})" style="background: var(--primary-blue); color: white; padding: 4px 8px; border: none; border-radius: 4px; cursor: pointer;">Sửa</button>
                                <button onclick="app.deleteSupplier(${index})" style="background: #ef4444; color: white; padding: 4px 8px; border: none; border-radius: 4px; cursor: pointer;">Xóa</button>
                            </div>
                        </div>
                    `;
                }).join('');

                return `
                    <div class="fade-in">
                        <div class="quick-actions">
                            <h2 class="section-title">Danh sách Nhà cung cấp (${this.demoData.suppliers.length})</h2>
                            <div class="action-grid" style="margin-bottom: 24px;">
                                <div class="action-button" onclick="app.showAddSupplierForm()">
                                    <div class="action-icon">🏢➕</div>
                                    <div class="action-title">Thêm nhà cung cấp</div>
                                </div>
                                <div class="action-button" onclick="app.showSupplierSearch()">
                                    <div class="action-icon">🔍</div>
                                    <div class="action-title">Tìm kiếm</div>
                                </div>
                                <div class="action-button" onclick="app.showCreatePurchaseForm()">
                                    <div class="action-icon">🛒</div>
                                    <div class="action-title">Tạo đơn mua</div>
                                </div>
                                <div class="action-button" onclick="app.deleteAllSuppliers()">
                                    <div class="action-icon">🗑️</div>
                                    <div class="action-title">Xóa tất cả</div>
                                </div>
                            </div>
                            ${suppliersTable}
                        </div>
                    </div>
                `;
            }

            getProductsContent() {
                const productsTable = this.demoData.products.map((product, index) => {
                    const expiryInfo = this.getProductExpiryInfo(product);
                    return `
                    <div class="activity-item" ondblclick="app.showEditProductForm('${product.id}')" title="Nhấp đúp để chỉnh sửa sản phẩm" style="cursor: pointer;">
                        <div class="activity-icon ${product.stock < 10 ? 'warning' : 'success'}">📦</div>
                        <div class="activity-content">
                            <div class="activity-title">${product.name} (${product.id})</div>
                            <div class="activity-desc">💰 Bán: ${product.price.toLocaleString('vi-VN')} VNĐ | 💸 Nhập: ${product.importPrice?.toLocaleString('vi-VN') || 'N/A'} VNĐ | 📂 ${product.category}</div>
                            <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">📥 Đã mua: ${product.purchasedQty || 0} | 📤 Đã bán: ${product.soldQty || 0}</div>
                            ${expiryInfo ? `<div style="font-size: 12px; color: ${expiryInfo.statusColor}; margin-top: 4px; font-weight: 600;">${expiryInfo.statusIcon} HSD: ${expiryInfo.displayDate} · ${expiryInfo.statusText}</div>` : '<div style="font-size: 12px; color: #6b7280; margin-top: 4px;">⏳ HSD: Chưa nhập</div>'}
                        </div>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <div class="activity-time">Tồn: ${product.stock} ${product.stock < 10 ? '⚠️' : '✅'}</div>
                            <button onclick="event.stopPropagation(); app.deleteProduct(${index})" ondblclick="event.stopPropagation()" style="background: #ef4444; color: white; padding: 4px 8px; border: none; border-radius: 4px; cursor: pointer;">Xóa</button>
                        </div>
                    </div>
                `;
                }).join('');

                return `
                    <div class="fade-in">
                        <div class="stats-grid" style="margin-bottom: 24px;">
                            <div class="stat-card products">
                                <div class="stat-header">
                                    <span class="stat-title">Tổng sản phẩm</span>
                                    <span class="stat-icon">📦</span>
                                </div>
                                <div class="stat-value">${this.demoData.products.length}</div>
                                <div class="stat-change positive">Đang kinh doanh</div>
                            </div>

                            <div class="stat-card warning">
                                <div class="stat-header">
                                    <span class="stat-title">Sắp hết hàng</span>
                                    <span class="stat-icon">⚠️</span>
                                </div>
                                <div class="stat-value">${this.demoData.products.filter(p => p.stock < 10).length}</div>
                                <div class="stat-change negative">Cần nhập thêm</div>
                            </div>
                        </div>

                        <div class="quick-actions">
                            <h2 class="section-title">Danh sách Sản phẩm</h2>
                            <div class="action-grid" style="margin-bottom: 24px; grid-template-columns: repeat(5, 1fr);">
                                <div class="action-button" onclick="app.showAddProductForm()">
                                    <div class="action-icon">📦➕</div>
                                    <div class="action-title">Thêm sản phẩm</div>
                                </div>
                                <div class="action-button" onclick="app.showUpdatePriceForm()">
                                    <div class="action-icon">💰</div>
                                    <div class="action-title">Cập nhật giá</div>
                                </div>
                                <div class="action-button" onclick="app.showStockUpdateForm()">
                                    <div class="action-icon">📊</div>
                                    <div class="action-title">Nhập kho</div>
                                </div>
                                <div class="action-button" onclick="app.backupProductsToExcel()">
                                    <div class="action-icon">📥</div>
                                    <div class="action-title">Backup Excel</div>
                                </div>
                                <div class="action-button" onclick="app.showUploadProductsForm()">
                                    <div class="action-icon">📤</div>
                                    <div class="action-title">Upload Excel</div>
                                </div>
                                <div class="action-button" onclick="app.deleteAllProducts()">
                                    <div class="action-icon">🗑️</div>
                                    <div class="action-title">Xóa tất cả</div>
                                </div>
                            </div>
                            ${productsTable}
                        </div>
                    </div>
                `;
            }

            getInventoryContent() {
                // Tính toán các thống kê tồn kho
                const totalValue = this.demoData.products.reduce((sum, p) => sum + (p.stock * p.importPrice), 0);
                const lowStockProducts = this.demoData.products.filter(p => p.stock <= p.minStock);
                const outOfStockProducts = this.demoData.products.filter(p => p.stock === 0);
                const overStockProducts = this.demoData.products.filter(p => p.stock > p.minStock * 3);

                return `
                    <div class="fade-in">
                        <!-- Cảnh báo hàng sắp hết -->
                        ${lowStockProducts.length > 0 ? `
                        <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 2px solid #f59e0b; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                                <span style="font-size: 24px;">⚠️</span>
                                <div>
                                    <h3 style="margin: 0; color: #92400e; font-size: 18px;">Cảnh báo: ${lowStockProducts.length} sản phẩm sắp hết hàng!</h3>
                                    <p style="margin: 4px 0 0 0; color: #a16207; font-size: 14px;">Các sản phẩm dưới đây đã dưới ngưỡng tồn kho tối thiểu</p>
                                </div>
                            </div>
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 12px;">
                                ${lowStockProducts.map(p => `
                                    <div style="background: white; padding: 12px; border-radius: 8px; border: 1px solid #f59e0b;">
                                        <div style="font-weight: 600; color: #1f2937; margin-bottom: 4px;">${p.name}</div>
                                        <div style="color: #ef4444; font-size: 14px;">Tồn: ${p.stock} / Tối thiểu: ${p.minStock}</div>
                                        <div style="color: #6b7280; font-size: 12px;">Cần nhập: ${p.minStock - p.stock + 10} sản phẩm</div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        ` : ''}

                        <div class="stats-grid" style="margin-bottom: 24px;">
                            <div class="stat-card success">
                                <div class="stat-header">
                                    <span class="stat-title">Tổng giá trị kho</span>
                                    <span class="stat-icon">💎</span>
                                </div>
                                <div class="stat-value">${totalValue.toLocaleString('vi-VN')} VNĐ</div>
                                <div class="stat-change positive">${this.demoData.products.length} sản phẩm</div>
                            </div>

                            <div class="stat-card ${lowStockProducts.length > 0 ? 'warning' : 'success'}">
                                <div class="stat-header">
                                    <span class="stat-title">Hàng sắp hết</span>
                                    <span class="stat-icon">⚠️</span>
                                </div>
                                <div class="stat-value">${lowStockProducts.length}</div>
                                <div class="stat-change ${lowStockProducts.length > 0 ? 'negative' : 'positive'}">
                                    ${lowStockProducts.length > 0 ? 'Cần nhập ngay' : 'Tồn kho ổn định'}
                                </div>
                            </div>

                            <div class="stat-card ${outOfStockProducts.length > 0 ? 'danger' : 'info'}">
                                <div class="stat-header">
                                    <span class="stat-title">Hết hàng</span>
                                    <span class="stat-icon">🚫</span>
                                </div>
                                <div class="stat-value">${outOfStockProducts.length}</div>
                                <div class="stat-change ${outOfStockProducts.length > 0 ? 'negative' : 'positive'}">
                                    ${outOfStockProducts.length > 0 ? 'Không thể bán' : 'Không có'}
                                </div>
                            </div>

                            <div class="stat-card info">
                                <div class="stat-header">
                                    <span class="stat-title">Dư thừa</span>
                                    <span class="stat-icon">📈</span>
                                </div>
                                <div class="stat-value">${overStockProducts.length}</div>
                                <div class="stat-change positive">Cân nhắc giảm giá</div>
                            </div>
                        </div>

                        <div class="quick-actions">
                            <h2 class="section-title">Quản lý Tồn kho</h2>
                            <div class="action-grid" style="margin-bottom: 24px;">
                                <div class="action-button" onclick="app.showStockUpdateForm()">
                                    <div class="action-icon">📥</div>
                                    <div class="action-title">Nhập kho</div>
                                </div>
                                <div class="action-button" onclick="app.showStockExportForm()">
                                    <div class="action-icon">📤</div>
                                    <div class="action-title">Xuất kho</div>
                                </div>
                                <div class="action-button" onclick="app.showDeliveryForm()">
                                    <div class="action-icon">🚚</div>
                                    <div class="action-title">Giao hàng</div>
                                </div>
                                <div class="action-button" onclick="app.exportInventoryReport()">
                                    <div class="action-icon">📋</div>
                                    <div class="action-title">Kiểm kê</div>
                                </div>
                                <div class="action-button" onclick="app.deleteAllProducts()">
                                    <div class="action-icon">🗑️</div>
                                    <div class="action-title">Xóa tất cả</div>
                                </div>
                            </div>

                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                                <h3 style="margin: 0; color: var(--text-primary);">Danh sách sản phẩm trong kho</h3>
                                <div style="display: flex; gap: 8px; font-size: 12px;">
                                    <span style="display: flex; align-items: center; gap: 4px;"><span style="width: 8px; height: 8px; background: #ef4444; border-radius: 50%; display: inline-block;"></span>Sắp hết</span>
                                    <span style="display: flex; align-items: center; gap: 4px;"><span style="width: 8px; height: 8px; background: #f59e0b; border-radius: 50%; display: inline-block;"></span>Ít hàng</span>
                                    <span style="display: flex; align-items: center; gap: 4px;"><span style="width: 8px; height: 8px; background: #10b981; border-radius: 50%; display: inline-block;"></span>Đủ hàng</span>
                                </div>
                            </div>

                            <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                                <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 1fr 1fr 100px; gap: 16px; padding: 16px; background: #f8fafc; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">
                                    <div>Sản phẩm</div>
                                    <div>Giá bán</div>
                                    <div>Tồn kho</div>
                                    <div>Tối thiểu</div>
                                    <div>Trạng thái</div>
                                    <div>HSD</div>
                                    <div>Thao tác</div>
                                </div>
                                ${this.demoData.products.map((product, index) => {
                                    const stockStatus = product.stock === 0 ? 'out' : product.stock <= product.minStock ? 'low' : product.stock <= product.minStock * 1.5 ? 'warning' : 'good';
                                    const statusColor = stockStatus === 'out' ? '#ef4444' : stockStatus === 'low' ? '#ef4444' : stockStatus === 'warning' ? '#f59e0b' : '#10b981';
                                    const statusText = stockStatus === 'out' ? 'Hết hàng' : stockStatus === 'low' ? 'Sắp hết' : stockStatus === 'warning' ? 'Ít hàng' : 'Đủ hàng';
                                    const statusIcon = stockStatus === 'out' ? '🚫' : stockStatus === 'low' ? '⚠️' : stockStatus === 'warning' ? '⚡' : '✅';
                                    const expiryInfo = this.getProductExpiryInfo(product);

                                    return `
                                        <div ondblclick="app.showEditProductForm('${product.id}')" title="Nhấp đúp để chỉnh sửa sản phẩm" style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 1fr 1fr 100px; gap: 16px; padding: 16px; border-bottom: 1px solid #f1f5f9; align-items: center; cursor: pointer; ${index % 2 === 0 ? 'background: #fafbfc;' : 'background: white;'}">
                                            <div>
                                                <div style="font-weight: 600; color: #1f2937; margin-bottom: 4px;">${product.name}</div>
                                                <div style="font-size: 12px; color: #6b7280;">${product.id} • ${product.category}</div>
                                            </div>
                                            <div style="font-weight: 500; color: #1f2937;">
                                                ${product.price.toLocaleString('vi-VN')} VNĐ
                                            </div>
                                            <div style="font-weight: 600; color: ${statusColor};">
                                                ${product.stock}
                                            </div>
                                            <div style="color: #6b7280;">
                                                ${product.minStock}
                                            </div>
                                            <div style="display: flex; align-items: center; gap: 6px;">
                                                <span style="font-size: 16px;">${statusIcon}</span>
                                                <span style="color: ${statusColor}; font-weight: 500; font-size: 13px;">${statusText}</span>
                                            </div>
                                            <div style="font-size: 12px;">
                                                ${expiryInfo ? `<span style="color: ${expiryInfo.statusColor}; font-weight: 600;">${expiryInfo.statusIcon} ${expiryInfo.displayDate}</span>` : '<span style="color: #9ca3af;">—</span>'}
                                            </div>
                                            <button onclick="event.stopPropagation(); app.showProductDetail('${product.id}')" ondblclick="event.stopPropagation()" style="background: #3b82f6; color: white; border: none; padding: 6px 12px; border-radius: 6px; font-size: 12px; cursor: pointer; font-weight: 500;">
                                                Chi tiết
                                            </button>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    </div>
                `;
            }

            getInventoryHistoryContent() {
                // Lấy dữ liệu lịch sử
                const historyData = this.demoData.inventoryHistory || [];

                // Tính toán thống kê
                const totalImports = historyData.filter(h => h.type === 'import').length;
                const totalExports = historyData.filter(h => h.type === 'export').length;
                const totalDeliveries = historyData.filter(h => h.type === 'delivery').length;
                const totalImportQty = historyData.filter(h => h.type === 'import').reduce((sum, h) => sum + h.quantity, 0);
                const totalExportQty = historyData.filter(h => h.type === 'export').reduce((sum, h) => sum + h.quantity, 0);
                const totalDeliveryQty = historyData.filter(h => h.type === 'delivery').reduce((sum, h) => sum + h.quantity, 0);

                // Tính theo sản phẩm
                const productStats = {};
                historyData.forEach(entry => {
                    if (!productStats[entry.productId]) {
                        productStats[entry.productId] = { name: entry.productName, imports: 0, exports: 0, deliveries: 0 };
                    }
                    if (entry.type === 'import') {
                        productStats[entry.productId].imports += entry.quantity;
                    } else if (entry.type === 'delivery') {
                        productStats[entry.productId].deliveries += entry.quantity;
                    } else {
                        productStats[entry.productId].exports += entry.quantity;
                    }
                });

                const historyTable = historyData.map((entry, index) => {
                    let typeEmoji, typeLabel, typeColor, qtyColor;

                    if (entry.type === 'import') {
                        typeEmoji = '📥';
                        typeLabel = 'Nhập kho';
                        typeColor = '#10b981';
                        qtyColor = '#10b981';
                    } else if (entry.type === 'delivery') {
                        typeEmoji = '🚚';
                        typeLabel = 'Giao hàng';
                        typeColor = '#3b82f6';
                        qtyColor = '#3b82f6';
                    } else {
                        typeEmoji = '📤';
                        typeLabel = 'Xuất kho';
                        typeColor = '#f59e0b';
                        qtyColor = '#ef4444';
                    }

                    const qtyChange = (entry.type === 'import') ? `+${entry.quantity}` : `-${entry.quantity}`;
                    const reasonText = entry.type === 'delivery' 
                        ? `${entry.reason} (${entry.deliveryMethod})`
                        : entry.reason;

                    return `
                        <tr style="border-bottom: 1px solid #e5e7eb;">
                            <td style="padding: 12px; font-weight: 600; color: var(--text-primary);">${entry.id}</td>
                            <td style="padding: 12px;">
                                <span style="font-weight: 600; display: flex; align-items: center; gap: 6px;">
                                    <span>${typeEmoji}</span>
                                    <span>${typeLabel}</span>
                                </span>
                            </td>
                            <td style="padding: 12px; color: var(--text-secondary);">${entry.productName}</td>
                            <td style="padding: 12px; text-align: right; font-weight: 600; color: ${qtyColor};">${qtyChange}</td>
                            <td style="padding: 12px; text-align: right; color: var(--text-secondary);">${entry.oldStock} → ${entry.newStock}</td>
                            <td style="padding: 12px; color: var(--text-secondary);">${reasonText}</td>
                            <td style="padding: 12px; color: var(--text-secondary); white-space: nowrap;">${entry.date} ${entry.time}</td>
                        </tr>
                    `;
                }).join('');

                return `
                    <div class="fade-in">
                        <!-- Thống kê lịch sử -->
                        <div class="stats-grid" style="margin-bottom: 24px;">
                            <div class="stat-card success">
                                <div class="stat-header">
                                    <span class="stat-title">Tổng nhập kho</span>
                                    <span class="stat-icon">📥</span>
                                </div>
                                <div class="stat-value">${totalImportQty}</div>
                                <div class="stat-change positive">${totalImports} lần nhập</div>
                            </div>

                            <div class="stat-card warning">
                                <div class="stat-header">
                                    <span class="stat-title">Tổng xuất kho</span>
                                    <span class="stat-icon">📤</span>
                                </div>
                                <div class="stat-value">${totalExportQty}</div>
                                <div class="stat-change positive">${totalExports} lần xuất</div>
                            </div>

                            <div class="stat-card info">
                                <div class="stat-header">
                                    <span class="stat-title">Tổng giao hàng</span>
                                    <span class="stat-icon">🚚</span>
                                </div>
                                <div class="stat-value">${totalDeliveryQty}</div>
                                <div class="stat-change positive">${totalDeliveries} lần giao</div>
                            </div>

                            <div class="stat-card info">
                                <div class="stat-header">
                                    <span class="stat-title">Tổng giao dịch</span>
                                    <span class="stat-icon">📝</span>
                                </div>
                                <div class="stat-value">${totalImports + totalExports + totalDeliveries}</div>
                                <div class="stat-change positive">Từ lúc khởi tạo</div>
                            </div>

                            <div class="stat-card revenue">
                                <div class="stat-header">
                                    <span class="stat-title">Sản phẩm theo dõi</span>
                                    <span class="stat-icon">📦</span>
                                </div>
                                <div class="stat-value">${Object.keys(productStats).length}</div>
                                <div class="stat-change positive">Có lịch sử thay đổi</div>
                            </div>
                        </div>

                        <!-- Bộ lọc -->
                        <div style="background: white; border-radius: 12px; padding: 20px; margin-bottom: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                            <h3 style="margin-top: 0; margin-bottom: 16px; color: var(--text-primary);">🔍 Bộ lọc lịch sử</h3>
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
                                <div>
                                    <label style="display: block; margin-bottom: 6px; font-weight: 600; color: var(--text-secondary); font-size: 14px;">Loại giao dịch:</label>
                                    <select id="filter-type" onchange="app.filterInventoryHistory()" style="width: 100%; padding: 8px 12px; border: 2px solid #e5e7eb; border-radius: 6px; font-size: 14px;">
                                        <option value="">Tất cả</option>
                                        <option value="import">Nhập kho</option>
                                        <option value="export">Xuất kho</option>
                                        <option value="delivery">Giao hàng</option>
                                    </select>
                                </div>

                                <div>
                                    <label style="display: block; margin-bottom: 6px; font-weight: 600; color: var(--text-secondary); font-size: 14px;">Sản phẩm:</label>
                                    <select id="filter-product" onchange="app.filterInventoryHistory()" style="width: 100%; padding: 8px 12px; border: 2px solid #e5e7eb; border-radius: 6px; font-size: 14px;">
                                        <option value="">Tất cả sản phẩm</option>
                                        ${Object.entries(productStats).map(([productId, stats]) => 
                                            `<option value="${productId}">${stats.name}</option>`
                                        ).join('')}
                                    </select>
                                </div>

                                <div>
                                    <label style="display: block; margin-bottom: 6px; font-weight: 600; color: var(--text-secondary); font-size: 14px;">Từ ngày:</label>
                                    <input type="date" id="filter-from-date" onchange="app.filterInventoryHistory()" style="width: 100%; padding: 8px 12px; border: 2px solid #e5e7eb; border-radius: 6px; font-size: 14px;">
                                </div>

                                <div>
                                    <label style="display: block; margin-bottom: 6px; font-weight: 600; color: var(--text-secondary); font-size: 14px;">Đến ngày:</label>
                                    <input type="date" id="filter-to-date" onchange="app.filterInventoryHistory()" style="width: 100%; padding: 8px 12px; border: 2px solid #e5e7eb; border-radius: 6px; font-size: 14px;">
                                </div>

                                <div style="display: flex; gap: 8px; align-items: flex-end;">
                                    <button onclick="app.resetInventoryHistoryFilter()" style="flex-grow: 1; background: white; color: var(--text-secondary); border: 2px solid #e5e7eb; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-weight: 600;">
                                        🔄 Đặt lại
                                    </button>
                                    <button onclick="app.exportInventoryHistoryReport()" style="flex-grow: 1; background: var(--primary-blue); color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-weight: 600;">
                                        📥 Xuất báo cáo
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- Lịch sử chi tiết -->
                        <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                            <div style="overflow-x: auto;">
                                ${historyData.length > 0 ? `
                                <table style="width: 100%; border-collapse: collapse;">
                                    <thead>
                                        <tr style="background: #f8fafc; border-bottom: 2px solid #e5e7eb;">
                                            <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">ID</th>
                                            <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">Loại</th>
                                            <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">Sản phẩm</th>
                                            <th style="padding: 12px; text-align: right; font-weight: 600; color: #374151;">Số lượng</th>
                                            <th style="padding: 12px; text-align: right; font-weight: 600; color: #374151;">Tồn kho</th>
                                            <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">Lý do</th>
                                            <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">Thời gian</th>
                                        </tr>
                                    </thead>
                                    <tbody id="inventory-history-table">
                                        ${historyTable}
                                    </tbody>
                                </table>
                                ` : `
                                <div style="padding: 40px; text-align: center; color: #9ca3af;">
                                    <div style="font-size: 48px; margin-bottom: 12px;">📭</div>
                                    <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">Chưa có lịch sử thay đổi kho hàng</div>
                                    <div style="font-size: 14px;">Hãy thực hiện nhập kho hoặc xuất kho để tạo lịch sử</div>
                                </div>
                                `}
                            </div>
                        </div>

                        <!-- Thống kê theo sản phẩm -->
                        ${Object.keys(productStats).length > 0 ? `
                        <div style="margin-top: 24px; background: white; border-radius: 12px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                            <h3 style="margin-top: 0; margin-bottom: 16px; color: var(--text-primary);">📊 Thống kê theo sản phẩm</h3>
                            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px;">
                                ${Object.entries(productStats).map(([productId, stats]) => `
                                    <div style="background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%); padding: 16px; border-radius: 8px; border-left: 4px solid #3b82f6;">
                                        <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 8px;">${stats.name}</div>
                                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px; font-size: 13px;">
                                            <span style="color: #10b981; background: white; padding: 6px; border-radius: 4px;">📥 Nhập: <strong>${stats.imports}</strong></span>
                                            <span style="color: #3b82f6; background: white; padding: 6px; border-radius: 4px;">🚚 Giao: <strong>${stats.deliveries}</strong></span>
                                            <span style="color: #f59e0b; background: white; padding: 6px; border-radius: 4px;">📤 Xuất: <strong>${stats.exports}</strong></span>
                                            <span style="color: #6366f1; background: white; padding: 6px; border-radius: 4px;">📊 Net: <strong>${stats.imports - stats.deliveries - stats.exports}</strong></span>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        ` : ''}
                    </div>
                `;
            }

            getInventoryFlowContent() {
                // Tính toán lưu lượng tồn kho từ lịch sử kho
                const inventoryFlow = this.calculateInventoryFlow();
                const productFlowData = inventoryFlow.productFlow;
                const timeSeriesData = inventoryFlow.timeSeries;
                const totalMetrics = inventoryFlow.totalMetrics;

                // Tính thống kê chi tiết
                const detailedStats = [];
                this.demoData.products.forEach(product => {
                    const history = (this.demoData.inventoryHistory || [])
                        .filter(h => h.productId === product.id)
                        .sort((a, b) => new Date(a.date + ' ' + a.time) - new Date(b.date + ' ' + b.time));

                    const totalImported = history.filter(h => h.type === 'import').reduce((sum, h) => sum + h.quantity, 0);
                    const totalDelivered = history.filter(h => h.type === 'delivery').reduce((sum, h) => sum + h.quantity, 0);
                    const totalExported = history.filter(h => h.type === 'export').reduce((sum, h) => sum + h.quantity, 0);
                    const netFlow = totalImported - totalDelivered - totalExported;

                    detailedStats.push({
                        id: product.id,
                        name: product.name,
                        currentStock: product.stock,
                        totalImported,
                        totalDelivered,
                        totalExported,
                        netFlow,
                        minStock: product.minStock || 5
                    });
                });

                // Sắp xếp theo tên sản phẩm
                detailedStats.sort((a, b) => a.name.localeCompare(b.name));

                const flowCharts = detailedStats.map((stat, idx) => {
                    const maxBarWidth = Math.max(stat.totalImported, stat.totalDelivered, stat.totalExported, 1);
                    const scale = 200 / maxBarWidth;
                    const importedWidth = stat.totalImported * scale;
                    const deliveredWidth = stat.totalDelivered * scale;
                    const exportedWidth = stat.totalExported * scale;

                    const statusColor = stat.currentStock < stat.minStock ? '#ef4444' : stat.currentStock >= stat.minStock * 3 ? '#10b981' : '#f59e0b';
                    const statusText = stat.currentStock < stat.minStock ? '❌ Sắp hết' : stat.currentStock >= stat.minStock * 3 ? '✅ Dồi dào' : '⚠️ Bình thường';

                    return `
                        <div style="background: white; border-radius: 12px; padding: 20px; border-left: 4px solid ${statusColor}; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                            <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 16px;">
                                <div>
                                    <h4 style="margin: 0 0 4px 0; color: var(--text-primary); font-size: 16px;">${stat.name}</h4>
                                    <div style="font-size: 12px; color: #6b7280;">Mã: ${stat.id}</div>
                                </div>
                                <div style="text-align: right;">
                                    <div style="font-weight: 700; font-size: 18px; color: ${statusColor};">${stat.currentStock}</div>
                                    <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">${statusText}</div>
                                </div>
                            </div>

                            <!-- Flow Chart -->
                            <div style="margin-bottom: 16px;">
                                <div style="display: flex; gap: 2px; height: 24px; background: #f3f4f6; border-radius: 4px; padding: 0; overflow: hidden;">
                                    <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); width: ${Math.max(importedWidth, 2)}px;" title="Nhập: ${stat.totalImported}"></div>
                                    <div style="background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%); width: ${Math.max(deliveredWidth, 2)}px;" title="Giao: ${stat.totalDelivered}"></div>
                                    <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); width: ${Math.max(exportedWidth, 2)}px;" title="Xuất: ${stat.totalExported}"></div>
                                </div>
                            </div>

                            <!-- Statistics Grid -->
                            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 12px;">
                                <div style="background: #f0fdf4; padding: 12px; border-radius: 8px; text-align: center;">
                                    <div style="font-size: 11px; color: #6b7280; margin-bottom: 4px;">📥 Nhập</div>
                                    <div style="font-weight: 700; color: #10b981;">${stat.totalImported}</div>
                                </div>
                                <div style="background: #f0f9ff; padding: 12px; border-radius: 8px; text-align: center;">
                                    <div style="font-size: 11px; color: #6b7280; margin-bottom: 4px;">🚚 Giao</div>
                                    <div style="font-weight: 700; color: #3b82f6;">${stat.totalDelivered}</div>
                                </div>
                                <div style="background: #fef2f2; padding: 12px; border-radius: 8px; text-align: center;">
                                    <div style="font-size: 11px; color: #6b7280; margin-bottom: 4px;">📤 Xuất</div>
                                    <div style="font-weight: 700; color: #ef4444;">${stat.totalExported}</div>
                                </div>
                                <div style="background: #f5f3ff; padding: 12px; border-radius: 8px; text-align: center;">
                                    <div style="font-size: 11px; color: #6b7280; margin-bottom: 4px;">📊 Net</div>
                                    <div style="font-weight: 700; color: ${stat.netFlow >= 0 ? '#10b981' : '#ef4444'}">${stat.netFlow >= 0 ? '+' : ''}${stat.netFlow}</div>
                                </div>
                            </div>

                            <!-- Min Stock Indicator -->
                            <div style="display: flex; align-items: center; gap: 8px; padding: 8px; background: #f9fafb; border-radius: 6px; font-size: 12px;">
                                <span>📌 Mục tiêu tối thiểu:</span>
                                <span style="font-weight: 600;">${stat.minStock}</span>
                                <span style="color: #6b7280;">(Hiện tại: ${stat.currentStock})</span>
                                ${stat.currentStock < stat.minStock ? `<span style="color: #ef4444; font-weight: 600;">⚠️ Cần nhập hàng</span>` : ''}
                            </div>
                        </div>
                    `;
                }).join('');

                const totalImportedAll = totalMetrics.totalImported;
                const totalDeliveredAll = totalMetrics.totalDelivered;
                const totalExportedAll = totalMetrics.totalExported;
                const netFlowAll = totalImportedAll - totalDeliveredAll - totalExportedAll;

                return `
                    <div class="fade-in">
                        <!-- Summary Statistics -->
                        <div class="stats-grid" style="margin-bottom: 24px;">
                            <div class="stat-card success">
                                <div class="stat-header">
                                    <span class="stat-title">Tổng nhập kho</span>
                                    <span class="stat-icon">📥</span>
                                </div>
                                <div class="stat-value">${totalImportedAll.toLocaleString('vi-VN')}</div>
                                <div class="stat-change">Từ lịch sử</div>
                            </div>

                            <div class="stat-card info">
                                <div class="stat-header">
                                    <span class="stat-title">Tổng giao hàng</span>
                                    <span class="stat-icon">🚚</span>
                                </div>
                                <div class="stat-value">${totalDeliveredAll.toLocaleString('vi-VN')}</div>
                                <div class="stat-change">Đã giao khách</div>
                            </div>

                            <div class="stat-card warning">
                                <div class="stat-header">
                                    <span class="stat-title">Tổng kho hiện tại</span>
                                    <span class="stat-icon">📦</span>
                                </div>
                                <div class="stat-value">${this.demoData.products.reduce((sum, p) => sum + p.stock, 0).toLocaleString('vi-VN')}</div>
                                <div class="stat-change">Còn lại</div>
                            </div>

                            <div class="stat-card" style="background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%);">
                                <div class="stat-header">
                                    <span class="stat-title">Lưu lượng ròng</span>
                                    <span class="stat-icon">📊</span>
                                </div>
                                <div class="stat-value" style="color: white;">${netFlowAll >= 0 ? '+' : ''}${netFlowAll.toLocaleString('vi-VN')}</div>
                                <div class="stat-change" style="color: rgba(255,255,255,0.8);">Nhập - Giao - Xuất</div>
                            </div>
                        </div>

                        <!-- Filter Section -->
                        <div style="background: white; border-radius: 12px; padding: 24px; margin-bottom: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                            <h2 class="section-title">📊 Phân tích lưu lượng tồn kho</h2>
                            <p style="color: #6b7280; margin-bottom: 16px;">Theo dõi chi tiết lưu lượng nhập, giao và xuất cho từng sản phẩm</p>

                            <!-- Period Selection -->
                            <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 16px;">
                                <button onclick="app.filterInventoryFlowByPeriod('all')" style="padding: 8px 16px; background: var(--primary-blue); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">📅 Tất cả</button>
                                <button onclick="app.filterInventoryFlowByPeriod('today')" style="padding: 8px 16px; background: white; color: var(--text-secondary); border: 2px solid #e5e7eb; border-radius: 6px; cursor: pointer; font-weight: 600;">📅 Hôm nay</button>
                                <button onclick="app.filterInventoryFlowByPeriod('week')" style="padding: 8px 16px; background: white; color: var(--text-secondary); border: 2px solid #e5e7eb; border-radius: 6px; cursor: pointer; font-weight: 600;">📅 Tuần này</button>
                                <button onclick="app.filterInventoryFlowByPeriod('month')" style="padding: 8px 16px; background: white; color: var(--text-secondary); border: 2px solid #e5e7eb; border-radius: 6px; cursor: pointer; font-weight: 600;">📅 Tháng này</button>
                            </div>
                        </div>

                        <!-- Detailed Product Flow Cards -->
                        <div style="background: white; border-radius: 12px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                            <h3 style="margin-top: 0; margin-bottom: 24px; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
                                <span>📦</span> Chi tiết lưu lượng sản phẩm (${detailedStats.length})
                            </h3>

                            ${flowCharts.length > 0 ? flowCharts : `
                                <div style="padding: 40px; text-align: center; color: #9ca3af;">
                                    <div style="font-size: 48px; margin-bottom: 12px;">📭</div>
                                    <div style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">Chưa có lịch sử giao dịch</div>
                                    <div style="font-size: 14px;">Hãy tạo đơn hàng hoặc nhập kho để bắt đầu theo dõi lưu lượng tồn kho</div>
                                </div>
                            `}
                        </div>
                    </div>
                `;
            }

            calculateInventoryFlow() {
                const history = this.demoData.inventoryHistory || [];

                // Calculate totals
                const totalImported = history.filter(h => h.type === 'import').reduce((sum, h) => sum + h.quantity, 0);
                const totalDelivered = history.filter(h => h.type === 'delivery').reduce((sum, h) => sum + h.quantity, 0);
                const totalExported = history.filter(h => h.type === 'export').reduce((sum, h) => sum + h.quantity, 0);

                // Calculate by product
                const productFlow = {};
                this.demoData.products.forEach(p => {
                    productFlow[p.id] = {
                        imported: history.filter(h => h.productId === p.id && h.type === 'import').reduce((sum, h) => sum + h.quantity, 0),
                        delivered: history.filter(h => h.productId === p.id && h.type === 'delivery').reduce((sum, h) => sum + h.quantity, 0),
                        exported: history.filter(h => h.productId === p.id && h.type === 'export').reduce((sum, h) => sum + h.quantity, 0)
                    };
                });

                // Calculate time series
                const timeSeries = {};
                history.forEach(h => {
                    const key = h.date;
                    if (!timeSeries[key]) {
                        timeSeries[key] = { import: 0, delivery: 0, export: 0 };
                    }
                    if (h.type === 'import') timeSeries[key].import += h.quantity;
                    if (h.type === 'delivery') timeSeries[key].delivery += h.quantity;
                    if (h.type === 'export') timeSeries[key].export += h.quantity;
                });

                return {
                    productFlow,
                    timeSeries,
                    totalMetrics: {
                        totalImported,
                        totalDelivered,
                        totalExported
                    }
                };
            }

            filterInventoryFlowByPeriod(period) {
                // This function can be extended for date filtering
                this.showNotification(`Lọc ${period} đang được phát triển`, 'info');
            }

            getSalesContent() {
                const salesTable = this.demoData.sales.map(sale => `
                    <div class="activity-item">
                        <div class="activity-icon ${sale.status === 'Hoàn thành' ? 'success' : sale.status === 'Chờ xử lý' ? 'warning' : 'info'}">💰</div>
                        <div class="activity-content">
                            <div class="activity-title">Đơn hàng ${sale.id} - ${sale.customer}</div>
                            <div class="activity-desc">💰 ${sale.total.toLocaleString('vi-VN')} VNĐ | 📦 ${sale.items} sản phẩm | 📞 ${sale.customerPhone || ''} | 📅 ${sale.date}</div>
                        </div>
                        <div class="activity-time">${sale.status}</div>
                    </div>
                `).join('');

                const totalRevenue = this.demoData.sales.reduce((sum, sale) => sum + sale.total, 0);

                return `
                    <div class="fade-in">
                        <div class="stats-grid" style="margin-bottom: 24px;">
                            <div class="stat-card revenue">
                                <div class="stat-header">
                                    <span class="stat-title">Tổng doanh thu</span>
                                    <span class="stat-icon">💰</span>
                                </div>
                                <div class="stat-value">${totalRevenue.toLocaleString('vi-VN')} VNĐ</div>
                                <div class="stat-change positive">5 đơn hàng</div>
                            </div>

                            <div class="stat-card orders">
                                <div class="stat-header">
                                    <span class="stat-title">Đơn hoàn thành</span>
                                    <span class="stat-icon">✅</span>
                                </div>
                                <div class="stat-value">${this.demoData.sales.filter(s => s.status === 'Hoàn thành').length}</div>
                                <div class="stat-change positive">Đã thanh toán</div>
                            </div>
                        </div>

                        <div class="quick-actions">
                            <h2 class="section-title">Quản lý Bán hàng</h2>
                            <div class="action-grid" style="margin-bottom: 24px;">
                                <div class="action-button" onclick="app.showCreateOrderForm()">
                                    <div class="action-icon">📝</div>
                                    <div class="action-title">Tạo đơn hàng</div>
                                </div>
                                <div class="action-button" onclick="app.exportSalesReport()">
                                    <div class="action-icon">📊</div>
                                    <div class="action-title">Báo cáo doanh thu</div>
                                </div>
                                <div class="action-button" onclick="app.showPromotionForm()">
                                    <div class="action-icon">🎁</div>
                                    <div class="action-title">Khuyến mãi</div>
                                </div>
                            </div>
                            ${salesTable}
                        </div>
                    </div>
                `;
            }

            getPurchasesContent() {
                const purchasesList = this.demoData.purchases.map(purchase => {
                    const itemCount = purchase.products ? purchase.products.length : 0;
                    const createdAtText = purchase.createdAt
                        ? new Date(purchase.createdAt).toLocaleString('vi-VN', {
                            timeZone: 'Asia/Ho_Chi_Minh',
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false
                        })
                        : '';
                    const productNames = (purchase.products || [])
                        .map(item => item.name || item.productName || item.productId || item.id)
                        .filter(Boolean);
                    const productTitle = productNames.length > 0
                        ? (productNames.length > 2 ? `${productNames.slice(0, 2).join(', ')} +${productNames.length - 2}` : productNames.join(', '))
                        : 'Sản phẩm chưa xác định';
                    const stockStatus = this.getPurchaseStockStatus(purchase);
                    const bulkCheckbox = `<label style="display: flex; align-items: center; margin-right: 8px;"><input type="checkbox" class="purchase-bulk-checkbox" value="${purchase.id}" onclick="event.stopPropagation()" style="width: 18px; height: 18px;"></label>`;
                    const totalText = purchase.total ? purchase.total.toLocaleString('vi-VN') + ' VNĐ' : '0 VNĐ';
                    return `
                        <div class="activity-item">
                            ${bulkCheckbox}
                            <div class="activity-icon ${purchase.status === 'Đã nhận hàng' ? 'success' : 'info'}">🛒</div>
                            <div class="activity-content">
                                <div class="activity-title">${productTitle}</div>
                                <div class="activity-desc">📦 ${itemCount} sản phẩm | 📅 Ngày mua: ${purchase.date || '-'}</div>
                                ${createdAtText ? `<div class="activity-desc">🕒 Tạo lúc: ${createdAtText}</div>` : ''}
                                <div class="activity-desc">💰 ${totalText} | ${purchase.status || 'Chưa xử lý'}</div>
                                <div class="activity-desc">📥 ${stockStatus}</div>
                            </div>
                            <div style="display: flex; gap: 8px; align-items: center;">
                                <div class="activity-time">${purchase.paymentStatus || ''}</div>
                                <button onclick="app.showUpdatePurchaseForm('${purchase.id}')" style="background: #3b82f6; color: white; padding: 6px 10px; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">Cập nhật</button>
                                <button onclick="app.deletePurchaseOrder('${purchase.id}')" style="background: #ef4444; color: white; padding: 6px 10px; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">Xóa</button>
                            </div>
                        </div>
                    `;
                }).join('') || `<div class="activity-item"><div class="activity-content"><div class="activity-title">Chưa có đơn mua hàng nào.</div></div></div>`;

                return `
                    <div class="fade-in">
                        <div class="quick-actions">
                            <h2 class="section-title">Quản lý Mua hàng (${this.demoData.purchases.length})</h2>
                            <div class="action-grid" style="margin-bottom: 24px;">
                                <div class="action-button" onclick="app.showCreatePurchaseForm()">
                                    <div class="action-icon">🛒</div>
                                    <div class="action-title">Tạo đơn mua</div>
                                </div>
                                <div class="action-button" onclick="app.exportPurchaseReport()">
                                    <div class="action-icon">📊</div>
                                    <div class="action-title">Báo cáo mua</div>
                                </div>
                                <div class="action-button" onclick="app.showUploadPurchasesForm()">
                                    <div class="action-icon">📤</div>
                                    <div class="action-title">Upload Excel</div>
                                </div>
                                <div class="action-button" onclick="app.deleteAllPurchases()">
                                    <div class="action-icon">🗑️</div>
                                    <div class="action-title">Xóa tất cả</div>
                                </div>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 14px; flex-wrap: wrap;">
                                <label style="display: flex; align-items: center; gap: 8px; font-size: 14px; color: #374151;">
                                    <input type="checkbox" onchange="app.toggleAllPurchaseSelection(this.checked)" style="width: 18px; height: 18px;">
                                    Chọn tất cả
                                </label>
                                <button onclick="app.showBulkUpdatePurchasesForm()" style="background: #0f766e; color: white; border: none; padding: 9px 14px; border-radius: 6px; cursor: pointer; font-weight: 600;">Cập nhật trạng thái đã chọn</button>
                            </div>
                            <div id="purchases-list">
                                ${purchasesList}
                            </div>
                        </div>
                    </div>
                `;
            }

            getExpensesContent() {
                const currentExpenseRange = this.getExpensePeriodRange('all');
                const monthExpenseRange = this.getExpensePeriodRange('month');
                const today = currentExpenseRange.toDate;
                const firstDay = currentExpenseRange.fromDate;
                const todayInputValue = this.formatDateInputValue(this.getVietnamTime());
                const expenses = this.demoData.expenses || [];
                const monthExpenses = this.getExpensesInRange(monthExpenseRange.fromDate, monthExpenseRange.toDate);
                const visibleExpenses = this.getExpensesInRange(firstDay, today);
                const totalExpenses = expenses.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);
                const monthTotal = monthExpenses.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);
                const breakdown = this.getExpenseBreakdown(expenses);
                const topCategory = Object.entries(breakdown).sort((a, b) => b[1] - a[1])[0];
                const selectedBreakdownRows = this.renderExpenseBreakdownRows(visibleExpenses);
                const categoryOptions = this.getExpenseCategories().map(category =>
                    `<option value="${category}">${category}</option>`
                ).join('');
                const expenseRows = expenses
                    .slice()
                    .sort((a, b) => new Date(b.date) - new Date(a.date))
                    .map(expense => {
                        const expenseDate = new Date(expense.date);
                        const startDate = firstDay ? new Date(firstDay) : null;
                        const endDate = today ? new Date(today) : null;
                        if (endDate) endDate.setHours(23, 59, 59, 999);
                        const isVisibleByDefault = (!startDate || expenseDate >= startDate) && (!endDate || expenseDate <= endDate);

                        return `
                        <tr data-expense-id="${expense.id}" style="border-bottom: 1px solid #e5e7eb; ${isVisibleByDefault ? '' : 'display: none;'}">
                            <td style="padding: 12px;">${expense.date || ''}</td>
                            <td style="padding: 12px;">
                                <span style="background: #eef2ff; color: #3730a3; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">${expense.category || 'Khác'}</span>
                            </td>
                            <td style="padding: 12px; text-align: right; font-weight: 700; color: #dc2626;">${(Number(expense.amount) || 0).toLocaleString('vi-VN')} VNĐ</td>
                            <td style="padding: 12px;">${expense.paymentMethod || 'Tiền mặt'}</td>
                            <td style="padding: 12px;">${expense.payee || '-'}</td>
                            <td style="padding: 12px;">${expense.notes || '-'}</td>
                            <td style="padding: 12px; text-align: center;">
                                <button onclick="app.deleteExpense('${expense.id}')" style="background: #dc2626; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-size: 12px;">Xóa</button>
                            </td>
                        </tr>
                    `;
                    }).join('');

                return `
                    <div class="fade-in">
                        <div class="stats-grid" style="margin-bottom: 24px;">
                            <div class="stat-card warning">
                                <div class="stat-header">
                                    <span class="stat-title">Chi phí tháng này</span>
                                    <span class="stat-icon">💸</span>
                                </div>
                                <div class="stat-value">${monthTotal.toLocaleString('vi-VN')} VNĐ</div>
                                <div class="stat-change negative">${monthExpenses.length} khoản</div>
                            </div>

                            <div class="stat-card info">
                                <div class="stat-header">
                                    <span class="stat-title">Tổng chi phí</span>
                                    <span class="stat-icon">📉</span>
                                </div>
                                <div class="stat-value">${totalExpenses.toLocaleString('vi-VN')} VNĐ</div>
                                <div class="stat-change">${expenses.length} khoản đã ghi</div>
                            </div>

                            <div class="stat-card revenue">
                                <div class="stat-header">
                                    <span class="stat-title">Loại lớn nhất</span>
                                    <span class="stat-icon">📊</span>
                                </div>
                                <div class="stat-value">${topCategory ? topCategory[0] : 'N/A'}</div>
                                <div class="stat-change">${topCategory ? topCategory[1].toLocaleString('vi-VN') + ' VNĐ' : 'Chưa có dữ liệu'}</div>
                            </div>
                        </div>

                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; align-items: start;">
                            <div style="background: white; border-radius: 8px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                                <h3 style="margin: 0 0 18px 0; color: var(--text-primary);">Nhập chi phí</h3>
                                <form onsubmit="app.createExpense(event)">
                                    <div style="margin-bottom: 14px;">
                                        <label style="display: block; margin-bottom: 6px; font-weight: 600;">Ngày chi phí</label>
                                        <input type="date" name="date" value="${todayInputValue}" required style="width: 100%; padding: 10px; border: 2px solid #e5e7eb; border-radius: 6px;">
                                    </div>
                                    <div style="margin-bottom: 14px;">
                                        <label style="display: block; margin-bottom: 6px; font-weight: 600;">Loại chi phí</label>
                                        <select name="category" style="width: 100%; padding: 10px; border: 2px solid #e5e7eb; border-radius: 6px;">
                                            ${categoryOptions}
                                        </select>
                                    </div>
                                    <div style="margin-bottom: 14px;">
                                        <label style="display: block; margin-bottom: 6px; font-weight: 600;">Loại mới (nếu cần)</label>
                                        <input type="text" name="newCategory" placeholder="Ví dụ: Bảo hiểm, phần mềm..." style="width: 100%; padding: 10px; border: 2px solid #e5e7eb; border-radius: 6px;">
                                    </div>
                                    <div style="margin-bottom: 14px;">
                                        <label style="display: block; margin-bottom: 6px; font-weight: 600;">Số tiền</label>
                                        <input type="number" name="amount" min="1" required placeholder="0" style="width: 100%; padding: 10px; border: 2px solid #e5e7eb; border-radius: 6px;">
                                    </div>
                                    <div style="margin-bottom: 14px;">
                                        <label style="display: block; margin-bottom: 6px; font-weight: 600;">Phương thức chi</label>
                                        <select name="paymentMethod" style="width: 100%; padding: 10px; border: 2px solid #e5e7eb; border-radius: 6px;">
                                            <option value="Tiền mặt">Tiền mặt</option>
                                            <option value="Chuyển khoản">Chuyển khoản</option>
                                            <option value="Thẻ">Thẻ</option>
                                            <option value="Khác">Khác</option>
                                        </select>
                                    </div>
                                    <div style="margin-bottom: 14px;">
                                        <label style="display: block; margin-bottom: 6px; font-weight: 600;">Người nhận/Nhà cung cấp</label>
                                        <input type="text" name="payee" placeholder="Nhân viên, chủ kho, nhà cung cấp..." style="width: 100%; padding: 10px; border: 2px solid #e5e7eb; border-radius: 6px;">
                                    </div>
                                    <div style="margin-bottom: 18px;">
                                        <label style="display: block; margin-bottom: 6px; font-weight: 600;">Ghi chú</label>
                                        <textarea name="notes" placeholder="Diễn giải chi phí" style="width: 100%; padding: 10px; border: 2px solid #e5e7eb; border-radius: 6px; min-height: 74px; resize: vertical;"></textarea>
                                    </div>
                                    <button type="submit" style="width: 100%; background: var(--primary-blue); color: white; border: none; padding: 12px; border-radius: 6px; cursor: pointer; font-weight: 700;">Ghi nhận chi phí</button>
                                </form>
                            </div>

                            <div style="display: grid; gap: 24px;">
                                <div style="background: white; border-radius: 8px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 18px; flex-wrap: wrap;">
                                        <h3 style="margin: 0; color: var(--text-primary);">Danh sách chi phí</h3>
                                        <button onclick="app.exportExpenses()" style="background: var(--primary-green); color: white; border: none; padding: 8px 14px; border-radius: 6px; cursor: pointer; font-weight: 600;">Xuất CSV</button>
                                    </div>
                                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 16px;">
                                        <select id="expense-filter-period" onchange="app.setExpensePeriod(this.value)" style="padding: 8px; border: 2px solid #e5e7eb; border-radius: 6px;">
                                            <option value="all" selected>Tất cả</option>
                                            <option value="day">Theo ngày</option>
                                            <option value="week">Theo tuần</option>
                                            <option value="month">Theo tháng</option>
                                            <option value="custom">Tùy chỉnh</option>
                                        </select>
                                        <input type="date" id="expense-filter-from" value="${firstDay}" onchange="app.setExpenseCustomPeriod()" style="padding: 8px; border: 2px solid #e5e7eb; border-radius: 6px;">
                                        <input type="date" id="expense-filter-to" value="${today}" onchange="app.setExpenseCustomPeriod()" style="padding: 8px; border: 2px solid #e5e7eb; border-radius: 6px;">
                                        <select id="expense-filter-category" onchange="app.filterExpenseTable()" style="padding: 8px; border: 2px solid #e5e7eb; border-radius: 6px;">
                                            <option value="">Tất cả loại</option>
                                            ${categoryOptions}
                                        </select>
                                    </div>
                                    <div id="expense-filter-summary" style="margin-bottom: 14px; color: #4b5563; font-size: 13px;">
                                        Tất cả: ${this.getExpenseRangeText(firstDay, today)} · ${visibleExpenses.length} khoản · ${visibleExpenses.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0).toLocaleString('vi-VN')} VNĐ
                                    </div>
                                    <div style="overflow-x: auto;">
                                        <table style="width: 100%; border-collapse: collapse;">
                                            <thead>
                                                <tr style="background: #f3f4f6;">
                                                    <th style="padding: 12px; text-align: left;">Ngày</th>
                                                    <th style="padding: 12px; text-align: left;">Loại</th>
                                                    <th style="padding: 12px; text-align: right;">Số tiền</th>
                                                    <th style="padding: 12px; text-align: left;">Phương thức</th>
                                                    <th style="padding: 12px; text-align: left;">Người nhận</th>
                                                    <th style="padding: 12px; text-align: left;">Ghi chú</th>
                                                    <th style="padding: 12px; text-align: center;">Thao tác</th>
                                                </tr>
                                            </thead>
                                            <tbody id="expenses-table">
                                                ${expenseRows}
                                                <tr id="expenses-empty-row" style="${visibleExpenses.length === 0 ? '' : 'display: none;'}">
                                                    <td colspan="7" style="padding: 24px; text-align: center; color: #6b7280;">${expenses.length ? 'Không có khoản chi trong kỳ đang chọn' : 'Chưa có chi phí nào'}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div style="background: white; border-radius: 8px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                                    <h3 style="margin: 0 0 14px 0; color: var(--text-primary);">Tổng hợp theo loại chi phí đang xem</h3>
                                    <div id="expense-breakdown-list">
                                        ${selectedBreakdownRows}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }

            createExpense(event) {
                event.preventDefault();
                const form = event.target;
                const formData = new FormData(form);
                const newCategory = (formData.get('newCategory') || '').trim();
                const category = newCategory || formData.get('category') || 'Khác';
                const amount = Number(formData.get('amount')) || 0;

                if (amount <= 0) {
                    this.showNotification('Số tiền chi phí phải lớn hơn 0', 'warning');
                    return;
                }

                if (!Array.isArray(this.demoData.expenses)) this.demoData.expenses = [];
                if (!Array.isArray(this.demoData.expenseCategories)) this.demoData.expenseCategories = this.getDefaultExpenseCategories();
                if (!this.demoData.expenseCategories.includes(category)) {
                    this.demoData.expenseCategories.push(category);
                }

                const expense = {
                    id: `CP${Date.now()}`,
                    date: formData.get('date') || this.getVietnamTime().toISOString().split('T')[0],
                    category,
                    amount,
                    paymentMethod: formData.get('paymentMethod') || 'Tiền mặt',
                    payee: (formData.get('payee') || '').trim(),
                    notes: (formData.get('notes') || '').trim(),
                    createdAt: this.getVietnamTime().toISOString()
                };

                this.demoData.expenses.unshift(expense);
                this.saveToLocalStorage();
                this.addActivityLog('warning', '💸', `Ghi nhận chi phí ${category}`,
                    `Số tiền: ${amount.toLocaleString('vi-VN')} VNĐ - Ngày: ${expense.date}`, 'expense');
                this.showNotification(`Đã ghi nhận chi phí ${amount.toLocaleString('vi-VN')} VNĐ`, 'success');
                this.loadPage('expenses');
            }

            deleteExpense(expenseId) {
                const expense = (this.demoData.expenses || []).find(item => item.id === expenseId);
                if (!expense) return;
                if (!confirm(`Xóa chi phí ${expense.category} - ${(Number(expense.amount) || 0).toLocaleString('vi-VN')} VNĐ?`)) return;

                this.demoData.expenses = this.demoData.expenses.filter(item => item.id !== expenseId);
                this.saveToLocalStorage();
                this.showNotification('Đã xóa chi phí', 'success');
                this.loadPage('expenses');
            }

            setExpensePeriod(period) {
                const fromInput = document.getElementById('expense-filter-from');
                const toInput = document.getElementById('expense-filter-to');
                const periodSelect = document.getElementById('expense-filter-period');
                if (periodSelect) periodSelect.value = period;

                if (period !== 'custom' && fromInput && toInput) {
                    const range = this.getExpensePeriodRange(period);
                    fromInput.value = range.fromDate;
                    toInput.value = range.toDate;
                }

                this.filterExpenseTable();
            }

            setExpenseCustomPeriod() {
                const periodSelect = document.getElementById('expense-filter-period');
                if (periodSelect) periodSelect.value = 'custom';
                this.filterExpenseTable();
            }

            filterExpenseTable() {
                const period = document.getElementById('expense-filter-period')?.value || 'custom';
                const fromDate = document.getElementById('expense-filter-from')?.value || '';
                const toDate = document.getElementById('expense-filter-to')?.value || '';
                const category = document.getElementById('expense-filter-category')?.value || '';
                const rows = document.querySelectorAll('#expenses-table tr[data-expense-id]');
                let visibleCount = 0;
                let visibleTotal = 0;
                const visibleExpenses = [];

                rows.forEach(row => {
                    const expense = (this.demoData.expenses || []).find(item => item.id === row.getAttribute('data-expense-id'));
                    if (!expense) return;
                    const expenseDate = new Date(expense.date);
                    const startDate = fromDate ? new Date(fromDate) : null;
                    const endDate = toDate ? new Date(toDate) : null;
                    if (endDate) endDate.setHours(23, 59, 59, 999);
                    const visible = (!startDate || expenseDate >= startDate) &&
                        (!endDate || expenseDate <= endDate) &&
                        (!category || expense.category === category);

                    row.style.display = visible ? '' : 'none';
                    if (visible) {
                        visibleCount++;
                        visibleTotal += Number(expense.amount) || 0;
                        visibleExpenses.push(expense);
                    }
                });

                const emptyRow = document.getElementById('expenses-empty-row');
                if (emptyRow) emptyRow.style.display = visibleCount === 0 ? '' : 'none';

                const periodLabel = this.getExpensePeriodLabel(period);
                const summary = document.getElementById('expense-filter-summary');
                if (summary) {
                    summary.innerHTML = `${periodLabel}: ${this.getExpenseRangeText(fromDate, toDate)} · ${visibleCount} khoản · ${visibleTotal.toLocaleString('vi-VN')} VNĐ`;
                }

                const breakdownList = document.getElementById('expense-breakdown-list');
                if (breakdownList) {
                    breakdownList.innerHTML = this.renderExpenseBreakdownRows(visibleExpenses);
                }

                this.showNotification(`Đang hiển thị ${visibleCount} khoản chi, tổng ${visibleTotal.toLocaleString('vi-VN')} VNĐ`, 'info');
            }

            exportExpenses() {
                const expenses = this.demoData.expenses || [];
                if (expenses.length === 0) {
                    this.showNotification('Không có chi phí nào để xuất', 'info');
                    return;
                }

                const total = expenses.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);
                const csvContent = "data:text/csv;charset=utf-8,\uFEFF" +
                    `Báo cáo chi phí\n` +
                    `Ngày xuất,${this.getVietnamTime().toLocaleDateString('vi-VN')}\n` +
                    `Tổng chi phí,${total}\n\n` +
                    `Mã,Ngày,Loại chi phí,Số tiền,Phương thức,Người nhận,Ghi chú\n` +
                    expenses.map(expense =>
                        `${expense.id},${expense.date},"${expense.category}",${Number(expense.amount) || 0},"${expense.paymentMethod || ''}","${(expense.payee || '').replace(/"/g, '""')}","${(expense.notes || '').replace(/"/g, '""')}"`
                    ).join('\n');

                const encodedUri = encodeURI(csvContent);
                const link = document.createElement("a");
                link.setAttribute("href", encodedUri);
                link.setAttribute("download", `chi_phi_${this.getVietnamTime().toISOString().split('T')[0]}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                this.showNotification(`Đã xuất ${expenses.length} khoản chi phí`, 'success');
            }

            getDebtsContent() {
                // Tính công nợ dựa trên các đơn hàng chưa thanh toán
                const customerDebtMap = this.demoData.customers.reduce((acc, customer) => {
                    acc[customer.id] = 0;
                    return acc;
                }, {});

                this.demoData.orders.forEach(order => {
                    if (order.paymentStatus !== 'Đã thanh toán' && customerDebtMap.hasOwnProperty(order.customerId)) {
                        customerDebtMap[order.customerId] += this.getOrderRemainingBalance(order);
                    }
                });

                const customersWithDebt = this.demoData.customers
                    .map(customer => ({ ...customer, debt: customerDebtMap[customer.id] || 0 }))
                    .filter(customer => customer.debt > 0);

                const totalCustomerDebt = customersWithDebt.reduce((sum, customer) => sum + customer.debt, 0);
                const todayStr = this.getVietnamTime().toISOString().split('T')[0];
                const todayPayments = [];
                this.demoData.orders.forEach(order => {
                    if (order.paymentHistory && Array.isArray(order.paymentHistory)) {
                        order.paymentHistory.forEach(payment => {
                            if (payment.date === todayStr) {
                                todayPayments.push(payment);
                            }
                        });
                    }
                });
                const todayCollected = todayPayments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
                const todayPaymentCount = todayPayments.length;

                return `
                    <div class="fade-in">
                        <div class="stats-grid" style="margin-bottom: 24px;">
                            <div class="stat-card warning">
                                <div class="stat-header">
                                    <span class="stat-title">Tổng công nợ</span>
                                    <span class="stat-icon">💳</span>
                                </div>
                                <div class="stat-value">${totalCustomerDebt.toLocaleString('vi-VN')} VNĐ</div>
                                <div class="stat-change negative">${customersWithDebt.length} khách hàng</div>
                            </div>

                            <div class="stat-card info">
                                <div class="stat-header">
                                    <span class="stat-title">Đã thu hôm nay</span>
                                    <span class="stat-icon">💰</span>
                                </div>
                                <div class="stat-value">${todayCollected.toLocaleString('vi-VN')} VNĐ</div>
                                <div class="stat-change positive">${todayPaymentCount} lần thu</div>
                            </div>
                        </div>

                        <div class="quick-actions">
                            <h2 class="section-title">Quản lý Công nợ</h2>

                            <h3 style="margin-bottom: 16px; color: var(--text-primary);">Khách hàng có công nợ:</h3>
                            ${customersWithDebt.map(customer => `
                                <div class="activity-item">
                                    <div class="activity-icon warning">💳</div>
                                    <div class="activity-content">
                                        <div class="activity-title">${customer.name} (${customer.id})</div>
                                        <div class="activity-desc">📞 ${customer.phone} | 📍 ${customer.address}</div>
                                    </div>
                                    <div style="display: flex; gap: 8px; align-items: center;">
                                        <div class="activity-time" style="color: #dc2626; font-weight: bold;">
                                            ${customer.debt.toLocaleString('vi-VN')} VNĐ
                                        </div>
                                        <button ondblclick="app.toggleCustomerDebtStatus('${customer.id}')" style="
                                            background: #f59e0b; 
                                            color: white; 
                                            border: none; 
                                            padding: 6px 12px; 
                                            border-radius: 6px; 
                                            cursor: pointer; 
                                            font-size: 12px; 
                                            font-weight: 600;
                                            margin-right: 4px;
                                            transition: all 0.3s ease;
                                        " title="Double click để chuyển trạng thái">
                                            Công nợ
                                        </button>
                                        <button onclick="app.showPaymentFormForCustomer('${customer.id}')" style="
                                            background: var(--primary-blue); 
                                            color: white; 
                                            border: none; 
                                            padding: 6px 12px; 
                                            border-radius: 6px; 
                                            cursor: pointer; 
                                            font-size: 12px; 
                                            font-weight: 600;
                                            margin-right: 4px;
                                        ">
                                            Ghi nhận thanh toán
                                        </button>
                                        <button onclick="app.showCustomerDebtDetail('${customer.id}')" style="
                                            background: #059669; 
                                            color: white; 
                                            border: none; 
                                            padding: 6px 12px; 
                                            border-radius: 6px; 
                                            cursor: pointer; 
                                            font-size: 12px; 
                                            font-weight: 600;
                                        ">
                                            Chi tiết
                                        </button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }

            // Lịch sử giao dịch thanh toán
            getPaymentTransactionHistoryContent() {
                // Aggregate tất cả các giao dịch thanh toán từ các đơn hàng
                const allTransactions = [];
                let totalPaid = 0;

                this.demoData.orders.forEach((order, orderIndex) => {
                    if (order.paymentHistory && Array.isArray(order.paymentHistory)) {
                        const customer = this.demoData.customers.find(c => c.id === order.customerId) || { name: 'N/A', id: 'N/A' };

                        order.paymentHistory.forEach(payment => {
                            allTransactions.push({
                                id: payment.id,
                                orderId: order.id,
                                orderIndex: orderIndex,
                                customerId: order.customerId,
                                customerName: customer.name,
                                date: payment.date,
                                amount: payment.amount,
                                method: payment.method || 'Không xác định',
                                notes: payment.notes || '',
                                time: order.time || '00:00'
                            });
                            totalPaid += payment.amount;
                        });
                    }
                });

                // Sắp xếp theo ngày mới nhất trước
                allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

                // Tính toán thống kê
                const transactionCount = allTransactions.length;
                const avgTransaction = transactionCount > 0 ? totalPaid / transactionCount : 0;

                // Đếm theo phương thức thanh toán
                const methodCounts = {};
                allTransactions.forEach(t => {
                    methodCounts[t.method] = (methodCounts[t.method] || 0) + 1;
                });

                // Tạo HTML cho chi tiết giao dịch
                const transactionHTML = allTransactions.length > 0 
                    ? allTransactions.map((transaction, idx) => {
                        const dateObj = new Date(transaction.date);
                        const formattedDate = dateObj.toLocaleDateString('vi-VN');

                        return `
                            <tr data-transaction-id="${transaction.id}" style="border-bottom: 1px solid #e5e7eb; hover-effect;">
                                <td style="padding: 12px; text-align: left;">
                                    <strong style="color: var(--text-primary);">${transaction.id}</strong><br>
                                    <span style="font-size: 12px; color: #6b7280;">${formattedDate} ${transaction.time}</span>
                                </td>
                                <td style="padding: 12px; text-align: left;">
                                    <div style="margin-bottom: 4px;">
                                        <strong>${transaction.orderId}</strong>
                                    </div>
                                    <span style="font-size: 12px; color: #6b7280;">${transaction.customerName}</span>
                                </td>
                                <td style="padding: 12px; text-align: right;">
                                    <strong style="color: #059669; font-size: 15px;">${transaction.amount.toLocaleString('vi-VN')} VNĐ</strong>
                                </td>
                                <td style="padding: 12px; text-align: center;">
                                    <span style="background: #dbeafe; color: #1e40af; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">
                                        ${transaction.method}
                                    </span>
                                </td>
                                <td style="padding: 12px; text-align: left;">
                                    ${transaction.notes ? `<span style="font-size: 12px; color: #6b7280;">📝 ${transaction.notes}</span>` : '<span style="color: #d1d5db;">-</span>'}
                                </td>
                                <td style="padding: 12px; text-align: center;">
                                    <button onclick="app.showOrderPaymentHistory(${transaction.orderIndex})" style="
                                        background: #3b82f6;
                                        color: white;
                                        border: none;
                                        padding: 6px 12px;
                                        border-radius: 4px;
                                        cursor: pointer;
                                        font-size: 12px;
                                        font-weight: 600;
                                    ">
                                        Chi tiết
                                    </button>
                                </td>
                            </tr>
                        `;
                    }).join('')
                    : '<tr><td colspan="6" style="padding: 20px; text-align: center; color: #6b7280;">Chưa có giao dịch thanh toán nào</td></tr>';

                // Tạo thống kê phương thức
                let methodStatsHTML = '';
                Object.entries(methodCounts).forEach(([method, count]) => {
                    const percentage = ((count / transactionCount) * 100).toFixed(1);
                    methodStatsHTML += `
                        <div style="display: flex; align-items: center; margin-bottom: 12px; padding: 12px; background: #f9fafb; border-radius: 8px;">
                            <div style="flex: 1;">
                                <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">${method}</div>
                                <div style="font-size: 12px; color: #6b7280;">${count} giao dịch</div>
                            </div>
                            <div style="display: flex; flex-direction: column; align-items: flex-end;">
                                <div style="font-size: 14px; font-weight: bold; color: #3b82f6;">${percentage}%</div>
                                <div style="width: 100px; height: 6px; background: #e5e7eb; border-radius: 3px; margin-top: 4px; overflow: hidden;">
                                    <div style="width: ${percentage}%; height: 100%; background: #3b82f6;"></div>
                                </div>
                            </div>
                        </div>
                    `;
                });

                return `
                    <div class="fade-in">
                        <div class="stats-grid" style="margin-bottom: 24px;">
                            <div class="stat-card success">
                                <div class="stat-header">
                                    <span class="stat-title">Tổng đã thu</span>
                                    <span class="stat-icon">💰</span>
                                </div>
                                <div class="stat-value">${totalPaid.toLocaleString('vi-VN')} VNĐ</div>
                                <div class="stat-change positive">${transactionCount} giao dịch</div>
                            </div>

                            <div class="stat-card info">
                                <div class="stat-header">
                                    <span class="stat-title">Trung bình/giao dịch</span>
                                    <span class="stat-icon">📊</span>
                                </div>
                                <div class="stat-value">${avgTransaction.toLocaleString('vi-VN')} VNĐ</div>
                                <div class="stat-change">${transactionCount} giao dịch</div>
                            </div>

                            <div class="stat-card warning">
                                <div class="stat-header">
                                    <span class="stat-title">Hôm nay</span>
                                    <span class="stat-icon">📅</span>
                                </div>
                                <div class="stat-value">${allTransactions.filter(t => t.date === this.getVietnamTime().toISOString().split('T')[0]).reduce((sum, t) => sum + t.amount, 0).toLocaleString('vi-VN')} VNĐ</div>
                                <div class="stat-change">${allTransactions.filter(t => t.date === this.getVietnamTime().toISOString().split('T')[0]).length} giao dịch</div>
                            </div>
                        </div>

                        <!-- Tabs -->
                        <div style="display: flex; gap: 12px; margin-bottom: 24px; border-bottom: 2px solid #e5e7eb;">
                            <button onclick="document.getElementById('transactions-tab').style.display='block'; document.getElementById('stats-tab').style.display='none'; this.style.borderBottom='3px solid var(--primary-blue)'; this.nextElementSibling.style.borderBottom='none';"
                                    style="padding: 12px 24px; background: none; border: none; cursor: pointer; font-weight: 600; color: var(--primary-blue); font-size: 14px;">
                                💳 Danh sách giao dịch
                            </button>
                            <button onclick="document.getElementById('stats-tab').style.display='block'; document.getElementById('transactions-tab').style.display='none'; this.style.borderBottom='3px solid var(--primary-blue)'; this.previousElementSibling.style.borderBottom='none';"
                                    style="padding: 12px 24px; background: none; border: none; cursor: pointer; font-weight: 600; color: #9ca3af; font-size: 14px;">
                                📊 Phân tích
                            </button>
                        </div>

                        <!-- Transactions List Tab -->
                        <div id="transactions-tab">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                                <h3 style="margin: 0; color: var(--text-primary);">Danh sách giao dịch thanh toán</h3>
                                <button onclick="app.exportPaymentTransactions()" style="
                                    background: var(--primary-green);
                                    color: white;
                                    border: none;
                                    padding: 8px 16px;
                                    border-radius: 6px;
                                    cursor: pointer;
                                    font-size: 12px;
                                    font-weight: 600;
                                ">
                                    📥 Xuất CSV
                                </button>
                            </div>
                            <div style="overflow-x: auto;">
                                <table style="width: 100%; border-collapse: collapse; background: white;">
                                    <thead>
                                        <tr style="background: #f3f4f6;">
                                            <th style="padding: 12px; text-align: left; font-weight: 600; color: var(--text-primary);">Mã giao dịch & Ngày</th>
                                            <th style="padding: 12px; text-align: left; font-weight: 600; color: var(--text-primary);">Đơn hàng & Khách hàng</th>
                                            <th style="padding: 12px; text-align: right; font-weight: 600; color: var(--text-primary);">Số tiền</th>
                                            <th style="padding: 12px; text-align: center; font-weight: 600; color: var(--text-primary);">Phương thức</th>
                                            <th style="padding: 12px; text-align: left; font-weight: 600; color: var(--text-primary);">Ghi chú</th>
                                            <th style="padding: 12px; text-align: center; font-weight: 600; color: var(--text-primary);">Hành động</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${transactionHTML}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <!-- Stats Tab -->
                        <div id="stats-tab" style="display: none;">
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
                                <div>
                                    <h3 style="margin: 0 0 16px 0; color: var(--text-primary);">Thống kê theo phương thức thanh toán</h3>
                                    ${methodStatsHTML || '<p style="color: #6b7280;">Chưa có dữ liệu..</p>'}
                                </div>
                                <div>
                                    <h3 style="margin: 0 0 16px 0; color: var(--text-primary);">Tổng hợp</h3>
                                    <div style="padding: 16px; background: #f9fafb; border-radius: 8px;">
                                        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                                            <span style="color: #6b7280;">Tổng giao dịch:</span>
                                            <strong style="color: var(--text-primary);">${transactionCount}</strong>
                                        </div>
                                        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                                            <span style="color: #6b7280;">Tổng số tiền:</span>
                                            <strong style="color: #059669; font-size: 16px;">${totalPaid.toLocaleString('vi-VN')} VNĐ</strong>
                                        </div>
                                        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                                            <span style="color: #6b7280;">Trung bình:</span>
                                            <strong style="color: var(--text-primary);">${avgTransaction.toLocaleString('vi-VN')} VNĐ</strong>
                                        </div>
                                        <div style="display: flex; justify-content: space-between; padding: 8px 0;">
                                            <span style="color: #6b7280;">Phương thức phổ biến:</span>
                                            <strong style="color: var(--text-primary);">${Object.keys(methodCounts).length > 0 ? Object.entries(methodCounts).sort((a, b) => b[1] - a[1])[0][0] : 'N/A'}</strong>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }

            getOrdersContent() {
                // Sử dụng ngày hiện tại theo múi giờ Việt Nam (UTC+7)
                const vietnamTime = this.getVietnamTime();
                const todayStr = vietnamTime.toISOString().split('T')[0];
                const todayOrders = this.demoData.orders.filter(order => order.date === todayStr);
                const weekOrders = this.demoData.orders.filter(order => {
                    const orderDate = new Date(order.date);
                    const today = new Date(vietnamTime);
                    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                    return orderDate >= weekAgo && orderDate <= today;
                });
                const monthOrders = this.demoData.orders.filter(order => {
                    const orderDate = new Date(order.date);
                    const today = new Date(vietnamTime);
                    return orderDate.getMonth() === today.getMonth() && orderDate.getFullYear() === today.getFullYear();
                });

                // Đơn hàng đã được sắp xếp sẵn (mới nhất ở đầu) nhờ unshift() trong createOrder()
                const sortedOrders = this.demoData.orders; // Không cần reverse vì đã unshift()
                console.log('📋 Danh sách đơn hàng (mới nhất ở đầu):', sortedOrders.map(o => `${o.id} (${o.date} ${o.time})`));

                const ordersTable = sortedOrders.map((order, index) => {
                    const originalIndex = this.demoData.orders.findIndex(o => o.id === order.id);
                    return `
                    <tr data-order-index="${originalIndex}">
                        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${order.id}</td>
                        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${order.customerName}</td>
                        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${order.date} ${order.time}</td>
                        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${order.total.toLocaleString('vi-VN')} VNĐ</td>
                        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
                            ${(() => {
                                const delivered = (order.products || []).reduce((sum, item) => sum + (item.deliveredQty || 0), 0);
                                const ordered = (order.products || []).reduce((sum, item) => sum + (item.quantity || 0), 0);
                                const progress = ordered > 0 ? Math.round((delivered / ordered) * 100) : 0;
                                return `<div style="display: flex; flex-direction: column; gap: 4px;">
                                            <span>${delivered}/${ordered}</span>
                                            <span style="font-size: 11px; color: #6b7280;">${progress}%</span>
                                            ${order.deliveryMethod ? `<span style="font-size: 11px; color: #6b7280;">PT: ${order.deliveryMethod}</span>` : ''}
                                        </div>`;
                            })()}
                        </td>
                        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${order.paymentMethod}</td>
                        <td class="payment-cell" style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
                            <button ondblclick="app.togglePaymentStatus(${originalIndex})" style="
                                background: ${order.paymentStatus === 'Đã thanh toán' ? '#22c55e' : '#f59e0b'}; 
                                color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600;
                                transition: all 0.3s ease;
                            ">
                                ${order.paymentStatus === 'Đã thanh toán' ? '✓ Đã TT' : 'Công nợ'}
                            </button>
                        </td>
                        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
                            <button onclick="app.showPrintOptionsPopup(${originalIndex})" style="background: var(--primary-green); color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; margin-right: 4px; font-weight: 600;" title="In hóa đơn">IN</button>
                            <button onclick="app.showDeliveryFormForOrder(${originalIndex})" style="background: #3b82f6; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; margin-right: 4px; font-weight: 600;" title="Giao hàng">🚚</button>
                            <button onclick="app.viewOrderDetails(${originalIndex})" style="background: var(--primary-blue); color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; margin-right: 4px;">Chi tiết</button>
                            <button onclick="app.deleteOrder(${originalIndex})" style="background: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer;">Xóa</button>
                        </td>
                    </tr>
                    `;
                }).join('');

                return `
                    <div class="fade-in">
                        <!-- Stats Grid -->
                        <div class="stats-grid" style="margin-bottom: 24px;">
                            <div class="stat-card info">
                                <div class="stat-header">
                                    <span class="stat-title">Đơn hàng hôm nay</span>
                                    <span class="stat-icon">📋</span>
                                </div>
                                <div class="stat-value">${todayOrders.length}</div>
                                <div class="stat-change">Tổng: ${todayOrders.reduce((sum, order) => sum + order.total, 0).toLocaleString('vi-VN')} VNĐ</div>
                            </div>

                            <div class="stat-card success">
                                <div class="stat-header">
                                    <span class="stat-title">Đơn hàng tuần này</span>
                                    <span class="stat-icon">📊</span>
                                </div>
                                <div class="stat-value">${weekOrders.length}</div>
                                <div class="stat-change">Tổng: ${weekOrders.reduce((sum, order) => sum + order.total, 0).toLocaleString('vi-VN')} VNĐ</div>
                            </div>

                            <div class="stat-card revenue">
                                <div class="stat-header">
                                    <span class="stat-title">Đơn hàng tháng này</span>
                                    <span class="stat-icon">💰</span>
                                </div>
                                <div class="stat-value">${monthOrders.length}</div>
                                <div class="stat-change">Tổng: ${monthOrders.reduce((sum, order) => sum + order.total, 0).toLocaleString('vi-VN')} VNĐ</div>
                            </div>

                            <div class="stat-card orders">
                                <div class="stat-header">
                                    <span class="stat-title">Tổng đơn hàng</span>
                                    <span class="stat-icon">📈</span>
                                </div>
                                <div class="stat-value">${this.demoData.orders.length}</div>
                                <div class="stat-change">Tất cả thời gian</div>
                            </div>
                        </div>

                        <div class="quick-actions">
                            <h2 class="section-title">Quản lý đơn hàng</h2>
                            <div class="action-grid" style="margin-bottom: 24px;">
                                <div class="action-button" onclick="app.showCreateOrderForm()">
                                    <div class="action-icon">📝</div>
                                    <div class="action-title">Tạo đơn hàng mới</div>
                                </div>
                                <div class="action-button" onclick="event.stopPropagation(); app.filterOrdersByPeriod('today');">
                                    <div class="action-icon">📅</div>
                                    <div class="action-title">Đơn hàng hôm nay</div>
                                </div>
                                <div class="action-button" onclick="event.stopPropagation(); app.filterOrdersByPeriod('week');">
                                    <div class="action-icon">📊</div>
                                    <div class="action-title">Đơn hàng tuần</div>
                                </div>
                                <div class="action-button" onclick="app.exportOrdersReport()">
                                    <div class="action-icon">📋</div>
                                    <div class="action-title">Xuất báo cáo</div>
                                </div>
                                <div class="action-button" onclick="app.showDeliveryForm()">
                                    <div class="action-icon">🚚</div>
                                    <div class="action-title">Giao hàng</div>
                                </div>
                                <div class="action-button" onclick="app.deleteAllOrders()">
                                    <div class="action-icon">🗑️</div>
                                    <div class="action-title">Xóa tất cả</div>
                                </div>
                            </div>

                            <div style="background: white; border-radius: 12px; padding: 24px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                                <h3 style="margin-bottom: 16px; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
                                    <span>📋</span> Danh sách đơn hàng (${this.demoData.orders.length})
                                </h3>

                                <div style="margin-bottom: 16px;">
                                    <input type="text" id="order-search" placeholder="Tìm kiếm theo mã đơn, khách hàng..." 
                                           style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px;"
                                           oninput="app.searchOrders(this.value)">
                                </div>

                                <div style="overflow-x: auto;">
                                    <table id="orders-table" style="width: 100%; border-collapse: collapse; background: white;">
                                        <thead>
                                            <tr style="background: #f8fafc;">
                                                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb; font-weight: 600;">Mã đơn</th>
                                                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb; font-weight: 600;">Khách hàng</th>
                                                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb; font-weight: 600;">Thời gian</th>
                                                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb; font-weight: 600;">Tổng tiền</th>
                                                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb; font-weight: 600;">Giao hàng</th>
                                                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb; font-weight: 600;">Thanh toán</th>
                                                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb; font-weight: 600;">TT Nhanh</th>
                                                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb; font-weight: 600;">Thao tác</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${ordersTable}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }

            getReportsContent() {
                return `
                    <div class="fade-in">
                        <!-- Bộ lọc ngày tháng -->
                        <div class="filter-section" style="background: white; border-radius: 12px; padding: 24px; margin-bottom: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
                                <h3 style="margin: 0; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
                                    <span>📅</span> Bộ lọc thời gian
                                </h3>
                                <button onclick="app.toggleFilterSection()" style="background: none; border: 1px solid #e5e7eb; padding: 8px 12px; border-radius: 6px; cursor: pointer;">
                                    <span id="filter-toggle-icon">📁</span> Thu gọn
                                </button>
                            </div>

                            <div id="filter-content" class="filter-content">
                                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 16px;">
                                    <div>
                                        <label style="display: block; margin-bottom: 6px; font-weight: 600; color: var(--text-secondary);">Từ ngày:</label>
                                        <input type="date" id="filter-from-date" value="${this.getDefaultFromDate()}" 
                                               style="width: 100%; padding: 8px 12px; border: 2px solid #e5e7eb; border-radius: 6px; font-size: 14px;">
                                    </div>

                                    <div>
                                        <label style="display: block; margin-bottom: 6px; font-weight: 600; color: var(--text-secondary);">Đến ngày:</label>
                                        <input type="date" id="filter-to-date" value="${this.getDefaultToDate()}" 
                                               style="width: 100%; padding: 8px 12px; border: 2px solid #e5e7eb; border-radius: 6px; font-size: 14px;">
                                    </div>

                                    <div>
                                        <label style="display: block; margin-bottom: 6px; font-weight: 600; color: var(--text-secondary);">Lựa chọn nhanh:</label>
                                        <select id="filter-quick-select" onchange="app.applyQuickFilter(this.value)"
                                                style="width: 100%; padding: 8px 12px; border: 2px solid #e5e7eb; border-radius: 6px; font-size: 14px;">
                                            <option value="">Tùy chỉnh</option>
                                            <option value="today">Hôm nay</option>
                                            <option value="yesterday">Hôm qua</option>
                                            <option value="this-week">Tuần này</option>
                                            <option value="last-week">Tuần trước</option>
                                            <option value="this-month">Tháng này</option>
                                            <option value="last-month">Tháng trước</option>
                                            <option value="last-30-days">30 ngày qua</option>
                                            <option value="last-90-days">90 ngày qua</option>
                                            <option value="this-year">Năm này</option>
                                            <option value="last-year">Năm trước</option>
                                        </select>
                                    </div>
                                </div>

                                <div style="display: flex; gap: 12px; align-items: center;">
                                    <button onclick="app.applyDateFilter()" 
                                            style="background: var(--primary-blue); color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: 600;">
                                        🔍 Áp dụng bộ lọc
                                    </button>
                                    <button onclick="app.resetDateFilter()" 
                                            style="background: white; color: var(--text-secondary); border: 2px solid #e5e7eb; padding: 10px 20px; border-radius: 6px; cursor: pointer;">
                                        🔄 Đặt lại
                                    </button>
                                    <div id="filter-info" style="color: var(--text-secondary); font-size: 14px; margin-left: 8px;">
                                        Hiển thị dữ liệu từ <strong>${this.formatDateForDisplay(this.getDefaultFromDate())}</strong> đến <strong>${this.formatDateForDisplay(this.getDefaultToDate())}</strong>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="stats-grid" style="margin-bottom: 24px;">
                            <div class="stat-card revenue">
                                <div class="stat-header">
                                    <span class="stat-title">Doanh thu tháng này</span>
                                    <span class="stat-icon">📈</span>
                                </div>
                                <div class="stat-value">0 VNĐ</div>
                                <div class="stat-change positive">Chưa có dữ liệu</div>
                            </div>

                            <div class="stat-card info">
                                <div class="stat-header">
                                    <span class="stat-title">Lợi nhuận</span>
                                    <span class="stat-icon">💎</span>
                                </div>
                                <div class="stat-value">0 VNĐ</div>
                                <div class="stat-change positive">Chưa có dữ liệu</div>
                            </div>

                            <div class="stat-card warning">
                                <div class="stat-header">
                                    <span class="stat-title">Tổng chi phí</span>
                                    <span class="stat-icon">📉</span>
                                </div>
                                <div class="stat-value">0 VNĐ</div>
                                <div class="stat-change negative">Chưa có dữ liệu</div>
                            </div>
                        </div>

                        <div class="quick-actions">
                            <h2 class="section-title">Báo cáo và Thống kê</h2>

                            <div class="actions-grid">
                                <div class="action-card" onclick="app.showTrendAnalysis()">
                                    <div class="action-icon">📊</div>
                                    <div class="action-title">Phân tích xu hướng</div>
                                    <div class="action-desc">Báo cáo tổng quan với biểu đồ thời gian thực</div>
                                </div>

                                <div class="action-card" onclick="app.showSalesExportWithFilter()">
                                    <div class="action-icon">💰</div>
                                    <div class="action-title">Báo cáo doanh thu</div>
                                    <div class="action-desc">Xuất báo cáo doanh thu theo thời gian</div>
                                </div>

                                <div class="action-card" onclick="app.showTopProductsExportWithFilter()">
                                    <div class="action-icon">🏆</div>
                                    <div class="action-title">Top sản phẩm</div>
                                    <div class="action-desc">Phân tích sản phẩm bán chạy</div>
                                </div>

                                <div class="action-card" onclick="app.showFinancialExportWithFilter()">
                                    <div class="action-icon">📈</div>
                                    <div class="action-title">Báo cáo tài chính</div>
                                    <div class="action-desc">Tổng quan tài chính và công nợ</div>
                                </div>

                                <div class="action-card" onclick="app.loadPage('expenses')">
                                    <div class="action-icon">💸</div>
                                    <div class="action-title">Chi phí vận hành</div>
                                    <div class="action-desc">Nhập và phân tích lương, thuê kho, chi phí khác</div>
                                </div>

                                <div class="action-card" onclick="app.showInventoryExportWithFilter()">
                                    <div class="action-icon">📦</div>
                                    <div class="action-title">Báo cáo tồn kho</div>
                                    <div class="action-desc">Phân tích hàng tồn kho</div>
                                </div>

                                <div class="action-card" onclick="app.showDebtExportWithFilter()">
                                    <div class="action-icon">💳</div>
                                    <div class="action-title">Báo cáo công nợ</div>
                                    <div class="action-desc">Theo dõi tình hình công nợ</div>
                                </div>
                            </div>

                            <div class="recent-activity">
                                <h3 style="margin-bottom: 16px;">Tóm tắt hoạt động kinh doanh:</h3>
                                <div style="color: var(--text-secondary); padding: 20px; text-align: center; background: #f3f4f6; border-radius: 8px;">
                                    Chưa có dữ liệu để hiển thị. Vui lòng tạo đơn hàng hoặc nhập dữ liệu trước.
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }

            getRecentActivities() {
                const activities = [];
                const now = this.getVietnamTime();

                // Sử dụng thời gian THỰC TẾ dựa trên đơn hàng trong hệ thống
                const recentOrders = this.demoData.orders.slice(0, 3);

                recentOrders.forEach((order, index) => {
                    // Tạo thời gian thực tế dựa trên thời gian đơn hàng
                    const orderDateTime = new Date(order.date + 'T' + order.time + ':00');

                    // Nếu đơn hàng là hôm nay, sử dụng thời gian thực
                    const todayStr = now.toISOString().split('T')[0];
                    let activityTime;

                    if (order.date === todayStr) {
                        // Đơn hàng hôm nay - sử dụng thời gian thực từ giờ trong đơn hàng
                        activityTime = orderDateTime;
                    } else {
                        // Đơn hàng ngày khác - tạo thời gian giả định gần đây
                        activityTime = new Date(now.getTime() - (30 + index * 45) * 60 * 1000);
                    }

                    const icon = order.paymentStatus === 'Đã thanh toán' ? 'success' : 'info';
                    const emoji = order.paymentStatus === 'Đã thanh toán' ? '💰' : '📋';
                    const title = order.paymentStatus === 'Đã thanh toán' ? 
                        `Đơn hàng ${order.id} đã hoàn thành` : 
                        `Đơn hàng mới ${order.id}`;
                    const desc = order.paymentStatus === 'Đã thanh toán' ? 
                        `Khách hàng ${order.customerName} đã thanh toán ${order.total.toLocaleString('vi-VN')} VNĐ` :
                        `Khách hàng ${order.customerName} đặt hàng trị giá ${order.total.toLocaleString('vi-VN')} VNĐ`;

                    activities.push({ icon, emoji, title, desc, time: activityTime });
                });

                // Sản phẩm sắp hết hàng
                const lowStockProducts = this.demoData.products.filter(p => p.stock < 10);
                if (lowStockProducts.length > 0) {
                    const product = lowStockProducts[0];
                    const timeAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2 giờ trước THẬT
                    activities.push({
                        icon: 'warning',
                        emoji: '⚠️',
                        title: 'Sản phẩm sắp hết hàng',
                        desc: `${product.name} chỉ còn ${product.stock} sản phẩm trong kho`,
                        time: timeAgo
                    });
                }

                // Khách hàng có công nợ
                const debtCustomers = this.demoData.customers.filter(c => c.debt > 0);
                if (debtCustomers.length > 0) {
                    const customer = debtCustomers[0];
                    const timeAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000); // 3 giờ trước THẬT
                    activities.push({
                        icon: 'warning',
                        emoji: '💳',
                        title: 'Nhắc nợ khách hàng',
                        desc: `${customer.name} có công nợ ${customer.debt.toLocaleString('vi-VN')} VNĐ`,
                        time: timeAgo
                    });
                }

                console.log('🕐 Thời gian Việt Nam hiện tại:', this.formatVietnameseTime(now));
                console.log('🕐 Hoạt động với thời gian THỰC TẾ:', activities.map(a => {
                    const timeStr = this.getTimeAgo(a.time);
                    const actualTime = this.formatVietnameseTime(a.time);
                    return `${a.title} - ${timeStr} (thực tế: ${actualTime})`;
                }));
                console.log('📝 KIỂM TRA: Nếu vẫn thấy "Đơn hàng mới được tạo" có nghĩa là đang cache - hãy nhấn Ctrl+F5!');
                console.log('⏰ THỜI GIAN HIỆN TẠI:', this.formatVietnameseTime(now));

                // Thêm thông báo nếu có vấn đề cache
                if (activities.length === 0) {
                    console.log('❌ WARNING: No activities generated - possible cache issue!');
                }

                return activities.slice(0, 5).map(activity => `
                    <div class="activity-item">
                        <div class="activity-icon ${activity.icon}">${activity.emoji}</div>
                        <div class="activity-content">
                            <div class="activity-title">${activity.title}</div>
                            <div class="activity-desc">${activity.desc}</div>
                        </div>
                        <div class="activity-time">${this.getTimeAgo(activity.time)}</div>
                    </div>
                `).join('');
            }

            getCompanyInfoContent() {
                // Get company settings from localStorage with debugging
                const companySettings = this.getCompanySettings();
                console.log('=== LOADING COMPANY INFO PAGE ===');
                console.log('Logo exists:', !!companySettings.logo);
                console.log('QR exists:', !!companySettings.qrCode);
                if (companySettings.logo) {
                    console.log('Logo data length:', companySettings.logo.length);
                }
                if (companySettings.qrCode) {
                    console.log('QR data length:', companySettings.qrCode.length);
                }

                return `
                    <div class="fade-in">
                        <!-- Company Information Settings -->
                        <div class="quick-actions" style="margin-bottom: 24px;">
                            <h2 class="section-title">🏢 Thông tin Công ty/Cửa hàng</h2>

                            <!-- Logo và QR Code Section -->
                            <div style="background: white; padding: 24px; border-radius: 12px; border: 2px solid #e5e7eb; margin-bottom: 24px;">
                                <h3 style="margin-bottom: 16px; color: var(--text-primary); border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">📸 Logo & Mã QR</h3>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; align-items: start;">
                                    <!-- Logo Section -->
                                    <div style="text-align: center;">
                                        <h4 style="margin-bottom: 12px; color: var(--text-secondary);">Logo Công ty</h4>
                                        <div id="logo-display" style="border: 2px dashed #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 12px; min-height: 150px; display: flex; align-items: center; justify-content: center; background: #f9fafb;">
                                            ${companySettings.logo ? 
                                                `<img src="${companySettings.logo}" alt="Logo" style="max-width: 100%; max-height: 140px; object-fit: contain;">` :
                                                '<div style="color: #9ca3af; font-size: 14px;">Chưa có logo</div>'
                                            }
                                        </div>
                                        <input type="file" id="logo-input" accept="image/*" onchange="app.uploadLogoSimple(event)" style="display: none;">
                                        <div style="display: flex; gap: 8px; justify-content: center;">
                                            <button type="button" onclick="document.getElementById('logo-input').click()" 
                                                    style="background: var(--primary-blue); color: white; padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">
                                                📁 Chọn Logo
                                            </button>
                                            ${companySettings.logo ? 
                                                `<button type="button" onclick="app.removeLogo()" 
                                                        style="background: #dc2626; color: white; padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">
                                                    🗑️ Xóa
                                                </button>` : ''
                                            }
                                        </div>
                                    </div>

                                    <!-- QR Code Section -->
                                    <div style="text-align: center;">
                                        <h4 style="margin-bottom: 12px; color: var(--text-secondary);">Mã QR Liên hệ</h4>
                                        <div id="qr-display" style="border: 2px dashed #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 12px; min-height: 150px; display: flex; align-items: center; justify-content: center; background: #f9fafb;">
                                            ${companySettings.qrCode ? 
                                                `<img src="${companySettings.qrCode}" alt="QR Code" style="max-width: 100%; max-height: 140px; object-fit: contain;">` :
                                                '<div style="color: #9ca3af; font-size: 14px;">Chưa có mã QR</div>'
                                            }
                                        </div>
                                        <input type="file" id="qr-input" accept="image/*" onchange="app.uploadQRSimple(event)" style="display: none;">
                                        <div style="display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;">
                                            <button type="button" onclick="app.generateQRCode()" 
                                                    style="background: #059669; color: white; padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">
                                                🔄 Tạo QR
                                            </button>
                                            <button type="button" onclick="document.getElementById('qr-input').click()" 
                                                    style="background: var(--primary-blue); color: white; padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">
                                                📁 Upload QR
                                            </button>
                                            ${companySettings.qrCode ? 
                                                `<button type="button" onclick="app.removeQR()" 
                                                        style="background: #dc2626; color: white; padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">
                                                    🗑️ Xóa
                                                </button>` : ''
                                            }
                                        </div>
                                        <div style="margin-top: 8px; font-size: 12px; color: #6b7280;">
                                            Tạo tự động hoặc upload file riêng
                                        </div>
                                        <button type="button" onclick="app.testLocalStorage()" 
                                                style="background: #f59e0b; color: white; padding: 4px 8px; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; margin-top: 8px;">
                                            🔍 Debug Data
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div style="background: white; padding: 24px; border-radius: 12px; border: 2px solid #e5e7eb;">
                                <h3 style="margin-bottom: 16px; color: var(--text-primary); border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">📋 Thông tin chi tiết</h3>
                                <form onsubmit="app.saveCompanySettings(event)" style="display: grid; gap: 16px;">
                                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                                        <div>
                                            <label style="display: block; margin-bottom: 8px; font-weight: 600;">Tên công ty/cửa hàng: *</label>
                                            <input type="text" name="companyName" value="${companySettings.companyName || ''}" 
                                                   placeholder="VD: Công ty TNHH ABC" required
                                                   style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                        </div>

                                        <div>
                                            <label style="display: block; margin-bottom: 8px; font-weight: 600;">Mã số thuế:</label>
                                            <input type="text" name="taxCode" value="${companySettings.taxCode || ''}" 
                                                   placeholder="VD: 0123456789"
                                                   style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                        </div>
                                    </div>

                                    <div>
                                        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Địa chỉ: *</label>
                                        <input type="text" name="address" value="${companySettings.address || ''}" 
                                               placeholder="VD: 123 Đường ABC, Quận XYZ, TP.HCM" required
                                               style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                    </div>

                                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                                        <div>
                                            <label style="display: block; margin-bottom: 8px; font-weight: 600;">Số điện thoại: *</label>
                                            <input type="tel" name="phone" value="${companySettings.phone || ''}" 
                                                   placeholder="VD: 0123456789" required
                                                   style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                        </div>

                                        <div>
                                            <label style="display: block; margin-bottom: 8px; font-weight: 600;">Email:</label>
                                            <input type="email" name="email" value="${companySettings.email || ''}" 
                                                   placeholder="VD: info@company.com"
                                                   style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                        </div>
                                    </div>

                                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                                        <div>
                                            <label style="display: block; margin-bottom: 8px; font-weight: 600;">Người đại diện:</label>
                                            <input type="text" name="representative" value="${companySettings.representative || ''}" 
                                                   placeholder="VD: Nguyễn Văn A"
                                                   style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                        </div>

                                        <div>
                                            <label style="display: block; margin-bottom: 8px; font-weight: 600;">Chức vụ:</label>
                                            <input type="text" name="position" value="${companySettings.position || ''}" 
                                                   placeholder="VD: Giám đốc"
                                                   style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                        </div>
                                    </div>

                                    <div>
                                        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Slogan/Mô tả:</label>
                                        <textarea name="description" rows="2" placeholder="VD: Chất lượng - Uy tín - Giá tốt"
                                                  style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; resize: vertical;">${companySettings.description || ''}</textarea>
                                    </div>

                                    <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 8px;">
                                        <button type="button" onclick="app.resetCompanySettings()" 
                                                style="padding: 12px 24px; border: 2px solid #ef4444; color: #ef4444; background: white; border-radius: 8px; cursor: pointer; font-weight: 600;">
                                            🔄 Reset
                                        </button>
                                        <button type="submit" 
                                                style="padding: 12px 24px; background: var(--success-gradient); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
                                            💾 Lưu thông tin
                                        </button>
                                    </div>
                                </form>

                                <div style="margin-top: 16px; padding: 12px; background: #f0f9ff; border-radius: 8px; font-size: 14px; color: #1e40af;">
                                    <strong>💡 Lưu ý:</strong> Thông tin này sẽ hiển thị trên tất cả hóa đơn in ra. Vui lòng kiểm tra kỹ trước khi lưu.
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }

            getSettingsContent() {
                const lastBackupTime = localStorage.getItem('last_backup_time');
                const autoBackupEnabled = localStorage.getItem('auto_backup_enabled') === 'true';
                const backupInterval = localStorage.getItem('backup_interval') || '30';

                return `
                    <div class="fade-in">
                        <div class="quick-actions" style="margin-bottom: 24px;">
                            <h2 class="section-title">⚙️ Cài đặt Sao lưu</h2>

                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px;">
                                <div style="background: white; padding: 20px; border-radius: 12px; border: 2px solid #e5e7eb;">
                                    <h3 style="margin-bottom: 16px; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
                                        <span>🔄</span> Tự động sao lưu
                                    </h3>
                                    <div style="margin-bottom: 16px;">
                                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                                            <input type="checkbox" id="auto-backup-toggle" ${autoBackupEnabled ? 'checked' : ''} 
                                                   onchange="app.toggleAutoBackup(this.checked)" 
                                                   style="width: 16px; height: 16px;">
                                            <span>Bật tự động sao lưu</span>
                                        </label>
                                    </div>

                                    <div style="margin-bottom: 16px;">
                                        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Tần suất:</label>
                                        <select id="backup-interval" onchange="app.setBackupInterval(this.value)" 
                                                style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px;">
                                            <option value="15" ${backupInterval === '15' ? 'selected' : ''}>15 phút</option>
                                            <option value="30" ${backupInterval === '30' ? 'selected' : ''}>30 phút</option>
                                            <option value="60" ${backupInterval === '60' ? 'selected' : ''}>60 phút</option>
                                        </select>
                                    </div>

                                    <div style="font-size: 12px; color: #6b7280;">
                                        Trạng thái: <span id="backup-status">${autoBackupEnabled ? '🟢 Đang hoạt động' : '🔴 Tắt'}</span><br>
                                        Lần cuối: ${lastBackupTime ? new Date(lastBackupTime).toLocaleString('vi-VN') : 'Chưa có'}
                                    </div>
                                </div>

                                <div style="background: white; padding: 20px; border-radius: 12px; border: 2px solid #e5e7eb;">
                                    <h3 style="margin-bottom: 16px; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
                                        <span>💾</span> Sao lưu thủ công
                                    </h3>

                                    <button onclick="app.manualBackup()" 
                                            style="width: 100%; background: var(--success-gradient); color: white; padding: 12px; 
                                                   border: none; border-radius: 8px; cursor: pointer; margin-bottom: 12px; font-weight: 600;">
                                        📁 Tải xuống bản sao lưu
                                    </button>

                                    <div style="margin-bottom: 12px;">
                                        <input type="file" id="restore-file" accept=".json" style="display: none;" onchange="app.restoreFromFile(event)">
                                        <button onclick="document.getElementById('restore-file').click()" 
                                                style="width: 100%; background: var(--header-gradient); color: white; padding: 12px; 
                                                       border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
                                            📤 Khôi phục từ file
                                        </button>
                                    </div>

                                    <div style="font-size: 12px; color: #6b7280; text-align: center;">
                                        File được lưu định dạng JSON<br>
                                        Tự động tải về thư mục Downloads
                                    </div>
                                </div>

                                <div style="background: #fef2f2; padding: 20px; border-radius: 12px; border: 2px solid #fecaca;">
                                    <h3 style="margin-bottom: 16px; color: #dc2626; display: flex; align-items: center; gap: 8px;">
                                        <span>⚠️</span> Xóa toàn bộ dữ liệu
                                    </h3>
                                    <p style="margin-bottom: 12px; font-size: 14px; color: #7f1d1d;">
                                        ⛔ <strong>Cảnh báo:</strong> Hành động này sẽ xóa vĩnh viễn tất cả dữ liệu (khách hàng, sản phẩm, đơn hàng, v.v.). Không thể khôi phục!
                                    </p>
                                    <button onclick="app.deleteAllData()" 
                                            style="width: 100%; background: #dc2626; color: white; padding: 12px; 
                                                   border: none; border-radius: 8px; cursor: pointer; font-weight: 600; hover: background #991b1b;">
                                        🗑️ Xóa toàn bộ dữ liệu
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div class="quick-actions">
                            <h2 class="section-title">📊 Thông tin Hệ thống</h2>
                            <div class="stats-grid" style="margin-bottom: 20px;">
                                <div class="stat-card info">
                                    <div class="stat-header">
                                        <span class="stat-title">Dữ liệu lưu trữ</span>
                                        <span class="stat-icon">💾</span>
                                    </div>
                                    <div class="stat-value" id="storage-size">${this.calculateStorageSize()}</div>
                                    <div class="stat-change">LocalStorage</div>
                                </div>

                                <div class="stat-card success">
                                    <div class="stat-header">
                                        <span class="stat-title">Tổng bản ghi</span>
                                        <span class="stat-icon">📋</span>
                                    </div>
                                    <div class="stat-value">${Object.values(this.demoData).reduce((total, arr) => total + (Array.isArray(arr) ? arr.length : 0), 0)}</div>
                                    <div class="stat-change">Bản ghi</div>
                                </div>
                            </div>

                            <div class="recent-activity">
                                <h3 style="margin-bottom: 16px;">Chi tiết dữ liệu:</h3>
                                <div class="activity-item">
                                    <div class="activity-icon info">👥</div>
                                    <div class="activity-content">
                                        <div class="activity-title">Khách hàng</div>
                                        <div class="activity-desc">${this.demoData.customers.length} khách hàng đã được lưu trữ</div>
                                    </div>
                                    <div class="activity-time">${this.demoData.customers.length}</div>
                                </div>

                                <div class="activity-item">
                                    <div class="activity-icon info">🏢</div>
                                    <div class="activity-content">
                                        <div class="activity-title">Nhà cung cấp</div>
                                        <div class="activity-desc">${this.demoData.suppliers.length} nhà cung cấp đã được lưu trữ</div>
                                    </div>
                                    <div class="activity-time">${this.demoData.suppliers.length}</div>
                                </div>

                                <div class="activity-item">
                                    <div class="activity-icon info">📦</div>
                                    <div class="activity-content">
                                        <div class="activity-title">Sản phẩm</div>
                                        <div class="activity-desc">${this.demoData.products.length} sản phẩm trong danh mục</div>
                                    </div>
                                    <div class="activity-time">${this.demoData.products.length}</div>
                                </div>

                                <div class="activity-item">
                                    <div class="activity-icon info">💰</div>
                                    <div class="activity-content">
                                        <div class="activity-title">Đơn hàng</div>
                                        <div class="activity-desc">${this.demoData.orders.length} đơn bán hàng đã lưu trữ</div>
                                    </div>
                                    <div class="activity-time">${this.demoData.orders.length}</div>
                                </div>
                            </div>
                        </div>

                        <!-- Phần lịch sử hoạt động -->
                        <div class="quick-actions" style="margin-top: 24px;">
                            <h2 class="section-title">📋 Lịch sử Hoạt động</h2>
                            <div style="background: white; border-radius: 12px; border: 2px solid #e5e7eb; padding: 20px;">
                                ${this.getSystemActivityHistory()}
                            </div>
                        </div>
                    </div>
                `;
            }

            getSystemActivityHistory() {
                // Lấy tất cả hoạt động từ localStorage và hệ thống
                let activities = JSON.parse(localStorage.getItem('system_activity_history') || '[]');

                // Nếu chưa có lịch sử, tạo một số hoạt động mẫu từ dữ liệu hiện tại
                if (activities.length === 0) {
                    activities = this.generateInitialActivityHistory();
                    localStorage.setItem('system_activity_history', JSON.stringify(activities));
                }

                // Sắp xếp theo thời gian mới nhất
                activities.sort((a, b) => new Date(b.time) - new Date(a.time));

                // Hiển thị 20 hoạt động gần nhất
                const recentActivities = activities.slice(0, 20);

                let html = `
                    <div style="margin-bottom: 16px;">
                        <h3 style="margin: 0; display: flex; align-items: center; gap: 8px;">
                            <span>🕒</span> Lịch sử Hoạt động Gần đây
                        </h3>
                    </div>

                    <div style="max-height: 400px; overflow-y: auto; border: 1px solid #e5e7eb; border-radius: 8px; background: #f9fafb;">
                `;

                if (recentActivities.length === 0) {
                    html += `
                        <div style="padding: 40px; text-align: center; color: #6b7280;">
                            <div style="font-size: 48px; margin-bottom: 16px;">📝</div>
                            <p>Chưa có hoạt động nào được ghi nhận</p>
                        </div>
                    `;
                } else {
                    recentActivities.forEach((activity, index) => {
                        const timeAgo = this.getTimeAgoText(activity.time);
                        const borderBottom = index < recentActivities.length - 1 ? 'border-bottom: 1px solid #e5e7eb;' : '';

                        html += `
                            <div style="padding: 12px 16px; ${borderBottom} display: flex; align-items: flex-start; gap: 12px;">
                                <div class="activity-icon ${activity.type}" style="width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; flex-shrink: 0;">
                                    ${activity.icon}
                                </div>
                                <div style="flex: 1; min-width: 0;">
                                    <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">
                                        ${activity.title}
                                    </div>
                                    <div style="color: #6b7280; font-size: 14px; margin-bottom: 4px;">
                                        ${activity.description}
                                    </div>
                                    <div style="color: #9ca3af; font-size: 12px;">
                                        ${timeAgo}
                                    </div>
                                </div>
                            </div>
                        `;
                    });
                }

                html += `
                    </div>
                    <div style="margin-top: 12px; padding: 12px; background: #f0f9ff; border-radius: 8px; font-size: 14px; color: #1e40af;">
                        <strong>💡 Thông tin:</strong> Hệ thống tự động ghi nhận tất cả các hoạt động quan trọng để bạn theo dõi.
                    </div>
                `;

                return html;
            }

            generateInitialActivityHistory() {
                const now = this.getVietnamTime();
                const activities = [];

                // Hoạt động từ đơn hàng gần đây
                this.demoData.orders.slice(0, 5).forEach((order, index) => {
                    const orderTime = new Date(now.getTime() - (30 + index * 15) * 60 * 1000);
                    activities.push({
                        id: 'order_' + order.id,
                        type: order.paymentStatus === 'Đã thanh toán' ? 'success' : 'info',
                        icon: order.paymentStatus === 'Đã thanh toán' ? '💰' : '📋',
                        title: `Đơn hàng ${order.id}`,
                        description: `${order.paymentStatus === 'Đã thanh toán' ? 'Đã thanh toán' : 'Tạo mới'} - Khách hàng: ${order.customerName} - Giá trị: ${order.total.toLocaleString('vi-VN')} VNĐ`,
                        time: orderTime.toISOString(),
                        category: 'order'
                    });
                });

                // Hoạt động hệ thống
                activities.push({
                    id: 'system_start',
                    type: 'info',
                    icon: '🚀',
                    title: 'Khởi động hệ thống',
                    description: 'Hệ thống ERP đã được khởi động và sẵn sàng hoạt động',
                    time: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
                    category: 'system'
                });

                activities.push({
                    id: 'data_loaded',
                    type: 'success',
                    icon: '💾',
                    title: 'Tải dữ liệu thành công',
                    description: `Đã tải ${this.demoData.customers.length} khách hàng, ${this.demoData.products.length} sản phẩm, ${this.demoData.orders.length} đơn hàng`,
                    time: new Date(now.getTime() - 90 * 60 * 1000).toISOString(),
                    category: 'system'
                });

                return activities;
            }

            addActivityLog(type, icon, title, description, category = 'user') {
                let activities = JSON.parse(localStorage.getItem('system_activity_history') || '[]');

                const newActivity = {
                    id: 'activity_' + Date.now(),
                    type: type,
                    icon: icon,
                    title: title,
                    description: description,
                    time: this.getVietnamTime().toISOString(),
                    category: category
                };

                activities.unshift(newActivity);

                // Giữ lại tối đa 100 hoạt động
                if (activities.length > 100) {
                    activities = activities.slice(0, 100);
                }

                localStorage.setItem('system_activity_history', JSON.stringify(activities));
            }



            getTimeAgoText(timeString) {
                const now = this.getVietnamTime();
                const time = new Date(timeString);
                const diffMs = now - time;
                const diffMins = Math.floor(diffMs / (1000 * 60));
                const diffHours = Math.floor(diffMins / 60);
                const diffDays = Math.floor(diffHours / 24);

                if (diffMins < 1) return 'Vừa xong';
                if (diffMins < 60) return `${diffMins} phút trước`;
                if (diffHours < 24) return `${diffHours} giờ trước`;
                if (diffDays < 7) return `${diffDays} ngày trước`;

                return time.toLocaleDateString('vi-VN', {
                    day: '2-digit',
                    month: '2-digit', 
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            }

            showNotification(message, type = 'info') {
                const notification = document.getElementById('notification');
                if (!notification) return;

                notification.textContent = message;
                notification.className = `notification show ${type}`;

                setTimeout(() => {
                    notification.classList.remove('show');
                }, 3000);
            }

            showCompanyInfo() {
                const infoHTML = `
                    <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1001; display: flex; justify-content: center; align-items: center;" onclick="closeModal(this)">
                        <div style="background: white; padding: 32px; border-radius: 16px; width: 500px; max-width: 90vw; text-align: center; box-shadow: 0 20px 50px rgba(0,0,0,0.3);" onclick="event.stopPropagation()">
                            <div style="font-size: 48px; margin-bottom: 16px;">🏪</div>
                            <h3 style="color: var(--primary-blue); margin-bottom: 20px; font-size: 24px; font-weight: bold;">PITC - PhuocIT.com</h3>

                            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                                <h4 style="margin-bottom: 12px; font-size: 18px;">📦 Sản phẩm thuộc PhuocIT.com</h4>
                                <p style="margin-bottom: 0; font-size: 16px; line-height: 1.4;">✨ Chia sẻ Miễn Phí</p>
                            </div>

                            <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid var(--success-color);">
                                <p style="margin: 0; color: #374151; line-height: 1.5;">
                                    💡 Nếu cần bổ sung tính năng có thể liên hệ để được hỗ trợ tốt nhất.
                                </p>
                            </div>

                            <div style="display: flex; gap: 12px; justify-content: center;">
                                <a href="https://phuocit.com" target="_blank" style="background: var(--header-gradient); color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                                    🌐 Truy cập Website
                                </a>

                            </div>
                        </div>
                    </div>
                `;
                document.body.insertAdjacentHTML('beforeend', infoHTML);
            }

            // Customer Management Functions
            showAddCustomerForm() {
                const formHTML = `
                    <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1001; display: flex; justify-content: center; align-items: center;" onclick="closeModal(this)">
                        <div style="background: white; padding: 32px; border-radius: 12px; width: 600px; max-width: 90vw;" onclick="event.stopPropagation()">
                            <h3 style="margin-bottom: 24px; color: var(--text-primary);">➕ Thêm khách hàng mới</h3>
                            <form onsubmit="app.addCustomer(event)">
                                <!-- Hàng 1: Tên KH và Loại KH -->
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                                    <div>
                                        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Tên khách hàng: *</label>
                                        <input type="text" name="name" required 
                                               style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                    </div>
                                    <div>
                                        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Loại khách hàng: *</label>
                                        <select name="type" required onchange="app.toggleAddCustomerFields(this.value)"
                                               style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                            <option value="">Chọn loại</option>
                                            <option value="ca-nhan">Cá nhân</option>
                                            <option value="doanh-nghiep">Doanh nghiệp</option>
                                        </select>
                                    </div>
                                </div>

                                <!-- Hàng 2: Tên công ty và Phòng ban (ẩn/hiện) -->
                                <div id="add-company-field" style="margin-bottom: 16px; display: none;">
                                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                                        <div>
                                            <label style="display: block; margin-bottom: 8px; font-weight: 600;">Tên công ty: *</label>
                                            <input type="text" name="companyName" 
                                                   style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                        </div>
                                        <div>
                                            <label style="display: block; margin-bottom: 8px; font-weight: 600;">Phòng ban:</label>
                                            <input type="text" name="department" placeholder="VD: Phòng kế toán, Phòng kinh doanh..."
                                                   style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                        </div>
                                    </div>
                                </div>

                                <!-- Hàng 3: Điện thoại và Mã số thuế -->
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                                    <div>
                                        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Số điện thoại: *</label>
                                        <input type="tel" name="phone" required 
                                               style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                    </div>
                                    <div id="add-tax-field" style="display: none;">
                                        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Mã số thuế:</label>
                                        <input type="text" name="taxCode"
                                               style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                    </div>
                                </div>

                                <!-- Hàng 4: Địa chỉ chi tiết -->
                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Địa chỉ:</label>
                                    <textarea name="address" rows="2"
                                              style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; resize: vertical;"></textarea>
                                </div>

                                <!-- Hàng 5: Tỉnh/thành, Quận/huyện, Phường/xã -->
                                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 16px;">
                                    <div>
                                        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Tỉnh/Thành:</label>
                                        <input type="text" name="province"
                                               style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                    </div>
                                    <div>
                                        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Quận/Huyện:</label>
                                        <input type="text" name="district"
                                               style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                    </div>
                                    <div>
                                        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Phường/Xã:</label>
                                        <input type="text" name="ward"
                                               style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                    </div>
                                </div>

                                <!-- Hàng 6: Ghi chú -->
                                <div style="margin-bottom: 24px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Ghi chú khách hàng:</label>
                                    <textarea name="notes" rows="3" placeholder="Nhập ghi chú về khách hàng (không bắt buộc)"
                                              style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; resize: vertical;"></textarea>
                                </div>

                                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                                    <button type="button" onclick="closeModal(this.closest('div[style*=fixed]'))" 
                                            style="padding: 12px 24px; border: 2px solid #e5e7eb; background: white; border-radius: 8px; cursor: pointer;">Hủy</button>
                                    <button type="submit" 
                                            style="padding: 12px 24px; background: var(--primary-blue); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">Thêm khách hàng</button>
                                </div>
                            </form>
                        </div>
                    </div>
                `;
                document.body.insertAdjacentHTML('beforeend', formHTML);
            }

            toggleAddCustomerFields(customerType) {
                const companyField = document.getElementById('add-company-field');
                const taxField = document.getElementById('add-tax-field');
                const companyInput = document.querySelector('input[name="companyName"]');

                if (customerType === 'doanh-nghiep') {
                    companyField.style.display = 'block';
                    taxField.style.display = 'block';
                    companyInput.required = true;
                } else {
                    companyField.style.display = 'none';
                    taxField.style.display = 'none';
                    if (companyInput) {
                        companyInput.required = false;
                        companyInput.value = '';
                    }
                    const taxInput = document.querySelector('input[name="taxCode"]');
                    if (taxInput) taxInput.value = '';
                }
            }

            addCustomer(event) {
                event.preventDefault();
                const form = event.target;
                const formData = new FormData(form);

                const newCustomer = {
                    id: 'KH' + String(this.demoData.customers.length + 1).padStart(3, '0'),
                    name: formData.get('name'),
                    type: formData.get('type'),
                    companyName: formData.get('companyName') || '',
                    department: formData.get('department') || '',
                    phone: formData.get('phone'),
                    address: formData.get('address') || '',
                    province: formData.get('province') || '',
                    district: formData.get('district') || '',
                    ward: formData.get('ward') || '',
                    taxCode: formData.get('taxCode') || '',
                    notes: formData.get('notes') || '',
                    totalOrders: 0
                };

                this.demoData.customers.push(newCustomer);
                this.saveToLocalStorage();
                this.showNotification(`Đã thêm khách hàng ${newCustomer.name}`, 'success');
                this.loadPage('customers');
                const modal = form.closest("div[style*=\"fixed\"]"); if(modal) modal.remove();
            }

            editCustomer(index) {
                const customer = this.demoData.customers[index];
                const customerType = customer.type || 'ca-nhan';
                const companyDisplay = customerType === 'doanh-nghiep' ? 'block' : 'none';
                const taxDisplay = customerType === 'doanh-nghiep' ? 'block' : 'none';

                const formHTML = `
                    <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1001; display: flex; justify-content: center; align-items: center;" onclick="closeModal(this)">
                        <div style="background: white; padding: 32px; border-radius: 12px; width: 600px; max-width: 90vw;" onclick="event.stopPropagation()">
                            <h3 style="margin-bottom: 24px; color: var(--text-primary);">✏️ Sửa thông tin khách hàng</h3>
                            <form onsubmit="app.updateCustomer(event, ${index})">
                                <!-- Hàng 1: Tên KH và Loại KH -->
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                                    <div>
                                        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Tên khách hàng: *</label>
                                        <input type="text" name="name" value="${customer.name}" required 
                                               style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                    </div>
                                    <div>
                                        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Loại khách hàng: *</label>
                                        <select name="type" required onchange="app.toggleEditCustomerFields(this.value)"
                                               style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                            <option value="ca-nhan" ${customerType === 'ca-nhan' ? 'selected' : ''}>Cá nhân</option>
                                            <option value="doanh-nghiep" ${customerType === 'doanh-nghiep' ? 'selected' : ''}>Doanh nghiệp</option>
                                        </select>
                                    </div>
                                </div>

                                <!-- Hàng 2: Tên công ty và Phòng ban (ẩn/hiện) -->
                                <div id="edit-company-field" style="margin-bottom: 16px; display: ${companyDisplay};">
                                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                                        <div>
                                            <label style="display: block; margin-bottom: 8px; font-weight: 600;">Tên công ty: *</label>
                                            <input type="text" name="companyName" value="${customer.companyName || ''}"
                                                   style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                        </div>
                                        <div>
                                            <label style="display: block; margin-bottom: 8px; font-weight: 600;">Phòng ban:</label>
                                            <input type="text" name="department" value="${customer.department || ''}" placeholder="VD: Phòng kế toán, Phòng kinh doanh..."
                                                   style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                        </div>
                                    </div>
                                </div>

                                <!-- Hàng 3: Điện thoại và Mã số thuế -->
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                                    <div>
                                        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Số điện thoại: *</label>
                                        <input type="tel" name="phone" value="${customer.phone}" required 
                                               style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                    </div>
                                    <div id="edit-tax-field" style="display: ${taxDisplay};">
                                        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Mã số thuế:</label>
                                        <input type="text" name="taxCode" value="${customer.taxCode || ''}"
                                               style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                    </div>
                                </div>

                                <!-- Hàng 4: Địa chỉ chi tiết -->
                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Địa chỉ:</label>
                                    <textarea name="address" rows="2"
                                              style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; resize: vertical;">${customer.address || ''}</textarea>
                                </div>

                                <!-- Hàng 5: Tỉnh/thành, Quận/huyện, Phường/xã -->
                                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 16px;">
                                    <div>
                                        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Tỉnh/Thành:</label>
                                        <input type="text" name="province" value="${customer.province || ''}"
                                               style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                    </div>
                                    <div>
                                        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Quận/Huyện:</label>
                                        <input type="text" name="district" value="${customer.district || ''}"
                                               style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                    </div>
                                    <div>
                                        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Phường/Xã:</label>
                                        <input type="text" name="ward" value="${customer.ward || ''}"
                                               style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                    </div>
                                </div>

                                <!-- Hàng 6: Ghi chú -->
                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Ghi chú khách hàng:</label>
                                    <textarea name="notes" rows="3" placeholder="Nhập ghi chú về khách hàng (không bắt buộc)"
                                              style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; resize: vertical;">${customer.notes || ''}</textarea>
                                </div>

                                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                                    <button type="button" onclick="closeModal(this.closest('div[style*=fixed]'))" 
                                            style="padding: 12px 24px; border: 2px solid #e5e7eb; background: white; border-radius: 8px; cursor: pointer;">Hủy</button>
                                    <button type="submit" 
                                            style="padding: 12px 24px; background: var(--primary-blue); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">Cập nhật</button>
                                </div>
                            </form>
                        </div>
                    </div>
                `;
                document.body.insertAdjacentHTML('beforeend', formHTML);
            }

            toggleEditCustomerFields(customerType) {
                const companyField = document.getElementById('edit-company-field');
                const taxField = document.getElementById('edit-tax-field');
                const companyInput = document.querySelector('input[name="companyName"]');

                if (customerType === 'doanh-nghiep') {
                    companyField.style.display = 'block';
                    taxField.style.display = 'block';
                    if (companyInput) companyInput.required = true;
                } else {
                    companyField.style.display = 'none';
                    taxField.style.display = 'none';
                    if (companyInput) {
                        companyInput.required = false;
                        companyInput.value = '';
                    }
                    const taxInput = document.querySelector('input[name="taxCode"]');
                    if (taxInput) taxInput.value = '';
                }
            }

            updateCustomer(event, index) {
                event.preventDefault();
                const form = event.target;
                const formData = new FormData(form);

                this.demoData.customers[index] = {
                    ...this.demoData.customers[index],
                    name: formData.get('name'),
                    type: formData.get('type'),
                    companyName: formData.get('companyName') || '',
                    department: formData.get('department') || '',
                    phone: formData.get('phone'),
                    address: formData.get('address') || '',
                    province: formData.get('province') || '',
                    district: formData.get('district') || '',
                    ward: formData.get('ward') || '',
                    taxCode: formData.get('taxCode') || '',
                    notes: formData.get('notes') || ''
                };

                this.saveToLocalStorage();
                this.showNotification(`Đã cập nhật thông tin khách hàng`, 'success');
                this.loadPage('customers');
                const modal = form.closest("div[style*=\"fixed\"]"); if(modal) modal.remove();
            }

            deleteCustomer(index) {
                const customer = this.demoData.customers[index];
                if (confirm(`Bạn có chắc muốn xóa khách hàng ${customer.name}?`)) {
                    this.demoData.customers.splice(index, 1);
                    this.saveToLocalStorage();
                    this.showNotification(`Đã xóa khách hàng ${customer.name}`, 'success');
                    this.loadPage('customers');
                }
            }

            showCustomerDetails(index) {
                console.log('🔍 showCustomerDetails được gọi với index:', index);
                console.log('👥 Tổng số khách hàng:', this.demoData.customers.length);

                const customer = this.demoData.customers[index];
                if (!customer) {
                    console.error('❌ Không tìm thấy khách hàng ở index:', index);
                    this.showNotification('Không tìm thấy khách hàng', 'error');
                    return;
                }

                console.log('✅ Tìm thấy khách hàng:', customer);

                // Tìm tất cả đơn hàng của khách hàng này
                const customerOrders = this.demoData.orders.filter(order => order.customerId === customer.id);

                // Tính tổng tiền đã mua
                const totalPurchased = customerOrders.reduce((sum, order) => sum + order.total, 0);

                // Tính tổng tiền đã thanh toán
                const totalPaid = customerOrders
                    .reduce((sum, order) => sum + this.getOrderPaidAmount(order), 0);

                // Tính công nợ thực tế từ các đơn hàng chưa thanh toán (không dùng customer.debt cũ)
                const actualDebt = customerOrders
                    .reduce((sum, order) => sum + this.getOrderRemainingBalance(order), 0);

                // Danh sách đơn hàng (sắp xếp mới nhất lên trên)
                const sortedCustomerOrders = this.sortOrdersByDate(customerOrders);
                const ordersTable = sortedCustomerOrders.length > 0 ? sortedCustomerOrders.map((order, orderIndex) => {
                    const originalOrderIndex = this.demoData.orders.findIndex(o => o.id === order.id);
                    return `
                    <tr style="border-bottom: 1px solid #e5e7eb;">
                        <td style="padding: 8px; font-weight: 600;">${order.id}</td>
                        <td style="padding: 8px;">${order.date} ${order.time}</td>
                        <td style="padding: 8px; font-weight: 600; color: var(--primary-blue);">${order.total.toLocaleString('vi-VN')} VNĐ</td>
                        <td style="padding: 8px;">
                            <span style="padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;
                                ${order.status === 'Hoàn thành' ? 'background: #dcfce7; color: #166534;' : ''}
                                ${order.status === 'Đang xử lý' ? 'background: #fef3c7; color: #92400e;' : ''}
                                ${order.status === 'Hủy' ? 'background: #fee2e2; color: #dc2626;' : ''}
                            ">${order.status}</span>
                        </td>
                        <td style="padding: 8px;">
                            <span style="padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;
                                ${order.paymentStatus === 'Đã thanh toán' ? 'background: #dcfce7; color: #166534;' : 'background: #fef3c7; color: #92400e;'}
                            ">${order.paymentStatus}</span>
                        </td>
                        <td style="padding: 8px;">
                            <button onclick="app.viewOrderDetails(${originalOrderIndex})" 
                                    style="background: var(--primary-blue); color: white; padding: 4px 8px; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">
                                Chi tiết
                            </button>
                        </td>
                    </tr>
                    `;
                }).join('') : `<tr><td colspan="6" style="padding: 20px; text-align: center; color: #6b7280;">Chưa có đơn hàng nào</td></tr>`;

                const detailHTML = `
                    <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1001; display: flex; justify-content: center; align-items: center;" onclick="closeModal(this)">
                        <div style="background: white; padding: 32px; border-radius: 12px; width: 800px; max-width: 95vw; max-height: 90vh; overflow-y: auto;" onclick="event.stopPropagation()">
                            <h3 style="margin-bottom: 24px; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
                                <span>👤</span> Chi tiết khách hàng: ${customer.name}
                            </h3>

                            <!-- Thông tin cơ bản -->
                            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 24px; border-left: 4px solid var(--primary-blue);">
                                <h4 style="margin-bottom: 12px; color: var(--text-primary);">
                                    📋 Thông tin cơ bản 
                                    ${customer.type === 'doanh-nghiep' ? '<span style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px; margin-left: 8px;">🏢 DOANH NGHIỆP</span>' : '<span style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px; margin-left: 8px;">👤 CÁ NHÂN</span>'}
                                </h4>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                                    <div><strong>Mã KH:</strong> ${customer.id}</div>
                                    <div><strong>Tên:</strong> ${customer.name}</div>
                                    ${customer.type === 'doanh-nghiep' && customer.companyName ? `<div><strong>Tên công ty:</strong> ${customer.companyName}</div>` : ''}
                                    ${customer.type === 'doanh-nghiep' && customer.department ? `<div><strong>Phòng ban:</strong> ${customer.department}</div>` : ''}
                                    <div><strong>Điện thoại:</strong> ${customer.phone}</div>
                                    ${customer.type === 'doanh-nghiep' && customer.taxCode ? `<div><strong>Mã số thuế:</strong> ${customer.taxCode}</div>` : ''}
                                    <div style="grid-column: 1 / -1;"><strong>Địa chỉ:</strong> ${customer.address || 'Chưa có'}${customer.ward ? ', ' + customer.ward : ''}${customer.district ? ', ' + customer.district : ''}${customer.province ? ', ' + customer.province : ''}</div>
                                    ${customer.notes ? `<div style="grid-column: 1 / -1;"><strong>Ghi chú:</strong> ${customer.notes}</div>` : ''}
                                </div>
                            </div>

                            <!-- Thống kê mua hàng -->
                            <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 24px;">
                                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px; border-radius: 8px; text-align: center;">
                                    <div style="font-size: 18px; font-weight: bold; margin-bottom: 4px;">${customerOrders.length}</div>
                                    <div style="font-size: 12px; opacity: 0.9;">Tổng đơn hàng</div>
                                </div>
                                <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 12px; border-radius: 8px; text-align: center;">
                                    <div style="font-size: 16px; font-weight: bold; margin-bottom: 4px;">${totalPurchased.toLocaleString('vi-VN')} VNĐ</div>
                                    <div style="font-size: 12px; opacity: 0.9;">Tổng tiền mua</div>
                                </div>
                                <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; padding: 12px; border-radius: 8px; text-align: center;">
                                    <div style="font-size: 16px; font-weight: bold; margin-bottom: 4px;">${totalPaid.toLocaleString('vi-VN')} VNĐ</div>
                                    <div style="font-size: 12px; opacity: 0.9;">Đã thanh toán</div>
                                </div>
                                <div style="background: ${actualDebt > 0 ? 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' : 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)'}; color: ${actualDebt > 0 ? 'white' : '#374151'}; padding: 12px; border-radius: 8px; text-align: center;">
                                    <div style="font-size: 16px; font-weight: bold; margin-bottom: 4px;">${actualDebt.toLocaleString('vi-VN')} VNĐ</div>
                                    <div style="font-size: 12px; opacity: 0.9;">Công nợ hiện tại</div>
                                </div>
                                <div onclick="app.exportCustomerReport('${customer.id}', '${customer.name}')" style="background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%); color: #374151; padding: 12px; border-radius: 8px; text-align: center; cursor: pointer; transition: transform 0.2s; position: relative;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                                    <div style="font-size: 16px; font-weight: bold; margin-bottom: 4px;">📄</div>
                                    <div style="font-size: 12px; font-weight: 600;">Xuất báo cáo khách</div>
                                </div>
                            </div>

                            <!-- Lịch sử đơn hàng -->
                            <div>
                                <h4 style="margin-bottom: 16px; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
                                    <span>📊</span> Lịch sử đơn hàng (${customerOrders.length})
                                </h4>
                                <div style="overflow-x: auto; background: white; border-radius: 8px; border: 1px solid #e5e7eb;">
                                    <table style="width: 100%; border-collapse: collapse;">
                                        <thead style="background: #f8fafc;">
                                            <tr>
                                                <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb;">Mã ĐH</th>
                                                <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb;">Ngày/Giờ</th>
                                                <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb;">Tổng tiền</th>
                                                <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb;">Trạng thái</th>
                                                <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb;">Thanh toán</th>
                                                <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb;">Thao tác</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${ordersTable}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div style="display: flex; justify-content: flex-end; margin-top: 24px;">
                                <button type="button" onclick="closeModal(this.closest('div[style*=fixed]'))" 
                                        style="padding: 12px 24px; background: var(--primary-blue); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
                                    Đóng
                                </button>
                            </div>
                        </div>
                    </div>
                `;

                // Cập nhật công nợ thực tế của khách hàng trong dữ liệu (dữ liệu được tính toán từ đơn hàng, không lưu vào trường customer.debt)
                // Lưu lại để đồng bộ nhanh cho các tính năng báo cáo tạm thời
                this.saveToLocalStorage();

                document.body.insertAdjacentHTML('beforeend', detailHTML);
            }

            exportCustomerReport(customerId, customerName) {
                // Hiển thị popup chọn ngày để xuất báo cáo
                this.showDateRangePickerForCustomerReport(customerId, customerName);
            }

            showDateRangePickerForCustomerReport(customerId, customerName) {
                const formHTML = `
                    <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); z-index: 1001; display: flex; justify-content: center; align-items: center;" onclick="closeModal(this)">
                        <div style="background: white; padding: 32px; border-radius: 12px; width: 500px; max-width: 90vw;" onclick="event.stopPropagation()">
                            <h3 style="margin-bottom: 24px; color: var(--text-primary); text-align: center;">📊 Xuất báo cáo khách hàng</h3>
                            <p style="text-align: center; color: #6b7280; margin-bottom: 24px; font-size: 16px; font-weight: 500;">
                                Khách hàng: <span style="color: var(--text-primary);">${customerName}</span>
                            </p>

                            <form onsubmit="app.generateCustomerReport(event, '${customerId}', '${customerName}')">
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
                                    <div>
                                        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">Từ ngày:</label>
                                        <input type="date" name="startDate" required 
                                               style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px;">
                                    </div>
                                    <div>
                                        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">Đến ngày:</label>
                                        <input type="date" name="endDate" required 
                                               style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px;">
                                    </div>
                                </div>

                                <!-- Quick date selection buttons -->
                                <div style="margin-bottom: 20px;">
                                    <p style="margin-bottom: 10px; font-weight: 600; color: #374151; font-size: 14px;">Hoặc chọn nhanh:</p>
                                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
                                        <button type="button" onclick="app.setDateRange('7days', '${customerId}-${customerName}')" 
                                                style="padding: 8px 12px; background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 6px; font-size: 12px; cursor: pointer; transition: all 0.2s;"
                                                onmouseover="this.style.background='#e5e7eb'" onmouseout="this.style.background='#f3f4f6'">
                                            7 ngày qua
                                        </button>
                                        <button type="button" onclick="app.setDateRange('30days', '${customerId}-${customerName}')" 
                                                style="padding: 8px 12px; background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 6px; font-size: 12px; cursor: pointer; transition: all 0.2s;"
                                                onmouseover="this.style.background='#e5e7eb'" onmouseout="this.style.background='#f3f4f6'">
                                            30 ngày qua
                                        </button>
                                        <button type="button" onclick="app.setDateRange('thismonth', '${customerId}-${customerName}')" 
                                                style="padding: 8px 12px; background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 6px; font-size: 12px; cursor: pointer; transition: all 0.2s;"
                                                onmouseover="this.style.background='#e5e7eb'" onmouseout="this.style.background='#f3f4f6'">
                                            Tháng này
                                        </button>
                                    </div>
                                </div>

                                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                                    <button type="button" onclick="closeModal(this.closest('div[style*=fixed]'))" 
                                            style="padding: 12px 24px; border: 2px solid #e5e7eb; background: white; border-radius: 8px; cursor: pointer;">Hủy</button>
                                    <button type="submit" 
                                            style="padding: 12px 24px; background: var(--primary-blue); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
                                        📊 Xuất báo cáo
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                `;
                document.body.insertAdjacentHTML('beforeend', formHTML);

                // Set default dates (last 30 days)
                const endDate = new Date();
                const startDate = new Date();
                startDate.setDate(startDate.getDate() - 30);

                const form = document.querySelector('input[name="startDate"]').closest('form');
                form.querySelector('input[name="startDate"]').value = startDate.toISOString().split('T')[0];
                form.querySelector('input[name="endDate"]').value = endDate.toISOString().split('T')[0];
            }

            setDateRange(period, customerInfo) {
                const [customerId, customerName] = customerInfo.split('-', 2);
                const form = document.querySelector('input[name="startDate"]').closest('form');
                if (!form) return;

                const endDate = new Date();
                const startDate = new Date();

                switch(period) {
                    case '7days':
                        startDate.setDate(startDate.getDate() - 7);
                        break;
                    case '30days':
                        startDate.setDate(startDate.getDate() - 30);
                        break;
                    case 'thismonth':
                        startDate.setDate(1); // First day of current month
                        break;
                }

                form.querySelector('input[name="startDate"]').value = startDate.toISOString().split('T')[0];
                form.querySelector('input[name="endDate"]').value = endDate.toISOString().split('T')[0];
            }

            generateCustomerReport(event, customerId, customerName) {
                event.preventDefault();
                const form = event.target;
                const formData = new FormData(form);
                const startDate = formData.get('startDate');
                const endDate = formData.get('endDate');

                // Validate dates
                if (new Date(startDate) > new Date(endDate)) {
                    this.showNotification('Ngày bắt đầu không thể lớn hơn ngày kết thúc', 'error');
                    return;
                }

                // Close the modal
                const modal = form.closest("div[style*=\"fixed\"]"); 
                if(modal) modal.remove();

                // Generate report with date filter
                this.exportCustomerReportWithDateRange(customerId, customerName, startDate, endDate);
            }

            exportCustomerReportWithDateRange(customerId, customerName, startDate, endDate) {
                // Tìm tất cả đơn hàng của khách hàng trong khoảng thời gian
                const customerOrders = this.demoData.orders.filter(order => {
                    if (order.customerId !== customerId) return false;

                    // Convert order date to comparable format
                    const orderDate = new Date(order.date.split('/').reverse().join('-'));
                    const filterStartDate = new Date(startDate);
                    const filterEndDate = new Date(endDate);

                    return orderDate >= filterStartDate && orderDate <= filterEndDate;
                });

                if (customerOrders.length === 0) {
                    this.showNotification(`Khách hàng ${customerName} không có đơn hàng nào trong khoảng thời gian ${startDate} đến ${endDate}`, 'warning');
                    return;
                }

                // Sắp xếp đơn hàng theo ngày mới nhất
                const sortedOrders = this.sortOrdersByDate(customerOrders);

                // Tính toán thống kê
                const totalOrders = customerOrders.length;
                const totalAmount = customerOrders.reduce((sum, order) => sum + order.total, 0);
                const paidAmount = customerOrders.reduce((sum, order) => sum + this.getOrderPaidAmount(order), 0);
                const debtAmount = customerOrders.reduce((sum, order) => sum + this.getOrderRemainingBalance(order), 0);

                // Format dates for display
                const formatStartDate = new Date(startDate).toLocaleDateString('vi-VN');
                const formatEndDate = new Date(endDate).toLocaleDateString('vi-VN');

                // Tạo nội dung báo cáo HTML
                let reportContent = `
                    <div style="max-width: 800px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif; line-height: 1.6;">
                        <div style="text-align: center; border-bottom: 3px solid #3b82f6; padding-bottom: 20px; margin-bottom: 30px;">
                            <h1 style="color: #1f2937; margin: 0; font-size: 24px;">BÁO CÁO MUA HÀNG KHÁCH HÀNG</h1>
                            <h2 style="color: #3b82f6; margin: 10px 0 0 0; font-size: 20px;">${customerName}</h2>
                            <p style="color: #6b7280; margin: 5px 0;">Mã khách hàng: ${customerId}</p>
                            <p style="color: #e11d48; margin: 5px 0; font-weight: 600; font-size: 16px;">Từ ${formatStartDate} đến ${formatEndDate}</p>
                            <p style="color: #6b7280; margin: 0;">Ngày xuất báo cáo: ${this.formatVietnameseTime()}</p>
                        </div>

                        <!-- Thống kê tổng quan -->
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 30px;">
                            <div style="background: #f8fafc; padding: 15px; border-radius: 8px; border-left: 4px solid #3b82f6;">
                                <h3 style="margin: 0 0 5px 0; color: #1f2937; font-size: 16px;">Tổng đơn hàng</h3>
                                <p style="margin: 0; font-size: 24px; font-weight: bold; color: #3b82f6;">${totalOrders}</p>
                            </div>
                            <div style="background: #f8fafc; padding: 15px; border-radius: 8px; border-left: 4px solid #059669;">
                                <h3 style="margin: 0 0 5px 0; color: #1f2937; font-size: 16px;">Tổng tiền mua</h3>
                                <p style="margin: 0; font-size: 20px; font-weight: bold; color: #059669;">${totalAmount.toLocaleString('vi-VN')} VNĐ</p>
                            </div>
                            <div style="background: #f8fafc; padding: 15px; border-radius: 8px; border-left: 4px solid #10b981;">
                                <h3 style="margin: 0 0 5px 0; color: #1f2937; font-size: 16px;">Đã thanh toán</h3>
                                <p style="margin: 0; font-size: 20px; font-weight: bold; color: #10b981;">${paidAmount.toLocaleString('vi-VN')} VNĐ</p>
                            </div>
                            <div style="background: #f8fafc; padding: 15px; border-radius: 8px; border-left: 4px solid ${debtAmount > 0 ? '#ef4444' : '#10b981'};">
                                <h3 style="margin: 0 0 5px 0; color: #1f2937; font-size: 16px;">Còn nợ</h3>
                                <p style="margin: 0; font-size: 20px; font-weight: bold; color: ${debtAmount > 0 ? '#ef4444' : '#10b981'};">${debtAmount.toLocaleString('vi-VN')} VNĐ</p>
                            </div>
                        </div>

                        <!-- Danh sách đơn hàng -->
                        <div>
                            <h3 style="color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">CHI TIẾT CÁC ĐỖN HÀNG</h3>
                            <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                                <thead>
                                    <tr style="background: #f8fafc;">
                                        <th style="padding: 12px; text-align: left; border: 1px solid #e5e7eb; font-weight: 600;">Mã ĐH</th>
                                        <th style="padding: 12px; text-align: left; border: 1px solid #e5e7eb; font-weight: 600;">Ngày</th>
                                        <th style="padding: 12px; text-align: right; border: 1px solid #e5e7eb; font-weight: 600;">Tổng tiền</th>
                                        <th style="padding: 12px; text-align: center; border: 1px solid #e5e7eb; font-weight: 600;">Trạng thái</th>
                                        <th style="padding: 12px; text-align: center; border: 1px solid #e5e7eb; font-weight: 600;">Thanh toán</th>
                                        <th style="padding: 12px; text-align: left; border: 1px solid #e5e7eb; font-weight: 600;">Sản phẩm</th>
                                    </tr>
                                </thead>
                                <tbody>
                `;

                // Thêm từng đơn hàng vào báo cáo
                sortedOrders.forEach(order => {
                    const productList = order.products.map(p => `${p.name} (SL: ${p.quantity})`).join(', ');
                    reportContent += `
                        <tr>
                            <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight: 600;">${order.id}</td>
                            <td style="padding: 10px; border: 1px solid #e5e7eb;">${order.date}</td>
                            <td style="padding: 10px; border: 1px solid #e5e7eb; text-align: right; font-weight: 600;">${order.total.toLocaleString('vi-VN')} VNĐ</td>
                            <td style="padding: 10px; border: 1px solid #e5e7eb; text-align: center;">
                                <span style="padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; background: ${order.status === 'Hoàn thành' ? '#dcfce7; color: #166534' : order.status === 'Đang xử lý' ? '#fef3c7; color: #92400e' : '#fee2e2; color: #dc2626'};">${order.status}</span>
                            </td>
                            <td style="padding: 10px; border: 1px solid #e5e7eb; text-align: center;">
                                <span style="padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; background: ${order.paymentStatus === 'Đã thanh toán' ? '#dcfce7; color: #166534' : '#fef3c7; color: #92400e'};">${order.paymentStatus}</span>
                            </td>
                            <td style="padding: 10px; border: 1px solid #e5e7eb; font-size: 12px;">${productList}</td>
                        </tr>
                    `;
                });

                reportContent += `
                                </tbody>
                            </table>
                        </div>

                        <!-- Footer -->
                        <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #e5e7eb; text-align: center; color: #6b7280;">
                            <p>Báo cáo được tạo tự động từ Hệ thống ERP Việt Nam</p>
                            <p style="font-size: 12px;">© ${new Date().getFullYear()} - Bản quyền thuộc về cửa hàng</p>
                        </div>
                    </div>
                `;

                // Mở cửa sổ mới và in báo cáo
                const printWindow = window.open('', '_blank', 'width=800,height=600');
                printWindow.document.write(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Báo cáo khách hàng - ${customerName}</title>
                        <meta charset="UTF-8">
                        <style>
                            @media print {
                                body { margin: 0; }
                                .no-print { display: none; }
                            }
                        </style>
                    </head>
                    <body>
                        <div style="padding: 20px; margin-bottom: 20px;" class="no-print">
                            <button onclick="window.print()" style="background: #3b82f6; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; margin-right: 10px;">🖨️ In báo cáo</button>
                            <button onclick="window.close()" style="background: #6b7280; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer;">❌ Đóng</button>
                        </div>
                        ${reportContent}
                    </body>
                    </html>
                `);
                printWindow.document.close();

                this.showNotification(`Đã xuất báo cáo cho khách hàng ${customerName}`, 'success');
            }

            backupProductsToExcel() {
                if (this.demoData.products.length === 0) {
                    this.showNotification('Không có sản phẩm nào để backup', 'warning');
                    return;
                }

                // Tạo dữ liệu Excel với tiêu đề tiếng Việt
                const headers = ['Mã SP', 'Tên sản phẩm', 'Danh mục', 'Giá bán', 'Giá nhập', 'Tồn kho', 'Nhà cung cấp'];
                const excelData = [headers];

                this.demoData.products.forEach(product => {
                    excelData.push([
                        product.id,
                        product.name,
                        product.category,
                        product.price,
                        product.importPrice || '',
                        product.stock,
                        product.supplier || ''
                    ]);
                });

                // Tạo nội dung CSV
                const csvContent = excelData.map(row => 
                    row.map(field => {
                        // Xử lý field có dấu phẩy hoặc dấu ngoặc kép
                        if (typeof field === 'string' && (field.includes(',') || field.includes('"'))) {
                            return `"${field.replace(/"/g, '""')}"`;
                        }
                        return field;
                    }).join(',')
                ).join('\n');

                // Thêm BOM để Excel hiển thị đúng tiếng Việt
                const BOM = '\uFEFF';
                const csvWithBOM = BOM + csvContent;

                // Tạo và download file
                const blob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                const url = URL.createObjectURL(blob);

                link.setAttribute('href', url);
                link.setAttribute('download', `SanPham_Backup_${this.formatDateForFilename()}.csv`);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                this.showNotification(`Đã backup ${this.demoData.products.length} sản phẩm ra file Excel`, 'success');
            }

            showUploadCustomersForm() {
                const formHTML = `
                    <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1001; display: flex; justify-content: center; align-items: center;" onclick="closeModal(this)">
                        <div style="background: white; padding: 32px; border-radius: 12px; width: 600px; max-width: 95vw; max-height: 90vh; overflow-y: auto;" onclick="event.stopPropagation()">
                            <h3 style="margin-bottom: 24px; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
                                <span>📤</span> Upload file Excel khách hàng
                            </h3>

                            <!-- Hướng dẫn -->
                            <div style="background: #f0f9ff; padding: 16px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #0ea5e9;">
                                <h4 style="margin: 0 0 8px 0; color: #0c4a6e;">📋 Định dạng file Excel:</h4>
                                <p style="margin: 0; font-size: 14px; line-height: 1.5;">File Excel phải có các cột theo thứ tự:<br>
                                    <strong>Mã KH | Tên khách hàng | Điện thoại | Địa chỉ | Tỉnh thành | Quận huyện | Phường xã</strong>
                                </p>
                            </div>

                            <!-- Upload form -->
                            <form onsubmit="app.uploadCustomersFromExcel(event)">
                                <div style="margin-bottom: 20px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Chọn file Excel (.csv): *</label>
                                    <input type="file" name="excelFile" accept=".csv,.xlsx,.xls" required
                                           style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                    <p style="margin: 4px 0 0 0; font-size: 12px; color: #6b7280;">Hỗ trợ file .csv, .xlsx, .xls</p>
                                </div>

                                <div style="margin-bottom: 20px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Xử lý khách hàng trùng mã:</label>
                                    <div style="display: flex; gap: 16px;">
                                        <label style="display: flex; align-items: center; gap: 6px;">
                                            <input type="radio" name="duplicateAction" value="skip" checked>
                                            <span style="font-size: 14px;">Bỏ qua</span>
                                        </label>
                                        <label style="display: flex; align-items: center; gap: 6px;">
                                            <input type="radio" name="duplicateAction" value="update">
                                            <span style="font-size: 14px;">Cập nhật</span>
                                        </label>
                                    </div>
                                </div>

                                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                                    <button type="button" onclick="closeModal(this.closest('div[style*=fixed]'))" 
                                            style="padding: 12px 24px; border: 2px solid #e5e7eb; background: white; border-radius: 8px; cursor: pointer;">Hủy</button>
                                    <button type="submit" 
                                            style="padding: 12px 24px; background: var(--primary-blue); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">Upload Excel</button>
                                </div>
                            </form>
                        </div>
                    </div>
                `;
                document.body.insertAdjacentHTML('beforeend', formHTML);
            }

            uploadCustomersFromExcel(event) {
                event.preventDefault();
                const form = event.target;
                const fileInput = form.querySelector('input[type="file"]');
                const duplicateAction = form.querySelector('input[name="duplicateAction"]:checked').value;

                if (!fileInput.files[0]) {
                    this.showNotification('Vui lòng chọn file Excel', 'error');
                    return;
                }

                const file = fileInput.files[0];
                const reader = new FileReader();

                reader.onload = (e) => {
                    try {
                        let csvData = e.target.result;
                        if (csvData.charCodeAt(0) === 0xFEFF) {
                            csvData = csvData.slice(1);
                        }

                        const lines = csvData.split('\n').filter(line => line.trim());
                        if (lines.length < 2) {
                            this.showNotification('File Excel phải có ít nhất 1 dòng tiêu đề và 1 dòng dữ liệu', 'error');
                            return;
                        }

                        const dataLines = lines.slice(1);
                        let addedCount = 0;
                        let updatedCount = 0;
                        let skippedCount = 0;
                        let errorLines = [];

                        dataLines.forEach((line, index) => {
                            if (!line.trim()) return;

                            const columns = this.parseCSVLine(line);
                            if (columns.length < 7) {
                                errorLines.push(`Dòng ${index + 2}: Không đủ cột (tối thiểu 7 cột: Mã KH, Tên khách hàng, Điện thoại, Địa chỉ, Tỉnh thành, Quận huyện, Phường xã)`);
                                skippedCount++;
                                return;
                            }

                            const [id, name, phone = '', address = '', province = '', district = '', ward = ''] = columns;
                            const trimmedId = id?.trim();
                            const trimmedName = name?.trim();

                            if (!trimmedId || !trimmedName) {
                                errorLines.push(`Dòng ${index + 2}: Thiếu Mã KH hoặc Tên`);
                                skippedCount++;
                                return;
                            }

                            const customerObj = {
                                id: trimmedId,
                                name: trimmedName,
                                type: 'ca-nhan',
                                companyName: '',
                                department: '',
                                phone: (phone || '').trim(),
                                address: (address || '').trim(),
                                province: (province || '').trim(),
                                district: (district || '').trim(),
                                ward: (ward || '').trim(),
                                taxCode: '',
                                notes: '',
                                totalOrders: 0
                            };

                            const existingIndex = this.demoData.customers.findIndex(c => c.id === trimmedId);
                            if (existingIndex !== -1) {
                                if (duplicateAction === 'update') {
                                    this.demoData.customers[existingIndex] = {
                                        ...this.demoData.customers[existingIndex],
                                        ...customerObj
                                    };
                                    updatedCount++;
                                } else {
                                    skippedCount++;
                                }
                            } else {
                                this.demoData.customers.push(customerObj);
                                addedCount++;
                            }
                        });

                        this.saveToLocalStorage();
                        // Clear empty mode flag since we now have data
                        localStorage.removeItem('erp_vietnam_empty_mode');

                        // Verify data was saved
                        const savedVerify = localStorage.getItem('erp_vietnam_data');
                        if (!savedVerify) {
                            console.error('⚠️ Cảnh báo: Dữ liệu không được lưu vào localStorage!');
                            this.showNotification('⚠️ Cảnh báo: Dữ liệu có thể chưa được lưu', 'warning');
                        } else {
                            console.log('✅ Dữ liệu khách hàng đã lưu thành công:', savedVerify.length, 'bytes');
                        }

                        this.loadPage('customers');

                        let message = `Upload hoàn tất: `;
                        if (addedCount > 0) message += `${addedCount} khách hàng mới, `;
                        if (updatedCount > 0) message += `${updatedCount} khách hàng cập nhật, `;
                        if (skippedCount > 0) message += `${skippedCount} khách hàng bỏ qua`;
                        if (errorLines.length > 0) message += `\n\nChi tiết lỗi:\n${errorLines.join('\n')}`;

                        this.showNotification(message, (addedCount + updatedCount) > 0 ? 'success' : 'warning');
                        const modal = form.closest("div[style*='fixed']"); if (modal) modal.remove();

                        // Final verification - reload and check
                        setTimeout(() => {
                            const checkSaved = localStorage.getItem('erp_vietnam_data');
                            if (checkSaved) {
                                const parsedData = JSON.parse(checkSaved);
                                console.log('🔍 Verification after upload:', {
                                    customers: parsedData.customers?.length || 0,
                                    products: parsedData.products?.length || 0
                                });
                            }
                        }, 500);

                    } catch (error) {
                        console.error('Lỗi đọc file Excel khách hàng:', error);
                        this.showNotification(`Lỗi đọc file Excel khách hàng: ${error.message}`, 'error');
                    }
                };

                reader.readAsText(file, 'UTF-8');
            }

            showUploadProductsForm() {
                const formHTML = `
                    <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1001; display: flex; justify-content: center; align-items: center;" onclick="closeModal(this)">
                        <div style="background: white; padding: 32px; border-radius: 12px; width: 600px; max-width: 95vw; max-height: 90vh; overflow-y: auto;" onclick="event.stopPropagation()">
                            <h3 style="margin-bottom: 24px; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
                                <span>📤</span> Upload file Excel sản phẩm
                            </h3>

                            <!-- Hướng dẫn -->
                            <div style="background: #f0f9ff; padding: 16px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #0ea5e9;">
                                <h4 style="margin: 0 0 8px 0; color: #0c4a6e;">📋 Định dạng file Excel:</h4>
                                <p style="margin: 0; font-size: 14px; line-height: 1.5;">
                                    File Excel phải có các cột theo thứ tự:<br>
                                    <strong>Mã SP | Tên sản phẩm | Danh mục | Giá bán | Giá nhập | Tồn kho | Nhà cung cấp</strong>
                                </p>
                            </div>

                            <!-- Ví dụ -->
                            <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
                                <h4 style="margin: 0 0 8px 0; color: #374151;">💡 Ví dụ:</h4>
                                <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                                    <thead>
                                        <tr style="background: #e5e7eb;">
                                            <th style="padding: 4px; border: 1px solid #d1d5db;">Mã SP</th>
                                            <th style="padding: 4px; border: 1px solid #d1d5db;">Tên sản phẩm</th>
                                            <th style="padding: 4px; border: 1px solid #d1d5db;">Danh mục</th>
                                            <th style="padding: 4px; border: 1px solid #d1d5db;">Giá bán</th>
                                            <th style="padding: 4px; border: 1px solid #d1d5db;">Giá nhập</th>
                                            <th style="padding: 4px; border: 1px solid #d1d5db;">Tồn kho</th>
                                            <th style="padding: 4px; border: 1px solid #d1d5db;">Nhà cung cấp</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td style="padding: 4px; border: 1px solid #d1d5db;">SP001</td>
                                            <td style="padding: 4px; border: 1px solid #d1d5db;">Áo thun nam</td>
                                            <td style="padding: 4px; border: 1px solid #d1d5db;">Thời trang</td>
                                            <td style="padding: 4px; border: 1px solid #d1d5db;">150000</td>
                                            <td style="padding: 4px; border: 1px solid #d1d5db;">100000</td>
                                            <td style="padding: 4px; border: 1px solid #d1d5db;">50</td>
                                            <td style="padding: 4px; border: 1px solid #d1d5db;">NCC ABC</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            <!-- Upload form -->
                            <form onsubmit="app.uploadProductsFromExcel(event)">
                                <div style="margin-bottom: 20px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Chọn file Excel (.csv): *</label>
                                    <input type="file" name="excelFile" accept=".csv,.xlsx,.xls" required
                                           style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                    <p style="margin: 4px 0 0 0; font-size: 12px; color: #6b7280;">Hỗ trợ file .csv, .xlsx, .xls</p>
                                </div>

                                <!-- Tùy chọn xử lý -->
                                <div style="margin-bottom: 20px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Xử lý sản phẩm trùng mã:</label>
                                    <div style="display: flex; gap: 16px;">
                                        <label style="display: flex; align-items: center; gap: 6px;">
                                            <input type="radio" name="duplicateAction" value="skip" checked>
                                            <span style="font-size: 14px;">Bỏ qua</span>
                                        </label>
                                        <label style="display: flex; align-items: center; gap: 6px;">
                                            <input type="radio" name="duplicateAction" value="update">
                                            <span style="font-size: 14px;">Cập nhật</span>
                                        </label>
                                    </div>
                                </div>

                                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                                    <button type="button" onclick="closeModal(this.closest('div[style*=fixed]'))" 
                                            style="padding: 12px 24px; border: 2px solid #e5e7eb; background: white; border-radius: 8px; cursor: pointer;">Hủy</button>
                                    <button type="submit" 
                                            style="padding: 12px 24px; background: var(--primary-blue); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">Upload Excel</button>
                                </div>
                            </form>
                        </div>
                    </div>
                `;
                document.body.insertAdjacentHTML('beforeend', formHTML);
            }

            uploadProductsFromExcel(event) {
                event.preventDefault();
                const form = event.target;
                const fileInput = form.querySelector('input[type="file"]');
                const duplicateAction = form.querySelector('input[name="duplicateAction"]:checked').value;

                if (!fileInput.files[0]) {
                    this.showNotification('Vui lòng chọn file Excel', 'error');
                    return;
                }

                const file = fileInput.files[0];
                const reader = new FileReader();

                reader.onload = (e) => {
                    try {
                        let csvData = e.target.result;

                        // Loại bỏ BOM nếu có
                        if (csvData.charCodeAt(0) === 0xFEFF) {
                            csvData = csvData.slice(1);
                        }

                        // Debug: Log raw data
                        console.log('Raw CSV Data:', csvData.substring(0, 200));

                        const lines = csvData.split('\n').filter(line => line.trim());
                        console.log('Số dòng đọc được:', lines.length);
                        console.log('Dòng đầu tiên:', lines[0]);

                        if (lines.length < 2) {
                            this.showNotification('File Excel phải có ít nhất 1 dòng tiêu đề và 1 dòng dữ liệu', 'error');
                            return;
                        }

                        // Bỏ qua dòng tiêu đề
                        const dataLines = lines.slice(1);
                        let addedCount = 0;
                        let updatedCount = 0;
                        let skippedCount = 0;
                        let errorLines = [];

                        console.log('Bắt đầu xử lý', dataLines.length, 'dòng dữ liệu');

                        dataLines.forEach((line, index) => {
                            if (!line.trim()) return; // Bỏ qua dòng trống

                            console.log(`Xử lý dòng ${index + 2}:`, line);
                            const columns = this.parseCSVLine(line);
                            console.log('Columns parsed:', columns);

                            if (columns.length < 7) {
                                console.warn(`Dòng ${index + 2}: Chỉ có ${columns.length} cột, cần 7 cột`);
                                errorLines.push(`Dòng ${index + 2}: Không đủ 7 cột`);
                                skippedCount++;
                                return;
                            }

                            const [id, name, category, price, importPrice, stock, supplier] = columns;

                            // Kiểm tra dữ liệu bắt buộc
                            if (!id?.trim() || !name?.trim() || !category?.trim() || !price?.trim()) {
                                console.warn(`Dòng ${index + 2}: Thiếu thông tin bắt buộc:`, {id, name, category, price});
                                errorLines.push(`Dòng ${index + 2}: Thiếu thông tin bắt buộc`);
                                skippedCount++;
                                return;
                            }

                            // Kiểm tra sản phẩm đã tồn tại
                            const cleanId = id.trim();
                            const existingIndex = this.demoData.products.findIndex(p => p.id === cleanId);

                            const productData = {
                                id: cleanId,
                                name: name.trim(),
                                category: category.trim(),
                                price: parseInt(price) || 0,
                                importPrice: parseInt(importPrice) || 0,
                                stock: parseInt(stock) || 0,
                                supplier: supplier ? supplier.trim() : ''
                            };

                            console.log('Product data created:', productData);

                            if (existingIndex !== -1) {
                                if (duplicateAction === 'update') {
                                    this.demoData.products[existingIndex] = productData;
                                    updatedCount++;
                                    console.log('Updated existing product:', cleanId);
                                } else {
                                    skippedCount++;
                                    console.log('Skipped duplicate product:', cleanId);
                                }
                            } else {
                                this.demoData.products.push(productData);
                                addedCount++;
                                console.log('Added new product:', cleanId);
                            }
                        });

                        console.log('Upload results:', {addedCount, updatedCount, skippedCount});

                        this.saveToLocalStorage();
                        // Clear empty mode flag since we now have data
                        localStorage.removeItem('erp_vietnam_empty_mode');

                        // Verify data was saved
                        const savedVerify = localStorage.getItem('erp_vietnam_data');
                        if (!savedVerify) {
                            console.error('⚠️ Cảnh báo: Dữ liệu không được lưu vào localStorage!');
                            this.showNotification('⚠️ Cảnh báo: Dữ liệu có thể chưa được lưu', 'warning');
                        } else {
                            console.log('✅ Dữ liệu sản phẩm đã lưu thành công:', savedVerify.length, 'bytes');
                        }

                        this.loadPage('products');

                        let message = `Upload hoàn tất: `;
                        if (addedCount > 0) message += `${addedCount} sản phẩm mới, `;
                        if (updatedCount > 0) message += `${updatedCount} sản phẩm cập nhật, `;
                        if (skippedCount > 0) message += `${skippedCount} sản phẩm bỏ qua`;

                        // Hiển thị lỗi nếu có
                        if (errorLines.length > 0) {
                            message += `\n\nChi tiết lỗi:\n${errorLines.join('\n')}`;
                        }

                        this.showNotification(message, addedCount > 0 || updatedCount > 0 ? 'success' : 'warning');
                        const modal = form.closest("div[style*=\"fixed\"]"); 
                        if(modal) modal.remove();

                    } catch (error) {ư  
                        console.error('Lỗi đọc file Excel:', error);
                        this.showNotification(`Lỗi đọc file Excel: ${error.message}`, 'error');
                    }
                };

                reader.readAsText(file, 'UTF-8');
            }

            parseCSVLine(line) {
                const columns = [];
                let current = '';
                let inQuotes = false;

                for (let i = 0; i < line.length; i++) {
                    const char = line[i];

                    if (char === '"' && !inQuotes) {
                        inQuotes = true;
                    } else if (char === '"' && inQuotes) {
                        if (line[i + 1] === '"') {
                            current += '"';
                            i++; // Skip next quote
                        } else {
                            inQuotes = false;
                        }
                    } else if (char === ',' && !inQuotes) {
                        columns.push(current.trim());
                        current = '';
                    } else {
                        current += char;
                    }
                }

                columns.push(current.trim());
                return columns;
            }

            formatDateForFilename() {
                const now = new Date();
                const year = now.getFullYear();
                const month = String(now.getMonth() + 1).padStart(2, '0');
                const day = String(now.getDate()).padStart(2, '0');
                const hour = String(now.getHours()).padStart(2, '0');
                const minute = String(now.getMinutes()).padStart(2, '0');
                return `${year}${month}${day}_${hour}${minute}`;
            }

            deleteSupplier(index) {
                const supplier = this.demoData.suppliers[index];
                if (confirm(`Bạn có chắc muốn xóa nhà cung cấp ${supplier.name}?`)) {
                    this.demoData.suppliers.splice(index, 1);
                    this.saveToLocalStorage();
                    this.showNotification(`Đã xóa nhà cung cấp ${supplier.name}`, 'success');
                    this.loadPage('suppliers');
                }
            }

            deleteProduct(index) {
                const product = this.demoData.products[index];
                if (confirm(`Bạn có chắc muốn xóa sản phẩm ${product.name}?`)) {
                    this.demoData.products.splice(index, 1);
                    this.saveToLocalStorage();
                    this.showNotification(`Đã xóa sản phẩm ${product.name}`, 'success');
                    this.loadPage('products');
                }
            }

            deleteAllCustomers() {
                if (!confirm('Bạn có chắc chắn muốn xóa tất cả khách hàng?')) return;
                if (!confirm('XÁC NHẬN: Xóa tất cả khách hàng sẽ không thể hoàn tác.')) return;
                this.demoData.customers = [];
                this.saveToLocalStorage();
                this.showNotification('Đã xóa tất cả khách hàng', 'success');
                this.loadPage('customers');
            }

            deleteAllSuppliers() {
                if (!confirm('Bạn có chắc chắn muốn xóa tất cả nhà cung cấp?')) return;
                if (!confirm('XÁC NHẬN: Xóa tất cả nhà cung cấp sẽ không thể hoàn tác.')) return;
                this.demoData.suppliers = [];
                this.saveToLocalStorage();
                this.showNotification('Đã xóa tất cả nhà cung cấp', 'success');
                this.loadPage('suppliers');
            }

            deleteAllProducts() {
                if (!confirm('Bạn có chắc chắn muốn xóa tất cả sản phẩm?')) return;
                if (!confirm('XÁC NHẬN: Xóa tất cả sản phẩm sẽ không thể hoàn tác.')) return;
                this.demoData.products = [];
                this.saveToLocalStorage();
                this.showNotification('Đã xóa tất cả sản phẩm', 'success');
                this.loadPage('products');
            }

            deleteAllOrders() {
                if (!confirm('Bạn có chắc chắn muốn xóa tất cả đơn hàng?')) return;
                if (!confirm('XÁC NHẬN: Xóa tất cả đơn hàng sẽ không thể hoàn tác.')) return;
                this.demoData.orders = [];
                this.saveToLocalStorage();
                this.showNotification('Đã xóa tất cả đơn hàng', 'success');
                this.loadPage('orders');
            }

            resetDashboardMetrics() {
                if (!confirm('Bạn có chắc chắn muốn đặt lại doanh thu và đơn hàng trên Dashboard?')) return;
                if (!confirm('XÁC NHẬN: Hành động này sẽ xóa toàn bộ đơn hàng và doanh thu hiện tại.')) return;
                this.demoData.orders = [];
                this.demoData.sales = [];
                this.saveToLocalStorage();
                this.showNotification('Đã đặt lại doanh thu và đơn hàng trên Dashboard', 'success');
                this.loadPage('dashboard');
            }

            deleteAllPurchases() {
                if (!confirm('Bạn có chắc chắn muốn xóa tất cả đơn mua hàng?')) return;
                if (!confirm('XÁC NHẬN: Xóa tất cả đơn mua hàng sẽ không thể hoàn tác.')) return;
                this.demoData.purchases = [];
                this.saveToLocalStorage();
                this.showNotification('Đã xóa tất cả đơn mua hàng', 'success');
                this.loadPage('purchases');
            }

            showSearchCustomer() {
                const searchBox = document.getElementById('search-box');
                const searchInput = document.getElementById('customer-search');

                if (searchBox.style.display === 'none') {
                    searchBox.style.display = 'block';
                    searchInput.focus();
                } else {
                    searchBox.style.display = 'none';
                    searchInput.value = '';
                    this.loadPage('customers');
                }
            }

            searchCustomers(query) {
                if (!query.trim()) {
                    this.loadPage('customers');
                    return;
                }

                const filteredCustomers = this.demoData.customers.filter(customer => 
                    customer.name.toLowerCase().includes(query.toLowerCase()) ||
                    customer.phone.includes(query) ||
                    (customer.companyName && customer.companyName.toLowerCase().includes(query.toLowerCase())) ||
                    (customer.department && customer.department.toLowerCase().includes(query.toLowerCase())) ||
                    (customer.taxCode && customer.taxCode.includes(query)) ||
                    (customer.address && customer.address.toLowerCase().includes(query.toLowerCase())) ||
                    (customer.province && customer.province.toLowerCase().includes(query.toLowerCase())) ||
                    (customer.district && customer.district.toLowerCase().includes(query.toLowerCase())) ||
                    (customer.ward && customer.ward.toLowerCase().includes(query.toLowerCase()))
                );

                const customersTable = filteredCustomers.map((customer, index) => {
                    const typeDisplay = customer.type === 'doanh-nghiep' ? '🏢 Doanh nghiệp' : '👤 Cá nhân';
                    const iconClass = customer.type === 'doanh-nghiep' ? 'warning' : 'info';
                    const iconSymbol = customer.type === 'doanh-nghiep' ? '🏢' : '👤';

                    const companyInfo = customer.type === 'doanh-nghiep' && customer.companyName ? 
                        ` | 🏢 ${customer.companyName}` : '';
                    const departmentInfo = customer.type === 'doanh-nghiep' && customer.department ? 
                        ` | 🏬 ${customer.department}` : '';
                    const taxCodeInfo = customer.type === 'doanh-nghiep' && customer.taxCode ? 
                        ` | 🆔 MST: ${customer.taxCode}` : '';

                    return `
                        <div class="activity-item">
                            <div class="activity-icon ${iconClass}">${iconSymbol}</div>
                            <div class="activity-content">
                                <div class="activity-title">${customer.name} (${customer.id})</div>
                                <div class="activity-desc">${typeDisplay}${companyInfo}${departmentInfo}${taxCodeInfo}</div>
                                <div class="activity-desc">📞 ${customer.phone} | 📍 ${customer.address}${customer.ward ? ', ' + customer.ward : ''}${customer.district ? ', ' + customer.district : ''}${customer.province ? ', ' + customer.province : ''}</div>
                            </div>
                            <div style="display: flex; gap: 8px; align-items: center;">
                                <div class="activity-time">${customer.type === 'doanh-nghiep' ? 'Doanh nghiệp' : 'Cá nhân'}</div>
                                <button onclick="app.showCustomerDetails(${this.demoData.customers.indexOf(customer)})" style="background: #059669; color: white; padding: 4px 8px; border: none; border-radius: 4px; cursor: pointer;">Chi tiết</button>
                                <button onclick="app.editCustomer(${this.demoData.customers.indexOf(customer)})" style="background: #3b82f6; color: white; padding: 4px 8px; border: none; border-radius: 4px; cursor: pointer;">Sửa</button>
                                <button onclick="app.deleteCustomer(${this.demoData.customers.indexOf(customer)})" style="background: #ef4444; color: white; padding: 4px 8px; border: none; border-radius: 4px; cursor: pointer;">Xóa</button>
                            </div>
                        </div>
                    `;
                }).join('');

                document.getElementById('customers-list').innerHTML = customersTable || '<div style="text-align: center; padding: 40px; color: #6b7280;">Không tìm thấy khách hàng nào</div>';
            }

            exportCustomers(mode = null) {
                if (!mode) {
                    this.showExportOptions('Xuất dữ liệu khách hàng', 'customers', 'exportCustomers');
                    return;
                }

                if (mode === 'view') {
                    const columns = [
                        { header: 'Mã KH', getValue: customer => customer.id },
                        { header: 'Tên khách hàng', getValue: customer => customer.name },
                        { header: 'Điện thoại', getValue: customer => customer.phone || 'N/A' },
                        { header: 'Địa chỉ', getValue: customer => customer.address || 'N/A' },
                        { header: 'Phường/Xã', getValue: customer => customer.ward || 'N/A' },
                        { header: 'Quận/Huyện', getValue: customer => customer.district || 'N/A' },
                        { header: 'Tỉnh/Thành', getValue: customer => customer.province || 'N/A' }
                    ];
                    this.showDataViewer('Danh sách khách hàng', this.demoData.customers, columns);
                } else if (mode === 'download') {
                    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + 
                        "Mã KH,Tên khách hàng,Điện thoại,Địa chỉ,Phường/Xã,Quận/Huyện,Tỉnh/Thành\n" +
                        this.demoData.customers.map(c => 
                            `${c.id},"${c.name}","${c.phone}","${c.address}","${c.ward || ''}","${c.district || ''}","${c.province || ''}"`
                        ).join('\n');

                    const encodedUri = encodeURI(csvContent);
                    const link = document.createElement("a");
                    link.setAttribute("href", encodedUri);
                    link.setAttribute("download", `khach_hang_${this.getVietnamTime().toISOString().split('T')[0]}.csv`);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);

                    this.showNotification('Đã tải xuống danh sách khách hàng', 'success');
                }
            }

            // Local Storage Management + Supabase Sync
            saveToLocalStorage() {
                try {
                    this.syncCustomerDebtTotals();
                    const jsonStr = JSON.stringify(this.demoData);
                    localStorage.setItem('erp_vietnam_data', jsonStr);
                    console.log('✅ Data saved to localStorage:', jsonStr.length, 'bytes');
                console.log('DEBUG demoData snapshot:', {
                    orders: (this.demoData.orders || []).map(o => ({
                        id: o.id,
                        status: o.status,
                        deliveryMethod: o.deliveryMethod,
                        deliveryNotes: o.deliveryNotes,
                        products: (o.products || []).map(p => ({ id: p.id, quantity: p.quantity, deliveredQty: p.deliveredQty }))
                    })),
                    inventoryHistory: (this.demoData.inventoryHistory || []).slice(-5)
                });

                    // Đồng bộ lên Supabase (debounced 2 giây)
                    if (window._supabaseDataLoaded) {
                        syncAllDataToSupabase(this.demoData);
                        console.log('☁️ Supabase sync scheduled...');
                    }
                } catch (error) {
                    console.error('❌ Error saving to localStorage:', error);
                    this.showNotification('Lỗi lưu dữ liệu: ' + error.message, 'error');
                }
            }

            loadFromLocalStorage() {
                try {
                    const saved = localStorage.getItem('erp_vietnam_data');
                    if (saved && saved.trim() !== '') {
                        this.demoData = JSON.parse(saved);
                        console.log('✅ Data loaded from localStorage');
                        console.log('   - Customers:', this.demoData.customers?.length || 0);
                        console.log('   - Products:', this.demoData.products?.length || 0);
                        console.log('   - Orders:', this.demoData.orders?.length || 0);
                        return true; // Indicate successful load
                    }
                } catch (error) {
                    console.error('❌ Error loading from localStorage:', error);
                }
                return false; // No data found
            }

            // Backup Management Functions
            toggleAutoBackup(enabled) {
                localStorage.setItem('auto_backup_enabled', enabled.toString());
                if (enabled) {
                    this.startAutoBackup();
                    document.getElementById('backup-status').innerHTML = '🟢 Đang hoạt động';
                    this.showNotification('Đã bật tự động sao lưu', 'success');
                } else {
                    this.stopAutoBackup();
                    document.getElementById('backup-status').innerHTML = '🔴 Tắt';
                    this.showNotification('Đã tắt tự động sao lưu', 'info');
                }
            }

            setBackupInterval(minutes) {
                localStorage.setItem('backup_interval', minutes);
                if (localStorage.getItem('auto_backup_enabled') === 'true') {
                    this.stopAutoBackup();
                    this.startAutoBackup();
                    this.showNotification(`Đã đặt tần suất sao lưu ${minutes} phút`, 'success');
                }
            }

            startAutoBackup() {
                this.stopAutoBackup();
                const interval = parseInt(localStorage.getItem('backup_interval') || '30');
                this.autoBackupTimer = setInterval(() => {
                    this.performBackup();
                }, interval * 60 * 1000);
            }

            stopAutoBackup() {
                if (this.autoBackupTimer) {
                    clearInterval(this.autoBackupTimer);
                    this.autoBackupTimer = null;
                }
            }

            manualBackup() {
                this.performBackup();
                this.showNotification('Đã tải xuống file sao lưu', 'success');
            }

            performBackup() {
                const backupData = {
                    version: '1.0',
                    timestamp: this.getVietnamTime().toISOString(),
                    data: this.demoData,
                    metadata: {
                        totalCustomers: this.demoData.customers.length,
                        totalSuppliers: this.demoData.suppliers.length,
                        totalProducts: this.demoData.products.length,
                        totalSales: this.demoData.sales.length
                    }
                };

                const jsonString = JSON.stringify(backupData, null, 2);
                const blob = new Blob([jsonString], { type: 'application/json' });
                const url = URL.createObjectURL(blob);

                const link = document.createElement('a');
                link.href = url;
                const vietnamTime = this.getVietnamTime();
                link.download = `erp_vietnam_backup_${vietnamTime.toISOString().split('T')[0]}_${vietnamTime.toTimeString().split(' ')[0].replace(/:/g, '')}.json`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                URL.revokeObjectURL(url);
                localStorage.setItem('last_backup_time', this.getVietnamTime().toISOString());

                // Update UI if on settings page
                if (this.currentPage === 'settings') {
                    this.loadPage('settings');
                }
            }

            restoreFromFile(event) {
                const file = event.target.files[0];
                if (!file) return;

                if (file.type !== 'application/json') {
                    this.showNotification('Vui lòng chọn file JSON hợp lệ', 'error');
                    return;
                }

                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const backupData = JSON.parse(e.target.result);

                        if (!backupData.data || !backupData.version) {
                            throw new Error('File backup không đúng định dạng');
                        }

                        // Confirm before restore
                        if (confirm('Khôi phục dữ liệu sẽ ghi đè toàn bộ dữ liệu hiện tại. Bạn có chắc chắn?')) {
                            this.demoData = backupData.data;
                            this.saveToLocalStorage();
                            this.showNotification('Đã khôi phục dữ liệu thành công', 'success');

                            // Refresh current page
                            this.loadPage(this.currentPage);
                        }
                    } catch (error) {
                        console.error('Error restoring backup:', error);
                        this.showNotification('Không thể khôi phục dữ liệu. File có thể bị lỗi', 'error');
                    }
                };
                reader.readAsText(file);

                // Reset file input
                event.target.value = '';
            }

            deleteAllData() {
                // Yêu cầu nhập mật khẩu bảo mật
                const password = prompt('🔐 Nhập mật khẩu quản trị để xóa toàn bộ dữ liệu:');
                if (password === null) return; // Bấm Cancel
                if (password !== '123456') {
                    this.showNotification('❌ Mật khẩu không đúng! Không thể xóa dữ liệu.', 'error');
                    return;
                }

                // Double confirmation for destructive action
                const firstConfirm = confirm('⚠️ Bạn có chắc chắn muốn xóa toàn bộ dữ liệu?\n\nHành động này không thể hoàn tác!');
                if (!firstConfirm) return;

                const secondConfirm = confirm('🔴 XÁC NHẬN LẦN THỨ HAI: Nhấp OK để xóa vĩnh viễn tất cả dữ liệu (bao gồm cả dữ liệu trên cloud)');
                if (!secondConfirm) return;

                // Hiển thị trạng thái đang xóa
                this.showNotification('⏳ Đang xóa toàn bộ dữ liệu (localStorage + Supabase Cloud)...', 'info');

                // Xóa bất đồng bộ cả localStorage và Supabase
                (async () => {
                    try {
                        console.log('🗑️ Xóa toàn bộ dữ liệu...');

                        // 1. Xóa dữ liệu trên Supabase Cloud
                        if (window._supabaseDataLoaded) {
                            console.log('☁️ Đang xóa dữ liệu trên Supabase...');
                            const result = await deleteAllDataFromSupabase();
                            if (result.success) {
                                console.log('✅ Đã xóa toàn bộ dữ liệu trên Supabase!');
                            } else {
                                console.warn('⚠️ Xóa Supabase có lỗi:', result.errors);
                            }
                        }

                        // 2. Xóa localStorage
                        localStorage.removeItem('erp_vietnam_data');
                        localStorage.removeItem('system_activity_history');
                        localStorage.removeItem('last_backup_time');
                        localStorage.removeItem('auto_backup_enabled');
                        localStorage.removeItem('backup_interval');
                        localStorage.removeItem('company_logo');
                        localStorage.removeItem('company_qr');

                        // Set empty mode flag to prevent demo data generation
                        localStorage.setItem('erp_vietnam_empty_mode', 'true');

                        console.log('✅ Tất cả localStorage đã bị xóa');

                        // 3. Set to empty data in memory
                        this.demoData = {
                            customers: [],
                            suppliers: [],
                            products: [],
                            categories: [],
                            orders: [],
                            purchases: [],
                            expenses: [],
                            expenseCategories: this.getDefaultExpenseCategories(),
                            sales: [],
                            debts: [],
                            inventoryHistory: [],
                            deliveries: []
                        };

                        // 4. Lưu trạng thái trống vào localStorage
                        this.saveToLocalStorage();

                        console.log('✅ Dữ liệu đã được xóa hoàn toàn (local + cloud)');
                        this.showNotification('✅ Đã xóa toàn bộ dữ liệu (local + cloud). Đang tải lại...', 'success');

                        // Reload page after 1.5 second
                        setTimeout(() => {
                            window.location.reload();
                        }, 1500);
                    } catch (error) {
                        console.error('Error deleting data:', error);
                        this.showNotification('❌ Lỗi khi xóa dữ liệu: ' + error.message, 'error');
                    }
                })();
            }

            calculateStorageSize() {
                const data = localStorage.getItem('erp_vietnam_data');
                if (data) {
                    const sizeInBytes = new Blob([data]).size;
                    const sizeInKB = (sizeInBytes / 1024).toFixed(1);
                    const sizeInMB = (sizeInBytes / (1024 * 1024)).toFixed(2);

                    if (sizeInBytes < 1024) {
                        return `${sizeInBytes} B`;
                    } else if (sizeInBytes < 1024 * 1024) {
                        return `${sizeInKB} KB`;
                    } else {
                        return `${sizeInMB} MB`;
                    }
                }
                return '0 B';
            }

            // Company Settings Functions
            saveCompanySettings(event) {
                event.preventDefault();

                const formData = new FormData(event.target);
                const companySettings = {
                    companyName: formData.get('companyName'),
                    taxCode: formData.get('taxCode'),
                    address: formData.get('address'),
                    phone: formData.get('phone'),
                    email: formData.get('email'),
                    representative: formData.get('representative'),
                    position: formData.get('position'),
                    description: formData.get('description'),
                    updatedAt: this.getVietnamTime().toISOString()
                };

                // Validate required fields
                if (!companySettings.companyName.trim() || !companySettings.address.trim() || !companySettings.phone.trim()) {
                    this.showNotification('Vui lòng điền đầy đủ thông tin bắt buộc (có dấu *)', 'error');
                    return;
                }

                // Save to localStorage
                localStorage.setItem('company_settings', JSON.stringify(companySettings));
                this.showNotification('Đã lưu thông tin công ty thành công! Thông tin này sẽ hiển thị trên hóa đơn in ra.', 'success');

                console.log('💾 Company settings saved:', companySettings);
            }

            resetCompanySettings() {
                if (confirm('Bạn có chắc chắn muốn xóa tất cả thông tin công ty đã lưu?')) {
                    localStorage.removeItem('company_settings');
                    this.showNotification('Đã xóa thông tin công ty', 'success');

                    // Reload settings page to show empty form
                    this.loadPage('settings');
                }
            }

            getCompanySettings() {
                try {
                    const settings = localStorage.getItem('company_settings');
                    if (!settings) return {};

                    const parsed = JSON.parse(settings);

                    // Validate that logo and QR data exist
                    console.log('Loading company settings...');
                    console.log('Logo exists:', !!parsed.logo);
                    console.log('QR exists:', !!parsed.qrCode);

                    return parsed;
                } catch (error) {
                    console.error('Error loading company settings:', error);
                    return {};
                }
            }

            // Debug function to check localStorage
            testLocalStorage() {
                const settings = localStorage.getItem('company_settings');
                console.log('=== FULL DEBUG LOCALSTORAGE ===');
                console.log('Raw data exists:', !!settings);
                console.log('Data length:', settings ? settings.length : 0);
                console.log('Size estimate:', this.getLocalStorageSize());

                if (settings) {
                    try {
                        const parsed = JSON.parse(settings);
                        console.log('Parsed successfully');
                        console.log('Company name:', parsed.companyName || 'Not set');
                        console.log('Logo exists:', !!parsed.logo, parsed.logo ? `(${(parsed.logo.length/1024).toFixed(1)}KB)` : '');
                        console.log('QR exists:', !!parsed.qrCode, parsed.qrCode ? `(${(parsed.qrCode.length/1024).toFixed(1)}KB)` : '');
                    } catch (error) {
                        console.error('JSON Parse Error:', error);
                    }
                }
                alert('Kiểm tra console để xem chi tiết localStorage');
            }

            // Check localStorage usage
            getLocalStorageSize() {
                let total = 0;
                for (let key in localStorage) {
                    if (localStorage.hasOwnProperty(key)) {
                        total += localStorage[key].length + key.length;
                    }
                }
                return `${(total / 1024).toFixed(1)} KB`;
            }

            // Restore logo and QR after page load
            restoreLogoAndQR() {
                console.log('=== RESTORING LOGO/QR AFTER PAGE LOAD ===');
                const companySettings = this.getCompanySettings();

                // Restore logo if exists
                if (companySettings.logo) {
                    const logoDisplay = document.getElementById('logo-display');
                    if (logoDisplay) {
                        logoDisplay.innerHTML = `<img src="${companySettings.logo}" alt="Logo" style="max-width: 100%; max-height: 140px; object-fit: contain;">`;
                        console.log('✅ Logo restored successfully');
                    }
                }

                // Restore QR if exists  
                if (companySettings.qrCode) {
                    const qrDisplay = document.getElementById('qr-display');
                    if (qrDisplay) {
                        qrDisplay.innerHTML = `<img src="${companySettings.qrCode}" alt="QR Code" style="max-width: 100%; max-height: 140px; object-fit: contain;">`;
                        console.log('✅ QR Code restored successfully');
                    }
                }

                console.log('Restore complete - Logo:', !!companySettings.logo, 'QR:', !!companySettings.qrCode);
            }

            // Compress image before saving to localStorage
            compressImage(file, quality = 0.7, maxWidth = 300, maxHeight = 300) {
                return new Promise((resolve, reject) => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    const img = new Image();

                    img.onload = () => {
                        // Calculate new dimensions maintaining aspect ratio
                        let { width, height } = img;

                        if (width > height) {
                            if (width > maxWidth) {
                                height = height * (maxWidth / width);
                                width = maxWidth;
                            }
                        } else {
                            if (height > maxHeight) {
                                width = width * (maxHeight / height);
                                height = maxHeight;
                            }
                        }

                        canvas.width = width;
                        canvas.height = height;

                        // Draw and compress
                        ctx.drawImage(img, 0, 0, width, height);
                        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
                        resolve(compressedDataUrl);
                    };

                    img.onerror = () => reject(new Error('Failed to load image'));

                    const reader = new FileReader();
                    reader.onload = (e) => {
                        img.src = e.target.result;
                    };
                    reader.onerror = () => reject(new Error('Failed to read file'));
                    reader.readAsDataURL(file);
                });
            }

            // HOSTING SOLUTION: Simple logo upload với localStorage
            uploadLogoSimple(event) {
                const file = event.target.files[0];
                if (!file) return;

                if (!file.type.startsWith('image/')) {
                    alert('Vui lòng chọn file hình ảnh!');
                    return;
                }

                const reader = new FileReader();
                reader.onload = (e) => {
                    const imageData = e.target.result;

                    // Lưu vào global variable
                    window.companyAssets.logo = imageData;

                    // ✅ LƯU VÀO LOCALSTORAGE - KHÔNG MẤT KHI F5
                    localStorage.setItem('company_logo', imageData);

                    // Update display ngay lập tức
                    const logoDisplay = document.getElementById('logo-display');
                    logoDisplay.innerHTML = `<img src="${imageData}" alt="Logo" style="max-width: 100%; max-height: 140px; object-fit: contain;">`;

                    alert('✅ Upload logo thành công! Logo đã lưu vĩnh viễn, không mất khi F5.');
                };
                reader.readAsDataURL(file);
            }

            // HOSTING SOLUTION: Simple QR upload với localStorage
            uploadQRSimple(event) {
                const file = event.target.files[0];
                if (!file) return;

                if (!file.type.startsWith('image/')) {
                    alert('Vui lòng chọn file hình ảnh!');
                    return;
                }

                const reader = new FileReader();
                reader.onload = (e) => {
                    const imageData = e.target.result;

                    // Lưu vào global variable
                    window.companyAssets.qr = imageData;

                    // ✅ LƯU VÀO LOCALSTORAGE - KHÔNG MẤT KHI F5
                    localStorage.setItem('company_qr', imageData);

                    // Update display ngay lập tức
                    const qrDisplay = document.getElementById('qr-display');
                    qrDisplay.innerHTML = `<img src="${imageData}" alt="QR Code" style="max-width: 100%; max-height: 140px; object-fit: contain;">`;

                    alert('✅ Upload QR code thành công! QR đã lưu vĩnh viễn, không mất khi F5.');
                };
                reader.readAsDataURL(file);
            }

            // Logo upload function - Save to uploads folder
            uploadLogo(event) {
                const file = event.target.files[0];
                if (!file) return;

                // Check file type
                if (!file.type.startsWith('image/')) {
                    this.showNotification('Vui lòng chọn file hình ảnh (PNG, JPG, GIF)', 'error');
                    return;
                }

                // Check file size (max 2MB)
                if (file.size > 2 * 1024 * 1024) {
                    this.showNotification('Kích thước file quá lớn. Vui lòng chọn file dưới 2MB', 'error');
                    return;
                }

                // Create unique filename
                const timestamp = Date.now();
                const fileName = `logo_${timestamp}.${file.name.split('.').pop()}`;
                const logoPath = `uploads/${fileName}`;

                // Compress and save file
                this.compressImage(file, 0.7, 300, 300).then(compressedImageData => {

                    // Save logo to company settings with error handling
                    const companySettings = this.getCompanySettings();
                    companySettings.logo = compressedImageData;
                    companySettings.logoPath = logoPath;
                    companySettings.logoFileName = fileName;
                    companySettings.logoTimestamp = timestamp;

                    // Save with error handling
                    try {
                        localStorage.setItem('company_settings', JSON.stringify(companySettings));
                        // Double check save
                        const testSave = localStorage.getItem('company_settings');
                        if (testSave && JSON.parse(testSave).logo) {
                            console.log('Logo successfully saved to localStorage');
                        } else {
                            throw new Error('Save verification failed');
                        }
                    } catch (error) {
                        console.error('Error saving logo:', error);
                        this.showNotification('Lỗi lưu logo. Thử lại với file nhỏ hơn.', 'error');
                        return;
                    }

                    // Debug log
                    console.log('Logo saved with path:', logoPath);
                    console.log('Logo data saved:', !!companySettings.logo);

                    // Update display
                    const logoDisplay = document.getElementById('logo-display');
                    logoDisplay.innerHTML = `<img src="${compressedImageData}" alt="Logo" style="max-width: 100%; max-height: 140px; object-fit: contain;">`;

                    // Add remove button
                    const buttonContainer = logoDisplay.parentElement.querySelector('div:last-child');
                    if (!buttonContainer.querySelector('button[onclick*="removeLogo"]')) {
                        buttonContainer.innerHTML = `
                            <button type="button" onclick="document.getElementById('logo-input').click()" 
                                    style="background: var(--primary-blue); color: white; padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">
                                📁 Chọn Logo
                            </button>
                            <button type="button" onclick="app.removeLogo()" 
                                    style="background: #dc2626; color: white; padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">
                                🗑️ Xóa
                            </button>
                        `;
                    }

                    this.showNotification(`Đã lưu logo nén vào ${logoPath}!`, 'success');
                    console.log('Compressed logo size:', (compressedImageData.length/1024).toFixed(1) + 'KB');
                }).catch(error => {
                    console.error('Compression error:', error);
                    this.showNotification('Lỗi nén ảnh. Thử với file khác.', 'error');
                });
            }

            // Remove logo function
            removeLogo() {
                if (!confirm('Bạn có chắc chắn muốn xóa logo?')) return;

                // Remove logo from company settings
                const companySettings = this.getCompanySettings();
                delete companySettings.logo;
                localStorage.setItem('company_settings', JSON.stringify(companySettings));

                // Update display
                const logoDisplay = document.getElementById('logo-display');
                logoDisplay.innerHTML = '<div style="color: #9ca3af; font-size: 14px;">Chưa có logo</div>';

                // Remove delete button
                const buttonContainer = logoDisplay.parentElement.querySelector('div:last-child');
                buttonContainer.innerHTML = `
                    <button type="button" onclick="document.getElementById('logo-input').click()" 
                            style="background: var(--primary-blue); color: white; padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">
                        📁 Chọn Logo
                    </button>
                `;

                this.showNotification('Đã xóa logo', 'success');
            }

            // Generate QR Code function
            generateQRCode() {
                const companySettings = this.getCompanySettings();

                if (!companySettings.companyName && !companySettings.phone) {
                    this.showNotification('Vui lòng điền thông tin công ty trước khi tạo mã QR', 'error');
                    return;
                }

                // Create contact info string
                let contactInfo = '';
                if (companySettings.companyName) contactInfo += `Công ty: ${companySettings.companyName}\n`;
                if (companySettings.address) contactInfo += `Địa chỉ: ${companySettings.address}\n`;
                if (companySettings.phone) contactInfo += `SĐT: ${companySettings.phone}\n`;
                if (companySettings.email) contactInfo += `Email: ${companySettings.email}\n`;
                if (companySettings.taxCode) contactInfo += `MST: ${companySettings.taxCode}`;

                // Generate QR code using qr-server.com API
                const qrSize = 150;
                const qrURL = `https://api.qrserver.com/v1/create-qr-code/?size=${qrSize}x${qrSize}&data=${encodeURIComponent(contactInfo)}&format=png&bgcolor=FFFFFF&color=000000&margin=10`;

                // Update QR display
                const qrDisplay = document.getElementById('qr-display');
                qrDisplay.innerHTML = `<img src="${qrURL}" alt="QR Code" style="max-width: 100%; max-height: 140px; object-fit: contain;" 
                     onload="app.showNotification('Đã tạo mã QR thành công!', 'success')"
                     onerror="app.showNotification('Không thể tạo mã QR. Vui lòng kiểm tra kết nối internet', 'error')">`;

                // Save QR URL to company settings
                companySettings.qrCode = qrURL;
                localStorage.setItem('company_settings', JSON.stringify(companySettings));

                // Debug log
                console.log('QR saved to localStorage:', !!companySettings.qrCode);
                console.log('QR URL:', qrURL);

                // Test localStorage immediately
                setTimeout(() => {
                    const testSettings = this.getCompanySettings();
                    console.log('Test read QR back from localStorage:', !!testSettings.qrCode);
                }, 100);

                // Reload page to show delete button WITHOUT clearing localStorage
                setTimeout(() => {
                    this.loadPage('company-info');
                }, 200);
            }

            // Upload QR Code function - Save to uploads folder
            uploadQR(event) {
                const file = event.target.files[0];
                if (!file) return;

                // Validate file type
                if (!file.type.startsWith('image/')) {
                    this.showNotification('Vui lòng chọn file hình ảnh (PNG, JPG, GIF)', 'error');
                    return;
                }

                // Validate file size (2MB limit)
                if (file.size > 2 * 1024 * 1024) {
                    this.showNotification('File quá lớn! Vui lòng chọn file dưới 2MB', 'error');
                    return;
                }

                // Create unique filename
                const timestamp = Date.now();
                const fileName = `qr_${timestamp}.${file.name.split('.').pop()}`;
                const qrPath = `uploads/${fileName}`;

                // Compress and save QR code
                this.compressImage(file, 0.8, 200, 200).then(compressedQrData => {
                    // Update QR display
                    const qrDisplay = document.getElementById('qr-display');
                    qrDisplay.innerHTML = `<img src="${compressedQrData}" alt="QR Code" style="max-width: 100%; max-height: 140px; object-fit: contain;">`;

                    // Save QR to company settings with error handling
                    const companySettings = this.getCompanySettings();
                    companySettings.qrCode = compressedQrData;
                    companySettings.qrPath = qrPath;
                    companySettings.qrFileName = fileName;
                    companySettings.qrTimestamp = timestamp;

                    // Save with error handling
                    try {
                        localStorage.setItem('company_settings', JSON.stringify(companySettings));
                        // Double check save
                        const testSave = localStorage.getItem('company_settings');
                        if (testSave && JSON.parse(testSave).qrCode) {
                            console.log('QR successfully saved to localStorage');
                        } else {
                            throw new Error('QR save verification failed');
                        }
                    } catch (error) {
                        console.error('Error saving QR:', error);
                        this.showNotification('Lỗi lưu QR. Thử lại với file nhỏ hơn.', 'error');
                        return;
                    }

                    this.showNotification(`Đã lưu mã QR nén vào ${qrPath}!`, 'success');
                    console.log('QR saved with path:', qrPath);
                    console.log('Compressed QR size:', (compressedQrData.length/1024).toFixed(1) + 'KB');

                    // Reload page to show delete button
                    setTimeout(() => {
                        this.loadPage('company-info');
                    }, 200);
                }).catch(error => {
                    console.error('QR compression error:', error);
                    this.showNotification('Lỗi nén ảnh QR. Thử với file khác.', 'error');
                });
            }

            // Remove QR Code function  
            removeQR() {
                if (!confirm('Bạn có chắc chắn muốn xóa mã QR?')) return;

                // Remove QR from company settings
                const companySettings = this.getCompanySettings();
                delete companySettings.qrCode;
                localStorage.setItem('company_settings', JSON.stringify(companySettings));

                // Update display
                const qrDisplay = document.getElementById('qr-display');
                qrDisplay.innerHTML = '<div style="color: #9ca3af; font-size: 14px;">Chưa có mã QR</div>';

                this.showNotification('Đã xóa mã QR', 'success');

                // Reload page to hide delete button
                this.loadPage('company-info');
            }

            // Sales Management Functions
            showCreateSaleForm() {
                const customerOptions = this.demoData.customers.map(c => 
                    `<option value="${c.id}">${c.name} - ${c.phone}</option>`
                ).join('');

                const productOptions = this.demoData.products.map(p => 
                    `<option value="${p.id}" data-price="${p.price}" data-stock="${p.stock}">${p.name} - ${p.price.toLocaleString('vi-VN')} VNĐ (Còn: ${p.stock})</option>`
                ).join('');

                const formHTML = `
                    <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1001; display: flex; justify-content: center; align-items: center; overflow-y: auto;" onclick="closeModal(this)">
                        <div style="background: white; padding: 32px; border-radius: 12px; width: 1000px; max-width: 95vw;" onclick="event.stopPropagation()">
                            <h3 style="margin-bottom: 24px; color: var(--text-primary);">Tạo đơn bán hàng mới</h3>
                            <form onsubmit="app.createSaleOrder(event)">
                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Tên khách hàng:</label>
                                    <input type="text" name="customerName" required placeholder="Nhập tên khách hàng" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                </div>
                                <div style="display: flex; gap: 12px; margin-bottom: 16px;">
                                    <div style="flex: 1;">
                                        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Số điện thoại:</label>
                                        <input type="tel" name="customerPhone" required placeholder="Nhập số điện thoại" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                    </div>
                                    <div style="flex: 2;">
                                        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Địa chỉ:</label>
                                        <input type="text" name="customerAddress" required placeholder="Nhập địa chỉ giao hàng" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                    </div>
                                </div>

                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Sản phẩm:</label>
                                    <div id="product-items">
                                        <div class="product-item" style="display: flex; gap: 8px; margin-bottom: 8px; align-items: center;">
                                            <div class="custom-dropdown" style="flex: 2; position: relative;">
                                                <div class="dropdown-selected" onclick="app.toggleProductDropdown(this)" 
                                                     style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; background: white; cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
                                                    <span class="selected-text" style="color: #9ca3af;">Chọn sản phẩm</span>
                                                    <span class="dropdown-arrow" style="transform: rotate(0deg); transition: transform 0.3s;">▼</span>
                                                </div>
                                                <div class="dropdown-list" style="position: absolute; top: 100%; left: 0; right: 0; background: white; border: 2px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; max-height: 200px; overflow-y: auto; z-index: 1000; display: none;">
                                                    <div style="padding: 8px; border-bottom: 1px solid #e5e7eb;">
                                                        <input type="text" class="dropdown-search" placeholder="🔍 Tìm sản phẩm..." 
                                                               style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 14px;" 
                                                               oninput="app.filterDropdownItems(this, 'product')" 
                                                               onclick="event.stopPropagation()">
                                                    </div>
                                                    <div class="dropdown-options">
                                                        ${this.demoData.products.map(p => 
                                                            `<div class="dropdown-option" data-value="${p.id}" data-price="${p.price}" data-stock="${p.stock}" 
                                                                  onclick="app.selectProduct(this, '${p.id}', '${p.name} - ${p.price.toLocaleString('vi-VN')} VNĐ', ${p.price})" 
                                                                  style="padding: 10px; cursor: pointer; border-bottom: 1px solid #f3f4f6;" 
                                                                  onmouseover="this.style.background='#f3f4f6'" onmouseout="this.style.background='white'">
                                                                ${p.name} - ${p.price.toLocaleString('vi-VN')} VNĐ (Còn: ${p.stock})
                                                            </div>`
                                                        ).join('')}
                                                    </div>
                                                </div>
                                                <input type="hidden" name="products[]" required>
                                            </div>
                                            <input type="number" name="quantities[]" placeholder="Số lượng" min="1" required style="flex: 1; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;" onchange="app.calculateTotal()">
                                            <input type="number" name="prices[]" placeholder="Giá" readonly style="flex: 1; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; background: #f9fafb;">
                                            <button type="button" onclick="this.parentElement.remove(); app.calculateTotal();" style="background: #ef4444; color: white; padding: 12px; border: none; border-radius: 8px; cursor: pointer;">Xóa</button>
                                        </div>
                                    </div>
                                    <button type="button" onclick="app.addProductItem()" style="background: #10b981; color: white; padding: 8px 16px; border: none; border-radius: 8px; cursor: pointer; margin-top: 8px;">+ Thêm sản phẩm</button>
                                </div>

                                <div style="margin-bottom: 16px; border: 2px solid red; padding: 10px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: red;">⭐ GHI CHÚ ĐƠN HÀNG (ĐÃ CÓ RỒII!):</label>
                                    <textarea name="orderNotes" placeholder="Nhập ghi chú cho đơn hàng (không bắt buộc)" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; min-height: 80px; resize: vertical;"></textarea>
                                </div>

                                <div style="margin-bottom: 24px; padding: 16px; background: #f9fafb; border-radius: 8px;">
                                    <div style="display: flex; justify-content: space-between; align-items: center;">
                                        <strong>Tổng tiền:</strong>
                                        <strong id="total-amount" style="color: #059669; font-size: 18px;">0 VNĐ</strong>
                                    </div>
                                </div>

                                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                                    <button type="button" onclick="closeModal(this.closest('div[style*=fixed]'))" 
                                            style="padding: 12px 24px; border: 2px solid #e5e7eb; background: white; border-radius: 8px; cursor: pointer;">Hủy</button>
                                    <button type="submit" 
                                            style="padding: 12px 24px; background: var(--primary-blue); color: white; border: none; border-radius: 8px; cursor: pointer;">Tạo đơn hàng</button>
                                </div>
                            </form>
                        </div>
                    </div>
                `;
                document.body.insertAdjacentHTML('beforeend', formHTML);
            }

            addProductItem() {
                const productItemHTML = `
                    <div class="product-item" style="display: flex; gap: 8px; margin-bottom: 8px; align-items: center;">
                        <div class="custom-dropdown" style="flex: 2; position: relative;">
                            <div class="dropdown-selected" onclick="app.toggleProductDropdown(this)" 
                                 style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; background: white; cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
                                <span class="selected-text" style="color: #9ca3af;">Chọn sản phẩm</span>
                                <span class="dropdown-arrow" style="transform: rotate(0deg); transition: transform 0.3s;">▼</span>
                            </div>
                            <div class="dropdown-list" style="position: absolute; top: 100%; left: 0; right: 0; background: white; border: 2px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; max-height: 200px; overflow-y: auto; z-index: 1000; display: none;">
                                <div style="padding: 8px; border-bottom: 1px solid #e5e7eb;">
                                    <input type="text" class="dropdown-search" placeholder="🔍 Tìm sản phẩm..." 
                                           style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 14px;" 
                                           oninput="app.filterDropdownItems(this, 'product')" 
                                           onclick="event.stopPropagation()">
                                </div>
                                <div class="dropdown-options">
                                    ${this.demoData.products.map(p => 
                                        `<div class="dropdown-option" data-value="${p.id}" data-price="${p.price}" data-stock="${p.stock}" 
                                              onclick="app.selectProduct(this, '${p.id}', '${p.name} - ${p.price.toLocaleString('vi-VN')} VNĐ', ${p.price})" 
                                              style="padding: 10px; cursor: pointer; border-bottom: 1px solid #f3f4f6;" 
                                              onmouseover="this.style.background='#f3f4f6'" onmouseout="this.style.background='white'">
                                            ${p.name} - ${p.price.toLocaleString('vi-VN')} VNĐ (Còn: ${p.stock})
                                        </div>`
                                    ).join('')}
                                </div>
                            </div>
                            <input type="hidden" name="products[]" required>
                        </div>
                        <input type="number" name="quantities[]" placeholder="Số lượng" min="1" required style="flex: 1; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;" onchange="app.calculateTotal()">
                        <input type="number" name="prices[]" placeholder="Giá" readonly style="flex: 1; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; background: #f9fafb;">
                        <button type="button" onclick="this.parentElement.remove(); app.calculateTotal();" style="background: #ef4444; color: white; padding: 12px; border: none; border-radius: 8px; cursor: pointer;">Xóa</button>
                    </div>
                `;
                document.getElementById('product-items').insertAdjacentHTML('beforeend', productItemHTML);
            }

            updateProductPrice(selectElement) {
                console.log('=== updateProductPrice được gọi ===');
                console.log('selectElement:', selectElement);

                const selectedOption = selectElement.options[selectElement.selectedIndex];
                console.log('selectedOption:', selectedOption);

                const price = selectedOption.getAttribute('data-price') || 0;
                console.log('Giá từ data-price:', price);

                // Tìm input price trong cùng div product-item
                const productItem = selectElement.closest('.product-item');
                console.log('productItem tìm thấy:', productItem);

                const priceInput = productItem ? productItem.querySelector('input[name="prices[]"]') : null;
                console.log('priceInput tìm thấy:', priceInput);

                if (priceInput) {
                    priceInput.value = price;
                    console.log('✅ ĐÃ CẬP NHẬT GIÁ THÀNH CÔNG:', price);
                    // Force trigger event để đảm bảo UI update
                    priceInput.dispatchEvent(new Event('change'));
                } else {
                    console.error('❌ KHÔNG TÌM THẤY INPUT PRICE - DEBUG INFO:');
                    console.error('- selectElement parent:', selectElement.parentElement);
                    console.error('- Tất cả input trong productItem:', productItem ? productItem.querySelectorAll('input') : 'productItem null');
                }

                this.calculateTotal();
                console.log('=== updateProductPrice kết thúc ===');
            }

            calculateTotal() {
                console.log('=== calculateTotal được gọi ===');
                const quantities = document.querySelectorAll('input[name="quantities[]"]');
                const prices = document.querySelectorAll('input[name="prices[]"]');
                let total = 0;

                console.log('Số lượng input quantities:', quantities.length);
                console.log('Số lượng input prices:', prices.length);

                for (let i = 0; i < quantities.length; i++) {
                    const qty = parseInt(quantities[i].value) || 0;
                    const price = parseInt(prices[i].value) || 0;
                    console.log(`Item ${i}: qty=${qty}, price=${price}, subtotal=${qty * price}`);
                    total += qty * price;
                }

                console.log('Tổng tiền:', total);
                const totalElement = document.getElementById('total-amount');
                if (totalElement) {
                    totalElement.textContent = total.toLocaleString('vi-VN') + ' VNĐ';
                    console.log('✅ Đã cập nhật total-amount');
                } else {
                    console.error('❌ Không tìm thấy element total-amount');
                }
                console.log('=== calculateTotal kết thúc ===');
            }

            createSaleOrder(event) {
                event.preventDefault();
                const form = event.target;
                const formData = new FormData(form);

                const products = formData.getAll('products[]');
                const quantities = formData.getAll('quantities[]');
                const prices = formData.getAll('prices[]');

                if (products.length === 0 || products[0] === '') {
                    this.showNotification('Vui lòng chọn ít nhất một sản phẩm', 'error');
                    return;
                }

                // Tạo thông tin khách hàng từ form
                const customerInfo = {
                    name: formData.get('customerName'),
                    phone: formData.get('customerPhone'),
                    address: formData.get('customerAddress')
                };
                let total = 0;
                const items = [];

                for (let i = 0; i < products.length; i++) {
                    if (products[i] && quantities[i] && prices[i]) {
                        const product = this.demoData.products.find(p => p.id === products[i]);
                        const qty = parseInt(quantities[i]);
                        const price = parseInt(prices[i]);

                        // Check stock
                        if (qty > product.stock) {
                            this.showNotification(`Không đủ hàng cho sản phẩm ${product.name}. Còn lại: ${product.stock}`, 'error');
                            return;
                        }

                        items.push({
                            productId: products[i],
                            productName: product.name,
                            quantity: qty,
                            price: price,
                            subtotal: qty * price
                        });

                        total += qty * price;

                        // Update stock
                        product.stock -= qty;
                    }
                }

                const newSale = {
                    id: 'DH' + String(this.demoData.sales.length + 1).padStart(3, '0'),
                    date: this.getVietnamTime().toISOString().split('T')[0],
                    customer: customerInfo.name,
                    customerPhone: customerInfo.phone,
                    customerAddress: customerInfo.address,
                    notes: formData.get('orderNotes') || '',
                    total: total,
                    status: 'Chờ xử lý',
                    items: items.length,
                    itemDetails: items
                };

                this.demoData.sales.unshift(newSale);
                this.saveToLocalStorage();
                this.showNotification(`Đã tạo đơn hàng ${newSale.id} thành công`, 'success');
                this.loadPage('sales');
                const modal = form.closest("div[style*=\"fixed\"]"); if(modal) modal.remove();
            }

            // Product Management Functions  
            showAddProductForm() {
                const supplierOptions = this.demoData.suppliers.map(s => 
                    `<option value="${s.id}">${s.name}</option>`
                ).join('');

                const formHTML = `
                    <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1001; display: flex; justify-content: center; align-items: center;" onclick="closeModal(this)">
                        <div style="background: white; padding: 32px; border-radius: 12px; width: 500px; max-width: 90vw;" onclick="event.stopPropagation()">
                            <h3 style="margin-bottom: 24px; color: var(--text-primary);">Thêm sản phẩm mới</h3>
                            <form onsubmit="app.addProduct(event)">
                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Tên sản phẩm:</label>
                                    <input type="text" name="name" required style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                </div>
                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Danh mục:</label>
                                    <select name="category" required style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;" id="categorySelect">
                                        ${this.getCategoryOptions()}
                                    </select>
                                </div>
                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Giá nhập:</label>
                                    <input type="number" name="importPrice" required style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                </div>
                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Giá bán:</label>
                                    <input type="number" name="price" required style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                </div>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                                    <div>
                                        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Số lượng tồn kho:</label>
                                        <input type="number" name="stock" required min="0" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                    </div>
                                    <div>
                                        <label style="display: block; margin-bottom: 8px; font-weight: 600;">🔔 Tồn kho tối thiểu:</label>
                                        <input type="number" name="minStock" value="10" required min="0" style="width: 100%; padding: 12px; border: 2px solid #f59e0b; border-radius: 8px;" placeholder="Cảnh báo khi dưới...">
                                    </div>
                                </div>
                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">📅 Hạn sử dụng:</label>
                                    <input type="date" name="expiryDate" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                </div>
                                <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 12px; margin-bottom: 16px;">
                                    <div style="display: flex; align-items: center; gap: 8px; color: #92400e; font-size: 14px;">
                                        <span>💡</span>
                                        <span><strong>Mẹo:</strong> Hệ thống sẽ cảnh báo khi tồn kho thấp hơn ngưỡng tối thiểu và khi sản phẩm sắp hết hạn sử dụng</span>
                                    </div>
                                </div>
                                <div style="margin-bottom: 24px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Nhà cung cấp:</label>
                                    <select name="supplier" required style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                        <option value="">Chọn nhà cung cấp</option>
                                        ${supplierOptions}
                                    </select>
                                </div>
                                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                                    <button type="button" onclick="closeModal(this.closest('div[style*=fixed]'))" 
                                            style="padding: 12px 24px; border: 2px solid #e5e7eb; background: white; border-radius: 8px; cursor: pointer;">Hủy</button>
                                    <button type="submit" 
                                            style="padding: 12px 24px; background: var(--primary-blue); color: white; border: none; border-radius: 8px; cursor: pointer;">Thêm sản phẩm</button>
                                </div>
                            </form>
                        </div>
                    </div>
                `;
                document.body.insertAdjacentHTML('beforeend', formHTML);
            }

            addProduct(event) {
                event.preventDefault();
                const form = event.target;
                const formData = new FormData(form);

                const newProduct = {
                    id: 'SP' + String(this.demoData.products.length + 1).padStart(3, '0'),
                    name: formData.get('name'),
                    category: formData.get('category'),
                    importPrice: parseInt(formData.get('importPrice')),
                    price: parseInt(formData.get('price')),
                    stock: parseInt(formData.get('stock')),
                    minStock: parseInt(formData.get('minStock')),
                    supplier: formData.get('supplier')
                };

                this.demoData.products.push(newProduct);
                this.saveToLocalStorage();
                this.showNotification(`Đã thêm sản phẩm ${newProduct.name}`, 'success');
                this.loadPage('products');
                const modal = form.closest("div[style*=\"fixed\"]"); if(modal) modal.remove();
            }

            // Chỉnh sửa sản phẩm
            showEditProductForm(productId) {
                console.log('🛠️ showEditProductForm được gọi với productId:', productId);
                const product = this.demoData.products.find(p => p.id === productId);
                console.log('📦 Sản phẩm tìm thấy:', product);
                if (!product) {
                    this.showNotification('Không tìm thấy sản phẩm', 'error');
                    return;
                }

                const supplierOptions = this.demoData.suppliers.map(s => 
                    `<option value="${s.id}" ${s.id === product.supplier ? 'selected' : ''}>${s.name}</option>`
                ).join('');

                const formHTML = `
                    <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1001; display: flex; justify-content: center; align-items: center;" onclick="closeModal(this)">
                        <div style="background: white; padding: 32px; border-radius: 12px; width: 500px; max-width: 90vw;" onclick="event.stopPropagation()">
                            <h3 style="margin-bottom: 24px; color: var(--text-primary);">✏️ Chỉnh sửa sản phẩm</h3>
                            <form onsubmit="app.updateProduct(event, '${productId}')">
                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Tên sản phẩm:</label>
                                    <input type="text" name="name" value="${product.name}" required style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                </div>
                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Danh mục:</label>
                                    <select name="category" required style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                        ${this.getCategoryOptionsWithSelected(product.category)}
                                    </select>
                                </div>
                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Giá nhập:</label>
                                    <input type="number" name="importPrice" value="${product.importPrice || 0}" required style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                </div>
                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Giá bán:</label>
                                    <input type="number" name="price" value="${product.price}" required style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                </div>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                                    <div>
                                        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Số lượng tồn kho:</label>
                                        <input type="number" name="stock" value="${product.stock}" required min="0" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                    </div>
                                    <div>
                                        <label style="display: block; margin-bottom: 8px; font-weight: 600;">🔔 Tồn kho tối thiểu:</label>
                                        <input type="number" name="minStock" value="${product.minStock || 10}" required min="0" style="width: 100%; padding: 12px; border: 2px solid #f59e0b; border-radius: 8px;" placeholder="Cảnh báo khi dưới...">
                                    </div>
                                </div>
                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">📅 Hạn sử dụng:</label>
                                    <input type="date" name="expiryDate" value="${product.expiryDate || ''}" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                </div>
                                <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 12px; margin-bottom: 16px;">
                                    <div style="display: flex; align-items: center; gap: 8px; color: #92400e; font-size: 14px;">
                                        <span>💡</span>
                                        <span><strong>Mẹo:</strong> Hệ thống sẽ cảnh báo khi tồn kho thấp hơn ngưỡng tối thiểu và khi sản phẩm sắp hết hạn sử dụng</span>
                                    </div>
                                </div>
                                <div style="margin-bottom: 24px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Nhà cung cấp:</label>
                                    <select name="supplier" required style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                        <option value="">Chọn nhà cung cấp</option>
                                        ${supplierOptions}
                                    </select>
                                </div>
                                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                                    <button type="button" onclick="closeModal(this.closest('div[style*=fixed]'))" 
                                            style="padding: 12px 24px; border: 2px solid #e5e7eb; background: white; border-radius: 8px; cursor: pointer;">Hủy</button>
                                    <button type="submit" 
                                            style="padding: 12px 24px; background: var(--primary-blue); color: white; border: none; border-radius: 8px; cursor: pointer;">Cập nhật</button>
                                </div>
                            </form>
                        </div>
                    </div>
                `;
                document.body.insertAdjacentHTML('beforeend', formHTML);
            }

            // Cập nhật sản phẩm
            updateProduct(event, productId) {
                event.preventDefault();
                const form = event.target;
                const formData = new FormData(form);

                const productIndex = this.demoData.products.findIndex(p => p.id === productId);
                if (productIndex === -1) {
                    this.showNotification('Không tìm thấy sản phẩm', 'error');
                    return;
                }

                // Cập nhật thông tin sản phẩm
                this.demoData.products[productIndex] = {
                    ...this.demoData.products[productIndex],
                    name: formData.get('name'),
                    category: formData.get('category'),
                    importPrice: parseInt(formData.get('importPrice')),
                    price: parseInt(formData.get('price')),
                    stock: parseInt(formData.get('stock')),
                    minStock: parseInt(formData.get('minStock')),
                    supplier: formData.get('supplier'),
                    expiryDate: formData.get('expiryDate') || ''
                };

                this.saveToLocalStorage();
                this.showNotification(`Đã cập nhật sản phẩm ${formData.get('name')}`, 'success');
                this.loadPage('products');
                const modal = form.closest("div[style*=\"fixed\"]"); if(modal) modal.remove();
            }

            // Helper function để tạo category options với selected
            getCategoryOptionsWithSelected(selectedCategory) {
                const categories = this.demoData.categories || [];
                let options = '<option value="">Chọn danh mục</option>';

                // Group by parent
                const parentCategories = categories.filter(c => c.parent === null);
                const childCategories = categories.filter(c => c.parent !== null);

                parentCategories.forEach(parent => {
                    const children = childCategories.filter(c => c.parent === parent.id);

                    if (children.length > 0) {
                        options += `<optgroup label="${parent.name}">`;
                        const parentSelected = parent.name === selectedCategory ? 'selected' : '';
                        options += `<option value="${parent.name}" ${parentSelected}>${parent.name}</option>`;
                        children.forEach(child => {
                            const childValue = `${parent.name} > ${child.name}`;
                            const childSelected = childValue === selectedCategory ? 'selected' : '';
                            options += `<option value="${childValue}" ${childSelected}>${child.name}</option>`;
                        });
                        options += `</optgroup>`;
                    } else {
                        const parentSelected = parent.name === selectedCategory ? 'selected' : '';
                        options += `<option value="${parent.name}" ${parentSelected}>${parent.name}</option>`;
                    }
                });

                return options;
            }

            // Supplier Management Functions
            showAddSupplierForm() {
                const formHTML = `
                    <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1001; display: flex; justify-content: center; align-items: center;" onclick="closeModal(this)">
                        <div style="background: white; padding: 32px; border-radius: 12px; width: 700px; max-width: 95vw; max-height: 90vh; overflow-y: auto;" onclick="event.stopPropagation()">
                            <h3 style="margin-bottom: 24px; color: var(--text-primary);">🏭 Thêm nhà cung cấp mới</h3>
                            <form onsubmit="app.addSupplier(event)">
                                <!-- Hàng 1: Tên NCC và Loại NCC -->
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                                    <div>
                                        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Tên nhà cung cấp: *</label>
                                        <input type="text" name="name" required 
                                               style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                    </div>
                                    <div>
                                        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Loại nhà cung cấp: *</label>
                                        <select name="type" required onchange="app.toggleSupplierFields(this.value)"
                                               style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                            <option value="">Chọn loại</option>
                                            <option value="ca-nhan">Cá nhân</option>
                                            <option value="doanh-nghiep">Doanh nghiệp</option>
                                        </select>
                                    </div>
                                </div>

                                <!-- Hàng 2: Mã NCC và Mã số thuế (doanh nghiệp) -->
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                                    <div id="supplier-code-field" style="display: none;">
                                        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Mã nhà cung cấp: *</label>
                                        <input type="text" name="supplierCode" 
                                               style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                    </div>
                                    <div id="supplier-tax-field" style="display: none;">
                                        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Mã số thuế:</label>
                                        <input type="text" name="taxCode"
                                               style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                    </div>
                                </div>

                                <!-- Hàng 3: Đại diện pháp luật và Chức vụ -->
                                <div id="legal-info-fields" style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; display: none;">
                                    <div>
                                        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Đại diện pháp luật:</label>
                                        <input type="text" name="legalRepresentative"
                                               style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                    </div>
                                    <div>
                                        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Chức vụ người liên hệ:</label>
                                        <input type="text" name="contactPosition"
                                               style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                    </div>
                                </div>

                                <!-- Hàng 4: Điện thoại và Email -->
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                                    <div>
                                        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Số điện thoại: *</label>
                                        <input type="tel" name="phone" required 
                                               style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                    </div>
                                    <div>
                                        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Email:</label>
                                        <input type="email" name="email"
                                               style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                    </div>
                                </div>

                                <!-- Hàng 5: Địa chỉ -->
                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Địa chỉ:</label>
                                    <textarea name="address" rows="2"
                                              style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; resize: vertical;"></textarea>
                                </div>

                                <!-- Thông tin ngân hàng (chỉ doanh nghiệp) -->
                                <div id="bank-info-section" style="display: none;">
                                    <h4 style="margin-bottom: 16px; color: var(--primary-blue); border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">🏦 Thông tin ngân hàng</h4>

                                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                                        <div>
                                            <label style="display: block; margin-bottom: 8px; font-weight: 600;">Số tài khoản:</label>
                                            <input type="text" name="bankAccount"
                                                   style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                        </div>
                                        <div>
                                            <label style="display: block; margin-bottom: 8px; font-weight: 600;">Tên ngân hàng:</label>
                                            <input type="text" name="bankName"
                                                   style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                        </div>
                                    </div>

                                    <div style="margin-bottom: 16px;">
                                        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Chi nhánh:</label>
                                        <input type="text" name="bankBranch"
                                               style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                    </div>
                                </div>

                                <!-- Ghi chú -->
                                <div style="margin-bottom: 24px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Ghi chú nhà cung cấp:</label>
                                    <textarea name="notes" rows="3" placeholder="Nhập ghi chú về nhà cung cấp (không bắt buộc)"
                                              style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; resize: vertical;"></textarea>
                                </div>

                                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                                    <button type="button" onclick="closeModal(this.closest('div[style*=fixed]'))" 
                                            style="padding: 12px 24px; border: 2px solid #e5e7eb; background: white; border-radius: 8px; cursor: pointer;">Hủy</button>
                                    <button type="submit" 
                                            style="padding: 12px 24px; background: var(--primary-blue); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">Thêm nhà cung cấp</button>
                                </div>
                            </form>
                        </div>
                    </div>
                `;
                document.body.insertAdjacentHTML('beforeend', formHTML);
            }

            toggleSupplierFields(supplierType) {
                const codeField = document.getElementById('supplier-code-field');
                const taxField = document.getElementById('supplier-tax-field');
                const legalFields = document.getElementById('legal-info-fields');
                const bankSection = document.getElementById('bank-info-section');
                const codeInput = document.querySelector('input[name="supplierCode"]');

                if (supplierType === 'doanh-nghiep') {
                    codeField.style.display = 'block';
                    taxField.style.display = 'block';
                    legalFields.style.display = 'grid';
                    bankSection.style.display = 'block';
                    if (codeInput) codeInput.required = true;
                } else {
                    codeField.style.display = 'none';
                    taxField.style.display = 'none';
                    legalFields.style.display = 'none';
                    bankSection.style.display = 'none';
                    if (codeInput) {
                        codeInput.required = false;
                        codeInput.value = '';
                    }
                    // Clear business fields
                    const fieldsToReset = ['taxCode', 'legalRepresentative', 'contactPosition', 'bankAccount', 'bankName', 'bankBranch'];
                    fieldsToReset.forEach(field => {
                        const input = document.querySelector(`input[name="${field}"]`);
                        if (input) input.value = '';
                    });
                }
            }

            addSupplier(event) {
                event.preventDefault();
                const form = event.target;
                const formData = new FormData(form);

                const newSupplier = {
                    id: 'NCC' + String(this.demoData.suppliers.length + 1).padStart(3, '0'),
                    name: formData.get('name'),
                    type: formData.get('type'),
                    supplierCode: formData.get('supplierCode') || '',
                    phone: formData.get('phone'),
                    email: formData.get('email') || '',
                    address: formData.get('address') || '',
                    taxCode: formData.get('taxCode') || '',
                    legalRepresentative: formData.get('legalRepresentative') || '',
                    contactPosition: formData.get('contactPosition') || '',
                    bankAccount: formData.get('bankAccount') || '',
                    bankName: formData.get('bankName') || '',
                    bankBranch: formData.get('bankBranch') || '',
                    notes: formData.get('notes') || '',
                    products: 'Chưa có sản phẩm'
                };

                this.demoData.suppliers.push(newSupplier);
                this.saveToLocalStorage();
                this.showNotification(`Đã thêm nhà cung cấp ${newSupplier.name}`, 'success');
                this.loadPage('suppliers');
                const modal = form.closest("div[style*=\"fixed\"]"); if(modal) modal.remove();
            }

            editSupplier(index) {
                const supplier = this.demoData.suppliers[index];
                const supplierType = supplier.type || 'ca-nhan';

                const codeDisplay = supplierType === 'doanh-nghiep' ? 'block' : 'none';
                const taxDisplay = supplierType === 'doanh-nghiep' ? 'block' : 'none';
                const legalDisplay = supplierType === 'doanh-nghiep' ? 'grid' : 'none';
                const bankDisplay = supplierType === 'doanh-nghiep' ? 'block' : 'none';

                const formHTML = `
                    <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1001; display: flex; justify-content: center; align-items: center;" onclick="closeModal(this)">
                        <div style="background: white; padding: 32px; border-radius: 12px; width: 700px; max-width: 95vw; max-height: 90vh; overflow-y: auto;" onclick="event.stopPropagation()">
                            <h3 style="margin-bottom: 24px; color: var(--text-primary);">✏️ Sửa thông tin nhà cung cấp</h3>
                            <form onsubmit="app.updateSupplier(event, ${index})">
                                <!-- Hàng 1: Tên NCC và Loại NCC -->
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                                    <div>
                                        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Tên nhà cung cấp: *</label>
                                        <input type="text" name="name" value="${supplier.name}" required 
                                               style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                    </div>
                                    <div>
                                        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Loại nhà cung cấp: *</label>
                                        <select name="type" required onchange="app.toggleEditSupplierFields(this.value)"
                                               style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                            <option value="ca-nhan" ${supplierType === 'ca-nhan' ? 'selected' : ''}>Cá nhân</option>
                                            <option value="doanh-nghiep" ${supplierType === 'doanh-nghiep' ? 'selected' : ''}>Doanh nghiệp</option>
                                        </select>
                                    </div>
                                </div>

                                <!-- Hàng 2: Mã NCC và Mã số thuế -->
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                                    <div id="edit-supplier-code-field" style="display: ${codeDisplay};">
                                        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Mã nhà cung cấp: *</label>
                                        <input type="text" name="supplierCode" value="${supplier.supplierCode || ''}"
                                               style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                    </div>
                                    <div id="edit-supplier-tax-field" style="display: ${taxDisplay};">
                                        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Mã số thuế:</label>
                                        <input type="text" name="taxCode" value="${supplier.taxCode || ''}"
                                               style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                    </div>
                                </div>

                                <!-- Hàng 3: Đại diện pháp luật và Chức vụ -->
                                <div id="edit-legal-info-fields" style="display: ${legalDisplay}; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                                    <div>
                                        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Đại diện pháp luật:</label>
                                        <input type="text" name="legalRepresentative" value="${supplier.legalRepresentative || ''}"
                                               style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                    </div>
                                    <div>
                                        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Chức vụ người liên hệ:</label>
                                        <input type="text" name="contactPosition" value="${supplier.contactPosition || ''}"
                                               style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                    </div>
                                </div>

                                <!-- Hàng 4: Điện thoại và Email -->
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                                    <div>
                                        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Số điện thoại: *</label>
                                        <input type="tel" name="phone" value="${supplier.phone}" required 
                                               style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                    </div>
                                    <div>
                                        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Email:</label>
                                        <input type="email" name="email" value="${supplier.email || ''}"
                                               style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                    </div>
                                </div>

                                <!-- Hàng 5: Địa chỉ -->
                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Địa chỉ:</label>
                                    <textarea name="address" rows="2"
                                              style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; resize: vertical;">${supplier.address || ''}</textarea>
                                </div>

                                <!-- Thông tin ngân hàng -->
                                <div id="edit-bank-info-section" style="display: ${bankDisplay};">
                                    <h4 style="margin-bottom: 16px; color: var(--primary-blue); border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">🏦 Thông tin ngân hàng</h4>

                                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                                        <div>
                                            <label style="display: block; margin-bottom: 8px; font-weight: 600;">Số tài khoản:</label>
                                            <input type="text" name="bankAccount" value="${supplier.bankAccount || ''}"
                                                   style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                        </div>
                                        <div>
                                            <label style="display: block; margin-bottom: 8px; font-weight: 600;">Tên ngân hàng:</label>
                                            <input type="text" name="bankName" value="${supplier.bankName || ''}"
                                                   style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                        </div>
                                    </div>

                                    <div style="margin-bottom: 16px;">
                                        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Chi nhánh:</label>
                                        <input type="text" name="bankBranch" value="${supplier.bankBranch || ''}"
                                               style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                    </div>
                                </div>

                                <!-- Ghi chú -->
                                <div style="margin-bottom: 24px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Ghi chú nhà cung cấp:</label>
                                    <textarea name="notes" rows="3" placeholder="Nhập ghi chú về nhà cung cấp (không bắt buộc)"
                                              style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; resize: vertical;">${supplier.notes || ''}</textarea>
                                </div>

                                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                                    <button type="button" onclick="closeModal(this.closest('div[style*=fixed]'))" 
                                            style="padding: 12px 24px; border: 2px solid #e5e7eb; background: white; border-radius: 8px; cursor: pointer;">Hủy</button>
                                    <button type="submit" 
                                            style="padding: 12px 24px; background: var(--primary-blue); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">Cập nhật</button>
                                </div>
                            </form>
                        </div>
                    </div>
                `;
                document.body.insertAdjacentHTML('beforeend', formHTML);
            }

            toggleEditSupplierFields(supplierType) {
                const codeField = document.getElementById('edit-supplier-code-field');
                const taxField = document.getElementById('edit-supplier-tax-field');
                const legalFields = document.getElementById('edit-legal-info-fields');
                const bankSection = document.getElementById('edit-bank-info-section');
                const codeInput = document.querySelector('input[name="supplierCode"]');

                if (supplierType === 'doanh-nghiep') {
                    codeField.style.display = 'block';
                    taxField.style.display = 'block';
                    legalFields.style.display = 'grid';
                    bankSection.style.display = 'block';
                    if (codeInput) codeInput.required = true;
                } else {
                    codeField.style.display = 'none';
                    taxField.style.display = 'none';
                    legalFields.style.display = 'none';
                    bankSection.style.display = 'none';
                    if (codeInput) {
                        codeInput.required = false;
                        codeInput.value = '';
                    }
                    // Clear business fields
                    const fieldsToReset = ['taxCode', 'legalRepresentative', 'contactPosition', 'bankAccount', 'bankName', 'bankBranch'];
                    fieldsToReset.forEach(field => {
                        const input = document.querySelector(`input[name="${field}"]`);
                        if (input) input.value = '';
                    });
                }
            }

            updateSupplier(event, index) {
                event.preventDefault();
                const form = event.target;
                const formData = new FormData(form);

                this.demoData.suppliers[index] = {
                    ...this.demoData.suppliers[index],
                    name: formData.get('name'),
                    type: formData.get('type'),
                    supplierCode: formData.get('supplierCode') || '',
                    phone: formData.get('phone'),
                    email: formData.get('email') || '',
                    address: formData.get('address') || '',
                    taxCode: formData.get('taxCode') || '',
                    legalRepresentative: formData.get('legalRepresentative') || '',
                    contactPosition: formData.get('contactPosition') || '',
                    bankAccount: formData.get('bankAccount') || '',
                    bankName: formData.get('bankName') || '',
                    bankBranch: formData.get('bankBranch') || '',
                    notes: formData.get('notes') || ''
                };

                this.saveToLocalStorage();
                this.showNotification(`Đã cập nhật nhà cung cấp ${this.demoData.suppliers[index].name}`, 'success');
                this.loadPage('suppliers');
                const modal = form.closest("div[style*=\"fixed\"]"); if(modal) modal.remove();
            }

            showSupplierSearch() {
                this.showNotification('Tìm kiếm nhà cung cấp theo tên hoặc sản phẩm', 'info');
            }

            toggleAllPurchaseSelection(checked) {
                document.querySelectorAll('.purchase-bulk-checkbox').forEach(checkbox => {
                    checkbox.checked = checked;
                });
            }

            getSelectedPurchaseIds() {
                return Array.from(document.querySelectorAll('.purchase-bulk-checkbox:checked'))
                    .map(checkbox => checkbox.value)
                    .filter(Boolean);
            }

            showBulkUpdatePurchasesForm() {
                const selectedIds = this.getSelectedPurchaseIds();
                if (selectedIds.length === 0) {
                    this.showNotification('Vui lòng chọn ít nhất một đơn mua/sản phẩm để cập nhật', 'warning');
                    return;
                }

                const formHTML = `
                    <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1001; display: flex; justify-content: center; align-items: center; padding: 16px;" onclick="closeModal(this)">
                        <div style="background: white; padding: 28px; border-radius: 12px; width: 620px; max-width: 96vw;" onclick="event.stopPropagation()">
                            <h3 style="margin-bottom: 18px; color: var(--text-primary);">Cập nhật trạng thái đã chọn (${selectedIds.length})</h3>
                            <form onsubmit="app.bulkUpdateSelectedPurchases(event)">
                                <input type="hidden" name="purchaseIds" value="${selectedIds.join(',')}">
                                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                                    <div>
                                        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Trạng thái đơn</label>
                                        <select name="status" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                            <option value="__keep__">Giữ nguyên</option>
                                            <option value="Đang chờ">Đang chờ</option>
                                            <option value="Đã nhận hàng">Đã nhận hàng</option>
                                            <option value="Hủy">Hủy</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Thanh toán</label>
                                        <select name="paymentStatus" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                            <option value="__keep__">Giữ nguyên</option>
                                            <option value="Chưa thanh toán">Chưa thanh toán</option>
                                            <option value="Đã thanh toán">Đã thanh toán</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Nhập kho</label>
                                        <select name="stockStatus" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                            <option value="__keep__">Giữ nguyên</option>
                                            <option value="Chưa nhập kho">Chưa nhập kho</option>
                                            <option value="Đã nhập kho">Đã nhập kho</option>
                                        </select>
                                    </div>
                                </div>

                                <div style="margin-bottom: 18px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Ghi chú chung</label>
                                    <textarea name="notes" placeholder="Nếu nhập, ghi chú này sẽ áp dụng cho các đơn đã chọn" style="width: 100%; min-height: 76px; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;"></textarea>
                                </div>

                                <div style="background: #ecfdf5; border: 1px solid #10b981; color: #065f46; border-radius: 8px; padding: 12px; margin-bottom: 20px; font-size: 14px;">
                                    Chọn “Đã nhập kho” sẽ chỉ nhập kho các đơn chưa nhập. Chọn “Chưa nhập kho” sẽ thu hồi nhập kho của các đơn đã nhập.
                                </div>

                                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                                    <button type="button" onclick="closeModal(this.closest('div[style*=fixed]'))" style="padding: 12px 24px; border: 2px solid #e5e7eb; background: white; border-radius: 8px; cursor: pointer;">Hủy</button>
                                    <button type="submit" style="padding: 12px 24px; background: #0f766e; color: white; border: none; border-radius: 8px; cursor: pointer;">Cập nhật 1 lần</button>
                                </div>
                            </form>
                        </div>
                    </div>
                `;
                document.body.insertAdjacentHTML('beforeend', formHTML);
            }

            bulkUpdateSelectedPurchases(event) {
                event.preventDefault();
                const form = event.target;
                const formData = new FormData(form);
                const selectedIds = String(formData.get('purchaseIds') || '').split(',').filter(Boolean);
                if (selectedIds.length === 0) {
                    this.showNotification('Không có đơn mua nào được chọn', 'warning');
                    return;
                }

                const targetStatus = formData.get('status');
                const targetPaymentStatus = formData.get('paymentStatus');
                const targetStockStatus = formData.get('stockStatus');
                const notes = (formData.get('notes') || '').trim();
                const selectedPurchases = selectedIds
                    .map(id => (this.demoData.purchases || []).find(purchase => purchase.id === id))
                    .filter(Boolean);

                const rollbackTargets = selectedPurchases.filter(purchase =>
                    targetStockStatus === 'Chưa nhập kho' && this.hasPurchaseStockImport(purchase)
                );
                if (rollbackTargets.length > 0 && !confirm(`Thu hồi nhập kho cho ${rollbackTargets.length} đơn mua đã chọn?`)) {
                    return;
                }

                let updatedCount = 0;
                let importedItems = 0;
                let rolledBackCount = 0;

                selectedPurchases.forEach(purchase => {
                    const newStatus = targetStatus === '__keep__' ? purchase.status : targetStatus;
                    const newPaymentStatus = targetPaymentStatus === '__keep__' ? purchase.paymentStatus : targetPaymentStatus;
                    const newStockStatus = targetStockStatus === '__keep__' ? this.getPurchaseStockStatus(purchase) : targetStockStatus;

                    if (this.hasPurchaseStockImport(purchase) && newStockStatus !== 'Đã nhập kho') {
                        this.rollbackPurchaseOrderEffects(purchase, { removePurchase: false });
                        rolledBackCount++;
                    }

                    if (newStatus && newStatus !== '__keep__') purchase.status = newStatus;
                    if (newPaymentStatus && newPaymentStatus !== '__keep__') purchase.paymentStatus = newPaymentStatus;
                    if (notes) purchase.notes = notes;

                    if (newStockStatus === 'Đã nhập kho') {
                        const result = this.applyPurchaseStockImport(purchase, 'bulk-update');
                        importedItems += result.importedItems;
                        purchase.status = newStatus === 'Hủy' ? 'Hủy' : 'Đã nhận hàng';
                    } else if (newStockStatus === 'Chưa nhập kho') {
                        purchase.stockStatus = 'Chưa nhập kho';
                        purchase.stockImported = false;
                    }

                    if (this.hasPurchaseStockImport(purchase)) {
                        this.recordPurchaseExpense(purchase, purchase.supplierName || purchase.supplier, 'bulk-update');
                    }
                    updatedCount++;
                });

                this.saveToLocalStorage();
                this.showNotification(`Đã cập nhật ${updatedCount} đơn mua đã chọn${importedItems > 0 ? `, nhập kho ${importedItems} dòng hàng` : ''}${rolledBackCount > 0 ? `, thu hồi ${rolledBackCount} đơn` : ''}`, 'success');
                this.loadPage('purchases');
                const modal = form.closest("div[style*=\"fixed\"]"); if (modal) modal.remove();
            }

            showUpdatePurchaseForm(purchaseId) {
                const purchase = (this.demoData.purchases || []).find(item => item.id === purchaseId);
                if (!purchase) {
                    this.showNotification('Không tìm thấy đơn mua cần cập nhật', 'error');
                    return;
                }

                const stockStatus = this.getPurchaseStockStatus(purchase);
                const productRows = (purchase.products || []).map(item => `
                    <tr>
                        <td style="padding: 8px; border: 1px solid #e5e7eb;">${item.productId || item.id || item.productCode || ''}</td>
                        <td style="padding: 8px; border: 1px solid #e5e7eb;">${item.name || item.productName || ''}</td>
                        <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;">${Number(item.quantity || 0).toLocaleString('vi-VN')}</td>
                        <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;">${Number(item.price || 0).toLocaleString('vi-VN')}</td>
                    </tr>
                `).join('');

                const formHTML = `
                    <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1001; display: flex; justify-content: center; align-items: center; padding: 16px;" onclick="closeModal(this)">
                        <div style="background: white; padding: 28px; border-radius: 12px; width: 680px; max-width: 96vw; max-height: 92vh; overflow-y: auto;" onclick="event.stopPropagation()">
                            <h3 style="margin-bottom: 20px; color: var(--text-primary);">Cập nhật đơn mua ${purchase.id}</h3>
                            <form onsubmit="app.updatePurchaseOrder(event, '${purchase.id}')">
                                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                                    <div>
                                        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Trạng thái đơn</label>
                                        <select name="status" required style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                            <option value="Đang chờ" ${purchase.status === 'Đang chờ' ? 'selected' : ''}>Đang chờ</option>
                                            <option value="Đã nhận hàng" ${purchase.status === 'Đã nhận hàng' ? 'selected' : ''}>Đã nhận hàng</option>
                                            <option value="Hủy" ${purchase.status === 'Hủy' ? 'selected' : ''}>Hủy</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Thanh toán</label>
                                        <select name="paymentStatus" required style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                            <option value="Chưa thanh toán" ${purchase.paymentStatus !== 'Đã thanh toán' ? 'selected' : ''}>Chưa thanh toán</option>
                                            <option value="Đã thanh toán" ${purchase.paymentStatus === 'Đã thanh toán' ? 'selected' : ''}>Đã thanh toán</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Nhập kho</label>
                                        <select name="stockStatus" required style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                            <option value="Chưa nhập kho" ${stockStatus !== 'Đã nhập kho' ? 'selected' : ''}>Chưa nhập kho</option>
                                            <option value="Đã nhập kho" ${stockStatus === 'Đã nhập kho' ? 'selected' : ''}>Đã nhập kho</option>
                                        </select>
                                    </div>
                                </div>

                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Ghi chú</label>
                                    <textarea name="notes" style="width: 100%; min-height: 72px; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">${purchase.notes || ''}</textarea>
                                </div>

                                <div style="margin-bottom: 18px; overflow-x: auto;">
                                    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                                        <thead>
                                            <tr style="background: #f3f4f6;">
                                                <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Mã SP</th>
                                                <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Sản phẩm</th>
                                                <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;">SL</th>
                                                <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;">Giá nhập</th>
                                            </tr>
                                        </thead>
                                        <tbody>${productRows || '<tr><td colspan="4" style="padding: 16px; text-align: center; color: #6b7280;">Chưa có sản phẩm</td></tr>'}</tbody>
                                    </table>
                                </div>

                                <div style="background: #fef3c7; border: 1px solid #f59e0b; color: #92400e; border-radius: 8px; padding: 12px; margin-bottom: 20px; font-size: 14px;">
                                    Chuyển sang “Đã nhập kho” sẽ cộng tồn kho và ghi chi phí mua hàng nếu đơn chưa nhập kho. Chuyển ngược về “Chưa nhập kho” sẽ thu hồi tồn kho, lưu lượng kho và chi phí mua hàng của đơn này.
                                </div>

                                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                                    <button type="button" onclick="closeModal(this.closest('div[style*=fixed]'))" style="padding: 12px 24px; border: 2px solid #e5e7eb; background: white; border-radius: 8px; cursor: pointer;">Hủy</button>
                                    <button type="submit" style="padding: 12px 24px; background: var(--primary-blue); color: white; border: none; border-radius: 8px; cursor: pointer;">Cập nhật</button>
                                </div>
                            </form>
                        </div>
                    </div>
                `;
                document.body.insertAdjacentHTML('beforeend', formHTML);
            }

            updatePurchaseOrder(event, purchaseId) {
                event.preventDefault();
                const form = event.target;
                const formData = new FormData(form);
                const purchase = (this.demoData.purchases || []).find(item => item.id === purchaseId);
                if (!purchase) {
                    this.showNotification('Không tìm thấy đơn mua cần cập nhật', 'error');
                    return;
                }

                const oldStockImported = this.hasPurchaseStockImport(purchase);
                const newStatus = formData.get('status') || purchase.status || 'Đang chờ';
                const newPaymentStatus = formData.get('paymentStatus') || purchase.paymentStatus || 'Chưa thanh toán';
                const newStockStatus = formData.get('stockStatus') || this.getPurchaseStockStatus(purchase);

                if (oldStockImported && newStockStatus !== 'Đã nhập kho') {
                    if (!confirm(`Thu hồi nhập kho của đơn ${purchase.id}? Tồn kho, lưu lượng kho và chi phí mua hàng liên quan sẽ được hoàn lại.`)) {
                        return;
                    }
                    this.rollbackPurchaseOrderEffects(purchase, { removePurchase: false });
                }

                purchase.status = newStatus;
                purchase.paymentStatus = newPaymentStatus;
                purchase.notes = (formData.get('notes') || '').trim();

                let importResult = { importedItems: 0, createdProducts: 0 };
                if (newStockStatus === 'Đã nhập kho') {
                    importResult = this.applyPurchaseStockImport(purchase, 'update');
                    purchase.status = newStatus === 'Hủy' ? 'Hủy' : 'Đã nhận hàng';
                } else {
                    purchase.stockStatus = 'Chưa nhập kho';
                    purchase.stockImported = false;
                }

                if (this.hasPurchaseStockImport(purchase)) {
                    this.recordPurchaseExpense(purchase, purchase.supplierName || purchase.supplier, 'update');
                }

                this.saveToLocalStorage();
                const details = importResult.importedItems > 0 ? `, đã nhập kho ${importResult.importedItems} dòng hàng` : '';
                this.showNotification(`Đã cập nhật đơn mua ${purchase.id}${details}`, 'success');
                this.loadPage('purchases');
                const modal = form.closest("div[style*=\"fixed\"]"); if (modal) modal.remove();
            }

            showCreatePurchaseForm() {
                const supplierOptions = this.demoData.suppliers.map(s => 
                    `<option value="${s.id}">${s.name}</option>`
                ).join('');

                const formHTML = `
                    <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1001; display: flex; justify-content: center; align-items: center;" onclick="closeModal(this)">
                        <div style="background: white; padding: 32px; border-radius: 12px; width: 500px; max-width: 90vw;" onclick="event.stopPropagation()">
                            <h3 style="margin-bottom: 24px; color: var(--text-primary);">Tạo đơn mua hàng</h3>
                            <form onsubmit="app.createPurchaseOrder(event)">
                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Nhà cung cấp:</label>
                                    <select name="supplier" required style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                        <option value="">Chọn nhà cung cấp</option>
                                        ${supplierOptions}
                                    </select>
                                </div>
                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Tên sản phẩm:</label>
                                    <input type="text" name="productName" required style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                </div>
                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Số lượng:</label>
                                    <input type="number" name="quantity" required min="1" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                </div>
                                <div style="margin-bottom: 24px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Giá mua:</label>
                                    <input type="number" name="price" required style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                </div>
                                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                                    <button type="button" onclick="closeModal(this.closest('div[style*=fixed]'))" 
                                            style="padding: 12px 24px; border: 2px solid #e5e7eb; background: white; border-radius: 8px; cursor: pointer;">Hủy</button>
                                    <button type="submit" 
                                            style="padding: 12px 24px; background: var(--primary-blue); color: white; border: none; border-radius: 8px; cursor: pointer;">Tạo đơn mua</button>
                                </div>
                            </form>
                        </div>
                    </div>
                `;
                document.body.insertAdjacentHTML('beforeend', formHTML);
            }

            createPurchaseOrder(event) {
                event.preventDefault();
                const form = event.target;
                const formData = new FormData(form);

                const supplier = this.demoData.suppliers.find(s => s.id === formData.get('supplier'));
                const productName = formData.get('productName');
                const quantity = parseInt(formData.get('quantity'));
                const price = parseInt(formData.get('price'));

                // Check if product exists, if not create new one
                let product = this.demoData.products.find(p => p.name.toLowerCase() === productName.toLowerCase());
                const oldStock = product ? product.stock : 0;
                if (!product) {
                    product = {
                        id: 'SP' + String(this.demoData.products.length + 1).padStart(3, '0'),
                        name: productName,
                        category: 'Nhập mới',
                        price: price,
                        stock: quantity,
                        supplier: supplier.name,
                        purchasedQty: quantity,
                        soldQty: 0
                    };
                    this.demoData.products.push(product);
                } else {
                    product.stock += quantity;
                    product.purchasedQty = (product.purchasedQty || 0) + quantity;
                }

                const purchaseId = 'PH' + String(this.demoData.purchases.length + 1).padStart(3, '0');
                const today = this.formatDateInputValue(this.getVietnamTime());
                this.demoData.purchases.push({
                    id: purchaseId,
                    supplierId: supplier.id,
                    supplierName: supplier.name,
                    date: today,
                    time: this.getVietnamTime().toLocaleTimeString('vi-VN', { hour12: false }),
                    products: [{ name: productName, quantity, price }],
                    total: quantity * price,
                    status: 'Đã nhận hàng',
                    paymentStatus: 'Chưa thanh toán',
                    createdAt: new Date().toISOString()
                });

                this.addInventoryHistory({
                    type: 'purchase',
                    productId: product.id,
                    productName: product.name,
                    quantity: quantity,
                    oldStock: oldStock,
                    newStock: product.stock,
                    date: today,
                    time: this.formatTimeNow(),
                    reason: `Nhập hàng từ ${supplier.name}`,
                    supplierId: supplier.id,
                    supplierName: supplier.name,
                    notes: `Đơn mua ${purchaseId}`
                });

                this.saveToLocalStorage();
                this.showNotification(`Đã tạo đơn mua hàng từ ${supplier.name}`, 'success');
                const modal = form.closest("div[style*=\"fixed\"]"); if(modal) modal.remove();
            }

            // Purchase order flow that receives stock immediately.
            getNextRecordCode(prefix, records) {
                const maxNumber = (records || []).reduce((max, record) => {
                    const value = String(record?.id || '');
                    if (!value.startsWith(prefix)) return max;
                    const number = parseInt(value.slice(prefix.length), 10);
                    return Number.isFinite(number) ? Math.max(max, number) : max;
                }, 0);
                return prefix + String(maxNumber + 1).padStart(3, '0');
            }

            togglePurchaseProductFields(select) {
                const modal = select.closest('div[style*="fixed"]');
                const newProductFields = modal?.querySelector('[data-purchase-new-product-fields]');
                const priceInput = modal?.querySelector('input[name="price"]');
                const salePriceInput = modal?.querySelector('input[name="salePrice"]');
                const isNewProduct = select.value === '__new__';

                if (newProductFields) {
                    newProductFields.style.display = isNewProduct ? 'block' : 'none';
                    newProductFields.querySelectorAll('input, select').forEach(input => {
                        input.required = isNewProduct && input.dataset.required === 'true';
                    });
                }

                if (!isNewProduct) {
                    const product = this.demoData.products.find(p => p.id === select.value);
                    if (product && priceInput) {
                        priceInput.value = product.importPrice || '';
                    }
                    if (product && salePriceInput) {
                        salePriceInput.value = product.price || product.importPrice || '';
                    }
                } else {
                    if (priceInput) priceInput.value = '';
                    if (salePriceInput) salePriceInput.value = '';
                }
            }

            parsePurchaseNumber(value) {
                const digits = String(value || '').replace(/[^\d-]/g, '');
                const number = parseInt(digits, 10);
                return Number.isFinite(number) ? number : 0;
            }

            normalizePurchasePaymentStatus(value) {
                const normalized = String(value || '')
                    .trim()
                    .toLowerCase()
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '');

                if (normalized.includes('da thanh toan') || normalized === 'paid' || normalized === '1' || normalized === 'yes') {
                    return 'Đã thanh toán';
                }
                return 'Chưa thanh toán';
            }

            normalizePurchaseDate(value) {
                const raw = String(value || '').trim();
                if (!raw) return this.formatDateInputValue(this.getVietnamTime());
                if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);

                const yearFirstMatch = raw.match(/^(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})/);
                if (yearFirstMatch) {
                    const year = yearFirstMatch[1];
                    const month = yearFirstMatch[2].padStart(2, '0');
                    const day = yearFirstMatch[3].padStart(2, '0');
                    return `${year}-${month}-${day}`;
                }

                const match = raw.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
                if (match) {
                    const day = match[1].padStart(2, '0');
                    const month = match[2].padStart(2, '0');
                    const year = match[3].length === 2 ? `20${match[3]}` : match[3];
                    return `${year}-${month}-${day}`;
                }

                if (/^\d{4,6}(\.\d+)?$/.test(raw)) {
                    const serial = Math.floor(Number(raw));
                    const date = new Date(Date.UTC(1899, 11, 30 + serial));
                    const year = date.getUTCFullYear();
                    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
                    const day = String(date.getUTCDate()).padStart(2, '0');
                    return `${year}-${month}-${day}`;
                }

                return raw;
            }

            findOrCreatePurchaseSupplier(supplierCode, supplierName) {
                const cleanCode = String(supplierCode || '').trim();
                const cleanName = String(supplierName || '').trim();
                let supplier = null;

                if (cleanCode) {
                    supplier = this.demoData.suppliers.find(s => s.id === cleanCode);
                }
                if (!supplier && cleanName) {
                    supplier = this.demoData.suppliers.find(s => s.name.toLowerCase() === cleanName.toLowerCase());
                }
                if (supplier) return supplier;
                if (!cleanCode && !cleanName) return null;

                supplier = {
                    id: cleanCode || this.getNextRecordCode('NCC', this.demoData.suppliers),
                    name: cleanName || cleanCode,
                    type: 'doanh-nghiep',
                    phone: '',
                    email: '',
                    address: '',
                    products: '',
                    notes: 'Tạo từ upload đơn mua'
                };
                this.demoData.suppliers.push(supplier);
                return supplier;
            }

            findOrCreatePurchaseProduct(item, supplier, purchaseId = null) {
                const productCode = String(item.productCode || '').trim();
                const productName = String(item.productName || '').trim();
                let product = null;

                if (productCode) {
                    product = this.demoData.products.find(p => p.id === productCode);
                }
                if (!product && productName) {
                    product = this.demoData.products.find(p => p.name.toLowerCase() === productName.toLowerCase());
                }
                if (!product && !productName) return null;

                if (!product) {
                    product = {
                        id: productCode || this.getNextRecordCode('SP', this.demoData.products),
                        name: productName,
                        category: item.category || 'Nhập mới',
                        importPrice: item.importPrice,
                        price: item.salePrice > 0 ? item.salePrice : item.importPrice,
                        stock: 0,
                        minStock: 10,
                        supplier: supplier.id,
                        purchasedQty: 0,
                        soldQty: 0,
                        createdFromPurchaseId: purchaseId
                    };
                    this.demoData.products.push(product);
                    return { product, createdProduct: true };
                }

                product.importPrice = item.importPrice;
                product.supplier = supplier.id;
                if (item.category && (!product.category || product.category === 'Nhập mới')) {
                    product.category = item.category;
                }
                if (item.salePrice > 0) {
                    product.price = item.salePrice;
                }
                if (typeof product.purchasedQty === 'undefined') product.purchasedQty = 0;
                if (typeof product.soldQty === 'undefined') product.soldQty = 0;
                return { product, createdProduct: false };
            }

            recordPurchaseExpense(purchase, supplierName, source = 'manual') {
                const amount = Number(purchase?.total) || 0;
                if (amount <= 0) return null;

                const category = 'Chi phí mua hàng';
                if (!Array.isArray(this.demoData.expenses)) this.demoData.expenses = [];
                if (!Array.isArray(this.demoData.expenseCategories)) this.demoData.expenseCategories = this.getDefaultExpenseCategories();
                if (!this.demoData.expenseCategories.includes(category)) {
                    this.demoData.expenseCategories.push(category);
                }

                const existingIndex = this.demoData.expenses.findIndex(expense =>
                    expense.category === category && (expense.referenceCode === purchase.id || expense.purchaseId === purchase.id)
                );

                const expense = {
                    id: existingIndex >= 0 ? this.demoData.expenses[existingIndex].id : `CPMH${Date.now()}_${purchase.id}`,
                    date: purchase.date || this.formatDateInputValue(this.getVietnamTime()),
                    category,
                    amount,
                    paymentMethod: purchase.paymentStatus === 'Đã thanh toán' ? 'Tiền mặt' : 'Công nợ',
                    payee: supplierName || purchase.supplierName || '',
                    notes: `Ghi nhận chi phí mua hàng từ đơn ${purchase.id}${purchase.notes ? ` - ${purchase.notes}` : ''}`,
                    referenceCode: purchase.id,
                    purchaseId: purchase.id,
                    source,
                    createdAt: this.getVietnamTime().toISOString()
                };

                if (existingIndex >= 0) {
                    this.demoData.expenses[existingIndex] = expense;
                } else {
                    this.demoData.expenses.unshift(expense);
                }
                return expense;
            }

            getPurchaseItemProduct(item) {
                const itemProductId = item.productId || item.id || item.productCode;
                if (itemProductId) {
                    const byId = this.demoData.products.find(product => product.id === itemProductId);
                    if (byId) return byId;
                }

                const itemName = String(item.name || item.productName || '').trim().toLowerCase();
                if (!itemName) return null;
                return this.demoData.products.find(product => String(product.name || '').trim().toLowerCase() === itemName) || null;
            }

            getPurchaseStockStatus(purchase) {
                if (purchase.stockStatus) return purchase.stockStatus;
                if (purchase.stockImported === true || purchase.inventoryStatus === 'Đã nhập kho') return 'Đã nhập kho';

                const hasInventoryHistory = (this.demoData.inventoryHistory || []).some(entry => {
                    const linkedByReference = entry.referenceCode === purchase.id || entry.purchaseId === purchase.id;
                    const linkedByNotes = entry.type === 'purchase' && String(entry.notes || '').includes(purchase.id);
                    return linkedByReference || linkedByNotes;
                });
                return hasInventoryHistory ? 'Đã nhập kho' : 'Chưa nhập kho';
            }

            hasPurchaseStockImport(purchase) {
                return this.getPurchaseStockStatus(purchase) === 'Đã nhập kho';
            }

            applyPurchaseStockImport(purchase, source = 'update') {
                if (!purchase) return { importedItems: 0, createdProducts: 0 };

                if (this.hasPurchaseStockImport(purchase)) {
                    purchase.stockStatus = 'Đã nhập kho';
                    purchase.stockImported = true;
                    if (purchase.status !== 'Hủy') purchase.status = purchase.status || 'Đã nhận hàng';
                    this.recordPurchaseExpense(purchase, purchase.supplierName || purchase.supplier, source);
                    return { importedItems: 0, createdProducts: 0 };
                }

                let importedItems = 0;
                let createdProducts = 0;
                purchase.products = Array.isArray(purchase.products) ? purchase.products : [];

                purchase.products.forEach(item => {
                    const quantity = Number(item.quantity) || 0;
                    if (quantity <= 0) return;

                    let product = this.getPurchaseItemProduct(item);
                    let createdProduct = false;
                    const itemName = String(item.name || item.productName || '').trim();
                    const itemPrice = Number(item.price) || 0;

                    if (!product) {
                        product = {
                            id: item.productId || item.id || item.productCode || this.getNextRecordCode('SP', this.demoData.products),
                            name: itemName || `Sản phẩm ${purchase.id}`,
                            category: item.category || 'Nhập mới',
                            importPrice: itemPrice,
                            price: Number(item.salePrice) || itemPrice,
                            stock: 0,
                            minStock: 10,
                            supplier: purchase.supplierId || '',
                            purchasedQty: 0,
                            soldQty: 0,
                            createdFromPurchaseId: purchase.id
                        };
                        this.demoData.products.push(product);
                        createdProduct = true;
                        createdProducts++;
                    }

                    const oldStock = Number(product.stock) || 0;
                    if (typeof item.previousStock === 'undefined') item.previousStock = oldStock;
                    if (typeof item.previousImportPrice === 'undefined') item.previousImportPrice = product.importPrice;
                    if (typeof item.previousSupplier === 'undefined') item.previousSupplier = product.supplier;
                    if (typeof item.previousPurchasedQty === 'undefined') item.previousPurchasedQty = Number(product.purchasedQty) || 0;

                    product.stock = oldStock + quantity;
                    product.importPrice = itemPrice || product.importPrice || 0;
                    product.supplier = purchase.supplierId || product.supplier || '';
                    product.purchasedQty = (Number(product.purchasedQty) || 0) + quantity;
                    if (typeof product.soldQty === 'undefined') product.soldQty = 0;

                    item.productId = product.id;
                    item.id = product.id;
                    item.productCode = product.id;
                    item.name = product.name;
                    item.price = itemPrice || product.importPrice || 0;
                    item.total = quantity * (Number(item.price) || 0);
                    item.createdProduct = item.createdProduct || createdProduct;

                    this.addInventoryHistory({
                        type: 'purchase',
                        productId: product.id,
                        productCode: product.id,
                        productName: product.name,
                        quantity,
                        oldStock,
                        newStock: product.stock,
                        date: purchase.date || this.formatDateInputValue(this.getVietnamTime()),
                        time: this.formatTimeNow(),
                        reason: `Nhập hàng từ ${purchase.supplierName || purchase.supplier || 'nhà cung cấp'}`,
                        referenceCode: purchase.id,
                        supplierId: purchase.supplierId || '',
                        supplierName: purchase.supplierName || purchase.supplier || '',
                        notes: purchase.notes || ''
                    });
                    importedItems++;
                });

                purchase.total = purchase.products.reduce((sum, item) => sum + ((Number(item.quantity) || 0) * (Number(item.price) || 0)), 0);
                purchase.status = 'Đã nhận hàng';
                purchase.stockStatus = 'Đã nhập kho';
                purchase.stockImported = true;
                this.recordPurchaseExpense(purchase, purchase.supplierName || purchase.supplier, source);

                return { importedItems, createdProducts };
            }

            getPurchaseRollbackWarnings(purchase) {
                return (purchase.products || []).reduce((warnings, item) => {
                    const product = this.getPurchaseItemProduct(item);
                    const quantity = Number(item.quantity) || 0;
                    if (!product) {
                        warnings.push(`Không tìm thấy sản phẩm ${item.name || item.productName || item.productId || item.id || ''}`);
                        return warnings;
                    }

                    const currentStock = Number(product.stock) || 0;
                    if (quantity > currentStock) {
                        warnings.push(`${product.name}: tồn hiện tại ${currentStock}, cần thu hồi ${quantity}`);
                    }
                    return warnings;
                }, []);
            }

            isProductUsedOutsidePurchase(product, purchaseId) {
                const matchesProduct = item =>
                    item?.productId === product.id ||
                    item?.id === product.id ||
                    item?.productCode === product.id ||
                    String(item?.name || item?.productName || '').trim().toLowerCase() === String(product.name || '').trim().toLowerCase();

                const usedInOtherPurchase = (this.demoData.purchases || []).some(purchase =>
                    purchase.id !== purchaseId && (purchase.products || []).some(matchesProduct)
                );
                if (usedInOtherPurchase) return true;

                const usedInOrders = (this.demoData.orders || []).some(order =>
                    (order.products || []).some(matchesProduct)
                );
                if (usedInOrders) return true;

                return (this.demoData.inventoryHistory || []).some(entry => {
                    const sameProduct =
                        entry.productId === product.id ||
                        entry.productCode === product.id ||
                        String(entry.productName || '').trim().toLowerCase() === String(product.name || '').trim().toLowerCase();
                    return sameProduct && entry.referenceCode !== purchaseId;
                });
            }

            rollbackPurchaseOrderEffects(purchase, options = {}) {
                if (!purchase) return { success: false, message: 'Không tìm thấy đơn mua' };

                const purchaseId = purchase.id;
                const productRollback = [];
                const removableProductIds = new Set();

                (purchase.products || []).forEach(item => {
                    const product = this.getPurchaseItemProduct(item);
                    const quantity = Number(item.quantity) || 0;
                    if (!product || quantity <= 0) return;

                    const oldStock = Number(product.stock) || 0;
                    product.stock = oldStock - quantity;
                    const currentPurchasedQty = Number(product.purchasedQty) || 0;
                    const previousPurchasedQty = Number(item.previousPurchasedQty);
                    const expectedPurchasedQty = Number.isFinite(previousPurchasedQty) ? previousPurchasedQty + quantity : null;
                    product.purchasedQty = expectedPurchasedQty !== null && currentPurchasedQty === expectedPurchasedQty
                        ? previousPurchasedQty
                        : Math.max(0, currentPurchasedQty - quantity);

                    if (item.previousImportPrice !== undefined && item.previousImportPrice !== null && (Number(product.importPrice) || 0) === (Number(item.price) || 0)) {
                        product.importPrice = item.previousImportPrice;
                    }
                    if (item.previousSupplier !== undefined && item.previousSupplier !== null && product.supplier === purchase.supplierId) {
                        product.supplier = item.previousSupplier;
                    }

                    productRollback.push({
                        name: product.name,
                        quantity,
                        oldStock,
                        newStock: product.stock
                    });

                    if (item.createdProduct || product.createdFromPurchaseId === purchaseId) {
                        removableProductIds.add(product.id);
                    }
                });

                const historyBefore = (this.demoData.inventoryHistory || []).length;
                this.demoData.inventoryHistory = (this.demoData.inventoryHistory || []).filter(entry => {
                    const linkedByReference = entry.referenceCode === purchaseId || entry.purchaseId === purchaseId;
                    const linkedByNotes = entry.type === 'purchase' && String(entry.notes || '').includes(purchaseId);
                    return !(linkedByReference || linkedByNotes);
                });
                const removedHistoryCount = historyBefore - this.demoData.inventoryHistory.length;

                const expensesBefore = (this.demoData.expenses || []).length;
                this.demoData.expenses = (this.demoData.expenses || []).filter(expense => {
                    const linkedByReference = expense.referenceCode === purchaseId || expense.purchaseId === purchaseId;
                    const linkedByNotes = expense.category === 'Chi phí mua hàng' && String(expense.notes || '').includes(purchaseId);
                    return !(linkedByReference || linkedByNotes);
                });
                const removedExpenseCount = expensesBefore - this.demoData.expenses.length;

                let removedProductCount = 0;
                removableProductIds.forEach(productId => {
                    const product = this.demoData.products.find(item => item.id === productId);
                    if (!product) return;

                    if ((Number(product.stock) || 0) <= 0 && (Number(product.soldQty) || 0) === 0 && !this.isProductUsedOutsidePurchase(product, purchaseId)) {
                        this.demoData.products = this.demoData.products.filter(item => item.id !== productId);
                        removedProductCount++;
                    }
                });

                if (options.removePurchase !== false) {
                    this.demoData.purchases = (this.demoData.purchases || []).filter(item => item.id !== purchaseId);
                } else {
                    purchase.stockStatus = 'Chưa nhập kho';
                    purchase.stockImported = false;
                }

                return {
                    success: true,
                    productRollback,
                    removedHistoryCount,
                    removedExpenseCount,
                    removedProductCount
                };
            }

            deletePurchaseOrder(purchaseId) {
                const purchase = (this.demoData.purchases || []).find(item => item.id === purchaseId);
                if (!purchase) {
                    this.showNotification('Không tìm thấy đơn mua cần xóa', 'error');
                    return;
                }

                const warnings = this.getPurchaseRollbackWarnings(purchase);
                let message = `Xóa đơn mua ${purchase.id} và thu hồi tồn kho, lưu lượng tồn kho, chi phí mua hàng liên quan?`;
                if (warnings.length > 0) {
                    message += `\n\nCảnh báo tồn kho:\n${warnings.join('\n')}\n\nTiếp tục có thể làm tồn kho âm để phản ánh việc thu hồi đơn mua.`;
                }
                if (!confirm(message)) return;

                const result = this.rollbackPurchaseOrderEffects(purchase, { removePurchase: true });
                if (!result.success) {
                    this.showNotification(result.message || 'Không thể thu hồi đơn mua', 'error');
                    return;
                }

                this.saveToLocalStorage();
                this.showNotification(
                    `Đã xóa ${purchase.id}: thu hồi ${result.productRollback.length} sản phẩm, xóa ${result.removedHistoryCount} dòng lưu lượng kho, xóa ${result.removedExpenseCount} chi phí mua hàng`,
                    'success'
                );
                this.loadPage('purchases');
            }

            deleteAllPurchases() {
                if (!confirm('Bạn có chắc chắn muốn xóa tất cả đơn mua hàng?')) return;

                const warnings = (this.demoData.purchases || []).flatMap(purchase =>
                    this.getPurchaseRollbackWarnings(purchase).map(warning => `${purchase.id}: ${warning}`)
                );
                let confirmMessage = 'XÁC NHẬN: Xóa tất cả đơn mua sẽ thu hồi tồn kho, lưu lượng tồn kho và chi phí mua hàng liên quan. Hành động này không thể hoàn tác.';
                if (warnings.length > 0) {
                    confirmMessage += `\n\nCảnh báo tồn kho:\n${warnings.slice(0, 10).join('\n')}`;
                    if (warnings.length > 10) confirmMessage += `\n... và ${warnings.length - 10} cảnh báo khác`;
                }
                if (!confirm(confirmMessage)) return;

                const purchases = [...(this.demoData.purchases || [])];
                const totals = purchases.reduce((summary, purchase) => {
                    const result = this.rollbackPurchaseOrderEffects(purchase, { removePurchase: true });
                    if (result.success) {
                        summary.products += result.productRollback.length;
                        summary.history += result.removedHistoryCount;
                        summary.expenses += result.removedExpenseCount;
                    }
                    return summary;
                }, { products: 0, history: 0, expenses: 0 });

                this.saveToLocalStorage();
                this.showNotification(`Đã xóa tất cả đơn mua và thu hồi ${totals.products} sản phẩm, ${totals.history} dòng lưu lượng kho, ${totals.expenses} chi phí mua hàng`, 'success');
                this.loadPage('purchases');
            }

            showCreatePurchaseForm() {
                const supplierOptions = this.demoData.suppliers.map(s =>
                    `<option value="${s.id}">${s.name}</option>`
                ).join('');

                const productOptions = this.demoData.products.map(p =>
                    `<option value="${p.id}">${p.id} - ${p.name} (Tồn: ${p.stock || 0}, giá nhập: ${(p.importPrice || 0).toLocaleString('vi-VN')} VNĐ)</option>`
                ).join('');

                const today = this.formatDateInputValue(this.getVietnamTime());
                const categoryOptions = this.getCategoryOptions ? this.getCategoryOptions() : '<option value="Nhập mới">Nhập mới</option>';

                const formHTML = `
                    <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1001; display: flex; justify-content: center; align-items: center; padding: 16px;" onclick="closeModal(this)">
                        <div style="background: white; padding: 28px; border-radius: 12px; width: 720px; max-width: 96vw; max-height: 92vh; overflow-y: auto;" onclick="event.stopPropagation()">
                            <h3 style="margin-bottom: 20px; color: var(--text-primary);">Tạo đơn mua và nhập kho</h3>
                            <form onsubmit="app.createPurchaseOrder(event)">
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                                    <div>
                                        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Nhà cung cấp:</label>
                                        <select name="supplier" required style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                            <option value="">Chọn nhà cung cấp</option>
                                            ${supplierOptions}
                                        </select>
                                    </div>
                                    <div>
                                        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Ngày mua:</label>
                                        <input type="date" name="date" value="${today}" required style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                    </div>
                                </div>

                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Sản phẩm:</label>
                                    <select name="productId" required onchange="app.togglePurchaseProductFields(this)" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                        <option value="">Chọn sản phẩm</option>
                                        ${productOptions}
                                        <option value="__new__">+ Tạo sản phẩm mới</option>
                                    </select>
                                </div>

                                <div data-purchase-new-product-fields style="display: none; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                                    <div style="margin-bottom: 16px;">
                                        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Tên sản phẩm mới:</label>
                                        <input type="text" name="newProductName" data-required="true" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                    </div>
                                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                                        <div>
                                            <label style="display: block; margin-bottom: 8px; font-weight: 600;">Danh mục:</label>
                                            <select name="category" data-required="true" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                                ${categoryOptions}
                                            </select>
                                        </div>
                                        <div>
                                            <label style="display: block; margin-bottom: 8px; font-weight: 600;">Tồn tối thiểu:</label>
                                            <input type="number" name="minStock" value="10" min="0" data-required="true" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                        </div>
                                    </div>
                                </div>

                                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                                    <div>
                                        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Số lượng nhập:</label>
                                        <input type="number" name="quantity" required min="1" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                    </div>
                                    <div>
                                        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Giá nhập:</label>
                                        <input type="number" name="price" required min="0" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                    </div>
                                    <div>
                                        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Giá bán:</label>
                                        <input type="number" name="salePrice" min="0" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                    </div>
                                </div>

                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
                                    <div>
                                        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Thanh toán:</label>
                                        <select name="paymentStatus" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                            <option value="Chưa thanh toán">Chưa thanh toán</option>
                                            <option value="Đã thanh toán">Đã thanh toán</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Ghi chú:</label>
                                        <input type="text" name="notes" placeholder="Số hóa đơn, ghi chú nhập hàng..." style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                    </div>
                                </div>

                                <div style="background: #ecfdf5; border: 1px solid #10b981; color: #065f46; border-radius: 8px; padding: 12px; margin-bottom: 20px; font-size: 14px;">
                                    Đơn mua sẽ được ghi nhận là đã nhận hàng và tăng tồn kho ngay sau khi tạo.
                                </div>

                                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                                    <button type="button" onclick="closeModal(this.closest('div[style*=fixed]'))"
                                            style="padding: 12px 24px; border: 2px solid #e5e7eb; background: white; border-radius: 8px; cursor: pointer;">Hủy</button>
                                    <button type="submit"
                                            style="padding: 12px 24px; background: var(--primary-blue); color: white; border: none; border-radius: 8px; cursor: pointer;">Tạo đơn mua</button>
                                </div>
                            </form>
                        </div>
                    </div>
                `;
                document.body.insertAdjacentHTML('beforeend', formHTML);
            }

            createPurchaseOrder(event) {
                event.preventDefault();
                const form = event.target;
                const formData = new FormData(form);
                const createdAt = new Date().toISOString();

                const supplier = this.demoData.suppliers.find(s => s.id === formData.get('supplier'));
                const selectedProductId = formData.get('productId');
                const quantity = parseInt(formData.get('quantity'), 10);
                const importPrice = parseInt(formData.get('price'), 10);
                const salePrice = parseInt(formData.get('salePrice'), 10);
                const purchaseDate = formData.get('date') || this.formatDateInputValue(this.getVietnamTime());
                const paymentStatus = formData.get('paymentStatus') || 'Chưa thanh toán';
                const notes = formData.get('notes') || '';

                if (!supplier) {
                    this.showNotification('Vui lòng chọn nhà cung cấp', 'error');
                    return;
                }
                if (!Number.isFinite(quantity) || quantity <= 0) {
                    this.showNotification('Số lượng nhập không hợp lệ', 'error');
                    return;
                }
                if (!Number.isFinite(importPrice) || importPrice < 0) {
                    this.showNotification('Giá nhập không hợp lệ', 'error');
                    return;
                }

                let product = null;
                let createdNewProduct = false;

                if (selectedProductId === '__new__') {
                    const newProductName = String(formData.get('newProductName') || '').trim();
                    if (!newProductName) {
                        this.showNotification('Vui lòng nhập tên sản phẩm mới', 'error');
                        return;
                    }

                    product = this.demoData.products.find(p => p.name.toLowerCase() === newProductName.toLowerCase());
                    if (!product) {
                        product = {
                            id: this.getNextRecordCode('SP', this.demoData.products),
                            name: newProductName,
                            category: formData.get('category') || 'Nhập mới',
                            importPrice,
                            price: Number.isFinite(salePrice) && salePrice > 0 ? salePrice : importPrice,
                            stock: 0,
                            minStock: parseInt(formData.get('minStock'), 10) || 10,
                            supplier: supplier.id,
                            purchasedQty: 0,
                            soldQty: 0
                        };
                        this.demoData.products.push(product);
                        createdNewProduct = true;
                    }
                } else {
                    product = this.demoData.products.find(p => p.id === selectedProductId);
                }

                if (!product) {
                    this.showNotification('Không tìm thấy sản phẩm để nhập kho', 'error');
                    return;
                }

                const oldStock = Number(product.stock) || 0;
                const previousImportPrice = createdNewProduct ? null : product.importPrice;
                const previousSupplier = createdNewProduct ? null : product.supplier;
                const previousPurchasedQty = createdNewProduct ? 0 : (Number(product.purchasedQty) || 0);
                product.stock = oldStock + quantity;
                product.importPrice = importPrice;
                product.supplier = supplier.id;
                product.purchasedQty = (Number(product.purchasedQty) || 0) + quantity;
                if (Number.isFinite(salePrice) && salePrice > 0 && createdNewProduct) {
                    product.price = salePrice;
                }
                if (typeof product.soldQty === 'undefined') {
                    product.soldQty = 0;
                }

                const purchaseId = this.getNextRecordCode('PH', this.demoData.purchases);
                const total = quantity * importPrice;
                if (createdNewProduct) {
                    product.createdFromPurchaseId = purchaseId;
                }
                const purchase = {
                    id: purchaseId,
                    supplierId: supplier.id,
                    supplierName: supplier.name,
                    date: purchaseDate,
                    time: this.getVietnamTime().toLocaleTimeString('vi-VN', { hour12: false }),
                    products: [{
                        productId: product.id,
                        id: product.id,
                        name: product.name,
                        quantity,
                        price: importPrice,
                        total,
                        createdProduct: createdNewProduct,
                        previousStock: oldStock,
                        previousImportPrice,
                        previousSupplier,
                        previousPurchasedQty
                    }],
                    total,
                    status: 'Đã nhận hàng',
                    paymentStatus,
                    notes,
                    stockStatus: 'Đã nhập kho',
                    stockImported: true,
                    createdAt
                };
                this.demoData.purchases.push(purchase);

                this.addInventoryHistory({
                    type: 'purchase',
                    productId: product.id,
                    productCode: product.id,
                    productName: product.name,
                    quantity,
                    oldStock,
                    newStock: product.stock,
                    date: purchaseDate,
                    time: this.formatTimeNow(),
                    reason: `Nhập hàng từ ${supplier.name}`,
                    referenceCode: purchaseId,
                    supplierId: supplier.id,
                    supplierName: supplier.name,
                    notes
                });

                this.recordPurchaseExpense(purchase, supplier.name, 'manual');
                this.saveToLocalStorage();
                this.showNotification(`Đã tạo đơn mua ${purchaseId} và nhập ${quantity} ${product.name}. Tồn kho mới: ${product.stock}`, 'success');
                this.loadPage('purchases');
                const modal = form.closest("div[style*=\"fixed\"]"); if (modal) modal.remove();
            }

            showUploadPurchasesForm() {
                const formHTML = `
                    <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1001; display: flex; justify-content: center; align-items: center; padding: 16px;" onclick="closeModal(this)">
                        <div style="background: white; padding: 32px; border-radius: 12px; width: 760px; max-width: 96vw; max-height: 92vh; overflow-y: auto;" onclick="event.stopPropagation()">
                            <h3 style="margin-bottom: 24px; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
                                <span>📤</span> Upload file Excel đơn mua
                            </h3>

                            <div style="background: #f0f9ff; padding: 16px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #0ea5e9;">
                                <h4 style="margin: 0 0 8px 0; color: #0c4a6e;">📋 Định dạng file CSV xuất từ Excel:</h4>
                                <p style="margin: 0; font-size: 14px; line-height: 1.5;">
                                    File có các cột theo thứ tự:<br>
                                    <strong>Mã PH | Ngày | Mã NCC | Tên NCC | Mã SP | Tên sản phẩm | Danh mục | Giá bán | Giá nhập | Số lượng | Thanh toán | Ghi chú</strong>
                                </p>
                                <p style="margin: 8px 0 0 0; font-size: 13px; color: #475569;">
                                    Các dòng cùng Mã PH sẽ được gom vào một đơn mua nhiều sản phẩm. Nếu bỏ trống Mã PH, hệ thống tự tạo một đơn cho từng dòng.
                                </p>
                            </div>

                            <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin-bottom: 20px; overflow-x: auto;">
                                <h4 style="margin: 0 0 8px 0; color: #374151;">💡 Ví dụ:</h4>
                                <table style="width: 100%; min-width: 720px; border-collapse: collapse; font-size: 12px;">
                                    <thead>
                                        <tr style="background: #e5e7eb;">
                                            <th style="padding: 4px; border: 1px solid #d1d5db;">Mã PH</th>
                                            <th style="padding: 4px; border: 1px solid #d1d5db;">Ngày</th>
                                            <th style="padding: 4px; border: 1px solid #d1d5db;">Mã NCC</th>
                                            <th style="padding: 4px; border: 1px solid #d1d5db;">Tên NCC</th>
                                            <th style="padding: 4px; border: 1px solid #d1d5db;">Mã SP</th>
                                            <th style="padding: 4px; border: 1px solid #d1d5db;">Tên sản phẩm</th>
                                            <th style="padding: 4px; border: 1px solid #d1d5db;">Danh mục</th>
                                            <th style="padding: 4px; border: 1px solid #d1d5db;">Giá bán</th>
                                            <th style="padding: 4px; border: 1px solid #d1d5db;">Giá nhập</th>
                                            <th style="padding: 4px; border: 1px solid #d1d5db;">Số lượng</th>
                                            <th style="padding: 4px; border: 1px solid #d1d5db;">Thanh toán</th>
                                            <th style="padding: 4px; border: 1px solid #d1d5db;">Ghi chú</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td style="padding: 4px; border: 1px solid #d1d5db;">PH101</td>
                                            <td style="padding: 4px; border: 1px solid #d1d5db;">2026-05-25</td>
                                            <td style="padding: 4px; border: 1px solid #d1d5db;">NCC001</td>
                                            <td style="padding: 4px; border: 1px solid #d1d5db;">Nhà cung cấp A</td>
                                            <td style="padding: 4px; border: 1px solid #d1d5db;">SP001</td>
                                            <td style="padding: 4px; border: 1px solid #d1d5db;">Áo thun</td>
                                            <td style="padding: 4px; border: 1px solid #d1d5db;">Thời trang</td>
                                            <td style="padding: 4px; border: 1px solid #d1d5db;">150000</td>
                                            <td style="padding: 4px; border: 1px solid #d1d5db;">100000</td>
                                            <td style="padding: 4px; border: 1px solid #d1d5db;">20</td>
                                            <td style="padding: 4px; border: 1px solid #d1d5db;">Đã thanh toán</td>
                                            <td style="padding: 4px; border: 1px solid #d1d5db;">Nhập lô đầu</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            <form onsubmit="app.uploadPurchasesFromExcel(event)">
                                <div style="margin-bottom: 20px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Chọn file Excel/CSV: *</label>
                                    <input type="file" name="excelFile" accept=".csv,.xlsx,.xls" required
                                           style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                    <p style="margin: 4px 0 0 0; font-size: 12px; color: #6b7280;">Khuyến nghị dùng file .csv xuất từ Excel để hệ thống đọc chính xác.</p>
                                </div>

                                <div style="background: #ecfdf5; border: 1px solid #10b981; color: #065f46; border-radius: 8px; padding: 12px; margin-bottom: 20px; font-size: 14px;">
                                    Trình tự xử lý: tạo đơn mua → nhập hàng → điều chỉnh tồn kho → ghi nhận chi phí mua hàng.
                                </div>

                                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                                    <button type="button" onclick="closeModal(this.closest('div[style*=fixed]'))"
                                            style="padding: 12px 24px; border: 2px solid #e5e7eb; background: white; border-radius: 8px; cursor: pointer;">Hủy</button>
                                    <button type="submit"
                                            style="padding: 12px 24px; background: var(--primary-blue); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">Upload Excel</button>
                                </div>
                            </form>
                        </div>
                    </div>
                `;
                document.body.insertAdjacentHTML('beforeend', formHTML);
            }

            uploadPurchasesFromExcel(event) {
                event.preventDefault();
                const form = event.target;
                const fileInput = form.querySelector('input[type="file"]');

                if (!fileInput.files[0]) {
                    this.showNotification('Vui lòng chọn file Excel/CSV đơn mua', 'error');
                    return;
                }

                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        let csvData = e.target.result;
                        if (csvData.charCodeAt(0) === 0xFEFF) {
                            csvData = csvData.slice(1);
                        }

                        const lines = csvData.split('\n').filter(line => line.trim());
                        if (lines.length < 2) {
                            this.showNotification('File phải có ít nhất 1 dòng tiêu đề và 1 dòng dữ liệu', 'error');
                            return;
                        }

                        const groups = new Map();
                        const errorLines = [];

                        lines.slice(1).forEach((line, index) => {
                            const columns = this.parseCSVLine(line);
                            if (columns.length < 10) {
                                errorLines.push(`Dòng ${index + 2}: Không đủ cột dữ liệu`);
                                return;
                            }

                            const [
                                rawPurchaseId,
                                rawDate,
                                supplierCode,
                                supplierName,
                                productCode,
                                productName,
                                category,
                                salePrice,
                                importPrice,
                                quantity,
                                paymentStatus,
                                notes
                            ] = columns;

                            const cleanProductName = String(productName || '').trim();
                            const cleanProductCode = String(productCode || '').trim();
                            const parsedQuantity = this.parsePurchaseNumber(quantity);
                            const parsedImportPrice = this.parsePurchaseNumber(importPrice);
                            const parsedSalePrice = this.parsePurchaseNumber(salePrice);

                            if (!cleanProductCode && !cleanProductName) {
                                errorLines.push(`Dòng ${index + 2}: Thiếu mã hoặc tên sản phẩm`);
                                return;
                            }
                            if (parsedQuantity <= 0) {
                                errorLines.push(`Dòng ${index + 2}: Số lượng phải lớn hơn 0`);
                                return;
                            }
                            if (parsedImportPrice <= 0) {
                                errorLines.push(`Dòng ${index + 2}: Giá nhập phải lớn hơn 0`);
                                return;
                            }

                            const explicitPurchaseId = String(rawPurchaseId || '').trim();
                            const groupKey = explicitPurchaseId || `__row_${index}`;
                            if (!groups.has(groupKey)) {
                                groups.set(groupKey, {
                                    explicitPurchaseId,
                                    date: this.normalizePurchaseDate(rawDate),
                                    supplierCode: String(supplierCode || '').trim(),
                                    supplierName: String(supplierName || '').trim(),
                                    paymentStatus: this.normalizePurchasePaymentStatus(paymentStatus),
                                    notes: String(notes || '').trim(),
                                    items: []
                                });
                            }

                            groups.get(groupKey).items.push({
                                productCode: cleanProductCode,
                                productName: cleanProductName,
                                category: String(category || '').trim() || 'Nhập mới',
                                salePrice: parsedSalePrice,
                                importPrice: parsedImportPrice,
                                quantity: parsedQuantity
                            });
                        });

                        let purchaseCount = 0;
                        let itemCount = 0;
                        let skippedCount = 0;
                        const suppliersBefore = this.demoData.suppliers.length;
                        const productsBefore = this.demoData.products.length;

                        groups.forEach(group => {
                            const purchaseId = group.explicitPurchaseId || this.getNextRecordCode('PH', this.demoData.purchases);
                            if (this.demoData.purchases.some(purchase => purchase.id === purchaseId)) {
                                skippedCount++;
                                errorLines.push(`Đơn ${purchaseId}: Đã tồn tại nên bỏ qua`);
                                return;
                            }

                            const supplier = this.findOrCreatePurchaseSupplier(group.supplierCode, group.supplierName);
                            if (!supplier) {
                                skippedCount++;
                                errorLines.push(`Đơn ${purchaseId}: Thiếu nhà cung cấp`);
                                return;
                            }

                            const purchase = {
                                id: purchaseId,
                                supplierId: supplier.id,
                                supplierName: supplier.name,
                                date: group.date,
                                time: this.getVietnamTime().toLocaleTimeString('vi-VN', { hour12: false }),
                                products: [],
                                total: 0,
                                status: 'Đang chờ',
                                paymentStatus: group.paymentStatus,
                                notes: group.notes,
                                stockStatus: 'Chưa nhập kho',
                                stockImported: false,
                                createdAt: new Date().toISOString()
                            };

                            this.demoData.purchases.push(purchase);

                            group.items.forEach(item => {
                                const productResult = this.findOrCreatePurchaseProduct(item, supplier, purchaseId);
                                const product = productResult?.product;
                                if (!product) {
                                    errorLines.push(`Đơn ${purchaseId}: Không tạo được sản phẩm ${item.productName || item.productCode}`);
                                    return;
                                }

                                const oldStock = Number(product.stock) || 0;
                                const previousImportPrice = productResult.createdProduct ? null : product.importPrice;
                                const previousSupplier = productResult.createdProduct ? null : product.supplier;
                                const previousPurchasedQty = productResult.createdProduct ? 0 : (Number(product.purchasedQty) || 0);
                                product.stock = oldStock + item.quantity;
                                product.purchasedQty = (Number(product.purchasedQty) || 0) + item.quantity;
                                product.importPrice = item.importPrice;
                                product.supplier = supplier.id;

                                const lineTotal = item.quantity * item.importPrice;
                                purchase.products.push({
                                    productId: product.id,
                                    id: product.id,
                                    name: product.name,
                                    quantity: item.quantity,
                                    price: item.importPrice,
                                    total: lineTotal,
                                    createdProduct: !!productResult.createdProduct,
                                    previousStock: oldStock,
                                    previousImportPrice,
                                    previousSupplier,
                                    previousPurchasedQty
                                });
                                purchase.total += lineTotal;

                                this.addInventoryHistory({
                                    type: 'purchase',
                                    productId: product.id,
                                    productCode: product.id,
                                    productName: product.name,
                                    quantity: item.quantity,
                                    oldStock,
                                    newStock: product.stock,
                                    date: group.date,
                                    time: this.formatTimeNow(),
                                    reason: `Nhập hàng từ ${supplier.name}`,
                                    referenceCode: purchaseId,
                                    supplierId: supplier.id,
                                    supplierName: supplier.name,
                                    notes: group.notes
                                });
                                itemCount++;
                            });

                            if (purchase.products.length === 0) {
                                this.demoData.purchases = this.demoData.purchases.filter(item => item.id !== purchaseId);
                                skippedCount++;
                                return;
                            }

                            purchase.status = 'Đã nhận hàng';
                            purchase.stockStatus = 'Đã nhập kho';
                            purchase.stockImported = true;
                            this.recordPurchaseExpense(purchase, supplier.name, 'upload');
                            purchaseCount++;
                        });

                        if (purchaseCount > 0 || itemCount > 0) {
                            this.saveToLocalStorage();
                            localStorage.removeItem('erp_vietnam_empty_mode');
                            this.loadPage('purchases');
                        }

                        const createdSuppliers = this.demoData.suppliers.length - suppliersBefore;
                        const createdProducts = this.demoData.products.length - productsBefore;
                        let message = `Upload hoàn tất: ${purchaseCount} đơn mua, ${itemCount} dòng nhập hàng`;
                        if (createdProducts > 0) message += `, tạo ${createdProducts} sản phẩm mới`;
                        if (createdSuppliers > 0) message += `, tạo ${createdSuppliers} nhà cung cấp mới`;
                        if (skippedCount > 0) message += `, bỏ qua ${skippedCount} đơn`;
                        if (errorLines.length > 0) {
                            message += `\n\nChi tiết:\n${errorLines.slice(0, 8).join('\n')}`;
                        }

                        this.showNotification(message, purchaseCount > 0 ? 'success' : 'warning');
                        const modal = form.closest("div[style*=\"fixed\"]");
                        if (modal) modal.remove();
                    } catch (error) {
                        console.error('Lỗi đọc file Excel đơn mua:', error);
                        this.showNotification(`Lỗi đọc file Excel đơn mua: ${error.message}`, 'error');
                    }
                };

                reader.readAsText(fileInput.files[0], 'UTF-8');
            }

            // Categories Management
            getCategoriesContent() {
                // Get categories from demoData
                const categories = this.demoData.categories || [];

                const categoryTree = this.buildCategoryTree(categories);

                return `
                    <div class="fade-in">
                        <div class="stats-grid" style="margin-bottom: 24px;">
                            <div class="stat-card info">
                                <div class="stat-header">
                                    <span class="stat-title">Tổng danh mục</span>
                                    <span class="stat-icon">📂</span>
                                </div>
                                <div class="stat-value">${categories.length}</div>
                                <div class="stat-change positive">Danh mục phân cấp</div>
                            </div>

                            <div class="stat-card success">
                                <div class="stat-header">
                                    <span class="stat-title">Danh mục gốc</span>
                                    <span class="stat-icon">🌳</span>
                                </div>
                                <div class="stat-value">${categories.filter(c => c.parent === null).length}</div>
                                <div class="stat-change positive">Cấp 1</div>
                            </div>
                        </div>

                        <div class="quick-actions">
                            <h2 class="section-title">Quản lý Danh mục</h2>
                            <div class="action-grid" style="margin-bottom: 24px;">
                                <div class="action-button" onclick="app.showAddCategoryForm()">
                                    <div class="action-icon">📂➕</div>
                                    <div class="action-title">Thêm danh mục</div>
                                </div>
                                <div class="action-button" onclick="app.showAddSubCategoryForm()">
                                    <div class="action-icon">📁➕</div>
                                    <div class="action-title">Thêm danh mục con</div>
                                </div>
                                <div class="action-button" onclick="app.exportCategoriesData()">
                                    <div class="action-icon">📊</div>
                                    <div class="action-title">Xuất dữ liệu</div>
                                </div>
                                <div class="action-button" onclick="app.deleteAllCategories()">
                                    <div class="action-icon">🗑️</div>
                                    <div class="action-title">Xóa tất cả</div>
                                </div>
                            </div>

                            <h3 style="margin-bottom: 16px; color: var(--text-primary);">Cấu trúc danh mục</h3>
                            ${this.renderCategoryTree(categoryTree)}
                        </div>
                    </div>
                `;
            }

            buildCategoryTree(categories) {
                const tree = [];
                const categoryMap = {};

                // Create a map for quick lookup
                categories.forEach(cat => {
                    categoryMap[cat.id] = { ...cat, children: [] };
                });

                // Build the tree structure
                categories.forEach(cat => {
                    if (cat.parent === null) {
                        tree.push(categoryMap[cat.id]);
                    } else {
                        if (categoryMap[cat.parent]) {
                            categoryMap[cat.parent].children.push(categoryMap[cat.id]);
                        }
                    }
                });

                return tree;
            }

            renderCategoryTree(tree, level = 0) {
                return tree.map(category => {
                    const indent = '&nbsp;&nbsp;'.repeat(level * 4);
                    const hasChildren = category.children.length > 0;

                    let html = `
                        <div class="activity-item" style="margin-left: ${level * 20}px;">
                            <div class="activity-icon ${level === 0 ? 'success' : 'info'}">${level === 0 ? '📂' : '📁'}</div>
                            <div class="activity-content">
                                <div class="activity-title">${category.name}</div>
                                <div class="activity-desc">ID: ${category.id} | Cấp: ${level + 1} ${hasChildren ? `| ${category.children.length} danh mục con` : ''}</div>
                            </div>
                            <div style="display: flex; gap: 8px;">
                                <button onclick="app.editCategory('${category.id}')" style="padding: 6px 12px; background: var(--primary-blue); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">Sửa</button>
                                <button onclick="app.deleteCategory('${category.id}')" style="padding: 6px 12px; background: #dc2626; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">Xóa</button>
                            </div>
                        </div>
                    `;

                    if (hasChildren) {
                        html += this.renderCategoryTree(category.children, level + 1);
                    }

                    return html;
                }).join('');
            }

            showAddCategoryForm() {
                const formHTML = `
                    <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1001; display: flex; justify-content: center; align-items: center;" onclick="closeModal(this)">
                        <div style="background: white; padding: 32px; border-radius: 12px; width: 500px; max-width: 90vw;" onclick="event.stopPropagation()">
                            <h3 style="margin-bottom: 24px; color: var(--text-primary);">Thêm danh mục mới</h3>
                            <form onsubmit="app.addCategory(event)">
                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Tên danh mục:</label>
                                    <input type="text" name="categoryName" required style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                </div>
                                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                                    <button type="button" onclick="closeModal(this.closest('div[style*=fixed]'))" 
                                            style="padding: 12px 24px; border: 2px solid #e5e7eb; background: white; border-radius: 8px; cursor: pointer;">Hủy</button>
                                    <button type="submit" 
                                            style="padding: 12px 24px; background: var(--primary-blue); color: white; border: none; border-radius: 8px; cursor: pointer;">Thêm danh mục</button>
                                </div>
                            </form>
                        </div>
                    </div>
                `;
                document.body.insertAdjacentHTML('beforeend', formHTML);
            }

            showAddSubCategoryForm() {
                const categories = this.demoData.categories || [];
                const parentCategories = categories.filter(c => c.parent === null);
                const parentOptions = parentCategories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

                const formHTML = `
                    <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1001; display: flex; justify-content: center; align-items: center;" onclick="closeModal(this)">
                        <div style="background: white; padding: 32px; border-radius: 12px; width: 500px; max-width: 90vw;" onclick="event.stopPropagation()">
                            <h3 style="margin-bottom: 24px; color: var(--text-primary);">Thêm danh mục con</h3>
                            <form onsubmit="app.addSubCategory(event)">
                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Danh mục cha:</label>
                                    <select name="parentCategory" required style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                        <option value="">Chọn danh mục cha</option>
                                        ${parentOptions}
                                    </select>
                                </div>
                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Tên danh mục con:</label>
                                    <input type="text" name="categoryName" required style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                </div>
                                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                                    <button type="button" onclick="closeModal(this.closest('div[style*=fixed]'))" 
                                            style="padding: 12px 24px; border: 2px solid #e5e7eb; background: white; border-radius: 8px; cursor: pointer;">Hủy</button>
                                    <button type="submit" 
                                            style="padding: 12px 24px; background: var(--primary-blue); color: white; border: none; border-radius: 8px; cursor: pointer;">Thêm danh mục con</button>
                                </div>
                            </form>
                        </div>
                    </div>
                `;
                document.body.insertAdjacentHTML('beforeend', formHTML);
            }

            addCategory(event) {
                event.preventDefault();
                const form = event.target;
                const formData = new FormData(form);
                const categoryName = formData.get('categoryName');

                const newCategory = {
                    id: 'cat' + Date.now(),
                    name: categoryName,
                    parent: null,
                    level: 0
                };

                this.demoData.categories.push(newCategory);
                this.saveToLocalStorage();

                this.showNotification(`Đã thêm danh mục "${categoryName}"`, 'success');
                this.loadPage('categories');
                const modal = form.closest("div[style*=\"fixed\"]"); if(modal) modal.remove();
            }

            addSubCategory(event) {
                event.preventDefault();
                const form = event.target;
                const formData = new FormData(form);
                const categoryName = formData.get('categoryName');
                const parentId = formData.get('parentCategory');

                const newCategory = {
                    id: 'cat' + Date.now(),
                    name: categoryName,
                    parent: parentId,
                    level: 1
                };

                this.demoData.categories.push(newCategory);
                this.saveToLocalStorage();

                this.showNotification(`Đã thêm danh mục con "${categoryName}"`, 'success');
                this.loadPage('categories');
                const modal = form.closest("div[style*=\"fixed\"]"); if(modal) modal.remove();
            }

            editCategory(categoryId) {
                const category = this.demoData.categories.find(c => c.id === categoryId);

                if (!category) {
                    this.showNotification('Không tìm thấy danh mục', 'error');
                    return;
                }

                const formHTML = `
                    <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1001; display: flex; justify-content: center; align-items: center;" onclick="closeModal(this)">
                        <div style="background: white; padding: 32px; border-radius: 12px; width: 500px; max-width: 90vw;" onclick="event.stopPropagation()">
                            <h3 style="margin-bottom: 24px; color: var(--text-primary);">Sửa danh mục</h3>
                            <form onsubmit="app.updateCategory(event, '${categoryId}')">
                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Tên danh mục:</label>
                                    <input type="text" name="categoryName" value="${category.name}" required style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                </div>
                                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                                    <button type="button" onclick="closeModal(this.closest('div[style*=fixed]'))" 
                                            style="padding: 12px 24px; border: 2px solid #e5e7eb; background: white; border-radius: 8px; cursor: pointer;">Hủy</button>
                                    <button type="submit" 
                                            style="padding: 12px 24px; background: var(--primary-blue); color: white; border: none; border-radius: 8px; cursor: pointer;">Cập nhật</button>
                                </div>
                            </form>
                        </div>
                    </div>
                `;
                document.body.insertAdjacentHTML('beforeend', formHTML);
            }

            updateCategory(event, categoryId) {
                event.preventDefault();
                const form = event.target;
                const formData = new FormData(form);
                const categoryName = formData.get('categoryName');

                const categoryIndex = this.demoData.categories.findIndex(c => c.id === categoryId);

                if (categoryIndex !== -1) {
                    this.demoData.categories[categoryIndex].name = categoryName;
                    this.saveToLocalStorage();

                    this.showNotification(`Đã cập nhật danh mục "${categoryName}"`, 'success');
                    this.loadPage('categories');
                    const modal = form.closest("div[style*=\"fixed\"]"); 
                    if(modal) modal.remove();
                } else {
                    this.showNotification('Không tìm thấy danh mục để cập nhật', 'error');
                }
            }

            deleteCategory(categoryId) {
                if (!confirm('Bạn có chắc chắn muốn xóa danh mục này?')) return;

                const updatedCategories = this.demoData.categories.filter(c => c.id !== categoryId && c.parent !== categoryId);
                this.demoData.categories = updatedCategories;
                this.saveToLocalStorage();

                this.showNotification('Đã xóa danh mục', 'success');
                this.loadPage('categories');
            }

            deleteAllCategories() {
                if (!confirm('Bạn có chắc chắn muốn xóa tất cả danh mục?')) return;
                if (!confirm('XÁC NHẬN: Xóa tất cả danh mục sẽ không thể hoàn tác.')) return;
                
                this.demoData.categories = [];
                this.saveToLocalStorage();
                this.showNotification('Đã xóa tất cả danh mục', 'success');
                this.loadPage('categories');
            }

            getCategoryOptions() {
                const categories = this.demoData.categories || [];

                let options = '<option value="">Chọn danh mục</option>';

                // Group by parent
                const parentCategories = categories.filter(c => c.parent === null);
                const childCategories = categories.filter(c => c.parent !== null);

                parentCategories.forEach(parent => {
                    const children = childCategories.filter(c => c.parent === parent.id);

                    if (children.length > 0) {
                        options += `<optgroup label="${parent.name}">`;
                        options += `<option value="${parent.name}">${parent.name}</option>`;
                        children.forEach(child => {
                            options += `<option value="${parent.name} > ${child.name}">${child.name}</option>`;
                        });
                        options += `</optgroup>`;
                    } else {
                        options += `<option value="${parent.name}">${parent.name}</option>`;
                    }
                });

                return options;
            }

            // Enhanced Export Function with View/Download Options
            showExportOptions(title, dataType, generateFunction) {
                const modal = document.createElement('div');
                modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1001; display: flex; justify-content: center; align-items: center;';
                modal.onclick = () => modal.remove();

                const content = document.createElement('div');
                content.style.cssText = 'background: white; padding: 32px; border-radius: 12px; width: 400px; max-width: 90vw;';
                content.onclick = (e) => e.stopPropagation();

                content.innerHTML = `
                    <h3 style="margin-bottom: 24px; color: var(--text-primary); text-align: center;">${title}</h3>
                    <p style="margin-bottom: 24px; text-align: center; color: #666;">Bạn muốn xem dữ liệu hay tải về file?</p>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                        <button id="viewBtn" style="padding: 16px 24px; background: var(--primary-blue); color: white; border: none; border-radius: 8px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 8px;">
                            <span style="font-size: 24px;">👁️</span>
                            <span>Xem dữ liệu</span>
                        </button>

                        <button id="downloadBtn" style="padding: 16px 24px; background: #16a34a; color: white; border: none; border-radius: 8px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 8px;">
                            <span style="font-size: 24px;">📥</span>
                            <span>Tải về</span>
                        </button>
                    </div>


                `;

                modal.appendChild(content);
                document.body.appendChild(modal);

                // Add event listeners
                content.querySelector('#viewBtn').onclick = () => {
                    this[generateFunction]('view');
                    modal.remove();
                };

                content.querySelector('#downloadBtn').onclick = () => {
                    this[generateFunction]('download');
                    modal.remove();
                };


            }

            // Generic data viewer function
            showDataViewer(title, data, columns) {
                const tableHeaders = columns.map(col => `<th style="padding: 12px; background: var(--primary-blue); color: white; text-align: left; border-bottom: 2px solid #1e40af;">${col.header}</th>`).join('');

                const tableRows = data.map((row, index) => {
                    const cells = columns.map(col => {
                        const value = col.getValue(row, index);
                        return `<td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${value}</td>`;
                    }).join('');
                    return `<tr>${cells}</tr>`;
                }).join('');

                const viewerHTML = `
                    <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1001; display: flex; justify-content: center; align-items: center;" onclick="closeModal(this)">
                        <div style="background: white; padding: 32px; border-radius: 12px; width: 90%; max-width: 1200px; max-height: 90vh; overflow: hidden; display: flex; flex-direction: column;" onclick="event.stopPropagation()">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                                <h3 style="color: var(--text-primary); margin: 0;">${title}</h3>
                            </div>

                            <div style="overflow-y: auto; flex: 1; border: 1px solid #e5e7eb; border-radius: 8px;">
                                <table style="width: 100%; border-collapse: collapse; font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                                    <thead>
                                        <tr>${tableHeaders}</tr>
                                    </thead>
                                    <tbody>
                                        ${tableRows || '<tr><td colspan="' + columns.length + '" style="text-align: center; padding: 24px; color: #666;">Không có dữ liệu</td></tr>'}
                                    </tbody>
                                </table>
                            </div>

                            <div style="margin-top: 16px; padding: 12px; background: #f8fafc; border-radius: 8px; font-size: 14px; color: #666;">
                                <strong>Tổng số bản ghi:</strong> ${data.length}
                            </div>
                        </div>
                    </div>
                `;
                document.body.insertAdjacentHTML('beforeend', viewerHTML);
            }

            // Product Detail Function
            showProductDetail(productId) {
                console.log('Showing product detail for ID:', productId);
                console.log('Available products:', this.demoData.products.map(p => p.id));

                const product = this.demoData.products.find(p => p.id === productId);
                if (!product) {
                    console.error('Product not found:', productId);
                    this.showNotification('Không tìm thấy sản phẩm', 'error');
                    return;
                }

                console.log('Found product:', product);

                const profit = product.importPrice ? product.price - product.importPrice : 0;
                const profitPercent = product.importPrice ? ((profit / product.importPrice) * 100).toFixed(1) : 0;
                const totalValue = product.price * product.stock;
                const totalCost = product.importPrice ? product.importPrice * product.stock : 0;

                const detailHTML = `
                    <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1001; display: flex; justify-content: center; align-items: center;" onclick="closeModal(this)">
                        <div style="background: white; padding: 32px; border-radius: 12px; width: 900px; max-width: 95vw;" onclick="event.stopPropagation()">
                            <h3 style="margin-bottom: 24px; color: var(--text-primary); text-align: center;">Chi tiết sản phẩm</h3>

                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px;">
                                <div style="background: #f8fafc; padding: 16px; border-radius: 8px;">
                                    <h4 style="color: var(--primary-blue); margin-bottom: 8px;">Thông tin cơ bản</h4>
                                    <p><strong>Mã SP:</strong> ${product.id}</p>
                                    <p><strong>Tên:</strong> ${product.name}</p>
                                    <p><strong>Danh mục:</strong> ${product.category}</p>
                                    <p><strong>Nhà cung cấp:</strong> ${product.supplier || 'N/A'}</p>
                                </div>

                                <div style="background: #f0f9ff; padding: 16px; border-radius: 8px;">
                                    <h4 style="color: var(--primary-blue); margin-bottom: 8px;">Tồn kho & Giá</h4>
                                    <p><strong>Số lượng tồn:</strong> <span style="color: ${product.stock <= product.minStock ? '#dc2626' : '#16a34a'}">${product.stock} ${product.stock <= product.minStock ? '⚠️' : '✅'}</span></p>
                                    <p><strong>Tối thiểu:</strong> <span style="color: #6b7280">${product.minStock}</span> ${product.stock <= product.minStock ? '<span style="color: #dc2626; font-size: 12px;">(Dưới ngưỡng!)</span>' : ''}</p>
                                    <p><strong>Giá nhập:</strong> ${product.importPrice?.toLocaleString('vi-VN') || 'N/A'} VNĐ</p>
                                    <p><strong>Giá bán:</strong> ${product.price.toLocaleString('vi-VN')} VNĐ</p>
                                    ${profit > 0 ? `<p><strong>Lợi nhuận/SP:</strong> <span style="color: #16a34a">${profit.toLocaleString('vi-VN')} VNĐ (${profitPercent}%)</span></p>` : ''}
                                </div>
                            </div>

                            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 12px; margin-bottom: 24px;">
                                <h4 style="margin-bottom: 12px; color: white;">Phân tích tài chính</h4>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                                    <div>
                                        <p style="opacity: 0.9;">Tổng giá trị tồn kho</p>
                                        <p style="font-size: 18px; font-weight: bold;">${totalValue.toLocaleString('vi-VN')} VNĐ</p>
                                    </div>
                                    ${totalCost > 0 ? `
                                    <div>
                                        <p style="opacity: 0.9;">Tổng giá vốn</p>
                                        <p style="font-size: 18px; font-weight: bold;">${totalCost.toLocaleString('vi-VN')} VNĐ</p>
                                    </div>` : ''}
                                </div>
                                ${profit > 0 ? `<p style="margin-top: 12px; opacity: 0.9;">💡 Lợi nhuận tiềm năng: <strong>${(totalValue - totalCost).toLocaleString('vi-VN')} VNĐ</strong></p>` : ''}
                            </div>

                            <div style="display: flex; gap: 12px; justify-content: center;">
                                <button onclick="closeModal(this.closest('div[style*=fixed]'))" 
                                        style="padding: 12px 24px; border: 2px solid #e5e7eb; background: white; border-radius: 8px; cursor: pointer;">Đóng</button>
                                <button onclick="app.showEditProductForm('${product.id}');" 
                                        style="padding: 12px 24px; background: var(--primary-blue); color: white; border: none; border-radius: 8px; cursor: pointer;">Chỉnh sửa</button>
                            </div>
                        </div>
                    </div>
                `;
                document.body.insertAdjacentHTML('beforeend', detailHTML);
            }

            // Payment and Debt Management
            showPaymentForm() {
                const customersWithDebt = this.demoData.customers
                    .map(c => ({ ...c, debt: this.getCustomerDebt(c.id) }))
                    .filter(c => c.debt > 0);
                const customerOptions = customersWithDebt.map(c => 
                    `<option value="${c.id}" data-debt="${c.debt}">${c.name} - Nợ: ${c.debt.toLocaleString('vi-VN')} VNĐ</option>`
                ).join('');

                const formHTML = `
                    <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1001; display: flex; justify-content: center; align-items: center;" onclick="closeModal(this)">
                        <div style="background: white; padding: 32px; border-radius: 12px; width: 500px; max-width: 90vw;" onclick="event.stopPropagation()">
                            <h3 style="margin-bottom: 24px; color: var(--text-primary);">Ghi nhận thanh toán</h3>
                            <form onsubmit="app.recordPayment(event)">
                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Khách hàng:</label>
                                    <select name="customer" required style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;" onchange="app.updateDebtAmount(this)">
                                        <option value="">Chọn khách hàng</option>
                                        ${customerOptions}
                                    </select>
                                </div>
                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Số tiền thanh toán:</label>
                                    <input type="number" name="amount" required min="0" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                </div>
                                <div style="margin-bottom: 24px;">
                                    <div id="debt-info" style="padding: 12px; background: #f3f4f6; border-radius: 8px; color: #374151;"></div>
                                </div>
                                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                                    <button type="button" onclick="closeModal(this.closest('div[style*=fixed]'))" 
                                            style="padding: 12px 24px; border: 2px solid #e5e7eb; background: white; border-radius: 8px; cursor: pointer;">Hủy</button>
                                    <button type="submit" 
                                            style="padding: 12px 24px; background: var(--primary-blue); color: white; border: none; border-radius: 8px; cursor: pointer;">Ghi nhận</button>
                                </div>
                            </form>
                        </div>
                    </div>
                `;
                document.body.insertAdjacentHTML('beforeend', formHTML);
            }

            updateDebtAmount(selectElement) {
                const selectedOption = selectElement.options[selectElement.selectedIndex];
                const debt = selectedOption.getAttribute('data-debt') || 0;
                const debtInfo = document.getElementById('debt-info');
                if (debt > 0) {
                    debtInfo.innerHTML = `Tổng nợ hiện tại: <strong>${parseInt(debt).toLocaleString('vi-VN')} VNĐ</strong>`;
                } else {
                    debtInfo.innerHTML = '';
                }
            }

            getCustomerDebt(customerId) {
                return this.demoData.orders
                    .filter(order => order.customerId === customerId && order.paymentStatus !== 'Đã thanh toán')
                    .reduce((sum, order) => sum + this.getOrderRemainingBalance(order), 0);
            }

            recordPayment(event) {
                event.preventDefault();
                const form = event.target;
                const formData = new FormData(form);

                const customerId = formData.get('customer');
                const amount = parseInt(formData.get('amount'));
                const paymentDate = formData.get('paymentDate') || this.getVietnamTime().toISOString().split('T')[0];
                const paymentMethod = formData.get('paymentMethod') || 'Khác';
                const notes = formData.get('notes') || '';

                const customer = this.demoData.customers.find(c => c.id === customerId);
                if (!customer) {
                    this.showNotification('Không tìm thấy khách hàng', 'error');
                    return;
                }

                if (amount <= 0) {
                    this.showNotification('Số tiền thanh toán phải lớn hơn 0', 'warning');
                    return;
                }

                const currentDebt = this.getCustomerDebt(customerId);
                if (amount > currentDebt) {
                    this.showNotification(`Số tiền vượt quá công nợ hiện tại (${currentDebt.toLocaleString('vi-VN')} VNĐ)`, 'error');
                    return;
                }

                let remaining = amount;
                const unpaidOrders = this.demoData.orders
                    .filter(order => order.customerId === customerId && order.paymentStatus !== 'Đã thanh toán')
                    .sort((a, b) => new Date(a.date) - new Date(b.date));

                const paymentHistory = {
                    id: 'PAY' + Date.now(),
                    date: paymentDate,
                    amount: amount,
                    method: paymentMethod,
                    notes: notes,
                    timestamp: this.formatTimeNow(),
                    ordersAffected: [],
                    remainingDebt: currentDebt - amount
                };

                unpaidOrders.forEach(order => {
                    if (remaining <= 0) return;

                    if (!Array.isArray(order.paymentHistory)) order.paymentHistory = [];

                    const outstandingBalance = this.getOrderRemainingBalance(order);
                    if (outstandingBalance <= 0) {
                        order.paymentStatus = 'Đã thanh toán';
                        this.syncOrderPaymentTotals(order);
                        return;
                    }

                    const amountForOrder = Math.min(outstandingBalance, remaining);

                    const paymentReceipt = {
                        id: paymentHistory.id,
                        date: paymentDate,
                        amount: amountForOrder,
                        method: paymentMethod,
                        notes: notes,
                        timestamp: paymentHistory.timestamp
                    };

                    remaining -= amountForOrder;

                    if (paymentReceipt.amount > 0) {
                        order.paymentHistory.push(paymentReceipt);
                        this.syncOrderPaymentTotals(order);
                        order.paymentStatus = order.remainingBalance <= 0 ? 'Đã thanh toán' : 'Thanh toán một phần';
                        paymentHistory.ordersAffected.push({
                            orderId: order.id,
                            amount: paymentReceipt.amount,
                            remainingBalance: order.remainingBalance || 0
                        });
                    }
                });

                const newDebt = this.getCustomerDebt(customerId);
                customer.debt = newDebt;
                paymentHistory.remainingDebt = newDebt;

                if (!customer.paymentHistory) customer.paymentHistory = [];
                customer.paymentHistory.push(paymentHistory);

                this.saveToLocalStorage();
                this.addActivityLog('success', '💳', `Thanh toán từ ${customer.name}`, 
                    `Số tiền: ${amount.toLocaleString('vi-VN')} VNĐ - Ngày: ${paymentDate} - Công nợ còn lại: ${newDebt.toLocaleString('vi-VN')} VNĐ`, 'payment');

                this.showNotification(`✅ Đã ghi nhận thanh toán ${amount.toLocaleString('vi-VN')} VNĐ từ ${customer.name} vào ngày ${paymentDate}. Công nợ mới: ${newDebt.toLocaleString('vi-VN')} VNĐ`, 'success');
                this.loadPage('debts');

                const modal = form.closest("div[style*=\"fixed\"]"); if (modal) modal.remove();
            }

            // Hiển thị form thanh toán với khách hàng được chọn sẵn
            showPaymentFormForCustomer(customerId) {
                const customer = this.demoData.customers.find(c => c.id === customerId);
                if (!customer) {
                    this.showNotification('Không tìm thấy khách hàng', 'error');
                    return;
                }

                const customerDebt = this.getCustomerDebt(customerId);
                if (customerDebt <= 0) {
                    this.showNotification('Khách hàng không có công nợ đang chờ thanh toán', 'info');
                    return;
                }

                // Lấy danh sách đơn hàng chưa thanh toán hết
                const unpaidOrders = this.demoData.orders.filter(order => 
                    order.customerId === customerId && 
                    (order.paymentStatus === 'Công nợ' || order.paymentStatus === 'Thanh toán một phần')
                );

                // Tính toán chi tiết nợ
                let unpaidOrdersHTML = '';
                unpaidOrders.forEach((order, idx) => {
                    const remainingBalance = this.getOrderRemainingBalance(order);
                    const paidAmount = this.getOrderPaidAmount(order);
                    const paymentPercentage = order.total > 0 ? Math.min((paidAmount / order.total) * 100, 100).toFixed(0) : '0';

                    unpaidOrdersHTML += `
                        <div style="padding: 12px; background: #f9fafb; border-radius: 8px; margin-bottom: 8px;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                                <strong style="color: var(--text-primary);">Đơn #${order.orderNumber}</strong>
                                <span style="color: #6b7280; font-size: 12px;">${order.orderDate}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 6px;">
                                <span>Tổng tiền: ${order.total.toLocaleString('vi-VN')} VNĐ</span>
                                <span style="color: #059669;">Đã trả: ${paidAmount.toLocaleString('vi-VN')} VNĐ</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <div style="flex: 1; height: 6px; background: #e5e7eb; border-radius: 3px; overflow: hidden;">
                                    <div style="height: 100%; width: ${paymentPercentage}%; background: ${paymentPercentage == 100 ? '#10b981' : '#3b82f6'}; transition: width 0.3s;"></div>
                                </div>
                                <span style="font-size: 12px; color: #6b7280; min-width: 35px;">${paymentPercentage}%</span>
                            </div>
                            <div style="margin-top: 6px; font-size: 12px; color: ${remainingBalance > 0 ? '#dc2626' : '#059669'};">
                                ${remainingBalance > 0 ? `<strong>Còn nợ: ${remainingBalance.toLocaleString('vi-VN')} VNĐ</strong>` : '<strong>✓ Đã thanh toán</strong>'}
                            </div>
                        </div>
                    `;
                });

                const paymentHistoryItems = customer.paymentHistory || [];
                const customerPaymentHistoryHTML = paymentHistoryItems.length > 0 ? `
                    <div style="margin-bottom: 24px;">
                        <h4 style="margin: 0 0 12px 0; color: var(--text-primary);">📜 Lịch sử thanh toán trước đây</h4>
                        ${paymentHistoryItems.map((payment, idx) => `
                            <div style="padding: 12px; background: #f8fafc; border-radius: 8px; margin-bottom: 8px; border-left: 4px solid #2563eb;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                    <strong>Thanh toán #${idx + 1}</strong>
                                    <span style="font-size: 12px; color: #6b7280;">${payment.date}</span>
                                </div>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 13px;">
                                    <div>
                                        <div style="color: #6b7280;">Số tiền:</div>
                                        <div style="font-weight: 700; color: #059669;">${payment.amount.toLocaleString('vi-VN')} VNĐ</div>
                                    </div>
                                    <div>
                                        <div style="color: #6b7280;">Phương thức:</div>
                                        <div style="font-weight: 700; color: var(--text-primary);">${payment.method || 'Không xác định'}</div>
                                    </div>
                                </div>
                                ${payment.notes ? `<div style="margin-top: 8px; font-size: 12px; color: #4b5563;">Ghi chú: ${payment.notes}</div>` : ''}
                            </div>
                        `).join('')}
                    </div>
                ` : '';

                const today = this.getVietnamTime().toISOString().split('T')[0];

                const formHTML = `
                    <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1001; display: flex; justify-content: center; align-items: center; overflow-y: auto;" onclick="closeModal(this)">
                        <div style="background: white; padding: 32px; border-radius: 12px; width: 600px; max-width: 90vw; margin: 20px auto;" onclick="event.stopPropagation()">
                            <h3 style="margin-bottom: 24px; color: var(--text-primary);">🏦 Ghi nhận thanh toán - ${customer.name}</h3>

                            <!-- Customer Summary -->
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px;">
                                <div style="padding: 12px; background: #dbeafe; border-radius: 8px;">
                                    <div style="font-size: 12px; color: #1e40af; margin-bottom: 4px;">TỔNG NỢ</div>
                                    <div style="font-size: 20px; font-weight: bold; color: #1e40af;">${customerDebt.toLocaleString('vi-VN')} VNĐ</div>
                                </div>
                                <div style="padding: 12px; background: #dbeafe; border-radius: 8px;">
                                    <div style="font-size: 12px; color: #1e40af; margin-bottom: 4px;">SỐ ĐƠN HÀNG NỢ</div>
                                    <div style="font-size: 20px; font-weight: bold; color: #1e40af;">${unpaidOrders.length}</div>
                                </div>
                            </div>

                            <!-- Unpaid Orders List -->
                            <div style="margin-bottom: 24px;">
                                <h4 style="margin: 0 0 12px 0; color: var(--text-primary);">📋 Chi tiết các đơn hàng nợ:</h4>
                                ${unpaidOrdersHTML}
                            </div>

                            ${customerPaymentHistoryHTML}

                            <!-- Payment Form -->
                            <form onsubmit="app.recordPayment(event)" style="border-top: 1px solid #e5e7eb; padding-top: 24px;">
                                <input type="hidden" name="customer" value="${customer.id}">

                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">💰 Số tiền thanh toán:</label>
                                    <input type="number" name="amount" required min="0" max="${customerDebt}" 
                                           oninput="app.updatePaymentPreview(this.value, ${customerDebt})"
                                           style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px;" 
                                           placeholder="Tối đa: ${customerDebt.toLocaleString('vi-VN')} VNĐ">
                                </div>

                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">📅 Ngày thanh toán:</label>
                                    <input type="date" name="paymentDate" value="${today}" 
                                           style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px;">
                                </div>

                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">💳 Phương thức thanh toán:</label>
                                    <select name="paymentMethod" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px; background: white;">
                                        <option value="">-- Chọn phương thức --</option>
                                        <option value="Tiền mặt">💵 Tiền mặt</option>
                                        <option value="Chuyển khoản">🏦 Chuyển khoản ngân hàng</option>
                                        <option value="Thẻ tín dụng">💳 Thẻ tín dụng</option>
                                        <option value="Check">📋 Check</option>
                                        <option value="Khác">📝 Khác</option>
                                    </select>
                                </div>

                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">📝 Ghi chú (tùy chọn):</label>
                                    <textarea name="notes" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px; resize: vertical; min-height: 60px;" 
                                              placeholder="Nhập ghi chú về thanh toán (ví dụ: Thanh toán từ tài khoản công ty, mã tham chiếu, v.v.)"></textarea>
                                </div>

                                <!-- Payment Preview -->
                                <div id="paymentPreview" style="display: none; padding: 12px; background: #f0fdf4; border-radius: 8px; margin-bottom: 16px; border: 1px solid #bbf7d0;">
                                    <div style="font-size: 12px; color: #166534; margin-bottom: 8px;">🔍 RÓ TÍNH TOÁN</div>
                                    <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                                        <span style="color: var(--text-primary);">Thanh toán:</span>
                                        <span id="previewPaid" style="font-weight: bold; color: #059669;">0 VNĐ</span>
                                    </div>
                                    <div style="display: flex; justify-content: space-between;">
                                        <span style="color: var(--text-primary);">Còn nợ sau:</span>
                                        <span id="previewRemaining" style="font-weight: bold; color: #dc2626;">0 VNĐ</span>
                                    </div>
                                </div>

                                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                                    <button type="button" onclick="closeModal(this.closest('div[style*=fixed]'))" 
                                            style="padding: 12px 24px; border: 2px solid #e5e7eb; background: white; border-radius: 8px; cursor: pointer; font-weight: 600;">Hủy</button>
                                    <button type="submit" 
                                            style="padding: 12px 24px; background: var(--primary-blue); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">✓ Ghi nhận thanh toán</button>
                                </div>
                            </form>
                        </div>
                    </div>
                `;
                document.body.insertAdjacentHTML('beforeend', formHTML);
            }

            // Cập nhật preview thanh toán theo số tiền nhập vào
            updatePaymentPreview(amount, totalDebt) {
                const preview = document.getElementById('paymentPreview');
                if (!preview) return;

                const paidAmount = parseInt(amount) || 0;
                if (paidAmount > 0) {
                    preview.style.display = 'block';
                    const remaining = totalDebt - paidAmount;
                    document.getElementById('previewPaid').textContent = paidAmount.toLocaleString('vi-VN') + ' VNĐ';
                    document.getElementById('previewRemaining').textContent = remaining.toLocaleString('vi-VN') + ' VNĐ';
                } else {
                    preview.style.display = 'none';
                }
            }

            // Hiển thị lịch sử thanh toán của một đơn hàng
            showOrderPaymentHistory(orderIndex) {
                const order = this.demoData.orders[orderIndex];
                if (!order || !order.paymentHistory || order.paymentHistory.length === 0) {
                    this.showNotification('Không có lịch sử thanh toán cho đơn hàng này', 'info');
                    return;
                }

                this.syncOrderPaymentTotals(order);
                const totalPaid = this.getOrderPaidAmount(order);
                const remaining = this.getOrderRemainingBalance(order);
                const paymentPercentage = order.total > 0 ? Math.min((totalPaid / order.total) * 100, 100).toFixed(1) : '0.0';

                // Tạo danh sách thanh toán
                let paymentHistoryHTML = '';
                order.paymentHistory.forEach((payment, idx) => {
                    paymentHistoryHTML += `
                        <div style="padding: 12px; background: #f9fafb; border-radius: 8px; margin-bottom: 8px; border-left: 4px solid #3b82f6;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                                <strong style="color: var(--text-primary);">Thanh toán #${idx + 1}</strong>
                                <span style="font-size: 12px; background: #dbeafe; color: #1e40af; padding: 4px 8px; border-radius: 4px;">${payment.date}</span>
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 13px;">
                                <div>
                                    <span style="color: #6b7280;">Số tiền:</span>
                                    <div style="font-weight: bold; color: #059669;">${payment.amount.toLocaleString('vi-VN')} VNĐ</div>
                                </div>
                                <div>
                                    <span style="color: #6b7280;">Phương thức:</span>
                                    <div style="font-weight: bold; color: var(--text-primary);">${payment.method || 'Không xác định'}</div>
                                </div>
                            </div>
                            ${payment.notes ? `<div style="margin-top: 8px; padding: 8px; background: #fffbeb; border-radius: 4px; font-size: 12px; color: #78350f;">📝 ${payment.notes}</div>` : ''}
                            <div style="margin-top: 6px; font-size: 11px; color: #9ca3af;">ID: ${payment.id}</div>
                        </div>
                    `;
                });

                const modalHTML = `
                    <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1001; display: flex; justify-content: center; align-items: center; overflow-y: auto;" onclick="closeModal(this)">
                        <div style="background: white; padding: 32px; border-radius: 12px; width: 600px; max-width: 90vw; margin: 20px auto;" onclick="event.stopPropagation()">
                            <h3 style="margin: 0 0 24px 0; color: var(--text-primary);">🕐 Lịch sử thanh toán - Đơn #${order.id}</h3>

                            <!-- Order Summary -->
                            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 24px;">
                                <div style="padding: 12px; background: #f3f4f6; border-radius: 8px; text-align: center;">
                                    <div style="font-size: 11px; color: #6b7280; text-transform: uppercase; margin-bottom: 4px;">Tổng tiền</div>
                                    <div style="font-size: 16px; font-weight: bold; color: var(--text-primary);">${order.total.toLocaleString('vi-VN')}</div>
                                    <div style="font-size: 10px; color: #9ca3af;">VNĐ</div>
                                </div>
                                <div style="padding: 12px; background: #dcfce7; border-radius: 8px; text-align: center;">
                                    <div style="font-size: 11px; color: #166534; text-transform: uppercase; margin-bottom: 4px;">Đã thanh toán</div>
                                    <div style="font-size: 16px; font-weight: bold; color: #059669;">${totalPaid.toLocaleString('vi-VN')}</div>
                                    <div style="font-size: 10px; color: #6b7280;">${paymentPercentage}%</div>
                                </div>
                                <div style="padding: 12px; background: ${remaining > 0 ? '#fee2e2' : '#dcfce7'}; border-radius: 8px; text-align: center;">
                                    <div style="font-size: 11px; color: ${remaining > 0 ? '#991b1b' : '#166534'}; text-transform: uppercase; margin-bottom: 4px;">Còn nợ</div>
                                    <div style="font-size: 16px; font-weight: bold; color: ${remaining > 0 ? '#dc2626' : '#059669'};">${remaining.toLocaleString('vi-VN')}</div>
                                    <div style="font-size: 10px; color: #6b7280;">${(100 - paymentPercentage).toFixed(1)}%</div>
                                </div>
                            </div>

                            <!-- Progress Bar -->
                            <div style="margin-bottom: 24px;">
                                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                                    <span style="font-weight: 600; color: var(--text-primary);">Tiến độ thanh toán:</span>
                                    <span style="font-weight: bold; color: #3b82f6;">${paymentPercentage}%</span>
                                </div>
                                <div style="height: 24px; background: #e5e7eb; border-radius: 12px; overflow: hidden;">
                                    <div style="height: 100%; width: ${paymentPercentage}%; background: linear-gradient(90deg, #3b82f6, #10b981); transition: width 0.3s; display: flex; align-items: center; justify-content: center;">
                                        ${paymentPercentage > 10 ? `<span style="color: white; font-size: 12px; font-weight: bold;">${paymentPercentage}%</span>` : ''}
                                    </div>
                                </div>
                            </div>

                            <!-- Payment History -->
                            <div style="margin-bottom: 24px;">
                                <h4 style="margin: 0 0 12px 0; color: var(--text-primary);">📋 Chi tiết thanh toán:</h4>
                                ${paymentHistoryHTML}
                            </div>

                            <!-- Close Button -->
                            <div style="display: flex; justify-content: flex-end;">
                                <button onclick="closeModal(this.closest('div[style*=fixed]'))" 
                                        style="padding: 12px 24px; background: var(--primary-blue); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">Đóng</button>
                            </div>
                        </div>
                    </div>
                `;

                document.body.insertAdjacentHTML('beforeend', modalHTML);
            }

            // Tạo dữ liệu sản phẩm demo từ tổng tiền đơn hàng
            generateOrderItemsFromTotal(total) {
                const sampleProducts = [
                    { name: 'Máy tính xách tay Dell Inspiron', price: 15000000, sku: 'DELL001' },
                    { name: 'Điện thoại Samsung Galaxy', price: 8000000, sku: 'SAM001' },
                    { name: 'Tai nghe Sony WH-1000XM4', price: 6000000, sku: 'SONY001' },
                    { name: 'Bàn phím cơ Logitech', price: 2500000, sku: 'LOG001' },
                    { name: 'Chuột gaming Razer', price: 1800000, sku: 'RAZ001' },
                    { name: 'Màn hình LG 24 inch', price: 4500000, sku: 'LG001' },
                    { name: 'Ổ cứng SSD Samsung 500GB', price: 2200000, sku: 'SSD001' },
                    { name: 'Camera web Logitech C920', price: 1500000, sku: 'CAM001' },
                    { name: 'Loa Bluetooth JBL', price: 3000000, sku: 'JBL001' },
                    { name: 'Đế tản nhiệt laptop', price: 800000, sku: 'FAN001' }
                ];

                const items = [];
                let remainingTotal = total;
                let attempts = 0;

                // Tạo 1-4 sản phẩm ngẫu nhiên
                const numItems = Math.min(Math.floor(Math.random() * 3) + 1, 4);

                for (let i = 0; i < numItems && remainingTotal > 0 && attempts < 10; i++) {
                    const product = sampleProducts[Math.floor(Math.random() * sampleProducts.length)];

                    // Tính số lượng phù hợp
                    const maxQty = Math.min(Math.floor(remainingTotal / product.price), 5);
                    const quantity = maxQty > 0 ? Math.floor(Math.random() * maxQty) + 1 : 1;

                    // Điều chỉnh giá để phù hợp với số tiền còn lại
                    let itemPrice = product.price;
                    if (i === numItems - 1) {
                        // Sản phẩm cuối cùng: điều chỉnh giá để tổng khớp
                        itemPrice = Math.floor(remainingTotal / quantity);
                    }

                    const itemTotal = quantity * itemPrice;
                    if (itemTotal <= remainingTotal) {
                        items.push({
                            name: product.name,
                            quantity: quantity,
                            price: itemPrice,
                            sku: product.sku,
                            productId: `prod_${product.sku.toLowerCase()}`
                        });
                        remainingTotal -= itemTotal;
                    }
                    attempts++;
                }

                // Nếu còn dư tiền, thêm vào sản phẩm cuối
                if (remainingTotal > 0 && items.length > 0) {
                    const lastItem = items[items.length - 1];
                    const extraPerUnit = Math.floor(remainingTotal / lastItem.quantity);
                    lastItem.price += extraPerUnit;
                }

                return items;
            }

            // Hiển thị chi tiết đơn hàng
            showOrderDetail(orderId) {
                const order = this.demoData.orders.find(o => o.id === orderId);
                if (!order) {
                    this.showNotification('Không tìm thấy đơn hàng', 'error');
                    return;
                }

                // Tìm khách hàng từ cả demoData và localStorage
                let customer = this.demoData.customers.find(c => c.id === order.customerId);
                if (!customer) {
                    // Tìm trong localStorage nếu không có trong demoData
                    const storedCustomers = JSON.parse(localStorage.getItem('customers') || '[]');
                    customer = storedCustomers.find(c => c.id === order.customerId);
                }

                // Debug log để kiểm tra
                console.log('Order customer ID:', order.customerId);
                console.log('Found customer:', customer);

                // Tạo dữ liệu sản phẩm demo dựa trên đơn hàng (vì dữ liệu thực không có items)
                let orderItems = order.items;
                if (!orderItems || orderItems.length === 0) {
                    // Tạo dữ liệu demo dựa trên tổng tiền
                    orderItems = this.generateOrderItemsFromTotal(order.total);
                }

                const orderItemsHTML = orderItems && orderItems.length > 0 ? 
                    orderItems.map(item => {
                        const product = this.demoData.products.find(p => p.id === item.productId);
                        const productName = product ? product.name : item.name || item.productName || 'Sản phẩm không xác định';

                        return `
                            <tr style="border-bottom: 1px solid #e5e7eb;">
                                <td style="padding: 12px; text-align: left;">
                                    <div style="font-weight: 600;">${productName}</div>
                                    <div style="color: #6b7280; font-size: 12px;">SKU: ${item.sku || 'SP' + Math.floor(Math.random() * 1000)}</div>
                                </td>
                                <td style="padding: 12px; text-align: center; font-weight: 600;">${item.quantity}</td>
                                <td style="padding: 12px; text-align: right;">${item.price.toLocaleString('vi-VN')} VNĐ</td>
                                <td style="padding: 12px; text-align: right; font-weight: 600; color: #dc2626;">
                                    ${(item.quantity * item.price).toLocaleString('vi-VN')} VNĐ
                                </td>
                            </tr>
                        `;
                    }).join('') :
                    '<tr><td colspan="4" style="padding: 20px; text-align: center; color: #6b7280;">Không có sản phẩm</td></tr>';

                const orderDetailHTML = `
                    <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1002; display: flex; justify-content: center; align-items: center;" onclick="closeModal(this)">
                        <div style="background: white; padding: 32px; border-radius: 12px; width: 900px; max-width: 95vw; max-height: 90vh; overflow-y: auto;" onclick="event.stopPropagation()">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                                <h3 style="margin: 0; color: var(--text-primary);">📋 Chi tiết đơn hàng ${order.id}</h3>
                                <button onclick="closeModal(this.closest('div[style*=fixed]'))" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #6b7280;">×</button>
                            </div>

                            <!-- Thông tin đơn hàng -->
                            <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                                    <div>
                                        <div style="color: #6b7280; font-size: 14px; margin-bottom: 4px;">Mã đơn hàng:</div>
                                        <div style="font-weight: 600; color: var(--text-primary);">${order.id}</div>
                                    </div>
                                    <div>
                                        <div style="color: #6b7280; font-size: 14px; margin-bottom: 4px;">Ngày tạo:</div>
                                        <div style="font-weight: 600; color: var(--text-primary);">${order.date}</div>
                                    </div>
                                    <div>
                                        <div style="color: #6b7280; font-size: 14px; margin-bottom: 4px;">Khách hàng:</div>
                                        <div style="font-weight: 600; color: var(--text-primary);">
                                            ${customer ? customer.name : order.customerName || 'N/A'}
                                            ${customer && customer.type === 'doanh-nghiep' ? `
                                                <div style="font-size: 13px; color: #6b7280; margin-top: 4px;">
                                                    <div><strong>Công ty:</strong> ${customer.companyName || 'Chưa có'}</div>
                                                    ${customer.department ? `<div><strong>Phòng ban:</strong> ${customer.department}</div>` : ''}
                                                    ${customer.taxCode ? `<div><strong>MST:</strong> ${customer.taxCode}</div>` : ''}
                                                </div>
                                            ` : ''}
                                        </div>
                                    </div>
                                    <div>
                                        <div style="color: #6b7280; font-size: 14px; margin-bottom: 4px;">Trạng thái thanh toán:</div>
                                        <div style="font-weight: 600;">
                                            <span style="background: ${order.paymentStatus === 'Đã thanh toán' ? '#16a34a' : '#f59e0b'}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
                                                ${order.paymentStatus}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div style="margin-top: 16px;">
                                    <div style="color: #6b7280; font-size: 14px; margin-bottom: 4px;">Tổng tiền:</div>
                                    <div style="font-weight: 700; color: #dc2626; font-size: 18px;">${order.total.toLocaleString('vi-VN')} VNĐ</div>
                                </div>
                                ${order.notes ? `
                                <div style="margin-top: 16px;">
                                    <div style="color: #6b7280; font-size: 14px; margin-bottom: 4px;">Ghi chú:</div>
                                    <div style="font-weight: 600; color: var(--text-primary);">${order.notes}</div>
                                </div>
                                ` : ''}
                            </div>

                            <!-- Danh sách sản phẩm -->
                            <div>
                                <h4 style="margin-bottom: 16px; color: var(--text-primary);">
                                    🛒 Sản phẩm trong đơn hàng (${order.items ? order.items.length : 0} sản phẩm)
                                </h4>
                                <div style="overflow-x: auto;">
                                    <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                                        <thead>
                                            <tr style="background: #f3f4f6;">
                                                <th style="padding: 12px; text-align: left; font-weight: 600; color: var(--text-primary);">Tên sản phẩm</th>
                                                <th style="padding: 12px; text-align: center; font-weight: 600; color: var(--text-primary);">Số lượng</th>
                                                <th style="padding: 12px; text-align: right; font-weight: 600; color: var(--text-primary);">Đơn giá</th>
                                                <th style="padding: 12px; text-align: right; font-weight: 600; color: var(--text-primary);">Thành tiền</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${orderItemsHTML}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
                                <button onclick="closeModal(this.closest('div[style*=fixed]'))" style="
                                    background: #6b7280; 
                                    color: white; 
                                    border: none; 
                                    padding: 12px 24px; 
                                    border-radius: 8px; 
                                    cursor: pointer; 
                                    font-weight: 600;
                                ">
                                    Đóng
                                </button>
                            </div>
                        </div>
                    </div>
                `;

                document.body.insertAdjacentHTML('beforeend', orderDetailHTML);
            }

            // Hiển thị chi tiết công nợ khách hàng
            showCustomerDebtDetail(customerId) {
                // Tìm khách hàng từ cả demoData và localStorage
                let customer = this.demoData.customers.find(c => c.id === customerId);
                if (!customer) {
                    const storedCustomers = JSON.parse(localStorage.getItem('customers') || '[]');
                    customer = storedCustomers.find(c => c.id === customerId);
                }

                if (!customer) {
                    this.showNotification('Không tìm thấy khách hàng', 'error');
                    return;
                }

                console.log('🔍 DEBUG - Customer:', customer);
                console.log('🔍 DEBUG - All orders:', this.demoData.orders);

                // Tìm tất cả đơn hàng chưa thanh toán của khách hàng (tìm theo nhiều cách)
                const unpaidOrders = this.demoData.orders.filter(order => {
                    // Tìm theo customerId hoặc customer name
                    const matchById = order.customerId === customerId;
                    const matchByName = order.customer === customer.name || order.customerName === customer.name;

                    const isUnpaid = this.getOrderRemainingBalance(order) > 0;

                    console.log(`🔍 Order ${order.id}: matchById=${matchById}, matchByName=${matchByName}, isUnpaid=${isUnpaid}`);

                    return (matchById || matchByName) && isUnpaid;
                });

                console.log('🔍 DEBUG - Unpaid orders found:', unpaidOrders);
                const actualCustomerDebt = unpaidOrders.reduce((sum, order) => sum + this.getOrderRemainingBalance(order), 0);

                const customerPaymentHistory = customer.paymentHistory || [];
                const customerPaymentHistoryHTML = customerPaymentHistory.length > 0 ? customerPaymentHistory.map((payment, idx) => `
                    <div style="padding: 12px; background: #f8fafc; border-radius: 8px; margin-bottom: 8px; border-left: 4px solid #2563eb;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <strong>Thanh toán #${idx + 1}</strong>
                            <span style="font-size: 12px; color: #6b7280;">${payment.date}</span>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 13px;">
                            <div>
                                <div style="color: #6b7280;">Số tiền:</div>
                                <div style="font-weight: 700; color: #059669;">${payment.amount.toLocaleString('vi-VN')} VNĐ</div>
                            </div>
                            <div>
                                <div style="color: #6b7280;">Phương thức:</div>
                                <div style="font-weight: 700; color: var(--text-primary);">${payment.method || 'Không xác định'}</div>
                            </div>
                        </div>
                        ${payment.notes ? `<div style="margin-top: 8px; font-size: 12px; color: #4b5563;">Ghi chú: ${payment.notes}</div>` : ''}
                    </div>
                `).join('') : '<div style="padding: 16px; background: #f8fafc; border-radius: 8px; color: #6b7280; margin-bottom: 24px;">Chưa có lịch sử thanh toán cho khách hàng này.</div>';

                const unpaidOrdersHTML = unpaidOrders.length > 0 ? 
                    unpaidOrders.map((order, idx) => {
                        const orderIndex = this.demoData.orders.findIndex(o => o.id === order.id);
                        const remainingBalance = this.getOrderRemainingBalance(order);
                        const paidAmount = this.getOrderPaidAmount(order);
                        const paymentPercentage = order.total > 0 ? Math.min((paidAmount / order.total) * 100, 100).toFixed(0) : '0';
                        return `
                        <tr style="border-bottom: 1px solid #e5e7eb;">
                            <td style="padding: 12px; text-align: left;">${order.id}</td>
                            <td style="padding: 12px; text-align: left;">${order.date}</td>
                            <td style="padding: 12px; text-align: right;">
                                <div style="margin-bottom: 4px;">
                                    <strong style="color: var(--text-primary);">Tổng: ${order.total.toLocaleString('vi-VN')} VNĐ</strong>
                                </div>
                                <div style="font-size: 12px; color: #6b7280;">
                                    Đã trả: ${paidAmount.toLocaleString('vi-VN')} | <span style="color: #dc2626;">Nợ: ${remainingBalance.toLocaleString('vi-VN')}</span>
                                </div>
                                <div style="margin-top: 6px; height: 4px; background: #e5e7eb; border-radius: 2px; overflow: hidden;">
                                    <div style="height: 100%; width: ${paymentPercentage}%; background: #3b82f6;"></div>
                                </div>
                            </td>
                            <td style="padding: 12px; text-align: center;">
                                <span style="background: ${order.paymentStatus === 'Thanh toán một phần' ? '#f59e0b' : '#dc2626'}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
                                    ${order.paymentStatus}
                                </span>
                            </td>
                            <td style="padding: 12px; text-align: center; display: flex; gap: 6px; flex-wrap: wrap; justify-content: center;">
                                ${order.paymentHistory && order.paymentHistory.length > 0 ? `
                                    <button onclick="app.showOrderPaymentHistory(${orderIndex})" style="
                                        background: #10b981; 
                                        color: white; 
                                        border: none; 
                                        padding: 6px 10px; 
                                        border-radius: 4px; 
                                        cursor: pointer; 
                                        font-size: 11px; 
                                        font-weight: 600;
                                    " title="Xem lịch sử thanh toán">
                                        🕐 Lịch sử (${order.paymentHistory.length})
                                    </button>
                                ` : ''}
                                <button onclick="app.showOrderDetail('${order.id}')" style="
                                    background: #3b82f6; 
                                    color: white; 
                                    border: none; 
                                    padding: 6px 10px; 
                                    border-radius: 4px; 
                                    cursor: pointer; 
                                    font-size: 11px; 
                                    font-weight: 600;
                                ">
                                    Chi tiết
                                </button>
                            </td>
                        </tr>
                    `;
                    }).join('') :
                    '<tr><td colspan="5" style="padding: 20px; text-align: center; color: #6b7280;">Không có đơn hàng nào đang nợ</td></tr>';

                const detailHTML = `
                    <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1001; display: flex; justify-content: center; align-items: center;" onclick="closeModal(this)">
                        <div style="background: white; padding: 32px; border-radius: 12px; width: 800px; max-width: 95vw; max-height: 90vh; overflow-y: auto;" onclick="event.stopPropagation()">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                                <h3 style="margin: 0; color: var(--text-primary);">📊 Chi tiết công nợ - ${customer.name}</h3>
                                <button onclick="closeModal(this.closest('div[style*=fixed]'))" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #6b7280;">×</button>
                            </div>

                            <!-- Thông tin khách hàng -->
                            <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                                    <div>
                                        <div style="color: #6b7280; font-size: 14px; margin-bottom: 4px;">Tên khách hàng:</div>
                                        <div style="font-weight: 600; color: var(--text-primary);">${customer.name}</div>
                                        ${customer.type === 'doanh-nghiep' && customer.companyName ? `
                                            <div style="font-size: 13px; color: #6b7280; margin-top: 4px;">
                                                <div><strong>Công ty:</strong> ${customer.companyName}</div>
                                            </div>
                                        ` : ''}
                                    </div>
                                    <div>
                                        <div style="color: #6b7280; font-size: 14px; margin-bottom: 4px;">Mã khách hàng:</div>
                                        <div style="font-weight: 600; color: var(--text-primary);">${customer.id}</div>
                                        ${customer.type === 'doanh-nghiep' && customer.department ? `
                                            <div style="font-size: 13px; color: #6b7280; margin-top: 4px;">
                                                <div><strong>Phòng ban:</strong> ${customer.department}</div>
                                            </div>
                                        ` : ''}
                                    </div>
                                    <div>
                                        <div style="color: #6b7280; font-size: 14px; margin-bottom: 4px;">Số điện thoại:</div>
                                        <div style="font-weight: 600; color: var(--text-primary);">${customer.phone}</div>
                                        ${customer.type === 'doanh-nghiep' && customer.taxCode ? `
                                            <div style="font-size: 13px; color: #6b7280; margin-top: 4px;">
                                                <div><strong>MST:</strong> ${customer.taxCode}</div>
                                            </div>
                                        ` : ''}
                                    </div>
                                    <div>
                                        <div style="color: #6b7280; font-size: 14px; margin-bottom: 4px;">Tổng công nợ:</div>
                                        <div style="font-weight: 700; color: #dc2626; font-size: 18px;">${actualCustomerDebt.toLocaleString('vi-VN')} VNĐ</div>
                                    </div>
                                </div>
                                <div style="margin-top: 16px;">
                                    <div style="color: #6b7280; font-size: 14px; margin-bottom: 4px;">Địa chỉ:</div>
                                    <div style="font-weight: 600; color: var(--text-primary);">${customer.address}</div>
                                </div>
                            </div>

                            <!-- Danh sách đơn hàng đang nợ -->
                            <div>
                                <h4 style="margin-bottom: 16px; color: var(--text-primary);">
                                    📝 Đơn hàng đang nợ (${unpaidOrders.length} đơn)
                                </h4>
                                <div style="overflow-x: auto;">
                                    <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                                        <thead>
                                            <tr style="background: #f3f4f6;">
                                                <th style="padding: 12px; text-align: left; font-weight: 600; color: var(--text-primary);">Mã đơn</th>
                                                <th style="padding: 12px; text-align: left; font-weight: 600; color: var(--text-primary);">Ngày tạo</th>
                                                <th style="padding: 12px; text-align: right; font-weight: 600; color: var(--text-primary);">Số tiền & Còn nợ</th>
                                                <th style="padding: 12px; text-align: center; font-weight: 600; color: var(--text-primary);">Trạng thái</th>
                                                <th style="padding: 12px; text-align: center; font-weight: 600; color: var(--text-primary);">Hành động</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${unpaidOrdersHTML}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <!-- Lịch sử thanh toán khách hàng -->
                            <div style="margin-top: 24px;">
                                <h4 style="margin-bottom: 16px; color: var(--text-primary);">🧾 Lịch sử thanh toán</h4>
                                ${customerPaymentHistoryHTML}
                            </div>

                            <div style="display: flex; gap: 12px; justify-content: space-between; margin-top: 24px;">
                                <button onclick="app.printDebtReport('${customer.id}'); closeModal(this.closest('div[style*=fixed]'));" style="
                                    background: var(--primary-green); 
                                    color: white; 
                                    border: none; 
                                    padding: 12px 24px; 
                                    border-radius: 8px; 
                                    cursor: pointer; 
                                    font-weight: 600;
                                ">
                                    🖨️ IN báo cáo công nợ
                                </button>
                                <div style="display: flex; gap: 12px;">
                                    <button onclick="app.showPaymentFormForCustomer('${customer.id}'); closeModal(this.closest('div[style*=fixed]'));" style="
                                        background: var(--primary-blue); 
                                        color: white; 
                                        border: none; 
                                        padding: 12px 24px; 
                                        border-radius: 8px; 
                                        cursor: pointer; 
                                        font-weight: 600;
                                    ">
                                        💰 Ghi nhận thanh toán
                                    </button>
                                    <button onclick="closeModal(this.closest('div[style*=fixed]'))" style="
                                        background: #6b7280; 
                                        color: white; 
                                        border: none; 
                                        padding: 12px 24px; 
                                        border-radius: 8px; 
                                        cursor: pointer; 
                                        font-weight: 600;
                                    ">
                                        Đóng
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;

                document.body.insertAdjacentHTML('beforeend', detailHTML);
            }

            // Toggle trạng thái công nợ/đã thanh toán cho khách hàng
            toggleCustomerDebtStatus(customerId) {
                const customer = this.demoData.customers.find(c => c.id === customerId);
                if (!customer) {
                    this.showNotification('Không tìm thấy khách hàng', 'error');
                    return;
                }

                if (customer.debt > 0) {
                    // Chuyển từ có nợ sang đã thanh toán
                    const oldDebt = customer.debt;
                    customer.debt = 0;

                    // ĐỒNG BỘ 2 CHIỀU: Cập nhật tất cả đơn hàng chưa thanh toán của khách hàng này
                    const unpaidOrders = this.demoData.orders.filter(order => 
                        order.customerId === customerId && 
                        (order.paymentStatus === 'Công nợ' || order.paymentStatus === 'Thanh toán một phần')
                    );

                    let updatedOrdersCount = 0;
                    unpaidOrders.forEach(order => {
                        const remainingBalance = this.getOrderRemainingBalance(order);
                        if (remainingBalance > 0) {
                            this.recordOrderPayment(order, customer, remainingBalance, {
                                id: `PAY_CUSTOMER_${customerId}_${order.id}_${Date.now()}`,
                                date: this.getVietnamTime().toISOString().split('T')[0],
                                method: order.paymentMethod || 'Tiền mặt',
                                notes: 'Thanh toán toàn bộ công nợ khách hàng',
                                remainingDebt: 0
                            });
                        }
                        order.paymentStatus = 'Đã thanh toán';
                        this.syncOrderPaymentTotals(order);
                        updatedOrdersCount++;
                        console.log(`🔄 Đồng bộ: Đơn hàng ${order.id} → Đã thanh toán`);
                    });

                    this.saveToLocalStorage();
                    this.refreshAllCustomerDisplays();

                    const message = updatedOrdersCount > 0 
                        ? `Đã đánh dấu ${customer.name} thanh toán xong ${oldDebt.toLocaleString('vi-VN')} VNĐ và cập nhật ${updatedOrdersCount} đơn hàng thành "Đã thanh toán"`
                        : `Đã đánh dấu ${customer.name} đã thanh toán toàn bộ công nợ ${oldDebt.toLocaleString('vi-VN')} VNĐ`;

                    this.showNotification(message, 'success');
                    this.loadPage('debts');
                } else {
                    // Hiển thị form nhập số tiền nợ mới
                    const formHTML = `
                        <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1001; display: flex; justify-content: center; align-items: center;" onclick="closeModal(this)">
                            <div style="background: white; padding: 32px; border-radius: 12px; width: 500px; max-width: 90vw;" onclick="event.stopPropagation()">
                                <h3 style="margin-bottom: 24px; color: var(--text-primary);">Tạo công nợ - ${customer.name}</h3>
                                <form onsubmit="app.createDebtForCustomer(event, '${customer.id}')">
                                    <div style="margin-bottom: 16px;">
                                        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Khách hàng:</label>
                                        <input type="text" value="${customer.name} (${customer.id})" disabled style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; background: #f9fafb;">
                                    </div>
                                    <div style="margin-bottom: 24px;">
                                        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Số tiền công nợ:</label>
                                        <input type="number" name="debtAmount" required min="1" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;" placeholder="Nhập số tiền công nợ">
                                    </div>
                                    <div style="display: flex; gap: 12px; justify-content: flex-end;">
                                        <button type="button" onclick="closeModal(this.closest('div[style*=fixed]'))" 
                                                style="padding: 12px 24px; border: 2px solid #e5e7eb; background: white; border-radius: 8px; cursor: pointer;">Hủy</button>
                                        <button type="submit" 
                                                style="padding: 12px 24px; background: #f59e0b; color: white; border: none; border-radius: 8px; cursor: pointer;">Tạo công nợ</button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    `;
                    document.body.insertAdjacentHTML('beforeend', formHTML);
                }
            }

            // Tạo công nợ cho khách hàng
            createDebtForCustomer(event, customerId) {
                event.preventDefault();
                const form = event.target;
                const formData = new FormData(form);
                const debtAmount = parseInt(formData.get('debtAmount'));

                const customer = this.demoData.customers.find(c => c.id === customerId);
                if (customer && debtAmount > 0) {
                    customer.debt = debtAmount;
                    this.saveToLocalStorage();
                    this.refreshAllCustomerDisplays();
                    this.showNotification(`Đã tạo công nợ ${debtAmount.toLocaleString('vi-VN')} VNĐ cho ${customer.name}`, 'success');
                    this.loadPage('debts');
                }
                const modal = form.closest("div[style*=\"fixed\"]"); if(modal) modal.remove();
            }

            // Refresh tất cả phần hiển thị khách hàng để đồng bộ dữ liệu
            refreshAllCustomerDisplays() {
                // Force reload dữ liệu từ localStorage để đảm bảo đồng bộ
                this.loadFromLocalStorage();

                // Debug: Log dữ liệu khách hàng hiện tại
                console.log('=== DEBUG CUSTOMER DATA ===');
                this.demoData.customers.forEach(customer => {
                    console.log(`${customer.name}: ${customer.debt.toLocaleString('vi-VN')} VNĐ`);
                });
                console.log('=== END DEBUG ===');

                // Cập nhật cache để tránh hiển thị dữ liệu cũ
                if (typeof window !== 'undefined') {
                    // Trigger event để các component khác biết dữ liệu đã thay đổi
                    window.dispatchEvent(new CustomEvent('customerDataUpdated', {
                        detail: { customers: this.demoData.customers }
                    }));
                }

                console.log('Đã refresh tất cả dữ liệu khách hàng');
            }

            exportDebtReport(mode = null) {
                this.showDebtExportWithFilter();
            }

            // Additional Product Management Functions
            showUpdatePriceForm() {
                const productOptions = this.demoData.products.map(p => 
                    `<option value="${p.id}">${p.name} - Giá hiện tại: ${p.price.toLocaleString('vi-VN')} VNĐ</option>`
                ).join('');

                const formHTML = `
                    <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1001; display: flex; justify-content: center; align-items: center;" onclick="closeModal(this)">
                        <div style="background: white; padding: 32px; border-radius: 12px; width: 500px; max-width: 90vw;" onclick="event.stopPropagation()">
                            <h3 style="margin-bottom: 24px; color: var(--text-primary);">Cập nhật giá sản phẩm</h3>
                            <form onsubmit="app.submitProductUpdate(event)">
                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Sản phẩm:</label>
                                    <select name="product" required style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                        <option value="">Chọn sản phẩm</option>
                                        ${productOptions}
                                    </select>
                                </div>
                                <div style="margin-bottom: 24px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Giá mới:</label>
                                    <input type="number" name="price" required min="0" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                </div>
                                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                                    <button type="button" onclick="closeModal(this.closest('div[style*=fixed]'))" 
                                            style="padding: 12px 24px; border: 2px solid #e5e7eb; background: white; border-radius: 8px; cursor: pointer;">Hủy</button>
                                    <button type="submit" 
                                            style="padding: 12px 24px; background: var(--primary-blue); color: white; border: none; border-radius: 8px; cursor: pointer;">Cập nhật giá</button>
                                </div>
                            </form>
                        </div>
                    </div>
                `;
                document.body.insertAdjacentHTML('beforeend', formHTML);
            }

            submitProductUpdate(event) {
                event.preventDefault();
                const form = event.target;
                const formData = new FormData(form);

                const productId = formData.get('product');
                const newPrice = parseInt(formData.get('price'));

                const product = this.demoData.products.find(p => p.id === productId);
                if (product) {
                    const oldPrice = product.price;
                    product.price = newPrice;
                    this.saveToLocalStorage();
                    this.showNotification(`Đã cập nhật giá ${product.name} từ ${oldPrice.toLocaleString('vi-VN')} VNĐ thành ${newPrice.toLocaleString('vi-VN')} VNĐ`, 'success');
                    this.loadPage('products');
                }
                const modal = form.closest("div[style*=\"fixed\"]"); if(modal) modal.remove();
            }

            showStockUpdateForm() {
                const productOptions = this.demoData.products.map(p => 
                    `<option value="${p.id}">${p.name} - Tồn kho: ${p.stock}</option>`
                ).join('');

                const formHTML = `
                    <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1001; display: flex; justify-content: center; align-items: center;" onclick="closeModal(this)">
                        <div style="background: white; padding: 32px; border-radius: 12px; width: 500px; max-width: 90vw;" onclick="event.stopPropagation()">
                            <h3 style="margin-bottom: 24px; color: var(--text-primary);">Nhập kho</h3>
                            <form onsubmit="app.updateStock(event)">
                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Sản phẩm:</label>
                                    <select name="product" required style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                        <option value="">Chọn sản phẩm</option>
                                        ${productOptions}
                                    </select>
                                </div>
                                <div style="margin-bottom: 24px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Số lượng nhập thêm:</label>
                                    <input type="number" name="quantity" required min="1" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                </div>
                                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                                    <button type="button" onclick="closeModal(this.closest('div[style*=fixed]'))" 
                                            style="padding: 12px 24px; border: 2px solid #e5e7eb; background: white; border-radius: 8px; cursor: pointer;">Hủy</button>
                                    <button type="submit" 
                                            style="padding: 12px 24px; background: var(--primary-blue); color: white; border: none; border-radius: 8px; cursor: pointer;">Nhập kho</button>
                                </div>
                            </form>
                        </div>
                    </div>
                `;
                document.body.insertAdjacentHTML('beforeend', formHTML);
            }

            updateStock(event) {
                event.preventDefault();
                const form = event.target;
                const formData = new FormData(form);

                const productId = formData.get('product');
                const quantity = parseInt(formData.get('quantity'));

                const product = this.demoData.products.find(p => p.id === productId);
                if (product) {
                    const oldStock = product.stock;
                    product.stock += quantity;

                    // Add to inventory history
                    this.addInventoryHistory({
                        type: 'import',
                        productId: product.id,
                        productName: product.name,
                        quantity: quantity,
                        oldStock: oldStock,
                        newStock: product.stock,
                        date: this.getVietnamTime().toISOString().split('T')[0],
                        time: this.formatTimeNow(),
                        reason: 'Nhập kho',
                        notes: ''
                    });

                    this.saveToLocalStorage();
                    this.showNotification(`Đã nhập ${quantity} ${product.name} vào kho. Tồn kho mới: ${product.stock}`, 'success');
                    this.loadPage('inventory');
                }
                const modal = form.closest("div[style*=\"fixed\"]"); if(modal) modal.remove();
            }

            showStockExportForm() {
                const productOptions = this.demoData.products.filter(p => p.stock > 0).map(p => 
                    `<option value="${p.id}">${p.name} - Tồn kho: ${p.stock}</option>`
                ).join('');

                const formHTML = `
                    <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1001; display: flex; justify-content: center; align-items: center;" onclick="closeModal(this)">
                        <div style="background: white; padding: 32px; border-radius: 12px; width: 500px; max-width: 90vw;" onclick="event.stopPropagation()">
                            <h3 style="margin-bottom: 24px; color: var(--text-primary);">Xuất kho</h3>
                            <form onsubmit="app.exportStock(event)">
                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Sản phẩm:</label>
                                    <select name="product" required style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                        <option value="">Chọn sản phẩm</option>
                                        ${productOptions}
                                    </select>
                                </div>
                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Lý do xuất:</label>
                                    <select name="reason" required style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                        <option value="">Chọn lý do</option>
                                        <option value="Bán hàng">Bán hàng</option>
                                        <option value="Khuyến mãi">Khuyến mãi</option>
                                        <option value="Hỏng hóc">Hỏng hóc</option>
                                        <option value="Kiểm kê">Kiểm kê</option>
                                        <option value="Khác">Khác</option>
                                    </select>
                                </div>
                                <div style="margin-bottom: 24px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Số lượng xuất:</label>
                                    <input type="number" name="quantity" required min="1" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                </div>
                                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                                    <button type="button" onclick="closeModal(this.closest('div[style*=fixed]'))" 
                                            style="padding: 12px 24px; border: 2px solid #e5e7eb; background: white; border-radius: 8px; cursor: pointer;">Hủy</button>
                                    <button type="submit" 
                                            style="padding: 12px 24px; background: var(--primary-blue); color: white; border: none; border-radius: 8px; cursor: pointer;">Xuất kho</button>
                                </div>
                            </form>
                        </div>
                    </div>
                `;
                document.body.insertAdjacentHTML('beforeend', formHTML);
            }

            exportStock(event) {
                event.preventDefault();
                const form = event.target;
                const formData = new FormData(form);

                const productId = formData.get('product');
                const quantity = parseInt(formData.get('quantity'));
                const reason = formData.get('reason');

                const product = this.demoData.products.find(p => p.id === productId);
                if (product && product.stock >= quantity) {
                    const oldStock = product.stock;
                    product.stock -= quantity;

                    // Add to inventory history
                    this.addInventoryHistory({
                        type: 'export',
                        productId: product.id,
                        productName: product.name,
                        quantity: quantity,
                        oldStock: oldStock,
                        newStock: product.stock,
                        date: this.getVietnamTime().toISOString().split('T')[0],
                        time: this.formatTimeNow(),
                        reason: reason,
                        notes: ''
                    });

                    this.saveToLocalStorage();
                    this.showNotification(`Đã xuất ${quantity} ${product.name} - Lý do: ${reason}. Tồn kho còn: ${product.stock}`, 'success');
                    this.loadPage('inventory');
                } else if (product) {
                    this.showNotification(`Không đủ hàng trong kho. Tồn kho hiện tại: ${product.stock}`, 'error');
                }
                const modal = form.closest("div[style*=\"fixed\"]"); if(modal) modal.remove();
            }

            showDeliveryForm() {
                const productOptions = this.demoData.products.filter(p => p.stock > 0).map(p => 
                    `<option value="${p.id}">${p.name} - Tồn kho: ${p.stock}</option>`
                ).join('');

                const customerOptions = this.demoData.customers.map(c =>
                    `<option value="${c.id}">${c.name}</option>`
                ).join('');

                const formHTML = `
                    <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1001; display: flex; justify-content: center; align-items: center;" onclick="closeModal(this)">
                        <div style="background: white; padding: 32px; border-radius: 12px; width: 550px; max-width: 90vw; max-height: 90vh; overflow-y: auto;" onclick="event.stopPropagation()">
                            <h3 style="margin-bottom: 24px; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
                                <span>🚚</span> Giao hàng
                            </h3>
                            <form onsubmit="app.processDelivery(event)">
                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Sản phẩm: <span style="color: #ef4444;">*</span></label>
                                    <select name="product" required style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                        <option value="">Chọn sản phẩm</option>
                                        ${productOptions}
                                    </select>
                                </div>

                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Khách hàng nhận: <span style="color: #ef4444;">*</span></label>
                                    <select name="customer" required style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                        <option value="">Chọn khách hàng</option>
                                        ${customerOptions}
                                    </select>
                                </div>

                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Số lượng giao: <span style="color: #ef4444;">*</span></label>
                                    <input type="number" name="quantity" required min="1" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;" oninput="app.updateDeliveryQtyInput(this)">
                                    <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">Tồn kho hiện tại sẽ được kiểm tra</div>
                                </div>

                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Phương tiện giao:</label>
                                    <select name="deliveryMethod" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                        <option value="Xe máy">Xe máy</option>
                                        <option value="Ô tô">Ô tô</option>
                                        <option value="Giao hàng nhanh">Giao hàng nhanh</option>
                                        <option value="Khác">Khác</option>
                                    </select>
                                </div>

                                <div style="margin-bottom: 24px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Ghi chú:</label>
                                    <textarea name="notes" rows="2" placeholder="VD: Giao vào lúc sáng, liên hệ trước..." style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; resize: vertical;"></textarea>
                                </div>

                                <div style="background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 12px; border-radius: 6px; margin-bottom: 20px; font-size: 14px;">
                                    <strong>💡 Lưu ý:</strong> Giao hàng sẽ tự động cập nhật tồn kho và theo dõi trong lịch sử kho.
                                </div>

                                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                                    <button type="button" onclick="closeModal(this.closest('div[style*=fixed]'))" 
                                            style="padding: 12px 24px; border: 2px solid #e5e7eb; background: white; border-radius: 8px; cursor: pointer; font-weight: 600;">Hủy</button>
                                    <button type="submit" 
                                            style="padding: 12px 24px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">✓ Xác nhận giao</button>
                                </div>
                            </form>
                        </div>
                    </div>
                `;
                document.body.insertAdjacentHTML('beforeend', formHTML);
            }

            updateDeliveryQtyInput(input) {
                const quantity = parseInt(input.value);
                const minQty = parseInt(input.min) || 0;
                const maxQty = parseInt(input.max);

                if (!isNaN(quantity) && quantity < minQty) {
                    input.value = minQty;
                }

                if (!isNaN(quantity) && !Number.isNaN(maxQty) && quantity > maxQty) {
                    input.value = maxQty;
                }
            }

            processDelivery(event) {
                event.preventDefault();
                const form = event.target;
                const formData = new FormData(form);

                const productId = formData.get('product');
                const customerId = formData.get('customer');
                const quantity = parseInt(formData.get('quantity'));
                const deliveryMethod = formData.get('deliveryMethod');
                const notes = formData.get('notes');

                const product = this.demoData.products.find(p => p.id === productId);
                const customer = this.demoData.customers.find(c => c.id === customerId);

                if (!product || !customer) {
                    this.showNotification('Vui lòng chọn sản phẩm và khách hàng', 'error');
                    return;
                }

                if (product.stock < quantity) {
                    this.showNotification(`❌ Không đủ hàng. Tồn kho hiện tại: ${product.stock}, yêu cầu: ${quantity}`, 'error');
                    return;
                }

                // Process the delivery
                const oldStock = product.stock;
                product.stock -= quantity;

                // Add to inventory history with delivery type
                this.addInventoryHistory({
                    type: 'delivery',
                    productId: product.id,
                    productName: product.name,
                    quantity: quantity,
                    oldStock: oldStock,
                    newStock: product.stock,
                    date: this.getVietnamTime().toISOString().split('T')[0],
                    time: this.formatTimeNow(),
                    reason: `Giao hàng cho ${customer.name}`,
                    deliveryMethod: deliveryMethod,
                    customerId: customer.id,
                    customerName: customer.name,
                    notes: notes
                });

                // Save to localStorage
                this.saveToLocalStorage();
                console.log('DEBUG delivery saved:', {
                    productId: product.id,
                    productName: product.name,
                    customerId: customer.id,
                    customerName: customer.name,
                    quantity,
                    oldStock,
                    newStock: product.stock,
                    deliveryMethod,
                    notes,
                    latestHistory: this.demoData.inventoryHistory ? this.demoData.inventoryHistory[0] : null
                });

                // Show success notification
                this.showNotification(
                    `✅ Giao hàng thành công!\\n` +
                    `📦 Sản phẩm: ${product.name}\\n` +
                    `👤 Khách: ${customer.name}\\n` +
                    `📊 Lượng: ${quantity} (Tồn kho còn: ${product.stock})\\n` +
                    `🚚 Phương tiện: ${deliveryMethod}`,
                    'success'
                );

                // Reload inventory page
                this.loadPage('inventory');

                // Close modal
                const modal = form.closest("div[style*=\"fixed\"]");
                if (modal) modal.remove();
            }

            processOrderDelivery(event) {
                event.preventDefault();
                const form = event.target;
                const formData = new FormData(form);

                const orderIndex = parseInt(formData.get('orderIndex'));
                const order = this.demoData.orders[orderIndex];
                if (!order) {
                    this.showNotification('Không tìm thấy đơn hàng', 'error');
                    return;
                }

                const customerId = formData.get('customer');
                const deliveryMethod = formData.get('deliveryMethod');
                const notes = formData.get('notes');
                const productIds = formData.getAll('productId[]');
                const productNames = formData.getAll('productName[]');
                const deliverQtys = formData.getAll('deliverQty[]').map(v => parseInt(v) || 0);
                const remainingQtys = formData.getAll('remainingQty[]').map(v => parseInt(v) || 0);
                const itemIndexes = formData.getAll('itemIndex[]').map(v => parseInt(v));

                const customer = this.demoData.customers.find(c => c.id === customerId);
                if (!customer) {
                    this.showNotification('Vui lòng chọn khách hàng', 'error');
                    return;
                }

                const deliveries = [];
                let totalDelivered = 0;

                for (let i = 0; i < productIds.length; i += 1) {
                    const qty = deliverQtys[i];
                    const remainingQty = remainingQtys[i];
                    const itemIndex = itemIndexes[i];
                    if (qty > 0) {
                        if (qty > remainingQty) {
                            this.showNotification(`Số lượng giao không thể lớn hơn còn lại của sản phẩm ${productNames[i]}`, 'error');
                            return;
                        }

                        const product = this.demoData.products.find(p => p.id === productIds[i]);
                        if (!product) {
                            this.showNotification(`Không tìm thấy sản phẩm ${productNames[i]}`, 'error');
                            return;
                        }

                        if (product.stock < qty) {
                            this.showNotification(`Không đủ hàng ${product.name}. Tồn kho: ${product.stock}`, 'error');
                            return;
                        }

                        deliveries.push({
                            product,
                            name: productNames[i],
                            qty,
                            oldStock: product.stock,
                            itemIndex
                        });
                        totalDelivered += qty;
                    }
                }

                if (deliveries.length === 0) {
                    this.showNotification('Vui lòng nhập số lượng giao cho ít nhất một sản phẩm', 'error');
                    return;
                }

                deliveries.forEach(delivery => {
                    const { product, qty, oldStock, itemIndex } = delivery;
                    order.products[itemIndex].deliveredQty = (order.products[itemIndex].deliveredQty || 0) + qty;
                    product.soldQty = (product.soldQty || 0) + qty;

                    this.addInventoryHistory({
                        type: 'delivery',
                        productId: product.id,
                        productName: product.name,
                        quantity: qty,
                        oldStock: oldStock,
                        newStock: product.stock - qty,
                        date: this.getVietnamTime().toISOString().split('T')[0],
                        time: this.formatTimeNow(),
                        reason: `Giao hàng đơn ${order.id}`,
                        deliveryMethod: deliveryMethod,
                        customerId: customer.id,
                        customerName: customer.name,
                        notes: notes
                    });

                    // Trừ tồn kho khi giao hàng thực tế
                    product.stock -= qty;
                });

                const allDelivered = (order.products || []).every(item => (item.deliveredQty || 0) >= item.quantity);
                order.status = allDelivered ? 'Đã giao' : 'Đang giao';
                order.deliveryMethod = deliveryMethod;
                order.deliveryNotes = notes;
                order.customerId = customer.id;
                order.customerName = customer.name;

                this.saveToLocalStorage();
                console.log('DEBUG order delivery saved:', {
                    orderId: order.id,
                    status: order.status,
                    deliveryMethod,
                    notes,
                    totalDelivered,
                    products: order.products.map(item => ({ id: item.id, quantity: item.quantity, deliveredQty: item.deliveredQty })),
                    latestHistory: this.demoData.inventoryHistory ? this.demoData.inventoryHistory[0] : null
                });

                this.showNotification(
                    `✅ Giao hàng thành công cho đơn ${order.id}!\n` +
                    `Tổng số lượng: ${totalDelivered} sản phẩm.\n` +
                    `Trạng thái đơn: ${order.status}`,
                    'success'
                );

                this.loadPage('orders');
                const modal = form.closest("div[style*=\"fixed\"]");
                if (modal) modal.remove();
            }

            showDeliveryFormForOrder(orderIndex) {
                const order = this.demoData.orders[orderIndex];
                if (!order) {
                    this.showNotification('Không tìm thấy đơn hàng', 'error');
                    return;
                }

                const customerOptions = this.demoData.customers.map(c => {
                    const selected = c.id === order.customerId ? 'selected' : '';
                    return `<option value="${c.id}" ${selected}>${c.name}</option>`;
                }).join('');

                const orderItemsHTML = (order.products || []).map((item, itemIndex) => {
                    const product = this.demoData.products.find(p => p.id === item.id);
                    const stock = product ? product.stock : 0;
                    const deliveredQty = item.deliveredQty || 0;
                    const remainingOrderQty = Math.max(item.quantity - deliveredQty, 0);
                    const maxDeliverQty = Math.min(remainingOrderQty, stock);

                    return `
                        <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 1fr; gap: 8px; align-items: center; padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                            <div>
                                <div style="font-weight: 600; color: #111827;">${item.name}</div>
                                <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">Đặt: ${item.quantity} | Đã giao: ${deliveredQty} | Còn: ${remainingOrderQty}</div>
                                <div style="font-size: 12px; color: #6b7280;">Tồn kho: ${stock}</div>
                            </div>
                            <div style="text-align: center;">${item.quantity}</div>
                            <div style="text-align: center;">${deliveredQty}</div>
                            <div style="text-align: center;">${stock}</div>
                            <div style="display: flex; gap: 8px; align-items: center; justify-content: center;">
                                <input type="number" name="deliverQty[]" min="0" max="${maxDeliverQty}" value="0" style="width: 100%; padding: 8px; border: 2px solid #e5e7eb; border-radius: 6px;" oninput="app.updateDeliveryQtyInput(this)" ${maxDeliverQty === 0 ? 'readonly' : ''}>
                                <input type="hidden" name="productId[]" value="${item.id}">
                                <input type="hidden" name="productName[]" value="${item.name}">
                                <input type="hidden" name="remainingQty[]" value="${remainingOrderQty}">
                                <input type="hidden" name="itemIndex[]" value="${itemIndex}">
                            </div>
                        </div>
                    `;
                }).join('');

                const selectedDeliveryMethod = order.deliveryMethod || '';
                const deliveryMethodOptions = ['Xe máy', 'Ô tô', 'Giao hàng nhanh', 'Khác'];
                const deliveryMethodOptionsHTML = deliveryMethodOptions.map(method => `
                        <option value="${method}" ${method === selectedDeliveryMethod ? 'selected' : ''}>${method}</option>
                    `).join('');

                const orderDeliveryNotes = order.deliveryNotes || '';

                const formHTML = `
                    <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1001; display: flex; justify-content: center; align-items: center;" onclick="closeModal(this)">
                        <div style="background: white; padding: 32px; border-radius: 12px; width: 900px; max-width: 95vw; max-height: 90vh; overflow-y: auto;" onclick="event.stopPropagation()">
                            <h3 style="margin-bottom: 24px; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
                                <span>🚚</span> Giao hàng từ đơn ${order.id}
                            </h3>
                            <form onsubmit="app.processOrderDelivery(event)">
                                <input type="hidden" name="orderIndex" value="${orderIndex}">
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
                                    <div style="background: #f3f4f6; padding: 16px; border-radius: 12px;">
                                        <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">Đơn hàng</div>
                                        <div style="font-weight: 700; color: #111827;">${order.id}</div>
                                        <div style="font-size: 14px; color: #374151;">${order.customerName}</div>
                                        <div style="font-size: 12px; color: #6b7280;">Ngày: ${order.date} ${order.time}</div>
                                        <div style="font-size: 12px; color: #6b7280;">Trạng thái: ${order.status || 'Chờ giao'}</div>
                                    </div>
                                    <div style="background: #f3f4f6; padding: 16px; border-radius: 12px;">
                                        <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">Khách hàng</div>
                                        <select name="customer" required style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; background: white;">
                                            ${customerOptions}
                                        </select>
                                        <div style="margin-top: 12px;">
                                            <label style="display: block; margin-bottom: 8px; font-weight: 600;">Phương tiện giao:</label>
                                            <select name="deliveryMethod" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                                ${deliveryMethodOptionsHTML}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                <div style="background: #f8fafc; padding: 16px; border-radius: 12px; margin-bottom: 16px;">
                                    <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 1fr; gap: 8px; font-weight: 700; color: #374151; margin-bottom: 12px;">
                                        <div>Sản phẩm</div>
                                        <div style="text-align: center;">Đặt</div>
                                        <div style="text-align: center;">Đã giao</div>
                                        <div style="text-align: center;">Tồn kho</div>
                                        <div style="text-align: center;">Giao</div>
                                    </div>
                                    ${orderItemsHTML}
                                </div>
                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Ghi chú giao hàng:</label>
                                    <textarea name="notes" rows="2" placeholder="Ghi chú vận chuyển hoặc lưu ý..." style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; resize: vertical;">${orderDeliveryNotes}</textarea>
                                </div>
                                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                                    <button type="button" onclick="closeModal(this.closest('div[style*=fixed]'))" style="padding: 12px 24px; border: 2px solid #e5e7eb; background: white; border-radius: 8px; cursor: pointer;">Hủy</button>
                                    <button type="submit" style="padding: 12px 24px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; border-radius: 8px; cursor: pointer;">✓ Xác nhận giao</button>
                                </div>
                            </form>
                        </div>
                    </div>
                `;
                document.body.insertAdjacentHTML('beforeend', formHTML);
            }

            exportInventoryReport(mode = null) {
                this.showInventoryExportWithFilter();
            }

            // Bộ lọc lịch sử kho hàng
            filterInventoryHistory() {
                const filterType = document.getElementById('filter-type')?.value || '';
                const filterProduct = document.getElementById('filter-product')?.value || '';
                const filterFromDate = document.getElementById('filter-from-date')?.value || '';
                const filterToDate = document.getElementById('filter-to-date')?.value || '';

                let filtered = (this.demoData.inventoryHistory || []);

                // Lọc theo loại giao dịch
                if (filterType) {
                    filtered = filtered.filter(h => h.type === filterType);
                }

                // Lọc theo sản phẩm
                if (filterProduct) {
                    filtered = filtered.filter(h => h.productId === filterProduct);
                }

                // Lọc theo ngày từ
                if (filterFromDate) {
                    filtered = filtered.filter(h => h.date >= filterFromDate);
                }

                // Lọc theo ngày đến
                if (filterToDate) {
                    filtered = filtered.filter(h => h.date <= filterToDate);
                }

                // Hiển thị kết quả lọc
                const tableBody = document.getElementById('inventory-history-table');
                if (tableBody) {
                    if (filtered.length === 0) {
                        tableBody.innerHTML = `<tr><td colspan="7" style="padding: 40px; text-align: center; color: #9ca3af;">Không tìm thấy kết quả phù hợp với bộ lọc</td></tr>`;
                    } else {
                        tableBody.innerHTML = filtered.map((entry) => {
                            let typeEmoji, typeLabel, qtyColor;

                            if (entry.type === 'import') {
                                typeEmoji = '📥';
                                typeLabel = 'Nhập kho';
                                qtyColor = '#10b981';
                            } else if (entry.type === 'delivery') {
                                typeEmoji = '🚚';
                                typeLabel = 'Giao hàng';
                                qtyColor = '#3b82f6';
                            } else {
                                typeEmoji = '📤';
                                typeLabel = 'Xuất kho';
                                qtyColor = '#ef4444';
                            }

                            const qtyChange = (entry.type === 'import') ? `+${entry.quantity}` : `-${entry.quantity}`;
                            const reasonText = entry.type === 'delivery' 
                                ? `${entry.reason} (${entry.deliveryMethod})`
                                : entry.reason;

                            return `
                                <tr style="border-bottom: 1px solid #e5e7eb;">
                                    <td style="padding: 12px; font-weight: 600; color: var(--text-primary);">${entry.id}</td>
                                    <td style="padding: 12px;">
                                        <span style="font-weight: 600; display: flex; align-items: center; gap: 6px;">
                                            <span>${typeEmoji}</span>
                                            <span>${typeLabel}</span>
                                        </span>
                                    </td>
                                    <td style="padding: 12px; color: var(--text-secondary);">${entry.productName}</td>
                                    <td style="padding: 12px; text-align: right; font-weight: 600; color: ${qtyColor};">${qtyChange}</td>
                                    <td style="padding: 12px; text-align: right; color: var(--text-secondary);">${entry.oldStock} → ${entry.newStock}</td>
                                    <td style="padding: 12px; color: var(--text-secondary);">${reasonText}</td>
                                    <td style="padding: 12px; color: var(--text-secondary); white-space: nowrap;">${entry.date} ${entry.time}</td>
                                </tr>
                            `;
                        }).join('');
                    }
                }

                this.showNotification(`Lọc kết quả: ${filtered.length} mục`, 'info');
            }

            resetInventoryHistoryFilter() {
                document.getElementById('filter-type').value = '';
                document.getElementById('filter-product').value = '';
                document.getElementById('filter-from-date').value = '';
                document.getElementById('filter-to-date').value = '';
                this.filterInventoryHistory();
                this.showNotification('Đã đặt lại bộ lọc', 'success');
            }

            exportInventoryHistoryReport() {
                const historyData = this.demoData.inventoryHistory || [];
                const fileName = `lich-su-kho-hang-${this.getVietnamTime().toISOString().split('T')[0]}.csv`;

                // Tạo CSV
                let csv = 'ID,Loại,Sản phẩm,Số lượng,Tồn kho từ,Tồn kho đến,Lý do,Khách hàng,Phương tiện,Ngày,Giờ\n';

                historyData.forEach(entry => {
                    let type;
                    if (entry.type === 'import') {
                        type = 'Nhập kho';
                    } else if (entry.type === 'delivery') {
                        type = 'Giao hàng';
                    } else {
                        type = 'Xuất kho';
                    }

                    const qty = (entry.type === 'import') ? `+${entry.quantity}` : `-${entry.quantity}`;
                    const customer = entry.customerName || '';
                    const deliveryMethod = entry.deliveryMethod || '';

                    csv += `"${entry.id}","${type}","${entry.productName}","${qty}","${entry.oldStock}","${entry.newStock}","${entry.reason}","${customer}","${deliveryMethod}","${entry.date}","${entry.time}"\n`;
                });

                // Tạo blob và download
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = fileName;
                link.click();

                this.showNotification(`Đã xuất báo cáo: ${fileName}`, 'success');
            }

            exportSalesReport(mode = null) {
                this.showSalesExportWithFilter();
            }

            exportPurchaseReport(mode = null) {
                if (!mode) {
                    this.showExportOptions('Xuất báo cáo chi phí mua hàng', 'purchases', 'exportPurchaseReport');
                    return;
                }

                // Tạo dữ liệu mua hàng mẫu
                const purchaseData = [
                    { id: 'PH001', supplier: 'Công ty ABC', date: '2024-01-15', products: 'Điện thoại, Tai nghe', total: 15000000, status: 'Hoàn thành' },
                    { id: 'PH002', supplier: 'Nhà cung cấp XYZ', date: '2024-01-10', products: 'Laptop, Chuột', total: 25000000, status: 'Đang xử lý' },
                    { id: 'PH003', supplier: 'Công ty DEF', date: '2024-01-05', products: 'Máy tính bảng', total: 8000000, status: 'Hoàn thành' }
                ];

                if (mode === 'view') {
                    const columns = [
                        { header: 'Mã PH', getValue: purchase => purchase.id },
                        { header: 'Nhà cung cấp', getValue: purchase => purchase.supplier },
                        { header: 'Ngày', getValue: purchase => purchase.date },
                        { header: 'Sản phẩm', getValue: purchase => purchase.products },
                        { header: 'Tổng tiền (VNĐ)', getValue: purchase => purchase.total.toLocaleString('vi-VN') },
                        { header: 'Trạng thái', getValue: purchase => purchase.status }
                    ];
                    this.showDataViewer('Báo cáo chi phí mua hàng', purchaseData, columns);
                } else if (mode === 'download') {
                    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + 
                        "Mã PH,Nhà cung cấp,Ngày,Sản phẩm,Tổng tiền,Trạng thái\n" +
                        purchaseData.map(p => 
                            `${p.id},"${p.supplier}","${p.date}","${p.products}",${p.total},"${p.status}"`
                        ).join('\n');

                    const encodedUri = encodeURI(csvContent);
                    const link = document.createElement("a");
                    link.setAttribute("href", encodedUri);
                    link.setAttribute("download", `mua_hang_${this.getVietnamTime().toISOString().split('T')[0]}.csv`);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);

                    this.showNotification('Đã tải xuống báo cáo chi phí mua hàng', 'success');
                }
            }

            exportSuppliers(mode = null) {
                if (!mode) {
                    this.showExportOptions('Xuất dữ liệu nhà cung cấp', 'suppliers', 'exportSuppliers');
                    return;
                }

                if (mode === 'view') {
                    const columns = [
                        { header: 'Mã NCC', getValue: supplier => supplier.id },
                        { header: 'Tên nhà cung cấp', getValue: supplier => supplier.name },
                        { header: 'Điện thoại', getValue: supplier => supplier.phone || 'N/A' },
                        { header: 'Email', getValue: supplier => supplier.email || 'N/A' },
                        { header: 'Địa chỉ', getValue: supplier => supplier.address || 'N/A' },
                        { header: 'Sản phẩm cung cấp', getValue: supplier => supplier.products || 'N/A' }
                    ];
                    this.showDataViewer('Danh sách nhà cung cấp', this.demoData.suppliers, columns);
                } else if (mode === 'download') {
                    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + 
                        "Mã NCC,Tên nhà cung cấp,Điện thoại,Email,Địa chỉ,Sản phẩm cung cấp\n" +
                        this.demoData.suppliers.map(s => 
                            `${s.id},"${s.name}","${s.phone || ''}","${s.email || ''}","${s.address || ''}","${s.products || ''}"`
                        ).join('\n');

                    const encodedUri = encodeURI(csvContent);
                    const link = document.createElement("a");
                    link.setAttribute("href", encodedUri);
                    link.setAttribute("download", `nha_cung_cap_${this.getVietnamTime().toISOString().split('T')[0]}.csv`);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);

                    this.showNotification('Đã tải xuống danh sách nhà cung cấp', 'success');
                }
            }

            exportProducts(mode = null) {
                if (!mode) {
                    this.showExportOptions('Xuất dữ liệu sản phẩm', 'products', 'exportProducts');
                    return;
                }

                if (mode === 'view') {
                    const columns = [
                        { header: 'Mã SP', getValue: product => product.id },
                        { header: 'Tên sản phẩm', getValue: product => product.name },
                        { header: 'Danh mục', getValue: product => product.category },
                        { header: 'Giá bán (VNĐ)', getValue: product => product.price.toLocaleString('vi-VN') },
                        { header: 'Giá vốn (VNĐ)', getValue: product => (product.importPrice || 0).toLocaleString('vi-VN') },
                        { header: 'Tồn kho', getValue: product => product.stock },
                        { header: 'Nhà cung cấp', getValue: product => product.supplier || 'N/A' }
                    ];
                    this.showDataViewer('Danh sách sản phẩm', this.demoData.products, columns);
                } else if (mode === 'download') {
                    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + 
                        "Mã SP,Tên sản phẩm,Danh mục,Giá bán,Giá vốn,Tồn kho,Nhà cung cấp\n" +
                        this.demoData.products.map(p => 
                            `${p.id},"${p.name}","${p.category}",${p.price},${p.importPrice || 0},${p.stock},"${p.supplier || ''}"`
                        ).join('\n');

                    const encodedUri = encodeURI(csvContent);
                    const link = document.createElement("a");
                    link.setAttribute("href", encodedUri);
                    link.setAttribute("download", `san_pham_${this.getVietnamTime().toISOString().split('T')[0]}.csv`);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);

                    this.showNotification('Đã tải xuống danh sách sản phẩm', 'success');
                }
            }

            exportCategoriesData(mode = null) {
                if (!mode) {
                    this.showExportOptions('Xuất dữ liệu danh mục', 'categories', 'exportCategoriesData');
                    return;
                }

                if (mode === 'view') {
                    const columns = [
                        { header: 'Mã danh mục', getValue: category => category.id },
                        { header: 'Tên danh mục', getValue: category => category.name },
                        { header: 'Danh mục cha', getValue: category => {
                            if (!category.parent) return 'Danh mục gốc';
                            const parent = this.demoData.categories.find(c => c.id === category.parent);
                            return parent ? parent.name : 'N/A';
                        }},
                        { header: 'Số sản phẩm', getValue: category => {
                            const fullCategoryName = category.parent ? 
                                this.demoData.categories.find(c => c.id === category.parent)?.name + ' > ' + category.name :
                                category.name;
                            return this.demoData.products.filter(p => p.category === fullCategoryName || p.category === category.name).length;
                        }}
                    ];
                    this.showDataViewer('Danh sách danh mục', this.demoData.categories, columns);
                } else if (mode === 'download') {
                    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + 
                        "Mã danh mục,Tên danh mục,Danh mục cha,Số sản phẩm\n" +
                        this.demoData.categories.map(c => {
                            const parentName = c.parent ? (this.demoData.categories.find(p => p.id === c.parent)?.name || 'N/A') : 'Danh mục gốc';
                            const fullCategoryName = c.parent ? 
                                this.demoData.categories.find(p => p.id === c.parent)?.name + ' > ' + c.name :
                                c.name;
                            const productCount = this.demoData.products.filter(p => p.category === fullCategoryName || p.category === c.name).length;
                            return `${c.id},"${c.name}","${parentName}",${productCount}`;
                        }).join('\n');

                    const encodedUri = encodeURI(csvContent);
                    const link = document.createElement("a");
                    link.setAttribute("href", encodedUri);
                    link.setAttribute("download", `danh_muc_${this.getVietnamTime().toISOString().split('T')[0]}.csv`);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);

                    this.showNotification('Đã tải xuống dữ liệu danh mục', 'success');
                }
            }

            showPromotionForm() {
                this.showNotification('Chức năng quản lý khuyến mãi - Coming soon!', 'info');
            }

            // Order Management Functions
            showCreateOrderForm() {
                // Create customer dropdown options
                const customerDropdownOptions = this.demoData.customers.map(c => 
                    `<div class="dropdown-option" data-value="${c.id}" onclick="app.selectCustomer(this, '${c.id}', '${c.name} - ${c.phone}')" 
                          style="padding: 10px; cursor: pointer; border-bottom: 1px solid #f3f4f6;" 
                          onmouseover="this.style.background='#f3f4f6'" onmouseout="this.style.background='white'">
                        ${c.name} - ${c.phone}
                    </div>`
                ).join('');

                // Enhance product dropdown options with inventory status
                const productDropdownOptions = this.demoData.products.map(p => {
                    let statusEmoji = '✅';
                    let statusColor = '#10b981';
                    if (p.stock < p.minStock) {
                        statusEmoji = '❌';
                        statusColor = '#ef4444';
                    } else if (p.stock < p.minStock * 2) {
                        statusEmoji = '⚠️';
                        statusColor = '#f59e0b';
                    }

                    return `<div class="dropdown-option" data-value="${p.id}" data-price="${p.price}" data-stock="${p.stock}" 
                          onclick="app.selectProduct(this, '${p.id}', '${p.name} - ${p.price.toLocaleString('vi-VN')} VNĐ', ${p.price})" 
                          style="padding: 12px; cursor: pointer; border-bottom: 1px solid #f3f4f6; display: flex; justify-content: space-between; align-items: center;" 
                          onmouseover="this.style.background='#f3f4f6'" onmouseout="this.style.background='white'">
                        <span>${p.name} - ${p.price.toLocaleString('vi-VN')} VNĐ</span>
                        <span style="display: flex; align-items: center; gap: 6px; font-size: 12px;">
                            <span>${statusEmoji}</span>
                            <span style="color: ${statusColor}; font-weight: 600;">${p.stock}</span>
                        </span>
                    </div>`;
                }).join('');

                const formHTML = `
                    <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1001; display: flex; justify-content: center; align-items: center;" onclick="closeModal(this)">
                        <div style="background: white; padding: 32px; border-radius: 12px; width: 900px; max-width: 90vw;" onclick="event.stopPropagation()">
                            <h3 style="margin-bottom: 24px; color: var(--text-primary);">🆕 Tạo đơn hàng mới </h3>
                            <form onsubmit="app.createOrder(event)">
                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Khách hàng:</label>
                                    <div style="display: flex; gap: 8px; align-items: flex-end;">
                                        <div style="flex: 1; position: relative;">
                                            <div class="custom-dropdown" style="position: relative;">
                                                <div class="dropdown-selected" onclick="app.toggleCustomerDropdown(this)" 
                                                     style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; background: white; cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
                                                    <span class="selected-text" style="color: #9ca3af;">Chọn khách hàng</span>
                                                    <span class="dropdown-arrow" style="transform: rotate(0deg); transition: transform 0.3s;">▼</span>
                                                </div>
                                                <div class="dropdown-list" style="position: absolute; top: 100%; left: 0; right: 0; background: white; border: 2px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; max-height: 250px; overflow-y: auto; z-index: 1000; display: none;">
                                                    <div style="padding: 8px; border-bottom: 1px solid #e5e7eb;">
                                                        <input type="text" class="dropdown-search" placeholder="🔍 Tìm khách hàng..." 
                                                               style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 14px;" 
                                                               oninput="app.filterDropdownItems(this, 'customer')" 
                                                               onclick="event.stopPropagation()">
                                                    </div>
                                                    <div class="dropdown-options">
                                                        ${customerDropdownOptions}
                                                    </div>
                                                </div>
                                                <input type="hidden" name="customer" id="customer-select" required>
                                            </div>
                                        </div>
                                        <button type="button" onclick="app.showQuickAddCustomer()" 
                                                style="background: var(--primary-green); color: white; border: none; padding: 12px 16px; border-radius: 8px; cursor: pointer; white-space: nowrap; font-weight: 600;">
                                            + Thêm KH mới
                                        </button>
                                    </div>
                                </div>

                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Sản phẩm:</label>

                                    <!-- Header row -->
                                    <div style="display: flex; gap: 8px; margin-bottom: 8px; padding: 8px; background: #f8fafc; border-radius: 6px; font-weight: 600; font-size: 12px; color: #374151;">
                                        <div style="flex: 2;">Tên sản phẩm</div>
                                        <div style="width: 80px; text-align: center;">Số lượng</div>
                                        <div style="width: 120px; text-align: center;">Đơn giá</div>
                                        <div style="width: 160px; text-align: center;">Chiết khấu</div>
                                        <div style="width: 120px; text-align: center;">Thành tiền</div>
                                        <div style="width: 60px; text-align: center;">Thao tác</div>
                                    </div>

                                    <div id="product-list">
                                        <div class="product-row" style="display: flex; gap: 8px; margin-bottom: 8px; align-items: center;">
                                            <div class="custom-dropdown" style="flex: 2; position: relative;">
                                                <div class="dropdown-selected" onclick="app.toggleProductDropdown(this)" 
                                                     style="width: 100%; padding: 8px; border: 2px solid #e5e7eb; border-radius: 6px; background: white; cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
                                                    <span class="selected-text" style="color: #9ca3af;">Chọn sản phẩm</span>
                                                    <span class="dropdown-arrow" style="transform: rotate(0deg); transition: transform 0.3s;">▼</span>
                                                </div>
                                                <div class="dropdown-list" style="position: absolute; top: 100%; left: 0; right: 0; background: white; border: 2px solid #e5e7eb; border-top: none; border-radius: 0 0 6px 6px; max-height: 200px; overflow-y: auto; z-index: 1000; display: none;">
                                                    <div style="padding: 6px; border-bottom: 1px solid #e5e7eb;">
                                                        <input type="text" class="dropdown-search" placeholder="🔍 Tìm sản phẩm..." 
                                                               style="width: 100%; padding: 6px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 13px;" 
                                                               oninput="app.filterDropdownItems(this, 'product')" 
                                                               onclick="event.stopPropagation()">
                                                    </div>
                                                    <div class="dropdown-options">
                                                        ${productDropdownOptions}
                                                    </div>
                                                </div>
                                                <input type="hidden" name="product[]">
                                            </div>
                                            <input type="number" name="quantity[]" placeholder="SL" min="1" value="1" style="width: 80px; padding: 8px; border: 2px solid #e5e7eb; border-radius: 6px;" onchange="app.calculateRowTotal(this)">
                                            <input type="number" name="price[]" placeholder="Đơn giá" style="width: 120px; padding: 8px; border: 2px solid #e5e7eb; border-radius: 6px; background: #fff3cd; cursor: pointer;" title="Click để sửa giá" onchange="app.calculateRowTotal(this)">
                                            <div style="display: flex; gap: 4px; width: 160px;">
                                                <input type="number" name="discount[]" placeholder="0" min="0" value="0" style="width: 80px; padding: 8px; border: 2px solid #e5e7eb; border-radius: 6px;" oninput="app.calculateRowTotal(this)">
                                                <select name="discountType[]" style="width: 72px; padding: 6px 2px; border: 2px solid #e5e7eb; border-radius: 6px; font-size: 12px; cursor: pointer;" onchange="app.calculateRowTotal(this)">
                                                    <option value="percent">%</option>
                                                    <option value="amount">VNĐ</option>
                                                </select>
                                            </div>
                                            <input type="text" name="subtotal[]" placeholder="Thành tiền" readonly style="width: 120px; padding: 8px; border: 2px solid #e5e7eb; border-radius: 6px; background: #f0f9ff; font-weight: 600; color: #1e40af;">
                                            <button type="button" onclick="app.removeProductRow(this)" style="background: #ef4444; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; width: 60px;">Xóa</button>
                                        </div>
                                    </div>
                                    <button type="button" onclick="app.addProductRow()" style="background: var(--primary-green); color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; margin-top: 8px;">+ Thêm sản phẩm</button>
                                </div>

                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Phương thức thanh toán:</label>
                                    <select name="paymentMethod" required style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                        <option value="Tiền mặt">Tiền mặt</option>
                                        <option value="Chuyển khoản">Chuyển khoản</option>
                                        <option value="Thẻ tín dụng">Thẻ tín dụng</option>
                                    </select>
                                </div>

                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Trạng thái thanh toán:</label>
                                    <select name="paymentStatus" required style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                        <option value="Công nợ">Công nợ</option>
                                        <option value="Đã thanh toán">Đã thanh toán</option>
                                    </select>
                                </div>

                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Phí vận chuyển phải thu khách hàng (VNĐ):</label>
                                    <input type="number" name="shippingFee" id="shippingFee" placeholder="0" min="0" value="0" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;" oninput="app.calculateOrderTotal()">
                                </div>

                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Chi phí phát sinh (VNĐ):</label>
                                    <input type="number" name="expense" placeholder="Ví dụ: phí ship, bốc xếp..." min="0" value="0" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                </div>

                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Ghi chú:</label>
                                    <textarea name="orderNotes" placeholder="Nhập ghi chú cho đơn hàng (không bắt buộc)" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; min-height: 80px; resize: vertical;"></textarea>
                                </div>

                                <div style="margin-bottom: 24px; padding: 16px; background: #f3f4f6; border-radius: 8px;">
                                    <div style="display: flex; justify-content: space-between; align-items: center;">
                                        <span style="font-weight: 600; font-size: 18px;">Tổng tiền:</span>
                                        <span id="order-total" style="font-weight: 700; font-size: 20px; color: var(--primary-blue);">0 VNĐ</span>
                                    </div>
                                </div>

                                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                                    <button type="button" onclick="closeModal(this.closest('div[style*=fixed]'))" 
                                            style="padding: 12px 24px; border: 2px solid #e5e7eb; background: white; border-radius: 8px; cursor: pointer;">Hủy</button>
                                    <button type="submit" 
                                            style="padding: 12px 24px; background: var(--primary-blue); color: white; border: none; border-radius: 8px; cursor: pointer;">Tạo đơn hàng</button>
                                </div>
                            </form>
                        </div>
                    </div>
                `;
                document.body.insertAdjacentHTML('beforeend', formHTML);

                // Add click outside listener to close dropdowns
                document.addEventListener('click', (event) => {
                    if (!event.target.closest('.custom-dropdown')) {
                        this.closeAllDropdowns();
                    }
                });
            }

            addProductRow() {
                // Create product dropdown options with inventory status
                const productDropdownOptions = this.demoData.products.map(p => {
                    let statusEmoji = '✅';
                    let statusColor = '#10b981';
                    if (p.stock < p.minStock) {
                        statusEmoji = '❌';
                        statusColor = '#ef4444';
                    } else if (p.stock < p.minStock * 2) {
                        statusEmoji = '⚠️';
                        statusColor = '#f59e0b';
                    }

                    return `<div class="dropdown-option" data-value="${p.id}" data-price="${p.price}" data-stock="${p.stock}" 
                          onclick="app.selectProduct(this, '${p.id}', '${p.name} - ${p.price.toLocaleString('vi-VN')} VNĐ', ${p.price})" 
                          style="padding: 12px; cursor: pointer; border-bottom: 1px solid #f3f4f6; display: flex; justify-content: space-between; align-items: center;" 
                          onmouseover="this.style.background='#f3f4f6'" onmouseout="this.style.background='white'">
                        <span>${p.name} - ${p.price.toLocaleString('vi-VN')} VNĐ</span>
                        <span style="display: flex; align-items: center; gap: 6px; font-size: 12px;">
                            <span>${statusEmoji}</span>
                            <span style="color: ${statusColor}; font-weight: 600;">${p.stock}</span>
                        </span>
                    </div>`;
                }).join('');

                const newRow = `
                    <div class="product-row" style="display: flex; gap: 8px; margin-bottom: 8px; align-items: center;">
                        <div class="custom-dropdown" style="flex: 2; position: relative;">
                            <div class="dropdown-selected" onclick="app.toggleProductDropdown(this)" 
                                 style="width: 100%; padding: 8px; border: 2px solid #e5e7eb; border-radius: 6px; background: white; cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
                                <span class="selected-text" style="color: #9ca3af;">Chọn sản phẩm</span>
                                <span class="dropdown-arrow" style="transform: rotate(0deg); transition: transform 0.3s;">▼</span>
                            </div>
                            <div class="dropdown-list" style="position: absolute; top: 100%; left: 0; right: 0; background: white; border: 2px solid #e5e7eb; border-top: none; border-radius: 0 0 6px 6px; max-height: 200px; overflow-y: auto; z-index: 1000; display: none;">
                                <div style="padding: 6px; border-bottom: 1px solid #e5e7eb;">
                                    <input type="text" class="dropdown-search" placeholder="🔍 Tìm sản phẩm..." 
                                           style="width: 100%; padding: 6px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 13px;" 
                                           oninput="app.filterDropdownItems(this, 'product')" 
                                           onclick="event.stopPropagation()">
                                </div>
                                <div class="dropdown-options">
                                    ${productDropdownOptions}
                                </div>
                            </div>
                            <input type="hidden" name="product[]">
                        </div>
                        <input type="number" name="quantity[]" placeholder="SL" min="1" value="1" style="width: 80px; padding: 8px; border: 2px solid #e5e7eb; border-radius: 6px;" onchange="app.calculateRowTotal(this)">
                        <input type="number" name="price[]" placeholder="Đơn giá" style="width: 120px; padding: 8px; border: 2px solid #e5e7eb; border-radius: 6px; background: #fff3cd; cursor: pointer;" title="Click để sửa giá" onchange="app.calculateRowTotal(this)">
                        <div style="display: flex; gap: 4px; width: 160px;">
                            <input type="number" name="discount[]" placeholder="0" min="0" value="0" style="width: 80px; padding: 8px; border: 2px solid #e5e7eb; border-radius: 6px;" oninput="app.calculateRowTotal(this)">
                            <select name="discountType[]" style="width: 72px; padding: 6px 2px; border: 2px solid #e5e7eb; border-radius: 6px; font-size: 12px; cursor: pointer;" onchange="app.calculateRowTotal(this)">
                                <option value="percent">%</option>
                                <option value="amount">VNĐ</option>
                            </select>
                        </div>
                        <input type="text" name="subtotal[]" placeholder="Thành tiền" readonly style="width: 120px; padding: 8px; border: 2px solid #e5e7eb; border-radius: 6px; background: #f0f9ff; font-weight: 600; color: #1e40af;">
                        <button type="button" onclick="app.removeProductRow(this)" style="background: #ef4444; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; width: 60px;">Xóa</button>
                    </div>
                `;
                document.getElementById('product-list').insertAdjacentHTML('beforeend', newRow);
            }

            removeProductRow(button) {
                button.closest('.product-row').remove();
                this.calculateOrderTotal();
            }

            updateProductRowPrice(selectElement) {
                const selectedOption = selectElement.options[selectElement.selectedIndex];
                const price = selectedOption.getAttribute('data-price') || 0;
                const row = selectElement.closest('.product-row');
                const priceInput = row.querySelector('input[name="price[]"]');
                priceInput.value = price;
                this.calculateRowTotal(row.querySelector('input[name="quantity[]"]'));
            }

            calculateRowTotal(element) {
                const row = element.closest('.product-row');
                if (!row) {
                    console.error('Không tìm thấy product-row');
                    return;
                }

                const quantityInput = row.querySelector('input[name="quantity[]"]');
                const priceInput = row.querySelector('input[name="price[]"]');
                const discountInput = row.querySelector('input[name="discount[]"]');
                const subtotalInput = row.querySelector('input[name="subtotal[]"]');

                if (!quantityInput || !priceInput || !discountInput || !subtotalInput) {
                    console.error('Không tìm thấy một số input field');
                    return;
                }

                const quantity = parseInt(quantityInput.value) || 0;
                const price = parseInt(priceInput.value) || 0;
                const discount = parseInt(discountInput.value) || 0;
                const discountTypeSelect = row.querySelector('select[name="discountType[]"]');
                const discountType = discountTypeSelect ? discountTypeSelect.value : 'percent';

                console.log('Tính toán:', {quantity, price, discount, discountType}); // Debug

                // Tính thành tiền sau giảm giá
                const beforeDiscount = quantity * price;
                let discountAmount = 0;
                if (discountType === 'percent') {
                    discountAmount = beforeDiscount * discount / 100;
                } else {
                    discountAmount = discount; // Giá trị tiền cố định
                }
                const subtotal = beforeDiscount - discountAmount;

                console.log('Kết quả:', {beforeDiscount, discountAmount, subtotal}); // Debug

                // Cập nhật thành tiền cho dòng này
                if (subtotal > 0) {
                    if (discount > 0) {
                        const discountLabel = discountType === 'percent' ? `-${discount}%` : `-${discount.toLocaleString('vi-VN')}đ`;
                        subtotalInput.value = `${subtotal.toLocaleString('vi-VN')} VNĐ (${discountLabel})`;
                    } else {
                        subtotalInput.value = `${subtotal.toLocaleString('vi-VN')} VNĐ`;
                    }
                } else {
                    subtotalInput.value = '';
                }

                // Tính lại tổng tiền
                this.calculateOrderTotal();
            }

            calculateOrderTotal() {
                const productRows = document.querySelectorAll('.product-row');
                let total = 0;

                productRows.forEach(row => {
                    const quantity = parseInt(row.querySelector('input[name="quantity[]"]').value) || 0;
                    const price = parseInt(row.querySelector('input[name="price[]"]').value) || 0;
                    const discount = parseInt(row.querySelector('input[name="discount[]"]').value) || 0;
                    const discountTypeSelect = row.querySelector('select[name="discountType[]"]');
                    const discountType = discountTypeSelect ? discountTypeSelect.value : 'percent';

                    // Tính thành tiền sau giảm giá cho từng dòng
                    const beforeDiscount = quantity * price;
                    let discountAmount = 0;
                    if (discountType === 'percent') {
                        discountAmount = beforeDiscount * discount / 100;
                    } else {
                        discountAmount = discount;
                    }
                    const subtotal = beforeDiscount - discountAmount;

                    total += subtotal;
                });

                const shippingFeeInput = document.getElementById('shippingFee');
                const shippingFee = shippingFeeInput ? (parseInt(shippingFeeInput.value) || 0) : 0;
                total += shippingFee;

                const totalElement = document.getElementById('order-total');
                if (totalElement) {
                    totalElement.textContent = total.toLocaleString('vi-VN') + ' VNĐ';
                } else {
                    console.error('Không tìm thấy element order-total');
                }
            }

            // Custom Dropdown Functions
            toggleCustomerDropdown(element) {
                const dropdown = element.closest('.custom-dropdown');
                const dropdownList = dropdown.querySelector('.dropdown-list');
                const arrow = dropdown.querySelector('.dropdown-arrow');

                // Close other dropdowns
                this.closeAllDropdowns();

                // Toggle current dropdown
                if (dropdownList.style.display === 'none' || !dropdownList.style.display) {
                    dropdownList.style.display = 'block';
                    arrow.style.transform = 'rotate(180deg)';

                    // Focus search input
                    const searchInput = dropdown.querySelector('.dropdown-search');
                    setTimeout(() => searchInput.focus(), 100);
                } else {
                    dropdownList.style.display = 'none';
                    arrow.style.transform = 'rotate(0deg)';
                }
            }

            toggleProductDropdown(element) {
                const dropdown = element.closest('.custom-dropdown');
                const dropdownList = dropdown.querySelector('.dropdown-list');
                const arrow = dropdown.querySelector('.dropdown-arrow');

                // Close other dropdowns
                this.closeAllDropdowns();

                // Toggle current dropdown
                if (dropdownList.style.display === 'none' || !dropdownList.style.display) {
                    dropdownList.style.display = 'block';
                    arrow.style.transform = 'rotate(180deg)';

                    // Focus search input
                    const searchInput = dropdown.querySelector('.dropdown-search');
                    setTimeout(() => searchInput.focus(), 100);
                } else {
                    dropdownList.style.display = 'none';
                    arrow.style.transform = 'rotate(0deg)';
                }
            }

            closeAllDropdowns() {
                const allDropdowns = document.querySelectorAll('.dropdown-list');
                const allArrows = document.querySelectorAll('.dropdown-arrow');

                allDropdowns.forEach(dropdown => {
                    dropdown.style.display = 'none';
                });

                allArrows.forEach(arrow => {
                    arrow.style.transform = 'rotate(0deg)';
                });
            }

            selectCustomer(element, customerId, customerName) {
                const dropdown = element.closest('.custom-dropdown');
                const selectedText = dropdown.querySelector('.selected-text');
                const hiddenInput = dropdown.querySelector('input[type="hidden"]');

                selectedText.textContent = customerName;
                selectedText.style.color = '#374151';
                hiddenInput.value = customerId;

                this.closeAllDropdowns();
            }

            selectProduct(element, productId, productName, price) {
                const dropdown = element.closest('.custom-dropdown');
                const selectedText = dropdown.querySelector('.selected-text');
                const hiddenInput = dropdown.querySelector('input[type="hidden"]');

                selectedText.textContent = productName;
                selectedText.style.color = '#374151';
                hiddenInput.value = productId;

                // Update price in the row - check both possible field names
                const productRow = dropdown.closest('.product-item, .product-row');
                let priceInput = productRow.querySelector('input[name="prices[]"]');
                if (!priceInput) {
                    priceInput = productRow.querySelector('input[name="price[]"]');
                }

                if (priceInput) {
                    priceInput.value = price;
                    // Call the appropriate calculation function
                    if (typeof this.calculateTotal === 'function') {
                        this.calculateTotal();
                    }
                    if (typeof this.calculateRowTotal === 'function') {
                        this.calculateRowTotal(priceInput);
                    }
                    if (typeof this.calculateOrderTotal === 'function') {
                        this.calculateOrderTotal();
                    }
                }

                this.closeAllDropdowns();

                // ✨ TỰ ĐỘNG THÊM DÒNG SẢN PHẨM MỚI
                // Check if this is the form "Tạo đơn hàng mới" (có product-list container)
                const productList = document.getElementById('product-list');
                if (productList) {
                    // Check if this is the last row without a selected product 
                    const allRows = productList.querySelectorAll('.product-row');
                    const currentRowIndex = Array.from(allRows).indexOf(productRow);
                    const isLastRow = currentRowIndex === allRows.length - 1;

                    // If this is the last row and a product is selected, add a new empty row
                    if (isLastRow) {
                        console.log('🚀 Auto-adding new product row after selection');
                        this.addProductRow();
                    }
                }
            }

            filterDropdownItems(searchInput, type) {
                const searchTerm = searchInput.value.toLowerCase();
                const dropdown = searchInput.closest('.custom-dropdown');
                const options = dropdown.querySelectorAll('.dropdown-option');

                options.forEach(option => {
                    const text = option.textContent.toLowerCase();
                    if (text.includes(searchTerm)) {
                        option.style.display = 'block';
                    } else {
                        option.style.display = 'none';
                    }
                });
            }

            createOrder(event) {
                event.preventDefault();
                const form = event.target;
                const formData = new FormData(form);

                const customer = this.demoData.customers.find(c => c.id === formData.get('customer'));
                if (!customer) {
                    this.showNotification('Vui lòng chọn khách hàng', 'error');
                    return;
                }

                const products = [];
                const productIds = formData.getAll('product[]');
                const quantities = formData.getAll('quantity[]');
                const prices = formData.getAll('price[]');
                const discounts = formData.getAll('discount[]');
                const discountTypes = formData.getAll('discountType[]');

                // Kiểm tra tồn kho trước khi tạo đơn hàng
                const stockWarnings = [];
                const outOfStockItems = [];

                for (let i = 0; i < productIds.length; i++) {
                    // Chỉ xử lý dòng đã chọn sản phẩm và có đầy đủ thông tin
                    if (productIds[i] && productIds[i].trim() !== '' && quantities[i] && prices[i]) {
                        const product = this.demoData.products.find(p => p.id === productIds[i]);
                        if (product) {
                            const requestedQty = parseInt(quantities[i]) || 1;

                            // Kiểm tra tồn kho
                            if (product.stock < requestedQty) {
                                outOfStockItems.push(`${product.name}: cần ${requestedQty}, chỉ còn ${product.stock}`);
                                continue; // Bỏ qua sản phẩm này
                            }

                            products.push({
                                id: productIds[i],
                                name: product.name,
                                quantity: requestedQty,
                                price: parseInt(prices[i]) || 0,
                                discount: parseInt(discounts[i]) || 0,
                                discountType: discountTypes[i] || 'percent',
                                deliveredQty: 0
                            });
                        }
                    }
                }

                // Thông báo lỗi nếu có sản phẩm hết hàng
                if (outOfStockItems.length > 0) {
                    this.showNotification(`Không đủ hàng: ${outOfStockItems.join(', ')}`, 'error');
                    return;
                }

                if (products.length === 0) {
                    this.showNotification('Vui lòng chọn ít nhất một sản phẩm', 'error');
                    return;
                }

                const total = products.reduce((sum, product) => {
                    const beforeDiscount = product.quantity * product.price;
                    let discountAmount = 0;
                    if (product.discountType === 'amount') {
                        discountAmount = product.discount;
                    } else {
                        discountAmount = beforeDiscount * product.discount / 100;
                    }
                    return sum + (beforeDiscount - discountAmount);
                }, 0);
                
                const shippingFee = parseInt(formData.get('shippingFee')) || 0;
                const finalTotal = total + shippingFee;
                // Sử dụng ngày giờ Việt Nam (UTC+7) cho đơn hàng mới  
                const vietnamTime = this.getVietnamTime();

                // Get payment status to determine order status
                const paymentStatus = formData.get('paymentStatus') || 'Công nợ';

                // Tạo ID đơn hàng dựa trên timestamp để đảm bảo thứ tự đúng
                const orderCount = this.demoData.orders.length;
                const newOrder = {
                    id: 'DH' + String(orderCount + 1).padStart(4, '0'),
                    customerId: customer.id,
                    customerName: customer.name,
                    date: vietnamTime.toISOString().split('T')[0],
                    time: vietnamTime.toTimeString().split(' ')[0].substring(0, 5),
                    products: products,
                    notes: formData.get('orderNotes') || '',
                    expense: parseInt(formData.get('expense')) || 0,
                    shippingFee: shippingFee,
                    total: finalTotal,
                    status: 'Chờ giao',
                    paymentMethod: formData.get('paymentMethod'),
                    paymentStatus: paymentStatus,
                    paymentHistory: [],
                    paidAmount: 0,
                    remainingBalance: paymentStatus === 'Đã thanh toán' ? 0 : finalTotal
                };

                // Kiểm tra cảnh báo tồn kho nếu hàng sắp hết, nhưng không trừ tồn kho cho đến khi giao hàng
                const lowStockAlerts = products.reduce((alerts, orderProduct) => {
                    const product = this.demoData.products.find(p => p.id === orderProduct.id);
                    if (product && product.stock <= product.minStock) {
                        alerts.push({
                            name: product.name,
                            current: product.stock,
                            minimum: product.minStock
                        });
                    }
                    return alerts;
                }, []);

                // THÊM ĐƠN HÀNG MỚI VÀO ĐẦU DANH SÁCH thay vì cuối
                this.demoData.orders.unshift(newOrder);
                console.log('✅ Đơn hàng mới được thêm vào ĐẦU danh sách:', newOrder.id);

                // Update customer debt if payment status is "Công nợ"
                if (paymentStatus === 'Công nợ') {
                    customer.debt += newOrder.total;
                    console.log(`Cập nhật công nợ khách hàng ${customer.name}: +${newOrder.total.toLocaleString('vi-VN')} VNĐ (${paymentStatus})`);
                } else if (paymentStatus === 'Đã thanh toán') {
                    this.recordOrderPayment(newOrder, customer, newOrder.total, {
                        id: `PAY_ORDER_${newOrder.id}_${Date.now()}`,
                        date: newOrder.date,
                        method: newOrder.paymentMethod,
                        notes: 'Thanh toán ngay khi tạo đơn hàng',
                        timestamp: newOrder.time,
                        remainingDebt: Number(customer.debt) || 0
                    });
                }

                this.saveToLocalStorage();

                // Ghi log hoạt động
                this.addActivityLog('success', '📋', `Tạo đơn hàng ${newOrder.id}`, 
                    `Khách hàng: ${customer.name} - Giá trị: ${total.toLocaleString('vi-VN')} VNĐ - ${products.length} sản phẩm - ${paymentStatus}`, 'order');

                // Ghi log hoạt động đơn hàng
                products.forEach(orderProduct => {
                    this.addActivityLog('info', '📦', `Đặt hàng`, 
                        `Sản phẩm: ${orderProduct.name} - Số lượng: ${orderProduct.quantity}`, 'order');
                });

                if (paymentStatus === 'Đã thanh toán') {
                    this.addActivityLog('success', '💳', `Thanh toán đơn hàng ${newOrder.id}`,
                        `Khách hàng: ${customer.name} - Đã thu: ${newOrder.total.toLocaleString('vi-VN')} VNĐ - ${newOrder.paymentMethod}`, 'payment');
                }

                // Hiển thị thông báo thành công
                let successMessage = `Đã tạo đơn hàng ${newOrder.id}`;

                // Hiển thị cảnh báo tồn kho thấp nếu có
                if (lowStockAlerts.length > 0) {
                    const alertMessages = lowStockAlerts.map(alert => 
                        `${alert.name}: còn ${alert.current}/${alert.minimum}`
                    ).join(', ');

                    setTimeout(() => {
                        this.showNotification(`⚠️ Cảnh báo tồn kho thấp: ${alertMessages}`, 'warning');
                    }, 1000);
                }

                this.showNotification(successMessage, 'success');
                this.loadPage('orders');
                const modal = form.closest("div[style*=\"fixed\"]"); if(modal) modal.remove();
            }

            viewOrderDetails(index) {
                console.log('🔍 FIXED viewOrderDetails v2.2 BOLD UPDATE - timestamp:', new Date().toISOString());
                const order = this.demoData.orders[index];
                if (!order) {
                    console.error('Order not found at index:', index);
                    return;
                }

                // Tìm khách hàng trực tiếp từ mảng customers - KHÔNG dùng getCustomerDetails
                let customer = null;

                // Tìm trong demoData trước - tìm theo ID hoặc tên
                for (let i = 0; i < this.demoData.customers.length; i++) {
                    if (this.demoData.customers[i].id === order.customerId || 
                        this.demoData.customers[i].name === order.customerId ||
                        this.demoData.customers[i].id === order.customerName ||
                        this.demoData.customers[i].name === order.customerName) {
                        customer = this.demoData.customers[i];
                        break;
                    }
                }

                // Nếu không tìm thấy, tìm trong localStorage
                if (!customer) {
                    try {
                        const savedCustomers = JSON.parse(localStorage.getItem('customers') || '[]');
                        for (let i = 0; i < savedCustomers.length; i++) {
                            if (savedCustomers[i].id === order.customerId || 
                                savedCustomers[i].name === order.customerId ||
                                savedCustomers[i].id === order.customerName ||
                                savedCustomers[i].name === order.customerName) {
                                customer = savedCustomers[i];
                                break;
                            }
                        }
                    } catch (e) {
                        console.log('Error reading localStorage customers:', e);
                    }
                }

                const customerDisplay = customer ? customer.name : order.customerName;
                console.log('🔍 Order:', order.id, 'customerId:', order.customerId, 'customerName:', order.customerName);
                console.log('🔍 Found customer:', customer);

                // Tạo thông tin doanh nghiệp nếu có
                let businessInfo = '';
                if (customer && customer.type === 'doanh-nghiep') {
                    let companyDetails = [];
                    if (customer.companyName) {
                        companyDetails.push(`<strong>Công ty:</strong> ${customer.companyName}`);
                    }
                    if (customer.department) {
                        companyDetails.push(`<strong>Phòng ban:</strong> ${customer.department}`);
                    }
                    if (customer.taxCode) {
                        companyDetails.push(`<strong>MST:</strong> ${customer.taxCode}`);
                    }

                    if (companyDetails.length > 0) {
                        businessInfo = `<div style="margin-top: 8px; font-size: 14px; color: #374151; line-height: 1.4;">
                            ${companyDetails.join(' • ')}
                        </div>`;
                    }
                }

                const productsList = order.products.map(p => {
                    const deliveredQty = p.deliveredQty || 0;
                    const remainingQty = Math.max(p.quantity - deliveredQty, 0);
                    return `
                        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                            <div>
                                <div style="font-weight: 600; color: #111827;">${p.name}</div>
                                <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">Đặt: ${p.quantity} | Đã giao: ${deliveredQty} | Còn lại: ${remainingQty}</div>
                            </div>
                            <div>${(p.quantity * p.price).toLocaleString('vi-VN')} VNĐ</div>
                        </div>`;
                }).join('');

                // Tính toán lợi nhuận
                let totalCost = 0;
                order.products.forEach(p => {
                    const productDetails = this.demoData.products.find(prod => prod.id === p.id);
                    const importPrice = productDetails ? (productDetails.importPrice || 0) : 0;
                    totalCost += importPrice * p.quantity;
                });
                const expense = order.expense || 0;
                const profit = order.total - totalCost - expense;

                const detailHTML = `
                    <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1001; display: flex; justify-content: center; align-items: center;" onclick="closeModal(this)">
                        <div style="background: white; padding: 32px; border-radius: 12px; width: 500px; max-width: 90vw;" onclick="event.stopPropagation()">
                            <h3 style="margin-bottom: 24px; color: var(--text-primary);">Chi tiết đơn hàng ${order.id}</h3>

                            <div style="margin-bottom: 16px;">
                                <strong>Khách hàng:</strong> ${customerDisplay}${businessInfo}<br>
                                <strong>Thời gian:</strong> ${order.date} ${order.time}<br>
                                <strong>Trạng thái:</strong> ${order.status}<br>
                                <strong>Thanh toán:</strong> ${order.paymentMethod}
                                ${order.shippingFee > 0 ? `<br><strong>Phí vận chuyển:</strong> ${order.shippingFee.toLocaleString('vi-VN')} VNĐ` : ''}
                                ${order.expense > 0 ? `<br><strong>Chi phí phát sinh:</strong> ${order.expense.toLocaleString('vi-VN')} VNĐ` : ''}
                                ${order.deliveryMethod ? `<br><strong>Phương tiện giao:</strong> ${order.deliveryMethod}` : ''}
                                ${order.deliveryNotes ? `<br><strong>Ghi chú giao:</strong> ${order.deliveryNotes}` : ''}
                                ${order.notes ? `<br><strong>Ghi chú:</strong> ${order.notes}` : ''}
                            </div>

                            <div style="margin-bottom: 16px;">
                                <strong>Sản phẩm:</strong>
                                <div style="margin-top: 8px; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px;">
                                    ${productsList}
                                    <div style="display: flex; justify-content: space-between; padding: 12px 0 0 0; font-weight: 600; font-size: 16px; border-top: 2px solid #e5e7eb; margin-top: 8px;">
                                        <span>Tổng cộng:</span>
                                        <span>${order.total.toLocaleString('vi-VN')} VNĐ</span>
                                    </div>
                                    <div style="font-size: 13px; color: #6b7280; margin-top: 8px;">
                                        Giá vốn: ${totalCost.toLocaleString('vi-VN')} VNĐ • Chi phí: ${expense.toLocaleString('vi-VN')} VNĐ • <span style="color: ${profit >= 0 ? '#10b981' : '#ef4444'}; font-weight: 600;">Lợi nhuận: ${profit.toLocaleString('vi-VN')} VNĐ</span>
                                    </div>
                                </div>
                            </div>

                            <div style="display: flex; gap: 12px; justify-content: center;">
                                <button onclick="closeModal(this.closest('div[style*=fixed]')); app.editOrder(${index});" 
                                        style="padding: 12px 24px; background: var(--primary-blue); color: white; border: none; border-radius: 8px; cursor: pointer;">✏️ Sửa</button>
                                <button onclick="closeModal(this.closest('div[style*=fixed]'))" 
                                        style="padding: 12px 24px; border: 2px solid #e5e7eb; background: white; border-radius: 8px; cursor: pointer;">Đóng</button>
                            </div>
                        </div>
                    </div>
                `;
                document.body.insertAdjacentHTML('beforeend', detailHTML);
            }

            editOrder(index) {
                const order = this.demoData.orders[index];
                const customerOptions = this.demoData.customers.map(c => 
                    `<option value="${c.id}" ${c.id === order.customerId ? 'selected' : ''}>${c.name}</option>`
                ).join('');

                const productRows = order.products.map((p, i) => `
                    <div style="display: flex; gap: 8px; margin-bottom: 8px; align-items: center;" data-product-row="${i}">
                        <select name="productId_${i}" style="flex: 2; padding: 8px; border: 1px solid #e5e7eb; border-radius: 4px;" onchange="app.updateProductPriceInEdit(this, ${i})">
                            ${this.demoData.products.map(prod => 
                                `<option value="${prod.id}" data-price="${prod.price}" ${prod.id === p.id ? 'selected' : ''}>${prod.name}</option>`
                            ).join('')}
                        </select>
                        <input type="number" name="price_${i}" value="${p.price}" min="0" style="flex: 1; padding: 8px; border: 1px solid #e5e7eb; border-radius: 4px;" placeholder="Giá bán">
                        <input type="number" name="quantity_${i}" value="${p.quantity}" min="1" style="flex: 1; padding: 8px; border: 1px solid #e5e7eb; border-radius: 4px;" placeholder="SL">
                        <input type="number" name="discount_${i}" value="${p.discount || 0}" min="0" style="flex: 1; padding: 8px; border: 1px solid #e5e7eb; border-radius: 4px;" placeholder="CK">
                        <select name="discountType[]" style="flex: 1; padding: 8px; border: 1px solid #e5e7eb; border-radius: 4px;">
                            <option value="percent" ${p.discountType !== 'amount' ? 'selected' : ''}>%</option>
                            <option value="amount" ${p.discountType === 'amount' ? 'selected' : ''}>VNĐ</option>
                        </select>
                        <button type="button" onclick="this.parentElement.remove()" style="padding: 8px; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer;">🗑️</button>
                    </div>
                `).join('');

                const formHTML = `
                    <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1001; display: flex; justify-content: center; align-items: center;" onclick="closeModal(this)">
                        <div style="background: white; padding: 32px; border-radius: 12px; width: 900px; max-width: 90vw; max-height: 90vh; overflow-y: auto;" onclick="event.stopPropagation()">
                            <h3 style="margin-bottom: 24px; color: var(--text-primary);">Sửa đơn hàng ${order.id}</h3>
                            <form onsubmit="app.updateOrderComplete(event, ${index})">
                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Khách hàng:</label>
                                    <select name="customerId" required style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                        ${customerOptions}
                                    </select>
                                </div>

                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Sản phẩm:</label>
                                    <div style="margin-bottom: 8px; font-size: 12px; color: #666; display: flex; gap: 8px; align-items: center;">
                                        <span style="flex: 2;">Tên sản phẩm</span>
                                        <span style="flex: 1;">Giá bán</span>
                                        <span style="flex: 1;">Số lượng</span>
                                        <span style="flex: 1;">Chiết khấu</span>
                                        <span style="flex: 1;">Loại</span>
                                        <span style="width: 40px;">Xóa</span>
                                    </div>
                                    <div id="products-container">
                                        ${productRows}
                                    </div>
                                    <button type="button" onclick="app.addProductRowEdit()" style="margin-top: 8px; padding: 8px 16px; background: var(--primary-green); color: white; border: none; border-radius: 4px; cursor: pointer;">+ Thêm sản phẩm</button>
                                </div>

                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Trạng thái thanh toán:</label>
                                    <select name="paymentStatus" required style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                        <option value="Công nợ" ${order.paymentStatus === 'Công nợ' ? 'selected' : ''}>Công nợ</option>
                                        <option value="Đã thanh toán" ${order.paymentStatus === 'Đã thanh toán' ? 'selected' : ''}>Đã thanh toán</option>
                                    </select>
                                </div>

                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Trạng thái đơn hàng:</label>
                                    <select name="status" required style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                        <option value="Đang xử lý" ${order.status === 'Đang xử lý' ? 'selected' : ''}>Đang xử lý</option>
                                        <option value="Hoàn thành" ${order.status === 'Hoàn thành' ? 'selected' : ''}>Hoàn thành</option>
                                        <option value="Đã giao" ${order.status === 'Đã giao' ? 'selected' : ''}>Đã giao</option>
                                        <option value="Hủy" ${order.status === 'Hủy' ? 'selected' : ''}>Hủy</option>
                                    </select>
                                </div>

                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Phương thức thanh toán:</label>
                                    <select name="paymentMethod" required style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                        <option value="Tiền mặt" ${order.paymentMethod === 'Tiền mặt' ? 'selected' : ''}>Tiền mặt</option>
                                        <option value="Chuyển khoản" ${order.paymentMethod === 'Chuyển khoản' ? 'selected' : ''}>Chuyển khoản</option>
                                        <option value="Thẻ tín dụng" ${order.paymentMethod === 'Thẻ tín dụng' ? 'selected' : ''}>Thẻ tín dụng</option>
                                    </select>
                                </div>

                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Phí vận chuyển phải thu khách hàng (VNĐ):</label>
                                    <input type="number" name="shippingFee" value="${order.shippingFee || 0}" min="0" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                </div>

                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Chi phí phát sinh (VNĐ):</label>
                                    <input type="number" name="expense" value="${order.expense || 0}" min="0" style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                </div>

                                <div style="margin-bottom: 24px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Ghi chú:</label>
                                    <textarea name="notes" placeholder="Nhập ghi chú cho đơn hàng..." style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; resize: vertical; height: 100px; font-family: inherit;">${order.notes || ''}</textarea>
                                </div>

                                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                                    <button type="button" onclick="closeModal(this.closest('div[style*=fixed]'))" 
                                            style="padding: 12px 24px; border: 2px solid #e5e7eb; background: white; border-radius: 8px; cursor: pointer;">Hủy</button>
                                    <button type="submit" 
                                            style="padding: 12px 24px; background: var(--primary-blue); color: white; border: none; border-radius: 8px; cursor: pointer;">Cập nhật đơn hàng</button>
                                </div>
                            </form>
                        </div>
                    </div>
                `;
                document.body.insertAdjacentHTML('beforeend', formHTML);
            }

            addProductRowEdit() {
                const container = document.getElementById('products-container');
                const rowCount = container.children.length;
                const firstProduct = this.demoData.products[0];
                const newRow = `
                    <div style="display: flex; gap: 8px; margin-bottom: 8px; align-items: center;" data-product-row="${rowCount}">
                        <select name="productId_${rowCount}" style="flex: 2; padding: 8px; border: 1px solid #e5e7eb; border-radius: 4px;" onchange="app.updateProductPriceInEdit(this, ${rowCount})">
                            ${this.demoData.products.map(prod => 
                                `<option value="${prod.id}" data-price="${prod.price}">${prod.name}</option>`
                            ).join('')}
                        </select>
                        <input type="number" name="price_${rowCount}" value="${firstProduct ? firstProduct.price : 0}" min="0" style="flex: 1; padding: 8px; border: 1px solid #e5e7eb; border-radius: 4px;" placeholder="Giá bán">
                        <input type="number" name="quantity_${rowCount}" value="1" min="1" style="flex: 1; padding: 8px; border: 1px solid #e5e7eb; border-radius: 4px;" placeholder="SL">
                        <input type="number" name="discount_${rowCount}" value="0" min="0" style="flex: 1; padding: 8px; border: 1px solid #e5e7eb; border-radius: 4px;" placeholder="CK">
                        <select name="discountType[]" style="flex: 1; padding: 8px; border: 1px solid #e5e7eb; border-radius: 4px;">
                            <option value="percent" selected>%</option>
                            <option value="amount">VNĐ</option>
                        </select>
                        <button type="button" onclick="this.parentElement.remove()" style="padding: 8px; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer;">🗑️</button>
                    </div>
                `;
                container.insertAdjacentHTML('beforeend', newRow);
            }

            updateProductPriceInEdit(selectElement, rowIndex) {
                const selectedOption = selectElement.options[selectElement.selectedIndex];
                const price = selectedOption.getAttribute('data-price');
                const priceInput = document.querySelector(`input[name="price_${rowIndex}"]`);
                if (priceInput && price) {
                    priceInput.value = price;
                }
            }

            updateOrderComplete(event, index) {
                event.preventDefault();
                const form = event.target;
                const formData = new FormData(form);

                const order = this.demoData.orders[index];
                const oldCustomer = this.demoData.customers.find(c => c.id === order.customerId);
                const newCustomer = this.demoData.customers.find(c => c.id === formData.get('customerId'));

                if (!oldCustomer || !newCustomer) {
                    this.showNotification('Không tìm thấy thông tin khách hàng', 'error');
                    return;
                }

                // Hoàn trả debt của khách hàng cũ nếu đơn hàng đang ở trạng thái công nợ hoặc chưa thanh toán
                if (order.paymentStatus === 'Công nợ') {
                    oldCustomer.debt -= order.total;
                    if (oldCustomer.debt < 0) oldCustomer.debt = 0;
                    console.log(`Hoàn trả debt cho ${oldCustomer.name}: -${order.total.toLocaleString('vi-VN')} VNĐ (${order.paymentStatus})`);
                }

                // Lấy thông tin sản phẩm mới
                const products = [];
                const discountTypes = formData.getAll('discountType[]');
                const productElements = form.querySelectorAll('[data-product-row]');

                productElements.forEach((row, i) => {
                    const productId = formData.get(`productId_${i}`);
                    const price = parseInt(formData.get(`price_${i}`)) || 0;
                    const quantity = parseInt(formData.get(`quantity_${i}`)) || 1;
                    const discount = parseInt(formData.get(`discount_${i}`)) || 0;
                    const discountType = discountTypes[i] || 'percent';

                    if (productId) {
                        const product = this.demoData.products.find(p => p.id === productId);
                        if (product) {
                            const existingProduct = order.products.find(p => p.id === productId);
                            products.push({
                                id: productId,
                                name: product.name,
                                quantity: quantity,
                                price: price, // Sử dụng giá đã chỉnh sửa từ form
                                discount: discount,
                                discountType: discountType,
                                deliveredQty: existingProduct?.deliveredQty || 0
                            });
                        }
                    }
                });

                if (products.length === 0) {
                    this.showNotification('Vui lòng chọn ít nhất một sản phẩm', 'error');
                    return;
                }

                // Tính tổng tiền mới
                const newTotal = products.reduce((sum, product) => {
                    const beforeDiscount = product.quantity * product.price;
                    let discountAmount = 0;
                    if (product.discountType === 'amount') {
                        discountAmount = product.discount;
                    } else {
                        discountAmount = beforeDiscount * product.discount / 100;
                    }
                    return sum + (beforeDiscount - discountAmount);
                }, 0);
                
                const shippingFee = parseInt(formData.get('shippingFee')) || 0;
                const finalTotal = newTotal + shippingFee;

                // Cập nhật đơn hàng
                const newPaymentStatus = formData.get('paymentStatus');
                const newStatus = formData.get('status');

                order.customerId = newCustomer.id;
                order.customerName = newCustomer.name;
                order.products = products;
                order.shippingFee = shippingFee;
                order.total = finalTotal;
                order.paymentStatus = newPaymentStatus;
                order.status = newStatus;
                order.paymentMethod = formData.get('paymentMethod');
                order.notes = formData.get('notes') || '';
                order.expense = parseInt(formData.get('expense')) || 0;

                // Cập nhật debt của khách hàng mới nếu cần
                if (newPaymentStatus === 'Công nợ') {
                    newCustomer.debt += finalTotal;
                    console.log(`Thêm debt cho ${newCustomer.name}: +${finalTotal.toLocaleString('vi-VN')} VNĐ (${newPaymentStatus})`);
                }

                this.saveToLocalStorage();
                this.showNotification(`Đã cập nhật đơn hàng ${order.id}`, 'success');
                this.loadPage('orders');
                const modal = form.closest("div[style*=\"fixed\"]"); if(modal) modal.remove();
            }

            updateOrder(event, index) {
                event.preventDefault();
                const form = event.target;
                const formData = new FormData(form);

                this.demoData.orders[index].status = formData.get('status');
                this.demoData.orders[index].paymentMethod = formData.get('paymentMethod');

                this.saveToLocalStorage();
                this.showNotification(`Đã cập nhật đơn hàng ${this.demoData.orders[index].id}`, 'success');
                this.loadPage('orders');
                const modal = form.closest("div[style*=\"fixed\"]"); if(modal) modal.remove();
            }

            deleteOrder(index) {
                const order = this.demoData.orders[index];
                if (confirm(`Bạn có chắc muốn xóa đơn hàng ${order.id}?`)) {
                    this.demoData.orders.splice(index, 1);
                    this.saveToLocalStorage();
                    this.showNotification(`Đã xóa đơn hàng ${order.id}`, 'success');
                    this.loadPage('orders');
                }
            }

            togglePaymentStatus(index) {
                const order = this.demoData.orders[index];
                const customer = this.demoData.customers.find(c => c.id === order.customerId);

                if (!customer) {
                    this.showNotification('Không tìm thấy khách hàng', 'error');
                    return;
                }

                // Xác định trạng thái sẽ chuyển sang
                let newStatus, newPaymentStatus, statusDescription;

                if (order.paymentStatus === 'Đã thanh toán') {
                    newPaymentStatus = 'Công nợ';
                    newStatus = order.status !== 'Hủy' ? 'Đang xử lý' : order.status;
                    statusDescription = `<span style="color: #22c55e; font-weight: 600;">Đã thanh toán</span> → <span style="color: #ef4444; font-weight: 600;">Công nợ</span>`;
                } else if (order.paymentStatus === 'Công nợ') {
                    newPaymentStatus = 'Đã thanh toán';
                    newStatus = order.status !== 'Hủy' ? 'Hoàn thành' : order.status;
                    statusDescription = `<span style="color: #ef4444; font-weight: 600;">Công nợ</span> → <span style="color: #22c55e; font-weight: 600;">Đã thanh toán</span>`;
                } else {
                    newPaymentStatus = 'Đã thanh toán';
                    newStatus = order.status !== 'Hủy' ? 'Hoàn thành' : order.status;
                    statusDescription = `<span style="color: #f59e0b; font-weight: 600;">Công nợ</span> → <span style="color: #22c55e; font-weight: 600;">Đã thanh toán</span>`;
                }

                const paymentHistoryItems = order.paymentHistory || [];
                const totalPaidForOrder = paymentHistoryItems.reduce((sum, payment) => sum + (payment.amount || 0), 0);
                const remainingForOrder = Math.max(order.total - totalPaidForOrder, 0);
                const paymentHistoryHTML = paymentHistoryItems.length > 0 ? `
                    <div style="background: #eef2ff; padding: 20px; border-radius: 10px; margin-bottom: 24px;">
                        <div style="font-weight: 700; color: var(--text-primary); margin-bottom: 12px;">🧾 Lịch sử thanh toán đơn hàng</div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 18px; font-size: 13px;">
                            <div style="background: white; padding: 12px; border-radius: 10px; border: 1px solid #dbeafe;">
                                <div style="color: #6b7280; margin-bottom: 6px;">Tổng đã thanh toán</div>
                                <div style="font-weight: 700; color: #059669;">${totalPaidForOrder.toLocaleString('vi-VN')} VNĐ</div>
                            </div>
                            <div style="background: white; padding: 12px; border-radius: 10px; border: 1px solid #dbeafe;">
                                <div style="color: #6b7280; margin-bottom: 6px;">Số còn lại</div>
                                <div style="font-weight: 700; color: ${remainingForOrder > 0 ? '#dc2626' : '#059669'};">${remainingForOrder.toLocaleString('vi-VN')} VNĐ</div>
                            </div>
                        </div>
                        ${paymentHistoryItems.map((payment, idx) => `
                            <div style="padding: 12px; border: 1px solid #dbeafe; border-radius: 10px; margin-bottom: 10px; background: white;">
                                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px; margin-bottom: 8px;">
                                    <span style="font-weight: 600;">Thanh toán #${idx + 1}</span>
                                    <span style="color: #6b7280;">${payment.date || payment.timestamp || ''}</span>
                                </div>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 13px;">
                                    <div>
                                        <div style="color: #6b7280;">Số tiền</div>
                                        <div style="font-weight: 700; color: #059669;">${(payment.amount || 0).toLocaleString('vi-VN')} VNĐ</div>
                                    </div>
                                    <div>
                                        <div style="color: #6b7280;">Phương thức</div>
                                        <div style="font-weight: 700; color: var(--text-primary);">${payment.method || 'Không xác định'}</div>
                                    </div>
                                </div>
                                ${payment.notes ? `<div style="margin-top: 10px; font-size: 12px; color: #4b5563;">Ghi chú: ${payment.notes}</div>` : ''}
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    <div style="background: #f8fafc; padding: 16px; border-radius: 10px; margin-bottom: 24px; color: #6b7280;">
                        Chưa có lịch sử thanh toán cho đơn hàng này.
                    </div>
                `;

                // Hiển thị popup xác nhận
                const paymentMethodHTML = newPaymentStatus === 'Đã thanh toán' ? `
                    <div style="background: #f0f9ff; border: 2px solid #0ea5e9; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
                        <div style="margin-bottom: 12px;">
                            <label style="font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 8px;">Phương thức thanh toán:</label>
                            <select id="payment-method-select" style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 14px;">
                                <option value="Tiền mặt">💵 Tiền mặt (Cash)</option>
                                <option value="Chuyển khoản">🏦 Chuyển khoản (Transfer)</option>
                                <option value="Thẻ tín dụng">💳 Thẻ tín dụng (Credit Card)</option>
                                <option value="Ví điện tử">📱 Ví điện tử (E-wallet)</option>
                                <option value="Khác">🔄 Khác</option>
                            </select>
                        </div>
                    </div>
                ` : '';

                const confirmHTML = `
                    <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1001; display: flex; justify-content: center; align-items: center;" onclick="closeModal(this)">
                        <div style="background: white; padding: 32px; border-radius: 12px; width: 500px; max-width: 90vw;" onclick="event.stopPropagation()">
                            <h3 style="margin-bottom: 24px; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
                                <span>💳</span> Xác nhận thay đổi trạng thái thanh toán
                            </h3>

                            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
                                <div style="margin-bottom: 12px;">
                                    <strong>Mã đơn hàng:</strong> ${order.id}
                                </div>
                                <div style="margin-bottom: 12px;">
                                    <strong>Khách hàng:</strong> ${customer.name}
                                </div>
                                <div style="margin-bottom: 12px;">
                                    <strong>Tổng tiền:</strong> <span style="color: var(--primary-blue); font-weight: 600;">${order.total.toLocaleString('vi-VN')} VNĐ</span>
                                </div>
                                <div style="margin-bottom: 12px;">
                                    <strong>Thay đổi:</strong> ${statusDescription}
                                </div>
                            </div>

                            ${paymentHistoryHTML}

                            ${paymentMethodHTML}

                            <div style="background: #fff7ed; border: 2px solid #fdba74; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
                                <div style="display: flex; align-items: center; gap: 8px; color: #ea580c;">
                                    <span>⚠️</span>
                                    <strong>Lưu ý:</strong>
                                </div>
                                <div style="margin-top: 8px; color: #9a3412;">
                                    Thao tác này sẽ cập nhật công nợ của khách hàng và không thể hoàn tác.
                                </div>
                            </div>

                            <div style="display: flex; gap: 12px; justify-content: flex-end;">
                                <button type="button" onclick="closeModal(this.closest('div[style*=fixed]'))" 
                                        style="padding: 12px 24px; border: 2px solid #e5e7eb; background: white; border-radius: 8px; cursor: pointer; font-weight: 600;">Hủy</button>
                                <button type="button" onclick="const method = document.getElementById('payment-method-select') ? document.getElementById('payment-method-select').value : 'Tiền mặt'; app.confirmTogglePaymentStatus(${index}, '${newPaymentStatus}', '${newStatus}', method); closeModal(this.closest('div[style*=fixed]'))"
                                        style="padding: 12px 24px; background: var(--primary-blue); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">Xác nhận</button>
                            </div>
                        </div>
                    </div>
                `;

                document.body.insertAdjacentHTML('beforeend', confirmHTML);
            }

            confirmTogglePaymentStatus(index, newPaymentStatus, newStatus, paymentMethod = 'Tiền mặt') {
                const order = this.demoData.orders[index];
                const customer = this.demoData.customers.find(c => c.id === order.customerId);

                const oldPaymentStatus = order.paymentStatus;

                // Cập nhật trạng thái
                order.paymentStatus = newPaymentStatus;
                order.status = newStatus;

                // Cập nhật debt
                if (oldPaymentStatus === 'Đã thanh toán' && newPaymentStatus === 'Công nợ') {
                    // Từ "Đã thanh toán" → "Công nợ": cộng debt
                    customer.debt += order.total;
                    console.log(`Toggle: Thêm debt cho ${customer.name}: +${order.total.toLocaleString('vi-VN')} VNĐ`);

                    // Xóa lịch sử thanh toán cho đơn hàng này
                    if (order.paymentHistory) {
                        order.paymentHistory = [];
                    }
                    order.paidAmount = 0;
                    order.remainingBalance = order.total;

                    // Xóa lịch sử thanh toán của khách hàng liên quan đến đơn hàng này
                    if (customer.paymentHistory) {
                        customer.paymentHistory = customer.paymentHistory.filter(payment => 
                            !payment.ordersAffected || !payment.ordersAffected.some(o => o.orderId === order.id)
                        );
                    }
                } else if (oldPaymentStatus !== 'Đã thanh toán' && newPaymentStatus === 'Đã thanh toán') {
                    // Từ "Công nợ" → "Đã thanh toán": trừ debt
                    const remainingBeforePayment = this.getOrderRemainingBalance(order);
                    customer.debt -= remainingBeforePayment;
                    if (customer.debt < 0) customer.debt = 0; // Đảm bảo debt không âm
                    console.log(`Toggle: Trừ debt cho ${customer.name}: -${remainingBeforePayment.toLocaleString('vi-VN')} VNĐ`);

                    if (remainingBeforePayment > 0) {
                        this.recordOrderPayment(order, customer, remainingBeforePayment, {
                            id: 'PAY_TOGGLE_' + Date.now(),
                            date: this.getVietnamTime().toISOString().split('T')[0],
                            method: paymentMethod,
                            notes: 'Thanh toán tự động khi chuyển trạng thái từ Công nợ sang Đã thanh toán',
                            remainingDebt: customer.debt
                        });
                    } else {
                        this.syncOrderPaymentTotals(order);
                    }
                }

                this.saveToLocalStorage();
                this.refreshAllCustomerDisplays();

                // Ghi log hoạt động
                const statusChange = `${oldPaymentStatus} → ${newPaymentStatus}`;
                this.addActivityLog('success', '💳', `Cập nhật thanh toán ${order.id}`, 
                    `Khách hàng: ${customer.name} - Thay đổi: ${statusChange} - Giá trị: ${order.total.toLocaleString('vi-VN')} VNĐ`, 'payment');

                this.showNotification(`✅ Đã cập nhật: ${order.id} - ${newPaymentStatus}. Nợ ${customer.name}: ${customer.debt.toLocaleString('vi-VN')} VNĐ`, 'success');

                // Cập nhật giao diện ngay lập tức thay vì tải lại trang
                this.updateOrderRowDisplay(index);

                // Reload trang hiện tại nếu đang ở trang liên quan để cập nhật lịch sử thanh toán
                if (this.currentPage === 'orders' || this.currentPage === 'payment-history') {
                    this.loadPage(this.currentPage);
                }
            }

            updateOrderRowDisplay(orderIndex) {
                const order = this.demoData.orders[orderIndex];
                if (!order) return;

                // Tìm dòng đơn hàng trong bảng hiện tại
                const orderRows = document.querySelectorAll('tbody tr[data-order-index]');
                let targetRow = null;

                orderRows.forEach(row => {
                    if (parseInt(row.getAttribute('data-order-index')) === orderIndex) {
                        targetRow = row;
                    }
                });

                if (!targetRow) {
                    // Nếu không tìm thấy row, tải lại trang
                    this.loadPage('orders');
                    return;
                }

                // Cập nhật cell trạng thái đơn hàng
                const statusCell = targetRow.querySelector('.status-cell');
                if (statusCell) {
                    const statusColor = order.status === 'Hoàn thành' ? '#16a34a' : 
                                      order.status === 'Hủy' ? '#dc2626' : '#f59e0b';
                    statusCell.innerHTML = `<span style="background: ${statusColor}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">${order.status}</span>`;
                }

                // Cập nhật cell trạng thái thanh toán với nút đúp click
                const paymentCell = targetRow.querySelector('.payment-cell');
                if (paymentCell) {
                    const buttonColor = order.paymentStatus === 'Đã thanh toán' ? '#22c55e' : '#f59e0b';
                    const buttonText = order.paymentStatus === 'Đã thanh toán' ? '✓ Đã TT' : 'Công nợ';

                    paymentCell.innerHTML = `
                        <button ondblclick="app.togglePaymentStatus(${orderIndex})" style="
                            background: ${buttonColor}; 
                            color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600;
                            transition: all 0.3s ease;
                        ">
                            ${buttonText}
                        </button>
                    `;
                }
            }

            filterOrdersByPeriod(period) {
                const now = this.getVietnamTime();
                const today = now.toISOString().split('T')[0];

                // Tính toán ngày bắt đầu của tuần (thứ 2)
                const startOfWeek = new Date(now);
                const day = startOfWeek.getDay();
                const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Điều chỉnh để thứ 2 là ngày đầu tuần
                startOfWeek.setDate(diff);
                const weekStart = startOfWeek.toISOString().split('T')[0];

                // Lọc đơn hàng theo thời gian
                let filteredOrders = [];
                if (period === 'today') {
                    filteredOrders = this.demoData.orders.filter(order => order.date === today);
                } else if (period === 'week') {
                    filteredOrders = this.demoData.orders.filter(order => order.date >= weekStart);
                } else {
                    filteredOrders = this.demoData.orders;
                }

                // Ẩn tất cả các dòng trong bảng
                const rows = document.querySelectorAll('#orders-table tbody tr');
                rows.forEach(row => row.style.display = 'none');

                // Hiển thị chỉ những đơn hàng được lọc
                filteredOrders.forEach((order, index) => {
                    const originalIndex = this.demoData.orders.findIndex(o => o.id === order.id);
                    const row = document.querySelector(`#orders-table tbody tr:nth-child(${originalIndex + 1})`);
                    if (row) {
                        row.style.display = '';
                    }
                });

                // Cập nhật tiêu đề và thông báo
                const periodText = period === 'today' ? 'hôm nay' : period === 'week' ? 'tuần này' : 'tất cả';
                const headerElement = document.querySelector('#orders-table').previousElementSibling;
                if (headerElement && headerElement.tagName === 'H3') {
                    headerElement.innerHTML = `<span>📋</span> Đơn hàng ${periodText} (${filteredOrders.length})`;
                }

                this.showNotification(`Hiển thị ${filteredOrders.length} đơn hàng ${periodText}`, 'success');
            }

            searchOrders(searchTerm) {
                const rows = document.querySelectorAll('#orders-table tbody tr');
                rows.forEach(row => {
                    const text = row.textContent.toLowerCase();
                    const isVisible = text.includes(searchTerm.toLowerCase());
                    row.style.display = isVisible ? '' : 'none';
                });
            }

            exportOrdersReport(mode = null) {
                if (!mode) {
                    this.showExportOptions('Xuất báo cáo đơn hàng', 'orders', 'exportOrdersReport');
                    return;
                }

                if (mode === 'view') {
                    const columns = [
                        { header: 'Mã đơn', getValue: order => order.id },
                        { header: 'Khách hàng', getValue: order => order.customerName },
                        { header: 'Ngày', getValue: order => order.date },
                        { header: 'Giờ', getValue: order => order.time },
                        { header: 'Tổng tiền (VNĐ)', getValue: order => order.total.toLocaleString('vi-VN') },
                        { header: 'Trạng thái', getValue: order => order.status },
                        { header: 'Thanh toán', getValue: order => order.paymentMethod }
                    ];
                    this.showDataViewer('Báo cáo đơn hàng', this.demoData.orders, columns);
                } else if (mode === 'download') {
                    // Tạo dữ liệu chi tiết cho Excel
                    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
                    csvContent += "Mã đơn,Khách hàng,Ngày,Giờ,Sản phẩm,Số lượng,Đơn giá,Thành tiền,Tổng đơn hàng,Trạng thái,Thanh toán\n";

                    this.demoData.orders.forEach(order => {
                        order.products.forEach((product, productIndex) => {
                            const row = `${productIndex === 0 ? order.id : ''},"${productIndex === 0 ? order.customerName : ''}","${productIndex === 0 ? order.date : ''}","${productIndex === 0 ? order.time : ''}","${product.name}",${product.quantity},${product.price},${product.quantity * product.price},"${productIndex === 0 ? order.total : ''}","${productIndex === 0 ? order.status : ''}","${productIndex === 0 ? order.paymentMethod : ''}"`;
                            csvContent += row + "\n";
                        });
                    });

                    const encodedUri = encodeURI(csvContent);
                    const link = document.createElement("a");
                    link.setAttribute("href", encodedUri);
                    link.setAttribute("download", `don_hang_${this.getVietnamTime().toISOString().split('T')[0]}.csv`);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);

                    this.showNotification('Đã tải xuống báo cáo đơn hàng chi tiết', 'success');
                }
            }

            // Xuất giao dịch thanh toán
            exportPaymentTransactions() {
                // Aggregate tất cả các giao dịch thanh toán
                const allTransactions = [];

                this.demoData.orders.forEach((order) => {
                    if (order.paymentHistory && Array.isArray(order.paymentHistory)) {
                        const customer = this.demoData.customers.find(c => c.id === order.customerId) || { name: 'N/A', id: 'N/A' };

                        order.paymentHistory.forEach(payment => {
                            allTransactions.push({
                                id: payment.id,
                                orderId: order.id,
                                customerId: order.customerId,
                                customerName: customer.name,
                                date: payment.date,
                                amount: payment.amount,
                                method: payment.method || 'Không xác định',
                                notes: payment.notes || ''
                            });
                        });
                    }
                });

                if (allTransactions.length === 0) {
                    this.showNotification('Không có giao dịch thanh toán nào để xuất', 'info');
                    return;
                }

                // Sắp xếp theo ngày mới nhất trước
                allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

                // Tạo CSV
                const totalAmount = allTransactions.reduce((sum, t) => sum + t.amount, 0);
                const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + 
                    `Báo cáo giao dịch thanh toán\n` +
                    `Ngày xuất: ${this.getVietnamTime().toLocaleDateString('vi-VN')}\n` +
                    `Tổng giao dịch: ${allTransactions.length}\n` +
                    `Tổng số tiền: ${totalAmount.toLocaleString('vi-VN')} VNĐ\n\n` +
                    `Mã giao dịch,Đơn hàng,Khách hàng,Ngày,Số tiền,Phương thức,Ghi chú\n` +
                    allTransactions.map(t => 
                        `${t.id},${t.orderId},"${t.customerName}",${t.date},${t.amount},"${t.method}","${t.notes.replace(/"/g, '""')}"`
                    ).join('\n');

                const encodedUri = encodeURI(csvContent);
                const link = document.createElement("a");
                link.setAttribute("href", encodedUri);
                link.setAttribute("download", `giao_dich_thanh_toan_${this.getVietnamTime().toISOString().split('T')[0]}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                this.showNotification(`Đã tải xuống báo cáo giao dịch (${allTransactions.length} giao dịch)`, 'success');
            }

            // Additional Report Functions
            exportTopProductsReport(mode = null) {
                this.showTopProductsExportWithFilter();
            }

            exportFinancialReport(mode = null) {
                this.showFinancialExportWithFilter();
            }

            showTrendAnalysis(timePeriod = 'monthly') {
                // Tính toán dữ liệu phân tích
                const totalRevenue = this.getOrderRevenueInRange(null, null);
                const avgOrderValue = this.demoData.orders.length > 0 ? totalRevenue / this.demoData.orders.length : 0;
                const totalDebt = this.getTotalOutstandingDebt();
                const paidOrders = this.demoData.orders.filter(order => order.paymentStatus === 'Đã thanh toán').length;
                const unpaidOrders = this.demoData.orders.filter(order => this.getOrderRemainingBalance(order) > 0).length;
                const completedOrders = this.demoData.orders.filter(order => order.status === 'Hoàn thành').length;
                const totalOperatingExpenses = (this.demoData.expenses || []).reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);
                const expenseBreakdown = Object.entries(this.getExpenseBreakdown(this.demoData.expenses || []))
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 6);

                const revenueData = this.calculateRevenueByPeriod(timePeriod);
                const periodTitles = {
                    daily: 'Hàng ngày (7 ngày gần nhất)',
                    weekly: 'Hàng tuần (4 tuần gần nhất)',
                    monthly: 'Hàng tháng (6 tháng gần nhất)',
                    yearly: 'Hàng năm (3 năm gần nhất)'
                };
                const periodTitle = periodTitles[timePeriod] || periodTitles.monthly;

                const existingModal = document.getElementById('trend-analysis-modal');
                if (existingModal) {
                    existingModal.remove();
                }

                // Top sản phẩm bán chạy
                const productSales = {};
                this.demoData.orders.forEach(order => {
                    order.products.forEach(product => {
                        if (!productSales[product.name]) {
                            productSales[product.name] = 0;
                        }
                        productSales[product.name] += product.quantity;
                    });
                });
                const topProducts = Object.entries(productSales)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5);

                // Phân tích tồn kho
                const lowStockProducts = this.demoData.products.filter(p => p.stock < 10);
                const normalStockProducts = this.demoData.products.filter(p => p.stock >= 10 && p.stock < 50);
                const highStockProducts = this.demoData.products.filter(p => p.stock >= 50);

                const analysisHTML = `
                    <div id="trend-analysis-modal" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.85); z-index: 1001; display: flex; justify-content: center; align-items: flex-start; padding: 20px; overflow-y: auto;" onclick="closeModal(this)">
                        <div style="background: white; padding: 32px; border-radius: 16px; width: 1200px; max-width: 95vw; max-height: 90vh; overflow-y: auto; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);" onclick="event.stopPropagation()">
                            <div style="text-align: center; margin-bottom: 32px; border-bottom: 2px solid #f3f4f6; padding-bottom: 20px;">
                                <h2 style="color: var(--text-primary); font-size: 28px; margin: 0;">📊 Báo cáo Phân tích Xu hướng Kinh doanh</h2>
                                <p style="color: #6b7280; margin: 8px 0 0 0; font-size: 16px;">Tổng quan hiệu suất và dự báo phát triển</p>
                                <div style="display: flex; justify-content: center; flex-wrap: wrap; gap: 10px; margin-top: 18px;">
                                    <button onclick="app.showTrendAnalysis('daily')"
                                            style="padding: 10px 16px; border-radius: 8px; border: 1px solid #d1d5db; background: ${timePeriod === 'daily' ? '#10b981' : '#f8fafc'}; color: ${timePeriod === 'daily' ? 'white' : '#374151'}; cursor: pointer; font-weight: 600;">
                                        📅 Hàng ngày
                                    </button>
                                    <button onclick="app.showTrendAnalysis('weekly')"
                                            style="padding: 10px 16px; border-radius: 8px; border: 1px solid #d1d5db; background: ${timePeriod === 'weekly' ? '#10b981' : '#f8fafc'}; color: ${timePeriod === 'weekly' ? 'white' : '#374151'}; cursor: pointer; font-weight: 600;">
                                        📊 Hàng tuần
                                    </button>
                                    <button onclick="app.showTrendAnalysis('monthly')"
                                            style="padding: 10px 16px; border-radius: 8px; border: 1px solid #d1d5db; background: ${timePeriod === 'monthly' ? '#10b981' : '#f8fafc'}; color: ${timePeriod === 'monthly' ? 'white' : '#374151'}; cursor: pointer; font-weight: 600;">
                                        📈 Hàng tháng
                                    </button>
                                    <button onclick="app.showTrendAnalysis('yearly')"
                                            style="padding: 10px 16px; border-radius: 8px; border: 1px solid #d1d5db; background: ${timePeriod === 'yearly' ? '#10b981' : '#f8fafc'}; color: ${timePeriod === 'yearly' ? 'white' : '#374151'}; cursor: pointer; font-weight: 600;">
                                        📉 Hàng năm
                                    </button>
                                </div>
                            </div>

                            <!-- KPI Cards -->
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 32px;">
                                <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 20px; border-radius: 12px; text-align: center;">
                                    <div style="font-size: 32px; font-weight: bold; margin-bottom: 8px;">${totalRevenue.toLocaleString('vi-VN')}</div>
                                    <div style="font-size: 14px; opacity: 0.9;">Tổng Doanh Thu (VNĐ)</div>
                                </div>
                                <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 20px; border-radius: 12px; text-align: center;">
                                    <div style="font-size: 32px; font-weight: bold; margin-bottom: 8px;">${avgOrderValue.toLocaleString('vi-VN')}</div>
                                    <div style="font-size: 14px; opacity: 0.9;">Giá trị ĐH TB (VNĐ)</div>
                                </div>
                                <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 20px; border-radius: 12px; text-align: center;">
                                    <div style="font-size: 32px; font-weight: bold; margin-bottom: 8px;">${this.demoData.orders.length}</div>
                                    <div style="font-size: 14px; opacity: 0.9;">Tổng Đơn Hàng</div>
                                </div>
                                <div style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; padding: 20px; border-radius: 12px; text-align: center;">
                                    <div style="font-size: 32px; font-weight: bold; margin-bottom: 8px;">${this.demoData.customers.length}</div>
                                    <div style="font-size: 14px; opacity: 0.9;">Khách Hàng</div>
                                </div>
                                <div style="background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%); color: white; padding: 20px; border-radius: 12px; text-align: center;">
                                    <div style="font-size: 32px; font-weight: bold; margin-bottom: 8px;">${totalOperatingExpenses.toLocaleString('vi-VN')}</div>
                                    <div style="font-size: 14px; opacity: 0.9;">Chi phí vận hành (VNĐ)</div>
                                </div>
                            </div>

                            <!-- Charts Row 1: Revenue Trend & Payment Status -->
                            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 24px; margin-bottom: 32px;">
                                <!-- Biểu đồ doanh thu theo thời gian -->
                                <div style="background: #f9fafb; padding: 24px; border-radius: 12px; border: 1px solid #e5e7eb;">
                                    <h3 style="color: var(--text-primary); margin-bottom: 20px; text-align: center;">📈 Xu hướng Doanh thu - ${periodTitle}</h3>
                                    <div style="height: 200px; position: relative; display: flex; align-items: end; justify-content: space-between; padding: 0 10px; border-bottom: 2px solid #d1d5db;">
                                        ${revenueData.map((item, index) => {
                                            const maxRevenue = Math.max(...revenueData.map(m => m.revenue));
                                            const height = maxRevenue > 0 ? (item.revenue / maxRevenue) * 160 : 0;
                                            const color = index === revenueData.length - 1 ? '#10b981' : '#6b7280';
                                            return `
                                                <div style="display: flex; flex-direction: column; align-items: center;">
                                                    <div style="background: ${color}; width: 40px; height: ${height}px; border-radius: 4px 4px 0 0; margin-bottom: 8px; position: relative; transition: all 0.3s;">
                                                        <div style="position: absolute; top: -25px; left: 50%; transform: translateX(-50%); font-size: 11px; color: #374151; font-weight: 600;">
                                                            ${item.revenue > 0 ? (item.revenue / 1000000).toFixed(1) + 'M' : '0'}
                                                        </div>
                                                    </div>
                                                    <div style="font-size: 12px; color: #6b7280; font-weight: 500; text-align: center;">
                                                        ${item.label}
                                                    </div>
                                                </div>
                                            `;
                                        }).join('')}
                                    </div>
                                </div>

                                <!-- Biểu đồ tròn trạng thái thanh toán -->
                                <div style="background: #f9fafb; padding: 24px; border-radius: 12px; border: 1px solid #e5e7eb;">
                                    <h3 style="color: var(--text-primary); margin-bottom: 20px; text-align: center;">💳 Trạng thái Thanh toán</h3>
                                    <div style="position: relative; width: 120px; height: 120px; margin: 0 auto 20px;">
                                        <svg width="120" height="120" style="transform: rotate(-90deg);">
                                            <!-- Background circle -->
                                            <circle cx="60" cy="60" r="50" fill="none" stroke="#e5e7eb" stroke-width="12"></circle>
                                            <!-- Paid orders -->
                                            <circle cx="60" cy="60" r="50" fill="none" stroke="#10b981" stroke-width="12" 
                                                    stroke-dasharray="${(paidOrders / this.demoData.orders.length * 314).toFixed(1)} 314"
                                                    stroke-linecap="round"></circle>
                                            <!-- Unpaid orders -->
                                            <circle cx="60" cy="60" r="35" fill="none" stroke="#f59e0b" stroke-width="8" 
                                                    stroke-dasharray="${(unpaidOrders / this.demoData.orders.length * 220).toFixed(1)} 220"
                                                    stroke-linecap="round"></circle>
                                        </svg>
                                        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center;">
                                            <div style="font-size: 18px; font-weight: bold; color: #374151;">${this.demoData.orders.length}</div>
                                            <div style="font-size: 11px; color: #6b7280;">Đơn hàng</div>
                                        </div>
                                    </div>
                                    <div style="text-align: center;">
                                        <div style="margin-bottom: 8px;">
                                            <span style="display: inline-block; width: 12px; height: 12px; background: #10b981; border-radius: 50%; margin-right: 8px;"></span>
                                            <span style="font-size: 13px; color: #374151;">Đã TT: ${paidOrders}</span>
                                        </div>
                                        <div>
                                            <span style="display: inline-block; width: 12px; height: 12px; background: #f59e0b; border-radius: 50%; margin-right: 8px;"></span>
                                            <span style="font-size: 13px; color: #374151;">Công nợ: ${unpaidOrders}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Charts Row 2: Top Products & Inventory -->
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 32px;">
                                <!-- Top sản phẩm bán chạy -->
                                <div style="background: #f9fafb; padding: 24px; border-radius: 12px; border: 1px solid #e5e7eb;">
                                    <h3 style="color: var(--text-primary); margin-bottom: 20px; text-align: center;">🏆 Top 5 Sản phẩm bán chạy</h3>
                                    <div style="space-y: 12px;">
                                        ${topProducts.map((product, index) => {
                                            const maxQuantity = topProducts[0][1];
                                            const percentage = (product[1] / maxQuantity) * 100;
                                            const colors = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444'];
                                            return `
                                                <div style="margin-bottom: 12px;">
                                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                                        <span style="font-size: 13px; color: #374151; font-weight: 500;">${product[0]}</span>
                                                        <span style="font-size: 13px; color: #6b7280; font-weight: 600;">${product[1]}</span>
                                                    </div>
                                                    <div style="background: #e5e7eb; height: 8px; border-radius: 4px; overflow: hidden;">
                                                        <div style="background: ${colors[index]}; height: 100%; width: ${percentage}%; border-radius: 4px; transition: width 0.5s ease;"></div>
                                                    </div>
                                                </div>
                                            `;
                                        }).join('')}
                                    </div>
                                </div>

                                <!-- Phân tích tồn kho -->
                                <div style="background: #f9fafb; padding: 24px; border-radius: 12px; border: 1px solid #e5e7eb;">
                                    <h3 style="color: var(--text-primary); margin-bottom: 20px; text-align: center;">📦 Phân tích Tồn kho</h3>
                                    <div style="display: flex; justify-content: center; margin-bottom: 20px;">
                                        <div style="position: relative; width: 100px; height: 100px;">
                                            <svg width="100" height="100" style="transform: rotate(-90deg);">
                                                <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" stroke-width="10"></circle>
                                                <circle cx="50" cy="50" r="40" fill="none" stroke="#dc2626" stroke-width="10" 
                                                        stroke-dasharray="${(lowStockProducts.length / this.demoData.products.length * 251).toFixed(1)} 251"></circle>
                                                <circle cx="50" cy="50" r="30" fill="none" stroke="#f59e0b" stroke-width="8" 
                                                        stroke-dasharray="${(normalStockProducts.length / this.demoData.products.length * 188).toFixed(1)} 188"></circle>
                                                <circle cx="50" cy="50" r="20" fill="none" stroke="#10b981" stroke-width="6" 
                                                        stroke-dasharray="${(highStockProducts.length / this.demoData.products.length * 126).toFixed(1)} 126"></circle>
                                            </svg>
                                        </div>
                                    </div>
                                    <div style="text-align: center; font-size: 12px;">
                                        <div style="margin-bottom: 6px;">
                                            <span style="display: inline-block; width: 10px; height: 10px; background: #dc2626; border-radius: 50%; margin-right: 6px;"></span>
                                            Sắp hết: ${lowStockProducts.length}
                                        </div>
                                        <div style="margin-bottom: 6px;">
                                            <span style="display: inline-block; width: 10px; height: 10px; background: #f59e0b; border-radius: 50%; margin-right: 6px;"></span>
                                            Bình thường: ${normalStockProducts.length}
                                        </div>
                                        <div>
                                            <span style="display: inline-block; width: 10px; height: 10px; background: #10b981; border-radius: 50%; margin-right: 6px;"></span>
                                            Dồi dào: ${highStockProducts.length}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div style="background: #fff7ed; padding: 24px; border-radius: 12px; border: 1px solid #fed7aa; margin-bottom: 32px;">
                                <h3 style="color: #9a3412; margin: 0 0 16px 0;">Phân tích loại chi phí</h3>
                                ${expenseBreakdown.length > 0 ? expenseBreakdown.map(([category, amount]) => {
                                    const percent = totalOperatingExpenses > 0 ? (amount / totalOperatingExpenses * 100).toFixed(1) : '0.0';
                                    return `
                                        <div style="margin-bottom: 12px;">
                                            <div style="display: flex; justify-content: space-between; gap: 12px; margin-bottom: 5px;">
                                                <span style="font-weight: 600; color: #7c2d12;">${category}</span>
                                                <span style="font-weight: 700; color: #dc2626;">${amount.toLocaleString('vi-VN')} VNĐ</span>
                                            </div>
                                            <div style="height: 8px; background: #ffedd5; border-radius: 4px; overflow: hidden;">
                                                <div style="height: 100%; width: ${percent}%; background: #f97316;"></div>
                                            </div>
                                        </div>
                                    `;
                                }).join('') : '<div style="color: #9a3412;">Chưa có chi phí vận hành để phân tích.</div>'}
                            </div>

                            <!-- Analysis Summary -->
                            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-bottom: 32px;">
                                <div style="background: #f0fdf4; padding: 20px; border-radius: 12px; border: 1px solid #bbf7d0;">
                                    <h4 style="color: #059669; margin-bottom: 12px; display: flex; align-items: center;">
                                        ✅ Điểm mạnh
                                    </h4>
                                    <ul style="list-style: none; padding: 0; margin: 0;">
                                        <li style="padding: 6px 0; font-size: 13px; color: #065f46;">• ${this.demoData.customers.length} khách hàng ổn định</li>
                                        <li style="padding: 6px 0; font-size: 13px; color: #065f46;">• Đơn hàng TB: ${avgOrderValue.toLocaleString('vi-VN')} VNĐ</li>
                                        <li style="padding: 6px 0; font-size: 13px; color: #065f46;">• ${this.demoData.products.length} sản phẩm đa dạng</li>
                                        <li style="padding: 6px 0; font-size: 13px; color: #065f46;">• Tỷ lệ hoàn thành: ${((completedOrders/this.demoData.orders.length)*100).toFixed(1)}%</li>
                                    </ul>
                                </div>

                                <div style="background: #fef2f2; padding: 20px; border-radius: 12px; border: 1px solid #fecaca;">
                                    <h4 style="color: #dc2626; margin-bottom: 12px; display: flex; align-items: center;">
                                        ⚠️ Cần cải thiện
                                    </h4>
                                    <ul style="list-style: none; padding: 0; margin: 0;">
                                        <li style="padding: 6px 0; font-size: 13px; color: #991b1b;">• ${lowStockProducts.length} SP sắp hết hàng</li>
                                        <li style="padding: 6px 0; font-size: 13px; color: #991b1b;">• Công nợ: ${totalDebt.toLocaleString('vi-VN')} VNĐ</li>
                                        <li style="padding: 6px 0; font-size: 13px; color: #991b1b;">• ${unpaidOrders} đơn chưa thanh toán</li>
                                        <li style="padding: 6px 0; font-size: 13px; color: #991b1b;">• Cần thu hồi công nợ</li>
                                    </ul>
                                </div>

                                <div style="background: #f0f9ff; padding: 20px; border-radius: 12px; border: 1px solid #bfdbfe;">
                                    <h4 style="color: #0369a1; margin-bottom: 12px; display: flex; align-items: center;">
                                        🎯 Khuyến nghị
                                    </h4>
                                    <ul style="list-style: none; padding: 0; margin: 0;">
                                        <li style="padding: 6px 0; font-size: 13px; color: #0c4a6e;">• Nhập thêm hàng bán chạy</li>
                                        <li style="padding: 6px 0; font-size: 13px; color: #0c4a6e;">• Khuyến mãi sản phẩm ế</li>
                                        <li style="padding: 6px 0; font-size: 13px; color: #0c4a6e;">• Tăng giá trị đơn hàng</li>
                                        <li style="padding: 6px 0; font-size: 13px; color: #0c4a6e;">• Marketing khách hàng mới</li>
                                    </ul>
                                </div>
                            </div>

                            <div style="text-align: center; border-top: 2px solid #f3f4f6; padding-top: 20px;">
                                <button onclick="closeModal(this.closest('div[style*=fixed]'))" 
                                        style="padding: 14px 40px; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; border: none; border-radius: 10px; cursor: pointer; font-size: 16px; font-weight: 600; box-shadow: 0 4px 14px rgba(59, 130, 246, 0.3); transition: all 0.3s;"
                                        onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(59, 130, 246, 0.4)'"
                                        onmouseout="this.style.transform=''; this.style.boxShadow='0 4px 14px rgba(59, 130, 246, 0.3)'">
                                    Đóng báo cáo
                                </button>
                            </div>
                        </div>
                    </div>
                `;
                document.body.insertAdjacentHTML('beforeend', analysisHTML);
            }

            // Tính doanh thu theo khoảng thời gian
            calculateRevenueByPeriod(timePeriod) {
                const now = this.getVietnamTime();
                const results = [];

                const getOrdersForDate = (start, end) => {
                    return this.demoData.orders.filter(order => {
                        const orderDate = new Date(order.date);
                        return orderDate >= start && orderDate <= end;
                    });
                };

                if (timePeriod === 'daily') {
                    for (let i = 6; i >= 0; i--) {
                        const date = new Date(now);
                        date.setDate(now.getDate() - i);
                        const start = new Date(date);
                        start.setHours(0, 0, 0, 0);
                        const end = new Date(date);
                        end.setHours(23, 59, 59, 999);

                        const dayOrders = getOrdersForDate(start, end);
                        const revenue = dayOrders.reduce((sum, order) => sum + (Number(order.total) || 0), 0);

                        results.push({
                            label: date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
                            revenue,
                            orderCount: dayOrders.length
                        });
                    }
                } else if (timePeriod === 'weekly') {
                    const weekDay = now.getDay();
                    const mondayOffset = weekDay === 0 ? -6 : 1 - weekDay;
                    const currentMonday = new Date(now);
                    currentMonday.setDate(now.getDate() + mondayOffset);
                    currentMonday.setHours(0, 0, 0, 0);

                    for (let i = 3; i >= 0; i--) {
                        const start = new Date(currentMonday);
                        start.setDate(currentMonday.getDate() - i * 7);
                        const end = new Date(start);
                        end.setDate(start.getDate() + 6);
                        end.setHours(23, 59, 59, 999);

                        const weekOrders = getOrdersForDate(start, end);
                        const revenue = weekOrders.reduce((sum, order) => sum + (Number(order.total) || 0), 0);

                        results.push({
                            label: `Tuần ${start.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}`,
                            revenue,
                            orderCount: weekOrders.length
                        });
                    }
                } else if (timePeriod === 'yearly') {
                    for (let i = 2; i >= 0; i--) {
                        const year = now.getFullYear() - i;
                        const start = new Date(year, 0, 1);
                        const end = new Date(year, 11, 31, 23, 59, 59, 999);

                        const yearOrders = getOrdersForDate(start, end);
                        const revenue = yearOrders.reduce((sum, order) => sum + (Number(order.total) || 0), 0);

                        results.push({
                            label: `${year}`,
                            revenue,
                            orderCount: yearOrders.length
                        });
                    }
                } else {
                    for (let i = 5; i >= 0; i--) {
                        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
                        const year = date.getFullYear();
                        const month = date.getMonth() + 1;
                        const start = new Date(year, month - 1, 1);
                        const end = new Date(year, month, 0, 23, 59, 59, 999);

                        const monthOrders = getOrdersForDate(start, end);
                        const revenue = monthOrders.reduce((sum, order) => sum + (Number(order.total) || 0), 0);

                        results.push({
                            label: `T${month}/${year}`,
                            revenue,
                            orderCount: monthOrders.length
                        });
                    }
                }

                return results;
            }

            // Customer Search and Quick Add Functions
            filterCustomers(searchTerm) {
                const customerSelect = document.getElementById('customer-select');
                if (!customerSelect) return;

                const options = customerSelect.querySelectorAll('option');
                let hasVisibleOptions = false;

                options.forEach((option, index) => {
                    if (index === 0) { // Keep the placeholder option
                        option.style.display = '';
                        return;
                    }

                    const text = option.textContent.toLowerCase();
                    const matches = text.includes(searchTerm.toLowerCase());
                    option.style.display = matches ? '' : 'none';

                    if (matches) hasVisibleOptions = true;
                });

                // If no matches, show a "not found" option temporarily
                if (!hasVisibleOptions && searchTerm) {
                    const notFoundOption = customerSelect.querySelector('.not-found-option');
                    if (notFoundOption) {
                        notFoundOption.remove();
                    }

                    const newOption = document.createElement('option');
                    newOption.value = '';
                    newOption.textContent = '❌ Không tìm thấy khách hàng';
                    newOption.className = 'not-found-option';
                    newOption.disabled = true;
                    customerSelect.appendChild(newOption);
                } else {
                    // Remove not found option if exists
                    const notFoundOption = customerSelect.querySelector('.not-found-option');
                    if (notFoundOption) {
                        notFoundOption.remove();
                    }
                }
            }

            showQuickAddCustomer() {
                const quickAddHTML = `
                    <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); z-index: 1002; display: flex; justify-content: center; align-items: center;" onclick="closeModal(this)">
                        <div style="background: white; padding: 32px; border-radius: 12px; width: 600px; max-width: 90vw;" onclick="event.stopPropagation()">
                            <h3 style="margin-bottom: 24px; color: var(--text-primary);">➕ Thêm khách hàng mới</h3>
                            <form onsubmit="app.quickAddCustomer(event)">
                                <!-- Hàng 1: Tên KH và Loại KH -->
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                                    <div>
                                        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Tên khách hàng: *</label>
                                        <input type="text" name="customerName" required 
                                               style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                    </div>
                                    <div>
                                        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Loại khách hàng: *</label>
                                        <select name="customerType" required onchange="app.toggleCustomerFields(this.value)"
                                               style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                            <option value="">Chọn loại</option>
                                            <option value="ca-nhan">Cá nhân</option>
                                            <option value="doanh-nghiep">Doanh nghiệp</option>
                                        </select>
                                    </div>
                                </div>

                                <!-- Hàng 2: Tên công ty và Phòng ban (ẩn/hiện) -->
                                <div id="company-field" style="margin-bottom: 16px; display: none;">
                                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                                        <div>
                                            <label style="display: block; margin-bottom: 8px; font-weight: 600;">Tên công ty: *</label>
                                            <input type="text" name="companyName" 
                                                   style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                        </div>
                                        <div>
                                            <label style="display: block; margin-bottom: 8px; font-weight: 600;">Phòng ban:</label>
                                            <input type="text" name="department" placeholder="VD: Phòng kế toán, Phòng kinh doanh..."
                                                   style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                        </div>
                                    </div>
                                </div>

                                <!-- Hàng 3: Điện thoại và Mã số thuế -->
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                                    <div>
                                        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Số điện thoại: *</label>
                                        <input type="tel" name="customerPhone" required 
                                               style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                    </div>
                                    <div id="tax-field" style="display: none;">
                                        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Mã số thuế:</label>
                                        <input type="text" name="taxCode"
                                               style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                    </div>
                                </div>

                                <!-- Hàng 4: Địa chỉ chi tiết -->
                                <div style="margin-bottom: 16px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Địa chỉ:</label>
                                    <textarea name="customerAddress" rows="2"
                                              style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; resize: vertical;"></textarea>
                                </div>

                                <!-- Hàng 5: Tỉnh/thành, Quận/huyện, Phường/xã -->
                                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 16px;">
                                    <div>
                                        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Tỉnh/Thành:</label>
                                        <input type="text" name="customerProvince"
                                               style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                    </div>
                                    <div>
                                        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Quận/Huyện:</label>
                                        <input type="text" name="customerDistrict"
                                               style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                    </div>
                                    <div>
                                        <label style="display: block; margin-bottom: 8px; font-weight: 600;">Phường/Xã:</label>
                                        <input type="text" name="customerWard"
                                               style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px;">
                                    </div>
                                </div>

                                <!-- Hàng 6: Ghi chú -->
                                <div style="margin-bottom: 24px;">
                                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Ghi chú khách hàng:</label>
                                    <textarea name="customerNotes" rows="3" placeholder="Nhập ghi chú về khách hàng (không bắt buộc)"
                                              style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; resize: vertical;"></textarea>
                                </div>

                                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                                    <button type="button" onclick="closeModal(this.closest('div[style*=fixed]'))" 
                                            style="padding: 12px 24px; border: 2px solid #e5e7eb; background: white; border-radius: 8px; cursor: pointer;">Hủy</button>
                                    <button type="submit" 
                                            style="padding: 12px 24px; background: var(--primary-green); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">Thêm khách hàng</button>
                                </div>
                            </form>
                        </div>
                    </div>
                `;
                document.body.insertAdjacentHTML('beforeend', quickAddHTML);
            }

            toggleCustomerFields(customerType) {
                const companyField = document.getElementById('company-field');
                const taxField = document.getElementById('tax-field');
                const companyInput = document.querySelector('input[name="companyName"]');
                const departmentInput = document.querySelector('input[name="department"]');

                if (customerType === 'doanh-nghiep') {
                    companyField.style.display = 'block';
                    taxField.style.display = 'block';
                    companyInput.required = true;
                } else {
                    companyField.style.display = 'none';
                    taxField.style.display = 'none';
                    companyInput.required = false;
                    companyInput.value = '';
                    if (departmentInput) departmentInput.value = '';
                    document.querySelector('input[name="taxCode"]').value = '';
                }
            }

            quickAddCustomer(event) {
                event.preventDefault();
                const formData = new FormData(event.target);

                const newCustomer = {
                    id: 'KH' + String(Date.now()).slice(-6),
                    name: formData.get('customerName'),
                    type: formData.get('customerType'),
                    companyName: formData.get('companyName') || '',
                    department: formData.get('department') || '',
                    phone: formData.get('customerPhone'),
                    address: formData.get('customerAddress') || '',
                    province: formData.get('customerProvince') || '',
                    district: formData.get('customerDistrict') || '',
                    ward: formData.get('customerWard') || '',
                    taxCode: formData.get('taxCode') || '',
                    notes: formData.get('customerNotes') || '',
                    totalOrders: 0
                };

                // Add to demo data
                this.demoData.customers.push(newCustomer);

                // Update customer select in the current form
                const customerSelect = document.getElementById('customer-select');
                if (customerSelect) {
                    const newOption = document.createElement('option');
                    newOption.value = newCustomer.id;
                    newOption.textContent = `${newCustomer.name} - ${newCustomer.phone}`;
                    customerSelect.appendChild(newOption);

                    // Select the newly added customer
                    customerSelect.value = newCustomer.id;
                }

                // Close the modal
                const modal = event.target.closest("div[style*=\"fixed\"]");
                if (modal) modal.remove();

                // Clear search box
                const searchInput = document.getElementById('customer-search');
                if (searchInput) {
                    searchInput.value = '';
                    this.filterCustomers(''); // Reset filter
                }

                this.showNotification(`Đã thêm khách hàng "${newCustomer.name}" và chọn tự động`, 'success');
            }

            // Show print options popup when clicking "IN" button
            showPrintOptionsPopup(index) {
                console.log('=== SHOWING PRINT OPTIONS ===');
                console.log('Index:', index);

                try {
                    const order = this.demoData.orders[index];

                    if (!order) {
                        this.showNotification('❌ Không tìm thấy đơn hàng!', 'error');
                        return;
                    }

                    const printOptionsHTML = `
                        <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 1001; display: flex; justify-content: center; align-items: center;" onclick="closeModal(this)">
                            <div style="background: white; padding: 32px; border-radius: 12px; width: 480px; max-width: 90vw;" onclick="event.stopPropagation()">
                                <h3 style="margin-bottom: 20px; color: #22c55e; text-align: center; display: flex; align-items: center; justify-content: center; gap: 8px;">
                                    🖨️ Chọn loại hóa đơn in
                                </h3>
                                <p style="margin-bottom: 25px; color: #666; text-align: center; font-size: 15px;">
                                    Đơn hàng <strong>${order.id}</strong> - ${order.total.toLocaleString('vi-VN')} đ
                                </p>

                                <div style="display: flex; flex-direction: column; gap: 15px;">
                                    <button onclick="app.testPrintInvoice(${index}); closeModal(this.closest('[style*=fixed]'))" 
                                            style="background: #22c55e; color: white; border: none; padding: 16px 24px; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 16px; display: flex; align-items: center; justify-content: center; gap: 10px; transition: all 0.2s ease;">
                                        📄 IN đúng giá
                                        <span style="font-size: 13px; opacity: 0.9;">(Giá gốc không VAT)</span>
                                    </button>

                                    <button onclick="app.printInvoiceWithVAT(${index}); closeModal(this.closest('[style*=fixed]'))" 
                                            style="background: #8B5CF6; color: white; border: none; padding: 16px 24px; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 16px; display: flex; align-items: center; justify-content: center; gap: 10px; transition: all 0.2s ease;">
                                        📊 In có VAT
                                        <span style="font-size: 13px; opacity: 0.9;">(Có tính thuế GTGT)</span>
                                    </button>
                                </div>

                                <div style="text-align: center; margin-top: 20px;">
                                    <button onclick="closeModal(this.closest('[style*=fixed]'))" 
                                            style="background: #ef4444; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: 600;">
                                        ❌ Hủy
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;

                    document.body.insertAdjacentHTML('beforeend', printOptionsHTML);

                } catch (error) {
                    console.error('Lỗi hiển thị popup:', error);
                    this.showNotification('❌ Lỗi hiển thị popup: ' + error.message, 'error');
                }
            }

            // Helper function to format customer info for display
            formatCustomerInfo(customer, includePaymentStatus = false, order = null) {
                let customerInfo = `
                    <div class="info-row">
                        <span class="info-label">Tên khách hàng:</span>
                        <span class="info-value">${customer.name}</span>
                    </div>`;

                if (customer.type === 'doanh-nghiep' && customer.companyName) {
                    customerInfo += `
                    <div class="info-row">
                        <span class="info-label">Công ty:</span>
                        <span class="info-value">${customer.companyName}</span>
                    </div>`;
                }

                if (customer.type === 'doanh-nghiep' && customer.department) {
                    customerInfo += `
                    <div class="info-row">
                        <span class="info-label">Phòng ban:</span>
                        <span class="info-value">${customer.department}</span>
                    </div>`;
                }

                customerInfo += `
                    <div class="info-row">
                        <span class="info-label">Số điện thoại:</span>
                        <span class="info-value">${customer.phone}</span>
                    </div>`;

                if (customer.type === 'doanh-nghiep' && customer.taxCode) {
                    customerInfo += `
                    <div class="info-row">
                        <span class="info-label">Mã số thuế:</span>
                        <span class="info-value">${customer.taxCode}</span>
                    </div>`;
                }

                customerInfo += `
                    <div class="info-row">
                        <span class="info-label">Địa chỉ:</span>
                        <span class="info-value">${customer.address || 'Không có'}</span>
                    </div>`;

                if (includePaymentStatus && order) {
                    customerInfo += `
                    <div class="info-row">
                        <span class="info-label">Trạng thái TT:</span>
                        <span class="info-value" style="color: ${order.paymentStatus === 'Đã thanh toán' ? '#22c55e' : '#f59e0b'}; font-weight: 600;">
                            ${order.paymentStatus}
                        </span>
                    </div>`;
                }

                return customerInfo;
            }

            // Professional Vietnamese Invoice Print Function
            testPrintInvoice(index) {
                console.log('=== PRINTING GANZA ORDER ===');
                console.log('Index:', index);

                try {
                    const order = this.demoData.orders[index];
                    console.log('Order data:', order);

                    if (!order) {
                        this.showNotification('❌ Không tìm thấy đơn hàng!', 'error');
                        return;
                    }

                    if (!order.products || !Array.isArray(order.products)) {
                        console.error('Order products not found or not an array:', order.products);
                        this.showNotification('❌ Đơn hàng không có sản phẩm!', 'error');
                        return;
                    }

                    // Find customer info
                    const customer = this.demoData.customers.find(c => c.id === order.customerId) || { 
                        name: order.customerName, 
                        phone: order.customerPhone || '', 
                        address: order.customerAddress || '',
                        email: ''
                    };

                    // Get company settings
                    const companySettings = this.getCompanySettings();
                    if (window.companyAssets && window.companyAssets.logo) {
                        companySettings.logo = window.companyAssets.logo;
                    }
                    if (window.companyAssets && window.companyAssets.qr) {
                        companySettings.qrCode = window.companyAssets.qr;
                    }

                    // Calculate totals
                    let totalQuantity = 0;
                    let totalBeforeDiscount = 0;
                    let totalDiscountAmount = 0;

                    const productRows = (order.products || []).map((item, idx) => {
                        const discount = item.discount || 0;
                        const discountType = item.discountType || 'percent';
                        const beforeDiscount = item.price * item.quantity;
                        let discountAmt = 0;
                        if (discountType === 'amount') {
                            discountAmt = discount;
                        } else {
                            discountAmt = beforeDiscount * discount / 100;
                        }
                        const subtotal = beforeDiscount - discountAmt;
                        totalQuantity += item.quantity;
                        totalBeforeDiscount += beforeDiscount;
                        totalDiscountAmount += discountAmt;

                        const discountDisplay = discountType === 'amount' 
                            ? (discount > 0 ? discount.toLocaleString('vi-VN') + 'đ' : '0') 
                            : (discount + '%');

                        return `
                            <tr>
                                <td>${idx + 1}</td>
                                <td style="font-weight:600;">${item.id || ''}</td>
                                <td style="text-align:left;">${item.name || 'N/A'}</td>
                                <td>Tải</td>
                                <td>${item.quantity}</td>
                                <td>${(item.price || 0).toLocaleString('vi-VN')}</td>
                                <td>${discountDisplay}</td>
                                <td style="font-weight:600;">${subtotal.toLocaleString('vi-VN')}</td>
                            </tr>`;
                    }).join('');

                    // Format date
                    const orderDate = order.date ? order.date.split('-').reverse().join('-') : '';
                    const shippingFee = Number(order.shippingFee) || 0;
                    const finalTotal = Number(order.total) || (totalBeforeDiscount - totalDiscountAmount + shippingFee);

                    // Customer address parts
                    const addressParts = [customer.address, customer.ward, customer.district, customer.province].filter(Boolean);
                    const fullAddress = addressParts.join(' - ') || '';

                    const invoiceWindow = window.open('', '_blank', 'width=800,height=1000');

                    if (!invoiceWindow) {
                        this.showNotification('❌ Popup bị chặn! Hãy cho phép popup.', 'error');
                        return;
                    }

                    invoiceWindow.document.write(`
                        <!DOCTYPE html>
                        <html lang="vi">
                        <head>
                            <meta charset="UTF-8">
                            <meta name="viewport" content="width=device-width, initial-scale=1.0">
                            <title>Đơn hàng ${order.id}</title>
                            <style>
                                * { margin: 0; padding: 0; box-sizing: border-box; }
                                body { 
                                    font-family: 'Times New Roman', serif; 
                                    font-size: 13px; 
                                    line-height: 1.5; 
                                    color: #333; 
                                    padding: 20px;
                                    background: white;
                                }
                                .invoice-page { max-width: 750px; margin: 0 auto; background: white; }

                                /* === HEADER === */
                                .header-section {
                                    display: flex;
                                    align-items: flex-start;
                                    margin-bottom: 10px;
                                    gap: 15px;
                                }
                                .header-logo {
                                    flex: 0 0 120px;
                                    text-align: center;
                                }
                                .header-logo img {
                                    max-width: 100px;
                                    max-height: 80px;
                                    object-fit: contain;
                                }
                                .header-logo .logo-text {
                                    font-size: 16px;
                                    font-weight: bold;
                                    color: #c8102e;
                                    margin-top: 4px;
                                }
                                .header-logo .logo-slogan {
                                    font-size: 7px;
                                    color: #c8102e;
                                    letter-spacing: 1px;
                                }
                                .header-company {
                                    flex: 1;
                                    text-align: center;
                                }
                                .header-company .company-name {
                                    font-size: 15px;
                                    font-weight: bold;
                                    color: #333;
                                    margin-bottom: 4px;
                                }
                                .header-company .company-detail {
                                    font-size: 12px;
                                    color: #555;
                                    line-height: 1.4;
                                }
                                .header-order {
                                    flex: 0 0 180px;
                                    text-align: right;
                                    font-size: 12px;
                                }
                                .header-order .order-code {
                                    font-weight: bold;
                                    color: #c8102e;
                                }

                                /* === TITLE === */
                                .invoice-title {
                                    text-align: center;
                                    font-size: 22px;
                                    font-weight: bold;
                                    margin: 15px 0 20px 0;
                                    color: #1a1a1a;
                                }

                                /* === CUSTOMER INFO === */
                                .customer-section {
                                    margin-bottom: 15px;
                                    font-size: 13px;
                                }
                                .customer-row {
                                    display: flex;
                                    justify-content: space-between;
                                    margin-bottom: 3px;
                                }
                                .customer-row .label {
                                    color: #555;
                                }
                                .customer-row .value {
                                    font-weight: 600;
                                }
                                .customer-address {
                                    margin-top: 2px;
                                    font-size: 12px;
                                    color: #333;
                                }

                                /* === PRODUCT TABLE === */
                                .products-table {
                                    width: 100%;
                                    border-collapse: collapse;
                                    margin-bottom: 20px;
                                    font-size: 12px;
                                }
                                .products-table th {
                                    background: #f5f5f5;
                                    border: 1px solid #bbb;
                                    padding: 8px 5px;
                                    text-align: center;
                                    font-weight: bold;
                                    font-size: 11px;
                                    color: #333;
                                }
                                .products-table td {
                                    border: 1px solid #bbb;
                                    padding: 7px 5px;
                                    text-align: center;
                                    vertical-align: middle;
                                }
                                .products-table tr:nth-child(even) {
                                    background: #fafafa;
                                }

                                /* === BOTTOM SECTION (QR + Summary) === */
                                .bottom-section {
                                    display: flex;
                                    gap: 30px;
                                    margin-bottom: 30px;
                                    align-items: flex-start;
                                }
                                .bottom-qr {
                                    flex: 0 0 180px;
                                    text-align: center;
                                }
                                .bottom-qr img {
                                    max-width: 150px;
                                    max-height: 150px;
                                    object-fit: contain;
                                    margin-top: 8px;
                                }
                                .bottom-qr .bank-logo {
                                    max-width: 140px;
                                    margin-bottom: 5px;
                                }
                                .bottom-summary {
                                    flex: 1;
                                }
                                .summary-row {
                                    display: flex;
                                    justify-content: space-between;
                                    padding: 7px 0;
                                    border-bottom: 1px solid #e5e7eb;
                                    font-size: 13px;
                                }
                                .summary-row .label {
                                    color: #555;
                                }
                                .summary-row .value {
                                    font-weight: 600;
                                    text-align: right;
                                    min-width: 120px;
                                }
                                .summary-row.final {
                                    font-size: 15px;
                                    font-weight: bold;
                                    color: #c8102e;
                                    border-bottom: 2px solid #c8102e;
                                    border-top: 2px solid #c8102e;
                                    padding: 10px 0;
                                    margin-top: 5px;
                                }
                                .summary-row.final .value {
                                    font-size: 16px;
                                }

                                /* === SIGNATURE === */
                                .signature-section {
                                    display: flex;
                                    justify-content: space-between;
                                    margin-top: 20px;
                                    text-align: center;
                                }
                                .signature-box {
                                    width: 45%;
                                }
                                .signature-name {
                                    font-weight: bold;
                                    font-size: 14px;
                                    color: #1a6e9e;
                                    margin-bottom: 2px;
                                }
                                .signature-phone {
                                    font-size: 13px;
                                    color: #1a6e9e;
                                    margin-bottom: 15px;
                                }
                                .signature-label {
                                    font-weight: bold;
                                    font-size: 13px;
                                    text-transform: uppercase;
                                    color: #333;
                                }

                                /* === PRINT === */
                                .print-buttons {
                                    text-align: center;
                                    margin: 25px 0;
                                    padding: 15px;
                                    background: #f8fafc;
                                    border-radius: 8px;
                                }
                                .btn {
                                    padding: 10px 22px;
                                    margin: 0 8px;
                                    border: none;
                                    border-radius: 6px;
                                    font-weight: 600;
                                    cursor: pointer;
                                    font-size: 14px;
                                }
                                .btn-print { background: #22c55e; color: white; }
                                .btn-close { background: #ef4444; color: white; }
                                .btn:hover { opacity: 0.9; }

                                @media print {
                                    body { margin: 0; padding: 10px; }
                                    .no-print { display: none !important; }
                                }
                            </style>
                        </head>
                        <body>
                            <div class="invoice-page">
                                <!-- HEADER -->
                                <div class="header-section">
                                    <div class="header-logo">
                                        ${companySettings.logo 
                                            ? `<img src="${companySettings.logo}" alt="Logo">`
                                            : `<div style="font-size:28px; font-weight:bold; color:#c8102e;">📋</div>`
                                        }
                                        <div class="logo-text">GANZA</div>
                                        <div class="logo-slogan">ALL YOU NEED, WE HAVE</div>
                                    </div>
                                    <div class="header-company">
                                        <div class="company-name">${companySettings.companyName || 'CÔNG TY TNHH TMDV XNK GANZA'}</div>
                                        <div class="company-detail">
                                            Địa chỉ: ${companySettings.address || '76 Tôn Thất Thuyết, Phường Khuê Trung, Quận Cẩm Lệ, TP Đà Nẵng'}<br>
                                            Liên hệ: ${companySettings.phone || '0889559119'}
                                        </div>
                                    </div>
                                    <div class="header-order">
                                        Mã đơn hàng: <span class="order-code">${order.id}</span><br>
                                        Ngày tạo: ${orderDate}
                                    </div>
                                </div>

                                <!-- TITLE -->
                                <div class="invoice-title">Đơn hàng</div>

                                <!-- CUSTOMER INFO -->
                                <div class="customer-section">
                                    <div class="customer-row">
                                        <div><span class="label">Hóa đơn đến:</span></div>
                                        <div><span class="label">Điện thoại:</span> <span class="value">${customer.phone || ''}</span></div>
                                    </div>
                                    <div class="customer-row">
                                        <div><strong>${customer.name || ''}</strong></div>
                                        <div><span class="label">Email:</span> <span class="value">${customer.email || ''}</span></div>
                                    </div>
                                    ${fullAddress ? `<div class="customer-address">${fullAddress}</div>` : ''}
                                    ${order.deliveryMethod ? `<div class="customer-row"><span class="label">Hình thức giao:</span> <span class="value">${order.deliveryMethod}</span></div>` : ''}
                                    ${order.deliveryNotes ? `<div class="customer-row"><span class="label">Ghi chú giao hàng:</span> <span class="value">${order.deliveryNotes}</span></div>` : ''}
                                </div>

                                <!-- PRODUCT TABLE -->
                                <table class="products-table">
                                    <thead>
                                        <tr>
                                            <th style="width:5%;">STT</th>
                                            <th style="width:12%;">Mã sản phẩm</th>
                                            <th style="width:28%;">Tên sản phẩm</th>
                                            <th style="width:8%;">Đơn vị</th>
                                            <th style="width:10%;">Số lượng</th>
                                            <th style="width:14%;">Đơn giá</th>
                                            <th style="width:10%;">Chiết khấu</th>
                                            <th style="width:13%;">Thành tiền</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${productRows}
                                    </tbody>
                                </table>

                                <!-- BOTTOM: QR + SUMMARY -->
                                <div class="bottom-section">
                                    <div class="bottom-qr">
                                        ${companySettings.qrCode 
                                            ? `<img src="${companySettings.qrCode}" alt="QR Code">`
                                            : '<div style="width:150px;height:150px;border:2px dashed #ccc;display:flex;align-items:center;justify-content:center;color:#aaa;font-size:12px;margin:8px auto;">QR Code</div>'
                                        }
                                    </div>
                                    <div class="bottom-summary">
                                        <div class="summary-row">
                                            <span class="label">Tổng số lượng</span>
                                            <span class="value">${totalQuantity}</span>
                                        </div>
                                        <div class="summary-row">
                                            <span class="label">Tổng Tiền</span>
                                            <span class="value">${totalBeforeDiscount.toLocaleString('vi-VN')}</span>
                                        </div>
                                        <div class="summary-row">
                                            <span class="label">VAT</span>
                                            <span class="value">0</span>
                                        </div>
                                        <div class="summary-row">
                                            <span class="label">Chiết khấu</span>
                                            <span class="value">${totalDiscountAmount > 0 ? totalDiscountAmount.toLocaleString('vi-VN') : '0'}</span>
                                        </div>
                                        <div class="summary-row">
                                            <span class="label">Phí giao hàng</span>
                                            <span class="value">${shippingFee.toLocaleString('vi-VN')}</span>
                                        </div>
                                        <div class="summary-row final">
                                            <span class="label">Khách phải trả</span>
                                            <span class="value">${finalTotal.toLocaleString('vi-VN')}</span>
                                        </div>
                                    </div>
                                </div>

                                <!-- PRINT BUTTONS -->
                                <div class="print-buttons no-print">
                                    <button class="btn btn-print" onclick="window.print()">🖨️ In đơn hàng</button>
                                    <button class="btn btn-close" onclick="window.close()">❌ Đóng</button>
                                </div>

                                <!-- SIGNATURE -->
                                <div class="signature-section">
                                    <div class="signature-box">
                                        <div class="signature-name">${customer.name || ''}</div>
                                        <div class="signature-phone">${customer.phone || ''}</div>
                                        <div class="signature-label">KHÁCH HÀNG XÁC NHẬN</div>
                                    </div>
                                    <div class="signature-box">
                                        <div style="height:40px;"></div>
                                        <div class="signature-label">ĐẠI DIỆN CÔNG TY GANZA</div>
                                    </div>
                                </div>
                            </div>
                        </body>
                        </html>
                    `);

                    invoiceWindow.document.close();
                    invoiceWindow.focus();

                    this.showNotification(`✅ Đã mở đơn hàng ${order.id}`, 'success');

                } catch (error) {
                    console.error('Lỗi in đơn hàng:', error);
                    this.showNotification('❌ Lỗi in đơn hàng: ' + error.message, 'error');
                }
            }

            // Professional Vietnamese Invoice Print Function with VAT
            printInvoiceWithVAT(index) {
                console.log('=== PRINTING INVOICE WITH VAT ===');
                console.log('Index:', index);

                try {
                    const order = this.demoData.orders[index];
                    console.log('Order data:', order);

                    if (!order) {
                        this.showNotification('❌ Không tìm thấy đơn hàng!', 'error');
                        return;
                    }

                    // Show VAT adjustment popup
                    this.showVATAdjustmentPopup(index);

                } catch (error) {
                    console.error('Lỗi in hóa đơn VAT:', error);
                    this.showNotification('❌ Lỗi in hóa đơn VAT: ' + error.message, 'error');
                }
            }

            // Show VAT adjustment popup
            showVATAdjustmentPopup(orderIndex) {
                const order = this.demoData.orders[orderIndex];
                const vatPopupHTML = `
                    <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 1001; display: flex; justify-content: center; align-items: center;" onclick="closeModal(this)">
                        <div style="background: white; padding: 32px; border-radius: 12px; width: 500px; max-width: 90vw;" onclick="event.stopPropagation()">
                            <h3 style="margin-bottom: 20px; color: #2563eb; text-align: center;">⚙️ Điều chỉnh thuế VAT</h3>
                            <p style="margin-bottom: 20px; color: #666; text-align: center;">Chọn mức thuế VAT để in hóa đơn</p>

                            <div style="margin-bottom: 20px;">
                                <label style="display: block; margin-bottom: 8px; font-weight: 600;">Thuế VAT (%):</label>
                                <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 12px;">
                                    <button type="button" onclick="app.setVATPercent(0, ${orderIndex})" style="flex: 1 1 100px; padding: 10px 12px; border-radius: 8px; border: 1px solid #e5e7eb; background: #f8fafc; cursor: pointer;">Không VAT</button>
                                    <button type="button" onclick="app.setVATPercent(8, ${orderIndex})" style="flex: 1 1 100px; padding: 10px 12px; border-radius: 8px; border: 1px solid #e5e7eb; background: #f0f9ff; cursor: pointer;">VAT 8%</button>
                                    <button type="button" onclick="app.setVATPercent(10, ${orderIndex})" style="flex: 1 1 100px; padding: 10px 12px; border-radius: 8px; border: 1px solid #e5e7eb; background: #dcfce7; cursor: pointer;">VAT 10%</button>
                                </div>
                                <input type="number" id="vatPercent" min="0" max="100" value="10" step="0.5" 
                                       style="width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 16px; text-align: center;"
                                       oninput="app.updateVATPreview(this.value, ${orderIndex})">
                            </div>

                            <div id="vat-preview" style="background: #f8fafc; padding: 16px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #2563eb;">
                                <!-- VAT preview will be populated by JavaScript -->
                            </div>

                            <div style="display: flex; gap: 12px; justify-content: center;">
                                <button onclick="app.printWithVATAmount(${orderIndex}, document.getElementById('vatPercent').value)" 
                                        style="background: #22c55e; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600;">
                                    🖨️ In với VAT
                                </button>
                                <button onclick="closeModal(this.closest('[style*=fixed]'))" 
                                        style="background: #ef4444; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600;">
                                    ❌ Hủy
                                </button>
                            </div>
                        </div>
                    </div>
                `;

                document.body.insertAdjacentHTML('beforeend', vatPopupHTML);

                // Initialize VAT preview
                this.updateVATPreview(10, orderIndex);
            }

            // Update VAT preview calculation
            updateVATPreview(vatPercent, orderIndex) {
                const order = this.demoData.orders[orderIndex];
                const vatRate = parseFloat(vatPercent) || 0;
                const shippingFee = Number(order.shippingFee) || 0;
                const subtotal = (order.products || []).reduce((sum, item) => {
                    const qty = Number(item.quantity) || 0;
                    const price = Number(item.price) || 0;
                    const discount = Number(item.discount) || 0;
                    const discountType = item.discountType || 'percent';
                    const beforeDiscount = qty * price;
                    const discountAmount = discountType === 'amount' ? discount : beforeDiscount * discount / 100;
                    return sum + (beforeDiscount - discountAmount);
                }, 0) + shippingFee;
                const vatAmount = (subtotal * vatRate) / 100;
                const totalWithVAT = subtotal + vatAmount;

                const previewElement = document.getElementById('vat-preview');
                if (previewElement) {
                    previewElement.innerHTML = `
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                            <span>Tạm tính:</span>
                            <span style="font-weight: 600;">${subtotal.toLocaleString('vi-VN')} đ</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px; color: #2563eb;">
                            <span>Thuế VAT (${vatRate}%):</span>
                            <span style="font-weight: 600;">+ ${vatAmount.toLocaleString('vi-VN')} đ</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; border-top: 2px solid #e5e7eb; padding-top: 8px; font-size: 18px;">
                            <span style="font-weight: bold;">Tổng cộng:</span>
                            <span style="font-weight: bold; color: #22c55e;">${totalWithVAT.toLocaleString('vi-VN')} đ</span>
                        </div>
                    `;
                }
            }

            setVATPercent(vatPercent, orderIndex) {
                const vatInput = document.getElementById('vatPercent');
                if (vatInput) {
                    vatInput.value = vatPercent;
                }
                this.updateVATPreview(vatPercent, orderIndex);
            }

            // Print invoice with specified VAT amount
            printWithVATAmount(orderIndex, vatPercent) {
                try {
                    const order = this.demoData.orders[orderIndex];
                    const vatRate = parseFloat(vatPercent) || 0;

                    if (!order) {
                        this.showNotification('❌ Không tìm thấy đơn hàng!', 'error');
                        return;
                    }

                    // Check if products exist
                    if (!order.products || !Array.isArray(order.products)) {
                        this.showNotification('❌ Đơn hàng không có sản phẩm!', 'error');
                        return;
                    }

                    // Find customer info
                    const customer = this.demoData.customers.find(c => c.id === order.customerId) || { 
                        name: order.customerName, 
                        phone: order.customerPhone || 'Không có', 
                        address: order.customerAddress || 'Không có' 
                    };

                    const shippingFee = Number(order.shippingFee) || 0;
                    const productTotal = (order.products || []).reduce((sum, item) => {
                        const qty = Number(item.quantity) || 0;
                        const price = Number(item.price) || 0;
                        const discount = Number(item.discount) || 0;
                        const discountType = item.discountType || 'percent';
                        const beforeDiscount = qty * price;
                        const discountAmount = discountType === 'amount' ? discount : beforeDiscount * discount / 100;
                        return sum + (beforeDiscount - discountAmount);
                    }, 0);
                    const subtotal = productTotal + shippingFee;
                    const vatAmount = (subtotal * vatRate) / 100;
                    const totalWithVAT = subtotal + vatAmount;

                    // HOSTING SOLUTION: Get company settings + global assets
                    const companySettings = this.getCompanySettings();

                    // Override with global assets if available (for hosting)
                    if (window.companyAssets && window.companyAssets.logo) {
                        companySettings.logo = window.companyAssets.logo;
                    }
                    if (window.companyAssets && window.companyAssets.qr) {
                        companySettings.qrCode = window.companyAssets.qr;
                    }

                    console.log('✅ HOSTING READY - Logo/QR from global assets');
                    console.log('Logo data:', companySettings.logo ? 'Found' : 'Not found');
                    console.log('QR data:', companySettings.qrCode ? 'Found' : 'Not found');

                    // Close the VAT popup
                    const popup = document.querySelector('div[style*="fixed"]');
                    if (popup) popup.remove();

                    // Professional invoice window with VAT
                    const invoiceWindow = window.open('', '_blank', 'width=800,height=900');

                    if (!invoiceWindow) {
                        this.showNotification('❌ Popup bị chặn! Hãy cho phép popup.', 'error');
                        return;
                    }

                    invoiceWindow.document.write(`
                        <!DOCTYPE html>
                        <html lang="vi">
                        <head>
                            <meta charset="UTF-8">
                            <meta name="viewport" content="width=device-width, initial-scale=1.0">
                            <title>Hóa đơn GTGT ${order.id}</title>
                            <style>
                                * { margin: 0; padding: 0; box-sizing: border-box; }
                                body { 
                                    font-family: 'Times New Roman', serif; 
                                    font-size: 14px; 
                                    line-height: 1.6; 
                                    color: #333; 
                                    padding: 20px;
                                    background: white;
                                }
                                .invoice-container { max-width: 800px; margin: 0 auto; background: white; }

                                .invoice-header { 
                                    display: flex;
                                    align-items: center;
                                    justify-content: space-between;
                                    border-bottom: 3px solid #8B5CF6; 
                                    padding-bottom: 20px; 
                                    margin-bottom: 30px; 
                                    gap: 20px;
                                }
                                .header-logo, .header-qr {
                                    flex: 0 0 240px;
                                    text-align: center;
                                }
                                .header-company {
                                    flex: 0 1 40%;
                                    text-align: center;
                                    min-width: 240px;
                                }
                                .header-logo img, .header-qr img {
                                    max-width: 240px;
                                    max-height: 240px;
                                    object-fit: contain;
                                }
                                .company-name { 
                                    font-size: 18px; 
                                    font-weight: bold; 
                                    color: #FFCC33; 
                                    margin-bottom: 5px; 
                                    max-width: 100%;
                                    word-break: break-word;
                                }
                                .company-info { 
                                    font-size: 13px; 
                                    color: #666; 
                                    margin-bottom: 15px; 
                                }
                                .invoice-title { 
                                    font-size: 24px; 
                                    font-weight: bold; 
                                    margin-top: 15px;
                                    color: #1a1a1a;
                                }
                                .vat-badge {
                                    background: #8B5CF6;
                                    color: white;
                                    padding: 6px 12px;
                                    border-radius: 6px;
                                    font-size: 12px;
                                    font-weight: bold;
                                    margin-left: 10px;
                                }

                                .invoice-details { 
                                    display: flex; 
                                    justify-content: space-between; 
                                    margin-bottom: 30px; 
                                    gap: 40px;
                                }
                                .invoice-info, .customer-info { 
                                    flex: 1;
                                }
                                .section-title { 
                                    font-weight: bold; 
                                    font-size: 16px;
                                    border-bottom: 2px solid #e5e7eb; 
                                    padding-bottom: 8px; 
                                    margin-bottom: 15px;
                                    color: #8B5CF6;
                                }
                                .info-row { 
                                    margin-bottom: 8px; 
                                    display: flex;
                                }
                                .info-label { 
                                    font-weight: 600; 
                                    min-width: 120px;
                                    color: #555;
                                }
                                .info-value { 
                                    color: #333;
                                }

                                .products-table { 
                                    width: 100%; 
                                    border-collapse: collapse; 
                                    margin-bottom: 30px;
                                    border: 2px solid #8B5CF6;
                                }
                                .products-table th { 
                                    background: #8B5CF6; 
                                    color: white; 
                                    padding: 12px 8px; 
                                    text-align: center; 
                                    font-weight: bold;
                                    font-size: 14px;
                                }
                                .products-table td { 
                                    padding: 10px 8px; 
                                    text-align: center; 
                                    border-bottom: 1px solid #e5e7eb;
                                }
                                .product-name { text-align: left !important; font-weight: 500; }

                                .summary-section { 
                                    background: #f8fafc; 
                                    padding: 20px; 
                                    border-radius: 12px; 
                                    margin-bottom: 30px;
                                    border: 2px solid #8B5CF6;
                                }
                                .summary-row { 
                                    display: flex; 
                                    justify-content: space-between; 
                                    margin-bottom: 12px; 
                                    font-size: 16px;
                                }
                                .summary-subtotal { font-weight: 500; }
                                .summary-vat { 
                                    font-weight: 600; 
                                    color: #8B5CF6; 
                                    background: white;
                                    padding: 8px 12px;
                                    border-radius: 6px;
                                    border: 1px solid #8B5CF6;
                                }
                                .summary-total { 
                                    font-weight: bold; 
                                    font-size: 20px; 
                                    color: #22c55e;
                                    border-top: 2px solid #8B5CF6;
                                    padding-top: 12px;
                                }

                                .footer-info { 
                                    text-align: center; 
                                    color: #666; 
                                    font-size: 12px; 
                                    border-top: 2px solid #e5e7eb; 
                                    padding-top: 20px;
                                }

                                .print-buttons { 
                                    text-align: center; 
                                    margin: 30px 0; 
                                    gap: 15px; 
                                    display: flex; 
                                    justify-content: center;
                                }
                                @media print {
                                    .no-print { display: none !important; }
                                    body { padding: 0; }
                                    .invoice-container { box-shadow: none; }
                                }
                                .btn { 
                                    padding: 12px 24px;
                                    margin: 0 10px;
                                    border: none;
                                    border-radius: 6px;
                                    font-weight: 600;
                                    cursor: pointer;
                                    font-size: 14px;
                                }
                                .btn-print { background: #8B5CF6; color: white; }
                                .btn-close { background: #ef4444; color: white; }
                                .btn:hover { opacity: 0.9; transform: translateY(-1px); }
                            </style>
                        </head>
                        <body>
                            <div class="invoice-container">
                                <!-- Header -->
                                <div class="invoice-header">
                                    <!-- Logo Section -->
                                    <div class="header-logo">
                                        ${companySettings.logo ? 
                                            `<img src="${companySettings.logo}" alt="Logo" style="max-width: 120px; max-height: 120px; object-fit: contain;">` :
                                            '<div style="color: #ccc; font-size: 12px; height: 80px; display: flex; align-items: center; justify-content: center;">Logo</div>'
                                        }
                                    </div>

                                    <!-- Company Info Section -->
                                    <div class="header-company">
                                        <div class="company-name">${companySettings.companyName || 'CÔNG TY CỔ PHẦN ABC'}</div>
                                        <div class="company-info">
                                            ${companySettings.address || '123 Đường ABC, Quận 1, TP.HCM'}<br>
                                            Điện thoại: ${companySettings.phone || '(028) 1234-5678'}${companySettings.email ? ' | Email: ' + companySettings.email : ''}<br>
                                            ${companySettings.taxCode ? 'MST: ' + companySettings.taxCode : ''}
                                            ${companySettings.description ? '<br><em>' + companySettings.description + '</em>' : ''}
                                        </div>
                                        <div class="invoice-title">
                                            HÓA ĐƠN GTGT
                                        </div>
                                    </div>

                                    <!-- QR Code Section -->
                                    <div class="header-qr">
                                        ${companySettings.qrCode ? 
                                            `<img src="${companySettings.qrCode}" alt="QR Code" style="max-width: 120px; max-height: 120px; object-fit: contain;">` :
                                            '<div style="color: #ccc; font-size: 12px; height: 80px; display: flex; align-items: center; justify-content: center;">QR Code</div>'
                                        }
                                    </div>
                                </div>

                                <!-- Invoice & Customer Details -->
                                <div class="invoice-details">
                                    <div class="invoice-info">
                                        <div class="section-title">Thông tin hóa đơn</div>
                                        <div class="info-row">
                                            <span class="info-label">Số hóa đơn:</span>
                                            <span class="info-value">${order.id}</span>
                                        </div>
                                        <div class="info-row">
                                            <span class="info-label">Ngày lập:</span>
                                            <span class="info-value">${order.date}</span>
                                        </div>
                                        <div class="info-row">
                                            <span class="info-label">Giờ lập:</span>
                                            <span class="info-value">${order.time}</span>
                                        </div>
                                        <div class="info-row">
                                            <span class="info-label">Hình thức TT:</span>
                                            <span class="info-value">${order.paymentMethod}</span>
                                        </div>
                                    </div>

                                    <div class="customer-info">
                                        <div class="section-title">Thông tin khách hàng</div>
                                        <div class="info-row">
                                            <span class="info-label">Tên khách hàng:</span>
                                            <span class="info-value">${customer.name}</span>
                                        </div>
                                        <div class="info-row">
                                            <span class="info-label">Số điện thoại:</span>
                                            <span class="info-value">${customer.phone}</span>
                                        </div>
                                        <div class="info-row">
                                            <span class="info-label">Địa chỉ:</span>
                                            <span class="info-value">${customer.address}</span>
                                        </div>
                                        <div class="info-row">
                                            <span class="info-label">Trạng thái TT:</span>
                                            <span class="info-value" style="color: ${order.paymentStatus === 'Đã thanh toán' ? '#22c55e' : '#f59e0b'}; font-weight: 600;">
                                                ${order.paymentStatus}
                                            </span>
                                        </div>
                                        ${order.deliveryMethod ? `<div class="info-row"><span class="info-label">Hình thức giao:</span><span class="info-value">${order.deliveryMethod}</span></div>` : ''}
                                        ${order.deliveryNotes ? `<div class="info-row"><span class="info-label">Ghi chú giao hàng:</span><span class="info-value">${order.deliveryNotes}</span></div>` : ''}
                                    </div>
                                </div>

                                <!-- Products Table -->
                                <table class="products-table">
                                    <thead>
                                        <tr>
                                            <th style="width: 5%;">STT</th>
                                            <th style="width: 35%;">Tên sản phẩm</th>
                                            <th style="width: 15%;">Đơn giá</th>
                                            <th style="width: 10%;">SL</th>
                                            <th style="width: 15%;">Giảm giá</th>
                                            <th style="width: 20%;">Thành tiền</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${(order.products || []).map((item, index) => {
                                            const discount = item.discount || 0;
                                            const subtotal = item.price * item.quantity * (1 - discount / 100);
                                            return `
                                            <tr>
                                                <td>${index + 1}</td>
                                                <td class="product-name">${item.name || 'N/A'}</td>
                                                <td>${(item.price || 0).toLocaleString('vi-VN')} đ</td>
                                                <td>${item.quantity || 0}</td>
                                                <td>${discount}%</td>
                                                <td style="font-weight: 600;">${subtotal.toLocaleString('vi-VN')} đ</td>
                                            </tr>
                                            `;
                                        }).join('')}
                                    </tbody>
                                </table>

                                <!-- Summary -->
                                <div class="summary-section">
                                    <div class="summary-row summary-subtotal">
                                        <span>Tổng tiền hàng:</span>
                                        <span>${productTotal.toLocaleString('vi-VN')} đ</span>
                                    </div>
                                    ${shippingFee > 0 ? `
                                    <div class="summary-row summary-subtotal">
                                        <span>Phí giao hàng:</span>
                                        <span>+ ${shippingFee.toLocaleString('vi-VN')} đ</span>
                                    </div>
                                    ` : ''}
                                    <div class="summary-row summary-vat">
                                        <span>Thuế GTGT (${vatRate}%):</span>
                                        <span>+ ${vatAmount.toLocaleString('vi-VN')} đ</span>
                                    </div>
                                    <div class="summary-row summary-total">
                                        <span>TỔNG CỘNG:</span>
                                        <span>${totalWithVAT.toLocaleString('vi-VN')} đ</span>
                                    </div>
                                </div>

                                <!-- Print Buttons -->
                                <div class="print-buttons no-print">
                                    <button class="btn btn-print" onclick="window.print()">🖨️ In hóa đơn</button>
                                    <button class="btn btn-close" onclick="window.close()">❌ Đóng</button>
                                </div>

                                <!-- Footer -->
                                <div class="footer-info">
                                    <p><strong>Cảm ơn quý khách đã sử dụng dịch vụ!</strong></p>
                                    <p>Hóa đơn GTGT được tạo tự động bởi hệ thống GANZA ERP - ${this.getVietnamTime().toLocaleString('vi-VN', { 
                                        timeZone: 'Asia/Ho_Chi_Minh',
                                        year: 'numeric',
                                        month: '2-digit', 
                                        day: '2-digit',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        second: '2-digit'
                                    })}</p>
                                </div>
                            </div>
                        </body>
                        </html>
                    `);

                    invoiceWindow.document.close();
                    invoiceWindow.focus();

                    this.showNotification(`✅ Đã mở hóa đơn VAT ${vatRate}% cho đơn hàng ${order.id}`, 'success');

                } catch (error) {
                    console.error('Lỗi in hóa đơn VAT:', error);
                    this.showNotification('❌ Lỗi in hóa đơn VAT: ' + error.message, 'error');
                }
            }

            // Print debt report for a customer
            printDebtReport(customerId) {
                try {
                    const customer = this.demoData.customers.find(c => c.id === customerId);
                    if (!customer) {
                        this.showNotification('❌ Không tìm thấy khách hàng!', 'error');
                        return;
                    }

                    // Get company settings for report header
                    const companySettings = this.getCompanySettings();

                    // Override with global assets if available (for hosting)
                    if (window.companyAssets && window.companyAssets.logo) {
                        companySettings.logo = window.companyAssets.logo;
                    }
                    if (window.companyAssets && window.companyAssets.qr) {
                        companySettings.qrCode = window.companyAssets.qr;
                    }

                    // Find all unpaid orders for this customer
                    const unpaidOrders = this.demoData.orders.filter(order => {
                        const matchById = order.customerId === customerId;
                        const matchByName = order.customer === customer.name || order.customerName === customer.name;
                        const isUnpaid = this.getOrderRemainingBalance(order) > 0;
                        return (matchById || matchByName) && isUnpaid;
                    });

                    if (unpaidOrders.length === 0) {
                        this.showNotification('❌ Khách hàng này không có công nợ!', 'error');
                        return;
                    }

                    // Calculate total debt
                    const totalDebt = unpaidOrders.reduce((sum, order) => sum + this.getOrderRemainingBalance(order), 0);

                    // Generate debt report window
                    const reportWindow = window.open('', '_blank');
                    reportWindow.document.write(`
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <meta charset="utf-8">
                            <title>Báo cáo công nợ - ${customer.name}</title>
                            <style>
                                * { margin: 0; padding: 0; box-sizing: border-box; }
                                body { 
                                    font-family: 'Times New Roman', serif; 
                                    font-size: 13px; 
                                    line-height: 1.4; 
                                    padding: 20px; 
                                    color: #333;
                                }
                                .report-container { 
                                    max-width: 800px; 
                                    margin: 0 auto; 
                                    background: white;
                                }
                                .report-header { 
                                    display: flex;
                                    align-items: center;
                                    justify-content: space-between;
                                    margin-bottom: 30px; 
                                    border-bottom: 3px solid #dc2626; 
                                    padding-bottom: 20px;
                                    gap: 20px;
                                }
                                .header-logo, .header-qr {
                                    flex: 0 0 100px;
                                    text-align: center;
                                }
                                .header-company {
                                    flex: 0 1 40%;
                                    text-align: center;
                                }
                                .header-logo img, .header-qr img {
                                    max-width: 100px;
                                    max-height: 100px;
                                    object-fit: contain;
                                }
                                .company-name { 
                                    font-size: 16px; 
                                    font-weight: bold; 
                                    color: #FFCC33; 
                                    margin-bottom: 8px;
                                }
                                .company-info { 
                                    font-size: 12px; 
                                    color: #666; 
                                    margin-bottom: 15px; 
                                }
                                .report-title { 
                                    font-size: 22px; 
                                    font-weight: bold; 
                                    margin-top: 15px;
                                    color: #1a1a1a;
                                    text-transform: uppercase;
                                }
                                .debt-badge {
                                    background: #dc2626;
                                    color: white;
                                    padding: 6px 12px;
                                    border-radius: 6px;
                                    font-size: 12px;
                                    font-weight: bold;
                                    margin-left: 10px;
                                }

                                .report-details { 
                                    display: flex; 
                                    justify-content: space-between; 
                                    margin-bottom: 30px; 
                                    gap: 40px;
                                }
                                .report-info, .customer-info { 
                                    flex: 1;
                                }
                                .section-title { 
                                    font-weight: bold; 
                                    font-size: 16px;
                                    border-bottom: 2px solid #e5e7eb; 
                                    padding-bottom: 8px; 
                                    margin-bottom: 15px;
                                    color: #dc2626;
                                }
                                .info-row { 
                                    margin-bottom: 8px; 
                                    display: flex;
                                }
                                .info-label { 
                                    font-weight: 600; 
                                    min-width: 120px;
                                    color: #555;
                                }
                                .info-value { 
                                    color: #333;
                                }

                                .orders-table { 
                                    width: 100%; 
                                    border-collapse: collapse; 
                                    margin-bottom: 30px;
                                    border: 2px solid #dc2626;
                                }
                                .orders-table th { 
                                    background: #dc2626; 
                                    color: white; 
                                    padding: 12px 8px; 
                                    text-align: center; 
                                    font-weight: bold;
                                    font-size: 14px;
                                }
                                .orders-table td { 
                                    padding: 10px 8px; 
                                    text-align: center; 
                                    border-bottom: 1px solid #e5e7eb;
                                }
                                .order-id { text-align: left !important; font-weight: 600; }
                                .product-name { text-align: left !important; font-weight: 500; }
                                .amount { 
                                    text-align: right !important; 
                                    font-weight: 600; 
                                    color: #dc2626;
                                }

                                .totals-section { 
                                    background: #fee2e2; 
                                    padding: 20px; 
                                    border-radius: 8px; 
                                    margin-bottom: 30px;
                                    border: 2px solid #dc2626;
                                }
                                .summary-row { 
                                    display: flex; 
                                    justify-content: space-between; 
                                    padding: 8px 12px;
                                    border-radius: 6px;
                                    border: 1px solid #dc2626;
                                }
                                .summary-total { 
                                    font-weight: bold; 
                                    font-size: 18px; 
                                    color: #dc2626;
                                    border-top: 2px solid #dc2626;
                                    padding-top: 12px;
                                    background: white;
                                }

                                .footer-info { 
                                    text-align: center; 
                                    color: #666; 
                                    font-size: 12px; 
                                    border-top: 2px solid #e5e7eb; 
                                    padding-top: 20px;
                                }

                                .print-buttons { 
                                    text-align: center; 
                                    margin: 30px 0; 
                                    gap: 15px; 
                                    display: flex; 
                                    justify-content: center;
                                }
                                @media print {
                                    .no-print { display: none !important; }
                                    body { padding: 0; }
                                    .report-container { box-shadow: none; }
                                }
                                .btn { 
                                    padding: 12px 24px;
                                    margin: 0 10px;
                                    border: none;
                                    border-radius: 6px;
                                    font-weight: 600;
                                    cursor: pointer;
                                    font-size: 14px;
                                }
                                .btn-print { background: #dc2626; color: white; }
                                .btn-close { background: #6b7280; color: white; }
                                .btn:hover { opacity: 0.9; transform: translateY(-1px); }

                                .products-detail { 
                                    background: #f9fafb; 
                                    padding: 8px; 
                                    margin: 4px 0;
                                    border-radius: 4px;
                                    border-left: 3px solid #dc2626;
                                }
                            </style>
                        </head>
                        <body>
                            <div class="report-container">
                                <!-- Header -->
                                <div class="report-header">
                                    <!-- Logo Section -->
                                    <div class="header-logo">
                                        ${companySettings.logo ? 
                                            `<img src="${companySettings.logo}" alt="Logo" style="max-width: 100px; max-height: 100px; object-fit: contain;">` :
                                            '<div style="color: #ccc; font-size: 11px; height: 60px; display: flex; align-items: center; justify-content: center;">Logo</div>'
                                        }
                                    </div>

                                    <!-- Company Info Section -->
                                    <div class="header-company">
                                        <div class="company-name">${companySettings.companyName || 'CÔNG TY CỔ PHẦN ABC'}</div>
                                        <div class="company-info">
                                            ${companySettings.address || '123 Đường ABC, Quận 1, TP.HCM'}<br>
                                            Điện thoại: ${companySettings.phone || '(028) 1234-5678'}${companySettings.email ? ' | Email: ' + companySettings.email : ''}<br>
                                            ${companySettings.taxCode ? 'MST: ' + companySettings.taxCode : ''}
                                            ${companySettings.description ? '<br><em>' + companySettings.description + '</em>' : ''}
                                        </div>
                                        <div class="report-title">
                                            BÁO CÁO CÔNG NỢ KHÁCH HÀNG
                                            <span class="debt-badge">${unpaidOrders.length} đơn hàng</span>
                                        </div>
                                    </div>

                                    <!-- QR Code Section -->
                                    <div class="header-qr">
                                        ${companySettings.qrCode ? 
                                            `<img src="${companySettings.qrCode}" alt="QR Code" style="max-width: 100px; max-height: 100px; object-fit: contain;">` :
                                            '<div style="color: #ccc; font-size: 11px; height: 60px; display: flex; align-items: center; justify-content: center;">QR Code</div>'
                                        }
                                    </div>
                                </div>

                                <!-- Report & Customer Details -->
                                <div class="report-details">
                                    <div class="report-info">
                                        <div class="section-title">Thông tin báo cáo</div>
                                        <div class="info-row">
                                            <span class="info-label">Ngày lập:</span>
                                            <span class="info-value">${this.getVietnamTime().toLocaleDateString('vi-VN')}</span>
                                        </div>
                                        <div class="info-row">
                                            <span class="info-label">Giờ lập:</span>
                                            <span class="info-value">${this.getVietnamTime().toLocaleTimeString('vi-VN')}</span>
                                        </div>
                                        <div class="info-row">
                                            <span class="info-label">Số đơn nợ:</span>
                                            <span class="info-value" style="color: #dc2626; font-weight: 600;">${unpaidOrders.length} đơn hàng</span>
                                        </div>
                                        <div class="info-row">
                                            <span class="info-label">Tổng công nợ:</span>
                                            <span class="info-value" style="color: #dc2626; font-weight: 700; font-size: 16px;">${totalDebt.toLocaleString('vi-VN')} đ</span>
                                        </div>
                                    </div>

                                    <div class="customer-info">
                                        <div class="section-title">Thông tin khách hàng</div>
                                        <div class="info-row">
                                            <span class="info-label">Mã KH:</span>
                                            <span class="info-value">${customer.id}</span>
                                        </div>
                                        <div class="info-row">
                                            <span class="info-label">Tên khách hàng:</span>
                                            <span class="info-value">${customer.name}</span>
                                        </div>
                                        <div class="info-row">
                                            <span class="info-label">Số điện thoại:</span>
                                            <span class="info-value">${customer.phone}</span>
                                        </div>
                                        <div class="info-row">
                                            <span class="info-label">Địa chỉ:</span>
                                            <span class="info-value">${customer.address}</span>
                                        </div>
                                    </div>
                                </div>

                                <!-- Orders Table with Product Details -->
                                <table class="orders-table">
                                    <thead>
                                        <tr>
                                            <th style="width: 12%">Mã đơn</th>
                                            <th style="width: 12%">Ngày</th>
                                            <th style="width: 35%">Chi tiết sản phẩm</th>
                                            <th style="width: 15%">Phương thức TT</th>
                                            <th style="width: 12%">Trạng thái</th>
                                            <th style="width: 14%">Số tiền</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${unpaidOrders.map(order => `
                                            <tr>
                                                <td class="order-id">${order.id}</td>
                                                <td>${order.date}</td>
                                                <td class="product-name">
                                                    ${order.products && order.products.length > 0 ? 
                                                        order.products.map(product => `
                                                            <div class="products-detail">
                                                                <strong>${product.name}</strong><br>
                                                                <span style="color: #666; font-size: 12px;">
                                                                    SL: ${product.quantity} × ${product.price.toLocaleString('vi-VN')}đ = 
                                                                    <strong style="color: #dc2626;">${(product.quantity * product.price).toLocaleString('vi-VN')}đ</strong>
                                                                </span>
                                                            </div>
                                                        `).join('') 
                                                        : '<span style="color: #999;">Không có chi tiết</span>'
                                                    }
                                                </td>
                                                <td>${order.paymentMethod}</td>
                                                <td>
                                                    <span style="background: #fbbf24; color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">
                                                        ${order.paymentStatus}
                                                    </span>
                                                </td>
                                                <td class="amount">${this.getOrderRemainingBalance(order).toLocaleString('vi-VN')} đ</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>

                                <!-- Total Summary -->
                                <div class="totals-section">
                                    <div class="summary-row summary-total">
                                        <span>TỔNG CÔNG NỢ:</span>
                                        <span>${totalDebt.toLocaleString('vi-VN')} đ</span>
                                    </div>
                                    <div style="text-align: center; margin-top: 15px; font-size: 12px; color: #dc2626;">
                                        <strong>Ghi chú:</strong> Báo cáo bao gồm ${unpaidOrders.length} đơn hàng chưa thanh toán với tổng giá trị ${totalDebt.toLocaleString('vi-VN')} đồng
                                    </div>
                                </div>

                                <!-- Print Buttons -->
                                <div class="print-buttons no-print">
                                    <button class="btn btn-print" onclick="window.print()">🖨️ In báo cáo công nợ</button>
                                    <button class="btn btn-close" onclick="window.close()">❌ Đóng</button>
                                </div>

                                <!-- Footer -->
                                <div class="footer-info">
                                    <p><strong>Báo cáo được tạo tự động bởi hệ thống ERP</strong></p>
                                    <p>Thời gian tạo: ${this.getVietnamTime().toLocaleString('vi-VN', { 
                                        timeZone: 'Asia/Ho_Chi_Minh',
                                        year: 'numeric',
                                        month: '2-digit', 
                                        day: '2-digit',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        second: '2-digit'
                                    })}</p>
                                    <p style="color: #dc2626; font-weight: 600;">
                                        Vui lòng liên hệ khách hàng để thu hồi công nợ kịp thời
                                    </p>
                                </div>
                            </div>
                        </body>
                        </html>
                    `);

                    reportWindow.document.close();
                    reportWindow.focus();

                    this.showNotification(`✅ Đã tạo báo cáo công nợ cho khách hàng ${customer.name} (${unpaidOrders.length} đơn hàng)`, 'success');

                } catch (error) {
                    console.error('Lỗi tạo báo cáo công nợ:', error);
                    this.showNotification('❌ Lỗi tạo báo cáo công nợ: ' + error.message, 'error');
                }
            }

            // Function to close modal/popup
            closeModal(element) {
                if (element) {
                    element.remove();
                    return;
                }
                // Try to find and remove modal by common selectors
                const modals = document.querySelectorAll('div[style*="fixed"]');
                if (modals.length > 0) {
                    modals[modals.length - 1].remove(); // Remove the last modal
                }
            }

            // ===== BỘ LỌC NGÀY THÁNG CHO BÁO CÁO =====

            // Khởi tạo filter state
            initFilterState() {
                if (!this.filterState) {
                    this.filterState = {
                        fromDate: this.getDefaultFromDate(),
                        toDate: this.getDefaultToDate(),
                        isCollapsed: false
                    };
                }
            }

            getDefaultFromDate() {
                // Mặc định là đầu tháng này (giờ Việt Nam)
                const vietnamTime = this.getVietnamTime();
                vietnamTime.setDate(1);
                return this.formatDateInputValue(vietnamTime);
            }

            getDefaultToDate() {
                // Mặc định là hôm nay (giờ Việt Nam)
                return this.formatDateInputValue(this.getVietnamTime());
            }

            formatDateForDisplay(dateString) {
                if (/^\d{4}-\d{2}-\d{2}$/.test(String(dateString || ''))) {
                    const [year, month, day] = dateString.split('-');
                    return `${day}/${month}/${year}`;
                }
                const date = new Date(dateString);
                return date.toLocaleDateString('vi-VN');
            }

            // Toggle hiển thị/ẩn bộ lọc
            toggleFilterSection() {
                const content = document.getElementById('filter-content');
                const icon = document.getElementById('filter-toggle-icon');

                if (content.style.display === 'none') {
                    content.style.display = 'block';
                    icon.textContent = '📁';
                    this.filterState.isCollapsed = false;
                } else {
                    content.style.display = 'none';
                    icon.textContent = '📂';
                    this.filterState.isCollapsed = true;
                }
            }

            // Áp dụng lựa chọn nhanh
            applyQuickFilter(value) {
                const fromDateInput = document.getElementById('filter-from-date');
                const toDateInput = document.getElementById('filter-to-date');
                const today = this.getVietnamTime();
                let fromDate, toDate;

                switch(value) {
                    case 'today':
                        fromDate = toDate = this.getVietnamTime();
                        break;
                    case 'yesterday':
                        fromDate = toDate = new Date(today.getTime() - 24 * 60 * 60 * 1000);
                        break;
                    case 'this-week':
                        const startOfWeek = new Date(today);
                        startOfWeek.setDate(today.getDate() - today.getDay() + 1); // Thứ 2
                        fromDate = startOfWeek;
                        toDate = today;
                        break;
                    case 'last-week':
                        const startOfLastWeek = new Date(today);
                        startOfLastWeek.setDate(today.getDate() - today.getDay() - 6);
                        const endOfLastWeek = new Date(today);
                        endOfLastWeek.setDate(today.getDate() - today.getDay());
                        fromDate = startOfLastWeek;
                        toDate = endOfLastWeek;
                        break;
                    case 'this-month':
                        fromDate = new Date(today.getFullYear(), today.getMonth(), 1);
                        toDate = today;
                        break;
                    case 'last-month':
                        fromDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                        toDate = new Date(today.getFullYear(), today.getMonth(), 0);
                        break;
                    case 'last-30-days':
                        fromDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
                        toDate = today;
                        break;
                    case 'last-90-days':
                        fromDate = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
                        toDate = today;
                        break;
                    case 'this-year':
                        fromDate = new Date(today.getFullYear(), 0, 1);
                        toDate = today;
                        break;
                    case 'last-year':
                        fromDate = new Date(today.getFullYear() - 1, 0, 1);
                        toDate = new Date(today.getFullYear() - 1, 11, 31);
                        break;
                    default:
                        return;
                }

                if (fromDate && toDate) {
                    fromDateInput.value = fromDate.toISOString().split('T')[0];
                    toDateInput.value = toDate.toISOString().split('T')[0];
                }
            }

            // Áp dụng bộ lọc ngày tháng
            applyDateFilter() {
                const fromDate = document.getElementById('filter-from-date').value;
                const toDate = document.getElementById('filter-to-date').value;

                if (!fromDate || !toDate) {
                    this.showNotification('Vui lòng chọn đầy đủ ngày bắt đầu và kết thúc', 'warning');
                    return;
                }

                if (new Date(fromDate) > new Date(toDate)) {
                    this.showNotification('Ngày bắt đầu không thể sau ngày kết thúc', 'error');
                    return;
                }

                // Lưu trạng thái filter
                this.filterState.fromDate = fromDate;
                this.filterState.toDate = toDate;

                // Cập nhật thông tin hiển thị
                const filterInfo = document.getElementById('filter-info');
                if (filterInfo) {
                    filterInfo.innerHTML = `Hiển thị dữ liệu từ <strong>${this.formatDateForDisplay(fromDate)}</strong> đến <strong>${this.formatDateForDisplay(toDate)}</strong>`;
                }

                // Lọc và cập nhật dữ liệu báo cáo
                this.filterReportsData(fromDate, toDate);
                this.showNotification(`Đã áp dụng bộ lọc từ ${this.formatDateForDisplay(fromDate)} đến ${this.formatDateForDisplay(toDate)}`, 'success');
            }

            // Reset bộ lọc về mặc định
            resetDateFilter() {
                const fromDate = this.getDefaultFromDate();
                const toDate = this.getDefaultToDate();

                document.getElementById('filter-from-date').value = fromDate;
                document.getElementById('filter-to-date').value = toDate;
                document.getElementById('filter-quick-select').value = '';

                this.filterState.fromDate = fromDate;
                this.filterState.toDate = toDate;

                const filterInfo = document.getElementById('filter-info');
                if (filterInfo) {
                    filterInfo.innerHTML = `Hiển thị dữ liệu từ <strong>${this.formatDateForDisplay(fromDate)}</strong> đến <strong>${this.formatDateForDisplay(toDate)}</strong>`;
                }

                this.filterReportsData(fromDate, toDate);
                this.showNotification('Đã đặt lại bộ lọc về mặc định', 'info');
            }

            // Lọc dữ liệu báo cáo theo khoảng thời gian
            filterReportsData(fromDate, toDate) {
                const startDate = new Date(fromDate);
                const endDate = new Date(toDate);
                endDate.setHours(23, 59, 59, 999); // Include toàn bộ ngày cuối

                // Lọc đơn hàng theo khoảng thời gian
                const filteredOrders = this.demoData.orders.filter(order => {
                    const orderDate = new Date(order.date);
                    return orderDate >= startDate && orderDate <= endDate;
                });

                const periodExpenses = this.getExpensesInRange(fromDate, toDate);
                const operatingExpenses = periodExpenses.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);
                const orderRevenue = filteredOrders.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
                const totalCostAndExpense = filteredOrders.reduce((sum, order) => {
                    return sum + this.getOrderCost(order) + (Number(order.expense) || 0);
                }, 0) + operatingExpenses;

                const totalProfit = orderRevenue - totalCostAndExpense;

                const totalDebt = filteredOrders.reduce((sum, order) => {
                    return order.paymentStatus !== 'Đã thanh toán' ? sum + this.getOrderRemainingBalance(order) : sum;
                }, 0);

                // Cập nhật display thống kê
                this.updateFilteredStats(orderRevenue, totalProfit, totalDebt, filteredOrders.length, totalCostAndExpense);

                // Cập nhật danh sách đơn hàng hiển thị
                this.updateOrdersList(filteredOrders);
            }

            // Cập nhật hiển thị thống kê sau khi lọc
            updateFilteredStats(revenue, profit, debt, orderCount, totalCost = 0) {
                // Cập nhật các card thống kê
                const revenueCard = document.querySelector('.stat-card.revenue .stat-value');
                const profitCard = document.querySelector('.stat-card.info .stat-value');
                const costCard = document.querySelector('.stat-card.warning .stat-value');

                if (revenueCard) {
                    revenueCard.textContent = revenue.toLocaleString('vi-VN') + ' VNĐ';
                }
                if (profitCard) {
                    profitCard.textContent = profit.toLocaleString('vi-VN') + ' VNĐ';
                }
                if (costCard) {
                    costCard.textContent = totalCost.toLocaleString('vi-VN') + ' VNĐ';
                }

                // Cập nhật thông tin tóm tắt
                const activityDesc = document.querySelector('.activity-desc');
                if (activityDesc) {
                    const profitMargin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : 0;
                    activityDesc.textContent = `Doanh thu phát sinh: ${revenue.toLocaleString('vi-VN')} VNĐ - ${orderCount} đơn hàng - Lợi nhuận: ${profitMargin}% - Tổng chi phí: ${totalCost.toLocaleString('vi-VN')} VNĐ`;
                }
            }

            // Cập nhật danh sách đơn hàng hiển thị theo bộ lọc
            updateOrdersList(filteredOrders) {
                // Tìm container chứa danh sách đơn hàng
                const ordersContainer = document.querySelector('.orders-list, .order-list, .recent-orders, .order-table tbody');
                if (!ordersContainer) return;

                // Tạo HTML cho danh sách đơn hàng đã lọc
                let ordersHTML = '';

                if (filteredOrders.length === 0) {
                    ordersHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #6b7280;">Không có đơn hàng nào trong khoảng thời gian này</td></tr>';
                } else {
                    ordersHTML = filteredOrders.slice(0, 10).map(order => {
                        const customer = this.demoData.customers.find(c => c.id === order.customerId);
                        const customerName = customer ? customer.name : 'N/A';
                        const statusClass = order.status === 'Hoàn thành' ? 'success' : (order.status === 'Đang xử lý' ? 'warning' : 'info');
                        const paymentClass = order.paymentStatus === 'Đã thanh toán' ? 'success' : 'warning';

                        return `
                            <tr>
                                <td>#${order.id}</td>
                                <td>${customerName}</td>
                                <td>${order.date}</td>
                                <td>${order.total.toLocaleString('vi-VN')} VNĐ</td>
                                <td><span class="status ${statusClass}">${order.status}</span></td>
                                <td><span class="status ${paymentClass}">${order.paymentStatus}</span></td>
                            </tr>
                        `;
                    }).join('');
                }

                // Cập nhật nội dung
                if (ordersContainer.tagName === 'TBODY') {
                    ordersContainer.innerHTML = ordersHTML;
                } else {
                    ordersContainer.innerHTML = `<table class="order-table"><tbody>${ordersHTML}</tbody></table>`;
                }
            }



            // Hiển thị popup export báo cáo doanh thu với bộ lọc
            showSalesExportWithFilter() {
                const exportHTML = `
                    <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 1001; display: flex; justify-content: center; align-items: center;" onclick="closeModal(this)">
                        <div style="background: white; padding: 25px; border-radius: 12px; width: 500px; max-height: 80vh; overflow-y: auto;" onclick="event.stopPropagation()">
                            <div style="text-align: center; margin-bottom: 20px;">
                                <h3 style="margin: 0; font-size: 20px; color: #1f2937;">Xuất báo cáo doanh thu</h3>
                                <p style="margin: 10px 0; color: #6b7280;">Bạn muốn xem dữ liệu hay tải về file?</p>
                            </div>

                            <!-- Bộ lọc thời gian -->
                            <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                                <h4 style="margin: 0 0 15px 0; color: #374151; font-size: 14px;">📅 Chọn khoảng thời gian:</h4>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 10px;">
                                    <div>
                                        <label style="display: block; margin-bottom: 5px; font-size: 12px; color: #6b7280;">Từ ngày:</label>
                                        <input type="date" id="exportSalesFromDate" style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;">
                                    </div>
                                    <div>
                                        <label style="display: block; margin-bottom: 5px; font-size: 12px; color: #6b7280;">Đến ngày:</label>
                                        <input type="date" id="exportSalesToDate" style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;">
                                    </div>
                                </div>
                                <div style="font-size: 12px; color: #6b7280; font-style: italic;">
                                    * Báo cáo sẽ dựa trên khoảng thời gian đã chọn
                                </div>
                            </div>

                            <!-- Nút hành động -->
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                                <button onclick="app.processSalesExport('view')" 
                                        style="background: #3b82f6; color: white; border: none; padding: 12px; border-radius: 8px; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; gap: 8px;">
                                    👁️ Xem dữ liệu
                                </button>
                                <button onclick="app.processSalesExport('download')" 
                                        style="background: #059669; color: white; border: none; padding: 12px; border-radius: 8px; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; gap: 8px;">
                                    📥 Tải về
                                </button>
                            </div>

                        </div>
                    </div>
                `;

                document.body.insertAdjacentHTML('beforeend', exportHTML);

                // Set ngày mặc định (tháng này)
                const today = this.getVietnamTime();
                const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
                document.getElementById('exportSalesFromDate').value = firstDay.toISOString().split('T')[0];
                document.getElementById('exportSalesToDate').value = today.toISOString().split('T')[0];
            }

            // Xử lý export báo cáo doanh thu
            processSalesExport(mode) {
                const fromDate = document.getElementById('exportSalesFromDate').value;
                const toDate = document.getElementById('exportSalesToDate').value;

                if (!fromDate || !toDate) {
                    this.showNotification('Vui lòng chọn khoảng thời gian', 'error');
                    return;
                }

                if (new Date(fromDate) > new Date(toDate)) {
                    this.showNotification('Ngày bắt đầu không được lớn hơn ngày kết thúc', 'error');
                    return;
                }

                // Lọc dữ liệu đơn hàng theo thời gian
                const startDate = new Date(fromDate);
                const endDate = new Date(toDate);
                endDate.setHours(23, 59, 59, 999);

                const filteredOrders = this.demoData.orders.filter(order => {
                    const orderDate = new Date(order.date);
                    return orderDate >= startDate && orderDate <= endDate;
                });

                // Sắp xếp và tạo dữ liệu báo cáo
                const sortedFilteredOrders = this.sortOrdersByDate(filteredOrders);
                const salesData = sortedFilteredOrders.map(order => {
                    const customer = this.demoData.customers.find(c => c.id === order.customerId);
                    // Sử dụng order.products thay vì order.items
                    const itemCount = order.products ? order.products.length : 0;
                    return {
                        id: order.id,
                        customer: customer ? customer.name : 'N/A',
                        date: order.date,
                        items: itemCount,
                        total: order.total,
                        paymentStatus: order.paymentStatus,
                        status: order.status
                    };
                });

                // Đóng popup export
                const exportModal = document.querySelector('div[style*="position: fixed"]');
                if (exportModal) {
                    exportModal.remove();
                }

                if (salesData.length === 0) {
                    this.showNotification('Không có đơn hàng nào trong khoảng thời gian này', 'info');
                    return;
                }

                if (mode === 'view') {
                    // Hiển thị dữ liệu
                    const columns = [
                        { header: 'Mã đơn', getValue: sale => sale.id },
                        { header: 'Khách hàng', getValue: sale => sale.customer },
                        { header: 'Ngày', getValue: sale => sale.date },
                        { header: 'Số sản phẩm', getValue: sale => sale.items },
                        { header: 'Tổng tiền (VNĐ)', getValue: sale => sale.total.toLocaleString('vi-VN') },
                        { header: 'Thanh toán', getValue: sale => sale.paymentStatus },
                        { header: 'Trạng thái', getValue: sale => sale.status }
                    ];

                    const title = `Báo cáo doanh thu (${this.formatDateForDisplay(fromDate)} - ${this.formatDateForDisplay(toDate)})`;
                    this.showDataViewer(title, salesData, columns);

                } else if (mode === 'download') {
                    // Tải xuống CSV
                    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + 
                        `Báo cáo Doanh thu (${this.formatDateForDisplay(fromDate)} - ${this.formatDateForDisplay(toDate)})\n` +
                        "Mã đơn,Khách hàng,Ngày,Số sản phẩm,Tổng tiền,Thanh toán,Trạng thái\n" +
                        salesData.map(s => 
                            `${s.id},"${s.customer}","${s.date}",${s.items},${s.total},"${s.paymentStatus}","${s.status}"`
                        ).join('\n');

                    const encodedUri = encodeURI(csvContent);
                    const link = document.createElement("a");
                    link.setAttribute("href", encodedUri);
                    link.setAttribute("download", `doanh_thu_${fromDate}_${toDate}.csv`);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);

                    this.showNotification(`Đã tải xuống báo cáo doanh thu (${salesData.length} đơn hàng)`, 'success');
                }
            }

            // Hiển thị popup export báo cáo Top sản phẩm với bộ lọc
            showTopProductsExportWithFilter() {
                const exportHTML = `
                    <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 1001; display: flex; justify-content: center; align-items: center;" onclick="closeModal(this)">
                        <div style="background: white; padding: 25px; border-radius: 12px; width: 500px; max-height: 80vh; overflow-y: auto;" onclick="event.stopPropagation()">
                            <div style="text-align: center; margin-bottom: 20px;">
                                <h3 style="margin: 0; font-size: 20px; color: #1f2937;">Xuất top sản phẩm bán chạy</h3>
                                <p style="margin: 10px 0; color: #6b7280;">Bạn muốn xem dữ liệu hay tải về file?</p>
                            </div>

                            <!-- Bộ lọc thời gian -->
                            <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                                <h4 style="margin: 0 0 15px 0; color: #374151; font-size: 14px;">📅 Chọn khoảng thời gian:</h4>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 10px;">
                                    <div>
                                        <label style="display: block; margin-bottom: 5px; font-size: 12px; color: #6b7280;">Từ ngày:</label>
                                        <input type="date" id="exportProductsFromDate" style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;">
                                    </div>
                                    <div>
                                        <label style="display: block; margin-bottom: 5px; font-size: 12px; color: #6b7280;">Đến ngày:</label>
                                        <input type="date" id="exportProductsToDate" style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;">
                                    </div>
                                </div>
                                <div style="font-size: 12px; color: #6b7280; font-style: italic;">
                                    * Thống kê top 10 sản phẩm bán chạy nhất
                                </div>
                            </div>

                            <!-- Nút hành động -->
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                                <button onclick="app.processProductsExport('view')" 
                                        style="background: #3b82f6; color: white; border: none; padding: 12px; border-radius: 8px; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; gap: 8px;">
                                    👁️ Xem dữ liệu
                                </button>
                                <button onclick="app.processProductsExport('download')" 
                                        style="background: #059669; color: white; border: none; padding: 12px; border-radius: 8px; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; gap: 8px;">
                                    📥 Tải về
                                </button>
                            </div>

                            <button onclick="closeModal(this.closest('div[style*=\"position: fixed\"]'))" 
                                    style="width: 100%; background: #6b7280; color: white; border: none; padding: 10px; border-radius: 8px; cursor: pointer;">
                        </div>
                    </div>
                `;

                document.body.insertAdjacentHTML('beforeend', exportHTML);

                // Set ngày mặc định (tháng này)
                const today = this.getVietnamTime();
                const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
                document.getElementById('exportProductsFromDate').value = firstDay.toISOString().split('T')[0];
                document.getElementById('exportProductsToDate').value = today.toISOString().split('T')[0];
            }

            // Xử lý export báo cáo Top sản phẩm
            processProductsExport(mode) {
                const fromDate = document.getElementById('exportProductsFromDate').value;
                const toDate = document.getElementById('exportProductsToDate').value;

                if (!fromDate || !toDate) {
                    this.showNotification('Vui lòng chọn khoảng thời gian', 'error');
                    return;
                }

                if (new Date(fromDate) > new Date(toDate)) {
                    this.showNotification('Ngày bắt đầu không được lớn hơn ngày kết thúc', 'error');
                    return;
                }

                // Lọc dữ liệu đơn hàng theo thời gian
                const startDate = new Date(fromDate);
                const endDate = new Date(toDate);
                endDate.setHours(23, 59, 59, 999);

                const filteredOrders = this.demoData.orders.filter(order => {
                    const orderDate = new Date(order.date);
                    return orderDate >= startDate && orderDate <= endDate;
                });

                // Sắp xếp đơn hàng trước khi tính toán
                const sortedFilteredOrders = this.sortOrdersByDate(filteredOrders);

                // Tính toán top sản phẩm
                const productSales = {};
                sortedFilteredOrders.forEach(order => {
                    // Sử dụng order.products 
                    const orderItems = order.products || [];

                    if (Array.isArray(orderItems)) {
                        orderItems.forEach(item => {
                            const productId = item.id;
                            if (!productSales[productId]) {
                                const product = this.demoData.products.find(p => p.id === productId);
                                productSales[productId] = {
                                    id: productId,
                                    name: item.name || (product ? product.name : 'N/A'),
                                    price: item.price,
                                    sold: 0,
                                    revenue: 0,
                                    stock: product ? product.stock : 0
                                };
                            }
                            const quantity = item.quantity || 1;
                            const price = item.price || 0;
                            productSales[productId].sold += quantity;
                            productSales[productId].revenue += quantity * price;
                        });
                    }
                });

                const topProducts = Object.values(productSales)
                    .sort((a, b) => b.sold - a.sold)
                    .slice(0, 10);

                // Đóng popup export
                const exportModal = document.querySelector('div[style*="position: fixed"]');
                if (exportModal) {
                    exportModal.remove();
                }

                if (topProducts.length === 0) {
                    this.showNotification('Không có sản phẩm nào được bán trong khoảng thời gian này', 'info');
                    return;
                }

                if (mode === 'view') {
                    // Hiển thị dữ liệu
                    const columns = [
                        { header: 'Xếp hạng', getValue: (product, index) => index + 1 },
                        { header: 'Mã SP', getValue: product => product.id },
                        { header: 'Tên sản phẩm', getValue: product => product.name },
                        { header: 'Đã bán', getValue: product => product.sold },
                        { header: 'Tồn kho', getValue: product => product.stock },
                        { header: 'Doanh thu (VNĐ)', getValue: product => product.revenue.toLocaleString('vi-VN') }
                    ];

                    const title = `Top sản phẩm bán chạy (${this.formatDateForDisplay(fromDate)} - ${this.formatDateForDisplay(toDate)})`;
                    this.showDataViewer(title, topProducts, columns);

                } else if (mode === 'download') {
                    // Tải xuống CSV
                    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + 
                        `Top sản phẩm bán chạy (${this.formatDateForDisplay(fromDate)} - ${this.formatDateForDisplay(toDate)})\n` +
                        "Xếp hạng,Mã SP,Tên sản phẩm,Đã bán,Tồn kho,Doanh thu\n" +
                        topProducts.map((p, index) => 
                            `${index + 1},${p.id},"${p.name}",${p.sold},${p.stock},${p.revenue}`
                        ).join('\n');

                    const encodedUri = encodeURI(csvContent);
                    const link = document.createElement("a");
                    link.setAttribute("href", encodedUri);
                    link.setAttribute("download", `top_sanpham_${fromDate}_${toDate}.csv`);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);

                    this.showNotification(`Đã tải xuống báo cáo top sản phẩm (${topProducts.length} sản phẩm)`, 'success');
                }
            }

            // Hiển thị popup export báo cáo tài chính với bộ lọc
            showFinancialExportWithFilter() {
                const exportHTML = `
                    <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 1001; display: flex; justify-content: center; align-items: center;" onclick="closeModal(this)">
                        <div style="background: white; padding: 25px; border-radius: 12px; width: 500px; max-height: 80vh; overflow-y: auto;" onclick="event.stopPropagation()">
                            <div style="text-align: center; margin-bottom: 20px;">
                                <h3 style="margin: 0; font-size: 20px; color: #1f2937;">Xuất báo cáo tài chính</h3>
                                <p style="margin: 10px 0; color: #6b7280;">Bạn muốn xem dữ liệu hay tải về file?</p>
                            </div>

                            <!-- Bộ lọc thời gian -->
                            <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                                <h4 style="margin: 0 0 15px 0; color: #374151; font-size: 14px;">📅 Chọn khoảng thời gian:</h4>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 10px;">
                                    <div>
                                        <label style="display: block; margin-bottom: 5px; font-size: 12px; color: #6b7280;">Từ ngày:</label>
                                        <input type="date" id="exportFinancialFromDate" style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;">
                                    </div>
                                    <div>
                                        <label style="display: block; margin-bottom: 5px; font-size: 12px; color: #6b7280;">Đến ngày:</label>
                                        <input type="date" id="exportFinancialToDate" style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;">
                                    </div>
                                </div>
                                <div style="font-size: 12px; color: #6b7280; font-style: italic;">
                                    * Báo cáo tổng quan tình hình tài chính doanh nghiệp
                                </div>
                            </div>

                            <!-- Nút hành động -->
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                                <button onclick="app.processFinancialExport('view')" 
                                        style="background: #3b82f6; color: white; border: none; padding: 12px; border-radius: 8px; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; gap: 8px;">
                                    👁️ Xem dữ liệu
                                </button>
                                <button onclick="app.processFinancialExport('download')" 
                                        style="background: #059669; color: white; border: none; padding: 12px; border-radius: 8px; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; gap: 8px;">
                                    📥 Tải về
                                </button>
                            </div>

                            <button onclick="closeModal(this.closest('div[style*=\"position: fixed\"]'))" 
                                    style="width: 100%; background: #6b7280; color: white; border: none; padding: 10px; border-radius: 8px; cursor: pointer;">
                        </div>
                    </div>
                `;

                document.body.insertAdjacentHTML('beforeend', exportHTML);

                // Set ngày mặc định (tháng này)
                const today = this.getVietnamTime();
                const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
                document.getElementById('exportFinancialFromDate').value = firstDay.toISOString().split('T')[0];
                document.getElementById('exportFinancialToDate').value = today.toISOString().split('T')[0];
            }

            // Xử lý export báo cáo tài chính
            processFinancialExport(mode) {
                const fromDate = document.getElementById('exportFinancialFromDate').value;
                const toDate = document.getElementById('exportFinancialToDate').value;

                if (!fromDate || !toDate) {
                    this.showNotification('Vui lòng chọn khoảng thời gian', 'error');
                    return;
                }

                if (new Date(fromDate) > new Date(toDate)) {
                    this.showNotification('Ngày bắt đầu không được lớn hơn ngày kết thúc', 'error');
                    return;
                }

                // Lọc dữ liệu đơn hàng theo thời gian
                const startDate = new Date(fromDate);
                const endDate = new Date(toDate);
                endDate.setHours(23, 59, 59, 999);

                const filteredOrders = this.demoData.orders.filter(order => {
                    const orderDate = new Date(order.date);
                    return orderDate >= startDate && orderDate <= endDate;
                });

                // Tính toán các chỉ số tài chính
                const grossRevenue = filteredOrders.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
                const actualCollected = this.getCollectedAmountInRange(fromDate, toDate);
                const costOfGoods = filteredOrders.reduce((sum, order) => sum + this.getOrderCost(order), 0);
                const orderExtraExpenses = filteredOrders.reduce((sum, order) => sum + (Number(order.expense) || 0), 0);
                const operatingExpenses = this.getExpensesInRange(fromDate, toDate);
                const operatingExpenseTotal = operatingExpenses.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);
                const totalExpenses = costOfGoods + orderExtraExpenses + operatingExpenseTotal;
                const netProfit = grossRevenue - totalExpenses;
                const totalDebt = this.getTotalOutstandingDebt(this.demoData.orders || []);
                const totalInventoryValue = this.demoData.products.reduce((sum, p) => sum + (p.price * p.stock), 0);
                const expenseBreakdownRows = Object.entries(this.getExpenseBreakdown(operatingExpenses))
                    .sort((a, b) => b[1] - a[1])
                    .map(([category, amount]) => ({
                        category: `- ${category}`,
                        value: amount.toLocaleString('vi-VN') + ' VNĐ'
                    }));

                const financialData = [
                    { category: 'BÁO CÁO TÀI CHÍNH TỔNG QUAN', value: '' },
                    { category: 'Khoảng thời gian', value: `${this.formatDateForDisplay(fromDate)} - ${this.formatDateForDisplay(toDate)}` },
                    { category: 'Ngày báo cáo', value: this.getVietnamTime().toLocaleDateString('vi-VN') },
                    { category: '', value: '' },
                    { category: 'DOANH THU VÀ BÁN HÀNG', value: '' },
                    { category: 'Doanh thu ghi nhận từ đơn hàng', value: grossRevenue.toLocaleString('vi-VN') + ' VNĐ' },
                    { category: 'Tiền đã thu thực tế', value: actualCollected.toLocaleString('vi-VN') + ' VNĐ' },
                    { category: 'Số đơn hàng', value: filteredOrders.length.toString() },
                    { category: 'Đơn hoàn thành', value: filteredOrders.filter(o => o.status === 'Hoàn thành').length.toString() },
                    { category: 'Đơn đã thanh toán', value: filteredOrders.filter(o => o.paymentStatus === 'Đã thanh toán').length.toString() },
                    { category: '', value: '' },
                    { category: 'CHI PHÍ VÀ LỢI NHUẬN', value: '' },
                    { category: 'Giá vốn hàng bán', value: costOfGoods.toLocaleString('vi-VN') + ' VNĐ' },
                    { category: 'Chi phí phát sinh theo đơn', value: orderExtraExpenses.toLocaleString('vi-VN') + ' VNĐ' },
                    { category: 'Chi phí vận hành', value: operatingExpenseTotal.toLocaleString('vi-VN') + ' VNĐ' },
                    { category: 'Tổng chi phí', value: totalExpenses.toLocaleString('vi-VN') + ' VNĐ' },
                    { category: 'Lợi nhuận thuần theo doanh thu phát sinh', value: netProfit.toLocaleString('vi-VN') + ' VNĐ' },
                    { category: '', value: '' },
                    { category: 'PHÂN TÍCH LOẠI CHI PHÍ', value: '' },
                    ...expenseBreakdownRows,
                    ...(expenseBreakdownRows.length === 0 ? [{ category: 'Chưa có chi phí vận hành', value: '0 VNĐ' }] : []),
                    { category: '', value: '' },
                    { category: 'KHÁCH HÀNG VÀ CÔNG NỢ', value: '' },
                    { category: 'Tổng khách hàng', value: this.demoData.customers.length.toString() },
                    { category: 'Khách hàng có nợ', value: this.demoData.customers.filter(c => c.debt > 0).length.toString() },
                    { category: 'Tổng công nợ', value: totalDebt.toLocaleString('vi-VN') + ' VNĐ' },
                    { category: '', value: '' },
                    { category: 'TÀI SẢN VÀ HÀNG TỒN KHO', value: '' },
                    { category: 'Số mặt hàng', value: this.demoData.products.length.toString() },
                    { category: 'Giá trị tồn kho', value: totalInventoryValue.toLocaleString('vi-VN') + ' VNĐ' },
                    { category: 'Hàng sắp hết', value: this.demoData.products.filter(p => p.stock < 10).length.toString() },
                    { category: '', value: '' },
                    { category: 'NHÀ CUNG CẤP', value: '' },
                    { category: 'Tổng nhà cung cấp', value: this.demoData.suppliers.length.toString() }
                ];

                // Đóng popup export
                const exportModal = document.querySelector('div[style*="position: fixed"]');
                if (exportModal) {
                    exportModal.remove();
                }

                if (mode === 'view') {
                    // Hiển thị dữ liệu
                    const columns = [
                        { header: 'Danh mục', getValue: item => item.category },
                        { header: 'Giá trị', getValue: item => item.value }
                    ];

                    const title = `Báo cáo tài chính (${this.formatDateForDisplay(fromDate)} - ${this.formatDateForDisplay(toDate)})`;
                    this.showDataViewer(title, financialData, columns);

                } else if (mode === 'download') {
                    // Tải xuống CSV
                    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + 
                        financialData.map(row => `"${row.category}","${row.value}"`).join('\n');

                    const encodedUri = encodeURI(csvContent);
                    const link = document.createElement("a");
                    link.setAttribute("href", encodedUri);
                    link.setAttribute("download", `baocao_taichinh_${fromDate}_${toDate}.csv`);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);

                    this.showNotification('Đã tải xuống báo cáo tài chính tổng hợp', 'success');
                }
            }

            // Hiển thị popup export báo cáo tồn kho với bộ lọc
            showInventoryExportWithFilter() {
                const exportHTML = `
                    <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 1001; display: flex; justify-content: center; align-items: center;" onclick="closeModal(this)">
                        <div style="background: white; padding: 25px; border-radius: 12px; width: 500px; max-height: 80vh; overflow-y: auto;" onclick="event.stopPropagation()">
                            <div style="text-align: center; margin-bottom: 20px;">
                                <h3 style="margin: 0; font-size: 20px; color: #1f2937;">Xuất báo cáo tồn kho</h3>
                                <p style="margin: 10px 0; color: #6b7280;">Bạn muốn xem dữ liệu hay tải về file?</p>
                            </div>

                            <!-- Tùy chọn bộ lọc -->
                            <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                                <h4 style="margin: 0 0 15px 0; color: #374151; font-size: 14px;">📦 Tùy chọn lọc:</h4>
                                <div style="margin-bottom: 15px;">
                                    <label style="display: block; margin-bottom: 8px; font-size: 13px; color: #6b7280;">Lọc theo tình trạng:</label>
                                    <select id="inventoryFilter" style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;">
                                        <option value="all">Tất cả sản phẩm</option>
                                        <option value="lowStock">Sản phẩm sắp hết (< 10)</option>
                                        <option value="outOfStock">Sản phẩm hết hàng (= 0)</option>
                                        <option value="highStock">Sản phẩm nhiều hàng (≥ 50)</option>
                                    </select>
                                </div>
                                <div style="margin-bottom: 10px;">
                                    <label style="display: block; margin-bottom: 8px; font-size: 13px; color: #6b7280;">Lọc theo danh mục:</label>
                                    <select id="categoryFilter" style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;">
                                        <option value="all">Tất cả danh mục</option>
                                    </select>
                                </div>
                                <div style="font-size: 12px; color: #6b7280; font-style: italic;">
                                    * Báo cáo tình trạng tồn kho hiện tại
                                </div>
                            </div>

                            <!-- Nút hành động -->
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                                <button onclick="app.processInventoryExport('view')" 
                                        style="background: #3b82f6; color: white; border: none; padding: 12px; border-radius: 8px; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; gap: 8px;">
                                    👁️ Xem dữ liệu
                                </button>
                                <button onclick="app.processInventoryExport('download')" 
                                        style="background: #059669; color: white; border: none; padding: 12px; border-radius: 8px; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; gap: 8px;">
                                    📥 Tải về
                                </button>
                            </div>

                            <button onclick="closeModal(this.closest('div[style*=\"position: fixed\"]'))" 
                                    style="width: 100%; background: #6b7280; color: white; border: none; padding: 10px; border-radius: 8px; cursor: pointer;">
                        </div>
                    </div>
                `;

                document.body.insertAdjacentHTML('beforeend', exportHTML);

                // Tải danh mục vào select
                const categorySelect = document.getElementById('categoryFilter');
                const categories = [...new Set(this.demoData.products.map(p => p.category))];
                categories.forEach(category => {
                    if (category) {
                        const option = document.createElement('option');
                        option.value = category;
                        option.textContent = category;
                        categorySelect.appendChild(option);
                    }
                });
            }

            // Xử lý export báo cáo tồn kho
            processInventoryExport(mode) {
                const inventoryFilter = document.getElementById('inventoryFilter').value;
                const categoryFilter = document.getElementById('categoryFilter').value;

                // Lọc sản phẩm theo điều kiện
                let filteredProducts = this.demoData.products;

                // Lọc theo tình trạng tồn kho
                if (inventoryFilter === 'lowStock') {
                    filteredProducts = filteredProducts.filter(p => p.stock > 0 && p.stock < 10);
                } else if (inventoryFilter === 'outOfStock') {
                    filteredProducts = filteredProducts.filter(p => p.stock === 0);
                } else if (inventoryFilter === 'highStock') {
                    filteredProducts = filteredProducts.filter(p => p.stock >= 50);
                }

                // Lọc theo danh mục
                if (categoryFilter !== 'all') {
                    filteredProducts = filteredProducts.filter(p => p.category === categoryFilter);
                }

                // Đóng popup export
                const exportModal = document.querySelector('div[style*="position: fixed"]');
                if (exportModal) {
                    exportModal.remove();
                }

                if (mode === 'view') {
                    // Hiển thị dữ liệu
                    const columns = [
                        { header: 'Mã SP', getValue: product => product.id },
                        { header: 'Tên sản phẩm', getValue: product => product.name },
                        { header: 'Danh mục', getValue: product => product.category },
                        { header: 'Giá bán (VNĐ)', getValue: product => product.price.toLocaleString('vi-VN') },
                        { header: 'Tồn kho', getValue: product => product.stock },
                        { header: 'Giá trị (VNĐ)', getValue: product => (product.price * product.stock).toLocaleString('vi-VN') },
                        { header: 'Nhà cung cấp', getValue: product => product.supplier || 'N/A' }
                    ];

                    const filterDesc = this.getInventoryFilterDescription(inventoryFilter, categoryFilter);
                    const title = `Báo cáo tồn kho - ${filterDesc}`;
                    this.showDataViewer(title, filteredProducts, columns);

                } else if (mode === 'download') {
                    // Tải xuống CSV
                    const filterDesc = this.getInventoryFilterDescription(inventoryFilter, categoryFilter);
                    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + 
                        `Báo cáo Tồn kho - ${filterDesc}\n` +
                        "Mã SP,Tên sản phẩm,Danh mục,Giá bán,Tồn kho,Giá trị,Nhà cung cấp\n" +
                        filteredProducts.map(p => 
                            `${p.id},"${p.name}","${p.category}",${p.price},${p.stock},${p.price * p.stock},"${p.supplier || ''}"`
                        ).join('\n');

                    const encodedUri = encodeURI(csvContent);
                    const link = document.createElement("a");
                    link.setAttribute("href", encodedUri);
                    const filename = `ton_kho_${inventoryFilter}_${this.getVietnamTime().toISOString().split('T')[0]}.csv`;
                    link.setAttribute("download", filename);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);

                    this.showNotification(`Đã tải xuống báo cáo tồn kho (${filteredProducts.length} sản phẩm)`, 'success');
                }
            }

            // Mô tả bộ lọc tồn kho
            getInventoryFilterDescription(inventoryFilter, categoryFilter) {
                let desc = '';

                if (inventoryFilter === 'lowStock') desc = 'Sắp hết hàng';
                else if (inventoryFilter === 'outOfStock') desc = 'Hết hàng';  
                else if (inventoryFilter === 'highStock') desc = 'Nhiều hàng';
                else desc = 'Tất cả';

                if (categoryFilter !== 'all') {
                    desc += ` - ${categoryFilter}`;
                }

                return desc;
            }

            // Hiển thị popup export báo cáo công nợ với bộ lọc
            showDebtExportWithFilter() {
                const customersWithDebt = this.demoData.customers
                    .map(customer => ({
                        ...customer,
                        debt: (this.demoData.orders || [])
                            .filter(order => order.customerId === customer.id || order.customerName === customer.name)
                            .reduce((sum, order) => sum + this.getOrderRemainingBalance(order), 0)
                    }))
                    .filter(c => c.debt > 0);
                if (customersWithDebt.length === 0) {
                    this.showNotification('Không có khách hàng nào đang nợ', 'info');
                    return;
                }

                const exportHTML = `
                    <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); z-index: 1001; display: flex; justify-content: center; align-items: center;" onclick="closeModal(this)">
                        <div style="background: white; padding: 25px; border-radius: 12px; width: 500px; max-height: 80vh; overflow-y: auto;" onclick="event.stopPropagation()">
                            <div style="text-align: center; margin-bottom: 20px;">
                                <h3 style="margin: 0; font-size: 20px; color: #1f2937;">Xuất báo cáo công nợ</h3>
                                <p style="margin: 10px 0; color: #6b7280;">Bạn muốn xem dữ liệu hay tải về file?</p>
                            </div>

                            <!-- Tùy chọn bộ lọc -->
                            <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                                <h4 style="margin: 0 0 15px 0; color: #374151; font-size: 14px;">💰 Tùy chọn lọc:</h4>
                                <div style="margin-bottom: 15px;">
                                    <label style="display: block; margin-bottom: 8px; font-size: 13px; color: #6b7280;">Lọc theo mức nợ:</label>
                                    <select id="debtFilter" style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;">
                                        <option value="all">Tất cả khách hàng có nợ</option>
                                        <option value="low">Nợ thấp (< 1 triệu)</option>
                                        <option value="medium">Nợ trung bình (1-10 triệu)</option>
                                        <option value="high">Nợ cao (> 10 triệu)</option>
                                    </select>
                                </div>
                                <div style="margin-bottom: 15px;">
                                    <label style="display: block; margin-bottom: 8px; font-size: 13px; color: #6b7280;">Lọc theo loại khách hàng:</label>
                                    <select id="customerTypeFilter" style="width: 100%; padding: 8px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;">
                                        <option value="all">Tất cả loại</option>
                                        <option value="ca-nhan">Cá nhân</option>
                                        <option value="doanh-nghiep">Doanh nghiệp</option>
                                    </select>
                                </div>
                                <div style="font-size: 12px; color: #6b7280; font-style: italic;">
                                    * Báo cáo tình trạng công nợ khách hàng hiện tại
                                </div>
                            </div>

                            <!-- Thông tin tổng quan -->
                            <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 12px; border-radius: 6px; margin-bottom: 20px;">
                                <div style="font-size: 13px; color: #991b1b; display: flex; justify-content: space-between;">
                                    <span>Tổng số KH có nợ:</span>
                                    <strong>${customersWithDebt.length}</strong>
                                </div>
                                <div style="font-size: 13px; color: #991b1b; display: flex; justify-content: space-between;">
                                    <span>Tổng số nợ:</span>
                                    <strong>${customersWithDebt.reduce((sum, c) => sum + c.debt, 0).toLocaleString('vi-VN')} VNĐ</strong>
                                </div>
                            </div>

                            <!-- Nút hành động -->
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                                <button onclick="app.processDebtExport('view')" 
                                        style="background: #3b82f6; color: white; border: none; padding: 12px; border-radius: 8px; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; gap: 8px;">
                                    👁️ Xem dữ liệu
                                </button>
                                <button onclick="app.processDebtExport('download')" 
                                        style="background: #059669; color: white; border: none; padding: 12px; border-radius: 8px; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; gap: 8px;">
                                    📥 Tải về
                                </button>
                            </div>

                            <button onclick="closeModal(this.closest('div[style*=\"position: fixed\"]'))" 
                                    style="width: 100%; background: #6b7280; color: white; border: none; padding: 10px; border-radius: 8px; cursor: pointer;">
                        </div>
                    </div>
                `;

                document.body.insertAdjacentHTML('beforeend', exportHTML);
            }

            // Xử lý export báo cáo công nợ
            processDebtExport(mode) {
                const debtFilter = document.getElementById('debtFilter').value;
                const customerTypeFilter = document.getElementById('customerTypeFilter').value;

                // Lọc khách hàng có nợ thực tế sau khi trừ các khoản đã thanh toán từng phần
                let customersWithDebt = this.demoData.customers
                    .map(customer => ({
                        ...customer,
                        debt: (this.demoData.orders || [])
                            .filter(order => order.customerId === customer.id || order.customerName === customer.name)
                            .reduce((sum, order) => sum + this.getOrderRemainingBalance(order), 0)
                    }))
                    .filter(c => c.debt > 0);

                // Lọc theo mức nợ
                if (debtFilter === 'low') {
                    customersWithDebt = customersWithDebt.filter(c => c.debt < 1000000);
                } else if (debtFilter === 'medium') {
                    customersWithDebt = customersWithDebt.filter(c => c.debt >= 1000000 && c.debt <= 10000000);
                } else if (debtFilter === 'high') {
                    customersWithDebt = customersWithDebt.filter(c => c.debt > 10000000);
                }

                // Lọc theo loại khách hàng
                if (customerTypeFilter !== 'all') {
                    customersWithDebt = customersWithDebt.filter(c => c.type === customerTypeFilter);
                }

                // Đóng popup export
                const exportModal = document.querySelector('div[style*="position: fixed"]');
                if (exportModal) {
                    exportModal.remove();
                }

                if (customersWithDebt.length === 0) {
                    this.showNotification('Không có khách hàng nào phù hợp với điều kiện lọc', 'info');
                    return;
                }

                if (mode === 'view') {
                    // Hiển thị dữ liệu
                    const columns = [
                        { header: 'Mã KH', getValue: customer => customer.id },
                        { header: 'Tên khách hàng', getValue: customer => customer.name },
                        { header: 'Loại KH', getValue: customer => customer.type === 'doanh-nghiep' ? 'Doanh nghiệp' : 'Cá nhân' },
                        { header: 'Điện thoại', getValue: customer => customer.phone || 'N/A' },
                        { header: 'Email', getValue: customer => customer.email || 'N/A' },
                        { header: 'Số nợ (VNĐ)', getValue: customer => customer.debt.toLocaleString('vi-VN') },
                        { header: 'Hành động', getValue: customer => `
                            <button onclick="app.showCustomerDebtDetail('${customer.id}')" style="
                                background: #059669; 
                                color: white; 
                                border: none; 
                                padding: 6px 12px; 
                                border-radius: 4px; 
                                cursor: pointer; 
                                font-size: 12px; 
                                font-weight: 600;
                            ">
                                Chi tiết
                            </button>
                        ` }
                    ];

                    const filterDesc = this.getDebtFilterDescription(debtFilter, customerTypeFilter);
                    const title = `Báo cáo công nợ - ${filterDesc}`;
                    this.showDataViewer(title, customersWithDebt, columns);

                } else if (mode === 'download') {
                    // Tải xuống CSV
                    const filterDesc = this.getDebtFilterDescription(debtFilter, customerTypeFilter);
                    const totalDebt = customersWithDebt.reduce((sum, c) => sum + c.debt, 0);

                    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + 
                        `Báo cáo Công nợ - ${filterDesc}\n` +
                        `Tổng số khách hàng: ${customersWithDebt.length}\n` +
                        `Tổng số nợ: ${totalDebt.toLocaleString('vi-VN')} VNĐ\n` +
                        `Ngày báo cáo: ${this.getVietnamTime().toLocaleDateString('vi-VN')}\n\n` +
                        "Mã KH,Tên khách hàng,Loại KH,Điện thoại,Email,Số nợ\n" +
                        customersWithDebt.map(c => 
                            `${c.id},"${c.name}","${c.type === 'doanh-nghiep' ? 'Doanh nghiệp' : 'Cá nhân'}","${c.phone || ''}","${c.email || ''}",${c.debt}`
                        ).join('\n');

                    const encodedUri = encodeURI(csvContent);
                    const link = document.createElement("a");
                    link.setAttribute("href", encodedUri);
                    const filename = `cong_no_${debtFilter}_${this.getVietnamTime().toISOString().split('T')[0]}.csv`;
                    link.setAttribute("download", filename);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);

                    this.showNotification(`Đã tải xuống báo cáo công nợ (${customersWithDebt.length} khách hàng)`, 'success');
                }
            }

            // Mô tả bộ lọc công nợ
            getDebtFilterDescription(debtFilter, customerTypeFilter) {
                let desc = '';

                if (debtFilter === 'low') desc = 'Nợ thấp';
                else if (debtFilter === 'medium') desc = 'Nợ trung bình';
                else if (debtFilter === 'high') desc = 'Nợ cao';
                else desc = 'Tất cả mức nợ';

                if (customerTypeFilter === 'ca-nhan') {
                    desc += ' - Cá nhân';
                } else if (customerTypeFilter === 'doanh-nghiep') {
                    desc += ' - Doanh nghiệp';
                }

                return desc;
            }
        }

        // Notification styles
        const notificationStyles = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 16px 20px;
                border-radius: 8px;
                color: white;
                font-weight: 600;
                z-index: 1000;
                transform: translateX(400px);
                transition: transform 0.3s ease;
                max-width: 300px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.15);
            }

            .notification.show {
                transform: translateX(0);
            }

            .notification.success {
                background: var(--success-gradient);
            }

            .notification.error {
                background: var(--danger-gradient);
            }

            .notification.warning {
                background: var(--warning-gradient);
                color: var(--text-primary);
            }

            .notification.info {
                background: var(--header-gradient);
            }
        `;

        // Add notification styles to head
        const styleSheet = document.createElement('style');
        styleSheet.textContent = notificationStyles;
        document.head.appendChild(styleSheet);

        // Login functionality
        async function initializeApp(user) {
            document.getElementById('loginScreen').style.display = 'none';
            document.getElementById('appContainer').style.display = 'flex';

            try {
                // Load data từ Supabase trước
                console.log('☁️ Loading data from Supabase...');
                try {
                    const supabaseData = await loadAllData();
                    window._supabaseData = supabaseData;
                    window._supabaseDataLoaded = true;
                    console.log('✅ Supabase data loaded successfully');
                } catch (dataError) {
                    console.warn('⚠️ Failed to load Supabase data, will use localStorage:', dataError);
                    window._supabaseDataLoaded = false;
                    window._supabaseData = null;
                }

                await new Promise(resolve => setTimeout(resolve, 100));
                app = new VietnameseERP();
                window.app = app; // Make app globally accessible
                setTimeout(() => {
                    if (app) {
                        try {
                            app.setupNavigation();
                            console.log('Navigation re-setup completed');
                            console.log('App is now available globally as window.app');
                        } catch (navError) {
                            console.error('Navigation setup failed', navError);
                        }
                    }
                }, 200);
                showNotification(`Đăng nhập thành công! Chào mừng ${user.email}`, 'success');
            } catch (initError) {
                console.error('Application init failed', initError);
                const errorMessage = document.getElementById('errorMessage');
                errorMessage.textContent = 'Lỗi khởi tạo ứng dụng: ' + (initError.message || initError);
                errorMessage.style.display = 'block';
                document.getElementById('loginScreen').style.display = 'flex';
                document.getElementById('appContainer').style.display = 'none';
            }
        }

        async function initAuth() {
            const session = await getSession();
            if (session?.user) {
                await initializeApp(session.user);
                return;
            }
            document.getElementById('loginScreen').style.display = 'flex';
            document.getElementById('appContainer').style.display = 'none';
        }

        function getQueryCredentials() {
            const params = new URLSearchParams(window.location.search);
            const email = params.get('username') || params.get('email');
            const password = params.get('password');
            return { email, password };
        }

        async function handleLogin(email, password) {
            const errorMessage = document.getElementById('errorMessage');

            if (!email || !password) {
                errorMessage.textContent = 'Vui lòng nhập email và mật khẩu.';
                errorMessage.style.display = 'block';
                setTimeout(() => {
                    errorMessage.style.display = 'none';
                }, 3000);
                return;
            }

            console.log('Attempting Supabase login for', email);
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error || !data?.user) {
                console.error('Supabase login failed', error);
                errorMessage.textContent = error?.message || 'Đăng nhập thất bại. Kiểm tra email và mật khẩu.';
                errorMessage.style.display = 'block';
                setTimeout(() => {
                    errorMessage.style.display = 'none';
                }, 3000);
                return;
            }

            await initializeApp(data.user);
        }

        document.getElementById('loginForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            const email = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value;
            await handleLogin(email, password);
        });

        const queryCreds = getQueryCredentials();
        if (queryCreds.email && queryCreds.password) {
            document.getElementById('username').value = queryCreds.email;
            document.getElementById('password').value = queryCreds.password;
            handleLogin(queryCreds.email, queryCreds.password).catch(console.error);
        }

        // Logout functionality
        async function logout() {
            if (confirm('Bạn có chắc chắn muốn đăng xuất?')) {
                if (app?.demoData) {
                    try {
                        console.log('Flushing local data before logout...');
                        app.saveToLocalStorage?.();
                        if (window._supabaseDataLoaded) {
                            const synced = await syncAllDataToSupabaseImmediate(app.demoData);
                            if (!synced) {
                                showNotification('Không thể đồng bộ dữ liệu lên cloud. Vui lòng thử đăng xuất lại sau.', 'error');
                                return;
                            }
                        }
                    } catch (syncError) {
                        console.error('Failed to sync data before logout:', syncError);
                        showNotification('Không thể đồng bộ dữ liệu trước khi đăng xuất. Vui lòng thử lại.', 'error');
                        return;
                    }
                }

                const { error: signOutError } = await supabase.auth.signOut();
                if (signOutError) {
                    console.error('Supabase logout failed', signOutError);
                    showNotification('Lỗi đăng xuất: ' + signOutError.message, 'error');
                    return;
                }
                // Clear Supabase data cache
                window._supabaseDataLoaded = false;
                window._supabaseData = null;
                // Hide main app
                document.getElementById('appContainer').style.display = 'none';
                // Show login screen
                document.getElementById('loginScreen').style.display = 'flex';

                // Clear form
                document.getElementById('username').value = '';
                document.getElementById('password').value = '';

                showNotification('Đã đăng xuất thành công', 'info');
            }
        }

        // Expose functions to global scope for HTML onclick handlers
        window.logout = logout;

        initAuth();

        // Initialize the application
        let app;

        // Global function to close modal (called from onclick)
        function closeModal(element) {
            if (element) {
                element.remove();
                return;
            }
            // Try to find and remove modal by common selectors
            const modals = document.querySelectorAll('div[style*="fixed"]');
            if (modals.length > 0) {
                modals[modals.length - 1].remove(); // Remove the last modal
            }
        }

        // Global function for notifications
        function showNotification(message, type = 'info') {
            if (app) {
                app.showNotification(message, type);
            }
        }

        // Mobile menu toggle function
        function toggleMobileMenu() {
            const sidebar = document.getElementById('sidebar');
            const overlay = document.getElementById('mobileOverlay');

            if (sidebar && overlay) {
                const isOpen = sidebar.classList.contains('mobile-open');

                if (isOpen) {
                    // Close menu
                    sidebar.classList.remove('mobile-open');
                    overlay.classList.remove('active');
                } else {
                    // Open menu
                    sidebar.classList.add('mobile-open');
                    overlay.classList.add('active');
                }
            }
        }

        // Close mobile menu when clicking nav items
        document.addEventListener('DOMContentLoaded', function() {
            const navItems = document.querySelectorAll('.nav-item');
            navItems.forEach(item => {
                item.addEventListener('click', function() {
                    // Close mobile menu after navigation
                    const sidebar = document.getElementById('sidebar');
                    const overlay = document.getElementById('mobileOverlay');
                    if (sidebar && overlay) {
                        sidebar.classList.remove('mobile-open');
                        overlay.classList.remove('active');
                    }
                });
            });

            // Handle window resize
            window.addEventListener('resize', function() {
                const sidebar = document.getElementById('sidebar');
                const overlay = document.getElementById('mobileOverlay');

                // Close mobile menu on larger screens
                if (window.innerWidth > 768) {
                    if (sidebar && overlay) {
                        sidebar.classList.remove('mobile-open');
                        overlay.classList.remove('active');
                    }
                }
            });
        });

        // Expose all global functions for HTML onclick handlers
        window.closeModal = closeModal;
        window.showNotification = showNotification;
        window.toggleMobileMenu = toggleMobileMenu;
