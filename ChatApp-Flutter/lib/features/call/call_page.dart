import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import '../../core/services/webrtc_service.dart';

/// 通话页面
class CallPage extends StatefulWidget {
  final int callerId;
  final int targetUserId;
  final String targetName;
  final CallType callType;
  final bool isIncoming;  // 是否是来电（未接听）
  final bool isAccepted;  // 是否已接听（从 IncomingCallPage 跳转）
  
  const CallPage({
    super.key,
    required this.callerId,
    required this.targetUserId,
    required this.targetName,
    required this.callType,
    this.isIncoming = false,
    this.isAccepted = false,
  });

  @override
  State<CallPage> createState() => _CallPageState();
}

class _CallPageState extends State<CallPage> {
  final RTCVideoRenderer _localRenderer = RTCVideoRenderer();
  final RTCVideoRenderer _remoteRenderer = RTCVideoRenderer();
  
  CallState _callState = CallState.idle;
  bool _isMuted = false;
  bool _isVideoOff = false;
  bool _isSpeakerOn = true;
  bool _isFrontCamera = true;
  
  Timer? _durationTimer;
  int _callDuration = 0;
  
  @override
  void initState() {
    super.initState();
    _initRenderers();
    _setupCallbacks();
    
    if (widget.isIncoming) {
      // 来电未接听，显示来电界面
      setState(() => _callState = CallState.incoming);
    } else if (widget.isAccepted) {
      // 已接听，等待连接
      setState(() => _callState = CallState.connecting);
    } else {
      // 主动发起通话
      _startCall();
    }
  }
  
  Future<void> _initRenderers() async {
    await _localRenderer.initialize();
    await _remoteRenderer.initialize();
  }
  
