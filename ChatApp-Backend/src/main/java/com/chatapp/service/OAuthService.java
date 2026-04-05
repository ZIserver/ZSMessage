package com.chatapp.service;

import com.chatapp.entity.OAuthToken;
import com.chatapp.entity.User;
import com.chatapp.repository.OAuthTokenRepository;
import com.chatapp.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * OAuth服务
 * 处理第三方应用授权登录
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OAuthService {
    
    private final OAuthTokenRepository oAuthTokenRepository;
    private final UserRepository userRepository;
    
    // Token有效期：3分钟
    private static final int TOKEN_EXPIRY_MINUTES = 3;
    
    /**
     * 创建OAuth授权Token
     * @param userId 用户ID
     * @param clientId 第三方应用ID
     * @param redirectUri 回调地址
     * @param scope 授权范围
     * @param state CSRF防护参数
     * @return 生成的Token
     */
    @Transactional
    public String createToken(Long userId, String clientId, String redirectUri, String scope, String state) {
        // 生成唯一Token
        String token = UUID.randomUUID().toString().replace("-", "");
        
        OAuthToken oAuthToken = new OAuthToken();
        oAuthToken.setToken(token);
        oAuthToken.setUserId(userId);
        oAuthToken.setClientId(clientId);
        oAuthToken.setRedirectUri(redirectUri);
        oAuthToken.setScope(scope != null ? scope : "userinfo");
        oAuthToken.setState(state);
        oAuthToken.setExpiresAt(LocalDateTime.now().plusMinutes(TOKEN_EXPIRY_MINUTES));
        oAuthToken.setUsed(false);
        
        oAuthTokenRepository.save(oAuthToken);
        
        log.info("[OAuth] 创建Token: {} 用户ID: {} 客户端: {}", token, userId, clientId);
        
        return token;
    }
    
    /**
     * 验证Token并获取用户数据
     * Token验证后会被标记为已使用，不可再次使用
     * @param token OAuth Token
     * @return 用户数据Map，如果Token无效则返回null
     */
    @Transactional
    public Map<String, Object> validateAndGetUserData(String token) {
        Optional<OAuthToken> optionalToken = oAuthTokenRepository.findValidToken(token, LocalDateTime.now());
        
        if (optionalToken.isEmpty()) {
            log.warn("[OAuth] Token无效或已过期: {}", token);
            return null;
        }
        
        OAuthToken oAuthToken = optionalToken.get();
        
        // 标记Token为已使用
        oAuthTokenRepository.markAsUsed(token);
        
        // 获取用户信息
        Optional<User> optionalUser = userRepository.findById(oAuthToken.getUserId());
        if (optionalUser.isEmpty()) {
            log.error("[OAuth] 用户不存在: {}", oAuthToken.getUserId());
            return null;
        }
        
        User user = optionalUser.get();
        
        // 构建返回数据
        Map<String, Object> userData = new HashMap<>();
        userData.put("user_id", user.getId());
        userData.put("zs_number", user.getZsNumber());  // 智穗号
        userData.put("username", user.getUsername());
        userData.put("nickname", user.getNickname());
        userData.put("avatar", user.getAvatar());
        
        // 根据scope决定是否返回邮箱
        String scope = oAuthToken.getScope();
        if (scope != null && scope.contains("email")) {
            userData.put("email", user.getEmail());
        }
        
        log.info("[OAuth] Token验证成功: {} 用户: {}", token, user.getUsername());
        
        return userData;
    }
    
    /**
     * 获取Token信息（不消费）
     * @param token OAuth Token
     * @return Token实体
     */
    public Optional<OAuthToken> getTokenInfo(String token) {
        return oAuthTokenRepository.findValidToken(token, LocalDateTime.now());
    }
    
    /**
     * 检查Token是否有效
     * @param token OAuth Token
     * @return 是否有效
     */
    public boolean isTokenValid(String token) {
        return oAuthTokenRepository.findValidToken(token, LocalDateTime.now()).isPresent();
    }
    
    /**
     * 定时清理过期Token（每小时执行一次）
     */
    @Scheduled(fixedRate = 3600000)
    @Transactional
    public void cleanupExpiredTokens() {
        oAuthTokenRepository.deleteExpiredTokens(LocalDateTime.now());
        log.info("[OAuth] 已清理过期Token");
    }
}
