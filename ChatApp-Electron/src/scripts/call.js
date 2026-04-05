const { ipcRenderer } = require('electron');
const webrtcService = require('../services/webrtc-service');
const apiService = require('../services/api');

// 通话状态
let callState = {
  callId: null,
  callerId: null,
  targetUserId: null,
  callerName: '',
  callType: 'video',
  isIncoming: false,
  isMuted: false,
  isVideoOff: false,
  duration: 0,
  durationTimer: null,
  startTime: null
};

// DOM 元素（延迟初始化）
let elements = {};

// 初始化 DOM 元素
function initElements() {
  elements = {
    localVideo: document.getElementById('local-video'),
    remoteVideo: document.getElementById('remote-video'),
    localVideoContainer: document.getElementById('local-video-container'),
    calleeAvatar: document.getElementById('callee-avatar'),
    calleeName: document.getElementById('callee-name'),
    callStatusText: document.getElementById('call-status-text'),
    callDuration: document.getElementById('call-duration'),
    statusDot: document.getElementById('status-dot'),
    statusText: document.getElementById('status-text'),
    incomingOverlay: document.getElementById('incoming-overlay'),
    incomingTitle: document.getElementById('incoming-title'),
    incomingAvatar: document.getElementById('incoming-avatar'),
    incomingName: document.getElementById('incoming-name'),
    controlsBar: document.getElementById('controls-bar'),
    muteBtn: document.getElementById('mute-btn'),
    muteIcon: document.getElementById('mute-icon'),
    muteIconOff: document.getElementById('mute-icon-off'),
    videoBtn: document.getElementById('video-btn'),
    videoIcon: document.getElementById('video-icon'),
    videoIconOff: document.getElementById('video-icon-off'),
    hangupBtn: document.getElementById('hangup-btn'),
    acceptBtn: document.getElementById('accept-btn'),
    rejectBtn: document.getElementById('reject-btn'),
    networkQuality: document.getElementById('network-quality')
  };
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  console.log('[Call] DOMContentLoaded event fired');
  
  initElements();
  console.log('[Call] Elements initialized');
  
  setupWebRTC();
  console.log('[Call] WebRTC setup complete');
  
  setupEventListeners();
  console.log('[Call] Event listeners setup complete');
  
  // 从 URL 参数获取通话信息
  const urlParams = new URLSearchParams(window.location.search);
  console.log('[Call] URL params:', window.location.search);
  
  const callData = {
    callId: urlParams.get('callId'),
    callerId: urlParams.get('callerId'),
    targetUserId: urlParams.get('targetUserId'),
    callerName: urlParams.get('callerName') || '用户',
    callType: urlParams.get('callType') || 'video',
    isIncoming: urlParams.get('isIncoming') === 'true'
  };
  
  console.log('[Call] Parsed call data:', callData);
  
  initializeCall(callData);
});

// 设置 WebRTC 服务
function setupWebRTC() {
  // 本地流回调
  webrtcService.onLocalStream = (stream) => {
    console.log('[Call] Got local stream');
    elements.localVideo.srcObject = stream;
  };
  
  // 远程流回调
  webrtcService.onRemoteStream = (stream) => {
    console.log('[Call] Got remote stream');
    elements.remoteVideo.srcObject = stream;
  };
  
  // 通话状态变化回调
  webrtcService.onCallStateChange = (state) => {
    console.log('[Call] State changed:', state);
    handleCallStateChange(state);
  };
  
  // 错误回调
  webrtcService.onError = (error) => {
    console.error('[Call] Error:', error);
    showError(error.message || '通话出错');
  };
  
  // 发送通话记录消息回调 - 直接调用API发送
  webrtcService.onSendCallRecord = async (targetUserId, callMessage) => {
    console.log('[Call] Sending call record message to:', targetUserId);
    try {
      const result = await apiService.sendMessage(
        apiService.currentUser.id,
        targetUserId,
        callMessage,
        'CALL'
      );
      if (result.success) {
        console.log('[Call] 通话记录消息发送成功');
        // 乐观更新：立即通知主窗口添加消息到UI（不等WebSocket推送）
        ipcRenderer.send('call-message-sent', {
          targetUserId: targetUserId,
          message: result.data  // 后端返回的完整消息对象
        });
      } else {
        console.error('[Call] 通话记录消息发送失败:', result.error);
      }
    } catch (error) {
      console.error('[Call] 通话记录消息发送异常:', error);
    }
  };
  
  // 设置信令处理器
  webrtcService.setSignalingHandler({
    sendCallInvite: (data) => ipcRenderer.send('call-signaling', data),
    sendCallAnswer: (data) => ipcRenderer.send('call-signaling', data),
    sendOffer: (data) => ipcRenderer.send('call-signaling', data),
    sendSdpAnswer: (data) => ipcRenderer.send('call-signaling', data),
    sendIceCandidate: (data) => ipcRenderer.send('call-signaling', data),
    sendHangup: (data) => ipcRenderer.send('call-signaling', data),
    sendMediaState: (data) => ipcRenderer.send('call-signaling', data)
  });
}

