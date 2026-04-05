package com.chatapp.util;

import org.springframework.web.util.HtmlUtils;

/**
 * XSS防注入工具类
 */
public class XssUtil {
    
    /**
     * 清理HTML标签和特殊字符，防止XSS攻击
     * @param input 原始输入
     * @return 清理后的安全字符串
     */
    public static String sanitize(String input) {
        if (input == null || input.isEmpty()) {
            return input;
        }
        
        // 使用Spring提供的HtmlUtils进行HTML转义
        String sanitized = HtmlUtils.htmlEscape(input);
        
        // 额外过滤一些危险字符
        sanitized = sanitized.replaceAll("javascript:", "");
        sanitized = sanitized.replaceAll("onerror=", "");
        sanitized = sanitized.replaceAll("onclick=", "");
        sanitized = sanitized.replaceAll("onload=", "");
        sanitized = sanitized.replaceAll("<script", "&lt;script");
        sanitized = sanitized.replaceAll("</script>", "&lt;/script&gt;");
        
        return sanitized;
    }
    
    /**
     * 批量清理字符串
     * @param inputs 原始输入数组
     * @return 清理后的安全字符串数组
     */
    public static String[] sanitize(String... inputs) {
        if (inputs == null) {
            return null;
        }
        
        String[] result = new String[inputs.length];
        for (int i = 0; i < inputs.length; i++) {
            result[i] = sanitize(inputs[i]);
        }
        return result;
    }
    
    /**
     * 验证输入长度
     * @param input 输入字符串
     * @param maxLength 最大长度
     * @return 是否有效
     */
    public static boolean validateLength(String input, int maxLength) {
        return input != null && input.length() <= maxLength;
    }
    
    /**
     * 移除所有HTML标签
     * @param input 原始输入
     * @return 纯文本
     */
    public static String stripHtml(String input) {
        if (input == null || input.isEmpty()) {
            return input;
        }
        return input.replaceAll("<[^>]*>", "");
    }
}
