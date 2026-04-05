import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:dio/dio.dart';
import 'websocket_service.dart';
import '../utils/storage_util.dart';
import '../../app.dart';
import '../../features/call/incoming_call_page.dart';

/// 通话类型
enum CallType { audio, video }

/// 通话状态
enum CallState { 
  idle,       // 空闲
  calling,    // 正在呼叫
  incoming,   // 来电
  connecting, // 连接中
  connected,  // 已连接
  ended,      // 已结束
}

/// 当前通话信息
class CallInfo {
  final int callerId;
  final int targetUserId;
  final String callerName;
  final CallType callType;
  final bool isInitiator;
  CallState state;
  DateTime? startTime;
  
  CallInfo({
    required this.callerId,
    required this.targetUserId,
    required this.callerName,
    required this.callType,
    required this.isInitiator,
    this.state = CallState.idle,
    this.startTime,
  });
}

/// WebRTC 音视频通话服务
class WebRTCService {
  static WebRTCService? _instance;
  static WebRTCService get instance => _instance ??= WebRTCService._();
  
  WebRTCService._();
  
  // WebRTC 相关
  RTCPeerConnection? _peerConnection;
  MediaStream? _localStream;
  MediaStream? _remoteStream;
  final List<RTCIceCandidate> _iceCandidatesQueue = [];
  
  // 当前通话
  CallInfo? currentCall;
  
  // ICE 服务器配置
  Map<String, dynamic> _iceServers = {
    'iceServers': [
      {'urls': 'stun:stun.l.google.com:19302'},
      {'urls': 'stun:stun1.l.google.com:19302'},
      {'urls': 'stun:stun2.l.google.com:19302'},
    ]
  };
  
  // 回调函数
  void Function(MediaStream stream)? onLocalStream;
  void Function(MediaStream stream)? onRemoteStream;
  void Function(CallState state)? onCallStateChange;
  void Function(String error)? onError;
  void Function(CallInfo call)? onIncomingCall;
  void Function()? onRemoteHangup;  // 对方挂断回调
  
  /// 通话信令回调（用于后台服务转发）
  void Function(Map<String, dynamic> signal)? onCallSignal;
  
  // API
  static const String _apiBase = 'https://api.zhsidc.com/api';
  final _dio = Dio();
  
  /// 初始化服务
  Future<void> initialize() async {
    await _fetchIceServers();
    _setupWebSocketListener();
  }
  
  /// 从后端获取 ICE 服务器配置
  Future<void> _fetchIceServers() async {
    try {
      final response = await _dio.get('$_apiBase/webrtc/ice-servers');
      if (response.statusCode == 200) {
        _iceServers = response.data;
        debugPrint('[WebRTC] ICE servers loaded');
      }
    } catch (e) {
      debugPrint('[WebRTC] Failed to fetch ICE servers, using defaults');
    }
  }
  
  /// 设置 WebSocket 监听
  void _setupWebSocketListener() {
    // 监听通话信令
    WebSocketService.instance.onCallSignal = (signal) {
      _handleCallSignal(signal);
    };
  }
  
  /// 处理通话信令
  void handleCallSignal(Map<String, dynamic> data) {
    _handleCallSignal(data);
  }
  
  /// 内部处理通话信令
  void _handleCallSignal(Map<String, dynamic> data) {
    final type = data['type'] as String?;
    debugPrint('[WebRTC] Received signal: $type');
    
    switch (type) {
      case 'invite':
        _handleIncomingCall(data);
        break;
      case 'answer':
        _handleAnswer(data);
        break;
      case 'offer':
        _handleOffer(data);
        break;
      case 'sdp-answer':
        _handleSdpAnswer(data);
        break;
      case 'ice-candidate':
        _handleIceCandidate(data);
        break;
      case 'hangup':
        _handleHangup();
        break;
    }
  }
  
