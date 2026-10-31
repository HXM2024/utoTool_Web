import { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, nativeImage } from 'electron'
import { fileURLToPath } from 'url'
import { dirname, join, basename } from 'path'
import { spawn, exec, execSync } from 'child_process'
import { existsSync, writeFileSync, readdirSync, readFileSync, statSync, mkdirSync, createReadStream, createWriteStream, copyFileSync } from 'fs'
import http from 'http'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// ==================== 单实例锁 ====================
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  console.log('[Electron] 已有实例在运行，退出新实例')
  app.exit(0)
}

app.on('second-instance', (event, commandLine, workingDirectory) => {
  console.log('[Electron] 检测到二次启动请求，激活现有窗口')
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    if (!mainWindow.isVisible()) mainWindow.show()
    mainWindow.focus()
  }
})

// ==================== 全局异常捕获（忽略 EPIPE） ====================
process.on('uncaughtException', (err) => {
  if (err && err.code === 'EPIPE') {
    console.error('[Electron] EPIPE 错误已忽略（后端 pipe 已断开）:', err.message)
    return
  }
  console.error('[Electron] 未捕获的异常:', err)
})

let mainWindow
let splashWindow
let updateProgressWindow
let backendProcess
let tray
let isQuitting = false
let backendErrorLogs = []
let backendErrorReason = ''
let backendPort = null  // 后端实际端口（从 stdout BACKEND_PORT=xxx 解析）
let backendImageName = ''  // 后端进程的镜像名（用于按端口清理残留进程）
let updateAvailable = false  // 是否存在可用更新（决定「帮助」与「检查更新」菜单项是否显示蓝色圆点）
let startupUpdateChecked = false  // 启动时的首次更新检测是否已执行（只提示一次）

// 自更新检测间隔：软件打开后半小时检测一次
const UPDATE_CHECK_INTERVAL = 30 * 60 * 1000

// 后端默认端口（与 backend/config.py 的 BACKEND_PORT 保持一致）
const DEFAULT_BACKEND_PORT = 18735

// 比较镜像名时忽略 .exe 后缀（dev 模式 spawn 的是 python，tasklist 显示 python.exe）
function sameImageName(a, b) {
  const stem = (s) => String(s || '').toLowerCase().replace(/\.exe$/, '')
  return stem(a) !== '' && stem(a) === stem(b)
}

// 按端口清理「本程序后端」的残留进程。
// PyInstaller onefile 的 bootloader 退出后，真正的 Python 子进程会被系统改挂父进程，
// 此时 backendProcess.pid 对应的进程树已经不存在，taskkill /T 找不到它，
// 只能按监听端口反查 PID，再按镜像名确认是自己人后结束。
// 只结束端口上的同名后端，避免误杀其它占用该端口的程序。
function killStaleBackendOnPort(port, expectedImageName) {
  if (process.platform !== 'win32' || !port || !expectedImageName) return
  try {
    const out = execSync('netstat -ano -p tcp', { windowsHide: true, encoding: 'utf8', timeout: 5000 })
    const pids = new Set()
    for (const line of out.split(/\r?\n/)) {
      const cols = line.trim().split(/\s+/)
      if (cols.length < 5) continue
      const [proto, localAddr, , state, pidText] = cols
      if (!/^TCP$/i.test(proto) || state !== 'LISTENING') continue
      if (!localAddr.endsWith(':' + port)) continue
      const pid = parseInt(pidText, 10)
      if (pid > 0 && pid !== process.pid) pids.add(pid)
    }
    for (const pid of pids) {
      let imageName = ''
      try {
        const tl = execSync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, {
          windowsHide: true, encoding: 'utf8', timeout: 5000,
        })
        imageName = (tl.split(',')[0] || '').replace(/"/g, '').trim()
      } catch (e) {
        continue
      }
      if (!sameImageName(imageName, expectedImageName)) continue
      try {
        execSync(`taskkill /T /F /PID ${pid}`, { windowsHide: true, timeout: 5000 })
        console.log(`[Backend] 已清理端口 ${port} 上的残留后端: pid=${pid} (${imageName})`)
      } catch (e) {
        console.error(`[Backend] 清理残留后端失败 pid=${pid}:`, e.message)
      }
    }
  } catch (e) {
    // netstat/tasklist 不可用或超时：忽略，不影响主流程
  }
}

// 彻底终止后端进程树：PyInstaller onefile 会产生 bootloader + Python 子进程，
// 仅 kill() bootloader 会导致 Python 子进程成为孤儿后台残留。
// Windows 下使用 taskkill /T /F 强制结束整个进程树。
function killBackendProcessTree() {
  // 先按端口兜底：onefile 的 Python 子进程可能已脱离 backendProcess 的进程树，
  // 只按 pid 树杀会漏掉它，这里再按监听端口清理一次。
  killStaleBackendOnPort(backendPort || DEFAULT_BACKEND_PORT, backendImageName)
  if (!backendProcess || backendProcess.killed) return
  try {
    // 先优雅关闭（POSIX 风格，Windows 上等效 SIGKILL 但对子进程无树状效果）
    backendProcess.kill()
    // Windows 上兜底：通过 taskkill 终止整个进程树，确保 onefile 的 bootloader+Python 子进程全清理
    if (process.platform === 'win32' && backendProcess.pid) {
      exec(`taskkill /T /F /PID ${backendProcess.pid}`, { windowsHide: true }, () => {
        // 忽略执行失败（进程可能已不存在）
      })
    }
    // 注意：这里不能按镜像名杀（taskkill /IM "#Excel2Case#V1.0.00.exe"）。
    // 后端 exe 与 Electron 主进程同名，按名杀会连自己一起杀掉，
    // 导致 quit 流程半途中断、进程残留（安装器会一直判定「程序未关闭」）。
    // 因此先按 pid 做树杀，函数开头再按监听端口清理一次（排除自身 pid）。
  } catch (e) {
    console.error('[Backend] killBackendProcessTree 失败:', e.message)
  }
}

