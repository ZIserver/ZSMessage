package com.chatapp.controller;

import com.chatapp.entity.Friendship;
import com.chatapp.entity.User;
import com.chatapp.service.FriendshipService;

import com.chatapp.util.XssUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/friends")
@RequiredArgsConstructor
public class FriendshipController {
    
    private final FriendshipService friendshipService;

    @PostMapping("/request")
    public ResponseEntity<?> sendFriendRequest(@RequestBody Map<String, Object> request) {
        try {
            Integer userIdInt = (Integer) request.get("userId");
            Integer friendIdInt = (Integer) request.get("friendId");
            Long userId = userIdInt != null ? userIdInt.longValue() : null;
            Long friendId = friendIdInt != null ? friendIdInt.longValue() : null;
            String message = request.getOrDefault("message", "").toString();
            
            // XSS防护：清理好友请求消息
            message = XssUtil.sanitize(message);

            Friendship friendship = friendshipService.sendFriendRequest(userId, friendId, message);
            return ResponseEntity.ok(friendship);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    @PostMapping("/accept/{requestId}")
    public ResponseEntity<?> acceptFriendRequest(@PathVariable Long requestId, 
                                                  @RequestBody Map<String, Object> request) {
        try {
            Integer userIdInt = (Integer) request.get("userId");
            Long userId = userIdInt != null ? userIdInt.longValue() : null;
            Friendship friendship = friendshipService.acceptFriendRequest(requestId, userId);
            return ResponseEntity.ok(friendship);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    @PostMapping("/reject/{requestId}")
    public ResponseEntity<?> rejectFriendRequest(@PathVariable Long requestId, 
                                                  @RequestBody Map<String, Object> request) {
        try {
            Integer userIdInt = (Integer) request.get("userId");
            Long userId = userIdInt != null ? userIdInt.longValue() : null;
            friendshipService.rejectFriendRequest(requestId, userId);
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    @DeleteMapping("/{userId}/{friendId}")
    public ResponseEntity<?> deleteFriend(@PathVariable Long userId, @PathVariable Long friendId) {
        try {
            friendshipService.deleteFriend(userId, friendId);
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    @GetMapping("/list/{userId}")
    public ResponseEntity<?> getFriendsList(@PathVariable Long userId) {
        try {
            List<User> friends = friendshipService.getFriendsList(userId);
            return ResponseEntity.ok(friends);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    @GetMapping("/pending/{userId}")
    public ResponseEntity<?> getPendingRequests(@PathVariable Long userId) {
        try {
            List<Friendship> requests = friendshipService.getPendingRequests(userId);
            return ResponseEntity.ok(requests);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    @GetMapping("/sent/{userId}")
    public ResponseEntity<?> getSentRequests(@PathVariable Long userId) {
        try {
            List<Friendship> requests = friendshipService.getSentRequests(userId);
            return ResponseEntity.ok(requests);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    @GetMapping("/check/{userId}/{friendId}")
    public ResponseEntity<?> checkFriendship(@PathVariable Long userId, @PathVariable Long friendId) {
        try {
            boolean areFriends = friendshipService.areFriends(userId, friendId);
            Map<String, Boolean> response = new HashMap<>();
            response.put("areFriends", areFriends);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
}
