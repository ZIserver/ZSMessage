const apiService = require('../services/api');
const wsService = require('../services/websocket');
// E2E加密已移除，改用服务器端加密
const { ipcRenderer } = require('electron');

// 全局状态
let currentView = 'chats';
let currentChatUser = null;
let friendsList = [];
let chatsList = [];
let unreadMessages = new Map(); // 存储私聊未读消息数：userId -> count
let unreadGroupMessages = new Map(); // 存储群组未读消息数：groupId -> count

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  // 检查登录状态
  if (!apiService.currentUser) {
    window.location.href = 'login.html';
    return;
  }

  // 初始化主题
  initializeTheme();

  // 从后端刷新用户信息（包括头像）
  await refreshCurrentUserInfo();
  
  // 启动OAuth本地验证服务器（用于第三方登录）
  startOAuthLocalServer();
  
  initializeUI();
  loadWeather(); // 加载天气
  loadFriendsList();
  loadGroupsList(); // 加载群组列表
  loadPendingRequests();
  setupEventListeners();
  setupThemePanel(); // 设置主题面板事件
  
  // 请求通知权限
  requestNotificationPermission();
  
  // 连接WebSocket
  connectWebSocket();
  
  // 加载未读消息
  loadUnreadMessages();
  
  // 监听通话记录消息发送请求
  ipcRenderer.on('send-call-record-message', async (event, data) => {
    console.log('[Call Record] 收到通话记录发送请求:', data);
    try {
      const result = await apiService.sendMessage(
        apiService.currentUser.id,
        data.targetUserId,
        data.content,
        'CALL'
      );
      if (result.success) {
        console.log('[Call Record] 通话记录消息发送成功');
        // 如果当前正在和该用户聊天，刷新消息列表
        if (currentChatUser && currentChatUser.id === data.targetUserId) {
          loadMessageHistory(data.targetUserId);
        }
      } else {
        console.error('[Call Record] 通话记录消息发送失败:', result.error);
      }
    } catch (error) {
      console.error('[Call Record] 通话记录消息发送异常:', error);
    }
  });
  
  // 监听通话消息乐观更新（立即显示）
  ipcRenderer.on('call-message-optimistic-update', (event, data) => {
    console.log('[Chat] 收到通话消息乐观更新:', data);
    // 如果当前正在和该用户聊天，立即添加消息到UI
    if (currentChatUser && currentChatUser.id === data.targetUserId) {
      // 直接添加消息到当前UI，不等WebSocket推送
      const container = document.getElementById('messages-container');
      if (container && data.message) {
        const messageHtml = renderMessage(data.message);
        container.insertAdjacentHTML('beforeend', messageHtml);
        container.scrollTop = container.scrollHeight;
      }
    }
  });
  
  // 监听刷新聊天消息请求（通话结束后实时显示通话气泡）
  ipcRenderer.on('refresh-chat-messages', (event, data) => {
    console.log('[Chat] 收到刷新聊天消息请求:', data);
    // 如果当前正在和该用户聊天，刷新消息列表
    if (currentChatUser && currentChatUser.id === data.targetUserId) {
      loadMessageHistory(data.targetUserId);
    }
  });
});

// 启动OAuth本地验证服务器
function startOAuthLocalServer() {
  try {
    const user = apiService.currentUser;
    if (user) {
      ipcRenderer.send('start-oauth-server', {
        id: user.id,
        username: user.username,
        nickname: user.nickname || user.username,
        avatar: user.avatar
      });
      console.log('[OAuth] 已发送启动OAuth服务器请求');
    }
  } catch (error) {
    console.error('[OAuth] 启动OAuth服务器失败:', error);
  }
}

// 停止OAuth本地验证服务器
function stopOAuthLocalServer() {
  try {
    ipcRenderer.send('stop-oauth-server');
    console.log('[OAuth] 已发送停止OAuth服务器请求');
  } catch (error) {
    console.error('[OAuth] 停止OAuth服务器失败:', error);
  }
}

// 从后端刷新当前用户信息
async function refreshCurrentUserInfo() {
  try {
    const result = await apiService.getUserById(apiService.currentUser.id);
    if (result.success) {
      // 更新本地用户信息
      apiService.currentUser = {
        ...apiService.currentUser,
        ...result.data
      };
      
      // 更新 localStorage
      const authDataStr = localStorage.getItem('zsmessage_auth');
      if (authDataStr) {
        const authData = JSON.parse(authDataStr);
        authData.user = apiService.currentUser;
        localStorage.setItem('zsmessage_auth', JSON.stringify(authData));
      }
      
      console.log('[用户信息] 已从后端刷新,包括头像:', apiService.currentUser.avatar);
    }
  } catch (error) {
    console.error('[用户信息] 刷新失败:', error);
  }
}

// 初始化UI
function initializeUI() {
  const user = apiService.currentUser;
  const nickname = user.nickname || user.username;
  const firstChar = nickname.charAt(0).toUpperCase();

  document.getElementById('user-nickname').textContent = nickname;
  
  // 设置头像
  const userAvatar = document.getElementById('user-avatar');
  const profileAvatar = document.getElementById('profile-avatar');
  const titlebarAvatar = document.getElementById('titlebar-avatar');
  
  // 更新标题栏用户信息
  const titlebarNickname = document.getElementById('titlebar-nickname');
  const titlebarSignature = document.getElementById('titlebar-signature');
  if (titlebarNickname) titlebarNickname.textContent = nickname;
  if (titlebarSignature) titlebarSignature.textContent = user.bio || '这个人很懒，什么都没写~';
  
  if (user.avatar) {
    const avatarUrl = `${apiService.apiUrl}${user.avatar}`;
    
    // 左侧栏头像
    if (userAvatar) {
      userAvatar.style.backgroundImage = `url('${avatarUrl}')`;
      userAvatar.style.backgroundSize = 'cover';
      userAvatar.style.backgroundPosition = 'center';
      userAvatar.textContent = '';
    }
    
    // 个人资料头像
    if (profileAvatar) {
      profileAvatar.style.backgroundImage = `url('${avatarUrl}')`;
      profileAvatar.style.backgroundSize = 'cover';
      profileAvatar.style.backgroundPosition = 'center';
      profileAvatar.textContent = '';
    }
    
    // 标题栏头像
    if (titlebarAvatar) {
      titlebarAvatar.innerHTML = `<img src="${avatarUrl}" alt="">`;
    }
  } else {
    // 没有头像，显示首字母
    if (userAvatar) userAvatar.textContent = firstChar;
    if (profileAvatar) profileAvatar.textContent = firstChar;
    if (titlebarAvatar) titlebarAvatar.textContent = firstChar;
  }
  
  document.getElementById('profile-nickname').value = nickname;
  document.getElementById('profile-username').value = user.username;
  
  // 更新个人资料卡片头部显示
  const profileDisplayNickname = document.getElementById('profile-display-nickname');
  const profileDisplayUsername = document.getElementById('profile-display-username');
  const profileZsNumber = document.getElementById('profile-zs-number');
  if (profileDisplayNickname) profileDisplayNickname.textContent = nickname;
  if (profileDisplayUsername) profileDisplayUsername.textContent = user.username;
  if (profileZsNumber && user.zsNumber) profileZsNumber.textContent = user.zsNumber;
  
  // 智穗号复制按钮
  const copyZsBtn = document.getElementById('copy-zs-btn');
  if (copyZsBtn) {
    copyZsBtn.onclick = () => {
      if (user.zsNumber) {
        navigator.clipboard.writeText(user.zsNumber.toString()).then(() => {
          showToast('智穗号已复制', 'success');
        }).catch(() => {
          showToast('复制失败', 'error');
        });
      }
    };
  }
}

// 设置事件监听器
function setupEventListeners() {
  // ========== 标题栏窗口控制 ==========
  // 最小化按钮
  const btnMin = document.getElementById('btn-min');
  if (btnMin) {
    btnMin.addEventListener('click', () => {
      ipcRenderer.send('window-minimize');
    });
  }
  
  // 最大化/还原按钮
  const btnMax = document.getElementById('btn-max');
  if (btnMax) {
    btnMax.addEventListener('click', async () => {
      ipcRenderer.send('window-maximize');
      // 更新按钮图标
      const isMaximized = await ipcRenderer.invoke('window-is-maximized');
      if (isMaximized) {
        btnMax.innerHTML = '<i class="far fa-clone"></i>';
        btnMax.title = '还原';
      } else {
        btnMax.innerHTML = '<i class="far fa-square"></i>';
        btnMax.title = '最大化';
      }
    });
  }
  
  // 关闭按钮
  const btnClose = document.getElementById('btn-close');
  if (btnClose) {
    btnClose.addEventListener('click', () => {
      ipcRenderer.send('window-close');
    });
  }
  
  // 换肤按钮 - 打开主题选择面板
  const btnSkin = document.getElementById('btn-skin');
  if (btnSkin) {
    btnSkin.addEventListener('click', () => {
      openThemePanel();
    });
  }
  
  // 标题栏用户区域点击 - 跳转到个人资料
  const titlebarUser = document.getElementById('titlebar-user');
  if (titlebarUser) {
    titlebarUser.addEventListener('click', () => {
      switchView('profile');
    });
  }

  // 导航标签切换（排除公告和设置按钮）
  document.querySelectorAll('.nav-tab[data-view]').forEach(tab => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      try {
        const view = tab.dataset.view;
        switchView(view);
      } catch (error) {
        console.error('切换视图时出错:', error);
        showToast('切换视图失败', 'error');
      }
    });
  });

  // 公告按钮
  const announcementBtn = document.getElementById('announcement-btn');
  if (announcementBtn) {
    announcementBtn.addEventListener('click', () => {
      try {
        showLatestAnnouncement();
      } catch (error) {
        console.error('显示公告时出错:', error);
        showToast('获取公告失败', 'error');
      }
    });
  }

  // 管理员面板按钮
  const adminPanelBtn = document.getElementById('admin-panel-btn');
  if (adminPanelBtn) {
    adminPanelBtn.addEventListener('click', () => {
      try {
        openAdminPanel();
      } catch (error) {
        console.error('打开管理员面板时出错:', error);
        showToast('打开管理员面板失败', 'error');
      }
    });
  }

  // 设置按钮
  const settingsBtn = document.getElementById('settings-btn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      try {
        openSettings();
      } catch (error) {
        console.error('打开设置时出错:', error);
        showToast('打开设置失败', 'error');
      }
    });
  }

  // 搜索用户
  const searchUserBtn = document.getElementById('search-user-btn');
  if (searchUserBtn) {
    searchUserBtn.addEventListener('click', () => {
      try {
        searchUsers();
      } catch (error) {
        console.error('搜索用户时出错:', error);
        showToast('搜索用户失败', 'error');
      }
    });
  }
  
  const friendSearch = document.getElementById('friend-search');
  if (friendSearch) {
    friendSearch.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        try {
          searchUsers();
        } catch (error) {
          console.error('搜索用户时出错:', error);
          showToast('搜索用户失败', 'error');
        }
      }
    });
  }

  // 好友请求按钮（已移除）
  // document.getElementById('friend-requests-btn').addEventListener('click', showFriendRequests);

  // 个人资料表单
  const profileForm = document.getElementById('profile-form');
  if (profileForm) {
    profileForm.addEventListener('submit', (e) => {
      e.preventDefault();
      try {
        updateProfile(e);
      } catch (error) {
        console.error('更新资料时出错:', error);
        showToast('更新资料失败', 'error');
      }
    });
  }

  // 退出登录
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      try {
        logout();
      } catch (error) {
        console.error('退出登录时出错:', error);
        showToast('退出登录失败', 'error');
      }
    });
  }
  
  // 头像上传
  const changeAvatarBtn = document.getElementById('change-avatar-btn');
  if (changeAvatarBtn) {
    changeAvatarBtn.addEventListener('click', () => {
      try {
        document.getElementById('avatar-upload').click();
      } catch (error) {
        console.error('点击头像上传时出错:', error);
        showToast('上传头像失败', 'error');
      }
    });
  }
  
  const avatarUpload = document.getElementById('avatar-upload');
  if (avatarUpload) {
    avatarUpload.addEventListener('change', (e) => {
      try {
        handleAvatarUpload(e);
      } catch (error) {
        console.error('处理头像上传时出错:', error);
        showToast('上传头像失败', 'error');
      }
    });
  }
}

// 导航图标映射（用于切换选中/未选中状态）
const navIconMap = {
  'chats': 'fa-comment-dots',
  'contacts': 'fa-address-book',
  'profile': 'fa-user-circle'
};

// 切换视图
function switchView(view) {
  try {
    currentView = view;
    
    // 如果当前在群组聊天中，取消订阅该群组
    if (currentGroup && wsService.isConnected()) {
      wsService.unsubscribeFromGroup(currentGroup.id);
      currentGroup = null;
    }
    
    // 更新导航按钮状态和图标
    document.querySelectorAll('.nav-tab[data-view]').forEach(tab => {
      const tabView = tab.dataset.view;
      const icon = tab.querySelector('i');
      const isActive = tabView === view;
      
      tab.classList.toggle('active', isActive);
      
      // 切换图标样式：选中 fas，未选中 far
      if (icon && navIconMap[tabView]) {
        icon.className = `${isActive ? 'fas' : 'far'} ${navIconMap[tabView]}`;
      }
    });
    
    document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));
    document.getElementById(`${view}-view`).classList.add('active');

    // 加载对应数据
    if (view === 'contacts') {
      if (friendsList.length === 0) {
        loadFriendsList();
      }
      loadGroupsList();
      loadNotificationCounts();
    }
  } catch (error) {
    console.error('切换视图时出错:', error);
    showToast('切换视图失败', 'error');
  }
}

// 加载好友列表
async function loadFriendsList() {
  const result = await apiService.getFriendsList(apiService.currentUser.id);
  
  if (result.success) {
    friendsList = result.data;
    renderFriendsList(friendsList);
    renderChatsList(); // 同时更新聊天列表
  }
}

// 渲染好友列表
function renderFriendsList(friends) {
  const container = document.getElementById('friend-list');
  
  if (friends.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${getSVGIcon('users', 48)}</div>
        <p>暂无好友</p>
        <p class="text-small text-muted">搜索用户添加好友吧！</p>
      </div>
    `;
    return;
  }

  // 创建一个 Set 来跟踪已添加的用户 ID，避免重复
  const addedUserIds = new Set();
  
  container.innerHTML = friends.map(friend => {
    // 避免重复添加同一用户
    if (addedUserIds.has(friend.id)) {
      return '';
    }
    addedUserIds.add(friend.id);
    
    const name = friend.nickname || friend.username;
    const firstChar = name.charAt(0).toUpperCase();
    
    return `
      <div class="friend-item" data-user-id="${friend.id}">
        <div class="avatar">${firstChar}</div>
        <div class="friend-item-info">
          <div class="friend-item-header">
            <div class="friend-item-name">${name}</div>
          </div>
          <div class="friend-item-username">@${friend.username}</div>
        </div>
        <button class="btn btn-primary btn-small" onclick="openChat(${friend.id}, '${name}', '${firstChar}')">
          发消息
        </button>
      </div>
    `;
  }).filter(html => html !== '').join('');
}

// 渲染聊天列表（包含好友和群组）
async function renderChatsList() {
  const container = document.getElementById('chat-list');
  
  // 同时加载好友和群组
  const friends = friendsList || [];
  const groups = groupsList || [];
  
  if (friends.length === 0 && groups.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          <path d="M8 10h8M8 14h4"/>
        </svg>
        <p>暂无聊天</p>
        <p class="text-small text-muted">从联系人列表开始聊天吧！</p>
      </div>
    `;
    return;
  }

  let html = '';
  
  // 添加群组
  if (groups.length > 0) {
    html += groups.map(group => {
      const name = group.groupName;
      const firstChar = name.charAt(0).toUpperCase();
      
      // 获取群组未读消息数
      const unreadCount = unreadGroupMessages.get(group.id) || 0;
      const unreadBadge = unreadCount > 0 ? `<span class="unread-badge">${unreadCount > 99 ? '99+' : unreadCount}</span>` : '';
      
      return `
        <div class="chat-item group-chat" data-group-id="${group.id}" onclick="openGroupChat(${group.id})">
          <div class="avatar">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div class="chat-item-info">
            <div class="chat-item-header">
              <div class="chat-item-name">${name}</div>
              <div class="chat-item-time">刚刚</div>
            </div>
            <div class="chat-item-message">点击进入群聊...</div>
          </div>
          ${unreadBadge}
        </div>
      `;
    }).join('');
  }
  
  // 添加好友
  if (friends.length > 0) {
    // 创建一个 Set 来跟踪已添加的用户 ID，避免重复
    const addedUserIds = new Set();
    
    html += friends.map(friend => {
      // 避免重复添加同一用户
      if (addedUserIds.has(friend.id)) {
        return '';
      }
      addedUserIds.add(friend.id);
      
      const name = friend.nickname || friend.username;
      const firstChar = name.charAt(0).toUpperCase();
      
      // 判断是否有头像
      const hasAvatar = friend.avatar && friend.avatar.trim() !== '';
      const avatarHtml = hasAvatar 
        ? `<div class="avatar" style="background-image: url('${apiService.apiUrl}${friend.avatar}'); background-size: cover; background-position: center;"></div>`
        : `<div class="avatar">${firstChar}</div>`;
      
      // 获取未读消息数
      const unreadCount = unreadMessages.get(friend.id) || 0;
      const unreadBadge = unreadCount > 0 ? `<span class="unread-badge">${unreadCount > 99 ? '99+' : unreadCount}</span>` : '';
      
      return `
        <div class="chat-item" data-user-id="${friend.id}" onclick="openChat(${friend.id}, '${name}', '${firstChar}', ${hasAvatar ? `'${friend.avatar}'` : 'null'})">
          ${avatarHtml}
          <div class="chat-item-info">
            <div class="chat-item-header">
              <div class="chat-item-name">${name}</div>
              <div class="chat-item-time">刚刚</div>
            </div>
            <div class="chat-item-message">点击开始聊天...</div>
          </div>
          ${unreadBadge}
        </div>
      `;
    }).filter(html => html !== '').join(''); // 过滤掉空的HTML片段
  }
  
  container.innerHTML = html;
}

// 搜索用户
async function searchUsers() {
  const keyword = document.getElementById('friend-search').value.trim();
  
  if (!keyword) {
    showToast('请输入搜索关键词', 'warning');
    return;
  }

  const result = await apiService.searchUsers(keyword);
  
  if (result.success) {
    renderSearchResults(result.data);
  } else {
    showToast(result.error, 'error');
  }
}

// 渲染搜索结果
function renderSearchResults(users) {
  const container = document.getElementById('friend-list');
  
  if (users.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${getSVGIcon('search', 48)}</div>
        <p>未找到用户</p>
      </div>
    `;
    return;
  }

  const filteredUsers = users.filter(u => u.id !== apiService.currentUser.id);
  
  container.innerHTML = filteredUsers.map(user => {
    const name = user.nickname || user.username;
    const firstChar = name.charAt(0).toUpperCase();
    const isFriend = friendsList.some(f => f.id === user.id);
    
    return `
      <div class="friend-item">
        <div class="avatar">${firstChar}</div>
        <div class="friend-item-info">
          <div class="friend-item-header">
            <div class="friend-item-name">${name}</div>
          </div>
          <div class="friend-item-username">@${user.username}</div>
        </div>
        ${isFriend 
          ? '<span class="text-muted text-small">已是好友</span>'
          : `<button class="btn btn-primary btn-small" onclick="sendFriendRequest(${user.id}, '${name}')">添加好友</button>`
        }
      </div>
    `;
  }).join('');
}

// 发送好友请求
async function sendFriendRequest(friendId, friendName) {
  const result = await apiService.sendFriendRequest(
    apiService.currentUser.id,
    friendId,
    '你好，我想添加你为好友'
  );
  
  if (result.success) {
    showToast(`好友请求已发送给 ${friendName}`, 'success');
    // 重新搜索以更新按钮状态
    const keyword = document.getElementById('friend-search').value.trim();
    if (keyword) {
      searchUsers();
    }
  } else {
    showToast(result.error, 'error');
  }
}

// 加载待处理请求
async function loadPendingRequests() {
  const result = await apiService.getPendingRequests(apiService.currentUser.id);
  
  if (result.success) {
    const count = result.data.length;
    const requestCountElement = document.getElementById('request-count');
    if (requestCountElement) {
      requestCountElement.textContent = count;
    }
  }
}

// 显示好友请求列表
async function showFriendRequests() {
  const result = await apiService.getPendingRequests(apiService.currentUser.id);
  
  if (!result.success) {
    showToast(result.error, 'error');
    return;
  }

  const requests = result.data;
  const container = document.getElementById('friend-list');
  
  if (requests.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${getSVGIcon('inbox', 48)}</div>
        <p>暂无好友请求</p>
      </div>
    `;
    return;
  }

  // 获取所有发送者的用户信息
  const requestsWithUserInfo = [];
  for (const req of requests) {
    const userResult = await apiService.getUserById(req.userId);
    if (userResult.success) {
      requestsWithUserInfo.push({
        ...req,
        senderUser: userResult.data
      });
    }
  }

  container.innerHTML = requestsWithUserInfo.map(req => {
    const senderName = req.senderUser.nickname || req.senderUser.username;
    const firstChar = senderName.charAt(0).toUpperCase();
    
    return `
      <div class="card">
        <div class="flex gap-10">
          <div class="avatar">${firstChar}</div>
          <div class="flex-1">
            <div class="friend-item-name">${senderName}</div>
            <div class="text-small text-muted">@${req.senderUser.username}</div>
            <div class="text-small text-muted mt-10">${req.requestMessage || '想添加你为好友'}</div>
            <div class="flex gap-10 mt-10">
              <button class="btn btn-success btn-small" onclick="acceptRequest(${req.id})">接受</button>
              <button class="btn btn-secondary btn-small" onclick="rejectRequest(${req.id})">拒绝</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// 接受好友请求
async function acceptRequest(requestId) {
  const result = await apiService.acceptFriendRequest(requestId, apiService.currentUser.id);
  
  if (result.success) {
    showToast('已接受好友请求', 'success');
    loadFriendsList();
    loadPendingRequests();
  } else {
    showToast(result.error, 'error');
  }
}

// 拒绝好友请求
async function rejectRequest(requestId) {
  const result = await apiService.rejectFriendRequest(requestId, apiService.currentUser.id);
  
  if (result.success) {
    showToast('已拒绝好友请求', 'success');
    showFriendRequests();
    loadPendingRequests();
  } else {
    showToast(result.error, 'error');
  }
}

// 打开聊天窗口
async function openChat(userId, userName, userAvatar, avatarUrl = null) {
  try {
    currentChatUser = { id: userId, name: userName, avatar: userAvatar, avatarUrl: avatarUrl };
    
    // 清除该用户的未读消息
    clearUnreadMessages(userId);
    // 立即刷新聊天列表，清除红点
    renderChatsList();
    
    // 标记数据库中的消息为已读
    apiService.markChatAsRead(userId, apiService.currentUser.id).then(result => {
      if (result.success) {
        console.log(`[已读标记] 已将来自用户 ${userId} 的 ${result.data.count} 条消息标记为已读`);
      }
    });
    
    // 高亮选中的聊天
    document.querySelectorAll('.chat-item').forEach(item => item.classList.remove('active'));
    document.querySelector(`.chat-item[data-user-id="${userId}"]`)?.classList.add('active');
    
    // 生成头像 HTML
    const hasAvatar = avatarUrl && avatarUrl.trim() !== '';
    const avatarHtml = hasAvatar
      ? `<div class="avatar" style="background-image: url('${apiService.apiUrl}${avatarUrl}'); background-size: cover; background-position: center;"></div>`
      : `<div class="avatar">${userAvatar}</div>`;
    
    // 显示聊天界面
    const chatDetail = document.getElementById('chat-detail');
    if (!chatDetail) {
      console.error('聊天详情容器不存在');
      return;
    }
    
    chatDetail.innerHTML = `
      <div class="chat-detail-header">
        <button class="back-btn" onclick="closeMobileChat()">←</button>
        <div class="chat-detail-user">
          ${avatarHtml}
          <div>
            <div class="chat-detail-user-name">${userName}</div>
            <div class="chat-detail-user-status online">在线</div>
          </div>
        </div>
        <div class="chat-detail-actions">
          <button class="action-btn" id="voice-call-btn" data-user-id="${userId}" data-user-name="${userName.replace(/"/g, '&quot;')}" title="语音通话">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
            </svg>
          </button>
          <button class="action-btn" id="video-call-btn" data-user-id="${userId}" data-user-name="${userName.replace(/"/g, '&quot;')}" title="视频通话">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="23 7 16 12 23 17 23 7"/>
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="messages-container" id="messages-container">
        <div class="empty-state">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            <path d="M8 10h8M8 14h4"/>
          </svg>
          <p>暂无消息</p>
        </div>
      </div>
      <div class="message-input-container">
        <div class="message-input-toolbar">
          <button class="toolbar-btn" title="表情">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>
            </svg>
          </button>
          <button class="toolbar-btn" id="file-btn" title="文件">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
              <polyline points="13 2 13 9 20 9"/>
            </svg>
          </button>
          <button class="toolbar-btn" id="image-btn" title="图片">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
          </button>
          <button class="toolbar-btn" id="video-btn" title="视频">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="23 7 16 12 23 17 23 7"/>
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
            </svg>
          </button>
          <button class="toolbar-btn" id="translate-btn" title="翻译">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10 19H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"/>
              <polyline points="17 17 12 12 7 17"/>
              <polyline points="17 7 12 12 7 7"/>
              <line x1="12" y1="2" x2="12" y2="12"/>
            </svg>
          </button>
          <input type="file" id="file-input" style="display:none" accept="*/*">
          <input type="file" id="image-input" style="display:none" accept="image/*">
          <input type="file" id="video-input" style="display:none" accept="video/*">
        </div>
        <div class="message-input-box">
          <textarea class="message-input" id="message-input" placeholder="输入消息..." rows="3"></textarea>
          <button class="btn btn-primary send-btn" onclick="sendMessage()">发送</button>
        </div>
      </div>
    `;
    
    // 加载历史消息
    loadMessageHistory(userId);
    
    // 小屏幕下切换到聊天视图
    if (window.innerWidth <= 600) {
      chatDetail.classList.add('mobile-active');
    } else {
      // 只有在当前不在聊天视图时才切换
      if (currentView !== 'chats') {
        switchView('chats');
      }
    }
    
    // 绑定文件选择按钮事件
    setTimeout(() => {
      try {
        // 通话按钮
        const voiceCallBtn = document.getElementById('voice-call-btn');
        const videoCallBtn = document.getElementById('video-call-btn');
        
        if (voiceCallBtn) {
          voiceCallBtn.onclick = () => {
            try {
              const uid = parseInt(voiceCallBtn.dataset.userId);
              const uname = voiceCallBtn.dataset.userName;
              startVoiceCall(uid, uname);
            } catch (error) {
              console.error('语音通话启动失败:', error);
              showToast('语音通话启动失败', 'error');
            }
          };
        }
        
        if (videoCallBtn) {
          videoCallBtn.onclick = () => {
            try {
              const uid = parseInt(videoCallBtn.dataset.userId);
              const uname = videoCallBtn.dataset.userName;
              startVideoCall(uid, uname);
            } catch (error) {
              console.error('视频通话启动失败:', error);
              showToast('视频通话启动失败', 'error');
            }
          };
        }
        
        // 文件按钮
        const fileBtn = document.getElementById('file-btn');
        const imageBtn = document.getElementById('image-btn');
        const videoBtn = document.getElementById('video-btn');
        const fileInput = document.getElementById('file-input');
        const imageInput = document.getElementById('image-input');
        const videoInput = document.getElementById('video-input');
        
        console.log('[File] 初始化文件按钮:', {
          fileBtn: !!fileBtn,
          imageBtn: !!imageBtn,
          videoBtn: !!videoBtn,
          fileInput: !!fileInput,
          imageInput: !!imageInput,
          videoInput: !!videoInput
        });
        
        if (fileBtn && fileInput) {
          fileBtn.onclick = () => {
            console.log('[File] 文件按钮被点击');
            try {
              fileInput.click();
            } catch (error) {
              console.error('打开文件选择器失败:', error);
              showToast('打开文件选择器失败', 'error');
            }
          };
          fileInput.onchange = async (e) => {
            console.log('[File] 文件 input onchange 触发');
            try {
              await handleFileSelect(fileInput, 'file');
            } catch (error) {
              console.error('处理文件选择失败:', error);
              showToast('处理文件选择失败', 'error');
            }
          };
        } else {
          console.error('[File] 文件按钮或input未找到');
        }
        
        if (imageBtn && imageInput) {
          imageBtn.onclick = () => {
            console.log('[File] 图片按钮被点击');
            try {
              imageInput.click();
            } catch (error) {
              console.error('打开图片选择器失败:', error);
              showToast('打开图片选择器失败', 'error');
            }
          };
          imageInput.onchange = async (e) => {
            console.log('[File] 图片 input onchange 触发');
            try {
              await handleFileSelect(imageInput, 'image');
            } catch (error) {
              console.error('处理图片选择失败:', error);
              showToast('处理图片选择失败', 'error');
            }
          };
        } else {
          console.error('[File] 图片按钮或input未找到');
        }
        
        if (videoBtn && videoInput) {
          videoBtn.onclick = () => {
            console.log('[File] 视频按钮被点击');
            try {
              videoInput.click();
            } catch (error) {
              console.error('打开视频选择器失败:', error);
              showToast('打开视频选择器失败', 'error');
            }
          };
          videoInput.onchange = async (e) => {
            console.log('[File] 视频 input onchange 触发');
            try {
              await handleFileSelect(videoInput, 'video');
            } catch (error) {
              console.error('处理视频选择失败:', error);
              showToast('处理视频选择失败', 'error');
            }
          };
        } else {
          console.error('[File] 视频按钮或input未找到');
        }
        
        // 翻译按钮
        const translateBtn = document.getElementById('translate-btn');
        if (translateBtn) {
          translateBtn.onclick = (e) => {
            try {
              const input = document.getElementById('message-input');
              if (!input) {
                showToast('❌ 消息输入框不存在', 'error');
                return;
              }
              
              const content = input.value.trim();
              if (!content) {
                showToast('⚠️ 请先输入要翻译的内容', 'warning');
                return;
              }
              
              showLanguageSelectionDialog(content, true); // 传递标志表示来自输入框
            } catch (error) {
              console.error('翻译功能启动失败:', error);
              showToast('翻译功能启动失败', 'error');
            }
          };
        }
        
        // 绑定输入框快捷键
        const messageInput = document.getElementById('message-input');
        if (messageInput) {
          messageInput.addEventListener('keydown', (e) => {
            try {
              handleMessageInputKeydown(e);
            } catch (error) {
              console.error('处理按键事件失败:', error);
              showToast('处理按键事件失败', 'error');
            }
          });
        }
      } catch (error) {
        console.error('绑定聊天界面事件失败:', error);
        showToast('绑定聊天界面事件失败', 'error');
      }
    }, 100);
  } catch (error) {
    console.error('打开聊天窗口失败:', error);
    showToast('打开聊天窗口失败', 'error');
  }
}

// 加载消息历史
async function loadMessageHistory(friendId) {
  const result = await apiService.getMessageHistory(apiService.currentUser.id, friendId);
  
  if (result.success && result.data.length > 0) {
    renderMessages(result.data);
  }
}

// 渲染消息
function renderMessages(messages) {
  const container = document.getElementById('messages-container');
  
  container.innerHTML = messages.map(msg => {
    const isSent = msg.senderId === apiService.currentUser.id;
    const time = new Date(msg.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    
    if (msg.isRecalled) {
      return `
        <div class="message-group ${isSent ? 'sent' : 'received'}">
          <div class="message-content">
            <div class="message-bubble recalled">消息已撤回</div>
          </div>
        </div>
      `;
    }
    
    // 判断是否为文件消息、引用消息、聊天记录或通话消息（内容以 { 开头）
    if (msg.content && msg.content.trim().startsWith('{')) {
      try {
        const data = JSON.parse(msg.content);
        if (data.type === 'quote') {
          // 引用消息
          return renderQuoteMessage(msg, isSent, data);
        } else if (data.type === 'chat_history') {
          // 聊天记录卡片
          return renderChatHistoryCard(msg, isSent, data);
        } else if (data.callType === 'call') {
          // 通话消息
          return renderCallMessage(msg, isSent, data);
        } else if (data.mediaType) {
          // 文件消息
          return renderFileMessage(msg, isSent);
        }
      } catch (e) {
        // 不是JSON，继续按文本消息处理
      }
    }
    
    // XSS防护：转义消息内容（后端已转义，这里确保安全显示）
    const safeContent = LinkUtil.processContent(msg.content);
    
    // 生成头像 HTML
    const hasAvatar = currentChatUser.avatarUrl && currentChatUser.avatarUrl.trim() !== '';
    const friendAvatarHtml = hasAvatar
      ? `<div class="avatar avatar-small" style="background-image: url('${apiService.apiUrl}${currentChatUser.avatarUrl}'); background-size: cover; background-position: center;"></div>`
      : `<div class="avatar avatar-small">${currentChatUser.avatar}</div>`;
    
    // 自己的头像（检查 apiService.currentUser.avatar 是否为 URL）
    const hasMyAvatar = apiService.currentUser.avatar && apiService.currentUser.avatar.startsWith('/');
    const myAvatarHtml = hasMyAvatar
      ? `<div class="avatar avatar-small" style="background-image: url('${apiService.apiUrl}${apiService.currentUser.avatar}'); background-size: cover; background-position: center;"></div>`
      : `<div class="avatar avatar-small">${apiService.currentUser.nickname?.charAt(0).toUpperCase()}</div>`;
    
    return `
      <div class="message-group ${isSent ? 'sent' : 'received'}" 
           data-message-id="${msg.id}" 
           data-is-sent="${isSent}">
        ${!isSent ? friendAvatarHtml : ''}
        <div class="message-content">
          <div class="message-time">${time}</div>
          <div class="message-bubble ${isSent ? 'sent' : 'received'}" 
               data-msg-id="${msg.id}" 
               data-is-sent="${isSent}">${safeContent}</div>
        </div>
        ${isSent ? myAvatarHtml : ''}
      </div>
    `;
  }).join('');
  
  // 添加右键事件监听
  container.querySelectorAll('.message-bubble, .chat-history-card').forEach(bubble => {
    bubble.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      const messageId = parseInt(bubble.dataset.msgId);
      const isSent = bubble.dataset.isSent === 'true';
      
      // 获取消息内容
      let messageContent = '';
      if (bubble.dataset.content) {
        // 引用消息或聊天记录卡片
        messageContent = bubble.dataset.content;
      } else {
        // 普通消息
        messageContent = bubble.textContent.trim();
      }
      
      console.log('[右键菜单] 消息ID:', messageId, '内容:', messageContent, '是否发送:', isSent);
      
      showContextMenu(event, messageId, messageContent, isSent);
    });
  });
  
  // 滚动到底部（使用setTimeout确保渲染完成）
  setTimeout(() => {
    container.scrollTop = container.scrollHeight;
  }, 100);
}

// 发送消息
async function sendMessage() {
  try {
    const input = document.getElementById('message-input');
    if (!input) {
      console.error('消息输入框不存在');
      return;
    }
    
    const content = input.value.trim();
    
    if (!content || !currentChatUser) return;
    
    // 检查是否有引用
    let messageContent = content;
    if (input.dataset.quoteData) {
      const quoteData = JSON.parse(input.dataset.quoteData);
      messageContent = JSON.stringify({
        type: 'quote',
        quoteMessageId: quoteData.messageId,
        quoteContent: quoteData.content,
        content: content
      });
    }
    
    const result = await apiService.sendMessage(
      apiService.currentUser.id,
      currentChatUser.id,
      messageContent
    );
    
    if (result.success) {
      input.value = '';
      cancelQuote(); // 清除引用
      loadMessageHistory(currentChatUser.id);
    } else {
      showToast(result.error, 'error');
    }
  } catch (error) {
    console.error('发送消息时出错:', error);
    showToast('发送消息失败', 'error');
  }
}

// 处理输入框快捷键
function handleMessageInputKeydown(e) {
  const sendShortcut = localStorage.getItem('sendShortcut') || 'Enter';
  
  if (sendShortcut === 'Enter') {
    // Enter键直接发送，Shift+Enter换行
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  } else if (sendShortcut === 'Ctrl+Enter') {
    // Ctrl+Enter发送，Enter换行
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      sendMessage();
    }
  }
}

// 更新个人资料
async function updateProfile(e) {
  e.preventDefault();
  
  const nickname = document.getElementById('profile-nickname').value.trim();
  const bio = document.getElementById('profile-bio').value.trim();
  
  if (!nickname) {
    showToast('请输入昵称', 'warning');
    return;
  }
  
  const result = await apiService.updateProfile(apiService.currentUser.id, { nickname, bio });
  
  if (result.success) {
    apiService.currentUser.nickname = nickname;
    apiService.currentUser.bio = bio;
    
    // 更新 localStorage
    const authDataStr = localStorage.getItem('zsmessage_auth');
    if (authDataStr) {
      const authData = JSON.parse(authDataStr);
      authData.user.nickname = nickname;
      authData.user.bio = bio;
      localStorage.setItem('zsmessage_auth', JSON.stringify(authData));
    }
    
    initializeUI();
    showToast('资料更新成功', 'success');
  } else {
    showToast(result.error, 'error');
  }
}

// 处理头像上传
async function handleAvatarUpload(e) {
  try {
    const file = e.target.files[0];
    
    if (!file) {
      return;
    }
    
    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      showToast('请选择图片文件', 'error');
      e.target.value = ''; // 清空
      return;
    }
    
    // 验证文件大小 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      showToast('图片大小不能超过5MB', 'error');
      e.target.value = '';
      return;
    }
    
    showToast('正在上传头像...', 'info');
    
    // 创建 FormData
    const formData = new FormData();
    formData.append('file', file);
    
    // 上传头像（需要带 Token）
    const response = await fetch(`${apiService.baseURL}/users/${apiService.currentUser.id}/avatar`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiService.authToken}`
      },
      body: formData
    });
    
    const result = await response.json();
    
    if (result.success) {
      showToast('头像上传成功', 'success');
      
      // 更新头像显示
      const avatarUrl = `${apiService.apiUrl}${result.avatarUrl}`;
      
      // 更新个人资料头像
      const profileAvatar = document.getElementById('profile-avatar');
      if (profileAvatar) {
        profileAvatar.style.backgroundImage = `url('${avatarUrl}')`;
        profileAvatar.style.backgroundSize = 'cover';
        profileAvatar.style.backgroundPosition = 'center';
        profileAvatar.textContent = ''; // 清空文字
      }
      
      // 更新左侧栏头像
      const userAvatar = document.getElementById('user-avatar');
      if (userAvatar) {
        userAvatar.style.backgroundImage = `url('${avatarUrl}')`;
        userAvatar.style.backgroundSize = 'cover';
        userAvatar.style.backgroundPosition = 'center';
        userAvatar.textContent = '';
      }
      
      // 更新用户信息
      apiService.currentUser.avatar = result.avatarUrl;
      
      // 更新 localStorage
      const authDataStr = localStorage.getItem('zsmessage_auth');
      if (authDataStr) {
        const authData = JSON.parse(authDataStr);
        authData.user.avatar = result.avatarUrl;
        localStorage.setItem('zsmessage_auth', JSON.stringify(authData));
      }
    } else {
      showToast(result.error || '头像上传失败', 'error');
    }
  } catch (error) {
    console.error('头像上传失败:', error);
    showToast('头像上传失败', 'error');
  }
  
  // 清空 input
  e.target.value = '';
}