// 开发同步模式：由 run.py 统一启动 Flask + Vite，Electron 仅作为壳子
const isDev = process.env.AUTOTOOL_DEV_MODE === 'true'

// 生成默认托盘图标（16x16 蓝色方块）
function ensureTrayIcon() {
  const iconPath = join(__dirname, 'tray-icon.png')
  if (!existsSync(iconPath)) {
    try {
      // 16x16 蓝色方块 PNG (base64)
      const base64 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAB9JREFUeNpi/P//PwMlgImBQjBqwKgBowaw4kC1WgEIMABzUAcE7K+GGQAAAABJRU5ErkJggg=='
      writeFileSync(iconPath, Buffer.from(base64, 'base64'))
    } catch (e) {
      console.error('[Tray] 生成图标失败:', e)
    }
  }
  return iconPath
}

function getAppIcon() {
  if (process.resourcesPath) {
    const iconInResources = join(process.resourcesPath, 'AT.ico')
    if (existsSync(iconInResources)) {
      return iconInResources
    }
  }
  const iconPath = join(__dirname, '..', '..', 'AT.ico')
  if (existsSync(iconPath)) {
    return iconPath
  }
  return null
}

function createTray() {
  let icon = nativeImage.createEmpty()
  
  const appIconPath = getAppIcon()
  if (appIconPath) {
    icon = nativeImage.createFromPath(appIconPath)
    if (icon.isEmpty()) {
      icon = nativeImage.createFromPath(ensureTrayIcon())
      icon = icon.resize({ width: 16, height: 16 })
    }
  } else {
    const iconPath = ensureTrayIcon()
    if (existsSync(iconPath)) {
      icon = nativeImage.createFromPath(iconPath)
      icon = icon.resize({ width: 16, height: 16 })
    }
  }

  tray = new Tray(icon)
  tray.setToolTip('#Excel2Case# V1.0.00')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示窗口',
      click: () => {
        if (mainWindow) {
          mainWindow.show()
          mainWindow.focus()
        } else {
          createWindow()
        }
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuitting = true
        killBackendProcessTree()
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.focus()
      } else {
        mainWindow.show()
      }
    } else {
      createWindow()
    }
  })
}

// ==================== 启动进度条 ====================
function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 480,
    height: 280,
    frame: false,
    resizable: false,
    transparent: false,
    alwaysOnTop: true,
    center: true,
    show: true,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    }
  })

  const splashPath = join(__dirname, 'splash.html')
  splashWindow.loadFile(splashPath)

  splashWindow.on('closed', () => {
    splashWindow = null
  })
}

function sendSplashProgress(percent, message) {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.send('splash-progress', { percent, message })
  }
}

