package com.chatapp.service;

import com.chatapp.entity.FileMessage;
import com.chatapp.repository.FileMessageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class FileService {
    
    private final FileMessageRepository fileMessageRepository;

    @Value("${file.upload-dir:./uploads}")
    private String uploadDir;

    @Transactional
    public FileMessage uploadFile(MultipartFile file, Long senderId, Long receiverId) {
        try {
            // 创建上传目录
            Path uploadPath = Paths.get(uploadDir);
            if (!Files.exists(uploadPath)) {
                Files.createDirectories(uploadPath);
            }

            // 生成唯一文件名
            String originalFilename = file.getOriginalFilename();
            String extension = "";
            if (originalFilename != null && originalFilename.contains(".")) {
                extension = originalFilename.substring(originalFilename.lastIndexOf("."));
            }
            String uniqueFilename = UUID.randomUUID().toString() + extension;

            // 保存文件
            Path filePath = uploadPath.resolve(uniqueFilename);
            Files.copy(file.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);

            // 创建文件消息记录
            FileMessage fileMessage = new FileMessage();
            fileMessage.setSenderId(senderId);
            fileMessage.setReceiverId(receiverId);
            fileMessage.setFileName(originalFilename);
            fileMessage.setFilePath(filePath.toString());
            fileMessage.setFileSize(file.getSize());
            fileMessage.setFileType(file.getContentType());
            fileMessage.setStatus("COMPLETED");
            fileMessage.setIsRead(false);
            fileMessage.setCreatedAt(LocalDateTime.now());

            return fileMessageRepository.save(fileMessage);
        } catch (IOException e) {
            throw new RuntimeException("文件上传失败: " + e.getMessage());
        }
    }

    public List<FileMessage> getFileHistory(Long userId1, Long userId2) {
        return fileMessageRepository.findBySenderIdAndReceiverIdOrReceiverIdAndSenderIdOrderByCreatedAtDesc(
                userId1, userId2, userId1, userId2);
    }

    @Transactional
    public void markAsRead(Long fileMessageId) {
        FileMessage fileMessage = fileMessageRepository.findById(fileMessageId)
                .orElseThrow(() -> new RuntimeException("文件消息不存在"));
        fileMessage.setIsRead(true);
        fileMessageRepository.save(fileMessage);
    }

    public List<FileMessage> getUnreadFiles(Long userId) {
        return fileMessageRepository.findByReceiverIdAndIsReadFalse(userId);
    }

    public byte[] downloadFile(Long fileMessageId, Long userId) {
        FileMessage fileMessage = fileMessageRepository.findById(fileMessageId)
                .orElseThrow(() -> new RuntimeException("文件不存在"));

        // 验证权限
        if (!fileMessage.getSenderId().equals(userId) && !fileMessage.getReceiverId().equals(userId)) {
            throw new RuntimeException("无权下载此文件");
        }

        try {
            Path filePath = Paths.get(fileMessage.getFilePath());
            return Files.readAllBytes(filePath);
        } catch (IOException e) {
            throw new RuntimeException("文件读取失败: " + e.getMessage());
        }
    }

    @Transactional
    public void deleteFile(Long fileMessageId, Long userId) {
        FileMessage fileMessage = fileMessageRepository.findById(fileMessageId)
                .orElseThrow(() -> new RuntimeException("文件不存在"));

        if (!fileMessage.getSenderId().equals(userId)) {
            throw new RuntimeException("无权删除此文件");
        }

        try {
            Path filePath = Paths.get(fileMessage.getFilePath());
            Files.deleteIfExists(filePath);
            fileMessageRepository.delete(fileMessage);
        } catch (IOException e) {
            throw new RuntimeException("文件删除失败: " + e.getMessage());
        }
    }
}
