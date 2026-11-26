/// Typed mirrors of the DRF payloads used by the storefront.
///
/// Every parser is defensive: the backend may omit optional fields (products
/// without a vendor store, categories without a banner, ratings without
/// reviews) and the UI must never crash on a missing value.
library;

import 'package:shop/services/api_config.dart';

double asDouble(dynamic value, {double fallback = 0}) {
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value) ?? fallback;
  return fallback;
}

double? asDoubleOrNull(dynamic value) {
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value);
  return null;
}

int asInt(dynamic value, {int fallback = 0}) {
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value) ?? fallback;
  return fallback;
}

int? asIntOrNull(dynamic value) {
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value);
  return null;
}

String asString(dynamic value, [String fallback = '']) {
  if (value == null) return fallback;
  if (value is String) return value;
  return value.toString();
}

bool asBool(dynamic value, {bool fallback = false}) {
  if (value is bool) return value;
  if (value is num) return value != 0;
  if (value is String) {
    final normalized = value.toLowerCase();
    if (normalized == 'true' || normalized == '1') return true;
    if (normalized == 'false' || normalized == '0') return false;
  }
  return fallback;
}

Map<String, dynamic> asMap(dynamic value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) {
    return value.map((key, item) => MapEntry(key.toString(), item));
  }
  return const <String, dynamic>{};
}

List<Map<String, dynamic>> asMapList(dynamic value) {
  if (value is List) return value.map(asMap).toList();
  return const <Map<String, dynamic>>[];
}

DateTime? asDate(dynamic value) {
  if (value is String && value.isNotEmpty) return DateTime.tryParse(value);
  return null;
}

class AppUser {
  const AppUser({
    required this.id,
    required this.email,
    required this.firstName,
    required this.lastName,
    required this.fullName,
    required this.mobile,
    required this.role,
    required this.isVendor,
    required this.stores,
  });

  final int id;
  final String email, firstName, lastName, fullName, mobile, role;
  final bool isVendor;
  final List<StoreSummary> stores;

  String get displayName {
    final name = fullName.trim();
    if (name.isNotEmpty) return name;
    if (email.isNotEmpty) return email.split('@').first;
    return 'Shopper';
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
        'id': id,
        'email': email,
        'first_name': firstName,
        'last_name': lastName,
        'full_name': fullName,
        'mobile': mobile,
        'user_role': role,
        'is_vendor': isVendor,
        'stores': stores.map((store) => store.toJson()).toList(),
      };

  factory AppUser.fromJson(Map<String, dynamic> json) {
    final first = asString(json['first_name']);
    final last = asString(json['last_name']);
    final combined = asString(json['full_name']).trim().isEmpty
        ? '$first $last'.trim()
        : asString(json['full_name']);
    return AppUser(
      id: asInt(json['id']),
      email: asString(json['email']),
      firstName: first,
      lastName: last,
      fullName: combined,
      mobile: asString(json['mobile']),
      role: asString(json['user_role']),
      isVendor: asBool(json['is_vendor']) || asString(json['user_role']) == '3',
      stores: asMapList(json['stores']).map(StoreSummary.fromJson).toList(),
    );
  }
}

class StoreSummary {
  const StoreSummary({required this.id, required this.name, required this.slug});

  final int id;
  final String name, slug;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'id': id,
        'name': name,
        'slug': slug,
      };

  factory StoreSummary.fromJson(Map<String, dynamic> json) => StoreSummary(
        id: asInt(json['id']),
        name: asString(json['name']),
        slug: asString(json['slug']),
      );
}

class VendorStore {
  const VendorStore({
    required this.id,
    required this.name,
    required this.slug,
    required this.logo,
    required this.isOfficial,
    required this.badge,
    required this.tagline,
    required this.productCount,
  });

  final int id;
  final String name, slug, logo, badge, tagline;
  final bool isOfficial;
  final int productCount;

  factory VendorStore.fromJson(Map<String, dynamic> json) => VendorStore(
        id: asInt(json['id']),
        name: asString(json['name']),
        slug: asString(json['slug']),
        logo: ApiConfig.resolveMediaUrl(asString(json['logo'])) ?? '',
        isOfficial: asBool(json['is_official']),
        badge: asString(json['official_badge'], 'Official Store'),
        tagline: asString(json['official_tagline']),
        productCount: asInt(json['product_count']),
      );
}

class SubCategory {
  const SubCategory({
    required this.id,
    required this.name,
    required this.slug,
    required this.categoryId,
  });

  final int id;
  final String name, slug;
  final int categoryId;

  factory SubCategory.fromJson(Map<String, dynamic> json) => SubCategory(
        id: asInt(json['id']),
        name: asString(json['name']),
        slug: asString(json['slug']),
        categoryId: asInt(json['categories']),
      );
}