// ==================== 后端健康检查 ====================
function checkBackendHealth(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/api/health`, (res) => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          resolve(json.code === 200)
        } catch {
          resolve(false)
        }
      })
    })
    req.on('error', () => resolve(false))
    req.setTimeout(2000, () => {
      req.destroy()
      resolve(false)
    })
  })
}

function startBackend() {
  // 开发同步模式：后端由 run.py 统一启动，Electron 不再重复启动
  if (isDev) {
    console.log('[Backend] Dev sync mode: backend managed by run.py, skipping start')
    return Promise.resolve()
  }

  const projectRoot = join(__dirname, '..', '..')

  // 优先尝试 packaged exe（多个候选位置 + 新旧文件名兼容）
  // onedir 模式: resources/#Excel2Case#V1.0.00/#Excel2Case#V1.0.00.exe
  // onefile 模式: resources/#Excel2Case#V1.0.00.exe
  // 源码模式: frontend/electron/resources/...
  const exeNames = ['#Excel2Case#V1.0.00.exe', 'autotool_backend.exe']
  const exeStems = ['#Excel2Case#V1.0.00', 'autotool_backend']
  const candidateExes = []
  for (let i = 0; i < exeNames.length; i++) {
    const name = exeNames[i]
    const stem = exeStems[i]
    if (process.resourcesPath) {
      // onedir 模式：exe 在子目录中
      candidateExes.push(join(process.resourcesPath, 'resources', stem, name))
      // onefile 模式：exe 直接在 resources 下
      candidateExes.push(join(process.resourcesPath, 'resources', name))
    }
    // 源码模式
    candidateExes.push(join(__dirname, 'resources', stem, name))
    candidateExes.push(join(__dirname, 'resources', name))
  }

  let packagedExe = null
  for (const p of candidateExes) {
    if (existsSync(p)) {
      packagedExe = p
      break
    }
  }

  // dev 模式：使用 python -m backend.app
  // 打包模式：直接运行 exe
  let cmd, args, cwd, env
  if (packagedExe) {
    console.log('[Backend] Using packaged exe:', packagedExe)
    cmd = packagedExe
    args = []
    cwd = process.cwd()
    env = { ...process.env, PYTHONUTF8: '1' }
  } else {
    console.log('[Backend] Using dev mode (python -m backend.app)')
    const pythonPath = process.env.PYTHON || 'python'
    cmd = pythonPath
    args = ['-m', 'backend.app']
    cwd = projectRoot
    env = { ...process.env, PYTHONPATH: projectRoot, PYTHONUTF8: '1' }
  }

  // 记录后端镜像名，并清理上一次运行遗留的后端（onefile 子进程可能已脱离进程树且仍占用端口）
  backendImageName = basename(cmd)
  killStaleBackendOnPort(DEFAULT_BACKEND_PORT, backendImageName)

  return new Promise((resolve, reject) => {
    sendSplashProgress(20, '正在启动后端服务...')
    backendProcess = spawn(cmd, args, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env,
    })

    let settled = false
    const backendLogs = []

    let progress = 30
    const progressTimer = setInterval(() => {
      progress = Math.min(progress + 5, 85)
      const msgs = [
        '正在加载后端模块...',
        '正在初始化 Flask 服务...',
        '正在注册 API 路由...',
        '正在等待后端就绪...',
      ]
      const msgIdx = Math.floor((progress - 30) / 15)
      sendSplashProgress(progress, msgs[Math.min(msgIdx, msgs.length - 1)])
    }, 2000)

    const onStdout = (data) => {
      const text = data.toString().trim()
      try {
        console.log('[Backend]', text)
      } catch (e) {
        // 忽略 EPIPE
      }
      backendLogs.push(text)
      // 解析后端端口（BACKEND_PORT=xxxxx）
      const portMatch = text.match(/^BACKEND_PORT=(\d+)$/)
      if (portMatch) {
        backendPort = parseInt(portMatch[1], 10)
        console.log('[Backend] Parsed port:', backendPort)
      }
      // 就绪检测：匹配 Flask 启动消息（端口无关）或 CTRL+C 提示
      if (text.includes('Running on http://127.0.0.1:') ||
          text.includes('Press CTRL+C to quit')) {
        if (settled) return
        settled = true
        clearInterval(progressTimer)
        sendSplashProgress(100, '启动完成')
        resolve()
      }
    }

    const onStderr = (data) => {
      const text = data.toString().trim()
      try {
        console.error('[Backend Error]', text)
      } catch (e) {
        // 忽略 EPIPE
      }
      backendLogs.push(`[ERROR] ${text}`)
    }

    backendProcess.stdout.on('data', onStdout)
    backendProcess.stderr.on('data', onStderr)

    backendProcess.on('error', (err) => {
      backendProcess.stdout.removeListener('data', onStdout)
      backendProcess.stderr.removeListener('data', onStderr)
      console.error('[Backend] Start failed:', err)
      if (settled) return
      settled = true
      clearInterval(progressTimer)
      backendErrorLogs = backendLogs.slice()
      backendErrorReason = `后端进程启动失败: ${err.message}`
      reject(err)
    })

    backendProcess.on('close', (code) => {
      backendProcess.stdout.removeListener('data', onStdout)
      backendProcess.stderr.removeListener('data', onStderr)
      console.log(`[Backend] Process exited, code: ${code}`)
      // 后端进程退出：如果尚未成功启动，立即 reject（不等超时）
      if (!settled) {
        settled = true
        clearInterval(progressTimer)
        backendErrorLogs = backendLogs.slice()
        // 检查是否端口冲突
        const allLogs = backendLogs.join(' ')
        if (allLogs.includes('Address already in use') || allLogs.includes('已占用') ||
            allLogs.includes('无法找到可用端口')) {
          backendErrorReason = `后端端口被占用，无法启动服务 (code=${code})。请关闭占用端口的程序（如 Simcenter Testlab）后重试`
        } else if (code !== 0) {
          backendErrorReason = `后端进程异常退出 (code=${code})，可能被杀毒软件拦截或缺少依赖库`
        } else {
          backendErrorReason = '后端进程已退出'
        }
        reject(new Error(backendErrorReason))
      }
    })

    // 健康检查轮询：stdout 关键字匹配的兜底机制
    // 某些情况下 stdout 数据分块或编码问题导致关键字未命中，
    // 通过 /api/health 轮询确保可靠检测后端就绪状态
    setTimeout(async () => {
      while (!settled) {
        const port = backendPort || 18735
        const healthy = await checkBackendHealth(port)
        if (healthy && !settled) {
          settled = true
          clearInterval(progressTimer)
          console.log('[Backend] Health check passed, backend is ready')
          sendSplashProgress(100, '启动完成')
          resolve()
          return
        }
        await new Promise(r => setTimeout(r, 1000))
      }
    }, 3000)

    // 超时兜底：120 秒后仍未就绪则判定为失败
    // 120 秒覆盖 PyInstaller onefile 在慢电脑上的解压时间 + 杀毒扫描时间
    setTimeout(() => {
      if (settled) return
      settled = true
      clearInterval(progressTimer)
      backendErrorLogs = backendLogs.slice()
      backendErrorReason = '后端启动超时（120 秒内未就绪），可能被杀毒软件拦截或缺少依赖库'
      console.error('[Backend] Startup timeout (120s), rejecting')
      reject(new Error(backendErrorReason))
    }, 120000)
  })
}

function showBackendErrorPage(extraInfo) {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close()
    splashWindow = null
  }
  if (!mainWindow || mainWindow.isDestroyed()) return

  const logsHtml = (backendErrorLogs.length > 0
    ? backendErrorLogs.slice(-50).map(l => l.replace(/</g, '&lt;').replace(/>/g, '&gt;')).join('<br>')
    : '(无后端输出日志)')
  const reason = backendErrorReason || extraInfo || '未知原因'

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>#Excel2Case# V1.0.00 - 启动失败</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Microsoft YaHei', 'Segoe UI', sans-serif; background: #f5f5f5; color: #333; padding: 40px 20px; }
  .container { max-width: 900px; margin: 0 auto; }
  .header { text-align: center; margin-bottom: 30px; }
  .header h1 { color: #d32f2f; font-size: 24px; margin-bottom: 8px; }
  .header p { color: #666; font-size: 14px; }
  .reason { background: #fff3e0; border-left: 4px solid #ff9800; padding: 16px; margin-bottom: 20px; border-radius: 4px; }
  .reason strong { color: #e65100; }
  .suggestions { background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
  .suggestions h2 { font-size: 16px; color: #1976d2; margin-bottom: 12px; }
  .suggestions ul { list-style: none; }
  .suggestions li { padding: 8px 0 8px 24px; position: relative; font-size: 14px; line-height: 1.6; }
  .suggestions li:before { content: '!'; position: absolute; left: 0; color: #ff9800; font-weight: bold; }
  .logs { background: #1e1e1e; color: #d4d4d4; border-radius: 8px; padding: 16px; margin-bottom: 20px; }
  .logs h2 { color: #fff; font-size: 14px; margin-bottom: 12px; }
  .logs pre { font-family: 'Consolas', 'Courier New', monospace; font-size: 12px; line-height: 1.5; white-space: pre-wrap; word-break: break-all; max-height: 300px; overflow-y: auto; }
  .actions { text-align: center; }
  .btn { display: inline-block; padding: 10px 24px; margin: 0 8px; border-radius: 4px; cursor: pointer; border: none; font-size: 14px; }
  .btn-retry { background: #1976d2; color: #fff; }
  .btn-retry:hover { background: #1565c0; }
  .btn-copy { background: #e0e0e0; color: #333; }
  .btn-copy:hover { background: #bdbdbd; }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>后端服务启动失败</h1>
    <p>#Excel2Case# V1.0.00</p>
  </div>
  <div class="reason">
    <strong>失败原因：</strong> ${reason.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
  </div>
  <div class="suggestions">
    <h2>排查建议</h2>
    <ul>
      <li>检查杀毒软件是否拦截了 #Excel2Case#V1.0.00.exe，将其加入白名单后重试</li>
      <li>检查端口 ${backendPort || 18735} 是否被其他程序占用（任务管理器 → 性能 → 资源监视器 → 端口）</li>
      <li>右键以管理员身份运行 #Excel2Case#V1.0.00.exe</li>
      <li>确认 Windows 系统已安装 Visual C++ Redistributable 2015-2022 运行库</li>
      <li>临时关闭杀毒软件/防火墙后重新启动</li>
      <li>如问题持续，请将下方日志反馈给开发人员</li>
    </ul>
  </div>
  <div class="logs">
    <h2>后端启动日志</h2>
    <pre>${logsHtml}</pre>
  </div>
  <div class="actions">
    <button class="btn btn-retry" onclick="window.location.href='http://127.0.0.1:${backendPort || 18735}'">重试连接后端</button>
    <button class="btn btn-copy" onclick="navigator.clipboard.writeText(document.querySelector('pre').textContent)">复制日志</button>
  </div>
  <p style="text-align:center;margin-top:16px;color:#999;font-size:12px">如问题持续，请关闭应用并重新打开，或将日志反馈给开发人员</p>
</div>
</body>
</html>`

  mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
}

