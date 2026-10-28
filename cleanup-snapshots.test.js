const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { planCleanup, applyCleanup } = require('./cleanup-snapshots');

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fund-cleanup-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const [date, limit] of [['2026-10-20', '100元'], ['2026-10-21', '100元'],
    ['2026-10-22', '500元'], ['2026-10-23', '100元']]) {
    fs.mkdirSync(path.join(dir, date));
    fs.writeFileSync(path.join(dir, date, 'results.json'), JSON.stringify([
      { code: '000001', buy_status: '限大额', daily_limit: limit },
    ]));
    fs.writeFileSync(path.join(dir, date, 'rank.json'), '[]');
  }
  return dir;
}

test('预览不删除；实际清理只删除连续重复；重复执行无副作用', t => {
  const dir = fixture(t);
  const plan = planCleanup(dir);
  assert.deepEqual(plan.remove, ['2026-10-21']);
  assert.equal(fs.readdirSync(dir).length, 4);
  applyCleanup(plan);
  assert.deepEqual(fs.readdirSync(dir).sort(), plan.keep);
  assert.deepEqual(planCleanup(dir).remove, []);
});

test('快照不完整时停止，保留所有目录', t => {
  const dir = fixture(t);
  fs.unlinkSync(path.join(dir, '2026-10-22', 'rank.json'));
  assert.throws(() => planCleanup(dir));
  assert.equal(fs.readdirSync(dir).length, 4);
});

test('拒绝伪造的越界删除计划', t => {
  const dir = fixture(t);
  const plan = planCleanup(dir);
  plan.remove.push('../outside');
  assert.throws(() => applyCleanup(plan));
  assert.equal(fs.readdirSync(dir).length, 4);
});
