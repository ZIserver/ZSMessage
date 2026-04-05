package com.chatapp.repository;

import com.chatapp.entity.Call;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CallRepository extends JpaRepository<Call, Long> {
    
    List<Call> findByCallerIdOrReceiverIdOrderByCreatedAtDesc(Long callerId, Long receiverId);
}
