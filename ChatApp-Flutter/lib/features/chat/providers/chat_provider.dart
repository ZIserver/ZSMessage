import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/utils/storage_util.dart';
import '../../../models/message.dart';

/// 聊天会话模型
class ChatSession {
  final int userId;
  final String? username;
  final String? nickname;
  final String? avatar;
  final String? lastMessage;
  final DateTime? lastMessageTime;
  final int unreadCount;

  ChatSession({
    required this.userId,
    this.username,
    this.nickname,
    this.avatar,
    this.lastMessage,
    this.lastMessageTime,
    this.unreadCount = 0,
  });

  String get displayName => nickname ?? username ?? '用户$userId';

  factory ChatSession.fromJson(Map<String, dynamic> json) {
    return ChatSession(
      userId: json['userId'] as int,
      username: json['username'] as String?,
      nickname: json['nickname'] as String?,
      avatar: json['avatar'] as String?,
      lastMessage: json['lastMessage'] as String?,
      lastMessageTime: json['lastMessageTime'] != null
          ? DateTime.parse(json['lastMessageTime'] as String)
          : null,
      unreadCount: json['unreadCount'] as int? ?? 0,
    );
  }
}

/// 会话列表状态
typedef ChatSessionsState = AsyncValue<List<ChatSession>>;

/// 会话列表 Provider
final chatSessionsProvider =
    StateNotifierProvider<ChatSessionsNotifier, ChatSessionsState>((ref) {
  return ChatSessionsNotifier(ref.watch(apiClientProvider));
});

/// 会话列表 Notifier
class ChatSessionsNotifier extends StateNotifier<ChatSessionsState> {
  final ApiClient _apiClient;

  ChatSessionsNotifier(this._apiClient) : super(const AsyncValue.loading());

  /// 加载会话列表
  Future<void> loadSessions() async {
    state = const AsyncValue.loading();

    try {
      final userId = StorageUtil.getUserId();
      if (userId == null) {
        state = const AsyncValue.data([]);
        return;
      }

      final response = await _apiClient.get(MessagePaths.sessions(userId));

      if (response.statusCode == 200 && response.data != null) {
        final List<dynamic> data = response.data as List<dynamic>;
        final sessions = data
            .map((e) => ChatSession.fromJson(e as Map<String, dynamic>))
            .toList();

        state = AsyncValue.data(sessions);
      } else {
        state = const AsyncValue.data([]);
      }
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
    }
  }

  /// 更新会话
  void updateSession(ChatSession session) {
    state.whenData((sessions) {
      final index = sessions.indexWhere((s) => s.userId == session.userId);
      if (index >= 0) {
        final newSessions = [...sessions];
        newSessions[index] = session;
        state = AsyncValue.data(newSessions);
      } else {
        state = AsyncValue.data([session, ...sessions]);
      }
    });
  }
  
  /// 标记会话已读
  Future<void> markAsRead(int targetUserId) async {
    try {
      final userId = StorageUtil.getUserId();
      if (userId == null) return;
      
      // 调用API标记已读
      await _apiClient.post(
        MessagePaths.markChatAsRead,
        data: {
          'senderId': targetUserId,
          'receiverId': userId,
        },
      );
      
      // 更新本地状态
      state.whenData((sessions) {
        final newSessions = sessions.map((s) {
          if (s.userId == targetUserId) {
            return ChatSession(
              userId: s.userId,
              username: s.username,
              nickname: s.nickname,
              avatar: s.avatar,
              lastMessage: s.lastMessage,
              lastMessageTime: s.lastMessageTime,
              unreadCount: 0,
            );
          }
          return s;
        }).toList();
        state = AsyncValue.data(newSessions);
      });
    } catch (e) {
      // 标记失败不影响用户体验
    }
  }
}

/// 消息列表状态
typedef MessagesState = AsyncValue<List<Message>>;

/// 消息列表 Provider（按对话用户 ID）
final messagesProvider =
    StateNotifierProvider.family<MessagesNotifier, MessagesState, int>(
        (ref, targetUserId) {
  return MessagesNotifier(ref.watch(apiClientProvider), targetUserId);
});

/// 消息列表 Notifier
class MessagesNotifier extends StateNotifier<MessagesState> {
  final ApiClient _apiClient;
  final int _targetUserId;

  MessagesNotifier(this._apiClient, this._targetUserId)
      : super(const AsyncValue.loading());

  /// 加载消息
  Future<void> loadMessages() async {
    state = const AsyncValue.loading();

    try {
      final userId = StorageUtil.getUserId();
      if (userId == null) {
        state = const AsyncValue.data([]);
        return;
      }

      final response = await _apiClient.get(
        MessagePaths.history,
        queryParameters: {
          'userId1': userId,
          'userId2': _targetUserId,
        },
      );

      if (response.statusCode == 200 && response.data != null) {
        final List<dynamic> data = response.data as List<dynamic>;
        final messages = data
            .map((e) => Message.fromJson(e as Map<String, dynamic>))
            .toList();

        state = AsyncValue.data(messages);
      } else {
        state = const AsyncValue.data([]);
      }
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
    }
  }

  /// 发送消息
  Future<void> sendMessage({
    required String content,
    required int receiverId,
    String type = 'text',
  }) async {
    final userId = StorageUtil.getUserId();
    if (userId == null) return;

    // 创建临时消息（乐观更新）
    final tempMessage = Message(
      senderId: userId,
      receiverId: receiverId,
      content: content,
      type: type,
      timestamp: DateTime.now(),
    );

    // 先添加到列表
    state.whenData((messages) {
      state = AsyncValue.data([...messages, tempMessage]);
    });

    try {
      final response = await _apiClient.post(
        MessagePaths.send,
        data: {
          'senderId': userId,
          'receiverId': receiverId,
          'content': content,
          'type': type,
        },
      );

      if (response.statusCode == 200 && response.data != null) {
        final serverMessage =
            Message.fromJson(response.data as Map<String, dynamic>);

        // 替换临时消息
        state.whenData((messages) {
          final index = messages.indexOf(tempMessage);
          if (index >= 0) {
            final newMessages = [...messages];
            newMessages[index] = serverMessage;
            state = AsyncValue.data(newMessages);
          }
        });
      }
    } catch (e) {
      // 发送失败，移除临时消息
      state.whenData((messages) {
        state =
            AsyncValue.data(messages.where((m) => m != tempMessage).toList());
      });
      rethrow;
    }
  }

  /// 添加新消息（来自 WebSocket）
  void addMessage(Message message) {
    state.whenData((messages) {
      state = AsyncValue.data([...messages, message]);
    });
  }
}
