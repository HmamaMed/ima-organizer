# Handoff IDE — Intégration des assets Life Organizer

Objectif : intégrer ce pack de marque dans l’application existante, sans modifier les fonctionnalités, les comptes, les APIs ou le backend. Lire le PROJECT_CONTEXT.md disponible, puis ce README et ce document. Inspecter le dépôt actuel et les éventuels AGENTS.md avant toute modification.

## 1. Référence de marque

Les fichiers dans brand/ sont les références canoniques. Conserver le nom Life Organizer et le nouveau symbole à deux pages. Ne pas utiliser l’ancien aperçu raster comme master de production.

| Usage | Fichier |
| --- | --- |
| Symbole sur fond clair | brand/mark-color.svg |
| Symbole monochrome sur fond clair | brand/mark-plum.svg |
| Symbole sur fond foncé | brand/mark-white.svg |
| Login / page de présentation | brand/logo-stacked-color.svg |
| En-tête / présentation horizontale | brand/logo-horizontal-color.svg |
| Logo horizontal sur fond foncé | brand/logo-horizontal-white.svg |
| Nom seul | brand/wordmark-plum.svg ou wordmark-white.svg |
| Fond adaptatif Android | #F8F6F3 |

Les lettres des logotypes sont des contours SVG ; les textes fonctionnels de l’app restent Inter/Fraunces. Le SVG currentColor est conçu pour une inclusion inline ou un composant : un img externe n’hérite pas automatiquement de la couleur CSS du parent.

Préserver les proportions. Ne pas étirer, ajouter d’ombre, recolorer arbitrairement ou transformer le symbole en bouton décoratif géant. Garder de l’espace autour : au moins environ 8 % de la largeur du symbole lorsqu’il est seul, et 6 % de la hauteur d’un logotype complet. Pour une petite icône, utiliser le symbole sans le nom.

## 2. Frontend

Inspecter mobile/src/shared/ui/HeartMark.tsx, BrandHeader.tsx, les écrans splash/login/home et les assets racine existants. Adapter le composant partagé ou son import de SVG pour que toutes les utilisations affichent le même symbole.

Préférer les SVG pour l’interface. Les PNG sont des solutions de repli pour les outils exigeant une image raster. Utiliser les fichiers complets color/white correspondant au fond ; ne pas appliquer des filtres CSS qui modifient les deux couleurs simultanément.

Images de marque : alt="Life Organizer" lorsqu’elles représentent le nom de l’app ; alt="" et aria-hidden lorsque le nom est déjà écrit à côté et que l’image est décorative. Ne pas dupliquer le nom annoncé par le lecteur d’écran.

Les SVG chapters/ sont facultatifs pour les grandes tuiles de chapitre. Conserver Ionicons pour les commandes courantes ; ne pas remplacer toute la bibliothèque ni modifier les zones tactiles. Shopping, Calendar et Little plans restent des propositions/Soon.

Les illustrations empty-states/ accompagnent les vrais états vides. Texte suggéré, à afficher en HTML :

- Notes : “A little note will find you here.”
- Memories : “Our story is just beginning.”
- Gym : reprendre l’état actuel sans programme, “Your plan is being written. Check back soon ♥”.

## 3. Choisir une voie native cohérente

Deux voies sont fournies. Inspecter le projet avant de choisir ; ne pas utiliser les deux sans contrôler les sorties.

### A. Sources Capacitor

Copier les cinq fichiers de capacitor-source/ dans le dossier de sources prévu par le script existant, normalement mobile/assets/. Le pack suit le mode Custom de @capacitor/assets : trois icônes source en 1024 px et deux splash en 2732 px.

Exécuter d’abord le script assets déjà présent dans mobile/package.json s’il appelle l’outil. Si @capacitor/assets est déjà installé et que le projet utilise sa CLI directement, la commande documentée est, depuis mobile/ :

~~~bash
npx capacitor-assets generate --android
~~~

Ne pas installer une nouvelle version de l’outil sans vérifier la version actuelle/lockfile. Vérifier les fichiers générés et les noms dans AndroidManifest.xml après génération. Les nouveaux fichiers peuvent remplacer les ressources natives homonymes ; contrôler le diff avant d’enregistrer.

### B. Ressources Android livrées

Fusionner android-res/ avec mobile/android/app/src/main/res/ plutôt que remplacer ce dossier. Les noms portent le préfixe lo_ pour limiter les collisions.

Les couches adaptatives sont des XML vectoriels de 108 × 108 dp, avec le symbole d’environ 52 dp centré à l’intérieur de la zone de sécurité. Aucun masque arrondi n’est incorporé dans le premier plan. Les fichiers mipmap-anydpi-v26 sont bicolores ; ceux en v33 ajoutent le calque monochrome. Les PNG des mipmap-mdpi…xxxhdpi sont les replis legacy.

