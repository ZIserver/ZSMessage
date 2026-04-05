import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';
import 'dart:io';
import '../../../core/constants/app_constants.dart';

/// 文件下载保存页面
class FileDownloadPage extends StatefulWidget {
  final String fileUrl;
  final String fileName;
  final int fileSize;

  const FileDownloadPage({
    super.key,
    required this.fileUrl,
    required this.fileName,
    this.fileSize = 0,
  });

  @override
  State<FileDownloadPage> createState() => _FileDownloadPageState();
}

class _FileDownloadPageState extends State<FileDownloadPage> {
  double _progress = 0.0;
  bool _isDownloading = false;
  bool _isCompleted = false;
  String? _savedPath;
  String? _errorMessage;
  final Dio _dio = Dio();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('保存文件'),
        backgroundColor: AppColors.primary,
      ),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // 文件图标
            Container(
              width: 120,
              height: 120,
              decoration: BoxDecoration(
                color: AppColors.primary.withOpacity(0.1),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Icon(
                _getFileIcon(),
                size: 64,
                color: AppColors.primary,
              ),
            ),
            const SizedBox(height: 24),

            // 文件名
            Text(
              widget.fileName,
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w500,
              ),
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 8),

            // 文件大小
            if (widget.fileSize > 0)
              Text(
                _formatFileSize(widget.fileSize),
                style: TextStyle(
                  fontSize: 14,
                  color: AppColors.textSecondary,
                ),
              ),
            const SizedBox(height: 32),

            // 状态显示
            if (_errorMessage != null)
              _buildErrorState()
            else if (_isCompleted)
              _buildCompletedState()
            else if (_isDownloading)
              _buildDownloadingState()
            else
              _buildInitialState(),
          ],
        ),
      ),
    );
  }

  // 初始状态
  Widget _buildInitialState() {
    return Column(
      children: [
        ElevatedButton.icon(
          onPressed: _startDownload,
          icon: const Icon(Icons.download),
          label: const Text('保存到手机'),
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.primary,
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
        ),
      ],
    );
  }

  // 下载中状态
  Widget _buildDownloadingState() {
    return Column(
      children: [
        SizedBox(
          width: 200,
          child: LinearProgressIndicator(
            value: _progress,
            backgroundColor: AppColors.surfaceVariant,
            valueColor: AlwaysStoppedAnimation<Color>(AppColors.primary),
          ),
        ),
        const SizedBox(height: 16),
        Text(
          '${(_progress * 100).toStringAsFixed(0)}%',
          style: TextStyle(
            fontSize: 16,
            color: AppColors.textSecondary,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          '正在下载...',
          style: TextStyle(
            fontSize: 14,
            color: AppColors.textHint,
          ),
        ),
      ],
    );
  }

  // 完成状态
  Widget _buildCompletedState() {
    return Column(
      children: [
        Container(
          width: 80,
          height: 80,
          decoration: BoxDecoration(
            color: Colors.green.withOpacity(0.1),
            shape: BoxShape.circle,
          ),
          child: const Icon(
            Icons.check_circle,
            size: 48,
            color: Colors.green,
          ),
        ),
        const SizedBox(height: 16),
        const Text(
          '保存成功',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w500,
          ),
        ),
        const SizedBox(height: 8),
        if (_savedPath != null)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Text(
              '保存位置：$_savedPath',
              style: TextStyle(
                fontSize: 12,
                color: AppColors.textSecondary,
              ),
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        const SizedBox(height: 24),
        ElevatedButton(
          onPressed: () => Navigator.pop(context),
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.primary,
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 12),
          ),
          child: const Text('完成'),
        ),
      ],
    );
  }

  // 错误状态
  Widget _buildErrorState() {
    return Column(
      children: [
        Container(
          width: 80,
          height: 80,
          decoration: BoxDecoration(
            color: Colors.red.withOpacity(0.1),
            shape: BoxShape.circle,
          ),
          child: const Icon(
            Icons.error_outline,
            size: 48,
            color: Colors.red,
          ),
        ),
        const SizedBox(height: 16),
        const Text(
          '保存失败',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w500,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          _errorMessage!,
          style: TextStyle(
            fontSize: 14,
            color: AppColors.textSecondary,
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 24),
        ElevatedButton(
          onPressed: () {
            setState(() {
              _errorMessage = null;
            });
            _startDownload();
          },
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.primary,
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 12),
          ),
          child: const Text('重试'),
        ),
      ],
    );
  }

  // 开始下载
  Future<void> _startDownload() async {
    // 请求存储权限
    if (Platform.isAndroid) {
      final status = await Permission.storage.request();
      if (!status.isGranted) {
        setState(() {
          _errorMessage = '需要存储权限才能保存文件';
        });
        return;
      }
    }

    setState(() {
      _isDownloading = true;
      _progress = 0.0;
      _errorMessage = null;
    });

    try {
      // 获取下载目录
      final Directory? directory = Platform.isAndroid
          ? await getExternalStorageDirectory()
          : await getApplicationDocumentsDirectory();

      if (directory == null) {
        throw Exception('无法获取存储目录');
      }

      // 创建 Download 子目录
      final downloadDir = Directory('${directory.path}/Download');
      if (!await downloadDir.exists()) {
        await downloadDir.create(recursive: true);
      }

      // 保存路径
      final savePath = '${downloadDir.path}/${widget.fileName}';

      // 下载文件
      await _dio.download(
        widget.fileUrl,
        savePath,
        onReceiveProgress: (received, total) {
          if (total != -1) {
            setState(() {
              _progress = received / total;
            });
          }
        },
      );

      // 下载完成
      setState(() {
        _isDownloading = false;
        _isCompleted = true;
        _savedPath = savePath;
      });
    } catch (e) {
      setState(() {
        _isDownloading = false;
        _errorMessage = '下载失败：${e.toString()}';
      });
    }
  }

  // 获取文件图标
  IconData _getFileIcon() {
    final extension = widget.fileName.split('.').last.toLowerCase();
    switch (extension) {
      case 'pdf':
        return Icons.picture_as_pdf;
      case 'doc':
      case 'docx':
        return Icons.description;
      case 'xls':
      case 'xlsx':
        return Icons.table_chart;
      case 'ppt':
      case 'pptx':
        return Icons.slideshow;
      case 'zip':
      case 'rar':
      case '7z':
        return Icons.folder_zip;
      case 'txt':
        return Icons.text_snippet;
      default:
        return Icons.insert_drive_file;
    }
  }

  // 格式化文件大小
  String _formatFileSize(int bytes) {
    if (bytes < 1024) {
      return '$bytes B';
    } else if (bytes < 1024 * 1024) {
      return '${(bytes / 1024).toStringAsFixed(1)} KB';
    } else if (bytes < 1024 * 1024 * 1024) {
      return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
    } else {
      return '${(bytes / (1024 * 1024 * 1024)).toStringAsFixed(1)} GB';
    }
  }

  @override
  void dispose() {
    _dio.close();
    super.dispose();
  }
}
