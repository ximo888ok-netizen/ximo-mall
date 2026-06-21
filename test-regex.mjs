const re = /^[ \t]*(?:[-*]\s+)?\*{0,2}([A-E])[.)\u3001:\uff1a\-\u2014]\s*\*{0,2}\s+(.+)$/gm;

const tests = [
  { input: 'A. \u6696\u8272\u8c03\uff08\u6a59\u7ea2\u4e3b\u8272\uff0c\u6e29\u6696\u4eb2\u5207\u611f\uff09', expect: true },
  { input: 'B. \u51b7\u8272\u8c03\uff08\u84dd\u767d\u4e3b\u8272\uff0c\u6e05\u723d\u4e13\u4e1a\u611f\uff09', expect: true },
  { input: '**A.** \u6696\u8272\u8c03\uff08\u8bf4\u660e\uff09', expect: true },
  { input: 'A: \u9009\u9879\u5185\u5bb9', expect: true },
  { input: 'B\uff1a\u4e2d\u6587\u5192\u53f7\u9009\u9879', expect: true },
  { input: 'C\u3001\u4e2d\u6587\u987f\u53f7\u9009\u9879', expect: true },
  { input: '- A. \u5e26\u6a2a\u6760\u524d\u7f00', expect: true },
  { input: '  A. \u6709\u7f29\u8fdb\u524d\u7f00', expect: true },
  { input: '\u8fd9\u662f\u4e00\u4e2a\u666e\u901a\u7684\u53e5\u5b50\u3002', expect: false },
  { input: 'A\u548cB\u90fd\u662f\u597d\u7684\u9009\u62e9', expect: false },
];

console.log('=== Match Results ===');
let pass = 0;
tests.forEach(({ input, expect: expected }) => {
  re.lastIndex = 0;
  const m = re.exec(input);
  const matched = !!m;
  const ok = matched === expected;
  if (ok) pass++;
  console.log(ok ? '\u2705' : '\u274c', JSON.stringify(input), matched ? '\u2192 letter=' + m[1] + ' label=' + m[2] : '(no match)');
});
console.log(`\n${pass}/${tests.length} passed`);

// Multi-line test
const multiLine = `\u6211\u5df2\u7ecf\u521b\u5efa\u4e86\u9879\u76ee\u3002\u5728\u5206\u6790\u4e4b\u524d\u60f3\u4e86\u89e3\u4e00\u4e0b\uff1a\n\nA. \u6211\u5148\u63d0\u4f9b\u4ea7\u54c1\u89c4\u683c\u548c\u5356\u70b9\uff08\u7528\u6237\u53ef\u81ea\u7531\u8f93\u5165\uff09\nB. \u76f4\u63a5\u5206\u6790\u56fe\u7247\uff0c\u4ece\u56fe\u7247\u4e2d\u63d0\u53d6\u4fe1\u606f\u5373\u53ef\n\n\u8bf7\u9009\u62e9\u3002`;
const matches = [...multiLine.matchAll(new RegExp(re.source, 'gm'))];
console.log('\n=== Multi-line test ===');
console.log('Found', matches.length, 'options (expect 2)');
matches.forEach(m => console.log(' ', m[1], ':', m[2]));
