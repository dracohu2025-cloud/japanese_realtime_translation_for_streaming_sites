import { plans, requirePaymentMode } from './payment-catalog.js';
import { grantOnce } from './payment-store.js';
import { activeGrants, remainingSamples, SAMPLE_RATE } from './quota.js';
import { AppError } from './config.js';

const appName = 'kotoba-billing-v1';
const objectId = object => typeof object === 'string' ? object : object?.id;
const priceId = line => objectId(line.price) || line.pricing?.price_details?.price;

export function createPayments({ stripe, key, webhookSecret, store, prices, baseUrl, now = () => Date.now(), mode = 'test' }) {
  const live = requirePaymentMode(key, mode);
  if (live && new URL(baseUrl).protocol !== 'https:') throw new Error('正式支付需要 HTTPS');
  if (!webhookSecret?.startsWith('whsec_')) throw new Error('缺少支付回调签名密钥');
  const metadata = () => ({ app: appName, instance: store.snapshot().instance });
  const owned = obj => obj.livemode === live && objectId(obj.customer) === store.snapshot().customer;
  const tagged = obj => obj.metadata?.app === appName && obj.metadata?.instance === store.snapshot().instance;
  const assertPrice = async (id, plan) => {
    const price = await stripe.prices.retrieve(id);
    if (price.livemode !== live || !price.active || price.currency !== 'usd' || price.unit_amount !== plan.amount ||
      (plan.mode === 'subscription' ? price.recurring?.interval !== 'month' || price.recurring?.interval_count !== 1 : price.recurring)) {
      throw new Error('Stripe 价格与套餐不一致');
    }
  };
  let lastReconcile = 0;
  // 将回调和主动对账串行化，避免较早的网络响应覆盖较新的退款状态。
  let paymentQueue = Promise.resolve();
  const serialize = task => {
    const result = paymentQueue.then(task);
    paymentQueue = result.catch(() => {});
    return result;
  };
  const chargeAdjustment = async charge => {
    if (!owned(charge) || !charge.paid || charge.currency !== 'usd' || !Number.isSafeInteger(charge.amount) || charge.amount <= 0) throw new Error('支付款项验证失败');
    const disputes = await stripe.disputes.list({ charge: charge.id, limit: 100 });
    if (disputes.has_more) throw new Error('争议记录需要人工核对');
    const suspended = disputes.data.some(d => !['won', 'warning_closed'].includes(d.status));
    if (!Number.isSafeInteger(charge.amount_refunded) || charge.amount_refunded < 0 || charge.amount_refunded > charge.amount) throw new Error('退款金额验证失败');
    return { paymentIntent: objectId(charge.payment_intent), charge: charge.id, paidAmount: charge.amount, refundedAmount: charge.amount_refunded, suspended };
  };
  const paymentDetails = async id => {
    if (!id && !live) return {}; // 兼容旧测试夹具和未关联支付对象的测试余额。
    if (!id) throw new Error('缺少支付款项关联');
    const intent = await stripe.paymentIntents.retrieve(id);
    if (!owned(intent) || intent.status !== 'succeeded') throw new Error('付款尚未确认');
    const charge = await stripe.charges.retrieve(objectId(intent.latest_charge));
    if (objectId(charge.payment_intent) !== id) throw new Error('支付款项关联不匹配');
    return chargeAdjustment(charge);
  };
  const invoicePayment = async id => {
    if (!stripe.invoicePayments && !live) return {};
    const result = await stripe.invoicePayments.list({ invoice: id, status: 'paid', limit: 100 });
    if (result.has_more || result.data.length !== 1 || result.data[0].payment?.type !== 'payment_intent') throw new Error('账单支付方式需要人工核对');
    return paymentDetails(objectId(result.data[0].payment.payment_intent));
  };
  return {
    async status() {
      const state = store.snapshot();
      const grants = activeGrants(state, now()).map(g => ({ ...g, seconds: remainingSamples(g) / SAMPLE_RATE, grantedSeconds: g.seconds }));
      return { testMode: !live, plans, trialClaimed: state.trialClaimed,
        seconds: grants.reduce((total, grant) => total + grant.seconds, 0), grants,
        subscription: state.subscription ? { status: state.subscription.status, cancelAtPeriodEnd: state.subscription.cancelAtPeriodEnd } : null };
    },
    trial: () => store.transact(state => {
      if (state.trialClaimed) return;
      state.trialClaimed = true;
      grantOnce(state, { id: 'trial', kind: 'trial', seconds: plans.trial.seconds, startsAt: now(), expiresAt: null });
    }),
    checkout: planName => store.transact(async state => {
      const plan = plans[planName];
      if (!plan?.mode) throw new Error('不支持的付费套餐');
      await assertPrice(prices[planName], plan);
      if (state.subscription && planName === 'monthly') {
        const subscription = await stripe.subscriptions.retrieve(state.subscription.id);
        if (!['canceled', 'incomplete_expired'].includes(subscription.status)) throw new AppError('SUBSCRIPTION_EXISTS', '已有订阅，请先管理当前订阅', 409);
      }
      if (state.checkout) {
        const previous = await stripe.checkout.sessions.retrieve(state.checkout.id);
        if (previous.status === 'open' && previous.livemode === live) {
          if (state.checkout.plan === planName) return { url: previous.url };
          await stripe.checkout.sessions.expire(previous.id);
        } else if (previous.status === 'complete' && !state.grants.some(g => g.checkout === previous.id)) {
          throw new AppError('PAYMENT_PENDING', '上一笔付款正在归账，请等待额度到账', 409);
        }
      }
      if (!state.customer) {
        const customer = await stripe.customers.create({ name: live ? 'Kotoba Live' : 'Kotoba 支付测试', metadata: metadata() }, { idempotencyKey: `${state.instance}:customer` });
        if (customer.livemode !== live) throw new Error('支付客户环境不匹配');
        state.customer = customer.id;
      }
      state.checkoutSequence = (state.checkoutSequence || 0) + 1;
      const session = await stripe.checkout.sessions.create({
        mode: plan.mode, customer: state.customer, client_reference_id: state.instance,
        adaptive_pricing: { enabled: false },
        payment_method_types: ['card'], line_items: [{ price: prices[planName], quantity: 1 }],
        metadata: { ...metadata(), plan: planName },
        ...(plan.mode === 'subscription' ? { subscription_data: { metadata: metadata() } } : {}),
        success_url: `${baseUrl}/pricing?checkout=returned`, cancel_url: `${baseUrl}/pricing?checkout=canceled`,
      }, { idempotencyKey: `${state.instance}:checkout:${state.checkoutSequence}` });
      if (session.livemode !== live || !session.url?.startsWith('https://checkout.stripe.com/')) throw new Error('收银台验证失败');
      state.checkout = { id: session.id, plan: planName };
      return { url: session.url };
    }),
    cancel: () => store.transact(async state => {
      if (!state.subscription) throw new AppError('NO_SUBSCRIPTION', '尚无订阅', 409);
      const existing = await stripe.subscriptions.retrieve(state.subscription.id);
      if (!owned(existing) || !tagged(existing)) throw new Error('订阅归属不一致');
      const subscription = await stripe.subscriptions.update(existing.id, { cancel_at_period_end: true });
      state.subscription = { id: subscription.id, status: subscription.status, cancelAtPeriodEnd: true };
    }),
    reconcile() {
      return serialize(async () => {
      if (now() - lastReconcile < 60_000) return;
      lastReconcile = now();
      try {
        const state = store.snapshot();
        if (state.checkout) {
          const checkout = await stripe.checkout.sessions.retrieve(state.checkout.id);
          if (owned(checkout) && tagged(checkout) && checkout.status === 'complete') await processEvent({ livemode: live, type: 'checkout.session.completed', created: checkout.created, data: { object: checkout } });
        }
        const currentSubscription = store.snapshot().subscription;
        if (currentSubscription) {
          const subscription = await stripe.subscriptions.retrieve(currentSubscription.id);
          if (owned(subscription) && tagged(subscription)) {
            const invoices = await stripe.invoices.list({ customer: state.customer, subscription: subscription.id, status: 'paid', limit: 100 });
            if (invoices.has_more) throw new Error('账单过多，需要人工对账');
            for (const invoice of invoices.data) await processEvent({ livemode: live, type: 'invoice.paid', data: { object: invoice } });
            await processEvent({ livemode: live, type: 'customer.subscription.updated', data: { object: subscription } });
          }
        }
        const grants = activeGrants(store.snapshot(), now()).filter(g => g.paymentIntent);
        for (const grant of grants) {
          const adjustment = await paymentDetails(grant.paymentIntent);
          await store.transact(draft => { const current = draft.grants.find(g => g.id === grant.id); if (current) Object.assign(current, adjustment); });
        }
      } catch (error) { lastReconcile = 0; throw error; }
      });
    },
    async webhook(body, signature) {
      const event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
      await this.applyEvent(event);
    },
    applyEvent: event => serialize(() => processEvent(event)),
  };
  async function processEvent(event) {
      if (event.livemode !== live) throw new Error('支付事件环境不匹配');
      const object = event.data.object;
      if (event.type === 'charge.refunded' || event.type.startsWith('charge.dispute.') || event.type.startsWith('refund.')) {
        const chargeId = event.type === 'charge.refunded' ? object.id : objectId(object.charge);
        const charge = await stripe.charges.retrieve(chargeId);
        if (!owned(charge)) return;
        const adjustment = await chargeAdjustment(charge);
        await store.transact(state => {
          state.paymentAdjustments ||= {};
          state.paymentAdjustments[adjustment.paymentIntent] = adjustment;
          for (const grant of state.grants) if (grant.paymentIntent === adjustment.paymentIntent) Object.assign(grant, adjustment);
        });
        return;
      }
      if (event.type === 'invoice.paid') {
        const invoice = await stripe.invoices.retrieve(object.id);
        if (!owned(invoice) || invoice.status !== 'paid' || invoice.currency !== 'usd' || invoice.amount_paid !== plans.monthly.amount ||
          !['subscription_create', 'subscription_cycle'].includes(invoice.billing_reason)) return;
        const id = objectId(invoice.parent?.subscription_details?.subscription || invoice.subscription);
        if (!id) return;
        const subscription = await stripe.subscriptions.retrieve(id);
        if (!owned(subscription) || !tagged(subscription)) return;
        const lines = await stripe.invoices.listLineItems(invoice.id, { limit: 100 });
        if (lines.has_more || lines.data.length !== 1) throw new Error('账单明细不符合套餐');
        const line = lines.data[0];
        if (priceId(line) !== prices.monthly || line.quantity !== 1 || !line.period?.start || line.period.end <= line.period.start) return;
        const payment = await invoicePayment(invoice.id);
        await store.transact(state => {
          state.subscription = { id, status: subscription.status, cancelAtPeriodEnd: subscription.cancel_at_period_end };
          grantOnce(state, { id: `period:${id}:${line.period.start}`, invoice: invoice.id, ...payment, kind: 'monthly', seconds: plans.monthly.seconds,
            startsAt: line.period.start * 1000, expiresAt: line.period.end * 1000 });
        });
      } else if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) {
        const session = await stripe.checkout.sessions.retrieve(object.id);
        if (!owned(session) || !tagged(session) || session.payment_status !== 'paid') return;
        if (session.mode === 'subscription') {
          // 月费只由 invoice.paid 发放，避免两个事件重复加额度。
          const subscription = await stripe.subscriptions.retrieve(objectId(session.subscription));
          if (!owned(subscription) || !tagged(subscription)) return;
          await store.transact(state => {
            state.subscription = { id: subscription.id, status: subscription.status, cancelAtPeriodEnd: subscription.cancel_at_period_end };
            if (state.checkout?.id === session.id) state.checkout = null;
          });
          return;
        }
        if (session.mode !== 'payment' || session.metadata.plan !== 'topup' || session.currency !== 'usd' || session.amount_total !== plans.topup.amount) return;
        const lines = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 });
        if (lines.has_more || lines.data.length !== 1 || priceId(lines.data[0]) !== prices.topup || lines.data[0].quantity !== 1) return;
        const payment = await paymentDetails(objectId(session.payment_intent));
        await store.transact(state => {
          grantOnce(state, { id: `checkout:${session.id}`, checkout: session.id, ...payment, kind: 'topup', seconds: plans.topup.seconds,
            startsAt: event.created * 1000, expiresAt: (event.created + plans.topup.days * 86400) * 1000 });
          if (state.checkout?.id === session.id) state.checkout = null;
        });
      } else if (['customer.subscription.updated', 'customer.subscription.deleted'].includes(event.type)) {
        if (!owned(object) || !tagged(object)) return;
        const subscription = await stripe.subscriptions.retrieve(object.id);
        await store.transact(state => {
          if (state.subscription?.id === subscription.id) state.subscription = { id: subscription.id, status: subscription.status, cancelAtPeriodEnd: subscription.cancel_at_period_end };
        });
      }
  }
}
