const { app, BrowserWindow, Menu, shell, ipcMain, Tray, nativeImage } = require('electron');
const path = require('path');
const log = require('electron-log');
const UpdateService = require('./src/services/update-service');
const AnnouncementService = require('./src/services/announcement-service');
const Store = require('electron-store');

// 初始化配置存储
const store = new Store();

// 存储待处理的深度链接
let pendingDeepLink = null;

// 注册自定义协议 zsmessage://
if (process.defaultApp) {
  // 开发模式
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('zsmessage', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  // 生产模式
  app.setAsDefaultProtocolClient('zsmessage');
}

// 设置应用名称（用于Windows通知）
app.setAppUserModelId('智穗语聊');

/**
 * Windows 注册表自启动管理
 */
const WinRegistry = {
  REG_RUN_PATH: 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run',
  APP_NAME: 'ZSMessage',
  
  /**
   * 检查是否已设置自启动
   */
  async isEnabled() {
    if (process.platform !== 'win32') return false;
    
    return new Promise((resolve) => {
      const { exec } = require('child_process');
      const cmd = `reg query "${this.REG_RUN_PATH}" /v "${this.APP_NAME}"`;
      
      exec(cmd, { encoding: 'buffer' }, (error, stdout) => {
        if (error) {
          resolve(false);
          return;
        }
        
        try {
          // 解码为 GBK（Windows 中文系统）
          const iconv = require('iconv-lite');
          const output = iconv.decode(stdout, 'cp936');
          const exePath = app.getPath('exe');
          resolve(output.includes(exePath));
        } catch (e) {
          resolve(false);
        }
      });
    });
  },
  
  /**
   * 启用自启动
   */
  async enable() {
    if (process.platform !== 'win32') {
      throw new Error('自启动功能仅支持 Windows 系统');
    }
    
    return new Promise((resolve, reject) => {
      const { exec } = require('child_process');
      const exePath = app.getPath('exe');
      const cmd = `reg add "${this.REG_RUN_PATH}" /v "${this.APP_NAME}" /t REG_SZ /d "${exePath}" /f`;
      
      exec(cmd, (error) => {
        if (error) {
          console.error('[AutoLaunch] 启用失败:', error);
          reject(error);
        } else {
          console.log('[AutoLaunch] 已启用开机自启动');
          resolve();
        }
      });
    });
  },
  
  /**
   * 禁用自启动
   */
  async disable() {
    if (process.platform !== 'win32') {
      throw new Error('自启动功能仅支持 Windows 系统');
    }
    
    return new Promise((resolve, reject) => {
      const { exec } = require('child_process');
      const cmd = `reg delete "${this.REG_RUN_PATH}" /v "${this.APP_NAME}" /f`;
      
      exec(cmd, (error) => {
        if (error) {
          // 如果项不存在，也认为成功
          console.log('[AutoLaunch] 已禁用开机自启动（或未设置）');
          resolve();
        } else {
          console.log('[AutoLaunch] 已禁用开机自启动');
          resolve();
        }
      });
    });
  }
};

// 配置electron-log编码，解决Windows控制台乱码问题
if (process.platform === 'win32') {
  // Windows下使用console.log而不是electron-log的文件输出
  log.transports.file.level = false;
  log.transports.console.level = 'info';
  
  // 重写console.log以避免乱码
  const originalLog = console.log;
  console.log = function(...args) {
    originalLog.apply(console, args);
  };
}

let mainWindow;
let updateService;
let announcementService;
let settingsWindow = null;
let mediaViewerWindow = null;
let callWindow = null;
let chatHistoryWindow = null;
let browserWindow = null; // 内置浏览器窗口
let currentTheme = null;
let tray = null; // 系统托盘
let unreadCount = 0; // 未读消息数
let oauthServer = null; // OAuth本地验证服务器
let oauthUserData = null; // 当前登录用户数据
const OAUTH_PORT = 61830; // OAuth服务器端口

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 500,
    height: 650,
    minWidth: 500,
    minHeight: 650,
    maxWidth: 500,
    maxHeight: 650,
    resizable: false,
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      webSecurity: false  // 允许Geetest SDK跨协议请求
    },
    frame: false,  // 无边框，使用自定义标题栏
    backgroundColor: '#ffffff',
    show: false
  });

  mainWindow.loadFile('src/pages/login.html');

  // 窗口准备好后显示
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // 开发模式下打开DevTools
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  
  // 拦截关闭事件，最小化到托盘而不是关闭
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      
      // Windows 下显示通知
      if (process.platform === 'win32' && tray) {
        mainWindow.webContents.send('show-notification', {
          title: '智穗语聊',
          body: '应用已最小化到系统托盘'
        });
      }
    }
  });
}

