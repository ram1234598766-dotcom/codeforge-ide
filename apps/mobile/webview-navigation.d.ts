export type WebViewNavigationKind = 'codeforge-app' | 'external-https' | 'invalid';

export declare function classifyWebViewNavigation(
  value: string,
  codeForgeOrigin: string,
): WebViewNavigationKind;
