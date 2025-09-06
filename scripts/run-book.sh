#!/bin/zsh
cd "$(dirname "$0")/.."
/usr/bin/env -S PATH="/usr/local/bin:/opt/homebrew/bin:$PATH" npm run book >> run.log 2>&1
