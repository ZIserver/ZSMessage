package com.chatapp.service;

import com.chatapp.entity.UserToken;
import com.chatapp.repository.UserTokenRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TokenService {
    
    private final UserTokenRepository tokenRepository;
    
    // Token 有效期：30天
    private static final int TOKEN_EXPIRY_DAYS = 30;
    
    /**
     * 生成并保存新的 Token（支持设备类型）
     * @param userId 用户ID
     * @param deviceInfo 设备信息
     * @param deviceType 设备类型: PC, MOBILE
     * @return Token字符串
     */
    @Transactional
    public String generateToken(Long userId, String deviceInfo, String deviceType) {
        // 踢出同类型设备的旧会话
        kickSameTypeDeviceSessions(userId, deviceType);
        
        // 生成唯一 Token
        String token = UUID.randomUUID().toString() + "-" + System.currentTimeMillis();
        
        // 创建 Token 记录
        UserToken userToken = new UserToken();
        userToken.setUserId(userId);
        userToken.setToken(token);
        userToken.setDeviceInfo(deviceInfo);
        userToken.setDeviceType(deviceType);
        userToken.setExpiresAt(LocalDateTime.now().plusDays(TOKEN_EXPIRY_DAYS));
        userToken.setIsActive(true);
        
        tokenRepository.save(userToken);
        
        return token;
    }
    
    /**
     * 生成并保存新的 Token（兼容旧版本）
     */
    @Transactional
    public String generateToken(Long userId, String deviceInfo) {
        // 默认为PC设备
        return generateToken(userId, deviceInfo, "PC");
    }
    
    /**
     * 验证 Token 是否有效
     */
    public boolean validateToken(String token) {
        Optional<UserToken> userToken = tokenRepository.findByToken(token);
        
        if (userToken.isEmpty()) {
            return false;
        }
        
        UserToken tokenEntity = userToken.get();
        
        // 检查是否过期
        if (tokenEntity.getExpiresAt() != null && 
            tokenEntity.getExpiresAt().isBefore(LocalDateTime.now())) {
            // Token 已过期，删除
            tokenRepository.delete(tokenEntity);
            return false;
        }
        
        // 更新最后使用时间
        tokenEntity.setLastUsedAt(LocalDateTime.now());
        tokenRepository.save(tokenEntity);
        
        return true;
    }
    
    /**
     * 根据 Token 获取用户 ID
     */
    public Optional<Long> getUserIdByToken(String token) {
        return tokenRepository.findByToken(token)
                .filter(t -> t.getExpiresAt() == null || t.getExpiresAt().isAfter(LocalDateTime.now()))
                .map(UserToken::getUserId);
    }
    
    /**
     * 删除用户的所有 Token（退出登录）
     */
    @Transactional
    public void revokeAllUserTokens(Long userId) {
        tokenRepository.deleteByUserId(userId);
    }
    
    /**
     * 删除指定 Token
     */
    @Transactional
    public void revokeToken(String token) {
        tokenRepository.findByToken(token).ifPresent(tokenRepository::delete);
    }
    
    /**
     * 清理过期的 Token
     */
    @Transactional
    public void cleanExpiredTokens() {
        tokenRepository.deleteByExpiresAtBefore(LocalDateTime.now());
    }
    
    /**
     * 踢出同类型设备的旧会话
     * @param userId 用户ID
     * @param deviceType 设备类型
     */
    @Transactional
    public void kickSameTypeDeviceSessions(Long userId, String deviceType) {
        if (deviceType == null || deviceType.isEmpty()) {
            return;
        }
        
        // 查找用户同类型设备的所有活跃Token
        List<UserToken> existingTokens = tokenRepository.findByUserId(userId);
        LocalDateTime now = LocalDateTime.now();
        
        for (UserToken token : existingTokens) {
            // 过滤相同设备类型且活跃的Token
            if (deviceType.equals(token.getDeviceType()) && 
                token.getIsActive() != null && token.getIsActive() &&
                (token.getExpiresAt() == null || token.getExpiresAt().isAfter(now))) {
                
                // 设置为不活跃
                token.setIsActive(false);
                token.setKickedAt(now);
                token.setKickedReason("该设备类型在其他设备上登录");
                tokenRepository.save(token);
            }
        }
    }
}
