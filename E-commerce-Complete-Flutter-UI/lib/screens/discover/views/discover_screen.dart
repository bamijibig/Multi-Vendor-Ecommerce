import 'package:flutter/material.dart';
import 'package:shop/components/api_state_view.dart';
import 'package:shop/constants.dart';
import 'package:shop/models/api_models.dart';
import 'package:shop/models/product_query.dart';
import 'package:shop/route/route_constants.dart';
import 'package:shop/screens/search/views/components/search_form.dart';
import 'package:shop/services/api_client.dart';
import 'package:shop/services/catalog_service.dart';

import 'components/expansion_category.dart';

/// Categories (with their subcategories) served by
/// `GET /api/categories/`, matching the template's expandable category list.
class DiscoverScreen extends StatefulWidget {
  const DiscoverScreen({super.key});

  @override
  State<DiscoverScreen> createState() => _DiscoverScreenState();
}

class _DiscoverScreenState extends State<DiscoverScreen> {
  List<Category>? _categories;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final categories = await CatalogService.categories();
      if (!mounted) return;
      setState(() => _categories = categories);
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _error = error.message);
    }
  }

  void _search(String? value) {
    final query = (value ?? '').trim();
    if (query.isEmpty) return;
    Navigator.pushNamed(
      context,
      onSaleScreenRoute,
      arguments: ProductQuery(
        title: "Search: $query",
        search: query,
        ordering: "-created_at",
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final categories = _categories;

    return Scaffold(
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.all(defaultPadding),
              child: SearchForm(onFieldSubmitted: _search),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(
                  horizontal: defaultPadding, vertical: defaultPadding / 2),
              child: Text(
                "Categories",
                style: Theme.of(context).textTheme.titleSmall,
              ),
            ),
            Expanded(
              child: _error != null
                  ? ApiErrorView(message: _error!, onRetry: _load)
                  : categories == null
                      ? const Center(child: CircularProgressIndicator())
                      : categories.isEmpty
                          ? const ApiEmptyView(
                              title: "No categories yet",
                              message:
                                  "Categories will appear once the catalog is populated.",
                            )
                          : ListView.builder(
                              itemCount: categories.length,
                              itemBuilder: (context, index) {
                                final category = categories[index];
                                return ExpansionCategory(
                                  title: category.name,
                                  categorySlug: category.slug,
                                  subCategories: category.subcategories,
                                );
                              },
                            ),
            )
          ],
        ),
      ),
    );
  }
}
