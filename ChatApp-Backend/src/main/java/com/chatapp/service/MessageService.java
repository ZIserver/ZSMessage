package com.chatapp.service;

import com.chatapp.entity.Message;
import com.chatapp.repository.MessageRepository;
import com.chatapp.util.LogUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class MessageService {

    private static final Logger logger = LoggerFactory.getLogger(MessageService.class);
    @Autowired
    private MessageRepository messageRepository;

    public Message sendMessage(Message message) {
        try {
            logger.info("开始发送消息 - 发送者ID: {}, 接收者ID: {}, 消息类型: {}", 
                message.getSenderId(), message.getReceiverId(), message.getMessageType());
            
            message.setIsRecalled(false);
            message.setIsForwarded(false);
            
            Message savedMessage = messageRepository.save(message);
            
            logger.info("消息发送成功 - 消息ID: {}, 发送者ID: {}, 接收者ID: {}", 
                savedMessage.getId(), message.getSenderId(), message.getReceiverId());
            LogUtil.logDatabaseOperation(this.getClass(), "INSERT", message.getSenderId(), "Message", savedMessage.getId());
            
            return savedMessage;
        } catch (Exception e) {
            logger.error("发送消息失败 - 发送者ID: {}, 接收者ID: {}, 错误: {}", 
                message.getSenderId(), message.getReceiverId(), e.getMessage(), e);
            throw e;
        }
    }

    public List<Message> getChatHistory(Long userId1, Long userId2) {
        return messageRepository.findBySenderIdAndReceiverIdOrSenderIdAndReceiverIdOrderByCreatedAtAsc(
                userId1, userId2, userId2, userId1);
    }

    public List<Message> getAllMessages() {
        return messageRepository.findAll();
    }

    public Message getMessageById(Long messageId) {
        return messageRepository.findById(messageId).orElse(null);
    }

    @Transactional
    public void recallMessage(Long messageId, Long userId) {
        try {
            logger.info("开始撤回消息 - 消息ID: {}, 用户ID: {}", messageId, userId);
            
            Message message = messageRepository.findById(messageId)
                    .orElseThrow(() -> new RuntimeException("消息不存在"));
            
            logger.debug("检查消息权限 - 消息ID: {}, 消息发送者: {}, 请求用户: {}", 
                messageId, message.getSenderId(), userId);

            if (!message.getSenderId().equals(userId)) {
                logger.warn("撤回消息权限不足 - 消息ID: {}, 消息发送者: {}, 请求用户: {}", 
                    messageId, message.getSenderId(), userId);
                throw new RuntimeException("只能撤回自己发送的消息");
            }

            if (message.getIsRecalled()) {
                logger.warn("消息已被撤回 - 消息ID: {}", messageId);
                throw new RuntimeException("消息已撤回");
            }

            // 检查是否在2分钟内
            long minutesSinceSent = ChronoUnit.MINUTES.between(message.getCreatedAt(), LocalDateTime.now());
            logger.debug("消息发送时间检查 - 消息ID: {}, 已发送分钟数: {}", messageId, minutesSinceSent);
            
            if (minutesSinceSent > 2) {
                logger.warn("超出撤回时间限制 - 消息ID: {}, 已发送分钟数: {}", messageId, minutesSinceSent);
                throw new RuntimeException("只能撤回2分钟内的消息");
            }

            message.setIsRecalled(true);
            message.setRecalledAt(LocalDateTime.now());
            String originalContent = message.getContent();
            message.setContent("[消息已撤回]");
            messageRepository.save(message);
            
            logger.info("消息撤回成功 - 消息ID: {}, 原内容: {}", messageId, originalContent);
            LogUtil.logBusinessOperation(this.getClass(), "RECALL_MESSAGE", userId, "消息ID: " + messageId);
        } catch (Exception e) {
            logger.error("撤回消息失败 - 消息ID: {}, 用户ID: {}, 错误: {}", messageId, userId, e.getMessage(), e);
            throw e;
        }
    }

    @Transactional
    public Message forwardMessage(Long messageId, Long senderId, Long receiverId) {
        try {
            logger.info("开始转发消息 - 原消息ID: {}, 发送者ID: {}, 接收者ID: {}", messageId, senderId, receiverId);
            
            Message originalMessage = messageRepository.findById(messageId)
                    .orElseThrow(() -> new RuntimeException("消息不存在"));
            
            logger.debug("检查原消息状态 - 原消息ID: {}, 是否已撤回: {}", 
                messageId, originalMessage.getIsRecalled());

            if (originalMessage.getIsRecalled()) {
                logger.warn("无法转发已撤回的消息 - 原消息ID: {}", messageId);
                throw new RuntimeException("无法转发已撤回的消息");
            }

            Message forwardedMessage = new Message();
            forwardedMessage.setSenderId(senderId);
            forwardedMessage.setReceiverId(receiverId);
            forwardedMessage.setContent(originalMessage.getContent());
            forwardedMessage.setMessageType(originalMessage.getMessageType());
            forwardedMessage.setIsRead(false);
            forwardedMessage.setIsRecalled(false);
            forwardedMessage.setIsForwarded(true);
            forwardedMessage.setForwardedFromMessageId(messageId);
            
            logger.debug("创建转发消息 - 原消息ID: {}, 转发消息内容: {}", messageId, originalMessage.getContent());

            Message savedForwardedMessage = messageRepository.save(forwardedMessage);
            
            logger.info("消息转发成功 - 原消息ID: {}, 转发消息ID: {}, 发送者ID: {}, 接收者ID: {}", 
                messageId, savedForwardedMessage.getId(), senderId, receiverId);
            LogUtil.logBusinessOperation(this.getClass(), "FORWARD_MESSAGE", senderId, 
                "原消息ID: " + messageId + ", 转发消息ID: " + savedForwardedMessage.getId());
            
            return savedForwardedMessage;
        } catch (Exception e) {
            logger.error("转发消息失败 - 原消息ID: {}, 发送者ID: {}, 接收者ID: {}, 错误: {}", 
                messageId, senderId, receiverId, e.getMessage(), e);
            throw e;
        }
    }

    public List<Message> searchMessages(Long userId, String keyword) {
        if (keyword == null || keyword.trim().isEmpty()) {
            throw new RuntimeException("搜索关键词不能为空");
        }
        return messageRepository.searchMessages(userId, keyword);
    }

    @Transactional
    public void markAsRead(Long messageId) {
        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new RuntimeException("消息不存在"));
        message.setIsRead(true);
        messageRepository.save(message);
    }

    public List<Message> getUnreadMessages(Long userId) {
        return messageRepository.findByReceiverIdAndIsReadFalseAndIsRecalledFalse(userId);
    }
    
    @Transactional
    public int markMessagesAsReadByChat(Long senderId, Long receiverId) {
        List<Message> unreadMessages = messageRepository.findBySenderIdAndReceiverIdAndIsReadFalseAndIsRecalledFalse(senderId, receiverId);
        for (Message message : unreadMessages) {
            message.setIsRead(true);
            messageRepository.save(message);
        }
        return unreadMessages.size();
    }
    
    /**
     * 获取用户的聊天会话列表
     */
    public List<Map<String, Object>> getChatSessions(Long userId) {
        // 获取用户发送和接收的所有消息
        List<Message> sentMessages = messageRepository.findBySenderIdOrderByCreatedAtDesc(userId);
        List<Message> receivedMessages = messageRepository.findByReceiverIdOrderByCreatedAtDesc(userId);
        
        // 合并并找出所有对话用户
        Set<Long> chatPartnerIds = new HashSet<>();
        Map<Long, Message> lastMessageMap = new HashMap<>();
        Map<Long, Integer> unreadCountMap = new HashMap<>();
        
        // 处理发送的消息
        for (Message msg : sentMessages) {
            Long partnerId = msg.getReceiverId();
            chatPartnerIds.add(partnerId);
            if (!lastMessageMap.containsKey(partnerId) || 
                msg.getCreatedAt().isAfter(lastMessageMap.get(partnerId).getCreatedAt())) {
                lastMessageMap.put(partnerId, msg);
            }
        }
        
        // 处理接收的消息
        for (Message msg : receivedMessages) {
            Long partnerId = msg.getSenderId();
            chatPartnerIds.add(partnerId);
            if (!lastMessageMap.containsKey(partnerId) || 
                msg.getCreatedAt().isAfter(lastMessageMap.get(partnerId).getCreatedAt())) {
                lastMessageMap.put(partnerId, msg);
            }
            // 统计未读消息
            if (!msg.getIsRead() && !msg.getIsRecalled()) {
                unreadCountMap.merge(partnerId, 1, Integer::sum);
            }
        }
        
        // 构建会话列表
        List<Map<String, Object>> sessions = new ArrayList<>();
        for (Long partnerId : chatPartnerIds) {
            Map<String, Object> session = new HashMap<>();
            session.put("userId", partnerId);
            Message lastMsg = lastMessageMap.get(partnerId);
            if (lastMsg != null) {
                session.put("lastMessage", lastMsg.getIsRecalled() ? "[消息已撤回]" : lastMsg.getContent());
                session.put("lastMessageTime", lastMsg.getCreatedAt());
            }
            session.put("unreadCount", unreadCountMap.getOrDefault(partnerId, 0));
            sessions.add(session);
        }
        
        // 按最后消息时间排序
        sessions.sort((a, b) -> {
            LocalDateTime timeA = (LocalDateTime) a.get("lastMessageTime");
            LocalDateTime timeB = (LocalDateTime) b.get("lastMessageTime");
            if (timeA == null && timeB == null) return 0;
            if (timeA == null) return 1;
            if (timeB == null) return -1;
            return timeB.compareTo(timeA);
        });
        
        return sessions;
    }
}
