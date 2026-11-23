# HQ 2.0 — Secret Access du jeton `service:hq-poll` : isolation et rotation

Rédigé le 23 novembre 2026 à 1 h (heure de Toronto). Documentation seulement : je n'ai modifié ni le secret, ni Cloudflare Access, ni les secrets du Worker, ni la routine.

## 1. Où se trouve le secret aujourd'hui

| Élément | Constat (relevé par `stat`, `getfacl`, `ps`) |
| --- | --- |
| Fichier | `/home/box/agent-data/secrets/cf-access-hq-office-poll.env`. `/home/box/agent-data` est un lien symbolique vers `/home/box/sand-data` |
| Permissions | `-rw-------` (600), ACL `user::rw- group::--- other::---` |
| Propriétaire | `box:box` (uid 1000) |
| Taille, date | 255 octets, modifié le 22 nov. 2026 à 0 h 22 (heure de Toronto) |
| Dossier parent | `drwxr-sr-x` (2755), `box:box` : n'importe quel processus de la box peut le lister |
| Contenu | **Valeurs non lues.** Seuls les noms de variables ont été relevés, avec les valeurs masquées par `sed` avant affichage : `CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET`, `CF_ACCESS_TOKEN_NAME`, `CF_ACCESS_APP_DOMAIN`, `CREATED_AT_TORONTO` |
| Qui l'utilise | Le skill `pont-hq-centre-agents` (routine « Poll commandes HQ centre ») envoie `CF-Access-Client-Id` et `CF-Access-Client-Secret` à Access |
| Ce qu'il ouvre | Access accepte le jeton de service, puis le Worker accepte le JWT si le Client ID figure dans `ACCESS_SERVICE_CLIENT_IDS`. L'identité obtenue est `service:hq-poll`, limitée à `/api/hq/*` (`assertServiceRoute`), avec des `scopes` **indéfinis** : création de commande, claim, PATCH, interruption (voir `reconciliation.md`, P2 à P4) |

## 2. Pourquoi `chmod 600` ne suffit pas

- **187 processus tournent sous `box`** : tous les shells d'agents, `node`, `python`, `npm`, le navigateur. Tous les agents de Klirline (15 dossiers d'agents) partagent cet utilisateur Unix. Un fichier `600 box:box` est donc lisible par **chacun** d'eux, y compris par un agent manipulé par une injection d'instructions (texte de commande, page web, courriel).
- À titre de comparaison, les secrets de la plateforme (`box-secrets.json`, `host-secrets.json`) appartiennent à un **autre** utilisateur (`sand-host`, mode 600). C'est ce modèle qui isole réellement.
- Le dossier `secrets/` est listable par tous : un agent n'a pas besoin de connaître le chemin d'avance.
- Le secret transite par des commandes shell (`curl -H …`). Il peut se retrouver dans la sortie d'un outil ou dans un transcript si une commande est mal écrite.

Conclusion : il faut **réduire ce que le secret permet** (portée) et **réduire qui le détient** (isolation). Les permissions du fichier ne règlent ni l'un ni l'autre.

## 3. Options d'isolation

| Option | Principe | Gain | Limites | Effort |
| --- | --- | --- | --- | --- |
| **A. Portée minimale** (à faire en premier, quelle que soit la suite) | Fiche `HQ_MACHINE_IDENTITIES` dédiée (`machine-distributor`, portée `dispatch`). Suppression du repli `service:hq-poll` à `scopes` indéfinis. Correctifs P2 à P4 (`distributeur-spec.md` §2.2) | Même volé, le secret ne permet plus de créer, d'annuler, de rouvrir ni d'approuver | Il reste lisible par tous les agents | Inclus dans la phase 2 (environ 0,5 j) |
| **B. Identité dédiée par distributeur** | Un jeton de service Access par exécutant (Office, et plus tard chaque agent qui appelle le centre). Chacun a son Client ID dans `ACCESS_SERVICE_CLIENT_IDS` et sa fiche avec ses propres portées. Le secret est stocké dans le coffre de la plateforme plutôt que dans un fichier `box` | Révocation ciblée, journal par identité, pas de secret commun | Il faut une Service Auth Access par jeton, et un coffre accessible au seul agent concerné (à vérifier côté plateforme) | 0,5 à 1 j, plus la configuration Access |
| **C. Secret détenu côté centre, réveil par événement** | Aucun secret Access sur la box. Le centre (alarme DO ou file trop ancienne) **réveille** le distributeur par un webhook authentifié. Le distributeur répond par le canal du réveil, ou avec un jeton court émis par le centre pour une seule commande (bail) | Plus aucun secret long sur la box. Moins de tours vides | Le Worker fait un appel sortant (à approuver). Il faut un point de réveil fiable côté Grok Bot, et un jeton de bail court à concevoir (signature et expiration) | 2 à 3 j, après la phase 2 |

