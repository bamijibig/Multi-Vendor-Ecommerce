import 'package:flutter/material.dart';
import 'package:shop/components/product/paged_product_grid.dart';
import 'package:shop/constants.dart';

import 'components/search_form.dart';

class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(),
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.all(defaultPadding),
              child: SearchForm(
                autofocus: true,
                onFieldSubmitted: (value) {
                  setState(() {
                    _query = (value ?? '').trim();
                  });
                },
              ),
            ),
            if (_query.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: defaultPadding),
                child: Text(
                  "Search the catalog",
                  style: Theme.of(context).textTheme.titleSmall,
                ),
              )
            else
              Expanded(
                child: PagedProductGrid(
                  key: ValueKey(_query),
                  filters: ProductGridFilters(search: _query, ordering: ''),
                  emptyTitle: "No matches for \"$_query\"",
                  emptyMessage: "Try a different keyword or browse categories.",
                ),
              ),
          ],
        ),
      ),
    );
  }
}
