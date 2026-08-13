<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/junkerderprovinz/firesquire/main/.github/assets/banner-dark.png">
    <img src="https://raw.githubusercontent.com/junkerderprovinz/firesquire/main/.github/assets/banner.png" alt="FireSquire" width="100%">
  </picture>
</p>

<p align="center">
  <a href="https://github.com/junkerderprovinz/firesquire/actions/workflows/release.yml"><img src="https://img.shields.io/github/actions/workflow/status/junkerderprovinz/firesquire/release.yml?label=Build&style=for-the-badge&logo=githubactions&logoColor=white" alt="Build" height="36"></a>&nbsp;
  <a href="https://github.com/junkerderprovinz/firesquire/actions/workflows/lint.yml"><img src="https://img.shields.io/github/actions/workflow/status/junkerderprovinz/firesquire/lint.yml?branch=main&label=Lint&style=for-the-badge&logo=githubactions&logoColor=white" alt="Lint" height="36"></a>&nbsp;
  <a href="https://unraid.net"><img src="https://img.shields.io/badge/Unraid-Plugin-f15a2c?style=for-the-badge&logo=unraid&logoColor=white" alt="Unraid Plugin" height="36"></a>&nbsp;
  <a href="https://github.com/junkerderprovinz/firesquire/releases"><img src="https://img.shields.io/github/v/release/junkerderprovinz/firesquire?style=for-the-badge&logo=github&logoColor=white&label=Release" alt="Release" height="36"></a>&nbsp;
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-AGPL--3.0-blue?style=for-the-badge&logo=gnu&logoColor=white" alt="License: AGPL-3.0" height="36"></a>
</p>

<p align="center">
An Unraid plugin that answers one question before you reboot: <b>will the box come back up clean?</b><br>
FireSquire reads the live host state and gives you a single verdict — <b>GO / CAUTION / NO-GO</b> — with the exact findings, so you never reboot into a known landmine. Advisory only: it reads, it never touches anything.
</p>

<p align="center">
A solo, free-time project. Bugs and ideas via <a href="https://github.com/junkerderprovinz/firesquire/issues">GitHub issues</a>; if it's useful to you, a coffee is always welcome.
</p>

<p align="center">
  <a href="https://buymeacoffee.com/junkerderprovinz">
    <img src="https://raw.githubusercontent.com/junkerderprovinz/firesquire/main/.github/assets/button-buy-me-a-coffee.svg" alt="Buy me a coffee" width="220">
  </a>
</p>

<br>

## Table of Contents

