package com.chatapp.repository;

import com.chatapp.entity.Announcement;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AnnouncementRepository extends JpaRepository<Announcement, Long> {
    
    /**
     * 查找所有启用的公告，按优先级和发布时间排序
     */
    List<Announcement> findByEnabledTrueOrderByPriorityDescPublishedAtDesc();
    
    /**
     * 查找最新的启用公告
     */
    Optional<Announcement> findFirstByEnabledTrueOrderByPriorityDescPublishedAtDesc();
    
    /**
     * 分页查询公告
     */
    Page<Announcement> findAllByOrderByCreatedAtDesc(Pageable pageable);
    
    /**
     * 按类型查询公告
     */
    List<Announcement> findByTypeAndEnabledTrueOrderByPriorityDescPublishedAtDesc(String type);
}
