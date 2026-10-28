// 只比较申购信息；净值、收益、评分和输入顺序不影响变更判断。
function signature(rows) {
  const fields = ['code', 'buy_status', 'daily_limit', 'buyable', 'minsg', 'maxsg', 'sgzt', 'apply'];
  return JSON.stringify(rows.map(row => fields.map(key => {
    const value = row[key];
    if (value == null) return '';
    const text = String(value).trim();
    if (['daily_limit', 'minsg', 'maxsg'].includes(key)) {
      const number = text.replace(/[,，\s元]/g, '');
      if (number && Number.isFinite(Number(number))) return String(Number(number));
    }
    return text;
  })).sort((a, b) => a[0].localeCompare(b[0])));
}

function collapse(snapshots) {
  const kept = [];
  let previous;
  for (const snapshot of [...snapshots].sort((a, b) => a.date.localeCompare(b.date))) {
    const current = signature(snapshot.results);
    if (current !== previous) kept.push(snapshot);
    previous = current;
  }
  return kept;
}

module.exports = { signature, collapse };
