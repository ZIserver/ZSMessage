package com.chatapp.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * 群公告实体 - 独立数据表存储
 */
@Entity
@Table(name = "group_announcements")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class GroupAnnouncement {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long groupId;  // 关联的群ID

    @Column(nullable = false)
    private Long publisherId;  // 发布者ID

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;  // 公告内容

    @Column(nullable = false)
    private Boolean isPinned = false;  // 是否置顶

    @Column(nullable = false)
    private Boolean isDeleted = false;  // 是否已删除（软删除）

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private LocalDateTime updatedAt;
}
