package com.chatapp.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "calls")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Call {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long callerId;

    @Column(nullable = false)
    private Long receiverId;

    @Column(nullable = false)
    private String callType = "VOICE"; // VOICE, VIDEO

    @Column(nullable = false)
    private String status = "CALLING"; // CALLING, ACCEPTED, REJECTED, ENDED, MISSED

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    private LocalDateTime answeredAt;

    private LocalDateTime endedAt;

    private Integer duration; // in seconds
}
