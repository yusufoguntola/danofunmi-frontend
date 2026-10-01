import { describe, expect, test, vi } from 'vitest';
import { onChatPromptRequest, sendChatPrompt } from '../../src/lib/chatBridge';

describe('sendChatPrompt / onChatPromptRequest', () => {
  test('sendChatPrompt triggers a listener registered via onChatPromptRequest with the right text', () => {
    const handler = vi.fn();
    const unsubscribe = onChatPromptRequest(handler);

    sendChatPrompt('I need a bulk order');

    expect(handler).toHaveBeenCalledWith('I need a bulk order');
    expect(handler).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  test('the returned unsubscribe function actually removes the listener', () => {
    const handler = vi.fn();
    const unsubscribe = onChatPromptRequest(handler);

    unsubscribe();
    sendChatPrompt('should not be received');

    expect(handler).not.toHaveBeenCalled();
  });

  test('supports multiple independent listeners, each receiving the same prompt', () => {
    const handlerA = vi.fn();
    const handlerB = vi.fn();
    const unsubscribeA = onChatPromptRequest(handlerA);
    const unsubscribeB = onChatPromptRequest(handlerB);

    sendChatPrompt('ping');

    expect(handlerA).toHaveBeenCalledWith('ping');
    expect(handlerB).toHaveBeenCalledWith('ping');

    unsubscribeA();
    unsubscribeB();
  });
});
