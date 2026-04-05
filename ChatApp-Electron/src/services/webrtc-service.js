/**
 * WebRTC 音视频通话服务
 */
class WebRTCService {
  constructor() {
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.currentCall = null;
    this.iceCandidatesQueue = [];
    
    // 首选设备 ID（测试成功的设备）
    this.preferredVideoDeviceId = null;
    this.preferredAudioDeviceId = null;
    
    // 默认 STUN/TURN 服务器配置（会从后端获取更新）
    this.iceServers = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
      ]
    };
    
    // 回调函数
    this.onLocalStream = null;
    this.onRemoteStream = null;
    this.onCallStateChange = null;
    this.onError = null;
    
    // WebSocket 信令处理器
    this.signalingHandler = null;
    
    // API 基础地址
    this.apiBase = '你的API地址/api';
    
    // 初始化时获取 ICE 服务器配置
    this.fetchIceServers();
  }

  /**
   * 从后端获取 ICE 服务器配置
   */
  async fetchIceServers() {
    try {
      const response = await fetch(`${this.apiBase}/webrtc/ice-servers`);
      if (response.ok) {
        const config = await response.json();
        this.iceServers = config;
        console.log('[WebRTC] ICE servers loaded:', config.iceServers?.length || 0, 'servers');
      }
    } catch (error) {
      console.warn('[WebRTC] Failed to fetch ICE servers, using defaults:', error.message);
    }
  }

  /**
   * 设置信令处理器
   */
  setSignalingHandler(handler) {
    this.signalingHandler = handler;
  }

  /**
   * 发起通话
   */
  async initiateCall(callerId, targetUserId, callType = 'video') {
    try {
      console.log('[WebRTC] Initiating call:', { callerId, targetUserId, callType });
      
      // 验证参数
      if (!callerId || !targetUserId) {
        throw new Error('缺少必要的参数: callerId 或 targetUserId');
      }
      
      // 先清理之前的资源（如果有）
      console.log('[WebRTC] Cleaning up previous resources...');
      this.cleanup();
      
      // 等待一下确保设备完全释放
      await new Promise(resolve => setTimeout(resolve, 300));
      
      this.currentCall = {
        callerId,
        targetUserId,
        callType,
        isInitiator: true,
        state: 'calling'
      };
      
      console.log('[WebRTC] Requesting media permissions...');
      
      // 获取本地媒体流
      await this.getLocalMedia(callType);
      
      console.log('[WebRTC] Media permission granted, creating peer connection...');
      
      // 创建 PeerConnection
      this.createPeerConnection();
      
      // 添加本地流到连接
      this.addLocalStreamToPeer();
      
      console.log('[WebRTC] Sending call invite...');
      
      // 发送通话邀请
      if (this.signalingHandler) {
        this.signalingHandler.sendCallInvite({
          type: 'invite',
          callerId,
          targetUserId,
          callType
        });
      } else {
        throw new Error('信令处理器未设置');
      }
      
      this.notifyStateChange('calling');
      console.log('[WebRTC] Call initiated successfully');
      return true;
    } catch (error) {
      console.error('[WebRTC] Failed to initiate call:', error);
      this.handleError(error);
      this.cleanup();
      return false;
    }
  }

  /**
   * 接受通话
   */
  async acceptCall(callerId, targetUserId, callType) {
    try {
      console.log('[WebRTC] Accepting call from:', callerId);
      
      this.currentCall = {
        callerId: targetUserId, // 当前用户作为接收方
        targetUserId: callerId, // 发起方变成目标
        callType,
        isInitiator: false,
        state: 'connecting'
      };
      
      // 获取本地媒体流
      await this.getLocalMedia(callType);
      
      // 创建 PeerConnection
      this.createPeerConnection();
      
      // 添加本地流到连接
      this.addLocalStreamToPeer();
      
      // 发送接受应答
      if (this.signalingHandler) {
        this.signalingHandler.sendCallAnswer({
          type: 'answer',
          callerId: targetUserId,
          targetUserId: callerId,
          accepted: true
        });
      }
      
      this.notifyStateChange('connecting');
      return true;
    } catch (error) {
      console.error('[WebRTC] Failed to accept call:', error);
      this.handleError(error);
      return false;
    }
  }

  /**
   * 拒绝通话
   */
  rejectCall(callerId, targetUserId) {
    console.log('[WebRTC] Rejecting call from:', callerId);
    
    // 发送通话记录消息（被拒绝）
    this.sendCallRecordMessage(targetUserId, 'rejected', 0, false);
    
    if (this.signalingHandler) {
      this.signalingHandler.sendCallAnswer({
        type: 'answer',
        callerId: targetUserId,
        targetUserId: callerId,
        accepted: false
      });
    }
    
    this.cleanup();
  }

  /**
   * 挂断通话
   */
  hangup() {
    console.log('[WebRTC] Hanging up call');
    
    if (this.currentCall && this.signalingHandler) {
      const isVideo = this.currentCall.callType === 'video';
      const wasConnected = this.currentCall.state === 'connected';
      const wasCalling = this.currentCall.state === 'calling';
      
      // 计算通话时长
      let duration = 0;
      if (wasConnected && this.currentCall.startTime) {
        duration = Math.floor((Date.now() - this.currentCall.startTime) / 1000);
      }
      
      // 确定通话状态
      let status;
      if (wasConnected) {
        status = 'connected';  // 已接通的通话
      } else if (wasCalling) {
        status = 'cancelled';  // 主动取消
      } else {
        status = 'cancelled';
      }
      
      // 发送通话记录消息
      this.sendCallRecordMessage(this.currentCall.targetUserId, status, duration, isVideo);
      
      this.signalingHandler.sendHangup({
        type: 'hangup',
        callerId: this.currentCall.callerId,
        targetUserId: this.currentCall.targetUserId
      });
    }
    
    this.notifyStateChange('ended');
    this.cleanup();
  }
  
  /**
   * 发送通话记录消息
   */
  sendCallRecordMessage(targetUserId, status, duration, isVideo) {
    const callMessage = JSON.stringify({
      callType: 'call',
      status: status,
      duration: duration,
      isVideo: isVideo
    });
    
    console.log('[WebRTC] Sending call record message:', callMessage);
    
    // 通过回调通知主进程发送消息
    if (this.onSendCallRecord) {
      this.onSendCallRecord(targetUserId, callMessage);
    }
  }

  /**
   * 获取本地媒体流
   */
  async getLocalMedia(callType) {
    // 首先尝试高质量配置
    let constraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        deviceId: this.preferredAudioDeviceId ? { ideal: this.preferredAudioDeviceId } : undefined
      },
      video: callType === 'video' ? {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 },
        // 使用测试成功的设备
        deviceId: this.preferredVideoDeviceId ? { ideal: this.preferredVideoDeviceId } : undefined
      } : false
    };
    
    console.log('[WebRTC] Using preferred devices:', {
      video: this.preferredVideoDeviceId,
      audio: this.preferredAudioDeviceId
    });
    
    try {
      console.log('[WebRTC] Requesting getUserMedia with constraints:', constraints);
      
      // 检查是否支持 getUserMedia
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('浏览器不支持 getUserMedia API');
      }
      
      // 首先尝试获取设备列表
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasVideo = devices.some(d => d.kind === 'videoinput');
      const hasAudio = devices.some(d => d.kind === 'audioinput');
      
      console.log('[WebRTC] Available devices:', {
        video: hasVideo,
        audio: hasAudio,
        total: devices.length
      });
      
      if (!hasAudio) {
        throw new Error('未检测到麦克风设备');
      }
      
      if (callType === 'video' && !hasVideo) {
        throw new Error('未检测到摄像头设备');
      }
      
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('[WebRTC] Got local media stream, tracks:', 
        this.localStream.getTracks().map(t => `${t.kind}: ${t.label}`)
      );
      
      if (this.onLocalStream) {
        this.onLocalStream(this.localStream);
      }
      
      return this.localStream;
    } catch (error) {
      console.error('[WebRTC] Failed to get local media:', error.name, error.message);
      
      // 如果是 NotReadableError，尝试降级到更低的配置
      if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        console.log('[WebRTC] Device busy, trying fallback configuration...');
        
        try {
          // 降级配置：更低的分辨率和帧率
          const fallbackConstraints = {
            audio: true, // 简化音频配置
            video: callType === 'video' ? {
              width: { ideal: 640 },
              height: { ideal: 480 },
              frameRate: { ideal: 15 }
            } : false
          };
          
          console.log('[WebRTC] Trying fallback constraints:', fallbackConstraints);
          this.localStream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
          
          console.log('[WebRTC] Fallback successful, got stream with tracks:', 
            this.localStream.getTracks().map(t => `${t.kind}: ${t.label}`)
          );
          
          if (this.onLocalStream) {
            this.onLocalStream(this.localStream);
          }
          
          return this.localStream;
        } catch (fallbackError) {
          console.error('[WebRTC] Fallback also failed:', fallbackError.name, fallbackError.message);
          error = fallbackError; // 使用降级错误
        }
      }
      
      // 更友好的错误信息
      let errorMessage = '无法访问摄像头/麦克风';
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorMessage = '权限被拒绝：请在系统设置中允许访问摄像头和麦克风';
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        errorMessage = '未找到摄像头或麦克风设备';
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        errorMessage = '设备正在被其他应用使用\n\n解决方法：\n1. 关闭其他使用摄像头的程序（如微信、QQ、浏览器等）\n2. 检查是否有多个通话窗口打开\n3. 重启应用';
      } else if (error.name === 'OverconstrainedError') {
        errorMessage = '设备不支持请求的分辨率或帧率';
      } else if (error.name === 'TypeError') {
        errorMessage = '无效的媒体约束参数';
      }
      
      throw new Error(errorMessage);
    }
  }

  /**
   * 创建 PeerConnection
   */
  createPeerConnection() {
    console.log('[WebRTC] Creating PeerConnection');
    
    this.peerConnection = new RTCPeerConnection(this.iceServers);
    
    // 处理 ICE candidate
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.signalingHandler && this.currentCall) {
        console.log('[WebRTC] Sending ICE candidate');
        // 将 RTCIceCandidate 转换为普通对象（IPC 序列化）
        this.signalingHandler.sendIceCandidate({
          type: 'ice-candidate',
          callerId: this.currentCall.callerId,
          targetUserId: this.currentCall.targetUserId,
          candidate: {
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex
          }
        });
      }
    };
    
    // 处理连接状态变化
    this.peerConnection.onconnectionstatechange = () => {
      console.log('[WebRTC] Connection state:', this.peerConnection.connectionState);
      
      switch (this.peerConnection.connectionState) {
        case 'connected':
          // 记录通话开始时间
          if (this.currentCall) {
            this.currentCall.startTime = Date.now();
            console.log('[WebRTC] Call connected, startTime:', this.currentCall.startTime);
          }
          this.notifyStateChange('connected');
          break;
        case 'disconnected':
        case 'failed':
          this.notifyStateChange('disconnected');
          this.cleanup();
          break;
        case 'closed':
          this.notifyStateChange('ended');
          break;
      }
    };
    
    // 处理 ICE 连接状态
    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE connection state:', this.peerConnection.iceConnectionState);
    };
    
    // 处理远程流
    this.peerConnection.ontrack = (event) => {
      console.log('[WebRTC] Received remote track:', event.track.kind);
      
      if (!this.remoteStream) {
        this.remoteStream = new MediaStream();
      }
      
      this.remoteStream.addTrack(event.track);
      
      if (this.onRemoteStream) {
        this.onRemoteStream(this.remoteStream);
      }
    };
    
    // 处理队列中的 ICE candidates
    this.processIceCandidatesQueue();
  }

  /**
   * 添加本地流到 PeerConnection
   */
  addLocalStreamToPeer() {
    if (this.localStream && this.peerConnection) {
      this.localStream.getTracks().forEach(track => {
        console.log('[WebRTC] Adding local track:', track.kind);
        this.peerConnection.addTrack(track, this.localStream);
      });
    }
  }

  /**
   * 创建并发送 Offer
   */
  async createAndSendOffer() {
    try {
      console.log('[WebRTC] Creating offer');
      
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: this.currentCall.callType === 'video'
      });
      
      await this.peerConnection.setLocalDescription(offer);
      
      if (this.signalingHandler && this.currentCall) {
        // 将 RTCSessionDescription 转换为普通对象（IPC 序列化）
        this.signalingHandler.sendOffer({
          type: 'offer',
          callerId: this.currentCall.callerId,
          targetUserId: this.currentCall.targetUserId,
          sdp: {
            type: offer.type,
            sdp: offer.sdp
          }
        });
      }
    } catch (error) {
      console.error('[WebRTC] Failed to create offer:', error);
      this.handleError(error);
    }
  }

  /**
   * 处理收到的 Offer
   */
  async handleOffer(data) {
    try {
      console.log('[WebRTC] Handling offer');
      
      if (!this.peerConnection) {
        console.error('[WebRTC] No peer connection when handling offer');
        return;
      }
      
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
      
      // 创建 Answer
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      
      if (this.signalingHandler && this.currentCall) {
        // 将 RTCSessionDescription 转换为普通对象（IPC 序列化）
        this.signalingHandler.sendSdpAnswer({
          type: 'sdp-answer',
          callerId: this.currentCall.callerId,
          targetUserId: this.currentCall.targetUserId,
          sdp: {
            type: answer.type,
            sdp: answer.sdp
          }
        });
      }
    } catch (error) {
      console.error('[WebRTC] Failed to handle offer:', error);
      this.handleError(error);
    }
  }

  /**
   * 处理收到的 Answer
   */
  async handleAnswer(data) {
    try {
      console.log('[WebRTC] Handling answer');
      
      if (!this.peerConnection) {
        console.error('[WebRTC] No peer connection when handling answer');
        return;
      }
      
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
    } catch (error) {
      console.error('[WebRTC] Failed to handle answer:', error);
      this.handleError(error);
    }
  }

  /**
   * 处理收到的 ICE Candidate
   */
  async handleIceCandidate(data) {
    try {
      if (this.peerConnection && this.peerConnection.remoteDescription) {
        console.log('[WebRTC] Adding ICE candidate');
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
      } else {
        // 如果还没有设置远程描述，先放入队列
        console.log('[WebRTC] Queuing ICE candidate');
        this.iceCandidatesQueue.push(data.candidate);
      }
    } catch (error) {
      console.error('[WebRTC] Failed to add ICE candidate:', error);
    }
  }

  /**
   * 处理队列中的 ICE candidates
   */
  async processIceCandidatesQueue() {
    while (this.iceCandidatesQueue.length > 0) {
      const candidate = this.iceCandidatesQueue.shift();
      try {
        if (this.peerConnection && this.peerConnection.remoteDescription) {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (error) {
        console.error('[WebRTC] Failed to process queued ICE candidate:', error);
      }
    }
  }

  /**
   * 切换静音状态
   */
  toggleMute() {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        console.log('[WebRTC] Mute:', !audioTrack.enabled);
        
        // 通知对方
        if (this.signalingHandler && this.currentCall) {
          this.signalingHandler.sendMediaState({
            type: 'media-state',
            callerId: this.currentCall.callerId,
            targetUserId: this.currentCall.targetUserId,
            audioEnabled: audioTrack.enabled
          });
        }
        
        return !audioTrack.enabled;
      }
    }
    return false;
  }

  /**
   * 切换视频状态
   */
  toggleVideo() {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        console.log('[WebRTC] Video:', videoTrack.enabled);
        
        // 通知对方
        if (this.signalingHandler && this.currentCall) {
          this.signalingHandler.sendMediaState({
            type: 'media-state',
            callerId: this.currentCall.callerId,
            targetUserId: this.currentCall.targetUserId,
            videoEnabled: videoTrack.enabled
          });
        }
        
        return videoTrack.enabled;
      }
    }
    return true;
  }

  /**
   * 切换扬声器
   */
  async setSpeaker(deviceId) {
    // 需要在 video 元素上设置 sinkId
    // 这个功能需要在 UI 层实现
    console.log('[WebRTC] Set speaker:', deviceId);
  }

  /**
   * 获取可用设备列表
   */
  async getDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return {
        audioInputs: devices.filter(d => d.kind === 'audioinput'),
        audioOutputs: devices.filter(d => d.kind === 'audiooutput'),
        videoInputs: devices.filter(d => d.kind === 'videoinput')
      };
    } catch (error) {
      console.error('[WebRTC] Failed to get devices:', error);
      return { audioInputs: [], audioOutputs: [], videoInputs: [] };
    }
  }

  /**
   * 测试设备访问
   */
  async testDeviceAccess(callType = 'video') {
    console.log('[WebRTC] Testing device access for:', callType);
    
    // 先检查设备列表
    let videoDevices = [];
    let audioDevices = [];
    
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      videoDevices = devices.filter(d => d.kind === 'videoinput');
      audioDevices = devices.filter(d => d.kind === 'audioinput');
      
      console.log('[WebRTC] Available video devices:', videoDevices.map(d => ({
        label: d.label || d.deviceId,
        deviceId: d.deviceId
      })));
      console.log('[WebRTC] Available audio devices:', audioDevices.map(d => ({
        label: d.label || d.deviceId,
        deviceId: d.deviceId
      })));
      
      if (callType === 'video' && videoDevices.length === 0) {
        return {
          success: false,
          error: 'NotFoundError',
          message: '未检测到摄像头设备'
        };
      }
      
      if (audioDevices.length === 0) {
        return {
          success: false,
          error: 'NotFoundError',
          message: '未检测到麦克风设备'
        };
      }
    } catch (error) {
      console.error('[WebRTC] Failed to enumerate devices:', error);
    }
    
    // 先测试仅音频
    console.log('[WebRTC] Testing audio-only access...');
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      console.log('[WebRTC] Audio test successful!');
      audioStream.getTracks().forEach(track => track.stop());
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      console.error('[WebRTC] Audio test failed:', error.name, error.message);
      return {
        success: false,
        error: error.name,
        message: `麦克风访问失败: ${this.getErrorMessage(error)}`
      };
    }
    
    // 如果需要视频，尝试所有摄像头
    if (callType === 'video') {
      console.log('[WebRTC] Testing video devices...');
      
      // 如果有多个摄像头，逐个尝试
      let videoSuccess = false;
      let lastError = null;
      
      for (let i = 0; i < videoDevices.length; i++) {
        const device = videoDevices[i];
        console.log(`[WebRTC] Testing video device ${i + 1}/${videoDevices.length}:`, device.label || device.deviceId);
        
        try {
          const constraints = {
            audio: false,
            video: { deviceId: device.deviceId ? { exact: device.deviceId } : undefined }
          };
          
          const videoStream = await navigator.mediaDevices.getUserMedia(constraints);
          console.log('[WebRTC] Video test successful with device:', device.label || device.deviceId);
          videoStream.getTracks().forEach(track => track.stop());
          await new Promise(resolve => setTimeout(resolve, 300));
          
          videoSuccess = true;
          // 记住可用的设备
          this.preferredVideoDeviceId = device.deviceId;
          break;
        } catch (error) {
          console.warn(`[WebRTC] Device failed (${device.label}):`, error.name, error.message);
          lastError = error;
          // 继续尝试下一个设备
        }
      }
      
      if (!videoSuccess) {
        return {
          success: false,
          error: lastError?.name || 'UnknownError',
          message: `所有摄像头均无法访问: ${this.getErrorMessage(lastError)}`,
          hint: videoDevices.some(d => d.label.toLowerCase().includes('virtual') || d.label.toLowerCase().includes('obs')) 
            ? '检测到虚拟摄像头，请尝试使用物理摄像头' 
            : null
        };
      }
    }
    
    console.log('[WebRTC] All device tests passed!');
    return { success: true };
  }
  
  /**
   * 获取友好的错误信息
   */
  getErrorMessage(error) {
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      return '权限被拒绝';
    } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      return '未找到设备';
    } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
      return '设备被占用或无法访问';
    } else if (error.name === 'OverconstrainedError') {
      return '设备不支持请求的配置';
    } else {
      return error.message || '未知错误';
    }
  }

  /**
   * 通知状态变化
   */
  notifyStateChange(state) {
    if (this.currentCall) {
      this.currentCall.state = state;
    }
    
    if (this.onCallStateChange) {
      this.onCallStateChange(state);
    }
  }

  /**
   * 处理错误
   */
  handleError(error) {
    if (this.onError) {
      this.onError(error);
    }
  }

  /**
   * 清理资源
   */
  cleanup() {
    console.log('[WebRTC] Cleaning up');
    
    // 停止本地流
    if (this.localStream) {
      console.log('[WebRTC] Stopping local stream tracks:', 
        this.localStream.getTracks().map(t => `${t.kind}: ${t.label}`)
      );
      this.localStream.getTracks().forEach(track => {
        track.stop();
        console.log('[WebRTC] Stopped track:', track.kind, track.label);
      });
      this.localStream = null;
    }
    
    // 停止远程流
    if (this.remoteStream) {
      console.log('[WebRTC] Stopping remote stream');
      this.remoteStream.getTracks().forEach(track => track.stop());
      this.remoteStream = null;
    }
    
    // 关闭 PeerConnection
    if (this.peerConnection) {
      console.log('[WebRTC] Closing peer connection');
      this.peerConnection.close();
      this.peerConnection = null;
    }
    
    // 清空队列
    this.iceCandidatesQueue = [];
    this.currentCall = null;
    
    console.log('[WebRTC] Cleanup complete');
  }

  /**
   * 获取当前通话状态
   */
  getCallState() {
    return this.currentCall ? this.currentCall.state : null;
  }

  /**
   * 是否正在通话中
   */
  isInCall() {
    return this.currentCall !== null;
  }
}

// 导出单例
const webrtcService = new WebRTCService();
module.exports = webrtcService;
