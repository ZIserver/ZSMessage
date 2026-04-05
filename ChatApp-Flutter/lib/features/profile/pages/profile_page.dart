import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/app_constants.dart';
import '../../../widgets/avatar_widget.dart';
import '../../../widgets/weather_widget.dart';
import '../../auth/providers/auth_provider.dart';
import 'settings_page.dart';
import 'edit_profile_page.dart';

/// 个人中心页面
class ProfilePage extends ConsumerWidget {
  const ProfilePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);
    final user = authState.user;
    final avatarCacheKey = authState.avatarCacheKey;

    return Scaffold(
      appBar: AppBar(
        title: const Text('我的'),
      ),
      body: ListView(
        children: [
          // 用户信息卡片
          GestureDetector(
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const EditProfilePage()),
              );
            },
            child: Container(
              padding: const EdgeInsets.all(AppDimens.spacing16),
              child: Row(
                children: [
                  AvatarWidget(
                    url: user?.avatar,
                    name: user?.displayName,
                    size: AppDimens.avatarXLarge,
                    cacheKey: avatarCacheKey,
                  ),
                  const SizedBox(width: AppDimens.spacing16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          user?.displayName ?? '未登录',
                          style: const TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: AppDimens.spacing4),
                        Text(
                          '智穗号: ${user?.zsNumber?.toString() ?? '-'}',
                          style: TextStyle(
                            color: AppColors.textSecondary,
                          ),
                        ),
                        if (user?.bio?.isNotEmpty == true) ...[
                          const SizedBox(height: AppDimens.spacing4),
                          Text(
                            user!.bio!,
                            style: TextStyle(
                              color: AppColors.textSecondary,
                              fontSize: 12,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ],
                    ),
                  ),
                  const Icon(Icons.qr_code, color: AppColors.textSecondary),
                  const SizedBox(width: 8),
                  const Icon(Icons.chevron_right, color: AppColors.textSecondary),
                ],
              ),
            ),
          ),
          const Divider(),

          // 天气小组件
          const WeatherWidget(),
          const SizedBox(height: AppDimens.spacing8),

          // 功能列表
          _buildMenuItem(
            icon: Icons.favorite_outline,
            title: '收藏',
            onTap: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('收藏功能开发中...')),
              );
            },
          ),
          _buildMenuItem(
            icon: Icons.photo_library_outlined,
            title: '相册',
            onTap: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('相册功能开发中...')),
              );
            },
          ),
          _buildMenuItem(
            icon: Icons.history,
            title: '通话记录',
            onTap: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('通话记录功能开发中...')),
              );
            },
          ),
          const Divider(),
          _buildMenuItem(
            icon: Icons.settings_outlined,
            title: '设置',
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const SettingsPage()),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildMenuItem({
    required IconData icon,
    required String title,
    required VoidCallback onTap,
    Widget? trailing,
  }) {
    return ListTile(
      leading: Icon(icon, color: AppColors.textPrimary),
      title: Text(title),
      trailing: trailing ?? const Icon(Icons.chevron_right),
      onTap: onTap,
    );
  }
}
