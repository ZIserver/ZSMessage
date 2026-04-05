package com.chatapp.repository;

import com.chatapp.entity.SystemMessage;
import com.chatapp.entity.SystemMessageType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SystemMessageRepository extends JpaRepository<SystemMessage, Long> {
    List<SystemMessage> findByUserId(Long userId);
    List<SystemMessage> findByIsActiveTrue();
    List<SystemMessage> findByMessageType(SystemMessageType messageType);
}