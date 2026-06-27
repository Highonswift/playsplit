import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * Razorpay webhook (PRD §15). Verifies the HMAC signature, then records the
 * payment via record_payment — which is idempotent by razorpay_payment_id, so
 * duplicate webhook deliveries credit the wallet exactly once.
 */
export async function POST(request: Request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || secret.includes('placeholder')) {
    return NextResponse.json({ error: 'webhook not configured' }, { status: 503 });
  }

  const body = await request.text();
  const signature = request.headers.get('x-razorpay-signature') ?? '';
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');

  // Constant-time comparison.
  const valid =
    signature.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!valid) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 });
  }

  const event = JSON.parse(body) as {
    event: string;
    payload?: { payment?: { entity?: Record<string, unknown> } };
  };

  if (event.event === 'payment.captured') {
    const payment = event.payload?.payment?.entity ?? {};
    const notes = (payment.notes ?? {}) as Record<string, string>;
    const groupId = notes.group_id;
    const userId = notes.user_id;
    const amount = Number(payment.amount ?? 0);
    const paymentId = String(payment.id ?? '');
    const orderId = String(payment.order_id ?? '');

    if (groupId && userId && amount > 0 && paymentId) {
      const supabase = createServiceClient();
      const { error } = await supabase.rpc('record_payment', {
        p_group: groupId,
        p_user: userId,
        p_amount: amount,
        p_method: 'razorpay',
        p_razorpay_payment_id: paymentId,
        p_razorpay_order_id: orderId,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
