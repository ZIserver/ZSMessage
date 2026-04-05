import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// 存储工具类
class StorageUtil {
  StorageUtil._();
  
  static const _storage = FlutterSecureStorage();
  static SharedPreferences? _prefs;
  
  // 存储键
  static const String _keyToken = 'auth_token';
  static const String _keyUserId = 'user_id';
  static const String _keyUser = 'user_data';
  static const String _keyIsLoggedIn = 'is_logged_in';
  
  /// 初始化
  static Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();
  }
  
  /// 保存 Token（安全存储）
  static Future<void> saveToken(String token) async {
    await _storage.write(key: _keyToken, value: token);
  }
  
  /// 获取 Token
  static Future<String?> getToken() async {
    return await _storage.read(key: _keyToken);
  }
  
  /// 保存用户 ID
  static Future<void> saveUserId(int userId) async {
    await _prefs?.setInt(_keyUserId, userId);
  }
  
  /// 获取用户 ID
  static int? getUserId() {
    return _prefs?.getInt(_keyUserId);
  }
  
  /// 保存用户数据
  static Future<void> saveUser(Map<String, dynamic> user) async {
    await _prefs?.setString(_keyUser, jsonEncode(user));
  }
  
  /// 获取用户数据
  static Map<String, dynamic>? getUser() {
    final userStr = _prefs?.getString(_keyUser);
    if (userStr != null) {
      return jsonDecode(userStr) as Map<String, dynamic>;
    }
    return null;
  }
  
  /// 设置登录状态
  static Future<void> setLoggedIn(bool value) async {
    await _prefs?.setBool(_keyIsLoggedIn, value);
  }
  
  /// 检查是否已登录
  static bool isLoggedIn() {
    return _prefs?.getBool(_keyIsLoggedIn) ?? false;
  }
  
  /// 保存认证信息
  static Future<void> saveAuth({
    required String token,
    required int userId,
    Map<String, dynamic>? user,
  }) async {
    await saveToken(token);
    await saveUserId(userId);
    if (user != null) {
      await saveUser(user);
    }
    await setLoggedIn(true);
  }
  
  /// 清除认证信息
  static Future<void> clearAuth() async {
    await _storage.delete(key: _keyToken);
    await _prefs?.remove(_keyUserId);
    await _prefs?.remove(_keyUser);
    await setLoggedIn(false);
  }
  
  /// 清除所有数据
  static Future<void> clearAll() async {
    await _storage.deleteAll();
    await _prefs?.clear();
  }
  
  // ========== 通用存储方法 ==========
  
  /// 保存字符串
  static Future<void> setString(String key, String value) async {
    await _prefs?.setString(key, value);
  }
  
  /// 获取字符串
  static String? getString(String key) {
    return _prefs?.getString(key);
  }
  
  /// 保存整数
  static Future<void> setInt(String key, int value) async {
    await _prefs?.setInt(key, value);
  }
  
  /// 获取整数
  static int? getInt(String key) {
    return _prefs?.getInt(key);
  }
  
  /// 保存布尔值
  static Future<void> setBool(String key, bool value) async {
    await _prefs?.setBool(key, value);
  }
  
  /// 获取布尔值
  static bool? getBool(String key) {
    return _prefs?.getBool(key);
  }
  
  /// 删除指定键
  static Future<void> remove(String key) async {
    await _prefs?.remove(key);
  }
}
