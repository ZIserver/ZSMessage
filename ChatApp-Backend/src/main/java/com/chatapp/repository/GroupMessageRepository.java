package com.chatapp.repository;

import com.chatapp.entity.GroupMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface GroupMessageRepository extends JpaRepository<GroupMessage, Long> {
    List<GroupMessage> findByGroupIdOrderByCreatedAtAsc(Long groupId);
    
    // 查询未读的群组消息（指定群组中不是由指定用户发送的未读消息）
    List<GroupMessage> findByGroupIdAndSenderIdNotAndIsReadFalse(Long groupId, Long senderId);
    
    // 管理员功能：删除
    void deleteByGroupId(Long groupId);
}
