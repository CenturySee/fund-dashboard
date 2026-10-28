const test = require('node:test');
const assert = require('node:assert/strict');
const { collapse, signature } = require('./snapshot-history');

const row = { code: '000001', buy_status: '限大额', daily_limit: '100.00元', buyable: true };
const snapshot = (date, limit) => ({ date, results: [{ ...row, daily_limit: limit }] });

test('连续相同限购只保留最早一天，额度恢复也记录为变更', () => {
  const snapshots = [
    snapshot('2026-10-25', '100元'), snapshot('2026-10-24', '500元'),
    snapshot('2026-10-23', '100元'), snapshot('2026-10-22', '100.00元'),
  ];
  assert.deepEqual(collapse(snapshots).map(s => s.date), ['2026-10-22', '2026-10-24', '2026-10-25']);
});

test('收益、净值日期和排序不触发变化', () => {
  const other = { ...row, code: '000002' };
  assert.equal(signature([row, other]), signature([
    { ...other, r1y: '20%', nav_date: '2026-10-28' }, { ...row, r1y: '30%' },
  ]));
});

test('暂停、恢复、额度和基金新增删除均触发变化', () => {
  for (const changed of [
    { ...row, buy_status: '暂停申购', buyable: false },
    { ...row, daily_limit: '500元' }, { ...row, minsg: '10' },
  ]) assert.notEqual(signature([row]), signature([changed]));
  assert.notEqual(signature([row]), signature([row, { ...row, code: '000002' }]));
});
