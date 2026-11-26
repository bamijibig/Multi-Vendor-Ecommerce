import 'package:flutter/material.dart';
import 'package:flutter_svg/svg.dart';
import 'package:flutter_widget_from_html_core/flutter_widget_from_html_core.dart';
import 'package:shop/components/api_state_view.dart';
import 'package:shop/components/cart_button.dart';
import 'package:shop/components/custom_modal_bottom_sheet.dart';
import 'package:shop/components/network_image_with_loader.dart';
import 'package:shop/components/product/api_product_card.dart';
import 'package:shop/components/review_card.dart';
import 'package:shop/constants.dart';
import 'package:shop/models/api_models.dart';
import 'package:shop/models/product_query.dart';
import 'package:shop/route/route_constants.dart';
import 'package:shop/screens/product/views/product_returns_screen.dart';
import 'package:shop/services/api_client.dart';
import 'package:shop/services/catalog_service.dart';
import 'package:shop/utils/format.dart';

import 'components/notify_me_card.dart';
import 'components/product_images.dart';
import 'components/product_info.dart';
import 'components/product_list_tile.dart';
import 'product_buy_now_screen.dart';

class ProductDetailsScreen extends StatefulWidget {
  const ProductDetailsScreen({super.key, this.slug, this.initialProduct});

  /// Product route slug. When [initialProduct] is passed the screen renders it
  /// immediately and refreshes the full detail in the background.
  final String? slug;
  final Product? initialProduct;

  @override
  State<ProductDetailsScreen> createState() => _ProductDetailsScreenState();
}

