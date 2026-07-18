#!/usr/bin/env bash
# Builds a clean, git-free zip of the repo — content-marketing-agent.zip — suitable for
# downloading and unpacking into a fresh folder to run your own instance.
#
# Uses `git archive`, so it bundles only tracked files at HEAD and NEVER includes the
# .git directory or local runtime state (server.log / server.pid are gitignored). The
# result unpacks into a top-level content-marketing-agent/ folder.
#
# Note: you usually don't need this — GitHub auto-generates the same kind of zip at
#   https://github.com/Waterbear-AI/content-marketing-agent/archive/refs/heads/main.zip
# which the Quickstart prompt uses. This script is for cutting a release asset or an
# offline copy from a specific commit.
set -e
cd "$(dirname "$0")/.."

OUT="content-marketing-agent.zip"
rm -f "$OUT"
git archive --format=zip --prefix=content-marketing-agent/ -o "$OUT" HEAD
echo "Built $OUT ($(du -h "$OUT" | cut -f1 | tr -d ' '))"
