import 'package:flutter/material.dart';
import 'package:shop/constants.dart';
import 'package:shop/models/api_models.dart';

import 'categories.dart';
import 'offers_carousel.dart';

class OffersCarouselAndCategories extends StatelessWidget {
  const OffersCarouselAndCategories({
    super.key,
    this.slides = const <HomeSlide>[],
    this.industries = const <Industry>[],
  });

  final List<HomeSlide> slides;
  final List<Industry> industries;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        OffersCarousel(slides: slides),
        const SizedBox(height: defaultPadding / 2),
        Padding(
          padding: const EdgeInsets.all(defaultPadding),
          child: Text(
            "Categories",
            style: Theme.of(context).textTheme.titleSmall,
          ),
        ),
        Categories(industries: industries),
      ],
    );
  }
}
