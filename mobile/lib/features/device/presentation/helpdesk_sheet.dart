import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';








Future<void> showHelpdeskSheet(BuildContext context) {
  return showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    builder: (BuildContext sheetContext) => Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          const Row(
            children: <Widget>[
              Icon(Icons.support_agent, color: AppColors.primary),
              SizedBox(width: 10),
              Text(
                'Bantuan IT SIMRS',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
              ),
            ],
          ),
          const SizedBox(height: 12),
          const Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Icon(Icons.phone_in_talk, size: 18, color: AppColors.inkSecondary),
              SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Helpdesk SIMRS & SDM Kepegawaian — Ext. 104',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          const Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Icon(Icons.meeting_room, size: 18, color: AppColors.inkSecondary),
              SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Ruang Server Lt. 2 — bawa perangkat + ID karyawan untuk verifikasi langsung.',
                  style: TextStyle(fontSize: 13, color: AppColors.inkSecondary),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton(
              onPressed: () => Navigator.of(sheetContext).pop(),
              child: const Text('Tutup'),
            ),
          ),
        ],
      ),
    ),
  );
}