  /// 发起通话
  Future<bool> initiateCall({
    required int callerId,
    required int targetUserId,
    required String targetName,
    CallType callType = CallType.video,
  }) async {
    try {
      debugPrint('[WebRTC] Initiating call: $callerId -> $targetUserId');
      
      // 清理之前的资源
      await cleanup();
      
      currentCall = CallInfo(
        callerId: callerId,
        targetUserId: targetUserId,
        callerName: targetName,
        callType: callType,
        isInitiator: true,
        state: CallState.calling,
      );
      
      // 获取本地媒体流
      await _getLocalMedia(callType);
      
      // 创建 PeerConnection
      await _createPeerConnection();
      
      // 发送通话邀请
      _sendSignal({
        'type': 'invite',
        'callerId': callerId,
        'targetUserId': targetUserId,
        'callType': callType == CallType.video ? 'video' : 'voice',
      });
      
      _notifyStateChange(CallState.calling);
      return true;
    } catch (e) {
      debugPrint('[WebRTC] Failed to initiate call: $e');
      onError?.call('发起通话失败: $e');
      await cleanup();
      return false;
    }
  }
  
  /// 接听通话
  Future<bool> acceptCall() async {
    if (currentCall == null) return false;
    
    try {
      debugPrint('[WebRTC] Accepting call');
      
      // 获取本地媒体流
      await _getLocalMedia(currentCall!.callType);
      
      // 创建 PeerConnection
      await _createPeerConnection();
      
      // 发送接听应答
      _sendSignal({
        'type': 'answer',
        'callerId': currentCall!.targetUserId,
        'targetUserId': currentCall!.callerId,
        'accepted': true,
      });
      
      _notifyStateChange(CallState.connecting);
      return true;
    } catch (e) {
      debugPrint('[WebRTC] Failed to accept call: $e');
      onError?.call('接听失败: $e');
      return false;
    }
  }
  
  /// 拒绝通话
  void rejectCall() {
    debugPrint('[WebRTC] Rejecting call, currentCall: $currentCall');
    
    if (currentCall == null) {
      debugPrint('[WebRTC] No current call to reject');
      return;
    }
    
    // 保存信息用于发送信令
    final targetUserId = currentCall!.targetUserId;
    final callerId = currentCall!.callerId;
    final isVideo = currentCall!.callType == CallType.video;
    
    // 发送通话记录消息（被拒绝）
    _sendCallRecordMessage(
      targetUserId: targetUserId,
      status: 'rejected',
      duration: 0,
      isVideo: isVideo,
    );
    
    // 发送拒绝信令
    _sendSignal({
      'type': 'hangup',  // 改为 hangup，更通用
      'callerId': callerId,
      'targetUserId': targetUserId,
    });
    
    debugPrint('[WebRTC] Reject signal sent: callerId=$callerId, targetUserId=$targetUserId');
    
    cleanup();
  }
  
  /// 挂断通话
  void hangup() {
    debugPrint('[WebRTC] Hanging up, currentCall: $currentCall');
    
    if (currentCall == null) {
      debugPrint('[WebRTC] No current call to hangup');
      return;
    }
    
    // 保存信息用于发送信令
    final callerId = currentCall!.callerId;
    final targetUserId = currentCall!.targetUserId;
    final isVideo = currentCall!.callType == CallType.video;
    final wasConnected = currentCall!.state == CallState.connected;
    final wasCalling = currentCall!.state == CallState.calling;
    
    // 计算通话时长
    int duration = 0;
    if (wasConnected && currentCall!.startTime != null) {
      duration = DateTime.now().difference(currentCall!.startTime!).inSeconds;
    }
    
    // 确定通话状态
    String status;
    if (wasConnected) {
      status = 'connected';  // 已接通的通话
    } else if (wasCalling) {
      status = 'cancelled';  // 主动取消
    } else {
      status = 'cancelled';
    }
    
    // 发送通话记录消息
    _sendCallRecordMessage(
      targetUserId: targetUserId,
      status: status,
      duration: duration,
      isVideo: isVideo,
    );
    
    // 发送挂断信令
    _sendSignal({
      'type': 'hangup',
      'callerId': callerId,
      'targetUserId': targetUserId,
    });
    
    debugPrint('[WebRTC] Hangup signal sent: callerId=$callerId, targetUserId=$targetUserId');
    
    _notifyStateChange(CallState.ended);
    cleanup();
  }
  
  /// 获取本地媒体流
  Future<void> _getLocalMedia(CallType callType) async {
    final constraints = {
      'audio': {
        'echoCancellation': true,
        'noiseSuppression': true,
        'autoGainControl': true,
      },
      'video': callType == CallType.video ? {
        'width': {'ideal': 1280},
        'height': {'ideal': 720},
        'frameRate': {'ideal': 30},
        'facingMode': 'user',
      } : false,
    };
    
    debugPrint('[WebRTC] Getting local media...');
    _localStream = await navigator.mediaDevices.getUserMedia(constraints);
    
    if (onLocalStream != null) {
      onLocalStream!(_localStream!);
    }
  }
  
