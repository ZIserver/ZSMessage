package com.chatapp.repository;

import com.chatapp.entity.Friendship;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FriendshipRepository extends JpaRepository<Friendship, Long> {
    
    List<Friendship> findByUserIdAndStatus(Long userId, String status);
    
    List<Friendship> findByFriendIdAndStatus(Long friendId, String status);
    
    @Query("SELECT f FROM Friendship f WHERE ((f.userId = ?1 AND f.friendId = ?2) OR (f.userId = ?2 AND f.friendId = ?1))")
    Optional<Friendship> findFriendship(Long userId, Long friendId);
    
    @Query("SELECT f FROM Friendship f WHERE (f.userId = ?1 OR f.friendId = ?1) AND f.status = 'ACCEPTED'")
    List<Friendship> findAcceptedFriendships(Long userId);
    
    // 管理员功能：级联删除
    void deleteByUserId(Long userId);
    
    void deleteByFriendId(Long friendId);
}
