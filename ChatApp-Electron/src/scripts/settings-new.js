const { ipcRenderer } = require('electron');

console.log('============================================');
console.log('[Settings] 新版设置页面已加载');
console.log('[Settings] 当前时间:', new Date().toLocaleString());
console.log('============================================');

// 清理废弃的主题相关localStorage数据
if (localStorage.getItem('app-theme')) {
    localStorage.removeItem('app-theme');
    console.log('[Settings] 已清理废弃的app-theme设置');
}
if (localStorage.getItem('custom-theme-color')) {
    localStorage.removeItem('custom-theme-color');
    console.log('[Settings] 已清理废弃的custom-theme-color设置');
}

console.log('[Settings] 主题功能已被移除，相关设置已清理');

// 全局错误捕获
window.onerror = function(message, source, lineno, colno, error) {
    console.error('============ JavaScript 错误 ============');
    console.error('错误消息:', message);
    console.error('错误来源:', source);
    console.error('行号:', lineno, '列号:', colno);
    console.error('错误对象:', error);
    console.error('========================================');
    return false;
};

window.addEventListener('unhandledrejection', function(event) {
    console.error('============ Promise 错误 ============');
    console.error('未处理的 Promise 拒绝:', event.reason);
    console.error('====================================');
});

// ==================== 工具函数 ====================

// 显示 Toast 提示
function showToast(message, duration = 2000) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        if (document.body.contains(toast)) {
            document.body.removeChild(toast);
        }
    }, duration);
}

// 返回上一页
function goBack() {
    window.history.back();
}

// 关闭设置窗口
function closeSettingsWindow() {
    console.log('[Settings] 尝试关闭设置窗口');
    ipcRenderer.send('close-settings-window');
}

// ==================== 面板切换 ====================

function initPanelSwitcher() {
    const menuItems = document.querySelectorAll('.menu-item');
    const panels = document.querySelectorAll('.settings-panel');
    const panelTitle = document.getElementById('panelTitle');
    
    const titleMap = {
        'general': '通用设置',
        'notifications': '通知设置',
        'shortcuts': '快捷键设置',
        'theme': '外观设置',
        'update': '应用更新',
        'about': '关于应用'
    };
    
    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            const panelId = item.dataset.panel;
            
            // 更新菜单项状态
            menuItems.forEach(mi => mi.classList.remove('active'));
            item.classList.add('active');
            
            // 切换面板
            panels.forEach(panel => panel.classList.remove('active'));
            document.getElementById(`panel-${panelId}`).classList.add('active');
            
            // 更新标题
            panelTitle.textContent = titleMap[panelId] || '设置';
            
            console.log('[Settings] 切换到面板:', panelId);
        });
    });
}

// ==================== 开机自启动 ====================

async function loadAutoLaunchSetting() {
    try {
        const enabled = await ipcRenderer.invoke('get-auto-launch');
        const toggle = document.getElementById('autoLaunchToggle');
        
        if (toggle) {
            toggle.checked = enabled;
            console.log('[Settings] 开机自启动状态:', enabled);
        }
    } catch (error) {
        console.error('[Settings] 获取开机自启动设置失败:', error);
    }
}

async function saveAutoLaunchSetting(enabled) {
    console.log('[Settings] 保存开机自启动设置:', enabled);
    
    try {
        const result = await ipcRenderer.invoke('set-auto-launch', enabled);
        
        if (result.success) {
            console.log('[Settings] 开机自启动已保存:', enabled);
            showToast(enabled ? '已开启开机自启动' : '已关闭开机自启动');
        } else {
            console.error('[Settings] 设置失败:', result.error);
            showToast('设置失败: ' + (result.error || '未知错误'), 3000);
            
            // 恢复之前的状态
            setTimeout(() => loadAutoLaunchSetting(), 500);
        }
    } catch (error) {
        console.error('[Settings] 保存开机自启动设置失败:', error);
        showToast('保存失败: ' + error.message, 3000);
        
        // 恢复之前的状态
        setTimeout(() => loadAutoLaunchSetting(), 500);
    }
}

// ==================== 消息通知 ====================

function loadMessageNotificationSetting() {
    const enabled = localStorage.getItem('messageNotification') !== 'false';
    const toggle = document.getElementById('messageNotificationToggle');
    
    if (toggle) {
        toggle.checked = enabled;
        console.log('[Settings] 消息通知状态:', enabled);
    }
}

function saveMessageNotificationSetting(enabled) {
    console.log('[Settings] 保存消息通知设置:', enabled);
    localStorage.setItem('messageNotification', enabled.toString());
    showToast(enabled ? '已开启消息通知' : '已关闭消息通知');
}

// ==================== 声音通知 ====================

function loadSoundNotificationSetting() {
    const enabled = localStorage.getItem('soundNotification') !== 'false';
    const toggle = document.getElementById('soundNotificationToggle');
    
    if (toggle) {
        toggle.checked = enabled;
        console.log('[Settings] 声音通知状态:', enabled);
    }
}

function saveSoundNotificationSetting(enabled) {
    console.log('[Settings] 保存声音通知设置:', enabled);
    localStorage.setItem('soundNotification', enabled.toString());
    showToast(enabled ? '已开启声音通知' : '已关闭声音通知');
}

// ==================== 发送快捷键 ====================

