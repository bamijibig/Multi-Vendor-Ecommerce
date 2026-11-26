import 'package:flutter/material.dart';
import 'package:shop/components/api_state_view.dart';

/// The backend has no wishlist endpoint yet, so the bookmark tab shows the UI
/// kit's empty state instead of the template's demo products.
class BookmarkScreen extends StatelessWidget {
  const BookmarkScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: const ApiEmptyView(
          imagePath: 'assets/Illustration/EmptyState_lightTheme.png',
          title: "No saved items yet",
          message: "Products you bookmark will be listed here.",
        ),
      ),
    );
  }
}
