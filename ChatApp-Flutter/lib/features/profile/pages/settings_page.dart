import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/app_constants.dart';
import '../../auth/providers/auth_provider.dart';

/// 设置页面
class SettingsPage extends ConsumerWidget {
  const SettingsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('设置'),
      ),
      body: ListView(
        children: [
          _buildSection(
            title: '账号与安全',
            children: [
              _buildMenuItem(
                icon: Icons.security,
                title: '账号安全',
                onTap: () {},
              ),
              _buildMenuItem(
                icon: Icons.phone_android,
                title: '手机号',
                onTap: () {},
              ),
            ],
          ),
          _buildSection(
            title: '通用',
            children: [
              _buildMenuItem(
                icon: Icons.notifications_outlined,
                title: '新消息通知',
                onTap: () {},
              ),
              _buildMenuItem(
                icon: Icons.palette_outlined,
                title: '主题',
                onTap: () {},
              ),
              _buildMenuItem(
                icon: Icons.language,
                title: '语言',
                onTap: () {},
              ),
              _buildMenuItem(
                icon: Icons.cleaning_services_outlined,
                title: '清除缓存',
                onTap: () {},
              ),
            ],
          ),
          _buildSection(
            title: '关于',
            children: [
              _buildMenuItem(
                icon: Icons.info_outline,
                title: '关于智穗语聊',
                onTap: () {},
              ),
              _buildMenuItem(
                icon: Icons.description_outlined,
                title: '用户协议',
                onTap: () {},
              ),
              _buildMenuItem(
                icon: Icons.privacy_tip_outlined,
                title: '隐私政策',
                onTap: () {},
              ),
            ],
          ),
          const SizedBox(height: AppDimens.spacing24),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppDimens.spacing16),
            child: OutlinedButton(
              onPressed: () => _showLogoutDialog(context, ref),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.error,
                side: const BorderSide(color: AppColors.error),
              ),
              child: const Text('退出登录'),
            ),
          ),
          const SizedBox(height: AppDimens.spacing24),
        ],
      ),
    );
  }

  Widget _buildSection({
    required String title,
    required List<Widget> children,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(
            AppDimens.spacing16,
            AppDimens.spacing16,
            AppDimens.spacing16,
            AppDimens.spacing8,
          ),
          child: Text(
            title,
            style: TextStyle(
              fontSize: 12,
              color: AppColors.textSecondary,
            ),
          ),
        ),
        ...children,
        const Divider(height: 1),
      ],
    );
  }

  Widget _buildMenuItem({
    required IconData icon,
    required String title,
    required VoidCallback onTap,
    Widget? trailing,
  }) {
    return ListTile(
      leading: Icon(icon, size: 22),
      title: Text(title),
      trailing: trailing ?? const Icon(Icons.chevron_right, size: 20),
      onTap: onTap,
    );
  }

  void _showLogoutDialog(BuildContext context, WidgetRef ref) {
    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('退出登录'),
        content: const Text('确定要退出登录吗？'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('取消'),
          ),
          TextButton(
            onPressed: () async {
              Navigator.pop(dialogContext); // 先关闭弹窗
              await ref.read(authProvider.notifier).logout();
              // authProvider 状态变化会自动切换到登录页
            },
            child: Text(
              '退出',
              style: TextStyle(color: AppColors.error),
            ),
          ),
        ],
      ),
    );
  }
}
