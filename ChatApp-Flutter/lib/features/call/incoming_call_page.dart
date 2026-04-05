import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../core/services/webrtc_service.dart';
import 'call_page.dart';

/// 全屏来电界面
class IncomingCallPage extends StatefulWidget {
  final CallInfo callInfo;
  
  const IncomingCallPage({
    super.key,
    required this.callInfo,
  });

  @override
  State<IncomingCallPage> createState() => _IncomingCallPageState();
}

class _IncomingCallPageState extends State<IncomingCallPage>
    with SingleTickerProviderStateMixin {
  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;
  Timer? _timeoutTimer;
  int _ringSeconds = 0;
  Timer? _ringTimer;

  @override
  void initState() {
    super.initState();
    
    // 设置全屏沉浸模式
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
    
    // 脉冲动画
    _pulseController = AnimationController(
      duration: const Duration(milliseconds: 1500),
      vsync: this,
    )..repeat(reverse: true);
    
    _pulseAnimation = Tween<double>(begin: 1.0, end: 1.15).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );
    
    // 响铃计时
    _ringTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      setState(() {
        _ringSeconds++;
      });
    });
    
    // 60秒超时自动挂断
    _timeoutTimer = Timer(const Duration(seconds: 60), () {
      _decline();
    });
    
    // 监听对方挂断
    WebRTCService.instance.onRemoteHangup = _onRemoteHangup;
  }
  
  void _onRemoteHangup() {
    // 对方挂断，关闭来电界面
    if (mounted) {
      Navigator.of(context).pop();
    }
  }

  @override
  void dispose() {
    // 清除回调
    WebRTCService.instance.onRemoteHangup = null;
    _pulseController.dispose();
    _timeoutTimer?.cancel();
    _ringTimer?.cancel();
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    super.dispose();
  }

  void _accept() async {
    // 先接听通话
    await WebRTCService.instance.acceptCall();
    
    // 然后跳转到通话页面（已接听状态）
    if (mounted) {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder: (context) => CallPage(
            callerId: widget.callInfo.callerId,
            targetUserId: widget.callInfo.targetUserId,
            targetName: widget.callInfo.callerName,
            callType: widget.callInfo.callType,
            isAccepted: true, // 已接听，等待连接
          ),
        ),
      );
    }
  }

  void _decline() {
    WebRTCService.instance.rejectCall();
    Navigator.of(context).pop();
  }

  String _formatDuration(int seconds) {
    final mins = seconds ~/ 60;
    final secs = seconds % 60;
    return '${mins.toString().padLeft(2, '0')}:${secs.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final isVideo = widget.callInfo.callType == CallType.video;
    
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Color(0xFF1a1a2e),
              Color(0xFF16213e),
              Color(0xFF0f3460),
            ],
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              const Spacer(flex: 1),
              
              // 通话类型标签
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      isVideo ? Icons.videocam : Icons.phone,
                      color: Colors.white,
                      size: 18,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      isVideo ? '视频来电' : '语音来电',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
              
              const SizedBox(height: 40),
              
              // 头像（带脉冲动画）
              AnimatedBuilder(
                animation: _pulseAnimation,
                builder: (context, child) {
                  return Transform.scale(
                    scale: _pulseAnimation.value,
                    child: Container(
                      width: 140,
                      height: 140,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: const LinearGradient(
                          colors: [Color(0xFF667eea), Color(0xFF764ba2)],
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFF667eea).withOpacity(0.4),
                            blurRadius: 30,
                            spreadRadius: 10,
                          ),
                        ],
                      ),
                      child: Center(
                        child: Text(
                          widget.callInfo.callerName.isNotEmpty 
                              ? widget.callInfo.callerName[0].toUpperCase() 
                              : '?',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 56,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ),
                  );
                },
              ),
              
              const SizedBox(height: 32),
              
              // 来电者名称
              Text(
                widget.callInfo.callerName,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 32,
                  fontWeight: FontWeight.bold,
                ),
              ),
              
              const SizedBox(height: 12),
              
              // 响铃时长
              Text(
                '响铃中 ${_formatDuration(_ringSeconds)}',
                style: TextStyle(
                  color: Colors.white.withOpacity(0.7),
                  fontSize: 16,
                ),
              ),
              
              const Spacer(flex: 2),
              
              // 操作按钮
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 50),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    // 拒绝按钮
                    _buildActionButton(
                      icon: Icons.call_end,
                      color: Colors.red,
                      label: '拒绝',
                      onTap: _decline,
                    ),
                    
                    // 接听按钮
                    _buildActionButton(
                      icon: isVideo ? Icons.videocam : Icons.call,
                      color: Colors.green,
                      label: '接听',
                      onTap: _accept,
                    ),
                  ],
                ),
              ),
              
              const SizedBox(height: 60),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildActionButton({
    required IconData icon,
    required Color color,
    required String label,
    required VoidCallback onTap,
  }) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        GestureDetector(
          onTap: onTap,
          child: Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: color,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: color.withOpacity(0.4),
                  blurRadius: 20,
                  spreadRadius: 2,
                ),
              ],
            ),
            child: Icon(
              icon,
              color: Colors.white,
              size: 32,
            ),
          ),
        ),
        const SizedBox(height: 12),
        Text(
          label,
          style: TextStyle(
            color: Colors.white.withOpacity(0.9),
            fontSize: 14,
          ),
        ),
      ],
    );
  }
}
