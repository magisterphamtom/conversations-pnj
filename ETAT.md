# État — Conversations – portraits des PNJ

## Fait (v1.0.0)
- État partagé dans un réglage monde `state` (active, title, era, speaker, participants[]) : onChange → Stage.render() chez chaque client, pas besoin de socket.
- Stage : <section id="cnv-stage"> ajoutée au body, haut ou bas, taille réglable, réductible ; clic MJ = donner la parole.
- ManagerApp (ApplicationV2) : dépôt Actor / Token / Folder, jetons sélectionnés, nom / rôle / image (FilePicker), masque, invisible, ordre, présélections (réglage monde `presets`).
- Raccourcis : Maj + Numpad1-9, Maj + Numpad0, Maj + NumpadDecimal.
- Orateur automatique : hook createChatMessage exécuté par le MJ actif (speaker.actor ou alias).
- Thèmes 1933 / moderne ; « auto » lit coc7-bascule-epoque.currentEra.

## À tester (Foundry 14.368)
- Côté joueur : apparition, noms masqués, participants cachés, réduction.
- Orateur au clic, au clavier (AZERTY, pavé numérique), via le chat.
- Présélections : enregistrer, charger, supprimer.
- Position en haut : chevauchement éventuel avec la navigation des scènes.
