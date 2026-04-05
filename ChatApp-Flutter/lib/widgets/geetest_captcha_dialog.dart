import 'dart:async';
import 'package:flutter/material.dart';
import 'package:gt4_flutter_plugin/gt4_flutter_plugin.dart';
import 'package:gt4_flutter_plugin/gt4_session_configuration.dart';

/// Geetest GT4 验证服务
class GeetestService {
  /// 显示验证码并获取结果
  /// 返回验证结果 Map，包含 lot_number, captcha_output, pass_token, gen_time
  /// 如果用户取消或验证失败，返回 null
  static Future<Map<String, dynamic>?> verify({
    required String captchaId,
  }) async {
    final completer = Completer<Map<String, dynamic>?>();
    
    try {
      // 配置验证参数
      final config = GT4SessionConfiguration();
      config.language = 'zh';
      config.timeout = 10;
      
      // 创建验证实例
      final captcha = Gt4FlutterPlugin(captchaId, config);
      
      // 注册回调
      captcha.addEventHandler(
        onResult: (Map<String, dynamic> event) {
          debugPrint('[Geetest] onResult: $event');
          
          // status "1" 表示成功
          if (event['status'] == '1' || event['status'] == 1) {
            final result = event['result'];
            if (result != null && result is Map) {
              final resultMap = Map<String, dynamic>.from(result);
              if (!completer.isCompleted) {
                completer.complete({
                  'lot_number': resultMap['lot_number'],
                  'captcha_output': resultMap['captcha_output'],
                  'pass_token': resultMap['pass_token'],
                  'gen_time': resultMap['gen_time'],
                });
              }
            } else if (!completer.isCompleted) {
              completer.complete(null);
            }
          } else {
            // 验证失败
            if (!completer.isCompleted) {
              completer.complete(null);
            }
          }
        },
        onError: (Map<String, dynamic> event) {
          debugPrint('[Geetest] onError: $event');
          if (!completer.isCompleted) {
            completer.complete(null);
          }
        },
        onShow: (Map<String, dynamic> event) {
          debugPrint('[Geetest] onShow: $event');
        },
      );
      
      // 开启验证
      captcha.verify();
      
      return completer.future;
    } catch (e) {
      debugPrint('[Geetest] 验证异常: $e');
      if (!completer.isCompleted) {
        completer.complete(null);
      }
      return null;
    }
  }
}
