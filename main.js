const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const isDev = process.env.NODE_ENV === 'development' || !!process.env.VITE_DEV_SERVER_URL

require('./db')

function createWindow () {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1100,
    minHeight: 720,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'
  if (isDev) {
    win.loadURL(devUrl)
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(path.join(__dirname, 'dist', 'index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})

const db = require('./db')
const handlers = {
  'db/get-products': () => db.getProducts(),
  'db/get-folders': () => db.getFolders(),
  'db/get-customers': () => db.getCustomers(),
  'db/get-debts': () => db.getDebts(),
  'db/get-reports': () => db.getReports(),
  'db/get-stats': () => db.getStats(),
  'db/get-product-stats': (event, code) => db.getProductStats(code),
  'db/create-folder': (event, folder) => db.createFolder(folder),
  'db/create-product': (event, product) => db.createProduct(product),
  'db/update-product': (event, product) => db.updateProduct(product),
  'db/delete-product': (event, code) => db.deleteProduct(code),
  'db/delete-folder': (event, id) => db.deleteFolder(id),
  'db/pay-debt': (event, id) => db.payDebt(id),
  'db/create-sale': (event, sale) => db.createSale(sale),
  'db/get-customer-history': (event, phone) => db.getCustomerHistory(phone)
}

for (const [channel, handler] of Object.entries(handlers)) {
  ipcMain.handle(channel, handler)
}

