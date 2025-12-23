const Database = require('better-sqlite3');
const path = require('path');

// Initialize database
const dbPath = path.join(__dirname, 'database.db');
const db = new Database(dbPath);

console.log('📁 Database path:', dbPath);

// ========================
// Generate Random IDs
// ========================
function generateProductId() {
    return 'PROD-' + Math.floor(1000 + Math.random() * 9000);
}

function generateOrderId() {
    return 'ORD-' + Math.floor(1000 + Math.random() * 9000);
}

function generateKeyId() {
    return 'KEY-' + Math.floor(1000 + Math.random() * 9000);
}

function generateTicketId() {
    return 'TKT-' + Math.floor(1000 + Math.random() * 9000);
}

// ========================
// Create Tables
// ========================
db.exec(`
    -- Products table
    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id TEXT UNIQUE NOT NULL,
        guild_id TEXT NOT NULL,
        seller_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        ltc_price REAL NOT NULL,
        usd_price REAL,
        stock INTEGER DEFAULT 0,
        image_url TEXT,
        deliverables TEXT,
        on_hold INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    -- Orders table
    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id TEXT UNIQUE NOT NULL,
        guild_id TEXT,
        user_id TEXT NOT NULL,
        seller_id TEXT,
        product_id TEXT NOT NULL,
        ltc_address TEXT NOT NULL,
        amount REAL NOT NULL,
        usd_amount REAL,
        status TEXT DEFAULT 'pending',
        payment_method TEXT DEFAULT 'ltc',
        payment_code TEXT,
        txid TEXT,
        delivered_key TEXT,
        delivered_at INTEGER,
        refunded_at INTEGER,
        refunded_by TEXT,
        ticket_channel_id TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER
    );

    -- Transactions table
    CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id TEXT NOT NULL,
        txid TEXT NOT NULL,
        amount REAL NOT NULL,
        confirmations INTEGER DEFAULT 0,
        timestamp INTEGER DEFAULT (strftime('%s', 'now'))
    );

    -- Product keys/codes table
    CREATE TABLE IF NOT EXISTS product_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key_id TEXT UNIQUE NOT NULL,
        product_id TEXT NOT NULL,
        key_value TEXT NOT NULL,
        is_used INTEGER DEFAULT 0,
        used_by TEXT,
        used_at INTEGER,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    -- Tickets table
    CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id TEXT UNIQUE NOT NULL,
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        seller_id TEXT,
        type TEXT DEFAULT 'purchase',
        product_name TEXT,
        payment_method TEXT,
        acknowledged INTEGER DEFAULT 0,
        status TEXT DEFAULT 'open',
        claimed_by TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        closed_at INTEGER
    );
`);

console.log('✅ Database tables initialized');

// ========================
// Products
// ========================
db.getProducts = (guildId) => {
    if (guildId) {
        return db.prepare('SELECT * FROM products WHERE guild_id = ?').all(guildId);
    }
    return db.prepare('SELECT * FROM products').all();
};

db.getProductById = (productId, guildId) => {
    if (guildId) {
        return db.prepare('SELECT * FROM products WHERE product_id = ? AND guild_id = ?').get(productId, guildId);
    }
    return db.prepare('SELECT * FROM products WHERE product_id = ?').get(productId);
};

db.getProductsBySeller = (guildId, sellerId) => {
    return db.prepare('SELECT * FROM products WHERE guild_id = ? AND seller_id = ?').all(guildId, sellerId);
};

