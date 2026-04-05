import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/app_constants.dart';
import '../providers/chat_provider.dart';
import '../widgets/chat_item.dart';
import 'conversation_page.dart';
import 'qr_scanner_page.dart';
import '../../contacts/pages/add_friend_page.dart';
import '../../groups/pages/create_group_page.dart';

/// 消息列表页面
class ChatPage extends ConsumerStatefulWidget {
  const ChatPage({super.key});

  @override
  ConsumerState<ChatPage> createState() => _ChatPageState();
}

class _ChatPageState extends ConsumerState<ChatPage> {
  @override
  void initState() {
    super.initState();
    // 加载会话列表
    Future.microtask(() => ref.read(chatSessionsProvider.notifier).loadSessions());
  }

  void _showAddMenu(BuildContext context) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // 扫描二维码
            ListTile(
              leading: Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: AppColors.primary,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.qr_code_scanner, color: Colors.white),
              ),
              title: const Text('扫描二维码'),
              subtitle: Text('扫描添加好友或加入群聊', style: TextStyle(color: AppColors.textHint, fontSize: 12)),
              onTap: () async {
                Navigator.pop(context);
                final result = await Navigator.of(context).push<Map<String, dynamic>>(
                  MaterialPageRoute(builder: (_) => const QRScannerPage()),
                );
                if (result != null && mounted) {
                  _handleQRResult(result);
                }
              },
            ),
            const Divider(height: 1),
            // 添加好友
            ListTile(
              leading: Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: AppColors.success,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.person_add, color: Colors.white),
              ),
              title: const Text('添加好友'),
              subtitle: Text('搜索用户名或智穗号', style: TextStyle(color: AppColors.textHint, fontSize: 12)),
              onTap: () {
                Navigator.pop(context);
                Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const AddFriendPage()),
                );
              },
            ),
            const Divider(height: 1),
            // 新增群聊
            ListTile(
              leading: Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: AppColors.warning,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.group_add, color: Colors.white),
              ),
              title: const Text('新增群聊'),
              subtitle: Text('创建新的群聊', style: TextStyle(color: AppColors.textHint, fontSize: 12)),
              onTap: () {
                Navigator.pop(context);
                Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const CreateGroupPage()),
                );
              },
            ),
            const SizedBox(height: 8),
            // 取消按钮
            ListTile(
              title: Center(
                child: Text('取消', style: TextStyle(color: AppColors.textSecondary)),
              ),
              onTap: () => Navigator.pop(context),
            ),
          ],
        ),
      ),
    );
  }

  void _handleQRResult(Map<String, dynamic> result) {
    final type = result['type'] as String?;
    if (type == 'user') {
      final userId = result['userId'] as String?;
      if (userId != null) {
        // TODO: 跳转到添加好友页面并填充用户ID
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('扫描到用户: $userId')),
        );
      }
    } else if (type == 'group') {
      final groupId = result['groupId'] as String?;
      if (groupId != null) {
        // TODO: 跳转到加入群聊页面
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('扫描到群组: $groupId')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final sessionsAsync = ref.watch(chatSessionsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('消息'),
        actions: [
          IconButton(
            icon: const Icon(Icons.search),
            onPressed: () {
              // TODO: 搜索消息
            },
          ),
          IconButton(
            icon: const Icon(Icons.add),
            onPressed: () => _showAddMenu(context),
          ),
        ],
      ),
      body: sessionsAsync.when(
        data: (sessions) {
          if (sessions.isEmpty) {
            return _buildEmptyState();
          }
          return RefreshIndicator(
            onRefresh: () async {
              await ref.read(chatSessionsProvider.notifier).loadSessions();
            },
            child: ListView.separated(
              itemCount: sessions.length,
              separatorBuilder: (context, index) => const Divider(
                height: 1,
                indent: 72,
              ),
              itemBuilder: (context, index) {
                final session = sessions[index];
                return ChatItem(
                  session: session,
                  onTap: () async {
                    // 标记会话已读
                    ref.read(chatSessionsProvider.notifier).markAsRead(session.userId);
                    
                    // 进入聊天页面
                    await Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => ConversationPage(
                          userId: session.userId,
                          username: session.displayName,
                          avatar: session.avatar,
                        ),
                      ),
                    );
                    
                    // 返回时刷新会话列表
                    ref.read(chatSessionsProvider.notifier).loadSessions();
                  },
                );
              },
            ),
          );
        },
        loading: () => const Center(
          child: CircularProgressIndicator(),
        ),
        error: (error, stack) => Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.error_outline,
                size: 64,
                color: AppColors.textHint,
              ),
              const SizedBox(height: AppDimens.spacing16),
              Text(
                '加载失败',
                style: TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 16,
                ),
              ),
              const SizedBox(height: AppDimens.spacing8),
              TextButton(
                onPressed: () {
                  ref.read(chatSessionsProvider.notifier).loadSessions();
                },
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
            Icons.chat_bubble_outline,
            size: 80,
            color: AppColors.textHint,
          ),
          const SizedBox(height: AppDimens.spacing16),
          Text(
            '暂无消息',
            style: TextStyle(
              color: AppColors.textSecondary,
              fontSize: 16,
            ),
          ),
          const SizedBox(height: AppDimens.spacing8),
          Text(
            '快去添加好友开始聊天吧',
            style: TextStyle(
              color: AppColors.textHint,
              fontSize: 14,
            ),
          ),
        ],
      ),
    );
  }
}