  void _setupCallbacks() {
    WebRTCService.instance.onLocalStream = (stream) {
      if (mounted) {
        setState(() {
          _localRenderer.srcObject = stream;
        });
      }
    };
    
    WebRTCService.instance.onRemoteStream = (stream) {
      if (mounted) {
        setState(() {
          _remoteRenderer.srcObject = stream;
        });
      }
    };
    
    WebRTCService.instance.onCallStateChange = (state) {
      if (mounted) {
        setState(() {
          _callState = state;
          if (state == CallState.connected) {
            _startDurationTimer();
          } else if (state == CallState.ended) {
            _stopDurationTimer();
            Future.delayed(const Duration(seconds: 1), () {
              if (mounted) Navigator.of(context).pop();
            });
          }
        });
      }
    };
    
    WebRTCService.instance.onError = (error) {
      // 只显示非挂断类的错误
      if (mounted && !error.contains('挂断')) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(error), backgroundColor: Colors.red),
        );
      }
    };
    
    // 监听对方挂断/拒绝（静默关闭页面，禁止Toast通知）
    WebRTCService.instance.onRemoteHangup = () {
      debugPrint('[CallPage] Remote hangup received');
      if (mounted) {
        // 立即关闭页面，不显示任何通知
        Navigator.of(context).pop();
      }
    };
  }
  
  Future<void> _startCall() async {
    setState(() => _callState = CallState.calling);
    
    await WebRTCService.instance.initiateCall(
      callerId: widget.callerId,
      targetUserId: widget.targetUserId,
      targetName: widget.targetName,
      callType: widget.callType,
    );
  }
  
  Future<void> _acceptCall() async {
    setState(() => _callState = CallState.connecting);
    await WebRTCService.instance.acceptCall();
  }
  
  void _rejectCall() {
    WebRTCService.instance.rejectCall();
    Navigator.of(context).pop();
  }
  
  void _hangup() {
    WebRTCService.instance.hangup();
    Navigator.of(context).pop();
  }
  
  void _toggleMute() {
    final isMuted = WebRTCService.instance.toggleMute();
    setState(() => _isMuted = isMuted);
  }
  
  void _toggleVideo() {
    final isVideoOn = WebRTCService.instance.toggleVideo();
    setState(() => _isVideoOff = !isVideoOn);
  }
  
  Future<void> _switchCamera() async {
    await WebRTCService.instance.switchCamera();
    setState(() => _isFrontCamera = !_isFrontCamera);
  }
  
  Future<void> _toggleSpeaker() async {
    setState(() => _isSpeakerOn = !_isSpeakerOn);
    await WebRTCService.instance.setSpeakerphone(_isSpeakerOn);
  }
  
  void _startDurationTimer() {
    _durationTimer?.cancel();
    _durationTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      setState(() => _callDuration++);
    });
  }
  
  void _stopDurationTimer() {
    _durationTimer?.cancel();
    _durationTimer = null;
  }
  
  String _formatDuration(int seconds) {
    final mins = seconds ~/ 60;
    final secs = seconds % 60;
    return '${mins.toString().padLeft(2, '0')}:${secs.toString().padLeft(2, '0')}';
  }
  
  String _getStatusText() {
    switch (_callState) {
      case CallState.calling:
        return '正在呼叫...';
      case CallState.incoming:
        return widget.callType == CallType.video ? '视频来电' : '语音来电';
      case CallState.connecting:
        return '连接中...';
      case CallState.connected:
        return '通话中';
      case CallState.ended:
        return '通话已结束';
      default:
        return '';
    }
  }
  
  @override
  void dispose() {
    // 清除回调
    WebRTCService.instance.onLocalStream = null;
    WebRTCService.instance.onRemoteStream = null;
    WebRTCService.instance.onCallStateChange = null;
    WebRTCService.instance.onError = null;
    WebRTCService.instance.onRemoteHangup = null;
    _stopDurationTimer();
    _localRenderer.dispose();
    _remoteRenderer.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF1a1a2e),
      body: Stack(
        children: [
          // 背景/视频
          if (widget.callType == CallType.video)
            _buildVideoView()
          else
            _buildAudioView(),
          
          // 状态栏
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: Colors.black.withOpacity(0.5),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 8,
                          height: 8,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: _callState == CallState.connected 
                                ? Colors.green 
                                : _callState == CallState.ended 
                                    ? Colors.red 
                                    : Colors.orange,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          _getStatusText(),
                          style: const TextStyle(color: Colors.white),
                        ),
                      ],
                    ),
                  ),
                  const Spacer(),
                  if (_callState == CallState.connected)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: Colors.black.withOpacity(0.5),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        _formatDuration(_callDuration),
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
          
          // 来电界面
          if (_callState == CallState.incoming)
            _buildIncomingCallOverlay(),
          
          // 控制栏
          if (_callState != CallState.incoming)
            _buildControlsBar(),
        ],
      ),
    );
  }
  
  Widget _buildVideoView() {
    return Stack(
      children: [
        // 远程视频（全屏）
        Positioned.fill(
          child: _remoteRenderer.srcObject != null
              ? RTCVideoView(
                  _remoteRenderer,
                  objectFit: RTCVideoViewObjectFit.RTCVideoViewObjectFitCover,
                )
              : Container(
                  color: const Color(0xFF1a1a2e),
                  child: Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        _buildAvatar(80),
                        const SizedBox(height: 16),
                        Text(
                          widget.targetName,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 24,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
        ),
        
        // 本地视频（小窗口）
        if (!_isVideoOff && _localRenderer.srcObject != null)
          Positioned(
            top: 100,
            right: 16,
            child: GestureDetector(
              onTap: _switchCamera,
              child: Container(
                width: 120,
                height: 160,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.3),
                      blurRadius: 10,
                    ),
                  ],
                ),
                clipBehavior: Clip.antiAlias,
                child: RTCVideoView(
                  _localRenderer,
                  mirror: _isFrontCamera,
                  objectFit: RTCVideoViewObjectFit.RTCVideoViewObjectFitCover,
                ),
              ),
            ),
          ),
      ],
    );
  }
  
  Widget _buildAudioView() {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFF1a1a2e), Color(0xFF16213e), Color(0xFF0f3460)],
        ),
      ),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _buildAvatar(120),
            const SizedBox(height: 24),
            Text(
              widget.targetName,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 28,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              _getStatusText(),
              style: TextStyle(
                color: Colors.white.withOpacity(0.7),
                fontSize: 16,
              ),
            ),
            if (_callState == CallState.connected) ...[
              const SizedBox(height: 8),
              Text(
                _formatDuration(_callDuration),
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
  
  Widget _buildAvatar(double size) {
    return Container(
      width: size,
      height: size,
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(
          colors: [Color(0xFF667eea), Color(0xFF764ba2)],
        ),
      ),
      child: Center(
        child: Text(
          widget.targetName.isNotEmpty ? widget.targetName[0].toUpperCase() : '?',
          style: TextStyle(
            color: Colors.white,
            fontSize: size * 0.4,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
  
  Widget _buildIncomingCallOverlay() {
    return Container(
      color: const Color(0xFF1a1a2e).withOpacity(0.95),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              widget.callType == CallType.video ? '视频来电' : '语音来电',
              style: TextStyle(
                color: Colors.white.withOpacity(0.7),
                fontSize: 18,
              ),
            ),
            const SizedBox(height: 30),
            _buildAvatar(120),
            const SizedBox(height: 20),
            Text(
              widget.targetName,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 28,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 60),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // 拒绝按钮
                _buildCircleButton(
                  icon: Icons.call_end,
                  color: Colors.red,
                  size: 70,
                  onTap: _rejectCall,
                ),
                const SizedBox(width: 60),
                // 接听按钮
                _buildCircleButton(
                  icon: Icons.call,
                  color: Colors.green,
                  size: 70,
                  onTap: _acceptCall,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
  
  Widget _buildControlsBar() {
    return Positioned(
      bottom: 0,
      left: 0,
      right: 0,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 30, horizontal: 20),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.bottomCenter,
            end: Alignment.topCenter,
            colors: [
              Colors.black.withOpacity(0.8),
              Colors.transparent,
            ],
          ),
        ),
        child: SafeArea(
          top: false,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              // 静音
              _buildControlButton(
                icon: _isMuted ? Icons.mic_off : Icons.mic,
                isActive: _isMuted,
                onTap: _toggleMute,
              ),
              
              // 视频（仅视频通话）
              if (widget.callType == CallType.video)
                _buildControlButton(
                  icon: _isVideoOff ? Icons.videocam_off : Icons.videocam,
                  isActive: _isVideoOff,
                  onTap: _toggleVideo,
                ),
              
              // 挂断
              _buildCircleButton(
                icon: Icons.call_end,
                color: Colors.red,
                size: 64,
                onTap: _hangup,
              ),
              
              // 扬声器
              _buildControlButton(
                icon: _isSpeakerOn ? Icons.volume_up : Icons.volume_off,
                isActive: !_isSpeakerOn,
                onTap: _toggleSpeaker,
              ),
              
              // 切换摄像头（仅视频通话）
              if (widget.callType == CallType.video)
                _buildControlButton(
                  icon: Icons.cameraswitch,
                  isActive: false,
                  onTap: _switchCamera,
                ),
            ],
          ),
        ),
      ),
    );
  }
  
  Widget _buildControlButton({
    required IconData icon,
    required bool isActive,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 56,
        height: 56,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: isActive ? Colors.white.withOpacity(0.9) : Colors.white.withOpacity(0.2),
        ),
        child: Icon(
          icon,
          color: isActive ? Colors.black87 : Colors.white,
          size: 24,
        ),
      ),
    );
  }
  
  Widget _buildCircleButton({
    required IconData icon,
    required Color color,
    required double size,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: color,
        ),
        child: Icon(
          icon,
          color: Colors.white,
          size: size * 0.45,
        ),
      ),
    );
  }
}