class Category {
  const Category({
    required this.id,
    required this.name,
    required this.slug,
    required this.industryId,
    required this.industryName,
    required this.tagline,
    required this.bannerUrl,
    required this.productCount,
    required this.subcategories,
  });

  final int id;
  final String name, slug, industryName, tagline, bannerUrl;
  final int industryId;
  final int productCount;
  final List<SubCategory> subcategories;

  factory Category.fromJson(Map<String, dynamic> json) => Category(
        id: asInt(json['id']),
        name: asString(json['name']),
        slug: asString(json['slug']),
        industryId: asInt(json['industry']),
        industryName: asString(json['industry_name']),
        tagline: asString(json['tagline']),
        bannerUrl: ApiConfig.resolveMediaUrl(asString(json['banner_url'])) ?? '',
        productCount: asInt(json['product_count']),
        subcategories:
            asMapList(json['subcategories']).map(SubCategory.fromJson).toList(),
      );
}

class Industry {
  const Industry({
    required this.id,
    required this.name,
    required this.slug,
    required this.categories,
  });

  final int id;
  final String name, slug;
  final List<Category> categories;

  factory Industry.fromJson(Map<String, dynamic> json) => Industry(
        id: asInt(json['id']),
        name: asString(json['name']),
        slug: asString(json['slug']),
        categories:
            asMapList(json['categories']).map(Category.fromJson).toList(),
      );
}

class ProductSpec {
  const ProductSpec({required this.specification, required this.details});

  final String specification, details;

  factory ProductSpec.fromJson(Map<String, dynamic> json) => ProductSpec(
        specification: asString(json['specification']),
        details: asString(json['details']),
      );
}

class Product {
  const Product({
    required this.id,
    required this.title,
    required this.slug,
    required this.regularPrice,
    required this.discountedPrice,
    required this.discountPercent,
    required this.stoc,
    required this.outOfStock,
    required this.inStock,
    required this.primaryImage,
    required this.images,
    required this.description,
    required this.detailsDescription,
    required this.model,
    required this.tags,
    required this.averageRating,
    required this.reviewCount,
    required this.category,
    required this.vendorStore,
    required this.specs,
  });

  final int id;
  final String title, slug;
  final double regularPrice, discountedPrice;
  final int discountPercent, stoc;
  final bool outOfStock, inStock;
  final String? primaryImage;
  final List<String> images;
  final String description, detailsDescription, model;
  final List<String> tags;
  final double? averageRating;
  final int reviewCount;
  final Category? category;
  final VendorStore? vendorStore;
  final List<ProductSpec> specs;

  bool get hasDiscount => discountPercent > 0;
  double get effectivePrice => hasDiscount ? discountedPrice : regularPrice;

  /// Either the vendor store name or the category name, used by the cards'
  /// brand line.
  String get brandName {
    final store = vendorStore?.name.trim() ?? '';
    if (store.isNotEmpty) return store;
    return category?.name ?? '';
  }

  List<String> get gallery {
    if (images.isNotEmpty) return images;
    final primary = primaryImage ?? '';
    if (primary.isNotEmpty) return <String>[primary];
    return const <String>[];
  }

  factory Product.fromJson(Map<String, dynamic> json) {
    final images = asMapList(json['images'])
        .map((image) => ApiConfig.resolveMediaUrl(asString(image['url'])))
        .whereType<String>()
        .where((url) => url.isNotEmpty)
        .toList();
    return Product(
      id: asInt(json['id']),
      title: asString(json['title'], 'Untitled product'),
      slug: asString(json['slug']),
      regularPrice: asDouble(json['regular_price']),
      discountedPrice: asDouble(
        json['discounted_price'],
        fallback: asDouble(json['regular_price']),
      ),
      discountPercent: asInt(
        json['discount_percent'],
        fallback: asInt(json['discounted_parcent']),
      ),
      stoc: asInt(json['stoc']),
      outOfStock: asBool(json['out_of_stoc']),
      inStock: json.containsKey('in_stock')
          ? asBool(json['in_stock'])
          : (!asBool(json['out_of_stoc']) && asInt(json['stoc']) > 0),
      primaryImage:
          ApiConfig.resolveMediaUrl(asString(json['primary_image'])),
      images: images,
      description: asString(json['description']),
      detailsDescription: asString(json['details_description']),
      model: asString(json['modle']),
      tags: json['tag_list'] is List
          ? (json['tag_list'] as List).map((tag) => tag.toString()).toList()
          : asString(json['tag'])
              .split(',')
              .map((tag) => tag.trim())
              .where((tag) => tag.isNotEmpty)
              .toList(),
      averageRating: asDoubleOrNull(json['average_rating']),
      reviewCount: asInt(json['review_count']),
      category: json['category'] is Map
          ? Category.fromJson(asMap(json['category']))
          : null,
      vendorStore: json['vendor_store'] is Map
          ? VendorStore.fromJson(asMap(json['vendor_store']))
          : null,
      specs: asMapList(json['additional_information'])
          .map(ProductSpec.fromJson)
          .toList(),
    );
  }
}

