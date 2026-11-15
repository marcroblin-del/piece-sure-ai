/* demande-confirmation.js — v1
   Prépare un message de demande de confirmation pour un comptoir pièces.
   Aucun réseau, aucun crédit. Ne modifie aucun champ, ne coche aucune règle,
   n'écrit rien au registre des sources. */
(function () {
  "use strict";
  if (document.getElementById("dc-carte")) return;

  var VIN_OK = /^[A-HJ-NPR-Z0-9]{17}$/;
  var mode = "long";
  var zone, alerteEl, etatEl;

  function val(id) {
    var e = document.getElementById(id);
    return e ? String(e.value || "").trim() : "";
  }

  function trouverAncre() {
    var titres = document.querySelectorAll("h1,h2,h3,h4");
    for (var i = 0; i < titres.length; i++) {
      var t = (titres[i].textContent || "").replace(/\s+/g, " ");
      if (/points à confirmer/i.test(t)) {
        var el = titres[i];
        for (var n = 0; n < 6; n++) {
          var p = el.parentElement;
          if (!p || p === document.body) break;
          if (window.getComputedStyle(p).display === "grid") return el;
          el = p;
        }
        return titres[i].closest("section, .card, article") || titres[i].parentElement;
      }
    }
    return null;
  }

  function construire() {
    var marque = val("make"), modele = val("model"), annee = val("year");
    var plaque = val("plate");
    var vin = val("vin").toUpperCase().replace(/\s+/g, "");
    var moteur = val("engine"), carb = val("fuel");
    var type = val("type"), recep = val("approval"), demande = val("request");
    var vinOk = VIN_OK.test(vin);
    var alertes = [];

    if (!vin) {
      alertes.push("VIN non renseigné : sans lui, le comptoir ne peut pas confirmer la compatibilité.");
    } else if (!vinOk) {
      alertes.push("Le VIN saisi n'est pas valide (17 caractères, sans I, O, Q). Relisez-le sur la carte grise, champ E. Il n'est pas inclus dans le message.");
    }
    if (!marque || !modele) alertes.push("Marque ou modèle manquant dans le dossier.");
    if (!demande) alertes.push("Aucune demande client dans le dossier : le message reste générique.");

    var veh = [marque, modele].filter(Boolean).join(" ");
    if (annee) veh += " (" + annee + ")";

    var frein = /plaquette|frein|disque|étrier|etrier/i.test(demande);
    var questions = frein ? [
      "le diamètre extérieur des disques avant pour ce VIN, en mm (s'il existe plusieurs montages, quel critère les distingue : code de freinage, PR, taille de jante ?)",
      "disque plein ou ventilé, et épaisseur neuve",
      "la référence d'origine constructeur des plaquettes avant, avec ou sans capteur d'usure",
      "la référence d'origine des disques avant",
      "les références de qualité équivalente compatibles avec ce VIN",
      "la disponibilité et le délai"
    ] : [
      "la référence d'origine constructeur de la pièce demandée",
      "sa compatibilité avec ce VIN",
      "les références de qualité équivalente compatibles avec ce VIN",
      "la disponibilité et le délai"
    ];

    var L = [
      "Bonjour,", "",
      "Je prépare une demande de pièce et je souhaite vérifier la compatibilité dans votre catalogue, avec le VIN complet.", "",
      "Véhicule : " + (veh || "à préciser")
    ];
    if (plaque) L.push("Plaque : " + plaque);
    L.push("VIN : " + (vinOk ? vin : "à fournir"));
    if (type) L.push("Type (D.2) : " + type);
    if (recep) L.push("Réception (K) : " + recep);
    var mot = [moteur, carb].filter(Boolean).join(", ");
    if (mot) L.push("Motorisation : " + mot + " (indiquée dans mon dossier, non confirmée)");
    L.push("Pièce demandée : " + (demande || "à préciser"));
    L.push("", "Pouvez-vous me confirmer, d'après votre catalogue :");
    for (var i = 0; i < questions.length; i++) L.push((i + 1) + ") " + questions[i]);
    L.push("", "Pouvez-vous aussi m'indiquer quel catalogue vous avez consulté, et votre nom ?",
           "Une réponse écrite (message ou photo de l'écran) me permettra de la consigner. Merci.");

    var court = "Bonjour, " + (veh || "véhicule à préciser") +
      (plaque ? ", " + plaque : "") + ", VIN " + (vinOk ? vin : "à fournir") +
      ". Demande : " + (demande || "à préciser") + ". Pouvez-vous me donner : " +
      (frein ? "le diamètre des disques avant, la référence d'origine des plaquettes (avec ou sans capteur d'usure), la compatibilité avec ce VIN"
             : "la référence d'origine et la compatibilité avec ce VIN") +
      ", ainsi que la disponibilité et le délai ? Quel catalogue consultez-vous ? Merci.";

    return { long: L.join("\n"), court: court, alertes: alertes };
  }

  function rafraichir() {
    var r = construire();
    alerteEl.textContent = r.alertes.join(" ");
    alerteEl.style.display = r.alertes.length ? "block" : "none";
    zone.value = mode === "long" ? r.long : r.court;
    etatEl.textContent = "";
  }

  function copier() {
    var texte = zone.value;
    function ok() { etatEl.textContent = "Copié. Collez-le dans votre messagerie."; }
    function secours() {
      try {
        zone.focus(); zone.select(); zone.setSelectionRange(0, texte.length);
        etatEl.textContent = document.execCommand("copy") ? "Copié. Collez-le dans votre messagerie." : "Copie impossible : sélectionnez le texte à la main.";
      } catch (e) { etatEl.textContent = "Copie impossible : sélectionnez le texte à la main."; }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texte).then(ok, secours);
    } else { secours(); }
  }

  function bouton(label, action) {
    var b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.style.cssText = "background:#22304a;color:#e6ecf5;border:1px solid #33445f;border-radius:10px;padding:12px 16px;min-height:44px;font:inherit;cursor:pointer;margin:0 8px 8px 0;";
    b.onclick = action;
    return b;
  }

  function init() {
    var carte = document.createElement("section");
    carte.id = "dc-carte";
    carte.style.cssText = "grid-column:1 / -1;background:#131c2e;border:1px solid #26334d;border-radius:16px;padding:20px;margin:16px 0;color:#e6ecf5;box-sizing:border-box;";

    var h = document.createElement("h2");
    h.textContent = "Demande de confirmation à un comptoir pièces";
    h.style.cssText = "margin:0 0 8px;font-size:1.15em;";
    carte.appendChild(h);

    var intro = document.createElement("p");
    intro.textContent = "Prépare un message rempli depuis le dossier, à envoyer à un comptoir pièces Renault ou à un distributeur. Rien n'est envoyé par cette page : vous copiez le texte et l'envoyez vous-même. Il contient le VIN et la plaque : ne l'envoyez qu'au professionnel contacté.";
    intro.style.cssText = "margin:0 0 12px;opacity:.8;";
    carte.appendChild(intro);

    alerteEl = document.createElement("p");
    alerteEl.style.cssText = "margin:0 0 12px;color:#f2a0a0;display:none;";
    carte.appendChild(alerteEl);

    var barre = document.createElement("div");
    barre.appendChild(bouton("Message complet", function () { mode = "long"; rafraichir(); }));
    barre.appendChild(bouton("Message court (SMS)", function () { mode = "court"; rafraichir(); }));
    barre.appendChild(bouton("Actualiser depuis le dossier", rafraichir));
    carte.appendChild(barre);

    zone = document.createElement("textarea");
    zone.setAttribute("aria-label", "Message de demande de confirmation");
    zone.style.cssText = "width:100%;box-sizing:border-box;min-height:280px;background:#0b1220;color:#e6ecf5;border:1px solid #26334d;border-radius:10px;padding:12px;font:inherit;font-size:16px;line-height:1.4;";
    carte.appendChild(zone);

    var actions = document.createElement("div");
    actions.style.marginTop = "10px";
    actions.appendChild(bouton("Copier", copier));
    if (navigator.share) {
      actions.appendChild(bouton("Partager…", function () {
        navigator.share({ text: zone.value }).catch(function () {});
      }));
    }
    carte.appendChild(actions);

    etatEl = document.createElement("p");
    etatEl.style.cssText = "margin:4px 0 12px;color:#8fd3a8;min-height:1.2em;";
    carte.appendChild(etatEl);

    var rappel = document.createElement("div");
    rappel.style.cssText = "border-top:1px solid #26334d;padding-top:12px;opacity:.9;";
    rappel.innerHTML =
      "<strong>Après la réponse</strong>" +
      "<ul style=\"margin:8px 0 0;padding-left:20px;\">" +
      "<li>Notez : nom du contact, société, date et heure, valeurs et références confirmées. Demandez de préférence une réponse écrite.</li>" +
      "<li>Ajoutez la source dans « Rechercher et consigner une source » (section 6), avec ce qu'elle confirme réellement.</li>" +
      "<li>Choisissez la nature selon le catalogue réellement consulté : « Catalogue constructeur » si c'est celui de Renault, « Catalogue professionnel » si c'est un catalogue de distributeur, « Autre » si le contact ne sait pas le préciser.</li>" +
      "<li>Cochez ensuite seulement les cases que cette source justifie. La page ne coche rien seule.</li>" +
      "</ul>";
    carte.appendChild(rappel);

    var ancre = trouverAncre();
    if (ancre && ancre.parentNode) {
      ancre.parentNode.insertBefore(carte, ancre.nextSibling);
    } else {
      document.body.appendChild(carte);
    }
    rafraichir();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
