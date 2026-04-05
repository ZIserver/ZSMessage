package com.chatapp.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "group_messages")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class GroupMessage {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long groupId;

    @Column(nullable = false)
    private Long senderId;

    @Column(columnDefinition = "TEXT")
    private String content;

    @Column(length = 50)
    private String messageType = "TEXT"; // TEXT, IMAGE, FILE

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
    
    @Column(name = "is_read", nullable = false, columnDefinition = "BOOLEAN DEFAULT FALSE")
    private Boolean isRead = false;
    
    // 撤回相关字段
    @Column(name = "is_recalled", nullable = false, columnDefinition = "BOOLEAN DEFAULT FALSE")
    private Boolean isRecalled = false;
    
    @Column(name = "recalled_at")
    private LocalDateTime recalledAt;
    
    @Column(name = "recalled_by")
    private Long recalledBy; // 撤回者ID（可能是群主/管理员撤回成员消息）
}
