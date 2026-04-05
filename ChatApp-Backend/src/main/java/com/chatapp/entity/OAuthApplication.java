package com.chatapp.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * OAuth应用实体
 * 用于开发者创建和管理OAuth应用
 */
@Entity
@Table(name = "oauth_applications")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class OAuthApplication {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    /**
     * 创建者用户ID（兼容旧数据）
     */
    @Column(nullable = true)
    private Long userId;
    
    /**
     * 开发者ID（新的关联字段）
     */
    @Column(nullable = true)
    private Long developerId;
    
    /**
     * 应用名称
     */
    @Column(nullable = false, length = 100)
    private String appName;
    
    /**
     * 应用ID (自动生成的唯一标识)
     */
    @Column(nullable = false, unique = true, length = 32)
    private String appId;
    
    /**
     * 应用密钥 (自动生成)
     */
    @Column(nullable = false, length = 64)
    private String appSecret;
    
    /**
     * 回调地址
     */
    @Column(nullable = false, length = 500)
    private String redirectUri;
    
    /**
     * 应用描述
     */
    @Column(length = 500)
    private String description;
    
    /**
     * 应用图标URL
     */
    @Column(length = 255)
    private String iconUrl;
    
    /**
     * 应用状态: ACTIVE, DISABLED
     */
    @Column(nullable = false, length = 20)
    private String status = "ACTIVE";
    
    /**
     * 应用主页URL
     */
    @Column(length = 255)
    private String homepageUrl;
    
    /**
     * 隐私政策URL
     */
    @Column(length = 255)
    private String privacyUrl;
    
    /**
     * 授权次数统计
     */
    @Column(nullable = false)
    private Long authCount = 0L;
    
    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
    
    @UpdateTimestamp
    @Column(nullable = false)
    private LocalDateTime updatedAt;
    
    /**
     * 生成应用ID
     */
    public static String generateAppId() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 16);
    }
    
    /**
     * 生成应用密钥
     */
    public static String generateAppSecret() {
        return UUID.randomUUID().toString().replace("-", "") + 
               UUID.randomUUID().toString().replace("-", "").substring(0, 16);
    }
    
    /**
     * 重新生成密钥
     */
    public void regenerateSecret() {
        this.appSecret = generateAppSecret();
    }
    
    /**
     * 检查应用是否激活
     */
    public boolean isActive() {
        return "ACTIVE".equals(this.status);
    }
    
    /**
     * 增加授权次数
     */
    public void incrementAuthCount() {
        this.authCount++;
    }
}