class HomeSlide {
  const HomeSlide({
    required this.id,
    required this.title,
    required this.image,
    required this.discount,
    required this.productUrl,
  });

  final int id;
  final String title, image, productUrl;
  final int discount;

  factory HomeSlide.fromJson(Map<String, dynamic> json) => HomeSlide(
        id: asInt(json['id']),
        title: asString(json['title']),
        image: ApiConfig.resolveMediaUrl(asString(json['image'])) ?? '',
        discount: asInt(json['discount']),
        productUrl: asString(json['product_url']),
      );
}

class HotProduct {
  const HotProduct({
    required this.id,
    required this.title,
    required this.image,
    required this.categoryId,
    required this.categoryName,
    required this.productUrl,
  });

  final int id;
  final String title, image, categoryName, productUrl;
  final int categoryId;

  factory HotProduct.fromJson(Map<String, dynamic> json) => HotProduct(
        id: asInt(json['id']),
        title: asString(json['title']),
        image: ApiConfig.resolveMediaUrl(asString(json['image'])) ?? '',
        categoryId: asInt(json['categories']),
        categoryName: asString(json['category_name']),
        productUrl: asString(json['product_url']),
      );
}

class PopularCategory {
  const PopularCategory({
    required this.id,
    required this.image,
    required this.categoryId,
    required this.name,
    required this.slug,
  });

  final int id;
  final String image, name, slug;
  final int categoryId;

  factory PopularCategory.fromJson(Map<String, dynamic> json) => PopularCategory(
        id: asInt(json['id']),
        image: ApiConfig.resolveMediaUrl(asString(json['image'])) ?? '',
        categoryId: asInt(json['categories']),
        name: asString(json['category_name']),
        slug: asString(json['category_slug']),
      );
}

class CategoryShelf {
  const CategoryShelf({required this.category, required this.products});

  final Category category;
  final List<Product> products;

  factory CategoryShelf.fromJson(Map<String, dynamic> json) => CategoryShelf(
        category: Category.fromJson(asMap(json['category'])),
        products:
            asMapList(json['products']).map(Product.fromJson).toList(),
      );
}

class HomeFeed {
  const HomeFeed({
    required this.slides,
    required this.industries,
    required this.categories,
    required this.shelves,
    required this.officialStores,
    required this.hotProducts,
    required this.trendingProducts,
    required this.popularCategories,
  });

  final List<HomeSlide> slides;
  final List<Industry> industries;
  final List<Category> categories;
  final List<CategoryShelf> shelves;
  final List<VendorStore> officialStores;
  final List<HotProduct> hotProducts;
  final List<Product> trendingProducts;
  final List<PopularCategory> popularCategories;

  factory HomeFeed.fromJson(Map<String, dynamic> json) => HomeFeed(
        slides: asMapList(json['slider']).map(HomeSlide.fromJson).toList(),
        industries:
            asMapList(json['industries']).map(Industry.fromJson).toList(),
        categories:
            asMapList(json['categories']).map(Category.fromJson).toList(),
        shelves:
            asMapList(json['category_shelves']).map(CategoryShelf.fromJson).toList(),
        officialStores: asMapList(json['official_stores'])
            .map(VendorStore.fromJson)
            .toList(),
        hotProducts: asMapList(json['hot_products_in_categories'])
            .map(HotProduct.fromJson)
            .toList(),
        trendingProducts: asMapList(json['trending_products'])
            .map(Product.fromJson)
            .toList(),
        popularCategories: asMapList(json['popular_categories'])
            .map(PopularCategory.fromJson)
            .toList(),
      );
}

class Coupon {
  const Coupon({
    required this.name,
    required this.code,
    required this.percent,
    required this.upTo,
  });

  final String name, code;
  final int percent, upTo;

  factory Coupon.fromJson(Map<String, dynamic> json) => Coupon(
        name: asString(json['name']),
        code: asString(json['cupon_code']),
        percent: asInt(json['discoun_parcent']),
        upTo: asInt(json['up_to']),
      );
}

class CartItem {
  const CartItem({
    required this.id,
    required this.product,
    required this.quantity,
    required this.totalPrice,
  });

  final int id;
  final Product? product;
  final int quantity;
  final double totalPrice;

