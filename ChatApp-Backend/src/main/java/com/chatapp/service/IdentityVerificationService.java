package com.chatapp.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

/**
 * 实名认证服务
 * 调用阿里云身份证实名认证API
 */
@Service
@Slf4j
public class IdentityVerificationService {
    
    @Value("${aliyun.idcert.url}")
    private String apiUrl;
    
    @Value("${aliyun.idcert.appcode}")
    private String appCode;
    
    private final ObjectMapper objectMapper = new ObjectMapper();
    
    /**
     * 验证身份证信息
     * @param name 姓名
     * @param idCard 身份证号
     * @return 验证结果
     */
    public VerificationResult verifyIdentity(String name, String idCard) {
        log.info("[实名认证] 开始验证 - 姓名: {}", maskName(name));
        
        // 参数验证
        if (name == null || name.trim().isEmpty()) {
            return VerificationResult.failure("姓名不能为空");
        }
        if (idCard == null || idCard.trim().isEmpty()) {
            return VerificationResult.failure("身份证号不能为空");
        }
        if (!isValidIdCard(idCard)) {
            return VerificationResult.failure("身份证号格式不正确");
        }
        
        // 检查AppCode配置
        if (appCode == null || appCode.isEmpty() || "YOUR_APPCODE_HERE".equals(appCode)) {
            log.warn("[实名认证] AppCode未配置，跳过验证");
            // 开发环境下可以直接返回成功用于测试
            return VerificationResult.failure("实名认证服务未配置，请联系管理员");
        }
        
        try {
            String urlSend = apiUrl + "?idCard=" + URLEncoder.encode(idCard, StandardCharsets.UTF_8) 
                           + "&name=" + URLEncoder.encode(name, StandardCharsets.UTF_8);
            
            URL url = new URL(urlSend);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("Authorization", "APPCODE " + appCode);
            conn.setConnectTimeout(5000);
            conn.setReadTimeout(5000);
            
            int httpCode = conn.getResponseCode();
            
            if (httpCode == 200) {
                String response = readResponse(conn);
                log.debug("[实名认证] API响应: {}", response);
                
                JsonNode jsonNode = objectMapper.readTree(response);
                
                // 解析返回结果
                // 返回格式: {"status":"01","msg":"实名认证通过","idCard":"xxx","name":"xxx","sex":"男","area":"xxx","province":"xxx","city":"xxx","prefecture":"xxx","birthday":"xxx","addrCode":"xxx","lastCode":"x"}
                String status = jsonNode.has("status") ? jsonNode.get("status").asText() : "";
                String msg = jsonNode.has("msg") ? jsonNode.get("msg").asText() : "未知结果";
                
                if ("01".equals(status)) {
                    log.info("[实名认证] 验证通过 - 姓名: {}", maskName(name));
                    return VerificationResult.success(msg);
                } else if ("02".equals(status)) {
                    log.info("[实名认证] 验证不通过 - 姓名: {}, 原因: {}", maskName(name), msg);
                    return VerificationResult.failure("身份证号与姓名不匹配");
                } else {
                    log.warn("[实名认证] 验证失败 - 状态: {}, 消息: {}", status, msg);
                    return VerificationResult.failure(msg);
                }
                
            } else {
                // 处理错误
                String errorMsg = handleErrorResponse(conn, httpCode);
                log.error("[实名认证] API调用失败 - HTTP状态: {}, 错误: {}", httpCode, errorMsg);
                return VerificationResult.failure(errorMsg);
            }
            
        } catch (Exception e) {
            log.error("[实名认证] 验证异常: {}", e.getMessage(), e);
            return VerificationResult.failure("实名认证服务异常，请稍后重试");
        }
    }
    
    /**
     * 验证身份证号格式
     */
    private boolean isValidIdCard(String idCard) {
        if (idCard == null) return false;
        // 支持15位和18位身份证
        if (idCard.length() == 15) {
            return idCard.matches("^\\d{15}$");
        } else if (idCard.length() == 18) {
            return idCard.matches("^\\d{17}[\\dXx]$");
        }
        return false;
    }
    
    /**
     * 读取响应内容
     */
    private String readResponse(HttpURLConnection conn) throws Exception {
        StringBuilder sb = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line);
            }
        }
        return sb.toString();
    }
    
    /**
     * 处理错误响应
     */
    private String handleErrorResponse(HttpURLConnection conn, int httpCode) {
        try {
            String errorHeader = conn.getHeaderField("X-Ca-Error-Message");
            if (errorHeader != null) {
                if (errorHeader.contains("Invalid AppCode")) {
                    return "认证服务配置错误";
                } else if (errorHeader.contains("Quota Exhausted")) {
                    return "认证服务配额已用完";
                } else if (errorHeader.contains("Unauthorized")) {
                    return "认证服务未授权";
                }
                return errorHeader;
            }
        } catch (Exception e) {
            log.error("读取错误响应失败", e);
        }
        return "认证服务请求失败(HTTP " + httpCode + ")";
    }
    
    /**
     * 姓名脱敏
     */
    private String maskName(String name) {
        if (name == null || name.length() < 2) return "***";
        return name.charAt(0) + "**";
    }
    
    /**
     * 验证结果类
     */
    public static class VerificationResult {
        private final boolean success;
        private final String message;
        
        private VerificationResult(boolean success, String message) {
            this.success = success;
            this.message = message;
        }
        
        public static VerificationResult success(String message) {
            return new VerificationResult(true, message);
        }
        
        public static VerificationResult failure(String message) {
            return new VerificationResult(false, message);
        }
        
        public boolean isSuccess() {
            return success;
        }
        
        public String getMessage() {
            return message;
        }
    }
}
