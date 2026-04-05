package com.chatapp.entity;

import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;

import jakarta.persistence.*;
import java.time.LocalDateTime;

import com.chatapp.entity.SystemMessageType;

@Entity
@Table(name = "system_messages")
@Data
public class SystemMessage {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "message_type", nullable = false)
    private SystemMessageType messageType; // BAN, WARN, DELETE

    @Column(name = "message_content", nullable = false, length = 500)
    private String messageContent;

    @Column(name = "reason", length = 500)
    private String reason;

    @Column(name = "admin_id")
    private Long adminId;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "expires_at")
    private LocalDateTime expiresAt;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;
}

