const { ipcRenderer } = require('electron');
const API_BASE_URL = 'https://msg.v2.zhsdev.top/api';

// 立即执行的日志
console.log('============================================');
console.log('[Settings] settings.js 文件已加载');
console.log('[Settings] 当前时间:', new Date().toLocaleString());
console.log('[Settings] 当前 URL:', window.location.href);
console.log('============================================');

// 捕获所有错误
window.onerror = function(message, source, lineno, colno, error) {
    console.error('============ JavaScript 错误 ============');
    console.error('错误消息:', message);
    console.error('错误来源:', source);
    console.error('行号:', lineno, '列号:', colno);
    console.error('错误对象:', error);
    console.error('========================================');
    return false;
};

// 捕获未处理的 Promise 错误
window.addEventListener('unhandledrejection', function(event) {
    console.error('============ Promise 错误 ============');
    console.error('未处理的 Promise 拒绝:', event.reason);
    console.error('====================================');
});

// 返回上一页
function goBack() {
    window.history.back();
}

// 加载版本信息
async function loadVersionInfo() {
    try {
        const versions = await ipcRenderer.invoke('get-versions');
        document.getElementById('currentVersion').textContent = versions.app;
        document.getElementById('electronVersion').textContent = versions.electron;
        document.getElementById('nodeVersion').textContent = versions.node;
        document.getElementById('chromeVersion').textContent = versions.chrome;
    } catch (error) {
        console.error('获取版本信息失败:', error);
    }
}

// 加载开机自启动设置
async function loadAutoLaunchSetting() {
    try {
        const enabled = await ipcRenderer.invoke('get-auto-launch');
        const toggle = document.getElementById('autoLaunchToggle');
        const status = document.getElementById('autoLaunchStatus');
        
        if (toggle) {
            toggle.checked = enabled;
            console.log('[Settings] 开机自启动状态:', enabled);
        }
        
        if (status) {
            status.textContent = `当前状态：${enabled ? '已开启' : '已关闭'}`;
            status.style.color = enabled ? '#2e7d32' : '#666';
        }
    } catch (error) {
        console.error('获取开机自启动设置失败:', error);
        const status = document.getElementById('autoLaunchStatus');
        if (status) {
            status.textContent = '当前状态：获取失败';
            status.style.color = '#d32f2f';
        }
    }
}

// 自动保存开机自启动设置
async function saveAutoLaunchSetting(enabled) {
    console.log('[Settings] saveAutoLaunchSetting 被调用, enabled:', enabled);
    const status = document.getElementById('autoLaunchStatus');
    
    try {
        if (status) {
            status.textContent = '正在保存...';
            status.style.color = '#1976d2';
        }
        
        console.log('[Settings] 开始调用 IPC set-auto-launch');
        const result = await ipcRenderer.invoke('set-auto-launch', enabled);
        console.log('[Settings] IPC 返回结果:', result);
        
        if (result.success) {
            console.log('[Settings] 开机自启动已保存:', enabled);
            showToast(enabled ? '已开启开机自启动' : '已关闭开机自启动');
            
            if (status) {
                status.textContent = `当前状态：${enabled ? '已开启' : '已关闭'}`;
                status.style.color = enabled ? '#2e7d32' : '#666';
            }
        } else {
            console.error('[Settings] 设置失败:', result.error);
            showToast('设置失败: ' + (result.error || ''), 3000);
            
            if (status) {
                status.textContent = '当前状态：设置失败';
                status.style.color = '#d32f2f';
            }
            
            // 恢复之前的状态
            setTimeout(() => loadAutoLaunchSetting(), 500);
        }
    } catch (error) {
        console.error('保存开机自启动设置失败:', error);
        showToast('保存失败: ' + error.message, 3000);
        
        if (status) {
            status.textContent = '当前状态：保存失败';
            status.style.color = '#d32f2f';
        }
        
        // 恢复之前的状态
        setTimeout(() => loadAutoLaunchSetting(), 500);
    }
}