// 设置事件监听器
function setupEventListeners() {
  // 静音按钮
  elements.muteBtn.addEventListener('click', toggleMute);
  
  // 视频按钮
  elements.videoBtn.addEventListener('click', toggleVideo);
  
  // 挂断按钮
  elements.hangupBtn.addEventListener('click', hangup);
  
  // 接听按钮
  elements.acceptBtn.addEventListener('click', acceptCall);
  
  // 拒绝按钮
  elements.rejectBtn.addEventListener('click', rejectCall);
  
  // 接收信令消息
  ipcRenderer.on('call-signal', (event, data) => {
    handleSignalingMessage(data);
  });
  
  // 窗口关闭前挂断
  window.addEventListener('beforeunload', () => {
    if (webrtcService.isInCall()) {
      webrtcService.hangup();
    }
  });
  
  // 拖动本地视频
  makeDraggable(elements.localVideoContainer);
}

// 初始化通话
function initializeCall(data) {
  // 确保 ID 是数字类型
  callState = { 
    ...callState, 
    ...data,
    callerId: data.callerId ? parseInt(data.callerId) : null,
    targetUserId: data.targetUserId ? parseInt(data.targetUserId) : null
  };
  
  console.log('[Call] Initialize with state:', callState);
  
  // 设置 UI
  const firstChar = callState.callerName.charAt(0).toUpperCase();
  elements.calleeAvatar.textContent = firstChar;
  elements.calleeName.textContent = callState.callerName;
  elements.incomingAvatar.textContent = firstChar;
  elements.incomingName.textContent = callState.callerName;
  
  // 设置通话类型
  if (callState.callType === 'voice') {
    document.body.classList.add('audio-only-mode');
    elements.videoBtn.classList.add('hidden');
    elements.incomingTitle.textContent = '语音来电';
  } else {
    elements.incomingTitle.textContent = '视频来电';
  }
  
  if (callState.isIncoming) {
    // 来电
    showIncomingCall();
  } else {
    // 发起通话
    startOutgoingCall();
  }
}

// 显示来电界面
function showIncomingCall() {
  elements.incomingOverlay.classList.remove('hidden');
  elements.controlsBar.classList.add('hidden');
  updateStatus('来电中', 'connecting');
  
  // 播放来电铃声（可选）
  // playRingtone();
}

