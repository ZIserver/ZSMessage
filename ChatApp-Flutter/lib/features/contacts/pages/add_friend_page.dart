import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import '../../../core/api/api_client.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/utils/storage_util.dart';
import '../../../widgets/avatar_widget.dart';
import '../providers/contacts_provider.dart';

/// 添加好友页面
class AddFriendPage extends ConsumerStatefulWidget {
  const AddFriendPage({super.key});

  @override
  ConsumerState<AddFriendPage> createState() => _AddFriendPageState();
}

class _AddFriendPageState extends ConsumerState<AddFriendPage> {
  final _searchController = TextEditingController();
  String _keyword = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _search() {
    final keyword = _searchController.text.trim();
    if (keyword.isNotEmpty) {
      setState(() => _keyword = keyword);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('添加好友'),
      ),
      body: Column(
        children: [
          // 搜索框
          Padding(
            padding: const EdgeInsets.all(AppDimens.spacing16),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: '搜索用户名或智穗号',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: IconButton(
                  icon: const Icon(Icons.send),
                  onPressed: _search,
                ),
              ),
              onSubmitted: (_) => _search(),
            ),
          ),

          // 搜索结果
          Expanded(
            child: _keyword.isEmpty
                ? _buildEmptyHint()
                : _buildSearchResults(),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyHint() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.search,
            size: 64,
            color: AppColors.textHint,
          ),
          const SizedBox(height: AppDimens.spacing16),
          Text(
            '输入用户名或智穗号搜索',
            style: TextStyle(
              color: AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSearchResults() {
    final searchResult = ref.watch(searchUsersProvider(_keyword));

    return searchResult.when(
      data: (users) {
        if (users.isEmpty) {
          return Center(
            child: Text(
              '未找到相关用户',
              style: TextStyle(color: AppColors.textSecondary),
            ),
          );
        }

        return ListView.separated(
          itemCount: users.length,
          separatorBuilder: (context, index) => const Divider(height: 1),
          itemBuilder: (context, index) {
            final user = users[index];
            return ListTile(
              leading: AvatarWidget(
                url: user.avatar,
                name: user.displayName,
                size: AppDimens.avatarMedium,
              ),
              title: Text(
                user.displayName,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              subtitle: Text(
                '智穗号: ${user.zsNumber?.toString() ?? user.id.toString()}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              trailing: SizedBox(
                width: 64,
                height: 32,
                child: ElevatedButton(
                  onPressed: () => _sendFriendRequest(user.id),
                  style: ElevatedButton.styleFrom(
                    padding: EdgeInsets.zero,
                    minimumSize: const Size(64, 32),
                  ),
                  child: const Text('添加', style: TextStyle(fontSize: 13)),
                ),
              ),
            );
          },
        );
      },
      loading: () => const Center(
        child: CircularProgressIndicator(),
      ),
      error: (error, stack) => Center(
        child: Text('搜索失败: $error'),
      ),
    );
  }
  
  Future<void> _sendFriendRequest(int targetUserId) async {
    try {
      final userId = StorageUtil.getUserId();
      if (userId == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('请先登录')),
        );
        return;
      }
      
      final apiClient = ref.read(apiClientProvider);
      final response = await apiClient.post(
        FriendPaths.request,
        data: {
          'userId': userId,
          'friendId': targetUserId,
          'message': '请求添加您为好友',
        },
      );
      
      if (response.statusCode == 200 && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('好友申请已发送')),
        );
      }
    } on DioException catch (e) {
      if (!mounted) return;
      
      String message = '发送失败';
      Color? backgroundColor;
      
      // 尝试从响应中获取错误信息
      if (e.response?.data != null) {
        final responseData = e.response!.data;
        if (responseData is Map<String, dynamic> && responseData.containsKey('error')) {
          message = responseData['error'].toString();
          
          // 如果是“已发送”类型的提示，使用橙色背景
          if (message.contains('好友请求已发送') || 
              message.contains('等待对方确认') ||
              message.contains('已发送')) {
            backgroundColor = Colors.orange;
          }
        } else if (responseData is String) {
          message = responseData;
        }
      } else if (e.message != null) {
        message = e.message!;
      }
      
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(message),
          backgroundColor: backgroundColor,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('发送失败: $e')),
      );
    }
  }
}
