const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  selectFile: (options) => ipcRenderer.invoke('select-file', options),
  selectFolder: (options) => ipcRenderer.invoke('select-folder', options),
  saveDialog: (options) => ipcRenderer.invoke('save-dialog', options),
  openPath: (path) => ipcRenderer.invoke('open-path', path),
  // 帮助菜单 → 问题反馈：主进程通知渲染进程打开反馈弹窗
  onOpenFeedback: (callback) => {
    const handler = () => callback()
    ipcRenderer.on('open-feedback', handler)
    return () => ipcRenderer.removeListener('open-feedback', handler)
  },
  zoomIn: () => ipcRenderer.send('zoom', 'in'),
  zoomOut: () => ipcRenderer.send('zoom', 'out'),
  zoomReset: () => ipcRenderer.send('zoom', 'reset'),
})