import 'package:flutter/foundation.dart';

/// Where the Django/DRF backend lives and how its media paths are resolved.
///
/// Defaults per platform:
/// * Android emulator: `10.0.2.2` (the host machine).
/// * iOS simulator, desktop and web: `127.0.0.1`.
/// * Physical devices / deployed servers: pass an override, e.g.
///   `flutter run --dart-define=API_BASE_URL=http://192.168.0.10:8000/api`.
class ApiConfig {
  const ApiConfig._();

  static const String _override = String.fromEnvironment('API_BASE_URL');

  static const Duration requestTimeout = Duration(seconds: 25);

  static String get baseUrl {
    if (_override.isNotEmpty) return _override;
    if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
      return 'http://10.0.2.2:8000/api';
    }
    return 'http://127.0.0.1:8000/api';
  }

  /// Turns a Django media reference into an absolute URL.
  ///
  /// The serializers usually return absolute URLs (via
  /// `request.build_absolute_uri`), but some fields can be relative —
  /// `/media/...`, `/images/...` or a bare `media/...` path. Those are prefixed
  /// with the backend origin, while absolute URLs are passed through untouched.
  static String? resolveMediaUrl(String? value) {
    if (value == null) return null;
    final trimmed = value.trim();
    if (trimmed.isEmpty) return null;

    final lower = trimmed.toLowerCase();
    if (lower.startsWith('http://') || lower.startsWith('https://')) {
      return trimmed;
    }
    if (lower.startsWith('data:') || lower.startsWith('blob:')) return trimmed;
    if (lower.startsWith('//')) return 'https:$trimmed';

    final origin = _origin;
    if (trimmed.startsWith('/')) return '$origin$trimmed';
    return '$origin/$trimmed';
  }

  /// `http://host:port` derived from [baseUrl] (which includes `/api`).
  static String get _origin {
    final uri = Uri.tryParse(baseUrl);
    if (uri == null || uri.host.isEmpty) return baseUrl;
    final port = uri.hasPort ? ':${uri.port}' : '';
    return '${uri.scheme}://${uri.host}$port';
  }
}
