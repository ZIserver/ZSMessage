package com.chatapp.controller;

import com.chatapp.entity.ChatGroup;
import com.chatapp.entity.GroupAnnouncement;
import com.chatapp.entity.GroupMember;
import com.chatapp.entity.GroupMessage;
import com.chatapp.entity.GroupNotification;
import com.chatapp.service.GroupService;

import com.chatapp.util.XssUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/groups")
@CrossOrigin(origins = "*")
public class GroupController {

    @Autowired
    private GroupService groupService;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @PostMapping("/create")
    public ResponseEntity<ChatGroup> createGroup(@RequestBody ChatGroup group) {
        // XSS防护：清理群组名称和描述
        if (group.getGroupName() != null) {
            group.setGroupName(XssUtil.sanitize(group.getGroupName()));
        }
        if (group.getDescription() != null) {
            group.setDescription(XssUtil.sanitize(group.getDescription()));
        }
        
        ChatGroup created = groupService.createGroup(group);
        // Automatically add creator as owner
        GroupMember member = new GroupMember();
        member.setGroupId(created.getId());
        member.setUserId(group.getOwnerId());
        member.setRole("OWNER");
        groupService.addMember(member);
        return ResponseEntity.ok(created);
    }

    @GetMapping("/all")
    public ResponseEntity<List<ChatGroup>> getAllGroups() {
        return ResponseEntity.ok(groupService.getAllGroups());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ChatGroup> getGroupById(@PathVariable Long id) {
        return ResponseEntity.ok(groupService.getGroupById(id));
    }

    @PostMapping("/members/add")
    public ResponseEntity<GroupMember> addMember(@RequestBody GroupMember member) {
        return ResponseEntity.ok(groupService.addMember(member));
    }

    @GetMapping("/{groupId}/members")
    public ResponseEntity<List<GroupMember>> getGroupMembers(@PathVariable Long groupId) {
        return ResponseEntity.ok(groupService.getGroupMembers(groupId));
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<List<GroupMember>> getUserGroups(@PathVariable Long userId) {
        return ResponseEntity.ok(groupService.getUserGroups(userId));
    }

    @PostMapping("/messages/send")
    public ResponseEntity<GroupMessage> sendGroupMessage(@RequestBody GroupMessage message) {
        // 验证群组是否存在
        ChatGroup group = groupService.getGroupById(message.getGroupId());
        if (group == null) {
            return ResponseEntity.badRequest().build();
        }
        
        // 验证发送者是否为群组成员
        GroupMember member = groupService.getGroupMember(message.getGroupId(), message.getSenderId());
        if (member == null) {
            return ResponseEntity.badRequest().build();
        }
        
        // XSS防护：只对TEXT类型消息进行XSS过滤，文件消息不过滤
        if (message.getContent() != null && "TEXT".equals(message.getMessageType())) {
            message.setContent(XssUtil.sanitize(message.getContent()));
        }
        
        GroupMessage saved = groupService.sendGroupMessage(message);
        // 通过WebSocket广播给群组所有成员
        messagingTemplate.convertAndSend("/topic/group/" + message.getGroupId(), saved);
        return ResponseEntity.ok(saved);
    }

    @GetMapping("/{groupId}/messages")
    public ResponseEntity<List<GroupMessage>> getGroupMessages(@PathVariable Long groupId) {
        return ResponseEntity.ok(groupService.getGroupMessages(groupId));
    }

    // 邀请成员加入群组
    @PostMapping("/{groupId}/invite")
    public ResponseEntity<?> inviteMembers(
            @PathVariable Long groupId,
            @RequestBody Map<String, Object> request) {
        try {
            Integer inviterIdInt = (Integer) request.get("inviterId");
            Long inviterId = inviterIdInt != null ? inviterIdInt.longValue() : null;
            
            if (inviterId == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "参数不完整"));
            }
            
            // 安全地转换 userIds 列表
            @SuppressWarnings("unchecked")
            List<Object> userIdsObj = (List<Object>) request.get("userIds");
            if (userIdsObj == null || userIdsObj.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "请选择要邀请的用户"));
            }
            
            List<Long> userIds = new java.util.ArrayList<>();
            for (Object obj : userIdsObj) {
                Integer userIdInt = (Integer) obj;
                Long userId = userIdInt != null ? userIdInt.longValue() : null;
                if (userId != null) {
                    userIds.add(userId);
                }
            }
            
