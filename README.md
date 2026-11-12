# Brick by Brick

Un jeu de reconstruction de phrases à projeter en classe. Deux équipes partent d’un indice et remettent les briques dans l’ordre pour retrouver une phrase. Chaque bonne réponse fait avancer le mur de l’équipe.

## Jouer dans le navigateur

[**Ouvrir Brick by Brick**](https://courscircuit.github.io/BrickByBrick/)

Les listes, classes et parties sont enregistrées dans le navigateur utilisé. Pour transférer vos listes et classes entre le Mac et le navigateur, utilisez l’export et l’import d’une sauvegarde JSON dans la bibliothèque.

## Télécharger pour Mac

[**Brick by Brick 2.2.0 — DMG universel**](https://github.com/CoursCircuit/BrickByBrick/releases/tag/v2.2.0)

Le DMG contient les versions Apple Silicon et Intel. Configuration minimale déclarée par l’application : macOS 13 Ventura. Ouvrez le DMG et glissez l’application dans Applications. L’application est signée ad hoc et Apple ne l’a pas notarisée.

## Jouer en classe

1. Chargez la liste d’exemple « Le sport » ou préparez vos propres paires réponse et indice.
2. Choisissez deux équipes, le nombre de briques par phrase et l’objectif de points.
3. Lancez la partie et projetez-la en plein écran. Les équipes reconstruisent les phrases à l’oral ou placent les briques par clic.
4. Validez avec **1** ou **2**. **Z** annule une action, **F** bascule le plein écran et **Q** ou **W** place une brique correcte pour l’équipe correspondante.

La bibliothèque organise les listes en dossiers et accepte les fichiers TXT, TSV et CSV ainsi que le collage depuis un tableur. L’assistant IA prépare un prompt à copier dans l’outil de votre choix. Les listes, les classes et la dernière partie sont conservées localement. Une sauvegarde JSON permet de transférer la bibliothèque et les classes.

## Lancer depuis les sources

```sh
npm ci
npm start
npm test
npm run dist -- --mac --universal
```

Le code est publié sous [licence MIT](LICENSE.txt). La police [Inter est distribuée sous SIL Open Font License 1.1](assets/fonts/OFL-Inter.txt).

Cette application a été vibe codée par un non-développeur, à l’origine pour ses propres besoins.

Créé par S. Bovat
