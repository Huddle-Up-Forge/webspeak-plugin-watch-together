# Watch Together / 视频同看

[![Validate](https://github.com/Huddle-Up-Forge/webspeak-plugin-watch-together/actions/workflows/verify.yml/badge.svg)](https://github.com/Huddle-Up-Forge/webspeak-plugin-watch-together/actions/workflows/verify.yml) · **API v2 · Node 22+ · AGPL-3.0-only**

API v2 application, version 2.0.0. Import [the package](packages/watch-together.wplugin), review and enable it. Each configured scope gets its own video timeline, participant list and optional host controls. Playback state is coordinated by the application's own backend, independently of skins and WebSpeak's voice transport.

## 使用

打开“插件功能 → Watch Together”，填入浏览器可直接播放的视频 URL。支持浏览器能解码的 MP4 / WebM 等媒体，不直接解析 YouTube、Bilibili 等视频网站页面，也不绕过登录、DRM 或网站访问限制。

播放、暂停、进度和倍速会同步给同一作用域的成员。新加入者自动赶上当前时间；浏览器阻止自动播放时，点击“允许在本机播放”。音量和静音只影响本机。提供播放控制、跳转、全屏、主持权交接、日夜模式及五种语言。

默认所有成员都可操作。管理员可在公开配置中设置：

```json
{"control":"host"}
```

此时仅主持人能更改共享播放。首位加入者成为主持人，可交接给其他成员；离开后自动选取仍在线的成员。主持权属于当前打开的面板，不是 TS 管理权限。

## Synchronization and storage

The backend timestamps playback on its own clock. Clients estimate clock offset, project the current position, correct larger drift by seeking and smaller drift by temporarily adjusting playback speed. Updates use revisions: conflicting edits return the latest state instead of silently overwriting one another. Buffering and network latency can still cause temporary differences; frame-perfect synchronization is not promised.

Room state is atomically saved under the plugin's `dataDir`, using a hash of the scope key for the filename. It survives backend restart and resumes paused at the stored position. No video file is stored or proxied. Each browser fetches the source directly and needs access to it; media codec, cookies, HTTPS/mixed-content and network restrictions still apply. Signed source URLs are visible to participants and stored as part of room state, so use URLs appropriate for sharing.

State is isolated by the actual scope supplied by WebSpeak. The backend permits at most 64 loaded rooms and 128 open participants, and bounds request sizes and rates. Idle empty room caches are released after 30 minutes; their persisted playback state remains. The application does not synchronize separate WebSpeak gateways or TS native clients.

## Independent development / 独立构建

This repository contains the complete browser application, Node backend, build tool and tests. It has no source-code dependency on WebSpeak or another plugin. No dependency installation is needed with Node 22 or later.

```sh
npm run build
npm test
npm run verify
```

Generated packages are stored in `packages/`. `plugin.json` describes the exact manifest, immutable package commit and SHA-256 consumed by the distribution catalog. Build and commit the source/package first, then generate metadata with `npm run metadata -- FULL_PACKAGE_COMMIT_SHA`, commit `plugin.json`, and push both commits. The metadata generator verifies the package bytes in the selected commit.

Requires the developing WebSpeak application runtime API v2. Verify that your target instance includes that runtime; stable v0.2.9 and API v1 are unsupported. Install through the [distribution catalog](https://github.com/Huddle-Up-Forge/webspeak-plugin), or import the local `.wplugin` in `/admin/plugins`, review the code and enable it.

[License](LICENSE)
