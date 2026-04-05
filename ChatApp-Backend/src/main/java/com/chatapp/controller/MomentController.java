package com.chatapp.controller;

import com.chatapp.entity.Moment;
import com.chatapp.entity.MomentComment;
import com.chatapp.service.MomentService;
import com.chatapp.util.XssUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/moments")
@CrossOrigin(origins = "*")
public class MomentController {

    @Autowired
    private MomentService momentService;

    @PostMapping("/create")
    public ResponseEntity<Moment> createMoment(@RequestBody Moment moment) {
        // XSS防护：清理朋友圈内容
        if (moment.getContent() != null) {
            moment.setContent(XssUtil.sanitize(moment.getContent()));
        }
        return ResponseEntity.ok(momentService.createMoment(moment));
    }

    @GetMapping("/all")
    public ResponseEntity<List<Moment>> getAllMoments() {
        return ResponseEntity.ok(momentService.getAllMoments());
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<List<Moment>> getUserMoments(@PathVariable Long userId) {
        return ResponseEntity.ok(momentService.getUserMoments(userId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Moment> getMomentById(@PathVariable Long id) {
        return ResponseEntity.ok(momentService.getMomentById(id));
    }

    @PostMapping("/{id}/like")
    public ResponseEntity<Void> likeMoment(@PathVariable Long id) {
        momentService.likeMoment(id);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/comments/add")
    public ResponseEntity<MomentComment> addComment(@RequestBody MomentComment comment) {
        // XSS防护：清理评论内容
        if (comment.getContent() != null) {
            comment.setContent(XssUtil.sanitize(comment.getContent()));
        }
        return ResponseEntity.ok(momentService.addComment(comment));
    }

    @GetMapping("/{momentId}/comments")
    public ResponseEntity<List<MomentComment>> getMomentComments(@PathVariable Long momentId) {
        return ResponseEntity.ok(momentService.getMomentComments(momentId));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteMoment(@PathVariable Long id) {
        momentService.deleteMoment(id);
        return ResponseEntity.ok().build();
    }
}
