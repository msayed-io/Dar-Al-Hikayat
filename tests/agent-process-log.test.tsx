/** @vitest-environment jsdom */
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { AgentStepsMessageCard, type Message } from '../components/DarAlHikayatAIAssistant';

const dummyTheme = {
  bg: '#000000',
  text: '#F5F5F5',
  secondary: '#8E8E93',
  accent: '#F5F5F5',
  isDark: true,
};

const lightTheme = {
  bg: '#EAE6D2',
  text: '#121A1B',
  secondary: '#4A5556',
  accent: '#A7AA63',
  isDark: false,
};

describe('AgentStepsMessageCard (سجل المعالجة – التصميم المدمج)', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('renders running state with correct attributes, svg structure and live step progression', () => {
    const message: Message = {
      id: 'msg-1',
      role: 'agent_steps',
      content: '',
      timestamp: new Date(),
      steps: [
        { id: 's1', toolName: 'replace_text', blockId: 'b1', stepNote: 'استبدال نص', status: 'completed' },
        { id: 's2', toolName: 'replace_text', blockId: 'b2', stepNote: 'استبدال نص', status: 'active' },
      ],
    };

    act(() => {
      root.render(<AgentStepsMessageCard message={message} theme={dummyTheme} live={true} />);
    });

    const logEl = container.querySelector('.agent-process-log');
    expect(logEl).toBeTruthy();
    expect(logEl?.getAttribute('data-state')).toBe('run');
    expect(logEl?.classList.contains('open')).toBe(true);

    // Verify SVG icon elements from reference
    expect(container.querySelector('.ico')).toBeTruthy();
    expect(container.querySelector('.track')).toBeTruthy();
    expect(container.querySelector('.prog')).toBeTruthy();
    expect(container.querySelector('.bolt')).toBeTruthy();
    expect(container.querySelector('.chk')).toBeTruthy();
    expect(container.querySelector('.crs')).toBeTruthy();

    // Verify header title and meta
    const ht = container.querySelector('.ht');
    const hm = container.querySelector('.hm');
    expect(ht?.textContent).toBe('جارٍ المعالجة');
    expect(hm?.textContent).toBe('الخطوة 2 من 2');

    // Steps list and attributes
    const stepItems = container.querySelectorAll('.step');
    expect(stepItems.length).toBe(2);
    expect(stepItems[0].getAttribute('data-s')).toBe('done');
    expect(stepItems[1].getAttribute('data-s')).toBe('run');
  });

  it('renders completed state with correct Arabic dual/plural mutation count and checkmarks', () => {
    const message: Message = {
      id: 'msg-2',
      role: 'agent_steps',
      content: '',
      timestamp: new Date(),
      steps: [
        { id: 's1', toolName: 'replace_text', blockId: 'b1', stepNote: 'استبدال نص', status: 'completed' },
      ],
      agentResult: {
        totalMutations: 1,
        completed: true,
      },
    };

    act(() => {
      root.render(<AgentStepsMessageCard message={message} theme={dummyTheme} live={false} />);
    });

    const logEl = container.querySelector('.agent-process-log');
    expect(logEl?.getAttribute('data-state')).toBe('done');
    expect(container.querySelector('.ht')?.textContent).toBe('انتهت المعالجة');
    expect(container.querySelector('.hm')?.textContent).toBe('تغيير واحد معتمد');
  });

  it('renders dual and plural Arabic mutation counts correctly', () => {
    const dualMsg: Message = {
      id: 'msg-dual',
      role: 'agent_steps',
      content: '',
      timestamp: new Date(),
      steps: [{ id: 's1', toolName: 'replace_text', blockId: 'b1', stepNote: 'استبدال نص', status: 'completed' }],
      agentResult: { totalMutations: 2, completed: true },
    };
    act(() => {
      root.render(<AgentStepsMessageCard message={dualMsg} theme={dummyTheme} live={false} />);
    });
    expect(container.querySelector('.hm')?.textContent).toBe('تغييران معتمدان');

    const pluralMsg: Message = {
      id: 'msg-pl',
      role: 'agent_steps',
      content: '',
      timestamp: new Date(),
      steps: [{ id: 's1', toolName: 'replace_text', blockId: 'b1', stepNote: 'استبدال نص', status: 'completed' }],
      agentResult: { totalMutations: 5, completed: true },
    };
    act(() => {
      root.render(<AgentStepsMessageCard message={pluralMsg} theme={dummyTheme} live={false} />);
    });
    expect(container.querySelector('.hm')?.textContent).toBe('5 تغييرات معتمدة');
  });

  it('renders failure state, shows retry button, and triggers onRetry callback when clicked', () => {
    const onRetrySpy = vi.fn();
    const message: Message = {
      id: 'msg-3',
      role: 'agent_steps',
      content: '',
      timestamp: new Date(),
      steps: [
        { id: 's1', toolName: 'replace_text', blockId: 'b1', stepNote: 'استبدال نص', status: 'failed', error: 'لم يُعثر على النص المطلوب' },
      ],
      agentResult: {
        totalMutations: 0,
        completed: false,
        failed: true,
      },
    };

    act(() => {
      root.render(
        <AgentStepsMessageCard message={message} theme={dummyTheme} live={false} onRetry={onRetrySpy} />
      );
    });

    const logEl = container.querySelector('.agent-process-log');
    expect(logEl?.getAttribute('data-state')).toBe('fail');
    expect(container.querySelector('.ht')?.textContent).toBe('تعذّرت المعالجة');
    expect(container.querySelector('.hm')?.textContent).toBe('لم يُطبَّق أي تغيير');

    const retryBtn = container.querySelector('.retry') as HTMLButtonElement;
    expect(retryBtn).toBeTruthy();
    expect(retryBtn?.textContent).toBe('أعد المحاولة');

    act(() => {
      retryBtn.click();
    });
    expect(onRetrySpy).toHaveBeenCalledTimes(1);
  });

  it('applies theme variables dynamically for light and dark themes with zero background clipping', () => {
    const message: Message = {
      id: 'msg-4',
      role: 'agent_steps',
      content: '',
      timestamp: new Date(),
      steps: [{ id: 's1', toolName: 'replace_text', blockId: 'b1', stepNote: 'استبدال نص', status: 'completed' }],
      agentResult: { totalMutations: 1, completed: true },
    };

    act(() => {
      root.render(<AgentStepsMessageCard message={message} theme={dummyTheme} live={false} />);
    });

    let logEl = container.querySelector('.agent-process-log') as HTMLElement;
    expect(logEl.style.getPropertyValue('--bg')).toBe('#000000');

    act(() => {
      root.render(<AgentStepsMessageCard message={message} theme={lightTheme} live={false} />);
    });

    logEl = container.querySelector('.agent-process-log') as HTMLElement;
    expect(logEl.style.getPropertyValue('--bg')).toBe('#EAE6D2');
  });

  it('toggles collapse on head button click and retains state without resetting', () => {
    const message: Message = {
      id: 'msg-5',
      role: 'agent_steps',
      content: '',
      timestamp: new Date(),
      steps: [{ id: 's1', toolName: 'replace_text', blockId: 'b1', stepNote: 'استبدال نص', status: 'completed' }],
      agentResult: { totalMutations: 1, completed: true },
    };

    act(() => {
      root.render(<AgentStepsMessageCard message={message} theme={dummyTheme} live={false} />);
    });

    const toggleBtn = container.querySelector('.head') as HTMLButtonElement;
    const logEl = container.querySelector('.agent-process-log') as HTMLElement;

    expect(logEl.classList.contains('open')).toBe(true);
    expect(toggleBtn.getAttribute('aria-expanded')).toBe('true');

    // Click to collapse
    act(() => {
      toggleBtn.click();
    });
    expect(logEl.classList.contains('open')).toBe(false);
    expect(toggleBtn.getAttribute('aria-expanded')).toBe('false');

    // Click to expand
    act(() => {
      toggleBtn.click();
    });
    expect(logEl.classList.contains('open')).toBe(true);
    expect(toggleBtn.getAttribute('aria-expanded')).toBe('true');
  });
});
