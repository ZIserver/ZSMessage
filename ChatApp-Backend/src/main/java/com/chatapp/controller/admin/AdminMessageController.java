package com.chatapp.controller.admin;

import com.chatapp.entity.Message;
import com.chatapp.entity.User;
import com.chatapp.repository.MessageRepository;
import com.chatapp.repository.UserRepository;
import com.chatapp.service.MessageEncryptionService;
import com.chatapp.util.XssUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 管理员 - 聊天管理控制器
 */
@RestController
@RequestMapping("/api/admin/messages")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class AdminMessageController {
    
    private final MessageRepository messageRepository;
    private final UserRepository userRepository;
    private final MessageEncryptionService encryptionService;
    
    /**
     * 分页查询所有消息
     */
    @GetMapping("/list")
    public ResponseEntity<?> getMessages(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String keyword) {
        try {
            Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
            Page<Message> messages;
            
            if (keyword != null && !keyword.trim().isEmpty()) {
                String safeKeyword = XssUtil.sanitize(keyword);
                messages = messageRepository.findByContentContaining(safeKeyword, pageable);
            } else {
                messages = messageRepository.findAll(pageable);
            }
            
            Map<String, Object> response = new HashMap<>();
            response.put("messages", messages.getContent());
            response.put("totalPages", messages.getTotalPages());
            response.put("totalElements", messages.getTotalElements());
            response.put("currentPage", page);
            
            // 解密消息内容供管理员查看
            decryptMessages(messages.getContent());
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
    
    /**
     * 根据用户ID查询消息
     */
    @GetMapping("/user/{userId}")
    public ResponseEntity<?> getUserMessages(@PathVariable Long userId) {
        try {
            List<Message> sentMessages = messageRepository.findBySenderIdOrderByCreatedAtDesc(userId);
            List<Message> receivedMessages = messageRepository.findByReceiverIdOrderByCreatedAtDesc(userId);
            
            // 解密消息内容
            decryptMessages(sentMessages);
            decryptMessages(receivedMessages);
            
            Map<String, Object> response = new HashMap<>();
            response.put("sentMessages", sentMessages);
            response.put("receivedMessages", receivedMessages);
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
    
    /**
     * 删除消息
     */
    @DeleteMapping("/{messageId}")
    public ResponseEntity<?> deleteMessage(@PathVariable Long messageId) {
        try {
            messageRepository.deleteById(messageId);
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
    
    /**
     * 批量删除消息
     */
    @DeleteMapping("/batch")
    public ResponseEntity<?> batchDeleteMessages(@RequestBody List<Long> messageIds) {
        try {
            messageRepository.deleteAllById(messageIds);
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
    
    /**
     * 获取消息统计信息
     */
    @GetMapping("/statistics")
    public ResponseEntity<?> getStatistics() {
        try {
            long totalMessages = messageRepository.count();
            long recalledMessages = messageRepository.countByIsRecalledTrue();
            long forwardedMessages = messageRepository.countByIsForwardedTrue();
            
            Map<String, Object> stats = new HashMap<>();
            stats.put("totalMessages", totalMessages);
            stats.put("recalledMessages", recalledMessages);
            stats.put("forwardedMessages", forwardedMessages);
            stats.put("normalMessages", totalMessages - recalledMessages);
            
            return ResponseEntity.ok(stats);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
    
    /**
     * 获取两个用户之间的消息历史（管理员监控）
     */
    @GetMapping("/conversation/{userId1}/{userId2}")
    public ResponseEntity<?> getConversation(
            @PathVariable Long userId1,
            @PathVariable Long userId2,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "100") int size) {
        try {
            // 获取用户信息
            User user1 = userRepository.findById(userId1).orElse(null);
            User user2 = userRepository.findById(userId2).orElse(null);
            
            if (user1 == null || user2 == null) {
                Map<String, String> error = new HashMap<>();
                error.put("error", "用户不存在");
                return ResponseEntity.badRequest().body(error);
            }
            
            // 获取两人之间的所有消息（双向）
            Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").ascending());
            Page<Message> messages = messageRepository.findConversation(userId1, userId2, pageable);
            
            // 解密消息内容
            decryptMessages(messages.getContent());
            
            Map<String, Object> response = new HashMap<>();
            response.put("messages", messages.getContent());
            response.put("totalPages", messages.getTotalPages());
            response.put("totalElements", messages.getTotalElements());
            response.put("user1", Map.of(
                "id", user1.getId(),
                "username", user1.getUsername(),
                "nickname", user1.getNickname() != null ? user1.getNickname() : user1.getUsername()
            ));
            response.put("user2", Map.of(
                "id", user2.getId(),
                "username", user2.getUsername(),
                "nickname", user2.getNickname() != null ? user2.getNickname() : user2.getUsername()
            ));
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
    
    /**
     * 获取所有用户列表（用于选择）
     */
    @GetMapping("/users")
    public ResponseEntity<?> getAllUsers() {
        try {
            List<User> users = userRepository.findAll();
            List<Map<String, Object>> userList = users.stream().map(u -> {
                Map<String, Object> map = new HashMap<>();
                map.put("id", u.getId());
                map.put("username", u.getUsername());
                map.put("nickname", u.getNickname() != null ? u.getNickname() : u.getUsername());
                return map;
            }).toList();
            
            return ResponseEntity.ok(userList);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
    
    /**
     * 解密消息列表
     */
    private void decryptMessages(List<Message> messages) {
        if (messages == null) return;
        for (Message msg : messages) {
            if (msg.getContent() != null && !msg.getContent().isEmpty()) {
                msg.setContent(encryptionService.decrypt(msg.getContent()));
            }
        }
    }
}
