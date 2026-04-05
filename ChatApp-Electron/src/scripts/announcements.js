const axios = require('axios');
const API_BASE_URL = 'https://msg.v2.zhsdev.top/api';

// 返回上一页
function goBack() {
    window.history.back();
}

// 格式化日期
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// 获取类型名称
function getTypeName(type) {
    const types = {
        'notice': '通知',
        'important': '重要',
        'maintenance': '维护'
    };
    return types[type] || '通知';
}

// 加载公告列表
async function loadAnnouncements() {
    const listContainer = document.getElementById('announcementsList');
    
    try {
        const response = await axios.get(`${API_BASE_URL}/announcements/list`);
        const announcements = response.data;
        
        if (announcements.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📭</div>
                    <div class="empty-text">暂无公告</div>
                </div>
            `;
            return;
        }
        
        listContainer.innerHTML = announcements.map(announcement => `
            <div class="announcement-card">
                <div class="announcement-header">
                    <span class="announcement-type type-${announcement.type}">
                        ${getTypeName(announcement.type)}
                    </span>
                    <div class="announcement-title">${announcement.title}</div>
                </div>
                <div class="announcement-date">
                    ${formatDate(announcement.publishedAt || announcement.createdAt)}
                </div>
                <div class="announcement-content">${announcement.content}</div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('加载公告失败:', error);
        listContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">❌</div>
                <div class="empty-text">加载失败，请稍后重试</div>
            </div>
        `;
    }
}

// 页面加载完成后加载公告
document.addEventListener('DOMContentLoaded', loadAnnouncements);
