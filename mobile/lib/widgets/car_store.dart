import 'package:flutter/material.dart';

import '../data/models.dart';
import '../theme.dart';

/// شكل بصري للموديل داخل شبكة المتجر.
enum CarVisualKind { suv, sedan, mpv, hatch, van }

CarVisualKind coverKindForBrand(Brand brand) {
  switch (brand.cover) {
    case 'suv':
      return CarVisualKind.suv;
    case 'mpv':
      return CarVisualKind.mpv;
    case 'hatch':
      return CarVisualKind.hatch;
    case 'van':
      return CarVisualKind.van;
    default:
      return CarVisualKind.sedan;
  }
}

CarVisualKind carVisualKind(String brandId, String modelId) {
  final id = modelId.toLowerCase();
  if (brandId == 'victory' || brandId == 'foton' || brandId == 'maxus' || brandId == 'isuzu') {
    return CarVisualKind.van;
  }
  if (id.contains('carnival') || id.contains('carens')) return CarVisualKind.mpv;
  if (id.contains('picanto') || id.contains('sonet') || id.contains('pegas')) {
    return CarVisualKind.hatch;
  }
  if (id.contains('k4000') || id.contains('tasman')) return CarVisualKind.van;
  if (id.contains('sportage') ||
      id.contains('sorento') ||
      id.contains('seltos') ||
      id.contains('telluride') ||
      id.contains('niro') ||
      id.contains('ev5') ||
      id.contains('ev9')) {
    return CarVisualKind.suv;
  }
  return CarVisualKind.sedan;
}

String carVisualAsset(CarVisualKind kind) {
  switch (kind) {
    case CarVisualKind.suv:
      return 'assets/images/cars/suv.jpg';
    case CarVisualKind.sedan:
      return 'assets/images/cars/sedan.jpg';
    case CarVisualKind.mpv:
      return 'assets/images/cars/mpv.jpg';
    case CarVisualKind.hatch:
      return 'assets/images/cars/hatch.jpg';
    case CarVisualKind.van:
      return 'assets/images/cars/van.jpg';
  }
}

class CarStoreCard extends StatelessWidget {
  const CarStoreCard({
    super.key,
    required this.title,
    required this.subtitle,
    required this.imageAsset,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final String imageAsset;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: TaseerColors.surface,
      borderRadius: BorderRadius.circular(18),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Ink(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: TaseerColors.line),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(
                flex: 5,
                child: ColoredBox(
                  color: TaseerColors.soft,
                  child: Image.asset(
                    imageAsset,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => const Center(
                      child: Icon(
                        Icons.directions_car_filled_outlined,
                        size: 42,
                        color: TaseerColors.brand,
                      ),
                    ),
                  ),
                ),
              ),
              Expanded(
                flex: 3,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(10, 10, 10, 10),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 14,
                          height: 1.2,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        subtitle,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: TaseerColors.muted,
                          fontSize: 11,
                          height: 1.35,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class CarStoreGrid extends StatelessWidget {
  const CarStoreGrid({
    super.key,
    required this.itemCount,
    required this.itemBuilder,
  });

  final int itemCount;
  final IndexedWidgetBuilder itemBuilder;

  @override
  Widget build(BuildContext context) {
    if (itemCount == 0) return const SizedBox.shrink();
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: itemCount,
      gridDelegate: const SpeculativeGridDelegate(),
      itemBuilder: itemBuilder,
    );
  }
}

/// شبكة متجر: بطاقتان بعرض ثابت تقريباً ونسبة صورة مناسبة.
class SpeculativeGridDelegate extends SliverGridDelegateWithFixedCrossAxisCount {
  const SpeculativeGridDelegate()
      : super(
          crossAxisCount: 2,
          mainAxisSpacing: 12,
          crossAxisSpacing: 12,
          childAspectRatio: 0.72,
        );
}

class BrandStoreCard extends StatelessWidget {
  const BrandStoreCard({
    super.key,
    required this.title,
    required this.subtitle,
    required this.imageAsset,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final String imageAsset;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: TaseerColors.surface,
      borderRadius: BorderRadius.circular(20),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Ink(
          height: 148,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: TaseerColors.line),
          ),
          child: Row(
            children: [
              Expanded(
                flex: 5,
                child: ColoredBox(
                  color: TaseerColors.soft,
                  child: Image.asset(
                    imageAsset,
                    fit: BoxFit.cover,
                    height: double.infinity,
                    errorBuilder: (_, __, ___) => const Center(
                      child: Icon(
                        Icons.directions_car_filled_outlined,
                        size: 48,
                        color: TaseerColors.brand,
                      ),
                    ),
                  ),
                ),
              ),
              Expanded(
                flex: 4,
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        title,
                        style: const TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 20,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        subtitle,
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: TaseerColors.muted,
                          fontSize: 12,
                          height: 1.4,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
