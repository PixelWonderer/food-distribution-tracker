import { describe, it, expect } from 'vitest';
import { GoogleSheetsSync } from '@/services/googleSheetsSync';

describe('GoogleSheetsSync.parseSheetData', () => {
  it('maps the Partner Group 6 column into partner_6 allocations', () => {
    const sync = new GoogleSheetsSync();

    const rawData = {
      rawData: [
        [], // first header row (unused)
        [
          'Item',
          'UOM',
          'Total Qty Limit',
          'Total Qty Requested',
          'Sun. Dinner',
          'Partner Group 2',
          'Partner Group 4',
          'Partner Group 6',
          'Max out?',
          'Surplus',
          'Ran out?',
          'Storage Type',
        ],
        [
          'Canned Corn, 24/15oz',
          'Case',
          8,
          5,
          1,
          0.5,
          1,
          2,
          '',
          3,
          false,
          'Pantry',
        ],
      ],
    };

    const parsed = sync.parseSheetData(rawData);

    expect(parsed).toHaveLength(1);
    expect(parsed[0].allocations).toMatchObject({
      partner_7: 1,
      partner_2: 0.5,
      partner_4: 1,
      partner_6: 2, // previously dropped because "Partner Group 6" header was unmapped
    });
  });
});
