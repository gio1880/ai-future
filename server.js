const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');
const app = express();
const PORT = process.env.PORT || 3000;
const PYLEARN_ORIGIN = process.env.PYLEARN_ORIGIN;
const hasPyLearnOrigin = Boolean(PYLEARN_ORIGIN);

const sendCodeLabLanding = (res) => res.sendFile(path.join(__dirname, 'code-lab.html'));

const requirePyLearnOrigin = (req, res, next) => {
  if (!hasPyLearnOrigin) {
    return res.status(503).json({
      error: 'PyLearn integration is not configured yet.',
      hint: 'Set PYLEARN_ORIGIN to your revised PyLearn frontend URL.'
    });
  }

  return next();
};

const makeProxy = (rewritePrefix) => createProxyMiddleware({
  target: PYLEARN_ORIGIN,
  changeOrigin: true,
  xfwd: true,
  cookieDomainRewrite: '',
  pathRewrite: (pathName) => pathName.replace(rewritePrefix.from, rewritePrefix.to)
});

// Canonical marketing and main routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/robotics-lab', (req, res) => res.sendFile(path.join(__dirname, 'robotics-lab.html')));
app.get(['/codelab', '/codelab/'], (req, res) => sendCodeLabLanding(res));

// Legacy compatibility redirects
app.get('/code-lab', (req, res) => res.redirect(301, '/codelab'));
app.get('/code-lab/', (req, res) => res.redirect(301, '/codelab'));
app.get('/code-lab.html', (req, res) => res.redirect(301, '/codelab'));
app.get('/code-lab/dashboard', (req, res) => res.redirect(301, '/codelab/dashboard'));
app.get('/code-lab/dashboard.html', (req, res) => res.redirect(301, '/codelab/dashboard'));
app.get('/code-lab/login', (req, res) => res.redirect(301, '/codelab/login'));
app.get('/code-lab/signup', (req, res) => res.redirect(301, '/codelab/signup'));
app.get('/code-lab/lesson/:slug', (req, res) => res.redirect(301, `/codelab/lesson/${encodeURIComponent(req.params.slug)}`));
app.get('/code-lab/lesson/:slug.html', (req, res) => res.redirect(301, `/codelab/lesson/${encodeURIComponent(req.params.slug)}`));

// Canonical auth + app routes (proxied to revised PyLearn)
app.use('/codelab/login', requirePyLearnOrigin, makeProxy({ from: /^\/codelab\/login(?:\/.*)?$/, to: '/' }));
app.use('/codelab/signup', requirePyLearnOrigin, makeProxy({ from: /^\/codelab\/signup(?:\/.*)?$/, to: '/' }));
app.use('/codelab/dashboard', requirePyLearnOrigin, makeProxy({ from: /^\/codelab\/dashboard(?:\/.*)?$/, to: '/' }));
app.use('/codelab/lesson', requirePyLearnOrigin, makeProxy({ from: /^\/codelab\/lesson(?:\/.*)?$/, to: '/' }));
app.use('/codelab/admin', requirePyLearnOrigin, makeProxy({ from: /^\/codelab\/admin(?:\/.*)?$/, to: '/admin' }));
app.use('/codelab/api', requirePyLearnOrigin, makeProxy({ from: /^\/codelab\/api/, to: '/api' }));

// PyLearn serves FLL assessment images from /fll-assets.
app.use('/fll-assets', requirePyLearnOrigin, makeProxy({ from: /^\/fll-assets/, to: '/fll-assets' }));

// PyLearn frontend calls /api/*, so forward those requests to PyLearn too.
app.use('/api', requirePyLearnOrigin, createProxyMiddleware({
  target: PYLEARN_ORIGIN,
  changeOrigin: true,
  xfwd: true,
  cookieDomainRewrite: '',
  pathRewrite: (pathName) => (pathName.startsWith('/api') ? pathName : `/api${pathName}`)
}));

// Static files for existing pages and assets
app.use(express.static(path.join(__dirname), { index: false }));

app.listen(PORT, () => console.log(`AI Future Platform running at http://localhost:${PORT}`));
