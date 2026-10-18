import test from 'node:test';
import assert from 'node:assert/strict';
import { weekDates, shiftWeek, localDate } from '../../src/features/plans/dates.js';

test('week crosses a year boundary without changing civil dates', () => {
  assert.deepEqual(weekDates('2027-01-01'), ['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03']);
  assert.equal(shiftWeek('2026-12-28', 1), '2027-01-04');
});
test('date rows remain consecutive through daylight saving and use local day', () => {
  assert.deepEqual(weekDates('2026-03-08'), ['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06', '2026-03-07', '2026-03-08']);
  assert.equal(localDate(new Date(2026, 9, 17, 23, 59)), '2026-10-17');
});