// 连接WebSocket
async function connectWebSocket() {
  try {
    await wsService.connect(
      apiService.currentUser.id, 
      handleIncomingMessage,
      handleGroupMessage,
      handleCallSignal,  // 添加通话信令回调
      handleSystemMessage  // 添加系统消息回调
    );
    console.log('[Chat] WebSocket connected successfully');

    
    // 监听从通话窗口转发的信令
    ipcRenderer.on('send-call-signal', (event, data) => {
      console.log('[Chat] Sending call signal:', data.type);
      
      // 根据类型调用对应的发送方法
      switch (data.type) {
        case 'invite':
          wsService.sendCallInvite(data);
          break;
        case 'answer':
          wsService.sendCallAnswer(data);
          break;
        case 'offer':
          wsService.sendOffer(data);
          break;
        case 'sdp-answer':
          wsService.sendSdpAnswer(data);
          break;
        case 'ice-candidate':
          wsService.sendIceCandidate(data);
          break;
        case 'hangup':
          wsService.sendHangup(data);
          break;
        case 'media-state':
          wsService.sendMediaState(data);
          break;
        default:
          console.warn('[Chat] Unknown call signal type:', data.type);
      }
    });
  } catch (error) {
    console.error('[Chat] WebSocket connection failed:', error);
    showToast('\u26a0\ufe0f 实时消息连接失败', 'warning');
  }
}

// 处理通话信令
function handleCallSignal(signal) {
  console.log('[Chat] Received call signal:', signal.type);
  
  if (signal.type === 'invite') {
    // 收到来电
    handleIncomingCall(signal);
  } else {
    // 其他信令转发到通话窗口
    ipcRenderer.send('call-signal-to-window', signal);
  }
}

// 处理来电
function handleIncomingCall(signal) {
  // 获取发起方信息
  const callerId = signal.callerId;
  const callType = signal.callType || 'video';
  
  // 查找发起方的昵称
  let callerName = '用户';
  const friend = friendsList.find(f => f.id == callerId);
  if (friend) {
    callerName = friend.nickname || friend.username;
  }
  
  // 弹出来电窗口
  ipcRenderer.send('incoming-call', {
    callerId: callerId,
    targetUserId: apiService.currentUser.id,
    callerName: callerName,
    callType: callType,
    isIncoming: true
  });
}

// 发起语音通话
function startVoiceCall(userId, userName) {
  console.log('[Chat] Starting voice call to:', userId, userName);
  
  ipcRenderer.send('start-call', {
    callerId: apiService.currentUser.id,
    targetUserId: userId,
    callerName: userName,
    callType: 'voice',
    isIncoming: false
  });
}

// 发起视频通话
function startVideoCall(userId, userName) {
  console.log('[Chat] Starting video call to:', userId, userName);
  
  const callData = {
    callerId: apiService.currentUser.id,
    targetUserId: userId,
    callerName: userName,
    callType: 'video',
    isIncoming: false
  };
  
  console.log('[Chat] Call data:', callData);
  
  ipcRenderer.send('start-call', callData);
  
  console.log('[Chat] start-call IPC sent');
}

// 处理系统消息
function handleSystemMessage(systemMessage) {
  console.log('[Chat] System message received:', systemMessage);
  
  // 提取消息内容 - 兼容不同可能的字段名
  const messageType = systemMessage.messageType || systemMessage.type;
  const messageContent = systemMessage.messageContent || systemMessage.content;
  const reason = systemMessage.reason;
  
  // 根据消息类型显示不同类型的提示
  switch (messageType) {
    case 'BAN':
      const banMessage = reason ? `⚠️ 您已被管理员封禁，原因：${reason}` : '⚠️ 您已被管理员封禁';
      showToast(banMessage, 'error');
      
      // 显示更明确的封禁通知
      showWindowsNotification('账户封禁通知', reason || '您已被管理员封禁', 'system');
      
      // 如果是封禁消息，显示封禁信息并提供申诉指引
      setTimeout(() => {
        const result = confirm('您已被管理员封禁，建议退出登录。\n\n如需申诉，请访问官网：message.zhsidc.com/appeal\n\n是否现在退出登录？');
        if (result) {
          logout();
        }
      }, 1000);
      break;
    case 'WARN':
      const warnMessage = reason ? `⚠️ 系统警告：${reason}` : '⚠️ 您收到了管理员的警告';
      showToast(warnMessage, 'warning');
      
      // 显示警告通知
      showWindowsNotification('系统警告', reason || '您收到了管理员的警告', 'system');
      break;
    case 'DELETE':
      const deleteMessage = reason ? `⚠️ 账户提醒：${reason}` : '⚠️ 您的账户已被删除';
      showToast(deleteMessage, 'error');
      
      // 显示删除账户通知
      showWindowsNotification('账户删除通知', reason || '您的账户已被删除', 'system');
      
      // 如果是删除账户消息，引导用户登出
      setTimeout(() => {
        if (confirm('您的账户已被删除，即将退出登录。\n\n如有疑问，请访问官网进行咨询或申诉：message.zhsidc.com/appeal')) {
          logout();
        }
      }, 1000);
      break;
    case 'INFO':
      const infoMessage = messageContent || reason || '您收到了一条系统通知';
      showToast(`ℹ️ ${infoMessage}`, 'info');
      
      // 显示信息通知
      showWindowsNotification('系统通知', infoMessage, 'system');
      
      // 检查是否为解封通知
      if (infoMessage.includes('申诉已获批准') || infoMessage.includes('解除封禁')) {
        // 重新登录以刷新用户状态
        showToast('🎉 您的账户已被解封，可以重新登录！', 'success');
        setTimeout(() => {
          if (confirm('您的账户已被解封，是否重新登录？')) {
            logout();
            // 可以选择自动重新登录
            // window.location.href = 'login.html';
          }
        }, 2000);
      }
      break;
    default:
      const defaultMessage = messageContent || '您有一条新的系统通知';
      showToast(`📢 系统通知：${defaultMessage}`, 'info');
      showWindowsNotification('系统通知', defaultMessage, 'system');
      break;
  }
  
  // 显示桌面通知
  if (!messageType || !(messageType === 'BAN' || messageType === 'WARN' || messageType === 'DELETE')) {
    showWindowsNotification('系统通知', messageContent || '您有一条新的系统通知', 'system');
  }
}

// 打开管理员面板
function openAdminPanel() {
  // 使用IPC调用主进程打开管理员面板窗口
  const { ipcRenderer } = require('electron');
  ipcRenderer.send('open-admin-panel');
}

// 暴露到全局
window.startVoiceCall = startVoiceCall;
window.startVideoCall = startVideoCall;
window.handleSystemMessage = handleSystemMessage;
window.openAdminPanel = openAdminPanel;

// 确保XssUtil可用
if (typeof XssUtil === 'undefined') {
  window.XssUtil = {
    sanitize: function(str) {
      if (!str) return str;
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
    }
  };
}

/**
 * 链接解析工具 - 将纯文本中的URL转换为可点击的链接
 * 支持所有域名后缀（.com, .cn, .top, .asia, .icu 等）
 */
const LinkUtil = {
  /**
   * 将文本中的URL转换为可点击链接
   * @param {string} text - 输入文本（已经XSS过滤）
   * @returns {string} - 包含链接的HTML
   */
  linkify: function(text) {
    if (!text) return text;
    
    // 更宽松的URL正则表达式
    // 匹配模式:
    // 1. https://xxx.xxx 或 http://xxx.xxx (带协议)
    // 2. www.xxx.xxx (www开头)
    // 3. xxx.xxx (域名格式)
    const urlRegex = /(https?:\/\/)?([a-zA-Z0-9][a-zA-Z0-9-]*\.)*[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}([a-zA-Z0-9-]*\.)*[a-zA-Z]{2,}(\/[^\s<>())"'\]\[]*)?/gi;
    
    return text.replace(urlRegex, function(url) {
      let href = url;
      // 如果没有协议，添加 https://
      if (!url.match(/^https?:\/\//i)) {
        href = 'https://' + url;
      }
      return `<a href="${href}" class="message-link" onclick="event.stopPropagation();window.openLink('${href}');return false;" title="点击打开链接">${url}</a>`;
    });
  },
  
  /**
   * 安全地处理消息内容：先XSS过滤，再转换链接
   * @param {string} content - 原始消息内容
   * @returns {string} - 安全且包含链接的HTML
   */
  processContent: function(content) {
    if (!content) return content;
    // 先XSS过滤
    let safe = XssUtil.sanitize(content);
    // 再转换链接
    return this.linkify(safe);
  }
};

/**
 * 渲染群组文件消息
 */
function renderGroupFileMessage(msg, sender, groupId, currentUserRole) {
  try {
    // 解码HTML实体（处理后端的&quot;转义）
    let content = msg.content;
    if (content.includes('&quot;')) {
      content = content.replace(/&quot;/g, '"')
                      .replace(/&amp;/g, '&')
                      .replace(/&lt;/g, '<')
                      .replace(/&gt;/g, '>')
                      .replace(/&#x27;/g, "'");
    }
    
    const fileData = JSON.parse(content);
    const time = new Date(msg.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    
    // 文件URL（从服务器获取）
    const fileUrl = fileData.url || '';
    
    // 获取发送者信息
    const senderName = sender ? (sender.nickname || sender.username) : '用户';
    const senderAvatar = sender?.avatar;
    const firstChar = senderName.charAt(0).toUpperCase();
    
    // 生成头像 HTML - 添加右键菜单支持
    const isMine = msg.senderId === apiService.currentUser.id;
    let avatarHtml;
    if (isMine) {
      // 自己的头像
      const hasMyAvatar = apiService.currentUser.avatar && apiService.currentUser.avatar.startsWith('/');
      avatarHtml = hasMyAvatar
        ? `<div class="avatar avatar-small message-avatar" data-user-id="${msg.senderId}" style="background-image: url('${apiService.apiUrl}${apiService.currentUser.avatar}'); background-size: cover; background-position: center;" data-group-id="${groupId}"></div>`
        : `<div class="avatar avatar-small message-avatar" data-user-id="${msg.senderId}" data-group-id="${groupId}">${apiService.currentUser.nickname?.charAt(0).toUpperCase()}</div>`;
    } else {
      // 其他成员的头像
      const hasAvatar = senderAvatar && senderAvatar.trim() !== '';
      avatarHtml = hasAvatar
        ? `<div class="avatar avatar-small message-avatar" data-user-id="${msg.senderId}" style="background-image: url('${apiService.apiUrl}${senderAvatar}'); background-size: cover; background-position: center;" data-group-id="${groupId}"></div>`
        : `<div class="avatar avatar-small message-avatar" data-user-id="${msg.senderId}" data-group-id="${groupId}">${firstChar}</div>`;
    }
    
    if (fileData.mediaType === 'image') {
      return `
        <div class="message-group ${isMine ? 'sent' : 'received'}" data-message-id="${msg.id}" data-group-id="${groupId}">
          ${!isMine ? avatarHtml : ''}
          <div class="message-content">
            ${!isMine ? `<div class="message-sender">${XssUtil.sanitize(senderName)}</div>` : ''}
            <div class="message-time">${time}</div>
            <div class="message-bubble ${isMine ? 'sent' : 'received'} image-message"
                 data-message-id="${msg.id}"
                 data-group-id="${groupId}"
                 data-sender-id="${msg.senderId}"
                 data-is-group="true"
                 data-content='${escapeHtml(content)}'
                 onclick="openMediaViewer('${fileUrl}', 'image', '${escapeHtml(fileData.name)}')">
              <img src="${fileUrl}" alt="${escapeHtml(fileData.name)}" class="message-image"
                   onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22%3E🖼️%3C/text%3E%3C/svg%3E'">
            </div>
          </div>
          ${isMine ? avatarHtml : ''}
        </div>
      `;
    } else if (fileData.mediaType === 'video') {
      return `
        <div class="message-group ${isMine ? 'sent' : 'received'}" data-message-id="${msg.id}" data-group-id="${groupId}">
          ${!isMine ? avatarHtml : ''}
          <div class="message-content">
            ${!isMine ? `<div class="message-sender">${XssUtil.sanitize(senderName)}</div>` : ''}
            <div class="message-time">${time}</div>
            <div class="message-bubble ${isMine ? 'sent' : 'received'} video-message"
                 data-message-id="${msg.id}"
                 data-group-id="${groupId}"
                 data-sender-id="${msg.senderId}"
                 data-is-group="true"
                 data-content='${escapeHtml(content)}'
                 onclick="openMediaViewer('${fileUrl}', 'video', '${escapeHtml(fileData.name)}')">
              <div class="video-placeholder">
                <svg class="play-icon" width="48" height="48" viewBox="0 0 24 24" fill="white">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
                <div class="video-info">${escapeHtml(fileData.name)}</div>
              </div>
            </div>
          </div>
          ${isMine ? avatarHtml : ''}
        </div>
      `;
    } else {
      const fileSize = formatFileSize(fileData.size);
      return `
        <div class="message-group ${isMine ? 'sent' : 'received'}" data-message-id="${msg.id}" data-group-id="${groupId}">
          ${!isMine ? avatarHtml : ''}
          <div class="message-content">
            ${!isMine ? `<div class="message-sender">${XssUtil.sanitize(senderName)}</div>` : ''}
            <div class="message-time">${time}</div>
            <div class="message-bubble ${isMine ? 'sent' : 'received'} file-message"
                 data-message-id="${msg.id}"
                 data-group-id="${groupId}"
                 data-sender-id="${msg.senderId}"
                 data-is-group="true"
                 data-content='${escapeHtml(content)}'>
              <svg class="file-icon" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
                <polyline points="13 2 13 9 20 9"/>
              </svg>
              <div class="file-info">
                <div class="file-name">${escapeHtml(fileData.name)}</div>
                <div class="file-size">${fileSize}</div>
              </div>
              <a href="${fileUrl}" download="${escapeHtml(fileData.name)}" class="file-download-btn" onclick="event.stopPropagation()">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                </svg>
              </a>
            </div>
          </div>
          ${isMine ? avatarHtml : ''}
        </div>
      `;
    }
  } catch (error) {
    // 如果解析JSON失败，说明这不是文件消息，返回null
    console.error('[群组文件消息] 渲染错误:', error, '原始内容:', msg.content);
    return null;
  }
}

/**
 * 检查消息内容是否为文件消息
 */
function isFileMessage(content) {
  try {
    // 解码HTML实体（处理后端的&quot;转义）
    let decodedContent = content;
    if (content.includes('&quot;')) {
      decodedContent = content.replace(/&quot;/g, '"')
                      .replace(/&amp;/g, '&')
                      .replace(/&lt;/g, '<')
                      .replace(/&gt;/g, '>')
                      .replace(/&#x27;/g, "'");
    }
    
    const parsed = JSON.parse(decodedContent);
    return parsed.hasOwnProperty('fileId') || parsed.hasOwnProperty('url') || parsed.hasOwnProperty('mediaType');
  } catch (error) {
    // 如果解析JSON失败，说明这不是文件消息
    return false;
  }
}

window.LinkUtil = LinkUtil;

/**
 * 打开链接 - 根据设置选择内置浏览器或系统浏览器
 */
function openLink(url) {
  const browserSetting = localStorage.getItem('defaultBrowser') || 'system';
  
  if (browserSetting === 'builtin') {
    // 使用内置浏览器
    ipcRenderer.send('open-builtin-browser', url);
  } else {
    // 使用系统浏览器
    require('electron').shell.openExternal(url);
  }
}

window.openLink = openLink;

// 处理接收的消息
async function handleIncomingMessage(message) {
  console.log('[Chat] Incoming message:', message);
  
  // 判断是否为撤回消息
  const isRecallMessage = message.isRecalled === true;
  
  // 如果是撤回消息，刷新当前聊天窗口
  if (isRecallMessage) {
    console.log('[Chat] 收到撤回消息通知:', message.id);
    
    // 如果正在与发送者或接收者聊天，刷新消息列表
    if (currentChatUser && 
        (message.senderId === currentChatUser.id || message.receiverId === currentChatUser.id)) {
      loadMessageHistory(currentChatUser.id);
    }
    
    // 撤回消息静默处理，不显示提示
    return;
  }
  
  // 如果正在与发送者聊天，实时显示消息
  if (currentChatUser && message.senderId === currentChatUser.id) {
    loadMessageHistory(currentChatUser.id);
  } else if (message.senderId !== apiService.currentUser.id) {
    // 如果不是当前聊天的用户，则增加未读消息数
    addUnreadMessage(message.senderId);
    // 刷新聊天列表显示红点
    renderChatsList();
  }
  
  // 显示通知
  if (message.senderId !== apiService.currentUser.id) {
    const senderName = getFriendName(message.senderId);
    
    // 播放提示音
    if (isSoundNotificationEnabled()) {
      playNotificationSound();
    }
    showWindowsNotification(senderName, message.content.substring(0, 50), message.senderId);
  }
}

// 处理接收的群组消息
function handleGroupMessage(groupMessage) {
  console.log('[Chat] Incoming group message (decrypted):', groupMessage);
  
  // 判断是否为撤回消息
  const isRecallMessage = groupMessage.isRecalled === true;
  
  // 如果是撤回消息，刷新当前群组聊天窗口
  if (isRecallMessage) {
    console.log('[Chat] 收到群组撤回消息通知:', groupMessage.id);
    
    // 如果正在查看此群组，刷新消息列表
    if (currentGroup && groupMessage.groupId === currentGroup.id) {
      loadGroupMessageHistory(currentGroup.id);
    }
    
    // 撤回消息静默处理，不显示提示
    return;
  }
  
  // 如果当前正在查看该群组的聊天，则实时更新消息
  if (currentGroup && currentGroup.id === groupMessage.groupId) {
    addGroupMessageToView(groupMessage);
    
    // 标记为已读（如果有需要）
    // 可以考虑实现群组消息已读功能
  } else if (groupMessage.senderId !== apiService.currentUser.id) {
    // 如果不是当前群组且不是自己发送的消息，则增加未读消息数
    addUnreadGroupMessage(groupMessage.groupId);
    // 刷新聊天列表显示红点
    renderChatsList();
  }
  
  // 更新群组聊天列表中的最新消息
  updateGroupChatList(groupMessage);
  
  // 如果不是当前群组，显示通知
  if (!currentGroup || currentGroup.id !== groupMessage.groupId) {
    showGroupMessageNotification(groupMessage);
  }
}

// 将群组消息添加到当前视图
function addGroupMessageToView(groupMessage) {
  const container = document.getElementById('messages-container');
  if (!container) return;
  
  // 获取发送者信息
  fetchWithAuth(`${apiService.apiUrl}/api/users/${groupMessage.senderId}`)
    .then(response => response.json())
    .then(sender => {
      const isMine = groupMessage.senderId === apiService.currentUser.id;
      const time = new Date(groupMessage.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      
      const senderName = sender.nickname || sender.username;
      const firstChar = senderName.charAt(0).toUpperCase();
      
      // 生成头像 HTML
      let avatarHtml;
      if (isMine) {
        // 自己的头像
        const hasMyAvatar = apiService.currentUser.avatar && apiService.currentUser.avatar.startsWith('/');
        avatarHtml = hasMyAvatar
          ? `<div class="avatar avatar-small" style="background-image: url('${apiService.apiUrl}${apiService.currentUser.avatar}'); background-size: cover; background-position: center;"></div>`
          : `<div class="avatar avatar-small">${apiService.currentUser.nickname?.charAt(0).toUpperCase()}</div>`;
      } else {
        // 其他成员的头像
        const hasAvatar = sender.avatar && sender.avatar.trim() !== '';
        avatarHtml = hasAvatar
          ? `<div class="avatar avatar-small" style="background-image: url('${apiService.apiUrl}${sender.avatar}'); background-size: cover; background-position: center;"></div>`
          : `<div class="avatar avatar-small">${firstChar}</div>`;
      }
      
      // XSS防护
      const safeContent = LinkUtil.processContent(groupMessage.content);
      
      const messageHtml = `
        <div class="message-group ${isMine ? 'sent' : 'received'}">
          ${!isMine ? avatarHtml : ''}
          <div class="message-content">
            ${!isMine ? `<div class="message-sender">${senderName}</div>` : ''}
            <div class="message-time">${time}</div>
            <div class="message-bubble ${isMine ? 'sent' : 'received'}">${safeContent}</div>
          </div>
          ${isMine ? avatarHtml : ''}
        </div>
      `;
      
      container.insertAdjacentHTML('beforeend', messageHtml);
      
      // 滚动到底部
      container.scrollTop = container.scrollHeight;
    })
    .catch(error => {
      console.error('获取群组消息发送者信息失败:', error);
    });
}

// 更新群组聊天列表
function updateGroupChatList(groupMessage) {
  // 获取群组信息并更新聊天列表
  fetchWithAuth(`${apiService.apiUrl}/api/groups/${groupMessage.groupId}`)
    .then(response => response.json())
    .then(group => {
      // 更新侧边栏聊天列表
      renderChatsList();
    })
    .catch(error => {
      console.error('更新群组聊天列表失败:', error);
    });
}

// 显示群组消息通知
function showGroupMessageNotification(groupMessage) {
  // 不为撤回消息显示通知
  if (groupMessage.isRecalled) {
    return;
  }
  
  // 获取群组信息
  fetchWithAuth(`${apiService.apiUrl}/api/groups/${groupMessage.groupId}`)
    .then(response => response.json())
    .then(group => {
      // 获取发送者信息
      fetchWithAuth(`${apiService.apiUrl}/api/users/${groupMessage.senderId}`)
        .then(response => response.json())
        .then(sender => {
          const senderName = sender.nickname || sender.username;
          const groupName = group.groupName;
          
          // 显示桌面通知
          if (Notification.permission === 'granted') {
            new Notification(`群聊消息 - ${groupName}`, {
              body: `${senderName}: ${groupMessage.content}`,
              icon: '/assets/icons/icon.png'
            });
          }
        });
    })
    .catch(error => {
      console.error('显示群组消息通知失败:', error);
    });
}

// 获取好友名称
function getFriendName(userId) {
  const friend = friendsList.find(f => f.id === userId);
  return friend ? (friend.nickname || friend.username) : '好友';
}

/**
 * 请求通知权限
 */
function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.log('[通知] 浏览器不支持通知');
    return;
  }

  if (Notification.permission === 'default') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        console.log('[通知] 权限已授予');
        showToast('✅ 已开启桌面通知', 'success');
      } else {
        console.log('[通知] 权限被拒绝');
      }
    });
  } else if (Notification.permission === 'granted') {
    console.log('[通知] 权限已存在');
  }
}

/**
 * 显示Windows系统通知
 */
function showWindowsNotification(senderName, messageContent, senderId) {
  // 检查是否有通知权限
  if (!('Notification' in window)) {
    console.log('[通知] 浏览器不支持通知');
    return;
  }

  // 请求通知权限
  if (Notification.permission === 'default') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        sendNotification(senderName, messageContent, senderId);
      }
    });
  } else if (Notification.permission === 'granted') {
    // 只在应用失焦时显示通知
    if (!document.hasFocus()) {
      sendNotification(senderName, messageContent, senderId);
    }
  }
}

/**
 * 发送通知
 */
function sendNotification(senderName, messageContent, senderId) {
  try {
    // 获取应用根目录路径
    const path = require('path');
    const iconPath = path.join(__dirname, '../../icon.ico');
    
    const notification = new Notification('智穗语聊 | ' + senderName, {
      body: messageContent,
      icon: iconPath,
      tag: 'chat-message-' + senderId,
      requireInteraction: false,
      silent: false
    });

    // 点击通知时聚焦窗口并打开聊天
    notification.onclick = function() {
      window.focus();
      notification.close();
      
      // 查找并打开对应的聊天
      const friend = friendsList.find(f => f.id === senderId);
      if (friend) {
        openChat(friend);
      }
    };

    // 5秒后自动关闭
    setTimeout(() => {
      notification.close();
    }, 5000);

    console.log('[通知] 已显示Windows通知:', senderName);
  } catch (error) {
    console.error('[通知] 显示失败:', error);
  }
}

// 播放通知声
function isSoundNotificationEnabled() {
  // 从localStorage获取声音通知设置，默认为启用
  const enabled = localStorage.getItem('soundNotification') !== 'false';
  console.log('[Chat] 声音通知设置状态:', enabled);
  return enabled;
}

function playNotificationSound() {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (error) {
    console.log('[Chat] Cannot play notification sound:', error);
  }
}

// 退出登录
function logout() {
  // 停止OAuth本地验证服务器
  stopOAuthLocalServer();
  
  wsService.disconnect();
  apiService.clearAuthStorage();
  window.location.href = 'login.html';
}

// 关闭移动端聊天视图
function closeMobileChat() {
  const chatDetail = document.getElementById('chat-detail');
  chatDetail.classList.remove('mobile-active');
  
  // 如果当前在群组聊天中，取消订阅该群组
  if (currentGroup && wsService.isConnected()) {
    wsService.unsubscribeFromGroup(currentGroup.id);
    currentGroup = null;
  }
  
  currentChatUser = null;
}

