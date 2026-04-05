const axios = require('axios');
// E2E加密已移除，改用服务器端加密

class ApiService {
  constructor() {
    this.baseURL = '你的API地址/api';
    this.apiUrl = '你的API地址'; // 添加 apiUrl 属性
    this.authToken = null;
    this.currentUser = null;
    
    // Load saved auth from localStorage
    this.loadAuthFromStorage();
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 300000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // 请求拦截器 - 自动添加认证token
    this.client.interceptors.request.use(
      (config) => {
        if (this.authToken) {
          config.headers['Authorization'] = `Bearer ${this.authToken}`;
          console.log(`[API] ${config.method.toUpperCase()} ${config.url} [Token: ${this.authToken.substring(0, 20)}...]`);
        } else {
          console.warn(`[API] ${config.method.toUpperCase()} ${config.url} [No Token]`);
          console.warn('[API] 当前认证状态:', {
            hasToken: !!this.authToken,
            hasUser: !!this.currentUser,
            localStorageKeys: Object.keys(localStorage || {})
          });
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // 响应拦截器 - 处理认证错误
    this.client.interceptors.response.use(
      (response) => {
        console.log(`[API] Response:`, response.status);
        return response;
      },
      (error) => {
        console.error(`[API] Error:`, error.message);
        console.error(`[API] Error Response:`, error.response?.status, error.response?.data);
        
        // 处理 401 认证错误
        if (error.response && error.response.status === 401) {
          console.error('[API] 认证失败，Token无效或已过期');
          console.error('[API] 当前认证信息:', {
            hasToken: !!this.authToken,
            tokenLength: this.authToken?.length || 0,
            hasUser: !!this.currentUser
          });
          this.clearAuthStorage();
          // 可以在这里触发跳转到登录页面
          window.location.href = 'login.html';
        }
        
        return Promise.reject(error);
      }
    );
  }

  // ========== 认证相关 ==========
  
  /**
   * 获取图片验证码
   */
  async getCaptcha() {
    try {
      const response = await this.client.get('/auth/captcha');
      return { 
        success: true, 
        captchaId: response.data.captchaId,
        captchaImage: response.data.captchaImage
      };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error || '获取验证码失败' 
      };
    }
  }
  
  /**
   * 根据智穗号获取用户信息
   */
  async getUserBySmartCode(smartCode) {
    try {
      console.log('[API] getUserBySmartCode called with smartCode:', smartCode);
      console.log('[API] Current auth state:', {
        hasToken: !!this.authToken,
        tokenLength: this.authToken?.length || 0,
        hasUser: !!this.currentUser
      });
      
      const response = await this.client.get(`/users/smartcode/${smartCode}`);
      return { 
        success: true, 
        data: response.data
      };
    } catch (error) {
      console.error('[API] getUserBySmartCode error:', error);
      return { 
        success: false, 
        error: error.response?.data?.error || '获取用户信息失败' 
      };
    }
  }
  
  async login(username, password, captchaData = null) {
    try {
      const requestData = {
        password
      };
      
      // 判断是智穗号还是用户名
      if (/^\d+$/.test(username) && username.length >= 6) { // 假设智穗号是数字且至少6位
        requestData.smartCode = username;
      } else {
        requestData.username = username;
      }
      
      // 如果有验证码数据，添加到请求中
      if (captchaData) {
        requestData.captchaId = captchaData.captchaId;
        requestData.captchaCode = captchaData.captchaCode;
      }
      
      const response = await this.client.post('/auth/login', requestData);
      
      // 检查用户状态
      if (response.data.user && response.data.user.status === 0) {
        const banReason = response.data.banReason || '违规操作';
        const errorMessage = `账户封禁中，理由：${banReason}\n\n如需申诉，请访问官网：message.zhsidc.com/appeal`;
        return { 
          success: false, 
          error: errorMessage 
        };
      }
      
      this.authToken = response.data.token;
      this.currentUser = {
        id: response.data.userId,
        username: response.data.username,
        nickname: response.data.nickname,
        status: response.data.user?.status || 1  // 添加用户状态
      };
      
      // Save to localStorage
      this.saveAuthToStorage();
      
      return { success: true, data: response.data };
    } catch (error) {
      // 检查是否需要验证码（403响应）
      if (error.response?.status === 403 && error.response?.data?.needsCaptcha) {
        return {
          success: false,
          needsCaptcha: true,
          error: error.response.data.error || '需要完成人机验证'
        };
      }
      
      // 检查错误响应中是否包含封禁信息
      let errorMessage = error.response?.data?.error || '登录失败';
      if (error.response?.data?.message && error.response?.data?.message.includes('封禁')) {
        const banReason = error.response.data.banReason || '违规操作';
        errorMessage = `账户封禁中，理由：${banReason}\n\n如需申诉，请访问官网：message.zhsidc.com/appeal`;
      }
      
      return { 
        success: false, 
        error: errorMessage
      };
    }
  }

  async sendVerificationCode(email) {
    try {
      const response = await this.client.post('/auth/send-verification-code', {
        email
      });
      return { success: true, data: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error || '发送验证码失败' 
      };
    }
  }

  async sendSmsCode(phone) {
    try {
      const response = await this.client.post('/auth/send-sms-code', {
        phone
      });
      return { success: true, data: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error || '发送短信验证码失败' 
      };
    }
  }

  async register(username, password, nickname, phone, smsCode) {
    try {
      const response = await this.client.post('/auth/register', {
        username,
        password,
        nickname,
        phone,
        smsCode
      });
      
      this.authToken = response.data.token;
      this.currentUser = {
        id: response.data.userId,
        username: response.data.username,
        nickname: response.data.nickname
      };
      
      // Save to localStorage
      this.saveAuthToStorage();
      
      return { success: true, data: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error || '注册失败' 
      };
    }
  }

  // ========== 用户相关 ==========
  
  async searchUsers(keyword) {
    try {
      const response = await this.client.get('/users/search', {
        params: { keyword }
      });
      return { success: true, data: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error || '搜索用户失败' 
      };
    }
  }

  async getUserById(userId) {
    try {
      const response = await this.client.get(`/users/${userId}`);
      return { success: true, data: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error || '获取用户信息失败' 
      };
    }
  }

  async updateProfile(userId, updates) {
    try {
      const response = await this.client.put(`/users/${userId}`, updates);
      return { success: true, data: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error || '更新资料失败' 
      };
    }
  }

  // ========== 好友相关 ==========
  
  async getFriendsList(userId) {
    try {
      const response = await this.client.get(`/friends/list/${userId}`);
      return { success: true, data: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error || '获取好友列表失败' 
      };
    }
  }

  async sendFriendRequest(userId, friendId, message) {
    try {
      const response = await this.client.post('/friends/notifications/send', {
        fromUserId: userId,
        toUserId: friendId,
        message
      });
      return { success: true, data: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error || '发送好友请求失败' 
      };
    }
  }

  async getPendingRequests(userId) {
    try {
      const response = await this.client.get(`/friends/pending/${userId}`);
      return { success: true, data: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error || '获取好友请求失败' 
      };
    }
  }

  async acceptFriendRequest(requestId, userId) {
    try {
      const response = await this.client.post(`/friends/accept/${requestId}`, {
        userId
      });
      return { success: true, data: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error || '接受好友请求失败' 
      };
    }
  }

  async rejectFriendRequest(requestId, userId) {
    try {
      const response = await this.client.post(`/friends/reject/${requestId}`, {
        userId
      });
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error || '拒绝好友请求失败' 
      };
    }
  }

  // ========== 消息相关 ==========
  
  async sendMessage(senderId, receiverId, content, type = 'TEXT') {
    try {
      // 后端期望接收完整的Message对象（服务器端加密）
      const message = {
        senderId: senderId,
        receiverId: receiverId,
        content: content,
        messageType: type,
        isRead: false,
        isRecalled: false,
        isForwarded: false
      };
      
      const response = await this.client.post('/messages/send', message);
      return { success: true, data: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error || '发送消息失败' 
      };
    }
  }

  async getMessageHistory(userId1, userId2) {
    try {
      const response = await this.client.get('/messages/history', {
        params: { userId1, userId2 }
      });
      // 消息已由服务器解密返回
      return { success: true, data: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error || '获取消息历史失败' 
      };
    }
  }

  async searchMessages(userId, keyword) {
    try {
      const response = await this.client.get('/messages/search', {
        params: { userId, keyword }
      });
      return { success: true, data: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error || '搜索消息失败' 
      };
    }
  }

  async recallMessage(messageId, userId) {
    try {
      const response = await this.client.post(`/messages/recall/${messageId}`, {
        userId
      });
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error || '撤回消息失败' 
      };
    }
  }

