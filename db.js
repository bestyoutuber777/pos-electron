const Database = require('better-sqlite3')
const path = require('path')
const dbPath = path.join(__dirname, 'data.db')
const db = new Database(dbPath)

function init() {
  db.prepare(`CREATE TABLE IF NOT EXISTS folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    emoji TEXT,
    color TEXT
  )`).run()

  db.prepare(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE,
    name TEXT,
    emoji TEXT,
    price REAL,
    qty INTEGER,
    folder TEXT
  )`).run()

  db.prepare(`CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    phone TEXT UNIQUE,
    total REAL DEFAULT 0,
    purchases INTEGER DEFAULT 0
  )`).run()

  db.prepare(`CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER,
    total REAL,
    method TEXT,
    paid INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT (datetime('now','localtime'))
  )`).run()

  db.prepare(`CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER,
    product_code TEXT,
    name TEXT,
    price REAL,
    qty INTEGER
  )`).run()

  const folderCount = db.prepare('SELECT COUNT(*) as c FROM folders').get().c
  if (folderCount === 0) {
    const insertFolder = db.prepare('INSERT INTO folders (name,emoji,color) VALUES (?,?,?)')
    insertFolder.run('Meva', '🍎', '#9AE6B4')
    insertFolder.run('Sut-maxsulotlari', '🥛', '#BEE3F8')
    insertFolder.run('Gazaklar', '🍪', '#FBD38D')
  }

  const row = db.prepare('SELECT COUNT(*) as c FROM products').get()
  if (row.c === 0) {
    const insert = db.prepare('INSERT INTO products (code,name,emoji,price,qty,folder) VALUES (?,?,?,?,?,?)')
    insert.run('P001','Olma','🍎',12000,120,'Meva')
    insert.run('P002','Banan','🍌',8000,60,'Meva')
    insert.run('P003','Sut','🥛',9000,30,'Sut-maxsulotlari')
    insert.run('P004','Biskvit','🍪',5000,90,'Gazaklar')
  }
}

init()

function getProducts() {
  return db.prepare('SELECT code,name,emoji,price,qty,folder FROM products ORDER BY name').all()
}

function getFolders() {
  return db.prepare('SELECT id,name,emoji,color FROM folders ORDER BY name').all()
}

function getCustomers() {
  return db.prepare('SELECT name,phone,total,purchases FROM customers ORDER BY purchases DESC').all()
}

function getCustomerHistory(phone) {
  return db.prepare(`SELECT s.id, s.total, s.method, s.paid, s.created_at, si.product_code, si.name, si.price, si.qty
    FROM sales s
    JOIN sale_items si ON si.sale_id = s.id
    JOIN customers c ON c.id = s.customer_id
    WHERE c.phone = ?
    ORDER BY s.created_at DESC`).all(phone)
}

function getDebts() {
  return db.prepare(`SELECT s.id, c.name, c.phone, s.total, s.created_at
    FROM sales s
    JOIN customers c ON c.id = s.customer_id
    WHERE s.method = 'Qarz' AND s.paid = 0
    ORDER BY s.created_at DESC`).all()
}

function getReports() {
  const payments = db.prepare(`SELECT s.id, c.name as customer, c.phone as phone, s.method, s.total, s.created_at
    FROM sales s
    LEFT JOIN customers c ON c.id = s.customer_id
    ORDER BY s.created_at DESC`).all()

  const products = db.prepare(`SELECT p.code, p.name, p.price, p.qty as remaining,
    COALESCE(SUM(si.qty),0) as sold,
    COALESCE(SUM(si.qty * si.price),0) as revenue
    FROM products p
    LEFT JOIN sale_items si ON si.product_code = p.code
    GROUP BY p.code, p.name, p.price, p.qty
    ORDER BY p.name`).all()

  const debtors = db.prepare(`SELECT c.name, c.phone, COALESCE(SUM(s.total),0) as debt
    FROM customers c
    JOIN sales s ON s.customer_id = c.id
    WHERE s.method = 'Qarz' AND s.paid = 0
    GROUP BY c.name, c.phone
    HAVING debt > 0`).all()

  const recentSales = db.prepare(`SELECT s.id, c.name as customer, s.total, s.method, s.created_at
    FROM sales s
    LEFT JOIN customers c ON c.id = s.customer_id
    ORDER BY s.created_at DESC
    LIMIT 10`).all()

  return { payments, products, debtors, recentSales }
}

function getProductStats(code) {
  return db.prepare(`SELECT p.code, p.name, p.emoji, p.price, p.qty as remaining,
      COALESCE(SUM(si.qty),0) as sold,
      COALESCE(SUM(si.qty * si.price),0) as revenue
    FROM products p
    LEFT JOIN sale_items si ON si.product_code = p.code
    WHERE p.code = ?
    GROUP BY p.code, p.name, p.emoji, p.price, p.qty`).get(code)
}

function createFolder(folder) {
  return db.prepare('INSERT INTO folders (name,emoji,color) VALUES (?,?,?)').run(folder.name, folder.emoji, folder.color).lastInsertRowid
}

function createProduct(product) {
  return db.prepare('INSERT INTO products (code,name,emoji,price,qty,folder) VALUES (?,?,?,?,?,?)')
    .run(product.code, product.name, product.emoji, product.price, product.qty, product.folder).lastInsertRowid
}

function updateProduct(product) {
  return db.prepare('UPDATE products SET name = ?, emoji = ?, price = ?, qty = ?, folder = ? WHERE code = ?')
    .run(product.name, product.emoji, product.price, product.qty, product.folder, product.code).changes
}

function deleteProduct(code) {
  return db.prepare('DELETE FROM products WHERE code = ?').run(code).changes
}

function deleteFolder(id) {
  return db.prepare('DELETE FROM folders WHERE id = ?').run(id).changes
}

function payDebt(id) {
  return db.prepare('UPDATE sales SET paid = 1, method = "Naqd" WHERE id = ?').run(id).changes
}

function createSale(sale) {
  const insertSale = db.prepare('INSERT INTO sales (customer_id,total,method,paid) VALUES (?,?,?,?)')
  const insertItem = db.prepare('INSERT INTO sale_items (sale_id,product_code,name,price,qty) VALUES (?,?,?,?,?)')
  const getProd = db.prepare('SELECT qty FROM products WHERE code = ?')
  const updateQty = db.prepare('UPDATE products SET qty = qty - ? WHERE code = ?')
  const customerStmt = db.prepare('INSERT OR IGNORE INTO customers (name,phone) VALUES (?,?)')
  const updateCustomer = db.prepare('UPDATE customers SET purchases = purchases + 1, total = total + ? WHERE phone = ?')

  const tx = db.transaction((s) => {
    customerStmt.run(s.customer.name, s.customer.phone)
    const cust = db.prepare('SELECT id FROM customers WHERE phone = ?').get(s.customer.phone)
    const paid = s.method === 'Qarz' ? 0 : 1
    const info = insertSale.run(cust.id, s.total, s.method, paid)
    const saleId = info.lastInsertRowid
    for (const it of s.items) {
      const prod = getProd.get(it.code)
      if (!prod || prod.qty < it.qty) throw new Error('Tovar yetishmayapti: ' + it.code)
      insertItem.run(saleId, it.code, it.name, it.price, it.qty)
      updateQty.run(it.qty, it.code)
    }
    updateCustomer.run(s.total, s.customer.phone)
    return saleId
  })

  return tx(sale)
}

function getStats() {
  const todaySales = db.prepare("SELECT COUNT(*) as count, SUM(total) as sum FROM sales WHERE date(created_at)=date('now','localtime')").get()
  const totalDebt = db.prepare('SELECT SUM(total) as debt FROM sales WHERE method = "Qarz" AND paid = 0').get()
  const customers = db.prepare('SELECT COUNT(*) as c FROM customers').get()
  const lowStock = db.prepare('SELECT COUNT(*) as c FROM products WHERE qty < 50').get()
  return { todaySales, totalDebt: totalDebt.debt || 0, customers: customers.c, lowStock: lowStock.c }
}

module.exports = {
  getProducts,
  getFolders,
  getCustomers,
  getCustomerHistory,
  getDebts,
  getReports,
  getProductStats,
  createFolder,
  createProduct,
  updateProduct,
  deleteProduct,
  deleteFolder,
  payDebt,
  createSale,
  getStats
}
