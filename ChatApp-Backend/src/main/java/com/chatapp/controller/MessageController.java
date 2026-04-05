package com.chatapp.controller;

import com.chatapp.entity.Message;
import com.chatapp.service.MessageService;
import com.chatapp.service.MessageEncryptionService;

import com.chatapp.util.XssUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/messages")
@CrossOrigin(origins = "*")
public class MessageController {

    @Autowired
    private MessageService messageService;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;
    
    @Autowired
    private MessageEncryptionService encryptionService;
    
    @Autowired
    private com.chatapp.repository.UserRepository userRepository;

    /**
     * 获取用户的聊天会话列表
     */
    @GetMapping("/sessions/{userId}")
    public ResponseEntity<?> getChatSessions(@PathVariable Long userId) {
        try {
            List<Map<String, Object>> sessions = messageService.getChatSessions(userId);
            // 为每个会话添加用户信息
            for (Map<String, Object> session : sessions) {
                Long otherUserId = (Long) session.get("userId");
                userRepository.findById(otherUserId).ifPresent(user -> {
                    session.put("username", user.getUsername());
                    session.put("nickname", user.getNickname());
                    session.put("avatar", user.getAvatar());
                });
                // 解密最后一条消息
                Object lastMsg = session.get("lastMessage");
                if (lastMsg != null) {
                    session.put("lastMessage", encryptionService.decrypt(lastMsg.toString()));
                }
            }
            return ResponseEntity.ok(sessions);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    @PostMapping("/send")
    public ResponseEntity<Message> sendMessage(@RequestBody Message message) {
        // XSS防护：只对TEXT类型消息进行XSS过滤，文件消息不过滤
        if (message.getContent() != null && "TEXT".equals(message.getMessageType())) {
            message.setContent(XssUtil.sanitize(message.getContent()));
        }
        
        // 服务器端加密消息内容（存储加密，替代E2E）
        if (message.getContent() != null && !message.getContent().isEmpty()) {
            String encryptedContent = encryptionService.encrypt(message.getContent());
            message.setContent(encryptedContent);
        }
        
        Message savedMessage = messageService.sendMessage(message);
        
        // 创建一个解密后的消息副本用于WebSocket发送（客户端接收明文）
        Message decryptedMessage = copyMessageWithDecryptedContent(savedMessage);
        
        // Send message via WebSocket - 直接发送到用户订阅的路径
        messagingTemplate.convertAndSend("/user/" + message.getReceiverId() + "/queue/messages", decryptedMessage);
        return ResponseEntity.ok(decryptedMessage);
    }

    @GetMapping("/history")
    public ResponseEntity<List<Message>> getChatHistory(
            @RequestParam Long userId1,
            @RequestParam Long userId2) {
        List<Message> messages = messageService.getChatHistory(userId1, userId2);
        // 解密消息内容后返回给客户端
        decryptMessages(messages);
        return ResponseEntity.ok(messages);
    }

    @GetMapping("/all")
    public ResponseEntity<List<Message>> getAllMessages() {
        return ResponseEntity.ok(messageService.getAllMessages());
    }

    @PostMapping("/recall/{messageId}")
    public ResponseEntity<?> recallMessage(@PathVariable Long messageId, 
                                          @RequestBody Map<String, Object> request) {
        try {
            Integer userIdInt = (Integer) request.get("userId");
            Long userId = userIdInt != null ? userIdInt.longValue() : null;
            
            // 先获取消息信息（撤回前）
            Message message = messageService.getMessageById(messageId);
            
            if (message == null) {
                Map<String, String> error = new HashMap<>();
                error.put("error", "消息不存在");
                return ResponseEntity.badRequest().body(error);
            }
            
            Long receiverId = message.getSenderId().equals(userId) 
                    ? message.getReceiverId() 
                    : message.getSenderId();
            
            // 执行撤回
            messageService.recallMessage(messageId, userId);
            
            // 获取撤回后的消息
            Message recalledMessage = messageService.getMessageById(messageId);
            
            // 通过WebSocket通知双方
            if (recalledMessage != null) {
                // 通知接收者
                messagingTemplate.convertAndSend("/user/" + receiverId + "/queue/messages", recalledMessage);
                // 也通知发送者
                messagingTemplate.convertAndSend("/user/" + message.getSenderId() + "/queue/messages", recalledMessage);
            }
            
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    @PostMapping("/forward")
    public ResponseEntity<?> forwardMessage(@RequestBody Map<String, Object> request) {
        try {
            Integer messageIdInt = (Integer) request.get("messageId");
            Integer senderIdInt = (Integer) request.get("senderId");
            Integer receiverIdInt = (Integer) request.get("receiverId");
            
            Long messageId = messageIdInt != null ? messageIdInt.longValue() : null;
            Long senderId = senderIdInt != null ? senderIdInt.longValue() : null;
            Long receiverId = receiverIdInt != null ? receiverIdInt.longValue() : null;
            
            Message forwardedMessage = messageService.forwardMessage(messageId, senderId, receiverId);
            
            // 通过 WebSocket 发送
            messagingTemplate.convertAndSend("/user/" + receiverId + "/queue/messages", forwardedMessage);
            
            return ResponseEntity.ok(forwardedMessage);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    @GetMapping("/search")
    public ResponseEntity<?> searchMessages(@RequestParam Long userId, 
                                           @RequestParam String keyword) {
        try {
            // XSS防护：清理搜索关键词
            String sanitizedKeyword = XssUtil.sanitize(keyword);
            List<Message> messages = messageService.searchMessages(userId, sanitizedKeyword);
            return ResponseEntity.ok(messages);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    @PostMapping("/markAsRead/{messageId}")
    public ResponseEntity<?> markAsRead(@PathVariable Long messageId) {
        try {
            messageService.markAsRead(messageId);
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    @GetMapping("/unread/{userId}")
    public ResponseEntity<?> getUnreadMessages(@PathVariable Long userId) {
        try {
            List<Message> messages = messageService.getUnreadMessages(userId);
            // 解密消息内容后返回给客户端
            decryptMessages(messages);
            return ResponseEntity.ok(messages);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
    
    @PostMapping("/markChatAsRead")
    public ResponseEntity<?> markChatAsRead(@RequestBody Map<String, Object> request) {
        try {
            // 安全地转换为 Long
            Object senderIdObj = request.get("senderId");
            Object receiverIdObj = request.get("receiverId");
            
            Integer senderIdInt = (Integer) senderIdObj;
            Integer receiverIdInt = (Integer) receiverIdObj;
            
            Long senderId = senderIdInt != null ? senderIdInt.longValue() : null;
            Long receiverId = receiverIdInt != null ? receiverIdInt.longValue() : null;
            
            if (senderId == null || receiverId == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "参数不完整"));
            }
            
            int count = messageService.markMessagesAsReadByChat(senderId, receiverId);
            return ResponseEntity.ok(Map.of(
                "message", "已标记为已读",
                "count", count
            ));
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
    
    /**
     * 复制消息并解密内容
     */
    private Message copyMessageWithDecryptedContent(Message original) {
        Message copy = new Message();
        copy.setId(original.getId());
        copy.setSenderId(original.getSenderId());
        copy.setReceiverId(original.getReceiverId());
        copy.setMessageType(original.getMessageType());
        copy.setIsRead(original.getIsRead());
        copy.setIsRecalled(original.getIsRecalled());
        copy.setIsForwarded(original.getIsForwarded());
        copy.setForwardedFromMessageId(original.getForwardedFromMessageId());
        copy.setCreatedAt(original.getCreatedAt());
        copy.setRecalledAt(original.getRecalledAt());
        // 解密内容
        if (original.getContent() != null && !original.getContent().isEmpty()) {
            copy.setContent(encryptionService.decrypt(original.getContent()));
        } else {
            copy.setContent(original.getContent());
        }
        return copy;
    }
    
}
