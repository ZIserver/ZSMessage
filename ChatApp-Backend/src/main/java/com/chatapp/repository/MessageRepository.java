package com.chatapp.repository;

import com.chatapp.entity.Message;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MessageRepository extends JpaRepository<Message, Long> {
    List<Message> findBySenderIdAndReceiverIdOrSenderIdAndReceiverIdOrderByCreatedAtAsc(
        Long senderId1, Long receiverId1, Long receiverId2, Long senderId2);
    
    @Query("SELECT m FROM Message m WHERE (m.senderId = ?1 OR m.receiverId = ?1) AND m.content LIKE %?2% AND m.isRecalled = false ORDER BY m.createdAt DESC")
    List<Message> searchMessages(Long userId, String keyword);
    
    List<Message> findByReceiverIdAndIsReadFalseAndIsRecalledFalse(Long receiverId);
    
    // 标记来自某个发送者的所有未读消息
    List<Message> findBySenderIdAndReceiverIdAndIsReadFalseAndIsRecalledFalse(Long senderId, Long receiverId);
    
    // 管理员功能：分页查询和统计
    Page<Message> findByContentContaining(String keyword, Pageable pageable);
    
    List<Message> findBySenderIdOrderByCreatedAtDesc(Long senderId);
    
    List<Message> findByReceiverIdOrderByCreatedAtDesc(Long receiverId);
    
    long countByIsRecalledTrue();
    
    long countByIsForwardedTrue();
    
    // 管理员功能：级联删除
    void deleteBySenderId(Long senderId);
    
    void deleteByReceiverId(Long receiverId);
    
    // 管理员功能：获取两个用户之间的对话
    @Query("SELECT m FROM Message m WHERE (m.senderId = ?1 AND m.receiverId = ?2) OR (m.senderId = ?2 AND m.receiverId = ?1) ORDER BY m.createdAt ASC")
    Page<Message> findConversation(Long userId1, Long userId2, Pageable pageable);
}
