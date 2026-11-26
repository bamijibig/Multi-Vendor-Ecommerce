import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../constants.dart';
import 'skleton/skelton.dart';

class NetworkImageWithLoader extends StatelessWidget {
  final BoxFit fit;

  const NetworkImageWithLoader(
    this.src, {
    super.key,
    this.fit = BoxFit.cover,
    this.radius = defaultPadding,
  });

  final String src;
  final double radius;

  Widget _placeholder(BuildContext context) {
    return Container(
      color: Theme.of(context).textTheme.bodyLarge!.color!.withOpacity(0.04),
      alignment: Alignment.center,
      child: SvgPicture.asset(
        "assets/icons/Image.svg",
        height: 24,
        colorFilter: ColorFilter.mode(
          Theme.of(context).iconTheme.color!.withOpacity(0.3),
          BlendMode.srcIn,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final hasImage = src.trim().isNotEmpty;
    return ClipRRect(
      borderRadius: BorderRadius.all(Radius.circular(radius)),
      child: hasImage
          ? CachedNetworkImage(
              fit: fit,
              imageUrl: src,
              imageBuilder: (context, imageProvider) => Container(
                decoration: BoxDecoration(
                  image: DecorationImage(
                    image: imageProvider,
                    fit: fit,
                  ),
                ),
              ),
              placeholder: (context, url) => const Skeleton(),
              errorWidget: (context, url, error) => _placeholder(context),
            )
          : _placeholder(context),
    );
  }
}