// 显示Toast提示
function showToast(message, type = '') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`.trim();
  toast.textContent = message;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

/**
 * 显示最新公告
 */
async function showLatestAnnouncement() {
  try {
    const response = await fetch('https://msg.v2.zhsdev.top/api/announcements/latest');
    
    if (response.status === 204 || !response.ok) {
      showToast('暂无公告', 'info');
      return;
    }
    
    const announcement = await response.json();
    
    // 使用IPC通知主进程显示公告对话框
    const { ipcRenderer } = require('electron');
    ipcRenderer.send('show-announcement-manual', announcement);
    
  } catch (error) {
    console.error('[公告] 获取失败:', error);
    showToast('获取公告失败', 'error');
  }
}

/**
 * 打开设置窗口
 */
function openSettings() {
  const { ipcRenderer } = require('electron');
  ipcRenderer.send('open-settings-window');
}

/**
 * 显示右键菜单
 */
let contextMenuElement = null;
let currentMessageId = null;
let currentMessageContent = null;

function showContextMenu(event, messageId, messageContent, isSent) {
  event.preventDefault();
  event.stopPropagation();
  
  currentMessageId = messageId;
  currentMessageContent = messageContent;
  
  // 删除旧的菜单
  hideContextMenu();
  
  // 创建菜单
  contextMenuElement = document.createElement('div');
  contextMenuElement.className = 'context-menu';
  contextMenuElement.id = 'contextMenu';
  
  // 菜单项配置
  const menuItems = [];
  
  // 复制
  menuItems.push({
    icon: '📋',
    label: '复制',
    action: 'copyMessage',
    shortcut: 'Ctrl+C'
  });
  
  // 只有自己的消息才能撤回
  if (isSent) {
    menuItems.push({
      icon: '↩️',
      label: '撤回消息',
      action: 'recallMessage',
      danger: true
    });
  }
  
  // 分隔线
  menuItems.push({ divider: true });
  
  // 引用回复
  menuItems.push({
    icon: '💬',
    label: '引用回复',
    action: 'quoteMessage'
  });
  
  // 转发
  menuItems.push({
    icon: '➡️',
    label: '转发',
    action: 'forwardMessage'
  });
  
  // 分隔线
  menuItems.push({ divider: true });
  
  // 翻译
  menuItems.push({
    icon: '🌍',
    label: '翻译',
    action: 'translateMessage'
  });
  
  // 多选
  menuItems.push({
    icon: '☑️',
    label: '多选模式',
    action: 'enterMultiSelectMode'
  });
  
  // 分隔线
  menuItems.push({ divider: true });
  
  // 收藏
  menuItems.push({
    icon: '⭐',
    label: '收藏',
    action: 'favoriteMessage'
  });
  
  // 生成菜单HTML
  contextMenuElement.innerHTML = menuItems.map((item, index) => {
    if (item.divider) {
      return '<div class="context-menu-divider"></div>';
    }
    return `
      <div class="context-menu-item ${item.danger ? 'danger' : ''}" data-action="${item.action}" data-index="${index}">
        <span class="menu-icon">${item.icon}</span>
        <span class="menu-label">${item.label}</span>
        ${item.shortcut ? `<span class="menu-shortcut">${item.shortcut}</span>` : ''}
      </div>
    `;
  }).join('');
  
  document.body.appendChild(contextMenuElement);
  
  // 添加点击事件监听
  contextMenuElement.querySelectorAll('.context-menu-item').forEach(item => {
    item.addEventListener('click', () => {
      const action = item.dataset.action;
      if (action === 'copyMessage') {
        copyMessage(messageContent);
      } else if (action === 'recallMessage') {
        recallMessage(messageId);
      } else if (action === 'quoteMessage') {
        quoteMessage(messageContent);
      } else if (action === 'forwardMessage') {
        forwardMessage(messageContent);
      } else if (action === 'translateMessage') {
        translateMessage(messageContent, 'en', true); // 显示在消息气泡下方
      } else if (action === 'enterMultiSelectMode') {
        enterMultiSelectMode(messageId);
      } else if (action === 'favoriteMessage') {
        favoriteMessage(messageId, messageContent);
      }
    });
  });
  
  // 设置位置
  const x = event.clientX;
  const y = event.clientY;
  
  // 确保菜单在DOM中渲染完成后再计算尺寸
  contextMenuElement.style.visibility = 'hidden';
  contextMenuElement.style.display = 'block';
  
  const rect = contextMenuElement.getBoundingClientRect();
  const menuWidth = rect.width;
  const menuHeight = rect.height;
  
  // 恢复可见性
  contextMenuElement.style.visibility = 'visible';
  
  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;
  
  let left = x;
  let top = y;
  
  // 防止超出屏幕右边界
  if (x + menuWidth > windowWidth) {
    left = windowWidth - menuWidth - 5; // 5px边距
  }
  
  // 防止超出屏幕左边界
  if (x < 0) {
    left = 5; // 5px边距
  }
  
  // 防止超出屏幕下边界
  if (y + menuHeight > windowHeight) {
    top = windowHeight - menuHeight - 5; // 5px边距
  }
  
  // 防止超出屏幕上边界
  if (y < 0) {
    top = 5; // 5px边距
  }
  
  contextMenuElement.style.left = left + 'px';
  contextMenuElement.style.top = top + 'px';
  
  // 添加显示动画
  setTimeout(() => {
    contextMenuElement.classList.add('show');
  }, 10);
}

function hideContextMenu() {
  if (contextMenuElement) {
    contextMenuElement.classList.remove('show');
    setTimeout(() => {
      contextMenuElement?.remove();
      contextMenuElement = null;
    }, 200);
  }
}

// 点击页面其他地方关闭菜单
document.addEventListener('click', hideContextMenu);
document.addEventListener('contextmenu', (e) => {
  if (!e.target.closest('.message-bubble')) {
    hideContextMenu();
  }
});

// 事件委托处理动态元素的点击事件
function setupEventDelegation() {
  // 处理动态添加的按钮点击事件
  document.addEventListener('click', function(e) {
    // 检查是否是动态生成的元素上的点击
    const target = e.target;
    
    // 处理模态框关闭按钮
    if (target.classList.contains('modal-close')) {
      const modal = target.closest('.modal');
      if (modal) {
        modal.remove();
      }
    }
    
    // 处理其他动态按钮
    if (target.tagName === 'BUTTON') {
      // 检查是否有data-action属性
      const action = target.getAttribute('data-action');
      if (action && typeof window[action] === 'function') {
        window[action].apply(target, []);
      }
    }
    
    // 处理链接点击
    if (target.tagName === 'A' && target.href) {
      // 如果是内部链接处理
      if (target.href.indexOf(window.location.origin) !== -1) {
        // 特殊处理
      }
    }
  });
}

// 页面加载完成后设置事件委托
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupEventDelegation);
} else {
  setupEventDelegation();
}

/**
 * 复制消息
 */
function copyMessage(content) {
  console.log('[复制] 消息内容:', content);
  
  navigator.clipboard.writeText(content).then(() => {
    showToast('✅ 复制成功', 'success');
    console.log('[复制] 成功');
  }).catch((error) => {
    console.error('[复制] 失败:', error);
    showToast('❌ 复制失败', 'error');
  });
  hideContextMenu();
}

/**
 * 撤回消息
 */
async function recallMessage(messageId) {
  hideContextMenu();
  
  console.log('[撤回] 消息ID:', messageId);
  console.log('[撤回] 用户ID:', apiService.currentUser.id);
  
  try {
    const result = await apiService.recallMessage(messageId, apiService.currentUser.id);
    
    if (result.success) {
      console.log('[撤回] 成功');
      // 重新加载消息
      setTimeout(() => {
        loadMessageHistory(currentChatUser.id);
      }, 500);
    } else {
      console.error('[撤回] 失败:', result.error);
      showToast('❌ ' + result.error, 'error');
    }
  } catch (error) {
    console.error('[撤回] 异常:', error);
    showToast('❌ 撤回失败: ' + error.message, 'error');
  }
}

/**
 * 显示群聊右键菜单
 */
function showGroupContextMenu(event, messageId, messageContent, groupId, senderId, isMine, currentUserRole) {
  event.preventDefault();
  event.stopPropagation();
  
  // 删除旧的菜单
  hideContextMenu();
  
  // 创建菜单
  contextMenuElement = document.createElement('div');
  contextMenuElement.className = 'context-menu';
  contextMenuElement.id = 'contextMenu';
  
  // 菜单项配置
  const menuItems = [];
  
  // 复制
  menuItems.push({
    icon: '📋',
    label: '复制',
    action: 'copyMessage',
    shortcut: 'Ctrl+C'
  });
  
  // 撤回权限检查：
  // 1. 自己的消息可以撤回
  // 2. 群主和管理员可以撤回任何人的消息
  const isOwnerOrAdmin = currentUserRole === 'OWNER' || currentUserRole === 'ADMIN';
  if (isMine || isOwnerOrAdmin) {
    menuItems.push({
      icon: '↩️',
      label: isMine ? '撤回消息' : '撤回成员消息',
      action: 'recallGroupMessage',
      danger: true
    });
  }
  
  // 分隔线
  menuItems.push({ divider: true });
  
  // 引用回复
  menuItems.push({
    icon: '💬',
    label: '引用回复',
    action: 'quoteGroupMessage'
  });
  
  // 转发
  menuItems.push({
    icon: '➡️',
    label: '转发',
    action: 'forwardGroupMessage'
  });
  
  // 分隔线
  menuItems.push({ divider: true });
  
  // 翻译
  menuItems.push({
    icon: '🌍',
    label: '翻译',
    action: 'translateGroupMessage'
  });
  
  // 多选
  menuItems.push({
    icon: '☑️',
    label: '多选模式',
    action: 'enterGroupMultiSelectMode'
  });
  
  // 分隔线
  menuItems.push({ divider: true });
  
  // 收藏
  menuItems.push({
    icon: '⭐',
    label: '收藏',
    action: 'favoriteGroupMessage'
  });
  
  // 管理员功能：禁言（不能禁言自己）
  if (isOwnerOrAdmin && !isMine) {
    menuItems.push({ divider: true });
    menuItems.push({
      icon: '🔇',
      label: '禁言该成员',
      action: 'muteGroupMemberFromMsg',
      danger: true
    });
  }
  
  // 生成菜单HTML
  contextMenuElement.innerHTML = menuItems.map((item, index) => {
    if (item.divider) {
      return '<div class="context-menu-divider"></div>';
    }
    return `
      <div class="context-menu-item ${item.danger ? 'danger' : ''}" data-action="${item.action}" data-index="${index}">
        <span class="menu-icon">${item.icon}</span>
        <span class="menu-label">${item.label}</span>
        ${item.shortcut ? `<span class="menu-shortcut">${item.shortcut}</span>` : ''}
      </div>
    `;
  }).join('');
  
  document.body.appendChild(contextMenuElement);
  
  // 添加点击事件监听
  contextMenuElement.querySelectorAll('.context-menu-item').forEach(item => {
    item.addEventListener('click', () => {
      const action = item.dataset.action;
      if (action === 'copyMessage') {
        copyMessage(messageContent);
      } else if (action === 'recallGroupMessage') {
        recallGroupMessage(messageId, groupId);
      } else if (action === 'quoteGroupMessage') {
        quoteGroupMessage(messageContent, groupId);
      } else if (action === 'forwardGroupMessage') {
        forwardMessage(messageContent);
      } else if (action === 'translateGroupMessage') {
        translateMessage(messageContent, 'en', true);
      } else if (action === 'enterGroupMultiSelectMode') {
        enterGroupMultiSelectMode(messageId, groupId);
      } else if (action === 'favoriteGroupMessage') {
        favoriteMessage(messageId, messageContent);
      } else if (action === 'muteGroupMemberFromMsg') {
        muteGroupMember(groupId, senderId);
      }
    });
  });
  
  // 设置位置
  const x = event.clientX;
  const y = event.clientY;
  
  contextMenuElement.style.visibility = 'hidden';
  contextMenuElement.style.display = 'block';
  
  const rect = contextMenuElement.getBoundingClientRect();
  const menuWidth = rect.width;
  const menuHeight = rect.height;
  
  contextMenuElement.style.visibility = 'visible';
  
  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;
  
  let left = x;
  let top = y;
  
  if (x + menuWidth > windowWidth) {
    left = windowWidth - menuWidth - 5;
  }
  if (x < 0) {
    left = 5;
  }
  if (y + menuHeight > windowHeight) {
    top = windowHeight - menuHeight - 5;
  }
  if (y < 0) {
    top = 5;
  }
  
  contextMenuElement.style.left = left + 'px';
  contextMenuElement.style.top = top + 'px';
  
  setTimeout(() => {
    contextMenuElement.classList.add('show');
  }, 10);
}

/**
 * 撤回群消息
 */
async function recallGroupMessage(messageId, groupId) {
  hideContextMenu();
  
  console.log('[群撤回] 消息ID:', messageId, '群ID:', groupId);
  
  try {
    const response = await fetchWithAuth(`${apiService.apiUrl}/api/groups/messages/${messageId}/recall`, {
      method: 'POST',
      body: JSON.stringify({ userId: apiService.currentUser.id })
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('[群撤回] 成功');
      showToast('✅ 撤回成功', 'success');
      // 重新加载群消息
      setTimeout(() => {
        loadGroupMessages(groupId);
      }, 500);
    } else {
      console.error('[群撤回] 失败:', result.error);
      showToast('❌ ' + result.error, 'error');
    }
  } catch (error) {
    console.error('[群撤回] 异常:', error);
    showToast('❌ 撤回失败: ' + error.message, 'error');
  }
}

/**
 * 引用群消息
 */
function quoteGroupMessage(content, groupId) {
  const input = document.getElementById('group-message-input');
  if (!input) return;
  
  // 存储引用信息
  const quoteData = {
    content: content.substring(0, 100),
    groupId: groupId
  };
  
  input.dataset.quoteData = JSON.stringify(quoteData);
  
  // 显示引用预览
  const inputContainer = input.closest('.chat-input-area');
  if (inputContainer) {
    const oldPreview = inputContainer.querySelector('.quote-preview');
    if (oldPreview) oldPreview.remove();
    
    const preview = document.createElement('div');
    preview.className = 'quote-preview';
    preview.innerHTML = `
      <div class="quote-preview-content">
        <span class="quote-icon">↳</span>
        <span class="quote-text">${XssUtil.sanitize(quoteData.content)}</span>
      </div>
      <button class="quote-preview-close" onclick="this.closest('.quote-preview').remove(); document.getElementById('group-message-input').dataset.quoteData = '';">×</button>
    `;
    
    inputContainer.insertBefore(preview, inputContainer.firstChild);
  }
  
  input.focus();
  showToast('💬 已引用消息', 'success');
  hideContextMenu();
}

/**
 * 群聊多选模式
 */
let currentGroupIdForMultiSelect = null;

function enterGroupMultiSelectMode(messageId, groupId) {
  isMultiSelectMode = true;
  selectedMessages = [parseInt(messageId)];
  currentGroupIdForMultiSelect = groupId;
  
  // 显示多选工具栏
  showGroupMultiSelectToolbar(groupId);
  
  // 给所有消息添加复选框
  const messagesContainer = document.getElementById('messages-container');
  messagesContainer.querySelectorAll('.message-group').forEach(group => {
    if (!group.classList.contains('multi-select-mode')) {
      group.classList.add('multi-select-mode');
      
      // 添加复选框
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'message-checkbox';
      const msgId = parseInt(group.dataset.messageId);
      checkbox.checked = selectedMessages.includes(msgId);
      checkbox.dataset.messageId = msgId;
      
      if (checkbox.checked) {
        group.classList.add('selected');
      }
      
      checkbox.addEventListener('change', (e) => {
        if (e.target.checked) {
          if (!selectedMessages.includes(msgId)) {
            selectedMessages.push(msgId);
            group.classList.add('selected');
          }
        } else {
          selectedMessages = selectedMessages.filter(id => id !== msgId);
          group.classList.remove('selected');
        }
        updateGroupMultiSelectToolbar();
      });
      
      group.insertBefore(checkbox, group.firstChild);
      
      // 点击消息区域也可以切换选中状态
      group.addEventListener('click', (e) => {
        if (!e.target.classList.contains('message-checkbox')) {
          checkbox.checked = !checkbox.checked;
          checkbox.dispatchEvent(new Event('change'));
        }
      });
    }
  });
  
  hideContextMenu();
  showToast('☑️ 已进入多选模式', 'info');
}

/**
 * 显示群聊多选工具栏
 */
function showGroupMultiSelectToolbar(groupId) {
  // 删除旧的工具栏
  const oldToolbar = document.querySelector('.multi-select-toolbar');
  if (oldToolbar) oldToolbar.remove();
  
  const toolbar = document.createElement('div');
  toolbar.className = 'multi-select-toolbar';
  toolbar.innerHTML = `
    <div class="multi-select-info">已选择 <strong>${selectedMessages.length}</strong> 条</div>
    <div class="multi-select-actions">
      <button class="btn btn-secondary btn-small" onclick="exitGroupMultiSelectMode()">取消</button>
      <button class="btn btn-primary btn-small" onclick="forwardSelectedGroupMessages(${groupId})">转发</button>
    </div>
  `;
  
  document.body.appendChild(toolbar);
}

/**
 * 更新群聊多选工具栏
 */
function updateGroupMultiSelectToolbar() {
  const info = document.querySelector('.multi-select-info');
  if (info) {
    info.innerHTML = `已选择 <strong>${selectedMessages.length}</strong> 条`;
  }
}

/**
 * 退出群聊多选模式
 */
function exitGroupMultiSelectMode() {
  isMultiSelectMode = false;
  selectedMessages = [];
  currentGroupIdForMultiSelect = null;
  
  // 删除工具栏
  const toolbar = document.querySelector('.multi-select-toolbar');
  if (toolbar) toolbar.remove();
  
  // 删除所有复选框
  const messagesContainer = document.getElementById('messages-container');
  if (messagesContainer) {
    messagesContainer.querySelectorAll('.message-group').forEach(group => {
      group.classList.remove('multi-select-mode', 'selected');
      const checkbox = group.querySelector('.message-checkbox');
      if (checkbox) checkbox.remove();
    });
  }
  
  showToast('✅ 已退出多选模式', 'success');
}

/**
 * 转发选中的群消息
 */
async function forwardSelectedGroupMessages(groupId) {
  if (selectedMessages.length === 0) {
    showToast('⚠️ 请至少选择一条消息', 'warning');
    return;
  }
  
  // 获取选中消息的内容
  try {
    const response = await fetchWithAuth(`${apiService.apiUrl}/api/groups/${groupId}/messages`);
    const allMessages = await response.json();
    
    const messages = allMessages
      .filter(msg => selectedMessages.includes(msg.id))
      .map(msg => ({
        id: msg.id,
        content: msg.content
      }));
    
    // 退出多选模式
    exitGroupMultiSelectMode();
    
    // 显示转发对话框
    showForwardDialog(messages);
  } catch (error) {
    console.error('获取群消息失败:', error);
    showToast('❌ 加载失败', 'error');
  }
}

// 导出群多选模式函数到全局
window.exitGroupMultiSelectMode = exitGroupMultiSelectMode;
window.forwardSelectedGroupMessages = forwardSelectedGroupMessages;

/**
 * 引用回复
 */
function quoteMessage(content) {
  const input = document.getElementById('message-input');
  if (!input || !currentMessageId) return;
  
  // 存储引用信息
  const quoteData = {
    messageId: currentMessageId,
    content: content.substring(0, 100) // 最多显示100个字符
  };
  
  // 将引用信息存储到输入框的数据属性中
  input.dataset.quoteData = JSON.stringify(quoteData);
  
  // 显示引用预览
  showQuotePreview(quoteData);
  
  input.focus();
  showToast('💬 已引用消息', 'success');
  hideContextMenu();
}

// 显示引用预览
function showQuotePreview(quoteData) {
  const messageInputContainer = document.querySelector('.message-input-container');
  if (!messageInputContainer) return;
  
  // 删除旧的预览
  const oldPreview = document.querySelector('.quote-preview');
  if (oldPreview) oldPreview.remove();
  
  // 创建新的预览
  const preview = document.createElement('div');
  preview.className = 'quote-preview';
  preview.innerHTML = `
    <div class="quote-preview-content">
      <span class="quote-icon">${getSVGIcon('cornerDownRight', 16)}</span>
      <span class="quote-text">${XssUtil.sanitize(quoteData.content)}</span>
    </div>
    <button class="quote-preview-close" onclick="cancelQuote()">×</button>
  `;
  
  messageInputContainer.insertBefore(preview, messageInputContainer.firstChild);
}

// 取消引用
function cancelQuote() {
  const input = document.getElementById('message-input');
  if (input) {
    delete input.dataset.quoteData;
  }
  const preview = document.querySelector('.quote-preview');
  if (preview) preview.remove();
}

/**
 * 转发消息
 */
function forwardMessage(content) {
  showForwardDialog([{ id: currentMessageId, content: content }]);
  hideContextMenu();
}

/**
 * 显示转发对话框
 */
async function showForwardDialog(messages) {
  // 加载好友和群组列表
  const friendsResult = await apiService.getFriendsList(apiService.currentUser.id);
  const groupsResult = await apiService.getUserGroups(apiService.currentUser.id);
  
  if (!friendsResult.success || !groupsResult.success) {
    showToast('⚠️ 加载失败', 'error');
    return;
  }
  
  const friends = friendsResult.data || [];
  const groups = groupsResult.data || [];
  
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content forward-dialog">
      <div class="modal-header">
        <h3>转发消息</h3>
        <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
      </div>
      <div class="modal-body">
        <div class="forward-tabs">
          <button class="forward-tab active" data-tab="friends">好友</button>
          <button class="forward-tab" data-tab="groups">群组</button>
        </div>
        <div class="forward-search">
          <input type="text" class="search-input" placeholder="搜索..." id="forward-search-input">
        </div>
        <div class="forward-list" id="forward-list">
          <!-- 好友/群组列表 -->
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">取消</button>
        <button class="btn btn-primary" onclick="handleForwardSingle()">逐条转发</button>
        <button class="btn btn-primary" onclick="handleForwardMerge()">合并转发</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // 存储要转发的消息
  modal.dataset.messages = JSON.stringify(messages);
  modal.dataset.friends = JSON.stringify(friends);
  modal.dataset.groups = JSON.stringify(groups);
  
  // 初始化显示好友列表
  renderForwardList('friends', friends, groups);
  
  // 添加标签切换事件
  modal.querySelectorAll('.forward-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      modal.querySelectorAll('.forward-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderForwardList(tab.dataset.tab, friends, groups);
    });
  });
  
  // 搜索功能
  const searchInput = modal.querySelector('#forward-search-input');
  searchInput.addEventListener('input', (e) => {
    const activeTab = modal.querySelector('.forward-tab.active').dataset.tab;
    const keyword = e.target.value.toLowerCase();
    const items = modal.querySelectorAll('.forward-item');
    items.forEach(item => {
      const name = item.querySelector('.forward-item-name').textContent.toLowerCase();
      item.style.display = name.includes(keyword) ? 'flex' : 'none';
    });
  });
}

/**
 * 渲染转发列表
 */
function renderForwardList(type, friends, groups) {
  const list = document.getElementById('forward-list');
  const items = type === 'friends' ? friends : groups;
  
  list.innerHTML = items.map(item => {
    const name = type === 'friends' ? item.nickname : item.groupName;
    const desc = type === 'friends' ? `@${item.username}` : `${item.memberCount || 0} 人`;
    const avatar = type === 'friends' 
      ? (item.avatarUrl ? `<div class="avatar avatar-small" style="background-image: url('${apiService.apiUrl}${item.avatarUrl}'); background-size: cover;"></div>` : `<div class="avatar avatar-small">${name.charAt(0).toUpperCase()}</div>`)
      : `<div class="avatar avatar-small">${name.charAt(0).toUpperCase()}</div>`;
    
    return `
      <div class="forward-item" data-type="${type}" data-id="${item.id || item.groupId}">
        <input type="checkbox" class="forward-checkbox">
        ${avatar}
        <div class="forward-item-info">
          <div class="forward-item-name">${XssUtil.sanitize(name)}</div>
          <div class="forward-item-desc">${XssUtil.sanitize(desc)}</div>
        </div>
      </div>
    `;
  }).join('');
  
  // 添加选中事件
  list.querySelectorAll('.forward-item').forEach(item => {
    const checkbox = item.querySelector('.forward-checkbox');
    item.addEventListener('click', (e) => {
      if (e.target !== checkbox) {
        checkbox.checked = !checkbox.checked;
      }
      item.classList.toggle('selected', checkbox.checked);
    });
  });
}

/**
 * 处理逐条转发
 */
async function handleForwardSingle() {
  const modal = document.querySelector('.modal');
  const messages = JSON.parse(modal.dataset.messages);
  const selectedItems = modal.querySelectorAll('.forward-item.selected');
  
  if (selectedItems.length === 0) {
    showToast('⚠️ 请选择转发对象', 'warning');
    return;
  }
  
  modal.remove();
  showToast('🚀 正在转发...', 'info');
  
  let successCount = 0;
  
  for (const item of selectedItems) {
    const type = item.dataset.type;
    const targetId = parseInt(item.dataset.id);
    
    for (const msg of messages) {
      try {
        if (type === 'friends') {
          // 转发给好友
          await apiService.sendMessage(
            apiService.currentUser.id,
            targetId,
            msg.content
          );
        } else {
          // 转发给群组
          await apiService.sendGroupMessage(
            targetId,
            apiService.currentUser.id,
            msg.content
          );
        }
        successCount++;
      } catch (error) {
        console.error('转发失败:', error);
      }
    }
  }
  
  showToast(`✅ 已转发 ${successCount} 条消息`, 'success');
}

/**
 * 处理合并转发
 */
async function handleForwardMerge() {
  const modal = document.querySelector('.modal');
  const messages = JSON.parse(modal.dataset.messages);
  const selectedItems = modal.querySelectorAll('.forward-item.selected');
  
  if (selectedItems.length === 0) {
    showToast('⚠️ 请选择转发对象', 'warning');
    return;
  }
  
  modal.remove();
  showToast('🚀 正在转发...', 'info');
  
  // 生成聊天记录卡片
  const chatHistoryCard = {
    type: 'chat_history',
    title: `聊天记录`,
    messages: messages.map(msg => ({
      sender: apiService.currentUser.nickname,
      content: msg.content,
      time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    })),
    count: messages.length
  };
  
  const cardContent = JSON.stringify(chatHistoryCard);
  let successCount = 0;
  
  for (const item of selectedItems) {
    const type = item.dataset.type;
    const targetId = parseInt(item.dataset.id);
    
    try {
      if (type === 'friends') {
        await apiService.sendMessage(
          apiService.currentUser.id,
          targetId,
          cardContent
        );
      } else {
        await apiService.sendGroupMessage(
          targetId,
          apiService.currentUser.id,
          cardContent
        );
      }
      successCount++;
    } catch (error) {
      console.error('合并转发失败:', error);
    }
  }
  
  showToast(`✅ 已合并转发到 ${successCount} 个对象`, 'success');
}

/**
 * 翻译消息
 */
async function translateMessage(content, toLang = 'en') {
  try {
    showToast('🌍 正在翻译...', 'info');
    
    // 调用API进行翻译
    const result = await apiService.translate(content, toLang); // 使用默认目标语言
    
    if (result.success) {
      const translatedText = result.data.translated_text || result.data.translate || result.data.text;
      
      // 创建翻译结果弹窗
      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px; min-width: 300px;">
          <div class="modal-header" style="border-bottom: 1px solid #eee; padding: 15px 20px; display: flex; justify-content: space-between; align-items: center;">
            <h3 style="margin: 0; display: flex; align-items: center; gap: 10px;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M10 19H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"/>
                <polyline points="17 17 12 12 7 17"/>
                <polyline points="17 7 12 12 7 7"/>
                <line x1="12" y1="2" x2="12" y2="12"/>
              </svg>
              翻译结果
            </h3>
            <button class="modal-close" onclick="this.closest('.modal').remove()" style="font-size: 24px; line-height: 1; background: none; border: none; cursor: pointer; color: #999;">×</button>
          </div>
          <div class="modal-body" style="padding: 20px;">
            <div style="margin-bottom: 15px;">
              <div style="font-weight: 500; color: #666; font-size: 14px; margin-bottom: 5px;">原文:</div>
              <div style="padding: 10px; background: #f8f9fa; border-radius: 6px; border-left: 3px solid #007bff; padding-left: 15px;">${content}</div>
            </div>
            <div>
              <div style="font-weight: 500; color: #666; font-size: 14px; margin-bottom: 5px;">译文:</div>
              <div style="padding: 10px; background: #e8f5e9; border-radius: 6px; border-left: 3px solid #28a745; padding-left: 15px; color: #28a745;">${translatedText}</div>
            </div>
          </div>
          <div class="modal-footer" style="border-top: 1px solid #eee; padding: 15px 20px; display: flex; justify-content: flex-end;">
            <button class="btn btn-primary" onclick="copyTranslatedText('${translatedText.replace(/'/g, "\\'").replace(/"/g, '&quot;')}', this)" style="padding: 8px 16px; background: #28a745; color: white; border: none; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 5px;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
              复制译文
            </button>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      showToast('✅ 翻译完成', 'success');
    } else {
      showToast('❌ 翻译失败: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('翻译消息失败:', error);
    showToast('❌ 翻译失败: ' + error.message, 'error');
  }
  
  hideContextMenu();
}

// 复制翻译后的文本
function copyTranslatedText(text, button) {
  navigator.clipboard.writeText(text).then(() => {
    const originalText = button.innerHTML;
    button.innerHTML = '✓ 已复制';
    button.style.background = '#28a745';
    
    setTimeout(() => {
      button.innerHTML = originalText;
      button.style.background = '#28a745';
    }, 2000);
  }).catch(err => {
    console.error('复制失败:', err);
    showToast('❌ 复制失败', 'error');
  });
}

// 翻译消息
async function translateMessage(content, toLang = 'en', showBelowBubble = false, targetMessageId = null) {
  try {
    showToast('🌍 正在翻译...', 'info');
    
    // 调用API进行翻译
    const result = await apiService.translate(content, toLang); // 使用默认目标语言
    
    if (result.success) {
      const translatedText = result.data.translated_text || result.data.translate || result.data.text;
      
      if (showBelowBubble) {
        // 显示在消息气泡下方
        showTranslationBelowBubble(content, translatedText, targetMessageId || currentMessageId);
      } else {
        // 创建翻译结果弹窗
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
          <div class="modal-content" style="max-width: 500px; min-width: 300px;">
            <div class="modal-header" style="border-bottom: 1px solid #eee; padding: 15px 20px; display: flex; justify-content: space-between; align-items: center;">
              <h3 style="margin: 0; display: flex; align-items: center; gap: 10px;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M10 19H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"/>
                  <polyline points="17 17 12 12 7 17"/>
                  <polyline points="17 7 12 12 7 7"/>
                  <line x1="12" y1="2" x2="12" y2="12"/>
                </svg>
                翻译结果
              </h3>
              <button class="modal-close" onclick="this.closest('.modal').remove()" style="font-size: 24px; line-height: 1; background: none; border: none; cursor: pointer; color: #999;">×</button>
            </div>
            <div class="modal-body" style="padding: 20px;">
              <div style="margin-bottom: 15px;">
                <div style="font-weight: 500; color: #666; font-size: 14px; margin-bottom: 5px;">原文:</div>
                <div style="padding: 10px; background: #f8f9fa; border-radius: 6px; border-left: 3px solid #007bff; padding-left: 15px;">${content}</div>
            </div>
            <div>
              <div style="font-weight: 500; color: #666; font-size: 14px; margin-bottom: 5px;">译文:</div>
              <div style="padding: 10px; background: #e8f5e9; border-radius: 6px; border-left: 3px solid #28a745; padding-left: 15px; color: #28a745;">${translatedText}</div>
            </div>
          </div>
          <div class="modal-footer" style="border-top: 1px solid #eee; padding: 15px 20px; display: flex; justify-content: flex-end;">
            <button class="btn btn-primary" onclick="copyTranslatedText('${translatedText.replace(/'/g, "\\'").replace(/"/g, '&quot;')}', this)" style="padding: 8px 16px; background: #28a745; color: white; border: none; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 5px;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
              复制译文
            </button>
          </div>
        </div>
      `;
      
        document.body.appendChild(modal);
      }
      
      showToast('✅ 翻译完成', 'success');
    } else {
      showToast('❌ 翻译失败: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('翻译消息失败:', error);
    showToast('❌ 翻译失败: ' + error.message, 'error');
  }
  
  hideContextMenu();
}

