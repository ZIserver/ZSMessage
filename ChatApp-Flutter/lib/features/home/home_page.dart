import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/services/websocket_service.dart';
import '../../core/services/webrtc_service.dart';
import '../../core/services/notification_service.dart';
import '../../core/services/background_service.dart';
import '../../core/utils/storage_util.dart';
import '../../models/message.dart';
import '../call/call_page.dart';
import '../call/incoming_call_page.dart';
import '../chat/pages/chat_page.dart';
import '../chat/providers/chat_provider.dart';
import '../contacts/pages/contacts_page.dart';
import '../groups/pages/groups_page.dart';
import '../profile/pages/profile_page.dart';

/// 主页面（带底部导航栏）
class HomePage extends ConsumerStatefulWidget {
  const HomePage({super.key});

  @override
  ConsumerState<HomePage> createState() => _HomePageState();
}

class _HomePageState extends ConsumerState<HomePage> {
  int _currentIndex = 0;
  
  final List<Widget> _pages = const [
    ChatPage(),
    ContactsPage(),
    GroupsPage(),
    ProfilePage(),
  ];
  
  @override
  void initState() {
    super.initState();
    // 延迟初始化，避免闪退
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _initServices();
    });
  }
  
  Future<void> _initServices() async {
    try {
      // 初始化通知服务
      await NotificationService.instance.initialize();
      await NotificationService.instance.requestPermission();
      debugPrint('[HomePage] 通知服务初始化完成');
    } catch (e) {
      debugPrint('[HomePage] 通知服务初始化失败: $e');
    }
    
    // 暂时禁用后台服务，避免闪退
    // try {
    //   await BackgroundService.instance.initialize();
    //   await BackgroundService.instance.start();
    //   _setupBackgroundListeners();
    //   debugPrint('[HomePage] 后台服务初始化完成');
    // } catch (e) {
    //   debugPrint('[HomePage] 后台服务初始化失败: $e');
    // }
    
    // 初始化 WebSocket 和 WebRTC
    _initWebSocket();
    _initWebRTC();
  }
  
  /// 设置后台服务监听
  void _setupBackgroundListeners() {
    // 监听新消息
    BackgroundService.instance.on('newMessage').listen((data) {
      if (data != null && mounted) {
        NotificationService.instance.showMessageNotification(
          title: data['title'] ?? '新消息',
          body: data['body'] ?? '',
          payload: data['senderId']?.toString(),
        );
        // 刷新会话列表
        ref.read(chatSessionsProvider.notifier).loadSessions();
      }
    });
    
    // 监听来电
    BackgroundService.instance.on('incomingCall').listen((data) {
      if (data != null && mounted) {
        NotificationService.instance.showIncomingCall(
          callId: data['callId'] ?? '',
          callerName: data['callerName'] ?? '未知用户',
          callerAvatar: '',
          isVideo: data['isVideo'] ?? false,
          extra: data,
        );
      }
    });
    
    // 监听通话信令
    BackgroundService.instance.on('callSignal').listen((data) {
      if (data != null) {
        WebRTCService.instance.handleCallSignal(data);
      }
    });
    
    // 设置来电回调（从系统通知接听）
    NotificationService.instance.onAcceptCall = (data) async {
      final extra = data['extra'] as Map<String, dynamic>? ?? {};
      final callData = extra['data'] as Map<String, dynamic>? ?? extra;
      
      // 先接听通话
      await WebRTCService.instance.acceptCall();
      
      // 然后跳转到通话页面
      if (mounted) {
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (context) => CallPage(
              callerId: callData['callerId'] ?? 0,
              targetUserId: callData['targetUserId'] ?? 0,
              targetName: callData['callerName'] ?? '未知用户',
              callType: callData['callType'] == 'video' ? CallType.video : CallType.audio,
              isAccepted: true, // 已接听
            ),
          ),
        );
      }
    };
    
    NotificationService.instance.onDeclineCall = (data) {
      WebRTCService.instance.rejectCall();
    };
  }
  
  @override
  void dispose() {
    // 清除回调，避免引用已销毁的 context
    WebRTCService.instance.onIncomingCall = null;
    WebRTCService.instance.onCallStateChange = null;
    WebRTCService.instance.onError = null;
    WebRTCService.instance.onRemoteHangup = null;
    WebSocketService.instance.disconnect();
    WebRTCService.instance.cleanup();
    super.dispose();
  }
  
  /// 初始化 WebRTC 服务
  void _initWebRTC() {
    WebRTCService.instance.initialize();
    
    // 监听来电事件
    WebRTCService.instance.onIncomingCall = (call) {
      if (mounted) {
        _showIncomingCallDialog(call);
      }
    };
  }
  
  /// 显示来电界面（全屏）
  void _showIncomingCallDialog(CallInfo call) {
    // 再次检查 mounted 状态
    if (!mounted) return;
    
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (context) => IncomingCallPage(callInfo: call),
      ),
    );
  }
  
  Future<void> _initWebSocket() async {
    final token = await StorageUtil.getToken();
    final userId = StorageUtil.getUserId();
    
    if (token != null && userId != null) {
      // 设置消息回调
      WebSocketService.instance.onMessage = _handleWebSocketMessage;
      WebSocketService.instance.onGroupMessage = _handleGroupMessage;
      WebSocketService.instance.onSystemMessage = _handleSystemMessage;
      WebSocketService.instance.onConnectionStateChanged = (connected) {
        debugPrint('[HomePage] WebSocket 连接状态: $connected');
      };
      
      // 连接 WebSocket
      await WebSocketService.instance.connect(token: token, userId: userId);
    }
  }
  
  void _handleWebSocketMessage(Map<String, dynamic> data) {
    // 收到新消息，刷新会话列表
    ref.read(chatSessionsProvider.notifier).loadSessions();
    
    // 如果当前在对应的聊天页面，添加消息
    final senderId = data['senderId'] as int?;
    if (senderId != null) {
      try {
        final message = Message.fromJson(data);
        ref.read(messagesProvider(senderId).notifier).addMessage(message);
      } catch (e) {
        debugPrint('[HomePage] 解析消息失败: $e');
      }
    }
  }
  
  void _handleGroupMessage(Map<String, dynamic> data) {
    debugPrint('[HomePage] 收到群组消息: $data');
    // TODO: 处理群组消息
  }
  
  void _handleSystemMessage(Map<String, dynamic> data) {
    debugPrint('[HomePage] 收到系统消息: $data');
    // 显示系统消息通知
    final content = data['content'] as String? ?? data['message'] as String?;
    if (content != null && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(content)),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: _pages,
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (index) {
          setState(() => _currentIndex = index);
        },
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.chat_bubble_outline),
            selectedIcon: Icon(Icons.chat_bubble),
            label: '消息',
          ),
          NavigationDestination(
            icon: Icon(Icons.people_outline),
            selectedIcon: Icon(Icons.people),
            label: '通讯录',
          ),
          NavigationDestination(
            icon: Icon(Icons.group_outlined),
            selectedIcon: Icon(Icons.group),
            label: '群组',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person),
            label: '我的',
          ),
        ],
      ),
    );
  }
}
