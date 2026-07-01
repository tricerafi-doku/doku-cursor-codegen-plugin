# DOKU Codegen Cursor Marketplace

Cursor plugin marketplace for DOKU code generation tooling.

## Included plugins

- **doku-codegen** — Generate DOKU API client code in any language. Cursor's Agent detects your tech stack, fetches live API specs from developers.doku.com, generates production code, and enforces quality/security via hooks. Supports Java, Kotlin, Python, Node.js, Go, PHP.

See `plugins/doku-codegen/README.md` for full setup and usage.

## Install from this marketplace

In Cursor:

1. Open **Customize** in the left sidebar.
2. Under **Repositories**, click the `+` icon.
3. Paste this repo URL:
   ```
   https://github.com/tricerafi-doku/doku-cursor-codegen-plugin
   ```
4. Search `doku` in Customize → Plugins and click **Add** on **DOKU Codegen**.
5. Fully restart Cursor.

## Local development install

```bash
git clone https://github.com/tricerafi-doku/doku-cursor-codegen-plugin.git
cd doku-cursor-codegen-plugin
mkdir -p ~/.cursor/plugins/local
cp -R plugins/doku-codegen ~/.cursor/plugins/local/doku-codegen
```

Restart Cursor, then confirm the plugin appears under **Customize → Plugins**.

> Cursor rejects symlinks pointing outside `~/.cursor/plugins/local/`. Use `cp -R` and re-copy after edits.

## Validate

```bash
node scripts/validate-template.mjs
```

Must print `Validation passed.`

## Adding a new plugin

See `docs/add-a-plugin.md`.
