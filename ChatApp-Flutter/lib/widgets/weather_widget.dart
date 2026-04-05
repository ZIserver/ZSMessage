import 'package:flutter/material.dart';
import '../../core/constants/app_constants.dart';
import '../../core/services/weather_service.dart';

/// 天气小组件
class WeatherWidget extends StatefulWidget {
  const WeatherWidget({super.key});

  @override
  State<WeatherWidget> createState() => _WeatherWidgetState();
}

class _WeatherWidgetState extends State<WeatherWidget> {
  WeatherData? _weatherData;
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadWeather();
  }

  Future<void> _loadWeather() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    final result = await WeatherService.getWeather();

    if (mounted) {
      setState(() {
        _isLoading = false;
        if (result.success) {
          _weatherData = result.data;
        } else {
          _error = result.error;
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: _showWeatherDetail,
      child: Container(
        margin: const EdgeInsets.symmetric(
          horizontal: AppDimens.spacing16,
          vertical: AppDimens.spacing8,
        ),
        padding: const EdgeInsets.all(AppDimens.spacing16),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [
              _weatherData != null
                  ? WeatherService.getWeatherColor(_weatherData!.weather)
                  : AppColors.primary,
              AppColors.primaryLight,
            ],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(AppDimens.radiusLarge),
          boxShadow: [
            BoxShadow(
              color: AppColors.primary.withOpacity(0.3),
              blurRadius: 8,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: _buildContent(),
      ),
    );
  }

  Widget _buildContent() {
    if (_isLoading) {
      return const SizedBox(
        height: 60,
        child: Center(
          child: CircularProgressIndicator(
            color: Colors.white,
            strokeWidth: 2,
          ),
        ),
      );
    }

    if (_error != null || _weatherData == null) {
      return SizedBox(
        height: 60,
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.cloud_off, color: Colors.white54),
              const SizedBox(height: 4),
              Text(
                '获取天气失败',
                style: TextStyle(color: Colors.white.withOpacity(0.8), fontSize: 12),
              ),
              GestureDetector(
                onTap: _loadWeather,
                child: Text(
                  '点击重试',
                  style: TextStyle(
                    color: Colors.white.withOpacity(0.9),
                    fontSize: 12,
                    decoration: TextDecoration.underline,
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }

    return Row(
      children: [
        // 天气图标
        Icon(
          WeatherService.getWeatherIcon(_weatherData!.weather),
          size: 48,
          color: Colors.white,
        ),
        const SizedBox(width: AppDimens.spacing16),
        // 天气信息
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Text(
                    '${_weatherData!.temperature}°C',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    _weatherData!.weather,
                    style: TextStyle(
                      color: Colors.white.withOpacity(0.9),
                      fontSize: 16,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                _weatherData!.city,
                style: TextStyle(
                  color: Colors.white.withOpacity(0.8),
                  fontSize: 14,
                ),
              ),
            ],
          ),
        ),
        // 刷新按钮
        IconButton(
          icon: const Icon(Icons.refresh, color: Colors.white70),
          onPressed: () async {
            await WeatherService.refreshWeather();
            _loadWeather();
          },
        ),
      ],
    );
  }

  void _showWeatherDetail() {
    if (_weatherData == null) return;

    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppDimens.spacing24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // 标题
              Row(
                children: [
                  Icon(
                    WeatherService.getWeatherIcon(_weatherData!.weather),
                    size: 32,
                    color: WeatherService.getWeatherColor(_weatherData!.weather),
                  ),
                  const SizedBox(width: 12),
                  Text(
                    _weatherData!.city,
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const Spacer(),
                  Text(
                    '${_weatherData!.temperature}°C',
                    style: const TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              // 详情
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _buildDetailItem(
                    icon: Icons.cloud,
                    label: '天气',
                    value: _weatherData!.weather,
                  ),
                  _buildDetailItem(
                    icon: Icons.water_drop,
                    label: '湿度',
                    value: '${_weatherData!.humidity}%',
                  ),
                  _buildDetailItem(
                    icon: Icons.air,
                    label: '风向',
                    value: _weatherData!.windDirection,
                  ),
                  _buildDetailItem(
                    icon: Icons.speed,
                    label: '风力',
                    value: '${_weatherData!.windPower}级',
                  ),
                ],
              ),
              const SizedBox(height: 16),
              if (_weatherData!.reportTime.isNotEmpty)
                Text(
                  '更新时间: ${_weatherData!.reportTime}',
                  style: TextStyle(
                    color: AppColors.textHint,
                    fontSize: 12,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDetailItem({
    required IconData icon,
    required String label,
    required String value,
  }) {
    return Column(
      children: [
        Icon(icon, color: AppColors.textSecondary),
        const SizedBox(height: 4),
        Text(
          label,
          style: TextStyle(
            color: AppColors.textHint,
            fontSize: 12,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          style: const TextStyle(
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }
}
