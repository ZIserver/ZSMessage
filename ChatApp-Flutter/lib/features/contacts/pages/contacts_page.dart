import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/app_constants.dart';
import '../../../widgets/avatar_widget.dart';
import '../providers/contacts_provider.dart';
import '../../chat/pages/conversation_page.dart';
import '../../groups/pages/groups_page.dart';
import 'add_friend_page.dart';
import 'friend_requests_page.dart';

/// 通讯录页面
class ContactsPage extends ConsumerStatefulWidget {
  const ContactsPage({super.key});

  @override
  ConsumerState<ContactsPage> createState() => _ContactsPageState();
}

class _ContactsPageState extends ConsumerState<ContactsPage> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(friendsProvider.notifier).loadFriends());
  }

  @override
  Widget build(BuildContext context) {
    final friendsAsync = ref.watch(friendsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('通讯录'),
        actions: [
          IconButton(
            icon: const Icon(Icons.person_add),
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const AddFriendPage()),
              );
            },
          ),
        ],
      ),
      body: Column(
        children: [
          // 功能入口
          _buildFunctionList(),
          const Divider(height: 1),
          // 好友列表
          Expanded(
            child: friendsAsync.when(
              data: (friends) {
                if (friends.isEmpty) {
                  return _buildEmptyState();
                }
                return ListView.separated(
                  itemCount: friends.length,
                  separatorBuilder: (context, index) => const Divider(
                    height: 1,
                    indent: 72,
                  ),
                  itemBuilder: (context, index) {
                    final friend = friends[index];
                    return ListTile(
                      leading: AvatarWidget(
                        url: friend.avatar,
                        name: friend.displayName,
                        size: AppDimens.avatarMedium,
                      ),
                      title: Text(friend.displayName),
                      subtitle: friend.bio?.isNotEmpty == true
                          ? Text(
                              friend.bio!,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            )
                          : null,
                      onTap: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => ConversationPage(
                              userId: friend.id,
                              username: friend.displayName,
                              avatar: friend.avatar,
                            ),
                          ),
                        );
                      },
                    );
                  },
                );
              },
              loading: () => const Center(
                child: CircularProgressIndicator(),
              ),
              error: (error, stack) => Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text('加载失败: $error'),
                    TextButton(
                      onPressed: () {
                        ref.read(friendsProvider.notifier).loadFriends();
                      },
                      child: const Text('重试'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFunctionList() {
    return Column(
      children: [
        ListTile(
          leading: Container(
            width: AppDimens.avatarMedium,
            height: AppDimens.avatarMedium,
            decoration: BoxDecoration(
              color: AppColors.warning,
              borderRadius: BorderRadius.circular(AppDimens.radiusMedium),
            ),
            child: const Icon(Icons.person_add, color: Colors.white),
          ),
          title: const Text('新的朋友'),
          trailing: const Icon(Icons.chevron_right),
          onTap: () {
            Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const FriendRequestsPage()),
            );
          },
        ),
        ListTile(
          leading: Container(
            width: AppDimens.avatarMedium,
            height: AppDimens.avatarMedium,
            decoration: BoxDecoration(
              color: AppColors.success,
              borderRadius: BorderRadius.circular(AppDimens.radiusMedium),
            ),
            child: const Icon(Icons.group, color: Colors.white),
          ),
          title: const Text('群聊'),
          trailing: const Icon(Icons.chevron_right),
          onTap: () {
            Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const GroupsPage()),
            );
          },
        ),
      ],
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.people_outline,
            size: 80,
            color: AppColors.textHint,
          ),
          const SizedBox(height: AppDimens.spacing16),
          Text(
            '暂无好友',
            style: TextStyle(
              color: AppColors.textSecondary,
              fontSize: 16,
            ),
          ),
          const SizedBox(height: AppDimens.spacing16),
          SizedBox(
            width: 140,
            child: ElevatedButton.icon(
              onPressed: () {
                Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const AddFriendPage()),
                );
              },
              icon: const Icon(Icons.person_add),
              label: const Text('添加好友'),
            ),
          ),
        ],
      ),
    );
  }
}
