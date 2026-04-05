package com.chatapp.repository;

import com.chatapp.entity.FriendNotification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FriendNotificationRepository extends JpaRepository<FriendNotification, Long> {
    List<FriendNotification> findByUserIdOrderByCreatedAtDesc(Long userId);
    List<FriendNotification> findByUserIdAndIsReadOrderByCreatedAtDesc(Long userId, Boolean isRead);
    List<FriendNotification> findByUserIdAndStatusOrderByCreatedAtDesc(Long userId, String status);
    
    // 检查是否已有未处理的申请
    FriendNotification findByUserIdAndFromUserIdAndStatusAndNotificationType(
        Long userId, Long fromUserId, String status, String notificationType);
}
