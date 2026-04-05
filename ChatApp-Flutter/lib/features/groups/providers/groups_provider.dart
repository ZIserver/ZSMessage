import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/utils/storage_util.dart';
import '../../../models/group.dart';

/// 群组列表状态
typedef GroupsState = AsyncValue<List<Group>>;

/// 群组列表 Provider
final groupsProvider = StateNotifierProvider<GroupsNotifier, GroupsState>((ref) {
  return GroupsNotifier(ref.watch(apiClientProvider));
});

/// 群组列表 Notifier
class GroupsNotifier extends StateNotifier<GroupsState> {
  final ApiClient _apiClient;

  GroupsNotifier(this._apiClient) : super(const AsyncValue.loading());

  /// 加载群组列表
  Future<void> loadGroups() async {
    state = const AsyncValue.loading();

    try {
      final userId = StorageUtil.getUserId();
      if (userId == null) {
        state = const AsyncValue.data([]);
        return;
      }

      final response = await _apiClient.get(GroupPaths.userGroups(userId));

      if (response.statusCode == 200 && response.data != null) {
        final List<dynamic> data = response.data as List<dynamic>;
        final groups = data
            .map((e) => Group.fromJson(e as Map<String, dynamic>))
            .toList();

        state = AsyncValue.data(groups);
      } else {
        state = const AsyncValue.data([]);
      }
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
    }
  }

  /// 创建群组
  Future<Group?> createGroup({
    required String name,
    String? description,
    List<int>? memberIds,
  }) async {
    try {
      final userId = StorageUtil.getUserId();
      if (userId == null) return null;

      final response = await _apiClient.post(
        GroupPaths.create,
        data: {
          'name': name,
          'description': description,
          'ownerId': userId,
          'memberIds': memberIds ?? [],
        },
      );

      if (response.statusCode == 200 && response.data != null) {
        final group = Group.fromJson(response.data as Map<String, dynamic>);
        
        // 添加到列表
        state.whenData((groups) {
          state = AsyncValue.data([group, ...groups]);
        });
        
        return group;
      }
      return null;
    } catch (e) {
      rethrow;
    }
  }
}

/// 群消息列表状态
typedef GroupMessagesState = AsyncValue<List<GroupMessage>>;

/// 群消息列表 Provider
final groupMessagesProvider =
    StateNotifierProvider.family<GroupMessagesNotifier, GroupMessagesState, int>(
        (ref, groupId) {
  return GroupMessagesNotifier(ref.watch(apiClientProvider), groupId);
});

/// 群消息列表 Notifier
class GroupMessagesNotifier extends StateNotifier<GroupMessagesState> {
  final ApiClient _apiClient;
  final int _groupId;

  GroupMessagesNotifier(this._apiClient, this._groupId)
      : super(const AsyncValue.loading());

  /// 加载消息
  Future<void> loadMessages() async {
    state = const AsyncValue.loading();

    try {
      final response = await _apiClient.get(GroupPaths.getMessages(_groupId));

      if (response.statusCode == 200 && response.data != null) {
        final List<dynamic> data = response.data as List<dynamic>;
        final messages = data
            .map((e) => GroupMessage.fromJson(e as Map<String, dynamic>))
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
    String type = 'text',
  }) async {
    final userId = StorageUtil.getUserId();
    if (userId == null) return;

    // 创建临时消息
    final tempMessage = GroupMessage(
      groupId: _groupId,
      senderId: userId,
      content: content,
      type: type,
      createdAt: DateTime.now(),
    );

    // 乐观更新
    state.whenData((messages) {
      state = AsyncValue.data([...messages, tempMessage]);
    });

    try {
      final response = await _apiClient.post(
        GroupPaths.sendMessage,
        data: {
          'groupId': _groupId,
          'senderId': userId,
          'content': content,
          'type': type,
        },
      );

      if (response.statusCode == 200 && response.data != null) {
        final serverMessage =
            GroupMessage.fromJson(response.data as Map<String, dynamic>);

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
        state = AsyncValue.data(
            messages.where((m) => m != tempMessage).toList());
      });
      rethrow;
    }
  }

  /// 添加新消息
  void addMessage(GroupMessage message) {
    state.whenData((messages) {
      state = AsyncValue.data([...messages, message]);
    });
  }
}

/// 群成员列表 Provider
final groupMembersProvider =
    FutureProvider.family<List<GroupMember>, int>((ref, groupId) async {
  final apiClient = ref.watch(apiClientProvider);
  final response = await apiClient.get(GroupPaths.getMembers(groupId));

  if (response.statusCode == 200 && response.data != null) {
    final List<dynamic> data = response.data as List<dynamic>;
    return data
        .map((e) => GroupMember.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  return [];
});
