const SockJS = require('sockjs-client');
const Stomp = require('stompjs');
const apiService = require('./api');

class WebSocketService {
  constructor() {
    this.stompClient = null;
    this.connected = false;
    this.subscriptions = {};
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000;
    this.userId = null;
    this.onMessageReceived = null;
    this.onGroupMessageReceived = null;
    this.onCallSignal = null;
    this.onSystemMessageReceived = null;
  }

  connect(userId, onMessageReceived, onGroupMessageReceived, onCallSignal, onSystemMessageReceived) {
    this.userId = userId;
    this.onMessageReceived = onMessageReceived;
    this.onGroupMessageReceived = onGroupMessageReceived;
    this.onCallSignal = onCallSignal;
    this.onSystemMessageReceived = onSystemMessageReceived;
    
    return new Promise((resolve, reject) => {
      const socket = new SockJS('你的API地址/ws');
      this.stompClient = Stomp.over(socket);
      
      // Disable debug output
      this.stompClient.debug = null;

      this.stompClient.connect(
        {},
        (frame) => {
          console.log('[WebSocket] Connected:', frame);
          this.connected = true;
          this.reconnectAttempts = 0;

          // Subscribe to personal message queue - 使用用户队列
          const messageSubscription = this.stompClient.subscribe(
            `/user/${userId}/queue/messages`,
            (message) => {
              try {
                const messageData = JSON.parse(message.body);
                console.log('[WebSocket] Message received:', messageData);
                
                if (this.onMessageReceived) {
                  this.onMessageReceived(messageData);
                }
              } catch (error) {
                console.error('[WebSocket] Parse error:', error);
              }
            }
          );
          this.subscriptions['messages'] = messageSubscription;

          // Subscribe to call signaling queue - 使用用户队列
          const callSubscription = this.stompClient.subscribe(
            `/user/${userId}/queue/call`,
            (message) => {
              try {
                const signalData = JSON.parse(message.body);
                console.log('[WebSocket] Call signal received:', signalData.type);
                
                if (this.onCallSignal) {
                  this.onCallSignal(signalData);
                }
              } catch (error) {
                console.error('[WebSocket] Call signal parse error:', error);
              }
            }
          );
          this.subscriptions['calls'] = callSubscription;

          // Subscribe to user's group topics
          this.subscribeToUserGroups();

          // Subscribe to system messages
          this.subscribeToSystemMessages();

          resolve();
        },
        (error) => {
          console.error('[WebSocket] Connection error:', error);
          this.connected = false;
          
          // Auto reconnect
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`[WebSocket] Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            
            setTimeout(() => {
              this.connect(userId, this.onMessageReceived, this.onGroupMessageReceived, this.onCallSignal);
            }, this.reconnectDelay);
          } else {
            reject(error);
          }
        }
      );
    });
  }

  // 发送通话信令
  sendCallSignal(destination, data) {
    if (this.stompClient && this.connected) {
      this.stompClient.send(`/app/call/${destination}`, {}, JSON.stringify(data));
      console.log('[WebSocket] Sent call signal:', destination);
    } else {
      console.error('[WebSocket] Not connected, cannot send call signal');
    }
  }

  // 发起通话邀请
  sendCallInvite(data) {
    this.sendCallSignal('invite', data);
  }

  // 发送通话应答
  sendCallAnswer(data) {
    this.sendCallSignal('answer', data);
  }

  // 发送 SDP Offer
  sendOffer(data) {
    this.sendCallSignal('offer', data);
  }

  // 发送 SDP Answer
  sendSdpAnswer(data) {
    this.sendCallSignal('sdp-answer', data);
  }

  // 发送 ICE Candidate
  sendIceCandidate(data) {
    this.sendCallSignal('ice-candidate', data);
  }

  // 发送挂断
  sendHangup(data) {
    this.sendCallSignal('hangup', data);
  }

  // 发送媒体状态
  sendMediaState(data) {
    this.sendCallSignal('media-state', data);
  }



  disconnect() {
    if (this.stompClient && this.connected) {
      // Unsubscribe all subscriptions
      Object.values(this.subscriptions).forEach(sub => {
        if (sub && sub.unsubscribe) {
          sub.unsubscribe();
        }
      });
      
      this.subscriptions = {};
      this.stompClient.disconnect(() => {
        console.log('[WebSocket] Disconnected');
      });
      this.connected = false;
    }
  }

  // 订阅用户的所有群组
  async subscribeToUserGroups() {
    try {
      // 从apiService获取认证信息
      const authDataStr = localStorage.getItem('zsmessage_auth');
      if (!authDataStr) {
        console.error('[WebSocket] No authentication data found');
        return;
      }
      
      const authData = JSON.parse(authDataStr);
      const token = authData.token;
      
      // 获取用户加入的所有群组
      const response = await fetch(`${apiService.apiUrl}/api/groups/user/${this.userId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const groupMembers = await response.json();
        
        // 取消之前的所有群组订阅
        this.unsubscribeFromAllGroups();
        
        // 为每个群组创建订阅
        groupMembers.forEach(member => {
          this.subscribeToGroup(member.groupId);
        });
      }
    } catch (error) {
      console.error('[WebSocket] Error subscribing to user groups:', error);
    }
  }

  // 订阅特定群组
  subscribeToGroup(groupId) {
    if (!this.stompClient || !this.connected) {
      console.error('[WebSocket] Not connected, cannot subscribe to group');
      return;
    }
    
    // 获取token用于订阅认证
    let headers = {};
    try {
      const authDataStr = localStorage.getItem('zsmessage_auth');
      if (authDataStr) {
        const authData = JSON.parse(authDataStr);
        headers['Authorization'] = `Bearer ${authData.token}`;
      }
    } catch (e) {
      console.error('[WebSocket] Error getting auth token for subscription:', e);
    }
    
    const subscription = this.stompClient.subscribe(`/topic/group/${groupId}`, (message) => {
      try {
        const groupMessage = JSON.parse(message.body);
        console.log('[WebSocket] Group message received:', groupMessage);
        
        if (this.onGroupMessageReceived) {
          this.onGroupMessageReceived(groupMessage);
        }
      } catch (error) {
        console.error('[WebSocket] Group message parse error:', error);
      }
    }, headers);
    
    this.groupSubscriptions = this.groupSubscriptions || {};
    this.groupSubscriptions[groupId] = subscription;
    console.log(`[WebSocket] Subscribed to group ${groupId}`);
  }

  // 取消订阅特定群组
  unsubscribeFromGroup(groupId) {
    if (this.groupSubscriptions && this.groupSubscriptions[groupId]) {
      this.groupSubscriptions[groupId].unsubscribe();
      delete this.groupSubscriptions[groupId];
      console.log(`[WebSocket] Unsubscribed from group ${groupId}`);
    }
  }

  // 取消订阅所有群组
  unsubscribeFromAllGroups() {
    if (this.groupSubscriptions) {
      Object.keys(this.groupSubscriptions).forEach(groupId => {
        this.unsubscribeFromGroup(groupId);
      });
    }
  }

  // 订阅系统消息
  subscribeToSystemMessages() {
    if (!this.stompClient || !this.connected) {
      console.error('[WebSocket] Not connected, cannot subscribe to system messages');
      return;
    }
    
    const subscription = this.stompClient.subscribe(`/user/${this.userId}/queue/system`, (message) => {
      try {
        const systemMessage = JSON.parse(message.body);
        console.log('[WebSocket] System message received:', systemMessage);
        
        if (this.onSystemMessageReceived) {
          this.onSystemMessageReceived(systemMessage);
        }
      } catch (error) {
        console.error('[WebSocket] System message parse error:', error);
      }
    });
    
    this.subscriptions['system'] = subscription;
    console.log(`[WebSocket] Subscribed to system messages for user ${this.userId}`);
  }

  isConnected() {
    return this.connected;
  }
}

// Export singleton
const wsService = new WebSocketService();
module.exports = wsService;