// ==================== 检查更新 ====================
const UPDATE_PATH = '\\\\172.28.4.125\\装机工作软件\\工具软件\\Excel2Case'

function parseVersion(str) {
  const m = str.match(/(\d+)\.(\d+)\.(\d+)/)
  if (!m) return null
  return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)]
}

function compareVersion(a, b) {
  if (!a && !b) return 0
  if (!a) return -1
  if (!b) return 1
  for (let i = 0; i < 3; i++) {
    if (a[i] > b[i]) return 1
    if (a[i] < b[i]) return -1
  }
  return 0
}

function readUpdateInfo(filePath) {
  try {
    const info = JSON.parse(readFileSync(filePath, 'utf-8'))
    if (info && typeof info.version === 'string') {
      return {
        version: parseVersion(info.version),
        versionStr: info.version,
        releaseNotes: typeof info.release_notes === 'string' ? info.release_notes : '',
        setupName: typeof info.setup_name === 'string' ? info.setup_name : ''
      }
    }
  } catch (err) {
    console.error('[Update] 解析更新信息失败:', filePath, err.message)
  }
  return null
}

// 「帮助」与「检查更新」菜单项的蓝色圆点图标（16x16 蓝色实心圆）
const BLUE_DOT_ICON = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAVUlEQVR42mOQLLvEQAlmoKUBPkBcCcU+pBgAUnwTiP+j4ZvYDMKm+T8B7IPPgJtEGHATlwHE2I7hCmQDKkkwoJImBlDsBYoDkSrRSHFCokpSpm9uBACiU8AQPWbxBgAAAABJRU5ErkJggg=='

// 扫描更新目录，返回版本号最高的更新信息；目录不可访问或未找到时返回 null
function findNewestUpdate() {
  if (!existsSync(UPDATE_PATH)) return null

  let entries
  try {
    entries = readdirSync(UPDATE_PATH, { withFileTypes: true })
  } catch (err) {
    console.error('[Update] 读取更新目录失败:', err.message)
    return null
  }

  let newest = null
  for (const entry of entries) {
    if (!entry.isFile()) continue
    if (!entry.name.toLowerCase().endsWith('.json')) continue
    const info = readUpdateInfo(join(UPDATE_PATH, entry.name))
    if (!info) continue
    if (!newest || compareVersion(info.version, newest.version) > 0) {
      newest = info
    }
  }
  return newest
}

// 后台静默检测：不弹窗，仅刷新「帮助」与「检查更新」菜单项的蓝色圆点提示；
// prompt 为 true 时（启动首次检测）发现新版本会额外弹出更新提示
async function checkForUpdatesSilently(prompt = false) {
  const newest = findNewestUpdate()
  if (!newest) {
    console.log('[Update] 后台检测：更新目录不可访问或未找到更新信息')
    return
  }
  const currentVersion = parseVersion(app.getVersion())
  const isNewer = compareVersion(newest.version, currentVersion) > 0
  console.log(`[Update] 后台检测：当前 ${currentVersion ? currentVersion.join('.') : '未知'}，最新 ${newest.versionStr}，${isNewer ? '发现新版本' : '已是最新'}`)
  setUpdateAvailable(isNewer)
  if (isNewer && prompt) {
    await promptUpdateAvailable(newest, currentVersion ? currentVersion.join('.') : '未知')
  }
}

