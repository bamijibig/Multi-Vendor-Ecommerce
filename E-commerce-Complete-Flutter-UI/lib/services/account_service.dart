import 'package:shop/models/api_models.dart';
import 'package:shop/services/api_client.dart';

/// Authenticated customer data: delivery addresses and placed orders.
class AccountService {
  const AccountService._();

  static final ApiClient _client = ApiClient.instance;

  static Future<List<Address>> addresses() async {
    final data = await _client.getJson('addresses/', auth: true);
    if (data is List) {
      return data.map((item) => Address.fromJson(asMap(item))).toList();
    }
    return asMapList(asMap(data)['results']).map(Address.fromJson).toList();
  }

  static Future<Address> createAddress({
    required String state,
    required String city,
    required String zipCode,
    required String streetAddress,
    required String mobile,
  }) async {
    final data = asMap(
      await _client.postJson(
        'addresses/',
        auth: true,
        body: <String, dynamic>{
          'state': state,
          'city': city,
          'zip_code': int.tryParse(zipCode.trim()) ?? 0,
          'street_address': streetAddress,
          'mobile': int.tryParse(mobile.trim()) ?? 0,
          'is_billing': true,
          'is_shipping': true,
        },
      ),
    );
    return Address.fromJson(data);
  }

  static Future<void> deleteAddress(int addressId) async {
    await _client.deleteJson('addresses/$addressId/', auth: true);
  }

  static Future<List<Order>> orders() async {
    final data = asMap(
      await _client.getJson(
        'orders/',
        query: <String, String>{'page_size': '50'},
        auth: true,
      ),
    );
    final results = data['results'] is List ? data['results'] as List : const [];
    return results.map((item) => Order.fromJson(asMap(item))).toList();
  }
}
