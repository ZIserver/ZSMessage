import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/app_constants.dart';
import '../../../widgets/avatar_widget.dart';
import '../providers/groups_provider.dart';
import 'group_chat_page.dart';
import 'create_group_page.dart';

/// 群组页面
class GroupsPage extends ConsumerStatefulWidget {
  const GroupsPage({super.key});

  @override
  ConsumerState<GroupsPage> createState() => _GroupsPageState();
}

class _GroupsPageState extends ConsumerState<GroupsPage> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(groupsProvider.notifier).loadGroups());
  }

  @override
  Widget build(BuildContext context) {
    final groupsAsync = ref.watch(groupsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('群聊'),
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            onPressed: () async {
              final result = await Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const CreateGroupPage()),
              );
              if (result == true) {
                ref.read(groupsProvider.notifier).loadGroups();
              }
            },
          ),
        ],
      ),
      body: groupsAsync.when(
        data: (groups) {
          if (groups.isEmpty) {
            return _buildEmptyState();
          }
          return ListView.separated(
            itemCount: groups.length,
            separatorBuilder: (_, __) => const Divider(height: 1, indent: 72),
            itemBuilder: (context, index) {
              final group = groups[index];
              return ListTile(
                leading: AvatarWidget(
                  url: group.avatar,
                  name: group.displayName,
                  size: AppDimens.avatarMedium,
                ),
                title: Text(group.displayName),
                subtitle: Text(
                  '${group.memberCount ?? 0}人',
                  style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
                ),
                onTap: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => GroupChatPage(group: group),
                    ),
                  );
                },
              );
            },
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text('加载失败: $error'),
              TextButton(
                onPressed: () => ref.read(groupsProvider.notifier).loadGroups(),
                child: const Text('重试'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.group_outlined,
            size: 80,
            color: AppColors.textHint,
          ),
          const SizedBox(height: AppDimens.spacing16),
          Text(
            '暂无群聊',
            style: TextStyle(
              color: AppColors.textSecondary,
              fontSize: 16,
            ),
          ),
          const SizedBox(height: AppDimens.spacing16),
          SizedBox(
            width: 140,
            child: ElevatedButton.icon(
              onPressed: () async {
                final result = await Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const CreateGroupPage()),
                );
                if (result == true) {
                  ref.read(groupsProvider.notifier).loadGroups();
                }
              },
              icon: const Icon(Icons.add),
              label: const Text('创建群聊'),
            ),
          ),
        ],
      ),
    );
  }
}
