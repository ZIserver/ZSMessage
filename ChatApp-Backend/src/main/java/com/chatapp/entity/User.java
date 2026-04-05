package com.chatapp.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "users")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false, length = 50)
    private String username;

    @Column(nullable = false)
    private String password;

    @Column(length = 100)
    private String nickname;

    @Column(length = 255)
    private String avatar;

    @Column(length = 200)
    private String bio;
    
    @Column(unique = true, length = 255)
    private String email;
    
    @Column(name = "email_verified")
    private Boolean emailVerified = false;

    @Column(nullable = false)
    private Boolean online = false;

    @Column(nullable = false, columnDefinition = "INT DEFAULT 1")
    private Integer status = 1; // 1-正常, 0-封禁, 2-不安全
    
    @Column(length = 20)
    private String phone; // 手机号
    
    @Column(name = "phone_verified")
    private Boolean phoneVerified = false; // 手机号是否已验证
    
    @Column(name = "zs_number", unique = true)
    private Long zsNumber; // 智穗号，类似QQ号，从100000001开始

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private LocalDateTime updatedAt;
}
