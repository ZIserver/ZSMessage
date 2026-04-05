const { ipcRenderer, shell } = require('electron');

// 当前激活的面板
let currentPanel = 'general';

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    initializeSettings();
    setupEventListeners();
    loadCurrentVersions();
});

// 初始化设置
function initializeSettings() {
    // 从本地存储加载设置
    loadSettingsFromStorage();
    
    // 设置初始面板
    switchPanel(currentPanel);
}

// 设置事件监听器
function setupEventListeners() {
    // 侧边栏菜单点击事件
    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', function() {
            const panel = this.getAttribute('data-panel');
            switchPanel(panel);
        });
    });

    // 颜色选择器事件
    document.querySelectorAll('.color-option').forEach(option => {
        option.addEventListener('click', function() {
            // 移除其他选项的活动状态
            document.querySelectorAll('.color-option').forEach(opt => {
                opt.classList.remove('active');
            });
            
            // 添加当前选项的活动状态
            this.classList.add('active');
            
            // 应用颜色到主题
            const color = this.getAttribute('data-color');
            applyThemeColor(color);
        });
    });

    // 所有输入元素变化事件
    document.querySelectorAll('input, select').forEach(element => {
        element.addEventListener('change', saveCurrentSettings);
    });
}

// 切换面板
function switchPanel(panelName) {
    // 更新侧边栏选中状态
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-panel') === panelName) {
            item.classList.add('active');
        }
    });

    // 显示对应的面板
    document.querySelectorAll('.settings-panel').forEach(panel => {
        panel.classList.remove('active');
    });
    document.getElementById(`panel-${panelName}`).classList.add('active');

    // 更新标题和描述
    updatePanelHeader(panelName);

    // 记录当前面板
    currentPanel = panelName;
}

// 更新面板标题和描述
function updatePanelHeader(panelName) {
    const titles = {
        'general': { title: '通用设置', desc: '配置应用程序的基本设置' },
        'appearance': { title: '外观设置', desc: '自定义应用程序的外观和感觉' },
        'notifications': { title: '通知设置', desc: '配置消息通知和提醒方式' },
        'privacy': { title: '隐私设置', desc: '管理数据收集和隐私选项' },
        'security': { title: '安全设置', desc: '保护应用程序和账户安全' },
        'advanced': { title: '高级设置', desc: '调整高级性能和网络选项' },
        'update': { title: '更新设置', desc: '管理应用程序更新策略' },
        'about': { title: '关于智穗语聊', desc: '查看应用信息和版本详情' }
    };

    const title = document.getElementById('currentPanelTitle');
    const desc = document.getElementById('currentPanelDesc');
    
    if (titles[panelName]) {
        title.textContent = titles[panelName].title;
        desc.textContent = titles[panelName].desc;
    }
}

// 从本地存储加载设置
function loadSettingsFromStorage() {
    const settings = JSON.parse(localStorage.getItem('appSettings') || '{}');
    
    // 加载通用设置
    document.getElementById('autoLaunchToggle').checked = settings.autoLaunch || false;
    document.getElementById('minimizeOnStartup').checked = settings.minimizeOnStartup || false;
    document.getElementById('autoLogin').checked = settings.autoLogin || false;
    document.getElementById('autoCleanCache').checked = settings.autoCleanCache !== false; // 默认true
    document.getElementById('cleanInterval').value = settings.cleanInterval || '7';

    // 加载外观设置
    document.getElementById('themeMode').value = settings.themeMode || 'light';
    document.getElementById('transparencyEffect').checked = settings.transparencyEffect !== false; // 默认true
    
    // 加载通知设置
    document.getElementById('desktopNotification').checked = settings.desktopNotification !== false; // 默认true
    document.getElementById('soundNotification').checked = settings.soundNotification !== false; // 默认true
    document.getElementById('vibrationNotification').checked = settings.vibrationNotification || false;
    document.getElementById('notificationPreview').checked = settings.notificationPreview !== false; // 默认true
    document.getElementById('doNotDisturb').checked = settings.doNotDisturb || false;
    document.getElementById('dndStartTime').value = settings.dndStartTime || '22:00';
    document.getElementById('dndEndTime').value = settings.dndEndTime || '08:00';

    // 加载隐私设置
    document.getElementById('usageStats').checked = settings.usageStats || false;
    document.getElementById('crashReports').checked = settings.crashReports !== false; // 默认true
    document.getElementById('locationAccess').checked = settings.locationAccess || false;

    // 加载安全设置
    document.getElementById('appLock').checked = settings.appLock || false;
    document.getElementById('lockMethod').value = settings.lockMethod || 'password';
    document.getElementById('autoLockTime').value = settings.autoLockTime || '5';

    // 加载高级设置
    document.getElementById('hardwareAcceleration').checked = settings.hardwareAcceleration !== false; // 默认true
    document.getElementById('memoryOptimization').checked = settings.memoryOptimization !== false; // 默认true
    document.getElementById('networkOptimization').checked = settings.networkOptimization !== false; // 默认true
    document.getElementById('proxyEnabled').checked = settings.proxyEnabled || false;
    document.getElementById('proxyAddress').value = settings.proxyAddress || '';
    document.getElementById('timeoutSeconds').value = settings.timeoutSeconds || '30';

    // 加载更新设置
    document.getElementById('autoUpdateCheck').checked = settings.autoUpdateCheck !== false; // 默认true
    document.getElementById('autoDownloadUpdate').checked = settings.autoDownloadUpdate !== false; // 默认true
    document.getElementById('autoInstallUpdate').checked = settings.autoInstallUpdate || false;
}

