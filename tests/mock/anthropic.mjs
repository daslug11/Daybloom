// Mock of the Anthropic Messages API for tests (no real key, no spend).
// Point the server at it with ANTHROPIC_BASE_URL=http://127.0.0.1:<port>.
//   - Rejects any model other than claude-haiku-5-5 (proves the model is pinned).
//   - Structured outputs: builds a valid object from output_config.format.schema,
//     using refs (N1, T2, G1…) and the date found in the prompt.
//   - Atlas (tools present, streaming): scripted tool-use conversations.
//   - GET /__stats → { calls, requests }   POST /__reset
import http from 'node:http';

export const EXPECTED_MODEL = 'claude-haiku-5-5';

export function startMockAnthropic(port = 0) {
  const state = { calls: 0, requests: [] };
  const server = http.createServer(async (req, res) => {
    if (req.url === '/__stats') return send(res, 200, { calls: state.calls, requests: state.requests });
    if (req.url === '/__reset') {
      state.calls = 0;
      state.requests = [];
      return send(res, 200, { ok: true });
    }
    if (req.method !== 'POST' || !req.url.startsWith('/v1/messages')) return send(res, 404, { error: 'not found' });
    const body = JSON.parse(await readBody(req));
    state.calls++;
    state.requests.push({ model: body.model, max_tokens: body.max_tokens, stream: !!body.stream, tools: body.tools?.length ?? 0, effort: body.output_config?.effort });
    if (body.model !== EXPECTED_MODEL) {
      return send(res, 400, { type: 'error', error: { type: 'invalid_request_error', message: `mock only serves ${EXPECTED_MODEL}, got ${body.model}` } });
    }
    const text = JSON.stringify(body.messages);
    if (text.includes('[[fail]]')) return send(res, 500, { type: 'error', error: { type: 'api_error', message: 'mock failure' } });

    if (body.output_config?.format) {
      const prompt = [systemText(body), ...body.messages.map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content)))].join('\n');
      ROOT = body.output_config.format.schema;
      const value = generate(ROOT, prompt, '');
      return send(res, 200, message([{ type: 'text', text: JSON.stringify(value) }], 'end_turn', body));
    }
    const plan = atlasStep(body);
    if (body.stream) return streamMessage(res, plan, body);
    return send(res, 200, message(plan.content, plan.stop, body));
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({ server, port: server.address().port, state })));
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => resolve(data));
  });
}

function send(res, status, obj) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(obj));
}

function systemText(body) {
  return typeof body.system === 'string' ? body.system : (body.system ?? []).map((b) => b.text).join('\n');
}

function usageFor(body, content) {
  return { input_tokens: Math.ceil(JSON.stringify(body).length / 4), output_tokens: Math.ceil(JSON.stringify(content).length / 4), cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
}

let msgCounter = 0;
function message(content, stop, body) {
  return { id: `msg_mock_${++msgCounter}`, type: 'message', role: 'assistant', model: body.model, content, stop_reason: stop, stop_sequence: null, usage: usageFor(body, content) };
}

// ---------------------------------------------------------------------------
// Structured outputs: schema-driven generator
// ---------------------------------------------------------------------------
function refsIn(prompt, letter) {
  return [...new Set([...prompt.matchAll(new RegExp(`\\b(${letter}\\d+)\\b`, 'g'))].map((m) => m[1]))];
}

function today(prompt) {
  return prompt.match(/Today is \w+ (\d{4}-\d{2}-\d{2})/)?.[1] ?? '2026-10-28';
}

/** Reads the hints a model would follow from a field's description (the SDK moves enum/min/max there). */
function hints(schema) {
  const d = schema.description ?? '';
  const out = {};
  const en = d.match(/enum:\s*(\[[^\]]*\])/);
  if (en) out.enum = JSON.parse(en[1]);
  else if (/^[a-z]+( \| [a-z]+)+$/.test(d.trim())) out.enum = d.trim().split(' | ');
  const exact = d.match(/exactly (\d+)/);
  const range = d.match(/(\d+) to (\d+)/);
  const most = d.match(/(?:at most|up to) (\d+)/);
  const minI = d.match(/minItems:\s*(\d+)/);
  const maxI = d.match(/maxItems:\s*(\d+)/);
  if (exact) out.min = out.max = Number(exact[1]);
  if (range) [out.min, out.max] = [Number(range[1]), Number(range[2])];
  if (most) out.max = Number(most[1]);
  if (minI) out.min = Number(minI[1]);
  if (maxI) out.max = Number(maxI[1]);
  return out;
}

