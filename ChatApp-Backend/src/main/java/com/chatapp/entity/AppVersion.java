package com.chatapp.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Table(name = "app_versions")
@Data
public class AppVersion {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false, unique = true)
    private String version; // 版本号，如 1.0.0
    
    @Column(nullable = false)
    private String platform; // 平台：windows, mac, linux
    
    @Column(nullable = false, columnDefinition = "TEXT")
    private String downloadUrl; // 下载地址
    
    @Column(columnDefinition = "TEXT")
    private String releaseNotes; // 更新说明
    
    @Column(nullable = false)
    private Boolean forceUpdate = false; // 是否强制更新
    
    @Column(nullable = false)
    private Boolean enabled = true; // 是否启用
    
    @Column
    private Long fileSize; // 文件大小（字节）
    
    @Column
    private String sha256; // 文件SHA256校验和
    
    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
    
    @Column
    private LocalDateTime publishedAt; // 发布时间
}
