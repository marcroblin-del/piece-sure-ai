/* PIÈCE-SÛRE AI — lecture à voix haute des points à confirmer v1
   Lecture seule : ne modifie aucun champ, ne coche rien, aucun réseau. */
(function () {
  'use strict';

  var VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;
  var token = 0;
  var enCours = false;

  function $(id) { return document.getElementById(id); }
  function val(id) { var e = $(id); return e && e.value ? String(e.value).trim() : ''; }
  function propre(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }

  function lirePoints() {
    var box = $('famList');
    var items = [];
    if (!box) return null;
    var cbs = box.querySelectorAll('input[type=checkbox]');
    for (var i = 0; i < cbs.length; i++) {
      var cb = cbs[i];
      var lab = cb.closest ? cb.closest('label') : null;
      var txt = propre(lab ? lab.textContent : (cb.parentNode ? cb.parentNode.textContent : ''));
      if (txt) items.push({ t: txt, c: !!cb.checked });
    }
    return items;
  }

  function construire() {
    var phrases = [];
    var veh = [val('make'), val('model'), val('year')].filter(Boolean).join(' ');
    phrases.push('Dossier : ' + (veh || 'véhicule non renseigné') + '.');
    if (val('request')) phrases.push('Demande : ' + propre(val('request')) + '.');
    if (val('engine')) phrases.push('Le code moteur est indiqué dans le dossier, mais il n\'est pas confirmé.');
    var vin = val('vin').toUpperCase().replace(/\s+/g, '');
    if (!vin) phrases.push('Le VIN est absent.');
    else if (VIN_RE.test(vin)) phrases.push('Le VIN a un format valide. Il n\'est pas vérifié dans une base professionnelle.');
    else phrases.push('Le VIN est présent mais son format est invalide.');

    var fs = $('famSel');
    var fam = '';
    if (fs && fs.value) {
      var o = fs.options[fs.selectedIndex];
      fam = propre(o ? o.textContent : fs.value);
    }
    if (!fam) {
      phrases.push('Aucune famille de pièces n\'est choisie. Il n\'y a pas de points à confirmer à lire.');
      return phrases;
    }
    var pts = lirePoints();
    if (pts === null) {
      phrases.push('Je ne retrouve pas la liste des points de la famille ' + fam + '. Rien n\'est lu.');
      return phrases;
    }
    if (!pts.length) {
      phrases.push('Je ne trouve aucune case dans la liste de la famille ' + fam + '. Rien n\'est lu.');
      return phrases;
    }
    var nonConf = pts.filter(function (p) { return !p.c; }).length;
    phrases.push('Famille ' + fam + ' : ' + pts.length + ' points, dont ' + nonConf + ' non confirmés.');
    pts.forEach(function (p, i) {
      phrases.push('Point ' + (i + 1) + ' : ' + p.t + '. ' + (p.c ? 'Coché par vous.' : 'Non confirmé.'));
    });
    phrases.push('Fin de la lecture. Rien n\'a été coché ni enregistré. La commande reste soumise aux règles du dossier.');
    return phrases;
  }

  function choisirVoix() {
    var vs = window.speechSynthesis.getVoices() || [];
    for (var i = 0; i < vs.length; i++) {
      if (vs[i].lang && vs[i].lang.toLowerCase().indexOf('fr') === 0) return vs[i];
    }
    return null;
  }

  function arreter() {
    token++;
    enCours = false;
    try { window.speechSynthesis.cancel(); } catch (e) {}
  }

  function lire(phrases, vitesse, etat) {
    arreter();
    var mon = token;
    enCours = true;
    var voix = choisirVoix();
    var i = 0;
    function suite() {
      if (mon !== token) return;
      if (i >= phrases.length) { enCours = false; etat.textContent = 'Lecture terminée.'; return; }
      var u = new SpeechSynthesisUtterance(phrases[i]);
      u.lang = 'fr-FR';
      if (voix) u.voice = voix;
      u.rate = vitesse;
      u.onend = function () { i++; suite(); };
      u.onerror = function () {
        if (mon !== token) return;
        enCours = false;
        etat.textContent = 'La lecture s\'est interrompue (erreur de synthèse vocale).';
      };
      etat.textContent = 'Lecture : phrase ' + (i + 1) + ' sur ' + phrases.length + (voix ? '' : ' (aucune voix française trouvée, voix par défaut)');
      window.speechSynthesis.speak(u);
    }
    suite();
  }

  function bouton(txt) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'button';
    b.textContent = txt;
    b.style.marginRight = '8px';
    b.style.marginTop = '6px';
    return b;
  }

  function creerCarte() {
    var c = document.createElement('div');
    c.id = 'lv-carte';
    c.style.cssText = 'border:1px solid #ccc;border-radius:10px;padding:12px;margin:14px 0;';
    var h = document.createElement('h3');
    h.style.marginTop = '0';
    h.textContent = 'Lecture à voix haute des points à confirmer';
    c.appendChild(h);

    var p = document.createElement('p');
    p.style.fontSize = '0.9em';
    p.textContent = 'Lecture seule avec la voix de l\'appareil. Ne coche rien, ne modifie aucun champ, n\'envoie rien. Le VIN et la plaque ne sont pas lus.';
    c.appendChild(p);

    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      var nd = document.createElement('p');
      nd.textContent = 'La synthèse vocale n\'est pas disponible dans ce navigateur.';
      c.appendChild(nd);
      return c;
    }

    var lab = document.createElement('label');
    lab.textContent = 'Vitesse : ';
    var sel = document.createElement('select');
    [['0.8', 'Lente'], ['1', 'Normale'], ['1.2', 'Rapide']].forEach(function (o) {
      var op = document.createElement('option');
      op.value = o[0]; op.textContent = o[1];
      if (o[0] === '1') op.selected = true;
      sel.appendChild(op);
    });
    lab.appendChild(sel);
    c.appendChild(lab);
    c.appendChild(document.createElement('br'));

    var bLire = bouton('Lire les points à confirmer');
    var bStop = bouton('Arrêter');
    c.appendChild(bLire);
    c.appendChild(bStop);

    var etat = document.createElement('p');
    etat.style.fontSize = '0.9em';
    etat.textContent = 'Prêt.';
    c.appendChild(etat);

    var texte = document.createElement('pre');
    texte.style.cssText = 'white-space:pre-wrap;font-size:0.85em;margin:0;';
    c.appendChild(texte);

    bLire.addEventListener('click', function () {
      var phrases = construire();
      texte.textContent = phrases.join('\n');
      lire(phrases, parseFloat(sel.value) || 1, etat);
    });
    bStop.addEventListener('click', function () {
      arreter();
      etat.textContent = 'Lecture arrêtée.';
    });
    window.addEventListener('pagehide', arreter);
    return c;
  }

  function inserer() {
    if ($('lv-carte')) return true;
    var ancre = $('dc-carte');
    if (ancre && ancre.parentNode) {
      ancre.parentNode.insertBefore(creerCarte(), ancre);
      return true;
    }
    var fl = $('famList');
    if (fl && fl.parentNode) {
      fl.parentNode.insertBefore(creerCarte(), fl.nextSibling);
      return true;
    }
    return false;
  }

  function demarrer() {
    var essais = 0;
    (function boucle() {
      if (inserer()) return;
      if (++essais < 20) setTimeout(boucle, 500);
    })();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer);
  else demarrer();
})();
