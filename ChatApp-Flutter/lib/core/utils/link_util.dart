import 'package:flutter/material.dart';
import 'package:flutter/gestures.dart';
import 'package:url_launcher/url_launcher.dart';

/// 链接工具类
class LinkUtil {
  LinkUtil._();

  // 常用域名后缀
  static const List<String> _commonTLDs = [
    'com', 'cn', 'net', 'org', 'edu', 'gov', 'io', 'co', 'me', 'info',
    'biz', 'xyz', 'app', 'dev', 'top', 'cc', 'tv', 'vip', 'club', 'site',
    'online', 'tech', 'store', 'shop', 'work', 'live', 'pro', 'ltd',
    'com.cn', 'net.cn', 'org.cn', 'gov.cn', 'edu.cn',
  ];

  /// 链接正则表达式
  /// 支持: https://xxx, http://xxx, www.xxx, xxx.xxx (带常用后缀)
  static final RegExp _urlRegex = RegExp(
    r'(https?:\/\/[^\s<>\[\]{}|\\^`"]+)|'
    r'(www\.[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]\.[^\s<>\[\]{}|\\^`"]+)|'
    r'([a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]\.(' +
    _commonTLDs.join('|') +
    r')(?:\/[^\s<>\[\]{}|\\^`"]*)?)',
    caseSensitive: false,
  );

  /// 检测文本中是否包含链接
  static bool containsLink(String text) {
    return _urlRegex.hasMatch(text);
  }

  /// 提取文本中的所有链接
  static List<String> extractLinks(String text) {
    final matches = _urlRegex.allMatches(text);
    return matches.map((m) => m.group(0)!).toList();
  }

  /// 构建富文本，将链接转换为可点击的样式
  static TextSpan buildLinkTextSpan({
    required String text,
    required TextStyle normalStyle,
    TextStyle? linkStyle,
    void Function(String url)? onLinkTap,
  }) {
    final effectiveLinkStyle = linkStyle ?? normalStyle.copyWith(
      color: Colors.blue,
      decoration: TextDecoration.underline,
    );

    final List<InlineSpan> spans = [];
    int lastEnd = 0;

    for (final match in _urlRegex.allMatches(text)) {
      // 添加链接前的普通文本
      if (match.start > lastEnd) {
        spans.add(TextSpan(
          text: text.substring(lastEnd, match.start),
          style: normalStyle,
        ));
      }

      // 添加链接文本
      final linkText = match.group(0)!;
      spans.add(TextSpan(
        text: linkText,
        style: effectiveLinkStyle,
        recognizer: TapGestureRecognizer()
          ..onTap = () {
            if (onLinkTap != null) {
              onLinkTap(linkText);
            } else {
              _launchUrl(linkText);
            }
          },
      ));

      lastEnd = match.end;
    }

    // 添加最后的普通文本
    if (lastEnd < text.length) {
      spans.add(TextSpan(
        text: text.substring(lastEnd),
        style: normalStyle,
      ));
    }

    return TextSpan(children: spans);
  }

  /// 打开链接
  static Future<void> _launchUrl(String urlString) async {
    String url = urlString;
    
    // 自动添加协议前缀
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://$url';
    }

    final uri = Uri.tryParse(url);
    if (uri != null) {
      try {
        await launchUrl(
          uri,
          mode: LaunchMode.externalApplication,
        );
      } catch (e) {
        debugPrint('无法打开链接: $url, 错误: $e');
      }
    }
  }

  /// 打开链接（公开方法）
  static Future<void> openUrl(String urlString) async {
    await _launchUrl(urlString);
  }
}