  async forwardMessage(messageId, senderId, receiverId) {
    try {
      const response = await this.client.post('/messages/forward', {
        messageId,
        senderId,
        receiverId
      });
      return { success: true, data: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error || '转发消息失败' 
      };
    }
  }

  async getUnreadMessages(userId) {
    try {
      const response = await this.client.get(`/messages/unread/${userId}`);
      // 消息已由服务器解密返回
      return { success: true, data: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error || '获取未读消息失败' 
      };
    }
  }

  async markChatAsRead(senderId, receiverId) {
    try {
      const response = await this.client.post('/messages/markChatAsRead', {
        senderId,
        receiverId
      });
      return { success: true, data: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error || '标记已读失败' 
      };
    }
  }

  // ========== 群组相关 ==========
  
  async getUserGroups(userId) {
    try {
      const response = await this.client.get(`/groups/user/${userId}`);
      return { success: true, data: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error || '获取群组列表失败' 
      };
    }
  }

  async getGroupById(groupId) {
    try {
      const response = await this.client.get(`/groups/${groupId}`);
      return { success: true, data: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error || '获取群组信息失败' 
      };
    }
  }

  async createGroup(groupData) {
    try {
      const response = await this.client.post('/groups/create', groupData);
      return { success: true, data: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error || '创建群组失败' 
      };
    }
  }

