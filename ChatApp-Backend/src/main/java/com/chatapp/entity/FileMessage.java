package com.chatapp.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "file_messages")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class FileMessage {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long senderId;

    @Column(nullable = false)
    private Long receiverId;

    @Column(nullable = false)
    private String fileName;

    @Column(nullable = false)
    private String filePath;

    @Column(nullable = false)
    private Long fileSize;

    @Column(nullable = false)
    private String fileType;

    @Column(nullable = false)
    private String status = "PENDING"; // PENDING, UPLOADING, COMPLETED, FAILED

    @Column(nullable = false)
    private Boolean isRead = false;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
    
    // 动态生成文件URL（不存储到数据库）
    @Transient
    private String fileUrl;
    
    public String getFileUrl() {
        if (filePath != null && !filePath.isEmpty()) {
            // 从完整路径中提取文件名
            String fileName = filePath;
            // 处理Windows路径
            if (fileName.contains("\\")) {
                fileName = fileName.substring(fileName.lastIndexOf("\\") + 1);
            }
            // 处理Unix路径
            if (fileName.contains("/")) {
                fileName = fileName.substring(fileName.lastIndexOf("/") + 1);
            }
            return "https://msg.v2.zhsdev.top/uploads/" + fileName;
        }
        return null;
    }
}
