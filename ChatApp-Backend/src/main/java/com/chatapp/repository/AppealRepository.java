package com.chatapp.repository;

import com.chatapp.entity.Appeal;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AppealRepository extends JpaRepository<Appeal, Long> {
    List<Appeal> findByStatus(String status);
    List<Appeal> findByZsNumber(Long zsNumber);  // 按智穗号查找申诉
}