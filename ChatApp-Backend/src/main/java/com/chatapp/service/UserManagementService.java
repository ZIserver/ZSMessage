package com.chatapp.service;

import com.chatapp.entity.*;
import com.chatapp.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class UserManagementService {

    private final UserRepository userRepository;
    private final UserWarningRepository userWarningRepository;
    private final AppealRepository appealRepository;
    private final SystemMessageService systemMessageService;
    private final SimpMessagingTemplate messagingTemplate;

    /**
     * 警告用户
     */
    @Transactional
    public SystemMessage warnUser(Long userId, String reason, Long adminId) {
        // 验证用户是否存在
        if (!userRepository.existsById(userId)) {
            throw new RuntimeException("用户不存在");
        }

        // 创建警告记录
        UserWarning warning = new UserWarning();
        warning.setUserId(userId);
        warning.setAdminId(adminId);
        warning.setReason(reason);
        warning.setWarningLevel(1); // 默认一般警告
        userWarningRepository.save(warning);

        // 发送系统消息给用户
        String messageContent = "您收到了管理员的警告，原因：" + reason;
        return systemMessageService.sendSystemMessage(userId, SystemMessageType.WARN, messageContent, reason, adminId);
    }

    /**
     * 封禁用户
     */
    @Transactional
    public SystemMessage banUser(Long userId, String reason, Long adminId) {
        // 验证用户是否存在
        if (!userRepository.existsById(userId)) {
            throw new RuntimeException("用户不存在");
        }

        // 更新用户状态为封禁
        User user = userRepository.findById(userId).orElseThrow(() -> new RuntimeException("用户不存在"));
        user.setStatus(0); // 0表示封禁
        userRepository.save(user);

        // 发送系统消息给用户
        String messageContent = "您已被管理员封禁，原因：" + reason;
        return systemMessageService.sendSystemMessage(userId, SystemMessageType.BAN, messageContent, reason, adminId);
    }

    /**
     * 解封用户
     */
    @Transactional
    public User unbanUser(Long userId, Long adminId) {
        User user = userRepository.findById(userId).orElseThrow(() -> new RuntimeException("用户不存在"));
        user.setStatus(1); // 1表示正常
        return userRepository.save(user);
    }

    /**
     * 获取用户警告列表
     */
    public List<UserWarning> getUserWarnings(Long userId) {
        return userWarningRepository.findByUserId(userId);
    }

    /**
     * 提交申诉
     */
    @Transactional
    public Appeal submitAppeal(String username, Long zsNumber, String reason) {
        Appeal appeal = new Appeal();
        appeal.setUsername(username);
        appeal.setZsNumber(zsNumber);
        appeal.setReason(reason);
        appeal.setStatus("PENDING"); // 默认待处理状态
        return appealRepository.save(appeal);
    }

    /**
     * 获取申诉列表
     */
    public List<Appeal> getAppeals(String status) {
        if (status == null || status.isEmpty()) {
            return appealRepository.findAll();
        }
        return appealRepository.findByStatus(status);
    }

    /**
     * 处理申诉
     */
    @Transactional
    public Appeal processAppeal(Long appealId, String status, String adminResponse, Long adminId) {
        Appeal appeal = appealRepository.findById(appealId).orElseThrow(() -> new RuntimeException("申诉不存在"));
        appeal.setStatus(status);
        appeal.setAdminResponse(adminResponse);
        Appeal savedAppeal = appealRepository.save(appeal);

        // 如果申诉被批准，且提供了智穗号，则解封用户
        if ("APPROVED".equals(status) && appeal.getZsNumber() != null) {
            User user = userRepository.findByZsNumber(appeal.getZsNumber()).orElse(null);
            if (user != null && user.getStatus() == 0) { // 如果用户当前处于封禁状态
                user.setStatus(1); // 解封用户
                userRepository.save(user);

                // 发送解封通知
                String messageContent = "您的申诉已获批准，账户已解除封禁";
                systemMessageService.sendSystemMessage(user.getId(), SystemMessageType.WARN, messageContent, "申诉已批准", adminId);
            }
        }

        return savedAppeal;
    }
}