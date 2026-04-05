import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/theme/app_theme.dart';
import 'core/utils/storage_util.dart';
import 'features/auth/pages/login_page.dart';
import 'features/auth/providers/auth_provider.dart';
import 'features/home/home_page.dart';

/// 全局导航键，用于在任何地方进行导航
final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

class YuLiaoApp extends ConsumerWidget {
  const YuLiaoApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);
    
    return MaterialApp(
      title: '智穗语聊',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: ThemeMode.system,
      navigatorKey: navigatorKey,
      home: authState.isAuthenticated || StorageUtil.isLoggedIn()
          ? const HomePage()
          : const LoginPage(),
    );
  }
}