app.whenReady().then(async () => {
  createWindow();
  createTray(); // 创建系统托盘
  
  // 初始化服务
  updateService = new UpdateService();
  announcementService = new AnnouncementService();
  
  // 处理待处理的深度链接
  if (pendingDeepLink) {
    handleDeepLink(pendingDeepLink);
    pendingDeepLink = null;
  }
  
  // 检查并应用开机自启动设置
  try {
    const autoLaunch = store.get('autoLaunch', false);
    const isEnabled = await WinRegistry.isEnabled();
    
    if (autoLaunch && !isEnabled) {
      await WinRegistry.enable();
      console.log('[AutoLaunch] 已启用开机自启动');
    } else if (!autoLaunch && isEnabled) {
      await WinRegistry.disable();
      console.log('[AutoLaunch] 已禁用开机自启动');
    }
    
    console.log('[AutoLaunch] 开机自启动状态:', await WinRegistry.isEnabled());
  } catch (error) {
    console.error('[AutoLaunch] 初始化失败:', error);
  }
  
  // 应用启动3秒后自动检查更新
  setTimeout(() => {
    updateService.checkForUpdatesCustom();
  }, 3000);
  
  // 登录成功后1秒检查公告（这里模拟登录后的场景）
  setTimeout(() => {
    announcementService.checkAndShowAnnouncement(mainWindow);
  }, 1000);
  
  // 创建菜单（添加检查更新选项）
  createMenu();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

/**
 * 创建应用菜单
 */
function createMenu() {
  const template = [
    {
      label: '帮助',
      submenu: [
        {
          label: '设置',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            mainWindow.loadFile('src/pages/settings-new.html');
          }
        },
        {
          label: '检查更新',
          click: () => {
            if (updateService) {
              updateService.checkForUpdatesCustom();
            }
          }
        },
        {
          label: '查看公告',
          click: () => {
            mainWindow.loadFile('src/pages/announcements.html');
          }
        },
        {
          label: '关于',
          click: () => {
            shell.openExternal('https://github.com/yourusername/ZSMessage');
          }
        }
      ]
    }
  ];
  
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

/**
 * 创建系统托盘
 */
function createTray() {
  // 创建托盘图标
  const iconPath = path.join(__dirname, 'icon.ico');
  const trayIcon = nativeImage.createFromPath(iconPath);
  
  tray = new Tray(trayIcon.resize({ width: 16, height: 16 }));
  tray.setToolTip('智穗语聊');
  
  // 更新托盘菜单
  updateTrayMenu();
  
  // 点击托盘图标显示窗口
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

/**
 * 更新托盘菜单
 */
function updateTrayMenu() {
  if (!tray) return;
  
  const unreadText = unreadCount > 0 ? ` (${unreadCount > 99 ? '99+' : unreadCount})` : '';
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: `智穗语聊${unreadText}`,
      enabled: false
    },
    { type: 'separator' },
    {
      label: '打开主窗口',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);
  
  tray.setContextMenu(contextMenu);
  
  // 更新托盘图标和提示
  if (unreadCount > 0) {
    tray.setToolTip(`智穗语聊 - ${unreadCount} 条未读消息`);
  } else {
    tray.setToolTip('智穗语聊');
  }
}

/**
 * IPC处理 - 获取版本信息
 */
ipcMain.handle('get-versions', () => {
  return {
    app: app.getVersion(),
    electron: process.versions.electron,
    node: process.versions.node,
    chrome: process.versions.chrome
  };
});

/**
 * IPC处理 - 获取开机自启动状态
 */
ipcMain.handle('get-auto-launch', async () => {
  try {
    const isEnabled = await WinRegistry.isEnabled();
    // 同步存储状态
    store.set('autoLaunch', isEnabled);
    return isEnabled;
  } catch (error) {
    console.error('[AutoLaunch] 获取状态失败:', error);
    return store.get('autoLaunch', false);
  }
});

/**
 * IPC处理 - 设置开机自启动
 */
ipcMain.handle('set-auto-launch', async (event, enabled) => {
  try {
    if (enabled) {
      await WinRegistry.enable();
      console.log('[AutoLaunch] 已启用开机自启动');
    } else {
      await WinRegistry.disable();
      console.log('[AutoLaunch] 已禁用开机自启动');
    }
    
    // 保存到配置
    store.set('autoLaunch', enabled);
    
    // 验证设置
    const isEnabled = await WinRegistry.isEnabled();
    if (isEnabled === enabled) {
      return { success: true };
    } else {
      return { success: false, error: '设置未生效' };
    }
  } catch (error) {
    console.error('[AutoLaunch] 设置失败:', error);
    return { success: false, error: error.message };
  }
});

// 新增的IPC处理器
ipcMain.handle('get-app-versions', async (event) => {
  return {
    app: app.getVersion(),
    electron: process.versions.electron,
    node: process.versions.node,
    chrome: process.versions.chrome,
    os: process.platform
  };
});

ipcMain.handle('clear-cache', async (event) => {
  if (mainWindow) {
    await mainWindow.webContents.session.clearCache();
    return true;
  }
  return false;
});



ipcMain.handle('download-update', async (event) => {
  // 触发更新下载
  if (updateService) {
    updateService.downloadUpdate();
  }
});

ipcMain.handle('run-security-scan', async (event) => {
  // 模拟安全扫描，实际应用中应实现具体的安全扫描逻辑
  return {
    threatsFound: 0,
    scanCompleted: true
  };
});

// 监听设置更改事件
ipcMain.on('settings-changed', (event, settings) => {
  console.log('Settings changed:', settings);
  // 这里可以添加处理设置更改的逻辑
  
  // 根据设置更新应用行为
  if (settings.autoLaunch !== undefined) {
    WinRegistry.setEnabled(settings.autoLaunch).catch(err => {
      console.error('设置自启动失败:', err);
    });
  }
});



// 更新WinRegistry对象，添加setEnabled方法
WinRegistry.setEnabled = async function(enabled) {
  if (process.platform !== 'win32') {
    throw new Error('自启动功能仅支持 Windows 系统');
  }
  
  if (enabled) {
    return await this.enable();
  } else {
    return await this.disable();
  }
};

/**
 * IPC处理 - 检查更新
 */
ipcMain.handle('check-for-updates', async () => {
  try {
    const axios = require('axios');
    const currentVersion = app.getVersion();
    
    const platformMap = {
      'win32': 'windows',
      'darwin': 'mac',
      'linux': 'linux'
    };
    const platform = platformMap[process.platform] || 'windows';
    
    const response = await axios.get('https://msg.v2.zhsdev.top/api/update/check', {
      params: {
        currentVersion: currentVersion,
        platform: platform
      }
    });
    
    return response.data;
  } catch (error) {
    throw new Error(error.message);
  }
});

/**
 * 打开设置窗口
 */
function createSettingsWindow() {
  // 如果设置窗口已存在，则聚焦
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 900,
    height: 600,
    resizable: false,
    frame: false,
    transparent: false,
    icon: path.join(__dirname, 'icon.ico'),
    parent: null,  // 移除父窗口关联，使设置窗口独立
    modal: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  settingsWindow.loadFile('src/pages/settings-new.html');

  // 窗口关闭时清理
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

/**
 * IPC处理 - 打开设置窗口
 */
ipcMain.on('open-settings-window', () => {
  createSettingsWindow();
});

/**
 * IPC处理 - 关闭设置窗口
 */
ipcMain.on('close-settings-window', () => {
  if (settingsWindow) {
    settingsWindow.close();
  }
});



/**
 * IPC处理 - 关闭窗口
 */
ipcMain.on('close-window', () => {
  if (mainWindow) {
    mainWindow.close();
  }
});

/**
 * IPC处理 - 恢复窗口（登录后）
 */
ipcMain.on('restore-window', () => {
  if (mainWindow) {
    // 直接修改窗口属性，不重建窗口
    mainWindow.setResizable(true);  // 先允许调整大小
    mainWindow.setMinimumSize(800, 600);  // 设置最小尺寸
    mainWindow.setMaximumSize(0, 0);  // 移除最大尺寸限制（0 表示无限制）
    mainWindow.setSize(1200, 800);  // 设置默认大小
    mainWindow.center();  // 居中显示
    
    console.log('[窗口] 已恢复为聊天窗口模式');
  }
});

/**
 * 创建媒体查看器窗口
 */
function createMediaViewerWindow(mediaData) {
  // 如果已存在，关闭旧窗口
  if (mediaViewerWindow) {
    mediaViewerWindow.close();
  }

  mediaViewerWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 600,
    minHeight: 400,
    autoHideMenuBar: true,
    backgroundColor: '#000000',
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // 传递媒体数据
  mediaViewerWindow.once('ready-to-show', () => {
    if (mediaViewerWindow && !mediaViewerWindow.isDestroyed()) {
      mediaViewerWindow.webContents.send('load-media', mediaData);
    }
  });

  mediaViewerWindow.loadFile('src/pages/media-viewer.html');

  // 窗口关闭时清理
  mediaViewerWindow.on('closed', () => {
    mediaViewerWindow = null;
  });
}

/**
 * IPC处理 - 打开媒体查看器
 */
ipcMain.on('open-media-viewer', (event, mediaData) => {
  createMediaViewerWindow(mediaData);
});

/**
 * IPC处理 - 关闭媒体查看器
 */
ipcMain.on('close-media-viewer', () => {
  if (mediaViewerWindow) {
    mediaViewerWindow.close();
  }
});

/**
 * 创建内置浏览器窗口
 */
function createBrowserWindow(url) {
  // 如果已存在，重复使用并加载新URL
  if (browserWindow && !browserWindow.isDestroyed()) {
    browserWindow.webContents.send('load-url', url);
    browserWindow.show();
    browserWindow.focus();
    return;
  }

  browserWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    autoHideMenuBar: true,
    backgroundColor: '#1f1f1f',
    icon: path.join(__dirname, 'icon.ico'),
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webviewTag: true // 启用 webview 标签
    }
  });

  // 加载浏览器界面
  browserWindow.loadFile('src/pages/browser.html');

  // 窗口准备好后发送初始URL
  browserWindow.once('ready-to-show', () => {
    if (browserWindow && !browserWindow.isDestroyed()) {
      browserWindow.webContents.send('load-url', url);
    }
  });

  // 窗口关闭时清理
  browserWindow.on('closed', () => {
    browserWindow = null;
  });
}

