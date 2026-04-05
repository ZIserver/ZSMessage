import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/app_constants.dart';
import '../../../widgets/avatar_widget.dart';
import '../../../models/group.dart';
import '../../auth/providers/auth_provider.dart';
import '../providers/groups_provider.dart';
import '../../chat/widgets/chat_input.dart';

/// 群聊详情页面
class GroupChatPage extends ConsumerStatefulWidget {
  final Group group;

  const GroupChatPage({super.key, required this.group});

  @override
  ConsumerState<GroupChatPage> createState() => _GroupChatPageState();
}

class _GroupChatPageState extends ConsumerState<GroupChatPage> {
  final ScrollController _scrollController = ScrollController();
  final TextEditingController _messageController = TextEditingController();

  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      ref.read(groupMessagesProvider(widget.group.id).notifier).loadMessages();
    });
  }

  @override
  void dispose() {
    _scrollController.dispose();
    _messageController.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    if (_scrollController.hasClients) {
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
      );
    }
  }

  Future<void> _sendMessage() async {
    final content = _messageController.text.trim();
    if (content.isEmpty) return;

    _messageController.clear();

    try {
      await ref.read(groupMessagesProvider(widget.group.id).notifier).sendMessage(
        content: content,
      );
      _scrollToBottom();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('发送失败: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final messagesAsync = ref.watch(groupMessagesProvider(widget.group.id));
    final authState = ref.watch(authProvider);
    final currentUserId = authState.user?.id;
    final currentUserAvatar = authState.user?.avatar;

    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            AvatarWidget(
              url: widget.group.avatar,
              name: widget.group.displayName,
              size: 36,
            ),
            const SizedBox(width: AppDimens.spacing12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    widget.group.displayName,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  Text(
                    '${widget.group.memberCount ?? 0}人',
                    style: TextStyle(
                      fontSize: 12,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.more_vert),
            onPressed: () {
              // TODO: 群设置
            },
          ),
        ],
      ),
      body: Container(
        color: const Color(0xFFEDEDED),
        child: Column(
          children: [
            Expanded(
              child: messagesAsync.when(
                data: (messages) {
                  if (messages.isEmpty) {
                    return Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.chat_bubble_outline,
                            size: 64,
                            color: AppColors.textHint,
                          ),
                          const SizedBox(height: AppDimens.spacing16),
                          Text(
                            '暂无消息',
                            style: TextStyle(color: AppColors.textHint),
                          ),
                        ],
                      ),
                    );
                  }

                  return ListView.builder(
                    controller: _scrollController,
                    padding: const EdgeInsets.all(AppDimens.spacing12),
                    itemCount: messages.length,
                    itemBuilder: (context, index) {
                      final message = messages[index];
                      final isSelf = message.senderId == currentUserId;

                      return _buildMessageBubble(
                        message: message,
                        isSelf: isSelf,
                        selfAvatar: currentUserAvatar,
                      );
                    },
                  );
                },
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (error, _) => Center(child: Text('加载失败: $error')),
              ),
            ),
            ChatInput(
              controller: _messageController,
              onSend: _sendMessage,
              onAttachment: () {},
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMessageBubble({
    required GroupMessage message,
    required bool isSelf,
    String? selfAvatar,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppDimens.spacing6),
      child: Row(
        mainAxisAlignment: isSelf ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 对方头像
          if (!isSelf) ...[
            _buildAvatar(message.senderAvatar, message.senderName),
            const SizedBox(width: AppDimens.spacing8),
          ],

          // 消息内容
          Flexible(
            child: Column(
              crossAxisAlignment: isSelf ? CrossAxisAlignment.end : CrossAxisAlignment.start,
              children: [
                // 群聊显示发送者名字
                if (!isSelf)
                  Padding(
                    padding: const EdgeInsets.only(left: 4, bottom: 4),
                    child: Text(
                      message.senderName ?? '未知用户',
                      style: TextStyle(
                        fontSize: 12,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ),
                Container(
                  constraints: BoxConstraints(
                    maxWidth: MediaQuery.of(context).size.width * 0.65,
                  ),
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppDimens.spacing12,
                    vertical: AppDimens.spacing10,
                  ),
                  decoration: BoxDecoration(
                    color: isSelf ? const Color(0xFF95EC69) : Colors.white,
                    borderRadius: BorderRadius.only(
                      topLeft: const Radius.circular(AppDimens.radiusMedium),
                      topRight: const Radius.circular(AppDimens.radiusMedium),
                      bottomLeft: Radius.circular(isSelf ? AppDimens.radiusMedium : 4),
                      bottomRight: Radius.circular(isSelf ? 4 : AppDimens.radiusMedium),
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.05),
                        blurRadius: 2,
                        offset: const Offset(0, 1),
                      ),
                    ],
                  ),
                  child: Text(
                    message.content,
                    style: const TextStyle(fontSize: 15),
                  ),
                ),
              ],
            ),
          ),

          // 自己的头像
          if (isSelf) ...[
            const SizedBox(width: AppDimens.spacing8),
            _buildAvatar(selfAvatar, null),
          ],
        ],
      ),
    );
  }

  Widget _buildAvatar(String? avatarUrl, String? name) {
    if (avatarUrl != null && avatarUrl.isNotEmpty) {
      final url = avatarUrl.startsWith('http')
          ? avatarUrl
          : 'https://api.zhsidc.com$avatarUrl';
      return Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(6),
          image: DecorationImage(
            image: NetworkImage(url),
            fit: BoxFit.cover,
          ),
        ),
      );
    }

    return Container(
      width: 40,
      height: 40,
      decoration: BoxDecoration(
        color: AppColors.primary,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Center(
        child: Text(
          (name ?? '?')[0].toUpperCase(),
          style: const TextStyle(
            color: Colors.white,
            fontSize: 16,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
    );
  }
}