// 更新蓝色圆点提示状态，并按需重建应用菜单
function setUpdateAvailable(available) {
  if (updateAvailable === available) return
  updateAvailable = available
  console.log('[Update] 菜单蓝点提示:', available ? '显示（帮助 / 检查更新）' : '隐藏')
  buildAppMenu()
}

// ==================== 自更新后台逻辑 ====================
function createUpdateProgressWindow() {
  if (updateProgressWindow && !updateProgressWindow.isDestroyed()) return
  updateProgressWindow = new BrowserWindow({
    width: 480,
    height: 220,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    center: true,
    show: true,
    skipTaskbar: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>正在更新</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Microsoft YaHei', 'Segoe UI', sans-serif; background: #ffffff; padding: 32px 36px; }
  h2 { font-size: 16px; color: #333; margin-bottom: 24px; text-align: center; }
  .bar { width: 100%; height: 12px; background: #e0e0e0; border-radius: 6px; overflow: hidden; }
  .bar-inner { height: 100%; width: 0%; background: #1976d2; border-radius: 6px; transition: width 0.2s ease; }
  .percent { text-align: center; margin-top: 12px; color: #666; font-size: 14px; }
</style>
</head>
<body>
  <h2>正在下载更新包...</h2>
  <div class="bar"><div class="bar-inner" id="bar"></div></div>
  <div class="percent" id="percent">0%</div>
</body>
</html>`

  updateProgressWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
  updateProgressWindow.on('closed', () => {
    updateProgressWindow = null
  })
}

function sendUpdateProgress(percent) {
  if (updateProgressWindow && !updateProgressWindow.isDestroyed()) {
    updateProgressWindow.webContents.executeJavaScript(`document.getElementById('bar').style.width = '${percent}%'; document.getElementById('percent').textContent = '${percent}%';`).catch(() => {})
  }
}

function downloadSetup(setupName, onProgress) {
  return new Promise((resolve, reject) => {
    const src = join(UPDATE_PATH, setupName)
    let total = 0
    try {
      total = statSync(src).size
    } catch (err) {
      reject(new Error(`无法读取更新包：${err.message}`))
      return
    }

    const destDir = join(app.getPath('temp'), '#Excel2Case#Update')
    if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true })
    const dest = join(destDir, setupName)

    const readStream = createReadStream(src)
    const writeStream = createWriteStream(dest)
    let downloaded = 0

    readStream.on('data', (chunk) => {
      downloaded += chunk.length
      if (onProgress && total > 0) {
        onProgress(Math.min(100, Math.round((downloaded / total) * 100)))
      }
    })
    readStream.on('error', (err) => {
      writeStream.destroy()
      reject(err)
    })
    writeStream.on('error', reject)
    writeStream.on('finish', () => resolve(dest))
    readStream.pipe(writeStream)
  })
}

// 复制目录（递归），用于备份用户配置数据到安装目录之外的安全位置
function copyDirRecursive(src, dst) {
  if (!existsSync(src)) return
  mkdirSync(dst, { recursive: true })
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const s = join(src, entry.name)
    const d = join(dst, entry.name)
    if (entry.isDirectory()) {
      copyDirRecursive(s, d)
    } else if (entry.isFile()) {
      copyFileSync(s, d)
    }
  }
}

// 备份后端可写数据目录（configs / uploads / outputs）到备份目录，
// 防止覆盖安装时安装目录内的数据被清空。
function backupUserData() {
  try {
    // 后端新数据目录：%APPDATA%\Excel2Case（正常情况下安装器不会删除）
    const dataDir = join(app.getPath('appData'), 'Excel2Case')
    if (!existsSync(dataDir)) {
      // 兼容旧版本：数据在 exe 同目录（安装目录内），升级时会丢失，需优先备份
      const legacyDir = join(dirname(app.getPath('exe')), 'configs')
      if (existsSync(legacyDir)) {
        const backupRoot = join(app.getPath('appData'), 'Excel2CaseBackup')
        const stamp = new Date().toISOString().replace(/[:.]/g, '-')
        const backupDir = join(backupRoot, `configs-${stamp}`)
        copyDirRecursive(legacyDir, backupDir)
        console.log('[Update] 已备份旧版 configs:', backupDir)
      }
      return
    }
    // 新版本数据已在 %APPDATA%，无需额外备份（安装器不删除该目录）
    console.log('[Update] 用户数据位于 %APPDATA%，安装器不会删除，无需备份')
  } catch (err) {
    console.error('[Update] 备份用户数据失败:', err.message)
  }
}

// 退出本程序后再启动安装器。
// 直接 shell.openPath 会让安装器与本程序同时存在：安装器按进程名检测
// 「程序正在运行」→ 提示用户关闭 → 用户关闭主窗口只是最小化到托盘
// （见 win.on('close')），进程仍在 → 安装器反复弹同一个窗口。
// 因此改为用一个临时 VBS：等待本进程退出后再启动安装包，本进程立即 app.quit() 让位。
//
// 为什么全用 VBS、不再用 cmd 批处理：
// 1) spawn('cmd.exe', ..., {detached:true}) 在 Windows 上会给子进程新建独立控制台窗口，
//    detached 优先于 windowsHide，隐藏不掉 → 更新时一直挂着黑窗；
// 2) 旧的 `tasklist | find` 轮询在现场出现过 find 挂住不返回，循环走不到次数上限，
//    黑窗关不掉、安装器也永远不启动。VBS 的 WMI 查询不依赖外部进程，且有明确次数上限。
function launchInstallerAfterExit(setupPath) {
  const exeName = process.platform === 'win32'
    ? '#Excel2Case#V1.0.00.exe'
    : basename(process.execPath)
  const dir = join(app.getPath('temp'), '#Excel2Case#Update')
  const vbsPath = join(dir, 'launch-installer.vbs')
  const logPath = join(dir, 'launch-installer.log')

  // VBS 字符串里的双引号用 "" 转义："""C:\path\x.exe""" → "C:\path\x.exe"
  // 流程：固定等 3 秒 → 最多 10 次（每次 0.5 秒，共 5 秒）确认同名进程已退出
  //       → 无论结果如何都启动安装器（最坏 8 秒内一定拉起）
  const vbs = [
    'On Error Resume Next',
    'Dim sh, fso, f, svc, col, i, n',
    'Set sh = CreateObject("WScript.Shell")',
    'Set fso = CreateObject("Scripting.FileSystemObject")',
    // 第 4 个参数 -1 = 以 Unicode 写日志，记事本打开中文不乱码
    `Set f = fso.OpenTextFile("${logPath}", 8, True, -1)`,
    'f.WriteLine Now & " 开始等待主程序退出"',
    'WScript.Sleep 3000',
    'Set svc = GetObject("winmgmts:\\\\.\\root\\cimv2")',
    'If Err.Number = 0 Then',
    '  For i = 1 To 10',
    `    Set col = svc.ExecQuery("SELECT ProcessId FROM Win32_Process WHERE Name='${exeName}'")`,
    '    If Err.Number <> 0 Then Exit For',
    '    n = 0',
    '    If Not col Is Nothing Then n = col.Count',
    '    If n = 0 Then Exit For',
    '    WScript.Sleep 500',
    '  Next',
    'End If',
    'Err.Clear',
    'f.WriteLine Now & " 启动安装程序"',
    'f.Close',
    `sh.Run """${setupPath}""", 1, False`,
    ''
  ].join('\r\n')

  try {
    mkdirSync(dir, { recursive: true })
    // 用带 BOM 的 UTF-16LE：wscript 能正确解析，且安装包路径含中文用户名时不会乱码
    writeFileSync(vbsPath, Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(vbs, 'utf16le')]))
    // detached：脱离本进程独立运行，本进程退出不会连带结束它
    // //B = 批处理模式：脚本出错时不弹模态错误框（避免隐藏进程卡在对话框上）
    const child = spawn('wscript.exe', ['//B', vbsPath], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    })
    child.unref()
    console.log('[Update] 已启动延时安装脚本:', vbsPath)
  } catch (err) {
    console.error('[Update] 写安装脚本失败:', err.message)
    // 兜底：退化为直接打开安装包，至少不让更新中断
    shell.openPath(setupPath)
  }

  // 让位给安装器：标记为真正退出（绕过 close 拦截），并清理后端进程树
  isQuitting = true
  killBackendProcessTree()
  setTimeout(() => app.quit(), 300)
}

async function startSelfUpdate(setupName) {
  const parent = mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined
  createUpdateProgressWindow()
  try {
    const dest = await downloadSetup(setupName, (percent) => sendUpdateProgress(percent))
    sendUpdateProgress(100)
    await new Promise((r) => setTimeout(r, 300))
    if (updateProgressWindow && !updateProgressWindow.isDestroyed()) {
      updateProgressWindow.close()
    }
    // 启动安装器前备份用户配置数据（双保险）
    backupUserData()
    await dialog.showMessageBox(parent, {
      type: 'info',
      title: '更新',
      message: '更新包下载完成',
      detail: '点击确定后将自动关闭本程序并启动安装程序，请按提示完成安装。'
    })
    launchInstallerAfterExit(dest)
  } catch (err) {
    if (updateProgressWindow && !updateProgressWindow.isDestroyed()) {
      updateProgressWindow.close()
    }
    await dialog.showMessageBox(parent, {
      type: 'error',
      title: '更新失败',
      message: '下载更新包失败',
      detail: `错误信息：${err.message}`
    })
  }
}

// 发现新版本时的提示弹窗（手动「检查更新」与启动时自动检测共用）
async function promptUpdateAvailable(newest, currentStr) {
  const parent = mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined
  const notes = newest.releaseNotes ? `\n\n更新说明：\n${newest.releaseNotes}` : ''
  const result = await dialog.showMessageBox(parent, {
    type: 'info',
    title: '检查更新',
    message: `发现新版本 ${newest.versionStr}`,
    detail: `当前版本：${currentStr}\n最新版本：${newest.versionStr}${notes}`,
    buttons: ['立即更新', '稍后再说'],
    defaultId: 0,
    cancelId: 1,
    noLink: true
  })
  if (result.response === 0) {
    if (newest.setupName) {
      await startSelfUpdate(newest.setupName)
    } else {
      shell.openPath(UPDATE_PATH)
    }
  }
}

async function checkForUpdates() {
  const parent = mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined

  if (!existsSync(UPDATE_PATH)) {
    await dialog.showMessageBox(parent, {
      type: 'warning',
      title: '检查更新',
      message: '无法访问更新服务器',
      detail: `更新路径不可访问：\n${UPDATE_PATH}\n\n请确认已连接公司内网，且对该共享目录具有访问权限。`
    })
    return
  }

  let entries
  try {
    entries = readdirSync(UPDATE_PATH, { withFileTypes: true })
  } catch (err) {
    await dialog.showMessageBox(parent, {
      type: 'error',
      title: '检查更新',
      message: '读取更新目录失败',
      detail: `错误信息：${err.message}`
    })
    return
  }

  const currentVersion = parseVersion(app.getVersion())
  let newest = null

  for (const entry of entries) {
    if (!entry.isFile()) continue
    if (!entry.name.toLowerCase().endsWith('.json')) continue
    const info = readUpdateInfo(join(UPDATE_PATH, entry.name))
    if (!info) continue
    if (!newest || compareVersion(info.version, newest.version) > 0) {
      newest = info
    }
  }

  if (!newest) {
    await dialog.showMessageBox(parent, {
      type: 'info',
      title: '检查更新',
      message: '未找到更新信息',
      detail: `更新目录中未发现有效的更新配置文件：\n${UPDATE_PATH}\n\n请稍后重试或联系管理员。`
    })
    return
  }

  const currentStr = currentVersion ? currentVersion.join('.') : '未知'
  const isNewer = compareVersion(newest.version, currentVersion) > 0
  setUpdateAvailable(isNewer)

  if (isNewer) {
    await promptUpdateAvailable(newest, currentStr)
  } else {
    await dialog.showMessageBox(parent, {
      type: 'info',
      title: '检查更新',
      message: '已是最新版本',
      detail: `当前版本：${currentStr}`
    })
  }
}

// 打开渲染进程里的「问题反馈」弹窗
function openFeedbackDialog() {
  const win = BrowserWindow.getFocusedWindow()
    || (mainWindow && !mainWindow.isDestroyed() ? mainWindow : null)
  if (!win || win.isDestroyed()) return
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
  win.webContents.send('open-feedback')
}

// 构建应用菜单（含缩放功能）；存在可用更新时「帮助」与「检查更新」两项都显示蓝色圆点
function buildAppMenu() {
  const blueDot = updateAvailable ? nativeImage.createFromDataURL(BLUE_DOT_ICON) : undefined

  const template = [
    {
      label: '文件',
      submenu: [
        { label: '新建窗口', accelerator: 'CmdOrCtrl+N', click: () => createWindow() },
        { type: 'separator' },
        { label: '退出', accelerator: 'CmdOrCtrl+Q', click: () => { isQuitting = true; killBackendProcessTree(); app.quit() } }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', role: 'undo', accelerator: 'CmdOrCtrl+Z' },
        { label: '重做', role: 'redo', accelerator: 'CmdOrCtrl+Shift+Z' },
        { type: 'separator' },
        { label: '剪切', role: 'cut', accelerator: 'CmdOrCtrl+X' },
        { label: '复制', role: 'copy', accelerator: 'CmdOrCtrl+C' },
        { label: '粘贴', role: 'paste', accelerator: 'CmdOrCtrl+V' },
        { label: '全选', role: 'selectAll', accelerator: 'CmdOrCtrl+A' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { label: '放大', accelerator: 'CmdOrCtrl+=', click: () => { mainWindow.webContents.zoomLevel = Math.min(mainWindow.webContents.zoomLevel + 0.2, 3) } },
        { label: '缩小', accelerator: 'CmdOrCtrl+-', click: () => { mainWindow.webContents.zoomLevel = Math.max(mainWindow.webContents.zoomLevel - 0.2, -3) } },
        { label: '重置缩放', accelerator: 'CmdOrCtrl+0', click: () => { mainWindow.webContents.zoomLevel = 0 } },
        { type: 'separator' },
        { label: '全屏', role: 'togglefullscreen', accelerator: 'F11' },
        { label: '开发者工具', role: 'toggleDevTools', accelerator: 'F12' }
      ]
    },
    {
      label: '帮助',
      icon: blueDot,
      submenu: [
        { label: '检查更新', icon: blueDot, click: () => checkForUpdates() },
        { label: '问题反馈', click: () => openFeedbackDialog() },
        { type: 'separator' },
        { label: '关于', click: () => { dialog.showMessageBox(mainWindow, { type: 'info', title: '关于', message: `#Excel2Case# V${app.getVersion()}`, detail: 'AutoTool 通信自动化测试工具' }) } }
      ]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function createWindow(backendReady = true) {
  const preloadPath = join(__dirname, 'preload.cjs')
  console.log('[Electron] Preload path:', preloadPath)
  console.log('[Electron] Preload exists:', existsSync(preloadPath))

  const windowOptions = {
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      contentSecurityPolicy: "default-src 'self' http://127.0.0.1 http://localhost:5173; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' http://127.0.0.1 http://localhost:5173 ws://localhost:5173"
    },
    title: '#Excel2Case#V1.0.00'
  }

  const iconPath = getAppIcon()
  if (iconPath) {
    windowOptions.icon = nativeImage.createFromPath(iconPath)
    console.log('[Electron] Window icon:', iconPath)
  }

  // 用局部变量持有「本窗口」：mainWindow 会被「新建窗口」覆盖成最新窗口，
  // 关闭回调若引用它就会隐藏错窗口（表现为原窗口点关闭没反应）。
  const win = new BrowserWindow(windowOptions)
  mainWindow = win

  // 设置中文应用菜单（含缩放功能），菜单构建见 buildAppMenu
  buildAppMenu()

  // 后端启动失败：直接显示错误诊断页，不尝试加载
  if (!backendReady && !isDev) {
    console.error('[Electron] Backend not ready, showing error page')
    showBackendErrorPage('')
    return
  }

  // 开发同步模式加载 Vite dev server，生产模式加载 Flask 后端（使用动态端口）
  const loadUrl = isDev ? 'http://localhost:5173' : `http://127.0.0.1:${backendPort || 18735}`
  console.log('[Electron] Loading URL:', loadUrl)

  let retryCount = 0
  const maxRetries = 5

  function loadPage() {
    win.loadURL(loadUrl)
  }

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('[Electron] Page load failed:', errorCode, errorDescription)
    if (retryCount < maxRetries) {
      retryCount++
      console.log(`[Electron] Retrying (${retryCount}/${maxRetries}) in 2s...`)
      sendSplashProgress(Math.min(90 + retryCount * 2, 99), `正在连接后端服务 (${retryCount}/${maxRetries})...`)
      setTimeout(loadPage, 2000)
    } else {
      console.error('[Electron] Max retries reached, showing error page')
      showBackendErrorPage(`页面加载失败 (code=${errorCode} ${errorDescription})`)
    }
  })

  loadPage()

  win.webContents.on('did-finish-load', () => {
    console.log('[Electron] Page loaded')
    // 注入 Ctrl+滚轮缩放：页面捕获 wheel 事件 → IPC 通知主进程调整 zoomLevel
    win.webContents.executeJavaScript(`
      if (!window.__zoomInjected) {
        window.__zoomInjected = true;
        document.addEventListener('wheel', function(e) {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (window.electronAPI) {
              if (e.deltaY < 0) window.electronAPI.zoomIn();
              else if (e.deltaY > 0) window.electronAPI.zoomOut();
            }
          }
        }, { passive: false });
        document.addEventListener('keydown', function(e) {
          if ((e.ctrlKey || e.metaKey) && window.electronAPI) {
            if (e.key === '0') { e.preventDefault(); window.electronAPI.zoomReset(); }
          }
        });
      }
    `).catch(() => {})
  })

  // 点击关闭按钮时最小化到托盘，而不是退出
  // 必须绑定「本窗口」实例（win），不能用全局 mainWindow：
  // 打开「新建窗口」后 mainWindow 已指向新窗口，用它隐藏的是新窗口，原窗口点关闭就没反应。
  // 例外：自更新时 isQuitting 已置 true，此时必须真正退出，否则安装器
  // 会一直检测到本进程仍在运行而反复弹「请先关闭程序」。
  win.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      win.hide()
      console.log('[Electron] Window hidden to tray')
    }
  })

  win.on('closed', () => {
    // 仅当关闭的正是当前 mainWindow 时才清空，避免关掉新窗口后丢失仍存在的窗口引用
    if (mainWindow === win) mainWindow = null
  })
}

