package com.chatapp.repository;

import com.chatapp.entity.UserToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface UserTokenRepository extends JpaRepository<UserToken, Long> {
    
    /**
     * 根据token查找
     */
    Optional<UserToken> findByToken(String token);
    
    /**
     * 根据用户ID查找所有token
     */
    List<UserToken> findByUserId(Long userId);
    
    /**
     * 删除过期的token
     */
    void deleteByExpiresAtBefore(LocalDateTime now);
    
    /**
     * 删除用户的所有token
     */
    void deleteByUserId(Long userId);
}
