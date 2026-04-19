# pylearn-revised

Place the revised PyLearn repository contents in this folder.

Suggested setup:

```bash
cd apps/pylearn-revised
git clone <your-pylearn-repo-url> .
```

After deploy, point AI Future gateway app env var to this app's frontend origin:

- apps/ai-future-platform/.env (or Render env)
- PYLEARN_ORIGIN=https://your-pylearn-frontend.example.com