// 在消息气泡下方显示翻译结果
function showTranslationBelowBubble(originalText, translatedText, targetMessageId = null) {
  // 创建翻译结果元素
  const translationDiv = document.createElement('div');
  translationDiv.className = 'message-translation';
  translationDiv.style.cssText = `
    padding: 10px 15px;
    background: #f0f8ff;
    border-radius: 8px;
    margin-top: 5px;
    border-left: 3px solid #4a90e2;
    font-size: 14px;
    color: #333;
    line-height: 1.5;
  `;
  translationDiv.innerHTML = `
    <div style="font-weight: 500; color: #666; font-size: 12px; margin-bottom: 3px;">翻译:</div>
    <div style="color: #2c5aa0;">${translatedText}</div>
  `;
  
  // 通过目标消息ID或当前消息ID获取对应的消息气泡
  const targetId = targetMessageId || currentMessageId;
  const messageBubble = document.querySelector(`[data-msg-id="${targetId}"]`);
  
  if (messageBubble) {
    // 检查是否已有翻译，如果有则替换
    const existingTranslation = messageBubble.parentNode.querySelector('.message-translation');
    if (existingTranslation) {
      existingTranslation.remove();
    }
    
    // 插入翻译结果
    messageBubble.parentNode.appendChild(translationDiv);
  } else {
    // 如果找不到特定的消息气泡，则显示为普通弹窗
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 500px; min-width: 300px;">
        <div class="modal-header" style="border-bottom: 1px solid #eee; padding: 15px 20px; display: flex; justify-content: space-between; align-items: center;">
          <h3 style="margin: 0; display: flex; align-items: center; gap: 10px;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10 19H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"/>
              <polyline points="17 17 12 12 7 17"/>
              <polyline points="17 7 12 12 7 7"/>
              <line x1="12" y1="2" x2="12" y2="12"/>
            </svg>
            翻译结果
          </h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()" style="font-size: 24px; line-height: 1; background: none; border: none; cursor: pointer; color: #999;">×</button>
        </div>
        <div class="modal-body" style="padding: 20px;">
          <div style="margin-bottom: 15px;">
            <div style="font-weight: 500; color: #666; font-size: 14px; margin-bottom: 5px;">原文:</div>
            <div style="padding: 10px; background: #f8f9fa; border-radius: 6px; border-left: 3px solid #007bff; padding-left: 15px;">${originalText}</div>
          </div>
          <div>
            <div style="font-weight: 500; color: #666; font-size: 14px; margin-bottom: 5px;">译文:</div>
            <div style="padding: 10px; background: #e8f5e9; border-radius: 6px; border-left: 3px solid #28a745; padding-left: 15px; color: #28a745;">${translatedText}</div>
          </div>
        </div>
        <div class="modal-footer" style="border-top: 1px solid #eee; padding: 15px 20px; display: flex; justify-content: flex-end;">
          <button class="btn btn-primary" onclick="copyTranslatedText('${translatedText.replace(/'/g, "\\'").replace(/"/g, '&quot;')}', this)" style="padding: 8px 16px; background: #28a745; color: white; border: none; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 5px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            复制译文
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  }
}

// 翻译群组消息
function translateGroupMessage() {
  const input = document.getElementById('group-message-input');
  if (!input) {
    showToast('❌ 群聊输入框不存在', 'error');
    return;
  }
  
  const content = input.value.trim();
  if (!content) {
    showToast('⚠️ 请先输入要翻译的内容', 'warning');
    return;
  }
  
  // 弹出语言选择对话框
  showLanguageSelectionDialog(content, true); // 传递标志表示来自输入框
}

// 显示语言选择对话框
function showLanguageSelectionDialog(content, isFromInputBox = false) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 400px; min-width: 300px;">
      <div class="modal-header" style="border-bottom: 1px solid #eee; padding: 15px 20px; display: flex; justify-content: space-between; align-items: center;">
        <h3 style="margin: 0; display: flex; align-items: center; gap: 10px;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10 19H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"/>
            <polyline points="17 17 12 12 7 17"/>
            <polyline points="17 7 12 12 7 7"/>
            <line x1="12" y1="2" x2="12" y2="12"/>
          </svg>
          选择翻译语言
        </h3>
        <button class="modal-close" onclick="this.closest('.modal').remove()" style="font-size: 24px; line-height: 1; background: none; border: none; cursor: pointer; color: #999;">×</button>
      </div>
      <div class="modal-body" style="padding: 20px;">
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
          <button class="lang-btn" data-lang="en" style="padding: 10px; border: 1px solid #ddd; border-radius: 6px; cursor: pointer; background: white; transition: all 0.2s;">英语 (en)</button>
          <button class="lang-btn" data-lang="zh" style="padding: 10px; border: 1px solid #ddd; border-radius: 6px; cursor: pointer; background: white; transition: all 0.2s;">中文 (zh)</button>
          <button class="lang-btn" data-lang="ja" style="padding: 10px; border: 1px solid #ddd; border-radius: 6px; cursor: pointer; background: white; transition: all 0.2s;">日语 (ja)</button>
          <button class="lang-btn" data-lang="ko" style="padding: 10px; border: 1px solid #ddd; border-radius: 6px; cursor: pointer; background: white; transition: all 0.2s;">韩语 (ko)</button>
          <button class="lang-btn" data-lang="fr" style="padding: 10px; border: 1px solid #ddd; border-radius: 6px; cursor: pointer; background: white; transition: all 0.2s;">法语 (fr)</button>
          <button class="lang-btn" data-lang="de" style="padding: 10px; border: 1px solid #ddd; border-radius: 6px; cursor: pointer; background: white; transition: all 0.2s;">德语 (de)</button>
          <button class="lang-btn" data-lang="es" style="padding: 10px; border: 1px solid #ddd; border-radius: 6px; cursor: pointer; background: white; transition: all 0.2s;">西班牙语 (es)</button>
          <button class="lang-btn" data-lang="ru" style="padding: 10px; border: 1px solid #ddd; border-radius: 6px; cursor: pointer; background: white; transition: all 0.2s;">俄语 (ru)</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // 为语言按钮添加点击事件
  const langButtons = modal.querySelectorAll('.lang-btn');
  langButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const lang = btn.dataset.lang;
      modal.remove();
      if (isFromInputBox) {
        // 如果来自输入框，则直接翻译并填入输入框
        translateAndFillInput(content, lang);
      } else {
        // 如果来自消息气泡，则显示翻译结果
        translateMessage(content, lang);
      }
    });
  });
}

// 翻译并填入输入框
async function translateAndFillInput(content, toLang = 'en') {
  try {
    showToast('🌍 正在翻译...', 'info');
    
    // 调用API进行翻译
    const result = await apiService.translate(content, toLang);
    
    if (result.success) {
      const translatedText = result.data.translated_text || result.data.translate || result.data.text;
      
      // 尝试找到当前活跃的输入框并填入翻译结果
      const messageInput = document.getElementById('message-input');
      const groupMessageInput = document.getElementById('group-message-input');
      
      if (messageInput && messageInput.offsetParent !== null) {
        // 私聊输入框可见
        messageInput.value = translatedText;
        messageInput.focus();
      } else if (groupMessageInput && groupMessageInput.offsetParent !== null) {
        // 群聊输入框可见
        groupMessageInput.value = translatedText;
        groupMessageInput.focus();
      } else {
        // 如果都没有可见的输入框，则显示翻译结果
        showToast('✅ 翻译完成', 'success');
        
        // 创建临时显示翻译结果的弹窗
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
          <div class="modal-content" style="max-width: 500px; min-width: 300px;">
            <div class="modal-header" style="border-bottom: 1px solid #eee; padding: 15px 20px; display: flex; justify-content: space-between; align-items: center;">
              <h3 style="margin: 0; display: flex; align-items: center; gap: 10px;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M10 19H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"/>
                  <polyline points="17 17 12 12 7 17"/>
                  <polyline points="17 7 12 12 7 7"/>
                  <line x1="12" y1="2" x2="12" y2="12"/>
                </svg>
                翻译结果
              </h3>
              <button class="modal-close" onclick="this.closest('.modal').remove()" style="font-size: 24px; line-height: 1; background: none; border: none; cursor: pointer; color: #999;">×</button>
            </div>
            <div class="modal-body" style="padding: 20px;">
              <div style="margin-bottom: 15px;">
                <div style="font-weight: 500; color: #666; font-size: 14px; margin-bottom: 5px;">原文:</div>
                <div style="padding: 10px; background: #f8f9fa; border-radius: 6px; border-left: 3px solid #007bff; padding-left: 15px;">${content}</div>
              </div>
              <div>
                <div style="font-weight: 500; color: #666; font-size: 14px; margin-bottom: 5px;">译文:</div>
                <div style="padding: 10px; background: #e8f5e9; border-radius: 6px; border-left: 3px solid #28a745; padding-left: 15px; color: #28a745;">${translatedText}</div>
              </div>
            </div>
            <div class="modal-footer" style="border-top: 1px solid #eee; padding: 15px 20px; display: flex; justify-content: flex-end;">
              <button class="btn btn-primary" onclick="copyTranslatedText('${translatedText.replace(/'/g, "\\'").replace(/"/g, '&quot;')}', this)" style="padding: 8px 16px; background: #28a745; color: white; border: none; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 5px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                复制译文
              </button>
            </div>
          </div>
        `;
        
        document.body.appendChild(modal);
      }
      
      showToast('✅ 翻译完成', 'success');
    } else {
      showToast('❌ 翻译失败: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('翻译消息失败:', error);
    showToast('❌ 翻译失败: ' + error.message, 'error');
  }
}

/**
 * 进入多选模式
 */
let isMultiSelectMode = false;
let selectedMessages = [];

function enterMultiSelectMode(messageId) {
  isMultiSelectMode = true;
  selectedMessages = [messageId];
  
  // 显示多选工具栏
  showMultiSelectToolbar();
  
  // 给所有消息添加复选框
  const messagesContainer = document.getElementById('messages-container');
  messagesContainer.querySelectorAll('.message-group').forEach(group => {
    if (!group.classList.contains('multi-select-mode')) {
      group.classList.add('multi-select-mode');
      
      // 添加复选框
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'message-checkbox';
      const msgId = parseInt(group.dataset.messageId);
      checkbox.checked = selectedMessages.includes(msgId);
      checkbox.dataset.messageId = msgId;
      
      checkbox.addEventListener('change', (e) => {
        if (e.target.checked) {
          if (!selectedMessages.includes(msgId)) {
            selectedMessages.push(msgId);
            group.classList.add('selected');
          }
        } else {
          selectedMessages = selectedMessages.filter(id => id !== msgId);
          group.classList.remove('selected');
        }
        updateMultiSelectToolbar();
      });
      
      group.insertBefore(checkbox, group.firstChild);
      
      // 点击消息区域也可以切换选中状态
      group.addEventListener('click', (e) => {
        if (!e.target.classList.contains('message-checkbox')) {
          checkbox.checked = !checkbox.checked;
          checkbox.dispatchEvent(new Event('change'));
        }
      });
    }
  });
  
  hideContextMenu();
  showToast('☑️ 已进入多选模式', 'info');
}

/**
 * 显示多选工具栏
 */
function showMultiSelectToolbar() {
  // 删除旧的工具栏
  const oldToolbar = document.querySelector('.multi-select-toolbar');
  if (oldToolbar) oldToolbar.remove();
  
  const toolbar = document.createElement('div');
  toolbar.className = 'multi-select-toolbar';
  toolbar.innerHTML = `
    <div class="multi-select-info">已选择 <strong>${selectedMessages.length}</strong> 条</div>
    <div class="multi-select-actions">
      <button class="btn btn-secondary btn-small" onclick="exitMultiSelectMode()">取消</button>
      <button class="btn btn-primary btn-small" onclick="forwardSelectedMessages()">转发</button>
    </div>
  `;
  
  document.body.appendChild(toolbar);
}

/**
 * 更新多选工具栏
 */
function updateMultiSelectToolbar() {
  const info = document.querySelector('.multi-select-info');
  if (info) {
    info.innerHTML = `已选择 <strong>${selectedMessages.length}</strong> 条`;
  }
}

/**
 * 退出多选模式
 */
function exitMultiSelectMode() {
  isMultiSelectMode = false;
  selectedMessages = [];
  
  // 删除工具栏
  const toolbar = document.querySelector('.multi-select-toolbar');
  if (toolbar) toolbar.remove();
  
  // 删除所有复选框
  const messagesContainer = document.getElementById('messages-container');
  messagesContainer.querySelectorAll('.message-group').forEach(group => {
    group.classList.remove('multi-select-mode', 'selected');
    const checkbox = group.querySelector('.message-checkbox');
    if (checkbox) checkbox.remove();
  });
  
  showToast('✅ 已退出多选模式', 'success');
}

/**
 * 转发选中的消息
 */
async function forwardSelectedMessages() {
  if (selectedMessages.length === 0) {
    showToast('⚠️ 请至少选择一条消息', 'warning');
    return;
  }
  
  // 获取选中消息的内容
  const result = await apiService.getMessageHistory(apiService.currentUser.id, currentChatUser.id);
  if (!result.success) {
    showToast('⚠️ 加载失败', 'error');
    return;
  }
  
  const messages = result.data
    .filter(msg => selectedMessages.includes(msg.id))
    .map(msg => ({
      id: msg.id,
      content: msg.content
    }));
  
  // 退出多选模式
  exitMultiSelectMode();
  
  // 显示转发对话框
  showForwardDialog(messages);
}

/**
 * 收藏消息
 */
function favoriteMessage(messageId, content) {
  showToast('⭐ 已收藏', 'success');
  hideContextMenu();
}

/**
 * 处理文件选择
 */
async function handleFileSelect(input, type) {
  console.log('[File] handleFileSelect 被调用, type:', type);
  
  const file = input.files[0];
  console.log('[File] 选中的文件:', file);
  console.log('[File] currentChatUser:', currentChatUser);
  
  if (!file) {
    console.warn('[File] 没有选择文件');
    return;
  }
  
  if (!currentChatUser) {
    console.error('[File] currentChatUser 为空，无法发送文件');
    showToast('❌ 请先选择聊天对象', 'error');
    input.value = '';
    return;
  }
  
  // 文件大小限制 50MB
  const maxSize = 2048 * 1024 * 1024;
  if (file.size > maxSize) {
    showToast('❌ 文件大小不能超过 2GB', 'error');
    input.value = '';
    return;
  }
  
  showToast('📤 正在上传文件...', 'info');
  
  try {
    // 使用FormData上传文件到服务器
    const result = await apiService.uploadFile(
      file,
      apiService.currentUser.id,
      currentChatUser.id
    );
    
    if (result.success) {
      const fileMessage = result.data;
      console.log('[文件上传] 服务器返回:', fileMessage);
      
      // 构建消息内容（包含文件URL）
      const messageContent = {
        fileId: fileMessage.id,
        name: fileMessage.fileName,
        size: fileMessage.fileSize,
        type: fileMessage.fileType,
        url: fileMessage.fileUrl || `https://msg.v2.zhsdev.top/uploads/${fileMessage.id}`,
        mediaType: type
      };
      
      console.log('[文件上传] 构建消息内容:', messageContent);
      
      // 发送文件消息
      const sendResult = await apiService.sendMessage(
        apiService.currentUser.id,
        currentChatUser.id,
        JSON.stringify(messageContent),
        type.toUpperCase()
      );
      
      if (sendResult.success) {
        showToast('✅ 文件发送成功', 'success');
        loadMessageHistory(currentChatUser.id);
      } else {
        showToast('❌ 文件发送失败: ' + sendResult.error, 'error');
      }
    } else {
      showToast('❌ 文件上传失败: ' + result.error, 'error');
    }
    
    input.value = '';
  } catch (error) {
    console.error('[文件上传] 错误:', error);
    showToast('❌ 文件上传失败', 'error');
    input.value = '';
  }
}

/**
 * 处理群组文件选择
 */
async function handleGroupFileSelect(file, type) {
  console.log('[Group File] handleGroupFileSelect 被调用, type:', type);
  
  console.log('[Group File] 选中的文件:', file);
  console.log('[Group File] currentGroup:', currentGroup);
  
  if (!file) {
    console.warn('[Group File] 没有选择文件');
    return;
  }
  
  if (!currentGroup) {
    console.error('[Group File] currentGroup 为空，无法发送文件');
    showToast('❌ 请先进入群聊', 'error');
    return;
  }
  
  // 文件大小限制 2GB
  const maxSize = 2 * 1024 * 1024 * 1024; // 2GB
  if (file.size > maxSize) {
    showToast('❌ 文件大小不能超过 2GB', 'error');
    return;
  }
  
  showToast('📤 正在上传文件...', 'info');
  
  try {
    // 使用FormData上传文件到服务器
    const result = await apiService.uploadFile(
      file,
      apiService.currentUser.id,
      currentGroup.id
    );
    
    if (result.success) {
      const fileMessage = result.data;
      console.log('[群组文件上传] 服务器返回:', fileMessage);
      
      // 构建消息内容（包含文件URL）
      const messageContent = {
        fileId: fileMessage.id,
        name: fileMessage.fileName,
        size: fileMessage.fileSize,
        type: fileMessage.fileType,
        url: fileMessage.fileUrl || `https://msg.v2.zhsdev.top/uploads/${fileMessage.id}`,
        mediaType: type
      };
      
      console.log('[群组文件上传] 构建消息内容:', messageContent);
      
      // 发送群组文件消息
      const sendResult = await apiService.sendGroupMessage(
        currentGroup.id,
        apiService.currentUser.id,
        JSON.stringify(messageContent),
        type.toUpperCase()
      );
      
      if (sendResult.success) {
        showToast('✅ 文件发送成功', 'success');
        loadGroupMessages(currentGroup.id);
      } else {
        showToast('❌ 文件发送失败: ' + sendResult.error, 'error');
      }
    } else {
      showToast('❌ 文件上传失败: ' + result.error, 'error');
    }
    
  } catch (error) {
    console.error('[群组文件上传] 错误:', error);
    showToast('❌ 文件上传失败', 'error');
  }
}

/**
 * 获取文件类型
 */
function getFileType(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
  const videoExts = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv'];
  
  if (imageExts.includes(ext)) return 'image/' + ext;
  if (videoExts.includes(ext)) return 'video/' + ext;
  return 'application/octet-stream';
}

/**
 * 渲染通话消息
 */
function renderCallMessage(msg, isSent, callData) {
  const time = new Date(msg.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  
  // 生成头像 HTML
  const hasAvatar = currentChatUser.avatarUrl && currentChatUser.avatarUrl.trim() !== '';
  const friendAvatarHtml = hasAvatar
    ? `<div class="avatar avatar-small" style="background-image: url('${apiService.apiUrl}${currentChatUser.avatarUrl}'); background-size: cover; background-position: center;"></div>`
    : `<div class="avatar avatar-small">${currentChatUser.avatar}</div>`;
  
  const hasMyAvatar = apiService.currentUser.avatar && apiService.currentUser.avatar.startsWith('/');
  const myAvatarHtml = hasMyAvatar
    ? `<div class="avatar avatar-small" style="background-image: url('${apiService.apiUrl}${apiService.currentUser.avatar}'); background-size: cover; background-position: center;"></div>`
    : `<div class="avatar avatar-small">${apiService.currentUser.nickname?.charAt(0).toUpperCase()}</div>`;
  
  // 根据状态确定显示内容
  const status = callData.status || 'cancelled';
  const duration = callData.duration || 0;
  const isVideo = callData.isVideo || false;
  
  let statusText, iconSvg, iconColor;
  
  switch (status) {
    case 'connected':
      const mins = Math.floor(duration / 60).toString().padStart(2, '0');
      const secs = (duration % 60).toString().padStart(2, '0');
      statusText = `通话时长 ${mins}:${secs}`;
      iconColor = '#4CAF50';  // 绿色
      iconSvg = isVideo 
        ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="${iconColor}" stroke="${iconColor}" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`;
      break;
    case 'missed':
      statusText = '对方未接听';
      iconColor = '#9E9E9E';  // 灰色
      iconSvg = isVideo
        ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2"><line x1="23" y1="1" x2="17" y2="7"/><line x1="17" y1="1" x2="23" y2="7"/><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`;
      break;
    case 'rejected':
      statusText = '对方已拒绝';
      iconColor = '#9E9E9E';
      iconSvg = isVideo
        ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2"><line x1="23" y1="1" x2="17" y2="7"/><line x1="17" y1="1" x2="23" y2="7"/><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`;
      break;
    case 'cancelled':
    default:
      statusText = '已取消，点击重拨';
      iconColor = '#9E9E9E';
      iconSvg = isVideo
        ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2"><line x1="23" y1="1" x2="17" y2="7"/><line x1="17" y1="1" x2="23" y2="7"/><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`;
      break;
  }
  
  return `
    <div class="message-group ${isSent ? 'sent' : 'received'}" 
         data-message-id="${msg.id}" 
         data-is-sent="${isSent}">
      ${!isSent ? friendAvatarHtml : ''}
      <div class="message-content">
        <div class="message-time">${time}</div>
        <div class="message-bubble ${isSent ? 'sent' : 'received'} call-message" 
             data-msg-id="${msg.id}" 
             data-is-sent="${isSent}"
             style="cursor: pointer; display: inline-flex; align-items: center; gap: 8px; white-space: nowrap;">
          ${iconSvg}
          <span>${statusText}</span>
        </div>
      </div>
      ${isSent ? myAvatarHtml : ''}
    </div>
  `;
}

/**
 * 渲染引用消息
 */
function renderQuoteMessage(msg, isSent, quoteData) {
  const time = new Date(msg.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  const safeContent = XssUtil.sanitize(quoteData.content);
  const safeQuoteContent = XssUtil.sanitize(quoteData.quoteContent);
  
  // 生成头像 HTML
  const hasAvatar = currentChatUser.avatarUrl && currentChatUser.avatarUrl.trim() !== '';
  const friendAvatarHtml = hasAvatar
    ? `<div class="avatar avatar-small" style="background-image: url('${apiService.apiUrl}${currentChatUser.avatarUrl}'); background-size: cover; background-position: center;"></div>`
    : `<div class="avatar avatar-small">${currentChatUser.avatar}</div>`;
  
  const hasMyAvatar = apiService.currentUser.avatar && apiService.currentUser.avatar.startsWith('/');
  const myAvatarHtml = hasMyAvatar
    ? `<div class="avatar avatar-small" style="background-image: url('${apiService.apiUrl}${apiService.currentUser.avatar}'); background-size: cover; background-position: center;"></div>`
    : `<div class="avatar avatar-small">${apiService.currentUser.nickname?.charAt(0).toUpperCase()}</div>`;
  
  return `
    <div class="message-group ${isSent ? 'sent' : 'received'}" 
         data-message-id="${msg.id}" 
         data-is-sent="${isSent}">
      ${!isSent ? friendAvatarHtml : ''}
      <div class="message-content">
        <div class="message-time">${time}</div>
        <div class="message-bubble ${isSent ? 'sent' : 'received'}" 
             data-msg-id="${msg.id}" 
             data-is-sent="${isSent}"
             data-content='${JSON.stringify(quoteData)}'>
          <div class="quote-reference" onclick="scrollToMessage(${quoteData.quoteMessageId})">
            <div class="quote-line"></div>
            <div class="quote-content">${safeQuoteContent}</div>
          </div>
          <div class="quote-reply-content">${safeContent}</div>
        </div>
      </div>
      ${isSent ? myAvatarHtml : ''}
    </div>
  `;
}

/**
 * 滚动到指定消息
 */
function scrollToMessage(messageId) {
  const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
  if (messageElement) {
    messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // 高亮显示
    messageElement.classList.add('highlight');
    setTimeout(() => {
      messageElement.classList.remove('highlight');
    }, 2000);
  } else {
    showToast('⚠️ 消息已被删除或不存在', 'warning');
  }
}

/**
 * 渲染聊天记录卡片
 */
function renderChatHistoryCard(msg, isSent, cardData) {
  const time = new Date(msg.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  
  // 生成头像 HTML
  const hasAvatar = currentChatUser.avatarUrl && currentChatUser.avatarUrl.trim() !== '';
  const friendAvatarHtml = hasAvatar
    ? `<div class="avatar avatar-small" style="background-image: url('${apiService.apiUrl}${currentChatUser.avatarUrl}'); background-size: cover; background-position: center;"></div>`
    : `<div class="avatar avatar-small">${currentChatUser.avatar}</div>`;
  
  const hasMyAvatar = apiService.currentUser.avatar && apiService.currentUser.avatar.startsWith('/');
  const myAvatarHtml = hasMyAvatar
    ? `<div class="avatar avatar-small" style="background-image: url('${apiService.apiUrl}${apiService.currentUser.avatar}'); background-size: cover; background-position: center;"></div>`
    : `<div class="avatar avatar-small">${apiService.currentUser.nickname?.charAt(0).toUpperCase()}</div>`;
  
  // 生成预览内容（最多显示3条）
  const previewMessages = cardData.messages.slice(0, 3);
  const previewHtml = previewMessages.map(m => {
    // 解析消息内容，支持多种类型
    let displayContent = m.content;
    try {
      const parsed = JSON.parse(m.content);
      if (parsed.type === 'quote') {
        displayContent = `[引用] ${parsed.content}`;
      } else if (parsed.type === 'chat_history') {
        displayContent = `[聊天记录] ${parsed.count}条消息`;
      } else if (parsed.mediaType === 'image') {
        displayContent = `[图片] ${parsed.name || '图片文件'}`;
      } else if (parsed.mediaType === 'video') {
        displayContent = `[视频] ${parsed.name || '视频文件'}`;
      } else if (parsed.mediaType === 'file') {
        displayContent = `[文件] ${parsed.name || '文件'}`;
      } else if (parsed.fileId || parsed.url) {
        // 其他文件消息格式
        displayContent = `[文件] ${parsed.name || '文件'}`;
      }
    } catch (e) {
      // 不是JSON，保持原样
    }
    
    return `
      <div class="chat-history-preview-line">
        <span class="chat-history-preview-name">${XssUtil.sanitize(m.sender)}:</span>
        <span class="chat-history-preview-content">${XssUtil.sanitize(displayContent)}</span>
      </div>
    `;
  }).join('');
  
  return `
    <div class="message-group ${isSent ? 'sent' : 'received'}" 
         data-message-id="${msg.id}" 
         data-is-sent="${isSent}">
      ${!isSent ? friendAvatarHtml : ''}
      <div class="message-content">
        <div class="message-time">${time}</div>
        <div class="chat-history-card" 
             onclick="showChatHistoryDetail(${msg.id})"
             data-msg-id="${msg.id}" 
             data-is-sent="${isSent}"
             data-content='${JSON.stringify(cardData)}'>
          <div class="chat-history-header">
            <span class="chat-history-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                <line x1="9" y1="10" x2="15" y2="10"/>
                <line x1="9" y1="14" x2="13" y2="14"/>
              </svg>
            </span>
            <span class="chat-history-title">${XssUtil.sanitize(cardData.title)}</span>
          </div>
          <div class="chat-history-preview">
            ${previewHtml}
          </div>
          <div class="chat-history-footer">
            查看 ${cardData.count} 条聊天记录
          </div>
        </div>
      </div>
      ${isSent ? myAvatarHtml : ''}
    </div>
  `;
}

/**
 * 显示聊天记录详情
 */
async function showChatHistoryDetail(messageId) {
  // 获取消息内容
  const result = await apiService.getMessageHistory(apiService.currentUser.id, currentChatUser.id);
  if (!result.success) {
    showToast('⚠️ 加载失败', 'error');
    return;
  }
  
  const message = result.data.find(m => m.id === messageId);
  if (!message) {
    showToast('⚠️ 消息不存在', 'error');
    return;
  }
  
  let cardData;
  try {
    cardData = JSON.parse(message.content);
  } catch (e) {
    showToast('⚠️ 数据解析失败', 'error');
    return;
  }
  
  // 使用 IPC 打开新窗口
  ipcRenderer.send('open-chat-history', cardData);
}

/**
 * 渲染文件消息
 */
function renderFileMessage(msg, isSent) {
  try {
    // 解码HTML实体（处理后端的&quot;转义）
    let content = msg.content;
    if (content.includes('&quot;')) {
      content = content.replace(/&quot;/g, '"')
                      .replace(/&amp;/g, '&')
                      .replace(/&lt;/g, '<')
                      .replace(/&gt;/g, '>')
                      .replace(/&#x27;/g, "'");
    }
    
    const fileData = JSON.parse(content);
    const time = new Date(msg.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    
    // 文件URL（从服务器获取）
    const fileUrl = fileData.url || '';
    
    // 生成头像HTML
    const hasAvatar = currentChatUser?.avatarUrl && currentChatUser.avatarUrl.trim() !== '';
    const friendAvatarHtml = hasAvatar
      ? `<div class="avatar avatar-small" style="background-image: url('${apiService.apiUrl}${currentChatUser.avatarUrl}'); background-size: cover; background-position: center;"></div>`
      : `<div class="avatar avatar-small">${currentChatUser?.avatar || 'U'}</div>`;
    
    const hasMyAvatar = apiService.currentUser?.avatar && apiService.currentUser.avatar.startsWith('/');
    const myAvatarHtml = hasMyAvatar
      ? `<div class="avatar avatar-small" style="background-image: url('${apiService.apiUrl}${apiService.currentUser.avatar}'); background-size: cover; background-position: center;"></div>`
      : `<div class="avatar avatar-small">${apiService.currentUser?.nickname?.charAt(0).toUpperCase() || 'U'}</div>`;
    
    if (fileData.mediaType === 'image') {
      return `
        <div class="message-group ${isSent ? 'sent' : 'received'}" 
             data-message-id="${msg.id}" 
             data-is-sent="${isSent}">
          ${!isSent ? friendAvatarHtml : ''}
          <div class="message-content">
            <div class="message-time">${time}</div>
            <div class="message-bubble ${isSent ? 'sent' : 'received'} image-message" 
                 data-msg-id="${msg.id}"
                 data-is-sent="${isSent}"
                 data-content='${escapeHtml(content)}'
                 onclick="openMediaViewer('${fileUrl}', 'image', '${escapeHtml(fileData.name)}')">
              <img src="${fileUrl}" alt="${escapeHtml(fileData.name)}" class="message-image" 
                   onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22%3E🖼️%3C/text%3E%3C/svg%3E'">
            </div>
          </div>
          ${isSent ? myAvatarHtml : ''}
        </div>
      `;
    } else if (fileData.mediaType === 'video') {
      return `
        <div class="message-group ${isSent ? 'sent' : 'received'}"
             data-message-id="${msg.id}"
             data-is-sent="${isSent}">
          ${!isSent ? friendAvatarHtml : ''}
          <div class="message-content">
            <div class="message-time">${time}</div>
            <div class="message-bubble ${isSent ? 'sent' : 'received'} video-message"
                 data-msg-id="${msg.id}"
                 data-is-sent="${isSent}"
                 data-content='${escapeHtml(content)}'
                 onclick="openMediaViewer('${fileUrl}', 'video', '${escapeHtml(fileData.name)}')">
              <div class="video-placeholder">
                <svg class="play-icon" width="48" height="48" viewBox="0 0 24 24" fill="white">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
                <div class="video-info">${escapeHtml(fileData.name)}</div>
              </div>
            </div>
          </div>
          ${isSent ? myAvatarHtml : ''}
        </div>
      `;
    } else {
      const fileSize = formatFileSize(fileData.size);
      return `
        <div class="message-group ${isSent ? 'sent' : 'received'}"
             data-message-id="${msg.id}"
             data-is-sent="${isSent}">
          ${!isSent ? friendAvatarHtml : ''}
          <div class="message-content">
            <div class="message-time">${time}</div>
            <div class="message-bubble ${isSent ? 'sent' : 'received'} file-message"
                 data-msg-id="${msg.id}"
                 data-is-sent="${isSent}"
                 data-content='${escapeHtml(content)}'>
              <svg class="file-icon" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
                <polyline points="13 2 13 9 20 9"/>
              </svg>
              <div class="file-info">
                <div class="file-name">${escapeHtml(fileData.name)}</div>
                <div class="file-size">${fileSize}</div>
              </div>
              <a href="${fileUrl}" download="${escapeHtml(fileData.name)}" class="file-download-btn" onclick="event.stopPropagation()">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                </svg>
              </a>
            </div>
          </div>
          ${isSent ? myAvatarHtml : ''}
        </div>
      `;
    }
  } catch (error) {
    console.error('[文件消息] 渲染错误:', error, '原始内容:', msg.content);
    return '';
  }
}

/**
 * 转义HTML
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 格式化文件大小
 */
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * 下载文件
 */
function downloadFile(dataUrl, filename) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
  showToast('✅ 文件已下载', 'success');
}

/**
 * 打开媒体查看器
 */
function openMediaViewer(dataUrl, type, filename) {
  const { ipcRenderer } = require('electron');
  
  // 发送IPC消息打开新窗口
  ipcRenderer.send('open-media-viewer', {
    url: dataUrl,
    type: type,
    filename: filename
  });
}

// 导出全局函数
window.openChat = openChat;
window.sendFriendRequest = sendFriendRequest;
window.acceptRequest = acceptRequest;
window.rejectRequest = rejectRequest;
window.sendMessage = sendMessage;
window.closeMobileChat = closeMobileChat;
window.showContextMenu = showContextMenu;
window.copyMessage = copyMessage;
window.recallMessage = recallMessage;
window.quoteMessage = quoteMessage;
window.forwardMessage = forwardMessage;
window.translateMessage = translateMessage;
window.enterMultiSelectMode = enterMultiSelectMode;
window.favoriteMessage = favoriteMessage;
window.openMediaViewer = openMediaViewer;
window.downloadFile = downloadFile;
window.createGroup = createGroup;
window.submitCreateGroup = submitCreateGroup;
window.removeGroupMember = removeGroupMember;
window.confirmRemoveGroupMember = confirmRemoveGroupMember;
window.inviteToGroup = inviteToGroup;
window.sendGroupInvites = sendGroupInvites;
window.selectGroupImage = selectGroupImage;
window.selectGroupVideo = selectGroupVideo;
window.selectGroupFile = selectGroupFile;
window.showGroupSettings = showGroupSettings;
window.saveGroupSettings = saveGroupSettings;
window.openGroupChat = openGroupChat;
window.sendGroupMessage = sendGroupMessage;
window.showGroupMembers = showGroupMembers;
window.setGroupAdmin = setGroupAdmin;
window.respondToFriendRequest = respondToFriendRequest;
window.respondToGroupRequest = respondToGroupRequest;
window.scrollToMessage = scrollToMessage;
window.cancelQuote = cancelQuote;
window.showChatHistoryDetail = showChatHistoryDetail;
window.handleForwardSingle = handleForwardSingle;
window.handleForwardMerge = handleForwardMerge;
window.exitMultiSelectMode = exitMultiSelectMode;
window.forwardSelectedMessages = forwardSelectedMessages;

// 补充导出可能缺失的全局函数
window.openAdminPanel = openAdminPanel;
window.copyTranslatedText = copyTranslatedText;
window.showLanguageSelectionDialog = showLanguageSelectionDialog;
window.translateAndFillInput = translateAndFillInput;
window.showMultiSelectToolbar = showMultiSelectToolbar;
window.updateMultiSelectToolbar = updateMultiSelectToolbar;
window.showForwardDialog = showForwardDialog;
window.renderForwardList = renderForwardList;
window.handleFileSelect = handleFileSelect;
window.renderQuoteMessage = renderQuoteMessage;
window.renderChatHistoryCard = renderChatHistoryCard;
window.renderFileMessage = renderFileMessage;
window.escapeHtml = escapeHtml;
window.formatFileSize = formatFileSize;
window.getSVGIcon = getSVGIcon;
window.fetchWithAuth = fetchWithAuth;
window.loadGroupsList = loadGroupsList;
window.renderGroupsList = renderGroupsList;
window.showGroupNotifications = showGroupNotifications;
window.showFriendNotifications = showFriendNotifications;
window.displayNotificationsInChat = displayNotificationsInChat;
window.loadFriendNotificationsInChat = loadFriendNotificationsInChat;
window.loadGroupNotificationsInChat = loadGroupNotificationsInChat;
window.showJoinGroupDialog = showJoinGroupDialog;
window.handleJoinGroup = handleJoinGroup;
window.markGroupNotificationAsRead = markGroupNotificationAsRead;
window.loadNotificationCounts = loadNotificationCounts;
window.addUnreadMessage = addUnreadMessage;
window.clearUnreadMessages = clearUnreadMessages;
window.addUnreadGroupMessage = addUnreadGroupMessage;
window.clearUnreadGroupMessages = clearUnreadGroupMessages;
window.loadUnreadMessages = loadUnreadMessages;
window.openMediaViewer = openMediaViewer;
window.downloadFile = downloadFile;

// 群组管理相关函数导出
window.muteGroupMember = muteGroupMember;
window.kickGroupMember = kickGroupMember;
window.toggleAdminRole = toggleAdminRole;
window.openPrivateChat = openPrivateChat;
window.viewMemberProfile = viewMemberProfile;
window.leaveGroup = leaveGroup;
window.clearGroupChat = clearGroupChat;
window.toggleGroupMute = toggleGroupMute;
window.toggleGroupPin = toggleGroupPin;
window.showGroupQRCode = showGroupQRCode;
window.toggleGroupPanel = toggleGroupPanel;
window.toggleMemberSearch = toggleMemberSearch;
window.filterGroupMembers = filterGroupMembers;
window.editGroupAnnouncement = editGroupAnnouncement;
window.saveGroupAnnouncement = saveGroupAnnouncement;
window.showAllAnnouncements = showAllAnnouncements;
window.showGroupMoreMenu = showGroupMoreMenu;
window.showMemberActionMenu = showMemberActionMenu;

/**
 * 右键菜单功能 - 图片/视频消息
 */
const contextMenu = document.getElementById('message-context-menu');
let currentMediaData = null;

// 监听消息区域的右键点击
const messagesContainer = document.getElementById('messages-container');
if (messagesContainer) {
  messagesContainer.addEventListener('contextmenu', (e) => {
    // 检查是否点击在图片/视频上
    const imageMsg = e.target.closest('.image-message');
    const videoMsg = e.target.closest('.video-message');
    
    if (imageMsg || videoMsg) {
      e.preventDefault();
      
      // 获取媒体信息
      const mediaElement = imageMsg?.querySelector('img') || videoMsg?.querySelector('video');
      if (mediaElement) {
        currentMediaData = {
          url: mediaElement.src || mediaElement.querySelector('source')?.src,
          type: imageMsg ? 'image' : 'video',
          filename: mediaElement.alt || 'media'
        };
        
        // 显示菜单
        contextMenu.style.left = e.clientX + 'px';
        contextMenu.style.top = e.clientY + 'px';
        contextMenu.classList.add('show');
        
        // 根据类型显示/隐藏菜单项
        const copyImageItem = document.getElementById('menu-copy-image');
        if (copyImageItem) {
          copyImageItem.style.display = imageMsg ? 'flex' : 'none';
        }
        
        console.log('[聊天界面] 右键菜单显示:', currentMediaData);
      }
    }
  });
}

// 点击其他地方关闭菜单
document.addEventListener('click', (e) => {
  if (!contextMenu.contains(e.target)) {
    contextMenu.classList.remove('show');
  }
});

// 另存为功能
document.getElementById('menu-save-as')?.addEventListener('click', async () => {
  contextMenu.classList.remove('show');
  if (!currentMediaData) return;
  
  try {
    const { ipcRenderer } = require('electron');
    console.log('[聊天界面] 调用另存为:', currentMediaData);
    
    const result = await ipcRenderer.invoke('save-media-file', {
      url: currentMediaData.url,
      filename: currentMediaData.filename
    });
    
    if (result.success) {
      console.log('[聊天界面] 文件已保存:', result.path);
      showToast('✅ 文件已保存', 'success');
    } else if (!result.canceled) {
      console.error('[聊天界面] 保存失败:', result.error);
      showToast('❌ 保存失败', 'error');
    }
  } catch (error) {
    console.error('[聊天界面] IPC调用失败:', error);
    showToast('❌ 保存失败', 'error');
  }
});

// 复制图片功能
document.getElementById('menu-copy-image')?.addEventListener('click', async () => {
  contextMenu.classList.remove('show');
  if (!currentMediaData || currentMediaData.type !== 'image') return;
  
  try {
    const { clipboard, nativeImage } = require('electron');
    const image = nativeImage.createFromDataURL(currentMediaData.url);
    clipboard.writeImage(image);
    console.log('[聊天界面] 图片已复制');
    showToast('✅ 图片已复制', 'success');
  } catch (error) {
    console.error('[聊天界面] 复制图片失败:', error);
    showToast('❌ 复制失败', 'error');
  }
});

// ==================== 群组功能 ====================
let groupsList = [];
let currentGroup = null;

// SVG 图标库
const SVGIcons = {
  users: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  message: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  search: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>',
  inbox: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>',
  user: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  check: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
  x: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  ban: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>',
  star: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  mail: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
  bell: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
  megaphone: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 11 18-5v12L3 13v-2z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>',
  settings: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v6M5.6 5.6l4.2 4.2m4.2 4.2 4.2 4.2M1 12h6m6 0h6M5.6 18.4l4.2-4.2m4.2-4.2 4.2-4.2"/></svg>',
  camera: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
  file: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>',
  plus: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  loader: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>',
  arrowDown: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>',
  translate: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 19H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"/><polyline points="17 17 12 12 7 17"/><polyline points="17 7 12 12 7 7"/><line x1="12" y1="2" x2="12" y2="12"/></svg>'
};

// 获取 SVG 图标
function getSVGIcon(name, size = 24, className = '') {
  const icon = SVGIcons[name];
  if (!icon) return '';
  return icon.replace('width="24"', `width="${size}"`)
             .replace('height="24"', `height="${size}"`)
             .replace('<svg', `<svg class="${className}"`);
}

// 创建带 Token 的 fetch 请求辅助函数
function fetchWithAuth(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  // 添加 Authorization Token
  if (apiService.authToken) {
    headers['Authorization'] = `Bearer ${apiService.authToken}`;
  }
  
  return fetch(url, {
    ...options,
    headers
  });
}

// 联系人标签切换
if (document.querySelector('.contact-tabs')) {
  document.querySelectorAll('.contact-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      
      document.querySelectorAll('.contact-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      tab.classList.add('active');
      document.getElementById(`${tabName}-tab`).classList.add('active');
    });
  });
}

// 创建群组按钮
if (document.getElementById('create-group-btn')) {
  document.getElementById('create-group-btn').addEventListener('click', createGroup);
}

// 查找群按钮
if (document.getElementById('search-group-btn')) {
  document.getElementById('search-group-btn').addEventListener('click', showSearchGroupDialog);
}

/**
 * 显示查找群对话框
 */
function showSearchGroupDialog() {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 500px;">
      <div class="modal-header">
        <h3><i class="fas fa-search" style="color:var(--primary-color);margin-right:8px;"></i>查找群聊</h3>
        <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
      </div>
      <div class="modal-body">
        <div class="input-group">
          <label>群号</label>
          <div style="display:flex;gap:10px;">
            <input type="number" id="search-group-number" placeholder="输入群号 (如: 10000001)" 
                   style="flex:1;" min="10000001" max="999999999999">
            <button class="btn btn-primary" onclick="searchGroupByNumber()">查找</button>
          </div>
          <div style="font-size:12px;color:var(--text-secondary);margin-top:5px;">
            群号范围: 10000001 - 999999999999
          </div>
        </div>
        <div class="search-divider" style="display:flex;align-items:center;margin:20px 0;gap:10px;">
          <div style="flex:1;height:1px;background:var(--border-color);"></div>
          <span style="color:var(--text-secondary);font-size:13px;">或者</span>
          <div style="flex:1;height:1px;background:var(--border-color);"></div>
        </div>
        <div class="input-group">
          <label>群名称</label>
          <div style="display:flex;gap:10px;">
            <input type="text" id="search-group-name" placeholder="输入群名称关键字" style="flex:1;">
            <button class="btn btn-secondary" onclick="searchGroupByName()">搜索</button>
          </div>
        </div>
        <div id="search-group-results" style="margin-top:20px;"></div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  document.getElementById('search-group-number').focus();
  
  // 绑定回车搜索
  document.getElementById('search-group-number').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') searchGroupByNumber();
  });
  document.getElementById('search-group-name').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') searchGroupByName();
  });
}

