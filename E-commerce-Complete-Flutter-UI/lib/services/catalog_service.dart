import 'package:shop/models/api_models.dart';
import 'package:shop/services/api_client.dart';

/// A page of products plus the pagination metadata from the DRF response.
class ProductPage {
  const ProductPage({
    required this.items,
    this.count = 0,
    this.numPages = 1,
    this.page = 1,
  });

  final List<Product> items;
  final int count, numPages, page;

  bool get hasMore => page < numPages;
}

/// Read-only catalog calls (home feed, products, categories, reviews).
class CatalogService {
  const CatalogService._();

  static final ApiClient _client = ApiClient.instance;

  static Future<HomeFeed> home() async {
    final data = asMap(await _client.getJson('home/'));
    return HomeFeed.fromJson(data);
  }

  static Future<ProductPage> products({
    String? search,
    String? category,
    String? industry,
    int? subcategory,
    String? ordering,
    int? vendorStore,
    bool? inStock,
    int page = 1,
    int pageSize = 20,
  }) async {
    final query = <String, String>{
      'page': '$page',
      'page_size': '$pageSize',
    };
    if (search != null && search.trim().isNotEmpty) {
      query['search'] = search.trim();
    }
    if (category != null && category.isNotEmpty) query['category'] = category;
    if (industry != null && industry.isNotEmpty) {
      query['industry_slug'] = industry;
    }
    if (subcategory != null) query['subcategory'] = '$subcategory';
    if (ordering != null && ordering.isNotEmpty) query['ordering'] = ordering;
    if (vendorStore != null) query['vendor_store'] = '$vendorStore';
    if (inStock == true) query['in_stock'] = 'true';

    final data = asMap(await _client.getJson('products/', query: query));
    final results = data['results'] is List ? data['results'] as List : const [];
    return ProductPage(
      items: results.map((item) => Product.fromJson(asMap(item))).toList(),
      count: asInt(data['count']),
      numPages: asInt(data['num_pages'], fallback: 1),
      page: asInt(data['page'], fallback: page),
    );
  }

  static Future<Product> product(String slug) async {
    final data = asMap(await _client.getJson('products/$slug/'));
    return Product.fromJson(data);
  }

  static Future<List<Category>> categories() async {
    final data = await _client.getJson('categories/');
    if (data is List) {
      return data.map((item) => Category.fromJson(asMap(item))).toList();
    }
    return asMapList(asMap(data)['results'])
        .map(Category.fromJson)
        .toList();
  }

  static Future<List<Industry>> industries() async {
    final data = await _client.getJson('industries/');
    if (data is List) {
      return data.map((item) => Industry.fromJson(asMap(item))).toList();
    }
    return asMapList(asMap(data)['results'])
        .map(Industry.fromJson)
        .toList();
  }

  static Future<List<Review>> reviews(int productId) async {
    final data = asMap(
      await _client.getJson(
        'reviews/',
        query: <String, String>{
          'product': '$productId',
          'page_size': '100',
          'ordering': '-created_at',
        },
      ),
    );
    final results = data['results'] is List ? data['results'] as List : const [];
    return results.map((item) => Review.fromJson(asMap(item))).toList();
  }
}
