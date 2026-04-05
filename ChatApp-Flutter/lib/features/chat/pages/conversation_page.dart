import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/services/webrtc_service.dart';
import '../../../widgets/avatar_widget.dart';
import '../../auth/providers/auth_provider.dart';
import '../../call/call_page.dart';
import '../providers/chat_provider.dart';
import '../widgets/message_bubble.dart';
import '../widgets/chat_input.dart';

/// 聊天详情页面
class ConversationPage extends ConsumerStatefulWidget {
  final int userId;
  final String username;
  final String? avatar;

  const ConversationPage({
    super.key,
    required this.userId,
    required this.username,
    this.avatar,
  });

  @override
  ConsumerState<ConversationPage> createState() => _ConversationPageState();
}

class _ConversationPageState extends ConsumerState<ConversationPage> {
  final ScrollController _scrollController = ScrollController();
  final TextEditingController _messageController = TextEditingController();
  int _previousMessageCount = 0;
  bool _isAtBottom = true;

  @override
  void initState() {
    super.initState();
    // 监听滚动位置
    _scrollController.addListener(_onScrollChanged);
    // 加载聊天记录
    Future.microtask(() async {
      await ref.read(messagesProvider(widget.userId).notifier).loadMessages();
      // 加载完成后滚动到底部
      _scrollToBottomAfterBuild();
    });
  }
  
  void _onScrollChanged() {
    if (_scrollController.hasClients) {
      final maxScroll = _scrollController.position.maxScrollExtent;
      final currentScroll = _scrollController.position.pixels;
      // 距离底部 50 像素以内认为在底部
      _isAtBottom = (maxScroll - currentScroll) <= 50;
    }
  }

  void _scrollToBottomAfterBuild() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Future.delayed(const Duration(milliseconds: 100), () {
        if (_scrollController.hasClients) {
          _scrollController.jumpTo(_scrollController.position.maxScrollExtent);
        }
      });
    });
  }

  @override
  void dispose() {
    _scrollController.removeListener(_onScrollChanged);
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

  /// 发起通话
  void _startCall(CallType callType) {
    final authState = ref.read(authProvider);
    final currentUserId = authState.user?.id;
    
    if (currentUserId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('请先登录')),
      );
      return;
    }
    
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (context) => CallPage(
          callerId: currentUserId,
          targetUserId: widget.userId,
          targetName: widget.username,
          callType: callType,
          isIncoming: false,
        ),
      ),
    );
  }

  Future<void> _sendMessage() async {
    final content = _messageController.text.trim();
    if (content.isEmpty) return;

    _messageController.clear();
    
    await ref.read(messagesProvider(widget.userId).notifier).sendMessage(
      content: content,
      receiverId: widget.userId,
    );

    _scrollToBottom();
  }

  @override
  Widget build(BuildContext context) {
    final messagesAsync = ref.watch(messagesProvider(widget.userId));
    final authState = ref.watch(authProvider);
    final currentUserId = authState.user?.id;
    final currentUserAvatar = authState.user?.avatar;
    
    // 监听消息数量变化，自动滚动
    messagesAsync.whenData((messages) {
      if (messages.length > _previousMessageCount && _isAtBottom) {
        // 有新消息且当前在底部，自动滚动
        WidgetsBinding.instance.addPostFrameCallback((_) {
          _scrollToBottom();
        });
      }
      _previousMessageCount = messages.length;
    });

    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            AvatarWidget(
              url: widget.avatar,
              name: widget.username,
              size: 36,
            ),
            const SizedBox(width: AppDimens.spacing12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    widget.username,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  // TODO: 显示在线状态
                ],
              ),
            ),
          ],
        ),
        actions: [
          // 语音通话
          IconButton(
            icon: const Icon(Icons.call),
            tooltip: '语音通话',
            onPressed: () => _startCall(CallType.audio),
          ),
          // 视频通话
          IconButton(
            icon: const Icon(Icons.videocam),
            tooltip: '视频通话',
            onPressed: () => _startCall(CallType.video),
          ),
          // 更多选项
          IconButton(
            icon: const Icon(Icons.more_vert),
            onPressed: () {
              // TODO: 更多选项
            },
          ),
        ],
      ),
      body: Container(
        color: const Color(0xFFEDEDED), // QQ 风格灰色背景
        child: Column(
          children: [
            // 消息列表
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
                            style: TextStyle(
                              color: AppColors.textHint,
                            ),
                          ),
                          const SizedBox(height: AppDimens.spacing8),
                          Text(
                            '发送一条消息开始聊天吧',
                            style: TextStyle(
                              color: AppColors.textHint,
                              fontSize: 12,
                            ),
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
                      
                      // 显示时间分割线
                      Widget? timeWidget;
                      if (index == 0 || _shouldShowTime(messages[index - 1].timestamp, message.timestamp)) {
                        timeWidget = _buildTimeWidget(message.timestamp);
                      }
                      
                      return Column(
                        children: [
                          if (timeWidget != null) timeWidget,
                          MessageBubble(
                            message: message,
                            isSelf: isSelf,
                            showAvatar: true,
                            selfAvatar: currentUserAvatar,
                            otherAvatar: widget.avatar,
                            otherName: widget.username,
                          ),
                        ],
                      );
                    },
                  );
                },
                loading: () => const Center(
                  child: CircularProgressIndicator(),
                ),
                error: (error, stack) => Center(
                  child: Text('加载失败: $error'),
                ),
              ),
            ),

            // 输入框
            ChatInput(
              controller: _messageController,
              onSend: _sendMessage,
              onAttachment: () {
                // TODO: 发送附件
              },
            ),
          ],
        ),
      ),
    );
  }
  
  /// 是否显示时间（超过 5 分钟显示）
  bool _shouldShowTime(DateTime? previous, DateTime? current) {
    if (previous == null || current == null) return true;
    return current.difference(previous).inMinutes > 5;
  }
  
  /// 构建时间分割线
  Widget _buildTimeWidget(DateTime? time) {
    if (time == null) return const SizedBox.shrink();
    
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final messageDate = DateTime(time.year, time.month, time.day);
    
    String timeStr;
    if (messageDate == today) {
      timeStr = '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';
    } else if (messageDate == today.subtract(const Duration(days: 1))) {
      timeStr = '昨天 ${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';
    } else {
      timeStr = '${time.month}/${time.day} ${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';
    }
    
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppDimens.spacing12),
      child: Text(
        timeStr,
        style: TextStyle(
          fontSize: 12,
          color: AppColors.textHint,
        ),
      ),
    );
  }
}
