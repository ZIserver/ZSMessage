import 'dart:async';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_background_service/flutter_background_service.dart';
import 'package:flutter_background_service_android/flutter_background_service_android.dart';
import '../utils/storage_util.dart';
import 'websocket_service.dart';
import 'notification_service.dart';
import 'webrtc_service.dart';

/// 后台服务 - 保持 WebSocket 连接
class BackgroundService {
  static BackgroundService? _instance;
  static BackgroundService get instance => _instance ??= BackgroundService._();
  
  BackgroundService._();
  
  final FlutterBackgroundService _service = FlutterBackgroundService();
  bool _isInitialized = false;
  
  /// 初始化后台服务
  Future<void> initialize() async {
    if (_isInitialized) return;
    
    await _service.configure(
      androidConfiguration: AndroidConfiguration(
        onStart: _onStart,
        autoStart: true,
        autoStartOnBoot: true,
        isForegroundMode: true,
        notificationChannelId: 'background_service',
        initialNotificationTitle: '智穗语聊',
        initialNotificationContent: '保持连接中...',
        foregroundServiceNotificationId: 888,
      ),
      iosConfiguration: IosConfiguration(
        autoStart: true,
        onForeground: _onStart,
        onBackground: _onIosBackground,
      ),
    );
    
    _isInitialized = true;
    debugPrint('[BackgroundService] 后台服务配置完成');
  }
  
  /// 启动后台服务
  Future<void> start() async {
    if (!_isInitialized) {
      await initialize();
    }
    
    final isRunning = await _service.isRunning();
    if (!isRunning) {
      await _service.startService();
      debugPrint('[BackgroundService] 后台服务已启动');
    }
  }
  
  /// 停止后台服务
  Future<void> stop() async {
    final isRunning = await _service.isRunning();
    if (isRunning) {
      _service.invoke('stopService');
      debugPrint('[BackgroundService] 后台服务已停止');
    }
  }
  
  /// 检查服务是否运行中
  Future<bool> isRunning() async {
    return await _service.isRunning();
  }
  
  /// 发送数据到后台服务
  void invoke(String method, [Map<String, dynamic>? args]) {
    _service.invoke(method, args);
  }
  
  /// 监听后台服务数据
  Stream<Map<String, dynamic>?> on(String method) {
    return _service.on(method);
  }
}

/// 后台服务入口点（Android）
@pragma('vm:entry-point')
Future<void> _onStart(ServiceInstance service) async {
  DartPluginRegistrant.ensureInitialized();
  
  debugPrint('[BackgroundService] 后台服务启动');
  
  // Android 前台服务
  if (service is AndroidServiceInstance) {
    service.on('setAsForeground').listen((event) {
      service.setAsForegroundService();
    });
    
    service.on('setAsBackground').listen((event) {
      service.setAsBackgroundService();
    });
  }
  
  // 停止服务
  service.on('stopService').listen((event) {
    WebSocketService.instance.disconnect();
    service.stopSelf();
  });
  
  // 初始化存储
  await StorageUtil.init();
  
  // 获取用户信息
  final token = await StorageUtil.getToken();
  final userId = StorageUtil.getUserId();
  
  if (token == null || userId == null) {
    debugPrint('[BackgroundService] 用户未登录，停止服务');
    service.stopSelf();
    return;
  }
  
  // 设置 WebSocket 回调
  WebSocketService.instance.onMessage = (data) {
    _handleMessage(service, data);
  };
  
  WebSocketService.instance.onCallSignal = (data) {
    _handleCallSignal(service, data);
  };
  
  WebSocketService.instance.onConnectionStateChanged = (connected) {
    debugPrint('[BackgroundService] WebSocket 连接状态: $connected');
    if (service is AndroidServiceInstance) {
      service.setForegroundNotificationInfo(
        title: '智穗语聊',
        content: connected ? '已连接' : '连接中...',
      );
    }
  };
  
  // 连接 WebSocket
  await WebSocketService.instance.connect(token: token, userId: userId);
  
  // 定时检查连接状态
  Timer.periodic(const Duration(seconds: 30), (timer) async {
    if (!WebSocketService.instance.isConnected) {
      debugPrint('[BackgroundService] WebSocket 断开，尝试重连');
      final token = await StorageUtil.getToken();
      final userId = StorageUtil.getUserId();
      if (token != null && userId != null) {
        WebSocketService.instance.connect(token: token, userId: userId);
      }
    }
    
    // 更新通知
    if (service is AndroidServiceInstance) {
      service.setForegroundNotificationInfo(
        title: '智穗语聊',
        content: WebSocketService.instance.isConnected ? '已连接' : '重连中...',
      );
    }
  });
}

/// iOS 后台入口点
@pragma('vm:entry-point')
Future<bool> _onIosBackground(ServiceInstance service) async {
  debugPrint('[BackgroundService] iOS 后台任务执行');
  return true;
}

/// 处理收到的消息
void _handleMessage(ServiceInstance service, Map<String, dynamic> data) {
  final senderName = data['senderName'] as String? ?? 
                     data['senderNickname'] as String? ?? 
                     '新消息';
  final content = data['content'] as String? ?? '';
  final senderId = data['senderId'];
  
  debugPrint('[BackgroundService] 收到消息: $senderName: $content');
  
  // 发送到前台显示通知
  service.invoke('newMessage', {
    'title': senderName,
    'body': content,
    'senderId': senderId,
    'data': data,
  });
}

/// 处理通话信令
void _handleCallSignal(ServiceInstance service, Map<String, dynamic> data) {
  final type = data['type'] as String?;
  
  debugPrint('[BackgroundService] 收到通话信令: $type');
  
  if (type == 'invite') {
    // 来电
    final callerId = data['callerId'];
    final callerName = data['callerName'] as String? ?? '未知用户';
    final callType = data['callType'] as String? ?? 'audio';
    
    // 发送到前台显示来电界面
    service.invoke('incomingCall', {
      'callId': 'call_$callerId',
      'callerId': callerId,
      'callerName': callerName,
      'isVideo': callType == 'video',
      'data': data,
    });
  } else {
    // 其他信令转发到前台
    service.invoke('callSignal', data);
  }
}
