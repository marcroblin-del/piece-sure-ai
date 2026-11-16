/* PIÈCE-SÛRE AI — diamètre des disques avant v1
   Carte locale : ne modifie aucun champ, ne coche rien, aucun réseau. */
(function () {
  'use strict';

  var KEY = 'pieceSureAI_diam_v1';
  var NAT = [
    ['', '— choisir —'],
    ['constructeur', 'Catalogue constructeur (Renault)'],
    ['pro', 'Catalogue professionnel (distributeur)'],
    ['comptoir', 'Réponse d\'un comptoir / distributeur'],
    ['mesure', 'Mesure sur le véhicule ou le disque déposé'],
    ['grand', 'Site grand public (ex. Autodoc)'],
    ['autre', 'Autre']
  ];
  var VIA = [
    ['', '— choisir —'],
    ['vin', 'Avec le VIN'],
    ['plaque', 'Avec la plaque seule'],
    ['modele', 'Avec marque / modèle / année'],
    ['direct', 'Mesure directe']
  ];
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
    if (nature === 'mesure') return via === 'direct';
    if (nature === 'constructeur' || nature === 'pro' || nature === 'comptoir') return via === 'vin';
    return false;
  }

  function uniques(l) {
    var r = [];
    l.forEach(function (e) { if (r.indexOf(e.valeur) < 0) r.push(e.valeur); });
    return r;
  }

  function statut(l) {
    if (!l.length) return { c: '#888', t: 'NON RENSEIGNÉ — aucune valeur consignée.' };
    var forts = l.filter(function (e) { return e.fort; });
    var vf = uniques(forts);
    var tous = uniques(l);
    if (vf.length > 1) {
      return { c: '#c62828', t: 'CONFLIT — des sources fiables donnent des valeurs différentes (' + vf.join(' / ') + ' mm). Ne rien commander avant de trancher.' };
    }
    if (vf.length === 1) {
      var autres = tous.filter(function (v) { return v !== vf[0]; });
      return { c: '#2e7d32', t: 'CONFIRMÉ — ' + vf[0] + ' mm (' + forts.length + ' source(s) fiable(s) avec VIN ou mesure directe).' +
        (autres.length ? ' Autres valeurs non fiables : ' + autres.join(' / ') + ' mm.' : '') };
    }
    return { c: '#b26a00', t: 'NON CONFIRMÉ — valeur(s) lue(s) : ' + tous.join(' / ') + ' mm. Aucune source fiable consultée avec le VIN. Ne pas commander sur cette base.' };
  }

  function resume() {
    var l = liste();
    var s = statut(l);
    var lignes = ['Diamètre des disques avant — dossier ' + cle(), s.t];
    l.forEach(function (e, i) {
      lignes.push((i + 1) + '. ' + e.valeur + ' mm · ' + libelle(NAT, e.nature) + ' · ' + libelle(VIA, e.via) +
        ' · ' + e.date + ' · ' + e.detail + ' · ' + (e.fort ? 'source fiable' : 'non fiable'));
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
      t.textContent = e.valeur + ' mm · ' + libelle(NAT, e.nature) + ' · ' + libelle(VIA, e.via) + ' · ' + e.date +
        ' · ' + e.detail + ' · ' + (e.fort ? 'SOURCE FIABLE' : 'non fiable');
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
  function bouton(txt) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'button';
    b.textContent = txt;
    b.style.cssText = 'margin:8px 8px 0 0;';
    return b;
  }

  function enregistrer() {
    var v = parseFloat(String(els.valeur.value).replace(',', '.'));
    if (!isFinite(v)) { els.msg.textContent = 'Valeur manquante ou illisible. Rien n\'est enregistré.'; return; }
    if (v < 150 || v > 450) { els.msg.textContent = 'Valeur hors plage plausible (150 à 450 mm). Rien n\'est enregistré.'; return; }
    v = Math.round(v * 10) / 10;
    var nature = els.nature.value, via = els.via.value;
    var detail = els.detail.value.trim();
    if (!nature) { els.msg.textContent = 'Choisis la nature de la source.'; return; }
    if (!via) { els.msg.textContent = 'Indique comment la source a été consultée.'; return; }
    if (!detail) { els.msg.textContent = 'Indique la source : site et référence de l\'article, ou nom du contact et catalogue consulté.'; return; }
    if (nature === 'mesure' && via !== 'direct') { els.msg.textContent = 'Une mesure se consigne avec « Mesure directe ».'; return; }
    var date = els.date.value.trim();
    if (!date) date = maintenant() + ' (date de saisie)';
    var tout = charger();
    var k = cle();
    var cur = Array.isArray(tout[k]) ? tout[k] : [];
    cur.push({ valeur: v, nature: nature, via: via, detail: detail, date: date, fort: estFort(nature, via) });
    tout[k] = cur;
    if (!sauver(tout)) { els.msg.textContent = 'Échec de l\'enregistrement local (stockage refusé).'; return; }
    els.valeur.value = ''; els.detail.value = ''; els.date.value = '';
    els.nature.value = ''; els.via.value = '';
    els.msg.textContent = 'Valeur enregistrée. Aucune case n\'a été cochée.';
    rendu();
  }

  function copier() {
    var txt = resume();
    function ok() { els.msg.textContent = 'Résumé copié.'; }
    function repli() {
      var ta = document.createElement('textarea');
      ta.value = txt;
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      var r = false;
      try { r = document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta);
      els.msg.textContent = r ? 'Résumé copié.' : 'Copie impossible : sélectionne le texte du statut à la main.';
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(ok, repli);
    } else repli();
  }

  function creerCarte() {
    var c = document.createElement('div');
    c.id = 'dd-carte';
    c.style.cssText = 'border:1px solid #ccc;border-radius:10px;padding:12px;margin:14px 0;';
    var h = document.createElement('h3');
    h.style.marginTop = '0';
    h.textContent = 'Diamètre des disques avant';
    c.appendChild(h);

    var p = document.createElement('p');
    p.style.fontSize = '0.9em';
    p.textContent = 'Carte locale, sans réseau. Elle consigne les valeurs et calcule un statut. Elle ne coche aucune case et ne modifie aucun champ. Un site grand public ou une consultation par plaque seule ne donne jamais « confirmé ».';
    c.appendChild(p);

    els.dossier = document.createElement('p');
    els.dossier.style.cssText = 'font-size:0.85em;margin:4px 0;';
    c.appendChild(els.dossier);

    els.statut = document.createElement('p');
    els.statut.style.cssText = 'padding:8px 10px;margin:6px 0;font-weight:bold;';
    c.appendChild(els.statut);

    els.liste = document.createElement('div');
    c.appendChild(els.liste);

    var f = document.createElement('div');
    f.style.cssText = 'margin-top:10px;';
    var ft = document.createElement('strong');
    ft.textContent = 'Ajouter une valeur';
    f.appendChild(ft);

    els.valeur = document.createElement('input');
    els.valeur.type = 'text';
    els.valeur.setAttribute('inputmode', 'decimal');
    els.valeur.placeholder = 'ex. 280 (en mm)';
    champ(f, 'Diamètre extérieur (mm)', els.valeur);

    els.nature = select(NAT);
    champ(f, 'Nature de la source', els.nature);

    els.via = select(VIA);
    champ(f, 'Source consultée', els.via);

    els.detail = document.createElement('input');
    els.detail.type = 'text';
    els.detail.placeholder = 'site + référence article, ou nom du contact + catalogue';
    champ(f, 'Source ou contact', els.detail);

    els.date = document.createElement('input');
    els.date.type = 'text';
    els.date.placeholder = 'vide = date et heure de saisie';
    champ(f, 'Date et heure de la réponse (facultatif)', els.date);

    c.appendChild(f);

    var bE = bouton('Enregistrer cette valeur');
    var bC = bouton('Copier le résumé');
    bE.addEventListener('click', enregistrer);
    bC.addEventListener('click', copier);
    c.appendChild(bE);
    c.appendChild(bC);

    els.msg = document.createElement('p');
    els.msg.style.cssText = 'font-size:0.9em;';
    els.msg.textContent = 'Prêt.';
    c.appendChild(els.msg);

    var r = document.createElement('p');
    r.style.cssText = 'font-size:0.85em;';
    r.textContent = 'Rappel : ce statut ne remplace pas le registre. Pour cocher « Diamètre du disque relevé » en section 4, consigne d\'abord la source en section 6 (catalogue constructeur ou professionnel), puis coche la case toi-même.';
    c.appendChild(r);
    return c;
  }

  function inserer() {
    if ($('dd-carte')) return true;
    var ancre = $('lv-carte') || $('dc-carte');
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
    var derniere = cle();
    setInterval(function () {
      var k = cle();
      if (k !== derniere) { derniere = k; rendu(); }
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