ipcMain.handle('select-file', async (event, options) => {
  const { title = '选择文件', filters = [] } = options || {}
  
  const result = await dialog.showOpenDialog(mainWindow, {
    title,
    filters: filters.map(f => ({ name: f[0], extensions: f[1].split('.').filter(e => e) })),
    properties: ['openFile']
  })

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0]
  }
  return null
})

ipcMain.handle('select-folder', async (event, options) => {
  const { title = '选择文件夹' } = options || {}

  const result = await dialog.showOpenDialog(mainWindow, {
    title,
    properties: ['openDirectory']
  })

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0]
  }
  return null
})

ipcMain.handle('save-dialog', async (event, options) => {
  const { title = '保存文件', filters = [], defaultPath } = options || {}

  const result = await dialog.showSaveDialog(mainWindow, {
    title,
    defaultPath,
    filters: filters.map(f => ({ name: f[0], extensions: f[1].split('.').filter(e => e) })),
  })

  if (!result.canceled && result.filePath) {
    return result.filePath
  }
  return null
})

ipcMain.handle('open-path', async (event, path) => {
  if (path) {
    await shell.openPath(path)
  }
})

// Ctrl+滚轮缩放 IPC
ipcMain.on('zoom', (_event, action) => {
  const win = BrowserWindow.getFocusedWindow()
  if (!win) return
  if (action === 'in') {
    win.webContents.zoomLevel = Math.min(win.webContents.zoomLevel + 0.2, 3)
  } else if (action === 'out') {
    win.webContents.zoomLevel = Math.max(win.webContents.zoomLevel - 0.2, -3)
  } else if (action === 'reset') {
    win.webContents.zoomLevel = 0
  }
})

