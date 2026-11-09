---
id: klirpay-payment-reconciliation
version: 2026-11-05.1
kind: procedure-interne
---

# Rapprochement d'un paiement

Le dépôt KlirPay n'est pas ouvert ici. Aucune clé Stripe n'est une autorisation de débit.

## Entrées

- Identifiant de paiement fourni.
- Événements qui citent cet identifiant.
- Transaction interne citant le même identifiant, si elle est fournie.

## Sortie

- Un seul effet métier par identifiant de paiement.
- Écarts nommés, sans écrire dans un compte.

## Données manquantes

Si l'identifiant manque, ne pas rapprocher. Écrire « non précisé ».

## Réussite

Deux événements du même paiement ne deviennent pas deux effets. Aucun remboursement n'est proposé sans une instruction explicite et un dépôt ouvert.
