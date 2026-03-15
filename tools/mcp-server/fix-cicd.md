# Fix Kiuli CI/CD Pipeline — Claude CLI Prompt

Run this from the kiuli-website project root:

```bash
cd ~/Projects/kiuli-website
claude --print "$(cat tools/mcp-server/fix-cicd-prompt.txt)"
```

Or paste the contents of `fix-cicd-prompt.txt` directly into Claude CLI.
