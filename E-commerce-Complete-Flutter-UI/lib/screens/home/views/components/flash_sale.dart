import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:shop/components/Banner/M/banner_m_with_counter.dart';
import 'package:shop/components/product/api_product_card.dart';
import 'package:shop/constants.dart';
import 'package:shop/models/api_models.dart';

class FlashSale extends StatelessWidget {
  const FlashSale({
    super.key,
    this.products = const <Product>[],
    this.bannerImage,
  });

  final List<Product> products;
  final String? bannerImage;

  @override
  Widget build(BuildContext context) {
    final highestDiscount = products.isEmpty
        ? 0
        : products
            .map((product) => product.discountPercent)
            .reduce(math.max);
    final bannerText = highestDiscount > 0
        ? "Super Flash Sale \n$highestDiscount% Off"
        : "Flash sale";

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        BannerMWithCounter(
          // Falls back to the template artwork when the feed has no slider.
          image: (bannerImage == null || bannerImage!.isEmpty)
              ? "https://i.imgur.com/pRgcbpS.png"
              : bannerImage!,
          duration: const Duration(hours: 8),
          text: bannerText,
          press: () {},
        ),
        const SizedBox(height: defaultPadding / 2),
        Padding(
          padding: const EdgeInsets.all(defaultPadding),
          child: Text(
            "Flash sale",
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