  /// 创建 PeerConnection
  Future<void> _createPeerConnection() async {
    debugPrint('[WebRTC] Creating PeerConnection');
    
    _peerConnection = await createPeerConnection(_iceServers);
    
    // 添加本地流
    if (_localStream != null) {
      for (var track in _localStream!.getTracks()) {
        await _peerConnection!.addTrack(track, _localStream!);
      }
    }
    
    // ICE candidate 回调
    _peerConnection!.onIceCandidate = (candidate) {
      if (currentCall != null) {
        _sendSignal({
          'type': 'ice-candidate',
          'callerId': currentCall!.callerId,
          'targetUserId': currentCall!.targetUserId,
          'candidate': {
            'candidate': candidate.candidate,
            'sdpMid': candidate.sdpMid,
            'sdpMLineIndex': candidate.sdpMLineIndex,
          },
        });
      }
    };
    
    // 连接状态回调
    _peerConnection!.onConnectionState = (state) {
      debugPrint('[WebRTC] Connection state: $state');
      switch (state) {
        case RTCPeerConnectionState.RTCPeerConnectionStateConnected:
          currentCall?.startTime = DateTime.now();
          _notifyStateChange(CallState.connected);
          break;
        case RTCPeerConnectionState.RTCPeerConnectionStateDisconnected:
        case RTCPeerConnectionState.RTCPeerConnectionStateFailed:
          _notifyStateChange(CallState.ended);
          cleanup();
          break;
        default:
          break;
      }
    };
    
    // 远程流回调
    _peerConnection!.onTrack = (event) {
      debugPrint('[WebRTC] Received remote track: ${event.track.kind}');
      if (event.streams.isNotEmpty) {
        _remoteStream = event.streams[0];
        if (onRemoteStream != null) {
          onRemoteStream!(_remoteStream!);
        }
      }
    };
    
    // 处理队列中的 ICE candidates
    await _processIceCandidatesQueue();
  }
  
  /// 创建并发送 Offer
  Future<void> _createAndSendOffer() async {
    if (_peerConnection == null || currentCall == null) return;
    
    debugPrint('[WebRTC] Creating offer');
    
    final offer = await _peerConnection!.createOffer({
      'offerToReceiveAudio': true,
      'offerToReceiveVideo': currentCall!.callType == CallType.video,
    });
    
    await _peerConnection!.setLocalDescription(offer);
    
    _sendSignal({
      'type': 'offer',
      'callerId': currentCall!.callerId,
      'targetUserId': currentCall!.targetUserId,
      'sdp': {
        'type': offer.type,
        'sdp': offer.sdp,
      },
    });
  }
  
  /// 处理来电
  void _handleIncomingCall(Map<String, dynamic> data) {
    // 如果当前有通话进行中，忽略新来电
    if (currentCall != null && currentCall!.state != CallState.idle && currentCall!.state != CallState.ended) {
      debugPrint('[WebRTC] Busy, ignoring incoming call');
      return;
    }
    
    final callerId = data['callerId'] as int;
    final targetUserId = data['targetUserId'] as int;
    final callTypeStr = data['callType'] as String? ?? 'video';
    final callerName = data['callerName'] as String? ?? '用户';
    
    currentCall = CallInfo(
      callerId: targetUserId, // 当前用户是接收方
      targetUserId: callerId, // 发起方是目标
      callerName: callerName,
      callType: callTypeStr == 'video' ? CallType.video : CallType.audio,
      isInitiator: false,
      state: CallState.incoming,
    );
    
    _notifyStateChange(CallState.incoming);
    
    // 尝试调用回调
    if (onIncomingCall != null) {
      try {
        onIncomingCall!(currentCall!);
        return;
      } catch (e) {
        debugPrint('[WebRTC] onIncomingCall callback error: $e');
      }
    }
    
    // 如果没有回调或回调失败，使用全局导航器
    _showIncomingCallWithGlobalNavigator(currentCall!);
  }
  
