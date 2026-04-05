package com.chatapp.repository;

import com.chatapp.entity.FileMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FileMessageRepository extends JpaRepository<FileMessage, Long> {
    
    List<FileMessage> findBySenderIdAndReceiverIdOrReceiverIdAndSenderIdOrderByCreatedAtDesc(
        Long senderId1, Long receiverId1, Long senderId2, Long receiverId2);
    
    List<FileMessage> findByReceiverIdAndIsReadFalse(Long receiverId);
}
