import { describe, expect, it } from 'vitest';
import { cleanChat, cleanName, isRoomCode, MAX_CHAT_LENGTH, MAX_NAME_LENGTH, parseClientMessage, parseServerMessage, readPeerState } from '../src';

const state = { x: 1, y: -2, z: 1500.5, heading: 3.1, bank: 0.2, pitch: -0.1, brakeL: 0, brakeR: 0.4, collapse: 0, airspeed: 10.5, vz: -1.1, lon0: 6.1, lat0: 45.2 };

describe('names and chat lines', () => {
  it('strips control, invisible and bidi characters and collapses spaces', () => {
    expect(cleanName('  Jean\u0007\n  Dupont‮​ ')).toBe('Jean Dupont');
    expect(cleanName('a\ud800b')).toBe('ab');
    expect(cleanName(42)).toBeNull();
  });

  it('cuts names on whole characters', () => {
    const long = '🪂'.repeat(40);
    expect(Array.from(cleanName(long)!)).toHaveLength(MAX_NAME_LENGTH);
  });

  it('keeps the joiners emoji need in chat but not in names', () => {
    const family = '👨‍👩‍👧';
    expect(cleanChat(family)).toBe(family);
    expect(cleanName(family)).toBe('👨👩👧');
    expect(cleanChat('ligne 1\nligne 2\t!')).toBe('ligne 1 ligne 2 !');
    expect(cleanChat('‮evil')).toBe('evil');
  });
});

describe('room codes', () => {
  it('accepts 4 to 12 upper-case letters and digits only', () => {
    expect(['ABCD', 'AB12CD34EF56', 'Z9Z9Z9'].every(isRoomCode)).toBe(true);
    expect(['ABC', 'ABCDEFGHIJKLM', 'abcd', 'AB CD', 'AB-CD', '', 12345].some(isRoomCode)).toBe(false);
  });
});

describe('peer state', () => {
  it('copies exactly the 13 fields', () => {
    const s = readPeerState({ ...state, wing: { huge: 'object' }, extra: 1 });
    expect(s).toEqual(state);
    expect(Object.keys(s!)).toHaveLength(13);
  });

  it('refuses a missing, non-numeric, infinite or absurd field', () => {
    const missing: Record<string, number> = { ...state };
    delete missing.vz;
    expect(readPeerState(missing)).toBeNull();
    expect(readPeerState({ ...state, x: '1' })).toBeNull();
    expect(readPeerState({ ...state, z: Infinity })).toBeNull();
    expect(readPeerState({ ...state, z: NaN })).toBeNull();
    expect(readPeerState({ ...state, x: 1e9 })).toBeNull();
    expect(readPeerState({ ...state, lat0: 91 })).toBeNull();
    expect(readPeerState({ ...state, lon0: -181 })).toBeNull();
    expect(readPeerState(null)).toBeNull();
    expect(readPeerState([1, 2])).toBeNull();
  });
});

describe('client messages', () => {
  const parse = (o: unknown) => parseClientMessage(typeof o === 'string' ? o : JSON.stringify(o));

  it('parses and cleans the four message types', () => {
    expect(parse({ t: 'join', room: 'ABCD', name: ' Léa\u0000 ' })).toEqual({ t: 'join', room: 'ABCD', name: 'Léa' });
    expect(parse({ t: 'state', s: state })).toEqual({ t: 'state', s: state });
    expect(parse({ t: 'chat', text: ' salut\n' })).toEqual({ t: 'chat', text: 'salut' });
    expect(parse({ t: 'ping', c: 12.5 })).toEqual({ t: 'ping', c: 12.5 });
  });

  it('reports what is wrong without throwing', () => {
    expect(parse('{nope')).toEqual({ t: 'invalid', code: 'bad-message' });
    expect(parse('[]')).toEqual({ t: 'invalid', code: 'bad-message' });
    expect(parse('"x"')).toEqual({ t: 'invalid', code: 'bad-message' });
    expect(parse({ t: 'fly' })).toEqual({ t: 'invalid', code: 'bad-message' });
    expect(parse({ t: 'join', room: 'abc', name: 'x' })).toEqual({ t: 'invalid', code: 'bad-room' });
    expect(parse({ t: 'join', room: 'ABCD', name: 5 })).toEqual({ t: 'invalid', code: 'bad-message' });
    expect(parse({ t: 'state', s: { ...state, x: 'a' } })).toEqual({ t: 'invalid', code: 'bad-message' });
    expect(parse({ t: 'chat', text: '  \n ' })).toEqual({ t: 'invalid', code: 'bad-message' });
    expect(parse({ t: 'chat', text: 'x'.repeat(MAX_CHAT_LENGTH + 1) })).toEqual({ t: 'invalid', code: 'too-long' });
    expect(parse({ t: 'chat', text: 'x'.repeat(MAX_CHAT_LENGTH) })).toMatchObject({ t: 'chat' });
    expect(parse({ t: 'ping', c: 'now' })).toEqual({ t: 'invalid', code: 'bad-message' });
  });

  it('reads 1e999 as infinity and refuses it', () => {
    const raw = JSON.stringify({ t: 'state', s: state }).replace('"x":1,', '"x":1e999,');
    expect(parse(raw)).toEqual({ t: 'invalid', code: 'bad-message' });
  });
});

describe('server messages', () => {
  const parse = (o: unknown) => parseServerMessage(JSON.stringify(o));

  it('parses what the relay sends', () => {
    expect(parse({ t: 'joined', id: 'a1', room: 'ABCD', peers: [{ id: 'b2', name: 'Bob' }] })).toEqual({ t: 'joined', id: 'a1', room: 'ABCD', peers: [{ id: 'b2', name: 'Bob' }] });
    expect(parse({ t: 'peer-join', id: 'b2', name: 'Bob' })).toEqual({ t: 'peer-join', id: 'b2', name: 'Bob' });
    expect(parse({ t: 'peer-leave', id: 'b2' })).toEqual({ t: 'peer-leave', id: 'b2' });
    expect(parse({ t: 'state', id: 'b2', s: state, at: 1234 })).toEqual({ t: 'state', id: 'b2', s: state, at: 1234 });
    expect(parse({ t: 'chat', id: 'b2', name: 'Bob', text: 'hi' })).toEqual({ t: 'chat', id: 'b2', name: 'Bob', text: 'hi' });
    expect(parse({ t: 'pong', c: 1, at: 2 })).toEqual({ t: 'pong', c: 1, at: 2 });
    expect(parse({ t: 'error', code: 'room-full', message: 'full' })).toEqual({ t: 'error', code: 'room-full', message: 'full' });
  });

  it('ignores anything it does not understand', () => {
    expect(parseServerMessage('nope')).toBeNull();
    expect(parse({ t: 'future-thing' })).toBeNull();
    expect(parse({ t: 'state', id: 'b2', s: { ...state, x: null }, at: 1 })).toBeNull();
    expect(parse({ t: 'joined', id: 'a1', room: 'ABCD', peers: [null] })).toBeNull();
    expect(parse({ t: 'peer-join', id: '', name: 'x' })).toBeNull();
  });
});