let ROOT = null;
function generate(schema, prompt, key, index = 0) {
  if (!schema) return null;
  if (schema.$ref) {
    const target = schema.$ref.replace(/^#\//, '').split('/').reduce((o, k) => o?.[k], ROOT);
    return generate({ ...target, description: schema.description ?? target?.description }, prompt, key, index);
  }
  if (schema.anyOf) return generate(schema.anyOf.find((s) => s.type !== 'null') ?? schema.anyOf[0], prompt, key, index);
  const type = Array.isArray(schema.type) ? schema.type.find((t) => t !== 'null') : schema.type;
  const h = hints(schema);
  const enumValues = schema.enum ?? h.enum;
  if (enumValues) return enumValues[index % enumValues.length];
  if (type === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(schema.properties ?? {})) out[k] = generate(v, prompt, k, index);
    return out;
  }
  if (type === 'array') {
    const itemProps = Object.keys(schema.items?.properties ?? {});
    let n = schema.minItems ?? h.min ?? 1;
    if (itemProps.includes('note')) n = Math.max(n, refsIn(prompt, 'N').length);
    if (itemProps.includes('task') && itemProps.includes('start')) n = Math.max(n, Math.min(refsIn(prompt, 'T').length, 3));
    const max = schema.maxItems ?? h.max;
    if (max != null) n = Math.min(n, max);
    if (n === 0 && max !== 0) n = 1;
    return Array.from({ length: n }, (_, i) => generate(schema.items, prompt, key, i));
  }
  if (type === 'integer' || type === 'number') return key.includes('due_in') ? index + 1 : 30;
  if (type === 'boolean') return false;
  // strings
  if (key === 'note') return refsIn(prompt, 'N')[index] ?? 'N1';
  if (key === 'task') return refsIn(prompt, 'T')[index] ?? 'T1';
  if (key === 'goal') return refsIn(prompt, 'G')[0] ?? null;
  if (key === 'date') return prompt.match(/Plan (?:the day|the week) (\d{4}-\d{2}-\d{2})/)?.[1] ?? today(prompt);
  if (key.endsWith('_date')) return today(prompt);
  if (key === 'start') return `${String(14 + index).padStart(2, '0')}:00`;
  if (key.endsWith('time')) return '18:00';
  if (key === 'emoji') return '🌱';
  return `Mock ${key || 'text'} ${index + 1}`;
}

// ---------------------------------------------------------------------------
// Atlas: scripted conversations
// ---------------------------------------------------------------------------
let toolCounter = 0;
const tool = (name, input) => ({ content: [{ type: 'tool_use', id: `toolu_mock_${++toolCounter}`, name, input }], stop: 'tool_use' });
const say = (text) => ({ content: [{ type: 'text', text }], stop: 'end_turn' });

function lastUserText(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === 'user' && typeof m.content === 'string') return m.content;
  }
  return '';
}

function findRef(resultText, letter, needle) {
  const lines = resultText.split('\n');
  const hit = lines.find((l) => l.toLowerCase().includes(needle.toLowerCase())) ?? lines[0];
  return hit?.match(new RegExp(`\\b(${letter}\\d+)\\b`))?.[1];
}

