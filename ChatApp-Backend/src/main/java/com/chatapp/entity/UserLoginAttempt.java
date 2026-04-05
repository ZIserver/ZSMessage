package com.chatapp.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * 用户登录尝试记录
 * 用于跟踪登录失败次数，触发Geetest验证
 */
@Entity
@Table(name = "user_login_attempts")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class UserLoginAttempt {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    /**
     * 用户ID（成功登录后填充）
     */
    @Column(name = "user_id")
    private Long userId;
    
    /**
     * 尝试登录的用户名
     */
    @Column(length = 100)
    private String username;
    
    /**
     * 登录IP地址
     */
    @Column(name = "ip_address", nullable = false, length = 50)
    private String ipAddress;
    
    /**
     * 设备类型: PC, MOBILE
     */
    @Column(name = "device_type", length = 20)
    private String deviceType;
    
    /**
     * 设备信息（User-Agent）
     */
    @Column(name = "device_info", length = 500)
    private String deviceInfo;
    
    /**
     * 尝试时间
     */
    @CreationTimestamp
    @Column(name = "attempt_time", nullable = false)
    private LocalDateTime attemptTime;
    
    /**
     * 是否成功
     */
    @Column(nullable = false)
    private Boolean success = false;
    
    /**
     * 失败原因
     */
    @Column(name = "failure_reason", length = 200)
    private String failureReason;
}
