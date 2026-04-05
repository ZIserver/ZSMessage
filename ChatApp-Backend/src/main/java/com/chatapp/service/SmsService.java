package com.chatapp.service;

import com.chatapp.entity.SmsVerification;
import com.chatapp.repository.SmsVerificationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.Random;
import java.util.regex.Pattern;

@Service
@Slf4j
@RequiredArgsConstructor
public class SmsService {
    
    private final SmsVerificationRepository smsVerificationRepository;
    
    // 短信API配置（可以在application.properties中配置）
    @Value("${sms.api.url:https://api.smsbao.com/sms}")
    private String smsApiUrl;
    
    @Value("${sms.api.username:}")
    private String smsUsername;
    
    @Value("${sms.api.password:}")
    private String smsPassword;
    
    // 验证码有效期（分钟）
    private static final int CODE_EXPIRE_MINUTES = 5;
    
    // 发送间隔限制（秒）
    private static final int SEND_INTERVAL_SECONDS = 60;
    
    // 每小时最大发送次数
    private static final int MAX_SEND_PER_HOUR = 5;
    
    // 手机号正则
    private static final Pattern PHONE_PATTERN = Pattern.compile("^1[3-9]\\d{9}$");
    
    private final HttpClient httpClient = HttpClient.newHttpClient();
    
    /**
     * 发送短信验证码
     */
    @Transactional
    public void sendVerificationCode(String phone) {
        // 验证手机号格式
        if (!isValidPhone(phone)) {
            throw new RuntimeException("手机号格式不正确");
        }
        
        // 检查发送频率限制
        checkRateLimit(phone);
        
        // 生成6位验证码
        String code = generateCode();
        
        // 保存验证码
        LocalDateTime expiresAt = LocalDateTime.now().plusMinutes(CODE_EXPIRE_MINUTES);
        SmsVerification verification = new SmsVerification(phone, code, expiresAt);
        smsVerificationRepository.save(verification);
        
        // 发送短信
        boolean sent = sendSms(phone, code);
        if (!sent) {
            throw new RuntimeException("短信发送失败，请稍后重试");
        }
        
        log.info("验证码已发送到手机: {}", maskPhone(phone));
    }
    
    /**
     * 验证验证码
     */
    @Transactional
    public boolean verifyCode(String phone, String code) {
        if (!isValidPhone(phone) || code == null || code.length() != 6) {
            return false;
        }
        
        // 查找最新的未使用验证码
        var verificationOpt = smsVerificationRepository.findTopByPhoneAndUsedFalseOrderByCreatedAtDesc(phone);
        
        if (verificationOpt.isEmpty()) {
            log.warn("未找到验证码记录: {}", maskPhone(phone));
            return false;
        }
        
        SmsVerification verification = verificationOpt.get();
        
        // 检查是否过期
        if (verification.isExpired()) {
            log.warn("验证码已过期: {}", maskPhone(phone));
            return false;
        }
        
        // 验证码匹配
        if (!verification.getCode().equals(code)) {
            log.warn("验证码不匹配: {}", maskPhone(phone));
            return false;
        }
        
        // 标记为已使用
        verification.setUsed(true);
        smsVerificationRepository.save(verification);
        
        log.info("验证码验证成功: {}", maskPhone(phone));
        return true;
    }
    
    /**
     * 检查发送频率限制
     */
    private void checkRateLimit(String phone) {
        // 检查1分钟内是否发送过
        LocalDateTime oneMinuteAgo = LocalDateTime.now().minusSeconds(SEND_INTERVAL_SECONDS);
        long recentCount = smsVerificationRepository.countByPhoneAndCreatedAtAfter(phone, oneMinuteAgo);
        if (recentCount > 0) {
            throw new RuntimeException("发送太频繁，请" + SEND_INTERVAL_SECONDS + "秒后重试");
        }
        
        // 检查1小时内发送次数
        LocalDateTime oneHourAgo = LocalDateTime.now().minusHours(1);
        long hourCount = smsVerificationRepository.countByPhoneAndCreatedAtAfter(phone, oneHourAgo);
        if (hourCount >= MAX_SEND_PER_HOUR) {
            throw new RuntimeException("该手机号发送次数过多，请1小时后重试");
        }
    }
    