/**
 * IPC处理 - 打开内置浏览器
 */
ipcMain.on('open-builtin-browser', (event, url) => {
  createBrowserWindow(url);
});

/**
 * IPC处理 - 内置浏览器窗口控制
 */
ipcMain.on('browser-minimize', () => {
  if (browserWindow && !browserWindow.isDestroyed()) {
    browserWindow.minimize();
  }
});

ipcMain.on('browser-maximize', () => {
  if (browserWindow && !browserWindow.isDestroyed()) {
    if (browserWindow.isMaximized()) {
      browserWindow.unmaximize();
    } else {
      browserWindow.maximize();
    }
  }
});

ipcMain.on('browser-close', () => {
  if (browserWindow && !browserWindow.isDestroyed()) {
    browserWindow.close();
  }
});

ipcMain.handle('browser-is-maximized', () => {
  if (browserWindow && !browserWindow.isDestroyed()) {
    return browserWindow.isMaximized();
  }
  return false;
});

/**
 * IPC处理 - 在系统浏览器中打开
 */
ipcMain.on('open-in-system-browser', (event, url) => {
  shell.openExternal(url);
});

/**
 * IPC处理 - 另存为媒体文件
 */
ipcMain.handle('save-media-file', async (event, fileData) => {
  const { dialog } = require('electron');
  const fs = require('fs');
  
  try {
    const result = await dialog.showSaveDialog({
      defaultPath: fileData.filename,
      filters: [
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    
    if (!result.canceled && result.filePath) {
      // 下载文件
      const axios = require('axios');
      const response = await axios.get(fileData.url, { responseType: 'arraybuffer' });
      fs.writeFileSync(result.filePath, Buffer.from(response.data));
      return { success: true, path: result.filePath };
    }
    
    return { success: false, canceled: true };
  } catch (error) {
    console.error('[另存为] 错误:', error);
    return { success: false, error: error.message };
  }
});

/**
 * 创建通话窗口
 */
function createCallWindow(callData) {
  console.log('[Main] createCallWindow called with:', callData);
  
  // 如果已存在，先关闭旧的，再创建新的
  if (callWindow) {
    console.log('[Main] Call window already exists, closing old one...');
    try {
      callWindow.destroy(); // 强制关闭
    } catch (e) {
      console.error('[Main] Failed to destroy old call window:', e);
    }
    callWindow = null;
    
    // 等待一下让设备释放
    setTimeout(() => createCallWindowInternal(callData), 500);
    return;
  }
  
  createCallWindowInternal(callData);
}

function createCallWindowInternal(callData) {
  console.log('[Main] Creating new call window...');

  // 构建 URL 参数
  const params = new URLSearchParams({
    callId: callData.callId || '',
    callerId: callData.callerId || '',
    targetUserId: callData.targetUserId || '',
    callerName: callData.callerName || '用户',
    callType: callData.callType || 'video',
    isIncoming: callData.isIncoming ? 'true' : 'false'
  });
  
  console.log('[Main] URL params:', params.toString());

  callWindow = new BrowserWindow({
    width: 900,
    height: 650,
    minWidth: 600,
    minHeight: 500,
    autoHideMenuBar: true,
    backgroundColor: '#1a1a2e',
    icon: path.join(__dirname, 'icon.ico'),
    frame: true,
    titleBarStyle: 'hidden',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  const callUrl = `file://${path.join(__dirname, 'src/pages/call.html')}?${params}`;
  console.log('[Main] Loading call window URL:', callUrl);
  
  callWindow.loadURL(callUrl);
  
  // 开发模式打开调试工具
  if (process.argv.includes('--dev')) {
    callWindow.webContents.openDevTools();
  }

  // 窗口关闭时清理
  callWindow.on('closed', () => {
    console.log('[Main] Call window closed');
    callWindow = null;
  });

  console.log('[Main] Call window created successfully');
}

/**
 * IPC处理 - 发起通话
 */
ipcMain.on('start-call', (event, callData) => {
  console.log('[Main] Received start-call IPC:', callData);
  createCallWindow(callData);
});

/**
 * IPC处理 - 来电
 */
ipcMain.on('incoming-call', (event, callData) => {
  callData.isIncoming = true;
  createCallWindow(callData);
});

/**
 * IPC处理 - 关闭通话窗口
 */
ipcMain.on('close-call-window', () => {
  if (callWindow) {
    callWindow.close();
  }
});

/**
 * IPC处理 - 通话信令转发
 */
ipcMain.on('call-signaling', (event, data) => {
  // 转发到主窗口，由 WebSocket 服务发送
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('send-call-signal', data);
  }
});

/**
 * IPC处理 - 通话信令转发到通话窗口
 */
ipcMain.on('call-signal-to-window', (event, data) => {
  if (callWindow && !callWindow.isDestroyed()) {
    callWindow.webContents.send('call-signal', data);
  }
});

/**
 * IPC处理 - 发送通话记录消息
 */
ipcMain.on('send-call-record', (event, data) => {
  console.log('[Main] Received send-call-record:', data);
  // 转发到主窗口，由 chat.js 调用 API 发送消息
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('send-call-record-message', data);
  }
});

/**
 * IPC处理 - 通话消息已发送（乐观更新）
 */
ipcMain.on('call-message-sent', (event, data) => {
  console.log('[Main] Call message sent:', data);
  // 转发到主窗口，立即显示消息
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('call-message-optimistic-update', data);
  }
});

/**
 * IPC处理 - 刷新聊天列表
 */
ipcMain.on('refresh-chat', (event, data) => {
  console.log('[Main] Received refresh-chat:', data);
  // 转发到主窗口，通知刷新聊天列表
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('refresh-chat-messages', data);
  }
});

/**
 * 创建聊天记录窗口
 */
function createChatHistoryWindow(historyData) {
  // 如果已存在，关闭旧窗口
  if (chatHistoryWindow) {
    chatHistoryWindow.close();
  }

  chatHistoryWindow = new BrowserWindow({
    width: 600,
    height: 700,
    minWidth: 500,
    minHeight: 600,
    autoHideMenuBar: true,
    backgroundColor: '#ffffff',
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // 传递聊天记录数据
  chatHistoryWindow.once('ready-to-show', () => {
    if (chatHistoryWindow && !chatHistoryWindow.isDestroyed()) {
      chatHistoryWindow.webContents.send('load-chat-history', historyData);
    }
  });

  chatHistoryWindow.loadFile('src/pages/chat-history.html');

  // 窗口关闭时清理
  chatHistoryWindow.on('closed', () => {
    chatHistoryWindow = null;
  });
}

/**
 * IPC处理 - 打开聊天记录窗口
 */
ipcMain.on('open-chat-history', (event, historyData) => {
  createChatHistoryWindow(historyData);
});

/**
 * IPC处理 - 关闭聊天记录窗口
 */
ipcMain.on('close-chat-history', () => {
  if (chatHistoryWindow) {
    chatHistoryWindow.close();
  }
});

/**
 * 创建管理员面板窗口
 */
function createAdminPanelWindow() {
  // 创建新窗口
  const adminPanelWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 600,
    minHeight: 500,
    autoHideMenuBar: true,
    backgroundColor: '#ffffff',
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  adminPanelWindow.loadFile('src/pages/admin-panel.html');

  // 开发模式下打开DevTools
  if (process.argv.includes('--dev')) {
    adminPanelWindow.webContents.openDevTools();
  }
}

/**
 * IPC处理 - 打开管理员面板
 */
ipcMain.on('open-admin-panel', () => {
  createAdminPanelWindow();
});

/**
 * IPC处理 - 更新未读消息数
 */
ipcMain.on('update-unread-count', (event, count) => {
  unreadCount = count;
  updateTrayMenu();
  
  // 更新任务栏徽章（Windows）
  if (process.platform === 'win32' && mainWindow) {
    if (count > 0) {
      // Windows 下显示闪烁效果
      mainWindow.flashFrame(true);
      mainWindow.once('focus', () => {
        mainWindow.flashFrame(false);
      });
    }
  }
  
  // macOS 下更新 Dock 徽章
  if (process.platform === 'darwin') {
    if (count > 0) {
      app.dock.setBadge(count > 99 ? '99+' : count.toString());
      app.dock.bounce('informational');
    } else {
      app.dock.setBadge('');
    }
  }
});

/**
 * IPC处理 - 标题栏窗口控制
 */
ipcMain.on('window-minimize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.minimize();
});

ipcMain.on('window-maximize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  }
});

ipcMain.on('window-close', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.close();
});

