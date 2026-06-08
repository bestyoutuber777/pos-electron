import React, { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import * as XLSX from 'xlsx'
import {
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
} from './db-browser'

const paymentOptions = ['Naqd', 'Online', 'Qarz']

const api = window?.api || {
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

export default function App() {
  const [activeTab, setActiveTab] = useState('Savdo')
  const [products, setProducts] = useState([])
  const [folders, setFolders] = useState([])
  const [customers, setCustomers] = useState([])
  const [debts, setDebts] = useState([])
  const [reports, setReports] = useState({ payments: [], products: [], debtors: [], recentSales: [] })
  const [stats, setStats] = useState(null)
  const [search, setSearch] = useState('')
  const [selectedFolder, setSelectedFolder] = useState('Barchasi')
  const [cart, setCart] = useState([])
  const [paymentMethod, setPaymentMethod] = useState('Naqd')
  const [buyerName, setBuyerName] = useState('')
  const [buyerPhone, setBuyerPhone] = useState('')
  const [analytics, setAnalytics] = useState(null)
  const [receipt, setReceipt] = useState(null)
  const [newProduct, setNewProduct] = useState({ code: '', name: '', emoji: '📦', price: 0, qty: 0, folder: '' })
  const [newFolder, setNewFolder] = useState({ name: '', emoji: '📁', color: '#F6AD55' })
  const [customerHistory, setCustomerHistory] = useState([])
  const [productEdits, setProductEdits] = useState({})
  const [qrCode, setQrCode] = useState(null)

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    const [productsRes, foldersRes, customersRes, debtsRes, reportsRes, statsRes] = await Promise.all([
      api.getProducts(),
      api.getFolders(),
      api.getCustomers(),
      api.getDebts(),
      api.getReports(),
      api.getStats()
    ])

    setProducts(productsRes)
    setFolders(foldersRes)
    setCustomers(customersRes)
    setDebts(debtsRes)
    setReports(reportsRes)
    setStats(statsRes)
    setProductEdits({})
    setQrCode(null)
  }

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const query = search.trim().toLowerCase()
      const matchesSearch = !query || product.name.toLowerCase().includes(query) || product.code.toLowerCase().includes(query)
      const matchesFolder = selectedFolder === 'Barchasi' || product.folder === selectedFolder
      return matchesSearch && matchesFolder
    })
  }, [products, search, selectedFolder])

  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0)
  const totalSum = cart.reduce((sum, item) => sum + item.qty * item.price, 0)

  function addToCart(product) {
    setCart((existing) => {
      const found = existing.find((item) => item.code === product.code)
      if (found) {
        return existing.map((item) => item.code === product.code ? { ...item, qty: item.qty + 1 } : item)
      }
      return [...existing, { ...product, qty: 1 }]
    })
  }

  function updateCartQty(code, qty) {
    if (qty < 1) return
    setCart((existing) => existing.map((item) => item.code === code ? { ...item, qty } : item))
  }

  function removeFromCart(code) {
    setCart((existing) => existing.filter((item) => item.code !== code))
  }

  async function checkout() {
    if (!cart.length) return alert('Savat bo‘sh. Mahsulot qo‘shing.')
    const customer = { name: buyerName || 'Mijoz', phone: buyerPhone || '' }
    const sale = {
      customer,
      items: cart.map((item) => ({ code: item.code, name: item.name, price: item.price, qty: item.qty })),
      total: totalSum,
      method: paymentMethod
    }
    try {
      const saleId = await api.createSale(sale)
      const newReceipt = { id: saleId, customer, items: cart, total: totalSum, method: paymentMethod, date: new Date().toLocaleString() }
      setReceipt(newReceipt)
      setCart([])
      setBuyerName('')
      setBuyerPhone('')
      setPaymentMethod('Naqd')
      await loadAll()
      setTimeout(() => window.print(), 300)
    } catch (error) {
      alert('Xato: ' + error.message)
    }
  }

  async function openAnalytics(product) {
    const data = await api.getProductStats(product.code)
    setAnalytics(data)
  }

  async function handleCreateFolder() {
    if (!newFolder.name.trim()) return alert('Papka nomi kiriting')
    await api.createFolder(newFolder)
    setNewFolder({ name: '', emoji: '📁', color: '#F6AD55' })
    await loadAll()
  }

  async function handleCreateProduct() {
    if (!newProduct.code.trim() || !newProduct.name.trim()) return alert('Kod va nom kiriting')
    await api.createProduct(newProduct)
    setNewProduct({ code: '', name: '', emoji: '📦', price: 0, qty: 0, folder: newProduct.folder || (folders[0]?.name || '') })
    await loadAll()
  }

  async function saveProduct(product) {
    await api.updateProduct(product)
    await loadAll()
  }

  async function handleDeleteProduct(code) {
    if (!window.confirm('Tovarni o‘chirishni xohlaysizmi?')) return
    await api.deleteProduct(code)
    await loadAll()
  }

  async function handleDeleteFolder(id) {
    if (!window.confirm('Papkani o‘chirishni xohlaysizmi?')) return
    await api.deleteFolder(id)
    await loadAll()
  }

  async function handlePayDebt(id) {
    await api.payDebt(id)
    await loadAll()
  }

  async function openCustomerHistory(phone) {
    const history = await api.getCustomerHistory(phone)
    setCustomerHistory(history)
  }

  function editProduct(code, field, value) {
    setProductEdits((current) => ({
      ...current,
      [code]: {
        ...(current[code] || products.find((item) => item.code === code)),
        [field]: value
      }
    }))
  }

  function exportExcel(type) {
    let data = []
    let fileName = 'report.xlsx'
    if (type === 'payments') {
      data = reports.payments.map((row) => ({ ID: row.id, Xaridor: row.customer, Telefon: row.phone, Usul: row.method, Summa: row.total, Sana: row.created_at }))
      fileName = 'tolovlar_hisoboti.xlsx'
    } else if (type === 'products') {
      data = reports.products.map((row) => ({ Kod: row.code, Nom: row.name, Narx: row.price, Qoldiq: row.remaining, Sotilgan: row.sold, Daromad: row.revenue }))
      fileName = 'tovarlar_hisoboti.xlsx'
    } else if (type === 'debtors') {
      data = reports.debtors.map((row) => ({ Ism: row.name, Telefon: row.phone, Summa: row.debt }))
      fileName = 'qarzdorlar.xlsx'
    }
    const worksheet = XLSX.utils.json_to_sheet(data)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Hisobot')
    const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([wbout], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.click()
    URL.revokeObjectURL(url)
  }

  async function showQRCode() {
    const value = `To'lov: ${totalSum} so'm, ${paymentMethod}`
    const q = await QRCode.toDataURL(value, { width: 200 })
    setQrCode(q)
  }

  const productEditRows = products.map((product) => ({
    ...product,
    ...(productEdits[product.code] || {})
  }))

  return (
    <div className="app">
      <header className="topbar">
        <h1>POS Magazim</h1>
        <div className="tabs">
          {['Savdo', 'Tovarlar', 'Papka', 'Mijozlar', 'Qarzlar', 'Hisobot'].map((tab) => (
            <button key={tab} className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)}>{tab}</button>
          ))}
        </div>
      </header>

      <main className="content">
        {activeTab === 'Savdo' && (
          <div className="panel sales-panel">
            <section className="product-list">
              <div className="section-header">
                <div>
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Mahsulotni nomi yoki kodi bo'yicha qidirish" />
                </div>
                <div className="folder-chips">
                  <button className={selectedFolder === 'Barchasi' ? 'chip active' : 'chip'} onClick={() => setSelectedFolder('Barchasi')}>Barchasi</button>
                  {folders.map((folder) => (
                    <button key={folder.name} className={selectedFolder === folder.name ? 'chip active' : 'chip'} onClick={() => setSelectedFolder(folder.name)}>{folder.emoji} {folder.name}</button>
                  ))}
                </div>
              </div>
              <div className="grid">
                {filteredProducts.map((product) => (
                  <div key={product.code} className={`card ${product.qty < 50 ? 'low' : ''}`}>
                    <div className="card-top">
                      <span className="emoji">{product.emoji}</span>
                      <button className="tiny" onClick={() => openAnalytics(product)}>📊</button>
                    </div>
                    <div className="meta">
                      <div className="name">{product.name}</div>
                      <div className="code">{product.code}</div>
                      <div className="price">{product.price.toLocaleString()} so'm</div>
                      <div className="qty">{product.qty} dona {product.qty < 50 && <span className="badge">Kam!</span>}</div>
                    </div>
                    <button onClick={() => addToCart(product)}>+ Qo'sh</button>
                  </div>
                ))}
              </div>
            </section>
            <aside className="order-panel">
              <div className="panel-card">
                <h2>Buyurtma paneli</h2>
                <div className="summary-row"><span>Jami mahsulot:</span><strong>{totalItems}</strong></div>
                <div className="summary-row"><span>Jami summa:</span><strong>{totalSum.toLocaleString()} so'm</strong></div>
                <div className="payment-methods">
                  {paymentOptions.map((method) => (
                    <button key={method} className={paymentMethod === method ? 'method active' : 'method'} onClick={() => setPaymentMethod(method)}>{method}</button>
                  ))}
                </div>
                <div className="form-row">
                  <label>Xaridor ismi</label>
                  <input value={buyerName} onChange={(e) => setBuyerName(e.target.value)} placeholder="Ism" />
                </div>
                <div className="form-row">
                  <label>Telefon</label>
                  <input value={buyerPhone} onChange={(e) => setBuyerPhone(e.target.value)} placeholder="+998..." />
                </div>
                <button className="pay-button" onClick={checkout}>To'lash</button>
                <button className="secondary" onClick={showQRCode}>QR kod</button>
                {qrCode && <img src={qrCode} alt="QR kod" style={{ marginTop: 14, borderRadius: 14, width: 180 }} />}
              </div>
              <div className="cart-list panel-card">
                <h3>Savat</h3>
                {cart.length === 0 ? <div>Hozircha tanlangan mahsulot yo'q.</div> : cart.map((item) => (
                  <div key={item.code} className="cart-item">
                    <div>
                      <div className="cart-name">{item.name}</div>
                      <div className="cart-meta">{item.code} · {item.price.toLocaleString()} so'm</div>
                    </div>
                    <div className="cart-controls">
                      <input type="number" min={1} value={item.qty} onChange={(e) => updateCartQty(item.code, Number(e.target.value))} />
                      <button className="tiny" onClick={() => removeFromCart(item.code)}>×</button>
                    </div>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        )}

        {activeTab === 'Tovarlar' && (
          <div className="panel admin-panel">
            <div className="panel-card">
              <h2>Yangi tovar qo'shish</h2>
              <div className="form-row"><label>Kod</label><input value={newProduct.code} onChange={(e) => setNewProduct({ ...newProduct, code: e.target.value })} /></div>
              <div className="form-row"><label>Nom</label><input value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} /></div>
              <div className="form-row"><label>Emoji</label><input value={newProduct.emoji} onChange={(e) => setNewProduct({ ...newProduct, emoji: e.target.value })} /></div>
              <div className="form-row"><label>Narx</label><input type="number" value={newProduct.price} onChange={(e) => setNewProduct({ ...newProduct, price: Number(e.target.value) })} /></div>
              <div className="form-row"><label>Miqdor</label><input type="number" value={newProduct.qty} onChange={(e) => setNewProduct({ ...newProduct, qty: Number(e.target.value) })} /></div>
              <div className="form-row"><label>Papka</label><select value={newProduct.folder} onChange={(e) => setNewProduct({ ...newProduct, folder: e.target.value })}>
                <option value="">Tanlang</option>
                {folders.map((folder) => <option key={folder.name} value={folder.name}>{folder.name}</option>)}
              </select></div>
              <button className="pay-button" onClick={handleCreateProduct}>Saqlash</button>
            </div>
            <div className="panel-card">
              <h2>Barcha tovarlar</h2>
              <div className="table">
                <div className="row header"><span>Kod</span><span>Nom</span><span>Narx</span><span>Miqdor</span><span>Papka</span><span></span></div>
                {productEditRows.map((product) => (
                  <div key={product.code} className="row item">
                    <span>{product.code}</span>
                    <span>{product.name}</span>
                    <span><input type="number" value={product.price} onChange={(e) => editProduct(product.code, 'price', Number(e.target.value))} /></span>
                    <span><input type="number" value={product.qty} onChange={(e) => editProduct(product.code, 'qty', Number(e.target.value))} /></span>
                    <span>{product.folder}</span>
                    <span><button className="tiny" onClick={() => saveProduct(product)}>Saqlash</button></span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Papka' && (
          <div className="panel admin-panel">
            <div className="panel-card">
              <h2>Yangi papka yaratish</h2>
              <div className="form-row"><label>Nom</label><input value={newFolder.name} onChange={(e) => setNewFolder({ ...newFolder, name: e.target.value })} /></div>
              <div className="form-row"><label>Emoji</label><input value={newFolder.emoji} onChange={(e) => setNewFolder({ ...newFolder, emoji: e.target.value })} /></div>
              <div className="form-row"><label>Rang</label><input type="color" value={newFolder.color} onChange={(e) => setNewFolder({ ...newFolder, color: e.target.value })} /></div>
              <button className="pay-button" onClick={handleCreateFolder}>Saqlash</button>
            </div>
            <div className="panel-card">
              <h2>Papka ro'yxati</h2>
              <div className="table">
                <div className="row header"><span>Emoji</span><span>Nom</span><span>Rang</span><span></span></div>
                {folders.map((folder) => (
                  <div key={folder.id} className="row item">
                    <span>{folder.emoji}</span>
                    <span>{folder.name}</span>
                    <span><span className="color-badge" style={{ background: folder.color }} /></span>
                    <span><button className="tiny" onClick={() => handleDeleteFolder(folder.id)}>O'chirish</button></span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Mijozlar' && (
          <div className="panel admin-panel">
            <div className="panel-card">
              <h2>Mijozlar bazasi</h2>
              <div className="table">
                <div className="row header"><span>Ism</span><span>Telefon</span><span>Xaridlar</span><span>Jami</span><span></span></div>
                {customers.map((customer) => (
                  <div key={customer.phone} className="row item">
                    <span>{customer.name}</span>
                    <span>{customer.phone}</span>
                    <span>{customer.purchases}</span>
                    <span>{customer.total.toLocaleString()}</span>
                    <span><button className="tiny" onClick={() => openCustomerHistory(customer.phone)}>Tarix</button></span>
                  </div>
                ))}
              </div>
            </div>
            {customerHistory.length > 0 && (
              <div className="panel-card">
                <h2>Xaridlar tarixi</h2>
                {customerHistory.map((row) => (
                  <div key={`${row.id}-${row.product_code}`} className="history-row">
                    <div>{row.created_at}</div>
                    <div>{row.name} x{row.qty} - {row.price.toLocaleString()} so'm</div>
                    <div>{row.method} {row.paid ? '' : '(qarz)'}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'Qarzlar' && (
          <div className="panel admin-panel">
            <div className="panel-card">
              <h2>Qarzlar</h2>
              <div className="summary-row"><span>Jami qarz:</span><strong>{stats ? stats.totalDebt.toLocaleString() : 0} so'm</strong></div>
              <div className="table">
                <div className="row header"><span>Ism</span><span>Telefon</span><span>Summa</span><span>Sana</span><span></span></div>
                {debts.map((item) => (
                  <div key={item.id} className="row item">
                    <span>{item.name}</span>
                    <span>{item.phone}</span>
                    <span>{item.total.toLocaleString()}</span>
                    <span>{item.created_at}</span>
                    <span><button className="tiny" onClick={() => handlePayDebt(item.id)}>To'ladi</button></span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Hisobot' && (
          <div className="panel admin-panel">
            <div className="panel-card grid-tiles">
              <div className="tile"><span>Bugungi savdolar</span><strong>{stats ? stats.todaySales.count : 0}</strong></div>
              <div className="tile"><span>Umumiy daromad</span><strong>{stats ? stats.todaySales.sum?.toLocaleString() || 0 : 0} so'm</strong></div>
              <div className="tile"><span>Umumiy qarz</span><strong>{stats ? stats.totalDebt.toLocaleString() : 0} so'm</strong></div>
              <div className="tile"><span>Mijozlar</span><strong>{stats ? stats.customers : 0}</strong></div>
              <div className="tile"><span>Kam qolgan tovarlar</span><strong>{stats ? stats.lowStock : 0}</strong></div>
            </div>
            <div className="panel-card">
              <h2>Excel Export</h2>
              <div className="report-buttons">
                <button onClick={() => exportExcel('payments')}>To'lovlar hisobot</button>
                <button onClick={() => exportExcel('products')}>Tovarlar hisobot</button>
                <button onClick={() => exportExcel('debtors')}>Qarzdorlar ro'yxati</button>
              </div>
            </div>
            <div className="panel-card">
              <h2>Oxirgi savdolar</h2>
              <div className="table">
                <div className="row header"><span>ID</span><span>Xaridor</span><span>Summa</span><span>Usul</span><span>Sana</span></div>
                {reports.recentSales.map((sale) => (
                  <div key={sale.id} className="row item">
                    <span>{sale.id}</span>
                    <span>{sale.customer}</span>
                    <span>{sale.total.toLocaleString()}</span>
                    <span>{sale.method}</span>
                    <span>{sale.created_at}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {analytics && (
        <div className="modal">
          <div className="modal-card">
            <h2>Mahsulot analitikasi</h2>
            <div className="analytics-row"><strong>{analytics.emoji} {analytics.name} ({analytics.code})</strong></div>
            <div className="analytics-row">Narx: {analytics.price.toLocaleString()} so'm</div>
            <div className="analytics-row">Qoldiq: {analytics.remaining}</div>
            <div className="analytics-row">Sotilgan: {analytics.sold}</div>
            <div className="analytics-row">Daromad: {analytics.revenue.toLocaleString()} so'm</div>
            <div className="analytics-row">Tavsiya: {analytics.remaining < 20 ? 'Kam qoldi — buyurtma bering' : 'Ombor holati yaxshi'}</div>
            <button onClick={() => setAnalytics(null)}>Yopish</button>
          </div>
        </div>
      )}

      {receipt && (
        <div className="receipt-print">
          <div className="receipt-card">
            <h2>CHEK</h2>
            <div>Sana: {receipt.date}</div>
            <div>Chek №{receipt.id}</div>
            <div>Xaridor: {receipt.customer.name}</div>
            <div>Telefon: {receipt.customer.phone}</div>
            <table>
              <thead><tr><th>Nom</th><th>Kod</th><th>Narx</th><th>Miqdor</th><th>Jami</th></tr></thead>
              <tbody>
                {receipt.items.map((item) => (
                  <tr key={item.code}><td>{item.name}</td><td>{item.code}</td><td>{item.price.toLocaleString()}</td><td>{item.qty}</td><td>{(item.price * item.qty).toLocaleString()}</td></tr>
                ))}
              </tbody>
            </table>
            <div className="receipt-total">Umumiy: {receipt.total.toLocaleString()} so'm</div>
            <div>To'lov usuli: {receipt.method}</div>
            <div className="receipt-signature"><div>__________________</div><div>Xaridor imzosi</div></div>
            <div className="receipt-signature"><div>__________________</div><div>Admin imzosi</div></div>
          </div>
        </div>
      )}
    </div>
  )
}
