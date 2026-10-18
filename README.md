<p align="center"><img src=".github/banner.png" alt="conversations-pnj" width="100%"></p>

# Conversations – portraits des PNJ

Module Foundry VTT (v13 / v14) pour les scènes de dialogue : le Gardien choisit les PNJ d'une conversation, leurs portraits s'affichent chez tous les joueurs et celui qui parle est mis en avant. Inspiré de ConversationHUD (Saervicus), qui n'est plus compatible avec la v14.

## Utilisation (Gardien)
1. Bouton **bulles** dans la barre de gauche (ou Maj + pavé numérique `.`) : fenêtre « Conversation ».
2. Glisser des **acteurs**, des **jetons** ou un **dossier d'acteurs**, ou cliquer **Jetons sélectionnés**.
3. Pour chaque participant : nom affiché, rôle, image (clic sur la vignette), ordre, et deux options :
   - **masque** : le nom apparaît en « ??? » chez les joueurs tant que vous ne le révélez pas ;
   - **œil** : le participant est invisible des joueurs (vous le voyez en transparence).
4. **Afficher aux joueurs**.

## Donner la parole
- Clic sur un portrait à l'écran, ou sur la bulle dans la fenêtre.
- **Maj + pavé numérique 1 à 9** (ordre de la liste), **Maj + 0** : plus personne.
- **Automatique** : un message envoyé dans le chat au nom d'un participant lui donne la parole (désactivable).

L'orateur grandit et s'illumine ; les autres s'estompent.

## Thèmes
- **Années 30** : cadres Art Déco noir et or, soleil rayonnant derrière l'orateur.
- **Moderne** : écran de station polaire, coins de viseur, balayage lumineux.
- **Automatique** : suit l'époque du module *Bascule d'époque* (sinon le thème par défaut des réglages).

## Conversations enregistrées
Enregistrez la distribution d'une scène (participants, titre, thème) et rechargez-la d'un clic.

## Orateur à la voix (nouveau en 1.1.0)

Avec le module [Speaking Status](https://github.com/magisterphamtom/speaking-status), la conversation suit les voix de la table :

- **Un joueur parle dans son micro** : le portrait de son investigateur s'avance, comme si le Gardien avait cliqué dessus (il faut parler environ un quart de seconde, une toux ne suffit pas).
- **Le Gardien reprend la parole** : le dernier PNJ qui parlait revient en avant. Le dialogue joueur ↔ PNJ se fait tout seul ; le Gardien ne clique plus que pour changer de PNJ.
- Les clics et le pavé numérique restent prioritaires à tout moment.

Pour que ça marche : ajoutez les investigateurs à la conversation (comme les PNJ), et chaque joueur doit avoir activé son micro dans Speaking Status. Le portrait est trouvé grâce au personnage du joueur (Configuration du joueur > Personnage), sinon grâce à un acteur dont il est propriétaire.

Réglages (Paramètres > Conversations) :

| Réglage | Rôle |
|---|---|
| Orateur à la voix | Active ou coupe la détection des voix des joueurs. |
| Quand le joueur se tait | Son portrait reste en avant (par défaut), retour à l'orateur précédent, ou plus personne. |
| La voix du Gardien ramène le PNJ | Le dernier PNJ revient en avant quand le Gardien parle. |

## Réglages
- Monde : thème par défaut, orateur automatique.
- Chaque utilisateur : position (haut, bas ou **libre**) et taille des portraits. En mode libre, la bande devient une petite fenêtre qu’on déplace par son titre, n’importe où sur l’écran ; sa position est mémorisée. Boutons − / + pour la taille, bouton flèches pour passer en mode libre, bouton pour réduire.

## Installation
Manifeste : `https://github.com/magisterphamtom/conversations-pnj/releases/latest/download/module.json`

## Crédits
Idée originale : ConversationHUD par Saervicus. Code : MIT, magisterphamtom. Polices Limelight, Rajdhani, Inter : SIL OFL 1.1 (voir `fonts/`).
