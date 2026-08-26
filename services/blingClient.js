const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
require('dotenv').config({ path: path.join(__dirname, '..', '.env.bling'), quiet: true });

const API_BASE = 'https://api.bling.com.br/Api/v3';
const TOKEN_URL = `${API_BASE}/oauth/token`;
const CODEMP = 5;
const STATUS_EMITIDA = 5;
const STATE_DIR = path.join(__dirname, '..', '.secrets');
const STATE_FILE = path.join(STATE_DIR, 'bling-2-token.enc');
const detailCache = new Map();
const REQUEST_TIMEOUT_MS = 8000;

let tokenState;
let refreshPromise;
let nextRequestAt = 0;
let throttleChain = Promise.resolve();

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function waitForRateSlot() {
  const turn = throttleChain.then(async () => {
    const delay = Math.max(0, nextRequestAt - Date.now());
    if (delay) await sleep(delay);
    nextRequestAt = Date.now() + 360;
  });
  throttleChain = turn.catch(() => {});
  await turn;
}

function encryptionKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET não configurado para proteger os tokens do Bling.');
  return crypto.createHash('sha256').update(secret).digest();
}

function encrypt(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
}

function decrypt(value) {
  const input = Buffer.from(value, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), input.subarray(0, 12));
  decipher.setAuthTag(input.subarray(12, 28));
  return JSON.parse(Buffer.concat([decipher.update(input.subarray(28)), decipher.final()]).toString('utf8'));
}

function loadTokenState() {
  if (tokenState) return tokenState;
  try {
    tokenState = decrypt(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    tokenState = {
      accessToken: process.env.BLING_SG_ACCESS_TOKEN || process.env.BLING_5_ACCESS_TOKEN,
      refreshToken: process.env.BLING_SG_REFRESH_TOKEN || process.env.BLING_5_REFRESH_TOKEN,
      expiresAt: Number(process.env.BLING_SG_TOKEN_TIMESTAMP || process.env.BLING_5_TOKEN_TIMESTAMP || Date.now())
        + Number(process.env.BLING_SG_EXPIRES_IN || process.env.BLING_5_EXPIRES_IN || 21600) * 1000
    };
  }
  if (!tokenState.accessToken || !tokenState.refreshToken) throw new Error('Credenciais do Bling da empresa 5 não configuradas.');
  return tokenState;
}

function saveTokenState(state) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  const temporary = `${STATE_FILE}.tmp`;
  fs.writeFileSync(temporary, encrypt(state), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(temporary, STATE_FILE);
}

async function performTokenRefresh() {
  const state = loadTokenState();
  encryptionKey();
  const clientId = process.env.BLING_SG_CLIENT_ID || process.env.BLING_5_CLIENT_ID;
  const clientSecret = process.env.BLING_SG_CLIENT_SECRET || process.env.BLING_5_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Client ID/Secret do Bling não configurados.');
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded', Accept: '1.0', 'enable-jwt': '1'
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: state.refreshToken }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Falha ao renovar token do Bling (HTTP ${response.status}).`);
  tokenState = {
    accessToken: body.access_token,
    refreshToken: body.refresh_token || state.refreshToken,
    expiresAt: Date.now() + Number(body.expires_in || 21600) * 1000
  };
  saveTokenState(tokenState);
  return tokenState.accessToken;
}

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = performTokenRefresh().finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

async function accessToken() {
  const state = loadTokenState();
  return state.accessToken;
}

async function request(endpoint, params, retry = true) {
  const url = new URL(`${API_BASE}${endpoint}`);
  Object.entries(params || {}).forEach(([key, value]) => url.searchParams.set(key, value));
  await waitForRateSlot();
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${await accessToken()}`, Accept: 'application/json', 'enable-jwt': '1' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  if (response.status === 401 && retry) {
    await refreshAccessToken();
    return request(endpoint, params, false);
  }
  if (response.status === 429 && retry) {
    await sleep(1200);
    return request(endpoint, params, false);
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Bling HTTP ${response.status}: ${(body.error && (body.error.description || body.error.message)) || 'erro na API'}`);
  return body.data;
}

async function listHeaders(start, end) {
  const notes = [];
  for (let page = 1; ; page += 1) {
    const rows = await request('/nfe', {
      pagina: page, limite: 100, situacao: STATUS_EMITIDA,
      dataEmissaoInicial: `${start} 00:00:00`, dataEmissaoFinal: `${end} 23:59:59`
    });
    notes.push(...rows);
    if (rows.length < 100) break;
  }
  return notes;
}

async function noteDetail(header) {
  const cached = detailCache.get(header.id);
  if (cached) return cached;
  const detail = await request(`/nfe/${header.id}`);
  detailCache.set(header.id, detail);
  return detail;
}

async function listIssuedNotes(start, end) {
  const headers = await listHeaders(start, end);
  const notes = await Promise.all(headers.map(noteDetail));
  return notes.map(note => ({
    id: note.id, codemp: CODEMP, date: String(note.dataEmissao).slice(0, 10),
    value: Number(note.valorNota) || 0, accessKey: note.chaveAcesso,
    status: Number(note.situacao)
  })).filter(note => note.status === STATUS_EMITIDA && note.date >= start && note.date <= end);
}

module.exports = { listIssuedNotes, CODEMP, STATUS_EMITIDA };