ipcMain.handle('window-is-maximized', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return win ? win.isMaximized() : false;
});

// ==================== OAuth 本地服务器 ====================

/**
 * 启动OAuth本地验证服务器
 * 用于第三方网站验证用户登录状态
 * @param {Object} userData - 用户数据 {id, username, nickname, avatar}
 */
function startOAuthServer(userData) {
  // 如果服务器已存在，先停止
  stopOAuthServer();
  
  oauthUserData = userData;
  
  const http = require('http');
  
  oauthServer = http.createServer((req, res) => {
    // 设置CORS头，允许跨域访问
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // 处理预检请求
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    
    const url = require('url');
    const parsedUrl = url.parse(req.url, true);
    
    if (parsedUrl.pathname === '/status') {
      // 返回登录状态
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      
      if (oauthUserData) {
        res.end(JSON.stringify({
          logged_in: true,
          user_id: oauthUserData.id,
          username: oauthUserData.username,
          nickname: oauthUserData.nickname || oauthUserData.username,
          avatar: oauthUserData.avatar || null
        }));
      } else {
        res.end(JSON.stringify({
          logged_in: false
        }));
      }
    } else if (parsedUrl.pathname === '/ping') {
      // 健康检查
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', app: 'ZSMessage' }));
    } else {
      // 404
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found' }));
    }
  });
  
  oauthServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`[OAuth Server] 端口 ${OAUTH_PORT} 已被占用，尝试重新启动...`);
      setTimeout(() => {
        oauthServer.close();
        oauthServer.listen(OAUTH_PORT, '127.0.0.1');
      }, 1000);
    } else if (err.code === 'EACCES') {
      console.error(`[OAuth Server] 端口 ${OAUTH_PORT} 权限被拒绝，请以管理员身份运行或检查防火墙设置`);
    } else {
      console.error('[OAuth Server] 服务器错误:', err);
    }
  });
  
  oauthServer.listen(OAUTH_PORT, '127.0.0.1', () => {
    console.log(`[OAuth Server] 本地验证服务器已启动 http://127.0.0.1:${OAUTH_PORT}`);
    console.log('[OAuth Server] 当前用户:', oauthUserData?.username);
  });
}

