import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../features/auth/pages/login_page.dart';
import '../../features/auth/pages/register_page.dart';
import '../../features/auth/providers/auth_provider.dart';
import '../../features/chat/pages/chat_page.dart';
import '../../features/chat/pages/conversation_page.dart';
import '../../features/contacts/pages/contacts_page.dart';
import '../../features/contacts/pages/add_friend_page.dart';
import '../../features/groups/pages/groups_page.dart';
import '../../features/moments/pages/moments_page.dart';
import '../../features/profile/pages/profile_page.dart';
import '../../features/profile/pages/settings_page.dart';
import '../utils/storage_util.dart';
import 'main_shell.dart';

/// 路由刷新状态
class RouterRefreshNotifier extends ChangeNotifier {
  bool _isAuthenticated = false;
  
  bool get isAuthenticated => _isAuthenticated;
  
  void setAuthenticated(bool value) {
    if (_isAuthenticated != value) {
      print('[路由刷新] 认证状态变化: $_isAuthenticated -> $value');
      _isAuthenticated = value;
      notifyListeners();
    }
  }
}

/// 全局路由刷新通知器
final routerRefreshNotifier = RouterRefreshNotifier();

/// 全局 GoRouter 实例
GoRouter? _routerInstance;

/// 获取或创建 GoRouter 实例
GoRouter _getRouter() {
  _routerInstance ??= GoRouter(
    initialLocation: '/login',
    refreshListenable: routerRefreshNotifier,
    debugLogDiagnostics: true,
    redirect: (context, state) {
      final isLoggedIn = routerRefreshNotifier.isAuthenticated || StorageUtil.isLoggedIn();
      final isLoginRoute = state.matchedLocation == '/login' || 
                           state.matchedLocation == '/register';
      
      print('[路由] matchedLocation: ${state.matchedLocation}, isLoggedIn: $isLoggedIn');
      
      if (!isLoggedIn && !isLoginRoute) {
        print('[路由] 未登录，重定向到 /login');
        return '/login';
      }
      
      if (isLoggedIn && isLoginRoute) {
        print('[路由] 已登录，重定向到 /chat');
        return '/chat';
      }
      
      return null;
    },
    routes: [
      // 登录注册
      GoRoute(
        path: '/login',
        name: 'login',
        builder: (context, state) => const LoginPage(),
      ),
      GoRoute(
        path: '/register',
        name: 'register',
        builder: (context, state) => const RegisterPage(),
      ),
      
      // 主页面 Shell
      ShellRoute(
        builder: (context, state, child) => MainShell(child: child),
        routes: [
          GoRoute(
            path: '/chat',
            name: 'chat',
            builder: (context, state) => const ChatPage(),
          ),
          GoRoute(
            path: '/contacts',
            name: 'contacts',
            builder: (context, state) => const ContactsPage(),
          ),
          GoRoute(
            path: '/groups',
            name: 'groups',
            builder: (context, state) => const GroupsPage(),
          ),
          GoRoute(
            path: '/moments',
            name: 'moments',
            builder: (context, state) => const MomentsPage(),
          ),
          GoRoute(
            path: '/profile',
            name: 'profile',
            builder: (context, state) => const ProfilePage(),
          ),
        ],
      ),
      
      // 聊天详情页
      GoRoute(
        path: '/conversation/:userId',
        name: 'conversation',
        builder: (context, state) {
          final userId = int.parse(state.pathParameters['userId']!);
          final username = state.uri.queryParameters['username'] ?? '';
          final avatar = state.uri.queryParameters['avatar'];
          return ConversationPage(
            userId: userId,
            username: username,
            avatar: avatar,
          );
        },
      ),
      
      // 添加好友
      GoRoute(
        path: '/add-friend',
        name: 'addFriend',
        builder: (context, state) => const AddFriendPage(),
      ),
      
      // 设置页面
      GoRoute(
        path: '/settings',
        name: 'settings',
        builder: (context, state) => const SettingsPage(),
      ),
    ],
    errorBuilder: (context, state) => Scaffold(
      body: Center(
        child: Text('页面不存在: ${state.error}'),
      ),
    ),
  );
  return _routerInstance!;
}

/// 路由配置 Provider
final appRouterProvider = Provider<GoRouter>((ref) {
  // 监听认证状态变化并更新刷新通知器
  ref.listen(authProvider, (previous, next) {
    print('[路由] authProvider 变化: ${previous?.isAuthenticated} -> ${next.isAuthenticated}');
    routerRefreshNotifier.setAuthenticated(next.isAuthenticated);
  });
  
  return _getRouter();
});
