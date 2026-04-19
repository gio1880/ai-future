const express = require('express');
const path = require('path');
const codeLabApp = require('./code-lab/server');
const app = express();
const PORT = process.env.PORT || 3000;
const sendCodeLabLanding = (res) => res.sendFile(path.join(__dirname, 'code-lab', 'code-lab.html'));
const sendCodeLabApp = (res) => res.sendFile(path.join(__dirname, 'code-lab', 'index.html'));

// Canonical marketing and main routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/robotics-lab', (req, res) => res.sendFile(path.join(__dirname, 'robotics lab', 'robotics-lab.html')));
app.get(['/codelab', '/codelab/'], (req, res) => sendCodeLabLanding(res));
app.get('/codelab/app', (req, res) => sendCodeLabApp(res));

// Legacy compatibility redirects
app.get('/code-lab', (req, res) => res.redirect(301, '/codelab'));
app.get('/code-lab/', (req, res) => res.redirect(301, '/codelab'));
app.get('/code-lab.html', (req, res) => res.redirect(301, '/codelab'));
app.get('/code-lab/dashboard', (req, res) => res.redirect(301, '/codelab/dashboard'));
app.get('/code-lab/dashboard.html', (req, res) => res.redirect(301, '/codelab/dashboard'));
app.get('/code-lab/login', (req, res) => res.redirect(301, '/codelab/login'));
app.get('/code-lab/signup', (req, res) => res.redirect(301, '/codelab/signup'));
app.get('/code-lab/admin', (req, res) => res.redirect(301, '/codelab/admin'));
app.get('/code-lab/dev', (req, res) => res.redirect(301, '/dev'));
app.get('/code-lab/dev/*', (req, res) => res.redirect(301, `/dev/${req.params[0]}`));
app.get('/admin', (req, res, next) => codeLabApp(req, res, next));
app.get('/admin/', (req, res, next) => codeLabApp(req, res, next));
app.get('/code-lab/lesson/:slug', (req, res) => res.redirect(301, `/codelab/lesson/${encodeURIComponent(req.params.slug)}`));
app.get('/code-lab/lesson/:slug.html', (req, res) => res.redirect(301, `/codelab/lesson/${encodeURIComponent(req.params.slug)}`));

// Local Code Lab app routes (no external proxy)
app.get('/codelab/login', (req, res) => res.redirect(302, '/codelab/app'));
app.get('/codelab/signup', (req, res) => res.redirect(302, '/codelab/app'));
app.get('/codelab/dashboard', (req, res) => res.redirect(302, '/codelab/app#page-home'));
app.get('/codelab/lesson/:slug', (req, res) => res.redirect(302, '/codelab/app'));
app.get('/codelab/admin', (req, res) => res.redirect(302, '/admin'));
app.get('/codelab/dev', (req, res) => res.redirect(302, '/dev'));
app.get('/codelab/dev/*', (req, res) => res.redirect(302, `/dev/${req.params[0]}`));
app.get('/dev', (req, res, next) => {
	req.url = '/dev';
	codeLabApp(req, res, next);
});
app.get('/dev/*', (req, res, next) => {
	req.url = `/dev/${req.params[0]}`;
	codeLabApp(req, res, next);
});
app.use('/codelab/api', (req, res, next) => {
	req.url = `/api${req.url}`;
	codeLabApp(req, res, next);
});
app.use('/api', (req, res, next) => {
	req.url = `/api${req.url}`;
	codeLabApp(req, res, next);
});
app.use('/fll-assets', (req, res, next) => {
	req.url = `/fll-assets${req.url}`;
	codeLabApp(req, res, next);
});

// Static files for existing pages and assets
app.use(express.static(path.join(__dirname), { index: false }));

app.listen(PORT, () => console.log(`AI Future Platform running at http://localhost:${PORT}`));