/**
 * 停止OAuth本地验证服务器
 */
function stopOAuthServer() {
  if (oauthServer) {
    oauthServer.close(() => {
      console.log('[OAuth Server] 本地验证服务器已停止');
    });
    oauthServer = null;
  }
  oauthUserData = null;
}

// IPC: 启动OAuth服务器
ipcMain.on('start-oauth-server', (event, userData) => {
  console.log('[OAuth Server] 收到启动请求:', userData?.username);
  startOAuthServer(userData);
});

// IPC: 停止OAuth服务器
ipcMain.on('stop-oauth-server', () => {
  console.log('[OAuth Server] 收到停止请求');
  stopOAuthServer();
});

// IPC: 更新OAuth用户数据
ipcMain.on('update-oauth-user', (event, userData) => {
  if (oauthUserData) {
    oauthUserData = { ...oauthUserData, ...userData };
    console.log('[OAuth Server] 用户数据已更新:', oauthUserData?.username);
  }
});

// ==================== 深度链接处理 ====================

/**
 * 处理深度链接 URL
 * 格式: zsmessage://group/{inviteCode}/join
 */
function handleDeepLink(url) {
  console.log('[DeepLink] 处理 URL:', url);
  
  if (!url || typeof url !== 'string') return;
  
  try {
    // 解析 URL: zsmessage://group/{inviteCode}/join
    const match = url.match(/zsmessage:\/\/group\/([A-Za-z0-9]+)\/join/);
    
    if (match && match[1]) {
      const inviteCode = match[1];
      console.log('[DeepLink] 解析到邀请码:', inviteCode);
      
      // 稍微延迟发送，确保窗口已加载
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          // 显示主窗口
          mainWindow.show();
          mainWindow.focus();
          
          // 发送入群请求到渲染进程
          mainWindow.webContents.send('group-invite', { inviteCode });
          console.log('[DeepLink] 已发送入群请求:', inviteCode);
        } else {
          // 如果窗口未就绪，保存待处理
          pendingDeepLink = url;
        }
      }, 500);
    }
  } catch (error) {
    console.error('[DeepLink] 解析失败:', error);
  }
}

// Windows: 单实例应用，处理第二个实例传入的 URL
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // 如果无法获取锁，说明已经有实例在运行，退出当前实例
  app.quit();
} else {
  // 监听第二个实例的启动
  app.on('second-instance', (event, commandLine) => {
    // Windows: commandLine 是命令行参数数组
    const deepLinkUrl = commandLine.find(arg => arg.startsWith('zsmessage://'));
    
    if (deepLinkUrl) {
      handleDeepLink(deepLinkUrl);
    }
    
    // 显示并聚焦主窗口
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// macOS: 处理通过协议打开的 URL
app.on('open-url', (event, url) => {
  event.preventDefault();
  handleDeepLink(url);
});

// 启动时检查命令行参数中的深度链接
process.argv.forEach(arg => {
  if (arg.startsWith('zsmessage://')) {
    pendingDeepLink = arg;
  }
});
