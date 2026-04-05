import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/utils/link_util.dart';

/// 二维码扫描页面
class QRScannerPage extends StatefulWidget {
  const QRScannerPage({super.key});

  @override
  State<QRScannerPage> createState() => _QRScannerPageState();
}

class _QRScannerPageState extends State<QRScannerPage> {
  MobileScannerController? _cameraController;
  bool _isProcessing = false;
  bool _hasPermission = true;
  bool _torchEnabled = false;

  @override
  void initState() {
    super.initState();
    _initCamera();
  }

  void _initCamera() {
    _cameraController = MobileScannerController(
      detectionSpeed: DetectionSpeed.normal,
      facing: CameraFacing.back,
      torchEnabled: false,
    );
  }

  @override
  void dispose() {
    _cameraController?.dispose();
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    if (_isProcessing) return;
    
    final List<Barcode> barcodes = capture.barcodes;
    if (barcodes.isEmpty) return;

    final barcode = barcodes.first;
    final String? code = barcode.rawValue;
    
    if (code == null || code.isEmpty) return;

    setState(() => _isProcessing = true);
    
    // 处理扫描结果
    _handleScanResult(code);
  }

  void _handleScanResult(String code) {
    // 检查是否是链接
    if (LinkUtil.containsLink(code)) {
      _showResultDialog(
        title: '扫描到链接',
        content: code,
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
              setState(() => _isProcessing = false);
            },
            child: const Text('取消'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.of(context).pop();
              LinkUtil.openUrl(code);
              setState(() => _isProcessing = false);
            },
            child: const Text('打开链接'),
          ),
        ],
      );
    } 
    // 检查是否是添加好友格式 (zsuser://userId)
    else if (code.startsWith('zsuser://')) {
      final userId = code.replaceFirst('zsuser://', '');
      _showResultDialog(
        title: '扫描到用户',
        content: '用户ID: $userId',
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
              setState(() => _isProcessing = false);
            },
            child: const Text('取消'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.of(context).pop();
              Navigator.of(context).pop({'type': 'user', 'userId': userId});
            },
            child: const Text('添加好友'),
          ),
        ],
      );
    }
    // 检查是否是加入群聊格式 (zsgroup://groupId)
    else if (code.startsWith('zsgroup://')) {
      final groupId = code.replaceFirst('zsgroup://', '');
      _showResultDialog(
        title: '扫描到群聊',
        content: '群组ID: $groupId',
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
              setState(() => _isProcessing = false);
            },
            child: const Text('取消'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.of(context).pop();
              Navigator.of(context).pop({'type': 'group', 'groupId': groupId});
            },
            child: const Text('加入群聊'),
          ),
        ],
      );
    }
    // 普通文本
    else {
      _showResultDialog(
        title: '扫描结果',
        content: code,
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
              setState(() => _isProcessing = false);
            },
            child: const Text('确定'),
          ),
        ],
      );
    }
  }

  void _showResultDialog({
    required String title,
    required String content,
    required List<Widget> actions,
  }) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        title: Text(title),
        content: SelectableText(content),
        actions: actions,
      ),
    );
  }

  void _toggleTorch() async {
    await _cameraController?.toggleTorch();
    setState(() {
      _torchEnabled = !_torchEnabled;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('扫描二维码'),
        actions: [
          IconButton(
            icon: Icon(_torchEnabled ? Icons.flash_on : Icons.flash_off),
            onPressed: _toggleTorch,
          ),
        ],
      ),
      body: Stack(
        children: [
          // 相机预览
          if (_hasPermission && _cameraController != null)
            MobileScanner(
              controller: _cameraController!,
              onDetect: _onDetect,
              errorBuilder: (context, error, child) {
                return Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(
                        Icons.error_outline,
                        size: 64,
                        color: AppColors.error,
                      ),
                      const SizedBox(height: 16),
                      Text(
                        '相机错误: ${error.errorCode}',
                        style: TextStyle(color: AppColors.textSecondary),
                      ),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: () {
                          _cameraController?.dispose();
                          _initCamera();
                          setState(() {});
                        },
                        child: const Text('重试'),
                      ),
                    ],
                  ),
                );
              },
            )
          else
            Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(
                    Icons.camera_alt_outlined,
                    size: 64,
                    color: AppColors.textHint,
                  ),
                  const SizedBox(height: 16),
                  Text(
                    '需要相机权限来扫描二维码',
                    style: TextStyle(color: AppColors.textSecondary),
                  ),
                ],
              ),
            ),

          // 扫描框
          Center(
            child: Container(
              width: 250,
              height: 250,
              decoration: BoxDecoration(
                border: Border.all(
                  color: AppColors.primary,
                  width: 2,
                ),
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),

          // 提示文字
          Positioned(
            bottom: 100,
            left: 0,
            right: 0,
            child: Text(
              '将二维码放入框内自动扫描',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Colors.white,
                fontSize: 14,
                shadows: [
                  Shadow(
                    color: Colors.black.withOpacity(0.5),
                    blurRadius: 4,
                  ),
                ],
              ),
            ),
          ),

          // 加载指示器
          if (_isProcessing)
            Container(
              color: Colors.black54,
              child: const Center(
                child: CircularProgressIndicator(),
              ),
            ),
        ],
      ),
    );
  }
}
