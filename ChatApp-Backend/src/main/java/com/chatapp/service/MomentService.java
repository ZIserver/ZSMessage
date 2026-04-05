package com.chatapp.service;

import com.chatapp.entity.Moment;
import com.chatapp.entity.MomentComment;
import com.chatapp.repository.MomentRepository;
import com.chatapp.repository.MomentCommentRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class MomentService {

    @Autowired
    private MomentRepository momentRepository;

    @Autowired
    private MomentCommentRepository momentCommentRepository;

    public Moment createMoment(Moment moment) {
        return momentRepository.save(moment);
    }

    public List<Moment> getAllMoments() {
        return momentRepository.findAllByOrderByCreatedAtDesc();
    }

    public List<Moment> getUserMoments(Long userId) {
        return momentRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    public Moment getMomentById(Long id) {
        return momentRepository.findById(id).orElse(null);
    }

    public void likeMoment(Long momentId) {
        Moment moment = momentRepository.findById(momentId).orElse(null);
        if (moment != null) {
            moment.setLikeCount(moment.getLikeCount() + 1);
            momentRepository.save(moment);
        }
    }

    public MomentComment addComment(MomentComment comment) {
        return momentCommentRepository.save(comment);
    }

    public List<MomentComment> getMomentComments(Long momentId) {
        return momentCommentRepository.findByMomentIdOrderByCreatedAtAsc(momentId);
    }

    public void deleteMoment(Long id) {
        momentRepository.deleteById(id);
    }
}
