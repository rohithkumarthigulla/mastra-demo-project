import { describe, expect, it } from 'vitest';
import {
  AGENT_LANGUAGES,
  agentLanguageFromSpeechCode,
  resolveReplyLanguage,
  scriptOf,
  sendAgentMessageSchema,
  synthesizeQuerySchema,
} from './supplier-agent.js';

describe('scriptOf', () => {
  it.each([
    ['Is the JCB free next week?', 'Latin'],
    ['अगले हफ्ते जेसीबी खाली है?', 'Devanagari'],
    ['వచ్చే వారం జేసీబీ ఖాళీగా ఉందా?', 'Telugu'],
    ['அடுத்த வாரம் ஜேசிபி காலியா?', 'Tamil'],
    ['ಮುಂದಿನ ವಾರ ಜೆಸಿಬಿ ಖಾಲಿ ಇದೆಯಾ?', 'Kannada'],
    ['അടുത്ത ആഴ്ച ജെസിബി ഒഴിവാണോ?', 'Malayalam'],
    ['পরের সপ্তাহে জেসিবি খালি?', 'Bengali'],
  ])('reads %s as %s', (text, script) => {
    expect(scriptOf(text)).toBe(script);
  });

  it('takes the script with the most letters', () => {
    expect(scriptOf('JCB अगले हफ्ते खाली है?')).toBe('Devanagari');
  });

  it('is null without letters', () => {
    expect(scriptOf('12/05 ?')).toBeNull();
  });
});

describe('resolveReplyLanguage', () => {
  it('uses the spoken language first, over the text and the picker', () => {
    expect(resolveReplyLanguage({ spoken: 'ta', text: 'is it free', selected: 'en' })).toBe('ta');
  });

  it('uses the script of typed text when nothing was spoken', () => {
    expect(resolveReplyLanguage({ text: 'అది ఖాళీగా ఉందా?', selected: 'en' })).toBe('te');
  });

  it('falls back to the picker when the text has no letters', () => {
    expect(resolveReplyLanguage({ text: '12345', selected: 'kn' })).toBe('kn');
  });

  it('uses the picker when the typed script matches it', () => {
    expect(resolveReplyLanguage({ text: 'Is it free?', selected: 'en' })).toBe('en');
  });

  it('keeps Marathi selected for Devanagari text (same script wins)', () => {
    expect(resolveReplyLanguage({ text: 'मशीन मोकळी आहे का?', selected: 'mr' })).toBe('mr');
  });

  it('keeps the Marathi picker when Hindi is detected in speech (same script wins)', () => {
    expect(resolveReplyLanguage({ spoken: 'hi', text: 'मशीन', selected: 'mr' })).toBe('mr');
  });

  it('reads Devanagari text as Hindi when the picker is in another script', () => {
    expect(resolveReplyLanguage({ text: 'मशीन खाली है?', selected: 'en' })).toBe('hi');
  });

  it('lets a different script win over the picker', () => {
    expect(resolveReplyLanguage({ text: 'Is it free?', selected: 'hi' })).toBe('en');
    expect(resolveReplyLanguage({ spoken: 'bn', text: '', selected: 'mr' })).toBe('bn');
  });
});

describe('agentLanguageFromSpeechCode', () => {
  it('maps speech codes and bare codes, ignoring unsupported ones', () => {
    expect(agentLanguageFromSpeechCode('ml-IN')).toBe('ml');
    expect(agentLanguageFromSpeechCode('HI-in')).toBe('hi');
    expect(agentLanguageFromSpeechCode('mr')).toBe('mr');
    expect(agentLanguageFromSpeechCode('gu-IN')).toBeNull();
    expect(agentLanguageFromSpeechCode(null)).toBeNull();
  });

  it('round-trips every language', () => {
    for (const l of AGENT_LANGUAGES) expect(agentLanguageFromSpeechCode(l.speechCode)).toBe(l.code);
  });
});

describe('agent message schemas', () => {
  it('accepts a message with optional languages and rejects unknown ones', () => {
    expect(sendAgentMessageSchema.parse({ content: ' hi ' })).toEqual({ content: 'hi' });
    expect(
      sendAgentMessageSchema.safeParse({ content: 'hi', language: 'mr', spokenLanguage: 'hi' })
        .success,
    ).toBe(true);
    expect(sendAgentMessageSchema.safeParse({ content: 'hi', language: 'fr' }).success).toBe(false);
  });

  it('bounds speech text', () => {
    expect(synthesizeQuerySchema.safeParse({ text: 'x'.repeat(501), language: 'en' }).success).toBe(
      false,
    );
    expect(synthesizeQuerySchema.safeParse({ text: 'Hello', language: 'en' }).success).toBe(true);
  });
});
