import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/services/translate_service.dart';
import '../../../core/utils/link_util.dart';
import '../../../models/message.dart';
import '../pages/image_viewer_page.dart';
import '../pages/video_player_page.dart';
import '../pages/file_download_page.dart';

/// 消息气泡 - QQ 风格
class MessageBubble extends StatelessWidget {
  final Message message;
  final bool isSelf;
  final bool showAvatar;
  final String? selfAvatar;
  final String? otherAvatar;
  final String? otherName;

  const MessageBubble({
    super.key,
    required this.message,
    required this.isSelf,
    this.showAvatar = true,
    this.selfAvatar,
    this.otherAvatar,
    this.otherName,
  });

  @override
  Widget build(BuildContext context) {
    // 系统消息居中显示
    if (message.messageType == MessageType.system) {
      return _buildSystemContent();
    }
    
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppDimens.spacing6),
      child: Row(
        mainAxisAlignment: isSelf ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 对方头像（左边）
          if (!isSelf && showAvatar) ...[          
            _buildAvatar(otherAvatar, otherName ?? message.senderName),
            const SizedBox(width: AppDimens.spacing8),
          ],
          if (!isSelf && !showAvatar)
            const SizedBox(width: 40), // 占位
          
          // 消息内容
          Flexible(
            child: Column(
              crossAxisAlignment: isSelf ? CrossAxisAlignment.end : CrossAxisAlignment.start,
              children: [
                GestureDetector(
                  onLongPress: () => _showContextMenu(context),
                  child: Container(
                    constraints: BoxConstraints(
                      maxWidth: MediaQuery.of(context).size.width * 0.65,
                    ),
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppDimens.spacing12,
                      vertical: AppDimens.spacing10,
                    ),
                    decoration: BoxDecoration(
                      color: isSelf 
                          ? const Color(0xFF95EC69)  // 微信绿色
                          : Colors.white,
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
                    child: _buildContent(),
                  ),
                ),
              ],
            ),
          ),
          
          // 自己的头像（右边）
          if (isSelf && showAvatar) ...[          
            const SizedBox(width: AppDimens.spacing8),
            _buildAvatar(selfAvatar, null),
          ],
          if (isSelf && !showAvatar)
            const SizedBox(width: 40), // 占位
        ],
      ),
    );
  }
  
  void _showContextMenu(BuildContext context) {
    if (message.messageType != MessageType.text) return;
    if (message.isRecalled == true) return;
    
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // 复制
            ListTile(
              leading: const Icon(Icons.copy),
              title: const Text('复制'),
              onTap: () {
                Clipboard.setData(ClipboardData(text: message.content));
                Navigator.pop(context);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('已复制到剪贴板')),
                );
              },
            ),
            // 翻译
            ListTile(
              leading: const Icon(Icons.translate),
              title: const Text('翻译'),
              onTap: () {
                Navigator.pop(context);
                _translateMessage(context, message.content);
              },
            ),
            const Divider(height: 1),
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
  
  void _translateMessage(BuildContext context, String text) async {
    // 显示加载对话框
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => const Center(
        child: CircularProgressIndicator(),
      ),
    );
    
    // 调用翻译API
    final result = await TranslateService.autoTranslate(text);
    
    // 关闭加载对话框
    if (context.mounted) {
      Navigator.pop(context);
    }
    
    if (result.success && context.mounted) {
      // 显示翻译结果
      showDialog(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('翻译结果'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('原文:', style: TextStyle(color: AppColors.textHint, fontSize: 12)),
              const SizedBox(height: 4),
              Text(result.originalText),
              const SizedBox(height: 12),
              Text('译文:', style: TextStyle(color: AppColors.textHint, fontSize: 12)),
              const SizedBox(height: 4),
              SelectableText(
                result.translatedText ?? '',
                style: const TextStyle(color: AppColors.primary),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () {
                Clipboard.setData(ClipboardData(text: result.translatedText ?? ''));
                Navigator.pop(context);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('译文已复制')),
                );
              },
              child: const Text('复制译文'),
            ),
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('关闭'),
            ),
          ],
        ),
      );
    } else if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('翻译失败: ${result.error}')),
      );
    }
  }

  Widget _buildAvatar(String? avatarUrl, String? name) {
    if (avatarUrl != null && avatarUrl.isNotEmpty) {
      final url = avatarUrl.startsWith('http')
          ? avatarUrl
          : 'https://msg.v2.zhsdev.top$avatarUrl';
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

    // 默认头像
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

  Widget _buildContent() {
    // 尝试解析 JSON 媒体消息
    final mediaData = _tryParseMediaJson(message.content);
    if (mediaData != null) {
      final mediaType = mediaData['mediaType'] as String?;
      final callType = mediaData['callType'] as String?;
      
      // 通话消息
      if (callType == 'call') {
        return _buildCallContent(mediaData);
      }
      
      switch (mediaType) {
        case 'image':
          return _buildMediaImageContent(mediaData);
        case 'video':
          return _buildVideoContent(mediaData);
        case 'file':
          return _buildMediaFileContent(mediaData);
      }
    }
    
    switch (message.messageType) {
      case MessageType.image:
        return _buildImageContent();
      case MessageType.file:
        return _buildFileContent();
      case MessageType.audio:
        return _buildAudioContent();
      case MessageType.system:
        return _buildSystemContent();
      case MessageType.call:
        // 尝试解析通话数据
        final callData = _tryParseMediaJson(message.content);
        if (callData != null) {
          return _buildCallContent(callData);
        }
        return _buildTextContent();
      default:
        return _buildTextContent();
    }
  }
  
  /// 尝试解析媒体 JSON
  Map<String, dynamic>? _tryParseMediaJson(String content) {
    if (!content.startsWith('{')) return null;
    try {
      final data = jsonDecode(content) as Map<String, dynamic>;
      if (data.containsKey('mediaType') || data.containsKey('url') || data.containsKey('callType')) {
        return data;
      }
    } catch (_) {}
    return null;
  }
  
  /// 构建通话消息内容
  Widget _buildCallContent(Map<String, dynamic> data) {
    final status = data['status'] as String? ?? 'cancelled';
    final duration = data['duration'] as int? ?? 0;
    final isVideo = data['isVideo'] as bool? ?? false;
    
    // 根据状态确定显示内容
    String statusText;
    IconData icon;
    Color iconColor;
    
    switch (status) {
      case 'connected':
        statusText = '通话时长 ${_formatCallDuration(duration)}';
        icon = isVideo ? Icons.videocam : Icons.phone;
        iconColor = const Color(0xFF4CAF50);  // 绿色
        break;
      case 'missed':
        statusText = '对方未接听';
        icon = isVideo ? Icons.videocam_off : Icons.phone_missed;
        iconColor = const Color(0xFF9E9E9E);  // 灰色
        break;
      case 'rejected':
        statusText = '对方已拒绝';
        icon = isVideo ? Icons.videocam_off : Icons.phone_missed;
        iconColor = const Color(0xFF9E9E9E);  // 灰色
        break;
      case 'cancelled':
      default:
        statusText = '已取消，点击重拨';
        icon = isVideo ? Icons.videocam_off : Icons.phone_missed;
        iconColor = const Color(0xFF9E9E9E);  // 灰色
        break;
    }
    
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 20, color: iconColor),
        const SizedBox(width: 8),
        Text(
          statusText,
          style: TextStyle(
            color: isSelf ? Colors.black87 : AppColors.textPrimary,
            fontSize: 14,
          ),
        ),
      ],
    );
  }
  
  /// 格式化通话时长
  String _formatCallDuration(int seconds) {
    final mins = seconds ~/ 60;
    final secs = seconds % 60;
    return '${mins.toString().padLeft(2, '0')}:${secs.toString().padLeft(2, '0')}';
  }
  
  /// 构建媒体图片内容
  Widget _buildMediaImageContent(Map<String, dynamic> data) {
    final url = data['url'] as String? ?? '';
    final name = data['name'] as String? ?? '图片';
    
    return Builder(
      builder: (context) => GestureDetector(
        onTap: () {
          // 跳转到图片查看器
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => ImageViewerPage(
                imageUrl: url,
                imageName: name,
              ),
            ),
          );
        },
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(AppDimens.radiusMedium),
              child: Image.network(
                url,
                fit: BoxFit.cover,
                width: 200,
                loadingBuilder: (context, child, loadingProgress) {
                  if (loadingProgress == null) return child;
                  return Container(
                    width: 200,
                    height: 150,
                    color: AppColors.surfaceVariant,
                    child: const Center(child: CircularProgressIndicator()),
                  );
                },
                errorBuilder: (context, error, stackTrace) {
                  return Container(
                    width: 200,
                    height: 150,
                    color: AppColors.surfaceVariant,
                    child: const Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.broken_image, size: 32),
                        SizedBox(height: 4),
                        Text('加载失败', style: TextStyle(fontSize: 12)),
                      ],
                    ),
                  );
                },
              ),
            ),
            const SizedBox(height: 4),
            Text(
              name,
              style: TextStyle(fontSize: 11, color: AppColors.textHint),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
  
  /// 构建视频内容
  Widget _buildVideoContent(Map<String, dynamic> data) {
    final url = data['url'] as String? ?? '';
    final name = data['name'] as String? ?? '视频';
    final size = data['size'] as int? ?? 0;
    
    return Builder(
      builder: (context) => GestureDetector(
        onTap: () {
          // 跳转到视频播放器
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => VideoPlayerPage(
                videoUrl: url,
                videoName: name,
              ),
            ),
          );
        },
        child: Container(
          width: 220,
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: isSelf ? Colors.white.withOpacity(0.2) : AppColors.surfaceVariant,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: Colors.blue.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.play_circle_fill, color: Colors.blue, size: 32),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 14),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _formatFileSize(size),
                      style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
  
  /// 构建媒体文件内容
  Widget _buildMediaFileContent(Map<String, dynamic> data) {
    final url = data['url'] as String? ?? '';
    final name = data['name'] as String? ?? '文件';
    final size = data['size'] as int? ?? 0;
    final type = data['type'] as String? ?? '';
    
    // 根据文件类型选择图标
    IconData icon;
    Color iconColor;
    if (type.contains('pdf')) {
      icon = Icons.picture_as_pdf;
      iconColor = Colors.red;
    } else if (type.contains('word') || type.contains('doc')) {
      icon = Icons.description;
      iconColor = Colors.blue;
    } else if (type.contains('excel') || type.contains('sheet')) {
      icon = Icons.table_chart;
      iconColor = Colors.green;
    } else if (type.contains('zip') || type.contains('rar') || type.contains('7z')) {
      icon = Icons.folder_zip;
      iconColor = Colors.orange;
    } else {
      icon = Icons.insert_drive_file;
      iconColor = Colors.grey;
    }
    
    return Builder(
      builder: (context) => GestureDetector(
        onTap: () {
          // 跳转到文件下载页面
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => FileDownloadPage(
                fileUrl: url,
                fileName: name,
                fileSize: size,
              ),
            ),
          );
        },
        child: Container(
          width: 220,
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: isSelf ? Colors.white.withOpacity(0.2) : AppColors.surfaceVariant,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: iconColor.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, color: iconColor, size: 28),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 14),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _formatFileSize(size),
                      style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.download, size: 20, color: Colors.grey),
            ],
          ),
        ),
      ),
    );
  }
  
  Future<void> _openUrl(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  Widget _buildTextContent() {
    if (message.isRecalled == true) {
      return Text(
        '消息已撤回',
        style: TextStyle(
          color: AppColors.textHint,
          fontStyle: FontStyle.italic,
        ),
      );
    }

    final textStyle = TextStyle(
      color: isSelf ? Colors.black87 : AppColors.textPrimary,
      fontSize: 15,
    );

    // 检测是否包含链接
    if (LinkUtil.containsLink(message.content)) {
      return Text.rich(
        LinkUtil.buildLinkTextSpan(
          text: message.content,
          normalStyle: textStyle,
          linkStyle: textStyle.copyWith(
            color: isSelf ? const Color(0xFF0066CC) : AppColors.primary,
            decoration: TextDecoration.underline,
          ),
        ),
      );
    }

    return Text(
      message.content,
      style: textStyle,
    );
  }

  Widget _buildImageContent() {
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppDimens.radiusMedium),
      child: Image.network(
        message.content.startsWith('http')
            ? message.content
            : 'https://msg.v2.zhsdev.top${message.content}',
        fit: BoxFit.cover,
        width: 200,
        loadingBuilder: (context, child, loadingProgress) {
          if (loadingProgress == null) return child;
          return Container(
            width: 200,
            height: 150,
            color: AppColors.surfaceVariant,
            child: const Center(
              child: CircularProgressIndicator(),
            ),
          );
        },
        errorBuilder: (context, error, stackTrace) {
          return Container(
            width: 200,
            height: 150,
            color: AppColors.surfaceVariant,
            child: const Center(
              child: Icon(Icons.broken_image),
            ),
          );
        },
      ),
    );
  }

  Widget _buildFileContent() {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(Icons.insert_drive_file, size: 32),
        const SizedBox(width: AppDimens.spacing8),
        Flexible(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                message.fileName ?? '文件',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontWeight: FontWeight.w500),
              ),
              if (message.fileSize != null)
                Text(
                  _formatFileSize(message.fileSize!),
                  style: TextStyle(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildAudioContent() {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(Icons.mic, size: 20),
        const SizedBox(width: AppDimens.spacing8),
        Text(
          '语音消息',
          style: TextStyle(color: AppColors.textPrimary),
        ),
      ],
    );
  }

  Widget _buildSystemContent() {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppDimens.spacing8),
      child: Center(
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: AppDimens.spacing12,
            vertical: AppDimens.spacing4,
          ),
          decoration: BoxDecoration(
            color: Colors.black.withOpacity(0.1),
            borderRadius: BorderRadius.circular(AppDimens.radiusSmall),
          ),
          child: Text(
            message.content,
            style: TextStyle(
              fontSize: 12,
              color: AppColors.textSecondary,
            ),
          ),
        ),
      ),
    );
  }

  String _formatFileSize(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
  }
}
