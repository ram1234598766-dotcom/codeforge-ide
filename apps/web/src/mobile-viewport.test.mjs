import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');

describe('mobile viewport and safe-area layout', () => {
  it('uses dynamic viewport units with legacy fallbacks for the main surfaces', () => {
    expect(css).toContain('height:100vh;height:100dvh');
    expect(css).toContain('min-height:100vh;min-height:100dvh');
    expect(css).toContain('height:calc(100% - 58px)');
    expect(css).toContain('height:min(760px,90dvh)');
  });

  it('keeps app, authentication, and landing content inside safe areas', () => {
    expect(css).toContain('.shell{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}');
    expect(css).toContain('.layout{padding-left:env(safe-area-inset-left,0px);padding-right:env(safe-area-inset-right,0px)}');
    expect(css).toContain('padding:max(24px,env(safe-area-inset-top,0px))');
    expect(css).toContain('.home-shell{padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)}');
    expect(css).toContain('padding:max(16px,env(safe-area-inset-top,0px))');
  });
});
