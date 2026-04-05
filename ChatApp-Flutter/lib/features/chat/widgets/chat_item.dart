import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'dart:convert';
import '../../../core/constants/app_constants.dart';
import '../providers/chat_provider.dart';

/// 会话列表项
class ChatItem extends StatelessWidget {
  final ChatSession session;
  final VoidCallback onTap;

  const ChatItem({
    super.key,
    required this.session,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      onTap: onTap,
      leading: _buildAvatar(),
      title: Row(
        children: [
          Expanded(
            child: Text(
              session.displayName,
              style: const TextStyle(
                fontWeight: FontWeight.w500,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          if (session.lastMessageTime != null)
            Text(
              _formatTime(session.lastMessageTime!),
              style: TextStyle(
                fontSize: 12,
                color: AppColors.textHint,
              ),
            ),
        ],
      ),
      subtitle: Row(
        children: [
          Expanded(
            child: Text(
              _formatLastMessage(session.lastMessage ?? '暂无消息'),
              style: TextStyle(
                fontSize: 14,
                color: AppColors.textSecondary,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          if (session.unreadCount > 0)
            Container(
              padding: const EdgeInsets.symmetric(
                horizontal: 6,
                vertical: 2,
              ),
              decoration: BoxDecoration(
                color: AppColors.error,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                session.unreadCount > 99
                    ? '99+'
                    : session.unreadCount.toString(),
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 12,
                ),
              ),
            ),
        ],
      ),
      contentPadding: const EdgeInsets.symmetric(
        horizontal: AppDimens.spacing16,
        vertical: AppDimens.spacing8,
      ),
    );
  }

  Widget _buildAvatar() {
    final avatarUrl = session.avatar;
    
    if (avatarUrl != null && avatarUrl.isNotEmpty) {
      final fullUrl = avatarUrl.startsWith('http')
          ? avatarUrl
          : 'https://api.zhsidc.com$avatarUrl';
      
      return ClipOval(
        child: CachedNetworkImage(
          imageUrl: fullUrl,
          width: AppDimens.avatarMedium,
          height: AppDimens.avatarMedium,
          fit: BoxFit.cover,
          placeholder: (context, url) => _buildPlaceholder(),
          errorWidget: (context, url, error) => _buildPlaceholder(),
        ),
      );
    }
    
    return _buildPlaceholder();
  }

  Widget _buildPlaceholder() {
    return Container(
      width: AppDimens.avatarMedium,
      height: AppDimens.avatarMedium,
      decoration: BoxDecoration(
        color: AppColors.primary,
        shape: BoxShape.circle,
      ),
      child: Center(
        child: Text(
          session.displayName.isNotEmpty
              ? session.displayName[0].toUpperCase()
              : '?',
          style: const TextStyle(
            color: Colors.white,
            fontSize: 20,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
    );
  }

  String _formatTime(DateTime time) {
    final now = DateTime.now();
    final diff = now.difference(time);

    if (diff.inDays == 0) {
      return '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';
    } else if (diff.inDays == 1) {
      return '昨天';
    } else if (diff.inDays < 7) {
      const weekdays = ['一', '二', '三', '四', '五', '六', '日'];
      return '周${weekdays[time.weekday - 1]}';
    } else {
      return '${time.month}/${time.day}';
    }
  }

  /// 格式化最后一条消息
  String _formatLastMessage(String message) {
    if (message == '暂无消息') {
      return message;
    }

    // 尝试解析 JSON 消息
    try {
      // 检查是否以 { 开始，可能是 JSON
      if (message.trim().startsWith('{')) {
        final json = jsonDecode(message);
        
        // 检查 mediaType 字段
        if (json.containsKey('mediaType')) {
          final mediaType = json['mediaType'].toString().toUpperCase();
          switch (mediaType) {
            case 'IMAGE':
              return '[图片]';
            case 'VIDEO':
              return '[视频]';
            case 'FILE':
              return '[文件]';
            case 'AUDIO':
              return '[语音]';
            default:
              break;
          }
        }
        
        // 通话消息
        if (json.containsKey('callType')) {
          return '[通话]';
        }
        
        // 兼容旧的判断方式
        if (json.containsKey('imageUrl') || json.containsKey('thumbnailUrl')) {
          return '[图片]';
        }
        
        if (json.containsKey('videoUrl')) {
          return '[视频]';
        }
        
        if (json.containsKey('fileUrl') || json.containsKey('fileName')) {
          return '[文件]';
        }
      }
    } catch (e) {
      // 如果解析失败，直接返回原文本
    }

    return message;
  }
}