1. [What is this?](#1-what-is-this)
2. [Screenshots](#2-screenshots)
3. [What it checks](#3-what-it-checks)
4. [How it works](#4-how-it-works)
5. [Install](#5-install)
6. [Development](#6-development)
7. [License](#7-license)
8. [Support this project](#8-support-this-project)

<br>

## 1. What is this?

A reboot is never 100% guaranteed, but a large class of "it didn't come back right" is **predictable from the current live state**. FireSquire inspects that state before you reboot and gives you a single, honest verdict:

- **GO** — nothing found that should block a reboot
- **CAUTION** — non-fatal issues you should know about first
- **NO-GO** — conditions likely to make the reboot come back dirty

It is **advisory only**. It reads the system and reports. It never stops, mounts, unmounts, or changes anything — because acting on the host is exactly what tends to cause reboot trouble in the first place.

The plugin adds a **FireSquire** button next to *Reboot* on the **Main** tab, plus a **Settings → User Utilities → FireSquire** page with a short description. Click it and a **live progress bar** shows each check as it runs; then read the verdict and reboot with confidence. Each problem finding is a **click-through link** straight to the page where you fix it — syslog and disk/IO findings open the System Log viewer, array/parity/SMART/space findings open Main, running VMs open the VMs tab, and so on. The report follows your Unraid light/dark theme and **the language configured in the Unraid UI** (all 26 supported languages, English fallback).

<br>

## 2. Screenshots

<p align="center">
  <img src=".github/assets/screenshots/report.png" alt="FireSquire pre-reboot report with a CAUTION verdict" width="58%">
  <br><em>The pre-reboot report: a single GO / CAUTION / NO-GO verdict with the exact checks behind it. Advisory only — it never changes anything.</em>
</p>

<br>

<p align="center">
  <img src=".github/assets/screenshots/main-button.png" alt="FireSquire button next to Reboot on the Main tab" width="90%">
  <br><em>One click from the Main tab — the FireSquire button sits right next to Reboot.</em>
</p>

<br>

## 3. What it checks

**Critical — a failure here means NO-GO**

- Array started and clean (no disabled / invalid / missing disks)
- No parity check / sync / rebuild / clear in progress, mover not running
- No container mounting a host runtime directory (`/var/run`, `/run`, `/var/run/libvirt`, … — `docker.sock` excepted) — the bind class that can take libvirt/docker down on reboot
- No stuck `docker.img` / `libvirt.img` loop (attached-but-not-mounted, or a loop backing a deleted file)
- Flash `/boot` mounted and writable

**Caution — worth knowing before you reboot**

- Crashes since last boot in the syslog (segfault, general-protection-fault, OOM, kernel panic, call traces)
- Low free space on `/`, `/var/log` (both RAM), `docker.img`, cache
- VMs currently running (a reboot force-stops them)
- A core service down right now (dockerd / libvirtd / emhttpd)
- Container bind sources under `/mnt` that no longer exist
- SMART health (`smartctl -H`) on every disk

**Info** — uptime, kernel, Unraid version.

### Honest limits

This is an early-warning check, not an oracle. Genuine hardware, BIOS or timing failures during boot cannot be seen from a running system. What it *does* cover reliably is the state-detectable class: pinned mounts, stuck loops, an unclean array, in-flight array operations, a low-on-RAM or crash-looping box.

<br>

## 4. How it works

A single Bash engine (`firesquire-check.sh`) runs the checks by querying the tools Unraid already ships — `mdcmd`, `losetup`, `docker`, `smartctl`, `df`, `pgrep`. No daemon, no dependencies. It prints a human-readable report on a console, or machine-readable JSON for the WebGUI:

```bash
firesquire-check.sh          # human-readable report
firesquire-check.sh --json   # machine-readable (used by the WebGUI)
```

Exit code mirrors the verdict: `0` = GO, `1` = CAUTION, `2` = NO-GO.

The WebGUI layer is a small PHP page (`FireSquireReport.php`) that runs the engine and renders the verdict in an Unraid modal.

<br>

## 5. Install

**Community Apps** *(planned)* — search for **FireSquire** in the Apps tab.

**By URL (today):** Unraid → **Plugins** → **Install Plugin**, paste:

```
https://raw.githubusercontent.com/junkerderprovinz/firesquire/main/plugin/firesquire.plg
```

<br>

## 6. Development

The plugin files live under [`src/`](src/) mirroring the on-disk layout
(`/usr/local/emhttp/plugins/firesquire/`). The release `.txz` is built by CI on
a tagged push (`v*`) — built on Linux so executable bits are preserved.

Assets (icon, banner) are generated with
[`.github/assets/render-assets.mjs`](.github/assets/render-assets.mjs).

<br>

## 7. License

**Copyright (C) 2026 Junker der Provinz.**

FireSquire is free software under the **GNU Affero General Public License v3.0** (AGPL-3.0); see [LICENSE](LICENSE). You may run, study, share and modify it. If you distribute it, or run a modified version as a network service, you must release your source under the same AGPL-3.0 terms and keep the existing copyright and attribution notices intact.

**Name and branding are not licensed.** The AGPL covers the source code only. "FireSquire", its logo and its branding remain reserved: a fork or derivative must use its own distinct name and branding, and may not present itself as FireSquire. This keeps it unambiguous which project is the original.

<br>

## 8. Support this project

If FireSquire saved you a bad reboot, consider buying me a coffee. Thanks!

FireSquire is a one-person project. I write, test, and support it myself, in whatever free time is left after work. Found a bug or have an idea? Please [open a GitHub issue](https://github.com/junkerderprovinz/firesquire/issues) so it doesn't get lost.

If you'd like to support the time that goes into it, you're welcome to buy me a coffee. Genuinely appreciated either way.

<p align="center">
  <a href="https://buymeacoffee.com/junkerderprovinz">
    <img src="https://raw.githubusercontent.com/junkerderprovinz/firesquire/main/.github/assets/button-buy-me-a-coffee.svg" alt="Buy me a coffee" width="220">
  </a>
</p>
