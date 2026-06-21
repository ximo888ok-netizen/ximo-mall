// Test the EXACT regex from the source file
const re = /^[ \t]*(?:[-*]\s+)?\*{0,2}([A-E])[.)\u3001:\uff1a\-\u2014]\s*\*{0,2}\s+(.+)$/gm;

// Verify character codes
const chars = ['\u3001', '\uff1a', '\u2014'];
console.log('Unicode chars:', chars.map(c => `${c} (U+${c.charCodeAt(0).toString(16).toUpperCase()})`));

const tests = [
  'B\uff1a\u4e2d\u6587\u5192\u53f7\u9009\u9879',  // B：中文冒号选项
  'C\u3001\u4e2d\u6587\u987f\u53f7\u9009\u9879',  // C、中文顿号选项
];

tests.forEach(t => {
  re.lastIndex = 0;
  const m = re.exec(t);
  console.log(m ? '\u2705' : '\u274c', JSON.stringify(t), m ? '\u2192 ' + m[1] + ': ' + m[2] : '');
});

// Now test with the actual source regex (copy-paste from file)
const sourceRe = /^[ \t]*(?:[-*]\s+)?\*{0,2}([A-E])[.)、:：\-\u2014]\s*\*{0,2}\s+(.+)$/gm;
console.log('\n=== Source regex test ===');
tests.forEach(t => {
  sourceRe.lastIndex = 0;
  const m = sourceRe.exec(t);
  console.log(m ? '\u2705' : '\u274c', JSON.stringify(t), m ? '\u2192 ' + m[1] + ': ' + m[2] : '');
});

// Verify that the character classes match
console.log('\n=== Character class test ===');
const charClass = /[.)、:：\-\u2014]/;
['.', ')', '、', ':', '：', '-', '—'].forEach(c => {
  console.log(charClass.test(c) ? '\u2705' : '\u274c', `${c} (U+${c.charCodeAt(0).toString(16).toUpperCase()})`);
});
