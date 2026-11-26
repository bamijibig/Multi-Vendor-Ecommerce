import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'api_config.dart';
import 'session_store.dart';

/// Error surfaced by the API layer. The message is safe to show in the UI.
class ApiException implements Exception {
  ApiException(
    this.message, {
    this.statusCode,
    this.fieldErrors = const <String, List<String>>{},
  });

  final String message;
  final int? statusCode;
  final Map<String, List<String>> fieldErrors;

  @override
  String toString() => message;
}

/// Thin JSON client for the existing DRF endpoints.
///
/// * Attaches the JWT bearer token centrally for every `auth: true` call.
/// * Refreshes an expired access token once per request via
///   `POST /auth/token/refresh/`.
/// * Persists the token pair through [SessionStore] so logins survive restarts.
/// * Calls [onSessionExpired] when the refresh fails, so the app can clear its
///   user state cleanly.
class ApiClient {
  ApiClient._();

  static final ApiClient instance = ApiClient._();

  final SessionStore _sessionStore = const SessionStore();

  String? _accessToken;
  String? _refreshToken;

  /// Invoked when a 401 cannot be recovered (refresh failed or is missing).
  void Function()? onSessionExpired;

  bool get hasSession => _accessToken != null && _accessToken!.isNotEmpty;

  void setTokens({String? access, String? refresh}) {
    if (access != null && access.isNotEmpty) _accessToken = access;
    if (refresh != null && refresh.isNotEmpty) _refreshToken = refresh;
    unawaited(_persistTokens());
  }

  void clearSession() {
    _accessToken = null;
    _refreshToken = null;
    unawaited(_sessionStore.clear());
  }

  /// Restores the token pair saved by a previous app session.
  Future<void> restoreSession() async {
    try {
      final tokens = await _sessionStore.readTokens();
      final access = tokens['access'];
      final refresh = tokens['refresh'];
      if (access != null && access.isNotEmpty) _accessToken = access;
      if (refresh != null && refresh.isNotEmpty) _refreshToken = refresh;
    } catch (_) {
      // A storage failure must not stop the storefront from loading.
    }
  }

  Future<void> _persistTokens() async {
    final access = _accessToken;
    final refresh = _refreshToken;
    if (access == null || access.isEmpty) return;
    if (refresh == null || refresh.isEmpty) return;
    try {
      await _sessionStore.saveTokens(access: access, refresh: refresh);
    } catch (_) {
      // Best effort; the in-memory session still works for this run.
    }
  }

  Uri _uri(String path, [Map<String, String>? query]) {
    final base = ApiConfig.baseUrl.endsWith('/')
        ? ApiConfig.baseUrl
        : '${ApiConfig.baseUrl}/';
    final normalized = path.startsWith('/') ? path.substring(1) : path;
    final uri = Uri.parse('$base$normalized');
    if (query == null || query.isEmpty) return uri;
    return uri.replace(
      queryParameters: <String, String>{...uri.queryParameters, ...query},
    );
  }

  Future<dynamic> getJson(
    String path, {
    Map<String, String>? query,
    bool auth = false,
  }) =>
      _send('GET', path, query: query, auth: auth);

  Future<dynamic> postJson(String path, {Object? body, bool auth = false}) =>
      _send('POST', path, body: body, auth: auth);

  Future<dynamic> patchJson(String path, {Object? body, bool auth = false}) =>
      _send('PATCH', path, body: body, auth: auth);

  Future<dynamic> deleteJson(
    String path, {
    Object? body,
    bool auth = false,
  }) =>
      _send('DELETE', path, body: body, auth: auth);