// 发起通话
async function startOutgoingCall() {
  try {
    elements.incomingOverlay.classList.add('hidden');
    elements.controlsBar.classList.remove('hidden');
    updateStatus('正在呼叫...', 'connecting');
    elements.callStatusText.textContent = '正在检查设备...';
    
    console.log('[Call] Starting outgoing call with:', {
      callerId: callState.callerId,
      targetUserId: callState.targetUserId,
      callType: callState.callType
    });
    
    // 先测试设备访问
    console.log('[Call] Testing device access...');
    const testResult = await webrtcService.testDeviceAccess(callState.callType);
    
    if (!testResult.success) {
      console.error('[Call] Device test failed:', testResult);
      
      // 显示详细的错误信息和解决方案
      let errorDetails = `设备测试失败

错误: ${testResult.message}

`;
      
      if (testResult.error === 'NotReadableError' || testResult.error === 'TrackStartError') {
        errorDetails += '可能的原因：\n';
        errorDetails += '1. 摄像头正在被其他程序使用\n';
        errorDetails += '2. 虚拟摄像头（OBS、Snap Camera）未启动\n';
        errorDetails += '3. Windows 隐私设置阻止了访问\n';
        errorDetails += '4. 驱动程序问题\n\n';
        errorDetails += '解决方法：\n';
        if (testResult.hint) {
          errorDetails += `⚠️ ${testResult.hint}\n`;
        }
        errorDetails += '1. 如果使用虚拟摄像头：\n';
        errorDetails += '   - 确保 OBS Virtual Camera 已启动\n';
        errorDetails += '   - 或切换到物理摄像头\n';
        errorDetails += '2. 打开 Windows 设置 → 隐私 → 相机\n';
        errorDetails += '   确保"允许应用访问相机"已开启\n';
        errorDetails += '3. 关闭可能使用摄像头的程序：\n';
        errorDetails += '   - 微信、QQ、钉钉等聊天软件\n';
        errorDetails += '   - 浏览器（Chrome、Edge 等）\n';
        errorDetails += '4. 在任务管理器中结束相关进程\n';
        errorDetails += '5. 重启计算机';
      } else if (testResult.error === 'NotAllowedError') {
        errorDetails += '解决方法：\n';
        errorDetails += '1. 打开 Windows 设置 → 隐私 → 相机/麦克风\n';
        errorDetails += '2. 确保"允许应用访问"已开启\n';
        errorDetails += '3. 检查防病毒软件是否阻止访问';
      }
      
      showError(errorDetails);
      setTimeout(() => closeCallWindow(), 5000);
      return;
    }
    
    console.log('[Call] Device test passed, initiating call...');
    elements.callStatusText.textContent = '正在呼叫...';
    
    const success = await webrtcService.initiateCall(
      callState.callerId,
      callState.targetUserId,
      callState.callType
    );
    
    if (!success) {
      showError('无法发起通话');
      setTimeout(() => closeCallWindow(), 2000);
    }
  } catch (error) {
    console.error('[Call] Failed to start outgoing call:', error);
    showError(error.message || '无法发起通话');
    setTimeout(() => closeCallWindow(), 2000);
  }
}

// 接听通话
async function acceptCall() {
  elements.incomingOverlay.classList.add('hidden');
  elements.controlsBar.classList.remove('hidden');
  updateStatus('连接中...', 'connecting');
  elements.callStatusText.textContent = '连接中...';
  
  const success = await webrtcService.acceptCall(
    callState.callerId,
    callState.targetUserId,
    callState.callType
  );
  
  if (!success) {
    showError('接听失败');
    setTimeout(() => closeCallWindow(), 2000);
  }
}

// 拒绝通话
function rejectCall() {
  webrtcService.rejectCall(callState.callerId, callState.targetUserId);
  closeCallWindow();
}

// 挂断通话
function hangup() {
  webrtcService.hangup();
  closeCallWindow();
}

// 切换静音
function toggleMute() {
  callState.isMuted = webrtcService.toggleMute();
  
  if (callState.isMuted) {
    elements.muteBtn.classList.add('active');
    elements.muteIcon.classList.add('hidden');
    elements.muteIconOff.classList.remove('hidden');
  } else {
    elements.muteBtn.classList.remove('active');
    elements.muteIcon.classList.remove('hidden');
    elements.muteIconOff.classList.add('hidden');
  }
}

// 切换视频
function toggleVideo() {
  const videoEnabled = webrtcService.toggleVideo();
  callState.isVideoOff = !videoEnabled;
  
  if (callState.isVideoOff) {
    elements.videoBtn.classList.add('active');
    elements.videoIcon.classList.add('hidden');
    elements.videoIconOff.classList.remove('hidden');
    elements.localVideoContainer.classList.add('hidden');
  } else {
    elements.videoBtn.classList.remove('active');
    elements.videoIcon.classList.remove('hidden');
    elements.videoIconOff.classList.add('hidden');
    elements.localVideoContainer.classList.remove('hidden');
  }
}