  /// 使用全局导航器显示来电界面
  void _showIncomingCallWithGlobalNavigator(CallInfo call) {
    final navigator = navigatorKey.currentState;
    if (navigator != null) {
      navigator.push(
        MaterialPageRoute(
          builder: (context) => IncomingCallPage(callInfo: call),
        ),
      );
    } else {
      debugPrint('[WebRTC] No navigator available to show incoming call');
    }
  }
  
  /// 处理接听应答
  void _handleAnswer(Map<String, dynamic> data) {
    final accepted = data['accepted'] as bool? ?? false;
    
    if (accepted) {
      debugPrint('[WebRTC] Call accepted, creating offer');
      _createAndSendOffer();
    } else {
      debugPrint('[WebRTC] Call rejected');
      // 对方拒绝采用静默响应，不调用 onError 回调（禁止Toast通知）
      // 触发挂断回调来关闭页面
      try {
        onRemoteHangup?.call();
      } catch (e) {
        debugPrint('[WebRTC] onRemoteHangup callback error: $e');
      }
      _notifyStateChange(CallState.ended);
      cleanup();
    }
  }
  
  /// 处理 Offer
  Future<void> _handleOffer(Map<String, dynamic> data) async {
    if (_peerConnection == null) return;
    
    debugPrint('[WebRTC] Handling offer');
    
    final sdpData = data['sdp'] as Map<String, dynamic>;
    final description = RTCSessionDescription(sdpData['sdp'], sdpData['type']);
    
    await _peerConnection!.setRemoteDescription(description);
    
    // 创建 Answer
    final answer = await _peerConnection!.createAnswer();
    await _peerConnection!.setLocalDescription(answer);
    
    _sendSignal({
      'type': 'sdp-answer',
      'callerId': currentCall!.callerId,
      'targetUserId': currentCall!.targetUserId,
      'sdp': {
        'type': answer.type,
        'sdp': answer.sdp,
      },
    });
    
    // 处理队列中的 ICE candidates
    await _processIceCandidatesQueue();
  }
  
  /// 处理 SDP Answer
  Future<void> _handleSdpAnswer(Map<String, dynamic> data) async {
    if (_peerConnection == null) return;
    
    debugPrint('[WebRTC] Handling SDP answer');
    
    final sdpData = data['sdp'] as Map<String, dynamic>;
    final description = RTCSessionDescription(sdpData['sdp'], sdpData['type']);
    
    await _peerConnection!.setRemoteDescription(description);
    await _processIceCandidatesQueue();
  }
  
  /// 处理 ICE Candidate
  Future<void> _handleIceCandidate(Map<String, dynamic> data) async {
    final candidateData = data['candidate'] as Map<String, dynamic>;
    final candidate = RTCIceCandidate(
      candidateData['candidate'],
      candidateData['sdpMid'],
      candidateData['sdpMLineIndex'],
    );
    
    if (_peerConnection != null && _peerConnection!.getRemoteDescription() != null) {
      await _peerConnection!.addCandidate(candidate);
    } else {
      _iceCandidatesQueue.add(candidate);
    }
  }
  
  /// 处理挂断
  void _handleHangup() {
    debugPrint('[WebRTC] Remote hangup, currentCall state: ${currentCall?.state}');
    
    // 安全调用挂断回调（用于关闭来电/呼叫界面）
    try {
      onRemoteHangup?.call();
    } catch (e) {
      debugPrint('[WebRTC] onRemoteHangup callback error: $e');
    }
    
    // 移除强制pop逻辑，让IncomingCallPage/CallPage通过onRemoteHangup回调自行处理页面关闭
    // 这样可以确保页面按正常导航栈返回，而不是被强制关闭
    
    // 对方挂断采用静默响应，不调用 onError 回调（禁止Toast通知）
    
    // 通知状态变化
    try {
      _notifyStateChange(CallState.ended);
    } catch (e) {
      debugPrint('[WebRTC] onCallStateChange callback error: $e');
    }
    
    cleanup();
  }
  
  /// 处理队列中的 ICE candidates
  Future<void> _processIceCandidatesQueue() async {
    if (_peerConnection == null) return;
    
    while (_iceCandidatesQueue.isNotEmpty) {
      final candidate = _iceCandidatesQueue.removeAt(0);
      try {
        await _peerConnection!.addCandidate(candidate);
      } catch (e) {
        debugPrint('[WebRTC] Failed to add queued candidate: $e');
      }
    }
  }
  
