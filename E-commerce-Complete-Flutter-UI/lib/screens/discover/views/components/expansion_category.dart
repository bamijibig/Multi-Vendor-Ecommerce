import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:shop/constants.dart';
import 'package:shop/models/api_models.dart';
import 'package:shop/models/product_query.dart';
import 'package:shop/route/route_constants.dart';

/// Expandable category row. The children are the category's live
/// `products.SubCategories`, each of which filters the product listing.
class ExpansionCategory extends StatelessWidget {
  const ExpansionCategory({
    super.key,
    required this.title,
    required this.categorySlug,
    required this.subCategories,
    this.svgSrc = "assets/icons/Category.svg",
  });

  final String title, categorySlug, svgSrc;
  final List<SubCategory> subCategories;

  void _open(BuildContext context, ProductQuery query) {
    Navigator.pushNamed(context, onSaleScreenRoute, arguments: query);
  }

  @override
  Widget build(BuildContext context) {
    return ExpansionTile(
      iconColor: Theme.of(context).textTheme.bodyLarge!.color,
      collapsedIconColor: Theme.of(context).textTheme.bodyMedium!.color,
      leading: SvgPicture.asset(
        svgSrc,
        height: 24,
        width: 24,
        colorFilter: ColorFilter.mode(
          Theme.of(context).iconTheme.color!,
          BlendMode.srcIn,
        ),
      ),
      title: Text(
        title,
        style: const TextStyle(fontSize: 14),
      ),
      textColor: Theme.of(context).textTheme.bodyLarge!.color,
      childrenPadding: const EdgeInsets.only(left: defaultPadding * 3.5),
      children: List.generate(
        subCategories.length + 1,
        (index) {
          final isAll = index == 0;
          final subCategory =
              isAll ? null : subCategories[index - 1];
          return Column(
            children: [
              ListTile(
                onTap: () {
                  _open(
                    context,
                    ProductQuery(
                      title: isAll ? title : subCategory!.name,
                      category: categorySlug,
                      subcategory: isAll ? null : subCategory.id,
                      ordering: "-created_at",
                    ),
                  );
                },
                title: Text(
                  isAll ? "All $title" : subCategory.name,
                  style: const TextStyle(fontSize: 14),
                ),
              ),
              if (index < subCategories.length) const Divider(height: 1),
            ],
          );
        },
      ),
    );
  }
}
