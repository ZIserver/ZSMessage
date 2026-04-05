const axios = require('axios');
const { BrowserWindow, app, ipcMain } = require('electron');
const log = require('electron-log');
const fs = require('fs');
const path = require('path');

const API_BASE_URL = '你的API地址/api';
const SHOW_INTERVAL_DAYS = 3;

class AnnouncementService {
  constructor() {
    // 存储文件路径
    this.storagePath = path.join(app.getPath('userData'), 'announcement-storage.json');
    this.setupIpcHandlers();
  }
  /**
   * 设置IPC处理程序
   */
  setupIpcHandlers() {
    ipcMain.on('get-announcement-data', (event) => {
      event.returnValue = this.currentAnnouncement || null;
    });
    
    // 窗口控制
    ipcMain.on('window-control', (event, action) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win) return;
      
      switch (action) {
        case 'minimize':
          win.minimize();
          break;
        case 'maximize':
          if (win.isMaximized()) {
            win.unmaximize();
          } else {
            win.maximize();
          }
          break;
        case 'close':
          win.close();
          break;
      }
    });
    
    ipcMain.on('announcement-dialog-response', (event, response) => {
      if (this.dialogWindow) {
        if (response === 'more') {
          // 打开新窗口显示公告列表
          this.openAnnouncementsWindow();
        }
        this.dialogWindow.close();
      }
    });
    
    // 手动显示公告（不记录为已显示）
    ipcMain.on('show-announcement-manual', (event, announcement) => {
      this.showAnnouncementDialog(null, announcement, false);
    });
  }
  /**
   * 检查是否需要显示公告
   */
  shouldShowAnnouncement(announcementId) {
    try {
      const storageData = this.getStorageData();
      const lastShown = storageData[announcementId];
      
      if (!lastShown) {
        return true;
      }
      
      const lastShownDate = new Date(lastShown);
      const now = new Date();
      const daysDiff = (now - lastShownDate) / (1000 * 60 * 60 * 24);
      
      return daysDiff >= SHOW_INTERVAL_DAYS;
    } catch (error) {
      log.error('检查公告显示条件失败:', error);
      return true;
    }
  }
  
  /**
   * 记录公告已显示
   */
  markAnnouncementShown(announcementId) {
    try {
      const storageData = this.getStorageData();
      storageData[announcementId] = new Date().toISOString();
      
      // 写入文件
      fs.writeFileSync(this.storagePath, JSON.stringify(storageData, null, 2), 'utf8');
      
      log.info(`公告 ${announcementId} 已标记为已显示`);
      console.log(`[公告] ID ${announcementId} 已标记为已显示`);
    } catch (error) {
      log.error('记录公告显示失败:', error);
    }
  }
  
  /**
   * 获取存储数据
   */
  getStorageData() {
    try {
      if (fs.existsSync(this.storagePath)) {
        const data = fs.readFileSync(this.storagePath, 'utf8');
        return JSON.parse(data);
      }
      return {};
    } catch (error) {
      log.error('读取公告存储数据失败:', error);
      return {};
    }
  }
  
  /**
   * 检查并显示最新公告
   */
  async checkAndShowAnnouncement(mainWindow) {
    try {
      log.info('开始检查最新公告...');
      console.log('[公告] 开始检查最新公告...');
      
      const response = await axios.get(`${API_BASE_URL}/announcements/latest`);
      
      if (response.status === 204 || !response.data) {
        log.info('暂无公告');
        console.log('[公告] 暂无公告');
        return;
      }
      
      const announcement = response.data;
      log.info('获取到公告:', announcement.title);
      console.log('[公告] 获取到公告:', announcement.title);
      
      // 检查是否需要显示
      if (!this.shouldShowAnnouncement(announcement.id)) {
        log.info(`公告 ${announcement.id} 在3天内已显示过，跳过`);
        console.log(`[公告] ID ${announcement.id} 在3天内已显示过，跳过`);
        return;
      }
      
      // 显示公告对话框
      this.showAnnouncementDialog(mainWindow, announcement);
      
    } catch (error) {
      if (error.response && error.response.status === 204) {
        log.info('暂无公告');
        console.log('[公告] 暂无公告');
      } else {
        log.error('检查公告失败:', error.message);
        console.error('[公告] 检查失败:', error.message);
      }
    }
  }
  
  /**
   * 显示公告对话框
   * @param {BrowserWindow} mainWindow - 主窗口（可为null）
   * @param {Object} announcement - 公告对象
   * @param {Boolean} markAsShown - 是否记录为已显示（默认true）
   */
  showAnnouncementDialog(mainWindow, announcement, markAsShown = true) {
    this.currentAnnouncement = announcement;
    this.shouldMarkAsShown = markAsShown;
      
    // 创建对话框窗口
    this.dialogWindow = new BrowserWindow({
      width: 550,
      height: 650,
      resizable: false,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });
      
    this.dialogWindow.loadFile('src/pages/announcement-dialog.html');
      
    // 窗口关闭时清理
    this.dialogWindow.on('closed', () => {
      // 只有在自动检查时才记录已显示
      if (this.shouldMarkAsShown) {
        this.markAnnouncementShown(announcement.id);
      }
      this.dialogWindow = null;
      this.currentAnnouncement = null;
      this.shouldMarkAsShown = true;
    });
      
    log.info('公告对话框已显示');
    console.log('[公告] 对话框已显示');
  }

  /**
   * 打开公告列表窗口
   */
  openAnnouncementsWindow() {
    // 检查是否已有公告窗口
    if (this.announcementsWindow && !this.announcementsWindow.isDestroyed()) {
      this.announcementsWindow.focus();
      return;
    }

    this.announcementsWindow = new BrowserWindow({
      width: 600,
      height: 700,
      minWidth: 400,
      minHeight: 500,
      frame: false,
      titleBarStyle: 'hidden',
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    this.announcementsWindow.loadFile('src/pages/announcements.html');

    this.announcementsWindow.on('closed', () => {
      this.announcementsWindow = null;
    });

    log.info('公告列表窗口已打开');
  }
}

module.exports = AnnouncementService;
