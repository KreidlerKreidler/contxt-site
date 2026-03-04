/* app.js — consolidated (no duplicates)
   Includes:
   - CRT overlay (only if missing)
   - Audio + miss pulse
   - Clock
   - HUD tilt + custom cursor
   - Scramble + glitch
   - Panels
   - Project modal (with fixed title bug)
   - Contact proxy submit + polling
   - Idle (45s)
   - Boot loader (desktop only)
   - Mobile MENU sheet (<=1200px) with VisualViewport bottom inset
*/

(() => {
  const BP = 1200;

  const init = () => {
    const docEl = document.documentElement;

    // -------------------------------------------------------------------------
    // Touch detection
    // -------------------------------------------------------------------------
    const isCoarse =
      window.matchMedia('(pointer: coarse)').matches ||
      window.matchMedia('(hover: none)').matches;
    const isDesktopWide = window.matchMedia('(min-width: 1201px)').matches;

    docEl.classList.toggle('is-touch', isCoarse);

    // -------------------------------------------------------------------------
    // CRT overlay (only if missing)
    // -------------------------------------------------------------------------
    function ensureCrtOverlay() {
      if (document.getElementById('crt-overlay')) return;
      const wrap = document.createElement('div');
      wrap.className = 'crt-overlay';
      wrap.id = 'crt-overlay';
      wrap.setAttribute('aria-hidden', 'true');
      wrap.innerHTML = `
        <div class="crt-glass" aria-hidden="true"></div>
        <div class="crt-rgb" aria-hidden="true"></div>
        <div class="crt-scanlines" aria-hidden="true"></div>
        <div class="crt-noise" aria-hidden="true"></div>
        <div class="crt-roll-bar" aria-hidden="true"></div>
      `;
      document.body.appendChild(wrap);
    }
    ensureCrtOverlay();

    // -------------------------------------------------------------------------
    // Audio pools + haptics
    // -------------------------------------------------------------------------
    const SFX_URL_CLICK =
      'https://cdn.prod.website-files.com/694e6c5ef8185fede650ef0a/6968110d54b3ffb810d7201d_menusound.mp3';
    const SFX_URL_MISS =
      'https://cdn.prod.website-files.com/694e6c5ef8185fede650ef0a/6968110b2d2f0080bf9de90a_panel%20klick.mp3';
    const SFX_URL_OK =
      'https://cdn.prod.website-files.com/694e6c5ef8185fede650ef0a/6968132b46b5321045b76bbf_msgsend.mp3';

    const VOL_CLICK = 0.55;
    const VOL_MISS = 0.12;
    const VOL_EDGE = 0.22;
    const VOL_OK = 0.7;

    function makePool(url, size = 4) {
      const pool = Array.from({ length: size }, () => {
        const a = new Audio(url);
        a.preload = 'auto';
        a.crossOrigin = 'anonymous';
        return a;
      });
      let i = 0;
      return {
        play(volume) {
          const a = pool[i];
          i = (i + 1) % pool.length;
          try {
            a.pause();
            a.currentTime = 0;
            a.volume = Math.max(0, Math.min(1, volume));
            const p = a.play();
            if (p && typeof p.catch === 'function') p.catch(() => {});
          } catch (_) {}
        }
      };
    }

    const sfxClick = makePool(SFX_URL_CLICK, 4);
    const sfxMiss = makePool(SFX_URL_MISS, 3);
    const sfxOk = makePool(SFX_URL_OK, 2);

    const canVibrate = () =>
      typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
    const tinyVibe = () => {
      if (canVibrate()) navigator.vibrate(10);
    };

    // -------------------------------------------------------------------------
    // Helpers: clickable/editable detection
    // -------------------------------------------------------------------------
    function isEditableTarget(t) {
      if (!t) return false;
      const el = t.closest?.(
        'input, textarea, select, option, [contenteditable="true"]'
      );
      return !!el;
    }

    function isClickableTarget(t) {
      if (!t?.closest) return false;
      if (isEditableTarget(t)) return false;

      const clickable = t.closest(
        [
          '.header-logo',
          '.nav-item',
          '.legal-link',
          '.project-card.is-clickable',
          '.project-card[data-panel]',
          '.panel-close',
          '.project-modal-close',
          '.founder-mini',
          '.project-detail-media.is-link',
          'a[href]',
          'button',
          '[role="button"]'
        ].join(',')
      );

      if (!clickable) return false;
      if (clickable.matches('button:disabled, [aria-disabled="true"]'))
        return false;
      return true;
    }

    // -------------------------------------------------------------------------
    // Wrong-click pulse
    // -------------------------------------------------------------------------
    const noPulse = document.createElement('div');
    noPulse.className = 'hud-no-pulse';
    document.body.appendChild(noPulse);

    let pulseT = null;
    function fireNoPulse(x, y) {
      if (docEl.classList.contains('is-idle')) return;
      if (docEl.classList.contains('is-boot')) return;

      noPulse.style.left = `${x}px`;
      noPulse.style.top = `${y}px`;

      noPulse.classList.remove('is-go');
      void noPulse.offsetWidth;
      noPulse.classList.add('is-go');

      if (pulseT) clearTimeout(pulseT);
      pulseT = setTimeout(() => noPulse.classList.remove('is-go'), 340);
    }

    // Global click feedback
    document.addEventListener(
      'click',
      (e) => {
        if (docEl.classList.contains('is-boot')) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        if (e.button && e.button !== 0) return;
        if (isEditableTarget(e.target)) return;

        if (isClickableTarget(e.target)) {
          sfxClick.play(VOL_CLICK);
          tinyVibe();
        } else {
          sfxMiss.play(VOL_MISS);
          fireNoPulse(e.clientX, e.clientY);
        }
      },
      true
    );

    // Header logo reload
    const headerLogo = document.querySelector('.header-logo');
    if (headerLogo) {
      headerLogo.style.cursor = 'pointer';
      headerLogo.addEventListener('click', (e) => {
        if (docEl.classList.contains('is-boot')) return;
        e.preventDefault();
        setTimeout(() => location.reload(), 120);
      });
    }

    // -------------------------------------------------------------------------
    // Clock
    // -------------------------------------------------------------------------
    const clockEl = document.getElementById('live-clock');
    setInterval(() => {
      const now = new Date();
      const t = now.toLocaleTimeString('de-DE', { hour12: false });
      if (clockEl) clockEl.textContent = t;
    }, 1000);

    // -------------------------------------------------------------------------
    // HUD physics + terminal cursor
    // -------------------------------------------------------------------------
    const elX = document.getElementById('val-x');
    const elY = document.getElementById('val-y');
    const cursorH = document.getElementById('cursor-h');
    const cursorV = document.getElementById('cursor-v');
    const hudGlass = document.getElementById('hud-glass');

    let mouseX = Math.round(window.innerWidth / 2);
    let mouseY = Math.round(window.innerHeight / 2);

    let targetTiltX = 0,
      targetTiltY = 0;
    let currentTiltX = 0,
      currentTiltY = 0;

    let hudCursor = null;

    function setCursorStateFromTarget(t) {
      if (!hudCursor) return;
      hudCursor.classList.remove('is-hot', 'is-form');
      if (!t) return;

      if (isEditableTarget(t)) {
        hudCursor.classList.add('is-form');
        return;
      }
      if (isClickableTarget(t)) hudCursor.classList.add('is-hot');
    }

    function updateTiltFromXY(x, y) {
      const nx = (x / window.innerWidth) * 2 - 1;
      const ny = (y / window.innerHeight) * 2 - 1;
      targetTiltY = nx * 1.5;
      targetTiltX = ny * -1.5;
    }
    updateTiltFromXY(mouseX, mouseY);

    if (!isCoarse) {
      hudCursor = document.getElementById('hud-cursor');
      if (!hudCursor) {
        hudCursor = document.createElement('div');
        hudCursor.className = 'hud-cursor';
        hudCursor.id = 'hud-cursor';
        hudCursor.setAttribute('aria-hidden', 'true');
        document.body.appendChild(hudCursor);
      }
      if (!hudCursor.querySelector('.hud-cursor-box')) {
        hudCursor.innerHTML = `<div class="hud-cursor-box" aria-hidden="true"></div>`;
      }

      hudCursor.classList.add('is-on');
      hudCursor.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0) translate3d(-50%, -50%, 0)`;
      setCursorStateFromTarget(document.elementFromPoint(mouseX, mouseY));

      document.addEventListener(
        'mousedown',
        () => {
          if (!hudCursor) return;
          if (docEl.classList.contains('is-boot')) return;
          hudCursor.classList.add('is-down');
        },
        true
      );

      document.addEventListener(
        'mouseup',
        () => {
          if (!hudCursor) return;
          hudCursor.classList.remove('is-down');
        },
        true
      );

      document.addEventListener('mouseleave', () => {
        if (!hudCursor) return;
        hudCursor.classList.remove('is-on');
      });

      document.addEventListener('mouseenter', (e) => {
        if (!hudCursor) return;
        hudCursor.classList.add('is-on');
        if (typeof e.clientX === 'number' && typeof e.clientY === 'number') {
          mouseX = e.clientX;
          mouseY = e.clientY;
          updateTiltFromXY(mouseX, mouseY);
          hudCursor.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0) translate3d(-50%, -50%, 0)`;
        }
      });

      const moveHandler = (e) => {
        if (docEl.classList.contains('is-boot')) return;
        if (e.pointerType && e.pointerType !== 'mouse') return;
        mouseX = e.clientX;
        mouseY = e.clientY;
        setCursorStateFromTarget(e.target);
        updateTiltFromXY(mouseX, mouseY);
      };

      document.addEventListener('pointermove', moveHandler, { passive: true });
      document.addEventListener('mousemove', (e) => moveHandler(e), {
        passive: true
      });

      document.addEventListener(
        'mouseover',
        (e) => {
          if (docEl.classList.contains('is-boot')) return;
          setCursorStateFromTarget(e.target);
        },
        true
      );
      document.addEventListener(
        'focusin',
        (e) => {
          if (docEl.classList.contains('is-boot')) return;
          setCursorStateFromTarget(e.target);
        },
        true
      );

      function updatePhysics() {
        if (elX && elY) {
          elX.innerText = mouseX.toString().padStart(4, '0');
          elY.innerText = mouseY.toString().padStart(4, '0');
        }
        if (cursorH && cursorV) {
          cursorH.style.transform = `translateY(${mouseY}px)`;
          cursorV.style.transform = `translateX(${mouseX}px)`;
        }
        if (hudGlass) {
          currentTiltX += (targetTiltX - currentTiltX) * 0.1;
          currentTiltY += (targetTiltY - currentTiltY) * 0.1;
          hudGlass.style.transform = `rotateX(${currentTiltX.toFixed(
            3
          )}deg) rotateY(${currentTiltY.toFixed(3)}deg) translateZ(0)`;
        }
        if (hudCursor) {
          hudCursor.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0) translate3d(-50%, -50%, 0)`;
        }
        requestAnimationFrame(updatePhysics);
      }
      updatePhysics();

      window.addEventListener(
        'resize',
        () => {
          mouseX = Math.min(Math.max(mouseX, 0), window.innerWidth);
          mouseY = Math.min(Math.max(mouseY, 0), window.innerHeight);
          updateTiltFromXY(mouseX, mouseY);
          if (hudCursor) {
            hudCursor.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0) translate3d(-50%, -50%, 0)`;
          }
        },
        { passive: true }
      );
    } else {
      if (hudGlass) hudGlass.style.transform = 'none';
    }

    // Ensure Project Alpha media class
    const alphaMedia = document.querySelector('[data-project="alpha"] .project-media');
    if (alphaMedia) alphaMedia.classList.add('project-media-alpha');

    // -------------------------------------------------------------------------
    // Text scramble
    // -------------------------------------------------------------------------
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_#%/';
    const target = document.getElementById('scramble-text');
    let scrambleTimer = null;

    function runScramble() {
      if (!target) return;

      if (scrambleTimer) {
        clearInterval(scrambleTimer);
        scrambleTimer = null;
      }

      const originalText = (target.dataset.value || target.innerText || '').toString();
      if (!originalText) return;

      let iteration = 0;

      scrambleTimer = setInterval(() => {
        const out = originalText
          .split('')
          .map((ch, index) =>
            index < iteration
              ? ch
              : letters[Math.floor(Math.random() * letters.length)]
          )
          .join('');

        target.innerText = out;

        if (iteration >= originalText.length) {
          target.innerText = originalText;
          clearInterval(scrambleTimer);
          scrambleTimer = null;
        }

        iteration += 1 / 3;
      }, 30);
    }

    setTimeout(runScramble, 600);
    if (target && !isCoarse) target.onmouseover = runScramble;

    // Random glitch
    function startGlitchEngine() {
      const glitchTargets = document.querySelectorAll(
        '.hero-headline, .nav-label, .header-logo'
      );
      if (glitchTargets.length === 0) return;

      setInterval(() => {
        if (Math.random() > 0.95) {
          const randomEl =
            glitchTargets[Math.floor(Math.random() * glitchTargets.length)];
          if (!randomEl.getAttribute('data-value'))
            randomEl.setAttribute('data-value', randomEl.innerText);
          randomEl.classList.add('hud-glitch-active');
          setTimeout(() => randomEl.classList.remove('hud-glitch-active'), 250);
        }
      }, 2000);
    }
    startGlitchEngine();

    // -------------------------------------------------------------------------
    // Panels
    // -------------------------------------------------------------------------
    const hero = document.querySelector('.hero-stage');
    const overlay = document.getElementById('panel-overlay');
    const panels = overlay ? overlay.querySelectorAll('.panel') : [];
    const closeBtn = document.getElementById('panel-close');
    const panelInner = overlay ? overlay.querySelector('.panel-inner') : null;

    const panelTriggers = document.querySelectorAll('.nav-item[data-panel]');
    const navPanelItems = document.querySelectorAll('.nav-item[data-panel]');

    const defaultHeadline = target
      ? target.dataset.value || 'AGENTUR_KLICKWERT'
      : 'AGENTUR_KLICKWERT';

    let projectsScrollTop = 0;

    function setHeadline(newText) {
      if (!target) return;
      const clean = (newText || '').trim();
      target.dataset.value = clean || defaultHeadline;
      runScramble();
    }

    function lockBodyScroll(lock) {
      const val = lock ? 'hidden' : '';
      document.documentElement.style.overflow = val;
      document.body.style.overflow = val;
    }

    const projectModal = document.getElementById('project-modal');

    function applyScrollLockForState() {
      const modalOpen = !!(projectModal && projectModal.classList.contains('is-open'));
      const panelOpen = !!(overlay && overlay.classList.contains('is-open'));
      const idleOn = docEl.classList.contains('is-idle');
      const bootOn = docEl.classList.contains('is-boot');
      if (bootOn || idleOn || modalOpen || panelOpen) lockBodyScroll(true);
      else lockBodyScroll(false);
    }

    function setActivePanel(panelId) {
      if (!overlay) return;
      overlay.dataset.active = panelId;
    }
    function clearActivePanel() {
      if (!overlay) return;
      delete overlay.dataset.active;
    }

    function syncScrollForPanel(nextPanelId) {
      if (!panelInner || !overlay) return;
      const current = overlay.dataset.active;

      if (current === 'panel-projects' && nextPanelId !== 'panel-projects') {
        projectsScrollTop = panelInner.scrollTop || 0;
      }
      if (nextPanelId !== 'panel-projects') {
        panelInner.scrollTop = 0;
        return;
      }
      panelInner.scrollTop = projectsScrollTop;
    }

    function setNavActive(panelId) {
      navPanelItems.forEach((el) =>
        el.classList.toggle('is-active', el.dataset.panel === panelId)
      );
    }

    function resetContactUI() {
      const contactForm = document.getElementById('contact-form');
      const contactSuccess = document.getElementById('contact-success');
      const contactError = document.getElementById('contact-error');
      if (contactSuccess) {
        contactSuccess.hidden = true;
        contactSuccess.classList.remove('is-show');
      }
      if (contactError) {
        contactError.hidden = true;
        contactError.classList.remove('is-show');
      }
      if (contactForm) {
        contactForm.classList.remove('is-sending', 'is-sent');
        const submitBtn = contactForm.querySelector('button[type="submit"], input[type="submit"]');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.setAttribute('aria-disabled', 'false');
        }
      }
    }

    function openPanel(panelId, titleText) {
      if (!overlay || !hero) return;

      syncScrollForPanel(panelId);
      setActivePanel(panelId);
      setNavActive(panelId);

      hero.classList.add('is-docked');
      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');
      applyScrollLockForState();

      panels.forEach((p) => p.classList.toggle('is-active', p.id === panelId));
      setHeadline(titleText);

      if (panelInner && panelId !== 'panel-projects') panelInner.scrollTop = 0;
      if (panelId === 'panel-contact') resetContactUI();
    }

    function closePanels() {
      if (!overlay || !hero) return;

      if (panelInner && overlay.dataset.active === 'panel-projects') {
        projectsScrollTop = panelInner.scrollTop || 0;
      }

      overlay.classList.remove('is-open');
      overlay.setAttribute('aria-hidden', 'true');
      panels.forEach((p) => p.classList.remove('is-active'));
      clearActivePanel();
      applyScrollLockForState();

      setNavActive('__none__');

      if (panelInner) panelInner.scrollTop = 0;

      hero.classList.remove('is-docked');
      setHeadline(defaultHeadline);
      resetContactUI();
    }

    // Wheel routing + edge sound
    function normalizeWheelDelta(e) {
      if (e.deltaMode === 1) return e.deltaY * 16;
      if (e.deltaMode === 2) return e.deltaY * window.innerHeight;
      return e.deltaY;
    }

    function findScrollableAncestor(fromEl, stopAtEl) {
      let el = fromEl;
      while (el && el !== stopAtEl && el !== document.body) {
        const cs = window.getComputedStyle(el);
        const oy = cs.overflowY;
        const scrollable =
          (oy === 'auto' || oy === 'scroll') &&
          el.scrollHeight > el.clientHeight + 1;
        if (scrollable) return el;
        el = el.parentElement;
      }
      return null;
    }

    let lastEdgeAt = 0;
    function maybeEdgeSound(now) {
      if (now - lastEdgeAt < 450) return;
      lastEdgeAt = now;
      sfxMiss.play(VOL_EDGE);
    }

    function attachWheelRouter(rootEl, fallbackScrollerGetter) {
      if (!rootEl) return;

      rootEl.addEventListener(
        'wheel',
        (e) => {
          if (docEl.classList.contains('is-boot')) {
            e.preventDefault();
            return;
          }
          if (docEl.classList.contains('is-idle')) {
            e.preventDefault();
            return;
          }

          if (
            isDesktopWide &&
            rootEl.id === 'panel-overlay' &&
            rootEl.dataset.active === 'panel-contact'
          ) {
            e.preventDefault();
            return;
          }

          if (isEditableTarget(e.target)) return;

          const fallbackScroller =
            typeof fallbackScrollerGetter === 'function'
              ? fallbackScrollerGetter()
              : null;

          const scroller =
            findScrollableAncestor(e.target, rootEl) || fallbackScroller;

          if (!scroller) return;

          const dy = normalizeWheelDelta(e);

          const atBottom =
            scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1;
          if (dy > 0 && atBottom) {
            maybeEdgeSound(Date.now());
            e.preventDefault();
            return;
          }

          const atTop = scroller.scrollTop <= 0;
          if (dy < 0 && atTop) {
            e.preventDefault();
            return;
          }

          scroller.scrollTop += dy;
          e.preventDefault();
        },
        { passive: false }
      );
    }

    attachWheelRouter(overlay, () => panelInner);

    // Panel triggers
    panelTriggers.forEach((item) => {
      const activate = (e) => {
        if (docEl.classList.contains('is-boot')) return;
        e.preventDefault();

        const panelId = item.dataset.panel;
        const titleText = (
          item.dataset.title ||
          item.querySelector('.nav-label')?.innerText ||
          item.innerText ||
          defaultHeadline
        ).trim();

        const activePanel = overlay ? overlay.querySelector(`#${panelId}`) : null;
        const isAlreadyOpen =
          overlay &&
          overlay.classList.contains('is-open') &&
          activePanel &&
          activePanel.classList.contains('is-active');

        if (isAlreadyOpen) closePanels();
        else openPanel(panelId, titleText);
      };

      item.addEventListener('click', activate);
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') activate(e);
      });
    });

    if (closeBtn) closeBtn.addEventListener('click', closePanels);

    if (overlay) {
      overlay.addEventListener('click', (e) => {
        const inner = overlay.querySelector('.panel-inner');
        const topbar = overlay.querySelector('.panel-topbar');
        const clickedInside =
          (inner && inner.contains(e.target)) || (topbar && topbar.contains(e.target));
        if (!clickedInside) closePanels();
      });
    }

    // -------------------------------------------------------------------------
    // Project modal
    // -------------------------------------------------------------------------
    const projectModalClose = document.getElementById('project-modal-close');
    const projectModalMedia = projectModal
      ? projectModal.querySelector('.project-detail-media')
      : null;

    function openOutboundFromMedia() {
      if (!projectModalMedia) return;
      const url = (projectModalMedia.dataset.outbound || '').trim();
      if (!url) return;
      try {
        const w = window.open(url, '_blank', 'noopener,noreferrer');
        if (w) w.opener = null;
      } catch (_) {}
    }

    if (projectModalMedia) {
      projectModalMedia.addEventListener('click', (e) => {
        if (docEl.classList.contains('is-boot')) return;
        if (!projectModalMedia.dataset.outbound) return;
        e.preventDefault();
        openOutboundFromMedia();
      });

      projectModalMedia.addEventListener('keydown', (e) => {
        if (docEl.classList.contains('is-boot')) return;
        if (!projectModalMedia.dataset.outbound) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openOutboundFromMedia();
        }
      });
    }

    const projectData = {
      alpha: {
        kicker: 'PROJECT // VOLKER KREIDLER',
        title: 'Monochrome E-Commerce Terminal',
        summary:
          'Ein reduziertes Interface-System für den Vertrieb limitierter Schwarz-Weiß-Fotografie. Das Design fungiert als digitale Verlängerung der architektonischen Strenge des Künstlers.',
        image:
          'https://cdn.prod.website-files.com/694e6c5ef8185fede650ef0a/696a415cf0c4d94f716ebd3f_kreidler-third-landscape-exclusion-zone-chernobyl-prypjat-pripyat-05-1280x985.jpg',
        outbound:
          'https://volkerkreidler.myshopify.com/?pb=0#e6f973c876c8f8d2af443a1ceb64488d',
        pills: ['Shopify', 'Art-Terminal', 'Swiss Grid', 'HUD-Casing'],
        sections: [
          {
            h: 'AUSGANGSLAGE',
            html:
              'Übersetzung analoger Foto-Editionen in einen digitalen Shop, ohne die Ruhe der Arbeiten durch ein überladenes Interface zu stören.'
          },
          {
            h: 'ZIEL',
            html:
              'Maximale Bildwirkung durch Verzicht auf Farbe. Eine Nutzerführung, die den Fokus auf das Werk lenkt und den Wert der limitierten Editionen unterstreicht.'
          },
          {
            h: 'DESIGN-ANSATZ',
            html:
              'Das Interface nutzt ein HUD-Casing (Heads-Up Display), das die Werke einrahmt. Ein striktes Schweizer Raster sorgt für visuelle Ordnung und spiegelt die Geometrie der Fotografien wider.'
          },
          {
            h: 'UMSETZUNG',
            list: [
              'Mobile HUD: Navigation auf Mobile am unteren Rand fixiert (Reachability).',
              'Technical Checkout: Kaufprozess als klare Daten-Card — funktional, ohne visuelle Ablenkung.',
              'Compliance: Integration rechtlicher Vorgaben (DDG/MStV) direkt in das grafische System.'
            ]
          },
          {
            h: 'ERGEBNIS',
            html:
              'Ein Interface, das wie eine Galerie gebaut ist. Die technische Qualität des Shops stabilisiert die Wahrnehmung der Kunst und schafft Vertrauen im Verkaufsprozess.'
          },
          { h: 'STACK', html: 'Shopify' }
        ]
      },
      beta: {
        kicker: 'PROJECT // RESERVATION MANAGER',
        title: 'Reservation Management Automation (Google Apps Script)',
        summary:
          'Automatisiert Reservationen aus Gmail in Google Sheets: Extraktion, Bestätigen/Ablehnen via Checkbox, Archivierung und Sortierung nach Datum.',
        image:
          'https://cdn.prod.website-files.com/694e6c5ef8185fede650ef0a/696c91980ed703e7712ef649_123-modified.PNG',
        outbound: 'https://github.com/KreidlerKreidler/GSheet-Reservation-Manager',
        pills: ['Apps Script', 'Google Sheets', 'Gmail', 'Automation'],
        sections: [
          {
            h: 'FEATURES',
            list: [
              'Extrahiert Reservierungsdetails automatisch aus Gmail und schreibt sie in ein Sheet',
              'Bestätigen/Ablehnen über Checkboxen (onEdit)',
              'Archiviert verarbeitete Einträge in ein Archive-Sheet',
              'Sortiert Reservationen & Archiv automatisch nach Datum'
            ]
          },
          {
            h: 'SETUP',
            list: [
              'Google Sheet anlegen (Name, Datum, Zeit, Personen, Email, Status, Confirm/Reject Checkbox usw.)',
              'ProcessedIDs Sheet anlegen (niemals manuell bearbeiten)',
              'Apps Script Dateien hinzufügen (getEmailData, handleReservationConfirmation, archive, sort usw.)',
              'Trigger setzen: onEdit + time-driven (z.B. alle 15 Minuten)'
            ]
          },
          { h: 'IMPACT', html: 'Bereits über 3.000 reale Interaktionen erfolgreich verarbeitet.' },
          { h: 'STACK', html: 'Google Apps Script · Google Sheets · Gmail' }
        ]
      },
      gamma: {
        kicker: 'PROJECT // GAMMA',
        title: 'Brand → UI Translation — Components & Rhythm',
        summary:
          'Brand-Sprache in ein UI-System übersetzt: Tokens, Komponenten und Layout-Set für langfristige Konsistenz.',
        pills: ['Brand', 'UI System', 'Tokens', '2024'],
        sections: [
          {
            h: 'AUSGANGSLAGE',
            html:
              'Brand existierte, aber UI war inkonsistent: Typo, Abstände, Komponenten — alles „ungefähr“.'
          },
          {
            h: 'ZIEL',
            list: [
              'Einheitliche visuelle Sprache (Typo, Spacing, Farbe)',
              'Reusable Komponenten statt Einzel-Layouts',
              'Schneller Output ohne Qualitätsverlust'
            ]
          },
          {
            h: 'ANSATZ',
            list: [
              'Design Tokens als Single Source of Truth',
              'Komponentenbibliothek (Buttons, Cards, Forms, Nav)',
              'Rhythmus-Regeln: Spacing-Skala + Grid-Constraints'
            ]
          },
          {
            h: 'UMSETZUNG',
            list: [
              'UI Audit + System-Definition',
              'Komponentenvarianten + States',
              'Dokumentation: Do/Don’t + Beispiele'
            ]
          },
          {
            h: 'ERGEBNIS',
            list: [
              'Konsistenz in Screens und Builds',
              'Schnelleres Iterieren (weniger Diskussion, mehr System)',
              'Skalierbar für neue Seiten/Features'
            ]
          }
        ]
      }
    };

    function renderProjectModal(key) {
      const data = projectData[key];
      if (!data) return;

      const kickerEl = document.getElementById('project-modal-kicker');
      const titleEl = document.getElementById('project-detail-title');
      const metaEl = document.getElementById('project-detail-meta');
      const copyEl = document.getElementById('project-detail-copy');
      const sectionsEl = document.getElementById('project-detail-sections');
      const mediaEl = document.querySelector('.project-detail-media');

      if (kickerEl) kickerEl.textContent = data.kicker || '';
      if (titleEl) titleEl.textContent = data.title || ''; // FIXED
      if (copyEl) copyEl.textContent = data.summary || '';

      if (metaEl) {
        metaEl.innerHTML = (data.pills || [])
          .map((p) => `<span class="project-detail-pill">${p}</span>`)
          .join('');
      }

      if (sectionsEl) {
        sectionsEl.innerHTML = (data.sections || [])
          .map((s) => {
            const body = Array.isArray(s.list)
              ? `<ul>${s.list.map((li) => `<li>${li}</li>`).join('')}</ul>`
              : `<p>${s.html || ''}</p>`;
            return `<div class="project-detail-section"><h4>${s.h || ''}</h4>${body}</div>`;
          })
          .join('');
      }

      if (mediaEl) {
        const outbound = (data.outbound || '').trim();
        if (outbound) {
          mediaEl.dataset.outbound = outbound;
          mediaEl.classList.add('is-link');
          mediaEl.setAttribute('role', 'link');
          mediaEl.setAttribute('tabindex', '0');
          mediaEl.setAttribute('aria-label', 'Open project in new tab');
        } else {
          delete mediaEl.dataset.outbound;
          mediaEl.classList.remove('is-link');
          mediaEl.removeAttribute('role');
          mediaEl.removeAttribute('tabindex');
          mediaEl.removeAttribute('aria-label');
        }

        if (data.image) {
          mediaEl.style.backgroundImage = `linear-gradient(135deg, rgba(0,0,0,0.12), rgba(0,0,0,0.00)), url("${data.image}")`;
          mediaEl.style.backgroundSize = 'cover';
          mediaEl.style.backgroundPosition = 'center';
          mediaEl.style.backgroundRepeat = 'no-repeat';
        } else {
          mediaEl.style.backgroundImage = '';
          mediaEl.style.backgroundSize = '';
          mediaEl.style.backgroundPosition = '';
          mediaEl.style.backgroundRepeat = '';
        }
      }
    }

    function openProjectModal(key) {
      if (!projectModal) return;
      renderProjectModal(key);
      projectModal.classList.add('is-open');
      projectModal.setAttribute('aria-hidden', 'false');
      applyScrollLockForState();
      tinyVibe();
    }

    function closeProjectModal() {
      if (!projectModal) return;
      projectModal.classList.remove('is-open');
      projectModal.setAttribute('aria-hidden', 'true');
      applyScrollLockForState();
    }

    const modalCards = document.querySelectorAll('.project-card.is-clickable[data-project]');
    modalCards.forEach((card) => {
      const key = card.dataset.project;
      card.addEventListener('click', (e) => {
        if (docEl.classList.contains('is-boot')) return;
        e.preventDefault();
        openProjectModal(key);
      });
      card.addEventListener('keydown', (e) => {
        if (docEl.classList.contains('is-boot')) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openProjectModal(key);
        }
      });
    });

    if (projectModalClose) projectModalClose.addEventListener('click', closeProjectModal);

    if (projectModal) {
      attachWheelRouter(projectModal, () =>
        projectModal.querySelector('.project-modal-content')
      );

      projectModal.addEventListener('click', (e) => {
        const card = projectModal.querySelector('.project-modal-card');
        if (card && !card.contains(e.target)) closeProjectModal();
      });
    }

    document.addEventListener('keydown', (e) => {
      if (docEl.classList.contains('is-boot')) return;
      if (e.key === 'Escape') {
        if (projectModal && projectModal.classList.contains('is-open'))
          closeProjectModal();
        else closePanels();
      }
    });

    // -------------------------------------------------------------------------
    // Contact submit via hidden Webflow proxy + polling
    // -------------------------------------------------------------------------
    const contactForm = document.getElementById('contact-form');
    const contactSuccess = document.getElementById('contact-success');
    const contactError = document.getElementById('contact-error');
    const submitBtn = contactForm
      ? contactForm.querySelector('button[type="submit"], input[type="submit"]')
      : null;

    const proxyWrap = document.getElementById('wf-proxy-form');
    const proxyForm = proxyWrap ? proxyWrap.querySelector('form') : null;

    function showStatus(ok) {
      if (contactSuccess) {
        contactSuccess.hidden = !ok;
        contactSuccess.classList.toggle('is-show', ok);
      }
      if (contactError) {
        contactError.hidden = ok;
        contactError.classList.toggle('is-show', !ok);
      }
    }

    function clearStatus() {
      if (contactSuccess) {
        contactSuccess.hidden = true;
        contactSuccess.classList.remove('is-show');
      }
      if (contactError) {
        contactError.hidden = true;
        contactError.classList.remove('is-show');
      }
    }

    function setSending(isSending) {
      if (!contactForm) return;
      contactForm.classList.toggle('is-sending', !!isSending);
      if (submitBtn) {
        submitBtn.disabled = !!isSending;
        submitBtn.setAttribute('aria-disabled', isSending ? 'true' : 'false');
      }
    }

    function setSent(isSent) {
      if (!contactForm) return;
      contactForm.classList.toggle('is-sent', !!isSent);
    }

    function isShown(el) {
      if (!el) return false;
      const s = window.getComputedStyle(el);
      return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0';
    }

    function pollResult({ doneEl, failEl, timeoutMs = 9000 }) {
      const started = Date.now();
      return new Promise((resolve) => {
        const tick = () => {
          if (isShown(doneEl)) return resolve('success');
          if (isShown(failEl)) return resolve('fail');
          if (Date.now() - started > timeoutMs) return resolve('timeout');
          requestAnimationFrame(tick);
        };
        tick();
      });
    }

    function findProxyField(name, dataNameFallback) {
      if (!proxyForm) return null;
      return (
        proxyForm.querySelector(`[name="${name}"]`) ||
        (dataNameFallback ? proxyForm.querySelector(`[data-name="${dataNameFallback}"]`) : null)
      );
    }

    async function handleResult(doneEl, failEl) {
      const result = await pollResult({ doneEl, failEl, timeoutMs: 9000 });

      if (result === 'success') {
        setSending(false);
        setSent(true);
        showStatus(true);

        sfxOk.play(VOL_OK);

        if (contactForm) contactForm.reset();

        setTimeout(() => {
          closePanels();
          setTimeout(() => {
            setSent(false);
            showStatus(false);
          }, 600);
        }, 3500);

        return;
      }

      setSending(false);
      setSent(false);
      showStatus(false);
    }

    if (contactForm) {
      if (proxyWrap && proxyForm) {
        const proxyDone = proxyWrap.querySelector('.w-form-done');
        const proxyFail = proxyWrap.querySelector('.w-form-fail');

        contactForm.addEventListener('submit', async (e) => {
          if (docEl.classList.contains('is-boot')) return;
          e.preventDefault();

          clearStatus();
          setSent(false);
          setSending(true);

          const srcName = contactForm.querySelector('[name="name"]');
          const srcEmail = contactForm.querySelector('[name="email"]');
          const srcMsg = contactForm.querySelector('[name="message"]');

          const dstName = findProxyField('name', 'Name');
          const dstEmail = findProxyField('email', 'Email Address');
          const dstMsg = findProxyField('message', 'Message');

          if (!dstName || !dstEmail || !dstMsg) {
            setSending(false);
            showStatus(false);
            return;
          }

          dstName.value = srcName ? srcName.value : '';
          dstEmail.value = srcEmail ? srcEmail.value : '';
          dstMsg.value = srcMsg ? srcMsg.value : '';

          const proxySubmit = proxyForm.querySelector('input[type="submit"], button[type="submit"]');
          if (proxySubmit) proxySubmit.click();
          else if (proxyForm.requestSubmit) proxyForm.requestSubmit();
          else proxyForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

          await handleResult(proxyDone, proxyFail);
        });
      }
    }

    // -------------------------------------------------------------------------
    // Idle (45s) — starts AFTER boot on desktop, immediately on touch
    // -------------------------------------------------------------------------
    const IDLE_MS = 45_000;

    const idleOverlay = document.createElement('div');
    idleOverlay.className = 'idle-overlay';
    idleOverlay.id = 'idle-overlay';
    idleOverlay.setAttribute('aria-hidden', 'true');
    idleOverlay.innerHTML = `
      <div class="idle-panel" role="dialog" aria-label="Idle mode">
        <div class="idle-kicker">IDLE // MODE</div>
        <div class="idle-time" id="idle-time">00:00:00</div>
        <div class="idle-sub">SYSTEM PAUSED — UI LOCKED</div>
        <div class="idle-hint">
          <span><b>MOVE</b> / <b>CLICK</b> TO RESUME</span>
          <span>BERLIN</span>
        </div>
      </div>
    `;
    document.body.appendChild(idleOverlay);

    const idleTimeEl = idleOverlay.querySelector('#idle-time');

    function updateIdleTime() {
      if (!idleTimeEl) return;
      const now = new Date();
      idleTimeEl.textContent = now.toLocaleTimeString('de-DE', { hour12: false });
    }

    function setIdle(on) {
      docEl.classList.toggle('is-idle', !!on);
      idleOverlay.classList.toggle('is-on', !!on);
      idleOverlay.setAttribute('aria-hidden', on ? 'false' : 'true');
      applyScrollLockForState();
    }

    let idleTimer = null;
    let idleTicker = null;

    function clearIdleTimers() {
      if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = null;
      }
      if (idleTicker) {
        clearInterval(idleTicker);
        idleTicker = null;
      }
    }

    function armIdle() {
      clearIdleTimers();
      idleTimer = setTimeout(() => {
        setIdle(true);
        updateIdleTime();
        idleTicker = setInterval(updateIdleTime, 1000);
      }, IDLE_MS);
    }

    function wake() {
      if (!docEl.classList.contains('is-idle')) return;
      setIdle(false);
      clearIdleTimers();
      armIdle();
    }

    idleOverlay.addEventListener(
      'wheel',
      (e) => {
        if (docEl.classList.contains('is-idle')) e.preventDefault();
      },
      { passive: false }
    );
    idleOverlay.addEventListener('click', () => wake());

    const activityEvents = [
      'mousemove',
      'mousedown',
      'pointerdown',
      'touchstart',
      'touchmove',
      'wheel',
      'scroll',
      'keydown'
    ];

    function onActivity() {
      if (docEl.classList.contains('is-boot')) return;
      if (docEl.classList.contains('is-idle')) wake();
      else armIdle();
    }

    activityEvents.forEach((evt) => {
      window.addEventListener(evt, onActivity, { passive: true });
    });

    document.addEventListener('visibilitychange', () => {
      if (docEl.classList.contains('is-boot')) return;
      armIdle();
      if (!document.hidden) setIdle(false);
    });

    // -------------------------------------------------------------------------
    // Boot loader (desktop only)
    // -------------------------------------------------------------------------
    let bootOverlay = null;
    let isBooted = false;

    function mountBootOverlay() {
      if (isCoarse) return;

      docEl.classList.add('is-boot');
      applyScrollLockForState();

      bootOverlay = document.createElement('div');
      bootOverlay.className = 'boot-overlay';
      bootOverlay.id = 'boot-overlay';
      bootOverlay.setAttribute('role', 'dialog');
      bootOverlay.setAttribute('aria-label', 'Boot loader');

      bootOverlay.innerHTML = `
        <div class="boot-panel">
          <div class="boot-sweep" aria-hidden="true"></div>
          <div class="boot-kicker">SYSTEM // READY</div>
          <div class="boot-target" aria-hidden="true"><span class="boot-dot" aria-hidden="true"></span></div>
          <p class="boot-title">CLICK TO ARM</p>
          <p class="boot-sub">CURSOR CALIBRATION + INPUT UNLOCK</p>
          <div class="boot-progress" aria-hidden="true"></div>
          <div class="boot-hint"><b>1 CLICK</b> — CENTER SNAP</div>
        </div>
      `;

      document.body.appendChild(bootOverlay);
      requestAnimationFrame(() => bootOverlay && bootOverlay.classList.add('is-on'));

      const finish = (e) => {
        if (isBooted) return;
        isBooted = true;

        if (e) {
          e.preventDefault();
          e.stopPropagation();
          if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
        }

        bootOverlay.classList.add('is-calibrating');

        mouseX = Math.round(window.innerWidth / 2);
        mouseY = Math.round(window.innerHeight / 2);
        updateTiltFromXY(mouseX, mouseY);

        if (cursorH && cursorV) {
          cursorH.style.transform = `translateY(${mouseY}px)`;
          cursorV.style.transform = `translateX(${mouseX}px)`;
        }

        if (hudCursor) {
          hudCursor.classList.add('is-on');
          hudCursor.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0) translate3d(-50%, -50%, 0)`;
          setCursorStateFromTarget(document.elementFromPoint(mouseX, mouseY));
        }

        setTimeout(() => {
          bootOverlay.classList.add('is-off');

          docEl.classList.remove('is-boot');
          docEl.classList.add('is-booted');
          applyScrollLockForState();

          armIdle(); // start idle after boot

          setTimeout(() => {
            if (bootOverlay?.parentNode) bootOverlay.parentNode.removeChild(bootOverlay);
            bootOverlay = null;
          }, 420);
        }, 220);
      };

      bootOverlay.addEventListener('pointerdown', finish, {
        capture: true,
        passive: false,
        once: true
      });

      window.addEventListener(
        'keydown',
        (e) => {
          if (!docEl.classList.contains('is-boot')) return;
          if (e.key === 'Enter' || e.key === ' ') finish(e);
        },
        { passive: false }
      );
    }

    if (!isCoarse) mountBootOverlay();
    else armIdle();

    // -------------------------------------------------------------------------
    // Mobile MENU sheet (<=1200px), VisualViewport-aware
    // -------------------------------------------------------------------------
    const MENU_KEY = '__kwMenu__';
    if (!window[MENU_KEY]) window[MENU_KEY] = { mounted: false, off: [], els: {} };
    const menuState = window[MENU_KEY];

    const mql = window.matchMedia(`(max-width: ${BP}px)`);

    const on = (el, evt, fn, opts) => {
      el.addEventListener(evt, fn, opts);
      menuState.off.push(() => el.removeEventListener(evt, fn, opts));
    };

    const rafThrottle = (fn) => {
      let raf = 0;
      return () => {
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = 0;
          fn();
        });
      };
    };

    const computeBottomInset = () => {
      const vv = window.visualViewport;
      if (!vv) return 0;
      return Math.max(0, Math.round(window.innerHeight - (vv.height + vv.offsetTop)));
    };

    const setBottomVar = () => {
      docEl.style.setProperty('--kw-vv-bottom', `${computeBottomInset()}px`);
    };
    const setBottomVarThrottled = rafThrottle(setBottomVar);

    const ensureMenuStyles = () => {
      if (document.getElementById('kw-mobile-menu-style')) return;
      const style = document.createElement('style');
      style.id = 'kw-mobile-menu-style';
      style.textContent = `
        :root{ --kw-vv-bottom: 0px; }
        html.kw-menu-on .footer-container{ display:none !important; }

        .mobile-menu-btn{
          position: fixed;
          left: 50%;
          transform: translateX(-50%);
          bottom: calc(28px + env(safe-area-inset-bottom, 0px) + var(--kw-vv-bottom, 0px));
          z-index: 1405;
          height: 48px;
          min-width: 148px;
          padding: 0 16px;
          font: 700 10px/1 'Space Mono', monospace;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: rgba(0,0,0,0.72);
          background-color: rgba(244,241,234,0.96);
          background-image:
            repeating-linear-gradient(90deg, rgba(0,0,0,0.030) 0px, rgba(0,0,0,0.030) 1px, rgba(0,0,0,0) 1px, rgba(0,0,0,0) 20px);
          border: 1px solid rgba(0,0,0,0.20);
          border-radius: 0;
          box-shadow: 0 18px 70px rgba(0,0,0,0.10);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          -webkit-tap-highlight-color: transparent;
          user-select: none;
        }
        .mobile-menu-btn::before{
          content: "≡";
          font-size: 12px;
          letter-spacing: 0;
          color: rgba(0,0,0,0.62);
          transform: translateY(-1px);
        }
        .mobile-menu-btn:active{ transform: translateX(-50%) translateY(1px); }

        .mobile-menu-scrim{
          position: fixed;
          inset: 0;
          z-index: 1400;
          opacity: 0;
          pointer-events: none;
          background: rgba(0,0,0,0.10);
          transition: opacity 160ms ease;
        }

        .mobile-menu-sheet{
          position: fixed;
          left: 50%;
          transform: translateX(-50%) translateY(16px);
          bottom: calc(28px + env(safe-area-inset-bottom, 0px) + var(--kw-vv-bottom, 0px));
          z-index: 1402;
          width: calc(100vw - 32px);
          max-width: 560px;
          opacity: 0;
          pointer-events: none;
          border: 1px solid rgba(0,0,0,0.22);
          border-radius: 0;
          background-color: rgba(244,241,234,0.98);
          background-image:
            linear-gradient(180deg, rgba(244,241,234,0.98), rgba(244,241,234,0.94)),
            repeating-linear-gradient(90deg, rgba(0,0,0,0.030) 0px, rgba(0,0,0,0.030) 1px, rgba(0,0,0,0) 1px, rgba(0,0,0,0) 20px);
          box-shadow: 0 25px 80px rgba(0,0,0,0.14), 0 10px 30px rgba(0,0,0,0.06);
          transition: transform 180ms cubic-bezier(0.16, 1, 0.3, 1), opacity 160ms ease;
          overflow: hidden;
        }

        html.is-menu-open .mobile-menu-scrim{ opacity: 1; pointer-events: auto; }
        html.is-menu-open .mobile-menu-sheet{
          opacity: 1;
          pointer-events: auto;
          transform: translateX(-50%) translateY(0);
        }

        .mobile-menu-topbar{
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 14px;
          border-bottom: 1px solid rgba(0,0,0,0.12);
          background: rgba(244,241,234,1);
        }

        .mobile-menu-title{
          font: 700 9px/1 'Space Mono', monospace;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: rgba(0,0,0,0.54);
          display: inline-flex;
          align-items: center;
          gap: 10px;
        }
        .mobile-menu-title::before{
          content: "";
          width: 10px;
          height: 1px;
          background: rgba(227,82,5,0.65);
          transform: translateY(1px);
        }

        .mobile-menu-close{
          font: 700 9px/1 'Space Mono', monospace;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: rgba(0,0,0,0.52);
          background: transparent;
          border: 1px solid rgba(0,0,0,0.16);
          border-radius: 0;
          padding: 8px 10px;
        }

        .mobile-menu-list{ display: grid; padding: 10px; gap: 8px; }

        .mobile-menu-item{
          width: 100%;
          height: 46px;
          display: flex;
          align-items: center;
          gap: 12px;
          text-decoration: none;
          background: rgba(244,241,234,0.40);
          border: 1px solid rgba(0,0,0,0.16);
          border-radius: 0;
          padding: 0 12px;
          font: 700 10px/1 'Space Mono', monospace;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(0,0,0,0.72);
          -webkit-tap-highlight-color: transparent;
        }

        .mobile-menu-item .mi-code{
          font-size: 9px;
          letter-spacing: 0.22em;
          color: rgba(0,0,0,0.40);
          min-width: 32px;
        }
        .mobile-menu-item .mi-label{ flex: 1; }
        .mobile-menu-item:active{ transform: translateY(1px); }

        .mobile-menu-divider{ height: 1px; background: rgba(0,0,0,0.10); margin: 2px 0; }
      `;
      document.head.appendChild(style);
    };

    const mountMenu = () => {
      if (menuState.mounted) return;

      ensureMenuStyles();
      setBottomVar();

      docEl.classList.add('kw-menu-on');

      const btn = document.createElement('button');
      btn.className = 'mobile-menu-btn';
      btn.type = 'button';
      btn.setAttribute('aria-haspopup', 'dialog');
      btn.setAttribute('aria-controls', 'mobile-menu-sheet');
      btn.setAttribute('aria-expanded', 'false');
      btn.textContent = 'MENU';

      const scrim = document.createElement('div');
      scrim.className = 'mobile-menu-scrim';
      scrim.setAttribute('aria-hidden', 'true');

      const sheet = document.createElement('div');
      sheet.className = 'mobile-menu-sheet';
      sheet.id = 'mobile-menu-sheet';
      sheet.setAttribute('role', 'dialog');
      sheet.setAttribute('aria-modal', 'true');
      sheet.setAttribute('aria-hidden', 'true');

      sheet.innerHTML = `
        <div class="mobile-menu-topbar">
          <div class="mobile-menu-title">NAV // INDEX</div>
          <button class="mobile-menu-close" id="mobile-menu-close" type="button">CLOSE</button>
        </div>

        <div class="mobile-menu-list" role="list">
          <button class="mobile-menu-item" type="button" data-panel="panel-projects">
            <span class="mi-code">01</span><span class="mi-label">PROJEKTE</span>
          </button>
          <button class="mobile-menu-item" type="button" data-panel="panel-agency">
            <span class="mi-code">02</span><span class="mi-label">AGENTUR</span>
          </button>
          <button class="mobile-menu-item" type="button" data-panel="panel-contact">
            <span class="mi-code">03</span><span class="mi-label">KONTAKT</span>
          </button>

          <div class="mobile-menu-divider" aria-hidden="true"></div>

          <a class="mobile-menu-item is-link" href="https://agentur-klickwert.de/impressum">
            <span class="mi-code">04</span><span class="mi-label">IMPRESSUM</span>
          </a>
          <a class="mobile-menu-item is-link" href="https://agentur-klickwert.de/datenschutz">
            <span class="mi-code">05</span><span class="mi-label">DATENSCHUTZ</span>
          </a>
        </div>
      `;

      document.body.appendChild(btn);
      document.body.appendChild(scrim);
      document.body.appendChild(sheet);

      const closeBtn = sheet.querySelector('#mobile-menu-close');
      menuState.els = { btn, scrim, sheet, closeBtn };

      const setMenuOpen = (onOff) => {
        const onState = !!onOff;
        if (onState) {
          if (docEl.classList.contains('is-boot')) return;
          if (docEl.classList.contains('is-idle')) return;
        }
        docEl.classList.toggle('is-menu-open', onState);
        btn.setAttribute('aria-expanded', onState ? 'true' : 'false');
        sheet.setAttribute('aria-hidden', onState ? 'false' : 'true');
        setBottomVarThrottled();
      };

      const closeMenu = () => setMenuOpen(false);
      const toggleMenu = () => setMenuOpen(!docEl.classList.contains('is-menu-open'));

      const triggerPanel = (panelId) => {
        const t = document.querySelector(`.nav-item[data-panel="${panelId}"]`);
        if (t) {
          t.click();
          return true;
        }
        return false;
      };

      on(btn, 'click', toggleMenu);
      on(scrim, 'click', closeMenu);
      if (closeBtn) on(closeBtn, 'click', closeMenu);

      on(sheet, 'click', (e) => {
        const item = e.target.closest('.mobile-menu-item');
        if (!item) return;
        if (item.matches('a[href]')) {
          closeMenu();
          return;
        }
        const panelId = item.dataset.panel;
        if (!panelId) return;
        closeMenu();
        triggerPanel(panelId);
      });

      on(document, 'keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (docEl.classList.contains('is-menu-open')) closeMenu();
      });

      const vv = window.visualViewport;
      if (vv) {
        on(vv, 'resize', setBottomVarThrottled);
        on(vv, 'scroll', setBottomVarThrottled);
      }
      on(window, 'resize', setBottomVarThrottled, { passive: true });
      on(window, 'orientationchange', setBottomVarThrottled, { passive: true });

      const mo = new MutationObserver(() => {
        if (docEl.classList.contains('is-boot') || docEl.classList.contains('is-idle')) {
          if (docEl.classList.contains('is-menu-open')) setMenuOpen(false);
        }
      });
      mo.observe(docEl, { attributes: true, attributeFilter: ['class'] });
      menuState.off.push(() => mo.disconnect());

      menuState.mounted = true;
    };

    const unmountMenu = () => {
      if (!menuState.mounted) return;

      docEl.classList.remove('kw-menu-on', 'is-menu-open');

      while (menuState.off.length) {
        try {
          menuState.off.pop()();
        } catch (_) {}
      }

      const { btn, scrim, sheet } = menuState.els || {};
      btn && btn.remove();
      scrim && scrim.remove();
      sheet && sheet.remove();

      menuState.els = {};
      menuState.mounted = false;
    };

    const syncMenu = () => {
      if (mql.matches) mountMenu();
      else unmountMenu();
    };

    if (mql.addEventListener) mql.addEventListener('change', syncMenu);
    else mql.addListener(syncMenu);

    syncMenu();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();