/**
 * XSS防注入工具类 - 前端版本
 */
class XssUtil {
    /**
     * HTML转义字符映射表
     */
    static htmlEscapeMap = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '/': '&#x2F;'
    };

    /**
     * 清理HTML标签和特殊字符，防止XSS攻击
     * @param {string} input 原始输入
     * @returns {string} 清理后的安全字符串
     */
    static sanitize(input) {
        if (!input || typeof input !== 'string') {
            return input;
        }

        // HTML实体转义
        let sanitized = input.replace(/[&<>"'\/]/g, (char) => {
            return this.htmlEscapeMap[char];
        });

        // 过滤危险关键字
        sanitized = sanitized.replace(/javascript:/gi, '');
        sanitized = sanitized.replace(/on\w+\s*=/gi, ''); // onerror=, onclick=, onload= 等
        
        return sanitized;
    }

    /**
     * 显示时解码HTML实体（用于显示用户输入的内容）
     * @param {string} input 已转义的字符串
     * @returns {string} 解码后的字符串
     */
    static decode(input) {
        if (!input || typeof input !== 'string') {
            return input;
        }

        const textarea = document.createElement('textarea');
        textarea.innerHTML = input;
        return textarea.value;
    }

    /**
     * 移除所有HTML标签
     * @param {string} input 原始输入
     * @returns {string} 纯文本
     */
    static stripHtml(input) {
        if (!input || typeof input !== 'string') {
            return input;
        }
        return input.replace(/<[^>]*>/g, '');
    }

    /**
     * 验证输入长度
     * @param {string} input 输入字符串
     * @param {number} maxLength 最大长度
     * @returns {boolean} 是否有效
     */
    static validateLength(input, maxLength) {
        return input && input.length <= maxLength;
    }

    /**
     * 安全地设置元素的文本内容（自动转义）
     * @param {HTMLElement} element DOM元素
     * @param {string} text 文本内容
     */
    static setTextContent(element, text) {
        if (element && text !== null && text !== undefined) {
            element.textContent = text;
        }
    }

    /**
     * 安全地设置元素的HTML内容（已转义的内容）
     * @param {HTMLElement} element DOM元素
     * @param {string} html HTML内容（必须是已转义的）
     */
    static setHtmlContent(element, html) {
        if (element && html !== null && html !== undefined) {
            element.innerHTML = html;
        }
    }
}

// 导出供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = XssUtil;
}
