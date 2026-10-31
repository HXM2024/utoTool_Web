/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

// Electron API 类型声明
interface Window {
  electronAPI?: {
    // 文件选择对话框
    selectFile: (options?: { 
      title?: string; 
      filters?: Array<{ name: string; extensions: string[] }> 
    }) => Promise<string | null>
    
    // 文件夹选择对话框
    selectFolder: (options?: { title?: string }) => Promise<string | null>
    
    // 保存文件对话框
    saveDialog: (options?: { 
      title?: string; 
      defaultPath?: string;
      filters?: Array<{ name: string; extensions: string[] }>
    }) => Promise<string | null>
    
    // 打开路径
    openPath: (path?: string) => Promise<void>
    
    // 帮助菜单 → 问题反馈（返回取消监听的函数）
    onOpenFeedback: (callback: () => void) => () => void
    
    // 获取应用版本
    getVersion: () => Promise<string>
    
    // 检查更新
    checkForUpdates: () => Promise<void>
    
    // 退出应用
    quitApp: () => void
    
    // 最小化窗口
    minimizeWindow: () => void
    
    // 最大化/恢复窗口
    toggleMaximize: () => void
    
    // 关闭窗口
    closeWindow: () => void
  }
}
