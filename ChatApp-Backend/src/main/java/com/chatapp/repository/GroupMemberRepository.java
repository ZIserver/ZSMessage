package com.chatapp.repository;

import com.chatapp.entity.GroupMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface GroupMemberRepository extends JpaRepository<GroupMember, Long> {
    List<GroupMember> findByGroupId(Long groupId);
    List<GroupMember> findByUserId(Long userId);
    
    // 根据 groupId 和 userId 查找成员
    Optional<GroupMember> findByGroupIdAndUserId(Long groupId, Long userId);
    
    // 管理员功能：删除群组所有成员
    @Modifying
    @Query("DELETE FROM GroupMember m WHERE m.groupId = :groupId")
    void deleteByGroupId(@Param("groupId") Long groupId);
    
    // 删除指定成员
    @Modifying
    @Query("DELETE FROM GroupMember m WHERE m.groupId = :groupId AND m.userId = :userId")
    void deleteByGroupIdAndUserId(@Param("groupId") Long groupId, @Param("userId") Long userId);
}
