package com.chatapp.repository;

import com.chatapp.entity.GroupNotification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface GroupNotificationRepository extends JpaRepository<GroupNotification, Long> {
    List<GroupNotification> findByUserIdOrderByCreatedAtDesc(Long userId);
    List<GroupNotification> findByUserIdAndIsReadOrderByCreatedAtDesc(Long userId, Boolean isRead);
    List<GroupNotification> findByGroupIdAndNotificationTypeOrderByCreatedAtDesc(Long groupId, String notificationType);
}
