import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../core/constants/app_constants.dart';

/// 头像组件
class AvatarWidget extends StatelessWidget {
  final String? url;
  final String? name;
  final double size;
  final VoidCallback? onTap;
  final String? cacheKey; // 用于强制刷新缓存

  const AvatarWidget({
    super.key,
    this.url,
    this.name,
    this.size = 40,
    this.onTap,
    this.cacheKey,
  });

  @override
  Widget build(BuildContext context) {
    Widget avatar;

    if (url != null && url!.isNotEmpty) {
      final fullUrl = url!.startsWith('http')
          ? url!
          : 'https://msg.v2.zhsdev.top$url';
      
      // 添加时间戳参数强制刷新（如果有cacheKey）
      final imageUrl = cacheKey != null 
          ? '$fullUrl?t=$cacheKey' 
          : fullUrl;

      avatar = ClipOval(
        child: CachedNetworkImage(
          imageUrl: imageUrl,
          width: size,
          height: size,
          fit: BoxFit.cover,
          placeholder: (context, url) => _buildPlaceholder(),
          errorWidget: (context, url, error) => _buildPlaceholder(),
          // 不缓存带时间戳的URL
          cacheKey: cacheKey != null ? null : fullUrl,
        ),
      );
    } else {
      avatar = _buildPlaceholder();
    }

    if (onTap != null) {
      return GestureDetector(
        onTap: onTap,
        child: avatar,
      );
    }

    return avatar;
  }

  Widget _buildPlaceholder() {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: AppColors.primary,
        shape: BoxShape.circle,
      ),
      child: Center(
        child: Text(
          name?.isNotEmpty == true ? name![0].toUpperCase() : '?',
          style: TextStyle(
            color: Colors.white,
            fontSize: size * 0.4,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
    );
  }
}