/**
 * 按群号查找群
 */
async function searchGroupByNumber() {
  const groupNumber = document.getElementById('search-group-number').value.trim();
  if (!groupNumber) {
    showToast('请输入群号', 'warning');
    return;
  }
  
  const resultsContainer = document.getElementById('search-group-results');
  resultsContainer.innerHTML = '<div style="text-align:center;padding:20px;"><i class="fas fa-spinner fa-spin"></i> 搜索中...</div>';
  
  try {
    const response = await fetchWithAuth(`${apiService.apiUrl}/api/groups/search/number/${groupNumber}`);
    const result = await response.json();
    
    if (result.found && result.group) {
      resultsContainer.innerHTML = renderGroupSearchResult(result.group);
    } else {
      resultsContainer.innerHTML = `
        <div class="empty-state" style="padding:30px;text-align:center;">
          <i class="fas fa-search" style="font-size:40px;opacity:0.3;margin-bottom:15px;"></i>
          <p style="color:var(--text-secondary);">未找到群号为 ${groupNumber} 的群聊</p>
        </div>
      `;
    }
  } catch (error) {
    console.error('查找群失败:', error);
    resultsContainer.innerHTML = '<div style="text-align:center;padding:20px;color:var(--danger-color);">查找失败，请重试</div>';
  }
}

/**
 * 按群名搜索群
 */
async function searchGroupByName() {
  const keyword = document.getElementById('search-group-name').value.trim();
  if (!keyword) {
    showToast('请输入群名称关键字', 'warning');
    return;
  }
  
  const resultsContainer = document.getElementById('search-group-results');
  resultsContainer.innerHTML = '<div style="text-align:center;padding:20px;"><i class="fas fa-spinner fa-spin"></i> 搜索中...</div>';
  
  try {
    const response = await fetchWithAuth(`${apiService.apiUrl}/api/groups/search/name?keyword=${encodeURIComponent(keyword)}`);
    const groups = await response.json();
    
    if (groups && groups.length > 0) {
      resultsContainer.innerHTML = `
        <div style="font-size:13px;color:var(--text-secondary);margin-bottom:10px;">找到 ${groups.length} 个群聊</div>
        ${groups.map(g => renderGroupSearchResult(g)).join('')}
      `;
    } else {
      resultsContainer.innerHTML = `
        <div class="empty-state" style="padding:30px;text-align:center;">
          <i class="fas fa-search" style="font-size:40px;opacity:0.3;margin-bottom:15px;"></i>
          <p style="color:var(--text-secondary);">未找到名称包含 "${keyword}" 的群聊</p>
        </div>
      `;
    }
  } catch (error) {
    console.error('搜索群失败:', error);
    resultsContainer.innerHTML = '<div style="text-align:center;padding:20px;color:var(--danger-color);">搜索失败，请重试</div>';
  }
}

/**
 * 渲染群搜索结果卡片
 */
function renderGroupSearchResult(group) {
  const firstChar = group.groupName?.charAt(0).toUpperCase() || 'G';
  const groupNumber = group.groupNumber || '暂无';
  
  return `
    <div class="search-group-card" style="
      display: flex;
      align-items: center;
      padding: 15px;
      background: var(--card-bg);
      border-radius: 10px;
      margin-bottom: 10px;
      border: 1px solid var(--border-color);
    ">
      <div class="avatar" style="
        width: 50px;
        height: 50px;
        border-radius: 10px;
        background: var(--primary-color);
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        font-weight: bold;
        margin-right: 15px;
        flex-shrink: 0;
      ">${firstChar}</div>
      <div style="flex: 1; min-width: 0;">
        <div style="font-weight: 500; font-size: 15px; margin-bottom: 4px;">${XssUtil.sanitize(group.groupName)}</div>
        <div style="font-size: 12px; color: var(--text-secondary);">群号: ${groupNumber}</div>
        ${group.description ? `<div style="font-size: 13px; color: var(--text-secondary); margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${XssUtil.sanitize(group.description)}</div>` : ''}
      </div>
      <button class="btn btn-primary btn-small" onclick="applyJoinGroup(${group.id}, '${XssUtil.sanitize(group.groupName)}')"
              style="flex-shrink: 0; margin-left: 10px;">
        <i class="fas fa-user-plus"></i> 申请加入
      </button>
    </div>
  `;
}

/**
 * 申请加入群
 */
async function applyJoinGroup(groupId, groupName) {
  try {
    const response = await fetchWithAuth(`${apiService.apiUrl}/api/groups/${groupId}/join`, {
      method: 'POST',
      body: JSON.stringify({ userId: apiService.currentUser.id })
    });
    
    const result = await response.json();
    
    if (result.joined) {
      showToast('✅ 已加入群聊', 'success');
      document.querySelector('.modal')?.remove();
      loadGroupsList();
    } else if (result.requireApproval) {
      showToast('✅ 申请已发送，等待管理员审核', 'success');
      document.querySelector('.modal')?.remove();
    } else {
      showToast(result.message || '申请失败', 'error');
    }
  } catch (error) {
    console.error('申请加入群失败:', error);
    showToast('❌ 申请失败', 'error');
  }
}

window.showSearchGroupDialog = showSearchGroupDialog;
window.searchGroupByNumber = searchGroupByNumber;
window.searchGroupByName = searchGroupByName;
window.applyJoinGroup = applyJoinGroup;

// 好友通知按钮
if (document.getElementById('friend-notifications-btn')) {
  document.getElementById('friend-notifications-btn').addEventListener('click', showFriendNotifications);
}

// 群聊通知按钮
if (document.getElementById('group-notifications-btn')) {
  document.getElementById('group-notifications-btn').addEventListener('click', showGroupNotifications);
}

// 加载群组列表
// 加载群组列表
async function loadGroupsList() {
  try {
    const response = await fetchWithAuth(`${apiService.apiUrl}/api/groups/user/${apiService.currentUser.id}`);
    const groupMembers = await response.json();
    
    // 获取每个群组的详细信息
    const groupsPromises = groupMembers.map(async (member) => {
      const groupResponse = await fetchWithAuth(`${apiService.apiUrl}/api/groups/${member.groupId}`);
      const group = await groupResponse.json();
      return { ...group, userRole: member.role };
    });
    
    groupsList = await Promise.all(groupsPromises);
    renderGroupsList(groupsList);
    renderChatsList(); // 更新聊天列表
  } catch (error) {
    console.error('加载群组列表失败:', error);
  }
}

// 渲染群组列表
function renderGroupsList(groups) {
  const container = document.getElementById('group-list');
  
  if (!container) return;
  
  if (groups.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${getSVGIcon('users', 48)}</div>
        <p>暂无群组</p>
        <p class="text-small text-muted">创建或加入群组吧！</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = groups.map(group => {
    const firstChar = group.groupName.charAt(0).toUpperCase();
    const roleText = group.userRole === 'OWNER' ? '群主' : group.userRole === 'ADMIN' ? '管理员' : '成员';
    
    return `
      <div class="group-item" data-group-id="${group.id}" onclick="openGroupChat(${group.id})">
        <div class="avatar">${firstChar}</div>
        <div class="group-item-info">
          <div class="group-item-header">
            <div class="group-name">${group.groupName}</div>
            <div class="group-member-count">${roleText}</div>
          </div>
          <div class="group-description">${group.description || '暂无群简介'}</div>
        </div>
      </div>
    `;
  }).join('');
}

// 创建群组
function createGroup() {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>创建群组</h3>
        <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
      </div>
      <div class="modal-body">
        <div class="input-group">
          <label>群组名称 *</label>
          <input type="text" id="new-group-name" placeholder="请输入群组名称" required>
        </div>
        <div class="input-group">
          <label>群组简介</label>
          <textarea id="new-group-description" placeholder="请输入群组简介（可选）" rows="3"></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">取消</button>
        <button class="btn btn-primary" onclick="submitCreateGroup()">创建</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  document.getElementById('new-group-name').focus();
}

// 提交创建群组
async function submitCreateGroup() {
  const groupName = document.getElementById('new-group-name').value.trim();
  const description = document.getElementById('new-group-description').value.trim();
  
  if (!groupName) {
    showToast('⚠️ 请输入群组名称', 'warning');
    return;
  }
  
  try {
    const response = await fetchWithAuth(`${apiService.apiUrl}/api/groups/create`, {
      method: 'POST',
      body: JSON.stringify({
        groupName,
        description: description || '',
        ownerId: apiService.currentUser.id
      })
    });
    
    if (response.ok) {
      showToast('✅ 群组创建成功', 'success');
      loadGroupsList();
      // 关闭弹窗
      document.querySelector('.modal').remove();
    } else {
      const error = await response.json();
      showToast(`❌ 创建失败: ${error.message || '未知错误'}`, 'error');
    }
  } catch (error) {
    console.error('创建群组失败:', error);
    showToast('❌ 创建失败', 'error');
  }
}

// 打开群组聊天
async function openGroupChat(groupId) {
  try {
    // 获取群组信息
    const groupResponse = await fetchWithAuth(`${apiService.apiUrl}/api/groups/${groupId}`);
    currentGroup = await groupResponse.json();
    
    // 获取群成员信息
    const membersResponse = await fetchWithAuth(`${apiService.apiUrl}/api/groups/${groupId}/members`);
    const members = await membersResponse.json();
    
    // 获取所有成员的详细信息
    const membersWithUsers = await Promise.all(members.map(async (member) => {
      try {
        const userResponse = await fetchWithAuth(`${apiService.apiUrl}/api/users/${member.userId}`);
        const user = await userResponse.json();
        return { ...member, user };
      } catch (e) {
        return { ...member, user: { nickname: `用户${member.userId}`, username: `user${member.userId}` } };
      }
    }));
    
    // 获取当前用户的角色
    const currentMember = members.find(m => m.userId === apiService.currentUser.id);
    const isAdmin = currentMember && (currentMember.role === 'ADMIN' || currentMember.role === 'OWNER');
    const isOwner = currentMember && currentMember.role === 'OWNER';
    
    // 将用户角色信息添加到 currentGroup 对象中
    if (currentMember) {
      currentGroup.userRole = currentMember.role;
    }
    
    // 清除该群组的未读消息
    clearUnreadGroupMessages(groupId);
    renderChatsList();
    
    // 标记数据库中的群组消息为已读
    apiService.markGroupMessagesAsRead(groupId, apiService.currentUser.id).then(result => {
      if (result.success) {
        console.log(`[群组已读标记] 已将群组 ${groupId} 中来自其他用户的未读消息标记为已读`);
      }
    });
    
    // 显示聊天区域 - QQ风格布局
    const chatDetail = document.getElementById('chat-detail');
    const firstChar = currentGroup.groupName.charAt(0).toUpperCase();
    
    // 排序成员：群主 > 管理员 > 普通成员
    const sortedMembers = membersWithUsers.sort((a, b) => {
      const roleOrder = { 'OWNER': 0, 'ADMIN': 1, 'MEMBER': 2 };
      return (roleOrder[a.role] || 2) - (roleOrder[b.role] || 2);
    });
    
    // 生成成员列表HTML
    const membersHtml = sortedMembers.map(member => {
      const name = member.user?.nickname || member.user?.username || `用户${member.userId}`;
      const avatar = member.user?.avatar;
      const firstChar = name.charAt(0).toUpperCase();
      const hasAvatar = avatar && avatar.trim() !== '';
      
      let roleClass = '';
      let roleTag = '';
      if (member.role === 'OWNER') {
        roleClass = 'role-owner';
        roleTag = '<span class="member-role-tag owner">群主</span>';
      } else if (member.role === 'ADMIN') {
        roleClass = 'role-admin';
        roleTag = '<span class="member-role-tag admin">管理</span>';
      }
      
      const avatarHtml = hasAvatar
        ? `<div class="member-avatar" style="background-image: url('${apiService.apiUrl}${avatar}');"></div>`
        : `<div class="member-avatar">${firstChar}</div>`;
      
      return `
        <div class="group-member-item ${roleClass}" data-user-id="${member.userId}">
          ${avatarHtml}
          <div class="member-name-row">
            <span class="member-nickname">${name}</span>
            ${roleTag}
          </div>
        </div>
      `;
    }).join('');
    
    chatDetail.innerHTML = `
      <div class="group-chat-layout">
        <!-- 左侧聊天区域 -->
        <div class="group-chat-main">
          <div class="chat-header">
            <button class="back-btn" onclick="closeMobileChat()">←</button>
            <div class="group-chat-info">
              <div class="avatar" onclick="showGroupInfoDialog(${groupId})" style="cursor:pointer;" title="点击查看群资料">${firstChar}</div>
              <div class="chat-user-info">
                <div class="chat-user-name group-name-editable" 
                     id="group-name-display" 
                     data-group-id="${groupId}"
                     data-can-edit="${isAdmin}"
                     ondblclick="${isAdmin ? `startEditGroupName(${groupId})` : ''}">${XssUtil.sanitize(currentGroup.groupName)}</div>
                <div class="chat-user-status">${members.length} 成员</div>
              </div>
            </div>
            <div class="group-header-actions">
              <button class="header-action-btn" onclick="toggleGroupPanel()" title="群信息">
                <i class="fas fa-bars"></i>
              </button>
              ${isAdmin ? `<button class="header-action-btn" onclick="showGroupSettings(${groupId})" title="群设置"><i class="fas fa-cog"></i></button>` : ''}
              <button class="header-action-btn more-btn" onclick="showGroupMoreMenu(event, ${groupId})" title="更多">
                <i class="fas fa-ellipsis-h"></i>
              </button>
            </div>
          </div>
          
          <div class="messages-container" id="messages-container"></div>
          
          <div class="chat-input-area">
            <div class="input-tools">
              <button class="tool-btn" onclick="selectGroupImage()" title="发送图片"><i class="fas fa-image"></i></button>
              <button class="tool-btn" onclick="selectGroupVideo()" title="发送视频"><i class="fas fa-video"></i></button>
              <button class="tool-btn" onclick="selectGroupFile()" title="发送文件"><i class="fas fa-file"></i></button>
              <button class="tool-btn" onclick="translateGroupMessage()" title="翻译"><i class="fas fa-language"></i></button>
              ${isAdmin ? `<button class="tool-btn" onclick="inviteToGroup(${groupId})" title="邀请好友"><i class="fas fa-user-plus"></i></button>` : ''}
            </div>
            <div class="group-input-row">
              <textarea id="group-message-input" placeholder="输入消息..." rows="3"></textarea>
              <div class="send-btn-wrapper">
                <button class="btn btn-primary send-btn" onclick="sendGroupMessage(${groupId})">发送</button>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 右侧面板 -->
        <div class="group-side-panel" id="group-side-panel">
          <!-- 群公告 -->
          <div class="panel-section announcement-section">
            <div class="panel-section-header">
              <span class="section-title"><i class="fas fa-bullhorn"></i> 群公告</span>
              <div class="announcement-actions">
                <button class="view-all-btn" onclick="showAllAnnouncements(${groupId})" title="查看全部"><i class="fas fa-expand"></i></button>
                ${isAdmin ? `<button class="edit-btn" onclick="showNewAnnouncementDialog(${groupId})" title="发布公告"><i class="fas fa-plus"></i></button>` : ''}
              </div>
            </div>
            <div class="announcement-content-box" onclick="showAllAnnouncements(${groupId})" style="cursor: pointer;" id="announcement-preview-box">
              <div class="announcement-loading">
                <i class="fas fa-spinner fa-spin"></i> 加载中...
              </div>
            </div>
          </div>
          
          <!-- 群成员 -->
          <div class="panel-section members-section">
            <div class="panel-section-header">
              <span class="section-title"><i class="fas fa-users"></i> 群聊成员 ${members.length}</span>
              <button class="search-member-btn" onclick="toggleMemberSearch()" title="搜索成员"><i class="fas fa-search"></i></button>
            </div>
            <div class="member-search-box" id="member-search-box" style="display:none;">
              <input type="text" id="member-search-input" placeholder="搜索成员..." oninput="filterGroupMembers()">
            </div>
            <div class="group-members-list" id="group-members-list">
              ${membersHtml}
            </div>
          </div>
        </div>
      </div>
    `;
    
    // 加载群消息
    loadGroupMessages(groupId);
    
    // 加载公告预览
    loadAnnouncementPreview(groupId);
    
    // 绑定成员点击事件
    bindMemberClickEvents(groupId, isOwner, isAdmin);
    
    // 绑定回车发送
    setTimeout(() => {
      const groupInput = document.getElementById('group-message-input');
      if (groupInput) {
        groupInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendGroupMessage(groupId);
          }
        });
      }
    }, 100);
    
    // 小屏幕适配
    if (window.innerWidth <= 600) {
      chatDetail.classList.add('mobile-active');
    }
    
  } catch (error) {
    console.error('打开群组聊天失败:', error);
    showToast('❌ 打开失败', 'error');
  }
}

// 切换群侧边栏
async function toggleGroupPanel() {
  const panel = document.getElementById('group-side-panel');
  if (panel) {
    panel.classList.toggle('collapsed');
  }
}

// 切换成员搜索框
function toggleMemberSearch() {
  const searchBox = document.getElementById('member-search-box');
  if (searchBox) {
    searchBox.style.display = searchBox.style.display === 'none' ? 'block' : 'none';
    if (searchBox.style.display === 'block') {
      document.getElementById('member-search-input')?.focus();
    }
  }
}

// 过滤群成员
function filterGroupMembers() {
  const keyword = document.getElementById('member-search-input')?.value.toLowerCase() || '';
  const items = document.querySelectorAll('.group-member-item');
  items.forEach(item => {
    const name = item.querySelector('.member-nickname')?.textContent.toLowerCase() || '';
    item.style.display = name.includes(keyword) ? 'flex' : 'none';
  });
}

// 绑定成员点击事件
function bindMemberClickEvents(groupId, isOwner, isAdmin) {
  document.querySelectorAll('.group-member-item').forEach(item => {
    // 右键菜单
    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const userId = parseInt(item.dataset.userId);
      if (userId === apiService.currentUser.id) return;
      showMemberActionMenu(e, userId, groupId, isOwner, isAdmin);
    });
    
    // 左键点击查看资料
    item.addEventListener('click', (e) => {
      const userId = parseInt(item.dataset.userId);
      if (userId === apiService.currentUser.id) return;
      viewMemberProfile(userId);
    });
  });
}

// 显示成员操作菜单
function showMemberActionMenu(event, userId, groupId, isOwner, isAdmin) {
  // 移除旧菜单
  document.querySelector('.member-action-menu')?.remove();
  
  const menu = document.createElement('div');
  menu.className = 'member-action-menu';
  
  let menuItems = `
    <div class="menu-item" onclick="openPrivateChat(${userId})">
      <i class="fas fa-comment"></i> 发送消息
    </div>
    <div class="menu-item" onclick="viewMemberProfile(${userId})">
      <i class="fas fa-user"></i> 查看资料
    </div>
  `;
  
  // 管理员操作
  if (isOwner || isAdmin) {
    menuItems += `
      <div class="menu-divider"></div>
      <div class="menu-item" onclick="muteGroupMember(${groupId}, ${userId})">
        <i class="fas fa-volume-mute"></i> 禁言
      </div>
      <div class="menu-item danger" onclick="kickGroupMember(${groupId}, ${userId})">
        <i class="fas fa-user-minus"></i> 移出群聊
      </div>
    `;
  }
  
  // 群主额外操作
  if (isOwner) {
    menuItems += `
      <div class="menu-item" onclick="toggleAdminRole(${groupId}, ${userId})">
        <i class="fas fa-user-shield"></i> 设为管理员
      </div>
    `;
  }
  
  menu.innerHTML = menuItems;
  
  // 定位菜单 - 支持从成员列表或消息头像触发
  const memberItem = event.target.closest('.group-member-item');
  let posX, posY;
  
  if (memberItem) {
    // 从成员列表触发
    const rect = memberItem.getBoundingClientRect();
    posX = Math.min(rect.left, window.innerWidth - 160);
    posY = Math.min(rect.bottom + 5, window.innerHeight - 200);
  } else {
    // 从消息头像触发，使用鼠标位置
    posX = Math.min(event.clientX, window.innerWidth - 160);
    posY = Math.min(event.clientY + 5, window.innerHeight - 200);
  }
  
  menu.style.position = 'fixed';
  menu.style.left = `${posX}px`;
  menu.style.top = `${posY}px`;
  
  document.body.appendChild(menu);
  
  // 点击其他地方关闭
  setTimeout(() => {
    document.addEventListener('click', function closeMenu(e) {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    });
  }, 10);
}

// 显示群更多菜单
function showGroupMoreMenu(event, groupId) {
  event.stopPropagation();
  document.querySelector('.group-more-menu')?.remove();
  
  const menu = document.createElement('div');
  menu.className = 'group-more-menu context-menu show';
  menu.innerHTML = `
    <div class="context-menu-item" onclick="showGroupQRCode(${groupId})">
      <i class="fas fa-qrcode"></i> 群二维码
    </div>
    <div class="context-menu-item" onclick="toggleGroupMute(${groupId})">
      <i class="fas fa-bell-slash"></i> 消息免打扰
    </div>
    <div class="context-menu-item" onclick="toggleGroupPin(${groupId})">
      <i class="fas fa-thumbtack"></i> 置顶群聊
    </div>
    <div class="context-menu-item" onclick="clearGroupChat(${groupId})">
      <i class="fas fa-trash-alt"></i> 清空聊天记录
    </div>
    <div class="context-menu-item danger" onclick="leaveGroup(${groupId})">
      <i class="fas fa-sign-out-alt"></i> 退出群聊
    </div>
  `;
  
  const rect = event.target.getBoundingClientRect();
  menu.style.position = 'fixed';
  menu.style.left = `${rect.left - 120}px`;
  menu.style.top = `${rect.bottom + 5}px`;
  
  document.body.appendChild(menu);
  
  setTimeout(() => {
    document.addEventListener('click', function closeMenu() {
      menu.remove();
      document.removeEventListener('click', closeMenu);
    });
  }, 10);
}

// ========== 群名称编辑功能 ==========

/**
 * 开始编辑群名称 - 双击触发
 */
function startEditGroupName(groupId) {
  const nameDisplay = document.getElementById('group-name-display');
  if (!nameDisplay) return;
  
  const currentName = nameDisplay.textContent;
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'group-name-input';
  input.value = currentName;
  input.maxLength = 30;
  
  // 替换显示元素
  nameDisplay.style.display = 'none';
  nameDisplay.parentNode.insertBefore(input, nameDisplay);
  input.focus();
  input.select();
  
  // 失焦保存
  input.addEventListener('blur', () => {
    const newName = input.value.trim();
    if (newName && newName !== currentName) {
      saveGroupName(groupId, newName);
    } else {
      // 恢复显示
      input.remove();
      nameDisplay.style.display = '';
    }
  });
  
  // 回车保存
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      input.blur();
    } else if (e.key === 'Escape') {
      input.value = currentName; // 恢复原值
      input.blur();
    }
  });
}
window.startEditGroupName = startEditGroupName;

/**
 * 保存群名称
 */
async function saveGroupName(groupId, newName) {
  const nameDisplay = document.getElementById('group-name-display');
  const input = document.querySelector('.group-name-input');
  
  try {
    const response = await fetchWithAuth(`${apiService.apiUrl}/api/groups/${groupId}`, {
      method: 'PUT',
      body: JSON.stringify({ groupName: newName })
    });
    
    if (response.ok) {
      showToast('✅ 群名称已更新', 'success');
      // 更新显示
      if (nameDisplay) {
        nameDisplay.textContent = XssUtil.sanitize(newName);
        nameDisplay.style.display = '';
      }
      if (input) input.remove();
      // 更新currentGroup
      if (currentGroup) currentGroup.groupName = newName;
      // 刷新群列表
      loadGroupsList();
    } else {
      showToast('❌ 修改失败', 'error');
      if (nameDisplay) nameDisplay.style.display = '';
      if (input) input.remove();
    }
  } catch (error) {
    console.error('保存群名称失败:', error);
    showToast('❌ 保存失败', 'error');
    if (nameDisplay) nameDisplay.style.display = '';
    if (input) input.remove();
  }
}

// ========== 群信息显示 ==========

/**
 * 显示群聊基本信息弹窗
 */
async function showGroupInfoDialog(groupId) {
  if (!currentGroup) {
    showToast('群信息加载中...', 'info');
    return;
  }
  
  const isOwner = currentGroup.userRole === 'OWNER';
  const isAdmin = currentGroup.userRole === 'ADMIN' || isOwner;
  
  // 群分类列表
  const categories = ['IT', '科技', '学习', '文化', '娱乐', '生活', '游戏', '其他'];
  const currentCategory = currentGroup.category || '';
  
  // 获取成员数
  let memberCount = 0;
  try {
    const membersResponse = await fetchWithAuth(`${apiService.apiUrl}/api/groups/${groupId}/members`);
    const members = await membersResponse.json();
    memberCount = members.length;
  } catch (error) {
    console.error('获取成员数失败:', error);
  }
  
  const firstChar = currentGroup.groupName?.charAt(0).toUpperCase() || 'G';
  
  const modal = document.createElement('div');
  modal.className = 'modal group-info-modal';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>群聊信息</h3>
        <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
      </div>
      <div class="modal-body">
        <div class="group-info-card">
          <div class="group-info-avatar">${firstChar}</div>
          <div class="group-info-name">${XssUtil.sanitize(currentGroup.groupName)}</div>
          <div class="group-info-number">群号: ${currentGroup.groupNumber || '暂无'}</div>
          
          ${currentCategory ? `<div class="group-info-category">${currentCategory}</div>` : ''}
          
          <div class="group-info-stats">
            <div class="group-stat-item">
              <div class="group-stat-value">${memberCount}</div>
              <div class="group-stat-label">成员</div>
            </div>
            <div class="group-stat-item">
              <div class="group-stat-value">${currentGroup.userRole === 'OWNER' ? '群主' : currentGroup.userRole === 'ADMIN' ? '管理' : '成员'}</div>
              <div class="group-stat-label">我的身份</div>
            </div>
          </div>
          
          ${isOwner ? `
            <div class="input-group" style="text-align:left;margin-top:20px;">
              <label>群分类</label>
              <div class="category-selector">
                ${categories.map(cat => `
                  <div class="category-option ${cat === currentCategory ? 'selected' : ''}" 
                       onclick="selectGroupCategory('${cat}', ${groupId})">${cat}</div>
                `).join('')}
              </div>
            </div>
          ` : ''}
          
          ${currentGroup.description ? `
            <div class="group-info-desc">
              <strong>群介绍:</strong><br>
              ${XssUtil.sanitize(currentGroup.description)}
            </div>
          ` : ''}
        </div>
      </div>
      <div class="modal-footer" style="justify-content:center;gap:12px;">
        <button class="btn btn-secondary" onclick="showGroupQRCode(${groupId})">
          <i class="fas fa-qrcode"></i> 群二维码
        </button>
        ${isAdmin ? `
          <button class="btn btn-primary" onclick="showGroupSettings(${groupId});this.closest('.modal').remove();">
            <i class="fas fa-cog"></i> 群设置
          </button>
        ` : ''}
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
}
window.showGroupInfoDialog = showGroupInfoDialog;

/**
 * 选择群分类
 */
async function selectGroupCategory(category, groupId) {
  // 更新UI选中状态
  document.querySelectorAll('.category-option').forEach(opt => {
    opt.classList.toggle('selected', opt.textContent === category);
  });
  
  try {
    const response = await fetchWithAuth(`${apiService.apiUrl}/api/groups/${groupId}`, {
      method: 'PUT',
      body: JSON.stringify({ category: category })
    });
    
    if (response.ok) {
      showToast('✅ 群分类已更新', 'success');
      if (currentGroup) currentGroup.category = category;
    } else {
      showToast('❌ 更新失败', 'error');
    }
  } catch (error) {
    console.error('更新群分类失败:', error);
    showToast('❌ 更新失败', 'error');
  }
}
window.selectGroupCategory = selectGroupCategory;

// ========== 群二维码功能 ==========

/**
 * 显示群二维码
 */
async function showGroupQRCode(groupId) {
  if (!currentGroup) {
    showToast('群信息加载中...', 'info');
    return;
  }
  
  // 获取群邀请码
  let inviteCode = currentGroup.inviteCode;
  if (!inviteCode) {
    try {
      const response = await fetchWithAuth(`${apiService.apiUrl}/api/groups/${groupId}`);
      const groupData = await response.json();
      inviteCode = groupData.inviteCode;
      currentGroup.inviteCode = inviteCode;
    } catch (error) {
      console.error('获取邀请码失败:', error);
    }
  }
  
  // 生成二维码内容: zsmessage://group/{inviteCode}/join
  const qrData = inviteCode 
    ? `zsmessage://group/${inviteCode}/join`
    : `zsmessage://group/${currentGroup.groupNumber || groupId}/join`;
  
  const modal = document.createElement('div');
  modal.className = 'modal group-qrcode-modal';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>群二维码</h3>
        <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
      </div>
      <div class="modal-body" style="text-align:center;padding:30px 20px;">
        <div class="qrcode-container" id="qrcode-container">
          <div style="padding:40px;">
            <i class="fas fa-spinner fa-spin" style="font-size:24px;color:#999;"></i>
          </div>
        </div>
        <div class="qrcode-group-info">
          <div class="qrcode-group-name">${XssUtil.sanitize(currentGroup.groupName)}</div>
          <div class="qrcode-group-number">群号: ${currentGroup.groupNumber || '暂无'}</div>
          ${inviteCode ? `<div class="qrcode-invite-code" style="color:var(--text-secondary);font-size:12px;margin-top:4px;">邀请码: ${inviteCode}</div>` : ''}
        </div>
        <div class="qrcode-tip">扫描二维码，立即加入群聊</div>
      </div>
      <div class="modal-footer" style="justify-content:center;gap:10px;">
        <button class="btn btn-primary" onclick="downloadGroupQRCode()">
          <i class="fas fa-download"></i> 保存二维码
        </button>
        <button class="btn btn-secondary" onclick="copyGroupInviteLink('${inviteCode || ''}')">
          <i class="fas fa-copy"></i> 复制链接
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // 生成真实二维码
  generateGroupQRCode(qrData);
}
window.showGroupQRCode = showGroupQRCode;

