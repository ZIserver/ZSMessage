import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import '../../../core/api/api_client.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/utils/storage_util.dart';
import '../../../models/user.dart';

/// 登录结果
class LoginResult {
  final bool success;
  final String message;
  final User? user;
  final bool needsCaptcha;  // 是否需要验证码

  LoginResult({required this.success, required this.message, this.user, this.needsCaptcha = false});
}

/// 图片验证码结果
class CaptchaResult {
  final bool success;
  final String? captchaId;
  final String? captchaImage;
  final String? error;

  CaptchaResult({required this.success, this.captchaId, this.captchaImage, this.error});
}

/// 认证状态
class AuthState {
  final bool isAuthenticated;
  final User? user;
  final bool isLoading;
  final String? error;
  final String? avatarCacheKey; // 用于强制刷新头像

  const AuthState({
    this.isAuthenticated = false,
    this.user,
    this.isLoading = false,
    this.error,
    this.avatarCacheKey,
  });

  AuthState copyWith({
    bool? isAuthenticated,
    User? user,
    bool? isLoading,
    String? error,
    String? avatarCacheKey,
  }) {
    return AuthState(
      isAuthenticated: isAuthenticated ?? this.isAuthenticated,
      user: user ?? this.user,
      isLoading: isLoading ?? this.isLoading,
      error: error,
      avatarCacheKey: avatarCacheKey ?? this.avatarCacheKey,
    );
  }
}

/// 认证 Provider
final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier(ref.watch(apiClientProvider));
});

/// 认证 Notifier
class AuthNotifier extends StateNotifier<AuthState> {
  final ApiClient _apiClient;

  AuthNotifier(this._apiClient) : super(const AuthState()) {
    _checkAuth();
  }

  /// 检查登录状态
  Future<void> _checkAuth() async {
    final token = await StorageUtil.getToken();
    if (token != null && token.isNotEmpty) {
      final userData = StorageUtil.getUser();
      if (userData != null) {
        state = state.copyWith(
          isAuthenticated: true,
          user: User.fromJson(userData),
        );
      }
    }
  }

  /// 检查是否需要Geetest验证
  Future<bool> checkNeedCaptcha(String username) async {
    try {
      final response = await _apiClient.post(
        '${AuthPaths.login.split('/login')[0]}/check-need-captcha',
        data: {'username': username},
      );
      
      if (response.statusCode == 200 && response.data != null) {
        final data = response.data as Map<String, dynamic>;
        return data['needsCaptcha'] as bool? ?? false;
      }
      return false;
    } catch (e) {
      print('[检查验证码] 异常: $e');
      return false;
    }
  }

