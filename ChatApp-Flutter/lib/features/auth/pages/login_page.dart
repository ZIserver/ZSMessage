import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import 'dart:convert';
import '../../../core/constants/app_constants.dart';
import '../providers/auth_provider.dart';
import 'register_page.dart';

/// 登录页面
class LoginPage extends ConsumerStatefulWidget {
  const LoginPage({super.key});

  @override
  ConsumerState<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends ConsumerState<LoginPage> {
  final _formKey = GlobalKey<FormState>();
  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;
  bool _isLoading = false;

  @override
  void dispose() {
    _usernameController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  /// 显示提示弹窗
  void _showDialog(String title, String message, {bool isError = true, VoidCallback? onConfirm}) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Row(
          children: [
            Icon(
              isError ? Icons.error_outline : Icons.check_circle_outline,
              color: isError ? AppColors.error : Colors.green,
            ),
            const SizedBox(width: 8),
            Text(title),
          ],
        ),
        content: SingleChildScrollView(
          child: SelectableText(message),
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
              onConfirm?.call();
            },
            child: const Text('确定'),
          ),
        ],
      ),
    );
  }

  /// 格式化错误信息
  String _formatError(dynamic error) {
    if (error is DioException) {
      final response = error.response;
      final buffer = StringBuffer();
      
      buffer.writeln('【请求信息】');
      buffer.writeln('URL: ${error.requestOptions.uri}');
      buffer.writeln('Method: ${error.requestOptions.method}');
      buffer.writeln('Data: ${error.requestOptions.data}');
      buffer.writeln();
      
      buffer.writeln('【错误类型】');
      buffer.writeln(error.type.toString());
      buffer.writeln();
      
      if (response != null) {
        buffer.writeln('【响应状态】');
        buffer.writeln('Status: ${response.statusCode}');
        buffer.writeln('Data: ${response.data}');
      } else {
        buffer.writeln('【错误信息】');
        buffer.writeln(error.message);
      }
      
      return buffer.toString();
    }
    return error.toString();
  }

  Future<void> _handleLogin() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);

    try {
      final username = _usernameController.text.trim();
      final password = _passwordController.text;
      
      // 直接登录，后端会返回是否需要验证码
      await _performLogin(username, password, null);
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        _showDialog('登录异常', _formatError(e));
      }
    }
  }
  
  /// 执行登录
  Future<void> _performLogin(String username, String password, Map<String, dynamic>? captchaData) async {
    try {
      final result = await ref.read(authProvider.notifier).login(
        username,
        password,
        captchaData: captchaData,
      );

      if (mounted) {
        // 检查是否需要验证码
        if (result.needsCaptcha) {
          // 需要验证码，显示图片验证码弹窗
          final captchaResult = await _showImageCaptchaDialog();
          
          if (captchaResult != null && mounted) {
            // 验证码已填写，重新登录
            await _performLogin(username, password, captchaResult);
          } else {
            // 用户取消
            setState(() => _isLoading = false);
          }
          return;
        }
        
        setState(() => _isLoading = false);
        
        if (result.success) {
          // 先显示成功提示
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('登录成功，欢迎 ${result.message}'),
              backgroundColor: Colors.green,
              duration: const Duration(seconds: 1),
            ),
          );
          
          // 延迟一下跳转，让用户看到提示
          await Future.delayed(const Duration(milliseconds: 500));
          
          if (mounted) {
            print('[跳转] 登录成功，状态已更新，页面将自动切换');
            // 不需要手动跳转，authState 变化会自动触发 YuLiaoApp 重建
          }
        } else {
          _showDialog('登录失败', result.message);
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        _showDialog('登录异常', _formatError(e));
      }
    }
  }
  
  /// 显示图片验证码弹窗
  Future<Map<String, dynamic>?> _showImageCaptchaDialog() async {
    String? captchaId;
    String? captchaImage;
    final codeController = TextEditingController();
    
    // 获取验证码
    Future<void> loadCaptcha() async {
      final result = await ref.read(authProvider.notifier).getCaptcha();
      if (result.success) {
        captchaId = result.captchaId;
        captchaImage = result.captchaImage;
      }
    }
    
    await loadCaptcha();
    
    if (!mounted || captchaId == null) return null;
    
    return showDialog<Map<String, dynamic>>(
      context: context,
      barrierDismissible: false,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              title: const Text('请输入验证码'),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // 验证码图片
                  GestureDetector(
                    onTap: () async {
                      final result = await ref.read(authProvider.notifier).getCaptcha();
                      if (result.success) {
                        setDialogState(() {
                          captchaId = result.captchaId;
                          captchaImage = result.captchaImage;
                        });
                      }
                    },
                    child: Container(
                      decoration: BoxDecoration(
                        border: Border.all(color: Colors.grey.shade300),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: captchaImage != null
                          ? Image.memory(
                              base64Decode(captchaImage!.split(',').last),
                              height: 40,
                              fit: BoxFit.contain,
                            )
                          : const SizedBox(
                              height: 40,
                              child: Center(child: CircularProgressIndicator()),
                            ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text('点击图片刷新', style: TextStyle(fontSize: 12, color: Colors.grey)),
                  const SizedBox(height: 16),
                  // 验证码输入框
                  TextField(
                    controller: codeController,
                    decoration: const InputDecoration(
                      labelText: '验证码',
                      hintText: '请输入图片中的字符',
                    ),
                    maxLength: 4,
                    textCapitalization: TextCapitalization.characters,
                  ),
                ],
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(context).pop(null),
                  child: const Text('取消'),
                ),
                ElevatedButton(
                  onPressed: () {
                    final code = codeController.text.trim();
                    if (code.isEmpty) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('请输入验证码')),
                      );
                      return;
                    }
                    Navigator.of(context).pop({
                      'captchaId': captchaId,
                      'captchaCode': code,
                    });
                  },
                  child: const Text('确定'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppDimens.spacing24),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 60),
                // Logo 和标题
                Center(
                  child: Column(
                    children: [
                      Container(
                        width: 80,
                        height: 80,
                        decoration: BoxDecoration(
                          color: AppColors.primary,
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: const Icon(
                          Icons.chat_bubble_rounded,
                          size: 48,
                          color: Colors.white,
                        ),
                      ),
                      const SizedBox(height: AppDimens.spacing16),
                      const Text(
                        '智穗语聊',
                        style: TextStyle(
                          fontSize: 28,
                          fontWeight: FontWeight.bold,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: AppDimens.spacing8),
                      Text(
                        '连接你我，沟通无限',
                        style: TextStyle(
                          fontSize: 14,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 48),

                // 用户名输入框
                TextFormField(
                  controller: _usernameController,
                  decoration: const InputDecoration(
                    labelText: '用户名',
                    hintText: '请输入用户名',
                    prefixIcon: Icon(Icons.person_outline),
                  ),
                  textInputAction: TextInputAction.next,
                  validator: (value) {
                    if (value == null || value.trim().isEmpty) {
                      return '请输入用户名';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: AppDimens.spacing16),

                // 密码输入框
                TextFormField(
                  controller: _passwordController,
                  obscureText: _obscurePassword,
                  decoration: InputDecoration(
                    labelText: '密码',
                    hintText: '请输入密码',
                    prefixIcon: const Icon(Icons.lock_outline),
                    suffixIcon: IconButton(
                      icon: Icon(
                        _obscurePassword
                            ? Icons.visibility_off_outlined
                            : Icons.visibility_outlined,
                      ),
                      onPressed: () {
                        setState(() => _obscurePassword = !_obscurePassword);
                      },
                    ),
                  ),
                  textInputAction: TextInputAction.done,
                  onFieldSubmitted: (_) => _handleLogin(),
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return '请输入密码';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: AppDimens.spacing8),

                // 忘记密码
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton(
                    onPressed: () {
                      // TODO: 忘记密码
                    },
                    child: const Text('忘记密码？'),
                  ),
                ),
                const SizedBox(height: AppDimens.spacing24),

                // 登录按钮
                ElevatedButton(
                  onPressed: _isLoading ? null : _handleLogin,
                  child: _isLoading
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Text('登 录'),
                ),
                const SizedBox(height: AppDimens.spacing16),

                // 注册入口
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      '还没有账号？',
                      style: TextStyle(color: AppColors.textSecondary),
                    ),
                    TextButton(
                      onPressed: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(builder: (_) => const RegisterPage()),
                        );
                      },
                      child: const Text('立即注册'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
