import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/app_constants.dart';
import '../providers/moments_provider.dart';

/// 发布动态页面
class CreateMomentPage extends ConsumerStatefulWidget {
  const CreateMomentPage({super.key});

  @override
  ConsumerState<CreateMomentPage> createState() => _CreateMomentPageState();
}

class _CreateMomentPageState extends ConsumerState<CreateMomentPage> {
  final _contentController = TextEditingController();
  final List<String> _selectedImages = [];
  bool _isPosting = false;

  @override
  void dispose() {
    _contentController.dispose();
    super.dispose();
  }

  Future<void> _post() async {
    final content = _contentController.text.trim();
    if (content.isEmpty && _selectedImages.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('请输入内容或选择图片')),
      );
      return;
    }

    setState(() => _isPosting = true);

    try {
      final moment = await ref.read(momentsProvider.notifier).createMoment(
        content: content,
        images: _selectedImages.isNotEmpty ? _selectedImages : null,
      );

      if (moment != null && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('发布成功')),
        );
        Navigator.of(context).pop(true);
      } else {
        throw Exception('发布失败');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('发布失败: $e')),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isPosting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('发布动态'),
        actions: [
          TextButton(
            onPressed: _isPosting ? null : _post,
            child: _isPosting
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('发布'),
          ),
        ],
      ),
      body: SingleChildScrollView(
        child: Column(
          children: [
            // 内容输入
            Padding(
              padding: const EdgeInsets.all(AppDimens.spacing16),
              child: TextField(
                controller: _contentController,
                maxLines: 8,
                maxLength: 500,
                decoration: const InputDecoration(
                  hintText: '这一刻的想法...',
                  border: InputBorder.none,
                ),
              ),
            ),

            const Divider(),

            // 图片选择区域
            if (_selectedImages.isNotEmpty)
              Padding(
                padding: const EdgeInsets.all(AppDimens.spacing16),
                child: GridView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 3,
                    crossAxisSpacing: 8,
                    mainAxisSpacing: 8,
                  ),
                  itemCount: _selectedImages.length + 1,
                  itemBuilder: (context, index) {
                    if (index == _selectedImages.length) {
                      return _buildAddButton();
                    }
                    return _buildImageItem(index);
                  },
                ),
              ),

            // 功能按钮
            ListTile(
              leading: Icon(Icons.photo_library, color: AppColors.success),
              title: const Text('图片'),
              trailing: Text(
                '${_selectedImages.length}/9',
                style: TextStyle(color: AppColors.textSecondary),
              ),
              onTap: _selectImages,
            ),
            const Divider(height: 1),
            ListTile(
              leading: Icon(Icons.location_on, color: AppColors.warning),
              title: const Text('所在位置'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('位置功能开发中...')),
                );
              },
            ),
            const Divider(height: 1),
            ListTile(
              leading: Icon(Icons.alternate_email, color: AppColors.primary),
              title: const Text('提醒谁看'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('@功能开发中...')),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAddButton() {
    return GestureDetector(
      onTap: _selectImages,
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.surfaceVariant,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Icon(
          Icons.add,
          size: 40,
          color: AppColors.textHint,
        ),
      ),
    );
  }

  Widget _buildImageItem(int index) {
    return Stack(
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: Image.network(
            _selectedImages[index],
            fit: BoxFit.cover,
            width: double.infinity,
            height: double.infinity,
          ),
        ),
        Positioned(
          top: 4,
          right: 4,
          child: GestureDetector(
            onTap: () {
              setState(() {
                _selectedImages.removeAt(index);
              });
            },
            child: Container(
              padding: const EdgeInsets.all(2),
              decoration: BoxDecoration(
                color: Colors.black.withOpacity(0.5),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.close,
                size: 16,
                color: Colors.white,
              ),
            ),
          ),
        ),
      ],
    );
  }

  void _selectImages() {
    // TODO: 实现图片选择功能
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('图片选择功能需要 image_picker 插件')),
    );
  }
}
