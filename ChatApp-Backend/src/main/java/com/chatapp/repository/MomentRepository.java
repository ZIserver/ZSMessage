package com.chatapp.repository;

import com.chatapp.entity.Moment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MomentRepository extends JpaRepository<Moment, Long> {
    List<Moment> findAllByOrderByCreatedAtDesc();
    List<Moment> findByUserIdOrderByCreatedAtDesc(Long userId);
}
