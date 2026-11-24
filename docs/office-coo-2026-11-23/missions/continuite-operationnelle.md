# Continuité opérationnelle — Klirline Office (HQ 2.0)

- **Préparé par :** Office Klirline · Ops Klirline (COO), le 23 novembre 2026, soir (America/Toronto).
- **Nature :** procédures de travail et exigences de correctifs. Aucune modification de production, GitHub, Cloudflare ou secrets. Aucune routine créée. Budget 0 $.
- **Principe :** distinguer ce qui **existe aujourd’hui et est prouvé** (code à `45c701a`, tests locaux, lectures GET, pratiques déjà observées) de ce qui **reste à implémenter par Codex**, avec exigence de test. Ne rien inventer.

Sources : audit indépendant du 23 nov. 2026 et code du dépôt (références détaillées non publiées).

Étiquettes : **[EXISTE]** prouvé ; **[ABSENT]** prouvé absent ou défaillant ; **[PROPOSÉ]** règle opérationnelle manuelle, pas dans le code ; **[CODEX]** à développer, avec test d’acceptation.

---

## 1. Quotas épuisés

### Ce qui existe aujourd’hui

> *Sous-section retirée de la version publique : elle détaille des faiblesses non corrigées de la production (P0/P1). Version complète conservée hors dépôt.*

### Faits d’exploitation déjà constatés

> *Sous-section retirée de la version publique : elle détaille des faiblesses non corrigées de la production (P0/P1). Version complète conservée hors dépôt.*

### Procédure manuelle dès maintenant **[PROPOSÉ]**

1. Dès qu’un agent signale un refus d’usage, un plafond atteint ou un silence inattendu à un horaire prévu : arrêter toute tentative de rattrapage automatique, consigner l’heure (America/Toronto), alerter le CEO (gravité P1 — voir § 5).
2. Ne pas acheter de capacité, ne pas contourner par un autre compte ou un appel payant. Budget 0 $.
3. Reporter le travail non bloquant ; ne traiter que les alertes P0 déjà ouvertes (ex. orphelin HQ) en **lecture**.
4. Quand l’usage reprend : ne pas rattraper en double une action d’envoi (voir § 7). Reprendre uniquement des préparations locales.

### À implémenter par Codex **[CODEX]**

> *Sous-section retirée de la version publique : elle détaille des faiblesses non corrigées de la production (P0/P1). Version complète conservée hors dépôt.*

## 2. Agents indisponibles

### Ce qui existe aujourd’hui

> *Sous-section retirée de la version publique : elle détaille des faiblesses non corrigées de la production (P0/P1). Version complète conservée hors dépôt.*

### Procédure manuelle **[PROPOSÉ]**

1. **Suppléance des 8 postes prioritaires (intérim) :**

   | Poste | Titulaire actuel constaté | Suppléant si indisponible |
   |---|---|---|
   | CTO | Codex | Aucun déploiement en son absence. Le COO certifie en lecture ; il ne code pas les correctifs P0 à sa place. |
   | COO | Office Klirline · Ops Klirline | CEO (Philippe) uniquement pour les arbitrages ; pas d’auto-promotion d’un autre agent au rôle COO. |
   | Chief of Staff | Non pourvu (intérim COO) | CEO pour la réception du rapport ; pas de rédacteur improvisé. |
   | Directeur commercial | Non pourvu (coordination COO) | CEO pour toute approbation d’envoi. |
   | Agent commercial KlirProspect | KlirProspect | COO prépare le suivi ; **Philippe reste l’expéditeur**. |
   | Responsable marketing Klir IA | Klirline AI | COO remet le pack existant ; **aucune publication**. |
   | Responsable sécurité | Non pourvu (intérim de contrôle : COO en lecture) | Escalade immédiate au CEO pour tout incident secret / accès. |
   | Ingénieur QA | Non pourvu (contrôle : COO / harnais existant) | Ne pas déclarer un test réussi sans rejouer la commande. |

2. Un agent « présent » sur la box n’est pas « capable » ni « vérifié ». En cas de silence à un rendez-vous de livrable (ex. dimanche 18 h pour le rapport, ou échéance de mission) : attendre la marge du seuil (§ 3), puis alerter le CEO, sans réassigner une commande de production.
3. Interdiction de réassigner, d’annuler ou de « débloquer » `hq-33ebcef6` sans autorisation distincte de Philippe (consigne déjà en vigueur).

### À implémenter par Codex **[CODEX]**

> *Sous-section retirée de la version publique : elle détaille des faiblesses non corrigées de la production (P0/P1). Version complète conservée hors dépôt.*

## 3. Détection des missions bloquées (seuils)

