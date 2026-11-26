import 'package:flutter/material.dart';
import 'package:shop/components/Banner/S/banner_s_style_1.dart';
import 'package:shop/components/Banner/S/banner_s_style_5.dart';
import 'package:shop/components/api_state_view.dart';
import 'package:shop/components/product/api_product_card.dart';
import 'package:shop/constants.dart';
import 'package:shop/models/api_models.dart';
import 'package:shop/route/route_constants.dart';
import 'package:shop/state/app_scope.dart';

import 'components/best_sellers.dart';
import 'components/flash_sale.dart';
import 'components/most_popular.dart';
import 'components/offer_carousel_and_categories.dart';
import 'components/official_stores.dart';
import 'components/popular_products.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      AppScope.of(context).loadHome();
    });
  }

  List<Product> _discounted(List<Product> products) {
    final list = products.where((product) => product.hasDiscount).toList()
      ..sort((a, b) => b.discountPercent.compareTo(a.discountPercent));
    return list.take(6).toList();
  }

  List<Product> _bestReviewed(List<Product> products) {
    final list = List<Product>.of(products)
      ..sort((a, b) => b.reviewCount.compareTo(a.reviewCount));
    return list.take(6).toList();
  }

  List<Product> _topRated(List<Product> products) {
    final list = List<Product>.of(products)
      ..sort((a, b) => (b.averageRating ?? 0).compareTo(a.averageRating ?? 0));
    return list.take(6).toList();
  }

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final feed = app.home;

    return Scaffold(
      body: SafeArea(
        child: feed == null
            ? (app.homeError != null
                ? ApiErrorView(
                    message: app.homeError!,
                    onRetry: () => app.loadHome(force: true),
                  )
                : const _HomeSkeleton())
            : RefreshIndicator(
                onRefresh: () => app.loadHome(force: true),
                child: CustomScrollView(
                  slivers: [
                    SliverToBoxAdapter(
                      child: OffersCarouselAndCategories(
                        slides: feed.slides,
                        industries: feed.industries,
                      ),
                    ),
                    SliverToBoxAdapter(
                      child: OfficialStores(stores: feed.officialStores),
                    ),
                    SliverToBoxAdapter(
                      child: PopularProducts(products: feed.trendingProducts),
                    ),
                    SliverPadding(
                      padding: const EdgeInsets.symmetric(
                        vertical: defaultPadding * 1.5,
                      ),
                      sliver: SliverToBoxAdapter(
                        child: FlashSale(
                          products: _discounted(feed.trendingProducts),
                          bannerImage: feed.slides.isNotEmpty
                              ? feed.slides.first.image
                              : null,
                        ),
                      ),
                    ),
                    SliverToBoxAdapter(
                      child: Column(
                        children: [
                          BannerSStyle1(
                            title: "New \narrival",
                            subtitle: "SPECIAL OFFER",
                            discountParcent: feed.slides.isNotEmpty &&
                                    feed.slides.first.discount > 0
                                ? feed.slides.first.discount
                                : 50,
                            press: () {
                              Navigator.pushNamed(context, onSaleScreenRoute);
                            },
                          ),
                          const SizedBox(height: defaultPadding / 4),
                        ],
                      ),
                    ),
                    SliverToBoxAdapter(
                      child: BestSellers(
                        products: _bestReviewed(feed.trendingProducts),
                      ),
                    ),
                    SliverToBoxAdapter(
                      child: MostPopular(
                        products: _topRated(feed.trendingProducts),
                      ),
                    ),
                    SliverToBoxAdapter(
                      child: Column(
                        children: [
                          const SizedBox(height: defaultPadding * 1.5),
                          const SizedBox(height: defaultPadding / 4),
                          BannerSStyle5(
                            title: "Black \nfriday",
                            subtitle: "50% Off",
                            bottomText: "Collection".toUpperCase(),
                            press: () {
                              Navigator.pushNamed(context, onSaleScreenRoute);
                            },
                          ),
                          const SizedBox(height: defaultPadding / 4),
                        ],
                      ),
                    ),
                    SliverToBoxAdapter(
                      child: BestSellers(
                        products: _bestReviewed(
                          feed.shelves
                              .expand((shelf) => shelf.products)
                              .toList(),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
      ),
    );
  }
}

/// Loading state built from the kit's skeleton blocks so the layout does not
/// jump when the feed arrives.
class _HomeSkeleton extends StatelessWidget {
  const _HomeSkeleton();

  @override
  Widget build(BuildContext context) {
    return const SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SkeletonBlock(height: 190, radious: 0),
          SizedBox(height: defaultPadding),
          Padding(
            padding: EdgeInsets.symmetric(horizontal: defaultPadding),
            child: SkeletonBlock(height: 36, radious: 18),
          ),
          SizedBox(height: defaultPadding * 2),
          Padding(
            padding: EdgeInsets.symmetric(horizontal: defaultPadding),
            child: SkeletonBlock(height: 28, width: 140),
          ),
          SizedBox(height: defaultPadding),
          ProductRailSkeleton(),
        ],
      ),
    );
  }
}

class SkeletonBlock extends StatelessWidget {
  const SkeletonBlock({
    super.key,
    this.height,
    this.width,
    this.radious = defaultPadding,
  });

  final double? height, width;
  final double radious;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: height,
      width: width,
      decoration: BoxDecoration(
        color: Theme.of(context).iconTheme.color!.withOpacity(0.04),
        borderRadius: BorderRadius.all(Radius.circular(radious)),
      ),
    );
  }
}
