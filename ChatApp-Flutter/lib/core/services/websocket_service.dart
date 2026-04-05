import 'dart:async';
import 'dart:convert';
import 'dart:math';
import 'package:flutter/foundation.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

/// WebSocket 服务 (STOMP over SockJS)
class WebSocketService {
  static WebSocketService? _instance;
  static WebSocketService get instance => _instance ??= WebSocketService._();
  
  WebSocketService._();
  
  WebSocketChannel? _channel;
  StreamSubscription? _subscription;
  Timer? _heartbeatTimer;
  bool _isConnected = false;
  int _reconnectAttempts = 0;
  static const int _maxReconnectAttempts = 5;
  static const Duration _reconnectDelay = Duration(seconds: 3);
  static const Duration _heartbeatInterval = Duration(seconds: 25);
  
  String? _token;
  int? _userId;
  
  // 消息回调
  void Function(Map<String, dynamic> message)? onMessage;
  void Function(Map<String, dynamic> message)? onGroupMessage;
  void Function(Map<String, dynamic> message)? onSystemMessage;
  void Function(Map<String, dynamic> signal)? onCallSignal;
  void Function(bool connected)? onConnectionStateChanged;
  void Function(String error)? onError;
  
  // STOMP 订阅ID计数器
  int _subscriptionId = 0;
  final Map<String, String> _subscriptions = {};
  
  /// 连接 WebSocket
  Future<void> connect({required String token, required int userId}) async {
    if (_isConnected) {
      debugPrint('[WebSocket] 已经连接');
      return;
    }
    
    _token = token;
    _userId = userId;
    
    try {
      // SockJS 原生 WebSocket 端点
      // 生成随机服务器ID和会话ID（SockJS协议要求）
      final serverId = _generateRandomId(3);
      final sessionId = _generateRandomId(8);
      final wsUrl = 'wss://msg.v2.zhsdev.top/ws/$serverId/$sessionId/websocket';
      
      debugPrint('[WebSocket] 正在连接: $wsUrl');
      
      _channel = WebSocketChannel.connect(Uri.parse(wsUrl));
      
      _subscription = _channel!.stream.listen(
        _onMessage,
        onError: _onError,
        onDone: _onDone,
      );
      
      // 等待 SockJS 打开帧
      // 实际的连接处理在 _onMessage 中
      
    } catch (e) {
      debugPrint('[WebSocket] 连接失败: $e');
      onError?.call('连接失败: $e');
      _scheduleReconnect();
    }
  }
  
