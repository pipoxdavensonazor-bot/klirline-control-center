# Bureau réel

Le bureau est distinct du rapport de démonstration. Les 34 postes simulés restent sur `POST /api/command`. Les commandes réelles passent par `/api/hq/*`.

Office Klirline interroge le centre, prend une commande, choisit l'agent Grok indiqué par `grokAgentName`, puis renvoie le statut et une preuve. Le Worker ne contacte aucun agent.

## Session

Sur `https://centre.klirline.com`, ces routes exigent le même jeton Cloudflare Access que les autres routes du dossier. Sans `Cf-Access-Jwt-Assertion`, la réponse est `401`. Le cookie seul ne suffit pas au Worker. Ne pas écrire le jeton dans le dépôt.

Le poll headless utilisera ce même en-tête. Un jeton de service Access, distinct du SSO humain, sera branché quand la policy Access le permettra. Ce dépôt ne crée pas cette policy et n'ouvre aucune route.

En local, `node src/server.js` reste une démonstration : le bureau répond sans Access.

## Lire la file

```bash
curl -sS "https://centre.klirline.com/api/hq/commands?status=pending" \
  -H "Cf-Access-Jwt-Assertion: <jeton Access>"
```

Chaque élément contient `id`, `text`, `ownerSlug`, `grokAgentName`, `division`, `priority`, `status`, `createdAt`, `updatedAt`. `GET` ne prend pas la commande. Deux lectures peuvent voir le même `id`.

Les statuts prenables sont `pending`, `queued` et `dispatched`. Une commande `running` dont le bail est expiré (`leaseExpired: true`) se reprend par un claim. Elle ne se relance pas tant que le bail tient.

## Prendre la commande

```bash
curl -sS -X POST "https://centre.klirline.com/api/hq/commands/<id>/claim" \
  -H "Content-Type: application/json" \
  -H "Cf-Access-Jwt-Assertion: <jeton Access>" \
  -d '{"claimedBy":"office-klirline","claimToken":"<jeton stable du poll>"}'
```

Le `claimToken` est choisi par le poll (8 à 80 caractères : lettres, chiffres, point, tiret bas, deux-points, tiret). Sans jeton, le centre en génère un et le renvoie dans `command.claimToken`. Il faut le conserver pour reconnaître un renvoi.

Réponse `200`. Exécuter seulement si `started` est `true`. Le `claimToken` n'est renvoyé que pour `claimed`, `reclaimed` et `replay`. La file et un claim déjà tenu par un autre ne le montrent pas.

| `reason` | `started` | Suite |
| --- | --- | --- |
| `claimed` | `true` | Première prise. La commande passe `running`. |
| `reclaimed` | `true` | Le bail précédent est fini. Une nouvelle exécution remplace l'ancienne. |
| `replay` | `false` | Même jeton, bail encore ouvert. Rien n'est réécrit. Ne pas relancer. |
| `already_active` | `false` | Un autre claim tient le bail. Ne rien exécuter. |

`409` si le statut est `done`, `failed`, `cancelled`, `blocked` ou `awaiting_validation`. Le corps contient encore la commande.

Le bail dure 15 minutes à partir de `claimedAt`. Un second claim dans ce délai ne le prolonge pas. Pour le prolonger :

```bash
curl -sS -X PATCH "https://centre.klirline.com/api/hq/commands/<id>" \
  -H "Content-Type: application/json" \
  -H "Cf-Access-Jwt-Assertion: <jeton Access>" \
  -d '{"status":"running","claimToken":"<le même jeton>"}'
```

Un `PATCH` `running` sans ce jeton ne remplace pas le claim en cours.

Si la réponse du premier claim est perdue, renvoyer le même `claimToken` donne `replay` : ne pas lancer une seconde exécution. Le travail déjà commencé dans ce processus peut continuer. Un processus qui n'a jamais démarré attend la fin du bail, puis réclame à nouveau (`reclaimed`).

## Interruption

Un crash laisse la commande `running`, avec `updatedAt`, `claimedBy`, `claimedAt` et `activityNote` (« Prise en charge par … »). Rien n'est effacé. Le centre ne la passe pas seul à `blocked`.

Passé les 15 minutes, `leaseExpired` devient `true`. Le claim suivant répond `reclaimed`, reste `running`, et écrit une `activityNote` d'interruption. `blocked` reste un statut explicite, posé par un `PATCH`.

## Renvoyer le statut

```bash
curl -sS -X PATCH "https://centre.klirline.com/api/hq/commands/<id>" \
  -H "Content-Type: application/json" \
  -H "Cf-Access-Jwt-Assertion: <jeton Access>" \
  -d '{"status":"done","result":"Article prêt","proof":"Brouillon déposé","agentNote":"BWN Rédaction"}'
```

Statuts acceptés : `pending`, `queued`, `dispatched`, `running`, `awaiting_validation`, `blocked`, `done`, `failed`, `cancelled`.

Ordre attendu : `pending` → claim → `running` → `done`, ou `blocked` si l'agent ne peut pas avancer. `awaiting_validation` attend une relecture avant `done`. `failed` clôt sans succès.

`done` exige une preuve : au moins un de `result`, `proof`, `agentNote` non vide. Sinon la réponse est `400` et la commande ne change pas. Les trois textes sont affichés dans la colonne Fait. Un seul suffit.

`done`, `failed` et `cancelled` ne changent plus de statut (`409`).

## Créer une commande

```bash
curl -sS -X POST "https://centre.klirline.com/api/hq/command" \
  -H "Content-Type: application/json" \
  -H "Cf-Access-Jwt-Assertion: <jeton Access>" \
  -d '{"text":"Rédiger l'\''article Black Wall News","priority":"haute"}'
```

Sans `ownerSlug`, le centre choisit l'agent. Centia, Klirline.ca, KlirSecure et KlirPay reviennent à Office Klirline tant qu'aucun spécialiste n'existe. Une commande sans cible va à All Question.

Le roster : `GET /api/hq/roster`.
