BRICK BY BRICK 2.2

Un jeu de reconstruction de phrases à l’oral, pour deux groupes et un écran projeté.

PREMIÈRE PARTIE

1. Ouvrez l’application. La liste d’exemple « Le sport » est déjà chargée.
2. Choisissez une classe ou saisissez deux noms d’équipes en partie libre.
3. Réglez le nombre de briques par phrase (2 à 5) et l’objectif (3 à 12 points).
   Cochez « Assembler les briques par clic » pour utiliser les rangées à l’écran.
4. Lancez la partie, puis activez le plein écran si vous projetez.
5. Chaque équipe reconstruit à l’oral la phrase indiquée, avec les briques de sa
   couleur. En mode par clic, sélectionnez-les dans l’ordre de la phrase.
   Recliquez sur une brique posée pour la remettre dans la réserve.
   Utilisez le bouton Q pour l’équipe verte ou W pour l’équipe orange, ou
   appuyez sur la touche correspondante, pour placer la prochaine brique
   correcte. Si la rangée comporte une erreur, l’aide corrige la première
   position incorrecte.
6. Validez avec 1 ou 2. Les briques se rangent pour afficher la solution pendant
   deux secondes. Chaque point pose deux briques au mur. La réserve se mélange
   à nouveau à la phrase suivante.
   Le premier groupe à atteindre l’objectif gagne.

En partie, Z annule une validation ou un passage et F bascule le plein écran.
Le bouton Aide permet de révéler, de masquer ou de passer la phrase d’un groupe.
L’icône d’agrandissement donne accès au texte complet des indices très longs.
Revenez à Préparation pour interrompre la partie. « Reprendre la partie »
conserve le score, les phrases affichées et les actions récentes.

PRÉPARER DES LISTES

Saisissez une paire « Réponse ; indice » par ligne, par exemple :

Ich spiele gern Tennis. ; J’aime jouer au tennis.
Le Soleil est une étoile. ; De quel type d’astre vient notre lumière ?

Les deux colonnes copiées d’un tableur (tabulations), les fichiers TXT/TSV et les
CSV à point-virgule ou à virgule sont acceptés. Entourez une cellule de guillemets
si elle contient le séparateur. Doublez les guillemets intérieurs. Gardez une
paire par ligne. Les lignes à corriger sont signalées et les doublons écartés.
Il faut au moins deux paires valides pour jouer. Chaque équipe termine sa pioche
avant de revoir des phrases, sauf si sa pioche ne contient qu’une seule phrase.

« Enregistrer la liste » sauvegarde la préparation dans la bibliothèque.
« Bibliothèque » permet de chercher, créer, renommer, déplacer et charger
des listes par dossier. « Assistant IA » prépare un prompt selon la matière, le
thème, le niveau, les langues et l’activité. Copiez-le dans l’IA de votre choix,
puis collez sa réponse dans l’assistant pour la vérifier et la charger.

CLASSES ET SAUVEGARDE

Dans « Classes », créez une classe avec au moins deux groupes. Les listes
d’élèves sont facultatives. Choisissez deux groupes dans la préparation. Le
dernier choix est mémorisé par classe. Seuls les noms des groupes sont affichés
pendant la partie.

L’application conserve les listes, classes, réglages et la dernière partie sur
le Mac. Dans Bibliothèque, exportez une sauvegarde JSON pour transférer vos
dossiers, listes, classes et groupes. L’import ajoute les données à la
bibliothèque actuelle. Le brouillon et la partie en cours restent locaux.

MACOS ET CODE SOURCE

macOS 13 Ventura ou ultérieur. Ouvrez le DMG puis glissez l’application dans
Applications. Le paquet local utilise une signature ad hoc et n’est pas
notarisé par Apple.

Pour lancer depuis le code source : npm ci, puis npm start.
Tests : npm test. DMG universel : npm run dist -- --mac --universal.
Les scripts de rendu dans art/ permettent de recréer les briques et murs
avec Blender, puis d’assembler leurs images WebP avec Pillow.

ENGLISH QUICK START

Brick by Brick is an oral phrase-rebuilding game for two teams in a projected
classroom. Enter one answer and clue per line separated by a semicolon or tab.
Load a saved list under Bibliothèque, choose your class and groups, then start
with Lancer la partie. Use 1 and 2 to award a point, Z to undo and F for full
screen. Aide lets you reveal or skip a phrase. macOS 13 or later is required.

Licence MIT. Voir LICENSE.txt.