### Ce qui existe aujourd’hui

> *Sous-section retirée de la version publique : elle détaille des faiblesses non corrigées de la production (P0/P1). Version complète conservée hors dépôt.*

### Seuils opérationnels proposés (manuels) **[PROPOSÉ]**

Ces seuils ne sont pas dans le code. Ils servent au COO en lecture, jusqu’à l’alarme Durable Object.

| Situation | Seuil proposé | Gravité d’alerte CEO | Action autorisée sans le CEO |
|---|---|---|---|
| Commande `running` avec claim et bail encore valide | 0–30 min : normal | — | Suivre en lecture |
| Commande `running` dont le bail de 30 min est échu | Dès 30 min | P1 si un propriétaire est identifié ; P0 si `claim=null` | Consigne, pas d’écriture en production |
| Commande `running` **sans claim** (`claim=null`) | **Immédiat** (c’est déjà le cas de `hq-33ebcef6`) | **P0** | Quarantaine documentaire déjà ouverte ; **ne pas** annuler, réassigner ni relancer |
| Commande `running` ou silencieuse depuis 2 h | 2 h | P1 | Lecture, notification |
| Commande `running` ou sans mise à jour depuis 24 h | 24 h | P0 | Idem ; rappeler la décision CEO |
| Livrable refusé 409 / liste incomplète (fenêtre 200) | Dès le premier 409 suspect | P1 | Ne pas recréer la commande (idempotence absente) ; documenter |
| Mission sensible « approuvée » par une machine | Dès constat | P0 (défaut P0-3) | Ne pas traiter l’approbation comme valide |
| Lecture d’API en 403/1010 « do not retry » | Dès le premier | P1 (visibilité) | **Ne pas réessayer** la même signature |

`hq-33ebcef6` a déjà franchi le seuil P0. Elle reste en quarantaine jusqu’à décision de Philippe. Aucune reprise automatique.

### À implémenter par Codex **[CODEX]**

> *Sous-section retirée de la version publique : elle détaille des faiblesses non corrigées de la production (P0/P1). Version complète conservée hors dépôt.*

## 4. Procédures de reprise

### Ce qui existe aujourd’hui

> *Sous-section retirée de la version publique : elle détaille des faiblesses non corrigées de la production (P0/P1). Version complète conservée hors dépôt.*

### Procédure manuelle de reprise **[PROPOSÉ]**

Ordre obligatoire, sans écriture de production :

1. **Constater** en lecture (GET déjà autorisé, ou copie locale). Noter l’identifiant, le statut, le claim, les horodatages en America/Toronto.
2. **Classer** : orphelin (`running` + `claim=null`) → quarantaine, arrêt, alerte P0, attendre Philippe. Commande `blocked` après bail → documenter, ne pas reclamer en production pour « tester ». Doublon suspect (deux identifiants pour le même objet) → ne pas clore l’un des deux sans décision.
3. **Reprendre le travail métier en local** (briefs, rapports, brouillons) sous le même propriétaire de mission, sans créer de nouvelle commande HQ « pour rattraper ».
4. **Interdit** : toute écriture d’état en production (modification, claim, interruption, annulation, reset, seconde création), fusion, déploiement, rotation de secret, envoi externe.
5. Si le CEO autorise plus tard un déblocage en production : le faire selon un plan écrit (déjà ébauché pour `hq-33ebcef6` dans `/workspace/hq2/quarantaine-hq-33ebcef6/plan-quarantaine.md`), après les correctifs P0 pertinents si l’écriture d’état est en jeu.

### À implémenter par Codex **[CODEX]**

> *Sous-section retirée de la version publique : elle détaille des faiblesses non corrigées de la production (P0/P1). Version complète conservée hors dépôt.*

## 5. Alertes au CEO

### Ce qui existe aujourd’hui

> *Sous-section retirée de la version publique : elle détaille des faiblesses non corrigées de la production (P0/P1). Version complète conservée hors dépôt.*

### Canal et gravité proposés **[PROPOSÉ]**

- **Canal principal :** message à Philippe dans le fil Office, par le COO (ou le Chief of Staff une fois nommé).
- **Canal secondaire :** seulement si Philippe l’autorise plus tard, un courriel brouillon à l’adresse qu’il indiquera, **non envoyé par un agent** (Philippe envoie). Aucune routine d’alerte n’est créée ici.
- **Pas de publication**, pas de canal externe, pas d’appel payant.