// 处理信令消息
function handleSignalingMessage(data) {
  console.log('[Call] Received signaling:', data.type);
  
  switch (data.type) {
    case 'answer':
      if (data.accepted) {
        // 对方接听，创建并发送 offer
        webrtcService.createAndSendOffer();
      } else {
        // 对方拒绝
        showError('对方已拒绝');
        setTimeout(() => closeCallWindow(), 2000);
      }
      break;
      
    case 'offer':
      webrtcService.handleOffer(data);
      break;
      
    case 'sdp-answer':
      webrtcService.handleAnswer(data);
      break;
      
    case 'ice-candidate':
      webrtcService.handleIceCandidate(data);
      break;
      
    case 'hangup':
      showError('对方已挂断');
      webrtcService.cleanup();
      setTimeout(() => closeCallWindow(), 1500);
      break;
      
    case 'media-state':
      handleRemoteMediaState(data);
      break;
  }
}

// 处理通话状态变化
function handleCallStateChange(state) {
  switch (state) {
    case 'calling':
      updateStatus('正在呼叫...', 'connecting');
      elements.callStatusText.textContent = '正在呼叫...';
      break;
      
    case 'connecting':
      updateStatus('连接中...', 'connecting');
      elements.callStatusText.textContent = '连接中...';
      break;
      
    case 'connected':
      updateStatus('通话中', 'connected');
      elements.callStatusText.textContent = '通话中';
      startDurationTimer();
      break;
      
    case 'disconnected':
      updateStatus('连接断开', 'disconnected');
      elements.callStatusText.textContent = '连接断开';
      stopDurationTimer();
      setTimeout(() => closeCallWindow(), 2000);
      break;
      
    case 'ended':
      updateStatus('通话已结束', 'disconnected');
      elements.callStatusText.textContent = '通话已结束';
      stopDurationTimer();
      break;
  }
}

// 处理远程媒体状态变化
function handleRemoteMediaState(data) {
  if (data.audioEnabled !== undefined) {
    // 对方静音/取消静音
    console.log('[Call] Remote audio:', data.audioEnabled);
  }
  
  if (data.videoEnabled !== undefined) {
    // 对方开启/关闭摄像头
    console.log('[Call] Remote video:', data.videoEnabled);
  }
}

// 更新状态显示
function updateStatus(text, state) {
  elements.statusText.textContent = text;
  elements.statusDot.className = 'status-dot';
  
  if (state === 'connecting') {
    elements.statusDot.classList.add('connecting');
  } else if (state === 'disconnected') {
    elements.statusDot.classList.add('disconnected');
  }
}

// 开始计时
function startDurationTimer() {
  callState.startTime = Date.now();
  elements.callDuration.classList.remove('hidden');
  
  callState.durationTimer = setInterval(() => {
    const elapsed = Math.floor((Date.now() - callState.startTime) / 1000);
    elements.callDuration.textContent = formatDuration(elapsed);
  }, 1000);
}

// 停止计时
function stopDurationTimer() {
  if (callState.durationTimer) {
    clearInterval(callState.durationTimer);
    callState.durationTimer = null;
  }
}

// 格式化时长
function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// 显示错误
function showError(message) {
  elements.callStatusText.textContent = message;
  updateStatus(message, 'disconnected');
}

// 关闭通话窗口
function closeCallWindow() {
  stopDurationTimer();
  webrtcService.cleanup();
  ipcRenderer.send('close-call-window');
}

// 使元素可拖动
function makeDraggable(element) {
  let isDragging = false;
  let offsetX, offsetY;
  
  element.addEventListener('mousedown', (e) => {
    isDragging = true;
    offsetX = e.clientX - element.offsetLeft;
    offsetY = e.clientY - element.offsetTop;
    element.style.cursor = 'grabbing';
  });
  
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    
    const x = e.clientX - offsetX;
    const y = e.clientY - offsetY;
    
    // 限制在窗口内
    const maxX = window.innerWidth - element.offsetWidth;
    const maxY = window.innerHeight - element.offsetHeight;
    
    element.style.left = Math.max(0, Math.min(x, maxX)) + 'px';
    element.style.top = Math.max(0, Math.min(y, maxY)) + 'px';
    element.style.right = 'auto';
  });
  
  document.addEventListener('mouseup', () => {
    isDragging = false;
    element.style.cursor = 'move';
  });
}

// 暴露给主进程的方法
window.callAPI = {
  // 处理信令消息
  handleSignal: (data) => handleSignalingMessage(data),
  
  // 获取通话状态
  getState: () => callState,
  
  // 挂断
  hangup: () => hangup()
};