app.whenReady().then(async () => {
  app.setAppUserModelId('#Excel2Case#V1.0.00')

  // 显示启动进度条窗口
  createSplashWindow()
  sendSplashProgress(5, '正在初始化应用...')

  console.log('[Electron] Starting backend...')
  let backendReady = false
  try {
    await startBackend()
    backendReady = true
  } catch (err) {
    console.error('[Electron] Backend failed to start:', err.message)
    backendReady = false
  }

  console.log('[Electron] Backend ready:', backendReady, 'creating window...')

  createWindow(backendReady)
  createTray()

  // 自更新检测：启动时检测一次、之后每半小时轮询一次（均不阻塞窗口显示）；
  // 启动首次检测发现新版本会弹窗提示，轮询只更新「帮助 / 检查更新」的菜单圆点
  setInterval(() => checkForUpdatesSilently(), UPDATE_CHECK_INTERVAL)

  // 主窗口加载完成后关闭进度条
  mainWindow.webContents.on('did-finish-load', () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close()
      splashWindow = null
    }
    // 启动首次更新检测：等启动页关闭后再查（启动页是置顶的，先弹会被挡住），只执行一次
    if (!startupUpdateChecked) {
      startupUpdateChecked = true
      setTimeout(() => checkForUpdatesSilently(true), 1000)
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    } else if (mainWindow) {
      mainWindow.show()
    }
  })
})

app.on('window-all-closed', () => {
  // Windows/Linux 上关闭所有窗口也不退出，最小化到托盘
})

app.on('before-quit', () => {
  isQuitting = true
  killBackendProcessTree()
})

// will-quit：before-quit 之后、退出前最后一道兜底防线
// 再次调用 taskkill /T /F 清理后端进程树，防止 before-quit 中异步 taskkill 未执行完成
app.on('will-quit', (event) => {
  killBackendProcessTree()
  // 同步等待 200ms 让 taskkill 有机会执行（will-quit 允许短暂同步阻塞）
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 200)
})
