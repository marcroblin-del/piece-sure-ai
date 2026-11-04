/* PIÈCE-SÛRE AI — connecteur-plaque.js (v4)
   v4 : le champ de la plaque s'appelle désormais « valeur », conformément au
   contrat du connecteur serveur (lu et vérifié dans le code déployé).
   v3 : plaque mise au format standard (majuscules, sans tirets ni espaces).
   v2 : remplacement du bandeau limité à la petite ligne « MODE LOCAL ».
   - Aucune clé API ici : la clé vit uniquement dans le connecteur Cloudflare.
   - Aucune phrase d'accès ici : elle reste sur cet appareil (localStorage).
   - Le résultat est une INFORMATION REÇUE : aucune case de la section 2 n'est
     cochée, la commande reste bloquée tant que la vérification n'est pas faite. */

(function () {
  "use strict";

  var URL_CONNECTEUR = "https://piece-sure-connecteur.marcroblin48.workers.dev/";
  var CLE_PHRASE = "pieceSurePhrase";
  var TEXTE_BANDEAU = "CONNECTEUR PLAQUE : ACTIF · VÉRIFICATION TOUJOURS MANUELLE";
  var REGEX_PLAQUE = /^[A-HJ-NP-TV-Z]{2}[0-9]{3}[A-HJ-NP-TV-Z]{2}$/;

  var emplacementCarte = "?";
  var bandeauRemplace = false;
  var derniereTrace = null;

  /* ---------- outils ---------- */

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function dateLisible(iso) {
    var d = iso ? new Date(iso) : new Date();
    if (isNaN(d.getTime())) return String(iso || "");
    function p(n) { return (n < 10 ? "0" : "") + n; }
    return p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear() +
      " à " + p(d.getHours()) + ":" + p(d.getMinutes()) + " (heure de cet appareil)";
  }

  function formatValide(brut) {
    var v = String(brut || "").trim().toUpperCase().replace(/[\s.\-]/g, "");
    return REGEX_PLAQUE.test(v);
  }

  function formatStandard(brut) {
    return String(brut || "").trim().toUpperCase().replace(/[\s.\-]/g, "");
  }

  function copier(texte, bouton) {
    function reussi() {
      if (!bouton) return;
      var avant = bouton.textContent;
      bouton.textContent = "Copié ✓";
      setTimeout(function () { bouton.textContent = avant; }, 2000);
    }
    function secours() {
      var t = document.createElement("textarea");
      t.value = texte;
      t.setAttribute("readonly", "");
      t.style.position = "fixed";
      t.style.left = "-9999px";
      document.body.appendChild(t);
      t.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) {}
      document.body.removeChild(t);
      if (ok) { reussi(); }
      else { window.alert("Copie automatique impossible : dites-le à l'assistant."); }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texte).then(reussi, secours);
    } else { secours(); }
  }

  /* ---------- apparence et structure de la carte ---------- */

  var CSS = [
    "#pc-carte{background:#1d2434;border:1px solid #3a4361;border-radius:12px;padding:16px;margin:18px 0;color:#e9ecf5;line-height:1.45}",
    "#pc-carte h2{margin:0 0 6px;font-size:1.15em}",
    "#pc-carte .pc-ligne{margin:4px 0;font-size:.92em;opacity:.9}",
    "#pc-carte .pc-note{margin:6px 0;font-size:.85em;opacity:.85}",
    "#pc-carte .pc-encadre{border-radius:10px;padding:10px 12px;margin:10px 0;font-size:.95em}",
    "#pc-carte .pc-info{background:#15304b;border:1px solid #2b5d8f}",
    "#pc-carte .pc-avert{background:#392a10;border:1px solid #a16207}",
    "#pc-carte .pc-erreur{background:#3a1518;border:1px solid #b0413e}",
    "#pc-carte .pc-label{display:block;margin:12px 0 4px;font-size:.9em;font-weight:600}",
    "#pc-carte .pc-champ{width:100%;box-sizing:border-box;padding:10px;border-radius:8px;border:1px solid #4a5372;background:#141927;color:#e9ecf5;font-size:1em;margin-bottom:8px}",
    "#pc-carte .pc-bouton{margin:4px 8px 4px 0;padding:10px 14px;border-radius:8px;border:1px solid #4a5372;background:#26304a;color:#e9ecf5;font-size:.95em;cursor:pointer}",
    "#pc-carte .pc-bouton:disabled{opacity:.5}",
    "#pc-carte .pc-principal{background:#2f5fd0;border-color:#2f5fd0;font-weight:600}",
    "#pc-carte .pc-lien{background:none;border:none;padding:4px 0;text-decoration:underline;opacity:.8}",
    "#pc-carte .pc-liste{margin:8px 0;padding-left:18px}",
    "#pc-carte .pc-liste li{margin:3px 0;font-size:.95em}",
    "#pc-carte .pc-pre{background:#0d1117;border:1px solid #39415a;border-radius:8px;padding:10px;font-size:.85em;white-space:pre-wrap;word-break:break-word}",
    "#pc-carte details{margin-top:12px}",
    "#pc-carte summary{cursor:pointer}"
  ].join(" ");

  var HTML_CARTE = [
    "<h2>🔌 Connecteur plaque</h2>",
    "<p class='pc-ligne'>Interroge le fournisseur de données véhicule via notre connecteur sécurisé. La clé API n'apparaît jamais sur cette page.</p>",
    "<div class='pc-encadre pc-info'><strong>Règle de la maison :</strong> ce qui arrive ici est une <strong>INFORMATION REÇUE</strong>, jamais une vérification. Rien ne sera coché dans la section 2 et la commande reste bloquée.</div>",
    "<label class='pc-label' for='pc-phrase'>Phrase d'accès (enregistrée sur cet appareil uniquement)</label>",
    "<input class='pc-champ' type='password' id='pc-phrase' autocomplete='off' placeholder=\"Phrase d'accès\">",
    "<button type='button' id='pc-effacer' class='pc-bouton pc-lien'>Effacer la phrase enregistrée</button>",
    "<label class='pc-label' for='pc-plaque'>Plaque d'immatriculation (format AA-123-AA)</label>",
    "<input class='pc-champ' type='text' id='pc-plaque' autocomplete='off' autocapitalize='characters' placeholder='AA-123-AA'>",
    "<p class='pc-note'>Avec ou sans tirets, la plaque est mise au format standard avant l'envoi. Plaque au format valide : 1 crédit chez le fournisseur — une confirmation sera demandée avant l'appel. Plaque invalide (ex. AI-123-AA) : test gratuit, la requête est refusée avant d'atteindre le fournisseur.</p>",
    "<button type='button' id='pc-interroger' class='pc-bouton pc-principal'>Interroger le connecteur</button>",
    "<div id='pc-resultat'></div>",
    "<button type='button' id='pc-trace' class='pc-bouton' hidden>Copier la trace pour le registre des sources</button>",
    "<details id='pc-bloc-diag'><summary>Diagnostic de l'installation (pour l'assistance)</summary>",
    "<button type='button' id='pc-diagnostic' class='pc-bouton'>Afficher le diagnostic</button>",
    "<pre id='pc-diag-sortie' class='pc-pre' hidden></pre>",
    "<button type='button' id='pc-copier-diag' class='pc-bouton' hidden>Copier le diagnostic</button>",
    "</details>"
  ].join("\n");

  /* ---------- installation ---------- */

  function headingParTexte(motif) {
    var t = document.querySelectorAll("h1,h2,h3,h4");
    for (var i = 0; i < t.length; i++) {
      if (motif.test((t[i].textContent || "").trim())) return t[i];
    }
    return null;
  }

  function decrireParent(el) {
    var p = el ? el.parentElement : null;
    if (!p) return "aucun";
    var cls = (typeof p.className === "string" && p.className.trim()) ? "." + p.className.trim().split(/\s+/).join(".") : "";
    return p.tagName.toLowerCase() + (p.id ? "#" + p.id : "") + cls;
  }

  function majBandeau() {
    var meilleur = null;
    function visiter(el) {
      if (!el) return;
      var t = (el.textContent || "").trim();
      if (t && t.length <= 160 && /aucune\s+api\s+connect/i.test(t)) {
        if (!meilleur || meilleur.contains(el)) meilleur = el;
      }
      for (var i = 0; i < el.children.length; i++) visiter(el.children[i]);
    }
    visiter(document.body);
    if (meilleur && meilleur !== document.body) {
      meilleur.textContent = TEXTE_BANDEAU;
      return true;
    }
    return false;
  }

  function installerCarte() {
    var carte = document.createElement("section");
    carte.id = "pc-carte";
    carte.innerHTML = HTML_CARTE;

    var h2 = headingParTexte(/statut\s+de\s+v[ée]rification/i);
    var h1 = headingParTexte(/dossier\s+v[ée]hicule/i);

    if (h2 && h2.parentElement) {
      h2.parentElement.insertBefore(carte, h2);
      emplacementCarte = "juste au-dessus du titre « Statut de vérification » (parent : " + decrireParent(h2) + ")";
    } else if (h1 && h1.parentElement && h1.parentElement.parentElement) {
      var bloc1 = h1.parentElement;
      bloc1.parentElement.insertBefore(carte, bloc1.nextSibling);
      emplacementCarte = "après le bloc « Dossier véhicule » (bloc : " + decrireParent(h1) + ")";
    } else if (h1 && h1.parentElement) {
      h1.parentElement.insertBefore(carte, h1);
      emplacementCarte = "au-dessus du titre « Dossier véhicule » (plan B)";
    } else {
      document.body.insertBefore(carte, document.body.firstChild);
      emplacementCarte = "en haut de page (aucun titre trouvé)";
    }

    try { bandeauRemplace = majBandeau(); } catch (e) { bandeauRemplace = false; }
  }

  /* ---------- branchement ---------- */

  function brancher() {
    $("pc-phrase").value = localStorage.getItem(CLE_PHRASE) || "";
    $("pc-phrase").addEventListener("input", function () {
      if (this.value) { localStorage.setItem(CLE_PHRASE, this.value); }
      else { localStorage.removeItem(CLE_PHRASE); }
    });
    $("pc-effacer").addEventListener("click", function () {
      localStorage.removeItem(CLE_PHRASE);
      $("pc-phrase").value = "";
    });
    $("pc-interroger").addEventListener("click", interroger);
    $("pc-trace").addEventListener("click", function () {
      if (derniereTrace) copier(derniereTrace, this);
    });
    $("pc-diagnostic").addEventListener("click", afficherDiagnostic);
    $("pc-copier-diag").addEventListener("click", function () {
      copier($("pc-diag-sortie").textContent, this);
    });
  }

  /* ---------- appel du connecteur ---------- */

  function rendu(conteneur, html) { conteneur.innerHTML = html; }

  function construireTrace(statut, libellePlaque, avecDonnees, iso) {
    return [
      "Trace connecteur — PIÈCE-SÛRE AI",
      "Date : " + dateLisible(iso),
      "Recherche : plaque " + libellePlaque,
      "Statut HTTP : " + statut,
      "Source : apiplaqueimmatriculation.com — réponse brute, NON VÉRIFIÉE",
      "Adresse utilisée : connecteur " + URL_CONNECTEUR + " (aucune clé API dans cette adresse)",
      "Niveau : " + (avecDonnees
        ? "INFORMATION REÇUE — aucune case cochée, commande toujours bloquée"
        : "Requête refusée — aucune information obtenue, rien à enregistrer comme source")
    ].join("\n");
  }

  function renduSucces(conteneur, rep, data) {
    var env = data || {};
    var db = env.donnees_brutes;
    var html = "<div class='pc-encadre pc-info'><strong>INFORMATION REÇUE</strong> · " +
      esc(dateLisible(env.date_consultation)) + " · Statut HTTP " + esc(rep.statut) + "</div>";
    if (db && typeof db === "object") {
      html += "<ul class='pc-liste'>";
      Object.keys(db).forEach(function (k) {
        var v = db[k];
        if (v === null || v === undefined || v === "") v = "—";
        else if (typeof v === "object") v = JSON.stringify(v);
        html += "<li><strong>" + esc(k) + " :</strong> " + esc(v) + "</li>";
      });
      html += "</ul>";
    } else {
      html += "<pre class='pc-pre'>" + esc(rep.texte) + "</pre>";
    }
    html += "<details><summary>Données brutes (JSON)</summary><pre class='pc-pre'>" + esc(rep.texte) + "</pre></details>";
    html += "<div class='pc-encadre pc-avert'>⚠️ <strong>Information reçue, non vérifiée :</strong> elle ne prouve pas la compatibilité d'une pièce. Aucune case de la section 2 n'a été cochée et la commande reste bloquée tant que la vérification n'est pas faite.</div>";
    rendu(conteneur, html);
  }

  function renduEchec(conteneur, rep, data) {
    var msg = (data && data.erreur) ? data.erreur : String(rep.texte || "").slice(0, 300);
    var html = "<div class='pc-encadre pc-erreur'><strong>Requête refusée (Statut HTTP " + esc(rep.statut) + ").</strong><br>" + esc(msg) + "</div>";
    if (rep.statut === 401) {
      html += "<p class='pc-note'>La phrase d'accès enregistrée ici ne correspond pas à celle du connecteur. Effacez-la (bouton ci-dessus) puis réécrivez-la — ou dites-le à l'assistant pour la réaligner des deux côtés.</p>";
    } else if (rep.statut === 400) {
      html += "<p class='pc-note'>Requête refusée avant d'atteindre le fournisseur : rien n'a été consommé.</p>";
    } else if (rep.statut === 500) {
      html += "<p class='pc-note'>Configuration interne du connecteur incomplète : dites-le à l'assistant (réparation en quelques minutes, aucune clé à retaper).</p>";
    } else if (rep.statut === 502) {
      html += "<p class='pc-note'>Le connecteur n'a pas réussi à joindre le fournisseur. Réessayez plus tard.</p>";
    }
    html += "<div class='pc-encadre pc-avert'>⚠️ Aucune case de la section 2 n'a été cochée et la commande reste bloquée.</div>";
    rendu(conteneur, html);
  }

  function interroger() {
    var phrase = $("pc-phrase").value.trim();
    var brut = $("pc-plaque").value.trim();
    var sortie = $("pc-resultat");

    if (!phrase) {
      rendu(sortie, "<div class='pc-encadre pc-erreur'>Renseignez d'abord la phrase d'accès, puis réessayez.</div>");
      return;
    }
    if (!brut) {
      rendu(sortie, "<div class='pc-encadre pc-erreur'>Tapez d'abord une plaque (ex. AA-123-AA, ou AI-123-AA pour un test gratuit).</div>");
      return;
    }

    /* v3 : mise au format standard avant envoi. */
    var standard = formatStandard(brut);
    var valide = formatValide(brut);
    var libelle = (standard === brut) ? brut : brut + " (format standard : " + standard + ")";

    var message = valide
      ? "Plaque au format VALIDE (" + standard + ").\nCette recherche réelle consommera 1 crédit chez le fournisseur.\nConfirmez-vous l'appel ?"
      : "Plaque au format NON reconnu.\nCe sera un TEST GRATUIT : le connecteur refusera la requête avant de contacter le fournisseur (0 crédit).\nConfirmez-vous l'appel ?";
    if (!window.confirm(message)) return;

    var b1 = $("pc-interroger");
    var b2 = $("pc-diagnostic");
    b1.disabled = true;
    b2.disabled = true;
    rendu(sortie, "<p class='pc-note'>Requête en cours…</p>");

    var controle = (typeof AbortController !== "undefined") ? new AbortController() : null;
    var minuteur = controle ? setTimeout(function () { controle.abort(); }, 20000) : null;

    fetch(URL_CONNECTEUR, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Access-Phrase": phrase },
      /* v4 : le champ s'appelle « valeur » — contrat du connecteur serveur, lu et vérifié. */
      body: JSON.stringify({ type: "plaque", valeur: standard }),
      signal: controle ? controle.signal : undefined
    }).then(function (r) {
      return r.text().then(function (txt) { return { statut: r.status, texte: txt }; });
    }).then(function (rep) {
      try {
        var data = null;
        try { data = JSON.parse(rep.texte); } catch (e) {}
        var avecDonnees = (rep.statut === 200 && data && data.donnees_brutes && typeof data.donnees_brutes === "object");
        derniereTrace = construireTrace(rep.statut, libelle, avecDonnees, data ? data.date_consultation : null);
        $("pc-trace").hidden = false;
        if (rep.statut >= 200 && rep.statut < 300) { renduSucces(sortie, rep, data); }
        else { renduEchec(sortie, rep, data); }
      } catch (e) {
        rendu(sortie, "<div class='pc-encadre pc-erreur'>Réponse reçue mais affichage impossible : dites-le à l'assistant.</div>");
      }
    }).catch(function () {
      rendu(sortie, "<div class='pc-encadre pc-erreur'>Échec réseau : le connecteur n'a pas pu être joint (ou n'a pas répondu en 20 secondes). Vérifiez la connexion, puis réessayez.</div>");
    }).then(function () {
      if (minuteur) clearTimeout(minuteur);
      b1.disabled = false;
      b2.disabled = false;
      try { sortie.scrollIntoView(); } catch (e) {}
    });
  }

  /* ---------- diagnostic (noms techniques uniquement, jamais les valeurs) ---------- */

  function afficherDiagnostic() {
    var lignes = [];
    lignes.push("DIAGNOSTIC CONNECTEUR-PLAQUE — à envoyer à l'assistant");
    lignes.push("Version du fichier connecteur : 4 (champ « valeur » aligné sur le contrat du serveur)");
    lignes.push("(noms techniques uniquement ; aucune valeur saisie n'est collectée)");
    lignes.push("");
    lignes.push("Carte insérée : " + emplacementCarte);
    lignes.push("Bandeau « aucune API connectée » : " + (bandeauRemplace ? "trouvé et remplacé" : "NON trouvé sur la page"));
    lignes.push("Phrase enregistrée sur cet appareil : " + (localStorage.getItem(CLE_PHRASE) ? "oui" : "non"));
    lignes.push("");
    lignes.push("TITRES DE SECTION (tag · id · texte · parent) :");
    var hs = document.querySelectorAll("h1,h2,h3,h4");
    for (var i = 0; i < hs.length; i++) {
      var t = (hs[i].textContent || "").trim().replace(/\s+/g, " ").slice(0, 60);
      lignes.push("- " + hs[i].tagName + " · id=" + (hs[i].id || "(aucun)") + " · « " + t + " » · parent=" + decrireParent(hs[i]));
    }
    lignes.push("");
    lignes.push("CHAMPS (id · name · type · label) :");
    var champs = document.querySelectorAll("input,select,textarea");
    for (var j = 0; j < champs.length; j++) {
      var c = champs[j];
      if ((c.id || "").indexOf("pc-") === 0) continue;
      var lab = "";
      if (c.id) {
        var l = document.querySelector("label[for='" + c.id + "']");
        if (l) lab = (l.textContent || "").trim().replace(/\s+/g, " ").slice(0, 60);
      }
      if (!lab && c.closest) {
        var anc = c.closest("label");
        if (anc) lab = (anc.textContent || "").trim().replace(/\s+/g, " ").slice(0, 60);
      }
      lignes.push("- id=" + (c.id || "(aucun)") + " · name=" + (c.getAttribute("name") || "(aucun)") + " · type=" + (c.type || c.tagName.toLowerCase()) + (lab ? " · label=« " + lab + " »" : ""));
    }
    var sortie = $("pc-diag-sortie");
    sortie.textContent = lignes.join("\n");
    sortie.hidden = false;
    $("pc-copier-diag").hidden = false;
  }

  /* ---------- démarrage ---------- */

  function init() {
    try {
      var style = document.createElement("style");
      style.id = "pc-style";
      style.textContent = CSS;
      document.head.appendChild(style);
      installerCarte();
      brancher();
    } catch (e) {
      if (window.console && console.error) console.error("connecteur-plaque : installation impossible", e);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