  factory CartItem.fromJson(Map<String, dynamic> json) => CartItem(
        id: asInt(json['id']),
        product: json['product'] is Map
            ? Product.fromJson(asMap(json['product']))
            : null,
        quantity: asInt(json['quantity'], fallback: 1),
        totalPrice: asDouble(json['total_product_price']),
      );
}

class CartSummary {
  const CartSummary({
    required this.count,
    required this.totalQuantity,
    required this.subtotal,
    required this.couponApplied,
    required this.coupon,
    required this.items,
  });

  final int count, totalQuantity;
  final double subtotal;
  final bool couponApplied;
  final Coupon? coupon;
  final List<CartItem> items;

  bool get isEmpty => items.isEmpty;
  int get quantityOf => totalQuantity;

  factory CartSummary.fromJson(Map<String, dynamic> json) => CartSummary(
        count: asInt(json['count']),
        totalQuantity: asInt(json['total_quantity']),
        subtotal: asDouble(json['subtotal']),
        couponApplied: asBool(json['coupon_applied']),
        coupon:
            json['coupon'] is Map ? Coupon.fromJson(asMap(json['coupon'])) : null,
        items: asMapList(json['items']).map(CartItem.fromJson).toList(),
      );

  static const CartSummary empty = CartSummary(
    count: 0,
    totalQuantity: 0,
    subtotal: 0,
    couponApplied: false,
    coupon: null,
    items: <CartItem>[],
  );
}

class Address {
  const Address({
    required this.id,
    required this.state,
    required this.city,
    required this.zipCode,
    required this.streetAddress,
    required this.mobile,
    required this.isBilling,
    required this.isShipping,
  });

  final int id;
  final String state, city, streetAddress, mobile;
  final int zipCode;
  final bool isBilling, isShipping;

  String get summary => '$city, $state';
  String get fullAddress => '$streetAddress, $city, $state $zipCode';

  factory Address.fromJson(Map<String, dynamic> json) => Address(
        id: asInt(json['id']),
        state: asString(json['state']),
        city: asString(json['city']),
        zipCode: asInt(json['zip_code']),
        streetAddress: asString(json['street_address']),
        mobile: asString(json['mobile']),
        isBilling: asBool(json['is_billing']),
        isShipping: asBool(json['is_shipping']),
      );
}

class OrderItem {
  const OrderItem({
    required this.id,
    required this.product,
    required this.quantity,
    required this.totalPrice,
  });

  final int id;
  final Product? product;
  final int quantity;
  final double totalPrice;

  factory OrderItem.fromJson(Map<String, dynamic> json) => OrderItem(
        id: asInt(json['id']),
        product: json['product'] is Map
            ? Product.fromJson(asMap(json['product']))
            : null,
        quantity: asInt(json['quantity'], fallback: 1),
        totalPrice: asDouble(json['total_price']),
      );
}

class Order {
  const Order({
    required this.id,
    required this.orderNumber,
    required this.status,
    required this.paid,
    required this.placedDate,
    required this.subTotal,
    required this.itemCount,
    required this.items,
    required this.shippingAddress,
  });

  final int id;
  final String orderNumber, status;
  final bool paid;
  final DateTime? placedDate;
  final double subTotal;
  final int itemCount;
  final List<OrderItem> items;
  final Address? shippingAddress;

  factory Order.fromJson(Map<String, dynamic> json) => Order(
        id: asInt(json['id']),
        orderNumber: asString(
          json['order_number'],
          'OID${asInt(json['id']).toString().padLeft(6, '0')}',
        ),
        status: asString(json['status'], 'Oder Recived'),
        paid: asBool(json['paid']),
        placedDate: asDate(json['placed_date']),
        subTotal: asDouble(json['sub_total_price']),
        itemCount: asInt(json['item_count']),
        items: asMapList(json['items']).map(OrderItem.fromJson).toList(),
        shippingAddress: json['shipping_address'] is Map
            ? Address.fromJson(asMap(json['shipping_address']))
            : null,
      );
}

class Review {
  const Review({
    required this.id,
    required this.userName,
    required this.stars,
    required this.message,
    required this.createdAt,
    required this.imageUrl,
  });

  final int id;
  final String userName, message, imageUrl;
  final int stars;
  final DateTime? createdAt;

  factory Review.fromJson(Map<String, dynamic> json) {
    final name = asString(json['user_name']).trim();
    return Review(
      id: asInt(json['id']),
      userName: name.isEmpty ? 'Customer' : name,
      stars: asInt(json['stars']),
      message: asString(json['review_message']),
      createdAt: asDate(json['created_at']),
      imageUrl: ApiConfig.resolveMediaUrl(asString(json['review_images'])) ?? '',
    );
  }
}