  async sendGroupMessage(groupId, senderId, content, type = 'TEXT') {
    try {
      const response = await this.client.post('/groups/messages/send', {
        groupId,
        senderId,
        content: content,
        messageType: type
      });
      return { success: true, data: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error || '发送群消息失败' 
      };
    }
  }

  async getGroupMessages(groupId) {
    try {
      const response = await this.client.get(`/groups/${groupId}/messages`);
      
      return { success: true, data: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error || '获取群消息失败' 
      };
    }
  }
  
  async markGroupMessagesAsRead(groupId, userId) {
    try {
      const response = await this.client.post(`/groups/${groupId}/markAsRead`, {
        userId
      });
      return { success: true, data: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error || '标记群组消息已读失败' 
      };
    }
  }

  // ========== 文件相关 ==========
  
  async uploadFile(file, senderId, receiverId) {
    try {
      console.log('[API] 开始上传文件:', file.name, '大小:', file.size, 'senderId:', senderId, 'receiverId:', receiverId);
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('senderId', senderId.toString());
      formData.append('receiverId', receiverId.toString());

      // 使用 fetch API 代替 axios，因为 axios 处理 FormData 时有时会出问题
      const response = await fetch(`${this.baseURL}/files/upload`, {
        method: 'POST',
        headers: {
          'Authorization': this.authToken ? `Bearer ${this.authToken}` : ''
        },
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: '上传失败' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      const data = await response.json();
      console.log('[API] 文件上传成功:', data);
      return { success: true, data };
    } catch (error) {
      console.error('[API] 文件上传失败:', error.message);
      return { 
        success: false, 
        error: error.message || '上传文件失败' 
      };
    }
  }

  async downloadFile(fileMessageId, userId) {
    try {
      const response = await this.client.get(`/files/download/${fileMessageId}`, {
        params: { userId },
        responseType: 'blob'
      });
      return { success: true, data: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error || '下载文件失败' 
      };
    }
  }

  // ========== Local Storage Management ==========
  
  saveAuthToStorage() {
    if (this.authToken && this.currentUser) {
      const authData = {
        token: this.authToken,
        user: this.currentUser,
        timestamp: Date.now()
      };
      localStorage.setItem('zsmessage_auth', JSON.stringify(authData));
      console.log('[Auth] Saved to localStorage');
    }
  }

  loadAuthFromStorage() {
    try {
      const authDataStr = localStorage.getItem('zsmessage_auth');
      if (authDataStr) {
        const authData = JSON.parse(authDataStr);
        
        // Check if token is not too old (7 days)
        const tokenAge = Date.now() - authData.timestamp;
        const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
        
        if (tokenAge < maxAge) {
          this.authToken = authData.token;
          this.currentUser = authData.user;
          console.log('[Auth] Loaded from localStorage:', this.currentUser.username);
          return true;
        } else {
          console.log('[Auth] Token expired, clearing storage');
          this.clearAuthStorage();
        }
      }
    } catch (error) {
      console.error('[Auth] Failed to load from storage:', error);
    }
    return false;
  }

  clearAuthStorage() {
    this.authToken = null;
    this.currentUser = null;
    localStorage.removeItem('zsmessage_auth');
    console.log('[Auth] Cleared storage');
  }

  isAuthenticated() {
    return !!(this.authToken && this.currentUser);
  }
  
  // 管理员功能
  async banUser(userId, reason, adminToken) {
    try {
      const response = await fetch(`${this.apiUrl}/api/admin/users/${userId}/ban`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Admin-Token': adminToken
        },
        body: JSON.stringify({
          reason: reason,
          adminId: 1  // 临时硬编码管理员ID
        })
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || '封禁用户失败');
      }
      
      return { success: true, data: result };
    } catch (error) {
      console.error('封禁用户失败:', error);
      return { success: false, error: error.message };
    }
  }
  
  async warnUser(userId, reason, adminToken) {
    try {
      const response = await fetch(`${this.apiUrl}/api/admin/users/${userId}/warn`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Admin-Token': adminToken
        },
        body: JSON.stringify({
          reason: reason,
          adminId: 1  // 临时硬编码管理员ID
        })
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || '警告用户失败');
      }
      
      return { success: true, data: result };
    } catch (error) {
      console.error('警告用户失败:', error);
      return { success: false, error: error.message };
    }
  }
  
  async deleteUser(userId, reason, adminToken) {
    try {
      const response = await fetch(`${this.apiUrl}/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Admin-Token': adminToken
        }
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || '删除用户失败');
      }
      
      return { success: true, data: result };
    } catch (error) {
      console.error('删除用户失败:', error);
      return { success: false, error: error.message };
    }
  }
  
  // 翻译功能
  async translate(text, toLang = 'en') {
    try {
      const response = await fetch(`https://uapis.cn/api/v1/translate/text?to_lang=${toLang}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text
        })
      });
      
      if (!response.ok) {
        throw new Error(`翻译请求失败: ${response.status}`);
      }
      
      const result = await response.json();
      return { success: true, data: result };
    } catch (error) {
      console.error('翻译失败:', error);
      return { success: false, error: error.message };
    }
  }
}

// 导出单例
const apiService = new ApiService();
module.exports = apiService;
