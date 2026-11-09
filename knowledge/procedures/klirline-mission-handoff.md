---
id: klirline-mission-handoff
version: 2026-11-05.1
kind: procedure-interne
---

# Transmission d'une mission

## Entrées figées

- Identifiant de mission et de tâche.
- Identifiant de tentative et jeton de claim, s'il y a une commande.
- Rôle autorisé, scopes `work` ou `review`, et plafond en cents.
- Livrable attendu et critère de succès.

## Sortie

Un paquet que l'agent suivant peut lire sans réinterpréter l'objectif : entrées, droits, livrable, ce qui manque, et l'état de la mission.

## Données manquantes

Si la tentative, le validateur ou le critère manque, la transmission s'arrête. Ne pas choisir un rôle à la place.

## Réussite

Le receveur ne peut pas valider son propre livrable. Une ancienne tentative ne remplace pas le résultat. L'envoi externe reste une action séparée, refusée tant que la connexion a `sent: false`.
