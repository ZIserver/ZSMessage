import 'package:dio/dio.dart';
import '../utils/storage_util.dart';

/// 认证拦截器
class AuthInterceptor extends Interceptor {
  // 无需登录令牌的白名单路径
  static const List<String> _publicPaths = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/send-sms-code',
    '/api/auth/send-verification-code',
  ];
  
  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    // 检查是否是公开接口
    final path = options.path;
    final isPublicPath = _publicPaths.any((p) => path.contains(p));
    
    if (isPublicPath) {
      // 公开接口不添加 Authorization header
      options.headers.remove('Authorization');
    } else {
      // 非公开接口，从存储中获取 token
      final token = await StorageUtil.getToken();
      if (token != null && token.isNotEmpty) {
        options.headers['Authorization'] = 'Bearer $token';
      }
    }
    
    handler.next(options);
  }
  
  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    if (err.response?.statusCode == 401) {
      // Token 过期或无效，清除登录状态
      // 但不清除注册相关请求的状态
      final path = err.requestOptions.path;
      final isPublicPath = _publicPaths.any((p) => path.contains(p));
      if (!isPublicPath) {
        StorageUtil.clearAuth();
      }
    }
    handler.next(err);
  }
}
