import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { CaptionBuffer } from '../extension/shared/captions.js';
const token = (text, final = false, lane = 'original') => ({ text, is_final: final, translation_status: lane });

test('临时字幕被修正时不会叠加重复字', () => {
  const b = new CaptionBuffer();
  b.push([token('今日は'), token('今天', false, 'translation')]);
  b.push([token('今日も'), token('今天也', false, 'translation')]);
  assert.equal(b.snapshot().original.text, '今日も');
  assert.equal(b.snapshot().translation.text, '今天也');
  b.push([token('今日も', true), token('、'), token('今天也', true, 'translation')]);
  b.push([token('、', true), token('話します。', true)]);
  assert.equal(b.snapshot().original.text, '今日も、話します。');
});
test('原文结束标记不会提前清除延迟到达的译文', () => {
  const b = new CaptionBuffer();
  b.push([token('こんにちは', true), token('你好', true, 'translation')]);
  b.push([token('<end>', true)]);
  assert.equal(b.snapshot().translation.text, '你好');
  b.push([token('次の話', true)]);
  assert.equal(b.snapshot().original.text, '次の話');
  assert.equal(b.snapshot().translation.text, '你好');
});
test('跳转重置后旧字幕不残留，内存受限', () => {
  const b = new CaptionBuffer(8);
  b.push([token('123456789012345', true)]);
  assert.equal(b.snapshot().original.text, '89012345');
  b.reset();
  assert.equal(b.snapshot().original.text, '');
  b.push([token('<fin>', true), token('<other>', true)]);
  assert.equal(b.snapshot().original.text, '');
});
test('原文切到下一人后，迟到译文仍保留自身说话人；缺失编号不猜测', () => {
  const b = new CaptionBuffer();
  b.push([{ ...token('こんにちは', true), speaker: '1' }]);
  b.push([{ ...token('次の人', true), speaker: '2' }, { ...token('你好', true, 'translation'), speaker: '1' }]);
  assert.deepEqual(b.snapshot().original.runs.map(run => run.speaker), ['1', '2']);
  assert.equal(b.snapshot().translation.runs[0].speaker, '1');
  b.push([token('没有编号的译文', true, 'translation')]);
  assert.equal(b.snapshot().translation.runs.at(-1).speaker, null);
});
test('临时说话人被修正时替换旧标签，最终文字与临时文字按归属合并', () => {
  const b = new CaptionBuffer();
  b.push([{ ...token('临时', false, 'translation'), speaker: '1' }]);
  b.push([{ ...token('修正', false, 'translation'), speaker: '2' }]);
  assert.deepEqual(b.snapshot().translation.runs, [{ speaker: '2', final: '', partial: '修正' }]);
  b.push([{ ...token('修正', true, 'translation'), speaker: '2' }, { ...token('后续', false, 'translation'), speaker: '2' }]);
  assert.deepEqual(b.snapshot().translation.runs, [{ speaker: '2', final: '修正', partial: '后续' }]);
});
test('多说话人缓冲仍有长度上限，重连重置清除标签，非法编号不进入显示', () => {
  const b = new CaptionBuffer(8);
  for (let i = 0; i < 100; i++) b.push([{ ...token(String(i % 10), true), speaker: String(i % 2 + 1) }]);
  assert.equal(b.snapshot().original.text.length, 8);
  assert.equal(b.snapshot().original.runs.length, 8);
  b.reset();
  assert.deepEqual(b.snapshot().original.runs, []);
  b.push([{ ...token('文字', true), speaker: '<script>' }]);
  assert.equal(b.snapshot().original.runs[0].speaker, null);
});
test('扩展历史模式保留多句字幕和说话人，临时修订不重复添加旧句', () => {
  const b = new CaptionBuffer(4000, { retainHistory: true });
  b.push([{ ...token('第一句', true, 'translation'), speaker: '1' }, token('<end>', true, 'translation')]);
  b.push([{ ...token('第二', false, 'translation'), speaker: '2' }]);
  b.push([{ ...token('第二句', true, 'translation'), speaker: '2' }]);
  assert.equal(b.snapshot().translation.text, '第一句\n第二句');
  assert.deepEqual(b.snapshot().translation.runs.map(run => run.speaker), ['1', '2']);
  for (let i = 0; i < 100; i++) b.push([token('<end>', true, 'translation'), token(`第${i}句测试字幕。`, true, 'translation')]);
  assert(b.snapshot().translation.text.length > 160);
  b.push([token('长'.repeat(5000), true, 'translation')]);
  assert.equal(b.snapshot().translation.text.length, 4000);
  b.reset();
  assert.equal(b.snapshot().translation.text, '');
});
test('PCM 音频处理按 100ms 输出、混合双声道并限制幅度', async () => {
  let Processor;
  const packets = [];
  const sandbox = { AudioWorkletProcessor: class { constructor() { this.port = { postMessage: data => packets.push(data) }; } }, registerProcessor: (_, klass) => { Processor = klass; } };
  vm.runInNewContext(await readFile(new URL('../extension/pcm-worklet.js', import.meta.url), 'utf8'), sandbox);
  const processor = new Processor();
  const left = new Float32Array(1600).fill(1);
  const right = new Float32Array(1600).fill(-1);
  processor.process([[left, right]]);
  assert.equal(packets[0].buffer.byteLength, 3200);
  assert(new Int16Array(packets[0].buffer).every(value => value === 0));
  processor.process([[new Float32Array(1600).fill(3)]]);
  assert(new Int16Array(packets[1].buffer).every(value => value === 32767));
});