  /// 发送信令
  void _sendSignal(Map<String, dynamic> data) {
    final signalType = data['type'] as String;
    // 通过 WebSocket 发送通话信令
    WebSocketService.instance.sendCallSignal(signalType, data);
  }
  
  /// 发送通话记录消息
  Future<void> _sendCallRecordMessage({
    required int targetUserId,
    required String status,
    required int duration,
    required bool isVideo,
  }) async {
    final callMessage = jsonEncode({
      'callType': 'call',
      'status': status,
      'duration': duration,
      'isVideo': isVideo,
    });
    
    debugPrint('[WebRTC] Sending call record message: $callMessage');
    
    // 通过 HTTP API 发送通话记录消息
    final userId = WebSocketService.instance.currentUserId;
    if (userId == null) {
      debugPrint('[WebRTC] Cannot send call record: userId is null');
      return;
    }
    
    try {
      // 获取 Token
      final token = await StorageUtil.getToken();
      
      final response = await _dio.post(
        '$_apiBase/messages/send',
        data: {
          'senderId': userId,
          'receiverId': targetUserId,
          'content': callMessage,
          'messageType': 'CALL',
          'isRead': false,
          'isRecalled': false,
          'isForwarded': false,
        },
        options: Options(
          headers: {
            if (token != null) 'Authorization': 'Bearer $token',
          },
        ),
      );
      
      if (response.statusCode == 200) {
        debugPrint('[WebRTC] Call record message sent successfully');
      } else {
        debugPrint('[WebRTC] Failed to send call record: ${response.statusCode}');
      }
    } catch (e) {
      debugPrint('[WebRTC] Error sending call record: $e');
    }
  }
  
  /// 通知状态变化
  void _notifyStateChange(CallState state) {
    currentCall?.state = state;
    try {
      onCallStateChange?.call(state);
    } catch (e) {
      debugPrint('[WebRTC] onCallStateChange callback error: $e');
    }
  }
  
  /// 切换静音
  bool toggleMute() {
    if (_localStream != null) {
      final audioTracks = _localStream!.getAudioTracks();
      if (audioTracks.isNotEmpty) {
        final track = audioTracks.first;
        track.enabled = !track.enabled;
        return !track.enabled;
      }
    }
    return false;
  }
  
  /// 切换视频
  bool toggleVideo() {
    if (_localStream != null) {
      final videoTracks = _localStream!.getVideoTracks();
      if (videoTracks.isNotEmpty) {
        final track = videoTracks.first;
        track.enabled = !track.enabled;
        return track.enabled;
      }
    }
    return true;
  }
  
  /// 切换摄像头
  Future<void> switchCamera() async {
    if (_localStream != null) {
      final videoTracks = _localStream!.getVideoTracks();
      if (videoTracks.isNotEmpty) {
        await Helper.switchCamera(videoTracks.first);
      }
    }
  }
  
  /// 切换扬声器
  Future<void> setSpeakerphone(bool enabled) async {
    if (_localStream != null) {
      final audioTracks = _localStream!.getAudioTracks();
      if (audioTracks.isNotEmpty) {
        audioTracks.first.enableSpeakerphone(enabled);
      }
    }
  }
  
  /// 清理资源
  Future<void> cleanup() async {
    debugPrint('[WebRTC] Cleaning up');
    
    // 停止本地流
    if (_localStream != null) {
      for (var track in _localStream!.getTracks()) {
        await track.stop();
      }
      await _localStream!.dispose();
      _localStream = null;
    }
    
    // 停止远程流
    if (_remoteStream != null) {
      await _remoteStream!.dispose();
      _remoteStream = null;
    }
    
    // 关闭 PeerConnection
    if (_peerConnection != null) {
      await _peerConnection!.close();
      _peerConnection = null;
    }
    
    _iceCandidatesQueue.clear();
    currentCall = null;
  }
  
  /// 是否正在通话中
  bool get isInCall => currentCall != null && currentCall!.state != CallState.idle;
  
  /// 获取本地流
  MediaStream? get localStream => _localStream;
  
  /// 获取远程流
  MediaStream? get remoteStream => _remoteStream;
}
