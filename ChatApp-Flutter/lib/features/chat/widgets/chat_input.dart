import 'package:flutter/material.dart';
import '../../../core/constants/app_constants.dart';

/// 聊天输入框
class ChatInput extends StatelessWidget {
  final TextEditingController controller;
  final VoidCallback onSend;
  final VoidCallback onAttachment;

  const ChatInput({
    super.key,
    required this.controller,
    required this.onSend,
    required this.onAttachment,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppDimens.spacing8),
      decoration: BoxDecoration(
        color: Theme.of(context).scaffoldBackgroundColor,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 4,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            // 附件按钮
            IconButton(
              icon: const Icon(Icons.add_circle_outline),
              onPressed: onAttachment,
              color: AppColors.textSecondary,
            ),
            
            // 输入框
            Expanded(
              child: Container(
                constraints: const BoxConstraints(maxHeight: 120),
                decoration: BoxDecoration(
                  color: AppColors.surfaceVariant,
                  borderRadius: BorderRadius.circular(AppDimens.radiusLarge),
                ),
                child: TextField(
                  controller: controller,
                  maxLines: null,
                  textInputAction: TextInputAction.newline,
                  decoration: const InputDecoration(
                    hintText: '输入消息...',
                    border: InputBorder.none,
                    contentPadding: EdgeInsets.symmetric(
                      horizontal: AppDimens.spacing16,
                      vertical: AppDimens.spacing12,
                    ),
                  ),
                ),
              ),
            ),
            
            const SizedBox(width: AppDimens.spacing8),
            
            // 发送按钮
            ValueListenableBuilder<TextEditingValue>(
              valueListenable: controller,
              builder: (context, value, child) {
                final hasText = value.text.trim().isNotEmpty;
                return AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  child: hasText
                      ? IconButton(
                          icon: const Icon(Icons.send),
                          onPressed: onSend,
                          color: AppColors.primary,
                        )
                      : IconButton(
                          icon: const Icon(Icons.mic),
                          onPressed: () {
                            // TODO: 语音输入
                          },
                          color: AppColors.textSecondary,
                        ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}