  String _generateRandomId(int length) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    final random = Random();
    return String.fromCharCodes(
      Iterable.generate(length, (_) => chars.codeUnitAt(random.nextInt(chars.length))),
    );
  }
  
  void _onMessage(dynamic data) {
    try {
      String message = data.toString();
      debugPrint('[WebSocket] 收到数据: $message');
      
      // SockJS 消息格式处理
      if (message.startsWith('o')) {
        // 连接打开
        debugPrint('[WebSocket] SockJS 连接已打开');
        _onConnected();
        return;
      }
      
      if (message.startsWith('h')) {
        // 心跳
        debugPrint('[WebSocket] 收到心跳');
        return;
      }
      
      if (message.startsWith('c')) {
        // 连接关闭
        debugPrint('[WebSocket] 连接关闭');
        _handleDisconnect();
        return;
      }
      
      if (message.startsWith('a')) {
        // 消息数组
        message = message.substring(1); // 移除 'a' 前缀
        final List<dynamic> messages = jsonDecode(message);
        for (final msg in messages) {
          _handleStompMessage(msg.toString());
        }
        return;
      }
      
      // 其他消息
      _handleStompMessage(message);
      
    } catch (e) {
      debugPrint('[WebSocket] 解析消息失败: $e');
    }
  }
  
  void _onConnected() {
    _isConnected = true;
    _reconnectAttempts = 0;
    onConnectionStateChanged?.call(true);
    
    // 发送 STOMP CONNECT 帧
    _sendStompFrame('CONNECT', {
      'accept-version': '1.1,1.2',
      'heart-beat': '10000,10000',
    });
  }
  
  void _handleStompMessage(String message) {
    // 解析 STOMP 帧
    final lines = message.split('\n');
    if (lines.isEmpty) return;
    
    final command = lines[0];
    final headers = <String, String>{};
    int bodyStart = 1;
    
    for (int i = 1; i < lines.length; i++) {
      final line = lines[i];
      if (line.isEmpty) {
        bodyStart = i + 1;
        break;
      }
      final colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        headers[line.substring(0, colonIndex)] = line.substring(colonIndex + 1);
      }
    }
    
    final body = bodyStart < lines.length 
        ? lines.sublist(bodyStart).join('\n').replaceAll('\x00', '').trim()
        : '';
    
    debugPrint('[WebSocket] STOMP 命令: $command');
    
    switch (command) {
      case 'CONNECTED':
        debugPrint('[WebSocket] STOMP 连接成功');
        _startHeartbeat();
        _subscribeToQueues();
        break;
        
      case 'MESSAGE':
        _handleIncomingMessage(headers, body);
        break;
        
      case 'ERROR':
        debugPrint('[WebSocket] STOMP 错误: $body');
        onError?.call('STOMP错误: $body');
        break;
        
      case 'RECEIPT':
        debugPrint('[WebSocket] STOMP 回执: ${headers['receipt-id']}');
        break;
    }
  }
  
  void _subscribeToQueues() {
    // 订阅私聊消息
    _subscribe('/user/$_userId/queue/messages', 'messages');
    
    // 订阅系统消息
    _subscribe('/user/$_userId/queue/system', 'system');
    
    // 订阅通话信令
    _subscribe('/user/$_userId/queue/call', 'call');
    
    debugPrint('[WebSocket] 已订阅所有队列');
  }
  
  void _subscribe(String destination, String name) {
    final subId = 'sub-${_subscriptionId++}';
    _subscriptions[name] = subId;
    
    _sendStompFrame('SUBSCRIBE', {
      'id': subId,
      'destination': destination,
    });
    
    debugPrint('[WebSocket] 订阅: $destination (id: $subId)');
  }
  
  void _handleIncomingMessage(Map<String, String> headers, String body) {
    final destination = headers['destination'] ?? '';
    
    debugPrint('[WebSocket] 收到消息 from $destination: $body');
    
    if (body.isEmpty) return;
    
    try {
      final data = jsonDecode(body) as Map<String, dynamic>;
      
      if (destination.contains('/queue/messages')) {
        onMessage?.call(data);
      } else if (destination.contains('/queue/system')) {
        onSystemMessage?.call(data);
      } else if (destination.contains('/topic/group/')) {
        onGroupMessage?.call(data);
      } else if (destination.contains('/queue/call')) {
        // 通话信令使用专门的回调
        onCallSignal?.call(data);
      } else {
        onMessage?.call(data);
      }
    } catch (e) {
      debugPrint('[WebSocket] 解析消息内容失败: $e');
    }
  }
  
  void _sendStompFrame(String command, Map<String, String> headers, [String body = '']) {
    final buffer = StringBuffer();
    buffer.write('$command\n');
    
    headers.forEach((key, value) {
      buffer.write('$key:$value\n');
    });
    
    buffer.write('\n');
    buffer.write(body);
    buffer.write('\x00'); // NULL 结束符
    
    final frame = buffer.toString();
    _sendRaw('["${_escapeJson(frame)}"]');
  }
  
  String _escapeJson(String str) {
    return str
        .replaceAll('\\', '\\\\')
        .replaceAll('"', '\\"')
        .replaceAll('\n', '\\n')
        .replaceAll('\r', '\\r')
        .replaceAll('\x00', '\\u0000');
  }
  
  void _sendRaw(String data) {
    if (_channel != null) {
      _channel!.sink.add(data);
      debugPrint('[WebSocket] 发送: $data');
    }
  }
  
  void _startHeartbeat() {
    _heartbeatTimer?.cancel();
    _heartbeatTimer = Timer.periodic(_heartbeatInterval, (_) {
      if (_isConnected && _channel != null) {
        _sendRaw('["\\n"]'); // STOMP 心跳
      }
    });
  }
  
  void _onError(Object error) {
    debugPrint('[WebSocket] 错误: $error');
    _handleDisconnect();
    onError?.call(error.toString());
    _scheduleReconnect();
  }
  
  void _onDone() {
    debugPrint('[WebSocket] 连接关闭');
    _handleDisconnect();
    _scheduleReconnect();
  }
  
  void _handleDisconnect() {
    _isConnected = false;
    _heartbeatTimer?.cancel();
    _subscriptions.clear();
    onConnectionStateChanged?.call(false);
  }
  
  void _scheduleReconnect() {
    if (_reconnectAttempts >= _maxReconnectAttempts) {
      debugPrint('[WebSocket] 达到最大重连次数');
      return;
    }
    
    if (_token == null || _userId == null) return;
    
    Future.delayed(_reconnectDelay, () {
      if (!_isConnected && _token != null && _userId != null) {
        _reconnectAttempts++;
        debugPrint('[WebSocket] 重连 ($_reconnectAttempts/$_maxReconnectAttempts)');
        connect(token: _token!, userId: _userId!);
      }
    });
  }
  
  /// 订阅群组消息
  void subscribeToGroup(int groupId) {
    if (!_isConnected) return;
    _subscribe('/topic/group/$groupId', 'group_$groupId');
  }
  
  /// 断开连接
  void disconnect() {
    debugPrint('[WebSocket] 主动断开连接');
    _heartbeatTimer?.cancel();
    _subscription?.cancel();
    _channel?.sink.close();
    _channel = null;
    _isConnected = false;
    _subscriptions.clear();
    _token = null;
    _userId = null;
    onConnectionStateChanged?.call(false);
  }
  
  /// 发送聊天消息
  void sendChatMessage({
    required int receiverId,
    required String content,
    String type = 'text',
  }) {
    if (!_isConnected || _userId == null) return;
    
    final message = jsonEncode({
      'senderId': _userId,
      'receiverId': receiverId,
      'content': content,
      'type': type,
    });
    
    _sendStompFrame('SEND', {
      'destination': '/app/chat',
      'content-type': 'application/json',
    }, message);
  }
  
  /// 发送群组消息
  void sendGroupMessage({
    required int groupId,
    required String content,
    String type = 'text',
  }) {
    if (!_isConnected || _userId == null) return;
    
    final message = jsonEncode({
      'senderId': _userId,
      'groupId': groupId,
      'content': content,
      'type': type,
    });
    
    _sendStompFrame('SEND', {
      'destination': '/app/group/$groupId',
      'content-type': 'application/json',
    }, message);
  }
  
  /// 发送通话信令
  void sendCallSignal(String signalType, Map<String, dynamic> data) {
    if (!_isConnected || _userId == null) {
      debugPrint('[WebSocket] 未连接，无法发送通话信令');
      return;
    }
    
    final message = jsonEncode(data);
    
    _sendStompFrame('SEND', {
      'destination': '/app/call/$signalType',
      'content-type': 'application/json',
    }, message);
    
    debugPrint('[WebSocket] 发送通话信令: $signalType');
  }
  
  bool get isConnected => _isConnected;
  int? get currentUserId => _userId;
}
