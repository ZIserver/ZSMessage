const { app, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

/**
 * Electron在线更新服务
 */
class UpdateService {
  constructor() {
    // 配置日志
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    
    // 配置更新服务器
    autoUpdater.setFeedURL({
      provider: 'generic',
      url: '你的API地址/api/update/check' // 后端更新检查接口
    });
    
    // 禁用自动下载
    autoUpdater.autoDownload = false;
    
    this.setupListeners();
  }
  
  /**
   * 设置事件监听器
   */
  setupListeners() {
    // 检查更新时
    autoUpdater.on('checking-for-update', () => {
      log.info('正在检查更新...');
    });
    
    // 发现新版本
    autoUpdater.on('update-available', (info) => {
      log.info('发现新版本:', info.version);
      this.showUpdateDialog(info);
    });
    
    // 没有新版本
    autoUpdater.on('update-not-available', (info) => {
      log.info('当前已是最新版本:', info.version);
    });
    
    // 下载进度
    autoUpdater.on('download-progress', (progressObj) => {
      let message = `下载速度: ${progressObj.bytesPerSecond}`;
      message += ` - 已下载 ${progressObj.percent}%`;
      message += ` (${progressObj.transferred}/${progressObj.total})`;
      log.info(message);
    });
    
    // 下载完成
    autoUpdater.on('update-downloaded', (info) => {
      log.info('更新下载完成');
      this.showInstallDialog(info);
    });
    
    // 错误处理
    autoUpdater.on('error', (err) => {
      log.error('更新错误:', err);
    });
  }
  
  /**
   * 显示更新提示对话框
   */
  showUpdateDialog(info) {
    dialog.showMessageBox({
      type: 'info',
      title: '发现新版本',
      message: `发现新版本 ${info.version}`,
      detail: info.releaseNotes || '点击"立即更新"下载新版本',
      buttons: ['立即更新', '稍后提醒'],
      defaultId: 0,
      cancelId: 1
    }).then(result => {
      if (result.response === 0) {
        // 开始下载更新
        autoUpdater.downloadUpdate();
      }
    });
  }
  
  /**
   * 显示安装提示对话框
   */
  showInstallDialog(info) {
    dialog.showMessageBox({
      type: 'info',
      title: '更新已下载',
      message: '新版本已下载完成',
      detail: '应用将重启以安装更新',
      buttons: ['立即安装', '稍后安装'],
      defaultId: 0,
      cancelId: 1
    }).then(result => {
      if (result.response === 0) {
        // 退出并安装更新
        setImmediate(() => autoUpdater.quitAndInstall());
      }
    });
  }
  
  /**
   * 手动检查更新
   */
  checkForUpdates() {
    autoUpdater.checkForUpdates();
  }
  
  /**
   * 使用自定义API检查更新
   */
  async checkForUpdatesCustom() {
    try {
      const axios = require('axios');
      const currentVersion = app.getVersion();
      
      // 将 process.platform 转换为后端识别的格式
      const platformMap = {
        'win32': 'windows',
        'darwin': 'mac',
        'linux': 'linux'
      };
      const platform = platformMap[process.platform] || 'windows';
      
      log.info(`检查更新: 当前版本=${currentVersion}, 平台=${platform}`);
      console.log(`[更新] 检查更新: 当前版本=${currentVersion}, 平台=${platform}`);
      
      const response = await axios.get('https://msg.v2.zhsdev.top/api/update/check', {
        params: {
          currentVersion: currentVersion,
          platform: platform
        }
      });
      
      const data = response.data;
      log.info('更新检查结果:', data);
      console.log('[更新] 检查结果:', JSON.stringify(data, null, 2));
      
      if (data.hasUpdate) {
        log.info('发现新版本:', data.version);
        console.log('[更新] 发现新版本:', data.version);
        this.showUpdateDialogCustom(data);
      } else {
        log.info('当前已是最新版本');
        console.log('[更新] 当前已是最新版本');
      }
    } catch (error) {
      log.error('检查更新失败:', error.message);
      console.error('[更新] 检查失败:', error.message);
      if (error.response) {
        log.error('服务器响应:', error.response.status, error.response.data);
      }
    }
  }
  
  /**
   * 显示自定义更新对话框
   */
  showUpdateDialogCustom(updateInfo) {
    dialog.showMessageBox({
      type: 'info',
      title: '发现新版本',
      message: `发现新版本 ${updateInfo.version}`,
      detail: updateInfo.releaseNotes || '',
      buttons: ['立即下载', '稍后提醒'],
      defaultId: 0,
      cancelId: 1
    }).then(result => {
      if (result.response === 0) {
        // 打开下载链接
        require('electron').shell.openExternal(updateInfo.downloadUrl);
      }
    });
  }
}

module.exports = UpdateService;
