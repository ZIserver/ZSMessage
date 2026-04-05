import 'dart:async';
import 'dart:convert';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_background_service/flutter_background_service.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_callkit_incoming/flutter_callkit_incoming.dart';
import 'package:flutter_callkit_incoming/entities/entities.dart';
import '../utils/storage_util.dart';
import 'websocket_service.dart';

/// 通知服务
class NotificationService {
  static NotificationService? _instance;
  static NotificationService get instance => _instance ??= NotificationService._();
  
  NotificationService._();
  
  final FlutterLocalNotificationsPlugin _notifications = FlutterLocalNotificationsPlugin();
  
  // 通知渠道
  static const String _messageChannelId = 'message_channel';
  static const String _messageChannelName = '消息通知';
  static const String _callChannelId = 'call_channel';
  static const String _callChannelName = '来电通知';
  
  // 通知ID计数器
  int _notificationId = 0;
  
  // 来电回调
  void Function(Map<String, dynamic> callData)? onAcceptCall;
  void Function(Map<String, dynamic> callData)? onDeclineCall;
  
  /// 初始化通知服务
  Future<void> initialize() async {
    // Android 初始化设置
    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    
    // iOS 初始化设置
    const iosSettings = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );
    
    const initSettings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );
    
    await _notifications.initialize(
      initSettings,
      onDidReceiveNotificationResponse: _onNotificationTapped,
    );
    
    // 创建 Android 通知渠道
    try {
      await _createNotificationChannels();
    } catch (e) {
      debugPrint('[Notification] 创建通知渠道失败: $e');
    }
    
    // 设置来电监听
    try {
      _setupCallKitListeners();
    } catch (e) {
      debugPrint('[Notification] 设置 CallKit 监听失败: $e');
    }
    
    debugPrint('[Notification] 通知服务初始化完成');
  }
  
  /// 创建通知渠道
  Future<void> _createNotificationChannels() async {
    final androidPlugin = _notifications.resolvePlatformSpecificImplementation<
        AndroidFlutterLocalNotificationsPlugin>();
    
    if (androidPlugin != null) {
      // 消息通知渠道
      await androidPlugin.createNotificationChannel(
        const AndroidNotificationChannel(
          _messageChannelId,
          _messageChannelName,
          description: '接收聊天消息通知',
          importance: Importance.high,
          playSound: true,
          enableVibration: true,
        ),
      );
      
      // 来电通知渠道
      await androidPlugin.createNotificationChannel(
        const AndroidNotificationChannel(
          _callChannelId,
          _callChannelName,
          description: '接收来电通知',
          importance: Importance.max,
          playSound: true,
          enableVibration: true,
        ),
      );
    }
  }
  
  /// 请求通知权限
  Future<bool> requestPermission() async {
    final androidPlugin = _notifications.resolvePlatformSpecificImplementation<
        AndroidFlutterLocalNotificationsPlugin>();
    
    if (androidPlugin != null) {
      final granted = await androidPlugin.requestNotificationsPermission();
      return granted ?? false;
    }
    return true;
  }
  
  /// 显示消息通知
  Future<void> showMessageNotification({
    required String title,
    required String body,
    String? payload,
  }) async {
    final androidDetails = AndroidNotificationDetails(
      _messageChannelId,
      _messageChannelName,
      importance: Importance.high,
      priority: Priority.high,
      showWhen: true,
      icon: '@mipmap/ic_launcher',
      enableVibration: true,
      playSound: true,
    );
    
    final iosDetails = const DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );
    
    final details = NotificationDetails(
      android: androidDetails,
      iOS: iosDetails,
    );
    
    await _notifications.show(
      _notificationId++,
      title,
      body,
      details,
      payload: payload,
    );
    
    // 使用系统震动
    HapticFeedback.mediumImpact();
  }
  
  /// 显示来电通知（使用 CallKit）
  Future<void> showIncomingCall({
    required String callId,
    required String callerName,
    required String callerAvatar,
    required bool isVideo,
    Map<String, dynamic>? extra,
  }) async {
    final params = CallKitParams(
      id: callId,
      nameCaller: callerName,
      appName: '智穗语聊',
      avatar: callerAvatar,
      handle: callerName,
      type: isVideo ? 1 : 0, // 0: audio, 1: video
      textAccept: '接听',
      textDecline: '拒绝',
      duration: 60000, // 60秒超时
      extra: extra ?? {},
      android: const AndroidParams(
        isCustomNotification: true,
        isShowLogo: false,
        ringtonePath: 'system_ringtone_default',
        backgroundColor: '#0955fa',
        backgroundUrl: '',
        actionColor: '#4CAF50',
        incomingCallNotificationChannelName: '来电通知',
        missedCallNotificationChannelName: '未接来电',
      ),
      ios: const IOSParams(
        iconName: 'CallKitLogo',
        handleType: 'generic',
        supportsVideo: true,
        maximumCallGroups: 1,
        maximumCallsPerCallGroup: 1,
        audioSessionMode: 'default',
        audioSessionActive: true,
        audioSessionPreferredSampleRate: 44100.0,
        audioSessionPreferredIOBufferDuration: 0.005,
        supportsDTMF: true,
        supportsHolding: true,
        supportsGrouping: false,
        supportsUngrouping: false,
        ringtonePath: 'system_ringtone_default',
      ),
    );
    
    await FlutterCallkitIncoming.showCallkitIncoming(params);
    
    debugPrint('[Notification] 显示来电通知: $callerName');
  }
  
  /// 结束来电通知
  Future<void> endCall(String callId) async {
    await FlutterCallkitIncoming.endCall(callId);
  }
  
  /// 结束所有来电
  Future<void> endAllCalls() async {
    await FlutterCallkitIncoming.endAllCalls();
  }
  
  /// 设置 CallKit 监听器
  void _setupCallKitListeners() {
    FlutterCallkitIncoming.onEvent.listen((CallEvent? event) {
      if (event == null) return;
      
      debugPrint('[CallKit] 事件: ${event.event}, body: ${event.body}');
      
      switch (event.event) {
        case Event.actionCallAccept:
          // 接听来电
          final data = event.body as Map<String, dynamic>?;
          if (data != null) {
            onAcceptCall?.call(data);
          }
          break;
          
        case Event.actionCallDecline:
          // 拒绝来电
          final data = event.body as Map<String, dynamic>?;
          if (data != null) {
            onDeclineCall?.call(data);
          }
          break;
          
        case Event.actionCallTimeout:
          // 来电超时
          debugPrint('[CallKit] 来电超时');
          break;
          
        case Event.actionCallEnded:
          // 通话结束
          debugPrint('[CallKit] 通话结束');
          break;
          
        default:
          break;
      }
    });
  }
  
  /// 通知点击回调
  void _onNotificationTapped(NotificationResponse response) {
    debugPrint('[Notification] 通知被点击: ${response.payload}');
    // TODO: 根据 payload 跳转到对应页面
  }
  
  /// 取消所有通知
  Future<void> cancelAll() async {
    await _notifications.cancelAll();
    await FlutterCallkitIncoming.endAllCalls();
  }
}
