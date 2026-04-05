package com.chatapp.service;

import com.chatapp.entity.FriendNotification;
import com.chatapp.repository.FriendNotificationRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class FriendNotificationService {

    @Autowired
    private FriendNotificationRepository friendNotificationRepository;

    public FriendNotification createNotification(FriendNotification notification) {
        return friendNotificationRepository.save(notification);
    }

    public List<FriendNotification> getUserNotifications(Long userId) {
        return friendNotificationRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    public List<FriendNotification> getUnreadNotifications(Long userId) {
        return friendNotificationRepository.findByUserIdAndIsReadOrderByCreatedAtDesc(userId, false);
    }

    public List<FriendNotification> getPendingRequests(Long userId) {
        return friendNotificationRepository.findByUserIdAndStatusOrderByCreatedAtDesc(userId, "PENDING");
    }

    public void markAsRead(Long notificationId) {
        Optional<FriendNotification> notification = friendNotificationRepository.findById(notificationId);
        if (notification.isPresent()) {
            FriendNotification n = notification.get();
            n.setIsRead(true);
            friendNotificationRepository.save(n);
        }
    }

    public void updateStatus(Long notificationId, String status) {
        Optional<FriendNotification> notification = friendNotificationRepository.findById(notificationId);
        if (notification.isPresent()) {
            FriendNotification n = notification.get();
            n.setStatus(status);
            friendNotificationRepository.save(n);
        }
    }

    public FriendNotification getNotificationById(Long id) {
        return friendNotificationRepository.findById(id).orElse(null);
    }
}
