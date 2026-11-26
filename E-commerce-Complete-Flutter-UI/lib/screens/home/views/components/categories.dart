import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:shop/constants.dart';
import 'package:shop/models/api_models.dart';
import 'package:shop/models/product_query.dart';
import 'package:shop/route/route_constants.dart';

/// Horizontal category chips bound to the `industries` returned by the API.
class Categories extends StatelessWidget {
  const Categories({
    super.key,
    this.industries = const <Industry>[],
  });

  final List<Industry> industries;

  @override
  Widget build(BuildContext context) {
    if (industries.isEmpty) return const SizedBox.shrink();

    final items = <_CategoryChip>[
      _CategoryChip(
        name: "All Categories",
        route: discoverScreenRoute,
      ),
      ...industries.take(6).map(
            (industry) => _CategoryChip(
              name: industry.name,
              svgSrc: "assets/icons/Category.svg",
              query: ProductQuery(
                title: industry.name,
                industry: industry.slug,
                ordering: "-created_at",
              ),
            ),
          ),
    ];

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          ...List.generate(
            items.length,
            (index) => Padding(
              padding: EdgeInsets.only(
                left: index == 0 ? defaultPadding : defaultPadding / 2,
                right: index == items.length - 1 ? defaultPadding : 0,
              ),
              child: CategoryBtn(
                category: items[index].name,
                svgSrc: items[index].svgSrc,
                isActive: index == 0,
                press: () {
                  if (items[index].query != null) {
                    Navigator.pushNamed(
                      context,
                      onSaleScreenRoute,
                      arguments: items[index].query,
                    );
                  } else if (items[index].route != null) {
                    Navigator.pushNamed(context, items[index].route!);
                  }
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _CategoryChip {
  const _CategoryChip({required this.name, this.svgSrc, this.route, this.query});

  final String name;
  final String? svgSrc, route;
  final ProductQuery? query;
}

class CategoryBtn extends StatelessWidget {
  const CategoryBtn({
    super.key,
    required this.category,
    this.svgSrc,
    required this.isActive,
    required this.press,
  });

  final String category;
  final String? svgSrc;
  final bool isActive;
  final VoidCallback press;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: press,
      borderRadius: const BorderRadius.all(Radius.circular(30)),
      child: Container(
        height: 36,
        padding: const EdgeInsets.symmetric(horizontal: defaultPadding),
        decoration: BoxDecoration(
          color: isActive ? primaryColor : Colors.transparent,
          border: Border.all(
              color: isActive
                  ? Colors.transparent
                  : Theme.of(context).dividerColor),
          borderRadius: const BorderRadius.all(Radius.circular(30)),
        ),
        child: Row(
          children: [
            if (svgSrc != null)
              SvgPicture.asset(
                svgSrc!,
                height: 20,
                colorFilter: ColorFilter.mode(
                  isActive ? Colors.white : Theme.of(context).iconTheme.color!,
                  BlendMode.srcIn,
                ),
              ),
            if (svgSrc != null) const SizedBox(width: defaultPadding / 2),
            Text(
              category,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: isActive
                    ? Colors.white
                    : Theme.of(context).textTheme.bodyLarge!.color,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
