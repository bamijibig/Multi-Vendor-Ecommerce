import 'package:flutter/material.dart';
import 'package:shop/components/product/api_product_card.dart';
import 'package:shop/constants.dart';
import 'package:shop/models/api_models.dart';

class PopularProducts extends StatelessWidget {
  const PopularProducts({
    super.key,
    this.products = const <Product>[],
  });

  final List<Product> products;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: defaultPadding / 2),
        Padding(
          padding: const EdgeInsets.all(defaultPadding),
          child: Text(
            "Popular products",
            style: Theme.of(context).textTheme.titleSmall,
          ),
        ),
        products.isEmpty
            ? const ProductRailSkeleton()
            : SizedBox(
                height: 220,
                child: ListView.builder(
                  scrollDirection: Axis.horizontal,
                  itemCount: products.length,
                  itemBuilder: (context, index) => Padding(
                    padding: EdgeInsets.only(
                      left: defaultPadding,
                      right: index == products.length - 1 ? defaultPadding : 0,
                    ),
                    child: ApiProductCard(product: products[index]),
                  ),
                ),
              ),
      ],
    );
  }
}
