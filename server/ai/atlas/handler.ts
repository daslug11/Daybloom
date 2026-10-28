import Anthropic from '@anthropic-ai/sdk';
import { requireUser, type AuthedRequest } from '../../auth.js';
import { loadCtx, overviewText } from '../../data/context.js';
import { handle, HttpError, json, methodNotAllowed, readJson } from '../../http.js';
import { serviceClient } from '../../supabase.js';
import { anthropic } from '../client.js';
import { addUsage, ATLAS_HISTORY_MESSAGES, ATLAS_MAX_TOOL_ROUNDS, EFFORT, MAX_TOKENS, MODEL, ZERO_USAGE, type TokenUsage } from '../config.js';
import { beginAi, finishAi } from '../limits.js';
import { aiErrorToHttp } from '../run.js';
import { ATLAS_PERSONA, atlasContext } from './prompt.js';
import { ATLAS_TOOLS, executePending, runTool, type ToolEvent } from './tools.js';

/**
 * POST /api/atlas
 *   {action: 'chat', message, mode?: 'chat'|'voice'}  → NDJSON stream of events:
 *       {t:'text', v}              streamed reply text
 *       {t:'action', tool, summary, ok}   something Atlas changed
 *       {t:'confirm', id, summary} a change waiting for the user's Confirm
 *       {t:'done', remaining}      reply finished (AI requests left today)
 *       {t:'error', message}
 *   {action: 'confirm', id, approve} → runs/cancels a pending action (no AI)
 */
export const handleAtlasRequest = handle(async (req) => {
  if (req.method !== 'POST') return methodNotAllowed(['POST']);
  const auth = await requireUser(req);
  const body = await readJson<{ action?: string; message?: string; mode?: string; id?: string; approve?: boolean }>(req);
  if (body.action === 'confirm') return confirm(auth, body.id, body.approve === true);
  if (body.action !== 'chat') throw new HttpError(400, 'Unknown Atlas action.');
  const message = (body.message ?? '').trim();
  if (!message) throw new HttpError(400, 'Say something to Atlas first.');
  if (message.length > 2000) throw new HttpError(400, 'That message is too long (2,000 characters max).');
  return chat(auth, message, body.mode === 'voice');
});