Recommandation : **A tout de suite, puis B, puis C** quand le réveil par événement aura été testé (décision t73u : poll réduit, alarmes DO hybrides).

## 4. Procédure de rotation contrôlée

Prérequis : l'option A est en place (sinon le nouveau secret aurait les mêmes pouvoirs que l'ancien). Fenêtre conseillée : hors heures de poll (avant 9 h ou après 18 h 30, heure de Toronto), ou routine suspendue.

**Chaque étape demande l'approbation de Philippe.** L'agent prépare et vérifie. Philippe, ou un agent qu'il désigne nommément pour cette étape, exécute.

| # | Étape | Qui | Approbation |
| --- | --- | --- | --- |
| 0 | Relever l'état actuel : nom et Client ID du jeton (public, suffixe `.access`), date d'expiration, policy Service Auth qui l'autorise, valeur actuelle de `ACCESS_SERVICE_CLIENT_IDS` (une liste de Client ID publics, pas des secrets). Noter la date du dernier poll réussi | Agent (lecture) | **Approbation Philippe requise** (lecture de la configuration Access) |
| 1 | Suspendre la routine « Poll commandes HQ centre » | Philippe | **Approbation Philippe requise** |
| 2 | Créer un **nouveau** jeton de service dans Zero Trust (Access, Service Auth), nommé par exemple `hq-distributor-2026-12`, avec une durée limitée (par exemple 90 jours). Le Client Secret ne s'affiche qu'une fois : le déposer directement dans le stockage cible (coffre de l'option B, ou, à défaut, un nouveau fichier 600), **jamais** dans un chat ou un transcript | Philippe | **Approbation Philippe requise** |
| 3 | Ajouter le nouveau jeton à la policy Service Auth de l'application `centre.klirline.com`, **sans retirer l'ancien** | Philippe | **Approbation Philippe requise** |
| 4 | Mettre à jour le secret Worker `ACCESS_SERVICE_CLIENT_IDS` : `<ancien>.access,<nouveau>.access`. Mettre aussi à jour la fiche `HQ_MACHINE_IDENTITIES` (`accessClientId` du nouveau). Attention : `wrangler secret put` (ou le tableau de bord) crée et déploie immédiatement une nouvelle version du Worker en production, avec le même code. C'est donc une action de production | Philippe (tableau de bord ou `wrangler secret put` depuis un poste de confiance) | **Approbation Philippe requise** |
| 5 | Basculer : pointer le distributeur vers le nouveau secret, puis lancer **un** poll manuel. Vérifier `GET /api/hq/roster` (200), puis `GET /api/hq/commands?status=pending` (200) et l'identité renvoyée (`machine-distributor`, portée `dispatch`) | Agent désigné | **Approbation Philippe requise** |
| 6 | Vérifier le refus : l'ancien secret doit encore marcher (attendu à ce stade). Un Client ID inventé doit recevoir 401 ou 403 | Agent désigné | **Approbation Philippe requise** |
| 7 | Révoquer l'ancien : retirer son Client ID de `ACCESS_SERVICE_CLIENT_IDS`, le retirer de la policy, puis **révoquer** le jeton dans Zero Trust | Philippe | **Approbation Philippe requise** |
| 8 | Vérifier après révocation : un appel avec l'ancien secret doit être refusé (302 vers la connexion, ou 401/403), le nouveau doit répondre 200. Supprimer **de façon sûre** l'ancien fichier de la box (`shred -u`, ou suppression simple si le système de fichiers ne le permet pas) | Agent désigné | **Approbation Philippe requise** (suppression) |
| 9 | Relancer la routine (à la fréquence réduite du `distributeur-spec.md` §8). Consigner dans le journal : date, nom du jeton, Client ID public, expiration, sans le secret | Philippe | **Approbation Philippe requise** |

### Retour arrière

- **Avant l'étape 7** : l'ancien jeton marche toujours. Il suffit de repointer le distributeur vers l'ancien fichier, puis de retirer le nouveau Client ID de `ACCESS_SERVICE_CLIENT_IDS` et de la policy. Le retour est sans perte. **Approbation Philippe requise.**
- **Après l'étape 7** : l'ancien jeton révoqué ne se réactive pas. En cas d'échec du nouveau, créer un troisième jeton (étapes 2 à 5). En attendant, la file reste lisible et traitable par un humain dans le Bureau, avec sa connexion SSO. **Approbation Philippe requise.**
- Les commandes ne sont jamais perdues : elles restent en `pending` dans le Durable Object pendant la coupure.

### Déclencheurs d'une rotation non planifiée

Le secret apparaît dans un transcript, un commit, un journal ou un message. Un agent a exécuté une instruction suspecte. Un poll réussit en dehors des heures de la routine. Le jeton approche de son expiration. Dans tous ces cas, la rotation reste soumise à l'**approbation de Philippe**, mais elle devient prioritaire.
