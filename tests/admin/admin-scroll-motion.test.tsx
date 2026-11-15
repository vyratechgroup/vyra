// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { MotionProvider } from '../../src/components/motion/motion-provider';
import { AdminDashboardView } from '../../src/app/admin/admin-dashboard-view';
import { AdminLoginView } from '../../src/app/admin/login/admin-login-view';

const mockUsePathname = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const mockLenisDestroy = vi.fn();
const mockLenisConstructor = vi.fn().mockImplementation(() => ({
  destroy: mockLenisDestroy,
}));

vi.mock('lenis', () => ({
  default: function (...args: unknown[]) {
    return mockLenisConstructor(...args);
  },
}));

vi.mock('lenis/dist/lenis.css', () => ({}));

describe('Admin Mouse Wheel Scrolling & MotionProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('does NOT initialize Lenis smooth scrolling when pathname starts with /admin', () => {
    mockUsePathname.mockReturnValue('/admin');

    render(
      <MotionProvider>
        <div>Admin Content</div>
      </MotionProvider>,
    );

    expect(mockLenisConstructor).not.toHaveBeenCalled();
  });

  it('initializes Lenis smooth scrolling on regular non-admin routes', () => {
    mockUsePathname.mockReturnValue('/');

    render(
      <MotionProvider>
        <div>Landing Page</div>
      </MotionProvider>,
    );

    expect(mockLenisConstructor).toHaveBeenCalledTimes(1);
  });

  it('destroys Lenis when navigating from non-admin route to /admin', () => {
    mockUsePathname.mockReturnValue('/');

    const { rerender } = render(
      <MotionProvider>
        <div>Content</div>
      </MotionProvider>,
    );

    expect(mockLenisConstructor).toHaveBeenCalledTimes(1);

    mockUsePathname.mockReturnValue('/admin');
    rerender(
      <MotionProvider>
        <div>Content</div>
      </MotionProvider>,
    );

    expect(mockLenisDestroy).toHaveBeenCalled();
  });

  it('renders data-lenis-prevent on AdminDashboardView container and canvas', () => {
    const { container } = render(
      <AdminDashboardView
        summary={{
          transactions: { totalCount: 0, paidCount: 0, totalRevenueIdr: 0 },
          tokens: { totalCount: 0, availableCount: 0, reservedCount: 0, consumedCount: 0, expiredCount: 0 },
          jobs: { totalCount: 0, completedCount: 0, failedCount: 0, successRatePercent: 0 },
          costs: { geminiEstimatedIdr: 0, fashnActualIdr: 0, totalCostIdr: 0, events: [] },
          financials: {
            grossRevenueIdr: 0,
            midtransFeeIdr: 0,
            geminiCostIdr: 0,
            fashnCostIdr: 0,
            totalCogsIdr: 0,
            grossProfitIdr: 0,
            grossMarginPercent: 0,
          },
        }}
        transactions={[]}
        tokens={[]}
        jobs={[]}
        products={[]}
      />,
    );

    const adminShell = container.querySelector('[class*="adminShell"]');
    expect(adminShell).not.toBeNull();
    expect(adminShell?.hasAttribute('data-lenis-prevent')).toBe(true);

    const mainCanvas = container.querySelector('main');
    expect(mainCanvas).not.toBeNull();
    expect(mainCanvas?.hasAttribute('data-lenis-prevent')).toBe(true);
  });

  it('renders data-lenis-prevent on AdminLoginView container', () => {
    const { container } = render(
      <AdminLoginView
        allowLocalDevFallback={true}
        onSubmitCredentials={vi.fn()}
        onLocalDevLogin={vi.fn()}
      />,
    );

    const loginShell = container.querySelector('[class*="loginShell"]');
    expect(loginShell).not.toBeNull();
    expect(loginShell?.hasAttribute('data-lenis-prevent')).toBe(true);
  });
});
