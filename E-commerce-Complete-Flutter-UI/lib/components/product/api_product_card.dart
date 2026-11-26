import 'package:flutter/material.dart';

import '../../constants.dart';
import '../../models/api_models.dart';
import '../../route/route_constants.dart';
import '../skleton/skelton.dart';
import 'product_card.dart';
import 'secondary_product_card.dart';

/// Binds a DRF [Product] to the UI kit's [ProductCard] without changing the
/// card's layout or styling.
class ApiProductCard extends StatelessWidget {
  const ApiProductCard({
    super.key,
    required this.product,
    this.press,
  });

  final Product product;
  final VoidCallback? press;

  @override
  Widget build(BuildContext context) {
    return ProductCard(
      image: product.primaryImage ?? '',
      brandName: product.brandName,
      title: product.title,
      price: product.regularPrice,
      priceAfetDiscount: product.hasDiscount ? product.discountedPrice : null,
      dicountpercent: product.hasDiscount ? product.discountPercent : null,
      press: press ??
          () {
            Navigator.pushNamed(
              context,
              productDetailsScreenRoute,
              arguments: product.slug,
            );
          },
    );
  }
}

/// Same binding for the wide horizontal card.
class ApiSecondaryProductCard extends StatelessWidget {
  const ApiSecondaryProductCard({
    super.key,
    required this.product,
    this.press,
  });

  final Product product;
  final VoidCallback? press;

  @override
  Widget build(BuildContext context) {
    return SecondaryProductCard(
      image: product.primaryImage ?? '',
      brandName: product.brandName,
      title: product.title,
      price: product.regularPrice,
      priceAfetDiscount: product.hasDiscount ? product.discountedPrice : null,
      dicountpercent: product.hasDiscount ? product.discountPercent : null,
      press: press ??
          () {
            Navigator.pushNamed(
              context,
              productDetailsScreenRoute,
              arguments: product.slug,
            );
          },
    );
  }
}

/// Horizontal skeleton used while product rails load.
class ProductRailSkeleton extends StatelessWidget {
  const ProductRailSkeleton({
    super.key,
    this.height = 220,
    this.width = 140,
  });

  final double height, width;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: height,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        physics: const NeverScrollableScrollPhysics(),
        itemCount: 3,
        itemBuilder: (context, index) => Padding(
          padding: EdgeInsets.only(
            left: defaultPadding,
            right: index == 2 ? defaultPadding : 0,
          ),
          child: SizedBox(
            width: width,
            height: height,
            child: Skeleton(height: height),
          ),
        ),
      ),
    );
  }
}
