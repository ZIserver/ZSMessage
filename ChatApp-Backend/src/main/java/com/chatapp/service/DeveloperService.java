package com.chatapp.service;

import com.chatapp.entity.Developer;
import com.chatapp.repository.DeveloperRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.Cipher;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.Optional;
import java.util.UUID;

/**
 * 开发者服务
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class DeveloperService {
    
    private final DeveloperRepository developerRepository;
    private final IdentityVerificationService identityVerificationService;
    
    /**
     * Token有效期（天）
     */
    private static final int TOKEN_VALIDITY_DAYS = 30;
    
    /**
     * 加密配置（与MessageEncryptionService保持一致）
     */
    private static final String SECRET_KEY = "ZSMESSAGENB114514-MESSAGEJIAMI";
    private static final String ALGORITHM = "AES/CBC/PKCS5Padding";
    private static final int IV_LENGTH = 16;
    
    /**
     * 通过OAuth登录/注册开发者
     * @param userId 智穗语聊用户ID
     * @param username 用户名
     * @param nickname 昵称
     * @param avatarUrl 头像URL
     * @return 开发者信息和Token
     */
    @Transactional
    public DeveloperLoginResult loginOrRegister(Long userId, String username, String nickname, String avatarUrl) {
        log.info("[开发者] OAuth登录/注册 - userId: {}, username: {}", userId, username);
        
        Optional<Developer> existingDeveloper = developerRepository.findByUserId(userId);
        
        if (existingDeveloper.isPresent()) {
            // 已注册，直接登录
            Developer developer = existingDeveloper.get();
            
            // 检查状态
            if (!developer.isActive()) {
                log.warn("[开发者] 账户已被禁用 - userId: {}", userId);
                throw new RuntimeException("开发者账户已被禁用");
            }
            
            // 更新用户信息（可能已变更）
            developer.setUsername(username);
            developer.setNickname(nickname);
            developer.setAvatarUrl(avatarUrl);
            
            // 生成新Token
            String token = generateToken(developer.getId());
            LocalDateTime expiresAt = LocalDateTime.now().plusDays(TOKEN_VALIDITY_DAYS);
            developer.setDeveloperToken(token);
            developer.setTokenExpiresAt(expiresAt);
            
            developerRepository.save(developer);
            log.info("[开发者] 登录成功 - developerId: {}", developer.getId());
            
            return new DeveloperLoginResult(developer, token, false);
        } else {
            // 新注册
            Developer developer = new Developer();
            developer.setUserId(userId);
            developer.setUsername(username);
            developer.setNickname(nickname);
            developer.setAvatarUrl(avatarUrl);
            developer.setVerified(false);
            developer.setStatus("ACTIVE");
            
            // 生成Token
            String token = generateToken(userId);
            LocalDateTime expiresAt = LocalDateTime.now().plusDays(TOKEN_VALIDITY_DAYS);
            developer.setDeveloperToken(token);
            developer.setTokenExpiresAt(expiresAt);
            
            developer = developerRepository.save(developer);
            log.info("[开发者] 注册成功 - developerId: {}", developer.getId());
            
            return new DeveloperLoginResult(developer, token, true);
        }
    }
    
    /**
     * 检查用户是否已注册为开发者
     */
    public boolean isRegistered(Long userId) {
        return developerRepository.existsByUserId(userId);
    }
    
    /**
     * 根据Token获取开发者
     */
    public Optional<Developer> getDeveloperByToken(String token) {
        if (token == null || token.isEmpty()) {
            return Optional.empty();
        }
        return developerRepository.findByValidToken(token, LocalDateTime.now());
    }
    
    /**
     * 根据ID获取开发者
     */
    public Optional<Developer> getDeveloperById(Long id) {
        return developerRepository.findById(id);
    }
    
    /**
     * 根据用户ID获取开发者
     */
    public Optional<Developer> getDeveloperByUserId(Long userId) {
        return developerRepository.findByUserId(userId);
    }
    
    /**
     * 验证开发者Token
     */
    public boolean validateToken(String token) {
        return getDeveloperByToken(token).isPresent();
    }
    
    /**
     * 从Token获取开发者ID
     */
    public Optional<Long> getDeveloperIdByToken(String token) {
        return getDeveloperByToken(token).map(Developer::getId);
    }
    
    /**
     * 实名认证
     */
    @Transactional
    public VerificationResult verifyIdentity(Long developerId, String realName, String idCard) {
        log.info("[开发者] 实名认证请求 - developerId: {}", developerId);
        
        Developer developer = developerRepository.findById(developerId)
                .orElseThrow(() -> new RuntimeException("开发者不存在"));
        
        // 检查是否已认证
        if (developer.getVerified()) {
            return new VerificationResult(false, "您已完成实名认证，无需重复认证");
        }
        
        // 调用实名认证服务
        IdentityVerificationService.VerificationResult result = 
                identityVerificationService.verifyIdentity(realName, idCard);
        
        if (result.isSuccess()) {
            // 认证成功，更新开发者信息
            String encryptedIdCard = encryptIdCard(idCard);
            String idCardLast4 = idCard.substring(idCard.length() - 4);
            
            developer.setRealName(realName);
            developer.setIdCard(encryptedIdCard);
            developer.setIdCardLast4(idCardLast4);
            developer.setVerified(true);
            developer.setVerifiedAt(LocalDateTime.now());
            
            developerRepository.save(developer);
            log.info("[开发者] 实名认证成功 - developerId: {}", developerId);
            
            return new VerificationResult(true, "实名认证成功");
        } else {
            log.warn("[开发者] 实名认证失败 - developerId: {}, reason: {}", developerId, result.getMessage());
            return new VerificationResult(false, result.getMessage());
        }
    }
    
    /**
     * 刷新Token
     */
    @Transactional
    public String refreshToken(Long developerId) {
        Developer developer = developerRepository.findById(developerId)
                .orElseThrow(() -> new RuntimeException("开发者不存在"));
        
        String newToken = generateToken(developerId);
        LocalDateTime expiresAt = LocalDateTime.now().plusDays(TOKEN_VALIDITY_DAYS);
        
        developer.setDeveloperToken(newToken);
        developer.setTokenExpiresAt(expiresAt);
        developerRepository.save(developer);
        
        log.info("[开发者] Token已刷新 - developerId: {}", developerId);
        return newToken;
    }
    
    /**
     * 退出登录（使Token失效）
     */
    @Transactional
    public void logout(Long developerId) {
        Developer developer = developerRepository.findById(developerId).orElse(null);
        if (developer != null) {
            developer.setDeveloperToken(null);
            developer.setTokenExpiresAt(null);
            developerRepository.save(developer);
            log.info("[开发者] 已退出登录 - developerId: {}", developerId);
        }
    }
    
    /**
     * 生成Token
     */
    private String generateToken(Long id) {
        String raw = id + "_" + UUID.randomUUID().toString() + "_" + System.currentTimeMillis();
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(raw.getBytes());
            return "dev_" + Base64.getUrlEncoder().withoutPadding().encodeToString(hash);
        } catch (Exception e) {
            return "dev_" + UUID.randomUUID().toString().replace("-", "");
        }
    }
    
    /**
     * 加密身份证号（使用AES-256-CBC加密，与消息加密保持一致）
     */
    private String encryptIdCard(String idCard) {
        if (idCard == null || idCard.isEmpty()) {
            return idCard;
        }
        
        try {
            // 生成密钥（使用SHA-256）
            MessageDigest sha = MessageDigest.getInstance("SHA-256");
            byte[] keyBytes = sha.digest(SECRET_KEY.getBytes(StandardCharsets.UTF_8));
            SecretKeySpec secretKeySpec = new SecretKeySpec(keyBytes, "AES");
            
            // 生成随机IV
            byte[] iv = new byte[IV_LENGTH];
            new SecureRandom().nextBytes(iv);
            IvParameterSpec ivSpec = new IvParameterSpec(iv);
            
            // 加密
            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.ENCRYPT_MODE, secretKeySpec, ivSpec);
            byte[] encrypted = cipher.doFinal(idCard.getBytes(StandardCharsets.UTF_8));
            
            // 返回 IV:密文 格式（与消息加密格式一致）
            String ivBase64 = Base64.getEncoder().encodeToString(iv);
            String cipherBase64 = Base64.getEncoder().encodeToString(encrypted);
            
            return ivBase64 + ":" + cipherBase64;
        } catch (Exception e) {
            log.error("身份证号加密失败: {}", e.getMessage());
            // 加密失败返回原文（不推荐，但保证服务可用）
            return idCard;
        }
    }
    
    /**
     * 登录结果
     */
    public static class DeveloperLoginResult {
        private final Developer developer;
        private final String token;
        private final boolean isNewRegistration;
        
        public DeveloperLoginResult(Developer developer, String token, boolean isNewRegistration) {
            this.developer = developer;
            this.token = token;
            this.isNewRegistration = isNewRegistration;
        }
        
        public Developer getDeveloper() {
            return developer;
        }
        
        public String getToken() {
            return token;
        }
        
        public boolean isNewRegistration() {
            return isNewRegistration;
        }
    }
    
    /**
     * 验证结果
     */
    public static class VerificationResult {
        private final boolean success;
        private final String message;
        
        public VerificationResult(boolean success, String message) {
            this.success = success;
            this.message = message;
        }
        
        public boolean isSuccess() {
            return success;
        }
        
        public String getMessage() {
            return message;
        }
    }
}