    /**
     * 生成6位数字验证码
     */
    private String generateCode() {
        Random random = new Random();
        int code = 100000 + random.nextInt(900000);
        return String.valueOf(code);
    }
    
    /**
     * 发送短信（集成短信宝 SMSBAO API）
     * API文档: http://www.smsbao.com/openapi
     */
    private boolean sendSms(String phone, String code) {
        try {
            // 如果没有配置短信API，使用模拟发送（开发模式）
            if (smsUsername == null || smsUsername.isEmpty()) {
                log.warn("[开发模式] 短信验证码: {} -> {}", maskPhone(phone), code);
                return true;
            }
            
            // 构建短信内容
            String content = "【小智穗】验证码" + code + ",5分钟内有效,请勿泄漏于他人";
            
            // 短信宝密码需要MD5加密
            String passwordMd5 = md5(smsPassword);
            
            // 构建请求URL（短信宝API格式）
            // http://api.smsbao.com/sms?u=用户名&p=密码MD5&m=手机号&c=内容
            String url = String.format("%s?u=%s&p=%s&m=%s&c=%s",
                smsApiUrl,
                java.net.URLEncoder.encode(smsUsername, StandardCharsets.UTF_8),
                passwordMd5,
                phone,
                java.net.URLEncoder.encode(content, StandardCharsets.UTF_8)
            );
            
            log.debug("短信宝请求URL: {}", url.replaceAll("p=[^&]+", "p=***"));
            
            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .GET()
                .build();
            
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            String result = response.body().trim();
            
            // 短信宝返回码
            // 0: 成功, -1: 参数不完整, -2: 服务器空间不支持, 
            // 30: 密码错误, 40: 账号不存在, 41: 余额不足,
            // 43: IP限制, 50: 内容含敏感词, 51: 手机号错误
            if ("0".equals(result)) {
                log.info("短信发送成功: {}", maskPhone(phone));
                return true;
            } else {
                String errorMsg = getSmsBaoErrorMessage(result);
                log.error("短信发送失败: {} - 错误码:{} ({})", maskPhone(phone), result, errorMsg);
                return false;
            }
        } catch (Exception e) {
            log.error("短信发送异常: {}", e.getMessage(), e);
            return false;
        }
    }
    
    /**
     * MD5加密（短信宝要求密码MD5加密）
     */
    private String md5(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("MD5");
            byte[] digest = md.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : digest) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (Exception e) {
            throw new RuntimeException("MD5加密失败", e);
        }
    }
    
    /**
     * 短信宝错误码说明
     */
    private String getSmsBaoErrorMessage(String code) {
        return switch (code) {
            case "0" -> "发送成功";
            case "-1" -> "参数不完整";
            case "-2" -> "服务器空间不支持";
            case "30" -> "密码错误";
            case "40" -> "账号不存在";
            case "41" -> "余额不足";
            case "42" -> "账号过期";
            case "43" -> "IP地址受限";
            case "50" -> "内容含敏感词";
            case "51" -> "手机号码不正确";
            default -> "未知错误";
        };
    }
    
    /**
     * 验证手机号格式
     */
    public boolean isValidPhone(String phone) {
        return phone != null && PHONE_PATTERN.matcher(phone).matches();
    }
    
    /**
     * 脱敏手机号（显示前3后4）
     */
    private String maskPhone(String phone) {
        if (phone == null || phone.length() != 11) {
            return "***";
        }
        return phone.substring(0, 3) + "****" + phone.substring(7);
    }
    
    /**
     * 清理过期验证码（定时任务调用）
     */
    @Transactional
    public void cleanExpiredCodes() {
        smsVerificationRepository.deleteByExpiresAtBefore(LocalDateTime.now());
        log.debug("已清理过期验证码");
    }
}