// 保存当前设置到本地存储
function saveCurrentSettings() {
    const settings = {
        // 通用设置
        autoLaunch: document.getElementById('autoLaunchToggle').checked,
        minimizeOnStartup: document.getElementById('minimizeOnStartup').checked,
        autoLogin: document.getElementById('autoLogin').checked,
        autoCleanCache: document.getElementById('autoCleanCache').checked,
        cleanInterval: document.getElementById('cleanInterval').value,

        // 外观设置
        themeMode: document.getElementById('themeMode').value,
        transparencyEffect: document.getElementById('transparencyEffect').checked,

        // 通知设置
        desktopNotification: document.getElementById('desktopNotification').checked,
        soundNotification: document.getElementById('soundNotification').checked,
        vibrationNotification: document.getElementById('vibrationNotification').checked,
        notificationPreview: document.getElementById('notificationPreview').checked,
        doNotDisturb: document.getElementById('doNotDisturb').checked,
        dndStartTime: document.getElementById('dndStartTime').value,
        dndEndTime: document.getElementById('dndEndTime').value,

        // 隐私设置
        usageStats: document.getElementById('usageStats').checked,
        crashReports: document.getElementById('crashReports').checked,
        locationAccess: document.getElementById('locationAccess').checked,

        // 安全设置
        appLock: document.getElementById('appLock').checked,
        lockMethod: document.getElementById('lockMethod').value,
        autoLockTime: document.getElementById('autoLockTime').value,

        // 高级设置
        hardwareAcceleration: document.getElementById('hardwareAcceleration').checked,
        memoryOptimization: document.getElementById('memoryOptimization').checked,
        networkOptimization: document.getElementById('networkOptimization').checked,
        proxyEnabled: document.getElementById('proxyEnabled').checked,
        proxyAddress: document.getElementById('proxyAddress').value,
        timeoutSeconds: document.getElementById('timeoutSeconds').value,

        // 更新设置
        autoUpdateCheck: document.getElementById('autoUpdateCheck').checked,
        autoDownloadUpdate: document.getElementById('autoDownloadUpdate').checked,
        autoInstallUpdate: document.getElementById('autoInstallUpdate').checked
    };

    localStorage.setItem('appSettings', JSON.stringify(settings));
    
    // 通知主进程设置已更改
    ipcRenderer.send('settings-changed', settings);
}

// 保存设置
function saveSettings() {
    saveCurrentSettings();
    showToast('设置已保存', 'success');
}

// 重置设置
function resetSettings() {
    if (confirm('确定要重置所有设置吗？此操作不可撤销。')) {
        localStorage.removeItem('appSettings');
        location.reload();
    }
}

// 关闭设置
function closeSettings() {
    window.close(); // 或者调用主进程的关闭方法
}

// 清理缓存
function clearCache() {
    if (confirm('确定要清理缓存吗？这将删除临时文件和缓存数据。')) {
        // 通知主进程清理缓存
        ipcRenderer.invoke('clear-cache').then(() => {
            showToast('缓存清理完成', 'success');
        }).catch((error) => {
            console.error('清理缓存失败:', error);
            showToast('缓存清理失败', 'error');
        });
    }
}

