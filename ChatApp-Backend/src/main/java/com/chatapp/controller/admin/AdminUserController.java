package com.chatapp.controller.admin;

import com.chatapp.entity.User;
import com.chatapp.entity.Message;
import com.chatapp.entity.Friendship;
import com.chatapp.entity.SystemMessage;
import com.chatapp.entity.SystemMessageType;
import com.chatapp.repository.UserRepository;
import com.chatapp.repository.MessageRepository;
import com.chatapp.repository.FriendshipRepository;
import com.chatapp.service.SystemMessageService;
import com.chatapp.service.UserManagementService;
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
import java.util.Optional;

/**
 * 管理员 - 用户管理控制器
 */
@RestController
@RequestMapping("/api/admin/users")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class AdminUserController {
    
    private final UserRepository userRepository;
    private final MessageRepository messageRepository;
    private final FriendshipRepository friendshipRepository;
    private final SystemMessageService systemMessageService;
    private final UserManagementService userManagementService;
    
    /**
     * 分页查询所有用户
     */
    @GetMapping("/list")
    public ResponseEntity<?> getUsers(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String keyword) {
        try {
            Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
            Page<User> users;
            
            if (keyword != null && !keyword.trim().isEmpty()) {
                String safeKeyword = XssUtil.sanitize(keyword.trim());
                // 如果是纯数字，尝试作为智穗号搜索
                Long zsNumber = null;
                if (safeKeyword.matches("\\d+")) {
                    try {
                        zsNumber = Long.parseLong(safeKeyword);
                    } catch (NumberFormatException ignored) {}
                }
                
                if (zsNumber != null) {
                    // 搜索智穗号、用户名或昵称
                    users = userRepository.findByZsNumberOrUsernameContainingOrNicknameContaining(
                        zsNumber, safeKeyword, safeKeyword, pageable);
                } else {
                    // 搜索用户名或昵称
                    users = userRepository.findByUsernameContainingOrNicknameContaining(
                        safeKeyword, safeKeyword, pageable);
                }
            } else {
                users = userRepository.findAll(pageable);
            }
            
            Map<String, Object> response = new HashMap<>();
            response.put("users", users.getContent());
            response.put("totalPages", users.getTotalPages());
            response.put("totalElements", users.getTotalElements());
            response.put("currentPage", page);
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
    
    /**
     * 根据ID查询用户详情
     */
    @GetMapping("/{userId}")
    public ResponseEntity<?> getUserDetail(@PathVariable Long userId) {
        try {
            Optional<User> userOpt = userRepository.findById(userId);
            if (!userOpt.isPresent()) {
                Map<String, String> error = new HashMap<>();
                error.put("error", "用户不存在");
                return ResponseEntity.badRequest().body(error);
            }
            
            User user = userOpt.get();
            // 清除敏感信息
            user.setPassword(null);
            
            return ResponseEntity.ok(user);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
    
    /**
     * 删除用户（级联删除相关数据）
     */
    @DeleteMapping("/{userId}")
    public ResponseEntity<?> deleteUser(@PathVariable Long userId) {
        try {
            // 检查用户是否存在
            if (!userRepository.existsById(userId)) {
                Map<String, String> error = new HashMap<>();
                error.put("error", "用户不存在");
                return ResponseEntity.badRequest().body(error);
            }
            
            // 删除用户发送和接收的消息
            messageRepository.deleteBySenderId(userId);
            messageRepository.deleteByReceiverId(userId);
            
            // 删除好友关系
            friendshipRepository.deleteByUserId(userId);
            friendshipRepository.deleteByFriendId(userId);
            
            // 删除用户
            userRepository.deleteById(userId);
            
            Map<String, String> response = new HashMap<>();
            response.put("message", "用户删除成功");
            
            // 发送删除通知给用户
            systemMessageService.notifyUserDeletion(userId, "您的账户已被管理员删除", null);
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
    
    /**
     * 获取用户统计信息
     */
    @GetMapping("/statistics")
    public ResponseEntity<?> getStatistics() {
        try {
            long totalUsers = userRepository.count();
            
            Map<String, Object> stats = new HashMap<>();
            stats.put("totalUsers", totalUsers);
            
            return ResponseEntity.ok(stats);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
    
    /**
     * 封禁用户
     */
    @PostMapping("/{userId}/ban")
    public ResponseEntity<?> banUser(@PathVariable Long userId, @RequestBody Map<String, Object> request) {
        try {
            // 检查用户是否存在
            if (!userRepository.existsById(userId)) {
                Map<String, String> error = new HashMap<>();
                error.put("error", "用户不存在");
                return ResponseEntity.badRequest().body(error);
            }
            
            String reason = (String) request.get("reason");
            Integer adminIdInt = (Integer) request.get("adminId");
            Long adminId = adminIdInt != null ? adminIdInt.longValue() : null;
            
            // 使用新的用户管理服务进行封禁
            SystemMessage result = userManagementService.banUser(userId, reason, adminId);
            
            Map<String, String> response = new HashMap<>();
            response.put("message", "用户封禁操作成功");
            response.put("systemMessageId", String.valueOf(result.getId()));
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
    
    /**
     * 警告用户
     */
    @PostMapping("/{userId}/warn")
    public ResponseEntity<?> warnUser(@PathVariable Long userId, @RequestBody Map<String, Object> request) {
        try {
            // 检查用户是否存在
            if (!userRepository.existsById(userId)) {
                Map<String, String> error = new HashMap<>();
                error.put("error", "用户不存在");
                return ResponseEntity.badRequest().body(error);
            }
            
            String reason = (String) request.get("reason");
            Integer adminIdInt = (Integer) request.get("adminId");
            Long adminId = adminIdInt != null ? adminIdInt.longValue() : null;
            
            // 使用新的用户管理服务进行警告
            SystemMessage result = userManagementService.warnUser(userId, reason, adminId);
            
            Map<String, String> response = new HashMap<>();
            response.put("message", "用户警告操作成功");
            response.put("systemMessageId", String.valueOf(result.getId()));
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
    
    /**
     * 解封用户
     */
    @PostMapping("/{userId}/unban")
    public ResponseEntity<?> unbanUser(@PathVariable Long userId, @RequestBody Map<String, Object> request) {
        try {
            // 检查用户是否存在
            if (!userRepository.existsById(userId)) {
                Map<String, String> error = new HashMap<>();
                error.put("error", "用户不存在");
                return ResponseEntity.badRequest().body(error);
            }
            
            Integer adminIdInt = (Integer) request.get("adminId");
            Long adminId = adminIdInt != null ? adminIdInt.longValue() : null;
            
            // 使用新的用户管理服务进行解封
            userManagementService.unbanUser(userId, adminId);
            
            Map<String, String> response = new HashMap<>();
            response.put("message", "用户解封操作成功");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
    
    /**
     * 获取用户警告列表
     */
    @GetMapping("/{userId}/warnings")
    public ResponseEntity<?> getUserWarnings(@PathVariable Long userId) {
        try {
            List<com.chatapp.entity.UserWarning> warnings = userManagementService.getUserWarnings(userId);
            
            Map<String, Object> response = new HashMap<>();
            response.put("warnings", warnings);
            response.put("count", warnings.size());
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
        
    /**
     * 获取申诉列表
     */
    @GetMapping("/appeals")
    public ResponseEntity<?> getAppeals(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String status) {
        try {
            Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
            List<com.chatapp.entity.Appeal> appeals;
                
            if (status != null && !status.trim().isEmpty()) {
                appeals = userManagementService.getAppeals(status);
            } else {
                appeals = userManagementService.getAppeals(null);
            }
                
            Map<String, Object> response = new HashMap<>();
            response.put("appeals", appeals);
            response.put("totalElements", appeals.size());
            response.put("currentPage", page);
                
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
        
    /**
     * 处理申诉
     */
    @PostMapping("/appeals/{appealId}/process")
    public ResponseEntity<?> processAppeal(@PathVariable Long appealId, @RequestBody Map<String, Object> request) {
        try {
            String status = (String) request.get("status");
            String adminResponse = (String) request.get("adminResponse");
            Integer adminIdInt = (Integer) request.get("adminId");
            Long adminId = adminIdInt != null ? adminIdInt.longValue() : null;
                
            if (status == null || (!"APPROVED".equals(status) && !"REJECTED".equals(status))) {
                Map<String, String> error = new HashMap<>();
                error.put("error", "状态必须是 APPROVED 或 REJECTED");
                return ResponseEntity.badRequest().body(error);
            }
                
            com.chatapp.entity.Appeal appeal = userManagementService.processAppeal(appealId, status, adminResponse, adminId);
                
            Map<String, Object> response = new HashMap<>();
            response.put("message", "申诉处理成功");
            response.put("appeal", appeal);
                
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
        
    /**
     * 获取系统消息
     */
    @GetMapping("/system-messages")
    public ResponseEntity<?> getSystemMessages(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) SystemMessageType type) {
        try {
            Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
            List<SystemMessage> messages;
                
            if (type != null) {
                messages = systemMessageService.getSystemMessagesByType(type, pageable);
            } else {
                messages = systemMessageService.getAllSystemMessages(pageable);
            }
                
            Map<String, Object> response = new HashMap<>();
            response.put("messages", messages);
            response.put("totalElements", messages.size());
            response.put("currentPage", page);
                
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
}