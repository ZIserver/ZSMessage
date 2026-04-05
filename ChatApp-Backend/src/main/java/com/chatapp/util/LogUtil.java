package com.chatapp.util;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;

/**
 * 日志工具类，提供结构化、可读性强的日志记录功能
 */
public class LogUtil {
    
    private static final Logger logger = LoggerFactory.getLogger(LogUtil.class);
    
    /**
     * 记录API请求日志
     * @param clazz 类
     * @param method 方法名
     * @param userId 用户ID
     * @param params 请求参数
     * @param ip 客户端IP
     */
    public static void logApiRequest(Class<?> clazz, String method, Long userId, Object params, String ip) {
        Logger classLogger = LoggerFactory.getLogger(clazz);
        MDC.put("userId", userId != null ? userId.toString() : "anonymous");
        MDC.put("method", method);
        MDC.put("ip", ip != null ? ip : "unknown");
        
        classLogger.info("API请求开始 - 方法: {}, 用户: {}, IP: {}, 参数: {}", method, userId, ip, params);
    }
    
    /**
     * 记录API响应日志
     * @param clazz 类
     * @param method 方法名
     * @param userId 用户ID
     * @param result 响应结果
     * @param duration 请求耗时（毫秒）
     */
    public static void logApiResponse(Class<?> clazz, String method, Long userId, Object result, long duration) {
        Logger classLogger = LoggerFactory.getLogger(clazz);
        MDC.put("userId", userId != null ? userId.toString() : "anonymous");
        MDC.put("method", method);
        
        classLogger.info("API请求结束 - 方法: {}, 用户: {}, 结果: {}, 耗时: {}ms", 
            method, userId, result != null ? "SUCCESS" : "FAILED", duration);
    }
    
    /**
     * 记录错误日志
     * @param clazz 类
     * @param method 方法名
     * @param userId 用户ID
     * @param errorMessage 错误信息
     * @param exception 异常对象
     */
    public static void logError(Class<?> clazz, String method, Long userId, String errorMessage, Exception exception) {
        Logger classLogger = LoggerFactory.getLogger(clazz);
        MDC.put("userId", userId != null ? userId.toString() : "anonymous");
        MDC.put("method", method);
        
        classLogger.error("API请求失败 - 方法: {}, 用户: {}, 错误: {}, 异常: {}", 
            method, userId, errorMessage, exception.getMessage());
    }
    
    /**
     * 记录业务操作日志
     * @param clazz 类
     * @param operation 操作类型
     * @param userId 用户ID
     * @param details 操作详情
     */
    public static void logBusinessOperation(Class<?> clazz, String operation, Long userId, String details) {
        Logger classLogger = LoggerFactory.getLogger(clazz);
        MDC.put("userId", userId != null ? userId.toString() : "anonymous");
        MDC.put("operation", operation);
        
        classLogger.info("业务操作 - 操作: {}, 用户: {}, 详情: {}", operation, userId, details);
    }
    
    /**
     * 记录数据库操作日志
     * @param clazz 类
     * @param operation 操作类型
     * @param userId 用户ID
     * @param entity 实体类型
     * @param entityId 实体ID
     */
    public static void logDatabaseOperation(Class<?> clazz, String operation, Long userId, String entity, Object entityId) {
        Logger classLogger = LoggerFactory.getLogger(clazz);
        MDC.put("userId", userId != null ? userId.toString() : "anonymous");
        MDC.put("operation", operation);
        MDC.put("entity", entity);
        
        classLogger.info("数据库操作 - 操作: {}, 用户: {}, 实体: {}, ID: {}", 
            operation, userId, entity, entityId);
    }
    
    /**
     * 清除MDC上下文
     */
    public static void clearMDC() {
        MDC.clear();
    }
}