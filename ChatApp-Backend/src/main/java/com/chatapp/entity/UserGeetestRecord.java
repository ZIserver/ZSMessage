package com.chatapp.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * 用户Geetest验证记录
 * 防止绕过验证机制
 */
@Entity
@Table(name = "user_geetest_records")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class UserGeetestRecord {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    /**
     * 用户名
     */
    @Column(nullable = false, length = 100)
    private String username;
    
    /**
     * IP地址
     */
    @Column(name = "ip_address", nullable = false, length = 50)
    private String ipAddress;
    
    /**
     * Geetest lot_number（GT4必需）
     */
    @Column(name = "lot_number", nullable = false, length = 100)
    private String lotNumber;
    
    /**
     * Geetest captcha_output（GT4必需）
     */
    @Column(name = "captcha_output", nullable = false, length = 500)
    private String captchaOutput;
    
    /**
     * Geetest pass_token（GT4必需）
     */
    @Column(name = "pass_token", nullable = false, length = 500)
    private String passToken;
    
    /**
     * Geetest gen_time（GT4必需）
     */
    @Column(name = "gen_time", nullable = false, length = 50)
    private String genTime;
    
    /**
     * 是否已验证
     */
    @Column(nullable = false)
    private Boolean verified = false;
    
    /**
     * 验证时间
     */
    @Column(name = "verified_at")
    private LocalDateTime verifiedAt;
    
    /**
     * 过期时间（5分钟）
     */
    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;
    
    /**
     * 创建时间
     */
    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
