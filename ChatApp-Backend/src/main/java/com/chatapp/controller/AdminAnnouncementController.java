package com.chatapp.controller;

import com.chatapp.entity.Announcement;
import com.chatapp.repository.AnnouncementRepository;
import com.chatapp.util.XssUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

/**
 * 管理员公告管理控制器
 */
@RestController
@RequestMapping("/api/admin/announcements")
@CrossOrigin(origins = "*")
public class AdminAnnouncementController {
    
    @Autowired
    private AnnouncementRepository announcementRepository;
    
    /**
     * 分页查询所有公告
     */
    @GetMapping("/list")
    public ResponseEntity<?> listAnnouncements(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        try {
            Page<Announcement> announcementPage = announcementRepository
                    .findAllByOrderByCreatedAtDesc(PageRequest.of(page, size));
            
            Map<String, Object> response = new HashMap<>();
            response.put("content", announcementPage.getContent());
            response.put("totalElements", announcementPage.getTotalElements());
            response.put("totalPages", announcementPage.getTotalPages());
            response.put("currentPage", page);
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
    
    /**
     * 创建公告
     */
    @PostMapping("/create")
    public ResponseEntity<?> createAnnouncement(@RequestBody Map<String, Object> request) {
        try {
            Announcement announcement = new Announcement();
            announcement.setTitle(XssUtil.sanitize((String) request.get("title")));
            announcement.setContent(XssUtil.sanitize((String) request.get("content")));
            announcement.setType((String) request.getOrDefault("type", "notice"));
            announcement.setPriority((Integer) request.getOrDefault("priority", 0));
            announcement.setEnabled((Boolean) request.getOrDefault("enabled", true));
            
            // 如果启用，设置发布时间
            if (announcement.getEnabled()) {
                announcement.setPublishedAt(LocalDateTime.now());
            }
            
            Announcement saved = announcementRepository.save(announcement);
            return ResponseEntity.ok(saved);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
    
    /**
     * 更新公告
     */
    @PutMapping("/{id}")
    public ResponseEntity<?> updateAnnouncement(
            @PathVariable Long id,
            @RequestBody Map<String, Object> request) {
        try {
            Announcement announcement = announcementRepository.findById(id)
                    .orElseThrow(() -> new RuntimeException("公告不存在"));
            
            if (request.containsKey("title")) {
                announcement.setTitle(XssUtil.sanitize((String) request.get("title")));
            }
            if (request.containsKey("content")) {
                announcement.setContent(XssUtil.sanitize((String) request.get("content")));
            }
            if (request.containsKey("type")) {
                announcement.setType((String) request.get("type"));
            }
            if (request.containsKey("priority")) {
                announcement.setPriority((Integer) request.get("priority"));
            }
            if (request.containsKey("enabled")) {
                Boolean enabled = (Boolean) request.get("enabled");
                announcement.setEnabled(enabled);
                // 如果从禁用改为启用，设置发布时间
                if (enabled && announcement.getPublishedAt() == null) {
                    announcement.setPublishedAt(LocalDateTime.now());
                }
            }
            
            Announcement updated = announcementRepository.save(announcement);
            return ResponseEntity.ok(updated);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
    
    /**
     * 删除公告
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteAnnouncement(@PathVariable Long id) {
        try {
            announcementRepository.deleteById(id);
            Map<String, String> response = new HashMap<>();
            response.put("message", "删除成功");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
    
    /**
     * 发布/取消发布公告
     */
    @PostMapping("/{id}/toggle")
    public ResponseEntity<?> toggleAnnouncement(@PathVariable Long id) {
        try {
            Announcement announcement = announcementRepository.findById(id)
                    .orElseThrow(() -> new RuntimeException("公告不存在"));
            
            announcement.setEnabled(!announcement.getEnabled());
            if (announcement.getEnabled() && announcement.getPublishedAt() == null) {
                announcement.setPublishedAt(LocalDateTime.now());
            }
            
            Announcement updated = announcementRepository.save(announcement);
            return ResponseEntity.ok(updated);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
}
