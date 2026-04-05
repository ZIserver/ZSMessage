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
import java.util.List;
import java.util.Map;

/**
 * 公告管理控制器
 */
@RestController
@RequestMapping("/api/announcements")
@CrossOrigin(origins = "*")
public class AnnouncementController {
    
    @Autowired
    private AnnouncementRepository announcementRepository;
    
    /**
     * 获取最新启用的公告（客户端用）
     */
    @GetMapping("/latest")
    public ResponseEntity<?> getLatestAnnouncement() {
        try {
            return announcementRepository.findFirstByEnabledTrueOrderByPriorityDescPublishedAtDesc()
                    .map(ResponseEntity::ok)
                    .orElse(ResponseEntity.noContent().build());
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
    
    /**
     * 获取所有启用的公告列表
     */
    @GetMapping("/list")
    public ResponseEntity<?> getActiveAnnouncements() {
        try {
            List<Announcement> announcements = announcementRepository
                    .findByEnabledTrueOrderByPriorityDescPublishedAtDesc();
            return ResponseEntity.ok(announcements);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
    
    /**
     * 按类型获取公告
     */
    @GetMapping("/type/{type}")
    public ResponseEntity<?> getAnnouncementsByType(@PathVariable String type) {
        try {
            List<Announcement> announcements = announcementRepository
                    .findByTypeAndEnabledTrueOrderByPriorityDescPublishedAtDesc(type);
            return ResponseEntity.ok(announcements);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
}
