package com.chatapp.repository;

import com.chatapp.entity.MomentComment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MomentCommentRepository extends JpaRepository<MomentComment, Long> {
    List<MomentComment> findByMomentIdOrderByCreatedAtAsc(Long momentId);
}