/**
 * 生成群二维码 - 使用 qrcode 库
 */
async function generateGroupQRCode(data) {
  const container = document.getElementById('qrcode-container');
  if (!container) return;
  
  try {
    // 加载 qrcode 库
    const QRCode = require('qrcode');
    
    // 创建 canvas
    const canvas = document.createElement('canvas');
    canvas.id = 'group-qrcode-canvas';
    
    // 生成二维码
    await QRCode.toCanvas(canvas, data, {
      width: 200,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'M'
    });
    
    // 在中心添加 logo
    const ctx = canvas.getContext('2d');
    const logoSize = 40;
    const logoX = (canvas.width - logoSize) / 2;
    const logoY = (canvas.height - logoSize) / 2;
    
    // 白色背景
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(logoX - 2, logoY - 2, logoSize + 4, logoSize + 4);
    
    // Logo 文字
    ctx.fillStyle = '#1890ff';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Z', canvas.width / 2, canvas.height / 2);
    
    container.innerHTML = '';
    container.appendChild(canvas);
  } catch (error) {
    console.error('生成二维码失败:', error);
    // 备用方案：显示文本链接
    container.innerHTML = `
      <div style="padding:20px;color:var(--text-secondary);">
        <i class="fas fa-qrcode" style="font-size:48px;margin-bottom:10px;"></i>
        <div style="font-size:12px;word-break:break-all;">${data}</div>
      </div>
    `;
  }
}

/**
 * 下载群二维码
 */
function downloadGroupQRCode() {
  const canvas = document.getElementById('group-qrcode-canvas');
  if (!canvas) {
    showToast('二维码生成中...', 'info');
    return;
  }
  
  const link = document.createElement('a');
  link.download = `群二维码_${currentGroup?.groupName || 'group'}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
  
  showToast('✅ 二维码已保存', 'success');
}
window.downloadGroupQRCode = downloadGroupQRCode;

/**
 * 复制群邀请链接
 */
function copyGroupInviteLink(inviteCode) {
  if (!inviteCode) {
    showToast('邀请码不可用', 'error');
    return;
  }
  
  const link = `zsmessage://group/${inviteCode}/join`;
  navigator.clipboard.writeText(link).then(() => {
    showToast('✅ 邀请链接已复制', 'success');
  }).catch(() => {
    showToast('复制失败', 'error');
  });
}
window.copyGroupInviteLink = copyGroupInviteLink;

// 编辑群公告
async function editGroupAnnouncement(groupId) {
  // 计算当前公告数量
  const currentAnn = currentGroup?.announcement || '';
  let announcementCount = 0;
  if (currentAnn) {
    if (currentAnn.includes('\n\n')) {
      announcementCount = currentAnn.split('\n\n').filter(a => a.trim()).length;
    } else if (currentAnn.includes('---')) {
      announcementCount = currentAnn.split('---').filter(a => a.trim()).length;
    } else {
      announcementCount = currentAnn.trim() ? 1 : 0;
    }
  }
  
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 600px;">
      <div class="modal-header">
        <h3><i class="fas fa-bullhorn" style="color:var(--primary-color);margin-right:8px;"></i>编辑群公告</h3>
        <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
      </div>
      <div class="modal-body">
        <div style="margin-bottom: 12px; padding: 12px; background: var(--bg-secondary); border-radius: 8px; font-size: 13px; color: var(--text-secondary);">
          <div style="margin-bottom: 8px;"><i class="fas fa-info-circle" style="color:var(--primary-color);"></i> <strong>多条公告分隔方式：</strong></div>
          <div style="margin-left: 20px;">
            • 空一行（双换行）分隔不同公告<br>
            • 或使用 <code style="background:#333;padding:2px 6px;border-radius:3px;">---</code> 分隔
          </div>
        </div>
        <textarea id="announcement-textarea" class="form-textarea" rows="12" 
          placeholder="输入群公告内容...\n\n第一条公告内容\n\n第二条公告内容"
          style="width:100%;padding:12px;border:1px solid var(--border-color);border-radius:8px;resize:vertical;font-size:14px;line-height:1.6;background:var(--input-bg);color:var(--text-primary);">${currentGroup?.announcement || ''}</textarea>
        <div style="margin-top: 8px; font-size: 12px; color: var(--text-secondary); display: flex; justify-content: space-between;">
          <span>当前 ${announcementCount} 条公告</span>
          <span>支持换行、多段落内容</span>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">取消</button>
        <button class="btn btn-primary" onclick="saveGroupAnnouncement(${groupId})">保存</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

// 保存群公告
async function saveGroupAnnouncement(groupId) {
  const content = document.getElementById('announcement-textarea')?.value.trim() || '';
  try {
    const response = await fetchWithAuth(`${apiService.apiUrl}/api/groups/${groupId}`, {
      method: 'PUT',
      body: JSON.stringify({ announcement: content })
    });
    
    if (response.ok) {
      showToast('✅ 公告已更新', 'success');
      document.querySelector('.modal')?.remove();
      openGroupChat(groupId); // 刷新界面
    } else {
      showToast('❌ 更新失败', 'error');
    }
  } catch (error) {
    console.error('保存公告失败:', error);
    showToast('❌ 保存失败', 'error');
  }
}

// 获取公告预览（获取第一条公告的前80字符）
function getAnnouncementPreview(announcement) {
  if (!announcement) return '';
  
  // 解析公告（支持多种分隔符）
  let announcements = [];
  if (announcement.includes('\n\n')) {
    announcements = announcement.split('\n\n').filter(a => a.trim());
  } else if (announcement.includes('---')) {
    announcements = announcement.split('---').filter(a => a.trim());
  } else {
    announcements = [announcement];
  }
  
  if (announcements.length === 0) return '';
  const first = announcements[0].trim().replace(/\n/g, ' ');
  return first.length > 80 ? first.substring(0, 80) + '...' : first;
}

// 检查是否有多条公告
function hasMultipleAnnouncements(announcement) {
  if (!announcement) return false;
  
  if (announcement.includes('\n\n')) {
    return announcement.split('\n\n').filter(a => a.trim()).length > 1;
  } else if (announcement.includes('---')) {
    return announcement.split('---').filter(a => a.trim()).length > 1;
  }
  
  // 单条公告如果超过80字符也显示“查看全部”
  return announcement.trim().length > 80;
}

// 显示所有公告详情窗口 - 模仿QQ布局
async function showAllAnnouncements(groupId) {
  // 检查当前用户是否为管理员
  const isAdmin = currentGroup?.userRole === 'ADMIN' || currentGroup?.userRole === 'OWNER';
  
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content announcement-detail-modal">
      <div class="modal-header announcement-detail-header">
        <div class="announcement-title-row">
          <h3>${XssUtil.sanitize(currentGroup?.groupName || '群公告')}</h3>
          <span class="announcement-label">群公告</span>
        </div>
        <div class="announcement-header-actions">
          ${isAdmin ? `<button class="btn btn-primary btn-small" onclick="showNewAnnouncementDialog(${groupId})">
            <i class="fas fa-plus"></i> 发布新公告
          </button>` : ''}
          <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
        </div>
      </div>
      <div class="modal-body announcement-detail-body" id="announcement-list-container">
        <div class="announcement-loading">
          <i class="fas fa-spinner fa-spin"></i> 加载中...
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // 从新API获取公告列表
  try {
    const response = await fetchWithAuth(`${apiService.apiUrl}/api/groups/${groupId}/announcements`);
    const data = await response.json();
    
    if (data.announcements && data.announcements.length > 0) {
      // 获取所有发布者的用户信息
      const publisherIds = [...new Set(data.announcements.map(a => a.publisherId))];
      const usersMap = new Map();
      
      await Promise.all(publisherIds.map(async (publisherId) => {
        try {
          const userResponse = await fetchWithAuth(`${apiService.apiUrl}/api/users/${publisherId}`);
          const user = await userResponse.json();
          usersMap.set(publisherId, user);
        } catch (error) {
          console.error(`获取用户 ${publisherId} 信息失败:`, error);
        }
      }));
      
      renderAnnouncementListFromDB(data.announcements, usersMap, isAdmin, groupId);
    } else {
      // 无公告时显示空状态
      const container = document.getElementById('announcement-list-container');
      if (container) {
        container.innerHTML = `
          <div class="empty-announcement">
            <i class="fas fa-bullhorn" style="font-size:48px;opacity:0.3;margin-bottom:15px;"></i>
            <p>暂无群公告</p>
            ${isAdmin ? '<p style="font-size:13px;color:var(--text-secondary);margin-top:10px;">点击上方按钮发布第一条公告</p>' : ''}
          </div>
        `;
      }
    }
  } catch (error) {
    console.error('加载公告失败:', error);
    const container = document.getElementById('announcement-list-container');
    if (container) {
      container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--danger-color);">加载公告失败</div>';
    }
  }
}

