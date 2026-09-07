import { CaptionBuffer } from '/captions.js';
const $ = id => document.getElementById(id);
const examples = [
  ['今日は、デザインについて話しましょう。', '今天，我们来聊聊设计。'],
  ['大切なのは、使う人の気持ちを考えることです。', '重要的是，站在使用者的角度思考。'],
  ['小さな工夫が、大きな違いを生みます。', '一个小小的改进，也能带来很大的不同。'],
];
let timer;
let running = false;
let setup;
const buffer = new CaptionBuffer();
function render(index) {
  buffer.reset();
  const [original, translation] = examples[index % examples.length];
  const captions = buffer.push([{ text: original, is_final: true, translation_status: 'original' }, { text: translation, is_final: true, translation_status: 'translation' }]);
  $('original').textContent = captions.original.text;
  $('translation').textContent = captions.translation.text;
}
$('demo').onclick = () => {
  running = !running;
  $('demo').textContent = running ? '暂停字幕演示 Ⅱ' : '播放字幕演示 ▶';
  clearInterval(timer);
  if (running) { let index = 1; render(index++); timer = setInterval(() => render(index++), 3000); }
};
$('showOriginal').onchange = () => { $('original').hidden = !$('showOriginal').checked; };
$('fontSize').oninput = () => { $('translation').style.fontSize = `${$('fontSize').value}px`; $('sizeValue').textContent = `${$('fontSize').value} px`; };
$('copyToken').onclick = async () => {
  try {
    if (!setup) throw new Error('请等待本机服务连接');
    await navigator.clipboard.writeText(setup.token);
    $('copyStatus').textContent = '已复制，请粘贴到插件设置。';
  } catch { $('copyStatus').textContent = '复制失败，请允许此本机页面访问剪贴板后重试。'; }
};
try {
  const response = await fetch('/api/setup');
  if (!response.ok) throw new Error('服务不可用');
  setup = await response.json();
  $('relayUrl').textContent = setup.relayUrl;
  $('serviceStatus').textContent = setup.ready ? '服务已就绪 · Soniox' : '本机服务已启动 · 等待配置语音密钥';
  $('serviceStatus').classList.toggle('ready', setup.ready);
} catch { $('serviceStatus').textContent = '本机服务未连接'; }
