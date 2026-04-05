import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/app_constants.dart';
import '../../../widgets/avatar_widget.dart';
import '../../../models/moment.dart';
import '../../auth/providers/auth_provider.dart';
import '../providers/moments_provider.dart';
import 'create_moment_page.dart';

/// 朋友圈页面
class MomentsPage extends ConsumerStatefulWidget {
  const MomentsPage({super.key});

  @override
  ConsumerState<MomentsPage> createState() => _MomentsPageState();
}

class _MomentsPageState extends ConsumerState<MomentsPage> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(momentsProvider.notifier).loadMoments());
  }

  @override
  Widget build(BuildContext context) {
    final momentsAsync = ref.watch(momentsProvider);
    final authState = ref.watch(authProvider);
    final currentUser = authState.user;

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: () => ref.read(momentsProvider.notifier).loadMoments(),
        child: CustomScrollView(
          slivers: [
            // 头部封面
            SliverAppBar(
              expandedHeight: 200,
              pinned: true,
              flexibleSpace: FlexibleSpaceBar(
                title: const Text('朋友圈'),
                background: Stack(
                  fit: StackFit.expand,
                  children: [
                    Container(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [
                            AppColors.primary.withOpacity(0.8),
                            AppColors.primary,
                          ],
                        ),
                      ),
                    ),
                    // 用户信息
                    Positioned(
                      right: 16,
                      bottom: 56,
                      child: Row(
                        children: [
                          Text(
                            currentUser?.displayName ?? '',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 16,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                          const SizedBox(width: 8),
                          AvatarWidget(
                            url: currentUser?.avatar,
                            name: currentUser?.displayName,
                            size: 50,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              actions: [
                IconButton(
                  icon: const Icon(Icons.camera_alt),
                  onPressed: () => _navigateToCreate(),
                ),
              ],
            ),

            // 动态列表
            momentsAsync.when(
              data: (moments) {
                if (moments.isEmpty) {
                  return SliverFillRemaining(
                    child: _buildEmptyState(),
                  );
                }
                return SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (context, index) => _buildMomentItem(moments[index]),
                    childCount: moments.length,
                  ),
                );
              },
              loading: () => const SliverFillRemaining(
                child: Center(child: CircularProgressIndicator()),
              ),
              error: (error, _) => SliverFillRemaining(
                child: Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text('加载失败: $error'),
                      TextButton(
                        onPressed: () => ref.read(momentsProvider.notifier).loadMoments(),
                        child: const Text('重试'),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _navigateToCreate(),
        child: const Icon(Icons.add_a_photo),
      ),
    );
  }

  void _navigateToCreate() async {
    final result = await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const CreateMomentPage()),
    );
    if (result == true) {
      ref.read(momentsProvider.notifier).loadMoments();
    }
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.photo_library_outlined,
            size: 80,
            color: AppColors.textHint,
          ),
          const SizedBox(height: AppDimens.spacing16),
          Text(
            '暂无动态',
            style: TextStyle(
              color: AppColors.textSecondary,
              fontSize: 16,
            ),
          ),
          const SizedBox(height: AppDimens.spacing8),
          Text(
            '快去发布你的第一条动态吧',
            style: TextStyle(
              color: AppColors.textHint,
              fontSize: 14,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMomentItem(Moment moment) {
    return Container(
      padding: const EdgeInsets.all(AppDimens.spacing16),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border(
          bottom: BorderSide(color: AppColors.divider, width: 0.5),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 头像
          AvatarWidget(
            url: moment.userAvatar,
            name: moment.displayName,
            size: AppDimens.avatarMedium,
          ),
          const SizedBox(width: AppDimens.spacing12),
          // 内容
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // 用户名
                Text(
                  moment.displayName,
                  style: TextStyle(
                    color: AppColors.primary,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: AppDimens.spacing4),
                // 文字内容
                if (moment.content.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(bottom: AppDimens.spacing8),
                    child: Text(
                      moment.content,
                      style: TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 15,
                      ),
                    ),
                  ),
                // 图片
                if (moment.images.isNotEmpty) _buildImageGrid(moment.images),
                const SizedBox(height: AppDimens.spacing8),
                // 时间和操作
                Row(
                  children: [
                    Text(
                      _formatTime(moment.createdAt),
                      style: TextStyle(
                        color: AppColors.textHint,
                        fontSize: 12,
                      ),
                    ),
                    const Spacer(),
                    // 点赞
                    _buildActionButton(
                      icon: moment.isLiked ? Icons.favorite : Icons.favorite_border,
                      label: moment.likeCount > 0 ? '${moment.likeCount}' : '赞',
                      color: moment.isLiked ? Colors.red : AppColors.textSecondary,
                      onTap: () => _toggleLike(moment.id),
                    ),
                    const SizedBox(width: AppDimens.spacing16),
                    // 评论
                    _buildActionButton(
                      icon: Icons.chat_bubble_outline,
                      label: moment.commentCount > 0 ? '${moment.commentCount}' : '评论',
                      onTap: () => _showComments(moment),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildImageGrid(List<String> images) {
    final count = images.length;
    final crossAxisCount = count == 1 ? 1 : (count <= 4 ? 2 : 3);
    
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: crossAxisCount,
        crossAxisSpacing: 4,
        mainAxisSpacing: 4,
      ),
      itemCount: images.length > 9 ? 9 : images.length,
      itemBuilder: (context, index) {
        final url = images[index].startsWith('http')
            ? images[index]
            : 'https://msg.v2.zhsdev.top${images[index]}';
        return GestureDetector(
          onTap: () => _showImageViewer(images, index),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: Image.network(
              url,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => Container(
                color: AppColors.surfaceVariant,
                child: const Icon(Icons.broken_image),
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildActionButton({
    required IconData icon,
    required String label,
    Color? color,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Row(
        children: [
          Icon(icon, size: 16, color: color ?? AppColors.textSecondary),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              color: color ?? AppColors.textSecondary,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }

  String _formatTime(DateTime? time) {
    if (time == null) return '';
    final now = DateTime.now();
    final diff = now.difference(time);
    
    if (diff.inMinutes < 1) return '刚刚';
    if (diff.inMinutes < 60) return '${diff.inMinutes}分钟前';
    if (diff.inHours < 24) return '${diff.inHours}小时前';
    if (diff.inDays < 7) return '${diff.inDays}天前';
    return '${time.month}/${time.day}';
  }

  void _toggleLike(int momentId) {
    ref.read(momentsProvider.notifier).toggleLike(momentId);
  }

  void _showComments(Moment moment) {
    // TODO: 显示评论底部弹窗
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('评论功能开发中...')),
    );
  }

  void _showImageViewer(List<String> images, int index) {
    // TODO: 图片查看器
  }
}
