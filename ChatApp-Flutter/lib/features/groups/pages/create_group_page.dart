import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/app_constants.dart';
import '../../../widgets/avatar_widget.dart';
import '../../../models/user.dart';
import '../../contacts/providers/contacts_provider.dart';
import '../providers/groups_provider.dart';

/// 创建群聊页面
class CreateGroupPage extends ConsumerStatefulWidget {
  const CreateGroupPage({super.key});

  @override
  ConsumerState<CreateGroupPage> createState() => _CreateGroupPageState();
}

class _CreateGroupPageState extends ConsumerState<CreateGroupPage> {
  final _nameController = TextEditingController();
  final _descController = TextEditingController();
  final Set<int> _selectedFriends = {};
  bool _isCreating = false;

  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(friendsProvider.notifier).loadFriends());
  }

  @override
  void dispose() {
    _nameController.dispose();
    _descController.dispose();
    super.dispose();
  }

  Future<void> _createGroup() async {
    final name = _nameController.text.trim();
    if (name.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('请输入群名称')),
      );
      return;
    }

    setState(() => _isCreating = true);

    try {
      final group = await ref.read(groupsProvider.notifier).createGroup(
        name: name,
        description: _descController.text.trim(),
        memberIds: _selectedFriends.toList(),
      );

      if (group != null && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('群聊创建成功')),
        );
        Navigator.of(context).pop(true);
      } else {
        throw Exception('创建失败');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('创建失败: $e')),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isCreating = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final friendsAsync = ref.watch(friendsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('创建群聊'),
        actions: [
          TextButton(
            onPressed: _isCreating ? null : _createGroup,
            child: _isCreating
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('创建'),
          ),
        ],
      ),
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 群名称
            Padding(
              padding: const EdgeInsets.all(AppDimens.spacing16),
              child: TextField(
                controller: _nameController,
                decoration: const InputDecoration(
                  labelText: '群名称',
                  hintText: '请输入群名称',
                  border: OutlineInputBorder(),
                ),
                maxLength: 20,
              ),
            ),

            // 群简介
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppDimens.spacing16),
              child: TextField(
                controller: _descController,
                decoration: const InputDecoration(
                  labelText: '群简介（选填）',
                  hintText: '请输入群简介',
                  border: OutlineInputBorder(),
                ),
                maxLines: 3,
                maxLength: 100,
              ),
            ),

            const SizedBox(height: AppDimens.spacing16),
            const Divider(),

            // 选择好友
            Padding(
              padding: const EdgeInsets.all(AppDimens.spacing16),
              child: Row(
                children: [
                  Text(
                    '选择成员',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w500,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const Spacer(),
                  Text(
                    '已选择 ${_selectedFriends.length} 人',
                    style: TextStyle(
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),

            // 好友列表
            friendsAsync.when(
              data: (friends) {
                if (friends.isEmpty) {
                  return Padding(
                    padding: const EdgeInsets.all(AppDimens.spacing32),
                    child: Center(
                      child: Text(
                        '暂无好友可选',
                        style: TextStyle(color: AppColors.textHint),
                      ),
                    ),
                  );
                }
                return ListView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: friends.length,
                  itemBuilder: (context, index) {
                    final friend = friends[index];
                    final isSelected = _selectedFriends.contains(friend.id);
                    return _buildFriendItem(friend, isSelected);
                  },
                );
              },
              loading: () => const Center(
                child: Padding(
                  padding: EdgeInsets.all(AppDimens.spacing32),
                  child: CircularProgressIndicator(),
                ),
              ),
              error: (error, _) => Center(
                child: Padding(
                  padding: const EdgeInsets.all(AppDimens.spacing32),
                  child: Text('加载失败: $error'),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFriendItem(User friend, bool isSelected) {
    return ListTile(
      leading: AvatarWidget(
        url: friend.avatar,
        name: friend.displayName,
        size: AppDimens.avatarMedium,
      ),
      title: Text(friend.displayName),
      trailing: Checkbox(
        value: isSelected,
        onChanged: (value) {
          setState(() {
            if (value == true) {
              _selectedFriends.add(friend.id);
            } else {
              _selectedFriends.remove(friend.id);
            }
          });
        },
      ),
      onTap: () {
        setState(() {
          if (isSelected) {
            _selectedFriends.remove(friend.id);
          } else {
            _selectedFriends.add(friend.id);
          }
        });
      },
    );
  }
}