db.addProduct = (name, description, ltcPrice, usdPrice, stock, imageUrl, guildId, sellerId, deliverables = '[]') => {
    const productId = generateProductId();
    db.prepare(`
        INSERT INTO products (product_id, guild_id, seller_id, name, description, ltc_price, usd_price, stock, image_url, deliverables)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(productId, guildId, sellerId, name, description, ltcPrice, usdPrice, stock, imageUrl, deliverables);
    return { productId };
};

db.updateProductStock = (productId, stock) => {
    return db.prepare('UPDATE products SET stock = ? WHERE product_id = ?').run(stock, productId);
};

db.getSellersWithProducts = (guildId) => {
    return db.prepare(`
        SELECT seller_id as user_id, COUNT(*) as product_count 
        FROM products 
        WHERE guild_id = ? AND stock > 0 
        GROUP BY seller_id
    `).all(guildId);
};

// Delete product
db.deleteProduct = (productId) => {
    return db.prepare('DELETE FROM products WHERE product_id = ?').run(productId);
};

// Get product by name
db.getProductByName = (name, guildId) => {
    return db.prepare('SELECT * FROM products WHERE LOWER(name) = LOWER(?) AND guild_id = ?').get(name, guildId);
};

// Update product
db.updateProduct = (productId, updates) => {
    const fields = [];
    const values = [];
    
    if (updates.name !== undefined) {
        fields.push('name = ?');
        values.push(updates.name);
    }
    if (updates.usd_price !== undefined) {
        fields.push('usd_price = ?');
        values.push(updates.usd_price);
    }
    if (updates.ltc_price !== undefined) {
        fields.push('ltc_price = ?');
        values.push(updates.ltc_price);
    }
    if (updates.description !== undefined) {
        fields.push('description = ?');
        values.push(updates.description);
    }
    if (updates.on_hold !== undefined) {
        fields.push('on_hold = ?');
        values.push(updates.on_hold);
    }
    if (updates.deliverables !== undefined) {
        fields.push('deliverables = ?');
        values.push(updates.deliverables);
    }
    
    if (fields.length === 0) return null;
    
    values.push(productId);
    return db.prepare(`UPDATE products SET ${fields.join(', ')} WHERE product_id = ?`).run(...values);
};

// Set product hold status
db.setProductHold = (productId, onHold) => {
    return db.prepare('UPDATE products SET on_hold = ? WHERE product_id = ?').run(onHold ? 1 : 0, productId);
};

// ========================
// Product Keys
// ========================
db.addProductKey = (productId, keyValue) => {
    const keyId = generateKeyId();
    db.prepare('INSERT INTO product_keys (key_id, product_id, key_value) VALUES (?, ?, ?)').run(keyId, productId, keyValue);
    return { keyId };
};

db.getProductKeyCount = (productId) => {
    const result = db.prepare('SELECT COUNT(*) as count FROM product_keys WHERE product_id = ? AND is_used = 0').get(productId);
    return result ? result.count : 0;
};

db.getAvailableKey = (productId) => {
    return db.prepare('SELECT * FROM product_keys WHERE product_id = ? AND is_used = 0 LIMIT 1').get(productId);
};

db.markKeyUsed = (keyId, userId) => {
    return db.prepare('UPDATE product_keys SET is_used = 1, used_by = ?, used_at = strftime(\'%s\', \'now\') WHERE id = ?').run(userId, keyId);
};

// ========================
// Orders
// ========================
db.createOrder = (userId, productId, ltcAddress, amount, usdAmount, paymentMethod, paymentCode, guildId, sellerId, ticketChannelId) => {
    const orderId = generateOrderId();
    db.prepare(`
        INSERT INTO orders (order_id, guild_id, user_id, seller_id, product_id, ltc_address, amount, usd_amount, payment_method, payment_code, ticket_channel_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(orderId, guildId, userId, sellerId, productId, ltcAddress, amount, usdAmount, paymentMethod, paymentCode, ticketChannelId);
    return { orderId };
};

db.getOrderById = (orderId) => {
    return db.prepare('SELECT * FROM orders WHERE order_id = ?').get(orderId);
};

db.getOrdersByUser = (userId) => {
    return db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(userId);
};

db.updateOrderStatus = (orderId, status) => {
    return db.prepare('UPDATE orders SET status = ?, updated_at = strftime(\'%s\', \'now\') WHERE order_id = ?').run(status, orderId);
};

db.markOrderPaid = (orderId, txid) => {
    return db.prepare('UPDATE orders SET status = \'paid\', txid = ?, updated_at = strftime(\'%s\', \'now\') WHERE order_id = ?').run(txid, orderId);
};

db.markOrderDelivered = (orderId, deliveredKey) => {
    return db.prepare('UPDATE orders SET status = \'delivered\', delivered_key = ?, delivered_at = strftime(\'%s\', \'now\'), updated_at = strftime(\'%s\', \'now\') WHERE order_id = ?').run(deliveredKey, orderId);
};

// ========================
// Transactions
// ========================
db.addTransaction = (orderId, txid, amount) => {
    return db.prepare('INSERT INTO transactions (order_id, txid, amount) VALUES (?, ?, ?)').run(orderId, txid, amount);
};

db.getTransactionByTxid = (txid) => {
    return db.prepare('SELECT * FROM transactions WHERE txid = ?').get(txid);
};

// ========================
// Tickets
// ========================
db.createTicket = (guildId, channelId, userId, type, sellerId, productName, paymentMethod, acknowledged) => {
    const ticketId = generateTicketId();
    db.prepare(`
        INSERT INTO tickets (ticket_id, guild_id, channel_id, user_id, seller_id, type, product_name, payment_method, acknowledged)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(ticketId, guildId, channelId, userId, sellerId || null, type, productName || null, paymentMethod || null, acknowledged || 0);
    return { ticketId };
};

db.getTicketByChannelId = (channelId) => {
    return db.prepare('SELECT * FROM tickets WHERE channel_id = ?').get(channelId);
};

db.updateTicketStatus = (ticketId, status) => {
    return db.prepare('UPDATE tickets SET status = ?, closed_at = strftime(\'%s\', \'now\') WHERE ticket_id = ?').run(status, ticketId);
};

db.claimTicket = (ticketId, userId) => {
    return db.prepare('UPDATE tickets SET claimed_by = ? WHERE ticket_id = ?').run(userId, ticketId);
};

module.exports = db;
