package com.chatapp.repository;

import com.chatapp.entity.ChatGroup;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ChatGroupRepository extends JpaRepository<ChatGroup, Long> {
    
    /**
     * 根据群号查找群
     */
    Optional<ChatGroup> findByGroupNumber(Long groupNumber);
    
    /**
     * 检查群号是否已存在
     */
    boolean existsByGroupNumber(Long groupNumber);
    
    /**
     * 获取最大群号
     */
    @Query("SELECT MAX(g.groupNumber) FROM ChatGroup g")
    Long findMaxGroupNumber();
    
    /**
     * 按群名模糊搜索
     */
    List<ChatGroup> findByGroupNameContainingIgnoreCase(String keyword);
    
    /**
     * 根据邀请码查找群
     */
    Optional<ChatGroup> findByInviteCode(String inviteCode);
}
