# Vérification des assets

13 octobre 2026

## Effectué

- 37 SVG et 10 XML Android analysés sans erreur de syntaxe.
- 57 PNG décodés ; dimensions vérifiées pour les cinq sources Capacitor.
- SVG de marque avec lettrage en contours, sans texte dépendant d’une police ni image raster embarquée.
- PNG de marque : fond alpha nul et dessin opaque ; aucun fond noir ou halo incorporé.
- Calque adaptatif : dessin inclus dans le cercle central de 66 dp sur le canvas de 108 dp. Rayon maximal mesuré : 32.89 dp pour une limite de 33 dp.
- Splash natif : rayon maximal mesuré 94.50 dp, inférieur aux 96 dp autorisés.
- Icônes de notification : pixels visibles blancs uniquement, sur alpha transparent.
- Références de ressources Android résolues dans le pack.
- Contrôle visuel du logo principal, du logo horizontal, des variantes blanches et des deux masques d’icône.
- Inventaire détaillé dans ASSET-MANIFEST.json ; empreintes SHA-256 fournies.

## À vérifier dans le projet

Aucune compilation Android, exécution du générateur Capacitor ou intégration React n’a été faite ici : le dépôt n’est pas disponible dans cette conversation. Vérifier le thème natif, les références du manifest, les règles du générateur existant et les usages des SVG dans le dépôt réel. Tester le launcher, l’icône thématique, les notifications et le lancement natif sur appareil/émulateur.

Les images des masques dans previews/ illustrent des découpages calculés ; ce ne sont pas des captures d’un appareil. La présence d’un splash sombre ne constitue pas un thème sombre de l’application.

Le symbole est une reconstruction vectorielle du concept accepté. Le lettrage est stabilisé avec DejaVu Serif Bold, en contours, et reste une adaptation du lettrage généré initialement.