function atlasStep(body) {
  const messages = body.messages;
  const last = messages[messages.length - 1];
  const intent = lastUserText(messages);
  const lower = intent.toLowerCase();
  const name = systemText(body).match(/The user's name is ([^.]+)\./)?.[1] ?? 'there';

  if (typeof last.content === 'string') {
    let m;
    if ((m = intent.match(/^add (?:a )?task:? (.+)$/i))) return tool('add_task', { title: m[1] });
    if ((m = intent.match(/^capture:? (.+)$/i))) return tool('capture_note', { text: m[1] });
    if ((m = intent.match(/^(?:complete|finish)[: ]+(.+)$/i))) return tool('list_tasks', { filter: 'open', search: m[1] });
    if ((m = intent.match(/^delete (?:task )?(.+)$/i))) return tool('list_tasks', { filter: 'open', search: m[1] });
    if ((m = intent.match(/^schedule (.+) at (\d{1,2}:\d{2})$/i))) return tool('list_tasks', { filter: 'open', search: m[1] });
    if (/^log (?:habit )?(.+)$/i.test(intent)) return tool('list_habits', {});
    if (/process (?:my )?inbox/i.test(intent)) return tool('list_notes', { view: 'inbox' });
    if (/what('s| is) (on )?today|my day/i.test(lower)) return tool('get_today', {});
    if (/^bad tool/i.test(intent)) return tool('complete_task', { task: 'T999' });
    return say(`Certainly, ${name}. How may I help?`);
  }

  // Continue after tool results.
  const results = Array.isArray(last.content) ? last.content.filter((b) => b.type === 'tool_result') : [];
  const prev = messages[messages.length - 2];
  const used = (prev?.content ?? []).find?.((b) => b.type === 'tool_use');
  const resultText = results.map((r) => (typeof r.content === 'string' ? r.content : JSON.stringify(r.content))).join('\n');
  if (results.some((r) => r.is_error)) return say(`I'm afraid that didn't work: ${resultText}`);
  let m;
  if (used?.name === 'list_tasks') {
    if ((m = intent.match(/^(?:complete|finish)[: ]+(.+)$/i))) {
      const ref = findRef(resultText, 'T', m[1]);
      return ref ? tool('complete_task', { task: ref }) : say("I couldn't find that task.");
    }
    if ((m = intent.match(/^delete (?:task )?(.+)$/i))) {
      const ref = findRef(resultText, 'T', m[1]);
      return ref ? tool('delete_item', { kind: 'task', item: ref }) : say("I couldn't find that task.");
    }
    if ((m = intent.match(/^schedule (.+) at (\d{1,2}:\d{2})$/i))) {
      const ref = findRef(resultText, 'T', m[1]);
      const date = systemText(body).match(/Now: \w+ (\d{4}-\d{2}-\d{2})/)?.[1];
      return ref ? tool('schedule_task', { task: ref, date, start: m[2], duration_min: 60 }) : say("I couldn't find that task.");
    }
  }
  if (used?.name === 'list_habits' && (m = intent.match(/^log (?:habit )?(.+)$/i))) {
    const ref = findRef(resultText, 'H', m[1]);
    return ref ? tool('log_habit', { habit: ref }) : say("I couldn't find that habit.");
  }
  if (used?.name === 'list_notes') {
    const ref = resultText.match(/\b(N\d+)\b/)?.[1];
    return ref ? tool('process_note', { note: ref, action: 'keep_as_idea' }) : say('Your inbox is already clear.');
  }
  if (used?.name === 'get_today') return say(`Here's your day, ${name}. ${resultText.split('\n')[0]}`);
  if (used?.name === 'delete_item') return say("I've asked you to confirm that deletion.");
  return say(`Done — ${resultText}`);
}

function streamMessage(res, plan, body) {
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
  const ev = (type, data) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`);
  const msg = message([], null, body);
  ev('message_start', { message: { ...msg, usage: { ...msg.usage, output_tokens: 1 } } });
  plan.content.forEach((block, index) => {
    if (block.type === 'text') {
      ev('content_block_start', { index, content_block: { type: 'text', text: '' } });
      for (const piece of block.text.match(/.{1,12}/gs) ?? []) ev('content_block_delta', { index, delta: { type: 'text_delta', text: piece } });
    } else {
      ev('content_block_start', { index, content_block: { type: 'tool_use', id: block.id, name: block.name, input: {} } });
      ev('content_block_delta', { index, delta: { type: 'input_json_delta', partial_json: JSON.stringify(block.input) } });
    }
    ev('content_block_stop', { index });
  });
  ev('message_delta', { delta: { stop_reason: plan.stop, stop_sequence: null }, usage: { output_tokens: usageFor(body, plan.content).output_tokens } });
  ev('message_stop', {});
  res.end();
}

// Allow `node tests/mock/anthropic.mjs 4010` for manual/e2e runs.
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.argv[2] ?? 4010);
  startMockAnthropic(port).then(() => console.log(`[mock-anthropic] http://127.0.0.1:${port}`));
}
