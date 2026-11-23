# HQ 2.0 — Architecture cible (brouillon, phase 0)

Statut : **proposition à valider par Philippe**. Rien n'est implémenté. Le document réutilise `CompanyState`, l'authentification Cloudflare Access et les couches commandes et missions décrites dans `docs/hq2/audit.md`.

## 1. Principes

1. **Un Worker, un DO par organisation.** On ne crée ni nouvelle classe DO ni nouveau service. Les nouvelles tables sont créées par `CREATE TABLE IF NOT EXISTS` dans le constructeur de `CompanyState`, sans migration de classe.
2. **Les agents restent externes.** Les agents Grok (Office, KlirProspect…) font du *pull* sur `/api/hq/*` avec un jeton de service Access. Le Worker n'appelle aucun modèle et ne « réveille » personne. Il garde l'état, applique la politique et journalise.
3. **La décision reste une fonction pure.** On garde le motif actuel : lecture, `decide*()` pure, écriture, dans un seul appel RPC du DO. Ce motif donne l'atomicité et se teste sans Cloudflare.
4. **L'humain est prouvé, pas déclaré.** Une approbation A3 n'est valable que si elle vient d'un JWT Access **humain** (`identity.human === true`). Une machine ne peut jamais approuver, quel que soit son `actorId`.
5. **Pas d'auto-élévation.** Les rôles, niveaux, budgets et portées ne se modifient que par une décision humaine journalisée. `rejectImpersonation` et `rejectElevation` restent appliqués partout.
6. **Additif.** Les tables `company`, `hq_command` et `hq_mission`, les routes et les statuts actuels restent compatibles. Le moteur de démonstration des 34 postes reste à part.

## 2. Modèle de données (nouvelles tables du DO)

Les colonnes indexées servent au filtrage. Le reste est un `body` JSON, comme aujourd'hui.

```sql
-- Registre des rôles (36 postes). La source de vérité est versionnée dans src/hq/roles.js,
-- et la table ne garde que l'état modifiable (actif, niveau, budget).
CREATE TABLE IF NOT EXISTS hq_role (
  id TEXT PRIMARY KEY,            -- ex. "sales-director"
  department TEXT NOT NULL,       -- direction | marketing | ventes | technologie | finance | support | securite | produits
  active INTEGER NOT NULL,        -- 0/1 ; 6 à 8 exécutants actifs au départ
  autonomy TEXT NOT NULL,         -- A0 | A1 | A2 | A3 (plafond, jamais dépassé)
  updated_at TEXT NOT NULL,
  body TEXT NOT NULL              -- reportsTo, mission, skills, rosterSlug (carte Grok), capCents/mois
);

-- Journal append-only : décisions, approbations, dépenses, arrêts. Jamais d'UPDATE ni de DELETE.
CREATE TABLE IF NOT EXISTS hq_journal (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  kind TEXT NOT NULL,             -- decision | approval | spend | transition | kill | policy | adapter
  actor_id TEXT NOT NULL,
  human INTEGER NOT NULL,
  mission_id TEXT,
  body TEXT NOT NULL,             -- options, analyse, sources, niveau requis, empreinte du contenu
  prev_hash TEXT NOT NULL,        -- chaînage SHA-256 de la ligne précédente
  hash TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS hq_journal_mission ON hq_journal (mission_id, seq);

-- Budgets : un plafond par portée et par période, et des dépenses en lignes séparées.
CREATE TABLE IF NOT EXISTS hq_budget (
  scope TEXT NOT NULL,            -- org | department:<id> | role:<id> | mission:<id>
  period TEXT NOT NULL,           -- "2026-12" ou "mission"
  cap_cents INTEGER NOT NULL,     -- 0 par défaut ; seul un humain le relève
  spent_cents INTEGER NOT NULL,
  PRIMARY KEY (scope, period)
);

-- Idempotence des écritures (création de commande ou de mission, appels d'adaptateur).
CREATE TABLE IF NOT EXISTS hq_idempotency (
  key TEXT PRIMARY KEY,           -- "<actorId>:<Idempotency-Key>"
  request_hash TEXT NOT NULL,
  response TEXT NOT NULL,
  created_at TEXT NOT NULL        -- purge après 7 jours par l'alarme
);

-- Interrupteurs : arrêt d'urgence global, par département ou par adaptateur.
CREATE TABLE IF NOT EXISTS hq_switch (
  id TEXT PRIMARY KEY,            -- "global" | "department:ventes" | "adapter:klirprospect"
  state TEXT NOT NULL,            -- run | stop
  body TEXT NOT NULL              -- raison, humain, date
);
```

