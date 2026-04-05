import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';

/// 天气服务
class WeatherService {
  static final Dio _dio = Dio();
  static const String _weatherBaseUrl = 'https://uapis.cn';
  static const String _ipApiUrl = 'https://ip9.com.cn/get';
  static const String _cacheKey = 'weather_cache';
  static const String _cacheTimeKey = 'weather_cache_time';
  static const String _cityKey = 'weather_city';
  static const int _cacheExpireMinutes = 30; // 30分钟缓存

  /// 获取天气（带缓存）
  static Future<WeatherResult> getWeather() async {
    try {
      // 先尝试从缓存获取
      final cachedData = await _getCachedWeather();
      if (cachedData != null) {
        debugPrint('[天气] 使用缓存数据');
        return WeatherResult.success(cachedData);
      }

      // 通过 IP 定位获取城市
      final city = await _getCityFromIP();
      if (city == null) {
        return WeatherResult.error('无法获取位置信息');
      }

      debugPrint('[天气] 获取到城市: $city');

      final response = await _dio.get(
        '$_weatherBaseUrl/api/v1/misc/weather',
        queryParameters: {
          'city': city,
          'extended': true,
        },
      );

      if (response.statusCode == 200) {
        final weatherData = WeatherData.fromJson(response.data);
        // 缓存数据
        await _cacheWeather(weatherData);
        return WeatherResult.success(weatherData);
      } else {
        return WeatherResult.error('获取天气失败');
      }
    } on DioException catch (e) {
      if (e.response?.statusCode == 410) {
        return WeatherResult.error('查询的地区无效');
      }
      return WeatherResult.error('网络请求失败');
    } catch (e) {
      debugPrint('[天气] 获取失败: $e');
      return WeatherResult.error('获取天气失败');
    }
  }

  /// 通过 IP 获取城市
  static Future<String?> _getCityFromIP() async {
    try {
      // 先尝试从缓存获取
      final prefs = await SharedPreferences.getInstance();
      final cachedCity = prefs.getString(_cityKey);
      if (cachedCity != null) {
        debugPrint('[天气] 使用缓存的城市: $cachedCity');
        return cachedCity;
      }

      final response = await _dio.get(_ipApiUrl);
      
      if (response.statusCode == 200 && response.data['ret'] == 200) {
        final data = response.data['data'];
        // 优先使用 area（区县），如果没有则使用 city
        final area = data['area'] as String?;
        final city = data['city'] as String?;
        
        final location = area?.isNotEmpty == true ? area : city;
        
        if (location != null && location.isNotEmpty) {
          // 缓存城市信息
          await prefs.setString(_cityKey, location);
          return location;
        }
      }
      
      debugPrint('[天气] IP定位失败，返回数据: ${response.data}');
      return null;
    } catch (e) {
      debugPrint('[天气] IP定位异常: $e');
      return null;
    }
  }

  /// 刷新天气（清除缓存）
  static Future<void> refreshWeather() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_cacheKey);
    await prefs.remove(_cacheTimeKey);
    await prefs.remove(_cityKey); // 也清除城市缓存
  }

  /// 从缓存获取天气
  static Future<WeatherData?> _getCachedWeather() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final cacheTimeStr = prefs.getString(_cacheTimeKey);
      final cacheData = prefs.getString(_cacheKey);

      if (cacheTimeStr == null || cacheData == null) {
        return null;
      }

      final cacheTime = DateTime.parse(cacheTimeStr);
      final now = DateTime.now();

      // 检查缓存是否过期
      if (now.difference(cacheTime).inMinutes > _cacheExpireMinutes) {
        return null;
      }

      return WeatherData.fromJson(json.decode(cacheData));
    } catch (e) {
      debugPrint('[天气] 读取缓存失败: $e');
      return null;
    }
  }

  /// 缓存天气数据
  static Future<void> _cacheWeather(WeatherData data) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_cacheKey, json.encode(data.toJson()));
      await prefs.setString(_cacheTimeKey, DateTime.now().toIso8601String());
    } catch (e) {
      debugPrint('[天气] 缓存失败: $e');
    }
  }

  /// 获取天气图标
  static IconData getWeatherIcon(String weather) {
    if (weather.contains('晴')) {
      return Icons.wb_sunny;
    } else if (weather.contains('雨')) {
      return Icons.grain;
    } else if (weather.contains('云') || weather.contains('阴')) {
      return Icons.wb_cloudy;
    } else if (weather.contains('雪')) {
      return Icons.ac_unit;
    } else if (weather.contains('雾') || weather.contains('霞')) {
      return Icons.cloud;
    } else {
      return Icons.wb_cloudy;
    }
  }

  /// 获取天气颜色
  static Color getWeatherColor(String weather) {
    if (weather.contains('晴')) {
      return const Color(0xFF56CCF2);
    } else if (weather.contains('雨')) {
      return const Color(0xFF667eea);
    } else if (weather.contains('云') || weather.contains('阴')) {
      return const Color(0xFF6B7280);
    } else if (weather.contains('雪')) {
      return const Color(0xFF7DD3FC);
    } else {
      return const Color(0xFF667eea);
    }
  }
}

/// 天气结果
class WeatherResult {
  final bool success;
  final WeatherData? data;
  final String? error;

  WeatherResult.success(this.data)
      : success = true,
        error = null;

  WeatherResult.error(this.error)
      : success = false,
        data = null;
}

/// 天气数据
class WeatherData {
  final String adcode;
  final String city;
  final String province;
  final int humidity;
  final String reportTime;
  final int temperature;
  final String weather;
  final String windDirection;
  final String windPower;

  WeatherData({
    required this.adcode,
    required this.city,
    required this.province,
    required this.humidity,
    required this.reportTime,
    required this.temperature,
    required this.weather,
    required this.windDirection,
    required this.windPower,
  });

  factory WeatherData.fromJson(Map<String, dynamic> json) {
    return WeatherData(
      adcode: json['adcode'] ?? '',
      city: json['city'] ?? '',
      province: json['province'] ?? '',
      humidity: json['humidity'] ?? 0,
      reportTime: json['report_time'] ?? '',
      temperature: (json['temperature'] ?? 0).toInt(),
      weather: json['weather'] ?? '',
      windDirection: json['wind_direction'] ?? '',
      windPower: json['wind_power'] ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'adcode': adcode,
      'city': city,
      'province': province,
      'humidity': humidity,
      'report_time': reportTime,
      'temperature': temperature,
      'weather': weather,
      'wind_direction': windDirection,
      'wind_power': windPower,
    };
  }
}
