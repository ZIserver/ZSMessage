package com.chatapp.repository;

import com.chatapp.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByUsername(String username);
    Boolean existsByUsername(String username);
    Page<User> findByUsernameContainingOrNicknameContaining(String username, String nickname, Pageable pageable);
    Optional<User> findByEmail(String email);
    Optional<User> findFirstByPhoneOrderByIdAsc(String phone);
    
    // 智穗号查询
    Optional<User> findByZsNumber(Long zsNumber);
    
    // 获取最大智穗号（用于生成新号）
    @Query("SELECT MAX(u.zsNumber) FROM User u")
    Long findMaxZsNumber();
    
    // 通过智穗号或用户名或昵称搜索
    Page<User> findByZsNumberOrUsernameContainingOrNicknameContaining(Long zsNumber, String username, String nickname, Pageable pageable);
}