| Gravité | Définition | Délai de signalement visé | Exemples déjà pertinents |
|---|---|---|---|
| **P0** | Atteinte à l’intégrité, à la production, aux secrets, ou commande orpheline `running` sans claim ; approbation machine d’une action réservée à l’humain | Dès constat, sans attendre un rapport hebdo | `hq-33ebcef6` ; P0-1 à P0-5 s’ils sont **exploités** (pas seulement connus) ; fuite de jeton |
| **P1** | Mission métier bloquée au-delà de 2 h, quota agent épuisé au point d’empêcher un livrable prévu, lecture de visibilité cassée, relance commerciale en suspens d’approbation | Dans les 4 h ouvrables, ou le matin suivant si constaté hors heures | Quota Grok épuisé un jour de relance (20 nov.) ; liste 200 ; Facebook non reconnecté la veille d’une publication déjà approuvée |
| **P2** | Dégradation, dette, rappel de décision non urgente | Dans le rapport hebdomadaire (mission C) | P2 techniques restants, postes non pourvus |

Contenu minimal d’une alerte : identifiant ou dossier, heure America/Toronto, fait observé, source, **ce qui n’a pas été fait** (pas d’écriture, pas d’envoi), décision demandée. Aucun secret en clair.

---

## 6. Contrôle des coûts (cible 0 $)

### Ce qui existe aujourd’hui

> *Sous-section retirée de la version publique : elle détaille des faiblesses non corrigées de la production (P0/P1). Version complète conservée hors dépôt.*

### Procédure **[PROPOSÉ]**

1. Tout travail se fait avec les outils déjà autorisés, sans acheter de quota, de média, de domaine ou de service.
2. Le rapport hebdomadaire (mission C) porte une ligne Budget. On n’écrit « 0 $ » que pour les postes **contrôlés** (pas d’achat initié par les agents ; plafond modèle respecté). On n’affirme pas l’absence de tout coût d’infrastructure préexistant.
3. Si un écran ou une API propose un paiement (parcours live KlirProspect, forfaits Klir IA encore « en configuration ») : **ne pas encaisser, ne pas tester en mode live.**
4. Un correctif Codex se livre en PR brouillon, sans fusion (une fusion sur la branche de production **déploie automatiquement** — P0-5).

### À implémenter par Codex **[CODEX]**

> *Sous-section retirée de la version publique : elle détaille des faiblesses non corrigées de la production (P0/P1). Version complète conservée hors dépôt.*

## 7. Prévention des exécutions multiples

### Ce qui existe aujourd’hui

> *Sous-section retirée de la version publique : elle détaille des faiblesses non corrigées de la production (P0/P1). Version complète conservée hors dépôt.*

### Procédure manuelle **[PROPOSÉ]**

1. Une mission pilote = un propriétaire (missions A, B, C). Pas de second agent qui recrée la même commande HQ.
2. Ne pas créer de commande HQ en production pour ces missions tant que l’idempotence et le claim ne sont pas corrigés, sauf ordre distinct.
3. En cas de doute sur un doublon : documenter les deux identifiants, n’en clore aucun.
4. Rattrapage après un quota épuisé (cas du 20 nov.) : vérifier d’abord qu’aucun envoi humain n’a déjà eu lieu, puis ne préparer que le travail manquant.
5. Ne pas faire tourner deux sondeurs qui prendraient la même file.
6. Ne jamais coller un jeton de claim dans un chat, un rapport ou un transcript.

### À implémenter par Codex **[CODEX]**

> *Sous-section retirée de la version publique : elle détaille des faiblesses non corrigées de la production (P0/P1). Version complète conservée hors dépôt.*

## 8. Synthèse : exploitable maintenant vs attendu de Codex

**Exploitable dès maintenant (mode supervisé, GO limité de l’audit) :** lectures et préparation de briefs/brouillons ; missions A/B/C en local ; alertes manuelles dans le fil Office ; budget 0 $ ; aucun envoi automatique (déjà garanti par le code : 403 / `send:false`). Toute écriture d’état HQ, toute fusion, tout envoi restent des décisions de Philippe.

**Non exploitable en autonomie :** détection fiable des blocages, reprise, anti-doublon, coûts sincères, quotas isolés, heartbeat, file d’échecs, arrêt d’urgence, attribution par agent.

**Verdict de contexte (audit 23 nov., inchangé ici) :** **NO-GO** pour l’exploitation multi-agents autonome et pour toute fusion des correctifs tant qu’ils n’ont pas été reçus, testés et autorisés. **GO limité** pour le travail supervisé déjà autorisé.

Les correctifs Codex se livrent sur branches dédiées et PR **brouillon**, avec le harnais de référence rejoué 3 fois et `compare.mjs` sans écart, plus un test de non-régression pour chaque P0/P1 corrigé. Aucune fusion, aucun déploiement, aucune rotation de secret, aucun appel payant sans autorisation explicite et distincte de Philippe.
