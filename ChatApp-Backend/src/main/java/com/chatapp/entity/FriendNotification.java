package com.chatapp.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "friend_notifications")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class FriendNotification {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long userId;  // 接收通知的用户

    @Column(nullable = false)
    private Long fromUserId;  // 发起好友申请的用户

    @Column(nullable = false)
    private String notificationType;  // FRIEND_REQUEST, FRIEND_ACCEPTED, FRIEND_REJECTED

    @Column(length = 500)
    private String message;

    @Column(nullable = false)
    private Boolean isRead = false;

    @Column(nullable = false)
    private String status = "PENDING";  // PENDING, ACCEPTED, REJECTED

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
