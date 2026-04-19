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
app.get('/code-lab/admin', (req, res) => res.redirect(301, '/codelab/admin'));
app.get('/admin', (req, res) => res.redirect(301, '/codelab/admin'));
app.get('/admin/', (req, res) => res.redirect(301, '/codelab/admin'));
app.get('/code-lab/lesson/:slug', (req, res) => res.redirect(301, `/codelab/lesson/${encodeURIComponent(req.params.slug)}`));
app.get('/code-lab/lesson/:slug.html', (req, res) => res.redirect(301, `/codelab/lesson/${encodeURIComponent(req.params.slug)}`));

// Canonical auth + app routes (proxied to revised PyLearn)
if (hasPyLearnOrigin) {
  app.use('/codelab/login', makeProxy({ from: /^\/codelab\/login(?:\/.*)?$/, to: '/' }));
  app.use('/codelab/signup', makeProxy({ from: /^\/codelab\/signup(?:\/.*)?$/, to: '/' }));
  app.use('/codelab/dashboard', makeProxy({ from: /^\/codelab\/dashboard(?:\/.*)?$/, to: '/' }));
  app.use('/codelab/lesson', makeProxy({ from: /^\/codelab\/lesson(?:\/.*)?$/, to: '/' }));
  app.use('/codelab/admin', makeProxy({ from: /^\/codelab\/admin(?:\/.*)?$/, to: '/admin' }));
  app.use('/codelab/api', makeProxy({ from: /^\/codelab\/api/, to: '/api' }));

  // PyLearn serves FLL assessment images from /fll-assets.
  app.use('/fll-assets', makeProxy({ from: /^\/fll-assets/, to: '/fll-assets' }));

  // PyLearn frontend calls /api/*, so forward those requests to PyLearn too.
  app.use('/api', createProxyMiddleware({
    target: PYLEARN_ORIGIN,
    changeOrigin: true,
    xfwd: true,
    cookieDomainRewrite: '',
    pathRewrite: (pathName) => (pathName.startsWith('/api') ? pathName : `/api${pathName}`)
  }));
} else {
  console.warn('PYLEARN_ORIGIN is not set. PyLearn proxy routes are disabled and will return 503.');
  app.use('/codelab/login', requirePyLearnOrigin);
  app.use('/codelab/signup', requirePyLearnOrigin);
  app.use('/codelab/dashboard', requirePyLearnOrigin);
  app.use('/codelab/lesson', requirePyLearnOrigin);
  app.get('/codelab/admin', (req, res) => res.redirect(302, '/code-lab/admin.html'));
  app.use('/codelab/admin', requirePyLearnOrigin);
  app.use('/codelab/api', requirePyLearnOrigin);
  app.use('/fll-assets', requirePyLearnOrigin);
  app.use('/api', requirePyLearnOrigin);
}

// Static files for existing pages and assets
app.use(express.static(path.join(__dirname), { index: false }));

app.listen(PORT, () => console.log(`AI Future Platform running at http://localhost:${PORT}`));
