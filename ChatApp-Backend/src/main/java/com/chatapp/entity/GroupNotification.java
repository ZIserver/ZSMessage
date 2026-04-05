package com.chatapp.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "group_notifications")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class GroupNotification {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long userId;  // 接收通知的用户

    @Column(nullable = false)
    private Long groupId;

    @Column(nullable = false)
    private String notificationType;  // JOIN_REQUEST, KICKED, PROMOTED_TO_ADMIN, DEMOTED_FROM_ADMIN, INVITED, APPROVED

    @Column(nullable = false)
    private Long fromUserId;  // 发起操作的用户

    @Column(length = 500)
    private String message;

    @Column(nullable = false)
    private Boolean isRead = false;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
