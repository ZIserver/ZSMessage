package com.chatapp.service;

import com.chatapp.entity.SystemMessage;
import com.chatapp.entity.SystemMessageType;
import com.chatapp.repository.SystemMessageRepository;
import com.chatapp.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.ArrayList;

import org.springframework.data.domain.Pageable;

@Service
@RequiredArgsConstructor
public class SystemMessageService {

    private final SystemMessageRepository systemMessageRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;

    /**
     * 发送系统消息给用户
     */
    public SystemMessage sendSystemMessage(Long userId, SystemMessageType messageType, String messageContent, String reason, Long adminId) {
        // 验证用户是否存在
        if (!userRepository.existsById(userId)) {
            throw new RuntimeException("用户不存在");
        }

        SystemMessage systemMessage = new SystemMessage();
        systemMessage.setUserId(userId);
        systemMessage.setMessageType(messageType);
        systemMessage.setMessageContent(messageContent);
        systemMessage.setReason(reason);
        systemMessage.setAdminId(adminId);

        SystemMessage savedMessage = systemMessageRepository.save(systemMessage);

        // 通过WebSocket发送实时通知 - 直接发送到用户订阅的路径
        messagingTemplate.convertAndSend("/user/" + userId + "/queue/system", savedMessage);

        return savedMessage;
    }

    /**
     * 封禁用户
     */
    public SystemMessage banUser(Long userId, String reason, Long adminId) {
        String messageContent = "您已被管理员封禁";
        if (reason != null && !reason.trim().isEmpty()) {
            messageContent += "，原因：" + reason;
        }

        return sendSystemMessage(userId, SystemMessageType.BAN, messageContent, reason, adminId);
    }

    /**
     * 警告用户
     */
    public SystemMessage warnUser(Long userId, String reason, Long adminId) {
        String messageContent = "您收到了管理员的警告";
        if (reason != null && !reason.trim().isEmpty()) {
            messageContent += "，原因：" + reason;
        }

        return sendSystemMessage(userId, SystemMessageType.WARN, messageContent, reason, adminId);
    }

    /**
     * 删除用户前发送通知
     */
    public SystemMessage notifyUserDeletion(Long userId, String reason, Long adminId) {
        String messageContent = "您的账户已被删除";
        if (reason != null && !reason.trim().isEmpty()) {
            messageContent += "，原因：" + reason;
        }

        return sendSystemMessage(userId, SystemMessageType.DELETE, messageContent, reason, adminId);
    }

    /**
     * 获取用户的所有系统消息
     */
    public List<SystemMessage> getUserSystemMessages(Long userId) {
        return systemMessageRepository.findByUserId(userId);
    }
    
    /**
     * 获取所有系统消息
     */
    public List<SystemMessage> getAllSystemMessages(Pageable pageable) {
        return systemMessageRepository.findAll(pageable).getContent();
    }
    
    /**
     * 根据类型获取系统消息
     */
    public List<SystemMessage> getSystemMessagesByType(SystemMessageType type, Pageable pageable) {
        // 这个方法需要使用分页，所以我们先获取所有该类型的消息
        List<SystemMessage> allOfType = systemMessageRepository.findByMessageType(type);
        // 然后手动进行分页
        int start = (int) pageable.getOffset();
        int end = Math.min((start + pageable.getPageSize()), allOfType.size());
        
        if (start >= allOfType.size()) {
            return new ArrayList<>();
        }
        
        return allOfType.subList(start, end);
    }
}