import 'package:flutter/material.dart';
import 'package:shop/components/product/paged_product_grid.dart';
import 'package:shop/models/product_query.dart';

/// Product listing used by the "on sale" banners and by the category chips.
/// The filters arrive through the route arguments as a [ProductQuery].
class OnSaleScreen extends StatelessWidget {
  const OnSaleScreen({super.key, this.query = const ProductQuery()});

  final ProductQuery query;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(query.title),
      ),
      body: PagedProductGrid(
        filters: ProductGridFilters(
          search: query.search,
          category: query.category,
          industry: query.industry,
          subcategory: query.subcategory,
          vendorStore: query.vendorStore,
          ordering: query.ordering,
          inStock: query.inStock,
        ),
        emptyTitle: "Nothing on sale right now",
        emptyMessage: "Check back soon for new offers.",
      ),
    );
  }
}
