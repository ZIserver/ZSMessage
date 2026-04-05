import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'app.dart';
import 'core/utils/storage_util.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // 初始化存储
  await StorageUtil.init();
  
  runApp(
    const ProviderScope(
      child: YuLiaoApp(),
    ),
  );
}
