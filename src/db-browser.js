const STORAGE_KEYS = {
  initialized: 'pos-initialized',
  products: 'pos-products',
  folders: 'pos-folders',
  customers: 'pos-customers',
  sales: 'pos-sales',
  saleItems: 'pos-sale-items',
  nextSaleId: 'pos-next-sale-id',
  nextFolderId: 'pos-next-folder-id'
}

function load(key, fallback) {
  const raw = localStorage.getItem(key)
  if (!raw) return fallback
  try {
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

function initDb() {
  if (load(STORAGE_KEYS.initialized, false)) return

  const folders = [
    { id: 1, name: 'Meva', emoji: '🍎', color: '#9AE6B4' },
    { id: 2, name: 'Sut-maxsulotlari', emoji: '🥛', color: '#BEE3F8' },
    { id: 3, name: 'Gazaklar', emoji: '🍪', color: '#FBD38D' }
  ]

  const products = [
    { code: 'P001', name: 'Olma', emoji: '🍎', price: 12000, qty: 120, folder: 'Meva' },
    { code: 'P002', name: 'Banan', emoji: '🍌', price: 8000, qty: 60, folder: 'Meva' },
    { code: 'P003', name: 'Sut', emoji: '🥛', price: 9000, qty: 30, folder: 'Sut-maxsulotlari' },
    { code: 'P004', name: 'Biskvit', emoji: '🍪', price: 5000, qty: 90, folder: 'Gazaklar' }
  ]

  save(STORAGE_KEYS.folders, folders)
  save(STORAGE_KEYS.products, products)
  save(STORAGE_KEYS.customers, [])
  save(STORAGE_KEYS.sales, [])
  save(STORAGE_KEYS.saleItems, [])
  save(STORAGE_KEYS.nextSaleId, 1)
  save(STORAGE_KEYS.nextFolderId, 4)
  save(STORAGE_KEYS.initialized, true)
}

function getProducts() {
  initDb()
  return load(STORAGE_KEYS.products, []).sort((a, b) => a.name.localeCompare(b.name))
}

function getFolders() {
  initDb()
  return load(STORAGE_KEYS.folders, []).sort((a, b) => a.name.localeCompare(b.name))
}

function getCustomers() {
  initDb()
  return load(STORAGE_KEYS.customers, []).sort((a, b) => b.purchases - a.purchases)
}

function getCustomerHistory(phone) {
  initDb()
  const customers = load(STORAGE_KEYS.customers, [])
  const sales = load(STORAGE_KEYS.sales, [])
  const saleItems = load(STORAGE_KEYS.saleItems, [])
  const customer = customers.find((item) => item.phone === phone)
  if (!customer) return []
  const history = sales
    .filter((sale) => sale.customerId === customer.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .flatMap((sale) => saleItems
      .filter((item) => item.saleId === sale.id)
      .map((item) => ({
        id: sale.id,
        created_at: sale.createdAt,
        method: sale.method,
        paid: sale.paid,
        product_code: item.productCode,
        name: item.name,
        qty: item.qty,
        price: item.price
      }))
    )
  return history
}

function getDebts() {
  initDb()
  const sales = load(STORAGE_KEYS.sales, [])
  const customers = load(STORAGE_KEYS.customers, [])
  return sales
    .filter((sale) => sale.method === 'Qarz' && !sale.paid)
    .map((sale) => {
      const customer = customers.find((c) => c.id === sale.customerId) || { name: 'Mijoz', phone: '' }
      return {
        id: sale.id,
        name: customer.name,
        phone: customer.phone,
        total: sale.total,
        created_at: sale.createdAt
      }
    })
}

function getReports() {
  initDb()
  const sales = load(STORAGE_KEYS.sales, [])
  const saleItems = load(STORAGE_KEYS.saleItems, [])
  const customers = load(STORAGE_KEYS.customers, [])
  const products = load(STORAGE_KEYS.products, [])

  const payments = sales
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((sale) => {
      const customer = customers.find((c) => c.id === sale.customerId) || { name: 'Mijoz', phone: '' }
      return {
        id: sale.id,
        customer: customer.name,
        phone: customer.phone,
        method: sale.method,
        total: sale.total,
        created_at: sale.createdAt
      }
    })

  const productStats = products.map((product) => {
    const soldQuantity = saleItems
      .filter((item) => item.productCode === product.code)
      .reduce((sum, item) => sum + item.qty, 0)
    const revenue = saleItems
      .filter((item) => item.productCode === product.code)
      .reduce((sum, item) => sum + item.qty * item.price, 0)
    return {
      code: product.code,
      name: product.name,
      price: product.price,
      remaining: product.qty,
      sold: soldQuantity,
      revenue
    }
  })

  const debtorMap = {}
  sales
    .filter((sale) => sale.method === 'Qarz' && !sale.paid)
    .forEach((sale) => {
      const customer = customers.find((c) => c.id === sale.customerId)
      if (!customer) return
      const key = customer.phone
      debtorMap[key] = debtorMap[key] || { name: customer.name, phone: customer.phone, debt: 0 }
      debtorMap[key].debt += sale.total
    })

  const debtors = Object.values(debtorMap)

  const recentSales = payments.slice(0, 10)

  return { payments, products: productStats, debtors, recentSales }
}

function getProductStats(code) {
  initDb()
  const products = load(STORAGE_KEYS.products, [])
  const saleItems = load(STORAGE_KEYS.saleItems, [])
  const product = products.find((item) => item.code === code) || null
  if (!product) return null
  const sold = saleItems.filter((item) => item.productCode === code).reduce((sum, item) => sum + item.qty, 0)
  const revenue = saleItems.filter((item) => item.productCode === code).reduce((sum, item) => sum + item.qty * item.price, 0)
  return {
    code: product.code,
    name: product.name,
    emoji: product.emoji,
    price: product.price,
    remaining: product.qty,
    sold,
    revenue
  }
}

function createFolder(folder) {
  initDb()
  const folders = load(STORAGE_KEYS.folders, [])
  const nextFolderId = load(STORAGE_KEYS.nextFolderId, 1)
  const item = { id: nextFolderId, ...folder }
  folders.push(item)
  save(STORAGE_KEYS.folders, folders)
  save(STORAGE_KEYS.nextFolderId, nextFolderId + 1)
  return item.id
}

function createProduct(product) {
  initDb()
  const products = load(STORAGE_KEYS.products, [])
  products.push(product)
  save(STORAGE_KEYS.products, products)
  return product.code
}

function updateProduct(product) {
  initDb()
  const products = load(STORAGE_KEYS.products, [])
  const index = products.findIndex((item) => item.code === product.code)
  if (index === -1) return 0
  products[index] = { ...products[index], ...product }
  save(STORAGE_KEYS.products, products)
  return 1
}

function deleteProduct(code) {
  initDb()
  let products = load(STORAGE_KEYS.products, [])
  products = products.filter((item) => item.code !== code)
  save(STORAGE_KEYS.products, products)
  return 1
}

function deleteFolder(id) {
  initDb()
  let folders = load(STORAGE_KEYS.folders, [])
  folders = folders.filter((item) => item.id !== id)
  save(STORAGE_KEYS.folders, folders)
  return 1
}

function payDebt(id) {
  initDb()
  const sales = load(STORAGE_KEYS.sales, [])
  const index = sales.findIndex((sale) => sale.id === id)
  if (index === -1) return 0
  sales[index] = { ...sales[index], paid: true, method: 'Naqd' }
  save(STORAGE_KEYS.sales, sales)
  return 1
}

function createSale(sale) {
  initDb()
  const products = load(STORAGE_KEYS.products, [])
  const customers = load(STORAGE_KEYS.customers, [])
  const sales = load(STORAGE_KEYS.sales, [])
  const saleItems = load(STORAGE_KEYS.saleItems, [])
  let nextSaleId = load(STORAGE_KEYS.nextSaleId, 1)

  const customerPhone = sale.customer.phone || ''
  let customer = customers.find((item) => item.phone === customerPhone)
  if (!customer) {
    customer = { id: customers.length + 1, name: sale.customer.name, phone: customerPhone, total: 0, purchases: 0 }
    customers.push(customer)
  }

  for (const item of sale.items) {
    const product = products.find((product) => product.code === item.code)
    if (!product || product.qty < item.qty) {
      throw new Error('Tovar yetishmayapti: ' + item.code)
    }
  }

  sale.items.forEach((item) => {
    const product = products.find((product) => product.code === item.code)
    product.qty -= item.qty
  })

  customer.purchases += 1
  customer.total += sale.total

  const saleEntry = {
    id: nextSaleId,
    customerId: customer.id,
    total: sale.total,
    method: sale.method,
    paid: sale.method === 'Qarz' ? false : true,
    createdAt: new Date().toLocaleString()
  }

  sales.push(saleEntry)
  sale.items.forEach((item) => {
    saleItems.push({ saleId: nextSaleId, productCode: item.code, name: item.name, price: item.price, qty: item.qty })
  })

  save(STORAGE_KEYS.products, products)
  save(STORAGE_KEYS.customers, customers)
  save(STORAGE_KEYS.sales, sales)
  save(STORAGE_KEYS.saleItems, saleItems)
  save(STORAGE_KEYS.nextSaleId, nextSaleId + 1)

  return nextSaleId
}

function getStats() {
  initDb()
  const sales = load(STORAGE_KEYS.sales, [])
  const customers = load(STORAGE_KEYS.customers, [])
  const products = load(STORAGE_KEYS.products, [])
  const today = new Date().toLocaleDateString()

  const todaySales = {
    count: sales.filter((sale) => new Date(sale.createdAt).toLocaleDateString() === today).length,
    sum: sales.filter((sale) => new Date(sale.createdAt).toLocaleDateString() === today).reduce((sum, sale) => sum + sale.total, 0)
  }
  const totalDebt = sales.filter((sale) => sale.method === 'Qarz' && !sale.paid).reduce((sum, sale) => sum + sale.total, 0)
  const lowStock = products.filter((product) => product.qty < 50).length

  return { todaySales, totalDebt, customers: customers.length, lowStock }
}

export {
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
