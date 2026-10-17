import { useState } from 'react';
import { Mail, MessageCircle, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

export type PendingOtp = { kind: 'email' | 'whatsapp'; target: string };

export async function chatError(error: unknown): Promise<string | undefined> {
  if (error && typeof error === 'object' && 'context' in error && error.context instanceof Response) {
    try { const body = await error.context.clone().json(); return typeof body.error === 'string' ? body.error : undefined; } catch { return undefined; }
  }
  return undefined;
}

export default function OtpRequest({ lang, onSent }: { lang: string; onSent: (otp: PendingOtp, reply: string) => void }) {
  const [kind, setKind] = useState<PendingOtp['kind']>('email');
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ar = lang === 'ar';
  return <form className="border-b border-border px-3 py-2 space-y-2" onSubmit={async e => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      const { data, error: failure } = await supabase.functions.invoke('azabot-chat', { body: { action: 'send_otp', kind, target } });
      if (failure) { setError(await chatError(failure) ?? (ar ? 'تعذّر إرسال الرمز.' : 'Could not send the code.')); return; }
      if (!data?.otp || typeof data.reply !== 'string') throw new Error('Invalid response');
      onSent(data.otp, data.reply);
    } catch { setError(ar ? 'تعذّر الاتصال. حاول لاحقًا.' : 'Connection failed. Try later.'); }
    finally { setBusy(false); }
  }}>
    <div className="flex gap-1" role="group" aria-label={ar ? 'قناة رمز الدخول' : 'Login code channel'}>
      <Button type="button" size="sm" variant={kind === 'email' ? 'default' : 'ghost'} disabled={busy} onClick={() => { setKind('email'); setTarget(''); setError(''); }} aria-pressed={kind === 'email'}><Mail />{ar ? 'البريد' : 'Email'}</Button>
      <Button type="button" size="sm" variant={kind === 'whatsapp' ? 'default' : 'ghost'} disabled={busy} onClick={() => { setKind('whatsapp'); setTarget(''); setError(''); }} aria-pressed={kind === 'whatsapp'}><MessageCircle />{ar ? 'واتساب' : 'WhatsApp'}</Button>
    </div>
    <div className="flex gap-2">
      <input required type={kind === 'email' ? 'email' : 'tel'} value={target} disabled={busy} maxLength={254} onChange={e => setTarget(e.target.value)} aria-label={kind === 'email' ? 'OTP email' : 'OTP WhatsApp'} placeholder={kind === 'email' ? 'name@example.com' : '+201XXXXXXXXX'} dir="ltr" className="min-w-0 flex-1 border border-input bg-background rounded-md px-2 text-sm h-9 focus:outline-none focus:ring-2 focus:ring-ring" />
      <Button type="submit" size="icon" disabled={busy || !target.trim()} aria-label={ar ? 'إرسال رمز الدخول' : 'Send login code'} title={ar ? 'إرسال رمز الدخول' : 'Send login code'}>{busy ? <Loader2 className="animate-spin" /> : <Send />}</Button>
    </div>
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
  </form>;
}