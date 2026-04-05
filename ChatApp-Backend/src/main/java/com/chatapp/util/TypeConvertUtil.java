package com.chatapp.util;

/**
 * 类型转换工具类
 * 用于安全处理JSON解析时的类型转换问题，特别是Integer到Long的转换
 */
public class TypeConvertUtil {
    
    /**
     * 安全地将Object转换为Long类型
     * 处理JSON解析时可能出现的Integer到Long类型转换问题
     * 
     * @param obj 待转换的对象
     * @return 转换后的Long值，如果转换失败则返回null
     */
    public static Long toLong(Object obj) {
        if (obj == null) return null;
        
        if (obj instanceof Integer) {
            return ((Integer) obj).longValue();
        } else if (obj instanceof Long) {
            return (Long) obj;
        } else if (obj instanceof String) {
            try {
                return Long.valueOf((String) obj);
            } catch (NumberFormatException e) {
                return null;
            }
        } else if (obj instanceof Number) {
            return ((Number) obj).longValue();
        } else {
            try {
                return Long.valueOf(obj.toString());
            } catch (NumberFormatException e) {
                return null;
            }
        }
    }
    
    /**
     * 安全地将Object转换为Integer类型
     * 
     * @param obj 待转换的对象
     * @return 转换后的Integer值，如果转换失败则返回null
     */
    public static Integer toInteger(Object obj) {
        if (obj == null) return null;
        
        if (obj instanceof Integer) {
            return (Integer) obj;
        } else if (obj instanceof Long) {
            Long longValue = (Long) obj;
            if (longValue < Integer.MIN_VALUE || longValue > Integer.MAX_VALUE) {
                return null; // 数值超出Integer范围
            }
            return longValue.intValue();
        } else if (obj instanceof String) {
            try {
                return Integer.valueOf((String) obj);
            } catch (NumberFormatException e) {
                return null;
            }
        } else if (obj instanceof Number) {
            return ((Number) obj).intValue();
        } else {
            try {
                return Integer.valueOf(obj.toString());
            } catch (NumberFormatException e) {
                return null;
            }
        }
    }
    
    /**
     * 安全地将Object转换为String类型
     * 
     * @param obj 待转换的对象
     * @return 转换后的String值，如果转换失败则返回null
     */
    public static String toString(Object obj) {
        if (obj == null) return null;
        return obj.toString();
    }
}