            ChatGroup group = groupService.getGroupById(groupId);
            if (group == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "群组不存在"));
            }

            // 检查邀请者是否是群成员
            GroupMember inviter = groupService.getGroupMember(groupId, inviterId);
            if (inviter == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "仅群成员可以邀请"));
            }

            for (Long userId : userIds) {
                // 检查是否已是群成员
                GroupMember existing = groupService.getGroupMember(groupId, userId);
                if (existing != null) {
                    continue;
                }

                // 发送邀请通知给被邀请用户（显示为卡片）
                GroupNotification notification = new GroupNotification();
                notification.setUserId(userId);
                notification.setGroupId(groupId);
                notification.setNotificationType("INVITED");
                notification.setFromUserId(inviterId);
                notification.setMessage("邀请您加入群组: " + group.getGroupName());
                groupService.createNotification(notification);
                messagingTemplate.convertAndSendToUser(
                    userId.toString(),
                    "/queue/notifications",
                    notification
                );
            }

            return ResponseEntity.ok(Map.of("message", "邀请成功"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // 用户点击加入群聊（响应邀请卡片）
    @PostMapping("/{groupId}/join")
    public ResponseEntity<?> joinGroup(
            @PathVariable Long groupId,
            @RequestBody Map<String, Object> request) {
        try {
            Integer userIdInt = (Integer) request.get("userId");
            Long userId = userIdInt != null ? userIdInt.longValue() : null;
            
            if (userId == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "参数不完整"));
            }
            
            ChatGroup group = groupService.getGroupById(groupId);
            if (group == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "群组不存在"));
            }
            
            // 检查是否已是群成员
            GroupMember existing = groupService.getGroupMember(groupId, userId);
            if (existing != null) {
                return ResponseEntity.ok(Map.of(
                    "message", "已是群成员",
                    "requireApproval", false,
                    "joined", true
                ));
            }
            
            // 判断是否需要入群验证
            if (group.getRequireApproval()) {
                // 需要验证，发送申请给管理员
                List<GroupMember> members = groupService.getGroupMembers(groupId);
                for (GroupMember member : members) {
                    if ("ADMIN".equals(member.getRole()) || "OWNER".equals(member.getRole())) {
                        GroupNotification adminNotif = new GroupNotification();
                        adminNotif.setUserId(member.getUserId());
                        adminNotif.setGroupId(groupId);
                        adminNotif.setNotificationType("JOIN_REQUEST");
                        adminNotif.setFromUserId(userId);
                        adminNotif.setMessage("用户申请加入群组: " + group.getGroupName());
                        groupService.createNotification(adminNotif);
                        messagingTemplate.convertAndSendToUser(
                            member.getUserId().toString(),
                            "/queue/notifications",
                            adminNotif
                        );
                    }
                }
                
                return ResponseEntity.ok(Map.of(
                    "message", "已发送申请，请等待管理员审核",
                    "requireApproval", true,
                    "joined", false
                ));
            } else {
                // 不需要验证，直接加入
                GroupMember newMember = new GroupMember();
                newMember.setGroupId(groupId);
                newMember.setUserId(userId);
                newMember.setRole("MEMBER");
                groupService.addMember(newMember);
                
                // 通知用户加入成功
                GroupNotification notification = new GroupNotification();
                notification.setUserId(userId);
                notification.setGroupId(groupId);
                notification.setNotificationType("JOINED");
                notification.setFromUserId(group.getOwnerId());
                notification.setMessage("您已成功加入群组: " + group.getGroupName());
                groupService.createNotification(notification);
                messagingTemplate.convertAndSendToUser(
                    userId.toString(),
                    "/queue/notifications",
                    notification
                );
                
                return ResponseEntity.ok(Map.of(
                    "message", "加入成功",
                    "requireApproval", false,
                    "joined", true
                ));
            }
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
    

    // 踢出成员
    @DeleteMapping("/{groupId}/members/{userId}")
    public ResponseEntity<?> removeMember(
            @PathVariable Long groupId,
            @PathVariable Long userId,
            @RequestParam Long operatorId) {
        try {
            ChatGroup group = groupService.getGroupById(groupId);
            if (group == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "群组不存在"));
            }

            GroupMember operator = groupService.getGroupMember(groupId, operatorId);
            GroupMember target = groupService.getGroupMember(groupId, userId);

            if (operator == null || target == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "成员不存在"));
            }

            // 权限检查
            boolean isOwner = "OWNER".equals(operator.getRole());
            boolean isAdmin = "ADMIN".equals(operator.getRole());
            boolean targetIsAdmin = "ADMIN".equals(target.getRole());
            boolean targetIsOwner = "OWNER".equals(target.getRole());

            // 群主可以踢所有人
            // 管理员只能踢普通成员
            if (!isOwner && (!isAdmin || targetIsAdmin || targetIsOwner)) {
                return ResponseEntity.badRequest().body(Map.of("error", "没有权限"));
            }

            // 移除成员
            groupService.removeMember(groupId, userId);

            // 通知被踢出的用户
            GroupNotification notification = new GroupNotification();
            notification.setUserId(userId);
            notification.setGroupId(groupId);
            notification.setNotificationType("KICKED");
            notification.setFromUserId(operatorId);
            notification.setMessage("您已被移出群组: " + group.getGroupName());
            groupService.createNotification(notification);
            messagingTemplate.convertAndSendToUser(
                userId.toString(),
                "/queue/notifications",
                notification
            );

            return ResponseEntity.ok(Map.of("message", "移除成功"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // 设置管理员
    @PutMapping("/{groupId}/members/{userId}/role")
    public ResponseEntity<?> updateMemberRole(
            @PathVariable Long groupId,
            @PathVariable Long userId,
            @RequestBody Map<String, String> request) {
        try {
            String operatorIdStr = request.get("operatorId");
            Long operatorId = operatorIdStr != null ? Long.valueOf(operatorIdStr) : null;
            String role = request.get("role");

            // 只有群主可以设置管理员
            if (!groupService.isGroupOwner(groupId, operatorId)) {
                return ResponseEntity.badRequest().body(Map.of("error", "只有群主可以设置管理员"));
            }

            GroupMember updated = groupService.updateMemberRole(groupId, userId, role);
            if (updated == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "成员不存在"));
            }

            // 通知用户
            String notifType = "ADMIN".equals(role) ? "PROMOTED_TO_ADMIN" : "DEMOTED_FROM_ADMIN";
            String message = "ADMIN".equals(role) ? "您已被设置为管理员" : "您的管理员权限已被移除";
            
            ChatGroup group = groupService.getGroupById(groupId);
            GroupNotification notification = new GroupNotification();
            notification.setUserId(userId);
            notification.setGroupId(groupId);
            notification.setNotificationType(notifType);
            notification.setFromUserId(operatorId);
            notification.setMessage(message + ": " + group.getGroupName());
            groupService.createNotification(notification);
            messagingTemplate.convertAndSendToUser(
                userId.toString(),
                "/queue/notifications",
                notification
            );

            return ResponseEntity.ok(updated);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // 更新群组设置
    @PutMapping("/{groupId}/settings")
    public ResponseEntity<?> updateGroupSettings(
            @PathVariable Long groupId,
            @RequestBody Map<String, Object> request) {
        try {
            Integer operatorIdInt = (Integer) request.get("operatorId");
            Long operatorId = operatorIdInt != null ? operatorIdInt.longValue() : null;

            // 只有管理员和群主可以修改设置
            if (!groupService.isAdminOrOwner(groupId, operatorId)) {
                return ResponseEntity.badRequest().body(Map.of("error", "只有管理员和群主可以修改设置"));
            }

            ChatGroup group = groupService.getGroupById(groupId);
            if (group == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "群组不存在"));
            }

            // 更新设置
            if (request.containsKey("announcement")) {
                String announcement = request.get("announcement").toString();
                group.setAnnouncement(XssUtil.sanitize(announcement));
            }
            if (request.containsKey("requireApproval")) {
                group.setRequireApproval((Boolean) request.get("requireApproval"));
            }
            if (request.containsKey("groupName")) {
                group.setGroupName(XssUtil.sanitize(request.get("groupName").toString()));
            }
            if (request.containsKey("description")) {
                group.setDescription(XssUtil.sanitize(request.get("description").toString()));
            }

            ChatGroup updated = groupService.updateGroup(group);
            return ResponseEntity.ok(updated);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // 获取用户的群组通知
    @GetMapping("/notifications/{userId}")
    public ResponseEntity<List<GroupNotification>> getUserNotifications(@PathVariable Long userId) {
        return ResponseEntity.ok(groupService.getUserNotifications(userId));
    }

    // 获取未读通知
    @GetMapping("/notifications/{userId}/unread")
    public ResponseEntity<List<GroupNotification>> getUnreadNotifications(@PathVariable Long userId) {
        return ResponseEntity.ok(groupService.getUnreadNotifications(userId));
    }

    // 标记通知为已读
    @PutMapping("/notifications/{notificationId}/read")
    public ResponseEntity<?> markNotificationAsRead(@PathVariable Long notificationId) {
        groupService.markNotificationAsRead(notificationId);
        return ResponseEntity.ok(Map.of("message", "已标记为已读"));
    }
    
    // 批量标记所有通知为已读
    @PutMapping("/notifications/mark-all-read/{userId}")
    public ResponseEntity<?> markAllNotificationsAsRead(@PathVariable Long userId) {
        List<GroupNotification> unreadNotifications = groupService.getUnreadNotifications(userId);
        int count = 0;
        for (GroupNotification notification : unreadNotifications) {
            // 只标记不需要操作的通知为已读（JOIN_REQUEST 和 INVITED 需要用户操作）
            String type = notification.getNotificationType();
            if (!"JOIN_REQUEST".equals(type) && !"INVITED".equals(type)) {
                groupService.markNotificationAsRead(notification.getId());
                count++;
            }
        }
        return ResponseEntity.ok(Map.of("message", "已标记为已读", "count", count));
    }

    // 处理加入请求
    @PostMapping("/notifications/{notificationId}/approve")
    public ResponseEntity<?> approveJoinRequest(
            @PathVariable Long notificationId,
            @RequestBody Map<String, Object> request) {
        try {
            Integer operatorIdInt = (Integer) request.get("operatorId");
            Long operatorId = operatorIdInt != null ? operatorIdInt.longValue() : null;
            
            Boolean approved = (Boolean) request.get("approved");

            GroupNotification notification = groupService.getUserNotifications(operatorId)
                .stream()
                .filter(n -> n.getId().equals(notificationId))
                .findFirst()
                .orElse(null);

            if (notification == null || !"JOIN_REQUEST".equals(notification.getNotificationType())) {
                return ResponseEntity.badRequest().body(Map.of("error", "通知不存在"));
            }

            Long groupId = notification.getGroupId();
            Long userId = notification.getFromUserId();

            // 检查权限
            if (!groupService.isAdminOrOwner(groupId, operatorId)) {
                return ResponseEntity.badRequest().body(Map.of("error", "没有权限"));
            }

            if (approved) {
                // 添加成员
                GroupMember newMember = new GroupMember();
                newMember.setGroupId(groupId);
                newMember.setUserId(userId);
                newMember.setRole("MEMBER");
                groupService.addMember(newMember);

                // 通知用户
                ChatGroup group = groupService.getGroupById(groupId);
                GroupNotification userNotif = new GroupNotification();
                userNotif.setUserId(userId);
                userNotif.setGroupId(groupId);
                userNotif.setNotificationType("APPROVED");
                userNotif.setFromUserId(operatorId);
                userNotif.setMessage("您的加入申请已通过: " + group.getGroupName());
                groupService.createNotification(userNotif);
                messagingTemplate.convertAndSendToUser(
                    userId.toString(),
                    "/queue/notifications",
                    userNotif
                );
            }

            // 标记为已读
            groupService.markNotificationAsRead(notificationId);

            return ResponseEntity.ok(Map.of("message", approved ? "已同意" : "已拒绝"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
    
    // 标记群组消息为已读
    @PostMapping("/{groupId}/markAsRead")
    public ResponseEntity<?> markGroupMessagesAsRead(
            @PathVariable Long groupId,
            @RequestBody Map<String, Object> request) {
        try {
            Integer userIdInt = (Integer) request.get("userId");
            Long userId = userIdInt != null ? userIdInt.longValue() : null;
            
            if (userId == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "参数不完整"));
            }
            
            int count = groupService.markGroupMessagesAsReadByGroup(groupId, userId);
            return ResponseEntity.ok(Map.of(
                "message", "已标记为已读",
                "count", count
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
    
    // ========== 新增群组管理API ==========
    
    /**
     * 简单更新群组信息（公告等）
     */
    @PutMapping("/{groupId}")
    public ResponseEntity<?> updateGroup(
            @PathVariable Long groupId,
            @RequestBody Map<String, Object> request) {
        try {
            ChatGroup group = groupService.getGroupById(groupId);
            if (group == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "群组不存在"));
            }
            
            // 更新公告
            if (request.containsKey("announcement")) {
                Object announcementObj = request.get("announcement");
                String announcement = announcementObj != null ? announcementObj.toString() : "";
                group.setAnnouncement(XssUtil.sanitize(announcement));
            }
            
            // 更新群名
            if (request.containsKey("groupName")) {
                String groupName = request.get("groupName").toString();
                group.setGroupName(XssUtil.sanitize(groupName));
            }
            
            // 更新描述
            if (request.containsKey("description")) {
                Object descObj = request.get("description");
                String description = descObj != null ? descObj.toString() : "";
                group.setDescription(XssUtil.sanitize(description));
            }
            
            // 更新入群验证设置
            if (request.containsKey("requireApproval")) {
                group.setRequireApproval((Boolean) request.get("requireApproval"));
            }
            
            // 更新群分类
            if (request.containsKey("category")) {
                Object categoryObj = request.get("category");
                String category = categoryObj != null ? categoryObj.toString() : "";
                group.setCategory(XssUtil.sanitize(category));
            }
            
            ChatGroup updated = groupService.updateGroup(group);
            return ResponseEntity.ok(updated);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
    
    /**
     * 禁言成员
     */
    @PostMapping("/{groupId}/mute/{userId}")
    public ResponseEntity<?> muteMember(
            @PathVariable Long groupId,
            @PathVariable Long userId,
            @RequestBody Map<String, Object> request) {
        try {
            // 获取禁言时长（分钟）
            Integer duration = 10; // 默认10分钟
            if (request.containsKey("duration")) {
                Object durationObj = request.get("duration");
                if (durationObj instanceof Integer) {
                    duration = (Integer) durationObj;
                } else if (durationObj instanceof String) {
                    duration = Integer.parseInt((String) durationObj);
                }
            }
            
            ChatGroup group = groupService.getGroupById(groupId);
            if (group == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "群组不存在"));
            }
            
            GroupMember target = groupService.getGroupMember(groupId, userId);
            if (target == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "成员不存在"));
            }
            
            // 不能禁言群主
            if ("OWNER".equals(target.getRole())) {
                return ResponseEntity.badRequest().body(Map.of("error", "不能禁言群主"));
            }
            
            // 设置禁言时间
            if (duration > 0) {
                target.setMuteUntil(java.time.LocalDateTime.now().plusMinutes(duration));
            } else {
                target.setMuteUntil(null); // 解除禁言
            }
            groupService.addMember(target); // save
            
            // 发送通知
            GroupNotification notification = new GroupNotification();
            notification.setUserId(userId);
            notification.setGroupId(groupId);
            notification.setNotificationType(duration > 0 ? "MUTED" : "UNMUTED");
            notification.setFromUserId(group.getOwnerId());
            notification.setMessage(duration > 0 
                ? "您已被禁言 " + duration + " 分钟: " + group.getGroupName()
                : "您的禁言已解除: " + group.getGroupName());
            groupService.createNotification(notification);
            
            // Map.of 不允许 null 值，改用 HashMap
            Map<String, Object> response = new HashMap<>();
            response.put("message", duration > 0 ? "已禁言" : "已解除禁言");
            response.put("muteUntil", target.getMuteUntil());
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
    
    /**
     * 踢出成员（兼容前端 POST 请求）
     */
    @PostMapping("/{groupId}/kick/{userId}")
    public ResponseEntity<?> kickMember(
            @PathVariable Long groupId,
            @PathVariable Long userId) {
        try {
            ChatGroup group = groupService.getGroupById(groupId);
            if (group == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "群组不存在"));
            }
            
            GroupMember target = groupService.getGroupMember(groupId, userId);
            if (target == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "成员不存在"));
            }
            
            // 不能踢出群主
            if ("OWNER".equals(target.getRole())) {
                return ResponseEntity.badRequest().body(Map.of("error", "不能移除群主"));
            }
            
            // 移除成员
            groupService.removeMember(groupId, userId);
            
            // 发送通知
            GroupNotification notification = new GroupNotification();
            notification.setUserId(userId);
            notification.setGroupId(groupId);
            notification.setNotificationType("KICKED");
            notification.setFromUserId(group.getOwnerId());
            notification.setMessage("您已被移出群组: " + group.getGroupName());
            groupService.createNotification(notification);
            messagingTemplate.convertAndSendToUser(
                userId.toString(),
                "/queue/notifications",
                notification
            );
            
            return ResponseEntity.ok(Map.of("message", "已移除"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
    
    /**
     * 设置管理员
     */
    @PostMapping("/{groupId}/admin/{userId}")
    public ResponseEntity<?> setAdmin(
            @PathVariable Long groupId,
            @PathVariable Long userId) {
        try {
            ChatGroup group = groupService.getGroupById(groupId);
            if (group == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "群组不存在"));
            }
            
            GroupMember target = groupService.getGroupMember(groupId, userId);
            if (target == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "成员不存在"));
            }
            
            // 不能操作群主
            if ("OWNER".equals(target.getRole())) {
                return ResponseEntity.badRequest().body(Map.of("error", "不能操作群主"));
            }
            
            // 设置为管理员
            target.setRole("ADMIN");
            groupService.addMember(target);
            
            // 发送通知
            GroupNotification notification = new GroupNotification();
            notification.setUserId(userId);
            notification.setGroupId(groupId);
            notification.setNotificationType("PROMOTED_TO_ADMIN");
            notification.setFromUserId(group.getOwnerId());
            notification.setMessage("您已被设为管理员: " + group.getGroupName());
            groupService.createNotification(notification);
            messagingTemplate.convertAndSendToUser(
                userId.toString(),
                "/queue/notifications",
                notification
            );
            
            return ResponseEntity.ok(Map.of("message", "已设为管理员"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
    
    /**
     * 取消管理员
     */
    @DeleteMapping("/{groupId}/admin/{userId}")
    public ResponseEntity<?> removeAdmin(
            @PathVariable Long groupId,
            @PathVariable Long userId) {
        try {
            ChatGroup group = groupService.getGroupById(groupId);
            if (group == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "群组不存在"));
            }
            
            GroupMember target = groupService.getGroupMember(groupId, userId);
            if (target == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "成员不存在"));
            }
            
            // 只能操作管理员
            if (!"ADMIN".equals(target.getRole())) {
                return ResponseEntity.badRequest().body(Map.of("error", "该成员不是管理员"));
            }
            
            // 降为普通成员
            target.setRole("MEMBER");
            groupService.addMember(target);
            
            // 发送通知
            GroupNotification notification = new GroupNotification();
            notification.setUserId(userId);
            notification.setGroupId(groupId);
            notification.setNotificationType("DEMOTED_FROM_ADMIN");
            notification.setFromUserId(group.getOwnerId());
            notification.setMessage("您的管理员权限已被移除: " + group.getGroupName());
            groupService.createNotification(notification);
            messagingTemplate.convertAndSendToUser(
                userId.toString(),
                "/queue/notifications",
                notification
            );
            
            return ResponseEntity.ok(Map.of("message", "已取消管理员"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
    
    /**
     * 退出群聊
     */
    @PostMapping("/{groupId}/leave")
    public ResponseEntity<?> leaveGroup(
            @PathVariable Long groupId,
            @RequestBody Map<String, Object> request) {
        try {
            Integer userIdInt = (Integer) request.get("userId");
            Long userId = userIdInt != null ? userIdInt.longValue() : null;
            
            if (userId == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "参数不完整"));
            }
            
            ChatGroup group = groupService.getGroupById(groupId);
            if (group == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "群组不存在"));
            }
            
            GroupMember member = groupService.getGroupMember(groupId, userId);
            if (member == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "你不是该群成员"));
            }
            
            // 群主不能直接退出，需要先转让群主或解散群
            if ("OWNER".equals(member.getRole())) {
                return ResponseEntity.badRequest().body(Map.of("error", "群主不能退出群聊，请先转让群主或解散群组"));
            }
            
            // 移除成员
            groupService.removeMember(groupId, userId);
            
            return ResponseEntity.ok(Map.of("message", "已退出群聊"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
    
    /**
     * 检查成员是否被禁言
     */
    @GetMapping("/{groupId}/mute/{userId}")
    public ResponseEntity<?> checkMuteStatus(
            @PathVariable Long groupId,
            @PathVariable Long userId) {
        try {
            GroupMember member = groupService.getGroupMember(groupId, userId);
            if (member == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "成员不存在"));
            }
            
            return ResponseEntity.ok(Map.of(
                "isMuted", member.isMuted(),
                "muteUntil", member.getMuteUntil()
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
    
    /**
     * 撤回群消息
     * - 自己可以撤回自己的2分钟内的消息
     * - 群主和管理员可以撤回任何成员的消息
     */
    @PostMapping("/messages/{messageId}/recall")
    public ResponseEntity<?> recallGroupMessage(
            @PathVariable Long messageId,
            @RequestBody Map<String, Object> request) {
        try {
            Integer userIdInt = (Integer) request.get("userId");
            Long userId = userIdInt != null ? userIdInt.longValue() : null;
            
            if (userId == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "参数不完整"));
            }
            
            // 获取消息
            GroupMessage message = groupService.getGroupMessageById(messageId);
            if (message == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "消息不存在"));
            }
            
            if (message.getIsRecalled()) {
                return ResponseEntity.badRequest().body(Map.of("error", "消息已被撤回"));
            }
            
            Long groupId = message.getGroupId();
            
            // 检查权限
            boolean isSender = message.getSenderId().equals(userId);
            boolean isOwner = groupService.isGroupOwner(groupId, userId);
            boolean isAdmin = groupService.isAdminOrOwner(groupId, userId);
            
            // 如果是自己的消息，检查时间限制（2分钟）
            if (isSender && !isAdmin) {
                java.time.Duration duration = java.time.Duration.between(message.getCreatedAt(), java.time.LocalDateTime.now());
                if (duration.toMinutes() > 2) {
                    return ResponseEntity.badRequest().body(Map.of("error", "只能撤回2分钟内的消息"));
                }
            }
            
            // 如果不是自己的消息，必须是群主或管理员
            if (!isSender && !isAdmin) {
                return ResponseEntity.badRequest().body(Map.of("error", "没有权限撤回该消息"));
            }
            
            // 管理员不能撤回群主的消息
            if (!isOwner && isAdmin && groupService.isGroupOwner(groupId, message.getSenderId())) {
                return ResponseEntity.badRequest().body(Map.of("error", "不能撤回群主的消息"));
            }
            
            // 执行撤回
            message.setIsRecalled(true);
            message.setRecalledAt(java.time.LocalDateTime.now());
            message.setRecalledBy(userId);
            message.setContent("[消息已撤回]");
            groupService.sendGroupMessage(message); // 保存
            
            // 通过WebSocket通知群成员
            messagingTemplate.convertAndSend("/topic/group/" + groupId, message);
            
            return ResponseEntity.ok(Map.of(
                "message", "撤回成功",
                "messageId", messageId
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
    
    // ==================== 群号查找相关 API ====================
    
    /**
     * 根据群号查找群
     */
    @GetMapping("/search/number/{groupNumber}")
    public ResponseEntity<?> searchByGroupNumber(@PathVariable Long groupNumber) {
        try {
            ChatGroup group = groupService.getGroupByNumber(groupNumber);
            if (group == null) {
                return ResponseEntity.ok(Map.of(
                    "found", false,
                    "message", "未找到该群号对应的群聊"
                ));
            }
            return ResponseEntity.ok(Map.of(
                "found", true,
                "group", group
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
    
    /**
     * 按群名搜索群
     */
    @GetMapping("/search/name")
    public ResponseEntity<?> searchByGroupName(@RequestParam String keyword) {
        try {
            List<ChatGroup> groups = groupService.searchGroupsByName(keyword);
            return ResponseEntity.ok(groups);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
    
    // ==================== 群公告相关 API ====================
    
    /**
     * 获取群的所有公告
     */
    @GetMapping("/{groupId}/announcements")
    public ResponseEntity<?> getGroupAnnouncements(@PathVariable Long groupId) {
        try {
            List<GroupAnnouncement> announcements = groupService.getGroupAnnouncements(groupId);
            return ResponseEntity.ok(Map.of(
                "announcements", announcements,
                "count", announcements.size()
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
    
    /**
     * 发布新公告
     */
    @PostMapping("/{groupId}/announcements")
    public ResponseEntity<?> createAnnouncement(
            @PathVariable Long groupId,
            @RequestBody Map<String, Object> request) {
        try {
            Long publisherId = ((Number) request.get("publisherId")).longValue();
            String content = (String) request.get("content");
            Boolean isPinned = request.get("isPinned") != null ? (Boolean) request.get("isPinned") : false;
            
            // 检查发布者是否为管理员或群主
            if (!groupService.isAdminOrOwner(groupId, publisherId)) {
                return ResponseEntity.badRequest().body(Map.of("error", "只有管理员才能发布公告"));
            }
            
            GroupAnnouncement announcement = new GroupAnnouncement();
            announcement.setGroupId(groupId);
            announcement.setPublisherId(publisherId);
            announcement.setContent(XssUtil.sanitize(content));
            announcement.setIsPinned(isPinned);
            
            GroupAnnouncement saved = groupService.createAnnouncement(announcement);
            
            // 通过 WebSocket 通知群成员
            messagingTemplate.convertAndSend("/topic/group/" + groupId + "/announcement", saved);
            
            return ResponseEntity.ok(saved);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
    
    /**
     * 更新公告
     */
    @PutMapping("/announcements/{announcementId}")
    public ResponseEntity<?> updateAnnouncement(
            @PathVariable Long announcementId,
            @RequestBody Map<String, Object> request) {
        try {
            Long operatorId = ((Number) request.get("operatorId")).longValue();
            String content = (String) request.get("content");
            
            GroupAnnouncement announcement = groupService.getAnnouncementById(announcementId);
            if (announcement == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "公告不存在"));
            }
            
            // 检查操作者是否为管理员或群主
            if (!groupService.isAdminOrOwner(announcement.getGroupId(), operatorId)) {
                return ResponseEntity.badRequest().body(Map.of("error", "没有权限修改公告"));
            }
            
            announcement.setContent(XssUtil.sanitize(content));
            GroupAnnouncement updated = groupService.updateAnnouncement(announcement);
            
            return ResponseEntity.ok(updated);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
    
    /**
     * 删除公告
     */
    @DeleteMapping("/announcements/{announcementId}")
    public ResponseEntity<?> deleteAnnouncement(
            @PathVariable Long announcementId,
            @RequestParam Long operatorId) {
        try {
            GroupAnnouncement announcement = groupService.getAnnouncementById(announcementId);
            if (announcement == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "公告不存在"));
            }
            
            // 检查操作者是否为管理员或群主
            if (!groupService.isAdminOrOwner(announcement.getGroupId(), operatorId)) {
                return ResponseEntity.badRequest().body(Map.of("error", "没有权限删除公告"));
            }
            
            groupService.deleteAnnouncement(announcementId);
            
            return ResponseEntity.ok(Map.of("message", "删除成功"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
    
    /**
     * 置顶/取消置顶公告
     */
    @PostMapping("/announcements/{announcementId}/pin")
    public ResponseEntity<?> toggleAnnouncementPin(
            @PathVariable Long announcementId,
            @RequestBody Map<String, Object> request) {
        try {
            Long operatorId = ((Number) request.get("operatorId")).longValue();
            
            GroupAnnouncement announcement = groupService.getAnnouncementById(announcementId);
            if (announcement == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "公告不存在"));
            }
            
            // 检查操作者是否为管理员或群主
            if (!groupService.isAdminOrOwner(announcement.getGroupId(), operatorId)) {
                return ResponseEntity.badRequest().body(Map.of("error", "没有权限操作"));
            }
            
            GroupAnnouncement updated = groupService.toggleAnnouncementPin(announcementId);
            
            return ResponseEntity.ok(Map.of(
                "message", updated.getIsPinned() ? "已置顶" : "已取消置顶",
                "announcement", updated
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
    
    // ==================== 邀请码相关 API ====================
    
    /**
     * 通过邀请码获取群信息
     */
    @GetMapping("/invite/{inviteCode}")
    public ResponseEntity<?> getGroupByInviteCode(@PathVariable String inviteCode) {
        try {
            ChatGroup group = groupService.getGroupByInviteCode(inviteCode.toUpperCase());
            if (group == null) {
                return ResponseEntity.ok(Map.of(
                    "found", false,
                    "message", "邀请链接无效或已过期"
                ));
            }
            
            // 返回群基本信息（不包含敏感信息）
            return ResponseEntity.ok(Map.of(
                "found", true,
                "group", Map.of(
                    "id", group.getId(),
                    "groupName", group.getGroupName(),
                    "groupNumber", group.getGroupNumber(),
                    "avatar", group.getAvatar() != null ? group.getAvatar() : "",
                    "description", group.getDescription() != null ? group.getDescription() : "",
                    "category", group.getCategory() != null ? group.getCategory() : "",
                    "requireApproval", group.getRequireApproval()
                )
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
    
    /**
     * 通过邀请码申请入群
     */
    @PostMapping("/invite/{inviteCode}/join")
    public ResponseEntity<?> joinGroupByInviteCode(
            @PathVariable String inviteCode,
            @RequestBody Map<String, Object> request) {
        try {
            Integer userIdInt = (Integer) request.get("userId");
            Long userId = userIdInt != null ? userIdInt.longValue() : null;
            String message = request.get("message") != null ? request.get("message").toString() : "";
            
            if (userId == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "参数不完整"));
            }
            
            ChatGroup group = groupService.getGroupByInviteCode(inviteCode.toUpperCase());
            if (group == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "邀请链接无效或已过期"));
            }
            
            Long groupId = group.getId();
            
            // 检查是否已是群成员
            GroupMember existing = groupService.getGroupMember(groupId, userId);
            if (existing != null) {
                return ResponseEntity.ok(Map.of(
                    "message", "您已是该群成员",
                    "requireApproval", false,
                    "joined", true,
                    "groupId", groupId
                ));
            }
            
            // 判断是否需要入群验证
            if (group.getRequireApproval()) {
                // 需要验证，发送申请给管理员
                List<GroupMember> members = groupService.getGroupMembers(groupId);
                for (GroupMember member : members) {
                    if ("ADMIN".equals(member.getRole()) || "OWNER".equals(member.getRole())) {
                        GroupNotification adminNotif = new GroupNotification();
                        adminNotif.setUserId(member.getUserId());
                        adminNotif.setGroupId(groupId);
                        adminNotif.setNotificationType("JOIN_REQUEST");
                        adminNotif.setFromUserId(userId);
                        adminNotif.setMessage("用户通过二维码申请加入群组: " + group.getGroupName() + 
                            (message.isEmpty() ? "" : "\n留言: " + XssUtil.sanitize(message)));
                        groupService.createNotification(adminNotif);
                        messagingTemplate.convertAndSendToUser(
                            member.getUserId().toString(),
                            "/queue/notifications",
                            adminNotif
                        );
                    }
                }
                
                return ResponseEntity.ok(Map.of(
                    "message", "已发送申请，请等待管理员审核",
                    "requireApproval", true,
                    "joined", false,
                    "groupId", groupId
                ));
            } else {
                // 不需要验证，直接加入
                GroupMember newMember = new GroupMember();
                newMember.setGroupId(groupId);
                newMember.setUserId(userId);
                newMember.setRole("MEMBER");
                groupService.addMember(newMember);
                
                // 通知用户加入成功
                GroupNotification notification = new GroupNotification();
                notification.setUserId(userId);
                notification.setGroupId(groupId);
                notification.setNotificationType("JOINED");
                notification.setFromUserId(group.getOwnerId());
                notification.setMessage("您已成功加入群组: " + group.getGroupName());
                groupService.createNotification(notification);
                messagingTemplate.convertAndSendToUser(
                    userId.toString(),
                    "/queue/notifications",
                    notification
                );
                
                return ResponseEntity.ok(Map.of(
                    "message", "加入成功",
                    "requireApproval", false,
                    "joined", true,
                    "groupId", groupId
                ));
            }
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
    
    /**
     * 重新生成群邀请码（仅群主）
     */
    @PostMapping("/{groupId}/invite/regenerate")
    public ResponseEntity<?> regenerateInviteCode(
            @PathVariable Long groupId,
            @RequestBody Map<String, Object> request) {
        try {
            Integer operatorIdInt = (Integer) request.get("operatorId");
            Long operatorId = operatorIdInt != null ? operatorIdInt.longValue() : null;
            
            // 只有群主可以重新生成邀请码
            if (!groupService.isGroupOwner(groupId, operatorId)) {
                return ResponseEntity.badRequest().body(Map.of("error", "只有群主可以重新生成邀请码"));
            }
            
            ChatGroup updated = groupService.regenerateInviteCode(groupId);
            if (updated == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "群组不存在"));
            }
            
            return ResponseEntity.ok(Map.of(
                "message", "邀请码已更新",
                "inviteCode", updated.getInviteCode()
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
