import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

/**
 * eslint-config-next ships flat configs directly, so they are spread in as-is.
 * FlatCompat is for legacy `.eslintrc` shareable configs and crashes on these.
 */
const config = [
  { ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'] },

  ...nextCoreWebVitals,
  ...nextTypescript,

  {
    rules: {
      /**
       * The rule this whole setup is here for.
       *
       * A `useMemo` that read `prefs` while listing only `quiz` as a dependency
       * shipped a blank Explore screen: submitting the gender gate updated the
       * state the memo depended on, the memo did not recompute, and the guard
       * below it bounced the user back to the gate. Nothing threw, the build
       * passed, and none of the four verification suites cover React. This rule
       * catches that class outright, so it is an error rather than a warning.
       */
      'react-hooks/exhaustive-deps': 'error',
    },
  },
];

export default config;
