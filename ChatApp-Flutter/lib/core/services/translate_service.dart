import 'package:dio/dio.dart';

/// 翻译服务
class TranslateService {
  static final Dio _dio = Dio();
  
  /// 翻译API地址
  static const String _translateUrl = 'https://uapis.cn/api/v1/translate/text';
  
  /// 支持的语言
  static const Map<String, String> supportedLanguages = {
    'en': '英语',
    'zh': '中文',
    'ja': '日语',
    'ko': '韩语',
    'fr': '法语',
    'de': '德语',
    'es': '西班牙语',
    'ru': '俄语',
    'pt': '葡萄牙语',
    'it': '意大利语',
  };
  
  /// 翻译文本
  /// [text] 要翻译的文本
  /// [toLang] 目标语言代码 (默认: en)
  static Future<TranslateResult> translate(String text, {String toLang = 'en'}) async {
    try {
      final response = await _dio.post(
        '$_translateUrl?to_lang=$toLang',
        data: {'text': text},
        options: Options(
          headers: {'Content-Type': 'application/json'},
          receiveTimeout: const Duration(seconds: 30),
        ),
      );
      
      if (response.statusCode == 200 && response.data != null) {
        final data = response.data;
        final translatedText = data['translated_text'] ?? 
                              data['translate'] ?? 
                              data['text'] ?? '';
        
        return TranslateResult(
          success: true,
          originalText: text,
          translatedText: translatedText,
          targetLanguage: toLang,
        );
      } else {
        return TranslateResult(
          success: false,
          originalText: text,
          error: '翻译失败: HTTP ${response.statusCode}',
        );
      }
    } catch (e) {
      return TranslateResult(
        success: false,
        originalText: text,
        error: '翻译失败: $e',
      );
    }
  }
  
  /// 自动检测语言并翻译
  /// 如果是中文则翻译成英文，否则翻译成中文
  static Future<TranslateResult> autoTranslate(String text) async {
    // 简单判断是否包含中文字符
    final containsChinese = RegExp(r'[\u4e00-\u9fa5]').hasMatch(text);
    final targetLang = containsChinese ? 'en' : 'zh';
    return translate(text, toLang: targetLang);
  }
}

/// 翻译结果
class TranslateResult {
  final bool success;
  final String originalText;
  final String? translatedText;
  final String? targetLanguage;
  final String? error;
  
  TranslateResult({
    required this.success,
    required this.originalText,
    this.translatedText,
    this.targetLanguage,
    this.error,
  });
}
