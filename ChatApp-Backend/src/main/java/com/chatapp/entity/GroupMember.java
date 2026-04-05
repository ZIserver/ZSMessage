package com.chatapp.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "group_members")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class GroupMember {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long groupId;

    @Column(nullable = false)
    private Long userId;

    @Column(length = 50)
    private String role = "MEMBER"; // OWNER, ADMIN, MEMBER
    
    @Column
    private LocalDateTime muteUntil; // 禁言截止时间，null表示未禁言

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime joinedAt;
    
    // 检查是否处于禁言状态
    public boolean isMuted() {
        return muteUntil != null && LocalDateTime.now().isBefore(muteUntil);
    }
}
