import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

/// Persists the JWT pair and the last known profile so a login survives an app
/// restart. Uses `shared_preferences` as allowed by the integration checklist.
class SessionStore {
  const SessionStore();

  static const String _accessKey = 'shop.auth.access';
  static const String _refreshKey = 'shop.auth.refresh';
  static const String _userKey = 'shop.auth.user';

  Future<Map<String, String?>> readTokens() async {
    final prefs = await SharedPreferences.getInstance();
    return <String, String?>{
      'access': prefs.getString(_accessKey),
      'refresh': prefs.getString(_refreshKey),
    };
  }

  Future<void> saveTokens({required String access, required String refresh}) async {
    final prefs = await SharedPreferences.getInstance();
    if (access.isNotEmpty) await prefs.setString(_accessKey, access);
    if (refresh.isNotEmpty) await prefs.setString(_refreshKey, refresh);
  }

  Future<void> saveUser(Map<String, dynamic> user) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_userKey, jsonEncode(user));
  }

  Future<Map<String, dynamic>?> readUser() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_userKey);
    if (raw == null || raw.isEmpty) return null;
    try {
      final decoded = jsonDecode(raw);
      if (decoded is Map) {
        return decoded.map((key, value) => MapEntry(key.toString(), value));
      }
    } catch (_) {
      // Corrupt payload: treat as no cached profile.
    }
    return null;
  }

  Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_accessKey);
    await prefs.remove(_refreshKey);
    await prefs.remove(_userKey);
  }
}
