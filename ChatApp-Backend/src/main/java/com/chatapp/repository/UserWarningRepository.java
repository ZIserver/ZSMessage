package com.chatapp.repository;

import com.chatapp.entity.UserWarning;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface UserWarningRepository extends JpaRepository<UserWarning, Long> {
    List<UserWarning> findByUserId(Long userId);
}