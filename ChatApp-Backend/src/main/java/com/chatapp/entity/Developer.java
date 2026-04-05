package com.chatapp.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * 开发者实体
 * 独立的开发者账户系统，通过智穗语聊OAuth绑定
 */
@Entity
@Table(name = "developers")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Developer {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    /**
     * 关联的智穗语聊用户ID（OAuth绑定）
     */
    @Column(nullable = false, unique = true)
    private Long userId;
    
    /**
     * 智穗语聊用户名（冗余存储，方便显示）
     */
    @Column(length = 100)
    private String username;
    
    /**
     * 智穗语聊昵称（冗余存储，方便显示）
     */
    @Column(length = 100)
    private String nickname;
    
    /**
     * 智穗语聊头像URL（冗余存储）
     */
    @Column(length = 500)
    private String avatarUrl;
    
    /**
     * 实名认证姓名
     */
    @Column(length = 50)
    private String realName;
    
    /**
     * 身份证号（加密存储，仅保留后4位明文用于显示）
     */
    @Column(length = 100)
    private String idCard;
    
    /**
     * 身份证后4位（用于显示验证状态）
     */
    @Column(length = 4)
    private String idCardLast4;
    
    /**
     * 是否已实名认证
     */
    @Column(nullable = false)
    private Boolean verified = false;
    
    /**
     * 实名认证时间
     */
    private LocalDateTime verifiedAt;
    
    /**
     * 开发者状态: ACTIVE, DISABLED, BANNED
     */
    @Column(nullable = false, length = 20)
    private String status = "ACTIVE";
    
    /**
     * 开发者Token（用于API认证）
     */
    @Column(length = 128, unique = true)
    private String developerToken;
    
    /**
     * Token过期时间
     */
    private LocalDateTime tokenExpiresAt;
    
    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
    
    @UpdateTimestamp
    @Column(nullable = false)
    private LocalDateTime updatedAt;
    
    /**
     * 检查开发者是否激活
     */
    public boolean isActive() {
        return "ACTIVE".equals(this.status);
    }
    
    /**
     * 检查Token是否有效
     */
    public boolean isTokenValid() {
        return developerToken != null && 
               tokenExpiresAt != null && 
               tokenExpiresAt.isAfter(LocalDateTime.now());
    }
    
    /**
     * 获取身份证脱敏显示
     */
    public String getMaskedIdCard() {
        if (idCardLast4 == null) {
            return null;
        }
        return "**************" + idCardLast4;
    }
}
