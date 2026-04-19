/* ============================================================
   AI Future Platform — Shared JavaScript
   ============================================================ */

/* ── Announcement Bar Dismiss ─────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  const bar = document.querySelector('.announce-bar');
  const dismissBtn = document.querySelector('.announce-bar__dismiss');
  if (dismissBtn && bar) {
    dismissBtn.addEventListener('click', () => {
      bar.classList.add('dismissed');
      sessionStorage.setItem('af-announce-dismissed', '1');
    });
    if (sessionStorage.getItem('af-announce-dismissed')) {
      bar.classList.add('dismissed');
    }
  }

  /* ── Mobile Nav ─────────────────────────────────────────── */
  const hamburger = document.querySelector('.navbar__hamburger');
  const mobileNav = document.querySelector('.nav-mobile');
  const overlay = document.querySelector('.nav-overlay');
  const mobileClose = document.querySelector('.nav-mobile__close');

  function openNav() {
    mobileNav?.classList.add('open');
    overlay?.style && (overlay.style.display = 'block');
    document.body.style.overflow = 'hidden';
  }
  function closeNav() {
    mobileNav?.classList.remove('open');
    overlay?.style && (overlay.style.display = 'none');
    document.body.style.overflow = '';
  }

  hamburger?.addEventListener('click', openNav);
  mobileClose?.addEventListener('click', closeNav);
  overlay?.addEventListener('click', closeNav);

  /* ── Navbar Scroll Shadow ───────────────────────────────── */
  const navbar = document.querySelector('.navbar');
  if (navbar) {
    window.addEventListener('scroll', () => {
      navbar.classList.toggle('scrolled', window.scrollY > 10);
    }, { passive: true });
  }

  /* ── Active Nav Link (based on current page) ────────────── */
  const currentPath = window.location.pathname;
  document.querySelectorAll('.navbar__links a, .nav-mobile a').forEach(link => {
    const href = link.getAttribute('href') || '';
    const isHome = (href === 'index.html' || href === '../index.html' || href === '../../index.html') &&
                   (currentPath.endsWith('index.html') || currentPath.endsWith('/'));
    const isActive = !isHome && href && currentPath.includes(href.replace('../', '').replace('../../', ''));
    if (isHome || isActive) link.classList.add('active');
  });

  /* ── Scroll Reveal ──────────────────────────────────────── */
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

  /* ── Stats Counter ──────────────────────────────────────── */
  const statObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateStats(entry.target);
        statObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.3 });

  document.querySelectorAll('[data-count]').forEach(el => statObserver.observe(el));
});

function animateStats(container) {
  container.querySelectorAll('[data-count]').forEach(el => {
    const target = parseInt(el.dataset.count, 10);
    const suffix = el.dataset.suffix || '';
    const prefix = el.dataset.prefix || '';
    const duration = 1600;
    const start = performance.now();

    function step(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = prefix + Math.round(eased * target).toLocaleString() + suffix;
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  });
}

/* ── Progress Circle ────────────────────────────────────────── */
function initProgressCircle(svg, percentage, color = '#2563FF') {
  const circle = svg.querySelector('.progress-ring');
  if (!circle) return;
  const r = parseFloat(circle.getAttribute('r'));
  const circumference = 2 * Math.PI * r;
  circle.style.strokeDasharray = circumference;
  circle.style.strokeDashoffset = circumference;
  circle.style.stroke = color;
  setTimeout(() => {
    circle.style.transition = 'stroke-dashoffset 1s ease';
    circle.style.strokeDashoffset = circumference - (percentage / 100) * circumference;
  }, 300);
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-progress-circle]').forEach(el => {
    const pct = parseInt(el.dataset.progressCircle, 10);
    const color = el.dataset.color || '#2563FF';
    initProgressCircle(el, pct, color);
  });
});
