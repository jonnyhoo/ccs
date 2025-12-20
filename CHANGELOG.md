## [6.8.0-dev.1](https://github.com/kaitranntt/ccs/compare/v6.7.2-dev.1...v6.8.0-dev.1) (2025-12-20)

### Features

* **proxy:** improve remote proxy UX defaults ([116b6a1](https://github.com/kaitranntt/ccs/commit/116b6a15b0bf7db3a11fb428706dde126814004d))

### Bug Fixes

* **cliproxy:** use /v1/models for remote proxy health check ([5e1d290](https://github.com/kaitranntt/ccs/commit/5e1d290865876a7e002b1e6c3c2911e1ac7e49b2)), closes [#142](https://github.com/kaitranntt/ccs/issues/142)

## [6.7.2-dev.1](https://github.com/kaitranntt/ccs/compare/v6.7.1...v6.7.2-dev.1) (2025-12-20)

### Code Refactoring

* **ui:** rename /api route to /providers ([9382278](https://github.com/kaitranntt/ccs/commit/93822787045188e3e006b8671ea5ae24f94459ce))

## [6.7.1](https://github.com/kaitranntt/ccs/compare/v6.7.0...v6.7.1) (2025-12-20)

### Documentation

* add comprehensive documentation suite for modular architecture ([1ffd169](https://github.com/kaitranntt/ccs/commit/1ffd169b98560bf59b03653937ff479e96b47800))
* **readme:** update providers, websearch, and add star history ([0dc2da6](https://github.com/kaitranntt/ccs/commit/0dc2da6e5ae55c2c99de92037bdc9f1f43a3eeec))

### Code Refactoring

* add barrel exports for commands and utils directories ([50c427d](https://github.com/kaitranntt/ccs/commit/50c427d339f008e628c05b3f150843425174b425))
* add barrel exports to api/, glmt/, management/ ([6372b3d](https://github.com/kaitranntt/ccs/commit/6372b3d303fbd1eced272526b882984c784f0358))
* **api:** extract service layer from api-command ([ecb6bb4](https://github.com/kaitranntt/ccs/commit/ecb6bb448a74c1f9bc4220c3674e9b4669093a3e))
* **auth:** modularize auth-commands into commands/ directory ([0341f4f](https://github.com/kaitranntt/ccs/commit/0341f4f86f5598dc3a86c06d2a05e22b2af3342d))
* **cliproxy:** extract service layer from cliproxy-command ([b49b7d1](https://github.com/kaitranntt/ccs/commit/b49b7d17b20e6f470e0315ad777f61e0f266b246))
* **cliproxy:** modularize auth handler and binary ([5c28935](https://github.com/kaitranntt/ccs/commit/5c28935d1e893b643556daf4ff4127d543082fab))
* **cliproxy:** modularize binary-manager into binary/ directory ([d3c94fe](https://github.com/kaitranntt/ccs/commit/d3c94fe6a2344aac6215fb12952e42ac17837daa))
* **delegation:** modularize headless-executor into executor/ directory ([c3baaa8](https://github.com/kaitranntt/ccs/commit/c3baaa8251e2f4f54b10e68a0a5eb886ec271ace))
* **errors:** centralize error handling infrastructure ([22dbfd9](https://github.com/kaitranntt/ccs/commit/22dbfd91c5862c91988cba6cd07eef22e6bf97bf))
* **glmt:** modularize transformer pipeline ([cd107e3](https://github.com/kaitranntt/ccs/commit/cd107e354c0faff7582d55fadccee0135ea685fe))
* **management:** modularize doctor health checks ([0eb2030](https://github.com/kaitranntt/ccs/commit/0eb2030dc2af6e351a88801dc42ce739208bfc2e))
* remove unused deprecated code ([4a5b832](https://github.com/kaitranntt/ccs/commit/4a5b832a6ed5990d4621e79f17f5f81e8a0c87d1))
* **types:** add generic types and consolidate ExecutionResult ([6c78b63](https://github.com/kaitranntt/ccs/commit/6c78b63908dd258770beb74abc25b62b56f6fcd5))
* **ui:** add barrel exports for analytics and components root ([b911db8](https://github.com/kaitranntt/ccs/commit/b911db8b5fd66e4b4a9e1a9261dfcfa4d74bb1ba))
* **ui:** organize health components into health/ directory ([a106aa2](https://github.com/kaitranntt/ccs/commit/a106aa2ee63178e1635df09be5bc2cf2a9da04d7))
* **ui:** organize layout components into layout/ directory ([bef9955](https://github.com/kaitranntt/ccs/commit/bef99551230a04831e9a45c5f765ef341ee48b0d))
* **ui:** organize shared components into shared/ directory ([3c7b0e7](https://github.com/kaitranntt/ccs/commit/3c7b0e7a651cd81fc38a907c9f480f173df5c785))
* **ui:** remove old flat component files after reorganization ([e1fd394](https://github.com/kaitranntt/ccs/commit/e1fd3945fc146997691aea2dcac1b03e3005dd69))
* **ui:** split account-flow-viz into account/flow-viz/ directory ([8fd35c8](https://github.com/kaitranntt/ccs/commit/8fd35c8dd619c56a7562c34172a8de3e736be4c8))
* **ui:** split copilot-config-form into copilot/config-form/ directory ([1b1015c](https://github.com/kaitranntt/ccs/commit/1b1015cf506a55393e6a48c99711c3ffa7dac37c))
* **ui:** split error-logs-monitor into monitoring/error-logs/ directory ([946030c](https://github.com/kaitranntt/ccs/commit/946030c8363ed5e4ac6ebe8b6860d0f8fb006c41))
* **ui:** split profile-editor into profiles/editor/ directory ([6778c4d](https://github.com/kaitranntt/ccs/commit/6778c4d637ca936110107672ff65c02b1366a607))
* **ui:** split provider-editor into cliproxy/provider-editor/ directory ([4bea5a3](https://github.com/kaitranntt/ccs/commit/4bea5a33468813d9382d6e7cc4270ca97fc965f8))
* **ui:** split quick-setup-wizard into setup/wizard/ directory ([81196b0](https://github.com/kaitranntt/ccs/commit/81196b0ff14a2b119cdd55d49f8a7eeb63abc8f6))
* **ui:** update imports to use new domain directories ([c70ba89](https://github.com/kaitranntt/ccs/commit/c70ba89b43a177907592d6dd62ef35cf39e691e0))
* **utils:** extract formatRelativeTime to utils/time.ts ([e1f135a](https://github.com/kaitranntt/ccs/commit/e1f135a93a77f66947ac95b76017e00a5a750c5f))
* **utils:** modularize ui.ts into ui/ directory ([c1e5ec7](https://github.com/kaitranntt/ccs/commit/c1e5ec70b5052f19dc6a2d339cd4317b44e10e34))
* **utils:** modularize websearch-manager into websearch/ directory ([5e4fa20](https://github.com/kaitranntt/ccs/commit/5e4fa200df87861e9b078f1696b95569c570ea84))
* **utils:** remove deprecated color and error functions from helpers.ts ([99afb3e](https://github.com/kaitranntt/ccs/commit/99afb3e011cae46369753e36b2fe1ef231c2f535))
* **utils:** use canonical ValidationResult from types/utils ([18424cb](https://github.com/kaitranntt/ccs/commit/18424cba89120c61348d03195d00c00aa8cfcbe4))
* **web-server:** extract usage aggregator service ([9346ff2](https://github.com/kaitranntt/ccs/commit/9346ff2be96bc5b8660774a814f1113de6b6ee36))
* **web-server:** extract usage module to usage/ directory ([bae323c](https://github.com/kaitranntt/ccs/commit/bae323c0d35051c75cc0224a3000823c43f5d875))
* **web-server:** modularize health-service into health/ directory ([c1f30ae](https://github.com/kaitranntt/ccs/commit/c1f30ae80076e12d1ed536d992c3dc8fad8248ca))
* **web-server:** modularize routes into dedicated files ([a12c3d8](https://github.com/kaitranntt/ccs/commit/a12c3d800aedbfd232651cd69c9fcad7b702087d))
* **websearch:** unify CLI status types with ComponentStatus ([a8f7dad](https://github.com/kaitranntt/ccs/commit/a8f7dad4e39cadf7453059fb982561170d7efb3b))

### Performance Improvements

* **assets:** convert screenshots to WebP, add new feature images ([a9d21c2](https://github.com/kaitranntt/ccs/commit/a9d21c21f2bb94b83d829286ad0338fc81f27975))

## [6.7.1-dev.1](https://github.com/kaitranntt/ccs/compare/v6.7.0...v6.7.1-dev.1) (2025-12-20)

### Documentation

* add comprehensive documentation suite for modular architecture ([1ffd169](https://github.com/kaitranntt/ccs/commit/1ffd169b98560bf59b03653937ff479e96b47800))
* **readme:** update providers, websearch, and add star history ([0dc2da6](https://github.com/kaitranntt/ccs/commit/0dc2da6e5ae55c2c99de92037bdc9f1f43a3eeec))

### Code Refactoring

* add barrel exports for commands and utils directories ([50c427d](https://github.com/kaitranntt/ccs/commit/50c427d339f008e628c05b3f150843425174b425))
* add barrel exports to api/, glmt/, management/ ([6372b3d](https://github.com/kaitranntt/ccs/commit/6372b3d303fbd1eced272526b882984c784f0358))
* **api:** extract service layer from api-command ([ecb6bb4](https://github.com/kaitranntt/ccs/commit/ecb6bb448a74c1f9bc4220c3674e9b4669093a3e))
* **auth:** modularize auth-commands into commands/ directory ([0341f4f](https://github.com/kaitranntt/ccs/commit/0341f4f86f5598dc3a86c06d2a05e22b2af3342d))
* **cliproxy:** extract service layer from cliproxy-command ([b49b7d1](https://github.com/kaitranntt/ccs/commit/b49b7d17b20e6f470e0315ad777f61e0f266b246))
* **cliproxy:** modularize auth handler and binary ([5c28935](https://github.com/kaitranntt/ccs/commit/5c28935d1e893b643556daf4ff4127d543082fab))
* **cliproxy:** modularize binary-manager into binary/ directory ([d3c94fe](https://github.com/kaitranntt/ccs/commit/d3c94fe6a2344aac6215fb12952e42ac17837daa))
* **delegation:** modularize headless-executor into executor/ directory ([c3baaa8](https://github.com/kaitranntt/ccs/commit/c3baaa8251e2f4f54b10e68a0a5eb886ec271ace))
* **errors:** centralize error handling infrastructure ([22dbfd9](https://github.com/kaitranntt/ccs/commit/22dbfd91c5862c91988cba6cd07eef22e6bf97bf))
* **glmt:** modularize transformer pipeline ([cd107e3](https://github.com/kaitranntt/ccs/commit/cd107e354c0faff7582d55fadccee0135ea685fe))
* **management:** modularize doctor health checks ([0eb2030](https://github.com/kaitranntt/ccs/commit/0eb2030dc2af6e351a88801dc42ce739208bfc2e))
* remove unused deprecated code ([4a5b832](https://github.com/kaitranntt/ccs/commit/4a5b832a6ed5990d4621e79f17f5f81e8a0c87d1))
* **types:** add generic types and consolidate ExecutionResult ([6c78b63](https://github.com/kaitranntt/ccs/commit/6c78b63908dd258770beb74abc25b62b56f6fcd5))
* **ui:** add barrel exports for analytics and components root ([b911db8](https://github.com/kaitranntt/ccs/commit/b911db8b5fd66e4b4a9e1a9261dfcfa4d74bb1ba))
* **ui:** organize health components into health/ directory ([a106aa2](https://github.com/kaitranntt/ccs/commit/a106aa2ee63178e1635df09be5bc2cf2a9da04d7))
* **ui:** organize layout components into layout/ directory ([bef9955](https://github.com/kaitranntt/ccs/commit/bef99551230a04831e9a45c5f765ef341ee48b0d))
* **ui:** organize shared components into shared/ directory ([3c7b0e7](https://github.com/kaitranntt/ccs/commit/3c7b0e7a651cd81fc38a907c9f480f173df5c785))
* **ui:** remove old flat component files after reorganization ([e1fd394](https://github.com/kaitranntt/ccs/commit/e1fd3945fc146997691aea2dcac1b03e3005dd69))
* **ui:** split account-flow-viz into account/flow-viz/ directory ([8fd35c8](https://github.com/kaitranntt/ccs/commit/8fd35c8dd619c56a7562c34172a8de3e736be4c8))
* **ui:** split copilot-config-form into copilot/config-form/ directory ([1b1015c](https://github.com/kaitranntt/ccs/commit/1b1015cf506a55393e6a48c99711c3ffa7dac37c))
* **ui:** split error-logs-monitor into monitoring/error-logs/ directory ([946030c](https://github.com/kaitranntt/ccs/commit/946030c8363ed5e4ac6ebe8b6860d0f8fb006c41))
* **ui:** split profile-editor into profiles/editor/ directory ([6778c4d](https://github.com/kaitranntt/ccs/commit/6778c4d637ca936110107672ff65c02b1366a607))
* **ui:** split provider-editor into cliproxy/provider-editor/ directory ([4bea5a3](https://github.com/kaitranntt/ccs/commit/4bea5a33468813d9382d6e7cc4270ca97fc965f8))
* **ui:** split quick-setup-wizard into setup/wizard/ directory ([81196b0](https://github.com/kaitranntt/ccs/commit/81196b0ff14a2b119cdd55d49f8a7eeb63abc8f6))
* **ui:** update imports to use new domain directories ([c70ba89](https://github.com/kaitranntt/ccs/commit/c70ba89b43a177907592d6dd62ef35cf39e691e0))
* **utils:** extract formatRelativeTime to utils/time.ts ([e1f135a](https://github.com/kaitranntt/ccs/commit/e1f135a93a77f66947ac95b76017e00a5a750c5f))
* **utils:** modularize ui.ts into ui/ directory ([c1e5ec7](https://github.com/kaitranntt/ccs/commit/c1e5ec70b5052f19dc6a2d339cd4317b44e10e34))
* **utils:** modularize websearch-manager into websearch/ directory ([5e4fa20](https://github.com/kaitranntt/ccs/commit/5e4fa200df87861e9b078f1696b95569c570ea84))
* **utils:** remove deprecated color and error functions from helpers.ts ([99afb3e](https://github.com/kaitranntt/ccs/commit/99afb3e011cae46369753e36b2fe1ef231c2f535))
* **utils:** use canonical ValidationResult from types/utils ([18424cb](https://github.com/kaitranntt/ccs/commit/18424cba89120c61348d03195d00c00aa8cfcbe4))
* **web-server:** extract usage aggregator service ([9346ff2](https://github.com/kaitranntt/ccs/commit/9346ff2be96bc5b8660774a814f1113de6b6ee36))
* **web-server:** extract usage module to usage/ directory ([bae323c](https://github.com/kaitranntt/ccs/commit/bae323c0d35051c75cc0224a3000823c43f5d875))
* **web-server:** modularize health-service into health/ directory ([c1f30ae](https://github.com/kaitranntt/ccs/commit/c1f30ae80076e12d1ed536d992c3dc8fad8248ca))
* **web-server:** modularize routes into dedicated files ([a12c3d8](https://github.com/kaitranntt/ccs/commit/a12c3d800aedbfd232651cd69c9fcad7b702087d))
* **websearch:** unify CLI status types with ComponentStatus ([a8f7dad](https://github.com/kaitranntt/ccs/commit/a8f7dad4e39cadf7453059fb982561170d7efb3b))

### Performance Improvements

* **assets:** convert screenshots to WebP, add new feature images ([a9d21c2](https://github.com/kaitranntt/ccs/commit/a9d21c21f2bb94b83d829286ad0338fc81f27975))

## [6.7.0](https://github.com/kaitranntt/ccs/compare/v6.6.1...v6.7.0) (2025-12-19)

### Features

* **cliproxy:** auto-apply default preset when adding first account ([4036c42](https://github.com/kaitranntt/ccs/commit/4036c42687c0e5124825998350431f17ce617442))
* **env:** add debug logging for global env injection ([68eab56](https://github.com/kaitranntt/ccs/commit/68eab562ce404ac1933c76520e5597327348bff2))
* **recovery:** add lazy initialization for bun/pnpm users ([2d2cd3e](https://github.com/kaitranntt/ccs/commit/2d2cd3eca21a49af04ca0b1c1d549e62b6ff5cc9))

### Bug Fixes

* **ci:** use built-in GITHUB_TOKEN for release comments ([cff38ac](https://github.com/kaitranntt/ccs/commit/cff38ac53d392317325e2cbf5281956ff59174be))
* **cliproxy:** include BASE_URL and AUTH_TOKEN when applying presets ([598454c](https://github.com/kaitranntt/ccs/commit/598454c931267082ba80c4ef426d0ef2c0370f55))
* **cliproxy:** prevent port race condition with unified detection and startup lock ([96f17e3](https://github.com/kaitranntt/ccs/commit/96f17e3afba93288b041f6c2883753692b4e9ca1))
* **cliproxy:** prevent variant names matching reserved provider names ([7ea64bd](https://github.com/kaitranntt/ccs/commit/7ea64bdb4392d8cd41bc871892466d30c50b58fd))
* **remote-proxy:** fix TypeError and make port optional with protocol defaults ([03aea4e](https://github.com/kaitranntt/ccs/commit/03aea4eac233caf00736ceec80b4cc841bce948a)), closes [#142](https://github.com/kaitranntt/ccs/issues/142)
* **update-checker:** resolve dev channel update and duplicate comments ([b6b1817](https://github.com/kaitranntt/ccs/commit/b6b18173cc41788328ef1c8831de9527898f06a1))
* **web-server:** add comprehensive reserved name validation ([2373100](https://github.com/kaitranntt/ccs/commit/2373100c177654910922c6ef0e5ffc7cfe087b26))

## [6.7.0-dev.5](https://github.com/kaitranntt/ccs/compare/v6.7.0-dev.4...v6.7.0-dev.5) (2025-12-19)

### Features

* **cliproxy:** auto-apply default preset when adding first account ([4036c42](https://github.com/kaitranntt/ccs/commit/4036c42687c0e5124825998350431f17ce617442))

## [6.7.0-dev.4](https://github.com/kaitranntt/ccs/compare/v6.7.0-dev.3...v6.7.0-dev.4) (2025-12-19)

### Bug Fixes

* **cliproxy:** prevent port race condition with unified detection and startup lock ([96f17e3](https://github.com/kaitranntt/ccs/commit/96f17e3afba93288b041f6c2883753692b4e9ca1))

## [6.7.0-dev.3](https://github.com/kaitranntt/ccs/compare/v6.7.0-dev.2...v6.7.0-dev.3) (2025-12-19)

### Features

* **recovery:** add lazy initialization for bun/pnpm users ([2d2cd3e](https://github.com/kaitranntt/ccs/commit/2d2cd3eca21a49af04ca0b1c1d549e62b6ff5cc9))

## [6.7.0-dev.2](https://github.com/kaitranntt/ccs/compare/v6.7.0-dev.1...v6.7.0-dev.2) (2025-12-19)

### Bug Fixes

* **cliproxy:** include BASE_URL and AUTH_TOKEN when applying presets ([598454c](https://github.com/kaitranntt/ccs/commit/598454c931267082ba80c4ef426d0ef2c0370f55))
* **cliproxy:** prevent variant names matching reserved provider names ([7ea64bd](https://github.com/kaitranntt/ccs/commit/7ea64bdb4392d8cd41bc871892466d30c50b58fd))
* **web-server:** add comprehensive reserved name validation ([2373100](https://github.com/kaitranntt/ccs/commit/2373100c177654910922c6ef0e5ffc7cfe087b26))

## [6.7.0-dev.1](https://github.com/kaitranntt/ccs/compare/v6.6.2-dev.3...v6.7.0-dev.1) (2025-12-19)

### Features

* **env:** add debug logging for global env injection ([68eab56](https://github.com/kaitranntt/ccs/commit/68eab562ce404ac1933c76520e5597327348bff2))

## [6.6.2-dev.3](https://github.com/kaitranntt/ccs/compare/v6.6.2-dev.2...v6.6.2-dev.3) (2025-12-19)

### Bug Fixes

* **update-checker:** resolve dev channel update and duplicate comments ([b6b1817](https://github.com/kaitranntt/ccs/commit/b6b18173cc41788328ef1c8831de9527898f06a1))

## [6.6.2-dev.2](https://github.com/kaitranntt/ccs/compare/v6.6.2-dev.1...v6.6.2-dev.2) (2025-12-19)

### Bug Fixes

* **remote-proxy:** fix TypeError and make port optional with protocol defaults ([03aea4e](https://github.com/kaitranntt/ccs/commit/03aea4eac233caf00736ceec80b4cc841bce948a)), closes [#142](https://github.com/kaitranntt/ccs/issues/142)

## [6.6.2-dev.1](https://github.com/kaitranntt/ccs/compare/v6.6.1...v6.6.2-dev.1) (2025-12-19)

### Bug Fixes

* **ci:** use built-in GITHUB_TOKEN for release comments ([cff38ac](https://github.com/kaitranntt/ccs/commit/cff38ac53d392317325e2cbf5281956ff59174be))

## [6.6.1](https://github.com/kaitranntt/ccs/compare/v6.6.0...v6.6.1) (2025-12-19)

### Bug Fixes

* **cliproxy:** register session on dashboard start and add port-based stop fallback ([a3b172c](https://github.com/kaitranntt/ccs/commit/a3b172cc437c4a00612667edf44f8aa3b3ffa1ae))

## [6.6.1-dev.1](https://github.com/kaitranntt/ccs/compare/v6.6.0...v6.6.1-dev.1) (2025-12-19)

### Bug Fixes

* **cliproxy:** register session on dashboard start and add port-based stop fallback ([a3b172c](https://github.com/kaitranntt/ccs/commit/a3b172cc437c4a00612667edf44f8aa3b3ffa1ae))

## [6.6.0](https://github.com/kaitranntt/ccs/compare/v6.5.0...v6.6.0) (2025-12-19)

### ⚠ BREAKING CHANGES

* Native shell installers (curl/irm) no longer work.
Use `npm install -g @kaitranntt/ccs` instead.

### Features

* **ci:** add Discord notifications for releases ([ee76d66](https://github.com/kaitranntt/ccs/commit/ee76d663aec59a86a236156dbc163d0d291c0446))
* **ci:** add semantic-release for dev branch with rich Discord notifications ([0f590c8](https://github.com/kaitranntt/ccs/commit/0f590c80d689c39cea7c94937ed398941dddb533))
* **cleanup:** add age-based error log cleanup ([45207b4](https://github.com/kaitranntt/ccs/commit/45207b4e7f92c09d7464dd5c954718254ddfd43a))
* **cliproxy:** add getRemoteEnvVars for remote proxy mode ([f4a50d0](https://github.com/kaitranntt/ccs/commit/f4a50d006c1f6bd284fe743f9a322540763e1848))
* **cliproxy:** add proxy config resolver with CLI flag support ([68a93f0](https://github.com/kaitranntt/ccs/commit/68a93f0500f396ebcc65cc133c1a444ae5a0f220))
* **cliproxy:** add remote proxy client for health checks ([30d564c](https://github.com/kaitranntt/ccs/commit/30d564cda66a54c2ac12788559624cb0736cdeb3))
* **cliproxy:** integrate remote proxy mode in executor ([bd1ff2f](https://github.com/kaitranntt/ccs/commit/bd1ff2f059d01d4371b2230d4902bc5ab210055e))
* **cliproxy:** set WRITABLE_PATH for log storage in ~/.ccs/cliproxy/ ([6b9396f](https://github.com/kaitranntt/ccs/commit/6b9396fbc6d464bc3e3d6d3bb639e70fe5306074))
* **config:** add proxy configuration types and schema ([eff2e2d](https://github.com/kaitranntt/ccs/commit/eff2e2d29f3f227c05103c252823fb9e040b6e49))
* **config:** add proxy section to unified config loader ([1971744](https://github.com/kaitranntt/ccs/commit/197174441f6eeca5e3c98e88af43d91ee081f734))
* **dashboard:** add error log viewer for CLIProxy diagnostics ([5b3d565](https://github.com/kaitranntt/ccs/commit/5b3d56548a8dfb2e6bb22e14b13f0fb038f2d1fb)), closes [#132](https://github.com/kaitranntt/ccs/issues/132)
* **global-env:** add global environment variables injection for third-party profiles ([5d34326](https://github.com/kaitranntt/ccs/commit/5d343260c7307c2d7ac8da92eb5f94c7f764d08c))
* **ui:** add absolute path copy for error logs ([5d4f49e](https://github.com/kaitranntt/ccs/commit/5d4f49e4bb6f9748efa89e96c342dfae3e35d02b))
* **ui:** add Proxy settings tab to dashboard ([9a9ef98](https://github.com/kaitranntt/ccs/commit/9a9ef98542bb766087b711fc39e928e347ad9b86))
* **ui:** add Stop and Restart buttons to ProxyStatusWidget ([c9ad0b0](https://github.com/kaitranntt/ccs/commit/c9ad0b077934ae8418d4e97b9b02a09044ff898b))
* **ui:** add version sync timestamp to ProxyStatusWidget ([d43079b](https://github.com/kaitranntt/ccs/commit/d43079b72414d7b841a35a934ea39a91527f4172))
* **ui:** redesign error logs monitor with split view layout ([8f47b87](https://github.com/kaitranntt/ccs/commit/8f47b8775f2c2493c05ee2be861ca3f8667cfc0e))
* **ui:** show CLIProxyAPI update availability in dashboard ([96762a9](https://github.com/kaitranntt/ccs/commit/96762a9f6ee096570b2fe6136a4431e6ce1d1a47))
* **web-server:** add proxy configuration API routes ([8decdfb](https://github.com/kaitranntt/ccs/commit/8decdfb515075b772970de7c85b34c31baf93754))

### Bug Fixes

* **ci:** remove deprecated installer references from dev-release workflow ([4b969b6](https://github.com/kaitranntt/ccs/commit/4b969b6870aae6b5859b9a1be0cf98b9d537ce00))
* **ci:** remove sync-version.js that depends on deleted VERSION file ([18729c9](https://github.com/kaitranntt/ccs/commit/18729c9983ecd1f9d857b0de2753e99c675c624a))
* **cliproxy:** prevent misleading update message when proxy is running ([2adc272](https://github.com/kaitranntt/ccs/commit/2adc272f278b1d80d160ad4d6e1f35e3b61cb156)), closes [#143](https://github.com/kaitranntt/ccs/issues/143)
* **error-logs-monitor:** properly handle status loading state ([1ef625e](https://github.com/kaitranntt/ccs/commit/1ef625ee863c517a5fbba21f16cf991bb77be7d7))
* **profiles:** prevent env var inheritance for settings-based profiles ([903bc10](https://github.com/kaitranntt/ccs/commit/903bc10fea11694474f772356f301b8e4b37298e))

### Documentation

* **cliproxy:** add remote proxy documentation ([196422c](https://github.com/kaitranntt/ccs/commit/196422cee1f7410d385581f2a28df3faa87d68e3))

### Styles

* **ui:** use sidebar accent colors for proxy update button ([eeb6913](https://github.com/kaitranntt/ccs/commit/eeb6913d96fe1a9a0d8721627a07c7f772b67b88))
* **ui:** widen cliproxy sidebar from w-64 to w-80 ([248d970](https://github.com/kaitranntt/ccs/commit/248d970cba8671b7c20dc99f8d1a70e4fe113605))

### Code Refactoring

* remove deprecated native shell installers ([126cffc](https://github.com/kaitranntt/ccs/commit/126cffc6dcf434abeee883a4109d3705cdb92a67))
* rename proxy to cliproxy_server and update API routes ([8d8d4c2](https://github.com/kaitranntt/ccs/commit/8d8d4c248ad890413d5c4e7e72f9f2a16305f74f))

## [6.6.0-dev.4](https://github.com/kaitranntt/ccs/compare/v6.6.0-dev.3...v6.6.0-dev.4) (2025-12-19)

### Bug Fixes

* **profiles:** prevent env var inheritance for settings-based profiles ([903bc10](https://github.com/kaitranntt/ccs/commit/903bc10fea11694474f772356f301b8e4b37298e))

## [6.6.0-dev.3](https://github.com/kaitranntt/ccs/compare/v6.6.0-dev.2...v6.6.0-dev.3) (2025-12-19)

### Features

* **cliproxy:** add getRemoteEnvVars for remote proxy mode ([f4a50d0](https://github.com/kaitranntt/ccs/commit/f4a50d006c1f6bd284fe743f9a322540763e1848))
* **cliproxy:** add proxy config resolver with CLI flag support ([68a93f0](https://github.com/kaitranntt/ccs/commit/68a93f0500f396ebcc65cc133c1a444ae5a0f220))
* **cliproxy:** add remote proxy client for health checks ([30d564c](https://github.com/kaitranntt/ccs/commit/30d564cda66a54c2ac12788559624cb0736cdeb3))
* **cliproxy:** integrate remote proxy mode in executor ([bd1ff2f](https://github.com/kaitranntt/ccs/commit/bd1ff2f059d01d4371b2230d4902bc5ab210055e))
* **config:** add proxy configuration types and schema ([eff2e2d](https://github.com/kaitranntt/ccs/commit/eff2e2d29f3f227c05103c252823fb9e040b6e49))
* **config:** add proxy section to unified config loader ([1971744](https://github.com/kaitranntt/ccs/commit/197174441f6eeca5e3c98e88af43d91ee081f734))
* **ui:** add Proxy settings tab to dashboard ([9a9ef98](https://github.com/kaitranntt/ccs/commit/9a9ef98542bb766087b711fc39e928e347ad9b86))
* **web-server:** add proxy configuration API routes ([8decdfb](https://github.com/kaitranntt/ccs/commit/8decdfb515075b772970de7c85b34c31baf93754))

### Documentation

* **cliproxy:** add remote proxy documentation ([196422c](https://github.com/kaitranntt/ccs/commit/196422cee1f7410d385581f2a28df3faa87d68e3))

### Styles

* **ui:** use sidebar accent colors for proxy update button ([eeb6913](https://github.com/kaitranntt/ccs/commit/eeb6913d96fe1a9a0d8721627a07c7f772b67b88))

### Code Refactoring

* rename proxy to cliproxy_server and update API routes ([8d8d4c2](https://github.com/kaitranntt/ccs/commit/8d8d4c248ad890413d5c4e7e72f9f2a16305f74f))

## [6.6.0-dev.2](https://github.com/kaitranntt/ccs/compare/v6.6.0-dev.1...v6.6.0-dev.2) (2025-12-19)

### Bug Fixes

* **ci:** remove sync-version.js that depends on deleted VERSION file ([18729c9](https://github.com/kaitranntt/ccs/commit/18729c9983ecd1f9d857b0de2753e99c675c624a))

## [6.6.0-dev.1](https://github.com/kaitranntt/ccs/compare/v6.5.0...v6.6.0-dev.1) (2025-12-19)

### ⚠ BREAKING CHANGES

* Native shell installers (curl/irm) no longer work.
Use `npm install -g @kaitranntt/ccs` instead.

### Features

* **ci:** add Discord notifications for releases ([ee76d66](https://github.com/kaitranntt/ccs/commit/ee76d663aec59a86a236156dbc163d0d291c0446))
* **ci:** add semantic-release for dev branch with rich Discord notifications ([0f590c8](https://github.com/kaitranntt/ccs/commit/0f590c80d689c39cea7c94937ed398941dddb533))
* **cleanup:** add age-based error log cleanup ([45207b4](https://github.com/kaitranntt/ccs/commit/45207b4e7f92c09d7464dd5c954718254ddfd43a))
* **cliproxy:** set WRITABLE_PATH for log storage in ~/.ccs/cliproxy/ ([6b9396f](https://github.com/kaitranntt/ccs/commit/6b9396fbc6d464bc3e3d6d3bb639e70fe5306074))
* **dashboard:** add error log viewer for CLIProxy diagnostics ([5b3d565](https://github.com/kaitranntt/ccs/commit/5b3d56548a8dfb2e6bb22e14b13f0fb038f2d1fb)), closes [#132](https://github.com/kaitranntt/ccs/issues/132)
* **global-env:** add global environment variables injection for third-party profiles ([5d34326](https://github.com/kaitranntt/ccs/commit/5d343260c7307c2d7ac8da92eb5f94c7f764d08c))
* **ui:** add absolute path copy for error logs ([5d4f49e](https://github.com/kaitranntt/ccs/commit/5d4f49e4bb6f9748efa89e96c342dfae3e35d02b))
* **ui:** add Stop and Restart buttons to ProxyStatusWidget ([c9ad0b0](https://github.com/kaitranntt/ccs/commit/c9ad0b077934ae8418d4e97b9b02a09044ff898b))
* **ui:** add version sync timestamp to ProxyStatusWidget ([d43079b](https://github.com/kaitranntt/ccs/commit/d43079b72414d7b841a35a934ea39a91527f4172))
* **ui:** redesign error logs monitor with split view layout ([8f47b87](https://github.com/kaitranntt/ccs/commit/8f47b8775f2c2493c05ee2be861ca3f8667cfc0e))
* **ui:** show CLIProxyAPI update availability in dashboard ([96762a9](https://github.com/kaitranntt/ccs/commit/96762a9f6ee096570b2fe6136a4431e6ce1d1a47))

### Bug Fixes

* **ci:** remove deprecated installer references from dev-release workflow ([4b969b6](https://github.com/kaitranntt/ccs/commit/4b969b6870aae6b5859b9a1be0cf98b9d537ce00))
* **cliproxy:** prevent misleading update message when proxy is running ([2adc272](https://github.com/kaitranntt/ccs/commit/2adc272f278b1d80d160ad4d6e1f35e3b61cb156)), closes [#143](https://github.com/kaitranntt/ccs/issues/143)
* **error-logs-monitor:** properly handle status loading state ([1ef625e](https://github.com/kaitranntt/ccs/commit/1ef625ee863c517a5fbba21f16cf991bb77be7d7))

### Styles

* **ui:** widen cliproxy sidebar from w-64 to w-80 ([248d970](https://github.com/kaitranntt/ccs/commit/248d970cba8671b7c20dc99f8d1a70e4fe113605))

### Code Refactoring

* remove deprecated native shell installers ([126cffc](https://github.com/kaitranntt/ccs/commit/126cffc6dcf434abeee883a4109d3705cdb92a67))

# [6.5.0](https://github.com/kaitranntt/ccs/compare/v6.4.0...v6.5.0) (2025-12-18)


### Bug Fixes

* **cli:** allow ccs copilot as profile by routing only known subcommands ([2c6dfe7](https://github.com/kaitranntt/ccs/commit/2c6dfe746b19dcbc43492dc8a03870b18a0b03f6))
* **cli:** route 'ccs copilot' without subcommand to help ([671a9e7](https://github.com/kaitranntt/ccs/commit/671a9e76fb1dc4b58099e82d94f63fd346b52146))
* **copilot:** use gpt-4.1 as default model and 127.0.0.1 for local connections ([ec6face](https://github.com/kaitranntt/ccs/commit/ec6face8db78e9c5cad4f91dcfd39e08665e1415))
* **copilot:** use token file check for instant auth status ([4783632](https://github.com/kaitranntt/ccs/commit/47836329580711bc551ebc52e20136a38bf15320))
* **copilot:** widen sidebar and balance split-view layout ([63bdc3a](https://github.com/kaitranntt/ccs/commit/63bdc3ae3990472d91c190bd29ee95c5181e4d12))
* **ui:** add install button to copilot page sidebar ([3865747](https://github.com/kaitranntt/ccs/commit/386574715470b8ff10e8d0ffae9231e001810e99))
* **ui:** constrain copilot config left panel width to 540px ([da5dc31](https://github.com/kaitranntt/ccs/commit/da5dc31ec4e94d98c17aa750f23e079145ac040c))
* **ui:** handle 404 errors in profile settings fetch ([60c01c7](https://github.com/kaitranntt/ccs/commit/60c01c7e60f850a28cb995e92aad21dbb09a1acf))
* **ui:** improve copilot sidebar logical order and remove redundancy ([f9b89de](https://github.com/kaitranntt/ccs/commit/f9b89dee12acdec5bf2b53e04eb60708bfee8340))


### Features

* **api:** add copilot install and info endpoints ([fee241d](https://github.com/kaitranntt/ccs/commit/fee241d00be4a573e04011dd84712f90ed2d4a1f))
* **api:** add copilot REST API endpoints ([c84db38](https://github.com/kaitranntt/ccs/commit/c84db38f6a16598955334fc02e0ccbe50187655f))
* **auth:** add copilot profile detection ([e5a1f60](https://github.com/kaitranntt/ccs/commit/e5a1f60bb6f97dba5ccd021087941ddf733292d5))
* **cli:** add copilot CLI commands ([d25db1f](https://github.com/kaitranntt/ccs/commit/d25db1fce10ea9c37b949a8c3c39115f357812d8))
* **config:** add copilot configuration types and loader ([b87aeae](https://github.com/kaitranntt/ccs/commit/b87aeaeb01800b11640b14fafa36412d82d0f522))
* **copilot:** add complete model catalog with plan tiers ([7653cab](https://github.com/kaitranntt/ccs/commit/7653caba710f847ff4c25fcc5b68f1b0381dd2d2))
* **copilot:** add copilot manager module ([3b8a85c](https://github.com/kaitranntt/ccs/commit/3b8a85c9ef1d4a227b8ea77f9c892ba547e92eed))
* **copilot:** add model tier mapping support ([d21908a](https://github.com/kaitranntt/ccs/commit/d21908ab63aca6e96f14f6e0c78eb882de1177b9))
* **copilot:** add raw settings API and model mapping routes ([a3e2153](https://github.com/kaitranntt/ccs/commit/a3e2153498ac8a1a9b84319f6b0835fa8f085b3d))
* **copilot:** add raw settings support to useCopilot hook ([882792a](https://github.com/kaitranntt/ccs/commit/882792a4fbdd48b81840b4bb3f093831fe60de76))
* **copilot:** add self-managed package manager for copilot-api ([ecdad1d](https://github.com/kaitranntt/ccs/commit/ecdad1d6d0c21f47547573f666d68bb6d1164437))
* **copilot:** redesign config form to match CLIProxy pattern ([7886259](https://github.com/kaitranntt/ccs/commit/7886259c363914224b6717ff4d4a74104141d696))
* **ui:** add copilot dashboard page ([6b04532](https://github.com/kaitranntt/ccs/commit/6b04532f419622f9bfcd99d9e499445310f850d8))
* **ui:** add copilot-api install button and version display ([f813ad0](https://github.com/kaitranntt/ccs/commit/f813ad06f61ad6146698d82c4aed4b3a8e90dc5d))
* **ui:** display plan tiers and presets in copilot model selector ([87c2acc](https://github.com/kaitranntt/ccs/commit/87c2acc416c35b15377e4bce2ee45bc6d20d761a))
* **ui:** expose auth result with device code in hook ([5f0fde9](https://github.com/kaitranntt/ccs/commit/5f0fde9a612e7ec1ea13dd5fc807d033bf215fb8))
* **update:** add automatic update check on startup ([8a0ad53](https://github.com/kaitranntt/ccs/commit/8a0ad5308262ba14fb0fe23ff8a87f3c5ecaa139))

# [6.4.0](https://github.com/kaitranntt/ccs/compare/v6.3.1...v6.4.0) (2025-12-18)


### Bug Fixes

* **websearch:** detect Gemini CLI auth status before showing Ready ([98c21ef](https://github.com/kaitranntt/ccs/commit/98c21efb5a3b7a39b27fda958691837545235f2d))


### Features

* **cliproxy:** implement interactive project selection for OAuth flows ([a66abba](https://github.com/kaitranntt/ccs/commit/a66abba174eb77555b4443f3e930be30264da7e4))

## [6.3.1](https://github.com/kaitranntt/ccs/compare/v6.3.0...v6.3.1) (2025-12-18)


### Bug Fixes

* **ui:** limit Connection Timeline to 100 events to prevent lag ([170dcdc](https://github.com/kaitranntt/ccs/commit/170dcdc44f825bb64bedd7eb53fff6127ca94bce))

# [6.3.0](https://github.com/kaitranntt/ccs/compare/v6.2.1...v6.3.0) (2025-12-18)


### Bug Fixes

* **dashboard:** detect legacy proxy instances without session lock ([85cfbde](https://github.com/kaitranntt/ccs/commit/85cfbde5fd95850a28e962be01fc8655a69e8b1c))


### Features

* **cliproxy:** default session persistence for CLIProxy ([a7450bd](https://github.com/kaitranntt/ccs/commit/a7450bdffeb9679a02608cb76686e006afa6455f)), closes [#129](https://github.com/kaitranntt/ccs/issues/129)
* **dashboard:** add CLIProxy status widget with start button ([589cd2c](https://github.com/kaitranntt/ccs/commit/589cd2c2b7607b1092f6ee1ce4bf044269ba05e5))

## [6.2.1](https://github.com/kaitranntt/ccs/compare/v6.2.0...v6.2.1) (2025-12-18)


### Bug Fixes

* **ui:** add error state handling to API Profiles page ([2e77646](https://github.com/kaitranntt/ccs/commit/2e77646d607676fee1297948878cd4ba1939c58f)), closes [#125](https://github.com/kaitranntt/ccs/issues/125)
* **websearch:** pass through to native WebSearch for account profiles ([6bd1f42](https://github.com/kaitranntt/ccs/commit/6bd1f420d994e799125f338940689e969e524991))

# [6.2.0](https://github.com/kaitranntt/ccs/compare/v6.1.0...v6.2.0) (2025-12-18)


### Bug Fixes

* **ui:** improve account flow viz layout to fill available width ([7b876d2](https://github.com/kaitranntt/ccs/commit/7b876d23647eb190156e832df0b9bac6b7a6935f))
* **ui:** improve account-flow-viz layout and styling ([ee85a1f](https://github.com/kaitranntt/ccs/commit/ee85a1fd82c570e4c9296c746673c57a140f1677))
* **ui:** optimize bundle size and fix calendar crash ([572703f](https://github.com/kaitranntt/ccs/commit/572703f4399ae49dc73c3e1bdf00611a859a0f0f))
* **ui:** unify account card padding and fix SVG glow filter ([ab4c95b](https://github.com/kaitranntt/ccs/commit/ab4c95bac9a64145ab24ccc1f8f143be4f64d06b))


### Features

* **cliproxy:** remove thinking token cap and update agy haiku model ([925ac8e](https://github.com/kaitranntt/ccs/commit/925ac8e1d47066bf6bfa2e9a36a31ee972a1beb8))
* **ui:** add ClaudeKit badge and Sponsor buttons to navbar ([9028b74](https://github.com/kaitranntt/ccs/commit/9028b742f8f764217ccb04335d94c88966cbbb71))
* **ui:** add multi-zone layout and enhanced drag features to account flow viz ([365f820](https://github.com/kaitranntt/ccs/commit/365f820c55106b7a4c1e2af40637144fb58c7644))
* **ui:** extend privacy mode to blur cost/token values in analytics ([2bf7992](https://github.com/kaitranntt/ccs/commit/2bf7992a8a6cb316b252c6b6e20df7860b1b2b8e))

# [6.1.0](https://github.com/kaitranntt/ccs/compare/v6.0.0...v6.1.0) (2025-12-17)


### Bug Fixes

* **cliproxy:** prevent shared proxy termination on multi-session exit ([3629e3e](https://github.com/kaitranntt/ccs/commit/3629e3e2fbe78e890ee8f618437660fbcf7a9901)), closes [#118](https://github.com/kaitranntt/ccs/issues/118)


### Features

* **privacy:** add privacy/demo mode for personal info blurring ([6f3fb54](https://github.com/kaitranntt/ccs/commit/6f3fb54cc3104eac8033137a9a9b297895fd93c0))
* **ui:** add iflow provider logo support ([cefb3a5](https://github.com/kaitranntt/ccs/commit/cefb3a59d2264f64d21a7f051c121011b7e16366))

# [6.0.0](https://github.com/kaitranntt/ccs/compare/v5.20.0...v6.0.0) (2025-12-17)


### Bug Fixes

* **config:** force shutdown immediately instead of waiting ([6d69379](https://github.com/kaitranntt/ccs/commit/6d69379ead87dbf89d8b4d257e5134f45afc2e27))
* **dev-install:** prevent duplicate entries in bun global package.json ([13824b6](https://github.com/kaitranntt/ccs/commit/13824b61caa2905f267a2b0fdbeaeb1886352b46))
* **websearch:** preserve opencode and grok in mergeWithDefaults ([110925e](https://github.com/kaitranntt/ccs/commit/110925e72e1a4a50dd641992c0b92429913b5309))
* **websearch:** update config.yaml comments to match CLI implementation ([81e46bd](https://github.com/kaitranntt/ccs/commit/81e46bd0e12d1cae3755f556a8f8890f6d9c33ac))
* **websearch:** update existing hook config when filename changes ([4959928](https://github.com/kaitranntt/ccs/commit/4959928a8e2152916f4639bf0824e25518001bf4))
* **websearch:** use correct @vibe-kit/grok-cli package ([b6c1ae4](https://github.com/kaitranntt/ccs/commit/b6c1ae48bab13c4c60084bec2d1f854b80a685b8))


### Features

* **build:** add preinstall script to manage UI dependencies ([78fb459](https://github.com/kaitranntt/ccs/commit/78fb459d956308a5a965c87d0382151eb5f8bd89))
* **cliproxy-stats:** Implement detailed stats fetching and integrate into UI ([3216a0e](https://github.com/kaitranntt/ccs/commit/3216a0e8478ba9224b1c8ea36582a5166c8c01e0))
* **monitor:** Enhance auth monitor and account flow visualization ([994bd77](https://github.com/kaitranntt/ccs/commit/994bd7765acd735635d0c324acac1aea0bb8a165))
* **ui:** add connection timeline and improve account flow layout ([27de6af](https://github.com/kaitranntt/ccs/commit/27de6af8aa5a5de72b2c34137cd1a5343e175bc9))
* **ui:** add documentation button to header ([6e4ee80](https://github.com/kaitranntt/ccs/commit/6e4ee805da23ac8969f4161d27047b5b82a07abc))
* **ui:** enhance light theme contrast and animations ([197848a](https://github.com/kaitranntt/ccs/commit/197848a71bbb26cbbd31ea5457ac917b82688d05))
* **ui:** implement auth monitor components & pages ([b97c3bf](https://github.com/kaitranntt/ccs/commit/b97c3bfda4ad47787fbce53617a7ee5d5267c2bf))
* **websearch:** add advanced configuration and custom MCP support ([cadd2e8](https://github.com/kaitranntt/ccs/commit/cadd2e824105d7beb0ccb04f554efda82470d29c))
* **websearch:** add Grok CLI support and improve install guidance ([c0938e1](https://github.com/kaitranntt/ccs/commit/c0938e1c8286b0f9c262cc36472e3600a2b044bb))
* **websearch:** add MCP fallback and Gemini CLI hook for third-party profiles ([fd99ebc](https://github.com/kaitranntt/ccs/commit/fd99ebca983970b5fa1d5d366b0af5d136f9433e))
* **websearch:** add model config + improve hook UX ([14c53d5](https://github.com/kaitranntt/ccs/commit/14c53d575f5eda6e49861d23c9eb22bfa6bf7058))
* **websearch:** add multi-tier MCP fallback for third-party profiles ([071ec04](https://github.com/kaitranntt/ccs/commit/071ec041ed7e2cfa21cadb7f55bfa93d9fe8cb1b))
* **websearch:** add OpenCode CLI as third WebSearch provider ([482cda0](https://github.com/kaitranntt/ccs/commit/482cda0f8e61fa0bb63672db74b7e5efb1c3f1c8))
* **websearch:** dynamic hook timeout from config + grok-code default ([d33fefd](https://github.com/kaitranntt/ccs/commit/d33fefd1336129572a03d983fae5c32bf5f4998f))
* **websearch:** enhance Gemini CLI integration, package manager detection, and WebSearch status ([f7a1a40](https://github.com/kaitranntt/ccs/commit/f7a1a40b42a17e18a69c241614cf3f5853deace3))
* **websearch:** implement fallback chain for CLI providers ([e6aa8ac](https://github.com/kaitranntt/ccs/commit/e6aa8ac453c70995307ea1fc5c819e0f891f1d61))
* **websearch:** respect config provider settings and consolidate prompts ([e71cb62](https://github.com/kaitranntt/ccs/commit/e71cb6227cfb114ca1864eea5198854604d83c52))
* **web:** update account manager and web routes ([127e0e6](https://github.com/kaitranntt/ccs/commit/127e0e60437f47cd445c1ce9ddf03415d51a06c7))


### BREAKING CHANGES

* **websearch:** Hook no longer falls back to all installed CLIs. It now
strictly respects config.yaml settings.

# [5.20.0](https://github.com/kaitranntt/ccs/compare/v5.19.2...v5.20.0) (2025-12-15)


### Bug Fixes

* **auth:** improve default account hint and add reset-default command ([2fb266c](https://github.com/kaitranntt/ccs/commit/2fb266c01f0a6a5bf10a0fe1662e1f315b732a61)), closes [#106](https://github.com/kaitranntt/ccs/issues/106)
* resolve ESM/CJS compatibility for Node.js 18 ([b915127](https://github.com/kaitranntt/ccs/commit/b915127b3a775667c171fd12a9756fc3d5d321d0)), closes [#110](https://github.com/kaitranntt/ccs/issues/110)


### Features

* **oauth:** enhance auth flow with detailed pre-flight checks and real-time progress ([e80c48c](https://github.com/kaitranntt/ccs/commit/e80c48c55f8b74614d0bebb3336163588018ebd6))

## [5.19.2](https://github.com/kaitranntt/ccs/compare/v5.19.1...v5.19.2) (2025-12-14)


### Bug Fixes

* **auth:** handle Windows spawn for profile creation ([5efab53](https://github.com/kaitranntt/ccs/commit/5efab53eb7f048b2a29a088508e1fcb19c4acd91))

## [5.19.1](https://github.com/kaitranntt/ccs/compare/v5.19.0...v5.19.1) (2025-12-14)


### Bug Fixes

* **auth:** include unified config accounts in auth list command ([3cdf84b](https://github.com/kaitranntt/ccs/commit/3cdf84b1ba232ec6e68a40cf90558afeee21154e))

# [5.19.0](https://github.com/kaitranntt/ccs/compare/v5.18.0...v5.19.0) (2025-12-14)


### Bug Fixes

* **auth:** use unified config for account profile touch in ccs.ts ([4ccde8a](https://github.com/kaitranntt/ccs/commit/4ccde8a3f07d5ebb658213dfe9f69a7b11ec3aac)), closes [#98](https://github.com/kaitranntt/ccs/issues/98)
* **ci:** prevent shell injection from PR body markdown ([5a8db2c](https://github.com/kaitranntt/ccs/commit/5a8db2c1ee87b2a252f61759273863c0c521f27b))
* **cliproxy:** add SSH port forwarding instructions for headless OAuth ([a6b95db](https://github.com/kaitranntt/ccs/commit/a6b95dbac5f97a870c7ef58701726ad9733ea75d))


### Features

* **cliproxy:** disable logging by default and add cleanup command ([e5cdf7c](https://github.com/kaitranntt/ccs/commit/e5cdf7c083b1b220627dad711df6f6f1c746d9ad)), closes [#96](https://github.com/kaitranntt/ccs/issues/96)

# [5.18.0](https://github.com/kaitranntt/ccs/compare/v5.17.0...v5.18.0) (2025-12-13)


### Bug Fixes

* **analytics:** fill hourly gaps with zero values in 24H view ([4412d22](https://github.com/kaitranntt/ccs/commit/4412d22f3eee8f0b664f9fdad3562cb414aacacf))
* **analytics:** guard against undefined data arrays in filtering ([e08935b](https://github.com/kaitranntt/ccs/commit/e08935b411caec21abc1bd795f6af8a889687f03))
* **analytics:** use UTC dates and cap hourly chart at current time ([9fd0c1c](https://github.com/kaitranntt/ccs/commit/9fd0c1cc074c2d14b6978aba001b3b6552b06642))


### Features

* **ui:** implement operational hub core components ([a2d049c](https://github.com/kaitranntt/ccs/commit/a2d049c6045ab18a732171cd852b6c116f80e46f))
* **ui:** premium home page with gradient glass design ([dbc1371](https://github.com/kaitranntt/ccs/commit/dbc13718ef4d194795fe1370aab005d971f96af0))
* **ui:** redesign home page as Interactive Status Board ([cf567bb](https://github.com/kaitranntt/ccs/commit/cf567bb9246c50de446c47f426c4ad8790ee928c))

# [5.17.0](https://github.com/kaitranntt/ccs/compare/v5.16.0...v5.17.0) (2025-12-12)


### Bug Fixes

* **ci:** improve issue tagging - use bot, skip duplicates, simpler msg ([27f9ea8](https://github.com/kaitranntt/ccs/commit/27f9ea8f0f518c40096404f11f5964d0c42fdfdc))
* **ci:** resolve YAML syntax error in dev-release workflow ([763928f](https://github.com/kaitranntt/ccs/commit/763928f2820f1c018e127e506c0d1590aecbeafa))
* **cliproxy:** inherit stdin for OAuth interactive prompts ([84484c0](https://github.com/kaitranntt/ccs/commit/84484c06c33b19a198d876bc7c071d9f83f3741f)), closes [#91](https://github.com/kaitranntt/ccs/issues/91)
* **cliproxy:** respect version pin when user installs specific version ([a7ba1a1](https://github.com/kaitranntt/ccs/commit/a7ba1a198398c33af23f43fc07ff871ce068b4e7)), closes [#88](https://github.com/kaitranntt/ccs/issues/88)
* **config:** prevent profile loss from strict config validation ([d343abc](https://github.com/kaitranntt/ccs/commit/d343abca53eb0fd238d0ff2c59f674a05a651721)), closes [#82](https://github.com/kaitranntt/ccs/issues/82)
* **update:** add shell option for Windows npm/cache spawn ([8c1b8e4](https://github.com/kaitranntt/ccs/commit/8c1b8e49aecf3b7901c3ddf8b2f1ba69233671ec)), closes [#85](https://github.com/kaitranntt/ccs/issues/85)
* **update:** avoid Node deprecation warning on Windows spawn ([bace084](https://github.com/kaitranntt/ccs/commit/bace084e75442a4321659fceea19b89ffdfa9b6b))
* **update:** suppress Node deprecation warnings on Windows ([d616e61](https://github.com/kaitranntt/ccs/commit/d616e613c857176a0cfb3f5f0dc9485b11326344))


### Features

* **analytics:** add 24H hourly chart with caching and UI improvements ([d64115f](https://github.com/kaitranntt/ccs/commit/d64115f91a7005f2c4ff09a63831da2aac050ba2))
* **cli:** standardize UI output with ui.ts abstraction layer ([4005f1c](https://github.com/kaitranntt/ccs/commit/4005f1c01ca9fa921978664a0a1b929689513456))


### Performance Improvements

* **ci:** add HUSKY=0 to release workflow ([99f3a67](https://github.com/kaitranntt/ccs/commit/99f3a674b858021e577edd7650afd872a1e251ae))
* **ci:** reduce test redundancy from 4x to 1x per release ([d39095c](https://github.com/kaitranntt/ccs/commit/d39095c7d6923219d7ade0fca59cc555a4489cc9))

# [5.16.0](https://github.com/kaitranntt/ccs/compare/v5.15.0...v5.16.0) (2025-12-12)


### Features

* **cliproxy:** add provider editor with presets and control panel ([92b7065](https://github.com/kaitranntt/ccs/commit/92b7065e10618285988b4a539b503f54e5cf4baf))
* **cliproxy:** add stats fetcher and OpenAI-compatible model manager ([a94c3d6](https://github.com/kaitranntt/ccs/commit/a94c3d66004ba0921835bddd8ca5c168868e72d5))
* **ui:** add cliproxy stats overview and enhance analytics components ([c3b2d50](https://github.com/kaitranntt/ccs/commit/c3b2d50269b5ad515409cc562e204d94ab65dd87))
* **ui:** redesign cliproxy page with master-detail layout ([f8648be](https://github.com/kaitranntt/ccs/commit/f8648be6d9a9e6e94624fe700dfd9bcd1e2dbc5b))

# [5.15.0](https://github.com/kaitranntt/ccs/compare/v5.14.0...v5.15.0) (2025-12-11)


### Bug Fixes

* **cache:** use ~/.ccs/cache/ for usage and update-check files ([790ac3c](https://github.com/kaitranntt/ccs/commit/790ac3c862c81539a048db5b3f67ed8d86a86cfb))
* **migrate:** include backup path in rollback command ([0aa9131](https://github.com/kaitranntt/ccs/commit/0aa913164211b6cd0ad65b3b546e49edaa0bcc30))
* **migrate:** skip autoMigrate when running migrate command ([05a6199](https://github.com/kaitranntt/ccs/commit/05a6199d839c26ebff6278448825174466fc6518))
* **ui:** resolve layout and theme issues in profile editor ([46ee1df](https://github.com/kaitranntt/ccs/commit/46ee1df0836fac4bb6b4b75413846163ced2fc6f))


### Features

* **api-profile-ux:** Implement API & UI for profile management ([8357005](https://github.com/kaitranntt/ccs/commit/83570050ef9b68746405df8588e400faa2007c0a))
* **api-profile-ux:** implement tabbed profile editor and fix disclaimer visibility ([8c9d669](https://github.com/kaitranntt/ccs/commit/8c9d669ccec6d2c56c37f4421e5ca6d4c95703e3))
* **api:** improve create UX with URL validation and model mapping ([f83051b](https://github.com/kaitranntt/ccs/commit/f83051be40514a2084ceb06007eea37b31dd3062)), closes [#72](https://github.com/kaitranntt/ccs/issues/72)
* **cliproxy:** implement --nickname flag for account management ([0d70708](https://github.com/kaitranntt/ccs/commit/0d70708658efb4b7e431f95d69c742a28d254ca6))
* **config:** add unified YAML config with migration support ([b621b8e](https://github.com/kaitranntt/ccs/commit/b621b8e47bc63f2939b45a243173ce6b414a3ec2)), closes [#75](https://github.com/kaitranntt/ccs/issues/75)
* **dashboard:** add code editor for raw JSON settings editing ([2b1a3b4](https://github.com/kaitranntt/ccs/commit/2b1a3b48799eae30b5d0493e5af65edab204f4d8)), closes [#73](https://github.com/kaitranntt/ccs/issues/73)
* **profile:** refactor create UX with dialog-based interface ([720ff9d](https://github.com/kaitranntt/ccs/commit/720ff9d7d6eb881a73547daab262030fb619e5ee))

# [5.14.0](https://github.com/kaitranntt/ccs/compare/v5.13.0...v5.14.0) (2025-12-10)


### Features

* **ui:** replace anomaly alert badge with usage insights card ([824c3ba](https://github.com/kaitranntt/ccs/commit/824c3baecfb7795f848909240b95bfeb9e6c1b87))
* **usage-analytics:** implement token cost breakdown and anomaly detection ([d81a5e6](https://github.com/kaitranntt/ccs/commit/d81a5e6266731f203c3de1100362fb0822156a39))
* **usage:** add internal data aggregation and cost tracking ([49b4065](https://github.com/kaitranntt/ccs/commit/49b4065186bc223af1b589395808e962b3cf6bb3))

# [5.13.0](https://github.com/kaitranntt/ccs/compare/v5.12.1...v5.13.0) (2025-12-09)


### Features

* **analytics:** aggregate usage from all CCS auth profiles ([1e11d2e](https://github.com/kaitranntt/ccs/commit/1e11d2e40af20386e5e26677021440f35a7e7217))
* **analytics:** refactor model color management and fix UI display issues ([f255a20](https://github.com/kaitranntt/ccs/commit/f255a20a931babc45e8a4c9e34d733f8a9eed83f))
* **cliproxy:** add --add flag and nickname support for multi-account auth ([493492f](https://github.com/kaitranntt/ccs/commit/493492fa7e88746f47240026ac16fae0575ff223))
* **cliproxy:** add --use and --accounts flags for multi-account switching ([8f6684f](https://github.com/kaitranntt/ccs/commit/8f6684f948b0905d0dd7b558c3d0d4023e042970))
* **cliproxy:** add multi-account support phases 02-03 ([d868dc4](https://github.com/kaitranntt/ccs/commit/d868dc4c32948db27e4b6073e9a7d28966a54971))
* **dashboard:** add Environment and OAuth Readiness groups to health page ([96d9fc6](https://github.com/kaitranntt/ccs/commit/96d9fc68e9cf2af8b0b0d237d1ef094269cebb38))
* **doctor:** add OAuth diagnostics for Windows headless false positives ([92007d7](https://github.com/kaitranntt/ccs/commit/92007d7c0468db969bd481c6517f0b3a851d8433))
* **ui:** simplify CLIProxy page UX with dedicated Add Account dialog ([8f5c006](https://github.com/kaitranntt/ccs/commit/8f5c006f07f0ad93a7c7009df377b292076af55a))

## [5.12.1](https://github.com/kaitranntt/ccs/compare/v5.12.0...v5.12.1) (2025-12-09)


### Performance Improvements

* **analytics:** instant dashboard loading with disk cache persistence ([abb156d](https://github.com/kaitranntt/ccs/commit/abb156d9f4064d078a953966082e06059ad52d80))

# [5.12.0](https://github.com/kaitranntt/ccs/compare/v5.11.0...v5.12.0) (2025-12-09)


### Bug Fixes

* **security:** improve API key detection patterns to prevent false positives ([efb42ba](https://github.com/kaitranntt/ccs/commit/efb42ba8f6adfa5128c4974d43140fd640b826a1))
* **ui:** reduce focus ring size to prevent overlapping content ([639eec7](https://github.com/kaitranntt/ccs/commit/639eec7930c4f34dacd0fb2326de87ed640d8e74))
* **ui:** update dropdown menu item SVG color on focus ([ed5c3fc](https://github.com/kaitranntt/ccs/commit/ed5c3fc83ab4117263e74aaf29a4df8d63a8e5c1))
* **web:** correct skill detection to look for SKILL.md instead of prompt.md ([13194fe](https://github.com/kaitranntt/ccs/commit/13194fecbe575e83bd6f366e2aca1d92922ccd24))


### Features

* **analytics:** add usage analytics page with caching layer ([a721af3](https://github.com/kaitranntt/ccs/commit/a721af3cf3ff618603e982aa2fda47980251c4e4))
* **cli:** Introduce version utility and command updates ([d77f07e](https://github.com/kaitranntt/ccs/commit/d77f07e09376e410bf693d40d3ac646e2f35465c))
* **cliproxy:** promote thinking models as default for agy provider ([1475adb](https://github.com/kaitranntt/ccs/commit/1475adb61649fc9ac5d7e66845649f3eb63f88b0))
* **ui:** add modular health dashboard components ([4ff6f08](https://github.com/kaitranntt/ccs/commit/4ff6f085122c20209e73fcbda457175fb47958de))
* **ui:** Enhance web overview with new components and data ([cc16556](https://github.com/kaitranntt/ccs/commit/cc1655624c08e8f0f20cd0416831272affe9fdf0))
* **ui:** redesign health dashboard to match ccs doctor output ([8aae0db](https://github.com/kaitranntt/ccs/commit/8aae0db7da9e691e9a35d222d6828d6e658c49c4))


### Performance Improvements

* **analytics:** add cache pre-warming and SWR pattern for instant page load ([69e6a32](https://github.com/kaitranntt/ccs/commit/69e6a322248d3952156784520a9e264b7f24c0e8))

# [5.11.0](https://github.com/kaitranntt/ccs/compare/v5.10.0...v5.11.0) (2025-12-08)


### Bug Fixes

* **cliproxy:** map token type values to provider names for account discovery ([17caf80](https://github.com/kaitranntt/ccs/commit/17caf804ba02cab878b3f1476ec02f0f0697d6f1))
* **ui:** improve cliproxy dashboard layout and dropdown styling ([10d0550](https://github.com/kaitranntt/ccs/commit/10d05502f305f5f351562da8b0aa2b64dca41a4c))
* **ui:** remove padding from cliproxy card ([3a1e8c0](https://github.com/kaitranntt/ccs/commit/3a1e8c0afc69b1ca612a267e373b62f80a34c8ce))


### Features

* **cliproxy:** add multi-account support for CLIProxy providers ([4dc17fa](https://github.com/kaitranntt/ccs/commit/4dc17fac4f655e31afc0e491aa43f7a9c3f64df1))

# [5.10.0](https://github.com/kaitranntt/ccs/compare/v5.9.0...v5.10.0) (2025-12-08)


### Bug Fixes

* **glmt:** add bearer prefix for openai-compatible endpoints ([077a406](https://github.com/kaitranntt/ccs/commit/077a406df6f79fdd0e343c3b6b3d0860a3d41a87)), closes [#61](https://github.com/kaitranntt/ccs/issues/61)
* **glmt:** pass env vars to proxy subprocess ([e17a068](https://github.com/kaitranntt/ccs/commit/e17a068a58c7dee67a33852860e5bcae051a7f37))
* **ui:** adjust layout of localhost disclaimer ([ad5859c](https://github.com/kaitranntt/ccs/commit/ad5859c157271c111f1bbc437060770746d3394e))
* **ui:** improve table column widths and spacing ([9b4a5d8](https://github.com/kaitranntt/ccs/commit/9b4a5d80c5c398c7165426dac2a88a8e9443ff3a))
* **ui:** prettier formatting for documentation link ([d11071a](https://github.com/kaitranntt/ccs/commit/d11071ad90d6ed3886b437b3ac15b3818d5b2585))
* **ui:** suppress react compiler warning in profiles-table ([cf072c0](https://github.com/kaitranntt/ccs/commit/cf072c03b269d9df93ec014905b50d41a78a83bd))


### Features

* **build:** disable commitlint subject-case rule and add clean-dist script ([5947532](https://github.com/kaitranntt/ccs/commit/5947532fc65ba39a70f422b314fad103603e00af))
* **cliproxy:** add authentication status display to web dashboard ([a283f94](https://github.com/kaitranntt/ccs/commit/a283f942a9712f97c5789ea39a508da1d5305a79))
* **cliproxy:** deprecate claude thinking models in agy provider ([63b3ca7](https://github.com/kaitranntt/ccs/commit/63b3ca776079634fcf59f231e51ad8947795b2a0))
* **completions:** enhance cliproxy help and update shell completion scripts ([59a2f2b](https://github.com/kaitranntt/ccs/commit/59a2f2b717a97447759ff68fdb8eca81908a9d88))
* **doctor:** improve port detection with process identification ([98fd1be](https://github.com/kaitranntt/ccs/commit/98fd1bedb9b38c4900f8cc4049d74347d407d499))
* **ui:** add accounts and cliproxy management dashboard ([03059db](https://github.com/kaitranntt/ccs/commit/03059dbdccaca9736ae45c0754543e59c2a3e0f6))
* **ui:** add ccs branding assets and logo component ([1b16305](https://github.com/kaitranntt/ccs/commit/1b163050f795f1a7a75be203895f1addd6d21f8e))
* **ui:** add comprehensive quality gates and fix linting issues ([707af2f](https://github.com/kaitranntt/ccs/commit/707af2f01a67264f7722afcd53ac3f6246aefc89))
* **ui:** enhance settings dialog with tabbed interface and scrollable areas ([4adb94b](https://github.com/kaitranntt/ccs/commit/4adb94b90cf9e16929fef14ed46d474e07e9c131))
* **ui:** enhance visual contrast and update project link ([c65d9c9](https://github.com/kaitranntt/ccs/commit/c65d9c9c3484f8053e2b4315198ee29a4c3be2b0))
* **ui:** redesign sidebar and fix disclaimer ([c8890f3](https://github.com/kaitranntt/ccs/commit/c8890f33c2e9e15fdf89bb2b467eda2c836d95d2))
* **ui:** reorganize theme colors and add dev script ([235bd6b](https://github.com/kaitranntt/ccs/commit/235bd6b36a28e63661123344c983f5d06ee1b3aa))
* **ui:** update theme colors to match brand palette ([b5f22e4](https://github.com/kaitranntt/ccs/commit/b5f22e415b865eba59c6458488409f2db4e29f5a))
* **web-dashboard:** add dev mode with hmr and optimize build ([23a3382](https://github.com/kaitranntt/ccs/commit/23a33820c03fe26bcf12bd3b2432ce50a88b90d1))
* **web-dashboard:** add express server and react ui scaffolding ([6a6f2a2](https://github.com/kaitranntt/ccs/commit/6a6f2a24638cdaeec7868e9742da066c0d8cdc6b))
* **web-dashboard:** add rest api and real-time sync ([56502ab](https://github.com/kaitranntt/ccs/commit/56502ab6a8deae4d7cafe76de46b5cc156398f85))
* **web-dashboard:** complete settings, health, shared data and build integration ([5975802](https://github.com/kaitranntt/ccs/commit/59758024c92005016087264ed5caa0738cbcb1b2))
* **web:** enhance dashboard functionality and ui components ([6e2da64](https://github.com/kaitranntt/ccs/commit/6e2da6458a0f574dbe32e555c9725d766e3c861c))
* **web:** update shared routes and home page for dashboard ([e078f15](https://github.com/kaitranntt/ccs/commit/e078f152976661c410ca0a8cd502a6bd3b56e056))

# [5.9.0](https://github.com/kaitranntt/ccs/compare/v5.8.0...v5.9.0) (2025-12-06)


### Features

* **cliproxy:** add crud commands for variant profiles ([6427ecf](https://github.com/kaitranntt/ccs/commit/6427ecf5af4a9be40f39c2a64bf72ac4e861d349))

# [5.8.0](https://github.com/kaitranntt/ccs/compare/v5.7.0...v5.8.0) (2025-12-05)


### Bug Fixes

* **agy:** enable claude model thinking via antigravity profile ([6f19440](https://github.com/kaitranntt/ccs/commit/6f194404722e63990f64d250d08c5f5e33235e05))
* **agy:** preserve user settings during model switch ([f5c31da](https://github.com/kaitranntt/ccs/commit/f5c31dab55033cd8db99247ca9eab8a47fcb24fb))
* **agy:** remove max_thinking_tokens when switching to non-claude model ([6decd15](https://github.com/kaitranntt/ccs/commit/6decd157e5e7b4d19ed3dac2cfdcb0131ce9d782))
* **cliproxy:** consolidate download ui to single spinner ([ace5ba8](https://github.com/kaitranntt/ccs/commit/ace5ba87502c51a7e8fe35df5fe4a8f7aaacd173))
* **cliproxy:** only remove provider-specific auth files on logout ([4770047](https://github.com/kaitranntt/ccs/commit/47700474a40539fad85c58fc5c971b85ddab45c4))
* **skill:** use yaml block scalar for ccs-delegation description ([26154c3](https://github.com/kaitranntt/ccs/commit/26154c3e13b14d76fee87473b84365457139c553))


### Features

* **agy:** disable thinking toggle for claude models via antigravity ([f5a1b81](https://github.com/kaitranntt/ccs/commit/f5a1b81e553d2d057dc1f49fabac1945a83fc361)), closes [#415](https://github.com/kaitranntt/ccs/issues/415)
* **delegation:** add passthrough args for claude cli flags ([26d72cf](https://github.com/kaitranntt/ccs/commit/26d72cfa5bbd7ea5d4a42dc7d5c4010ae5247711))

# [5.7.0](https://github.com/kaitranntt/ccs/compare/v5.6.0...v5.7.0) (2025-12-05)


### Bug Fixes

* **ci:** add path filtering to deploy-ccs-worker pull request trigger ([64a8e86](https://github.com/kaitranntt/ccs/commit/64a8e86db4be7dd96d19654e1e91827ae62e0f7e))
* **doctor:** repair shared settings.json symlink broken by claude cli ([1471bd2](https://github.com/kaitranntt/ccs/commit/1471bd2152b8eec376b7c0b5d13499546477c0cb)), closes [#57](https://github.com/kaitranntt/ccs/issues/57)
* **types:** add forceversion to binarymanagerconfig interface ([3bb1ea7](https://github.com/kaitranntt/ccs/commit/3bb1ea7541fcf1bd38818b941ef3c5997d8daeb5))


### Features

* **cliproxy:** add iFlow OAuth provider support ([#55](https://github.com/kaitranntt/ccs/issues/55)) ([20bf626](https://github.com/kaitranntt/ccs/commit/20bf6266d2817bbceb8a9b5b7914f3ffc9164275))

# [5.6.0](https://github.com/kaitranntt/ccs/compare/v5.5.0...v5.6.0) (2025-12-04)


### Bug Fixes

* **cliproxy:** clarify paid tier messaging to reference google account tier ([848fbf4](https://github.com/kaitranntt/ccs/commit/848fbf4686b49305c26ef85da339b12dffa51b5b))
* **cliproxy:** correct model selection default and update fallback version ([fdb8761](https://github.com/kaitranntt/ccs/commit/fdb8761cfac416831a8c3ae64f5718179517e3d0))
* **dev-release:** find next available dev version from npm ([482f3a7](https://github.com/kaitranntt/ccs/commit/482f3a7fc66f1b93a1b7e24e00a87c9858574ebd))
* **doctor:** use actual installed clipproxy version instead of hardcoded ([e3edcf6](https://github.com/kaitranntt/ccs/commit/e3edcf613e28a48fb7cb5c2c90ffed3c80cb0c62))
* **prompt:** strip bracketed paste escape sequences from password input ([df31ffc](https://github.com/kaitranntt/ccs/commit/df31ffcee7872b8d263451807818b368a9ba1eb4))
* **update:** add --help support and --dev alias for update command ([b18163c](https://github.com/kaitranntt/ccs/commit/b18163c57b59cabbd7d18165b28933155d94d74a))


### Features

* **cliproxy:** add model catalog with configuration management ([4654c15](https://github.com/kaitranntt/ccs/commit/4654c15577307457f8eb86ca9718b527460c7c40))
* **cliproxy:** add version management command ([7e07615](https://github.com/kaitranntt/ccs/commit/7e07615eedb7263aa359651abef8660ff0dcd95a))
* **cliproxy:** add warning for broken claude proxy models on agy ([0e11426](https://github.com/kaitranntt/ccs/commit/0e11426daa8896ba58aa9d53889818ab3577e250)), closes [CLIProxyAPI#415](https://github.com/CLIProxyAPI/issues/415)
* **prompt:** add password input utility with masking ([3bdbff9](https://github.com/kaitranntt/ccs/commit/3bdbff9345c2eb21d861621e56430de5bac61fc4))
* **release:** simplify dev versioning with stable base ([942b4b9](https://github.com/kaitranntt/ccs/commit/942b4b92cfce054c0886d8508f1c15ad18fd4400))

# [5.5.0](https://github.com/kaitranntt/ccs/compare/v5.4.3...v5.5.0) (2025-12-04)


### Bug Fixes

* **changelog:** restore full changelog history from main ([2e5b1f2](https://github.com/kaitranntt/ccs/commit/2e5b1f212abe5611c164cc84388002686175bc8b))
* **tests:** migrate test suite from mocha to bun test runner ([bd46c8d](https://github.com/kaitranntt/ccs/commit/bd46c8de1237e3a76c774b00a1c9e026f4c0cd4b))


### Features

* **kimi:** update default model to kimi-k2-thinking-turbo ([134511c](https://github.com/kaitranntt/ccs/commit/134511c38b581a720da6b9d7e6608ca6b3c63fb1))

## [5.4.4-dev.2](https://github.com/kaitranntt/ccs/compare/v5.4.4-dev.1...v5.4.4-dev.2) (2025-12-04)


### Bug Fixes

* **changelog:** restore full changelog history from main ([2e5b1f2](https://github.com/kaitranntt/ccs/commit/2e5b1f212abe5611c164cc84388002686175bc8b))

## [5.4.3](https://github.com/kaitranntt/ccs/compare/v5.4.2...v5.4.3) (2025-12-03)


### Bug Fixes

* **postinstall:** handle broken symlinks during npm install ([81add5a](https://github.com/kaitranntt/ccs/commit/81add5a05eeb8297ceef840071f11b6a194df707))

## [5.4.2](https://github.com/kaitranntt/ccs/compare/v5.4.1...v5.4.2) (2025-12-03)


### Bug Fixes

* **merge:** resolve conflicts between dev and main ([8347ea6](https://github.com/kaitranntt/ccs/commit/8347ea64c6b919a79f5ab63c398b6c36f012ca2d))
* **sync:** implement copy fallback for windows when symlinks unavailable ([6b3f93a](https://github.com/kaitranntt/ccs/commit/6b3f93a80a0232e8c964d73e51aa0afb0768b00f)), closes [#45](https://github.com/kaitranntt/ccs/issues/45)

## [5.4.2-dev.1](https://github.com/kaitranntt/ccs/compare/v5.4.1...v5.4.2-dev.1) (2025-12-03)


### Bug Fixes

* **merge:** resolve conflicts between dev and main ([8347ea6](https://github.com/kaitranntt/ccs/commit/8347ea64c6b919a79f5ab63c398b6c36f012ca2d))
* **sync:** implement copy fallback for windows when symlinks unavailable ([6b3f93a](https://github.com/kaitranntt/ccs/commit/6b3f93a80a0232e8c964d73e51aa0afb0768b00f)), closes [#45](https://github.com/kaitranntt/ccs/issues/45)

## [5.4.1](https://github.com/kaitranntt/ccs/compare/v5.4.0...v5.4.1) (2025-12-03)


### Bug Fixes

* **cliproxy:** resolve windows auth browser not opening ([af4d6cf](https://github.com/kaitranntt/ccs/commit/af4d6cff89395a74e2eaf56551d3f56b95e0a6ce)), closes [#42](https://github.com/kaitranntt/ccs/issues/42)
* **doctor:** resolve windows claude cli detection failure ([cfe9ba0](https://github.com/kaitranntt/ccs/commit/cfe9ba05a4351302fbb330ca00b6025cb65a8f20)), closes [#41](https://github.com/kaitranntt/ccs/issues/41)
* **sync:** implement copy fallback for windows when symlinks unavailable ([6b3f93a](https://github.com/kaitranntt/ccs/commit/6b3f93a80a0232e8c964d73e51aa0afb0768b00f)), closes [#45](https://github.com/kaitranntt/ccs/issues/45)

## [5.4.1-dev.1](https://github.com/kaitranntt/ccs/compare/v5.4.0...v5.4.1-dev.1) (2025-12-03)


### Bug Fixes

* **cliproxy:** resolve windows auth browser not opening ([af4d6cf](https://github.com/kaitranntt/ccs/commit/af4d6cff89395a74e2eaf56551d3f56b95e0a6ce)), closes [#42](https://github.com/kaitranntt/ccs/issues/42)
* **doctor:** resolve windows claude cli detection failure ([cfe9ba0](https://github.com/kaitranntt/ccs/commit/cfe9ba05a4351302fbb330ca00b6025cb65a8f20)), closes [#41](https://github.com/kaitranntt/ccs/issues/41)

# [5.4.0](https://github.com/kaitranntt/ccs/compare/v5.3.0...v5.4.0) (2025-12-02)


### Bug Fixes

* **auth:** prevent default profile from using stale glm env vars ([13d13da](https://github.com/kaitranntt/ccs/commit/13d13dab516332bc17345dc77afd44ae48bdd2aa)), closes [#37](https://github.com/kaitranntt/ccs/issues/37)
* **cliproxy:** convert windows backslashes to forward slashes in config.yaml auth-dir ([a6663cb](https://github.com/kaitranntt/ccs/commit/a6663cbd0471d1a08e8bbcdea897760b434ae937)), closes [#36](https://github.com/kaitranntt/ccs/issues/36)
* **cliproxy:** improve qwen oauth error handling ([7e0b0fe](https://github.com/kaitranntt/ccs/commit/7e0b0feca8ce2ed5d505c5bf6c84e54c6df8839e)), closes [#29](https://github.com/kaitranntt/ccs/issues/29)
* **cliproxy:** use double-dash flags for cliproxyapi auth ([#24](https://github.com/kaitranntt/ccs/issues/24)) ([4c81f28](https://github.com/kaitranntt/ccs/commit/4c81f28f0b67ef92cf74d0f5c13a5943ff0a7f00))
* **deps:** add chalk, boxen, gradient-string, listr2 as dependencies ([a214749](https://github.com/kaitranntt/ccs/commit/a214749725cfe05612e2c84cefa2ab3f619c6a2e))
* **glmt:** handle 401 errors and headers-already-sent exception ([#30](https://github.com/kaitranntt/ccs/issues/30)) ([c953382](https://github.com/kaitranntt/ccs/commit/c95338232a37981b95b785b47185ce18d6d94b7a)), closes [#26](https://github.com/kaitranntt/ccs/issues/26)
* **prompt:** improve password input handling with raw mode and buffer support ([bc56d2e](https://github.com/kaitranntt/ccs/commit/bc56d2e135532b2ae443144dd42217b26bcba951))


### Features

* **cliproxy:** add qwen code oauth provider support ([#31](https://github.com/kaitranntt/ccs/issues/31)) ([a3f1e52](https://github.com/kaitranntt/ccs/commit/a3f1e52ac68600ba0806d67aacceb6477ffa3543)), closes [#29](https://github.com/kaitranntt/ccs/issues/29)
* **cliproxy:** auto-update cliproxyapi to latest release on startup ([8873ccd](https://github.com/kaitranntt/ccs/commit/8873ccd981679e8acff8965accdc22215c6e4aa2))
* **profile:** add profile command with configuration display ([53d7a15](https://github.com/kaitranntt/ccs/commit/53d7a15c047e760723e051dc0f7be3c0dd42d087))
* **shell-completion:** add --force flag and fix zsh profile coloring ([7faed1d](https://github.com/kaitranntt/ccs/commit/7faed1d84ba29ba02bf687bae5b3458617512e67))
* **ui:** add central ui abstraction layer for cli styling ([6e49e0e](https://github.com/kaitranntt/ccs/commit/6e49e0e7e157abd4a38c98553dbe3c16473b57d9))
* **ui:** enhance auth commands with new ui layer ([6f42a65](https://github.com/kaitranntt/ccs/commit/6f42a6527b1bf02cbf29ec23525c9f27af6f0c98))
* **ui:** enhance delegation with listr2 task lists and styled output ([716193a](https://github.com/kaitranntt/ccs/commit/716193a682a1504767c7f32409a0de51278242eb))
* **ui:** enhance doctor and error manager with new ui layer ([57016f3](https://github.com/kaitranntt/ccs/commit/57016f3f765f207915161514e1827b18c0b03d5c))
* **ui:** enhance help and profile commands with new ui layer ([f3ed359](https://github.com/kaitranntt/ccs/commit/f3ed359050ce66d96c0109cf60c242bfd092114d))
* **ui:** enhance section headers with gradient and rename profile to api ([073a5e1](https://github.com/kaitranntt/ccs/commit/073a5e15ee8f895d7485864526d8946b774bb728))

# [5.4.0-beta.3](https://github.com/kaitranntt/ccs/compare/v5.4.0-beta.2...v5.4.0-beta.3) (2025-12-02)


### Bug Fixes

* **cliproxy:** convert windows backslashes to forward slashes in config.yaml auth-dir ([a6663cb](https://github.com/kaitranntt/ccs/commit/a6663cbd0471d1a08e8bbcdea897760b434ae937)), closes [#36](https://github.com/kaitranntt/ccs/issues/36)

# [5.4.0-beta.2](https://github.com/kaitranntt/ccs/compare/v5.4.0-beta.1...v5.4.0-beta.2) (2025-12-02)


### Bug Fixes

* **auth:** prevent default profile from using stale glm env vars ([13d13da](https://github.com/kaitranntt/ccs/commit/13d13dab516332bc17345dc77afd44ae48bdd2aa)), closes [#37](https://github.com/kaitranntt/ccs/issues/37)

# [5.4.0-beta.1](https://github.com/kaitranntt/ccs/compare/v5.3.0...v5.4.0-beta.1) (2025-12-02)


### Bug Fixes

* **cliproxy:** improve qwen oauth error handling ([7e0b0fe](https://github.com/kaitranntt/ccs/commit/7e0b0feca8ce2ed5d505c5bf6c84e54c6df8839e)), closes [#29](https://github.com/kaitranntt/ccs/issues/29)
* **cliproxy:** use double-dash flags for cliproxyapi auth ([#24](https://github.com/kaitranntt/ccs/issues/24)) ([4c81f28](https://github.com/kaitranntt/ccs/commit/4c81f28f0b67ef92cf74d0f5c13a5943ff0a7f00))
* **deps:** add chalk, boxen, gradient-string, listr2 as dependencies ([a214749](https://github.com/kaitranntt/ccs/commit/a214749725cfe05612e2c84cefa2ab3f619c6a2e))
* **glmt:** handle 401 errors and headers-already-sent exception ([#30](https://github.com/kaitranntt/ccs/issues/30)) ([c953382](https://github.com/kaitranntt/ccs/commit/c95338232a37981b95b785b47185ce18d6d94b7a)), closes [#26](https://github.com/kaitranntt/ccs/issues/26)
* **prompt:** improve password input handling with raw mode and buffer support ([bc56d2e](https://github.com/kaitranntt/ccs/commit/bc56d2e135532b2ae443144dd42217b26bcba951))


### Features

* **cliproxy:** add qwen code oauth provider support ([#31](https://github.com/kaitranntt/ccs/issues/31)) ([a3f1e52](https://github.com/kaitranntt/ccs/commit/a3f1e52ac68600ba0806d67aacceb6477ffa3543)), closes [#29](https://github.com/kaitranntt/ccs/issues/29)
* **cliproxy:** auto-update cliproxyapi to latest release on startup ([8873ccd](https://github.com/kaitranntt/ccs/commit/8873ccd981679e8acff8965accdc22215c6e4aa2))
* **profile:** add profile command with configuration display ([53d7a15](https://github.com/kaitranntt/ccs/commit/53d7a15c047e760723e051dc0f7be3c0dd42d087))
* **shell-completion:** add --force flag and fix zsh profile coloring ([7faed1d](https://github.com/kaitranntt/ccs/commit/7faed1d84ba29ba02bf687bae5b3458617512e67))
* **ui:** add central ui abstraction layer for cli styling ([6e49e0e](https://github.com/kaitranntt/ccs/commit/6e49e0e7e157abd4a38c98553dbe3c16473b57d9))
* **ui:** enhance auth commands with new ui layer ([6f42a65](https://github.com/kaitranntt/ccs/commit/6f42a6527b1bf02cbf29ec23525c9f27af6f0c98))
* **ui:** enhance delegation with listr2 task lists and styled output ([716193a](https://github.com/kaitranntt/ccs/commit/716193a682a1504767c7f32409a0de51278242eb))
* **ui:** enhance doctor and error manager with new ui layer ([57016f3](https://github.com/kaitranntt/ccs/commit/57016f3f765f207915161514e1827b18c0b03d5c))
* **ui:** enhance help and profile commands with new ui layer ([f3ed359](https://github.com/kaitranntt/ccs/commit/f3ed359050ce66d96c0109cf60c242bfd092114d))
* **ui:** enhance section headers with gradient and rename profile to api ([073a5e1](https://github.com/kaitranntt/ccs/commit/073a5e15ee8f895d7485864526d8946b774bb728))

# [5.3.0](https://github.com/kaitranntt/ccs/compare/v5.2.1...v5.3.0) (2025-12-01)


### Features

* **profile,shell-completion,prompt:** add profile commands and improve input handling ([#34](https://github.com/kaitranntt/ccs/issues/34)) ([7ec8cc8](https://github.com/kaitranntt/ccs/commit/7ec8cc83690a595bba9bb5f62fb3b9fa6b6a2f8f)), closes [#24](https://github.com/kaitranntt/ccs/issues/24) [#30](https://github.com/kaitranntt/ccs/issues/30) [#26](https://github.com/kaitranntt/ccs/issues/26) [#31](https://github.com/kaitranntt/ccs/issues/31) [#29](https://github.com/kaitranntt/ccs/issues/29) [#29](https://github.com/kaitranntt/ccs/issues/29)

# [5.3.0-beta.4](https://github.com/kaitranntt/ccs/compare/v5.3.0-beta.3...v5.3.0-beta.4) (2025-12-01)


### Bug Fixes

* **cliproxy:** improve qwen oauth error handling ([#33](https://github.com/kaitranntt/ccs/issues/33)) ([1c3374f](https://github.com/kaitranntt/ccs/commit/1c3374f6a7e4440e299d49b58808c6454b4547c2)), closes [#29](https://github.com/kaitranntt/ccs/issues/29)

# [5.3.0-beta.3](https://github.com/kaitranntt/ccs/compare/v5.3.0-beta.2...v5.3.0-beta.3) (2025-12-01)


### Bug Fixes

* **prompt:** improve password input handling with raw mode and buffer support ([bc56d2e](https://github.com/kaitranntt/ccs/commit/bc56d2e135532b2ae443144dd42217b26bcba951))


### Features

* **profile:** add profile command with configuration display ([53d7a15](https://github.com/kaitranntt/ccs/commit/53d7a15c047e760723e051dc0f7be3c0dd42d087))
* **shell-completion:** add --force flag and fix zsh profile coloring ([7faed1d](https://github.com/kaitranntt/ccs/commit/7faed1d84ba29ba02bf687bae5b3458617512e67))

## [5.2.1](https://github.com/kaitranntt/ccs/compare/v5.2.0...v5.2.1) (2025-12-01)


### Bug Fixes

* **cliproxy:** improve qwen oauth error handling ([#33](https://github.com/kaitranntt/ccs/issues/33)) ([1c3374f](https://github.com/kaitranntt/ccs/commit/1c3374f6a7e4440e299d49b58808c6454b4547c2)), closes [#29](https://github.com/kaitranntt/ccs/issues/29)

# [5.3.0-beta.2](https://github.com/kaitranntt/ccs/compare/v5.3.0-beta.1...v5.3.0-beta.2) (2025-12-01)


### Bug Fixes

* **cliproxy:** improve qwen oauth error handling ([7e0b0fe](https://github.com/kaitranntt/ccs/commit/7e0b0feca8ce2ed5d505c5bf6c84e54c6df8839e)), closes [#29](https://github.com/kaitranntt/ccs/issues/29)

# [5.3.0-beta.1](https://github.com/kaitranntt/ccs/compare/v5.2.0...v5.3.0-beta.1) (2025-12-01)


### Bug Fixes

* **cliproxy:** use double-dash flags for cliproxyapi auth ([#24](https://github.com/kaitranntt/ccs/issues/24)) ([4c81f28](https://github.com/kaitranntt/ccs/commit/4c81f28f0b67ef92cf74d0f5c13a5943ff0a7f00))
* **glmt:** handle 401 errors and headers-already-sent exception ([#30](https://github.com/kaitranntt/ccs/issues/30)) ([c953382](https://github.com/kaitranntt/ccs/commit/c95338232a37981b95b785b47185ce18d6d94b7a)), closes [#26](https://github.com/kaitranntt/ccs/issues/26)


### Features

* **cliproxy:** add qwen code oauth provider support ([#31](https://github.com/kaitranntt/ccs/issues/31)) ([a3f1e52](https://github.com/kaitranntt/ccs/commit/a3f1e52ac68600ba0806d67aacceb6477ffa3543)), closes [#29](https://github.com/kaitranntt/ccs/issues/29)
* **cliproxy:** auto-update cliproxyapi to latest release on startup ([8873ccd](https://github.com/kaitranntt/ccs/commit/8873ccd981679e8acff8965accdc22215c6e4aa2))

# [5.2.0](https://github.com/kaitranntt/ccs/compare/v5.1.1...v5.2.0) (2025-12-01)


### Features

* **release:** trigger v5.2.0 release ([7b65374](https://github.com/kaitranntt/ccs/commit/7b65374100196562a4f83705c8626fc7e6bb35d6))

## [5.1.1](https://github.com/kaitranntt/ccs/compare/v5.1.0...v5.1.1) (2025-12-01)


### Bug Fixes

* **cliproxy:** use double-dash flags for cliproxyapi auth ([9489884](https://github.com/kaitranntt/ccs/commit/94898848ea4533dcfc142e1b6c9bf939ba655537))

## [5.1.1-beta.1](https://github.com/kaitranntt/ccs/compare/v5.1.0...v5.1.1-beta.1) (2025-12-01)


### Bug Fixes

* **cliproxy:** use double-dash flags for cliproxyapi auth ([#24](https://github.com/kaitranntt/ccs/issues/24)) ([4c81f28](https://github.com/kaitranntt/ccs/commit/4c81f28f0b67ef92cf74d0f5c13a5943ff0a7f00))

# [5.1.0](https://github.com/kaitranntt/ccs/compare/v5.0.2...v5.1.0) (2025-12-01)


### Bug Fixes

* **ci:** use pat token to bypass branch protection ([04af7e7](https://github.com/kaitranntt/ccs/commit/04af7e7c09edbc4207f332e7a613d92df1f2fea1))


### Features

* **release:** implement semantic versioning automation with conventional commits ([d3d9637](https://github.com/kaitranntt/ccs/commit/d3d96371def7b5b44d6133ad50d86c934cdf1ad4))

# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/)

## [5.0.0] - 2025-11-28

### Added
- **CLIProxy OAuth Profiles**: Three new zero-config profiles powered by CLIProxyAPI
  - `ccs gemini` - Google Gemini via OAuth (zero config)
  - `ccs codex` - OpenAI Codex via OAuth (zero config)
  - `ccs agy` - Antigravity (AGY) via OAuth (zero config)

- **Download-on-Demand Binary**: CLIProxyAPI binary (~15MB) downloads automatically on first use
  - Supports 6 platforms: darwin/linux/windows × amd64/arm64
  - SHA256 checksum verification
  - 3x retry with exponential backoff
  - No npm package size impact

- **OAuth Authentication System** (`src/cliproxy/auth-handler.ts`):
  - Browser-based OAuth flow with automatic token storage
  - Headless mode fallback (`ccs gemini --auth --headless`)
  - Token storage in `~/.ccs/cliproxy-auth/<provider>/`
  - 2-minute OAuth timeout protection

- **CLIProxy Diagnostics** in `ccs doctor`:
  - Binary installation status + version
  - Config file validation
  - OAuth status per provider (gemini/codex/agy)
  - Port 8317 availability check

- **Enhanced Error Messages** (`src/utils/error-manager.ts`):
  - OAuth timeout troubleshooting
  - Port conflict resolution
  - Binary download failure with manual URL

- **New CLIProxy Module** (`src/cliproxy/`):
  - `binary-manager.ts` - Download, verify, extract binary
  - `platform-detector.ts` - OS/arch detection for 6 platforms
  - `cliproxy-executor.ts` - Spawn/kill proxy pattern
  - `config-generator.ts` - Generate config.yaml per provider
  - `auth-handler.ts` - OAuth token management
  - `types.ts` - TypeScript type definitions
  - `index.ts` - Central exports

### Changed
- **Profile Detection**: New priority order
  1. CLIProxy profiles (gemini, codex, agy)
  2. Settings-based profiles (glm, glmt, kimi)
  3. Account-based profiles (work, personal)
  4. Default Claude CLI
- **Help Text**: Updated with new OAuth profiles (alphabetically sorted)
- **Profile Detector**: Added `cliproxy` profile type

### Technical Details
- **Binary Version**: CLIProxyAPI v6.5.27
- **Default Port**: 8317 (TCP polling for readiness, no PROXY_READY signal)
- **Model Mappings**:
  - Gemini: gemini-2.0-flash (opus: thinking-exp, haiku: flash-lite)
  - Codex: gpt-4o (opus: o1, haiku: gpt-4o-mini)
  - Antigravity: agy (sonnet: agy-pro, haiku: agy-turbo)
- **Storage**:
  - Binary: `~/.ccs/bin/cliproxyapi`
  - Tokens: `~/.ccs/cliproxy-auth/<provider>/`
  - Config: `~/.ccs/cliproxy.config.yaml`

### Migration
- **No breaking changes**: All existing profiles (glm, glmt, kimi, accounts) work unchanged
- **Zero configuration**: OAuth profiles work out-of-box after browser login
- **Backward compatible**: v4.x commands and workflows unchanged

---

## [4.5.0] - 2025-11-27 (Phase 02 Complete)

### Changed
- **Modular Command Architecture**: Complete refactoring of command handling system
  - Main entry point (src/ccs.ts) reduced from 1,071 to 593 lines (**44.6% reduction**)
  - 6 command handlers extracted to dedicated modules in `src/commands/`
  - Enhanced maintainability through single responsibility principle
  - Command handlers can now be developed and tested independently

### Added
- **Modular Command Handlers** (`src/commands/`):
  - `version-command.ts` (3.0KB) - Version display functionality
  - `help-command.ts` (4.9KB) - Comprehensive help system
  - `install-command.ts` (957B) - Installation/uninstallation workflows
  - `doctor-command.ts` (415B) - System diagnostics
  - `sync-command.ts` (1.0KB) - Configuration synchronization
  - `shell-completion-command.ts` (2.1KB) - Shell completion management

- **New Utility Modules** (`src/utils/`):
  - `shell-executor.ts` (1.5KB) - Cross-platform shell command execution
  - `package-manager-detector.ts` (3.8KB) - Package manager detection (npm, yarn, pnpm, bun)

- **TypeScript Type System**:
  - `src/types/` directory with comprehensive type definitions
  - Standardized `CommandHandler` interface for all commands
  - 100% TypeScript coverage across all new modules

### Improved
- **Maintainability**: Each command now has focused, dedicated module
- **Testing Independence**: Command handlers can be unit tested in isolation
- **Development Workflow**: Multiple developers can work on different commands simultaneously
- **Code Navigation**: Developers can quickly locate specific command logic
- **Future Extension**: New commands can be added without modifying main orchestrator

### Technical Details
- **Zero Breaking Changes**: All existing functionality preserved
- **Performance**: No degradation, minor improvement due to smaller main file
- **Quality Gates**: All Phase 01 ESLint strictness rules maintained
- **Type Safety**: Comprehensive TypeScript coverage with zero `any` types
- **Interface Consistency**: All commands follow standardized `CommandHandler` interface

## [4.4.0] - 2025-11-23

### Changed
- **BREAKING**: settings.json now shared across profiles via symlinks
  - Each profile previously had isolated settings.json
  - Now all profiles share ~/.claude/settings.json
  - Migration automatic on install (uses ~/.claude/settings.json)
  - Backups created: `<instance>/settings.json.pre-shared-migration`
  - Rollback: restore backup manually if needed

### Added
- Doctor validates settings.json symlink integrity
- Sync repairs broken settings.json symlinks
- Migration from isolated to shared settings (automatic)

### Fixed
- Consistent shared data architecture across all .claude/ items

## [4.3.10] - 2025-11-23

### Fixed
- **Update Cache Issue**: Fixed `ccs update` serving cached package versions instead of fresh downloads
- Package manager cache is now automatically cleared before updating
- Update now ensures users always receive the latest version from registry

### Technical Details
- **Node.js (bin/ccs.js)**: Added cache clearing for npm, yarn, pnpm before update
  - npm: `npm cache clean --force`
  - yarn: `yarn cache clean`
  - pnpm: `pnpm store prune`
  - bun: No explicit cache clearing needed
- **Bash (lib/ccs)**: Added `npm cache clean --force` before npm update
- **PowerShell (lib/ccs.ps1)**: Added `npm cache clean --force` before npm update
- **Non-blocking**: Update continues even if cache clearing fails (with warning)
- **Manual fallback commands**: Updated to include cache clearing step

### Impact
- Users no longer need to manually run `npm cache clean --force` before `ccs update`
- Resolves issue where update reported success but installed cached/outdated version
- Ensures fresh package downloads from npm registry on every update

## [4.3.8] - 2025-11-23

### Fixed
- **ora v9 Compatibility**: Fixed "ora is not a function" errors in `ccs doctor` and installer utilities
- Properly handle ora v9+ ES module format when using CommonJS `require()`
- All spinner-based operations now work correctly with ora v9.0.0

### Technical Details
- ora v9+ is an ES module, requiring `.default` property access in CommonJS
- Updated import: `const oraModule = require('ora'); ora = oraModule.default || oraModule`
- Fallback spinner implementation ensures graceful degradation when ora is unavailable
- Affects: `bin/management/doctor.js`, `bin/utils/claude-dir-installer.js`, `bin/utils/claude-symlink-manager.js`
- Impact: `ccs doctor` command and postinstall scripts now work correctly with latest ora version

## [4.3.7] - 2025-11-23

### Fixed
- **Postinstall Script**: Fixed missing `~/.ccs/.claude/` directory during `npm install`
- Made `ora` dependency optional in `ClaudeDirInstaller` and `ClaudeSymlinkManager`
- Postinstall script now gracefully handles missing `ora` module during installation
- Ensures `.claude/` directory and symlinks are properly created even when `ora` is unavailable

### Technical Details
- Root cause: `ora` module not available during `npm install` postinstall execution
- Solution: Optional require with fallback to `console.log` when `ora` is unavailable
- Affects: `bin/utils/claude-dir-installer.js`, `bin/utils/claude-symlink-manager.js`
- Impact: All npm installations now properly create `~/.ccs/.claude/` and CCS symlinks

## [4.3.6] - 2025-11-23

### Added
- **Plugin Support**: Claude Code plugins now shared across all CCS profiles via `~/.ccs/shared/plugins/`
- Symlink architecture: `~/.claude/plugins/` ← `~/.ccs/shared/plugins/` ← `instance/plugins/`
- Install plugins once, use across GLM, GLMT, Kimi, and all Claude accounts
- Cross-platform support with Windows fallback (copy mode)

## [4.3.5] - 2025-11-22

### Changed
- **Deprecated Agent Cleanup**: Removed deprecated `ccs-delegator.md` agent file from installations
- Enhanced installation process to automatically clean up obsolete files
- Improved `ccs sync` command with migration logic for deprecated components

### Removed
- **ccs-delegator.md**: Agent file deprecated in favor of `ccs-delegation` skill (v4.3.2)
- Clean up of package copy in `~/.ccs/.claude/agents/ccs-delegator.md`
- Clean up of user symlink in `~/.claude/agents/ccs-delegator.md`

### Added
- Automatic migration marker system for tracking cleanup completion
- Intelligent backup system for user-modified deprecated files
- Version-aware migration logic following existing patterns

### Migration
- **Automatic**: Users upgrading from v4.3.2 or earlier will have deprecated files cleaned up automatically
- **Manual**: Run `ccs sync` to trigger cleanup manually
- **Backups**: User-modified files are backed up with timestamp before removal
- **Idempotent**: Cleanup is safe to run multiple times

### Technical Details
- Integrated into `npm postinstall` script for automatic cleanup on package updates
- Added to `ccs sync` command for manual cleanup operations
- Uses migration markers in `~/.ccs/.migrations/v435-delegator-cleanup`
- Follows existing SharedManager migration patterns for consistency

## [4.3.4] - 2025-11-22

### Fixed
- **CCS Update Command**: Enhanced `ccs update` to support multiple package managers
- Added automatic detection for npm, yarn, pnpm, and bun package managers
- Update commands now use the appropriate package manager automatically
- Improved installation method detection for more reliable updates

## [4.3.3] - 2025-11-21

### ⚠️ BREAKING CHANGES

- **CCS Delegation Commands Consolidated**: Replaced 4 hardcoded commands with 2 intelligent commands
  - Old: `/ccs:glm`, `/ccs:kimi`, `/ccs:glm:continue`, `/ccs:kimi:continue`
  - New: `/ccs` (auto-selects profile), `/ccs:continue` (auto-detects profile)
  - Override with flags: `/ccs --glm "task"`, `/ccs --kimi "task"`

### Changed
- Updated `--help` text across Node.js, Bash, and PowerShell implementations
- Updated delegation examples in README.md and workflow documentation
- Fixed CCS Doctor health checks to validate new command files
- Updated user configuration templates with new command syntax

### Added
- Intelligent profile selection based on task analysis (reasoning, long-context, cost-optimized)
- Support for custom profiles without creating new commands
- Enhanced session management with automatic profile detection

### Migration
| Old Command | New Command |
|-------------|-------------|
| `/ccs:glm "task"` | `/ccs "task"` (or `/ccs --glm "task"`) |
| `/ccs:kimi "task"` | `/ccs "task"` (or `/ccs --kimi "task"`) |
| `/ccs:glm:continue` | `/ccs:continue` |
| `/ccs:kimi:continue` | `/ccs:continue` |

---

## [4.1.5] - 2025-11-17

### Added
- **Sync command** (`ccs sync`) for updating delegation commands and skills
- **Short flag** `-sc` for `--shell-completion` command
- **Enhanced version display** with delegation status information

### Changed
- **Auth help text** now emphasizes concurrent account usage across all platforms
- **Help text standardization** ensures consistent messaging across bash, PowerShell, and Node.js
- **Description text** emphasizes running different Claude CLI sessions concurrently
- **GitHub documentation links** updated to stable permalinks
- **Shell completions** updated to include sync command and -sc flag

### Fixed
- **Inconsistent help text** across different platform implementations
- **Outdated description** text to emphasize concurrent sessions over specific examples

---

## [4.1.4] - 2025-11-17

### Fixed
- **Shell completion ENOTDIR errors** when parent path conflicts with existing files
- **Zsh completion syntax errors** with _alternative and _describe functions
- **Reversed color application** in zsh completion (commands vs descriptions)

### Added
- **Enhanced shell completion UI/UX** with descriptions and grouping
- **Color-coded completions** for zsh and fish shells
- **Custom settings profile support** in shell completions
- **Improved completion formatting** with section headers and separators

### Changed
- **Generalized help text** removed specific account examples for broader applicability
- **Delegation help section** clarified context and removed non-existent commands
- **Shell completion organization** grouped by categories (commands, model profiles, account profiles)

---

## [4.1.3] - 2025-11-17

### Fixed
- **Doctor command delegation check false positive**
  - Fixed `ccs doctor` incorrectly checking for delegation commands in `~/.ccs/shared/commands/ccs/` instead of `~/.ccs/.claude/commands/ccs/`
  - Removed check for non-existent `create.md` file
  - Now correctly detects installed delegation commands (glm.md, kimi.md) after npm install
  - Users will no longer see "[!] Delegation commands not found" warning when delegation is properly installed

---

## [4.1.2] - 2025-11-16

### Fixed
- **Kimi API 401 errors** caused by deprecated model fields
  - Removed `ANTHROPIC_MODEL`, `ANTHROPIC_SMALL_FAST_MODEL`, `ANTHROPIC_DEFAULT_OPUS_MODEL`, `ANTHROPIC_DEFAULT_SONNET_MODEL`, `ANTHROPIC_DEFAULT_HAIKU_MODEL` from Kimi settings
  - Kimi API update now rejects requests with these fields (previously optional, now break authentication)
  - Automatic migration removes deprecated fields from existing `~/.ccs/kimi.settings.json`
  - Preserves user API keys and custom settings during migration
  - Updated `config/base-kimi.settings.json` template
  - Users experiencing 401 errors will be automatically fixed on next install/update

### Changed
- Kimi settings now minimal: only `ANTHROPIC_BASE_URL` and `ANTHROPIC_AUTH_TOKEN` required

---

## [4.1.1] - 2025-11-16

### Fixed
- **npm install fails to copy .claude/ directory** to `~/.ccs/.claude/`
  - Error: "[!] CCS .claude/ directory not found, skipping symlink installation"
  - Created `bin/utils/claude-dir-installer.js` utility to copy `.claude/` from package
  - Updated `scripts/postinstall.js` to copy `.claude/` before creating symlinks
  - Updated `ccs update` command to re-install `.claude/` directory
  - Supports Node.js 14+ with fallback for versions < 16.7.0

### Added
- `ClaudeDirInstaller` utility class for managing `.claude/` directory installation

---

## [4.1.0] - 2025-11-16

### Added
- **Selective .claude/ directory symlinking** for shared resources across profiles
- `claude-symlink-manager.js` utility for managing symlinks with Windows fallback
- Enhanced `ccs doctor` command to verify .claude/ directory health
- Postinstall script for automatic .claude/ directory setup
- **Stream-JSON output** for real-time delegation visibility (`--output-format stream-json --verbose`)
- **Real-time tool tracking** with verbose context (shows file paths, commands, patterns)
- **Smart slash command detection** (preserves /cook, /plan, /commit in delegated prompts)
- **Signal handling** (Ctrl+C/Esc kills delegated child processes, prevents orphans)
- **Comprehensive tool support** (13 Claude Code tools: Bash, Read, Write, Edit, Glob, Grep, NotebookEdit, NotebookRead, SlashCommand, Task, TodoWrite, WebFetch, WebSearch)
- **Active task display** for TodoWrite (shows current task instead of count)
- Documentation: Stream-JSON workflow diagrams

### Changed
- Installers now create selective symlinks (commands/, skills/, agents/) instead of full directory copies
- Windows support: Falls back to directory copying when symlinks unavailable
- Profile-specific files (settings.json, sessions/, todolists/, logs/) remain isolated
- Improved README with symlink architecture documentation
- **BREAKING**: Delegation now uses stream-json instead of single JSON blob
- **Time-based limits** replace turn-based limits (10min default timeout vs 20 max-turns)
- **Graceful termination** with SIGTERM → SIGKILL fallback (2s grace period)
- Removed `--max-turns` flag (deprecated, use timeout instead)
- Simplified slash command docs (removed over-prescriptive instructions)
- Internal tools (TodoWrite, Skill) now show meaningful progress

### Fixed
- Duplicate .claude/ resources across multiple profiles
- Installer logic now handles symlink creation during setup
- Orphaned `claude -p` processes after parent termination
- Slash commands broken by IMPORTANT safety prefix
- Slash commands detected as file paths (/home vs /cook)
- Stream-json requires `--verbose` flag with `-p`
- Tool output spam (filtered internal tools, show active tasks)

### Removed
- IMPORTANT safety prefix (broke slash command positioning)
- Outdated test files (json-output.test.js, max-turns.test.js)
- TTY detection (now shows progress unless CCS_QUIET=1)

---

## [3.5.0] - 2025-11-15

### Added
- Shell auto-completion (bash, zsh, PowerShell, Fish)
- `--shell-completion` command (auto-installs for detected shell with proper comment markers, cross-platform)
- Error codes (E101-E901) with documentation at docs/errors/
- Fuzzy matching "Did you mean?" suggestions (Levenshtein distance)
- Progress indicators (doctor command: [n/9] counter, GLMT proxy startup spinner)
- Interactive confirmation prompts for destructive operations
- `--yes/-y` flag for automation (skips confirmations)
- `--json` flag for auth commands (list, show)
- Impact display (session count, paths) before profile deletion
- Comprehensive test suite (15 tests, 100% pass rate)

### Changed
- Error boxes: Unicode (╔═╗) → ASCII (===) for cross-platform compatibility
- JSON output uses CCS version (3.5.0) instead of separate schema version
- Help text includes EXAMPLES section across all platforms
- Test suite properly counts test cases (not assertions)

### Fixed
- Standalone installer dependency handling (now downloads error-codes, progress-indicator, prompt files)
- `--yes` flag bug (returned false instead of true, preventing auto-confirmation)
- Help text consistency between Node.js and bash versions (added Uninstall section to bash)
- Test pass rate calculation (now excludes skipped tests from denominator)
- Help section comparison (locale-specific sort order)

---

## [3.4.6] - 2025-11-12

### Added
- GLMT ReasoningEnforcer: Prompt injection + API params hybrid (4 effort levels, always enabled)

### Changed
- Added GLMT production warnings (NOT PRODUCTION READY)
- Streamlined CLAUDE.md (-337 lines)
- Simplified GLMT controls: 4 mechanisms → 3 automatic
- Locale + reasoning enforcement now always enabled

### Removed
- GLMT Budget Calculator mechanism (consolidated into automatic controls)
- Deprecated GLMT environment variables (`CCS_GLMT_FORCE_ENGLISH`, `CCS_GLMT_THINKING_BUDGET`, `CCS_GLMT_STREAMING`)
- Outdated test scenarios for removed environment variables

---

## [3.4.5] - 2025-11-11

### Fixed
- Thinking block signature timing race (blocks appeared blank in Claude CLI UI)
- Content verification guard in `_createSignatureDeltaEvent()` returns null if empty

### Changed
- Consolidated debug flags: `CCS_DEBUG_LOG`, `CCS_GLMT_DEBUG` → `CCS_DEBUG` only

### Added
- 6 regression tests for thinking signature race (`test-thinking-signature-race.js`)

---

## [3.4.4] - 2025-11-11

### Fixed
- Postinstall symlink creation (fixed require path to shared-manager.js)

---

## [3.4.3] - 2025-11-11

### Added
- Keyword thinking control: `think` < `think hard` < `think harder` < `ultrathink`
- Streaming auto-fallback on error

### Changed
- YAGNI/KISS: Removed budget-calculator.js, task-classifier.js (-272 LOC)
- `CCS_DEBUG_LOG` → `CCS_DEBUG` (backward compatible)

### Removed
- `CCS_GLMT_THINKING_BUDGET`, `CCS_GLMT_STREAMING`, `CCS_GLMT_FORCE_ENGLISH` env vars

### Fixed
- GLMT proxy path (glmt/glmt-proxy.js)
- `ultrathink` effort: `high` → `max`

---

## [3.4.2] - 2025-11-11

### Changed
- Version bump for npm CI workaround

---

## [3.4.1] - 2025-11-11

### Added
- GLMT loop prevention (locale enforcer, budget calculator, task classifier, loop detector)
- Env vars: `CCS_GLMT_FORCE_ENGLISH`, `CCS_GLMT_THINKING_BUDGET`
- 110 GLMT tests (all passing)

### Changed
- Directory structure: bin/{glmt,auth,management,utils}, tests/{unit,integration}
- Token savings: 50-80% for execution tasks

### Fixed
- Thinking parameter processing from Claude CLI
- GLMT tool support (MCP tools, function calling)
- Unbounded planning loops (20+ min → <2 min)
- Chinese output issues

---

## [3.4.0] - 2025-11-11

### Added
- GLMT streaming (5-20x faster TTFB: <500ms vs 2-10s)
- SSEParser, DeltaAccumulator classes
- Security limits (1MB SSE, 10MB content, 100 blocks)

---

## [3.3.0] - 2025-11-11

### Added
- Debug mode: `CCS_DEBUG_LOG=1`
- Verbose flag: `ccs glmt --verbose`
- GLMT config defaults

---

## [3.2.0] - 2025-11-10

### Changed
- **BREAKING**: Symlink-based shared data (was copy-based)
- ~/.ccs/shared/ → ~/.claude/ symlinks
- 60% faster installs

---

## [3.1.1] - 2025-11-10

### Fixed
- Migration now runs during install (not on first `ccs` execution)

---

## [3.1.0] - 2025-11-10

### Added
- Shared data architecture (commands/skills/agents shared across profiles)

---

## [3.0.2] - 2025-11-10

### Fixed
- Profile creation no longer auto-sets as default
- Help text simplified (40% shorter)

---

## [3.0.1] - 2025-11-10

### Added
- Auto-recovery system for missing/corrupted configs
- `ccs doctor` health check command
- ErrorManager class

---

## [3.0.0] - 2025-11-09

### Added
- **Multi-account switching**: Run multiple Claude accounts concurrently
- Auth commands: create, list, show, remove, default
- Profile isolation (sessions, todos, logs per profile)

### BREAKING
- Removed v2.x vault encryption
- Login-per-profile model

---

## [2.5.1] - 2025-11-07
### Added
- Kimi `ANTHROPIC_SMALL_FAST_MODEL` support

## [2.5.0] - 2025-11-07
### Added
- Kimi integration

## [2.4.9] - 2025-11-05
### Fixed
- Node.js DEP0190 warning

## [2.4.8] - 2025-11-05
### Fixed
- Deprecation warning (platform-specific shell)

## [2.4.7] - 2025-11-05
### Fixed
- Windows spawn EINVAL error

## [2.4.6] - 2025-11-05
### Fixed
- Color detection, TTY handling

## [2.4.5] - 2025-11-05
### Added
- Performance benchmarks (npm vs shell)

## [2.4.3] - 2025-11-04
### Fixed
- **CRITICAL**: DEP0190 command injection vulnerability

## [2.4.2] - 2025-11-04
### Changed
- Version bump for republish

## [2.4.1] - 2025-11-04
### Fixed
- **CRITICAL**: Windows PATH detection
- PowerShell terminal termination

## [2.4.0] - 2025-11-04
### Added
- npm package support
### BREAKING
- Executables moved to lib/

## [2.3.1] - 2025-11-04
### Fixed
- PowerShell syntax errors

## [2.3.0] - 2025-11-04
### Added
- Custom Claude CLI path: `CCS_CLAUDE_PATH`

## [2.2.3] - 2025-11-03
### Added
- `ccs --uninstall` command

## [2.2.2] - 2025-11-03
### Fixed
- `ccs --install` via symlinks

## [2.2.1] - 2025-11-03
### Changed
- Hardcoded versions (no VERSION file)

## [2.2.0] - 2025-11-03
### Added
- Auto PATH configuration
- Terminal colors (NO_COLOR support)
### Changed
- Unified install: ~/.local/bin (Unix)
### Fixed
- **CRITICAL**: Shell injection vulnerability

## [2.1.0] - 2025-11-02
### Changed
- Windows uses --settings flag (27% code reduction)

## [2.0.0] - 2025-11-02
### BREAKING
- Removed `ccs son` profile
### Added
- Config templates, installers/ folder
### Fixed
- **CRITICAL**: PowerShell env var crash

## [1.1.0] - 2025-11-01
### Added
- Git worktrees support

## [1.0.0] - 2025-10-31
### Added
- Initial release
