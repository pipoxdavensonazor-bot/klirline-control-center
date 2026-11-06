---
id: klirprospect-list-quality
version: 2026-11-05.1
kind: procedure-interne
---

# Qualité d'une liste KlirProspect

Le dépôt `klir-prospect` est accessible. Cette procédure ne modifie pas sa base.

## Entrées

- Lignes fournies : entreprise, domaine, téléphone, courriel, produit, source.
- Règle de la fiche produit : une fiche sans domaine est incomplète ; deux fiches du même domaine se signalent.

## Sortie

- Lignes gardées, lignes incomplètes, doublons de domaine.
- Champs laissés vides quand la source ne les a pas.
- Export proposé, non exécuté.

## Données manquantes

Un téléphone absent reste absent. Ne pas fabriquer de numéro, de décideur ni de consentement.

## Réussite

Aucune ligne exportée ne gagne un fait qui n'était pas dans l'entrée. Les doublons de domaine sont nommés, pas fusionnés en silence.
