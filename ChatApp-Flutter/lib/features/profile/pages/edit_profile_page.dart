import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:dio/dio.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/api/api_client.dart';
import '../../../widgets/avatar_widget.dart';
import '../../auth/providers/auth_provider.dart';

/// 个人资料编辑页面
class EditProfilePage extends ConsumerStatefulWidget {
  const EditProfilePage({super.key});

  @override
  ConsumerState<EditProfilePage> createState() => _EditProfilePageState();
}

class _EditProfilePageState extends ConsumerState<EditProfilePage> {
  final _nicknameController = TextEditingController();
  final _bioController = TextEditingController();
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    final user = ref.read(authProvider).user;
    if (user != null) {
      _nicknameController.text = user.nickname ?? '';
      _bioController.text = user.bio ?? '';
    }
  }

  @override
  void dispose() {
    _nicknameController.dispose();
    _bioController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final nickname = _nicknameController.text.trim();
    if (nickname.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('昵称不能为空')),
      );
      return;
    }

    setState(() => _isLoading = true);

    try {
      final user = ref.read(authProvider).user;
      if (user == null) throw Exception('用户未登录');

      final apiClient = ref.read(apiClientProvider);
      final response = await apiClient.put(
        '/api/users/${user.id}',
        data: {
          'nickname': nickname,
          'bio': _bioController.text.trim(),
        },
      );

      if (response.statusCode == 200) {
        // 更新本地用户信息
        ref.read(authProvider.notifier).updateUser(
          user.copyWith(
            nickname: nickname,
            bio: _bioController.text.trim(),
          ),
        );
        
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('保存成功')),
          );
          Navigator.of(context).pop();
        }
      } else {
        throw Exception('保存失败');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('保存失败: $e')),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user;

    return Scaffold(
      appBar: AppBar(
        title: const Text('编辑资料'),
        actions: [
          TextButton(
            onPressed: _isLoading ? null : _save,
            child: _isLoading
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('保存'),
          ),
        ],
      ),
      body: ListView(
        children: [
          // 头像
          Container(
            padding: const EdgeInsets.symmetric(vertical: AppDimens.spacing24),
            child: Center(
              child: Stack(
                children: [
                  AvatarWidget(
                    url: user?.avatar,
                    name: user?.displayName,
                    size: 80,
                  ),
                  Positioned(
                    bottom: 0,
                    right: 0,
                    child: GestureDetector(
                      onTap: _changeAvatar,
                      child: Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: AppColors.primary,
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 2),
                        ),
                        child: const Icon(
                          Icons.camera_alt,
                          size: 16,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const Divider(),

          // 昵称
          ListTile(
            title: const Text('昵称'),
            subtitle: TextField(
              controller: _nicknameController,
              decoration: const InputDecoration(
                hintText: '请输入昵称',
                border: InputBorder.none,
              ),
              maxLength: 20,
            ),
          ),
          const Divider(height: 1),

          // 智穗号
          ListTile(
            title: const Text('智穗号'),
            trailing: Text(
              user?.zsNumber?.toString() ?? '-',
              style: TextStyle(color: AppColors.textSecondary),
            ),
          ),
          const Divider(height: 1),

          // 个性签名
          ListTile(
            title: const Text('个性签名'),
            subtitle: TextField(
              controller: _bioController,
              decoration: const InputDecoration(
                hintText: '介绍一下自己吧',
                border: InputBorder.none,
              ),
              maxLines: 3,
              maxLength: 100,
            ),
          ),
          const Divider(height: 1),

          // 性别
          ListTile(
            title: const Text('性别'),
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  _getGenderText(user?.gender),
                  style: TextStyle(color: AppColors.textSecondary),
                ),
                const Icon(Icons.chevron_right),
              ],
            ),
            onTap: _changeGender,
          ),
          const Divider(height: 1),

          // 地区
          ListTile(
            title: const Text('地区'),
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  user?.region ?? '未设置',
                  style: TextStyle(color: AppColors.textSecondary),
                ),
                const Icon(Icons.chevron_right),
              ],
            ),
            onTap: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('地区选择功能开发中...')),
              );
            },
          ),
        ],
      ),
    );
  }

  String _getGenderText(int? gender) {
    switch (gender) {
      case 1:
        return '男';
      case 2:
        return '女';
      default:
        return '未设置';
    }
  }

  void _changeAvatar() {
    showModalBottomSheet(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.camera_alt),
              title: const Text('拍照'),
              onTap: () {
                Navigator.pop(context);
                _pickImage(ImageSource.camera);
              },
            ),
            ListTile(
              leading: const Icon(Icons.photo_library),
              title: const Text('从相册选择'),
              onTap: () {
                Navigator.pop(context);
                _pickImage(ImageSource.gallery);
              },
            ),
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

  Future<void> _pickImage(ImageSource source) async {
    try {
      final picker = ImagePicker();
      final pickedFile = await picker.pickImage(
        source: source,
        maxWidth: 800,
        maxHeight: 800,
        imageQuality: 85,
      );

      if (pickedFile == null) return;

      setState(() => _isLoading = true);

      final user = ref.read(authProvider).user;
      if (user == null) throw Exception('用户未登录');

      // 上传头像
      final apiClient = ref.read(apiClientProvider);
      final formData = FormData.fromMap({
        'file': await MultipartFile.fromFile(
          pickedFile.path,
          filename: 'avatar.jpg',
        ),
      });

      final response = await apiClient.post(
        '/api/users/${user.id}/avatar',
        data: formData,
      );

      if (response.statusCode == 200) {
        final newAvatar = response.data['avatar'] as String?;
        if (newAvatar != null) {
          // 清除旧头像缓存
          final oldAvatar = user.avatar;
          if (oldAvatar != null && oldAvatar.isNotEmpty) {
            final oldUrl = oldAvatar.startsWith('http')
                ? oldAvatar
                : 'https://msg.v2.zhsdev.top$oldAvatar';
            await CachedNetworkImage.evictFromCache(oldUrl);
          }
          // 清除新头像缓存（确保加载最新）
          final newUrl = newAvatar.startsWith('http')
              ? newAvatar
              : 'https://msg.v2.zhsdev.top$newAvatar';
          await CachedNetworkImage.evictFromCache(newUrl);
          
          // 使用新的方法更新头像（强制UI刷新）
          ref.read(authProvider.notifier).updateAvatar(newAvatar);
        }
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('头像更新成功')),
          );
        }
      } else {
        throw Exception('上传失败');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('头像更新失败: $e')),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  void _changeGender() {
    showModalBottomSheet(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              title: const Center(child: Text('男')),
              onTap: () {
                Navigator.pop(context);
                // TODO: 更新性别
              },
            ),
            const Divider(height: 1),
            ListTile(
              title: const Center(child: Text('女')),
              onTap: () {
                Navigator.pop(context);
                // TODO: 更新性别
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
}
