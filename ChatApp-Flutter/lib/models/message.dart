import 'package:json_annotation/json_annotation.dart';

part 'message.g.dart';

/// 消息类型
enum MessageType {
  text,
  image,
  file,
  audio,
  video,
  system,
  call,  // 通话消息
}

/// 通话状态
enum CallStatus {
  cancelled,  // 已取消
  missed,     // 对方未接听
  rejected,   // 对方已拒绝
  connected,  // 已接通
}

/// 消息模型
@JsonSerializable()
class Message {
  final int? id;
  final int senderId;
  final int receiverId;
  final String content;
  final String type;
  final DateTime? timestamp;
  final bool? isRead;
  final bool? isRecalled;
  final String? fileName;
  final int? fileSize;
  final String? filePath;
  
  // 发送者信息（可选）
  final String? senderName;
  final String? senderAvatar;
  
  Message({
    this.id,
    required this.senderId,
    required this.receiverId,
    required this.content,
    this.type = 'text',
    this.timestamp,
    this.isRead,
    this.isRecalled,
    this.fileName,
    this.fileSize,
    this.filePath,
    this.senderName,
    this.senderAvatar,
  });
  
  /// 是否为自己发送的消息
  bool isSentBy(int userId) => senderId == userId;
  
  /// 获取消息类型
  MessageType get messageType {
    switch (type.toLowerCase()) {
      case 'image':
        return MessageType.image;
      case 'file':
        return MessageType.file;
      case 'audio':
        return MessageType.audio;
      case 'video':
        return MessageType.video;
      case 'system':
        return MessageType.system;
      case 'call':
        return MessageType.call;
      default:
        return MessageType.text;
    }
  }
  
  factory Message.fromJson(Map<String, dynamic> json) => _$MessageFromJson(json);
  
  Map<String, dynamic> toJson() => _$MessageToJson(this);
  
  Message copyWith({
    int? id,
    int? senderId,
    int? receiverId,
    String? content,
    String? type,
    DateTime? timestamp,
    bool? isRead,
    bool? isRecalled,
    String? fileName,
    int? fileSize,
    String? filePath,
    String? senderName,
    String? senderAvatar,
  }) {
    return Message(
      id: id ?? this.id,
      senderId: senderId ?? this.senderId,
      receiverId: receiverId ?? this.receiverId,
      content: content ?? this.content,
      type: type ?? this.type,
      timestamp: timestamp ?? this.timestamp,
      isRead: isRead ?? this.isRead,
      isRecalled: isRecalled ?? this.isRecalled,
      fileName: fileName ?? this.fileName,
      fileSize: fileSize ?? this.fileSize,
      filePath: filePath ?? this.filePath,
      senderName: senderName ?? this.senderName,
      senderAvatar: senderAvatar ?? this.senderAvatar,
    );
  }
}