// 显示提示
function showToast(message, duration = 2000) {
    // 创建提示元素
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        font-size: 14px;
        z-index: 10000;
        animation: fadeInOut ${duration / 1000}s ease-in-out;
        max-width: 80%;
        text-align: center;
    `;
    
    // 添加动画
    const style = document.createElement('style');
    const animDuration = duration / 1000;
    style.textContent = `
        @keyframes fadeInOut {
            0% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
            10% { opacity: 1; transform: translateX(-50%) translateY(0); }
            ${90 * (2 / animDuration)}% { opacity: 1; transform: translateX(-50%) translateY(0); }
            100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
        }
    `;
    document.head.appendChild(style);
    document.body.appendChild(toast);
    
    // 指定时间后移除
    setTimeout(() => {
        if (document.body.contains(toast)) {
            document.body.removeChild(toast);
        }
        if (document.head.contains(style)) {
            document.head.removeChild(style);
        }
    }, duration);
}

// 加载主题设置
function loadThemeSettings() {
    const savedTheme = localStorage.getItem('themeColor') || '#667eea';
    const colorOptions = document.querySelectorAll('.color-option');
    
    colorOptions.forEach(option => {
        if (option.dataset.color === savedTheme) {
            option.classList.add('active');
        }
        
        option.addEventListener('click', function() {
            // 移除所有active
            colorOptions.forEach(opt => opt.classList.remove('active'));
            // 添加当前active
            this.classList.add('active');
            
            // 保存主题
            const color = this.dataset.color;
            localStorage.setItem('themeColor', color);
            
            // 应用主题
            applyTheme(color);
            
            // 通知其他页面
            ipcRenderer.send('theme-changed', color);
        });
    });
    
    // 应用已保存的主题
    applyTheme(savedTheme);
}

// 应用主题
function applyTheme(color) {
    // 更新CSS变量
    document.documentElement.style.setProperty('--primary-color', color);
    
    // 可以根据主题色调整其他颜色
    const gradient = getGradientForColor(color);
    document.body.style.background = gradient;
    
    const header = document.querySelector('.settings-header');
    if (header) {
        header.style.background = gradient;
    }
}

// 根据颜色获取渐变
function getGradientForColor(color) {
    const gradients = {
        '#667eea': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        '#00b4d8': 'linear-gradient(135deg, #00b4d8 0%, #0077b6 100%)',
        '#f72585': 'linear-gradient(135deg, #f72585 0%, #b5179e 100%)',
        '#ff6d00': 'linear-gradient(135deg, #ff6d00 0%, #ff9500 100%)',
        '#06d6a0': 'linear-gradient(135deg, #06d6a0 0%, #00a896 100%)',
        '#7209b7': 'linear-gradient(135deg, #7209b7 0%, #560bad 100%)'
    };
    return gradients[color] || gradients['#667eea'];
}

// 检查更新
async function checkForUpdates() {
    const statusDiv = document.getElementById('updateStatus');
    statusDiv.style.display = 'block';
    statusDiv.className = 'update-status checking';
    statusDiv.textContent = '正在检查更新...';
    
    try {
        const result = await ipcRenderer.invoke('check-for-updates');
        
        if (result.hasUpdate) {
            statusDiv.className = 'update-status available';
            statusDiv.innerHTML = `
                <div>发现新版本 ${result.version}</div>
                <div style="margin-top: 8px; font-size: 13px;">${result.releaseNotes || ''}</div>
            `;
        } else {
            statusDiv.className = 'update-status latest';
            statusDiv.textContent = '当前已是最新版本';
            
            // 3秒后隐藏
            setTimeout(() => {
                statusDiv.style.display = 'none';
            }, 3000);
        }
    } catch (error) {
        statusDiv.className = 'update-status available';
        statusDiv.textContent = '检查更新失败：' + error.message;
    }
}

// 加载发送快捷键设置
function loadSendShortcut() {
    const saved = localStorage.getItem('sendShortcut') || 'Enter';
    const select = document.getElementById('sendShortcut');
    if (select) {
        select.value = saved;
        console.log('[Settings] 发送快捷键:', saved);
    }
}

// 保存发送快捷键设置
function saveSendShortcut(shortcut) {
    localStorage.setItem('sendShortcut', shortcut);
    console.log('[Settings] 已保存发送快捷键:', shortcut);
    showToast(`快捷键已设置为: ${shortcut === 'Enter' ? 'Enter键' : 'Ctrl + Enter'}`, 2000);
}

// 加载消息通知设置
function loadMessageNotificationSetting() {
    const enabled = localStorage.getItem('messageNotification') !== 'false'; // 默认开启
    const toggle = document.getElementById('messageNotificationToggle');
    if (toggle) {
        toggle.checked = enabled;
        console.log('[Settings] 消息通知:', enabled);
    }
}

// 保存消息通知设置
function saveMessageNotificationSetting(enabled) {
    console.log('[Settings] saveMessageNotificationSetting 被调用, enabled:', enabled);
    localStorage.setItem('messageNotification', enabled.toString());
    console.log('[Settings] 已保存消息通知:', enabled);
    showToast(enabled ? '已开启消息通知' : '已关闭消息通知');
}

// 加载声音通知设置
function loadSoundNotificationSetting() {
    const enabled = localStorage.getItem('soundNotification') !== 'false'; // 默认开启
    const toggle = document.getElementById('soundNotificationToggle');
    if (toggle) {
        toggle.checked = enabled;
        console.log('[Settings] 声音通知:', enabled);
    }
}

// 保存声音通知设置
function saveSoundNotificationSetting(enabled) {
    console.log('[Settings] saveSoundNotificationSetting 被调用, enabled:', enabled);
    localStorage.setItem('soundNotification', enabled.toString());
    console.log('[Settings] 已保存声音通知:', enabled);
    showToast(enabled ? '已开启声音通知' : '已关闭声音通知');
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    console.log('\n============================================');
    console.log('[Settings] DOMContentLoaded 事件触发');
    console.log('[Settings] 开始初始化设置页面...');
    console.log('============================================\n');
    
    loadVersionInfo();
    loadThemeSettings();
    loadAutoLaunchSetting();
    loadSendShortcut();
    loadMessageNotificationSetting();
    loadSoundNotificationSetting();
    
    // 绑定开机自启动开关事件
    const autoLaunchToggle = document.getElementById('autoLaunchToggle');
    console.log('[Settings] 开机自启动开关元素:', autoLaunchToggle);
    if (autoLaunchToggle) {
        console.log('[Settings] 绑定开机自启动开关事件');
        autoLaunchToggle.addEventListener('change', (e) => {
            console.log('[Settings] 开机自启动开关变化:', e.target.checked);
            saveAutoLaunchSetting(e.target.checked);
        });
    } else {
        console.error('[Settings] 未找到开机自启动开关元素');
    }
    
    // 绑定消息通知开关事件
    const messageNotificationToggle = document.getElementById('messageNotificationToggle');
    console.log('[Settings] 消息通知开关元素:', messageNotificationToggle);
    if (messageNotificationToggle) {
        console.log('[Settings] 绑定消息通知开关事件');
        messageNotificationToggle.addEventListener('change', (e) => {
            console.log('[Settings] 消息通知开关变化:', e.target.checked);
            saveMessageNotificationSetting(e.target.checked);
        });
    } else {
        console.error('[Settings] 未找到消息通知开关元素');
    }
    
    // 绑定声音通知开关事件
    const soundNotificationToggle = document.getElementById('soundNotificationToggle');
    console.log('[Settings] 声音通知开关元素:', soundNotificationToggle);
    if (soundNotificationToggle) {
        console.log('[Settings] 绑定声音通知开关事件');
        soundNotificationToggle.addEventListener('change', (e) => {
            console.log('[Settings] 声音通知开关变化:', e.target.checked);
            saveSoundNotificationSetting(e.target.checked);
        });
    } else {
        console.error('[Settings] 未找到声音通知开关元素');
    }
    
    // 绑定发送快捷键选择事件
    const sendShortcutSelect = document.getElementById('sendShortcut');
    console.log('[Settings] 发送快捷键选择元素:', sendShortcutSelect);
    if (sendShortcutSelect) {
        console.log('[Settings] 绑定发送快捷键选择事件');
        sendShortcutSelect.addEventListener('change', (e) => {
            console.log('[Settings] 发送快捷键变化:', e.target.value);
            saveSendShortcut(e.target.value);
        });
    } else {
        console.error('[Settings] 未找到发送快捷键选择元素');
    }
    
    console.log('\n============================================');
    console.log('[Settings] 设置页面初始化完成');
    console.log('[Settings] 所有事件监听器已绑定');
    console.log('============================================\n');
});
