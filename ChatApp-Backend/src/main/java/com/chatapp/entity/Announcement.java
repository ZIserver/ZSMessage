package com.chatapp.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

/**
 * 公告实体
 */
@Entity
@Table(name = "announcements")
@Data
public class Announcement {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    /**
     * 公告标题
     */
    @Column(nullable = false, length = 200)
    private String title;
    
    /**
     * 公告内容
     */
    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;
    
    /**
     * 公告类型：notice(普通公告), important(重要公告), maintenance(维护公告)
     */
    @Column(nullable = false, length = 20)
    private String type = "notice";
    
    /**
     * 是否启用
     */
    @Column(nullable = false)
    private Boolean enabled = true;
    
    /**
     * 优先级（数字越大越优先）
     */
    @Column(nullable = false)
    private Integer priority = 0;
    
    /**
     * 创建时间
     */
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
    
    /**
     * 更新时间
     */
    private LocalDateTime updatedAt;
    
    /**
     * 发布时间
     */
    private LocalDateTime publishedAt;
    
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }
    
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