  /// 登录
  Future<LoginResult> login(
    String username,
    String password, {
    Map<String, dynamic>? captchaData,
  }) async {
    state = state.copyWith(isLoading: true, error: null);

    try {
      final requestData = {
        'username': username,
        'password': password,
      };
      
      // 如果有验证码数据，添加到请求中（图片验证码）
      if (captchaData != null) {
        requestData['captchaId'] = captchaData['captchaId'];
        requestData['captchaCode'] = captchaData['captchaCode'];
      }
      
      final response = await _apiClient.post(
        AuthPaths.login,
        data: requestData,
      );

      final statusCode = response.statusCode;
      final data = response.data;

      // 详细日志
      print('[登录响应] statusCode: $statusCode');
      print('[登录响应] data: $data');
      print('[登录响应] data type: ${data.runtimeType}');

      if (statusCode == 200 && data != null) {
        final Map<String, dynamic> responseData;
        
        if (data is Map<String, dynamic>) {
          responseData = data;
        } else {
          state = state.copyWith(isLoading: false);
          return LoginResult(
            success: false,
            message: '响应数据格式错误: ${data.runtimeType}\n$data',
          );
        }

        final token = responseData['token'] as String?;
        final userId = responseData['userId'];
        final userData = responseData['user'] as Map<String, dynamic>?;

        print('[登录解析] token: $token');
        print('[登录解析] userId: $userId (${userId.runtimeType})');
        print('[登录解析] userData: $userData');

        if (token != null && token.isNotEmpty) {
          final userIdInt = userId is int ? userId : int.tryParse(userId.toString());
          
          if (userIdInt == null) {
            state = state.copyWith(isLoading: false);
            return LoginResult(
              success: false,
              message: 'userId 解析失败: $userId',
            );
          }

          await StorageUtil.saveAuth(
            token: token,
            userId: userIdInt,
            user: userData,
          );

          _apiClient.setToken(token);

          User? user;
          if (userData != null) {
            user = User.fromJson(userData);
          }

          state = state.copyWith(
            isAuthenticated: true,
            user: user,
            isLoading: false,
          );

          return LoginResult(
            success: true,
            message: user?.nickname ?? user?.username ?? username,
            user: user,
          );
        } else {
          state = state.copyWith(isLoading: false);
          return LoginResult(
            success: false,
            message: 'Token 为空\n响应数据: $responseData',
          );
        }
      } else {
        state = state.copyWith(isLoading: false);
        return LoginResult(
          success: false,
          message: '登录失败 (HTTP $statusCode)\n$data',
        );
      }
    } on DioException catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
      
      // 检查是否需要验证码（403响应）
      if (e.response?.statusCode == 403 && e.response?.data != null) {
        final data = e.response!.data as Map<String, dynamic>;
        if (data['needsCaptcha'] == true) {
          return LoginResult(
            success: false,
            message: data['error'] ?? '需要完成人机验证',
            needsCaptcha: true,
          );
        }
      }
      
      rethrow;
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
      rethrow;
    }
  }

  /// 注册
  Future<bool> register({
    required String username,
    required String phone,
    required String password,
    required String smsCode,
    String? nickname,
  }) async {
    state = state.copyWith(isLoading: true, error: null);

    try {
      final response = await _apiClient.post(
        AuthPaths.register,
        data: {
          'username': username,
          'phone': phone,
          'password': password,
          'smsCode': smsCode,
          'nickname': nickname ?? username,
        },
      );

      state = state.copyWith(isLoading: false);
      return response.statusCode == 200;
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
      rethrow;
    }
  }

  /// 发送短信验证码
  Future<void> sendSmsCode(String phone) async {
    await _apiClient.post(
      AuthPaths.sendSmsCode,
      data: {'phone': phone},
    );
  }

  /// 发送邮箱验证码
  Future<void> sendVerificationCode(String email) async {
    await _apiClient.post(
      AuthPaths.sendVerificationCode,
      data: {'email': email},
    );
  }

  /// 退出登录
  Future<void> logout() async {
    await StorageUtil.clearAuth();
    _apiClient.setToken(null);
    state = const AuthState();
  }
  
  /// 获取图片验证码
  Future<CaptchaResult> getCaptcha() async {
    try {
      final response = await _apiClient.get(AuthPaths.captcha);
      if (response.statusCode == 200) {
        final data = response.data as Map<String, dynamic>;
        return CaptchaResult(
          success: true,
          captchaId: data['captchaId'] as String,
          captchaImage: data['captchaImage'] as String,
        );
      }
      return CaptchaResult(success: false, error: '获取验证码失败');
    } catch (e) {
      return CaptchaResult(success: false, error: e.toString());
    }
  }

  /// 更新用户信息
  void updateUser(User user) {
    state = state.copyWith(user: user);
    StorageUtil.saveUser(user.toJson());
  }
  
  /// 更新头像（并强制刷新缓存）
  void updateAvatar(String newAvatar) {
    final user = state.user;
    if (user != null) {
      final updatedUser = user.copyWith(avatar: newAvatar);
      state = state.copyWith(
        user: updatedUser,
        avatarCacheKey: DateTime.now().millisecondsSinceEpoch.toString(),
      );
      StorageUtil.saveUser(updatedUser.toJson());
    }
  }
}

/// 当前用户 ID Provider
final currentUserIdProvider = Provider<int?>((ref) {
  return ref.watch(authProvider).user?.id;
});
