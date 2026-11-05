# Bureau réel

Le bureau est distinct du rapport de démonstration. Les 34 postes simulés restent sur `POST /api/command`. Les commandes réelles passent par `/api/hq/*`.

Office Klirline interroge le centre, choisit l'agent Grok indiqué par `grokAgentName`, puis renvoie le statut. Le Worker ne contacte aucun agent.

## Session

Sur `https://centre.klirline.com`, ces routes exigent le même jeton Cloudflare Access que les autres routes du dossier. Sans `Cf-Access-Jwt-Assertion`, la réponse est `401`. Le cookie seul ne suffit pas au Worker. Ne pas écrire le jeton dans le dépôt.

En local, `node src/server.js` reste une démonstration : le bureau répond sans Access.

## Lire la file

```bash
curl -sS "https://centre.klirline.com/api/hq/commands?status=pending" \
  -H "Cf-Access-Jwt-Assertion: <jeton Access>"
```

Chaque élément contient `id`, `text`, `ownerSlug`, `grokAgentName`, `division`, `priority`, `status`, `createdAt`.

Les statuts utiles à l'aller sont `pending` et `queued`.

## Prendre une commande

Une seule exécution active. Le premier `POST /api/hq/commands/<id>/claim` passe `pending` ou `queued` à `dispatched` et renvoie `claimToken` une fois. Le dépôt ne garde que l'empreinte du jeton.

Un second claim pendant le bail (30 minutes) répond `outcome: "held"` : même statut, même `updatedAt`, sans `claimToken`. Ce n'est pas une nouvelle distribution.

```bash
curl -sS -X POST "https://centre.klirline.com/api/hq/commands/<id>/claim" \
  -H "Content-Type: application/json" \
  -H "Cf-Access-Jwt-Assertion: <jeton Access>" \
  -d '{}'
```

Si le bail d'une commande `dispatched` est expiré, le claim suivant est une reprise documentée : nouveau jeton, note `Reprise documentée`, `updatedAt` renouvelé. Un `running` dont le bail est expiré passe `blocked`, avec la date et la note d'interruption, et aucun jeton. Pour la relancer, un humain la repasse `pending`, puis un nouveau claim émet un autre jeton.

`POST /api/hq/commands/<id>/interrupt` avec une note laisse le statut (`dispatched` ou `running`), met à jour `updatedAt` et enregistre la note. Le bail en cours n'est pas rouvert à un second agent.

## Renvoyer le statut

```bash
curl -sS -X PATCH "https://centre.klirline.com/api/hq/commands/<id>" \
  -H "Content-Type: application/json" \
  -H "Cf-Access-Jwt-Assertion: <jeton Access>" \
  -d '{"status":"done","result":"Article prêt","agentNote":"BWN Rédaction"}'
```

Statuts acceptés : `pending`, `queued`, `dispatched`, `running`, `awaiting_validation`, `blocked`, `done`, `failed`, `cancelled`.

Ordre attendu : `pending` ou `queued` → `dispatched` → `running` → `done`, ou `awaiting_validation` si une personne doit relire. `blocked` ou `failed` si l'agent ne peut pas avancer. `cancelled` abandonne la commande.

`done` exige une preuve : `result`, `proof` ou `agentNote` non vide. Sans cela le PATCH répond `400` et la commande ne change pas. La preuve s'affiche dans la colonne Fait du bureau.

## Créer une commande

```bash
curl -sS -X POST "https://centre.klirline.com/api/hq/command" \
  -H "Content-Type: application/json" \
  -H "Cf-Access-Jwt-Assertion: <jeton Access>" \
  -d '{"text":"Rédiger l'\''article Black Wall News","priority":"haute"}'
```

Sans `ownerSlug`, le centre choisit l'agent. Centia, Klirline.ca, KlirSecure et KlirPay reviennent à Office Klirline tant qu'aucun spécialiste n'existe. Une commande sans cible va à All Question.

Le roster : `GET /api/hq/roster`.