async function chat(auth: AuthedRequest, message: string, voice: boolean): Promise<Response> {
  // Limits are checked before any streaming starts, so errors come back as plain JSON.
  const ticket = await beginAi(auth, voice ? 'atlas_voice' : 'atlas');
  let ctx;
  let history: { role: 'user' | 'assistant'; content: string }[] = [];
  let overview = '';
  try {
    ctx = await loadCtx(auth);
    const [hist, ov] = await Promise.all([
      auth.db.from('atlas_messages').select('role, content').order('id', { ascending: false }).limit(ATLAS_HISTORY_MESSAGES),
      overviewText(ctx, { events: false }),
    ]);
    history = ((hist.data ?? []) as typeof history).reverse();
    overview = ov;
    await auth.db.from('atlas_messages').insert({ role: 'user', content: message });
  } catch (err) {
    await finishAi(ticket, ZERO_USAGE, false);
    throw err;
  }
  const c = ctx;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Record<string, unknown>) => controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
      let usage: TokenUsage = ZERO_USAGE;
      let reply = '';
      const actions: NonNullable<ToolEvent['action']>[] = [];
      let succeeded = false;

      // History must start with a user turn and alternate; drop anything malformed.
      const messages: Anthropic.MessageParam[] = [];
      for (const m of history) {
        if (!messages.length && m.role !== 'user') continue;
        if (messages.length && messages[messages.length - 1].role === m.role) continue;
        messages.push({ role: m.role, content: m.content });
      }
      if (messages.length && messages[messages.length - 1].role === 'user') messages.pop();
      messages.push({ role: 'user', content: message });

      const systemBlocks: Anthropic.TextBlockParam[] = [
        { type: 'text', text: ATLAS_PERSONA, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: atlasContext(c, overview, voice) },
      ];

      try {
        let jsonRetries = 0;
        for (let round = 0; round < ATLAS_MAX_TOOL_ROUNDS; round++) {
          const s = anthropic().messages.stream({
            model: MODEL,
            max_tokens: voice ? MAX_TOKENS.atlasVoice : MAX_TOKENS.atlas,
            system: systemBlocks,
            tools: ATLAS_TOOLS,
            messages,
            output_config: { effort: EFFORT },
          });
          s.on('text', (delta) => {
            reply += delta;
            send({ t: 'text', v: delta });
          });
          let msg: Anthropic.Message;
          try {
            msg = await s.finalMessage();
            jsonRetries = 0;
          } catch (err) {
            // With eager input streaming a tool input can arrive as unparseable JSON; retry that turn once.
            if (err instanceof Anthropic.APIError || jsonRetries++ >= 1) throw err;
            continue;
          }
          usage = addUsage(usage, msg.usage);

          if (msg.stop_reason === 'refusal') {
            if (!reply) {
              reply = "I'm afraid I can't help with that one.";
              send({ t: 'text', v: reply });
            }
            break;
          }
          const toolUses = msg.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
          // max_tokens mid tool call, end_turn, etc. all end the reply here.
          if (msg.stop_reason !== 'tool_use' || !toolUses.length) break;

          messages.push({ role: 'assistant', content: msg.content });
          const results: Anthropic.ToolResultBlockParam[] = [];
          for (const tu of toolUses) {
            const out = await runTool(c, tu.name, tu.input);
            for (const ev of out.events) {
              if (ev.action) {
                actions.push(ev.action);
                send({ t: 'action', ...ev.action });
              }
              if (ev.confirm) {
                actions.push({ tool: 'confirm', summary: ev.confirm.summary, ok: true });
                send({ t: 'confirm', ...ev.confirm });
              }
            }
            results.push({ type: 'tool_result', tool_use_id: tu.id, content: out.content, is_error: out.isError });
          }
          messages.push({ role: 'user', content: results });
          if (reply && !reply.endsWith('\n')) {
            reply += '\n';
            send({ t: 'text', v: '\n' });
          }
          if (round === ATLAS_MAX_TOOL_ROUNDS - 1) {
            const note = 'I had to stop there — that took more steps than I allow myself. Shall I carry on?';
            reply += note;
            send({ t: 'text', v: note });
          }
        }
        if (!reply.trim()) {
          reply = actions.length ? 'Done.' : "I'm not sure what to say to that.";
          send({ t: 'text', v: reply });
        }
        succeeded = true;
      } catch (err) {
        const httpErr = aiErrorToHttp(err);
        console.error('[atlas]', err);
        send({ t: 'error', message: httpErr.message });
      } finally {
        // A failed reply that changed nothing is refunded; tokens are always recorded.
        await finishAi(ticket, usage, succeeded || actions.length > 0);
        if (reply.trim()) {
          await auth.db
            .from('atlas_messages')
            .insert({ role: 'assistant', content: reply.trim().slice(0, 8000), actions })
            .then(({ error }) => error && console.error('[atlas save]', error));
        }
        send({ t: 'done', remaining: succeeded || actions.length ? ticket.remaining : ticket.remaining + 1 });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'application/x-ndjson; charset=utf-8',
      'cache-control': 'no-store',
      'x-accel-buffering': 'no',
    },
  });
}

async function confirm(auth: AuthedRequest, id: string | undefined, approve: boolean): Promise<Response> {
  if (!id) throw new HttpError(400, 'Missing action id.');
  const svc = serviceClient();
  const { data: pending } = await svc
    .from('atlas_pending_actions')
    .select('*')
    .eq('id', id)
    .eq('user_id', auth.user.id)
    .maybeSingle();
  if (!pending) throw new HttpError(404, 'That request has expired.');
  if (pending.status !== 'pending') throw new HttpError(409, 'That was already handled.');
  if (Date.now() - new Date(pending.created_at).getTime() > 60 * 60 * 1000) {
    await svc.from('atlas_pending_actions').update({ status: 'cancelled' }).eq('id', id);
    throw new HttpError(410, 'That request expired — ask Atlas again.');
  }
  // Claim it first so a double click can't run it twice.
  const { data: claimed } = await svc
    .from('atlas_pending_actions')
    .update({ status: approve ? 'done' : 'cancelled' })
    .eq('id', id)
    .eq('status', 'pending')
    .select('id');
  if (!claimed?.length) throw new HttpError(409, 'That was already handled.');

  let text: string;
  if (approve) {
    const ctx = await loadCtx(auth);
    const deleted = await executePending(ctx, pending.payload);
    text = deleted ? `Done — ${pending.summary.replace(/^Delete/, 'deleted')}.` : 'It seems that was already gone.';
  } else {
    text = 'Very well, I have left it as it was.';
  }
  await auth.db.from('atlas_messages').insert({
    role: 'assistant',
    content: text,
    actions: approve ? [{ tool: 'delete_item', summary: pending.summary, ok: true }] : [],
  });
  return json({ message: text });
}
