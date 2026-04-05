package com.chatapp.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * OAuth授权Token实体
 * 用于第三方应用通过ZSMessage账号登录
 */
@Entity
@Table(name = "oauth_tokens")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class OAuthToken {
    
    @Id
    @Column(length = 64)
    private String token;  // UUID Token
    
    @Column(nullable = false)
    private Long userId;   // 关联的用户ID
    
    @Column(length = 100)
    private String clientId;  // 第三方应用ID
    
    @Column(length = 255)
    private String redirectUri;  // 回调地址
    
    @Column(length = 100)
    private String scope;  // 授权范围 (userinfo, email等)
    
    @Column(length = 100)
    private String state;  // CSRF防护state参数
    
    @Column(nullable = false)
    private LocalDateTime expiresAt;  // 过期时间（3分钟）
    
    @Column(nullable = false)
    private Boolean used = false;  // 是否已使用（Token只能使用一次）
    
    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
    
    /**
     * 检查Token是否有效
     */
    public boolean isValid() {
        return !used && LocalDateTime.now().isBefore(expiresAt);
    }
}
