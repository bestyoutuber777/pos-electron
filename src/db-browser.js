import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://fwzcrpykixlunuwindym.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3emNycHlraXhsdW51d2luZHltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5MTIzODIsImV4cCI6MjA5NjQ4ODM4Mn0.8XvxT_WYO-DcbyZNPF-0HzjpGplmHZFaQfVW9cZBN0o'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export async function getProducts() {
  const { data } = await supabase.from('products').select('*').order('name')
  return data || []
}

export async function getFolders() {
  const { data } = await supabase.from('folders').select('*').order('name')
  return data || []
}

export async function getCustomers() {
  const { data } = await supabase.from('customers').select('*').order('purchases', { ascending: false })
  return data || []
}

export async function getCustomerHistory(phone) {
  const { data: customer } = await supabase.from('customers').select('id').eq('phone', phone).single()
  if (!customer) return []
  const { data: sales } = await supabase.from('sales').select('*, sale_items(*)').eq('customer_id', customer.id).order('created_at', { ascending: false })
  return sales || []
}

export async function getDebts() {
  const { data } = await supabase.from('sales').select('*, customers(name, phone)').eq('method', 'Qarz').eq('paid', 0).order('created_at', { ascending: false })
  return data || []
}

export async function getReports() {
  const { data: payments } = await supabase.from('sales').select('*, customers(name, phone)').order('created_at', { ascending: false })
  const { data: products } = await supabase.from('products').select('*').order('name')
  const { data: saleItems } = await supabase.from('sale_items').select('*')
  const { data: debtSales } = await supabase.from('sales').select('total, customer_id, customers(name, phone)').eq('method', 'Qarz').eq('paid', 0)

  const productsWithStats = (products || []).map(p => {
    const items = (saleItems || []).filter(i => i.product_code === p.code)
    const sold = items.reduce((s, i) => s + i.qty, 0)
    const revenue = items.reduce((s, i) => s + i.qty * i.price, 0)
    return { ...p, sold, revenue, remaining: p.qty }
  })

  const debtorMap = {}
  for (const s of (debtSales || [])) {
    const key = s.customer_id
    if (!debtorMap[key]) debtorMap[key] = { name: s.customers?.name, phone: s.customers?.phone, debt: 0 }
    debtorMap[key].debt += s.total
  }

  return {
    payments: payments || [],
    products: productsWithStats,
    debtors: Object.values(debtorMap),
    recentSales: (payments || []).slice(0, 10)
  }
}

export async function getProductStats() {
  const { data } = await supabase.from('sale_items').select('*')
  return data || []
}

export async function createFolder(folder) {
  const { data } = await supabase.from('folders').insert(folder).select().single()
  return data
}

export async function createProduct(product) {
  const { data } = await supabase.from('products').insert(product).select().single()
  return data
}

export async function updateProduct(code, updates) {
  const { data } = await supabase.from('products').update(updates).eq('code', code).select().single()
  return data
}

export async function deleteProduct(code) {
  await supabase.from('products').delete().eq('code', code)
}

export async function deleteFolder(name) {
  await supabase.from('folders').delete().eq('name', name)
}

export async function payDebt(saleId) {
  await supabase.from('sales').update({ paid: 1 }).eq('id', saleId)
}

export async function createSale({ customer, cart, total, method }) {
  let customerId = null

  if (customer.name && customer.phone) {
    const { data: existing } = await supabase.from('customers').select('id, purchases, total').eq('phone', customer.phone).single()
    if (existing) {
      await supabase.from('customers').update({ purchases: existing.purchases + 1, total: existing.total + total }).eq('id', existing.id)
      customerId = existing.id
    } else {
      const { data: newC } = await supabase.from('customers').insert({ name: customer.name, phone: customer.phone, purchases: 1, total }).select().single()
      customerId = newC?.id
    }
  }

  const { data: sale } = await supabase.from('sales').insert({ customer_id: customerId, total, method, paid: method === 'Qarz' ? 0 : 1 }).select().single()

  if (sale) {
    const items = cart.map(item => ({ sale_id: sale.id, product_code: item.code, name: item.name, price: item.price, qty: item.qty }))
    await supabase.from('sale_items').insert(items)
    for (const item of cart) {
      const { data: prod } = await supabase.from('products').select('qty').eq('code', item.code).single()
      if (prod) await supabase.from('products').update({ qty: prod.qty - item.qty }).eq('code', item.code)
    }
  }

  return sale
}

export async function getStats() {
  const today = new Date().toISOString().slice(0, 10)
  const { data: todaySales } = await supabase.from('sales').select('total, method').gte('created_at', today)
  const todayTotal = todaySales?.reduce((s, r) => s + r.total, 0) || 0
  const todayCount = todaySales?.length || 0
  const { data: debts } = await supabase.from('sales').select('total').eq('method', 'Qarz').eq('paid', 0)
  const debtTotal = debts?.reduce((s, r) => s + r.total, 0) || 0
  const { data: products } = await supabase.from('products').select('qty')
  const totalStock = products?.reduce((s, r) => s + r.qty, 0) || 0
  return { todayTotal, todayCount, debtTotal, totalStock }
                                                                                     }
