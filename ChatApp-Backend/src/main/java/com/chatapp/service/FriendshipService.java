package com.chatapp.service;

import com.chatapp.entity.Friendship;
import com.chatapp.entity.User;
import com.chatapp.repository.FriendshipRepository;
import com.chatapp.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class FriendshipService {
    
    private final FriendshipRepository friendshipRepository;
    private final UserRepository userRepository;

    @Transactional
    public Friendship sendFriendRequest(Long userId, Long friendId, String message) {
        System.out.println("[FriendRequest] 发送者ID: " + userId + ", 接收者ID: " + friendId);
        
        if (userId.equals(friendId)) {
            throw new RuntimeException("不能添加自己为好友");
        }

        Optional<User> friendOpt = userRepository.findById(friendId);
        if (friendOpt.isEmpty()) {
            throw new RuntimeException("用户不存在");
        }

        Optional<Friendship> existing = friendshipRepository.findFriendship(userId, friendId);
        if (existing.isPresent()) {
            Friendship friendship = existing.get();
            System.out.println("[FriendRequest] 已存在记录: " + friendship);
            if ("ACCEPTED".equals(friendship.getStatus())) {
                throw new RuntimeException("已经是好友关系");
            } else if ("PENDING".equals(friendship.getStatus())) {
                throw new RuntimeException("好友请求已发送，等待对方确认");
            } else if ("BLOCKED".equals(friendship.getStatus())) {
                throw new RuntimeException("无法添加该用户");
            }
        }

        Friendship friendship = new Friendship();
        friendship.setUserId(userId);
        friendship.setFriendId(friendId);
        friendship.setStatus("PENDING");
        friendship.setRequestMessage(message);
        friendship.setCreatedAt(LocalDateTime.now());
        friendship.setUpdatedAt(LocalDateTime.now());

        Friendship saved = friendshipRepository.save(friendship);
        System.out.println("[FriendRequest] 保存成功: " + saved);
        return saved;
    }

    @Transactional
    public Friendship acceptFriendRequest(Long requestId, Long userId) {
        Friendship friendship = friendshipRepository.findById(requestId)
                .orElseThrow(() -> new RuntimeException("好友请求不存在"));

        if (!friendship.getFriendId().equals(userId)) {
            throw new RuntimeException("无权操作此请求");
        }

        if (!"PENDING".equals(friendship.getStatus())) {
            throw new RuntimeException("该请求已处理");
        }

        friendship.setStatus("ACCEPTED");
        friendship.setUpdatedAt(LocalDateTime.now());

        return friendshipRepository.save(friendship);
    }

    @Transactional
    public void rejectFriendRequest(Long requestId, Long userId) {
        Friendship friendship = friendshipRepository.findById(requestId)
                .orElseThrow(() -> new RuntimeException("好友请求不存在"));

        if (!friendship.getFriendId().equals(userId)) {
            throw new RuntimeException("无权操作此请求");
        }

        if (!"PENDING".equals(friendship.getStatus())) {
            throw new RuntimeException("该请求已处理");
        }

        friendship.setStatus("REJECTED");
        friendship.setUpdatedAt(LocalDateTime.now());

        friendshipRepository.save(friendship);
    }

    @Transactional
    public void deleteFriend(Long userId, Long friendId) {
        Optional<Friendship> friendship = friendshipRepository.findFriendship(userId, friendId);
        friendship.ifPresent(friendshipRepository::delete);
    }

    public List<User> getFriendsList(Long userId) {
        List<Friendship> friendships = friendshipRepository.findAcceptedFriendships(userId);
        List<User> friends = new ArrayList<>();

        for (Friendship friendship : friendships) {
            Long friendId = friendship.getUserId().equals(userId) ? 
                           friendship.getFriendId() : friendship.getUserId();
            userRepository.findById(friendId).ifPresent(friends::add);
        }

        return friends;
    }

    public List<Friendship> getPendingRequests(Long userId) {
        System.out.println("[FriendRequest] 查询用户 " + userId + " 的待处理请求 (friendId=" + userId + ", status=PENDING)");
        List<Friendship> requests = friendshipRepository.findByFriendIdAndStatus(userId, "PENDING");
        System.out.println("[FriendRequest] 找到 " + requests.size() + " 条请求");
        for (Friendship req : requests) {
            System.out.println("[FriendRequest]   - ID:" + req.getId() + ", userId:" + req.getUserId() + ", friendId:" + req.getFriendId() + ", status:" + req.getStatus());
        }
        return requests;
    }

    public List<Friendship> getSentRequests(Long userId) {
        return friendshipRepository.findByUserIdAndStatus(userId, "PENDING");
    }

    public boolean areFriends(Long userId, Long friendId) {
        Optional<Friendship> friendship = friendshipRepository.findFriendship(userId, friendId);
        return friendship.isPresent() && "ACCEPTED".equals(friendship.get().getStatus());
    }
}