function loadSendShortcut() {
    const saved = localStorage.getItem('sendShortcut') || 'Enter';
    const select = document.getElementById('sendShortcut');
    
    if (select) {
        select.value = saved;
        console.log('[Settings] 发送快捷键:', saved);
    }
}

function saveSendShortcut(shortcut) {
    console.log('[Settings] 保存发送快捷键:', shortcut);
    localStorage.setItem('sendShortcut', shortcut);
    showToast(`快捷键已设置为: ${shortcut === 'Enter' ? 'Enter 键' : 'Ctrl + Enter'}`);
}

// ==================== 默认浏览器 ====================

function loadDefaultBrowserSetting() {
    const saved = localStorage.getItem('defaultBrowser') || 'system';
    const select = document.getElementById('defaultBrowser');
    
    if (select) {
        select.value = saved;
        console.log('[Settings] 默认浏览器:', saved);
    }
}

function saveDefaultBrowserSetting(browser) {
    console.log('[Settings] 保存默认浏览器:', browser);
    localStorage.setItem('defaultBrowser', browser);
    showToast(browser === 'system' ? '已设置为系统浏览器' : '已设置为应用内置浏览器');
}



// ==================== 版本信息 ====================

async function loadVersionInfo() {
    try {
        const versions = await ipcRenderer.invoke('get-versions');
        
        document.getElementById('currentVersion').textContent = versions.app;
        document.getElementById('electronVersion').textContent = versions.electron;
        document.getElementById('nodeVersion').textContent = versions.node;
        document.getElementById('chromeVersion').textContent = versions.chrome;
        
        console.log('[Settings] 版本信息已加载:', versions);
    } catch (error) {
        console.error('[Settings] 获取版本信息失败:', error);
    }
}

// ==================== 更新检查 ====================

async function checkForUpdates() {
    const statusDiv = document.getElementById('updateStatus');
    statusDiv.className = 'update-area show checking';
    statusDiv.textContent = '正在检查更新...';
    
    try {
        const result = await ipcRenderer.invoke('check-for-updates');
        
        if (result.hasUpdate) {
            statusDiv.className = 'update-area show error';
            statusDiv.innerHTML = `
                <div style="font-size: 14px; font-weight: 500; margin-bottom: 8px;">
                    发现新版本 ${result.version}
                </div>
                <div style="font-size: 12px; opacity: 0.9;">
                    ${result.releaseNotes || '点击下载按钮获取最新版本'}
                </div>
            `;
        } else {
            statusDiv.className = 'update-area show success';
            statusDiv.textContent = '✓ 当前已是最新版本';
            
            setTimeout(() => {
                statusDiv.classList.remove('show');
            }, 3000);
        }
    } catch (error) {
        statusDiv.className = 'update-area show error';
        statusDiv.textContent = '检查更新失败：' + error.message;
    }
}

// ==================== 初始化 ====================

document.addEventListener('DOMContentLoaded', () => {
    console.log('\n============================================');
    console.log('[Settings] DOMContentLoaded 事件触发');
    console.log('[Settings] 开始初始化...');
    console.log('============================================\n');
    
    // 初始化面板切换
    initPanelSwitcher();
    
    // 加载所有设置
    loadAutoLaunchSetting();
    loadMessageNotificationSetting();
    loadSoundNotificationSetting();
    loadSendShortcut();
    loadDefaultBrowserSetting();
    loadVersionInfo();
    
    // 绑定开机自启动开关
    const autoLaunchToggle = document.getElementById('autoLaunchToggle');
    if (autoLaunchToggle) {
        autoLaunchToggle.addEventListener('change', (e) => {
            console.log('[Settings] 开机自启动开关变化:', e.target.checked);
            saveAutoLaunchSetting(e.target.checked);
        });
    }
    
    // 绑定消息通知开关
    const messageNotificationToggle = document.getElementById('messageNotificationToggle');
    if (messageNotificationToggle) {
        messageNotificationToggle.addEventListener('change', (e) => {
            console.log('[Settings] 消息通知开关变化:', e.target.checked);
            saveMessageNotificationSetting(e.target.checked);
        });
    }
    
    // 绑定声音通知开关
    const soundNotificationToggle = document.getElementById('soundNotificationToggle');
    if (soundNotificationToggle) {
        soundNotificationToggle.addEventListener('change', (e) => {
            console.log('[Settings] 声音通知开关变化:', e.target.checked);
            saveSoundNotificationSetting(e.target.checked);
        });
    }
    
    // 绑定发送快捷键选择
    const sendShortcutSelect = document.getElementById('sendShortcut');
    if (sendShortcutSelect) {
        sendShortcutSelect.addEventListener('change', (e) => {
            console.log('[Settings] 发送快捷键变化:', e.target.value);
            saveSendShortcut(e.target.value);
        });
    }
    
    // 绑定默认浏览器选择
    const defaultBrowserSelect = document.getElementById('defaultBrowser');
    if (defaultBrowserSelect) {
        defaultBrowserSelect.addEventListener('change', (e) => {
            console.log('[Settings] 默认浏览器变化:', e.target.value);
            saveDefaultBrowserSetting(e.target.value);
        });
    }
    
    console.log('\n============================================');
    console.log('[Settings] 初始化完成');
    console.log('[Settings] 所有事件监听器已绑定');
    console.log('============================================\n');
});
