package com.chatapp.controller;

import com.chatapp.entity.FileMessage;
import com.chatapp.service.FileService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/files")
@RequiredArgsConstructor
public class FileController {
    
    private final FileService fileService;

    @PostMapping("/upload")
    public ResponseEntity<?> uploadFile(@RequestParam("file") MultipartFile file,
                                       @RequestParam("senderId") Long senderId,
                                       @RequestParam("receiverId") Long receiverId) {
        try {
            if (file.isEmpty()) {
                Map<String, String> error = new HashMap<>();
                error.put("error", "文件不能为空");
                return ResponseEntity.badRequest().body(error);
            }

            FileMessage fileMessage = fileService.uploadFile(file, senderId, receiverId);
            return ResponseEntity.ok(fileMessage);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    @GetMapping("/download/{fileMessageId}")
    public ResponseEntity<Resource> downloadFile(@PathVariable Long fileMessageId,
                                                 @RequestParam("userId") Long userId) {
        try {
            byte[] fileData = fileService.downloadFile(fileMessageId, userId);
            ByteArrayResource resource = new ByteArrayResource(fileData);

            return ResponseEntity.ok()
                    .contentType(MediaType.APPLICATION_OCTET_STREAM)
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment")
                    .body(resource);
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @GetMapping("/history/{userId1}/{userId2}")
    public ResponseEntity<?> getFileHistory(@PathVariable Long userId1, @PathVariable Long userId2) {
        try {
            List<FileMessage> files = fileService.getFileHistory(userId1, userId2);
            return ResponseEntity.ok(files);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    @PostMapping("/markAsRead/{fileMessageId}")
    public ResponseEntity<?> markAsRead(@PathVariable Long fileMessageId) {
        try {
            fileService.markAsRead(fileMessageId);
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    @GetMapping("/unread/{userId}")
    public ResponseEntity<?> getUnreadFiles(@PathVariable Long userId) {
        try {
            List<FileMessage> files = fileService.getUnreadFiles(userId);
            return ResponseEntity.ok(files);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    @DeleteMapping("/{fileMessageId}")
    public ResponseEntity<?> deleteFile(@PathVariable Long fileMessageId,
                                       @RequestParam("userId") Long userId) {
        try {
            fileService.deleteFile(fileMessageId, userId);
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
}
