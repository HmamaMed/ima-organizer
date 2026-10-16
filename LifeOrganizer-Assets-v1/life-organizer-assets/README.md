# Life Organizer — Pack d’assets v1

13 octobre 2026 · Android / React / Ionic / Capacitor · Ressources de marque

Ce pack reprend le concept validé : un cœur qui évoque deux pages de carnet, en rose et doré, avec le nom Life Organizer en prune. Les formes sont reconstruites en SVG à aplats nets. Les PNG sont exportés depuis ces fichiers vectoriels ; ce ne sont pas des agrandissements du premier aperçu généré.

## À ouvrir

- **previews/asset-overview.png** : aperçu des déclinaisons et des icônes.
- **INTEGRATION-IDE.md** : instructions à donner à ton agent IDE avec tout le dossier.
- **brand/logo-stacked-color.svg** : logo principal.
- **brand/mark-color.svg** : symbole seul pour l’interface.
- **capacitor-source/** : les cinq images source de génération native.

## Contenu

| Dossier / fichier | Utilisation |
| --- | --- |
| brand/ | Symboles, logos verticaux/horizontaux, nom seul, versions prune/blanches, masters d’icône et de splash. SVG sans dépendance de police. |
| png/ | Symboles transparents 512 / 1024 / 2048 px ; logos jusqu’à 3000 px ; pictogrammes et états vides. |
| capacitor-source/ | icon-only.png, icon-foreground.png, icon-background.png en 1024 × 1024 ; splash.png et splash-dark.png en 2732 × 2732. |
| android-res/ | VectorDrawable XML, icônes adaptatives, calque monochrome, icônes legacy et notification aux densités Android. À fusionner avec les ressources existantes. |
| chapters/ | Notes, Memories, Gym Coach ; Shopping, Calendar et Little plans restent des propositions. SVG currentColor et couleur fixe. |
| empty-states/ | Trois illustrations vectorielles simples, sans texte, pour les écrans vides existants. |
| web/ | Favicon SVG/PNG/ICO ; icônes 192/512 et variantes maskable. Ressources facultatives, sans création de service worker. |
| source/ | Géométrie source et scripts de reproduction, masters des splash. |
| colors.css / colors.json | Palette de marque. Le doré de logo est décoratif ; utiliser gymText pour les petits textes Gym. |
| ASSET-MANIFEST.json | Inventaire des images et ressources, dimensions et tailles des fichiers. |
| QA.md | Vérifications effectuées et limites. |
| licenses/ | Notice de la police utilisée pour dessiner le nom. |

## Versions de logo

Le symbole bicolore convient aux fonds crème/blancs. Utiliser la version blanche sur un fond prune ou suffisamment foncé ; la version prune fonctionne pour une présentation monochrome sur fond clair.

Le nom a été stabilisé en contours avec **DejaVu Serif Bold**. Il reste proche de la proposition visuelle, mais il ne reproduit pas exactement le lettrage généré. Tous les SVG du logo contiennent les lettres sous forme de tracés : aucun chargement de police n’est nécessaire. Cela ne change pas les polices Inter/Fraunces prévues pour les textes de l’application.

Les variantes blanches peuvent paraître invisibles lorsqu’un explorateur affiche la transparence sur fond blanc : elles sont bien présentes. Les aperçus montrent leur usage sur fond prune.

## Ce que le pack ne prétend pas faire

Les ressources n’ont pas été intégrées dans ton dépôt, compilées en APK ou testées sur téléphone. L’agent IDE doit inspecter les noms de ressources, le thème Android et le script assets actuels avant de fusionner les fichiers. Les documents de référence décrivent un état au 7 octobre ; le dépôt peut avoir changé.

Les nouveaux chapitres sont des pictogrammes de proposition. Ils n’autorisent pas l’ajout de routes, fonctionnalités ou tables. Le pack ne contient pas d’iOS, le projet fourni étant Android.

Les photos de Memories, les médias d’exercices et les messages doivent venir du contenu réel de l’app. Aucun faux souvenir ou média de sport générique n’est ajouté.