// 渲染公告列表 - 从数据库获取的公告数据
function renderAnnouncementListFromDB(announcements, usersMap, isAdmin, groupId) {
  const container = document.getElementById('announcement-list-container');
  if (!container) return;
  
  if (announcements.length === 0) {
    container.innerHTML = `
      <div class="empty-announcement">
        <i class="fas fa-bullhorn" style="font-size:48px;opacity:0.3;margin-bottom:15px;"></i>
        <p>暂无群公告</p>
      </div>
    `;
    return;
  }
  
  // 置顶的公告排在前面
  const sortedAnnouncements = [...announcements].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
  
  container.innerHTML = sortedAnnouncements.map((item, index) => {
    const content = item.content || '';
    const isLong = content.length > 150;
    const preview = isLong ? content.substring(0, 150) + '...' : content;
    
    // 获取发布者信息
    const publisher = usersMap.get(item.publisherId);
    const publisherName = publisher ? (publisher.nickname || publisher.username) : '管理员';
    const publisherAvatar = publisher?.avatar;
    const hasAvatar = publisherAvatar && publisherAvatar.trim() !== '';
    const firstChar = publisherName.charAt(0).toUpperCase();
    
    // 格式化时间
    const createdAt = new Date(item.createdAt);
    const timeStr = formatAnnouncementTime(createdAt);
    
    return `
      <div class="announcement-card" data-id="${item.id}" data-index="${index}">
        <div class="announcement-card-header">
          <div class="announcement-author">
            ${hasAvatar 
              ? `<div class="announcement-avatar" style="background-image:url('${apiService.apiUrl}${publisherAvatar}');"></div>`
              : `<div class="announcement-avatar">${firstChar}</div>`
            }
            <span class="announcement-publisher-name">${XssUtil.sanitize(publisherName)}</span>
            <span class="announcement-time">${timeStr}</span>
            ${item.isPinned ? '<span class="announcement-pin-tag"><i class="fas fa-thumbtack"></i> 置顶</span>' : ''}
          </div>
          ${isAdmin ? `
            <div class="announcement-actions">
              <button class="btn-icon" onclick="togglePinAnnouncement(${item.id}, ${!item.isPinned}, ${groupId})" title="${item.isPinned ? '取消置顶' : '置顶'}">
                <i class="fas fa-thumbtack" style="color:${item.isPinned ? 'var(--primary-color)' : 'var(--text-secondary)'};"></i>
              </button>
              <button class="btn-icon" onclick="editAnnouncementContent(${item.id}, ${groupId})" title="编辑">
                <i class="fas fa-edit"></i>
              </button>
              <button class="btn-icon" onclick="deleteAnnouncement(${item.id}, ${groupId})" title="删除">
                <i class="fas fa-trash" style="color:var(--danger-color);"></i>
              </button>
            </div>
          ` : ''}
        </div>
        <div class="announcement-card-body">
          <div class="announcement-text ${isLong ? 'collapsed' : ''}" data-full="${encodeURIComponent(content)}">
            ${XssUtil.sanitize(preview).replace(/\n/g, '<br>')}
          </div>
          ${isLong ? `
            <div class="announcement-expand-btn" onclick="toggleAnnouncementExpand(this)">
              <span>展开</span>
              <i class="fas fa-chevron-down"></i>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// 格式化公告时间
function formatAnnouncementTime(date) {
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;
  
  return date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
}

// 兼容旧版：渲染公告列表 - 从文本解析（保留作为备用）
function renderAnnouncementList(announcementText, isAdmin, groupId) {
  const container = document.getElementById('announcement-list-container');
  if (!container) return;
  
  // 解析公告（支持多种分隔符：双换行、---、===）
  let announcements = [];
  if (announcementText.includes('\n\n')) {
    announcements = announcementText.split('\n\n').filter(a => a.trim());
  } else if (announcementText.includes('---')) {
    announcements = announcementText.split('---').filter(a => a.trim());
  } else if (announcementText.includes('===')) {
    announcements = announcementText.split('===').filter(a => a.trim());
  } else {
    // 单条公告
    announcements = [announcementText];
  }
  
  if (announcements.length === 0) {
    container.innerHTML = `
      <div class="empty-announcement">
        <i class="fas fa-bullhorn"></i>
        <p>暂无群公告</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = announcements.map((item, index) => {
    const content = item.trim();
    const isLong = content.length > 150;
    const preview = isLong ? content.substring(0, 150) + '...' : content;
    
    return `
      <div class="announcement-card" data-index="${index}">
        <div class="announcement-card-header">
          <div class="announcement-author">
            <i class="fas fa-user-circle"></i>
            <span>管理员</span>
            <span class="announcement-time">群公告 #${index + 1}</span>
            ${index === 0 ? '<span class="announcement-pin-tag"><i class="fas fa-thumbtack"></i> 置顶</span>' : ''}
          </div>
        </div>
        <div class="announcement-card-body">
          <div class="announcement-text ${isLong ? 'collapsed' : ''}" data-full="${encodeURIComponent(content)}">
            ${XssUtil.sanitize(preview).replace(/\n/g, '<br>')}
          </div>
          ${isLong ? `
            <div class="announcement-expand-btn" onclick="toggleAnnouncementExpand(this)">
              <span>展开</span>
              <i class="fas fa-chevron-down"></i>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// 展开/收起公告
function toggleAnnouncementExpand(btn) {
  const card = btn.closest('.announcement-card');
  const textDiv = card.querySelector('.announcement-text');
  const isCollapsed = textDiv.classList.contains('collapsed');
  
  if (isCollapsed) {
    // 展开
    const fullContent = decodeURIComponent(textDiv.dataset.full);
    textDiv.innerHTML = XssUtil.sanitize(fullContent).replace(/\n/g, '<br>');
    textDiv.classList.remove('collapsed');
    btn.innerHTML = '<span>收起</span><i class="fas fa-chevron-up"></i>';
  } else {
    // 收起
    const fullContent = decodeURIComponent(textDiv.dataset.full);
    const preview = fullContent.substring(0, 150) + '...';
    textDiv.innerHTML = XssUtil.sanitize(preview).replace(/\n/g, '<br>');
    textDiv.classList.add('collapsed');
    btn.innerHTML = '<span>展开</span><i class="fas fa-chevron-down"></i>';
  }
}
window.toggleAnnouncementExpand = toggleAnnouncementExpand;

// 导出函数
window.showAllAnnouncements = showAllAnnouncements;

/**
 * 加载公告预览（显示在群聊右侧面板）
 */
async function loadAnnouncementPreview(groupId) {
  const container = document.getElementById('announcement-preview-box');
  if (!container) return;
  
  try {
    const response = await fetchWithAuth(`${apiService.apiUrl}/api/groups/${groupId}/announcements`);
    const data = await response.json();
    
    if (data.announcements && data.announcements.length > 0) {
      // 按置顶和时间排序
      const sortedAnnouncements = [...data.announcements].sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
      
      // 获取第一条公告的预览
      const firstAnnouncement = sortedAnnouncements[0];
      const content = firstAnnouncement.content || '';
      const preview = content.length > 80 ? content.substring(0, 80) + '...' : content;
      
      container.innerHTML = `
        <div class="announcement-text">${XssUtil.sanitize(preview).replace(/\n/g, ' ')}</div>
        ${data.announcements.length > 1 ? `<div class="announcement-more"><i class="fas fa-angle-down"></i> 共 ${data.announcements.length} 条公告</div>` : ''}
      `;
    } else {
      container.innerHTML = '<div class="no-announcement">暂无群公告</div>';
    }
  } catch (error) {
    console.error('加载公告预览失败:', error);
    container.innerHTML = '<div class="no-announcement">加载失败</div>';
  }
}
window.loadAnnouncementPreview = loadAnnouncementPreview;

// ========== 群公告操作函数 ==========

/**
 * 显示新公告发布对话框 - QQ风格
 */
function showNewAnnouncementDialog(groupId) {
  const modal = document.createElement('div');
  modal.className = 'modal announcement-publish-modal';
  modal.innerHTML = `
    <div class="modal-content announcement-publish-content">
      <div class="modal-header announcement-publish-header">
        <span class="announcement-publish-title">发布新公告</span>
        <div class="window-controls">
          <button class="win-btn" onclick="this.closest('.modal').remove()" title="关闭">&times;</button>
        </div>
      </div>
      <div class="modal-body announcement-publish-body">
        <textarea id="new-announcement-content" class="announcement-textarea" 
          placeholder="填写公告，1-600字"
          maxlength="600"></textarea>
        <div class="announcement-char-count">
          <span id="announcement-char-current">0</span>/600
        </div>
      </div>
      <div class="modal-footer announcement-publish-footer">
        <div class="announcement-footer-left">
          <button class="btn-icon-only" onclick="selectAnnouncementImage()" title="添加图片">
            <i class="far fa-image"></i>
          </button>
        </div>
        <div class="announcement-footer-right">
          <label class="announcement-pin-option">
            <input type="radio" name="announcement-pin" id="new-announcement-pin">
            <span>置顶公告</span>
          </label>
          <button class="btn btn-primary" onclick="submitNewAnnouncement(${groupId})">发布</button>
          <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">取消</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  
  const textarea = document.getElementById('new-announcement-content');
  textarea.focus();
  
  // 监听字数变化
  textarea.addEventListener('input', () => {
    const count = textarea.value.length;
    document.getElementById('announcement-char-current').textContent = count;
  });
}
window.showNewAnnouncementDialog = showNewAnnouncementDialog;

// 公告图片选择（占位）
function selectAnnouncementImage() {
  showToast('公告图片功能开发中...', 'info');
}
window.selectAnnouncementImage = selectAnnouncementImage;

/**
 * 提交新公告
 */
async function submitNewAnnouncement(groupId) {
  const content = document.getElementById('new-announcement-content').value.trim();
  const isPinned = document.getElementById('new-announcement-pin').checked;
  
  if (!content) {
    showToast('请输入公告内容', 'warning');
    return;
  }
  
  try {
    const response = await fetchWithAuth(`${apiService.apiUrl}/api/groups/${groupId}/announcements`, {
      method: 'POST',
      body: JSON.stringify({
        publisherId: apiService.currentUser.id,
        content: content,
        isPinned: isPinned
      })
    });
    
    if (response.ok) {
      showToast('✅ 公告发布成功', 'success');
      // 关闭所有弹窗并重新打开公告列表
      document.querySelectorAll('.modal').forEach(m => m.remove());
      showAllAnnouncements(groupId);
    } else {
      const result = await response.json();
      showToast('❌ ' + (result.error || '发布失败'), 'error');
    }
  } catch (error) {
    console.error('发布公告失败:', error);
    showToast('❌ 发布失败', 'error');
  }
}
window.submitNewAnnouncement = submitNewAnnouncement;

/**
 * 置顶/取消置顶公告
 */
async function togglePinAnnouncement(announcementId, pin, groupId) {
  try {
    const response = await fetchWithAuth(`${apiService.apiUrl}/api/groups/announcements/${announcementId}/pin`, {
      method: 'POST',
      body: JSON.stringify({
        operatorId: apiService.currentUser.id
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      showToast(`✅ ${result.message || '操作成功'}`, 'success');
      // 刷新公告列表
      document.querySelectorAll('.modal').forEach(m => m.remove());
      showAllAnnouncements(groupId);
    } else {
      const result = await response.json();
      showToast('❌ ' + (result.error || '操作失败'), 'error');
    }
  } catch (error) {
    console.error('置顶操作失败:', error);
    showToast('❌ 操作失败', 'error');
  }
}
window.togglePinAnnouncement = togglePinAnnouncement;

/**
 * 编辑公告内容
 */
async function editAnnouncementContent(announcementId, groupId) {
  // 先获取当前公告内容
  const card = document.querySelector(`.announcement-card[data-id="${announcementId}"]`);
  const textDiv = card?.querySelector('.announcement-text');
  const currentContent = textDiv ? decodeURIComponent(textDiv.dataset.full || '') : '';
  
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 500px;">
      <div class="modal-header">
        <h3><i class="fas fa-edit" style="color:var(--primary-color);margin-right:8px;"></i>编辑公告</h3>
        <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
      </div>
      <div class="modal-body">
        <div class="input-group">
          <label>公告内容</label>
          <textarea id="edit-announcement-content" class="form-textarea" rows="8" 
            style="width:100%;padding:12px;border:1px solid var(--border-color);border-radius:8px;resize:vertical;font-size:14px;line-height:1.6;background:var(--input-bg);color:var(--text-primary);">${currentContent}</textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">取消</button>
        <button class="btn btn-primary" onclick="submitEditAnnouncement(${announcementId}, ${groupId})">保存</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById('edit-announcement-content').focus();
}
window.editAnnouncementContent = editAnnouncementContent;

/**
 * 提交编辑的公告
 */
async function submitEditAnnouncement(announcementId, groupId) {
  const content = document.getElementById('edit-announcement-content').value.trim();
  
  if (!content) {
    showToast('公告内容不能为空', 'warning');
    return;
  }
  
  try {
    const response = await fetchWithAuth(`${apiService.apiUrl}/api/groups/announcements/${announcementId}`, {
      method: 'PUT',
      body: JSON.stringify({
        operatorId: apiService.currentUser.id,
        content: content
      })
    });
    
    if (response.ok) {
      showToast('✅ 公告已更新', 'success');
      // 刷新公告列表
      document.querySelectorAll('.modal').forEach(m => m.remove());
      showAllAnnouncements(groupId);
    } else {
      const result = await response.json();
      showToast('❌ ' + (result.error || '更新失败'), 'error');
    }
  } catch (error) {
    console.error('更新公告失败:', error);
    showToast('❌ 更新失败', 'error');
  }
}
window.submitEditAnnouncement = submitEditAnnouncement;

/**
 * 删除公告
 */
async function deleteAnnouncement(announcementId, groupId) {
  if (!confirm('确定要删除这条公告吗？')) return;
  
  try {
    // 后端使用 @RequestParam，所以用查询参数
    const response = await fetchWithAuth(`${apiService.apiUrl}/api/groups/announcements/${announcementId}?operatorId=${apiService.currentUser.id}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      showToast('✅ 公告已删除', 'success');
      // 刷新公告列表
      document.querySelectorAll('.modal').forEach(m => m.remove());
      showAllAnnouncements(groupId);
    } else {
      const result = await response.json();
      showToast('❌ ' + (result.error || '删除失败'), 'error');
    }
  } catch (error) {
    console.error('删除公告失败:', error);
    showToast('❌ 删除失败', 'error');
  }
}
window.deleteAnnouncement = deleteAnnouncement;

// 禁言成员 - 使用自定义模态框替代 prompt
function muteGroupMember(groupId, userId) {
  document.querySelector('.member-action-menu')?.remove();
  
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 400px;">
      <div class="modal-header">
        <h3 style="margin:0;display:flex;align-items:center;gap:10px;">
          <i class="fas fa-volume-mute" style="color:var(--warning-color);"></i>
          禁言成员
        </h3>
        <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
      </div>
      <div class="modal-body" style="padding:20px;">
        <div class="mute-options">
          <label style="display:flex;align-items:center;gap:10px;padding:12px;border:1px solid var(--border-color);border-radius:8px;cursor:pointer;margin-bottom:10px;">
            <input type="radio" name="mute-duration" value="10" checked>
            <span>禁言 10 分钟</span>
          </label>
          <label style="display:flex;align-items:center;gap:10px;padding:12px;border:1px solid var(--border-color);border-radius:8px;cursor:pointer;margin-bottom:10px;">
            <input type="radio" name="mute-duration" value="30">
            <span>禁言 30 分钟</span>
          </label>
          <label style="display:flex;align-items:center;gap:10px;padding:12px;border:1px solid var(--border-color);border-radius:8px;cursor:pointer;margin-bottom:10px;">
            <input type="radio" name="mute-duration" value="60">
            <span>禁言 1 小时</span>
          </label>
          <label style="display:flex;align-items:center;gap:10px;padding:12px;border:1px solid var(--border-color);border-radius:8px;cursor:pointer;margin-bottom:10px;">
            <input type="radio" name="mute-duration" value="1440">
            <span>禁言 1 天</span>
          </label>
          <label style="display:flex;align-items:center;gap:10px;padding:12px;border:1px solid var(--border-color);border-radius:8px;cursor:pointer;margin-bottom:10px;">
            <input type="radio" name="mute-duration" value="0">
            <span style="color:var(--success-color);">解除禁言</span>
          </label>
          <label style="display:flex;align-items:center;gap:10px;padding:12px;border:1px solid var(--border-color);border-radius:8px;cursor:pointer;">
            <input type="radio" name="mute-duration" value="custom">
            <span>自定义时长</span>
            <input type="number" id="custom-mute-minutes" min="1" max="43200" placeholder="分钟" 
                   style="width:80px;padding:6px;border:1px solid var(--border-color);border-radius:4px;margin-left:auto;">
          </label>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">取消</button>
        <button class="btn btn-primary" onclick="confirmMuteGroupMember(${groupId}, ${userId})">确定</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
}

// 确认禁言
async function confirmMuteGroupMember(groupId, userId) {
  const selectedRadio = document.querySelector('input[name="mute-duration"]:checked');
  if (!selectedRadio) {
    showToast('请选择禁言时长', 'warning');
    return;
  }
  
  let duration;
  if (selectedRadio.value === 'custom') {
    const customInput = document.getElementById('custom-mute-minutes');
    duration = parseInt(customInput.value);
    if (isNaN(duration) || duration < 0) {
      showToast('请输入有效的禁言时长', 'warning');
      return;
    }
  } else {
    duration = parseInt(selectedRadio.value);
  }
  
  try {
    const response = await fetchWithAuth(`${apiService.apiUrl}/api/groups/${groupId}/mute/${userId}`, {
      method: 'POST',
      body: JSON.stringify({ duration: duration })
    });
    
    if (response.ok) {
      showToast(duration === 0 ? '✅ 已解除禁言' : `✅ 已禁言 ${duration >= 60 ? Math.floor(duration/60) + ' 小时' : duration + ' 分钟'}`, 'success');
      document.querySelector('.modal')?.remove();
    } else {
      const result = await response.json();
      showToast('❌ ' + (result.error || '操作失败'), 'error');
    }
  } catch (error) {
    console.error('禁言失败:', error);
    showToast('❌ 禁言失败', 'error');
  }
}
window.confirmMuteGroupMember = confirmMuteGroupMember;

// 踢出成员
async function kickGroupMember(groupId, userId) {
  if (!confirm('确定要将该成员移出群聊吗？')) return;
  
  document.querySelector('.member-action-menu')?.remove();
  
  try {
    const response = await fetchWithAuth(`${apiService.apiUrl}/api/groups/${groupId}/kick/${userId}`, {
      method: 'POST'
    });
    
    const result = await response.json();
    
    if (response.ok) {
      showToast('✅ 已移出群聊', 'success');
      openGroupChat(groupId); // 刷新成员列表
    } else {
      showToast('❌ ' + (result.error || '操作失败'), 'error');
    }
  } catch (error) {
    console.error('踢人失败:', error);
    showToast('❌ 操作失败', 'error');
  }
}

// 设置/取消管理员
async function toggleAdminRole(groupId, userId) {
  try {
    // 检查当前角色
    const membersResponse = await fetchWithAuth(`${apiService.apiUrl}/api/groups/${groupId}/members`);
    const members = await membersResponse.json();
    const member = members.find(m => m.userId === userId);
    const isCurrentlyAdmin = member && member.role === 'ADMIN';
    
    const action = isCurrentlyAdmin ? '取消管理员' : '设为管理员';
    if (!confirm(`确定要${action}吗？`)) return;
    
    const response = await fetchWithAuth(`${apiService.apiUrl}/api/groups/${groupId}/admin/${userId}`, {
      method: isCurrentlyAdmin ? 'DELETE' : 'POST'
    });
    
    if (response.ok) {
      showToast(`✅ 已${action}`, 'success');
      openGroupChat(groupId);
    } else {
      showToast('❌ 操作失败', 'error');
    }
  } catch (error) {
    console.error('设置管理员失败:', error);
    showToast('❌ 操作失败', 'error');
  }
  
  document.querySelector('.member-action-menu')?.remove();
}

// 退出群聊
async function leaveGroup(groupId) {
  if (!confirm('确定要退出该群聊吗？')) return;
  
  try {
    const response = await fetchWithAuth(`${apiService.apiUrl}/api/groups/${groupId}/leave`, {
      method: 'POST',
      body: JSON.stringify({ userId: apiService.currentUser.id })
    });
    
    const result = await response.json();
    
    if (response.ok) {
      showToast('✅ 已退出群聊', 'success');
      currentGroup = null;
      await loadGroupsList(); // 修复: loadGroups -> loadGroupsList
      switchView('contacts');
    } else {
      showToast('❌ ' + (result.error || '退出失败'), 'error');
    }
  } catch (error) {
    console.error('退出群聊失败:', error);
    showToast('❌ 退出失败', 'error');
  }
}

// 清空群聊天记录（本地）
function clearGroupChat(groupId) {
  if (!confirm('确定要清空聊天记录吗？（仅清除本地显示）')) return;
  
  const container = document.getElementById('messages-container');
  if (container) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-comments" style="font-size:48px;opacity:0.3;"></i>
        <p>聊天记录已清空</p>
      </div>
    `;
  }
  showToast('✅ 聊天记录已清空', 'success');
}

// 消息免打扰（本地标记）
function toggleGroupMute(groupId) {
  const mutedGroups = JSON.parse(localStorage.getItem('mutedGroups') || '[]');
  const index = mutedGroups.indexOf(groupId);
  
  if (index > -1) {
    mutedGroups.splice(index, 1);
    showToast('✅ 已取消免打扰', 'success');
  } else {
    mutedGroups.push(groupId);
    showToast('✅ 已开启免打扰', 'success');
  }
  
  localStorage.setItem('mutedGroups', JSON.stringify(mutedGroups));
}

// 置顶群聊（本地标记）
function toggleGroupPin(groupId) {
  const pinnedGroups = JSON.parse(localStorage.getItem('pinnedGroups') || '[]');
  const index = pinnedGroups.indexOf(groupId);
  
  if (index > -1) {
    pinnedGroups.splice(index, 1);
    showToast('✅ 已取消置顶', 'success');
  } else {
    pinnedGroups.push(groupId);
    showToast('✅ 已置顶', 'success');
  }
  
  localStorage.setItem('pinnedGroups', JSON.stringify(pinnedGroups));
}

// 显示群二维码（占位）
// 查看成员资料
async function viewMemberProfile(userId) {
  document.querySelector('.member-action-menu')?.remove();
  
  try {
    const response = await fetchWithAuth(`${apiService.apiUrl}/api/users/${userId}`);
    const user = await response.json();
    
    const hasAvatar = user.avatar && user.avatar.trim() !== '';
    const avatarHtml = hasAvatar
      ? `<div style="width:80px;height:80px;border-radius:50%;background-image:url('${apiService.apiUrl}${user.avatar}');background-size:cover;background-position:center;margin:0 auto 15px;"></div>`
      : `<div style="width:80px;height:80px;border-radius:50%;background:var(--primary-color);color:white;display:flex;align-items:center;justify-content:center;font-size:32px;margin:0 auto 15px;">${(user.nickname || user.username).charAt(0).toUpperCase()}</div>`;
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 360px;text-align:center;">
        <div class="modal-header">
          <h3>用户资料</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
        </div>
        <div class="modal-body" style="padding:30px 20px;">
          ${avatarHtml}
          <h3 style="margin-bottom:5px;">${user.nickname || user.username}</h3>
          <p style="color:var(--text-secondary);margin-bottom:15px;">@${user.username}</p>
          ${user.bio ? `<p style="color:var(--text-secondary);font-size:14px;">${user.bio}</p>` : ''}
        </div>
        <div class="modal-footer" style="justify-content:center;">
          <button class="btn btn-primary" onclick="openPrivateChat(${userId});this.closest('.modal').remove();">发送消息</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  } catch (error) {
    console.error('获取用户资料失败:', error);
    showToast('❌ 获取资料失败', 'error');
  }
}

// 私聊成员
async function openPrivateChat(userId) {
  document.querySelector('.member-action-menu')?.remove();
  
  try {
    const response = await fetchWithAuth(`${apiService.apiUrl}/api/users/${userId}`);
    const user = await response.json();
    
    const name = user.nickname || user.username;
    const firstChar = name.charAt(0).toUpperCase();
    openChat(userId, name, firstChar, user.avatar);
  } catch (error) {
    console.error('打开私聊失败:', error);
    showToast('❌ 打开私聊失败', 'error');
  }
}

// 加载群消息
async function loadGroupMessages(groupId) {
  try {
    const response = await fetchWithAuth(`${apiService.apiUrl}/api/groups/${groupId}/messages`);
    const messages = await response.json();
    
    const container = document.getElementById('messages-container');
    if (!container) return;
    
    // 获取所有发送者的用户信息（去重）
    const senderIds = [...new Set(messages.map(m => m.senderId))];
    const usersMap = new Map();
    
    await Promise.all(senderIds.map(async (senderId) => {
      try {
        const userResponse = await fetchWithAuth(`${apiService.apiUrl}/api/users/${senderId}`);
        const user = await userResponse.json();
        usersMap.set(senderId, user);
      } catch (error) {
        console.error(`获取用户 ${senderId} 信息失败:`, error);
      }
    }));
    
    // 获取当前用户在群里的角色
    let currentUserRole = 'MEMBER';
    try {
      const membersResponse = await fetchWithAuth(`${apiService.apiUrl}/api/groups/${groupId}/members`);
      const members = await membersResponse.json();
      const currentMember = members.find(m => m.userId === apiService.currentUser.id);
      if (currentMember) {
        currentUserRole = currentMember.role;
      }
    } catch (error) {
      console.error('获取群成员信息失败:', error);
    }
    
    // 渲染消息
    container.innerHTML = messages.map(msg => {
      const isMine = msg.senderId === apiService.currentUser.id;
      const time = new Date(msg.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      
      // 获取发送者信息
      const sender = usersMap.get(msg.senderId);
      const senderName = sender ? (sender.nickname || sender.username) : '用户';
      const senderAvatar = sender?.avatar;
      const firstChar = senderName.charAt(0).toUpperCase();
      
      // 生成头像 HTML - 添加右键菜单支持
      let avatarHtml;
      if (isMine) {
        // 自己的头像
        const hasMyAvatar = apiService.currentUser.avatar && apiService.currentUser.avatar.startsWith('/');
        avatarHtml = hasMyAvatar
          ? `<div class="avatar avatar-small message-avatar" data-user-id="${msg.senderId}" style="background-image: url('${apiService.apiUrl}${apiService.currentUser.avatar}'); background-size: cover; background-position: center;"></div>`
          : `<div class="avatar avatar-small message-avatar" data-user-id="${msg.senderId}">${apiService.currentUser.nickname?.charAt(0).toUpperCase()}</div>`;
      } else {
        // 其他成员的头像
        const hasAvatar = senderAvatar && senderAvatar.trim() !== '';
        avatarHtml = hasAvatar
          ? `<div class="avatar avatar-small message-avatar" data-user-id="${msg.senderId}" style="background-image: url('${apiService.apiUrl}${senderAvatar}'); background-size: cover; background-position: center;"></div>`
          : `<div class="avatar avatar-small message-avatar" data-user-id="${msg.senderId}">${firstChar}</div>`;
      }
      
      // 检查是否已撤回
      if (msg.isRecalled) {
        return `
          <div class="message-group ${isMine ? 'sent' : 'received'}" data-message-id="${msg.id}">
            ${!isMine ? avatarHtml : ''}
            <div class="message-content">
              ${!isMine ? `<div class="message-sender">${XssUtil.sanitize(senderName)}</div>` : ''}
              <div class="message-time">${time}</div>
              <div class="message-bubble recalled">消息已撤回</div>
            </div>
            ${isMine ? avatarHtml : ''}
          </div>
        `;
      }
      
      // 检查是否为文件消息
      if (isFileMessage(msg.content)) {
        // 使用专用的文件消息渲染函数
        return renderGroupFileMessage(msg, sender, groupId, currentUserRole);
      }
      
      // XSS防护
      const safeContent = LinkUtil.processContent(msg.content);
      
      return `
        <div class="message-group ${isMine ? 'sent' : 'received'}" data-message-id="${msg.id}">
          ${!isMine ? avatarHtml : ''}
          <div class="message-content">
            ${!isMine ? `<div class="message-sender">${XssUtil.sanitize(senderName)}</div>` : ''}
            <div class="message-time">${time}</div>
            <div class="message-bubble ${isMine ? 'sent' : 'received'}" 
                 data-message-id="${msg.id}" 
                 data-group-id="${groupId}"
                 data-sender-id="${msg.senderId}"
                 data-is-group="true">${safeContent}</div>
          </div>
          ${isMine ? avatarHtml : ''}
        </div>
      `;
    }).join('');
    
    // 为所有群消息气泡添加右键菜单事件
    container.querySelectorAll('.message-bubble[data-is-group="true"]').forEach(bubble => {
      if (bubble.classList.contains('recalled')) return; // 跳过已撤回的消息
      
      bubble.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        event.stopPropagation();
        
        const messageId = bubble.dataset.messageId;
        const senderId = parseInt(bubble.dataset.senderId);
        const messageContent = bubble.textContent;
        const isMine = senderId === apiService.currentUser.id;
        
        showGroupContextMenu(event, messageId, messageContent, groupId, senderId, isMine, currentUserRole);
      });
    });
    
    // 为消息头像添加右键菜单事件（管理功能）
    container.querySelectorAll('.message-avatar').forEach(avatar => {
      const userId = parseInt(avatar.dataset.userId);
      if (userId === apiService.currentUser.id) return; // 跳过自己的头像
      
      avatar.style.cursor = 'pointer';
      
      // 右键显示管理菜单
      avatar.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        event.stopPropagation();
        
        const isOwner = currentUserRole === 'OWNER';
        const isAdmin = currentUserRole === 'ADMIN' || currentUserRole === 'OWNER';
        showMemberActionMenu(event, userId, groupId, isOwner, isAdmin);
      });
      
      // 左键查看资料
      avatar.addEventListener('click', (event) => {
        event.stopPropagation();
        viewMemberProfile(userId);
      });
    });
    
    // 滚动到底部
    setTimeout(() => {
      container.scrollTop = container.scrollHeight;
    }, 100);
    
  } catch (error) {
    console.error('加载群消息失败:', error);
  }
}

// 发送群消息
async function sendGroupMessage(groupId) {
  const input = document.getElementById('group-message-input');
  let content = input.value.trim();
  
  if (!content) return;
  
  // 检查是否有引用消息
  let quoteData = null;
  try {
    if (input.dataset.quoteData) {
      quoteData = JSON.parse(input.dataset.quoteData);
    }
  } catch (e) {
    console.error('解析引用数据失败:', e);
  }
  
  // 如果有引用，将引用内容添加到消息前面
  if (quoteData && quoteData.content) {
    content = `[引用] ${quoteData.content.substring(0, 50)}${quoteData.content.length > 50 ? '...' : ''}\n\n${content}`;
  }
  
  try {
    const result = await apiService.sendGroupMessage(
      groupId,
      apiService.currentUser.id,
      content
    );
    
    if (result.success) {
      input.value = '';
      // 清除引用数据
      input.dataset.quoteData = '';
      // 移除引用预览
      const quotePreview = document.querySelector('.quote-preview');
      if (quotePreview) quotePreview.remove();
      
      loadGroupMessages(groupId);
    } else {
      showToast(result.error, 'error');
    }
  } catch (error) {
    console.error('发送群消息失败:', error);
    showToast('❌ 发送失败', 'error');
  }
}

// 显示群成员列表
async function showGroupMembers(groupId) {
  try {
    const membersResponse = await fetchWithAuth(`${apiService.apiUrl}/api/groups/${groupId}/members`);
    const members = await membersResponse.json();
    
    // 获取用户信息
    const usersPromises = members.map(async (member) => {
      const userResponse = await fetchWithAuth(`${apiService.apiUrl}/api/users/${member.userId}`);
      const user = await userResponse.json();
      return { ...member, user };
    });
    
    const membersWithUsers = await Promise.all(usersPromises);
    
    const currentMember = members.find(m => m.userId === apiService.currentUser.id);
    const isOwner = currentMember && currentMember.role === 'OWNER';
    const isAdmin = currentMember && currentMember.role === 'ADMIN';
    
    // 创建弹窗
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 500px; min-height: 400px;">
        <div class="modal-header">
          <h3 style="margin: 0; display: flex; align-items: center; gap: 10px;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            群成员 (${members.length})
          </h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()" style="font-size: 24px; line-height: 1; background: none; border: none; cursor: pointer; color: #999;">×</button>
        </div>
        <div class="modal-body" style="max-height: 500px; overflow-y: auto; padding: 15px;">
          ${membersWithUsers.map(m => {
            const name = m.user.nickname || m.user.username;
            const roleText = m.role === 'OWNER' ? '群主' : m.role === 'ADMIN' ? '管理员' : '成员';
            const roleClass = m.role.toLowerCase();
            
            let actions = '';
            if (isOwner && m.userId !== apiService.currentUser.id) {
              if (m.role === 'MEMBER') {
                actions = `
                  <button class="btn btn-small btn-outline" onclick="setGroupAdmin(${groupId}, ${m.userId}, true)">设为管理员</button>
                  <button class="btn btn-small btn-danger" onclick="removeGroupMember(${groupId}, ${m.userId})">踢出</button>
                `;
              } else if (m.role === 'ADMIN') {
                actions = `
                  <button class="btn btn-small btn-outline" onclick="setGroupAdmin(${groupId}, ${m.userId}, false)">取消管理员</button>
                  <button class="btn btn-small btn-danger" onclick="removeGroupMember(${groupId}, ${m.userId})">踢出</button>
                `;
              }
            } else if (isAdmin && m.role === 'MEMBER') {
              actions = `<button class="btn btn-small btn-danger" onclick="removeGroupMember(${groupId}, ${m.userId})">踢出</button>`;
            }
            
            return `
              <div class="member-item" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #eee;">
                <div class="member-info">
                  <div class="member-name" style="font-weight: 500; margin-bottom: 4px; display: flex; align-items: center; gap: 8px;">
                    <div style="width: 32px; height: 32px; border-radius: 50%; background: #4a90e2; color: white; display: flex; align-items: center; justify-content: center; font-size: 12px; flex-shrink: 0;">
                      ${name.charAt(0).toUpperCase()}
                    </div>
                    ${name}
                  </div>
                  <div class="member-role ${roleClass}" style="font-size: 12px; padding: 2px 8px; border-radius: 12px; display: inline-block; background: #f0f0f0; color: #666;">
                    ${roleText}
                  </div>
                </div>
                <div class="member-actions" style="display: flex; gap: 8px;">
                  ${actions}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
  } catch (error) {
    console.error('加载群成员失败:', error);
  }
}

// 设置管理员
async function setGroupAdmin(groupId, userId, isAdmin) {
  try {
    const response = await fetchWithAuth(`${apiService.apiUrl}/api/groups/${groupId}/members/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({
        operatorId: apiService.currentUser.id,
        role: isAdmin ? 'ADMIN' : 'MEMBER'
      })
    });
    
    if (response.ok) {
      showToast(isAdmin ? '✅ 已设置为管理员' : '✅ 已取消管理员', 'success');
      document.querySelector('.modal').remove();
      showGroupMembers(groupId);
    }
  } catch (error) {
    console.error('设置管理员失败:', error);
    showToast('❌ 操作失败', 'error');
  }
}

// 踢出成员
function removeGroupMember(groupId, userId) {
  // 创建确认弹窗
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 400px; min-width: 300px;">
      <div class="modal-header" style="border-bottom: 1px solid #eee; padding: 15px 20px; display: flex; justify-content: space-between; align-items: center;">
        <h3 style="margin: 0; display: flex; align-items: center; gap: 10px; color: #ff4757;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
          确认操作
        </h3>
        <button class="modal-close" onclick="this.closest('.modal').remove()" style="font-size: 24px; line-height: 1; background: none; border: none; cursor: pointer; color: #999;">×</button>
      </div>
      <div class="modal-body" style="padding: 20px; text-align: center;">
        <div style="font-size: 48px; margin: 15px 0; color: #ff6b6b;">
          ⚠️
        </div>
        <p style="margin: 10px 0; font-size: 16px; color: #333;">确定要踢出该成员吗？</p>
        <p style="margin: 5px 0; font-size: 14px; color: #666;">此操作不可撤销</p>
      </div>
      <div class="modal-footer" style="border-top: 1px solid #eee; padding: 15px 20px; display: flex; justify-content: flex-end; gap: 10px;">
        <button class="btn btn-secondary" onclick="this.closest('.modal').remove()" style="padding: 8px 16px; border: 1px solid #ddd; background: #f8f9fa; color: #666; border-radius: 6px; cursor: pointer;">取消</button>
        <button class="btn btn-danger" onclick="confirmRemoveGroupMember(${groupId}, ${userId})" style="padding: 8px 16px; background: #ff4757; color: white; border: none; border-radius: 6px; cursor: pointer;">确定踢出</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
}

// 确认踢出成员
async function confirmRemoveGroupMember(groupId, userId) {
  try {
    const response = await fetchWithAuth(`${apiService.apiUrl}/api/groups/${groupId}/members/${userId}?operatorId=${apiService.currentUser.id}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      showToast('✅ 已踢出成员', 'success');
      // 关闭所有弹窗
      document.querySelectorAll('.modal').forEach(m => m.remove());
      // 重新显示成员列表
      showGroupMembers(groupId);
    } else {
      const error = await response.json();
      showToast(`❌ 操作失败: ${error.message || '未知错误'}`, 'error');
    }
  } catch (error) {
    console.error('踢出成员失败:', error);
    showToast('❌ 操作失败', 'error');
  }
}

// 邀请好友加入群组
async function inviteToGroup(groupId) {
  try {
    // 获取好友列表
    const friendsResult = await apiService.getFriendsList(apiService.currentUser.id);
    if (!friendsResult.success) return;
    
    const friends = friendsResult.data;
    
    // 创建选择弹窗
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 500px; min-height: 400px;">
        <div class="modal-header" style="border-bottom: 1px solid #eee; padding: 15px 20px; display: flex; justify-content: space-between; align-items: center;">
          <h3 style="margin: 0; display: flex; align-items: center; gap: 10px;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            邀请好友
          </h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()" style="font-size: 24px; line-height: 1; background: none; border: none; cursor: pointer; color: #999;">×</button>
        </div>
        <div class="modal-body" style="padding: 20px; overflow-y: auto; flex: 1; max-height: 400px;">
          ${friends.map(friend => {
            const name = friend.nickname || friend.username;
            return `
              <div class="friend-item" style="display: flex; align-items: center; padding: 10px 0; border-bottom: 1px solid #eee;">
                <label style="display: flex; align-items: center; gap: 10px; flex: 1; cursor: pointer;">
                  <input type="checkbox" value="${friend.id}" class="invite-checkbox" style="width: 18px; height: 18px;">
                  <span style="display: flex; align-items: center; gap: 8px;">
                    <div style="width: 32px; height: 32px; border-radius: 50%; background: #4a90e2; color: white; display: flex; align-items: center; justify-content: center; font-size: 12px; flex-shrink: 0;">
                      ${name.charAt(0).toUpperCase()}
                    </div>
                    ${name}
                  </span>
                </label>
              </div>
            `;
          }).join('')}
          ${friends.length === 0 ? '<div style="text-align: center; padding: 40px 20px; color: #999;">暂无好友可邀请</div>' : ''}
        </div>
        <div class="modal-footer" style="border-top: 1px solid #eee; padding: 15px 20px; display: flex; justify-content: flex-end; gap: 10px;">
          <button class="btn btn-secondary" onclick="this.closest('.modal').remove()" style="padding: 8px 16px; border: 1px solid #ddd; background: #f8f9fa; color: #666; border-radius: 6px; cursor: pointer;">取消</button>
          <button class="btn btn-primary" onclick="sendGroupInvites(${groupId})" style="padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 6px; cursor: pointer;">发送邀请</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
  } catch (error) {
    console.error('加载好友列表失败:', error);
  }
}

// 发送群组邀请
async function sendGroupInvites(groupId) {
  const checkboxes = document.querySelectorAll('.invite-checkbox:checked');
  const userIds = Array.from(checkboxes).map(cb => Number(cb.value)); // 确保是数字类型
  
  if (userIds.length === 0) {
    showToast('⚠️ 请选择好友', 'warning');
    return;
  }
  
  try {
    const response = await fetchWithAuth(`${apiService.apiUrl}/api/groups/${groupId}/invite`, {
      method: 'POST',
      body: JSON.stringify({
        inviterId: apiService.currentUser.id,
        userIds: userIds
      })
    });
    
    if (response.ok) {
      showToast('✅ 邀请已发送', 'success');
      document.querySelector('.modal').remove();
    } else {
      const error = await response.json();
      showToast(`❌ ${error.error || '发送失败'}`, 'error');
    }
  } catch (error) {
    console.error('发送邀请失败:', error);
    showToast('❌ 发送失败', 'error');
  }
}

// 选择群图片
function selectGroupImage() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      await handleGroupFileSelect(file, 'image');
    }
  };
  input.click();
}

// 选择群视频
function selectGroupVideo() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'video/*';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      await handleGroupFileSelect(file, 'video');
    }
  };
  input.click();
}

// 选择群文件
function selectGroupFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '*/*';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      await handleGroupFileSelect(file, 'file');
    }
  };
  input.click();
}

// 显示群设置
async function showGroupSettings(groupId) {
  try {
    const response = await fetchWithAuth(`${apiService.apiUrl}/api/groups/${groupId}`);
    const group = await response.json();
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 500px; min-height: 400px;">
        <div class="modal-header" style="border-bottom: 1px solid #eee; padding: 15px 20px; display: flex; justify-content: space-between; align-items: center;">
          <h3 style="margin: 0; display: flex; align-items: center; gap: 10px;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1 1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33h-1.09a1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09a1.65 1.65 0 0 0-1-1.51z" />
            </svg>
            群设置
          </h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()" style="font-size: 24px; line-height: 1; background: none; border: none; cursor: pointer; color: #999;">×</button>
        </div>
        <div class="modal-body" style="padding: 20px; overflow-y: auto; flex: 1;">
          <div class="input-group" style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 6px; font-weight: 500; color: #333;">群名称</label>
            <input type="text" id="group-name-input" value="${group.groupName}" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;">
          </div>
          <div class="input-group" style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 6px; font-weight: 500; color: #333;">群简介</label>
            <textarea id="group-desc-input" rows="3" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; resize: vertical; box-sizing: border-box;">${group.description || ''}</textarea>
          </div>
          <div class="input-group" style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 6px; font-weight: 500; color: #333;">群公告</label>
            <textarea id="group-announcement-input" rows="4" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; resize: vertical; box-sizing: border-box;">${group.announcement || ''}</textarea>
          </div>
          <div class="input-group" style="margin-bottom: 15px;">
            <label style="display: flex; align-items: center; gap: 8px; font-weight: 500; color: #333;">
              <input type="checkbox" id="group-require-approval" ${group.requireApproval ? 'checked' : ''} style="width: 16px; height: 16px;">
              入群需要验证
            </label>
          </div>
        </div>
        <div class="modal-footer" style="border-top: 1px solid #eee; padding: 15px 20px; display: flex; justify-content: flex-end; gap: 10px;">
          <button class="btn btn-secondary" onclick="this.closest('.modal').remove()" style="padding: 8px 16px; border: 1px solid #ddd; background: #f8f9fa; color: #666; border-radius: 6px; cursor: pointer;">取消</button>
          <button class="btn btn-primary" onclick="saveGroupSettings(${groupId})" style="padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 6px; cursor: pointer;">保存</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
  } catch (error) {
    console.error('加载群设置失败:', error);
  }
}

// 保存群设置
async function saveGroupSettings(groupId) {
  const groupName = document.getElementById('group-name-input').value.trim();
  const description = document.getElementById('group-desc-input').value.trim();
  const announcement = document.getElementById('group-announcement-input').value.trim();
  const requireApproval = document.getElementById('group-require-approval').checked;
  
  if (!groupName) {
    showToast('❌ 群名称不能为空', 'error');
    return;
  }
  
  try {
    const response = await fetchWithAuth(`${apiService.apiUrl}/api/groups/${groupId}/settings`, {
      method: 'PUT',
      body: JSON.stringify({
        operatorId: apiService.currentUser.id,
        groupName,
        description,
        announcement,
        requireApproval
      })
    });
    
    if (response.ok) {
      showToast('✅ 设置已保存', 'success');
      document.querySelector('.modal').remove();
      loadGroupsList();
      if (currentGroup && currentGroup.id === groupId) {
        openGroupChat(groupId);
      }
    }
  } catch (error) {
    console.error('保存设置失败:', error);
    showToast('❌ 保存失败', 'error');
  }
}

// 加载通知数量
async function loadNotificationCounts() {
  try {
    // 好友通知
    const friendResponse = await fetchWithAuth(`${apiService.apiUrl}/api/friends/notifications/${apiService.currentUser.id}/unread`);
    const friendNotifs = await friendResponse.json();
    
    const friendBadge = document.getElementById('friend-notif-badge');
    if (friendBadge) {
      friendBadge.textContent = friendNotifs.length;
      friendBadge.style.display = friendNotifs.length > 0 ? 'inline-block' : 'none';
    }
    
    // 群聊通知
    const groupResponse = await fetchWithAuth(`${apiService.apiUrl}/api/groups/notifications/${apiService.currentUser.id}/unread`);
    const groupNotifs = await groupResponse.json();
    
    const groupBadge = document.getElementById('group-notif-badge');
    if (groupBadge) {
      groupBadge.textContent = groupNotifs.length;
      groupBadge.style.display = groupNotifs.length > 0 ? 'inline-block' : 'none';
    }
    
  } catch (error) {
    console.error('加载通知数量失败:', error);
  }
}

// 显示好友通知
function showFriendNotifications() {
  displayNotificationsInChat('friend');
}

// 显示群聊通知
function showGroupNotifications() {
  displayNotificationsInChat('group');
}

// 在聊天详情区域显示通知
async function displayNotificationsInChat(type) {
  const chatDetail = document.getElementById('chat-detail');
  
  const title = type === 'friend' ? '好友通知' : '群聊通知';
  const icon = type === 'friend' ? getSVGIcon('users', 24) : getSVGIcon('message', 24);
  
  chatDetail.innerHTML = `
    <div class="chat-header">
      <div class="chat-user-info">
        <div class="avatar">${icon}</div>
        <div>
          <div class="chat-user-name">${title}</div>
          <div class="chat-user-status">查看和管理通知</div>
        </div>
      </div>
    </div>
    
    <div class="messages-container" id="notifications-container" style="padding: 20px; overflow-y: auto;">
      <div style="text-align: center; padding: 20px; color: #999;">
        <div style="font-size: 40px; margin-bottom: 10px;">${getSVGIcon('loader', 40)}</div>
        <div>加载中...</div>
      </div>
    </div>
  `;
  
  // 加载通知数据
  if (type === 'friend') {
    await loadFriendNotificationsInChat();
  } else {
    await loadGroupNotificationsInChat();
  }
}

// 加载好友通知到聊天区域
async function loadFriendNotificationsInChat() {
  try {
    const response = await fetchWithAuth(`${apiService.apiUrl}/api/friends/notifications/${apiService.currentUser.id}`);
    const notifications = await response.json();
    
    const container = document.getElementById('notifications-container');
    
    if (notifications.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: #999;">
          <div style="font-size: 60px; margin-bottom: 15px;">${getSVGIcon('inbox', 60)}</div>
          <div style="font-size: 16px;">暂无好友通知</div>
        </div>
      `;
      return;
    }
    
    // 标记所有通知为已读
    await fetchWithAuth(`${apiService.apiUrl}/api/friends/notifications/mark-all-read/${apiService.currentUser.id}`, {
      method: 'PUT'
    });
    
    // 获取所有相关用户信息
    const userIds = [...new Set(notifications.map(n => n.fromUserId))];
    const usersMap = new Map();
    
    await Promise.all(userIds.map(async (userId) => {
      try {
        const userResponse = await fetchWithAuth(`${apiService.apiUrl}/api/users/${userId}`);
        const user = await userResponse.json();
        usersMap.set(userId, user);
      } catch (error) {
        console.error(`获取用户 ${userId} 信息失败:`, error);
      }
    }));
    
    container.innerHTML = notifications.map(notif => {
      const timeStr = new Date(notif.createdAt).toLocaleString('zh-CN');
      const fromUser = usersMap.get(notif.fromUserId);
      const fromUserName = fromUser ? (fromUser.nickname || fromUser.username) : `用户 #${notif.fromUserId}`;
      
      let actionsHtml = '';
      if (notif.notificationType === 'FRIEND_REQUEST' && notif.status === 'PENDING') {
        actionsHtml = `
          <div class="notification-actions">
            <button class="btn btn-accept" onclick="respondToFriendRequest(${notif.id}, true)">接受</button>
            <button class="btn btn-reject" onclick="respondToFriendRequest(${notif.id}, false)">拒绝</button>
          </div>
        `;
      }
      
      // 替换消息中的用户信息
      let message = notif.message;
      if (fromUser) {
        // 处理不同类型的通知消息
        if (notif.notificationType === 'FRIEND_REQUEST') {
          // "用户请求添加您为好友" -> "<strong>用户名</strong> 请求添加您为好友"
          message = message.replace(/用户.*?请求/, `<strong>${fromUserName}</strong> 请求`);
        } else if (notif.notificationType === 'FRIEND_ACCEPTED') {
          // "已接受您的好友申请" -> "<strong>用户名</strong> 已接受您的好友申请"
          message = `<strong>${fromUserName}</strong> ${message}`;
        } else if (notif.notificationType === 'FRIEND_REJECTED') {
          // "已拒绝您的好友申请" -> "<strong>用户名</strong> 已拒绝您的好友申请"
          message = `<strong>${fromUserName}</strong> ${message}`;
        } else {
          // 其他情况：替换 "用户" 关键字
          message = message.replace(/用户/, `<strong>${fromUserName}</strong>`);
        }
      }
      
      return `
        <div class="notification-item">
          <div class="notification-icon">
            ${notif.notificationType === 'FRIEND_REQUEST' ? getSVGIcon('user', 24) : notif.notificationType === 'FRIEND_ACCEPTED' ? getSVGIcon('check', 24) : getSVGIcon('x', 24)}
          </div>
          <div class="notification-content">
            <div class="notification-message">${message}</div>
            <div class="notification-time">${timeStr}</div>
            ${actionsHtml}
          </div>
        </div>
      `;
    }).join('');
    
    // 更新徽章
    loadNotificationCounts();
    
  } catch (error) {
    console.error('加载好友通知失败:', error);
    document.getElementById('notifications-container').innerHTML = `
      <div style="text-align: center; padding: 40px 20px; color: #f44336;">
        <div style="font-size: 60px; margin-bottom: 15px;">${getSVGIcon('x', 60)}</div>
        <div>加载失败，请稍后重试</div>
      </div>
    `;
  }
}

// 加载群聊通知到聊天区域
async function loadGroupNotificationsInChat() {
  try {
    // 先批量标记不需要操作的通知为已读
    await fetchWithAuth(`${apiService.apiUrl}/api/groups/notifications/mark-all-read/${apiService.currentUser.id}`, {
      method: 'PUT'
    });
    
    // 然后获取最新的通知数据
    const response = await fetchWithAuth(`${apiService.apiUrl}/api/groups/notifications/${apiService.currentUser.id}`);
    const notifications = await response.json();
    
    const container = document.getElementById('notifications-container');
    
    if (notifications.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: #999;">
          <div style="font-size: 60px; margin-bottom: 15px;">${getSVGIcon('inbox', 60)}</div>
          <div style="font-size: 16px;">暂无群聊通知</div>
        </div>
      `;
      // 更新徽章
      loadNotificationCounts();
      return;
    }
    
    // 获取所有相关用户和群组信息
    const userIds = [...new Set(notifications.map(n => n.fromUserId))];
    const groupIds = [...new Set(notifications.map(n => n.groupId))];
    
    const usersMap = new Map();
    const groupsMap = new Map();
    
    // 获取用户信息
    await Promise.all(userIds.map(async (userId) => {
      try {
        const userResponse = await fetchWithAuth(`${apiService.apiUrl}/api/users/${userId}`);
        const user = await userResponse.json();
        usersMap.set(userId, user);
      } catch (error) {
        console.error(`获取用户 ${userId} 信息失败:`, error);
      }
    }));
    
    // 获取群组信息
    await Promise.all(groupIds.map(async (groupId) => {
      try {
        const groupResponse = await fetchWithAuth(`${apiService.apiUrl}/api/groups/${groupId}`);
        const group = await groupResponse.json();
        groupsMap.set(groupId, group);
      } catch (error) {
        console.error(`获取群组 ${groupId} 信息失败:`, error);
      }
    }));
    
    container.innerHTML = notifications.map(notif => {
      const timeStr = new Date(notif.createdAt).toLocaleString('zh-CN');
      const unreadClass = notif.isRead ? '' : 'unread';
      
      const fromUser = usersMap.get(notif.fromUserId);
      const fromUserName = fromUser ? (fromUser.nickname || fromUser.username) : `用户 #${notif.fromUserId}`;
      const group = groupsMap.get(notif.groupId);
      const groupName = group ? group.groupName : `群组 #${notif.groupId}`;
      
      let icon = getSVGIcon('megaphone', 24);
      if (notif.notificationType === 'KICKED') icon = getSVGIcon('ban', 24);
      else if (notif.notificationType === 'PROMOTED_TO_ADMIN') icon = getSVGIcon('star', 24);
      else if (notif.notificationType === 'DEMOTED_FROM_ADMIN') icon = getSVGIcon('arrowDown', 24);
      else if (notif.notificationType === 'INVITED') icon = getSVGIcon('mail', 24);
      else if (notif.notificationType === 'JOIN_REQUEST') icon = getSVGIcon('bell', 24);
      else if (notif.notificationType === 'APPROVED') icon = getSVGIcon('checkCircle', 24);
      
      let actionsHtml = '';
      if (notif.notificationType === 'JOIN_REQUEST' && !notif.isRead) {
        actionsHtml = `
          <div class="notification-actions">
            <button class="btn btn-accept" onclick="respondToGroupRequest(${notif.id}, true)">同意</button>
            <button class="btn btn-reject" onclick="respondToGroupRequest(${notif.id}, false)">拒绝</button>
          </div>
        `;
      } else if (notif.notificationType === 'INVITED' && !notif.isRead) {
        actionsHtml = `
          <div class="notification-actions">
            <button class="btn btn-primary" onclick="showJoinGroupDialog(${notif.groupId}, '${groupName}', ${notif.id})">加入群聊</button>
          </div>
        `;
      }
      
      // 替换消息中的用户和群组信息
      let message = notif.message;
      if (fromUser) {
        message = message.replace(/用户/, `<strong>${fromUserName}</strong>`);
      }
      if (group) {
        message = message.replace(/群组[\uff1a:]\s*[^\u3002\uff0c]*/, `群组：<strong>${groupName}</strong>`);
      }
      
      return `
        <div class="notification-item ${unreadClass}">
          <div class="notification-icon">${icon}</div>
          <div class="notification-content">
            <div class="notification-message">${message}</div>
            <div class="notification-time">${timeStr}</div>
            ${actionsHtml}
          </div>
        </div>
      `;
    }).join('');
    
    // 更新徽章
    loadNotificationCounts();
    
  } catch (error) {
    console.error('加载群聊通知失败:', error);
    document.getElementById('notifications-container').innerHTML = `
      <div style="text-align: center; padding: 40px 20px; color: #f44336;">
        <div style="font-size: 60px; margin-bottom: 15px;">${getSVGIcon('x', 60)}</div>
        <div>加载失败，请稍后重试</div>
      </div>
    `;
  }
}

// 响应好友请求
async function respondToFriendRequest(notificationId, accepted) {
  try {
    const response = await fetchWithAuth(`${apiService.apiUrl}/api/friends/notifications/${notificationId}/respond`, {
      method: 'POST',
      body: JSON.stringify({ accepted })
    });
    
    if (response.ok) {
      showToast(accepted ? '✅ 已接受好友申请' : '❌ 已拒绝好友申请', 'success');
      // 重新加载通知列表
      loadFriendNotificationsInChat();
      // 刷新好友列表
      if (accepted) {
        loadFriendsList();
      }
    }
  } catch (error) {
    console.error('处理好友请求失败:', error);
    showToast('❌ 操作失败', 'error');
  }
}

// 响应群组请求
async function respondToGroupRequest(notificationId, approved) {
  try {
    const response = await fetchWithAuth(`${apiService.apiUrl}/api/groups/notifications/${notificationId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ 
        operatorId: apiService.currentUser.id,
        approved 
      })
    });
    
    if (response.ok) {
      showToast(approved ? '✅ 已同意加入' : '❌ 已拒绝加入', 'success');
      // 重新加载通知列表
      loadGroupNotificationsInChat();
      // 刷新群组列表（如果同意加入）
      if (approved) {
        loadGroupsList();
      }
    }
  } catch (error) {
    console.error('处理群组请求失败:', error);
    showToast('❌ 操作失败', 'error');
  }
}

// 显示加入群聊弹窗
function showJoinGroupDialog(groupId, groupName, notificationId) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>加入群聊</h3>
        <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
      </div>
      <div class="modal-body">
        <div style="text-align: center; padding: 20px;">
          <div style="font-size: 48px; margin-bottom: 15px;">${getSVGIcon('users', 48)}</div>
          <h4 style="margin: 10px 0; font-size: 18px;">${groupName}</h4>
          <p style="color: #666; margin-top: 10px;">确认要加入这个群聊吗？</p>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">取消</button>
        <button class="btn btn-primary" onclick="handleJoinGroup(${groupId}, ${notificationId}, this)">加入</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
}

// 处理加入群聊
async function handleJoinGroup(groupId, notificationId, button) {
  try {
    // 禁用按钮防止重复点击
    button.disabled = true;
    button.textContent = '加入中...';
    
    const response = await fetchWithAuth(`${apiService.apiUrl}/api/groups/${groupId}/join`, {
      method: 'POST',
      body: JSON.stringify({ 
        userId: apiService.currentUser.id
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      
      // 关闭弹窗
      document.querySelector('.modal').remove();
      
      if (result.joined) {
        // 直接加入成功
        showToast('✅ ' + result.message, 'success');
        // 标记通知为已读
        await markGroupNotificationAsRead(notificationId);
        // 刷新群组列表
        loadGroupsList();
        // 重新加载通知列表
        loadGroupNotificationsInChat();
      } else if (result.requireApproval) {
        // 需要审核
        showToast('📤 ' + result.message, 'info');
        // 标记通知为已读
        await markGroupNotificationAsRead(notificationId);
        // 重新加载通知列表
        loadGroupNotificationsInChat();
      }
    } else {
      const error = await response.json();
      showToast('❌ ' + (error.error || '加入失败'), 'error');
      button.disabled = false;
      button.textContent = '加入';
    }
  } catch (error) {
    console.error('加入群聊失败:', error);
    showToast('❌ 加入失败', 'error');
    button.disabled = false;
    button.textContent = '加入';
  }
}

// 标记群组通知为已读
async function markGroupNotificationAsRead(notificationId) {
  try {
    await fetchWithAuth(`${apiService.apiUrl}/api/groups/notifications/${notificationId}/read`, {
      method: 'PUT'
    });
  } catch (error) {
    console.error('标记已读失败:', error);
  }
}

// 定时刷新通知数量
setInterval(loadNotificationCounts, 30000);

// 更新未读消息总数
function updateTotalUnreadCount() {
  let total = 0;
  
  // 统计私聊未读
  unreadMessages.forEach(count => {
    total += count;
  });
  
  // 通知主进程更新托盘
  ipcRenderer.send('update-unread-count', total);
  
  console.log(`[未读消息] 总数: ${total}`);
}

// 添加未读消息
function addUnreadMessage(userId) {
  const current = unreadMessages.get(userId) || 0;
  unreadMessages.set(userId, current + 1);
  updateTotalUnreadCount();
}

// 清除未读消息
function clearUnreadMessages(userId) {
  unreadMessages.delete(userId);
  updateTotalUnreadCount();
}

// 添加群组未读消息
function addUnreadGroupMessage(groupId) {
  const current = unreadGroupMessages.get(groupId) || 0;
  unreadGroupMessages.set(groupId, current + 1);
  updateTotalUnreadCount();
}

// 清除群组未读消息
function clearUnreadGroupMessages(groupId) {
  unreadGroupMessages.delete(groupId);
  updateTotalUnreadCount();
}

// 加载登录后的未读消息
async function loadUnreadMessages() {
  try {
    console.log('[未读消息] 开始加载未读消息...');
    const result = await apiService.getUnreadMessages(apiService.currentUser.id);
    
    if (result.success && result.data.length > 0) {
      // 按发送者统计未读消息数
      const unreadCount = new Map();
      result.data.forEach(msg => {
        const senderId = msg.senderId;
        unreadCount.set(senderId, (unreadCount.get(senderId) || 0) + 1);
      });
      
      // 更新 unreadMessages
      unreadMessages = unreadCount;
      
      console.log(`[未读消息] 加载完成，共 ${result.data.length} 条未读消息，来自 ${unreadMessages.size} 个联系人`);
      
      // 更新总未读数并刷新界面
      updateTotalUnreadCount();
      renderChatsList();
    } else {
      console.log('[未读消息] 没有未读消息');
    }
  } catch (error) {
    console.error('[未读消息] 加载失败:', error);
  }
}

// 暴露到全局
window.addUnreadMessage = addUnreadMessage;
window.clearUnreadMessages = clearUnreadMessages;
window.addUnreadGroupMessage = addUnreadGroupMessage;
window.clearUnreadGroupMessages = clearUnreadGroupMessages;

// ========== 天气功能 ==========
const WEATHER_API_URL = 'https://uapis.cn/api/v1/misc/weather';
let weatherCache = null;
let weatherCacheTime = 0;
const WEATHER_CACHE_DURATION = 60 * 1000; // 1分钟缓存
const WEATHER_AUTO_REFRESH_INTERVAL = 60 * 1000; // 1分钟自动刷新

// 天气 Font Awesome 图标映射
const weatherIconMap = {
  '晴': 'fa-sun',
  '多云': 'fa-cloud-sun',
  '阴': 'fa-cloud',
  '小雨': 'fa-cloud-rain',
  '中雨': 'fa-cloud-showers-heavy',
  '大雨': 'fa-cloud-showers-heavy',
  '暴雨': 'fa-poo-storm',
  '雷': 'fa-bolt',
  '雪': 'fa-snowflake',
  '雾': 'fa-smog',
  '霾': 'fa-smog',
  '沙尘': 'fa-wind'
};

// 获取天气图标类名
function getWeatherIconClass(weather) {
  for (const [key, iconClass] of Object.entries(weatherIconMap)) {
    if (weather && weather.includes(key)) {
      return iconClass;
    }
  }
  return 'fa-cloud'; // 默认图标
}

// 加载天气
async function loadWeather(isManual = false) {
  const widget = document.getElementById('weather-widget');
  if (!widget) return;

  // 检查缓存（手动刷新时跳过缓存）
  if (!isManual && weatherCache && (Date.now() - weatherCacheTime < WEATHER_CACHE_DURATION)) {
    updateWeatherUI(weatherCache);
    return;
  }

  // 只有手动刷新时才显示 Win11 风格加载动画
  if (isManual) {
    widget.classList.add('manual-loading');
  }
  widget.classList.remove('error');

  try {
    // 尝试获取用户位置
    const city = await getUserCity();
    
    // 调用天气 API
    const params = new URLSearchParams();
    if (city) {
      params.append('city', city);
    }
    // 如果没有城市信息，API 会根据 IP 自动定位
    
    const response = await fetch(`${WEATHER_API_URL}?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    // 缓存数据
    weatherCache = data;
    weatherCacheTime = Date.now();
    
    // 更新 UI
    updateWeatherUI(data);
    
    console.log('[Weather] 天气加载成功:', data.city, data.weather, data.temperature + '°C');
  } catch (error) {
    console.error('[Weather] 加载失败:', error);
    widget.classList.add('error');
    document.getElementById('weather-temp').textContent = '--°';
    document.getElementById('weather-city').textContent = '加载失败';
  } finally {
    widget.classList.remove('manual-loading');
  }
}

// 更新天气 UI
function updateWeatherUI(data) {
  const iconEl = document.getElementById('weather-icon');
  const tempEl = document.getElementById('weather-temp');
  const cityEl = document.getElementById('weather-city');
  const updateEl = document.getElementById('weather-update');
  const mainIconEl = document.getElementById('weather-main-icon');
  const mainTempEl = document.getElementById('weather-main-temp');
  const mainDescEl = document.getElementById('weather-main-desc');
  const humidityEl = document.getElementById('weather-humidity');
  const windEl = document.getElementById('weather-wind');
  const windPowerEl = document.getElementById('weather-wind-power');

  // 更新小图标
  if (iconEl) {
    const iconClass = getWeatherIconClass(data.weather);
    iconEl.className = `fas ${iconClass}`;
  }
  if (tempEl) tempEl.textContent = `${data.temperature}°`;

  // 详情卡片
  if (cityEl) cityEl.textContent = `${data.city || ''}`;
  if (updateEl && data.report_time) {
    const time = data.report_time.split(' ')[1]?.substring(0, 5) || '';
    updateEl.textContent = time ? `${time}` : '';
  }
  // 更新大图标
  if (mainIconEl) {
    const iconClass = getWeatherIconClass(data.weather);
    mainIconEl.innerHTML = `<i class="fas ${iconClass} fa-3x"></i>`;
  }
  if (mainTempEl) mainTempEl.textContent = `${data.temperature}°C`;
  if (mainDescEl) mainDescEl.textContent = data.weather || '--';
  if (humidityEl) humidityEl.textContent = `${data.humidity || '--'}%`;
  if (windEl) windEl.textContent = data.wind_direction || '--';
  if (windPowerEl) windPowerEl.textContent = `${data.wind_power || '--'}级`;
}

// 获取用户城市（通过 IP 定位）
async function getUserCity() {
  try {
    // 使用太平洋 IP 定位接口
    const city = await getIpLocation();
    if (city) {
      console.log('[Weather] IP定位成功:', city);
      return city;
    }
    return null;
  } catch (error) {
    console.error('[Weather] 获取城市失败:', error);
    return null;
  }
}

// 通过 IP 获取位置
async function getIpLocation() {
  try {
    const response = await fetch('https://ip9.com.cn/get');
    const data = await response.json();
    
    if (data.ret === 200 && data.data) {
      // 优先使用 area（区县），如果没有则使用 city
      const area = data.data.area;
      const city = data.data.city;
      
      const location = (area && area.trim()) ? area : city;
      
      if (location && location.trim()) {
        console.log('[Weather] IP定位成功:', location);
        return location;
      }
    }
    
    console.warn('[Weather] IP定位返回数据异常:', data);
    return null;
  } catch (error) {
    console.error('[Weather] IP定位失败:', error);
    return null;
  }
}

// 手动刷新天气
function refreshWeather() {
  weatherCache = null;
  weatherCacheTime = 0;
  loadWeather(true); // true 表示手动刷新，显示动画
}

// 自动刷新天气（不显示动画）
function autoRefreshWeather() {
  weatherCache = null;
  weatherCacheTime = 0;
  loadWeather(false); // false 表示自动刷新，不显示动画
}

// 天气组件点击事件
document.addEventListener('DOMContentLoaded', () => {
  const widget = document.getElementById('weather-widget');
  if (widget) {
    widget.addEventListener('click', (e) => {
      e.stopPropagation();
      // 防止加载中重复点击
      if (widget.classList.contains('manual-loading')) return;
      refreshWeather();
      showToast('正在刷新天气...', 'info');
    });
  }
  
  // 启动自动刷新定时器（1分钟）
  setInterval(autoRefreshWeather, WEATHER_AUTO_REFRESH_INTERVAL);
});

// 暴露天气函数到全局
window.loadWeather = loadWeather;
window.refreshWeather = refreshWeather;

// ========== 主题切换功能 ==========
const THEME_STORAGE_KEY = 'zsmessage_theme';

// 主题名称映射
const THEME_NAMES = {
  'blue': '蓝色主题',
  'orange': '橙色主题',
  'green': '绿色主题',
  'purple': '紫色主题',
  'pink': '粉色主题',
  'dark': '暗色模式'
};

// 初始化主题
function initializeTheme() {
  let savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  // 兼容旧版 light 主题
  if (!savedTheme || savedTheme === 'light') {
    savedTheme = 'blue';
  }
  applyTheme(savedTheme);
}

// 应用主题
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  
  // 更新主题选项的选中状态
  document.querySelectorAll('.theme-option').forEach(option => {
    option.classList.toggle('active', option.dataset.theme === theme);
  });
  
  console.log('[Theme] 已切换到:', THEME_NAMES[theme] || theme);
}

// 打开主题选择面板
function openThemePanel() {
  const overlay = document.getElementById('theme-panel-overlay');
  if (overlay) {
    overlay.classList.add('show');
    // 更新当前选中状态
    let currentTheme = localStorage.getItem(THEME_STORAGE_KEY) || 'blue';
    if (currentTheme === 'light') currentTheme = 'blue';
    document.querySelectorAll('.theme-option').forEach(option => {
      option.classList.toggle('active', option.dataset.theme === currentTheme);
    });
  }
}

// 关闭主题选择面板
function closeThemePanel() {
  const overlay = document.getElementById('theme-panel-overlay');
  if (overlay) {
    overlay.classList.remove('show');
  }
}

// 设置主题面板事件
function setupThemePanel() {
  // 关闭按钮
  const closeBtn = document.getElementById('theme-panel-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeThemePanel);
  }
  
  // 点击遮罩层关闭
  const overlay = document.getElementById('theme-panel-overlay');
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeThemePanel();
      }
    });
  }
  
  // 主题选项点击
  document.querySelectorAll('.theme-option').forEach(option => {
    option.addEventListener('click', () => {
      const theme = option.dataset.theme;
      applyTheme(theme);
      showToast(`已切换到${THEME_NAMES[theme] || theme}`, 'success');
      // 延迟关闭面板，让用户看到选中效果
      setTimeout(closeThemePanel, 300);
    });
  });
}

// 暴露主题函数到全局
window.openThemePanel = openThemePanel;
window.closeThemePanel = closeThemePanel;

// ==================== 深度链接入群处理 ====================

/**
 * 监听导航事件（从主进程发送）
 */
ipcRenderer.on('navigate-to', (event, page) => {
  console.log('[Navigate] 导航到:', page);
  if (page === 'announcements') {
    // 打开公告页面
    window.location.href = 'announcements.html';
  }
});

/**
 * 监听通过深度链接的入群请求
 */
ipcRenderer.on('group-invite', async (event, data) => {
  console.log('[DeepLink] 收到入群请求:', data);
  
  const { inviteCode } = data;
  if (!inviteCode) {
    showToast('无效的邀请链接', 'error');
    return;
  }
  
  // 检查登录状态
  if (!apiService.currentUser) {
    showToast('请先登录', 'warning');
    return;
  }
  
  // 显示入群申请弹窗
  showJoinGroupDialog(inviteCode);
});

/**
 * 显示入群申请弹窗
 */
async function showJoinGroupDialog(inviteCode) {
  // 获取群信息
  try {
    const response = await fetchWithAuth(`${apiService.apiUrl}/api/groups/invite/${inviteCode}`);
    const result = await response.json();
    
    if (!result.found) {
      showToast('邀请链接无效或已过期', 'error');
      return;
    }
    
    const group = result.group;
    const firstChar = group.groupName?.charAt(0).toUpperCase() || 'G';
    
    // 创建弹窗
    const modal = document.createElement('div');
    modal.className = 'modal join-group-modal';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 400px;">
        <div class="modal-header">
          <h3><i class="fas fa-users" style="color:var(--primary-color);margin-right:8px;"></i>加入群聊</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
        </div>
        <div class="modal-body" style="text-align:center;padding:30px 20px;">
          <div class="join-group-avatar" style="width:80px;height:80px;border-radius:50%;background:var(--primary-color);color:white;display:flex;align-items:center;justify-content:center;font-size:32px;margin:0 auto 20px;">
            ${firstChar}
          </div>
          <div class="join-group-name" style="font-size:18px;font-weight:bold;margin-bottom:8px;">
            ${XssUtil.sanitize(group.groupName)}
          </div>
          <div class="join-group-number" style="color:var(--text-secondary);font-size:14px;margin-bottom:8px;">
            群号: ${group.groupNumber}
          </div>
          ${group.description ? `<div class="join-group-desc" style="color:var(--text-secondary);font-size:13px;margin-bottom:15px;">${XssUtil.sanitize(group.description)}</div>` : ''}
          ${group.category ? `<div class="join-group-category" style="display:inline-block;padding:3px 10px;background:var(--primary-light);color:var(--primary-color);border-radius:12px;font-size:12px;margin-bottom:15px;">${XssUtil.sanitize(group.category)}</div>` : ''}
          ${group.requireApproval ? `
            <div class="join-group-notice" style="background:var(--bg-secondary);padding:12px;border-radius:8px;margin-top:15px;">
              <i class="fas fa-info-circle" style="color:var(--primary-color);"></i>
              <span style="color:var(--text-secondary);font-size:13px;">该群需要管理员审核</span>
            </div>
            <textarea id="join-group-message" placeholder="请输入验证信息（可选）" 
              style="width:100%;margin-top:15px;padding:10px;border:1px solid var(--border-color);border-radius:8px;resize:none;height:60px;background:var(--input-bg);color:var(--text-primary);"></textarea>
          ` : ''}
        </div>
        <div class="modal-footer" style="justify-content:center;gap:10px;">
          <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">取消</button>
          <button class="btn btn-primary" onclick="submitJoinGroupRequest('${inviteCode}')">
            ${group.requireApproval ? '申请加入' : '立即加入'}
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
  } catch (error) {
    console.error('获取群信息失败:', error);
    showToast('获取群信息失败', 'error');
  }
}

/**
 * 提交入群申请
 */
async function submitJoinGroupRequest(inviteCode) {
  try {
    const messageInput = document.getElementById('join-group-message');
    const message = messageInput ? messageInput.value.trim() : '';
    
    const response = await fetchWithAuth(`${apiService.apiUrl}/api/groups/invite/${inviteCode}/join`, {
      method: 'POST',
      body: JSON.stringify({
        userId: apiService.currentUser.id,
        message: message
      })
    });
    
    const result = await response.json();
    
    if (result.error) {
      showToast(result.error, 'error');
      return;
    }
    
    // 关闭弹窗
    document.querySelector('.join-group-modal')?.remove();
    
    if (result.joined) {
      showToast('✅ ' + result.message, 'success');
      // 刷新群组列表
      await loadGroupsList();
      // 如果加入成功，直接打开群聊
      if (result.groupId) {
        setTimeout(() => openGroupChat(result.groupId), 500);
      }
    } else if (result.requireApproval) {
      showToast('✅ ' + result.message, 'success');
    }
    
  } catch (error) {
    console.error('提交入群申请失败:', error);
    showToast('提交申请失败', 'error');
  }
}

window.showJoinGroupDialog = showJoinGroupDialog;
window.submitJoinGroupRequest = submitJoinGroupRequest;


// ========== 手机号绑定 ==========

let smsCountdown = 0;
let smsTimer = null;

/**
 * 初始化手机绑定功能
 */
function initPhoneBinding() {
  const sendCodeBtn = document.getElementById('send-sms-code-btn');
  const bindPhoneBtn = document.getElementById('bind-phone-btn');
  const phoneInput = document.getElementById('phone-input');
  
  if (sendCodeBtn) {
    sendCodeBtn.addEventListener('click', sendSmsCode);
  }
  
  if (bindPhoneBtn) {
    bindPhoneBtn.addEventListener('click', bindPhone);
  }
  
  // 加载当前绑定状态
  loadPhoneStatus();
}

/**
 * 加载手机绑定状态
 */
async function loadPhoneStatus() {
  try {
    const userId = apiService.currentUser.id;
    const response = await fetch(`${apiService.apiUrl}/api/phone/status/${userId}`, {
      headers: { 'Authorization': `Bearer ${apiService.authToken}` }
    });
    const data = await response.json();
    
    const boundInfo = document.getElementById('phone-bound-info');
    const unboundInfo = document.getElementById('phone-unbound-info');
    const bindForm = document.getElementById('phone-bind-form');
    const boundPhone = document.getElementById('bound-phone');
    
    if (data.bound && data.verified) {
      // 已绑定 - 显示绑定信息，隐藏绑定表单
      if (boundInfo) boundInfo.style.display = 'flex';
      if (unboundInfo) unboundInfo.style.display = 'none';
      if (bindForm) bindForm.style.display = 'none';
      if (boundPhone && data.phone) boundPhone.textContent = data.phone;
    } else {
      // 未绑定 - 显示绑定表单
      if (boundInfo) boundInfo.style.display = 'none';
      if (unboundInfo) unboundInfo.style.display = 'flex';
      if (bindForm) bindForm.style.display = 'block';
    }
  } catch (error) {
    console.error('获取手机绑定状态失败:', error);
  }
}

/**
 * 发送短信验证码
 */
async function sendSmsCode() {
  const phoneInput = document.getElementById('phone-input');
  const sendBtn = document.getElementById('send-sms-code-btn');
  const codeRow = document.getElementById('code-row');
  
  const phone = phoneInput?.value.trim();
  
  if (!phone) {
    showToast('请输入手机号', 'error');
    return;
  }
  
  if (!/^1[3-9]\d{9}$/.test(phone)) {
    showToast('手机号格式不正确', 'error');
    return;
  }
  
  try {
    sendBtn.disabled = true;
    sendBtn.textContent = '发送中...';
    
    const response = await fetch(`${apiService.apiUrl}/api/phone/send-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiService.authToken}`
      },
      body: JSON.stringify({
        phone: phone,
        userId: apiService.currentUser.id.toString()
      })
    });
    
    const data = await response.json();
    
    if (data.error) {
      showToast(data.error, 'error');
      sendBtn.disabled = false;
      sendBtn.textContent = '获取验证码';
      return;
    }
    
    showToast('验证码已发送', 'success');
    
    // 显示验证码输入框
    if (codeRow) codeRow.style.display = 'flex';
    
    // 开始倒计时
    startSmsCountdown(sendBtn);
    
  } catch (error) {
    console.error('发送验证码失败:', error);
    showToast('发送失败，请稍后重试', 'error');
    sendBtn.disabled = false;
    sendBtn.textContent = '获取验证码';
  }
}

