package com.chatapp.repository;

import com.chatapp.entity.GroupAnnouncement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface GroupAnnouncementRepository extends JpaRepository<GroupAnnouncement, Long> {
    
    /**
     * 获取群的所有公告（未删除的，置顶优先，时间倒序）
     */
    @Query("SELECT a FROM GroupAnnouncement a WHERE a.groupId = ?1 AND a.isDeleted = false ORDER BY a.isPinned DESC, a.createdAt DESC")
    List<GroupAnnouncement> findByGroupIdOrderByPinnedAndTime(Long groupId);
    
    /**
     * 获取群的置顶公告
     */
    List<GroupAnnouncement> findByGroupIdAndIsPinnedTrueAndIsDeletedFalseOrderByCreatedAtDesc(Long groupId);
    
    /**
     * 统计群公告数量
     */
    long countByGroupIdAndIsDeletedFalse(Long groupId);
}
