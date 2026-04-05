import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/app_constants.dart';
import '../../../widgets/avatar_widget.dart';
import '../providers/contacts_provider.dart';

/// 好友请求模型
class FriendRequest {
  final int id;
  final int senderId;
  final String? senderName;
  final String? senderNickname;
  final String? senderAvatar;
  final String? message;
  final int status; // 0-待处理, 1-已同意, 2-已拒绝
  final DateTime? createdAt;

  FriendRequest({
    required this.id,
    required this.senderId,
    this.senderName,
    this.senderNickname,
    this.senderAvatar,
    this.message,
    this.status = 0,
    this.createdAt,
  });

  String get displayName => senderNickname ?? senderName ?? '用户$senderId';

  factory FriendRequest.fromJson(Map<String, dynamic> json) {
    // 解析status字段（可能是字符串或int）
    int statusValue = 0;
    final statusRaw = json['status'];
    if (statusRaw is int) {
      statusValue = statusRaw;
    } else if (statusRaw is String) {
      switch (statusRaw.toUpperCase()) {
        case 'PENDING':
          statusValue = 0;
          break;
        case 'ACCEPTED':
          statusValue = 1;
          break;
        case 'REJECTED':
          statusValue = 2;
          break;
      }
    }
    
    return FriendRequest(
      id: json['id'] as int,
      senderId: json['userId'] as int? ?? json['senderId'] as int? ?? 0,
      senderName: json['senderName'] as String? ?? json['username'] as String?,
      senderNickname: json['senderNickname'] as String? ?? json['nickname'] as String?,
      senderAvatar: json['senderAvatar'] as String? ?? json['avatar'] as String?,
      message: json['requestMessage'] as String? ?? json['message'] as String? ?? json['remark'] as String?,
      status: statusValue,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'] as String)
          : null,
    );
  }
}

/// 新的朋友页面
class FriendRequestsPage extends ConsumerStatefulWidget {
  const FriendRequestsPage({super.key});

  @override
  ConsumerState<FriendRequestsPage> createState() => _FriendRequestsPageState();
}

class _FriendRequestsPageState extends ConsumerState<FriendRequestsPage> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(friendRequestsProvider.notifier).loadRequests());
  }

  @override
  Widget build(BuildContext context) {
    final requestsAsync = ref.watch(friendRequestsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('新的朋友'),
      ),
      body: requestsAsync.when(
        data: (requests) {
          if (requests.isEmpty) {
            return _buildEmptyState();
          }
          return ListView.separated(
            itemCount: requests.length,
            separatorBuilder: (_, __) => const Divider(height: 1),
            itemBuilder: (context, index) {
              final request = requests[index];
              return _buildRequestItem(request);
            },
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text('加载失败: $error'),
              TextButton(
                onPressed: () => ref.read(friendRequestsProvider.notifier).loadRequests(),
                child: const Text('重试'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.person_add_disabled,
            size: 80,
            color: AppColors.textHint,
          ),
          const SizedBox(height: AppDimens.spacing16),
          Text(
            '暂无好友请求',
            style: TextStyle(
              color: AppColors.textSecondary,
              fontSize: 16,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRequestItem(FriendRequest request) {
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(
        horizontal: AppDimens.spacing16,
        vertical: AppDimens.spacing8,
      ),
      leading: AvatarWidget(
        url: request.senderAvatar,
        name: request.displayName,
        size: AppDimens.avatarMedium,
      ),
      title: Text(
        request.displayName,
        style: const TextStyle(fontWeight: FontWeight.w500),
      ),
      subtitle: Text(
        request.message ?? '请求添加您为好友',
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(color: AppColors.textSecondary),
      ),
      trailing: _buildActionButton(request),
    );
  }

  Widget _buildActionButton(FriendRequest request) {
    if (request.status == 1) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: AppColors.surfaceVariant,
          borderRadius: BorderRadius.circular(4),
        ),
        child: Text(
          '已添加',
          style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
        ),
      );
    }
    
    if (request.status == 2) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: AppColors.surfaceVariant,
          borderRadius: BorderRadius.circular(4),
        ),
        child: Text(
          '已拒绝',
          style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
        ),
      );
    }

    // 待处理状态 - 显示同意按钮
    return SizedBox(
      width: 64,
      child: ElevatedButton(
        onPressed: () => _handleRequest(request, true),
        style: ElevatedButton.styleFrom(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          minimumSize: Size.zero,
          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        ),
        child: const Text('同意', style: TextStyle(fontSize: 13)),
      ),
    );
  }

  Future<void> _handleRequest(FriendRequest request, bool accept) async {
    try {
      await ref.read(friendRequestsProvider.notifier).handleRequest(
        requestId: request.id,
        accept: accept,
      );
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(accept ? '已同意好友请求' : '已拒绝好友请求')),
        );
        
        // 刷新好友列表
        if (accept) {
          ref.read(friendsProvider.notifier).loadFriends();
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('操作失败: $e')),
        );
      }
    }
  }
}
