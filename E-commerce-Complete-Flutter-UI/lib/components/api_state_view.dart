import 'package:flutter/material.dart';

import '../constants.dart';

/// Error state used by screens that fetch data. Uses the UI kit's error
/// illustration and button styles so it blends with the existing design.
class ApiErrorView extends StatelessWidget {
  const ApiErrorView({
    super.key,
    required this.message,
    this.onRetry,
    this.imagePath = 'assets/Illustration/Failed_lightTheme.png',
  });

  final String message;
  final VoidCallback? onRetry;
  final String imagePath;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(defaultPadding),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Image.asset(imagePath, height: 140),
          const SizedBox(height: defaultPadding),
          Text(
            message,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodyLarge,
          ),
          if (onRetry != null) ...[
            const SizedBox(height: defaultPadding),
            OutlinedButton(
              onPressed: onRetry,
              child: const Text("Try again"),
            ),
          ],
        ],
      ),
    );
  }
}

/// Empty state used when a collection comes back with no rows.
class ApiEmptyView extends StatelessWidget {
  const ApiEmptyView({
    super.key,
    required this.title,
    this.message,
    this.actionLabel,
    this.onAction,
    this.imagePath = 'assets/Illustration/NoResult.png',
  });

  final String title;
  final String? message, actionLabel;
  final VoidCallback? onAction;
  final String imagePath;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(defaultPadding * 1.5),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Image.asset(imagePath, height: 160),
          const SizedBox(height: defaultPadding),
          Text(
            title,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.titleSmall,
          ),
          if (message != null) ...[
            const SizedBox(height: defaultPadding / 2),
            Text(message!, textAlign: TextAlign.center),
          ],
          if (actionLabel != null && onAction != null) ...[
            const SizedBox(height: defaultPadding),
            ElevatedButton(
              onPressed: onAction,
              child: Text(actionLabel!),
            ),
          ],
        ],
      ),
    );
  }
}
