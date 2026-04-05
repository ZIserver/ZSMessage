package com.chatapp.service;

import com.chatapp.entity.UserLoginAttempt;
import com.chatapp.entity.UserGeetestRecord;
import com.chatapp.repository.UserLoginAttemptRepository;
import com.chatapp.repository.UserGeetestRecordRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * 用户登录安全服务
 * 处理登录失败计数、Geetest验证等安全相关逻辑
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class LoginSecurityService {
    
    private final UserLoginAttemptRepository loginAttemptRepository;
    private final UserGeetestRecordRepository geetestRecordRepository;
    private final GeetestService geetestService;
    
    /**
     * 登录失败阈值（超过此次数需要验证码）
     */
    private static final int FAILED_ATTEMPTS_THRESHOLD = 3;
    
    /**
     * 登录失败记录时间窗口（分钟）
     */
    private static final int FAILURE_TIME_WINDOW_MINUTES = 30;
    
    /**
     * 检查是否需要Geetest验证
     * @param username 用户名
     * @param ipAddress IP地址
     * @return 是否需要验证码
     */
    public boolean needsCaptcha(String username, String ipAddress) {
        LocalDateTime startTime = LocalDateTime.now().minusMinutes(FAILURE_TIME_WINDOW_MINUTES);
        
        // 检查用户名的失败次数
        long usernameFailures = loginAttemptRepository.countFailedAttemptsByUsername(username, startTime);
        if (usernameFailures >= FAILED_ATTEMPTS_THRESHOLD) {
            log.info("[登录安全] 用户 {} 需要验证码 - 失败次数: {}", username, usernameFailures);
            return true;
        }
        
        // 检查IP的失败次数
        long ipFailures = loginAttemptRepository.countFailedAttemptsByIp(ipAddress, startTime);
        if (ipFailures >= FAILED_ATTEMPTS_THRESHOLD) {
            log.info("[登录安全] IP {} 需要验证码 - 失败次数: {}", ipAddress, ipFailures);
            return true;
        }
        
        return false;
    }
    
    /**
     * 记录登录尝试
     * @param username 用户名
     * @param ipAddress IP地址
     * @param deviceType 设备类型
     * @param deviceInfo 设备信息
     * @param success 是否成功
     * @param failureReason 失败原因
     */
    @Transactional
    public void recordLoginAttempt(String username, String ipAddress, String deviceType, 
                                   String deviceInfo, boolean success, String failureReason) {
        UserLoginAttempt attempt = new UserLoginAttempt();
        attempt.setUsername(username);
        attempt.setIpAddress(ipAddress);
        attempt.setDeviceType(deviceType);
        attempt.setDeviceInfo(deviceInfo);
        attempt.setSuccess(success);
        attempt.setFailureReason(failureReason);
        
        loginAttemptRepository.save(attempt);
        
        if (!success) {
            log.warn("[登录安全] 登录失败 - 用户: {}, IP: {}, 原因: {}", username, ipAddress, failureReason);
        }
    }
    
    /**
     * 验证Geetest验证码
     * @param username 用户名
     * @param ipAddress IP地址
     * @param lotNumber lot_number
     * @param captchaOutput captcha_output
     * @param passToken pass_token
     * @param genTime gen_time
     * @return 验证是否通过
     */
    @Transactional
    public boolean verifyGeetestCaptcha(String username, String ipAddress, String lotNumber, 
                                       String captchaOutput, String passToken, String genTime) {
        // 1. 验证Geetest
        boolean valid = geetestService.verifyGeetest(lotNumber, captchaOutput, passToken, genTime);
        
        if (!valid) {
            log.warn("[登录安全] Geetest验证失败 - 用户: {}, IP: {}", username, ipAddress);
            return false;
        }
        
        // 2. 保存验证记录
        UserGeetestRecord record = new UserGeetestRecord();
        record.setUsername(username);
        record.setIpAddress(ipAddress);
        record.setLotNumber(lotNumber);
        record.setCaptchaOutput(captchaOutput);
        record.setPassToken(passToken);
        record.setGenTime(genTime);
        record.setVerified(true);
        record.setVerifiedAt(LocalDateTime.now());
        record.setExpiresAt(LocalDateTime.now().plusMinutes(5));
        
        geetestRecordRepository.save(record);
        
        log.info("[登录安全] Geetest验证通过 - 用户: {}, IP: {}", username, ipAddress);
        return true;
    }
    
    /**
     * 检测设备类型
     * @param userAgent User-Agent字符串
     * @return 设备类型: PC 或 MOBILE
     */
    public String detectDeviceType(String userAgent) {
        if (userAgent == null || userAgent.isEmpty()) {
            return "PC"; // 默认PC
        }
        
        String ua = userAgent.toLowerCase();
        
        // 移动设备检测
        if (ua.contains("android") || ua.contains("iphone") || ua.contains("ipad") || 
            ua.contains("mobile") || ua.contains("ios")) {
            return "MOBILE";
        }
        
        // 电脑设备（Electron, Windows, Mac, Linux）
        if (ua.contains("electron") || ua.contains("windows") || 
            ua.contains("mac") || ua.contains("linux") || ua.contains("x11")) {
            return "PC";
        }
        
        return "PC"; // 默认PC
    }
    
    /**
     * 清理过期记录（定时任务调用）
     */
    @Transactional
    public void cleanExpiredRecords() {
        LocalDateTime threshold = LocalDateTime.now().minusDays(30);
        
        // 清理登录尝试记录
        loginAttemptRepository.deleteByAttemptTimeBefore(threshold);
        
        // 清理Geetest记录
        geetestRecordRepository.deleteByExpiresAtBefore(LocalDateTime.now());
        
        log.info("[登录安全] 已清理过期记录");
    }
    
    /**
     * 清除指定用户的失败记录（登录成功后调用）
     * @param username 用户名
     */
    @Transactional
    public void clearFailedAttempts(String username) {
        loginAttemptRepository.deleteByUsernameAndSuccessFalse(username);
        log.info("[登录安全] 已清除用户 {} 的失败记录", username);
    }
}
