package com.chatapp.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "user_warnings")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class UserWarning {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "admin_id", nullable = false)
    private Long adminId;

    @Column(name = "reason", nullable = false, length = 500)
    private String reason;

    @Column(name = "warning_level", nullable = false)
    private Integer warningLevel = 1; // 1-一般警告, 2-严重警告, 3-最后警告

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}