/**
 * 倒计时
 */
function startSmsCountdown(btn) {
  smsCountdown = 60;
  btn.disabled = true;
  btn.textContent = `${smsCountdown}s`;
  
  smsTimer = setInterval(() => {
    smsCountdown--;
    if (smsCountdown <= 0) {
      clearInterval(smsTimer);
      btn.disabled = false;
      btn.textContent = '获取验证码';
    } else {
      btn.textContent = `${smsCountdown}s`;
    }
  }, 1000);
}

/**
 * 绑定手机号
 */
async function bindPhone() {
  const phoneInput = document.getElementById('phone-input');
  const codeInput = document.getElementById('sms-code-input');
  const bindBtn = document.getElementById('bind-phone-btn');
  
  const phone = phoneInput?.value.trim();
  const code = codeInput?.value.trim();
  
  if (!phone || !code) {
    showToast('请输入手机号和验证码', 'error');
    return;
  }
  
  try {
    bindBtn.disabled = true;
    bindBtn.textContent = '绑定中...';
    
    const response = await fetch(`${apiService.apiUrl}/api/phone/bind`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiService.authToken}`
      },
      body: JSON.stringify({
        phone: phone,
        code: code,
        userId: apiService.currentUser.id.toString()
      })
    });
    
    const data = await response.json();
    
    if (data.error) {
      showToast(data.error, 'error');
      bindBtn.disabled = false;
      bindBtn.textContent = '绑定';
      return;
    }
    
    showToast('手机号绑定成功', 'success');
    
    // 刷新状态
    loadPhoneStatus();
    
    // 清空输入
    if (phoneInput) phoneInput.value = '';
    if (codeInput) codeInput.value = '';
    
  } catch (error) {
    console.error('绑定手机号失败:', error);
    showToast('绑定失败，请稍后重试', 'error');
    bindBtn.disabled = false;
    bindBtn.textContent = '绑定';
  }
}

// 在页面加载完成后初始化手机绑定
setTimeout(initPhoneBinding, 1000);


