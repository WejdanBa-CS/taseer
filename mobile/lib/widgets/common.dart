import 'package:flutter/material.dart';

import '../theme.dart';

class ShellCard extends StatelessWidget {
  const ShellCard({super.key, required this.child, this.padding});
  final Widget child;
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) {
    return child;
  }
}

class SectionLead extends StatelessWidget {
  const SectionLead(this.text, {super.key});
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Text(
        text,
        style: const TextStyle(color: TaseerColors.muted, height: 1.7, fontSize: 14),
      ),
    );
  }
}

class BrandEyebrow extends StatelessWidget {
  const BrandEyebrow(this.text, {super.key});
  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: const TextStyle(
        color: TaseerColors.brand,
        fontWeight: FontWeight.w700,
        fontSize: 12,
      ),
    );
  }
}

class PageTitle extends StatelessWidget {
  const PageTitle(this.text, {super.key});
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 8, bottom: 8),
      child: Text(
        text,
        style: const TextStyle(
          fontSize: 28,
          fontWeight: FontWeight.w800,
          height: 1.35,
          letterSpacing: -0.3,
        ),
      ),
    );
  }
}

class ChoiceTile extends StatelessWidget {
  const ChoiceTile({
    super.key,
    required this.title,
    this.subtitle,
    this.leading,
    this.selected = false,
    required this.onTap,
  });

  final String title;
  final String? subtitle;
  final Widget? leading;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: selected ? TaseerColors.brandSoft : TaseerColors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(
            color: selected ? TaseerColors.brand : TaseerColors.line,
          ),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            child: Row(
              children: [
                if (leading != null) ...[
                  leading!,
                  const SizedBox(width: 12),
                ],
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        title,
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 15,
                          color: selected ? TaseerColors.brand : TaseerColors.ink,
                        ),
                      ),
                      if (subtitle != null && subtitle!.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(
                          subtitle!,
                          style: const TextStyle(
                            color: TaseerColors.muted,
                            fontWeight: FontWeight.w500,
                            fontSize: 11,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                Container(
                  width: 20,
                  height: 20,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: selected ? TaseerColors.brand : Colors.transparent,
                    border: Border.all(
                      color: selected ? TaseerColors.brand : TaseerColors.line,
                    ),
                  ),
                  child: selected
                      ? const Icon(Icons.check, size: 12, color: Colors.white)
                      : null,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class SoftNote extends StatelessWidget {
  const SoftNote(this.text, {super.key, this.color, this.amber = false});
  final String text;
  final Color? color;
  final bool amber;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: amber ? TaseerColors.accentSoft : TaseerColors.soft,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Text(
        text,
        style: TextStyle(
          color: color ?? (amber ? const Color(0xFF78350F) : TaseerColors.muted),
          height: 1.6,
          fontSize: 12,
        ),
      ),
    );
  }
}

class LockedGate extends StatelessWidget {
  const LockedGate({
    super.key,
    required this.message,
    required this.onLogin,
  });

  final String message;
  final VoidCallback onLogin;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: TaseerColors.brandSoft,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: TaseerColors.line),
      ),
      child: Column(
        children: [
          const Icon(Icons.lock_outline, color: TaseerColors.brand, size: 28),
          const SizedBox(height: 10),
          Text(
            message,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: TaseerColors.brand,
              fontWeight: FontWeight.w700,
              height: 1.5,
              fontSize: 14,
            ),
          ),
          const SizedBox(height: 14),
          ElevatedButton(
            onPressed: onLogin,
            child: const Text('سجّل دخولك'),
          ),
        ],
      ),
    );
  }
}

class StepperBar extends StatelessWidget {
  const StepperBar({super.key, required this.step});
  final int step;

  static const labels = ['المدينة', 'السيارة', 'القطعة', 'السعر'];

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(6),
      decoration: BoxDecoration(
        color: TaseerColors.soft,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: List.generate(labels.length, (index) {
          final on = index == step;
          final done = index < step;
          return Expanded(
            child: Container(
              margin: const EdgeInsets.symmetric(horizontal: 2),
              padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 2),
              decoration: BoxDecoration(
                color: on ? TaseerColors.surface : Colors.transparent,
                borderRadius: BorderRadius.circular(12),
                boxShadow: on
                    ? [
                        BoxShadow(
                          color: TaseerColors.ink.withValues(alpha: 0.04),
                          blurRadius: 6,
                        ),
                      ]
                    : null,
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    width: 18,
                    height: 18,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: on || done ? TaseerColors.brand : TaseerColors.muted,
                      ),
                      color: done && !on ? TaseerColors.brandSoft : Colors.transparent,
                    ),
                    child: done && !on
                        ? const Icon(Icons.check, size: 11, color: TaseerColors.brand)
                        : Text(
                            '${index + 1}',
                            style: TextStyle(
                              fontSize: 9,
                              fontWeight: FontWeight.w700,
                              color: on || done ? TaseerColors.brand : TaseerColors.muted,
                            ),
                          ),
                  ),
                  const SizedBox(width: 4),
                  Flexible(
                    child: Text(
                      labels[index],
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: on || done ? TaseerColors.brand : TaseerColors.muted,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          );
        }),
      ),
    );
  }
}

