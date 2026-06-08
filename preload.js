const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  getProducts: () => ipcRenderer.invoke('db/get-products'),
  getFolders: () => ipcRenderer.invoke('db/get-folders'),
  getCustomers: () => ipcRenderer.invoke('db/get-customers'),
  getDebts: () => ipcRenderer.invoke('db/get-debts'),
  getReports: () => ipcRenderer.invoke('db/get-reports'),
  getStats: () => ipcRenderer.invoke('db/get-stats'),
  getProductStats: (code) => ipcRenderer.invoke('db/get-product-stats', code),
  createFolder: (folder) => ipcRenderer.invoke('db/create-folder', folder),
  createProduct: (product) => ipcRenderer.invoke('db/create-product', product),
  updateProduct: (product) => ipcRenderer.invoke('db/update-product', product),
  deleteProduct: (code) => ipcRenderer.invoke('db/delete-product', code),
  deleteFolder: (id) => ipcRenderer.invoke('db/delete-folder', id),
  payDebt: (id) => ipcRenderer.invoke('db/pay-debt', id),
  createSale: (sale) => ipcRenderer.invoke('db/create-sale', sale),
  getCustomerHistory: (phone) => ipcRenderer.invoke('db/get-customer-history', phone)
})
