import 'package:dio/dio.dart';

/// 日志拦截器
class LoggingInterceptor extends Interceptor {
  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    print('\n┌───────────── HTTP 请求 ─────────────');
    print('│ ${options.method} ${options.uri}');
    print('│ Headers: ${options.headers}');
    if (options.data != null) {
      print('│ Body: ${options.data}');
    }
    print('└───────────────────────────────');
    handler.next(options);
  }

  @override
  void onResponse(Response response, ResponseInterceptorHandler handler) {
    print('\n┌───────────── HTTP 响应 ─────────────');
    print('│ ${response.statusCode} ${response.requestOptions.uri}');
    print('│ Response: ${response.data}');
    print('└───────────────────────────────');
    handler.next(response);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    print('\n┌───────────── HTTP 错误 ─────────────');
    print('│ ${err.response?.statusCode ?? 'N/A'} ${err.requestOptions.uri}');
    print('│ Error Type: ${err.type}');
    print('│ Error Message: ${err.message}');
    if (err.response?.data != null) {
      print('│ Response: ${err.response?.data}');
    }
    print('└───────────────────────────────');
    handler.next(err);
  }
}
