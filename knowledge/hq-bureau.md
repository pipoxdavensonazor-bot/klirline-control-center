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

## Renvoyer le statut

```bash
curl -sS -X PATCH "https://centre.klirline.com/api/hq/commands/<id>" \
  -H "Content-Type: application/json" \
  -H "Cf-Access-Jwt-Assertion: <jeton Access>" \
  -d '{"status":"done","result":"Article prêt","agentNote":"BWN Rédaction"}'
```

Statuts acceptés : `pending`, `queued`, `dispatched`, `running`, `done`, `blocked`, `cancelled`.

Ordre attendu : `pending` → `dispatched` ou `queued` → `running` → `done`, ou `blocked` si l'agent ne peut pas avancer. `result` et `agentNote` sont facultatifs.

## Créer une commande

```bash
curl -sS -X POST "https://centre.klirline.com/api/hq/command" \
  -H "Content-Type: application/json" \
  -H "Cf-Access-Jwt-Assertion: <jeton Access>" \
  -d '{"text":"Rédiger l'\''article Black Wall News","priority":"haute"}'
```

Sans `ownerSlug`, le centre choisit l'agent. Centia, Klirline.ca, KlirSecure et KlirPay reviennent à Office Klirline tant qu'aucun spécialiste n'existe. Une commande sans cible va à All Question.

Le roster : `GET /api/hq/roster`.
