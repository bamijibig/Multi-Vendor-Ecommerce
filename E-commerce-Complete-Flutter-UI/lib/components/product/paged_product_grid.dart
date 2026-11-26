import 'package:flutter/material.dart';

import '../../constants.dart';
import '../../models/api_models.dart';
import '../../services/api_client.dart';
import '../../services/catalog_service.dart';
import '../api_state_view.dart';
import '../skleton/skelton.dart';
import 'api_product_card.dart';

/// Filters accepted by [PagedProductGrid].
class ProductGridFilters {
  const ProductGridFilters({
    this.search,
    this.category,
    this.industry,
    this.subcategory,
    this.vendorStore,
    this.ordering,
    this.inStock,
  });

  final String? search, category, industry, ordering;
  final int? subcategory, vendorStore;
  final bool? inStock;

  bool matches(ProductGridFilters other) =>
      other.search == search &&
      other.category == category &&
      other.industry == industry &&
      other.subcategory == subcategory &&
      other.vendorStore == vendorStore &&
      other.inStock == inStock;
}

/// Paginated product grid used by the listing and search screens. Keeps the
/// UI kit's card widgets, error/empty illustrations and spacing.
class PagedProductGrid extends StatefulWidget {
  const PagedProductGrid({
    super.key,
    this.filters = const ProductGridFilters(),
    this.emptyTitle = 'No products found',
    this.emptyMessage = 'Try another search or category.',
    this.padding = const EdgeInsets.all(defaultPadding / 2),
  });

  final ProductGridFilters filters;
  final String emptyTitle, emptyMessage;
  final EdgeInsets padding;

  @override
  State<PagedProductGrid> createState() => _PagedProductGridState();
}

class _PagedProductGridState extends State<PagedProductGrid> {
  final List<Product> _items = <Product>[];
  bool _loading = true;
  bool _loadingMore = false;
  String? _error;
  int _page = 1;
  int _numPages = 1;

  @override
  void initState() {
    super.initState();
    _load(reset: true);
  }

  @override
  void didUpdateWidget(covariant PagedProductGrid oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!oldWidget.filters.matches(widget.filters)) _load(reset: true);
  }

  Future<void> _load({required bool reset}) async {
    if (reset) {
      setState(() {
        _loading = true;
        _error = null;
        _items.clear();
        _page = 1;
        _numPages = 1;
      });
    } else {
      if (_loadingMore || _page >= _numPages) return;
      setState(() => _loadingMore = true);
    }
    try {
      final result = await CatalogService.products(
        search: widget.filters.search,
        category: widget.filters.category,
        industry: widget.filters.industry,
        subcategory: widget.filters.subcategory,
        vendorStore: widget.filters.vendorStore,
        ordering: widget.filters.ordering,
        inStock: widget.filters.inStock,
        page: reset ? 1 : _page + 1,
      );
      if (!mounted) return;
      setState(() {
        if (reset) {
          _items
            ..clear()
            ..addAll(result.items);
        } else {
          _items.addAll(result.items);
        }
        _page = result.page;
        _numPages = result.numPages;
        _loading = false;
        _loadingMore = false;
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
        _loading = false;
        _loadingMore = false;
      });
    }
  }

  static const SliverGridDelegate _gridDelegate =
      SliverGridDelegateWithFixedCrossAxisCount(
    crossAxisCount: 2,
    mainAxisSpacing: defaultPadding / 2,
    crossAxisSpacing: defaultPadding / 2,
    mainAxisExtent: 220,
  );

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return GridView.builder(
        padding: widget.padding,
        physics: const AlwaysScrollableScrollPhysics(),
        gridDelegate: _gridDelegate,
        itemCount: 6,
        itemBuilder: (context, index) => const Skeleton(height: 220),
      );
    }
    if (_error != null && _items.isEmpty) {
      return ApiErrorView(
        message: _error!,
        onRetry: () => _load(reset: true),
      );
    }
    if (_items.isEmpty) {
      return ApiEmptyView(
        title: widget.emptyTitle,
        message: widget.emptyMessage,
      );
    }
    return RefreshIndicator(
      onRefresh: () => _load(reset: true),
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          SliverPadding(
            padding: widget.padding,
            sliver: SliverGrid(
              gridDelegate: _gridDelegate,
              delegate: SliverChildBuilderDelegate(
                (context, index) => ApiProductCard(product: _items[index]),
                childCount: _items.length,
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(defaultPadding),
              child: _page < _numPages
                  ? Center(
                      child: _loadingMore
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : OutlinedButton(
                              onPressed: () => _load(reset: false),
                              child: const Text("Load more"),
                            ),
                    )
                  : const SizedBox.shrink(),
            ),
          ),
        ],
      ),
    );
  }
}