Les tables `hq_mission` et `hq_command` sont conservées. Champs ajoutés **dans le `body`**, donc sans changement de schéma :

- mission : `roleId` (rôle propriétaire), `requiredLevel` (A0 à A3), `budgetScope`, `parentMissionId`, `journalSeqs` (renvois vers le journal plutôt qu'une copie, au-delà de 80 événements) ;
- commande : `heartbeatAt`, `failure: { code, message, retryable, at }`, `idempotencyKey`.

Correctif nécessaire, sans changement de schéma : `hqMissionOperate` doit lire **les commandes de la mission par identifiant** (`SELECT … WHERE id IN (…)`) au lieu de `hqList({})`, qui est limité à 200 lignes (risque R5).

## 3. Rôles et autonomie

| Niveau | Peut faire seul | Exemples |
| --- | --- | --- |
| A0 | Lire, résumer, analyser | Lire le pipeline, produire une note d'analyse |
| A1 | Écrire en interne, réversible | Créer un brouillon, une tâche, une fiche CRM |
| A2 | Décider en interne, dans son budget, journalisé | Prioriser des pistes, répartir des tâches, dépenser sous son plafond |
| A3 | **Rien sans un humain** | Communication externe, publication, déploiement, dépense hors plafond, configuration sensible |
| Toujours humain | Hors niveaux | Paiements, contrats, suppressions importantes, décisions juridiques |

Le niveau effectif d'une action vaut `max(niveau requis par le type d'action, niveau requis par le montant)`. Un rôle dont le plafond est inférieur au niveau requis produit une **demande d'approbation**, jamais une exécution. Les seuils existants de `src/policy.js` (`THRESHOLDS`) sont repris comme seuils de montant.

Les 36 postes sont versionnés dans `src/hq/roles.js`. Chaque poste renvoie à une carte Grok (`rosterSlug`) quand un agent réel l'incarne. Les 15 cartes actuelles deviennent des **exécutants**, et les postes de direction des **rôles de décision**. Au départ, 6 à 8 postes sont actifs : Chief of Staff, directeur commercial, agent de vente (KlirProspect), Klir AI (étude de marché), Ops (contrôle qualité), sécurité et conformité, et éventuellement marketing et support.

## 4. Machine d'états des missions

On garde `TRANSITIONS` (`src/hq/missions.js:8`) et on ajoute un état et des gardes :

```
qualify ──► ready ──► running ──► in_review ──► awaiting_human ──► done
   │          │         │  ▲          │               │
   │          │         ▼  │          ▼               ▼
   └──────────┴──► cancelled  blocked/rework ◄── rejected (→ rework)
                        │
                        ▼
                      failed ──► (file d'échecs : reprise humaine ou abandon)
```

- `awaiting_human` est **nouveau**. On y entre quand `requiredLevel = A3` ou qu'une action externe est demandée. On n'en sort que par `POST …/approval` avec `identity.human === true`.
- Toute transition passe par `hq-policy.decide(action, actor, mission)`, qui renvoie `allow | require_approval | deny` avec un motif. Le résultat est écrit dans `hq_journal`.
- Un arrêt d'urgence (`hq_switch` à `stop`) fait refuser `start`, `claim` et les actions d'adaptateur avec le code 423. Les baux en cours sont révoqués et les commandes passent `blocked` avec le code `kill_switch`.

### Commandes : heartbeats, reprise et file d'échecs

- `POST /api/hq/commands/:id/heartbeat` avec `{attemptId, claimToken}` prolonge le bail de 10 min, sans dépasser 2 h au total.
- L'alarme du DO (`alarm()`), programmée à la prochaine échéance de bail, fait passer en `blocked` (code `lease_expired`) les commandes `running` sans heartbeat, et rend `pending` les `dispatched` expirées jusqu'à `maxAttempts`. Au-delà, elles passent `failed`.
- La file d'échecs est `GET /api/hq/commands?status=failed` plus `failure.code`. La reprise passe par une action humaine ou A2 journalisée.

## 5. Points d'approbation (A3)

| Point | Déclencheur | Qui approuve | Preuve exigée |
| --- | --- | --- | --- |
| Envoi externe (courriel, SMS, social, appel) | `POST …/actions` | Humain (CEO, ou COO humain) | Brouillon exact, liste des destinataires, base LCAP pour chaque destinataire, empreinte du contenu |
| Publication | Adaptateur Klir AI, BWN ou Social | Humain | Texte final, empreinte |
| Déploiement ou merge | Adaptateur GitHub | Philippe | Lien de la PR, tests verts |
| Dépense hors plafond ou relèvement de plafond | `hq_budget` | Philippe | Montant, motif, durée |
| Configuration sensible (rôles, niveaux, secrets, Access) | Toute écriture sur `hq_role` ou `hq_switch` | Philippe | Différence exacte |
| Paiement, contrat, suppression, juridique | — | **Toujours hors système** : HQ prépare le dossier, l'humain agit ailleurs | — |

Une approbation reste liée à une empreinte et à une date d'expiration (mécanisme existant de `validApproval`). Elle passe en SHA-256 au lieu de FNV et devient **à usage unique** pour une action externe.

## 6. Contrat d'API des adaptateurs produit

### 6.1 Contrat commun

Chaque adaptateur est un module `src/hq/adapters/<produit>.js` qui expose :

```js
export const adapter = {
  id: "klirprospect",
  version: "1",
  capabilities: [{ op: "leads.search", level: "A0" }, { op: "leads.qualify", level: "A1" } /* … */],
  async call(op, input, ctx) { /* ctx: { env, fetch, signal, idempotencyKey, actor, budget } */ }
};
```

Règles communes :
- **Transport** : HTTPS vers l'API du produit. L'authentification se fait par un jeton de service propre à l'adaptateur, stocké comme secret Worker (jamais dans le dépôt), en **lecture seule par défaut**.
- **Idempotence** : chaque opération d'écriture porte l'en-tête `Idempotency-Key: <missionId>:<taskId>:<op>:<n>`. Le Worker garde la réponse dans `hq_idempotency`, et le produit doit l'honorer aussi.
- **Délais** : 10 s par appel et 2 tentatives au plus sur `429` ou `5xx`, avec un recul de 1 puis 4 s. Aucune nouvelle tentative sur `4xx`.
- **Erreurs normalisées** :

```json
{ "ok": false, "error": { "code": "unauthorized | forbidden | not_found | conflict | rate_limited | unavailable | invalid | policy_denied | kill_switch", "message": "…", "retryable": false } }
```

- **Journal** : chaque appel écrit `kind: "adapter"` avec `op`, la durée, le code et le coût, **sans données personnelles** (les courriels et téléphones sont hachés ou omis).
- **Ordre** : Klir AI, KlirProspect, GitHub, KlirPay (lecture seule, sans aucune écriture), NORIA, KlirBuild, KlirMarket.

### 6.2 Adaptateur KlirProspect (détaillé)

Il part de l'existant : `src/prospect-feed.js` lit `GET <fonction Supabase>/prospects` avec `Authorization: Bearer PROSPECTS_READ_TOKEN`, et `readProspectFeed()` retire déjà les champs de contact. Les endpoints ci-dessous sont **la cible demandée à l'agent KlirProspect**. Ils n'ont pas été vérifiés dans le dépôt `klir-prospect`.

**Auth** : `Authorization: Bearer <KLIRPROSPECT_HQ_TOKEN>`, un secret Worker distinct du jeton de lecture actuel. Deux portées côté KlirProspect : `leads:read` et `leads:write-draft`. Le jeton n'a **jamais** de portée d'envoi. L'organisation est fixée par le jeton, jamais par le corps.

| Op HQ | Méthode et chemin (côté KlirProspect) | Niveau | Écrit ? |
| --- | --- | --- | --- |
| `leads.search` | `POST /hq/v1/leads/search` | A0 | non |
| `leads.get` | `GET /hq/v1/leads/{leadId}` | A0 | non |
| `leads.qualify` | `POST /hq/v1/leads/{leadId}/qualification` | A1 | oui, idempotent |
| `leads.stage` | `POST /hq/v1/leads/{leadId}/stage` | A1, ou A3 pour passer à « Contact autorisé » | oui, idempotent |
| `outreach.draft` | `POST /hq/v1/leads/{leadId}/drafts` | A1 (brouillon seulement) | oui, idempotent |
| `health` | `GET /hq/v1/health` | A0 | non |

Requête `leads.search` :

```json
{
  "market": "qc-agences-web",
  "filters": { "region": ["Montréal", "Laval", "Québec"], "hasPublicEmail": true },
  "limit": 30,
  "cursor": null
}
```

Réponse :

```json
{
  "ok": true,
  "leads": [
    {
      "leadId": "kp_lead_…",
      "company": "Nom de l'entreprise",
      "city": "Laval",
      "website": "https://…",
      "source": { "url": "https://…", "retrievedAt": "2026-11-22T17:00:00Z" },
      "score": 72,
      "stage": "discovered",
      "consent": { "basis": "none | implied_published | express", "evidenceUrl": null, "checkedAt": null },
      "contactAvailable": true
    }
  ],
  "nextCursor": null
}
```

Les coordonnées (courriel, téléphone) ne sont **pas** renvoyées par `search`. `leads.get` ne les renvoie qu'avec la portée `leads:read-contact`, et seulement pour un rôle A1 ou plus.

Requête `leads.stage` :

```json
{ "from": "qualified", "to": "contact_authorized", "reason": "…", "approvalId": "apr-…" }
```

- `stage` ∈ `discovered, qualified, contact_authorized, contacted, replied, meeting, demo, proposal, won, lost`. Ce sont les étapes du pipeline du Sales Center (Découvert → … → Gagné/Perdu).
- Passer à `contact_authorized` **exige `approvalId`**, une approbation humaine valide du centre, et une base de consentement LCAP autre que `none`. Passer à `contacted` n'est possible que si l'envoi a été fait par un humain hors du système, et la preuve de cet envoi est jointe.
- `from` sert de verrou optimiste : s'il ne correspond pas à l'étape réelle, la réponse est `409 conflict`.

Requête `outreach.draft` :

```json
{ "channel": "email", "subject": "…", "body": "…", "language": "fr-CA", "missionId": "msn-…" }
```

Réponse : `{ "ok": true, "draftId": "kp_drf_…", "sent": false }`. L'API n'a **aucun** endpoint d'envoi.

**Idempotence** : l'en-tête `Idempotency-Key` est obligatoire sur les `POST` d'écriture. Une même clé avec le même corps renvoie la même réponse (200). Une même clé avec un autre corps renvoie `409 conflict`.

**Erreurs** :

| HTTP | `code` | `retryable` |
| --- | --- | --- |
| 400 | `invalid` | non |
| 401 | `unauthorized` | non |
| 403 | `forbidden` (portée) ou `policy_denied` (consentement ou approbation manquants) | non |
| 404 | `not_found` | non |
| 409 | `conflict` (étape ou clé d'idempotence) | non |
| 429 | `rate_limited` (`Retry-After`) | oui |
| 5xx | `unavailable` | oui |

Côté centre, l'arrêt d'urgence `adapter:klirprospect` répond `423 kill_switch` sans appeler KlirProspect.

## 7. Nouvelles routes du centre (toutes sous `/api/hq/*`, derrière Access)

| Route | Portée | Note |
| --- | --- | --- |
| `GET /api/hq/roles`, `PATCH /api/hq/roles/:id` | lecture `work`, écriture humain + `review` | Le PATCH est journalisé et vaut A3 |
| `GET /api/hq/journal?missionId=` | `review` | Lecture seule |
| `GET/PATCH /api/hq/budgets` | humain + `review` pour écrire | |
| `POST /api/hq/switch` | humain CEO | Arrêt d'urgence |
| `POST /api/hq/commands/:id/heartbeat` | détenteur du bail | |
| `POST /api/hq/adapters/:id/:op` | selon le niveau de l'opération | Passe par la politique, le budget, le journal et l'idempotence |

Corrections préalables (phase 2) : exiger la portée `work` sur `POST /api/hq/command` et `/interrupt`, exiger un jeton de tentative ou une identité humaine pour tout changement de statut d'une commande louée, et exiger `human === true` pour `decideMission` et pour la branche `reviewer` de `decideCompletion`.
