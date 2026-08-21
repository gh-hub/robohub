# 01 — Fix leftover renderPan reference in renderer.ts comment

**What to build:** A one-line fix to rename the `renderPan` identifier reference in a comment at `app/src/renderer.ts` line 212 to `renderAim`, completing the zero-leftover-references acceptance criterion from the spec.

**Blocked by:** None

**Status:** ready

- [x] Edit `app/src/renderer.ts` line 212: change comment from `// \`onUsbStatus\` last pushed, unlike renderLights/renderPan/etc. which mix in` to `// \`onUsbStatus\` last pushed, unlike renderLights/renderAim/etc. which mix in`
- [x] Run `grep -rniE 'pan' app/src/ app/public/index.html` (excluding matches like "panel"/"spanning"/"expand"/"TcpAndHold"/"probeTcpAndHold") and confirm zero hits
- [x] Run `npm run build` in `app/` and confirm success
- [x] Run `npm run typecheck` in `app/` and confirm no type errors
- [x] Run `npm test` in `app/` and confirm all tests pass
