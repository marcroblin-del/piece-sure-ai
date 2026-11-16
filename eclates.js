/* PIÈCE-SÛRE AI — éclatés v1
   Liens de recherche + consignation de références lues. Ne coche rien, ne modifie aucun champ, aucun réseau. */
(function () {
  'use strict';

  var KEY = 'pieceSureAI_eclate_v1';
  var NAT = [
    ['', '— choisir —'],
    ['constructeur', 'Catalogue constructeur (Renault)'],
    ['pro', 'Catalogue professionnel (distributeur)'],
    ['grand', 'Site grand public ou site d\'éclatés non officiel'],
    ['autre', 'Autre']
  ];
  var VIA = [
    ['', '— choisir —'],
    ['vin', 'Avec le VIN'],
    ['plaque', 'Avec la plaque seule'],
    ['modele', 'Avec marque / modèle / année']
  ];
  var REF_RE = /^[A-Z0-9][A-Z0-9 .\-\/]{3,29}$/;
  var els = {};

  function $(id) { return document.getElementById(id); }
  function val(id) { var e = $(id); return e && e.value ? String(e.value).trim() : ''; }
  function cle() { return val('caseid') || 'sans-numero'; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function maintenant() {
    var d = new Date();
    return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function libelle(tab, code) {
    for (var i = 0; i < tab.length; i++) if (tab[i][0] === code) return tab[i][1];
    return code;
  }

  function charger() {
    try {
      var o = JSON.parse(localStorage.getItem(KEY) || '{}');
      return (o && typeof o === 'object') ? o : {};
    } catch (e) { return {}; }
  }
  function sauver(o) {
    try { localStorage.setItem(KEY, JSON.stringify(o)); return true; } catch (e) { return false; }
  }
  function liste() {
    var l = charger()[cle()];
    return Array.isArray(l) ? l : [];
  }
  function estFort(nature, via) {
    return (nature === 'constructeur' || nature === 'pro') && via === 'vin';
  }

  function statut(l) {
    if (!l.length) return { c: '#888', t: 'AUCUNE LECTURE — rien n\'est consigné.' };
    var forts = l.filter(function (e) { return e.fort; }).length;
    if (forts) {
      return { c: '#2e7d32', t: forts + ' lecture(s) dans un catalogue constructeur ou professionnel avec le VIN. Références à rapprocher du registre (section 6). Rien n\'est coché.' };
    }
    return { c: '#b26a00', t: l.length + ' lecture(s) non fiable(s) : références indicatives, compatibilité non établie. Ne pas commander sur cette base.' };
  }

  function resume() {
    var l = liste();
    var lignes = ['Références lues sur éclatés — dossier ' + cle(), statut(l).t];
    l.forEach(function (e, i) {
      lignes.push((i + 1) + '. ' + e.ref + (e.repere ? ' · repère ' + e.repere : '') + (e.desig ? ' · ' + e.desig : '') +
        ' · ' + libelle(NAT, e.nature) + ' · ' + libelle(VIA, e.via) + ' · ' + e.date + ' · ' + e.detail +
        ' · ' + (e.fort ? 'source fiable' : 'non fiable'));
    });
    return lignes.join('\n');
  }

  function rendu() {
    var l = liste();
    var s = statut(l);
    els.dossier.textContent = 'Dossier : ' + cle();
    els.statut.textContent = s.t;
    els.statut.style.borderLeft = '6px solid ' + s.c;
    els.liste.textContent = '';
    l.forEach(function (e, i) {
      var li = document.createElement('div');
      li.style.cssText = 'margin:6px 0;padding:6px;border:1px solid #888;border-radius:6px;font-size:0.9em;';
      var t = document.createElement('div');
      t.textContent = e.ref + (e.repere ? ' · repère ' + e.repere : '') + (e.desig ? ' · ' + e.desig : '') +
        ' · ' + libelle(NAT, e.nature) + ' · ' + libelle(VIA, e.via) + ' · ' + e.date + ' · ' + e.detail +
        ' · ' + (e.fort ? 'SOURCE FIABLE' : 'non fiable');
      li.appendChild(t);
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = 'Supprimer';
      b.style.marginTop = '4px';
      b.addEventListener('click', function () {
        if (!window.confirm('Supprimer cette ligne ?')) return;
        var tout = charger();
        var k = cle();
        var cur = Array.isArray(tout[k]) ? tout[k] : [];
        cur.splice(i, 1);
        tout[k] = cur;
        sauver(tout);
        els.msg.textContent = 'Ligne supprimée.';
        rendu();
      });
      li.appendChild(b);
      els.liste.appendChild(li);
    });
    rendreLiens();
  }

  function g(q) { return 'https://www.google.com/search?q=' + encodeURIComponent(q); }
  function gi(q) { return 'https://www.google.com/search?tbm=isch&q=' + encodeURIComponent(q); }

  function rendreLiens() {
    var veh = [val('make'), val('model'), val('year'), val('engine')].filter(Boolean).join(' ');
    var ok = !!(val('make') && val('model'));
    var L = [
      ['Éclaté freins avant (Google)', ok && g(veh + ' éclaté freins avant catalogue pièces')],
      ['Éclaté freins avant (images)', ok && gi(veh + ' éclaté freins avant disque étrier plaquettes')],
      ['Brake parts diagram (images)', ok && gi(veh + ' front brake parts diagram exploded view')],
      ['PartSouq', 'https://partsouq.com/']
    ];
    els.liens.textContent = '';
    L.forEach(function (x) {
      if (x[1]) {
        var a = document.createElement('a');
        a.className = 'button';
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.href = x[1];
        a.textContent = x[0] + ' ↗';
        a.style.cssText = 'margin:6px 8px 0 0;display:inline-block;';
        els.liens.appendChild(a);
      } else {
        var s = document.createElement('span');
        s.className = 'button off';
        s.title = 'Marque et modèle manquants dans le dossier';
        s.textContent = x[0];
        s.style.cssText = 'margin:6px 8px 0 0;display:inline-block;';
        els.liens.appendChild(s);
      }
    });
  }

  function champ(parent, etiquette, node) {
    var lab = document.createElement('label');
    lab.style.cssText = 'display:block;margin-top:8px;font-size:0.9em;';
    lab.appendChild(document.createTextNode(etiquette));
    lab.appendChild(document.createElement('br'));
    node.style.width = '100%';
    node.style.boxSizing = 'border-box';
    lab.appendChild(node);
    parent.appendChild(lab);
  }
  function select(tab) {
    var s = document.createElement('select');
    tab.forEach(function (o) {
      var op = document.createElement('option');
      op.value = o[0]; op.textContent = o[1];
      s.appendChild(op);
    });
    return s;
  }
  function texte(ph) {
    var i = document.createElement('input');
    i.type = 'text';
    i.placeholder = ph;
    return i;
  }
  function bouton(txt) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'button';
    b.textContent = txt;
    b.style.cssText = 'margin:8px 8px 0 0;';
    return b;
  }

  function enregistrer() {
    var ref = els.ref.value.trim().toUpperCase();
    if (!REF_RE.test(ref)) { els.msg.textContent = 'Référence illisible (4 à 30 caractères : lettres, chiffres, espace, point, tiret). Rien n\'est enregistré.'; return; }
    var nature = els.nature.value, via = els.via.value, detail = els.detail.value.trim();
    if (!nature) { els.msg.textContent = 'Choisis la nature de la source.'; return; }
    if (!via) { els.msg.textContent = 'Indique comment l\'éclaté a été consulté.'; return; }
    if (!detail) { els.msg.textContent = 'Indique le site et le nom de la planche ou du groupe.'; return; }
    var date = els.date.value.trim() || (maintenant() + ' (date de saisie)');
    var tout = charger();
    var k = cle();
    var cur = Array.isArray(tout[k]) ? tout[k] : [];
    cur.push({
      ref: ref, repere: els.repere.value.trim(), desig: els.desig.value.trim(),
      nature: nature, via: via, detail: detail, date: date, fort: estFort(nature, via)
    });
    tout[k] = cur;
    if (!sauver(tout)) { els.msg.textContent = 'Échec de l\'enregistrement local (stockage refusé).'; return; }
    els.ref.value = ''; els.repere.value = ''; els.desig.value = ''; els.detail.value = ''; els.date.value = '';
    els.nature.value = ''; els.via.value = '';
    els.msg.textContent = 'Lecture enregistrée. Aucune case n\'a été cochée.';
    rendu();
  }

  function copier() {
    var txt = resume();
    function repli() {
      var ta = document.createElement('textarea');
      ta.value = txt;
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      var r = false;
      try { r = document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta);
      els.msg.textContent = r ? 'Résumé copié.' : 'Copie impossible : sélectionne le texte à la main.';
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(function () { els.msg.textContent = 'Résumé copié.'; }, repli);
    } else repli();
  }

  function creerCarte() {
    var c = document.createElement('div');
    c.id = 'ec-carte';
    c.style.cssText = 'border:1px solid #ccc;border-radius:10px;padding:12px;margin:14px 0;';
    var h = document.createElement('h3');
    h.style.marginTop = '0';
    h.textContent = 'Éclatés : liens et références lues';
    c.appendChild(h);

    var p = document.createElement('p');
    p.style.fontSize = '0.9em';
    p.textContent = 'Les éclatés appartiennent à leurs éditeurs : aucune image n\'est intégrée ici. Les liens sont de simples recherches ; le VIN et la plaque n\'y sont pas inclus. Un éclaté donne une référence, pas la compatibilité avec le véhicule. Cette carte ne coche rien et ne modifie aucun champ.';
    c.appendChild(p);

    els.liens = document.createElement('div');
    c.appendChild(els.liens);

    els.dossier = document.createElement('p');
    els.dossier.style.cssText = 'font-size:0.85em;margin:10px 0 4px;';
    c.appendChild(els.dossier);

    els.statut = document.createElement('p');
    els.statut.style.cssText = 'padding:8px 10px;margin:6px 0;font-weight:bold;';
    c.appendChild(els.statut);

    els.liste = document.createElement('div');
    c.appendChild(els.liste);

    var f = document.createElement('div');
    f.style.marginTop = '10px';
    var ft = document.createElement('strong');
    ft.textContent = 'Consigner une référence lue';
    f.appendChild(ft);

    els.ref = texte('référence exactement comme affichée');
    champ(f, 'Référence lue', els.ref);
    els.repere = texte('numéro sur le dessin (facultatif)');
    champ(f, 'Repère sur l\'éclaté', els.repere);
    els.desig = texte('ex. plaquettes avant (facultatif)');
    champ(f, 'Désignation', els.desig);
    els.nature = select(NAT);
    champ(f, 'Nature de la source', els.nature);
    els.via = select(VIA);
    champ(f, 'Éclaté consulté', els.via);
    els.detail = texte('site + nom de la planche ou du groupe');
    champ(f, 'Source', els.detail);
    els.date = texte('vide = date et heure de saisie');
    champ(f, 'Date et heure (facultatif)', els.date);
    c.appendChild(f);

    var bE = bouton('Enregistrer cette lecture');
    var bC = bouton('Copier le résumé');
    bE.addEventListener('click', enregistrer);
    bC.addEventListener('click', copier);
    c.appendChild(bE);
    c.appendChild(bC);

    els.msg = document.createElement('p');
    els.msg.style.fontSize = '0.9em';
    els.msg.textContent = 'Prêt.';
    c.appendChild(els.msg);

    var r = document.createElement('p');
    r.style.fontSize = '0.85em';
    r.textContent = 'Rappel : pour qu\'une référence compte, consigne la source en section 6 (catalogue constructeur ou professionnel) ; les cases se cochent toi-même, après.';
    c.appendChild(r);
    return c;
  }

  function inserer() {
    if ($('ec-carte')) return true;
    var ancre = $('dd-carte') || $('lv-carte') || $('dc-carte');
    var carte;
    if (ancre && ancre.parentNode) {
      carte = creerCarte();
      ancre.parentNode.insertBefore(carte, ancre);
    } else {
      var fl = $('famList');
      if (!fl || !fl.parentNode) return false;
      carte = creerCarte();
      fl.parentNode.insertBefore(carte, fl.nextSibling);
    }
    rendu();
    var dk = cle(), dv = [val('make'), val('model'), val('year'), val('engine')].join('|');
    setInterval(function () {
      var k = cle(), v = [val('make'), val('model'), val('year'), val('engine')].join('|');
      if (k !== dk || v !== dv) { dk = k; dv = v; rendu(); }
    }, 1500);
    return true;
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