Références à fusionner dans l’élément application du manifest, seulement si elles correspondent au choix effectué :

~~~xml
android:icon="@mipmap/lo_launcher"
android:roundIcon="@mipmap/lo_launcher_round"
~~~

Après un passage ultérieur du générateur Capacitor, revérifier les ressources : ne pas laisser un pipeline de génération réintroduire des noms ou images différents.

## 4. Splash natif et splash React

Android 12+ utilise l’écran de démarrage système avec une icône et une couleur de fenêtre. Ne pas passer le logotype complet avec son nom comme icône centrale : il pourrait être masqué.

Fichiers natifs : drawable/lo_splash_icon.xml (fond clair), drawable/lo_splash_icon_dark.xml (symbole blanc sur fond foncé). Leurs canvases sont 288 × 288 dp, avec le dessin dans le cercle de sécurité de 192 dp. Le pack ne fournit pas d’animation native.

Fusionner les références dans le thème de lancement déjà utilisé par l’app et Capacitor. Les noms d’attribut diffèrent suivant la bibliothèque/thème Android existant : les vérifier avant d’éditer. Valeurs à utiliser :

- Icône : @drawable/lo_splash_icon ; variante sombre explicite si nécessaire.
- Couleur : @color/lo_splash_background ; sombre @color/lo_splash_background_dark.
- Ne pas ajouter un iconBackground au thème si l’intégration utilise la géométrie “sans arrière-plan d’icône” de ce pack.

splash.png et splash-dark.png sont des sources de génération legacy. La présence du splash sombre ne signifie pas que toute l’app possède un thème sombre. L’écran splash React peut utiliser le logotype complet et le texte actuel “made just for you”. Ne pas augmenter artificiellement la durée de lancement ni ajouter une deuxième attente obligatoire.

## 5. Notification

Fusionner la ressource drawable/lo_notification.xml et/ou les variantes PNG blanches sur alpha. Ne pas utiliser l’icône bicolore avec un fond plein comme petite icône de notification.

Si le projet n’a pas déjà une icône par défaut, fusionner ces metadata dans l’élément application de AndroidManifest.xml :

~~~xml
<meta-data
    android:name="com.google.firebase.messaging.default_notification_icon"
    android:resource="@drawable/lo_notification" />
<meta-data
    android:name="com.google.firebase.messaging.default_notification_color"
    android:resource="@color/lo_notification_accent" />
~~~

Les paramètres explicites du message FCM peuvent définir une autre icône/couleur. Vérifier le flux réel ; cette intégration visuelle ne corrige pas les permissions, l’enregistrement/renouvellement de token ou la livraison des notifications.

## 6. Web facultatif

Le favicon.svg et les PNG/ICO peuvent remplacer le favicon actuel de mobile/index.html selon le pipeline existant. Les icônes maskable sont fournies séparément. Ne pas ajouter une PWA, un service worker ou des caches offline uniquement parce que des icônes sont disponibles.

## 7. Vérifications et livraison

- Affichage net du symbole à 24/32/48 px et des logotypes sur fond clair/foncé.
- Aucun nom tronqué, image étirée ou fond noir artificiel autour d’un PNG transparent.
- Icône du launcher sous masque rond et arrondi ; icône thématique Android 13+.
- Notification petite icône, en clair/sombre et en arrière-plan.
- Splash froid/chaud, safe area et transition native vers React, sur appareil/émulateur.
- Build Android, lint/build frontend et contrôles requis du dépôt.
- Aucun changement de fonctionnalité ni activation des futurs chapitres.

Fournir les fichiers changés, les captures des usages intégrés et les vérifications réellement exécutées. Le pack a été vérifié comme ressources graphiques et XML ; il n’a pas encore été compilé dans l’application.

## Sources officielles vérifiées le 13 octobre 2026

- [Capacitor 8 — Splash Screens and Icons](https://capacitorjs.com/docs/guides/splash-screens-and-icons) : noms sources, tailles et Android 12+.
- [ionic-team/capacitor-assets](https://github.com/ionic-team/capacitor-assets) : modes et CLI de génération.
- [Android — Adaptive icons](https://developer.android.com/develop/ui/compose/system/icon_design_adaptive) : couches, monochrome et zone de sécurité.
- [Android — Splash screens](https://developer.android.com/develop/ui/views/launch/splash-screen) : icône native et dimensions.
- [Firebase — Android get started](https://firebase.google.com/docs/cloud-messaging/android/get-started) : metadata d’icône et couleur de notification.
