import 'package:flutter/material.dart';
import 'package:flutter_rating_bar/flutter_rating_bar.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:shop/components/api_state_view.dart';
import 'package:shop/components/review_card.dart';
import 'package:shop/constants.dart';
import 'package:shop/models/api_models.dart';
import 'package:shop/services/api_client.dart';
import 'package:shop/services/catalog_service.dart';
import 'package:shop/utils/format.dart';

class ProductReviewsScreen extends StatefulWidget {
  const ProductReviewsScreen({super.key, this.productId, this.productTitle});

  final int? productId;
  final String? productTitle;

  @override
  State<ProductReviewsScreen> createState() => _ProductReviewsScreenState();
}

class _ProductReviewsScreenState extends State<ProductReviewsScreen> {
  List<Review>? _reviews;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final productId = widget.productId;
    if (productId == null) {
      setState(() => _reviews = const <Review>[]);
      return;
    }
    setState(() => _error = null);
    try {
      final reviews = await CatalogService.reviews(productId);
      if (!mounted) return;
      setState(() => _reviews = reviews);
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _error = error.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final reviews = _reviews;
    final title = widget.productTitle ?? "Reviews";

    return Scaffold(
      appBar: AppBar(
        title: Text(
          title,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ),
      body: _error != null
          ? ApiErrorView(message: _error!, onRetry: _load)
          : reviews == null
              ? const Center(child: CircularProgressIndicator())
              : reviews.isEmpty
                  ? const ApiEmptyView(
                      title: "No reviews yet",
                      message: "Be the first customer to review this product.",
                    )
                  : ListView(
                      padding: const EdgeInsets.all(defaultPadding),
                      children: [
                        _summary(context, reviews),
                        const SizedBox(height: defaultPadding),
                        ...reviews.map((review) => _reviewTile(context, review)),
                      ],
                    ),
    );
  }

  Widget _summary(BuildContext context, List<Review> reviews) {
    final counts = <int, int>{1: 0, 2: 0, 3: 0, 4: 0, 5: 0};
    var totalStars = 0;
    for (final review in reviews) {
      final stars = review.stars >= 1 && review.stars <= 5 ? review.stars : 1;
      counts[stars] = (counts[stars] ?? 0) + 1;
      totalStars += stars;
    }
    final average = reviews.isEmpty ? 0.0 : totalStars / reviews.length;
    return ReviewCard(
      rating: average,
      numOfReviews: reviews.length,
      numOfFiveStar: counts[5] ?? 0,
      numOfFourStar: counts[4] ?? 0,
      numOfThreeStar: counts[3] ?? 0,
      numOfTwoStar: counts[2] ?? 0,
      numOfOneStar: counts[1] ?? 0,
    );
  }

  Widget _reviewTile(BuildContext context, Review review) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            CircleAvatar(
              radius: 18,
              child: Text(
                initialsOf(review.userName),
                style: const TextStyle(fontSize: 12),
              ),
            ),
            const SizedBox(width: defaultPadding / 2),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    review.userName,
                    style: const TextStyle(
                      fontWeight: FontWeight.w500,
                      fontSize: 12,
                    ),
                  ),
                  Text(
                    formatDate(review.createdAt),
                    style: Theme.of(context).textTheme.labelSmall!.copyWith(
                          color: Theme.of(context).textTheme.bodyMedium!.color,
                        ),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: defaultPadding / 2),
        RatingBar.builder(
          initialRating: review.stars.toDouble(),
          itemSize: 14,
          itemPadding: const EdgeInsets.only(right: defaultPadding / 8),
          glow: false,
          allowHalfRating: false,
          ignoreGestures: true,
          onRatingUpdate: (value) {},
          itemBuilder: (context, index) =>
              SvgPicture.asset("assets/icons/Star_filled.svg"),
        ),
        const SizedBox(height: defaultPadding / 2),
        Text(review.message, style: const TextStyle(height: 1.4)),
        const SizedBox(height: defaultPadding),
        const Divider(height: 1),
        const SizedBox(height: defaultPadding),
      ],
    );
  }
}
