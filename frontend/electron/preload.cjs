const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  selectFile: (options) => ipcRenderer.invoke('select-file', options),
  selectFolder: (options) => ipcRenderer.invoke('select-folder', options),
  saveDialog: (options) => ipcRenderer.invoke('save-dialog', options),
  openPath: (path) => ipcRenderer.invoke('open-path', path),
  zoomIn: () => ipcRenderer.send('zoom', 'in'),
  zoomOut: () => ipcRenderer.send('zoom', 'out'),
  zoomReset: () => ipcRenderer.send('zoom', 'reset'),
})