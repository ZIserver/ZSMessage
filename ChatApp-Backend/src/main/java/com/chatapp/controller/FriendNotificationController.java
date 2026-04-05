package com.chatapp.controller;

import com.chatapp.entity.FriendNotification;
import com.chatapp.repository.FriendshipRepository;
import com.chatapp.service.FriendNotificationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/friends/notifications")
@CrossOrigin(origins = "*")
public class FriendNotificationController {

    @Autowired
    private FriendNotificationService notificationService;

    @Autowired
    private FriendshipRepository friendshipRepository;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;
    
    @Autowired
    private com.chatapp.repository.FriendNotificationRepository friendNotificationRepository;

    // 发送好友申请
    @PostMapping("/send")
    public ResponseEntity<?> sendFriendRequest(@RequestBody Map<String, Object> request) {
        try {
            Integer fromUserIdInt = (Integer) request.get("fromUserId");
            Integer toUserIdInt = (Integer) request.get("toUserId");
            Long fromUserId = fromUserIdInt != null ? fromUserIdInt.longValue() : null;
            Long toUserId = toUserIdInt != null ? toUserIdInt.longValue() : null;
            String message = request.getOrDefault("message", "请求添加您为好友").toString();

            // 检查是否已经是好友
            Optional<com.chatapp.entity.Friendship> existingFriendship = 
                friendshipRepository.findFriendship(fromUserId, toUserId);
            if (existingFriendship.isPresent() && "ACCEPTED".equals(existingFriendship.get().getStatus())) {
                return ResponseEntity.badRequest().body(Map.of("error", "你们已经是好友了"));
            }
            
            // 检查是否已有未处理的申请
            FriendNotification existingNotification = friendNotificationRepository
                .findByUserIdAndFromUserIdAndStatusAndNotificationType(
                    toUserId, fromUserId, "PENDING", "FRIEND_REQUEST");
            
            if (existingNotification != null) {
                return ResponseEntity.badRequest().body(Map.of("error", "已有未处理的好友申请，请等待对方处理"));
            }

            // 创建通知
            FriendNotification notification = new FriendNotification();
            notification.setUserId(toUserId);
            notification.setFromUserId(fromUserId);
            notification.setNotificationType("FRIEND_REQUEST");
            notification.setMessage(message);
            notification.setStatus("PENDING");

            FriendNotification saved = notificationService.createNotification(notification);

            // WebSocket 通知
            messagingTemplate.convertAndSendToUser(
                toUserId.toString(),
                "/queue/friend-notifications",
                saved
            );

            return ResponseEntity.ok(saved);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // 获取用户的所有通知
    @GetMapping("/{userId}")
    public ResponseEntity<List<FriendNotification>> getUserNotifications(@PathVariable Long userId) {
        return ResponseEntity.ok(notificationService.getUserNotifications(userId));
    }

    // 获取未读通知
    @GetMapping("/{userId}/unread")
    public ResponseEntity<List<FriendNotification>> getUnreadNotifications(@PathVariable Long userId) {
        return ResponseEntity.ok(notificationService.getUnreadNotifications(userId));
    }

    // 获取待处理的好友申请
    @GetMapping("/{userId}/pending")
    public ResponseEntity<List<FriendNotification>> getPendingRequests(@PathVariable Long userId) {
        return ResponseEntity.ok(notificationService.getPendingRequests(userId));
    }

    // 标记为已读
    @PutMapping("/{notificationId}/read")
    public ResponseEntity<?> markAsRead(@PathVariable Long notificationId) {
        notificationService.markAsRead(notificationId);
        return ResponseEntity.ok(Map.of("message", "已标记为已读"));
    }
    
    // 批量标记已读
    @PutMapping("/mark-all-read/{userId}")
    public ResponseEntity<?> markAllAsRead(@PathVariable Long userId) {
        List<FriendNotification> notifications = notificationService.getUnreadNotifications(userId);
        for (FriendNotification notification : notifications) {
            notificationService.markAsRead(notification.getId());
        }
        return ResponseEntity.ok(Map.of("message", "已全部标记为已读", "count", notifications.size()));
    }

    // 处理好友申请（接受/拒绝）
    @PostMapping("/{notificationId}/respond")
    public ResponseEntity<?> respondToRequest(
            @PathVariable Long notificationId,
            @RequestBody Map<String, Object> request) {
        try {
            Boolean accepted = (Boolean) request.get("accepted");

            FriendNotification notification = notificationService.getNotificationById(notificationId);
            if (notification == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "通知不存在"));
            }

            if (!"PENDING".equals(notification.getStatus())) {
                return ResponseEntity.badRequest().body(Map.of("error", "该申请已处理"));
            }

            if (accepted) {
                // 接受好友申请
                com.chatapp.entity.Friendship friendship = new com.chatapp.entity.Friendship();
                friendship.setUserId(notification.getUserId());
                friendship.setFriendId(notification.getFromUserId());
                friendship.setStatus("ACCEPTED");
                friendshipRepository.save(friendship);

                // 创建双向好友关系
                com.chatapp.entity.Friendship reverseFriendship = new com.chatapp.entity.Friendship();
                reverseFriendship.setUserId(notification.getFromUserId());
                reverseFriendship.setFriendId(notification.getUserId());
                reverseFriendship.setStatus("ACCEPTED");
                friendshipRepository.save(reverseFriendship);

                // 更新通知状态
                notificationService.updateStatus(notificationId, "ACCEPTED");

                // 通知发送者
                FriendNotification acceptedNotif = new FriendNotification();
                acceptedNotif.setUserId(notification.getFromUserId());
                acceptedNotif.setFromUserId(notification.getUserId());
                acceptedNotif.setNotificationType("FRIEND_ACCEPTED");
                acceptedNotif.setMessage("已接受您的好友申请");
                acceptedNotif.setStatus("ACCEPTED");
                notificationService.createNotification(acceptedNotif);

                messagingTemplate.convertAndSendToUser(
                    notification.getFromUserId().toString(),
                    "/queue/friend-notifications",
                    acceptedNotif
                );
            } else {
                // 拒绝好友申请
                notificationService.updateStatus(notificationId, "REJECTED");

                // 通知发送者
                FriendNotification rejectedNotif = new FriendNotification();
                rejectedNotif.setUserId(notification.getFromUserId());
                rejectedNotif.setFromUserId(notification.getUserId());
                rejectedNotif.setNotificationType("FRIEND_REJECTED");
                rejectedNotif.setMessage("已拒绝您的好友申请");
                rejectedNotif.setStatus("REJECTED");
                notificationService.createNotification(rejectedNotif);

                messagingTemplate.convertAndSendToUser(
                    notification.getFromUserId().toString(),
                    "/queue/friend-notifications",
                    rejectedNotif
                );
            }

            return ResponseEntity.ok(Map.of("message", accepted ? "已接受" : "已拒绝"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
