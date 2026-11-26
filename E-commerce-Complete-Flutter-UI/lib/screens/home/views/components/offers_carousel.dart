import 'dart:async';

import 'package:flutter/material.dart';
import 'package:shop/components/Banner/M/banner_m_style_1.dart';
import 'package:shop/components/Banner/M/banner_m_style_2.dart';
import 'package:shop/components/Banner/M/banner_m_style_4.dart';
import 'package:shop/components/dot_indicators.dart';
import 'package:shop/constants.dart';
import 'package:shop/models/api_models.dart';
import 'package:shop/route/route_constants.dart';

/// Promo carousel bound to the `slider` rows from `GET /api/home/`.
class OffersCarousel extends StatefulWidget {
  const OffersCarousel({
    super.key,
    this.slides = const <HomeSlide>[],
  });

  final List<HomeSlide> slides;

  @override
  State<OffersCarousel> createState() => _OffersCarouselState();
}

class _OffersCarouselState extends State<OffersCarousel> {
  int _selectedIndex = 0;
  late PageController _pageController;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _pageController = PageController(initialPage: 0);
    _timer = Timer.periodic(const Duration(seconds: 4), (Timer timer) {
      final count = widget.slides.length;
      if (count < 2 || !mounted || !_pageController.hasClients) return;
      _pageController.animateToPage(
        (_selectedIndex + 1) % count,
        duration: const Duration(milliseconds: 350),
        curve: Curves.easeOutCubic,
      );
    });
  }

  @override
  void didUpdateWidget(covariant OffersCarousel oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (_selectedIndex >= widget.slides.length) {
      _selectedIndex = 0;
      if (_pageController.hasClients) _pageController.jumpToPage(0);
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    _pageController.dispose();
    super.dispose();
  }

  Widget _slide(BuildContext context, HomeSlide slide) {
    final title = slide.title.trim().isEmpty ? 'Featured offer' : slide.title;
    final press = () {
      Navigator.pushNamed(context, onSaleScreenRoute);
    };
    if (slide.discount <= 0) {
      return BannerMStyle1(image: slide.image, text: title, press: press);
    }
    if (slide.discount >= 50) {
      return BannerMStyle4(
        image: slide.image,
        title: title,
        subtitle: "SPECIAL OFFER",
        discountParcent: slide.discount,
        press: press,
      );
    }
    return BannerMStyle2(
      image: slide.image,
      title: title,
      subtitle: "SPECIAL OFFER",
      discountParcent: slide.discount,
      press: press,
    );
  }

  @override
  Widget build(BuildContext context) {
    if (widget.slides.isEmpty) return const SizedBox.shrink();
    return AspectRatio(
      aspectRatio: 1.87,
      child: Stack(
        alignment: Alignment.bottomRight,
        children: [
          PageView.builder(
            controller: _pageController,
            itemCount: widget.slides.length,
            onPageChanged: (int index) {
              setState(() {
                _selectedIndex = index;
              });
            },
            itemBuilder: (context, index) => _slide(context, widget.slides[index]),
          ),
          FittedBox(
            child: Padding(
              padding: const EdgeInsets.all(defaultPadding),
              child: SizedBox(
                height: 16,
                child: Row(
                  children: List.generate(
                    widget.slides.length,
                    (index) {
                      return Padding(
                        padding:
                            const EdgeInsets.only(left: defaultPadding / 4),
                        child: DotIndicator(
                          isActive: index == _selectedIndex,
                          activeColor: Colors.white70,
                          inActiveColor: Colors.white54,
                        ),
                      );
                    },
                  ),
                ),
              ),
            ),
          )
        ],
      ),
    );
  }
}
