import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/utils/storage_util.dart';
import '../../../models/user.dart';
import '../pages/friend_requests_page.dart';

/// 好友列表状态
typedef FriendsState = AsyncValue<List<User>>;

/// 好友列表 Provider
final friendsProvider =
    StateNotifierProvider<FriendsNotifier, FriendsState>((ref) {
  return FriendsNotifier(ref.watch(apiClientProvider));
});

/// 好友列表 Notifier
class FriendsNotifier extends StateNotifier<FriendsState> {
  final ApiClient _apiClient;

  FriendsNotifier(this._apiClient) : super(const AsyncValue.loading());

  /// 加载好友列表
  Future<void> loadFriends() async {
    state = const AsyncValue.loading();

    try {
      final userId = StorageUtil.getUserId();
      if (userId == null) {
        state = const AsyncValue.data([]);
        return;
      }

      final response = await _apiClient.get(FriendPaths.list(userId));

      if (response.statusCode == 200 && response.data != null) {
        final List<dynamic> data = response.data as List<dynamic>;
        final friends = data
            .map((e) => User.fromJson(e as Map<String, dynamic>))
            .toList();
        
        // 去重：根据userId去重
        final seen = <int>{};
        final uniqueFriends = friends.where((f) => seen.add(f.id)).toList();

        state = AsyncValue.data(uniqueFriends);
      } else {
        state = const AsyncValue.data([]);
      }
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
    }
  }

  /// 添加好友到列表
  void addFriend(User friend) {
    state.whenData((friends) {
      if (!friends.any((f) => f.id == friend.id)) {
        state = AsyncValue.data([...friends, friend]);
      }
    });
  }

  /// 从列表移除好友
  void removeFriend(int friendId) {
    state.whenData((friends) {
      state = AsyncValue.data(friends.where((f) => f.id != friendId).toList());
    });
  }
}

/// 搜索用户结果 Provider
final searchUsersProvider =
    FutureProvider.family<List<User>, String>((ref, keyword) async {
  if (keyword.isEmpty) return [];

  final apiClient = ref.watch(apiClientProvider);
  final response = await apiClient.get(
    UserPaths.search,
    queryParameters: {'keyword': keyword},
  );

  if (response.statusCode == 200 && response.data != null) {
    final List<dynamic> data = response.data as List<dynamic>;
    return data.map((e) => User.fromJson(e as Map<String, dynamic>)).toList();
  }

  return [];
});

/// 好友请求列表状态
typedef FriendRequestsState = AsyncValue<List<FriendRequest>>;

/// 好友请求列表 Provider
final friendRequestsProvider =
    StateNotifierProvider<FriendRequestsNotifier, FriendRequestsState>((ref) {
  return FriendRequestsNotifier(ref.watch(apiClientProvider));
});

/// 好友请求列表 Notifier
class FriendRequestsNotifier extends StateNotifier<FriendRequestsState> {
  final ApiClient _apiClient;

  FriendRequestsNotifier(this._apiClient) : super(const AsyncValue.loading());

  /// 加载好友请求列表
  Future<void> loadRequests() async {
    state = const AsyncValue.loading();

    try {
      final userId = StorageUtil.getUserId();
      if (userId == null) {
        state = const AsyncValue.data([]);
        return;
      }

      print('[FriendRequests] 当前用户ID: $userId');
      print('[FriendRequests] 请求路径: ${FriendPaths.requests(userId)}');
      
      final response = await _apiClient.get(FriendPaths.requests(userId));

      print('[FriendRequests] 响应状态: ${response.statusCode}');
      print('[FriendRequests] 响应数据: ${response.data}');
      
      if (response.statusCode == 200 && response.data != null) {
        final List<dynamic> data = response.data as List<dynamic>;
        print('[FriendRequests] 收到 ${data.length} 条好友请求');
        
        final requests = <FriendRequest>[];
        
        for (final e in data) {
          final json = e as Map<String, dynamic>;
          print('[FriendRequests] 处理请求: $json');
          
          final senderId = json['userId'] as int? ?? 0;
          print('[FriendRequests] 发送者ID: $senderId');
          
          // 获取发送者用户信息
          String? senderName;
          String? senderNickname;
          String? senderAvatar;
          
          try {
            final userResponse = await _apiClient.get(UserPaths.getUserById(senderId));
            if (userResponse.statusCode == 200 && userResponse.data != null) {
              final userData = userResponse.data as Map<String, dynamic>;
              senderName = userData['username'] as String?;
              senderNickname = userData['nickname'] as String?;
              senderAvatar = userData['avatar'] as String?;
              print('[FriendRequests] 发送者信息: $senderName, $senderNickname');
            }
          } catch (e) {
            print('[FriendRequests] 获取发送者信息失败: $e');
          }
          
          requests.add(FriendRequest(
            id: json['id'] as int,
            senderId: senderId,
            senderName: senderName,
            senderNickname: senderNickname,
            senderAvatar: senderAvatar,
            message: json['requestMessage'] as String? ?? json['message'] as String?,
            status: _parseStatus(json['status']),
            createdAt: json['createdAt'] != null
                ? DateTime.tryParse(json['createdAt'] as String)
                : null,
          ));
        }

        print('[FriendRequests] 最终加载了 ${requests.length} 条请求');
        state = AsyncValue.data(requests);
      } else {
        print('[FriendRequests] 响应状态码不是200或数据为空');
        state = const AsyncValue.data([]);
      }
    } catch (e, stack) {
      print('[FriendRequests] 加载失败: $e');
      print('[FriendRequests] 堆栈: $stack');
      state = AsyncValue.error(e, stack);
    }
  }
  
  int _parseStatus(dynamic status) {
    if (status is int) return status;
    if (status is String) {
      switch (status.toUpperCase()) {
        case 'PENDING': return 0;
        case 'ACCEPTED': return 1;
        case 'REJECTED': return 2;
      }
    }
    return 0;
  }

  /// 处理好友请求
  Future<void> handleRequest({required int requestId, required bool accept}) async {
    try {
      final userId = StorageUtil.getUserId();
      if (userId == null) throw Exception('用户未登录');
      
      final path = accept 
          ? FriendPaths.accept(requestId) 
          : FriendPaths.reject(requestId);
          
      final response = await _apiClient.post(
        path,
        data: {'userId': userId},
      );

      if (response.statusCode == 200) {
        // 更新本地状态
        state.whenData((requests) {
          final newRequests = requests.map((r) {
            if (r.id == requestId) {
              return FriendRequest(
                id: r.id,
                senderId: r.senderId,
                senderName: r.senderName,
                senderNickname: r.senderNickname,
                senderAvatar: r.senderAvatar,
                message: r.message,
                status: accept ? 1 : 2,
                createdAt: r.createdAt,
              );
            }
            return r;
          }).toList();
          state = AsyncValue.data(newRequests);
        });
      } else {
        throw Exception('操作失败');
      }
    } catch (e) {
      rethrow;
    }
  }
}
