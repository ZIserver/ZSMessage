import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/utils/storage_util.dart';
import '../../../models/moment.dart';

/// 朋友圈列表状态
typedef MomentsState = AsyncValue<List<Moment>>;

/// 朋友圈列表 Provider
final momentsProvider = StateNotifierProvider<MomentsNotifier, MomentsState>((ref) {
  return MomentsNotifier(ref.watch(apiClientProvider));
});

/// 朋友圈列表 Notifier
class MomentsNotifier extends StateNotifier<MomentsState> {
  final ApiClient _apiClient;

  MomentsNotifier(this._apiClient) : super(const AsyncValue.loading());

  /// 加载朋友圈
  Future<void> loadMoments() async {
    state = const AsyncValue.loading();

    try {
      final response = await _apiClient.get(MomentPaths.all);

      if (response.statusCode == 200 && response.data != null) {
        final List<dynamic> data = response.data as List<dynamic>;
        final moments = data
            .map((e) => Moment.fromJson(e as Map<String, dynamic>))
            .toList();

        state = AsyncValue.data(moments);
      } else {
        state = const AsyncValue.data([]);
      }
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
    }
  }

  /// 发布动态
  Future<Moment?> createMoment({
    required String content,
    List<String>? images,
  }) async {
    try {
      final userId = StorageUtil.getUserId();
      if (userId == null) return null;

      final response = await _apiClient.post(
        MomentPaths.create,
        data: {
          'userId': userId,
          'content': content,
          'images': images?.join(','),
        },
      );

      if (response.statusCode == 200 && response.data != null) {
        final moment = Moment.fromJson(response.data as Map<String, dynamic>);
        
        // 添加到列表顶部
        state.whenData((moments) {
          state = AsyncValue.data([moment, ...moments]);
        });
        
        return moment;
      }
      return null;
    } catch (e) {
      rethrow;
    }
  }

  /// 点赞/取消点赞
  Future<void> toggleLike(int momentId) async {
    try {
      final userId = StorageUtil.getUserId();
      if (userId == null) return;

      final response = await _apiClient.post(
        MomentPaths.like(momentId),
        data: {'userId': userId},
      );

      if (response.statusCode == 200) {
        state.whenData((moments) {
          final newMoments = moments.map((m) {
            if (m.id == momentId) {
              return m.copyWith(
                isLiked: !m.isLiked,
                likeCount: m.isLiked ? m.likeCount - 1 : m.likeCount + 1,
              );
            }
            return m;
          }).toList();
          state = AsyncValue.data(newMoments);
        });
      }
    } catch (e) {
      rethrow;
    }
  }

  /// 删除动态
  Future<void> deleteMoment(int momentId) async {
    try {
      final response = await _apiClient.delete(MomentPaths.delete(momentId));

      if (response.statusCode == 200) {
        state.whenData((moments) {
          state = AsyncValue.data(moments.where((m) => m.id != momentId).toList());
        });
      }
    } catch (e) {
      rethrow;
    }
  }
}

/// 评论列表 Provider
final momentCommentsProvider =
    FutureProvider.family<List<MomentComment>, int>((ref, momentId) async {
  final apiClient = ref.watch(apiClientProvider);
  final response = await apiClient.get(MomentPaths.comments(momentId));

  if (response.statusCode == 200 && response.data != null) {
    final List<dynamic> data = response.data as List<dynamic>;
    return data
        .map((e) => MomentComment.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  return [];
});

/// 添加评论
Future<MomentComment?> addComment({
  required ApiClient apiClient,
  required int momentId,
  required String content,
  int? replyToUserId,
}) async {
  final userId = StorageUtil.getUserId();
  if (userId == null) return null;

  final response = await apiClient.post(
    MomentPaths.addComment,
    data: {
      'momentId': momentId,
      'userId': userId,
      'content': content,
      'replyToUserId': replyToUserId,
    },
  );

  if (response.statusCode == 200 && response.data != null) {
    return MomentComment.fromJson(response.data as Map<String, dynamic>);
  }

  return null;
}
