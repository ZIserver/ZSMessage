package com.chatapp.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "chat_groups")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ChatGroup {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * 群号 - 唯一标识，用于查找群
     * 范围: 10000001 - 999999999999
     */
    @Column(unique = true)
    private Long groupNumber;

    @Column(nullable = false, length = 100)
    private String groupName;

    @Column(length = 255)
    private String avatar;

    @Column(length = 500)
    private String description;

    @Column(nullable = false)
    private Long ownerId;

    @Column(columnDefinition = "TEXT")
    private String announcement;  // 群公告（兼容旧数据，新公告使用 GroupAnnouncement 表）

    @Column(length = 50)
    private String category;  // 群分类: IT, 科技, 学习, 文化, 娱乐, 生活, 游戏, 其他

    /**
     * 群邀请码 - 用于生成入群链接和二维码
     * 格式: 8位随机字符串
     */
    @Column(unique = true, length = 32)
    private String inviteCode;

    @Column(nullable = false)
    private Boolean requireApproval = false;  // 是否需要入群验证

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private LocalDateTime updatedAt;
}