  Future<dynamic> _send(
    String method,
    String path, {
    Map<String, String>? query,
    Object? body,
    bool auth = false,
    bool allowRefresh = true,
  }) async {
    final client = HttpClient()..connectionTimeout = ApiConfig.requestTimeout;
    try {
      final request =
          await client.openUrl(method, _uri(path, query)).timeout(
                ApiConfig.requestTimeout,
              );
      request.headers.set(HttpHeaders.acceptHeader, 'application/json');
      if (body != null) {
        request.headers.contentType = ContentType.json;
        request.add(utf8.encode(jsonEncode(body)));
      }
      final token = _accessToken;
      if (auth && token != null && token.isNotEmpty) {
        request.headers.set(HttpHeaders.authorizationHeader, 'Bearer $token');
      }

      final response =
          await request.close().timeout(ApiConfig.requestTimeout);
      final text = await response
          .transform(utf8.decoder)
          .join()
          .timeout(ApiConfig.requestTimeout);
      final decoded = text.isEmpty ? null : _tryDecode(text);

      if (response.statusCode == 401 && auth) {
        if (allowRefresh && _refreshToken != null) {
          final refreshed = await _refreshSession();
          if (refreshed) {
            return _send(
              method,
              path,
              query: query,
              body: body,
              auth: auth,
              allowRefresh: false,
            );
          }
        }
        clearSession();
        onSessionExpired?.call();
      }

      if (response.statusCode >= 200 && response.statusCode < 300) {
        return decoded;
      }
      throw ApiException(
        _errorMessage(decoded, response.statusCode),
        statusCode: response.statusCode,
        fieldErrors: _fieldErrors(decoded),
      );
    } on ApiException {
      rethrow;
    } on TimeoutException {
      throw ApiException(
        'The server took too long to respond. Please try again.',
      );
    } on SocketException {
      throw ApiException(
        'Cannot reach the server. Make sure the Django backend is running.',
      );
    } on FormatException {
      throw ApiException('The server returned an unexpected response.');
    } finally {
      client.close(force: true);
    }
  }

  Future<bool> _refreshSession() async {
    final refresh = _refreshToken;
    if (refresh == null || refresh.isEmpty) return false;
    final client = HttpClient()..connectionTimeout = ApiConfig.requestTimeout;
    try {
      final request = await client.postUrl(_uri('auth/token/refresh/'));
      request.headers.contentType = ContentType.json;
      request.add(utf8.encode(jsonEncode({'refresh': refresh})));
      final response =
          await request.close().timeout(ApiConfig.requestTimeout);
      final text =
          await response.transform(utf8.decoder).join().timeout(
                ApiConfig.requestTimeout,
              );
      if (response.statusCode != 200) return false;
      final decoded = _tryDecode(text);
      if (decoded is! Map) return false;
      final access = decoded['access'];
      if (access is! String || access.isEmpty) return false;
      _accessToken = access;
      final rotated = decoded['refresh'];
      if (rotated is String && rotated.isNotEmpty) _refreshToken = rotated;
      unawaited(_persistTokens());
      return true;
    } catch (_) {
      return false;
    } finally {
      client.close(force: true);
    }
  }

  dynamic _tryDecode(String text) {
    try {
      return jsonDecode(text);
    } catch (_) {
      return null;
    }
  }

  Map<String, List<String>> _fieldErrors(dynamic decoded) {
    if (decoded is! Map) return const <String, List<String>>{};
    final result = <String, List<String>>{};
    decoded.forEach((key, value) {
      if (key is! String) return;
      if (value is List) {
        result[key] = value.map((item) => item.toString()).toList();
      } else if (value is String) {
        result[key] = <String>[value];
      }
    });
    return result;
  }

  String _errorMessage(dynamic decoded, int status) {
    if (decoded is Map) {
      final error = decoded['error'];
      if (error is Map && error['message'] != null) {
        return error['message'].toString();
      }
      if (decoded['detail'] != null) return decoded['detail'].toString();
      if (decoded['message'] != null) return decoded['message'].toString();
      final fields = _fieldErrors(decoded);
      if (fields.isNotEmpty) {
        final entry = fields.entries.first;
        if (entry.value.isNotEmpty) return entry.value.first;
      }
    }
    if (status == 401) return 'Your session expired. Please log in again.';
    if (status == 403) return 'You do not have permission to do that.';
    if (status == 404) return 'We could not find what you were looking for.';
    if (status >= 500) return 'The server had a problem. Please try again.';
    return 'Something went wrong (HTTP $status).';
  }
}