// 应用主题颜色
function applyThemeColor(color) {
    document.documentElement.style.setProperty('--primary-color', color);
    
    // 通知主进程主题颜色已更改
    ipcRenderer.send('theme-color-changed', color);
}

// 检查更新
async function checkForUpdates() {
    const statusDiv = document.getElementById('updateStatus');
    statusDiv.className = 'update-status show checking';
    statusDiv.innerHTML = '<p>正在检查更新...</p>';

    try {
        const result = await ipcRenderer.invoke('check-for-updates');
        
        if (result.hasUpdate) {
            statusDiv.className = 'update-status show success';
            statusDiv.innerHTML = `<p>发现新版本 ${result.version}！<a href="#" onclick="downloadUpdate(event)">点击下载</a></p>`;
        } else {
            statusDiv.className = 'update-status show';
            statusDiv.innerHTML = '<p>当前已是最新版本。</p>';
        }
    } catch (error) {
        statusDiv.className = 'update-status show error';
        statusDiv.innerHTML = `<p>检查更新失败: ${error.message}</p>`;
    }
}

// 下载更新
function downloadUpdate(event) {
    event.preventDefault();
    ipcRenderer.invoke('download-update');
}

// 运行安全扫描
function runSecurityScan() {
    showToast('开始安全扫描...', 'info');
    
    ipcRenderer.invoke('run-security-scan').then(result => {
        if (result.threatsFound > 0) {
            showToast(`安全扫描完成，发现 ${result.threatsFound} 个威胁`, 'error');
        } else {
            showToast('安全扫描完成，未发现威胁', 'success');
        }
    }).catch(error => {
        console.error('安全扫描失败:', error);
        showToast('安全扫描失败', 'error');
    });
}

// 加载当前版本信息
async function loadCurrentVersions() {
    try {
        const versions = await ipcRenderer.invoke('get-app-versions');
        
        document.getElementById('appVersion').textContent = versions.app;
        document.getElementById('electronVersion').textContent = versions.electron;
        document.getElementById('nodeVersion').textContent = versions.node;
        document.getElementById('chromeVersion').textContent = versions.chrome;
        // 从navigator获取操作系统信息
        document.getElementById('osInfo').textContent = navigator.platform;
    } catch (error) {
        console.error('加载版本信息失败:', error);
        
        // 使用默认值
        document.getElementById('appVersion').textContent = '未知';
        document.getElementById('electronVersion').textContent = '未知';
        document.getElementById('nodeVersion').textContent = '未知';
        document.getElementById('chromeVersion').textContent = '未知';
        document.getElementById('osInfo').textContent = '未知';
    }
}

// 打开网站
function openWebsite() {
    shell.openExternal('https://msg.v2.zhsdev.top');
}

// 显示Toast消息
function showToast(message, type = 'info') {
    // 创建toast元素
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    
    // 添加样式
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 6px;
        color: white;
        font-size: 14px;
        z-index: 10000;
        animation: slideInRight 0.3s ease;
        background: ${type === 'success' ? '#67c23a' : type === 'error' ? '#f56c6c' : '#409eff'};
        pointer-events: auto;
    `;
    
    document.body.appendChild(toast);
    
    // 3秒后移除
    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            if (document.body.contains(toast)) {
                document.body.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

// 添加动画样式
if (!document.querySelector('#toast-animations')) {
    const style = document.createElement('style');
    style.id = 'toast-animations';
    style.textContent = `
        @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOutRight {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
}

// IPC 事件监听器
ipcRenderer.on('update-available', (event, info) => {
    const statusDiv = document.getElementById('updateStatus');
    statusDiv.className = 'update-status show success';
    statusDiv.innerHTML = `<p>发现新版本 ${info.version}！<a href="#" onclick="downloadUpdate(event)">点击下载</a></p>`;
});

ipcRenderer.on('update-not-available', (event) => {
    const statusDiv = document.getElementById('updateStatus');
    statusDiv.className = 'update-status show';
    statusDiv.innerHTML = '<p>当前已是最新版本。</p>';
});

ipcRenderer.on('update-error', (event, error) => {
    const statusDiv = document.getElementById('updateStatus');
    statusDiv.className = 'update-status show error';
    statusDiv.innerHTML = `<p>更新失败: ${error}</p>`;
});