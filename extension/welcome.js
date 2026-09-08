import { bindText } from './shared/ui-locale.js';
import { observePinGuide } from './shared/pin-guide.js';
const guide = observePinGuide(chrome, state => {
  document.getElementById('pinSuccess').hidden = state.pinned !== true;
  document.getElementById('skipPin').hidden = state.handled;
  bindText(document.getElementById('pinNote'), () => state.handled && !state.pinned ? '已跳过，我们不会再主动提醒。你仍可随时手动固定。' : '固定是可选的，不影响翻译功能。');
});
document.getElementById('skipPin').onclick = () => guide.dismiss().catch(() => {});
// Chrome 116–129 没有设置变更事件；欢迎页在用户操作菜单时也需更新。
setInterval(() => { if (document.visibilityState !== 'hidden') guide.refresh(); }, 1500);
window.addEventListener('focus', guide.refresh);
