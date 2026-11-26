import 'package:flutter/foundation.dart';
import 'package:shop/models/api_models.dart';
import 'package:shop/services/account_service.dart';
import 'package:shop/services/api_client.dart';
import 'package:shop/services/catalog_service.dart';
import 'package:shop/services/session_store.dart';

/// Single application store the storefront screens listen to.
///
/// It owns the authenticated session, the home feed and the cart so the
/// existing Flutter widgets can render live DRF data without a new
/// dependency.
class AppState extends ChangeNotifier {
  AppState() {
    _client.onSessionExpired = _handleSessionExpired;
  }

  final ApiClient _client = ApiClient.instance;
  final SessionStore _sessionStore = const SessionStore();

  AppUser? _user;
  HomeFeed? _home;
  CartSummary? _cart;
  List<Order>? _orders;

  bool _loadingHome = false;
  String? _homeError;
  bool _loadingCart = false;
  String? _cartError;
  bool _placingOrder = false;
  bool _loadingOrders = false;
  String? _ordersError;

  AppUser? get user => _user;
  bool get isLoggedIn => _user != null;
  HomeFeed? get home => _home;
  bool get isLoadingHome => _loadingHome;
  String? get homeError => _homeError;
  CartSummary? get cart => _cart;
  bool get isLoadingCart => _loadingCart;
  String? get cartError => _cartError;
  bool get isPlacingOrder => _placingOrder;
  List<Order>? get orders => _orders;
  bool get isLoadingOrders => _loadingOrders;
  String? get ordersError => _ordersError;

  int get cartQuantity => _cart?.totalQuantity ?? 0;

  /// Called once at startup: restores the persisted JWT, refreshes the profile,
  /// loads the cart and finally the catalog feed.
  Future<void> initialize() async {
    await _client.restoreSession();
    if (_client.hasSession) {
      final cached = await _sessionStore.readUser();
      if (cached != null) {
        _user = AppUser.fromJson(cached);
        notifyListeners();
      }
      await _loadProfile();
      if (isLoggedIn) await loadCart(silent: true);
    }
    await loadHome();
  }

  Future<void> _loadProfile() async {
    try {
      final data = asMap(await _client.getJson('auth/me/', auth: true));
      final user = AppUser.fromJson(data);
      _user = user;
      await _sessionStore.saveUser(user.toJson());
      notifyListeners();
    } on ApiException {
      // Keep the cached profile; a hard 401 already cleared the session through
      // ApiClient.onSessionExpired.
    }
  }

  void _handleSessionExpired() {
    if (_user == null && _cart == null) return;
    _user = null;
    _cart = null;
    _orders = null;
    _cartError = null;
    _ordersError = null;
    notifyListeners();
  }

  Future<void> loadHome({bool force = false}) async {
    if (_loadingHome) return;
    if (_home != null && !force) return;
    _loadingHome = true;
    _homeError = null;
    notifyListeners();
    try {
      _home = await CatalogService.home();
    } on ApiException catch (error) {
      _homeError = error.message;
    } catch (_) {
      _homeError = 'We could not load the storefront right now.';
    } finally {
      _loadingHome = false;
      notifyListeners();
    }
  }

  Future<void> login(String email, String password) async {
    final data = asMap(
      await _client.postJson(
        'auth/login/',
        body: <String, dynamic>{'email': email.trim(), 'password': password},
      ),
    );
    _client.setTokens(
      access: asString(data['access']),
      refresh: asString(data['refresh']),
    );
    final user = AppUser.fromJson(asMap(data['user']));
    _user = user;
    await _sessionStore.saveUser(user.toJson());
    notifyListeners();
    await loadCart(silent: true);
  }

  Future<void> register({
    required String email,
    required String password,
    required String firstName,
    required String lastName,
    required String mobile,
  }) async {
    final data = asMap(
      await _client.postJson(
        'auth/register/',
        body: <String, dynamic>{
          'email': email.trim(),
          'password': password,
          'first_name': firstName.trim(),
          'last_name': lastName.trim(),
          'mobile': int.tryParse(mobile.trim()) ?? 0,
        },
      ),
    );
    _client.setTokens(
      access: asString(data['access']),
      refresh: asString(data['refresh']),
    );
    final user = AppUser.fromJson(asMap(data['user']));
    _user = user;
    await _sessionStore.saveUser(user.toJson());
    notifyListeners();
    await loadCart(silent: true);
  }

  void logout() {
    _client.clearSession();
    _user = null;
    _cart = null;
    _orders = null;
    _cartError = null;
    _ordersError = null;
    notifyListeners();
  }

  Future<void> loadCart({bool silent = false}) async {
    if (!isLoggedIn) {
      _cart = null;
      return;
    }
    _loadingCart = true;
    if (!silent) notifyListeners();
    try {
      _cart = CartSummary.fromJson(
        asMap(await _client.getJson('cart/', auth: true)),
      );
      _cartError = null;
    } on ApiException catch (error) {
      _cartError = error.message;
    } catch (_) {
      _cartError = 'We could not load your cart.';
    } finally {
      _loadingCart = false;
      notifyListeners();
    }
  }

  Future<void> addToCart(int productId, {int quantity = 1}) async {
    if (!isLoggedIn) {
      throw ApiException('Please log in to add items to your cart.');
    }
    _cart = CartSummary.fromJson(
      asMap(
        await _client.postJson(
          'cart/',
          auth: true,
          body: <String, dynamic>{'product': productId, 'quantity': quantity},
        ),
      ),
    );
    _cartError = null;
    notifyListeners();
  }

  Future<void> updateCartItem(int itemId, int quantity) async {
    _cart = CartSummary.fromJson(
      asMap(
        await _client.patchJson(
          'cart/$itemId/',
          auth: true,
          body: <String, dynamic>{'quantity': quantity},
        ),
      ),
    );
    _cartError = null;
    notifyListeners();
  }

  Future<void> removeCartItem(int itemId) async {
    _cart = CartSummary.fromJson(
      asMap(await _client.deleteJson('cart/$itemId/', auth: true)),
    );
    _cartError = null;
    notifyListeners();
  }

  Future<Order?> placeOrder(int addressId) async {
    _placingOrder = true;
    notifyListeners();
    try {
      final data = asMap(
        await _client.postJson(
          'orders/place/',
          auth: true,
          body: <String, dynamic>{'shipping_address_id': addressId},
        ),
      );
      final order =
          data['order'] is Map ? Order.fromJson(asMap(data['order'])) : null;
      await loadCart(silent: true);
      _orders = null;
      return order;
    } finally {
      _placingOrder = false;
      notifyListeners();
    }
  }

  Future<void> loadOrders({bool force = false}) async {
    if (!isLoggedIn) return;
    if (_loadingOrders) return;
    if (_orders != null && !force) return;
    _loadingOrders = true;
    _ordersError = null;
    notifyListeners();
    try {
      _orders = await AccountService.orders();
    } on ApiException catch (error) {
      _ordersError = error.message;
    } catch (_) {
      _ordersError = 'We could not load your orders.';
    } finally {
      _loadingOrders = false;
      notifyListeners();
    }
  }
}
