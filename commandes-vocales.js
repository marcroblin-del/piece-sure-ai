/* PIÈCE-SÛRE AI — commandes vocales v1
   La voix remplit et propose. Elle ne coche rien, ne valide rien, ne modifie aucun champ du dossier.
   ATTENTION : la reconnaissance vocale du navigateur peut envoyer le son à un service externe (Apple sur iPad). */
(function () {
  'use strict';

  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var els = {};
  var rec = null, minuteur = null, attente = null, erreurVue = false;

  function $(id) { return document.getElementById(id); }
  function norm(s) {
    var t = String(s || '').toLowerCase();
    try { t = t.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (e) {}
    return t.replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  var CIBLES = [
    [/diametre|disque/, 'dd-carte', 'la carte « Diamètre des disques avant »'],
    [/eclate/, 'ec-carte', 'la carte « Éclatés »'],
    [/demande|comptoir|message/, 'dc-carte', 'la carte « Demande de confirmation »'],
    [/lecture|voix/, 'lv-carte', 'la carte « Lecture à voix haute »'],
    [/plaque|connecteur/, 'pc-carte', 'la carte du connecteur plaque'],
    [/assistant|saisie/, 'nlInput', 'l\'assistant de saisie'],
    [/point|famille|freinage/, 'famList', 'la liste des points à confirmer']
  ];

  function boutonDans(carteId, debut) {
    var c = $(carteId);
    if (!c) return null;
    var bs = c.querySelectorAll('button');
    for (var i = 0; i < bs.length; i++) {
      if (bs[i].textContent.trim().indexOf(debut) === 0) return bs[i];
    }
    return null;
  }

  function interpreter(brut) {
    var t = norm(brut);
    var sans = t.replace(/points? a confirmer/g, '');
    if (/\b(coch|valid|confirm|command|enregistr|supprim|effac|vid|envoy|appliqu|ajout|modifi)/.test(sans)) {
      return { refus: true };
    }
    if (/\b(stop|arret|tais|silence)/.test(t)) {
      return {
        label: 'arrêter la lecture à voix haute',
        run: function () {
          try { window.speechSynthesis.cancel(); } catch (e) {}
          var b = boutonDans('lv-carte', 'Arrêter');
          if (b) b.click();
          return 'Lecture arrêtée.';
        }
      };
    }
    if (/\b(lire|lis|lisez)\b/.test(t) && /point|confirm|freinage/.test(t)) {
      return {
        label: 'lancer la lecture à voix haute des points à confirmer',
        run: function () {
          var b = boutonDans('lv-carte', 'Lire');
          if (!b) return 'La carte de lecture est introuvable. Rien n\'a été fait.';
          b.click();
          return 'Lecture lancée.';
        }
      };
    }
    if (/\b(va|aller|allez|montre|affiche|descends)\b/.test(t)) {
      for (var i = 0; i < CIBLES.length; i++) {
        if (CIBLES[i][0].test(t)) {
          return (function (id, nom) {
            return {
              label: 'aller à ' + nom,
              run: function () {
                var e = $(id);
                if (!e) return 'Cet élément est introuvable. Rien n\'a été fait.';
                e.scrollIntoView({ behavior: 'smooth', block: 'start' });
                return 'Affichage de ' + nom + '.';
              }
            };
          })(CIBLES[i][1], CIBLES[i][2]);
        }
      }
    }
    return null;
  }

  function effacerAttente() {
    attente = null;
    els.prop.style.display = 'none';
    els.propTexte.textContent = '';
  }

  function proposer(cmd) {
    attente = cmd;
    els.propTexte.textContent = 'Commande comprise : ' + cmd.label + '. Exécuter ?';
    els.prop.style.display = 'block';
  }

  function traiter(mode, texte) {
    els.entendu.textContent = 'J\'ai entendu : « ' + texte + ' »';
    if (mode === 'dicter') {
      var ta = $('nlInput');
      if (!ta) {
        els.msg.textContent = 'La zone de l\'assistant de saisie est introuvable. Rien n\'a été ajouté.';
        return;
      }
      var cur = ta.value ? ta.value.replace(/\s+$/, '') + ' ' : '';
      ta.value = cur + texte;
      try { ta.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
      els.msg.textContent = 'Texte ajouté dans l\'assistant de saisie. Relis-le (références et chiffres surtout), puis touche « Analyser » toi-même. Aucun champ du dossier n\'a été modifié.';
      return;
    }
    var cmd = interpreter(texte);
    if (!cmd) {
      els.msg.textContent = 'Commande non reconnue. Rien n\'est fait. Exemples : « va au diamètre », « lis les points à confirmer », « arrête ».';
      return;
    }
    if (cmd.refus) {
      els.msg.textContent = 'Refusé : la voix ne coche, ne valide, ne confirme, ne commande et ne modifie rien. Fais-le à la main.';
      return;
    }
    els.msg.textContent = 'Rien ne s\'exécute sans ton accord.';
    proposer(cmd);
  }

  function arreterEcoute() {
    clearTimeout(minuteur);
    if (rec) { try { rec.abort(); } catch (e) {} rec = null; }
  }

  function messageErreur(code) {
    if (code === 'not-allowed' || code === 'service-not-allowed') {
      return 'Micro ou reconnaissance vocale refusés ou indisponibles ici. Autorise le micro dans les réglages de l\'iPad, ou utilise la touche micro du clavier dans l\'assistant de saisie.';
    }
    if (code === 'no-speech') return 'Aucune voix entendue.';
    if (code === 'audio-capture') return 'Aucun micro détecté.';
    if (code === 'network') return 'Le service de reconnaissance est injoignable (réseau).';
    if (code === 'aborted') return 'Écoute interrompue.';
    return 'Erreur de reconnaissance vocale (' + code + ').';
  }

  function ecouter(mode) {
    if (!els.accord.checked) {
      els.msg.textContent = 'Coche d\'abord la case d\'accord sur l\'envoi possible du son.';
      return;
    }
    try { window.speechSynthesis.cancel(); } catch (e) {}
    arreterEcoute();
    effacerAttente();
    els.entendu.textContent = '';
    erreurVue = false;
    var recu = false;
    try { rec = new SR(); } catch (e) {
      els.msg.textContent = 'Impossible de démarrer la reconnaissance vocale ici.';
      return;
    }
    rec.lang = 'fr-FR';
    rec.interimResults = false;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    rec.onstart = function () { els.etat.textContent = 'Écoute en cours… parle maintenant.'; };
    rec.onresult = function (ev) {
      recu = true;
      var r = ev.results && ev.results[0] && ev.results[0][0];
      traiter(mode, r ? String(r.transcript).trim() : '');
    };
    rec.onerror = function (ev) {
      erreurVue = true;
      els.msg.textContent = messageErreur(ev && ev.error ? ev.error : 'inconnue');
    };
    rec.onend = function () {
      clearTimeout(minuteur);
      els.etat.textContent = 'Prêt.';
      if (!recu && !erreurVue) els.msg.textContent = 'Rien entendu.';
      rec = null;
    };
    try { rec.start(); } catch (e) {
      els.msg.textContent = 'Démarrage impossible : ' + e.message;
      return;
    }
    minuteur = setTimeout(arreterEcoute, 12000);
  }

  function bouton(txt) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'button';
    b.textContent = txt;
    b.style.cssText = 'margin:8px 8px 0 0;';
    return b;
  }

  function creerCarte() {
    var c = document.createElement('div');
    c.id = 'cv-carte';
    c.style.cssText = 'border:1px solid #ccc;border-radius:10px;padding:12px;margin:14px 0;';
    var h = document.createElement('h3');
    h.style.marginTop = '0';
    h.textContent = 'Commandes vocales';
    c.appendChild(h);

    var p = document.createElement('p');
    p.style.fontSize = '0.9em';
    p.textContent = 'La voix remplit et propose : elle ne coche rien, ne valide rien, ne confirme aucune référence et ne modifie aucun champ du dossier.';
    c.appendChild(p);

    var w = document.createElement('p');
    w.style.cssText = 'font-size:0.9em;padding:8px 10px;border-left:6px solid #b26a00;';
    w.textContent = 'ATTENTION : sur iPad, la reconnaissance vocale peut envoyer le son à Apple. Ne dicte ni VIN, ni plaque, ni nom de client. Cette fonction fait exception à la mention « rien n\'est envoyé ».';
    c.appendChild(w);

    if (!SR) {
      var nd = document.createElement('p');
      nd.textContent = 'La reconnaissance vocale n\'est pas disponible dans ce navigateur. Utilise la touche micro du clavier de l\'iPad dans l\'assistant de saisie.';
      c.appendChild(nd);
      return c;
    }

    var lab = document.createElement('label');
    lab.style.cssText = 'display:block;font-size:0.9em;margin:8px 0;';
    els.accord = document.createElement('input');
    els.accord.type = 'checkbox';
    lab.appendChild(els.accord);
    lab.appendChild(document.createTextNode(' Je sais que le son peut être envoyé à un service externe, et je ne dicte aucune donnée personnelle.'));
    c.appendChild(lab);

    els.bDicter = bouton('Dicter une demande');
    els.bCmd = bouton('Commande vocale');
    els.bStop = bouton('Arrêter l\'écoute');
    els.bDicter.disabled = true;
    els.bCmd.disabled = true;
    els.accord.addEventListener('change', function () {
      els.bDicter.disabled = !els.accord.checked;
      els.bCmd.disabled = !els.accord.checked;
    });
    els.bDicter.addEventListener('click', function () { ecouter('dicter'); });
    els.bCmd.addEventListener('click', function () { ecouter('commande'); });
    els.bStop.addEventListener('click', function () { arreterEcoute(); els.msg.textContent = 'Écoute arrêtée.'; });
    c.appendChild(els.bDicter);
    c.appendChild(els.bCmd);
    c.appendChild(els.bStop);

    els.etat = document.createElement('p');
    els.etat.style.fontSize = '0.9em';
    els.etat.textContent = 'Prêt.';
    c.appendChild(els.etat);

    els.entendu = document.createElement('p');
    els.entendu.style.cssText = 'font-size:0.9em;font-style:italic;';
    c.appendChild(els.entendu);

    els.prop = document.createElement('div');
    els.prop.style.cssText = 'display:none;padding:8px;border:1px solid #888;border-radius:6px;margin:6px 0;';
    els.propTexte = document.createElement('div');
    els.prop.appendChild(els.propTexte);
    var bX = bouton('Exécuter');
    var bA = bouton('Annuler');
    bX.addEventListener('click', function () {
      if (!attente) return;
      var cmd = attente;
      effacerAttente();
      var r;
      try { r = cmd.run(); } catch (e) { r = 'Échec : ' + e.message; }
      els.msg.textContent = r || 'Fait.';
    });
    bA.addEventListener('click', function () {
      effacerAttente();
      els.msg.textContent = 'Commande annulée. Rien n\'a été fait.';
    });
    els.prop.appendChild(bX);
    els.prop.appendChild(bA);
    c.appendChild(els.prop);

    els.msg = document.createElement('p');
    els.msg.style.fontSize = '0.9em';
    els.msg.textContent = 'Commandes comprises : « va au diamètre », « va aux éclatés », « va à la demande », « va aux points », « lis les points à confirmer », « arrête ».';
    c.appendChild(els.msg);

    window.addEventListener('pagehide', arreterEcoute);
    return c;
  }

  function inserer() {
    if ($('cv-carte')) return true;
    var ancre = $('ec-carte') || $('dd-carte') || $('lv-carte') || $('dc-carte');
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
