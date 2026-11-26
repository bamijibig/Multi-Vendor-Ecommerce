/// Optional filters passed through the product routes.
class ProductQuery {
  const ProductQuery({
    this.title = 'On sale',
    this.search,
    this.category,
    this.industry,
    this.subcategory,
    this.vendorStore,
    this.ordering = '-discounted_parcent',
    this.inStock,
  });

  final String title;
  final String? search, category, industry, ordering;
  final int? subcategory, vendorStore;
  final bool? inStock;
}
