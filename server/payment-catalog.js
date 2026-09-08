// 内测报价只有这一份配置；价格使用最小货币单位，额度使用秒。
export const plans = Object.freeze({
  trial: { name: '免费试用', amount: 0, seconds: 1200 },
  monthly: { name: 'Kotoba 月度会员', amount: 999, seconds: 36000, mode: 'subscription' },
  topup: { name: 'Kotoba 加时包', amount: 499, seconds: 18000, mode: 'payment', days: 90 },
});

export function requireTestKey(key) {
  if (!/^(sk|rk)_test_\S+$/.test(key || '')) throw new Error('支付内测仅接受 Stripe 测试密钥');
}

// 正式模式必须显式声明，不能由密钥前缀自动开启。
export function requirePaymentMode(key, mode = 'test') {
  if (!['test', 'live'].includes(mode) || !new RegExp('^(sk|rk)_' + mode + '_\\S+$').test(key || '')) throw new Error('支付环境与密钥不匹配');
  return mode === 'live';
}