class _ProductDetailsScreenState extends State<ProductDetailsScreen> {
  Product? _product;
  List<Product> _related = const <Product>[];
  List<Review> _reviews = const <Review>[];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _product = widget.initialProduct;
    _loading = _product == null;
    _load();
  }

  Future<void> _load() async {
    final slug = (widget.slug ?? widget.initialProduct?.slug ?? '').trim();
    if (slug.isEmpty) {
      setState(() {
        _loading = false;
        _error = "This product is no longer available.";
      });
      return;
    }
    setState(() {
      _loading = _product == null;
      _error = null;
    });
    try {
      final product = await CatalogService.product(slug);
      if (!mounted) return;
      setState(() {
        _product = product;
        _loading = false;
      });
      await _loadRelated(product);
      await _loadReviews(product);
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
        _loading = false;
      });
    }
  }

  Future<void> _loadRelated(Product product) async {
    try {
      final page = await CatalogService.products(
        category: product.category?.slug,
        pageSize: 6,
      );
      if (!mounted) return;
      setState(() {
        _related = page.items
            .where((item) => item.id != product.id)
            .take(5)
            .toList();
      });
    } on ApiException {
      // Related products are optional; the page stays usable without them.
    }
  }

  Future<void> _loadReviews(Product product) async {
    try {
      final reviews = await CatalogService.reviews(product.id);
      if (!mounted) return;
      setState(() => _reviews = reviews);
    } on ApiException {
      // The reviews summary simply stays empty when the call fails.
    }
  }

  void _openBuySheet(Product product) {
    if (!product.inStock) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("This product is currently out of stock.")),
      );
      return;
    }
    customModalBottomSheet(
      context,
      height: MediaQuery.of(context).size.height * 0.92,
      child: ProductBuyNowScreen(product: product),
    );
  }

  void _showDetails(Product product) {
    final description = product.description;
    final details = product.detailsDescription;
    customModalBottomSheet(
      context,
      height: MediaQuery.of(context).size.height * 0.92,
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(defaultPadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              "Product details",
              style: Theme.of(context)
                  .textTheme
                  .titleMedium!
                  .copyWith(fontWeight: FontWeight.w500),
            ),
            const SizedBox(height: defaultPadding),
            description.isEmpty
                ? const Text("No description has been provided yet.")
                : HtmlWidget(description),
            if (details.isNotEmpty) ...[
              const SizedBox(height: defaultPadding),
              Text(
                "More details",
                style: Theme.of(context).textTheme.titleSmall,
              ),
              const SizedBox(height: defaultPadding / 2),
              HtmlWidget(details),
            ],
            if (product.specs.isNotEmpty) ...[
              const SizedBox(height: defaultPadding),
              Text(
                "Specifications",
                style: Theme.of(context).textTheme.titleSmall,
              ),
              const SizedBox(height: defaultPadding / 2),
              ...product.specs.map(
                (spec) => Padding(
                  padding: const EdgeInsets.only(bottom: defaultPadding / 2),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Text(
                          spec.specification,
                          style: const TextStyle(fontWeight: FontWeight.w500),
                        ),
                      ),
                      const SizedBox(width: defaultPadding),
                      Expanded(child: Text(spec.details)),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  void _showShipping() {
    customModalBottomSheet(
      context,
      height: MediaQuery.of(context).size.height * 0.6,
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(defaultPadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              "Shipping information",
              style: Theme.of(context)
                  .textTheme
                  .titleMedium!
                  .copyWith(fontWeight: FontWeight.w500),
            ),
            const SizedBox(height: defaultPadding),
            const Text(
              "Orders are prepared by the marketplace vendor that owns this product. "
              "Delivery timelines and fees are confirmed by the vendor once your "
              "order is packed, and the status is updated in your orders list.",
              style: TextStyle(height: 1.4),
            ),
          ],
        ),
      ),
    );
  }

  void _showStore(Product product) {
    final store = product.vendorStore;
    if (store == null) return;
    customModalBottomSheet(
      context,
      height: MediaQuery.of(context).size.height * 0.55,
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(defaultPadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              store.isOfficial ? "Official store" : "Store",
              style: Theme.of(context).textTheme.titleSmall,
            ),
            const SizedBox(height: defaultPadding),
            Row(
              children: [
                SizedBox(
                  width: 56,
                  height: 56,
                  child: NetworkImageWithLoader(
                    store.logo,
                    radius: defaultBorderRadious,
                  ),
                ),
                const SizedBox(width: defaultPadding / 2),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        store.name,
                        style: const TextStyle(fontWeight: FontWeight.w500),
                      ),
                      if (store.isOfficial)
                        Text(
                          store.badge.isEmpty
                              ? "Official Store"
                              : store.badge,
                        ),
                      if (store.tagline.isNotEmpty) Text(store.tagline),
                      Text("${store.productCount} products"),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: defaultPadding),
            ElevatedButton(
              onPressed: () {
                Navigator.pop(context);
                Navigator.pushNamed(
                  context,
                  onSaleScreenRoute,
                  arguments: ProductQuery(
                    title: store.name,
                    vendorStore: store.id,
                    ordering: "-created_at",
                  ),
                );
              },
              child: const Text("Browse store"),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final product = _product;
    if (product == null) {
      return Scaffold(
        appBar: AppBar(),
        body: _loading
            ? const Center(child: CircularProgressIndicator())
            : ApiErrorView(
                message: _error ?? "Product not found.",
                onRetry: _load,
              ),
      );
    }

    final totalReviews =
        product.reviewCount > 0 ? product.reviewCount : _reviews.length;
    final starCounts = <int, int>{1: 0, 2: 0, 3: 0, 4: 0, 5: 0};
    for (final review in _reviews) {
      final stars = review.stars >= 1 && review.stars <= 5 ? review.stars : 1;
      starCounts[stars] = (starCounts[stars] ?? 0) + 1;
    }

    final gallery =
        product.gallery.isEmpty ? const <String>[''] : product.gallery;
    final description = plainText(product.description);

    return Scaffold(
      bottomNavigationBar: product.inStock
          ? CartButton(
              price: product.effectivePrice,
              press: () => _openBuySheet(product),
            )
          : NotifyMeCard(
              isNotify: false,
              onChanged: (value) {},
            ),
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            SliverAppBar(
              backgroundColor: Theme.of(context).scaffoldBackgroundColor,
              floating: true,
              actions: [
                IconButton(
                  onPressed: () {},
                  icon: SvgPicture.asset("assets/icons/Bookmark.svg",
                      color: Theme.of(context).textTheme.bodyLarge!.color),
                ),
              ],
            ),
            ProductImages(images: gallery),
            ProductInfo(
              brand: product.brandName.isEmpty ? "Marketplace" : product.brandName,
              title: product.title,
              isAvailable: product.inStock,
              description: description.isEmpty
                  ? "No description has been provided yet."
                  : description,
              rating: product.averageRating ?? 0.0,
              numOfReviews: totalReviews,
            ),
            ProductListTile(
              svgSrc: "assets/icons/Product.svg",
              title: "Product Details",
              press: () => _showDetails(product),
            ),
            ProductListTile(
              svgSrc: "assets/icons/Delivery.svg",
              title: "Shipping Information",
              press: _showShipping,
            ),
            ProductListTile(
              svgSrc: "assets/icons/Return.svg",
              title: "Returns",
              isShowBottomBorder: true,
              press: () {
                customModalBottomSheet(
                  context,
                  height: MediaQuery.of(context).size.height * 0.92,
                  child: const ProductReturnsScreen(),
                );
              },
            ),
            if (product.vendorStore != null)
              ProductListTile(
                svgSrc: "assets/icons/Stores.svg",
                title: "Sold by ${product.vendorStore!.name}",
                press: () => _showStore(product),
              ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(defaultPadding),
                child: totalReviews > 0
                    ? ReviewCard(
                        rating: product.averageRating ?? 0.0,
                        numOfReviews: totalReviews,
                        numOfFiveStar: starCounts[5] ?? 0,
                        numOfFourStar: starCounts[4] ?? 0,
                        numOfThreeStar: starCounts[3] ?? 0,
                        numOfTwoStar: starCounts[2] ?? 0,
                        numOfOneStar: starCounts[1] ?? 0,
                      )
                    : const Text("No reviews yet."),
              ),
            ),
            ProductListTile(
              svgSrc: "assets/icons/Chat.svg",
              title: "Reviews",
              isShowBottomBorder: true,
              press: () {
                Navigator.pushNamed(
                  context,
                  productReviewsScreenRoute,
                  arguments: <String, dynamic>{
                    'productId': product.id,
                    'title': product.title,
                  },
                );
              },
            ),
            SliverPadding(
              padding: const EdgeInsets.all(defaultPadding),
              sliver: SliverToBoxAdapter(
                child: Text(
                  "You may also like",
                  style: Theme.of(context).textTheme.titleSmall!,
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: _related.isEmpty
                  ? const SizedBox(height: defaultPadding)
                  : SizedBox(
                      height: 220,
                      child: ListView.builder(
                        scrollDirection: Axis.horizontal,
                        itemCount: _related.length,
                        itemBuilder: (context, index) => Padding(
                          padding: EdgeInsets.only(
                            left: defaultPadding,
                            right: index == _related.length - 1
                                ? defaultPadding
                                : 0,
                          ),
                          child: ApiProductCard(
                            product: _related[index],
                            press: () {
                              Navigator.pushNamed(
                                context,
                                productDetailsScreenRoute,
                                arguments: _related[index].slug,
                              );
                            },
                          ),
                        ),
                      ),
                    ),
            ),
            const SliverToBoxAdapter(
              child: SizedBox(height: defaultPadding),
            )
          ],
        ),
      ),
    );
  }
}
